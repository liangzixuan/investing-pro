import type { ManagedAnnualReport } from "./managed-annual-report";
import type { ManagedCompanyFilings } from "./managed-company-filings";
import type { ManagedEodHistory } from "./managed-eod-history";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";

export type CompanySnapshotLoadSource = "eod" | "annual" | "filings";
export interface ManagedCompanySnapshotLoadState {
  readonly running: boolean;
  readonly active: CompanySnapshotLoadSource | null;
  readonly message: string;
}
interface SourceState {
  readonly selection: ManagedResearchSelection | null;
  readonly response: unknown;
  readonly running: boolean;
  readonly catalogChanged: boolean;
  readonly error: boolean;
  readonly showingPrevious: boolean;
  readonly message: string;
}
interface SourceModel {
  readonly getSnapshot: () => SourceState;
  readonly subscribe: (listener: () => void) => () => void;
  open(selection: ManagedResearchSelection): void;
  load(): Promise<void>;
  cancel(): void;
}
interface Source {
  readonly name: CompanySnapshotLoadSource;
  readonly label: string;
  readonly model: SourceModel;
  readonly covered: (selection: ManagedResearchSelection) => boolean;
  readonly accepted: () => boolean;
}
interface Active {
  readonly source: Source;
  phase: "opening" | "ready" | "starting" | "pending";
  selection: ManagedResearchSelection | null;
  range: unknown;
  started: boolean;
  owned: boolean;
  finished: boolean;
}
interface Operation {
  readonly selected: ManagedResearchSelection;
  readonly captured: ManagedResearchSelection;
  readonly admitted: () => boolean;
  readonly views: Map<Source, SourceState>;
  active: Active | null;
  checking: boolean;
  attempted: boolean;
}
const idle = (): ManagedCompanySnapshotLoadState =>
  Object.freeze({ running: false, active: null, message: "" });
const range = (state: SourceState) =>
  "selectedRange" in state ? state.selectedRange : null;
const checkingSeed = (state: SourceState) =>
  "checkingSeed" in state && state.checkingSeed === true;
const fresh = (state: SourceState) =>
  state.response !== null && !state.error && !state.showingPrevious;

/** One explicit sequential pass through eligible missing company sources. */
export class ManagedCompanySnapshotLoad {
  private state = idle();
  private readonly listeners = new Set<() => void>();
  private operation: Operation | null = null;
  private revision = 0;
  private readonly sources: readonly Source[];

