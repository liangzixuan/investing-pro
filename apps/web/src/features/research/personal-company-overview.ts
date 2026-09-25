import type {
  PersonalAnnualFinancialReportedCellDto,
  PersonalAnnualFinancialsDto,
} from "@research-cockpit/contracts";

import type { PersonalMarketSelection } from "./PersonalMarketOverview";
import { buildPersonalAnnualFinancialAnalytics } from "./personal-annual-financial-analytics";
import { projectPersonalAnnualFinancialTrend } from "./personal-annual-financial-trend-input";

export const PERSONAL_COMPANY_OVERVIEW_FIELDS = Object.freeze([
  ["revenue", "Revenue"],
  ["net_income", "Net income"],
  ["operating_cash_flow", "Operating cash flow"],
] as const);

export type PersonalCompanyOverviewField =
  (typeof PERSONAL_COMPANY_OVERVIEW_FIELDS)[number][0];

export type PersonalCompanyOverviewProjection =
  | Readonly<{
      status: "unavailable";
      reason:
        | "not_loaded"
        | "no_selection"
        | "identity_mismatch"
        | "quarantined"
        | "invalid_input";
    }>
  | Readonly<{
      status: "ready";
      fiscalYear: number;
      statementDate: string;
      asOf: string;
      attribution: "Tiingo";
      unit: "USD";
      cells: Readonly<
        Record<
          PersonalCompanyOverviewField,
          PersonalAnnualFinancialReportedCellDto
        >
      >;
      knownFieldCount: number;
      fieldCount: 3;
      returnedAnnualYears: number;
      requestedAnnualYears: 10;
      missingFiscalYears: readonly number[];
    }>;

export function projectPersonalCompanyOverview({
  selection,
  financials,
}: Readonly<{
  selection: PersonalMarketSelection | null;
  financials: PersonalAnnualFinancialsDto | null;
}>): PersonalCompanyOverviewProjection {
  if (selection === null)
    return Object.freeze({ status: "unavailable", reason: "no_selection" });
  if (financials === null)
    return Object.freeze({ status: "unavailable", reason: "not_loaded" });
  const analytics = buildPersonalAnnualFinancialAnalytics(financials);
  const annual = projectPersonalAnnualFinancialTrend({
    financials,
    selection,
    analyticsStatus: analytics.status,
  });
  if (annual.status === "unavailable") return annual;
  const latest = annual.slots.at(-1);
  // The existing annual projection requires the actual latest fiscal year.
  // Never substitute an older returned year for a missing latest one.
  if (latest?.status !== "reported")
    return Object.freeze({ status: "unavailable", reason: "invalid_input" });
  const cells = Object.freeze({
    revenue: latest.cells.revenue,
    net_income: latest.cells.net_income,
    operating_cash_flow: latest.cells.operating_cash_flow,
  });
  return Object.freeze({
    status: "ready",
    fiscalYear: latest.fiscalYear,
    statementDate: latest.statementDate,
    asOf: annual.asOf,
    attribution: financials.provider.attribution,
    unit: annual.unit,
    cells,
    knownFieldCount: Object.values(cells).filter(
      (cell) => cell.status === "known",
    ).length,
    fieldCount: 3,
    returnedAnnualYears: financials.coverage.returnedAnnualYears,
    requestedAnnualYears: financials.coverage.requestedAnnualYears,
    missingFiscalYears: Object.freeze([
      ...financials.coverage.missingFiscalYears,
    ]),
  });
}
