import { vi } from "vitest";
import type { ManagedApi } from "./managed-api";
import { ManagedFinancialScreen } from "./managed-financial-screen";
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { eodSelection } from "./eod-history-fixture";

export async function financialScreenRefinementFixture(
  mode: "completed" | "cancelled" | "partial" = "completed",
) {
  const packets = await Promise.all([
    annualComparisonResponse("left"),
    annualComparisonResponse(
      "right",
      mode === "partial" ? { mode: "source-unavailable" } : {},
    ),
  ]);
  vi.useFakeTimers({
    toFake: ["Date", "performance", "setTimeout", "clearTimeout"],
  });
  vi.setSystemTime(new Date("2026-11-05T10:00:00.000Z"));
  const listings = [
    eodSelection.listing,
    {
      ...eodSelection.listing,
      listingId: "listing-one",
      issuerId: "issuer-one",
      issuerName: "One Company",
      securityId: "security-one",
      securityName: "One Class A",
      shareClassId: "class-one",
      symbol: "ONE",
    },
  ];
  const read = vi
    .fn<ManagedApi["annualReport"]>()
    .mockImplementation((request) =>
      Promise.resolve(
        packets.find((p) => p.security.listingId === request.listingId)!,
      ),
    );
  const resolve = vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
    Promise.resolve({
      snapshotSha256: request.snapshotSha256,
      results: request.listingIds.map((listingId) => ({
        listingId,
        listing: listings.find((l) => l.listingId === listingId)!,
      })),
    }),
  );
  const coverage = createManagedResearchCoverageFixture(
    listings.map((listing, i) => ({ listing, cik: packets[i]!.security.cik })),
  );
  const screen = new ManagedFinancialScreen(
    { resolve, annualReport: read },
    vi.fn(),
    undefined,
    { listingIds: listings.map((l) => l.listingId), coverage },
  );
  const digest = eodSelection.catalogSnapshotSha256;
  screen.reconcile(digest, true, true);
  await screen.loadUniverse(screen.getSnapshot());
  const running = screen.run(screen.getSnapshot());
  await vi.advanceTimersByTimeAsync(mode === "cancelled" ? 0 : 20000);
  if (mode === "cancelled") screen.cancel();
  await running;
  return { screen, read, resolve, packets, listings, digest };
}
export const refinedCriteria = {
  clauses: [
    { field: "operatingCashFlow", operator: "gte", value: "999999999999" },
  ],
  sort: { field: "symbol", direction: "desc" },
} as const;
export const refinementTime = "2026-11-05T11:00:00.000Z";
