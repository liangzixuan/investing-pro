import * as React from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
import { ManagedMarketsBriefing } from "./ManagedMarketsBriefing";
import { ManagedMarketsBriefingReading } from "./ManagedMarketsBriefingReading";
import { prepareCalendarFollowup } from "./managed-calendar-followup";
import { cpiHeadlinesFixture } from "./cpi-headlines-fixture";
import type { ManagedApi } from "./managed-api";
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
const workspaces: ManagedWorkspace[] = [];
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
});
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
});
interface NodeProps {
  id?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
}
function elements(node: React.ReactNode): React.ReactElement<NodeProps>[] {
  if (!React.isValidElement<NodeProps>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children).flatMap(elements),
  ];
}
async function fixture() {
  const base = await createFixture("research-followups");
  const packet = cpiHeadlinesFixture();
  const api: ManagedApi = {
    ...base.api,
    cpiHeadlines: vi.fn<ManagedApi["cpiHeadlines"]>().mockResolvedValue(packet),
    resolve: vi.fn(base.api.resolve),
    eodHistory: vi.fn(base.api.eodHistory),
    blsCalendar: vi.fn(base.api.blsCalendar),
    economicCalendar: vi.fn(base.api.economicCalendar),
    monetaryAnnouncements: vi.fn(base.api.monetaryAnnouncements),
    loadFollowups: vi.fn(base.followups!.api.loadFollowups),
    saveFollowups: vi.fn(base.followups!.api.saveFollowups),
  };
  const workspace = new ManagedWorkspace(
    api,
    base.followups!.nextSession(),
    undefined,
    {
      researchCoverage: base.researchCoverage,
      priceCoverage: base.priceCoverage,
      marketsCohort: base.marketsCohort,
    },
  );
  workspaces.push(workspace);
  await workspace.refreshCatalog();
  await workspace.coordinator.load();
  await workspace.cpiHeadlines.load();
  const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
  const capture = workspace.captureCpiHeadlineSource(
    packet.items[0]!.url,
    () => true,
  ).capture!;
  expect(capture).not.toBeNull();
  await workspace.loadMarketsCalendarFollowups(capture, member, () => true);
  const port = workspace.captureMarketsCalendarFollowup(capture, member).port!;
  const prepared = prepareCalendarFollowup(
    port,
    "Inspect this retained source.",
    "2026-12-31",
    () => true,
  ).preview!;
  const entry = prepared.create()!;
  const review = workspace.reviewMarketsBriefingFollowup(entry, capture, () => {
    workspace.setView("followups");
    return true;
  });
  expect(review).not.toBeNull();
  const reading = workspace.getMarketsBriefingReading();
  expect(reading).not.toBeNull();
  const focus = vi.fn();
  const navigate = vi.fn(() => {
    workspace.setView("markets");
    return true;
  });
  const render = (navigationPending = false, commit = true) => {
    hooks.index = 0;
    hooks.effects = [];
    const tree = ManagedMarketsBriefing({
      workspace,
      navigationPending,
      navigate,
    });
    const nodes = elements(tree);
    const reader = nodes.find(
      (node) => node.type === ManagedMarketsBriefingReading,
    );
    if (reader?.props.headingRef)
      reader.props.headingRef.current = {
        focus,
      } as unknown as HTMLHeadingElement;
    if (commit) hooks.effects.forEach((effect) => effect());
    return {
      tree,
      nodes,
      byId: (id: string) => {
        const node = nodes.find((n) => n.props.id === id);
        if (!node) throw new Error(id);
        return node;
      },
    };
  };
  return { workspace, api, render, focus, navigate, reading };
}
it("returns to the exact reading without another read and focuses only after its owned commit", async () => {
  const f = await fixture();
  const before = vi.mocked(f.api.resolve).mock.calls.length;
  const start = f.render();
  expect(f.focus).not.toHaveBeenCalled();
  start.byId("markets-briefing-return").props.onClick!();
  expect(f.workspace.getSnapshot().view).toBe("markets");
  expect(f.workspace.getMarketsBriefingReading()).toBe(f.reading);
  expect(f.focus).not.toHaveBeenCalled();
  const returned = f.render(false, false);
  expect(f.focus).not.toHaveBeenCalled();
  hooks.effects.forEach((effect) => effect());
  expect(f.focus).toHaveBeenCalledOnce();
  expect(f.api.cpiHeadlines).toHaveBeenCalledOnce();
  expect(f.api.resolve).toHaveBeenCalledTimes(before);
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  const text = renderToStaticMarkup(returned.tree);
  expect(text).toContain("Retained Markets briefing");
  expect(text).not.toContain("Create follow-up draft");
  expect(text).not.toContain("Load CPI headlines");
  f.render();
  expect(f.focus).toHaveBeenCalledOnce();
  f.render().byId("markets-briefing-new").props.onClick!();
  expect(f.navigate).toHaveBeenCalledTimes(2);
  expect(f.workspace.getMarketsBriefingReading()).toBeNull();
});
it("refuses pending and stale return callbacks and never focuses a retired reading", async () => {
  const f = await fixture();
  const old = f.render().byId("markets-briefing-return");
  const pending = f.render(true).byId("markets-briefing-return");
  expect(pending.props.disabled).toBe(true);
  pending.props.onClick!();
  expect(f.navigate).not.toHaveBeenCalled();
  old.props.onClick!();
  expect(f.navigate).not.toHaveBeenCalled();
  expect(f.workspace.getSnapshot().view).toBe("followups");
  f.workspace.setView("watchlist");
  old.props.onClick!();
  f.render();
  expect(f.navigate).not.toHaveBeenCalled();
  expect(f.focus).not.toHaveBeenCalled();
});
it("does not focus after an owned return if another route retires it before commit", async () => {
  const f = await fixture();
  f.render().byId("markets-briefing-return").props.onClick!();
  f.workspace.setView("watchlist");
  const result = f.render();
  expect(result.tree).toBeNull();
  expect(f.focus).not.toHaveBeenCalled();
});
it("refuses a stale Start another briefing callback after navigation becomes pending", async () => {
  const f = await fixture();
  f.render().byId("markets-briefing-return").props.onClick!();
  const old = f.render().byId("markets-briefing-new");
  const pending = f.render(true).byId("markets-briefing-new");
  expect(pending.props.disabled).toBe(true);
  pending.props.onClick!();
  old.props.onClick!();
  expect(f.navigate).toHaveBeenCalledOnce();
  expect(f.workspace.getMarketsBriefingReading()).toBe(f.reading);
});

