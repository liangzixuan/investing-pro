import Decimal from "decimal.js";

export const PERSONAL_FINANCIAL_QUALITY_SCORECARD_SCHEMA_VERSION =
  "1.0.0" as const;
export const PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULA_SET_VERSION =
  "1.0.0" as const;
export const PERSONAL_FINANCIAL_QUALITY_SCORECARD_MAX_ANNUAL_PERIODS =
  10 as const;
export const PERSONAL_FINANCIAL_QUALITY_SCORECARD_MAX_SOURCE_REF_CODE_POINTS =
  512 as const;

export const PERSONAL_FINANCIAL_QUALITY_SCORECARD_FACT_KEYS = Object.freeze([
  "assets",
  "current_assets",
  "current_liabilities",
  "debt",
  "free_cash_flow",
  "gross_profit",
  "net_income",
  "operating_cash_flow",
  "operating_income",
  "revenue",
  "shareholders_equity",
] as const);

export const PERSONAL_FINANCIAL_QUALITY_SCORECARD_GROUP_IDS = Object.freeze([
  "profitability_cash",
  "growth_efficiency",
  "balance_sheet",
] as const);

export const PERSONAL_FINANCIAL_QUALITY_SCORECARD_CHECK_IDS = Object.freeze([
  "positive_net_income",
  "positive_operating_cash_flow",
  "positive_free_cash_flow",
  "operating_cash_flow_exceeds_net_income",
  "positive_revenue_growth",
  "gross_margin_not_declining",
  "operating_margin_not_declining",
  "revenue_to_ending_assets_not_declining",
  "positive_shareholders_equity",
  "current_ratio_at_least_one",
  "current_ratio_not_declining",
  "debt_to_assets_not_rising",
] as const);

export const PERSONAL_FINANCIAL_QUALITY_SCORECARD_UNAVAILABLE_REASONS =
  Object.freeze([
    "insufficient_periods",
    "non_consecutive_fiscal_years",
    "missing_input",
    "ambiguous_fact",
    "invalid_decimal",
    "invalid_unit",
    "invalid_source_ref",
    "nonpositive_denominator",
  ] as const);

export const PERSONAL_FINANCIAL_QUALITY_SCORECARD_QUARANTINE_REASONS =
  Object.freeze([
    "invalid_shape",
    "invalid_as_of",
    "too_many_periods",
    "invalid_fiscal_year",
    "invalid_statement_date",
    "statement_date_after_as_of",
    "duplicate_fiscal_year",
    "periods_not_strictly_descending",
  ] as const);

export type PersonalFinancialQualityScorecardFactKey =
  (typeof PERSONAL_FINANCIAL_QUALITY_SCORECARD_FACT_KEYS)[number];
export type PersonalFinancialQualityScorecardGroupId =
  (typeof PERSONAL_FINANCIAL_QUALITY_SCORECARD_GROUP_IDS)[number];
export type PersonalFinancialQualityScorecardCheckId =
  (typeof PERSONAL_FINANCIAL_QUALITY_SCORECARD_CHECK_IDS)[number];
export type PersonalFinancialQualityScorecardUnavailableReason =
  (typeof PERSONAL_FINANCIAL_QUALITY_SCORECARD_UNAVAILABLE_REASONS)[number];
export type PersonalFinancialQualityScorecardQuarantineReason =
  (typeof PERSONAL_FINANCIAL_QUALITY_SCORECARD_QUARANTINE_REASONS)[number];

export interface PersonalFinancialQualityScorecardFactInput {
  readonly key: PersonalFinancialQualityScorecardFactKey;
  readonly sourceRef: string;
  readonly unit: "USD";
  readonly value: string;
}

export interface PersonalFinancialQualityScorecardAnnualPeriodInput {
  readonly facts: readonly PersonalFinancialQualityScorecardFactInput[];
  readonly fiscalYear: number;
  readonly statementDate: string;
}

export interface PersonalFinancialQualityScorecardInput {
  readonly asOf: string;
  readonly periods: readonly PersonalFinancialQualityScorecardAnnualPeriodInput[];
}

