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

function selectedTarget(
  candidates: readonly Filing[],
  cutoffAt: string,
): Target {
  const first = candidates[0];
  if (!first) return unresolved("no_observed_interim_target");
  if (first.reportDate! > first.filedDate!)
    return unresolved("future_or_inconsistent_dates");
  if (first.acceptedAt === null && first.filedDate === cutoffAt.slice(0, 10))
    return unresolved("cutoff_time_unresolved");
  if (
    first.acceptedAt !== null &&
    first.acceptedAt.slice(0, 10) < first.reportDate!
  )
    return unresolved("future_or_inconsistent_dates");
  if (
    candidates.some(
      (row) => row.reportDate === first.reportDate && row.form === "10-Q/A",
    )
  )
    return unresolved("amendment_not_supported");
  if (
    candidates.filter(
      (row) =>
        row.reportDate === first.reportDate &&
        row.filedDate === first.filedDate,
    ).length !== 1
  )
    return unresolved("target_ambiguous");
  return Object.freeze({
    status: "target",
    accessionNumber: first.accessionNumber,
    form: "10-Q",
    filedDate: first.filedDate!,
    reportDate: first.reportDate!,
    acceptedAt: first.acceptedAt,
  });
}

/** Select complete metadata before values. No fallback behind amendments or a failed target. */
export function selectPersonalSecInterimTarget(
  value: readonly Filing[] | null,
  cutoffAt: string,
  fetchedAt: string,
): Target {
  if (value === null) return unresolved("submissions_unavailable");
  if (!timestamp(cutoffAt) || !timestamp(fetchedAt) || fetchedAt < cutoffAt)
    return unresolved("invalid_clock");
  try {
    const interim = filings(value).filter(
      (row) => row.form === "10-Q" || row.form === "10-Q/A",
    );
    if (interim.some((row) => row.filedDate === null))
      return unresolved("filed_date_missing");
    const observed = interim.filter(
      (row) =>
        row.filedDate! <= cutoffAt.slice(0, 10) &&
        (row.acceptedAt === null ||
          Date.parse(row.acceptedAt) <= Date.parse(cutoffAt)),
    );
    if (observed.some((row) => row.reportDate === null))
      return unresolved("target_missing_report_date");
    observed.sort(
      (left, right) =>
        lexical(right.reportDate!, left.reportDate!) ||
        lexical(right.filedDate!, left.filedDate!),
    );
    return selectedTarget(observed, cutoffAt);
  } catch {
    return unresolved("invalid_submissions");
  }
}
