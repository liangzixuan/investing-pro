import type { ManagedWorkspace } from "./managed-workspace";
import {
  parseValuationAssumptionsPayload,
  type ValuationAssumptionsPayload,
} from "@research-cockpit/contracts";
import type { ValuationCollectionDraftContext } from "./managed-valuation-assumptions";
import {
  formatManagedValuationCollectionDraftFile,
  parseManagedValuationCollectionDraftFile,
  assertValuationCollectionDraftFileSize,
  decodeValuationCollectionDraftFile,
  type ManagedValuationCollectionDraftFileContent,
} from "./managed-valuation-collection-draft-file";
import type { ManagedValuationCollectionDraftFileDeliveryAdapter } from "./valuation-collection-draft-file-delivery";

type DraftContext = {
  resource: ValuationCollectionDraftContext;
  visit: NonNullable<ReturnType<ManagedWorkspace["getSnapshot"]>["research"]>;
};
interface Operation {
  readonly kind: "export" | "read";
  readonly context: DraftContext;
  readonly scope: string;
  readonly controller: AbortController;
}
export interface ValuationCollectionRecoveryState {
  readonly phase:
    "idle" | "capture" | "reading" | "exporting" | "review" | "retired";
  readonly preview: ManagedValuationCollectionDraftFileContent | null;
  readonly currentDraft: ValuationAssumptionsPayload | null;
  readonly currentSavedVersion: number | null;
  readonly canExport: boolean;
  readonly canImport: boolean;
  readonly message: string;
}
interface Options {
  readonly workspace: ManagedWorkspace;
  readonly accountScope: Promise<string>;
  readonly delivery:
    ManagedValuationCollectionDraftFileDeliveryAdapter | undefined;
  readonly routeActive: () => boolean;
  readonly now?: () => string;
}

/** File IO only. Replacing a reviewed local draft never calls a save/load port. */
export class ManagedValuationCollectionDraftRecovery {
  private state: ValuationCollectionRecoveryState = Object.freeze({
    phase: "idle",
    preview: null,
    currentDraft: null,
    currentSavedVersion: null,
    canExport: false,
    canImport: false,
    message: "",
  });
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribers: (() => void)[];
  private scope: string | null = null;
  private operation: Operation | null = null;
  private transition = {};
  private document: ReturnType<
    typeof formatManagedValuationCollectionDraftFile
  > = null;
  private disposed = false;

