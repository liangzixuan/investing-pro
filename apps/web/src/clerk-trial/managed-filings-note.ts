import type {
  ManagedSecFilingsResponseDto,
  PersonalSecRecentFilingDto,
} from "@research-cockpit/contracts";

/** Formats one row from an admitted packet; never reads a source or saves. */
export function filingReferenceNoteExcerpt(
  response: ManagedSecFilingsResponseDto,
  filing: PersonalSecRecentFilingDto,
  showingPrevious: boolean,
): string | null {
  const { issuer } = response;
  if (issuer.status !== "available" || !issuer.filings.includes(filing))
    return null;
  return [
    `Observed SEC filing reference: ${response.security.symbol} (${response.security.exchangeMic}); CIK ${issuer.cik}; Form ${filing.form}; accession ${filing.accessionNumber}; filed ${filing.filingDate}; report date ${filing.reportDate ?? "unavailable"}; filing index ${filing.sourceUrl}.`,
    `Source: SEC Submissions; requested window ${response.window.fromDate} to ${response.window.throughDate}; original request started ${response.requestStartedAt}; retrieved ${issuer.fetchedAt}; completed ${response.completedAt}.`,
    "Only the current recent-filings object was checked; older continuation files were not loaded; complete window coverage is not established.",
    ...(issuer.olderHistoryAvailable
      ? ["The source lists older continuation files."]
      : []),
    ...(issuer.truncated
      ? [
          `The list was truncated to ${issuer.filings.length} of ${issuer.matchingFilings} matching filings.`,
        ]
      : []),
    ...(showingPrevious
      ? [
          "Retained previous filings response; newer filings were not confirmed.",
        ]
      : []),
    "Filing contents were not fetched. Evidence dates are unchanged; this action does not refresh sources.",
  ].join(" ");
}
