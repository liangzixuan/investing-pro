import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import type {
  ManagedWorkspace,
  PreparedFollowupResearch,
} from "./managed-workspace";
import type { ManagedPortfolioCloseReview } from "./managed-portfolio-close-review";
import type { FollowupsReviewState } from "./managed-followups-review-session";
import type { ManagedCompanyRoute } from "./managed-company-route";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  isPreparedPortfolioReviewReport,
  type PreparedPortfolioReviewReport,
} from "./portfolio-review-report";
import { samePortfolioReportData } from "./portfolio-review-report-data";
import {
  prepareManagedPortfolioFollowupsPlan,
  type PortfolioFollowupsPlan,
} from "./managed-portfolio-followups-plan";
import {
  captureHeldDueOwner,
  portfolioHeldDueIssue,
} from "./portfolio-held-due-context";

export interface PortfolioDatedReviewReading {
  readonly report: PreparedPortfolioReviewReport;
  readonly plan: PortfolioFollowupsPlan;
  readonly assessedOn: string;
}
export interface PortfolioDatedReviewState {
  readonly reading: PortfolioDatedReviewReading | null;
  readonly review: FollowupsReviewState | null;
  readonly phase: "absent" | "intake" | "reviewing" | "finished";
  readonly canLoadFollowups: boolean;
  readonly canTransfer: boolean;
  readonly reason: string | null;
}
interface Owner {
  readonly reading: PortfolioDatedReviewReading;
  readonly current: () => boolean;
  readonly draft: object;
  handles: readonly object[] | null;
  research: ManagedResearchSelection | null;
  backPending: boolean;
}

