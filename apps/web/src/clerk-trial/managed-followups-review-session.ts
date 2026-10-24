import {
  membershipMatchesResult,
  type ResearchFollowup,
} from "@research-cockpit/contracts";
import type {
  FollowupsReviewContext,
  ManagedResearchFollowups,
} from "./managed-research-followups";
import { isResearchFollowupDueDate } from "./managed-research-followups-date";

export const FOLLOWUPS_REVIEW_LIMIT = 5;
export interface FollowupsReviewHandle {
  readonly key: symbol;
}
export interface FollowupsReviewRow {
  readonly handle: FollowupsReviewHandle;
  readonly entry: ResearchFollowup;
}
export interface FollowupsReviewState {
  readonly entered: boolean;
  readonly phase: "choosing" | "reviewing" | "finished";
  readonly assessedOn: string | null;
  readonly available: boolean;
  readonly rows: readonly FollowupsReviewRow[];
  readonly chosen: readonly FollowupsReviewRow[];
  readonly selected: FollowupsReviewRow | null;
  readonly position: number;
  readonly reason: string | null;
}
interface EntryHandle {
  readonly handle: FollowupsReviewHandle;
  readonly original: ResearchFollowup;
}
function sameCheck(original: ResearchFollowup, entry: ResearchFollowup) {
  if (original.id !== entry.id) return false;
  if (original.check !== entry.check || original.dueOn !== entry.dueOn)
    return false;
  if (original.catalogSnapshotSha256 !== entry.catalogSnapshotSha256)
    return false;
  return membershipMatchesResult(
    { ...original.listing, note: "" },
    entry.listing,
  );
}
function due(entry: ResearchFollowup, context: FollowupsReviewContext) {
  if (entry.status !== "open") return false;
  if (entry.catalogSnapshotSha256 !== context.catalogSnapshotSha256)
    return false;
  // The store owns the valid UTC day; raw invalid due dates remain in its editor.
  if (!isResearchFollowupDueDate(entry.dueOn)) return false;
  return entry.dueOn <= context.assessedOn;
}

/** Temporary chosen order only. All source reads and authored writes stay outside. */
export class ManagedFollowupsReviewSession {
  private readonly listeners = new Set<() => void>();
  private readonly handles = new WeakMap<FollowupsReviewHandle, EntryHandle>();
  private records = new Map<string, EntryHandle>();
  private chosen: readonly FollowupsReviewHandle[] = [];
  private scope: object | null = null;
  private draft: FollowupsReviewContext["draft"] | null = null;
  private routeAvailable = false;
  private retired = false;
  private readonly unsubscribe: () => void;
  private state: FollowupsReviewState = Object.freeze({
    entered: false,
    phase: "choosing",
    assessedOn: null,
    available: false,
    rows: Object.freeze([]),
    chosen: Object.freeze([]),
    selected: null,
    position: -1,
    reason: "Choose checks for review to begin.",
  });

