import Decimal from "decimal.js";

export const PERSONAL_MANUAL_PEER_COMPARISON_SCHEMA_VERSION = "1.0.0" as const;
export const PERSONAL_MANUAL_PEER_COMPARISON_FORMULA_SET_VERSION =
  "1.0.0" as const;
export const PERSONAL_MANUAL_PEER_COMPARISON_MAXIMUM_PEERS = 3 as const;

export const PERSONAL_MANUAL_PEER_COMPARISON_METRIC_IDS = Object.freeze([
  "revenue",
  "market_capitalization",
  "enterprise_value",
  "revenue_growth",
  "gross_margin",
  "operating_margin",
  "net_margin",
  "free_cash_flow_margin",
  "net_debt",
  "debt_to_assets",
  "current_ratio",
  "revenue_to_ending_assets",
  "price_to_earnings",
  "price_to_book",
  "trailing_peg_1y",
] as const);

export const PERSONAL_MANUAL_PEER_COMPARISON_UNAVAILABLE_REASONS =
  Object.freeze([
    "source_not_loaded",
    "source_quarantined",
    "primary_anchor_unavailable",
    "exact_fiscal_year_not_found",
    "exact_prior_fiscal_year_not_found",
    "exact_valuation_date_not_found",
    "missing_input",
    "nonpositive_denominator",
  ] as const);

export const PERSONAL_MANUAL_PEER_COMPARISON_SOURCE_ISSUE_REASONS =
  Object.freeze([
    "invalid_shape",
    "invalid_provider",
    "identity_mismatch",
    "invalid_as_of",
    "invalid_coverage",
    "invalid_periods",
    "statement_date_after_as_of",
    "invalid_history",
    "range_mismatch",
  ] as const);

export const PERSONAL_MANUAL_PEER_COMPARISON_ROUNDING = freezeDeep({
  method: "round_half_up",
  moneyDecimalPlaces: 2,
  negativeZero: "normalize_to_positive_zero",
  percentDecimalPlaces: 2,
  ratioDecimalPlaces: 4,
} as const);

export const PERSONAL_MANUAL_PEER_COMPARISON_LIMITATIONS = Object.freeze([
  "owner_manually_selected_companies_only",
  "maximum_three_peers",
  "no_aggregation_ranking_percentiles_or_recommendation",
  "provider_most_recent_not_point_in_time",
  "annual_alignment_uses_exact_fiscal_year_label_without_period_end_data",
  "statement_dates_are_provider_release_dates_and_need_not_match",
  "valuation_alignment_uses_exact_date_without_nearest_date_fallback",
  "pure_engine_performs_no_network_requests_or_persistence",
] as const);

export type PersonalManualPeerComparisonMetricId =
  (typeof PERSONAL_MANUAL_PEER_COMPARISON_METRIC_IDS)[number];
export type PersonalManualPeerComparisonUnavailableReason =
  (typeof PERSONAL_MANUAL_PEER_COMPARISON_UNAVAILABLE_REASONS)[number];
export type PersonalManualPeerComparisonSourceIssueReason =
  (typeof PERSONAL_MANUAL_PEER_COMPARISON_SOURCE_ISSUE_REASONS)[number];
export type PersonalManualPeerComparisonDomain = "annual" | "valuation";
export type PersonalManualPeerComparisonUnit = "USD" | "percent" | "ratio";

export interface PersonalManualPeerComparisonSelection {
  readonly country: "US";
  readonly exchangeMic: string;
  readonly issuerId: string;
  readonly issuerName: string;
  readonly listingId: string;
  readonly securityName: string;
  readonly symbol: string;
}

export interface PersonalManualPeerComparisonCompanyInput {
  readonly annualFinancials: unknown;
  readonly selection: PersonalManualPeerComparisonSelection;
  readonly valuationHistory: unknown;
}

export interface PersonalManualPeerComparisonInput {
  readonly peers: readonly PersonalManualPeerComparisonCompanyInput[];
  readonly primary: PersonalManualPeerComparisonCompanyInput;
}

export interface PersonalManualPeerComparisonAnnualCoordinate {
  readonly asOf: string;
  readonly fiscalYear: number;
  readonly kind: "annual";
  readonly statementDate: string;
}

export interface PersonalManualPeerComparisonValuationCoordinate {
  readonly asOf: string;
  readonly date: string;
  readonly kind: "valuation";
}

export type PersonalManualPeerComparisonCoordinate =
  | PersonalManualPeerComparisonAnnualCoordinate
  | PersonalManualPeerComparisonValuationCoordinate;

export type PersonalManualPeerComparisonInputReference =
  | Readonly<{
      domain: "annual";
      fieldKey: AnnualFieldKey;
      fiscalYear: number;
      listingId: string;
      statementDate: string;
      status: "known";
      unit: "USD";
      value: string;
    }>
  | Readonly<{
      domain: "annual";
      fieldKey: AnnualFieldKey;
      fiscalYear: number;
      listingId: string;
      statementDate: string;
      status: "unknown";
      unit: "USD";
      value: null;
    }>
  | Readonly<{
      date: string;
      domain: "valuation";
      fieldKey: ValuationFieldKey;
      listingId: string;
      status: "known";
      unit: "USD" | "ratio";
      value: string;
    }>
  | Readonly<{
      date: string;
      domain: "valuation";
      fieldKey: ValuationFieldKey;
      listingId: string;
      status: "unknown";
      unit: "USD" | "ratio";
      value: null;
    }>;

export interface PersonalManualPeerComparisonAvailableCell {
  readonly coordinate: PersonalManualPeerComparisonCoordinate;
  readonly inputRefs: readonly PersonalManualPeerComparisonInputReference[];
  readonly listingId: string;
  readonly status: "available";
  readonly value: string;
}

export interface PersonalManualPeerComparisonUnavailableCell {
  readonly coordinate: PersonalManualPeerComparisonCoordinate | null;
  readonly inputRefs: readonly PersonalManualPeerComparisonInputReference[];
  readonly listingId: string;
  readonly reason: PersonalManualPeerComparisonUnavailableReason;
  readonly status: "unavailable";
}

export type PersonalManualPeerComparisonCell =
  | PersonalManualPeerComparisonAvailableCell
  | PersonalManualPeerComparisonUnavailableCell;

