import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  normalizeWatchlistNote,
  type ManagedCatalogSnapshotDto,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import { BrowserRouter } from "react-router";
import {
  useManagedCompanyNavigation,
  type ManagedCompanyNavigation,
} from "./useManagedCompanyNavigation";
import { WorkspaceSearch } from "../features/workspace/WorkspaceSearch";
import { createManagedApi, type ManagedApi } from "./managed-api";
import {
  ManagedWorkspace,
  reviewChanges,
  type CatalogReview,
} from "./managed-workspace";
import type { TrialSession } from "./session";
import { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import { ManagedNoteEditor } from "./ManagedNoteEditor";
import { ManagedMarkets } from "./ManagedMarkets";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import { ManagedWatchlistReview } from "./ManagedWatchlistReview";
import { ManagedSignOut } from "./ManagedSignOut";
import {
  bindAndroidBack,
  type AndroidBackAdapter,
} from "../mobile/android-back";

interface SessionProps {
  session: TrialSession;
  apiOrigin: string;
  api?: ManagedApi;
  androidBack?: AndroidBackAdapter;
  marketsCohort?: readonly ManagedEodIdentity[];
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
      undefined,
      initial.marketsCohort ? { marketsCohort: initial.marketsCohort } : {},
    );
    setWorkspace(current);
    void current.coordinator.load();
    void current.refreshCatalog();
    return () => current.coordinator.retire();
  }, [initial]);
  return workspace ? (
    <ManagedWorkspaceRouter
      workspace={workspace}
      {...(initial.androidBack ? { androidBack: initial.androidBack } : {})}
    />
  ) : (
    <p role="status">Loading your workspace…</p>
  );
}

export function ManagedWorkspaceRouter(props: {
  workspace: ManagedWorkspace;
  androidBack?: AndroidBackAdapter;
}) {
  return (
    <BrowserRouter>
      <RoutedWorkspace {...props} />
    </BrowserRouter>
  );
}

