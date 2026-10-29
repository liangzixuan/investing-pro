import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import { getManagedAnnualView } from "./managed-annual-view";
import type { ManagedFinancialScreenResultRow } from "./managed-financial-screen";
import type { ManagedAnnualReportState } from "./managed-annual-report";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import type { ScreenComparisonReportCompany } from "./screen-comparison-report";

function settledSource(state: ManagedAnnualReportState) {
  if (state.running) return false;
  if (state.checkingSeed) return false;
  return !state.catalogChanged;
}
function captureSource(row: ManagedFinancialScreenResultRow, digest: string) {
  const state = row.report;
  if (!state) return null;
  if (!settledSource(state)) return null;
  const response = state.response;
  if (!response) return null;
  const view = getManagedAnnualView(response);
  if (!view) return null;
  if (response.catalogSnapshotSha256 !== digest) return null;
  return { state, response, view };
}
/** Bind the complete model-owned member to the exact screening selection. */
function sourceSelectionMatches(
  row: ManagedFinancialScreenResultRow,
  state: ManagedAnnualReportState,
  response: PersonalSecAnnualCanonicalResponseDto,
) {
  return companyEvidenceSelectionMatches(
    {
      listing: row.member.listing,
      catalogSnapshotSha256: response.catalogSnapshotSha256,
      cik: null,
      origin: "screening",
    },
    state.selection,
  );
}
/** Compare every response-exposed identity field and the independent SEC source CIK. */
function sourceRecordMatches(
  row: ManagedFinancialScreenResultRow,
  response: PersonalSecAnnualCanonicalResponseDto,
) {
  for (const field of [
    "listingId",
    "symbol",
    "issuerId",
    "issuerName",
    "securityName",
    "country",
    "exchangeMic",
  ] as const)
    if (response.security[field] !== row.member.listing[field]) return false;
  return response.security.cik === response.evidence.cik;
}
export function captureScreenComparisonCompany(
  row: ManagedFinancialScreenResultRow,
  digest: string,
): ScreenComparisonReportCompany | null {
  const source = captureSource(row, digest);
  if (!source) return null;
  const { state, response, view } = source;
  if (!sourceSelectionMatches(row, state, response)) return null;
  if (!sourceRecordMatches(row, response)) return null;
  return {
    listing: { ...row.member.listing },
    response,
    view: JSON.parse(JSON.stringify(view)) as PersonalSecAnnualCanonicalView,
    showingPrevious: state.showingPrevious,
    responseOrigin: state.responseOrigin,
    message: state.message,
    error: state.error,
    failure: row.failure,
  };
}
