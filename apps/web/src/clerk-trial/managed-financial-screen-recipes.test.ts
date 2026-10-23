import { afterEach, describe, expect, it, vi } from "vitest";
import type { ManagedEodIdentity } from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import type { ManagedFinancialScreenRecipeDeliveryAdapter } from "./financial-screen-recipe-delivery";
import type { TextDocumentDeliveryResult } from "./document-delivery";
import { ManagedFinancialScreen } from "./managed-financial-screen";
import { ManagedFinancialScreenRecipes } from "./managed-financial-screen-recipes";
import {
  formatManagedFinancialScreenRecipe,
  parseManagedFinancialScreenRecipe,
} from "./managed-financial-screen-recipe";
import { DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA } from "./managed-financial-screen-results";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { eodSelection } from "./eod-history-fixture";
const first = eodSelection.listing;
const second: ManagedEodIdentity = {
  ...first,
  listingId: "listing-one",
  issuerId: "issuer-one",
  securityId: "security-one",
  shareClassId: "class-one",
  issuerName: "One Company",
  symbol: "ONE",
};
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function fixture(
  covered: readonly ManagedEodIdentity[] = [first, second],
) {
  const resolve = vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
    Promise.resolve({
      snapshotSha256: request.snapshotSha256,
      results: request.listingIds.map((listingId) => ({
        listingId,
        listing:
          [first, second].find((item) => item.listingId === listingId) ?? null,
      })),
    }),
  );
  const annualReport = vi.fn<ManagedApi["annualReport"]>();
  const model = new ManagedFinancialScreen(
    { resolve, annualReport },
    vi.fn(),
    undefined,
    {
      listingIds: [first.listingId, second.listingId],
      coverage: createManagedResearchCoverageFixture(
        covered.map((listing, index) => ({
          listing,
          cik: String(index + 1).padStart(10, "0"),
        })),
      ),
    },
  );
  model.reconcile(eodSelection.catalogSnapshotSha256, true, true);
  await model.loadUniverse(model.getSnapshot());
  const route = { active: true };
  const deliver = vi
    .fn<ManagedFinancialScreenRecipeDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  const recipes = new ManagedFinancialScreenRecipes({
    model,
    delivery: { deliver },
    routeActive: () => route.active,
    now: () => "2026-10-23T00:00:00.000Z",
  });
  const unsubscribe = recipes.subscribe(() => {});
  cleanups.push(() => {
    unsubscribe();
    model.retire();
  });
  recipes.setName("Exact Annual criteria");
  return { model, resolve, annualReport, recipes, route, deliver, unsubscribe };
}
function document(listings: readonly ManagedEodIdentity[] = [second, first]) {
  const result = formatManagedFinancialScreenRecipe({
    name: "Imported definition",
    capturedAt: "2026-10-20T12:00:00.000Z",
    catalogSnapshotSha256: "sha256:" + "c".repeat(64),
    criteria: {
      clauses: [
        { field: "operatingCashFlow", operator: "gte", value: "10.00" },
      ],
      sort: { field: "operatingCashFlow", direction: "desc" },
    },
    listings,
  });
  if (!result) throw new Error("Expected invented recipe");
  return result;
}
function file(text = document().text) {
  const bytes = new TextEncoder().encode(text).buffer;
  return {
    size: bytes.byteLength,
    arrayBuffer: vi.fn(() => Promise.resolve(bytes)),
  };
}
async function review(
  f: Awaited<ReturnType<typeof fixture>>,
  listings: readonly ManagedEodIdentity[] = [second, first],
) {
  await f.recipes.readFile(
    file(document(listings).text),
    f.recipes.chooseFile(),
  );
  const result = f.recipes.getSnapshot().review;
  if (!result) throw new Error("Expected complete recipe review");
  return result;
}
describe("screen recipe transient IO and definition-only application", () => {
  it("captures only exact applied criteria and selected order without reading or changing the model", async () => {
    const f = await fixture();
    const before = f.model.getSnapshot();
    await f.recipes.capture();
    expect(f.deliver).toHaveBeenCalledOnce();
    const [saved, context] = f.deliver.mock.calls[0]!;
    const content = parseManagedFinancialScreenRecipe(saved.text)!;
    expect(
      content.listings.map((item: ManagedEodIdentity) => item.listingId),
    ).toEqual(before.selected.map((item) => item.listing.listingId));
    expect(content.criteria).toEqual(before.criteria);
    expect(Object.keys(content)).toEqual([
      "format",
      "version",
      "name",
      "capturedAt",
      "catalogSnapshotSha256",
      "criteria",
      "listings",
    ]);
    expect(f.model.getSnapshot()).toBe(before);
    expect(f.annualReport).not.toHaveBeenCalled();
    expect(f.resolve).toHaveBeenCalledOnce();
    expect(context.signal.aborted).toBe(true);
  });
  it("reviews complete old/current identities and atomically applies current metadata in saved order without Run", async () => {
    const f = await fixture();
    const changed = {
      ...second,
      symbol: "OLD",
      issuerName: "Previous One Company",
    };
    const preview = await review(f, [changed, first]);
    const before = f.model.getSnapshot();
    expect(preview.rows[0]!.status).toBe("metadata_changed");
    expect(preview.rows[0]!.previous).toEqual(changed);
    expect(preview.rows[0]!.current!.listing).toEqual(second);
    expect(preview.file.catalogSnapshotSha256).not.toBe(
      before.catalogSnapshotSha256,
    );
    expect(f.recipes.apply(preview)).toBe(true);
    const next = f.model.getSnapshot();
    expect(next.selected.map((member) => member.listing)).toEqual([
      second,
      first,
    ]);
    expect(next.criteria.clauses[0]!.value).toBe("10.00");
    expect(next.criteria.sort).toEqual({
      field: "operatingCashFlow",
      direction: "desc",
    });
    expect(next.criteriaRevision).not.toBe(before.criteriaRevision);
    expect(next.selectionRevision).not.toBe(before.selectionRevision);
    expect(next.run).toBeNull();
    expect(f.recipes.apply(preview)).toBe(false);
    expect(f.annualReport).not.toHaveBeenCalled();
    expect(f.resolve).toHaveBeenCalledOnce();
  });
  it("refuses the whole application for stable-identity changes, missing listings or current coverage loss", async () => {
    for (const [listing, status] of [
      [{ ...second, shareClassId: "class-rebound" }, "identity_changed"],
      [{ ...second, listingId: "listing-missing" }, "missing"],
    ] as const) {
      const f = await fixture();
      const before = f.model.getSnapshot();
      const preview = await review(f, [listing]);
      expect(preview.rows[0]!.status).toBe(status);
      expect(f.recipes.apply(preview)).toBe(false);
      expect(f.model.getSnapshot()).toBe(before);
    }
    const f = await fixture([first]);
    const before = f.model.getSnapshot();
    const preview = await review(f);
    expect(preview.rows[0]!.status).toBe("uncovered");
    expect(f.recipes.apply(preview)).toBe(false);
    expect(f.model.getSnapshot()).toBe(before);
  });
  it("preserves staged invalid criteria and blocks capture, picker and old Apply", async () => {
    const f = await fixture();
    const preview = await review(f);
    f.model.stageCriteria(f.model.getSnapshot());
    const staged = f.model.getSnapshot();
    f.model.setCriteria(staged, {
      clauses: [{ field: "operatingCashFlow", operator: "gte", value: "1e" }],
      sort: { field: "symbol", direction: "asc" },
    });
    expect(f.recipes.chooseFile()).toBeNull();
    await f.recipes.capture();
    expect(f.recipes.apply(preview)).toBe(false);
    expect(f.model.getSnapshot()).toBe(staged);
    expect(staged.criteriaStaged).toBe(true);
    expect(f.deliver).not.toHaveBeenCalled();
  });
  it("bounds reads before arrayBuffer and refuses bad bytes, BOM and size mismatch", async () => {
    const f = await fixture();
    for (const size of [0, 65537, 1.5]) {
      const arrayBuffer = vi.fn();
      await f.recipes.readFile({ size, arrayBuffer }, f.recipes.chooseFile());
      expect(arrayBuffer).not.toHaveBeenCalled();
    }
    for (const selected of [
      {
        size: 2,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xff]).buffer),
      },
      { size: 2, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) },
      file("\ufeff" + document().text),
    ]) {
      await f.recipes.readFile(selected, f.recipes.chooseFile());
      expect(f.recipes.getSnapshot().review).toBeNull();
    }
    expect(f.annualReport).not.toHaveBeenCalled();
  });
  it("fences cancelled reads and name edits restored to the same text", async () => {
    for (const change of ["cancel", "name"]) {
      const f = await fixture();
      const bytes = deferred<ArrayBuffer>();
      const reading = f.recipes.readFile(
        { size: file().size, arrayBuffer: () => bytes.promise },
        f.recipes.chooseFile(),
      );
      if (change === "cancel") f.recipes.cancel();
      else {
        f.recipes.setName("Different");
        f.recipes.setName("Exact Annual criteria");
      }
      bytes.resolve(await file().arrayBuffer());
      await reading;
      expect(f.recipes.getSnapshot().review).toBeNull();
    }
  });
  it("invalidates reads and reviews on selection, criteria, route, catalog, access and retirement", async () => {
    const changes = [
      (f: Awaited<ReturnType<typeof fixture>>) =>
        f.model.select(
          f.model.getSnapshot(),
          f.model.getSnapshot().selected[0]!,
          false,
        ),
      (f: Awaited<ReturnType<typeof fixture>>) =>
        f.model.setCriteria(
          f.model.getSnapshot(),
          DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA,
        ),
      (f: Awaited<ReturnType<typeof fixture>>) => {
        f.route.active = false;
        f.recipes.reconcile();
        f.route.active = true;
      },
      (f: Awaited<ReturnType<typeof fixture>>) =>
        f.model.reconcile(`sha256:${"b".repeat(64)}`, true, true),
      (f: Awaited<ReturnType<typeof fixture>>) =>
        f.model.reconcile(eodSelection.catalogSnapshotSha256, true, false),
      (f: Awaited<ReturnType<typeof fixture>>) => f.model.retire(),
    ];
    for (const change of changes) {
      const f = await fixture();
      const preview = await review(f);
      change(f);
      expect(f.recipes.apply(preview)).toBe(false);
      expect(f.recipes.getSnapshot().review).toBeNull();
      expect(f.annualReport).not.toHaveBeenCalled();
    }
  });
  it("cancels native delivery on definition changes and ignores late completion", async () => {
    const f = await fixture();
    const pending = deferred<TextDocumentDeliveryResult>();
    f.deliver.mockReturnValueOnce(pending.promise);
    const saving = f.recipes.capture();
    const context = f.deliver.mock.calls[0]![1];
    f.model.stageCriteria(f.model.getSnapshot());
    expect(context.signal.aborted).toBe(true);
    expect(context.isCurrent()).toBe(false);
    const notice = f.recipes.getSnapshot().message;
    pending.resolve("written");
    await saving;
    expect(f.recipes.getSnapshot().message).toBe(notice);
  });
  it("consumes a review before listeners, rejects stale controls and fences unmounted work", async () => {
    const f = await fixture();
    const old = f.recipes.getSnapshot();
    f.recipes.setName("Updated");
    await f.recipes.capture(old);
    expect(f.deliver).not.toHaveBeenCalled();
    const preview = await review(f);
    let reentered = false;
    const unsubscribe = f.recipes.subscribe(() => {
      if (!f.recipes.getSnapshot().review) reentered = f.recipes.apply(preview);
    });
    expect(f.recipes.apply(preview)).toBe(true);
    expect(reentered).toBe(false);
    unsubscribe();
    f.unsubscribe();
    await f.recipes.capture();
    expect(f.deliver).not.toHaveBeenCalled();
  });
});

