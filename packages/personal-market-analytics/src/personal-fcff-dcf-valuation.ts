import Decimal from "decimal.js";

export const PERSONAL_FCFF_DCF_SCHEMA_VERSION = "1.0.0" as const;
export const PERSONAL_FCFF_DCF_FORMULA_SET_VERSION = "1.0.0" as const;
export const PERSONAL_FCFF_DCF_MAXIMUM_MARKET_OBSERVATIONS = 4096 as const;
export const PERSONAL_FCFF_DCF_MAXIMUM_ANNUAL_PERIODS = 10 as const;
export const PERSONAL_FCFF_DCF_MAXIMUM_DECIMAL_LENGTH = 64 as const;
export const PERSONAL_FCFF_DCF_REVERSE_BISECTION_ITERATIONS = 256 as const;
export const PERSONAL_FCFF_DCF_REVERSE_EXACT_RATE_DECIMAL_PLACES = 80 as const;

export const PERSONAL_FCFF_DCF_SCENARIOS = Object.freeze([
  "conservative",
  "base",
  "expansion",
] as const);
export const PERSONAL_FCFF_DCF_RANGES = Object.freeze([
  "1m",
  "3m",
  "ytd",
  "1y",
  "5y",
  "10y",
] as const);
export const PERSONAL_FCFF_DCF_ANNUAL_INPUT_KEYS = Object.freeze([
  "free_cash_flow",
  "interest_expense",
] as const);
export const PERSONAL_FCFF_DCF_SENSITIVITY_WACC_DELTAS = Object.freeze([
  "-2",
  "-1",
  "0",
  "1",
  "2",
] as const);
export const PERSONAL_FCFF_DCF_SENSITIVITY_TERMINAL_GROWTH_DELTAS =
  Object.freeze(["-1", "-0.5", "0", "0.5", "1"] as const);

export const PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS = freezeDeep({
  annualFcfProxyGrowthPercent: { maximum: "50", minimum: "-50" },
  forecastYears: { maximum: 10, minimum: 5 },
  taxShieldRatePercent: { maximum: "50", minimum: "0" },
  terminalGrowthPercent: { maximum: "5", minimum: "-2" },
  waccPercent: { maximum: "30", minimum: "1" },
} as const);

export const PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS = freezeDeep({
  forecastYears: 5,
  scenarios: {
    base: { annualFcfProxyGrowthPercent: "5" },
    conservative: { annualFcfProxyGrowthPercent: "0" },
    expansion: { annualFcfProxyGrowthPercent: "10" },
  },
  taxShieldRatePercent: "21",
  terminalGrowthPercent: "2.5",
  waccPercent: "10",
} as const satisfies PersonalFcffDcfAssumptions);

export const PERSONAL_FCFF_DCF_ROUNDING = freezeDeep({
  calculationPrecision: 256,
  impliedPriceDecimalPlaces: 2,
  moneyDecimalPlaces: 2,
  negativeZero: "normalize_to_positive_zero",
  percentDecimalPlaces: 2,
  rateDecimalPlaces: 4,
  shareCountDecimalPlaces: 6,
  method: "round_half_up",
} as const);

export const PERSONAL_FCFF_DCF_UNAVAILABLE_REASONS = Object.freeze([
  "selection_not_loaded",
  "market_not_loaded",
  "valuation_history_not_loaded",
  "annual_financials_not_loaded",
  "identity_mismatch",
  "range_mismatch",
  "no_common_date",
  "reference_price_nonpositive",
  "reference_market_cap_unavailable",
  "reference_market_cap_nonpositive",
  "reference_enterprise_value_unavailable",
  "reference_enterprise_value_nonpositive",
  "no_annual_periods",
  "annual_statement_after_reference_date",
  "required_annual_input_unavailable",
  "starting_unlevered_fcf_proxy_nonpositive",
  "tax_shield_rate_out_of_bounds",
  "scenario_growth_out_of_bounds",
  "scenario_growth_not_ordered",
  "wacc_out_of_bounds",
  "terminal_growth_out_of_bounds",
  "forecast_years_out_of_bounds",
  "discount_rate_not_above_terminal_growth",
] as const);

export const PERSONAL_FCFF_DCF_FORMULAS = freezeDeep({
  afterTaxInterest: formula(
    "owner_tax_shield_rate_after_tax_interest_add_back",
    "absolute_reported_interest_expense * (1 - owner_tax_shield_rate)",
  ),
  enterpriseToEquityBridge: formula(
    "same_date_provider_ev_to_equity_bridge",
    "provider_enterprise_value - provider_market_capitalization",
  ),
  explicitFcfProxy: formula(
    "constant_growth_starting_unlevered_fcf_proxy_forecast",
    "starting_unlevered_fcf_proxy * (1 + scenario_growth_rate) ^ forecast_year",
  ),
  impliedPrice: formula(
    "provider_share_basis_implied_price",
    "dcf_equity_value / (provider_market_capitalization / same_date_raw_close)",
  ),
  startingUnleveredFcfProxy: formula(
    "reported_fcf_plus_after_tax_interest_mechanical_proxy",
    "reported_free_cash_flow + absolute_reported_interest_expense * (1 - owner_tax_shield_rate)",
  ),
  presentValue: formula(
    "year_end_present_value",
    "forecast_fcf_proxy / (1 + wacc) ^ forecast_year",
  ),
  reverseGrowth: formula(
    "market_enterprise_value_implied_constant_fcf_proxy_growth_bisection",
    "bisect dcf_enterprise_value(growth) against same_date_provider_enterprise_value on [-50%, 50%], then require both values to round to the same cent",
  ),
  terminalValue: formula(
    "perpetual_growth_terminal_value",
    "final_forecast_fcf_proxy * (1 + terminal_growth_rate) / (wacc - terminal_growth_rate)",
  ),
} as const);

export const PERSONAL_FCFF_DCF_METHODOLOGY = freezeDeep({
  applicability:
    "screen_grade_non_financial_operating_company_constant_growth_proxy",
  assumptionBounds: PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS,
  formulas: PERSONAL_FCFF_DCF_FORMULAS,
  limitations: {
    cashFlowBasis:
      "starting_unlevered_fcf_proxy_mechanical_not_audited_fcff_requires_provider_fcf_to_represent_levered_cfo_less_capex",
    decisionUse:
      "historical_and_owner_assumption_scenario_context_not_intrinsic_certainty_price_target_or_recommendation",
    discountConvention: "year_end",
    financialInstitutions:
      "not_applicable_to_banks_insurers_or_other_financial_institutions_without_a_specialized_model",
    revisionBasis: "provider_most_recent_not_point_in_time",
    shareBasis:
      "same_date_provider_market_capitalization_divided_by_raw_close_not_diluted_share_count",
  },
  reverseGrowth: {
    iterations: PERSONAL_FCFF_DCF_REVERSE_BISECTION_ITERATIONS,
    maximumPercent:
      PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS.annualFcfProxyGrowthPercent.maximum,
    minimumPercent:
      PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS.annualFcfProxyGrowthPercent.minimum,
    method: "fixed_iteration_decimal_bisection",
    resolvedRateDecimalPlaces:
      PERSONAL_FCFF_DCF_REVERSE_EXACT_RATE_DECIMAL_PLACES,
    targetMoneyDecimalPlaces: PERSONAL_FCFF_DCF_ROUNDING.moneyDecimalPlaces,
  },
  rounding: PERSONAL_FCFF_DCF_ROUNDING,
  sensitivity: {
    scenario: "base",
    terminalGrowthDeltasPercentagePoints:
      PERSONAL_FCFF_DCF_SENSITIVITY_TERMINAL_GROWTH_DELTAS,
    waccDeltasPercentagePoints: PERSONAL_FCFF_DCF_SENSITIVITY_WACC_DELTAS,
  },
} as const);

