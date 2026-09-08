import type { PersonalFinancialAnalyticsFactKey } from "./personal-financial-analytics";

export const PERSONAL_FINANCIAL_REPORTED_FIELD_REGISTRY_VERSION =
  "1.0.0" as const;

export type PersonalFinancialStatementId =
  "income_statement" | "balance_sheet" | "cash_flow";

export type PersonalFinancialReportedSourceCode =
  | "revenue"
  | "costRev"
  | "grossProfit"
  | "rnd"
  | "sga"
  | "opex"
  | "opinc"
  | "intexp"
  | "ebt"
  | "taxExp"
  | "netinc"
  | "ebitda"
  | "cashAndEq"
  | "acctRec"
  | "inventory"
  | "assetsCurrent"
  | "ppeq"
  | "intangibles"
  | "totalAssets"
  | "debt"
  | "liabilitiesCurrent"
  | "totalLiabilities"
  | "equity"
  | "ncfo"
  | "capex"
  | "freeCashFlow"
  | "depamor"
  | "sbcomp"
  | "ncfi"
  | "ncff";

export type PersonalFinancialReportedFieldKey =
  | "revenue"
  | "cost_of_revenue"
  | "gross_profit"
  | "research_and_development"
  | "selling_general_and_administrative"
  | "operating_expenses"
  | "operating_income"
  | "interest_expense"
  | "pretax_income"
  | "income_tax_expense"
  | "net_income"
  | "ebitda"
  | "cash"
  | "accounts_receivable"
  | "inventory"
  | "current_assets"
  | "property_plant_equipment_net"
  | "intangibles"
  | "assets"
  | "debt"
  | "current_liabilities"
  | "liabilities"
  | "shareholders_equity"
  | "operating_cash_flow"
  | "capital_expenditures"
  | "free_cash_flow"
  | "depreciation_and_amortization"
  | "share_based_compensation"
  | "investing_cash_flow"
  | "financing_cash_flow";

export type PersonalFinancialReportedAnalyticsInput =
  PersonalFinancialAnalyticsFactKey | null;

export interface PersonalFinancialReportedFieldDefinition {
  readonly analyticsInput: PersonalFinancialReportedAnalyticsInput;
  readonly fieldKey: PersonalFinancialReportedFieldKey;
  readonly label: string;
  readonly sourceCode: PersonalFinancialReportedSourceCode;
  readonly statement: PersonalFinancialStatementId;
  readonly unit: "USD";
}

const registry: readonly PersonalFinancialReportedFieldDefinition[] = [
  field("income_statement", "revenue", "revenue", "Revenue", "USD", "revenue"),
  field("income_statement", "costRev", "cost_of_revenue", "Cost of revenue"),
  field(
    "income_statement",
    "grossProfit",
    "gross_profit",
    "Gross profit",
    "USD",
    "gross_profit",
  ),
  field(
    "income_statement",
    "rnd",
    "research_and_development",
    "Research and development",
  ),
  field(
    "income_statement",
    "sga",
    "selling_general_and_administrative",
    "Selling, general and administrative",
  ),
  field("income_statement", "opex", "operating_expenses", "Operating expenses"),
  field(
    "income_statement",
    "opinc",
    "operating_income",
    "Operating income",
    "USD",
    "operating_income",
  ),
  field("income_statement", "intexp", "interest_expense", "Interest expense"),
  field("income_statement", "ebt", "pretax_income", "Earnings before tax"),
  field(
    "income_statement",
    "taxExp",
    "income_tax_expense",
    "Income tax expense",
  ),
  field(
    "income_statement",
    "netinc",
    "net_income",
    "Net income",
    "USD",
    "net_income",
  ),
  field("income_statement", "ebitda", "ebitda", "EBITDA"),
  field(
    "balance_sheet",
    "cashAndEq",
    "cash",
    "Cash and cash equivalents",
    "USD",
    "cash",
  ),
  field(
    "balance_sheet",
    "acctRec",
    "accounts_receivable",
    "Accounts receivable",
  ),
  field("balance_sheet", "inventory", "inventory", "Inventory"),
  field("balance_sheet", "assetsCurrent", "current_assets", "Current assets"),
  field(
    "balance_sheet",
    "ppeq",
    "property_plant_equipment_net",
    "Property, plant and equipment",
  ),
  field("balance_sheet", "intangibles", "intangibles", "Intangible assets"),
  field(
    "balance_sheet",
    "totalAssets",
    "assets",
    "Total assets",
    "USD",
    "assets",
  ),
  field(
    "balance_sheet",
    "liabilitiesCurrent",
    "current_liabilities",
    "Current liabilities",
  ),
  field("balance_sheet", "debt", "debt", "Debt", "USD", "debt"),
  field(
    "balance_sheet",
    "totalLiabilities",
    "liabilities",
    "Total liabilities",
  ),
  field(
    "balance_sheet",
    "equity",
    "shareholders_equity",
    "Shareholders' equity",
  ),
  field(
    "cash_flow",
    "depamor",
    "depreciation_and_amortization",
    "Depreciation and amortization",
  ),
  field(
    "cash_flow",
    "sbcomp",
    "share_based_compensation",
    "Share-based compensation",
  ),
  field(
    "cash_flow",
    "ncfo",
    "operating_cash_flow",
    "Operating cash flow",
    "USD",
    "operating_cash_flow",
  ),
  field("cash_flow", "capex", "capital_expenditures", "Capital expenditures"),
  field(
    "cash_flow",
    "freeCashFlow",
    "free_cash_flow",
    "Free cash flow",
    "USD",
    "free_cash_flow",
  ),
  field("cash_flow", "ncfi", "investing_cash_flow", "Investing cash flow"),
  field("cash_flow", "ncff", "financing_cash_flow", "Financing cash flow"),
];

export const PERSONAL_FINANCIAL_REPORTED_FIELDS = freezeDeep(registry);

function field(
  statement: PersonalFinancialStatementId,
  sourceCode: PersonalFinancialReportedSourceCode,
  fieldKey: PersonalFinancialReportedFieldKey,
  label: string,
  unit: PersonalFinancialReportedFieldDefinition["unit"] = "USD",
  analyticsInput: PersonalFinancialReportedAnalyticsInput = null,
): PersonalFinancialReportedFieldDefinition {
  return { analyticsInput, fieldKey, label, sourceCode, statement, unit };
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
