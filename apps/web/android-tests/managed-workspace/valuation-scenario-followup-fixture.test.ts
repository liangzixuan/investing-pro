import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { ValuationScenarioFollowupFixtureDiagnostics } from "./valuation-scenario-followup-fixture-diagnostics";
import { afterEach, describe, expect, it } from "vitest";
import {
  encodeMainWatchlistPayload,
  type ResearchFollowup,
  type ResearchFollowupsPayload,
  encodeResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import {
  prepareValuationFollowup,
  resolveValuationFollowupScenario,
} from "../../src/clerk-trial/managed-valuation-followup";
import { createFixture, savedValuationInputs } from "./fixture";
import {
  valuationFollowupCheck,
  valuationFollowupDueOn,
  valuationFollowupExpected,
  valuationFollowupOriginal,
  valuationFollowupQuestion,
} from "./valuation-scenario-followup-fixture";

const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.sessionOwner.dispose();
});
type Fixture = Awaited<ReturnType<typeof createFixture>>;
function makeWorkspace(fixture: Fixture, fresh = false) {
  const workspace = new ManagedWorkspace(
    fixture.api,
    fresh ? fixture.followups!.nextSession() : fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
    },
  );
  owners.push(workspace);
  return workspace;
}
async function setup() {
  const fixture = await createFixture("valuation-scenario-followup"),
    workspace = makeWorkspace(fixture);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.note(
    "listing-zero",
    "Independent unsaved Watchlist note Café 東京 📈",
  );
  workspace.openWatchlistAnnual(
    workspace.coordinator.getSnapshot().draft!.memberships[0]!,
  );
  const selection = workspace.getSnapshot().research!.selection;
  return { fixture, workspace, selection };
}
type Mounted = Awaited<ReturnType<typeof setup>>;
function author(f: Mounted) {
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
async function loaded() {
  const f = await setup();
  author(f);
  f.workspace.valuation.calculate();
  await f.workspace.loadValuationFollowups(f.selection, () => true);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toEqual(
    valuationFollowupOriginal(f.fixture),
  );
  return f;
}
function prepare(f: Mounted, question = valuationFollowupQuestion) {
  const context = f.workspace.captureValuationFollowup(f.selection);
  expect(context.reason).toBeNull();
  return prepareValuationFollowup(
    context.port!,
    {
      model: "exit",
      scenario: "base",
      question: question,
      dueOn: valuationFollowupDueOn,
    },
    () => true,
  );
}
function noOtherEffects(f: Mounted, loads = 1) {
  expect(f.fixture.getSnapshot()).toMatchObject({
    load: loads,
    save: 0,
    eod: 0,
    annual: 0,
    interimReport: 0,
    filings: 0,
    marketsEod: 0,
    search: 0,
    calendar: 0,
    bls: 0,
    fed: 0,
    portfolioLoad: 0,
    portfolioSave: 0,
    valuationLoad: 0,
    valuationSave: 0,
    token: 0,
    signOut: 0,
  });
}

function canonicalReadout(workspace: ManagedWorkspace) {
  const document = load(
    renderToStaticMarkup(
      createElement(ValuationScenarioFollowupFixtureDiagnostics, {
        model: workspace.followups,
      }),
    ),
  );
  const readout = document("#fixture-valuation-followup-canonical");
  expect(readout).toHaveLength(1);
  expect(readout.is("[hidden]")).toBe(true);
  return readout.text();
}
async function reviewCreated(
  f: Mounted,
  created: ResearchFollowup,
  expected: ResearchFollowupsPayload,
  before: string,
) {
  f.workspace.closeResearch();
  f.workspace.setView("followups");
  f.workspace.followups.select(created.id);
  const prepared = await f.workspace.prepareFollowupResearch(created);
  expect(prepared).not.toBeNull();
  f.workspace.openFollowupResearch(prepared!);
  expect(f.workspace.getSnapshot().research?.selection.listing).toEqual(
    created.listing,
  );
  f.workspace.closeResearch();
  expect(f.workspace.getSnapshot()).toMatchObject({
    view: "followups",
    research: null,
  });
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toEqual(
    expected,
  );
  expect(
    encodeMainWatchlistPayload(f.workspace.coordinator.getSnapshot().draft!),
  ).toBe(before);
}
async function saveAndReadFresh(
  f: Mounted,
  expected: ResearchFollowupsPayload,
  watchlist: ReturnType<ManagedWorkspace["coordinator"]["getSnapshot"]>,
) {
  await f.workspace.followups.coordinator.save();
  expect(canonicalReadout(f.workspace)).toBe(
    encodeResearchFollowupsPayload(expected),
  );
  expect(f.workspace.followups.coordinator.getSnapshot()).toMatchObject({
    baseVersion: 2,
    dirty: false,
    draft: expected,
  });
  f.workspace.sessionOwner.dispose();
  const fresh = makeWorkspace(f.fixture, true);
  await fresh.coordinator.load();
  await fresh.refreshCatalog();
  fresh.setView("followups");
  expect(fresh.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(canonicalReadout(fresh)).toBe("null");
  await fresh.followups.coordinator.load();
  expect(canonicalReadout(fresh)).toBe(
    encodeResearchFollowupsPayload(expected),
  );
  expect(
    encodeResearchFollowupsPayload(
      fresh.followups.coordinator.getSnapshot().draft!,
    ),
  ).toBe(encodeResearchFollowupsPayload(expected));
  expect(fresh.coordinator.getSnapshot().draft!.memberships[0]!.note).not.toBe(
    watchlist.draft!.memberships[0]!.note,
  );
  expect(f.fixture.followups!.getSnapshot()).toMatchObject({
    session: 2,
    load: 2,
    save: 1,
    commits: 1,
    replays: 0,
  });
  noOtherEffects(f, 2);
}

describe("isolated native authored valuation question fixture", () => {
  it("keeps explicit calculations, initial Follow-ups load and both model/scenario choices separate", async () => {
    const f = await setup();
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.workspace.canLoadValuationFollowups(f.selection)).toBe(false);
    author(f);
    expect(f.workspace.valuation.getSnapshot().calculation).toBeNull();
    const calculation = f.workspace.valuation.calculate()!;
    expect(
      resolveValuationFollowupScenario(calculation, "", "base").summary,
    ).toBeNull();
    expect(
      resolveValuationFollowupScenario(calculation, "exit", "").summary,
    ).toBeNull();
    expect(
      resolveValuationFollowupScenario(calculation, "dcf", "base").summary
        ?.valuePerShareUsd,
    ).toBe("140.00");
    expect(
      resolveValuationFollowupScenario(calculation, "exit", "base").summary
        ?.valuePerShareUsd,
    ).toBe("19.00");
    expect(f.workspace.canLoadValuationFollowups(f.selection)).toBe(true);
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      load: 0,
      save: 0,
      commits: 0,
    });
    noOtherEffects(f);
  });

  it("refuses complete-check overflow, control text, unavailable results and retired previews without changing a resource", async () => {
    const f = await loaded(),
      before = f.workspace.followups.coordinator.getSnapshot();
    expect(prepare(f, "x".repeat(500)).preview).toBeNull();
    expect(prepare(f, "Bad\nquestion").preview).toBeNull();
    const preview = prepare(f).preview!;
    f.workspace.valuation.setExitField("dilutedShares", "0");
    expect(preview.create()).toBeNull();
    const unavailable = f.workspace.valuation.calculate()!;
    expect(
      resolveValuationFollowupScenario(unavailable, "exit", "base").summary,
    ).toBeNull();
    expect(f.workspace.followups.coordinator.getSnapshot()).toBe(before);
    noOtherEffects(f);
  });

  it("creates once, keeps the whole resource through global review/Research/Back, saves separately and fresh-loads exact bytes", async () => {
    const f = await loaded(),
      watchlist = f.workspace.coordinator.getSnapshot(),
      editor = f.workspace.valuation.getSnapshot();
    const before = encodeMainWatchlistPayload(watchlist.draft!);
    const preview = prepare(f).preview!;
    expect(preview.check).toBe(valuationFollowupCheck);
    expect(preview.dueOn).toBe(valuationFollowupDueOn);
    expect(preview.catalogSnapshotSha256).toBe(
      f.fixture.researchCoverage.catalogSnapshotSha256,
    );
    expect(preview.listing).toEqual(
      f.fixture.researchCoverage.listings[0]!.listing,
    );
    const created = preview.create()!;
    expect(created).not.toBeNull();
    expect(preview.create()).toBeNull();
    const expected = valuationFollowupExpected(f.fixture, created.id);
    expect(canonicalReadout(f.workspace)).toBe(
      encodeResearchFollowupsPayload(expected),
    );
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toEqual(
      expected,
    );
    expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
    expect(f.workspace.valuation.getSnapshot()).toBe(editor);
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      load: 1,
      save: 0,
      commits: 0,
    });
    await reviewCreated(f, created, expected, before);
    await saveAndReadFresh(f, expected, watchlist);
  });

  it("refuses a canonical whole-resource Save that changes an older share-class assessment", async () => {
    const f = await loaded(),
      entry = prepare(f).preview!.create()!;
    f.workspace.closeResearch();
    f.workspace.setView("followups");
    const visit = await f.workspace.prepareFollowupResearch(entry);
    f.workspace.openFollowupResearch(visit!);
    f.workspace.closeResearch();
    const expected = valuationFollowupExpected(f.fixture, entry.id);
    const payload = {
      ...expected,
      entries: expected.entries.map((row, i) =>
        i === 0 ? { ...row, result: "Wrong earlier assessment" } : row,
      ),
    };
    await expect(
      Promise.resolve().then(() =>
        f.fixture.api.saveFollowups(
          {
            expectedVersion: 1,
            idempotencyKey: "invented-valuation-wrong-payload-key",
            payload,
          },
          new AbortController().signal,
        ),
      ),
    ).rejects.toThrow("Unexpected invented valuation-scenario-followup action");
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      save: 0,
      commits: 0,
      version: 1,
    });
  });
});

