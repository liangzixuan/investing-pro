import type { PortfolioComparisonReportDeliveryAdapter } from "./portfolio-comparison-report-ports";
import type { ManagedResearchDraftSetFileDeliveryAdapter } from "./research-draft-set-file-delivery";
import { ManagedResearchDraftSetFiles } from "./ManagedResearchDraftSetFiles";
import type { ScreenComparisonReportDeliveryAdapter } from "./screen-comparison-report-ports";
import {
  ManagedPortfolioDatedReview,
  type PortfolioDatedReviewFocus,
} from "./ManagedPortfolioDatedReview";
import { ManagedMarketsBriefing } from "./ManagedMarketsBriefing";
import { ManagedMarketsDatedChecks } from "./ManagedMarketsDatedChecks";
import { managedResearchDraftProps } from "./managed-research-draft-props";
import type { ManagedFinancialScreenRecipeDeliveryAdapter } from "./financial-screen-recipe-delivery";
import {
  managedResearchCompanyNavigationProps,
  managedResearchOpener,
} from "./managed-research-company-navigation-props";
import type { ManagedValuationDraftFileDeliveryAdapter } from "./valuation-draft-file-delivery";
import type { PortfolioReviewReportDeliveryAdapter } from "./portfolio-review-report-ports";
import type { ManagedPortfolioDraftFileDeliveryAdapter } from "./portfolio-draft-file-delivery";
import type { ManagedFollowupsDraftFileDeliveryAdapter } from "./followups-draft-file-delivery";
import type { FollowupsReviewReportDeliveryAdapter } from "./followups-review-report-ports";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  membershipMatchesResult,
  normalizeWatchlistNote,
  type ManagedCatalogSnapshotDto,
  type MainWatchlistPayload,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import { BrowserRouter } from "react-router";
