"use client";

import {
  calculatePersonalMarketAnalytics,
  type PersonalMarketAnalyticsBar,
  type PersonalMarketAnalyticsMode,
  type PersonalMarketAnalyticsResult,
  type PersonalMarketAnalyticsTrendClassification,
} from "@research-cockpit/personal-market-analytics";

export interface PersonalMarketAnalyticsProps {
  readonly asOfDate: string;
  readonly bars: readonly PersonalMarketAnalyticsBar[];
  readonly mode: PersonalMarketAnalyticsMode;
}

type ScalarMetric =
  | PersonalMarketAnalyticsResult["metrics"]["maximumDrawdown"]
  | PersonalMarketAnalyticsResult["metrics"]["selectedWindowReturn"]
  | PersonalMarketAnalyticsResult["metrics"]["trailing20SessionAnnualizedVolatility"]
  | PersonalMarketAnalyticsResult["metrics"]["trailing252SessionCloseRangePosition"];
type TrendMetric =
  PersonalMarketAnalyticsResult["metrics"]["smaTrend"][keyof PersonalMarketAnalyticsResult["metrics"]["smaTrend"]];
type FormulaMetric = ScalarMetric | TrendMetric;

export function PersonalMarketAnalytics({
  asOfDate,
  bars,
  mode,
}: PersonalMarketAnalyticsProps) {
  const analytics = calculatePersonalMarketAnalytics({
    asOfDate,
    bars: bars.map((bar) => ({
      adjusted: { close: bar.adjusted.close },
      date: bar.date,
      raw: { close: bar.raw.close },
    })),
    mode,
  });
  const { inputWindow, metrics } = analytics;

  return (
    <section
      aria-describedby="personal-market-analytics-summary"
      aria-labelledby="personal-market-analytics-title"
      className="personal-market-analytics"
    >
      <div className="market-analytics-heading">
        <div>
          <p className="eyebrow">Client-side price analytics</p>
          <h3 id="personal-market-analytics-title">Trend &amp; risk</h3>
        </div>
        <span aria-live="polite" className="market-analytics-mode">
          {mode === "adjusted" ? "Adjusted" : "Raw"} · as of{" "}
          <time dateTime={analytics.asOfDate}>
            {formatDate(analytics.asOfDate)}
          </time>
        </span>
      </div>

      <p
        className="market-analytics-intro"
        id="personal-market-analytics-summary"
      >
        Descriptive aggregates recomputed in this browser from the loaded
        history. Changing price adjustment does not request the provider again.
      </p>

      <div className="market-analytics-grid">
        <MetricCard
          label="Selected-window return"
          metric={metrics.selectedWindowReturn}
          signed
        />
        <MetricCard
          label="20-session annualized volatility"
          metric={metrics.trailing20SessionAnnualizedVolatility}
        />
        <MetricCard
          detail={drawdownDetail(metrics.maximumDrawdown)}
          label="Maximum drawdown"
          metric={metrics.maximumDrawdown}
        />
        <MetricCard
          label="Trailing close-range position"
          metric={metrics.trailing252SessionCloseRangePosition}
        />
      </div>

      <div
        aria-labelledby="market-trend-classifications-title"
        className="market-trend-panel"
        role="group"
      >
        <div>
          <p className="eyebrow">Close versus simple moving average</p>
          <h4 id="market-trend-classifications-title">Trend classifications</h4>
        </div>
        <div className="market-trend-grid">
          <TrendClassification
            label="20 sessions"
            metric={metrics.smaTrend.sma20}
          />
          <TrendClassification
            label="50 sessions"
            metric={metrics.smaTrend.sma50}
          />
          <TrendClassification
            label="200 sessions"
            metric={metrics.smaTrend.sma200}
          />
        </div>
      </div>

      <details className="market-analytics-methodology">
        <summary>Methodology, formulas, and sample details</summary>
        <div className="market-analytics-methodology-body">
          <dl className="market-analytics-inputs">
            <div>
              <dt>Price input</dt>
              <dd>{mode === "adjusted" ? "Adjusted close" : "Raw close"}</dd>
            </div>
            <div>
              <dt>As-of date</dt>
              <dd>
                <time dateTime={analytics.asOfDate}>
                  {formatDate(analytics.asOfDate)}
                </time>
              </dd>
            </div>
            <div>
              <dt>Observed sample</dt>
              <dd>
                {inputWindow.sessionCount.toLocaleString("en-US")} sessions ·{" "}
                {formatSampleRange(inputWindow.firstDate, inputWindow.lastDate)}
              </dd>
            </div>
            <div>
              <dt>Session policy</dt>
              <dd>Observed sessions only; missing dates are not gap-filled.</dd>
            </div>
          </dl>

          <ol className="market-formula-list">
            <FormulaRow
              description="Last observed close divided by first observed close, minus one."
              label="Selected-window return"
              metric={metrics.selectedWindowReturn}
            />
            <FormulaRow
              description="Sample standard deviation of the latest 20 natural-log close returns, annualized by the square root of 252."
              label="20-session annualized volatility"
              metric={metrics.trailing20SessionAnnualizedVolatility}
            />
            <FormulaRow
              description="Largest nonnegative peak-to-trough decline across the selected observed window."
              label="Maximum drawdown"
              metric={metrics.maximumDrawdown}
            />
            <FormulaRow
              description="Latest close's relative position between the lowest and highest observed closes in the latest, up-to-252-session window."
              label="Trailing close-range position"
              metric={metrics.trailing252SessionCloseRangePosition}
            />
            <FormulaRow
              description="Latest close classified above, below, or exactly at the trailing arithmetic mean."
              label="20-session trend"
              metric={metrics.smaTrend.sma20}
            />
            <FormulaRow
              description="Latest close classified above, below, or exactly at the trailing arithmetic mean."
              label="50-session trend"
              metric={metrics.smaTrend.sma50}
            />
            <FormulaRow
              description="Latest close classified above, below, or exactly at the trailing arithmetic mean."
              label="200-session trend"
              metric={metrics.smaTrend.sma200}
            />
          </ol>

          <p className="market-analytics-policy-note">
            Formula set {analytics.formulaSetVersion} · result schema{" "}
            {analytics.schemaVersion}. Warm-up counts use observed sessions;
            dates are not synthesized. These aggregates disclose neither source
            prices nor moving-average values and do not generate an investment
            rating.
          </p>
        </div>
      </details>
    </section>
  );
}

