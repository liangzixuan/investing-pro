import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialScreenRefinementController } from "./financial-screen-refinement-controller";
import {
  financialScreenRefinementFixture as fixture,
  refinedCriteria,
  refinementTime,
} from "./test-financial-screen-refinement-fixture";
afterEach(() => vi.useRealTimers());
async function setup() {
  const f = await fixture();
  let owner = Symbol();
  let available = true;
  const model = new FinancialScreenRefinementController(f.screen, {
    captureOwner: () => {
      const captured = owner;
      return available
        ? { isCurrent: () => available && owner === captured }
        : null;
    },
    now: () => new Date(refinementTime),
  });
  return {
    ...f,
    model,
    replace: () => {
      owner = Symbol();
      model.reconcile();
    },
    pause: () => {
      available = false;
      model.reconcile();
    },
    resume: () => {
      available = true;
      model.reconcile();
    },
  };
}
describe("filter refinement controller lifetime", () => {
  it("keeps getters and preview passive, then consumes the accepted installation once", async () => {
    const f = await setup();
    const before = f.screen.getSnapshot();
    const initial = f.model.getSnapshot();
    expect(f.model.getSnapshot()).toBe(initial);
    const preview = f.model.preview(initial, refinedCriteria)!;
    expect(preview.status).toBe("preview");
    expect(preview.reading!.evaluatedAt).toBe(refinementTime);
    expect(f.screen.getSnapshot()).toBe(before);
    const installed = f.model.apply(preview)!;
    expect(installed).toBe(f.screen.getSnapshot());
    expect(f.model.getSnapshot().status).toBe("applied");
    expect(f.model.apply(preview)).toBeNull();
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.resolve).toHaveBeenCalledOnce();
    f.model.retire();
  });
  it("cancel and replacement permanently retire old preview handlers", async () => {
    const f = await setup();
    const first = f.model.preview(f.model.getSnapshot(), refinedCriteria)!;
    f.model.cancel(first);
    expect(f.model.apply(first)).toBeNull();
    const second = f.model.preview(f.model.getSnapshot(), refinedCriteria)!;
    const third = f.model.preview(second, {
      clauses: [],
      sort: { field: "symbol", direction: "asc" },
    })!;
    expect(f.model.apply(second)).toBeNull();
    expect(f.model.apply(third)).not.toBeNull();
    f.model.retire();
  });
  it("requires the external owner lease and never revives after equal state restoration", async () => {
    const f = await setup();
    const preview = f.model.preview(f.model.getSnapshot(), refinedCriteria)!;
    f.replace();
    expect(f.model.getSnapshot().status).toBe("stale");
    expect(f.model.getSnapshot().reading).toBe(preview.reading);
    expect(f.model.apply(preview)).toBeNull();
    f.model.retire();
  });
  it("observed unavailability retires a preview even after availability returns", async () => {
    const f = await setup();
    const p = f.model.preview(f.model.getSnapshot(), refinedCriteria)!;
    f.pause();
    f.resume();
    expect(f.model.getSnapshot().canApply).toBe(false);
    expect(f.model.apply(p)).toBeNull();
    f.model.retire();
  });
  it("reconciles source changes and refuses stale snapshots for preview/cancel/apply", async () => {
    const f = await setup();
    const old = f.model.getSnapshot();
    const p = f.model.preview(old, refinedCriteria)!;
    f.screen.stageCriteria(f.screen.getSnapshot());
    const stale = f.model.getSnapshot();
    expect(stale.status).toBe("stale");
    expect(f.model.preview(old, refinedCriteria)).toBeNull();
    f.model.cancel(p);
    expect(f.model.getSnapshot()).toBe(stale);
    expect(f.model.apply(p)).toBeNull();
    f.model.retire();
  });
  it("withdraws the previous preview even when replacement input is invalid", async () => {
    const f = await setup();
    const first = f.model.preview(f.model.getSnapshot(), refinedCriteria)!;
    const invalid = f.model.preview(first, {})!;
    expect(invalid.canApply).toBe(false);
    expect(f.model.apply(first)).toBeNull();
    f.model.retire();
  });
  it("cannot install an older action after capture-owner reentry", async () => {
    const f = await fixture();
    let reenter = true;
    const model: FinancialScreenRefinementController =
      new FinancialScreenRefinementController(f.screen, {
        captureOwner: () => {
          if (reenter) {
            reenter = false;
            model.preview(model.getSnapshot(), {
              clauses: [],
              sort: { field: "symbol", direction: "asc" },
            });
          }
          return { isCurrent: () => true };
        },
      });
    expect(model.preview(model.getSnapshot(), refinedCriteria)).toBeNull();
    expect(model.getSnapshot().reading!.unchanged).toBe(true);
    model.retire();
  });
  it("cannot replay Apply from screen listeners or overwrite a new controller preview", async () => {
    const f = await setup();
    const p = f.model.preview(f.model.getSnapshot(), refinedCriteria)!;
    let replay: unknown;
    const off = f.screen.subscribe(() => {
      replay = f.model.apply(p);
      f.model.preview(f.model.getSnapshot(), {
        clauses: [],
        sort: { field: "symbol", direction: "asc" },
      });
    });
    expect(f.model.apply(p)).toBeNull();
    expect(replay).toBeNull();
    expect(f.model.getSnapshot().status).toBe("preview");
    off();
    f.model.retire();
  });
  it("rejects a clock callback that replaces the captured screen", async () => {
    const f = await fixture();
    const model = new FinancialScreenRefinementController(f.screen, {
      captureOwner: () => ({ isCurrent: () => true }),
      now: () => {
        f.screen.stageCriteria(f.screen.getSnapshot());
        return new Date(refinementTime);
      },
    });
    expect(model.preview(model.getSnapshot(), refinedCriteria)?.canApply).toBe(
      false,
    );
    model.retire();
  });
  it("retirement during publication prevents a claimed current installation", async () => {
    const f = await setup();
    const p = f.model.preview(f.model.getSnapshot(), refinedCriteria)!;
    const off = f.model.subscribe(() => f.model.retire());
    expect(f.model.apply(p)).toBeNull();
    off();
    expect(f.model.getSnapshot().status).toBe("idle");
  });
  it("does not claim a current result if publication replaces the external owner", async () => {
    const f = await setup();
    const p = f.model.preview(f.model.getSnapshot(), refinedCriteria)!;
    const off = f.model.subscribe(() => f.replace());
    expect(f.model.apply(p)).toBeNull();
    expect(f.screen.getSnapshot().run!.refinedAt).toBe(refinementTime);
    off();
    f.model.retire();
  });
});
