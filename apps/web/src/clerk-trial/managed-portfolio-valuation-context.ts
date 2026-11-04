import { membershipMatchesResult } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedPortfolioCloseReview } from "./managed-portfolio-close-review";
import type { ManagedResearchCoverage } from "./managed-research-eligibility";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedCompanyRoute } from "./managed-company-route";
import type { PortfolioReviewReportCapture } from "./portfolio-review-report-controller";
import { isPreparedPortfolioReviewReport } from "./portfolio-review-report";
import { samePortfolioReportData } from "./portfolio-review-report-data";
import {
  ManagedPortfolioValuationReview,
  type PortfolioValuationReviewState,
} from "./managed-portfolio-valuation-review";
import type { PortfolioSavedScenarioRow } from "./portfolio-valuation-plan";

interface Owner {
  readonly capture: PortfolioReviewReportCapture;
  readonly frameCurrent: () => boolean;
  readonly priceCurrent: () => boolean;
  readonly stopPrices: () => void;
  detached: boolean;
  research: ManagedResearchSelection | null;
  opening: boolean;
  backPending: boolean;
  dead: boolean;
}

/** Keeps admitted dated evidence through one explicit Portfolio Research visit. */
export class ManagedPortfolioValuationContext {
  readonly model: ManagedPortfolioValuationReview;
  private owner: Owner | null = null;
  private preparing: ManagedPortfolioCloseReview | null = null;
  private retired = false;
  private readonly listeners = new Set<() => void>();
  private readonly off: (() => void)[];
  constructor(
    private readonly workspace: ManagedWorkspace,
    private readonly ownsPrices: (
      prices: ManagedPortfolioCloseReview,
    ) => boolean,
    coverage: ManagedResearchCoverage,
  ) {
    this.model = new ManagedPortfolioValuationReview(
      {
        canCapture: this.available,
        capture: this.capture,
        subscribe: (listener) => {
          this.listeners.add(listener);
          return () => {
            this.listeners.delete(listener);
          };
        },
      },
      workspace.valuationAssumptions,
      workspace.valuation,
      {
        now: () => new Date().toISOString(),
        available: this.available,
        coverage,
      },
    );
    this.off = [
      workspace,
      workspace.sessionOwner,
      workspace.portfolio,
      workspace.portfolio.coordinator,
    ].map((source) => source.subscribe(this.changed));
    this.off.push(
      this.model.subscribe(() => {
        if (
          this.owner &&
          this.model.getSnapshot().plan?.report !== this.owner.capture.report
        )
          this.dropOwner();
      }),
    );
  }
  private available = () =>
    !this.retired && !!this.workspace.capturePortfolioWatchlistRoute();
  private matches(
    selection: ManagedResearchSelection,
    candidate: ManagedResearchSelection | null,
  ) {
    return (
      !!candidate &&
      candidate.origin === "portfolio" &&
      candidate.cik === selection.cik &&
      candidate.catalogSnapshotSha256 === selection.catalogSnapshotSha256 &&
      membershipMatchesResult(
        { ...selection.listing, note: "" },
        candidate.listing,
      )
    );
  }
  private current(owner: Owner): boolean {
    const view = this.workspace.getSnapshot();
    if (owner.dead || this.retired || this.owner !== owner) return false;
    if (
      !owner.frameCurrent() ||
      (!owner.detached && !owner.priceCurrent()) ||
      view.view !== "portfolio" ||
      (view.research
        ? !owner.research ||
          !this.matches(owner.research, view.research.selection)
        : !!owner.research && !owner.opening && !owner.backPending) ||
      (!!view.companyRoute &&
        view.companyRoute.listingId !== owner.research?.listing.listingId)
    )
      owner.dead = true;
    return !owner.dead;
  }
  private changed = () => {
    if (this.owner && !this.current(this.owner)) this.dropOwner();
    for (const listener of [...this.listeners]) listener();
  };
  private dropOwner() {
    const owner = this.owner;
    this.owner = null;
    if (owner) {
      owner.dead = true;
      owner.stopPrices();
    }
  }
  invalidate = () => {
    this.dropOwner();
    this.model.invalidate();
    this.changed();
  };
  private capture = (): PortfolioReviewReportCapture | null => {
    const prices = this.preparing,
      w = this.workspace;
    if (!prices || !this.ownsPrices(prices) || !this.available()) return null;
    const capture = prices.captureReport(new Date().toISOString());
    const portfolio = w.portfolio.getSnapshot(),
      saved = w.portfolio.coordinator.getSnapshot();
    const catalog = w.getSnapshot().snapshot;
    const fileRevision = w.portfolio.getDraftFileActivityRevision();
    const projection = w.portfolio.getProjection();
    if (
      !capture?.current() ||
      !isPreparedPortfolioReviewReport(capture.report) ||
      projection?.status !== "valid" ||
      !samePortfolioReportData(capture.report.ledger, saved.draft?.ledger) ||
      !samePortfolioReportData(capture.report.portfolio, projection.portfolio)
    )
      return null;
    const frameCurrent = () =>
      w.sessionOwner.getSnapshot().phase === "active" &&
      w.portfolio.getSnapshot() === portfolio &&
      w.portfolio.coordinator.getSnapshot() === saved &&
      w.getSnapshot().snapshot === catalog &&
      w.portfolio.getDraftFileActivityRevision() === fileRevision &&
      !w.portfolio.hasDraftFileActivity();
    this.dropOwner();
    const owner: Owner = {
      capture: { report: capture.report, current: () => this.current(owner) },
      frameCurrent,
      priceCurrent: capture.current,
      stopPrices: prices.subscribe(this.changed),
      detached: false,
      research: null,
      opening: false,
      backPending: false,
      dead: false,
    };
    this.owner = owner;
    return this.current(owner) ? owner.capture : null;
  };
  preview(
    prices: ManagedPortfolioCloseReview,
    expected: PortfolioValuationReviewState,
  ) {
    if (
      this.preparing ||
      !this.ownsPrices(prices) ||
      !this.model.canPreview(expected)
    )
      return null;
    this.preparing = prices;
    try {
      const installed = this.model.preview(expected);
      if (
        !installed &&
        this.owner?.capture.report !== this.model.getSnapshot().plan?.report
      )
        this.dropOwner();
      if (!installed) this.model.reconcile();
      return installed;
    } finally {
      this.preparing = null;
    }
  }
  canResearch(row: PortfolioSavedScenarioRow) {
    return (
      this.available() &&
      !!this.owner &&
      this.current(this.owner) &&
      !!this.model.getSnapshot().plan?.rows.includes(row)
    );
  }
  research(row: PortfolioSavedScenarioRow, open: () => void) {
    if (!this.canResearch(row)) return false;
    const owner = this.owner!;
    owner.research = row.selection;
    owner.opening = true;
    owner.detached = true;
    try {
      open();
    } catch {
      if (this.owner === owner) this.invalidate();
      return false;
    } finally {
      owner.opening = false;
    }
    const selection = this.workspace.getSnapshot().research?.selection ?? null;
    if (
      this.owner !== owner ||
      !this.current(owner) ||
      !this.matches(row.selection, selection)
    ) {
      if (this.owner === owner) this.invalidate();
      return false;
    }
    this.changed();
    return this.owner === owner && this.current(owner);
  }
  navigation(blocked: boolean) {
    if (
      blocked &&
      this.owner &&
      !this.owner.research &&
      !this.owner.backPending
    )
      this.invalidate();
  }
  beforeResearch() {
    if (this.owner && !this.owner.opening) this.invalidate();
  }
  openingSelection(candidate: ManagedResearchSelection) {
    const owner = this.owner;
    return owner?.opening &&
      owner.research &&
      this.current(owner) &&
      candidate.origin === "portfolio" &&
      candidate.catalogSnapshotSha256 ===
        owner.research.catalogSnapshotSha256 &&
      membershipMatchesResult(
        { ...candidate.listing, note: "" },
        owner.research.listing,
      )
      ? owner.research
      : null;
  }
  companyRoute(route: ManagedCompanyRoute | null) {
    if (
      route &&
      this.owner &&
      route.listingId !== this.owner.research?.listing.listingId
    )
      this.invalidate();
  }
  ownedBack() {
    const owner = this.owner,
      selection = this.workspace.getSnapshot().research?.selection;
    if (
      !owner ||
      !selection ||
      !owner.research ||
      !this.current(owner) ||
      !this.matches(owner.research, selection)
    )
      return false;
    owner.backPending = true;
    return true;
  }
  closeResearch() {
    if (this.owner?.research && !this.owner.backPending && !this.owner.opening)
      this.invalidate();
  }
  resumePortfolio() {
    const owner = this.owner,
      view = this.workspace.getSnapshot();
    if (
      !owner?.backPending ||
      !this.current(owner) ||
      view.research ||
      view.companyRoute ||
      !this.available()
    )
      return false;
    owner.backPending = false;
    owner.research = null;
    this.changed();
    return this.owner === owner && this.current(owner);
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.off.forEach((stop) => stop());
    this.dropOwner();
    this.model.retire();
  }
}
