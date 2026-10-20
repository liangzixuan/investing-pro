import { expect, it } from "vitest";
import {
  MANAGED_BLS_CALENDAR_SOURCE,
  parseManagedBlsCalendar,
  parseManagedEconomicCalendar,
  parseManagedMonetaryAnnouncements,
} from "@research-cockpit/contracts";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import { projectMarketsDayView } from "./markets-day-view";

it("keeps matching BLS and BEA names and instants separate with source-specific filters and links", () => {
  const { agenda, fed } = packets();
  const bls = parseManagedBlsCalendar({
    ...agenda,
    source: MANAGED_BLS_CALENDAR_SOURCE,
  })!;
  const all = projectMarketsDayView(bls, agenda, fed, "", "all");
  expect(all.loadedCount).toBe(7);
  expect(
    new Set(
      all.groups.flatMap((group) => group.entries.map((entry) => entry.key)),
    ).size,
  ).toBe(6);
  const onlyBls = projectMarketsDayView(bls, agenda, fed, "2026-10-30", "bls");
  expect(onlyBls.visibleDatedCount).toBe(2);
  expect(onlyBls.unknown).toEqual([]);
  expect(
    onlyBls.visibleGroups[0]!.entries.every(
      (entry) =>
        entry.source === "bls" &&
        entry.url === MANAGED_BLS_CALENDAR_SOURCE.scheduleUrl,
    ),
  ).toBe(true);
});

