import Decimal from "decimal.js";

export const PERSONAL_FINANCIAL_ANALYTICS_SCHEMA_VERSION = "1.1.0" as const;
export const PERSONAL_FINANCIAL_ANALYTICS_FORMULA_SET_VERSION =
  "1.0.0" as const;
export const PERSONAL_FINANCIAL_ANALYTICS_MAX_ANNUAL_PERIODS = 10 as const;

export const PERSONAL_FINANCIAL_ANALYTICS_ROUNDING = freezeDeep({
  decimalPlaces: 2,
  method: "round_half_up",
  negativeZero: "normalize_to_positive_zero",
} as const);

export const PERSONAL_FINANCIAL_ANALYTICS_METRIC_KEYS = Object.freeze([
  "grossMargin",
  "operatingMargin",
  "netMargin",
  "operatingCashFlowMargin",
  "freeCashFlowMargin",
  "netDebt",
  "debtToAssets",
  "cashToAssets",
] as const);
export const PERSONAL_FINANCIAL_ANALYTICS_GROWTH_KEYS = Object.freeze([
  "revenue",
  "netIncome",
  "freeCashFlow",
] as const);
export const PERSONAL_FINANCIAL_ANALYTICS_UNAVAILABLE_REASONS = Object.freeze([
  "missing_input",
  "ambiguous_fact",
  "invalid_decimal",
  "invalid_unit",
  "invalid_source_ref",
  "zero_denominator",
] as const);
export const PERSONAL_FINANCIAL_ANALYTICS_GROWTH_UNAVAILABLE_REASONS =
  Object.freeze([
    "insufficient_periods",
    "non_consecutive_fiscal_years",
    "nonpositive_prior",
    ...PERSONAL_FINANCIAL_ANALYTICS_UNAVAILABLE_REASONS,
  ] as const);
export const PERSONAL_FINANCIAL_ANALYTICS_QUARANTINE_REASONS = Object.freeze([
  "invalid_as_of",
  "too_many_periods",
  "invalid_fiscal_year",
  "invalid_statement_date",
  "duplicate_fiscal_year",
  "periods_not_strictly_descending",
] as const);

export const PERSONAL_FINANCIAL_ANALYTICS_FORMULAS = freezeDeep({
  grossMargin: formula("gross_margin_percent", "gross_profit / revenue * 100"),
  operatingMargin: formula(
    "operating_margin_percent",
    "operating_income / revenue * 100",
  ),
  netMargin: formula("net_margin_percent", "net_income / revenue * 100"),
  operatingCashFlowMargin: formula(
    "operating_cash_flow_margin_percent",
    "operating_cash_flow / revenue * 100",
  ),
  freeCashFlowMargin: formula(
    "free_cash_flow_margin_percent",
    "free_cash_flow / revenue * 100",
  ),
  netDebt: formula("net_debt", "debt - cash"),
  debtToAssets: formula("debt_to_assets_percent", "debt / assets * 100"),
  cashToAssets: formula("cash_to_assets_percent", "cash / assets * 100"),
  revenueGrowth: formula(
    "revenue_year_over_year_growth_percent",
    "(current_revenue / prior_revenue - 1) * 100",
  ),
  netIncomeGrowth: formula(
    "net_income_year_over_year_growth_percent",
    "(current_net_income / prior_net_income - 1) * 100",
  ),
  freeCashFlowGrowth: formula(
    "free_cash_flow_year_over_year_growth_percent",
    "(current_free_cash_flow / prior_free_cash_flow - 1) * 100",
  ),
} as const);

export type PersonalFinancialAnalyticsFactKey =
  | "assets"
  | "cash"
  | "debt"
  | "free_cash_flow"
  | "gross_profit"
  | "net_income"
  | "operating_cash_flow"
  | "operating_income"
  | "revenue";
