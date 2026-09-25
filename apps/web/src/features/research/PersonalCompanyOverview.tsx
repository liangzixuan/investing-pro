import type {
  PersonalAnnualFinancialsDto,
  PersonalMarketOverviewDto,
} from "@research-cockpit/contracts";

import { getPersonalMarketHistory } from "../../lib/personal-market-snapshot";
import type { PersonalWorkspaceApiErrorCode } from "@/lib/personal-workspace-api";

import type { PersonalMarketSelection } from "./PersonalMarketOverview";
import { formatPersonalFinancialUsd } from "./personal-annual-financial-analytics";
import {
  PERSONAL_COMPANY_OVERVIEW_FIELDS,
  projectPersonalCompanyOverview,
} from "./personal-company-overview";

export interface PersonalCompanyOverviewProps {
  readonly selection: PersonalMarketSelection | null;
  readonly marketOverview: PersonalMarketOverviewDto | null;
  readonly annualFinancials: PersonalAnnualFinancialsDto | null;
  readonly marketErrorCode: PersonalWorkspaceApiErrorCode | null;
  readonly annualErrorCode: PersonalWorkspaceApiErrorCode | null;
  readonly busy: boolean;
  readonly activeDomain: "price" | "annual" | null;
  readonly action: "load" | "retry" | "refresh";
  readonly canLoad: boolean;
  readonly deferralMessage: string | null;
  readonly onLoad: () => void;
}

