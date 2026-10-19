import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { ManagedFinancialScreen } from "../../src/clerk-trial/ManagedFinancialScreen";
import { AnnualStatementTable } from "../../src/clerk-trial/ManagedAnnualStatements";
import { createFixture } from "./fixture";
import { screenComparisonListingIds } from "./screen-comparison-fixture";
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of owners.splice(0)) workspace.sessionOwner.dispose();
  vi.useRealTimers();
});
async function setup() {
  const fixture = await createFixture("screen-comparison");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
      financialScreenListingIds: fixture.screenComparison!.listingIds,
    },
  );
  owners.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("discover");
  return { fixture, workspace, screen: workspace.financialScreen };
}
const signal = () => new AbortController().signal;
const digest = `sha256:${"a".repeat(64)}` as const;
const request = {
  schemaVersion: "6.0.0" as const,
  catalogSnapshotSha256: digest,
  listingId: "listing-zero",
  symbol: "ZERO",
};

describe("fixed native screen comparison fixture", () => {
  it("uses two paced canonical reads and retains exact independent sources, pair and notes through Research/Back", async () => {
    vi.useFakeTimers();
    const f = await setup();
    f.workspace.setView("watchlist");
    f.workspace.note("listing-zero", "Comparison left draft");
    f.workspace.note("listing-one", "Comparison right draft");
    const draft = f.workspace.coordinator.getSnapshot().draft;
    f.workspace.setView("discover");
    await f.screen.loadUniverse(f.screen.getSnapshot());
    expect(
      f.screen.getSnapshot().selected.map((member) => member.listing.listingId),
    ).toEqual(screenComparisonListingIds);
    f.screen.stageCriteria(f.screen.getSnapshot());
    f.screen.setCriteria(f.screen.getSnapshot(), {
      clauses: [{ field: "operatingCashFlow", operator: "gte", value: "0" }],
      sort: { field: "symbol", direction: "asc" },
    });
    const running = f.screen.run(f.screen.getSnapshot());
    await vi.waitFor(() => expect(f.fixture.getSnapshot().annual).toBe(1));
    await vi.advanceTimersByTimeAsync(20000);
    await running;
    const state = f.screen.getSnapshot();
    expect(state.run!.status).toBe("completed");
    const left = state.run!.rows.find(
      (row) => row.member.listing.symbol === "ZERO",
    )!;
    const right = state.run!.rows.find(
      (row) => row.member.listing.symbol === "ONE",
    )!;
    expect(left.report!.response!.security.cik).toBe("0000000001");
    expect(right.report!.response!.security.cik).toBe("0000000002");
    expect(left.report!.response!.evidence.target).toMatchObject({
      reportDate: "2025-12-31",
    });
    expect(right.report!.response!.evidence.target).toMatchObject({
      reportDate: "2025-06-30",
    });
    for (const [row, concept, value, period] of [
      [left, "Revenues", "USD 1000", "2025-01-01 through 2025-12-31"],
      [right, "SalesRevenueNet", "USD 750", "2024-07-01 through 2025-06-30"],
      [left, "Assets", "USD 1000.125", "At 2025-12-31"],
      [right, "Assets", `USD 1000.${"0".repeat(58)}1`, "At 2025-06-30"],
      [
        left,
        "NetCashProvidedByUsedInOperatingActivities",
        "USD 1000",
        "2025-01-01 through 2025-12-31",
      ],
      [
        right,
        "NetCashProvidedByUsedInOperatingActivities",
        "USD 900",
        "2024-07-01 through 2025-06-30",
      ],
    ] as const) {
      const report = row.report!;
      const statement = report.view!.statements.statements.find((item) =>
        item.rows.some((line) => line.concept === concept),
      )!;
      const table = load(
        renderToStaticMarkup(
          createElement(AnnualStatementTable, {
            statement,
            evidence: report.response!.evidence,
          }),
        ),
      );
      const line = table("tbody tr").filter(
        (_, element) =>
          table(element)
            .find("th .managed-annual-statement-inspect > dl dd")
            .first()
            .text() === `us-gaap:${concept} · USD`,
      );
      expect(line).toHaveLength(1);
      expect(line.find("td").first().find("strong").text()).toBe(value);
      expect(line.find("td").first().find("small").first().text()).toBe(period);
      expect(table("input[type=checkbox]")).toHaveLength(0);
      if (concept === "NetCashProvidedByUsedInOperatingActivities") {
        const observations = line.find(
          ".managed-annual-statement-observation dd",
        );
        expect(observations).toHaveLength(10);
        expect(observations.eq(1).text()).toBe(value);
        expect(observations.eq(4).text()).toBe(
          "/facts/us-gaap/NetCashProvidedByUsedInOperatingActivities/units/USD/0",
        );
        expect(observations.eq(5).text()).toBe(
          row === left
            ? "10-K · 0000000001-26-000001 · filed 2026-02-01"
            : "10-K · 0000000002-25-000001 · filed 2025-08-01",
        );
      }
    }
    f.screen.selectComparison(f.screen.getSnapshot(), "left", left);
    f.screen.selectComparison(f.screen.getSnapshot(), "right", right);
    f.screen.toggleShortlist(f.screen.getSnapshot(), right);
    const retained = f.screen.getSnapshot();
    const $ = load(
      renderToStaticMarkup(
        createElement(ManagedFinancialScreen, {
          model: f.screen,
          onOpenReport: () => undefined,
        }),
      ),
    );
    expect(
      $(".managed-screen-comparison-company h5")
        .map((_, el) => $(el).text())
        .get(),
    ).toEqual([
      "Left company: ZERO · Zero Company",
      "Right company: ONE · One Company",
    ]);
    expect($(".managed-screen-comparison input[type=checkbox]")).toHaveLength(
      0,
    );
    expect($(".managed-screen-comparison-company").eq(0).text()).toContain(
      "2025-12-31",
    );
    expect($(".managed-screen-comparison-company").eq(1).text()).toContain(
      "2025-06-30",
    );
    const original = right.report!.response!;
    f.workspace.openFinancialScreenReport({
      run: state.run!,
      row: right,
      response: original,
    });
    await vi.waitFor(() =>
      expect(f.workspace.annual.getSnapshot().checkingSeed).toBe(false),
    );
    expect(f.workspace.annual.getSnapshot().response).toEqual(original);
    expect(f.workspace.annual.getSnapshot().responseOrigin).toBe(
      "financial-screen",
    );
    expect(f.workspace.getSnapshot().research).toMatchObject({
      section: "annual",
      selection: { listing: { listingId: "listing-one", symbol: "ONE" } },
    });
    f.workspace.closeResearch();
    expect(f.screen.getSnapshot().comparison).toBe(retained.comparison);
    expect(f.screen.getSnapshot().criteria).toBe(retained.criteria);
    expect(f.screen.getSnapshot().run).toBe(retained.run);
    expect(f.screen.getSnapshot().shortlist).toBe(retained.shortlist);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(f.fixture.getSnapshot()).toMatchObject({
      load: 1,
      status: 1,
      marketsResolve: 1,
      resolve: 1,
      annual: 2,
      save: 0,
      eod: 0,
      filings: 0,
      search: 0,
      calendar: 0,
      fed: 0,
      token: 0,
      signOut: 0,
    });
  });
  it("refuses malformed, foreign, aborted and repeated requests without consuming expected reads", async () => {
    vi.useFakeTimers();
    const f = await setup();
    await expect(f.fixture.api.annualReport(request, signal())).rejects.toThrow(
      "annualReport",
    );
    for (const input of [
      { snapshotSha256: digest, listingIds: ["listing-one", "listing-zero"] },
      {
        snapshotSha256: digest,
        listingIds: screenComparisonListingIds,
        extra: true,
      },
      {
        snapshotSha256: `sha256:${"b".repeat(64)}`,
        listingIds: screenComparisonListingIds,
      },
    ])
      await expect(
        f.fixture.api.resolve(
          input as Parameters<ManagedApi["resolve"]>[0],
          signal(),
        ),
      ).rejects.toThrow("screen resolve");
    await f.screen.loadUniverse(f.screen.getSnapshot());
    await expect(
      f.fixture.api.resolve(
        { snapshotSha256: digest, listingIds: screenComparisonListingIds },
        signal(),
      ),
    ).rejects.toThrow("screen resolve");
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      f.fixture.api.annualReport(request, cancelled.signal),
    ).rejects.toThrow("annualReport");
    for (const input of [
      { ...request, extra: true },
      { ...request, schemaVersion: "5.0.0" },
      { ...request, listingId: "listing-one", symbol: "ONE" },
    ])
      await expect(
        f.fixture.api.annualReport(
          input as Parameters<ManagedApi["annualReport"]>[0],
          signal(),
        ),
      ).rejects.toThrow("annualReport");
    await f.fixture.api.annualReport(request, signal());
    const second = { ...request, listingId: "listing-one", symbol: "ONE" };
    await expect(f.fixture.api.annualReport(second, signal())).rejects.toThrow(
      "annualReport",
    );
    await vi.advanceTimersByTimeAsync(19999);
    await expect(f.fixture.api.annualReport(second, signal())).rejects.toThrow(
      "annualReport",
    );
    await vi.advanceTimersByTimeAsync(1);
    const packet = await f.fixture.api.annualReport(second, signal());
    expect(packet.security.listingId).toBe("listing-one");
    await expect(f.fixture.api.annualReport(second, signal())).rejects.toThrow(
      "annualReport",
    );
    expect(f.fixture.getSnapshot()).toMatchObject({
      resolve: 1,
      annual: 2,
      save: 0,
      eod: 0,
      filings: 0,
    });
  });
});
