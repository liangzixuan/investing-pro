import { registerPlugin } from "@capacitor/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { InvestmentFinancialScreenRecipePlugin } from "../../src/clerk-trial/financial-screen-recipe-delivery";
import { formatManagedFinancialScreenRecipe } from "../../src/clerk-trial/managed-financial-screen-recipe";
import { ManagedFinancialScreenRecipes } from "../../src/clerk-trial/managed-financial-screen-recipes";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { eodSelection } from "../../src/clerk-trial/eod-history-fixture";
import {
  createNativeFinancialScreenRecipeFixture,
  createNativeFinancialScreenRecipeSession,
} from "./native-financial-screen-recipe-fixture";
import { createFixture } from "./fixture";

vi.mock("@capacitor/core", () => ({ registerPlugin: vi.fn() }));
const TIME = "2026-10-23T02:03:04.567Z";
const HANDLE = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
function nativeFixture() {
  const plugin: InvestmentFinancialScreenRecipePlugin = {
    choose: vi
      .fn<InvestmentFinancialScreenRecipePlugin["choose"]>()
      .mockResolvedValue({ status: "chosen", handle: HANDLE }),
    write: vi
      .fn<InvestmentFinancialScreenRecipePlugin["write"]>()
      .mockResolvedValue({ status: "written" }),
    cancel: vi
      .fn<InvestmentFinancialScreenRecipePlugin["cancel"]>()
      .mockResolvedValue(),
  };
  return { plugin, native: createNativeFinancialScreenRecipeFixture(plugin) };
}
function document() {
  return formatManagedFinancialScreenRecipe({
    name: "Invented screen recipe",
    capturedAt: TIME,
    catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
    criteria: {
      clauses: [
        { field: "operatingCashFlow", operator: "gte", value: "0.000" },
      ],
      sort: { field: "symbol", direction: "asc" },
    },
    listings: [eodSelection.listing],
  })!;
}
function context() {
  return { signal: new AbortController().signal, isCurrent: () => true };
}

describe("invented native screen recipe fixture", () => {
  it("binds only an explicitly selected fixture capability without registering or operating a plugin", () => {
    vi.mocked(registerPlugin).mockReset();
    const absent = createNativeFinancialScreenRecipeSession(null);
    expect(absent.routerProps).toEqual({});
    expect(renderToStaticMarkup(<absent.Controls />)).toBe("");
    const fixture = nativeFixture();
    const selected = createNativeFinancialScreenRecipeSession(fixture.native);
    expect(selected.routerProps).toEqual({
      financialScreenRecipeDelivery: fixture.native.delivery,
    });
    expect(selected.Controls).toBe(fixture.native.Controls);
    expect(registerPlugin).not.toHaveBeenCalled();
    expect(fixture.plugin.choose).not.toHaveBeenCalled();
    expect(fixture.plugin.write).not.toHaveBeenCalled();
  });

  it("registers the fixed real plugin and exposes idle metadata without an operation", () => {
    const f = nativeFixture();
    vi.mocked(registerPlugin).mockReset().mockReturnValue(f.plugin);
    const native = createNativeFinancialScreenRecipeFixture();
    expect(registerPlugin).toHaveBeenCalledExactlyOnceWith(
      "InvestmentFinancialScreenRecipe",
    );
    const markup = renderToStaticMarkup(<native.Controls />);
    expect(markup).toContain('id="fixture-screen-recipe-protocol"');
    expect(native.getSnapshot()).toEqual({ choices: 0, writes: 0, text: "" });
    expect(f.plugin.choose).not.toHaveBeenCalled();
  });
  it("passes only chooser metadata then the complete canonical recipe through the real adapter", async () => {
    const f = nativeFixture(),
      file = document();
    await expect(f.native.delivery.deliver(file, context())).resolves.toBe(
      "written",
    );
    const chosen = vi.mocked(f.plugin.choose).mock.calls[0]![0];
    expect(chosen.operationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(chosen).toEqual({
      operationId: chosen.operationId,
      capturedAt: TIME,
    });
    expect(f.plugin.write).toHaveBeenCalledExactlyOnceWith({
      operationId: chosen.operationId,
      handle: HANDLE,
      text: file.text,
    });
    expect(f.plugin.cancel).toHaveBeenCalledExactlyOnceWith({
      operationId: chosen.operationId,
    });
    expect(f.native.getSnapshot()).toEqual({
      choices: 1,
      writes: 1,
      text: file.text,
    });
    expect(renderToStaticMarkup(<f.native.Controls />)).toContain(
      "investment-financial-screen-recipe",
    );
  });
  it("records picker Cancel without a write and retires a late chooser before writing", async () => {
    const f = nativeFixture();
    vi.mocked(f.plugin.choose).mockResolvedValueOnce({ status: "cancelled" });
    await expect(
      f.native.delivery.deliver(document(), context()),
    ).resolves.toBe("cancelled");
    let settle!: (value: { status: "chosen"; handle: string }) => void;
    vi.mocked(f.plugin.choose).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    const controller = new AbortController();
    const pending = f.native.delivery.deliver(document(), {
      signal: controller.signal,
      isCurrent: () => !controller.signal.aborted,
    });
    controller.abort();
    settle({ status: "chosen", handle: HANDLE });
    await expect(pending).resolves.toBe("cancelled");
    expect(f.plugin.write).not.toHaveBeenCalled();
    expect(f.native.getSnapshot()).toEqual({ choices: 2, writes: 0, text: "" });
  });
  it("never reports a failed native write as a captured file", async () => {
    const f = nativeFixture();
    vi.mocked(f.plugin.write).mockRejectedValueOnce(
      new Error("Invented native refusal"),
    );
    await expect(
      f.native.delivery.deliver(document(), context()),
    ).rejects.toThrow("Screen recipe file unavailable");
    expect(f.native.getSnapshot()).toEqual({ choices: 1, writes: 0, text: "" });
  });
});

async function screenFixture() {
  const fixture = await createFixture("financial-screen");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
      financialScreenListingIds: fixture.financialScreen!.listingIds,
    },
  );
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.note("listing-zero", "Screening research draft");
  workspace.note("listing-one", "Unrelated screen draft");
  workspace.setView("discover");
  const screen = workspace.financialScreen;
  await screen.loadUniverse(screen.getSnapshot());
  screen.setCriteria(screen.getSnapshot(), documentCriteria());
  return { fixture, workspace, screen };
}
function documentCriteria() {
  return {
    clauses: [
      {
        field: "operatingCashFlow" as const,
        operator: "gte" as const,
        value: "0",
      },
    ],
    sort: { field: "symbol" as const, direction: "asc" as const },
  };
}
function localFile(text: string) {
  const bytes = new TextEncoder().encode(text);
  return {
    size: bytes.byteLength,
    arrayBuffer: () => Promise.resolve(Uint8Array.from(bytes).buffer),
  };
}

