import { describe, expect, it, vi } from "vitest";
import {
  parseManagedPortfolioCommand,
  type MainWatchlistPayload,
  type ManagedCatalogResolveResponse,
  type ManagedCatalogSnapshotDto,
  type ManagedPortfolioDto,
  type ManagedPortfolioPayload,
  type PersonalPortfolioIdentity,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { ManagedPortfolio } from "./managed-portfolio";
import { ManagedResearchFollowups } from "./managed-research-followups";
import { resourceNeedsLeaveReview } from "./managed-session-owner";
import { SaveCoordinator } from "./save-coordinator";
import { MANAGED_WATCHLIST_SAVE_COPY } from "./save-coordinator-copy";
import type { TrialSession } from "./session";

const digest = `sha256:${"a".repeat(64)}` as const;
const nextDigest = `sha256:${"b".repeat(64)}` as const;
const listing = (index = 1): PersonalPortfolioIdentity => ({
  country: "US",
  exchangeMic: "XNAS",
  instrumentType: "common_stock",
  issuerId: `issuer-${index}`,
  issuerName: `Invented issuer ${index}`,
  listingId: `listing-${index}`,
  securityId: `security-${index}`,
  securityName: "Common stock",
  shareClassId: `class-${index}`,
  shareClassName: "Class A",
  symbol: `DEMO${index}`,
});
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "invented",
  catalogVersion: "one",
  asOf: "2026-10-01T00:00:00.000Z",
  acquiredAt: "2026-10-01T00:00:00.000Z",
  generatedAt: "2026-10-01T00:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented engineering catalog",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 20,
    activeListings: 20,
    admittedSourceRecords: 20,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 20,
    providerMappings: 0,
    quarantinedSourceRecords: 0,
    sourceRecords: 20,
    staleSourceRecords: 0,
    shareClasses: 20,
    totalSecurities: 20,
    unsupportedSourceRecords: 0,
  },
};
function ledger(identities = [listing()]): ManagedPortfolioPayload {
  return {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: digest,
    basisMethod: "fifo_with_opening_pool",
    identities,
    opening: { asOfDate: "2026-10-01", cashUsd: "1000.00", holdings: [] },
    transactions: [],
  };
}
function traded(value: ManagedPortfolioPayload): ManagedPortfolioPayload {
  return {
    ...value,
    transactions: [
      {
        id: "buy-one",
        date: "2026-10-02",
        type: "buy",
        listingId: "listing-1",
        shares: "2.000000",
        grossUsd: "200.00",
        feeUsd: "1.00",
      },
      {
        id: "sell-one",
        date: "2026-10-02",
        type: "sell",
        listingId: "listing-1",
        shares: "1.000000",
        grossUsd: "150.00",
        feeUsd: "1.00",
      },
    ],
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function resolution(request: {
  snapshotSha256: string;
  listingIds: readonly string[];
}): ManagedCatalogResolveResponse {
  return {
    snapshotSha256: request.snapshotSha256,
    results: request.listingIds.map((listingId) => ({
      listingId,
      listing: listing(Number(listingId.split("-")[1])),
    })),
  };
}
function fixture(initial: ManagedPortfolioPayload | null = null) {
  let stored: ManagedPortfolioDto = initial
    ? { version: 1, payload: initial }
    : { version: 0, payload: null };
  const context: {
    snapshot: ManagedCatalogSnapshotDto | null;
    clock: Date;
    onClock?: () => void;
  } = {
    snapshot,
    clock: new Date("2026-10-15T23:59:59.000Z"),
  };
  const api = {
    loadPortfolio: vi.fn<ManagedApi["loadPortfolio"]>(() =>
      Promise.resolve(stored),
    ),
    savePortfolio: vi.fn<ManagedApi["savePortfolio"]>((command) => {
      const captured = parseManagedPortfolioCommand(command);
      if (!captured) throw new Error("Invalid invented command");
      stored = {
        version: captured.expectedVersion + 1,
        payload: captured.payload,
      };
      return Promise.resolve({ ...stored, replayed: false });
    }),
    resolve: vi.fn<ManagedApi["resolve"]>((request) =>
      Promise.resolve(resolution(request)),
    ),
  };
  const session: TrialSession = {
    userId: "invented-user",
    sessionId: "invented-session",
    getToken: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
  const onRetire = vi.fn();
  let key = 0;
  const options = {
    getCatalogSnapshot: () => context.snapshot,
    onRetire,
    newKey: () => `portfolio-invented-${++key}`,
    now: () => {
      context.onClock?.();
      return context.clock;
    },
  };
  const model = new ManagedPortfolio(api, session, options);
  const current = () => {
    const draft = model.coordinator.getSnapshot().draft;
    if (!draft) throw new Error("Expected loaded draft");
    return draft;
  };
  const initialized = () => {
    const value = current().ledger;
    if (!value) throw new Error("Expected initialized ledger");
    return value;
  };
  return {
    model,
    api,
    session,
    context,
    onRetire,
    options,
    current,
    initialized,
    setStored: (next: ManagedPortfolioDto) => {
      stored = next;
    },
  };
}
async function reviewed(f: ReturnType<typeof fixture>) {
  await f.model.coordinator.load();
  await f.model.reviewCatalog();
  f.model.applyReview();
}

describe("managed portfolio model", () => {
  it("loads version zero explicitly, starts with an authored date, saves and reopens the exact ledger", async () => {
    const f = fixture();
    expect(f.model.coordinator.getSnapshot().draft).toBeNull();
    f.model.start("2026-10-01", "1000.00");
    expect(f.api.loadPortfolio).not.toHaveBeenCalled();
    expect(f.model.coordinator.getSnapshot().draft).toBeNull();
    await f.model.coordinator.load();
    expect(f.current()).toEqual({ ledger: null });
    expect(f.model.canSavePayload()).toBe(false);
    await f.model.coordinator.save();
    expect(f.api.savePortfolio).not.toHaveBeenCalled();
    f.model.start("2026-10-01", "1000.00");
    await f.model.register(listing());
    expect(f.model.canSavePayload()).toBe(true);
    f.model.replace(f.current(), traded(f.initialized()));
    const result = f.model.getProjection();
    expect(result?.status).toBe("valid");
    if (result?.status !== "valid") throw new Error("Expected valid ledger");
    expect(result.portfolio.cashUsd).toBe("948.00");
    expect(result.portfolio.holdings[0]).toMatchObject({
      shares: "1",
      totalCostBasisUsd: "100.50",
    });
    expect(result.realized.totalGainUsd).toBe("48.50");
    await f.model.coordinator.save();
    expect(f.api.savePortfolio.mock.calls[0]![0]).toEqual({
      expectedVersion: 0,
      idempotencyKey: "portfolio-invented-1",
      payload: traded(ledger()),
    });
    const reopen = new ManagedPortfolio(
      f.api,
      { ...f.session, sessionId: "fresh-session" },
      f.options,
    );
    expect(reopen.coordinator.getSnapshot().draft).toBeNull();
    await reopen.coordinator.load();
    expect(reopen.coordinator.getSnapshot().draft?.ledger).toEqual(
      traded(ledger()),
    );
    expect(reopen.canSavePayload()).toBe(false);
    expect(f.api.loadPortfolio).toHaveBeenCalledTimes(2);
    expect(f.api.resolve).toHaveBeenCalledTimes(1);
    expect(f.api.savePortfolio).toHaveBeenCalledTimes(1);
  });

  it.each(["", "2026-02-29", "2026-10-16"])(
    "does not initialize invalid or future opening %s",
    async (date) => {
      const f = fixture();
      await f.model.coordinator.load();
      f.model.start(date, null);
      expect(f.current().ledger).toBeNull();
      expect(f.api.resolve).not.toHaveBeenCalled();
    },
  );

  it("requires a catalog and valid UTC clock; null cash remains unknown and initialization cannot reset a ledger", async () => {
    const f = fixture();
    await f.model.coordinator.load();
    f.context.snapshot = null;
    f.model.syncCatalog();
    f.model.start("2026-10-01", null);
    expect(f.current().ledger).toBeNull();
    f.context.snapshot = snapshot;
    f.model.syncCatalog();
    f.context.clock = new Date(NaN);
    f.model.start("2026-10-01", null);
    expect(f.current().ledger).toBeNull();
    f.context.clock = new Date("2026-10-16T00:30:00+02:00");
    f.model.start("2026-10-16", null);
    expect(f.current().ledger).toBeNull();
    f.model.start("2026-10-15", null);
    const draft = f.current();
    expect(draft.ledger?.opening.cashUsd).toBeNull();
    f.model.start("2026-10-01", "0");
    expect(f.current()).toBe(draft);
    expect(f.model.canSavePayload()).toBe(true);
  });

  it("keeps old/future saved data readable but fresh capture uses the current UTC day", async () => {
    const initial = {
      ...ledger([]),
      opening: { ...ledger().opening, asOfDate: "2026-10-16" },
    };
    const f = fixture(initial);
    await f.model.coordinator.load();
    expect(f.initialized().opening.asOfDate).toBe("2026-10-16");
    expect(f.model.getProjection()?.status).toBe("valid");
    f.model.replace(f.current(), f.initialized());
    expect(f.model.canSavePayload()).toBe(false);
    await f.model.coordinator.save();
    expect(f.api.savePortfolio).not.toHaveBeenCalled();
    f.context.clock = new Date("2026-10-16T00:00:00.000Z");
    expect(f.model.canSavePayload()).toBe(true);
  });

  it("owns/freeze loaded and replacement data and refuses stale editor references or invalid whole ledgers", async () => {
    const initial = ledger();
    const f = fixture(initial);
    await reviewed(f);
    const old = f.current();
    const replacement = traded(f.initialized());
    f.model.replace(old, replacement);
    expect(f.current()).not.toBe(old);
    expect(f.initialized()).not.toBe(replacement);
    expect(Object.isFrozen(f.initialized().identities[0])).toBe(true);
    expect(Object.isFrozen(f.initialized().transactions[0])).toBe(true);
    expect(Object.isFrozen(initial)).toBe(false);
    expect(Object.isFrozen(replacement)).toBe(false);
    const current = f.current();
    f.model.replace(old, ledger([]));
    f.model.replace(current, {
      ...f.initialized(),
      transactions: [...f.initialized().transactions].reverse(),
    });
    expect(f.current()).toBe(current);
    expect(f.api.savePortfolio).not.toHaveBeenCalled();
  });

  it("retains ordered identity approval through financial edits but not identity changes or reordering", async () => {
    const f = fixture(ledger([listing(), listing(2)]));
    await reviewed(f);
    expect(f.api.resolve.mock.calls[0]![0].listingIds).toEqual([
      "listing-1",
      "listing-2",
    ]);
    expect(f.model.canSavePayload()).toBe(true);
    f.model.replace(f.current(), traded(f.initialized()));
    expect(f.model.canSavePayload()).toBe(true);
    f.model.replace(f.current(), {
      ...f.initialized(),
      identities: [...f.initialized().identities].reverse(),
    });
    expect(f.model.canSavePayload()).toBe(false);
    await f.model.reviewCatalog();
    f.model.applyReview();
    expect(f.model.canSavePayload()).toBe(true);
    f.model.replace(f.current(), {
      ...f.initialized(),
      identities: f
        .initialized()
        .identities.map((item) => ({ ...item, symbol: "CHANGED" })),
    });
    expect(f.model.canSavePayload()).toBe(false);
    expect(f.api.resolve).toHaveBeenCalledTimes(2);
  });

  it("registers one exact resolved identity, extends only a fully trusted registry, and never creates ticker IDs", async () => {
    const f = fixture(ledger());
    await f.model.coordinator.load();
    await f.model.register(listing(2));
    expect(f.initialized().identities).toEqual([listing(), listing(2)]);
    expect(f.model.canSavePayload()).toBe(false);
    await f.model.reviewCatalog();
    f.model.applyReview();
    await f.model.register(listing(3));
    expect(f.model.canSavePayload()).toBe(true);
    await f.model.register(listing(3));
    expect(f.api.resolve).toHaveBeenCalledTimes(3);
    expect(
      f.api.resolve.mock.calls.map(([request]) => request.listingIds),
    ).toEqual([["listing-2"], ["listing-1", "listing-2"], ["listing-3"]]);
    expect(f.api.savePortfolio).not.toHaveBeenCalled();
  });

  it.each([
    "issuerId",
    "securityId",
    "shareClassId",
    "exchangeMic",
    "country",
    "instrumentType",
    "issuerName",
    "securityName",
    "shareClassName",
    "symbol",
  ] as const)(
    "refuses registration when resolved %s differs",
    async (field) => {
      const f = fixture(ledger([]));
      await f.model.coordinator.load();
      const changed = {
        ...listing(),
        [field]:
          field === "exchangeMic"
            ? "XNYS"
            : field === "country"
              ? "CA"
              : field === "instrumentType"
                ? "adr"
                : "OTHER",
      };
      f.api.resolve.mockResolvedValueOnce({
        snapshotSha256: digest,
        results: [{ listingId: "listing-1", listing: changed }],
      });
      const before = f.current();
      await f.model.register(listing());
      expect(f.current()).toBe(before);
      expect(f.api.savePortfolio).not.toHaveBeenCalled();
    },
  );

  it("bounds registration and whole-registry review to twenty identities", async () => {
    const identities = Array.from({ length: 20 }, (_, index) =>
      listing(index + 1),
    );
    const f = fixture(ledger(identities));
    await f.model.coordinator.load();
    await f.model.register(listing(21));
    expect(f.api.resolve).not.toHaveBeenCalled();
    await f.model.reviewCatalog();
    f.model.applyReview();
    expect(f.api.resolve.mock.calls[0]![0].listingIds).toEqual(
      identities.map((item) => item.listingId),
    );
    expect(f.initialized().identities).toHaveLength(20);
    expect(f.model.canSavePayload()).toBe(true);
  });

  it("classifies metadata updates but retains all history until an explicit all-stable apply", async () => {
    const f = fixture(traded(ledger()));
    await f.model.coordinator.load();
    f.context.snapshot = { ...snapshot, snapshotSha256: nextDigest };
    f.model.syncCatalog();
    const current = {
      ...listing(),
      issuerName: "Reviewed renamed issuer",
      symbol: "NEW",
    };
    f.api.resolve.mockResolvedValueOnce({
      snapshotSha256: nextDigest,
      results: [{ listingId: "listing-1", listing: current }],
    });
    const before = f.current();
    await f.model.reviewCatalog();
    expect(f.current()).toBe(before);
    expect(f.model.getSnapshot().review?.entries[0]).toEqual({
      previous: listing(),
      listing: current,
      status: "update",
    });
    expect(f.model.canSavePayload()).toBe(false);
    f.model.applyReview();
    expect(f.initialized().snapshotSha256).toBe(nextDigest);
    expect(f.initialized().identities).toEqual([current]);
    expect(f.initialized().transactions).toEqual(before.ledger!.transactions);
    expect(f.initialized().opening).toEqual(before.ledger!.opening);
    expect(f.model.canSavePayload()).toBe(true);
    expect(f.api.savePortfolio).not.toHaveBeenCalled();
  });

  it.each(["missing", "rebound"] as const)(
    "retains the entire registry/history when one identity is %s",
    async (status) => {
      const f = fixture(traded(ledger([listing(), listing(2)])));
      await f.model.coordinator.load();
      f.context.snapshot = { ...snapshot, snapshotSha256: nextDigest };
      f.model.syncCatalog();
      f.api.resolve.mockResolvedValueOnce({
        snapshotSha256: nextDigest,
        results: [
          {
            listingId: "listing-1",
            listing: { ...listing(), issuerName: "Metadata update" },
          },
          {
            listingId: "listing-2",
            listing:
              status === "missing"
                ? null
                : { ...listing(2), exchangeMic: "XNYS" },
          },
        ],
      });
      const before = f.current();
      await f.model.reviewCatalog();
      f.model.applyReview();
      expect(
        f.model.getSnapshot().review?.entries.map((entry) => entry.status),
      ).toEqual(["update", status]);
      expect(f.current()).toBe(before);
      expect(f.model.canSavePayload()).toBe(false);
      await f.model.coordinator.save();
      expect(f.api.savePortfolio).not.toHaveBeenCalled();
    },
  );

  it("rejects reordered/wrong-digest resolve packets and retains loaded data on resolve failure", async () => {
    const f = fixture(ledger([listing(), listing(2)]));
    await f.model.coordinator.load();
    const before = f.current();
    f.api.resolve.mockResolvedValueOnce({
      snapshotSha256: digest,
      results: resolution({
        snapshotSha256: digest,
        listingIds: ["listing-2", "listing-1"],
      }).results,
    });
    await f.model.reviewCatalog();
    expect(f.model.getSnapshot().review).toBeNull();
    f.api.resolve.mockResolvedValueOnce({
      snapshotSha256: nextDigest,
      results: resolution({
        snapshotSha256: digest,
        listingIds: ["listing-1", "listing-2"],
      }).results,
    });
    await f.model.reviewCatalog();
    expect(f.model.getSnapshot().review).toBeNull();
    f.api.resolve.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.model.reviewCatalog();
    expect(f.current()).toBe(before);
    expect(f.model.getSnapshot().message).toContain("could not finish");
  });

  it.each(["cancel", "edit", "catalog", "retire"] as const)(
    "aborts and ignores a late identity review after %s",
    async (action) => {
      const f = fixture(ledger());
      await f.model.coordinator.load();
      const held = deferred<ManagedCatalogResolveResponse>();
      f.api.resolve.mockReturnValueOnce(held.promise);
      const pending = f.model.reviewCatalog();
      const [request, signal] = f.api.resolve.mock.calls[0]!;
      if (action === "cancel") f.model.cancelReview();
      if (action === "edit")
        f.model.replace(f.current(), traded(f.initialized()));
      if (action === "catalog") {
        f.context.snapshot = { ...snapshot, snapshotSha256: nextDigest };
        f.model.syncCatalog();
      }
      if (action === "retire") f.model.retire();
      expect(signal.aborted).toBe(true);
      const before = f.model.coordinator.getSnapshot().draft;
      held.resolve(resolution(request));
      await pending;
      expect(f.model.getSnapshot().review).toBeNull();
      expect(f.model.coordinator.getSnapshot().draft).toBe(before);
      expect(f.api.savePortfolio).not.toHaveBeenCalled();
    },
  );

  it("fences late registration and a reentrant clock retirement before save", async () => {
    const f = fixture(ledger([]));
    await f.model.coordinator.load();
    const held = deferred<ManagedCatalogResolveResponse>();
    f.api.resolve.mockReturnValueOnce(held.promise);
    const pending = f.model.register(listing());
    f.model.cancelReview();
    held.resolve(resolution(f.api.resolve.mock.calls[0]![0]));
    await pending;
    expect(f.initialized().identities).toEqual([]);
    f.model.replace(f.current(), f.initialized());
    f.context.onClock = () => f.model.retire();
    await f.model.coordinator.save();
    expect(f.api.savePortfolio).not.toHaveBeenCalled();
    expect(f.model.coordinator.getSnapshot().draft).toBeNull();
    expect(f.onRetire).toHaveBeenCalledTimes(1);
  });

  it("keeps dirty data through failed loads and requires an explicit choice after conflicts", async () => {
    const f = fixture(ledger());
    await reviewed(f);
    f.model.replace(f.current(), traded(f.initialized()));
    const before = f.current();
    f.api.loadPortfolio.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await f.model.coordinator.load();
    expect(f.current()).toBe(before);
    f.api.savePortfolio.mockRejectedValueOnce(new TrialApiError("conflict"));
    await f.model.coordinator.save();
    expect(f.model.coordinator.getSnapshot().conflict).toBe(true);
    expect(f.model.canEdit()).toBe(false);
    f.model.replace(f.current(), ledger([]));
    await f.model.register(listing(2));
    expect(f.initialized()).toEqual(traded(ledger()));
    f.setStored({ version: 2, payload: ledger() });
    await f.model.coordinator.load();
    f.model.coordinator.keepDraft();
    expect(f.model.coordinator.getSnapshot().baseVersion).toBe(2);
    expect(f.model.canSavePayload()).toBe(true);
    await f.model.coordinator.save();
    expect(f.api.savePortfolio.mock.calls[1]![0].expectedVersion).toBe(2);
    expect(f.model.coordinator.getSnapshot().saved?.version).toBe(3);
  });

  it("reconciles the exact captured command after clock/catalog changes without fresh-policy replay", async () => {
    const f = fixture(traded(ledger()));
    await reviewed(f);
    f.api.savePortfolio.mockRejectedValueOnce(
      new TrialApiError("commit_unknown"),
    );
    await f.model.coordinator.save();
    const original = f.api.savePortfolio.mock.calls[0]![0];
    expect(f.model.coordinator.getSnapshot().uncertain).toBe(true);
    expect(f.model.canEdit()).toBe(false);
    f.context.clock = new Date("2020-01-01T00:00:00.000Z");
    f.context.snapshot = { ...snapshot, snapshotSha256: nextDigest };
    f.model.syncCatalog();
    f.api.savePortfolio.mockResolvedValueOnce({
      version: original.expectedVersion + 1,
      payload: original.payload,
      replayed: true,
    });
    await f.model.coordinator.reconcile();
    expect(f.api.savePortfolio.mock.calls[1]![0]).toEqual(original);
    expect(f.model.coordinator.getSnapshot()).toMatchObject({
      replayPending: true,
      conflict: true,
      uncertain: false,
      dirty: false,
    });
    expect(f.model.canEdit()).toBe(false);
    f.setStored({ version: 4, payload: original.payload });
    await f.model.coordinator.load();
    f.model.coordinator.useSaved();
    expect(f.model.coordinator.getSnapshot().baseVersion).toBe(4);
    expect(f.model.canSavePayload()).toBe(false);
    expect(f.api.resolve).toHaveBeenCalledTimes(1);
  });

  it("does not accept an altered receipt and retains the original command for reconciliation", async () => {
    const f = fixture(ledger([]));
    await f.model.coordinator.load();
    f.model.replace(f.current(), f.initialized());
    f.api.savePortfolio.mockResolvedValueOnce({
      version: 2,
      payload: {
        ...ledger([]),
        opening: { ...ledger().opening, cashUsd: "999" },
      },
      replayed: false,
    });
    await f.model.coordinator.save();
    expect(f.model.coordinator.getSnapshot().uncertain).toBe(true);
    expect(f.initialized().opening.cashUsd).toBe("1000.00");
    expect(f.api.savePortfolio).toHaveBeenCalledTimes(1);
  });

  it.each(["load", "save", "resolve"] as const)(
    "retires once when %s is unauthenticated, and clears all local portfolio state",
    async (action) => {
      const f = fixture(ledger());
      if (action === "load")
        f.api.loadPortfolio.mockRejectedValueOnce(
          new TrialApiError("unauthenticated"),
        );
      await f.model.coordinator.load();
      if (action === "resolve") {
        f.api.resolve.mockRejectedValueOnce(
          new TrialApiError("unauthenticated"),
        );
        await f.model.reviewCatalog();
      }
      if (action === "save") {
        await f.model.reviewCatalog();
        f.model.applyReview();
        f.api.savePortfolio.mockRejectedValueOnce(
          new TrialApiError("unauthenticated"),
        );
        await f.model.coordinator.save();
      }
      expect(f.model.coordinator.getSnapshot().phase).toBe("retired");
      expect(f.model.coordinator.getSnapshot().draft).toBeNull();
      expect(f.model.getSnapshot()).toEqual({
        catalogSnapshotSha256: null,
        pendingEditor: false,
        reviewing: false,
        review: null,
        message: "",
      });
      f.model.retire();
      expect(f.onRetire).toHaveBeenCalledTimes(1);
      expect(f.session.signOut).not.toHaveBeenCalled();
    },
  );

  it("fences late load/save completions after session retirement", async () => {
    const load = fixture();
    const heldLoad = deferred<ManagedPortfolioDto>();
    load.api.loadPortfolio.mockReturnValueOnce(heldLoad.promise);
    const loading = load.model.coordinator.load();
    load.model.retire();
    expect(load.api.loadPortfolio.mock.calls[0]![0].aborted).toBe(true);
    heldLoad.resolve({ version: 1, payload: ledger() });
    await loading;
    expect(load.model.coordinator.getSnapshot().draft).toBeNull();
    const save = fixture(ledger([]));
    await save.model.coordinator.load();
    save.model.replace(save.current(), save.initialized());
    const heldSave =
      deferred<Awaited<ReturnType<ManagedApi["savePortfolio"]>>>();
    save.api.savePortfolio.mockReturnValueOnce(heldSave.promise);
    const saving = save.model.coordinator.save();
    const [command, signal] = save.api.savePortfolio.mock.calls[0]!;
    save.model.retire();
    expect(signal.aborted).toBe(true);
    heldSave.resolve({ version: 2, payload: command.payload, replayed: false });
    await saving;
    expect(save.model.coordinator.getSnapshot().saved).toBeNull();
    expect(save.model.coordinator.getSnapshot().draft).toBeNull();
  });

  it("leaves independently dirty watchlist and follow-up drafts untouched and issues no cross-resource saves", async () => {
    const f = fixture();
    const watchlistPayload: MainWatchlistPayload = {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: digest,
      memberships: [{ ...listing(), note: "original" }],
    };
    const watchlistSave = vi.fn();
    const watchlist = new SaveCoordinator<MainWatchlistPayload>(
      {
        mode: "managed",
        empty: () => null,
        copy: (value) => structuredClone(value),
        capture: (value) => value,
        load: () => Promise.resolve({ version: 1, payload: watchlistPayload }),
        save: watchlistSave,
      },
      f.session,
      MANAGED_WATCHLIST_SAVE_COPY,
    );
    await watchlist.load();
    watchlist.replaceDraft({
      ...watchlistPayload,
      memberships: [{ ...listing(), note: "dirty watchlist" }],
    });
    const followupApi = {
      loadFollowups: vi.fn<ManagedApi["loadFollowups"]>().mockResolvedValue({
        version: 0,
        payload: { schemaVersion: 1, entries: [] },
      }),
      saveFollowups: vi.fn<ManagedApi["saveFollowups"]>(),
      resolve: f.api.resolve,
    };
    const followups = new ManagedResearchFollowups(followupApi, f.session, {
      getCreationContext: () => ({
        draft: watchlist.getSnapshot().draft,
        catalogSnapshotSha256: digest,
      }),
      onRetire: vi.fn(),
      newEntryId: () => "00000000-0000-4000-8000-000000000001",
    });
    await followups.coordinator.load();
    followups.add(
      watchlist.getSnapshot().draft!.memberships[0]!,
      "invalid raw date",
    );
    const watchlistDraft = watchlist.getSnapshot().draft;
    const followupsDraft = followups.coordinator.getSnapshot().draft;
    await f.model.coordinator.load();
    f.model.start("2026-10-01", null);
    await f.model.coordinator.save();
    expect(watchlist.getSnapshot().draft).toBe(watchlistDraft);
    expect(watchlist.getSnapshot().dirty).toBe(true);
    expect(followups.coordinator.getSnapshot().draft).toBe(followupsDraft);
    expect(followups.coordinator.getSnapshot().dirty).toBe(true);
    expect(watchlistSave).not.toHaveBeenCalled();
    expect(followupApi.saveFollowups).not.toHaveBeenCalled();
    expect(f.api.resolve).not.toHaveBeenCalled();
    expect(f.api.loadPortfolio).toHaveBeenCalledTimes(1);
    expect(f.api.savePortfolio).toHaveBeenCalledTimes(1);
  });
});

describe("portfolio unapplied editor lifetime", () => {
  it("warns through a stable session resource without fabricating ledger dirtiness or loading over raw input", async () => {
    const f = fixture(ledger([]));
    const resource = f.model.sessionResource;
    const unloaded = resource.getSnapshot();
    expect(resource.getSnapshot()).toBe(unloaded);
    expect(resourceNeedsLeaveReview(unloaded)).toBe(false);
    await f.model.coordinator.load();
    const draft = f.current();
    const changed = vi.fn();
    const unsubscribe = resource.subscribe(changed);
    f.model.setPendingEditor(draft, true);
    expect(resource).toBe(f.model.sessionResource);
    expect(resource.getSnapshot()).toBe(resource.getSnapshot());
    expect(resourceNeedsLeaveReview(resource.getSnapshot())).toBe(true);
    expect(resource.getSnapshot().dirty).toBe(true);
    expect(f.model.coordinator.getSnapshot().dirty).toBe(false);
    expect(f.model.getSnapshot().pendingEditor).toBe(true);
    expect(f.current()).toBe(draft);
    expect(f.model.canSavePayload()).toBe(false);
    await f.model.coordinator.load();
    expect(f.api.loadPortfolio).toHaveBeenCalledTimes(1);
    expect(f.current()).toBe(draft);
    expect(f.model.getSnapshot().pendingEditor).toBe(true);
    expect(changed).toHaveBeenCalled();
    f.model.setPendingEditor(draft, false);
    expect(resourceNeedsLeaveReview(resource.getSnapshot())).toBe(false);
    expect(f.model.coordinator.getSnapshot().dirty).toBe(false);
    unsubscribe();
  });

  it("blocks fresh Save and identity operations while a form is pending, but explicit Apply replaces it", async () => {
    const f = fixture(ledger());
    await reviewed(f);
    const before = f.current();
    f.model.setPendingEditor(before, true);
    await f.model.coordinator.save();
    await f.model.register(listing(2));
    await f.model.reviewCatalog();
    f.model.applyReview();
    expect(f.current()).toBe(before);
    expect(f.api.savePortfolio).not.toHaveBeenCalled();
    expect(f.api.resolve).toHaveBeenCalledTimes(1);
    f.model.replace(before, traded(f.initialized()));
    expect(f.model.getSnapshot().pendingEditor).toBe(false);
    expect(f.model.canSavePayload()).toBe(true);
    await f.model.coordinator.save();
    expect(f.api.savePortfolio).toHaveBeenCalledTimes(1);
  });

  it("rejects stale false/true callbacks after Apply and keeps the replacement editor warning", async () => {
    const f = fixture(ledger([]));
    await f.model.coordinator.load();
    const old = f.current();
    f.model.setPendingEditor(old, true);
    f.model.replace(old, f.initialized());
    const current = f.current();
    expect(f.model.getSnapshot().pendingEditor).toBe(false);
    f.model.setPendingEditor(old, true);
    expect(f.model.getSnapshot().pendingEditor).toBe(false);
    f.model.setPendingEditor(current, true);
    f.model.setPendingEditor(old, false);
    expect(f.model.getSnapshot().pendingEditor).toBe(true);
    f.model.setPendingEditor(current, false);
    expect(f.model.getSnapshot().pendingEditor).toBe(false);
    expect(f.model.sessionResource.getSnapshot().dirty).toBe(true);
  });

  it("allows explicit Start or Use saved to settle the matching editor without preserving a stale warning", async () => {
    const f = fixture();
    await f.model.coordinator.load();
    const uninitialized = f.current();
    f.model.setPendingEditor(uninitialized, true);
    f.model.start("2026-10-01", null);
    expect(f.model.getSnapshot().pendingEditor).toBe(false);
    expect(f.current().ledger).not.toBeNull();
    const started = f.current();
    f.model.setPendingEditor(started, true);
    f.model.coordinator.useSaved();
    expect(f.current()).toEqual({ ledger: null });
    expect(f.model.getSnapshot().pendingEditor).toBe(false);
    f.model.setPendingEditor(started, true);
    expect(
      resourceNeedsLeaveReview(f.model.sessionResource.getSnapshot()),
    ).toBe(false);
    expect(f.model.coordinator.getSnapshot().dirty).toBe(false);
  });

  it("aborts an outstanding identity check when raw form editing begins and fences its late result", async () => {
    const f = fixture(ledger());
    await f.model.coordinator.load();
    const held = deferred<ManagedCatalogResolveResponse>();
    f.api.resolve.mockReturnValueOnce(held.promise);
    const pending = f.model.reviewCatalog();
    const [request, signal] = f.api.resolve.mock.calls[0]!;
    const current = f.current();
    f.model.setPendingEditor(current, true);
    expect(signal.aborted).toBe(true);
    held.resolve(resolution(request));
    await pending;
    expect(f.model.getSnapshot().review).toBeNull();
    expect(f.model.getSnapshot().pendingEditor).toBe(true);
    expect(f.current()).toBe(current);
    f.model.cancelReview();
    expect(f.model.getSnapshot().pendingEditor).toBe(true);
    expect(
      resourceNeedsLeaveReview(f.model.sessionResource.getSnapshot()),
    ).toBe(true);
  });

  it("rejects editor callbacks during uncertain/replay recovery and clears warnings on resource retirement", async () => {
    const f = fixture(ledger([]));
    await f.model.coordinator.load();
    f.model.replace(f.current(), f.initialized());
    f.api.savePortfolio.mockRejectedValueOnce(
      new TrialApiError("commit_unknown"),
    );
    await f.model.coordinator.save();
    f.model.setPendingEditor(f.current(), true);
    expect(f.model.getSnapshot().pendingEditor).toBe(false);
    const command = f.api.savePortfolio.mock.calls[0]![0];
    f.api.savePortfolio.mockResolvedValueOnce({
      version: 2,
      payload: command.payload,
      replayed: true,
    });
    await f.model.coordinator.reconcile();
    f.model.setPendingEditor(f.current(), true);
    expect(f.model.getSnapshot().pendingEditor).toBe(false);
    f.setStored({ version: 2, payload: command.payload });
    await f.model.coordinator.load();
    f.model.coordinator.useSaved();
    const current = f.current();
    f.model.setPendingEditor(current, true);
    expect(
      resourceNeedsLeaveReview(f.model.sessionResource.getSnapshot()),
    ).toBe(true);
    f.model.sessionResource.retire("Aggregate session ended.");
    expect(f.model.sessionResource.getSnapshot()).toMatchObject({
      phase: "retired",
      dirty: false,
      draft: null,
      message: "Aggregate session ended.",
    });
    expect(f.model.getSnapshot().pendingEditor).toBe(false);
    f.model.setPendingEditor(current, true);
    expect(
      resourceNeedsLeaveReview(f.model.sessionResource.getSnapshot()),
    ).toBe(false);
    expect(f.onRetire).toHaveBeenCalledTimes(1);
    expect(f.session.signOut).not.toHaveBeenCalled();
  });
});
