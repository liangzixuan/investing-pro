import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { CompletePayload } from "../../src/clerk-trial/ValuationAssumptionsPanels";
import { ManagedValuationAssumptions } from "../../src/clerk-trial/ManagedValuationAssumptions";
import type {
  DcfField,
  ExitField,
  ExitScenarioField,
} from "../../src/clerk-trial/managed-valuation-workbench";
import type { ManagedValuationAssumptionsCommand } from "@research-cockpit/contracts";
import { createFixture } from "./fixture";

const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.sessionOwner.dispose();
});
async function setup() {
  const fixture = await createFixture("saved-valuation");
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
  workspace.note("listing-zero", "Independent saved valuation note");
  const open = () =>
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
  open();
  return {
    fixture,
    workspace,
    model: workspace.valuationAssumptions,
    controls: fixture.savedValuation!,
    open,
  };
}
function author(f: Awaited<ReturnType<typeof setup>>) {
  const { dcf, exit } = f.controls.expected;
  for (const [key, value] of Object.entries(dcf.inputs)) {
    if (key !== "scenarios")
      f.workspace.valuation.setDcfField(key as DcfField, value as string);
  }
  for (const [key, value] of Object.entries(exit.inputs)) {
    if (key !== "scenarios")
      f.workspace.valuation.setExitField(key as ExitField, value as string);
  }
  for (const scenario of ["conservative", "base", "expansion"] as const) {
    f.workspace.valuation.setDcfScenario(
      scenario,
      dcf.inputs.scenarios[scenario].annualCashFlowGrowthPercent,
    );
    for (const [key, value] of Object.entries(exit.inputs.scenarios[scenario]))
      f.workspace.valuation.setExitScenario(
        scenario,
        key as ExitScenarioField,
        value,
      );
  }
}
async function reviewAndSave(f: Awaited<ReturnType<typeof setup>>) {
  const scratch = f.workspace.valuation.getSnapshot();
  await f.model.coordinator.load();
  expect(f.workspace.valuation.getSnapshot()).toBe(scratch);
  await f.model.prepareStage();
  const review = f.model.getSnapshot().stageReview!;
  expect(review.capture.entry).toEqual(f.controls.expected);
  const stageMarkup = renderToStaticMarkup(
    <ManagedValuationAssumptions
      model={f.model}
      workbench={f.workspace.valuation}
      navigationPending={false}
    />,
  );
  expect(stageMarkup).toContain("Review complete inputs before staging");
  expect(stageMarkup).toContain("authored-exit-multiple-v1");
  expect(f.controls.getSnapshot().save).toBe(0);
  expect(f.model.stageCurrent(review)).toBe(true);
  const draft = f.model.coordinator.getSnapshot().draft!;
  const markup = renderToStaticMarkup(
    <CompletePayload
      label="Complete valuation draft for Save"
      payload={draft}
    />,
  );
  expect(markup).toContain("100.00");
  expect(markup).toContain("authored-cash-flow-dcf-v1");
  expect(f.controls.getSnapshot().save).toBe(0);
  await f.model.coordinator.save();
  expect(f.model.coordinator.getSnapshot().saved!.payload.entries).toEqual([
    f.controls.expected,
  ]);
  expect(f.workspace.valuation.hasDraft()).toBe(false);
}
function assertIsolation(
  f: Awaited<ReturnType<typeof setup>>,
  drafts: readonly unknown[],
) {
  expect(f.workspace.coordinator.getSnapshot().draft).toBe(drafts[0]);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(drafts[1]);
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBe(drafts[2]);
  expect(f.fixture.getSnapshot()).toMatchObject({
    load: 1,
    status: 1,
    save: 0,
    annual: 0,
    eod: 0,
    filings: 0,
    marketsEod: 0,
    calendar: 0,
    fed: 0,
    search: 0,
    resolve: 0,
    token: 0,
    signOut: 0,
  });
  expect(f.controls.getSnapshot()).toEqual({ load: 2, save: 1, resolve: 1 });
}