export interface PersonalFinancialQualityScorecardInputRef {
  readonly factKey: PersonalFinancialQualityScorecardFactKey;
  readonly sourceRef: string;
}

export interface PersonalFinancialQualityScorecardObservation {
  readonly fiscalYear: number;
  readonly inputRefs: readonly PersonalFinancialQualityScorecardInputRef[];
  readonly statementDate: string;
  readonly unit: "USD" | "ratio";
  readonly value: string | null;
}

interface PersonalFinancialQualityScorecardCheckBase {
  readonly checkId: PersonalFinancialQualityScorecardCheckId;
  readonly currentObservation: PersonalFinancialQualityScorecardObservation | null;
  readonly expression: string;
  readonly formulaId: string;
  readonly formulaVersion: typeof PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULA_SET_VERSION;
  readonly groupId: PersonalFinancialQualityScorecardGroupId;
  readonly label: string;
  readonly priorObservation: PersonalFinancialQualityScorecardObservation | null;
}

export type PersonalFinancialQualityScorecardCheck =
  | (PersonalFinancialQualityScorecardCheckBase &
      Readonly<{ status: "met" | "not_met" }>)
  | (PersonalFinancialQualityScorecardCheckBase &
      Readonly<{
        reason: PersonalFinancialQualityScorecardUnavailableReason;
        status: "unavailable";
      }>);

export interface PersonalFinancialQualityScorecardGroup {
  readonly checks: readonly PersonalFinancialQualityScorecardCheck[];
  readonly groupId: PersonalFinancialQualityScorecardGroupId;
  readonly label: string;
}

export interface PersonalFinancialQualityScorecardCounts {
  readonly evaluated: number;
  readonly met: number;
  readonly notMet: number;
  readonly total: 12;
  readonly unavailable: number;
}

export interface PersonalFinancialQualityScorecardQuarantineIssue {
  readonly index: number | null;
  readonly reason: PersonalFinancialQualityScorecardQuarantineReason;
}

export interface PersonalFinancialQualityScorecardReadyResult {
  readonly asOf: string;
  readonly counts: PersonalFinancialQualityScorecardCounts;
  readonly formulaSetVersion: typeof PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULA_SET_VERSION;
  readonly groups: readonly PersonalFinancialQualityScorecardGroup[];
  readonly schemaVersion: typeof PERSONAL_FINANCIAL_QUALITY_SCORECARD_SCHEMA_VERSION;
  readonly status: "ready";
}

export interface PersonalFinancialQualityScorecardQuarantinedResult {
  readonly asOf: string | null;
  readonly formulaSetVersion: typeof PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULA_SET_VERSION;
  readonly issues: readonly PersonalFinancialQualityScorecardQuarantineIssue[];
  readonly schemaVersion: typeof PERSONAL_FINANCIAL_QUALITY_SCORECARD_SCHEMA_VERSION;
  readonly status: "quarantined";
}

export type PersonalFinancialQualityScorecardResult =
  | PersonalFinancialQualityScorecardReadyResult
  | PersonalFinancialQualityScorecardQuarantinedResult;

interface FormulaDefinition {
  readonly expression: string;
  readonly formulaId: string;
  readonly formulaVersion: typeof PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULA_SET_VERSION;
  readonly groupId: PersonalFinancialQualityScorecardGroupId;
  readonly label: string;
}

