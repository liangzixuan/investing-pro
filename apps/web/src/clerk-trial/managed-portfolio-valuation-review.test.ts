import { afterEach, expect, it, vi } from "vitest";
import {
  createPortfolioValuationFixture,
  portfolioScenarioTime,
} from "./test-portfolio-valuation-fixture";
import { preparePortfolioSavedScenarioRows } from "./portfolio-valuation-plan";
import { captureValuationCalculationGuard } from "./managed-valuation-workbench";
const fixtures: Awaited<ReturnType<typeof createPortfolioValuationFixture>>[] =
  [];
async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(portfolioScenarioTime);
  const f = await createPortfolioValuationFixture();
  fixtures.push(f);
  return f;
}
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("previews complete holdings outside unloaded Watchlist and evaluates six passive outcomes with exact raw maps, dates and no effects", async () => {
  const f = await setup();
  const counts = f.fixture.watchlistSavedScenario!.getSnapshot(),
    editor = f.workspace.valuation.getSnapshot(),
    portfolio = f.workspace.portfolio.coordinator.getSnapshot(),
    followups = f.workspace.followups.coordinator.getSnapshot();
  expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
  const p = f.model.preview(f.model.getSnapshot())!;
  expect(p.plan).not.toBeNull();
  expect(p.plan!.report).toBe(f.report);
  expect(p.plan!.rows.map((r) => r.source.holding)).toEqual(
    f.report.portfolio.holdings,
  );
  expect(p.plan!.rows.map((r) => r.reason)).toEqual([
    null,
    null,
    "missing_saved_inputs",
  ]);
  expect(p.plan!.rows.slice(0, 2).map((r) => r.entry)).toEqual(
    f.workspace.valuationAssumptions.coordinator.getSnapshot().saved!.payload
      .entries,
  );
  expect(p.plan!.rows[1]!.entry!.exit.inputs.baseRevenue).toBe(
    "unfinished 1..",
  );
  expect(p.plan!.rows[0]!.price.reference).toMatchObject({
    date: "2026-11-02",
    rawCloseUsd: "120.5",
  });
  expect(p.plan!.rows[0]!.source.response!.rows.at(-1)!.close).toBe("130");
  expect(p.plan!.rows[2]!.price.reason).toBe("price_unsupported");
  f.clock(() => "2026-11-04T12:01:00.000Z");
  const reading = f.model.evaluate(p)!.reading!;
  expect(reading.evaluatedAt).toBe("2026-11-04T12:01:00.000Z");
  expect(reading.plan.capturedAt).toBe(portfolioScenarioTime);
  expect(
    reading.rows.slice(0, 2).map((r) => r.comparison!.rows.length),
  ).toEqual([6, 6]);
  expect(reading.rows[0]!.calculation!.dcfResult).toMatchObject({
    status: "available",
    scenarios: { base: { valuePerShareUsd: "140.00" } },
  });
  expect(
    reading.rows[0]!.comparison!.rows.find(
      (r) => r.model === "dcf" && r.scenario === "base",
    )!.result,
  ).toEqual({ status: "available", differencePercent: "16.18" });
  expect(
    reading.rows[1]!.comparison!.rows.filter((r) => r.model === "exit").every(
      (r) => r.result.status === "unavailable",
    ),
  ).toBe(true);
  expect(reading.rows[2]!.calculation).toBeNull();
  expect(
    captureValuationCalculationGuard(reading.rows[0]!.calculation!),
  ).toBeNull();
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
  expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(portfolio);
  expect(f.workspace.followups.coordinator.getSnapshot()).toBe(followups);
  expect(f.fixture.watchlistSavedScenario!.getSnapshot()).toEqual(counts);
  expect(f.model.evaluate(f.model.getSnapshot())).toBeNull();
  expect(Object.isFrozen(reading.rows[0]!.calculation!.dcfDraft)).toBe(true);
});
it("pauses owned availability without changing original reading and resumes only a live lease", async () => {
  const f = await setup();
  const p = f.model.preview(f.model.getSnapshot())!;
  f.pause(true);
  expect(f.model.getSnapshot().plan).toBe(p.plan);
  expect(f.model.evaluate(f.model.getSnapshot())).toBeNull();
  f.pause(false);
  const reading = f.model.evaluate(f.model.getSnapshot())!.reading;
  f.pause(true);
  expect(f.model.getSnapshot().reading).toBe(reading);
  expect(f.model.canPreview(f.model.getSnapshot())).toBe(false);
  expect(f.model.clear(f.model.getSnapshot())).toBeNull();
  f.pause(false);
  expect(f.model.getSnapshot().reading).toBe(reading);
});
it.each([
  "lease-revoked",
  "lease-replaced",
  "collection-load",
  "collection-file",
  "editor-file",
  "session",
  "invalidate",
] as const)(
  "retires %s permanently and refuses equal-looking stale actions",
  async (kind) => {
    const f = await setup();
    const p = f.model.preview(f.model.getSnapshot())!;
    const before = f.model.evaluate(p)!;
    const token = {};
    if (kind === "lease-revoked") {
      f.revoke();
      f.restore();
    }
    if (kind === "lease-replaced") f.replace();
    if (kind === "collection-load")
      await f.workspace.valuationAssumptions.coordinator.load();
    if (kind === "collection-file") {
      f.workspace.valuationAssumptions.beginCollectionFileActivity(token);
      f.workspace.valuationAssumptions.endCollectionFileActivity(token);
    }
    if (kind === "editor-file") {
      f.workspace.valuation.beginDraftFileActivity(token);
      f.workspace.valuation.endDraftFileActivity(token);
    }
    if (kind === "session") f.workspace.sessionOwner.dispose();
    if (kind === "invalidate") f.model.invalidate();
    expect(f.model.getSnapshot().reading).toBeNull();
    expect(f.model.getSnapshot().plan).toBeNull();
    expect(f.model.evaluate(p)).toBeNull();
    expect(f.model.preview(before)).toBeNull();
  },
);
it("reads the confirmed version without changing an unrelated unsaved collection draft", async () => {
  const f = await setup(),
    c = f.workspace.valuationAssumptions.coordinator,
    saved = c.getSnapshot().saved!;
  c.replaceDraft({
    ...saved.payload,
    entries: saved.payload.entries.map((e) => ({
      ...e,
      dcf: {
        ...e.dcf,
        inputs: { ...e.dcf.inputs, startingUnleveredCashFlowUsd: "999" },
      },
    })),
  });
  const draft = c.getSnapshot().draft;
  const p = f.model.preview(f.model.getSnapshot())!;
  expect(p.plan!.rows[0]!.entry).toEqual(saved.payload.entries[0]);
  expect(c.getSnapshot().draft).toBe(draft);
  expect(c.getSnapshot().dirty).toBe(true);
});
it.each(["preview", "evaluation"] as const)(
  "refuses %s replaced by a reentrant subscriber",
  async (stage) => {
    const f = await setup();
    if (stage === "evaluation") f.model.preview(f.model.getSnapshot());
    const stop = f.model.subscribe(() => {
      if (
        stage === "preview"
          ? !!f.model.getSnapshot().plan
          : !!f.model.getSnapshot().reading
      )
        f.replace();
    });
    expect(
      stage === "preview"
        ? f.model.preview(f.model.getSnapshot())
        : f.model.evaluate(f.model.getSnapshot()),
    ).toBeNull();
    stop();
    expect(f.model.getSnapshot().plan).toBeNull();
  },
);
it("fences clock-triggered source changes and refuses invalid action dates", async () => {
  const f = await setup();
  f.clock(() => {
    f.notify();
    return portfolioScenarioTime;
  });
  expect(f.model.preview(f.model.getSnapshot())).toBeNull();
  f.clock(() => "2026-02-30T12:00:00.000Z");
  expect(f.model.preview(f.model.getSnapshot())).toBeNull();
  f.clock(() => portfolioScenarioTime);
  const p = f.model.preview(f.model.getSnapshot())!;
  f.clock(() => {
    f.replace();
    return portfolioScenarioTime;
  });
  expect(f.model.evaluate(p)).toBeNull();
});
it("refreshes handler identity on source notifications without replacing a current reading", async () => {
  const f = await setup();
  const p = f.model.preview(f.model.getSnapshot())!;
  f.notify();
  expect(f.model.getSnapshot().plan).toBe(p.plan);
  expect(f.model.evaluate(p)).toBeNull();
  expect(f.model.evaluate(f.model.getSnapshot())).not.toBeNull();
});

