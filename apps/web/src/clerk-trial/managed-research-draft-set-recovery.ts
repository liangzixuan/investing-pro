import type { ManagedWorkspace } from "./managed-workspace";
import {
  RESEARCH_DRAFT_RESOURCES,
  EMPTY_RESEARCH_DRAFT_MEMBERS,
  formatManagedResearchDraftSetFile,
  parseManagedResearchDraftSetFile,
  decodeResearchDraftSetFile,
  assertResearchDraftSetFileSize,
  researchDraftResourceLabel,
  type ResearchDraftResource,
  type ResearchDraftMember,
  type ManagedResearchDraftSetFileContent,
  type ManagedResearchDraftSetFileDocument,
} from "./managed-research-draft-set-file";
import {
  captureDraftSetResource,
  draftSetResourceEligible,
  beginDraftSetResource,
  endDraftSetResource,
  draftSetReadFence,
  type DraftSetResourceCapture,
  type DraftSetResourceCommit,
} from "./managed-research-draft-set-resources";
import type { ManagedResearchDraftSetFileDeliveryAdapter } from "./research-draft-set-file-delivery";
export interface ResearchDraftSetComparison {
  readonly resource: ResearchDraftResource;
  readonly fileContent: ResearchDraftMember;
  readonly currentContent: ResearchDraftMember | null;
  readonly currentBase: number;
}
export interface ResearchDraftSetRecoveryState {
  readonly phase:
    | "idle"
    | "capture"
    | "reading"
    | "exporting"
    | "inventory"
    | "comparison"
    | "retired";
  readonly selected: readonly ResearchDraftResource[];
  readonly eligibility: Readonly<Record<ResearchDraftResource, boolean>>;
  readonly file: ManagedResearchDraftSetFileContent | null;
  readonly comparison: ResearchDraftSetComparison | null;
  readonly canCapture: boolean;
  readonly canImport: boolean;
  readonly message: string;
}
interface Options {
  workspace: ManagedWorkspace;
  accountScope: Promise<string>;
  delivery: ManagedResearchDraftSetFileDeliveryAdapter | undefined;
  routeActive: () => boolean;
  now?: () => string;
}
type Route = ReturnType<ManagedWorkspace["getResearchDraftSetRoute"]>;
interface Operation {
  kind: "capture" | "read" | "comparison";
  controller: AbortController;
  route: Route;
  catalog: unknown;
  scope: string;
  captures: DraftSetResourceCapture[];
  resources: ResearchDraftResource[];
  readFence: readonly unknown[];
}
const emptyEligibility = Object.freeze({
  watchlist: false,
  portfolio: false,
  followups: false,
  valuation: false,
});
function sameRoute(a: Route, b: Route) {
  return (
    a.navigation === b.navigation &&
    a.view === b.view &&
    a.research === b.research &&
    a.companyRoute === b.companyRoute &&
    a.blocked === b.blocked
  );
}
/** A session-owned file inventory; every restore belongs to one exact resource comparison. */
export class ManagedResearchDraftSetRecovery {
  private state: ResearchDraftSetRecoveryState = Object.freeze({
    phase: "idle",
    selected: [],
    eligibility: emptyEligibility,
    file: null,
    comparison: null,
    canCapture: false,
    canImport: false,
    message: "",
  });
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribers: (() => void)[];
  private scope: string | null = null;
  private operation: Operation | null = null;
  private document: ManagedResearchDraftSetFileDocument | null = null;
  private disposed = false;
  private changing = 0;
  private transition = {};
  constructor(private readonly options: Options) {
    const w = options.workspace;
    this.unsubscribers = [
      w,
      w.coordinator,
      w.portfolio,
      w.portfolio.coordinator,
      w.followups,
      w.followups.coordinator,
      w.valuationAssumptions,
      w.valuationAssumptions.coordinator,
      w.sessionOwner,
    ].map((r) => r.subscribe(this.reconcile));
    this.unsubscribers.push(
      w.valuation.subscribeDraftFileActivity(this.reconcile),
    );
    void options.accountScope
      .then((scope) => {
        if (!this.live()) return;
        if (!/^sha256:[a-f0-9]{64}$/u.test(scope)) throw new Error("scope");
        this.scope = scope;
        this.publish({});
      })
      .catch(() => {
        if (this.live())
          this.publish({
            message: "Draft-set files are unavailable in this session.",
          });
      });
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private live() {
    return (
      !this.disposed &&
      this.options.workspace.sessionOwner.getSnapshot().phase === "active"
    );
  }
  private available() {
    const w = this.options.workspace;
    const view = w.getSnapshot();
    return (
      this.live() &&
      this.options.routeActive() &&
      !w.getResearchDraftSetRoute().blocked &&
      !view.read &&
      !view.review &&
      !view.reviewing &&
      !view.followupOpening
    );
  }
  private now() {
    return this.options.now?.() ?? new Date().toISOString();
  }
  private eligible() {
    if (!this.scope || !this.available()) return emptyEligibility;
    const value = Object.fromEntries(
      RESEARCH_DRAFT_RESOURCES.map((key) => [
        key,
        draftSetResourceEligible(this.options.workspace, key),
      ]),
    ) as Record<ResearchDraftResource, boolean>;
    if (
      RESEARCH_DRAFT_RESOURCES.every(
        (key) => value[key] === this.state.eligibility[key],
      )
    )
      return this.state.eligibility;
    return Object.freeze(value);
  }

  private publish(patch: Partial<ResearchDraftSetRecoveryState>) {
    if (this.disposed) return;
    const selected = patch.selected ?? this.state.selected,
      phase = patch.phase ?? this.state.phase,
      eligibility = this.eligible();
    const next = Object.freeze({
      ...this.state,
      ...patch,
      eligibility,
      canCapture:
        phase === "idle" &&
        this.operation === null &&
        !!this.options.delivery &&
        selected.length > 0 &&
        selected.every((k) => eligibility[k]),
      canImport:
        !!this.scope &&
        this.available() &&
        this.operation === null &&
        (phase === "idle" || phase === "inventory"),
    });
    if (
      (Object.keys(next) as (keyof ResearchDraftSetRecoveryState)[]).every(
        (k) => next[k] === this.state[k],
      )
    )
      return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
  private routeCurrent(op: Operation) {
    return (
      this.available() &&
      this.scope === op.scope &&
      sameRoute(op.route, this.options.workspace.getResearchDraftSetRoute()) &&
      this.options.workspace.getSnapshot().snapshot === op.catalog
    );
  }
  private current(op: Operation) {
    if (
      this.operation !== op ||
      op.controller.signal.aborted ||
      !this.routeCurrent(op)
    )
      return false;
    if (!op.captures.every((c) => c.isCurrent())) return false;
    return (
      op.kind !== "read" ||
      draftSetReadFence(this.options.workspace).every(
        (v, i) => v === op.readFence[i],
      )
    );
  }
  private release(op: Operation | null) {
    if (!op) return;
    this.changing++;
    try {
      for (const k of op.resources)
        endDraftSetResource(this.options.workspace, k, op);
    } finally {
      this.changing--;
    }
  }
  private clear(message: string, retired = false, keepFile = true) {
    this.transition = {};
    const op = this.operation;
    this.operation = null;
    this.document = null;
    op?.controller.abort();
    this.release(op);
    const file = retired || !keepFile ? null : this.state.file;
    this.publish({
      phase: retired ? "retired" : file ? "inventory" : "idle",
      file,
      comparison: null,
      message,
      ...(retired ? { selected: [] } : {}),
    });
  }
  reconcile = () => {
    if (this.changing || this.disposed) return;
    if (!this.live()) {
      this.clear("", true, false);
      return;
    }
    if (this.operation && !this.current(this.operation)) {
      const keep = this.operation.kind === "comparison";
      this.clear(
        "The route, draft or file operation changed. Compare the resource again before restoring.",
        false,
        keep,
      );
      return;
    }
    this.publish({});
  };
  selectResource(resource: ResearchDraftResource, selected: boolean) {
    if (
      this.state.phase !== "idle" ||
      this.operation ||
      !RESEARCH_DRAFT_RESOURCES.includes(resource)
    )
      return false;
    if (selected && !this.state.eligibility[resource]) return false;
    const keys = RESEARCH_DRAFT_RESOURCES.filter((k) =>
      k === resource ? selected : this.state.selected.includes(k),
    );
    this.transition = {};
    this.publish({ selected: Object.freeze(keys), message: "" });
    return true;
  }
  private begin(
    kind: Operation["kind"],
    resources: readonly ResearchDraftResource[] = [],
  ): Operation | null {
    if (!this.scope || !this.available() || this.operation) return null;
    const w = this.options.workspace,
      time = this.now(),
      before = resources.map((k) =>
        captureDraftSetResource(
          w,
          k,
          this.scope!,
          time,
          undefined,
          kind !== "comparison",
        ),
      );
    if (before.some((c) => c === null)) return null;
    const op: Operation = {
      kind,
      controller: new AbortController(),
      route: w.getResearchDraftSetRoute(),
      catalog: w.getSnapshot().snapshot,
      scope: this.scope,
      captures: [],
      resources: [...resources],
      readFence: draftSetReadFence(w),
    };
    this.operation = op;
    this.transition = {};
    this.changing++;
    try {
      for (const k of resources) beginDraftSetResource(w, k, op);
    } finally {
      this.changing--;
    }
    if (!before.every((c) => c?.sameData(op))) {
      this.clear(
        "The draft changed before capture.",
        false,
        kind === "comparison",
      );
      return null;
    }
    const captured = resources.map((k) =>
      captureDraftSetResource(w, k, op.scope, time, op, kind !== "comparison"),
    );
    if (captured.some((c) => c === null)) {
      this.clear(
        "Finish the resource operation before continuing.",
        false,
        kind === "comparison",
      );
      return null;
    }
    op.captures = captured as DraftSetResourceCapture[];
    if (!this.current(op)) {
      this.clear("The route or session changed.", false, kind === "comparison");
      return null;
    }
    return op;
  }
  captureDrafts() {
    if (!this.state.canCapture) return false;
    const op = this.begin("capture", this.state.selected);
    if (!op) {
      this.publish({
        message:
          "The selected drafts are unavailable, invalid or exceed their file limits. Correct them before capture.",
      });
      return false;
    }
    const members = { ...EMPTY_RESEARCH_DRAFT_MEMBERS };
    for (const c of op.captures)
      Object.assign(members, { [c.resource]: c.content });
    const document = formatManagedResearchDraftSetFile({
      accountScope: op.scope,
      capturedAt: this.now(),
      members,
    });
    const file = document
      ? parseManagedResearchDraftSetFile(document.text, op.scope)
      : null;
    if (!document || !file) {
      this.clear(
        "These complete drafts cannot fit in a draft-set file. Your drafts are unchanged.",
        false,
        false,
      );
      return false;
    }
    this.document = document;
    this.publish({
      phase: "capture",
      file,
      comparison: null,
      message:
        "Inspect every included resource and the omitted list before saving the private file.",
    });
    return this.current(op) && this.getSnapshot().phase === "capture";
  }
  async saveFile() {
    const op = this.operation,
      document = this.document,
      delivery = this.options.delivery;
    if (
      !op ||
      !document ||
      !delivery ||
      this.state.phase !== "capture" ||
      !this.current(op)
    )
      return;
    this.publish({ phase: "exporting", message: "" });
    try {
      if (!this.current(op)) return;
      const result = await delivery.deliver(document, {
        signal: op.controller.signal,
        isCurrent: () => this.current(op),
      });
      if (!this.current(op)) {
        this.reconcile();
        return;
      }
      this.clear(
        {
          written: "Draft-set file saved. Keep this plain-text file private.",
          download_requested:
            "Draft-set download requested. Check its chosen destination.",
          cancelled:
            "Draft-set file save cancelled. Your drafts are unchanged.",
        }[result],
        false,
        false,
      );
    } catch {
      if (this.current(op))
        this.clear(
          "The file could not be saved. Check your chosen destination before trying again.",
          false,
          false,
        );
      else this.reconcile();
    }
  }
  async readFile(file: Pick<File, "size" | "arrayBuffer">) {
    if (!this.state.canImport) return;
    this.clear("", false, false);
    const op = this.begin("read");
    if (!op) return;
    this.publish({ phase: "reading", message: "" });
    try {
      if (!this.current(op)) return;
      assertResearchDraftSetFileSize(file.size);
      const bytes = await file.arrayBuffer();
      if (!this.current(op)) {
        this.reconcile();
        return;
      }
      const admitted = decodeResearchDraftSetFile(bytes, file.size, op.scope);
      if (!admitted) throw new Error("file");
      this.operation = null;
      op.controller.abort();
      this.publish({
        phase: "inventory",
        file: admitted,
        comparison: null,
        message:
          "File read locally. Load each current resource, compare it, then restore only that resource explicitly.",
      });
    } catch {
      if (this.current(op))
        this.clear(
          "The complete file is invalid, oversized or belongs to another account or backend. Your drafts are unchanged.",
          false,
          false,
        );
      else this.reconcile();
    }
  }
  compareResource(resource: ResearchDraftResource) {
    const file = this.state.file,
      member = file?.members[resource];
    if (this.state.phase !== "inventory" || !file || !member) return false;
    const op = this.begin("comparison", [resource]);
    if (!op) {
      this.publish({
        message:
          "Load this resource and finish its form, save, recovery and identity review before comparing.",
      });
      return false;
    }
    const c = op.captures[0]!;
    this.publish({
      phase: "comparison",
      comparison: Object.freeze({
        resource,
        fileContent: member,
        currentContent: c.content,
        currentBase: c.baseVersion,
      }),
      message:
        "Compare the complete drafts. Restoring keeps the current online save base and changes only this resource.",
    });
    return this.current(op) && this.getSnapshot().phase === "comparison";
  }
  restoreResource() {
    const op = this.operation,
      comparison = this.state.comparison,
      file = this.state.file;
    if (!op || !comparison || !file || !this.current(op)) return false;
    const token = {};
    this.transition = token;
    this.operation = null;
    op.controller.abort();
    this.changing++;
    let committed: DraftSetResourceCommit | null;
    const ownsTransition = () =>
      this.transition === token &&
      this.operation === null &&
      this.state.file === file &&
      this.routeCurrent(op);
    try {
      this.publish({ phase: "inventory", comparison: null, message: "" });
      if (!ownsTransition() || !op.captures[0]!.isCurrent()) return false;
      committed = op.captures[0]!.restore(comparison.fileContent, op);
    } finally {
      this.changing--;
      this.release(op);
      this.reconcile();
    }
    if (!ownsTransition()) return false;
    if (!committed?.isCurrent()) {
      this.publish({
        message:
          "The current draft changed. Compare the resource again before restoring.",
      });
      return false;
    }
    this.publish({
      message: `${researchDraftResourceLabel(comparison.resource)} restored to its local draft. Review catalog identities, Review and Save this resource separately.`,
    });
    const accepted = ownsTransition() && committed.isCurrent();
    if (!accepted && ownsTransition())
      this.publish({
        message:
          "The draft changed after restoration. Compare it again before continuing.",
      });
    return accepted;
  }

  cancelComparison() {
    if (this.state.phase === "comparison")
      this.clear("Current draft kept. No resource was saved.", false, true);
  }
  closeFile() {
    this.clear(
      "Draft-set file closed. Your drafts are unchanged.",
      false,
      false,
    );
  }
  cancel() {
    if (this.state.phase === "comparison") this.cancelComparison();
    else this.closeFile();
  }
  dispose() {
    if (this.disposed) return;
    this.clear("", true, false);
    this.disposed = true;
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.listeners.clear();
    this.scope = null;
  }
}
