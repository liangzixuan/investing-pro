export interface PersonalSecRequestScheduler {
  wait(signal: AbortSignal): Promise<void>;
}

export const PERSONAL_SEC_REQUEST_SCHEDULER_LIMITS = Object.freeze({
  minimumIntervalMs: 220,
  queuedRequests: 64,
});

export class PersonalSecRequestSchedulerError extends Error {
  public constructor(public readonly code: "busy" | "aborted") {
    super("Personal SEC request scheduling is unavailable.");
    this.name = "PersonalSecRequestSchedulerError";
  }
}

interface Waiter {
  readonly signal: AbortSignal;
  readonly resolve: () => void;
  readonly reject: (error: PersonalSecRequestSchedulerError) => void;
  readonly onAbort: () => void;
}

/** A fresh scheduler is for isolated tests or an explicitly shared composition. */
export function createPersonalSecRequestScheduler(
  dependencies: Readonly<{ now?: () => number }> = {},
): PersonalSecRequestScheduler {
  return new SecRequestScheduler(dependencies.now ?? (() => performance.now()));
}

class SecRequestScheduler implements PersonalSecRequestScheduler {
  readonly #now: () => number;
  readonly #queue: Waiter[] = [];
  #lastDispatchTurn: number | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #dispatchBarrier: ReturnType<typeof setTimeout> | undefined;

  public constructor(now: () => number) {
    if (typeof now !== "function") throw new TypeError("Invalid SEC clock.");
    this.#now = now;
  }

  public wait(signal: AbortSignal): Promise<void> {
    if (signal.aborted)
      return Promise.reject(new PersonalSecRequestSchedulerError("aborted"));
    if (
      this.#queue.length >= PERSONAL_SEC_REQUEST_SCHEDULER_LIMITS.queuedRequests
    )
      return Promise.reject(new PersonalSecRequestSchedulerError("busy"));
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        signal,
        resolve,
        reject,
        onAbort: () => {
          const index = this.#queue.indexOf(waiter);
          if (index < 0) return;
          this.#queue.splice(index, 1);
          signal.removeEventListener("abort", waiter.onAbort);
          reject(new PersonalSecRequestSchedulerError("aborted"));
          if (this.#queue.length === 0) {
            clearTimeout(this.#timer);
            this.#timer = undefined;
          }
        },
      };
      signal.addEventListener("abort", waiter.onAbort, { once: true });
      this.#queue.push(waiter);
      this.#drain();
    });
  }

  #readClock(): number {
    const now = this.#now();
    if (!Number.isFinite(now)) throw new TypeError("Invalid SEC clock.");
    return now;
  }

  #drain(): void {
    if (
      this.#queue.length === 0 ||
      this.#timer !== undefined ||
      this.#dispatchBarrier !== undefined
    )
      return;
    try {
      const now = this.#readClock();
      // Production uses a monotonic clock. A rewound injected clock waits a full
      // interval rather than granting an early permit or an unbounded timeout.
      if (this.#lastDispatchTurn !== undefined && now < this.#lastDispatchTurn)
        this.#lastDispatchTurn = now;
      const remaining =
        this.#lastDispatchTurn === undefined
          ? 0
          : PERSONAL_SEC_REQUEST_SCHEDULER_LIMITS.minimumIntervalMs -
            (now - this.#lastDispatchTurn);
      if (remaining > 0) {
        this.#timer = setTimeout(() => {
          this.#timer = undefined;
          this.#drain();
        }, remaining);
        return;
      }
      const waiter = this.#queue.shift()!;
      waiter.signal.removeEventListener("abort", waiter.onAbort);
      // Consumers dispatch immediately after awaiting a permit. Record the
      // cooldown after their promise continuations and synchronous fetch setup,
      // so event-loop stalls cannot compress actual dispatch spacing.
      this.#dispatchBarrier = setTimeout(() => {
        this.#dispatchBarrier = undefined;
        try {
          this.#lastDispatchTurn = this.#readClock();
          this.#drain();
        } catch {
          this.#rejectQueued();
        }
      }, 0);
      waiter.resolve();
    } catch {
      this.#rejectQueued();
    }
  }

  #rejectQueued(): void {
    for (const waiter of this.#queue.splice(0)) {
      waiter.signal.removeEventListener("abort", waiter.onAbort);
      waiter.reject(new PersonalSecRequestSchedulerError("busy"));
    }
  }
}

// All default SEC providers in this process share one pacing history, including
// newly constructed providers and refreshes. No provider owns or resets it.
export const sharedPersonalSecRequestScheduler =
  createPersonalSecRequestScheduler();
