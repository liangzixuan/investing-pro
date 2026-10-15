import {
  MANAGED_EOD_HISTORY_LIMITS,
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  MANAGED_SEC_FILINGS_LIMITS,
} from "@research-cockpit/contracts";
import type { PreparedCompanyReport } from "./managed-company-report";

// Compact source JSON stays within each admitted response bound. The extra
// allowance covers selection, a bounded authored note and document framing.
export const COMPANY_REPORT_DOCUMENT_MAX_BYTES =
  MANAGED_EOD_HISTORY_LIMITS.responseBytes +
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes +
  MANAGED_SEC_FILINGS_LIMITS.responseBytes +
  32_768;
const NOTE_JSON_MAX_BYTES = 16_384;
const encoder = new TextEncoder();

type EvidenceState = NonNullable<
  PreparedCompanyReport["evidence"][keyof PreparedCompanyReport["evidence"]]
>;

function sourceDocument(state: EvidenceState | null) {
  if (!state?.response)
    return {
      status: "not_loaded" as const,
      lastAttemptFailed: state?.error ?? false,
    };
  return {
    status: "loaded" as const,
    retainedPrevious: state.showingPrevious,
    lastAttemptFailed: state.error,
    responseOrigin: state.responseOrigin,
    response: state.response,
  };
}

/** Only a current model-admitted preview may supply this document. No I/O. */
export function formatCompanyReportDocument(report: PreparedCompanyReport): {
  readonly text: string;
  readonly byteLength: number;
} | null {
  if (report.kind !== "loaded_company_research") return null;
  const noteJson = JSON.stringify(report.note);
  if (
    encoder.encode(noteJson).byteLength > NOTE_JSON_MAX_BYTES ||
    (report.note !== null && /\p{Cs}/u.test(report.note))
  )
    return null;
  const { listing } = report.selection;
  const document = {
    purpose: "investment.company-research",
    schemaVersion: "1.0.0",
    preparedAt: report.preparedAt,
    scope: {
      sourceEvidence:
        "Loaded admitted responses only; not complete issuer history.",
      sourceDates:
        "Preparation does not renew source dates or current-use eligibility.",
      retainedPrevious:
        "A retained previous response was not confirmed by the latest attempt; its original dates still apply.",
      priceBasis: "Raw USD closes, unadjusted for splits or dividends.",
      financials:
        "Original periods, revenue bases, validation and unavailable values are retained. No new calculation.",
      authoredResearch:
        "The draft's claims and links are not verified; this document does not establish that it is saved.",
      retention:
        "Visit-owned inspection only. No automatic download, saved report, backup or restore.",
    },
    catalogSnapshotSha256: report.selection.catalogSnapshotSha256,
    selectionCik: report.selection.cik,
    listing: {
      listingId: listing.listingId,
      symbol: listing.symbol,
      country: listing.country,
      exchangeMic: listing.exchangeMic,
      instrumentType: listing.instrumentType,
      issuerId: listing.issuerId,
      issuerName: listing.issuerName,
      securityId: listing.securityId,
      securityName: listing.securityName,
      shareClassId: listing.shareClassId,
      shareClassName: listing.shareClassName,
    },
    authoredResearch: {
      status: report.note === null ? "not_in_watchlist" : "watchlist_draft",
      note: report.note,
    },
    sources: {
      price: sourceDocument(report.evidence.price),
      annual: sourceDocument(report.evidence.annual),
      filings: sourceDocument(report.evidence.filings),
    },
  };
  const text = `${JSON.stringify(document)}\n`;
  const byteLength = encoder.encode(text).byteLength;
  if (byteLength > COMPANY_REPORT_DOCUMENT_MAX_BYTES) return null;
  return Object.freeze({ text, byteLength });
}
