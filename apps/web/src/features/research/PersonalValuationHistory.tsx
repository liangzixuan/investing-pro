import type {
  PersonalMarketDataRangeDto,
  PersonalMarketDataStatusDto,
  PersonalValuationHistoryDto,
} from "@research-cockpit/contracts";

import type { PersonalWorkspaceApiErrorCode } from "@/lib/personal-workspace-api";

import type { PersonalMarketSelection } from "./PersonalMarketOverview";
import {
  VALUATION_HISTORY_METRICS,
  ValuationHistoryChart,
  type ValuationHistoryMetric,
} from "./ValuationHistoryChart";

export interface PersonalValuationHistoryProps {
  readonly errorCode: PersonalWorkspaceApiErrorCode | null;
  readonly history: PersonalValuationHistoryDto | null;
  readonly metric: ValuationHistoryMetric;
  readonly onLoad: () => void;
  readonly onMetricChange: (metric: ValuationHistoryMetric) => void;
  readonly providerStatus: PersonalMarketDataStatusDto | null;
  readonly range: PersonalMarketDataRangeDto;
  readonly requestState: "idle" | "loading";
  readonly selection: PersonalMarketSelection | null;
}

const metricOrder = [
  "priceToEarnings",
  "priceToBook",
  "trailingPeg1Y",
  "marketCapitalization",
  "enterpriseValue",
] as const satisfies readonly ValuationHistoryMetric[];

export function PersonalValuationHistory({
  errorCode,
  history,
  metric,
  onLoad,
  onMetricChange,
  providerStatus,
  range,
  requestState,
  selection,
}: PersonalValuationHistoryProps) {
  const configured = providerStatus?.status === "configured";
  const explicitlyUnconfigured = providerStatus?.status === "not_configured";

  return (
    <section
      aria-busy={requestState === "loading"}
      aria-labelledby="personal-valuation-history-title"
      className="personal-financials-panel personal-valuation-panel"
    >
      <div className="discovery-section-heading personal-financials-heading">
        <div>
          <p className="eyebrow">How the market values the company</p>
          <h2 id="personal-valuation-history-title">Daily valuation history</h2>
        </div>
        <span>{rangeLabel(range)} · 5 provider metrics</span>
      </div>

      <p className="market-scope-note">
        Load the current provider&apos;s most-recent daily valuation history for
        the exact admitted listing and selected market range. This is observed
        market data, not a fair-value estimate or a buy/sell signal.
      </p>

      {selection === null ? (
        <div className="discovery-empty-state market-empty-state">
          <strong>Choose a security to inspect its valuation history.</strong>
          <span>
            Use “View market” in search results or My Watchlist, choose a range,
            then make this separate provider request.
          </span>
        </div>
      ) : (
        <>
          {errorCode === null ? null : (
            <div className="market-message market-message-error" role="alert">
              <strong>{valuationErrorTitle(errorCode)}</strong>
              <span>{valuationErrorDetail(errorCode)}</span>
              <small>No value was estimated or substituted.</small>
            </div>
          )}

          <div className="market-load-state valuation-load-state">
            <p aria-live="polite">
              {requestState === "loading"
                ? `Loading ${rangeLabel(range)} valuation history for ${selection.symbol}…`
                : history !== null
                  ? `${rangeLabel(history.history.range)} valuation history loaded for ${selection.symbol}.`
                  : errorCode !== null
                    ? `The valuation-history request for ${selection.symbol} did not complete.`
                    : configured
                      ? `No valuation-history request has been made for ${selection.symbol} in the ${rangeLabel(range)} range.`
                      : explicitlyUnconfigured
                        ? `Configure the owner-local Tiingo credential to load valuation history for ${selection.symbol}.`
                        : `Provider status is unavailable. Revalidate the owner session before loading valuation history for ${selection.symbol}.`}
            </p>
            <button
              className="primary-action compact-action"
              disabled={!configured || requestState === "loading"}
              onClick={onLoad}
              type="button"
            >
              {requestState === "loading"
                ? "Loading valuation history…"
                : history !== null
                  ? "Refresh valuation history"
                  : errorCode === null
                    ? "Load valuation history"
                    : "Retry valuation history"}
            </button>
          </div>

          {history === null ? null : (
            <ValuationHistoryResult
              history={history}
              metric={metric}
              onMetricChange={onMetricChange}
            />
          )}
        </>
      )}
    </section>
  );
}

