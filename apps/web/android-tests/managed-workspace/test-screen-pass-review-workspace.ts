import { expect, vi } from "vitest";
import { createFixture } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { prepareWatchlistScreenSelection } from "../../src/clerk-trial/managed-watchlist-screen-selection";
import { portfolioScreenIds } from "./portfolio-screen-selection-fixture-data";
import { watchlistScreenAuthoredNote } from "./watchlist-screen-selection-fixture";
export async function screenPassReviewWorkspaceFixture(
  scenario: "screen-pass-review" | "screen-pass-report" = "screen-pass-review",
) {
  const fixture = await createFixture(scenario),
    meta = fixture.watchlistScreenSelection!;
  const w = new ManagedWorkspace(fixture.api, fixture.session, undefined, {
    researchCoverage: fixture.researchCoverage,
  });
  w.setView("watchlist");
  await w.refreshCatalog();
  await w.coordinator.load();
  w.note(portfolioScreenIds.apple, watchlistScreenAuthoredNote);
  const resource = w.coordinator.getSnapshot();
  w.setView("discover");
  const screen = w.financialScreen;
  await screen.loadUniverse(screen.getSnapshot());
  screen.setCriteria(screen.getSnapshot(), {
    clauses: [{ field: "operatingCashFlow", operator: "gte", value: "0.00" }],
    sort: { field: "symbol", direction: "asc" },
  });
  const member = screen
    .getSnapshot()
    .memberships.find((m) => m.listing.listingId === portfolioScreenIds.googl)!;
  expect(
    prepareWatchlistScreenSelection(w, () => true, [member]).preview!.apply(),
  ).not.toBeNull();
  vi.useFakeTimers({
    toFake: ["Date", "setTimeout", "clearTimeout", "performance"],
  });
  const first = screen.run(screen.getSnapshot());
  await vi.waitFor(() =>
    expect(screen.getSnapshot().run!.rows[0]!.evaluation).not.toBeNull(),
  );
  await vi.advanceTimersByTimeAsync(20000);
  await first;
  return { fixture, meta, w, screen, resource };
}
