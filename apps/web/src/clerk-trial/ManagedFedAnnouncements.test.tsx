import type { MouseEvent } from "react";
import {
  parseManagedMonetaryAnnouncements,
  type PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import type * as React from "react";
import type { FedMonetaryAnnouncementsProps } from "../features/markets/FedMonetaryAnnouncements";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagedFedAnnouncements } from "./ManagedFedAnnouncements";
import { ManagedFedAnnouncements as Model } from "./managed-fed-announcements";
import type { ManagedApi } from "./managed-api";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import type { ManagedFedAnnouncementNoteContext } from "./ManagedFedAnnouncementNoteAction";
import { ManagedFedAnnouncementNoteAction } from "./ManagedFedAnnouncementNoteAction";
import { ManagedFedRefreshComparisonDetails } from "./ManagedFedRefreshComparisonDetails";
import { TrialApiError } from "./api";

function parsedFeed(overrides: Partial<PersonalMonetaryAnnouncementsDto> = {}) {
  const packet = parseManagedMonetaryAnnouncements({
    ...fedAnnouncementsFixture(),
    ...overrides,
  });
  if (!packet) throw new Error("Invalid invented Fed packet.");
  return packet;
}

function comparisonSlot(
  view: React.ReactElement<FedMonetaryAnnouncementsProps>,
) {
  return view.props.refreshSummary as React.ReactElement<
    React.ComponentProps<typeof ManagedFedRefreshComparisonDetails>
  >;
}

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  stateIndex: 0,
  changed: false,
  memos: [] as Array<{ value: unknown; dependencies: readonly unknown[] }>,
  memoIndex: 0,
  refs: [] as Array<{ current: unknown }>,
  index: 0,
  effects: [] as Array<() => void | (() => void)>,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.states))
      hooks.states[index] =
        typeof initial === "function" ? (initial as () => unknown)() : initial;
    return [
      hooks.states[index],
      (next: unknown) => {
        const value =
          typeof next === "function"
            ? (next as (value: unknown) => unknown)(hooks.states[index])
            : next;
        hooks.changed ||= value !== hooks.states[index];
        hooks.states[index] = value;
      },
    ];
  },
  useMemo: (factory: () => unknown, dependencies: readonly unknown[]) => {
    const index = hooks.memoIndex++;
    const previous = hooks.memos[index];
    if (
      !previous ||
      dependencies.some(
        (value, position) => !Object.is(value, previous.dependencies[position]),
      )
    )
      hooks.memos[index] = { value: factory(), dependencies };
    return hooks.memos[index]!.value;
  },
  useRef: (value: unknown) =>
    (hooks.refs[hooks.index++] ??= { current: value }),
  useLayoutEffect: (effect: () => void | (() => void)) =>
    hooks.effects.push(effect),
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) =>
    getSnapshot(),
}));
beforeEach(() => {
  hooks.refs = [];
  hooks.index = 0;
  hooks.effects = [];
  hooks.states = [];
  hooks.memos = [];
});
afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const read = vi
    .fn<ManagedApi["monetaryAnnouncements"]>()
    .mockImplementation(() => new Promise(() => undefined));
  const model = new Model(read, vi.fn());
  const button = {
    isConnected: true,
    disabled: false,
    closest: vi.fn().mockReturnValue(null),
    getClientRects: () => [1],
    focus: vi.fn(),
  };
  const cancel = {};
  const doc = { activeElement: cancel, body: {} };
  vi.stubGlobal("document", doc);
  const noteContext: ManagedFedAnnouncementNoteContext = {
    members: [],
    active: true,
    editable: true,
    actions: {
      getAction: vi.fn(() => ({
        canAppend: false,
        reason: "Choose a loaded announcement.",
      })),
      append: vi.fn(() => ({
        appended: false,
        message: "Choose a loaded announcement.",
      })),
    },
    onReview: vi.fn(),
  };
  let cleanups: Array<void | (() => void)> = [];
  const render = (
    headingRef?: React.Ref<HTMLHeadingElement>,
    currentModel = model,
  ) => {
    let view!: React.ReactElement<FedMonetaryAnnouncementsProps>;
    for (let i = 0; i < 5; i++) {
      hooks.index = 0;
      hooks.stateIndex = 0;
      hooks.memoIndex = 0;
      hooks.effects = [];
      hooks.changed = false;
      view = ManagedFedAnnouncements({
        model: currentModel,
        headingRef,
        noteContext,
      });
      if (!hooks.changed) break;
    }
    hooks.refs[0]!.current = button;
    cleanups.forEach((cleanup) => cleanup?.());
    cleanups = hooks.effects.map((effect) => effect());
    return view;
  };
  return {
    read,
    model,
    button,
    cancel,
    doc,
    render,
    noteContext,
    unmount: () => cleanups.forEach((cleanup) => cleanup?.()),
  };
}

