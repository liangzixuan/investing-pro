import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { CompanyReportEvidence } from "./managed-company-report";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import type { ManagedCompanySourcePassState } from "./managed-company-source-pass-state";
import type {
  FollowupsReviewHandle,
  FollowupsReviewState,
  ManagedFollowupsReviewSession,
} from "./managed-followups-review-session";
import type { ManagedResearchFollowups } from "./managed-research-followups";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedResearchVisit } from "./managed-workspace";
import {
  detachFollowupEvidence,
  followupEvidenceBlock,
  followupEvidenceSelectionMatches,
  type PassiveFollowupEvidenceReading,
} from "./managed-followups-review-evidence-reading";
export type { PassiveFollowupEvidenceReading } from "./managed-followups-review-evidence-reading";

export interface FollowupsReviewEvidenceRow {
  readonly handle: FollowupsReviewHandle;
  readonly entry: ResearchFollowup;
  readonly reading: PassiveFollowupEvidenceReading | null;
}
export interface FollowupsReviewEvidenceState {
  readonly phase: "inactive" | "reviewing" | "finished";
  readonly rows: readonly FollowupsReviewEvidenceRow[];
  readonly selected: FollowupsReviewEvidenceRow | null;
  readonly canCapture: boolean;
  readonly reason: string | null;
}
export interface PendingFollowupEvidenceVisit {
  readonly kind: "followup_evidence_visit";
}
export interface FollowupsReviewEvidenceOptions {
  readonly readVisit: () => ManagedResearchVisit | null;
  readonly readEvidence: (
    selection: ManagedResearchSelection,
  ) => CompanyReportEvidence;
  readonly readSourcePass: () => ManagedCompanySourcePassState;
  readonly available: () => boolean;
  readonly now?: () => Date;
}
interface ReviewLease {
  readonly scope: object;
  readonly handles: readonly FollowupsReviewHandle[];
}
interface VisitOwner {
  readonly handle: FollowupsReviewHandle;
  readonly selection: ManagedResearchSelection;
}
interface Opening extends VisitOwner {
  readonly token: PendingFollowupEvidenceVisit;
}
const idle = (): FollowupsReviewEvidenceState =>
  Object.freeze({
    phase: "inactive",
    rows: Object.freeze([]),
    selected: null,
    canCapture: false,
    reason: null,
  });

