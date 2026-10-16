import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  membershipMatchesResult,
  normalizeWatchlistNote,
  type ManagedCatalogSnapshotDto,
  type ManagedEodIdentity,
  type MainWatchlistPayload,
  type WatchlistMembership,
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
  type FollowupReview,
} from "./managed-workspace";
import type { TrialSession } from "./session";
import { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import {
  ManagedWatchlistEditor,
  type ManagedWatchlistEditorHandle,
} from "./ManagedWatchlistEditor";
import { ManagedDailyResearchReview } from "./ManagedDailyResearchReview";
import { ManagedMarketsDayView } from "./ManagedMarketsDayView";
import { ManagedMarkets } from "./ManagedMarkets";
import { ManagedResearchFollowups } from "./ManagedResearchFollowups";
import { ManagedMarketsNavigation } from "./ManagedMarketsNavigation";
import { ManagedFedAnnouncements } from "./ManagedFedAnnouncements";
import { ManagedWatchlistAnnualComparison } from "./ManagedWatchlistAnnualComparison";
import type { AnnualComparisonNoteCapture } from "./managed-watchlist-annual-comparison-note";
import type { WatchlistComparisonNoteReviewCapture } from "./ManagedWatchlistComparisonNoteAction";
import { ManagedBeaReleaseAgenda } from "./ManagedBeaReleaseAgenda";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import { ManagedWatchlistReview } from "./ManagedWatchlistReview";
import { ManagedUnsavedWatchlistReview } from "./ManagedUnsavedWatchlistReview";
import { ManagedSignOut } from "./ManagedSignOut";
import { ThirdPartyNotices } from "./ThirdPartyNotices";
import { ManagedWatchlistExport } from "./ManagedWatchlistExport";
import type { CompanyReportDeliveryAdapter } from "./company-report-delivery";
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
  reportDelivery?: CompanyReportDeliveryAdapter;
}

interface NoteReviewRequest {
  workspace: ManagedWorkspace;
  draft: MainWatchlistPayload;
  member: WatchlistMembership;
  origin: Element | null;
  previousReturn: number;
  expectedReturn: number;
  localReturn: number;
  isCurrentContext?: () => boolean;
}

function currentPriceNoteReview(
  workspace: ManagedWorkspace,
  capture: WatchlistComparisonNoteReviewCapture,
  member: WatchlistMembership,
) {
  const prices = workspace.watchlistPrices.getSnapshot();
  const digest = workspace.coordinator.getSnapshot().draft?.snapshotSha256;
  const { left, right } = capture.selection;
  if (
    !prices.active ||
    prices.catalogChanged ||
    prices.pending ||
    !left ||
    !right
  )
    return false;
  if (
    ![left, right].some((source) =>
      membershipMatchesResult(member, source.listing),
    )
  )
    return false;
  return [left, right].every((source, index) => {
    const row = prices.rows.find((item) => item.handle === source.handle);
    return (
      row &&
      source.response !== null &&
      source.catalogSnapshotSha256 === digest &&
      row.history.selection?.catalogSnapshotSha256 === digest &&
      membershipMatchesResult({ ...source.listing, note: "" }, row.listing) &&
      row.history.response === source.response &&
      !row.history.running &&
      !row.history.catalogChanged &&
      row.history.showingPrevious ===
        (index === 0
          ? capture.leftShowingPrevious
          : capture.rightShowingPrevious)
    );
  });
}