export type PersonalFcffDcfScenario =
  (typeof PERSONAL_FCFF_DCF_SCENARIOS)[number];
export type PersonalFcffDcfRange = (typeof PERSONAL_FCFF_DCF_RANGES)[number];
export type PersonalFcffDcfAnnualInputKey =
  (typeof PERSONAL_FCFF_DCF_ANNUAL_INPUT_KEYS)[number];
export type PersonalFcffDcfUnavailableReason =
  (typeof PERSONAL_FCFF_DCF_UNAVAILABLE_REASONS)[number];

export interface PersonalFcffDcfIdentity {
  readonly country: "US";
  readonly exchangeMic: string;
  readonly issuerName: string;
  readonly listingId: string;
  readonly securityName: string;
  readonly symbol: string;
}

export interface PersonalFcffDcfMarketBar {
  readonly date: string;
  readonly raw: Readonly<{ close: string }>;
}

export interface PersonalFcffDcfMarketInput {
  readonly bars: readonly PersonalFcffDcfMarketBar[];
  readonly priceCurrency: "USD";
  readonly range: PersonalFcffDcfRange;
  readonly security: PersonalFcffDcfIdentity;
}

export type PersonalFcffDcfMoneyCell =
  | Readonly<{ status: "known"; unit: "USD"; value: string }>
  | Readonly<{
      reason: "not_supplied_by_provider";
      status: "unknown";
      unit: "USD";
      value: null;
    }>;

export interface PersonalFcffDcfValuationPoint {
  readonly date: string;
  readonly enterpriseValue: PersonalFcffDcfMoneyCell;
  readonly marketCapitalization: PersonalFcffDcfMoneyCell;
}

export interface PersonalFcffDcfValuationInput {
  readonly asOf: string;
  readonly points: readonly PersonalFcffDcfValuationPoint[];
  readonly range: PersonalFcffDcfRange;
  readonly security: PersonalFcffDcfIdentity;
}

export type PersonalFcffDcfAnnualCell =
  | Readonly<{ status: "known"; value: string }>
  | Readonly<{
      reason: "not_supplied_by_provider";
      status: "unknown";
      value: null;
    }>;

export type PersonalFcffDcfAnnualReportedValues = Readonly<
  Record<PersonalFcffDcfAnnualInputKey, PersonalFcffDcfAnnualCell>
>;

export interface PersonalFcffDcfAnnualPeriod {
  readonly fiscalYear: number;
  readonly reported: PersonalFcffDcfAnnualReportedValues;
  readonly statementDate: string;
}

export interface PersonalFcffDcfAnnualsInput {
  readonly asOf: string;
  readonly security: PersonalFcffDcfIdentity;
  readonly valueCurrency: "USD";
  readonly years: readonly PersonalFcffDcfAnnualPeriod[];
}

export interface PersonalFcffDcfScenarioAssumption {
  readonly annualFcfProxyGrowthPercent: string;
}

export interface PersonalFcffDcfAssumptions {
  readonly forecastYears: number;
  readonly scenarios: Readonly<
    Record<PersonalFcffDcfScenario, PersonalFcffDcfScenarioAssumption>
  >;
  readonly taxShieldRatePercent: string;
  readonly terminalGrowthPercent: string;
  readonly waccPercent: string;
}

export interface PersonalFcffDcfInput {
  readonly annuals: PersonalFcffDcfAnnualsInput | null;
  readonly assumptions: PersonalFcffDcfAssumptions;
  readonly market: PersonalFcffDcfMarketInput | null;
  readonly selection: PersonalFcffDcfIdentity | null;
  readonly valuation: PersonalFcffDcfValuationInput | null;
}

export interface PersonalFcffDcfReference {
  readonly afterTaxInterestAddBackUsd: string;
  readonly annualFiscalYear: number;
  readonly annualStatementDate: string;
  readonly annualsAsOf: string;
  readonly date: string;
  readonly enterpriseValueUsd: string;
  readonly impliedShareCount: string;
  readonly marketCapitalizationUsd: string;
  readonly startingUnleveredFcfProxyUsd: string;
  readonly providerEvToEquityBridgeUsd: string;
  readonly rawCloseUsd: string;
  readonly reportedFreeCashFlowUsd: string;
  readonly reportedInterestExpenseUsd: string;
  readonly reportedInterestExpenseMagnitudeUsd: string;
  readonly sourceOperands: PersonalFcffDcfSourceOperands;
  readonly taxShieldRatePercent: string;
  readonly valuationAsOf: string;
}

export interface PersonalFcffDcfSourceOperands {
  readonly enterpriseValueUsd: string;
  readonly marketCapitalizationUsd: string;
  readonly rawCloseUsd: string;
  readonly reportedFreeCashFlowUsd: string;
  readonly reportedInterestExpenseUsd: string;
}

export interface PersonalFcffDcfAppliedAssumptions {
  readonly forecastYears: number;
  readonly scenarios: Readonly<
    Record<
      PersonalFcffDcfScenario,
      Readonly<{ annualFcfProxyGrowthPercent: string }>
    >
  >;
  readonly taxShieldRatePercent: string;
  readonly terminalGrowthPercent: string;
  readonly waccPercent: string;
}

export interface PersonalFcffDcfProjectionPeriod {
  readonly fcfProxyUsd: string;
  readonly presentValueUsd: string;
  readonly year: number;
}

interface PersonalFcffDcfScenarioResultBase {
  readonly annualFcfProxyGrowthPercent: string;
  readonly enterpriseValueUsd: string;
  readonly equityValueUsd: string;
  readonly presentValueOfExplicitFcfProxyUsd: string;
  readonly presentValueOfTerminalValueUsd: string;
  readonly projection: readonly PersonalFcffDcfProjectionPeriod[];
  readonly scenario: PersonalFcffDcfScenario;
  readonly terminalValuePercentOfEnterpriseValue: string;
  readonly terminalValueUsd: string;
}

