import { afterEach, describe, expect, it, vi } from "vitest";

import { OwnerSessionLifecycle } from "./owner-session-lifecycle";

interface ScheduledTimer {
  readonly callback: () => void;
  readonly delayMs: number;
  readonly id: number;
}

function createHarness() {
  let now = 1_000;
  let nextTimerId = 1;
  const timers = new Map<number, ScheduledTimer>();
  const expired = vi.fn();
  const lifecycle = new OwnerSessionLifecycle(expired, {
    absoluteTtlMs: 100,
    clearTimer: (handle) => timers.delete(handle as unknown as number),
    idleTtlMs: 25,
    now: () => now,
    observedLeaseMs: 20,
    setTimer: (callback, delayMs) => {
      const id = nextTimerId;
      nextTimerId += 1;
      timers.set(id, { callback, delayMs, id });
      return id as unknown as ReturnType<typeof globalThis.setTimeout>;
    },
  });

  return {
    expired,
    lifecycle,
    pendingTimer() {
      expect(timers.size).toBe(1);
      return [...timers.values()][0] as ScheduledTimer;
    },
    runTimer() {
      const timer = this.pendingTimer();
      timers.delete(timer.id);
      timer.callback();
    },
    setNow(value: number) {
      now = value;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("OwnerSessionLifecycle", () => {
  it("credits minute-nine success from dispatch and expires at minute nineteen", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const expired = vi.fn();
    const lifecycle = new OwnerSessionLifecycle(expired);
    expect(lifecycle.beginFresh()).toBe(true);
    vi.advanceTimersByTime(9 * 60_000);
    const complete = lifecycle.captureAuthorizedActivity();
    expect(complete).toBeTypeOf("function");
    vi.advanceTimersByTime(30_000);
    expect(complete?.()).toBe(true);
    vi.advanceTimersByTime(30_000);
    expect(lifecycle.active).toBe(true);
    expect(expired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(9 * 60_000);
    expect(expired).toHaveBeenCalledExactlyOnceWith("idle_timeout");
    expect(lifecycle.active).toBe(false);
    expect(complete?.()).toBe(false);
  });

  it("does not credit capture alone or revive a lease after its idle deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const expired = vi.fn();
    const lifecycle = new OwnerSessionLifecycle(expired);
    expect(lifecycle.captureAuthorizedActivity()).toBeUndefined();
    lifecycle.beginFresh();
    vi.advanceTimersByTime(9 * 60_000);
    const complete = lifecycle.captureAuthorizedActivity();
    vi.advanceTimersByTime(60_000);
    expect(expired).toHaveBeenCalledExactlyOnceWith("idle_timeout");
    expect(complete?.()).toBe(false);
    expect(lifecycle.captureAuthorizedActivity()).toBeUndefined();
  });

  it.each([
    ["fresh", [9, 18, 27, 36, 45, 54, 59], 60],
    ["observed", [9], 10],
  ] as const)(
    "preserves the %s absolute ceiling after captured successes",
    (kind, minutes, ceiling) => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
      const expired = vi.fn();
      const lifecycle = new OwnerSessionLifecycle(expired);
      if (kind === "fresh") lifecycle.beginFresh();
      else lifecycle.beginObserved();
      for (const minute of minutes) {
        vi.advanceTimersByTime(minute * 60_000 - Date.now());
        const complete = lifecycle.captureAuthorizedActivity();
        vi.advanceTimersByTime(1_000);
        expect(complete?.()).toBe(true);
      }
      vi.advanceTimersByTime(ceiling * 60_000 - Date.now());
      expect(expired).toHaveBeenCalledExactlyOnceWith("absolute_timeout");
      expect(lifecycle.active).toBe(false);
    },
  );

  it("does not shorten newer activity when earlier requests finish out of order", () => {
    const harness = createHarness();
    harness.lifecycle.beginFresh();
    harness.setNow(1_005);
    const older = harness.lifecycle.captureAuthorizedActivity();
    harness.setNow(1_015);
    const newer = harness.lifecycle.captureAuthorizedActivity();
    harness.setNow(1_020);
    expect(newer?.()).toBe(true);
    harness.setNow(1_025);
    expect(older?.()).toBe(true);
    expect(harness.pendingTimer().delayMs).toBe(15);
    expect(older?.()).toBe(false);
    expect(newer?.()).toBe(false);
    harness.setNow(1_040);
    harness.runTimer();
    expect(harness.expired).toHaveBeenCalledExactlyOnceWith("idle_timeout");
  });

  it.each(["fresh", "observed", "deactivated"] as const)(
    "rejects old completions after the lease becomes %s",
    (replacement) => {
      const harness = createHarness();
      harness.lifecycle.beginFresh();
      harness.setNow(1_010);
      const complete = harness.lifecycle.captureAuthorizedActivity();
      harness.setNow(1_015);
      if (replacement === "fresh") harness.lifecycle.beginFresh();
      else if (replacement === "observed") harness.lifecycle.beginObserved();
      else harness.lifecycle.deactivate();
      expect(complete?.()).toBe(false);
      expect(harness.lifecycle.active).toBe(replacement !== "deactivated");
      expect(harness.expired).not.toHaveBeenCalled();
    },
  );

  it.each([1_009, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects a captured completion on an invalid or backward clock (%s)",
    (now) => {
      const harness = createHarness();
      harness.lifecycle.beginFresh();
      harness.setNow(1_010);
      const complete = harness.lifecycle.captureAuthorizedActivity();
      harness.setNow(now);
      expect(complete?.()).toBe(false);
      expect(complete?.()).toBe(false);
      expect(harness.expired).toHaveBeenCalledExactlyOnceWith("clock_invalid");
      expect(harness.lifecycle.active).toBe(false);
    },
  );

  it("checks a delayed completion even before the overdue timer is delivered", () => {
    const harness = createHarness();
    harness.lifecycle.beginFresh();
    harness.setNow(1_010);
    const complete = harness.lifecycle.captureAuthorizedActivity();
    harness.setNow(1_025);
    expect(complete?.()).toBe(false);
    expect(harness.expired).toHaveBeenCalledExactlyOnceWith("idle_timeout");
  });

  it("moves only the idle deadline after authorized activity", () => {
    const harness = createHarness();

    expect(harness.lifecycle.beginFresh()).toBe(true);
    expect(harness.pendingTimer().delayMs).toBe(25);

    harness.setNow(1_020);
    expect(harness.lifecycle.recordAuthorizedActivity()).toBe(true);
    expect(harness.pendingTimer().delayMs).toBe(25);

    harness.setNow(1_044);
    harness.runTimer();
    expect(harness.expired).not.toHaveBeenCalled();
    expect(harness.pendingTimer().delayMs).toBe(1);

    harness.setNow(1_045);
    harness.runTimer();
    expect(harness.expired).toHaveBeenCalledWith("idle_timeout");
  });

  it("never extends the absolute deadline", () => {
    const harness = createHarness();

    harness.lifecycle.beginFresh();
    for (const now of [1_020, 1_040, 1_060, 1_080]) {
      harness.setNow(now);
      harness.lifecycle.recordAuthorizedActivity();
    }
    expect(harness.pendingTimer().delayMs).toBe(20);

    harness.setNow(1_100);
    harness.runTimer();
    expect(harness.expired).toHaveBeenCalledWith("absolute_timeout");
    expect(harness.lifecycle.active).toBe(false);
  });

  it("bounds an already-observed cookie by the conservative lease", () => {
    const harness = createHarness();

    harness.lifecycle.beginObserved();
    expect(harness.pendingTimer().delayMs).toBe(20);
    harness.setNow(1_010);
    harness.lifecycle.recordAuthorizedActivity();
    expect(harness.pendingTimer().delayMs).toBe(10);

    harness.setNow(1_020);
    harness.runTimer();
    expect(harness.expired).toHaveBeenCalledWith("absolute_timeout");
  });

  it("fails closed when the wall clock rolls backward", () => {
    const harness = createHarness();

    harness.lifecycle.beginFresh();
    harness.setNow(999);

    expect(harness.lifecycle.check()).toBe(false);
    expect(harness.expired).toHaveBeenCalledWith("clock_invalid");
  });
});
