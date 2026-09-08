import type {
  PersonalAnnualFinancialsDto,
  PersonalMarketDataStatusDto,
} from "@research-cockpit/contracts";
import {
  buildPersonalFinancialAnalytics,
  PERSONAL_FINANCIAL_ANALYTICS_METRIC_KEYS,
  PERSONAL_FINANCIAL_ANALYTICS_ROUNDING,
  PERSONAL_FINANCIAL_REPORTED_FIELDS,
  type PersonalFinancialAnalyticsGrowthMetric,
  type PersonalFinancialAnalyticsPeriodMetric,
  type PersonalFinancialStatementId,
} from "@research-cockpit/personal-financial-analytics";

import type { PersonalWorkspaceApiErrorCode } from "@/lib/personal-workspace-api";

import type { PersonalMarketSelection } from "./PersonalMarketOverview";

export interface PersonalAnnualFinancialsProps {
  readonly errorCode: PersonalWorkspaceApiErrorCode | null;
  readonly financials: PersonalAnnualFinancialsDto | null;
  readonly onLoad: () => void;
  readonly providerStatus: PersonalMarketDataStatusDto | null;
  readonly requestState: "idle" | "loading";
  readonly selection: PersonalMarketSelection | null;
}

const statementLabels = {
  balance_sheet: "Balance sheet",
  cash_flow: "Cash flow",
  income_statement: "Income statement",
} as const satisfies Readonly<Record<PersonalFinancialStatementId, string>>;

const metricLabels = {
  cashToAssets: "Cash / assets",
  debtToAssets: "Debt / assets",
  freeCashFlowMargin: "Free-cash-flow margin",
  grossMargin: "Gross margin",
  netDebt: "Net debt",
  netMargin: "Net margin",
  operatingCashFlowMargin: "Operating-cash-flow margin",
  operatingMargin: "Operating margin",
} as const;

const growthLabels = {
  freeCashFlow: "Free-cash-flow growth",
  netIncome: "Net-income growth",
  revenue: "Revenue growth",
} as const;

export function PersonalAnnualFinancials({
  errorCode,
  financials,
  onLoad,
  providerStatus,
  requestState,
  selection,
}: PersonalAnnualFinancialsProps) {
  const configured = providerStatus?.status === "configured";
  const explicitlyUnconfigured = providerStatus?.status === "not_configured";
  const analytics =
    financials === null
      ? null
      : buildPersonalFinancialAnalytics({
          asOf: financials.asOf,
          periods: financials.years.map((year) => ({
            facts: PERSONAL_FINANCIAL_REPORTED_FIELDS.flatMap((field) => {
              if (field.analyticsInput === null) return [];
              const cell = year.reported[field.fieldKey];
              return cell.status === "known"
                ? [
                    {
                      key: field.analyticsInput,
                      sourceRef: `${String(year.fiscalYear)}:${field.fieldKey}`,
                      unit: "USD" as const,
                      value: cell.value,
                    },
                  ]
                : [];
            }),
            fiscalYear: year.fiscalYear,
            periodEnd: year.periodEnd,
          })),
        });

  return (
    <section
      aria-busy={requestState === "loading"}
      aria-labelledby="personal-annual-financials-title"
      className="personal-financials-panel"
    >
      <div className="discovery-section-heading personal-financials-heading">
        <div>
          <p className="eyebrow">Multi-year company fundamentals</p>
          <h2 id="personal-annual-financials-title">Annual financials</h2>
        </div>
        <span>30 reported fields · 8 metrics · 3 growth checks</span>
      </div>

      <p className="market-scope-note">
        Load corrected annual statements separately from price history. The
        fixed registry ignores newly added provider fields, shows missing data
        explicitly, and keeps all values in active-session memory only.
      </p>

      {selection === null ? (
        <div className="discovery-empty-state market-empty-state">
          <strong>Choose a security to inspect its financials.</strong>
          <span>
            Use “View market” in search results or My Watchlist, then request
            annual statements for that exact admitted listing.
          </span>
        </div>
      ) : (
        <>
          {errorCode === null ? null : (
            <div className="market-message market-message-error" role="alert">
              <strong>{financialsErrorTitle(errorCode)}</strong>
              <span>{financialsErrorDetail(errorCode)}</span>
              <small>No reported or derived value was substituted.</small>
            </div>
          )}

          <div className="market-load-state financials-load-state">
            <p aria-live="polite">
              {requestState === "loading"
                ? `Loading annual statements for ${selection.symbol}…`
                : financials !== null && analytics !== null
                  ? `Annual statements loaded for ${selection.symbol}.`
                  : errorCode !== null
                    ? `The annual-statements request for ${selection.symbol} did not complete.`
                    : configured
                      ? `No fundamentals request has been made for ${selection.symbol}.`
                      : explicitlyUnconfigured
                        ? `Configure the owner-local Tiingo credential to load annual statements for ${selection.symbol}.`
                        : `Provider status is unavailable. Revalidate the owner session before loading annual statements for ${selection.symbol}.`}
            </p>
            <button
              className="primary-action compact-action"
              disabled={!configured || requestState === "loading"}
              onClick={onLoad}
              type="button"
            >
              {requestState === "loading"
                ? "Loading annual financials…"
                : financials !== null && analytics !== null
                  ? "Refresh annual financials"
                  : errorCode === null
                    ? "Load annual financials"
                    : "Retry annual financials"}
            </button>
          </div>

          {financials !== null && analytics !== null ? (
            <FinancialsResult financials={financials} analytics={analytics} />
          ) : null}
        </>
      )}
    </section>
  );
}

