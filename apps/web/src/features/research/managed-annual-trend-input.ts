import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import {
  projectManagedAnnualAmountPlot,
  type ManagedAnnualAmountPlot,
} from "./managed-annual-amount-plot";
import type {
  PersonalSecAnnualCanonicalResponseDto,
  PersonalSecAnnualRevenueConcept,
} from "@research-cockpit/contracts";
import {
  type PersonalSecAnnualHistory,
  type PersonalSecAnnualPeriod,
} from "@research-cockpit/personal-financial-analytics";

export const MANAGED_ANNUAL_TREND_METRICS = Object.freeze([
  "revenue",
  "net_income",
] as const);
export type ManagedAnnualTrendMetric =
  (typeof MANAGED_ANNUAL_TREND_METRICS)[number];

type AvailableHistory = Extract<
  PersonalSecAnnualHistory,
  { status: "available" }
>;

export type ManagedAnnualTrendProjection =
  | Readonly<{
      status: "unavailable";
      reason:
        | "current_report_unavailable"
        | "current_use_unavailable"
        | "insufficient_periods";
      stoppedReason: AvailableHistory["stoppedReason"];
    }>
  | Readonly<{
      status: "ready";
      concept: PersonalSecAnnualRevenueConcept;
      accessionNumber: string;
      unit: "USD";
      completedAt: string;
      contentKey: string;
      /** Oldest first, with the original exact amounts and dates. */
      periods: readonly PersonalSecAnnualPeriod[];
      plots: Readonly<
        Record<ManagedAnnualTrendMetric, ManagedAnnualAmountPlot>
      >;
      stoppedReason: AvailableHistory["stoppedReason"];
    }>;

/** Projects an already validated response; admission remains with the history resolver. */
export function projectManagedAnnualTrend(
  response: PersonalSecAnnualCanonicalResponseDto,
  view: PersonalSecAnnualCanonicalView,
  concept: PersonalSecAnnualRevenueConcept,
): ManagedAnnualTrendProjection {
  if (view.canonical !== response.evidence)
    return Object.freeze({
      status: "unavailable",
      reason: "current_report_unavailable",
      stoppedReason: null,
    });
  const history = view.income.bases.find(
    (basis) => basis.concept === concept,
  )!.history;
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
    concept: history.concept,
    accessionNumber: history.accessionNumber,
    unit: "USD",
    completedAt: response.evidence.generation.completedAt,
    contentKey: contentKey(response, history, periods),
    periods,
    plots: Object.freeze({
      revenue: projectManagedAnnualAmountPlot(
        periods.map((period) => period.revenue),
      ),
      net_income: projectManagedAnnualAmountPlot(
        periods.map((period) => period.netIncome),
      ),
    }),
    stoppedReason: history.stoppedReason,
  });
}

function contentKey(
  response: PersonalSecAnnualCanonicalResponseDto,
  history: AvailableHistory,
  periods: readonly PersonalSecAnnualPeriod[],
): string {
  const { security, evidence } = response;
  return JSON.stringify([
    response.schemaVersion,
    response.catalogSnapshotSha256,
    security.listingId,
    security.issuerId,
    security.symbol,
    security.exchangeMic,
    security.country,
    security.issuerName,
    security.securityName,
    security.cik,
    evidence.cik,
    evidence.generation.sha256,
    evidence.generation.cutoffAt,
    evidence.generation.completedAt,
    history.concept,
    history.accessionNumber,
    "USD",
    periods.map((period) => [
      period.startDate,
      period.endDate,
      period.revenue,
      period.netIncome,
      period.netMarginPercent,
      period.observationIds,
    ]),
    history.stoppedReason,
  ]);
}
