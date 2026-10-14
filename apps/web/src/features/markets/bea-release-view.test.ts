import {
  PERSONAL_BEA_CALENDAR_SOURCE,
  parseManagedEconomicCalendar,
  type PersonalEconomicCalendarEventDto,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import { projectBeaReleaseView } from "./bea-release-view";

function packet(events: readonly PersonalEconomicCalendarEventDto[]) {
  const result = parseManagedEconomicCalendar({
    schemaVersion: "1.0.0",
    source: PERSONAL_BEA_CALENDAR_SOURCE,
    fetchedAt: "2026-10-20T18:00:00.000Z",
    window: {
      fromInclusive: "2026-10-20T18:00:00.000Z",
      toExclusive: "2026-11-19T18:00:00.000Z",
    },
    events,
  });
  expect(result).not.toBeNull();
  return result!;
}

function fixture() {
  return packet([
    {
      series: "Invented GDP midnight",
      scheduledAt: "2026-10-30T00:30:00.000Z",
    },
    { series: "Invented GDP", scheduledAt: "2026-10-30T12:30:00.000Z" },
    { series: "Invented Income", scheduledAt: "2026-10-30T12:30:00.000Z" },
    { series: "Invented GDP", scheduledAt: "2026-11-02T13:30:00.000Z" },
  ]);
}

describe("loaded BEA release projection", () => {
  it("keeps an unloaded response distinct from an admitted empty packet", () => {
    const unloaded = projectBeaReleaseView(null, "2026-10-30", " GDP ");
    expect(unloaded).toEqual({
      response: null,
      selectedDate: "",
      query: " GDP ",
      groups: [],
      visibleGroups: [],
      visibleCount: 0,
    });
    const empty = packet([]);
    const loaded = projectBeaReleaseView(empty, "2026-10-30", " GDP ");
    expect(loaded.response).toBe(empty);
    expect(loaded.groups).toEqual([]);
    expect(loaded.visibleGroups).toEqual([]);
    expect(loaded.visibleCount).toBe(0);
    expect(loaded.selectedDate).toBe("");
  });

  it("retains exact events and source order across midnight, simultaneous series and daylight saving time", () => {
    const response = fixture();
    const before = JSON.stringify(response);
    const view = projectBeaReleaseView(response, "", " \t\n\u00a0 ");
    expect(view.response).toBe(response);
    expect(view.query).toBe(" \t\n\u00a0 ");
    expect(view.groups.map(({ key, events }) => [key, events.length])).toEqual([
      ["2026-10-29", 1],
      ["2026-10-30", 2],
      ["2026-11-02", 1],
    ]);
    expect(view.visibleCount).toBe(4);
    view.visibleGroups
      .flatMap((group) => group.events)
      .forEach((event, index) => {
        expect(event).toBe(response.events[index]);
      });
    expect(JSON.stringify(response)).toBe(before);
  });

  it("intersects the phrase and Eastern date while retaining full date groups", () => {
    const response = fixture();
    const view = projectBeaReleaseView(response, "2026-10-30", "  gDp  ");
    expect(view.selectedDate).toBe("2026-10-30");
    expect(view.query).toBe("  gDp  ");
    expect(view.visibleCount).toBe(1);
    expect(view.visibleGroups).toHaveLength(1);
    expect(view.visibleGroups[0]!.events[0]).toBe(response.events[1]);
    expect(view.groups.map((group) => group.events.length)).toEqual([1, 2, 1]);
    const excluded = projectBeaReleaseView(response, "2026-11-02", "income");
    expect(excluded.selectedDate).toBe("2026-11-02");
    expect(excluded.groups).toHaveLength(3);
    expect(excluded.visibleGroups).toEqual([]);
    expect(excluded.visibleCount).toBe(0);
    expect(projectBeaReleaseView(response, "2026-11-02", "").visibleCount).toBe(
      1,
    );
  });

  it("treats an unknown date as All loaded dates without removing the query", () => {
    const response = fixture();
    const view = projectBeaReleaseView(response, "2026-10-31", "income");
    expect(view.selectedDate).toBe("");
    expect(view.query).toBe("income");
    expect(view.visibleCount).toBe(1);
    expect(view.visibleGroups[0]!.events[0]).toBe(response.events[2]);
  });

  it.each([
    [
      "Invented Gross  domestic\u00a0product",
      " gross\t domestic \nPRODUCT ",
      1,
    ],
    ["Invented ΟΣ", "ος", 1],
    ["Invented ΟΣ", "οσ", 0],
    ["Invented İstatistik", "i\u0307STAT", 1],
    ["Invented İstatistik", "istat", 0],
    ["Invented Résumé 😀", "résumé 😀", 1],
    ["Invented Résumé 😀", "resume", 0],
    ["Invented Gross domestic product", "product gross", 0],
  ] as const)(
    "matches full-string phrases in %s with %s",
    (series, query, count) => {
      const response = packet([
        { series, scheduledAt: "2026-10-30T12:30:00.000Z" },
      ]);
      const view = projectBeaReleaseView(response, "", query);
      expect(view.visibleCount).toBe(count);
      expect(view.query).toBe(query);
      expect(response.events[0]!.series).toBe(series);
      if (count)
        expect(view.visibleGroups[0]!.events[0]).toBe(response.events[0]);
    },
  );

  it("keeps all 512 admitted events and the last original index with a full 256-unit Unicode label", () => {
    const series = "Z" + "界".repeat(253) + "😀";
    expect(series.length).toBe(256);
    const response = packet(
      Array.from({ length: 512 }, (_, index) => ({
        series:
          index === 511
            ? series
            : `Invented release ${String(index).padStart(3, "0")}`,
        scheduledAt: "2026-10-30T12:30:00.000Z",
      })),
    );
    const full = projectBeaReleaseView(response, "", "");
    expect(full.visibleCount).toBe(512);
    const view = projectBeaReleaseView(response, "2026-10-30", "界😀");
    const event = view.visibleGroups[0]!.events[0]!;
    expect(view.visibleCount).toBe(1);
    expect(view.groups[0]!.events).toHaveLength(512);
    expect(event).toBe(response.events[511]);
    expect(response.events.indexOf(event)).toBe(511);
    expect(event.series).toBe(series);
    expect(projectBeaReleaseView(response, "", series + "x").visibleCount).toBe(
      0,
    );
  });
});
