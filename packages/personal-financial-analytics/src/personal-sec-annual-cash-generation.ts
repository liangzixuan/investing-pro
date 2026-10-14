import {
  PERSONAL_SEC_ANNUAL_CASH_LIMITS,
  type PersonalSecAnnualCashConcept,
  type PersonalSecAnnualCashCoverageDto,
  type PersonalSecAnnualCashMetricEvidenceDto,
  type PersonalSecAnnualCashObservationDto,
  type PersonalSecAnnualCashResolutionDto,
  type PersonalSecAnnualCashResolutionInput,
  type PersonalSecAnnualCashUnavailableReason,
  type PersonalSecAnnualCashValueDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";
import { calculatePersonalOperatingCashFlowLessPpePurchases } from "./personal-cash-generation";
import {
  getPersonalSecAnnualFilingReason,
  getPersonalSecAnnualRowReason,
  getPersonalSecAnnualSourceReason,
  getPersonalSecAnnualUtilityAge,
} from "./personal-sec-annual-evidence";

type Input = PersonalSecAnnualCashResolutionInput;
type Metric = PersonalSecAnnualCashMetricEvidenceDto;
type Row = PersonalSecAnnualCashObservationDto;
type Value = PersonalSecAnnualCashValueDto;
type Reason = PersonalSecAnnualCashUnavailableReason;
const limits = PERSONAL_SEC_ANNUAL_CASH_LIMITS;
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

function requireValid(value: unknown): asserts value {
  if (!value) throw new TypeError("Invalid annual cash generation evidence.");
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function unavailable(reason: Reason, rows: readonly Row[] = []): Value {
  return {
    status: "unavailable",
    reason,
    observationIds: rows.map((row) => row.id),
  };
}

function validCounts(coverage: PersonalSecAnnualCashCoverageDto): void {
  const full = coverage.full;
  requireValid(
    Object.values(full).every(
      (count) =>
        Number.isSafeInteger(count) &&
        count >= 0 &&
        count <= limits.candidateRowsPerMetric,
    ),
  );
  requireValid(full.candidateRows === full.inspectedRows);
  requireValid(
    full.inspectedRows ===
      full.invalidRows + full.duplicateRows + full.uniqueObservations,
  );
}

function selectedCounts(metric: Metric, input: Input): void {
  if (metric.scan.status !== "available") {
    requireValid(
      metric.observations.length === 0 &&
        metric.scan.absence === null &&
        metric.scan.coverage === null,
    );
    return;
  }
  const coverage = metric.scan.coverage;
  validCounts(coverage);
  requireValid(coverage.returned === metric.observations.length);
  if (input.target.status === "unresolved") {
    requireValid(
      coverage.selected === null &&
        coverage.otherAccessions === null &&
        coverage.omittedSelected === null &&
        coverage.returned === 0,
    );
    return;
  }
  const { selected, otherAccessions, omittedSelected } = coverage;
  requireValid(
    [selected, otherAccessions, omittedSelected].every(
      (count) => count !== null && Number.isSafeInteger(count) && count >= 0,
    ),
  );
  requireValid(
    selected! + otherAccessions! === coverage.full.uniqueObservations,
  );
  const expected = selected! > limits.observationsPerMetric ? 0 : selected!;
  requireValid(coverage.returned === expected);
  requireValid(omittedSelected === selected! - expected);
  if (metric.scan.absence !== null)
    requireValid(coverage.full.candidateRows === 0);
}

function validRow(row: Row, concept: PersonalSecAnnualCashConcept): void {
  requireValid(row.concept === concept && row.taxonomy === "us-gaap");
  const metric =
    concept === "NetCashProvidedByUsedInOperatingActivities"
      ? "operating_cash_flow"
      : "ppe_purchases";
  requireValid(row.metric === metric && row.unit === "USD");
  requireValid(
    typeof row.value === "string" &&
      row.value.length <= limits.decimalCharacters &&
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(row.value),
  );
  requireValid(/^sec-fact:[a-f0-9]{64}$/u.test(row.id));
}

function validateMetric(
  metric: Metric,
  concept: PersonalSecAnnualCashConcept,
  input: Input,
  ids: Set<string>,
): void {
  selectedCounts(metric, input);
  for (const row of metric.observations) {
    validRow(row, concept);
    requireValid(!ids.has(row.id));
    ids.add(row.id);
    requireValid(
      input.target.status === "target" &&
        row.accessionNumber === input.target.accessionNumber,
    );
  }
}

function contextReason(input: Input): Reason | null {
  const sourceReason = getPersonalSecAnnualSourceReason(input.generation);
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
  const age = getPersonalSecAnnualUtilityAge(input.generation, input.target)!;
  return age.sourceAgeDays.some((days) => days > 7) ? "source_stale" : null;
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
  const reportDate = input.target.reportDate;
  const target = input.target;
  const filingUrl = `https://www.sec.gov/Archives/edgar/data/${input.cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`;
  if (
    rows.some(
      (row) =>
        row.filing.form !== target.form ||
        row.filing.filedDate !== target.filedDate ||
        row.filing.acceptedAt !== target.acceptedAt ||
        row.filing.sourceUrl !== filingUrl,
    )
  )
    return "filing_unmatched_or_conflicted";
  const fetchedAt = [
    input.generation.sources.companyFacts.fetchedAt!,
    input.generation.sources.submissions.fetchedAt!,
  ]
    .sort()
    .at(-1)!;
  const reasons = rows.map((row) =>
    getPersonalSecAnnualRowReason(
      row,
      input.generation.cutoffAt,
      fetchedAt,
      reportDate,
    ),
  );
  return (
    rowReasons.find((reason) =>
      reasons.some((candidate) => candidate === reason),
    ) ?? null
  );
}

function resolveMetric(
  metric: Metric,
  input: Input,
  globalReason: Reason | null,
  currentUseEligible: boolean,
): Value {
  const refused = globalReason ?? scanReason(metric);
  if (refused !== null) return unavailable(refused, metric.observations);
  requireValid(input.target.status === "target");
  const reportDate = input.target.reportDate;
  const rows = metric.observations.filter((row) => row.endDate === reportDate);
  if (rows.length === 0) return unavailable("no_report_period");
  const rowReason = annualRowsReason(rows, input);
  if (rowReason !== null) return unavailable(rowReason, rows);
  const first = rows[0]!;
  if (rows.some((row) => row.startDate !== first.startDate))
    return unavailable("ambiguous_period", rows);
  if (rows.some((row) => !new D(row.value).eq(first.value)))
    return unavailable("ambiguous_value", rows);
  const value = new D(first.value);
  return {
    status: "available",
    value: value.isZero() ? "0" : value.toFixed(),
    startDate: first.startDate!,
    endDate: first.endDate,
    accessionNumber: first.accessionNumber,
    observationIds: rows.map((row) => row.id),
    currentUseEligible,
  };
}

function difference(operating: Value, purchases: Value): Value {
  const observationIds = [
    ...operating.observationIds,
    ...purchases.observationIds,
  ];
  if (operating.status === "unavailable")
    return { ...operating, observationIds };
  if (purchases.status === "unavailable")
    return { ...purchases, observationIds };
  let reason: Reason | null = null;
  if (
    operating.startDate !== purchases.startDate ||
    operating.endDate !== purchases.endDate
  )
    reason = "period_mismatch";
  else if (operating.accessionNumber !== purchases.accessionNumber)
    reason = "filing_mismatch";
  if (reason !== null) return { status: "unavailable", reason, observationIds };
  const calculation = calculatePersonalOperatingCashFlowLessPpePurchases(
    operating.value,
    purchases.value,
  );
  if (calculation.status === "unavailable")
    return { ...calculation, observationIds };
  return {
    ...operating,
    value: calculation.value,
    observationIds,
    currentUseEligible:
      operating.currentUseEligible && purchases.currentUseEligible,
  };
}

/** Independently resolve the two fixed annual cash concepts from one generation. */
export function resolvePersonalSecAnnualCashGeneration(
  input: Input,
): PersonalSecAnnualCashResolutionDto {
  const { operatingCashFlow, ppePurchases } = input.cashGeneration;
  const ids = new Set<string>();
  validateMetric(
    operatingCashFlow,
    "NetCashProvidedByUsedInOperatingActivities",
    input,
    ids,
  );
  validateMetric(
    ppePurchases,
    "PaymentsToAcquirePropertyPlantAndEquipment",
    input,
    ids,
  );
  const reason = contextReason(input);
  const utilityAge = getPersonalSecAnnualUtilityAge(
    input.generation,
    input.target,
  );
  const current = utilityAge?.withinWindow === true;
  const operating = resolveMetric(operatingCashFlow, input, reason, current);
  const purchases = resolveMetric(ppePurchases, input, reason, current);
  return freeze({
    operatingCashFlow: operating,
    ppePurchases: purchases,
    operatingCashFlowLessPpePurchases: difference(operating, purchases),
    utilityAge,
  });
}