export interface PersonalManualPeerComparisonRow {
  readonly cells: readonly PersonalManualPeerComparisonCell[];
  readonly domain: PersonalManualPeerComparisonDomain;
  readonly expression: string;
  readonly formulaId: string;
  readonly formulaVersion: typeof PERSONAL_MANUAL_PEER_COMPARISON_FORMULA_SET_VERSION;
  readonly label: string;
  readonly metricId: PersonalManualPeerComparisonMetricId;
  readonly unit: PersonalManualPeerComparisonUnit;
}

export interface PersonalManualPeerComparisonSourceIssue {
  readonly reason: PersonalManualPeerComparisonSourceIssueReason;
}

export type PersonalManualPeerComparisonSourceState =
  | Readonly<{ status: "not_loaded" }>
  | Readonly<{
      issues: readonly PersonalManualPeerComparisonSourceIssue[];
      status: "quarantined";
    }>
  | Readonly<{
      asOf: string;
      coordinate: PersonalManualPeerComparisonCoordinate | null;
      status: "ready";
    }>;

export interface PersonalManualPeerComparisonCompany {
  readonly annual: PersonalManualPeerComparisonSourceState;
  readonly role: "primary" | "peer";
  readonly selection: PersonalManualPeerComparisonSelection;
  readonly valuation: PersonalManualPeerComparisonSourceState;
}

export interface PersonalManualPeerComparisonResult {
  readonly anchors: Readonly<{
    annualFiscalYear: number | null;
    valuationDate: string | null;
  }>;
  readonly companies: readonly PersonalManualPeerComparisonCompany[];
  readonly formulaSetVersion: typeof PERSONAL_MANUAL_PEER_COMPARISON_FORMULA_SET_VERSION;
  readonly limitations: typeof PERSONAL_MANUAL_PEER_COMPARISON_LIMITATIONS;
  readonly rows: readonly PersonalManualPeerComparisonRow[];
  readonly schemaVersion: typeof PERSONAL_MANUAL_PEER_COMPARISON_SCHEMA_VERSION;
  readonly status: "ready";
}

const ANNUAL_FIELD_KEYS = Object.freeze([
  "accounts_receivable",
  "assets",
  "capital_expenditures",
  "cash",
  "cost_of_revenue",
  "current_assets",
  "current_liabilities",
  "debt",
  "depreciation_and_amortization",
  "ebitda",
  "financing_cash_flow",
  "free_cash_flow",
  "gross_profit",
  "income_tax_expense",
  "intangibles",
  "inventory",
  "investing_cash_flow",
  "liabilities",
  "net_income",
  "operating_cash_flow",
  "operating_expenses",
  "operating_income",
  "pretax_income",
  "property_plant_equipment_net",
  "research_and_development",
  "revenue",
  "selling_general_and_administrative",
  "share_based_compensation",
  "shareholders_equity",
  "interest_expense",
] as const);

type AnnualFieldKey = (typeof ANNUAL_FIELD_KEYS)[number];
type ValuationFieldKey =
  | "enterpriseValue"
  | "marketCapitalization"
  | "priceToBook"
  | "priceToEarnings"
  | "trailingPeg1Y";

type AnnualCell =
  | Readonly<{ status: "known"; value: string }>
  | Readonly<{ status: "unknown"; value: null }>;

interface AnnualPeriod {
  readonly fiscalYear: number;
  readonly reported: Readonly<Record<AnnualFieldKey, AnnualCell>>;
  readonly statementDate: string;
}

interface ValidatedAnnual {
  readonly asOf: string;
  readonly years: readonly AnnualPeriod[];
}

type ValuationCell =
  | Readonly<{ status: "known"; unit: "USD" | "ratio"; value: string }>
  | Readonly<{ status: "unknown"; unit: "USD" | "ratio"; value: null }>;

interface ValuationPoint {
  readonly date: string;
  readonly enterpriseValue: ValuationCell;
  readonly marketCapitalization: ValuationCell;
  readonly priceToBook: ValuationCell;
  readonly priceToEarnings: ValuationCell;
  readonly trailingPeg1Y: ValuationCell;
}

interface ValidatedValuation {
  readonly asOf: string;
  readonly latestPoint: ValuationPoint;
  readonly points: readonly ValuationPoint[];
  readonly range: string;
}

type ValidatedSource<T> =
  | Readonly<{ status: "not_loaded" }>
  | Readonly<{
      issues: readonly PersonalManualPeerComparisonSourceIssue[];
      status: "quarantined";
    }>
  | Readonly<{ data: T; status: "ready" }>;

interface ValidatedCompany {
  readonly annual: ValidatedSource<ValidatedAnnual>;
  readonly role: "primary" | "peer";
  readonly selection: PersonalManualPeerComparisonSelection;
  readonly valuation: ValidatedSource<ValidatedValuation>;
}

interface MetricDefinition {
  readonly domain: PersonalManualPeerComparisonDomain;
  readonly expression: string;
  readonly formulaId: string;
  readonly label: string;
  readonly metricId: PersonalManualPeerComparisonMetricId;
  readonly unit: PersonalManualPeerComparisonUnit;
}

