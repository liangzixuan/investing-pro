import {
  PERSONAL_SEC_ANNUAL_LIQUIDITY_LIMITS,
  type PersonalSecAnnualLiquidityConcept,
  type PersonalSecAnnualLiquidityCoverageDto,
  type PersonalSecAnnualLiquidityMetricEvidenceDto,
  type PersonalSecAnnualLiquidityObservationDto,
  type PersonalSecAnnualLiquidityResolutionDto,
  type PersonalSecAnnualLiquidityResolutionInput,
  type PersonalSecAnnualLiquidityUnavailableReason,
  type PersonalSecAnnualLiquidityValueDto,
} from "@research-cockpit/contracts";
import {
  calculatePersonalCurrentAssetsLessCurrentLiabilities,
  calculatePersonalCurrentRatio,
} from "./personal-liquidity";
import {
  getPersonalSecAnnualFilingReason,
  getPersonalSecAnnualSourceReason,
  getPersonalSecAnnualUtilityAge,
} from "./personal-sec-annual-evidence";

type Input = PersonalSecAnnualLiquidityResolutionInput;
type Metric = PersonalSecAnnualLiquidityMetricEvidenceDto;
type Row = PersonalSecAnnualLiquidityObservationDto;
type Amount = PersonalSecAnnualLiquidityValueDto<"USD">;
type Reason = PersonalSecAnnualLiquidityUnavailableReason;

export type PersonalSecAnnualLiquidityHistoryReason =
  Reason | "current_use_unavailable";

export type PersonalSecAnnualLiquidityHistoryCalculation<
  Unit extends "USD" | "multiple",
> =
  | Pick<
      Extract<
        PersonalSecAnnualLiquidityValueDto<Unit>,
        { status: "available" }
      >,
      "status" | "unit" | "value" | "observationIds"
    >
  | Extract<
      PersonalSecAnnualLiquidityValueDto<Unit>,
      { status: "unavailable" }
    >;

export type PersonalSecAnnualLiquidityHistoryBalance = Readonly<{
  asOfDate: string;
  currentAssets: string;
  currentLiabilities: string;
  workingCapital: PersonalSecAnnualLiquidityHistoryCalculation<"USD">;
  currentRatio: PersonalSecAnnualLiquidityHistoryCalculation<"multiple">;
  observationIds: readonly `sec-fact:${string}`[];
}>;

export type PersonalSecAnnualLiquidityHistory =
  | Readonly<{
      status: "unavailable";
      reason: PersonalSecAnnualLiquidityHistoryReason;
    }>
  | Readonly<{
      status: "available";
      accessionNumber: string;
      balances: readonly PersonalSecAnnualLiquidityHistoryBalance[];
      stopped: Readonly<{
        asOfDate: string;
        reason: PersonalSecAnnualLiquidityHistoryReason;
      }> | null;
    }>;

const limits = PERSONAL_SEC_ANNUAL_LIQUIDITY_LIMITS;
const rowReasons: readonly Reason[] = [
  "unsupported_form",
  "missing_or_non_FY_focus",
  "invalid_instant_period",
  "filing_unmatched_or_conflicted",
  "report_end_mismatch",
  "future_or_inconsistent_dates",
  "cutoff_time_unresolved",
  "report_date_missing",
  "filed_date_missing",
];

