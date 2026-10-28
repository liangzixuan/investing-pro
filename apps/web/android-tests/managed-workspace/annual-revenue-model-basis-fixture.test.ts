import { afterEach, describe, expect, it } from "vitest";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import { prepareCompanyReport } from "../../src/clerk-trial/managed-company-report";
import { formatCompanyReportDocument } from "../../src/clerk-trial/managed-company-report-document";
import { createFixture, savedValuationInputs } from "./fixture";
import {
  annualRevenueModelExpectedNote,
  annualRevenueModelPrefix,
} from "./annual-revenue-model-basis-fixture";

const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.sessionOwner.dispose();
});
async function setup() {
  const fixture = await createFixture("annual-revenue-model-basis");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
    },
  );
  owners.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.note("listing-zero", annualRevenueModelPrefix);
  workspace.openWatchlistAnnual(
    workspace.coordinator.getSnapshot().draft!.memberships[0]!,
  );
  const selection = workspace.getSnapshot().research!.selection;
  return { fixture, workspace, selection, controls: fixture.savedValuation! };
}
function author(f: Awaited<ReturnType<typeof setup>>) {
  const v = f.workspace.valuation,
    input = savedValuationInputs!;
  const { scenarios: dcf, ...dcfFields } = input.dcf.inputs;
  for (const [k, value] of Object.entries(dcfFields))
    v.setDcfField(k as "waccPercent", value);
  const { scenarios: exit, ...exitFields } = input.exit.inputs;
  for (const [k, value] of Object.entries(exitFields))
    v.setExitField(k as "baseRevenue", value);
  for (const s of ["conservative", "base", "expansion"] as const) {
    v.setDcfScenario(s, dcf[s].annualCashFlowGrowthPercent);
    for (const [k, value] of Object.entries(exit[s]))
      v.setExitScenario(s, k as "exitMultiple", value);
  }
}
type Fixture = Awaited<ReturnType<typeof setup>>;
async function loadAndApply(f: Fixture) {
  const w = f.workspace;
  author(f);
  const before = w.valuation.getSnapshot();
  expect(
    w.prepareAnnualRevenueBasis(f.selection, "Revenues").preview,
  ).toBeNull();
  expect(w.valuation.getSnapshot()).toBe(before);
  await w.requestResearchSource(w.getSnapshot().research!, "annual");
  const annual = w.annual.getSnapshot().response!;
  expect(f.fixture.getSnapshot()).toMatchObject({
    annual: 1,
    eod: 0,
    filings: 0,
    save: 0,
  });
  const p = w.prepareAnnualRevenueBasis(f.selection, "Revenues").preview!;
  expect(p).not.toBeNull();
  expect(p.source).toMatchObject({
    cik: "0000000001",
    value: "1000",
    unit: "USD",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    cutoffAt: "2026-09-20T00:00:00.000Z",
    completedAt: "2026-09-20T00:00:02.000Z",
  });
  expect(w.valuation.getSnapshot()).toBe(before);
  expect(p.before.cik).toBeNull();
  expect(p.before.exit.inputs.baseRevenue).toBe("1000.00");
  expect(p.after.exit.inputs.baseRevenue).toBe("1000");
  expect(w.applyAnnualRevenueBasis(p).applied).toBe(true);
  const after = w.valuation.getSnapshot();
  expect(after.dcfDraft).toEqual(before.dcfDraft);
  expect(after.exitDraft).toEqual({
    ...before.exitDraft,
    baseRevenue: "1000",
  });
  expect(after.calculation).toBeNull();
  expect(w.applyAnnualRevenueBasis(p).applied).toBe(false);
  expect(w.annual.getSnapshot().response).toBe(annual);
  return { annual, after };
}
function calculateAndAppend(f: Fixture) {
  const w = f.workspace;
  const calculated = w.valuation.calculate()!;
  expect(calculated.exitResult).toMatchObject({
    scenarios: { base: { valuePerShare: "19.00" } },
  });
  expect(calculated.dcfResult).toMatchObject({
    scenarios: { base: { valuePerShareUsd: "140.00" } },
  });
  const note = w.prepareValuationNote(f.selection, "exit", "base");
  expect(note.reason).toBeNull();
  expect(note.preview?.note).toBe(annualRevenueModelExpectedNote);
  expect([...annualRevenueModelExpectedNote].length).toBeLessThanOrEqual(2000);
  expect(w.appendValuationNote(note.preview!).appended).toBe(true);
  return calculated;
}
function captureReport(
  f: Fixture,
  { annual, after }: Awaited<ReturnType<typeof loadAndApply>>,
  calculated: ReturnType<typeof calculateAndAppend>,
) {
  const w = f.workspace;
  const report = prepareCompanyReport(
    f.selection,
    companySnapshotEvidence(
      f.selection,
      w.eod.getSnapshot(),
      w.annual.getSnapshot(),
      w.filings.getSnapshot(),
      w.interim.getSnapshot(),
    ),
    w.getResearchWatchlist(f.selection),
    () => new Date("2026-10-27T00:00:00.000Z"),
    calculated,
  )!;
  const document = formatCompanyReportDocument(report)!;
  const parsed: unknown = JSON.parse(document.text);
  expect(parsed).toHaveProperty("schemaVersion", "6.0.0");
  expect(parsed).toHaveProperty(
    "authoredResearch.note",
    annualRevenueModelExpectedNote,
  );
  expect(parsed).toHaveProperty("sources.annual.response", annual);
  expect(parsed).toHaveProperty("valuation.exitDraft", after.exitDraft);
}
async function saveInputResource(f: Fixture) {
  const w = f.workspace;
  const model = w.valuationAssumptions;
  await model.coordinator.load();
  await model.prepareStage();
  expect(model.stageCurrent(model.getSnapshot().stageReview)).toBe(true);
  await model.coordinator.save();
  expect(f.controls.getSnapshot()).toEqual({ load: 1, save: 1, resolve: 1 });
  expect(f.controls.saved().payload.entries).toEqual([f.controls.expected]);
  expect(JSON.stringify(f.controls.saved())).not.toContain(
    "Annual revenue basis",
  );
  expect(JSON.stringify(f.controls.saved())).not.toContain("sourceSha");
}
async function saveAndFreshReadBoth(f: Fixture) {
  const w = f.workspace;
  expect(f.fixture.getSnapshot().save).toBe(0);
  w.closeResearch();
  w.setView("watchlist");
  await w.coordinator.save();
  await w.coordinator.load();
  await w.valuationAssumptions.coordinator.load();
  expect(w.coordinator.getSnapshot().draft!.memberships[0]!.note).toBe(
    annualRevenueModelExpectedNote,
  );
  expect(w.coordinator.getSnapshot().draft!.memberships[1]!.note).toBe(
    "Invented second note",
  );
  expect(f.controls.saved().payload.entries).toEqual([f.controls.expected]);
  expect(f.fixture.getSnapshot()).toMatchObject({
    load: 2,
    save: 1,
    status: 1,
    annual: 1,
    eod: 0,
    filings: 0,
    search: 0,
    token: 0,
    signOut: 0,
  });
  expect(f.controls.getSnapshot()).toEqual({ load: 2, save: 1, resolve: 1 });
}
function watchlistCommand(f: Fixture) {
  return {
    expectedVersion: 1,
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
    payload: structuredClone(f.workspace.coordinator.getSnapshot().draft!),
  };
}
type WatchlistCommand = ReturnType<typeof watchlistCommand>;
type MembershipChange = {
  readonly position: number;
  readonly fields: Partial<WatchlistCommand["payload"]["memberships"][number]>;
};
function projectMembership(
  command: WatchlistCommand,
  change: MembershipChange,
) {
  command.payload = {
    ...command.payload,
    memberships: command.payload.memberships.map((member, position) =>
      position === change.position ? { ...member, ...change.fields } : member,
    ),
  };
}
const refusedChanges: readonly [string, (command: WatchlistCommand) => void][] =
  [
    [
      "version",
      (command) => {
        command.expectedVersion = 2;
      },
    ],
    [
      "clipped note",
      (command) => {
        projectMembership(command, {
          position: 0,
          fields: { note: annualRevenueModelExpectedNote.slice(0, -1) },
        });
      },
    ],
    [
      "other note",
      (command) => {
        projectMembership(command, {
          position: 1,
          fields: { note: "Unrelated replacement" },
        });
      },
    ],
    [
      "order",
      (command) => {
        command.payload = {
          ...command.payload,
          memberships: [...command.payload.memberships].reverse(),
        };
      },
    ],
    [
      "identity",
      (command) => {
        projectMembership(command, {
          position: 0,
          fields: { symbol: "ALTERED" },
        });
      },
    ],
    [
      "catalog",
      (command) => {
        command.payload = {
          ...command.payload,
          snapshotSha256: `sha256:${"b".repeat(64)}`,
        };
      },
    ],
    ["aborted", () => undefined],
  ];
