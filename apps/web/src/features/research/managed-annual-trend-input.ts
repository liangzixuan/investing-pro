import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualRevenueConcept,
} from "@research-cockpit/contracts";
import {
  resolvePersonalSecAnnualHistory,
  type PersonalSecAnnualHistory,
  type PersonalSecAnnualPeriod,
} from "@research-cockpit/personal-financial-analytics";

export const MANAGED_ANNUAL_TREND_METRICS = Object.freeze([
  "revenue",
  "net_income",
] as const);
export type ManagedAnnualTrendMetric =
  (typeof MANAGED_ANNUAL_TREND_METRICS)[number];

export type ManagedAnnualTrendPlot =
  | Readonly<{ status: "ready"; values: readonly number[] }>
  | Readonly<{ status: "unavailable"; reason: "unsafe_plot_value" }>;

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
      plots: Readonly<Record<ManagedAnnualTrendMetric, ManagedAnnualTrendPlot>>;
      stoppedReason: AvailableHistory["stoppedReason"];
    }>;

/** Projects an already validated response; admission remains with the history resolver. */
export function projectManagedAnnualTrend(
  response: PersonalSecAnnualEvidenceResponseDto,
  concept: PersonalSecAnnualRevenueConcept,
): ManagedAnnualTrendProjection {
  const history = resolvePersonalSecAnnualHistory(response.evidence, concept);
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
      revenue: projectPlot(periods.map((period) => period.revenue)),
      net_income: projectPlot(periods.map((period) => period.netIncome)),
    }),
    stoppedReason: history.stoppedReason,
  });
}

function contentKey(
  response: PersonalSecAnnualEvidenceResponseDto,
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

function projectPlot(amounts: readonly string[]): ManagedAnnualTrendPlot {
  const values: number[] = [];
  for (const amount of amounts) {
    const value = Number(amount);
    if (
      !withinPlotMagnitude(amount) ||
      !Number.isFinite(value) ||
      (amount !== "0" && value === 0) ||
      value < 0 !== amount.startsWith("-")
    )
      return Object.freeze({
        status: "unavailable",
        reason: "unsafe_plot_value",
      });
    values.push(value);
  }
  return Object.freeze({ status: "ready", values: Object.freeze(values) });
}

// Match the local trend's conservative bound before Number can round away excess.
function withinPlotMagnitude(amount: string): boolean {
  const maximumInteger = "9007199254740991";
  const unsigned = amount.startsWith("-") ? amount.slice(1) : amount;
  const [integer = "", fraction] = unsigned.split(".");
  if (integer.length < maximumInteger.length) return true;
  if (integer.length > maximumInteger.length) return false;
  return (
    integer < maximumInteger ||
    (integer === maximumInteger && fraction === undefined)
  );
}
