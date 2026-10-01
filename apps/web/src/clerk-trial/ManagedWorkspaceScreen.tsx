import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  ManagedCatalogSnapshotDto,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import { WorkspaceSearch } from "../features/workspace/WorkspaceSearch";
import { createManagedApi, type ManagedApi } from "./managed-api";
import {
  ManagedWorkspace,
  reviewChanges,
  type CatalogReview,
} from "./managed-workspace";
import type { TrialSession } from "./session";
import { ManagedAnnualReport } from "./ManagedAnnualReport";
import {
  bindAndroidBack,
  type AndroidBackAdapter,
} from "../mobile/android-back";

interface SessionProps {
  session: TrialSession;
  apiOrigin: string;
  api?: ManagedApi;
  androidBack?: AndroidBackAdapter;
}

export function ManagedSessionScreen(props: SessionProps) {
  return (
    <SessionWorkspace
      key={`${props.session.userId}:${props.session.sessionId}`}
      {...props}
    />
  );
}

function SessionWorkspace(props: SessionProps) {
  const [initial] = useState(props);
  const [workspace, setWorkspace] = useState<ManagedWorkspace | null>(null);
  useLayoutEffect(() => {
    const current = new ManagedWorkspace(
      initial.api ?? createManagedApi(initial.apiOrigin, initial.session),
      initial.session,
    );
    setWorkspace(current);
    void current.coordinator.load();
    void current.refreshCatalog();
    return () => current.coordinator.retire();
  }, [initial]);
  return workspace ? (
    <ManagedWorkspaceScreen
      workspace={workspace}
      {...(initial.androidBack ? { androidBack: initial.androidBack } : {})}
    />
  ) : (
    <p role="status">Loading your workspace…</p>
  );
}

function CatalogReceipt({ snapshot }: { snapshot: ManagedCatalogSnapshotDto }) {
  return (
    <details className="managed-catalog-receipt">
      <summary>
        {snapshot.coverage.activeListings} available listings · Catalog as of{" "}
        {snapshot.asOf}
      </summary>
      <p>{snapshot.attribution}</p>
      <p>
        This reviewed catalog contains only the listings counted here. Search
        results do not represent the whole market.
      </p>
      <dl className="managed-metadata">
        <dt>Catalog</dt>
        <dd>
          {snapshot.catalogId} · {snapshot.catalogVersion}
        </dd>
        <dt>Content</dt>
        <dd>
          {snapshot.contentKind === "redistributable_source"
            ? "Reviewed public sources"
            : "Synthetic engineering data"}
        </dd>
        <dt>Acquired</dt>
        <dd>{snapshot.acquiredAt}</dd>
        <dt>Generated</dt>
        <dd>{snapshot.generatedAt}</dd>
        <dt>Snapshot</dt>
        <dd>{snapshot.snapshotSha256}</dd>
      </dl>
      <ul>
        {snapshot.sources.map((source, index) => (
          <li key={`${source.url}:${index}`}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.label}
            </a>
            {source.issuerName
              ? ` · ${source.issuerName} · Filed ${source.filingDate}`
              : ""}
          </li>
        ))}
      </ul>
      <details>
        <summary>Coverage counts</summary>
        <dl className="managed-metadata">
          {Object.entries(snapshot.coverage).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </details>
      {snapshot.excludedCandidates.length > 0 && (
        <p>
          Excluded from this catalog:{" "}
          {snapshot.excludedCandidates
            .map(
              (candidate) =>
                `${candidate.symbol} (${candidate.reason.replaceAll("_", " ")})`,
            )
            .join(", ")}
          .
        </p>
      )}
    </details>
  );
}

function ListingIdentity({
  member,
}: {
  member: Omit<WatchlistMembership, "note">;
}) {
  return (
    <>
      <strong>{member.symbol}</strong> · {member.issuerName}
      <span className="managed-listing-detail">
        {member.shareClassName} · {member.exchangeMic} ·{" "}
        {member.instrumentType === "adr" ? "ADR" : "Common stock"}
      </span>
    </>
  );
}

