import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { ManagedFinancialScreen } from "../../src/clerk-trial/ManagedFinancialScreen";
import { createFixture } from "./fixture";
import {
  financialScreenListingIds,
  financialScreenPins,
} from "./financial-screen-fixture";

const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of owners.splice(0)) workspace.sessionOwner.dispose();
});
async function setup() {
  const fixture = await createFixture("financial-screen");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
      financialScreenListingIds: fixture.financialScreen!.listingIds,
    },
  );
  owners.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  return { fixture, workspace, screen: workspace.financialScreen };
}
const digest = `sha256:${"a".repeat(64)}` as const;
const request = {
  schemaVersion: "6.0.0" as const,
  catalogSnapshotSha256: digest,
  listingId: "listing-zero",
  symbol: "ZERO",
};
const signal = () => new AbortController().signal;

describe("invented native financial screen fixture", () => {
  it("runs the actual explicit cohort→criteria→run→shortlist→seeded Research→Back flow without unrelated IO or draft changes", async () => {
    const f = await setup();
    expect(f.fixture.financialScreen!.listingIds).toEqual(
      financialScreenListingIds,
    );
    expect(f.fixture.getSnapshot()).toMatchObject({
      load: 1,
      status: 1,
      marketsResolve: 1,
      resolve: 0,
      annual: 0,
    });
    f.workspace.setView("watchlist");
    f.workspace.note("listing-zero", "Screening research draft");
    f.workspace.note("listing-one", "Unrelated screen draft");
    const draft = f.workspace.coordinator.getSnapshot().draft;
    f.workspace.setView("discover");
    expect(f.fixture.getSnapshot().annual).toBe(0);
    await f.screen.loadUniverse(f.screen.getSnapshot());
    expect(
      f.screen.getSnapshot().selected.map((member) => member.listing.listingId),
    ).toEqual(financialScreenListingIds);
    f.screen.stageCriteria(f.screen.getSnapshot());
    const criteria = {
      clauses: [{ field: "operatingCashFlow", operator: "gte", value: "0" }],
      sort: { field: "symbol", direction: "asc" },
    };
    f.screen.setCriteria(f.screen.getSnapshot(), criteria);
    expect(f.fixture.getSnapshot().annual).toBe(0);
    await f.screen.run(f.screen.getSnapshot());
    const run = f.screen.getSnapshot().run!;
    const row = run.rows[0]!;
    expect(run.status).toBe("completed");
    expect(run.criteria).toEqual(criteria);
    expect(row.failure).toBeNull();
    expect(row.evaluation!.match).toBe("match");
    expect(row.evaluation!.metrics.operatingIncome.status).toBe("unavailable");
    for (const [field, value] of Object.entries(financialScreenPins))
      expect(
        row.evaluation!.metrics[field as keyof typeof financialScreenPins],
      ).toMatchObject({ status: "available", value, currentUseEligible: true });
    const $ = load(
      renderToStaticMarkup(
        createElement(ManagedFinancialScreen, {
          model: f.screen,
          onOpenReport: () => undefined,
        }),
      ),
    );
    const cells = $(".managed-screen-table tbody > tr > td");
    expect(cells).toHaveLength(7);
    expect(cells.eq(0).text()).toBe("match");
    expect(cells.eq(1).text()).toBe("Unknown: concept missing");
    expect(
      cells
        .slice(2)
        .map((_, cell) =>
          $(cell).find("span").first().contents().first().text(),
        )
        .get(),
    ).toEqual(["120.125", "100.1", "40.1", "-200.125", "1.50"]);
    expect(
      cells
        .slice(2)
        .map((_, cell) => $(cell).find("small").first().text())
        .get(),
    ).toEqual([
      "2025-01-01 to 2025-12-31",
      "2025-01-01 to 2025-12-31",
      "As of 2025-12-31",
      "As of 2025-12-31",
      "As of 2025-12-31",
    ]);
    const cashSource = $(
      ".managed-screen-evidence > details:nth-last-of-type(5)",
    );
    expect(cashSource.children("summary").text()).toBe(
      "Reported operating cash flow source",
    );
    expect(
      cashSource.find(".managed-annual-statement-observation dl > div"),
    ).toHaveLength(10);
    expect(
      cashSource.find(".managed-annual-statement-observation dd").eq(1).text(),
    ).toBe("USD 120.125");
    expect(
      cashSource.find(".managed-annual-statement-observation dd").eq(5).text(),
    ).toBe("10-K · 0000999999-26-000001 · filed 2026-02-01");
    expect(
      cashSource.find(".managed-annual-statement-observation dd").eq(4).text(),
    ).toBe(
      "/facts/us-gaap/NetCashProvidedByUsedInOperatingActivities/units/USD/0",
    );
    expect(
      cashSource.find(".managed-annual-statement-observation dd").eq(7).text(),
    ).toBe(
      "Form 10-K; report date 2025-12-31; filed 2026-02-01; accepted 2026-02-01T00:00:00.000Z",
    );
    expect(
      cashSource.find(".managed-annual-statement-observation dd").eq(8).text(),
    ).toBe(
      "https://www.sec.gov/Archives/edgar/data/1/0000999999-26-000001-index.htm",
    );
    expect(row.report!.response!.evidence.generation).toEqual(
      f.fixture.financialScreen!.generation,
    );
    f.screen.toggleShortlist(f.screen.getSnapshot(), row);
    const retained = f.screen.getSnapshot();
    const capture = { run, row, response: row.report!.response! };
    f.workspace.openFinancialScreenReport(capture);
    await vi.waitFor(() =>
      expect(f.workspace.annual.getSnapshot().checkingSeed).toBe(false),
    );
    expect(f.workspace.getSnapshot().research).toMatchObject({
      section: "annual",
      selection: {
        origin: "screening",
        cik: "0000000001",
        listing: {
          listingId: "listing-zero",
          symbol: "ZERO",
          issuerId: "issuer-zero",
          shareClassId: "class-zero",
        },
      },
    });
    expect(f.workspace.annual.getSnapshot().responseOrigin).toBe(
      "financial-screen",
    );
    expect(f.workspace.annual.getSnapshot().response).toEqual(
      row.report!.response,
    );
    expect(
      f.workspace.annual.getSnapshot().response!.evidence.generation,
    ).toEqual(f.fixture.financialScreen!.generation);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(draft);
    f.workspace.closeResearch();
    expect(f.workspace.getSnapshot().view).toBe("discover");
    expect(f.screen.getSnapshot().run).toBe(retained.run);
    expect(f.screen.getSnapshot().shortlist).toBe(retained.shortlist);
    expect(f.screen.getSnapshot().criteria).toBe(retained.criteria);
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(f.fixture.getSnapshot()).toMatchObject({
      load: 1,
      status: 1,
      marketsResolve: 1,
      resolve: 1,
      annual: 1,
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
  it("refuses an Annual request before the explicit cohort resolve", async () => {
    const f = await setup();
    await expect(f.fixture.api.annualReport(request, signal())).rejects.toThrow(
      "annualReport",
    );
    expect(f.fixture.getSnapshot().annual).toBe(0);
  });
  it("refuses malformed, wrong-catalog, unqualified and extra-field cohort requests without consuming the valid request", async () => {
    const f = await setup();
    for (const input of [
      { snapshotSha256: digest, listingIds: ["listing-one"] },
      {
        snapshotSha256: `sha256:${"b".repeat(64)}`,
        listingIds: financialScreenListingIds,
      },
      {
        snapshotSha256: digest,
        listingIds: [...financialScreenListingIds, "listing-one"],
      },
      {
        snapshotSha256: digest,
        listingIds: financialScreenListingIds,
        extra: true,
      },
    ])
      await expect(
        f.fixture.api.resolve(
          input as Parameters<ManagedApi["resolve"]>[0],
          signal(),
        ),
      ).rejects.toThrow("screen resolve");
    f.workspace.setView("discover");
    await f.screen.loadUniverse(f.screen.getSnapshot());
    expect(f.fixture.getSnapshot().resolve).toBe(1);
    expect(f.screen.getSnapshot().memberships).toHaveLength(1);
  });
  it("refuses a repeated resolve, aborted read and malformed/version5/foreign listing Annual requests; admits one exact request only", async () => {
    const f = await setup();
    f.workspace.setView("discover");
    await f.screen.loadUniverse(f.screen.getSnapshot());
    await expect(
      f.fixture.api.resolve(
        { snapshotSha256: digest, listingIds: financialScreenListingIds },
        signal(),
      ),
    ).rejects.toThrow("screen resolve");
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      f.fixture.api.annualReport(request, cancelled.signal),
    ).rejects.toThrow("annualReport");
    for (const input of [
      { ...request, schemaVersion: "5.0.0" },
      { ...request, symbol: "ONE" },
      { ...request, listingId: "listing-one" },
      { ...request, extra: true },
    ])
      await expect(
        f.fixture.api.annualReport(input as typeof request, signal()),
      ).rejects.toThrow("annualReport");
    const response = await f.fixture.api.annualReport(request, signal());
    expect(response.security.listingId).toBe("listing-zero");
    await expect(f.fixture.api.annualReport(request, signal())).rejects.toThrow(
      "annualReport",
    );
    expect(f.fixture.getSnapshot().annual).toBe(1);
  });
  it("counts and rejects unrelated source reads and saves", async () => {
    const f = await setup();
    await expect(
      f.fixture.api.eodHistory(
        {
          catalogSnapshotSha256: digest,
          listingId: "listing-zero",
          range: "1m",
        },
        signal(),
      ),
    ).rejects.toThrow("eodHistory");
    await expect(f.fixture.api.economicCalendar(signal())).rejects.toThrow(
      "economicCalendar",
    );
    await expect(f.fixture.api.monetaryAnnouncements(signal())).rejects.toThrow(
      "monetaryAnnouncements",
    );
    await expect(f.fixture.api.search("ZERO", signal())).rejects.toThrow(
      "search",
    );
    await expect(
      f.fixture.api.save(
        {
          expectedVersion: 1,
          idempotencyKey: "00000000-0000-4000-8000-000000000001",
          payload: f.workspace.coordinator.getSnapshot().draft!,
        },
        signal(),
      ),
    ).rejects.toThrow("save");
    expect(f.fixture.getSnapshot()).toMatchObject({
      eod: 1,
      calendar: 1,
      fed: 1,
      search: 1,
      save: 1,
      annual: 0,
    });
  });
});
