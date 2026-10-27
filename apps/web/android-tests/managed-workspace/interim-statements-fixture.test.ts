import { parseManagedSecInterimCanonicalRequest } from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import { createFixture } from "./fixture";
import { parseSecInterimCanonicalResponse } from "../../src/lib/sec-interim-canonical-response";

async function loaded() {
  const f = await createFixture("interim-statements");
  const signal = new AbortController().signal;
  const watchlist = await f.api.load(signal);
  await f.api.status(signal);
  const selected = f.researchCoverage.listings[0]!.listing;
  const request = parseManagedSecInterimCanonicalRequest({
    schemaVersion: "1.0.0" as const,
    catalogSnapshotSha256: watchlist.payload.snapshotSha256,
    listingId: selected.listingId,
    symbol: selected.symbol,
  });
  if (!request) throw new Error("Invalid invented request");
  return { f, signal, request };
}
describe("invented complete interim native journey store", () => {
  it("admits one exact source read, preserves both same-end durations and the full note", async () => {
    const { f, signal, request } = await loaded();
    const raw = await f.api.interimReport(request, signal);
    const owned = await parseSecInterimCanonicalResponse(raw, request, signal);
    expect(owned).not.toBeNull();
    const revenue = owned!.evidence.facts.observations.filter(
      (row) =>
        row.concept === "RevenueFromContractWithCustomerExcludingAssessedTax",
    );
    expect(
      revenue.map((row) => [row.startDate, row.endDate, row.value]),
    ).toEqual([
      ["2026-04-01", "2026-06-30", "40"],
      ["2026-01-01", "2026-06-30", "75"],
    ]);
    expect(owned!.evidence.facts.scans).toHaveLength(32);
    expect(f.getSnapshot()).toMatchObject({
      load: 1,
      status: 1,
      interimReport: 1,
      annual: 0,
      eod: 0,
      filings: 0,
      save: 0,
    });
    expect(f.getSnapshot()).toMatchObject({
      interimPortfolioLoad: 0,
      interimPortfolioSave: 0,
      interimFollowupsLoad: 0,
      interimFollowupsSave: 0,
    });
    expect(f.interimReview!.expectedNote).toContain("Thèse café 📈");
    expect([...f.interimReview!.expectedNote].length).toBeLessThanOrEqual(2000);
    expect(f.interimReview!.selectedCells).toHaveLength(3);
    expect(f.interimReview!.issuers).toEqual(["0000000001"]);
  });
  it("refuses foreign identity and repeat reads without consuming the single admitted read", async () => {
    const { f, signal, request } = await loaded();
    expect(() =>
      f.api.interimReport({ ...request, listingId: "listing-one" }, signal),
    ).toThrow();
    expect(f.getSnapshot().interimReport).toBe(0);
    await f.api.interimReport(request, signal);
    expect(() => f.api.interimReport(request, signal)).toThrow();
    expect(f.getSnapshot().interimReport).toBe(1);
  });
  it("has no fallback source or unrelated resource side effect", async () => {
    const { f, signal, request } = await loaded();
    await expect(f.api.loadPortfolio(signal)).rejects.toThrow("loadPortfolio");
    expect(f.getSnapshot().interimPortfolioLoad).toBe(1);
    await expect(f.api.loadFollowups(signal)).rejects.toThrow("loadFollowups");
    expect(f.getSnapshot().interimFollowupsLoad).toBe(1);
    await f.api.interimReport(request, signal);
    expect(f.getSnapshot()).toMatchObject({
      interimReport: 1,
      annual: 0,
      eod: 0,
      filings: 0,
      save: 0,
    });
  });
});