export type PersonalFinancialAnalyticsMetricKey =
  (typeof PERSONAL_FINANCIAL_ANALYTICS_METRIC_KEYS)[number];
export type PersonalFinancialAnalyticsGrowthKey =
  (typeof PERSONAL_FINANCIAL_ANALYTICS_GROWTH_KEYS)[number];
export type PersonalFinancialAnalyticsUnavailableReason =
  (typeof PERSONAL_FINANCIAL_ANALYTICS_UNAVAILABLE_REASONS)[number];
export type PersonalFinancialAnalyticsGrowthUnavailableReason =
  (typeof PERSONAL_FINANCIAL_ANALYTICS_GROWTH_UNAVAILABLE_REASONS)[number];
export type PersonalFinancialAnalyticsQuarantineReason =
  (typeof PERSONAL_FINANCIAL_ANALYTICS_QUARANTINE_REASONS)[number];

export interface PersonalFinancialAnalyticsFactInput {
  readonly key: PersonalFinancialAnalyticsFactKey;
  readonly sourceRef: string;
  readonly unit: "USD";
  readonly value: string;
}
export interface PersonalFinancialAnalyticsAnnualPeriodInput {
  readonly facts: readonly PersonalFinancialAnalyticsFactInput[];
  readonly fiscalYear: number;
  readonly statementDate: string;
}
export interface PersonalFinancialAnalyticsInput {
  readonly asOf: string;
  readonly periods: readonly PersonalFinancialAnalyticsAnnualPeriodInput[];
}
export interface PersonalFinancialAnalyticsInputRef {
  readonly factKey: PersonalFinancialAnalyticsFactKey;
  readonly sourceRef: string;
}

interface FormulaMetadata {
  readonly expression: string;
  readonly formulaId: string;
  readonly formulaVersion: typeof PERSONAL_FINANCIAL_ANALYTICS_FORMULA_SET_VERSION;
}
interface PeriodMetricBase extends FormulaMetadata {
  readonly fiscalYear: number;
  readonly inputRefs: readonly PersonalFinancialAnalyticsInputRef[];
  readonly unit: "USD" | "percent";
}
export type PersonalFinancialAnalyticsPeriodMetric =
  | (PeriodMetricBase & Readonly<{ status: "available"; value: string }>)
  | (PeriodMetricBase &
      Readonly<{
        reason: PersonalFinancialAnalyticsUnavailableReason;
        status: "unavailable";
      }>);
export type PersonalFinancialAnalyticsPeriodMetrics = Readonly<
  Record<
    PersonalFinancialAnalyticsMetricKey,
    PersonalFinancialAnalyticsPeriodMetric
  >
>;

export type PersonalFinancialAnalyticsStatementLineItem =
  | Readonly<{
      factKey: PersonalFinancialAnalyticsFactKey;
      inputRefs: readonly PersonalFinancialAnalyticsInputRef[];
      label: string;
      status: "available";
      unit: "USD";
      value: string;
    }>
  | Readonly<{
      factKey: PersonalFinancialAnalyticsFactKey;
      inputRefs: readonly PersonalFinancialAnalyticsInputRef[];
      label: string;
      reason: Exclude<
        PersonalFinancialAnalyticsUnavailableReason,
        "zero_denominator"
      >;
      status: "unavailable";
      unit: "USD";
    }>;
export interface PersonalFinancialAnalyticsStatement {
  readonly lineItems: readonly PersonalFinancialAnalyticsStatementLineItem[];
  readonly statementId: "balance_sheet" | "cash_flow" | "income_statement";
}
export interface PersonalFinancialAnalyticsStatements {
  readonly balanceSheet: PersonalFinancialAnalyticsStatement;
  readonly cashFlow: PersonalFinancialAnalyticsStatement;
  readonly income: PersonalFinancialAnalyticsStatement;
}
export interface PersonalFinancialAnalyticsPeriodResult {
  readonly fiscalYear: number;
  readonly metrics: PersonalFinancialAnalyticsPeriodMetrics;
  readonly statementDate: string;
  readonly statements: PersonalFinancialAnalyticsStatements;
}

