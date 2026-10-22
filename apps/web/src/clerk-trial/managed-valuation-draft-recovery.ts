import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedValuationSnapshot } from "./managed-valuation-workbench";
import type { ValuationAssumptionEntry } from "@research-cockpit/contracts";
import {
  assertValuationDraftFileSize,
  decodeValuationDraftFile,
  formatManagedValuationDraftFile,
  type ManagedValuationDraftFileContent,
} from "./managed-valuation-draft-file";
import type { ManagedValuationDraftFileDeliveryAdapter } from "./valuation-draft-file-delivery";

interface Options {
  workspace: ManagedWorkspace;
  accountScope: Promise<string>;
  delivery: ManagedValuationDraftFileDeliveryAdapter | undefined;
  routeActive: () => boolean;
  selection: () => ManagedResearchSelection;
  now?: () => string;
}
interface Context {
  editor: ManagedValuationSnapshot;
  visit: NonNullable<ReturnType<ManagedWorkspace["getSnapshot"]>["research"]>;
  catalog: NonNullable<ReturnType<ManagedWorkspace["getSnapshot"]>["snapshot"]>;
  assumptions: ReturnType<
    ManagedWorkspace["valuationAssumptions"]["getSnapshot"]
  >;
  save: ReturnType<
    ManagedWorkspace["valuationAssumptions"]["coordinator"]["getSnapshot"]
  >;
}
interface Operation {
  kind: "export" | "read";
  context: Context;
  scope: string;
  controller: AbortController;
}
export interface ValuationDraftRecoveryState {
  readonly phase: "idle" | "reading" | "exporting" | "review" | "retired";
  readonly preview: ManagedValuationDraftFileContent | null;
  readonly currentEditor: ManagedValuationSnapshot | null;
  readonly canExport: boolean;
  readonly canImport: boolean;
  readonly message: string;
}

function editableInputs(editor: ManagedValuationSnapshot) {
  return editor.editable && !editor.retired && editor.owner !== null;
}
function savedInputsIdle(
  save: Context["save"],
  assumptions: Context["assumptions"],
) {
  return (
    save.phase === "idle" &&
    !save.conflict &&
    !save.uncertain &&
    !save.replayPending &&
    !assumptions.reviewing &&
    !assumptions.stageReview &&
    !assumptions.restoreReview &&
    !assumptions.catalogReview
  );
}