it("refuses callbacks from discarded renders and unmounted controls", async () => {
  const f = await fixture();
  f.render(false, false).byId("markets-briefing-return").props.onClick!();
  expect(f.navigate).not.toHaveBeenCalled();
  const committed = f.render().byId("markets-briefing-return");
  const discarded = f.render(false, false).byId("markets-briefing-return");
  discarded.props.onClick!();
  expect(f.navigate).not.toHaveBeenCalled();
  // Commit a replacement so its registered cleanup represents an actual unmount.
  const latest = f.render().byId("markets-briefing-return");
  for (const slot of hooks.slots) {
    (slot as Partial<ValuationTestEffectSlot> | undefined)?.cleanup?.();
  }
  committed.props.onClick!();
  latest.props.onClick!();
  expect(f.navigate).not.toHaveBeenCalled();
  expect(f.focus).not.toHaveBeenCalled();
});

it.each(["draft", "file"] as const)(
  "keeps a %s-retired returned briefing passive until an explicit current Start",
  async (kind) => {
    const f = await fixture();
    const resolves = vi.mocked(f.api.resolve).mock.calls.length;
    f.render().byId("markets-briefing-return").props.onClick!();
    const oldStart = f.render().byId("markets-briefing-new");
    expect(f.workspace.isMarketsBriefingPassive()).toBe(true);
    if (kind === "draft") {
      const member =
        f.workspace.coordinator.getSnapshot().draft!.memberships[0]!;
      f.workspace.note(
        member.listingId,
        "Changed after returning to the briefing.",
      );
    } else {
      const owner = {};
      f.workspace.followups.beginDraftFileActivity(owner);
      f.workspace.followups.endDraftFileActivity(owner);
    }
    expect(f.workspace.getMarketsBriefingReading()).toBeNull();
    expect(f.workspace.isMarketsBriefingPassive()).toBe(true);
    expect(f.workspace.getSnapshot().view).toBe("markets");
    const retired = f.render();
    const text = renderToStaticMarkup(retired.tree);
    expect(text).toContain('aria-label="Retired Markets briefing"');
    expect(text).toContain("The retained briefing is no longer current");
    expect(text).not.toContain("Create follow-up draft");
    expect(text).not.toContain("Load CPI headlines");
    const stale = retired.byId("markets-briefing-new");
    const pending = f.render(true).byId("markets-briefing-new");
    expect(pending.props.disabled).toBe(true);
    pending.props.onClick!();
    stale.props.onClick!();
    oldStart.props.onClick!();
    f.render(false, false).byId("markets-briefing-new").props.onClick!();
    expect(f.navigate).toHaveBeenCalledOnce();
    expect(f.api.resolve).toHaveBeenCalledTimes(resolves);
    expect(f.api.cpiHeadlines).toHaveBeenCalledOnce();
    for (const read of [
      f.api.eodHistory,
      f.api.blsCalendar,
      f.api.economicCalendar,
      f.api.monetaryAnnouncements,
    ])
      expect(read).not.toHaveBeenCalled();
    expect(f.focus).toHaveBeenCalledOnce();
    f.render().byId("markets-briefing-new").props.onClick!();
    expect(f.navigate).toHaveBeenCalledTimes(2);
    expect(f.workspace.isMarketsBriefingPassive()).toBe(false);
    expect(f.workspace.getMarketsBriefingReading()).toBeNull();
    expect(f.render().tree).toBeNull();
    await vi.waitFor(() =>
      expect(f.workspace.markets.getSnapshot().resolving).toBe(false),
    );
    expect(f.workspace.markets.getSnapshot().active).toBe(true);
    expect(f.api.resolve).toHaveBeenCalledTimes(resolves + 1);
    expect(f.api.cpiHeadlines).toHaveBeenCalledOnce();
    await f.workspace.cpiHeadlines.load();
    expect(f.api.cpiHeadlines).toHaveBeenCalledTimes(2);
  },
);
