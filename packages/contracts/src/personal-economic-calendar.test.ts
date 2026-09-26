import { describe, expect, it } from "vitest";
import {
  isPersonalEconomicCalendarDto,
  PERSONAL_BEA_CALENDAR_SOURCE,
} from "./personal-economic-calendar";

function agenda() {
  return {
    schemaVersion: "1.0.0",
    source: { ...PERSONAL_BEA_CALENDAR_SOURCE },
    fetchedAt: "2026-10-20T18:00:00.000Z",
    window: {
      fromInclusive: "2026-10-20T18:00:00.000Z",
      toExclusive: "2026-11-19T18:00:00.000Z",
    },
    events: [
      { series: "GDP", scheduledAt: "2026-10-29T12:30:00.000Z" },
      { series: "Personal Income", scheduledAt: "2026-10-29T12:30:00.000Z" },
      { series: "Trade", scheduledAt: "2026-11-04T13:30:00.000Z" },
    ],
  };
}

describe("BEA agenda response contract", () => {
  it("admits simultaneous different series and an exact window across DST", () => {
    expect(isPersonalEconomicCalendarDto(agenda())).toBe(true);
    expect(isPersonalEconomicCalendarDto({ ...agenda(), events: [] })).toBe(
      true,
    );
  });

  it("includes the first instant and excludes the last instant", () => {
    const value = agenda();
    value.events = [{ series: "First", scheduledAt: value.fetchedAt }];
    expect(isPersonalEconomicCalendarDto(value)).toBe(true);
    value.events[0]!.scheduledAt = value.window.toExclusive;
    expect(isPersonalEconomicCalendarDto(value)).toBe(false);
    value.events[0]!.scheduledAt = "2026-10-20T17:59:59.999Z";
    expect(isPersonalEconomicCalendarDto(value)).toBe(false);
  });

  it("rejects duplicate or unsorted series at the same instant", () => {
    const value = agenda();
    value.events.splice(1, 0, { ...value.events[0]! });
    expect(isPersonalEconomicCalendarDto(value)).toBe(false);
    expect(
      isPersonalEconomicCalendarDto({
        ...agenda(),
        events: agenda().events.reverse(),
      }),
    ).toBe(false);
  });

  it("rejects invented source links and unsupported value fields", () => {
    const value = agenda();
    expect(
      isPersonalEconomicCalendarDto({
        ...value,
        source: { ...value.source, scheduleUrl: "https://example.com" },
      }),
    ).toBe(false);
    expect(
      isPersonalEconomicCalendarDto({
        ...value,
        events: [{ ...value.events[0], forecast: 3 }],
      }),
    ).toBe(false);
  });

  it("requires real canonical instants and an exact 30-day fetched window", () => {
    const value = agenda();
    expect(
      isPersonalEconomicCalendarDto({
        ...value,
        fetchedAt: "2026-02-30T18:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      isPersonalEconomicCalendarDto({
        ...value,
        events: [{ series: "GDP", scheduledAt: "2026-10-29T08:30:00-04:00" }],
      }),
    ).toBe(false);
    expect(
      isPersonalEconomicCalendarDto({
        ...value,
        window: { ...value.window, fromInclusive: "2026-10-20T17:00:00.000Z" },
      }),
    ).toBe(false);
    expect(
      isPersonalEconomicCalendarDto({
        ...value,
        window: { ...value.window, toExclusive: "2026-11-19T19:00:00.000Z" },
      }),
    ).toBe(false);
  });

  it("rejects unsafe labels and oversized collections", () => {
    const value = agenda();
    for (const series of [
      "",
      " GDP",
      "GDP\nrelease",
      "GDP\u202e",
      "x".repeat(257),
    ]) {
      expect(
        isPersonalEconomicCalendarDto({
          ...value,
          events: [{ ...value.events[0], series }],
        }),
      ).toBe(false);
    }
    expect(
      isPersonalEconomicCalendarDto({
        ...value,
        events: Array.from({ length: 513 }, (_, index) => ({
          series: `Series ${String(index).padStart(3, "0")}`,
          scheduledAt: value.events[0]!.scheduledAt,
        })),
      }),
    ).toBe(false);
  });
});
