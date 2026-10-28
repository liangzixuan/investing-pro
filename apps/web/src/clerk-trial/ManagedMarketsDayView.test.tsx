import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import {
  MANAGED_BLS_CALENDAR_SOURCE,
  parseManagedBlsCalendar,
  parseManagedEconomicCalendar,
  parseManagedMonetaryAnnouncements,
  type PersonalEconomicCalendarDto,
  type PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { ManagedBlsCalendar } from "./ManagedBlsCalendar";
import { ManagedMarketsDayView } from "./ManagedMarketsDayView";
import { ManagedBeaReleaseAgenda } from "./ManagedBeaReleaseAgenda";
import { ManagedFedAnnouncements } from "./ManagedFedAnnouncements";
import { BeaReleaseAgenda } from "../features/markets/BeaReleaseAgenda";
import { FedMonetaryAnnouncements } from "../features/markets/FedMonetaryAnnouncements";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import type { ManagedMarketsNavigationProps } from "./ManagedMarketsNavigation";

// Real models and source-control callbacks; this is not a DOM/layout simulation.
const hooks = vi.hoisted(() => ({
  key: "",
  index: 0,
  refIndex: 0,
  changed: false,
  states: new Map<string, unknown[]>(),
  refs: new Map<string, Array<{ current: unknown }>>(),
  effects: [] as Array<() => void | (() => void)>,
  cleanups: new Map<string, Array<void | (() => void)>>(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const state = hooks.states.get(hooks.key) ?? [];
    hooks.states.set(hooks.key, state);
    const index = hooks.index++;
    if (!(index in state))
      state[index] =
        typeof initial === "function" ? (initial as () => unknown)() : initial;
    return [
      state[index],
      (next: unknown) => {
        const value =
          typeof next === "function"
            ? (next as (old: unknown) => unknown)(state[index])
            : next;
        hooks.changed ||= value !== state[index];
        state[index] = value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const refs = hooks.refs.get(hooks.key) ?? [];
    hooks.refs.set(hooks.key, refs);
    return (refs[hooks.refIndex++] ??= { current: initial });
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
  useMemo: (factory: () => unknown) => factory(),
  useLayoutEffect: (effect: () => void | (() => void)) => {
    hooks.effects.push(effect);
  },
}));
const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const cleanups of hooks.cleanups.values())
    for (const cleanup of cleanups) cleanup?.();
  hooks.states.clear();
  hooks.refs.clear();
  hooks.cleanups.clear();
  for (const w of workspaces.splice(0)) w.sessionOwner.dispose();
  vi.unstubAllGlobals();
});
function render<T>(
  key: string,
  component: (props: T) => React.ReactNode,
  props: T,
) {
  let result: React.ReactNode;
  for (let i = 0; i < 4; i++) {
    hooks.key = key;
    hooks.index = 0;
    hooks.refIndex = 0;
    hooks.effects = [];
    hooks.changed = false;
    result = component(props);
    if (!hooks.changed) break;
  }
  hooks.cleanups.get(key)?.forEach((cleanup) => cleanup?.());
  hooks.cleanups.set(
    key,
    hooks.effects.map((effect) => effect()),
  );
  return result;
}
function nodes(
  node: React.ReactNode,
): React.ReactElement<Record<string, unknown>>[] {
  return React.Children.toArray(node).flatMap((entry) =>
    React.isValidElement<Record<string, unknown>>(entry)
      ? [entry, ...nodes(entry.props.children as React.ReactNode)]
      : [],
  );
}
function control(node: React.ReactNode, id: string) {
  const found = nodes(node).find(
    (entry) => entry.props.id === id || entry.props.children === id,
  );
  if (!found) throw new Error(`Missing control ${id}`);
  return found;
}
function change(node: React.ReactNode, id: string, value: string) {
  (control(node, id).props.onChange as (event: unknown) => void)({
    currentTarget: { value },
  });
}
function click(node: React.ReactNode, label: string) {
  const target = control(node, label);
  expect(target.props.disabled).not.toBe(true);
  (target.props.onClick as (event: unknown) => void)({
    preventDefault: vi.fn(),
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function fixture() {
  const original = await createFixture("research-followups");
  const agenda = parseManagedEconomicCalendar(economicCalendarFixture());
  const feed = parseManagedMonetaryAnnouncements(fedAnnouncementsFixture());
  if (!agenda || !feed) throw new Error("Invalid fixture packets");
  const bls = parseManagedBlsCalendar({
    ...economicCalendarFixture(),
    source: MANAGED_BLS_CALENDAR_SOURCE,
  })!;
  const readBls = vi.fn<ManagedApi["blsCalendar"]>().mockResolvedValue(bls);
  const readAgenda = vi
    .fn<ManagedApi["economicCalendar"]>()
    .mockResolvedValue(agenda);
  const readFeed = vi
    .fn<ManagedApi["monetaryAnnouncements"]>()
    .mockResolvedValue(feed);
  const workspace = new ManagedWorkspace(
    {
      ...original.api,
      blsCalendar: readBls,
      economicCalendar: readAgenda,
      monetaryAnnouncements: readFeed,
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
  const document = {
    activeElement: null as unknown,
    defaultView: { getComputedStyle: () => ({ visibility: "visible" }) },
  };
  vi.stubGlobal("document", document);
  const target = (id: string) => {
    const node = {
      id,
      isConnected: true,
      closest: () => null,
      getClientRects: () => [{}],
      ownerDocument: document,
      focus: vi.fn(() => {
        document.activeElement = node;
      }),
      scrollIntoView: vi.fn(),
    };
    return node;
  };
  const headings = {
    board: target("managed-markets-heading"),
    review: target("managed-daily-research-heading"),
    cpi: target("managed-cpi-heading"),
    day: target("managed-markets-day-heading"),
    calendar: target("bea-agenda-title"),
    announcements: target("fed-announcements-title"),
    bls: target("bls-calendar-title"),
  };
  const targets = Object.fromEntries(
    Object.entries(headings).map(([key, node]) => [
      key,
      { id: node.id, ref: { current: node } },
    ]),
  ) as unknown as ManagedMarketsNavigationProps["targets"];
  const container = {
    ...target("markets-content"),
    contains: (node: unknown) =>
      Object.values(targets).some((item) => item.ref.current === node),
  };
  const navigation: ManagedMarketsNavigationProps = {
    targets,
    containerRef: { current: container as unknown as HTMLElement },
    isCurrent: () =>
      workspace.getSnapshot().view === "markets" &&
      !workspace.getSnapshot().research &&
      workspace.sessionOwner.getSnapshot().phase === "active",
  };
  const props = {
    agenda: workspace.agenda,
    announcements: workspace.announcements,
    blsCalendar: workspace.blsCalendar,
    onKeepCheck: null as React.ComponentProps<
      typeof ManagedMarketsDayView
    >["onKeepCheck"],
    navigation,
  };
  const day = () => render("day", ManagedMarketsDayView, props);
  const noteContext = {
    members: [],
    active: true,
    editable: true,
    actions: {
      getAction: () => {
        throw new Error("Unexpected note action");
      },
      append: () => {
        throw new Error("Unexpected note action");
      },
    },
    onReview: () => {
      throw new Error("Unexpected note action");
    },
  };
  const agendaPanel = () => {
    const node = render("agenda", ManagedBeaReleaseAgenda, {
      model: workspace.agenda,
      noteContext,
    }) as React.ReactElement<React.ComponentProps<typeof BeaReleaseAgenda>>;
    return BeaReleaseAgenda(node.props);
  };
  const feedPanel = () => {
    const node = render("feed", ManagedFedAnnouncements, {
      model: workspace.announcements,
      noteContext,
    }) as React.ReactElement<
      React.ComponentProps<typeof FedMonetaryAnnouncements>
    >;
    return FedMonetaryAnnouncements(node.props);
  };
  const idle = () =>
    vi.waitFor(() => {
      expect(workspace.agenda.getSnapshot().busy).toBe(false);
      expect(workspace.announcements.getSnapshot().busy).toBe(false);
    });
  const html = () => renderToStaticMarkup(day());
  return {
    workspace,
    original,
    agenda,
    feed,
    readBls,
    bls,
    blsPanel: () =>
      render("bls", ManagedBlsCalendar, { model: workspace.blsCalendar }),
    readAgenda,
    readFeed,
    props,
    targets,
    headings,
    day,
    html,
    agendaPanel,
    feedPanel,
    idle,
  };
}

it("shows unloaded sources, inspects owned headings and loads only through existing explicit panel controls", async () => {
  const f = await fixture();
  expect(f.html()).toContain("BEA schedule not loaded");
  expect(f.html()).toContain("Fed announcements not loaded");
  expect(f.readAgenda).not.toHaveBeenCalled();
  expect(f.readFeed).not.toHaveBeenCalled();
  click(f.day(), "Inspect Economic calendar");
  expect(f.headings.calendar.focus).toHaveBeenCalledExactlyOnceWith({
    preventScroll: true,
  });
  expect(f.readAgenda).not.toHaveBeenCalled();
  click(f.agendaPanel(), "Load agenda");
  await f.idle();
  expect(f.html()).toContain("2 scheduled releases");
  expect(f.html()).toContain("Fed announcements not loaded");
  click(f.day(), "Inspect Fed announcements");
  click(f.feedPanel(), "Load announcements");
  await f.idle();
  const html = f.html();
  expect(html).toContain("Scheduled · BEA");
  expect(html).toContain("Published · Federal Reserve");
  expect(html).toContain('dateTime="2026-10-30T12:30:00.000Z"');
  expect(html).toContain("8:30:00 AM EDT");
  expect(html).toContain("8:30:00 AM EST");
  expect(html).toContain("UTC: 2026-10-20T18:00:00.000Z");
  expect(html).toContain('aria-label="Unknown publication time"');
  expect(html).toContain("This item is not assigned to a date");
  expect(f.readAgenda).toHaveBeenCalledOnce();
  expect(f.readFeed).toHaveBeenCalledOnce();
});
it("distinguishes a verified empty source from a filtered-out loaded day and never dates unknown items by retrieval", async () => {
  const f = await fixture();
  f.readAgenda.mockResolvedValueOnce({ ...f.agenda, events: [] });
  click(f.agendaPanel(), "Load agenda");
  await f.idle();
  expect(f.html()).toContain("No scheduled releases in this loaded window");
  expect(f.html()).not.toContain("No dated items match");
  click(f.agendaPanel(), "Refresh agenda");
  click(f.feedPanel(), "Load announcements");
  await f.idle();
  change(f.day(), "managed-day-date", "2026-10-30");
  change(f.day(), "managed-day-source", "fed");
  const html = f.html();
  expect(html).toContain("No dated items match this date and source selection");
  expect(html).toContain(
    "0 dated items shown · 1 unknown-time items shown · 4 total loaded items",
  );
  expect(html).toContain("Invented announcement without a publication time");
  expect(html).not.toContain('dateTime="2026-10-30T12:30:00.000Z"');
  expect(f.readAgenda).toHaveBeenCalledTimes(2);
  expect(f.readFeed).toHaveBeenCalledOnce();
});
it("retains separate clocks and filters through mixed-source failure/Cancel, then resets only on accepted replacement", async () => {
  const f = await fixture();
  click(f.agendaPanel(), "Load agenda");
  click(f.feedPanel(), "Load announcements");
  await f.idle();
  change(f.day(), "managed-day-date", "2026-10-30");
  change(f.day(), "managed-day-source", "bea");
  const held = deferred<PersonalEconomicCalendarDto>();
  f.readAgenda.mockReturnValueOnce(held.promise);
  f.readFeed.mockRejectedValueOnce(new TrialApiError("unavailable"));
  click(f.agendaPanel(), "Refresh agenda");
  click(f.feedPanel(), "Refresh announcements");
  click(f.agendaPanel(), "Cancel agenda");
  await f.idle();
  const html = f.html();
  expect(html).toContain("Previous schedule");
  expect(html).toContain("Previous announcements");
  expect(html).toContain("Fed announcements could not be loaded");
  expect(control(f.day(), "managed-day-date").props.value).toBe("2026-10-30");
  expect(control(f.day(), "managed-day-source").props.value).toBe("bea");
  held.resolve({ ...f.agenda, events: [] });
  await Promise.resolve();
  await Promise.resolve();
  expect(f.workspace.agenda.getSnapshot().agenda).toBe(f.agenda);
  const stale = control(f.day(), "managed-day-source");
  f.readFeed.mockResolvedValueOnce({
    ...f.feed,
    items: [],
    availableItemCount: 0,
  });
  click(f.feedPanel(), "Refresh announcements");
  await f.idle();
  (stale.props.onChange as (event: unknown) => void)({
    currentTarget: { value: "fed" },
  });
  expect(control(f.day(), "managed-day-source").props.value).toBe("all");
  expect(control(f.day(), "managed-day-date").props.value).toBe("");
  expect(f.html()).toContain("Accepted source data changed");
  expect(f.html()).toContain("No announcements in this loaded feed");
  expect(f.workspace.agenda.getSnapshot().agenda?.fetchedAt).toBe(
    f.agenda.fetchedAt,
  );
});

it("refuses retired filter callbacks without restoring an older date or source choice", async () => {
  const f = await fixture();
  click(f.agendaPanel(), "Load agenda");
  click(f.feedPanel(), "Load announcements");
  await f.idle();
  const oldSource = control(f.day(), "managed-day-source");
  change(f.day(), "managed-day-date", "2026-10-30");
  expect(control(f.day(), "managed-day-date").props.value).toBe("2026-10-30");
  (oldSource.props.onChange as (event: unknown) => void)({
    currentTarget: { value: "fed" },
  });
  expect(control(f.day(), "managed-day-date").props.value).toBe("2026-10-30");
  expect(control(f.day(), "managed-day-source").props.value).toBe("all");
  const oldDate = control(f.day(), "managed-day-date");
  f.workspace.setView("followups");
  (oldDate.props.onChange as (event: unknown) => void)({
    currentTarget: { value: "2026-11-02" },
  });
  expect(control(f.day(), "managed-day-date").props.value).toBe("2026-10-30");
  expect(f.readAgenda).toHaveBeenCalledOnce();
  expect(f.readFeed).toHaveBeenCalledOnce();
});
it("keeps both dirty drafts and source call counts through filters/Inspect and fences navigation and retired late replies", async () => {
  const f = await fixture();
  await f.workspace.followups.coordinator.load();
  f.workspace.note("listing-zero", "Unsaved note 财报");
  const member = f.workspace.coordinator.getSnapshot().draft!.memberships[0]!;
  f.workspace.followups.add(member, "2026-10-30");
  const entry =
    f.workspace.followups.coordinator.getSnapshot().draft!.entries[0]!;
  f.workspace.followups.edit(entry, "check", "Raw check café 📈");
  const before = [
    f.workspace.coordinator.getSnapshot().draft,
    f.workspace.followups.coordinator.getSnapshot().draft,
  ];
  click(f.agendaPanel(), "Load agenda");
  click(f.feedPanel(), "Load announcements");
  await f.idle();
  change(f.day(), "managed-day-date", "2026-10-30");
  click(f.day(), "Inspect Economic calendar");
  expect(f.workspace.coordinator.getSnapshot().draft).toBe(before[0]);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(before[1]);
  expect(f.readAgenda).toHaveBeenCalledOnce();
  expect(f.readFeed).toHaveBeenCalledOnce();
  expect(f.original.getSnapshot()).toMatchObject({
    annual: 0,
    eod: 0,
    filings: 0,
    save: 0,
  });
  expect(f.original.followups!.getSnapshot().save).toBe(0);
  const heldA = deferred<PersonalEconomicCalendarDto>(),
    heldF = deferred<PersonalMonetaryAnnouncementsDto>();
  f.readAgenda.mockReturnValueOnce(heldA.promise);
  f.readFeed.mockReturnValueOnce(heldF.promise);
  click(f.agendaPanel(), "Refresh agenda");
  click(f.feedPanel(), "Refresh announcements");
  const stale = f.day();
  f.workspace.setView("followups");
  expect(f.readAgenda.mock.calls[1]![0].aborted).toBe(true);
  expect(f.readFeed.mock.calls[1]![0].aborted).toBe(true);
  const focus = f.headings.announcements.focus;
  focus.mockClear();
  click(stale, "Inspect Fed announcements");
  expect(focus).not.toHaveBeenCalled();
  f.workspace.sessionOwner.retire("Invented expiry");
  heldA.resolve(f.agenda);
  heldF.resolve(f.feed);
  await Promise.resolve();
  await Promise.resolve();
  expect(f.workspace.agenda.getSnapshot().agenda).toBeNull();
  expect(f.workspace.announcements.getSnapshot().announcements).toBeNull();
  expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(f.html()).not.toContain("Invented October release");
  expect(f.original.followups!.getSnapshot().save).toBe(0);
});

it("loads BLS explicitly, filters and inspects retained schedules in day view while preserving drafts and rejecting late refresh", async () => {
  const f = await fixture();
  await f.workspace.followups.coordinator.load();
  f.workspace.note("listing-zero", "Wanted unsaved note");
  const draft = f.workspace.coordinator.getSnapshot().draft;
  const followups = f.workspace.followups.coordinator.getSnapshot().draft;
  expect(f.html()).toContain("BLS schedule not loaded");
  void f.blsPanel();
  click(f.day(), "Inspect BLS calendar");
  expect(f.headings.bls.focus).toHaveBeenCalledOnce();
  expect(f.readBls).not.toHaveBeenCalled();
  click(f.blsPanel(), "Load BLS calendar");
  await vi.waitFor(() =>
    expect(f.workspace.blsCalendar.getSnapshot().busy).toBe(false),
  );
  expect(f.html()).toContain("Scheduled · BLS");
  const html = renderToStaticMarkup(f.blsPanel());
  expect(html).toContain('href="https://www.bls.gov/schedule/"');
  expect(html).toContain("8:30 AM EDT");
  expect(html).toContain("8:30 AM EST");
  const title = f.bls.events[0]!.series;
  change(f.blsPanel(), "bls-calendar-search", title);
  expect(renderToStaticMarkup(f.blsPanel())).toContain(title);
  change(f.blsPanel(), "bls-calendar-search", "no such invented release");
  expect(renderToStaticMarkup(f.blsPanel())).toContain("No releases match");
  change(f.blsPanel(), "bls-calendar-search", "");
  change(f.blsPanel(), "bls-calendar-date", "2026-11-02");
  const filtered = renderToStaticMarkup(f.blsPanel());
  expect(filtered).toContain("1 of 2 loaded releases");
  expect(filtered).toContain("Invented November release");
  expect(filtered).not.toContain("<p>Invented October release</p>");
  change(f.day(), "managed-day-source", "bls");
  expect(f.html()).toContain("Scheduled · BLS");
  expect(f.readAgenda).not.toHaveBeenCalled();
  expect(f.readFeed).not.toHaveBeenCalled();
  f.workspace.setView("followups");
  f.workspace.setView("markets");
  expect(f.workspace.blsCalendar.getSnapshot().calendar).toBe(f.bls);
  expect(f.readBls).toHaveBeenCalledOnce();
  expect(f.workspace.coordinator.getSnapshot().draft).toBe(draft);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(followups);
  const held = deferred<typeof f.bls>();
  f.readBls.mockReturnValueOnce(held.promise);
  click(f.blsPanel(), "Refresh BLS calendar");
  click(f.blsPanel(), "Cancel BLS load");
  expect(f.readBls.mock.calls[1]![0].aborted).toBe(true);
  held.resolve({ ...f.bls, events: [] });
  await Promise.resolve();
  await Promise.resolve();
  expect(f.workspace.blsCalendar.getSnapshot()).toMatchObject({
    calendar: f.bls,
    showingPrevious: true,
  });
  expect(f.html()).toContain("Previous BLS schedule");
  f.workspace.sessionOwner.retire("Invented expiry");
  expect(f.workspace.blsCalendar.getSnapshot().calendar).toBeNull();
  expect(f.original.getSnapshot()).toMatchObject({
    save: 0,
    annual: 0,
    eod: 0,
    filings: 0,
  });
});
function keepButtons(node: React.ReactNode) {
  return nodes(node)
    .filter(
      (item) => typeof item.type === "function" && "entries" in item.props,
    )
    .flatMap((item) =>
      nodes(
        (item.type as (props: Record<string, unknown>) => React.ReactNode)(
          item.props,
        ),
      ),
    )
    .filter((item) => "data-calendar-entry-key" in item.props);
}
it("offers an explicit row action for dated and unknown entries and retires old row/filter callbacks", async () => {
  const f = await fixture();
  await f.workspace.agenda.load();
  await f.workspace.announcements.load();
  const onKeepCheck = vi.fn();
  f.props.onKeepCheck = onKeepCheck;
  const before = f.day();
  const buttons = keepButtons(before);
  expect(buttons).toHaveLength(4);
  expect(
    buttons.every((button) => button.props.children === "Keep a dated check"),
  ).toBe(true);
  const unknown = buttons.find(
    (button) =>
      button.props["data-calendar-entry-key"] === `fed:${f.feed.items[1]!.url}`,
  )!;
  (unknown.props.onClick as () => void)();
  expect(onKeepCheck).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Invented announcement without a publication time",
      instant: null,
    }),
    expect.anything(),
  );
  const capturedCurrent = onKeepCheck.mock.calls[0]![1] as () => boolean;
  expect(typeof capturedCurrent).toBe("function");
  expect(capturedCurrent()).toBe(true);
  change(f.day(), "managed-day-source", "bea");
  void f.day();
  expect(capturedCurrent()).toBe(false);
  (unknown.props.onClick as () => void)();
  expect(onKeepCheck).toHaveBeenCalledOnce();
  const dated = keepButtons(f.day())[0]!;
  f.workspace.setView("followups");
  (dated.props.onClick as () => void)();
  expect(onKeepCheck).toHaveBeenCalledOnce();
  expect(f.original.followups!.getSnapshot().load).toBe(0);
});
it("keeps the explicit null profile read-only without row actions", async () => {
  const f = await fixture();
  await f.workspace.agenda.load();
  expect(keepButtons(f.day())).toHaveLength(0);
  expect(f.html()).not.toContain("Keep a dated check");
});
