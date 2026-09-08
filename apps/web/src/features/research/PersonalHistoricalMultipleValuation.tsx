"use client";

import type {
  PersonalMarketDataIdentityDto,
  PersonalMarketOverviewDto,
  PersonalValuationHistoryDto,
  PersonalValuationRatioCellDto,
} from "@research-cockpit/contracts";
import {
  calculatePersonalHistoricalMultipleValuation,
  type PersonalHistoricalMultipleValuationAvailableResult,
  type PersonalHistoricalMultipleValuationBand,
  type PersonalHistoricalMultipleValuationCoverage,
  type PersonalHistoricalMultipleValuationHistoryInput,
  type PersonalHistoricalMultipleValuationIdentity,
  type PersonalHistoricalMultipleValuationMarketInput,
  type PersonalHistoricalMultipleValuationMetric,
  type PersonalHistoricalMultipleValuationRatioCell,
  type PersonalHistoricalMultipleValuationUnavailableReason,
  type PersonalHistoricalMultipleValuationUnavailableResult,
} from "@research-cockpit/personal-market-analytics";

import type { PersonalMarketSelection } from "./PersonalMarketOverview";

export interface PersonalHistoricalMultipleValuationProps {
  readonly marketOverview: PersonalMarketOverviewDto | null;
  readonly metric: PersonalHistoricalMultipleValuationMetric;
  readonly onMetricChange: (
    metric: PersonalHistoricalMultipleValuationMetric,
  ) => void;
  readonly selection: PersonalMarketSelection | null;
  readonly valuationHistory: PersonalValuationHistoryDto | null;
}

const metricOptions = [
  {
    accessibleLabel: "Use price-to-earnings history",
    label: "P/E",
    metric: "priceToEarnings",
  },
  {
    accessibleLabel: "Use price-to-book history",
    label: "P/B",
    metric: "priceToBook",
  },
] as const satisfies readonly Readonly<{
  accessibleLabel: string;
  label: string;
  metric: PersonalHistoricalMultipleValuationMetric;
}>[];

