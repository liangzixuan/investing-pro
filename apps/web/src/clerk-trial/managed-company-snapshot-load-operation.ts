import type { ManagedResearchSelection } from "./managed-research-selection";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import {
  snapshotOpeningMatches,
  snapshotSourceIdle,
  snapshotSourceRange,
  snapshotSourceRefused,
  snapshotSourceVisitMatches,
  type SnapshotLoadSource,
  type SnapshotSourceState,
} from "./managed-company-snapshot-load-sources";

type SourceChange = "accepted" | "interrupted" | "stopped" | "cancelled";
/** Ownership ends at the first observed running:false, before any replacement read. */
export class SnapshotSourceAttempt {
  phase: "opening" | "ready" | "starting" | "pending" = "opening";
  selection: ManagedResearchSelection | null;
  range: unknown;
  started = false;
  owned = false;
  finished = false;
  constructor(readonly source: SnapshotLoadSource) {
    const state = source.model.getSnapshot();
    this.selection = state.selection;
    this.range = snapshotSourceRange(state);
  }
  prepare(state: SnapshotSourceState) {
    this.selection = state.selection;
    this.range = snapshotSourceRange(state);
    this.phase = "ready";
  }
  private matches(state: SnapshotSourceState) {
    return (
      state.selection === this.selection &&
      snapshotSourceRange(state) === this.range
    );
  }
  claimStart(state: SnapshotSourceState) {
    if (this.phase !== "starting") return false;
    if (this.started) return false;
    if (!state.running) return false;
    if (!this.matches(state)) return false;
    this.started = true;
    this.owned = true;
    return true;
  }
  private lostOwnership(state: SnapshotSourceState) {
    if (this.finished) return true;
    if (this.phase === "ready") return true;
    return !this.matches(state);
  }
  private completion(state: SnapshotSourceState): SourceChange {
    if (state.running) return "accepted";
    this.owned = false;
    this.finished = true;
    if (!this.started) return "cancelled";
    return this.source.accepted() ? "accepted" : "cancelled";
  }
  change(
    selection: ManagedResearchSelection,
    state: SnapshotSourceState,
  ): SourceChange {
    if (this.phase === "opening")
      return snapshotOpeningMatches(selection, state)
        ? "accepted"
        : "interrupted";
    if (state.catalogChanged) return "stopped";
    if (this.lostOwnership(state)) {
      this.owned = false;
      return "interrupted";
    }
    if (snapshotSourceRefused(this.source, state)) return "stopped";
    return this.completion(state);
  }
  succeeded() {
    return this.finished && this.source.accepted();
  }
  cancelOwned(lastObserved: SnapshotSourceState | undefined) {
    if (!this.owned) return;
    this.owned = false;
    const state = this.source.model.getSnapshot();
    if (state !== lastObserved) return;
    if (!state.running) return;
    if (!this.matches(state)) return;
    this.source.model.cancel();
  }
}
/** Captures one visit and its exact observed model states; it makes no requests. */
export class CompanySnapshotLoadOperation {
  readonly captured: ManagedResearchSelection;
  private readonly views: Map<SnapshotLoadSource, SnapshotSourceState>;
  active: SnapshotSourceAttempt | null = null;
  attempted = false;
  private checking = false;
  constructor(
    private readonly sources: readonly SnapshotLoadSource[],
    private readonly selected: ManagedResearchSelection,
    private readonly admission: () => boolean,
  ) {
    this.captured = Object.freeze({
      ...selected,
      listing: Object.freeze({ ...selected.listing }),
    });
    this.views = new Map(
      sources.map((source) => [source, source.model.getSnapshot()]),
    );
  }
  admitted() {
    if (this.checking) return false;
    this.checking = true;
    let admitted = false;
    try {
      admitted = this.admission();
    } catch {
      /* A refused visit cannot start work. */
    }
    this.checking = false;
    if (!admitted) return false;
    return companyEvidenceSelectionMatches(this.captured, this.selected);
  }
  unchanged() {
    return this.sources.every(
      (source) => source.model.getSnapshot() === this.views.get(source),
    );
  }
  canStart() {
    return this.sources.every((source) => {
      const state = source.model.getSnapshot();
      if (!snapshotSourceIdle(state)) return false;
      return snapshotSourceVisitMatches(this.captured, state);
    });
  }
  begin(source: SnapshotLoadSource) {
    this.active = new SnapshotSourceAttempt(source);
    return this.active;
  }
  changed(source: SnapshotLoadSource): SnapshotSourceState | null {
    const state = source.model.getSnapshot();
    if (state === this.views.get(source)) return null;
    this.claimStart(source, state);
    return state;
  }
  private claimStart(source: SnapshotLoadSource, state: SnapshotSourceState) {
    if (this.active?.source !== source) return;
    if (this.active.claimStart(state)) this.views.set(source, state);
  }
  remember(source: SnapshotLoadSource, state: SnapshotSourceState) {
    this.views.set(source, state);
  }
  cancelOwned() {
    const active = this.active;
    if (active) active.cancelOwned(this.views.get(active.source));
  }
}
