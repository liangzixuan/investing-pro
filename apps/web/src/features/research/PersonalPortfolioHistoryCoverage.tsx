"use client";

import type {
  PersonalMarketDataRangeDto,
  PersonalMarketOverviewDto,
  PersonalPortfolioIdentity,
  PersonalPortfolioLedgerPayload,
} from "@research-cockpit/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  assessPortfolioHistory,
  type PortfolioHistoryAssessment,
} from "@/lib/personal-portfolio-history";
import {
  calculatePersonalPortfolioValuationHistory,
  getPersonalPortfolioValuationWindow,
} from "@/lib/personal-portfolio-valuation-history";
import { PersonalPortfolioValuationHistory } from "./PersonalPortfolioValuationHistory";
import {
  fetchPersonalMarketOverview,
  PersonalWorkspaceApiError,
  searchPersonalSecurities,
} from "@/lib/personal-workspace-api";

export interface PersonalPortfolioHistoryCoverageProps {
  readonly ledger: PersonalPortfolioLedgerPayload;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly ledgerContext: string;
  readonly disabled: boolean;
  readonly priorSplitReviewDates?: Readonly<Record<string, readonly string[]>>;
  readonly onSessionUnavailable: () => void;
  readonly onAssessment: (
    context: string,
    listingId: string,
    requiresReview: boolean,
    assessment: PortfolioHistoryAssessment,
  ) => void;
}
type Observation = Readonly<{
  identity: PersonalPortfolioIdentity;
  assessment: PortfolioHistoryAssessment | null;
  message: string;
  history: PersonalMarketOverviewDto["history"] | null;
}>;

