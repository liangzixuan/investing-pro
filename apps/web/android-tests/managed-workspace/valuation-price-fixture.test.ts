import { afterEach, describe, expect, it } from "vitest";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import { prepareCompanyReport } from "../../src/clerk-trial/managed-company-report";
import { formatCompanyReportDocument } from "../../src/clerk-trial/managed-company-report-document";
import { createFixture } from "./fixture";
import {
  valuationPriceExpectedNote,
  valuationPricePrefix,
} from "./valuation-price-fixture";

const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of owners.splice(0)) workspace.sessionOwner.dispose();
});
const signal = () => new AbortController().signal;
const request = {
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
  listingId: "listing-zero",
  range: "1m" as const,
};
async function setup() {
  const fixture = await createFixture("valuation-price");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
    },
  );
  owners.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.note("listing-zero", valuationPricePrefix);
  const open = () =>
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
  open();
  const visit = () => workspace.getSnapshot().research!;
  const loadPrice = () => workspace.requestResearchSource(visit(), "eod");
  const prepare = () =>
    workspace.prepareValuationNote(visit().selection, "dcf", "base", true);
  const command = () => ({
    expectedVersion: 1,
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
    payload: structuredClone(workspace.coordinator.getSnapshot().draft!),
  });
  return { fixture, workspace, open, visit, loadPrice, prepare, command };
}
function fill(f: Awaited<ReturnType<typeof setup>>) {
  const v = f.workspace.valuation;
  for (const [field, value] of Object.entries({
    startingUnleveredCashFlowUsd: "100",
    enterpriseToEquityBridgeUsd: "100",
    dilutedShares: "10",
    waccPercent: "10",
    terminalGrowthPercent: "0",
  }))
    v.setDcfField(field as "waccPercent", value);
  for (const [field, value] of Object.entries({
    baseRevenue: "1000",
    cash: "100",
    debt: "200",
    dilutedShares: "100",
    discountRatePercent: "10",
  }))
    v.setExitField(field as "baseRevenue", value);
  for (const [scenario, growth] of [
    ["conservative", "0"],
    ["base", "10"],
    ["expansion", "20"],
  ] as const) {
    v.setDcfScenario(scenario, growth);
    v.setExitScenario(scenario, "annualRevenueGrowthPercent", growth);
    v.setExitScenario(scenario, "targetEbitdaMarginPercent", "20");
    v.setExitScenario(scenario, "exitMultiple", "10");
  }
  expect(v.getSnapshot().calculation).toBeNull();
  return v.calculate()!;
}
describe("fixed native valuation and dated Price fixture", () => {
  it("uses real Calculate, explicit Price, exact whole-note Append, schema5 report, Review/Save and fresh read", async () => {
    const f = await setup();
    const calculation = fill(f);
    expect(f.fixture.getSnapshot()).toMatchObject({
      eod: 0,
      annual: 0,
      filings: 0,
      save: 0,
    });
    expect(f.prepare().preview).toBeNull();
    await f.loadPrice();
    const response = f.workspace.eod.getSnapshot().response!;
    expect(response.rows.at(-1)).toEqual({
      date: "2026-09-19",
      close: "110.000000000000000003",
    });
    const preview = f.prepare().preview!;
    expect(preview.note).toBe(valuationPriceExpectedNote);
    expect([...preview.note].length).toBeLessThanOrEqual(2000);
    expect(f.workspace.appendValuationNote(preview).appended).toBe(true);
    expect(f.workspace.appendValuationNote(preview).appended).toBe(false);
    const selection = f.visit().selection;
    const report = prepareCompanyReport(
      selection,
      companySnapshotEvidence(
        selection,
        f.workspace.eod.getSnapshot(),
        f.workspace.annual.getSnapshot(),
        f.workspace.filings.getSnapshot(),
      ),
      f.workspace.getResearchWatchlist(selection),
      () => new Date("2026-10-17T00:00:00.000Z"),
      calculation,
    )!;
    const doc = formatCompanyReportDocument(report)!;
    const parsed: unknown = JSON.parse(doc.text);
    expect(parsed).toMatchObject({
      schemaVersion: "5.0.0",
      authoredResearch: { note: valuationPriceExpectedNote },
      valuationPrice: {
        reference: {
          date: "2026-09-19",
          rawCloseUsd: "110.000000000000000003",
          sourcePath: "sources.price.response",
          showingPrevious: false,
        },
      },
      sources: { price: { response } },
    });
    expect(report.valuationPrice!.rows).toHaveLength(6);
    expect(parsed).toHaveProperty(
      "valuationPrice.rows",
      report.valuationPrice!.rows,
    );
    expect(
      report.valuationPrice!.rows.filter((row) => row.scenario === "base"),
    ).toEqual([
      {
        model: "dcf",
        scenario: "base",
        modelValuePerShareUsd: "140.00",
        result: { status: "available", differencePercent: "27.27" },
      },
      {
        model: "exit",
        scenario: "base",
        modelValuePerShareUsd: "19.00",
        result: { status: "available", differencePercent: "-82.73" },
      },
    ]);
    expect(f.fixture.getSnapshot()).toMatchObject({
      eod: 1,
      save: 0,
      annual: 0,
      filings: 0,
    });
    f.workspace.closeResearch();
    f.workspace.setView("watchlist");
    await f.workspace.coordinator.save();
    expect(f.workspace.coordinator.getSnapshot().dirty).toBe(false);
    await f.workspace.coordinator.load();
    expect(
      f.workspace.coordinator
        .getSnapshot()
        .draft!.memberships.map(({ symbol, note }) => ({ symbol, note })),
    ).toEqual([
      { symbol: "ZERO", note: valuationPriceExpectedNote },
      { symbol: "ONE", note: "Invented second note" },
    ]);
    f.open();
    expect(f.workspace.valuation.getSnapshot().calculation).toBe(calculation);
    expect(f.workspace.eod.getSnapshot().response).toBeNull();
    expect(f.fixture.getSnapshot()).toMatchObject({
      load: 2,
      status: 1,
      marketsResolve: 1,
      eod: 1,
      save: 1,
      annual: 0,
      filings: 0,
      calendar: 0,
      fed: 0,
      search: 0,
      token: 0,
      signOut: 0,
    });
  });
  it("rejects malformed, wrong listing/catalog/range and aborted Price requests before consuming the sole source read", async () => {
    const f = await setup();
    for (const input of [
      { ...request, extra: true },
      { ...request, listingId: "listing-one" },
      { ...request, range: "1y" },
      { ...request, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` },
    ])
      await expect(
        f.fixture.api.eodHistory(
          input as Parameters<ManagedApi["eodHistory"]>[0],
          signal(),
        ),
      ).rejects.toThrow("eodHistory");
    const abort = new AbortController();
    abort.abort();
    await expect(
      f.fixture.api.eodHistory(request, abort.signal),
    ).rejects.toThrow("eodHistory");
    await f.loadPrice();
    await expect(f.fixture.api.eodHistory(request, signal())).rejects.toThrow(
      "eodHistory",
    );
    expect(f.fixture.getSnapshot().eod).toBe(1);
  });
  it("refuses Save before source load, incomplete excerpts, changed unrelated notes and malformed commands; admits only the exact whole payload once", async () => {
    const f = await setup();
    await expect(f.fixture.api.save(f.command(), signal())).rejects.toThrow(
      "save",
    );
    await expect(f.fixture.api.load(signal())).rejects.toThrow("load");
    fill(f);
    await f.loadPrice();
    await expect(f.fixture.api.save(f.command(), signal())).rejects.toThrow(
      "save",
    );
    const preview = f.prepare().preview!;
    f.workspace.appendValuationNote(preview);
    const original = f.command();
    const malformed = {
      ...original,
      payload: {
        ...original.payload,
        memberships: original.payload.memberships.map((member, index) =>
          index === 1 ? { ...member, note: "Changed unrelated note" } : member,
        ),
      },
    };
    await expect(f.fixture.api.save(malformed, signal())).rejects.toThrow(
      "save",
    );
    await expect(
      f.fixture.api.save({ ...f.command(), expectedVersion: 2 }, signal()),
    ).rejects.toThrow("save");
    await f.workspace.coordinator.save();
    await expect(f.fixture.api.save(f.command(), signal())).rejects.toThrow(
      "save",
    );
    expect(f.fixture.getSnapshot().save).toBe(1);
  });
  it("counts and refuses Annual, Filings and unrelated source requests", async () => {
    const f = await setup();
    await expect(
      f.fixture.api.annualReport(
        {
          schemaVersion: "6.0.0",
          catalogSnapshotSha256: request.catalogSnapshotSha256,
          listingId: request.listingId,
          symbol: "ZERO",
        },
        signal(),
      ),
    ).rejects.toThrow("annualReport");
    await expect(f.fixture.api.search("ZERO", signal())).rejects.toThrow(
      "search",
    );
    await expect(f.fixture.api.economicCalendar(signal())).rejects.toThrow(
      "economicCalendar",
    );
    await expect(f.fixture.api.monetaryAnnouncements(signal())).rejects.toThrow(
      "monetaryAnnouncements",
    );
    expect(f.fixture.getSnapshot()).toMatchObject({
      annual: 1,
      search: 1,
      calendar: 1,
      fed: 1,
      save: 0,
      eod: 0,
    });
  });
});
