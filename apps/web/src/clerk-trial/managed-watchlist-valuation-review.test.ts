import { afterEach, expect, it, vi } from "vitest";
import { createWatchlistValuationFixture } from "./test-watchlist-valuation-review-fixture";
import { captureValuationCalculationGuard } from "./managed-valuation-workbench";
import {
  evaluatePassiveValuationPrice,
  managedValuationPriceContextIsOwned,
} from "./managed-valuation-price";
import { ManagedWorkspace } from "./managed-workspace";
import { captureValuationFollowupContext } from "./managed-valuation-followup-context";
import { prepareValuationFollowup } from "./managed-valuation-followup";
const fixtures: Awaited<ReturnType<typeof createWatchlistValuationFixture>>[] =
  [];
async function setup() {
  const f = await createWatchlistValuationFixture();
  fixtures.push(f);
  return f;
}
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.restoreAllMocks();
});
it("evaluates confirmed inputs in chosen order, with six comparisons, partial source and independent refusals, without live authority", async () => {
  const f = await setup();
  await f.run();
  const editor = f.workspace.valuation.getSnapshot();
  expect(f.model.preview(f.model.getSnapshot())).toBeNull();
  const prepared = await f.preview();
  expect(prepared).not.toBeNull();
  const sourceCounts = f.fixture.watchlistSavedScenario!.getSnapshot();
  expect(prepared!.plan!.rows.map((r) => r.reason)).toEqual([
    null,
    null,
    "missing_saved_inputs",
  ]);
  const installed = f.model.evaluate(prepared!)!;
  expect(installed.reading!.rows).toHaveLength(3);
  const [a, c, missing] = installed.reading!.rows;
  expect(a!.calculation!.dcfResult).toMatchObject({
    status: "available",
    scenarios: { base: { valuePerShareUsd: "140.00" } },
  });
  expect(a!.comparison!.rows).toHaveLength(6);
  expect(a!.comparison!.reason).toBeNull();
  expect(c!.calculation!.exitResult.status).toBe("unavailable");
  expect(c!.comparison!.reason).toBe("price_not_loaded");
  expect(missing!.calculation).toBeNull();
  expect(captureValuationCalculationGuard(a!.calculation!)).toBeNull();
  expect(
    managedValuationPriceContextIsOwned(
      a!.comparison!,
      a!.row.selection,
      a!.calculation,
      a!.row.source.price,
    ),
  ).toBe(false);
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
  expect(f.fixture.watchlistSavedScenario!.getSnapshot()).toBe(sourceCounts);
  expect(f.model.evaluate(installed)).toBeNull();
});
it("keeps the saved reading through owned Research and Back, current edits and passive Finish with no source read or group recalculation", async () => {
  const f = await setup();
  await f.run();
  const p = await f.preview();
  const reading = f.model.evaluate(p!)!.reading;
  f.group.select(f.group.getSnapshot(), f.group.getSnapshot().rows[0]!.member);
  f.workspace.openWatchlistDailyReview(
    f.group.captureDaily(f.group.getSnapshot())!,
  );
  const entry =
    f.workspace.valuationAssumptions.coordinator.getSnapshot().saved!.payload
      .entries[0]!;
  f.workspace.valuationAssumptions.reviewSavedInputs(entry);
  expect(f.workspace.valuationAssumptions.useSavedInputs()).toBe(true);
  f.workspace.valuation.setDcfField("startingUnleveredCashFlowUsd", "110.00");
  f.workspace.valuation.calculate();
  f.workspace.note(entry.listing.listingId, "Revised independent thesis");
  f.workspace.returnFromResearch();
  expect(f.model.getSnapshot().reading).toBe(reading);
  expect(f.fixture.watchlistSavedScenario!.getSnapshot().eod).toBe(2);
  expect(f.workspace.coordinator.getSnapshot().dirty).toBe(true);
  f.group.finishDaily(f.group.getSnapshot());
  expect(f.model.getSnapshot().reading).toBe(reading);
  expect(f.model.canPreview(f.model.getSnapshot())).toBe(false);
  expect(f.model.evaluate(f.model.getSnapshot())).toBeNull();
});
it.each([
  "collection-load",
  "collection-file",
  "editor-file",
  "watchlist-file",
  "new-group",
  "foreign-route",
  "session",
] as const)(
  "retires the captured reading on %s without equal-value resurrection",
  async (kind) => {
    const f = await setup();
    const p = await f.preview();
    const previous = f.model.evaluate(p!)!;
    const marker = {};
    if (kind === "collection-load")
      await f.workspace.valuationAssumptions.coordinator.load();
    if (kind === "collection-file") {
      f.workspace.valuationAssumptions.beginCollectionFileActivity(marker);
      f.workspace.valuationAssumptions.endCollectionFileActivity(marker);
    }
    if (kind === "editor-file") {
      f.workspace.valuation.beginDraftFileActivity(marker);
      f.workspace.valuation.endDraftFileActivity(marker);
    }
    if (kind === "watchlist-file") {
      f.workspace.beginWatchlistDraftFileActivity(marker);
      f.workspace.endWatchlistDraftFileActivity(marker);
    }
    if (kind === "new-group") {
      f.group.finishDaily(f.group.getSnapshot());
      f.group.resetDaily(f.group.getSnapshot());
    }
    if (kind === "foreign-route") {
      f.workspace.setView("markets");
      f.workspace.setView("watchlist");
    }
    if (kind === "session") f.workspace.sessionOwner.dispose();
    expect(f.model.getSnapshot().reading).toBeNull();
    expect(f.model.evaluate(previous)).toBeNull();
  },
);
it("retires preview when a source pass starts and preserves the original explicit preview boundary", async () => {
  const f = await setup();
  const p = await f.preview();
  await f.run();
  expect(f.model.evaluate(p!)).toBeNull();
  expect(f.model.getSnapshot().plan).toBeNull();
});
it("refuses stale publication after a reentrant subscriber replaces the group", async () => {
  const f = await setup();
  await f.workspace.valuationAssumptions.coordinator.load();
  const unsubscribe = f.model.subscribe(() => {
    if (f.model.getSnapshot().plan) f.group.leave();
  });
  expect(f.model.preview(f.model.getSnapshot())).toBeNull();
  unsubscribe();
  expect(f.model.getSnapshot().plan).toBeNull();
});
it("does not use a staged unsaved collection entry and refuses mismatched issuer identity", async () => {
  const f = await setup();
  await f.workspace.valuationAssumptions.coordinator.load();
  const c = f.workspace.valuationAssumptions.coordinator;
  const original = c.getSnapshot().saved!;
  c.replaceDraft({
    ...original.payload,
    entries: original.payload.entries.map((e) => ({ ...e, cik: "0000000099" })),
  });
  const p = f.model.preview(f.model.getSnapshot())!;
  expect(p.plan!.rows[0]!.entry!.cik).toBe("0000000001");
  expect(c.getSnapshot().dirty).toBe(true);
  const foreign = {
    ...original,
    payload: {
      ...original.payload,
      entries: original.payload.entries.map((entry, i) =>
        i === 0 ? { ...entry, cik: "0000000099" } : entry,
      ),
    },
  };
  vi.spyOn(f.fixture.api, "loadValuationAssumptions").mockResolvedValue(
    foreign,
  );
  await c.load();
  expect(f.model.preview(f.model.getSnapshot())).toBeNull();
  c.useSaved();
  expect(f.model.preview(f.model.getSnapshot())!.plan!.rows[0]!.reason).toBe(
    "saved_identity_mismatch",
  );
});
it("saves a revised collection separately and fresh Load does not persist the transient reading", async () => {
  const f = await setup();
  await f.preview();
  f.group.select(f.group.getSnapshot(), f.group.getSnapshot().rows[0]!.member);
  f.workspace.openWatchlistDailyReview(
    f.group.captureDaily(f.group.getSnapshot())!,
  );
  const a = f.workspace.valuationAssumptions;
  a.reviewSavedInputs(a.coordinator.getSnapshot().saved!.payload.entries[0]!);
  a.useSavedInputs();
  f.workspace.valuation.setDcfField("startingUnleveredCashFlowUsd", "110.00");
  await a.prepareStage();
  expect(a.stageCurrent()).toBe(true);
  await a.coordinator.save();
  expect(f.fixture.watchlistSavedScenario!.getSnapshot()).toMatchObject({
    valuationSave: 1,
    save: 0,
    eod: 0,
  });
  const fresh = new ManagedWorkspace(
    f.fixture.api,
    f.fixture.followups!.nextSession(),
    undefined,
    f.options,
  );
  try {
    await fresh.refreshCatalog();
    await fresh.valuationAssumptions.coordinator.load();
    expect(
      fresh.valuationAssumptions.coordinator.getSnapshot().saved!.payload
        .entries[0]!.dcf.inputs.startingUnleveredCashFlowUsd,
    ).toBe("110.00");
    expect(fresh.watchlistValuationReview.getSnapshot().reading).toBeNull();
  } finally {
    fresh.sessionOwner.dispose();
  }
});

