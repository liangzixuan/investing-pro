import {
  PERSONAL_SEC_ANNUAL_BALANCE_SHEET_ABSENCES,
  PERSONAL_SEC_ANNUAL_BALANCE_SHEET_LIMITS,
  PERSONAL_SEC_ANNUAL_SCAN_STATUSES,
  PERSONAL_SEC_ANNUAL_TARGET_REASONS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  type PersonalSecAnnualBalanceSheetConcept,
  type PersonalSecAnnualBalanceSheetMetric,
  type PersonalSecAnnualBalanceSheetMetricEvidenceDto,
  type PersonalSecAnnualBalanceSheetObservationDto,
  type PersonalSecAnnualBalanceSheetResolutionDto,
  type PersonalSecAnnualBalanceSheetResolutionInput,
  type PersonalSecAnnualBalanceSheetUnavailableReason,
  type PersonalSecAnnualBalanceSheetValueDto,
} from "@research-cockpit/contracts";
import {
  getPersonalSecAnnualFilingReason,
  getPersonalSecAnnualSourceReason,
  getPersonalSecAnnualUtilityAge,
} from "./personal-sec-annual-evidence";

type Input = PersonalSecAnnualBalanceSheetResolutionInput;
type Metric = PersonalSecAnnualBalanceSheetMetricEvidenceDto;
type Row = PersonalSecAnnualBalanceSheetObservationDto;
type Amount = PersonalSecAnnualBalanceSheetValueDto;
type Reason = PersonalSecAnnualBalanceSheetUnavailableReason;
const limits = PERSONAL_SEC_ANNUAL_BALANCE_SHEET_LIMITS;
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
const accession = /^\d{10}-\d{2}-\d{6}$/u;
const digest = /^sha256:[a-f0-9]{64}$/u;

function requireValid(value: unknown): asserts value {
  if (!value) throw new TypeError("Invalid annual balance-sheet evidence.");
}

/** Reject accessors, inherited fields and extra keys before reading any fields. */
function record(value: unknown, fields: readonly string[]): void {
  requireValid(value !== null && typeof value === "object");
  const prototype: unknown = Object.getPrototypeOf(value);
  requireValid(prototype === Object.prototype || prototype === null);
  const keys = Reflect.ownKeys(value);
  requireValid(keys.length === fields.length);
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    requireValid(descriptor?.enumerable && "value" in descriptor);
  }
}

function rows(value: readonly Row[]): void {
  requireValid(
    Array.isArray(value) &&
      Object.getPrototypeOf(value) === Array.prototype &&
      value.length <= limits.observationsPerMetric &&
      Reflect.ownKeys(value).length === value.length + 1,
  );
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    requireValid(descriptor?.enumerable && "value" in descriptor);
  }
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function date(value: string): boolean {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/u.test(value))
    return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}

function sourceText(value: string, maximum: number): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)
  );
}

function validateContext(input: Input): void {
  record(input, ["cik", "generation", "target", "balanceSheet"]);
  requireValid(
    typeof input.cik === "string" &&
      /^\d{10}$/u.test(input.cik) &&
      !/^0+$/u.test(input.cik),
  );
  const { generation, target } = input;
  record(generation, [
    "definitionVersion",
    "cutoffAt",
    "completedAt",
    "sources",
    "sha256",
  ]);
  requireValid(
    typeof generation.sha256 === "string" && digest.test(generation.sha256),
  );
  record(generation.sources, ["companyFacts", "submissions"]);
  for (const [name, source] of Object.entries(generation.sources)) {
    record(source, ["status", "sourceUrl", "fetchedAt", "sha256", "bytes"]);
    requireValid(
      [
        "available",
        "not_covered",
        "rate_limited",
        "upstream_unavailable",
        "invalid_response",
        "response_too_large",
        "candidate_limit",
      ].includes(source.status),
    );
    requireValid(
      source.sourceUrl ===
        (name === "companyFacts"
          ? `https://data.sec.gov/api/xbrl/companyfacts/CIK${input.cik}.json`
          : `https://data.sec.gov/submissions/CIK${input.cik}.json`),
    );
    requireValid(
      source.sha256 === null ||
        (typeof source.sha256 === "string" && digest.test(source.sha256)),
    );
    requireValid(
      source.bytes === null ||
        (Number.isSafeInteger(source.bytes) &&
          source.bytes >= 0 &&
          source.bytes <= PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.responseBytes),
    );
    if (source.status === "available")
      requireValid(
        source.sha256 !== null && source.bytes !== null && source.bytes > 0,
      );
  }
  // Closed shape is separate from the shared semantic clock/filing refusal policy.
  requireValid(target !== null && typeof target === "object");
  const status = Object.getOwnPropertyDescriptor(target, "status");
  requireValid(status?.enumerable && "value" in status);
  if (target.status === "target") {
    record(target, [
      "status",
      "accessionNumber",
      "form",
      "filedDate",
      "reportDate",
      "acceptedAt",
    ]);
    requireValid(
      typeof target.accessionNumber === "string" &&
        accession.test(target.accessionNumber),
    );
  } else {
    record(target, ["status", "reason"]);
    requireValid(
      target.status === "unresolved" &&
        PERSONAL_SEC_ANNUAL_TARGET_REASONS.includes(target.reason),
    );
  }
  record(input.balanceSheet, [
    "totalAssets",
    "totalLiabilities",
    "shareholdersEquity",
  ]);
}