function MetricCard({
  detail,
  label,
  metric,
  signed = false,
}: {
  readonly detail?: string | null;
  readonly label: string;
  readonly metric: ScalarMetric;
  readonly signed?: boolean;
}) {
  if (metric.status === "available") {
    return (
      <article className="market-analytics-card">
        <span>{label}</span>
        <strong title={`${metric.valuePercent}%`}>
          {formatPercent(metric.valuePercent, signed)}
        </strong>
        <small>{detail ?? "Available for this observed sample"}</small>
      </article>
    );
  }
  if (metric.status === "zero_range") {
    return (
      <article className="market-analytics-card market-analytics-unavailable">
        <span>{label}</span>
        <strong>Zero range</strong>
        <small>
          Position is unavailable because the highest and lowest observed closes
          are equal.
        </small>
      </article>
    );
  }
  return (
    <article className="market-analytics-card market-analytics-unavailable">
      <span>{label}</span>
      <strong>Warming up</strong>
      <small>{warmUpLabel(metric)}</small>
    </article>
  );
}

function TrendClassification({
  label,
  metric,
}: {
  readonly label: string;
  readonly metric: TrendMetric;
}) {
  if (metric.status === "available") {
    return (
      <article className="market-trend-classification">
        <span>{label}</span>
        <strong className={`market-trend-${metric.classification}`}>
          {capitalize(metric.classification)}
        </strong>
        <small>
          Available ·{" "}
          {distanceLabel(metric.distancePercent, metric.classification)}
        </small>
      </article>
    );
  }
  return (
    <article className="market-trend-classification market-analytics-unavailable">
      <span>{label}</span>
      <strong>Warming up</strong>
      <small>{warmUpLabel(metric)}</small>
    </article>
  );
}

function FormulaRow({
  description,
  label,
  metric,
}: {
  readonly description: string;
  readonly label: string;
  readonly metric: FormulaMetric;
}) {
  return (
    <li>
      <strong>{label}</strong>
      <span>{description}</span>
      <small>
        <code>{metric.formulaId}</code> · version {metric.formulaVersion}
        {parameterLabel(metric.parameters)} ·{" "}
        {metric.observedSessions.toLocaleString("en-US")} observed{" "}
        {metric.observedSessions === 1 ? "session" : "sessions"} ·{" "}
        {formatSampleRange(metric.sampleFirstDate, metric.sampleLastDate)}
      </small>
    </li>
  );
}

function warmUpLabel(metric: {
  readonly observedSessions: number;
  readonly requiredSessions: number;
}): string {
  return `Unavailable · ${metric.observedSessions.toLocaleString("en-US")} of ${metric.requiredSessions.toLocaleString("en-US")} observed sessions`;
}

function drawdownDetail(
  metric: PersonalMarketAnalyticsResult["metrics"]["maximumDrawdown"],
): string | null {
  if (metric.status !== "available") return null;
  return metric.peakDate === metric.troughDate
    ? "No observed peak-to-trough decline"
    : `${formatDate(metric.peakDate)} peak to ${formatDate(metric.troughDate)} trough`;
}

function distanceLabel(
  value: string,
  classification: PersonalMarketAnalyticsTrendClassification,
): string {
  const numeric = Number(value);
  if (classification === "at") return "At the trailing average (0.00%)";
  if (Math.abs(numeric) < 0.005) {
    return `Less than 0.01% ${classification} the trailing average`;
  }
  return `${formatPercent(value, true)} from the trailing average`;
}

function parameterLabel(parameters: FormulaMetric["parameters"]): string {
  const values = Object.entries(parameters);
  if (values.length === 0) return "";
  return ` · ${values
    .map(([key, value]) => `${humanize(key)}: ${String(value)}`)
    .join(" · ")}`;
}

function formatPercent(value: string, signed: boolean): string {
  const numeric = Number(value);
  const formatted = numeric.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return `${signed && numeric > 0 ? "+" : ""}${formatted}%`;
}

function formatSampleRange(
  firstDate: string | null,
  lastDate: string | null,
): string {
  if (firstDate === null || lastDate === null) return "no dated observations";
  return `${formatDate(firstDate)}–${formatDate(lastDate)}`;
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

function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