describe("invented Android saved valuation input fixture", () => {
  it("loads, reviews/stages, reviews/saves, independently clears/reopens, reviews/uses and calculates both exact models", async () => {
    const f = await setup();
    const drafts = [
      f.workspace.coordinator.getSnapshot().draft,
      f.workspace.followups.coordinator.getSnapshot().draft,
      f.workspace.portfolio.coordinator.getSnapshot().draft,
    ];
    author(f);
    expect(f.workspace.valuation.getSnapshot().calculation).toBeNull();
    await reviewAndSave(f);
    const oldCalculation = f.workspace.valuation.calculate()!;
    const owner = f.workspace.getSnapshot().research!.selection;
    const oldNote = f.workspace.prepareValuationNote(
      owner,
      "dcf",
      "base",
    ).preview!;
    f.workspace.valuation.setExitField("cash", "101.00");
    f.workspace.valuation.discardAndUse(owner);
    expect(
      f.workspace.valuation.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd,
    ).toBe("");
    f.workspace.closeResearch();
    f.open();
    await f.model.coordinator.load();
    const confirmed =
      f.model.coordinator.getSnapshot().saved!.payload.entries[0]!;
    const firstReview = f.model.reviewSavedInputs(confirmed)!;
    expect(firstReview.current.dcfDraft.startingUnleveredCashFlowUsd).toBe("");
    f.workspace.valuation.setExitField("cash", "newer scratch");
    expect(f.model.useSavedInputs(firstReview)).toBe(false);
    const review = f.model.reviewSavedInputs(confirmed)!;
    expect(f.model.useSavedInputs(review)).toBe(true);
    expect(f.workspace.valuation.getSnapshot().dcfDraft).toEqual(
      f.controls.expected.dcf.inputs,
    );
    expect(f.workspace.valuation.getSnapshot().exitDraft).toEqual(
      f.controls.expected.exit.inputs,
    );
    expect(f.workspace.valuation.getSnapshot().owner).toEqual(
      f.workspace.getSnapshot().research!.selection,
    );
    expect(f.workspace.valuation.getSnapshot().calculation).toBeNull();
    expect(f.workspace.valuationNotePreviewIsCurrent(oldNote)).toBe(false);
    expect(f.workspace.appendValuationNote(oldNote).appended).toBe(false);
    const calculated = f.workspace.valuation.calculate()!;
    expect(calculated).not.toBe(oldCalculation);
    expect(calculated.dcfResult).toMatchObject({
      status: "available",
      scenarios: { base: { valuePerShareUsd: "140.00" } },
    });
    expect(calculated.exitResult).toMatchObject({
      status: "available",
      scenarios: { base: { valuePerShare: "19.00" } },
    });
    assertIsolation(f, drafts);
  });

  it("retains default refusal outside the one explicit scenario", async () => {
    const fixture = await createFixture();
    const signal = new AbortController().signal;
    expect(fixture.savedValuation).toBeUndefined();
    await expect(fixture.api.loadValuationAssumptions(signal)).rejects.toThrow(
      "Unexpected invented valuation assumptions read",
    );
    await expect(
      fixture.api.saveValuationAssumptions(
        {
          expectedVersion: 0,
          idempotencyKey: "invented-valuation-refused",
          payload: { schemaVersion: 1, entries: [] },
        },
        signal,
      ),
    ).rejects.toThrow("Unexpected invented valuation assumptions write");
  });

  it("refuses cancelled, wrong and extra collection operations without changing the bounded store", async () => {
    const f = await setup();
    const aborted = new AbortController();
    aborted.abort();
    expect(() =>
      f.fixture.api.loadValuationAssumptions(aborted.signal),
    ).toThrow("Unexpected invented saved valuation");
    author(f);
    await f.model.coordinator.load();
    await f.model.prepareStage();
    const command: ManagedValuationAssumptionsCommand = {
      expectedVersion: 0,
      idempotencyKey: "invented-valuation-save-command",
      payload: { schemaVersion: 1, entries: [f.controls.expected] },
    };
    const wrong = { ...command, payload: { ...command.payload, entries: [] } };
    expect(() =>
      f.fixture.api.saveValuationAssumptions(
        wrong,
        new AbortController().signal,
      ),
    ).toThrow("Unexpected invented saved valuation");
    expect(f.controls.saved().version).toBe(0);
    expect(f.model.stageCurrent()).toBe(true);
    await f.model.coordinator.save();
    await f.model.coordinator.load();
    const before = f.controls.getSnapshot();
    expect(() =>
      f.fixture.api.loadValuationAssumptions(new AbortController().signal),
    ).toThrow("Unexpected invented saved valuation");
    expect(() =>
      f.fixture.api.saveValuationAssumptions(
        command,
        new AbortController().signal,
      ),
    ).toThrow("Unexpected invented saved valuation");
    expect(f.controls.getSnapshot()).toBe(before);
    expect(f.controls.saved().payload.entries).toEqual([f.controls.expected]);
  });
});