export interface PersonalFcffDcfAvailableScenarioResult extends PersonalFcffDcfScenarioResultBase {
  readonly differencePercent: string;
  readonly impliedPriceUsd: string;
  readonly status: "available";
}

export interface PersonalFcffDcfUnavailableScenarioResult extends PersonalFcffDcfScenarioResultBase {
  readonly reason: "nonpositive_equity_value";
  readonly status: "unavailable";
}

export type PersonalFcffDcfScenarioResult =
  | PersonalFcffDcfAvailableScenarioResult
  | PersonalFcffDcfUnavailableScenarioResult;

export type PersonalFcffDcfScenarioResults = Readonly<
  Record<PersonalFcffDcfScenario, PersonalFcffDcfScenarioResult>
>;

interface PersonalFcffDcfReverseBase {
  readonly searchLowerBoundPercent: string;
  readonly searchUpperBoundPercent: string;
  readonly targetEnterpriseValueUsd: string;
}

export interface PersonalFcffDcfAvailableReverseResult extends PersonalFcffDcfReverseBase {
  readonly impliedAnnualFcfProxyGrowthPercent: string;
  readonly iterations: typeof PERSONAL_FCFF_DCF_REVERSE_BISECTION_ITERATIONS;
  readonly resolvedAnnualFcfProxyGrowthPercent: string;
  readonly solvedEnterpriseValueUsd: string;
  readonly status: "available";
}

export interface PersonalFcffDcfUnavailableReverseResult extends PersonalFcffDcfReverseBase {
  readonly reason:
    | "target_above_growth_search_bound"
    | "target_below_growth_search_bound"
    | "target_money_precision_not_resolved"
    | "target_not_bracketed";
  readonly status: "unavailable";
}

export type PersonalFcffDcfReverseResult =
  | PersonalFcffDcfAvailableReverseResult
  | PersonalFcffDcfUnavailableReverseResult;

interface PersonalFcffDcfSensitivityCellBase {
  readonly terminalGrowthPercent: string;
  readonly waccPercent: string;
}

export interface PersonalFcffDcfAvailableSensitivityCell extends PersonalFcffDcfSensitivityCellBase {
  readonly impliedPriceUsd: string;
  readonly status: "available";
}

export interface PersonalFcffDcfUnavailableSensitivityCell extends PersonalFcffDcfSensitivityCellBase {
  readonly reason:
    | "discount_rate_not_above_terminal_growth"
    | "nonpositive_equity_value"
    | "sensitivity_rate_out_of_bounds";
  readonly status: "unavailable";
}

export type PersonalFcffDcfSensitivityCell =
  | PersonalFcffDcfAvailableSensitivityCell
  | PersonalFcffDcfUnavailableSensitivityCell;

export interface PersonalFcffDcfSensitivity {
  readonly cells: readonly PersonalFcffDcfSensitivityCell[];
  readonly scenario: "base";
  readonly terminalGrowthDeltasPercentagePoints: typeof PERSONAL_FCFF_DCF_SENSITIVITY_TERMINAL_GROWTH_DELTAS;
  readonly waccDeltasPercentagePoints: typeof PERSONAL_FCFF_DCF_SENSITIVITY_WACC_DELTAS;
}

export type PersonalFcffDcfMethodology = typeof PERSONAL_FCFF_DCF_METHODOLOGY;

interface PersonalFcffDcfResultBase {
  readonly formulaSetVersion: typeof PERSONAL_FCFF_DCF_FORMULA_SET_VERSION;
  readonly methodology: PersonalFcffDcfMethodology;
  readonly schemaVersion: typeof PERSONAL_FCFF_DCF_SCHEMA_VERSION;
}

export interface PersonalFcffDcfAvailableResult extends PersonalFcffDcfResultBase {
  readonly assumptions: PersonalFcffDcfAppliedAssumptions;
  readonly reference: PersonalFcffDcfReference;
  readonly reverseDcf: PersonalFcffDcfReverseResult;
  readonly scenarios: PersonalFcffDcfScenarioResults;
  readonly sensitivity: PersonalFcffDcfSensitivity;
  readonly status: "available";
}

export interface PersonalFcffDcfUnavailableResult extends PersonalFcffDcfResultBase {
  readonly missingAnnualInputs: readonly PersonalFcffDcfAnnualInputKey[];
  readonly reason: PersonalFcffDcfUnavailableReason;
  readonly status: "unavailable";
}

export type PersonalFcffDcfResult =
  PersonalFcffDcfAvailableResult | PersonalFcffDcfUnavailableResult;

interface ValidatedMarket {
  readonly bars: readonly Readonly<{ date: string; rawClose: string }>[];
  readonly priceCurrency: "USD";
  readonly range: PersonalFcffDcfRange;
  readonly security: PersonalFcffDcfIdentity;
}

interface ValidatedValuationPoint {
  readonly date: string;
  readonly enterpriseValue: PersonalFcffDcfMoneyCell;
  readonly marketCapitalization: PersonalFcffDcfMoneyCell;
}

interface ValidatedValuation {
  readonly asOf: string;
  readonly points: readonly ValidatedValuationPoint[];
  readonly range: PersonalFcffDcfRange;
  readonly security: PersonalFcffDcfIdentity;
}

interface ValidatedAnnualPeriod {
  readonly fiscalYear: number;
  readonly reported: PersonalFcffDcfAnnualReportedValues;
  readonly statementDate: string;
}

interface ValidatedAnnuals {
  readonly asOf: string;
  readonly security: PersonalFcffDcfIdentity;
  readonly valueCurrency: "USD";
  readonly years: readonly ValidatedAnnualPeriod[];
}

interface ValidatedInput {
  readonly annuals: ValidatedAnnuals | null;
  readonly assumptions: PersonalFcffDcfAssumptions;
  readonly market: ValidatedMarket | null;
  readonly selection: PersonalFcffDcfIdentity | null;
  readonly valuation: ValidatedValuation | null;
}

interface CalculationContext {
  readonly bridge: Decimal;
  readonly startingUnleveredFcfProxy: Decimal;
  readonly referencePrice: Decimal;
  readonly shareCount: Decimal;
  readonly terminalGrowth: Decimal;
  readonly wacc: Decimal;
}

interface EnterpriseCalculation {
  readonly enterpriseValue: Decimal;
  readonly explicitPresentValue: Decimal;
  readonly projection: readonly Readonly<{
    fcff: Decimal;
    presentValue: Decimal;
    year: number;
  }>[];
  readonly terminalPresentValue: Decimal;
  readonly terminalValue: Decimal;
}