const identityLabels: Record<keyof Omit<WatchlistMembership, "note">, string> =
  {
    country: "Country",
    exchangeMic: "Exchange MIC",
    instrumentType: "Instrument type",
    issuerId: "Issuer ID",
    issuerName: "Company name",
    listingId: "Listing ID",
    securityId: "Security ID",
    securityName: "Security name",
    shareClassId: "Share class ID",
    shareClassName: "Share class name",
    symbol: "Ticker",
  };

function CatalogReviewPanel({
  review,
  workspace,
  busy,
}: {
  review: CatalogReview;
  workspace: ManagedWorkspace;
  busy: boolean;
}) {
  const changes = reviewChanges(review);
  const missing = changes.filter((change) => change.listing === null).length;
  const complete = review.results.length === review.draft.memberships.length;
  return (
    <section className="trial-review" aria-labelledby="managed-review-heading">
      <h3 id="managed-review-heading">Review catalog changes</h3>
      <p>
        {review.results.length} of {review.draft.memberships.length} listings
        reviewed. Notes and the order of retained entries stay unchanged.
      </p>
      <ul>
        {changes.map(({ previous, listing }) => (
          <li key={previous.listingId}>
            <strong>
              {previous.symbol} · {previous.exchangeMic}
            </strong>
            {listing ? (
              <dl className="managed-metadata">
                {(Object.keys(listing) as (keyof typeof listing)[])
                  .filter((key) => previous[key] !== listing[key])
                  .map((key) => (
                    <div key={key}>
                      <dt>{identityLabels[key]}</dt>
                      <dd>
                        {previous[key]} → {listing[key]}
                      </dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p>
                No longer available in this catalog. Applying the review removes
                this entry and its note from the draft.
              </p>
            )}
          </li>
        ))}
      </ul>
      {!changes.length && (
        <p>No identity changes in the listings reviewed so far.</p>
      )}
      {complete ? (
        <button
          disabled={busy || !workspace.canEdit()}
          onClick={() => workspace.applyReview()}
        >
          {missing
            ? `Apply updates and remove ${missing} unavailable ${missing === 1 ? "entry" : "entries"}`
            : "Apply reviewed catalog"}
        </button>
      ) : (
        <button
          disabled={busy || !workspace.canEdit()}
          onClick={() => void workspace.nextReviewBatch()}
        >
          {busy ? "Reviewing…" : "Review next 50 listings"}
        </button>
      )}
    </section>
  );
}

export function ManagedWorkspaceScreen({
  workspace,
  androidBack,
}: {
  workspace: ManagedWorkspace;
  androidBack?: AndroidBackAdapter;
}) {
  const annualOrigin = useRef<HTMLButtonElement | null>(null);
  const discoverHeading = useRef<HTMLHeadingElement | null>(null);
  const [backUnavailable, setBackUnavailable] = useState(false);
  const backToWorkspace = useCallback(() => {
    workspace.annual.close();
    if (annualOrigin.current?.isConnected) annualOrigin.current.focus();
    else discoverHeading.current?.focus();
    annualOrigin.current = null;
  }, [workspace]);
  useEffect(() => {
    if (!androidBack) return;
    const isRetired = () => {
      const phase = workspace.coordinator.getSnapshot().phase;
      return phase === "retired" || phase === "signing_out";
    };
    if (isRetired()) return;
    const dispose = bindAndroidBack(
      androidBack,
      ({ canGoBack }) => {
        if (isRetired()) return;
        if (workspace.annual.getSnapshot().selection) backToWorkspace();
        else if (canGoBack) window.history.back();
      },
      () => setBackUnavailable(true),
    );
    const unsubscribe = workspace.coordinator.subscribe(() => {
      if (isRetired()) dispose();
    });
    return () => {
      unsubscribe();
      dispose();
    };
  }, [androidBack, workspace, backToWorkspace]);
  const discovery = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const coordinator = workspace.coordinator;
  const saved = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );
  const retired = saved.phase === "retired" || saved.phase === "signing_out";
  const busy = saved.phase !== "idle";
  const editable = workspace.canEdit();
  const currentCatalog =
    discovery.snapshot?.snapshotSha256 === saved.draft?.snapshotSha256;
  const saveIssue = workspace.saveIssue();
  return (
    <div className="managed-workspace">
      <div className="trial-session-bar">
        <p>Shared across your signed-in devices</p>
        <button
          className="trial-secondary"
          disabled={saved.phase === "signing_out"}
          onClick={() => void coordinator.signOut()}
        >
          {saved.signOutFailed
            ? "Try signing out again"
            : "Sign out this session"}
        </button>
      </div>
      <p className="trial-status" role="status" aria-live="polite">
        {saved.message}
      </p>
      {retired ? null : (
        <>
          {backUnavailable && (
            <p role="status">
              Use the on-screen navigation while Android Back is unavailable.
            </p>
          )}
          <ManagedAnnualReport
            model={workspace.annual}
            onBack={backToWorkspace}
          />
          <section
            className="trial-panel"
            aria-labelledby="managed-discover-heading"
          >
            <div className="trial-toolbar">
              <h2
                id="managed-discover-heading"
                ref={discoverHeading}
                tabIndex={-1}
              >
                Discover
              </h2>
              <button
                className="trial-secondary"
                disabled={discovery.busy}
                onClick={() => void workspace.refreshCatalog()}
              >
                Refresh catalog
              </button>
            </div>
            <WorkspaceSearch
              query={discovery.query}
              busy={discovery.busy}
              disabled={retired}
              onChange={(query) => workspace.setQuery(query)}
              onSearch={() => void workspace.search()}
            />
            <p role="status" aria-live="polite">
              {discovery.message}
            </p>
            {discovery.results.length > 0 && (
              <ul className="managed-results">
                {discovery.results.map((result) => {
                  const included = saved.draft?.memberships.some(
                    (member) => member.listingId === result.listingId,
                  );
                  return (
                    <li key={result.listingId}>
                      <div>
                        <ListingIdentity member={result} />
                        <small>{result.securityName}</small>
                        {result.matchKind.startsWith("former_symbol") && (
                          <small>
                            Former ticker match: {result.matchedValue}
                          </small>
                        )}
                      </div>
                      <div className="trial-actions">
                        <button
                          disabled={
                            !editable ||
                            !currentCatalog ||
                            included ||
                            (saved.draft?.memberships.length ?? 0) >= 10_000
                          }
                          onClick={() => workspace.add(result)}
                        >
                          {included ? "Added" : `Add ${result.symbol}`}
                        </button>
                        <button
                          className="trial-secondary"
                          aria-label={`Annual report for ${result.symbol}`}
                          onClick={(event) => {
                            annualOrigin.current = event.currentTarget;
                            workspace.openDiscoveryAnnual(result);
                          }}
                        >
                          Annual report
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {discovery.totalMatches > discovery.results.length && (
              <p>
                Showing the first {discovery.results.length} matches. Refine
                your search to find another listing.
              </p>
            )}
            {discovery.snapshot && (
              <CatalogReceipt snapshot={discovery.snapshot} />
            )}
          </section>
          <section
            className="trial-panel"
            aria-labelledby="managed-watchlist-heading"
          >
            <div className="trial-toolbar">
              <h2 id="managed-watchlist-heading">My Watchlist</h2>
              <button
                className="trial-secondary"
                disabled={busy || saved.uncertain}
                onClick={() => void coordinator.load()}
              >
                Load saved watchlist
              </button>
            </div>
            <p>
              {saved.baseVersion === null
                ? "Load your watchlist to begin."
                : `Version ${saved.baseVersion} · ${saved.dirty ? "Unsaved changes" : "Saved"}`}
            </p>
            {saved.uncertain && (
              <div className="trial-review">
                <p>
                  The save may already have completed. Keep this screen open.
                  Reconciliation sends the original command again; if it never
                  reached the server, this action can complete it.
                </p>
                <button
                  disabled={busy}
                  onClick={() => void coordinator.reconcile()}
                >
                  Reconcile pending save
                </button>
              </div>
            )}
            {saved.conflict && (
              <div className="trial-review">
                <p>
                  {saved.replayPending
                    ? "The original save is confirmed. Load the latest shared version before choosing what to edit next."
                    : "Your draft is intact. Load the latest version, then choose which version to use."}
                </p>
                {saved.latestLoaded && saved.saved && (
                  <>
                    <h3>Saved version {saved.saved.version}</h3>
                    <ol>
                      {saved.saved.payload.memberships.map((member) => (
                        <li key={member.listingId}>
                          <ListingIdentity member={member} />
                          <p className="trial-saved-note">
                            {member.note || "No note"}
                          </p>
                        </li>
                      ))}
                    </ol>
                    <div className="trial-actions">
                      <button
                        disabled={busy}
                        onClick={() => coordinator.useSaved()}
                      >
                        Use saved version
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => coordinator.keepDraft()}
                      >
                        Keep my draft
                      </button>
                    </div>
                    <p>
                      Keeping your draft means the next save replaces this saved
                      version.
                    </p>
                  </>
                )}
              </div>
            )}
            {saved.draft && !currentCatalog && discovery.snapshot && (
              <div className="trial-review">
                <p>
                  Your watchlist uses a different catalog. Review its exact
                  listings before adding, saving or opening an annual report.
                </p>
              </div>
            )}
            {saved.draft && (
              <>
                {saved.draft.memberships.length === 0 && (
                  <p>
                    Your watchlist is empty. Find a company above and add its
                    exact listing.
                  </p>
                )}
                <ol className="managed-memberships">
                  {saved.draft.memberships.map((member, index) => (
                    <li key={member.listingId}>
                      <ListingIdentity member={member} />
                      <small className="managed-listing-detail">
                        Listing ID: {member.listingId}
                      </small>
                      <label htmlFor={`managed-note-${index}`}>
                        Research note for {member.symbol}
                      </label>
                      <textarea
                        id={`managed-note-${index}`}
                        rows={3}
                        maxLength={4000}
                        disabled={!editable}
                        value={member.note}
                        onChange={(event) =>
                          workspace.note(member.listingId, event.target.value)
                        }
                      />
                      <div className="trial-actions">
                        <button
                          className="trial-secondary"
                          disabled={!workspace.canOpenWatchlistAnnual(member)}
                          aria-label={`Annual report for saved ${member.symbol}`}
                          onClick={(event) => {
                            annualOrigin.current = event.currentTarget;
                            workspace.openWatchlistAnnual(member);
                          }}
                        >
                          Annual report
                        </button>
                        <button
                          className="trial-secondary"
                          disabled={!editable || index === 0}
                          aria-label={`Move ${member.symbol} up`}
                          onClick={() => workspace.move(member.listingId, -1)}
                        >
                          Move up
                        </button>
                        <button
                          className="trial-secondary"
                          disabled={
                            !editable ||
                            index === saved.draft!.memberships.length - 1
                          }
                          aria-label={`Move ${member.symbol} down`}
                          onClick={() => workspace.move(member.listingId, 1)}
                        >
                          Move down
                        </button>
                        <button
                          className="trial-secondary"
                          disabled={!editable}
                          aria-label={`Remove ${member.symbol}`}
                          onClick={() => workspace.remove(member.listingId)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                <p>
                  Notes support up to 2,000 characters each. Changes stay in
                  this screen until you save.
                </p>
                <div className="trial-actions">
                  <button
                    disabled={
                      !editable || !saved.dirty || !workspace.canSavePayload()
                    }
                    aria-describedby={
                      saveIssue ? "managed-save-issue" : undefined
                    }
                    onClick={() => void coordinator.save()}
                  >
                    Save watchlist
                  </button>
                  <button
                    className="trial-secondary"
                    disabled={
                      !editable || !discovery.snapshot || discovery.reviewing
                    }
                    onClick={() => void workspace.reviewCatalog()}
                  >
                    Review catalog changes
                  </button>
                </div>
                {saveIssue && (
                  <p id="managed-save-issue" role="status">
                    {saveIssue}
                  </p>
                )}
              </>
            )}
            {discovery.review && (
              <CatalogReviewPanel
                review={discovery.review}
                workspace={workspace}
                busy={discovery.reviewing}
              />
            )}
          </section>
        </>
      )}
      <p className="trial-session-help">
        Other signed-in devices keep their own sessions. Signing out clears this
        screen, including unsaved changes.
      </p>
    </div>
  );
}
