import { describe, expect, it } from "vitest";
import {
  MANAGED_BLS_CALENDAR_SOURCE,
  parseManagedBlsCalendar,
  parseManagedEconomicCalendar,
} from "./index";
const packet = () => ({
  schemaVersion: "1.0.0",
  source: { ...MANAGED_BLS_CALENDAR_SOURCE },
  fetchedAt: "2026-10-20T00:00:00.000Z",
  window: {
    fromInclusive: "2026-10-20T00:00:00.000Z",
    toExclusive: "2026-11-19T00:00:00.000Z",
  },
  events: [
    { series: "Invented employment", scheduledAt: "2026-11-06T13:30:00.000Z" },
  ],
});
describe("BLS source packet", () => {
  it("owns a frozen complete packet and preserves an empty supported window", () => {
    const raw = packet();
    const parsed = parseManagedBlsCalendar(raw)!;
    expect(parsed).toEqual(raw);
    expect(parsed).not.toBe(raw);
    raw.events[0]!.series = "Changed";
    raw.window.toExclusive = "changed";
    expect(parsed.events[0]!.series).toBe("Invented employment");
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.window)).toBe(true);
    expect(Object.isFrozen(parsed.events[0])).toBe(true);
    expect(
      parseManagedBlsCalendar({ ...packet(), events: [] })?.events,
    ).toEqual([]);
    expect(parseManagedEconomicCalendar(packet())).toBeNull();
  });
  it.each([
    (p: ReturnType<typeof packet>) => ({
      ...p,
      source: { ...p.source, id: "bea" },
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      source: { ...p.source, scheduleUrl: "https://example.org" },
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      fetchedAt: "2026-10-20T00:00:00Z",
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      window: { ...p.window, toExclusive: "2026-11-20T00:00:00.000Z" },
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      events: [{ series: "Invented", scheduledAt: p.window.toExclusive }],
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      events: [p.events[0], p.events[0]],
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      events: [{ series: "Un\u200bverified", scheduledAt: p.fetchedAt }],
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      events: [{ series: "x".repeat(257), scheduledAt: p.fetchedAt }],
    }),
    (p: ReturnType<typeof packet>) => ({ ...p, [Symbol("extra")]: 1 }),
    (p: ReturnType<typeof packet>) =>
      Object.defineProperty(p, "fetchedAt", {
        get: () => {
          throw new Error("must not invoke");
        },
      }),
  ])("rejects wrong agency, malformed or unbounded data %#", (change) => {
    expect(parseManagedBlsCalendar(change(packet()))).toBeNull();
  });
  it("admits the inclusive edge and 512 sorted distinct releases, but refuses unsorted and over-cap packets", () => {
    const p = packet();
    const events = Array.from({ length: 512 }, (_, i) => ({
      series: `Invented ${String(i).padStart(3, "0")}`,
      scheduledAt: p.fetchedAt,
    }));
    expect(parseManagedBlsCalendar({ ...p, events })?.events).toHaveLength(512);
    expect(
      parseManagedBlsCalendar({ ...p, events: [...events].reverse() }),
    ).toBeNull();
    expect(
      parseManagedBlsCalendar({
        ...p,
        events: [...events, { series: "Last", scheduledAt: p.fetchedAt }],
      }),
    ).toBeNull();
  });
});
