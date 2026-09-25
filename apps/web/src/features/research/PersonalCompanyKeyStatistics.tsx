import type { PersonalAnnualFinancialsDto } from "@research-cockpit/contracts";
import type {
  PersonalFinancialAnalyticsGrowthMetric,
  PersonalFinancialAnalyticsPeriodMetric,
} from "@research-cockpit/personal-financial-analytics";
import type { PersonalWorkspaceApiErrorCode } from "@/lib/personal-workspace-api";
import type { PersonalMarketSelection } from "./PersonalMarketOverview";
import { formatPersonalFinancialUsd } from "./personal-annual-financial-analytics";
import {
  PERSONAL_COMPANY_KEY_STATISTICS_FIELDS,
  projectPersonalCompanyKeyStatistics,
} from "./personal-company-key-statistics";

export interface PersonalCompanyKeyStatisticsProps {
  readonly selection: PersonalMarketSelection | null;
  readonly annualFinancials: PersonalAnnualFinancialsDto | null;
  readonly annualErrorCode: PersonalWorkspaceApiErrorCode | null;
  readonly busy: boolean;
}

/** Projection and presentation only; annual loading stays with the shared company hook. */
export function PersonalCompanyKeyStatistics({
  selection,
  annualFinancials,
  annualErrorCode,
  busy,
}: PersonalCompanyKeyStatisticsProps) {
  const result = projectPersonalCompanyKeyStatistics({
    selection,
    financials: annualFinancials,
  });
  return (
    <section
      aria-busy={busy}
      aria-labelledby="personal-company-key-statistics-title"
      className="personal-company-key-statistics"
    >
      <div className="company-key-statistics-heading">
        <h3 id="personal-company-key-statistics-title">Key statistics</h3>
        <span>Annual business metrics</span>
      </div>
      {result.status === "ready" ? (
        <>
          {(busy || annualErrorCode !== null) && (
            <p role="status">
              Previously loaded annual statistics remain visible with their
              original dates.
            </p>
          )}
          {annualErrorCode !== null && (
            <p className="market-message market-message-error" role="alert">
              Annual refresh did not complete. {errorLabel(annualErrorCode)}
            </p>
          )}
          <p className="company-key-statistics-period">
            FY {result.fiscalYear} · Statement date{" "}
            <time dateTime={result.statementDate}>{result.statementDate}</time>
          </p>
          <dl className="company-key-statistics-grid">
            {PERSONAL_COMPANY_KEY_STATISTICS_FIELDS.map(([key, label]) => {
              const metric = result.metrics[key];
              return (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {metric.status === "available" ? (
                      metric.unit === "USD" ? (
                        formatPersonalFinancialUsd(metric.value)
                      ) : (
                        `${metric.value}%`
                      )
                    ) : (
                      <span className="company-key-statistics-unavailable">
                        Unavailable <small>{reasonLabel(metric.reason)}</small>
                      </span>
                    )}
                  </dd>
                  <dd>
                    <MetricDetails metric={metric} label={label} />
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="company-key-statistics-coverage">
            {result.availableMetricCount} of {result.metricCount} selected
            metrics available. Annual history: {result.returnedAnnualYears} of{" "}
            {result.requestedAnnualYears} fiscal years returned.
            {result.missingFiscalYears.length > 0
              ? ` ${String(result.missingFiscalYears.length)} fiscal years are missing.`
              : ""}
          </p>
          <p className="company-key-statistics-source">
            {result.attribution} annual statements, provider most recent.
            Requested at <time dateTime={result.asOf}>{result.asOf}</time>. Net
            debt is USD; other metrics are percentages. Annual formulas use
            half-up rounding to two decimal places; these are annual metrics,
            not TTM values.
          </p>
          <a href="#personal-annual-financials-title">
            View annual statements and formulas
          </a>
        </>
      ) : (
        <div className="company-key-statistics-unavailable">
          {selection === null ? (
            <p>Choose a company to view its annual key statistics.</p>
          ) : (
            <>
              <p aria-live="polite">
                {busy
                  ? "The company request is in progress. Annual statistics will appear when matching statements are available."
                  : result.reason === "not_loaded"
                    ? "Use Load company overview above to see annual key statistics."
                    : result.reason === "identity_mismatch"
                      ? "The loaded annual statements do not match this company. Load matching statements to view its statistics."
                      : "Annual statistics could not be calculated from the loaded statements."}
              </p>
              {annualErrorCode !== null && (
                <p className="market-message market-message-error" role="alert">
                  {errorLabel(annualErrorCode)}
                </p>
              )}
              <a href="#personal-annual-financials-title">
                View annual financials
              </a>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function MetricDetails({
  metric,
  label,
}: {
  readonly metric:
    | PersonalFinancialAnalyticsPeriodMetric
    | PersonalFinancialAnalyticsGrowthMetric;
  readonly label: string;
}) {
  return (
    <details className="company-key-statistics-details">
      <summary aria-label={`${label}: formula and sources`}>
        Formula and sources
      </summary>
      <p>
        {"fromFiscalYear" in metric
          ? metric.fromFiscalYear !== null && metric.toFiscalYear !== null
            ? `Fiscal-year comparison: FY ${String(metric.fromFiscalYear)} to FY ${String(metric.toFiscalYear)}.`
            : "Two annual periods are required for year-over-year growth."
          : `Annual period: FY ${String(metric.fiscalYear)}.`}
      </p>
      <p>
        <code>{metric.expression}</code>
      </p>
      <p>
        {metric.formulaId} · Formula version {metric.formulaVersion}
      </p>
      {metric.status === "unavailable" && (
        <p>
          Unavailable reason: {reasonLabel(metric.reason)} ({metric.reason}).
        </p>
      )}
      {metric.inputRefs.length === 0 ? (
        <p>No admitted input references.</p>
      ) : (
        <ul>
          {metric.inputRefs.map((reference, index) => (
            <li key={`${reference.sourceRef}:${String(index)}`}>
              <code>{reference.factKey}</code> ←{" "}
              <code>{reference.sourceRef}</code>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case "missing_input":
      return "Required annual input is missing.";
    case "zero_denominator":
      return "The denominator is zero.";
    case "insufficient_periods":
      return "A prior annual period is missing.";
    case "non_consecutive_fiscal_years":
      return "The available fiscal years are not consecutive.";
    case "nonpositive_prior":
      return "The prior-year value is zero or negative.";
    case "ambiguous_fact":
      return "The annual inputs are ambiguous.";
    case "invalid_decimal":
      return "An annual value could not be validated.";
    case "invalid_unit":
      return "An input unit could not be validated.";
    case "invalid_source_ref":
      return "An input source reference could not be validated.";
    default:
      return "The required annual inputs are unavailable.";
  }
}

function errorLabel(code: PersonalWorkspaceApiErrorCode): string {
  switch (code) {
    case "conflict":
      return "The company catalog changed. Re-select the company before loading annual statements.";
    case "not_entitled":
      return "Annual statements are not included for this account.";
    case "access_denied":
      return "Access to annual statements was refused.";
    case "not_covered":
      return "Annual statements are unavailable for this listing.";
    case "rate_limited":
      return "The provider rate limit was reached. Retry later.";
    case "credentials_invalid":
      return "The provider credential was rejected.";
    case "not_configured":
      return "Configure the provider before loading annual statements.";
    case "session_unavailable":
      return "Revalidate the local session before loading annual statements.";
    case "invalid_response":
      return "The annual response could not be validated.";
    default:
      return "The annual request did not complete. Retry from the company overview or Annual financials panel.";
  }
}