  constructor(private readonly options: Options) {
    const { workspace } = options;
    this.unsubscribers = [
      workspace,
      workspace.valuationAssumptions,
      workspace.valuationAssumptions.coordinator,
      workspace.sessionOwner,
      workspace.valuation,
    ].map((resource) => resource.subscribe(this.reconcile));
    this.unsubscribers.push(
      workspace.valuation.subscribeDraftFileActivity(this.reconcile),
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
            message: "Draft files are unavailable in this session.",
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
  private context(owner?: object): DraftContext | null {
    if (!this.live() || !this.options.routeActive()) return null;
    const view = this.options.workspace.getSnapshot();
    if (!view.research || view.read || view.reviewing || view.followupOpening)
      return null;
    const resource =
      this.options.workspace.valuationAssumptions.getDraftFileContext(owner);
    return resource ? { resource, visit: view.research } : null;
  }
  private sameContext(operation: Operation) {
    const current = this.context(operation),
      before = operation.context;
    return (
      this.scope === operation.scope &&
      current !== null &&
      current.visit === before.visit &&
      (
        [
          "saved",
          "draft",
          "baseVersion",
          "save",
          "catalog",
          "editorFileRevision",
        ] as const
      ).every((key) => current.resource[key] === before.resource[key])
    );
  }
  private current(operation: Operation) {
    return (
      this.operation === operation &&
      !operation.controller.signal.aborted &&
      this.sameContext(operation)
    );
  }
  private publish(patch: Partial<ValuationCollectionRecoveryState>) {
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
    for (const listener of this.listeners) listener();
  }
  private canExport() {
    if (!this.scope) return false;
    if (!this.options.delivery) return false;
    if (this.operation) return false;
    const draft = this.context()?.resource.draft;
    return draft != null && parseValuationAssumptionsPayload(draft) !== null;
  }
  private canImport(phase: ValuationCollectionRecoveryState["phase"]) {
    if (!this.scope) return false;
    if (!this.context()) return false;
    return this.operation === null || phase === "review";
  }
  private clear(message: string, retired = false, releaseActivity = true) {
    const transition = {};
    this.transition = transition;
    const operation = this.operation;
    this.operation = null;
    this.document = null;
    operation?.controller.abort();
    try {
      this.publish({
        phase: retired ? "retired" : "idle",
        preview: null,
        currentDraft: null,
        currentSavedVersion: null,
        message,
      });
    } finally {
      if (releaseActivity && operation)
        this.options.workspace.valuationAssumptions.endCollectionFileActivity(
          operation,
        );
    }
    return transition;
  }
  reconcile = () => {
    if (!this.live()) {
      this.clear("", true);
      return;
    }
    if (this.operation && !this.current(this.operation)) {
      this.clear(
        "The draft or session changed. Select the file again to review it.",
      );
    } else this.publish({});
  };
  cancel = () => {
    this.clear("File review cancelled. Your current draft is unchanged.");
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
    this.options.workspace.valuationAssumptions.beginCollectionFileActivity(
      operation,
    );
    if (!this.current(operation)) {
      this.reconcile();
      return null;
    }
    return operation;
  }
  private finish(operation: Operation, message: string) {
    if (!this.current(operation)) {
      this.reconcile();
      return;
    }
    this.clear(message);
  }
  private captureDraftFile(operation: Operation) {
    const draft = operation.context.resource.draft;
    return formatManagedValuationCollectionDraftFile({
      accountScope: operation.scope,
      capturedAt: this.options.now?.() ?? new Date().toISOString(),
      payload: draft,
    });
  }
  captureDraft() {
    if (!this.state.canExport) return false;
    const operation = this.begin("export");
    if (!operation) return false;
    const document = this.captureDraftFile(operation);
    const preview = document
      ? parseManagedValuationCollectionDraftFile(document.text, operation.scope)
      : null;
    if (!document || !preview) {
      this.finish(
        operation,
        "The complete collection cannot fit in a file. Your draft is unchanged.",
      );
      return false;
    }
    this.document = document;
    this.publish({
      phase: "capture",
      preview,
      currentDraft: operation.context.resource.draft,
      currentSavedVersion: operation.context.resource.baseVersion,
      message:
        "Inspect the complete captured collection before saving its private file.",
    });
    return this.current(operation) && this.state.phase === "capture";
  }
  async saveFile() {
    const operation = this.operation,
      document = this.document;
    if (
      !operation ||
      !document ||
      this.state.phase !== "capture" ||
      !this.options.delivery ||
      !this.current(operation)
    )
      return;
    this.publish({ phase: "exporting", message: "" });
    try {
      if (!this.current(operation)) return;
      const result = await this.options.delivery.deliver(document, {
        signal: operation.controller.signal,
        isCurrent: () => this.current(operation),
      });
      const messages = {
        download_requested:
          "Draft file download requested. Check your chosen destination.",
        written:
          "Valuation collection file saved. Keep it private; it contains your authored assumptions.",
        cancelled: "Draft file save cancelled. Your draft is unchanged.",
      };
      this.finish(operation, messages[result]);
    } catch {
      this.finish(
        operation,
        "The draft file could not be saved. Check your chosen destination before trying again.",
      );
    }
  }
  async readFile(file: Pick<File, "size" | "arrayBuffer">) {
    if (!this.state.canImport) return;
    this.clear("");
    const operation = this.begin("read");
    if (!operation) return;
    this.publish({ phase: "reading", preview: null, message: "" });
    try {
      if (!this.current(operation)) return;
      assertValuationCollectionDraftFileSize(file.size);
      const bytes = await file.arrayBuffer();
      if (!this.current(operation)) {
        this.reconcile();
        return;
      }
      const preview = decodeValuationCollectionDraftFile(
        bytes,
        file.size,
        operation.scope,
      );
      if (!preview) throw new Error("document");
      this.reviewFile(operation, preview);
    } catch {
      this.finish(
        operation,
        "This file is invalid, too large, or belongs to another account or backend. Your draft is unchanged.",
      );
    }
  }
  private reviewFile(
    operation: Operation,
    preview: ManagedValuationCollectionDraftFileContent,
  ) {
    if (!this.current(operation)) return;
    this.publish({
      phase: "review",
      preview,
      currentDraft: operation.context.resource.draft,
      currentSavedVersion: operation.context.resource.baseVersion,
      message:
        "File loaded locally. Review the complete draft before replacing your current draft.",
    });
  }
  private reviewedFile() {
    const operation = this.operation;
    if (!operation) return null;
    if (this.state.phase !== "review") return null;
    const preview = this.state.preview;
    if (!preview) return null;
    return { operation, preview };
  }
  private restored(accepted: boolean, operation: Operation) {
    const after =
      this.options.workspace.valuationAssumptions.coordinator.getSnapshot();
    return (
      accepted &&
      after.saved === operation.context.resource.saved &&
      after.baseVersion === operation.context.resource.baseVersion &&
      after.draft !== operation.context.resource.draft
    );
  }
  private changedBeforeRestore() {
    this.publish({
      message: "The draft changed before restoration. Select the file again.",
    });
    return false;
  }
  restoreDraft() {
    const reviewed = this.reviewedFile();
    if (!reviewed) return false;
    const { operation, preview } = reviewed;
    if (!this.current(operation)) {
      this.reconcile();
      return false;
    }
    // Keep report capture paused through the complete restoration transition.
    try {
      const transition = this.clear("", false, false);
      if (this.transition !== transition) return false;
      if (this.operation) return this.changedBeforeRestore();
      if (!this.sameContext(operation)) return this.changedBeforeRestore();
      const accepted =
        this.options.workspace.valuationAssumptions.restoreFileDraft(
          operation.context.resource,
          preview.payload,
          operation,
        );
      if (!this.live()) return false;
      const restored = this.restored(accepted, operation);
      this.publish({
        message: restored
          ? "Collection restored to your local valuation draft. Review catalog identities, then Review and Save valuation inputs separately. The editor is unchanged."
          : "The draft changed before restoration. Select the file again.",
      });
      return restored;
    } finally {
      this.options.workspace.valuationAssumptions.endCollectionFileActivity(
        operation,
      );
    }
  }
  dispose() {
    this.transition = {};
    const operation = this.operation;
    operation?.controller.abort();
    this.operation = null;
    this.document = null;
    this.scope = null;
    this.disposed = true;
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.listeners.clear();
    this.state = Object.freeze({
      phase: "retired",
      preview: null,
      currentDraft: null,
      currentSavedVersion: null,
      canExport: false,
      canImport: false,
      message: "",
    });
    if (operation)
      this.options.workspace.valuationAssumptions.endCollectionFileActivity(
        operation,
      );
  }
}