/** Passive dated evidence associated with the existing held-check queue. */
export class ManagedPortfolioDatedReviewContext {
  private owner: Owner | null = null;
  private transition: { used: boolean; valid: boolean } | null = null;
  private starting: Owner | null = null;
  private startingEntries: readonly ResearchFollowup[] = [];
  private reconciling = false;
  private retired = false;
  private transferring = false;
  private viewDepth = 0;
  private readonly listeners = new Set<() => void>();
  private readonly off: (() => void)[];
  private state: PortfolioDatedReviewState;
  constructor(
    private readonly workspace: ManagedWorkspace,
    private readonly ownsPrices: (
      prices: ManagedPortfolioCloseReview,
    ) => boolean,
  ) {
    this.state = this.snapshot();
    this.off = [
      workspace,
      workspace.sessionOwner,
      workspace.portfolio,
      workspace.portfolio.coordinator,
      workspace.followups,
      workspace.followups.coordinator,
      workspace.followupsReview,
    ].map((source) => source.subscribe(this.reconcile));
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private snapshot(): PortfolioDatedReviewState {
    const w = this.workspace;
    const active =
      !this.retired && w.sessionOwner.getSnapshot().phase === "active";
    const route = active && !!w.capturePortfolioWatchlistRoute();
    const saved = w.followups.coordinator.getSnapshot();
    const review = this.owner?.handles ? w.followupsReview.getSnapshot() : null;
    const existing = w.followupsReview.getSnapshot();
    const reason = !route
      ? "Return to Portfolio in an active session."
      : existing.entered && existing.phase !== "finished"
        ? "Finish the current review first."
        : portfolioHeldDueIssue(w);
    return Object.freeze({
      reading: this.owner?.reading ?? null,
      review,
      phase: !this.owner
        ? "absent"
        : !review
          ? "intake"
          : review.phase === "finished"
            ? "finished"
            : "reviewing",
      canLoadFollowups:
        !!route &&
        !w.followups.hasDraftFileActivity() &&
        saved.phase === "idle" &&
        !saved.uncertain &&
        !saved.conflict &&
        !saved.replayPending,
      canTransfer: !!route && !reason,
      reason,
    });
  }
  private publish() {
    this.state = this.snapshot();
    for (const listener of this.listeners) listener();
  }
  private matches(owner: Owner, review: FollowupsReviewState) {
    return (
      !!owner.handles &&
      review.entered &&
      review.chosen.length === owner.handles.length &&
      review.chosen.every((row, index) => row.handle === owner.handles![index])
    );
  }
  private current(owner: Owner) {
    const w = this.workspace,
      review = w.followupsReview.getSnapshot(),
      state = w.getSnapshot();
    return (
      !this.retired &&
      owner.current() &&
      (owner.handles
        ? this.matches(owner, review)
        : this.starting === owner ||
          ((!review.entered || review.phase === "finished") &&
            w.followups.getReviewContext()?.draft === owner.draft)) &&
      (!!this.transition || state.view === "followups") &&
      (!state.research ||
        (!!owner.research &&
          companyEvidenceSelectionMatches(
            state.research.selection,
            owner.research,
          ))) &&
      (!state.companyRoute ||
        state.companyRoute.listingId === owner.research?.listing.listingId)
    );
  }
  clear = () => {
    const old = this.owner;
    this.owner = null;
    this.starting = null;
    this.startingEntries = [];
    if (this.transition) this.transition.valid = false;
    if (old && this.matches(old, this.workspace.followupsReview.getSnapshot()))
      this.workspace.retirePortfolioHeldDueReview(
        this.workspace.followupsReview.getSnapshot(),
      );
    this.publish();
  };
  reconcile = () => {
    if (this.retired || this.reconciling) return;
    this.reconciling = true;
    try {
      const review = this.workspace.followupsReview.getSnapshot();
      if (
        this.owner === this.starting &&
        this.starting &&
        !this.starting.handles &&
        review.entered &&
        review.phase === "reviewing" &&
        review.chosen.length === this.startingEntries.length &&
        review.chosen.every(
          (row, index) => row.entry === this.startingEntries[index],
        )
      )
        this.starting.handles = Object.freeze(
          review.chosen.map((row) => row.handle),
        );
      if (this.owner && !this.current(this.owner)) this.clear();
      else this.publish();
    } finally {
      this.reconciling = false;
    }
  };
  async loadFollowups(captured: PortfolioDatedReviewState) {
    if (captured === this.state && captured.canLoadFollowups)
      await this.workspace.followups.coordinator.load();
  }
  transfer(
    prices: ManagedPortfolioCloseReview,
    navigate: () => boolean,
    preparedAt = new Date().toISOString(),
  ): PortfolioDatedReviewReading | null {
    if (
      this.viewDepth > 0 ||
      this.transferring ||
      this.transition ||
      !this.state.canTransfer ||
      !this.ownsPrices(prices)
    )
      return null;
    this.transferring = true;
    try {
      const w = this.workspace,
        route = w.capturePortfolioWatchlistRoute(),
        capture = prices.captureReport(preparedAt),
        held = captureHeldDueOwner(w);
      const projection = w.portfolio.getProjection(),
        ledger = w.portfolio.coordinator.getSnapshot().draft?.ledger;
      if (
        !route?.() ||
        !capture?.current() ||
        !held.context ||
        !held.current() ||
        !isPreparedPortfolioReviewReport(capture.report) ||
        projection?.status !== "valid" ||
        !samePortfolioReportData(capture.report.ledger, ledger) ||
        !samePortfolioReportData(capture.report.portfolio, projection.portfolio)
      )
        return null;
      const plan = prepareManagedPortfolioFollowupsPlan({
        projection,
        context: held.context,
      });
      if (plan.status !== "ready" || !plan.assessedOn) return null;
      this.clear();
      if (!route() || !capture.current() || !held.current()) return null;
      const reading = Object.freeze({
        report: capture.report,
        plan,
        assessedOn: plan.assessedOn,
      });
      const owner: Owner = {
        reading,
        current: held.current,
        draft: held.context.draft,
        handles: null,
        research: null,
        backPending: false,
      };
      const transition = { used: false, valid: true };
      this.transition = transition;
      let navigated = false;
      try {
        navigated = navigate();
      } finally {
        this.transition = null;
      }
      if (
        !navigated ||
        !transition.used ||
        !transition.valid ||
        !this.current(owner)
      ) {
        this.publish();
        return null;
      }
      this.owner = owner;
      this.publish();
      w.portfolioHeldDueChecks.reconcile();
      return this.owner === owner && this.current(owner) ? reading : null;
    } finally {
      this.transferring = false;
    }
  }
  changeView(
    view: ReturnType<ManagedWorkspace["getSnapshot"]>["view"],
    apply: (owned: boolean) => void,
  ) {
    this.viewDepth++;
    try {
      apply(this.beforeView(view));
    } finally {
      this.viewDepth--;
    }
  }
  private beforeView(
    view: ReturnType<ManagedWorkspace["getSnapshot"]>["view"],
  ): boolean {
    if (
      this.transition?.valid &&
      !this.transition.used &&
      view === "followups"
    ) {
      this.transition.used = true;
      return true;
    }
    this.clear();
    return false;
  }
  navigation(blocked: boolean) {
    if (
      blocked &&
      this.owner &&
      !this.owner.research &&
      !this.owner.backPending &&
      !this.transition
    )
      this.clear();
  }
  companyRoute(route: ManagedCompanyRoute | null) {
    if (
      route &&
      this.owner &&
      route.listingId !== this.owner.research?.listing.listingId
    )
      this.clear();
  }
  prepareResearch(entry: ResearchFollowup) {
    if (
      this.owner &&
      (!this.current(this.owner) ||
        this.workspace.followupsReview.getSnapshot().selected?.entry !== entry)
    )
      this.clear();
  }
  openResearch(capture: PreparedFollowupResearch) {
    const owner = this.owner;
    if (!owner) return;
    if (
      !this.current(owner) ||
      capture.reviewHandle !==
        this.workspace.followupsReview.getSnapshot().selected?.handle
    ) {
      this.clear();
      return;
    }
    owner.research = capture.selection;
    owner.backPending = false;
  }
  closeResearch() {
    const owner = this.owner;
    if (!owner?.research) return;
    const selection = this.workspace.getSnapshot().research?.selection;
    if (
      !selection ||
      !companyEvidenceSelectionMatches(selection, owner.research)
    ) {
      this.clear();
      return;
    }
    owner.research = null;
    owner.backPending = true;
  }
  resumeFollowups() {
    const owner = this.owner;
    if (
      !owner?.backPending ||
      !this.current(owner) ||
      this.workspace.getSnapshot().research ||
      this.workspace.getSnapshot().companyRoute
    )
      return false;
    owner.backPending = false;
    this.publish();
    return this.owner === owner && this.current(owner);
  }
  intakePlan() {
    return this.owner && !this.owner.handles && this.current(this.owner)
      ? this.owner.reading.plan
      : null;
  }
  beginReview(
    plan: PortfolioFollowupsPlan,
    entries: readonly ResearchFollowup[],
  ) {
    const owner = this.owner;
    if (!owner) return () => true;
    if (
      owner.handles &&
      this.current(owner) &&
      this.workspace.followupsReview.getSnapshot().phase === "finished"
    ) {
      this.clear();
      return () => this.owner === null;
    }
    if (owner.handles || owner.reading.plan !== plan || !this.current(owner)) {
      this.clear();
      return () => false;
    }
    this.startingEntries = entries;
    this.starting = owner;
    return () => this.owner === owner && this.current(owner);
  }
  endReview(installed: FollowupsReviewState | null) {
    const owner = this.starting;
    if (!owner) return;
    if (this.owner !== owner || !this.current(owner)) {
      this.clear();
      return;
    }
    if (installed && this.workspace.followupsReview.getSnapshot() === installed)
      owner.handles = Object.freeze(installed.chosen.map((row) => row.handle));
    this.starting = null;
    this.startingEntries = [];
    this.publish();
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.off.forEach((off) => off());
    this.clear();
  }
}