it("keeps only the latest file selection and aborts pending read or delivery when unmounted", async () => {
  const f = await fixture();
  const old = f.recipes.chooseFile(),
    current = f.recipes.chooseFile();
  const ignored = file();
  await f.recipes.readFile(ignored, old);
  expect(ignored.arrayBuffer).not.toHaveBeenCalled();
  const bytes = deferred<ArrayBuffer>();
  const reading = f.recipes.readFile(
    { size: file().size, arrayBuffer: () => bytes.promise },
    current,
  );
  f.unsubscribe();
  bytes.resolve(await file().arrayBuffer());
  await reading;
  expect(f.recipes.getSnapshot().review).toBeNull();
  const next = await fixture(),
    result = deferred<TextDocumentDeliveryResult>();
  next.deliver.mockReturnValueOnce(result.promise);
  const saving = next.recipes.capture(),
    context = next.deliver.mock.calls[0]![1];
  next.unsubscribe();
  expect(context.signal.aborted).toBe(true);
  result.resolve("written");
  await saving;
  expect(next.recipes.getSnapshot().message).toBe("");
});
it("blocks a pending run and does not revive a reviewed file after Run and Cancel", async () => {
  const f = await fixture();
  const preview = await review(f);
  const response = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
  f.annualReport.mockReturnValueOnce(response.promise);
  const running = f.model.run(f.model.getSnapshot());
  expect(f.recipes.getSnapshot().review).toBeNull();
  expect(f.recipes.getSnapshot().canCapture).toBe(false);
  expect(f.recipes.chooseFile()).toBeNull();
  expect(f.recipes.apply(preview)).toBe(false);
  await vi.waitFor(() => expect(f.annualReport).toHaveBeenCalledOnce());
  f.model.cancel();
  await running;
  expect(f.recipes.apply(preview)).toBe(false);
  expect(f.annualReport).toHaveBeenCalledOnce();
});
