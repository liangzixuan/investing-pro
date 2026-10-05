import * as React from "react";
import type { ManagedEodCloseDto } from "@research-cockpit/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
import { ManagedWorkspaceScreen } from "./ManagedWorkspaceScreen";
import {
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedEodHistoryError,
} from "./managed-api";
import { TrialApiError } from "./api";
import { eodResponse } from "./eod-history-fixture";

afterEach(() => vi.restoreAllMocks());

async function fixture(
  rowsFor?: (index: number) => readonly ManagedEodCloseDto[],
) {
  const invented = await createFixture();
  const { api, session, marketsCohort } = invented;
  const workspace = new ManagedWorkspace(api, session, undefined, {
    marketsCohort,
  });
  const read = vi.spyOn(api, "eodHistory").mockImplementation((request) =>
    Promise.resolve({
      ...eodResponse(),
      catalogSnapshotSha256: request.catalogSnapshotSha256,
      security: marketsCohort.find(
        (row) => row.listingId === request.listingId,
      )!,
      rows:
        rowsFor?.(
          marketsCohort.findIndex((row) => row.listingId === request.listingId),
        ) ?? eodResponse().rows,
    }),
  );
  const save = vi.spyOn(api, "save");
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  await vi.waitFor(() =>
    expect(workspace.markets.getSnapshot().rows).toHaveLength(3),
  );
  const html = () =>
    renderToStaticMarkup(<ManagedWorkspaceScreen workspace={workspace} />);
  return { workspace, api, read, save, html, marketsCohort };
}

function marketRow(markup: string, symbol: string): string {
  const match = markup.match(
    new RegExp(
      `<li><button[^>]*aria-label="Select ${symbol} on company board"[\\s\\S]*?</li>`,
    ),
  );
  expect(match).not.toBeNull();
  return match![0];
}

