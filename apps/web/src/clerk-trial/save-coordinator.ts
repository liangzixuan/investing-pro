import { TrialApiError } from "./api";
import type { TrialSession } from "./session";

export interface VersionedPayload<P> {
  readonly version: number;
  readonly payload: P;
}
export interface SaveCommand<P> {
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly payload: P;
}
export interface SavedPayload<P> extends VersionedPayload<P> {
  readonly replayed: boolean;
}
/** The two adapters own payload editing, normalization and wire validation. */
export interface SavePort<P> {
  readonly mode: "demo" | "managed";
  empty(): P | null;
  copy(payload: P): P;
  capture(payload: P): P | null;
  load(signal: AbortSignal): Promise<VersionedPayload<P>>;
  save(command: SaveCommand<P>, signal: AbortSignal): Promise<SavedPayload<P>>;
}
export interface SaveState<P> {
  readonly phase:
    "idle" | "loading" | "saving" | "reconciling" | "signing_out" | "retired";
  readonly saved: VersionedPayload<P> | null;
  readonly draft: P | null;
  readonly baseVersion: number | null;
  readonly dirty: boolean;
  readonly conflict: boolean;
  readonly latestLoaded: boolean;
  readonly uncertain: boolean;
  readonly replayPending: boolean;
  readonly message: string;
  readonly signOutFailed: boolean;
}

export class SaveCoordinator<P> {
  private state: SaveState<P>;
  private readonly listeners = new Set<() => void>();
  private closed = false;
  private generation = 0;
  private operation: AbortController | null = null;
  private pending: SaveCommand<P> | null = null;
  private readonly newKey: () => string;
  private readonly onRetire: (() => void) | undefined;

  constructor(
    private readonly port: SavePort<P>,
    private readonly session: TrialSession,
    options: { newKey?: () => string; onRetire?: () => void } = {},
  ) {
    this.newKey = options.newKey ?? (() => crypto.randomUUID());
    this.onRetire = options.onRetire;
    this.state = this.empty();
  }

