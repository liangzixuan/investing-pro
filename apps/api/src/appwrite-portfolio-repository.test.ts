import { createHash } from "node:crypto";
import {
  encodePortfolioPayload,
  type ManagedPortfolioPayload,
} from "@research-cockpit/contracts";
import {
  admitPersonalSecurityMasterSnapshot,
  lookupPersonalSecurityMasterListing,
  type PersonalSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";
import { AppwriteException, TablesDB } from "node-appwrite";
import { MockAgent } from "undici";
import { describe, expect, it, vi } from "vitest";
import { createAppwritePortfolioRepository } from "./appwrite-portfolio-repository";
import { createAppwriteWatchlistRepository } from "./appwrite-watchlist-repository";
import { createAppwriteResearchFollowupsRepository } from "./appwrite-research-followups-repository";
import { appwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import { createAppwriteTransport } from "./appwrite-transport";
import { AtomicStore, type Input } from "./test-appwrite-atomic-store";
import {
  bindTestSecurityMasterDocument,
  buildMutableTestSecurityMasterDocument,
  type MutableSecurityMasterDocument,
} from "./test-personal-security-master-builder";

const OWNER = { userId: "invented-portfolio-owner" };
const OTHER = { userId: "invented-portfolio-other" };
const TIME = "2026-10-16T12:00:00.000Z";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function catalog(change?: (value: MutableSecurityMasterDocument) => void) {
  const document = buildMutableTestSecurityMasterDocument(3);
  change?.(document);
  return admitPersonalSecurityMasterSnapshot(
    bindTestSecurityMasterDocument(document),
  );
}
function payload(
  current: PersonalSecurityMasterCatalog,
): ManagedPortfolioPayload {
  const listing = lookupPersonalSecurityMasterListing(current, "lst-00000");
  if (!listing) throw new Error("Missing invented listing");
  const {
    country,
    exchangeMic,
    instrumentType,
    issuerId,
    issuerName,
    listingId,
    securityId,
    securityName,
    shareClassId,
    shareClassName,
    symbol,
  } = listing;
  return {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: current.snapshotSha256,
    basisMethod: "fifo_with_opening_pool",
    identities: [
      {
        country,
        exchangeMic,
        instrumentType,
        issuerId,
        issuerName,
        listingId,
        securityId,
        securityName,
        shareClassId,
        shareClassName,
        symbol,
      },
    ],
    opening: {
      asOfDate: "2026-10-01",
      cashUsd: "1000.00",
      holdings: [
        {
          listingId,
          shares: "10.000000",
          totalCostBasisUsd: null,
          confirmedOn: "2026-10-01",
        },
      ],
    },
    transactions: [
      {
        id: "invented-buy",
        date: "2026-10-02",
        type: "buy",
        listingId,
        shares: "2",
        grossUsd: "100.00",
        feeUsd: "1.00",
      },
    ],
  };
}
function fixture(current = catalog()) {
  const store = new AtomicStore();
  let actualTime = TIME;
  const options = {
    store,
    databaseId: "invented-portfolio",
    portfoliosTableId: "portfolios",
    receiptsTableId: "receipts",
    catalog: current,
    now: () => new Date(actualTime),
  };
  const repository = createAppwritePortfolioRepository(options);
  const command = (
    expectedVersion = 0,
    key = "first",
    value = payload(current),
  ) => ({
    expectedVersion,
    idempotencyKey: `invented-portfolio-${key}`,
    payload: value,
  });
  return {
    store,
    options,
    repository,
    command,
    setTime(value: string) {
      actualTime = value;
    },
  };
}
function rowId(prefix: string, values: string[]) {
  return prefix + hash(JSON.stringify(values)).slice(0, 32);
}
function receiptRow(f: ReturnType<typeof fixture>, key: string) {
  return f.store.rows.get(
    JSON.stringify([
      f.options.databaseId,
      "receipts",
      rowId("r", [OWNER.userId, "portfolio", "main", key]),
    ]),
  );
}
function operations(f: ReturnType<typeof fixture>, start: number) {
  return f.store.calls.slice(start).map((call) => call.operation);
}

describe("Appwrite Portfolio repository", () => {
  it("keeps absence explicit, captures a full ledger and reopens exact canonical data", async () => {
    const f = fixture();
    expect(await f.repository.get(OWNER)).toBeNull();
    expect(f.store.rows.size).toBe(0);
    const input = f.command();
    const result = await f.repository.put(OWNER, input);
    expect(result).toEqual({
      id: "main",
      version: 1,
      replayed: false,
      digestSha256: hash(encodePortfolioPayload(input.payload)),
      committedAt: TIME,
    });
    const current = f.store.current(OWNER.userId, "portfolios");
    expect(current).toMatchObject({
      $id: rowId("p", [OWNER.userId, "portfolio", "main"]),
      ownerId: OWNER.userId,
      resourceId: "main",
      version: 1,
      $permissions: [],
      payloadJson: encodePortfolioPayload(input.payload),
      createdAt: TIME,
      updatedAt: TIME,
    });
    expect(receiptRow(f, input.idempotencyKey)).toMatchObject({
      requestDigest: hash(
        JSON.stringify({
          expectedVersion: 0,
          resource: "portfolio",
          id: "main",
          operation: "put",
          payloadSha256: result.digestSha256,
        }),
      ),
      version: 1,
      committedAt: TIME,
      $permissions: [],
    });
    const reopened = createAppwritePortfolioRepository(f.options);
    expect(await reopened.get(OWNER)).toEqual({
      id: "main",
      version: 1,
      payload: input.payload,
      createdAt: TIME,
      updatedAt: TIME,
    });
    expect(
      Object.isFrozen((await reopened.get(OWNER))?.payload.transactions),
    ).toBe(true);
  });

  it("separates all three resource namespaces and principals even in shared tables", async () => {
    const f = fixture(),
      current = f.options.catalog;
    const shared = { ...f.options, portfoliosTableId: "shared" };
    const portfolio = createAppwritePortfolioRepository(shared);
    const watchlist = createAppwriteWatchlistRepository({
      ...f.options,
      watchlistsTableId: "shared",
    });
    const followups = createAppwriteResearchFollowupsRepository({
      ...f.options,
      followupsTableId: "shared",
    });
    const input = f.command();
    await portfolio.put(OWNER, input);
    await portfolio.put(OTHER, input);
    await watchlist.put(OWNER, {
      ...input,
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: current.snapshotSha256,
        memberships: [],
      },
    });
    await followups.put(OWNER, {
      ...input,
      payload: { schemaVersion: 1, entries: [] },
    });
    expect(f.store.rows.size).toBe(8);
    const expected = [
      rowId("p", [OWNER.userId, "portfolio", "main"]),
      rowId("p", [OTHER.userId, "portfolio", "main"]),
      rowId("w", [OWNER.userId, "main"]),
      rowId("f", [OWNER.userId, "research-followups", "main"]),
    ];
    expect(
      [...f.store.rows.values()]
        .filter((row) => row.$tableId === "shared")
        .map((row) => row.$id)
        .sort(),
    ).toEqual(expected.sort());
    expect(await portfolio.get({ userId: "invented-absent-owner" })).toBeNull();
  });

  it("replays the exact receipt before a changed catalog/day or current version", async () => {
    const f = fixture(),
      original = f.command();
    const first = await f.repository.put(OWNER, original);
    await f.repository.put(OWNER, f.command(1, "second"));
    const changed = catalog((value) => {
      value.issuers[0]!.issuerName = "Reviewed Café 東京";
    });
    const later = createAppwritePortfolioRepository({
      ...f.options,
      catalog: changed,
      now: () => new Date("2000-01-01T00:00:00.000Z"),
    });
    const before = f.store.calls.length;
    expect(await later.put(OWNER, original)).toEqual({
      ...first,
      replayed: true,
    });
    expect(operations(f, before)).toEqual(["getRow"]);
    await expect(
      later.put(OWNER, {
        ...original,
        payload: {
          ...original.payload,
          opening: { ...original.payload.opening, cashUsd: "999" },
        },
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
  });

  it("keeps obsolete catalog history readable and only accepts exact reviewed metadata", async () => {
    const f = fixture(),
      original = f.command();
    await f.repository.put(OWNER, original);
    const changed = catalog((value) => {
      value.issuers[0]!.issuerName = "Reviewed Café 東京";
    });
    const repository = createAppwritePortfolioRepository({
      ...f.options,
      catalog: changed,
    });
    expect((await repository.get(OWNER))?.payload).toEqual(original.payload);
    const savedBefore = JSON.stringify([...f.store.rows]);
    await expect(
      repository.put(OWNER, f.command(1, "stale")),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(JSON.stringify([...f.store.rows])).toBe(savedBefore);
    const reviewed = payload(changed);
    await repository.put(OWNER, f.command(1, "reviewed", reviewed));
    expect((await repository.get(OWNER))?.payload).toEqual(reviewed);
    expect(reviewed.transactions).toEqual(original.payload.transactions);
    expect(reviewed.identities.map((value) => value.listingId)).toEqual(
      original.payload.identities.map((value) => value.listingId),
    );
  });

  it("refuses stable rebinding even when the new catalog admits the reused listing ID", async () => {
    const f = fixture();
    await f.repository.put(OWNER, f.command());
    const changed = catalog((value) => {
      value.records[0]!.shareClasses[0]!.listings[0]!.exchangeMic = "XNYS";
    });
    const repository = createAppwritePortfolioRepository({
      ...f.options,
      catalog: changed,
    });
    const before = f.store.calls.length;
    await expect(
      repository.put(OWNER, f.command(1, "rebound", payload(changed))),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(operations(f, before)).toEqual(["getRow", "getRow"]);
    expect(f.store.current(OWNER.userId, "portfolios").version).toBe(1);
  });

  it("retains an unsupported historical listing on read without clearing registry or transactions", async () => {
    const f = fixture();
    await f.repository.put(OWNER, f.command());
    const changed = catalog((value) => {
      const listing = value.records[0]!.shareClasses[0]!.listings[0]!;
      listing.listingId = "replacement-listing";
      for (const period of listing.tickerHistory)
        period.listingId = listing.listingId;
      for (const mapping of value.providerMappings)
        if (
          mapping.mappingKind === "listing" &&
          mapping.targetId === "lst-00000"
        )
          mapping.targetId = listing.listingId;
    });
    const repository = createAppwritePortfolioRepository({
      ...f.options,
      catalog: changed,
    });
    expect((await repository.get(OWNER))?.payload).toEqual(f.command().payload);
    const stale = {
      ...f.command().payload,
      snapshotSha256: changed.snapshotSha256,
    };
    await expect(
      repository.put(OWNER, f.command(1, "unsupported", stale)),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(
      JSON.parse(
        f.store.current(OWNER.userId, "portfolios").payloadJson as string,
      ),
    ).toEqual(f.command().payload);
  });

  it.each(["opening", "activity"] as const)(
    "refuses fresh future %s before TX but preserves historical reads/replay",
    async (kind) => {
      const f = fixture();
      f.setTime("2099-01-02T00:00:00.000Z");
      const future: ManagedPortfolioPayload =
        kind === "opening"
          ? {
              ...f.command().payload,
              opening: {
                ...f.command().payload.opening,
                asOfDate: "2099-01-01",
              },
              transactions: [],
            }
          : {
              ...f.command().payload,
              transactions: f.command().payload.transactions.map((row) => ({
                ...row,
                date: "2099-01-01",
              })),
            };
      const input = f.command(0, "future", future);
      await f.repository.put(OWNER, input);
      f.setTime(TIME);
      expect((await f.repository.get(OWNER))?.payload).toEqual(future);
      expect((await f.repository.put(OWNER, input)).replayed).toBe(true);
      const before = f.store.calls.length;
      await expect(f.repository.put(OTHER, input)).rejects.toMatchObject({
        code: "invalid_request",
      });
      expect(operations(f, before)).toEqual(["getRow", "getRow"]);
      await expect(
        f.repository.put(OWNER, f.command(1, "clock", future)),
      ).rejects.toMatchObject({ code: "unavailable" });
    },
  );

  it("captures the exact owned command before the first receipt read awaits", async () => {
    const f = fixture();
    const input = {
      ...f.command(),
      payload: {
        ...f.command().payload,
        opening: { ...f.command().payload.opening },
      },
    };
    const expected = structuredClone(input.payload);
    f.store.beforeRead = () => {
      input.expectedVersion = 9;
      input.idempotencyKey = "invented-mutated-command";
      input.payload.opening.cashUsd = "0";
      return Promise.resolve();
    };
    await f.repository.put(OWNER, input);
    expect((await f.repository.get(OWNER))?.payload).toEqual(expected);
  });

  it("rechecks receipt before a stale-version conflict without opening a TX", async () => {
    const f = fixture();
    await f.repository.put(OWNER, f.command());
    const before = f.store.calls.length;
    await expect(
      f.repository.put(OWNER, f.command(0, "stale")),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(operations(f, before)).toEqual(["getRow", "getRow", "getRow"]);
  });

  it.each([false, true])(
    "staging failure rolls back, preserving primary finite error (rollbackFails=%s)",
    async (rollbackFails) => {
      const f = fixture();
      f.store.rollbackFails = rollbackFails;
      f.store.fail = {
        operation: "createRow",
        error: new AppwriteException("Invented private detail", 403),
      };
      await expect(f.repository.put(OWNER, f.command())).rejects.toMatchObject({
        code: "access_denied",
        message: "access_denied",
      });
      expect(f.store.rows.size).toBe(0);
      expect(f.store.calls.at(-1)).toMatchObject({
        operation: "updateTransaction",
        input: { rollback: true },
      });
    },
  );

  it.each(["lost-before", "lost-after", "malformed-after"] as const)(
    "preserves %s commit uncertainty and reconciles only original command",
    async (outcome) => {
      const f = fixture(),
        input = f.command();
      f.store.commitOutcome = outcome;
      await expect(f.repository.put(OWNER, input)).rejects.toMatchObject({
        code: "commit_unknown",
      });
      expect(
        f.store.calls.filter(
          (call) => (call.input as Input<"updateTransaction">).rollback,
        ),
      ).toHaveLength(0);
      expect(
        f.store.calls.filter((call) => call.operation === "createTransaction"),
      ).toHaveLength(1);
      f.store.commitOutcome = "normal";
      const result = await f.repository.put(OWNER, input);
      expect(result.replayed).toBe(outcome !== "lost-before");
      expect(result.version).toBe(1);
      expect(f.store.receipts()).toHaveLength(1);
    },
  );

  it.each([400, 409])(
    "proves a competing winner and absent loser receipt for commit %i",
    async (code) => {
      const f = fixture();
      await f.repository.put(OWNER, f.command());
      const winner = f.command(1, "winner"),
        loser = f.command(1, "loser");
      f.store.beforeCommit = async () => {
        await f.repository.put(OWNER, winner);
        throw new AppwriteException(
          "Invented conflict",
          code,
          code === 400 ? "attribute_limit_exceeded" : "transaction_conflict",
        );
      };
      await expect(f.repository.put(OWNER, loser)).rejects.toMatchObject({
        code: "conflict",
      });
      expect(f.store.current(OWNER.userId, "portfolios").version).toBe(2);
      expect(receiptRow(f, winner.idempotencyKey)).toMatchObject({
        version: 2,
      });
      expect(receiptRow(f, loser.idempotencyKey)).toBeUndefined();
    },
  );

  it("resolves competing creation through one exact receipt and rejects changed-key reuse", async () => {
    const f = fixture(),
      input = f.command();
    const results = await Promise.all([
      f.repository.put(OWNER, input),
      f.repository.put(OWNER, input),
    ]);
    expect(results.map((value) => value.replayed).sort()).toEqual([
      false,
      true,
    ]);
    expect(f.store.receipts()).toHaveLength(1);
    await expect(
      f.repository.put(OWNER, { ...input, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
  });

  it.each(["ownerId", "$id", "$permissions", "digestSha256", "payloadJson"])(
    "refuses malformed stored %s",
    async (field) => {
      const f = fixture();
      await f.repository.put(OWNER, f.command());
      const row = f.store.current(OWNER.userId, "portfolios");
      row[field] = field === "$permissions" ? ['read("any")'] : "forged";
      await expect(f.repository.get(OWNER)).rejects.toMatchObject({
        code: "invalid_response",
      });
    },
  );

  it("rejects a digest-valid forged current-catalog identity and noncanonical stored bytes", async () => {
    const f = fixture();
    await f.repository.put(OWNER, f.command());
    const row = f.store.current(OWNER.userId, "portfolios");
    const forged = {
      ...f.command().payload,
      identities: f.command().payload.identities.map((identity) => ({
        ...identity,
        symbol: "FORGED",
      })),
    };
    row.payloadJson = encodePortfolioPayload(forged);
    row.digestSha256 = hash(row.payloadJson as string);
    await expect(f.repository.get(OWNER)).rejects.toMatchObject({
      code: "invalid_response",
    });
    row.payloadJson = JSON.stringify(f.command().payload, null, 2);
    row.digestSha256 = hash(row.payloadJson as string);
    await expect(f.repository.get(OWNER)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("validates principal/config and schema3 command before any storage read", async () => {
    const f = fixture();
    expect(() =>
      createAppwritePortfolioRepository({
        ...f.options,
        portfoliosTableId: "receipts",
      }),
    ).toThrow();
    await expect(f.repository.get({ userId: "../bad" })).rejects.toMatchObject({
      code: "invalid_request",
    });
    await expect(
      f.repository.put(OWNER, {
        ...f.command(),
        payload: { ...f.command().payload, schemaVersion: 2 },
      } as unknown as ReturnType<typeof f.command>),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(f.store.calls).toEqual([]);
  });

  it("uses the actual SDK object port and fixed row paths with six bounded dispatches", async () => {
    // The transport owns destroy(); Undici's mock implements close() instead.
    class OwnedMockAgent extends MockAgent {
      override destroy(): Promise<void> {
        return this.close();
      }
    }
    const f = fixture(),
      dispatcher = new OwnedMockAgent();
    dispatcher.disableNetConnect();
    const transport = createAppwriteTransport({
      endpoint: "https://portfolio.invalid/v1",
      dispatcher,
    });
    const sdkCall = vi.spyOn(transport.client, "call");
    const pool = dispatcher.get("https://portfolio.invalid"),
      paths: string[] = [];
    const base = "/v1/tablesdb/invented-portfolio/tables";
    const replies = [
      [
        "GET",
        `${base}/receipts/rows/${rowId("r", [OWNER.userId, "portfolio", "main", f.command().idempotencyKey])}`,
        404,
        { code: 404, type: "row_not_found", message: "Invented absent" },
      ],
      [
        "GET",
        `${base}/portfolios/rows/${rowId("p", [OWNER.userId, "portfolio", "main"])}`,
        404,
        { code: 404, type: "row_not_found", message: "Invented absent" },
      ],
      [
        "POST",
        "/v1/tablesdb/transactions",
        200,
        { $id: "invented-transaction", status: "pending" },
      ],
      ["POST", `${base}/portfolios/rows`, 200, {}],
      ["POST", `${base}/receipts/rows`, 200, {}],
      [
        "PATCH",
        "/v1/tablesdb/transactions/invented-transaction",
        200,
        { $id: "invented-transaction", status: "committed" },
      ],
    ] as const;
    for (const [method, path, status, body] of replies)
      pool.intercept({ method, path }).reply((request) => {
        paths.push(request.path);
        return {
          statusCode: status,
          data: body,
          responseOptions: { headers: { "content-type": "application/json" } },
        };
      });
    try {
      transport.client
        .setProject("invented-project")
        .setKey("invented-authority");
      const repository = createAppwritePortfolioRepository({
        ...f.options,
        store: appwriteVersionedRowStore(new TablesDB(transport.client)),
      });
      expect(await repository.put(OWNER, f.command())).toMatchObject({
        version: 1,
        replayed: false,
      });
      expect(paths).toEqual(replies.map((value) => value[1]));
      for (const index of [3, 4])
        expect(sdkCall.mock.calls[index]?.[3]).toMatchObject({
          permissions: [],
          transactionId: "invented-transaction",
          data: { ownerId: OWNER.userId, resourceId: "main", version: 1 },
        });
      expect(transport.snapshot().requests).toBe(6);
      dispatcher.assertNoPendingInterceptors();
    } finally {
      await transport.close();
      sdkCall.mockRestore();
    }
    expect(transport.snapshot().closed).toBe(true);
  });
});
