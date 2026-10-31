import type { FollowupsReviewFilingsState } from "./managed-followups-review-filings";
import { ManagedPortfolioHeldDueChecks } from "./ManagedPortfolioHeldDueChecks";
import { ManagedFollowupsReviewReport } from "./ManagedFollowupsReviewReport";
import type { FollowupsReviewReportDeliveryAdapter } from "./followups-review-report-ports";
import { ManagedFollowupAssessment } from "./ManagedFollowupAssessment";
import { ManagedFollowupsReviewSession } from "./ManagedFollowupsReviewSession";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  MANAGED_RESEARCH_FOLLOWUPS_LIMITS,
  normalizeResearchFollowupCheck,
  type ResearchFollowup,
} from "@research-cockpit/contracts";
import { ListingIdentity } from "./ManagedListingIdentity";
import {
  groupResearchFollowupsByDueDate,
  isResearchFollowupDueDate as validDueDate,
} from "./managed-research-followups-date";
import type { FollowupsFilter } from "./managed-research-followups";
import type { ManagedWorkspace, FollowupReview } from "./managed-workspace";
import "./managed-research-followups.css";
import { ManagedFollowupsDraftFiles } from "./ManagedFollowupsDraftFiles";
import type { ManagedFollowupsDraftFileDeliveryAdapter } from "./followups-draft-file-delivery";

export interface ManagedResearchFollowupsProps {
  onReviewFilingsResearch?:
    | ((state: FollowupsReviewFilingsState, opener: HTMLButtonElement) => void)
    | undefined;
  navigationPending: boolean;
  review?: FollowupReview | null;
  workspace: ManagedWorkspace;
  onResearch: (entry: ResearchFollowup, opener: HTMLButtonElement) => void;
  followupsReviewReportDelivery?:
    FollowupsReviewReportDeliveryAdapter | undefined;
  draftFileScope?: Promise<string> | undefined;
  draftFileDelivery?: ManagedFollowupsDraftFileDeliveryAdapter | undefined;
  draftFileRouteActive?: (() => boolean) | undefined;
}

const reviewLabels = {
  current: "Current identity",
  update: "Metadata update available",
  missing: "Not in the current catalog",
  rebound: "Different stable identity; update refused",
} as const;

