import { afterEach, expect, it, vi } from "vitest";
import { financialScreenRefinementFixture as fixture } from "./test-financial-screen-refinement-fixture";
import { FinancialScreenContinuationController } from "./financial-screen-continuation-controller";

afterEach(() => vi.useRealTimers());
async function setup() {
  const f = await fixture("cancelled");
  let valid = true;
  const owner = { isCurrent: () => valid };
  const captureOwner = vi.fn(() => owner);
  const controller = new FinancialScreenContinuationController(f.screen, {
    captureOwner,
  });
  return {
    ...f,
    controller,
    owner,
    captureOwner,
    setValid: (next: boolean) => {
      valid = next;
    },
  };
}
it("preview/getters/cancel have no reads and stale handlers cannot run replacement previews", async () => {
  const f = await setup();
  const idle = f.controller.getSnapshot();
  expect(f.controller.getSnapshot()).toBe(idle);
  expect(f.captureOwner).not.toHaveBeenCalled();
  const preview = f.controller.preview(idle)!;
  expect(preview.canRun).toBe(true);
  expect(f.read).toHaveBeenCalledOnce();
  f.controller.cancel(preview);
  expect(await f.controller.run(preview)).toBeNull();
  const next = f.controller.preview(f.controller.getSnapshot())!;
  expect(await f.controller.run(preview)).toBeNull();
  expect(next.plan).not.toBe(preview.plan);
  expect(f.read).toHaveBeenCalledOnce();
  f.controller.retire();
});
it("settles one pass then keeps its complete passive reading through owned Research and Back", async () => {
  const f = await setup();
  const preview = f.controller.preview(f.controller.getSnapshot())!;
  const running = f.controller.run(preview);
  expect(await f.controller.run(preview)).toBeNull();
  await vi.runAllTimersAsync();
  const settled = await running;
  expect(settled!.status).toBe("settled");
  expect(settled!.result).toBe(f.screen.getSnapshot().run);
  expect(settled!.plan).toBe(preview.plan);
  f.setValid(false);
  f.screen.reconcile(f.digest, false, false);
  f.controller.reconcile();
  expect(f.controller.getSnapshot()).toBe(settled);
  f.setValid(true);
  f.screen.reconcile(f.digest, true, true);
  f.controller.reconcile();
  expect(f.controller.getSnapshot()).toBe(settled);
  expect(f.read).toHaveBeenCalledTimes(2);
  f.controller.retire();
});
it("permanently retires resource/file/route owner after observed loss despite equal restoration", async () => {
  const f = await setup();
  const preview = f.controller.preview(f.controller.getSnapshot())!;
  f.setValid(false);
  f.controller.reconcile();
  f.setValid(true);
  expect(f.controller.getSnapshot().status).toBe("stale");
  expect(await f.controller.run(preview)).toBeNull();
  expect(f.read).toHaveBeenCalledOnce();
  f.controller.retire();
});
it("cancels a waiting pass when its owner retires, with no source call or revived request", async () => {
  const f = await setup();
  const preview = f.controller.preview(f.controller.getSnapshot())!;
  const running = f.controller.run(preview);
  f.setValid(false);
  f.controller.reconcile();
  await running;
  await vi.runAllTimersAsync();
  const stale = f.controller.getSnapshot();
  expect(stale.status).toBe("stale");
  expect(stale.result!.continuations![0]!.status).toBe("cancelled");
  f.setValid(true);
  expect(await f.controller.run(preview)).toBeNull();
  expect(f.read).toHaveBeenCalledOnce();
  f.controller.retire();
});
it("independently checks owner at dispatch even without a reconcile notification", async () => {
  const f = await setup();
  const preview = f.controller.preview(f.controller.getSnapshot())!;
  const running = f.controller.run(preview);
  await vi.advanceTimersByTimeAsync(0);
  f.setValid(false);
  await vi.runAllTimersAsync();
  await running;
  expect(f.read).toHaveBeenCalledOnce();
  expect(f.screen.getSnapshot().run!.continuations![0]!.status).toBe(
    "cancelled",
  );
  f.controller.retire();
});
it("explicit running cancel retains completed packets and requires another preview", async () => {
  const f = await setup();
  const preview = f.controller.preview(f.controller.getSnapshot())!;
  const running = f.controller.run(preview);
  f.controller.cancel(f.controller.getSnapshot());
  await running;
  const cancelled = f.controller.getSnapshot();
  expect(cancelled.status).toBe("settled");
  expect(cancelled.plan).toBe(preview.plan);
  expect(cancelled.result!.rows[0]!.report).toBe(
    preview.plan!.sourceRun.rows[0]!.report,
  );
  expect(cancelled.canRun).toBe(false);
  expect(f.controller.preview(cancelled)!.plan!.requests).toEqual(
    preview.plan!.requests,
  );
  f.controller.retire();
});
it("does not attach a foreign fresh run to an older plan", async () => {
  const f = await setup();
  const preview = f.controller.preview(f.controller.getSnapshot())!;
  const running = f.screen.run(f.screen.getSnapshot());
  expect(f.controller.getSnapshot().status).toBe("stale");
  expect(f.controller.getSnapshot().result).toBeNull();
  f.screen.cancel();
  await running;
  expect(await f.controller.run(preview)).toBeNull();
  f.controller.retire();
});
it("refuses reentrant owner capture and publication replacement without overwriting a newer preview", async () => {
  const f = await setup();
  let nested = false;
  f.captureOwner.mockImplementation(() => {
    if (!nested) {
      nested = true;
      f.controller.preview(f.controller.getSnapshot());
    }
    return f.owner;
  });
  expect(f.controller.preview(f.controller.getSnapshot())).toBeNull();
  expect(f.controller.getSnapshot().status).toBe("preview");
  const chosen = f.controller.getSnapshot();
  let once = false;
  const off = f.controller.subscribe(() => {
    if (!once && f.controller.getSnapshot().status === "running") {
      once = true;
      f.controller.cancel(f.controller.getSnapshot());
    }
  });
  expect(await f.controller.run(chosen)).toBeNull();
  await vi.runAllTimersAsync();
  expect(f.read).toHaveBeenCalledOnce();
  off();
  f.controller.retire();
});
it("retirement fences pending work and leaves no callback authority", async () => {
  const f = await setup();
  const p = f.controller.preview(f.controller.getSnapshot())!;
  const run = f.controller.run(p);
  f.controller.retire();
  await run;
  await vi.runAllTimersAsync();
  expect(f.controller.getSnapshot().status).toBe("idle");
  expect(await f.controller.run(p)).toBeNull();
  expect(f.read).toHaveBeenCalledOnce();
});