const CalculationDecimal = Decimal.clone({
  defaults: true,
  precision: PERSONAL_FCFF_DCF_ROUNDING.calculationPrecision,
  rounding: Decimal.ROUND_HALF_UP,
});
const ValidationDecimal = Decimal.clone({
  defaults: true,
  precision: PERSONAL_FCFF_DCF_ROUNDING.calculationPrecision,
  rounding: Decimal.ROUND_HALF_UP,
});
const DECIMAL_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const CONTROL_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const EXCHANGE_MIC_PATTERN = /^[A-Z0-9]{4}$/u;
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;
const INPUT_KEYS = Object.freeze([
  "annuals",
  "assumptions",
  "market",
  "selection",
  "valuation",
] as const);
const ASSUMPTION_KEYS = Object.freeze([
  "forecastYears",
  "scenarios",
  "taxShieldRatePercent",
  "terminalGrowthPercent",
  "waccPercent",
] as const);
const SCENARIO_KEYS = PERSONAL_FCFF_DCF_SCENARIOS;
const SCENARIO_ASSUMPTION_KEYS = Object.freeze([
  "annualFcfProxyGrowthPercent",
] as const);
const MARKET_KEYS = Object.freeze([
  "bars",
  "priceCurrency",
  "range",
  "security",
] as const);
const BAR_KEYS = Object.freeze(["date", "raw"] as const);
const RAW_KEYS = Object.freeze(["close"] as const);
const VALUATION_KEYS = Object.freeze([
  "asOf",
  "points",
  "range",
  "security",
] as const);
const VALUATION_POINT_KEYS = Object.freeze([
  "date",
  "enterpriseValue",
  "marketCapitalization",
] as const);
const ANNUALS_KEYS = Object.freeze([
  "asOf",
  "security",
  "valueCurrency",
  "years",
] as const);
const ANNUAL_PERIOD_KEYS = Object.freeze([
  "fiscalYear",
  "reported",
  "statementDate",
] as const);
const KNOWN_MONEY_CELL_KEYS = Object.freeze([
  "status",
  "unit",
  "value",
] as const);
const UNKNOWN_MONEY_CELL_KEYS = Object.freeze([
  "reason",
  "status",
  "unit",
  "value",
] as const);
const KNOWN_ANNUAL_CELL_KEYS = Object.freeze(["status", "value"] as const);
const UNKNOWN_ANNUAL_CELL_KEYS = Object.freeze([
  "reason",
  "status",
  "value",
] as const);
const IDENTITY_KEYS = Object.freeze([
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const);

export function calculatePersonalFcffDcfValuation(
  input: PersonalFcffDcfInput,
): PersonalFcffDcfResult {
  try {
    return calculateValidated(validateInput(input));
  } catch {
    throw new TypeError();
  }
}

function calculateValidated(input: ValidatedInput): PersonalFcffDcfResult {
  if (input.selection === null) return unavailable("selection_not_loaded");
  if (input.market === null) return unavailable("market_not_loaded");
  if (input.valuation === null)
    return unavailable("valuation_history_not_loaded");
  if (input.annuals === null)
    return unavailable("annual_financials_not_loaded");
  if (
    !sameIdentity(input.selection, input.market.security) ||
    !sameIdentity(input.selection, input.valuation.security) ||
    !sameIdentity(input.selection, input.annuals.security)
  ) {
    return unavailable("identity_mismatch");
  }
  if (input.market.range !== input.valuation.range)
    return unavailable("range_mismatch");

  const common = latestCommonObservation(
    input.market.bars,
    input.valuation.points,
  );
  if (common === null) return unavailable("no_common_date");
  const referencePrice = decimal(common.bar.rawClose);
  if (!referencePrice.greaterThan(0))
    return unavailable("reference_price_nonpositive");
  if (common.point.marketCapitalization.status !== "known")
    return unavailable("reference_market_cap_unavailable");
  const marketCapitalizationLexeme = common.point.marketCapitalization.value;
  const marketCapitalization = decimal(marketCapitalizationLexeme);
  if (!marketCapitalization.greaterThan(0))
    return unavailable("reference_market_cap_nonpositive");
  if (common.point.enterpriseValue.status !== "known")
    return unavailable("reference_enterprise_value_unavailable");
  const enterpriseValueLexeme = common.point.enterpriseValue.value;
  const enterpriseValue = decimal(enterpriseValueLexeme);
  if (!enterpriseValue.greaterThan(0))
    return unavailable("reference_enterprise_value_nonpositive");

  const latestAnnual = input.annuals.years[0];
  if (latestAnnual === undefined) return unavailable("no_annual_periods");
  if (latestAnnual.statementDate > common.point.date)
    return unavailable("annual_statement_after_reference_date");
  const missingAnnualInputs = PERSONAL_FCFF_DCF_ANNUAL_INPUT_KEYS.filter(
    (key) => latestAnnual.reported[key].status !== "known",
  );
  if (missingAnnualInputs.length > 0) {
    return unavailable(
      "required_annual_input_unavailable",
      missingAnnualInputs,
    );
  }
  const reportedFreeCashFlowLexeme = knownAnnualLexeme(
    latestAnnual.reported.free_cash_flow,
  );
  const reportedInterestExpenseLexeme = knownAnnualLexeme(
    latestAnnual.reported.interest_expense,
  );
  const reportedFreeCashFlow = decimal(reportedFreeCashFlowLexeme);
  const reportedInterestExpense = decimal(reportedInterestExpenseLexeme);

  const assumptions = parseAssumptions(input.assumptions);
  if (!within(assumptions.taxShieldRate, "taxShieldRatePercent"))
    return unavailable("tax_shield_rate_out_of_bounds");
  if (!within(assumptions.wacc, "waccPercent"))
    return unavailable("wacc_out_of_bounds");
  if (!within(assumptions.terminalGrowth, "terminalGrowthPercent"))
    return unavailable("terminal_growth_out_of_bounds");
  if (
    input.assumptions.forecastYears <
      PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS.forecastYears.minimum ||
    input.assumptions.forecastYears >
      PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS.forecastYears.maximum
  ) {
    return unavailable("forecast_years_out_of_bounds");
  }
  if (
    PERSONAL_FCFF_DCF_SCENARIOS.some(
      (scenario) =>
        !within(assumptions.growth[scenario], "annualFcfProxyGrowthPercent"),
    )
  ) {
    return unavailable("scenario_growth_out_of_bounds");
  }
  if (
    assumptions.growth.conservative.greaterThan(assumptions.growth.base) ||
    assumptions.growth.base.greaterThan(assumptions.growth.expansion)
  ) {
    return unavailable("scenario_growth_not_ordered");
  }
  if (assumptions.wacc.lessThanOrEqualTo(assumptions.terminalGrowth))
    return unavailable("discount_rate_not_above_terminal_growth");

  const one = new CalculationDecimal(1);
  const reportedInterestExpenseMagnitude = reportedInterestExpense.abs();
  const afterTaxInterest = reportedInterestExpense
    .abs()
    .mul(one.minus(assumptions.taxShieldRate));
  const startingUnleveredFcfProxy = reportedFreeCashFlow.plus(afterTaxInterest);
  if (!startingUnleveredFcfProxy.greaterThan(0))
    return unavailable("starting_unlevered_fcf_proxy_nonpositive");

  const bridge = enterpriseValue.minus(marketCapitalization);
  const shareCount = marketCapitalization.div(referencePrice);
  const context: CalculationContext = {
    bridge,
    startingUnleveredFcfProxy,
    referencePrice,
    shareCount,
    terminalGrowth: assumptions.terminalGrowth,
    wacc: assumptions.wacc,
  };
  const scenarios = Object.fromEntries(
    PERSONAL_FCFF_DCF_SCENARIOS.map((scenario) => [
      scenario,
      calculateScenario(
        scenario,
        assumptions.growth[scenario],
        input.assumptions.forecastYears,
        context,
      ),
    ]),
  ) as unknown as PersonalFcffDcfScenarioResults;
  const reverseDcf = calculateReverse(
    enterpriseValue,
    input.assumptions.forecastYears,
    context,
  );
  const sensitivity = calculateSensitivity(
    assumptions.growth.base,
    input.assumptions.forecastYears,
    context,
  );

  return freezeDeep({
    assumptions: {
      forecastYears: input.assumptions.forecastYears,
      scenarios: {
        base: {
          annualFcfProxyGrowthPercent:
            input.assumptions.scenarios.base.annualFcfProxyGrowthPercent,
        },
        conservative: {
          annualFcfProxyGrowthPercent:
            input.assumptions.scenarios.conservative
              .annualFcfProxyGrowthPercent,
        },
        expansion: {
          annualFcfProxyGrowthPercent:
            input.assumptions.scenarios.expansion.annualFcfProxyGrowthPercent,
        },
      },
      taxShieldRatePercent: input.assumptions.taxShieldRatePercent,
      terminalGrowthPercent: input.assumptions.terminalGrowthPercent,
      waccPercent: input.assumptions.waccPercent,
    },
    formulaSetVersion: PERSONAL_FCFF_DCF_FORMULA_SET_VERSION,
    methodology: PERSONAL_FCFF_DCF_METHODOLOGY,
    reference: {
      afterTaxInterestAddBackUsd: roundMoney(afterTaxInterest),
      annualFiscalYear: latestAnnual.fiscalYear,
      annualStatementDate: latestAnnual.statementDate,
      annualsAsOf: input.annuals.asOf,
      date: common.point.date,
      enterpriseValueUsd: roundMoney(enterpriseValue),
      impliedShareCount: roundShares(shareCount),
      marketCapitalizationUsd: roundMoney(marketCapitalization),
      startingUnleveredFcfProxyUsd: roundMoney(startingUnleveredFcfProxy),
      providerEvToEquityBridgeUsd: roundMoney(bridge),
      rawCloseUsd: roundMoney(referencePrice),
      reportedFreeCashFlowUsd: roundMoney(reportedFreeCashFlow),
      reportedInterestExpenseUsd: roundMoney(reportedInterestExpense),
      reportedInterestExpenseMagnitudeUsd: roundMoney(
        reportedInterestExpenseMagnitude,
      ),
      sourceOperands: {
        enterpriseValueUsd: enterpriseValueLexeme,
        marketCapitalizationUsd: marketCapitalizationLexeme,
        rawCloseUsd: common.bar.rawClose,
        reportedFreeCashFlowUsd: reportedFreeCashFlowLexeme,
        reportedInterestExpenseUsd: reportedInterestExpenseLexeme,
      },
      taxShieldRatePercent: roundRate(assumptions.taxShieldRate.mul(100)),
      valuationAsOf: input.valuation.asOf,
    },
    reverseDcf,
    scenarios,
    schemaVersion: PERSONAL_FCFF_DCF_SCHEMA_VERSION,
    sensitivity,
    status: "available",
  });
}

function calculateScenario(
  scenario: PersonalFcffDcfScenario,
  growth: Decimal,
  forecastYears: number,
  context: CalculationContext,
): PersonalFcffDcfScenarioResult {
  const calculation = calculateEnterpriseValue(
    context.startingUnleveredFcfProxy,
    growth,
    context.wacc,
    context.terminalGrowth,
    forecastYears,
  );
  const equityValue = calculation.enterpriseValue.minus(context.bridge);
  const base = {
    annualFcfProxyGrowthPercent: roundRate(growth.mul(100)),
    enterpriseValueUsd: roundMoney(calculation.enterpriseValue),
    equityValueUsd: roundMoney(equityValue),
    presentValueOfExplicitFcfProxyUsd: roundMoney(
      calculation.explicitPresentValue,
    ),
    presentValueOfTerminalValueUsd: roundMoney(
      calculation.terminalPresentValue,
    ),
    projection: calculation.projection.map((period) => ({
      fcfProxyUsd: roundMoney(period.fcff),
      presentValueUsd: roundMoney(period.presentValue),
      year: period.year,
    })),
    scenario,
    terminalValuePercentOfEnterpriseValue: roundPercent(
      calculation.terminalPresentValue
        .div(calculation.enterpriseValue)
        .mul(100),
    ),
    terminalValueUsd: roundMoney(calculation.terminalValue),
  } as const;
  if (!equityValue.greaterThan(0)) {
    return {
      ...base,
      reason: "nonpositive_equity_value",
      status: "unavailable",
    };
  }
  const impliedPrice = equityValue.div(context.shareCount);
  return {
    ...base,
    differencePercent: roundPercent(
      impliedPrice.div(context.referencePrice).minus(1).mul(100),
    ),
    impliedPriceUsd: roundPrice(impliedPrice),
    status: "available",
  };
}

function calculateEnterpriseValue(
  startingUnleveredFcfProxy: Decimal,
  growth: Decimal,
  wacc: Decimal,
  terminalGrowth: Decimal,
  forecastYears: number,
): EnterpriseCalculation {
  const one = new CalculationDecimal(1);
  const growthFactor = one.plus(growth);
  const discountFactor = one.plus(wacc);
  const projection = Array.from({ length: forecastYears }, (_, index) => {
    const year = index + 1;
    const fcff = startingUnleveredFcfProxy.mul(growthFactor.pow(year));
    return {
      fcff,
      presentValue: fcff.div(discountFactor.pow(year)),
      year,
    };
  });
  const explicitPresentValue = projection.reduce(
    (total, period) => total.plus(period.presentValue),
    new CalculationDecimal(0),
  );
  const finalFcff = projection.at(-1)?.fcff;
  if (finalFcff === undefined) throw new TypeError();
  const terminalValue = finalFcff
    .mul(one.plus(terminalGrowth))
    .div(wacc.minus(terminalGrowth));
  const terminalPresentValue = terminalValue.div(
    discountFactor.pow(forecastYears),
  );
  return {
    enterpriseValue: explicitPresentValue.plus(terminalPresentValue),
    explicitPresentValue,
    projection,
    terminalPresentValue,
    terminalValue,
  };
}

function calculateReverse(
  targetEnterpriseValue: Decimal,
  forecastYears: number,
  context: CalculationContext,
): PersonalFcffDcfReverseResult {
  let lower = percentDecimal(
    PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS.annualFcfProxyGrowthPercent.minimum,
  );
  let upper = percentDecimal(
    PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS.annualFcfProxyGrowthPercent.maximum,
  );
  const lowerValue = enterpriseValueAtGrowth(lower, forecastYears, context);
  const upperValue = enterpriseValueAtGrowth(upper, forecastYears, context);
  const reverseBase = {
    searchLowerBoundPercent:
      PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS.annualFcfProxyGrowthPercent.minimum,
    searchUpperBoundPercent:
      PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS.annualFcfProxyGrowthPercent.maximum,
    targetEnterpriseValueUsd: roundMoney(targetEnterpriseValue),
  } as const;
  if (lowerValue.greaterThan(upperValue)) {
    return {
      ...reverseBase,
      reason: "target_not_bracketed",
      status: "unavailable",
    };
  }
  if (targetEnterpriseValue.lessThan(lowerValue)) {
    return {
      ...reverseBase,
      reason: "target_below_growth_search_bound",
      status: "unavailable",
    };
  }
  if (targetEnterpriseValue.greaterThan(upperValue)) {
    return {
      ...reverseBase,
      reason: "target_above_growth_search_bound",
      status: "unavailable",
    };
  }
  if (targetEnterpriseValue.equals(lowerValue)) upper = lower;
  if (targetEnterpriseValue.equals(upperValue)) lower = upper;
  for (
    let iteration = 0;
    iteration < PERSONAL_FCFF_DCF_REVERSE_BISECTION_ITERATIONS;
    iteration += 1
  ) {
    const midpoint = lower.plus(upper).div(2);
    const value = enterpriseValueAtGrowth(midpoint, forecastYears, context);
    if (value.equals(targetEnterpriseValue)) {
      lower = midpoint;
      upper = midpoint;
    } else if (value.lessThan(targetEnterpriseValue)) lower = midpoint;
    else upper = midpoint;
  }
  const targetMoney = roundMoney(targetEnterpriseValue);
  const moneyResolvedCandidates = [lower, upper, lower.plus(upper).div(2)]
    .map((growth) => {
      const resolvedAnnualGrowthPercent = round(
        growth.mul(100),
        PERSONAL_FCFF_DCF_REVERSE_EXACT_RATE_DECIMAL_PLACES,
      );
      const resolvedGrowth = percentDecimal(resolvedAnnualGrowthPercent);
      const enterpriseValue = enterpriseValueAtGrowth(
        resolvedGrowth,
        forecastYears,
        context,
      );
      return {
        enterpriseValue,
        growth: resolvedGrowth,
        resolvedAnnualGrowthPercent,
        residual: enterpriseValue.minus(targetEnterpriseValue).abs(),
      };
    })
    .filter(
      (candidate) => roundMoney(candidate.enterpriseValue) === targetMoney,
    );
  const firstResolvedCandidate = moneyResolvedCandidates[0];
  if (firstResolvedCandidate === undefined) {
    return {
      ...reverseBase,
      reason: "target_money_precision_not_resolved",
      status: "unavailable",
    };
  }
  const solved = moneyResolvedCandidates.reduce((best, candidate) =>
    candidate.residual.lessThan(best.residual) ? candidate : best,
  );
  return {
    ...reverseBase,
    impliedAnnualFcfProxyGrowthPercent: roundRate(solved.growth.mul(100)),
    iterations: PERSONAL_FCFF_DCF_REVERSE_BISECTION_ITERATIONS,
    resolvedAnnualFcfProxyGrowthPercent: solved.resolvedAnnualGrowthPercent,
    solvedEnterpriseValueUsd: roundMoney(solved.enterpriseValue),
    status: "available",
  };
}

function enterpriseValueAtGrowth(
  growth: Decimal,
  forecastYears: number,
  context: CalculationContext,
): Decimal {
  return calculateEnterpriseValue(
    context.startingUnleveredFcfProxy,
    growth,
    context.wacc,
    context.terminalGrowth,
    forecastYears,
  ).enterpriseValue;
}

function calculateSensitivity(
  growth: Decimal,
  forecastYears: number,
  context: CalculationContext,
): PersonalFcffDcfSensitivity {
  const cells = PERSONAL_FCFF_DCF_SENSITIVITY_WACC_DELTAS.flatMap((waccDelta) =>
    PERSONAL_FCFF_DCF_SENSITIVITY_TERMINAL_GROWTH_DELTAS.map(
      (terminalGrowthDelta): PersonalFcffDcfSensitivityCell => {
        const wacc = context.wacc.plus(percentDecimal(waccDelta));
        const terminalGrowth = context.terminalGrowth.plus(
          percentDecimal(terminalGrowthDelta),
        );
        const cellBase = {
          terminalGrowthPercent: roundRate(terminalGrowth.mul(100)),
          waccPercent: roundRate(wacc.mul(100)),
        } as const;
        if (
          !within(wacc, "waccPercent") ||
          !within(terminalGrowth, "terminalGrowthPercent")
        ) {
          return {
            ...cellBase,
            reason: "sensitivity_rate_out_of_bounds",
            status: "unavailable",
          };
        }
        if (wacc.lessThanOrEqualTo(terminalGrowth)) {
          return {
            ...cellBase,
            reason: "discount_rate_not_above_terminal_growth",
            status: "unavailable",
          };
        }
        const calculation = calculateEnterpriseValue(
          context.startingUnleveredFcfProxy,
          growth,
          wacc,
          terminalGrowth,
          forecastYears,
        );
        const equityValue = calculation.enterpriseValue.minus(context.bridge);
        if (!equityValue.greaterThan(0)) {
          return {
            ...cellBase,
            reason: "nonpositive_equity_value",
            status: "unavailable",
          };
        }
        return {
          ...cellBase,
          impliedPriceUsd: roundPrice(equityValue.div(context.shareCount)),
          status: "available",
        };
      },
    ),
  );
  return freezeDeep({
    cells,
    scenario: "base",
    terminalGrowthDeltasPercentagePoints:
      PERSONAL_FCFF_DCF_SENSITIVITY_TERMINAL_GROWTH_DELTAS,
    waccDeltasPercentagePoints: PERSONAL_FCFF_DCF_SENSITIVITY_WACC_DELTAS,
  });
}

function unavailable(
  reason: PersonalFcffDcfUnavailableReason,
  missingAnnualInputs: readonly PersonalFcffDcfAnnualInputKey[] = [],
): PersonalFcffDcfUnavailableResult {
  return freezeDeep({
    formulaSetVersion: PERSONAL_FCFF_DCF_FORMULA_SET_VERSION,
    methodology: PERSONAL_FCFF_DCF_METHODOLOGY,
    missingAnnualInputs: [...missingAnnualInputs],
    reason,
    schemaVersion: PERSONAL_FCFF_DCF_SCHEMA_VERSION,
    status: "unavailable",
  });
}

function parseAssumptions(input: PersonalFcffDcfAssumptions): Readonly<{
  growth: Readonly<Record<PersonalFcffDcfScenario, Decimal>>;
  taxShieldRate: Decimal;
  terminalGrowth: Decimal;
  wacc: Decimal;
}> {
  return {
    growth: {
      base: percentDecimal(input.scenarios.base.annualFcfProxyGrowthPercent),
      conservative: percentDecimal(
        input.scenarios.conservative.annualFcfProxyGrowthPercent,
      ),
      expansion: percentDecimal(
        input.scenarios.expansion.annualFcfProxyGrowthPercent,
      ),
    },
    taxShieldRate: percentDecimal(input.taxShieldRatePercent),
    terminalGrowth: percentDecimal(input.terminalGrowthPercent),
    wacc: percentDecimal(input.waccPercent),
  };
}

function within(
  valueAsRate: Decimal,
  key:
    | "annualFcfProxyGrowthPercent"
    | "taxShieldRatePercent"
    | "terminalGrowthPercent"
    | "waccPercent",
): boolean {
  const bounds = PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS[key];
  return (
    valueAsRate.greaterThanOrEqualTo(percentDecimal(bounds.minimum)) &&
    valueAsRate.lessThanOrEqualTo(percentDecimal(bounds.maximum))
  );
}

function latestCommonObservation(
  bars: ValidatedMarket["bars"],
  points: ValidatedValuation["points"],
): Readonly<{
  bar: ValidatedMarket["bars"][number];
  point: ValidatedValuation["points"][number];
}> | null {
  let barIndex = bars.length - 1;
  let pointIndex = points.length - 1;
  while (barIndex >= 0 && pointIndex >= 0) {
    const bar = bars[barIndex];
    const point = points[pointIndex];
    if (bar === undefined || point === undefined) throw new TypeError();
    if (bar.date === point.date) return { bar, point };
    if (bar.date > point.date) barIndex -= 1;
    else pointIndex -= 1;
  }
  return null;
}

function validateInput(value: unknown): ValidatedInput {
  const input = exactRecord(value, INPUT_KEYS);
  const assumptions = validateAssumptions(input.assumptions);
  return {
    annuals: input.annuals === null ? null : validateAnnuals(input.annuals),
    assumptions,
    market: input.market === null ? null : validateMarket(input.market),
    selection:
      input.selection === null ? null : validateIdentity(input.selection),
    valuation:
      input.valuation === null ? null : validateValuation(input.valuation),
  };
}

function validateAssumptions(value: unknown): PersonalFcffDcfAssumptions {
  const input = exactRecord(value, ASSUMPTION_KEYS);
  if (
    !Number.isInteger(input.forecastYears) ||
    typeof input.forecastYears !== "number"
  ) {
    throw new TypeError();
  }
  const scenarios = exactRecord(input.scenarios, SCENARIO_KEYS);
  return {
    forecastYears: input.forecastYears,
    scenarios: {
      base: validateScenarioAssumption(scenarios.base),
      conservative: validateScenarioAssumption(scenarios.conservative),
      expansion: validateScenarioAssumption(scenarios.expansion),
    },
    taxShieldRatePercent: validateRateLexeme(input.taxShieldRatePercent),
    terminalGrowthPercent: validateRateLexeme(input.terminalGrowthPercent),
    waccPercent: validateRateLexeme(input.waccPercent),
  };
}

function validateScenarioAssumption(
  value: unknown,
): PersonalFcffDcfScenarioAssumption {
  const input = exactRecord(value, SCENARIO_ASSUMPTION_KEYS);
  return {
    annualFcfProxyGrowthPercent: validateRateLexeme(
      input.annualFcfProxyGrowthPercent,
    ),
  };
}

function validateMarket(value: unknown): ValidatedMarket {
  const input = exactRecord(value, MARKET_KEYS);
  if (input.priceCurrency !== "USD") throw new TypeError();
  if (!Array.isArray(input.bars)) throw new TypeError();
  if (input.bars.length > PERSONAL_FCFF_DCF_MAXIMUM_MARKET_OBSERVATIONS)
    throw new TypeError();
  const bars = input.bars.map((candidate) => {
    const bar = exactRecord(candidate, BAR_KEYS);
    const raw = exactRecord(bar.raw, RAW_KEYS);
    return {
      date: validateDate(bar.date),
      rawClose: validateDecimalLexeme(raw.close),
    };
  });
  assertStrictChronology(bars);
  return {
    bars,
    priceCurrency: "USD",
    range: validateRange(input.range),
    security: validateIdentity(input.security),
  };
}

function validateValuation(value: unknown): ValidatedValuation {
  const input = exactRecord(value, VALUATION_KEYS);
  if (!Array.isArray(input.points)) throw new TypeError();
  if (input.points.length > PERSONAL_FCFF_DCF_MAXIMUM_MARKET_OBSERVATIONS)
    throw new TypeError();
  const points = input.points.map((candidate) => {
    const point = exactRecord(candidate, VALUATION_POINT_KEYS);
    return {
      date: validateDate(point.date),
      enterpriseValue: validateMoneyCell(point.enterpriseValue),
      marketCapitalization: validateMoneyCell(point.marketCapitalization),
    };
  });
  assertStrictChronology(points);
  const asOf = validateTimestamp(input.asOf);
  const asOfDate = asOf.slice(0, 10);
  if (points.some((point) => point.date > asOfDate)) throw new TypeError();
  return {
    asOf,
    points,
    range: validateRange(input.range),
    security: validateIdentity(input.security),
  };
}

function validateAnnuals(value: unknown): ValidatedAnnuals {
  const input = exactRecord(value, ANNUALS_KEYS);
  if (input.valueCurrency !== "USD") throw new TypeError();
  if (!Array.isArray(input.years)) throw new TypeError();
  if (input.years.length > PERSONAL_FCFF_DCF_MAXIMUM_ANNUAL_PERIODS)
    throw new TypeError();
  const years = input.years.map((candidate) => {
    const period = exactRecord(candidate, ANNUAL_PERIOD_KEYS);
    if (
      typeof period.fiscalYear !== "number" ||
      !Number.isInteger(period.fiscalYear) ||
      period.fiscalYear < 1900 ||
      period.fiscalYear > 9999
    ) {
      throw new TypeError();
    }
    const reported = exactRecord(
      period.reported,
      PERSONAL_FCFF_DCF_ANNUAL_INPUT_KEYS,
    );
    return {
      fiscalYear: period.fiscalYear,
      reported: {
        free_cash_flow: validateAnnualCell(reported.free_cash_flow),
        interest_expense: validateAnnualCell(reported.interest_expense),
      },
      statementDate: validateDate(period.statementDate),
    };
  });
  for (let index = 1; index < years.length; index += 1) {
    const prior = years[index - 1];
    const current = years[index];
    if (
      prior === undefined ||
      current === undefined ||
      prior.fiscalYear <= current.fiscalYear
    ) {
      throw new TypeError();
    }
  }
  const asOf = validateTimestamp(input.asOf);
  const asOfDate = asOf.slice(0, 10);
  if (years.some((year) => year.statementDate > asOfDate))
    throw new TypeError();
  return {
    asOf,
    security: validateIdentity(input.security),
    valueCurrency: "USD",
    years,
  };
}

function validateMoneyCell(value: unknown): PersonalFcffDcfMoneyCell {
  if (!isRecord(value)) throw new TypeError();
  if (value.status === "known") {
    const cell = exactRecord(value, KNOWN_MONEY_CELL_KEYS);
    if (cell.status !== "known" || cell.unit !== "USD") throw new TypeError();
    return {
      status: "known",
      unit: "USD",
      value: validateDecimalLexeme(cell.value),
    };
  }
  const cell = exactRecord(value, UNKNOWN_MONEY_CELL_KEYS);
  if (
    cell.reason !== "not_supplied_by_provider" ||
    cell.status !== "unknown" ||
    cell.unit !== "USD" ||
    cell.value !== null
  ) {
    throw new TypeError();
  }
  return {
    reason: "not_supplied_by_provider",
    status: "unknown",
    unit: "USD",
    value: null,
  };
}

function validateAnnualCell(value: unknown): PersonalFcffDcfAnnualCell {
  if (!isRecord(value)) throw new TypeError();
  if (value.status === "known") {
    const cell = exactRecord(value, KNOWN_ANNUAL_CELL_KEYS);
    if (cell.status !== "known") throw new TypeError();
    return {
      status: "known",
      value: validateDecimalLexeme(cell.value),
    };
  }
  const cell = exactRecord(value, UNKNOWN_ANNUAL_CELL_KEYS);
  if (
    cell.reason !== "not_supplied_by_provider" ||
    cell.status !== "unknown" ||
    cell.value !== null
  ) {
    throw new TypeError();
  }
  return {
    reason: "not_supplied_by_provider",
    status: "unknown",
    value: null,
  };
}

function validateIdentity(value: unknown): PersonalFcffDcfIdentity {
  const input = exactRecord(value, IDENTITY_KEYS);
  if (
    input.country !== "US" ||
    typeof input.exchangeMic !== "string" ||
    !EXCHANGE_MIC_PATTERN.test(input.exchangeMic) ||
    !validText(input.issuerName, 1, 256) ||
    typeof input.listingId !== "string" ||
    !IDENTIFIER_PATTERN.test(input.listingId) ||
    !validText(input.securityName, 1, 256) ||
    typeof input.symbol !== "string" ||
    !SYMBOL_PATTERN.test(input.symbol)
  ) {
    throw new TypeError();
  }
  return {
    country: "US",
    exchangeMic: input.exchangeMic,
    issuerName: input.issuerName,
    listingId: input.listingId,
    securityName: input.securityName,
    symbol: input.symbol,
  };
}

function sameIdentity(
  left: PersonalFcffDcfIdentity,
  right: PersonalFcffDcfIdentity,
): boolean {
  return (
    left.country === right.country &&
    left.exchangeMic === right.exchangeMic &&
    left.issuerName === right.issuerName &&
    left.listingId === right.listingId &&
    left.securityName === right.securityName &&
    left.symbol === right.symbol
  );
}

function validateRange(value: unknown): PersonalFcffDcfRange {
  if (
    typeof value !== "string" ||
    !PERSONAL_FCFF_DCF_RANGES.some((candidate) => candidate === value)
  ) {
    throw new TypeError();
  }
  return value as PersonalFcffDcfRange;
}

function validateDecimalLexeme(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > PERSONAL_FCFF_DCF_MAXIMUM_DECIMAL_LENGTH ||
    !DECIMAL_PATTERN.test(value)
  ) {
    throw new TypeError();
  }
  const parsed = new ValidationDecimal(value);
  if (!parsed.isFinite()) throw new TypeError();
  return value;
}