export function ManagedResearchFollowups({
  navigationPending,
  review,
  workspace,
  onResearch,
  onReviewFilingsResearch,
  followupsReviewReportDelivery,
  draftFileScope,
  draftFileDelivery,
  draftFileRouteActive = () => true,
}: ManagedResearchFollowupsProps) {
  const model = workspace.followups;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const saved = useSyncExternalStore(
    model.coordinator.subscribe,
    model.coordinator.getSnapshot,
    model.coordinator.getSnapshot,
  );
  const watchlist = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
    workspace.coordinator.getSnapshot,
  );
  const discovery = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const session = useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
    workspace.sessionOwner.getSnapshot,
  );
  const assessmentClock = new Date(state.assessmentTime ?? NaN);
  const editorHeading = useRef<HTMLHeadingElement | null>(null);
  useLayoutEffect(() => {
    const target = editorHeading.current;
    if (!review || navigationPending || !target) return;
    const current = () =>
      review.isCurrent() &&
      editorHeading.current === target &&
      target.isConnected &&
      !target.closest("[hidden], [inert]") &&
      target.getClientRects().length > 0;
    if (!current()) return;
    target.focus({ preventScroll: true });
    if (current() && target.ownerDocument.activeElement === target)
      target.scrollIntoView({ block: "start", behavior: "instant" });
  }, [review, navigationPending]);
  const [newListingId, setNewListingId] = useState("");
  const [newDueOn, setNewDueOn] = useState("");
  const entries = saved.draft?.entries ?? [];
  const groups = groupResearchFollowupsByDueDate(entries, assessmentClock);
  const invalidDates = entries.filter((entry) => !validDueDate(entry.dueOn));
  const selected =
    entries.find((entry) => entry.id === state.selectedId) ?? null;
  const active = session.phase === "active";
  const editable = active && model.canEdit();
  const idle = active && saved.phase === "idle";
  const canLoad = idle && !saved.uncertain;
  const digest = discovery.snapshot?.snapshotSha256 ?? null;
  const creationCurrent =
    digest !== null && watchlist.draft?.snapshotSha256 === digest;
  const choices = (watchlist.draft?.memberships ?? []).filter(
    (member) =>
      !entries.some((entry) => entry.listing.listingId === member.listingId),
  );
  const newMember =
    choices.find((member) => member.listingId === newListingId) ?? null;
  const canAdd =
    editable &&
    creationCurrent &&
    newMember !== null &&
    validDueDate(newDueOn) &&
    entries.length < MANAGED_RESEARCH_FOLLOWUPS_LIMITS.entries;
  const visible = (entry: ResearchFollowup) =>
    state.filter === "all" || entry.status === state.filter;
  const visibleCount = entries.filter(visible).length;
  const dueSections = groups
    ? [
        { label: "Overdue", entries: groups.overdue },
        { label: "Due today", entries: groups.today },
        { label: "Later", entries: groups.later },
        { label: "Completed", entries: groups.completed },
        { label: "Needs a valid due date", entries: invalidDates },
      ]
    : [{ label: "Follow-ups", entries }];
  const canResearch = (entry: ResearchFollowup) => {
    const current = workspace.getSnapshot();
    return (
      !navigationPending &&
      workspace.sessionOwner.getSnapshot().phase === "active" &&
      current.view === "followups" &&
      !current.followupOpening &&
      !current.companyRoute &&
      !current.research &&
      current.snapshot?.snapshotSha256 === entry.catalogSnapshotSha256 &&
      model.currentEntry(entry.id) === entry
    );
  };
  const hasUpdates =
    state.review?.entries.some((entry) => entry.status === "update") ?? false;

  return (
    <section
      className="managed-followups"
      aria-labelledby="managed-followups-heading"
    >
      <header className="managed-followups-heading">
        <div>
          <h2 id="managed-followups-heading" tabIndex={-1}>
            Follow-ups
          </h2>
          <p>
            Keep a dated research check for each listing. Save follow-ups
            separately from My Watchlist.
          </p>
        </div>
        <p>
          {entries.length} / {MANAGED_RESEARCH_FOLLOWUPS_LIMITS.entries} checks
        </p>
      </header>
      <ManagedPortfolioHeldDueChecks
        workspace={workspace}
        active={active && !navigationPending}
        routeActive={draftFileRouteActive}
      />
      <ManagedFollowupsReviewSession
        workspace={workspace}
        active={active && !navigationPending}
        routeActive={draftFileRouteActive}
        onResearch={onResearch}
        onReviewFilingsResearch={onReviewFilingsResearch}
      />
      {draftFileScope && (
        <ManagedFollowupsDraftFiles
          workspace={workspace}
          accountScope={draftFileScope}
          delivery={draftFileDelivery}
          routeActive={() => draftFileRouteActive() && !navigationPending}
          onRestored={() => {
            if (workspace.sessionOwner.getSnapshot().phase !== "active") return;
            if (workspace.getSnapshot().view !== "followups") return;
            if (!draftFileRouteActive() || navigationPending) return;
            document.getElementById("managed-followups-heading")?.focus();
          }}
        />
      )}
      <div className="trial-actions managed-followups-actions">
        <button
          id="managed-followups-load"
          className="trial-secondary"
          disabled={!canLoad}
          onClick={() => void model.coordinator.load()}
        >
          {saved.phase === "loading"
            ? "Loading follow-ups…"
            : saved.saved
              ? "Load latest follow-ups"
              : "Load follow-ups"}
        </button>
        <button
          id="managed-followups-save"
          disabled={
            !editable ||
            !saved.dirty ||
            saved.conflict ||
            !model.canSavePayload()
          }
          onClick={() => void model.coordinator.save()}
        >
          Save follow-ups
        </button>
        {saved.uncertain && (
          <button
            id="managed-followups-reconcile"
            className="trial-secondary"
            disabled={!idle}
            onClick={() => void model.coordinator.reconcile()}
          >
            Reconcile original follow-up save
          </button>
        )}
      </div>
      <p className="managed-followups-version">
        {saved.baseVersion === null
          ? "Follow-ups have not been loaded."
          : `Draft based on version ${saved.baseVersion}.`}
        {saved.saved ? ` Loaded saved version ${saved.saved.version}.` : ""}
        {saved.dirty ? " Unsaved follow-up changes." : ""}
      </p>
      <p role="status" aria-live="polite">
        {saved.message}
      </p>
      {saved.conflict && (
        <div className="managed-followups-warning">
          <p>
            {saved.replayPending
              ? "The original save is confirmed. Load the latest version before choosing which follow-ups to keep."
              : "Your follow-up draft is retained. Load the latest saved version, then choose which version to keep."}
          </p>
          <div className="trial-actions">
            <button
              id="managed-followups-use-saved"
              className="trial-secondary"
              disabled={!idle || !saved.latestLoaded}
              onClick={() => model.coordinator.useSaved()}
            >
              Use saved follow-ups
            </button>
            <button
              id="managed-followups-keep-draft"
              className="trial-secondary"
              disabled={!idle || !saved.latestLoaded}
              onClick={() => model.coordinator.keepDraft()}
            >
              Keep follow-up draft
            </button>
          </div>
        </div>
      )}
      {saved.draft && (
        <>
          <div className="managed-followups-create">
            <label htmlFor="managed-followups-member">
              Listing in My Watchlist draft
            </label>
            <select
              id="managed-followups-member"
              value={newMember?.listingId ?? ""}
              disabled={!editable || !creationCurrent}
              onChange={(event) => setNewListingId(event.currentTarget.value)}
            >
              <option value="">Choose a listing</option>
              {choices.map((member) => (
                <option key={member.listingId} value={member.listingId}>
                  {member.symbol} · {member.issuerName} ·{" "}
                  {member.shareClassName} · {member.exchangeMic}
                </option>
              ))}
            </select>
            {newMember && (
              <p className="managed-followups-full-identity">
                <ListingIdentity member={newMember} />
              </p>
            )}
            <div className="managed-followups-create-date">
              <label htmlFor="managed-followups-new-due">
                Due date (UTC, YYYY-MM-DD)
                <input
                  id="managed-followups-new-due"
                  type="text"
                  placeholder="YYYY-MM-DD"
                  value={newDueOn}
                  disabled={!editable}
                  aria-invalid={newDueOn !== "" && !validDueDate(newDueOn)}
                  onChange={(event) => setNewDueOn(event.currentTarget.value)}
                />
              </label>
              <button
                id="managed-followups-add"
                className="trial-secondary"
                disabled={!canAdd}
                onClick={() => {
                  if (newMember) {
                    model.add(newMember, newDueOn);
                    setNewListingId("");
                  }
                }}
              >
                Add check
              </button>
            </div>
            <p className="managed-followups-help">
              One check per listing. Adding a check does not save My Watchlist.
              {!creationCurrent
                ? " Load a current catalog and review the watchlist identity before adding."
                : ""}
            </p>
          </div>
          <div className="managed-followups-reading-controls">
            <label htmlFor="managed-followups-filter">
              Show follow-ups
              <select
                id="managed-followups-filter"
                value={state.filter}
                disabled={!active}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  if (["open", "completed", "all"].includes(value))
                    model.setFilter(value as FollowupsFilter);
                }}
              >
                <option value="open">Open</option>
                <option value="completed">Completed</option>
                <option value="all">All</option>
              </select>
            </label>
            <div>
              <p>
                {groups ? (
                  <>
                    Due groups assessed for{" "}
                    <time
                      id="managed-followups-assessed-day"
                      dateTime={groups.assessedOn}
                    >
                      {groups.assessedOn}
                    </time>{" "}
                    UTC.
                  </>
                ) : (
                  "A valid UTC assessment date is required."
                )}{" "}
                Planning dates do not establish source freshness.
              </p>
              <button
                id="managed-followups-reassess"
                className="trial-secondary"
                disabled={!active}
                onClick={() => model.reassessDueDate(new Date())}
              >
                Reassess due date
              </button>
            </div>
          </div>
          <div className="managed-followups-workspace">
            <div className="managed-followups-list">
              <p>
                {visibleCount} shown · {entries.length} total
              </p>
              {dueSections.map((group) => {
                const matching = group.entries.filter(visible);
                return matching.length ? (
                  <section key={group.label} aria-label={group.label}>
                    <h3>{group.label}</h3>
                    <ul>
                      {matching.map((entry) => (
                        <li key={entry.id}>
                          <button
                            className="managed-followup-choice"
                            id={`managed-followup-select-${entry.id}`}
                            aria-pressed={selected === entry}
                            disabled={!active}
                            onClick={() => model.select(entry.id)}
                          >
                            <span>
                              <ListingIdentity member={entry.listing} />
                            </span>
                            <span className="managed-followups-check-preview">
                              {entry.check || "Check text required"}
                            </span>
                            <span>
                              Due {entry.dueOn || "date required"}
                              {entry.status === "completed"
                                ? ` · Completed ${entry.completedOn}`
                                : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null;
              })}
              {visibleCount === 0 && (
                <p>
                  {entries.length
                    ? "No follow-ups match this view."
                    : "No follow-ups yet. Choose a watchlist listing and add a check."}
                </p>
              )}
            </div>
            <div className="managed-followups-editor">
              {selected ? (
                <section
                  id="managed-followup-editor"
                  aria-labelledby="managed-followup-editor-heading"
                >
                  {!visible(selected) && (
                    <p className="managed-followups-help">
                      The selected check is outside this filter. Its draft is
                      unchanged.
                    </p>
                  )}
                  <h3
                    ref={editorHeading}
                    tabIndex={-1}
                    id="managed-followup-editor-heading"
                  >
                    <ListingIdentity member={selected.listing} />
                  </h3>
                  <p>
                    {selected.status === "completed" ? (
                      <>
                        Completed{" "}
                        <time dateTime={selected.completedOn}>
                          {selected.completedOn}
                        </time>{" "}
                        UTC.
                      </>
                    ) : (
                      "Open research check."
                    )}
                  </p>
                  {selected.catalogSnapshotSha256 !== digest && (
                    <p className="managed-followups-warning">
                      This saved listing uses an older or unavailable catalog.
                      Its check stays readable and editable. Review identities
                      before opening company research.
                    </p>
                  )}
                  <label htmlFor="managed-followup-check">
                    Research check
                    <textarea
                      id="managed-followup-check"
                      rows={3}
                      readOnly={!editable}
                      value={selected.check}
                      aria-invalid={
                        normalizeResearchFollowupCheck(selected.check) === null
                      }
                      aria-describedby="managed-followup-check-help"
                      onChange={(event) =>
                        model.edit(selected, "check", event.currentTarget.value)
                      }
                    />
                  </label>
                  <p
                    id="managed-followup-check-help"
                    className="managed-followups-help"
                  >
                    Required. 1–500 characters, one line.
                  </p>
                  <label htmlFor="managed-followup-due">
                    Due date (UTC, YYYY-MM-DD)
                    <input
                      id="managed-followup-due"
                      type="text"
                      value={selected.dueOn}
                      readOnly={!editable}
                      aria-invalid={!validDueDate(selected.dueOn)}
                      onChange={(event) =>
                        model.edit(selected, "dueOn", event.currentTarget.value)
                      }
                    />
                  </label>
                  <ManagedFollowupAssessment
                    id="managed-followup-result"
                    value={selected.result}
                    readOnly={!editable}
                    onChange={(raw) => model.edit(selected, "result", raw)}
                  />
                  <div className="trial-actions">
                    {selected.status === "open" ? (
                      <button
                        id="managed-followup-complete"
                        className="trial-secondary"
                        disabled={!editable || !groups}
                        onClick={() =>
                          model.complete(selected, assessmentClock)
                        }
                      >
                        Mark completed for {groups?.assessedOn ?? "UTC date"}
                      </button>
                    ) : (
                      <button
                        id="managed-followup-reopen"
                        className="trial-secondary"
                        disabled={!editable}
                        onClick={() => model.reopen(selected)}
                      >
                        Reopen check
                      </button>
                    )}
                    <button
                      id="managed-followup-remove"
                      className="trial-secondary"
                      disabled={!editable}
                      onClick={() => model.remove(selected)}
                    >
                      Remove check
                    </button>
                    <button
                      id={`managed-followup-research-${selected.id}`}
                      className="trial-secondary"
                      disabled={!canResearch(selected)}
                      onClick={(event) => {
                        if (!canResearch(selected)) return;
                        model.select(selected.id);
                        if (canResearch(selected))
                          onResearch(selected, event.currentTarget);
                      }}
                    >
                      Open company research
                    </button>
                  </div>
                  <p className="managed-followups-help">
                    Changes stay in this draft until you select Save follow-ups.
                    Research sources load only when requested.
                  </p>
                  <details
                    id="managed-followup-guidance"
                    className="managed-followups-guidance managed-followups-help"
                  >
                    <summary>How follow-ups work</summary>
                    <ul>
                      <li>
                        Unsaved listings in My Watchlist can be used to add a
                        check. Adding one does not save My Watchlist.
                      </li>
                      <li>
                        Invalid text stays visible for correction. Save
                        follow-ups stays unavailable while a field is invalid.
                      </li>
                      <li>
                        Completing, reopening or removing a check changes only
                        this draft. Select Save follow-ups to keep the change.
                      </li>
                      <li>
                        Open company research checks this listing’s identity. It
                        does not load Price, Annual or Filings.
                      </li>
                    </ul>
                  </details>
                </section>
              ) : (
                <p>Select a follow-up to read or edit it.</p>
              )}
            </div>
          </div>
          <section
            className="managed-followups-identities"
            aria-labelledby="managed-followups-identities-heading"
          >
            <h3 id="managed-followups-identities-heading">
              Listing identity review
            </h3>
            <p>
              Check all retained listings against the current catalog in one
              explicit read. Missing listings and changed stable identities stay
              in your draft.
            </p>
            <button
              id="managed-followups-review-identities"
              className="trial-secondary"
              disabled={
                !editable || !digest || !entries.length || state.reviewing
              }
              onClick={() => void model.reviewCatalog()}
            >
              {state.reviewing ? "Reviewing identities…" : "Review identities"}
            </button>
            {state.review && (
              <>
                <ul>
                  {state.review.entries.map((item) => (
                    <li key={item.entry.id}>
                      <strong>{reviewLabels[item.status]}</strong>
                      <p>
                        Retained:{" "}
                        <ListingIdentity member={item.entry.listing} />
                      </p>
                      {item.listing && (
                        <p>
                          Current catalog:{" "}
                          <ListingIdentity member={item.listing} />
                        </p>
                      )}
                      {item.status === "rebound" && (
                        <p>
                          The stable listing identity changed. The retained
                          check will not be transferred.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  id="managed-followups-apply-identities"
                  className="trial-secondary"
                  disabled={!editable || state.reviewing || !hasUpdates}
                  onClick={() => model.applyReview()}
                >
                  Apply eligible identity updates
                </button>
                <p>
                  Applying changes only this draft. Save follow-ups separately.
                </p>
              </>
            )}
            {state.message && <p role="status">{state.message}</p>}
          </section>
        </>
      )}
      <ManagedFollowupsReviewReport
        workspace={workspace}
        delivery={followupsReviewReportDelivery}
        routeActive={() => draftFileRouteActive() && !navigationPending}
      />
      {saved.saved && (
        <details className="managed-followups-saved">
          <summary>
            Loaded saved follow-ups · version {saved.saved.version}
          </summary>
          {saved.saved.payload.entries.length ? (
            <ul>
              {saved.saved.payload.entries.map((entry) => (
                <li key={entry.id}>
                  <p>
                    <ListingIdentity member={entry.listing} />
                  </p>
                  <p className="managed-followups-authored">{entry.check}</p>
                  <p>
                    Due <time dateTime={entry.dueOn}>{entry.dueOn}</time> UTC.{" "}
                    {entry.status === "completed"
                      ? `Completed ${entry.completedOn} UTC.`
                      : "Open."}
                  </p>
                  <p className="managed-followups-authored">
                    {entry.result || "No authored result."}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No saved follow-ups.</p>
          )}
        </details>
      )}
      {discovery.message && <p role="status">{discovery.message}</p>}
    </section>
  );
}