interface GrowthMetricBase extends FormulaMetadata {
  readonly fromFiscalYear: number | null;
  readonly inputRefs: readonly PersonalFinancialAnalyticsInputRef[];
  readonly toFiscalYear: number | null;
  readonly unit: "percent";
}
export type PersonalFinancialAnalyticsGrowthMetric =
  | (GrowthMetricBase & Readonly<{ status: "available"; value: string }>)
  | (GrowthMetricBase &
      Readonly<{
        reason: PersonalFinancialAnalyticsGrowthUnavailableReason;
        status: "unavailable";
      }>);
export type PersonalFinancialAnalyticsGrowth = Readonly<
  Record<
    PersonalFinancialAnalyticsGrowthKey,
    PersonalFinancialAnalyticsGrowthMetric
  >
>;
export interface PersonalFinancialAnalyticsQuarantineIssue {
  readonly index: number | null;
  readonly reason: PersonalFinancialAnalyticsQuarantineReason;
}
export interface PersonalFinancialAnalyticsReadyResult {
  readonly asOf: string;
  readonly formulaSetVersion: typeof PERSONAL_FINANCIAL_ANALYTICS_FORMULA_SET_VERSION;
  readonly growth: PersonalFinancialAnalyticsGrowth;
  readonly periods: readonly PersonalFinancialAnalyticsPeriodResult[];
  readonly schemaVersion: typeof PERSONAL_FINANCIAL_ANALYTICS_SCHEMA_VERSION;
  readonly status: "ready";
}
export interface PersonalFinancialAnalyticsQuarantinedResult {
  readonly asOf: string;
  readonly formulaSetVersion: typeof PERSONAL_FINANCIAL_ANALYTICS_FORMULA_SET_VERSION;
  readonly issues: readonly PersonalFinancialAnalyticsQuarantineIssue[];
  readonly schemaVersion: typeof PERSONAL_FINANCIAL_ANALYTICS_SCHEMA_VERSION;
  readonly status: "quarantined";
}
export type PersonalFinancialAnalyticsResult =
  | PersonalFinancialAnalyticsReadyResult
  | PersonalFinancialAnalyticsQuarantinedResult;

type Resolution =
  | Readonly<{ fact: PersonalFinancialAnalyticsFactInput; status: "available" }>
  | Readonly<{
      facts: readonly PersonalFinancialAnalyticsFactInput[];
      reason: Exclude<
        PersonalFinancialAnalyticsUnavailableReason,
        "zero_denominator"
      >;
      status: "unavailable";
    }>;

const FinancialDecimal = Decimal.clone({
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
});
const FACT_LABELS: Readonly<Record<PersonalFinancialAnalyticsFactKey, string>> =
  freezeDeep({
    assets: "Assets",
    cash: "Cash and cash equivalents",
    debt: "Debt",
    free_cash_flow: "Free cash flow",
    gross_profit: "Gross profit",
    net_income: "Net income",
    operating_cash_flow: "Operating cash flow",
    operating_income: "Operating income",
    revenue: "Revenue",
  });
const FACT_KEYS = Object.freeze(
  Object.keys(FACT_LABELS) as PersonalFinancialAnalyticsFactKey[],
);