function validateRateLexeme(value: unknown): string {
  const lexeme = validateDecimalLexeme(value);
  const fractional = lexeme.split(".")[1];
  if (
    fractional !== undefined &&
    fractional.length > PERSONAL_FCFF_DCF_ROUNDING.rateDecimalPlaces
  ) {
    throw new TypeError();
  }
  return lexeme;
}

function validateDate(value: unknown): string {
  if (typeof value !== "string") throw new TypeError();
  const match = DATE_PATTERN.exec(value);
  if (match === null) throw new TypeError();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9999) throw new TypeError();
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TypeError();
  }
  return value;
}

function validateTimestamp(value: unknown): string {
  if (typeof value !== "string" || CONTROL_PATTERN.test(value))
    throw new TypeError();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value)
    throw new TypeError();
  return value;
}

function assertStrictChronology(
  values: readonly Readonly<{ date: string }>[],
): void {
  for (let index = 1; index < values.length; index += 1) {
    const prior = values[index - 1];
    const current = values[index];
    if (
      prior === undefined ||
      current === undefined ||
      prior.date >= current.date
    )
      throw new TypeError();
  }
}

function knownAnnualLexeme(cell: PersonalFcffDcfAnnualCell): string {
  if (cell.status !== "known") throw new TypeError();
  return cell.value;
}

