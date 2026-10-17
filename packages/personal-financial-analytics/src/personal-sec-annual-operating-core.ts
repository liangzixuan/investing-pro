import {
  PERSONAL_SEC_ANNUAL_OPERATING_ABSENCES,
  PERSONAL_SEC_ANNUAL_OPERATING_LIMITS,
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  PERSONAL_SEC_ANNUAL_SCAN_STATUSES,
  type PersonalSecAnnualOperatingScanDto,
  type PersonalSecAnnualStatementObservationDto,
  type PersonalSecAnnualGenerationDto,
  type PersonalSecAnnualTargetDto,
  type PersonalSecAnnualOperatingResolutionDto,
  type PersonalSecAnnualOperatingUnavailableReason,
  type PersonalSecAnnualOperatingValueDto,
  type PersonalSecAnnualRevenueConcept,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";
import {
  calculatePersonalMarginPercent,
  comparePersonalMargins,
} from "./personal-margin";
import type { PersonalSecAnnualMarginComparison } from "./personal-sec-annual-comparison";
import {
  getPersonalSecAnnualFilingReason,
  getPersonalSecAnnualRowReason,
  getPersonalSecAnnualSourceClockReason,
  getPersonalSecAnnualSourceUtilityAge,
} from "./personal-sec-annual-source-context";

/** Source operands retain their original objects and have no protocol metric tags. */
export type PersonalSecAnnualOperatingCoreRow = Omit<
  PersonalSecAnnualStatementObservationDto,
  "concept"
> &
  Readonly<{
    concept:
      "OperatingIncomeLoss" | "NetIncomeLoss" | PersonalSecAnnualRevenueConcept;
  }>;
export interface PersonalSecAnnualOperatingCoreMetric {
  readonly scan: PersonalSecAnnualOperatingScanDto;
  readonly observations: readonly (PersonalSecAnnualOperatingCoreRow &
    Readonly<{ concept: "OperatingIncomeLoss" }>)[];
}
export interface PersonalSecAnnualOperatingCoreInput {
  readonly cik: string;
  readonly generation: Pick<
    PersonalSecAnnualGenerationDto,
    "cutoffAt" | "completedAt" | "sources"
  >;
  readonly target: PersonalSecAnnualTargetDto;
  readonly observations: readonly PersonalSecAnnualOperatingCoreRow[];
  readonly incomeReason: PersonalSecAnnualOperatingUnavailableReason | null;
  readonly operatingResults: Readonly<{
    operatingIncome: PersonalSecAnnualOperatingCoreMetric;
  }>;
}
type Input = PersonalSecAnnualOperatingCoreInput;
type Row = PersonalSecAnnualOperatingCoreRow;
type Metric = PersonalSecAnnualOperatingCoreMetric;
type Value<Unit extends "USD" | "percent" = "USD"> =
  PersonalSecAnnualOperatingValueDto<Unit>;
type Reason = PersonalSecAnnualOperatingUnavailableReason;
const limits = PERSONAL_SEC_ANNUAL_OPERATING_LIMITS;
const D = Decimal.clone({ defaults: true, precision: 256 });
const rowReasons: readonly Reason[] = [
  "unsupported_form",
  "missing_or_non_FY_focus",
  "invalid_annual_period",
  "filing_unmatched_or_conflicted",
  "report_end_mismatch",
  "future_or_inconsistent_dates",
  "cutoff_time_unresolved",
  "report_date_missing",
  "filed_date_missing",
];

function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new TypeError("Invalid annual operating evidence.");
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function unavailable<Unit extends "USD" | "percent">(
  unit: Unit,
  reason: Reason,
  observationIds: readonly `sec-fact:${string}`[] = [],
): Value<Unit> {
  return {
    status: "unavailable",
    unit,
    reason,
    observationIds: [...observationIds],
  };
}
function validRow(row: Row, ids: Set<string>, input: Input): void {
  requireValid(
    row.taxonomy === "us-gaap" &&
      row.unit === "USD" &&
      typeof row.value === "string" &&
      row.value.length <= limits.decimalCharacters &&
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(row.value) &&
      /^sec-fact:[a-f0-9]{64}$/u.test(row.id) &&
      !ids.has(row.id),
  );
  requireValid(
    input.target.status === "target" &&
      row.accessionNumber === input.target.accessionNumber,
  );
  ids.add(row.id);
}
function validateOperating(
  metric: Metric,
  input: Input,
  ids: Set<string>,
): void {
  const shape: unknown = metric.observations;
  requireValid(
    Array.isArray(shape) && shape.length <= limits.observationsPerMetric,
  );
  requireValid(PERSONAL_SEC_ANNUAL_SCAN_STATUSES.includes(metric.scan.status));
  requireValid(
    (metric.scan.status === "source_unavailable") !==
      (input.generation.sources.companyFacts.status === "available"),
  );
  if (metric.scan.status !== "available") {
    requireValid(
      metric.scan.absence === null &&
        metric.scan.coverage === null &&
        metric.observations.length === 0,
    );
    return;
  }
  requireValid(
    metric.scan.absence === null ||
      PERSONAL_SEC_ANNUAL_OPERATING_ABSENCES.includes(metric.scan.absence),
  );
  const { full, selected, otherAccessions, returned, omittedSelected } =
    metric.scan.coverage;
  requireValid(
    Object.values(full).every(
      (n) =>
        Number.isSafeInteger(n) && n >= 0 && n <= limits.candidateRowsPerMetric,
    ),
  );
  requireValid(
    full.candidateRows === full.inspectedRows &&
      full.inspectedRows ===
        full.invalidRows + full.duplicateRows + full.uniqueObservations,
  );
  requireValid((metric.scan.absence !== null) === (full.candidateRows === 0));
  requireValid(returned === metric.observations.length);
  if (input.target.status === "unresolved") {
    requireValid(
      selected === null &&
        otherAccessions === null &&
        omittedSelected === null &&
        returned === 0,
    );
  } else {
    requireValid(
      [selected, otherAccessions, omittedSelected].every(
        (n) => n !== null && Number.isSafeInteger(n) && n >= 0,
      ),
    );
    requireValid(selected! + otherAccessions! === full.uniqueObservations);
    requireValid(
      returned === (selected! > limits.observationsPerMetric ? 0 : selected),
    );
    requireValid(omittedSelected === selected! - returned);
  }
  for (const row of metric.observations) {
    requireValid(row.concept === "OperatingIncomeLoss");
    validRow(row, ids, input);
  }
}
function validateIncome(input: Input, ids: Set<string>): void {
  const shape: unknown = input.observations;
  requireValid(Array.isArray(shape) && shape.length <= 200);
  for (const row of input.observations) {
    requireValid(
      PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.some(
        (concept) => concept === row.concept,
      ) || row.concept === "NetIncomeLoss",
    );
    validRow(row, ids, input);
  }
}
function contextReason(
  input: Input,
  contractReason: "invalid_clock" | null,
): Reason | null {
  if (contractReason !== null) return contractReason;
  const sourceReason = getPersonalSecAnnualSourceClockReason(input.generation);
  if (sourceReason !== null) return sourceReason;
  if (input.target.status !== "target") return "target_unresolved";
  const filingReason = getPersonalSecAnnualFilingReason(
    input.target,
    input.generation.cutoffAt,
    input.generation.sources.submissions.fetchedAt!,
  );
  if (filingReason !== null) {
    requireValid(rowReasons.includes(filingReason as Reason));
    return filingReason as Reason;
  }
  return getPersonalSecAnnualSourceUtilityAge(
    input.generation,
    input.target,
  )!.sourceAgeDays.some((age) => age > 7)
    ? "source_stale"
    : null;
}
function scanReason(metric: Metric): Reason | null {
  if (metric.scan.status !== "available") return metric.scan.status;
  const { coverage, absence } = metric.scan;
  if (coverage.full.invalidRows > 0) return "invalid_source_rows";
  if (coverage.selected! > limits.observationsPerMetric)
    return "selected_report_overflow";
  return absence;
}
function annualRowsReason(rows: readonly Row[], input: Input): Reason | null {
  requireValid(input.target.status === "target");
  const target = input.target;
  const url = `https://www.sec.gov/Archives/edgar/data/${input.cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`;
  if (
    rows.some(
      (row) =>
        row.filing.form !== target.form ||
        row.filing.filedDate !== target.filedDate ||
        row.filing.acceptedAt !== target.acceptedAt ||
        row.filing.sourceUrl !== url,
    )
  )
    return "filing_unmatched_or_conflicted";
  const capturedAt = [
    input.generation.sources.companyFacts.fetchedAt!,
    input.generation.sources.submissions.fetchedAt!,
  ]
    .sort()
    .at(-1)!;
  const reasons = rows.map((row) =>
    getPersonalSecAnnualRowReason(
      row,
      input.generation.cutoffAt,
      capturedAt,
      target.reportDate,
    ),
  );
  return (
    rowReasons.find((reason) =>
      reasons.some((candidate) => candidate === reason),
    ) ?? null
  );
}
function amount(
  rows: readonly Row[],
  input: Input,
  refused: Reason | null,
  currentUseEligible: boolean,
  periodEnd?: string,
): Value {
  if (refused !== null)
    return unavailable(
      "USD",
      refused,
      rows.map((row) => row.id),
    );
  requireValid(input.target.status === "target");
  const reportDate = periodEnd ?? input.target.reportDate;
  const selected = rows.filter((row) => row.endDate === reportDate);
  if (selected.length === 0) return unavailable("USD", "no_report_period");
  const ids = selected.map((row) => row.id);
  const reason = annualRowsReason(selected, input);
  if (reason !== null) return unavailable("USD", reason, ids);
  const first = selected[0]!;
  if (selected.some((row) => row.startDate !== first.startDate))
    return unavailable("USD", "ambiguous_period", ids);
  if (selected.some((row) => !new D(row.value).eq(first.value)))
    return unavailable("USD", "ambiguous_value", ids);
  const value = new D(first.value);
  return {
    status: "available",
    unit: "USD",
    value: value.isZero() ? "0" : value.toFixed(),
    startDate: first.startDate!,
    endDate: first.endDate,
    accessionNumber: first.accessionNumber,
    observationIds: ids,
    currentUseEligible,
  };
}
function margin(operating: Value, revenue: Value): Value<"percent"> {
  const ids = [...operating.observationIds, ...revenue.observationIds];
  if (operating.status === "unavailable")
    return unavailable("percent", operating.reason, ids);
  if (revenue.status === "unavailable")
    return unavailable("percent", revenue.reason, ids);
  if (operating.accessionNumber !== revenue.accessionNumber)
    return unavailable("percent", "filing_mismatch", ids);
  if (
    operating.startDate !== revenue.startDate ||
    operating.endDate !== revenue.endDate
  )
    return unavailable("percent", "period_mismatch", ids);
  if (!new D(revenue.value).gt(0))
    return unavailable("percent", "nonpositive_revenue", ids);
  const value = calculatePersonalMarginPercent(operating.value, revenue.value);
  requireValid(value.length <= limits.marginCharacters);
  return {
    ...operating,
    unit: "percent",
    value,
    observationIds: ids,
    currentUseEligible:
      operating.currentUseEligible && revenue.currentUseEligible,
  };
}

/** Pure recomputation of one annual operating amount and each exact revenue basis. */
export function resolvePersonalSecAnnualOperatingCore(
  input: Input,
  contractReason: "invalid_clock" | null = null,
): PersonalSecAnnualOperatingResolutionDto {
  const ids = new Set<string>();
  validateIncome(input, ids);
  const metric = input.operatingResults.operatingIncome;
  validateOperating(metric, input, ids);
  const reason = contextReason(input, contractReason);
  const utilityAge =
    contractReason === null
      ? getPersonalSecAnnualSourceUtilityAge(input.generation, input.target)
      : null;
  const current = utilityAge?.withinWindow === true;
  const operatingIncome = amount(
    metric.observations,
    input,
    reason ?? scanReason(metric),
    current,
  );
  const revenueReason = reason ?? input.incomeReason;
  return freeze({
    operatingIncome,
    margins: PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept) => {
      const revenue = amount(
        input.observations.filter((row) => row.concept === concept),
        input,
        revenueReason,
        current,
      );
      return {
        concept,
        revenue,
        operatingMargin: margin(operatingIncome, revenue),
      };
    }),
    utilityAge,
  });
}