export function buildPersonalFinancialAnalytics(
  input: PersonalFinancialAnalyticsInput,
): PersonalFinancialAnalyticsResult {
  const issues = validateEnvelope(input);
  if (issues.length > 0) {
    return freezeDeep({
      asOf: input.asOf,
      formulaSetVersion: PERSONAL_FINANCIAL_ANALYTICS_FORMULA_SET_VERSION,
      issues,
      schemaVersion: PERSONAL_FINANCIAL_ANALYTICS_SCHEMA_VERSION,
      status: "quarantined",
    });
  }
  const resolvedPeriods = input.periods.map((period) => ({
    input: period,
    resolutions: resolveFacts(period.facts),
  }));
  const periods = resolvedPeriods.map(({ input: period, resolutions }) => ({
    fiscalYear: period.fiscalYear,
    metrics: buildPeriodMetrics(period.fiscalYear, resolutions),
    statementDate: period.statementDate,
    statements: buildStatements(resolutions),
  }));
  return freezeDeep({
    asOf: input.asOf,
    formulaSetVersion: PERSONAL_FINANCIAL_ANALYTICS_FORMULA_SET_VERSION,
    growth: buildGrowth(resolvedPeriods),
    periods,
    schemaVersion: PERSONAL_FINANCIAL_ANALYTICS_SCHEMA_VERSION,
    status: "ready",
  });
}

function validateEnvelope(
  input: PersonalFinancialAnalyticsInput,
): PersonalFinancialAnalyticsQuarantineIssue[] {
  const issues: PersonalFinancialAnalyticsQuarantineIssue[] = [];
  if (!isIsoTimestamp(input.asOf))
    issues.push({ index: null, reason: "invalid_as_of" });
  if (input.periods.length > PERSONAL_FINANCIAL_ANALYTICS_MAX_ANNUAL_PERIODS)
    issues.push({ index: null, reason: "too_many_periods" });
  const seenYears = new Set<number>();
  input.periods.forEach((period, index) => {
    if (
      !Number.isInteger(period.fiscalYear) ||
      period.fiscalYear < 1900 ||
      period.fiscalYear > 9999
    )
      issues.push({ index, reason: "invalid_fiscal_year" });
    if (!isIsoDate(period.statementDate))
      issues.push({ index, reason: "invalid_statement_date" });
    if (seenYears.has(period.fiscalYear))
      issues.push({ index, reason: "duplicate_fiscal_year" });
    seenYears.add(period.fiscalYear);
    if (index > 0 && input.periods[index - 1]!.fiscalYear <= period.fiscalYear)
      issues.push({ index, reason: "periods_not_strictly_descending" });
  });
  return issues;
}

function resolveFacts(
  facts: readonly PersonalFinancialAnalyticsFactInput[],
): Readonly<Record<PersonalFinancialAnalyticsFactKey, Resolution>> {
  return Object.fromEntries(
    FACT_KEYS.map((key) => [key, resolveFact(key, facts)]),
  ) as Record<PersonalFinancialAnalyticsFactKey, Resolution>;
}
function resolveFact(
  key: PersonalFinancialAnalyticsFactKey,
  facts: readonly PersonalFinancialAnalyticsFactInput[],
): Resolution {
  const matches = facts.filter((fact) => fact.key === key);
  if (matches.length === 0)
    return { facts: [], reason: "missing_input", status: "unavailable" };
  if (matches.length !== 1)
    return { facts: matches, reason: "ambiguous_fact", status: "unavailable" };
  const fact = matches[0]!;
  if (fact.unit !== "USD")
    return { facts: [fact], reason: "invalid_unit", status: "unavailable" };
  if (fact.sourceRef.trim().length === 0)
    return {
      facts: [fact],
      reason: "invalid_source_ref",
      status: "unavailable",
    };
  if (!isValidDecimal(fact.value))
    return { facts: [fact], reason: "invalid_decimal", status: "unavailable" };
  return { fact, status: "available" };
}