import {
  useManagedCompanyNavigation,
  type ManagedCompanyNavigation,
} from "./useManagedCompanyNavigation";
import { WorkspaceSearch } from "../features/workspace/WorkspaceSearch";
import {
  createManagedSessionWorkspace,
  type ManagedSessionWorkspaceOptions,
} from "./managed-session-workspace";
import {
  type ManagedWorkspace,
  reviewChanges,
  type CatalogReview,
  type FollowupReview,
} from "./managed-workspace";
import { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import { managedCompanySourceActionsProps } from "./managed-company-source-actions-props";
import { managedValuationResearchProps } from "./managed-valuation-research-props";
import {
  ManagedWatchlistEditor,
  type ManagedWatchlistEditorHandle,
  type ManagedWatchlistEditorProps,
} from "./ManagedWatchlistEditor";
import {
  ManagedFilingsReviewEntry,
  watchlistFilingsActions,
} from "./ManagedFilingsReviewEntry";
import { ManagedBlsCalendar } from "./ManagedBlsCalendar";
import { marketsFollowupNavigation } from "./managed-calendar-followup-navigation";
import { ManagedMarketsBoard } from "./ManagedMarketsBoard";
import { ManagedPortfolioEntry } from "./ManagedPortfolioEntry";
import { managedPortfolioEntryProps } from "./managed-portfolio-entry-props";
import {
  ManagedFinancialDiscovery,
  useManagedFinancialDiscovery,
} from "./ManagedFinancialDiscovery";
import { ManagedFollowupsEntry } from "./ManagedFollowupsEntry";
import { managedFollowupsEntryProps } from "./managed-followups-entry-props";
import {
  managedMarketsRouteCurrent,
  useManagedMarketsSections,
} from "./ManagedMarketsNavigation";
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
import {
  ManagedWatchlistFiles,
  useWatchlistDraftFileSession,
} from "./ManagedWatchlistDraftFilesEntry";
import type { ManagedWatchlistDraftFileDeliveryAdapter } from "./managed-watchlist-draft-file-delivery";
import type { CompanyReportDeliveryAdapter } from "./company-report-delivery";
import type { WatchlistExportDeliveryAdapter } from "./watchlist-export-delivery";
import { ManagedIcon } from "./ManagedIcon";
import { bindManagedBrowserUnload } from "./managed-browser-unload";
import {
  bindAndroidBack,
  type AndroidBackAdapter,
} from "../mobile/android-back";

import type { ManagedValuationCollectionDraftFileDeliveryAdapter } from "./valuation-collection-draft-file-delivery";
interface ManagedFileDeliveries {
  researchDraftSetFileDelivery?: ManagedResearchDraftSetFileDeliveryAdapter;
  valuationCollectionDraftFileDelivery?: ManagedValuationCollectionDraftFileDeliveryAdapter;
  financialScreenRecipeDelivery?: ManagedFinancialScreenRecipeDeliveryAdapter;
  screenComparisonReportDelivery?: ScreenComparisonReportDeliveryAdapter;
  exportDelivery?: WatchlistExportDeliveryAdapter;
  draftFileDelivery?: ManagedWatchlistDraftFileDeliveryAdapter;
  portfolioDraftFileDelivery?: ManagedPortfolioDraftFileDeliveryAdapter;
  portfolioReviewReportDelivery?: PortfolioReviewReportDeliveryAdapter;
  portfolioComparisonReportDelivery?: PortfolioComparisonReportDeliveryAdapter;
  followupsDraftFileDelivery?: ManagedFollowupsDraftFileDeliveryAdapter;
  followupsReviewReportDelivery?: FollowupsReviewReportDeliveryAdapter;
  valuationDraftFileDelivery?: ManagedValuationDraftFileDeliveryAdapter;
  reportDelivery?: CompanyReportDeliveryAdapter;
}
interface SessionProps
  extends ManagedSessionWorkspaceOptions, ManagedFileDeliveries {
  androidBack?: AndroidBackAdapter;
  warnOnBrowserLeave?: boolean;
}
interface WorkspaceProps extends ManagedFileDeliveries {
  workspace: ManagedWorkspace;
  androidBack?: AndroidBackAdapter;
  draftFileScope?: Promise<string>;
}

interface WorkspaceScreenProps extends WorkspaceProps {
  navigation?: ManagedCompanyNavigation;
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
  const draftFileSession = useWatchlistDraftFileSession(initial);
  const [workspace, setWorkspace] = useState<ManagedWorkspace | null>(null);
  useLayoutEffect(() => {
    const current = createManagedSessionWorkspace(initial);
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
      {...draftFileSession}
      {...definedSessionWorkspacePorts(initial)}
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

function definedSessionWorkspacePorts(initial: SessionProps) {
  const ports = {
    researchDraftSetFileDelivery: initial.researchDraftSetFileDelivery,
    financialScreenRecipeDelivery: initial.financialScreenRecipeDelivery,
    screenComparisonReportDelivery: initial.screenComparisonReportDelivery,
    portfolioDraftFileDelivery: initial.portfolioDraftFileDelivery,
    portfolioReviewReportDelivery: initial.portfolioReviewReportDelivery,
    portfolioComparisonReportDelivery:
      initial.portfolioComparisonReportDelivery,
    followupsDraftFileDelivery: initial.followupsDraftFileDelivery,
    followupsReviewReportDelivery: initial.followupsReviewReportDelivery,
    valuationDraftFileDelivery: initial.valuationDraftFileDelivery,
    valuationCollectionDraftFileDelivery:
      initial.valuationCollectionDraftFileDelivery,
    androidBack: initial.androidBack,
    reportDelivery: initial.reportDelivery,
    exportDelivery: initial.exportDelivery,
  };
  return Object.fromEntries(
    Object.entries(ports).filter(([, value]) => value !== undefined),
  ) as Pick<WorkspaceProps, keyof typeof ports>;
}

export function ManagedWorkspaceRouter(props: WorkspaceProps) {
  return (
    <BrowserRouter>
      <RoutedWorkspace {...props} />
    </BrowserRouter>
  );
}

function RoutedWorkspace(props: WorkspaceProps) {
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

function watchlistDraftActions(
  workspace: ManagedWorkspace,
): Pick<
  ManagedWatchlistEditorProps,
  "thesisFollowup" | "onNote" | "onMove" | "onRemove"
> {
  return {
    thesisFollowup: (member) => workspace.thesisFollowupContext(member),
    onNote: (listingId, note, expectedNote) =>
      workspace.note(listingId, note, expectedNote),
    onMove: (listingId, direction) => workspace.move(listingId, direction),
    onRemove: (listingId) => workspace.remove(listingId),
  };
}

export function ManagedWorkspaceScreen({
  workspace,
  androidBack,
  navigation,
  exportDelivery,
  draftFileScope,
  draftFileDelivery,
  portfolioDraftFileDelivery,
  portfolioReviewReportDelivery,
  portfolioComparisonReportDelivery,
  followupsDraftFileDelivery,
  followupsReviewReportDelivery,
  valuationDraftFileDelivery,
  valuationCollectionDraftFileDelivery,
  researchDraftSetFileDelivery,
  financialScreenRecipeDelivery,
  screenComparisonReportDelivery,
  reportDelivery,
}: WorkspaceScreenProps) {
  const panelOrigin = useRef<HTMLButtonElement | null>(null);
  const discoverHeading = useRef<HTMLHeadingElement | null>(null);
  const watchlistNavigation = useRef<HTMLButtonElement | null>(null);
  const marketsNavigation = useRef<HTMLButtonElement | null>(null);
  const followupsNavigation = useRef<HTMLButtonElement | null>(null);
  const portfolioNavigation = useRef<HTMLButtonElement | null>(null);
  const watchlistPanel = useRef<HTMLElement | null>(null);
  const watchlistEditor = useRef<ManagedWatchlistEditorHandle>(null);
  const watchlistHeading = useRef<HTMLHeadingElement | null>(null);
  const [datedReviewFocus, setDatedReviewFocus] =
    useState<PortfolioDatedReviewFocus | null>(null);
  const [backUnavailable, setBackUnavailable] = useState(false);
  const [backReview, setBackReview] = useState(false);
  const backReviewOpen = useRef(false);
  const [localReturnFocus, setLocalReturnFocus] = useState(0);
  const routeBack = navigation?.back;
  const hasCompanyRoute = navigation?.hasCompanyRoute;
  const watchlistRouteActive = () =>
    !navigation?.invalid && !hasCompanyRoute?.();
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
            : returned.view === "portfolio"
              ? portfolioNavigation.current
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
      workspace.returnFromResearch();
      workspace.portfolioDatedReview.resumeFollowups();
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
    view: "markets" | "discover" | "watchlist" | "followups" | "portfolio",
  ) => {
    if (navigation?.isPending() || !workspace.canNavigate()) return false;
    liveNoteReview.current = null;
    setNoteReview(null);
    setNoteReviewNotice(null);
    if (navigation) return navigation.view(view);
    workspace.setView(view);
    return true;
  };
  const openResearch = managedResearchOpener(
    workspace,
    navigation,
    panelOrigin,
  );
  const onNativeBack = useEffectEvent(
    ({ canGoBack }: { canGoBack: boolean }) => {
      const phase = workspace.coordinator.getSnapshot().phase;
      if (
        phase === "retired" ||
        phase === "signing_out" ||
        !workspace.canNavigate()
      )
        return;
      if (
        hasCompanyRoute?.() ||
        workspace.getSnapshot().research ||
        workspace.getSnapshot().companyRoute ||
        navigation?.invalid
      )
        backToWorkspace();
      else if (canGoBack) {
        if (workspace.sessionOwner.getSnapshot().needsLeaveReview) {
          backReviewOpen.current = true;
          setBackReview(true);
        } else window.history.back();
      }
    },
  );
  const onNativeBackUnavailable = useEffectEvent(() =>
    setBackUnavailable(true),
  );
  useEffect(() => {
    if (!androidBack) return;
    const isRetired = () => {
      const phase = workspace.coordinator.getSnapshot().phase;
      return phase === "retired" || phase === "signing_out";
    };
    if (isRetired()) return;
    const dispose = bindAndroidBack(
      androidBack,
      (event) => onNativeBack(event),
      () => onNativeBackUnavailable(),
    );
    const unsubscribe = workspace.coordinator.subscribe(() => {
      if (isRetired()) dispose();
    });
    return () => {
      unsubscribe();
      dispose();
    };
  }, [androidBack, workspace]);
  const discovery = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const portfolioState = useSyncExternalStore(
    workspace.portfolio.subscribe,
    workspace.portfolio.getSnapshot,
    workspace.portfolio.getSnapshot,
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
  const calendarFollowupNavigation = marketsFollowupNavigation({
    workspace,
    setView,
    setReview: setFollowupReview,
    watchlistNavigation,
    followupsNavigation,
  });
  const financialDiscovery = useManagedFinancialDiscovery({
    workspace,
    navigation,
    openResearch,
    onReviewWatchlist: () => setView("watchlist"),
    onReviewFollowup: calendarFollowupNavigation.review,
    recipeDelivery: financialScreenRecipeDelivery,
    comparisonReportDelivery: screenComparisonReportDelivery,
  });
  const busy = saved.phase !== "idle";
  const editable = workspace.canEdit();
  const isMarketsCurrent = () =>
    managedMarketsRouteCurrent(workspace, navigation, hasCompanyRoute);
  const marketsSectionNavigation = useManagedMarketsSections(isMarketsCurrent);
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
            {(
              [
                "markets",
                "discover",
                "watchlist",
                "followups",
                "portfolio",
              ] as const
            ).map((view) => (
              <button
                key={view}
                ref={
                  view === "watchlist"
                    ? watchlistNavigation
                    : view === "markets"
                      ? marketsNavigation
                      : view === "followups"
                        ? followupsNavigation
                        : view === "portfolio"
                          ? portfolioNavigation
                          : undefined
                }
                className="trial-secondary"
                aria-current={discovery.view === view ? "page" : undefined}
                disabled={navigationPending || portfolioState.pendingEditor}
                onClick={() => setView(view)}
              >
                <ManagedIcon name={view} />
                {
                  {
                    markets: "Markets",
                    discover: "Discover",
                    watchlist: "My Watchlist",
                    followups: "Follow-ups",
                    portfolio: "Portfolio",
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
                busy={discovery.read !== null || navigationPending}
                busyLabel={
                  discovery.read === "status" || navigationPending
                    ? "Search"
                    : "Searching…"
                }
                disabled={retired || portfolioState.pendingEditor}
                onChange={(query) => workspace.setQuery(query)}
                onSearch={() => {
                  if (!setView("discover")) return;
                  void workspace.search();
                }}
              />
              <button
                className="trial-secondary"
                disabled={
                  discovery.read !== null || portfolioState.pendingEditor
                }
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
              {draftFileScope && (
                <ManagedResearchDraftSetFiles
                  workspace={workspace}
                  accountScope={draftFileScope}
                  delivery={researchDraftSetFileDelivery}
                  navigationPending={navigationPending}
                  routeActive={() =>
                    !navigation?.invalid && !navigation?.isPending()
                  }
                />
              )}
              {backReview && (
                <section aria-label="Leave workspace review">
                  <h2>Review local changes before leaving</h2>
                  <p>
                    Watchlist, Follow-ups and Portfolio have independent drafts.
                    Leaving can discard unsaved changes and pending save
                    details. Reopen and load each saved version to check any
                    uncertain result.
                  </p>
                  <dl>
                    {(["watchlist", "followups", "portfolio"] as const).map(
                      (key) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>
                            {sessionState[key].dirty
                              ? "Unsaved local changes. "
                              : ""}
                            {sessionState[key].phase}
                            {sessionState[key].uncertain
                              ? ". Save result uncertain."
                              : ""}
                            {sessionState[key].conflict ||
                            sessionState[key].replayPending
                              ? ". Saved version needs review."
                              : ""}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                  <button
                    id="managed-leave-stay"
                    onClick={() => {
                      backReviewOpen.current = false;
                      setBackReview(false);
                    }}
                  >
                    Stay in workspace
                  </button>
                  <button
                    id="managed-leave-confirm"
                    className="trial-secondary"
                    onClick={() => {
                      if (
                        !backReviewOpen.current ||
                        workspace.sessionOwner.getSnapshot().phase !==
                          "active" ||
                        !workspace.canNavigate()
                      )
                        return;
                      backReviewOpen.current = false;
                      setBackReview(false);
                      workspace.sessionOwner.retire(
                        "Workspace closed. Load saved resources when you return.",
                      );
                      window.history.back();
                    }}
                  >
                    Leave and clear local drafts
                  </button>
                </section>
              )}
              {portfolioState.pendingEditor &&
                discovery.view !== "portfolio" && (
                  <p role="status">
                    Apply or reset the Portfolio form before leaving.
                  </p>
                )}
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
                  {...managedValuationResearchProps(
                    workspace,
                    discovery.research.selection,
                    {
                      accountScope: draftFileScope,
                      delivery: valuationDraftFileDelivery,
                      collectionDelivery: valuationCollectionDraftFileDelivery,
                      navigationPending,
                      routeActive: () =>
                        !navigation?.invalid && !navigation?.isPending(),
                    },
                  )}
                  companyNavigationState={workspace.getResearchCompanyNavigation(
                    discovery.research,
                  )}
                  {...managedResearchCompanyNavigationProps(
                    workspace,
                    navigation,
                  )}
                  onBack={() => {
                    if (
                      workspace.getSnapshot().research?.selection ===
                      discovery.research!.selection
                    )
                      backToWorkspace();
                  }}
                  {...managedResearchDraftProps(
                    workspace,
                    discovery.research.selection,
                    navigation,
                    backToWorkspace,
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
                  annualStatementsActions={{
                    prepare: (response, cells, selectionIsCurrent) =>
                      workspace.prepareAnnualStatementsNote(
                        discovery.research!.selection,
                        response,
                        cells,
                        selectionIsCurrent,
                      ),
                    isCurrent: (preview) =>
                      workspace.annualStatementsPreviewIsCurrent(preview),
                    append: (preview) =>
                      workspace.appendAnnualStatementsNote(preview),
                  }}
                  financialReviewActions={{
                    prepare: (response, keys) =>
                      workspace.prepareFinancialReview(
                        discovery.research!.selection,
                        response,
                        keys,
                      ),
                    isCurrent: (preview) =>
                      workspace.financialReviewPreviewIsCurrent(preview),
                    append: (preview) =>
                      workspace.appendFinancialReview(preview),
                  }}
                  priceStudiesActions={{
                    prepare: (response, keys, selectionIsCurrent) =>
                      workspace.preparePriceStudiesNote(
                        discovery.research!.selection,
                        response,
                        keys,
                        selectionIsCurrent,
                      ),
                    isCurrent: (preview) =>
                      workspace.priceStudiesNoteIsCurrent(preview),
                    append: (preview) =>
                      workspace.appendPriceStudiesNote(preview),
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
                  {...managedCompanySourceActionsProps(
                    workspace,
                    discovery.research,
                    navigation,
                  )}
                />
              )}
              <ManagedPortfolioDatedReview
                workspace={workspace}
                navigationPending={
                  navigationPending || Boolean(navigation?.invalid)
                }
                focusRequest={datedReviewFocus}
              />
              <ManagedPortfolioEntry
                {...managedPortfolioEntryProps({
                  workspace,
                  discovery,
                  navigationPending,
                  draftFileScope,
                  draftFileDelivery: portfolioDraftFileDelivery,
                  reviewReportDelivery: portfolioReviewReportDelivery,
                  comparisonReportDelivery: portfolioComparisonReportDelivery,
                  datedReviewNavigation: {
                    navigate: () => setView("followups"),
                    transferred: (reading, opener) =>
                      setDatedReviewFocus({ reading, opener }),
                  },
                  navigation: { active: watchlistRouteActive, view: setView },
                  openResearch,
                })}
              />
              <ManagedFollowupsEntry
                {...managedFollowupsEntryProps({
                  discovery,
                  routeActive: watchlistRouteActive,
                  draftFileScope,
                  draftFileDelivery: followupsDraftFileDelivery,
                  followupsReviewReportDelivery,
                  review: followupReview,
                  navigationPending,
                  workspace,
                  navigation,
                  openResearch,
                })}
              />
              <ManagedMarketsBriefing
                workspace={workspace}
                navigationPending={
                  navigationPending || Boolean(navigation?.invalid)
                }
                navigate={() => setView("markets")}
              />
              {discovery.view === "markets" &&
                !workspace.isMarketsBriefingPassive() && (
                  <div
                    ref={marketsSectionNavigation.containerRef}
                    className="managed-markets-content"
                    hidden={Boolean(
                      discovery.research ||
                      discovery.companyRoute ||
                      navigation?.invalid,
                    )}
                  >
                    <header className="trial-panel">
                      <h2>Markets daily briefing</h2>
                      <p>
                        Choose source reads, inspect their independent dates and
                        results, then keep a dated research check. Review
                        follow-up retains this briefing and the chosen source
                        item.
                      </p>
                    </header>
                    <ManagedMarketsBoard
                      workspace={workspace}
                      isCurrent={isMarketsCurrent}
                      navigationPending={navigationPending}
                      navigation={marketsSectionNavigation}
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
                    <ManagedMarketsDatedChecks
                      workspace={workspace}
                      sections={marketsSectionNavigation}
                      isCurrent={isMarketsCurrent}
                      navigationPending={navigationPending}
                      navigation={calendarFollowupNavigation}
                    />
                    <ManagedBeaReleaseAgenda
                      model={workspace.agenda}
                      headingRef={marketsSectionNavigation.targets.calendar.ref}
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
                    <ManagedBlsCalendar
                      model={workspace.blsCalendar}
                      headingRef={marketsSectionNavigation.targets.bls.ref}
                    />
                    <ManagedFedAnnouncements
                      model={workspace.announcements}
                      headingRef={
                        marketsSectionNavigation.targets.announcements.ref
                      }
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
                <ManagedFinancialDiscovery {...financialDiscovery} />
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
                <ManagedWatchlistFiles
                  workspace={workspace}
                  exportDelivery={exportDelivery}
                  scope={draftFileScope}
                  delivery={draftFileDelivery}
                  routeActive={watchlistRouteActive}
                  heading={watchlistHeading}
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
                    <ManagedFilingsReviewEntry
                      workspace={workspace}
                      navigation={navigation}
                      openResearch={openResearch}
                    />
                    <ManagedWatchlistEditor
                      {...watchlistDraftActions(workspace)}
                      ref={watchlistEditor}
                      memberships={saved.draft.memberships}
                      prices={watchlistPrices}
                      filings={workspace.watchlistFilings}
                      {...watchlistFilingsActions({
                        workspace,
                        navigation,
                        openResearch,
                      })}
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