it("preserves an authored dirty workbench while evaluating confirmed inputs", async () => {
  const f = await setup();
  const p = f.model.preview(f.model.getSnapshot())!;
  f.workspace.valuation.activate(p.plan!.rows[0]!.selection);
  expect(
    f.workspace.valuation.setDcfField(
      "startingUnleveredCashFlowUsd",
      "dirty unfinished ..",
    ),
  ).toBe(true);
  const editor = f.workspace.valuation.getSnapshot();
  expect(editor.dirty).toBe(true);
  const result = f.model.evaluate(f.model.getSnapshot())!;
  expect(result.reading!.rows[0]!.calculation!.dcfDraft).toEqual(
    p.plan!.rows[0]!.entry!.dcf.inputs,
  );
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
});
it.each(["null-cik", "wrong-cik", "catalog", "share-class"] as const)(
  "refuses a saved entry with mismatched %s before calculation",
  async (kind) => {
    const f = await setup();
    const collection =
      f.workspace.valuationAssumptions.captureConfirmedCollection()!;
    const entry = collection.saved.payload.entries[0]!;
    const changed = {
      ...entry,
      ...(kind === "null-cik"
        ? { cik: null }
        : kind === "wrong-cik"
          ? { cik: "0000000099" }
          : kind === "catalog"
            ? { catalogSnapshotSha256: `sha256:${"f".repeat(64)}` as const }
            : { listing: { ...entry.listing, shareClassId: "WRONG" } }),
    };
    const rows = preparePortfolioSavedScenarioRows(
      f.report,
      {
        ...collection,
        saved: {
          ...collection.saved,
          payload: {
            ...collection.saved.payload,
            entries: [changed, ...collection.saved.payload.entries.slice(1)],
          },
        },
      },
      f.fixture.researchCoverage,
    );
    expect(rows[0]!.entry).toBeNull();
    expect(rows[0]!.reason).toBe("saved_identity_mismatch");
    expect(rows[1]!.entry).toEqual(collection.saved.payload.entries[1]);
  },
);