export type PersonalSecAnnualOperatingHistoryReason =
  PersonalSecAnnualOperatingUnavailableReason | "current_use_unavailable";

/** Comparative amounts in one selected filing; no new current-use qualification. */
export type PersonalSecAnnualOperatingHistoryPeriod = Readonly<{
  startDate: string;
  endDate: string;
  operatingIncome: string;
  revenue: string;
  operatingMarginPercent: string;
  observationIds: readonly `sec-fact:${string}`[];
}>;

export type PersonalSecAnnualOperatingHistory =
  | Readonly<{
      status: "unavailable";
      reason: PersonalSecAnnualOperatingHistoryReason;
    }>
  | Readonly<{
      status: "available";
      concept: PersonalSecAnnualRevenueConcept;
      accessionNumber: string;
      /** Newest first; at most three adjacent annual periods. */
      periods: readonly PersonalSecAnnualOperatingHistoryPeriod[];
      stoppedReason: PersonalSecAnnualOperatingHistoryReason | null;
    }>;

function historyPeriod(
  operating: Extract<Value, { status: "available" }>,
  revenue: Extract<Value, { status: "available" }>,
  calculated: Extract<Value<"percent">, { status: "available" }>,
): PersonalSecAnnualOperatingHistoryPeriod {
  return {
    startDate: operating.startDate,
    endDate: operating.endDate,
    operatingIncome: operating.value,
    revenue: revenue.value,
    operatingMarginPercent: calculated.value,
    observationIds: [...calculated.observationIds],
  };
}

