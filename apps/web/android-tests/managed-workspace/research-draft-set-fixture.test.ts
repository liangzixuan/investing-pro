import { describe, expect, it } from "vitest";
import { createFixture, savedValuationInputs } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { ManagedResearchDraftSetRecovery } from "../../src/clerk-trial/managed-research-draft-set-recovery";
import { parseManagedResearchDraftSetFile } from "../../src/clerk-trial/managed-research-draft-set-file";
const signal = () => new AbortController().signal;
const scope = `sha256:${"c".repeat(64)}`;
const key = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
async function fixture() {
  return createFixture("research-draft-set");
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function load(f: Fixture) {
  await f.api.load(signal());
  await f.api.status(signal());
  await f.api.resolve(
    {
      snapshotSha256: f.researchCoverage.catalogSnapshotSha256,
      listingIds: f.marketsCohort.map((row) => row.listingId),
    },
    signal(),
  );
  await Promise.all([
    f.api.loadPortfolio(signal()),
    f.api.loadFollowups(signal()),
    f.api.loadValuationAssumptions(signal()),
  ]);
}
async function review(f: Fixture) {
  await f.api.resolve(
    {
      snapshotSha256: f.researchCoverage.catalogSnapshotSha256,
      listingIds: f.researchCoverage.listings
        .slice(0, 2)
        .map((row) => row.listing.listingId),
    },
    signal(),
  );
}
describe("invented draft-set native transport", () => {
  it("preserves all raw resource fields/order and exact independent saved bases through separate Saves", async () => {
    const f = await fixture(),
      c = f.researchDraftSet!;
    await load(f);
    c.nextSession();
    await load(f);
    expect(c.saved().portfolio.version).toBe(7);
    expect(c.saved().valuation.version).toBe(9);
    expect(c.data.captured.portfolio.transactions.map((row) => row.id)).toEqual(
      ["invented-buy-zero", "invented-buy-one"],
    );
    await review(f);
    await f.api.savePortfolio(
      {
        expectedVersion: 7,
        idempotencyKey: key,
        payload: c.data.reviewed.portfolio,
      },
      signal(),
    );
    await review(f);
    await f.api.saveValuationAssumptions(
      {
        expectedVersion: 9,
        idempotencyKey: key,
        payload: c.data.reviewed.valuation,
      },
      signal(),
    );
    c.nextSession();
    await load(f);
    expect(c.saved()).toEqual({
      watchlist: { version: 5, payload: c.data.newer.watchlist },
      portfolio: { version: 8, payload: c.data.reviewed.portfolio },
      followups: { version: 11, payload: c.data.newer.followups },
      valuation: { version: 10, payload: c.data.reviewed.valuation },
    });
    expect(c.getSnapshot()).toMatchObject({
      session: 2,
      watchLoad: 3,
      portfolioLoad: 3,
      followupsLoad: 3,
      valuationLoad: 3,
      portfolioSave: 1,
      valuationSave: 1,
      portfolioReview: 1,
      valuationReview: 1,
      rejected: 0,
    });
  });
  it.each([
    "old-base",
    "reordered",
    "changed-decimal",
    "unreviewed",
    "extra-field",
  ])("refuses %s without committing a partial ledger", async (kind) => {
    const f = await fixture(),
      c = f.researchDraftSet!;
    await load(f);
    c.nextSession();
    await load(f);
    if (kind !== "unreviewed") await review(f);
    let payload = structuredClone(c.data.reviewed.portfolio);
    if (kind === "reordered")
      payload = {
        ...payload,
        transactions: [...payload.transactions].reverse(),
      };
    if (kind === "changed-decimal")
      payload = {
        ...payload,
        opening: { ...payload.opening, cashUsd: "1000" },
      };
    const command = {
      expectedVersion: kind === "old-base" ? 3 : 7,
      idempotencyKey: key,
      payload,
      ...(kind === "extra-field" ? { extra: true } : {}),
    };
    expect(() => f.api.savePortfolio(command, signal())).toThrow(
      "Unexpected invented",
    );
    expect(c.saved().portfolio).toEqual({
      version: 7,
      payload: c.data.newer.portfolio,
    });
  });
  it("rejects source/unrelated writes/extra or cancelled reads", async () => {
    const f = await fixture();
    await load(f);
    expect(() => f.api.loadPortfolio(signal())).toThrow("Unexpected invented");
    expect(() => f.api.save({} as never, signal())).toThrow(
      "Unexpected invented",
    );
    expect(() => f.api.saveFollowups({} as never, signal())).toThrow(
      "Unexpected invented",
    );
    expect(() => f.api.annualReport({} as never, signal())).toThrow(
      "Unexpected invented",
    );
    const cancelled = new AbortController();
    cancelled.abort();
    expect(() => f.api.loadValuationAssumptions(cancelled.signal)).toThrow(
      "Unexpected invented",
    );
    expect(f.researchDraftSet!.getSnapshot()).toMatchObject({
      portfolioSave: 0,
      valuationSave: 0,
    });
  });
});
it("uses the actual current draft-set controller over all four native resource ports and restores independently", async () => {
  const f = await fixture(),
    c = f.researchDraftSet!;
  let session = f.session,
    text = "";
  async function mount() {
    const w = new ManagedWorkspace(f.api, session, undefined, {
      researchCoverage: f.researchCoverage,
      marketsCohort: f.marketsCohort,
      priceCoverage: f.priceCoverage,
    });
    await w.coordinator.load();
    await w.refreshCatalog();
    w.openWatchlistAnnual(w.coordinator.getSnapshot().draft!.memberships[0]!);
    await w.setCompanyRoute({
      kind: "company",
      listingId: "listing-zero",
      section: "annual",
    });
    await Promise.all([
      w.portfolio.coordinator.load(),
      w.followups.coordinator.load(),
      w.valuationAssumptions.coordinator.load(),
    ]);
    const current = w.valuation.getSnapshot(),
      context = current.context!;
    expect(
      w.valuation.restoreDraftInputs(
        {
          ...savedValuationInputs!,
          listing: context.listing,
          cik: context.cik,
          catalogSnapshotSha256: context.catalogSnapshotSha256,
        },
        current,
      ),
    ).toBe(true);
    expect(w.valuation.calculate()).not.toBeNull();
    const recovery = new ManagedResearchDraftSetRecovery({
      workspace: w,
      accountScope: Promise.resolve(scope),
      delivery: {
        deliver: (document) => {
          text = document.text;
          return Promise.resolve("written" as const);
        },
      },
      routeActive: () => true,
      now: () => "2026-10-30T03:00:00.000Z",
    });
    await Promise.resolve();
    return {
      w,
      recovery,
      close() {
        recovery.dispose();
        w.sessionOwner.dispose();
      },
    };
  }
  const first = await mount();
  first.w.coordinator.replaceDraft(c.data.captured.watchlist);
  first.w.portfolio.coordinator.replaceDraft({
    ledger: c.data.captured.portfolio,
  });
  first.w.followups.coordinator.replaceDraft(c.data.captured.followups);
  first.w.valuationAssumptions.coordinator.replaceDraft(
    c.data.captured.valuation,
  );
  for (const k of ["watchlist", "portfolio", "followups", "valuation"] as const)
    expect(first.recovery.selectResource(k, true)).toBe(true);
  expect(first.recovery.captureDrafts()).toBe(true);
  await first.recovery.saveFile();
  const admitted = parseManagedResearchDraftSetFile(text, scope);
  expect(admitted?.omitted).toEqual([]);
  expect(admitted?.members.portfolio?.draft).toEqual(c.data.captured.portfolio);
  first.close();
  session = c.nextSession();
  const second = await mount();
  second.w.coordinator.replaceDraft(c.data.independentWatchlist);
  second.w.followups.coordinator.replaceDraft(c.data.newer.followups);
  expect(second.recovery.selectResource("followups", true)).toBe(true);
  expect(second.recovery.captureDrafts()).toBe(true);
  expect(second.recovery.getSnapshot().file?.omitted).toEqual([
    "watchlist",
    "portfolio",
    "valuation",
  ]);
  second.recovery.cancel();
  const bytes = new TextEncoder().encode(text);
  await second.recovery.readFile({
    size: bytes.length,
    arrayBuffer: () => Promise.resolve(bytes.buffer),
  });
  expect(second.recovery.getSnapshot().phase).toBe("inventory");
  const watch = second.w.coordinator.getSnapshot(),
    follow = second.w.followups.coordinator.getSnapshot(),
    valuation = second.w.valuationAssumptions.coordinator.getSnapshot(),
    editor = second.w.valuation.getSnapshot();
  expect(second.recovery.compareResource("portfolio")).toBe(true);
  expect(second.recovery.getSnapshot().comparison?.currentBase).toBe(7);
  second.recovery.cancelComparison();
  expect(second.w.portfolio.coordinator.getSnapshot().baseVersion).toBe(7);
  expect(second.recovery.compareResource("portfolio")).toBe(true);
  expect(second.recovery.restoreResource()).toBe(true);
  expect(second.w.coordinator.getSnapshot()).toBe(watch);
  expect(second.w.followups.coordinator.getSnapshot()).toBe(follow);
  expect(second.w.valuationAssumptions.coordinator.getSnapshot()).toBe(
    valuation,
  );
  expect(second.w.valuation.getSnapshot()).toBe(editor);
  expect(second.w.portfolio.coordinator.getSnapshot()).toMatchObject({
    baseVersion: 7,
    draft: { ledger: c.data.captured.portfolio },
    dirty: true,
  });
  await second.w.portfolio.reviewCatalog();
  second.w.portfolio.applyReview();
  expect(second.w.portfolio.coordinator.getSnapshot().draft?.ledger).toEqual(
    c.data.reviewed.portfolio,
  );
  expect(second.w.portfolio.canSavePayload()).toBe(true);
  await second.w.portfolio.coordinator.save();
  const portfolio = second.w.portfolio.coordinator.getSnapshot();
  expect(portfolio.saved?.version).toBe(8);
  expect(second.recovery.compareResource("valuation")).toBe(true);
  expect(second.recovery.getSnapshot().comparison?.currentBase).toBe(9);
  expect(second.recovery.restoreResource()).toBe(true);
  expect(second.w.portfolio.coordinator.getSnapshot()).toBe(portfolio);
  expect(second.w.coordinator.getSnapshot()).toBe(watch);
  expect(second.w.followups.coordinator.getSnapshot()).toBe(follow);
  expect(second.w.valuation.getSnapshot()).toBe(editor);
  await second.w.valuationAssumptions.reviewCatalog();
  expect(second.w.valuationAssumptions.applyCatalogReview()).toBe(true);
  await second.w.valuationAssumptions.coordinator.save();
  expect(second.w.valuation.getSnapshot()).toBe(editor);
  second.close();
  session = c.nextSession();
  const third = await mount();
  expect(third.w.portfolio.coordinator.getSnapshot().draft?.ledger).toEqual(
    c.data.reviewed.portfolio,
  );
  expect(third.w.valuationAssumptions.coordinator.getSnapshot().draft).toEqual(
    c.data.reviewed.valuation,
  );
  expect(c.getSnapshot().rejected).toBe(0);
  third.close();
});

it("admits reordered object keys without changing valuation fields or entry order", async () => {
  const f = await fixture(),
    c = f.researchDraftSet!;
  await load(f);
  c.nextSession();
  await load(f);
  await review(f);
  await f.api.savePortfolio(
    {
      expectedVersion: 7,
      idempotencyKey: key,
      payload: c.data.reviewed.portfolio,
    },
    signal(),
  );
  await review(f);
  function reorder(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(reorder);
    if (value !== null && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .reverse()
          .map(([k, v]) => [k, reorder(v)]),
      );
    return value;
  }
  const payload = reorder(
    c.data.reviewed.valuation,
  ) as typeof c.data.reviewed.valuation;
  expect(JSON.stringify(payload)).not.toBe(
    JSON.stringify(c.data.reviewed.valuation),
  );
  await f.api.saveValuationAssumptions(
    { expectedVersion: 9, idempotencyKey: key, payload },
    signal(),
  );
  expect(c.saved().valuation).toEqual({
    version: 10,
    payload: c.data.reviewed.valuation,
  });
  expect(c.getSnapshot().rejected).toBe(0);
});