function packets() {
  const agenda = parseManagedEconomicCalendar({
    ...economicCalendarFixture(),
    events: [
      {
        series: "Invented output release",
        scheduledAt: "2026-10-30T12:30:00.000Z",
      },
      {
        series: "Invented price release",
        scheduledAt: "2026-10-30T12:30:00.000Z",
      },
    ],
  });
  const fed = parseManagedMonetaryAnnouncements({
    ...fedAnnouncementsFixture(),
    fetchedAt: "2026-10-31T05:00:00.000Z",
    availableItemCount: 3,
    items: [
      {
        ...fedAnnouncementsFixture().items[0]!,
        publishedAt: "2026-10-31T00:30:00.000Z",
      },
      {
        ...fedAnnouncementsFixture().items[0]!,
        url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261030b.htm",
        publishedAt: "2026-10-30T12:30:00.000Z",
      },
      fedAnnouncementsFixture().items[1]!,
    ],
  });
  if (!agenda || !fed)
    throw new Error("Invented packets must pass current admission");
  return { agenda, fed };
}
it("joins Eastern dates without conflating scheduled series, publication URLs or unknown times", () => {
  const { agenda, fed } = packets();
  const view = projectMarketsDayView(null, agenda, fed, "", "all");
  expect(view.groups.map((g) => g.date)).toEqual(["2026-10-30"]);
  expect(
    view.groups[0]!.entries.map((e) => [e.source, e.title, e.instant]),
  ).toEqual([
    ["bea", "Invented output release", "2026-10-30T12:30:00.000Z"],
    ["bea", "Invented price release", "2026-10-30T12:30:00.000Z"],
    ["fed", fed.items[1]!.title, "2026-10-30T12:30:00.000Z"],
    ["fed", fed.items[0]!.title, "2026-10-31T00:30:00.000Z"],
  ]);
  expect(new Set(view.groups[0]!.entries.map((e) => e.key)).size).toBe(4);
  expect(view.unknown).toEqual([
    {
      key: `fed:${fed.items[2]!.url}`,
      source: "fed",
      title: fed.items[2]!.title,
      instant: null,
      url: fed.items[2]!.url,
    },
  ]);
  expect(view.loadedCount).toBe(5);
  expect(view.visibleDatedCount).toBe(4);
});
it.each([
  [
    "2026-03-08T00:00:00.000Z",
    "2026-04-07T00:00:00.000Z",
    "2026-03-08T06:30:00.000Z",
    "2026-03-08T07:30:00.000Z",
    "2026-03-08",
  ],
  [
    "2026-11-01T00:00:00.000Z",
    "2026-12-01T00:00:00.000Z",
    "2026-11-01T05:30:00.000Z",
    "2026-11-01T06:30:00.000Z",
    "2026-11-01",
  ],
])(
  "keeps exact instant order across DST from %s",
  (from, to, first, second, date) => {
    const agenda = parseManagedEconomicCalendar({
      ...economicCalendarFixture(),
      fetchedAt: from,
      window: { fromInclusive: from, toExclusive: to },
      events: [
        { series: "First", scheduledAt: first },
        { series: "Second", scheduledAt: second },
      ],
    });
    if (!agenda) throw new Error("Invalid DST fixture");
    const view = projectMarketsDayView(null, agenda, null, "", "all");
    expect(view.groups.map((g) => g.date)).toEqual([date]);
    expect(view.groups[0]!.entries.map((e) => e.instant)).toEqual([
      first,
      second,
    ]);
  },
);
it("intersects source/date filters and keeps unknown times outside the selected date", () => {
  const { agenda, fed } = packets();
  const view = projectMarketsDayView(null, agenda, fed, "2026-10-30", "fed");
  expect(view.visibleDatedCount).toBe(2);
  expect(view.unknown).toHaveLength(1);
  expect(view.groups[0]!.entries).toHaveLength(4);
  expect(
    projectMarketsDayView(null, agenda, fed, "2026-10-30", "bea").unknown,
  ).toEqual([]);
  expect(
    projectMarketsDayView(null, agenda, fed, "invalid", "all").selectedDate,
  ).toBe("");
});
it("keeps all 512 schedule entries and ten feed items without silent truncation", () => {
  const raw = economicCalendarFixture();
  const agenda = parseManagedEconomicCalendar({
    ...raw,
    events: Array.from({ length: 512 }, (_, i) => ({
      series: `Invented ${String(i).padStart(3, "0")}`,
      scheduledAt: "2026-10-30T12:30:00.000Z",
    })),
  });
  const fed = parseManagedMonetaryAnnouncements({
    ...fedAnnouncementsFixture(),
    availableItemCount: 128,
    items: Array.from({ length: 10 }, (_, i) => ({
      title: `Invented ${i}`,
      url: `https://www.federalreserve.gov/newsevents/pressreleases/monetary20261019${String.fromCharCode(97 + i)}.htm`,
      publishedAt: "2026-10-19T18:00:00.000Z",
    })),
  });
  if (!agenda || !fed) throw new Error("Maximum packets refused");
  const view = projectMarketsDayView(null, agenda, fed, "", "all");
  expect(view.loadedCount).toBe(522);
  expect(view.visibleDatedCount).toBe(522);
  expect(
    new Set(view.groups.flatMap((g) => g.entries.map((e) => e.key))).size,
  ).toBe(522);
});
it("owns its frozen projection without freezing or sorting mutable typed inputs", () => {
  const { agenda, fed } = packets();
  const a = { ...agenda, events: agenda.events.map((row) => ({ ...row })) };
  const f = { ...fed, items: fed.items.map((row) => ({ ...row })) };
  const before = JSON.stringify([a, f]);
  const view = projectMarketsDayView(null, a, f, "", "all");
  expect(JSON.stringify([a, f])).toBe(before);
  expect(Object.isFrozen(a.events)).toBe(false);
  expect(Object.isFrozen(f.items)).toBe(false);
  expect(Object.isFrozen(view)).toBe(true);
  expect(Object.isFrozen(view.groups[0]!.entries[0])).toBe(true);
  expect(Object.isFrozen(view.visibleGroups[0]!.entries)).toBe(true);
  expect(Object.isFrozen(view.unknown)).toBe(true);
  a.events[0]!.series = "Changed caller data";
  expect(view.groups[0]!.entries[0]!.title).toBe("Invented output release");
});
it("keeps null and verified empty inputs safely empty without inventing source rows", () => {
  const view = projectMarketsDayView(null, null, null, "", "all");
  expect(view.loadedCount).toBe(0);
  expect(view.groups).toEqual([]);
  expect(view.unknown).toEqual([]);
  expect(
    projectMarketsDayView(
      null,
      { ...economicCalendarFixture(), events: [] },
      null,
      "",
      "all",
    ).visibleDatedCount,
  ).toBe(0);
});