  private empty(): SaveState<P> {
    return {
      phase: "idle",
      saved: null,
      draft: this.port.empty(),
      baseVersion: null,
      dirty: false,
      conflict: false,
      latestLoaded: false,
      uncertain: false,
      replayPending: false,
      message:
        this.port.mode === "demo"
          ? "Load the shared trial watchlist to begin."
          : "Load your shared watchlist to begin.",
      signOutFailed: false,
    };
  }
  getSnapshot = (): SaveState<P> => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<SaveState<P>>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }
  private available() {
    return !this.closed && this.operation === null;
  }
  private active(operation: AbortController) {
    return (
      !this.closed && this.operation === operation && !operation.signal.aborted
    );
  }
  canEdit() {
    return this.available() && !this.pending && !this.state.replayPending;
  }
  replaceDraft(payload: P) {
    if (!this.canEdit()) return;
    this.update({ draft: this.port.copy(payload), dirty: true });
  }
  retire(message?: string) {
    this.generation++;
    this.closed = true;
    this.operation?.abort();
    this.operation = null;
    this.pending = null;
    this.state = {
      ...this.empty(),
      phase: "retired",
      message:
        message ??
        (this.port.mode === "demo"
          ? "This session has ended. Its local trial data has been cleared."
          : "This session has ended. Its local watchlist data has been cleared."),
    };
    try {
      this.onRetire?.();
    } finally {
      for (const listener of this.listeners) listener();
    }
  }
  async signOut() {
    if (this.state.phase === "signing_out") return;
    this.retire();
    const generation = this.generation;
    this.update({ phase: "signing_out", message: "Signing out this session…" });
    try {
      await this.session.signOut();
      if (generation !== this.generation) return;
      this.update({
        phase: "retired",
        message:
          this.port.mode === "demo"
            ? "Signed out. Local trial data has been cleared."
            : "Signed out. Local watchlist data has been cleared.",
      });
    } catch {
      if (generation !== this.generation) return;
      this.update({
        phase: "retired",
        signOutFailed: true,
        message:
          this.port.mode === "demo"
            ? "Local trial data has been cleared, but sign-out could not be confirmed. Try signing out again."
            : "Local watchlist data has been cleared, but sign-out could not be confirmed. Try signing out again.",
      });
    }
  }
  async load() {
    if (!this.available() || this.pending) return;
    const operation = new AbortController();
    this.operation = operation;
    this.update({
      phase: "loading",
      latestLoaded: false,
      message: "Loading the saved version…",
    });
    try {
      const result = await this.port.load(operation.signal);
      if (!this.active(operation)) return;
      const saved = {
        version: result.version,
        payload: this.port.copy(result.payload),
      };
      const keep =
        this.state.dirty || this.state.conflict || this.state.replayPending;
      this.update({
        saved,
        latestLoaded: true,
        ...(keep
          ? {}
          : {
              draft: this.port.copy(saved.payload),
              baseVersion: saved.version,
            }),
        message: keep
          ? "Saved version loaded. Your draft is unchanged. Choose which version to use before saving."
          : `Loaded version ${saved.version}.`,
        conflict: keep,
      });
    } catch (error) {
      if (this.active(operation)) this.readError(error);
    } finally {
      this.finish(operation);
    }
  }
  useSaved() {
    if (!this.available() || this.pending || !this.state.saved) return;
    if (
      this.port.mode === "managed" &&
      this.state.conflict &&
      !this.state.latestLoaded
    )
      return;
    this.update({
      draft: this.port.copy(this.state.saved.payload),
      baseVersion: this.state.saved.version,
      conflict: false,
      replayPending: false,
      dirty: false,
      message: "Using the saved version.",
    });
  }
  keepDraft() {
    if (
      !this.available() ||
      this.pending ||
      !this.state.saved ||
      !this.state.latestLoaded
    )
      return;
    this.update({
      baseVersion: this.state.saved.version,
      conflict: false,
      replayPending: false,
      dirty: this.port.mode === "managed" ? true : this.state.dirty,
      message: `Draft kept. Saving will replace version ${this.state.saved.version}.`,
    });
  }
  async save() {
    if (
      !this.canEdit() ||
      this.state.baseVersion === null ||
      this.state.conflict ||
      !this.state.dirty ||
      this.state.draft === null
    )
      return;
    const draft = this.port.capture(this.state.draft);
    if (draft === null) {
      this.update({
        message:
          this.port.mode === "demo"
            ? "Use at most 1,000 characters without control characters in the note."
            : "Review the watchlist entries and notes, and keep the watchlist within its size limit.",
      });
      return;
    }
    this.pending = {
      payload: this.port.copy(draft),
      expectedVersion: this.state.baseVersion,
      idempotencyKey: this.newKey(),
    };
    this.update({ draft: this.port.copy(draft) });
    await this.submit(false);
  }
  async reconcile() {
    if (!this.available() || !this.pending || !this.state.uncertain) return;
    await this.submit(true);
  }
  private async submit(reconciling: boolean) {
    const command = this.pending;
    if (!command) return;
    const operation = new AbortController();
    this.operation = operation;
    this.update({
      phase: reconciling ? "reconciling" : "saving",
      message: reconciling ? "Reconciling the original save…" : "Saving…",
    });
    try {
      const result = await this.port.save(
        { ...command, payload: this.port.copy(command.payload) },
        operation.signal,
      );
      if (!this.active(operation)) return;
      const saved = {
        version: result.version,
        payload: this.port.copy(result.payload),
      };
      const replayPending = this.port.mode === "managed" && result.replayed;
      this.pending = null;
      this.update({
        saved,
        draft: this.port.copy(saved.payload),
        baseVersion: saved.version,
        dirty: false,
        uncertain: false,
        conflict: replayPending,
        replayPending,
        latestLoaded: false,
        message: `Save confirmed at version ${saved.version}${result.replayed ? " from the original command" : ""}. Load again to check the latest shared version.`,
      });
    } catch (error) {
      if (this.active(operation)) this.saveError(error);
    } finally {
      this.finish(operation);
    }
  }
  private saveError(error: unknown) {
    const code = error instanceof TrialApiError ? error.code : "unavailable";
    if (
      code === "unauthenticated" ||
      code === "access_denied" ||
      code === "origin_denied"
    ) {
      this.readError(error);
    } else if (code === "conflict" || code === "idempotency_conflict") {
      this.pending = null;
      this.update({
        conflict: true,
        uncertain: false,
        latestLoaded: false,
        message:
          "The saved version changed or this command conflicts. Your draft is intact. Load the latest version to review it.",
      });
    } else if (
      code === "invalid_request" ||
      code === "payload_too_large" ||
      code === "unsupported_media_type"
    ) {
      this.pending = null;
      this.update({
        uncertain: false,
        message:
          this.port.mode === "demo"
            ? "The save was rejected. Review the trial entries and note before saving again."
            : "The save was rejected. Review the watchlist entries and notes before saving again.",
      });
    } else {
      this.update({
        uncertain: true,
        message:
          "The save result is uncertain. Keep this screen open and reconcile the original save before editing again.",
      });
    }
  }
  private finish(operation: AbortController) {
    if (this.operation !== operation) return;
    this.operation = null;
    if (!this.closed) this.update({ phase: "idle" });
  }
  readError(error: unknown) {
    if (this.closed) return;
    const code = error instanceof TrialApiError ? error.code : "unavailable";
    if (code === "unauthenticated") {
      this.retire(
        "Your session is no longer accepted. Sign out and sign in again.",
      );
    } else if (code === "access_denied" || code === "origin_denied") {
      this.retire(
        this.port.mode === "demo"
          ? "This session cannot access the isolated trial. No trial data is available."
          : "This session cannot access the shared watchlist. Its local data has been cleared.",
      );
    } else {
      this.update({
        message:
          "The saved watchlist could not be loaded. Your draft is unchanged; try loading again.",
      });
    }
  }
}
