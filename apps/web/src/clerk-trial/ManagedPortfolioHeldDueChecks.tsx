import "./managed-portfolio-held-due-checks.css";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import { ListingIdentity, identityLabels } from "./ManagedListingIdentity";
import type { WatchlistMembership } from "@research-cockpit/contracts";

function Identity({ listing }: { listing: Omit<WatchlistMembership, "note"> }) {
  return (
    <>
      <p>
        <ListingIdentity member={listing} />
      </p>
      <details>
        <summary>Full listing identity</summary>
        <dl>
          {Object.entries(listing).map(([key, value]) => (
            <div key={key}>
              <dt>{identityLabels[key as keyof typeof identityLabels]}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  );
}

export function ManagedPortfolioHeldDueChecks({
  workspace,
  active,
  routeActive,
}: {
  workspace: ManagedWorkspace;
  active: boolean;
  routeActive: () => boolean;
}) {
  const model = workspace.portfolioHeldDueChecks;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const portfolio = useSyncExternalStore(
    workspace.portfolio.coordinator.subscribe,
    workspace.portfolio.coordinator.getSnapshot,
    workspace.portfolio.coordinator.getSnapshot,
  );
  const followups = useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
    workspace.followups.coordinator.getSnapshot,
  );
  const lease = useRef({ mounted: true });
  const latest = useRef({ active, routeActive, state });
  latest.current = { active, routeActive, state };
  const pending = useRef<{
    button: HTMLButtonElement;
    id: string;
    current: () => boolean;
  } | null>(null);
  useLayoutEffect(() => {
    const owner = lease.current;
    owner.mounted = true;
    return () => {
      owner.mounted = false;
      pending.current = null;
      model.cancel(latest.current.state);
    };
  }, []);
  useLayoutEffect(() => {
    const action = pending.current;
    pending.current = null;
    if (
      !action ||
      !lease.current.mounted ||
      !latest.current.active ||
      !latest.current.routeActive() ||
      !action.current()
    )
      return;
    if (
      document.activeElement !== action.button &&
      document.activeElement !== document.body
    )
      return;
    const target = document.getElementById(action.id);
    if (!target?.isConnected) return;
    const disclosure = target.closest("details");
    if (disclosure) disclosure.open = true;
    if (action.current()) target.focus();
  });
  const accepts = () =>
    lease.current.mounted &&
    active &&
    routeActive() &&
    state === model.getSnapshot();
  const enabled = active && routeActive();
  return (
    <section
      id="portfolio-held-due-checks"
      className="managed-portfolio-held-due"
      aria-labelledby="portfolio-held-due-heading"
    >
      <h3 id="portfolio-held-due-heading">
        Review due checks for current holdings
      </h3>
      <p>
        Load each resource separately. Inspect every holding and check, then
        choose one to five due checks in review order. Both held share classes
        can have their own checks.
      </p>
      <div className="trial-actions">
        <button
          id="portfolio-held-due-load-portfolio"
          className="trial-secondary"
          disabled={!enabled || !state.canLoadPortfolio}
          onClick={() => {
            if (accepts()) void model.loadPortfolio(state);
          }}
        >
          Load Portfolio for held checks
        </button>
        <button
          id="portfolio-held-due-load-followups"
          className="trial-secondary"
          disabled={!enabled || !state.canLoadFollowups}
          onClick={() => {
            if (accepts()) void model.loadFollowups(state);
          }}
        >
          Load Follow-ups for held checks
        </button>
      </div>
      <p>
        Portfolio base: {portfolio.baseVersion ?? "not loaded"}.{" "}
        {portfolio.dirty
          ? "Unsaved Portfolio changes."
          : "No unsaved Portfolio changes."}{" "}
        Follow-ups base: {followups.baseVersion ?? "not loaded"}.{" "}
        {followups.dirty
          ? "Unsaved Follow-ups changes."
          : "No unsaved Follow-ups changes."}
      </p>
      {state.reason && <p role="status">{state.reason}</p>}
      <button
        id="portfolio-held-due-prepare"
        className="trial-secondary"
        disabled={!enabled || !state.canPrepare}
        onClick={(event) => {
          if (!accepts()) return;
          const button = event.currentTarget;
          if (model.prepare(state)) {
            const prepared = model.getSnapshot();
            pending.current = {
              button,
              id: "portfolio-held-due-preview",
              current: () =>
                model.getSnapshot() === prepared && prepared.prepared,
            };
          }
        }}
      >
        Prepare held-company checks
      </button>
      <h4 id="portfolio-held-due-preview" tabIndex={-1}>
        {state.prepared
          ? "Choose the review order"
          : "Current holdings and checks"}
      </h4>
      <p>
        Assessed on {state.plan.assessedOn ?? "not available"} UTC. Catalog:{" "}
        {workspace.getSnapshot().snapshot?.snapshotSha256 ?? "not loaded"}.
      </p>
      <h4>Current holdings</h4>
      {!state.plan.holdings.length && (
        <p>
          {state.plan.status === "ready"
            ? "No current holdings."
            : "Current holdings are not available."}
        </p>
      )}
      <ul className="managed-followups-review-choices">
        {state.plan.holdings.map(({ holding, checks }) => (
          <li
            key={holding.identity.listingId}
            data-held-due-listing={holding.identity.listingId}
          >
            <Identity listing={holding.identity} />
            <p>
              Shares: {holding.shares}. Confirmed on {holding.confirmedOn}. Cost
              basis USD: {holding.totalCostBasisUsd ?? "not provided"}.
            </p>
            <p>
              {checks.length
                ? `${checks.length} checks for this listing; see full checks below.`
                : "No check for this held listing."}
            </p>
          </li>
        ))}
      </ul>
      <h4>All Follow-ups checks</h4>
      {!state.plan.checks.length && (
        <p>
          {followups.latestLoaded
            ? "No checks are available for this review."
            : "Follow-ups have not been loaded."}
        </p>
      )}
      <ul className="managed-followups-review-choices">
        {state.plan.checks.map((row) => {
          const position = state.chosen.indexOf(row.entry);
          return (
            <li
              key={row.entry.id}
              data-held-due-check={row.entry.id}
              data-eligible={row.eligible}
            >
              <Identity listing={row.entry.listing} />
              <p>
                Check ID: {row.entry.id}. Due {row.entry.dueOn} UTC.{" "}
                {row.entry.status === "completed"
                  ? `Completed ${row.entry.completedOn} UTC.`
                  : "Open."}
              </p>
              <p className="managed-followups-authored">{row.entry.check}</p>
              <p>Your assessment</p>
              <p className="managed-followups-authored">
                {row.entry.result || "No authored assessment yet."}
              </p>
              <p>Catalog: {row.entry.catalogSnapshotSha256}</p>
              <p>
                {row.eligible
                  ? "Included: available to choose."
                  : "Excluded from this review."}{" "}
                {row.reasons.join(" ")}
              </p>
              {row.holding && (
                <p>
                  Current shares: {row.holding.shares}. Confirmed on{" "}
                  {row.holding.confirmedOn}.
                </p>
              )}
              <button
                id={`portfolio-held-due-choose-${row.entry.id}`}
                className="trial-secondary"
                aria-pressed={position >= 0}
                disabled={
                  !enabled ||
                  !state.prepared ||
                  !row.eligible ||
                  (position < 0 && state.chosen.length >= 5)
                }
                onClick={() => {
                  if (accepts()) model.choose(state, row.entry);
                }}
              >
                {position >= 0
                  ? `Chosen ${position + 1}: remove this check`
                  : "Choose this held-company check"}
              </button>
            </li>
          );
        })}
      </ul>
      {state.prepared && (
        <>
          <h4>Chosen order</h4>
          <ol>
            {state.chosen.map((entry) => (
              <li key={entry.id}>
                {entry.listing.symbol}:{" "}
                <span className="managed-followups-authored">
                  {entry.check}
                </span>
              </li>
            ))}
          </ol>
          <div className="trial-actions">
            <button
              id="portfolio-held-due-start"
              disabled={!enabled || !state.chosen.length}
              onClick={(event) => {
                if (!accepts()) return;
                const button = event.currentTarget;
                const installed = model.start(state);
                if (installed)
                  pending.current = {
                    button,
                    id: "managed-followups-review-heading",
                    current: () =>
                      workspace.followupsReview.getSnapshot() === installed &&
                      installed.available,
                  };
              }}
            >
              Start held-company review
            </button>
            <button
              id="portfolio-held-due-cancel"
              className="trial-secondary"
              disabled={!enabled}
              onClick={(event) => {
                if (!accepts()) return;
                const button = event.currentTarget;
                if (model.cancel(state)) {
                  const next = model.getSnapshot();
                  pending.current = {
                    button,
                    id: "portfolio-held-due-prepare",
                    current: () =>
                      model.getSnapshot() === next && next.canPrepare,
                  };
                }
              }}
            >
              Cancel held-company selection
            </button>
          </div>
        </>
      )}
      <p>
        Preparation and Start do not edit drafts, request company sources,
        complete checks or save. Continue in the existing review session; use
        Save follow-ups separately.
      </p>
    </section>
  );
}
