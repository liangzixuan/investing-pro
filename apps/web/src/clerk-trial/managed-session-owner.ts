import type { SaveCoordinator, SaveState } from "./save-coordinator";
import type { TrialSession } from "./session";

type Resource = Pick<
  SaveCoordinator<unknown>,
  "getSnapshot" | "subscribe" | "retire"
>;
export interface ManagedResourceSaveSummary {
  readonly phase: SaveState<unknown>["phase"];
  readonly dirty: boolean;
  readonly uncertain: boolean;
  readonly conflict: boolean;
  readonly replayPending: boolean;
}
export interface ManagedSessionState {
  readonly phase: "active" | "signing_out" | "retired";
  readonly watchlist: Readonly<ManagedResourceSaveSummary>;
  readonly followups: Readonly<ManagedResourceSaveSummary>;
  readonly portfolio: Readonly<ManagedResourceSaveSummary>;
  readonly valuationAssumptions: Readonly<ManagedResourceSaveSummary>;
  readonly valuationInputs: boolean;
  readonly needsLeaveReview: boolean;
  readonly signOutFailed: boolean;
  readonly cleanupFailed: boolean;
  readonly message: string;
}
function summary(resource: Resource): Readonly<ManagedResourceSaveSummary> {
  const { phase, dirty, uncertain, conflict, replayPending } =
    resource.getSnapshot();
  return Object.freeze({ phase, dirty, uncertain, conflict, replayPending });
}
export function resourceNeedsLeaveReview(resource: ManagedResourceSaveSummary) {
  return (
    resource.phase !== "retired" &&
    resource.phase !== "signing_out" &&
    (resource.dirty ||
      resource.uncertain ||
      resource.conflict ||
      resource.replayPending ||
      resource.phase === "saving" ||
      resource.phase === "reconciling")
  );
}

/** One session lifetime owns the independent save resources and the SDK sign-out. */
export class ManagedSessionOwner {
  private phase: ManagedSessionState["phase"] = "active";
  private state: Readonly<ManagedSessionState>;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribers: (() => void)[];
  private retiring = false;
  private disposed = false;
  private generation = 0;
  private signingOut: Promise<void> | null = null;
  private signOutFailed = false;
  private cleanupFailed = false;
  private message = "";

  constructor(
    private readonly resources: Readonly<{
      watchlist: Resource;
      followups: Resource;
      portfolio: Resource;
      valuationAssumptions: Resource;
    }>,
    private readonly session: Pick<TrialSession, "signOut">,
    private readonly clearResearch: () => void,
    private readonly valuation?: {
      hasDraft: () => boolean;
      subscribe: (listener: () => void) => () => void;
      retire: () => void;
    },
  ) {
    this.state = this.snapshot();
    this.unsubscribers = [
      resources.watchlist,
      resources.followups,
      resources.portfolio,
      resources.valuationAssumptions,
    ].map((resource) =>
      resource.subscribe(() => {
        if (this.retiring || this.disposed) return;
        if (
          this.phase === "active" &&
          resource.getSnapshot().phase === "retired"
        ) {
          this.retire(resource.getSnapshot().message);
        } else this.publish();
      }),
    );
    if (valuation)
      this.unsubscribers.push(
        valuation.subscribe(() => {
          if (!this.retiring && !this.disposed) this.publish();
        }),
      );
  }
  getSnapshot = (): Readonly<ManagedSessionState> => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private snapshot(): Readonly<ManagedSessionState> {
    const watchlist = summary(this.resources.watchlist);
    const followups = summary(this.resources.followups);
    const portfolio = summary(this.resources.portfolio);
    const valuationAssumptions = summary(this.resources.valuationAssumptions);
    const valuationInputs = this.valuation?.hasDraft() ?? false;
    return Object.freeze({
      phase: this.phase,
      watchlist,
      followups,
      portfolio,
      valuationAssumptions,
      valuationInputs,
      needsLeaveReview:
        this.phase === "active" &&
        ([watchlist, followups, portfolio, valuationAssumptions].some(
          resourceNeedsLeaveReview,
        ) ||
          valuationInputs),
      signOutFailed: this.signOutFailed,
      cleanupFailed: this.cleanupFailed,
      message: this.message,
    });
  }
  private publish() {
    this.state = this.snapshot();
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        this.cleanupFailed = true;
      }
    }
    if (this.cleanupFailed !== this.state.cleanupFailed)
      this.state = this.snapshot();
  }
  private clear(message?: string) {
    this.retiring = true;
    // Publish the closed lifetime before callbacks can reenter navigation or sign-out.
    this.state = this.snapshot();
    try {
      // A failed observer must not prevent the other resource from retiring.
      for (const cleanup of [
        () => this.resources.watchlist.retire(message),
        () => this.resources.followups.retire(message),
        () => this.resources.portfolio.retire(message),
        () => this.resources.valuationAssumptions.retire(message),
        () => this.valuation?.retire(),
        this.clearResearch,
      ]) {
        try {
          cleanup();
        } catch {
          this.cleanupFailed = true;
        }
      }
    } finally {
      this.retiring = false;
      this.publish();
    }
  }
  retire(message = "This session ended. Local drafts have been cleared.") {
    if (this.disposed || this.retiring || this.phase !== "active") return;
    this.phase = "retired";
    this.message = message;
    this.clear(message);
  }
  signOut = (): Promise<void> => {
    if (this.disposed) return Promise.resolve();
    if (this.signingOut) return this.signingOut;
    // Reserve the in-flight attempt before retiring resources or notifying listeners.
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    this.signingOut = pending;
    const generation = this.generation;
    this.phase = "signing_out";
    this.signOutFailed = false;
    this.message = "Signing out this session…";
    this.clear();
    void Promise.resolve()
      .then(() => this.session.signOut())
      .then(
        () => {
          if (this.disposed || generation !== this.generation) return;
          this.message = this.cleanupFailed
            ? "Signed out. Local cleanup could not be fully confirmed."
            : "Signed out. Local drafts and valuation inputs have been cleared.";
        },
        () => {
          if (this.disposed || generation !== this.generation) return;
          this.signOutFailed = true;
          this.message =
            "Local drafts were cleared, but sign-out was not confirmed. Try signing out again.";
        },
      )
      .finally(() => {
        if (!this.disposed && generation === this.generation) {
          this.phase = "retired";
          this.signingOut = null;
          this.publish();
        }
        finish();
      });
    return pending;
  };
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.phase = "retired";
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.listeners.clear();
    this.clear();
  }
}