const METRIC_DEFINITIONS: readonly MetricDefinition[] = Object.freeze([
  {
    domain: "annual",
    expression: "revenue",
    formulaId: "reported_revenue",
    label: "Revenue",
    metricId: "revenue",
    unit: "USD",
  },
  {
    domain: "valuation",
    expression: "provider_market_capitalization",
    formulaId: "provider_market_capitalization",
    label: "Market capitalization",
    metricId: "market_capitalization",
    unit: "USD",
  },
  {
    domain: "valuation",
    expression: "provider_enterprise_value",
    formulaId: "provider_enterprise_value",
    label: "Enterprise value",
    metricId: "enterprise_value",
    unit: "USD",
  },
  {
    domain: "annual",
    expression: "100 * (revenue_fy / revenue_fy_minus_1 - 1)",
    formulaId: "exact_fiscal_year_revenue_growth_percent",
    label: "Revenue growth",
    metricId: "revenue_growth",
    unit: "percent",
  },
  {
    domain: "annual",
    expression: "100 * gross_profit / revenue",
    formulaId: "gross_margin_percent",
    label: "Gross margin",
    metricId: "gross_margin",
    unit: "percent",
  },
  {
    domain: "annual",
    expression: "100 * operating_income / revenue",
    formulaId: "operating_margin_percent",
    label: "Operating margin",
    metricId: "operating_margin",
    unit: "percent",
  },
  {
    domain: "annual",
    expression: "100 * net_income / revenue",
    formulaId: "net_margin_percent",
    label: "Net margin",
    metricId: "net_margin",
    unit: "percent",
  },
  {
    domain: "annual",
    expression: "100 * free_cash_flow / revenue",
    formulaId: "free_cash_flow_margin_percent",
    label: "Free cash flow margin",
    metricId: "free_cash_flow_margin",
    unit: "percent",
  },
  {
    domain: "annual",
    expression: "debt - cash",
    formulaId: "net_debt",
    label: "Net debt",
    metricId: "net_debt",
    unit: "USD",
  },
  {
    domain: "annual",
    expression: "100 * debt / assets",
    formulaId: "debt_to_assets_percent",
    label: "Debt / assets",
    metricId: "debt_to_assets",
    unit: "percent",
  },
  {
    domain: "annual",
    expression: "current_assets / current_liabilities",
    formulaId: "current_ratio",
    label: "Current ratio",
    metricId: "current_ratio",
    unit: "ratio",
  },
  {
    domain: "annual",
    expression: "revenue / assets",
    formulaId: "revenue_to_ending_assets_ratio",
    label: "Revenue / ending assets",
    metricId: "revenue_to_ending_assets",
    unit: "ratio",
  },
  {
    domain: "valuation",
    expression: "provider_price_to_earnings",
    formulaId: "provider_price_to_earnings",
    label: "Price / earnings",
    metricId: "price_to_earnings",
    unit: "ratio",
  },
  {
    domain: "valuation",
    expression: "provider_price_to_book",
    formulaId: "provider_price_to_book",
    label: "Price / book",
    metricId: "price_to_book",
    unit: "ratio",
  },
  {
    domain: "valuation",
    expression: "provider_trailing_peg_1y",
    formulaId: "provider_trailing_peg_1y",
    label: "Trailing PEG (1Y)",
    metricId: "trailing_peg_1y",
    unit: "ratio",
  },
]);

const CalculationDecimal = Decimal.clone({
  defaults: true,
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
});

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const DECIMAL_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;
const CONTROL_PATTERN = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const EXCHANGE_MIC_PATTERN = /^[A-Z0-9]{4}$/u;
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,14}$/u;
const MAXIMUM_DECIMAL_LENGTH = 64;

