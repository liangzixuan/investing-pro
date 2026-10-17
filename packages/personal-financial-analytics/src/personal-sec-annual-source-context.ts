import type {
  PersonalSecAnnualFilingDto,
  PersonalSecAnnualGenerationDto,
  PersonalSecAnnualResolutionDto,
  PersonalSecAnnualTargetDto,
  PersonalSecAnnualTargetReason,
  PersonalSecAnnualPairReason,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
type Observation = PersonalSecQuarterlyObservationDto;
const DAY = 86_400_000;
function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new TypeError("Invalid annual SEC evidence input.");
}
function instant(value: string): number | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
  )
    return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) &&
    new Date(parsed).toISOString().replace(".000Z", "Z") ===
      value.replace(".000Z", "Z")
    ? parsed
    : null;
}
function day(value: string): number | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value)
    ? instant(`${value}T00:00:00Z`)
    : null;
}
function filingReason(
  filing: Omit<PersonalSecAnnualFilingDto, "accessionNumber">,
  cutoffAt: string,
  fetchedAt: string,
): PersonalSecAnnualTargetReason | null {
  if (filing.reportDate === null) return "report_date_missing";
  if (filing.filedDate === null) return "filed_date_missing";
  const cutoff = instant(cutoffAt),
    capture = instant(fetchedAt);
  if (cutoff === null || capture === null) return "invalid_clock";
  if (
    day(filing.reportDate) === null ||
    day(filing.filedDate) === null ||
    filing.reportDate > filing.filedDate ||
    filing.reportDate > cutoffAt.slice(0, 10) ||
    filing.filedDate > cutoffAt.slice(0, 10) ||
    filing.filedDate > fetchedAt.slice(0, 10)
  )
    return "future_or_inconsistent_dates";
  if (filing.acceptedAt !== null) {
    const accepted = instant(filing.acceptedAt);
    if (
      accepted === null ||
      accepted < Date.parse(`${filing.reportDate}T00:00:00Z`) ||
      accepted > cutoff ||
      accepted > capture
    )
      return "future_or_inconsistent_dates";
  } else if (filing.filedDate === cutoffAt.slice(0, 10))
    return "cutoff_time_unresolved";
  return null;
}

type AnnualSourceClock = Pick<
  PersonalSecAnnualGenerationDto,
  "cutoffAt" | "completedAt" | "sources"
>;

/** The caller owns contract-version admission before using this clock policy. */
export function getPersonalSecAnnualSourceClockReason(
  generation: AnnualSourceClock,
): "invalid_clock" | "source_unavailable" | null {
  const cutoff = instant(generation.cutoffAt),
    completed = instant(generation.completedAt);
  if (cutoff === null || completed === null || completed < cutoff)
    return "invalid_clock";
  const sources = [
    generation.sources.companyFacts,
    generation.sources.submissions,
  ];
  if (sources.some((s) => s.status !== "available"))
    return "source_unavailable";
  const captures = sources.map((s) =>
    s.fetchedAt === null ? null : instant(s.fetchedAt),
  );
  if (
    captures.some((time) => time === null || time < cutoff || time > completed)
  )
    return "invalid_clock";
  return null;
}

/** Source/report ages after the caller admits its protocol definition version. */
export function getPersonalSecAnnualSourceUtilityAge(
  generation: AnnualSourceClock,
  target: PersonalSecAnnualTargetDto,
): PersonalSecAnnualResolutionDto["utilityAge"] {
  if (
    getPersonalSecAnnualSourceClockReason(generation) !== null ||
    target.status !== "target" ||
    day(target.reportDate) === null
  )
    return null;
  const endAgeDays =
    (day(generation.cutoffAt.slice(0, 10))! - day(target.reportDate)!) / DAY;
  const sourceAgeDays: [number, number] = [
    generation.sources.companyFacts,
    generation.sources.submissions,
  ].map(
    (source) =>
      (instant(generation.completedAt)! - instant(source.fetchedAt!)!) / DAY,
  ) as [number, number];
  return {
    endAgeDays,
    sourceAgeDays,
    withinWindow:
      endAgeDays >= 0 &&
      endAgeDays <= 485 &&
      sourceAgeDays.every((age) => age >= 0 && age <= 7),
  };
}

/** Annual row admission; the caller names the filing's expected report end. */
export function getPersonalSecAnnualRowReason(
  row: Pick<
    Observation,
    | "form"
    | "filingFocusPeriod"
    | "startDate"
    | "endDate"
    | "durationDays"
    | "filing"
    | "filedDate"
  >,
  cutoffAt: string,
  fetchedAt: string,
  expectedReportDate: string,
): PersonalSecAnnualPairReason | null {
  if (row.form !== "10-K" && row.form !== "20-F") return "unsupported_form";
  if (row.filingFocusPeriod !== "FY") return "missing_or_non_FY_focus";
  const start = row.startDate === null ? null : day(row.startDate),
    end = day(row.endDate);
  if (
    start === null ||
    end === null ||
    row.durationDays === null ||
    row.durationDays < 335 ||
    row.durationDays > 395 ||
    (end - start) / DAY + 1 !== row.durationDays
  )
    return "invalid_annual_period";
  if (
    row.filing.status !== "matched" ||
    row.filing.form !== row.form ||
    row.filing.filedDate !== row.filedDate
  )
    return "filing_unmatched_or_conflicted";
  if (row.filing.reportDate !== expectedReportDate)
    return "report_end_mismatch";
  if (row.startDate! > row.endDate || row.endDate > row.filedDate)
    return "future_or_inconsistent_dates";
  const reason = filingReason(
    {
      form: row.filing.form,
      filedDate: row.filing.filedDate,
      reportDate: row.filing.reportDate,
      acceptedAt: row.filing.acceptedAt,
    },
    cutoffAt,
    fetchedAt,
  );
  // The resolver rejects bad operation clocks before evaluating any row.
  requireValid(reason !== "invalid_clock");
  return reason as PersonalSecAnnualPairReason | null;
}

export {
  instant as personalSecAnnualInstant,
  day as personalSecAnnualDay,
  filingReason as getPersonalSecAnnualFilingReason,
};