/** Same-filing comparatives from complete admitted rows; never borrow net-income eligibility. */
export function resolvePersonalSecAnnualOperatingHistoryCore(
  input: Input,
  concept: PersonalSecAnnualRevenueConcept,
  contractReason: "invalid_clock" | null = null,
): PersonalSecAnnualOperatingHistory {
  requireValid(PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.includes(concept));
  // Preserve full input, scan, identifier and current-resolution admission.
  const current = resolvePersonalSecAnnualOperatingCore(input, contractReason);
  const basis = current.margins.find(
    (candidate) => candidate.concept === concept,
  )!;
  const operating = current.operatingIncome;
  const revenue = basis.revenue;
  const calculated = basis.operatingMargin;
  if (calculated.status === "unavailable")
    return freeze({ status: "unavailable", reason: calculated.reason });
  requireValid(
    operating.status === "available" && revenue.status === "available",
  );
  if (!calculated.currentUseEligible)
    return freeze({ status: "unavailable", reason: "current_use_unavailable" });
  const periods = [historyPeriod(operating, revenue, calculated)];
  let stoppedReason: PersonalSecAnnualOperatingHistoryReason | null = null;
  const revenues = input.observations.filter((row) => row.concept === concept);
  while (periods.length < 3) {
    const next = periods.at(-1)!;
    const end = new Date(Date.parse(`${next.startDate}T00:00:00Z`) - 86_400_000)
      .toISOString()
      .slice(0, 10);
    // Candidate flow end varies; annual row admission keeps the original filing reportDate.
    const priorOperating = amount(
      input.operatingResults.operatingIncome.observations,
      input,
      null,
      false,
      end,
    );
    const priorRevenue = amount(revenues, input, null, false, end);
    const priorMargin = margin(priorOperating, priorRevenue);
    if (priorMargin.status === "unavailable") {
      stoppedReason = priorMargin.reason;
      break;
    }
    requireValid(
      priorOperating.status === "available" &&
        priorRevenue.status === "available",
    );
    periods.push(historyPeriod(priorOperating, priorRevenue, priorMargin));
  }
  return freeze({
    status: "available",
    concept,
    accessionNumber: calculated.accessionNumber,
    periods,
    stoppedReason,
  });
}

