import { ManagedWatchlistResearchReport } from "./ManagedWatchlistResearchReport";
import type { WatchlistResearchReportDeliveryAdapter } from "./watchlist-research-report-ports";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedWatchlistResearchPairState } from "./managed-watchlist-research-pair";
import type { CompanyResearchSide } from "./passive-company-research";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import { ManagedScreenResearchReading } from "./ManagedScreenResearchReading";
import "./managed-screen-research-review.css";
import "./managed-watchlist-research-pair.css";

type State = ManagedWatchlistResearchPairState;
type Member = State["memberships"][number];
type Context = {
  readonly workspace: Pick<
    ManagedWorkspace,
    "watchlistResearchPair" | "captureWatchlistResearchReading"
  >;
  readonly navigationPending: boolean;
};
export interface WatchlistResearchOpenProps {
  readonly onOpenSide: (
    state: State,
    side: CompanyResearchSide,
    opener: HTMLButtonElement,
  ) => void;
}
const PAGE_SIZE = 25;

function usePairContext({ workspace, navigationPending }: Context) {
  const model = workspace.watchlistResearchPair;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const current = useRef({ model, state, navigationPending });
  current.current = { model, state, navigationPending };
  const pendingFocus = useRef<{
    state: State;
    owner: HTMLButtonElement;
  } | null>(null);
  const [committed, setCommitted] = useState<State | null>(null);
  const isCurrent = () =>
    current.current.model === model &&
    current.current.state === state &&
    !current.current.navigationPending &&
    model.getSnapshot() === state;

  useLayoutEffect(() => {
    const request = pendingFocus.current;
    pendingFocus.current = null;
    const target = heading.current;
    if (
      request &&
      request.state === committed &&
      committed === state &&
      state === model.getSnapshot() &&
      !navigationPending &&
      target?.isConnected &&
      !target.closest("[hidden], [inert]") &&
      target.getClientRects().length > 0 &&
      (target.ownerDocument.activeElement === request.owner ||
        (!request.owner.isConnected &&
          target.ownerDocument.activeElement === target.ownerDocument.body))
    )
      target.focus();
  }, [committed, state, model, navigationPending]);

  function commit(owner: HTMLButtonElement, action: () => State | null) {
    if (!isCurrent()) return;
    const ownsFocus = owner.ownerDocument?.activeElement === owner;
    const result = action();
    if (result && result === model.getSnapshot() && ownsFocus) {
      pendingFocus.current = { state: result, owner };
      setCommitted(result);
    }
  }
  return { model, state, heading, isCurrent, commit };
}