describe("recipe transport with the real invented screening workspace", () => {
  it("captures, compares, cancels and explicitly applies before the only Annual run, without touching the Watchlist draft", async () => {
    const f = await screenFixture(),
      native = nativeFixture();
    const recipes = new ManagedFinancialScreenRecipes({
      model: f.screen,
      delivery: native.native.delivery,
      routeActive: () => true,
      now: () => TIME,
    });
    const unsubscribe = recipes.subscribe(() => undefined);
    try {
      const watchlist = f.workspace.coordinator.getSnapshot();
      recipes.setName("Native cash discipline");
      await recipes.capture();
      const file = localFile(native.native.getSnapshot().text);
      f.screen.setCriteria(f.screen.getSnapshot(), {
        clauses: [],
        sort: { field: "symbol", direction: "asc" },
      });
      f.screen.select(
        f.screen.getSnapshot(),
        f.screen.getSnapshot().selected[0]!,
        false,
      );
      const before = f.screen.getSnapshot();
      await recipes.readFile(file, recipes.chooseFile());
      expect(recipes.getSnapshot().review).toMatchObject({
        canApply: true,
        file: { criteria: documentCriteria() },
        current: { selected: [], criteria: { clauses: [] } },
      });
      recipes.cancel();
      expect(f.screen.getSnapshot()).toBe(before);
      await recipes.readFile(file, recipes.chooseFile());
      expect(recipes.apply(recipes.getSnapshot().review!)).toBe(true);
      expect(f.screen.getSnapshot()).toMatchObject({
        criteria: documentCriteria(),
        criteriaStaged: false,
        run: null,
        shortlist: [],
        comparison: { left: null, right: null },
      });
      expect(
        f.screen
          .getSnapshot()
          .selected.map((member) => member.listing.listingId),
      ).toEqual(["listing-zero"]);
      expect(f.fixture.getSnapshot()).toMatchObject({
        resolve: 1,
        annual: 0,
        save: 0,
      });
      expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
      await f.screen.run(f.screen.getSnapshot());
      expect(f.screen.getSnapshot().run?.status).toBe("completed");
      expect(f.fixture.getSnapshot()).toMatchObject({
        resolve: 1,
        annual: 1,
        save: 0,
        eod: 0,
        filings: 0,
      });
      expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
    } finally {
      unsubscribe();
      f.workspace.sessionOwner.dispose();
    }
  });
});