function decimal(value: string): Decimal {
  return new CalculationDecimal(value);
}

function percentDecimal(value: string): Decimal {
  return decimal(value).div(100);
}

function roundMoney(value: Decimal): string {
  return round(value, PERSONAL_FCFF_DCF_ROUNDING.moneyDecimalPlaces);
}

function roundPrice(value: Decimal): string {
  return round(value, PERSONAL_FCFF_DCF_ROUNDING.impliedPriceDecimalPlaces);
}

function roundPercent(value: Decimal): string {
  return round(value, PERSONAL_FCFF_DCF_ROUNDING.percentDecimalPlaces);
}

function roundRate(value: Decimal): string {
  return round(value, PERSONAL_FCFF_DCF_ROUNDING.rateDecimalPlaces);
}

function roundShares(value: Decimal): string {
  return round(value, PERSONAL_FCFF_DCF_ROUNDING.shareCountDecimalPlaces);
}

function round(value: Decimal, decimalPlaces: number): string {
  const rounded = value.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
  return rounded.isZero()
    ? new CalculationDecimal(0).toFixed(decimalPlaces)
    : rounded.toFixed(decimalPlaces);
}

function formula(formulaId: string, expression: string) {
  return {
    expression,
    formulaId,
    formulaVersion: PERSONAL_FCFF_DCF_FORMULA_SET_VERSION,
  } as const;
}

function exactRecord<const K extends readonly string[]>(
  value: unknown,
  keys: K,
): Record<K[number], unknown> {
  if (!isRecord(value)) throw new TypeError();
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new TypeError();
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function validText(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length >= minimum &&
    value.length <= maximum &&
    value.trim() === value &&
    !CONTROL_PATTERN.test(value)
  );
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
