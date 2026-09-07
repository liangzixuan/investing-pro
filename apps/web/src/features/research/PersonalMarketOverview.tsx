import type {
  PersonalMarketDataRangeDto,
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
} from "@research-cockpit/contracts";

import type { PersonalWorkspaceApiErrorCode } from "@/lib/personal-workspace-api";

import { PersonalMarketAnalytics } from "./PersonalMarketAnalytics";
import {
  PriceHistoryChart,
  type PriceAdjustmentMode,
} from "./PriceHistoryChart";

export interface PersonalMarketSelection {
  readonly exchangeMic: string;
  readonly issuerName: string;
  readonly listingId: string;
  readonly securityName: string;
  readonly symbol: string;
}

export interface PersonalMarketOverviewProps {
  readonly adjustmentMode: PriceAdjustmentMode;
  readonly errorCode: PersonalWorkspaceApiErrorCode | null;
  readonly onAdjustmentModeChange: (mode: PriceAdjustmentMode) => void;
  readonly onClear: () => void;
  readonly onLoad: (range: PersonalMarketDataRangeDto) => void;
  readonly overview: PersonalMarketOverviewDto | null;
  readonly providerStatus: PersonalMarketDataStatusDto | null;
  readonly range: PersonalMarketDataRangeDto;
  readonly requestState: "idle" | "loading";
  readonly selection: PersonalMarketSelection | null;
}

const ranges = [
  ["1m", "1M"],
  ["3m", "3M"],
  ["ytd", "YTD"],
  ["1y", "1Y"],
  ["5y", "5Y"],
  ["10y", "10Y"],
] as const satisfies readonly (readonly [PersonalMarketDataRangeDto, string])[];

