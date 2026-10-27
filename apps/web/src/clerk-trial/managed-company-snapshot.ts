import { membershipMatchesResult } from "@research-cockpit/contracts";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedInterimReportState } from "./managed-interim-report";
import type { ManagedAnnualReportState } from "./managed-annual-report";
import type { ManagedEodHistoryState } from "./managed-eod-history";
import type { ManagedCompanyFilingsState } from "./managed-company-filings";

/** Read only model-admitted evidence from this exact company visit. */
export function companySnapshotEvidence(
  selection: ManagedResearchSelection,
  price: ManagedEodHistoryState,
  annual: ManagedAnnualReportState,
  filings: ManagedCompanyFilingsState,
  interim: ManagedInterimReportState | null,
) {
  return {
    price:
      !price.catalogChanged &&
      companyEvidenceSelectionMatches(selection, price.selection)
        ? price
        : null,
    annual:
      !annual.catalogChanged &&
      companyEvidenceSelectionMatches(selection, annual.selection)
        ? annual
        : null,
    interim:
      interim !== null &&
      !interim.catalogChanged &&
      companyEvidenceSelectionMatches(selection, interim.selection)
        ? interim
        : null,
    filings:
      !filings.catalogChanged &&
      companyEvidenceSelectionMatches(selection, filings.selection)
        ? filings
        : null,
  };
}

export function companyEvidenceSelectionMatches(
  selection: ManagedResearchSelection,
  candidate: ManagedResearchSelection | null,
) {
  return (
    candidate !== null &&
    candidate.catalogSnapshotSha256 === selection.catalogSnapshotSha256 &&
    candidate.origin === selection.origin &&
    candidate.cik === selection.cik &&
    membershipMatchesResult(
      { ...selection.listing, note: "" },
      candidate.listing,
    )
  );
}
