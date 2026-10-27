import { isOwnedSecInterimCanonicalResponse } from "../lib/sec-interim-canonical-response";
import { getManagedInterimView } from "./managed-interim-view";
import { isOwnedSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";
import { getManagedAnnualView } from "./managed-annual-view";
import {
  resolveManagedPriceStudies,
  type ManagedPriceStudies,
} from "./managed-price-studies";
import {
  membershipMatchesResult,
  parseManagedEodHistoryResponse,
} from "@research-cockpit/contracts";
import type { ResearchWatchlistState } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedValuationCalculation } from "./managed-valuation-workbench";
import {
  resolveManagedValuationPrice,
  managedValuationPriceContextIsOwned,
  type ManagedValuationPriceContext,
} from "./managed-valuation-price";
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
  readonly watchlistRevision: symbol | undefined;
  readonly valuation: ManagedValuationCalculation | null;
  readonly valuationPrice: ManagedValuationPriceContext | null;
  readonly priceStudies: ManagedPriceStudies | null;
}

export function companyReportBlock(
  selection: ManagedResearchSelection,
  evidence: CompanyReportEvidence,
  watchlist: ResearchWatchlistState,
  valuation: ManagedValuationCalculation | null = null,
): string | null {
  if (!watchlist.canEdit && !watchlist.canAdd)
    return (
      watchlist.reason ??
      "Load and review your watchlist draft before preparing this report."
    );
  const { member } = watchlist;
  if (
    valuation &&
    (valuation.owner.catalogSnapshotSha256 !==
      selection.catalogSnapshotSha256 ||
      valuation.owner.cik !== selection.cik ||
      !membershipMatchesResult(
        { ...valuation.owner.listing, note: "" },
        selection.listing,
      ))
  )
    return "Valuation inputs no longer match this company.";
  if (member && !membershipMatchesResult(member, selection.listing))
    return "The watchlist note no longer matches this company.";
  const states = [
    evidence.price,
    evidence.annual,
    evidence.interim,
    evidence.filings,
  ];
  if (
    states.some(
      (source) =>
        source &&
        (source.catalogChanged ||
          !companyEvidenceSelectionMatches(selection, source.selection)),
    )
  )
    return "Source evidence no longer matches this company.";
  if (states.some((source) => source?.running) || evidence.annual?.checkingSeed)
    return "Wait for source loads to finish before preparing this report.";
  const canonicalProblem = canonicalReportProblem(evidence);
  if (canonicalProblem) return canonicalProblem;
  if (!companyReportPriceEvidenceIsOwned(selection, evidence.price))
    return "Price results no longer match their admitted company source.";
  if (!valuation && !states.some((source) => source?.response))
    return "Load at least one company source or calculate authored valuation assumptions before preparing this report.";
  return null;
}

function canonicalReportProblem(evidence: CompanyReportEvidence) {
  if (!companyReportInterimEvidenceIsOwned(evidence.interim))
    return "Interim results no longer match their admitted source.";
  if (!companyReportAnnualEvidenceIsOwned(evidence.annual))
    return "Annual results no longer match their admitted source.";
  return null;
}

export function prepareCompanyReport(
  selection: ManagedResearchSelection,
  evidence: CompanyReportEvidence,
  watchlist: ResearchWatchlistState,
  now: () => Date = () => new Date(),
  valuation: ManagedValuationCalculation | null = null,
): PreparedCompanyReport | null {
  if (companyReportBlock(selection, evidence, watchlist, valuation))
    return null;
  const valuationPrice = resolveManagedValuationPrice(
    selection,
    valuation,
    evidence.price,
  );
  if (valuation !== null && valuationPrice === null) return null;
  return {
    kind: "loaded_company_research",
    preparedAt: now().toISOString(),
    selection,
    evidence: { ...evidence },
    note: watchlist.member?.note ?? null,
    watchlistRevision: watchlist.revision,
    valuation,
    valuationPrice,
    priceStudies: evidence.price?.response
      ? resolveManagedPriceStudies(evidence.price.response)
      : null,
  };
}

