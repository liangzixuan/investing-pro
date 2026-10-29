import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import { getManagedAnnualView } from "./managed-annual-view";
import { validateManagedFinancialScreenCriteria } from "./managed-financial-screen-results";
import type { ManagedFinancialScreenResultRow } from "./managed-financial-screen";
import type { ManagedAnnualReportState } from "./managed-annual-report";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import type {
  PreparedScreenComparisonReport,
  ScreenComparisonReportCompany,
  ScreenComparisonReportInput,
} from "./screen-comparison-report";
function assertPreparedAt(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value))
    throw new TypeError("Preparation time is invalid.");
  if (new Date(value).toISOString() !== value)
    throw new TypeError("Preparation time is not canonical.");
}
function captureRun(input: ScreenComparisonReportInput) {
  if (input.run.status === "running")
    throw new TypeError("Screen is still running.");
  if (input.left === input.right)
    throw new TypeError("Distinct rows are required.");
  for (const row of [input.left, input.right])
    if (!input.run.rows.includes(row))
      throw new TypeError("An owned run row is required.");
  if (
    input.left.member.listing.listingId === input.right.member.listing.listingId
  )
    throw new TypeError("Distinct listings are required.");
  const criteria = validateManagedFinancialScreenCriteria(input.run.criteria);
  if (!criteria) throw new TypeError("Screen criteria are invalid.");
  return {
    criteria,
    run: {
      startedAt: input.run.startedAt,
      completedAt: input.run.completedAt,
      status: input.run.status,
    },
  };
}
function settledSource(row: ManagedFinancialScreenResultRow) {
  const state = row.report;
  if (!state) throw new TypeError("Annual report is missing.");
  if (state.running) throw new TypeError("Annual report is running.");
  if (state.checkingSeed) throw new TypeError("Annual report seed is pending.");
  if (state.catalogChanged) throw new TypeError("Annual catalog changed.");
  return state;
}
function captureSource(row: ManagedFinancialScreenResultRow, digest: string) {
  const state = settledSource(row);
  const response = state.response;
  if (!response) throw new TypeError("Annual response is missing.");
  const view = getManagedAnnualView(response);
  if (!view) throw new TypeError("An owned Annual response is required.");
  if (response.catalogSnapshotSha256 !== digest)
    throw new TypeError("Annual catalog differs.");
  return { state, response, view };
}
function assertIdentity(
  row: ManagedFinancialScreenResultRow,
  state: ManagedAnnualReportState,
  response: PersonalSecAnnualCanonicalResponseDto,
) {
  if (
    !companyEvidenceSelectionMatches(
      {
        listing: row.member.listing,
        catalogSnapshotSha256: response.catalogSnapshotSha256,
        cik: null,
        origin: "screening",
      },
      state.selection,
    )
  )
    throw new TypeError("Annual selection differs.");
  for (const field of [
    "listingId",
    "symbol",
    "issuerId",
    "issuerName",
    "securityName",
    "country",
    "exchangeMic",
  ] as const)
    if (response.security[field] !== row.member.listing[field])
      throw new TypeError("Annual identity differs.");
  if (response.security.cik !== response.evidence.cik)
    throw new TypeError("Annual CIK differs.");
}
function company(
  row: ManagedFinancialScreenResultRow,
  digest: string,
): ScreenComparisonReportCompany {
  const { state, response, view } = captureSource(row, digest);
  assertIdentity(row, state, response);
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
export function admitScreenComparisonReport(
  input: ScreenComparisonReportInput,
): PreparedScreenComparisonReport {
  assertPreparedAt(input.preparedAt);
  const run = captureRun(input);
  return {
    kind: "screen_comparison",
    preparedAt: input.preparedAt,
    catalogSnapshotSha256: input.catalogSnapshotSha256,
    ...run,
    left: company(input.left, input.catalogSnapshotSha256),
    right: company(input.right, input.catalogSnapshotSha256),
  };
}