function buildStatements(
  resolutions: Readonly<Record<PersonalFinancialAnalyticsFactKey, Resolution>>,
): PersonalFinancialAnalyticsStatements {
  return {
    income: statement(
      "income_statement",
      ["revenue", "gross_profit", "operating_income", "net_income"],
      resolutions,
    ),
    balanceSheet: statement(
      "balance_sheet",
      ["assets", "cash", "debt"],
      resolutions,
    ),
    cashFlow: statement(
      "cash_flow",
      ["operating_cash_flow", "free_cash_flow"],
      resolutions,
    ),
  };
}
function statement(
  statementId: PersonalFinancialAnalyticsStatement["statementId"],
  keys: readonly PersonalFinancialAnalyticsFactKey[],
  resolutions: Readonly<Record<PersonalFinancialAnalyticsFactKey, Resolution>>,
): PersonalFinancialAnalyticsStatement {
  return {
    lineItems: keys.map((key) => statementLine(key, resolutions[key])),
    statementId,
  };
}
function statementLine(
  factKey: PersonalFinancialAnalyticsFactKey,
  resolution: Resolution,
): PersonalFinancialAnalyticsStatementLineItem {
  if (resolution.status === "available")
    return {
      factKey,
      inputRefs: [inputRef(resolution.fact)],
      label: FACT_LABELS[factKey],
      status: "available",
      unit: "USD",
      value: normalizeDecimal(resolution.fact.value),
    };
  return {
    factKey,
    inputRefs: resolution.facts.map(inputRef),
    label: FACT_LABELS[factKey],
    reason: resolution.reason,
    status: "unavailable",
    unit: "USD",
  };
}

function buildPeriodMetrics(
  fiscalYear: number,
  r: Readonly<Record<PersonalFinancialAnalyticsFactKey, Resolution>>,
): PersonalFinancialAnalyticsPeriodMetrics {
  return {
    grossMargin: ratioMetric(
      "grossMargin",
      fiscalYear,
      r.gross_profit,
      r.revenue,
    ),
    operatingMargin: ratioMetric(
      "operatingMargin",
      fiscalYear,
      r.operating_income,
      r.revenue,
    ),
    netMargin: ratioMetric("netMargin", fiscalYear, r.net_income, r.revenue),
    operatingCashFlowMargin: ratioMetric(
      "operatingCashFlowMargin",
      fiscalYear,
      r.operating_cash_flow,
      r.revenue,
    ),
    freeCashFlowMargin: ratioMetric(
      "freeCashFlowMargin",
      fiscalYear,
      r.free_cash_flow,
      r.revenue,
    ),
    netDebt: subtractMetric(fiscalYear, r.debt, r.cash),
    debtToAssets: ratioMetric("debtToAssets", fiscalYear, r.debt, r.assets),
    cashToAssets: ratioMetric("cashToAssets", fiscalYear, r.cash, r.assets),
  };
}
function ratioMetric(
  key: Exclude<PersonalFinancialAnalyticsMetricKey, "netDebt">,
  fiscalYear: number,
  numerator: Resolution,
  denominator: Resolution,
): PersonalFinancialAnalyticsPeriodMetric {
  const unavailable = unavailablePeriodMetricFromInputs(
    key,
    fiscalYear,
    [numerator, denominator],
    "percent",
  );
  if (unavailable !== null) return unavailable;
  const numeratorFact = availableFact(numerator);
  const denominatorFact = availableFact(denominator);
  const divisor = new FinancialDecimal(denominatorFact.value);
  if (divisor.isZero())
    return unavailablePeriodMetric(
      key,
      fiscalYear,
      [numeratorFact, denominatorFact],
      "percent",
      "zero_denominator",
    );
  return availablePeriodMetric(
    key,
    fiscalYear,
    [numeratorFact, denominatorFact],
    "percent",
    new FinancialDecimal(numeratorFact.value).div(divisor).mul(100),
  );
}
function subtractMetric(
  fiscalYear: number,
  minuend: Resolution,
  subtrahend: Resolution,
): PersonalFinancialAnalyticsPeriodMetric {
  const unavailable = unavailablePeriodMetricFromInputs(
    "netDebt",
    fiscalYear,
    [minuend, subtrahend],
    "USD",
  );
  if (unavailable !== null) return unavailable;
  const minuendFact = availableFact(minuend);
  const subtrahendFact = availableFact(subtrahend);
  return availablePeriodMetric(
    "netDebt",
    fiscalYear,
    [minuendFact, subtrahendFact],
    "USD",
    new FinancialDecimal(minuendFact.value).minus(subtrahendFact.value),
  );
}
function unavailablePeriodMetricFromInputs(
  key: PersonalFinancialAnalyticsMetricKey,
  fiscalYear: number,
  resolutions: readonly Resolution[],
  unit: "USD" | "percent",
): PersonalFinancialAnalyticsPeriodMetric | null {
  const unavailable = resolutions.find(
    (
      resolution,
    ): resolution is Extract<Resolution, { status: "unavailable" }> =>
      resolution.status === "unavailable",
  );
  if (unavailable === undefined) return null;
  return unavailablePeriodMetric(
    key,
    fiscalYear,
    resolutions.flatMap(resolutionFacts),
    unit,
    unavailable.reason,
  );
}
function availablePeriodMetric(
  key: PersonalFinancialAnalyticsMetricKey,
  fiscalYear: number,
  facts: readonly PersonalFinancialAnalyticsFactInput[],
  unit: "USD" | "percent",
  value: Decimal,
): PersonalFinancialAnalyticsPeriodMetric {
  return {
    ...periodMetricMetadata(key, fiscalYear, facts, unit),
    status: "available",
    value: round(value),
  };
}
function unavailablePeriodMetric(
  key: PersonalFinancialAnalyticsMetricKey,
  fiscalYear: number,
  facts: readonly PersonalFinancialAnalyticsFactInput[],
  unit: "USD" | "percent",
  reason: PersonalFinancialAnalyticsUnavailableReason,
): PersonalFinancialAnalyticsPeriodMetric {
  return {
    ...periodMetricMetadata(key, fiscalYear, facts, unit),
    reason,
    status: "unavailable",
  };
}
function periodMetricMetadata(
  key: PersonalFinancialAnalyticsMetricKey,
  fiscalYear: number,
  facts: readonly PersonalFinancialAnalyticsFactInput[],
  unit: "USD" | "percent",
): PeriodMetricBase {
  return {
    ...PERSONAL_FINANCIAL_ANALYTICS_FORMULAS[key],
    fiscalYear,
    inputRefs: facts.map(inputRef),
    unit,
  };
}

