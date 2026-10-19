import { afterEach, describe, expect, it, vi } from "vitest";
import { formatManagedWatchlistDraftFile } from "../../src/clerk-trial/managed-watchlist-draft-file";
import type { InvestmentWatchlistDraftFilePlugin } from "../../src/clerk-trial/native-watchlist-draft-file";
import { createNativeDraftFileFixture } from "./native-draft-file-fixture";
import { createFixture } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import {
  createManagedWatchlistDraftAccountScope,
  ManagedWatchlistDraftRecovery,
} from "../../src/clerk-trial/managed-watchlist-draft-recovery";

const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
});
async function startDraftWorkspace(
  f: Awaited<ReturnType<typeof createFixture>>,
  sessionId: string,
) {
  const workspace = new ManagedWorkspace(
    f.api,
    { ...f.session, sessionId },
    undefined,
    {
      marketsCohort: f.marketsCohort,
      priceCoverage: f.priceCoverage,
    },
  );
  workspaces.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  expect(workspace.getSnapshot().view).toBe("markets");
  await vi.waitFor(() =>
    expect(workspace.markets.getSnapshot().rows).toHaveLength(3),
  );
  expect(workspace.markets.getSnapshot()).toMatchObject({
    error: false,
    resolving: false,
  });
  return workspace;
}

async function importAndReviewDraft(
  current: ManagedWorkspace,
  scope: string,
  text: string,
) {
  const controller = new ManagedWatchlistDraftRecovery({
    workspace: current,
    accountScope: Promise.resolve(scope),
    delivery: undefined,
    routeActive: () => true,
  });
  try {
    await vi.waitFor(() =>
      expect(controller.getSnapshot().canImport).toBe(true),
    );
    const bytes = new TextEncoder().encode(text);
    await controller.readFile({
      size: bytes.byteLength,
      arrayBuffer: () => Promise.resolve(Uint8Array.from(bytes).buffer),
    });
    expect(controller.getSnapshot().phase).toBe("review");
    expect(current.coordinator.getSnapshot().dirty).toBe(false);
    expect(controller.restoreDraft()).toBe(true);
    expect(current.coordinator.getSnapshot().draft!.memberships[0]!.note).toBe(
      "Unconfirmed file draft",
    );
    expect(current.watchlistFileCatalogReviewRequired()).toBe(true);
    expect(current.canSavePayload()).toBe(false);
    await current.reviewCatalog();
    expect(current.getSnapshot().review?.results).toHaveLength(2);
    current.applyReview();
    expect(current.watchlistFileCatalogReviewRequired()).toBe(false);
    expect(current.canSavePayload()).toBe(true);
    expect(current.coordinator.getSnapshot().dirty).toBe(true);
  } finally {
    controller.dispose();
  }
}

function fixture() {
  const plugin: InvestmentWatchlistDraftFilePlugin = {
    choose: vi
      .fn<InvestmentWatchlistDraftFilePlugin["choose"]>()
      .mockResolvedValue({
        status: "chosen",
        handle: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      }),
    write: vi
      .fn<InvestmentWatchlistDraftFilePlugin["write"]>()
      .mockResolvedValue({ status: "written" }),
    cancel: vi
      .fn<InvestmentWatchlistDraftFilePlugin["cancel"]>()
      .mockResolvedValue(),
  };
  const document = formatManagedWatchlistDraftFile({
    accountScope: "sha256:" + "a".repeat(64),
    capturedAt: "2026-10-18T18:00:00.000Z",
    baseVersion: 1,
    draft: {
      name: "My Watchlist",
      schemaVersion: 1,
      snapshotSha256: "sha256:" + "b".repeat(64),
      memberships: [],
    },
  })!;
  const abort = new AbortController();
  return {
    plugin,
    document,
    abort,
    native: createNativeDraftFileFixture(plugin),
  };
}

