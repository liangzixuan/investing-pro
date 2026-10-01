import { normalizeDraft, validDraft } from "./api";
import type { TrialApi, TrialDraft, TrialEntry, TrialWatchlist } from "./api";
import { SaveCoordinator } from "./save-coordinator";
import type { SaveState } from "./save-coordinator";
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
const clone = (draft: TrialDraft): TrialDraft => ({
  selected: [...draft.selected],
  note: draft.note,
});
const empty = (): TrialDraft => ({ selected: [], note: "" });
function trialState(state: SaveState<TrialDraft>): TrialState {
  return {
    phase: state.phase,
    saved: state.saved
      ? { version: state.saved.version, ...clone(state.saved.payload) }
      : null,
    draft: state.draft ? clone(state.draft) : empty(),
    baseVersion: state.baseVersion,
    dirty: state.dirty,
    conflict: state.conflict,
    latestLoaded: state.latestLoaded,
    uncertain: state.uncertain,
    message: state.message,
    signOutFailed: state.signOutFailed,
  };
}

/** DEMO editing stays here; shared save and retirement transitions have one owner. */
export class TrialController {
  private readonly coordinator: SaveCoordinator<TrialDraft>;
  private state: TrialState;
  constructor(
    api: TrialApi,
    session: TrialSession,
    newKey: () => string = () => crypto.randomUUID(),
  ) {
    this.coordinator = new SaveCoordinator(
      {
        mode: "demo",
        empty,
        copy: clone,
        capture(draft) {
          const normalized = normalizeDraft(draft);
          return validDraft(normalized) ? clone(normalized) : null;
        },
        async load(signal) {
          const saved = await api.load(signal);
          return { version: saved.version, payload: clone(saved) };
        },
        async save(command, signal) {
          const saved = await api.save(
            {
              expectedVersion: command.expectedVersion,
              idempotencyKey: command.idempotencyKey,
              ...clone(command.payload),
            },
            signal,
          );
          return {
            version: saved.version,
            payload: clone(saved),
            replayed: saved.replayed,
          };
        },
      },
      session,
      { newKey },
    );
    this.state = trialState(this.coordinator.getSnapshot());
    this.coordinator.subscribe(() => {
      this.state = trialState(this.coordinator.getSnapshot());
    });
  }
  getSnapshot = (): TrialState => this.state;
  subscribe = (listener: () => void) => this.coordinator.subscribe(listener);
  retire(message?: string) {
    this.coordinator.retire(message);
  }
  signOut() {
    return this.coordinator.signOut();
  }
  load() {
    return this.coordinator.load();
  }
  useSaved() {
    this.coordinator.useSaved();
  }
  keepDraft() {
    this.coordinator.keepDraft();
  }
  save() {
    return this.coordinator.save();
  }
  reconcile() {
    return this.coordinator.reconcile();
  }
  setSelected(entry: TrialEntry, included: boolean) {
    if (!this.coordinator.canEdit()) return;
    const selected = (["DEMO_A", "DEMO_B"] as const).filter((item) =>
      item === entry ? included : this.state.draft.selected.includes(item),
    );
    this.coordinator.replaceDraft({
      selected,
      note: selected.includes("DEMO_A") ? this.state.draft.note : "",
    });
  }
  setNote(note: string) {
    if (
      !this.coordinator.canEdit() ||
      !this.state.draft.selected.includes("DEMO_A")
    )
      return;
    this.coordinator.replaceDraft({ ...this.state.draft, note });
  }
}
