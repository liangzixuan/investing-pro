import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useScreenComparisonFollowupReview,
  type ScreenComparisonFollowupProps,
} from "./use-screen-comparison-followup-review";
import {
  comparisonFollowupFixture,
  disposeComparisonFollowupFixture,
} from "./managed-screen-comparison-followup-fixture";
import type { ValuationTestEffectSlot } from "./valuation-draft-files-test-hooks";

const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  return { ...actual, ...createValuationDraftTestHooks(hooks) };
});
let close: (() => void) | null = null;
afterEach(() => {
  for (const slot of hooks.slots)
    (slot as ValuationTestEffectSlot | undefined)?.cleanup?.();
  close?.();
  close = null;
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  vi.restoreAllMocks();
});
function render(props: ScreenComparisonFollowupProps) {
  hooks.index = 0;
  return useScreenComparisonFollowupReview(props);
}
function commit() {
  hooks.effects.splice(0).forEach((effect) => effect());
}
function committed(props: ScreenComparisonFollowupProps) {
  const value = render(props);
  commit();
  return value;
}
async function fixture() {
  const f = await comparisonFollowupFixture();
  Object.defineProperty(f.host.workspace, "screenComparisonFollowup", {
    value: f.context,
  });
  close = () => disposeComparisonFollowupFixture(f);
  const props = {
    workspace: f.host.workspace,
    routeActive: () => true,
    navigationPending: false,
    onReview: vi.fn(),
  };
  committed(props);
  return { ...f, props };
}

describe("committed comparison check event ports", () => {
  it("keeps pre-commit, superseded-render and hidden retained action handlers inert", async () => {
    const f = await fixture();
    const uncommitted = render(f.props);
    uncommitted.setOpen(true);
    expect(render(f.props).state.open).toBe(false);
    commit();
    committed(f.props).setOpen(true);
    const opened = committed(f.props);
    opened.capture();
    const captured = committed(f.props);
    expect(captured.state.capture).not.toBeNull();
    captured.edit("question", "Raw authored question");
    captured.edit("dueOn", "2026-12-31");
    expect(committed(f.props).state.dueOn).toBe("");
    const closeForm = committed(f.props);
    closeForm.setOpen(false);
    closeForm.capture();
    closeForm.prepare();
    closeForm.create();
    expect(committed(f.props).state).toMatchObject({
      open: false,
      capture: null,
      preview: null,
      question: "Raw authored question",
    });
    expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([]);
  });

  it("withdraws an existing capture when pending navigation commits and prevents resurrection", async () => {
    const f = await fixture();
    committed(f.props).setOpen(true);
    committed(f.props).capture();
    const previous = committed(f.props);
    expect(previous.state.capture).not.toBeNull();
    const pending = { ...f.props, navigationPending: true };
    expect(render(pending).canCapture).toBe(false);
    commit();
    previous.prepare();
    expect(committed(pending).state.capture).toBeNull();
    expect(committed(f.props).state.capture).toBeNull();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(f.watchlistSave).not.toHaveBeenCalled();
  });
});
