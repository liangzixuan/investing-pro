import { it, expect, vi } from "vitest";
import { ManagedCpiHeadlines } from "./managed-cpi-headlines";
import { cpiHeadlinesFixture } from "./cpi-headlines-fixture";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
function held<T>() {
  let resolve!: (x: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function fixture() {
  const read = vi
    .fn<ManagedApi["cpiHeadlines"]>()
    .mockResolvedValue(cpiHeadlinesFixture());
  const error = vi.fn();
  return { read, error, model: new ManagedCpiHeadlines(read, error) };
}
it("starts without a read and preserves both raw feed clocks and unknowns through one explicit load", async () => {
  const f = fixture();
  f.model.enter();
  expect(f.read).not.toHaveBeenCalled();
  await f.model.load();
  expect(f.read).toHaveBeenCalledOnce();
  expect(f.model.getSnapshot().headlines).toEqual(cpiHeadlinesFixture());
  expect(Object.isFrozen(f.model.getSnapshot().headlines!.items[0])).toBe(true);
});
it("retains original packet/clocks through failure and cancellation and admits checked-empty", async () => {
  const f = fixture();
  await f.model.load();
  const previous = f.model.getSnapshot().headlines;
  f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
  expect(await f.model.load()).toBe("failed");
  expect(f.model.getSnapshot()).toMatchObject({
    headlines: previous,
    showingPrevious: true,
    error: "unavailable",
  });
  const pending = held<ReturnType<typeof cpiHeadlinesFixture>>();
  f.read.mockReturnValueOnce(pending.promise);
  const result = f.model.load();
  f.model.cancel();
  pending.resolve({
    ...cpiHeadlinesFixture(),
    fetchedAt: "2026-10-29T00:00:00.000Z",
  });
  expect(await result).toBe("cancelled");
  expect(f.model.getSnapshot().headlines).toBe(previous);
  f.read.mockResolvedValueOnce({
    ...cpiHeadlinesFixture(),
    availableItemCount: 0,
    items: [],
  });
  await f.model.load();
  expect(f.model.getSnapshot()).toMatchObject({
    showingPrevious: false,
    headlines: { items: [], availableItemCount: 0 },
  });
});
it("refuses malformed packets without replacing a previous complete packet", async () => {
  const f = fixture();
  await f.model.load();
  const previous = f.model.getSnapshot().headlines;
  f.read.mockResolvedValueOnce({
    ...cpiHeadlinesFixture(),
    items: [
      {
        ...cpiHeadlinesFixture().items[0]!,
        publishedAt: "2026-02-30T00:00:00Z",
      },
    ],
  });
  expect(await f.model.load()).toBe("failed");
  expect(f.model.getSnapshot()).toMatchObject({
    headlines: previous,
    error: "invalid_response",
    showingPrevious: true,
  });
});
it.each(["leave", "retire"] as const)(
  "fences late completion after %s without hidden reads",
  async (boundary) => {
    const f = fixture();
    const pending = held<ReturnType<typeof cpiHeadlinesFixture>>();
    f.read.mockReturnValueOnce(pending.promise);
    const load = f.model.load();
    f.model[boundary]();
    pending.resolve(cpiHeadlinesFixture());
    await load;
    expect(f.model.getSnapshot().headlines).toBeNull();
    expect(f.read).toHaveBeenCalledOnce();
    if (boundary === "retire") expect(await f.model.load()).toBe("retired");
    else expect(await f.model.load()).toBe("not_started");
  },
);
it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
  "retires source state on %s without leaking error text",
  async (code) => {
    const f = fixture();
    await f.model.load();
    f.read.mockRejectedValueOnce(new TrialApiError(code));
    expect(await f.model.load()).toBe("retired");
    expect(f.error).toHaveBeenCalledOnce();
    expect(f.model.getSnapshot().headlines).toBeNull();
  },
);
it("does not reenter a request from begin-load notifications", async () => {
  const f = fixture();
  const calls: Promise<unknown>[] = [];
  const stop = f.model.subscribe(() => {
    if (f.model.getSnapshot().busy) calls.push(f.model.load());
  });
  await f.model.load();
  stop();
  await Promise.all(calls);
  expect(f.read).toHaveBeenCalledOnce();
});
it("keeps a new request busy when an old abort listener starts it", async () => {
  const f = fixture();
  const a = held<ReturnType<typeof cpiHeadlinesFixture>>();
  const b = held<ReturnType<typeof cpiHeadlinesFixture>>();
  let next: Promise<unknown> | undefined;
  f.read
    .mockImplementationOnce((signal) => {
      signal!.addEventListener("abort", () => {
        next = f.model.load();
      });
      return a.promise;
    })
    .mockReturnValueOnce(b.promise);
  const first = f.model.load();
  f.model.cancel();
  expect(f.model.getSnapshot().busy).toBe(true);
  a.resolve(cpiHeadlinesFixture());
  await first;
  b.resolve(cpiHeadlinesFixture());
  await next;
  expect(f.model.getSnapshot().busy).toBe(false);
  expect(f.read).toHaveBeenCalledTimes(2);
});
