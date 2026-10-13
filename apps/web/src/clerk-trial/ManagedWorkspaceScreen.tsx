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
import {
  ManagedWatchlistEditor,
  type ManagedWatchlistEditorHandle,
} from "./ManagedWatchlistEditor";
import { ManagedMarkets } from "./ManagedMarkets";
import { ManagedFedAnnouncements } from "./ManagedFedAnnouncements";
import { ManagedWatchlistAnnualComparison } from "./ManagedWatchlistAnnualComparison";
import { ManagedBeaReleaseAgenda } from "./ManagedBeaReleaseAgenda";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import { ManagedWatchlistReview } from "./ManagedWatchlistReview";
import { ManagedUnsavedWatchlistReview } from "./ManagedUnsavedWatchlistReview";
import { ManagedSignOut } from "./ManagedSignOut";
import { ThirdPartyNotices } from "./ThirdPartyNotices";
import { ManagedWatchlistExport } from "./ManagedWatchlistExport";
import type { WatchlistExportDeliveryAdapter } from "./watchlist-export-delivery";
import { ManagedIcon } from "./ManagedIcon";
import { bindManagedBrowserUnload } from "./managed-browser-unload";
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
  priceCoverage?: readonly ManagedEodIdentity[];
  warnOnBrowserLeave?: boolean;
  exportDelivery?: WatchlistExportDeliveryAdapter;
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
      {
        ...(initial.marketsCohort
          ? { marketsCohort: initial.marketsCohort }
          : {}),
        ...(initial.priceCoverage
          ? { priceCoverage: initial.priceCoverage }
          : {}),
      },
    );
    const unbindBrowserLeave = initial.warnOnBrowserLeave
      ? bindManagedBrowserUnload(current.coordinator, window)
      : undefined;
    setWorkspace(current);
    void current.coordinator.load();
    void current.refreshCatalog();
    return () => {
      unbindBrowserLeave?.();
      current.coordinator.retire();
    };
  }, [initial]);
  return workspace ? (
    <ManagedWorkspaceRouter
      workspace={workspace}
      {...(initial.androidBack ? { androidBack: initial.androidBack } : {})}
      {...(initial.exportDelivery
        ? { exportDelivery: initial.exportDelivery }
        : {})}
    />
  ) : (
    <div className="managed-workspace-main">
      <main className="managed-workspace-content">
        <p role="status">Loading your workspace…</p>
      </main>
      <ThirdPartyNotices />
    </div>
  );
}