describe("invented Annual revenue authored model basis", () => {
  it("applies only base revenue, calculates explicitly and keeps a whole cited note/report through Back and independent saves/fresh reads", async () => {
    const f = await setup();
    const basis = await loadAndApply(f);
    const calculated = calculateAndAppend(f);
    captureReport(f, basis, calculated);
    await saveInputResource(f);
    await saveAndFreshReadBoth(f);
  });
  it("refuses unrelated source calls and an early or incomplete Watchlist save", async () => {
    const f = await setup(),
      signal = new AbortController().signal;
    expect(() => f.fixture.api.recentFilings({} as never, signal)).toThrow();
    expect(() => f.fixture.api.eodHistory({} as never, signal)).toThrow();
    expect(() =>
      f.fixture.api.save(
        {
          expectedVersion: 1,
          idempotencyKey: "00000000-0000-4000-8000-000000000001",
          payload: f.workspace.coordinator.getSnapshot().draft!,
        },
        signal,
      ),
    ).toThrow();
    expect(f.fixture.getSnapshot()).toMatchObject({
      annual: 0,
      eod: 0,
      filings: 0,
      save: 0,
    });
  });
  it("refuses changed ready commands before consuming either independent resource", async () => {
    const f = await setup();
    await loadAndApply(f);
    calculateAndAppend(f);
    await saveInputResource(f);
    const saved = f.controls.saved();
    for (const [name, change] of refusedChanges) {
      const command = watchlistCommand(f);
      const controller = new AbortController();
      change(command);
      if (name === "aborted") controller.abort();
      expect(
        () => f.fixture.api.save(command, controller.signal),
        name,
      ).toThrow();
      expect(f.fixture.getSnapshot().save, name).toBe(0);
      expect(f.controls.saved(), name).toEqual(saved);
    }
    await f.workspace.coordinator.save();
    expect(f.fixture.getSnapshot().save).toBe(1);
    expect(f.controls.saved()).toEqual(saved);
  });
});
