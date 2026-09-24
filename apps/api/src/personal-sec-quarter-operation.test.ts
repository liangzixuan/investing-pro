import { afterEach, describe, expect, it, vi } from "vitest";

import { PersonalSecQuarterOperation } from "./personal-sec-quarter-operation";

afterEach(() => vi.useRealTimers());

describe("SEC quarter operation deadline", () => {
  it("aborts queued or asynchronous work at the whole-operation deadline", () => {
    vi.useFakeTimers();
    const operation = new PersonalSecQuarterOperation(undefined, () => 0);
    vi.advanceTimersByTime(59_999);
    expect(operation.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(operation.signal.aborted).toBe(true);
    expect(() => operation.check()).toThrow(
      expect.objectContaining({ code: "operation_deadline" }),
    );
    operation.dispose();
  });

  it("detects synchronous overruns even before the timer gets a turn", () => {
    let now = 100;
    const operation = new PersonalSecQuarterOperation(undefined, () => now);
    now = 60_099;
    operation.check();
    now = 60_100;
    expect(() => operation.check()).toThrow(
      expect.objectContaining({ code: "operation_deadline" }),
    );
    expect(operation.signal.aborted).toBe(true);
    operation.dispose();
  });

  it.each([false, true])(
    "propagates parent cancellation (already aborted: %s)",
    (already) => {
      const parent = new AbortController();
      if (already) parent.abort();
      const operation = new PersonalSecQuarterOperation(parent.signal);
      if (!already) parent.abort();
      expect(operation.signal.aborted).toBe(true);
      expect(() => operation.check()).toThrow(
        expect.objectContaining({ code: "aborted" }),
      );
      operation.dispose();
    },
  );

  it("retires its timer and listener when disposed", () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    const operation = new PersonalSecQuarterOperation(parent.signal, () => 0);
    operation.dispose();
    parent.abort();
    vi.advanceTimersByTime(60_000);
    expect(operation.signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(() => operation.check()).toThrow(
      expect.objectContaining({ code: "aborted" }),
    );
  });

  it.each([NaN, Infinity, -Infinity])(
    "rejects invalid initial clocks (%s)",
    (now) => {
      expect(
        () => new PersonalSecQuarterOperation(undefined, () => now),
      ).toThrow(TypeError);
    },
  );

  it.each([NaN, Infinity, 9])(
    "rejects invalid or backward subsequent clocks (%s)",
    (next) => {
      let now = 10;
      const operation = new PersonalSecQuarterOperation(undefined, () => now);
      now = next;
      expect(() => operation.check()).toThrow(TypeError);
      expect(operation.signal.aborted).toBe(true);
      operation.dispose();
    },
  );
});