function FinancialsResult({
  analytics,
  financials,
}: {
  readonly analytics: ReturnType<typeof buildPersonalFinancialAnalytics>;
  readonly financials: PersonalAnnualFinancialsDto;
}) {
  const displayFiscalYears = Array.from(
    { length: financials.coverage.requestedAnnualYears },
    (_, offset) => financials.coverage.latestFiscalYear - offset,
  );
  const yearsByFiscalYear = new Map(
    financials.years.map((year) => [year.fiscalYear, year]),
  );

  return (
    <div className="personal-financials-result">
      <div className="financials-coverage-strip">
        <div>
          <span>Annual periods returned</span>
          <strong>
            {financials.coverage.returnedAnnualYears} /{" "}
            {financials.coverage.requestedAnnualYears}
          </strong>
        </div>
        <div>
          <span>Reported values known</span>
          <strong>
            {financials.coverage.knownReportedCells} /{" "}
            {financials.coverage.knownReportedCells +
              financials.coverage.unknownReportedCells}
          </strong>
        </div>
        <div>
          <span>History basis</span>
          <strong>Provider most recent</strong>
        </div>
        <div>
          <span>Loaded</span>
          <strong>{formatInstant(financials.asOf)}</strong>
        </div>
      </div>

      {financials.coverage.missingFiscalYears.length === 0 ? null : (
        <p className="financials-missing-years" role="note">
          <strong>Missing annual years:</strong>{" "}
          {financials.coverage.missingFiscalYears.join(", ")}. These remain
          blank; later years are never shifted into their place.
        </p>
      )}

      <div className="financial-statement-stack">
        {(["income_statement", "balance_sheet", "cash_flow"] as const).map(
          (statement, index) => (
            <details
              className="financial-statement"
              key={statement}
              open={index === 0}
            >
              <summary>
                <strong>{statementLabels[statement]}</strong>
                <span>
                  {
                    PERSONAL_FINANCIAL_REPORTED_FIELDS.filter(
                      (field) => field.statement === statement,
                    ).length
                  }{" "}
                  fields
                </span>
              </summary>
              <div
                aria-label={`${statementLabels[statement]} financial statement table`}
                className="financial-table-scroll"
                role="region"
                tabIndex={0}
              >
                <table>
                  <caption>
                    {statementLabels[statement]} · USD · newest to oldest
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Reported field</th>
                      {displayFiscalYears.map((fiscalYear) => {
                        const year = yearsByFiscalYear.get(fiscalYear);
                        return (
                          <th scope="col" key={fiscalYear}>
                            <span>FY {fiscalYear}</span>
                            <small>
                              {year === undefined
                                ? "Not returned"
                                : `Period ended ${formatPeriodDate(year.periodEnd)}`}
                            </small>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {PERSONAL_FINANCIAL_REPORTED_FIELDS.filter(
                      (field) => field.statement === statement,
                    ).map((field) => (
                      <tr key={field.fieldKey}>
                        <th scope="row">{field.label}</th>
                        {displayFiscalYears.map((fiscalYear) => {
                          const year = yearsByFiscalYear.get(fiscalYear);
                          const cell = year?.reported[field.fieldKey];
                          return (
                            <td key={fiscalYear}>
                              {cell?.status === "known" ? (
                                <span title={`${cell.value} USD`}>
                                  {formatUsdExact(cell.value)}
                                </span>
                              ) : (
                                <span
                                  aria-label={
                                    year === undefined
                                      ? `Fiscal year ${String(fiscalYear)} not returned`
                                      : `${field.label} unknown for fiscal year ${String(fiscalYear)}`
                                  }
                                  className="financial-cell-unknown"
                                >
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ),
        )}
      </div>

      <section
        aria-labelledby="personal-core-metrics-title"
        className="personal-core-metrics"
      >
        <div className="market-analytics-heading">
          <div>
            <p className="eyebrow">Formula set {analytics.formulaSetVersion}</p>
            <h3 id="personal-core-metrics-title">Core financial metrics</h3>
          </div>
          <span>
            Latest FY {String(financials.coverage.latestFiscalYear)} · exact
            decimal arithmetic
          </span>
        </div>
        {analytics.status === "quarantined" ? (
          <div className="market-message market-message-error" role="alert">
            <strong>Financial metrics are unavailable.</strong>
            <span>
              The annual input envelope did not pass local validation.
            </span>
          </div>
        ) : (
          <>
            <div className="financial-metric-grid">
              {PERSONAL_FINANCIAL_ANALYTICS_METRIC_KEYS.map((key) => (
                <FinancialMetricCard
                  key={key}
                  label={metricLabels[key]}
                  metric={analytics.periods[0]!.metrics[key]}
                />
              ))}
            </div>
            <div className="financial-growth-grid">
              {(Object.keys(growthLabels) as (keyof typeof growthLabels)[]).map(
                (key) => (
                  <GrowthCard
                    key={key}
                    label={growthLabels[key]}
                    metric={analytics.growth[key]}
                  />
                ),
              )}
            </div>
            <details className="financial-methodology">
              <summary>Formulas, inputs, and period details</summary>
              <ol>
                {PERSONAL_FINANCIAL_ANALYTICS_METRIC_KEYS.map((key) => {
                  const metric = analytics.periods[0]!.metrics[key];
                  return (
                    <li key={key}>
                      <strong>{metricLabels[key]}</strong>
                      <code>{metric.expression}</code>
                      <span>
                        {metric.formulaId} · version {metric.formulaVersion} ·{" "}
                        inputs {inputLabel(metric.inputRefs)}
                      </span>
                    </li>
                  );
                })}
                {(
                  Object.keys(growthLabels) as (keyof typeof growthLabels)[]
                ).map((key) => {
                  const metric = analytics.growth[key];
                  return (
                    <li key={`growth-${key}`}>
                      <strong>{growthLabels[key]}</strong>
                      <code>{metric.expression}</code>
                      <span>
                        {metric.formulaId} · version {metric.formulaVersion} ·
                        inputs {inputLabel(metric.inputRefs)}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p>
                Derived metrics {roundingPolicyLabel()}. “Net debt” is debt
                minus cash; a negative result means net cash. Growth compares
                only distinct consecutive fiscal years with a positive
                prior-year base, never corrected copies of the same year.
              </p>
            </details>
          </>
        )}
      </section>

      <p className="market-attribution">
        Data attribution: {financials.provider.attribution}. Values are USD and
        use the provider&apos;s most-recent corrected history, not a
        point-in-time backtest view. Export and redistribution are prohibited.
      </p>
    </div>
  );
}

function FinancialMetricCard({
  label,
  metric,
}: {
  readonly label: string;
  readonly metric: PersonalFinancialAnalyticsPeriodMetric;
}) {
  return (
    <article className="financial-metric-card">
      <span>{label}</span>
      <strong>
        {metric.status === "available"
          ? metric.unit === "percent"
            ? `${metric.value}%`
            : formatUsdExact(metric.value)
          : "Unknown"}
      </strong>
      <small>
        {metric.status === "available"
          ? metric.unit === "USD" && metric.value.startsWith("-")
            ? "Net cash position"
            : `FY ${String(metric.fiscalYear)}`
          : unavailableReason(metric.reason)}
      </small>
    </article>
  );
}

function GrowthCard({
  label,
  metric,
}: {
  readonly label: string;
  readonly metric: PersonalFinancialAnalyticsGrowthMetric;
}) {
  return (
    <article className="financial-growth-card">
      <span>{label}</span>
      <strong>
        {metric.status === "available" ? `${signed(metric.value)}%` : "Unknown"}
      </strong>
      <small>
        {metric.status === "available"
          ? `FY ${String(metric.fromFiscalYear)} → FY ${String(metric.toFiscalYear)}`
          : growthUnavailableReason(metric.reason)}
      </small>
    </article>
  );
}

function financialsErrorTitle(code: PersonalWorkspaceApiErrorCode): string {
  switch (code) {
    case "not_entitled":
      return "Annual financials are not included for this account.";
    case "not_covered":
      return "Annual financials are not available for this listing.";
    case "credentials_invalid":
      return "The provider credential was rejected.";
    case "rate_limited":
      return "The provider rate limit was reached.";
    case "not_configured":
      return "The provider is not configured.";
    case "provider_unavailable":
      return "The fundamentals provider is unavailable.";
    default:
      return "Annual financials could not be loaded.";
  }
}

function financialsErrorDetail(code: PersonalWorkspaceApiErrorCode): string {
  switch (code) {
    case "not_entitled":
      return "The price feed can still work. This separate fundamentals feed requires an eligible evaluation symbol or fundamentals entitlement.";
    case "not_covered":
      return "The admitted listing has no annual statement response in the configured fundamentals feed.";
    case "credentials_invalid":
      return "Replace the owner-local provider credential before retrying.";
    case "rate_limited":
      return "Wait for the provider limit to reset, then retry once.";
    case "not_configured":
      return "Start the personal workspace with its owner-local provider credential.";
    case "provider_unavailable":
      return "The provider response was unavailable or invalid. Retry later.";
    default:
      return "Revalidate the owner session and try this exact listing again.";
  }
}

function inputLabel(
  refs: readonly Readonly<{ factKey: string; sourceRef: string }>[],
): string {
  return refs.length === 0
    ? "unavailable"
    : refs.map(({ sourceRef }) => sourceRef).join(" + ");
}

function unavailableReason(reason: string): string {
  switch (reason) {
    case "zero_denominator":
      return "Denominator is zero";
    case "ambiguous_fact":
      return "Duplicate current input";
    case "invalid_decimal":
    case "invalid_unit":
    case "invalid_source_ref":
      return "Input did not pass validation";
    default:
      return "Required reported input is missing";
  }
}

function growthUnavailableReason(reason: string): string {
  switch (reason) {
    case "insufficient_periods":
      return "Two annual periods are required";
    case "non_consecutive_fiscal_years":
      return "The latest two annual periods are not consecutive";
    case "zero_denominator":
      return "Prior-year value is zero";
    case "nonpositive_prior":
      return "Not meaningful because the prior-year value is negative";
    default:
      return "A required reported input is unavailable";
  }
}

function signed(value: string): string {
  return value.startsWith("-") || value === "0.00" ? value : `+${value}`;
}

function formatUsdExact(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${negative ? "−" : ""}$${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
}

function formatInstant(value: string): string {
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value))} UTC`;
}

function formatPeriodDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function roundingPolicyLabel(): string {
  const policy = PERSONAL_FINANCIAL_ANALYTICS_ROUNDING;
  return `round half-up to ${String(policy.decimalPlaces)} decimals`;
}
