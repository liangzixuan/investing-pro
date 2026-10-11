import { describe, expect, it } from "vitest";
import { PERSONAL_BEA_CALENDAR_SOURCE } from "./personal-economic-calendar";
import {
  MANAGED_ECONOMIC_CALENDAR_LIMITS,
  parseManagedEconomicCalendar,
} from "./managed-economic-calendar";

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
      { series: "Income", scheduledAt: "2026-10-29T12:30:00.000Z" },
      { series: "Trade", scheduledAt: "2026-11-04T13:30:00.000Z" },
    ],
  };
}

describe("managed BEA agenda ownership", () => {
  it("owns and freezes a validated packet without changing its dates", () => {
    const input = agenda();
    const parsed = parseManagedEconomicCalendar(input);
    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    expect(parsed?.window).not.toBe(input.window);
    expect(parsed?.events[0]).not.toBe(input.events[0]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed?.source)).toBe(true);
    expect(Object.isFrozen(parsed?.window)).toBe(true);
    expect(Object.isFrozen(parsed?.events)).toBe(true);
    expect(Object.isFrozen(parsed?.events[0])).toBe(true);

    input.fetchedAt = "2026-10-21T18:00:00.000Z";
    input.window.toExclusive = "2026-11-20T18:00:00.000Z";
    input.events[0]!.series = "Changed by caller";
    input.events.pop();
    expect(parsed).toEqual(agenda());
  });

  it("keeps the same strict source, window, event and field validation", () => {
    const value = agenda();
    for (const invalid of [
      null,
      { ...value, source: { ...value.source, id: "other" } },
      { ...value, actual: 42 },
      { ...value, events: [{ ...value.events[0], consensus: 42 }] },
      { ...value, events: [...value.events].reverse() },
      { ...value, window: { ...value.window, toExclusive: value.fetchedAt } },
    ]) {
      expect(parseManagedEconomicCalendar(invalid)).toBeNull();
    }
    expect(
      parseManagedEconomicCalendar({ ...value, events: [] })?.events,
    ).toEqual([]);
  });

  it("fits the maximum normalized UTF-8 agenda within the managed body cap", () => {
    const value = agenda();
    value.events = Array.from({ length: 512 }, (_, index) => ({
      // Three UTF-8 bytes per UTF-16 code unit; every series stays distinct.
      series: `${String(index).padStart(3, "0")}${"界".repeat(253)}`,
      scheduledAt: value.fetchedAt,
    }));
    const parsed = parseManagedEconomicCalendar(value);
    expect(parsed).not.toBeNull();
    expect(
      new TextEncoder().encode(JSON.stringify(parsed)).byteLength,
    ).toBeLessThan(MANAGED_ECONOMIC_CALENDAR_LIMITS.responseBytes);
  });
});