describe("Markets and mounted workspace", () => {
  it("starts with metadata-only Markets, real controls and explicit dated prices", async () => {
    const { workspace, read, save, html, marketsCohort } = await fixture();
    expect(workspace.getSnapshot().view).toBe("markets");
    expect(read).not.toHaveBeenCalled();
    const unloaded = html();
    expect(unloaded).toContain("Load board prices");
    expect(unloaded).toContain('aria-label="Select ALFA on company board"');
    expect(unloaded).toContain('aria-label="Board Annual report for ALFA"');
    expect(unloaded).toContain("not live quotes or adjusted returns");
    expect(unloaded).not.toContain("managed-market-change");
    await workspace.markets.load();
    expect(read.mock.calls.map(([request]) => request.listingId)).toEqual(
      marketsCohort.map((row) => row.listingId),
    );
    const loaded = html();
    expect(loaded).toContain("Refresh board prices");
    expect(loaded).toContain("Source and request dates");
    expect(loaded).toContain("2026-09-19");
    expect(loaded).toContain("101.5");
    expect(loaded).toContain("Raw close change: +$1.25 (+1.2469%)");
    expect(loaded).toContain(
      "2026-09-18 to 2026-09-19 · not adjusted for splits or dividends.",
    );
    const descriptions = marketsCohort.map(({ symbol }) => {
      const row = marketRow(loaded, symbol);
      const ids = row.match(/aria-describedby="([^"]+)"/)![1]!.split(" ");
      expect(ids).toHaveLength(2);
      expect(row).toContain(`id="${ids[0]}" class="managed-market-close"`);
      expect(row).toContain(`id="${ids[1]}" class="managed-market-change"`);
      return ids;
    });
    expect(new Set(descriptions.flat()).size).toBe(6);
    workspace.markets.select(marketsCohort[2].listingId);
    expect(html()).toContain("BETB · one month");
    expect(read).toHaveBeenCalledTimes(3);
    expect(save).not.toHaveBeenCalled();
  });

  it("preserves note/order drafts and board snapshots through unloaded research panels", async () => {
    const { workspace, read, save, html, marketsCohort } = await fixture();
    const listing = workspace.coordinator.getSnapshot().draft!.memberships[1]!;
    workspace.note(listing.listingId, "Invented unsaved research");
    workspace.move(listing.listingId, -1);
    const draft = workspace.coordinator.getSnapshot().draft;
    await workspace.markets.load();
    const rows = workspace.markets.getSnapshot().rows;
    const originalRow = marketRow(html(), "ALFA");
    workspace.openMarketResearch("eod", marketsCohort[1].listingId);
    expect(workspace.eod.getSnapshot()).toMatchObject({
      response: null,
      selection: { origin: "markets", cik: null, listing: marketsCohort[1] },
    });
    workspace.switchToAnnual();
    expect(workspace.annual.getSnapshot()).toMatchObject({
      response: null,
      selection: { origin: "markets", cik: null, listing: marketsCohort[1] },
    });
    workspace.switchToEod();
    workspace.closeResearch();
    expect(workspace.markets.getSnapshot().rows).toEqual(rows);
    expect(marketRow(html(), "ALFA")).toBe(originalRow);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(read).toHaveBeenCalledTimes(3);
    expect(save).not.toHaveBeenCalled();
  });

  it("clears a visit on navigation without losing drafts or automatically requesting prices on return", async () => {
    const { workspace, read, html, marketsCohort } = await fixture();
    const draft = workspace.coordinator.getSnapshot().draft;
    await workspace.markets.load();
    workspace.openMarketResearch("eod", marketsCohort[0].listingId);
    workspace.setView("watchlist");
    expect(workspace.eod.getSnapshot().selection).toBeNull();
    expect(workspace.markets.getSnapshot().rows).toEqual([]);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    workspace.setView("markets");
    await vi.waitFor(() =>
      expect(workspace.markets.getSnapshot().rows).toHaveLength(3),
    );
    expect(
      workspace.markets
        .getSnapshot()
        .rows.every((row) => row.response === null),
    ).toBe(true);
    expect(read).toHaveBeenCalledTimes(3);
    expect(html()).not.toContain("managed-market-change");
  });

  it("uses each listing's own last two supplied dates across gaps and keeps a one-row close available", async () => {
    const histories = [
      [
        { date: "2026-09-11", close: "10.25" },
        { date: "2026-09-14", close: "10.5" },
      ],
      [
        { date: "2026-09-10", close: "20.75" },
        { date: "2026-09-18", close: "20.5" },
      ],
      [{ date: "2026-09-19", close: "30.5" }],
    ];
    const { workspace, html, read, save, marketsCohort } = await fixture(
      (index) => histories[index]!,
    );
    await workspace.markets.load();
    const alfa = marketRow(html(), "ALFA");
    expect(alfa).toContain("Raw close change: +$0.25 (+2.4390%)");
    expect(alfa).toContain("2026-09-11 to 2026-09-14");
    const beta = marketRow(html(), "BETA");
    expect(beta).toContain("Raw close change: -$0.25 (-1.2048%)");
    expect(beta).toContain("2026-09-10 to 2026-09-18");
    const betb = marketRow(html(), "BETB");
    expect(betb).toContain("$30.5");
    expect(betb).toContain("USD · 2026-09-19");
    expect(betb).toContain(
      "Raw close change unavailable: two dated closes needed.",
    );
    expect(betb).not.toContain("0.0000%");
    workspace.markets.select(marketsCohort[2].listingId);
    expect(html()).toContain("BETB · one month");
    expect(html()).toContain("<td>30.5</td>");
    expect(html()).not.toMatch(/today|daily return|previous session|movers/iu);
    expect(read).toHaveBeenCalledTimes(3);
    expect(save).not.toHaveBeenCalled();
  });

  it.each([
    ["100.0000001", "+$0.0000001 (less than 0.0001% higher)"],
    ["99.9999999", "-$0.0000001 (less than 0.0001% lower)"],
    ["100", "$0 (0.0000%)"],
  ])(
    "distinguishes the exact close %s from rounded percentage zero",
    async (close, label) => {
      const { workspace, html } = await fixture(() => [
        { date: "2026-09-18", close: "100" },
        { date: "2026-09-19", close },
      ]);
      await workspace.markets.load();
      const row = marketRow(html(), "ALFA");
      expect(row).toContain(`Raw close change: ${label}`);
      expect(row).not.toContain("-0.0000%");
      if (close !== "100") expect(row).not.toContain("(0.0000%)");
    },
  );

  it("preserves long exact source and difference text without Number formatting", async () => {
    const close = "9".repeat(64);
    const difference = String(BigInt(close) - 100n);
    const { workspace, html } = await fixture(() => [
      { date: "2026-09-18", close: "100" },
      { date: "2026-09-19", close },
    ]);
    await workspace.markets.load();
    const row = marketRow(html(), "ALFA");
    expect(row).toContain(`<strong>$${close}</strong>`);
    expect(row).toContain(
      `Raw close change: +$${difference} (+${difference}.0000%)`,
    );
    expect(row).not.toContain("e+");
  });

  it("retains one complete dated comparison through refresh, Cancel and transient failure, then replaces it on success", async () => {
    const { workspace, read, save, html, marketsCohort } = await fixture();
    const member = workspace.coordinator.getSnapshot().draft!.memberships[1]!;
    workspace.note(member.listingId, "Invented unsaved board note");
    workspace.move(member.listingId, -1);
    const draft = workspace.coordinator.getSnapshot().draft;
    await workspace.markets.load();
    const previous = workspace.markets.getSnapshot().rows[0]!.response;
    const expectPrevious = () => {
      const row = marketRow(html(), "ALFA");
      expect(row).toContain("Raw close change: +$1.25 (+1.2469%)");
      expect(row).toContain("2026-09-18 to 2026-09-19");
      expect(row).toContain(
        "Previous history · completed 2026-09-20T00:00:01.000Z",
      );
      expect(workspace.markets.getSnapshot().rows[0]!.response).toBe(previous);
    };
    let finish!: (value: ReturnType<typeof eodResponse>) => void;
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = workspace.markets.load();
    expectPrevious();
    workspace.markets.cancel();
    expect(read.mock.calls[3]![1].aborted).toBe(true);
    expectPrevious();
    finish({
      ...eodResponse(),
      security: marketsCohort[0],
      rows: [
        { date: "2026-09-19", close: "200" },
        { date: "2026-09-20", close: "100" },
      ],
    });
    await pending;
    expectPrevious();
    expect(read).toHaveBeenCalledTimes(4);
    read.mockRejectedValueOnce(new ManagedEodHistoryError("unavailable"));
    await workspace.markets.load();
    expectPrevious();
    expect(marketRow(html(), "ALFA")).toContain(
      "Price history could not be loaded.",
    );
    expect(read).toHaveBeenCalledTimes(7);
    read.mockImplementation((request) =>
      Promise.resolve({
        ...eodResponse(),
        catalogSnapshotSha256: request.catalogSnapshotSha256,
        security: marketsCohort.find(
          (row) => row.listingId === request.listingId,
        )!,
        rows: [
          { date: "2026-09-19", close: "100" },
          { date: "2026-09-20", close: "102" },
        ],
      }),
    );
    await workspace.markets.load();
    const current = marketRow(html(), "ALFA");
    expect(current).toContain("Raw close change: +$2 (+2.0000%)");
    expect(current).toContain("2026-09-19 to 2026-09-20");
    expect(current).not.toContain("Previous history");
    expect(current).not.toContain("2026-09-18");
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(read).toHaveBeenCalledTimes(10);
    expect(save).not.toHaveBeenCalled();
  });

  it.each(["board", "panel"] as const)(
    "shares a checked %s cooldown across navigation and surfaces",
    async (origin) => {
      const { workspace, read, marketsCohort } = await fixture();
      vi.spyOn(Date, "now").mockReturnValue(
        Date.parse("2026-10-04T00:00:00.000Z"),
      );
      read.mockRejectedValueOnce(
        new ManagedEodCooldownError("2026-10-04T01:00:00.000Z"),
      );
      if (origin === "board") {
        await workspace.markets.load();
        workspace.openMarketResearch("eod", marketsCohort[0].listingId);
        await workspace.eod.load();
        expect(workspace.eod.getSnapshot().message).toContain("01:00:00.000Z");
      } else {
        workspace.openMarketResearch("eod", marketsCohort[0].listingId);
        await workspace.eod.load();
        workspace.closeResearch();
      }
      workspace.setView("discover");
      workspace.setView("markets");
      await vi.waitFor(() =>
        expect(workspace.markets.getSnapshot().rows).toHaveLength(3),
      );
      await workspace.markets.load();
      expect(workspace.markets.getSnapshot().message).toContain(
        "01:00:00.000Z",
      );
      expect(read).toHaveBeenCalledTimes(1);
    },
  );

  it("a panel catalog refusal clears board prices and prevents reopening until catalog recovery", async () => {
    const { workspace, read, marketsCohort } = await fixture();
    await workspace.markets.load();
    workspace.openMarketResearch("eod", marketsCohort[0].listingId);
    read.mockRejectedValueOnce(new ManagedCatalogChangedError());
    await workspace.eod.load();
    expect(workspace.eod.getSnapshot().selection).toBeNull();
    expect(workspace.markets.getSnapshot().rows).toEqual([]);
    expect(workspace.getSnapshot().snapshot).toBeNull();
    workspace.switchToAnnual();
    expect(workspace.annual.getSnapshot().selection).toBeNull();
    await workspace.refreshCatalog();
    await vi.waitFor(() =>
      expect(workspace.markets.getSnapshot().rows).toHaveLength(3),
    );
    expect(workspace.eod.getSnapshot().selection).toBeNull();
    expect(
      workspace.markets
        .getSnapshot()
        .rows.every((row) => row.response === null),
    ).toBe(true);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("opening research cancels the queue and late completion cannot repopulate it", async () => {
    const { workspace, read, marketsCohort } = await fixture();
    let finish!: (value: ReturnType<typeof eodResponse>) => void;
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = workspace.markets.load();
    const signal = read.mock.calls[0]![1];
    workspace.openMarketResearch("annual", marketsCohort[0].listingId);
    expect(signal.aborted).toBe(true);
    finish({ ...eodResponse(), security: marketsCohort[0] });
    await pending;
    expect(workspace.markets.getSnapshot().running).toBe(false);
    expect(
      workspace.markets
        .getSnapshot()
        .rows.every((row) => row.response === null),
    ).toBe(true);
    expect(workspace.annual.getSnapshot().selection?.origin).toBe("markets");
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("external catalog invalidation aborts an open panel and rejects its late response", async () => {
    const { workspace, api, read, marketsCohort } = await fixture();
    workspace.openMarketResearch("eod", marketsCohort[0].listingId);
    let finish!: (value: ReturnType<typeof eodResponse>) => void;
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = workspace.eod.load();
    const signal = read.mock.calls[0]![1];
    vi.spyOn(api, "search").mockRejectedValueOnce(
      new ManagedCatalogChangedError(),
    );
    workspace.setQuery("ALFA");
    await workspace.search();
    expect(signal.aborted).toBe(true);
    expect(workspace.eod.getSnapshot().selection).toBeNull();
    finish({ ...eodResponse(), security: marketsCohort[0] });
    await pending;
    expect(workspace.eod.getSnapshot().response).toBeNull();
    expect(workspace.markets.getSnapshot().rows).toEqual([]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("authentication refusal retires every surface and clears saved UI data", async () => {
    const { workspace, read, html } = await fixture();
    await workspace.markets.load();
    read.mockRejectedValueOnce(new TrialApiError("unauthenticated"));
    await workspace.markets.load();
    expect(workspace.markets.getSnapshot().rows).toEqual([]);
    expect(workspace.coordinator.getSnapshot().phase).toBe("retired");
    expect(html()).not.toContain("101.5");
    expect(html()).not.toContain("Alfa Company");
    expect(html()).not.toContain("managed-market-change");
    expect(read).toHaveBeenCalledTimes(4);
  });
});