  constructor(
    price: ManagedEodHistory,
    annual: ManagedAnnualReport,
    filings: ManagedCompanyFilings,
  ) {
    this.sources = [
      {
        name: "eod",
        label: "Price",
        model: price,
        covered: (selection) => price.hasPriceCoverage(selection.listing),
        accepted: () => {
          const state = price.getSnapshot();
          return fresh(state) && state.response?.range === state.selectedRange;
        },
      },
      {
        name: "annual",
        label: "Annual",
        model: annual,
        covered: (selection) => annual.hasCoverage(selection),
        accepted: () => {
          const state = annual.getSnapshot();
          const evidence = state.response?.evidence;
          return (
            fresh(state) &&
            state.view !== null &&
            !state.checkingSeed &&
            evidence?.target.status === "target" &&
            evidence.generation.sources.companyFacts.status === "available" &&
            evidence.generation.sources.submissions.status === "available"
          );
        },
      },
      {
        name: "filings",
        label: "Filings",
        model: filings,
        covered: (selection) => filings.hasCoverage(selection),
        accepted: () => {
          const state = filings.getSnapshot();
          return fresh(state) && state.response?.issuer.status === "available";
        },
      },
    ];
    for (const source of this.sources)
      source.model.subscribe(() => this.observed(source));
  }
  getSnapshot = (): ManagedCompanySnapshotLoadState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private notify(next: ManagedCompanySnapshotLoadState, operation?: Operation) {
    if (operation && !this.current(operation)) return false;
    const revision = this.revision;
    this.state = Object.freeze(next);
    for (const listener of this.listeners) {
      if (revision !== this.revision) return false;
      if (operation && !this.current(operation)) return false;
      listener();
    }
    return operation === undefined || this.current(operation);
  }
  private current(operation: Operation): boolean {
    if (this.operation !== operation || operation.checking) return false;
    operation.checking = true;
    let admitted = false;
    try {
      admitted = operation.admitted();
    } catch {
      /* A refused visit cannot start work. */
    }
    operation.checking = false;
    return (
      this.operation === operation &&
      admitted &&
      companyEvidenceSelectionMatches(operation.captured, operation.selected)
    );
  }
  private unchanged(operation: Operation) {
    return this.sources.every(
      (source) => source.model.getSnapshot() === operation.views.get(source),
    );
  }
  private preflight(operation: Operation) {
    return this.sources.every((source) => {
      const state = source.model.getSnapshot();
      if (state.running || checkingSeed(state) || state.catalogChanged)
        return false;
      return (
        state.selection === null ||
        companyEvidenceSelectionMatches(operation.captured, state.selection)
      );
    });
  }
  private stop(message: string, cancelOwned = true) {
    const operation = this.operation;
    const revision = ++this.revision;
    this.operation = null;
    const active = operation?.active;
    if (cancelOwned && active?.owned) {
      active.owned = false;
      const state = active.source.model.getSnapshot();
      if (
        state === operation?.views.get(active.source) &&
        state.running &&
        state.selection === active.selection &&
        range(state) === active.range
      )
        active.source.model.cancel();
    }
    if (revision === this.revision)
      this.notify({ running: false, active: null, message });
  }
  cancel() {
    if (this.operation)
      this.stop(
        "Missing-source load cancelled. No remaining sources were requested.",
      );
  }
  clear() {
    if (this.operation) this.stop("");
    else {
      this.revision++;
      this.notify(idle());
    }
  }
  private interrupted(operation: Operation) {
    if (this.operation === operation)
      this.stop(
        "Missing-source load stopped because the company visit or source state changed.",
      );
  }
  private observed(source: Source) {
    const operation = this.operation;
    if (!operation) return;
    const state = source.model.getSnapshot();
    if (state === operation.views.get(source)) return;
    const active = operation.active;
    this.claimStart(operation, source, state);
    if (!this.current(operation) || active?.source !== source) {
      this.interrupted(operation);
      return;
    }
    if (!this.acceptChange(operation, active, state)) return;
    operation.views.set(source, state);
    if (!this.current(operation) || !this.unchanged(operation))
      this.interrupted(operation);
  }
  private claimStart(operation: Operation, source: Source, state: SourceState) {
    const active = operation.active;
    if (
      active?.source !== source ||
      active.phase !== "starting" ||
      active.started
    )
      return;
    if (
      !state.running ||
      state.selection !== active.selection ||
      range(state) !== active.range
    )
      return;
    active.started = true;
    active.owned = true;
    operation.views.set(source, state);
  }
  private acceptChange(
    operation: Operation,
    active: Active,
    state: SourceState,
  ) {
    if (active.phase === "opening") {
      if (
        !state.running &&
        !state.catalogChanged &&
        state.response === null &&
        (state.selection === null ||
          companyEvidenceSelectionMatches(operation.captured, state.selection))
      )
        return true;
      this.interrupted(operation);
      return false;
    }
    if (state.catalogChanged) {
      this.sourceStopped(active, state);
      return false;
    }
    if (
      active.finished ||
      active.phase === "ready" ||
      state.selection !== active.selection ||
      range(state) !== active.range
    ) {
      active.owned = false;
      this.interrupted(operation);
      return false;
    }
    if (state.error || (state.response !== null && !active.source.accepted())) {
      this.sourceStopped(active, state);
      return false;
    }
    if (!state.running) {
      active.owned = false;
      active.finished = true;
      if (!active.started || !active.source.accepted()) {
        this.stop(`${active.source.label} stopped. ${state.message}`, false);
        return false;
      }
    }
    return true;
  }
  private sourceStopped(active: Active, state: SourceState) {
    active.owned = false;
    const message =
      state.response !== null && !state.error && !state.catalogChanged
        ? "The response was retained, but its source is unavailable. Inspect the original source details."
        : state.message;
    this.stop(`${active.source.label} stopped. ${message}`, false);
  }
  private ready(operation: Operation) {
    if (this.current(operation) && this.unchanged(operation)) return true;
    this.interrupted(operation);
    return false;
  }
  private async attempt(operation: Operation, source: Source) {
    if (!this.ready(operation)) return false;
    let state = source.model.getSnapshot();
    if (state.response !== null || !source.covered(operation.captured))
      return true;
    const active: Active = {
      source,
      phase: "opening",
      selection: state.selection,
      range: range(state),
      started: false,
      owned: false,
      finished: false,
    };
    operation.active = active;
    if (state.selection === null) {
      if (!this.ready(operation)) return false;
      source.model.open(operation.captured);
      if (!this.ready(operation)) return false;
      state = source.model.getSnapshot();
    }
    if (!companyEvidenceSelectionMatches(operation.captured, state.selection)) {
      this.interrupted(operation);
      return false;
    }
    active.selection = state.selection;
    active.range = range(state);
    active.phase = "ready";
    if (
      !this.notify(
        {
          running: true,
          active: source.name,
          message: `Loading missing ${source.label} source…`,
        },
        operation,
      )
    ) {
      this.interrupted(operation);
      return false;
    }
    if (!this.ready(operation)) return false;
    operation.attempted = true;
    active.phase = "starting";
    const pending = source.model.load();
    active.phase = "pending";
    await pending;
    if (!this.ready(operation)) return false;
    if (!active.finished || !source.accepted()) {
      this.stop(
        `${source.label} stopped. ${source.model.getSnapshot().message}`,
        false,
      );
      return false;
    }
    operation.active = null;
    return true;
  }
  async start(
    selection: ManagedResearchSelection,
    admitted: () => boolean,
  ): Promise<void> {
    if (this.operation) return;
    this.revision++;
    const captured = Object.freeze({
      ...selection,
      listing: Object.freeze({ ...selection.listing }),
    });
    const operation: Operation = {
      selected: selection,
      captured,
      admitted,
      views: new Map(
        this.sources.map((source) => [source, source.model.getSnapshot()]),
      ),
      active: null,
      checking: false,
      attempted: false,
    };
    this.operation = operation;
    if (!this.current(operation) || !this.preflight(operation)) {
      this.interrupted(operation);
      return;
    }
    try {
      if (
        !this.notify(
          {
            running: true,
            active: null,
            message: "Starting missing-source load…",
          },
          operation,
        )
      ) {
        this.interrupted(operation);
        return;
      }
      for (const source of this.sources)
        if (!(await this.attempt(operation, source))) return;
      if (this.ready(operation))
        this.stop(
          operation.attempted
            ? "Missing-source load finished. Existing evidence kept its original source dates."
            : "No eligible missing sources to load. Existing evidence was kept.",
          false,
        );
    } catch {
      if (this.operation === operation)
        this.stop(
          "Missing-source load stopped. Inspect the source before trying again.",
        );
    }
  }
}