export const PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULAS = freezeDeep({
  positive_net_income: formula(
    "profitability_positive_net_income",
    "net_income > 0",
    "profitability_cash",
    "Positive net income",
  ),
  positive_operating_cash_flow: formula(
    "cash_generation_positive_operating_cash_flow",
    "operating_cash_flow > 0",
    "profitability_cash",
    "Positive operating cash flow",
  ),
  positive_free_cash_flow: formula(
    "cash_generation_positive_free_cash_flow",
    "free_cash_flow > 0",
    "profitability_cash",
    "Positive free cash flow",
  ),
  operating_cash_flow_exceeds_net_income: formula(
    "cash_conversion_operating_cash_flow_exceeds_net_income",
    "operating_cash_flow - net_income > 0",
    "profitability_cash",
    "Operating cash flow exceeds net income",
  ),
  positive_revenue_growth: formula(
    "growth_positive_year_over_year_revenue",
    "current_revenue / prior_revenue - 1 > 0",
    "growth_efficiency",
    "Positive revenue growth",
  ),
  gross_margin_not_declining: formula(
    "efficiency_gross_margin_not_declining",
    "current_gross_profit / current_revenue >= prior_gross_profit / prior_revenue",
    "growth_efficiency",
    "Gross margin not declining",
  ),
  operating_margin_not_declining: formula(
    "efficiency_operating_margin_not_declining",
    "current_operating_income / current_revenue >= prior_operating_income / prior_revenue",
    "growth_efficiency",
    "Operating margin not declining",
  ),
  revenue_to_ending_assets_not_declining: formula(
    "efficiency_revenue_to_ending_assets_not_declining",
    "current_revenue / current_ending_assets >= prior_revenue / prior_ending_assets",
    "growth_efficiency",
    "Revenue to ending assets not declining",
  ),
  positive_shareholders_equity: formula(
    "balance_sheet_positive_shareholders_equity",
    "shareholders_equity > 0",
    "balance_sheet",
    "Positive shareholders' equity",
  ),
  current_ratio_at_least_one: formula(
    "liquidity_current_ratio_at_least_one",
    "current_assets / current_liabilities >= 1",
    "balance_sheet",
    "Current ratio at least 1",
  ),
  current_ratio_not_declining: formula(
    "liquidity_current_ratio_not_declining",
    "current_current_assets / current_current_liabilities >= prior_current_assets / prior_current_liabilities",
    "balance_sheet",
    "Current ratio not declining",
  ),
  debt_to_assets_not_rising: formula(
    "leverage_debt_to_assets_not_rising",
    "current_debt / current_assets <= prior_debt / prior_assets",
    "balance_sheet",
    "Debt to assets not rising",
  ),
} satisfies Readonly<
  Record<PersonalFinancialQualityScorecardCheckId, FormulaDefinition>
>);

interface CandidateFact {
  readonly key: PersonalFinancialQualityScorecardFactKey;
  readonly sourceRef: unknown;
  readonly unit: unknown;
  readonly value: unknown;
}

interface ValidatedPeriod {
  readonly facts: readonly CandidateFact[];
  readonly fiscalYear: number;
  readonly statementDate: string;
}

interface ValidatedInput {
  readonly asOf: string;
  readonly periods: readonly ValidatedPeriod[];
}

type FactResolution =
  | Readonly<{ fact: ResolvedFact; status: "available" }>
  | Readonly<{
      facts: readonly CandidateFact[];
      reason: Exclude<
        PersonalFinancialQualityScorecardUnavailableReason,
        | "insufficient_periods"
        | "non_consecutive_fiscal_years"
        | "nonpositive_denominator"
      >;
      status: "unavailable";
    }>;

interface ResolvedFact {
  readonly decimal: Decimal;
  readonly key: PersonalFinancialQualityScorecardFactKey;
  readonly sourceRef: string;
}

interface PeriodContext {
  readonly period: ValidatedPeriod;
  readonly resolutions: Readonly<
    Record<PersonalFinancialQualityScorecardFactKey, FactResolution>
  >;
}

interface ObservationEvaluation {
  readonly observation: PersonalFinancialQualityScorecardObservation;
  readonly reason?: PersonalFinancialQualityScorecardUnavailableReason;
  readonly value?: Decimal;
}

const QualityDecimal = Decimal.clone({
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
});
const INPUT_KEYS = Object.freeze(["asOf", "periods"] as const);
const PERIOD_KEYS = Object.freeze([
  "facts",
  "fiscalYear",
  "statementDate",
] as const);
const FACT_KEYS = Object.freeze(["key", "sourceRef", "unit", "value"] as const);
const MAX_FACTS_PER_PERIOD = 64;
const DECIMAL_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;
const UNSAFE_SOURCE_REF_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const GROUP_LABELS = freezeDeep({
  balance_sheet: "Balance sheet",
  growth_efficiency: "Growth and efficiency",
  profitability_cash: "Profitability and cash",
} satisfies Readonly<Record<PersonalFinancialQualityScorecardGroupId, string>>);

