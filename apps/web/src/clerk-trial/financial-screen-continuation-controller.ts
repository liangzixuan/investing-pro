import type {
  ManagedFinancialScreen,
  ManagedFinancialScreenRun,
} from "./managed-financial-screen";
import type { FinancialScreenContinuationPlan } from "./managed-financial-screen-continuation";

export interface FinancialScreenContinuationOwner {
  isCurrent(): boolean;
}
export interface FinancialScreenContinuationOptions {
  readonly captureOwner: () => FinancialScreenContinuationOwner | null;
  readonly now?: () => Date;
}
export interface FinancialScreenContinuationState {
  readonly status: "idle" | "preview" | "running" | "settled" | "stale";
  readonly plan: FinancialScreenContinuationPlan | null;
  readonly result: ManagedFinancialScreenRun | null;
  readonly canRun: boolean;
  readonly message: string;
}
type Capture = NonNullable<
  ReturnType<ManagedFinancialScreen["captureContinuation"]>
>;
const initial = (): FinancialScreenContinuationState =>
  Object.freeze({
    status: "idle",
    plan: null,
    result: null,
    canRun: false,
    message: "",
  });
const stale =
  "The screen or visit changed. Review the current missing reads again.";

/** Owns a finite request preview/pass. Settled data has no route or source authority. */
export class FinancialScreenContinuationController {
  private state = initial();
  private active: {
    capture: Capture;
    owner: FinancialScreenContinuationOwner;
  } | null = null;
  private revision = 0;
  private retired = false;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  constructor(
    private readonly screen: ManagedFinancialScreen,
    private readonly options: FinancialScreenContinuationOptions,
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
  private capturedResult(plan: FinancialScreenContinuationPlan | null) {
    const run = this.screen.getSnapshot().run;
    return plan &&
      run?.handle === plan.sourceRun.handle &&
      run.criteriaRevision === plan.sourceRun.criteriaRevision &&
      run.selectionRevision === plan.sourceRun.selectionRevision
      ? run
      : null;
  }
  private publish(next: FinancialScreenContinuationState) {
    this.state = Object.freeze(next);
    const installed = this.state;
    for (const listener of this.listeners) listener();
    return this.state === installed ? installed : null;
  }
  preview(expected: FinancialScreenContinuationState) {
    if (this.retired || expected !== this.state) return null;
    const revision = this.withdraw();
    if (this.retired || revision !== this.revision) return null;
    const screen = this.screen.getSnapshot();
    const owner = this.options.captureOwner();
    if (this.retired || revision !== this.revision) return null;
    const capture = owner?.isCurrent()
      ? this.screen.captureContinuation(
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
            message: "Use a settled current screen with missing Annual reads.",
          })
        : null;
    }
    if (this.retired || revision !== this.revision) {
      capture.cancel();
      return null;
    }
    this.active = { capture, owner };
    return this.publish({
      status: "preview",
      plan: capture.plan,
      result: null,
      canRun: true,
      message:
        "Inspect every retained packet and missing request. Run clears the screen shortlist and pair; it does not save the Watchlist.",
    });
  }
  reconcile() {
    const active = this.active;
    if (this.retired || !active) return;
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
          plan,
          result: this.capturedResult(plan),
          canRun: false,
          message: stale,
        });
    }
  }
  async run(
    expected: FinancialScreenContinuationState,
  ): Promise<FinancialScreenContinuationState | null> {
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
      message: "Reading only the reviewed missing Annual reports.",
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
      plan: expected.plan,
      result: result?.run ?? this.capturedResult(expected.plan),
      canRun: false,
      message: result
        ? "This pass has settled. Inspect each packet's original dates and each attempt's outcome. Save separately."
        : stale,
    });
  }
  cancel(expected: FinancialScreenContinuationState) {
    if (this.retired || expected !== this.state) return;
    const running = expected.status === "running";
    const revision = this.withdraw();
    if (this.retired || revision !== this.revision) return;
    this.publish(
      running
        ? {
            status: "settled",
            plan: expected.plan,
            result: this.capturedResult(expected.plan),
            canRun: false,
            message:
              "The pass was cancelled. Completed packets remain; review what is still missing before another explicit pass.",
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
