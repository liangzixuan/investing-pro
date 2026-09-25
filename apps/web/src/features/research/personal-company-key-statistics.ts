import type { PersonalAnnualFinancialsDto } from "@research-cockpit/contracts";
import type {
  PersonalFinancialAnalyticsGrowthMetric,
  PersonalFinancialAnalyticsPeriodMetric,
} from "@research-cockpit/personal-financial-analytics";

import type { PersonalMarketSelection } from "./PersonalMarketOverview";
import { buildPersonalAnnualFinancialAnalytics } from "./personal-annual-financial-analytics";
import { projectPersonalAnnualFinancialTrend } from "./personal-annual-financial-trend-input";

export const PERSONAL_COMPANY_KEY_STATISTICS_FIELDS = Object.freeze([
  ["operatingMargin", "Operating margin"],
  ["netMargin", "Net margin"],
  ["operatingCashFlowMargin", "Operating cash-flow margin"],
  ["netDebt", "Net debt"],
  ["debtToAssets", "Debt / assets"],
  ["revenueGrowth", "Revenue year-over-year growth"],
] as const);

export type PersonalCompanyKeyStatistic =
  (typeof PERSONAL_COMPANY_KEY_STATISTICS_FIELDS)[number][0];

export type PersonalCompanyKeyStatisticsProjection =
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
      metrics: Readonly<{
        operatingMargin: PersonalFinancialAnalyticsPeriodMetric;
        netMargin: PersonalFinancialAnalyticsPeriodMetric;
        operatingCashFlowMargin: PersonalFinancialAnalyticsPeriodMetric;
        netDebt: PersonalFinancialAnalyticsPeriodMetric;
        debtToAssets: PersonalFinancialAnalyticsPeriodMetric;
        revenueGrowth: PersonalFinancialAnalyticsGrowthMetric;
      }>;
      availableMetricCount: number;
      metricCount: 6;
      returnedAnnualYears: number;
      requestedAnnualYears: 10;
      missingFiscalYears: readonly number[];
    }>;

/** Select existing annual formula results without recalculating or rounding them. */
export function projectPersonalCompanyKeyStatistics({
  selection,
  financials,
}: Readonly<{
  selection: PersonalMarketSelection | null;
  financials: PersonalAnnualFinancialsDto | null;
}>): PersonalCompanyKeyStatisticsProjection {
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
  if (analytics.status !== "ready")
    return Object.freeze({ status: "unavailable", reason: "quarantined" });
  const latest = annual.slots.at(-1);
  const period = analytics.periods[0];
  if (
    latest?.status !== "reported" ||
    period?.fiscalYear !== latest.fiscalYear ||
    period.statementDate !== latest.statementDate ||
    analytics.growth.revenue.toFiscalYear !== latest.fiscalYear
  )
    return Object.freeze({ status: "unavailable", reason: "invalid_input" });
  const metrics = Object.freeze({
    operatingMargin: copyMetric(period.metrics.operatingMargin),
    netMargin: copyMetric(period.metrics.netMargin),
    operatingCashFlowMargin: copyMetric(period.metrics.operatingCashFlowMargin),
    netDebt: copyMetric(period.metrics.netDebt),
    debtToAssets: copyMetric(period.metrics.debtToAssets),
    revenueGrowth: copyMetric(analytics.growth.revenue),
  });
  return Object.freeze({
    status: "ready",
    fiscalYear: latest.fiscalYear,
    statementDate: latest.statementDate,
    asOf: annual.asOf,
    attribution: financials.provider.attribution,
    metrics,
    availableMetricCount: Object.values(metrics).filter(
      (metric) => metric.status === "available",
    ).length,
    metricCount: 6,
    returnedAnnualYears: financials.coverage.returnedAnnualYears,
    requestedAnnualYears: financials.coverage.requestedAnnualYears,
    missingFiscalYears: Object.freeze([
      ...financials.coverage.missingFiscalYears,
    ]),
  });
}

function copyMetric(
  metric: PersonalFinancialAnalyticsPeriodMetric,
): PersonalFinancialAnalyticsPeriodMetric;
function copyMetric(
  metric: PersonalFinancialAnalyticsGrowthMetric,
): PersonalFinancialAnalyticsGrowthMetric;
function copyMetric(
  metric:
    | PersonalFinancialAnalyticsPeriodMetric
    | PersonalFinancialAnalyticsGrowthMetric,
) {
  return Object.freeze({
    ...metric,
    inputRefs: Object.freeze(
      metric.inputRefs.map((reference) => Object.freeze({ ...reference })),
    ),
  });
}