export function buildPersonalFinancialQualityScorecard(
  input: unknown,
): PersonalFinancialQualityScorecardResult {
  try {
    const validation = validateInput(input);
    if (validation.issues.length > 0 || validation.input === null) {
      return quarantined(safeAsOf(input), validation.issues);
    }
    return buildReady(validation.input);
  } catch {
    return quarantined(safeAsOf(input), [
      { index: null, reason: "invalid_shape" },
    ]);
  }
}

function buildReady(
  input: ValidatedInput,
): PersonalFinancialQualityScorecardReadyResult {
  const contexts = input.periods.map((period) => ({
    period,
    resolutions: resolveFacts(period.facts),
  }));
  const current = contexts[0];
  const prior = contexts[1];
  const checks = [
    currentCheck(
      "positive_net_income",
      current,
      rawSpecification("net_income"),
      (value) => value.greaterThan(0),
    ),
    currentCheck(
      "positive_operating_cash_flow",
      current,
      rawSpecification("operating_cash_flow"),
      (value) => value.greaterThan(0),
    ),
    currentCheck(
      "positive_free_cash_flow",
      current,
      rawSpecification("free_cash_flow"),
      (value) => value.greaterThan(0),
    ),
    currentCheck(
      "operating_cash_flow_exceeds_net_income",
      current,
      specification(["operating_cash_flow", "net_income"], "USD", (values) =>
        values[0]!.minus(values[1]!),
      ),
      (value) => value.greaterThan(0),
    ),
    trendCheck(
      "positive_revenue_growth",
      current,
      prior,
      rawSpecification("revenue"),
      (currentValue, priorValue) =>
        currentValue.div(priorValue).minus(1).greaterThan(0),
      true,
    ),
    trendCheck(
      "gross_margin_not_declining",
      current,
      prior,
      ratioSpecification("gross_profit", "revenue"),
      (currentValue, priorValue) =>
        currentValue.greaterThanOrEqualTo(priorValue),
    ),
    trendCheck(
      "operating_margin_not_declining",
      current,
      prior,
      ratioSpecification("operating_income", "revenue"),
      (currentValue, priorValue) =>
        currentValue.greaterThanOrEqualTo(priorValue),
    ),
    trendCheck(
      "revenue_to_ending_assets_not_declining",
      current,
      prior,
      ratioSpecification("revenue", "assets"),
      (currentValue, priorValue) =>
        currentValue.greaterThanOrEqualTo(priorValue),
    ),
    currentCheck(
      "positive_shareholders_equity",
      current,
      rawSpecification("shareholders_equity"),
      (value) => value.greaterThan(0),
    ),
    currentCheck(
      "current_ratio_at_least_one",
      current,
      ratioSpecification("current_assets", "current_liabilities"),
      (value) => value.greaterThanOrEqualTo(1),
    ),
    trendCheck(
      "current_ratio_not_declining",
      current,
      prior,
      ratioSpecification("current_assets", "current_liabilities"),
      (currentValue, priorValue) =>
        currentValue.greaterThanOrEqualTo(priorValue),
    ),
    trendCheck(
      "debt_to_assets_not_rising",
      current,
      prior,
      ratioSpecification("debt", "assets"),
      (currentValue, priorValue) => currentValue.lessThanOrEqualTo(priorValue),
    ),
  ] satisfies PersonalFinancialQualityScorecardCheck[];
  const groups = PERSONAL_FINANCIAL_QUALITY_SCORECARD_GROUP_IDS.map(
    (groupId) => ({
      checks: checks.filter((check) => check.groupId === groupId),
      groupId,
      label: GROUP_LABELS[groupId],
    }),
  );
  const met = checks.filter((check) => check.status === "met").length;
  const notMet = checks.filter((check) => check.status === "not_met").length;
  const unavailable = checks.length - met - notMet;
  return freezeDeep({
    asOf: input.asOf,
    counts: {
      evaluated: met + notMet,
      met,
      notMet,
      total: 12,
      unavailable,
    },
    formulaSetVersion: PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULA_SET_VERSION,
    groups,
    schemaVersion: PERSONAL_FINANCIAL_QUALITY_SCORECARD_SCHEMA_VERSION,
    status: "ready",
  });
}