function validateScan(metric: Metric, input: Input): void {
  record(metric, ["scan", "observations"]);
  rows(metric.observations);
  record(metric.scan, ["status", "absence", "coverage"]);
  requireValid(PERSONAL_SEC_ANNUAL_SCAN_STATUSES.includes(metric.scan.status));
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
  requireValid(
    metric.scan.absence === null ||
      PERSONAL_SEC_ANNUAL_BALANCE_SHEET_ABSENCES.includes(metric.scan.absence),
  );
  const coverage = metric.scan.coverage;
  record(coverage, [
    "full",
    "selected",
    "otherAccessions",
    "returned",
    "omittedSelected",
  ]);
  const full = coverage.full;
  record(full, [
    "candidateRows",
    "inspectedRows",
    "invalidRows",
    "duplicateRows",
    "uniqueObservations",
  ]);
  requireValid(
    Object.values(full).every(
      (count) =>
        Number.isSafeInteger(count) &&
        count >= 0 &&
        count <= limits.candidateRowsPerMetric,
    ),
  );
  requireValid(
    full.candidateRows === full.inspectedRows &&
      full.inspectedRows ===
        full.invalidRows + full.duplicateRows + full.uniqueObservations,
  );
  requireValid(coverage.returned === metric.observations.length);
  requireValid((metric.scan.absence !== null) === (full.candidateRows === 0));
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
  requireValid(selected! + otherAccessions! === full.uniqueObservations);
  const expected = selected! > limits.observationsPerMetric ? 0 : selected!;
  requireValid(
    coverage.returned === expected && omittedSelected === selected! - expected,
  );
}

function validateRow(row: Row): void {
  record(row, [
    "id",
    "metric",
    "taxonomy",
    "concept",
    "unit",
    "value",
    "startDate",
    "endDate",
    "durationDays",
    "periodBasis",
    "filingFocusYear",
    "filingFocusPeriod",
    "frame",
    "accessionNumber",
    "form",
    "filedDate",
    "sourceLocator",
    "filing",
  ]);
  requireValid(
    typeof row.value === "string" &&
      row.value.length <= limits.decimalCharacters &&
      /^-?(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/u.test(row.value) &&
      row.value !== "-0",
  );
  requireValid(
    date(row.endDate) &&
      date(row.filedDate) &&
      (row.startDate === null || date(row.startDate)),
  );
  requireValid(row.periodBasis === "unresolved");
  requireValid(
    row.startDate === null
      ? row.durationDays === null
      : row.startDate <= row.endDate &&
          row.durationDays ===
            (Date.parse(row.endDate) - Date.parse(row.startDate)) / 86_400_000 +
              1,
  );
  requireValid(
    row.filingFocusYear === null ||
      (Number.isInteger(row.filingFocusYear) &&
        row.filingFocusYear >= 1000 &&
        row.filingFocusYear <= 9999),
  );
  requireValid(
    (row.filingFocusPeriod === null || sourceText(row.filingFocusPeriod, 32)) &&
      (row.frame === null || sourceText(row.frame, 128)) &&
      sourceText(row.form, 32),
  );
  record(row.filing, [
    "status",
    "form",
    "filedDate",
    "reportDate",
    "acceptedAt",
    "sourceUrl",
  ]);
  requireValid(
    [
      "matched",
      "metadata_conflict",
      "not_in_current_submissions",
      "submissions_unavailable",
    ].includes(row.filing.status),
  );
}

function validateMetric(
  metric: Metric,
  concept: PersonalSecAnnualBalanceSheetConcept,
  expectedMetric: PersonalSecAnnualBalanceSheetMetric,
  input: Input,
  ids: Set<string>,
): void {
  validateScan(metric, input);
  const locators = new Set<string>();
  for (const row of metric.observations) {
    validateRow(row);
    requireValid(
      row.concept === concept &&
        row.metric === expectedMetric &&
        row.taxonomy === "us-gaap" &&
        row.unit === "USD",
    );
    requireValid(
      typeof row.id === "string" &&
        /^sec-fact:[a-f0-9]{64}$/u.test(row.id) &&
        !ids.has(row.id),
    );
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
        typeof row.sourceLocator === "string" &&
        locator.test(row.sourceLocator) &&
        !locators.has(row.sourceLocator) &&
        Number(row.sourceLocator.split("/").at(-1)) <
          metric.scan.coverage.full.candidateRows,
    );
    locators.add(row.sourceLocator);
  }
}

