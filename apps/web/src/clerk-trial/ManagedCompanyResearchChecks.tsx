import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { SaveState } from "./save-coordinator";
import { useCompanyResearchChecks } from "./useCompanyResearchChecks";
import "./managed-company-research-checks.css";

type Context = NonNullable<
  ReturnType<ManagedWorkspace["getCompanyResearchChecks"]>
>;
type Attachment = NonNullable<Context["attachment"]>;
export function ManagedCompanyResearchChecks({
  workspace,
  selection,
  navigationPending,
  routeActive,
}: {
  workspace: ManagedWorkspace;
  selection: ManagedResearchSelection;
  navigationPending: boolean;
  routeActive: () => boolean;
}) {
  const context = useCompanyResearchChecks(workspace, selection);
  const committed = useRef<object | null>(null);
  const lifetime = useRef<object>({});
  const renderOwner = {};
  const choiceOwner = lifetime.current;
  useLayoutEffect(() => {
    committed.current = renderOwner;
    return () => {
      if (committed.current === renderOwner) committed.current = null;
    };
  });
  const current = () =>
    committed.current === renderOwner &&
    lifetime.current === choiceOwner &&
    !navigationPending &&
    routeActive();
  const [choice, setChoice] = useState<{
    selection: ManagedResearchSelection;
    entry: ResearchFollowup;
  } | null>(null);
  const [focus, setFocus] = useState<Attachment | null>(null);
  const focused = useRef<Attachment | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  useLayoutEffect(() => {
    const target = heading.current;
    if (
      focused.current === focus ||
      !focus ||
      !target ||
      navigationPending ||
      !routeActive() ||
      !focus.isCurrent()
    )
      return;
    const current = () =>
      heading.current === target &&
      target.isConnected &&
      !target.closest("[hidden], [inert]") &&
      target.getClientRects().length > 0 &&
      focus.isCurrent() &&
      routeActive();
    if (!current()) return;
    focused.current = focus;
    target.focus({ preventScroll: true });
    if (current() && target.ownerDocument.activeElement === target)
      target.scrollIntoView({ block: "start", behavior: "instant" });
  }, [focus, navigationPending, routeActive]);
  if (!context) return null;
  const { watchlist, portfolio, followups, attachment } = context;
  const selected =
    choice?.selection === selection && choice.entry === followups.value
      ? choice.entry
      : null;
  const blocked = navigationPending || !routeActive();
  return (
    <details
      id="managed-company-research-checks"
      className="managed-company-research-checks"
    >
      <summary>Your research for this company</summary>
      <p>
        Read the independently loaded drafts for this exact listing. Load and
        Save remain separate for each resource.
      </p>
      <div className="managed-company-research-checks-grid">
        <Resource
          id="watchlist"
          label="Watchlist note"
          resource={watchlist}
          blocked={blocked}
          current={current}
        >
          {watchlist.value && (
            <p
              id="managed-company-context-note"
              className="managed-company-context-raw"
            >
              {watchlist.value.note}
            </p>
          )}
        </Resource>
        <Resource
          id="portfolio"
          label="Authored holding"
          resource={portfolio}
          blocked={blocked}
          current={current}
        >
          {portfolio.value && (
            <dl id="managed-company-context-holding">
              <dt>Shares</dt>
              <dd>{portfolio.value.shares}</dd>
              <dt>Total cost basis (USD)</dt>
              <dd>{portfolio.value.totalCostBasisUsd ?? "Unknown"}</dd>
              <dt>Confirmed on</dt>
              <dd>{portfolio.value.confirmedOn}</dd>
            </dl>
          )}
          <p>
            Authored position only. Current value, performance and allocation
            are unavailable here.
          </p>
        </Resource>
        <Resource
          id="followups"
          label="Existing research check"
          resource={followups}
          blocked={blocked}
          current={current}
        >
          {followups.value && (
            <div id="managed-company-context-check">
              <p className="managed-company-context-raw">
                {followups.value.check}
              </p>
              <p>Due date (UTC): {followups.value.dueOn}</p>
              <p>Status: {followups.value.status}</p>
              <p>
                Completed on: {followups.value.completedOn ?? "Not completed"}
              </p>
              <p className="managed-company-context-raw">
                {followups.value.result || "No authored assessment."}
              </p>
            </div>
          )}
        </Resource>
      </div>
      {selection.origin !== "followups" && !attachment && (
        <>
          <label htmlFor="managed-company-check-choice">
            Check to use in this company visit
          </label>
          <select
            id="managed-company-check-choice"
            value={selected?.id ?? ""}
            disabled={blocked || !context.canAttach}
            onChange={(event) => {
              if (!current()) return;
              lifetime.current = {};
              setChoice(
                event.currentTarget.value === followups.value?.id
                  ? { selection, entry: followups.value }
                  : null,
              );
            }}
          >
            <option value="">Choose an existing check</option>
            {followups.value && (
              <option value={followups.value.id}>
                {followups.value.listing.symbol} · due {followups.value.dueOn} ·{" "}
                {followups.value.status}
              </option>
            )}
          </select>
          <button
            id="managed-company-check-attach"
            className="trial-secondary"
            disabled={blocked || !context.canAttach || !selected}
            onClick={() => {
              if (blocked || !current() || !selected) return;
              const operation = {};
              lifetime.current = operation;
              const result = context.attach(selected);
              if (
                result?.isCurrent() &&
                routeActive() &&
                committed.current === renderOwner &&
                lifetime.current === operation
              )
                setFocus(result);
            }}
          >
            Use this check
          </button>
        </>
      )}
      {attachment && (
        <h3
          id="managed-company-check-attached-heading"
          ref={heading}
          tabIndex={-1}
        >
          Using this research check: {attachment.entry.listing.symbol}
        </h3>
      )}
      {context.reason && <p role="status">{context.reason}</p>}
    </details>
  );
}
function Resource({
  id,
  label,
  resource,
  blocked,
  current,
  children,
}: {
  id: string;
  label: string;
  resource: {
    status: string;
    saved: SaveState<unknown>;
    reason: string | null;
    canLoad: boolean;
    load: () => Promise<void>;
  };
  blocked: boolean;
  current: () => boolean;
  children: ReactNode;
}) {
  const saved = resource.saved;
  return (
    <section id={`managed-company-context-${id}`} aria-label={label}>
      <h3>{label}</h3>
      <p>
        {
          (
            {
              unloaded: "This resource has not been loaded.",
              empty: "The loaded draft is empty.",
              absent: "No matching entry for this exact listing.",
              invalid: "This draft needs correction.",
              stale: "This draft needs current catalog review.",
              ready: "Current draft for this exact listing.",
            } as Record<string, string>
          )[resource.status]
        }
      </p>
      <p>
        Draft base: {saved.baseVersion ?? "Not loaded"}. Saved version:{" "}
        {saved.saved?.version ?? "Not loaded"}.{" "}
        {saved.dirty ? "Unsaved changes." : "No unsaved changes."}
      </p>
      {saved.phase !== "idle" && <p role="status">{saved.message}</p>}
      {(saved.conflict || saved.uncertain || saved.replayPending) && (
        <p role="status">
          {saved.conflict ? "Saved changes need review. " : ""}
          {saved.uncertain ? "The Save result is uncertain. " : ""}
          {saved.replayPending
            ? "The original Save is confirmed; Load the latest version before continuing."
            : ""}
        </p>
      )}
      {children}
      {resource.reason && <p role="status">{resource.reason}</p>}
      <button
        id={`managed-company-context-load-${id}`}
        className="trial-secondary"
        disabled={blocked || !resource.canLoad}
        onClick={() => {
          if (!blocked && current()) void resource.load();
        }}
      >
        Load{" "}
        {label === "Authored holding"
          ? "Portfolio"
          : id === "watchlist"
            ? "Watchlist"
            : "Follow-ups"}
      </button>
    </section>
  );
}
