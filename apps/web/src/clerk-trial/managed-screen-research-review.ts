import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import {
  companyReportBlock,
  companyReportIsCurrent,
  prepareCompanyReport,
  type CompanyReportEvidence,
} from "./managed-company-report";
import {
  createPassiveCompanyResearchCapture,
  type CompanyResearchSide,
  type PassiveCompanyResearchCapture,
} from "./passive-company-research";
import type {
  ManagedFinancialScreen,
  ManagedFinancialScreenReportCapture,
  ScreenResearchPairLease,
} from "./managed-financial-screen";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type {
  ManagedResearchVisit,
  ResearchWatchlistState,
} from "./managed-workspace";
import type { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import type { PreparedScreenComparisonReport } from "./screen-comparison-report";

export interface ScreenResearchReading {
  readonly kind: "screen_research_reading";
  readonly comparison: PreparedScreenComparisonReport;
  readonly left: PassiveCompanyResearchCapture | null;
  readonly right: PassiveCompanyResearchCapture | null;
}
export interface ManagedScreenResearchReviewState {
  readonly reading: ScreenResearchReading | null;
  readonly activeSide: CompanyResearchSide | null;
  readonly canCapture: boolean;
  readonly reason: string | null;
}
export interface PreparedScreenResearchReport {
  readonly kind: "paired_company_research";
  readonly preparedAt: string;
  readonly reading: ScreenResearchReading & {
    readonly left: PassiveCompanyResearchCapture;
    readonly right: PassiveCompanyResearchCapture;
  };
}
const reports = new WeakSet<object>();
export function isPreparedScreenResearchReport(
  value: unknown,
): value is PreparedScreenResearchReport {
  return typeof value === "object" && value !== null && reports.has(value);
}
export interface PendingScreenResearchVisit {
  readonly kind: "screen_research_visit";
}
export interface ScreenResearchReviewOptions {
  readonly readVisit: () => ManagedResearchVisit | null;
  readonly readEvidence: (
    selection: ManagedResearchSelection,
  ) => CompanyReportEvidence;
  readonly readWatchlist: (
    selection: ManagedResearchSelection,
  ) => ResearchWatchlistState;
  readonly valuation: ManagedValuationWorkbench;
  readonly available: () => boolean;
  readonly now?: () => Date;
}
const idle = (): ManagedScreenResearchReviewState =>
  Object.freeze({
    reading: null,
    activeSide: null,
    canCapture: false,
    reason: null,
  });
interface Opening {
  readonly token: PendingScreenResearchVisit;
  readonly lease: ScreenResearchPairLease;
  readonly side: CompanyResearchSide;
  readonly selection: ManagedResearchSelection;
}
interface VisitOwner {
  readonly side: CompanyResearchSide;
  readonly selection: ManagedResearchSelection;
}
/** One retained reading for the existing screen pair, with one explicit visit. */
export class ManagedScreenResearchReview {
  private state = idle();
  private lease: ScreenResearchPairLease | null = null;
  private pending: Opening | null = null;
  private owner: VisitOwner | null = null;
  private retired = false;
  private generation = 0;
  private fence: readonly unknown[] = [];
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  constructor(
    private readonly screen: ManagedFinancialScreen,
    private readonly options: ScreenResearchReviewOptions,
  ) {
    this.unsubscribe = screen.subscribe(() => this.reconcile());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: ManagedScreenResearchReviewState) {
    const installed = Object.freeze(next);
    this.state = installed;
    ++this.generation;
    for (const listener of this.listeners) listener();
    return this.state === installed ? installed : null;
  }
  private pairCurrent() {
    return this.lease !== null && this.screen.isResearchPairCurrent(this.lease);
  }
  private context() {
    const generation = this.generation;
    const visit = this.options.readVisit();
    const available = this.options.available();
    const valuation = this.options.valuation.getSnapshot();
    const fileRevision = this.options.valuation.getDraftFileActivityRevision();
    const fileActive = this.options.valuation.hasDraftFileActivity();
    const evidence = visit ? this.options.readEvidence(visit.selection) : null;
    const watchlist = visit
      ? this.options.readWatchlist(visit.selection)
      : null;
    if (generation !== this.generation) return null;
    const fence = [
      visit,
      available,
      valuation,
      fileRevision,
      fileActive,
      evidence?.price,
      evidence?.annual,
      evidence?.interim,
      evidence?.filings,
      watchlist?.revision,
      watchlist?.member,
      watchlist?.canAdd,
      watchlist?.canEdit,
      watchlist?.reason,
    ];
    return {
      visit,
      available,
      valuation,
      fileActive,
      evidence,
      watchlist,
      fence,
    };
  }
  private block(
    context: NonNullable<ReturnType<ManagedScreenResearchReview["context"]>>,
  ) {
    if (
      !this.owner ||
      !context.visit ||
      !companyEvidenceSelectionMatches(
        this.owner.selection,
        context.visit.selection,
      )
    )
      return "Open a company from this exact screen pair before capturing its reading.";
    if (!context.available || context.fileActive)
      return "Finish resource operations and file review before capturing this reading.";
    if (!context.evidence || !context.watchlist)
      return "Current company evidence is unavailable.";
    if (context.valuation.inputIssue) return context.valuation.inputIssue;
    if (
      context.valuation.owner &&
      !companyEvidenceSelectionMatches(
        context.visit.selection,
        context.valuation.owner,
      )
    )
      return "Stage or discard the other company's valuation inputs before capturing this reading.";
    if (
      context.valuation.calculation &&
      !this.options.valuation.captureCalculationMetadata(
        context.valuation.calculation,
      )
    )
      return "Calculate the current authored inputs before capturing their result.";
    return companyReportBlock(
      context.visit.selection,
      context.evidence,
      context.watchlist,
      context.valuation.calculation,
    );
  }
  reconcile() {
    if (this.retired) return;
    if (this.lease && !this.pairCurrent()) {
      this.invalidate();
      return;
    }
    const context = this.context();
    if (!context) return;
    if (
      !this.pending &&
      this.owner &&
      (!context.visit ||
        !companyEvidenceSelectionMatches(
          this.owner.selection,
          context.visit.selection,
        ))
    ) {
      this.invalidate();
      return;
    }
    const reason = this.pending
      ? "Opening the selected company…"
      : this.lease
        ? this.block(context)
        : null;
    const canCapture =
      !!this.lease && !!this.owner && !this.pending && reason === null;
    const changed =
      context.fence.length !== this.fence.length ||
      context.fence.some((v, i) => v !== this.fence[i]);
    this.fence = context.fence;
    if (
      changed ||
      this.state.canCapture !== canCapture ||
      this.state.reason !== reason
    )
      this.publish({
        ...this.state,
        activeSide: this.owner?.side ?? null,
        canCapture,
        reason,
      });
  }
  prepareOpen(
    capture: ManagedFinancialScreenReportCapture,
  ): PendingScreenResearchVisit | null {
    if (
      this.retired ||
      !this.screen.canAdmitReport(capture) ||
      !this.options.available()
    )
      return null;
    if (this.lease && !this.pairCurrent()) this.invalidate();
    const generation = this.generation;
    const lease =
      this.lease ??
      this.screen.captureResearchPair(
        this.screen.getSnapshot(),
        (this.options.now?.() ?? new Date()).toISOString(),
      );
    if (!lease || generation !== this.generation) return null;
    const side = this.screen.prepareResearchPairVisit(lease, capture);
    if (!side) {
      if (lease !== this.lease) this.screen.releaseResearchPair(lease);
      return null;
    }
    const token = Object.freeze({ kind: "screen_research_visit" as const });
    const selection: ManagedResearchSelection = {
      listing: capture.row.member.listing,
      catalogSnapshotSha256: lease.comparison.catalogSnapshotSha256,
      cik: capture.response.security.cik,
      origin: "screening",
    };
    this.lease = lease;
    this.pending = { token, lease, side, selection };
    this.owner = null;
    this.publish({
      ...this.state,
      activeSide: null,
      canCapture: false,
      reason: "Opening the selected company…",
    });
    return this.pending?.token === token && this.pairCurrent() ? token : null;
  }
  commitOpen(
    token: PendingScreenResearchVisit,
    visit: ManagedResearchVisit | undefined,
  ): boolean {
    const pending = this.pending;
    if (!pending || pending.token !== token) return false;
    if (
      !visit ||
      this.options.readVisit() !== visit ||
      !this.pairCurrent() ||
      !companyEvidenceSelectionMatches(pending.selection, visit.selection)
    ) {
      if (this.pending === pending) this.invalidate();
      return false;
    }
    if (this.pending !== pending) return false;
    this.pending = null;
    this.owner = { side: pending.side, selection: visit.selection };
    const reading =
      this.state.reading ??
      Object.freeze({
        kind: "screen_research_reading" as const,
        comparison: pending.lease.comparison,
        left: null,
        right: null,
      });
    const installed = this.publish({
      reading,
      activeSide: pending.side,
      canCapture: false,
      reason: null,
    });
    if (!installed || !this.owner || !this.pairCurrent()) return false;
    this.reconcile();
    return (
      this.owner?.selection === visit.selection &&
      this.options.readVisit() === visit &&
      this.pairCurrent()
    );
  }
  prepareSide(
    expected: ManagedScreenResearchReviewState,
    side: CompanyResearchSide,
  ): ManagedFinancialScreenReportCapture | null {
    this.reconcile();
    if (
      this.retired ||
      expected !== this.state ||
      !this.options.available() ||
      !this.pairCurrent() ||
      (side !== "left" && side !== "right")
    )
      return null;
    const current = this.screen.getSnapshot();
    const row = current.comparison[side];
    if (!current.run || !row?.report?.response) return null;
    const capture = { run: current.run, row, response: row.report.response };
    return this.screen.canAdmitReport(capture) ? capture : null;
  }
  capture(
    expected: ManagedScreenResearchReviewState,
    visit: ManagedResearchVisit,
  ): ManagedScreenResearchReviewState | null {
    this.reconcile();
    if (
      expected !== this.state ||
      !expected.canCapture ||
      !this.owner ||
      !expected.reading ||
      !this.pairCurrent()
    )
      return null;
    const owner = this.owner;
    const generation = this.generation;
    const context = this.context();
    if (
      !context ||
      context.visit !== visit ||
      !context.evidence ||
      !context.watchlist ||
      this.block(context)
    )
      return null;
    const report = prepareCompanyReport(
      visit.selection,
      context.evidence,
      context.watchlist,
      this.options.now,
      context.valuation.calculation,
    );
    if (!report) return null;
    const metadata = report.valuation
      ? this.options.valuation.captureCalculationMetadata(report.valuation)
      : null;
    if (report.valuation && !metadata) return null;
    const reading = createPassiveCompanyResearchCapture(
      report,
      owner.side,
      metadata?.evaluatedAt ?? null,
    );
    const fresh = this.context();
    if (
      !reading ||
      !fresh ||
      generation !== this.generation ||
      this.owner !== owner ||
      !this.pairCurrent() ||
      fresh.visit !== visit ||
      !fresh.evidence ||
      !fresh.watchlist ||
      this.block(fresh)
    )
      return null;
    if (
      fresh.fence.some((value, i) => value !== context.fence[i]) ||
      !companyReportIsCurrent(
        report,
        visit.selection,
        fresh.evidence,
        fresh.watchlist,
        fresh.valuation.calculation,
      )
    )
      return null;
    const installed = this.publish({
      ...expected,
      reading: Object.freeze({ ...expected.reading, [owner.side]: reading }),
    });
    if (!installed || this.owner !== owner || !this.pairCurrent()) return null;
    this.reconcile();
    return this.state === installed ? installed : null;
  }
  ownedBack(visit: ManagedResearchVisit) {
    if (
      this.retired ||
      this.pending ||
      !this.owner ||
      this.options.readVisit() !== visit ||
      !companyEvidenceSelectionMatches(this.owner.selection, visit.selection) ||
      !this.pairCurrent()
    )
      return false;
    this.owner = null;
    const installed = this.publish({
      ...this.state,
      activeSide: null,
      canCapture: false,
      reason: null,
    });
    return installed !== null && this.pairCurrent();
  }
  /** A passive report owns this exact complete pair, never live editor authority. */
  captureReport(expected: ManagedScreenResearchReviewState) {
    this.reconcile();
    if (expected !== this.state) return null;
    const reading = expected.reading;
    const lease = this.lease;
    const generation = this.generation;
    if (!reading?.left || !reading.right || !lease) return null;
    let valid = true;
    const current = () => {
      if (!valid) return false;
      const available = this.options.available();
      const visit = this.options.readVisit();
      valid =
        available &&
        !visit &&
        !this.retired &&
        !this.pending &&
        !this.owner &&
        this.generation === generation &&
        this.lease === lease &&
        this.state.reading === reading &&
        this.pairCurrent();
      return valid;
    };
    if (!current()) return null;
    const preparedAt = (this.options.now?.() ?? new Date()).toISOString();
    if (!current()) return null;
    const report: PreparedScreenResearchReport = Object.freeze({
      kind: "paired_company_research",
      preparedAt,
      reading: reading as PreparedScreenResearchReport["reading"],
    });
    reports.add(report);
    return Object.freeze({ report, current });
  }
  clearSide(
    expected: ManagedScreenResearchReviewState,
    side: CompanyResearchSide,
  ) {
    if (
      this.retired ||
      expected !== this.state ||
      !this.pairCurrent() ||
      !expected.reading ||
      (side !== "left" && side !== "right")
    )
      return null;
    return this.publish({
      ...expected,
      reading: Object.freeze({ ...expected.reading, [side]: null }),
    });
  }
  clear(expected: ManagedScreenResearchReviewState) {
    if (expected !== this.state || this.retired) return null;
    return this.invalidate();
  }
  foreignClose() {
    this.invalidate();
  }
  invalidate() {
    if (this.lease) this.screen.releaseResearchPair(this.lease);
    this.lease = null;
    this.pending = null;
    this.owner = null;
    this.fence = [];
    return this.publish(idle());
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.unsubscribe();
    this.invalidate();
    this.listeners.clear();
  }
}
