import { describe, expect, it } from "vitest";
import { parseManagedEconomicCalendar } from "@research-cockpit/contracts";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { compareBeaAgendas } from "../features/markets/bea-agenda-comparison";
import { projectBeaReleaseView } from "../features/markets/bea-release-view";
import { projectManagedBeaUpdatesView } from "./managed-bea-updates-view";

function fixture() {
  const current = parseManagedEconomicCalendar(economicCalendarFixture())!;
  const previous = parseManagedEconomicCalendar({
    ...economicCalendarFixture(),
    events: [current.events[0]!],
  })!;
  return { current, previous, pair: compareBeaAgendas(previous, current)! };
}
describe("managed BEA updates projection", () => {
  it("requires a comparison for the exact current response and returns All without altering its reading view", () => {
    const { current, pair } = fixture();
    const reading = projectBeaReleaseView(current, "", "");
    for (const comparison of [null, { ...pair, current: { ...current } }]) {
      const result = projectManagedBeaUpdatesView(reading, comparison, "new");
      expect(result).toMatchObject({ refreshView: "all", available: false });
      expect(result.view).toBe(reading);
    }
    expect(projectManagedBeaUpdatesView(reading, pair, "all").view).toBe(
      reading,
    );
  });
  it("intersects current-only entries with the original phrase and Eastern date, preserving every date option and event object", () => {
    const { current, pair } = fixture();
    const reading = projectBeaReleaseView(current, "2026-11-02", " nOVEMBER ");
    const result = projectManagedBeaUpdatesView(reading, pair, "new");
    expect(result.refreshView).toBe("new");
    expect(result.available).toBe(true);
    expect(result.view.response).toBe(current);
    expect(result.view.groups).toBe(reading.groups);
    expect(result.view.query).toBe(" nOVEMBER ");
    expect(result.view.selectedDate).toBe("2026-11-02");
    expect(result.view.visibleCount).toBe(1);
    expect(result.view.visibleGroups[0]!.events[0]).toBe(current.events[1]);
    expect(current.events).toHaveLength(2);
    expect(pair.addedEvents).toEqual([current.events[1]]);
  });
  it("does not select a retained event or replace an empty intersection with a fallback", () => {
    const { current, pair } = fixture();
    for (const reading of [
      projectBeaReleaseView(current, "2026-10-30", ""),
      projectBeaReleaseView(current, "", "October"),
      projectBeaReleaseView(current, "", "No matches"),
    ]) {
      const result = projectManagedBeaUpdatesView(reading, pair, "new");
      expect(result.view.visibleGroups).toEqual([]);
      expect(result.view.visibleCount).toBe(0);
      expect(result.view.groups).toBe(reading.groups);
    }
  });
  it("keeps a valid zero comparison available and distinguishes it from no comparison or a verified empty response", () => {
    const { current } = fixture();
    const equal = parseManagedEconomicCalendar(economicCalendarFixture())!;
    const pair = compareBeaAgendas(current, equal)!;
    const zero = projectManagedBeaUpdatesView(
      projectBeaReleaseView(equal, "", ""),
      pair,
      "new",
    );
    expect(zero).toMatchObject({
      available: true,
      refreshView: "new",
      view: { visibleCount: 0 },
    });
    expect(zero.view.groups).toHaveLength(2);
    const empty = parseManagedEconomicCalendar({ ...equal, events: [] })!;
    const emptyView = projectManagedBeaUpdatesView(
      projectBeaReleaseView(empty, "", ""),
      compareBeaAgendas(equal, empty),
      "new",
    );
    expect(emptyView.available).toBe(true);
    expect(emptyView.view.groups).toEqual([]);
    expect(emptyView.view.response).toBe(empty);
  });
});