function buildGrowth(
  periods: readonly {
    readonly input: PersonalFinancialAnalyticsAnnualPeriodInput;
    readonly resolutions: Readonly<
      Record<PersonalFinancialAnalyticsFactKey, Resolution>
    >;
  }[],
): PersonalFinancialAnalyticsGrowth {
  return {
    revenue: growthMetric("revenue", "revenueGrowth", periods),
    netIncome: growthMetric("net_income", "netIncomeGrowth", periods),
    freeCashFlow: growthMetric("free_cash_flow", "freeCashFlowGrowth", periods),
  };
}
function growthMetric(
  factKey: PersonalFinancialAnalyticsFactKey,
  formulaKey: "freeCashFlowGrowth" | "netIncomeGrowth" | "revenueGrowth",
  periods: readonly {
    readonly input: PersonalFinancialAnalyticsAnnualPeriodInput;
    readonly resolutions: Readonly<
      Record<PersonalFinancialAnalyticsFactKey, Resolution>
    >;
  }[],
): PersonalFinancialAnalyticsGrowthMetric {
  const definition = PERSONAL_FINANCIAL_ANALYTICS_FORMULAS[formulaKey];
  if (periods.length < 2)
    return {
      ...definition,
      fromFiscalYear: null,
      inputRefs: [],
      reason: "insufficient_periods",
      status: "unavailable",
      toFiscalYear: periods[0]?.input.fiscalYear ?? null,
      unit: "percent",
    };
  const current = periods[0]!;
  const prior = periods[1]!;
  if (current.input.fiscalYear - prior.input.fiscalYear !== 1)
    return {
      ...definition,
      fromFiscalYear: prior.input.fiscalYear,
      inputRefs: [],
      reason: "non_consecutive_fiscal_years",
      status: "unavailable",
      toFiscalYear: current.input.fiscalYear,
      unit: "percent",
    };
  const currentFact = current.resolutions[factKey];
  const priorFact = prior.resolutions[factKey];
  const facts = [
    ...resolutionFacts(currentFact),
    ...resolutionFacts(priorFact),
  ];
  const unavailable = [currentFact, priorFact].find(
    (
      resolution,
    ): resolution is Extract<Resolution, { status: "unavailable" }> =>
      resolution.status === "unavailable",
  );
  if (unavailable !== undefined)
    return {
      ...definition,
      fromFiscalYear: prior.input.fiscalYear,
      inputRefs: facts.map(inputRef),
      reason: unavailable.reason,
      status: "unavailable",
      toFiscalYear: current.input.fiscalYear,
      unit: "percent",
    };
  const currentAvailableFact = availableFact(currentFact);
  const priorAvailableFact = availableFact(priorFact);
  const divisor = new FinancialDecimal(priorAvailableFact.value);
  if (divisor.isZero())
    return {
      ...definition,
      fromFiscalYear: prior.input.fiscalYear,
      inputRefs: facts.map(inputRef),
      reason: "zero_denominator",
      status: "unavailable",
      toFiscalYear: current.input.fiscalYear,
      unit: "percent",
    };
  if (divisor.isNegative())
    return {
      ...definition,
      fromFiscalYear: prior.input.fiscalYear,
      inputRefs: facts.map(inputRef),
      reason: "nonpositive_prior",
      status: "unavailable",
      toFiscalYear: current.input.fiscalYear,
      unit: "percent",
    };
  return {
    ...definition,
    fromFiscalYear: prior.input.fiscalYear,
    inputRefs: facts.map(inputRef),
    status: "available",
    toFiscalYear: current.input.fiscalYear,
    unit: "percent",
    value: round(
      new FinancialDecimal(currentAvailableFact.value)
        .div(divisor)
        .minus(1)
        .mul(100),
    ),
  };
}

