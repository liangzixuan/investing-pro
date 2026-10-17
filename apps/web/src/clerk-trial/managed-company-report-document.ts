import {
  MANAGED_EOD_HISTORY_LIMITS,
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  MANAGED_SEC_FILINGS_LIMITS,
} from "@research-cockpit/contracts";
import {
  companyReportAnnualEvidenceIsOwned,
  companyReportPriceStudiesIsOwned,
  type PreparedCompanyReport,
} from "./managed-company-report";

// Fixed whole-document ceiling: canonical sources, explicit resolved references,
// authored inputs and document framing must fit together or the whole output fails.
export const COMPANY_REPORT_VALUATION_MAX_BYTES = 131_072;
export const COMPANY_REPORT_DOCUMENT_MAX_BYTES =
  MANAGED_EOD_HISTORY_LIMITS.responseBytes +
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes +
  MANAGED_SEC_FILINGS_LIMITS.responseBytes +
  32_768 +
  COMPANY_REPORT_VALUATION_MAX_BYTES;
const NOTE_JSON_MAX_BYTES = 16_384;
const encoder = new TextEncoder();

export interface CompanyReportDocument {
  readonly purpose: "investment.company-research";
  readonly filename: string;
  readonly text: string;
  readonly byteLength: number;
}

function filename(
  symbol: unknown,
  mic: unknown,
  preparedAt: unknown,
): string | null {
  if (
    typeof symbol !== "string" ||
    !/^[A-Z0-9][A-Z0-9.-]{0,14}$/u.test(symbol) ||
    typeof mic !== "string" ||
    !/^[A-Z0-9]{4}$/u.test(mic) ||
    typeof preparedAt !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(preparedAt) ||
    !Number.isFinite(Date.parse(preparedAt)) ||
    new Date(preparedAt).toISOString() !== preparedAt
  )
    return null;
  return `Investment-research-${symbol}-${mic}-${preparedAt.replace(/[-:.]/gu, "")}.json`;
}

/** File handoff boundary, not a report-import or financial-admission API. */
export function isCompanyReportDocument(
  value: unknown,
): value is CompanyReportDocument {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== 4
    )
      return false;
    const keys = ["purpose", "filename", "text", "byteLength"] as const;
    const fields = Object.fromEntries(
      keys.map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
          throw new Error();
        return [key, descriptor.value as unknown];
      }),
    );
    if (
      fields.purpose !== "investment.company-research" ||
      typeof fields.text !== "string" ||
      fields.text.length === 0 ||
      fields.text.length > COMPANY_REPORT_DOCUMENT_MAX_BYTES ||
      /\p{Cs}/u.test(fields.text) ||
      !Number.isSafeInteger(fields.byteLength) ||
      (fields.byteLength as number) > COMPANY_REPORT_DOCUMENT_MAX_BYTES ||
      encoder.encode(fields.text).byteLength !== fields.byteLength
    )
      return false;
    const parsed: unknown = JSON.parse(fields.text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return false;
    const data = parsed as Record<string, unknown>;
    if (
      data.purpose !== fields.purpose ||
      data.schemaVersion !== "4.0.0" ||
      !data.listing ||
      typeof data.listing !== "object" ||
      Array.isArray(data.listing)
    )
      return false;
    const listing = data.listing as Record<string, unknown>;
    const expected = filename(
      listing.symbol,
      listing.exchangeMic,
      data.preparedAt,
    );
    return expected !== null && fields.filename === expected;
  } catch {
    return false;
  }
}

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

function annualDocument(state: PreparedCompanyReport["evidence"]["annual"]) {
  const source = sourceDocument(state);
  if (!state?.response || !state.view) return source;
  const view = state.view;
  return {
    ...source,
    statements: view.statements,
    financials: {
      income: {
        resolution: view.income.resolution,
        reason: view.income.reason,
        bases: view.income.bases,
      },
      cashGeneration: {
        resolution: view.cashGeneration.resolution,
        history: view.cashGeneration.history,
      },
      liquidity: {
        resolution: view.liquidity.resolution,
        history: view.liquidity.history,
      },
      operatingResults: {
        resolution: view.operatingResults.resolution,
        bases: view.operatingResults.bases,
      },
      balanceSheet: {
        resolution: view.balanceSheet.resolution,
        history: view.balanceSheet.history,
        change: view.balanceSheet.change,
      },
      cashMargins: view.cashMargins,
      financialReview: view.financialReview,
    },
  };
}

/** Only a current model-admitted preview may supply this document. No I/O. */
export function formatCompanyReportDocument(
  report: PreparedCompanyReport,
): CompanyReportDocument | null {
  if (
    report.kind !== "loaded_company_research" ||
    !companyReportAnnualEvidenceIsOwned(report.evidence.annual) ||
    !companyReportPriceStudiesIsOwned(report)
  )
    return null;
  const noteJson = JSON.stringify(report.note);
  const valuation = report.valuation ?? null;
  if (
    encoder.encode(JSON.stringify(valuation)).byteLength >
    COMPANY_REPORT_VALUATION_MAX_BYTES
  )
    return null;
  if (
    encoder.encode(noteJson).byteLength > NOTE_JSON_MAX_BYTES ||
    (report.note !== null && /\p{Cs}/u.test(report.note))
  )
    return null;
  const { listing } = report.selection;
  const name = filename(listing.symbol, listing.exchangeMic, report.preparedAt);
  if (!name) return null;
  const document = {
    purpose: "investment.company-research",
    schemaVersion: "4.0.0",
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
        "Original periods, revenue bases, validation and unavailable source values are retained. Authored valuation calculations are separate from source evidence.",
      valuation:
        "Explicit authored USD assumptions, model versions, results and independent sensitivity refusals. Inputs are not verified reported facts or investment recommendations; source dates are not valuation dates.",
      authoredResearch:
        "The draft's claims and links are not verified; this document does not establish that it is saved.",
      retention:
        "No automatic download, server-side saved report, backup or restore. Explicitly downloaded copies remain at the chosen destination and do not update with later edits.",
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
    valuation,
    sources: {
      price: report.evidence.price?.response
        ? {
            ...sourceDocument(report.evidence.price),
            studies: report.priceStudies
              ? {
                  status: "available",
                  scope:
                    "Descriptive raw unadjusted close calculations over observed dates; no filled gaps, total-return, forecast or recommendation claim.",
                  calculation: report.priceStudies.calculation,
                }
              : { status: "unavailable", reason: "unsupported_price_values" },
          }
        : sourceDocument(report.evidence.price),
      annual: annualDocument(report.evidence.annual),
      filings: sourceDocument(report.evidence.filings),
    },
  };
  const text = `${JSON.stringify(document)}\n`;
  const byteLength = encoder.encode(text).byteLength;
  if (byteLength > COMPANY_REPORT_DOCUMENT_MAX_BYTES) return null;
  return Object.freeze({
    purpose: "investment.company-research",
    filename: name,
    text,
    byteLength,
  });
}
