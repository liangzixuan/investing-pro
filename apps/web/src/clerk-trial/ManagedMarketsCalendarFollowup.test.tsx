import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  parseManagedEconomicCalendar,
  parseManagedMonetaryAnnouncements,
} from "@research-cockpit/contracts";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import { ManagedCalendarFollowupForm } from "./ManagedCalendarFollowupForm";
import type { CalendarFormProps } from "./ManagedCalendarFollowupFormState";
import { ManagedMarketsCalendarFollowup } from "./ManagedMarketsCalendarFollowup";
import { ManagedMarketsDayView } from "./ManagedMarketsDayView";
import type { ManagedMarketsNavigationProps } from "./ManagedMarketsNavigation";

const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
  subscriptions: [] as unknown[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  return {
    ...actual,
    ...createValuationDraftTestHooks(hooks),
    useSyncExternalStore: (subscribe: unknown, snapshot: () => unknown) => {
      hooks.subscriptions.push(subscribe);
      return snapshot();
    },
  };
});
interface Props {
  id?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  value?: string;
  open?: boolean;
  onClick?: () => void;
  onChange?: (event: { currentTarget: { value: string } }) => void;
  onToggle?: (event: { currentTarget: { open: boolean } }) => void;
}
function elements(node: React.ReactNode): React.ReactElement<Props>[] {
  if (!React.isValidElement<Props>(node)) return [];
  if (typeof node.type === "function")
    return elements(
      (node.type as (props: Props) => React.ReactNode)(node.props),
    );
  return [
    node,
    ...React.Children.toArray(node.props.children).flatMap(elements),
  ];
}
function unmount() {
  for (const slot of hooks.slots) {
    if (
      slot &&
      typeof slot === "object" &&
      "cleanup" in slot &&
      typeof slot.cleanup === "function"
    )
      (slot.cleanup as () => void)();
  }
}
const workspaces: ManagedWorkspace[] = [];
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  hooks.subscriptions = [];
});
afterEach(() => {
  unmount();
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
  vi.unstubAllGlobals();
});
function renderer(props: CalendarFormProps) {
  return (override: Partial<CalendarFormProps> = {}, commit = true) => {
    hooks.index = 0;
    hooks.effects = [];
    const tree = ManagedCalendarFollowupForm({ ...props, ...override });
    if (commit) for (const effect of hooks.effects) effect();
    const all = elements(tree);
    const byId = (suffix: string) => {
      const node = all.find(
        (item) => item.props.id === `calendar-followup-${suffix}`,
      );
      if (!node) throw new Error(`Missing calendar control ${suffix}`);
      return node;
    };
    return {
      tree,
      all,
      html: load(renderToStaticMarkup(tree)),
      byId,
      change: (suffix: string, value: string) =>
        byId(suffix).props.onChange!({ currentTarget: { value } }),
      click: (suffix: string) => {
        const node = byId(suffix);
        expect(node.props.disabled).not.toBe(true);
        node.props.onClick!();
      },
    };
  };
}
async function fixture(kind: "bea" | "fed" = "bea") {
  const original = await createFixture("research-followups");
  const agenda = parseManagedEconomicCalendar(economicCalendarFixture())!;
  const feed = parseManagedMonetaryAnnouncements(fedAnnouncementsFixture())!;
  const loadFollowups = vi.fn(original.api.loadFollowups);
  const workspace = new ManagedWorkspace(
    {
      ...original.api,
      loadFollowups,
      economicCalendar: vi.fn().mockResolvedValue(agenda),
      monetaryAnnouncements: vi.fn().mockResolvedValue(feed),
    },
    original.session,
    undefined,
    {
      researchCoverage: inventedManagedResearchCoverage,
      priceCoverage: original.priceCoverage,
      marketsCohort: original.marketsCohort,
    },
  );
  workspaces.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("markets");
  if (kind === "bea") await workspace.agenda.load();
  else await workspace.announcements.load();
  let visible = true;
  const key =
    kind === "bea"
      ? `bea:${JSON.stringify([agenda.events[0]!.series, agenda.events[0]!.scheduledAt])}`
      : `fed:${feed.items[1]!.url}`;
  const result = workspace.captureMarketsCalendarSource(key, () => visible);
  if (!result.capture)
    throw new Error(result.reason ?? "Missing source capture");
  const props: CalendarFormProps = {
    workspace,
    capture: result.capture,
    isCurrent: () => visible,
    navigationPending: false,
    onReview: vi.fn(),
    onManageWatchlist: vi.fn(),
    onClose: vi.fn(),
  };
  return {
    original,
    loadFollowups,
    workspace,
    props,
    render: renderer(props),
    hide: () => {
      visible = false;
    },
    show: () => {
      visible = true;
    },
    member: workspace.coordinator.getSnapshot().draft!.memberships[0]!,
  };
}
function author(
  f: Awaited<ReturnType<typeof fixture>>,
  question = "Does café 📈 change the demand case?",
) {
  f.render().change("company", f.member.listingId);
  f.render().change("question", question);
  f.render().change("due", "2026-12-01");
}
async function ready(f: Awaited<ReturnType<typeof fixture>>) {
  author(f);
  f.render().click("load");
  await vi.waitFor(() =>
    expect(
      f.workspace.followups.coordinator.getSnapshot().draft,
    ).not.toBeNull(),
  );
}
it("starts closed without a source and never chooses or loads a company implicitly", async () => {
  const f = await fixture();
  const empty = f.render({ capture: null });
  expect(empty.html("details").first().attr("open")).toBeUndefined();
  expect(empty.html("#calendar-followup-company")).toHaveLength(0);
  expect(f.original.followups!.getSnapshot().load).toBe(0);
});
it("opens the chosen source with distinct clocks and no default company, preserving raw fields through explicit initial Load", async () => {
  const f = await fixture();
  const first = f.render();
  expect(first.html("details").first().attr("open")).toBeDefined();
  expect(first.byId("company").props.value).toBe("");
  expect(first.html.text()).toContain(
    "Scheduled time (UTC)2026-10-30T12:30:00.000Z",
  );
  expect(first.html.text()).toContain(
    "Retrieved (UTC)2026-10-20T18:00:00.000Z",
  );
  expect(first.byId("load").props.disabled).toBe(true);
  author(f);
  const before = f.render();
  before.click("load");
  await vi.waitFor(() =>
    expect(
      f.workspace.followups.coordinator.getSnapshot().draft,
    ).not.toBeNull(),
  );
  const loaded = f.render();
  expect(loaded.byId("company").props.value).toBe(f.member.listingId);
  expect(loaded.byId("question").props.value).toBe(
    "Does café 📈 change the demand case?",
  );
  expect(loaded.byId("due").props.value).toBe("2026-12-01");
  expect(f.original.followups!.getSnapshot().load).toBe(1);
});
it("previews the whole independently cited question and creates once without saving or changing My Watchlist", async () => {
  const f = await fixture();
  await ready(f);
  const watchlist = f.workspace.coordinator.getSnapshot().draft;
  f.render().click("preview");
  const preview = f.render();
  const check =
    "Question: Does café 📈 change the demand case? | BEA schedule: Invented October release; scheduled 2026-10-30T12:30:00.000Z; https://www.bea.gov/news/schedule";
  expect(preview.byId("check").props.value).toBe(check);
  expect(preview.html.text()).toContain(f.member.securityId);
  const create = preview.byId("create").props.onClick!;
  create();
  create();
  const entries =
    f.workspace.followups.coordinator.getSnapshot().draft!.entries;
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    check,
    dueOn: "2026-12-01",
    listing: { listingId: f.member.listingId },
    status: "open",
    result: "",
  });
  expect(f.workspace.coordinator.getSnapshot().draft).toBe(watchlist);
  f.render().click("review");
  expect(f.props.onReview).toHaveBeenCalledExactlyOnceWith(entries[0]);
  expect(f.original.getSnapshot().save).toBe(0);
  expect(f.original.followups!.getSnapshot().save).toBe(0);
});
it("retains an unknown publication clock and the exact complete source URL", async () => {
  const f = await fixture("fed");
  await ready(f);
  f.render().click("preview");
  const result = f.render();
  expect(result.html.text()).toContain("Publication time (UTC)Unknown");
  expect(result.byId("check").props.value).toBe(
    "Question: Does café 📈 change the demand case? | Fed announcement: Invented announcement without a publication time; published unknown; https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm",
  );
});
it.each(["📈".repeat(500), "Question\nwith newline", "Question\u0000control"])(
  "keeps invalid or oversized raw text without clipping or a create action",
  async (question) => {
    const f = await fixture();
    await ready(f);
    f.render().change("question", question);
    f.render().click("preview");
    const result = f.render();
    expect(result.byId("question").props.value).toBe(question);
    expect(result.html("#calendar-followup-check")).toHaveLength(0);
    expect(result.html.text()).toContain("Nothing was clipped or changed");
    expect(
      f.workspace.followups.coordinator.getSnapshot().draft!.entries,
    ).toHaveLength(0);
  },
);
it("retires a retained Create on question edit, cancel/close and reopen", async () => {
  const f = await fixture();
  await ready(f);
  f.render().click("preview");
  const create = f.render().byId("create").props.onClick!;
  f.render().change("question", "A different exact question");
  create();
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toHaveLength(0);
  f.render().click("preview");
  const second = f.render().byId("create").props.onClick!;
  f.render().click("cancel");
  second();
  const closed = f.render();
  expect(closed.html("details").first().attr("open")).toBeUndefined();
  closed.all.find((node) => node.type === "details")!.props.onToggle!({
    currentTarget: { open: true },
  });
  second();
  expect(f.render().html("#calendar-followup-create")).toHaveLength(0);
});
it("refuses old callbacks after hidden navigation, pending navigation, source retirement and unmount", async () => {
  const f = await fixture();
  await ready(f);
  f.render().click("preview");
  const create = f.render().byId("create").props.onClick!;
  f.hide();
  create();
  f.render();
  f.show();
  create();
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toHaveLength(0);
  const pending = f.render({ navigationPending: true });
  expect(pending.byId("preview").props.disabled).toBe(true);
  create();
  unmount();
  create();
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toHaveLength(0);
});
it("does not retarget a chosen member when an exact Watchlist draft object is replaced", async () => {
  const f = await fixture();
  await ready(f);
  f.render().click("preview");
  const oldCreate = f.render().byId("create").props.onClick!;
  const saved = f.workspace.coordinator.getSnapshot().draft!;
  f.workspace.coordinator.replaceDraft({
    ...saved,
    memberships: saved.memberships.map((member) => ({ ...member })),
  });
  oldCreate();
  const result = f.render();
  expect(result.byId("question").props.value).toBe(
    "Does café 📈 change the demand case?",
  );
  expect(result.byId("preview").props.disabled).toBe(true);
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toHaveLength(0);
});
it("ignores handlers from an uncommitted render and cancels an owned preview on replacement", async () => {
  const f = await fixture();
  await ready(f);
  const abandoned = f.render({}, false);
  abandoned.byId("preview").props.onClick!();
  expect(f.render().html("#calendar-followup-check")).toHaveLength(0);
  f.render().click("preview");
  const create = f.render().byId("create").props.onClick!;
  f.render({ capture: null });
  create();
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toHaveLength(0);
});
it("preserves the raw form after an explicit failed Follow-ups load", async () => {
  const f = await fixture();
  author(f);
  f.loadFollowups.mockRejectedValueOnce(
    new Error("Invented unavailable resource"),
  );
  f.render().click("load");
  await vi.waitFor(() =>
    expect(f.workspace.followups.coordinator.getSnapshot().phase).not.toBe(
      "loading",
    ),
  );
  const result = f.render();
  expect(result.byId("question").props.value).toBe(
    "Does café 📈 change the demand case?",
  );
  expect(result.byId("due").props.value).toBe("2026-12-01");
  expect(result.byId("company").props.value).toBe(f.member.listingId);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(result.html("#calendar-followup-create")).toHaveLength(0);
});
it("immediately disables a prepared check when an independent source-review preview changes its capture", async () => {
  const f = await fixture();
  await ready(f);
  f.render().click("preview");
  const oldCreate = f.render().byId("create").props.onClick!;
  f.workspace.marketsSourceReview.preview();
  const result = f.render();
  expect(result.byId("preview").props.disabled).toBe(true);
  expect(result.html("#calendar-followup-create")).toHaveLength(0);
  oldCreate();
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toHaveLength(0);
});
it("subscribes to all independent source/pass/resource/session stores and connects only an explicit row choice", async () => {
  const f = await fixture();
  const props = { ...f.props, navigation: {} as ManagedMarketsNavigationProps };
  const capture = vi.spyOn(f.workspace, "captureMarketsCalendarSource");
  hooks.index = 0;
  hooks.effects = [];
  const first = ManagedMarketsCalendarFollowup(props);
  hooks.effects.forEach((effect) => effect());
  const stores = [
    f.workspace,
    f.workspace.blsCalendar,
    f.workspace.agenda,
    f.workspace.announcements,
    f.workspace.marketsSourceReview,
    f.workspace.coordinator,
    f.workspace.followups,
    f.workspace.followups.coordinator,
    f.workspace.sessionOwner,
  ];
  expect(hooks.subscriptions).toHaveLength(stores.length);
  for (const store of stores)
    expect(hooks.subscriptions).toContain(store.subscribe);
  const children = React.Children.toArray(
    (first as React.ReactElement<{ children: React.ReactNode }>).props.children,
  );
  const day = children.find(
    (node) => React.isValidElement(node) && node.type === ManagedMarketsDayView,
  ) as React.ReactElement<React.ComponentProps<typeof ManagedMarketsDayView>>;
  expect(day.props.onKeepCheck).toBeTypeOf("function");
  day.props.onKeepCheck!(
    {
      key: `bea:${JSON.stringify(["Invented October release", "2026-10-30T12:30:00.000Z"])}`,
      source: "bea",
      title: "Invented October release",
      instant: "2026-10-30T12:30:00.000Z",
      url: "https://www.bea.gov/news/schedule",
    },
    () => true,
  );
  hooks.index = 0;
  hooks.effects = [];
  const selected = ManagedMarketsCalendarFollowup(props);
  hooks.effects.forEach((effect) => effect());
  expect(capture).toHaveBeenCalledOnce();
  day.props.onKeepCheck!(
    {
      key: "retained-old-row",
      source: "fed",
      title: "Old row",
      instant: null,
      url: "https://www.federalreserve.gov/",
    },
    () => true,
  );
  expect(capture).toHaveBeenCalledOnce();
  const form = React.Children.toArray(
    (selected as React.ReactElement<{ children: React.ReactNode }>).props
      .children,
  ).find(
    (node) =>
      React.isValidElement(node) && node.type === ManagedCalendarFollowupForm,
  ) as React.ReactElement<CalendarFormProps>;
  expect(form.props.capture?.source.kind).toBe("bea");
  expect(f.original.followups!.getSnapshot().load).toBe(0);
});
it("keeps the created result through a synchronous resource subscriber render without reusing the consumed preview", async () => {
  const f = await fixture();
  await ready(f);
  f.render().click("preview");
  const create = f.render().byId("create").props.onClick!;
  const stop = f.workspace.followups.coordinator.subscribe(() => {
    void f.render();
  });
  try {
    create();
    create();
  } finally {
    stop();
  }
  const result = f.render();
  expect(result.html.text()).toContain("Created in the Follow-ups draft");
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toHaveLength(1);
  result.click("review");
  expect(f.props.onReview).toHaveBeenCalledOnce();
});
it("focuses the explicit source choice and complete preview headings, then restores through the close callback", async () => {
  const f = await fixture();
  const first = f.render({}, false);
  const source = first.all.find(
    (node) => node.type === "h3",
  ) as React.ReactElement<{ ref: React.RefObject<HTMLElement | null> }>;
  const sourceFocus = vi.fn();
  const sourceNode = {
    focus: sourceFocus,
    scrollIntoView: vi.fn(),
  } as unknown as HTMLElement;
  source.props.ref.current = sourceNode;
  hooks.effects.forEach((effect) => effect());
  expect(sourceFocus).toHaveBeenCalledWith({ preventScroll: true });
  await ready(f);
  f.render().click("preview");
  const prepared = f.render({}, false);
  const heading = prepared.all.find(
    (node) =>
      node.type === "h4" &&
      node.props.children === "Review the complete cited check",
  ) as React.ReactElement<{ ref: React.RefObject<HTMLElement | null> }>;
  const previewFocus = vi.fn();
  const previewNode = {
    focus: previewFocus,
    scrollIntoView: vi.fn(),
  } as unknown as HTMLElement;
  heading.props.ref.current = previewNode;
  hooks.effects.forEach((effect) => effect());
  expect(previewFocus).toHaveBeenCalledWith({ preventScroll: true });
  f.render().click("cancel");
  expect(f.props.onClose).toHaveBeenCalledOnce();
});
function sizingHarness(observerAvailable = true) {
  const dimensions = { width: 320, scrollHeight: 400 };
  const heights: string[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  const callbacks: (() => void)[] = [];
  const observers: Array<{
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];
  let frameId = 0;
  let resize: (() => void) | null = null;
  let height = "";
  const view = {
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    }),
    cancelAnimationFrame: vi.fn((id: number) => {
      frames.delete(id);
    }),
    addEventListener: vi.fn((_name: string, callback: () => void) => {
      resize = callback;
    }),
    removeEventListener: vi.fn(() => {
      resize = null;
    }),
  };
  const node = {
    ownerDocument: { defaultView: view },
    getBoundingClientRect: () => ({ width: dimensions.width }),
    offsetHeight: 22,
    clientHeight: 20,
    get scrollHeight() {
      return dimensions.scrollHeight;
    },
    style: {
      get height() {
        return height;
      },
      set height(value: string) {
        height = value;
        heights.push(value);
      },
    },
  } as unknown as HTMLTextAreaElement;
  class Observer {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(callback: ResizeObserverCallback) {
      callbacks.push(() => callback([], this as unknown as ResizeObserver));
      observers.push(this);
    }
  }
  vi.stubGlobal("ResizeObserver", observerAvailable ? Observer : undefined);
  return {
    node,
    dimensions,
    heights,
    frames,
    callbacks,
    observers,
    view,
    flush: () => {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(0);
    },
    resize: () => resize?.(),
  };
}
function bindPreviewSize(
  f: Awaited<ReturnType<typeof fixture>>,
  node: HTMLTextAreaElement,
) {
  const result = f.render({}, false);
  const check = result.byId("check") as React.ReactElement<
    Props & {
      ref: React.RefObject<HTMLTextAreaElement | null>;
      readOnly: boolean;
    }
  >;
  check.props.ref.current = node;
  hooks.effects.forEach((effect) => effect());
  return check;
}
it("fits every preview character including borders, follows narrower widths and skips height-only observer feedback", async () => {
  const f = await fixture();
  await ready(f);
  const sizing = sizingHarness();
  f.render().click("preview");
  const check = bindPreviewSize(f, sizing.node);
  expect(check.props.readOnly).toBe(true);
  expect(check.props.id).toBe("calendar-followup-check");
  expect(check.props.value).toBe(
    "Question: Does café 📈 change the demand case? | BEA schedule: Invented October release; scheduled 2026-10-30T12:30:00.000Z; https://www.bea.gov/news/schedule",
  );
  expect(sizing.node.style.height).toBe("402px");
  expect(sizing.observers[0]!.observe).toHaveBeenCalledWith(sizing.node);
  const first = [...sizing.heights];
  sizing.callbacks[0]!();
  sizing.flush();
  expect(sizing.heights).toEqual(first);
  sizing.dimensions.width = 180;
  sizing.dimensions.scrollHeight = 700;
  sizing.callbacks[0]!();
  sizing.callbacks[0]!();
  expect(sizing.frames.size).toBe(1);
  sizing.flush();
  expect(sizing.node.style.height).toBe("702px");
  const narrow = [...sizing.heights];
  sizing.callbacks[0]!();
  sizing.flush();
  expect(sizing.heights).toEqual(narrow);
});
it("remeasures new preview text at the same width and cancels observers and queued frames on retirement/unmount", async () => {
  const f = await fixture();
  await ready(f);
  const sizing = sizingHarness();
  f.render().click("preview");
  bindPreviewSize(f, sizing.node);
  sizing.callbacks[0]!();
  expect(sizing.frames.size).toBe(1);
  f.render().change("question", "A different complete question");
  f.render();
  expect(sizing.observers[0]!.disconnect).toHaveBeenCalledOnce();
  expect(sizing.frames.size).toBe(0);
  const retiredHeights = [...sizing.heights];
  sizing.callbacks[0]!();
  sizing.flush();
  expect(sizing.heights).toEqual(retiredHeights);
  sizing.dimensions.scrollHeight = 520;
  f.render().click("preview");
  const next = bindPreviewSize(f, sizing.node);
  expect(next.props.value).toContain("A different complete question");
  expect(sizing.node.style.height).toBe("522px");
  sizing.callbacks[1]!();
  unmount();
  expect(sizing.observers[1]!.disconnect).toHaveBeenCalledOnce();
  expect(sizing.frames.size).toBe(0);
  const finished = [...sizing.heights];
  sizing.callbacks[1]!();
  sizing.flush();
  expect(sizing.heights).toEqual(finished);
});
it("uses and removes the window resize fallback when ResizeObserver is unavailable", async () => {
  const f = await fixture();
  await ready(f);
  const sizing = sizingHarness(false);
  f.render().click("preview");
  bindPreviewSize(f, sizing.node);
  expect(sizing.node.style.height).toBe("402px");
  expect(sizing.view.addEventListener).toHaveBeenCalledOnce();
  sizing.dimensions.width = 180;
  sizing.dimensions.scrollHeight = 620;
  sizing.resize();
  sizing.flush();
  expect(sizing.node.style.height).toBe("622px");
  unmount();
  expect(sizing.frames.size).toBe(0);
  expect(sizing.view.removeEventListener).toHaveBeenCalledOnce();
});
