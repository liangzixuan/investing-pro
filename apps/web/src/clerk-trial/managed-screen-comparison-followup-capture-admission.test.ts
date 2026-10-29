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

describe("comparison capture baseline admission", () => {
  it.each(["retired", "unavailable"])(
    "keeps %s refusal ahead of revision and report reads",
    async (state) => {
      const f = await fixture();
      if (state === "retired") f.context.retire();
      else f.state.available = false;
      const revision = vi.spyOn(f.host, "revision");
      const report = vi.spyOn(f.screen.model, "captureComparisonReport");
      const selection = vi.fn(() => true);
      expect(
        f.context.capture(new Date().toISOString(), selection).capture,
      ).toBeNull();
      expect(revision).not.toHaveBeenCalled();
      expect(report).not.toHaveBeenCalled();
      expect(selection).not.toHaveBeenCalled();
    },
  );
  it("does not absorb navigation changed by a selection callback after capture begins", async () => {
    const f = await fixture();
    const selection = vi.fn(() => {
      f.state.navigation++;
      return true;
    });
    const result = f.context.capture(new Date().toISOString(), selection);
    expect(result.capture).toBeNull();
    expect(selection).toHaveBeenCalledOnce();
    expect(f.api.loadFollowups).not.toHaveBeenCalled();
  });
  it("refuses a capture when its selection callback throws", async () => {
    const f = await fixture();
    const selection = vi.fn(() => {
      throw new Error("invented selection failure");
    });
    const result = f.context.capture(new Date().toISOString(), selection);
    expect(result.capture).toBeNull();
    expect(selection).toHaveBeenCalledOnce();
    expect(f.api.loadFollowups).not.toHaveBeenCalled();
  });
});
