import {
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  type PersonalSecInterimFilingDto as Filing,
  type PersonalSecInterimTargetDto as Target,
  type PersonalSecInterimTargetReason as Reason,
} from "@research-cockpit/contracts";
import {
  array,
  record,
  check,
  matches,
  date,
  timestamp,
  form,
  lexical,
} from "./personal-sec-interim-validation";

function filings(value: unknown): readonly Filing[] {
  const entries = array(
    value,
    PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.submissionRows,
  );
  const seen = new Set<string>();
  for (const candidate of entries) {
    const row = record(candidate, [
      "accessionNumber",
      "form",
      "filedDate",
      "reportDate",
      "acceptedAt",
    ]);
    check(matches(row.accessionNumber, /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u));
    check(!seen.has(row.accessionNumber) && form(row.form));
    seen.add(row.accessionNumber);
    check(row.filedDate === null || date(row.filedDate));
    check(row.reportDate === null || date(row.reportDate));
    check(row.acceptedAt === null || timestamp(row.acceptedAt, false));
  }
  return entries as readonly Filing[];
}
const unresolved = (reason: Reason): Target =>
  Object.freeze({ status: "unresolved", reason });

interface RetrievalWindow {
  readonly cutoffAt: string;
  readonly fetchedAt: string;
}
interface ObservedCutoff {
  readonly dateUtc: string;
  readonly epochMilliseconds: number;
}
/** Missing acceptance time cannot establish observation within the cutoff day. */
function unknownAcceptanceReason(
  first: Filing,
  cutoff: ObservedCutoff,
): Reason | null {
  return first.filedDate === cutoff.dateUtc ? "cutoff_time_unresolved" : null;
}
function targetDateReason(
  first: Filing,
  cutoff: ObservedCutoff,
): Reason | null {
  if (first.reportDate! > first.filedDate!)
    return "future_or_inconsistent_dates";
  if (first.acceptedAt === null) return unknownAcceptanceReason(first, cutoff);
  return first.acceptedAt.slice(0, 10) < first.reportDate!
    ? "future_or_inconsistent_dates"
    : null;
}
function selectionReason(
  candidates: readonly Filing[],
  first: Filing,
): Reason | null {
  if (
    candidates.some(
      (row) => row.reportDate === first.reportDate && row.form === "10-Q/A",
    )
  )
    return "amendment_not_supported";
  if (
    candidates.filter(
      (row) =>
        row.reportDate === first.reportDate &&
        row.filedDate === first.filedDate,
    ).length !== 1
  )
    return "target_ambiguous";
  return null;
}
function selectedTarget(
  candidates: readonly Filing[],
  cutoff: ObservedCutoff,
): Target {
  const first = candidates[0];
  if (!first) return unresolved("no_observed_interim_target");
  const reason =
    targetDateReason(first, cutoff) ?? selectionReason(candidates, first);
  if (reason) return unresolved(reason);
  return Object.freeze({
    status: "target",
    accessionNumber: first.accessionNumber,
    form: "10-Q",
    filedDate: first.filedDate!,
    reportDate: first.reportDate!,
    acceptedAt: first.acceptedAt,
  });
}
function validRetrievalClock(window: RetrievalWindow): boolean {
  if (!timestamp(window.cutoffAt)) return false;
  if (!timestamp(window.fetchedAt)) return false;
  return window.fetchedAt >= window.cutoffAt;
}
function observedAtCutoff(row: Filing, cutoff: ObservedCutoff): boolean {
  if (row.filedDate! > cutoff.dateUtc) return false;
  if (row.acceptedAt === null) return true;
  return Date.parse(row.acceptedAt) <= cutoff.epochMilliseconds;
}
function selectObservedTarget(
  interim: readonly Filing[],
  cutoff: ObservedCutoff,
): Target {
  if (interim.some((row) => row.filedDate === null))
    return unresolved("filed_date_missing");
  const observed = interim.filter((row) => observedAtCutoff(row, cutoff));
  if (observed.some((row) => row.reportDate === null))
    return unresolved("target_missing_report_date");
  observed.sort(
    (left, right) =>
      lexical(right.reportDate!, left.reportDate!) ||
      lexical(right.filedDate!, left.filedDate!),
  );
  return selectedTarget(observed, cutoff);
}

/** Select complete metadata before values. No fallback behind amendments or a failed target. */
export function selectPersonalSecInterimTarget(
  value: readonly Filing[] | null,
  cutoffAt: string,
  fetchedAt: string,
): Target {
  if (value === null) return unresolved("submissions_unavailable");
  const retrieval: RetrievalWindow = { cutoffAt, fetchedAt };
  if (!validRetrievalClock(retrieval)) return unresolved("invalid_clock");
  try {
    const interim = filings(value).filter(
      (row) => row.form === "10-Q" || row.form === "10-Q/A",
    );
    const cutoff: ObservedCutoff = {
      dateUtc: cutoffAt.slice(0, 10),
      epochMilliseconds: Date.parse(cutoffAt),
    };
    return selectObservedTarget(interim, cutoff);
  } catch {
    return unresolved("invalid_submissions");
  }
}
