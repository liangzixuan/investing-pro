import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { ManagedValuationResults } from "../../src/clerk-trial/ManagedValuationResults";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import {
  companyReportIsCurrent,
  prepareCompanyReport,
} from "../../src/clerk-trial/managed-company-report";
import {
  formatCompanyReportDocument,
  isCompanyReportDocument,
} from "../../src/clerk-trial/managed-company-report-document";
import type {
  DcfField,
  ExitField,
} from "../../src/clerk-trial/managed-valuation-workbench";
import {
  authoredValuationNoteDraft,
  authoredValuationPrefix,
  createFixture,
} from "./fixture";

const owners: ManagedWorkspace[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T12:00:00.000Z"));
});
afterEach(() => {
  for (const owner of owners.splice(0)) owner.sessionOwner.dispose();
  vi.useRealTimers();
});
async function setup() {
  const fixture = await createFixture("authored-valuation");
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
  workspace.note("listing-zero", authoredValuationPrefix);
  const open = () =>
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
  open();
  const selection = () => workspace.getSnapshot().research!.selection;
  const evidence = () =>
    companySnapshotEvidence(
      selection(),
      workspace.eod.getSnapshot(),
      workspace.annual.getSnapshot(),
      workspace.filings.getSnapshot(),
    );
  return { fixture, workspace, open, selection, evidence };
}
function author(workspace: ManagedWorkspace) {
  const model = workspace.valuation;
  for (const [field, value] of Object.entries({
    startingUnleveredCashFlowUsd: "100",
    enterpriseToEquityBridgeUsd: "100",
    dilutedShares: "10",
    waccPercent: "10",
    terminalGrowthPercent: "0",
  }))
    model.setDcfField(field as DcfField, value);
  for (const [field, value] of Object.entries({
    baseRevenue: "1000",
    cash: "100",
    debt: "200",
    dilutedShares: "100",
    discountRatePercent: "10",
  }))
    model.setExitField(field as ExitField, value);
  for (const [scenario, growth] of [
    ["conservative", "0"],
    ["base", "10"],
    ["expansion", "20"],
  ] as const) {
    model.setDcfScenario(scenario, growth);
    model.setExitScenario(scenario, "annualRevenueGrowthPercent", growth);
    model.setExitScenario(scenario, "targetEbitdaMarginPercent", "20");
    model.setExitScenario(scenario, "exitMultiple", "10");
  }
  expect(model.getSnapshot().calculation).toBeNull();
  return model.calculate()!;
}
describe("invented native authored valuation scenario", () => {
  it("retains one exact draft across Back, saves and fresh-loads its complete note, captures schema 2 results and retires without source calls", async () => {
    const f = await setup();
    let capture = author(f.workspace);
    expect(capture.dcfResult).toMatchObject({
      status: "available",
      scenarios: {
        base: { valuePerShareUsd: "140.00", equityValueUsd: "1400.00" },
      },
    });
    expect(capture.exitResult).toMatchObject({
      status: "available",
      scenarios: { base: { valuePerShare: "19.00", equityValue: "1900.000" } },
    });
    const rendered = renderToStaticMarkup(
      <ManagedValuationResults calculation={capture} />,
    );
    expect(rendered).toContain("140.00");
    expect(rendered).toContain("19.00");
    expect(rendered).toContain(
      '<th scope="row">Base</th><td>10.0000</td><td>1500.00</td><td>1400.00</td><td>140.00</td><td>66.67</td>',
    );
    expect(rendered).toContain(
      '<th scope="row">Base</th><td>1610.510</td><td>322.102</td><td>2000.000</td><td>1900.000</td><td>19.00</td>',
    );
    const previousPreview = f.workspace.prepareValuationNote(
      f.selection(),
      "dcf",
      "base",
    ).preview!;
    const previousReport = prepareCompanyReport(
      f.selection(),
      f.evidence(),
      f.workspace.getResearchWatchlist(f.selection()),
      undefined,
      capture,
    )!;
    f.workspace.valuation.setExitField("cash", "101");
    expect(f.workspace.valuationNotePreviewIsCurrent(previousPreview)).toBe(
      false,
    );
    expect(f.workspace.appendValuationNote(previousPreview).appended).toBe(
      false,
    );
    expect(
      companyReportIsCurrent(
        previousReport,
        f.selection(),
        f.evidence(),
        f.workspace.getResearchWatchlist(f.selection()),
        f.workspace.valuation.getSnapshot().calculation,
      ),
    ).toBe(false);
    f.workspace.valuation.setExitField("cash", "100");
    capture = f.workspace.valuation.calculate()!;
    const preview = f.workspace.prepareValuationNote(
      f.selection(),
      "dcf",
      "base",
    ).preview!;
    expect(preview.note).toBe(authoredValuationNoteDraft);
    expect(
      f.workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe(authoredValuationPrefix);
    expect(f.fixture.getSnapshot().save).toBe(0);
    expect(f.workspace.appendValuationNote(preview).appended).toBe(true);
    expect(f.workspace.appendValuationNote(preview).appended).toBe(false);
    f.workspace.closeResearch();
    expect(f.workspace.valuation.getSnapshot().context).toBeNull();
    expect(
      f.workspace.valuation.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd,
    ).toBe("100");
    f.open();
    expect(f.workspace.valuation.getSnapshot().calculation).toBe(capture);
    f.workspace.closeResearch();
    await f.workspace.coordinator.save();
    expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 2,
      dirty: false,
    });
    await f.workspace.coordinator.load();
    expect(
      f.workspace.coordinator
        .getSnapshot()
        .draft!.memberships.map((row) => row.note),
    ).toEqual([authoredValuationNoteDraft, "Invented second note"]);
    f.open();
    expect(f.workspace.valuation.getSnapshot().calculation).toBe(capture);
    const report = prepareCompanyReport(
      f.selection(),
      f.evidence(),
      f.workspace.getResearchWatchlist(f.selection()),
      undefined,
      capture,
    )!;
    const document = formatCompanyReportDocument(report)!;
    expect(isCompanyReportDocument(document)).toBe(true);
    const parsed = JSON.parse(document.text) as {
      schemaVersion: unknown;
      valuation: unknown;
      authoredResearch: { note: unknown };
      sources: Record<string, unknown>;
    };
    expect(parsed.schemaVersion).toBe("2.0.0");
    expect(parsed.valuation).toEqual(capture);
    expect(capture.dcfDraft.forecastYears).toBe("5");
    expect(capture.exitDraft.horizonYears).toBe("5");
    if (
      capture.dcfResult.status !== "available" ||
      capture.exitResult.status !== "available"
    )
      throw new Error("Expected both complete models in the captured document");
    expect(capture.dcfResult.sensitivity.cells).toHaveLength(25);
    expect(capture.exitResult.sensitivity.cells).toHaveLength(25);
    expect(parsed.authoredResearch.note).toBe(authoredValuationNoteDraft);
    for (const source of Object.values(parsed.sources))
      expect(source).toEqual({
        status: "not_loaded",
        lastAttemptFailed: false,
      });
    f.workspace.valuation.setExitField("cash", "101");
    expect(
      companyReportIsCurrent(
        report,
        f.selection(),
        f.evidence(),
        f.workspace.getResearchWatchlist(f.selection()),
        f.workspace.valuation.getSnapshot().calculation,
      ),
    ).toBe(false);
    expect(JSON.parse(document.text) as unknown).toEqual(parsed);
    expect(f.workspace.sessionOwner.getSnapshot()).toMatchObject({
      valuationInputs: true,
      needsLeaveReview: true,
    });
    await f.workspace.sessionOwner.signOut();
    expect(f.workspace.valuation.getSnapshot()).toMatchObject({
      retired: true,
      owner: null,
      context: null,
      calculation: null,
      dcfDraft: { startingUnleveredCashFlowUsd: "", forecastYears: "" },
      exitDraft: { cash: "", horizonYears: "" },
    });
    expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
    const fresh = new ManagedWorkspace(f.fixture.api, {
      ...f.fixture.session,
      sessionId: "invented-valuation-reopened",
    });
    owners.push(fresh);
    await fresh.coordinator.load();
    expect(fresh.coordinator.getSnapshot().draft!.memberships[0]!.note).toBe(
      authoredValuationNoteDraft,
    );
    expect(fresh.valuation.hasDraft()).toBe(false);
    expect(fresh.valuation.getSnapshot().calculation).toBeNull();
    expect(f.fixture.getSnapshot()).toMatchObject({
      load: 3,
      status: 1,
      save: 1,
      signOut: 1,
      annual: 0,
      eod: 0,
      filings: 0,
      marketsEod: 0,
      calendar: 0,
      fed: 0,
      search: 0,
      resolve: 0,
      token: 0,
    });
  });

  it("refuses a different note payload and leaves the invented saved store intact", async () => {
    const f = await setup();
    const loaded = f.workspace.coordinator.getSnapshot().draft!;
    await expect(
      f.fixture.api.save(
        {
          expectedVersion: 1,
          idempotencyKey: crypto.randomUUID(),
          payload: loaded,
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow("Unexpected fixture operation: save");
    const saved = await f.fixture.api.load(new AbortController().signal);
    expect(saved.version).toBe(1);
    expect(saved.payload.memberships[0]!.note).toBe("");
    expect(f.fixture.getSnapshot()).toMatchObject({
      annual: 0,
      eod: 0,
      filings: 0,
    });
  });
});
