import {
  MANAGED_BLS_CALENDAR_SOURCE,
  type ManagedBlsCalendarDto,
} from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BlsReleaseProvider } from "./bls-release-provider";
import { createManagedBlsCalendarService } from "./managed-bls-calendar-service";

function agenda(): ManagedBlsCalendarDto {
  return {
    schemaVersion: "1.0.0",
    source: MANAGED_BLS_CALENDAR_SOURCE,
    fetchedAt: "2026-10-11T12:00:00.000Z",
    window: {
      fromInclusive: "2026-10-11T12:00:00.000Z",
      toExclusive: "2026-11-10T12:00:00.000Z",
    },
    events: [
      { series: "Invented series", scheduledAt: "2026-10-12T12:30:00.000Z" },
    ],
  };
}
function fixture(
  load: BlsReleaseProvider["load"] = () => Promise.resolve(agenda()),
) {
  let elapsed = 0;
  const provider = { load: vi.fn(load), close: vi.fn() };
  const createProvider = vi.fn(() => provider);
  const service = createManagedBlsCalendarService({
    startedAt: 0,
    monotonic: () => elapsed,
    createProvider,
  });
  return {
    service,
    provider,
    createProvider,
    elapsed: (value: number) => {
      elapsed = value;
    },
  };
}
afterEach(() => vi.useRealTimers());

describe("managed BLS calendar service lifetime", () => {
  it("constructs no provider until load, owns its response, closes it, and rejects another load in the invocation", async () => {
    const source = agenda();
    const f = fixture(() => Promise.resolve(source));
    expect(f.createProvider).not.toHaveBeenCalled();
    const result = await f.service.load(new AbortController().signal);
    expect(result).toEqual(source);
    expect(result).not.toBe(source);
    expect(result.events).not.toBe(source.events);
    expect(Object.isFrozen(result.events[0])).toBe(true);
    expect(f.provider.load).toHaveBeenCalledOnce();
    expect(f.provider.load.mock.calls[0]![0]!.aborted).toBe(true);
    expect(f.provider.close).toHaveBeenCalledOnce();
    await expect(
      f.service.load(new AbortController().signal),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(f.createProvider).toHaveBeenCalledOnce();
  });
  it.each([-1, 10_000, 20_000, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid or exhausted entry lifetime (%s) before provider construction",
    async (elapsed) => {
      const f = fixture();
      f.elapsed(elapsed);
      await expect(
        f.service.load(new AbortController().signal),
      ).rejects.toMatchObject({ code: "request_timeout" });
      expect(f.createProvider).not.toHaveBeenCalled();
    },
  );
  it("spends only the time remaining after authentication and closes an uncooperative provider", async () => {
    vi.useFakeTimers();
    const f = fixture(() => new Promise(() => undefined));
    f.elapsed(6_000);
    const loading = f.service.load(new AbortController().signal);
    const rejected = expect(loading).rejects.toMatchObject({
      code: "request_timeout",
    });
    await vi.advanceTimersByTimeAsync(3_999);
    expect(f.provider.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(f.provider.load).toHaveBeenCalledOnce();
    expect(f.provider.load.mock.calls[0]![0]!.aborted).toBe(true);
    expect(f.provider.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects pre-aborted requests without a provider and aborts active work with no late publication", async () => {
    const caller = new AbortController();
    caller.abort();
    const untouched = fixture();
    await expect(untouched.service.load(caller.signal)).rejects.toMatchObject({
      code: "request_timeout",
    });
    expect(untouched.createProvider).not.toHaveBeenCalled();
    let finish!: (result: ManagedBlsCalendarDto) => void;
    const f = fixture(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const active = new AbortController();
    const loading = f.service.load(active.signal);
    const rejected = expect(loading).rejects.toMatchObject({
      code: "request_timeout",
    });
    active.abort();
    await rejected;
    expect(f.provider.close).toHaveBeenCalledOnce();
    expect(f.provider.load.mock.calls[0]![0]!.aborted).toBe(true);
    finish(agenda());
    await Promise.resolve();
    await expect(loading).rejects.toMatchObject({ code: "request_timeout" });
  });
  it.each(["provider", "invalid", "late"] as const)(
    "sanitizes %s failure and closes the provider",
    async (failure) => {
      const f = fixture(() => {
        if (failure === "provider") throw new Error("private-provider-details");
        if (failure === "late") f.elapsed(10_000);
        return Promise.resolve(
          failure === "invalid"
            ? { ...agenda(), private: "provider-field" }
            : agenda(),
        );
      });
      await expect(
        f.service.load(new AbortController().signal),
      ).rejects.toMatchObject({
        code: failure === "late" ? "request_timeout" : "unavailable",
        message: failure === "late" ? "request_timeout" : "unavailable",
      });
      expect(f.provider.close).toHaveBeenCalledOnce();
    },
  );
});