/** Fresh state references fence replacements, cancellation, close and retirement. */
export function companyReportIsCurrent(
  report: PreparedCompanyReport,
  selection: ManagedResearchSelection,
  evidence: CompanyReportEvidence,
  watchlist: ResearchWatchlistState,
  valuation: ManagedValuationCalculation | null = null,
): boolean {
  return (
    report.selection === selection &&
    companyReportBlock(selection, evidence, watchlist, valuation) === null &&
    report.valuation === valuation &&
    companyReportValuationPriceIsOwned(report) &&
    companyReportPriceStudiesIsOwned(report) &&
    report.evidence.price === evidence.price &&
    report.evidence.annual === evidence.annual &&
    report.evidence.interim === evidence.interim &&
    report.evidence.filings === evidence.filings &&
    report.note === (watchlist.member?.note ?? null) &&
    report.watchlistRevision === watchlist.revision
  );
}

/** The comparison belongs to this exact model capture and admitted source state. */
export function companyReportValuationPriceIsOwned(
  report: PreparedCompanyReport,
): boolean {
  try {
    if (report.valuation === null) return report.valuationPrice === null;
    return (
      report.valuationPrice !== null &&
      managedValuationPriceContextIsOwned(
        report.valuationPrice,
        report.selection,
        report.valuation,
        report.evidence.price,
      )
    );
  } catch {
    return false;
  }
}

/** Match captured calculations to the exact validated raw source and formula result. */
export function companyReportPriceStudiesIsOwned(
  report: PreparedCompanyReport,
): boolean {
  try {
    if (
      !companyReportPriceEvidenceIsOwned(
        report.selection,
        report.evidence.price,
      )
    )
      return false;
    const response = report.evidence.price?.response;
    return (
      report.priceStudies ===
      (response ? resolveManagedPriceStudies(response) : null)
    );
  } catch {
    return false;
  }
}

function companyReportPriceEvidenceIsOwned(
  selection: ManagedResearchSelection,
  source: CompanyReportEvidence["price"],
): boolean {
  if (!source) return true;
  if (source.response === null) return true;
  try {
    if (!companyEvidenceSelectionMatches(selection, source.selection))
      return false;
    const admitted = parseManagedEodHistoryResponse(source.response, {
      catalogSnapshotSha256: selection.catalogSnapshotSha256,
      listingId: selection.listing.listingId,
      range: source.response.range,
    });
    return (
      admitted !== null &&
      membershipMatchesResult(
        { ...selection.listing, note: "" },
        admitted.security,
      )
    );
  } catch {
    return false;
  }
}

/** Require the decoder-owned canonical graph and its exact cached derived view. */
export function companyReportAnnualEvidenceIsOwned(
  source: CompanyReportEvidence["annual"],
): boolean {
  if (!source) return true;
  if (source.response === null) return source.view === null;
  if (
    source.view === null ||
    !isOwnedSecAnnualCanonicalResponse(source.response) ||
    source.view.canonical !== source.response.evidence ||
    getManagedAnnualView(source.response) !== source.view ||
    source.selection === null
  )
    return false;
  const { security, catalogSnapshotSha256 } = source.response;
  const { listing, cik } = source.selection;
  return (
    catalogSnapshotSha256 === source.selection.catalogSnapshotSha256 &&
    (cik === null || security.cik === cik) &&
    security.listingId === listing.listingId &&
    security.symbol === listing.symbol &&
    security.issuerId === listing.issuerId &&
    security.issuerName === listing.issuerName &&
    security.securityName === listing.securityName &&
    security.country === listing.country &&
    security.exchangeMic === listing.exchangeMic
  );
}

/** Require the decoder-owned canonical graph and its exact cached derived view. */
export function companyReportInterimEvidenceIsOwned(
  source: CompanyReportEvidence["interim"],
): boolean {
  if (!source) return true;
  if (source.response === null) return source.view === null;
  if (source.view === null || source.selection === null) return false;
  if (!isOwnedSecInterimCanonicalResponse(source.response)) return false;
  if (source.view.canonical !== source.response.evidence) return false;
  if (getManagedInterimView(source.response) !== source.view) return false;
  return interimReportIdentityMatches(source.response, source.selection);
}
function interimReportIdentityMatches(
  response: NonNullable<
    NonNullable<CompanyReportEvidence["interim"]>["response"]
  >,
  selection: ManagedResearchSelection,
) {
  if (response.catalogSnapshotSha256 !== selection.catalogSnapshotSha256)
    return false;
  if (selection.cik !== null && response.security.cik !== selection.cik)
    return false;
  const fields = [
    "listingId",
    "symbol",
    "issuerId",
    "issuerName",
    "securityName",
    "country",
    "exchangeMic",
  ] as const;
  return fields.every(
    (key) => response.security[key] === selection.listing[key],
  );
}