interface ObservationSpecification {
  readonly denominatorIndex?: number;
  readonly keys: readonly PersonalFinancialQualityScorecardFactKey[];
  readonly unit: "USD" | "ratio";
  readonly value: (values: readonly Decimal[]) => Decimal;
}

function specification(
  keys: readonly PersonalFinancialQualityScorecardFactKey[],
  unit: "USD" | "ratio",
  value: (values: readonly Decimal[]) => Decimal,
  denominatorIndex?: number,
): ObservationSpecification {
  return denominatorIndex === undefined
    ? { keys, unit, value }
    : { denominatorIndex, keys, unit, value };
}

function rawSpecification(
  key: PersonalFinancialQualityScorecardFactKey,
): ObservationSpecification {
  return specification([key], "USD", (values) => values[0]!);
}

function ratioSpecification(
  numerator: PersonalFinancialQualityScorecardFactKey,
  denominator: PersonalFinancialQualityScorecardFactKey,
): ObservationSpecification {
  return specification(
    [numerator, denominator],
    "ratio",
    (values) => values[0]!.div(values[1]!),
    1,
  );
}

function currentCheck(
  checkId: PersonalFinancialQualityScorecardCheckId,
  current: PeriodContext | undefined,
  observationSpecification: ObservationSpecification,
  predicate: (value: Decimal) => boolean,
): PersonalFinancialQualityScorecardCheck {
  if (current === undefined) {
    return unavailableCheck(checkId, null, null, "insufficient_periods");
  }
  const currentEvaluation = evaluateObservation(
    current,
    observationSpecification,
  );
  if (currentEvaluation.reason !== undefined) {
    return unavailableCheck(
      checkId,
      currentEvaluation.observation,
      null,
      currentEvaluation.reason,
    );
  }
  return evaluatedCheck(
    checkId,
    currentEvaluation.observation,
    null,
    predicate(requiredValue(currentEvaluation)),
  );
}

function trendCheck(
  checkId: PersonalFinancialQualityScorecardCheckId,
  current: PeriodContext | undefined,
  prior: PeriodContext | undefined,
  observationSpecification: ObservationSpecification,
  predicate: (currentValue: Decimal, priorValue: Decimal) => boolean,
  requirePositivePrior: boolean = false,
): PersonalFinancialQualityScorecardCheck {
  if (current === undefined) {
    return unavailableCheck(checkId, null, null, "insufficient_periods");
  }
  const currentEvaluation = evaluateObservation(
    current,
    observationSpecification,
  );
  if (prior === undefined) {
    return unavailableCheck(
      checkId,
      currentEvaluation.observation,
      null,
      "insufficient_periods",
    );
  }
  const priorEvaluation = evaluateObservation(prior, observationSpecification);
  if (current.period.fiscalYear - prior.period.fiscalYear !== 1) {
    return unavailableCheck(
      checkId,
      currentEvaluation.observation,
      priorEvaluation.observation,
      "non_consecutive_fiscal_years",
    );
  }
  if (currentEvaluation.reason !== undefined) {
    return unavailableCheck(
      checkId,
      currentEvaluation.observation,
      priorEvaluation.observation,
      currentEvaluation.reason,
    );
  }
  if (priorEvaluation.reason !== undefined) {
    return unavailableCheck(
      checkId,
      currentEvaluation.observation,
      priorEvaluation.observation,
      priorEvaluation.reason,
    );
  }
  const currentValue = requiredValue(currentEvaluation);
  const priorValue = requiredValue(priorEvaluation);
  if (requirePositivePrior && priorValue.lessThanOrEqualTo(0)) {
    return unavailableCheck(
      checkId,
      currentEvaluation.observation,
      priorEvaluation.observation,
      "nonpositive_denominator",
    );
  }
  return evaluatedCheck(
    checkId,
    currentEvaluation.observation,
    priorEvaluation.observation,
    predicate(currentValue, priorValue),
  );
}