  constructor(private readonly model: ManagedResearchFollowups) {
    this.unsubscribe = model.subscribe(() => this.reconcile());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish(next: FollowupsReviewState) {
    this.state = Object.freeze(next);
    for (const listener of this.listeners) listener();
  }
  private clear(reason: string | null) {
    this.scope = null;
    this.draft = null;
    this.chosen = [];
    this.records.clear();
    this.publish({
      entered: false,
      phase: "choosing",
      assessedOn: null,
      available: false,
      rows: Object.freeze([]),
      chosen: Object.freeze([]),
      selected: null,
      position: -1,
      reason,
    });
  }
  enter() {
    if (this.retired || !this.routeAvailable) return false;
    if (this.state.entered && this.state.phase !== "finished") return false;
    const context = this.model.getReviewContext();
    if (!context) return false;
    this.records.clear();
    this.chosen = [];
    this.scope = context.scope;
    this.state = Object.freeze({
      ...this.state,
      entered: true,
      phase: "choosing",
      position: -1,
    });
    this.refresh(context);
    return this.state.entered;
  }
  setAvailable(available: boolean) {
    if (this.retired || available === this.routeAvailable) return;
    this.routeAvailable = available;
    if (this.state.entered) this.reconcile();
    else this.publish({ ...this.state, available: false });
  }
  private row(entry: ResearchFollowup): FollowupsReviewRow {
    let record = this.records.get(entry.id);
    if (!record || !sameCheck(record.original, entry)) {
      record = Object.freeze({
        handle: Object.freeze({ key: Symbol(entry.id) }),
        original: entry,
      });
      this.records.set(entry.id, record);
      this.handles.set(record.handle, record);
    }
    const previous = [...this.state.rows, ...this.state.chosen].find(
      (row) => row.handle === record.handle && row.entry === entry,
    );
    return previous ?? Object.freeze({ handle: record.handle, entry });
  }
  private currentChosen(context: FollowupsReviewContext) {
    const rows: FollowupsReviewRow[] = [];
    for (const handle of this.chosen) {
      const record = this.handles.get(handle);
      const entry = context.draft.entries.find(
        (entry) => entry.id === record?.original.id,
      );
      if (!record || !entry || !sameCheck(record.original, entry)) return null;
      rows.push(this.row(entry));
    }
    return Object.freeze(rows);
  }
  private refresh(context: FollowupsReviewContext) {
    const chosen = this.currentChosen(context);
    if (!chosen) {
      this.clear("A chosen check changed. Choose a new review.");
      return;
    }
    this.draft = context.draft;
    const present = new Set(context.draft.entries.map((entry) => entry.id));
    for (const id of this.records.keys()) {
      if (!present.has(id)) this.records.delete(id);
    }
    const rows = Object.freeze(
      context.draft.entries
        .filter((entry) => due(entry, context))
        .map((entry) => this.row(entry)),
    );
    this.publish({
      ...this.state,
      assessedOn: context.assessedOn,
      available: this.routeAvailable,
      rows,
      chosen,
      selected: chosen[this.state.position] ?? null,
      reason: this.routeAvailable
        ? null
        : "Review actions are paused during company navigation.",
    });
  }
  private reconcile() {
    if (!this.state.entered || this.retired) return;
    const context = this.model.getReviewContext();
    if (!context || context.scope !== this.scope) {
      this.clear("Follow-ups changed. Choose a new review.");
      return;
    }
    this.refresh(context);
  }
  private accepts(captured: FollowupsReviewState) {
    if (this.retired || !this.routeAvailable || !this.state.entered)
      return false;
    if (captured !== this.state || !captured.available) return false;
    const context = this.model.getReviewContext();
    return context?.scope === this.scope && context?.draft === this.draft;
  }
  canChoose(captured: FollowupsReviewState, handle: FollowupsReviewHandle) {
    if (!this.accepts(captured) || captured.phase !== "choosing") return false;
    if (!captured.rows.some((row) => row.handle === handle)) return false;
    return (
      this.chosen.includes(handle) ||
      this.chosen.length < FOLLOWUPS_REVIEW_LIMIT
    );
  }
  choose(captured: FollowupsReviewState, handle: FollowupsReviewHandle) {
    if (!this.canChoose(captured, handle)) return;
    this.chosen = Object.freeze(
      this.chosen.includes(handle)
        ? this.chosen.filter((chosen) => chosen !== handle)
        : [...this.chosen, handle],
    );
    this.reconcile();
  }
  canStart(captured: FollowupsReviewState) {
    if (!this.accepts(captured) || captured.phase !== "choosing") return false;
    return this.chosen.length > 0;
  }
  start(captured: FollowupsReviewState) {
    if (!this.canStart(captured)) return;
    this.publish({
      ...this.state,
      phase: "reviewing",
      position: 0,
      selected: this.state.chosen[0]!,
    });
  }
  canContinue(captured: FollowupsReviewState) {
    if (!this.accepts(captured) || captured.phase !== "reviewing") return false;
    return captured.position + 1 < this.chosen.length;
  }
  continue(captured: FollowupsReviewState) {
    if (!this.canContinue(captured)) return;
    const position = captured.position + 1;
    this.publish({
      ...this.state,
      position,
      selected: this.state.chosen[position]!,
    });
  }
  finish(captured: FollowupsReviewState) {
    if (!this.accepts(captured) || captured.phase !== "reviewing") return;
    this.chosen = [];
    this.publish({
      ...this.state,
      phase: "finished",
      chosen: Object.freeze([]),
      selected: null,
      position: -1,
    });
  }
  captureCurrent(captured: FollowupsReviewState): ResearchFollowup | null {
    if (!this.accepts(captured) || captured.phase !== "reviewing") return null;
    return captured.selected?.entry ?? null;
  }
  leave() {
    if (this.retired) return;
    this.routeAvailable = false;
    this.clear("Choose checks for review to begin.");
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.routeAvailable = false;
    this.unsubscribe();
    this.clear("This review session has ended.");
  }
}
