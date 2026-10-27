import type { ManagedResearchSelection } from "./managed-research-selection";
import type {
  ManagedCompanySnapshotLoad,
  ManagedCompanySnapshotLoadState,
} from "./managed-company-snapshot-load";
import { CompanySnapshotLoadOperation } from "./managed-company-snapshot-load-operation";
import {
  reviewedSourceNames,
  type CompanySnapshotLoadSource,
  type SnapshotLoadSource,
  type SnapshotSourceState,
} from "./managed-company-snapshot-load-sources";
import {
  companySourcePassRows,
  unattemptedCompanySourcePassRows,
  type CompanySourcePassPreview,
} from "./managed-company-source-pass-state";

/** Captures the exact visit, source objects and declared reads for one preview. */
export class ReviewedCompanySourcePlan {
  readonly handle: CompanySourcePassPreview;
  private readonly operation: CompanySnapshotLoadOperation;
  private constructor(
    sources: readonly SnapshotLoadSource[],
    selection: ManagedResearchSelection,
    admitted: () => boolean,
    names: readonly CompanySnapshotLoadSource[],
  ) {
    this.operation = new CompanySnapshotLoadOperation(
      sources,
      selection,
      admitted,
    );
    this.handle = Object.freeze({
      selection: this.operation.captured,
      names,
      rows: companySourcePassRows(sources, this.operation.captured, names),
    });
  }
  static capture(
    sources: readonly SnapshotLoadSource[],
    selection: ManagedResearchSelection,
    admitted: () => boolean,
    names: readonly CompanySnapshotLoadSource[],
  ) {
    const valid = reviewedSourceNames(names);
    return valid
      ? new ReviewedCompanySourcePlan(sources, selection, admitted, valid)
      : null;
  }
  admitted() {
    return this.operation.admitted();
  }
  unchanged() {
    return this.operation.unchanged();
  }
  ready() {
    if (!this.operation.unchanged()) return false;
    return this.operation.canStart();
  }
}
export interface CompanySourcePassObservation {
  readonly state: ManagedCompanySnapshotLoadState;
  readonly sources?: readonly SnapshotSourceState[];
}
/** Keeps loader ownership and original terminal evidence tied to one consumed plan. */
export class CompanySourcePassRun {
  readonly owner: object = Object.freeze({});
  private started = false;
  constructor(readonly plan: ReviewedCompanySourcePlan) {}
  private accept(observation: CompanySourcePassObservation) {
    if (observation.state.running) this.started = true;
    return this.started ? observation : null;
  }
  observe(
    loader: ManagedCompanySnapshotLoad,
  ): CompanySourcePassObservation | null {
    const result = loader.getReviewedResult(this.owner);
    if (result) return this.accept(result);
    if (!loader.ownsReviewed(this.owner)) return null;
    return this.accept({ state: loader.getSnapshot() });
  }
  result(loader: ManagedCompanySnapshotLoad): CompanySourcePassObservation {
    return (
      loader.getReviewedResult(this.owner) ?? { state: loader.getSnapshot() }
    );
  }
  rows(
    sources: readonly SnapshotLoadSource[],
    observation: CompanySourcePassObservation,
  ) {
    const { selection, names } = this.plan.handle;
    return companySourcePassRows(
      sources,
      selection,
      names,
      observation.state.outcomes,
      observation.sources,
    );
  }
  cancelledRows(
    sources: readonly SnapshotLoadSource[],
    loader: ManagedCompanySnapshotLoad,
  ) {
    const result = loader.getReviewedResult(this.owner);
    return result
      ? this.rows(sources, result)
      : unattemptedCompanySourcePassRows(this.plan.handle);
  }
}
