import { membershipMatchesResult } from "@research-cockpit/contracts";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedAnnualReportState } from "./managed-annual-report";
import type { ManagedEodHistoryState } from "./managed-eod-history";

/** Read only model-admitted evidence from this exact company visit. */
export function companySnapshotEvidence(
  selection: ManagedResearchSelection,
  price: ManagedEodHistoryState,
  annual: ManagedAnnualReportState,
) {
  const matches = (candidate: ManagedResearchSelection | null) =>
    candidate !== null &&
    candidate.catalogSnapshotSha256 === selection.catalogSnapshotSha256 &&
    candidate.origin === selection.origin &&
    candidate.cik === selection.cik &&
    membershipMatchesResult(
      { ...selection.listing, note: "" },
      candidate.listing,
    );
  return {
    price: !price.catalogChanged && matches(price.selection) ? price : null,
    annual: !annual.catalogChanged && matches(annual.selection) ? annual : null,
  };
}
