import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
import { ManagedWatchlistDailyReport } from "./ManagedWatchlistDailyReport";
import { createFinishedWatchlistDailyReportFixture } from "./test-watchlist-daily-report-fixture";
import type { WatchlistDailyReportDeliveryAdapter } from "./watchlist-daily-report-ports";

let fixture:
  | Awaited<ReturnType<typeof createFinishedWatchlistDailyReportFixture>>
  | undefined;

afterEach(() => {
  fixture?.dispose();
  fixture = undefined;
  vi.restoreAllMocks();
});

it("renders the finished review entry without preparing, delivering or changing online resources", async () => {
  const f = await createFinishedWatchlistDailyReportFixture();
  fixture = f;
  const deliver = vi.fn<WatchlistDailyReportDeliveryAdapter["deliver"]>();
  const source = f.workspace.getWatchlistDailyReportSource();
  const capture = vi.spyOn(source, "capture");
  const price = vi.spyOn(f.fixture.api, "eodHistory");
  const filings = vi.spyOn(f.fixture.api, "recentFilings");
  const evaluate = vi.spyOn(f.model, "evaluate");
  const before = [price.mock.calls.length, filings.mock.calls.length];
  const watchlist = f.workspace.coordinator.getSnapshot();
  const valuations = f.workspace.valuationAssumptions.coordinator.getSnapshot();
  const checks = f.workspace.followups.coordinator.getSnapshot();
  const page = load(
    renderToStaticMarkup(
      <ManagedWatchlistDailyReport
        workspace={f.workspace}
        active={true}
        delivery={{ deliver }}
      />,
    ),
  );
  expect(page("#managed-watchlist-daily-report-prepare").text()).toBe(
    "Prepare daily review report",
  );
  expect(page("#managed-watchlist-daily-report-save")).toHaveLength(0);
  expect(page("section").attr("aria-labelledby")).toBe(
    "managed-watchlist-daily-report-heading",
  );
  expect(page("#managed-watchlist-daily-report-heading").attr("tabindex")).toBe(
    "-1",
  );
  expect(page('[role="status"]').attr("aria-live")).toBe("polite");
  expect(capture).not.toHaveBeenCalled();
  expect(deliver).not.toHaveBeenCalled();
  expect([price.mock.calls.length, filings.mock.calls.length]).toEqual(before);
  expect(evaluate).not.toHaveBeenCalled();
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
  expect(f.workspace.valuationAssumptions.coordinator.getSnapshot()).toBe(
    valuations,
  );
  expect(f.workspace.followups.coordinator.getSnapshot()).toBe(checks);
});

it("keeps the inactive route's prepare control unavailable", async () => {
  const f = await createFinishedWatchlistDailyReportFixture();
  fixture = f;
  const page = load(
    renderToStaticMarkup(
      <ManagedWatchlistDailyReport
        workspace={f.workspace}
        active={false}
        delivery={undefined}
      />,
    ),
  );
  expect(
    page("#managed-watchlist-daily-report-prepare").attr("disabled"),
  ).toBeDefined();
  expect(page("#managed-watchlist-daily-report-save")).toHaveLength(0);
});
