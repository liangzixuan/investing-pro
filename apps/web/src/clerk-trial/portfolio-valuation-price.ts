import { membershipMatchesResult } from "@research-cockpit/contracts";
import { calculateAuthoredPriceComparison } from "@research-cockpit/personal-market-analytics";
import type { PortfolioCloseRow } from "./managed-portfolio-close-review";
import {
  isPreparedPortfolioReviewReport,
  type PreparedPortfolioReviewReport,
} from "./portfolio-review-report";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  VALUATION_SCENARIOS,
  type ManagedValuationCalculation,
} from "./managed-valuation-workbench";
import type {
  ManagedValuationPriceRow,
  ManagedValuationPriceContext,
} from "./managed-valuation-price";

export type PortfolioValuationPriceReason =
  | "portfolio_report_unowned"
  | "price_identity_mismatch"
  | "price_unsupported"
  | "price_not_loaded"
  | "selected_close_missing";
export interface PortfolioValuationPrice {
  readonly reference: ManagedValuationPriceContext["reference"];
  readonly reason: PortfolioValuationPriceReason | null;
}
export interface PortfolioValuationComparison extends PortfolioValuationPrice {
  readonly rows: readonly ManagedValuationPriceRow[];
}
/** Uses the already admitted complete report. Never changes its selected date or source packet. */
export function inspectPortfolioValuationPrice(
  report: PreparedPortfolioReviewReport,
  source: PortfolioCloseRow,
): PortfolioValuationPrice {
  if (!isPreparedPortfolioReviewReport(report))
    return Object.freeze({
      reference: null,
      reason: "portfolio_report_unowned",
    });
  if (!report.sourceRows.includes(source))
    return Object.freeze({
      reference: null,
      reason: "price_identity_mismatch",
    });
  if (!source.available)
    return Object.freeze({ reference: null, reason: "price_unsupported" });
  if (!source.response)
    return Object.freeze({ reference: null, reason: "price_not_loaded" });
  const bar = source.response.rows.find(
    (row) => row.date === report.selectedDate,
  );
  if (!bar)
    return Object.freeze({ reference: null, reason: "selected_close_missing" });
  return Object.freeze({
    reference: Object.freeze({
      response: source.response,
      rawCloseUsd: bar.close,
      date: bar.date,
      showingPrevious: source.showingPrevious,
    }),
    reason: null,
  });
}
function exactOwner(
  report: PreparedPortfolioReviewReport,
  source: PortfolioCloseRow,
  selection: ManagedResearchSelection,
  calculation: ManagedValuationCalculation,
) {
  return (
    selection.origin === "portfolio" &&
    selection.cik !== null &&
    selection.catalogSnapshotSha256 === report.ledger.snapshotSha256 &&
    calculation.owner.catalogSnapshotSha256 ===
      selection.catalogSnapshotSha256 &&
    calculation.owner.cik === selection.cik &&
    calculation.owner.origin === selection.origin &&
    membershipMatchesResult(
      { ...source.holding.identity, note: "" },
      selection.listing,
    ) &&
    membershipMatchesResult(
      { ...selection.listing, note: "" },
      calculation.owner.listing,
    )
  );
}
function comparisonRows(
  model: "dcf" | "exit",
  calculation: ManagedValuationCalculation,
  price: PortfolioValuationPrice,
): readonly ManagedValuationPriceRow[] {
  const result =
    model === "dcf" ? calculation.dcfResult : calculation.exitResult;
  return VALUATION_SCENARIOS.map((scenario) => {
    const value =
      result.status === "available" ? result.scenarios[scenario] : null;
    const modelValuePerShareUsd =
      value?.status === "available"
        ? "valuePerShareUsd" in value
          ? value.valuePerShareUsd
          : value.valuePerShare
        : null;
    const reason =
      result.status === "unavailable"
        ? result.reason
        : value?.status === "unavailable"
          ? value.reason
          : price.reason;
    return Object.freeze({
      model,
      scenario,
      modelValuePerShareUsd,
      result: reason
        ? Object.freeze({ status: "unavailable" as const, reason })
        : calculateAuthoredPriceComparison(
            modelValuePerShareUsd,
            price.reference?.rawCloseUsd,
          ),
    });
  });
}
/** Passive rows only: no registered live workbench or source capability is created. */
export function evaluatePortfolioValuationPrice(
  report: PreparedPortfolioReviewReport,
  source: PortfolioCloseRow,
  selection: ManagedResearchSelection,
  calculation: ManagedValuationCalculation,
): PortfolioValuationComparison {
  const inspected = inspectPortfolioValuationPrice(report, source);
  const price: PortfolioValuationPrice =
    inspected.reason === "portfolio_report_unowned" ||
    exactOwner(report, source, selection, calculation)
      ? inspected
      : { reference: null, reason: "price_identity_mismatch" };
  return Object.freeze({
    ...price,
    rows: Object.freeze([
      ...comparisonRows("dcf", calculation, price),
      ...comparisonRows("exit", calculation, price),
    ]),
  });
}
