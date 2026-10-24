import type { ManagedAnnualReport } from "./managed-annual-report";
import type { ManagedCompanyFilings } from "./managed-company-filings";
import type { ManagedEodHistory } from "./managed-eod-history";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import {
  CompanySnapshotLoadOperation,
  type SnapshotSourceAttempt,
} from "./managed-company-snapshot-load-operation";
import {
  companySnapshotLoadSources,
  snapshotSourceAlreadyPresent,
  snapshotSourceStopMessage,
  type CompanySnapshotLoadSource,
  type SnapshotLoadSource,
  type SnapshotSourceState,
} from "./managed-company-snapshot-load-sources";
export type { CompanySnapshotLoadSource } from "./managed-company-snapshot-load-sources";
export interface ManagedCompanySnapshotLoadState {
  readonly running: boolean;
  readonly active: CompanySnapshotLoadSource | null;
  readonly message: string;
}
const idle = (): ManagedCompanySnapshotLoadState =>
  Object.freeze({ running: false, active: null, message: "" });
/** One explicit sequential pass through eligible missing company sources. */
export class ManagedCompanySnapshotLoad {
  private state = idle();
  private readonly listeners = new Set<() => void>();
  private operation: CompanySnapshotLoadOperation | null = null;
  private revision = 0;
  private readonly sources: readonly SnapshotLoadSource[];
  constructor(
    price: ManagedEodHistory,
    annual: ManagedAnnualReport,
    filings: ManagedCompanyFilings,
  ) {
    this.sources = companySnapshotLoadSources(price, annual, filings);
    for (const source of this.sources)
      source.model.subscribe(() => this.observed(source));
  }
  getSnapshot = (): ManagedCompanySnapshotLoadState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private current(operation: CompanySnapshotLoadOperation) {
    if (this.operation !== operation) return false;
    if (!operation.admitted()) return false;
    return this.operation === operation;
  }
  private notificationCurrent(
    revision: number,
    operation?: CompanySnapshotLoadOperation,
  ) {
    if (revision !== this.revision) return false;
    return operation === undefined || this.current(operation);
  }
  private notify(
    next: ManagedCompanySnapshotLoadState,
    operation?: CompanySnapshotLoadOperation,
  ) {
    if (operation && !this.current(operation)) return false;
    const revision = this.revision;
    this.state = Object.freeze(next);
    for (const listener of this.listeners) {
      if (!this.notificationCurrent(revision, operation)) return false;
      listener();
    }
    return this.notificationCurrent(revision, operation);
  }
  private stop(message: string, cancelOwned = true) {
    const operation = this.operation;
    const revision = ++this.revision;
    this.operation = null;
    if (cancelOwned) operation?.cancelOwned();
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
  private interrupted(operation: CompanySnapshotLoadOperation) {
    if (this.operation === operation)
      this.stop(
        "Missing-source load stopped because the company visit or source state changed.",
      );
  }
  private ready(operation: CompanySnapshotLoadOperation) {
    if (!this.current(operation)) {
      this.interrupted(operation);
      return false;
    }
    if (operation.unchanged()) return true;
    this.interrupted(operation);
    return false;
  }
  private observed(source: SnapshotLoadSource) {
    const operation = this.operation;
    if (!operation) return;
    const state = operation.changed(source);
    if (!state) return;
    if (!this.current(operation)) {
      this.interrupted(operation);
      return;
    }
    this.observedChange(operation, source, state);
  }
  private observedChange(
    operation: CompanySnapshotLoadOperation,
    source: SnapshotLoadSource,
    state: SnapshotSourceState,
  ) {
    const active = operation.active;
    if (active?.source !== source) {
      this.interrupted(operation);
      return;
    }
    switch (active.change(operation.captured, state)) {
      case "interrupted":
        this.interrupted(operation);
        return;
      case "stopped":
        this.sourceStopped(active, state);
        return;
      case "cancelled":
        this.stop(`${source.label} stopped. ${state.message}`, false);
        return;
      case "accepted":
        operation.remember(source, state);
        this.ready(operation);
    }
  }
  private sourceStopped(
    active: SnapshotSourceAttempt,
    state: SnapshotSourceState,
  ) {
    active.owned = false;
    this.stop(snapshotSourceStopMessage(active.source, state), false);
  }
  private openMissing(
    operation: CompanySnapshotLoadOperation,
    active: SnapshotSourceAttempt,
  ) {
    if (active.source.model.getSnapshot().selection !== null) return true;
    if (!this.ready(operation)) return false;
    active.source.model.open(operation.captured);
    return this.ready(operation);
  }
  private prepareSource(
    operation: CompanySnapshotLoadOperation,
    active: SnapshotSourceAttempt,
  ) {
    if (!this.openMissing(operation, active)) return false;
    const state = active.source.model.getSnapshot();
    if (!companyEvidenceSelectionMatches(operation.captured, state.selection)) {
      this.interrupted(operation);
      return false;
    }
    active.prepare(state);
    return true;
  }
  private announceSource(
    operation: CompanySnapshotLoadOperation,
    source: SnapshotLoadSource,
  ) {
    const announced = this.notify(
      {
        running: true,
        active: source.name,
        message: `Loading missing ${source.label} source…`,
      },
      operation,
    );
    if (!announced) {
      this.interrupted(operation);
      return false;
    }
    return this.ready(operation);
  }
  private finishSource(
    operation: CompanySnapshotLoadOperation,
    active: SnapshotSourceAttempt,
  ) {
    if (!active.succeeded()) {
      this.stop(
        `${active.source.label} stopped. ${active.source.model.getSnapshot().message}`,
        false,
      );
      return false;
    }
    operation.active = null;
    return true;
  }
  private async loadSource(
    operation: CompanySnapshotLoadOperation,
    active: SnapshotSourceAttempt,
  ) {
    operation.attempted = true;
    active.phase = "starting";
    const pending = active.source.model.load();
    active.phase = "pending";
    await pending;
    if (!this.ready(operation)) return false;
    return this.finishSource(operation, active);
  }
  private async attempt(
    operation: CompanySnapshotLoadOperation,
    source: SnapshotLoadSource,
  ) {
    if (!this.ready(operation)) return false;
    if (snapshotSourceAlreadyPresent(source, operation.captured)) return true;
    const active = operation.begin(source);
    if (!this.prepareSource(operation, active)) return false;
    if (!this.announceSource(operation, source)) return false;
    return this.loadSource(operation, active);
  }
  private begin(operation: CompanySnapshotLoadOperation) {
    if (!this.current(operation)) {
      this.interrupted(operation);
      return false;
    }
    if (!operation.canStart()) {
      this.interrupted(operation);
      return false;
    }
    const announced = this.notify(
      { running: true, active: null, message: "Starting missing-source load…" },
      operation,
    );
    if (!announced) this.interrupted(operation);
    return announced;
  }
  private finished(operation: CompanySnapshotLoadOperation) {
    if (!this.ready(operation)) return;
    this.stop(
      operation.attempted
        ? "Missing-source load finished. Existing evidence kept its original source dates."
        : "No eligible missing sources to load. Existing evidence was kept.",
      false,
    );
  }
  private async loadSequential(operation: CompanySnapshotLoadOperation) {
    for (const source of this.sources)
      if (!(await this.attempt(operation, source))) return;
    this.finished(operation);
  }
  private failed(operation: CompanySnapshotLoadOperation) {
    if (this.operation === operation)
      this.stop(
        "Missing-source load stopped. Inspect the source before trying again.",
      );
  }
  async start(
    selection: ManagedResearchSelection,
    admitted: () => boolean,
  ): Promise<void> {
    if (this.operation) return;
    this.revision++;
    const operation = new CompanySnapshotLoadOperation(
      this.sources,
      selection,
      admitted,
    );
    this.operation = operation;
    try {
      if (!this.begin(operation)) return;
      await this.loadSequential(operation);
    } catch {
      this.failed(operation);
    }
  }
}