export function PersonalMarketOverview({
  adjustmentMode,
  errorCode,
  onAdjustmentModeChange,
  onClear,
  onLoad,
  overview,
  providerStatus,
  range,
  requestState,
  selection,
}: PersonalMarketOverviewProps) {
  const configured = providerStatus?.status === "configured";
  return (
    <section
      aria-busy={requestState === "loading"}
      aria-labelledby="personal-market-title"
      className="personal-market-panel"
      id="personal-market-overview"
      tabIndex={-1}
    >
      <div className="discovery-section-heading personal-market-heading">
        <div>
          <p className="eyebrow">Owner-triggered market data</p>
          <h2 id="personal-market-title">Current quote and price history</h2>
        </div>
        <span
          className={`market-provider-state ${configured ? "configured" : ""}`}
        >
          {providerStatus === null
            ? "Provider status unavailable"
            : providerStatus.status === "configured"
              ? `${providerStatus.provider.name} configured`
              : `${providerStatus.provider.name} not configured`}
        </span>
      </div>

      <p className="market-scope-note">
        Data loads only after you choose a security and request it. Nothing is
        written to browser storage, and synthetic prices are never used as a
        fallback.
      </p>

      {selection === null ? (
        <div className="discovery-empty-state market-empty-state">
          <strong>Choose a security to inspect.</strong>
          <span>
            Use “View market” in search results or My Watchlist. Checking
            provider configuration does not request market data.
          </span>
        </div>
      ) : (
        <>
          <div className="market-security-heading">
            <div className="security-identity">
              <strong>{selection.symbol}</strong>
              <div>
                <b>{selection.issuerName}</b>
                <span>
                  {selection.securityName} · {selection.exchangeMic}
                </span>
              </div>
            </div>
            <button className="text-button" onClick={onClear} type="button">
              Close market view
            </button>
          </div>

          {providerStatus?.status === "not_configured" ? (
            <div className="market-message market-message-warning" role="note">
              <strong>Tiingo is not configured.</strong>
              <span>
                Start the personal workspace with its owner-local Tiingo
                credential before loading quotes or history.
              </span>
            </div>
          ) : providerStatus === null ? (
            <div className="market-message market-message-warning" role="alert">
              <strong>Provider status is unavailable.</strong>
              <span>Revalidate the owner session before trying again.</span>
            </div>
          ) : null}

          {errorCode === null ? null : (
            <div className="market-message market-message-error" role="alert">
              <strong>{marketErrorTitle(errorCode)}</strong>
              <span>{marketErrorDetail(errorCode)}</span>
              <small>No synthetic value was substituted.</small>
            </div>
          )}

          <div className="market-chart-controls">
            <div
              aria-label="Price history range"
              className="market-range-switch"
            >
              {ranges.map(([value, label]) => (
                <button
                  aria-pressed={range === value}
                  disabled={!configured || requestState === "loading"}
                  key={value}
                  onClick={() => onLoad(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            {overview === null ? null : (
              <div
                aria-label="Price adjustment"
                className="market-adjustment-switch"
              >
                {(["adjusted", "raw"] as const).map((mode) => (
                  <button
                    aria-pressed={adjustmentMode === mode}
                    disabled={requestState === "loading"}
                    key={mode}
                    onClick={() => onAdjustmentModeChange(mode)}
                    type="button"
                  >
                    {mode === "adjusted" ? "Adjusted" : "Raw"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {overview === null ? (
            <div className="market-load-state">
              <p aria-live="polite">
                {requestState === "loading"
                  ? `Loading ${rangeLabel(range)} quote and history…`
                  : "No provider request has been made for this selection."}
              </p>
              <button
                className="primary-action compact-action"
                disabled={!configured || requestState === "loading"}
                onClick={() => onLoad(range)}
                type="button"
              >
                {requestState === "loading"
                  ? "Loading market data…"
                  : errorCode === null
                    ? "Load market data"
                    : "Retry market data"}
              </button>
            </div>
          ) : (
            <>
              <QuoteSummary overview={overview} />
              <p className="discovery-status" aria-live="polite">
                {requestState === "loading"
                  ? `Loading ${rangeLabel(range)} history…`
                  : `${rangeLabel(overview.history.range)} history · ${overview.history.startDate} through ${overview.history.endDate}`}
              </p>
              <PriceHistoryChart
                bars={overview.history.bars}
                mode={adjustmentMode}
                symbol={overview.security.symbol}
              />
              <PersonalMarketAnalytics
                asOfDate={
                  overview.history.bars.at(-1)?.date ?? overview.history.endDate
                }
                bars={overview.history.bars}
                mode={adjustmentMode}
              />
              <p className="market-attribution">
                Data attribution: {overview.provider.attribution}. Export and
                redistribution are prohibited; values remain in active-session
                memory only.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

export function QuoteSummary({
  overview,
}: {
  overview: PersonalMarketOverviewDto;
}) {
  const { quote } = overview;
  const direction =
    quote.change === null
      ? "unavailable"
      : Number(quote.change) > 0
        ? "up"
        : Number(quote.change) < 0
          ? "down"
          : "unchanged";
  return (
    <article className="market-quote-card" aria-labelledby="market-quote-title">
      <div>
        <span className="eyebrow" id="market-quote-title">
          {quote.kind === "derived_realtime_reference"
            ? "Derived real-time reference"
            : "End-of-day close"}
        </span>
        <strong title={`${quote.price} ${quote.currency}`}>
          {formatUsd(quote.price)}
        </strong>
        <span className={`market-change market-change-${direction}`}>
          {changeLabel(quote.change, quote.changePercent, direction)}
        </span>
      </div>
      <dl>
        <div>
          <dt>Freshness</dt>
          <dd>
            {quote.freshness === "current" ? "Current" : "Older than 36 hours"}
          </dd>
        </div>
        <div>
          <dt>Previous close</dt>
          <dd>
            {quote.previousClose === null
              ? "Unavailable"
              : formatUsd(quote.previousClose)}
          </dd>
        </div>
        <div>
          <dt>
            {quote.kind === "end_of_day_close"
              ? "Modeled session close"
              : "Source time"}
          </dt>
          <dd>
            <time dateTime={quote.sourceTime}>
              {formatInstant(quote.sourceTime)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Ingested</dt>
          <dd>
            <time dateTime={quote.ingestedAt}>
              {formatInstant(quote.ingestedAt)}
            </time>
          </dd>
        </div>
      </dl>
    </article>
  );
}

function marketErrorTitle(code: PersonalWorkspaceApiErrorCode): string {
  switch (code) {
    case "not_configured":
      return "Market data is not configured.";
    case "credentials_invalid":
      return "The provider credential was rejected.";
    case "rate_limited":
      return "The provider rate limit was reached.";
    case "not_covered":
      return "This listing is not covered.";
    case "provider_unavailable":
      return "The market-data provider is unavailable.";
    default:
      return "Market data could not be loaded.";
  }
}

function marketErrorDetail(code: PersonalWorkspaceApiErrorCode): string {
  switch (code) {
    case "not_configured":
      return "Configure the owner-local provider credential, then revalidate the session.";
    case "credentials_invalid":
      return "Replace the owner-local Tiingo credential before retrying.";
    case "rate_limited":
      return "Wait for the provider limit to reset, then retry this range.";
    case "not_covered":
      return "No admitted quote and daily history mapping exists for this listing.";
    case "provider_unavailable":
      return "No synthetic value was substituted. Retry when Tiingo is available.";
    default:
      return "The response was unavailable or invalid. No synthetic value was substituted.";
  }
}

function changeLabel(
  change: string | null,
  percent: string | null,
  direction: "down" | "unavailable" | "unchanged" | "up",
): string {
  if (change === null || percent === null) return "Change unavailable";
  const word =
    direction === "up" ? "Up" : direction === "down" ? "Down" : "Unchanged";
  return `${word} ${formatSignedUsd(change)} (${formatSignedPercent(percent)})`;
}

function rangeLabel(range: PersonalMarketDataRangeDto): string {
  return ranges.find(([value]) => value === range)?.[1] ?? range.toUpperCase();
}

function formatUsd(value: string): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 4,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(Number(value));
}

function formatSignedUsd(value: string): string {
  const numeric = Number(value);
  return `${numeric > 0 ? "+" : ""}${formatUsd(value)}`;
}

function formatSignedPercent(value: string): string {
  const numeric = Number(value);
  return `${numeric > 0 ? "+" : ""}${numeric.toLocaleString("en-US", {
    maximumFractionDigits: 4,
  })}%`;
}

function formatInstant(value: string): string {
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value))} UTC`;
}
