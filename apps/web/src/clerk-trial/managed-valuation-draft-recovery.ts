import type { ManagedValuationSnapshot } from "./managed-valuation-workbench";
import {
  assertValuationDraftFileSize,
  decodeValuationDraftFile,
  formatManagedValuationDraftFile,
  type ManagedValuationDraftFileContent,
} from "./managed-valuation-draft-file";
import {
  valuationDraftContext,
  sameValuationDraftContext,
  valuationDraftMatchesCompany,
  type ValuationDraftContext,
  type ValuationDraftRecoveryOptions,
} from "./managed-valuation-draft-context";

interface Operation {
  kind: "export" | "read";
  context: ValuationDraftContext;
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
  constructor(private readonly options: ValuationDraftRecoveryOptions) {
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
  private context() {
    if (!this.live()) return null;
    return valuationDraftContext(this.options);
  }
  private sameContext(operation: Operation) {
    return (
      this.scope === operation.scope &&
      sameValuationDraftContext(this.context(), operation.context)
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
    if (!this.scope) return false;
    if (!this.options.delivery) return false;
    if (this.operation) return false;
    const context = this.context();
    if (!context) return false;
    if (!context.editor.dirty) return false;
    if (context.editor.inputIssue) return false;
    return this.captureEntry(context) !== null;
  }
  private captureEntry(context: ValuationDraftContext) {
    const capture = this.options.workspace.valuation.captureInputs();
    if (!capture) return null;
    return valuationDraftMatchesCompany(capture.entry, context)
      ? capture.entry
      : null;
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
  private exportDocument(operation: Operation) {
    const entry = this.captureEntry(operation.context);
    if (!entry) return null;
    return formatManagedValuationDraftFile({
      accountScope: operation.scope,
      capturedAt: this.options.now?.() ?? new Date().toISOString(),
      entry,
    });
  }
  async exportInputs() {
    if (!this.state.canExport || !this.options.delivery) return;
    const operation = this.begin("export");
    if (!operation) return;
    const document = this.exportDocument(operation);
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
      this.reviewFile(operation, bytes, file.size);
    } catch {
      this.finish(
        operation,
        "This file is invalid, too large, or belongs to another account, backend, company or catalog. Your editor is unchanged.",
      );
    }
  }
  private reviewFile(operation: Operation, bytes: ArrayBuffer, size: number) {
    if (!this.current(operation)) {
      this.reconcile();
      return;
    }
    const preview = decodeValuationDraftFile(bytes, size, operation.scope);
    if (
      !preview ||
      !valuationDraftMatchesCompany(preview.entry, operation.context)
    )
      throw new Error("document");
    this.publish({
      phase: "review",
      preview,
      currentEditor: operation.context.editor,
      message:
        "File loaded locally. Compare both complete input maps before replacing the editor.",
    });
  }
  private reviewedOperation() {
    const operation = this.operation;
    const preview = this.state.preview;
    if (!operation) return null;
    if (this.state.phase !== "review") return null;
    if (!preview) return null;
    if (!this.current(operation)) {
      this.reconcile();
      return null;
    }
    return { operation, preview };
  }
  private unchangedTransition(transition: object) {
    return this.transition === transition && this.operation === null;
  }
  private completeRestore(transition: object, accepted: boolean) {
    if (!this.live()) return false;
    if (this.unchangedTransition(transition))
      this.publish({
        message: accepted
          ? "File inputs restored to the unsaved editor. Calculate, Stage, Review and Save remain separate."
          : "The editor changed before restoration. Select the file again.",
      });
    return accepted;
  }
  restore() {
    const reviewed = this.reviewedOperation();
    if (!reviewed) return false;
    const { operation, preview } = reviewed;
    const transition = this.clear("");
    if (!this.unchangedTransition(transition)) return false;
    if (!this.sameContext(operation)) return false;
    const accepted = this.options.workspace.valuation.restoreDraftInputs(
      preview.entry,
      operation.context.editor,
    );
    return this.completeRestore(transition, accepted);
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
