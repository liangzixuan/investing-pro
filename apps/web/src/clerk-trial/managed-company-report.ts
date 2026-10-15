import { membershipMatchesResult } from "@research-cockpit/contracts";
import type { ResearchWatchlistState } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  companyEvidenceSelectionMatches,
  type companySnapshotEvidence,
} from "./managed-company-snapshot";

export type CompanyReportEvidence = ReturnType<typeof companySnapshotEvidence>;

/** A visit-owned read-only preview; this is not a saved-watchlist export. */
export interface PreparedCompanyReport {
  readonly kind: "loaded_company_research";
  readonly preparedAt: string;
  readonly selection: ManagedResearchSelection;
  readonly evidence: CompanyReportEvidence;
  readonly note: string | null;
}

export function companyReportBlock(
  selection: ManagedResearchSelection,
  evidence: CompanyReportEvidence,
  watchlist: ResearchWatchlistState,
): string | null {
  if (!watchlist.canEdit && !watchlist.canAdd)
    return (
      watchlist.reason ??
      "Load and review your watchlist draft before preparing this report."
    );
  const { member } = watchlist;
  if (member && !membershipMatchesResult(member, selection.listing))
    return "The watchlist note no longer matches this company.";
  const states = [evidence.price, evidence.annual, evidence.filings];
  if (
    states.some(
      (source) =>
        source &&
        (source.catalogChanged ||
          !companyEvidenceSelectionMatches(selection, source.selection)),
    )
  )
    return "Source evidence no longer matches this company.";
  if (states.some((source) => source?.running))
    return "Wait for source loads to finish before preparing this report.";
  if (!states.some((source) => source?.response))
    return "Load at least one company source before preparing this report.";
  return null;
}

export function prepareCompanyReport(
  selection: ManagedResearchSelection,
  evidence: CompanyReportEvidence,
  watchlist: ResearchWatchlistState,
  now: () => Date = () => new Date(),
): PreparedCompanyReport | null {
  if (companyReportBlock(selection, evidence, watchlist)) return null;
  return {
    kind: "loaded_company_research",
    preparedAt: now().toISOString(),
    selection,
    evidence: { ...evidence },
    note: watchlist.member?.note ?? null,
  };
}

/** Fresh state references fence replacements, cancellation, close and retirement. */
export function companyReportIsCurrent(
  report: PreparedCompanyReport,
  selection: ManagedResearchSelection,
  evidence: CompanyReportEvidence,
  watchlist: ResearchWatchlistState,
): boolean {
  return (
    report.selection === selection &&
    companyReportBlock(selection, evidence, watchlist) === null &&
    report.evidence.price === evidence.price &&
    report.evidence.annual === evidence.annual &&
    report.evidence.filings === evidence.filings &&
    report.note === (watchlist.member?.note ?? null)
  );
}