function evaluateObservation(
  context: PeriodContext,
  specification: ObservationSpecification,
): ObservationEvaluation {
  const resolutions = specification.keys.map((key) => context.resolutions[key]);
  const inputRefs = resolutions.flatMap(resolutionInputRefs);
  const unavailable = resolutions.find(
    (
      resolution,
    ): resolution is Extract<FactResolution, { status: "unavailable" }> =>
      resolution.status === "unavailable",
  );
  if (unavailable !== undefined) {
    return {
      observation: observation(context.period, inputRefs, specification.unit),
      reason: unavailable.reason,
    };
  }
  const values = resolutions.map(
    (resolution) => availableFact(resolution).decimal,
  );
  if (
    specification.denominatorIndex !== undefined &&
    values[specification.denominatorIndex]!.lessThanOrEqualTo(0)
  ) {
    return {
      observation: observation(context.period, inputRefs, specification.unit),
      reason: "nonpositive_denominator",
    };
  }
  const value = specification.value(values);
  return {
    observation: observation(
      context.period,
      inputRefs,
      specification.unit,
      normalizeDecimal(value),
    ),
    value,
  };
}

function observation(
  period: ValidatedPeriod,
  inputRefs: readonly PersonalFinancialQualityScorecardInputRef[],
  unit: "USD" | "ratio",
  value: string | null = null,
): PersonalFinancialQualityScorecardObservation {
  return {
    fiscalYear: period.fiscalYear,
    inputRefs,
    statementDate: period.statementDate,
    unit,
    value,
  };
}

function evaluatedCheck(
  checkId: PersonalFinancialQualityScorecardCheckId,
  currentObservation: PersonalFinancialQualityScorecardObservation,
  priorObservation: PersonalFinancialQualityScorecardObservation | null,
  met: boolean,
): PersonalFinancialQualityScorecardCheck {
  return {
    checkId,
    currentObservation,
    ...PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULAS[checkId],
    priorObservation,
    status: met ? "met" : "not_met",
  };
}

function unavailableCheck(
  checkId: PersonalFinancialQualityScorecardCheckId,
  currentObservation: PersonalFinancialQualityScorecardObservation | null,
  priorObservation: PersonalFinancialQualityScorecardObservation | null,
  reason: PersonalFinancialQualityScorecardUnavailableReason,
): PersonalFinancialQualityScorecardCheck {
  return {
    checkId,
    currentObservation,
    ...PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULAS[checkId],
    priorObservation,
    reason,
    status: "unavailable",
  };
}

function requiredValue(evaluation: ObservationEvaluation): Decimal {
  if (evaluation.value === undefined) throw new TypeError();
  return evaluation.value;
}

function resolveFacts(
  facts: readonly CandidateFact[],
): Readonly<Record<PersonalFinancialQualityScorecardFactKey, FactResolution>> {
  return Object.fromEntries(
    PERSONAL_FINANCIAL_QUALITY_SCORECARD_FACT_KEYS.map((key) => [
      key,
      resolveFact(key, facts),
    ]),
  ) as Record<PersonalFinancialQualityScorecardFactKey, FactResolution>;
}

function resolveFact(
  key: PersonalFinancialQualityScorecardFactKey,
  facts: readonly CandidateFact[],
): FactResolution {
  const matches = facts.filter((fact) => fact.key === key);
  if (matches.length === 0) {
    return { facts: [], reason: "missing_input", status: "unavailable" };
  }
  if (matches.length !== 1) {
    return { facts: matches, reason: "ambiguous_fact", status: "unavailable" };
  }
  const fact = matches[0]!;
  if (fact.unit !== "USD") {
    return { facts: matches, reason: "invalid_unit", status: "unavailable" };
  }
  if (!isValidSourceRef(fact.sourceRef)) {
    return {
      facts: matches,
      reason: "invalid_source_ref",
      status: "unavailable",
    };
  }
  if (!isCanonicalDecimal(fact.value)) {
    return {
      facts: matches,
      reason: "invalid_decimal",
      status: "unavailable",
    };
  }
  return {
    fact: {
      decimal: new QualityDecimal(fact.value),
      key,
      sourceRef: fact.sourceRef,
    },
    status: "available",
  };
}

