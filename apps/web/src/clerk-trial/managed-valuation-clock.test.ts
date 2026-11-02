import { afterEach, describe, expect, it, vi } from "vitest";
import { eodSelection } from "./eod-history-fixture";
import {
  ManagedValuationWorkbench,
  evaluateValuationInputs,
} from "./managed-valuation-workbench";
afterEach(() => vi.useRealTimers());
describe("explicit valuation calculation metadata", () => {
  it("records Calculate time once and denies passive, replaced and retired calculations", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    const model = new ManagedValuationWorkbench();
    model.activate(eodSelection);
    const source = model.getSnapshot();
    const passive = evaluateValuationInputs(
      eodSelection,
      source.dcfDraft,
      source.exitDraft,
    );
    expect(model.captureCalculationMetadata(passive)).toBeNull();
    const first = model.calculate()!;
    expect(model.captureCalculationMetadata(first)).toEqual({
      evaluatedAt: "2026-11-02T12:00:00.000Z",
    });
    vi.setSystemTime(new Date("2026-11-02T13:00:00Z"));
    expect(model.captureCalculationMetadata(first)!.evaluatedAt).toBe(
      "2026-11-02T12:00:00.000Z",
    );
    const second = model.calculate()!;
    expect(model.captureCalculationMetadata(first)).toBeNull();
    expect(model.captureCalculationMetadata(second)!.evaluatedAt).toBe(
      "2026-11-02T13:00:00.000Z",
    );
    model.setDcfField("waccPercent", "10");
    expect(model.captureCalculationMetadata(second)).toBeNull();
    model.retire();
    expect(model.captureCalculationMetadata(second)).toBeNull();
  });
  it("does not expose an action-owned timestamp after reentrant input replacement", () => {
    const model = new ManagedValuationWorkbench();
    model.activate(eodSelection);
    let replaced = false;
    model.subscribe(() => {
      if (!replaced && model.getSnapshot().calculation) {
        replaced = true;
        model.setDcfField("waccPercent", "11");
      }
    });
    expect(model.calculate()).toBeNull();
    expect(model.getSnapshot().calculation).toBeNull();
  });
});