it("refuses literal zero cash flow and preserves an available positive result rounded to zero", async () => {
  const f = await loaded();
  const draft = f.workspace.followups.coordinator.getSnapshot().draft;
  const v = f.workspace.valuation;
  v.setDcfField("startingUnleveredCashFlowUsd", "0");
  v.setDcfField("enterpriseToEquityBridgeUsd", "0");
  const unavailable = v.calculate()!;
  expect(unavailable.dcfResult).toMatchObject({
    status: "unavailable",
    reason: "starting_cash_flow_nonpositive",
  });
  expect(
    resolveValuationFollowupScenario(unavailable, "dcf", "base").summary,
  ).toBeNull();
  v.setDcfField("startingUnleveredCashFlowUsd", "0.000000000001");
  v.setDcfField("dilutedShares", "1000000000000");
  const available = v.calculate()!;
  expect(available.dcfResult.status).toBe("available");
  const context = f.workspace.captureValuationFollowup(f.selection);
  expect(context.reason).toBeNull();
  const preview = prepareValuationFollowup(
    context.port!,
    {
      model: "dcf",
      scenario: "base",
      question: valuationFollowupQuestion,
      dueOn: valuationFollowupDueOn,
    },
    () => true,
  ).preview!;
  expect(preview.summary.valuePerShareUsd).toBe("0.00");
  expect(preview.check).toContain("USD/share 0.00. Summary only;");
  preview.cancel();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(draft);
  noOtherEffects(f);
});