function resolutionInputRefs(
  resolution: FactResolution,
): PersonalFinancialQualityScorecardInputRef[] {
  if (resolution.status === "available") {
    return [
      { factKey: resolution.fact.key, sourceRef: resolution.fact.sourceRef },
    ];
  }
  return resolution.facts.flatMap((fact) =>
    isValidSourceRef(fact.sourceRef)
      ? [{ factKey: fact.key, sourceRef: fact.sourceRef }]
      : [],
  );
}

function availableFact(resolution: FactResolution): ResolvedFact {
  if (resolution.status !== "available") throw new TypeError();
  return resolution.fact;
}

function validateInput(input: unknown): {
  readonly input: ValidatedInput | null;
  readonly issues: readonly PersonalFinancialQualityScorecardQuarantineIssue[];
} {
  if (!isExactPlainRecord(input, INPUT_KEYS)) {
    return {
      input: null,
      issues: [{ index: null, reason: "invalid_shape" }],
    };
  }
  const issues: PersonalFinancialQualityScorecardQuarantineIssue[] = [];
  const asOf = dataValue(input, "asOf");
  const periodsValue = dataValue(input, "periods");
  const validAsOf = isCanonicalTimestamp(asOf);
  if (!validAsOf) issues.push({ index: null, reason: "invalid_as_of" });
  if (!isPlainArrayContainer(periodsValue)) {
    issues.push({ index: null, reason: "invalid_shape" });
    return { input: null, issues };
  }
  if (
    periodsValue.length >
    PERSONAL_FINANCIAL_QUALITY_SCORECARD_MAX_ANNUAL_PERIODS
  ) {
    issues.push({ index: null, reason: "too_many_periods" });
    return { input: null, issues };
  }
  if (!isPlainDenseArray(periodsValue)) {
    issues.push({ index: null, reason: "invalid_shape" });
    return { input: null, issues };
  }
  const periods: ValidatedPeriod[] = [];
  const seenYears = new Set<number>();
  for (let index = 0; index < periodsValue.length; index += 1) {
    const candidate = periodsValue[index];
    if (!isExactPlainRecord(candidate, PERIOD_KEYS)) {
      issues.push({ index, reason: "invalid_shape" });
      continue;
    }
    const fiscalYear = dataValue(candidate, "fiscalYear");
    const statementDate = dataValue(candidate, "statementDate");
    const factsValue = dataValue(candidate, "facts");
    const validYear =
      typeof fiscalYear === "number" &&
      Number.isInteger(fiscalYear) &&
      fiscalYear >= 1900 &&
      fiscalYear <= 9999;
    const validDate = isCanonicalDate(statementDate);
    if (!validYear) issues.push({ index, reason: "invalid_fiscal_year" });
    if (!validDate) issues.push({ index, reason: "invalid_statement_date" });
    if (validDate && validAsOf && statementDate > asOf.slice(0, 10)) {
      issues.push({ index, reason: "statement_date_after_as_of" });
    }
    if (!isPlainArrayContainer(factsValue)) {
      issues.push({ index, reason: "invalid_shape" });
      continue;
    }
    if (factsValue.length > MAX_FACTS_PER_PERIOD) {
      issues.push({ index, reason: "invalid_shape" });
      continue;
    }
    if (!isPlainDenseArray(factsValue)) {
      issues.push({ index, reason: "invalid_shape" });
      continue;
    }
    const facts: CandidateFact[] = [];
    let invalidFactShape = false;
    for (const factValue of factsValue) {
      if (!isExactPlainRecord(factValue, FACT_KEYS)) {
        invalidFactShape = true;
        break;
      }
      const key = dataValue(factValue, "key");
      if (!isFactKey(key)) {
        invalidFactShape = true;
        break;
      }
      facts.push({
        key,
        sourceRef: dataValue(factValue, "sourceRef"),
        unit: dataValue(factValue, "unit"),
        value: dataValue(factValue, "value"),
      });
    }
    if (invalidFactShape) {
      issues.push({ index, reason: "invalid_shape" });
      continue;
    }
    if (validYear) {
      if (seenYears.has(fiscalYear)) {
        issues.push({ index, reason: "duplicate_fiscal_year" });
      }
      seenYears.add(fiscalYear);
      const previous = periods.at(-1);
      if (previous !== undefined && previous.fiscalYear <= fiscalYear) {
        issues.push({ index, reason: "periods_not_strictly_descending" });
      }
    }
    if (validYear && validDate) {
      periods.push({ facts, fiscalYear, statementDate });
    }
  }
  if (issues.length > 0) return { input: null, issues };
  if (typeof asOf !== "string") throw new TypeError();
  return { input: { asOf, periods }, issues: [] };
}

