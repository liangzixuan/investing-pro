import { useId, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import {
  FILINGS_REVIEW_LIMIT,
  type ManagedFilingsReview as ReviewModel,
  type ManagedFilingsReviewCapture,
} from "./managed-filings-review";
import {
  FilingsPacketSource,
  FilingsPacketSummary,
} from "./ManagedFilingsPacket";
import { ManagedFilingsRefreshComparisonDetails } from "./ManagedFilingsRefreshComparisonDetails";

export function ManagedFilingsReview({
  model,
  active,
  onView,
}: {
  model: ReviewModel;
  active: boolean;
  onView: (
    capture: ManagedFilingsReviewCapture,
    opener: HTMLButtonElement,
  ) => void;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const heading = useId();
  const action = { model, state, active };
  const committed = useRef<typeof action | null>(null);
  const loadButton = useRef<HTMLButtonElement | null>(null);
  const restoreLoad = useRef<{
    member: symbol;
    control: HTMLButtonElement;
  } | null>(null);
  const groupHeading = useRef<HTMLHeadingElement | null>(null);
  const companyHeading = useRef<HTMLHeadingElement | null>(null);
  const transitionFocus = useRef<{
    control: HTMLButtonElement;
    target: "group" | "company";
    member: symbol | null;
  } | null>(null);
  const selected = state.rows.find((row) => row.member === state.selected);
  const filings = selected?.filings;
  const response = filings?.response;
  const capture =
    selected && response ? { member: selected.member, response } : null;
  const enabled = active && state.active;
  const canLoad =
    enabled &&
    state.canRead &&
    filings?.supported &&
    !filings.running &&
    !state.catalogChanged;
  const current = () =>
    committed.current === action && enabled && model.getSnapshot() === state;
  useLayoutEffect(() => {
    committed.current = action;
    return () => {
      committed.current = null;
    };
  });
  useLayoutEffect(() => {
    const request = restoreLoad.current;
    if (!request || filings?.running) return;
    restoreLoad.current = null;
    const button = loadButton.current;
    if (
      enabled &&
      selected?.member.handle === request.member &&
      (document.activeElement === request.control ||
        document.activeElement === document.body) &&
      button?.isConnected &&
      !button.disabled &&
      button.getClientRects().length
    )
      button.focus();
  }, [enabled, filings?.running, selected?.member]);
  useLayoutEffect(() => {
    const request = transitionFocus.current;
    transitionFocus.current = null;
    if (
      !request ||
      !enabled ||
      (document.activeElement !== request.control &&
        document.activeElement !== document.body)
    )
      return;
    const target =
      request.target === "group"
        ? state.rows.length === 0
          ? groupHeading.current
          : null
        : selected?.member.handle === request.member
          ? companyHeading.current
          : null;
    if (target?.isConnected && target.getClientRects().length) target.focus();
  }, [enabled, state.rows, selected?.member]);

  return (
    <details className="managed-filings-review">
      <summary>Review a group of watchlist companies</summary>
      <section aria-labelledby={heading} aria-busy={filings?.running ?? false}>
        <h3 id={heading} ref={groupHeading} tabIndex={-1}>
          Watchlist filing review
        </h3>
        <p>
          Choose up to {FILINGS_REVIEW_LIMIT} listings. Check one company at a
          time, then inspect its filings and write a cited note in company
          research. Each check uses the last 90 UTC dates.
        </p>
        {!state.rows.length ? (
          <>
            <fieldset disabled={!enabled || state.catalogChanged}>
              <legend>Companies for this review</legend>
              {!state.memberships.length && (
                <p>
                  Load a watchlist with current catalog identities to choose
                  companies.
                </p>
              )}
              {state.memberships.map((member) => (
                <label
                  className="managed-filings-review-choice"
                  key={member.listing.listingId}
                >
                  <input
                    type="checkbox"
                    checked={state.chosen.includes(member)}
                    disabled={
                      !state.chosen.includes(member) &&
                      state.chosen.length >= FILINGS_REVIEW_LIMIT
                    }
                    onChange={() => {
                      if (current()) model.choose(state, member);
                    }}
                  />
                  <span>
                    {member.listing.symbol} · {member.listing.issuerName} ·{" "}
                    {member.listing.shareClassName} ·{" "}
                    {member.listing.exchangeMic}
                  </span>
                </label>
              ))}
            </fieldset>
            <p>
              {state.chosen.length} of {FILINGS_REVIEW_LIMIT} selected. Source
              eligibility is shown before Load.
            </p>
            <button
              type="button"
              disabled={
                !enabled || !state.chosen.length || state.catalogChanged
              }
              onClick={(event) => {
                if (!current()) return;
                if (document.activeElement === event.currentTarget)
                  transitionFocus.current = {
                    control: event.currentTarget,
                    target: "company",
                    member: state.chosen[0]?.handle ?? null,
                  };
                model.start(state);
              }}
            >
              Start filing review
            </button>
          </>
        ) : (
          <>
            <p>
              {state.rows.filter((row) => row.filings.response !== null).length}{" "}
              of {state.rows.length} responses retained. Each response keeps its
              own dates and source limits.
            </p>
            <ol
              className="managed-filings-review-companies"
              aria-label="Companies in this filing review"
            >
              {state.rows.map((row) => (
                <li key={row.member.listing.listingId}>
                  <button
                    type="button"
                    className="trial-secondary"
                    disabled={!enabled || state.catalogChanged}
                    aria-current={
                      row.member === state.selected ? "true" : undefined
                    }
                    onClick={() => {
                      if (current()) model.select(state, row.member);
                    }}
                  >
                    {row.member.listing.symbol} ·{" "}
                    {row.member.listing.shareClassName} ·{" "}
                    {row.member.listing.exchangeMic}
                    <span>
                      {row.filings.running
                        ? "Check in progress"
                        : row.filings.response
                          ? `${row.filings.showingPrevious ? "Previous response · " : ""}${row.filings.response.issuer.status === "available" ? `${row.filings.response.issuer.filings.length} filings in retained response` : `Source result: ${row.filings.response.issuer.status.replaceAll("_", " ")}`}`
                          : row.filings.supported
                            ? "No response loaded"
                            : "Source not supported"}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {selected && (
              <section
                className="managed-watchlist-filings"
                aria-label={`Filing review for ${selected.member.listing.symbol}`}
              >
                <h4 ref={companyHeading} tabIndex={-1}>
                  {selected.member.listing.symbol} ·{" "}
                  {selected.member.listing.issuerName} ·{" "}
                  {selected.member.listing.shareClassName} ·{" "}
                  {selected.member.listing.exchangeMic}
                </h4>
                <div className="trial-actions">
                  <button
                    type="button"
                    ref={loadButton}
                    disabled={!canLoad}
                    onClick={() => {
                      if (current()) void model.load(state);
                    }}
                  >
                    {filings?.running
                      ? "Loading filings…"
                      : response
                        ? "Refresh review filings"
                        : "Load review filings"}
                  </button>
                  <button
                    type="button"
                    className="trial-secondary"
                    disabled={!enabled || !filings?.running}
                    onClick={(event) => {
                      if (!current()) return;
                      restoreLoad.current =
                        document.activeElement === event.currentTarget
                          ? {
                              member: selected.member.handle,
                              control: event.currentTarget,
                            }
                          : null;
                      model.cancel();
                    }}
                  >
                    Cancel review check
                  </button>
                  <button
                    type="button"
                    className="trial-secondary"
                    disabled={!enabled || !capture || !model.canAdmit(capture)}
                    onClick={(event) => {
                      if (current() && capture && model.canAdmit(capture))
                        onView(capture, event.currentTarget);
                    }}
                  >
                    Inspect filings and write note
                  </button>
                </div>
                <p role={filings?.error ? "alert" : "status"}>
                  {filings?.message}
                </p>
                {response && (
                  <>
                    {filings?.showingPrevious && (
                      <p className="managed-watchlist-filings-warning">
                        Showing the previous response completed{" "}
                        {response.completedAt}. This attempt has not confirmed
                        newer filings.
                      </p>
                    )}
                    <FilingsPacketSummary response={response} />
                    <FilingsPacketSource response={response} />
                    {filings?.refreshComparison?.current === response && (
                      <ManagedFilingsRefreshComparisonDetails
                        comparison={filings.refreshComparison}
                      />
                    )}
                    {filings?.showingPrevious &&
                      filings.lastCheck &&
                      filings.lastCheck !== response && (
                        <p>
                          Latest source attempt checked{" "}
                          {filings.lastCheck.issuer.fetchedAt}; completed{" "}
                          {filings.lastCheck.completedAt}.
                        </p>
                      )}
                  </>
                )}
              </section>
            )}
            <button
              type="button"
              className="trial-secondary"
              disabled={!enabled}
              onClick={(event) => {
                if (!current()) return;
                if (document.activeElement === event.currentTarget)
                  transitionFocus.current = {
                    control: event.currentTarget,
                    target: "group",
                    member: null,
                  };
                model.finish(state);
              }}
            >
              Finish filing review
            </button>
          </>
        )}
        <p>
          Choosing companies, switching and opening a retained response make no
          source request. Company research keeps the existing reference-to-note,
          Review and Save steps. Back retains this review. Finish or leaving My
          Watchlist clears its temporary responses. Notes stay in your watchlist
          draft.
        </p>
      </section>
    </details>
  );
}
