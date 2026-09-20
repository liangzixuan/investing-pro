import {
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  type PersonalSecAnnualDiagnosticReason,
  type PersonalSecAnnualFilingDto,
  type PersonalSecAnnualGenerationDto,
  type PersonalSecAnnualPairDto,
  type PersonalSecAnnualPairReason,
  type PersonalSecAnnualRefusalReason,
  type PersonalSecAnnualResolutionDto,
  type PersonalSecAnnualResolutionInput,
  type PersonalSecAnnualSourceDto,
  type PersonalSecAnnualTargetDto,
  type PersonalSecAnnualTargetReason,
  type PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";

type Observation = PersonalSecQuarterlyObservationDto;
const DAY = 86_400_000;
const D = Decimal.clone({
  defaults: true,
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -256,
  toExpPos: 256,
});
const rowReasonOrder: readonly PersonalSecAnnualPairReason[] = [
  "unsupported_form",
  "missing_or_non_FY_focus",
  "invalid_annual_period",
  "filing_unmatched_or_conflicted",
  "report_end_mismatch",
  "future_or_inconsistent_dates",
  "cutoff_time_unresolved",
];
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}
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

/** Select metadata before looking at financial values. No older passing fallback. */
export function selectPersonalSecAnnualTarget(
  filings: readonly PersonalSecAnnualFilingDto[] | null,
  cutoffAt: string,
  fetchedAt: string,
): PersonalSecAnnualTargetDto {
  const unresolved = (
    reason: PersonalSecAnnualTargetReason,
  ): PersonalSecAnnualTargetDto =>
    Object.freeze({ status: "unresolved", reason });
  if (filings === null) return unresolved("submissions_unavailable");
  const cutoff = instant(cutoffAt),
    capture = instant(fetchedAt);
  if (cutoff === null || capture === null || capture < cutoff)
    return unresolved("invalid_clock");
  const arrayShape: unknown = filings;
  if (
    !Array.isArray(arrayShape) ||
    filings.length > PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.submissionRows
  )
    return unresolved("invalid_submissions");
  const seen = new Set<string>();
  for (const filing of filings) {
    if (
      filing === null ||
      typeof filing !== "object" ||
      !/^\d{10}-\d{2}-\d{6}$/u.test(filing.accessionNumber) ||
      typeof filing.form !== "string" ||
      seen.has(filing.accessionNumber) ||
      (filing.filedDate !== null && day(filing.filedDate) === null) ||
      (filing.reportDate !== null && day(filing.reportDate) === null) ||
      (filing.acceptedAt !== null && instant(filing.acceptedAt) === null)
    )
      return unresolved("invalid_submissions");
    seen.add(filing.accessionNumber);
  }
  const annual = filings.filter(
    (f) =>
      (f.form === "10-K" || f.form === "20-F") &&
      f.filedDate !== null &&
      f.filedDate <= cutoffAt.slice(0, 10),
  );
  if (annual.some((f) => f.reportDate === null))
    return unresolved("target_missing_report_date");
  const candidates = annual
    .filter(
      (f) =>
        f.reportDate! <= cutoffAt.slice(0, 10) &&
        (f.acceptedAt === null || instant(f.acceptedAt)! <= cutoff),
    )
    .sort(
      (a, b) =>
        b.reportDate!.localeCompare(a.reportDate!) ||
        b.filedDate!.localeCompare(a.filedDate!),
    );
  const first = candidates[0];
  if (first === undefined) return unresolved("no_observed_annual_target");
  const reason = filingReason(first, cutoffAt, fetchedAt);
  if (reason !== null) return unresolved(reason);
  if (
    candidates.filter(
      (f) =>
        f.reportDate === first.reportDate && f.filedDate === first.filedDate,
    ).length !== 1
  )
    return unresolved("target_ambiguous");
  return Object.freeze({
    status: "target",
    accessionNumber: first.accessionNumber,
    form: first.form as "10-K" | "20-F",
    filedDate: first.filedDate!,
    reportDate: first.reportDate!,
    acceptedAt: first.acceptedAt,
  });
}

/** Canonical UTF-8 input for SHA-256 in the server or WebCrypto client.
 * This binds returned capture identity; it cannot prove absent source candidates.
 */
export function serializePersonalSecAnnualGeneration(input: {
  readonly cik: string;
  readonly generation: Omit<PersonalSecAnnualGenerationDto, "sha256">;
  readonly target: PersonalSecAnnualTargetDto;
  readonly targetScan: PersonalSecAnnualResolutionInput["targetScan"];
}): string {
  const source = (s: PersonalSecAnnualSourceDto) => [
    s.status,
    s.sourceUrl,
    s.fetchedAt,
    s.sha256,
    s.bytes,
  ];
  const target =
    input.target.status === "target"
      ? [
          "target",
          input.target.accessionNumber,
          input.target.form,
          input.target.filedDate,
          input.target.reportDate,
          input.target.acceptedAt,
        ]
      : ["unresolved", input.target.reason];
  const scan =
    input.targetScan === null
      ? null
      : [
          input.targetScan.currentFilings,
          input.targetScan.annualFilings,
          input.targetScan.olderHistoryAvailable,
        ];
  return JSON.stringify([
    "personal-sec-annual-evidence",
    input.generation.definitionVersion,
    input.cik,
    input.generation.cutoffAt,
    input.generation.completedAt,
    source(input.generation.sources.companyFacts),
    source(input.generation.sources.submissions),
    target,
    scan,
  ]);
}