export function ValuationHistoryResult({
  history,
  metric,
  onMetricChange,
}: {
  readonly history: PersonalValuationHistoryDto;
  readonly metric: ValuationHistoryMetric;
  readonly onMetricChange: (metric: ValuationHistoryMetric) => void;
}) {
  const latest = history.history.latestPoint;
  return (
    <div className="valuation-history-result">
      <div className="financials-coverage-strip valuation-coverage-strip">
        <div>
          <span>Daily observations</span>
          <strong>{formatCount(history.coverage.observationCount)}</strong>
        </div>
        <div>
          <span>Known values</span>
          <strong>
            {formatCount(history.coverage.knownCells)} /{" "}
            {formatCount(
              history.coverage.knownCells + history.coverage.unknownCells,
            )}
          </strong>
        </div>
        <div>
          <span>Requested window</span>
          <strong>
            {formatDate(history.history.startDate)} –{" "}
            {formatDate(history.history.endDate)}
          </strong>
        </div>
        <div>
          <span>Latest observation</span>
          <strong>{formatDate(latest.date)}</strong>
        </div>
      </div>

      <div
        aria-label="Latest valuation metrics"
        className="valuation-card-grid"
      >
        {metricOrder.map((key) => {
          const cell = latest[key];
          const definition = VALUATION_HISTORY_METRICS[key];
          return (
            <article className="valuation-metric-card" key={key}>
              <span>{definition.label}</span>
              <strong
                title={
                  cell.status === "known"
                    ? `${cell.value} ${cell.unit}`
                    : "Not supplied by provider"
                }
              >
                {cell.status === "known"
                  ? formatValuationValue(cell.value, definition.unit)
                  : "Unknown"}
              </strong>
              <small>
                {cell.status === "known"
                  ? `Observed ${formatDate(latest.date)}`
                  : "Not supplied by provider"}
              </small>
            </article>
          );
        })}
      </div>

      <div className="valuation-history-controls">
        <label htmlFor="valuation-history-metric">Chart metric</label>
        <select
          id="valuation-history-metric"
          onChange={(event) =>
            onMetricChange(event.target.value as ValuationHistoryMetric)
          }
          value={metric}
        >
          {metricOrder.map((key) => (
            <option key={key} value={key}>
              {VALUATION_HISTORY_METRICS[key].label}
            </option>
          ))}
        </select>
        <span>
          One metric per chart keeps USD values and unitless ratios on separate
          scales.
        </span>
      </div>

      <ValuationHistoryChart
        metric={metric}
        points={history.history.points}
        symbol={history.security.symbol}
      />

      <div className="valuation-methodology" role="note">
        <strong>What these values mean</strong>
        <span>
          Market capitalization, enterprise value, P/E, P/B, and trailing PEG 1Y
          are provider-reported daily fields. “Provider” labels are deliberate:
          this view does not reinterpret P/E as verified TTM or derive missing
          values from other statements.
        </span>
      </div>
      <p className="market-attribution">
        Data attribution: {history.provider.attribution}. USD applies only to
        market capitalization and enterprise value; ratios are unitless. The
        history is the provider&apos;s most-recent revision and is not a
        point-in-time backtest view. Export and redistribution are prohibited;
        values remain in active-session memory only.
      </p>
    </div>
  );
}

function valuationErrorTitle(code: PersonalWorkspaceApiErrorCode): string {
  switch (code) {
    case "not_entitled":
      return "Valuation history is not included for this account.";
    case "not_covered":
      return "Valuation history is not available for this listing.";
    case "credentials_invalid":
      return "The provider credential was rejected.";
    case "rate_limited":
      return "The provider rate limit was reached.";
    case "not_configured":
      return "The provider is not configured.";
    case "provider_unavailable":
      return "The valuation provider is unavailable.";
    default:
      return "Valuation history could not be loaded.";
  }
}

function valuationErrorDetail(code: PersonalWorkspaceApiErrorCode): string {
  switch (code) {
    case "not_entitled":
      return "The market-price feed can still work. Daily fundamentals require an eligible evaluation symbol or fundamentals entitlement.";
    case "not_covered":
      return "The admitted listing has no daily valuation response in the configured fundamentals feed.";
    case "credentials_invalid":
      return "Replace the owner-local Tiingo credential before retrying.";
    case "rate_limited":
      return "Wait for the provider limit to reset, then retry this range.";
    case "not_configured":
      return "Start the personal workspace with its owner-local provider credential.";
    case "provider_unavailable":
      return "The provider response was unavailable or invalid. Retry later.";
    default:
      return "Revalidate the owner session and try this exact listing and range again.";
  }
}

function rangeLabel(range: PersonalMarketDataRangeDto): string {
  return (
    (
      {
        "1m": "1M",
        "3m": "3M",
        ytd: "YTD",
        "1y": "1Y",
        "5y": "5Y",
        "10y": "10Y",
      } as const
    )[range] ?? range.toUpperCase()
  );
}

function formatValuationValue(value: string, unit: "USD" | "ratio"): string {
  return unit === "USD" ? formatExactUsd(value) : `${value}×`;
}

function formatExactUsd(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${negative ? "−" : ""}$${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