function RoutedWorkspace(props: {
  workspace: ManagedWorkspace;
  androidBack?: AndroidBackAdapter;
}) {
  const navigation = useManagedCompanyNavigation(props.workspace);
  return <ManagedWorkspaceScreen {...props} navigation={navigation} />;
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
  navigation,
}: {
  workspace: ManagedWorkspace;
  androidBack?: AndroidBackAdapter;
  navigation?: ManagedCompanyNavigation;
}) {
  const panelOrigin = useRef<HTMLButtonElement | null>(null);
  const discoverHeading = useRef<HTMLHeadingElement | null>(null);
  const watchlistNavigation = useRef<HTMLButtonElement | null>(null);
  const marketsNavigation = useRef<HTMLButtonElement | null>(null);
  const watchlistPanel = useRef<HTMLElement | null>(null);
  const [backUnavailable, setBackUnavailable] = useState(false);
  const routeBack = navigation?.back;
  const hasCompanyRoute = navigation?.hasCompanyRoute;
  const restoreFocus = useCallback(() => {
    if (panelOrigin.current?.isConnected) panelOrigin.current.focus();
    else if (workspace.getSnapshot().view === "markets")
      marketsNavigation.current?.focus();
    else if (workspace.getSnapshot().view === "watchlist")
      watchlistNavigation.current?.focus();
    else discoverHeading.current?.focus();
    panelOrigin.current = null;
  }, [workspace]);
  const backToWorkspace = useCallback(() => {
    if (routeBack) routeBack();
    else {
      workspace.closeResearch();
      restoreFocus();
    }
  }, [routeBack, restoreFocus, workspace]);
  useEffect(() => {
    if (navigation?.returnFocus) restoreFocus();
  }, [navigation?.returnFocus, restoreFocus]);
  const setView = (view: "markets" | "discover" | "watchlist") => {
    if (navigation) return navigation.view(view);
    workspace.setView(view);
    return true;
  };
  const openResearch = (opener: HTMLButtonElement, action: () => void) => {
    const open = () => {
      action();
      if (workspace.getSnapshot().research) panelOrigin.current = opener;
    };
    if (navigation) navigation.open(open);
    else open();
  };
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
        if (
          hasCompanyRoute?.() ||
          workspace.getSnapshot().research ||
          workspace.getSnapshot().companyRoute ||
          navigation?.invalid
        )
          backToWorkspace();
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
  }, [
    androidBack,
    workspace,
    backToWorkspace,
    hasCompanyRoute,
    navigation?.invalid,
  ]);
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
  const hasInvalidNote = saved.draft?.memberships.some(
    (member) => normalizeWatchlistNote(member.note) === null,
  );
  const focusFirstInvalidNote = () => {
    const current = workspace.getSnapshot();
    const panel = watchlistPanel.current;
    if (
      !workspace.canEdit() ||
      current.view !== "watchlist" ||
      current.research ||
      !panel?.isConnected ||
      panel.hidden
    )
      return;
    const member = workspace.coordinator
      .getSnapshot()
      .draft?.memberships.find(
        (entry) => normalizeWatchlistNote(entry.note) === null,
      );
    if (!member) return;
    const field = Array.from(
      panel.querySelectorAll<HTMLTextAreaElement>(
        "textarea[data-managed-note-listing-id]",
      ),
    ).find((input) => input.dataset.managedNoteListingId === member.listingId);
    if (
      field?.isConnected &&
      !field.disabled &&
      field.value === member.note &&
      field.getClientRects().length > 0
    )
      field.focus();
  };
  return (
    <div className="managed-workspace">
      <ManagedSignOut coordinator={coordinator} />
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
          <nav className="managed-navigation" aria-label="Workspace">
            {(["markets", "discover", "watchlist"] as const).map((view) => (
              <button
                key={view}
                ref={
                  view === "watchlist"
                    ? watchlistNavigation
                    : view === "markets"
                      ? marketsNavigation
                      : undefined
                }
                className="trial-secondary"
                aria-current={discovery.view === view ? "page" : undefined}
                onClick={() => setView(view)}
              >
                {
                  {
                    markets: "Markets",
                    discover: "Discover",
                    watchlist: "My Watchlist",
                  }[view]
                }
              </button>
            ))}
          </nav>
          <div className="managed-search-bar">
            <WorkspaceSearch
              query={discovery.query}
              busy={discovery.read !== null}
              busyLabel={discovery.read === "status" ? "Search" : "Searching…"}
              disabled={retired}
              onChange={(query) => workspace.setQuery(query)}
              onSearch={() => {
                if (!setView("discover")) return;
                void workspace.search();
              }}
            />
            <button
              className="trial-secondary"
              disabled={discovery.read !== null}
              onClick={() => void workspace.refreshCatalog()}
            >
              {discovery.read === "status"
                ? discovery.snapshot
                  ? "Refreshing catalog…"
                  : "Loading catalog…"
                : "Refresh catalog"}
            </button>
          </div>
          <p role="status" aria-live="polite">
            {discovery.message}
          </p>
          {navigation?.invalid && (
            <section aria-label="Company link">
              <p role="status">
                This company link is invalid. Open a company from Markets,
                Discover or My Watchlist.
              </p>
              <button onClick={backToWorkspace}>Back to Markets</button>
            </section>
          )}
          {discovery.companyRoute &&
            discovery.companyRoute.status !== "open" && (
              <section aria-label="Company link">
                <p role="status">{discovery.companyRoute.message}</p>
                {(discovery.companyRoute.status === "unavailable" ||
                  discovery.companyRoute.status === "error") && (
                  <button onClick={() => void workspace.retryCompanyRoute()}>
                    Retry company link
                  </button>
                )}
                <button onClick={backToWorkspace}>Back to workspace</button>
              </section>
            )}
          {discovery.research && (
            <ManagedCompanyResearch
              research={discovery.research}
              annual={workspace.annual}
              eod={workspace.eod}
              onBack={() => {
                if (
                  workspace.getSnapshot().research?.selection ===
                  discovery.research!.selection
                )
                  backToWorkspace();
              }}
              watchlist={workspace.getResearchWatchlist(
                discovery.research.selection,
              )}
              onAdd={() =>
                workspace.addResearchToWatchlist(discovery.research!.selection)
              }
              onNote={(note) =>
                workspace.noteResearch(discovery.research!.selection, note)
              }
              annualNoteActions={{
                getAction: (response, pair) =>
                  workspace.getAnnualNoteAction(
                    discovery.research!.selection,
                    response,
                    pair,
                  ),
                append: (response, pair) =>
                  workspace.appendAnnualToResearchNote(
                    discovery.research!.selection,
                    response,
                    pair,
                  ),
              }}
              priceNoteActions={{
                getAction: (response, start) =>
                  workspace.getPriceNoteAction(
                    discovery.research!.selection,
                    response,
                    start,
                  ),
                append: (response, start) =>
                  workspace.appendPriceComparisonToResearchNote(
                    discovery.research!.selection,
                    response,
                    start,
                  ),
              }}
              onReview={() => {
                if (
                  workspace.getSnapshot().research?.selection !==
                  discovery.research!.selection
                )
                  return;
                if (!setView("watchlist")) return;
                panelOrigin.current = null;
                watchlistNavigation.current?.focus();
              }}
              onSection={(section) => {
                if (
                  workspace.getSnapshot().research?.selection !==
                  discovery.research!.selection
                )
                  return;
                if (navigation) navigation.section(section);
                else if (section === "annual") workspace.switchToAnnual();
                else workspace.switchToEod();
              }}
            />
          )}
          {discovery.view === "markets" && (
            <ManagedMarkets
              model={workspace.markets}
              onResearch={(kind, opener) => {
                openResearch(opener, () => workspace.openMarketResearch(kind));
              }}
              onWatchlist={() => {
                if (!setView("watchlist")) return;
                watchlistNavigation.current?.focus();
              }}
            />
          )}
          <section
            className="trial-panel"
            aria-labelledby="managed-discover-heading"
            hidden={discovery.view !== "discover"}
          >
            <div className="trial-toolbar">
              <h2
                id="managed-discover-heading"
                ref={discoverHeading}
                tabIndex={-1}
              >
                Discover
              </h2>
            </div>
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
                            openResearch(event.currentTarget, () =>
                              workspace.openDiscoveryAnnual(result),
                            );
                          }}
                        >
                          Annual report
                        </button>
                        <button
                          className="trial-secondary"
                          aria-label={`EOD close history for ${result.symbol}`}
                          onClick={(event) => {
                            openResearch(event.currentTarget, () =>
                              workspace.openDiscoveryEod(result),
                            );
                          }}
                        >
                          EOD close history
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
            hidden={discovery.view !== "watchlist"}
            ref={watchlistPanel}
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
                {saved.latestLoaded && saved.saved && saved.draft && (
                  <>
                    <ManagedWatchlistReview
                      saved={saved.saved.payload}
                      draft={saved.draft}
                      version={saved.saved.version}
                    />
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
                  listings before adding, saving or opening an annual report or
                  close history.
                </p>
              </div>
            )}
            {saved.draft && (
              <>
                {saved.draft.memberships.length === 0 && (
                  <p>
                    Your watchlist is empty. Search for a company and add its
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
                      <ManagedNoteEditor
                        id={`managed-note-${index}`}
                        listingId={member.listingId}
                        symbol={member.symbol}
                        note={member.note}
                        disabled={!editable}
                        helpId="managed-watchlist-note-help"
                        onChange={(note) =>
                          workspace.note(member.listingId, note)
                        }
                      />
                      <div className="trial-actions">
                        <button
                          className="trial-secondary"
                          disabled={!workspace.canOpenWatchlistAnnual(member)}
                          aria-label={`Annual report for saved ${member.symbol}`}
                          onClick={(event) => {
                            openResearch(event.currentTarget, () =>
                              workspace.openWatchlistAnnual(member),
                            );
                          }}
                        >
                          Annual report
                        </button>
                        <button
                          className="trial-secondary"
                          disabled={!workspace.canOpenWatchlistEod(member)}
                          aria-label={`EOD close history for saved ${member.symbol}`}
                          onClick={(event) => {
                            openResearch(event.currentTarget, () =>
                              workspace.openWatchlistEod(member),
                            );
                          }}
                        >
                          EOD close history
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
                <p id="managed-watchlist-note-help">
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
                  {hasInvalidNote && (
                    <button
                      id="managed-note-validation-focus"
                      className="trial-secondary"
                      disabled={!editable}
                      onClick={focusFirstInvalidNote}
                    >
                      Go to first invalid note
                    </button>
                  )}
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
