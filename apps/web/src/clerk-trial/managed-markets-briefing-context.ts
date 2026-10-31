import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { CalendarSourceCapture } from "./managed-calendar-followup";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedCompanyRoute } from "./managed-company-route";
import type {
  ManagedWorkspace,
  FollowupReview,
  PreparedFollowupResearch,
} from "./managed-workspace";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import {
  sameMarketsBriefingEntry,
  type ManagedMarketsBriefingReading,
  type ManagedMarketsBriefingSelection,
} from "./managed-markets-briefing";

interface Host {
  readonly workspace: ManagedWorkspace;
  readonly available: () => boolean;
  readonly retired: () => boolean;
  readonly blocked: () => boolean;
  readonly researchOwner: () => { readonly id: string } | null;
  readonly publish: () => void;
}

/** One owned briefing/check round trip. It retains evidence, never live source authority. */
export class ManagedMarketsBriefingContext {
  private readonly briefingSources = new WeakSet<CalendarSourceCapture>();
  private briefing: {
    readonly reading: ManagedMarketsBriefingReading;
    readonly current: () => boolean;
    returned: boolean;
    backPending: boolean;
    research: ManagedResearchSelection | null;
  } | null = null;
  private passive = false;
  private briefingTransition: "followups" | "markets" | null = null;
  private briefingTransitionUsed = false;

