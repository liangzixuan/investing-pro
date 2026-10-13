import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import {
  membershipMatchesResult,
  type ManagedSecFilingsResponseDto,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type {
  ManagedWatchlistFilings as FilingsModel,
  ManagedWatchlistFilingsCapture,
  ManagedWatchlistFilingsMember,
  ManagedWatchlistFilingsState,
} from "./managed-watchlist-filings";

export interface ManagedWatchlistFilingsProps {
  selected: WatchlistMembership;
  model: FilingsModel;
  active: boolean;
  onViewFilings: (
    capture: ManagedWatchlistFilingsCapture,
    opener: HTMLButtonElement,
  ) => void;
}

interface CommittedAction {
  active: boolean;
  model: FilingsModel;
  member: ManagedWatchlistFilingsMember | null;
}

interface CancelFocus {
  member: ManagedWatchlistFilingsMember;
  control: HTMLButtonElement;
}

function canLoad(state: ManagedWatchlistFilingsState, active: boolean) {
  return (
    active &&
    state.active &&
    state.canRead &&
    !state.pending &&
    !state.catalogChanged &&
    !state.filings.catalogChanged
  );
}

function restoreLoadFocus(
  request: CancelFocus,
  member: ManagedWatchlistFilingsMember | null,
  button: HTMLButtonElement | null,
  active: boolean,
) {
  if (
    !active ||
    request.member !== member ||
    !button?.isConnected ||
    button.disabled ||
    button.getClientRects().length === 0
  )
    return;
  if (
    document.activeElement === request.control ||
    document.activeElement === document.body
  )
    button.focus();
}

function FilingsSummary({
  response,
}: {
  response: ManagedSecFilingsResponseDto;
}) {
  if (response.issuer.status !== "available") return null;
  const newest = response.issuer.filings[0];
  return (
    <div className="managed-watchlist-filings-summary">
      {newest ? (
        <>
          <p>Newest observed filing</p>
          <a href={newest.sourceUrl} target="_blank" rel="noreferrer">
            Form {newest.form} · Filed <time>{newest.filingDate}</time>
            <span>{newest.accessionNumber}</span>
          </a>
        </>
      ) : (
        <p>No matching filings were observed in the checked source object.</p>
      )}
      <p>
        {response.issuer.filings.length} loaded filings ·{" "}
        {response.window.fromDate} to {response.window.throughDate}
      </p>
      {response.issuer.truncated && (
        <p className="managed-watchlist-filings-warning">
          Showing {response.issuer.filings.length} of{" "}
          {response.issuer.matchingFilings} matching entries; the response limit
          truncated this list.
        </p>
      )}
    </div>
  );
}

function FilingsSource({
  response,
}: {
  response: ManagedSecFilingsResponseDto;
}) {
  const issuer = response.issuer;
  const available = issuer.status === "available";
  return (
    <details className="managed-watchlist-filings-source">
      <summary>Filings source and coverage</summary>
      <dl className="managed-metadata">
        <dt>CIK</dt>
        <dd>{issuer.cik}</dd>
        <dt>Inclusive request window</dt>
        <dd>
          {response.window.fromDate} to {response.window.throughDate} · 90 UTC
          dates
        </dd>
        <dt>Request started</dt>
        <dd>
          <time>{response.requestStartedAt}</time>
        </dd>
        <dt>Request completed</dt>
        <dd>
          <time>{response.completedAt}</time>
        </dd>
        <dt>Source {available ? "retrieved" : "checked"}</dt>
        <dd>
          <time>{issuer.fetchedAt}</time>
        </dd>
      </dl>
      <a href={issuer.sourceUrl} target="_blank" rel="noreferrer">
        SEC Submissions source
      </a>
      <p>
        {available
          ? "Only the SEC current recent-filings object was checked."
          : "This attempt requested the SEC current recent-filings object; its contents were not successfully validated."}{" "}
        Older continuation files and filing bodies were not loaded. This packet
        does not establish complete coverage of the requested window.
      </p>
      {issuer.olderHistoryAvailable && (
        <p>The source lists older continuation files.</p>
      )}
    </details>
  );
}

export function ManagedWatchlistFilings({
  selected,
  model,
  active,
  onViewFilings,
}: ManagedWatchlistFilingsProps) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const member =
    state.selected && membershipMatchesResult(selected, state.selected.listing)
      ? state.selected
      : null;
  const filings = member ? state.filings : null;
  const response = filings?.response ?? null;
  const capture = member && response ? { member, response } : null;
  const current = useRef<CommittedAction | null>(null);
  const loadButton = useRef<HTMLButtonElement | null>(null);
  const restore = useRef<CancelFocus | null>(null);
  const action: CommittedAction = { active, model, member };
  useLayoutEffect(() => {
    current.current = action;
    return () => {
      current.current = null;
    };
  });
  useLayoutEffect(() => {
    const request = restore.current;
    restore.current = null;
    if (request && !state.pending)
      restoreLoadFocus(
        request,
        member,
        loadButton.current,
        active && state.active,
      );
  }, [state.pending, member, active, state.active]);

  const currentState = () => {
    if (current.current !== action || !active || !member) return null;
    const fresh = model.getSnapshot();
    return fresh.active && fresh.selected === member ? fresh : null;
  };
  const enabled = member !== null && canLoad(state, active);
  const canView = active && capture !== null && model.canAdmitFilings(capture);

  return (
    <section
      className="managed-watchlist-filings"
      aria-labelledby="managed-watchlist-filings-heading"
      aria-busy={filings?.running ?? false}
    >
      <h4 id="managed-watchlist-filings-heading">Recent filings</h4>
      <div className="trial-actions">
        <button
          type="button"
          ref={loadButton}
          data-watchlist-filings-load
          disabled={!enabled}
          onClick={() => {
            const fresh = currentState();
            if (fresh && member && canLoad(fresh, active))
              void model.load(member);
          }}
        >
          {filings?.running
            ? "Loading filings…"
            : response
              ? "Refresh filings"
              : "Load filings"}
        </button>
        {member && state.pending && (
          <button
            type="button"
            className="trial-secondary"
            disabled={!active || !state.active}
            onClick={(event) => {
              const fresh = currentState();
              if (!fresh || fresh.pending !== state.pending) return;
              if (document.activeElement === event.currentTarget)
                restore.current = { member, control: event.currentTarget };
              state.pending?.cancel();
            }}
          >
            Cancel filings
          </button>
        )}
        <button
          type="button"
          className="trial-secondary"
          disabled={!canView}
          aria-label={`View filings for ${selected.symbol} (${selected.issuerName}; ${selected.shareClassName}; ${selected.exchangeMic})`}
          onClick={(event) => {
            if (!currentState() || !capture || !model.canAdmitFilings(capture))
              return;
            onViewFilings(capture, event.currentTarget);
          }}
        >
          View filings
        </button>
      </div>
      <p
        className="managed-watchlist-filings-status"
        role={filings?.error ? "alert" : "status"}
      >
        {filings?.message ||
          "Filings loading is unavailable until this listing is confirmed in the current catalog."}
      </p>
      {response && (
        <>
          {filings?.showingPrevious && (
            <p className="managed-watchlist-filings-warning">
              Showing the previous filings response, completed{" "}
              {response.completedAt}. This attempt has not confirmed newer
              filings; its original dates and source metadata remain unchanged.
            </p>
          )}
          <FilingsSummary response={response} />
          <FilingsSource response={response} />
          {filings?.showingPrevious &&
            filings.lastCheck &&
            filings.lastCheck !== response && (
              <p className="managed-watchlist-filings-help">
                Latest source attempt checked{" "}
                {filings.lastCheck.issuer.fetchedAt}; completed{" "}
                {filings.lastCheck.completedAt}.
              </p>
            )}
        </>
      )}
      <p className="managed-watchlist-filings-help">
        Load explicitly to check issuer filings from the last 90 UTC dates. View
        filings reuses this response. Loading leaves your notes and watchlist
        unchanged.
      </p>
    </section>
  );
}
