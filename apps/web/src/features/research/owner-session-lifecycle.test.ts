import { describe, expect, it, vi } from "vitest";

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

describe("OwnerSessionLifecycle", () => {
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