  constructor(private readonly host: Host) {
    const reconcile = () => this.reconcile(true);
    const w = host.workspace;
    for (const source of [
      w.markets,
      w.blsCalendar,
      w.agenda,
      w.announcements,
      w.cpiHeadlines,
      w.followups,
      w.coordinator,
      w.sessionOwner,
    ])
      source.subscribe(reconcile);
  }
  get returned() {
    return this.passive;
  }
  clear() {
    this.briefing = null;
  }
  reconcile(publish = false) {
    if (this.briefing && !this.briefing.current()) {
      this.clear();
      if (publish) this.host.publish();
    }
  }
  register(capture: CalendarSourceCapture) {
    this.briefingSources.add(capture);
  }
  navigation(blocked: boolean) {
    if (
      blocked &&
      this.briefing &&
      !this.briefingTransition &&
      !this.briefing.research &&
      !this.briefing.backPending
    )
      this.clear();
  }
  beforeView(view: ReturnType<ManagedWorkspace["getSnapshot"]>["view"]) {
    const wasReturned = this.returned === true;
    const owned =
      this.briefingTransition === view && !this.briefingTransitionUsed;
    if (owned) this.briefingTransitionUsed = true;
    else {
      this.clear();
      this.passive = false;
    }
    return { wasReturned, owned };
  }
  companyRoute(route: ManagedCompanyRoute | null) {
    if (
      route &&
      this.briefing &&
      (!this.briefing.research ||
        route.listingId !== this.briefing.research.listing.listingId)
    )
      this.clear();
  }
  closeResearch() {
    if (this.briefing?.research) {
      const research = this.host.workspace.getSnapshot().research;
      const owned =
        research !== null &&
        companyEvidenceSelectionMatches(
          research.selection,
          this.briefing.research,
        ) &&
        this.host.researchOwner()?.id === this.briefing.reading.entry.id;
      if (owned) {
        this.briefing.research = null;
        this.briefing.backPending = true;
      } else this.clear();
    }
  }
  prepareResearch(entry: ResearchFollowup) {
    if (
      this.briefing &&
      !sameMarketsBriefingEntry(this.briefing.reading.entry, entry)
    )
      this.clear();
  }
  openResearch(capture: PreparedFollowupResearch) {
    if (this.briefing) {
      if (
        !this.briefing.current() ||
        !sameMarketsBriefingEntry(this.briefing.reading.entry, capture.entry)
      )
        this.clear();
      else {
        this.briefing.research = capture.selection;
        this.briefing.backPending = false;
      }
    }
  }
  /** Read-only retained evidence, never a new source or Create authority. */
  getMarketsBriefingReading(): ManagedMarketsBriefingReading | null {
    return this.briefing?.current() ? this.briefing.reading : null;
  }
  reviewMarketsBriefingFollowup(
    entry: ResearchFollowup,
    capture: CalendarSourceCapture,
    navigate: () => boolean,
    selection?: ManagedMarketsBriefingSelection,
  ): FollowupReview | null {
    if (
      this.briefingTransition ||
      !this.host.available() ||
      !this.briefingSources.has(capture) ||
      !capture.isCurrent()
    )
      return null;
    const catalog = this.host.workspace.getSnapshot().snapshot;
    const watchlist = this.host.workspace.coordinator.getSnapshot().draft;
    const watchlistActivity =
      this.host.workspace.getWatchlistDraftFileActivityRevision();
    const activity =
      this.host.workspace.followups.getDraftFileActivityRevision();
    const scope = this.host.workspace.followups.getReviewContext()?.scope;
    if (
      !scope ||
      this.host.workspace.hasWatchlistDraftFileActivity() ||
      this.host.workspace.followups.hasDraftFileActivity()
    )
      return null;
    const baseCurrent = () =>
      !this.host.retired() &&
      this.host.workspace.sessionOwner.getSnapshot().phase === "active" &&
      this.host.workspace.getSnapshot().snapshot === catalog &&
      this.host.workspace.coordinator.getSnapshot().draft === watchlist &&
      this.host.workspace.coordinator.getSnapshot().phase === "idle" &&
      !this.host.workspace.coordinator.getSnapshot().uncertain &&
      !this.host.workspace.coordinator.getSnapshot().conflict &&
      !this.host.workspace.coordinator.getSnapshot().replayPending &&
      this.host.workspace.getWatchlistDraftFileActivityRevision() ===
        watchlistActivity &&
      this.host.workspace.followups.getDraftFileActivityRevision() ===
        activity &&
      this.host.workspace.followups.getReviewContext()?.scope === scope &&
      sameMarketsBriefingEntry(
        entry,
        this.host.workspace.followups.currentEntry(entry.id),
      );
    const reading: ManagedMarketsBriefingReading = Object.freeze({
      board: this.host.workspace.markets.getSnapshot(),
      pass: this.host.workspace.marketsSourceReview.getSnapshot(),
      bls: this.host.workspace.blsCalendar.getSnapshot(),
      bea: this.host.workspace.agenda.getSnapshot(),
      fed: this.host.workspace.announcements.getSnapshot(),
      cpi: this.host.workspace.cpiHeadlines.getSnapshot(),
      selected: capture.source,
      entry,
      ...(selection ? { selection: Object.freeze({ ...selection }) } : {}),
    });
    if (
      !baseCurrent() ||
      reading.board.running ||
      reading.board.resolving ||
      reading.pass.phase === "running" ||
      reading.cpi.busy ||
      reading.bls.busy ||
      reading.bea.busy ||
      reading.fed.busy
    )
      return null;
    this.briefing = null;
    this.briefingTransition = "followups";
    this.briefingTransitionUsed = false;
    let review: FollowupReview | null;
    try {
      review = this.host.workspace.reviewFollowup(entry, navigate);
    } finally {
      this.briefingTransition = null;
    }
    if (
      !review?.isCurrent() ||
      !this.briefingTransitionUsed ||
      !baseCurrent() ||
      this.host.workspace.blsCalendar.getSnapshot() !== reading.bls ||
      this.host.workspace.agenda.getSnapshot() !== reading.bea ||
      this.host.workspace.announcements.getSnapshot() !== reading.fed ||
      this.host.workspace.cpiHeadlines.getSnapshot() !== reading.cpi
    )
      return null;
    const versions = [
      this.host.workspace.markets.getSnapshot(),
      this.host.workspace.blsCalendar.getSnapshot(),
      this.host.workspace.agenda.getSnapshot(),
      this.host.workspace.announcements.getSnapshot(),
      this.host.workspace.cpiHeadlines.getSnapshot(),
    ];
    const owner = {
      reading,
      returned: false,
      backPending: false,
      research: null as ManagedResearchSelection | null,
      current: (): boolean => {
        const state = this.host.workspace.getSnapshot();
        return (
          baseCurrent() &&
          this.host.workspace.followups.getSnapshot().selectedId === entry.id &&
          (this.host.workspace.getSnapshot().view === "followups" ||
            (owner.returned &&
              this.host.workspace.getSnapshot().view === "markets")) &&
          (!state.research ||
            (owner.research !== null &&
              companyEvidenceSelectionMatches(
                state.research.selection,
                owner.research,
              ) &&
              this.host.researchOwner()?.id === entry.id)) &&
          (!state.companyRoute ||
            state.companyRoute.listingId ===
              owner.research?.listing.listingId) &&
          [
            this.host.workspace.markets.getSnapshot(),
            this.host.workspace.blsCalendar.getSnapshot(),
            this.host.workspace.agenda.getSnapshot(),
            this.host.workspace.announcements.getSnapshot(),
            this.host.workspace.cpiHeadlines.getSnapshot(),
          ].every((value, index) => value === versions[index])
        );
      },
    };
    this.briefing = owner;
    this.host.publish();
    return this.briefing === owner && owner.current() && review.isCurrent()
      ? review
      : null;
  }
  /** The router may consume only the exact Research Back transition. */
  resumeMarketsBriefingFollowup(): boolean {
    const owner = this.briefing;
    if (
      !owner?.backPending ||
      !owner.current() ||
      owner.returned ||
      this.host.workspace.getSnapshot().research ||
      this.host.workspace.getSnapshot().companyRoute ||
      this.host.blocked()
    )
      return false;
    owner.backPending = false;
    this.host.publish();
    return this.briefing === owner && owner.current();
  }
  returnToMarketsBriefing(navigate: () => boolean): boolean {
    const owner = this.briefing;
    if (
      !owner ||
      owner.returned ||
      !owner.current() ||
      this.briefingTransition ||
      this.host.blocked() ||
      this.host.workspace.getSnapshot().research ||
      this.host.workspace.getSnapshot().companyRoute
    )
      return false;
    // Consume the transition before callbacks can attempt a second return.
    owner.returned = true;
    this.passive = true;
    owner.backPending = false;
    this.briefingTransition = "markets";
    this.briefingTransitionUsed = false;
    let navigated: boolean;
    try {
      navigated = navigate();
    } catch (error) {
      this.clear();
      if (this.host.workspace.getSnapshot().view !== "markets")
        this.passive = false;
      this.host.publish();
      throw error;
    } finally {
      this.briefingTransition = null;
    }
    if (
      !navigated ||
      !this.briefingTransitionUsed ||
      this.host.workspace.getSnapshot().view !== "markets" ||
      this.briefing !== owner ||
      !owner.current()
    ) {
      if (this.briefing === owner) this.briefing = null;
      if (this.host.workspace.getSnapshot().view !== "markets")
        this.passive = false;
      this.host.publish();
      return false;
    }
    this.host.publish();
    return this.briefing === owner && owner.current();
  }
}