function currentAnnualNoteReview(
  workspace: ManagedWorkspace,
  capture: AnnualComparisonNoteCapture,
  member: WatchlistMembership,
) {
  const comparison = workspace.annualComparison.getSnapshot();
  const digest = workspace.coordinator.getSnapshot().draft?.snapshotSha256;
  if (!comparison.active || comparison.catalogChanged || comparison.pending)
    return false;
  if (
    ![capture.left, capture.right].some((side) =>
      membershipMatchesResult(member, side.member.listing),
    )
  )
    return false;
  return (["left", "right"] as const).every((side) => {
    const current = comparison[side];
    const observed = capture[side];
    return (
      current.selected === observed.member &&
      current.report.response === observed.response &&
      current.report.showingPrevious === observed.showingPrevious &&
      !current.report.running &&
      !current.report.catalogChanged &&
      observed.response.catalogSnapshotSha256 === digest
    );
  });
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
      ? bindManagedBrowserUnload(current.sessionOwner, window)
      : undefined;
    setWorkspace(current);
    void current.coordinator.load();
    void current.refreshCatalog();
    return () => {
      unbindBrowserLeave?.();
      current.sessionOwner.dispose();
    };
  }, [initial]);
  return workspace ? (
    <ManagedWorkspaceRouter
      workspace={workspace}
      {...(initial.androidBack ? { androidBack: initial.androidBack } : {})}
      {...(initial.reportDelivery
        ? { reportDelivery: initial.reportDelivery }
        : {})}
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
  reportDelivery?: CompanyReportDeliveryAdapter;
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
  reportDelivery?: CompanyReportDeliveryAdapter;
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

function revealReturnedTarget(target: HTMLElement, view: Window) {
  const viewport = view.visualViewport ?? {
    offsetTop: 0,
    offsetLeft: 0,
    height: view.innerHeight,
    width: view.innerWidth,
  };
  let bottom = viewport.offsetTop + viewport.height;
  const navigation = target
    .closest(".managed-workspace")
    ?.querySelector(".managed-navigation");
  if (
    navigation &&
    !navigation.contains(target) &&
    view.getComputedStyle(navigation).position === "fixed"
  ) {
    const rect = navigation.getBoundingClientRect();
    if (rect.top > viewport.offsetTop && rect.bottom >= bottom)
      bottom = Math.min(bottom, rect.top);
  }
  const rect = target.getBoundingClientRect();
  if (
    rect.top < viewport.offsetTop ||
    rect.bottom > bottom ||
    rect.left < viewport.offsetLeft ||
    rect.right > viewport.offsetLeft + viewport.width
  )
    target.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
}

export function ManagedWorkspaceScreen({
  workspace,
  androidBack,
  navigation,
  exportDelivery,
  reportDelivery,
}: {
  workspace: ManagedWorkspace;
  androidBack?: AndroidBackAdapter;
  navigation?: ManagedCompanyNavigation;
  exportDelivery?: WatchlistExportDeliveryAdapter;
  reportDelivery?: CompanyReportDeliveryAdapter;
}) {
  const panelOrigin = useRef<HTMLButtonElement | null>(null);
  const discoverHeading = useRef<HTMLHeadingElement | null>(null);
  const watchlistNavigation = useRef<HTMLButtonElement | null>(null);
  const marketsNavigation = useRef<HTMLButtonElement | null>(null);
  const followupsNavigation = useRef<HTMLButtonElement | null>(null);
  const watchlistPanel = useRef<HTMLElement | null>(null);
  const watchlistEditor = useRef<ManagedWatchlistEditorHandle>(null);
  const watchlistHeading = useRef<HTMLHeadingElement | null>(null);
  const [backUnavailable, setBackUnavailable] = useState(false);
  const [localReturnFocus, setLocalReturnFocus] = useState(0);
  const routeBack = navigation?.back;
  const hasCompanyRoute = navigation?.hasCompanyRoute;
  const restoreFocus = useCallback(() => {
    const returned = workspace.getSnapshot();
    const target = panelOrigin.current?.isConnected
      ? panelOrigin.current
      : returned.view === "markets"
        ? marketsNavigation.current
        : returned.view === "watchlist"
          ? watchlistNavigation.current
          : returned.view === "followups"
            ? followupsNavigation.current
            : discoverHeading.current;
    panelOrigin.current = null;
    target?.focus();
    const view = target?.ownerDocument?.defaultView;
    if (!target || !view) return;
    let active = true;
    // Recheck once after the return render, without changing browser history.
    const frame = view.requestAnimationFrame(() => {
      const phase = workspace.coordinator.getSnapshot().phase;
      if (
        !active ||
        workspace.getSnapshot() !== returned ||
        returned.research ||
        returned.companyRoute ||
        phase === "retired" ||
        phase === "signing_out" ||
        !target.isConnected ||
        target.getClientRects().length === 0 ||
        target.ownerDocument.activeElement !== target
      )
        return;
      revealReturnedTarget(target, view);
    });
    return () => {
      active = false;
      view.cancelAnimationFrame(frame);
    };
  }, [workspace]);
  const backToWorkspace = useCallback(() => {
    if (routeBack) routeBack();
    else {
      workspace.closeResearch();
      setLocalReturnFocus((value) => value + 1);
    }
  }, [routeBack, workspace]);
  useEffect(() => {
    const handled = noteReviewReturn.current;
    if (
      handled?.route === (navigation?.returnFocus ?? 0) &&
      handled.local === localReturnFocus
    )
      return;
    if (navigation?.returnFocus || localReturnFocus) return restoreFocus();
  }, [navigation?.returnFocus, localReturnFocus, restoreFocus]);
  const setView = (
    view: "markets" | "discover" | "watchlist" | "followups",
  ) => {
    if (navigation?.isPending()) return false;
    liveNoteReview.current = null;
    setNoteReview(null);
    setNoteReviewNotice(null);
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
  const sessionState = useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
    workspace.sessionOwner.getSnapshot,
  );
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
  const marketsContent = useRef<HTMLDivElement | null>(null);
  const marketsHeading = useRef<HTMLHeadingElement | null>(null);
  const agendaHeading = useRef<HTMLHeadingElement | null>(null);
  const announcementsHeading = useRef<HTMLHeadingElement | null>(null);
  const dailyReviewHeading = useRef<HTMLHeadingElement | null>(null);
  const dayViewHeading = useRef<HTMLHeadingElement | null>(null);
  const [noteReview, setNoteReview] = useState<NoteReviewRequest | null>(null);
  const [noteReviewNotice, setNoteReviewNotice] = useState<string | null>(null);
  const [followupReview, setFollowupReview] = useState<FollowupReview | null>(
    null,
  );
  const liveNoteReview = useRef<NoteReviewRequest | null>(null);
  const noteReviewReturn = useRef<{ route: number; local: number } | null>(
    null,
  );
  const reviewNavigation = useRef({ navigation, localReturnFocus });
  useLayoutEffect(() => {
    reviewNavigation.current = { navigation, localReturnFocus };
  }, [navigation, localReturnFocus]);
  useLayoutEffect(
    () => () => {
      liveNoteReview.current = null;
    },
    [workspace],
  );
  const currentReviewDraft = (request: NoteReviewRequest) => {
    const current = workspace.getSnapshot();
    const currentSaved = coordinator.getSnapshot();
    return (
      liveNoteReview.current === request &&
      request.workspace === workspace &&
      currentSaved.phase !== "retired" &&
      currentSaved.phase !== "signing_out" &&
      currentSaved.draft === request.draft &&
      request.draft.memberships.includes(request.member) &&
      (request.isCurrentContext?.() ?? true) &&
      current.snapshot?.snapshotSha256 === request.draft.snapshotSha256 &&
      current.view === "watchlist" &&
      !current.research &&
      !current.companyRoute
    );
  };
  const currentNoteReview = (request: NoteReviewRequest) => {
    const route = reviewNavigation.current.navigation;
    return (
      currentReviewDraft(request) &&
      !route?.invalid &&
      !route?.hasCompanyRoute() &&
      reviewNavigation.current.localReturnFocus === request.localReturn &&
      (route?.returnFocus ?? 0) === request.expectedReturn
    );
  };
  useLayoutEffect(() => {
    const request = liveNoteReview.current;
    if (!request) return;
    const route = reviewNavigation.current.navigation;
    if (
      noteReview === request &&
      currentReviewDraft(request) &&
      !route?.invalid &&
      reviewNavigation.current.localReturnFocus === request.localReturn &&
      request.expectedReturn > request.previousReturn &&
      route?.returnFocus === request.previousReturn
    )
      return;
    if (!currentNoteReview(request)) {
      liveNoteReview.current = null;
      setNoteReview(null);
      return;
    }
    if (noteReview !== request) return;
    setNoteReview(null);
    watchlistEditor.current?.reviewNote({
      member: request.member,
      origin: request.origin,
      isCurrent: () => currentNoteReview(request),
    });
  });
  const reviewWatchlistNote = (
    member: WatchlistMembership | null,
    isCurrentContext?: () => boolean,
  ) => {
    if (navigation?.isPending()) return;
    if (isCurrentContext && !isCurrentContext()) return;
    const draft = coordinator.getSnapshot().draft;
    if (member && !draft?.memberships.includes(member)) return;
    const origin =
      typeof document === "undefined" ? null : document.activeElement;
    const previousReturn = navigation?.returnFocus ?? 0;
    const expectedReturn = previousReturn + (hasCompanyRoute?.() ? 1 : 0);
    if (!setView("watchlist")) return;
    panelOrigin.current = null;
    if (!member || !draft) {
      setNoteReviewNotice("No current note is available for this company.");
      watchlistNavigation.current?.focus();
      return;
    }
    const request = {
      workspace,
      draft,
      member,
      origin,
      previousReturn,
      expectedReturn,
      localReturn: localReturnFocus,
      ...(isCurrentContext ? { isCurrentContext } : {}),
    };
    // This return belongs to Review even if its target changes before commit.
    noteReviewReturn.current = {
      route: expectedReturn,
      local: localReturnFocus,
    };
    liveNoteReview.current = request;
    setNoteReview(request);
  };
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
  const retired = sessionState.phase !== "active";
  const navigationPending = navigation?.pending ?? false;
  const busy = saved.phase !== "idle";
  const editable = workspace.canEdit();
  const isMarketsCurrent = () => {
    const current = workspace.getSnapshot();
    const phase = coordinator.getSnapshot().phase;
    return (
      phase !== "retired" &&
      phase !== "signing_out" &&
      current.view === "markets" &&
      !current.research &&
      !current.companyRoute &&
      !navigation?.invalid &&
      !hasCompanyRoute?.()
    );
  };
  const marketsSectionNavigation = {
    containerRef: marketsContent,
    targets: {
      board: { id: "managed-markets-heading", ref: marketsHeading },
      review: { id: "managed-daily-research-heading", ref: dailyReviewHeading },
      day: { id: "managed-markets-day-heading", ref: dayViewHeading },
      calendar: { id: "bea-agenda-title", ref: agendaHeading },
      announcements: {
        id: "fed-announcements-title",
        ref: announcementsHeading,
      },
    },
    isCurrent: isMarketsCurrent,
  };
  const currentCatalog =
    discovery.snapshot?.snapshotSha256 === saved.draft?.snapshotSha256;
  const canReviewWatchlistMember = (member: WatchlistMembership) => {
    const current = workspace.getSnapshot();
    const state = coordinator.getSnapshot();
    const route = reviewNavigation.current.navigation;
    return (
      state.phase !== "retired" &&
      state.phase !== "signing_out" &&
      state.draft?.memberships.includes(member) === true &&
      current.snapshot?.snapshotSha256 === state.draft.snapshotSha256 &&
      current.view === "watchlist" &&
      !current.research &&
      !current.companyRoute &&
      !route?.invalid &&
      !route?.hasCompanyRoute()
    );
  };
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
            {(["markets", "discover", "watchlist", "followups"] as const).map(
              (view) => (
                <button
                  key={view}
                  ref={
                    view === "watchlist"
                      ? watchlistNavigation
                      : view === "markets"
                        ? marketsNavigation
                        : view === "followups"
                          ? followupsNavigation
                          : undefined
                  }
                  className="trial-secondary"
                  aria-current={discovery.view === view ? "page" : undefined}
                  disabled={navigationPending}
                  onClick={() => setView(view)}
                >
                  <ManagedIcon name={view} />
                  {
                    {
                      markets: "Markets",
                      discover: "Discover",
                      watchlist: "My Watchlist",
                      followups: "Follow-ups",
                    }[view]
                  }
                </button>
              ),
            )}
          </nav>
        )}
      </aside>
      <div className="managed-workspace-main">
        <header className="managed-workspace-toolbar">
          {!retired && (
            <div className="managed-search-bar">
              <WorkspaceSearch
                query={discovery.query}
                busy={discovery.read !== null || navigationPending}
                busyLabel={
                  discovery.read === "status" || navigationPending
                    ? "Search"
                    : "Searching…"
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
            <ManagedSignOut owner={workspace.sessionOwner} />
          </div>
          <p className="managed-save-status" role="status" aria-live="polite">
            {retired ? sessionState.message : saved.message}
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
                  <button
                    disabled={navigationPending}
                    onClick={backToWorkspace}
                  >
                    Back to Markets
                  </button>
                </section>
              )}
              {discovery.companyRoute &&
                discovery.companyRoute.status !== "open" && (
                  <section aria-label="Company link">
                    <p role="status">{discovery.companyRoute.message}</p>
                    {(discovery.companyRoute.status === "unavailable" ||
                      discovery.companyRoute.status === "error") && (
                      <button
                        disabled={navigationPending}
                        onClick={() => void workspace.retryCompanyRoute()}
                      >
                        Retry company link
                      </button>
                    )}
                    <button
                      disabled={navigationPending}
                      onClick={backToWorkspace}
                    >
                      Back to workspace
                    </button>
                  </section>
                )}
              {discovery.research && (
                <ManagedCompanyResearch
                  navigationPending={navigationPending}
                  research={discovery.research}
                  {...(reportDelivery ? { reportDelivery } : {})}
                  readReportWatchlist={(selection) =>
                    workspace.getResearchWatchlist(selection)
                  }
                  annual={workspace.annual}
                  filings={workspace.filings}
                  eod={workspace.eod}
                  companyNavigationState={workspace.getResearchCompanyNavigation(
                    discovery.research,
                  )}
                  canOpenCompany={(visit, member) =>
                    !navigation?.invalid &&
                    workspace.canOpenResearchCompany(visit, member)
                  }
                  onOpenCompany={(visit, member) => {
                    if (
                      navigation?.invalid ||
                      !workspace.canOpenResearchCompany(visit, member)
                    )
                      return;
                    const open = () =>
                      workspace.openResearchCompany(visit, member);
                    // Keep the original workspace opener for the final Back.
                    if (navigation) navigation.open(open);
                    else open();
                  }}
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
                  onNote={(note, expectedNote) =>
                    workspace.noteResearch(
                      discovery.research!.selection,
                      note,
                      expectedNote,
                    )
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
                  annualOperatingNoteActions={{
                    getAction: (response, basis) =>
                      workspace.getAnnualOperatingNoteAction(
                        discovery.research!.selection,
                        response,
                        basis,
                      ),
                    append: (response, basis) =>
                      workspace.appendAnnualOperatingToResearchNote(
                        discovery.research!.selection,
                        response,
                        basis,
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
                    reviewWatchlistNote(
                      workspace.getResearchWatchlist(
                        discovery.research!.selection,
                      ).member,
                    );
                  }}
                  onRequestSource={async (section) => {
                    const visit = discovery.research!;
                    if (
                      navigation?.isPending() ||
                      navigation?.invalid ||
                      workspace.getSnapshot().research?.selection !==
                        visit.selection
                    )
                      return;
                    const reading = workspace.requestResearchSource(
                      visit,
                      section,
                    );
                    const current = workspace.getSnapshot().research;
                    if (
                      current?.selection === visit.selection &&
                      current.section === section
                    )
                      navigation?.section(section);
                    await reading;
                  }}
                  onCancelSource={(section) => {
                    if (navigation?.invalid) return;
                    workspace.cancelResearchSource(
                      discovery.research!,
                      section,
                    );
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
              {discovery.view === "followups" && (
                <div
                  hidden={Boolean(
                    discovery.research ||
                    discovery.companyRoute ||
                    navigation?.invalid,
                  )}
                >
                  <ManagedResearchFollowups
                    review={followupReview}
                    navigationPending={navigationPending}
                    workspace={workspace}
                    onResearch={(entry, opener) => {
                      if (navigation?.isPending()) return;
                      void workspace
                        .prepareFollowupResearch(entry)
                        .then((capture) => {
                          if (capture)
                            openResearch(opener, () =>
                              workspace.openFollowupResearch(capture),
                            );
                        });
                    }}
                  />
                </div>
              )}
              {discovery.view === "markets" && (
                <div
                  ref={marketsContent}
                  className="managed-markets-content"
                  hidden={Boolean(
                    discovery.research ||
                    discovery.companyRoute ||
                    navigation?.invalid,
                  )}
                >
                  <ManagedMarkets
                    navigationPending={navigationPending}
                    model={workspace.markets}
                    headingRef={marketsHeading}
                    sectionNavigation={
                      <ManagedMarketsNavigation {...marketsSectionNavigation} />
                    }
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
                  <ManagedDailyResearchReview
                    workspace={workspace}
                    navigationPending={navigationPending}
                    headingRef={dailyReviewHeading}
                    isCurrent={isMarketsCurrent}
                    onReview={(entry) => {
                      const request = workspace.reviewFollowup(entry, () =>
                        setView("followups"),
                      );
                      if (request) setFollowupReview(request);
                    }}
                    onManage={() => {
                      if (!setView("followups")) return;
                      setFollowupReview(null);
                      followupsNavigation.current?.focus();
                    }}
                  />
                  <ManagedMarketsDayView
                    agenda={workspace.agenda}
                    announcements={workspace.announcements}
                    navigation={marketsSectionNavigation}
                    headingRef={dayViewHeading}
                  />
                  <ManagedBeaReleaseAgenda
                    model={workspace.agenda}
                    headingRef={agendaHeading}
                    noteContext={{
                      members: saved.draft?.memberships ?? [],
                      active: isMarketsCurrent(),
                      editable,
                      actions: {
                        getAction: (capture, destination) =>
                          isMarketsCurrent()
                            ? workspace.getBeaReleaseNoteAction(
                                capture,
                                destination,
                              )
                            : {
                                canAppend: false,
                                reason:
                                  "Return to Markets with an editable current watchlist before adding a release.",
                              },
                        append: (capture, destination) =>
                          isMarketsCurrent()
                            ? workspace.appendBeaReleaseToNote(
                                capture,
                                destination,
                              )
                            : {
                                appended: false,
                                message:
                                  "Return to Markets with an editable current watchlist before adding a release.",
                              },
                      },
                      onReview: (member) => {
                        if (
                          !isMarketsCurrent() ||
                          !workspace.canEdit() ||
                          workspace.agenda.getSnapshot().busy
                        )
                          return;
                        reviewWatchlistNote(member);
                      },
                    }}
                  />
                  <ManagedFedAnnouncements
                    model={workspace.announcements}
                    headingRef={announcementsHeading}
                    noteContext={{
                      members: saved.draft?.memberships ?? [],
                      active: isMarketsCurrent(),
                      editable,
                      actions: {
                        getAction: (capture, destination) =>
                          isMarketsCurrent()
                            ? workspace.getFedAnnouncementNoteAction(
                                capture,
                                destination,
                              )
                            : {
                                canAppend: false,
                                reason:
                                  "Return to Markets with an editable current watchlist before adding an announcement.",
                              },
                        append: (capture, destination) =>
                          isMarketsCurrent()
                            ? workspace.appendFedAnnouncementToNote(
                                capture,
                                destination,
                              )
                            : {
                                appended: false,
                                message:
                                  "Return to Markets with an editable current watchlist before adding an announcement.",
                              },
                      },
                      onReview: (member) => {
                        if (
                          !isMarketsCurrent() ||
                          !workspace.canEdit() ||
                          workspace.announcements.getSnapshot().busy
                        )
                          return;
                        reviewWatchlistNote(member);
                      },
                    }}
                  />
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
                              disabled={navigationPending}
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
                              disabled={navigationPending}
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
                {noteReviewNotice && <p role="status">{noteReviewNotice}</p>}
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
                      filings={workspace.watchlistFilings}
                      onSelectedMember={(member) => {
                        if (
                          !navigation?.invalid &&
                          !navigation?.hasCompanyRoute()
                        )
                          workspace.selectWatchlistFilingsMember(member);
                      }}
                      onViewFilings={(capture, opener) => {
                        if (
                          navigation?.invalid ||
                          navigation?.hasCompanyRoute()
                        )
                          return;
                        openResearch(opener, () =>
                          workspace.openWatchlistFilings(capture),
                        );
                      }}
                      comparisonNoteActions={{
                        review: (capture, member, isCurrentChoice) => {
                          const isCurrent = () =>
                            isCurrentChoice() &&
                            canReviewWatchlistMember(member) &&
                            currentPriceNoteReview(workspace, capture, member);
                          reviewWatchlistNote(member, isCurrent);
                        },
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
                        !navigationPending &&
                        workspace.canOpenWatchlistAnnual(member)
                      }
                      canOpenEod={(member) =>
                        !navigationPending &&
                        workspace.canOpenWatchlistEod(member)
                      }
                      onNote={(listingId, note, expectedNote) =>
                        workspace.note(listingId, note, expectedNote)
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
                      memberships={saved.draft.memberships}
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
                        review: (capture, member, isCurrentChoice) => {
                          const isCurrent = () =>
                            isCurrentChoice() &&
                            canReviewWatchlistMember(member) &&
                            currentAnnualNoteReview(workspace, capture, member);
                          reviewWatchlistNote(member, isCurrent);
                        },
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