function FullIdentity({ member }: { readonly member: Member }) {
  return (
    <dl data-watchlist-pair-identity={member.listing.listingId}>
      {Object.entries(identityLabels).map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{member.listing[key as keyof typeof identityLabels]}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Watchlist selection has no provider or financial-screen eligibility gate. */
export function ManagedWatchlistResearchPair({
  workspace,
  navigationPending,
  onOpenSide,
  reportDelivery,
  reportRouteActive,
}: Context &
  WatchlistResearchOpenProps & {
    readonly reportDelivery?: WatchlistResearchReportDeliveryAdapter;
    readonly reportRouteActive: () => boolean;
  }) {
  const { model, state, heading, isCurrent, commit } = usePairContext({
    workspace,
    navigationPending,
  });
  const [paging, setPaging] = useState({
    memberships: state.memberships,
    page: 0,
  });
  const pages = Math.max(1, Math.ceil(state.memberships.length / PAGE_SIZE));
  const page = Math.min(
    pages - 1,
    paging.memberships === state.memberships ? paging.page : 0,
  );
  const start = page * PAGE_SIZE;
  const shown = state.memberships.slice(start, start + PAGE_SIZE);
  const changePage = (next: number) => {
    if (isCurrent() && Number.isInteger(next) && next >= 0 && next < pages)
      setPaging({ memberships: state.memberships, page: next });
  };
  const reading = state.reading;
  return (
    <section
      className="managed-watchlist-research-pair managed-screen-research-review"
      aria-labelledby="managed-watchlist-pair-heading"
    >
      <h2 id="managed-watchlist-pair-heading" ref={heading} tabIndex={-1}>
        {reading
          ? "Two-company Watchlist research"
          : state.preview
            ? "Check the two company identities"
            : "Compare two Watchlist companies"}
      </h2>
      <p>
        Review each company’s sources, authored thesis and valuation side by
        side. Each reading keeps its own periods, source states and evaluation
        time. This view does not rank companies or align their reporting
        periods.
      </p>
      {state.reason && <p role="status">{state.reason}</p>}
      {reading ? (
        <>
          <p>
            Open current Research to edit a thesis or create a dated check.
            Retained readings cannot load sources, change drafts or save
            resources.
          </p>
          <div className="managed-screen-research-pair">
            {(["left", "right"] as const).map((side, index) => {
              const member = reading.members[index]!;
              return (
                <section
                  key={side}
                  aria-label={`${side} Watchlist company reading`}
                >
                  <h3>
                    {side === "left" ? "First" : "Second"} company ·{" "}
                    <ListingIdentity member={member.listing} />
                  </h3>
                  <div className="managed-screen-research-actions">
                    <button
                      id={`managed-watchlist-pair-open-${side}`}
                      disabled={navigationPending}
                      onClick={(event) => {
                        if (isCurrent())
                          onOpenSide(state, side, event.currentTarget);
                      }}
                    >
                      Open current Research for {member.listing.symbol}
                    </button>
                    <button
                      id={`managed-watchlist-pair-clear-${side}`}
                      className="trial-secondary"
                      disabled={navigationPending || !reading[side]}
                      onClick={(event) => {
                        if (reading[side])
                          commit(event.currentTarget, () =>
                            model.clearSide(state, side),
                          );
                      }}
                    >
                      Clear {side === "left" ? "first" : "second"} retained
                      reading
                    </button>
                  </div>
                  {reading[side] ? (
                    <ManagedScreenResearchReading capture={reading[side]} />
                  ) : (
                    <p>
                      No reading retained for this company. Open its current
                      Research, review the available sources and retain a
                      reading explicitly. Available sources can differ between
                      companies.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
          <ManagedWatchlistResearchReport
            model={model}
            delivery={reportDelivery}
            routeActive={() => !navigationPending && reportRouteActive()}
          />
          <button
            id="managed-watchlist-pair-end"
            className="trial-secondary"
            disabled={navigationPending}
            onClick={(event) =>
              commit(event.currentTarget, () => model.end(state))
            }
          >
            End this comparison
          </button>
        </>
      ) : state.preview ? (
        <>
          <p>
            Confirm the listing and share class for each side. Starting this
            comparison does not load sources or save either company’s work.
          </p>
          <div className="managed-screen-research-pair">
            {state.preview.map((member, index) => (
              <section key={member.listing.listingId}>
                <h3>{index === 0 ? "First" : "Second"} company</h3>
                <FullIdentity member={member} />
              </section>
            ))}
          </div>
          <div className="managed-screen-research-actions">
            <button
              id="managed-watchlist-pair-start"
              disabled={navigationPending || !state.canStart}
              onClick={(event) => {
                if (state.canStart)
                  commit(event.currentTarget, () => model.start(state));
              }}
            >
              Start comparison
            </button>
            <button
              id="managed-watchlist-pair-change"
              className="trial-secondary"
              disabled={navigationPending}
              onClick={(event) =>
                commit(event.currentTarget, () => model.cancelPreview(state))
              }
            >
              Change selection
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            Choose two distinct listings. Your first choice appears on the first
            side. Membership does not establish source coverage.
          </p>
          <p>{state.selected.length} of 2 companies selected.</p>
          {state.selected.length > 0 && (
            <ol aria-label="Selected companies in comparison order">
              {state.selected.map((member, index) => (
                <li key={member.listing.listingId}>
                  <ListingIdentity member={member.listing} />
                  <button
                    className="trial-secondary"
                    disabled={navigationPending}
                    onClick={() => {
                      if (isCurrent()) model.select(state, member);
                    }}
                  >
                    Remove {index === 0 ? "first" : "second"} selection
                  </button>
                </li>
              ))}
            </ol>
          )}
          <button
            id="managed-watchlist-pair-preview"
            disabled={navigationPending || state.selected.length !== 2}
            onClick={(event) => {
              if (state.selected.length === 2)
                commit(event.currentTarget, () => model.preview(state));
            }}
          >
            Preview company identities
          </button>
          <p>
            {state.memberships.length} Watchlist members · Showing{" "}
            {shown.length ? start + 1 : 0}–{start + shown.length}
          </p>
          <ol start={start + 1} aria-label="Watchlist comparison choices">
            {shown.map((member, index) => {
              const selected = state.selected.includes(member);
              return (
                <li
                  key={member.listing.listingId}
                  data-watchlist-pair-member={member.listing.listingId}
                >
                  <ListingIdentity member={member.listing} />
                  <button
                    id={`managed-watchlist-pair-select-${start + index}`}
                    disabled={
                      navigationPending ||
                      (!selected && state.selected.length === 2)
                    }
                    aria-pressed={selected}
                    onClick={() => {
                      if (
                        isCurrent() &&
                        (selected || state.selected.length < 2)
                      )
                        model.select(state, member);
                    }}
                  >
                    {selected ? "Deselect" : "Select"} {member.listing.symbol} ·{" "}
                    {member.listing.shareClassName}
                  </button>
                  <details>
                    <summary>Full identity for {member.listing.symbol}</summary>
                    <FullIdentity member={member} />
                  </details>
                </li>
              );
            })}
          </ol>
          {pages > 1 && (
            <nav
              aria-label="Watchlist comparison pages"
              className="managed-screen-research-actions"
            >
              <button
                disabled={navigationPending || page === 0}
                onClick={() => changePage(page - 1)}
              >
                Previous page
              </button>
              <label htmlFor="managed-watchlist-pair-page">Go to page</label>
              <select
                id="managed-watchlist-pair-page"
                value={page}
                disabled={navigationPending}
                onChange={(event) =>
                  changePage(Number(event.currentTarget.value))
                }
              >
                {Array.from({ length: pages }, (_, index) => (
                  <option key={index} value={index}>
                    {index + 1} of {pages}
                  </option>
                ))}
              </select>
              <button
                disabled={navigationPending || page === pages - 1}
                onClick={() => changePage(page + 1)}
              >
                Next page
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

/** This slot belongs inside the current Research visit, not the passive pair. */
export function ManagedWatchlistResearchCapture({
  workspace,
  navigationPending,
}: Context) {
  const { state, heading, isCurrent, commit } = usePairContext({
    workspace,
    navigationPending,
  });
  if (!state.reading || !state.activeSide) return null;
  const retained = state.reading[state.activeSide];
  return (
    <section
      className="managed-watchlist-research-pair"
      aria-labelledby="managed-watchlist-pair-capture-heading"
    >
      <h2
        id="managed-watchlist-pair-capture-heading"
        ref={heading}
        tabIndex={-1}
      >
        Retain this company reading
      </h2>
      <p>
        Keep the current sources, authored thesis and valuation beside the other
        company in your Watchlist comparison. Saved resources remain separate.
      </p>
      {retained && (
        <p>
          Current retained reading captured at {retained.capturedAt}. Replacing
          it changes only this side.
        </p>
      )}
      <button
        id="managed-watchlist-pair-capture"
        disabled={navigationPending || !state.canCapture}
        onClick={(event) => {
          if (isCurrent() && state.canCapture)
            commit(event.currentTarget, () =>
              workspace.captureWatchlistResearchReading(state),
            );
        }}
      >
        {retained
          ? "Replace retained company reading"
          : "Retain current company reading"}
      </button>
      {state.reason && <p role="status">{state.reason}</p>}
    </section>
  );
}