it.each(["catalog", "share-class"] as const)(
  "refuses saved %s mismatch while retaining other exact listings",
  async (kind) => {
    const f = await setup();
    const original = f.fixture.watchlistSavedScenario!.saved().valuations;
    const saved = {
      ...original,
      payload: {
        ...original.payload,
        entries: original.payload.entries.map((entry, i) =>
          i !== 0
            ? entry
            : kind === "catalog"
              ? {
                  ...entry,
                  catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const,
                }
              : {
                  ...entry,
                  listing: { ...entry.listing, shareClassId: "foreign-class" },
                },
        ),
      },
    };
    vi.spyOn(f.fixture.api, "loadValuationAssumptions").mockResolvedValue(
      saved,
    );
    const p = await f.preview();
    expect(p!.plan!.rows.map((r) => r.reason)).toEqual([
      "saved_identity_mismatch",
      null,
      "missing_saved_inputs",
    ]);
  },
);
it("retires group evaluation on catalog replacement, even when the old catalog returns", async () => {
  const f = await setup();
  const p = await f.preview();
  const original = f.workspace.getSnapshot().snapshot!;
  vi.spyOn(f.fixture.api, "status")
    .mockResolvedValueOnce({
      snapshot: { ...original, snapshotSha256: `sha256:${"b".repeat(64)}` },
    })
    .mockResolvedValueOnce({ snapshot: original });
  await f.workspace.refreshCatalog();
  await f.workspace.refreshCatalog();
  expect(f.model.evaluate(p!)).toBeNull();
  expect(f.model.getSnapshot().plan).toBeNull();
});
it("keeps failed-refresh provenance and refuses an invalid latest raw close without older fallback", async () => {
  const f = await setup();
  await f.run();
  const p = await f.preview();
  const reading = f.model.evaluate(p!)!.reading!,
    row = reading.rows[0]!;
  const price = row.row.source.price!;
  const failed = {
    ...price,
    error: true,
    showingPrevious: true,
    message: "Refresh failed; previous response retained",
  };
  const retained = evaluatePassiveValuationPrice(
    row.row.selection,
    row.calculation!,
    failed,
  );
  expect(retained.reference).toMatchObject({
    showingPrevious: true,
    response: price.response,
  });
  expect(retained.reference!.response.requestStartedAt).toBe(
    price.response!.requestStartedAt,
  );
  const response = {
    ...price.response!,
    rows: price.response!.rows.map((r, i) =>
      i === price.response!.rows.length - 1
        ? { ...r, close: "invalid latest" }
        : r,
    ),
  };
  const invalid = evaluatePassiveValuationPrice(
    row.row.selection,
    row.calculation!,
    { ...price, response },
  );
  expect(invalid.reference).toBeNull();
  expect(invalid.reason).toBe("price_invalid");
  expect(invalid.rows.every((r) => r.result.status === "unavailable")).toBe(
    true,
  );
  expect(
    managedValuationPriceContextIsOwned(
      retained,
      row.row.selection,
      row.calculation,
      failed,
    ),
  ).toBe(false);
});
it("does not return a committed evaluation after its subscriber retires the group", async () => {
  const f = await setup();
  const p = await f.preview();
  const unsubscribe = f.model.subscribe(() => {
    if (f.model.getSnapshot().reading) f.group.leave();
  });
  expect(f.model.evaluate(p!)).toBeNull();
  unsubscribe();
  expect(f.model.getSnapshot().reading).toBeNull();
});