const INPUT_KEYS = ["peers", "primary"] as const;
const COMPANY_KEYS = [
  "annualFinancials",
  "selection",
  "valuationHistory",
] as const;
const SELECTION_KEYS = [
  "country",
  "exchangeMic",
  "issuerId",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;
const SECURITY_KEYS = [
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;
const ANNUAL_KEYS = [
  "asOf",
  "coverage",
  "profile",
  "provider",
  "schemaVersion",
  "security",
  "status",
  "years",
] as const;
const ANNUAL_PROVIDER_KEYS = [
  "attribution",
  "export",
  "id",
  "name",
  "persistence",
  "redistribution",
  "retention",
  "revisionBasis",
  "statementFeed",
  "valueCurrency",
] as const;
const ANNUAL_COVERAGE_KEYS = [
  "earliestFiscalYear",
  "knownReportedCells",
  "latestFiscalYear",
  "missingFiscalYears",
  "requestedAnnualYears",
  "returnedAnnualYears",
  "status",
  "unknownReportedCells",
] as const;
const ANNUAL_PERIOD_KEYS = ["fiscalYear", "reported", "statementDate"] as const;
const KNOWN_ANNUAL_CELL_KEYS = ["status", "value"] as const;
const UNKNOWN_ANNUAL_CELL_KEYS = ["reason", "status", "value"] as const;
const VALUATION_KEYS = [
  "asOf",
  "coverage",
  "history",
  "profile",
  "provider",
  "schemaVersion",
  "security",
  "status",
] as const;
const VALUATION_PROVIDER_KEYS = [
  "attribution",
  "export",
  "id",
  "name",
  "persistence",
  "redistribution",
  "retention",
  "revisionBasis",
  "valuationFeed",
  "valueCurrency",
] as const;
const VALUATION_COVERAGE_KEYS = [
  "knownCells",
  "observationCount",
  "status",
  "unknownCells",
] as const;
const VALUATION_HISTORY_KEYS = [
  "endDate",
  "latestPoint",
  "points",
  "range",
  "startDate",
] as const;
const VALUATION_POINT_KEYS = [
  "date",
  "enterpriseValue",
  "marketCapitalization",
  "priceToBook",
  "priceToEarnings",
  "trailingPeg1Y",
] as const;
const KNOWN_VALUATION_CELL_KEYS = ["status", "unit", "value"] as const;
const UNKNOWN_VALUATION_CELL_KEYS = [
  "reason",
  "status",
  "unit",
  "value",
] as const;
const VALUATION_FIELD_KEYS = [
  "enterpriseValue",
  "marketCapitalization",
  "priceToBook",
  "priceToEarnings",
  "trailingPeg1Y",
] as const satisfies readonly ValuationFieldKey[];
const MARKET_RANGES = new Set(["1m", "3m", "ytd", "1y", "5y", "10y"]);

class SourceValidationError extends Error {
  public constructor(
    public readonly reason: PersonalManualPeerComparisonSourceIssueReason,
  ) {
    super(reason);
  }
}

export function buildPersonalManualPeerComparison(
  input: PersonalManualPeerComparisonInput,
): PersonalManualPeerComparisonResult {
  try {
    return buildValidatedPersonalManualPeerComparison(input);
  } catch {
    throw new TypeError("Personal manual peer comparison input is invalid.");
  }
}

function buildValidatedPersonalManualPeerComparison(
  input: PersonalManualPeerComparisonInput,
): PersonalManualPeerComparisonResult {
  const root = exactRecord(input, INPUT_KEYS);
  const peers = exactDenseArray(
    root.peers,
    PERSONAL_MANUAL_PEER_COMPARISON_MAXIMUM_PEERS,
  );
  const carriers = [root.primary, ...peers].map((value, index) =>
    validateCompanyCarrier(value, index === 0 ? "primary" : "peer"),
  );
  const listingIds = new Set<string>();
  const issuerIds = new Set<string>();
  for (const carrier of carriers) {
    if (
      listingIds.has(carrier.selection.listingId) ||
      issuerIds.has(carrier.selection.issuerId)
    ) {
      throw new TypeError();
    }
    listingIds.add(carrier.selection.listingId);
    issuerIds.add(carrier.selection.issuerId);
  }

  const parsedCompanies: ValidatedCompany[] = carriers.map((carrier) => ({
    annual: validateAnnualSource(carrier.annualFinancials, carrier.selection),
    role: carrier.role,
    selection: carrier.selection,
    valuation: validateValuationSource(
      carrier.valuationHistory,
      carrier.selection,
    ),
  }));
  const parsedPrimary = parsedCompanies[0];
  if (parsedPrimary === undefined) throw new TypeError();
  const primaryValuationRange =
    parsedPrimary.valuation.status === "ready"
      ? parsedPrimary.valuation.data.range
      : null;
  const companies = parsedCompanies.map((company) => ({
    ...company,
    valuation:
      company.role === "peer" &&
      primaryValuationRange !== null &&
      company.valuation.status === "ready" &&
      company.valuation.data.range !== primaryValuationRange
        ? {
            issues: [{ reason: "range_mismatch" as const }],
            status: "quarantined" as const,
          }
        : company.valuation,
  }));
  const primary = companies[0];
  if (primary === undefined) throw new TypeError();
  const annualFiscalYear =
    primary.annual.status === "ready"
      ? (primary.annual.data.years[0]?.fiscalYear ?? null)
      : null;
  const valuationDate =
    primary.valuation.status === "ready"
      ? primary.valuation.data.latestPoint.date
      : null;

  const companyResults = companies.map((company) =>
    buildCompanyResult(company, annualFiscalYear, valuationDate),
  );
  const rows = METRIC_DEFINITIONS.map((definition) => ({
    ...definition,
    cells: companies.map((company) =>
      buildMetricCell(definition, company, annualFiscalYear, valuationDate),
    ),
    formulaVersion: PERSONAL_MANUAL_PEER_COMPARISON_FORMULA_SET_VERSION,
  }));

  return freezeDeep({
    anchors: { annualFiscalYear, valuationDate },
    companies: companyResults,
    formulaSetVersion: PERSONAL_MANUAL_PEER_COMPARISON_FORMULA_SET_VERSION,
    limitations: PERSONAL_MANUAL_PEER_COMPARISON_LIMITATIONS,
    rows,
    schemaVersion: PERSONAL_MANUAL_PEER_COMPARISON_SCHEMA_VERSION,
    status: "ready",
  });
}

function validateCompanyCarrier(
  value: unknown,
  role: "primary" | "peer",
): Readonly<{
  annualFinancials: unknown;
  role: "primary" | "peer";
  selection: PersonalManualPeerComparisonSelection;
  valuationHistory: unknown;
}> {
  const record = exactRecord(value, COMPANY_KEYS);
  if (
    record.annualFinancials === undefined ||
    record.valuationHistory === undefined
  ) {
    throw new TypeError();
  }
  return {
    annualFinancials: record.annualFinancials,
    role,
    selection: validateSelection(record.selection),
    valuationHistory: record.valuationHistory,
  };
}

function validateSelection(
  value: unknown,
): PersonalManualPeerComparisonSelection {
  const record = exactRecord(value, SELECTION_KEYS);
  if (
    record.country !== "US" ||
    !isMic(record.exchangeMic) ||
    !isIdentifier(record.issuerId) ||
    !isDisplayText(record.issuerName, 256) ||
    !isIdentifier(record.listingId) ||
    !isDisplayText(record.securityName, 256) ||
    !isSymbol(record.symbol)
  ) {
    throw new TypeError();
  }
  return {
    country: "US",
    exchangeMic: record.exchangeMic,
    issuerId: record.issuerId,
    issuerName: record.issuerName,
    listingId: record.listingId,
    securityName: record.securityName,
    symbol: record.symbol,
  };
}

function validateAnnualSource(
  value: unknown,
  selection: PersonalManualPeerComparisonSelection,
): ValidatedSource<ValidatedAnnual> {
  if (value === null) return { status: "not_loaded" };
  try {
    return { data: parseAnnual(value, selection), status: "ready" };
  } catch (error) {
    return {
      issues: [
        {
          reason:
            error instanceof SourceValidationError
              ? error.reason
              : "invalid_shape",
        },
      ],
      status: "quarantined",
    };
  }
}

function validateValuationSource(
  value: unknown,
  selection: PersonalManualPeerComparisonSelection,
): ValidatedSource<ValidatedValuation> {
  if (value === null) return { status: "not_loaded" };
  try {
    return { data: parseValuation(value, selection), status: "ready" };
  } catch (error) {
    return {
      issues: [
        {
          reason:
            error instanceof SourceValidationError
              ? error.reason
              : "invalid_shape",
        },
      ],
      status: "quarantined",
    };
  }
}

function parseAnnual(
  value: unknown,
  selection: PersonalManualPeerComparisonSelection,
): ValidatedAnnual {
  const record = sourceRecord(value, ANNUAL_KEYS, "invalid_shape");
  if (!isInstant(record.asOf)) sourceFailure("invalid_as_of");
  if (
    record.profile !== "personal_single_user_local_fundamentals" ||
    record.schemaVersion !== "1.1.0" ||
    record.status !== "available"
  ) {
    sourceFailure("invalid_shape");
  }
  validateAnnualProvider(record.provider);
  validateResponseIdentity(record.security, selection);
  const rawYears = sourceDenseArray(record.years, 10, "invalid_periods");
  if (rawYears.length < 1) sourceFailure("invalid_periods");
  const asOfDate = record.asOf.slice(0, 10);
  let previousYear = Number.POSITIVE_INFINITY;
  let known = 0;
  let unknown = 0;
  const years: AnnualPeriod[] = [];
  for (const rawYear of rawYears) {
    const year = sourceRecord(rawYear, ANNUAL_PERIOD_KEYS, "invalid_periods");
    if (!isFiscalYear(year.fiscalYear) || year.fiscalYear >= previousYear) {
      sourceFailure("invalid_periods");
    }
    if (!isDate(year.statementDate)) sourceFailure("invalid_periods");
    if (year.statementDate > asOfDate)
      sourceFailure("statement_date_after_as_of");
    const reportedRecord = sourceRecord(
      year.reported,
      ANNUAL_FIELD_KEYS,
      "invalid_periods",
    );
    const reported = {} as Record<AnnualFieldKey, AnnualCell>;
    for (const fieldKey of ANNUAL_FIELD_KEYS) {
      const cell = parseAnnualCell(reportedRecord[fieldKey]);
      reported[fieldKey] = cell;
      if (cell.status === "known") known += 1;
      else unknown += 1;
    }
    years.push({
      fiscalYear: year.fiscalYear,
      reported,
      statementDate: year.statementDate,
    });
    previousYear = year.fiscalYear;
  }
  validateAnnualCoverage(record.coverage, years, known, unknown);
  return { asOf: record.asOf, years };
}

function validateAnnualProvider(value: unknown): void {
  const provider = sourceRecord(
    value,
    ANNUAL_PROVIDER_KEYS,
    "invalid_provider",
  );
  if (
    provider.attribution !== "Tiingo" ||
    provider.export !== "prohibited" ||
    provider.id !== "tiingo" ||
    provider.name !== "Tiingo" ||
    provider.persistence !== "none" ||
    provider.redistribution !== "prohibited" ||
    provider.retention !== "active_owner_session_memory_only" ||
    provider.revisionBasis !== "provider_most_recent" ||
    provider.statementFeed !== "tiingo_fundamentals_statements" ||
    provider.valueCurrency !== "USD"
  ) {
    sourceFailure("invalid_provider");
  }
}

function validateAnnualCoverage(
  value: unknown,
  years: readonly AnnualPeriod[],
  known: number,
  unknown: number,
): void {
  const coverage = sourceRecord(
    value,
    ANNUAL_COVERAGE_KEYS,
    "invalid_coverage",
  );
  const latest = years[0]?.fiscalYear;
  const earliest = years.at(-1)?.fiscalYear;
  if (latest === undefined || earliest === undefined)
    sourceFailure("invalid_coverage");
  const missing = sourceDenseArray(
    coverage.missingFiscalYears,
    9,
    "invalid_coverage",
  );
  if (
    !missing.every(isFiscalYear) ||
    new Set(missing).size !== missing.length
  ) {
    sourceFailure("invalid_coverage");
  }
  if (years.some(({ fiscalYear }) => fiscalYear < latest - 9)) {
    sourceFailure("invalid_coverage");
  }
  const present = new Set(years.map(({ fiscalYear }) => fiscalYear));
  const expectedMissing = Array.from(
    { length: 10 },
    (_, offset) => latest - offset,
  ).filter((fiscalYear) => !present.has(fiscalYear));
  if (
    coverage.earliestFiscalYear !== earliest ||
    coverage.knownReportedCells !== known ||
    coverage.latestFiscalYear !== latest ||
    !samePrimitiveArray(missing, expectedMissing) ||
    coverage.requestedAnnualYears !== 10 ||
    coverage.returnedAnnualYears !== years.length ||
    coverage.status !==
      (expectedMissing.length === 0 && unknown === 0
        ? "complete"
        : "partial") ||
    coverage.unknownReportedCells !== unknown
  ) {
    sourceFailure("invalid_coverage");
  }
}

function parseAnnualCell(value: unknown): AnnualCell {
  if (hasSourceExactKeys(value, KNOWN_ANNUAL_CELL_KEYS)) {
    if (value.status !== "known" || !isCanonicalDecimal(value.value)) {
      sourceFailure("invalid_periods");
    }
    return { status: "known", value: value.value };
  }
  const cell = sourceRecord(value, UNKNOWN_ANNUAL_CELL_KEYS, "invalid_periods");
  if (
    cell.reason !== "not_supplied_by_provider" ||
    cell.status !== "unknown" ||
    cell.value !== null
  ) {
    sourceFailure("invalid_periods");
  }
  return { status: "unknown", value: null };
}

function parseValuation(
  value: unknown,
  selection: PersonalManualPeerComparisonSelection,
): ValidatedValuation {
  const record = sourceRecord(value, VALUATION_KEYS, "invalid_shape");
  if (!isInstant(record.asOf)) sourceFailure("invalid_as_of");
  if (
    record.profile !== "personal_single_user_local_valuation" ||
    record.schemaVersion !== "1.0.0" ||
    record.status !== "available"
  ) {
    sourceFailure("invalid_shape");
  }
  validateValuationProvider(record.provider);
  validateResponseIdentity(record.security, selection);
  const history = sourceRecord(
    record.history,
    VALUATION_HISTORY_KEYS,
    "invalid_history",
  );
  const range = history.range;
  if (
    typeof range !== "string" ||
    !isDate(history.startDate) ||
    !isDate(history.endDate) ||
    history.startDate > history.endDate ||
    !MARKET_RANGES.has(range)
  ) {
    sourceFailure("invalid_history");
  }
  const expected = valuationRangeDates(range, record.asOf);
  if (
    history.startDate !== expected.startDate ||
    history.endDate !== expected.endDate
  ) {
    sourceFailure("invalid_history");
  }
  const rawPoints = sourceDenseArray(history.points, 4_096, "invalid_history");
  if (rawPoints.length < 1) sourceFailure("invalid_history");
  const points: ValuationPoint[] = [];
  let previousDate = "";
  let known = 0;
  for (const rawPoint of rawPoints) {
    const point = parseValuationPoint(rawPoint);
    if (
      point.date <= previousDate ||
      point.date < history.startDate ||
      point.date > history.endDate
    ) {
      sourceFailure("invalid_history");
    }
    for (const fieldKey of VALUATION_FIELD_KEYS) {
      if (point[fieldKey].status === "known") known += 1;
    }
    points.push(point);
    previousDate = point.date;
  }
  const latestPoint = parseValuationPoint(history.latestPoint);
  const latest = points.at(-1);
  if (latest === undefined || !sameValuationPoint(latestPoint, latest)) {
    sourceFailure("invalid_history");
  }
  validateValuationCoverage(record.coverage, points.length, known);
  return {
    asOf: record.asOf,
    latestPoint,
    points,
    range,
  };
}

function validateValuationProvider(value: unknown): void {
  const provider = sourceRecord(
    value,
    VALUATION_PROVIDER_KEYS,
    "invalid_provider",
  );
  if (
    provider.attribution !== "Tiingo" ||
    provider.export !== "prohibited" ||
    provider.id !== "tiingo" ||
    provider.name !== "Tiingo" ||
    provider.persistence !== "none" ||
    provider.redistribution !== "prohibited" ||
    provider.retention !== "active_owner_session_memory_only" ||
    provider.revisionBasis !== "provider_most_recent" ||
    provider.valuationFeed !== "tiingo_fundamentals_daily" ||
    provider.valueCurrency !== "USD"
  ) {
    sourceFailure("invalid_provider");
  }
}

function validateValuationCoverage(
  value: unknown,
  observationCount: number,
  knownCells: number,
): void {
  const coverage = sourceRecord(
    value,
    VALUATION_COVERAGE_KEYS,
    "invalid_coverage",
  );
  const unknownCells =
    observationCount * VALUATION_FIELD_KEYS.length - knownCells;
  if (
    coverage.knownCells !== knownCells ||
    coverage.observationCount !== observationCount ||
    coverage.status !== (unknownCells === 0 ? "complete" : "partial") ||
    coverage.unknownCells !== unknownCells
  ) {
    sourceFailure("invalid_coverage");
  }
}

function parseValuationPoint(value: unknown): ValuationPoint {
  const point = sourceRecord(value, VALUATION_POINT_KEYS, "invalid_history");
  if (!isDate(point.date)) sourceFailure("invalid_history");
  return {
    date: point.date,
    enterpriseValue: parseValuationCell(point.enterpriseValue, "USD"),
    marketCapitalization: parseValuationCell(point.marketCapitalization, "USD"),
    priceToBook: parseValuationCell(point.priceToBook, "ratio"),
    priceToEarnings: parseValuationCell(point.priceToEarnings, "ratio"),
    trailingPeg1Y: parseValuationCell(point.trailingPeg1Y, "ratio"),
  };
}

function parseValuationCell(
  value: unknown,
  unit: "USD" | "ratio",
): ValuationCell {
  if (hasSourceExactKeys(value, KNOWN_VALUATION_CELL_KEYS)) {
    if (
      value.status !== "known" ||
      value.unit !== unit ||
      !isCanonicalDecimal(value.value)
    ) {
      sourceFailure("invalid_history");
    }
    return { status: "known", unit, value: value.value };
  }
  const cell = sourceRecord(
    value,
    UNKNOWN_VALUATION_CELL_KEYS,
    "invalid_history",
  );
  if (
    cell.reason !== "not_supplied_by_provider" ||
    cell.status !== "unknown" ||
    cell.unit !== unit ||
    cell.value !== null
  ) {
    sourceFailure("invalid_history");
  }
  return { status: "unknown", unit, value: null };
}

function validateResponseIdentity(
  value: unknown,
  selection: PersonalManualPeerComparisonSelection,
): void {
  const identity = sourceRecord(value, SECURITY_KEYS, "identity_mismatch");
  if (
    identity.country !== selection.country ||
    identity.exchangeMic !== selection.exchangeMic ||
    identity.issuerName !== selection.issuerName ||
    identity.listingId !== selection.listingId ||
    identity.securityName !== selection.securityName ||
    identity.symbol !== selection.symbol
  ) {
    sourceFailure("identity_mismatch");
  }
}

function buildCompanyResult(
  company: ValidatedCompany,
  annualFiscalYear: number | null,
  valuationDate: string | null,
): PersonalManualPeerComparisonCompany {
  return {
    annual: buildSourceState(company.annual, annualFiscalYear),
    role: company.role,
    selection: company.selection,
    valuation: buildSourceState(company.valuation, valuationDate),
  };
}

function buildSourceState(
  source:
    ValidatedSource<ValidatedAnnual> | ValidatedSource<ValidatedValuation>,
  anchor: number | string | null,
): PersonalManualPeerComparisonSourceState {
  if (source.status !== "ready") return source;
  if ("years" in source.data) {
    const period =
      typeof anchor === "number"
        ? source.data.years.find(({ fiscalYear }) => fiscalYear === anchor)
        : undefined;
    return {
      asOf: source.data.asOf,
      coordinate:
        period === undefined
          ? null
          : {
              asOf: source.data.asOf,
              fiscalYear: period.fiscalYear,
              kind: "annual",
              statementDate: period.statementDate,
            },
      status: "ready",
    };
  }
  const point =
    typeof anchor === "string"
      ? source.data.points.find(({ date }) => date === anchor)
      : undefined;
  return {
    asOf: source.data.asOf,
    coordinate:
      point === undefined
        ? null
        : { asOf: source.data.asOf, date: point.date, kind: "valuation" },
    status: "ready",
  };
}

function buildMetricCell(
  definition: MetricDefinition,
  company: ValidatedCompany,
  annualFiscalYear: number | null,
  valuationDate: string | null,
): PersonalManualPeerComparisonCell {
  return definition.domain === "annual"
    ? buildAnnualMetricCell(definition, company, annualFiscalYear)
    : buildValuationMetricCell(definition, company, valuationDate);
}

function buildAnnualMetricCell(
  definition: MetricDefinition,
  company: ValidatedCompany,
  fiscalYear: number | null,
): PersonalManualPeerComparisonCell {
  const listingId = company.selection.listingId;
  if (company.annual.status === "not_loaded") {
    return unavailable(listingId, "source_not_loaded");
  }
  if (company.annual.status === "quarantined") {
    return unavailable(listingId, "source_quarantined");
  }
  if (fiscalYear === null) {
    return unavailable(listingId, "primary_anchor_unavailable");
  }
  const period = company.annual.data.years.find(
    (candidate) => candidate.fiscalYear === fiscalYear,
  );
  if (period === undefined) {
    return unavailable(listingId, "exact_fiscal_year_not_found");
  }
  const coordinate: PersonalManualPeerComparisonAnnualCoordinate = {
    asOf: company.annual.data.asOf,
    fiscalYear,
    kind: "annual",
    statementDate: period.statementDate,
  };
  const metricId = definition.metricId;
  if (metricId === "revenue") {
    return rawAnnualCell(
      company,
      period,
      coordinate,
      "revenue",
      definition.unit,
    );
  }
  if (metricId === "revenue_growth") {
    const prior = company.annual.data.years.find(
      (candidate) => candidate.fiscalYear === fiscalYear - 1,
    );
    if (prior === undefined) {
      return unavailable(
        listingId,
        "exact_prior_fiscal_year_not_found",
        coordinate,
        [annualReference(company, period, "revenue")],
      );
    }
    const currentRef = annualReference(company, period, "revenue");
    const priorRef = annualReference(company, prior, "revenue");
    if (currentRef.status === "unknown" || priorRef.status === "unknown") {
      return unavailable(listingId, "missing_input", coordinate, [
        currentRef,
        priorRef,
      ]);
    }
    const denominator = new CalculationDecimal(priorRef.value);
    if (!denominator.greaterThan(0)) {
      return unavailable(listingId, "nonpositive_denominator", coordinate, [
        currentRef,
        priorRef,
      ]);
    }
    return available(
      listingId,
      coordinate,
      [currentRef, priorRef],
      new CalculationDecimal(currentRef.value)
        .div(denominator)
        .minus(1)
        .times(100),
      definition.unit,
    );
  }

  const operands = annualOperandsForMetric(metricId);
  const refs = operands.map((fieldKey) =>
    annualReference(company, period, fieldKey),
  );
  if (refs.some((reference) => reference.status === "unknown")) {
    return unavailable(listingId, "missing_input", coordinate, refs);
  }
  const values = refs.map(
    (reference) =>
      new CalculationDecimal(
        reference.status === "known" ? reference.value : 0,
      ),
  );
  if (metricId === "net_debt") {
    return available(
      listingId,
      coordinate,
      refs,
      values[0]!.minus(values[1]!),
      definition.unit,
    );
  }
  const denominator = values[1]!;
  if (!denominator.greaterThan(0)) {
    return unavailable(listingId, "nonpositive_denominator", coordinate, refs);
  }
  const multiplier =
    metricId === "debt_to_assets" ||
    metricId === "gross_margin" ||
    metricId === "operating_margin" ||
    metricId === "net_margin" ||
    metricId === "free_cash_flow_margin"
      ? 100
      : 1;
  return available(
    listingId,
    coordinate,
    refs,
    values[0]!.div(denominator).times(multiplier),
    definition.unit,
  );
}

function annualOperandsForMetric(
  metricId: PersonalManualPeerComparisonMetricId,
): readonly AnnualFieldKey[] {
  switch (metricId) {
    case "gross_margin":
      return ["gross_profit", "revenue"];
    case "operating_margin":
      return ["operating_income", "revenue"];
    case "net_margin":
      return ["net_income", "revenue"];
    case "free_cash_flow_margin":
      return ["free_cash_flow", "revenue"];
    case "net_debt":
      return ["debt", "cash"];
    case "debt_to_assets":
      return ["debt", "assets"];
    case "current_ratio":
      return ["current_assets", "current_liabilities"];
    case "revenue_to_ending_assets":
      return ["revenue", "assets"];
    default:
      throw new TypeError();
  }
}

function rawAnnualCell(
  company: ValidatedCompany,
  period: AnnualPeriod,
  coordinate: PersonalManualPeerComparisonAnnualCoordinate,
  fieldKey: AnnualFieldKey,
  unit: PersonalManualPeerComparisonUnit,
): PersonalManualPeerComparisonCell {
  const reference = annualReference(company, period, fieldKey);
  if (reference.status === "unknown") {
    return unavailable(
      company.selection.listingId,
      "missing_input",
      coordinate,
      [reference],
    );
  }
  return available(
    company.selection.listingId,
    coordinate,
    [reference],
    new CalculationDecimal(reference.value),
    unit,
  );
}

function buildValuationMetricCell(
  definition: MetricDefinition,
  company: ValidatedCompany,
  date: string | null,
): PersonalManualPeerComparisonCell {
  const listingId = company.selection.listingId;
  if (company.valuation.status === "not_loaded") {
    return unavailable(listingId, "source_not_loaded");
  }
  if (company.valuation.status === "quarantined") {
    return unavailable(listingId, "source_quarantined");
  }
  if (date === null)
    return unavailable(listingId, "primary_anchor_unavailable");
  const point = company.valuation.data.points.find(
    (candidate) => candidate.date === date,
  );
  if (point === undefined) {
    return unavailable(listingId, "exact_valuation_date_not_found");
  }
  const coordinate: PersonalManualPeerComparisonValuationCoordinate = {
    asOf: company.valuation.data.asOf,
    date,
    kind: "valuation",
  };
  const fieldKey = valuationFieldForMetric(definition.metricId);
  const reference = valuationReference(company, point, fieldKey);
  if (reference.status === "unknown") {
    return unavailable(listingId, "missing_input", coordinate, [reference]);
  }
  return available(
    listingId,
    coordinate,
    [reference],
    new CalculationDecimal(reference.value),
    definition.unit,
  );
}

function valuationFieldForMetric(
  metricId: PersonalManualPeerComparisonMetricId,
): ValuationFieldKey {
  switch (metricId) {
    case "market_capitalization":
      return "marketCapitalization";
    case "enterprise_value":
      return "enterpriseValue";
    case "price_to_earnings":
      return "priceToEarnings";
    case "price_to_book":
      return "priceToBook";
    case "trailing_peg_1y":
      return "trailingPeg1Y";
    default:
      throw new TypeError();
  }
}

function annualReference(
  company: ValidatedCompany,
  period: AnnualPeriod,
  fieldKey: AnnualFieldKey,
): PersonalManualPeerComparisonInputReference {
  const cell = period.reported[fieldKey];
  return cell.status === "known"
    ? {
        domain: "annual",
        fieldKey,
        fiscalYear: period.fiscalYear,
        listingId: company.selection.listingId,
        statementDate: period.statementDate,
        status: "known",
        unit: "USD",
        value: cell.value,
      }
    : {
        domain: "annual",
        fieldKey,
        fiscalYear: period.fiscalYear,
        listingId: company.selection.listingId,
        statementDate: period.statementDate,
        status: "unknown",
        unit: "USD",
        value: null,
      };
}

function valuationReference(
  company: ValidatedCompany,
  point: ValuationPoint,
  fieldKey: ValuationFieldKey,
): PersonalManualPeerComparisonInputReference {
  const cell = point[fieldKey];
  return cell.status === "known"
    ? {
        date: point.date,
        domain: "valuation",
        fieldKey,
        listingId: company.selection.listingId,
        status: "known",
        unit: cell.unit,
        value: cell.value,
      }
    : {
        date: point.date,
        domain: "valuation",
        fieldKey,
        listingId: company.selection.listingId,
        status: "unknown",
        unit: cell.unit,
        value: null,
      };
}

function available(
  listingId: string,
  coordinate: PersonalManualPeerComparisonCoordinate,
  inputRefs: readonly PersonalManualPeerComparisonInputReference[],
  value: Decimal,
  unit: PersonalManualPeerComparisonUnit,
): PersonalManualPeerComparisonAvailableCell {
  const places =
    unit === "USD"
      ? PERSONAL_MANUAL_PEER_COMPARISON_ROUNDING.moneyDecimalPlaces
      : unit === "percent"
        ? PERSONAL_MANUAL_PEER_COMPARISON_ROUNDING.percentDecimalPlaces
        : PERSONAL_MANUAL_PEER_COMPARISON_ROUNDING.ratioDecimalPlaces;
  return {
    coordinate,
    inputRefs,
    listingId,
    status: "available",
    value: normalizeNegativeZero(value.toFixed(places)),
  };
}

function unavailable(
  listingId: string,
  reason: PersonalManualPeerComparisonUnavailableReason,
  coordinate: PersonalManualPeerComparisonCoordinate | null = null,
  inputRefs: readonly PersonalManualPeerComparisonInputReference[] = [],
): PersonalManualPeerComparisonUnavailableCell {
  return { coordinate, inputRefs, listingId, reason, status: "unavailable" };
}

function sameValuationPoint(
  left: ValuationPoint,
  right: ValuationPoint,
): boolean {
  return (
    left.date === right.date &&
    VALUATION_FIELD_KEYS.every((key) =>
      sameValuationCell(left[key], right[key]),
    )
  );
}

function sameValuationCell(left: ValuationCell, right: ValuationCell): boolean {
  return (
    left.status === right.status &&
    left.unit === right.unit &&
    left.value === right.value
  );
}

function valuationRangeDates(
  range: string,
  asOf: string,
): Readonly<{ endDate: string; startDate: string }> {
  const instant = new Date(asOf);
  const endDate = instant.toISOString().slice(0, 10);
  let start: Date;
  switch (range) {
    case "1m":
      start = subtractCalendar(instant, 0, 1);
      break;
    case "3m":
      start = subtractCalendar(instant, 0, 3);
      break;
    case "ytd":
      start = new Date(Date.UTC(instant.getUTCFullYear(), 0, 1));
      break;
    case "1y":
      start = subtractCalendar(instant, 1, 0);
      break;
    case "5y":
      start = subtractCalendar(instant, 5, 0);
      break;
    case "10y":
      start = subtractCalendar(instant, 10, 0);
      break;
    default:
      sourceFailure("invalid_history");
  }
  return { endDate, startDate: start.toISOString().slice(0, 10) };
}

function subtractCalendar(date: Date, years: number, months: number): Date {
  const targetMonthOrdinal = date.getUTCMonth() - months;
  const targetYear =
    date.getUTCFullYear() - years + Math.floor(targetMonthOrdinal / 12);
  const targetMonth = ((targetMonthOrdinal % 12) + 12) % 12;
  const targetDay = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate(),
  );
  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

function exactRecord<K extends readonly string[]>(
  value: unknown,
  keys: K,
): { readonly [P in K[number]]: unknown } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError();
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actualKeys = Reflect.ownKeys(descriptors);
  if (
    actualKeys.length !== keys.length ||
    keys.some((key) => {
      const descriptor = descriptors[key];
      return (
        descriptor === undefined ||
        !("value" in descriptor) ||
        !descriptor.enumerable
      );
    }) ||
    actualKeys.some((key) => typeof key !== "string" || !keys.includes(key))
  ) {
    throw new TypeError();
  }
  const copy: Record<string, unknown> = {};
  for (const key of keys) copy[key] = descriptors[key]!.value;
  return copy as { readonly [P in K[number]]: unknown };
}

function sourceRecord<K extends readonly string[]>(
  value: unknown,
  keys: K,
  reason: PersonalManualPeerComparisonSourceIssueReason,
): { readonly [P in K[number]]: unknown } {
  try {
    return exactRecord(value, keys);
  } catch {
    sourceFailure(reason);
  }
}

function hasSourceExactKeys<K extends readonly string[]>(
  value: unknown,
  keys: K,
): value is { readonly [P in K[number]]: unknown } {
  try {
    exactRecord(value, keys);
    return true;
  } catch {
    return false;
  }
}

function exactDenseArray(
  value: unknown,
  maximumLength: number,
): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    throw new TypeError();
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.value > maximumLength
  ) {
    throw new TypeError();
  }
  const copy: unknown[] = [];
  const allowed = new Set(["length"]);
  for (let index = 0; index < lengthDescriptor.value; index += 1) {
    const key = String(index);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable
    ) {
      throw new TypeError();
    }
    allowed.add(key);
    copy.push(descriptor.value);
  }
  if (
    Reflect.ownKeys(value).some(
      (key) => typeof key !== "string" || !allowed.has(key),
    )
  ) {
    throw new TypeError();
  }
  return copy;
}

