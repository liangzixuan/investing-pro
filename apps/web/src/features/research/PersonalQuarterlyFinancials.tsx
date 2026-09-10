import type {
  PersonalMarketDataStatusDto,
  PersonalQuarterlyFinancialsDto,
} from "@research-cockpit/contracts";
import {
  PERSONAL_FINANCIAL_REPORTED_FIELDS,
  type PersonalFinancialStatementId,
  type PersonalQuarterlyCompatibilityIssueReason,
  type PersonalQuarterlyCompatibilityMetricKey,
} from "@research-cockpit/personal-financial-analytics";

import type { PersonalWorkspaceApiErrorCode } from "@/lib/personal-workspace-api";

import { assessLoadedPersonalQuarterlyFinancials } from "../../lib/personal-quarterly-compatibility";
import type { PersonalMarketSelection } from "./PersonalMarketOverview";

export interface PersonalQuarterlyFinancialsProps {
  readonly errorCode: PersonalWorkspaceApiErrorCode | null;
  readonly financials: PersonalQuarterlyFinancialsDto | null;
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

export function PersonalQuarterlyFinancials({
  errorCode,
  financials,
  onLoad,
  providerStatus,
  requestState,
  selection,
}: PersonalQuarterlyFinancialsProps) {
  const configured = providerStatus?.status === "configured";
  const explicitlyUnconfigured = providerStatus?.status === "not_configured";

  return (
    <section
      aria-busy={requestState === "loading"}
      aria-labelledby="personal-quarterly-financials-title"
      className="personal-financials-panel"
    >
      <div className="discovery-section-heading personal-financials-heading">
        <div>
          <p className="eyebrow">Recent company fundamentals</p>
          <h2 id="personal-quarterly-financials-title">Quarterly financials</h2>
        </div>
        <span>Up to 16 quarters · 30 reported fields</span>
      </div>

      <p className="market-scope-note">
        Inspect the latest fiscal quarters without replacing missing periods or
        cells. Statement dates and values come from the provider&apos;s
        most-recent corrected history and remain in active-session memory only.
      </p>

      {selection === null ? (
        <div className="discovery-empty-state market-empty-state">
          <strong>Choose a security to inspect quarterly statements.</strong>
          <span>
            Use “View market” in search results or My Watchlist, then request
            quarters for that exact admitted listing.
          </span>
        </div>
      ) : (
        <>
          {errorCode === null ? null : (
            <div className="market-message market-message-error" role="alert">
              <strong>{financialsErrorTitle(errorCode)}</strong>
              <span>{financialsErrorDetail(errorCode)}</span>
              <small>No reported value was substituted.</small>
            </div>
          )}

          <div className="market-load-state financials-load-state">
            <p aria-live="polite">
              {requestState === "loading"
                ? `Loading quarterly statements for ${selection.symbol}…`
                : financials !== null
                  ? `Quarterly statements loaded for ${selection.symbol}.`
                  : errorCode !== null
                    ? `The quarterly-statements request for ${selection.symbol} did not complete.`
                    : configured
                      ? `No quarterly fundamentals request has been made for ${selection.symbol}.`
                      : explicitlyUnconfigured
                        ? `Configure the owner-local Tiingo credential to load quarterly statements for ${selection.symbol}.`
                        : `Provider status is unavailable. Revalidate the owner session before loading quarterly statements for ${selection.symbol}.`}
            </p>
            <button
              className="primary-action compact-action"
              disabled={!configured || requestState === "loading"}
              onClick={onLoad}
              type="button"
            >
              {requestState === "loading"
                ? "Loading quarterly financials…"
                : financials !== null
                  ? "Refresh quarterly financials"
                  : errorCode === null
                    ? "Load quarterly financials"
                    : "Retry quarterly financials"}
            </button>
          </div>

          {financials === null ? null : (
            <QuarterlyFinancialsResult
              financials={financials}
              selection={selection}
            />
          )}
        </>
      )}
    </section>
  );
}

function QuarterlyFinancialsResult({
  financials,
  selection,
}: {
  readonly financials: PersonalQuarterlyFinancialsDto;
  readonly selection: PersonalMarketSelection;
}) {
  const latest = {
    fiscalQuarter: financials.coverage.latestFiscalQuarter,
    fiscalYear: financials.coverage.latestFiscalYear,
  };
  const displayPeriods = Array.from(
    { length: financials.coverage.requestedQuarterlyPeriods },
    (_, offset) => fiscalQuarterAtOffset(latest, offset),
  );
  const quartersByCoordinate = new Map(
    financials.quarters.map((quarter) => [quarterKey(quarter), quarter]),
  );

  return (
    <div className="personal-financials-result">
      <div className="financials-coverage-strip">
        <div>
          <span>Quarterly periods returned</span>
          <strong>
            {financials.coverage.returnedQuarterlyPeriods} /{" "}
            {financials.coverage.requestedQuarterlyPeriods}
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
          <span>Latest fiscal period</span>
          <strong>{quarterLabel(latest)}</strong>
        </div>
        <div>
          <span>Loaded</span>
          <strong>{formatInstant(financials.asOf)}</strong>
        </div>
      </div>

      {financials.coverage.missingFiscalQuarters.length === 0 ? null : (
        <p className="financials-missing-years" role="note">
          <strong>Missing fiscal quarters:</strong>{" "}
          {financials.coverage.missingFiscalQuarters
            .map(quarterLabel)
            .join(", ")}
          . These remain blank; later quarters are never shifted into their
          place.
        </p>
      )}

      <QuarterlyCompatibility financials={financials} selection={selection} />

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
                aria-label={`${statementLabels[statement]} quarterly financial statement table`}
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
                      {displayPeriods.map((coordinate) => {
                        const quarter = quartersByCoordinate.get(
                          quarterKey(coordinate),
                        );
                        return (
                          <th scope="col" key={quarterKey(coordinate)}>
                            <span>{quarterLabel(coordinate)}</span>
                            <small>
                              {quarter === undefined
                                ? "Not returned"
                                : `Statement date ${formatDate(quarter.statementDate)}`}
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
                        {displayPeriods.map((coordinate) => {
                          const quarter = quartersByCoordinate.get(
                            quarterKey(coordinate),
                          );
                          const cell = quarter?.reported[field.fieldKey];
                          return (
                            <td key={quarterKey(coordinate)}>
                              {cell?.status === "known" ? (
                                <span title={`${cell.value} USD`}>
                                  {formatUsdExact(cell.value)}
                                </span>
                              ) : (
                                <span
                                  aria-label={
                                    quarter === undefined
                                      ? `${quarterLabel(coordinate)} not returned`
                                      : `${field.label} unknown for ${quarterLabel(coordinate)}`
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

      <p className="market-attribution">
        Data attribution: {financials.provider.attribution}. Values are USD and
        use the provider&apos;s most-recent corrected history, not a
        point-in-time backtest view. Export and redistribution are prohibited.
      </p>
    </div>
  );
}

const compatibilityMetricLabels = {
  revenue: "Revenue",
  net_income: "Net income",
} as const satisfies Readonly<
  Record<PersonalQuarterlyCompatibilityMetricKey, string>
>;

const compatibilityIssueLabels = {
  period_evidence_missing:
    "Actual period start/end dates and whether each value is a standalone quarter or a cumulative year-to-date amount.",
  fiscal_calendar_evidence_missing:
    "A verified fiscal calendar, including the fiscal-year start and how quarters are defined.",
  unit_evidence_missing:
    "Per-value currency, unit and scale evidence; the feed's USD label alone does not verify each observation.",
  scope_evidence_missing:
    "Consistent issuer and consolidated reporting scope for the contributing values.",
  concept_evidence_missing:
    "Consistent accounting definitions and sign conventions for each metric.",
  source_revision_evidence_missing:
    "Source references and compatible revisions for the contributing values.",
  missing_fiscal_slot: "An expected fiscal quarter was not returned.",
  unknown_value: "A reported value is unknown.",
  unsupported_period_basis:
    "A standalone-quarter basis is required; cumulative, annual and balance-date values cannot be added as quarters.",
  unsupported_fiscal_calendar:
    "This fiscal calendar needs a separately verified period policy.",
  period_calendar_mismatch:
    "The reported dates do not match the declared fiscal quarter.",
  fiscal_calendar_mismatch:
    "The contributing values use incompatible fiscal calendars.",
  noncontiguous_periods:
    "The reporting periods overlap or leave a gap between their dates.",
  unsupported_unit:
    "The contributing values need a supported, consistent USD unit and scale.",
  issuer_mismatch: "The evidence does not match the selected issuer.",
  unsupported_scope:
    "The reporting scope is not supported for this consolidated comparison.",
  unsupported_sign_convention:
    "The accounting sign convention needs verification.",
  concept_mismatch:
    "The contributing values use incompatible accounting definitions.",
  mixed_sources:
    "The contributing values use different sources that have not been reconciled.",
  revision_set_mismatch:
    "The contributing values do not share a compatible revision set.",
} as const satisfies Readonly<
  Record<PersonalQuarterlyCompatibilityIssueReason, string>
>;

function QuarterlyCompatibility({
  financials,
  selection,
}: {
  readonly financials: PersonalQuarterlyFinancialsDto;
  readonly selection: PersonalMarketSelection;
}) {
  const assessment = assessLoadedPersonalQuarterlyFinancials(
    financials,
    selection,
  );

  if (assessment.status === "quarantined") {
    return (
      <section
        aria-labelledby="quarterly-ttm-compatibility-title"
        className="financials-ttm-gate"
      >
        <h3 id="quarterly-ttm-compatibility-title">
          Trailing 12 months is not calculated yet.
        </h3>
        <strong>Quarterly compatibility could not be assessed.</strong>
        <p>
          The loaded response could not be validated for this selection. Refresh
          the quarterly statements before checking compatibility again.
        </p>
      </section>
    );
  }

  const evidenceReasons = Array.from(
    new Set(
      assessment.metrics.flatMap((metric) =>
        metric.issues
          .map((issue) => issue.reason)
          .filter(
            (reason) =>
              reason !== "missing_fiscal_slot" && reason !== "unknown_value",
          ),
      ),
    ),
  );

  return (
    <section
      aria-labelledby="quarterly-ttm-compatibility-title"
      className="financials-ttm-gate"
    >
      <h3 id="quarterly-ttm-compatibility-title">
        Trailing 12 months is not calculated yet.
      </h3>
      <p>
        Revenue and net income are checked against the latest four expected
        fiscal quarters. Known reported values alone do not establish a
        compatible twelve-month period.
      </p>

      <div className="financials-ttm-metrics">
        {assessment.metrics.map((metric) => {
          const label = compatibilityMetricLabels[metric.metric];
          const missing = metric.periods.filter(
            (period) => period.status === "missing",
          );
          const unknown = metric.periods.filter(
            (period) => period.status === "unknown",
          );
          return (
            <section
              aria-label={`${label} TTM compatibility`}
              className="financials-ttm-metric"
              key={metric.metric}
            >
              <h4>{label}</h4>
              <span className="financials-ttm-status">TTM unavailable</span>
              <p>
                <strong>{metric.knownValues} of 4</strong> reported values known
              </p>
              {missing.length === 0 ? null : (
                <p>Not returned: {missing.map(quarterLabel).join(", ")}.</p>
              )}
              {unknown.length === 0 ? null : (
                <p>Value unknown: {unknown.map(quarterLabel).join(", ")}.</p>
              )}
              {metric.status === "compatible_inputs" ? (
                <p>
                  Input checks passed; source verification is still required.
                </p>
              ) : missing.length === 0 && unknown.length === 0 ? (
                <p>
                  All four values are present; compatibility evidence is
                  incomplete.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>

      {evidenceReasons.length === 0 ? null : (
        <div className="financials-ttm-evidence">
          <h4>Evidence still needed</h4>
          <p>The loaded data does not establish all of the following:</p>
          <ul>
            {evidenceReasons.map((reason) => (
              <li key={reason}>{compatibilityIssueLabels[reason]}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="financials-ttm-details">
        <summary>Inspect the four fiscal quarters</summary>
        <ul className="financials-ttm-slot-list">
          {assessment.slots.map((slot) => (
            <li key={quarterKey(slot)}>
              <strong>{quarterLabel(slot)}</strong>
              {assessment.metrics.map((metric) => {
                const period = metric.periods.find(
                  (candidate) => quarterKey(candidate) === quarterKey(slot),
                );
                return (
                  <span key={metric.metric}>
                    {compatibilityMetricLabels[metric.metric]}:{" "}
                    {period?.status === "known"
                      ? "reported value known"
                      : period?.status === "unknown"
                        ? "value unknown"
                        : "quarter not returned"}
                    {period?.statementDate === null || period === undefined
                      ? ""
                      : ` · Statement date ${formatDate(period.statementDate)}`}
                  </span>
                );
              })}
            </li>
          ))}
        </ul>
      </details>

      <p>
        Statement dates are provider release dates. A source with compatible
        period evidence must be verified before TTM aggregation. The reported
        statements below remain available.
      </p>
    </section>
  );
}

function quarterKey(coordinate: {
  readonly fiscalQuarter: number;
  readonly fiscalYear: number;
}) {
  return `${String(coordinate.fiscalYear)}-Q${String(coordinate.fiscalQuarter)}`;
}

function quarterLabel(coordinate: {
  readonly fiscalQuarter: number;
  readonly fiscalYear: number;
}) {
  return `FY ${String(coordinate.fiscalYear)} Q${String(coordinate.fiscalQuarter)}`;
}

function fiscalQuarterAtOffset(
  latest: Readonly<{ fiscalQuarter: number; fiscalYear: number }>,
  offset: number,
) {
  const ordinal = latest.fiscalYear * 4 + latest.fiscalQuarter - 1 - offset;
  return {
    fiscalQuarter: (ordinal % 4) + 1,
    fiscalYear: Math.floor(ordinal / 4),
  };
}

function financialsErrorTitle(code: PersonalWorkspaceApiErrorCode): string {
  switch (code) {
    case "not_entitled":
      return "Quarterly financials are not included for this account.";
    case "not_covered":
      return "Quarterly financials are not available for this listing.";
    case "credentials_invalid":
      return "The provider credential was rejected.";
    case "rate_limited":
      return "The provider rate limit was reached.";
    case "not_configured":
      return "The provider is not configured.";
    case "provider_unavailable":
      return "The fundamentals provider is unavailable.";
    default:
      return "Quarterly financials could not be loaded.";
  }
}

function financialsErrorDetail(code: PersonalWorkspaceApiErrorCode): string {
  switch (code) {
    case "not_entitled":
      return "The price feed can still work. This separate fundamentals feed requires an eligible evaluation symbol or fundamentals entitlement.";
    case "not_covered":
      return "The admitted listing has no quarterly statement response in the configured fundamentals feed.";
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

function formatUsdExact(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${negative ? "−" : ""}$${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
}

function formatInstant(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
