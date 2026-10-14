import { describe, expect, it } from "vitest";
import {
  PERSONAL_BEA_CALENDAR_SOURCE,
  parseManagedEconomicCalendar,
} from "@research-cockpit/contracts";
import { compareBeaAgendas } from "./bea-agenda-comparison";

const economicCalendarFixture = () => ({
  schemaVersion: "1.0.0",
  source: PERSONAL_BEA_CALENDAR_SOURCE,
  fetchedAt: "2026-10-20T18:00:00.000Z",
  window: {
    fromInclusive: "2026-10-20T18:00:00.000Z",
    toExclusive: "2026-11-19T18:00:00.000Z",
  },
  events: [
    {
      series: "Invented October release",
      scheduledAt: "2026-10-30T12:30:00.000Z",
    },
    {
      series: "Invented November release",
      scheduledAt: "2026-11-02T13:30:00.000Z",
    },
  ],
});

describe("consecutive admitted BEA agendas", () => {
  it("requires a previous load and preserves exact response and original event identities", () => {
    const current = parseManagedEconomicCalendar(economicCalendarFixture())!;
    expect(compareBeaAgendas(null, current)).toBeNull();
    const previous = parseManagedEconomicCalendar({
      ...current,
      events: [current.events[0]!],
    })!;
    const pair = compareBeaAgendas(previous, current)!;
    expect(pair.previous).toBe(previous);
    expect(pair.current).toBe(current);
    expect(pair.addedEvents).toEqual([current.events[1]]);
    expect(pair.addedEvents[0]).toBe(current.events[1]);
    expect(Object.isFrozen(pair) && Object.isFrozen(pair.addedEvents)).toBe(
      true,
    );
    expect(previous.events).toHaveLength(1);
    expect(current.events).toHaveLength(2);
  });

  it("matches the exact series and UTC time pair, keeping equal times and different series distinct", () => {
    const previous = parseManagedEconomicCalendar(economicCalendarFixture())!;
    const first = previous.events[0]!;
    const current = parseManagedEconomicCalendar({
      ...previous,
      events: [
        { ...first },
        { ...first, series: "Invented same-time series" },
        { ...first, scheduledAt: "2026-11-02T13:30:00.000Z" },
      ],
    })!;
    expect(current).not.toBeNull();
    expect(compareBeaAgendas(previous, current)!.addedEvents).toEqual(
      current.events.slice(1),
    );
    const equal = parseManagedEconomicCalendar({ ...previous })!;
    expect(compareBeaAgendas(previous, equal)!.addedEvents).toEqual([]);
  });

  it("keeps empty and disjoint moving windows as observations without manufacturing old entries", () => {
    const previous = parseManagedEconomicCalendar(economicCalendarFixture())!;
    const empty = parseManagedEconomicCalendar({ ...previous, events: [] })!;
    expect(compareBeaAgendas(previous, empty)!.addedEvents).toEqual([]);
    expect(compareBeaAgendas(empty, previous)!.addedEvents).toEqual(
      previous.events,
    );
    const moved = parseManagedEconomicCalendar({
      ...previous,
      fetchedAt: "2026-12-01T18:00:00.000Z",
      window: {
        fromInclusive: "2026-12-01T18:00:00.000Z",
        toExclusive: "2026-12-31T18:00:00.000Z",
      },
      events: [
        {
          series: "Invented December release",
          scheduledAt: "2026-12-10T13:30:00.000Z",
        },
      ],
    })!;
    expect(moved).not.toBeNull();
    const pair = compareBeaAgendas(previous, moved)!;
    expect(pair.addedEvents).toEqual(moved.events);
    expect(pair.previous.window).toBe(previous.window);
    expect(pair.current.window).toBe(moved.window);
  });
});
