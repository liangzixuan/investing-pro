export const PERSONAL_OWNER_SESSION_IDLE_TTL_MS = 10 * 60 * 1_000;
export const PERSONAL_OWNER_SESSION_ABSOLUTE_TTL_MS = 60 * 60 * 1_000;

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

export type OwnerSessionExpiryReason =
  "absolute_timeout" | "clock_invalid" | "idle_timeout";

export interface OwnerSessionLifecycleOptions {
  readonly absoluteTtlMs?: number;
  readonly clearTimer?: (handle: TimerHandle) => void;
  readonly idleTtlMs?: number;
  readonly now?: () => number;
  readonly observedLeaseMs?: number;
  readonly setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
}

/**
 * A browser-only, nonpersistent safety lease for rendered private data.
 *
 * The server remains authoritative. A session first observed from an existing
 * HttpOnly cookie has no browser-visible creation time, so it receives only a
 * conservative lease bounded by the idle TTL. A freshly bootstrapped session
 * may use the full configured absolute TTL. Activity can move only the idle
 * deadline and never the absolute deadline.
 */
export class OwnerSessionLifecycle {
  readonly #absoluteTtlMs: number;
  readonly #clearTimer: (handle: TimerHandle) => void;
  readonly #idleTtlMs: number;
  readonly #now: () => number;
  readonly #observedLeaseMs: number;
  readonly #onExpiry: (reason: OwnerSessionExpiryReason) => void;
  readonly #setTimer: (callback: () => void, delayMs: number) => TimerHandle;

  #absoluteDeadline: number | undefined;
  #idleDeadline: number | undefined;
  #lastObservedAt: number | undefined;
  #timer: TimerHandle | undefined;

  constructor(
    onExpiry: (reason: OwnerSessionExpiryReason) => void,
    options: OwnerSessionLifecycleOptions = {},
  ) {
    this.#absoluteTtlMs =
      options.absoluteTtlMs ?? PERSONAL_OWNER_SESSION_ABSOLUTE_TTL_MS;
    this.#idleTtlMs = options.idleTtlMs ?? PERSONAL_OWNER_SESSION_IDLE_TTL_MS;
    this.#observedLeaseMs = options.observedLeaseMs ?? this.#idleTtlMs;
    this.#now = options.now ?? (() => Date.now());
    this.#setTimer =
      options.setTimer ??
      ((callback, delayMs) => globalThis.setTimeout(callback, delayMs));
    this.#clearTimer =
      options.clearTimer ?? ((handle) => globalThis.clearTimeout(handle));
    this.#onExpiry = onExpiry;

    if (
      !Number.isSafeInteger(this.#idleTtlMs) ||
      !Number.isSafeInteger(this.#absoluteTtlMs) ||
      !Number.isSafeInteger(this.#observedLeaseMs) ||
      this.#idleTtlMs < 1 ||
      this.#absoluteTtlMs < this.#idleTtlMs ||
      this.#observedLeaseMs < 1 ||
      this.#observedLeaseMs > this.#idleTtlMs
    ) {
      throw new TypeError("Invalid owner-session lifecycle durations.");
    }
  }

  get active(): boolean {
    return this.#absoluteDeadline !== undefined;
  }

  beginFresh(): boolean {
    return this.#begin(this.#absoluteTtlMs);
  }

  beginObserved(): boolean {
    return this.#begin(this.#observedLeaseMs);
  }

  recordAuthorizedActivity(): boolean {
    const now = this.#readCurrentTime();
    if (now === undefined || !this.#checkAt(now)) return false;

    this.#lastObservedAt = now;
    this.#idleDeadline = Math.min(
      now + this.#idleTtlMs,
      this.#absoluteDeadline as number,
    );
    this.#schedule(now);
    return true;
  }

  check(): boolean {
    const now = this.#readCurrentTime();
    return now !== undefined && this.#checkAt(now);
  }

  deactivate(): void {
    this.#cancelTimer();
    this.#absoluteDeadline = undefined;
    this.#idleDeadline = undefined;
    this.#lastObservedAt = undefined;
  }

  #begin(leaseMs: number): boolean {
    const now = this.#readClock();
    if (now === undefined) {
      this.#expire("clock_invalid");
      return false;
    }

    this.#cancelTimer();
    this.#lastObservedAt = now;
    this.#absoluteDeadline = now + leaseMs;
    this.#idleDeadline = Math.min(
      now + this.#idleTtlMs,
      this.#absoluteDeadline,
    );
    this.#schedule(now);
    return true;
  }

  #checkAt(now: number): boolean {
    const absoluteDeadline = this.#absoluteDeadline;
    const idleDeadline = this.#idleDeadline;
    if (absoluteDeadline === undefined || idleDeadline === undefined) {
      return false;
    }
    if (now >= absoluteDeadline) {
      this.#expire("absolute_timeout");
      return false;
    }
    if (now >= idleDeadline) {
      this.#expire("idle_timeout");
      return false;
    }
    return true;
  }

  #readCurrentTime(): number | undefined {
    const now = this.#readClock();
    if (
      now === undefined ||
      (this.#lastObservedAt !== undefined && now < this.#lastObservedAt)
    ) {
      this.#expire("clock_invalid");
      return undefined;
    }
    this.#lastObservedAt = now;
    return now;
  }

  #readClock(): number | undefined {
    try {
      const now = this.#now();
      return Number.isFinite(now) && now >= 0 ? now : undefined;
    } catch {
      return undefined;
    }
  }

  #schedule(now: number): void {
    const absoluteDeadline = this.#absoluteDeadline;
    const idleDeadline = this.#idleDeadline;
    if (absoluteDeadline === undefined || idleDeadline === undefined) return;

    this.#cancelTimer();
    const delayMs = Math.max(0, Math.min(absoluteDeadline, idleDeadline) - now);
    this.#timer = this.#setTimer(() => {
      this.#timer = undefined;
      const current = this.#readCurrentTime();
      if (current === undefined || !this.#checkAt(current)) return;
      this.#schedule(current);
    }, delayMs);
  }

  #cancelTimer(): void {
    if (this.#timer === undefined) return;
    this.#clearTimer(this.#timer);
    this.#timer = undefined;
  }

  #expire(reason: OwnerSessionExpiryReason): void {
    const wasActive = this.active;
    this.deactivate();
    if (wasActive || reason === "clock_invalid") this.#onExpiry(reason);
  }
}