const identityFields = [
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;

/** Presentation only; the shared company hook owns requests and their lifetime. */
export function PersonalCompanyOverview({
  selection,
  marketOverview,
  annualFinancials,
  marketErrorCode,
  annualErrorCode,
  busy,
  activeDomain,
  action,
  canLoad,
  deferralMessage,
  onLoad,
}: PersonalCompanyOverviewProps) {
  const annual = projectPersonalCompanyOverview({
    selection,
    financials: annualFinancials,
  });
  const matchingMarket =
    selection !== null &&
    marketOverview !== null &&
    identityFields.every(
      (field) => selection[field] === marketOverview.security[field],
    );
  const history = getPersonalMarketHistory(
    matchingMarket ? marketOverview : null,
  );
  const latestBar = history?.bars.at(-1);
  const hasHistory = latestBar !== undefined;
  const hasAnnual = annual.status === "ready";
  const status = busy
    ? activeDomain === "annual"
      ? "Loading annual financials…"
      : activeDomain === "price"
        ? "Loading price history…"
        : "Loading company overview…"
    : hasHistory && hasAnnual
      ? "Price history and annual financials are available."
      : hasHistory
        ? "Price history is available. Annual financials are not loaded."
        : hasAnnual
          ? "Annual financials are available. Price history is not loaded."
          : "Load price history and annual financials for this company when you need them.";

  return (
    <section
      aria-busy={busy}
      aria-labelledby="personal-company-overview-title"
      className="personal-company-overview"
    >
      <div className="company-overview-heading">
        <h3 id="personal-company-overview-title">Company overview</h3>
        {selection !== null && (
          <div className="company-overview-actions">
            <button
              className="primary-action compact-action"
              disabled={busy || !canLoad}
              onClick={() => {
                if (!busy && canLoad) onLoad();
              }}
              type="button"
            >
              {busy
                ? "Loading company overview…"
                : action === "refresh"
                  ? "Refresh company overview"
                  : action === "retry"
                    ? "Retry company overview"
                    : "Load company overview"}
            </button>
          </div>
        )}
      </div>
      {selection === null ? (
        <p>Choose a company to view its overview.</p>
      ) : (
        <>
          <p aria-live="polite" className="company-overview-status">
            {status}
          </p>
          {!busy && deferralMessage !== null && (
            <p role="status" className="company-overview-deferral">
              {deferralMessage}
            </p>
          )}
          {!busy && !canLoad && deferralMessage === null && (
            <p className="company-overview-deferral">
              Overview loading is currently unavailable.
            </p>
          )}
          <div className="company-overview-domains">
            <div className="company-overview-price">
              {marketErrorCode !== null && (
                <p className="market-message market-message-error" role="alert">
                  Price history: {feedError(marketErrorCode)}
                </p>
              )}
              {hasHistory && latestBar !== undefined ? (
                <>
                  {(busy || marketErrorCode !== null) && (
                    <p className="company-overview-retained">
                      Previous price history remains visible with its original
                      dates.
                    </p>
                  )}
                  <p>
                    Price source bar date:{" "}
                    <time dateTime={latestBar.date}>{latestBar.date}</time>.
                  </p>
                  <a href="#personal-market-overview">View price history</a>
                </>
              ) : matchingMarket ? (
                <p>Price history is unavailable. No price was substituted.</p>
              ) : marketOverview !== null ? (
                <p>The loaded price history does not match this company.</p>
              ) : null}
            </div>
            <div className="company-overview-annual">
              <h4>Annual business figures</h4>
              {annualErrorCode !== null && (
                <p className="market-message market-message-error" role="alert">
                  Annual financials: {feedError(annualErrorCode)}
                </p>
              )}
              {annual.status === "ready" ? (
                <>
                  {(busy || annualErrorCode !== null) && (
                    <p className="company-overview-retained">
                      Previous annual figures remain visible with their original
                      dates.
                    </p>
                  )}
                  <p className="company-overview-period">
                    FY {annual.fiscalYear} · Statement date{" "}
                    <time dateTime={annual.statementDate}>
                      {annual.statementDate}
                    </time>
                  </p>
                  <dl className="company-overview-values">
                    {PERSONAL_COMPANY_OVERVIEW_FIELDS.map(([key, label]) => {
                      const cell = annual.cells[key];
                      return (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd>
                            {cell.status === "known" ? (
                              <span title={`${cell.value} USD`}>
                                {formatPersonalFinancialUsd(cell.value)}
                              </span>
                            ) : (
                              <span className="financial-cell-unknown">
                                Unknown <small>Not supplied by provider</small>
                              </span>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  <p className="company-overview-coverage">
                    {annual.knownFieldCount} of {annual.fieldCount} overview
                    fields known for FY {annual.fiscalYear}.
                  </p>
                  <p className="company-overview-history-coverage">
                    Annual history: {annual.returnedAnnualYears} of{" "}
                    {annual.requestedAnnualYears} fiscal years returned.
                    {annual.missingFiscalYears.length > 0 &&
                      ` ${String(annual.missingFiscalYears.length)} fiscal years are missing.`}
                  </p>
                  <p className="company-overview-source">
                    {annual.attribution} annual statements · USD · Provider most
                    recent. Retrieved{" "}
                    <time dateTime={annual.asOf}>{annual.asOf}</time>. These
                    annual figures are not TTM or SEC-verified.
                  </p>
                  <a href="#personal-annual-financials-title">
                    View annual statements and coverage
                  </a>
                </>
              ) : annual.reason === "not_loaded" ? (
                <p>Load the overview to see annual business figures.</p>
              ) : (
                <p className="market-message market-message-error" role="alert">
                  {annual.reason === "identity_mismatch"
                    ? "The loaded annual financials do not match this company."
                    : "The annual input did not pass validation. No summary values were substituted."}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function feedError(code: PersonalWorkspaceApiErrorCode): string {
  switch (code) {
    case "conflict":
      return "The company catalog changed. Reload the workspace before loading again.";
    case "not_entitled":
      return "This feed is not included for this account.";
    case "access_denied":
      return "The provider denied access.";
    case "credentials_invalid":
      return "The provider credential was rejected.";
    case "rate_limited":
      return "The provider rate limit was reached.";
    case "not_configured":
      return "The provider is not configured.";
    case "not_covered":
      return "This feed has no data for this listing.";
    case "session_unavailable":
      return "Revalidate the local session before loading.";
    case "invalid_response":
      return "The response could not be validated.";
    case "provider_unavailable":
      return "The provider is unavailable. Retry later.";
    default:
      return "The request did not complete.";
  }
}