function quarantined(
  asOf: string | null,
  issues: readonly PersonalFinancialQualityScorecardQuarantineIssue[],
): PersonalFinancialQualityScorecardQuarantinedResult {
  return freezeDeep({
    asOf,
    formulaSetVersion: PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULA_SET_VERSION,
    issues:
      issues.length > 0
        ? [...issues]
        : [{ index: null, reason: "invalid_shape" as const }],
    schemaVersion: PERSONAL_FINANCIAL_QUALITY_SCORECARD_SCHEMA_VERSION,
    status: "quarantined",
  });
}

function formula(
  formulaId: string,
  expression: string,
  groupId: PersonalFinancialQualityScorecardGroupId,
  label: string,
): FormulaDefinition {
  return {
    expression,
    formulaId,
    formulaVersion: PERSONAL_FINANCIAL_QUALITY_SCORECARD_FORMULA_SET_VERSION,
    groupId,
    label,
  };
}

function isFactKey(
  value: unknown,
): value is PersonalFinancialQualityScorecardFactKey {
  return PERSONAL_FINANCIAL_QUALITY_SCORECARD_FACT_KEYS.some(
    (key) => key === value,
  );
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return false;
  const canonical = parsed.toISOString();
  return value.endsWith(".000Z")
    ? canonical === value
    : canonical.replace(".000Z", "Z") === value;
}

function isCanonicalDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const days = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= (days[month - 1] ?? 0);
}

function isCanonicalDecimal(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !DECIMAL_PATTERN.test(value)
  ) {
    return false;
  }
  try {
    return new QualityDecimal(value).isFinite();
  } catch {
    return false;
  }
}

function isValidSourceRef(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    [...value].length <=
      PERSONAL_FINANCIAL_QUALITY_SCORECARD_MAX_SOURCE_REF_CODE_POINTS &&
    !UNSAFE_SOURCE_REF_PATTERN.test(value)
  );
}

function isPlainArrayContainer(value: unknown): value is readonly unknown[] {
  return (
    Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
  );
}

function isPlainDenseArray(value: unknown): value is readonly unknown[] {
  if (!isPlainArrayContainer(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === "symbol")) return false;
  if (ownKeys.length !== value.length + 1 || ownKeys.at(-1) !== "length") {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) return false;
  }
  return true;
}

function isExactPlainRecord<const Keys extends readonly string[]>(
  value: unknown,
  expectedKeys: Keys,
): value is Record<Keys[number], unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== expectedKeys.length ||
    ownKeys.some(
      (key) => typeof key !== "string" || !expectedKeys.includes(key),
    )
  ) {
    return false;
  }
  return expectedKeys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor;
  });
}

function dataValue(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (descriptor === undefined || !("value" in descriptor))
    throw new TypeError();
  return descriptor.value;
}

function safeAsOf(input: unknown): string | null {
  try {
    if (!isExactPlainRecord(input, INPUT_KEYS)) return null;
    const value = dataValue(input, "asOf");
    return isCanonicalTimestamp(value) ? value : null;
  } catch {
    return null;
  }
}

function normalizeDecimal(value: Decimal): string {
  return value.isZero() ? "0" : value.toFixed();
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
