import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type { FollowupsReviewState } from "./managed-followups-review-session";
import {
  prepareManagedPortfolioFollowupsPlan,
  type PortfolioFollowupsPlan,
} from "./managed-portfolio-followups-plan";
import {
  captureHeldDueOwner,
  portfolioHeldDueIssue,
} from "./portfolio-held-due-context";

export interface PortfolioHeldDueState {
  readonly plan: PortfolioFollowupsPlan;
  readonly prepared: boolean;
  readonly chosen: readonly ResearchFollowup[];
  readonly reason: string | null;
  readonly canPrepare: boolean;
  readonly canLoadPortfolio: boolean;
  readonly canLoadFollowups: boolean;
}
type Preview = ReturnType<typeof captureHeldDueOwner> & {
  currentIntake: () => boolean;
  plan: PortfolioFollowupsPlan;
};
export class ManagedPortfolioHeldDueChecks {
  private preview: Preview | null = null;
  private running: {
    current: () => boolean;
    handles: readonly object[];
  } | null = null;
  private starting = false;
  private reconciling = false;
  private retired = false;
  private readonly listeners = new Set<() => void>();
  private readonly off: (() => void)[];
  private state: PortfolioHeldDueState;
  constructor(private readonly workspace: ManagedWorkspace) {
    this.state = this.snapshot([]);
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
  private snapshot(chosen: readonly ResearchFollowup[]): PortfolioHeldDueState {
    const w = this.workspace;
    const active =
      !this.retired && w.sessionOwner.getSnapshot().phase === "active";
    const route = active && w.capturePortfolioFollowupsRoute();
    const review = w.followupsReview.getSnapshot();
    const plan =
      this.preview?.plan ??
      prepareManagedPortfolioFollowupsPlan({
        projection: w.portfolio.getProjection(),
        context: w.followups.getReviewContext(),
      });
    const reason = !route
      ? "Return to Follow-ups in an active session."
      : review.entered && review.phase !== "finished"
        ? "Finish the current review before preparing another set."
        : (portfolioHeldDueIssue(w) ?? plan.reason);
    const loadable = (
      saved: Pick<
        ReturnType<typeof w.portfolio.coordinator.getSnapshot>,
        "phase" | "uncertain" | "conflict" | "replayPending"
      >,
    ) =>
      active &&
      !!route &&
      saved.phase === "idle" &&
      !saved.uncertain &&
      !saved.conflict &&
      !saved.replayPending;
    return Object.freeze({
      plan,
      chosen: Object.freeze([...chosen]),
      prepared: this.preview !== null,
      reason,
      canPrepare: !reason && plan.status === "ready",
      canLoadPortfolio:
        !w.portfolio.hasDraftFileActivity() &&
        loadable(w.portfolio.coordinator.getSnapshot()),
      canLoadFollowups:
        !w.followups.hasDraftFileActivity() &&
        loadable(w.followups.coordinator.getSnapshot()),
    });
  }
  private publish(chosen: readonly ResearchFollowup[] = []) {
    this.state = this.snapshot(chosen);
    for (const listener of this.listeners) listener();
  }
  reconcile = () => {
    if (this.retired || this.reconciling) return;
    this.reconciling = true;
    try {
      if (this.preview && !this.preview.currentIntake()) this.preview = null;
      if (this.running && !this.starting) {
        const review = this.workspace.followupsReview.getSnapshot();
        if (
          !review.entered ||
          review.phase === "finished" ||
          review.chosen.some(
            (row) => !this.running!.handles.includes(row.handle),
          )
        )
          this.running = null;
        else if (!this.running.current()) {
          this.running = null;
          this.workspace.retirePortfolioHeldDueReview(review);
        }
      }
      this.publish(this.preview ? this.state.chosen : []);
    } finally {
      this.reconciling = false;
    }
  };
  prepare(captured: PortfolioHeldDueState) {
    if (captured !== this.state || !captured.canPrepare || this.retired)
      return false;
    const owner = captureHeldDueOwner(this.workspace);
    const route = this.workspace.capturePortfolioFollowupsRoute();
    const draft = owner.context?.draft;
    let retired = false;
    const currentIntake = () => {
      if (
        !owner.current() ||
        !route?.() ||
        this.workspace.followups.getReviewContext()?.draft !== draft
      )
        retired = true;
      return !retired;
    };
    if (
      !owner.context ||
      !currentIntake() ||
      portfolioHeldDueIssue(this.workspace)
    )
      return false;
    this.preview = { ...owner, currentIntake, plan: captured.plan };
    this.publish();
    return this.preview?.currentIntake() === true;
  }
  choose(captured: PortfolioHeldDueState, entry: ResearchFollowup) {
    if (
      captured !== this.state ||
      !this.preview?.currentIntake() ||
      !this.preview.plan.eligible.includes(entry)
    )
      return;
    const chosen = captured.chosen.includes(entry)
      ? captured.chosen.filter((item) => item !== entry)
      : captured.chosen.length < 5
        ? [...captured.chosen, entry]
        : captured.chosen;
    this.publish(chosen);
  }
  cancel(captured: PortfolioHeldDueState) {
    if (captured !== this.state || !this.preview?.currentIntake()) return false;
    this.preview = null;
    this.publish();
    return true;
  }
  start(captured: PortfolioHeldDueState): FollowupsReviewState | null {
    const preview = this.preview;
    if (
      this.retired ||
      captured !== this.state ||
      !preview?.context ||
      !preview.currentIntake()
    )
      return null;
    this.starting = true;
    let installed: FollowupsReviewState | null;
    try {
      installed = this.workspace.followupsReview.admitOrdered(
        preview.context,
        captured.chosen,
        preview.currentIntake,
      );
    } finally {
      this.starting = false;
    }
    this.preview = null;
    if (
      !installed ||
      this.workspace.followupsReview.getSnapshot() !== installed ||
      !preview.current()
    ) {
      this.publish();
      return null;
    }
    this.running = {
      current: preview.current,
      handles: installed.chosen.map((row) => row.handle),
    };
    this.publish();
    return this.workspace.followupsReview.getSnapshot() === installed &&
      this.running?.current()
      ? installed
      : null;
  }
  async loadPortfolio(captured: PortfolioHeldDueState) {
    if (captured === this.state && captured.canLoadPortfolio)
      await this.workspace.portfolio.coordinator.load();
  }
  async loadFollowups(captured: PortfolioHeldDueState) {
    if (captured === this.state && captured.canLoadFollowups)
      await this.workspace.followups.coordinator.load();
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.preview = null;
    this.running = null;
    this.off.forEach((off) => off());
    this.publish();
  }
}
