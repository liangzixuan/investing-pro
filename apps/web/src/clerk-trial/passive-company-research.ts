import { MANAGED_SEC_FILINGS_LIMITS } from "@research-cockpit/contracts";
import type {
  CompanyReportEvidence,
  PreparedCompanyReport,
} from "./managed-company-report";
import {
  COMPANY_REPORT_DOCUMENT_MAX_BYTES,
  formatCompanyReportDocument,
} from "./managed-company-report-document";
import type { ManagedResearchSelection } from "./managed-research-selection";

export type CompanyResearchSide = "left" | "right";
/** Detached reading data: calculations here have no registered editor authority. */
export interface PassiveCompanyResearchCapture {
  readonly kind: "passive_company_research";
  readonly side: CompanyResearchSide;
  readonly capturedAt: string;
  readonly selection: ManagedResearchSelection;
  readonly note: string | null;
  readonly evidence: CompanyReportEvidence;
  readonly valuation: PreparedCompanyReport["valuation"];
  readonly evaluatedAt: string | null;
  readonly valuationPrice: PreparedCompanyReport["valuationPrice"];
  readonly priceStudies: PreparedCompanyReport["priceStudies"];
  readonly document: Readonly<{ text: string; byteLength: number }>;
}
// The existing bounded document plus its full passive projection and a separate
// Filings lastCheck/comparison must fit together. Nothing is truncated.
export const PASSIVE_COMPANY_RESEARCH_MAX_BYTES =
  2 * COMPANY_REPORT_DOCUMENT_MAX_BYTES +
  2 * MANAGED_SEC_FILINGS_LIMITS.responseBytes +
  32_768;
function frozen<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}
export function createPassiveCompanyResearchCapture(
  report: PreparedCompanyReport,
  side: CompanyResearchSide,
  evaluatedAt: string | null,
): PassiveCompanyResearchCapture | null {
  const document = formatCompanyReportDocument(report);
  if (!document) return null;
  const value: PassiveCompanyResearchCapture = {
    kind: "passive_company_research",
    side,
    capturedAt: report.preparedAt,
    selection: report.selection,
    note: report.note,
    evidence: report.evidence,
    valuation: report.valuation,
    evaluatedAt,
    valuationPrice: report.valuationPrice,
    priceStudies: report.priceStudies,
    document: { text: document.text, byteLength: document.byteLength },
  };
  if (
    new TextEncoder().encode(JSON.stringify(value)).byteLength >
    PASSIVE_COMPANY_RESEARCH_MAX_BYTES
  )
    return null;
  return frozen(structuredClone(value));
}