/** Per-check readings beside the existing review. It never selects, reads or saves. */
export class ManagedFollowupsReviewEvidence {
  private state = idle();
  private lease: ReviewLease | null = null;
  private owner: VisitOwner | null = null;
  private pending: Opening | null = null;
  private readings = new Map<
    FollowupsReviewHandle,
    PassiveFollowupEvidenceReading
  >();
  private fence: readonly unknown[] = [];
  private generation = 0;
  private readingContext = false;
  private retired = false;
  private readonly listeners = new Set<() => void>();
  private readonly off: readonly (() => void)[];
  constructor(
    private readonly review: ManagedFollowupsReviewSession,
    private readonly followups: ManagedResearchFollowups,
    private readonly options: FollowupsReviewEvidenceOptions,
  ) {
    this.off = [review, followups].map((source) =>
      source.subscribe(() => this.reconcile()),
    );
    this.reconcile();
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: FollowupsReviewEvidenceState) {
    const installed = Object.freeze(next);
    this.state = installed;
    ++this.generation;
    for (const listener of this.listeners) {
      if (this.state !== installed) break;
      listener();
    }
    return this.state === installed ? installed : null;
  }
  private currentLease() {
    const context = this.followups.getReviewContext();
    const review = this.review.getSnapshot();
    return (
      !!this.lease &&
      !this.retired &&
      !this.followups.hasDraftFileActivity() &&
      context?.scope === this.lease.scope &&
      review.entered &&
      review.phase !== "choosing" &&
      review.chosen.length === this.lease.handles.length &&
      review.chosen.every((row, i) => row.handle === this.lease!.handles[i])
    );
  }
  private context() {
    if (this.readingContext) return null;
    this.readingContext = true;
    const generation = this.generation;
    try {
      const review = this.review.getSnapshot();
      const visit = this.options.readVisit();
      const available = this.options.available();
      const evidence =
        this.owner && visit ? this.options.readEvidence(visit.selection) : null;
      const sourcePass =
        this.owner && visit ? this.options.readSourcePass() : null;
      if (this.generation !== generation) return null;
      return {
        review,
        visit,
        available,
        evidence,
        sourcePass,
        fence: [
          review,
          visit,
          available,
          evidence?.price,
          evidence?.annual,
          evidence?.interim,
          evidence?.filings,
          sourcePass,
        ],
      };
    } finally {
      this.readingContext = false;
    }
  }
  private block(
    context: NonNullable<ReturnType<ManagedFollowupsReviewEvidence["context"]>>,
  ) {
    if (context.review.phase !== "reviewing")
      return "This finished review is a passive reading.";
    if (this.pending) return "Opening the current check's company…";
    if (
      !this.owner ||
      !context.visit ||
      this.owner.selection !== context.visit.selection ||
      this.owner.handle !== context.review.selected?.handle
    )
      return "Open Research for the current chosen check before retaining evidence.";
    if (!context.available)
      return "Finish navigation or resource operations before retaining evidence.";
    if (!context.evidence || !context.sourcePass)
      return "Current source evidence is unavailable.";
    return followupEvidenceBlock(
      context.visit.selection,
      context.evidence,
      context.sourcePass,
    );
  }
  reconcile = () => {
    if (this.retired) return;
    const review = this.review.getSnapshot();
    const resource = this.followups.getReviewContext();
    if (this.lease && !this.currentLease()) {
      this.invalidate();
      return;
    }
    if (!this.lease) {
      if (
        !resource ||
        !review.entered ||
        review.phase === "choosing" ||
        !review.chosen.length ||
        this.followups.hasDraftFileActivity()
      )
        return;
      this.lease = {
        scope: resource.scope,
        handles: review.chosen.map((r) => r.handle),
      };
    }
    const context = this.context();
    if (!context) return;
    if (!this.pending && this.owner) {
      if (context.review.selected?.handle !== this.owner.handle)
        this.owner = null;
      else if (
        !context.visit ||
        context.visit.selection !== this.owner.selection
      ) {
        this.invalidate();
        return;
      }
    }
    const reason = this.block(context);
    const canCapture = reason === null && this.currentLease();
    if (
      this.fence.length === context.fence.length &&
      context.fence.every((v, i) => v === this.fence[i]) &&
      this.state.canCapture === canCapture &&
      this.state.reason === reason
    )
      return;
    this.fence = context.fence;
    const rows = Object.freeze(
      context.review.chosen.map((row) =>
        Object.freeze({
          ...row,
          reading: this.readings.get(row.handle) ?? null,
        }),
      ),
    );
    this.publish({
      phase: context.review.phase === "finished" ? "finished" : "reviewing",
      rows,
      selected:
        rows.find((r) => r.handle === context.review.selected?.handle) ?? null,
      canCapture,
      reason,
    });
  };
  prepareOpen(
    expected: FollowupsReviewState,
    selection: ManagedResearchSelection,
  ): PendingFollowupEvidenceVisit | null {
    this.reconcile();
    const entry = this.review.captureCurrent(expected);
    const generation = this.generation;
    const available = this.options.available();
    if (
      !entry ||
      !available ||
      generation !== this.generation ||
      !this.currentLease() ||
      !followupEvidenceSelectionMatches(entry, selection)
    )
      return null;
    const token = Object.freeze({ kind: "followup_evidence_visit" as const });
    this.pending = { token, handle: expected.selected!.handle, selection };
    this.owner = null;
    this.publish({
      ...this.state,
      canCapture: false,
      reason: "Opening the current check's company…",
    });
    return this.pending?.token === token && this.currentLease() ? token : null;
  }
  commitOpen(
    token: PendingFollowupEvidenceVisit,
    visit: ManagedResearchVisit | undefined,
  ) {
    const pending = this.pending;
    if (!pending || pending.token !== token) return false;
    const actual = this.options.readVisit();
    if (this.pending !== pending) return false;
    if (
      !visit ||
      actual !== visit ||
      !companyEvidenceSelectionMatches(pending.selection, visit.selection) ||
      !this.currentLease() ||
      this.review.getSnapshot().selected?.handle !== pending.handle
    ) {
      if (this.pending === pending) this.invalidate();
      return false;
    }
    this.pending = null;
    const owner = { handle: pending.handle, selection: visit.selection };
    this.owner = owner;
    this.fence = [];
    this.reconcile();
    return this.owner === owner && this.currentLease();
  }
  capture(
    expected: FollowupsReviewEvidenceState,
    visit: ManagedResearchVisit,
  ): FollowupsReviewEvidenceState | null {
    this.reconcile();
    if (
      this.retired ||
      expected !== this.state ||
      !expected.canCapture ||
      !expected.selected ||
      !this.owner ||
      !this.currentLease()
    )
      return null;
    const owner = this.owner;
    const generation = this.generation;
    const context = this.context();
    if (
      !context ||
      context.visit !== visit ||
      !context.evidence ||
      !context.sourcePass ||
      this.block(context)
    )
      return null;
    const reading = detachFollowupEvidence(
      expected.selected.entry,
      visit.selection,
      context.evidence,
      context.sourcePass,
      (this.options.now?.() ?? new Date()).toISOString(),
    );
    const fresh = this.context();
    if (
      !reading ||
      !fresh ||
      this.generation !== generation ||
      this.owner !== owner ||
      !this.currentLease() ||
      this.block(fresh) ||
      fresh.fence.some((v, i) => v !== context.fence[i])
    )
      return null;
    this.readings.set(owner.handle, reading);
    const rows = Object.freeze(
      expected.rows.map((r) =>
        r.handle === owner.handle ? Object.freeze({ ...r, reading }) : r,
      ),
    );
    const installed = this.publish({
      ...expected,
      rows,
      selected: rows.find((r) => r.handle === owner.handle)!,
    });
    return installed && this.owner === owner && this.currentLease()
      ? installed
      : null;
  }
  ownedBack(visit: ManagedResearchVisit) {
    const owner = this.owner;
    if (
      !owner ||
      this.pending ||
      this.options.readVisit() !== visit ||
      visit.selection !== owner.selection ||
      !this.currentLease()
    )
      return false;
    if (this.owner !== owner) return false;
    this.owner = null;
    this.fence = [];
    return (
      this.publish({
        ...this.state,
        canCapture: false,
        reason:
          "Open Research for the current chosen check before retaining evidence.",
      }) !== null && this.currentLease()
    );
  }
  foreignClose() {
    return this.invalidate();
  }
  invalidate() {
    this.lease = null;
    this.owner = null;
    this.pending = null;
    this.readings.clear();
    this.fence = [];
    return this.publish(idle());
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.off.forEach((off) => off());
    this.invalidate();
    this.listeners.clear();
  }
}