it("keeps all three saves independent and fresh Loads exclude the later unsaved Class C draft", async () => {
  const f = await setup();
  await f.run();
  const p = await f.preview();
  const reading = f.model.evaluate(p!)!.reading;
  f.group.select(f.group.getSnapshot(), f.group.getSnapshot().rows[0]!.member);
  f.workspace.openWatchlistDailyReview(
    f.group.captureDaily(f.group.getSnapshot())!,
  );
  const a = f.workspace.valuationAssumptions;
  a.reviewSavedInputs(a.coordinator.getSnapshot().saved!.payload.entries[0]!);
  expect(a.useSavedInputs()).toBe(true);
  f.workspace.valuation.setDcfField("startingUnleveredCashFlowUsd", "110.00");
  f.workspace.valuation.calculate();
  await f.workspace.followups.coordinator.load();
  const selection = f.workspace.getSnapshot().research!.selection;
  const captured = captureValuationFollowupContext(
    f.workspace,
    selection,
    () => f.workspace.getSnapshot().research?.selection === selection,
  );
  expect(captured.reason).toBeNull();
  const check = prepareValuationFollowup(
    captured.port!,
    {
      model: "dcf",
      scenario: "base",
      question: "Review the Class A assumptions after the dated close.",
      dueOn: "2026-12-31",
    },
    () => true,
  ).preview!.create();
  expect(check).not.toBeNull();
  f.workspace.note(selection.listing.listingId, "Revised Class A thesis");
  f.workspace.returnFromResearch();
  f.group.finishDaily(f.group.getSnapshot());
  expect(f.model.getSnapshot().reading).toBe(reading);
  f.workspace.openWatchlistAnnual(
    f.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
  );
  await a.prepareStage();
  expect(a.stageCurrent()).toBe(true);
  await a.coordinator.save();
  expect(f.fixture.watchlistSavedScenario!.getSnapshot()).toMatchObject({
    valuationSave: 1,
    save: 0,
    eod: 2,
  });
  expect(f.fixture.followups!.getSnapshot().commits).toBe(0);
  f.workspace.returnFromResearch();
  await f.workspace.coordinator.save();
  expect(f.fixture.followups!.getSnapshot().commits).toBe(0);
  const classC = f.workspace.coordinator.getSnapshot().draft!.memberships[1]!;
  f.workspace.note(classC.listingId, "Deliberately unsaved Class C draft");
  await f.workspace.followups.coordinator.save();
  const fresh = new ManagedWorkspace(
    f.fixture.api,
    f.fixture.followups!.nextSession(),
    undefined,
    f.options,
  );
  try {
    await fresh.refreshCatalog();
    expect(fresh.coordinator.getSnapshot().draft).toBeNull();
    expect(
      fresh.valuationAssumptions.coordinator.getSnapshot().draft,
    ).toBeNull();
    expect(fresh.followups.coordinator.getSnapshot().draft).toBeNull();
    await fresh.coordinator.load();
    await fresh.valuationAssumptions.coordinator.load();
    await fresh.followups.coordinator.load();
    expect(fresh.coordinator.getSnapshot().draft!.memberships[0]!.note).toBe(
      "Revised Class A thesis",
    );
    expect(
      fresh.coordinator.getSnapshot().draft!.memberships[1]!.note,
    ).not.toBe("Deliberately unsaved Class C draft");
    expect(
      fresh.valuationAssumptions.coordinator.getSnapshot().saved!.payload
        .entries[0]!.dcf.inputs.startingUnleveredCashFlowUsd,
    ).toBe("110.00");
    expect(
      fresh.followups.coordinator.getSnapshot().draft!.entries,
    ).toContainEqual(check);
    expect(fresh.watchlistValuationReview.getSnapshot().reading).toBeNull();
    expect(fresh.valuation.getSnapshot().calculation).toBeNull();
    expect(f.fixture.watchlistSavedScenario!.getSnapshot().eod).toBe(2);
  } finally {
    fresh.sessionOwner.dispose();
  }
});
