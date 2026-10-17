import {
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryResponseDto,
} from "@research-cockpit/contracts";
import {
  calculatePersonalRawCloseAnalytics,
  type PersonalMarketAnalyticsResult,
} from "@research-cockpit/personal-market-analytics";

export const MANAGED_PRICE_STUDY_KEYS = [
  "windowChange",
  "drawdown",
  "volatility",
  "sma20",
  "sma50",
  "sma200",
  "rangePosition",
] as const;
export type ManagedPriceStudyKey = (typeof MANAGED_PRICE_STUDY_KEYS)[number];
export interface ManagedPriceStudyRow {
  readonly key: ManagedPriceStudyKey;
  readonly label: string;
  readonly available: boolean;
  readonly value: string;
  readonly sample: string;
  readonly detail: string;
}
export interface ManagedPriceStudies {
  readonly response: ManagedEodHistoryResponseDto;
  readonly calculation: PersonalMarketAnalyticsResult;
  readonly rows: readonly ManagedPriceStudyRow[];
}
const calculations = new WeakMap<
  ManagedEodHistoryResponseDto,
  { fingerprint: string; value: ManagedPriceStudies }
>();

/** Validate and own the existing packet; this function never requests a source. */
export function ownPriceStudiesResponse(
  response: ManagedEodHistoryResponseDto,
): ManagedEodHistoryResponseDto | null {
  try {
    return parseManagedEodHistoryResponse(response, {
      catalogSnapshotSha256: response.catalogSnapshotSha256,
      listingId: response.security.listingId,
      range: response.range,
    });
  } catch {
    return null;
  }
}

/** Use only admitted raw closes. Request dates are not calculation-through dates. */
export function resolveManagedPriceStudies(
  response: ManagedEodHistoryResponseDto,
): ManagedPriceStudies | null {
  const owned = ownPriceStudiesResponse(response);
  const last = owned?.rows.at(-1);
  if (!owned || !last) return null;
  try {
    const fingerprint = JSON.stringify(owned);
    const previous = calculations.get(response);
    if (previous?.fingerprint === fingerprint) return previous.value;
    const calculation = calculatePersonalRawCloseAnalytics({
      asOfDate: last.date,
      rows: owned.rows,
    });
    const metrics = calculation.metrics;
    const rows: ManagedPriceStudyRow[] = [
      percentRow(
        "windowChange",
        "Loaded-window raw close change",
        metrics.selectedWindowReturn,
      ),
      percentRow(
        "drawdown",
        "Maximum observed drawdown",
        metrics.maximumDrawdown,
      ),
      percentRow(
        "volatility",
        "Annualized volatility · 20 log returns",
        metrics.trailing20SessionAnnualizedVolatility,
      ),
      ...(["sma20", "sma50", "sma200"] as const).map((key) => {
        const metric = metrics.smaTrend[key];
        return Object.freeze({
          key,
          label: `Last close versus ${key.slice(3)}-observation SMA`,
          available: metric.status === "available",
          value:
            metric.status === "available"
              ? `${metric.classification}; distance ${metric.distancePercent}%`
              : `Unavailable: needs ${metric.requiredSessions} observed closes`,
          sample: sampleText(metric),
          detail:
            "Arithmetic mean; the sign describes the last close relative to that mean.",
        });
      }),
      percentRow(
        "rangePosition",
        "Trailing observed close-range position",
        metrics.trailing252SessionCloseRangePosition,
      ),
    ];
    const value = Object.freeze({
      response: owned,
      calculation,
      rows: Object.freeze(rows),
    });
    calculations.set(response, { fingerprint, value });
    return value;
  } catch {
    return null;
  }
}

type Metrics = PersonalMarketAnalyticsResult["metrics"];
type PercentMetric =
  | Metrics["selectedWindowReturn"]
  | Metrics["maximumDrawdown"]
  | Metrics["trailing20SessionAnnualizedVolatility"]
  | Metrics["trailing252SessionCloseRangePosition"];

function percentRow(
  key: ManagedPriceStudyKey,
  label: string,
  metric: PercentMetric,
): ManagedPriceStudyRow {
  let detail = "Raw price change excludes dividends and split adjustments.";
  if (key === "drawdown")
    detail =
      metric.status === "available" && "peakDate" in metric
        ? `Nonnegative decline magnitude; peak ${metric.peakDate}, trough ${metric.troughDate}.`
        : "Largest observed decline from an earlier running peak; not a forecast.";
  if (key === "volatility")
    detail =
      "Sample standard deviation of 20 log returns, annualized with the 252-observation convention; not forecast risk.";
  if (key === "rangePosition")
    detail =
      "Requires 200 observed closes and uses at most 252; this is not a verified calendar-year high/low.";
  return Object.freeze({
    key,
    label,
    available: metric.status === "available",
    value:
      metric.status === "available"
        ? `${metric.valuePercent}%`
        : metric.status === "zero_range"
          ? "Unavailable: all sampled closes are equal"
          : `Unavailable: needs ${metric.requiredSessions} observed closes`,
    sample: sampleText(metric),
    detail,
  });
}
function sampleText(metric: {
  readonly observedSessions: number;
  readonly sampleFirstDate: string | null;
  readonly sampleLastDate: string | null;
}) {
  return `${metric.observedSessions} observed closes; ${metric.sampleFirstDate ?? "no first date"} through ${metric.sampleLastDate ?? "no last date"}`;
}