function holdNativeChoice(plugin: InvestmentWatchlistDraftFilePlugin) {
  let resolve!: (value: Awaited<ReturnType<typeof plugin.choose>>) => void;
  const pending = new Promise<Awaited<ReturnType<typeof plugin.choose>>>(
    (done) => {
      resolve = done;
    },
  );
  vi.mocked(plugin.choose).mockReturnValueOnce(pending);
  return () =>
    resolve({
      status: "chosen",
      handle: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
}

describe("native draft file fixture observes the real adapter contract", () => {
  it("records only a completed exact write and bounded call counts", async () => {
    const f = fixture();
    await expect(
      f.native.delivery.deliver(f.document, {
        signal: f.abort.signal,
        isCurrent: () => true,
      }),
    ).resolves.toBe("written");
    expect(f.native.getSnapshot()).toEqual({
      choices: 1,
      writes: 1,
      text: f.document.text,
    });
    expect(f.plugin.choose).toHaveBeenCalledOnce();
    expect(f.plugin.write).toHaveBeenCalledOnce();
    expect(f.plugin.cancel).toHaveBeenCalledOnce();
    const choice = vi.mocked(f.plugin.choose).mock.calls[0]![0];
    expect(choice.operationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(choice).toEqual({
      operationId: choice.operationId,
      capturedAt: f.document.capturedAt,
      baseVersion: 1,
    });
  });
  it("retires once while the actual chooser is pending and fences its late write", async () => {
    const f = fixture();
    let current = true;
    const retire = vi.fn(() => {
      current = false;
    });
    f.native.armRetirement(retire);
    await expect(
      f.native.delivery.deliver(f.document, {
        signal: f.abort.signal,
        isCurrent: () => current,
      }),
    ).resolves.toBe("cancelled");
    expect(retire).toHaveBeenCalledOnce();
    expect(f.plugin.write).not.toHaveBeenCalled();
    expect(f.native.getSnapshot()).toEqual({ choices: 1, writes: 0, text: "" });
    current = true;
    await f.native.delivery.deliver(f.document, {
      signal: f.abort.signal,
      isCurrent: () => current,
    });
    expect(retire).toHaveBeenCalledOnce();
    expect(f.native.getSnapshot().writes).toBe(1);
  });
  it("does not report a write after native failure or a cancelled choice", async () => {
    const f = fixture();
    vi.mocked(f.plugin.write).mockRejectedValueOnce(
      new Error("invented failure"),
    );
    await expect(
      f.native.delivery.deliver(f.document, {
        signal: f.abort.signal,
        isCurrent: () => true,
      }),
    ).rejects.toThrow("Watchlist draft file unavailable");
    expect(f.native.getSnapshot()).toEqual({ choices: 1, writes: 0, text: "" });
    vi.mocked(f.plugin.choose).mockResolvedValueOnce({ status: "cancelled" });
    await expect(
      f.native.delivery.deliver(f.document, {
        signal: f.abort.signal,
        isCurrent: () => true,
      }),
    ).resolves.toBe("cancelled");
    expect(f.native.getSnapshot()).toEqual({ choices: 2, writes: 0, text: "" });
    expect(f.plugin.write).toHaveBeenCalledOnce();
  });
  it("keeps the first captured write when the real workspace session retires during a second chooser", async () => {
    const f = fixture();
    const api = await createFixture("watchlist-draft-file");
    const workspace = await startDraftWorkspace(
      api,
      "invented-retirement-session",
    );
    workspace.setView("watchlist");
    workspace.note("listing-zero", "Unconfirmed file draft");
    const controller = new ManagedWatchlistDraftRecovery({
      workspace,
      accountScope: Promise.resolve(f.document.accountScope),
      delivery: f.native.delivery,
      routeActive: () => true,
      now: () => f.document.capturedAt,
    });
    try {
      await vi.waitFor(() =>
        expect(controller.getSnapshot().canExport).toBe(true),
      );
      await controller.exportDraft();
      const first = f.native.getSnapshot();
      expect(first).toMatchObject({ choices: 1, writes: 1 });
      expect(first.text).toContain("Unconfirmed file draft");
      workspace.note("listing-zero", "Other account local draft");
      const settleChoice = holdNativeChoice(f.plugin);
      f.native.armRetirement(() => workspace.coordinator.retire());
      const pending = controller.exportDraft();
      expect(workspace.coordinator.getSnapshot()).toMatchObject({
        phase: "retired",
        draft: null,
        baseVersion: null,
        dirty: false,
      });
      expect(workspace.sessionOwner.getSnapshot().phase).toBe("retired");
      expect(controller.getSnapshot()).toMatchObject({
        phase: "retired",
        canExport: false,
        canImport: false,
      });
      settleChoice();
      await pending;
      expect(f.native.getSnapshot()).toEqual({
        choices: 2,
        writes: 1,
        text: first.text,
      });
      expect(f.plugin.write).toHaveBeenCalledOnce();
      expect(f.plugin.cancel).toHaveBeenCalledTimes(2);
      expect(api.getSnapshot()).toMatchObject({
        load: 1,
        status: 1,
        marketsResolve: 1,
        resolve: 0,
        save: 0,
        token: 0,
      });
    } finally {
      controller.dispose();
    }
  });
});

describe("draft file catalog review uses only its fixed invented saved identities", () => {
  it("returns both complete identities once without changing saved notes or calling Save", async () => {
    const f = await createFixture("watchlist-draft-file");
    const signal = new AbortController().signal;
    const saved = await f.api.load(signal);
    const request = {
      snapshotSha256: saved.payload.snapshotSha256,
      listingIds: ["listing-zero", "listing-one"],
    };
    const response = await f.api.resolve(request, signal);
    expect(response.results.map((result) => result.listingId)).toEqual(
      request.listingIds,
    );
    expect(
      response.results.every(
        (result) => result.listing && !("note" in result.listing),
      ),
    ).toBe(true);
    expect(saved.payload.memberships.map((member) => member.note)).toEqual([
      "Invented saved note: café 東京 📈",
      "Invented second note",
    ]);
    expect(f.getSnapshot()).toMatchObject({
      load: 1,
      resolve: 1,
      save: 0,
      token: 0,
    });
    await expect(f.api.resolve(request, signal)).rejects.toThrow(
      "Unexpected fixture operation: resolve",
    );
    expect(f.getSnapshot().save).toBe(0);
  });
  it.each([["listing-one", "listing-zero"], ["listing-zero"]])(
    "refuses a changed listing request %j",
    async (...listingIds) => {
      const f = await createFixture("watchlist-draft-file");
      const signal = new AbortController().signal;
      const saved = await f.api.load(signal);
      await expect(
        f.api.resolve(
          { snapshotSha256: saved.payload.snapshotSha256, listingIds },
          signal,
        ),
      ).rejects.toThrow("Unexpected fixture operation: resolve");
      expect(f.getSnapshot().save).toBe(0);
    },
  );
  it("preserves default Markets startup, file provenance review and fresh-session saved reads", async () => {
    const f = await createFixture("watchlist-draft-file");
    const first = await startDraftWorkspace(f, "invented-first-session");
    first.setView("watchlist");
    first.note("listing-zero", "Unconfirmed file draft");
    const scope = await createManagedWatchlistDraftAccountScope(
      "https://fixture.invalid",
      f.session.userId,
    );
    const document = formatManagedWatchlistDraftFile({
      accountScope: scope,
      capturedAt: "2026-10-18T18:00:00.000Z",
      baseVersion: 1,
      draft: first.coordinator.getSnapshot().draft!,
    })!;
    first.sessionOwner.dispose();
    const current = await startDraftWorkspace(f, "invented-second-session");
    current.setView("watchlist");
    expect(f.getSnapshot()).toMatchObject({
      load: 2,
      status: 2,
      marketsResolve: 2,
      resolve: 0,
      save: 0,
    });
    await importAndReviewDraft(current, scope, document.text);
    expect(f.getSnapshot()).toMatchObject({
      marketsResolve: 2,
      resolve: 1,
      save: 0,
    });
    current.sessionOwner.dispose();
    const reopened = await startDraftWorkspace(f, "invented-third-session");
    reopened.setView("watchlist");
    expect(reopened.coordinator.getSnapshot()).toMatchObject({
      dirty: false,
      baseVersion: 1,
    });
    expect(reopened.coordinator.getSnapshot().draft!.memberships[0]!.note).toBe(
      "Invented saved note: café 東京 📈",
    );
    expect(f.getSnapshot()).toMatchObject({
      load: 3,
      status: 3,
      marketsResolve: 3,
      resolve: 1,
      save: 0,
      token: 0,
    });
  });
});
