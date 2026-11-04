import type {
  ManagedValuationAssumptions,
  ManagedConfirmedValuationCollection,
} from "./managed-valuation-assumptions";
import {
  evaluateValuationInputs,
  type ManagedValuationCalculation,
  type ManagedValuationWorkbench,
} from "./managed-valuation-workbench";
import {
  isPreparedPortfolioReviewReport,
  type PreparedPortfolioReviewReport,
} from "./portfolio-review-report";
import type {
  PortfolioReviewReportSource,
  PortfolioReviewReportCapture,
} from "./portfolio-review-report-controller";
import type { ManagedResearchCoverage } from "./managed-research-eligibility";
import {
  preparePortfolioSavedScenarioRows,
  type PortfolioSavedScenarioRow,
} from "./portfolio-valuation-plan";
import {
  evaluatePortfolioValuationPrice,
  type PortfolioValuationComparison,
} from "./portfolio-valuation-price";

/** Workspace supplies an irreversible detached lease, including exact owned Research/Back. */
export interface PortfolioValuationSource extends PortfolioReviewReportSource {
  canCapture(): boolean;
}
export interface PortfolioSavedScenarioPlan {
  readonly report: PreparedPortfolioReviewReport;
  readonly collection: ManagedConfirmedValuationCollection;
  readonly capturedAt: string;
  readonly rows: readonly PortfolioSavedScenarioRow[];
}
export interface PortfolioSavedScenarioReading {
  readonly plan: PortfolioSavedScenarioPlan;
  readonly evaluatedAt: string;
  readonly rows: readonly Readonly<{
    row: PortfolioSavedScenarioRow;
    calculation: ManagedValuationCalculation | null;
    comparison: PortfolioValuationComparison | null;
  }>[];
}
export interface PortfolioValuationReviewState {
  readonly active: boolean;
  readonly plan: PortfolioSavedScenarioPlan | null;
  readonly reading: PortfolioSavedScenarioReading | null;
}
interface Owner {
  readonly capture: PortfolioReviewReportCapture;
  readonly collection: ManagedConfirmedValuationCollection;
  dead: boolean;
}
function validTime(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
/** Passive holdings reading. No Watchlist group, source operation or persistence method. */
export class ManagedPortfolioValuationReview {
  private state: PortfolioValuationReviewState = Object.freeze({
    active: false,
    plan: null,
    reading: null,
  });
  private owner: Owner | null = null;
  private retired = false;
  private revision = 0;
  private readonly listeners = new Set<() => void>();
  private readonly off: (() => void)[];
  constructor(
    private readonly source: PortfolioValuationSource,
    private readonly assumptions: ManagedValuationAssumptions,
    workbench: ManagedValuationWorkbench,
    private readonly options: {
      now(): string;
      available(): boolean;
      coverage: ManagedResearchCoverage;
    },
  ) {
    const changed = () => {
      this.revision++;
      this.reconcile(true);
    };
    this.off = [
      source.subscribe(changed),
      assumptions.subscribe(changed),
      workbench.subscribeDraftFileActivity(changed),
    ];
    this.reconcile();
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private active() {
    return (
      !this.retired && this.options.available() && this.source.canCapture()
    );
  }
  private current(owner = this.owner): owner is Owner {
    if (!owner || owner.dead) return false;
    if (
      !owner.capture.current() ||
      !this.assumptions.isConfirmedCollectionCurrent(owner.collection)
    )
      owner.dead = true;
    return !owner.dead && this.owner === owner && !this.retired;
  }
  private publish(next: PortfolioValuationReviewState) {
    const installed = Object.freeze(next);
    this.state = installed;
    for (const listener of [...this.listeners]) listener();
    if (this.owner && !this.current()) this.invalidate();
    return this.state === installed ? installed : null;
  }
  reconcile(refresh = false) {
    const active = this.active();
    if (this.owner && !this.current()) {
      this.owner = null;
      this.publish({ active, plan: null, reading: null });
    } else if (refresh || active !== this.state.active)
      this.publish({ ...this.state, active });
  }
  canPreview(expected: PortfolioValuationReviewState) {
    return (
      expected === this.state &&
      this.active() &&
      this.assumptions.canCaptureConfirmedCollection() &&
      expected === this.state
    );
  }
  preview(expected: PortfolioValuationReviewState) {
    if (!this.canPreview(expected)) return null;
    const revision = this.revision,
      capturedAt = this.options.now();
    if (!validTime(capturedAt) || !this.canPreview(expected)) return null;
    const capture = this.source.capture();
    if (
      !capture ||
      !isPreparedPortfolioReviewReport(capture.report) ||
      !capture.current()
    )
      return null;
    const collection = this.assumptions.captureConfirmedCollection();
    if (!collection) return null;
    const rows = preparePortfolioSavedScenarioRows(
      capture.report,
      collection,
      this.options.coverage,
    );
    if (
      revision !== this.revision ||
      !this.canPreview(expected) ||
      !capture.current() ||
      !this.assumptions.isConfirmedCollectionCurrent(collection)
    )
      return null;
    this.owner = { capture, collection, dead: false };
    return this.publish({
      active: true,
      plan: Object.freeze({
        report: capture.report,
        collection,
        capturedAt,
        rows,
      }),
      reading: null,
    });
  }
  canEvaluate(expected: PortfolioValuationReviewState) {
    return (
      expected === this.state &&
      this.current() &&
      this.active() &&
      !!expected.plan &&
      !expected.reading &&
      expected === this.state
    );
  }
  evaluate(expected: PortfolioValuationReviewState) {
    if (!this.canEvaluate(expected)) return null;
    const revision = this.revision,
      evaluatedAt = this.options.now();
    if (!validTime(evaluatedAt) || !this.canEvaluate(expected)) return null;
    const plan = expected.plan!;
    const rows = plan.rows.map((row) => {
      const calculation = row.entry
        ? evaluateValuationInputs(
            row.selection,
            row.entry.dcf.inputs,
            row.entry.exit.inputs,
          )
        : null;
      const comparison = calculation
        ? evaluatePortfolioValuationPrice(
            plan.report,
            row.source,
            row.selection,
            calculation,
          )
        : null;
      return Object.freeze({ row, calculation, comparison });
    });
    if (revision !== this.revision || !this.canEvaluate(expected)) return null;
    return this.publish({
      ...expected,
      reading: Object.freeze({ plan, evaluatedAt, rows: Object.freeze(rows) }),
    });
  }
  clear(expected: PortfolioValuationReviewState) {
    if (expected !== this.state || !this.active()) return null;
    this.owner = null;
    return this.publish({ active: true, plan: null, reading: null });
  }
  invalidate() {
    this.revision++;
    this.owner = null;
    if (this.state.plan || this.state.reading)
      this.publish({ active: this.active(), plan: null, reading: null });
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.off.forEach((off) => off());
    this.owner = null;
    this.publish({ active: false, plan: null, reading: null });
  }
}
