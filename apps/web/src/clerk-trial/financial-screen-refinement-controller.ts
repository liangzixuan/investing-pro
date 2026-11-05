import type {
  ManagedFinancialScreen,
  ManagedFinancialScreenState,
} from "./managed-financial-screen";
import type { FinancialScreenRefinementReading } from "./managed-financial-screen-refinement";

export interface FinancialScreenRefinementOwner {
  isCurrent(): boolean;
}
export interface FinancialScreenRefinementState {
  readonly status: "idle" | "preview" | "applied" | "stale";
  readonly reading: FinancialScreenRefinementReading | null;
  readonly canApply: boolean;
  readonly message: string;
}
export interface FinancialScreenRefinementOptions {
  readonly captureOwner: () => FinancialScreenRefinementOwner | null;
  readonly now?: () => Date;
}
type Capture = NonNullable<
  ReturnType<ManagedFinancialScreen["captureRefinement"]>
>;
const initial = (): FinancialScreenRefinementState =>
  Object.freeze({
    status: "idle",
    reading: null,
    canApply: false,
    message: "",
  });
const stale = "The screen or visit changed. Preview the current run again.";

/** Owns one preview only. The workspace supplies its route/resource/file lease. */
export class FinancialScreenRefinementController {
  private state = initial();
  private token: {
    capture: Capture;
    owner: FinancialScreenRefinementOwner;
  } | null = null;
  private revision = 0;
  private retired = false;
  private listeners = new Set<() => void>();
  private unsubscribe: () => void;
  constructor(
    private readonly screen: ManagedFinancialScreen,
    private readonly options: FinancialScreenRefinementOptions,
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
    this.token?.capture.cancel();
    this.token = null;
    this.revision++;
  }
  private publish(next: FinancialScreenRefinementState) {
    this.state = Object.freeze(next);
    const installed = this.state;
    for (const listener of this.listeners) listener();
    return this.state === installed ? installed : null;
  }
  preview(expected: FinancialScreenRefinementState, criteria: unknown) {
    if (this.retired || expected !== this.state) return null;
    this.withdraw();
    const revision = this.revision;
    const screen = this.screen.getSnapshot();
    const owner = this.options.captureOwner();
    if (this.retired || revision !== this.revision) return null;
    if (
      !owner ||
      !owner.isCurrent() ||
      revision !== this.revision ||
      this.retired
    ) {
      if (!this.retired && revision === this.revision)
        return this.publish({ ...initial(), message: stale });
      return null;
    }
    const evaluatedAt = (this.options.now?.() ?? new Date()).toISOString();
    const capture = this.screen.captureRefinement(
      screen,
      criteria,
      evaluatedAt,
    );
    if (this.retired || revision !== this.revision) {
      capture?.cancel();
      return null;
    }
    if (!capture || !owner.isCurrent() || !capture.isCurrent()) {
      capture?.cancel();
      if (this.retired || revision !== this.revision) return null;
      return this.publish({
        ...initial(),
        message: "Use a settled current run and valid filters to preview.",
      });
    }
    if (this.retired || revision !== this.revision) {
      capture.cancel();
      return null;
    }
    this.token = { capture, owner };
    return this.publish({
      status: "preview",
      reading: capture.reading,
      canApply: true,
      message: "Inspect all revised outcomes before applying the filters.",
    });
  }
  cancel(expected: FinancialScreenRefinementState) {
    if (this.retired || expected !== this.state) return;
    this.withdraw();
    this.publish(initial());
  }
  reconcile() {
    const token = this.token;
    if (this.retired || !token) return;
    const current = token.owner.isCurrent() && token.capture.isCurrent();
    if (this.retired || this.token !== token) return;
    if (!current) {
      this.withdraw();
      this.publish({
        status: "stale",
        reading: this.state.reading,
        canApply: false,
        message: stale,
      });
    }
  }
  apply(
    expected: FinancialScreenRefinementState,
  ): ManagedFinancialScreenState | null {
    if (this.retired || expected !== this.state || !expected.canApply)
      return null;
    this.reconcile();
    if (this.retired || expected !== this.state || !this.token) return null;
    const token = this.token;
    this.token = null; // Consume before the screen publishes to reentrant listeners.
    const revision = ++this.revision;
    const installed = token.capture.apply();
    if (this.retired || revision !== this.revision) return null;
    const current =
      installed &&
      token.owner.isCurrent() &&
      this.screen.getSnapshot() === installed;
    if (this.retired || revision !== this.revision) return null;
    const published = this.publish({
      status: current ? "applied" : "stale",
      reading: expected.reading,
      canApply: false,
      message: current
        ? "Filters applied to the retained reports. Run separately for new evidence."
        : stale,
    });
    return current &&
      published &&
      token.owner.isCurrent() &&
      !this.retired &&
      revision === this.revision &&
      this.state === published &&
      this.screen.getSnapshot() === installed
      ? installed
      : null;
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