/** Deterministic global refusal precedence shared by provider and decoder. */
export function getPersonalSecAnnualRefusalReason(
  input: Pick<
    PersonalSecAnnualResolutionInput,
    "generation" | "target" | "coverage"
  >,
): PersonalSecAnnualRefusalReason | null {
  const { generation, target, coverage } = input;
  const cutoff = instant(generation.cutoffAt),
    completed = instant(generation.completedAt);
  if (
    generation.definitionVersion !== PERSONAL_SEC_ANNUAL_DEFINITION_VERSION ||
    cutoff === null ||
    completed === null ||
    completed < cutoff
  )
    return "invalid_clock";
  const sources = [
    generation.sources.companyFacts,
    generation.sources.submissions,
  ];
  if (sources.some((s) => s.status !== "available") || coverage === null)
    return "source_unavailable";
  const captures = sources.map((s) =>
    s.fetchedAt === null ? null : instant(s.fetchedAt),
  );
  if (
    captures.some((time) => time === null || time < cutoff || time > completed)
  )
    return "invalid_clock";
  if (coverage.full.invalidRows > 0) return "invalid_source_rows";
  if (target.status === "unresolved") return "target_unresolved";
  requireValid(coverage.selected !== null);
  if (
    coverage.selected.revenue >
      PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.observationsPerMetric ||
    coverage.selected.netIncome >
      PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.observationsPerMetric
  )
    return "selected_report_overflow";
  if (captures.some((time) => (completed - time!) / DAY > 7))
    return "source_stale";
  return null;
}
function rowReason(
  row: Observation,
  cutoffAt: string,
  fetchedAt: string,
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
  if (row.filing.reportDate !== row.endDate) return "report_end_mismatch";
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
function firstReason(
  rows: readonly Observation[],
  cutoffAt: string,
  fetchedAt: string,
): PersonalSecAnnualPairReason | null {
  const reasons = rows
    .map((r) => rowReason(r, cutoffAt, fetchedAt))
    .filter((r): r is PersonalSecAnnualPairReason => r !== null);
  return rowReasonOrder.find((r) => reasons.includes(r)) ?? reasons[0] ?? null;
}
function margin(revenue: string, income: string): string {
  const value = new D(income)
    .div(revenue)
    .times(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return value.isZero() ? "0" : value.toFixed();
}
function pairs(
  rows: readonly Observation[],
  cutoffAt: string,
  fetchedAt: string,
): PersonalSecAnnualPairDto[] {
  const groups = new Map<string, Observation[]>(),
    incomeByPeriod = new Map<string, Observation[]>(),
    annualStarts = new Map<string, Set<string | null>>();
  for (const row of rows) {
    if (row.metric === "net_income") {
      const key = JSON.stringify([
        row.accessionNumber,
        row.startDate,
        row.endDate,
      ]);
      const found = incomeByPeriod.get(key) ?? [];
      found.push(row);
      incomeByPeriod.set(key, found);
    } else if (
      row.durationDays !== null &&
      row.durationDays >= 335 &&
      row.durationDays <= 395
    ) {
      const key = JSON.stringify([
        row.accessionNumber,
        row.concept,
        row.endDate,
      ]);
      const found = annualStarts.get(key) ?? new Set<string | null>();
      found.add(row.startDate);
      annualStarts.set(key, found);
    }
  }
  for (const row of rows.filter((r) => r.metric === "revenue")) {
    const key = JSON.stringify([
      row.accessionNumber,
      row.concept,
      row.startDate,
      row.endDate,
    ]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map((revenueRows): PersonalSecAnnualPairDto => {
    const row = revenueRows[0]!;
    requireValid(
      PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.some((c) => c === row.concept),
    );
    const income =
      incomeByPeriod.get(
        JSON.stringify([row.accessionNumber, row.startDate, row.endDate]),
      ) ?? [];
    const diagnostics: PersonalSecAnnualDiagnosticReason[] = [
      ...new Set(
        [...revenueRows, ...income]
          .map((r) => rowReason(r, cutoffAt, fetchedAt))
          .filter((r): r is PersonalSecAnnualPairReason => r !== null),
      ),
    ];
    let reason = firstReason(revenueRows, cutoffAt, fetchedAt);
    const starts =
      annualStarts.get(
        JSON.stringify([row.accessionNumber, row.concept, row.endDate]),
      ) ?? new Set();
    if (
      reason === null &&
      (starts.size > 1 || new Set(revenueRows.map((r) => r.value)).size > 1)
    )
      reason = "ambiguous_revenue_period_or_value";
    if (reason === null && income.length === 0) {
      reason = "income_missing_same_filing_period";
      diagnostics.push(
        incomeByPeriod.size > 0
          ? "income_only_other_period_or_accession"
          : "no_income_observations",
      );
    }
    if (reason === null && firstReason(income, cutoffAt, fetchedAt) !== null)
      reason = "income_metadata_or_period_invalid";
    if (reason === null && new Set(income.map((r) => r.value)).size > 1)
      reason = "ambiguous_income_value";
    if (reason === null && !new D(row.value).gt(0))
      reason = "nonpositive_revenue";
    return {
      accessionNumber: row.accessionNumber,
      concept: row.concept as PersonalSecAnnualPairDto["concept"],
      startDate: row.startDate,
      endDate: row.endDate,
      status: reason ?? "eligible",
      subordinateReasons: diagnostics,
      revenue: reason === null ? row.value : null,
      netIncome: reason === null ? income[0]!.value : null,
      netMarginPercent:
        reason === null ? margin(row.value, income[0]!.value) : null,
      revenueObservationIds: revenueRows.map((r) => r.id),
      incomeObservationIds: income.map((r) => r.id),
    };
  });
}

/** Pure recomputation over the already validated bounded response.
 * Structural wire validation, raw-source parsing and SHA verification are separate.
 */
export function resolvePersonalSecAnnualEvidence(
  input: PersonalSecAnnualResolutionInput,
): PersonalSecAnnualResolutionDto {
  const refusal = getPersonalSecAnnualRefusalReason(input);
  if (refusal !== null) {
    requireValid(
      input.completeness.status === "refused" &&
        input.completeness.reason === refusal &&
        input.observations.length === 0,
    );
    return freeze({
      pairs: [],
      bases: PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept) => ({
        concept,
        status: "withheld" as const,
        pairs: [],
      })),
      selectedReportPairEligible: false,
      currentTargetEligible: false,
      utilityAge: null,
    });
  }
  requireValid(
    input.completeness.status === "complete" &&
      input.completeness.reason === null &&
      input.target.status === "target" &&
      input.coverage !== null &&
      input.coverage.selected !== null,
  );
  const { target, generation, observations, coverage } = input;
  const selectedCounts = coverage.selected;
  requireValid(selectedCounts !== null);
  requireValid(
    observations.length <=
      PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.observations &&
      observations.length === selectedCounts.observations &&
      observations.length === coverage.returned.observations,
  );
  requireValid(
    observations.filter((r) => r.metric === "revenue").length ===
      selectedCounts.revenue &&
      observations.filter((r) => r.metric === "net_income").length ===
        selectedCounts.netIncome &&
      new Set(observations.map((r) => r.id)).size === observations.length,
  );
  requireValid(
    observations.every((r) => r.accessionNumber === target.accessionNumber),
  );
  requireValid(target.form === "10-K" || target.form === "20-F");
  requireValid(
    filingReason(
      target,
      generation.cutoffAt,
      generation.sources.submissions.fetchedAt!,
    ) === null,
  );
  const capture = [
    generation.sources.companyFacts.fetchedAt!,
    generation.sources.submissions.fetchedAt!,
  ]
    .sort()
    .at(-1)!;
  const resultPairs = pairs(observations, generation.cutoffAt, capture);
  const reportPairs = resultPairs.filter(
    (p) => p.endDate === target.reportDate,
  );
  const bases = PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept) => {
    const basisPairs = reportPairs.filter((p) => p.concept === concept);
    return {
      concept,
      pairs: basisPairs,
      status: basisPairs.some((p) => p.status === "eligible")
        ? ("eligible" as const)
        : basisPairs.length
          ? ("rejected" as const)
          : ("missing" as const),
    };
  });
  const endAgeDays =
    (day(generation.cutoffAt.slice(0, 10))! - day(target.reportDate)!) / DAY;
  const sourceAgeDays: [number, number] = [
    generation.sources.companyFacts,
    generation.sources.submissions,
  ].map(
    (s) => (instant(generation.completedAt)! - instant(s.fetchedAt!)!) / DAY,
  ) as [number, number];
  const withinWindow =
    endAgeDays >= 0 &&
    endAgeDays <= 485 &&
    sourceAgeDays.every((n) => n >= 0 && n <= 7);
  const selectedReportPairEligible = bases.some((b) => b.status === "eligible");
  return freeze({
    pairs: resultPairs,
    bases,
    selectedReportPairEligible,
    currentTargetEligible: selectedReportPairEligible && withinWindow,
    utilityAge: { endAgeDays, sourceAgeDays, withinWindow },
  });
}