function resolutionFacts(
  resolution: Resolution,
): PersonalFinancialAnalyticsFactInput[] {
  return resolution.status === "available"
    ? [resolution.fact]
    : [...resolution.facts];
}
function availableFact(
  resolution: Resolution,
): PersonalFinancialAnalyticsFactInput {
  if (resolution.status !== "available")
    throw new Error("internal unavailable fact invariant");
  return resolution.fact;
}
function inputRef(
  fact: PersonalFinancialAnalyticsFactInput,
): PersonalFinancialAnalyticsInputRef {
  return { factKey: fact.key, sourceRef: fact.sourceRef };
}
function formula(formulaId: string, expression: string) {
  return {
    expression,
    formulaId,
    formulaVersion: PERSONAL_FINANCIAL_ANALYTICS_FORMULA_SET_VERSION,
  } as const;
}
function isIsoTimestamp(value: string): boolean {
  const withMilliseconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
    value,
  );
  const withoutMilliseconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(
    value,
  );
  if (!withMilliseconds && !withoutMilliseconds) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const canonical = parsed.toISOString();
  return withMilliseconds
    ? canonical === value
    : canonical.replace(".000Z", "Z") === value;
}
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
}
function isValidDecimal(value: string): boolean {
  if (value.length > 64 || !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value)) {
    return false;
  }
  try {
    return new FinancialDecimal(value).isFinite();
  } catch {
    return false;
  }
}
function normalizeDecimal(value: string): string {
  const decimal = new FinancialDecimal(value);
  return decimal.isZero() ? "0" : decimal.toString();
}
function round(value: Decimal): string {
  if (value.isZero()) return "0.00";
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}
function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
