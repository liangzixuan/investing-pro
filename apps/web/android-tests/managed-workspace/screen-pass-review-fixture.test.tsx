import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ScreenPassReviewFixtureControls } from "./screen-pass-review-fixture-controls";
import { screenPassReviewWorkspaceFixture } from "./test-screen-pass-review-workspace";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => {
  const { createValuationDraftTestHooks } =
    await import("../../src/clerk-trial/valuation-draft-files-test-hooks");
  return {
    ...(await original<typeof React>()),
    ...createValuationDraftTestHooks(hooks),
  };
});
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
});
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  owners.splice(0).forEach((w) => w.sessionOwner.dispose());
  vi.useRealTimers();
});
function render(workspace: ManagedWorkspace) {
  hooks.index = 0;
  const tree = ScreenPassReviewFixtureControls({ workspace }),
    $ = load(renderToStaticMarkup(tree));
  const data = JSON.parse($("#fixture-screen-pass-review").text()) as {
    original: { run: { rawRows: unknown[] } } | null;
    after: { run: { rawRows: unknown[] } } | null;
    sameSourceHandle: boolean;
    sameAppliedRun: boolean;
    sameResource: boolean;
  };
  const click = (id: string) => {
    const children = (
      tree as React.ReactElement<{ children?: React.ReactNode }>
    ).props.children;
    const button = React.Children.toArray(children).find(
      (child) =>
        React.isValidElement<{ id?: string }>(child) && child.props.id === id,
    ) as React.ReactElement<{ disabled: boolean; onClick: () => void }>;
    expect(button.props.disabled).toBe(false);
    button.props.onClick();
  };
  return { data, click };
}
it("captures exact full previous/current serialized rows for the native raw disclosure predicate, without mutating the screen or resource", async () => {
  const f = await screenPassReviewWorkspaceFixture();
  owners.push(f.w);
  const original = f.screen.getSnapshot();
  expect(render(f.w).data.original).toBeNull();
  render(f.w).click("fixture-pass-review-capture-before");
  const before = render(f.w).data;
  expect(before.original!.run.rawRows).toEqual(
    JSON.parse(JSON.stringify(original.run!.rows)),
  );
  expect(f.screen.getSnapshot()).toBe(original);
  const token = f.screen.capturePassReview(original, new Date().toISOString())!;
  const work = token.run();
  await vi.advanceTimersByTimeAsync(20000);
  await vi.waitFor(() =>
    expect(f.screen.getSnapshot().run!.rows[0]!.evaluation).not.toBeNull(),
  );
  await vi.advanceTimersByTimeAsync(20000);
  await work;
  const current = f.screen.getSnapshot();
  render(f.w).click("fixture-pass-review-capture-after");
  const after = render(f.w).data;
  expect(after.original).toEqual(before.original);
  expect(after.after!.run.rawRows).toEqual(
    JSON.parse(JSON.stringify(current.run!.rows)),
  );
  expect(after).toMatchObject({
    sameSourceHandle: false,
    sameAppliedRun: true,
    sameResource: true,
  });
  expect(f.screen.getSnapshot()).toBe(current);
  expect(f.w.coordinator.getSnapshot()).toBe(f.resource);
  const compare = (value: unknown) =>
    JSON.stringify(value) === JSON.stringify(after.after!.run.rawRows[0]);
  const raw = JSON.parse(JSON.stringify(current.run!.rows[0])) as Record<
    string,
    unknown
  >;
  expect(compare(raw)).toBe(true);
  expect(compare({ ...raw, evaluation: null })).toBe(false);
  expect(compare({ ...raw, attempt: null })).toBe(false);
  expect(
    compare({ ...raw, evaluatedAt: original.run!.rows[0]!.evaluatedAt }),
  ).toBe(false);
});
