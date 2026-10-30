import { captureManagedInterimNote } from "./managed-interim-note-context";
import { ManagedInterimReport } from "./managed-interim-report";
import {
  isManagedInterimStatementsNoteCurrent,
  appendManagedInterimStatementsNote,
  retireManagedInterimStatementsNote,
  type ManagedInterimCellSelection,
  type ManagedInterimNotePreparation,
  type PreparedManagedInterimStatementsNote,
} from "./managed-interim-statements-note";
import type { PersonalSecInterimCanonicalResponseDto } from "@research-cockpit/contracts";
import { ManagedCpiHeadlines } from "./managed-cpi-headlines";
import { ManagedCpiHeadlineFollowupContext } from "./managed-cpi-headline-followup-context";
import { ManagedScreenComparisonFollowupContext } from "./managed-screen-comparison-followup-context";
import { ManagedMarketsCalendarFollowupContext } from "./managed-calendar-followup-context";
import type { CalendarSourceCapture } from "./managed-calendar-followup";
import type { FilingsFollowupPort } from "./managed-filings-followup";
import { captureFollowupReviewNoteContext } from "./managed-followup-review-note-context";
import { captureCompanyReportRevisitTargetContext } from "./company-report-revisit-target";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  MANAGED_RESEARCH_COVERAGE,
  type ManagedResearchCoverage,
} from "./managed-research-eligibility";
import {
  ManagedPriceStudiesNote,
  type PreparedPriceStudiesNote,
} from "./managed-price-studies-note";
import type { ManagedPriceStudyKey } from "./managed-price-studies";
import {
  prepareManagedAnnualStatementsNote,
  isManagedAnnualStatementsNoteCurrent,
  appendManagedAnnualStatementsNote,
  type ManagedAnnualStatementCellSelection,
  type ManagedAnnualStatementsNotePreparation,
  type PreparedManagedAnnualStatementsNote,
} from "./managed-annual-statements-note";
import { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import { captureValuationFollowupContext } from "./managed-valuation-followup-context";
import {
  ManagedValuationRevenueBasis,
  type PreparedValuationRevenueBasis,
} from "./managed-valuation-revenue-basis";
import { ManagedValuationAssumptions } from "./managed-valuation-assumptions";
import {
  ManagedFinancialScreen,
  type ManagedFinancialScreenReportCapture,
} from "./managed-financial-screen";
import {
  prepareValuationNote,
  isValuationNoteCurrent,
  appendValuationNote,
  type PreparedValuationNote,
} from "./valuation-note";
import type { AuthoredValuationScenario } from "@research-cockpit/personal-market-analytics";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import { ManagedCompanySnapshotLoad } from "./managed-company-snapshot-load";
import {
  ManagedCompanySourcePass,
  type CompanySourcePassPreview,
} from "./managed-company-source-pass";
import type { CompanySnapshotLoadSource } from "./managed-company-snapshot-load-sources";
import {
  encodeMainWatchlistPayload,
  isMainWatchlistPayload,
  MANAGED_CATALOG_RESOLVE_LIMITS,
  MANAGED_WATCHLIST_LIMITS,
  membershipMatchesResult,
  normalizeWatchlistNote,
  parseManagedCatalogResolveResponse,
  type MainWatchlistPayload,
  type ManagedCatalogSnapshotDto,
  type ManagedCatalogResolveResponse,
  type ManagedEodCloseDto,
  type ManagedEodHistoryResponseDto,
  type ManagedEodIdentity,
  type ManagedSecFilingsResponseDto,
  type PersonalSecRecentFilingDto,
  type PersonalSecAnnualCanonicalResponseDto,
  type PersonalSecAnnualPairDto,
  type PersonalSecurityMasterSearchResultDto,
  type WatchlistMembership,
  type ResearchFollowup,
  type ResearchFollowupsPayload,
  type PersonalPortfolioIdentity,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import { ManagedCatalogChangedError, type ManagedApi } from "./managed-api";
import {
  ManagedAnnualReport,
  type ManagedAnnualReportSeed,
} from "./managed-annual-report";
import {
  ManagedWatchlistAnnualComparison,
  type ManagedAnnualComparisonReportCapture,
  type ManagedWatchlistAnnualComparisonMember,
} from "./managed-watchlist-annual-comparison";
import {
  getAnnualComparisonNoteEvidence,
  type AnnualComparisonNoteCapture,
} from "./managed-watchlist-annual-comparison-note";
import {
  ManagedEodHistory,
  type ManagedEodHistorySeed,
} from "./managed-eod-history";
import { annualNoteExcerpt } from "./managed-annual-note";
import { annualCashNoteExcerpt } from "./managed-annual-cash-note";
import { annualOperatingNoteExcerpt } from "./managed-annual-operating-note";
import type { PersonalSecAnnualOperatingMarginDto } from "@research-cockpit/contracts";
import { annualLiquidityNoteExcerpt } from "./managed-annual-liquidity-note";
import type { PersonalSecAnnualFinancialReviewKey } from "@research-cockpit/personal-financial-analytics";
import {
  ManagedFinancialReview,
  type PreparedFinancialReview,
  type FinancialReviewPreparation,
} from "./managed-financial-review";
import { priceComparisonNoteExcerpt } from "./managed-price-note";
import { getManagedWatchlistComparisonNoteEvidence } from "./managed-watchlist-comparison-note";
import type { ManagedWatchlistComparisonSelection } from "./managed-watchlist-comparison";
import { filingReferenceNoteExcerpt } from "./managed-filings-note";
import {
  createFilingsAssessmentPort,
  type FilingsAssessmentPort,
} from "./managed-filings-assessment";
import {
  ManagedCompanyFilings,
  type ManagedCompanyFilingsSeed,
} from "./managed-company-filings";
import {
  ManagedWatchlistFilings,
  type ManagedWatchlistFilingsCapture,
} from "./managed-watchlist-filings";
import { ManagedSecAccess } from "./managed-sec-access";
import {
  ManagedFilingsReview,
  type ManagedFilingsReviewCapture,
} from "./managed-filings-review";
import { ManagedEodAccess } from "./managed-eod-access";
import { ManagedMarkets } from "./managed-markets";
import { createManagedMarketsSourceReview } from "./managed-markets-source-review-sources";
import type { ManagedMarketsSourceReview } from "./managed-markets-source-review";
import {
  ManagedWatchlistPrices,
  type ManagedWatchlistPriceHandle,
} from "./managed-watchlist-prices";
import { ManagedFedAnnouncements } from "./managed-fed-announcements";
import {
  getBeaReleaseNoteEvidence,
  type BeaReleaseNoteCapture,
} from "./managed-bea-release-note";
import {
  getFedAnnouncementNoteEvidence,
  type FedAnnouncementNoteCapture,
} from "./managed-fed-announcement-note";
import { ManagedBlsCalendar } from "./managed-bls-calendar";
import { ManagedBeaReleaseAgenda } from "./managed-bea-release-agenda";
import { SaveCoordinator } from "./save-coordinator";
import {
  ManagedResearchFollowups,
  type HoldingCreationContext,
} from "./managed-research-followups";
import {
  holdingPositionsMatch,
  type HoldingFollowupPort,
  type HoldingFollowupPosition,
  type HoldingFollowupPreview,
} from "./managed-holding-followup";
import {
  captureHoldingFollowupContext,
  selectHoldingFollowupForReview,
} from "./managed-holding-followup-context";
import {
  ManagedFollowupsReviewSession,
  type FollowupsReviewHandle,
} from "./managed-followups-review-session";
import {
  captureResearchFollowupContext,
  type ManagedResearchFollowupContext,
} from "./managed-research-followup-context";
export type { ManagedResearchFollowupContext } from "./managed-research-followup-context";
import type { ThesisFollowupContext } from "./managed-thesis-followup";
import { ManagedPortfolio, type PortfolioDraft } from "./managed-portfolio";
import { ManagedPortfolioCloseReview } from "./managed-portfolio-close-review";
import { ManagedSessionOwner } from "./managed-session-owner";
import { MANAGED_WATCHLIST_SAVE_COPY } from "./save-coordinator-copy";
import {
  isManagedCompanyListingId,
  type ManagedCompanyRoute,
} from "./managed-company-route";
import type { TrialSession } from "./session";
import {
  captureWatchlistDraftFileContext,
  captureWatchlistResourceDraftContext,
  type WatchlistDraftFileContext,
} from "./managed-watchlist-draft-context";

type ResolvedListing = ManagedCatalogResolveResponse["results"][number];
export interface CatalogReview {
  readonly draft: MainWatchlistPayload;
  readonly snapshotSha256: string;
  readonly results: readonly ResolvedListing[];
}
export interface ManagedResearchVisit {
  readonly selection: ManagedResearchSelection;
  readonly section: "annual" | "interim" | "eod" | "filings";
}
export interface ResearchCompanyNavigationState {
  readonly members: readonly WatchlistMembership[];
  readonly reason: string;
}
export interface ResearchWatchlistState {
  readonly revision?: symbol;
  readonly member: WatchlistMembership | null;
  readonly canAdd: boolean;
  readonly canEdit: boolean;
  readonly reason: string | null;
}
export interface CompanyRouteState {
  readonly listingId: string;
  readonly section: "annual" | "interim" | "eod" | "filings";
  readonly status:
    "waiting_catalog" | "resolving" | "unavailable" | "error" | "open";
  readonly message: string;
}
export interface ManagedDiscoveryState {
  readonly view:
    "markets" | "discover" | "watchlist" | "followups" | "portfolio";
  readonly followupOpening: boolean;
  readonly query: string;
  readonly read: "status" | "search" | null;
  readonly reviewing: boolean;
  readonly snapshot: ManagedCatalogSnapshotDto | null;
  readonly results: readonly PersonalSecurityMasterSearchResultDto[];
  readonly totalMatches: number;
  readonly message: string;
  readonly review: CatalogReview | null;
  readonly research: ManagedResearchVisit | null;
  readonly companyRoute: CompanyRouteState | null;
}
const emptyDiscovery = (): ManagedDiscoveryState => ({
  view: "markets",
  followupOpening: false,
  query: "",
  read: null,
  reviewing: false,
  snapshot: null,
  results: [],
  totalMatches: 0,
  message: "",
  review: null,
  research: null,
  companyRoute: null,
});
export interface FollowupReview {
  readonly entry: ResearchFollowup;
  readonly draft: ResearchFollowupsPayload;
  readonly isCurrent: () => boolean;
}

interface FollowupPreparationContext {
  readonly entry: ResearchFollowup;
  readonly draft: ResearchFollowupsPayload;
  readonly snapshot: ManagedCatalogSnapshotDto;
  readonly navigationRevision: number;
  readonly reviewHandle: FollowupsReviewHandle | null;
}
interface FollowupOpeningContext extends FollowupPreparationContext {
  readonly operation: AbortController;
}

export interface PreparedFollowupResearch {
  readonly reviewHandle: FollowupsReviewHandle | null;
  readonly entry: ResearchFollowup;
  readonly draft: ResearchFollowupsPayload;
  readonly selection: ManagedResearchSelection;
  readonly navigationRevision: number;
}

interface FollowupResearchVisit {
  readonly owner: {
    readonly id: string;
    readonly selection: ManagedResearchSelection;
  } | null;
  readonly operation: symbol;
  readonly navigationRevision: number;
  readonly viewRevision: number;
  readonly selection: ManagedResearchSelection;
}

interface DraftValidation {
  readonly payload: MainWatchlistPayload | null;
  readonly issue: string | null;
}
function capture(payload: MainWatchlistPayload): DraftValidation {
  const invalid = (issue: string): DraftValidation => ({
    payload: null,
    issue,
  });
  const base = { ...payload, memberships: [] };
  if (!isMainWatchlistPayload(base) || payload.memberships.length > 10_000)
    return invalid("Review the watchlist entries before saving.");
  const encoder = new TextEncoder();
  const baseBytes = encoder.encode(encodeMainWatchlistPayload(base)).byteLength;
  let bytes = baseBytes;
  const memberships: WatchlistMembership[] = [];
  for (const membership of payload.memberships) {
    const note = normalizeWatchlistNote(membership.note);
    if (note === null)
      return invalid(
        "Use at most 2,000 characters per note, without control characters.",
      );
    const normalized = { ...membership, note };
    const single = { ...payload, memberships: [normalized] };
    if (!isMainWatchlistPayload(single))
      return invalid("Review the watchlist entries before saving.");
    // Stop as soon as the canonical payload exceeds its budget. The empty
    // envelope is constant; each additional membership adds its JSON and comma.
    bytes +=
      encoder.encode(encodeMainWatchlistPayload(single)).byteLength -
      baseBytes +
      (memberships.length ? 1 : 0);
    if (bytes > MANAGED_WATCHLIST_LIMITS.payloadBytes)
      return invalid(
        "This watchlist is too large to save. Shorten notes or remove entries.",
      );
    memberships.push(normalized);
  }
  const normalized = { ...payload, memberships };
  if (!isMainWatchlistPayload(normalized))
    return invalid("Review the watchlist entries before saving.");
  const encoded = encodeMainWatchlistPayload(normalized);
  return { payload: JSON.parse(encoded) as MainWatchlistPayload, issue: null };
}

export function listingIdentity(
  result: Omit<WatchlistMembership, "note">,
): Omit<WatchlistMembership, "note"> {
  return {
    country: result.country,
    exchangeMic: result.exchangeMic,
    instrumentType: result.instrumentType,
    issuerId: result.issuerId,
    issuerName: result.issuerName,
    listingId: result.listingId,
    securityId: result.securityId,
    securityName: result.securityName,
    shareClassId: result.shareClassId,
    shareClassName: result.shareClassName,
    symbol: result.symbol,
  };
}

export function listingMembership(
  result: PersonalSecurityMasterSearchResultDto,
): WatchlistMembership {
  return { ...listingIdentity(result), note: "" };
}

/** Owns catalog reads and company visits; the shared coordinator owns every save. */
export class ManagedWorkspace {
  readonly coordinator: SaveCoordinator<MainWatchlistPayload>;
  readonly followups: ManagedResearchFollowups;
  readonly followupsReview: ManagedFollowupsReviewSession;
  readonly portfolio: ManagedPortfolio;
  readonly sessionOwner: ManagedSessionOwner;
  readonly valuation = new ManagedValuationWorkbench();
  private readonly valuationRevenueBasis = new ManagedValuationRevenueBasis(
    this.valuation,
  );
  readonly valuationAssumptions: ManagedValuationAssumptions;
  readonly annual: ManagedAnnualReport;
  readonly interim: ManagedInterimReport;
  readonly annualComparison: ManagedWatchlistAnnualComparison;
  readonly financialScreen: ManagedFinancialScreen;
  readonly filings: ManagedCompanyFilings;
  readonly watchlistFilings: ManagedWatchlistFilings;
  readonly filingsReview: ManagedFilingsReview;
  private readonly secAccess = new ManagedSecAccess();
  private readonly eodAccess: ManagedEodAccess;
  private readonly portfolioPriceCoverage:
    readonly ManagedEodIdentity[] | undefined;
  readonly eod: ManagedEodHistory;
  readonly companySnapshotLoad: ManagedCompanySnapshotLoad;
  readonly companySourcePass: ManagedCompanySourcePass;
  readonly markets: ManagedMarkets;
  readonly marketsSourceReview: ManagedMarketsSourceReview;
  readonly cpiHeadlines: ManagedCpiHeadlines;
  private readonly cpiFollowupContext: ManagedCpiHeadlineFollowupContext;
  readonly screenComparisonFollowup: ManagedScreenComparisonFollowupContext;
  private readonly calendarFollowupContext: ManagedMarketsCalendarFollowupContext;
  readonly watchlistPrices: ManagedWatchlistPrices;
  readonly blsCalendar: ManagedBlsCalendar;
  readonly agenda: ManagedBeaReleaseAgenda;
  readonly announcements: ManagedFedAnnouncements;
  private navigationBlocked = false;
  private readonly watchlistFileActivities = new Set<object>();
  private watchlistFileRevision = {};
  private readonly watchlistFileContexts =
    new WeakSet<WatchlistDraftFileContext>();
  private followupsNavigationDepth = 0;
  private viewRevision = 0;
  private navigationRevision = 0;
  private state = emptyDiscovery();
  private readonly listeners = new Set<() => void>();
  private searchOperation: AbortController | null = null;
  private resolveOperation: AbortController | null = null;
  private companyRouteOperation: AbortController | null = null;
  private researchOperation = Symbol();
  private retired = false;
  private followupOpenOperation: AbortController | null = null;
  private preparedFollowup: PreparedFollowupResearch | null = null;
  private followupResearch: {
    reviewHandle: FollowupsReviewHandle | null;
    id: string;
    selection: ManagedResearchSelection;
  } | null = null;
  private draft: MainWatchlistPayload | null = null;
  private fileCatalogReviewRequired = false;
  private validation: {
    draft: MainWatchlistPayload;
    digest: string | null;
    result: DraftValidation;
  } | null = null;
  private readonly financialReview = new ManagedFinancialReview();
  private readonly priceStudiesNote = new ManagedPriceStudiesNote();
  private readonly valuationNotePreviews = new WeakSet<PreparedValuationNote>();
  private readonly interimStatementsPreviews =
    new WeakSet<PreparedManagedInterimStatementsNote>();
  private readonly annualStatementsPreviews =
    new WeakSet<PreparedManagedAnnualStatementsNote>();
  private readonly reportWatchlistRevisions = new WeakMap<object, symbol>();

  constructor(
    private readonly api: ManagedApi,
    session: TrialSession,
    newKey?: () => string,
    options: {
      marketsCohort?: readonly ManagedEodIdentity[];
      priceCoverage?: readonly ManagedEodIdentity[];
      financialScreenListingIds?: readonly string[];
      researchCoverage?: ManagedResearchCoverage;
      interimIssuers?: readonly string[];
    } = {},
  ) {
    const researchOptions = {
      coverage: options.researchCoverage ?? MANAGED_RESEARCH_COVERAGE,
    };
    const resourceSession: TrialSession = {
      ...session,
      signOut: () => this.sessionOwner.signOut(),
    };
    this.coordinator = new SaveCoordinator<MainWatchlistPayload>(
      {
        mode: "managed",
        empty: () => null,
        copy: (payload) => structuredClone(payload),
        capture: (payload) => this.validateDraft(payload).payload,
        load: (signal) => api.load(signal),
        save: (command, signal) => api.save(command, signal),
      },
      resourceSession,
      MANAGED_WATCHLIST_SAVE_COPY,
      {
        ...(newKey ? { newKey } : {}),
        onRetire: () =>
          this.sessionOwner.retire(this.coordinator.getSnapshot().message),
      },
    );
    this.followups = new ManagedResearchFollowups(api, resourceSession, {
      getHoldingCreationContext: (position) =>
        this.holdingCreationContext(position),
      getCreationContext: () => ({
        draft: this.coordinator.getSnapshot().draft,
        catalogSnapshotSha256: this.currentWatchlistCatalogDigest(),
      }),
      onRetire: () =>
        this.sessionOwner.retire(
          this.followups.coordinator.getSnapshot().message,
        ),
      ...(newKey ? { newKey } : {}),
    });
    this.followupsReview = new ManagedFollowupsReviewSession(this.followups);
    this.portfolio = new ManagedPortfolio(api, resourceSession, {
      getCatalogSnapshot: () => this.state.snapshot,
      onRetire: () =>
        this.sessionOwner.retire(
          this.portfolio.coordinator.getSnapshot().message,
        ),
      ...(newKey ? { newKey } : {}),
    });
    this.valuationAssumptions = new ManagedValuationAssumptions(
      api,
      resourceSession,
      this.valuation,
      {
        getCatalogSnapshot: () => this.state.snapshot,
        onRetire: () =>
          this.sessionOwner.retire(
            this.valuationAssumptions.coordinator.getSnapshot().message,
          ),
        ...(newKey ? { newKey } : {}),
      },
    );
    this.sessionOwner = new ManagedSessionOwner(
      {
        watchlist: this.coordinator,
        followups: this.followups.coordinator,
        portfolio: this.portfolio.sessionResource,
        valuationAssumptions: this.valuationAssumptions.sessionResource,
      },
      session,
      () => this.clear(),
      this.valuation,
    );
    this.annual = new ManagedAnnualReport(
      (request, signal) => api.annualReport(request, signal),
      (error) => this.coordinator.readError(error),
      this.secAccess,
      researchOptions,
    );
    this.interim = new ManagedInterimReport(
      (request, signal) => api.interimReport(request, signal),
      (error) => this.coordinator.readError(error),
      this.secAccess,
      {
        ...researchOptions,
        ...(options.interimIssuers
          ? { interimIssuers: options.interimIssuers }
          : {}),
      },
    );
    this.interim.subscribe(() => {
      if (this.interim.getSnapshot().catalogChanged) this.invalidateCatalog();
    });
    this.annualComparison = new ManagedWatchlistAnnualComparison(
      (request, signal) => api.annualReport(request, signal),
      (error) => this.coordinator.readError(error),
      this.secAccess,
      researchOptions,
    );
    this.annualComparison.subscribe(() => {
      if (this.annualComparison.getSnapshot().catalogChanged)
        this.invalidateCatalog();
    });
    this.financialScreen = new ManagedFinancialScreen(
      api,
      (error) => this.coordinator.readError(error),
      this.secAccess,
      {
        ...researchOptions,
        ...(options.financialScreenListingIds
          ? { listingIds: options.financialScreenListingIds }
          : {}),
      },
    );
    this.financialScreen.subscribe(() => {
      if (this.financialScreen.getSnapshot().catalogChanged)
        this.invalidateCatalog();
    });
    this.filings = new ManagedCompanyFilings(
      (request, signal) => api.recentFilings(request, signal),
      (error) => this.coordinator.readError(error),
      this.secAccess,
      { compareRefresh: true, ...researchOptions },
    );
    this.filings.subscribe(() => {
      if (this.filings.getSnapshot().catalogChanged) this.invalidateCatalog();
    });
    this.watchlistFilings = new ManagedWatchlistFilings(
      (request, signal) => api.recentFilings(request, signal),
      (error) => this.coordinator.readError(error),
      this.secAccess,
      researchOptions,
    );
    this.watchlistFilings.subscribe(() => {
      if (this.watchlistFilings.getSnapshot().catalogChanged)
        this.invalidateCatalog();
    });
    this.filingsReview = new ManagedFilingsReview(
      (request, signal) => api.recentFilings(request, signal),
      (error) => this.coordinator.readError(error),
      this.secAccess,
      researchOptions,
    );
    this.filingsReview.subscribe(() => {
      if (this.filingsReview.getSnapshot().catalogChanged)
        this.invalidateCatalog();
    });
    this.cpiHeadlines = new ManagedCpiHeadlines(
      (signal) => api.cpiHeadlines(signal),
      (error) => this.coordinator.readError(error),
    );
    this.announcements = new ManagedFedAnnouncements(
      (signal) => api.monetaryAnnouncements(signal),
      (error) => this.coordinator.readError(error),
    );
    this.blsCalendar = new ManagedBlsCalendar(
      (signal) => api.blsCalendar(signal),
      (error) => this.coordinator.readError(error),
    );
    this.agenda = new ManagedBeaReleaseAgenda(
      (signal) => api.economicCalendar(signal),
      (error) => this.coordinator.readError(error),
    );
    this.portfolioPriceCoverage =
      options.priceCoverage &&
      Object.freeze(
        options.priceCoverage.map((entry) => Object.freeze({ ...entry })),
      );
    const eodAccess = (this.eodAccess = new ManagedEodAccess(
      (request, signal) => api.eodHistory(request, signal),
    ));
    this.eod = new ManagedEodHistory(
      (request, signal) => api.eodHistory(request, signal),
      (error) => this.coordinator.readError(error),
      eodAccess,
      options.priceCoverage,
    );
    this.companySnapshotLoad = new ManagedCompanySnapshotLoad(
      this.eod,
      this.annual,
      this.filings,
      this.interim,
    );
    this.companySourcePass = new ManagedCompanySourcePass(
      this.companySnapshotLoad,
      this.eod,
      this.annual,
      this.filings,
      this.interim,
    );
    this.markets = new ManagedMarkets(
      api,
      eodAccess,
      (error) => this.coordinator.readError(error),
      () => this.invalidateCatalog(),
      options.marketsCohort,
    );
    this.marketsSourceReview = createManagedMarketsSourceReview({
      markets: this.markets,
      bls: this.blsCalendar,
      bea: this.agenda,
      fed: this.announcements,
      available: () => this.marketsReviewAvailable(),
    });
    this.cpiFollowupContext = new ManagedCpiHeadlineFollowupContext({
      workspace: this,
      available: () => this.calendarFollowupRouteReady(),
      memberReady: (member) => this.calendarFollowupMemberReady(member),
      revision: () => ({
        navigation: this.navigationRevision,
        view: this.viewRevision,
        catalog: this.state.snapshot,
      }),
    });
    this.screenComparisonFollowup = new ManagedScreenComparisonFollowupContext({
      workspace: this,
      available: () => this.screenComparisonFollowupRouteReady(),
      memberReady: (member) => {
        if (!this.screenComparisonFollowupRouteReady() || !this.canEdit())
          return false;
        const saved = this.coordinator.getSnapshot();
        const digest = this.currentWatchlistCatalogDigest();
        return (
          saved.phase === "idle" &&
          !saved.uncertain &&
          !saved.replayPending &&
          digest !== null &&
          saved.draft?.snapshotSha256 === digest &&
          saved.draft.memberships.includes(member)
        );
      },
      revision: () => ({
        navigation: this.navigationRevision,
        view: this.viewRevision,
        catalog: this.state.snapshot,
      }),
    });
    this.calendarFollowupContext = new ManagedMarketsCalendarFollowupContext({
      workspace: this,
      available: () => this.calendarFollowupRouteReady(),
      memberReady: (member) => this.calendarFollowupMemberReady(member),
      revision: () => ({
        navigation: this.navigationRevision,
        view: this.viewRevision,
        catalog: this.state.snapshot,
      }),
    });
    this.watchlistPrices = new ManagedWatchlistPrices(
      (request, signal) => api.eodHistory(request, signal),
      (error) => this.coordinator.readError(error),
      eodAccess,
      options.priceCoverage,
    );
    this.watchlistPrices.subscribe(() => {
      if (this.watchlistPrices.getSnapshot().catalogChanged)
        this.invalidateCatalog();
    });
    this.annual.subscribe(() => {
      this.valuationRevenueBasis.invalidate();
      if (this.annual.getSnapshot().catalogChanged) this.invalidateCatalog();
    });
    this.eod.subscribe(() => {
      if (this.eod.getSnapshot().catalogChanged) this.invalidateCatalog();
    });
    this.coordinator.subscribe(() => {
      const saved = this.coordinator.getSnapshot();
      if (!saved.dirty && saved.draft !== null)
        this.fileCatalogReviewRequired = false;
      this.syncWatchlistPrices();
      this.syncAnnualComparison();
      this.syncFinancialScreen();
      this.syncWatchlistFilings();
      const selection = this.state.research?.selection;
      if (
        selection?.origin === "watchlist" &&
        !this.canSwitchResearch(selection)
      )
        this.closeResearch();
      if (
        this.draft !== saved.draft ||
        saved.uncertain ||
        saved.conflict ||
        saved.replayPending
      ) {
        this.draft = saved.draft;
        this.cancelReview();
      }
    });
    this.portfolio.coordinator.subscribe(() => {
      this.syncFinancialScreen();
      const selection = this.state.research?.selection;
      if (
        selection?.origin === "portfolio" &&
        !this.canSwitchResearch(selection)
      )
        this.closeResearch();
    });
    this.followups.coordinator.subscribe(() => {
      const selection = this.state.research?.selection;
      if (
        selection?.origin === "followups" &&
        !this.canSwitchResearch(selection)
      )
        this.closeResearch();
      this.syncFollowupsReview();
    });
  }
  getSnapshot = (): ManagedDiscoveryState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private marketsReviewAvailable() {
    return (
      !this.retired &&
      !this.navigationBlocked &&
      this.state.view === "markets" &&
      !this.state.research &&
      !this.state.companyRoute
    );
  }
  private update(next: Partial<ManagedDiscoveryState>) {
    this.state = { ...this.state, ...next };
    this.companySourcePass.reconcile();
    this.valuationRevenueBasis.reconcile();
    this.marketsSourceReview.reconcile();
    this.followups.syncCatalog(this.state.snapshot?.snapshotSha256 ?? null);
    this.syncFollowupsReview();
    this.portfolio.syncCatalog();
    this.valuationAssumptions.syncCatalog();
    this.syncAnnouncements();
    this.syncWatchlistPrices();
    this.syncAnnualComparison();
    this.syncFinancialScreen();
    this.syncWatchlistFilings();
    for (const listener of this.listeners) listener();
  }
  setNavigationBlocked(blocked: boolean) {
    this.followupsNavigationDepth++;
    try {
      this.followupsReview.setAvailable(false);
      this.navigationRevision++;
      this.valuationRevenueBasis.invalidate();
      this.companySourcePass.reconcile();
      this.companySnapshotLoad.cancel();
      this.cancelFollowupOpening();
      this.navigationBlocked = blocked;
      this.marketsSourceReview.reconcile();
      this.syncAnnouncements();
      this.syncAnnualComparison();
      this.syncFinancialScreen();
      this.syncWatchlistFilings();
    } finally {
      this.followupsNavigationDepth--;
      this.syncFollowupsReview();
    }
  }
  private ownsFollowupsReview(handle: FollowupsReviewHandle | null) {
    if (handle === null) return true;
    const state = this.followupsReview.getSnapshot();
    return (
      state.entered &&
      state.phase === "reviewing" &&
      state.selected?.handle === handle
    );
  }
  private queuedReviewVisitIsCurrent() {
    const visit = this.state.research;
    if (!visit) return false;
    const owner = this.followupResearch;
    if (!owner) return false;
    if (!owner.reviewHandle) return false;
    if (!this.ownsFollowupsReview(owner.reviewHandle)) return false;
    if (!companyEvidenceSelectionMatches(owner.selection, visit.selection))
      return false;
    return this.researchSourceRouteReady(visit.selection);
  }
  private followupReviewNavigationPaused() {
    return this.navigationBlocked || this.followupsNavigationDepth > 0;
  }
  private syncFollowupsReview() {
    const model = this.followupsReview;
    if (this.retired || this.state.view !== "followups") {
      model.leave();
      return;
    }
    if (this.followupReviewNavigationPaused()) {
      model.setAvailable(false);
      return;
    }
    if (this.state.research || this.state.companyRoute) {
      if (!this.queuedReviewVisitIsCurrent()) model.leave();
      else model.setAvailable(false);
      return;
    }
    model.setAvailable(!this.state.followupOpening);
  }
  private syncWatchlistFilings() {
    if (this.retired || this.state.view !== "watchlist") {
      this.watchlistFilings.leave();
      this.filingsReview.leave();
      return;
    }
    this.watchlistFilings.reconcile(
      this.coordinator.getSnapshot().draft,
      this.currentWatchlistCatalogDigest(),
      !this.navigationBlocked &&
        !this.state.research &&
        !this.state.companyRoute,
      this.canEdit(),
    );
    this.filingsReview.reconcile(
      this.coordinator.getSnapshot().draft,
      this.currentWatchlistCatalogDigest(),
      !this.navigationBlocked &&
        !this.state.research &&
        !this.state.companyRoute,
      this.canEdit(),
    );
  }
  selectWatchlistFilingsMember(member: WatchlistMembership | null) {
    if (
      this.retired ||
      this.navigationBlocked ||
      this.state.view !== "watchlist" ||
      this.state.research ||
      this.state.companyRoute
    )
      return;
    this.syncWatchlistFilings();
    const current = this.watchlistFilings.getSnapshot();
    if (member === null) {
      this.watchlistFilings.select(current, null);
      return;
    }
    if (!this.coordinator.getSnapshot().draft?.memberships.includes(member))
      return;
    const selected = current.memberships.find((entry) =>
      membershipMatchesResult(member, entry.listing),
    );
    if (selected) this.watchlistFilings.select(current, selected);
  }
  private syncAnnouncements() {
    if (
      this.retired ||
      this.navigationBlocked ||
      this.state.view !== "markets" ||
      this.state.research ||
      this.state.companyRoute
    ) {
      this.cpiHeadlines.leave();
      this.announcements.leave();
      this.blsCalendar.leave();
    } else {
      this.cpiHeadlines.enter();
      this.announcements.enter();
      this.blsCalendar.enter();
    }
  }
  private syncAnnualComparison() {
    const active =
      !this.retired &&
      !this.navigationBlocked &&
      this.state.view === "watchlist" &&
      !this.state.research &&
      !this.state.companyRoute;
    this.annualComparison.reconcile(
      this.coordinator.getSnapshot().draft,
      this.currentWatchlistCatalogDigest(),
      active,
      this.canEdit(),
    );
  }
  private syncFinancialScreen() {
    const active =
      !this.retired &&
      !this.navigationBlocked &&
      this.state.view === "discover" &&
      !this.state.research &&
      !this.state.companyRoute;
    this.financialScreen.reconcile(
      this.state.snapshot?.snapshotSha256 ?? null,
      active,
      active && this.canNavigate(),
    );
  }
  private syncWatchlistPrices() {
    if (this.retired || this.state.view !== "watchlist") {
      this.watchlistPrices.leave();
      return;
    }
    const draft = this.coordinator.getSnapshot().draft;
    const digest = this.currentWatchlistCatalogDigest();
    const canRead =
      this.canEdit() &&
      !this.state.research &&
      !this.state.companyRoute &&
      digest !== null &&
      draft?.snapshotSha256 === digest;
    this.watchlistPrices.enter(draft, digest, canRead);
  }
  loadWatchlistPrice(handle: ManagedWatchlistPriceHandle) {
    this.syncWatchlistPrices();
    return this.watchlistPrices.load(handle);
  }
  private clear() {
    this.retired = true;
    this.screenComparisonFollowup.retire();
    this.cpiFollowupContext.retire();
    this.cpiHeadlines.retire();
    this.calendarFollowupContext.retire();
    this.marketsSourceReview.retire();
    this.cancelFollowupOpening();
    this.followupResearch = null;
    this.followupsReview.retire();
    this.followups.retire();
    this.portfolio.retire();
    this.valuationAssumptions.retire();
    this.valuationRevenueBasis.invalidate();
    this.valuation.retire();
    this.closeResearch();
    this.annual.retire();
    this.interim.retire();
    this.annualComparison.retire();
    this.financialScreen.retire();
    this.filings.retire();
    this.watchlistFilings.retire();
    this.filingsReview.retire();
    this.secAccess.retire();
    this.eod.retire();
    this.markets.retire();
    this.watchlistPrices.retire();
    this.blsCalendar.retire();
    this.agenda.retire();
    this.announcements.retire();
    this.searchOperation?.abort();
    this.resolveOperation?.abort();
    this.searchOperation = null;
    this.resolveOperation = null;
    this.draft = null;
    this.fileCatalogReviewRequired = false;
    this.validation = null;
    this.state = emptyDiscovery();
    for (const listener of this.listeners) listener();
  }
  private cancelReview() {
    this.resolveOperation?.abort();
    this.resolveOperation = null;
    if (this.state.review || this.state.reviewing)
      this.update({ review: null, reviewing: false });
  }
  private catalogError(error: unknown, action: "status" | "search" | "review") {
    if (
      error instanceof TrialApiError &&
      ["unauthenticated", "access_denied", "origin_denied"].includes(error.code)
    ) {
      this.coordinator.readError(error);
      return;
    }
    let message = {
      status:
        "The catalog could not be loaded. Select Refresh catalog to try again.",
      search: "The search could not be completed. Select Search to try again.",
      review:
        "The catalog review could not be completed. Select Review catalog changes to try again.",
    }[action];
    if (error instanceof ManagedCatalogChangedError) {
      this.invalidateCatalog();
      message =
        "The catalog changed during review. Refresh the catalog and start the review again.";
    } else if (
      action === "search" &&
      error instanceof TrialApiError &&
      error.code === "invalid_request"
    )
      message = "Enter a company name or ticker of at most 128 characters.";
    this.update({ message });
  }
  canNavigate() {
    return !this.retired && !this.portfolio.getSnapshot().pendingEditor;
  }
  setQuery(query: string) {
    if (!this.canNavigate()) return;
    this.searchOperation?.abort();
    this.searchOperation = null;
    this.update({
      query,
      read: null,
      results: [],
      totalMatches: 0,
      message: "",
    });
  }
  setView(view: ManagedDiscoveryState["view"]) {
    if (!this.canNavigate()) return;
    this.viewRevision++;
    if (this.state.view === "portfolio" && view !== "portfolio")
      this.portfolio.cancelReview();
    this.closeResearch();
    if (view === this.state.view) return;
    if (view === "markets") {
      this.markets.enter(this.state.snapshot?.snapshotSha256 ?? null);
      this.blsCalendar.enter();
      this.agenda.enter();
    } else {
      this.markets.leave();
      this.blsCalendar.leave();
      this.agenda.leave();
    }
    this.update({ view });
  }
  private invalidateCatalog() {
    this.marketsSourceReview.invalidate();
    if (this.retired || !this.state.snapshot) return;
    this.state = { ...this.state, snapshot: null };
    this.searchOperation?.abort();
    this.searchOperation = null;
    this.cancelReview();
    this.markets.leave();
    this.watchlistPrices.leave();
    this.watchlistFilings.leave();
    this.filingsReview.leave();
    this.closeResearch();
    this.update({
      snapshot: null,
      results: [],
      totalMatches: 0,
      read: null,
      message:
        "The catalog changed. Refresh the catalog before requesting research again.",
    });
  }
  async refreshCatalog() {
    this.marketsSourceReview.invalidate();
    await this.readCatalog("status");
  }
  async search() {
    await this.readCatalog("search");
  }
  private async readCatalog(read: "status" | "search") {
    if (!this.canNavigate()) return;
    this.searchOperation?.abort();
    const operation = new AbortController();
    this.searchOperation = operation;
    const query = this.state.query;
    this.update({ read, message: "", results: [], totalMatches: 0 });
    try {
      const matches =
        read === "search"
          ? await this.api.search(query, operation.signal)
          : null;
      const result = matches ?? (await this.api.status(operation.signal));
      if (
        this.retired ||
        this.searchOperation !== operation ||
        operation.signal.aborted
      )
        return;
      if (
        result.snapshot.snapshotSha256 !== this.state.snapshot?.snapshotSha256
      ) {
        const waitingRoute =
          this.state.snapshot === null &&
          this.state.companyRoute?.status === "waiting_catalog"
            ? this.state.companyRoute
            : null;
        this.cancelReview();
        this.clearResearch();
        if (waitingRoute)
          this.state = { ...this.state, companyRoute: waitingRoute };
      }
      this.update({
        snapshot: result.snapshot,
        ...(matches
          ? {
              results: matches.results,
              totalMatches: matches.totalMatches,
              message: matches.totalMatches
                ? `${matches.totalMatches} matching listings in this catalog.`
                : "No matching listings in this catalog.",
            }
          : {}),
      });
      if (this.state.view === "markets")
        this.markets.enter(result.snapshot.snapshotSha256);
      await this.resolveCompanyRoute();
    } catch (error) {
      if (
        !this.retired &&
        this.searchOperation === operation &&
        !operation.signal.aborted
      )
        this.catalogError(error, read);
    } finally {
      if (this.searchOperation === operation) {
        this.searchOperation = null;
        this.update({ read: null });
      }
    }
  }
  canEdit() {
    const saved = this.coordinator.getSnapshot();
    return (
      !this.retired &&
      this.coordinator.canEdit() &&
      !saved.conflict &&
      saved.draft !== null
    );
  }
  openDiscoveryAnnual(result: PersonalSecurityMasterSearchResultDto) {
    const snapshot = this.state.snapshot;
    if (this.retired || !snapshot || !this.state.results.includes(result))
      return;
    this.openResearch(
      {
        catalogSnapshotSha256: snapshot.snapshotSha256,
        listing: listingIdentity(result),
        cik: result.cik,
        origin: "discover",
      },
      "annual",
    );
  }
  canOpenWatchlistAnnual(member: WatchlistMembership) {
    const draft = this.coordinator.getSnapshot().draft;
    const digest = this.currentWatchlistCatalogDigest();
    return (
      !this.retired &&
      digest !== null &&
      draft?.snapshotSha256 === digest &&
      draft.memberships.includes(member)
    );
  }
  openWatchlistAnnual(member: WatchlistMembership) {
    if (!this.canOpenWatchlistAnnual(member) || !this.state.snapshot) return;
    this.openResearch(
      {
        catalogSnapshotSha256: this.state.snapshot.snapshotSha256,
        listing: listingIdentity(member),
        cik: null,
        origin: "watchlist",
      },
      "annual",
    );
  }
  private canOpenAnnualComparisonReport(
    capture: ManagedAnnualComparisonReportCapture,
  ) {
    const draft = this.coordinator.getSnapshot().draft;
    const digest = this.currentWatchlistCatalogDigest();
    return (
      !this.retired &&
      !this.navigationBlocked &&
      this.state.view === "watchlist" &&
      !this.state.research &&
      !this.state.companyRoute &&
      digest !== null &&
      draft?.snapshotSha256 === digest &&
      draft.memberships.some((member) =>
        membershipMatchesResult(member, capture.member.listing),
      ) &&
      this.annualComparison.canAdmitReport(capture)
    );
  }
  openAnnualComparisonReport(capture: ManagedAnnualComparisonReportCapture) {
    if (!this.canOpenAnnualComparisonReport(capture)) return;
    const handoff = this.annualComparison.admitReport(capture);
    if (!handoff || !this.canOpenAnnualComparisonReport(capture)) return;
    this.openResearch(handoff.selection, "annual", {
      annualSeed: handoff.seed,
      admit: () => this.canOpenAnnualComparisonReport(capture),
    });
  }
  private canOpenFinancialScreenReport(
    capture: ManagedFinancialScreenReportCapture,
  ) {
    return (
      !this.retired &&
      !this.navigationBlocked &&
      this.canNavigate() &&
      this.state.view === "discover" &&
      !this.state.research &&
      !this.state.companyRoute &&
      this.financialScreen.canAdmitReport(capture)
    );
  }
  openFinancialScreenReport(capture: ManagedFinancialScreenReportCapture) {
    if (!this.canOpenFinancialScreenReport(capture)) return;
    const handoff = this.financialScreen.admitReport(capture);
    if (!handoff || !this.canOpenFinancialScreenReport(capture)) return;
    this.openResearch(handoff.selection, "annual", {
      annualSeed: handoff.seed,
      admit: () => this.canOpenFinancialScreenReport(capture),
    });
  }
  private canOpenWatchlistFilings(capture: ManagedWatchlistFilingsCapture) {
    return (
      this.watchlistResearchVisitActive() &&
      this.currentWatchlistContains(capture.member.listing) &&
      this.watchlistFilings.canAdmitFilings(capture)
    );
  }
  private watchlistResearchVisitActive() {
    return (
      !this.retired &&
      !this.navigationBlocked &&
      this.state.view === "watchlist" &&
      !this.state.research &&
      !this.state.companyRoute
    );
  }
  private currentWatchlistContains(listing: ManagedEodIdentity) {
    const draft = this.coordinator.getSnapshot().draft;
    const digest = this.currentWatchlistCatalogDigest();
    return (
      digest !== null &&
      draft?.snapshotSha256 === digest &&
      draft.memberships.some((member) =>
        membershipMatchesResult(member, listing),
      )
    );
  }
  openWatchlistFilings(capture: ManagedWatchlistFilingsCapture) {
    if (!this.canOpenWatchlistFilings(capture)) return;
    const handoff = this.watchlistFilings.admitFilings(capture);
    if (!handoff || !this.canOpenWatchlistFilings(capture)) return;
    this.openResearch(handoff.selection, "filings", {
      filingsSeed: handoff.seed,
      admit: () => this.canOpenWatchlistFilings(capture),
    });
  }
  canOpenFilingsReview(capture: ManagedFilingsReviewCapture) {
    return (
      this.watchlistResearchVisitActive() &&
      this.currentWatchlistContains(capture.member.listing) &&
      this.filingsReview.canAdmit(capture)
    );
  }
  openFilingsReview(capture: ManagedFilingsReviewCapture) {
    if (!this.canOpenFilingsReview(capture)) return;
    const handoff = this.filingsReview.admit(capture);
    if (!handoff || !this.canOpenFilingsReview(capture)) return;
    this.openResearch(handoff.selection, "filings", {
      filingsSeed: handoff.seed,
      admit: () => this.canOpenFilingsReview(capture),
    });
  }
  openDiscoveryEod(result: PersonalSecurityMasterSearchResultDto) {
    const snapshot = this.state.snapshot;
    if (this.retired || !snapshot || !this.state.results.includes(result))
      return;
    this.openResearch(
      {
        catalogSnapshotSha256: snapshot.snapshotSha256,
        listing: listingIdentity(result),
        cik: result.cik,
        origin: "discover",
      },
      "eod",
    );
  }
  canOpenWatchlistEod(member: WatchlistMembership) {
    return this.canOpenWatchlistAnnual(member);
  }
  openWatchlistEod(member: WatchlistMembership) {
    if (!this.canOpenWatchlistEod(member) || !this.state.snapshot) return;
    this.watchlistPrices.cancel();
    if (!this.canOpenWatchlistEod(member) || !this.state.snapshot) return;
    const row = this.watchlistPrices
      .getSnapshot()
      .rows.find((entry) => membershipMatchesResult(member, entry.listing));
    const seed = row
      ? (this.watchlistPrices.seed(row.handle) ?? undefined)
      : undefined;
    this.openResearch(
      {
        catalogSnapshotSha256: this.state.snapshot.snapshotSha256,
        listing: listingIdentity(member),
        cik: null,
        origin: "watchlist",
      },
      "eod",
      { priceSeed: seed },
    );
  }
  openMarketResearch(kind: "annual" | "eod" | "filings", listingId?: string) {
    const requested = this.markets.selection(listingId);
    if (
      this.retired ||
      this.state.view !== "markets" ||
      !requested ||
      requested.catalogSnapshotSha256 !== this.state.snapshot?.snapshotSha256
    )
      return;
    this.marketsSourceReview.invalidate();
    this.markets.cancel();
    // Cancellation settles previous-history status before the visit captures it.
    const selection = this.markets.selection(requested.listing.listingId);
    if (
      this.retired ||
      this.state.view !== "markets" ||
      !selection ||
      selection.catalogSnapshotSha256 !== this.state.snapshot?.snapshotSha256
    )
      return;
    const row = this.markets
      .getSnapshot()
      .rows.find(
        (entry) => entry.listing.listingId === selection.listing.listingId,
      );
    this.openResearch(selection, kind, {
      priceSeed: row?.response
        ? { response: row.response, showingPrevious: row.showingPrevious }
        : undefined,
    });
  }
  async setCompanyRoute(route: ManagedCompanyRoute | null) {
    if (!this.canNavigate()) return;
    this.cancelFollowupOpening();
    this.watchlistPrices.cancel();
    if (
      !route ||
      !isManagedCompanyListingId(route.listingId) ||
      !["annual", "interim", "eod", "filings"].includes(route.section)
    ) {
      this.closeResearch();
      return;
    }
    const research = this.state.research;
    if (
      research?.selection.listing.listingId === route.listingId &&
      this.canSwitchResearch(research.selection)
    ) {
      this.switchResearch(route.section);
      if (this.state.research)
        this.update({
          companyRoute: {
            listingId: route.listingId,
            section: route.section,
            status: "open",
            message: "",
          },
        });
      return;
    }
    const pending = this.state.companyRoute;
    if (pending?.listingId === route.listingId && pending.status !== "open") {
      this.update({ companyRoute: { ...pending, section: route.section } });
      return;
    }
    this.clearResearch();
    this.markets.cancel();
    this.update({
      companyRoute: {
        listingId: route.listingId,
        section: route.section,
        status: "waiting_catalog",
        message: "Load the catalog to open this company link.",
      },
    });
    await this.resolveCompanyRoute();
  }
  async retryCompanyRoute() {
    const route = this.state.companyRoute;
    if (
      this.retired ||
      !route ||
      this.companyRouteOperation ||
      (route.status !== "error" && route.status !== "unavailable")
    )
      return;
    this.update({
      companyRoute: {
        ...route,
        status: "waiting_catalog",
        message: "Load the catalog to open this company link.",
      },
    });
    await this.resolveCompanyRoute();
  }
  private async resolveCompanyRoute() {
    const route = this.state.companyRoute;
    const snapshot = this.state.snapshot;
    if (
      this.retired ||
      !route ||
      !snapshot ||
      this.companyRouteOperation ||
      route.status !== "waiting_catalog"
    )
      return;
    const operation = new AbortController();
    this.companyRouteOperation = operation;
    const current = () =>
      !this.retired &&
      this.companyRouteOperation === operation &&
      !operation.signal.aborted &&
      this.state.companyRoute?.listingId === route.listingId &&
      this.state.snapshot?.snapshotSha256 === snapshot.snapshotSha256;
    this.update({
      companyRoute: {
        ...route,
        status: "resolving",
        message: "Resolving company link.",
      },
    });
    const request = {
      snapshotSha256: snapshot.snapshotSha256,
      listingIds: [route.listingId],
    };
    try {
      const response = await this.api.resolve(request, operation.signal);
      if (!current()) return;
      const admitted = parseManagedCatalogResolveResponse(response, request);
      if (!admitted) throw new TrialApiError("invalid_response");
      const listing = admitted.results[0]!.listing;
      const activeRoute = this.state.companyRoute!;
      if (!listing) {
        this.update({
          companyRoute: {
            ...activeRoute,
            status: "unavailable",
            message:
              "This listing is not available in the current catalog. Check the link or choose another company.",
          },
        });
        return;
      }
      this.companyRouteOperation = null;
      this.openResearch(
        {
          catalogSnapshotSha256: snapshot.snapshotSha256,
          listing: listingIdentity(listing),
          cik: null,
          origin: "route",
        },
        activeRoute.section,
        { companyRoute: { ...activeRoute, status: "open", message: "" } },
      );
    } catch (error) {
      if (!current()) return;
      if (error instanceof ManagedCatalogChangedError) {
        this.invalidateCatalog();
      } else if (
        error instanceof TrialApiError &&
        ["unauthenticated", "access_denied", "origin_denied"].includes(
          error.code,
        )
      ) {
        this.coordinator.readError(error);
      } else {
        this.update({
          companyRoute: {
            ...this.state.companyRoute!,
            status: "error",
            message:
              "The company link could not be resolved. Select Retry company link to try again.",
          },
        });
      }
    } finally {
      if (this.companyRouteOperation === operation)
        this.companyRouteOperation = null;
    }
  }
  getResearchCompanyNavigation(
    visit: ManagedResearchVisit,
  ): ResearchCompanyNavigationState {
    if (
      this.retired ||
      this.state.research !== visit ||
      !this.canSwitchResearch(visit.selection)
    )
      return { members: [], reason: "Open a current company visit first." };
    const choices = this.researchCompanyChoices(visit);
    if (choices.reason) return choices;
    const route = this.state.companyRoute;
    if (
      this.navigationBlocked &&
      (route?.status !== "open" ||
        route.listingId !== visit.selection.listing.listingId ||
        route.section !== visit.section)
    )
      return { ...choices, reason: "Wait for company navigation to finish." };
    return choices;
  }
  private researchCompanyChoices(
    visit: ManagedResearchVisit,
  ): ResearchCompanyNavigationState {
    if (
      visit.selection.catalogSnapshotSha256 !==
        this.state.snapshot?.snapshotSha256 ||
      this.annual.getSnapshot().catalogChanged ||
      this.filings.getSnapshot().catalogChanged ||
      this.eod.getSnapshot().catalogChanged
    )
      return { members: [], reason: "Load the current catalog first." };
    const draft = this.coordinator.getSnapshot().draft;
    if (draft?.snapshotSha256 !== visit.selection.catalogSnapshotSha256)
      return {
        members: [],
        reason: "Load My Watchlist from the current catalog first.",
      };
    return {
      members: draft.memberships,
      reason: draft.memberships.length ? "" : "My Watchlist has no companies.",
    };
  }
  canOpenResearchCompany(
    visit: ManagedResearchVisit,
    member: WatchlistMembership,
  ) {
    const choices = this.getResearchCompanyNavigation(visit);
    return (
      !choices.reason &&
      choices.members.includes(member) &&
      !membershipMatchesResult(member, visit.selection.listing)
    );
  }
  openResearchCompany(
    visit: ManagedResearchVisit,
    member: WatchlistMembership,
  ) {
    if (!this.canOpenResearchCompany(visit, member)) return;
    const navigationRevision = this.navigationRevision;
    const selection: ManagedResearchSelection = {
      catalogSnapshotSha256: visit.selection.catalogSnapshotSha256,
      listing: listingIdentity(member),
      cik: null,
      origin: "watchlist",
    };
    this.openResearch(selection, visit.section, {
      admit: (phase) => {
        if (
          this.navigationRevision !== navigationRevision ||
          !membershipMatchesResult(member, selection.listing)
        )
          return false;
        if (phase === "before-clear")
          return this.canOpenResearchCompany(visit, member);
        return (
          this.state.research === null &&
          this.state.companyRoute === null &&
          this.canSwitchResearch(visit.selection) &&
          this.researchCompanyChoices(visit).members.includes(member)
        );
      },
    });
  }
  private openResearch(
    selection: ManagedResearchSelection,
    section: ManagedResearchVisit["section"],
    options: {
      companyRoute?: CompanyRouteState;
      priceSeed?: ManagedEodHistorySeed | undefined;
      annualSeed?: ManagedAnnualReportSeed;
      filingsSeed?: ManagedCompanyFilingsSeed;
      admit?: (phase: "before-clear" | "after-clear") => boolean;
    } = {},
  ) {
    if (!this.canNavigate()) return;
    const operation = Symbol();
    this.researchOperation = operation;
    const owns = () => this.researchOperation === operation;
    let phase: "before-clear" | "after-clear" = "before-clear";
    const admitted = () => !this.retired && (options.admit?.(phase) ?? true);
    this.watchlistPrices.cancel();
    if (!owns() || !admitted()) return;
    this.watchlistFilings.cancel();
    if (!owns() || !admitted()) return;
    this.filingsReview.cancel();
    if (!owns() || !admitted()) return;
    phase = "after-clear";
    this.clearResearch(operation);
    if (!owns()) return;
    if (!admitted()) {
      this.update({});
      return;
    }
    if (section === "eod" || options.priceSeed)
      this.eod.open(selection, options.priceSeed);
    if (!owns()) return;
    if (section === "annual") this.annual.open(selection, options.annualSeed);
    if (section === "interim") this.interim.open(selection);
    if (!owns()) return;
    if (section === "filings")
      this.filings.open(selection, options.filingsSeed);
    if (!owns()) return;
    if (!admitted()) {
      this.clearResearch(operation);
      if (owns()) this.update({});
      return;
    }
    const captured = this[section].getSnapshot().selection;
    if (captured) {
      this.update({
        research: Object.freeze({ selection: captured, section }),
        companyRoute: options.companyRoute ?? null,
      });
      if (owns() && this.state.research?.selection === captured)
        this.valuation.activate(captured);
    }
  }
  closeResearch() {
    this.cancelFollowupOpening();
    this.followupResearch = null;
    if (this.clearResearch()) this.update({});
  }
  private clearResearch(operation = Symbol()) {
    this.researchOperation = operation;
    const hadResearch =
      this.state.research !== null || this.state.companyRoute !== null;
    this.companyRouteOperation?.abort();
    this.companyRouteOperation = null;
    // Model close notifications must never expose the visit with a cleared section.
    if (hadResearch)
      this.state = { ...this.state, research: null, companyRoute: null };
    if (!this.clearCompanySourceOperations(operation)) return hadResearch;
    this.valuation.activate(null);
    if (this.researchOperation !== operation) return hadResearch;
    if (!this.closeFinancialResearch(operation)) return hadResearch;
    this.filings.close();
    if (this.researchOperation !== operation) return hadResearch;
    this.eod.close();
    return hadResearch;
  }
  private clearCompanySourceOperations(operation: symbol) {
    this.companySourcePass.clear();
    if (this.researchOperation !== operation) return false;
    this.companySnapshotLoad.clear();
    return this.researchOperation === operation;
  }
  private closeFinancialResearch(operation: symbol) {
    this.annual.close();
    if (this.researchOperation !== operation) return false;
    this.interim.close();
    return this.researchOperation === operation;
  }
  private canSwitchResearch(selection: ManagedResearchSelection | null) {
    if (
      this.retired ||
      !selection ||
      selection.catalogSnapshotSha256 !== this.state.snapshot?.snapshotSha256
    )
      return false;
    if (selection.origin === "discover") return true;
    if (selection.origin === "screening") {
      const screen = this.financialScreen.getSnapshot();
      return (
        !screen.catalogChanged &&
        Boolean(
          screen.run?.rows.some(
            (row) =>
              row.report?.response &&
              row.report.response.security.cik === selection.cik &&
              membershipMatchesResult(
                { ...selection.listing, note: "" },
                row.member.listing,
              ),
          ),
        )
      );
    }
    if (selection.origin === "route") return selection.cik === null;
    if (selection.origin === "markets") {
      const current = this.markets.selection(selection.listing.listingId);
      return (
        current !== null &&
        current.catalogSnapshotSha256 === selection.catalogSnapshotSha256 &&
        membershipMatchesResult(
          { ...selection.listing, note: "" },
          current.listing,
        )
      );
    }
    if (selection.origin === "followups") {
      const context = this.followupResearch;
      const entry = context ? this.followups.currentEntry(context.id) : null;
      return (
        context !== null &&
        companyEvidenceSelectionMatches(context.selection, selection) &&
        entry !== null &&
        entry.catalogSnapshotSha256 === selection.catalogSnapshotSha256 &&
        selection.cik === null &&
        membershipMatchesResult(
          { ...entry.listing, note: "" },
          selection.listing,
        )
      );
    }
    if (selection.origin === "portfolio") {
      const draft = this.portfolio.coordinator.getSnapshot().draft;
      return (
        selection.cik === null &&
        draft?.ledger?.snapshotSha256 === selection.catalogSnapshotSha256 &&
        draft.ledger.identities.some((identity) =>
          membershipMatchesResult({ ...identity, note: "" }, selection.listing),
        )
      );
    }
    if (selection.origin !== "watchlist") return false;
    const draft = this.coordinator.getSnapshot().draft;
    return (
      selection.cik === null &&
      draft?.snapshotSha256 === this.currentWatchlistCatalogDigest() &&
      draft.memberships.some((member) =>
        membershipMatchesResult(member, selection.listing),
      )
    );
  }
  createPortfolioCloseReview() {
    return new ManagedPortfolioCloseReview(
      this.eodAccess,
      (error) => this.coordinator.readError(error),
      () => this.invalidateCatalog(),
      this.portfolioPriceCoverage,
    );
  }
  /** A root Portfolio visit capability; navigation round trips cannot renew it. */
  capturePortfolioWatchlistRoute(): (() => boolean) | null {
    const view = this.state;
    const navigation = this.navigationRevision;
    const revision = this.viewRevision;
    const current = () =>
      !this.retired &&
      !this.navigationBlocked &&
      this.sessionOwner.getSnapshot().phase === "active" &&
      this.navigationRevision === navigation &&
      this.viewRevision === revision &&
      this.state === view &&
      view.view === "portfolio" &&
      !view.research &&
      !view.companyRoute &&
      !view.read &&
      !view.review &&
      !view.reviewing &&
      this.canNavigate();
    return current() ? current : null;
  }
  openPortfolioResearch(
    capturedDraft: PortfolioDraft,
    listing: PersonalPortfolioIdentity,
  ) {
    const ledger = capturedDraft.ledger;
    if (
      !this.canNavigate() ||
      this.navigationBlocked ||
      this.state.view !== "portfolio" ||
      this.state.research ||
      this.state.companyRoute ||
      !this.portfolio.canEdit() ||
      this.portfolio.coordinator.getSnapshot().draft !== capturedDraft ||
      !ledger?.identities.includes(listing) ||
      ledger.snapshotSha256 !== this.state.snapshot?.snapshotSha256
    )
      return;
    const selection: ManagedResearchSelection = {
      catalogSnapshotSha256: this.state.snapshot.snapshotSha256,
      listing: listingIdentity(listing),
      cik: null,
      origin: "portfolio",
    };
    this.openResearch(selection, "eod", {
      admit: () =>
        this.portfolio.coordinator.getSnapshot().draft === capturedDraft &&
        this.canSwitchResearch(selection),
    });
  }
  switchToFilings() {
    this.switchResearch("filings");
  }
  private holdingNavigationReady(selection: ManagedResearchSelection) {
    if (this.retired) return false;
    if (!this.researchSourceRouteReady(selection)) return false;
    return this.canNavigate();
  }
  private holdingVisitCurrent(
    selection: ManagedResearchSelection,
    visit: ManagedResearchVisit | null,
    operation: symbol,
  ) {
    if (this.state.research !== visit) return false;
    if (visit?.selection !== selection) return false;
    return this.researchOperation === operation;
  }
  private researchFollowupRoute(selection: ManagedResearchSelection) {
    const visit = this.state.research,
      operation = this.researchOperation;
    const navigation = this.navigationRevision,
      view = this.viewRevision;
    return () =>
      this.holdingNavigationReady(selection) &&
      this.holdingVisitCurrent(selection, visit, operation) &&
      this.navigationRevision === navigation &&
      this.viewRevision === view &&
      this.canUseResearchSource(selection);
  }
  captureValuationFollowup(selection: ManagedResearchSelection) {
    return captureValuationFollowupContext(
      this,
      selection,
      this.researchFollowupRoute(selection),
    );
  }
  canLoadValuationFollowups(selection: ManagedResearchSelection): boolean {
    const { port } = captureValuationFollowupContext(
      this,
      selection,
      this.researchFollowupRoute(selection),
      false,
    );
    return (
      port !== null &&
      port.isCurrent() &&
      this.followups.canLoadForNextCheck(port.member)
    );
  }
  async loadValuationFollowups(
    selection: ManagedResearchSelection,
    formIsCurrent: () => boolean,
  ): Promise<void> {
    const { port } = captureValuationFollowupContext(
      this,
      selection,
      this.researchFollowupRoute(selection),
      false,
    );
    if (!port || !port.isCurrent()) return;
    await this.followups.loadForNextCheck(
      port.member,
      () => port.isCurrent() && formIsCurrent() && port.isCurrent(),
    );
  }
  private holdingFollowupContext(
    selection: ManagedResearchSelection,
    includeFollowups = true,
  ) {
    return captureHoldingFollowupContext(
      this,
      selection,
      this.researchFollowupRoute(selection),
      includeFollowups,
    );
  }
  /** Current authored readout, available without a Follow-ups or Watchlist Load. */
  getHoldingResearchPosition(
    selection: ManagedResearchSelection,
  ): HoldingFollowupPreview["position"] | null {
    return this.holdingFollowupContext(selection, false).position;
  }
  private holdingCreationContext(
    position: HoldingFollowupPosition,
  ): HoldingCreationContext | null {
    const selection = this.state.research?.selection;
    if (!selection) return null;
    const context = this.holdingFollowupContext(selection, false);
    if (!context.position) return null;
    if (!context.isCurrent()) return null;
    if (!holdingPositionsMatch(context.position, position)) return null;
    return {
      position: context.position,
      catalogSnapshotSha256: selection.catalogSnapshotSha256,
      isCurrent: context.isCurrent,
    };
  }
  captureHoldingFollowup(selection: ManagedResearchSelection): {
    port: HoldingFollowupPort | null;
    reason: string | null;
  } {
    const context = this.holdingFollowupContext(selection);
    if (!context.position || !context.isCurrent())
      return {
        port: null,
        reason:
          context.reason ??
          "Return to the current holding before previewing its check.",
      };
    return {
      port: Object.freeze({
        model: this.followups,
        position: context.position,
        isCurrent: context.isCurrent,
      }),
      reason: null,
    };
  }
  canLoadHoldingFollowups(selection: ManagedResearchSelection): boolean {
    const context = this.holdingFollowupContext(selection, false);
    return (
      context.position !== null &&
      context.isCurrent() &&
      this.followups.canLoadHoldingChecks(context.position)
    );
  }
  async loadHoldingFollowups(
    selection: ManagedResearchSelection,
    formIsCurrent: () => boolean,
  ): Promise<void> {
    const context = this.holdingFollowupContext(selection, false);
    if (!context.position || !context.isCurrent()) return;
    await this.followups.loadHoldingChecks(
      context.position,
      () => context.isCurrent() && formIsCurrent() && context.isCurrent(),
    );
  }
  private holdingReviewDestinationReady(routerTransition: boolean) {
    if (!routerTransition) return this.followupOpeningRouteReady();
    if (this.retired) return false;
    if (this.followupsNavigationDepth > 0) return false;
    if (this.state.view !== "followups") return false;
    return !this.state.research && !this.state.companyRoute;
  }
  private navigateHoldingReview(navigate: (() => boolean) | undefined) {
    if (navigate) return navigate();
    this.setView("followups");
    return true;
  }
  private holdingReviewRoute(
    saved: ReturnType<ManagedResearchFollowups["coordinator"]["getSnapshot"]>,
    session: ManagedSessionOwner,
    revision: number,
    routerTransition: boolean,
  ) {
    const navigation = this.navigationRevision;
    return () =>
      this.holdingReviewDestinationReady(routerTransition) &&
      this.canNavigate() &&
      this.viewRevision === revision + 1 &&
      this.navigationRevision === navigation &&
      this.sessionOwner === session &&
      session.getSnapshot().phase === "active" &&
      this.followups.coordinator.getSnapshot() === saved;
  }
  private holdingReviewFileCurrent(activity: object) {
    return (
      this.followups.getDraftFileActivityRevision() === activity &&
      !this.followups.hasDraftFileActivity()
    );
  }
  private holdingReviewContinuation(
    routeCurrent: () => boolean,
    session: ManagedSessionOwner,
    initial: ReturnType<ManagedResearchFollowups["getSnapshot"]>,
    activity: object,
  ) {
    if (!routeCurrent()) return null;
    if (this.followups.getSnapshot() !== initial) return null;
    const acceptedSession = session.getSnapshot();
    return () =>
      routeCurrent() &&
      session.getSnapshot() === acceptedSession &&
      this.holdingReviewFileCurrent(activity);
  }
  reviewHoldingFollowup(
    selection: ManagedResearchSelection,
    navigate?: () => boolean,
  ): FollowupReview | null {
    const context = this.holdingFollowupContext(selection);
    const saved = this.followups.coordinator.getSnapshot(),
      session = this.sessionOwner;
    const initial = this.followups.getSnapshot();
    const activity = this.followups.getDraftFileActivityRevision();
    const draft = saved.draft;
    if (!draft) return null;
    const entry = draft.entries.find(
      (row) => row.listing.listingId === selection.listing.listingId,
    );
    if (!entry) return null;
    if (!context.isCurrent()) return null;
    const revision = this.viewRevision;
    if (!this.navigateHoldingReview(navigate)) return null;
    const routeCurrent = this.holdingReviewRoute(
      saved,
      session,
      revision,
      navigate !== undefined,
    );
    const current = this.holdingReviewContinuation(
      routeCurrent,
      session,
      initial,
      activity,
    );
    if (!current) return null;
    return selectHoldingFollowupForReview(this, entry, draft, current);
  }
  private cancelFollowupOpening() {
    const operation = this.followupOpenOperation;
    this.followupOpenOperation = null;
    this.preparedFollowup = null;
    if (this.state.followupOpening) this.update({ followupOpening: false });
    operation?.abort();
  }
  reviewFollowup(
    entry: ResearchFollowup,
    navigate: () => boolean,
  ): FollowupReview | null {
    const draft = this.followups.coordinator.getSnapshot().draft;
    const active = () =>
      !this.retired &&
      this.sessionOwner.getSnapshot().phase === "active" &&
      this.followups.coordinator.getSnapshot().draft === draft &&
      draft !== null &&
      draft.entries.includes(entry) &&
      this.followups.currentEntry(entry.id) === entry;
    if (
      !active() ||
      this.navigationBlocked ||
      !this.isDatedFollowupReviewOrigin() ||
      this.state.research ||
      this.state.companyRoute ||
      !draft
    )
      return null;
    const revision = this.viewRevision;
    if (!navigate()) return null;
    const navigation = this.navigationRevision;
    const current = () =>
      active() &&
      !this.navigationBlocked &&
      this.navigationRevision === navigation &&
      this.viewRevision === revision + 1 &&
      this.state.view === "followups" &&
      !this.state.research &&
      !this.state.companyRoute;
    if (!current()) return null;
    this.followups.select(entry.id);
    if (!current()) return null;
    this.followups.setFilter(
      entry.status === "completed" ? "completed" : "open",
    );
    const selected = this.followups.getSnapshot();
    const isCurrent = () =>
      current() &&
      this.followups.getSnapshot() === selected &&
      selected.selectedId === entry.id;
    return isCurrent() ? Object.freeze({ entry, draft, isCurrent }) : null;
  }
  private followupRouteIsCurrent() {
    if (this.retired) return false;
    if (this.navigationBlocked) return false;
    if (this.followupsNavigationDepth > 0) return false;
    return this.state.view === "followups";
  }
  private followupOpeningRouteReady() {
    if (!this.followupRouteIsCurrent()) return false;
    return !this.state.research && !this.state.companyRoute;
  }
  private followupEntryIsCurrent(
    entry: ResearchFollowup,
    draft: ResearchFollowupsPayload,
    snapshot: ManagedCatalogSnapshotDto,
  ) {
    if (!draft.entries.includes(entry)) return false;
    return entry.catalogSnapshotSha256 === snapshot.snapshotSha256;
  }
  private followupReviewHandle(entry: ResearchFollowup) {
    const review = this.followupsReview.getSnapshot();
    if (!review.entered) return null;
    if (review.phase !== "reviewing") return null;
    const selected = review.selected;
    if (!selected) return null;
    return selected.entry === entry ? selected.handle : null;
  }
  private matchesFollowupPreparation(context: FollowupPreparationContext) {
    if (this.navigationRevision !== context.navigationRevision) return false;
    if (this.state.snapshot !== context.snapshot) return false;
    if (this.followups.coordinator.getSnapshot().draft !== context.draft)
      return false;
    if (!this.ownsFollowupsReview(context.reviewHandle)) return false;
    return context.draft.entries.includes(context.entry);
  }
  private followupOpeningIsCurrent(context: FollowupOpeningContext) {
    if (!this.followupOpeningRouteReady()) return false;
    if (context.operation.signal.aborted) return false;
    if (this.followupOpenOperation !== context.operation) return false;
    return this.matchesFollowupPreparation(context);
  }
  private followupPreparedDraftIsCurrent(capture: PreparedFollowupResearch) {
    if (
      this.state.snapshot?.snapshotSha256 !==
      capture.selection.catalogSnapshotSha256
    )
      return false;
    if (this.followups.coordinator.getSnapshot().draft !== capture.draft)
      return false;
    return capture.draft.entries.includes(capture.entry);
  }
  private preparedFollowupIsCurrent(capture: PreparedFollowupResearch) {
    if (!this.followupRouteIsCurrent()) return false;
    if (this.preparedFollowup !== capture) return false;
    if (!this.ownsFollowupsReview(capture.reviewHandle)) return false;
    if (this.navigationRevision !== capture.navigationRevision) return false;
    return this.followupPreparedDraftIsCurrent(capture);
  }
  async prepareFollowupResearch(
    entry: ResearchFollowup,
  ): Promise<PreparedFollowupResearch | null> {
    const snapshot = this.state.snapshot;
    const draft = this.followups.coordinator.getSnapshot().draft;
    if (!this.followupOpeningRouteReady()) return null;
    if (!snapshot || !draft) return null;
    if (!this.followupEntryIsCurrent(entry, draft, snapshot)) return null;
    const review = this.followupsReview.getSnapshot();
    const reviewHandle = this.followupReviewHandle(entry);
    const revision = this.navigationRevision;
    if (review.entered && reviewHandle === null) this.followupsReview.leave();
    if (reviewHandle === null && this.followupsReview.getSnapshot().entered)
      return null;
    const context: FollowupPreparationContext = {
      entry,
      draft,
      snapshot,
      reviewHandle,
      navigationRevision: revision,
    };
    this.cancelFollowupOpening();
    if (this.followupOpenOperation) return null;
    if (!this.matchesFollowupPreparation(context)) return null;
    const operation = new AbortController();
    this.followupOpenOperation = operation;
    const opening = { ...context, operation };
    const current = () => this.followupOpeningIsCurrent(opening);
    this.update({
      followupOpening: true,
      message: "Checking this company's current listing…",
    });
    try {
      if (!current()) return null;
      const request = {
        snapshotSha256: snapshot.snapshotSha256,
        listingIds: [entry.listing.listingId],
      };
      const response = await this.api.resolve(request, operation.signal);
      if (!current()) return null;
      const resolved = parseManagedCatalogResolveResponse(response, request);
      const listing = resolved?.results[0]?.listing;
      if (
        !listing ||
        !membershipMatchesResult({ ...entry.listing, note: "" }, listing)
      ) {
        this.update({
          message:
            "Review this follow-up's listing identity before opening company research.",
        });
        return null;
      }
      const capture: PreparedFollowupResearch = Object.freeze({
        reviewHandle,
        entry,
        draft,
        navigationRevision: revision,
        selection: Object.freeze({
          catalogSnapshotSha256: snapshot.snapshotSha256,
          listing: Object.freeze(listingIdentity(listing)),
          cik: null,
          origin: "followups" as const,
        }),
      });
      if (!current()) return null;
      this.preparedFollowup = capture;
      this.update({ message: "" });
      return current() && this.preparedFollowup === capture ? capture : null;
    } catch (error) {
      if (current()) {
        if (
          error instanceof TrialApiError &&
          ["unauthenticated", "access_denied", "origin_denied"].includes(
            error.code,
          )
        )
          this.coordinator.readError(error);
        else if (error instanceof ManagedCatalogChangedError)
          this.invalidateCatalog();
        else
          this.update({
            message:
              "Company research could not be opened. Your follow-up draft is unchanged.",
          });
      }
      return null;
    } finally {
      if (this.followupOpenOperation === operation) {
        this.followupOpenOperation = null;
        this.update({ followupOpening: false });
      }
    }
  }
  openFollowupResearch(capture: PreparedFollowupResearch) {
    const current = () => this.preparedFollowupIsCurrent(capture);
    if (!current() || this.state.research || this.state.companyRoute) return;
    this.followupResearch = {
      reviewHandle: capture.reviewHandle,
      id: capture.entry.id,
      selection: capture.selection,
    };
    this.openResearch(capture.selection, "eod", { admit: () => current() });
    if (this.preparedFollowup === capture) this.preparedFollowup = null;
  }
  switchToInterim() {
    this.switchResearch("interim");
  }
  switchToAnnual() {
    this.switchResearch("annual");
  }
  switchToEod() {
    this.switchResearch("eod");
  }
  private companySourceAdmission(visit: ManagedResearchVisit) {
    const operation = this.researchOperation;
    const revision = this.navigationRevision;
    return () =>
      this.state.research === visit &&
      this.researchOperation === operation &&
      this.navigationRevision === revision &&
      this.researchSourceRouteReady(visit.selection) &&
      this.canUseResearchSource(visit.selection);
  }
  prepareCompanySourcePass(
    visit: ManagedResearchVisit,
    names: readonly CompanySnapshotLoadSource[],
  ): CompanySourcePassPreview | null {
    const admitted = this.companySourceAdmission(visit);
    if (!admitted()) return null;
    return this.companySourcePass.prepare(visit.selection, admitted, names);
  }
  async runCompanySourcePass(
    visit: ManagedResearchVisit,
    preview: CompanySourcePassPreview,
  ): Promise<void> {
    if (!this.companySourceAdmission(visit)()) return;
    await this.companySourcePass.start(preview);
  }
  cancelCompanySourcePass(visit: ManagedResearchVisit): void {
    if (this.state.research === visit) this.companySourcePass.cancel();
  }
  clearCompanySourcePass(visit: ManagedResearchVisit): void {
    if (this.state.research === visit) this.companySourcePass.clear();
  }
  async loadCompanySnapshot(visit: ManagedResearchVisit): Promise<void> {
    const admitted = this.companySourceAdmission(visit);
    if (!admitted()) return;
    this.companySourcePass.clear();
    if (!admitted()) return;
    await this.companySnapshotLoad.start(visit.selection, admitted);
  }
  cancelCompanySnapshot(visit: ManagedResearchVisit): void {
    if (this.state.research !== visit) return;
    this.companySourcePass.cancel();
    if (this.state.research === visit) this.companySnapshotLoad.cancel();
  }
  async requestResearchSource(
    visit: ManagedResearchVisit,
    section: ManagedResearchVisit["section"],
  ): Promise<void> {
    if (this.state.research !== visit) return;
    const selection = visit.selection;
    const operation = this.researchOperation;
    const navigationRevision = this.navigationRevision;
    const admitted = () =>
      this.researchSourceRouteReady(selection) &&
      this.navigationRevision === navigationRevision &&
      this.researchOperation === operation &&
      this.state.research?.selection === selection &&
      this.canUseResearchSource(selection);
    if (!admitted()) return;
    this.companySourcePass.clear();
    if (!admitted()) return;
    this.companySnapshotLoad.cancel();
    if (!admitted()) return;
    const switched = this.switchResearch(section, admitted);
    if (!switched || this.state.research !== switched || !admitted()) return;
    if (section === "eod") {
      if (!this.eod.hasPriceCoverage(selection.listing)) return;
    } else if (!this[section].hasCoverage(selection)) return;
    const model = this[section];
    if (
      !companyEvidenceSelectionMatches(selection, model.getSnapshot().selection)
    )
      return;
    await model.load();
  }
  cancelResearchSource(
    visit: ManagedResearchVisit,
    section: ManagedResearchVisit["section"],
  ): void {
    if (
      this.state.research !== visit ||
      !this.researchSourceRouteReady(visit.selection) ||
      !this.canUseResearchSource(visit.selection) ||
      !companyEvidenceSelectionMatches(
        visit.selection,
        this[section].getSnapshot().selection,
      )
    )
      return;
    this.companySourcePass.cancel();
    if (this.state.research !== visit) return;
    this.companySnapshotLoad.cancel();
    if (this.state.research === visit) this[section].cancel();
  }
  private researchSourceRouteReady(selection: ManagedResearchSelection) {
    const route = this.state.companyRoute;
    return (
      !this.navigationBlocked ||
      (route?.status === "open" &&
        route.listingId === selection.listing.listingId)
    );
  }
  private canUseResearchSource(selection: ManagedResearchSelection) {
    return (
      this.canSwitchResearch(selection) &&
      !this.filings.getSnapshot().catalogChanged &&
      !this.annual.getSnapshot().catalogChanged &&
      !this.interim.getSnapshot().catalogChanged &&
      !this.eod.getSnapshot().catalogChanged
    );
  }
  private switchResearch(
    section: ManagedResearchVisit["section"],
    admit: () => boolean = () => true,
  ): ManagedResearchVisit | null {
    const research = this.state.research;
    if (!research) return null;
    if (!this.canUseResearchSource(research.selection)) {
      this.closeResearch();
      return null;
    }
    const operation = this.researchOperation;
    const current = () =>
      this.state.research === research &&
      this.researchOperation === operation &&
      this.canUseResearchSource(research.selection) &&
      admit();
    if (!current()) return null;
    this.companySourcePass.cancel();
    if (!current()) return null;
    this.companySnapshotLoad.cancel();
    if (!current()) return null;
    if (research.section === section) return research;
    this[research.section].cancel();
    if (!current()) return null;
    if (!this[section].getSnapshot().selection)
      this[section].open(research.selection);
    const targetSelection = this[section].getSnapshot().selection;
    if (
      !current() ||
      !companyEvidenceSelectionMatches(research.selection, targetSelection)
    )
      return null;
    const switched = Object.freeze({ ...research, section });
    this.update({ research: switched });
    return this.state.research === switched &&
      this[section].getSnapshot().selection === targetSelection
      ? switched
      : null;
  }
  researchFollowupContext(
    selection: ManagedResearchSelection,
  ): ManagedResearchFollowupContext | null {
    const visit: FollowupResearchVisit = {
      owner: this.followupResearch,
      operation: this.researchOperation,
      navigationRevision: this.navigationRevision,
      viewRevision: this.viewRevision,
      selection,
    };
    return captureResearchFollowupContext({
      model: this.followups,
      selection,
      owner: visit.owner,
      isVisitCurrent: () =>
        this.followupResearchSessionIsCurrent(visit) &&
        this.followupResearchRouteIsCurrent(visit),
      canEditVisit: () =>
        this.canNavigate() &&
        this.researchSourceRouteReady(selection) &&
        this.canUseResearchSource(selection),
    });
  }
  private filingsAssessmentSource(
    selection: ManagedResearchSelection,
    response: ManagedSecFilingsResponseDto,
  ) {
    const visit = this.state.research;
    if (visit?.selection !== selection) return null;
    if (visit.section !== "filings") return null;
    const source = this.filings.getSnapshot();
    if (source.response !== response) return null;
    if (source.running || source.catalogChanged) return null;
    if (!companyEvidenceSelectionMatches(selection, source.selection))
      return null;
    if (response.issuer.status !== "available") return null;
    return source;
  }
  private filingsAssessmentEditsReady() {
    if (!this.followups.canEdit()) return false;
    if (this.followups.hasDraftFileActivity()) return false;
    if (this.fileCatalogReviewRequired) return false;
    const saved = this.followups.coordinator.getSnapshot();
    if (saved.saved === null) return false;
    if (saved.baseVersion !== saved.saved.version) return false;
    const watchlist = this.coordinator.getSnapshot();
    if (watchlist.phase !== "idle") return false;
    return (
      !watchlist.conflict && !watchlist.uncertain && !watchlist.replayPending
    );
  }
  private filingsAssessmentLifetime(
    followup: ManagedResearchFollowupContext,
    source: ReturnType<ManagedCompanyFilings["getSnapshot"]>,
  ) {
    const visit = this.state.research;
    const saved = this.followups.coordinator.getSnapshot();
    const watchlist = this.coordinator.getSnapshot();
    const session = this.sessionOwner.getSnapshot();
    const activity = this.followups.getDraftFileActivityRevision();
    const resourcesCurrent = () => {
      if (this.state.research !== visit) return false;
      if (this.followups.coordinator.getSnapshot() !== saved) return false;
      if (this.coordinator.getSnapshot() !== watchlist) return false;
      if (this.sessionOwner.getSnapshot() !== session) return false;
      return this.followups.getDraftFileActivityRevision() === activity;
    };
    return () => {
      if (!followup.isCurrent()) return false;
      if (!resourcesCurrent()) return false;
      if (this.filings.getSnapshot() !== source) return false;
      return this.filingsAssessmentEditsReady();
    };
  }
  captureFilingsAssessment(
    selection: ManagedResearchSelection,
    response: ManagedSecFilingsResponseDto,
  ): { port: FilingsAssessmentPort | null; reason: string | null } {
    const followup = this.researchFollowupContext(selection);
    if (!followup)
      return {
        port: null,
        reason:
          "Open this company through the existing Follow-ups check first.",
      };
    if (!followup.editable || !this.filingsAssessmentEditsReady())
      return {
        port: null,
        reason:
          "Finish the pending action, file activity or draft recovery before adding a filing reference.",
      };
    const source = this.filingsAssessmentSource(selection, response);
    if (!source)
      return {
        port: null,
        reason:
          "Choose an available, already loaded filing packet in this check's current company visit.",
      };
    const current = this.filingsAssessmentLifetime(followup, source);
    let consumed = false;
    const isCurrent = () => !consumed && current();
    const port = createFilingsAssessmentPort({
      entry: followup.entry,
      response,
      showingPrevious: source.showingPrevious,
      isCurrent,
      editAssessment: (raw) => {
        if (!isCurrent()) return false;
        consumed = true;
        followup.editAssessment(raw);
        return this.followups.currentEntry(followup.entry.id)?.result === raw;
      },
    });
    return {
      port,
      reason: port
        ? null
        : "The current check or filing context changed. Capture it again.",
    };
  }
  captureFollowupReviewNote(
    selection: ManagedResearchSelection,
    routeActive: () => boolean,
  ) {
    const followup = this.researchFollowupContext(selection);
    if (!followup) return null;
    return captureFollowupReviewNoteContext({
      followup,
      watchlist: () => this.getResearchWatchlist(selection),
      watchlistSaved: () => this.coordinator.getSnapshot(),
      followupsSaved: () => this.followups.coordinator.getSnapshot(),
      canEditFollowups: () =>
        this.followups.canEdit() &&
        this.canNavigate() &&
        this.researchSourceRouteReady(selection) &&
        this.canUseResearchSource(selection),
      routeActive,
      note: (note, expectedNote) =>
        this.noteResearch(selection, note, expectedNote),
    });
  }
  private followupResearchSessionIsCurrent(visit: FollowupResearchVisit) {
    return (
      !this.retired &&
      this.sessionOwner.getSnapshot().phase === "active" &&
      this.followupResearch === visit.owner &&
      this.researchOperation === visit.operation
    );
  }
  private followupResearchRouteIsCurrent(visit: FollowupResearchVisit) {
    return (
      this.navigationRevision === visit.navigationRevision &&
      this.viewRevision === visit.viewRevision &&
      this.state.view === "followups" &&
      this.state.research?.selection === visit.selection &&
      this.state.snapshot?.snapshotSha256 ===
        visit.selection.catalogSnapshotSha256
    );
  }
  researchThesisFollowupContext(selection: ManagedResearchSelection) {
    const member = this.getResearchWatchlist(selection).member;
    return member ? this.thesisFollowupContext(member, selection) : undefined;
  }
  thesisFollowupContext(
    member: WatchlistMembership,
    selection?: ManagedResearchSelection,
  ): ThesisFollowupContext {
    const navigation = this.navigationRevision;
    const view = this.viewRevision;
    return {
      model: this.followups,
      member,
      isCurrent: () => {
        if (!this.canNavigate() || !this.canEdit()) return false;
        if (
          this.navigationRevision !== navigation ||
          this.viewRevision !== view
        )
          return false;
        if (!this.currentWatchlistContains(member)) return false;
        return this.thesisFollowupHostIsCurrent(member, selection);
      },
    };
  }
  private thesisFollowupHostIsCurrent(
    member: WatchlistMembership,
    selection?: ManagedResearchSelection,
  ) {
    if (selection) {
      const watchlist = this.getResearchWatchlist(selection);
      return watchlist.canEdit && watchlist.member === member;
    }
    return (
      this.watchlistResearchVisitActive() &&
      this.coordinator.getSnapshot().draft?.memberships.includes(member) ===
        true
    );
  }
  getResearchWatchlist(
    selection: ManagedResearchSelection,
  ): ResearchWatchlistState {
    const snapshot = this.coordinator.getSnapshot();
    let revision = this.reportWatchlistRevisions.get(snapshot);
    if (!revision) {
      revision = Symbol();
      this.reportWatchlistRevisions.set(snapshot, revision);
    }
    const blocked = (
      reason: string,
      member: WatchlistMembership | null = null,
    ): ResearchWatchlistState => ({
      revision,
      member,
      canAdd: false,
      canEdit: false,
      reason,
    });
    if (this.retired || selection !== this.state.research?.selection)
      return blocked(
        "Open this company again before editing its watchlist note.",
      );
    if (
      !this.canSwitchResearch(selection) ||
      this.filings.getSnapshot().catalogChanged ||
      this.annual.getSnapshot().catalogChanged ||
      this.eod.getSnapshot().catalogChanged
    )
      return blocked(
        "Refresh the catalog and reopen this company before editing.",
      );
    const saved = this.coordinator.getSnapshot();
    const draft = saved.draft;
    if (!draft)
      return blocked("Load My Watchlist before adding or editing a note.");
    if (draft.snapshotSha256 !== selection.catalogSnapshotSha256)
      return blocked("Review catalog changes in My Watchlist before editing.");
    const member =
      draft.memberships.find(
        (entry) => entry.listingId === selection.listing.listingId,
      ) ?? null;
    if (member && !membershipMatchesResult(member, selection.listing))
      return blocked("Review this listing's changed identity in My Watchlist.");
    if (!this.canEdit()) {
      const reason =
        saved.uncertain || saved.replayPending || saved.phase === "reconciling"
          ? "Review the pending save in My Watchlist before editing."
          : saved.conflict
            ? "Resolve the conflict in My Watchlist before editing."
            : "Wait for the current My Watchlist operation to finish before editing.";
      return blocked(reason, member);
    }
    if (!member && draft.memberships.length >= 10_000)
      return blocked(
        "Remove an entry from My Watchlist before adding this company.",
      );
    return {
      revision,
      member,
      canAdd: member === null,
      canEdit: member !== null,
      reason: null,
    };
  }
  /** Capture the complete draft and visit before a local report review action. */
  captureCompanyReportRevisitTarget(
    selection: ManagedResearchSelection,
    routeActive: () => boolean,
  ) {
    return captureCompanyReportRevisitTargetContext({
      selection,
      routeActive,
      watchlist: () => this.getResearchWatchlist(selection),
      saved: () => this.coordinator.getSnapshot(),
      session: () => this.sessionOwner.getSnapshot(),
      visit: () => this.state.research,
      lifetime: () => ({
        retired: this.retired,
        navigationBlocked: !this.researchSourceRouteReady(selection),
        operation: this.researchOperation,
        navigation: this.navigationRevision,
      }),
      note: (note, expectedNote) =>
        this.noteResearch(selection, note, expectedNote),
    });
  }
  addResearchToWatchlist(selection: ManagedResearchSelection) {
    if (!this.getResearchWatchlist(selection).canAdd) return;
    const draft = this.coordinator.getSnapshot().draft!;
    this.edit([
      ...draft.memberships,
      { ...listingIdentity(selection.listing), note: "" },
    ]);
  }
  noteResearch(
    selection: ManagedResearchSelection,
    note: string,
    expectedNote?: string,
  ) {
    if (!this.getResearchWatchlist(selection).canEdit) return;
    this.note(selection.listing.listingId, note, expectedNote);
  }
  preparePriceStudiesNote(
    selection: ManagedResearchSelection,
    response: ManagedEodHistoryResponseDto,
    keys: readonly ManagedPriceStudyKey[],
    selectionIsCurrent: () => boolean,
  ) {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        preview: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before preparing study results.",
      };
    const member = watchlist.member;
    const visit = this.state.research;
    const operation = this.researchOperation;
    const source = this.eod.getSnapshot();
    const saved = this.coordinator.getSnapshot();
    const navigationRevision = this.navigationRevision;
    const workspaceIsCurrent = () =>
      !this.retired &&
      this.researchOperation === operation &&
      this.navigationRevision === navigationRevision &&
      this.researchSourceRouteReady(selection) &&
      this.canUseResearchSource(selection) &&
      this.state.research === visit &&
      visit?.section === "eod" &&
      visit.selection === selection &&
      this.eod.getSnapshot() === source &&
      source.response === response &&
      !source.running &&
      !source.catalogChanged &&
      this.coordinator.getSnapshot() === saved &&
      this.getResearchWatchlist(selection).canEdit;
    const isCurrent = () =>
      workspaceIsCurrent() && selectionIsCurrent() && workspaceIsCurrent();
    return this.priceStudiesNote.prepare({
      response,
      keys,
      note: member.note,
      showingPrevious: source.showingPrevious,
      isCurrent,
      apply: (note) => {
        if (!isCurrent()) throw new Error("Study note capture changed.");
        this.noteResearch(selection, note, member.note);
        if (
          this.coordinator
            .getSnapshot()
            .draft?.memberships.find(
              (entry) => entry.listingId === selection.listing.listingId,
            )?.note !== note
        )
          throw new Error("Study note could not be applied.");
      },
    });
  }
  priceStudiesNoteIsCurrent(preview: PreparedPriceStudiesNote) {
    return this.priceStudiesNote.isCurrent(preview);
  }
  appendPriceStudiesNote(preview: PreparedPriceStudiesNote) {
    return this.priceStudiesNote.append(preview);
  }
  prepareAnnualStatementsNote(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
    cells: readonly ManagedAnnualStatementCellSelection[],
    selectionIsCurrent: () => boolean,
  ): ManagedAnnualStatementsNotePreparation {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        preview: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before preparing statement cells.",
      };
    const member = watchlist.member;
    const visit = this.state.research;
    const operation = this.researchOperation;
    const annual = this.annual.getSnapshot();
    const saved = this.coordinator.getSnapshot();
    const navigationRevision = this.navigationRevision;
    const workspaceIsCurrent = () =>
      !this.retired &&
      this.researchOperation === operation &&
      this.navigationRevision === navigationRevision &&
      this.researchSourceRouteReady(selection) &&
      this.canUseResearchSource(selection) &&
      this.state.research === visit &&
      visit?.section === "annual" &&
      visit.selection === selection &&
      this.annual.getSnapshot() === annual &&
      annual.response === response &&
      annual.view !== null &&
      annual.view.canonical === response.evidence &&
      !annual.running &&
      !annual.checkingSeed &&
      !annual.catalogChanged &&
      this.coordinator.getSnapshot() === saved &&
      this.getResearchWatchlist(selection).canEdit;
    const isCurrent = () =>
      workspaceIsCurrent() && selectionIsCurrent() && workspaceIsCurrent();
    const proposal = prepareManagedAnnualStatementsNote({
      response,
      selection: cells,
      note: member.note,
      showingPrevious: annual.showingPrevious,
      isCurrent,
      apply: (note) => {
        if (!isCurrent()) throw new Error("Statement note capture changed.");
        this.noteResearch(selection, note, member.note);
        if (
          this.coordinator
            .getSnapshot()
            .draft?.memberships.find(
              (entry) => entry.listingId === selection.listing.listingId,
            )?.note !== note
        )
          throw new Error("Statement note could not be applied.");
      },
    });
    if (proposal.preview) this.annualStatementsPreviews.add(proposal.preview);
    return proposal;
  }
  annualStatementsPreviewIsCurrent(
    preview: PreparedManagedAnnualStatementsNote,
  ) {
    return (
      this.annualStatementsPreviews.has(preview) &&
      isManagedAnnualStatementsNoteCurrent(preview)
    );
  }
  appendAnnualStatementsNote(preview: PreparedManagedAnnualStatementsNote) {
    if (!this.annualStatementsPreviews.has(preview))
      return {
        appended: false,
        message:
          "Preview these statement cells in the current workspace before appending.",
      };
    this.annualStatementsPreviews.delete(preview);
    return appendManagedAnnualStatementsNote(preview);
  }
  prepareInterimStatementsNote(
    selection: ManagedResearchSelection,
    response: PersonalSecInterimCanonicalResponseDto,
    cells: readonly ManagedInterimCellSelection[],
    selectionIsCurrent: () => boolean,
  ): ManagedInterimNotePreparation {
    const capture = {
      selection,
      visit: this.state.research,
      operation: this.researchOperation,
      navigationRevision: this.navigationRevision,
    };
    const visitCurrent = () => this.interimNoteVisitCurrent(capture);
    const proposal = captureManagedInterimNote({
      response,
      cells,
      source: this.interim.getSnapshot,
      watchlist: () => this.getResearchWatchlist(selection),
      visitCurrent,
      selectionCurrent: selectionIsCurrent,
      apply: (note, previous) => this.noteResearch(selection, note, previous),
    });
    if (proposal.preview) this.interimStatementsPreviews.add(proposal.preview);
    return proposal;
  }
  private interimNoteVisitCurrent(capture: {
    readonly selection: ManagedResearchSelection;
    readonly visit: ManagedResearchVisit | null;
    readonly operation: symbol;
    readonly navigationRevision: number;
  }) {
    if (this.retired || this.researchOperation !== capture.operation)
      return false;
    if (this.navigationRevision !== capture.navigationRevision) return false;
    if (!this.interimNoteVisitMatches(capture)) return false;
    return (
      this.researchSourceRouteReady(capture.selection) &&
      this.canUseResearchSource(capture.selection)
    );
  }
  private interimNoteVisitMatches(capture: {
    readonly selection: ManagedResearchSelection;
    readonly visit: ManagedResearchVisit | null;
  }) {
    if (this.state.research !== capture.visit) return false;
    return (
      capture.visit?.section === "interim" &&
      capture.visit.selection === capture.selection
    );
  }
  interimStatementsPreviewIsCurrent(
    preview: PreparedManagedInterimStatementsNote,
  ) {
    return (
      this.interimStatementsPreviews.has(preview) &&
      isManagedInterimStatementsNoteCurrent(preview)
    );
  }
  appendInterimStatementsNote(preview: PreparedManagedInterimStatementsNote) {
    if (!this.interimStatementsPreviews.has(preview))
      return {
        appended: false,
        message:
          "Preview these statement cells in the current workspace before appending.",
      };
    this.interimStatementsPreviews.delete(preview);
    return appendManagedInterimStatementsNote(preview);
  }
  cancelInterimStatementsNote(preview: PreparedManagedInterimStatementsNote) {
    this.interimStatementsPreviews.delete(preview);
    retireManagedInterimStatementsNote(preview);
  }
  prepareFinancialReview(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
    keys: readonly PersonalSecAnnualFinancialReviewKey[],
  ): FinancialReviewPreparation {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        preview: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before preparing a financial review.",
      };
    const visit = this.state.research;
    const annual = this.annual.getSnapshot();
    const saved = this.coordinator.getSnapshot();
    const navigationRevision = this.navigationRevision;
    const isCurrent = () =>
      !this.retired &&
      this.researchSourceRouteReady(selection) &&
      this.navigationRevision === navigationRevision &&
      this.state.research === visit &&
      visit?.section === "annual" &&
      visit.selection === selection &&
      this.annual.getSnapshot() === annual &&
      annual.response === response &&
      !annual.running &&
      !annual.catalogChanged &&
      this.coordinator.getSnapshot() === saved &&
      this.getResearchWatchlist(selection).canEdit;
    return this.financialReview.prepare({
      note: watchlist.member.note,
      response,
      keys,
      showingPrevious: annual.showingPrevious,
      isCurrent,
      apply: (note) =>
        this.noteResearch(selection, note, watchlist.member!.note),
    });
  }
  financialReviewPreviewIsCurrent(preview: PreparedFinancialReview) {
    return this.financialReview.isCurrent(preview);
  }
  prepareAnnualRevenueBasis(
    selection: ManagedResearchSelection,
    concept: string,
  ) {
    const visit = this.state.research;
    const annual = this.annual.getSnapshot();
    const navigation = this.navigationRevision;
    const isCurrent = () => {
      if (!this.annualRevenueBasisVisitIsCurrent(selection, visit, navigation))
        return false;
      if (this.annual.getSnapshot() !== annual) return false;
      return this.annualRevenueBasisSourceIsSettled(annual);
    };
    return this.valuationRevenueBasis.prepare({
      selection,
      annual,
      concept,
      isCurrent,
    });
  }
  private annualRevenueBasisVisitIsCurrent(
    selection: ManagedResearchSelection,
    visit: ManagedDiscoveryState["research"],
    navigation: number,
  ) {
    if (this.retired) return false;
    if (this.navigationRevision !== navigation) return false;
    if (this.state.research !== visit) return false;
    if (visit?.selection !== selection) return false;
    return this.researchSourceRouteReady(selection);
  }
  private annualRevenueBasisSourceIsSettled(
    annual: ReturnType<ManagedAnnualReport["getSnapshot"]>,
  ) {
    if (annual.running) return false;
    if (annual.checkingSeed) return false;
    return !annual.catalogChanged;
  }
  annualRevenueBasisPreviewIsCurrent(preview: PreparedValuationRevenueBasis) {
    return this.valuationRevenueBasis.isCurrent(preview);
  }
  applyAnnualRevenueBasis(preview: PreparedValuationRevenueBasis) {
    return this.valuationRevenueBasis.apply(preview);
  }
  retireAnnualRevenueBasisPreview() {
    this.valuationRevenueBasis.retirePreview();
  }
  getAppliedAnnualRevenueBasis(selection: ManagedResearchSelection) {
    return this.valuationRevenueBasis.getApplied(selection);
  }
  private annualRevenueBasisForNote(
    selection: ManagedResearchSelection,
    model: "dcf" | "exit",
  ) {
    if (model === "dcf") return null;
    return this.getAppliedAnnualRevenueBasis(selection);
  }
  prepareValuationNote(
    selection: ManagedResearchSelection,
    model: "dcf" | "exit",
    scenario: AuthoredValuationScenario,
    includePriceComparison = false,
  ) {
    const watchlist = this.getResearchWatchlist(selection);
    const valuation = this.valuation.getSnapshot();
    const capture = valuation.calculation;
    const annualRevenueBasis = this.annualRevenueBasisForNote(selection, model);
    if (
      !watchlist.canEdit ||
      !watchlist.member ||
      !capture ||
      !valuation.editable
    )
      return {
        preview: null,
        reason:
          watchlist.reason ??
          "Calculate this company's valuation and add it to the watchlist draft before preparing a note.",
      };
    const visit = this.state.research;
    const saved = this.coordinator.getSnapshot();
    const annual = this.annual.getSnapshot();
    const price = this.eod.getSnapshot();
    const filings = this.filings.getSnapshot();
    const navigationRevision = this.navigationRevision;
    const isCurrent = () =>
      !this.retired &&
      this.navigationRevision === navigationRevision &&
      this.state.research === visit &&
      visit?.selection === selection &&
      this.researchSourceRouteReady(selection) &&
      this.valuation.getSnapshot() === valuation &&
      this.annual.getSnapshot() === annual &&
      !annual.running &&
      !annual.catalogChanged &&
      this.eod.getSnapshot() === price &&
      !price.running &&
      !price.catalogChanged &&
      this.filings.getSnapshot() === filings &&
      !filings.running &&
      !filings.catalogChanged &&
      this.coordinator.getSnapshot() === saved &&
      this.getResearchWatchlist(selection).canEdit &&
      this.annualRevenueBasisForNote(selection, model) === annualRevenueBasis;
    const proposal = prepareValuationNote({
      capture,
      model,
      scenario,
      selection,
      includePriceComparison,
      annualRevenueBasis,
      price,
      note: watchlist.member.note,
      isCurrent,
      apply: (note) =>
        this.noteResearch(selection, note, watchlist.member!.note),
    });
    if (proposal.preview) this.valuationNotePreviews.add(proposal.preview);
    return proposal;
  }
  valuationNotePreviewIsCurrent(preview: PreparedValuationNote) {
    return (
      this.valuationNotePreviews.has(preview) && isValuationNoteCurrent(preview)
    );
  }
  appendValuationNote(preview: PreparedValuationNote) {
    if (!this.valuationNotePreviews.has(preview))
      return {
        appended: false,
        message:
          "Preview this valuation note in the current workspace before appending.",
      };
    this.valuationNotePreviews.delete(preview);
    return appendValuationNote(preview);
  }
  appendFinancialReview(preview: PreparedFinancialReview) {
    return this.financialReview.append(preview);
  }
  private annualNoteProposal(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
    pair: PersonalSecAnnualPairDto,
  ): { note: string | null; reason: string | null } {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        note: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before adding Annual evidence.",
      };
    const annual = this.annual.getSnapshot();
    if (
      this.state.research?.section !== "annual" ||
      annual.response !== response
    )
      return {
        note: null,
        reason:
          "Choose evidence from the current Annual report before adding it.",
      };
    if (annual.running)
      return {
        note: null,
        reason: "Wait for the Annual report request to finish or cancel it.",
      };
    const excerpt = annualNoteExcerpt(response, pair, annual.showingPrevious);
    if (excerpt === null)
      return {
        note: null,
        reason: "Choose an eligible pair from the observed Annual report.",
      };
    const note =
      watchlist.member.note + (watchlist.member.note ? " " : "") + excerpt;
    if (normalizeWatchlistNote(note) === null)
      return {
        note: null,
        reason:
          "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      };
    return { note, reason: null };
  }
  getAnnualNoteAction(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
    pair: PersonalSecAnnualPairDto,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.annualNoteProposal(selection, response, pair);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendAnnualToResearchNote(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
    pair: PersonalSecAnnualPairDto,
  ): { appended: boolean; message: string } {
    const proposal = this.annualNoteProposal(selection, response, pair);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason! };
    this.noteResearch(selection, proposal.note);
    return {
      appended: true,
      message:
        "Annual evidence added to the note draft. Review and save all changes in My Watchlist.",
    };
  }
  private annualCashNoteProposal(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
  ): { note: string | null; reason: string | null } {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        note: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before adding cash generation.",
      };
    const annual = this.annual.getSnapshot();
    if (
      this.state.research?.section !== "annual" ||
      annual.response !== response
    )
      return {
        note: null,
        reason:
          "Choose cash generation from the current Annual report before adding it.",
      };
    if (annual.running)
      return {
        note: null,
        reason: "Wait for the Annual report request to finish or cancel it.",
      };
    const excerpt = annualCashNoteExcerpt(response, annual.showingPrevious);
    if (excerpt === null)
      return {
        note: null,
        reason:
          "Cash generation needs available operating cash flow and PP&E purchases from the same filing and annual period.",
      };
    const current = watchlist.member.note;
    if (current.includes(excerpt))
      return {
        note: null,
        reason:
          "This exact cash-generation reference is already in the note draft.",
      };
    const note = current + (current ? " " : "") + excerpt;
    if (normalizeWatchlistNote(note) === null)
      return {
        note: null,
        reason:
          "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      };
    return { note, reason: null };
  }
  getAnnualCashNoteAction(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.annualCashNoteProposal(selection, response);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendAnnualCashToResearchNote(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
  ): { appended: boolean; message: string } {
    const proposal = this.annualCashNoteProposal(selection, response);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason! };
    this.noteResearch(selection, proposal.note);
    return {
      appended: true,
      message:
        "Cash generation added to the note draft. Review and save all changes in My Watchlist.",
    };
  }
  private annualLiquidityNoteProposal(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
  ): { note: string | null; reason: string | null } {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        note: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before adding liquidity.",
      };
    const annual = this.annual.getSnapshot();
    if (
      this.state.research?.section !== "annual" ||
      annual.response !== response
    )
      return {
        note: null,
        reason:
          "Choose liquidity from the current Annual report before adding it.",
      };
    if (annual.running)
      return {
        note: null,
        reason: "Wait for the Annual report request to finish or cancel it.",
      };
    const excerpt = annualLiquidityNoteExcerpt(
      response,
      annual.showingPrevious,
    );
    if (excerpt === null)
      return {
        note: null,
        reason:
          "Liquidity needs available nonnegative current assets and liabilities from the same filing and balance date.",
      };
    const current = watchlist.member.note;
    if (current.includes(excerpt))
      return {
        note: null,
        reason: "This exact liquidity reference is already in the note draft.",
      };
    const note = current + (current ? " " : "") + excerpt;
    if (normalizeWatchlistNote(note) === null)
      return {
        note: null,
        reason:
          "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      };
    return { note, reason: null };
  }
  getAnnualLiquidityNoteAction(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.annualLiquidityNoteProposal(selection, response);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendAnnualLiquidityToResearchNote(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
  ): { appended: boolean; message: string } {
    const proposal = this.annualLiquidityNoteProposal(selection, response);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason! };
    this.noteResearch(selection, proposal.note);
    return {
      appended: true,
      message:
        "Liquidity added to the note draft. Review and save all changes in My Watchlist.",
    };
  }
  private annualOperatingNoteProposal(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
    basis: PersonalSecAnnualOperatingMarginDto,
  ): { note: string | null; reason: string | null } {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        note: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before adding operating results.",
      };
    const annual = this.annual.getSnapshot();
    if (
      this.state.research?.section !== "annual" ||
      annual.response !== response ||
      annual.view === null ||
      annual.view.canonical !== response.evidence ||
      !annual.view.operatingResults.resolution.margins.includes(basis)
    )
      return {
        note: null,
        reason:
          "Choose operating results from the current Annual report before adding it.",
      };
    if (annual.running)
      return {
        note: null,
        reason: "Wait for the Annual report request to finish or cancel it.",
      };
    const excerpt = annualOperatingNoteExcerpt(
      response,
      basis,
      annual.showingPrevious,
    );
    if (excerpt === null)
      return {
        note: null,
        reason:
          "Operating results need admitted operating income and positive revenue from the same filing and exact annual period.",
      };
    const current = watchlist.member.note;
    if (current.includes(excerpt))
      return {
        note: null,
        reason:
          "This exact operating results reference is already in the note draft.",
      };
    const note = current + (current ? " " : "") + excerpt;
    if (normalizeWatchlistNote(note) === null)
      return {
        note: null,
        reason:
          "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      };
    return { note, reason: null };
  }
  getAnnualOperatingNoteAction(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
    basis: PersonalSecAnnualOperatingMarginDto,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.annualOperatingNoteProposal(
      selection,
      response,
      basis,
    );
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendAnnualOperatingToResearchNote(
    selection: ManagedResearchSelection,
    response: PersonalSecAnnualCanonicalResponseDto,
    basis: PersonalSecAnnualOperatingMarginDto,
  ): { appended: boolean; message: string } {
    const proposal = this.annualOperatingNoteProposal(
      selection,
      response,
      basis,
    );
    if (proposal.note === null)
      return { appended: false, message: proposal.reason! };
    this.noteResearch(selection, proposal.note);
    return {
      appended: true,
      message:
        "Operating results added to the note draft. Review and save all changes in My Watchlist.",
    };
  }
  private priceNoteProposal(
    selection: ManagedResearchSelection,
    response: ManagedEodHistoryResponseDto,
    start: ManagedEodCloseDto,
    end: ManagedEodCloseDto,
  ): { note: string | null; reason: string | null } {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        note: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before adding a price comparison.",
      };
    const eod = this.eod.getSnapshot();
    if (this.state.research?.section !== "eod" || eod.response !== response)
      return {
        note: null,
        reason:
          "Choose a comparison from the current Price history before adding it.",
      };
    if (eod.running)
      return {
        note: null,
        reason: "Wait for the close history request to finish or cancel it.",
      };
    const excerpt = priceComparisonNoteExcerpt(
      response,
      start,
      end,
      eod.showingPrevious,
    );
    if (excerpt === null)
      return {
        note: null,
        reason:
          "Choose two observed dates in increasing order from the loaded close history.",
      };
    const note =
      watchlist.member.note + (watchlist.member.note ? " " : "") + excerpt;
    if (normalizeWatchlistNote(note) === null)
      return {
        note: null,
        reason:
          "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      };
    return { note, reason: null };
  }
  getPriceNoteAction(
    selection: ManagedResearchSelection,
    response: ManagedEodHistoryResponseDto,
    start: ManagedEodCloseDto,
    end: ManagedEodCloseDto,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.priceNoteProposal(selection, response, start, end);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendPriceComparisonToResearchNote(
    selection: ManagedResearchSelection,
    response: ManagedEodHistoryResponseDto,
    start: ManagedEodCloseDto,
    end: ManagedEodCloseDto,
  ): { appended: boolean; message: string } {
    const proposal = this.priceNoteProposal(selection, response, start, end);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason! };
    this.noteResearch(selection, proposal.note);
    return {
      appended: true,
      message:
        "Price comparison added to the note draft. Review and save all changes in My Watchlist.",
    };
  }
  private watchlistComparisonNoteProposal(
    selection: ManagedWatchlistComparisonSelection,
    destination: ManagedEodIdentity | null,
  ):
    | { note: string; member: WatchlistMembership; reason: null }
    | { note: null; member: null; reason: string } {
    const draft = this.coordinator.getSnapshot().draft;
    const prices = this.watchlistPrices.getSnapshot();
    if (
      !this.canEdit() ||
      !draft ||
      this.state.view !== "watchlist" ||
      this.state.research ||
      this.state.companyRoute ||
      !prices.canRead ||
      this.state.snapshot?.snapshotSha256 !== draft.snapshotSha256
    )
      return {
        note: null,
        member: null,
        reason:
          "Return to an editable watchlist before adding comparison evidence.",
      };
    const evidence = getManagedWatchlistComparisonNoteEvidence(
      selection,
      prices,
    );
    if (evidence.excerpt === null)
      return { note: null, member: null, reason: evidence.reason! };
    const member = destination
      ? draft.memberships.find((item) =>
          membershipMatchesResult(item, destination),
        )
      : null;
    const paired =
      destination &&
      [selection.left, selection.right].some(
        (source) =>
          source &&
          membershipMatchesResult({ ...destination, note: "" }, source.listing),
      );
    if (!member || !paired)
      return {
        note: null,
        member: null,
        reason: "Choose one of these two listings as the note destination.",
      };
    const note = member.note + (member.note ? " " : "") + evidence.excerpt;
    if (normalizeWatchlistNote(note) === null)
      return {
        note: null,
        member: null,
        reason:
          "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      };
    return { note, member, reason: null };
  }
  getWatchlistComparisonNoteAction(
    selection: ManagedWatchlistComparisonSelection,
    destination: ManagedEodIdentity | null,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.watchlistComparisonNoteProposal(
      selection,
      destination,
    );
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendWatchlistComparisonToNote(
    selection: ManagedWatchlistComparisonSelection,
    destination: ManagedEodIdentity | null,
  ): { appended: boolean; message: string } {
    const proposal = this.watchlistComparisonNoteProposal(
      selection,
      destination,
    );
    if (proposal.note === null)
      return { appended: false, message: proposal.reason };
    this.note(proposal.member.listingId, proposal.note);
    return {
      appended: true,
      message: `Comparison added to the ${proposal.member.symbol} (${proposal.member.shareClassName}, ${proposal.member.exchangeMic}) note draft. Review and save all changes in My Watchlist.`,
    };
  }
  private annualComparisonNoteProposal(
    capture: AnnualComparisonNoteCapture,
    destination: ManagedWatchlistAnnualComparisonMember | null,
  ):
    | { note: string; member: WatchlistMembership; reason: null }
    | { note: null; member: null; reason: string } {
    const draft = this.coordinator.getSnapshot().draft;
    const comparison = this.annualComparison.getSnapshot();
    const refuse = (reason: string) => ({ note: null, member: null, reason });
    if (
      !this.canEdit() ||
      !draft ||
      this.state.view !== "watchlist" ||
      this.state.research ||
      this.state.companyRoute ||
      !comparison.active ||
      !comparison.canRead ||
      comparison.catalogChanged ||
      this.state.snapshot?.snapshotSha256 !== draft.snapshotSha256
    )
      return refuse(
        "Return to an editable watchlist before adding Annual comparison evidence.",
      );
    if (comparison.pending)
      return refuse(
        "Wait for the Annual comparison request to finish or cancel it.",
      );
    for (const side of ["left", "right"] as const) {
      const current = comparison[side];
      const observed = capture[side];
      if (
        current.selected !== observed.member ||
        current.report.response !== observed.response ||
        current.report.showingPrevious !== observed.showingPrevious ||
        current.report.running ||
        observed.response.catalogSnapshotSha256 !== draft.snapshotSha256
      )
        return refuse(
          "Choose evidence from the current Annual comparison before adding it.",
        );
    }
    if (
      !destination ||
      ![capture.left.member, capture.right.member].includes(destination)
    )
      return refuse(
        "Choose one of these two listings as the note destination.",
      );
    const member = draft.memberships.find((item) =>
      membershipMatchesResult(item, destination.listing),
    );
    if (!member)
      return refuse(
        "Choose one of these two listings as the note destination.",
      );
    const evidence = getAnnualComparisonNoteEvidence(capture);
    if (evidence.excerpt === null) return refuse(evidence.reason!);
    if (member.note.includes(evidence.excerpt))
      return refuse(
        "This exact Annual comparison reference is already in the note draft.",
      );
    const note = member.note + (member.note ? " " : "") + evidence.excerpt;
    if (normalizeWatchlistNote(note) === null)
      return refuse(
        "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      );
    return { note, member, reason: null };
  }
  getAnnualComparisonNoteAction(
    capture: AnnualComparisonNoteCapture,
    destination: ManagedWatchlistAnnualComparisonMember | null,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.annualComparisonNoteProposal(capture, destination);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendAnnualComparisonToNote(
    capture: AnnualComparisonNoteCapture,
    destination: ManagedWatchlistAnnualComparisonMember | null,
  ): { appended: boolean; message: string } {
    const proposal = this.annualComparisonNoteProposal(capture, destination);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason };
    this.note(proposal.member.listingId, proposal.note);
    return {
      appended: true,
      message: `Annual comparison added to the ${proposal.member.symbol} (${proposal.member.shareClassName}, ${proposal.member.exchangeMic}) note draft. Review and save all changes in My Watchlist.`,
    };
  }
  private screenComparisonFollowupRouteReady() {
    return (
      this.screenComparisonFollowupAccessReady() &&
      this.state.view === "discover" &&
      this.state.snapshot !== null &&
      !this.state.research &&
      !this.state.companyRoute &&
      this.sourceFollowupCatalogIdle()
    );
  }
  private screenComparisonFollowupAccessReady() {
    return (
      !this.retired &&
      !this.navigationBlocked &&
      this.canNavigate() &&
      this.sessionOwner.getSnapshot().phase === "active"
    );
  }
  private isDatedFollowupReviewOrigin() {
    return this.state.view === "markets" || this.state.view === "discover";
  }
  private sourceFollowupCatalogIdle() {
    return (
      !this.state.read &&
      !this.state.reviewing &&
      !this.state.review &&
      !this.fileCatalogReviewRequired
    );
  }
  private calendarFollowupRouteReady() {
    return (
      this.marketsReviewAvailable() &&
      this.canNavigate() &&
      this.sessionOwner.getSnapshot().phase === "active" &&
      this.state.snapshot !== null &&
      this.sourceFollowupCatalogIdle()
    );
  }
  private calendarFollowupWatchlistReady(
    saved: ReturnType<ManagedWorkspace["coordinator"]["getSnapshot"]>,
  ) {
    return saved.phase === "idle" && !saved.uncertain && !saved.replayPending;
  }
  private calendarFollowupMemberReady(member: WatchlistMembership) {
    if (!this.calendarFollowupRouteReady() || !this.canEdit()) return false;
    const saved = this.coordinator.getSnapshot();
    if (!this.calendarFollowupWatchlistReady(saved)) return false;
    const digest = this.currentWatchlistCatalogDigest();
    return (
      digest !== null &&
      saved.draft?.snapshotSha256 === digest &&
      saved.draft.memberships.includes(member)
    );
  }
  captureCpiHeadlineSource(key: string, selectionIsCurrent: () => boolean) {
    return this.cpiFollowupContext.capture(key, selectionIsCurrent);
  }
  private datedSourceContext(capture: CalendarSourceCapture) {
    return capture.source.kind === "cpi"
      ? this.cpiFollowupContext
      : this.calendarFollowupContext;
  }
  captureMarketsCalendarSource(key: string, selectionIsCurrent: () => boolean) {
    return this.calendarFollowupContext.capture(key, selectionIsCurrent);
  }
  captureMarketsCalendarFollowup(
    capture: CalendarSourceCapture,
    member: WatchlistMembership,
  ) {
    return this.datedSourceContext(capture).capturePort(capture, member);
  }
  canLoadMarketsCalendarFollowups(
    capture: CalendarSourceCapture,
    member: WatchlistMembership,
  ) {
    return this.datedSourceContext(capture).canLoad(capture, member);
  }
  loadMarketsCalendarFollowups(
    capture: CalendarSourceCapture,
    member: WatchlistMembership,
    formIsCurrent: () => boolean,
  ) {
    return this.datedSourceContext(capture).load(
      capture,
      member,
      formIsCurrent,
    );
  }
  private filingsFollowupSourceIsCurrent(
    selection: ManagedResearchSelection,
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ): boolean {
    const visit = this.state.research;
    if (visit?.selection !== selection) return false;
    if (visit.section !== "filings") return false;
    const source = this.filings.getSnapshot();
    if (source.response !== response) return false;
    if (source.running) return false;
    if (source.catalogChanged) return false;
    if (response.issuer.status !== "available") return false;
    return response.issuer.filings.includes(filing);
  }
  private filingsFollowupHost(
    selection: ManagedResearchSelection,
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ) {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        member: null,
        reason:
          watchlist.reason ??
          "Use this exact company in an editable My Watchlist draft first.",
        isCurrent: () => false,
      };
    if (!this.filingsFollowupSourceIsCurrent(selection, response, filing))
      return {
        member: null,
        reason: "Choose a filing from the current, settled Filings response.",
        isCurrent: () => false,
      };
    return {
      member: watchlist.member,
      reason: null,
      isCurrent: this.filingsFollowupLifetime(watchlist.member, selection),
    };
  }
  private filingsFollowupLifetime(
    member: WatchlistMembership,
    selection: ManagedResearchSelection,
  ) {
    const visit = this.state.research;
    const source = this.filings.getSnapshot();
    const host = this.thesisFollowupContext(member, selection);
    const operation = this.researchOperation;
    return () =>
      host.isCurrent() &&
      this.state.research === visit &&
      this.researchOperation === operation &&
      this.filings.getSnapshot() === source &&
      this.researchSourceRouteReady(selection) &&
      this.canUseResearchSource(selection);
  }
  captureFilingsFollowup(
    selection: ManagedResearchSelection,
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ): { port: FilingsFollowupPort | null; reason: string | null } {
    const host = this.filingsFollowupHost(selection, response, filing);
    if (!host.member || !host.isCurrent())
      return {
        port: null,
        reason:
          host.reason ??
          "Return to the current filing before preparing a question.",
      };
    const watchlistSaved = this.coordinator.getSnapshot();
    const followupsSaved = this.followups.coordinator.getSnapshot();
    let retired = false;
    const isCurrent = () => {
      retired ||=
        !host.isCurrent() ||
        this.coordinator.getSnapshot() !== watchlistSaved ||
        this.followups.coordinator.getSnapshot() !== followupsSaved;
      return !retired;
    };
    return {
      port: Object.freeze({
        model: this.followups,
        member: host.member,
        response,
        filing,
        showingPrevious: this.filings.getSnapshot().showingPrevious,
        isCurrent,
      }),
      reason: null,
    };
  }
  canLoadFilingsFollowups(
    selection: ManagedResearchSelection,
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ): boolean {
    const host = this.filingsFollowupHost(selection, response, filing);
    return (
      host.member !== null &&
      host.isCurrent() &&
      this.followups.canLoadForNextCheck(host.member)
    );
  }
  async loadFilingsFollowups(
    selection: ManagedResearchSelection,
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
    formIsCurrent: () => boolean,
  ): Promise<void> {
    const host = this.filingsFollowupHost(selection, response, filing);
    const watchlistSaved = this.coordinator.getSnapshot();
    if (!host.member) return;
    await this.followups.loadForNextCheck(
      host.member,
      () =>
        host.isCurrent() &&
        formIsCurrent() &&
        this.coordinator.getSnapshot() === watchlistSaved,
    );
  }
  private filingsNoteProposal(
    selection: ManagedResearchSelection,
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ): { note: string | null; reason: string | null } {
    const watchlist = this.getResearchWatchlist(selection);
    if (!watchlist.canEdit || !watchlist.member)
      return {
        note: null,
        reason:
          watchlist.reason ??
          "Add this company to the watchlist draft before adding a filing reference.",
      };
    const filings = this.filings.getSnapshot();
    if (
      this.state.research?.section !== "filings" ||
      filings.response !== response
    )
      return {
        note: null,
        reason:
          "Choose a filing from the current Filings result before adding it.",
      };
    if (filings.running)
      return {
        note: null,
        reason: "Wait for the filings request to finish or cancel it.",
      };
    const excerpt = filingReferenceNoteExcerpt(
      response,
      filing,
      filings.showingPrevious,
    );
    if (excerpt === null)
      return {
        note: null,
        reason: "Choose a filing from the observed Filings result.",
      };
    const current = watchlist.member.note;
    if (current.includes(excerpt))
      return {
        note: null,
        reason: "This exact filing reference is already in the note draft.",
      };
    const note = current + (current ? " " : "") + excerpt;
    if (normalizeWatchlistNote(note) === null)
      return {
        note: null,
        reason:
          "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      };
    return { note, reason: null };
  }
  getFilingsNoteAction(
    selection: ManagedResearchSelection,
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.filingsNoteProposal(selection, response, filing);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendFilingReferenceToResearchNote(
    selection: ManagedResearchSelection,
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ): { appended: boolean; message: string } {
    const proposal = this.filingsNoteProposal(selection, response, filing);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason! };
    this.noteResearch(selection, proposal.note);
    return {
      appended: true,
      message:
        "Filing reference added to the note draft. Review and save all changes in My Watchlist.",
    };
  }
  private marketsNoteDraft(): MainWatchlistPayload | null {
    const draft = this.coordinator.getSnapshot().draft;
    return this.canEdit() &&
      !this.navigationBlocked &&
      this.state.view === "markets" &&
      !this.state.research &&
      !this.state.companyRoute &&
      this.state.snapshot !== null &&
      draft?.snapshotSha256 === this.state.snapshot.snapshotSha256
      ? draft
      : null;
  }
  private fedAnnouncementNoteProposal(
    capture: FedAnnouncementNoteCapture | null,
    destination: WatchlistMembership | null,
  ):
    | { note: string; member: WatchlistMembership; reason: null }
    | { note: null; member: null; reason: string } {
    const refuse = (reason: string) => ({ note: null, member: null, reason });
    const draft = this.marketsNoteDraft();
    if (!draft)
      return refuse(
        "Return to Markets with an editable current watchlist before adding an announcement.",
      );
    const current = this.announcements.getSnapshot();
    if (current.busy)
      return refuse(
        "Wait for the announcements request to finish or cancel it.",
      );
    if (!capture) return refuse("Choose a loaded announcement.");
    if (
      current.announcements !== capture.response ||
      current.showingPrevious !== capture.showingPrevious
    )
      return refuse("Choose an announcement from the current loaded feed.");
    const evidence = getFedAnnouncementNoteEvidence(capture);
    if (evidence.excerpt === null) return refuse(evidence.reason);
    if (!destination || !draft.memberships.includes(destination))
      return refuse("Choose a current watchlist note.");
    if (
      destination.note
        .normalize("NFC")
        .includes(evidence.excerpt.normalize("NFC"))
    )
      return refuse(
        "This exact announcement reference is already in the note draft.",
      );
    const note =
      destination.note + (destination.note ? " " : "") + evidence.excerpt;
    if (normalizeWatchlistNote(note) === null)
      return refuse(
        "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      );
    return { note, member: destination, reason: null };
  }
  getFedAnnouncementNoteAction(
    capture: FedAnnouncementNoteCapture | null,
    destination: WatchlistMembership | null,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.fedAnnouncementNoteProposal(capture, destination);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendFedAnnouncementToNote(
    capture: FedAnnouncementNoteCapture | null,
    destination: WatchlistMembership | null,
  ): { appended: boolean; message: string } {
    const proposal = this.fedAnnouncementNoteProposal(capture, destination);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason };
    this.note(proposal.member.listingId, proposal.note);
    return {
      appended: true,
      message: `Announcement reference added to the ${proposal.member.symbol} (${proposal.member.shareClassName}, ${proposal.member.exchangeMic}) note draft. Review and save all changes in My Watchlist.`,
    };
  }
  private beaReleaseNoteProposal(
    capture: BeaReleaseNoteCapture | null,
    destination: WatchlistMembership | null,
  ):
    | { note: string; member: WatchlistMembership; reason: null }
    | { note: null; member: null; reason: string } {
    const refuse = (reason: string) => ({ note: null, member: null, reason });
    const draft = this.marketsNoteDraft();
    if (!draft)
      return refuse(
        "Return to Markets with an editable current watchlist before adding a release.",
      );
    const current = this.agenda.getSnapshot();
    if (current.busy)
      return refuse("Wait for the agenda request to finish or cancel it.");
    if (!capture) return refuse("Choose a loaded release.");
    if (
      current.agenda !== capture.response ||
      current.showingPrevious !== capture.showingPrevious
    )
      return refuse("Choose a release from the current loaded agenda.");
    const evidence = getBeaReleaseNoteEvidence(capture);
    if (evidence.excerpt === null) return refuse(evidence.reason);
    if (!destination || !draft.memberships.includes(destination))
      return refuse("Choose a current watchlist note.");
    if (
      destination.note
        .normalize("NFC")
        .includes(evidence.excerpt.normalize("NFC"))
    )
      return refuse(
        "This exact release reference is already in the note draft.",
      );
    const note =
      destination.note + (destination.note ? " " : "") + evidence.excerpt;
    if (normalizeWatchlistNote(note) === null)
      return refuse(
        "The complete note must fit within 2,000 characters without control characters. Edit it before adding evidence.",
      );
    return { note, member: destination, reason: null };
  }
  getBeaReleaseNoteAction(
    capture: BeaReleaseNoteCapture | null,
    destination: WatchlistMembership | null,
  ): { canAppend: boolean; reason: string | null } {
    const proposal = this.beaReleaseNoteProposal(capture, destination);
    return { canAppend: proposal.note !== null, reason: proposal.reason };
  }
  appendBeaReleaseToNote(
    capture: BeaReleaseNoteCapture | null,
    destination: WatchlistMembership | null,
  ): { appended: boolean; message: string } {
    const proposal = this.beaReleaseNoteProposal(capture, destination);
    if (proposal.note === null)
      return { appended: false, message: proposal.reason };
    this.note(proposal.member.listingId, proposal.note);
    return {
      appended: true,
      message: `Release reference added to the ${proposal.member.symbol} (${proposal.member.shareClassName}, ${proposal.member.exchangeMic}) note draft. Review and save all changes in My Watchlist.`,
    };
  }
  private currentWatchlistCatalogDigest() {
    if (this.fileCatalogReviewRequired) return null;
    return this.state.snapshot?.snapshotSha256 ?? null;
  }
  watchlistFileCatalogReviewRequired() {
    return this.fileCatalogReviewRequired;
  }
  private researchDraftSetRouteReady() {
    if (this.followupsNavigationDepth > 0) return false;
    if (!this.navigationBlocked) return true;
    const visit = this.state.research;
    const route = this.state.companyRoute;
    return (
      visit !== null &&
      route?.status === "open" &&
      route.listingId === visit.selection.listing.listingId &&
      route.section === visit.section &&
      visit.selection.catalogSnapshotSha256 ===
        this.state.snapshot?.snapshotSha256
    );
  }
  getResearchDraftSetRoute() {
    return {
      navigation: this.navigationRevision,
      view: this.viewRevision,
      research: this.state.research,
      companyRoute: this.state.companyRoute,
      blocked: !this.researchDraftSetRouteReady(),
    };
  }
  hasWatchlistDraftFileActivity(owner?: object) {
    return [...this.watchlistFileActivities].some((active) => active !== owner);
  }
  getWatchlistDraftFileActivityRevision() {
    return this.watchlistFileRevision;
  }
  beginWatchlistDraftFileActivity(owner: object) {
    if (this.retired || this.watchlistFileActivities.has(owner)) return;
    this.watchlistFileActivities.add(owner);
    this.watchlistFileRevision = {};
    this.update({});
  }
  endWatchlistDraftFileActivity(owner: object) {
    if (!this.watchlistFileActivities.delete(owner)) return;
    this.watchlistFileRevision = {};
    this.update({});
  }
  getWatchlistResourceDraftContext(
    owner?: object,
  ): WatchlistDraftFileContext | null {
    if (
      !this.canEdit() ||
      !this.researchDraftSetRouteReady() ||
      this.hasWatchlistDraftFileActivity(owner)
    )
      return null;
    if (this.sessionOwner.getSnapshot().phase !== "active") return null;
    const context = captureWatchlistResourceDraftContext(
      this.coordinator.getSnapshot(),
      this.state,
      true,
    );
    if (context) this.watchlistFileContexts.add(context);
    return context;
  }
  restoreWatchlistResourceDraft(
    captured: WatchlistDraftFileContext,
    payload: MainWatchlistPayload,
    owner: object,
  ) {
    if (
      !this.watchlistFileContexts.has(captured) ||
      !this.watchlistFileActivities.has(owner)
    )
      return false;
    const current = this.getWatchlistResourceDraftContext(owner);
    if (
      !current ||
      current.saved !== captured.saved ||
      current.draft !== captured.draft ||
      current.baseVersion !== captured.baseVersion ||
      current.catalog !== captured.catalog
    )
      return false;
    this.watchlistFileContexts.delete(captured);
    this.fileCatalogReviewRequired = true;
    this.validation = null;
    const installed = this.coordinator.replaceDraft(payload);
    this.update({});
    return (
      !this.retired &&
      installed !== null &&
      this.coordinator.getSnapshot().draft === installed
    );
  }
  getWatchlistDraftFileContext(
    requireFresh = true,
  ): WatchlistDraftFileContext | null {
    if (!this.canEdit()) return null;
    if (this.navigationBlocked) return null;
    if (this.sessionOwner.getSnapshot().phase !== "active") return null;
    return captureWatchlistDraftFileContext(
      this.coordinator.getSnapshot(),
      this.state,
      requireFresh,
    );
  }
  restoreWatchlistFileDraft(payload: MainWatchlistPayload) {
    if (!this.getWatchlistDraftFileContext()) return false;
    this.fileCatalogReviewRequired = true;
    this.validation = null;
    this.coordinator.replaceDraft(payload);
    this.update({});
    return true;
  }
  private validateDraft(draft: MainWatchlistPayload): DraftValidation {
    if (this.fileCatalogReviewRequired)
      return {
        payload: null,
        issue:
          "Review imported file listings against the current catalog before saving.",
      };
    const digest = this.state.snapshot?.snapshotSha256 ?? null;
    if (this.validation?.draft === draft && this.validation.digest === digest)
      return this.validation.result;
    const result =
      digest === null
        ? { payload: null, issue: "Load the catalog before saving." }
        : digest !== draft.snapshotSha256
          ? { payload: null, issue: "Review catalog changes before saving." }
          : capture(draft);
    this.validation = { draft, digest, result };
    return result;
  }
  canSavePayload() {
    const draft = this.coordinator.getSnapshot().draft;
    return draft !== null && this.validateDraft(draft).payload !== null;
  }
  saveIssue() {
    const draft = this.coordinator.getSnapshot().draft;
    return draft === null ? null : this.validateDraft(draft).issue;
  }
  private edit(memberships: readonly WatchlistMembership[]) {
    const draft = this.coordinator.getSnapshot().draft;
    if (!this.canEdit() || !draft) return;
    this.coordinator.replaceDraft({ ...draft, memberships });
  }
  add(result: PersonalSecurityMasterSearchResultDto) {
    const draft = this.coordinator.getSnapshot().draft;
    if (
      !this.canEdit() ||
      !draft ||
      !this.state.results.includes(result) ||
      this.state.snapshot?.snapshotSha256 !== draft.snapshotSha256 ||
      draft.memberships.length >= 10_000 ||
      draft.memberships.some((member) => member.listingId === result.listingId)
    )
      return;
    this.edit([...draft.memberships, listingMembership(result)]);
  }
  note(listingId: string, note: string, expectedNote?: string) {
    const draft = this.coordinator.getSnapshot().draft;
    if (
      expectedNote !== undefined &&
      draft?.memberships.find((member) => member.listingId === listingId)
        ?.note !== expectedNote
    )
      return;
    if (draft)
      this.edit(
        draft.memberships.map((member) =>
          member.listingId === listingId ? { ...member, note } : member,
        ),
      );
  }
  remove(listingId: string) {
    const draft = this.coordinator.getSnapshot().draft;
    if (draft)
      this.edit(
        draft.memberships.filter((member) => member.listingId !== listingId),
      );
  }
  move(listingId: string, direction: -1 | 1) {
    const draft = this.coordinator.getSnapshot().draft;
    if (!draft) return;
    const members = [...draft.memberships];
    const index = members.findIndex((member) => member.listingId === listingId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= members.length) return;
    [members[index], members[target]] = [members[target]!, members[index]!];
    this.edit(members);
  }
  async reviewCatalog() {
    const draft = this.coordinator.getSnapshot().draft;
    const snapshot = this.state.snapshot;
    if (!this.canEdit() || !draft || !snapshot || this.resolveOperation) return;
    this.update({
      review: { draft, snapshotSha256: snapshot.snapshotSha256, results: [] },
      message: "",
    });
    await this.nextReviewBatch();
  }
  async nextReviewBatch() {
    const review = this.state.review;
    if (
      !this.canEdit() ||
      !review ||
      this.resolveOperation ||
      this.coordinator.getSnapshot().draft !== review.draft
    )
      return;
    const listingIds = review.draft.memberships
      .slice(
        review.results.length,
        review.results.length + MANAGED_CATALOG_RESOLVE_LIMITS.listingIds,
      )
      .map((member) => member.listingId);
    if (!listingIds.length) return;
    const operation = new AbortController();
    this.resolveOperation = operation;
    this.update({ reviewing: true });
    try {
      const result = await this.api.resolve(
        { snapshotSha256: review.snapshotSha256, listingIds },
        operation.signal,
      );
      if (
        this.retired ||
        this.resolveOperation !== operation ||
        this.state.review !== review ||
        this.coordinator.getSnapshot().draft !== review.draft ||
        operation.signal.aborted
      )
        return;
      this.update({
        review: { ...review, results: [...review.results, ...result.results] },
      });
    } catch (error) {
      if (
        !this.retired &&
        this.resolveOperation === operation &&
        !operation.signal.aborted
      ) {
        this.update({ review: null });
        this.catalogError(error, "review");
      }
    } finally {
      if (this.resolveOperation === operation) {
        this.resolveOperation = null;
        this.update({ reviewing: false });
      }
    }
  }
  applyReview() {
    const review = this.state.review;
    if (
      !this.canEdit() ||
      this.resolveOperation ||
      !review ||
      this.coordinator.getSnapshot().draft !== review.draft ||
      review.results.length !== review.draft.memberships.length ||
      review.snapshotSha256 !== this.state.snapshot?.snapshotSha256
    )
      return;
    const memberships = review.results.flatMap((result, index) =>
      result.listing
        ? [{ ...result.listing, note: review.draft.memberships[index]!.note }]
        : [],
    );
    this.fileCatalogReviewRequired = false;
    this.validation = null;
    this.coordinator.replaceDraft({
      ...review.draft,
      snapshotSha256: review.snapshotSha256,
      memberships,
    });
    this.update({
      review: null,
      message: "Catalog changes applied.",
    });
  }
}

export function reviewChanges(review: CatalogReview) {
  return review.results.flatMap((result, index) => {
    const previous = review.draft.memberships[index]!;
    return result.listing && membershipMatchesResult(previous, result.listing)
      ? []
      : [{ previous, listing: result.listing }];
  });
}