function requireValid(value: unknown): asserts value {
  if (!value) throw new TypeError("Invalid annual liquidity evidence.");
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function unavailable(reason: Reason, rows: readonly Row[] = []): Amount {
  return {
    status: "unavailable",
    unit: "USD",
    reason,
    observationIds: rows.map((row) => row.id),
  };
}

function validCounts(coverage: PersonalSecAnnualLiquidityCoverageDto): void {
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
  requireValid(
    (metric.scan.status === "source_unavailable") !==
      (input.generation.sources.companyFacts.status === "available"),
  );
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
  requireValid(
    (metric.scan.absence !== null) === (coverage.full.candidateRows === 0),
  );
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
  requireValid(
    coverage.returned === expected && omittedSelected === selected! - expected,
  );
}

function validateMetric(
  metric: Metric,
  concept: PersonalSecAnnualLiquidityConcept,
  input: Input,
  ids: Set<string>,
): void {
  selectedCounts(metric, input);
  const expectedMetric =
    concept === "AssetsCurrent" ? "current_assets" : "current_liabilities";
  const locators = new Set<string>();
  for (const row of metric.observations) {
    requireValid(
      row.concept === concept &&
        row.metric === expectedMetric &&
        row.taxonomy === "us-gaap" &&
        row.unit === "USD",
    );
    requireValid(
      typeof row.value === "string" &&
        row.value.length <= limits.decimalCharacters &&
        /^-?(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/u.test(row.value) &&
        row.value !== "-0",
    );
    requireValid(/^sec-fact:[a-f0-9]{64}$/u.test(row.id) && !ids.has(row.id));
    ids.add(row.id);
    requireValid(
      input.target.status === "target" &&
        row.accessionNumber === input.target.accessionNumber,
    );
    const locator = new RegExp(
      `^/facts/us-gaap/${concept}/units/USD/(?:0|[1-9][0-9]{0,3})$`,
      "u",
    );
    requireValid(
      metric.scan.status === "available" &&
        locator.test(row.sourceLocator) &&
        !locators.has(row.sourceLocator) &&
        Number(row.sourceLocator.split("/").at(-1)) <
          metric.scan.coverage.full.candidateRows,
    );
    locators.add(row.sourceLocator);
  }
}

function filingReason(input: Input): Reason | null {
  requireValid(input.target.status === "target");
  const reason = getPersonalSecAnnualFilingReason(
    input.target,
    input.generation.cutoffAt,
    input.generation.sources.submissions.fetchedAt!,
  );
  if (reason === null) return null;
  requireValid(
    reason === "invalid_clock" || rowReasons.includes(reason as Reason),
  );
  return reason as Reason;
}

function contextReason(input: Input): Reason | null {
  const reason = getPersonalSecAnnualSourceReason(input.generation);
  if (reason !== null) return reason;
  if (input.target.status !== "target") return "target_unresolved";
  const filing = filingReason(input);
  if (filing !== null) return filing;
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

function instantRowReason(
  row: Row,
  input: Input,
  candidateDate?: string,
): Reason | null {
  requireValid(input.target.status === "target");
  const target = input.target;
  if (row.form !== "10-K" && row.form !== "20-F") return "unsupported_form";
  if (row.filingFocusPeriod !== "FY") return "missing_or_non_FY_focus";
  if (row.startDate !== null || row.durationDays !== null)
    return "invalid_instant_period";
  const filing = row.filing;
  const url = `https://www.sec.gov/Archives/edgar/data/${input.cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`;
  if (
    filing.status !== "matched" ||
    row.form !== target.form ||
    row.filedDate !== target.filedDate ||
    filing.form !== row.form ||
    filing.filedDate !== row.filedDate ||
    filing.acceptedAt !== target.acceptedAt ||
    filing.sourceUrl !== url
  )
    return "filing_unmatched_or_conflicted";
  if (
    filing.reportDate !== target.reportDate ||
    row.endDate !== (candidateDate ?? target.reportDate)
  )
    return "report_end_mismatch";
  if (row.endDate > row.filedDate) return "future_or_inconsistent_dates";
  return null;
}

function resolveMetric(
  metric: Metric,
  input: Input,
  globalReason: Reason | null,
  currentUseEligible: boolean,
  candidateDate?: string,
): Amount {
  const refused = globalReason ?? scanReason(metric);
  if (refused !== null) return unavailable(refused, metric.observations);
  requireValid(input.target.status === "target");
  const reportDate = candidateDate ?? input.target.reportDate;
  const rows = metric.observations.filter((row) => row.endDate === reportDate);
  if (rows.length === 0) return unavailable("no_report_date");
  const reasons = rows.map((row) =>
    instantRowReason(row, input, candidateDate),
  );
  const reason = rowReasons.find((candidate) => reasons.includes(candidate));
  if (reason) return unavailable(reason, rows);
  const first = rows[0]!;
  if (rows.some((row) => row.value !== first.value))
    return unavailable("ambiguous_value", rows);
  return {
    status: "available",
    unit: "USD",
    value: first.value,
    asOfDate: first.endDate,
    accessionNumber: first.accessionNumber,
    observationIds: rows.map((row) => row.id),
    currentUseEligible,
  };
}

function calculation<Unit extends "USD" | "multiple">(
  assets: Amount,
  liabilities: Amount,
  unit: Unit,
): PersonalSecAnnualLiquidityValueDto<Unit> {
  const observationIds = [
    ...assets.observationIds,
    ...liabilities.observationIds,
  ];
  if (assets.status === "unavailable")
    return { ...assets, unit, observationIds };
  if (liabilities.status === "unavailable")
    return { ...liabilities, unit, observationIds };
  if (assets.asOfDate !== liabilities.asOfDate)
    return {
      status: "unavailable",
      unit,
      reason: "balance_date_mismatch",
      observationIds,
    };
  if (assets.accessionNumber !== liabilities.accessionNumber)
    return {
      status: "unavailable",
      unit,
      reason: "filing_mismatch",
      observationIds,
    };
  const result =
    unit === "USD"
      ? calculatePersonalCurrentAssetsLessCurrentLiabilities(
          assets.value,
          liabilities.value,
        )
      : calculatePersonalCurrentRatio(assets.value, liabilities.value);
  if (result.status === "unavailable")
    return { ...result, unit, observationIds };
  requireValid(
    result.value.length <=
      (unit === "USD" ? limits.differenceCharacters : limits.ratioCharacters),
  );
  return {
    ...assets,
    ...result,
    unit,
    observationIds,
    currentUseEligible:
      assets.currentUseEligible && liabilities.currentUseEligible,
  };
}

/** Resolve only the selected annual filing's exact report-date balances. */
export function resolvePersonalSecAnnualLiquidity(
  input: Input,
): PersonalSecAnnualLiquidityResolutionDto {
  const { currentAssets, currentLiabilities } = input.liquidity;
  const ids = new Set<string>();
  validateMetric(currentAssets, "AssetsCurrent", input, ids);
  validateMetric(currentLiabilities, "LiabilitiesCurrent", input, ids);
  const reason = contextReason(input);
  const utilityAge = getPersonalSecAnnualUtilityAge(
    input.generation,
    input.target,
  );
  const current = utilityAge?.withinWindow === true;
  const assets = resolveMetric(currentAssets, input, reason, current);
  const liabilities = resolveMetric(currentLiabilities, input, reason, current);
  return freeze({
    currentAssets: assets,
    currentLiabilities: liabilities,
    workingCapital: calculation(assets, liabilities, "USD"),
    currentRatio: calculation(assets, liabilities, "multiple"),
    utilityAge,
  });
}

function historyCalculation<Unit extends "USD" | "multiple">(
  value: PersonalSecAnnualLiquidityValueDto<Unit>,
): PersonalSecAnnualLiquidityHistoryCalculation<Unit> {
  const common = {
    unit: value.unit,
    observationIds: [...value.observationIds],
  };
  return value.status === "available"
    ? { ...common, status: "available", value: value.value }
    : { ...common, status: "unavailable", reason: value.reason };
}

function historyBalance(
  assets: Extract<Amount, { status: "available" }>,
  liabilities: Extract<Amount, { status: "available" }>,
): PersonalSecAnnualLiquidityHistoryBalance {
  return {
    asOfDate: assets.asOfDate,
    currentAssets: assets.value,
    currentLiabilities: liabilities.value,
    workingCapital: historyCalculation(calculation(assets, liabilities, "USD")),
    currentRatio: historyCalculation(
      calculation(assets, liabilities, "multiple"),
    ),
    observationIds: [...assets.observationIds, ...liabilities.observationIds],
  };
}

function requireBalanceDate(value: string): void {
  requireValid(
    typeof value === "string" && /^[1-9]\d{3}-\d{2}-\d{2}$/u.test(value),
  );
  const instant = Date.parse(`${value}T00:00:00.000Z`);
  requireValid(
    Number.isFinite(instant) &&
      new Date(instant).toISOString().slice(0, 10) === value,
  );
}

/** Complete observed balance dates in one filing; no annual adjacency inference. */
export function resolvePersonalSecAnnualLiquidityHistory(
  input: Input,
): PersonalSecAnnualLiquidityHistory {
  const current = resolvePersonalSecAnnualLiquidity(input);
  const { currentAssets, currentLiabilities } = input.liquidity;
  const rows = [
    ...currentAssets.observations,
    ...currentLiabilities.observations,
  ];
  // The new history entry admits every selected date before ordering candidates.
  for (const row of rows) requireBalanceDate(row.endDate);
  const assets = current.currentAssets;
  const liabilities = current.currentLiabilities;
  if (assets.status === "unavailable")
    return freeze({ status: "unavailable", reason: assets.reason });
  if (liabilities.status === "unavailable")
    return freeze({ status: "unavailable", reason: liabilities.reason });
  if (!assets.currentUseEligible || !liabilities.currentUseEligible)
    return freeze({ status: "unavailable", reason: "current_use_unavailable" });
  requireValid(input.target.status === "target");
  const reportDate = input.target.reportDate;
  requireValid(reportDate !== null);
  if (rows.some((row) => row.endDate > reportDate))
    return freeze({ status: "unavailable", reason: "report_end_mismatch" });

  const dates = [...new Set(rows.map((row) => row.endDate))]
    .filter((date) => date < assets.asOfDate)
    .sort()
    .reverse();
  const balances = [historyBalance(assets, liabilities)];
  let stopped: Extract<
    PersonalSecAnnualLiquidityHistory,
    { status: "available" }
  >["stopped"] = null;
  for (const asOfDate of dates) {
    if (balances.length === 3) break;
    // Only the candidate balance date varies; filing metadata keeps the target.
    const priorAssets = resolveMetric(
      currentAssets,
      input,
      null,
      false,
      asOfDate,
    );
    const priorLiabilities = resolveMetric(
      currentLiabilities,
      input,
      null,
      false,
      asOfDate,
    );
    if (priorAssets.status === "unavailable") {
      stopped = { asOfDate, reason: priorAssets.reason };
      break;
    }
    if (priorLiabilities.status === "unavailable") {
      stopped = { asOfDate, reason: priorLiabilities.reason };
      break;
    }
    balances.push(historyBalance(priorAssets, priorLiabilities));
  }
  return freeze({
    status: "available",
    accessionNumber: assets.accessionNumber,
    balances,
    stopped,
  });
}
