import {
  membershipMatchesResult,
  type ValuationAssumptionEntry,
} from "@research-cockpit/contracts";
import type {
  ManagedFilingsReview,
  ManagedFilingsReviewState,
} from "./managed-filings-review";
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
  evaluatePassiveValuationPrice,
  inspectPassiveValuationPrice,
  type ManagedValuationPriceContext,
} from "./managed-valuation-price";
import {
  getManagedResearchCoverageCik,
  type ManagedResearchCoverage,
} from "./managed-research-eligibility";
import type { ManagedResearchSelection } from "./managed-research-selection";

type GroupRow = ManagedFilingsReviewState["rows"][number];
export interface SavedScenarioRow {
  readonly source: Pick<GroupRow, "price" | "filings">;
  readonly selection: ManagedResearchSelection;
  readonly entry: ValuationAssumptionEntry | null;
  readonly reason: "missing_saved_inputs" | "saved_identity_mismatch" | null;
  readonly price: ReturnType<typeof inspectPassiveValuationPrice>;
}
export interface SavedScenarioPlan {
  readonly collection: ManagedConfirmedValuationCollection;
  readonly capturedAt: string;
  readonly rows: readonly SavedScenarioRow[];
}
export interface SavedScenarioReading {
  readonly plan: SavedScenarioPlan;
  readonly evaluatedAt: string;
  readonly rows: readonly Readonly<{
    row: SavedScenarioRow;
    calculation: ManagedValuationCalculation | null;
    comparison: ManagedValuationPriceContext | null;
  }>[];
}
export interface WatchlistValuationReviewState {
  readonly plan: SavedScenarioPlan | null;
  readonly reading: SavedScenarioReading | null;
  readonly active: boolean;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
/** One passive valuation reading belongs to the existing daily group and confirmed collection. */
export class ManagedWatchlistValuationReview {
  private state: WatchlistValuationReviewState = Object.freeze({
    plan: null,
    reading: null,
    active: false,
  });
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: (() => void)[];
  private owner: {
    chosen: ManagedFilingsReviewState["chosen"];
    rows: ManagedFilingsReviewState["rows"];
    collection: ManagedConfirmedValuationCollection;
  } | null = null;
  private retired = false;
  constructor(
    private readonly group: ManagedFilingsReview,
    private readonly assumptions: ManagedValuationAssumptions,
    workbench: ManagedValuationWorkbench,
    private readonly options: {
      now(): string;
      available(): boolean;
      coverage: ManagedResearchCoverage;
    },
  ) {
    this.unsubscribe = [
      group.subscribe(() => this.reconcile()),
      assumptions.subscribe(() => this.reconcile()),
      workbench.subscribeDraftFileActivity(() => this.reconcile()),
    ];
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: WatchlistValuationReviewState) {
    const installed = Object.freeze(next);
    this.state = installed;
    for (const listener of [...this.listeners]) listener();
    return this.state === installed ? installed : null;
  }
  private active() {
    const group = this.group.getSnapshot();
    return (
      !this.retired &&
      this.options.available() &&
      group.active &&
      !group.catalogChanged &&
      !!group.daily &&
      group.daily.phase !== "running" &&
      group.daily.phase !== "finished" &&
      group.rows.length > 0 &&
      group.rows.length <= 5 &&
      group.rows.every((r) => !r.price?.running && !r.filings.running)
    );
  }
  private current() {
    const group = this.group.getSnapshot(),
      owner = this.owner;
    return (
      !!owner &&
      !!group.daily &&
      !group.catalogChanged &&
      group.chosen === owner.chosen &&
      group.rows === owner.rows &&
      this.assumptions.isConfirmedCollectionCurrent(owner.collection)
    );
  }
  reconcile() {
    const active = this.active();
    if (this.owner && !this.current()) {
      this.owner = null;
      this.publish({ plan: null, reading: null, active });
    } else if (active !== this.state.active)
      this.publish({ ...this.state, active });
  }
  canPreview(expected: WatchlistValuationReviewState) {
    return (
      expected === this.state &&
      this.active() &&
      this.assumptions.canCaptureConfirmedCollection()
    );
  }
  preview(expected: WatchlistValuationReviewState) {
    if (!this.canPreview(expected)) return null;
    const group = this.group.getSnapshot(),
      capturedAt = this.options.now();
    if (
      !Number.isFinite(Date.parse(capturedAt)) ||
      group !== this.group.getSnapshot() ||
      !this.canPreview(expected)
    )
      return null;
    const collection = this.assumptions.captureConfirmedCollection();
    if (!collection) return null;
    const rows = group.rows.map((source) => {
      const selection = source.price?.selection ?? source.filings.selection!;
      const entry =
        collection.saved.payload.entries.find(
          (e) => e.listing.listingId === source.member.listing.listingId,
        ) ?? null;
      const cik = getManagedResearchCoverageCik(
        selection,
        this.options.coverage,
      );
      const valid =
        entry &&
        cik !== null &&
        entry.cik === cik &&
        entry.catalogSnapshotSha256 === collection.catalog.snapshotSha256 &&
        entry.catalogSnapshotSha256 === selection.catalogSnapshotSha256 &&
        membershipMatchesResult(
          { ...entry.listing, note: "" },
          source.member.listing,
        );
      return freeze(
        structuredClone({
          source: { price: source.price, filings: source.filings },
          selection,
          entry: valid ? entry : null,
          reason: !entry
            ? ("missing_saved_inputs" as const)
            : !valid
              ? ("saved_identity_mismatch" as const)
              : null,
          price: inspectPassiveValuationPrice(selection, source.price),
        }),
      );
    });
    if (
      group !== this.group.getSnapshot() ||
      !this.canPreview(expected) ||
      !this.assumptions.isConfirmedCollectionCurrent(collection)
    )
      return null;
    this.owner = { chosen: group.chosen, rows: group.rows, collection };
    return this.publish({
      active: true,
      plan: freeze({ collection, capturedAt, rows }),
      reading: null,
    });
  }
  canEvaluate(expected: WatchlistValuationReviewState) {
    return (
      expected === this.state &&
      this.active() &&
      this.current() &&
      !!expected.plan &&
      !expected.reading
    );
  }
  evaluate(expected: WatchlistValuationReviewState) {
    if (!this.canEvaluate(expected)) return null;
    const evaluatedAt = this.options.now();
    if (
      !Number.isFinite(Date.parse(evaluatedAt)) ||
      !this.canEvaluate(expected)
    )
      return null;
    const plan = expected.plan!;
    const rows = plan.rows.map((row) => {
      const calculation = row.entry
        ? evaluateValuationInputs(
            { ...row.selection, cik: row.entry.cik },
            row.entry.dcf.inputs,
            row.entry.exit.inputs,
          )
        : null;
      return Object.freeze({
        row,
        calculation,
        comparison: calculation
          ? evaluatePassiveValuationPrice(
              row.selection,
              calculation,
              row.source.price,
            )
          : null,
      });
    });
    if (!this.canEvaluate(expected)) return null;
    return this.publish({
      ...expected,
      reading: freeze({ plan, evaluatedAt, rows }),
    });
  }
  clear(expected: WatchlistValuationReviewState) {
    if (expected !== this.state || !this.active()) return null;
    this.owner = null;
    return this.publish({ active: this.active(), plan: null, reading: null });
  }
  retire() {
    this.retired = true;
    this.owner = null;
    this.unsubscribe.forEach((f) => f());
    this.publish({ active: false, plan: null, reading: null });
  }
}
