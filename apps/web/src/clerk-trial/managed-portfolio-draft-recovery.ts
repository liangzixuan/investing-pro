import type { ManagedWorkspace } from "./managed-workspace";
import type {
  PortfolioDraft,
  PortfolioDraftFileContext,
} from "./managed-portfolio";
import {
  formatManagedPortfolioDraftFile,
  assertPortfolioDraftFileSize,
  decodePortfolioDraftFile,
  type ManagedPortfolioDraftFileContent,
} from "./managed-portfolio-draft-file";
import type { ManagedPortfolioDraftFileDeliveryAdapter } from "./portfolio-draft-file-delivery";

type DraftContext = PortfolioDraftFileContext;
interface Operation {
  readonly kind: "export" | "read";
  readonly context: DraftContext;
  readonly scope: string;
  readonly controller: AbortController;
}
export interface PortfolioDraftRecoveryState {
  readonly phase: "idle" | "reading" | "exporting" | "review" | "retired";
  readonly preview: ManagedPortfolioDraftFileContent | null;
  readonly currentDraft: PortfolioDraft | null;
  readonly currentSavedVersion: number | null;
  readonly canExport: boolean;
  readonly canImport: boolean;
  readonly message: string;
}
interface Options {
  readonly workspace: ManagedWorkspace;
  readonly accountScope: Promise<string>;
  readonly delivery: ManagedPortfolioDraftFileDeliveryAdapter | undefined;
  readonly routeActive: () => boolean;
  readonly now?: () => string;
}

/** File IO only. Replacing a reviewed local draft never calls a save/load port. */
export class ManagedPortfolioDraftRecovery {
  private state: PortfolioDraftRecoveryState = Object.freeze({
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
  private disposed = false;

  constructor(private readonly options: Options) {
    const { workspace } = options;
    this.unsubscribers = [
      workspace,
      workspace.portfolio,
      workspace.portfolio.coordinator,
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
  private context(requireFresh = true): DraftContext | null {
    if (!this.live()) return null;
    if (!this.options.routeActive()) return null;
    const view = this.options.workspace.getSnapshot();
    if (view.view !== "portfolio") return null;
    if (view.research || view.companyRoute) return null;
    if (view.read) return null;
    return this.options.workspace.portfolio.getDraftFileContext(requireFresh);
  }
  private sameContext(operation: Operation) {
    const context = this.context(operation.kind === "read"),
      before = operation.context;
    return (
      this.scope === operation.scope &&
      context !== null &&
      context.saved === before.saved &&
      context.draft === before.draft &&
      context.baseVersion === before.baseVersion &&
      context.catalog === before.catalog
    );
  }
  private current(operation: Operation) {
    return (
      this.operation === operation &&
      !operation.controller.signal.aborted &&
      this.sameContext(operation)
    );
  }
  private publish(patch: Partial<PortfolioDraftRecoveryState>) {
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
    if (!this.options.workspace.portfolio.coordinator.getSnapshot().dirty)
      return false;
    return this.context(false)?.draft.ledger != null;
  }
  private canImport(phase: PortfolioDraftRecoveryState["phase"]) {
    if (!this.scope) return false;
    if (!this.context()) return false;
    return this.operation === null || phase === "review";
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
      currentDraft: null,
      currentSavedVersion: null,
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
        "The draft or session changed. Select the file again to review it.",
      );
    } else this.publish({});
  };
  cancel = () => {
    this.clear("File review cancelled. Your current draft is unchanged.");
  };
  private begin(kind: Operation["kind"]): Operation | null {
    const context = this.context(kind === "read");
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
  private captureDraftFile(operation: Operation) {
    const ledger = operation.context.draft.ledger;
    if (!ledger) return null;
    return formatManagedPortfolioDraftFile({
      accountScope: operation.scope,
      capturedAt: this.options.now?.() ?? new Date().toISOString(),
      baseVersion: operation.context.baseVersion,
      draft: ledger,
    });
  }
  async exportDraft() {
    if (!this.state.canExport || !this.options.delivery) return;
    const operation = this.begin("export");
    if (!operation) return;
    const document = this.captureDraftFile(operation);
    if (!document) {
      this.finish(
        operation,
        "This draft cannot fit in a draft file. Your draft is unchanged.",
      );
      return;
    }
    this.publish({ phase: "exporting", message: "" });
    try {
      const result = await this.options.delivery.deliver(document, {
        signal: operation.controller.signal,
        isCurrent: () => this.current(operation),
      });
      const messages = {
        download_requested:
          "Draft file download requested. Check your chosen destination.",
        written:
          "Portfolio draft file saved. Keep it private; it contains your holdings and activity.",
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
      assertPortfolioDraftFileSize(file.size);
      const bytes = await file.arrayBuffer();
      if (!this.current(operation)) {
        this.reconcile();
        return;
      }
      const preview = decodePortfolioDraftFile(
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
    preview: ManagedPortfolioDraftFileContent,
  ) {
    if (!this.current(operation)) return;
    this.publish({
      phase: "review",
      preview,
      currentDraft: operation.context.draft,
      currentSavedVersion: operation.context.baseVersion,
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
    const after = this.options.workspace.portfolio.coordinator.getSnapshot();
    return (
      accepted &&
      after.saved === operation.context.saved &&
      after.baseVersion === operation.context.baseVersion &&
      after.draft !== operation.context.draft
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
    const transition = this.clear("");
    if (this.transition !== transition) return false;
    if (this.operation) return this.changedBeforeRestore();
    if (!this.sameContext(operation)) return this.changedBeforeRestore();
    const accepted = this.options.workspace.portfolio.restoreFileDraft(
      operation.context,
      preview.draft,
    );
    if (!this.live()) return false;
    const restored = this.restored(accepted, operation);
    this.publish({
      message: restored
        ? "File restored to your local Portfolio draft. Review catalog identities, then Review portfolio and Save Portfolio to save it online."
        : "The draft changed before restoration. Select the file again.",
    });
    return restored;
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
      currentDraft: null,
      currentSavedVersion: null,
      canExport: false,
      canImport: false,
      message: "",
    });
  }
}