function contextReason(input: Input): Reason | null {
  const reason = getPersonalSecAnnualSourceReason(input.generation);
  if (reason !== null) return reason;
  if (input.target.status !== "target") return "target_unresolved";
  if (input.target.form !== "10-K" && input.target.form !== "20-F")
    return "unsupported_form";
  const filing = getPersonalSecAnnualFilingReason(
    input.target,
    input.generation.cutoffAt,
    input.generation.sources.submissions.fetchedAt!,
  );
  if (filing !== null) {
    requireValid(
      filing === "invalid_clock" || rowReasons.includes(filing as Reason),
    );
    return filing as Reason;
  }
  const age = getPersonalSecAnnualUtilityAge(input.generation, input.target)!;
  return age.sourceAgeDays.some((days) => days > 7) ? "source_stale" : null;
}

function scanReason(metric: Metric): Reason | null {
  if (metric.scan.status !== "available") return metric.scan.status;
  if (metric.scan.coverage.full.invalidRows > 0) return "invalid_source_rows";
  if (metric.scan.coverage.selected! > limits.observationsPerMetric)
    return "selected_report_overflow";
  return metric.scan.absence;
}

function rowReason(row: Row, input: Input): Reason | null {
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
    row.endDate !== target.reportDate
  )
    return "report_end_mismatch";
  if (row.endDate > row.filedDate) return "future_or_inconsistent_dates";
  return null;
}

function unavailable(reason: Reason, values: readonly Row[] = []): Amount {
  return {
    status: "unavailable",
    unit: "USD",
    reason,
    observationIds: values.map((row) => row.id),
  };
}

function resolveMetric(
  metric: Metric,
  input: Input,
  globalReason: Reason | null,
  currentUseEligible: boolean,
): Amount {
  const refused = globalReason ?? scanReason(metric);
  if (refused !== null) return unavailable(refused, metric.observations);
  requireValid(input.target.status === "target");
  const reportDate = input.target.reportDate;
  const values = metric.observations.filter(
    (row) => row.endDate === reportDate,
  );
  if (values.length === 0) return unavailable("no_report_date");
  const reasons = values.map((row) => rowReason(row, input));
  const reason = rowReasons.find((candidate) => reasons.includes(candidate));
  if (reason) return unavailable(reason, values);
  const first = values[0]!;
  if (values.some((row) => row.value !== first.value))
    return unavailable("ambiguous_value", values);
  return {
    status: "available",
    unit: "USD",
    value: first.value,
    asOfDate: first.endDate,
    accessionNumber: first.accessionNumber,
    observationIds: values.map((row) => row.id),
    currentUseEligible,
  };
}

/** Independent exact reported totals at the selected annual filing's report date. */
export function resolvePersonalSecAnnualBalanceSheet(
  input: Input,
): PersonalSecAnnualBalanceSheetResolutionDto {
  validateContext(input);
  const { totalAssets, totalLiabilities, shareholdersEquity } =
    input.balanceSheet;
  const ids = new Set<string>();
  validateMetric(totalAssets, "Assets", "total_assets", input, ids);
  validateMetric(
    totalLiabilities,
    "Liabilities",
    "total_liabilities",
    input,
    ids,
  );
  validateMetric(
    shareholdersEquity,
    "StockholdersEquity",
    "shareholders_equity",
    input,
    ids,
  );
  const reason = contextReason(input);
  const utilityAge = getPersonalSecAnnualUtilityAge(
    input.generation,
    input.target,
  );
  const current = utilityAge?.withinWindow === true;
  return freeze({
    totalAssets: resolveMetric(totalAssets, input, reason, current),
    totalLiabilities: resolveMetric(totalLiabilities, input, reason, current),
    shareholdersEquity: resolveMetric(
      shareholdersEquity,
      input,
      reason,
      current,
    ),
    utilityAge,
  });
}
