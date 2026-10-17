import { getManagedAnnualView } from "./managed-annual-view";
import {
  normalizeWatchlistNote,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import {
  type PersonalSecAnnualFinancialReviewKey,
  type PersonalSecAnnualFinancialReviewRow,
} from "@research-cockpit/personal-financial-analytics";

type Value = PersonalSecAnnualFinancialReviewRow["value"];
type Proposal = {
  note: string | null;
  excerpt: string | null;
  reason: string | null;
};

function describeValue(value: Value): string {
  const references = `observations [${value.observationIds.join(", ") || "none"}]`;
  if (value.status === "unavailable") {
    return `USD unavailable (${value.reason}); ${references}`;
  }
  const dates =
    "asOfDate" in value
      ? `as of ${value.asOfDate}`
      : `period ${value.startDate} to ${value.endDate}`;
  const policy = value.currentUseEligible
    ? "current use eligible"
    : "historical; current use ineligible";
  return `USD ${value.value}; ${dates}; accession ${value.accessionNumber}; ${references}; ${policy}`;
}

function describeRow(row: PersonalSecAnnualFinancialReviewRow): string {
  const sign = row.sign === null ? "" : ` (${row.sign})`;
  const result = `${row.label}${sign}: ${describeValue(row.value)}.`;
  if (row.key === "operatingCashFlowLessPpePurchases") {
    return `App calculation ${result} Operands: operating cash flow {${describeValue(row.operands.operatingCashFlow)}} less PP&E purchases {${describeValue(row.operands.ppePurchases)}}.`;
  }
  if (row.key === "workingCapital") {
    return `App calculation ${result} Operands: current assets {${describeValue(row.operands.currentAssets)}} less current liabilities {${describeValue(row.operands.currentLiabilities)}}.`;
  }
  return result;
}

function describeContext(
  response: PersonalSecAnnualCanonicalResponseDto,
): string {
  const { target, generation, cik } = response.evidence;
  const filing =
    target.status === "target"
      ? `Target ${target.form}; report date ${target.reportDate}; filed ${target.filedDate}; accepted ${target.acceptedAt ?? "unavailable"}; accession ${target.accessionNumber}; filing index https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm.`
      : `Target unresolved (${target.reason}); filing index unavailable.`;
  const { companyFacts, submissions } = generation.sources;
  return `${filing} Original load: cutoff ${generation.cutoffAt}; completed ${generation.completedAt}; Company Facts ${companyFacts.status}, captured ${companyFacts.fetchedAt ?? "unavailable"}; Submissions ${submissions.status}, captured ${submissions.fetchedAt ?? "unavailable"}; generation ${generation.sha256}.`;
}

/** Propose one complete note from already admitted evidence, without saving it. */
export function proposeFinancialReviewNote(
  note: string,
  response: PersonalSecAnnualCanonicalResponseDto,
  keys: readonly PersonalSecAnnualFinancialReviewKey[],
  showingPrevious: boolean,
): Proposal {
  const current = normalizeWatchlistNote(note);
  if (current === null) {
    return {
      note: null,
      excerpt: null,
      reason: "Correct the current note before adding this review.",
    };
  }
  const view = getManagedAnnualView(response);
  if (view === null)
    return {
      note: null,
      excerpt: null,
      reason: "Load a valid Annual report before adding financial checks.",
    };
  const selection = keys.length > 0 && keys.length <= 5 ? new Set(keys) : null;
  const rows =
    selection === null
      ? []
      : view.financialReview.filter((row) => selection.has(row.key));
  if (
    selection === null ||
    selection.size !== keys.length ||
    rows.length !== keys.length
  ) {
    return {
      note: null,
      excerpt: null,
      reason: "Select at least one financial check, with no duplicates.",
    };
  }
  const { security } = response;
  const excerpt =
    `Financial review: ${security.symbol} (${security.exchangeMic}), listing ${security.listingId}, CIK ${security.cik}. ${rows.map(describeRow).join(" ")} ${describeContext(response)}${showingPrevious ? " Retained previous report." : ""} No source refresh.`.normalize(
      "NFC",
    );
  if (current.endsWith(excerpt)) {
    return {
      note: null,
      excerpt,
      reason: "This financial review is already at the end of the note draft.",
    };
  }
  const proposed = note ? `${note} ${excerpt}` : excerpt;
  return normalizeWatchlistNote(proposed) === null
    ? {
        note: null,
        excerpt,
        reason:
          "The complete note must fit the existing single-line, 2,000-character limit. Shorten the note or select fewer checks before adding it.",
      }
    : { note: proposed, excerpt, reason: null };
}