export function PersonalPortfolioHistoryCoverage({
  ledger,
  catalogSnapshotSha256,
  ledgerContext,
  disabled,
  priorSplitReviewDates,
  onSessionUnavailable,
  onAssessment,
}: PersonalPortfolioHistoryCoverageProps) {
  const [range, setRange] = useState<PersonalMarketDataRangeDto>("1y");
  const [rows, setRows] = useState<readonly Observation[]>([]);
  const [limits, setLimits] = useState<Readonly<Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [window, setWindow] = useState<Readonly<{
    context: string;
    startDate: string;
    endDate: string;
  }> | null>(null);
  const [message, setMessage] = useState(
    "History has not been checked for this ledger.",
  );
  const request = useRef<AbortController | null>(null);
  const stale = ledger.snapshotSha256 !== catalogSnapshotSha256;
  const context = JSON.stringify([
    ledgerContext,
    catalogSnapshotSha256,
    disabled,
    range,
  ]);
  const liveContext = useRef(context);
  liveContext.current = context;
  const callbacks = useRef({ onSessionUnavailable, onAssessment });
  callbacks.current = { onSessionUnavailable, onAssessment };

  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setRows([]);
    setLimits({});
    setLoading(false);
    setWindow(null);
    setMessage("History has not been checked for this ledger and range.");
    return () => {
      request.current?.abort();
    };
  }, [context]);

  async function review() {
    if (
      disabled ||
      loading ||
      liveContext.current !== context ||
      ledger.snapshotSha256 !== catalogSnapshotSha256
    )
      return;
    request.current?.abort();
    const active = new AbortController();
    const requestedWindow = getPersonalPortfolioValuationWindow(
      range,
      new Date().toISOString().slice(0, 10),
    );
    if (requestedWindow === null) return;
    request.current = active;
    const capturedContext = context;
    const current = () =>
      request.current === active &&
      !active.signal.aborted &&
      liveContext.current === capturedContext;
    setLoading(true);
    setRows([]);
    setLimits({});
    setWindow({ context, ...requestedWindow });
    const observed: Observation[] = [];
    let stopped = false;
    for (const [index, identity] of ledger.identities.entries()) {
      if (!current()) return;
      setMessage(
        `Checking history for ${identity.symbol} (${String(index + 1)} of ${String(ledger.identities.length)})…`,
      );
      try {
        const admitted = await searchPersonalSecurities(
          identity.symbol,
          active.signal,
          25,
        );
        if (!current()) return;
        if (admitted.snapshot.snapshotSha256 !== catalogSnapshotSha256)
          throw new PersonalWorkspaceApiError("conflict");
        if (
          !admitted.results.some((candidate) =>
            sameIdentity(identity, candidate),
          )
        ) {
          observed.push({
            identity,
            assessment: null,
            history: null,
            message:
              "Historical identity is unavailable in the current catalog; history was not requested.",
          });
        } else {
          const market = await fetchPersonalMarketOverview(
            { listingId: identity.listingId, symbol: identity.symbol, range },
            active.signal,
          );
          if (!current()) return;
          const security = market.security;
          if (
            security.listingId !== identity.listingId ||
            security.symbol !== identity.symbol ||
            security.exchangeMic !== identity.exchangeMic ||
            security.country !== identity.country ||
            security.issuerName !== identity.issuerName ||
            security.securityName !== identity.securityName
          )
            throw new PersonalWorkspaceApiError("invalid_response");
          const assessment = assessPortfolioHistory(
            ledger,
            identity.listingId,
            market.history,
          );
          if (assessment === null)
            throw new PersonalWorkspaceApiError("invalid_response");
          observed.push({
            identity,
            assessment,
            history: market.history,
            message: assessment.requiresSplitReview
              ? "Review split differences before using current share-based totals."
              : "No split discrepancy found in these observations; unobserved dates remain unchecked.",
          });
          callbacks.current.onAssessment(
            ledgerContext,
            identity.listingId,
            assessment.requiresSplitReview,
            assessment,
          );
        }
      } catch (error) {
        if (!current()) return;
        const code =
          error instanceof PersonalWorkspaceApiError
            ? error.code
            : "unavailable";
        if (code === "session_unavailable") {
          active.abort();
          setRows([]);
          setWindow(null);
          setLoading(false);
          setMessage(
            "Owner session expired. Revalidate it before checking history.",
          );
          callbacks.current.onSessionUnavailable();
          return;
        }
        const stop = [
          "conflict",
          "rate_limited",
          "not_configured",
          "credentials_invalid",
          "not_entitled",
        ].includes(code);
        const explanation =
          code === "conflict"
            ? "Catalog changed. Reconcile portfolio identities before checking history again."
            : code === "rate_limited"
              ? "Tiingo rate limited the review. Remaining listings were not requested."
              : [
                    "not_configured",
                    "credentials_invalid",
                    "not_entitled",
                  ].includes(code)
                ? "Tiingo configuration or access needs attention. Remaining listings were not requested."
                : "History unavailable for this listing; its dates and actions remain unchecked.";
        observed.push({
          identity,
          assessment: null,
          history: null,
          message: explanation,
        });
        if (stop) {
          stopped = true;
          setMessage(explanation);
        }
      }
      if (!current()) return;
      setRows([...observed]);
      if (stopped) break;
    }
    if (current()) {
      request.current = null;
      setLoading(false);
      if (!stopped)
        setMessage(
          "History review finished. Observations describe this requested window only.",
        );
    }
  }

  const showReview = !disabled && !stale && window?.context === context;
  const valuation = useMemo(() => {
    if (disabled || stale || window === null || window.context !== context)
      return null;
    return calculatePersonalPortfolioValuationHistory({
      ledger,
      startDate: window.startDate,
      endDate: window.endDate,
      histories: rows.flatMap((row) =>
        row.history === null
          ? []
          : [{ identity: row.identity, history: row.history }],
      ),
      ...(priorSplitReviewDates === undefined ? {} : { priorSplitReviewDates }),
    });
  }, [ledger, rows, window, context, disabled, stale, priorSplitReviewDates]);

  return (
    <section
      className="portfolio-history"
      aria-label="Portfolio history review"
    >
      <h3>History and corporate-action review</h3>
      <p>
        Check Tiingo EOD observations for the ledger’s registered listings,
        including closed positions. The same observations value recorded
        end-of-day holdings and cash, with eligible period returns and
        cash-flow-adjusted estimates. Linked returns also require complete
        values on every cash-flow date, using an end-of-day flow convention.
        This does not prove every trading day is covered.
      </p>
      <div className="portfolio-history-controls">
        <label>
          History window
          <select
            aria-label="Portfolio history window"
            value={range}
            disabled={disabled || loading}
            onChange={(event) =>
              setRange(event.target.value as PersonalMarketDataRangeDto)
            }
          >
            <option value="1m">1 month</option>
            <option value="3m">3 months</option>
            <option value="ytd">Year to date</option>
            <option value="1y">1 year</option>
            <option value="5y">5 years</option>
            <option value="10y">10 years</option>
          </select>
        </label>
        <button
          type="button"
          className="secondary-action compact-action"
          disabled={disabled || stale || loading}
          onClick={() => {
            void review();
          }}
        >
          Review history
        </button>
        {loading && (
          <button
            type="button"
            className="secondary-action compact-action"
            onClick={() => {
              if (liveContext.current !== context) return;
              request.current?.abort();
              request.current = null;
              setLoading(false);
              setMessage(
                "History review cancelled. Displayed observations and any known split warnings remain valid only for this ledger.",
              );
            }}
          >
            Cancel history review
          </button>
        )}
      </div>
      <p role="status">{message}</p>
      {stale && (
        <p>
          Reconcile portfolio identities with the current catalog before
          reviewing history.
        </p>
      )}
      {valuation !== null && (
        <PersonalPortfolioValuationHistory result={valuation} />
      )}
      {showReview &&
        rows.map(({ identity, assessment, message: rowMessage }) => (
          <article
            key={identity.listingId}
            className="portfolio-history-listing"
          >
            <h4>
              {identity.symbol} · {identity.exchangeMic}
            </h4>
            <p>{rowMessage}</p>
            {assessment && (
              <>
                <p>
                  {assessment.observationCount} daily observations ·{" "}
                  {assessment.firstObservedDate ?? "none"} to{" "}
                  {assessment.lastObservedDate ?? "none"}. Opening date{" "}
                  {ledger.opening.asOfDate}:{" "}
                  {assessment.openingDateObserved
                    ? "observed"
                    : "no exact observation"}
                  . Activity dates observed:{" "}
                  {assessment.observedActivityDateCount} of{" "}
                  {assessment.activityDateCount}.
                </p>
                {assessment.manualSplitsOutsideWindow > 0 && (
                  <p>
                    {assessment.manualSplitsOutsideWindow} recorded splits fall
                    outside the requested window and were not compared.
                  </p>
                )}
                {assessment.actions.length > 0 && (
                  <div
                    className="portfolio-history-table-scroll"
                    tabIndex={0}
                    aria-label={`Corporate-action observations for ${identity.symbol}`}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Split factor / recorded ratio</th>
                          <th>Dividend per share</th>
                          <th>Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assessment.actions
                          .slice(0, limits[identity.listingId] ?? 50)
                          .map((action) => (
                            <tr key={action.date}>
                              <td>{action.date}</td>
                              <td>
                                {action.providerFactor ?? "Not observed"} /{" "}
                                {action.recordedRatio ?? "None"}
                              </td>
                              <td>
                                {action.dividendCash === null
                                  ? "—"
                                  : `${action.dividendCash} USD`}
                              </td>
                              <td>{statusLabel(action.status)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {assessment.actions.length >
                  (limits[identity.listingId] ?? 50) && (
                  <button
                    type="button"
                    className="secondary-action compact-action"
                    onClick={() =>
                      setLimits((prior) => ({
                        ...prior,
                        [identity.listingId]:
                          (prior[identity.listingId] ?? 50) + 50,
                      }))
                    }
                  >
                    Show more actions for {identity.symbol}
                  </button>
                )}
              </>
            )}
          </article>
        ))}
      <p className="portfolio-history-note">
        Split factors are new shares per old share on the provider’s ex-date.
        Compare broker or issuer records and enter split terms manually; this
        review never adds ledger entries. Rounded provider factors can differ
        from exact ratios. Dividend observations are ex-date amounts per share,
        not cash received. Opening balances already include actions through
        their end-of-day date. Missing dates are not filled or inferred.
      </p>
      <p className="portfolio-history-note">
        Detailed Tiingo observations stay in active session memory and are
        cleared when the ledger, range or session changes. They are not saved or
        exported. Known split warnings persist in this session until reviewed.
        Adjusted history is not a point-in-time portfolio record.
      </p>
    </section>
  );
}

function sameIdentity(
  left: PersonalPortfolioIdentity,
  right: PersonalPortfolioIdentity,
) {
  return (
    [
      "country",
      "exchangeMic",
      "instrumentType",
      "issuerId",
      "issuerName",
      "listingId",
      "securityId",
      "securityName",
      "shareClassId",
      "shareClassName",
      "symbol",
    ] as const
  ).every((key) => left[key] === right[key]);
}
function statusLabel(
  status: NonNullable<PortfolioHistoryAssessment>["actions"][number]["status"],
) {
  return {
    matched: "Recorded ratio matches",
    review_difference: "Review differing ratios",
    unrecorded: "Review unrecorded split",
    no_prior_position: "No prior-day shares recorded",
    no_observation: "No exact-date observation",
    dividend_observation: "Dividend observation only",
  }[status];
}
