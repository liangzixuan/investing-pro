import type {
  ManagedFinancialScreen,
  ManagedFinancialScreenRun,
} from "./managed-financial-screen";
import type { FinancialScreenPassReviewPlan } from "./managed-financial-screen-pass-review";

export interface FinancialScreenPassReviewOwner {
  isCurrent(): boolean;
}
export interface FinancialScreenPassReviewOptions {
  readonly captureOwner: () => FinancialScreenPassReviewOwner | null;
  readonly now?: () => Date;
}
export interface FinancialScreenPassReviewState {
  readonly status: "idle" | "preview" | "running" | "settled" | "stale";
  readonly plan: FinancialScreenPassReviewPlan | null;
  readonly result: ManagedFinancialScreenRun | null;
  readonly canRun: boolean;
  readonly currentHandle: symbol | null;
  readonly message: string;
}
type Capture = NonNullable<
  ReturnType<ManagedFinancialScreen["capturePassReview"]>
>;
const initial = (): FinancialScreenPassReviewState =>
  Object.freeze({
    status: "idle",
    plan: null,
    result: null,
    canRun: false,
    currentHandle: null,
    message: "",
  });
const stale =
  "The screen or visit changed. Review the current Annual pass again.";

/** Owns one passive baseline and a fresh finite pass. Settled data has no route or source authority. */
export class FinancialScreenPassReviewController {
  private state = initial();
  private active: {
    capture: Capture;
    owner: FinancialScreenPassReviewOwner;
  } | null = null;
  private resultHandle: symbol | null = null;
  private revision = 0;
  private retired = false;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  constructor(
    private readonly screen: ManagedFinancialScreen,
    private readonly options: FinancialScreenPassReviewOptions,
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
  private withdraw() {
    const active = this.active;
    this.active = null;
    const revision = ++this.revision;
    active?.capture.cancel();
    return revision;
  }
  private capturedResult(plan: FinancialScreenPassReviewPlan | null) {
    const run = this.screen.getSnapshot().run;
    return plan &&
      run?.handle === this.resultHandle &&
      run.criteriaRevision === plan.sourceRun.criteriaRevision &&
      run.selectionRevision === plan.sourceRun.selectionRevision
      ? run
      : null;
  }
  private publish(next: FinancialScreenPassReviewState) {
    this.state = Object.freeze(next);
    const installed = this.state;
    for (const listener of this.listeners) listener();
    return this.state === installed ? installed : null;
  }
  preview(expected: FinancialScreenPassReviewState) {
    if (this.retired || expected !== this.state) return null;
    const revision = this.withdraw();
    if (this.retired || revision !== this.revision) return null;
    const screen = this.screen.getSnapshot();
    const owner = this.options.captureOwner();
    if (this.retired || revision !== this.revision) return null;
    const capture = owner?.isCurrent()
      ? this.screen.capturePassReview(
          screen,
          (this.options.now?.() ?? new Date()).toISOString(),
        )
      : null;
    if (this.retired || revision !== this.revision) {
      capture?.cancel();
      return null;
    }
    if (!owner || !capture || !owner.isCurrent() || !capture.isCurrent()) {
      capture?.cancel();
      return !this.retired && revision === this.revision
        ? this.publish({
            ...initial(),
            message:
              "Use a settled screen with its current applied filters and companies.",
          })
        : null;
    }
    if (this.retired || revision !== this.revision) {
      capture.cancel();
      return null;
    }
    this.resultHandle = capture.runHandle;
    this.active = { capture, owner };
    return this.publish({
      status: "preview",
      currentHandle: capture.runHandle,
      plan: capture.plan,
      result: null,
      canRun: true,
      message:
        "Inspect the previous results and the full fresh request list. Run clears the screen shortlist and pair; it does not save the Watchlist.",
    });
  }
  reconcile() {
    const active = this.active;
    if (this.retired) return;
    if (!active) {
      if (
        this.state.status === "settled" &&
        this.state.result &&
        (this.capturedResult(this.state.plan) !== this.state.result ||
          this.screen.getSnapshot().criteriaStaged)
      )
        this.publish({
          ...this.state,
          status: "stale",
          canRun: false,
          message:
            "This retained comparison is no longer the current screen. Its packets remain historical readings.",
        });
      return;
    }
    const current =
      active.owner.isCurrent() &&
      (this.state.status !== "preview" || active.capture.isCurrent());
    if (this.retired || this.active !== active) return;
    if (!current) {
      const plan = this.state.plan;
      const revision = this.withdraw();
      if (!this.retired && revision === this.revision)
        this.publish({
          status: "stale",
          currentHandle: this.resultHandle,
          plan,
          result: this.capturedResult(plan),
          canRun: false,
          message: stale,
        });
    }
  }
  async run(
    expected: FinancialScreenPassReviewState,
  ): Promise<FinancialScreenPassReviewState | null> {
    if (this.retired || expected !== this.state || !expected.canRun)
      return null;
    this.reconcile();
    if (this.retired || expected !== this.state || !this.active) return null;
    const active = this.active;
    const revision = ++this.revision;
    const installed = this.publish({
      ...expected,
      status: "running",
      canRun: false,
      message: "Reading a fresh Annual pass for the reviewed companies.",
    });
    if (
      !installed ||
      this.retired ||
      revision !== this.revision ||
      this.active !== active
    )
      return null;
    const result = await active.capture.run(() => {
      const current =
        !this.retired &&
        this.active === active &&
        revision === this.revision &&
        active.owner.isCurrent();
      return (
        current &&
        !this.retired &&
        this.active === active &&
        revision === this.revision
      );
    });
    if (this.retired || revision !== this.revision || this.active !== active)
      return null;
    this.active = null;
    return this.publish({
      status: result ? "settled" : "stale",
      currentHandle: this.resultHandle,
      plan: expected.plan,
      result: result?.run ?? this.capturedResult(expected.plan),
      canRun: false,
      message: result
        ? "This pass has settled. Inspect each packet's original dates and each attempt's outcome. Save separately."
        : stale,
    });
  }
  cancel(expected: FinancialScreenPassReviewState) {
    if (this.retired || expected !== this.state) return;
    const running = expected.status === "running";
    const revision = this.withdraw();
    if (this.retired || revision !== this.revision) return;
    this.publish(
      running
        ? {
            status: "settled",
            currentHandle: this.resultHandle,
            plan: expected.plan,
            result: this.capturedResult(expected.plan),
            canRun: false,
            message:
              "The pass was cancelled. Completed packets remain; unattempted rows remain unavailable. Start another preview explicitly.",
          }
        : initial(),
    );
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.withdraw();
    this.unsubscribe();
    this.publish(initial());
    this.listeners.clear();
  }
}