export type PersonalSecAnnualOperatingComparison =
  | Readonly<{
      status: "unavailable";
      stage: "current_pair" | "prior_pair";
      reason: PersonalSecAnnualOperatingHistoryReason;
    }>
  | Readonly<{
      status: "available";
      concept: PersonalSecAnnualRevenueConcept;
      accessionNumber: string;
      current: PersonalSecAnnualOperatingHistoryPeriod;
      prior: PersonalSecAnnualOperatingHistoryPeriod;
      operatingIncomeDifference: string;
      operatingMarginChange: Extract<
        PersonalSecAnnualMarginComparison,
        { status: "available" }
      >;
      observationIds: readonly `sec-fact:${string}`[];
    }>;

/** Change between the first two admitted same-basis periods; no growth percentage. */
export function comparePersonalSecAnnualOperatingCore(
  input: Input,
  concept: PersonalSecAnnualRevenueConcept,
  contractReason: "invalid_clock" | null = null,
): PersonalSecAnnualOperatingComparison {
  const history = resolvePersonalSecAnnualOperatingHistoryCore(
    input,
    concept,
    contractReason,
  );
  if (history.status === "unavailable")
    return freeze({
      status: "unavailable",
      stage: "current_pair",
      reason: history.reason,
    });
  const [current, prior] = history.periods;
  requireValid(current !== undefined);
  if (prior === undefined) {
    requireValid(history.stoppedReason !== null);
    return freeze({
      status: "unavailable",
      stage: "prior_pair",
      reason: history.stoppedReason,
    });
  }
  const difference = new D(current.operatingIncome).minus(
    prior.operatingIncome,
  );
  const operatingIncomeDifference = difference.isZero()
    ? "0"
    : difference.toFixed();
  requireValid(operatingIncomeDifference.length <= 128);
  return freeze({
    status: "available",
    concept: history.concept,
    accessionNumber: history.accessionNumber,
    current,
    prior,
    operatingIncomeDifference,
    operatingMarginChange: {
      status: "available",
      ...comparePersonalMargins(
        prior.operatingIncome,
        prior.revenue,
        current.operatingIncome,
        current.revenue,
      ),
    },
    observationIds: [...current.observationIds, ...prior.observationIds],
  });
}