describe("managed announcement controls", () => {
  it("shares one title view with the list and note choices while keeping full-feed comparison", async () => {
    const f = fixture();
    const previous = parsedFeed();
    f.read.mockResolvedValueOnce(previous);
    await f.model.load();
    const current = parsedFeed({ fetchedAt: "2026-10-21T18:00:00.000Z" });
    f.read.mockResolvedValueOnce(current);
    await f.model.load();
    f.render().props.filterView!.onQueryChange("  WITHOUT  A  PUBLICATION  ");
    const view = f.render();
    const note = view.props.noteAction as React.ReactElement<
      React.ComponentProps<typeof ManagedFedAnnouncementNoteAction>
    >;
    expect(view.props.filterView!.view.visibleItems).toEqual([
      current.items[1],
    ]);
    expect(note.props.view).toBe(view.props.filterView!.view);
    expect(note.props.view.visibleItems[0]).toBe(current.items[1]);
    expect(comparisonSlot(view).props.comparison.current.items).toBe(
      current.items,
    );
    expect(view.props.announcements).toBe(current);
    view.props.filterView!.onQueryChange("");
    expect(f.render().props.filterView!.view.visibleItems).toBe(current.items);
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.noteContext.actions.append).not.toHaveBeenCalled();
    expect(f.button.focus).not.toHaveBeenCalled();
  });
  it.each(["pending", "cancel", "failure"] as const)(
    "retains title search through %s",
    async (attempt) => {
      const f = fixture();
      const packet = parsedFeed();
      f.read.mockResolvedValueOnce(packet);
      await f.model.load();
      f.render().props.filterView!.onQueryChange("monetary policy");
      if (attempt === "failure")
        f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
      const pending = f.model.load();
      if (attempt === "cancel") f.model.cancel();
      if (attempt === "failure") await pending;
      const view = f.render();
      expect(view.props.filterView!.view.query).toBe("monetary policy");
      expect(view.props.filterView!.view.response).toBe(packet);
      expect(view.props.filterView!.view.visibleItems).toEqual([
        packet.items[0],
      ]);
      expect(f.read).toHaveBeenCalledTimes(2);
    },
  );
  it.each(["equal", "empty", "retired", "model"] as const)(
    "clears title search and fences stale callbacks after %s",
    async (change) => {
      const f = fixture();
      f.read.mockResolvedValueOnce(parsedFeed());
      await f.model.load();
      f.render().props.filterView!.onQueryChange("without");
      const stale = f.render().props.filterView!.onQueryChange;
      let model = f.model;
      if (change === "retired") f.model.retire();
      else if (change === "model") model = new Model(vi.fn(), vi.fn());
      else {
        f.read.mockResolvedValueOnce(
          parsedFeed(
            change === "empty" ? { items: [], availableItemCount: 0 } : {},
          ),
        );
        await f.model.load();
      }
      stale("must not cross response");
      const view = f.render(undefined, model);
      expect(view.props.filterView!.view.query).toBe("");
      expect(view.props.filterView!.view.visibleItems).toEqual(
        model.getSnapshot().announcements?.items ?? [],
      );
      expect(view.props.filterView!.resetNotice).toBe(
        change === "equal" || change === "empty",
      );
      stale("must not cross commit");
      expect(f.render(undefined, model).props.filterView!.view.query).toBe("");
    },
  );
  it("refuses callbacks from a previous query and after unmount", async () => {
    const f = fixture();
    f.read.mockResolvedValueOnce(parsedFeed());
    await f.model.load();
    const stale = f.render().props.filterView!.onQueryChange;
    stale("without");
    f.render();
    stale("monetary");
    expect(f.render().props.filterView!.view.query).toBe("without");
    const latest = f.render().props.filterView!.onQueryChange;
    f.unmount();
    latest("after unmount");
    expect(f.render().props.filterView!.view.query).toBe("without");
  });
  it("shows comparison only after replacement and keeps the exact current packet and note state", async () => {
    const f = fixture();
    expect(f.render().props.refreshSummary).toBeNull();
    const previous = parsedFeed();
    f.read.mockResolvedValueOnce(previous);
    await f.model.load();
    expect(f.render().props.refreshSummary).toBeNull();
    const current = parsedFeed({
      fetchedAt: "2026-10-21T18:00:00.000Z",
      items: [
        previous.items[0]!,
        {
          title: "Newly loaded unknown-time item",
          url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261017a.htm",
          publishedAt: null,
        },
      ],
    });
    f.read.mockResolvedValueOnce(current);
    await f.model.load();
    const view = f.render();
    const slot = comparisonSlot(view);
    const pair = f.model.getSnapshot().refreshComparison;
    expect(slot.type).toBe(ManagedFedRefreshComparisonDetails);
    expect(slot.props.comparison).toBe(pair);
    expect(slot.props.comparison.previous).toBe(previous);
    expect(slot.props.comparison.current).toBe(current);
    expect(view.props.announcements).toBe(current);
    expect(view.props.newlyObservedUrls).toBe(pair!.newUrls);
    expect(view.props.newlyObservedUrls).toEqual([current.items[1]!.url]);
    const note = view.props.noteAction as React.ReactElement<
      React.ComponentProps<typeof ManagedFedAnnouncementNoteAction>
    >;
    expect(note.props.state).toBe(f.model.getSnapshot());
    expect(note.props.state.announcements?.items).toBe(current.items);
    expect(f.noteContext.actions.append).not.toHaveBeenCalled();
    expect(f.noteContext.onReview).not.toHaveBeenCalled();
    expect(f.button.focus).not.toHaveBeenCalled();
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it("refuses comparison presentation for an equal-content but different current response", async () => {
    const f = fixture();
    f.read.mockResolvedValue(parsedFeed());
    await f.model.load();
    await f.model.load();
    const snapshot = f.model.getSnapshot();
    const replacement = parsedFeed();
    expect(replacement).toEqual(snapshot.announcements);
    expect(replacement).not.toBe(snapshot.announcements);
    vi.spyOn(f.model, "getSnapshot").mockReturnValue({
      ...snapshot,
      announcements: replacement,
    });
    const view = f.render();
    expect(view.props.announcements).toBe(replacement);
    expect(view.props.refreshSummary).toBeNull();
    expect(view.props.newlyObservedUrls).toEqual([]);
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it.each(["pending", "cancel", "failure"] as const)(
    "keeps the displayed pair and original clocks during %s",
    async (attempt) => {
      const f = fixture();
      f.read
        .mockResolvedValueOnce(parsedFeed())
        .mockResolvedValueOnce(
          parsedFeed({ fetchedAt: "2026-10-21T18:00:00.000Z" }),
        );
      await f.model.load();
      await f.model.load();
      const pair = f.model.getSnapshot().refreshComparison;
      if (attempt === "failure")
        f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
      const pending = f.model.load();
      if (attempt === "cancel") f.model.cancel();
      if (attempt === "failure") await pending;
      const view = f.render();
      const slot = comparisonSlot(view);
      expect(slot.props.comparison).toBe(pair);
      expect(slot.props.showingPrevious).toBe(true);
      expect(view.props.announcements).toBe(pair!.current);
      const html = renderToStaticMarkup(slot);
      expect(html).toContain(
        "Comparison remains between the last two accepted feeds.",
      );
      expect(html).toContain('dateTime="2026-10-20T18:00:00.000Z"');
      expect(html).toContain('dateTime="2026-10-21T18:00:00.000Z"');
      expect(f.read).toHaveBeenCalledTimes(3);
      f.model.retire();
      expect(f.render().props.refreshSummary).toBeNull();
    },
  );
  it("supplies the exact subscribed feed and note context without changing load or note state", async () => {
    const f = fixture();
    f.read.mockResolvedValueOnce(fedAnnouncementsFixture());
    await f.model.load();
    const view = f.render();
    const slot = view.props.noteAction as React.ReactElement<
      React.ComponentProps<typeof ManagedFedAnnouncementNoteAction>
    >;
    expect(slot.type).toBe(ManagedFedAnnouncementNoteAction);
    expect(slot.props.state).toBe(f.model.getSnapshot());
    expect(slot.props.members).toBe(f.noteContext.members);
    expect(slot.props.actions).toBe(f.noteContext.actions);
    expect(slot.props.onReview).toBe(f.noteContext.onReview);
    expect(f.noteContext.actions.append).not.toHaveBeenCalled();
    expect(f.noteContext.onReview).not.toHaveBeenCalled();
    expect(f.read).toHaveBeenCalledOnce();
  });
  it("passes the owned heading ref without loading or replacing accepted announcements", async () => {
    const f = fixture();
    const headingRef = { current: null };
    expect(f.render(headingRef).props.headingRef).toBe(headingRef);
    expect(f.read).not.toHaveBeenCalled();
    f.read.mockResolvedValueOnce(fedAnnouncementsFixture());
    await f.model.load();
    const packet = f.model.getSnapshot().announcements;
    const view = f.render(headingRef);
    expect(view.props.headingRef).toBe(headingRef);
    expect(view.props.announcements).toBe(packet);
    expect(f.read).toHaveBeenCalledOnce();
    expect(f.button.focus).not.toHaveBeenCalled();
  });
  it("starts idle, passes the original packet and restores focus after a focused Cancel", async () => {
    const f = fixture();
    expect(f.render().props.announcements).toBeNull();
    expect(f.read).not.toHaveBeenCalled();
    f.read.mockResolvedValueOnce(fedAnnouncementsFixture());
    await f.model.load();
    const packet = f.model.getSnapshot().announcements;
    f.render().props.onLoad();
    expect(f.render().props.busy).toBe(true);
    f.render().props.onCancel!({
      currentTarget: f.cancel,
    } as MouseEvent<HTMLButtonElement>);
    f.doc.activeElement = f.doc.body;
    const view = f.render();
    expect(f.button.focus).toHaveBeenCalledOnce();
    expect(view.props.announcements).toBe(packet);
    expect(view.props.showingPrevious).toBe(true);
    expect(f.read.mock.calls[1]![0].aborted).toBe(true);
  });
  it.each(["unfocused", "moved", "hidden", "detached", "disabled"])(
    "does not move focus when %s",
    (reason) => {
      const f = fixture();
      f.render().props.onLoad();
      const busy = f.render();
      if (reason === "unfocused") f.doc.activeElement = {};
      busy.props.onCancel!({
        currentTarget: f.cancel,
      } as MouseEvent<HTMLButtonElement>);
      if (reason === "moved") f.doc.activeElement = {};
      if (reason === "hidden") f.button.closest.mockReturnValue({});
      if (reason === "detached") f.button.isConnected = false;
      if (reason === "disabled") f.button.disabled = true;
      f.render();
      expect(f.button.focus).not.toHaveBeenCalled();
    },
  );
  it("navigation cancellation clears busy state without requesting focus", () => {
    const f = fixture();
    f.render().props.onLoad();
    f.render();
    f.model.leave();
    expect(f.render().props.busy).toBe(false);
    expect(f.button.focus).not.toHaveBeenCalled();
  });
});
