import type { ManagedFinancialScreenCriteria } from "./managed-financial-screen-results";
import { vi } from "vitest";
import {
  ManagedFinancialScreen,
  type ManagedFinancialScreenResultRow,
} from "./managed-financial-screen";
import type { ManagedApi } from "./managed-api";
import { eodSelection } from "./eod-history-fixture";
import {
  annualComparisonResponse,
  annualComparisonMemberships,
} from "./test-canonical-annual-comparison-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
export async function createScreenComparisonReportFixture(
  options: {
    leftOptions?: Parameters<typeof annualComparisonResponse>[1];
    criteria?: ManagedFinancialScreenCriteria;
  } = {},
) {
  const [left, right] = await Promise.all([
    annualComparisonResponse("left", options.leftOptions),
    annualComparisonResponse("right"),
  ]);
  const listings = Object.values(annualComparisonMemberships).map((member) => {
    const { note, ...listing } = member;
    void note;
    return listing;
  });
  vi.useFakeTimers({
    toFake: ["Date", "performance", "setTimeout", "clearTimeout"],
  });
  vi.setSystemTime(new Date("2026-09-20T00:00:00.000Z"));
  const read = vi
    .fn<ManagedApi["annualReport"]>()
    .mockImplementation((request) =>
      Promise.resolve(
        request.listingId === listings[0]!.listingId ? left : right,
      ),
    );
  const resolve = vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
    Promise.resolve({
      snapshotSha256: request.snapshotSha256,
      results: request.listingIds.map((listingId) => ({
        listingId,
        listing: listings.find((row) => row.listingId === listingId)!,
      })),
    }),
  );
  const model = new ManagedFinancialScreen(
    { resolve, annualReport: read },
    vi.fn(),
    undefined,
    {
      listingIds: listings.map((row) => row.listingId),
      coverage: createManagedResearchCoverageFixture(
        listings.map((listing, index) => ({
          listing,
          cik: index === 0 ? "0000000001" : "0000000002",
        })),
      ),
    },
  );
  model.reconcile(eodSelection.catalogSnapshotSha256, true, true);
  await model.loadUniverse(model.getSnapshot());
  if (options.criteria)
    model.setCriteria(model.getSnapshot(), options.criteria);
  const running = model.run(model.getSnapshot());
  await vi.advanceTimersByTimeAsync(20_000);
  await running;
  const rows = model.getSnapshot().run!.rows;
  const choose = (
    side: "left" | "right",
    row: ManagedFinancialScreenResultRow | null,
  ) => model.selectComparison(model.getSnapshot(), side, row);
  choose("left", rows[0]!);
  choose("right", rows[1]!);
  const capture = () => model.captureComparisonReport(new Date().toISOString());
  return { model, read, resolve, rows, left, right, choose, capture };
}
