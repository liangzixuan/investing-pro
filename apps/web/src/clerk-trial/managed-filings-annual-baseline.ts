import {
  membershipMatchesResult,
  type PersonalSecAnnualEvidenceResponseDto,
  type PersonalSecAnnualTargetDto,
} from "@research-cockpit/contracts";
import type { ManagedAnnualReportState } from "./managed-annual-report";
import type { ManagedCompanyFilingsState } from "./managed-company-filings";
import type { ManagedResearchSelection } from "./managed-research-selection";

export interface ManagedFilingsAnnualBaseline {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
  readonly target: Extract<PersonalSecAnnualTargetDto, { status: "target" }>;
}

function annualMatchesSelection(
  response: PersonalSecAnnualEvidenceResponseDto,
  selection: ManagedResearchSelection,
) {
  const fields = [
    "country",
    "exchangeMic",
    "issuerId",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
  ] as const;
  return fields.every(
    (field) => response.security[field] === selection.listing[field],
  );
}

function sameSelections(
  annual: ManagedResearchSelection,
  filings: ManagedResearchSelection,
) {
  return (
    annual.catalogSnapshotSha256 === filings.catalogSnapshotSha256 &&
    membershipMatchesResult({ ...annual.listing, note: "" }, filings.listing)
  );
}

/** Joins already admitted packets; reading retained filing metadata needs no financial eligibility. */
export function getManagedFilingsAnnualBaseline(
  annual: ManagedAnnualReportState,
  filings: ManagedCompanyFilingsState,
): ManagedFilingsAnnualBaseline | null {
  const { response, selection } = annual;
  const filingResponse = filings.response;
  const filingSelection = filings.selection;
  if (!response || !selection || !filingResponse || !filingSelection)
    return null;
  if (annual.catalogChanged || filings.catalogChanged) return null;
  if (
    response.evidence.target.status !== "target" ||
    filingResponse.issuer.status !== "available"
  )
    return null;
  if (!sameSelections(selection, filingSelection)) return null;
  if (!responsesMatch(response, filingResponse, selection, filingSelection))
    return null;
  return { response, target: response.evidence.target };
}

function responsesMatch(
  annual: PersonalSecAnnualEvidenceResponseDto,
  filings: NonNullable<ManagedCompanyFilingsState["response"]>,
  selection: ManagedResearchSelection,
  filingSelection: ManagedResearchSelection,
) {
  const cik = annual.security.cik;
  return (
    annual.catalogSnapshotSha256 === selection.catalogSnapshotSha256 &&
    filings.catalogSnapshotSha256 === filingSelection.catalogSnapshotSha256 &&
    annualMatchesSelection(annual, selection) &&
    membershipMatchesResult(
      { ...filingSelection.listing, note: "" },
      filings.security,
    ) &&
    [annual.evidence.cik, filings.security.cik, filings.issuer.cik].every(
      (value) => value === cik,
    ) &&
    [selection.cik, filingSelection.cik].every(
      (value) => value === null || value === cik,
    )
  );
}
