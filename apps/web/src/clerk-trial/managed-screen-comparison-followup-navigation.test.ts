import { afterEach, describe, expect, it, vi } from "vitest";
import {
  comparisonFollowupFixture,
  disposeComparisonFollowupFixture,
} from "./managed-screen-comparison-followup-fixture";

const fixtures: Awaited<ReturnType<typeof comparisonFollowupFixture>>[] = [];
async function fixture() {
  const f = await comparisonFollowupFixture(false);
  fixtures.push(f);
  return f;
}
afterEach(() => {
  for (const f of fixtures.splice(0)) disposeComparisonFollowupFixture(f);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("explicit comparison capture navigation baseline", () => {
  it("retains a fresh capture through initial Load after an unpublished pre-capture navigation revision", async () => {
    const f = await fixture();
    f.state.navigation++;
    const source = f.capture();
    expect(source.isCurrent()).toBe(true);
    expect(f.context.canLoad(source, "left")).toBe(true);
    expect(f.api.loadFollowups).not.toHaveBeenCalled();
    await f.context.load(source, "left", () => true);
    expect(f.api.loadFollowups).toHaveBeenCalledOnce();
    expect(source.isCurrent()).toBe(true);
    expect(f.context.retirementReason(source)).toBeNull();
    expect(f.context.capturePort(source, "left").port?.isCurrent()).toBe(true);
    expect(f.source.isCurrent()).toBe(false);
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(f.watchlistSave).not.toHaveBeenCalled();
  });
  it.each(["unpublished", "published"])(
    "permanently retires a captured source on an observed %s post-capture navigation ABA",
    async (publication) => {
      const f = await fixture();
      const source = f.capture();
      f.state.navigation++;
      if (publication === "published") f.updates.emit();
      expect(source.isCurrent()).toBe(false);
      f.state.navigation--;
      if (publication === "published") f.updates.emit();
      expect(source.isCurrent()).toBe(false);
      expect(f.context.retirementReason(source)).toBe(
        "Navigation or the catalog context changed.",
      );
      await f.context.load(source, "left", () => true);
      expect(f.api.loadFollowups).not.toHaveBeenCalled();
      expect(f.context.capturePort(source, "left").port).toBeNull();
    },
  );
  it("synchronizes a later explicit capture without reviving a previously retired capture", async () => {
    const f = await fixture();
    const old = f.source;
    f.state.navigation++;
    expect(old.isCurrent()).toBe(false);
    const current = f.capture();
    expect(current.isCurrent()).toBe(true);
    await f.context.load(current, "right", () => true);
    expect(current.isCurrent()).toBe(true);
    expect(f.api.loadFollowups).toHaveBeenCalledOnce();
    expect(old.isCurrent()).toBe(false);
    expect(f.context.retirementReason(old)).toBe(
      "Navigation or the catalog context changed.",
    );
  });
});
