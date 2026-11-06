import { afterEach, expect, it, vi } from "vitest";
import { financialScreenRefinementFixture as fixture } from "./test-financial-screen-refinement-fixture";
import { FinancialScreenPassReviewController } from "./financial-screen-pass-review-controller";
import { TrialApiError } from "./api";

afterEach(() => vi.useRealTimers());
it("marks the retained reading stale after a same-handle continuation replaces its missing row", async () => {
  const f = await setup();
  f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
  const preview = f.controller.preview(f.controller.getSnapshot())!;
  const work = f.controller.run(preview);
  await vi.runAllTimersAsync();
  const settled = (await work)!;
  const current = f.screen.getSnapshot();
  const continuation = f.screen.captureContinuation(
    current,
    new Date().toISOString(),
  )!;
  const pending = continuation.run();
  expect(f.controller.getSnapshot().status).toBe("stale");
  await vi.runAllTimersAsync();
  await pending;
  expect(f.screen.getSnapshot().run!.handle).toBe(settled.result!.handle);
  expect(f.controller.getSnapshot().result).toBe(settled.result);
  expect(f.controller.getSnapshot().result).not.toBe(
    f.screen.getSnapshot().run,
  );
  expect(f.controller.getSnapshot().status).toBe("stale");
  f.controller.retire();
});
async function setup() {
  const f = await fixture();
  let valid = true;
  const owner = { isCurrent: () => valid };
  const captureOwner = vi.fn(() => owner);
  const controller = new FinancialScreenPassReviewController(f.screen, {
    captureOwner,
  });
  return {
    ...f,
    controller,
    owner,
    captureOwner,
    lose: () => {
      valid = false;
    },
    restore: () => {
      valid = true;
    },
  };
}
it("preview/cancel is passive and consumed previews never regain authority", async () => {
  const f = await setup(),
    original = f.screen.getSnapshot();
  const p = f.controller.preview(f.controller.getSnapshot())!;
  f.controller.cancel(p);
  const next = f.controller.preview(f.controller.getSnapshot())!;
  expect(await f.controller.run(p)).toBeNull();
  expect(next.plan).not.toBe(p.plan);
  expect(f.screen.getSnapshot()).toBe(original);
  expect(f.read).toHaveBeenCalledTimes(2);
  f.controller.retire();
});
it("retains settled packets through owned Research/Back but never substitutes an equal foreign run", async () => {
  const f = await setup();
  const p = f.controller.preview(f.controller.getSnapshot())!;
  const work = f.controller.run(p);
  await vi.runAllTimersAsync();
  const settled = (await work)!;
  expect(settled.status).toBe("settled");
  f.lose();
  f.screen.reconcile(f.digest, false, false);
  f.restore();
  f.screen.reconcile(f.digest, true, true);
  expect(f.controller.getSnapshot()).toBe(settled);
  const foreign = f.screen.run(f.screen.getSnapshot());
  expect(f.controller.getSnapshot().status).toBe("stale");
  expect(f.controller.getSnapshot().result).toBe(settled.result);
  await vi.runAllTimersAsync();
  await foreign;
  expect(f.controller.getSnapshot().result).toBe(settled.result);
  expect(f.controller.getSnapshot().result).not.toBe(
    f.screen.getSnapshot().run,
  );
  expect(await f.controller.run(p)).toBeNull();
  f.controller.retire();
});
it("retires authority after owner loss even when the same owner becomes available", async () => {
  const f = await setup(),
    p = f.controller.preview(f.controller.getSnapshot())!;
  f.lose();
  f.controller.reconcile();
  f.restore();
  expect(await f.controller.run(p)).toBeNull();
  expect(f.read).toHaveBeenCalledTimes(2);
  f.controller.retire();
});
it("subscriber cancellation before first dispatch cannot dispatch or revive", async () => {
  const f = await setup(),
    p = f.controller.preview(f.controller.getSnapshot())!;
  const off = f.controller.subscribe(() => {
    const state = f.controller.getSnapshot();
    if (state.status === "running") f.controller.cancel(state);
  });
  expect(await f.controller.run(p)).toBeNull();
  await vi.runAllTimersAsync();
  expect(f.read).toHaveBeenCalledTimes(2);
  off();
  f.controller.retire();
});
it("completion reentry preserves a newer preview instead of installing the old result", async () => {
  const f = await setup(),
    p = f.controller.preview(f.controller.getSnapshot())!;
  const work = f.controller.run(p);
  let replaced = false;
  const off = f.screen.subscribe(() => {
    if (!replaced && f.screen.canReviewPass(f.screen.getSnapshot())) {
      replaced = true;
      f.controller.preview(f.controller.getSnapshot());
    }
  });
  await vi.runAllTimersAsync();
  expect(await work).toBeNull();
  expect(replaced).toBe(true);
  expect(f.controller.getSnapshot().status).toBe("preview");
  expect(f.controller.getSnapshot().plan!.sourceRun).toBe(
    f.screen.getSnapshot().run,
  );
  expect(f.read).toHaveBeenCalledTimes(4);
  off();
  f.controller.retire();
});
it("owner withdrawal during pacing and explicit cancel preserve unattempted rows", async () => {
  const f = await setup(),
    p = f.controller.preview(f.controller.getSnapshot())!;
  const work = f.controller.run(p);
  f.lose();
  await vi.runAllTimersAsync();
  await work;
  expect(f.read).toHaveBeenCalledTimes(2);
  expect(f.controller.getSnapshot().result!.status).toBe("cancelled");
  expect(
    f.controller.getSnapshot().result!.rows.every((r) => r.report === null),
  ).toBe(true);
  expect(p.plan!.sourceRun.rows.every((r) => r.report?.response)).toBe(true);
  f.controller.retire();
});
