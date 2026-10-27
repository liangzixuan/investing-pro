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

function targetDateReason(first: Filing, cutoffAt: string): Reason | null {
  if (first.reportDate! > first.filedDate!)
    return "future_or_inconsistent_dates";
  if (first.acceptedAt === null) {
    return first.filedDate === cutoffAt.slice(0, 10)
      ? "cutoff_time_unresolved"
      : null;
  }
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
  cutoffAt: string,
): Target {
  const first = candidates[0];
  if (!first) return unresolved("no_observed_interim_target");
  const reason =
    targetDateReason(first, cutoffAt) ?? selectionReason(candidates, first);
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
function validRetrievalClock(cutoffAt: string, fetchedAt: string): boolean {
  if (!timestamp(cutoffAt)) return false;
  if (!timestamp(fetchedAt)) return false;
  return fetchedAt >= cutoffAt;
}
function observedAtCutoff(row: Filing, cutoffAt: string): boolean {
  if (row.filedDate! > cutoffAt.slice(0, 10)) return false;
  if (row.acceptedAt === null) return true;
  return Date.parse(row.acceptedAt) <= Date.parse(cutoffAt);
}
function selectObservedTarget(
  interim: readonly Filing[],
  cutoffAt: string,
): Target {
  if (interim.some((row) => row.filedDate === null))
    return unresolved("filed_date_missing");
  const observed = interim.filter((row) => observedAtCutoff(row, cutoffAt));
  if (observed.some((row) => row.reportDate === null))
    return unresolved("target_missing_report_date");
  observed.sort(
    (left, right) =>
      lexical(right.reportDate!, left.reportDate!) ||
      lexical(right.filedDate!, left.filedDate!),
  );
  return selectedTarget(observed, cutoffAt);
}

/** Select complete metadata before values. No fallback behind amendments or a failed target. */
export function selectPersonalSecInterimTarget(
  value: readonly Filing[] | null,
  cutoffAt: string,
  fetchedAt: string,
): Target {
  if (value === null) return unresolved("submissions_unavailable");
  if (!validRetrievalClock(cutoffAt, fetchedAt))
    return unresolved("invalid_clock");
  try {
    const interim = filings(value).filter(
      (row) => row.form === "10-Q" || row.form === "10-Q/A",
    );
    return selectObservedTarget(interim, cutoffAt);
  } catch {
    return unresolved("invalid_submissions");
  }
}