export function PersonalHistoricalMultipleValuation({
  marketOverview,
  metric,
  onMetricChange,
  selection,
  valuationHistory,
}: PersonalHistoricalMultipleValuationProps) {
  const result =
    selection === null
      ? null
      : calculatePersonalHistoricalMultipleValuation({
          market: mapMarketOverview(marketOverview),
          metric,
          valuation: mapValuationHistory(valuationHistory),
        });
  const loadedForSelection =
    selection !== null &&
    (marketOverview === null ||
      identityMatchesSelection(marketOverview.security, selection)) &&
    (valuationHistory === null ||
      identityMatchesSelection(valuationHistory.security, selection));
  const staleLoadedInputs =
    selection !== null &&
    !loadedForSelection &&
    !(
      result?.status === "unavailable" && result.reason === "identity_mismatch"
    );

  return (
    <section
      aria-describedby="personal-historical-multiple-summary personal-historical-multiple-caveat"
      aria-labelledby="personal-historical-multiple-title"
      className="personal-historical-multiple"
    >
      <div className="historical-multiple-heading">
        <div>
          <p className="eyebrow">Browser-local valuation scenarios</p>
          <h3 id="personal-historical-multiple-title">
            Historical multiple valuation
          </h3>
        </div>
        <div
          aria-label="Historical multiple metric"
          className="historical-multiple-switch"
          role="group"
        >
          {metricOptions.map((option) => (
            <button
              aria-label={option.accessibleLabel}
              aria-pressed={metric === option.metric}
              key={option.metric}
              onClick={() => onMetricChange(option.metric)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p
        aria-live="polite"
        className="historical-multiple-intro"
        id="personal-historical-multiple-summary"
      >
        {summaryCopy(selection, staleLoadedInputs, result, metric)}
      </p>

      {selection === null ? (
        <ReadinessState
          detail="Use “View market” in search results or My Watchlist before loading the two source histories."
          title="Choose a security to build historical-multiple scenarios."
        />
      ) : staleLoadedInputs ? (
        <ReadinessState
          detail="The loaded market or valuation history belongs to another listing. Reload both inputs for the current selection; no stale value is shown."
          title={`Reload inputs for ${selection.symbol}.`}
        />
      ) : result?.status === "available" ? (
        <AvailableResult result={result} symbol={selection.symbol} />
      ) : result === null ? null : (
        <UnavailableResult
          bothHistoriesMissing={
            marketOverview === null && valuationHistory === null
          }
          result={result}
          symbol={selection.symbol}
        />
      )}

      {selection === null ? null : (
        <InputProvenance
          marketOverview={marketOverview}
          valuationHistory={valuationHistory}
        />
      )}

      <p
        className="historical-multiple-caveat"
        id="personal-historical-multiple-caveat"
        role="note"
      >
        This uses provider-most-recent valuation history, not point-in-time or
        as-reported history. It is not intrinsic fair value. It is not a price
        target. It is not a buy/sell recommendation. Each implied-price scenario
        holds the reference-date earnings or book-value-per-share basis constant
        and changes only the multiple. This view makes no fetch, persists
        nothing, and provides no export.
      </p>
    </section>
  );
}

function AvailableResult({
  result,
  symbol,
}: {
  readonly result: PersonalHistoricalMultipleValuationAvailableResult;
  readonly symbol: string;
}) {
  const metricLabel = labelForMetric(result.metric);
  return (
    <div className="historical-multiple-result">
      <div
        aria-label={`${symbol} ${metricLabel} reference observation`}
        className="historical-multiple-reference-grid"
      >
        <div>
          <span>Reference date</span>
          <strong>
            <time dateTime={result.reference.date}>
              {formatDate(result.reference.date)}
            </time>
          </strong>
        </div>
        <div>
          <span>Raw close</span>
          <strong title={`${result.reference.rawCloseUsd} USD`}>
            {formatUsd(result.reference.rawCloseUsd)}
          </strong>
        </div>
        <div>
          <span>Reference-date {metricLabel}</span>
          <strong title={`${result.reference.currentMultiple} ratio`}>
            {formatMultiple(result.reference.currentMultiple)}
          </strong>
        </div>
        <div>
          <span>Reference multiple percentile</span>
          <strong title={`${result.currentPercentilePercent}%`}>
            {formatUnsignedPercent(result.currentPercentilePercent)}
          </strong>
        </div>
      </div>

      <div
        aria-label={`${symbol} ${metricLabel} historical-multiple scenarios`}
        className="historical-multiple-scenario-grid"
      >
        <ScenarioCard band={result.bands.p25} label="Lower quartile" />
        <ScenarioCard band={result.bands.p50} base label="Median" />
        <ScenarioCard band={result.bands.p75} label="Upper quartile" />
      </div>

      <CoverageSummary coverage={result.coverage} />
      <MethodologyDetails result={result} />
    </div>
  );
}

function UnavailableResult({
  bothHistoriesMissing,
  result,
  symbol,
}: {
  readonly bothHistoriesMissing: boolean;
  readonly result: PersonalHistoricalMultipleValuationUnavailableResult;
  readonly symbol: string;
}) {
  const copy = unavailableCopy(
    result.reason,
    result,
    symbol,
    bothHistoriesMissing,
  );
  return (
    <div className="historical-multiple-unavailable">
      <ReadinessState detail={copy.detail} title={copy.title} />
      {result.reference === null ? null : (
        <div
          aria-label={`${symbol} unavailable scenario reference`}
          className="historical-multiple-reference-grid"
        >
          <div>
            <span>Reference date</span>
            <strong>
              <time dateTime={result.reference.date}>
                {formatDate(result.reference.date)}
              </time>
            </strong>
          </div>
          <div>
            <span>Raw close</span>
            <strong title={`${result.reference.rawCloseUsd} USD`}>
              {formatUsd(result.reference.rawCloseUsd)}
            </strong>
          </div>
          <div>
            <span>Reference-date {labelForMetric(result.metric)}</span>
            <strong title={`${result.reference.currentMultiple} ratio`}>
              {formatMultiple(result.reference.currentMultiple)}
            </strong>
          </div>
          <div>
            <span>Scenario status</span>
            <strong>Unavailable</strong>
          </div>
        </div>
      )}
      {result.coverage === null ? null : (
        <CoverageSummary coverage={result.coverage} />
      )}
      <MethodologyDetails result={result} />
    </div>
  );
}

function ReadinessState({
  detail,
  title,
}: {
  readonly detail: string;
  readonly title: string;
}) {
  return (
    <div className="historical-multiple-state">
      <strong>{title}</strong>
      <span>{detail}</span>
      <small>
        No multiple, implied price, or recommendation was substituted.
      </small>
    </div>
  );
}

function ScenarioCard({
  band,
  base = false,
  label,
}: {
  readonly band: PersonalHistoricalMultipleValuationBand;
  readonly base?: boolean;
  readonly label: string;
}) {
  return (
    <article
      className={`historical-multiple-scenario-card${
        base ? " historical-multiple-scenario-card-base" : ""
      }`}
    >
      <span>
        {label} · P{band.quantilePercent}
      </span>
      <strong title={`${band.impliedPriceUsd} USD`}>
        {formatUsd(band.impliedPriceUsd)}
      </strong>
      <dl>
        <div>
          <dt>Target multiple</dt>
          <dd title={`${band.targetMultiple} ratio`}>
            {formatMultiple(band.targetMultiple)}
          </dd>
        </div>
        <div>
          <dt>Difference from raw close</dt>
          <dd title={`${band.differencePercent}%`}>
            {formatSignedPercent(band.differencePercent)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function CoverageSummary({
  coverage,
}: {
  readonly coverage: PersonalHistoricalMultipleValuationCoverage;
}) {
  const excluded =
    coverage.unknownExcludedObservations +
    coverage.nonpositiveExcludedObservations;
  return (
    <dl
      aria-label="Historical multiple sample coverage"
      className="historical-multiple-coverage"
    >
      <div>
        <dt>Included observations</dt>
        <dd>
          {formatCount(coverage.validPositiveObservations)} of{" "}
          {formatCount(coverage.totalObservations)} · minimum{" "}
          {formatCount(coverage.minimumRequiredObservations)}
        </dd>
      </div>
      <div>
        <dt>Excluded observations</dt>
        <dd>
          {formatCount(excluded)} total ·{" "}
          {formatCount(coverage.unknownExcludedObservations)} unknown ·{" "}
          {formatCount(coverage.nonpositiveExcludedObservations)} nonpositive
        </dd>
      </div>
      <div>
        <dt>Loaded sample window</dt>
        <dd>
          {formatSampleWindow(
            coverage.sampleFirstDate,
            coverage.sampleLastDate,
          )}
        </dd>
      </div>
    </dl>
  );
}

function InputProvenance({
  marketOverview,
  valuationHistory,
}: {
  readonly marketOverview: PersonalMarketOverviewDto | null;
  readonly valuationHistory: PersonalValuationHistoryDto | null;
}) {
  return (
    <dl
      aria-label="Loaded valuation input provenance"
      className="historical-multiple-inputs"
    >
      <div>
        <dt>Price input</dt>
        <dd>
          {marketOverview === null ? (
            "Not loaded"
          ) : (
            <>
              {marketOverview.provider.name} EOD composite · requested window{" "}
              {formatDate(marketOverview.history.startDate)}–
              {formatDate(marketOverview.history.endDate)} · latest raw bar{" "}
              {formatDate(
                marketOverview.history.bars.at(-1)?.date ??
                  marketOverview.history.endDate,
              )}
            </>
          )}
        </dd>
      </div>
      <div>
        <dt>Valuation input</dt>
        <dd>
          {valuationHistory === null ? (
            "Not loaded"
          ) : (
            <>
              {valuationHistory.provider.name} fundamentals daily · requested
              window {formatDate(valuationHistory.history.startDate)}–
              {formatDate(valuationHistory.history.endDate)} · response as of{" "}
              <time dateTime={valuationHistory.asOf}>
                {formatInstant(valuationHistory.asOf)}
              </time>
            </>
          )}
        </dd>
      </div>
    </dl>
  );
}

function MethodologyDetails({
  result,
}: {
  readonly result:
    | PersonalHistoricalMultipleValuationAvailableResult
    | PersonalHistoricalMultipleValuationUnavailableResult;
}) {
  const { methodology } = result;
  return (
    <details className="historical-multiple-methodology">
      <summary>Methodology, formulas, and rounding</summary>
      <div className="historical-multiple-methodology-body">
        <p>
          Quantiles use the R-7 method over known, strictly positive provider
          multiples. Missing and nonpositive observations are excluded and
          counted; dates and values are not gap-filled. Formula{" "}
          <code>{methodology.quantile.formulaId}</code>, version{" "}
          {methodology.quantile.formulaVersion}.
        </p>
        <p>
          Implied price = same-date raw close × target multiple ÷ reference-date
          multiple. Formula <code>{methodology.impliedPrice.formulaId}</code>,
          version {methodology.impliedPrice.formulaVersion}.
        </p>
        <p>
          Percent difference = 100 × (implied price ÷ raw close − 1). Formula{" "}
          <code>{methodology.percentDifference.formulaId}</code>. Reference
          multiple percentile uses the weak empirical CDF formula{" "}
          <code>{methodology.currentPercentile.formulaId}</code>.
        </p>
        <p>
          Round half up: multiples to{" "}
          {methodology.rounding.multipleDecimalPlaces} decimals; USD implied
          prices, percent differences, and percentiles to{" "}
          {methodology.rounding.impliedPriceDecimalPlaces},{" "}
          {methodology.rounding.percentDifferenceDecimalPlaces}, and{" "}
          {methodology.rounding.currentPercentileDecimalPlaces} decimals,
          respectively. Formula set {result.formulaSetVersion} · result schema{" "}
          {result.schemaVersion}.
        </p>
      </div>
    </details>
  );
}

function summaryCopy(
  selection: PersonalMarketSelection | null,
  staleLoadedInputs: boolean,
  result:
    | PersonalHistoricalMultipleValuationAvailableResult
    | PersonalHistoricalMultipleValuationUnavailableResult
    | null,
  metric: PersonalHistoricalMultipleValuationMetric,
): string {
  if (selection === null) {
    return "Load nothing here automatically: choose a security, then explicitly load its market and valuation histories above.";
  }
  if (staleLoadedInputs) {
    return `The loaded inputs do not belong to ${selection.symbol}; historical scenarios are blocked.`;
  }
  if (result?.status === "available") {
    return `${selection.symbol} ${labelForMetric(metric)} scenarios are available from the latest common loaded date and ${formatCount(result.coverage.validPositiveObservations)} positive observations.`;
  }
  if (result?.reason === "market_not_loaded") {
    return `Load ${selection.symbol} price history to start this calculation.`;
  }
  return `${selection.symbol} ${labelForMetric(metric)} scenarios are currently unavailable; the reason and next step are shown below.`;
}

function unavailableCopy(
  reason: PersonalHistoricalMultipleValuationUnavailableReason,
  result: PersonalHistoricalMultipleValuationUnavailableResult,
  symbol: string,
  bothHistoriesMissing: boolean,
): Readonly<{ detail: string; title: string }> {
  const metric = labelForMetric(result.metric);
  switch (reason) {
    case "market_not_loaded":
      return {
        detail: bothHistoriesMissing
          ? "Load market data and daily valuation history above for the same chosen range. The calculation never substitutes adjusted prices, synthetic prices, or inferred multiples."
          : "Load market data above for the chosen range. The calculation requires observed raw end-of-day closes and never substitutes adjusted or synthetic prices.",
        title: bothHistoriesMissing
          ? `Load ${symbol} price and valuation histories to calculate.`
          : `Load ${symbol} price history to calculate.`,
      };
    case "valuation_history_not_loaded":
      return {
        detail:
          "Load daily valuation history above for the same range. No provider multiple is inferred from another field.",
        title: `Load ${symbol} valuation history to calculate.`,
      };
    case "identity_mismatch":
      return {
        detail:
          "The price and valuation histories identify different listings. Reload both for the exact same admitted listing.",
        title: "Loaded histories describe different listings.",
      };
    case "range_mismatch":
      return {
        detail:
          "Choose one market range and reload both histories. Values from different requested windows are not mixed.",
        title: "Price and valuation ranges do not match.",
      };
    case "no_common_date":
      return {
        detail:
          "The loaded price bars and valuation points have no shared date, so a same-date reference cannot be formed.",
        title: "No common reference date is available.",
      };
    case "current_multiple_unavailable":
      return {
        detail: `${metric} is not applicable because the provider did not supply the selected ratio on the latest common date. No value was inferred.`,
        title: `Reference-date ${metric} is unavailable.`,
      };
    case "current_multiple_nonpositive":
      return {
        detail: `${metric} requires a strictly positive provider ratio on the reference date. A zero or negative ratio is excluded rather than treated as a valuation signal.`,
        title: `Reference-date ${metric} is nonpositive and not applicable.`,
      };
    case "reference_price_nonpositive":
      return {
        detail:
          "The same-date raw close must be strictly positive. The model does not replace it with an adjusted close, quote, or nearby date.",
        title: "The reference raw close is not usable.",
      };
    case "insufficient_positive_observations": {
      const included = result.coverage?.validPositiveObservations ?? 0;
      const required = result.coverage?.minimumRequiredObservations ?? 60;
      return {
        detail: `${formatCount(included)} of ${formatCount(required)} required known, strictly positive ${metric} observations are available. Load a longer common range or use the other metric.`,
        title: "More positive valuation history is needed.",
      };
    }
  }
}

function mapMarketOverview(
  overview: PersonalMarketOverviewDto | null,
): PersonalHistoricalMultipleValuationMarketInput | null {
  if (overview === null) return null;
  return {
    bars: overview.history.bars.map((bar) => ({
      date: bar.date,
      raw: { close: bar.raw.close },
    })),
    range: overview.history.range,
    security: mapIdentity(overview.security),
  };
}

function mapValuationHistory(
  history: PersonalValuationHistoryDto | null,
): PersonalHistoricalMultipleValuationHistoryInput | null {
  if (history === null) return null;
  return {
    points: history.history.points.map((point) => ({
      date: point.date,
      priceToBook: mapRatioCell(point.priceToBook),
      priceToEarnings: mapRatioCell(point.priceToEarnings),
    })),
    range: history.history.range,
    security: mapIdentity(history.security),
  };
}

function mapIdentity(
  identity: PersonalMarketDataIdentityDto,
): PersonalHistoricalMultipleValuationIdentity {
  return {
    country: identity.country,
    exchangeMic: identity.exchangeMic,
    issuerName: identity.issuerName,
    listingId: identity.listingId,
    securityName: identity.securityName,
    symbol: identity.symbol,
  };
}

function mapRatioCell(
  cell: PersonalValuationRatioCellDto,
): PersonalHistoricalMultipleValuationRatioCell {
  return cell.status === "known"
    ? { status: "known", unit: "ratio", value: cell.value }
    : {
        reason: "not_supplied_by_provider",
        status: "unknown",
        unit: "ratio",
        value: null,
      };
}

function identityMatchesSelection(
  identity: PersonalMarketDataIdentityDto,
  selection: PersonalMarketSelection,
): boolean {
  return (
    identity.exchangeMic === selection.exchangeMic &&
    identity.issuerName === selection.issuerName &&
    identity.listingId === selection.listingId &&
    identity.securityName === selection.securityName &&
    identity.symbol === selection.symbol
  );
}

function labelForMetric(
  metric: PersonalHistoricalMultipleValuationMetric,
): "P/E" | "P/B" {
  return metric === "priceToEarnings" ? "P/E" : "P/B";
}

function formatUsd(value: string): string {
  const formatted = formatDecimal(value, 2);
  return formatted.startsWith("−")
    ? `−$${formatted.slice(1)}`
    : `$${formatted}`;
}

function formatMultiple(value: string): string {
  return `${formatDecimal(value)}×`;
}

function formatUnsignedPercent(value: string): string {
  return `${formatDecimal(value, 2)}%`;
}

function formatSignedPercent(value: string): string {
  const formatted = formatDecimal(value, 2);
  if (formatted.startsWith("−") || isZeroDecimal(value)) {
    return `${formatted}%`;
  }
  return `+${formatted}%`;
}

function formatDecimal(value: string, minimumFractionDigits = 0): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", originalFraction = ""] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  const fraction = originalFraction.padEnd(minimumFractionDigits, "0");
  return `${negative ? "−" : ""}${grouped}${
    fraction.length === 0 ? "" : `.${fraction}`
  }`;
}

function isZeroDecimal(value: string): boolean {
  return /^0(?:\.0*)?$/u.test(value);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function formatInstant(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatSampleWindow(
  firstDate: string | null,
  lastDate: string | null,
): string {
  if (firstDate === null || lastDate === null) return "No dated observations";
  return `${formatDate(firstDate)}–${formatDate(lastDate)}`;
}
