import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import { validateApiOrigin } from "./api";
import type { ManagedWorkspace } from "./managed-workspace";
import type { VersionedPayload } from "./save-coordinator";
import {
  formatManagedWatchlistDraftFile,
  MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES,
  parseManagedWatchlistDraftFile,
  type ManagedWatchlistDraftFileContent,
} from "./managed-watchlist-draft-file";
import type { ManagedWatchlistDraftFileDeliveryAdapter } from "./managed-watchlist-draft-file-delivery";

/** A file scope joins the configured backend and verified account, never a token/session. */
export async function createManagedWatchlistDraftAccountScope(
  apiOrigin: string,
  userId: string,
) {
  const origin = validateApiOrigin(apiOrigin);
  if (origin.length > 2048 || !userId || userId.length > 512)
    throw new Error("Draft file account scope unavailable.");
  const bytes = new TextEncoder().encode(
    JSON.stringify(["investment-watchlist-draft-scope-v1", origin, userId]),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return (
    "sha256:" +
    Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("")
  );
}

interface DraftContext {
  saved: VersionedPayload<MainWatchlistPayload>;
  draft: MainWatchlistPayload;
  baseVersion: number;
  catalog: ReturnType<ManagedWorkspace["getSnapshot"]>["snapshot"];
}
interface Operation {
  readonly kind: "export" | "read";
  readonly context: DraftContext;
  readonly scope: string;
  readonly controller: AbortController;
}
export interface WatchlistDraftRecoveryState {
  readonly phase: "idle" | "reading" | "exporting" | "review" | "retired";
  readonly preview: ManagedWatchlistDraftFileContent | null;
  readonly currentDraft: MainWatchlistPayload | null;
  readonly currentSavedVersion: number | null;
  readonly canExport: boolean;
  readonly canImport: boolean;
  readonly message: string;
}
interface Options {
  readonly workspace: ManagedWorkspace;
  readonly accountScope: Promise<string>;
  readonly delivery: ManagedWatchlistDraftFileDeliveryAdapter | undefined;
  readonly routeActive: () => boolean;
  readonly now?: () => string;
}

/** File IO only. Replacing a reviewed local draft never calls a save/load port. */
export class ManagedWatchlistDraftRecovery {
  private state: WatchlistDraftRecoveryState = Object.freeze({
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
  private disposed = false;

  constructor(private readonly options: Options) {
    const { workspace } = options;
    this.unsubscribers = [
      workspace,
      workspace.coordinator,
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
    const { workspace, routeActive } = this.options;
    const saved = workspace.coordinator.getSnapshot(),
      view = workspace.getSnapshot();
    if (!this.live() || !routeActive() || !workspace.canEdit()) return null;
    if (
      saved.phase !== "idle" ||
      !saved.saved ||
      !saved.draft ||
      saved.baseVersion === null
    )
      return null;
    if (saved.conflict || saved.uncertain || saved.replayPending) return null;
    if (
      requireFresh &&
      (!saved.latestLoaded || saved.baseVersion !== saved.saved.version)
    )
      return null;
    if (view.view !== "watchlist" || view.research || view.companyRoute)
      return null;
    if (view.read || view.review || view.reviewing) return null;
    return {
      saved: saved.saved,
      draft: saved.draft,
      baseVersion: saved.baseVersion,
      catalog: view.snapshot,
    };
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
  private publish(patch: Partial<WatchlistDraftRecoveryState>) {
    if (this.disposed) return;
    const context = this.context(),
      exportContext = this.context(false),
      busy = this.operation !== null;
    const phase = patch.phase ?? this.state.phase;
    const next = Object.freeze({
      ...this.state,
      ...patch,
      canExport:
        !!exportContext &&
        !!this.scope &&
        !!this.options.delivery &&
        !busy &&
        this.options.workspace.coordinator.getSnapshot().dirty,
      canImport:
        !!context &&
        !!this.scope &&
        (this.operation === null || phase === "review"),
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
  private clear(message: string, retired = false) {
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
  cancel = () =>
    this.clear("File review cancelled. Your current draft is unchanged.");
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
  async exportDraft() {
    if (!this.state.canExport || !this.options.delivery) return;
    const operation = this.begin("export");
    if (!operation) return;
    const document = formatManagedWatchlistDraftFile({
      accountScope: operation.scope,
      capturedAt: this.options.now?.() ?? new Date().toISOString(),
      baseVersion: operation.context.baseVersion,
      draft: operation.context.draft,
    });
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
          "Draft file saved. Keep it private; it contains unconfirmed notes.",
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
      if (
        !Number.isSafeInteger(file.size) ||
        file.size <= 0 ||
        file.size > MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES
      )
        throw new Error("size");
      const bytes = await file.arrayBuffer();
      if (!this.current(operation)) {
        this.reconcile();
        return;
      }
      if (
        bytes.byteLength !== file.size ||
        bytes.byteLength > MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES
      )
        throw new Error("size");
      const text = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes);
      const preview = parseManagedWatchlistDraftFile(text, operation.scope);
      if (!preview) throw new Error("document");
      if (this.current(operation))
        this.publish({
          phase: "review",
          preview,
          currentDraft: operation.context.draft,
          currentSavedVersion: operation.context.baseVersion,
          message:
            "File loaded locally. Review the complete draft before replacing your current draft.",
        });
    } catch {
      this.finish(
        operation,
        "This file is invalid, too large, or belongs to another account or backend. Your draft is unchanged.",
      );
    }
  }
  restoreDraft() {
    const operation = this.operation,
      preview = this.state.preview;
    if (!operation || !preview || this.state.phase !== "review") return false;
    if (!this.current(operation)) {
      this.reconcile();
      return false;
    }
    this.clear("");
    if (this.operation || !this.sameContext(operation)) {
      this.publish({
        message: "The draft changed before restoration. Select the file again.",
      });
      return false;
    }
    const accepted = this.options.workspace.restoreWatchlistFileDraft(
      preview.draft,
    );
    if (!this.live()) return false;
    const after = this.options.workspace.coordinator.getSnapshot();
    const restored =
      accepted &&
      after.saved === operation.context.saved &&
      after.draft !== operation.context.draft &&
      after.dirty;
    this.publish({
      message: restored
        ? "File restored to your local draft. Review catalog changes, then Review and Save watchlist to save it online."
        : "The draft changed before restoration. Select the file again.",
    });
    return restored;
  }
  dispose() {
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