/** File IO replaces only the reviewed editor; online staging and Save are separate. */
export class ManagedValuationDraftRecovery {
  private state: ValuationDraftRecoveryState = Object.freeze({
    phase: "idle",
    preview: null,
    currentEditor: null,
    canExport: false,
    canImport: false,
    message: "",
  });
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribers: (() => void)[];
  private scope: string | null = null;
  private operation: Operation | null = null;
  private transition = {};
  private disposed = false;
  constructor(private readonly options: Options) {
    const { workspace } = options;
    this.unsubscribers = [
      workspace,
      workspace.valuation,
      workspace.valuationAssumptions,
      workspace.valuationAssumptions.coordinator,
      workspace.sessionOwner,
    ].map((resource) => resource.subscribe(this.reconcile));
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
            message: "Valuation input files are unavailable in this session.",
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
  private currentVisit() {
    if (!this.live() || !this.options.routeActive()) return null;
    const view = this.options.workspace.getSnapshot();
    if (!view.research || view.research.selection !== this.options.selection())
      return null;
    if (!view.snapshot || view.read || view.reviewing) return null;
    if (
      view.snapshot.snapshotSha256 !==
      view.research.selection.catalogSnapshotSha256
    )
      return null;
    return { visit: view.research, catalog: view.snapshot };
  }
  private context(): Context | null {
    const visit = this.currentVisit();
    if (!visit) return null;
    const workspace = this.options.workspace;
    const editor = workspace.valuation.getSnapshot();
    if (!editableInputs(editor)) return null;
    const assumptions = workspace.valuationAssumptions.getSnapshot();
    const save = workspace.valuationAssumptions.coordinator.getSnapshot();
    if (!savedInputsIdle(save, assumptions)) return null;
    return { ...visit, editor, assumptions, save };
  }
  private sameContext(operation: Operation) {
    const context = this.context(),
      before = operation.context;
    return (
      this.scope === operation.scope &&
      context !== null &&
      context.editor === before.editor &&
      context.visit === before.visit &&
      context.catalog === before.catalog &&
      context.assumptions === before.assumptions &&
      context.save === before.save
    );
  }
  private current(operation: Operation) {
    return (
      this.operation === operation &&
      !operation.controller.signal.aborted &&
      this.sameContext(operation)
    );
  }
  private canExport() {
    if (!this.scope || !this.options.delivery || this.operation) return false;
    const context = this.context();
    if (!context?.editor.dirty || context.editor.inputIssue) return false;
    const capture = this.options.workspace.valuation.captureInputs();
    return capture !== null && this.matchesCompany(capture.entry, context);
  }
  private canImport(phase: ValuationDraftRecoveryState["phase"]) {
    return (
      this.scope !== null &&
      this.context() !== null &&
      (this.operation === null || phase === "review")
    );
  }
  private publish(patch: Partial<ValuationDraftRecoveryState>) {
    if (this.disposed) return;
    const phase = patch.phase ?? this.state.phase;
    const next = Object.freeze({
      ...this.state,
      ...patch,
      canExport: this.canExport(),
      canImport: this.canImport(phase),
    });
    if (
      Object.keys(next).every(
        (key) =>
          next[key as keyof typeof next] ===
          this.state[key as keyof typeof next],
      )
    )
      return;
    this.state = next;
    for (const listener of [...this.listeners]) listener();
  }
  private clear(message: string, retired = false) {
    const transition = {};
    this.transition = transition;
    const operation = this.operation;
    this.operation = null;
    operation?.controller.abort();
    this.publish({
      phase: retired ? "retired" : "idle",
      preview: null,
      currentEditor: null,
      message,
    });
    return transition;
  }
  reconcile = () => {
    if (!this.live()) {
      this.clear("", true);
      return;
    }
    if (this.operation && !this.current(this.operation)) {
      this.clear(
        "The editor, company or session changed. Select the file again to review it.",
      );
    } else this.publish({});
  };
  cancel = () => {
    this.clear("File review cancelled. Your current inputs are unchanged.");
  };
  private begin(kind: Operation["kind"]): Operation | null {
    const context = this.context();
    if (!context || !this.scope || this.operation) return null;
    const operation = {
      kind,
      context,
      scope: this.scope,
      controller: new AbortController(),
    };
    this.operation = operation;
    return operation;
  }
  private finish(operation: Operation, message: string) {
    if (!this.current(operation)) {
      this.reconcile();
      return;
    }
    this.clear(message);
  }
  async exportInputs() {
    if (!this.state.canExport || !this.options.delivery) return;
    const operation = this.begin("export");
    if (!operation) return;
    const capture = this.options.workspace.valuation.captureInputs();
    const document =
      capture &&
      this.matchesCompany(capture.entry, operation.context) &&
      formatManagedValuationDraftFile({
        accountScope: operation.scope,
        capturedAt: this.options.now?.() ?? new Date().toISOString(),
        entry: capture.entry,
      });
    if (!document) {
      this.finish(
        operation,
        "These inputs cannot fit in an input file. Your editor is unchanged.",
      );
      return;
    }
    this.publish({ phase: "exporting", message: "" });
    try {
      if (!this.current(operation)) return;
      const result = await this.options.delivery.deliver(document, {
        signal: operation.controller.signal,
        isCurrent: () => this.current(operation),
      });
      const messages = {
        download_requested:
          "Valuation input file download requested. Check your chosen destination.",
        written:
          "Valuation input file saved. Keep it private; it contains your authored assumptions.",
        cancelled: "Input file save cancelled. Your editor is unchanged.",
      };
      this.finish(operation, messages[result]);
    } catch {
      this.finish(
        operation,
        "The input file could not be saved. Check your chosen destination before trying again.",
      );
    }
  }
  private matchesCompany(entry: ValuationAssumptionEntry, context: Context) {
    const selected = context.visit.selection;
    return (
      entry.catalogSnapshotSha256 === selected.catalogSnapshotSha256 &&
      entry.cik === selected.cik &&
      Object.keys(selected.listing).every(
        (key) =>
          entry.listing[key as keyof typeof entry.listing] ===
          selected.listing[key as keyof typeof selected.listing],
      )
    );
  }
  async readFile(file: Pick<File, "size" | "arrayBuffer">) {
    if (!this.state.canImport) return;
    const transition = this.clear("");
    if (this.transition !== transition || this.operation) return;
    const operation = this.begin("read");
    if (!operation) return;
    this.publish({ phase: "reading", preview: null, message: "" });
    try {
      if (!this.current(operation)) return;
      assertValuationDraftFileSize(file.size);
      const bytes = await file.arrayBuffer();
      if (!this.current(operation)) {
        this.reconcile();
        return;
      }
      const preview = decodeValuationDraftFile(
        bytes,
        file.size,
        operation.scope,
      );
      if (!preview || !this.matchesCompany(preview.entry, operation.context))
        throw new Error("document");
      this.publish({
        phase: "review",
        preview,
        currentEditor: operation.context.editor,
        message:
          "File loaded locally. Compare both complete input maps before replacing the editor.",
      });
    } catch {
      this.finish(
        operation,
        "This file is invalid, too large, or belongs to another account, backend, company or catalog. Your editor is unchanged.",
      );
    }
  }
  restore() {
    const operation = this.operation,
      preview = this.state.preview;
    if (!operation || this.state.phase !== "review" || !preview) return false;
    if (!this.current(operation)) {
      this.reconcile();
      return false;
    }
    const transition = this.clear("");
    if (
      this.transition !== transition ||
      this.operation ||
      !this.sameContext(operation)
    )
      return false;
    const accepted = this.options.workspace.valuation.restoreDraftInputs(
      preview.entry,
      operation.context.editor,
    );
    if (!this.live()) return false;
    if (this.transition === transition && !this.operation)
      this.publish({
        message: accepted
          ? "File inputs restored to the unsaved editor. Calculate, Stage, Review and Save remain separate."
          : "The editor changed before restoration. Select the file again.",
      });
    return accepted;
  }
  dispose() {
    this.transition = {};
    this.operation?.controller.abort();
    this.operation = null;
    this.scope = null;
    this.disposed = true;
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.listeners.clear();
    this.state = Object.freeze({
      phase: "retired",
      preview: null,
      currentEditor: null,
      canExport: false,
      canImport: false,
      message: "",
    });
  }
}
