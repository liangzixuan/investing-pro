import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  type PersonalSecAnnualDiagnosticReason,
  type PersonalSecAnnualPairDto,
  type PersonalSecAnnualPairReason,
  type PersonalSecAnnualResolutionDto,
  type PersonalSecAnnualTargetDto,
  type PersonalSecAnnualGenerationDto,
  type PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";
import { calculatePersonalMarginPercent } from "./personal-margin";
import {
  getPersonalSecAnnualFilingReason as filingReason,
  getPersonalSecAnnualRowReason,
  getPersonalSecAnnualSourceClockReason,
  getPersonalSecAnnualSourceUtilityAge,
} from "./personal-sec-annual-source-context";
export type PersonalSecAnnualIncomeCoreRow = Omit<
  PersonalSecQuarterlyObservationDto,
  "metric"
>;
export interface PersonalSecAnnualIncomeCoreInput {
  readonly generation: Pick<
    PersonalSecAnnualGenerationDto,
    "cutoffAt" | "completedAt" | "sources"
  >;
  readonly target: PersonalSecAnnualTargetDto;
  readonly observations: readonly PersonalSecAnnualIncomeCoreRow[];
}
type Observation = PersonalSecAnnualIncomeCoreRow;
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
function firstReason(
  rows: readonly Observation[],
  cutoffAt: string,
  fetchedAt: string,
): PersonalSecAnnualPairReason | null {
  const reasons = rows
    .map((r) =>
      getPersonalSecAnnualRowReason(r, cutoffAt, fetchedAt, r.endDate),
    )
    .filter((r): r is PersonalSecAnnualPairReason => r !== null);
  return rowReasonOrder.find((r) => reasons.includes(r)) ?? reasons[0] ?? null;
}
/** Exact decimal operands admitted by the annual resolver; revenue must be positive. */
export function calculatePersonalSecAnnualNetMargin(
  revenue: string,
  income: string,
): string {
  return calculatePersonalMarginPercent(income, revenue);
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
    if (row.concept === "NetIncomeLoss") {
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
  for (const row of rows.filter((r) => r.concept !== "NetIncomeLoss")) {
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
          .map((r) =>
            getPersonalSecAnnualRowReason(r, cutoffAt, fetchedAt, r.endDate),
          )
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
        reason === null
          ? calculatePersonalSecAnnualNetMargin(row.value, income[0]!.value)
          : null,
      revenueObservationIds: revenueRows.map((r) => r.id),
      incomeObservationIds: income.map((r) => r.id),
    };
  });
}

/** Resolve admitted source rows once. A boundary refusal can only withhold output. */
export function resolvePersonalSecAnnualIncomeCore(
  input: PersonalSecAnnualIncomeCoreInput,
  admissionRefused = false,
): PersonalSecAnnualResolutionDto {
  const { generation, target, observations } = input;
  const sourceReason = getPersonalSecAnnualSourceClockReason(generation);
  const age = getPersonalSecAnnualSourceUtilityAge(generation, target);
  if (
    admissionRefused ||
    sourceReason !== null ||
    target.status !== "target" ||
    age!.sourceAgeDays.some((days) => days > 7)
  ) {
    requireValid(observations.length === 0);
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
    observations.length <=
      PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.observations &&
      new Set(observations.map((row) => row.id)).size === observations.length,
  );
  requireValid(
    observations.filter((row) => row.concept !== "NetIncomeLoss").length <=
      PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.observationsPerMetric &&
      observations.filter((row) => row.concept === "NetIncomeLoss").length <=
        PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.observationsPerMetric,
  );
  requireValid(
    observations.every(
      (row) =>
        row.accessionNumber === target.accessionNumber &&
        row.taxonomy === "us-gaap" &&
        row.unit === "USD" &&
        (row.concept === "NetIncomeLoss" ||
          PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.some(
            (concept) => concept === row.concept,
          )) &&
        /^sec-fact:[a-f0-9]{64}$/u.test(row.id) &&
        typeof row.value === "string" &&
        row.value.length <=
          PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.decimalCharacters &&
        /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(row.value),
    ),
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
  const utilityAge = getPersonalSecAnnualSourceUtilityAge(generation, target)!;
  const selectedReportPairEligible = bases.some((b) => b.status === "eligible");
  return freeze({
    pairs: resultPairs,
    bases,
    selectedReportPairEligible,
    currentTargetEligible:
      selectedReportPairEligible && utilityAge.withinWindow,
    utilityAge,
  });
}