export function ManagedWorkspaceRouter(props: {
  workspace: ManagedWorkspace;
  androidBack?: AndroidBackAdapter;
  exportDelivery?: WatchlistExportDeliveryAdapter;
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
  exportDelivery?: WatchlistExportDeliveryAdapter;
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
  exportDelivery,
}: {
  workspace: ManagedWorkspace;
  androidBack?: AndroidBackAdapter;
  navigation?: ManagedCompanyNavigation;
  exportDelivery?: WatchlistExportDeliveryAdapter;
}) {
  const panelOrigin = useRef<HTMLButtonElement | null>(null);
  const discoverHeading = useRef<HTMLHeadingElement | null>(null);
  const watchlistNavigation = useRef<HTMLButtonElement | null>(null);
  const marketsNavigation = useRef<HTMLButtonElement | null>(null);
  const watchlistPanel = useRef<HTMLElement | null>(null);
  const watchlistEditor = useRef<ManagedWatchlistEditorHandle>(null);
  const watchlistHeading = useRef<HTMLHeadingElement | null>(null);
  const [backUnavailable, setBackUnavailable] = useState(false);
  const [localReturnFocus, setLocalReturnFocus] = useState(0);
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
      setLocalReturnFocus((value) => value + 1);
    }
  }, [routeBack, workspace]);
  useEffect(() => {
    if (navigation?.returnFocus || localReturnFocus) restoreFocus();
  }, [navigation?.returnFocus, localReturnFocus, restoreFocus]);
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
  const watchlistPrices = useSyncExternalStore(
    workspace.watchlistPrices.subscribe,
    workspace.watchlistPrices.getSnapshot,
    workspace.watchlistPrices.getSnapshot,
  );
  const recoveryFocus = useRef<{
    workspace: ManagedWorkspace;
    saved: typeof saved;
    discovery: typeof discovery;
    opener: HTMLButtonElement;
  } | null>(null);
  const workspaceContent = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const request = recoveryFocus.current;
    recoveryFocus.current = null;
    const heading = watchlistHeading.current;
    const panel = watchlistPanel.current;
    if (
      !request ||
      request.workspace !== workspace ||
      request.saved !== coordinator.getSnapshot() ||
      request.discovery !== workspace.getSnapshot() ||
      saved.phase !== "idle" ||
      saved.conflict ||
      discovery.view !== "watchlist" ||
      discovery.research ||
      discovery.companyRoute ||
      hasCompanyRoute?.() ||
      navigation?.invalid ||
      !panel?.isConnected ||
      panel.hidden ||
      !heading?.isConnected ||
      !panel.contains(heading) ||
      heading.getClientRects().length === 0
    )
      return;
    const document = heading.ownerDocument;
    if (
      request.opener.ownerDocument === document &&
      (document.activeElement === request.opener ||
        document.activeElement === document.body)
    )
      heading.focus();
  }, [
    coordinator,
    discovery,
    hasCompanyRoute,
    navigation?.invalid,
    saved,
    workspace,
  ]);
  const chooseWatchlistVersion = (
    choice: "saved" | "draft",
    opener: HTMLButtonElement,
  ) => {
    recoveryFocus.current = null;
    const before = coordinator.getSnapshot();
    const ownedFocus = opener.ownerDocument.activeElement === opener;
    if (choice === "saved") coordinator.useSaved();
    else coordinator.keepDraft();
    const after = coordinator.getSnapshot();
    if (ownedFocus && before.conflict && after !== before && !after.conflict)
      recoveryFocus.current = {
        workspace,
        saved: after,
        discovery: workspace.getSnapshot(),
        opener,
      };
  };
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
    watchlistEditor.current?.focusFirstInvalidNote();
  };
  return (
    <div className="managed-workspace">
      {!retired && (
        <a
          className="managed-skip-link"
          href="#managed-workspace-content"
          onClick={(event) => {
            event.preventDefault();
            const phase = coordinator.getSnapshot().phase;
            const content = workspaceContent.current;
            if (
              phase === "retired" ||
              phase === "signing_out" ||
              !content?.isConnected ||
              content.getClientRects().length === 0
            )
              return;
            content.focus({ preventScroll: true });
            content.scrollIntoView({ block: "start", behavior: "instant" });
          }}
        >
          Skip to workspace content
        </a>
      )}
      <aside className="managed-sidebar">
        <p className="managed-brand" aria-hidden="true">
          Investment
        </p>
        {!retired && (
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
                <ManagedIcon name={view} />
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
        )}
      </aside>
      <div className="managed-workspace-main">
        <header className="managed-workspace-toolbar">
          {!retired && (
            <div className="managed-search-bar">
              <WorkspaceSearch
                query={discovery.query}
                busy={discovery.read !== null}
                busyLabel={
                  discovery.read === "status" ? "Search" : "Searching…"
                }
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
          )}
          <div className="managed-session-controls">
            <ManagedSignOut coordinator={coordinator} />
          </div>
          <p className="managed-save-status" role="status" aria-live="polite">
            {saved.message}
          </p>
        </header>
        <main
          className="managed-workspace-content"
          id="managed-workspace-content"
          ref={workspaceContent}
          tabIndex={-1}
        >
          {retired ? null : (
            <>
              {backUnavailable && (
                <p role="status">
                  Use the on-screen navigation while Android Back is
                  unavailable.
                </p>
              )}
              <p
                className="managed-discovery-status"
                role="status"
                aria-live="polite"
              >
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
                      <button
                        onClick={() => void workspace.retryCompanyRoute()}
                      >
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
                  filings={workspace.filings}
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
                    workspace.addResearchToWatchlist(
                      discovery.research!.selection,
                    )
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
                  annualCashNoteActions={{
                    getAction: (response) =>
                      workspace.getAnnualCashNoteAction(
                        discovery.research!.selection,
                        response,
                      ),
                    append: (response) =>
                      workspace.appendAnnualCashToResearchNote(
                        discovery.research!.selection,
                        response,
                      ),
                  }}
                  annualLiquidityNoteActions={{
                    getAction: (response) =>
                      workspace.getAnnualLiquidityNoteAction(
                        discovery.research!.selection,
                        response,
                      ),
                    append: (response) =>
                      workspace.appendAnnualLiquidityToResearchNote(
                        discovery.research!.selection,
                        response,
                      ),
                  }}
                  priceNoteActions={{
                    getAction: (response, start, end) =>
                      workspace.getPriceNoteAction(
                        discovery.research!.selection,
                        response,
                        start,
                        end,
                      ),
                    append: (response, start, end) =>
                      workspace.appendPriceComparisonToResearchNote(
                        discovery.research!.selection,
                        response,
                        start,
                        end,
                      ),
                  }}
                  filingsNoteActions={{
                    getAction: (response, filing) =>
                      workspace.getFilingsNoteAction(
                        discovery.research!.selection,
                        response,
                        filing,
                      ),
                    append: (response, filing) =>
                      workspace.appendFilingReferenceToResearchNote(
                        discovery.research!.selection,
                        response,
                        filing,
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
                    else if (section === "eod") workspace.switchToEod();
                    else if (section === "filings") workspace.switchToFilings();
                  }}
                />
              )}
              {discovery.view === "markets" && (
                <div
                  hidden={Boolean(
                    discovery.research ||
                    discovery.companyRoute ||
                    navigation?.invalid,
                  )}
                >
                  <ManagedMarkets
                    model={workspace.markets}
                    onResearch={(kind, opener) => {
                      openResearch(opener, () =>
                        workspace.openMarketResearch(kind),
                      );
                    }}
                    onWatchlist={() => {
                      if (!setView("watchlist")) return;
                      watchlistNavigation.current?.focus();
                    }}
                  />
                  <ManagedBeaReleaseAgenda model={workspace.agenda} />
                  <ManagedFedAnnouncements model={workspace.announcements} />
                </div>
              )}
              <section
                className="trial-panel"
                aria-labelledby="managed-discover-heading"
                hidden={
                  discovery.view !== "discover" ||
                  Boolean(
                    discovery.research ||
                    discovery.companyRoute ||
                    navigation?.invalid,
                  )
                }
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
                hidden={
                  discovery.view !== "watchlist" ||
                  Boolean(
                    discovery.research ||
                    discovery.companyRoute ||
                    navigation?.invalid,
                  )
                }
                ref={watchlistPanel}
              >
                <div className="trial-toolbar">
                  <h2
                    id="managed-watchlist-heading"
                    ref={watchlistHeading}
                    tabIndex={-1}
                  >
                    My Watchlist
                  </h2>
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
                <ManagedWatchlistExport
                  workspace={workspace}
                  delivery={exportDelivery}
                  routeActive={() =>
                    !navigation?.invalid && !hasCompanyRoute?.()
                  }
                />
                {saved.uncertain && (
                  <div className="trial-review">
                    <p>
                      The save may already have completed. Keep this screen
                      open. Reconciliation sends the original command again; if
                      it never reached the server, this action can complete it.
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
                            onClick={(event) =>
                              chooseWatchlistVersion(
                                "saved",
                                event.currentTarget,
                              )
                            }
                          >
                            Use saved version
                          </button>
                          <button
                            disabled={busy}
                            onClick={(event) =>
                              chooseWatchlistVersion(
                                "draft",
                                event.currentTarget,
                              )
                            }
                          >
                            Keep my draft
                          </button>
                        </div>
                        <p>
                          Keeping your draft means the next save replaces this
                          saved version.
                        </p>
                      </>
                    )}
                  </div>
                )}
                {saved.draft && !currentCatalog && discovery.snapshot && (
                  <div className="trial-review">
                    <p>
                      Your watchlist uses a different catalog. Review its exact
                      listings before adding, saving or opening an annual report
                      or close history.
                    </p>
                  </div>
                )}
                {saved.draft && (
                  <>
                    <ManagedWatchlistEditor
                      ref={watchlistEditor}
                      memberships={saved.draft.memberships}
                      prices={watchlistPrices}
                      comparisonNoteActions={{
                        getAction: (selection, destination) =>
                          navigation?.invalid || navigation?.hasCompanyRoute()
                            ? {
                                canAppend: false,
                                reason:
                                  "Return to My Watchlist before adding comparison evidence.",
                              }
                            : workspace.getWatchlistComparisonNoteAction(
                                selection,
                                destination,
                              ),
                        append: (selection, destination) =>
                          navigation?.invalid || navigation?.hasCompanyRoute()
                            ? {
                                appended: false,
                                message:
                                  "Return to My Watchlist before adding comparison evidence.",
                              }
                            : workspace.appendWatchlistComparisonToNote(
                                selection,
                                destination,
                              ),
                      }}
                      onLoadPrice={(handle) => {
                        if (!navigation?.invalid)
                          void workspace.loadWatchlistPrice(handle);
                      }}
                      editable={editable}
                      active={
                        discovery.view === "watchlist" &&
                        !discovery.research &&
                        !discovery.companyRoute &&
                        !navigation?.invalid &&
                        !navigation?.hasCompanyRoute()
                      }
                      canOpenAnnual={(member) =>
                        workspace.canOpenWatchlistAnnual(member)
                      }
                      canOpenEod={(member) =>
                        workspace.canOpenWatchlistEod(member)
                      }
                      onNote={(listingId, note) =>
                        workspace.note(listingId, note)
                      }
                      onMove={(listingId, direction) =>
                        workspace.move(listingId, direction)
                      }
                      onRemove={(listingId) => workspace.remove(listingId)}
                      onOpenAnnual={(member, opener) =>
                        openResearch(opener, () =>
                          workspace.openWatchlistAnnual(member),
                        )
                      }
                      onOpenEod={(member, opener) =>
                        openResearch(opener, () =>
                          workspace.openWatchlistEod(member),
                        )
                      }
                    />
                    <p id="managed-watchlist-note-help">
                      Notes support up to 2,000 characters each. Changes stay in
                      this screen until you save.
                    </p>
                    <div className="trial-actions">
                      <button
                        disabled={
                          !editable ||
                          !saved.dirty ||
                          !workspace.canSavePayload()
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
                          !editable ||
                          !discovery.snapshot ||
                          discovery.reviewing
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
                    <ManagedUnsavedWatchlistReview state={saved} />
                    <ManagedWatchlistAnnualComparison
                      model={workspace.annualComparison}
                      onOpenReport={(capture, opener) => {
                        if (
                          navigation?.invalid ||
                          navigation?.hasCompanyRoute()
                        )
                          return;
                        openResearch(opener, () =>
                          workspace.openAnnualComparisonReport(capture),
                        );
                      }}
                      editable={editable}
                      active={
                        discovery.view === "watchlist" &&
                        !discovery.research &&
                        !discovery.companyRoute &&
                        !navigation?.invalid &&
                        !navigation?.hasCompanyRoute()
                      }
                      noteActions={{
                        getAction: (capture, destination) =>
                          navigation?.invalid || navigation?.hasCompanyRoute()
                            ? {
                                canAppend: false,
                                reason:
                                  "Return to My Watchlist before adding Annual comparison evidence.",
                              }
                            : workspace.getAnnualComparisonNoteAction(
                                capture,
                                destination,
                              ),
                        append: (capture, destination) =>
                          navigation?.invalid || navigation?.hasCompanyRoute()
                            ? {
                                appended: false,
                                message:
                                  "Return to My Watchlist before adding Annual comparison evidence.",
                              }
                            : workspace.appendAnnualComparisonToNote(
                                capture,
                                destination,
                              ),
                      }}
                    />
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
        </main>
        <ThirdPartyNotices />
      </div>
    </div>
  );
}
