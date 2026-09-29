import { normalizeDraft, TrialApiError, validDraft } from "./api";
import type {
  TrialApi,
  TrialCommand,
  TrialDraft,
  TrialEntry,
  TrialWatchlist,
} from "./api";
import type { TrialSession } from "./session";

export interface TrialState {
  phase:
    "idle" | "loading" | "saving" | "reconciling" | "signing_out" | "retired";
  saved: TrialWatchlist | null;
  draft: TrialDraft;
  baseVersion: number | null;
  dirty: boolean;
  conflict: boolean;
  latestLoaded: boolean;
  uncertain: boolean;
  message: string;
  signOutFailed: boolean;
}
const empty = (): TrialState => ({
  phase: "idle",
  saved: null,
  draft: { selected: [], note: "" },
  baseVersion: null,
  dirty: false,
  conflict: false,
  latestLoaded: false,
  uncertain: false,
  message: "Load the shared trial watchlist to begin.",
  signOutFailed: false,
});
const clone = (value: TrialDraft): TrialDraft => ({
  selected: [...value.selected],
  note: value.note,
});

export class TrialController {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private closed = false;
  private operation: AbortController | null = null;
  private pending: TrialCommand | null = null;
  constructor(
    private readonly api: TrialApi,
    private readonly session: TrialSession,
    private readonly newKey: () => string = () => crypto.randomUUID(),
  ) {}
  getSnapshot = (): TrialState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<TrialState>) {
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
  retire(
    message = "This session has ended. Its local trial data has been cleared.",
  ) {
    this.closed = true;
    this.operation?.abort();
    this.operation = null;
    this.pending = null;
    this.state = { ...empty(), phase: "retired", message };
    for (const listener of this.listeners) listener();
  }
  async signOut() {
    if (this.state.phase === "signing_out") return;
    this.retire();
    this.update({ phase: "signing_out", message: "Signing out this session…" });
    try {
      await this.session.signOut();
      this.update({
        phase: "retired",
        message: "Signed out. Local trial data has been cleared.",
      });
    } catch {
      this.update({
        phase: "retired",
        signOutFailed: true,
        message:
          "Local trial data has been cleared, but sign-out could not be confirmed. Try signing out again.",
      });
    }
  }
  setSelected(entry: TrialEntry, included: boolean) {
    if (!this.available() || this.pending) return;
    const selected = (["DEMO_A", "DEMO_B"] as const).filter((item) =>
      item === entry ? included : this.state.draft.selected.includes(item),
    );
    this.update({
      draft: {
        selected,
        note: selected.includes("DEMO_A") ? this.state.draft.note : "",
      },
      dirty: true,
    });
  }
  setNote(note: string) {
    if (
      !this.available() ||
      this.pending ||
      !this.state.draft.selected.includes("DEMO_A")
    )
      return;
    this.update({ draft: { ...this.state.draft, note }, dirty: true });
  }
  async load() {
    if (!this.available() || this.pending) return;
    const operation = new AbortController();
    this.operation = operation;
    this.update({ phase: "loading", message: "Loading the saved version…" });
    try {
      const saved = await this.api.load(operation.signal);
      if (!this.active(operation)) return;
      const keep = this.state.dirty || this.state.conflict;
      this.update({
        saved,
        latestLoaded: true,
        ...(keep ? {} : { draft: clone(saved), baseVersion: saved.version }),
        message: keep
          ? "Saved version loaded. Your draft is unchanged. Choose which version to use before saving."
          : `Loaded version ${saved.version}.`,
        conflict: keep,
      });
    } catch (error) {
      if (!this.active(operation)) return;
      this.readError(error);
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        if (!this.closed) this.update({ phase: "idle" });
      }
    }
  }
  useSaved() {
    if (!this.available() || this.pending || !this.state.saved) return;
    this.update({
      draft: clone(this.state.saved),
      baseVersion: this.state.saved.version,
      conflict: false,
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
      message: `Draft kept. Saving will replace version ${this.state.saved.version}.`,
    });
  }
  async save() {
    if (
      !this.available() ||
      this.pending ||
      this.state.baseVersion === null ||
      this.state.conflict ||
      !this.state.dirty
    )
      return;
    const draft = normalizeDraft(this.state.draft);
    if (!validDraft(draft)) {
      this.update({
        message:
          "Use at most 1,000 characters without control characters in the note.",
      });
      return;
    }
    this.pending = {
      ...clone(draft),
      expectedVersion: this.state.baseVersion,
      idempotencyKey: this.newKey(),
    };
    this.update({ draft });
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
      const saved = await this.api.save(
        { ...command, selected: [...command.selected] },
        operation.signal,
      );
      if (!this.active(operation)) return;
      this.pending = null;
      this.update({
        saved,
        draft: clone(saved),
        baseVersion: saved.version,
        dirty: false,
        uncertain: false,
        conflict: false,
        latestLoaded: false,
        message: `Save confirmed at version ${saved.version}${saved.replayed ? " from the original command" : ""}. Load again to check the latest shared version.`,
      });
    } catch (error) {
      if (!this.active(operation)) return;
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
            "The save was rejected. Review the trial entries and note before saving again.",
        });
      } else {
        this.update({
          uncertain: true,
          message:
            "The save result is uncertain. Keep this screen open and reconcile the original save before editing again.",
        });
      }
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        if (!this.closed) this.update({ phase: "idle" });
      }
    }
  }
  private readError(error: unknown) {
    const code = error instanceof TrialApiError ? error.code : "unavailable";
    if (code === "unauthenticated")
      this.retire(
        "Your session is no longer accepted. Sign out and sign in again.",
      );
    else if (code === "access_denied" || code === "origin_denied")
      this.retire(
        "This session cannot access the isolated trial. No trial data is available.",
      );
    else
      this.update({
        message:
          "The saved watchlist could not be loaded. Your draft is unchanged; try loading again.",
      });
  }
}