function sourceDenseArray(
  value: unknown,
  maximumLength: number,
  reason: PersonalManualPeerComparisonSourceIssueReason,
): readonly unknown[] {
  try {
    return exactDenseArray(value, maximumLength);
  } catch {
    sourceFailure(reason);
  }
}

function sourceFailure(
  reason: PersonalManualPeerComparisonSourceIssueReason,
): never {
  throw new SourceValidationError(reason);
}

function isCanonicalDecimal(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAXIMUM_DECIMAL_LENGTH ||
    !DECIMAL_PATTERN.test(value)
  ) {
    return false;
  }
  try {
    return new CalculationDecimal(value).isFinite();
  } catch {
    return false;
  }
}

function isInstant(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 24) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isFiscalYear(value: unknown): value is number {
  return (
    Number.isInteger(value) && Number(value) >= 1900 && Number(value) <= 9999
  );
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

function isMic(value: unknown): value is string {
  return typeof value === "string" && EXCHANGE_MIC_PATTERN.test(value);
}

function isSymbol(value: unknown): value is string {
  return typeof value === "string" && SYMBOL_PATTERN.test(value);
}

function isDisplayText(
  value: unknown,
  maximumCodePoints: number,
): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    value.length > 0 &&
    value.normalize("NFC") === value &&
    !CONTROL_PATTERN.test(value) &&
    Array.from(value).length <= maximumCodePoints
  );
}

function samePrimitiveArray(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function normalizeNegativeZero(value: string): string {
  return /^-0(?:\.0+)?$/u.test(value) ? value.slice(1) : value;
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
