import {
  membershipMatchesResult,
  type ValuationAssumptionEntry,
} from "@research-cockpit/contracts";
import type { PortfolioCloseRow } from "./managed-portfolio-close-review";
import type { ManagedConfirmedValuationCollection } from "./managed-valuation-assumptions";
import type { PreparedPortfolioReviewReport } from "./portfolio-review-report";
import {
  getManagedResearchCoverageCik,
  type ManagedResearchCoverage,
} from "./managed-research-eligibility";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  inspectPortfolioValuationPrice,
  type PortfolioValuationPrice,
} from "./portfolio-valuation-price";

export interface PortfolioSavedScenarioRow {
  readonly source: PortfolioCloseRow;
  readonly selection: ManagedResearchSelection;
  readonly entry: ValuationAssumptionEntry | null;
  readonly reason: "missing_saved_inputs" | "saved_identity_mismatch" | null;
  readonly price: PortfolioValuationPrice;
}
/** Exact confirmed entries only; an unmatched entry never supplies a replacement identity. */
export function preparePortfolioSavedScenarioRows(
  report: PreparedPortfolioReviewReport,
  collection: ManagedConfirmedValuationCollection,
  coverage: ManagedResearchCoverage,
): readonly PortfolioSavedScenarioRow[] {
  return Object.freeze(
    report.sourceRows.map((source) => {
      const base: ManagedResearchSelection = {
        catalogSnapshotSha256: report.ledger
          .snapshotSha256 as `sha256:${string}`,
        listing: source.holding.identity,
        cik: null,
        origin: "portfolio",
      };
      const selection = Object.freeze({
        ...base,
        cik: getManagedResearchCoverageCik(base, coverage),
      });
      const entry =
        collection.saved.payload.entries.find(
          (e) => e.listing.listingId === selection.listing.listingId,
        ) ?? null;
      const valid =
        entry &&
        selection.cik !== null &&
        entry.cik === selection.cik &&
        entry.catalogSnapshotSha256 === collection.catalog.snapshotSha256 &&
        entry.catalogSnapshotSha256 === selection.catalogSnapshotSha256 &&
        membershipMatchesResult(
          { ...entry.listing, note: "" },
          selection.listing,
        );
      return Object.freeze({
        source,
        selection,
        entry: valid ? entry : null,
        reason: !entry
          ? ("missing_saved_inputs" as const)
          : !valid
            ? ("saved_identity_mismatch" as const)
            : null,
        price: inspectPortfolioValuationPrice(report, source),
      });
    }),
  );
}
