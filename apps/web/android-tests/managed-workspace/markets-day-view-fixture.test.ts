import { afterEach, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createFixture, beaAgenda, marketsDayAnnouncements } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { ManagedMarketsDayView } from "../../src/clerk-trial/ManagedMarketsDayView";
import { projectMarketsDayView } from "../../src/clerk-trial/markets-day-view";
import type { ManagedMarketsNavigationProps } from "../../src/clerk-trial/ManagedMarketsNavigation";

const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
});
const navigation: ManagedMarketsNavigationProps = {
  containerRef: { current: null },
  isCurrent: () => true,
  targets: Object.fromEntries(
    ["board", "review", "day", "calendar", "announcements"].map((key) => [
      key,
      { id: key, ref: { current: null } },
    ]),
  ) as ManagedMarketsNavigationProps["targets"],
};

it("composes both admitted sources with two real dirty drafts and fences each failed, cancelled and retired read", async () => {
  const fixture = await createFixture("markets-day-view");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      priceCoverage: fixture.priceCoverage,
      marketsCohort: fixture.marketsCohort,
    },
  );
  workspaces.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  const controls = fixture.followups!;
  expect(controls.getSnapshot()).toMatchObject({ load: 0, save: 0 });
  expect(fixture.getSnapshot()).toMatchObject({ calendar: 0, fed: 0 });
  workspace.setView("watchlist");
  workspace.note("listing-zero", "Independent calendar draft 日本語  ");
  const watchlist = workspace.coordinator.getSnapshot().draft!;
  workspace.setView("followups");
  await workspace.followups.coordinator.load();
  workspace.followups.add(watchlist.memberships[0]!, "2026-10-30");
  const id = workspace.followups.getSnapshot().selectedId!;
  workspace.followups.edit(
    workspace.followups.currentEntry(id)!,
    "check",
    "Read the source dates Δ  ",
  );
  const followups = workspace.followups.coordinator.getSnapshot().draft!;
  workspace.setView("markets");
  const html = () =>
    renderToStaticMarkup(
      createElement(ManagedMarketsDayView, {
        agenda: workspace.agenda,
        announcements: workspace.announcements,
        navigation,
      }),
    );
  expect(html()).toContain("BEA schedule not loaded.");
  expect(html()).toContain("Fed announcements not loaded.");
  await workspace.agenda.load();
  expect(workspace.announcements.getSnapshot().announcements).toBeNull();
  await workspace.announcements.load();
  const agenda = workspace.agenda.getSnapshot().agenda!;
  const fed = workspace.announcements.getSnapshot().announcements!;
  expect(agenda).toEqual(beaAgenda);
  expect(fed).toEqual(marketsDayAnnouncements);
  expect(html()).toContain("Scheduled · BEA");
  expect(html()).toContain("Published · Federal Reserve");
  expect(html()).toContain("Publication time unknown.");
  expect(html()).toContain('dateTime="2026-10-30T00:30:00.000Z"');
  const requests = fixture.getSnapshot();
  const followupRequests = controls.getSnapshot();
  const view = (source: "all" | "bea" | "fed") =>
    projectMarketsDayView(agenda, fed, "2026-10-29", source);
  expect(
    view("all").visibleGroups[0]!.entries.map((entry) => [
      entry.source,
      entry.instant,
    ]),
  ).toEqual([
    ["bea", "2026-10-29T12:30:00.000Z"],
    ["bea", "2026-10-29T12:30:00.000Z"],
    ["fed", "2026-10-30T00:30:00.000Z"],
  ]);
  expect(view("all")).toMatchObject({ loadedCount: 5, visibleDatedCount: 3 });
  expect(view("bea")).toMatchObject({ visibleDatedCount: 2, unknown: [] });
  expect(view("fed")).toMatchObject({ visibleDatedCount: 1 });
  expect(view("fed").unknown).toHaveLength(1);
  expect(view("fed").unknown[0]!.instant).toBeNull();
  expect(fixture.getSnapshot()).toBe(requests);
  expect(controls.getSnapshot()).toBe(followupRequests);

  const retained = () => {
    expect(workspace.agenda.getSnapshot().agenda).toBe(agenda);
    expect(workspace.announcements.getSnapshot().announcements).toBe(fed);
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 1,
      dirty: true,
    });
    expect(workspace.coordinator.getSnapshot().draft).toBe(watchlist);
    expect(workspace.followups.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 0,
      dirty: true,
    });
    expect(workspace.followups.coordinator.getSnapshot().draft).toBe(followups);
    expect(controls.getSnapshot()).toBe(followupRequests);
    expect(fixture.getSnapshot()).toMatchObject({
      load: 1,
      status: 1,
      marketsResolve: 2,
      save: 0,
      resolve: 0,
      annual: 0,
      eod: 0,
      marketsEod: 0,
      filings: 0,
      token: 0,
      signOut: 0,
    });
  };
  retained();
  const fedBefore = workspace.announcements.getSnapshot();
  await workspace.agenda.load();
  expect(workspace.agenda.getSnapshot()).toMatchObject({
    error: "unavailable",
    showingPrevious: true,
  });
  expect(workspace.announcements.getSnapshot()).toBe(fedBefore);
  expect(html()).toContain("Previous schedule.");
  expect(html()).not.toContain("Previous announcements.");
  retained();
  await workspace.announcements.load();
  expect(workspace.announcements.getSnapshot()).toMatchObject({
    error: "unavailable",
    showingPrevious: true,
  });
  expect(html()).toContain("Previous announcements.");
  retained();
  const calendarLate = workspace.agenda.load();
  await workspace.agenda.load();
  expect(fixture.getSnapshot().calendar).toBe(3);
  expect(() => fixture.settleCancelledCalendar()).toThrow("Only an aborted");
  workspace.agenda.cancel();
  fixture.settleCancelledCalendar();
  await calendarLate;
  retained();
  const fedLate = workspace.announcements.load();
  await workspace.announcements.load();
  expect(fixture.getSnapshot().fed).toBe(3);
  expect(() => fixture.settleCancelledAnnouncements()).toThrow(
    "Only an aborted",
  );
  workspace.announcements.cancel();
  fixture.settleCancelledAnnouncements();
  await fedLate;
  retained();
  const calendarRetired = workspace.agenda.load();
  const fedRetired = workspace.announcements.load();
  await workspace.refreshCatalog();
  expect(workspace.sessionOwner.getSnapshot().phase).toBe("retired");
  expect(workspace.coordinator.getSnapshot().draft).toBeNull();
  expect(workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(workspace.followups.getSnapshot().assessmentTime).toBeNull();
  fixture.settleCancelledCalendar();
  fixture.settleCancelledAnnouncements();
  await Promise.all([calendarRetired, fedRetired]);
  expect(workspace.agenda.getSnapshot().agenda).toBeNull();
  expect(workspace.announcements.getSnapshot().announcements).toBeNull();
  expect(workspace.coordinator.getSnapshot().draft).toBeNull();
  expect(workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(fixture.getSnapshot()).toMatchObject({
    calendar: 4,
    calendarAborted: 2,
    calendarLateResolved: 2,
    fed: 4,
    fedAborted: 2,
    fedLateResolved: 2,
    load: 1,
    status: 2,
    marketsResolve: 2,
    save: 0,
    resolve: 0,
    annual: 0,
    eod: 0,
    marketsEod: 0,
    filings: 0,
    token: 0,
    signOut: 0,
  });
  expect(controls.getSnapshot()).toBe(followupRequests);
  const counts = fixture.getSnapshot();
  expect(() =>
    fixture.api.economicCalendar(new AbortController().signal),
  ).toThrow("Unexpected invented calendar");
  expect(() =>
    fixture.api.monetaryAnnouncements(new AbortController().signal),
  ).toThrow("Unexpected invented announcements");
  expect(fixture.getSnapshot()).toBe(counts);
});
