import {
  MANAGED_SEC_FILINGS_LIMITS,
  membershipMatchesResult,
  parseManagedEodHistoryResponse,
  parseManagedSecFilingsResponse,
  type ResearchFollowup,
} from "@research-cockpit/contracts";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import {
  companyReportAnnualEvidenceIsOwned,
  companyReportInterimEvidenceIsOwned,
  type CompanyReportEvidence,
} from "./managed-company-report";
import { COMPANY_REPORT_DOCUMENT_MAX_BYTES } from "./managed-company-report-document";
import type { ManagedCompanySourcePassState } from "./managed-company-source-pass-state";
import type { ManagedResearchSelection } from "./managed-research-selection";

/** Detached data only. It grants no source, editor, calculation or save action. */
export interface PassiveFollowupEvidenceReading {
  readonly kind: "followup_source_reading";
  readonly capturedAt: string;
  readonly check: ResearchFollowup;
  readonly selection: ManagedResearchSelection;
  readonly evidence: CompanyReportEvidence;
  readonly sourcePass: ManagedCompanySourcePassState;
}
// Include complete canonical views and Filings lastCheck/refreshComparison, never clip.
export const FOLLOWUP_EVIDENCE_MAX_BYTES =
  2 * COMPANY_REPORT_DOCUMENT_MAX_BYTES +
  2 * MANAGED_SEC_FILINGS_LIMITS.responseBytes +
  32_768;

export function followupEvidenceSelectionMatches(
  entry: ResearchFollowup,
  selection: ManagedResearchSelection,
) {
  return (
    selection.origin === "followups" &&
    selection.catalogSnapshotSha256 === entry.catalogSnapshotSha256 &&
    membershipMatchesResult({ ...entry.listing, note: "" }, selection.listing)
  );
}
function packetsMatch(
  selection: ManagedResearchSelection,
  e: CompanyReportEvidence,
) {
  if (!companyReportAnnualEvidenceIsOwned(e.annual)) return false;
  if (!companyReportInterimEvidenceIsOwned(e.interim)) return false;
  if (e.price?.response) {
    const response = parseManagedEodHistoryResponse(e.price.response, {
      catalogSnapshotSha256: selection.catalogSnapshotSha256,
      listingId: selection.listing.listingId,
      range: e.price.response.range,
    });
    if (
      !response ||
      !membershipMatchesResult(
        { ...selection.listing, note: "" },
        response.security,
      )
    )
      return false;
  }
  for (const packet of [e.filings?.response, e.filings?.lastCheck]) {
    if (!packet) continue;
    const response = parseManagedSecFilingsResponse(packet, {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: selection.catalogSnapshotSha256,
      listingId: selection.listing.listingId,
      symbol: selection.listing.symbol,
    });
    if (
      !response ||
      !membershipMatchesResult(
        { ...selection.listing, note: "" },
        response.security,
      )
    )
      return false;
    if (selection.cik !== null && response.security.cik !== selection.cik)
      return false;
  }
  return true;
}
export function followupEvidenceBlock(
  selection: ManagedResearchSelection,
  evidence: CompanyReportEvidence,
  pass: ManagedCompanySourcePassState,
): string | null {
  const sources = [
    evidence.price,
    evidence.annual,
    evidence.interim,
    evidence.filings,
  ];
  if (!sources.some(Boolean))
    return "Open the current check's company sources before retaining evidence.";
  if (
    sources.some((s) => s?.running) ||
    evidence.annual?.checkingSeed ||
    pass.phase === "running" ||
    pass.phase === "preview"
  )
    return "Finish or cancel the source pass before retaining this reading.";
  if (
    sources.some(
      (s) =>
        s &&
        (s.catalogChanged ||
          !companyEvidenceSelectionMatches(selection, s.selection)),
    )
  )
    return "Source evidence no longer belongs to this exact company visit.";
  if (
    pass.preview &&
    !companyEvidenceSelectionMatches(selection, pass.preview.selection)
  )
    return "The source pass belongs to another company.";
  try {
    if (!packetsMatch(selection, evidence))
      return "A source packet no longer matches its admitted evidence.";
  } catch {
    return "A source packet no longer matches its admitted evidence.";
  }
  return null;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export function detachFollowupEvidence(
  check: ResearchFollowup,
  selection: ManagedResearchSelection,
  evidence: CompanyReportEvidence,
  sourcePass: ManagedCompanySourcePassState,
  capturedAt: string,
): PassiveFollowupEvidenceReading | null {
  if (
    !followupEvidenceSelectionMatches(check, selection) ||
    followupEvidenceBlock(selection, evidence, sourcePass)
  )
    return null;
  if (
    !Number.isFinite(Date.parse(capturedAt)) ||
    new Date(capturedAt).toISOString() !== capturedAt
  )
    return null;
  try {
    const reading: PassiveFollowupEvidenceReading = {
      kind: "followup_source_reading",
      capturedAt,
      check,
      selection,
      evidence,
      sourcePass,
    };
    // structuredClone rejects action-bearing callbacks/symbols; JSON bounds the whole reading.
    const copy = structuredClone(reading);
    if (
      new TextEncoder().encode(JSON.stringify(copy)).byteLength >
      FOLLOWUP_EVIDENCE_MAX_BYTES
    )
      return null;
    return freeze(copy);
  } catch {
    return null;
  }
}
