import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import {
  type PersonalSecAnnualCashHistoryPeriod,
  type PersonalSecAnnualCashHistoryReason,
} from "@research-cockpit/personal-financial-analytics";
import {
  projectManagedAnnualAmountPlot,
  type ManagedAnnualAmountChartInput,
  type ManagedAnnualAmountPlot,
} from "./managed-annual-amount-plot";

export const MANAGED_ANNUAL_CASH_TREND_METRICS = Object.freeze([
  "operatingCashFlow",
  "ppePurchases",
  "operatingCashFlowLessPpePurchases",
] as const);
export type ManagedAnnualCashTrendMetric =
  (typeof MANAGED_ANNUAL_CASH_TREND_METRICS)[number];

export type ManagedAnnualCashTrendProjection =
  | Readonly<{
      status: "unavailable";
      reason: PersonalSecAnnualCashHistoryReason | "insufficient_periods";
      stoppedReason: PersonalSecAnnualCashHistoryReason | null;
    }>
  | Readonly<{
      status: "ready";
      unit: "USD";
      accessionNumber: string;
      completedAt: string;
      contentKey: string;
      /** Original exact amounts and dates, oldest first. */
      periods: readonly PersonalSecAnnualCashHistoryPeriod[];
      plots: Readonly<
        Record<ManagedAnnualCashTrendMetric, ManagedAnnualAmountPlot>
      >;
      stoppedReason: PersonalSecAnnualCashHistoryReason | null;
    }>;

/** Uses only the already admitted same-filing cash history. */
export function projectManagedAnnualCashTrend(
  response: PersonalSecAnnualCanonicalResponseDto,
  view: PersonalSecAnnualCanonicalView,
): ManagedAnnualCashTrendProjection {
  if (view.canonical !== response.evidence)
    return Object.freeze({
      status: "unavailable",
      reason: "invalid_response",
      stoppedReason: null,
    });
  const history = view.cashGeneration.history;
  if (history.status === "unavailable")
    return Object.freeze({
      status: "unavailable",
      reason: history.reason,
      stoppedReason: null,
    });
  if (history.periods.length < 2)
    return Object.freeze({
      status: "unavailable",
      reason: "insufficient_periods",
      stoppedReason: history.stoppedReason,
    });
  const periods = Object.freeze([...history.periods].reverse());
  return Object.freeze({
    status: "ready",
    unit: "USD",
    accessionNumber: history.accessionNumber,
    completedAt: response.evidence.generation.completedAt,
    contentKey: JSON.stringify([
      response.schemaVersion,
      response.catalogSnapshotSha256,
      response.security,
      response.evidence.cik,
      response.evidence.generation,
      history.accessionNumber,
      "USD",
      periods,
      history.stoppedReason,
    ]),
    periods,
    plots: Object.freeze({
      operatingCashFlow: projectManagedAnnualAmountPlot(
        periods.map((period) => period.operatingCashFlow),
      ),
      ppePurchases: projectManagedAnnualAmountPlot(
        periods.map((period) => period.ppePurchases),
      ),
      operatingCashFlowLessPpePurchases: projectManagedAnnualAmountPlot(
        periods.map((period) => period.operatingCashFlowLessPpePurchases),
      ),
    }),
    stoppedReason: history.stoppedReason,
  });
}

const labels: Readonly<Record<ManagedAnnualCashTrendMetric, string>> = {
  operatingCashFlow: "Operating cash flow",
  ppePurchases: "PP&E purchases",
  operatingCashFlowLessPpePurchases: "Operating cash flow less PP&E purchases",
};
export const cashTrendMetricLabel = (metric: ManagedAnnualCashTrendMetric) =>
  labels[metric];

export function cashTrendChartInput(
  projection: Extract<ManagedAnnualCashTrendProjection, { status: "ready" }>,
  metric: ManagedAnnualCashTrendMetric,
): ManagedAnnualAmountChartInput {
  const label = cashTrendMetricLabel(metric);
  return Object.freeze({
    contentKey: JSON.stringify([projection.contentKey, metric]),
    label,
    summary: `${label} in USD across ${projection.periods.length} reported annual periods from one filing, oldest to newest. Negative amounts extend below zero; known zero has zero height. Exact amounts and dates remain in the table below.`,
    unit: "USD",
    periods: Object.freeze(
      projection.periods.map((period) =>
        Object.freeze({
          startDate: period.startDate,
          endDate: period.endDate,
          amount: period[metric],
        }),
      ),
    ),
    plot: projection.plots[metric],
  });
}
