import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
import { ManagedWorkspaceScreen } from "./ManagedWorkspaceScreen";
import {
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
} from "./managed-api";
import { TrialApiError } from "./api";
import { eodResponse } from "./eod-history-fixture";

afterEach(() => vi.restoreAllMocks());

async function fixture() {
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
    await workspace.markets.load();
    expect(read.mock.calls.map(([request]) => request.listingId)).toEqual(
      marketsCohort.map((row) => row.listingId),
    );
    const loaded = html();
    expect(loaded).toContain("Refresh board prices");
    expect(loaded).toContain("Source and request dates");
    expect(loaded).toContain("2026-09-19");
    expect(loaded).toContain("101.5");
    workspace.markets.select(marketsCohort[2].listingId);
    expect(html()).toContain("BETB · one month");
    expect(read).toHaveBeenCalledTimes(3);
    expect(save).not.toHaveBeenCalled();
  });

  it("preserves note/order drafts and board snapshots through unloaded research panels", async () => {
    const { workspace, read, save, marketsCohort } = await fixture();
    const listing = workspace.coordinator.getSnapshot().draft!.memberships[1]!;
    workspace.note(listing.listingId, "Invented unsaved research");
    workspace.move(listing.listingId, -1);
    const draft = workspace.coordinator.getSnapshot().draft;
    await workspace.markets.load();
    const rows = workspace.markets.getSnapshot().rows;
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
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(read).toHaveBeenCalledTimes(3);
    expect(save).not.toHaveBeenCalled();
  });

  it("clears a visit on navigation without losing drafts or automatically requesting prices on return", async () => {
    const { workspace, read, marketsCohort } = await fixture();
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
    expect(read).toHaveBeenCalledTimes(4);
  });
});
