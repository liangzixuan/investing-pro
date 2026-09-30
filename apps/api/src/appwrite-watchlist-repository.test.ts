import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { connect } from "node:net";

import type {
  MainWatchlistPayload,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import {
  MANAGED_SECURITY_MASTER_PROFILE,
  PERSONAL_SECURITY_MASTER_LIMITS,
  admitManagedSecurityMasterSnapshot,
  admitPersonalSecurityMasterSnapshot,
  lookupPersonalSecurityMasterListing,
  searchPersonalSecurityMaster,
} from "@research-cockpit/personal-security-master";
import { AppwriteException, Client, TablesDB } from "node-appwrite";
import { Agent } from "undici";
import { describe, expect, it, vi } from "vitest";

import { createAppwriteTransport } from "./appwrite-transport";
import {
  appwriteWatchlistStore,
  createAppwriteWatchlistRepository,
  type AppwriteWatchlistRepositoryOptions,
  type AppwriteWatchlistStore,
} from "./appwrite-watchlist-repository";
import {
  bindTestSecurityMasterDocument,
  buildMutableTestSecurityMasterDocument,
  buildTestSecurityMasterAdmission,
} from "./test-personal-security-master-builder";
import type { PutMainWatchlistCommand } from "./watchlist-repository";

const OWNER = { userId: "synthetic-owner" };
const OTHER = { userId: "synthetic-other" };
const TIME = "2026-09-28T21:00:00.000Z";
type Row = Record<string, unknown>;
type Operation = keyof AppwriteWatchlistStore;
type Input<K extends Operation> = Parameters<AppwriteWatchlistStore[K]>[0];
interface Transaction {
  base: Map<string, string | undefined>;
  rows: Map<string, Row>;
}

/** Atomic model: first staged write captures row state; commit verifies all bases. */
class AtomicStore implements AppwriteWatchlistStore {
  readonly rows = new Map<string, Row>();
  readonly transactions = new Map<string, Transaction>();
  readonly calls: { operation: Operation; input: unknown }[] = [];
  beforeIncrement: (() => Promise<void>) | undefined;
  beforeCommit: (() => Promise<void>) | undefined;
  beforeRead: (() => Promise<void>) | undefined;
  fail: { operation: Operation; error: unknown } | undefined;
  commitOutcome: "normal" | "lost-before" | "lost-after" | "malformed-after" =
    "normal";
  rollbackFails = false;
  private next = 0;

  private visit(operation: Operation, input: unknown) {
    this.calls.push({ operation, input: structuredClone(input) });
    if (this.fail?.operation === operation) {
      const error = this.fail.error;
      this.fail = undefined;
      throw error;
    }
  }
  private key(input: Input<"getRow">) {
    return JSON.stringify([input.databaseId, input.tableId, input.rowId]);
  }
  private stage(input: Input<"updateRow">): {
    tx: Transaction;
    key: string;
    row: Row | undefined;
  } {
    const tx = this.transactions.get(input.transactionId);
    if (tx === undefined) throw new Error("Missing transaction");
    const key = this.key(input);
    if (!tx.base.has(key)) tx.base.set(key, JSON.stringify(this.rows.get(key)));
    return {
      tx,
      key,
      row: structuredClone(tx.rows.get(key) ?? this.rows.get(key)),
    };
  }
  async getRow(input: Input<"getRow">) {
    this.visit("getRow", input);
    const hook = this.beforeRead;
    this.beforeRead = undefined;
    await hook?.();
    const row = this.rows.get(this.key(input));
    if (row === undefined)
      throw new AppwriteException(
        "Missing synthetic row",
        404,
        "row_not_found",
      );
    return structuredClone(row);
  }
  createTransaction(input: Input<"createTransaction">) {
    return Promise.resolve().then(() => {
      this.visit("createTransaction", input);
      if (!Number.isInteger(input.ttl) || input.ttl < 60 || input.ttl > 3600)
        throw new AppwriteException("Synthetic invalid transaction TTL", 400);
      const id = `transaction-${++this.next}`;
      this.transactions.set(id, { base: new Map(), rows: new Map() });
      return { $id: id, status: "pending" };
    });
  }
  createRow(input: Input<"createRow">) {
    return Promise.resolve().then(() => {
      this.visit("createRow", input);
      const { tx, key, row } = this.stage(input);
      if (row !== undefined)
        throw new AppwriteException("Synthetic duplicate", 409);
      const created = {
        ...input.data,
        $id: input.rowId,
        $databaseId: input.databaseId,
        $tableId: input.tableId,
        $sequence: "1",
        $createdAt: "2026-09-28T21:00:00.000000+00:00",
        $updatedAt: TIME,
        $permissions: input.permissions,
      };
      tx.rows.set(key, created);
      return structuredClone(created);
    });
  }
  updateRow(input: Input<"updateRow">) {
    return Promise.resolve().then(() => {
      this.visit("updateRow", input);
      const { tx, key, row } = this.stage(input);
      if (row === undefined)
        throw new AppwriteException("Synthetic missing", 404);
      const updated = { ...row, ...input.data };
      tx.rows.set(key, updated);
      return structuredClone(updated);
    });
  }
  async incrementRowColumn(input: Input<"incrementRowColumn">) {
    this.visit("incrementRowColumn", input);
    const hook = this.beforeIncrement;
    this.beforeIncrement = undefined;
    await hook?.();
    const { tx, key, row } = this.stage({ ...input, data: {} });
    if (row === undefined || typeof row.version !== "number")
      throw new Error("Invalid synthetic row");
    if (row.version + input.value > input.max)
      throw new AppwriteException("Synthetic maximum exceeded", 400);
    row.version += input.value;
    tx.rows.set(key, row);
    return structuredClone(row);
  }
  async updateTransaction(input: Input<"updateTransaction">) {
    this.visit("updateTransaction", input);
    const tx = this.transactions.get(input.transactionId);
    if (tx === undefined) throw new Error("Missing transaction");
    if (input.rollback) {
      if (this.rollbackFails) throw new Error("Synthetic rollback failure");
      this.transactions.delete(input.transactionId);
      return { $id: input.transactionId, status: "failed" };
    }
    const hook = this.beforeCommit;
    this.beforeCommit = undefined;
    await hook?.();
    if (this.commitOutcome === "lost-before")
      throw new Error("Synthetic transport lost before commit");
    for (const [key, base] of tx.base) {
      if (JSON.stringify(this.rows.get(key)) !== base)
        throw new AppwriteException("Synthetic write conflict", 409);
    }
    for (const [key, row] of tx.rows) this.rows.set(key, structuredClone(row));
    this.transactions.delete(input.transactionId);
    if (this.commitOutcome === "lost-after")
      throw new Error("Synthetic transport lost after commit");
    return {
      $id: input.transactionId,
      status:
        this.commitOutcome === "malformed-after" ? "committing" : "committed",
    };
  }
  current(userId = OWNER.userId): Row {
    const row = [...this.rows.values()].find(
      (entry) => entry.$tableId === "watchlists" && entry.ownerId === userId,
    );
    if (row === undefined) throw new Error("Missing synthetic current row");
    return row;
  }
  receipts() {
    return [...this.rows.values()].filter((row) => row.$tableId === "receipts");
  }
}

function managedCatalog(document = buildMutableTestSecurityMasterDocument(3)) {
  document.profile = MANAGED_SECURITY_MASTER_PROFILE;
  document.provenance.sourceLocator = `managed-composite-manifest:${String(document.provenance.sourceRevision)}`;
  Object.assign(document.sourcePolicyCompatibility, {
    cache: "permitted_managed",
    display: "permitted_managed",
    export: "permitted_with_attribution",
    localOnly: false,
    policyProfile: "personal_single_user_managed_connected",
    redistribution: "permitted_with_attribution",
    retention: "permitted_managed",
    rightsBasis: "reviewed_redistributable_source",
    search: "permitted_managed",
  });
  return admitManagedSecurityMasterSnapshot(
    bindTestSecurityMasterDocument(document),
  );
}

function membership(
  catalog: AppwriteWatchlistRepositoryOptions["catalog"],
  listingId: string,
): WatchlistMembership {
  const result = lookupPersonalSecurityMasterListing(catalog, listingId);
  if (result === null) throw new Error("Missing synthetic listing");
  return {
    country: result.country,
    exchangeMic: result.exchangeMic,
    instrumentType: result.instrumentType,
    issuerId: result.issuerId,
    issuerName: result.issuerName,
    listingId: result.listingId,
    note: "Invented note",
    securityId: result.securityId,
    securityName: result.securityName,
    shareClassId: result.shareClassId,
    shareClassName: result.shareClassName,
    symbol: result.symbol,
  };
}

function fixture(
  recordCount = 3,
  catalog: AppwriteWatchlistRepositoryOptions["catalog"] = admitPersonalSecurityMasterSnapshot(
    buildTestSecurityMasterAdmission(recordCount),
  ),
) {
  const memberships = [0, 1].map((index) =>
    membership(catalog, `lst-${String(index).padStart(5, "0")}`),
  );
  const payload: MainWatchlistPayload = {
    memberships,
    name: "My Watchlist",
    schemaVersion: 1,
    snapshotSha256: catalog.snapshotSha256,
  };
  const store = new AtomicStore();
  const options = {
    store,
    catalog,
    databaseId: "synthetic-db",
    watchlistsTableId: "watchlists",
    receiptsTableId: "receipts",
    now: () => new Date(TIME),
  };
  const repository = createAppwriteWatchlistRepository(options);
  const command = (
    expectedVersion = 0,
    suffix = "a",
    note = "Invented note",
  ): PutMainWatchlistCommand => ({
    expectedVersion,
    idempotencyKey: `synthetic-command-${suffix}`,
    payload: {
      ...payload,
      memberships: payload.memberships.map((member) => ({ ...member, note })),
    },
  });
  return { store, repository, command, options, payload };
}

describe("Appwrite main watchlist repository", () => {
  it("admits a managed listing beyond the same-symbol search result cap", async () => {
    const count = PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap + 1;
    const document = buildMutableTestSecurityMasterDocument(count);
    for (const [index, record] of document.records.entries()) {
      const listing = record.shareClasses[0]!.listings[0]!;
      listing.currentSymbol = "SAME";
      listing.exchangeMic = `X${String(index).padStart(3, "0")}`;
      for (const period of listing.tickerHistory)
        if (period.validTo === null) period.symbol = "SAME";
    }
    const catalog = managedCatalog(document);
    const listingId = `lst-${String(count - 1).padStart(5, "0")}`;
    const capped = searchPersonalSecurityMaster(catalog, {
      query: "SAME",
      limit: PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap,
    });
    expect(capped.results).toHaveLength(count - 1);
    expect(capped.results.some((entry) => entry.listingId === listingId)).toBe(
      false,
    );
    const { repository, command } = fixture(count, catalog);
    const input = {
      ...command(),
      payload: {
        ...command().payload,
        memberships: [membership(catalog, listingId)],
      },
    };
    expect(await repository.put(OWNER, input)).toMatchObject({
      version: 1,
      replayed: false,
    });
    expect((await repository.get(OWNER))?.payload).toEqual(input.payload);
  });

  it.each([
    ["country", "CA"],
    ["exchangeMic", "XNYS"],
    ["instrumentType", "common_stock"],
    ["issuerId", "iss-forged"],
    ["issuerName", "Forged issuer"],
    ["listingId", "lst-missing"],
    ["securityId", "sec-forged"],
    ["securityName", "Forged security"],
    ["shareClassId", "shr-forged"],
    ["shareClassName", "Forged class"],
    ["symbol", "FORGED"],
  ] as const)(
    "rejects a changed current managed %s on write and read",
    async (field, value) => {
      const { repository, store, command } = fixture(3, managedCatalog());
      await repository.put(OWNER, command());
      const input = structuredClone(command(1, "forged"));
      Object.assign(input.payload.memberships[0]!, { [field]: value });
      const before = store.calls.length;
      await expect(repository.put(OWNER, input)).rejects.toMatchObject({
        code: "invalid_request",
      });
      expect(store.calls.slice(before).map((call) => call.operation)).toEqual(
        field === "country" ? [] : ["getRow"],
      );
      const row = store.current();
      const payload = JSON.parse(
        row.payloadJson as string,
      ) as MainWatchlistPayload;
      Object.assign(payload.memberships[0]!, { [field]: value });
      row.payloadJson = JSON.stringify(payload);
      row.digestSha256 = createHash("sha256")
        .update(row.payloadJson as string)
        .digest("hex");
      await expect(repository.get(OWNER)).rejects.toMatchObject({
        code: "invalid_response",
      });
      expect(row.version).toBe(1);
      expect(store.receipts()).toHaveLength(1);
    },
  );

  it("reads and replays a historical managed command whose listings are absent from the current catalog", async () => {
    const { repository, store, command, options } = fixture(
      3,
      managedCatalog(),
    );
    const original = await repository.put(OWNER, command());
    const document = buildMutableTestSecurityMasterDocument(3);
    for (const record of document.records) {
      const listing = record.shareClasses[0]!.listings[0]!;
      const previousId = listing.listingId;
      listing.listingId = `${String(previousId)}-current`;
      for (const period of listing.tickerHistory)
        period.listingId = listing.listingId;
      for (const mapping of document.providerMappings)
        if (
          mapping.mappingKind === "listing" &&
          mapping.targetId === previousId
        )
          mapping.targetId = listing.listingId;
    }
    const currentCatalog = managedCatalog(document);
    for (const entry of command().payload.memberships)
      expect(
        lookupPersonalSecurityMasterListing(currentCatalog, entry.listingId),
      ).toBeNull();
    const changed = createAppwriteWatchlistRepository({
      ...options,
      catalog: currentCatalog,
    });
    expect((await changed.get(OWNER))?.payload).toEqual(command().payload);
    const beforeReplay = store.calls.length;
    expect(await changed.put(OWNER, command())).toEqual({
      ...original,
      replayed: true,
    });
    expect(
      store.calls.slice(beforeReplay).map((call) => call.operation),
    ).toEqual(["getRow"]);
    const beforeStale = store.calls.length;
    await expect(changed.put(OWNER, command(1, "stale"))).rejects.toMatchObject(
      { code: "invalid_request" },
    );
    expect(
      store.calls.slice(beforeStale).map((call) => call.operation),
    ).toEqual(["getRow"]);
    const currentCommand = {
      ...command(1, "current"),
      payload: {
        ...command().payload,
        snapshotSha256: currentCatalog.snapshotSha256,
        memberships: [membership(currentCatalog, "lst-00000-current")],
      },
    };
    expect(await changed.put(OWNER, currentCommand)).toMatchObject({
      version: 2,
      replayed: false,
    });
    expect(await changed.put(OWNER, command())).toEqual({
      ...original,
      replayed: true,
    });
    expect((await changed.get(OWNER))?.payload).toEqual(currentCommand.payload);
  });

  it("replays a valid receipt before current listing admission while still validating the command", async () => {
    const { repository, store, command } = fixture(3, managedCatalog());
    const original = await repository.put(OWNER, command());
    const lookup = vi.spyOn(
      await import("@research-cockpit/personal-security-master"),
      "lookupPersonalSecurityMasterListing",
    );
    try {
      const before = store.calls.length;
      expect(await repository.put(OWNER, command())).toEqual({
        ...original,
        replayed: true,
      });
      expect(lookup).not.toHaveBeenCalled();
      expect(store.calls.slice(before).map((call) => call.operation)).toEqual([
        "getRow",
      ]);
      const malformed = {
        ...command(),
        payload: { ...command().payload, extra: "invalid" },
      };
      const beforeInvalid = store.calls.length;
      await expect(repository.put(OWNER, malformed)).rejects.toMatchObject({
        code: "invalid_request",
      });
      expect(store.calls).toHaveLength(beforeInvalid);
      expect(lookup).not.toHaveBeenCalled();
      for (const listingId of ["lst-missing", "x"]) {
        const input = structuredClone(command(1, listingId));
        Object.assign(input.payload.memberships[0]!, { listingId });
        await expect(repository.put(OWNER, input)).rejects.toMatchObject({
          code: "invalid_request",
        });
      }
      expect(lookup).toHaveBeenCalledTimes(2);
      expect(store.current().version).toBe(1);
      expect(store.receipts()).toHaveLength(1);
    } finally {
      lookup.mockRestore();
    }
  });

  it("keeps absence distinct, commits current row and receipt atomically, and preserves order", async () => {
    const { store, repository, command } = fixture();
    expect(await repository.get(OWNER)).toBeNull();
    const first = await repository.put(OWNER, command());
    expect(first).toMatchObject({
      id: "main",
      version: 1,
      replayed: false,
      committedAt: TIME,
    });
    expect(await repository.get(OWNER)).toMatchObject({
      version: 1,
      payload: command().payload,
    });
    const next = await repository.put(OWNER, command(1, "b", "Changed"));
    expect(next.version).toBe(2);
    expect(store.receipts()).toHaveLength(2);
    expect(
      store.calls.filter((call) => call.operation === "incrementRowColumn"),
    ).toMatchObject([{ input: { value: 1, max: 2, column: "version" } }]);
    expect(
      store.calls.filter((call) => call.operation === "updateRow"),
    ).toHaveLength(1);
    for (const call of store.calls.filter(
      (entry) => entry.operation === "updateRow",
    ))
      expect((call.input as Input<"updateRow">).data).not.toHaveProperty(
        "version",
      );
  });

  it("replays the original receipt even after a later write and rejects key reuse", async () => {
    const { store, repository, command } = fixture();
    const original = await repository.put(OWNER, command());
    await repository.put(OWNER, command(1, "b", "Later"));
    const before = store.calls.length;
    expect(await repository.put(OWNER, command())).toEqual({
      ...original,
      replayed: true,
    });
    expect(store.calls.slice(before).map((call) => call.operation)).toEqual([
      "getRow",
    ]);
    await expect(
      repository.put(OWNER, command(0, "a", "Different")),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    expect(store.current().version).toBe(2);
  });

  it("allows only one competing creation, with no losing receipt", async () => {
    const { store, repository, command } = fixture();
    store.beforeCommit = async () => {
      await repository.put(OWNER, command(0, "winner", "Winner"));
    };
    await expect(
      repository.put(OWNER, command(0, "loser", "Loser")),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(store.current().version).toBe(1);
    expect(store.receipts()).toHaveLength(1);
    expect((await repository.get(OWNER))?.payload.memberships[0]?.note).toBe(
      "Winner",
    );
  });

  it("resolves competing identical commands through the committed receipt", async () => {
    const { store, repository, command } = fixture();
    store.beforeCommit = async () => {
      await repository.put(OWNER, command());
    };
    expect(await repository.put(OWNER, command())).toMatchObject({
      version: 1,
      replayed: true,
    });
    expect(store.receipts()).toHaveLength(1);
  });

  it("resolves identical commands when the late increment hits its maximum", async () => {
    const { store, repository, command } = fixture();
    await repository.put(OWNER, command());
    store.beforeIncrement = async () => {
      await repository.put(OWNER, command(1, "same"));
    };
    expect(await repository.put(OWNER, command(1, "same"))).toMatchObject({
      version: 2,
      replayed: true,
    });
    expect(store.current().version).toBe(2);
    expect(store.receipts()).toHaveLength(2);
  });

  it("resolves a same-key commit between the first receipt and current-row reads", async () => {
    const { store, repository, command } = fixture();
    store.beforeRead = () => {
      store.beforeRead = async () => {
        await repository.put(OWNER, command());
      };
      return Promise.resolve();
    };
    expect(await repository.put(OWNER, command())).toMatchObject({
      version: 1,
      replayed: true,
    });
    expect(store.receipts()).toHaveLength(1);
  });

  it("reports a validated idempotency conflict when a competing different command wins", async () => {
    const { store, repository, command } = fixture();
    store.beforeCommit = async () => {
      await repository.put(OWNER, command(0, "same", "Winner"));
    };
    await expect(
      repository.put(OWNER, command(0, "same", "Loser")),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    expect(store.receipts()).toHaveLength(1);
    expect((await repository.get(OWNER))?.payload.memberships[0]?.note).toBe(
      "Winner",
    );
  });

  it("resolves an uncertain old-catalog command after the configured catalog changes", async () => {
    const { store, repository, command, options } = fixture();
    store.commitOutcome = "lost-after";
    await expect(repository.put(OWNER, command())).rejects.toMatchObject({
      code: "commit_unknown",
    });
    const changedCatalog = admitPersonalSecurityMasterSnapshot(
      buildTestSecurityMasterAdmission(4),
    );
    expect(changedCatalog.snapshotSha256).not.toBe(
      options.catalog.snapshotSha256,
    );
    const changed = createAppwriteWatchlistRepository({
      ...options,
      catalog: changedCatalog,
    });
    expect(await changed.put(OWNER, command())).toMatchObject({
      version: 1,
      replayed: true,
    });
    await expect(changed.put(OWNER, command(1, "new"))).rejects.toMatchObject({
      code: "invalid_request",
    });
    expect(store.current().version).toBe(1);
  });

  it.each(["before-stage", "after-stage"])(
    "rejects an intervening update %s without overwriting its payload",
    async (phase) => {
      const { store, repository, command } = fixture();
      await repository.put(OWNER, command());
      const winner = async () => {
        await repository.put(OWNER, command(1, "winner", "Winner"));
      };
      if (phase === "before-stage") store.beforeIncrement = winner;
      else store.beforeCommit = winner;
      await expect(
        repository.put(OWNER, command(1, "loser", "Loser")),
      ).rejects.toMatchObject({ code: "conflict" });
      expect(store.current().version).toBe(2);
      expect(store.receipts()).toHaveLength(2);
      expect((await repository.get(OWNER))?.payload.memberships[0]?.note).toBe(
        "Winner",
      );
    },
  );

  it("rejects stale expected versions before opening a transaction", async () => {
    const { store, repository, command } = fixture();
    await repository.put(OWNER, command());
    const start = store.calls.length;
    await expect(
      repository.put(OWNER, command(0, "stale")),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(
      store.calls.slice(start).every((call) => call.operation === "getRow"),
    ).toBe(true);
  });

  it.each(["updateRow", "createRow"] as const)(
    "rolls back staged state when %s fails",
    async (operation) => {
      const { store, repository, command } = fixture();
      await repository.put(OWNER, command());
      store.fail = {
        operation,
        error: new Error("Synthetic secret must not escape"),
      };
      await expect(
        repository.put(OWNER, command(1, "fail")),
      ).rejects.toMatchObject({ code: "unavailable", message: "unavailable" });
      expect(store.current().version).toBe(1);
      expect(store.receipts()).toHaveLength(1);
      expect(store.calls.at(-1)).toMatchObject({
        operation: "updateTransaction",
        input: { rollback: true },
      });
      expect(store.transactions.size).toBe(0);
    },
  );

  it("preserves the finite stage error if rollback also fails", async () => {
    const { store, repository, command } = fixture();
    store.fail = {
      operation: "createRow",
      error: new AppwriteException("Private upstream text", 403),
    };
    store.rollbackFails = true;
    await expect(repository.put(OWNER, command())).rejects.toMatchObject({
      code: "access_denied",
      message: "access_denied",
    });
    expect(store.rows.size).toBe(0);
  });

  it.each(["lost-after", "malformed-after"] as const)(
    "reports %s as uncertain, then recovers the original receipt without another commit",
    async (outcome) => {
      const { store, repository, command } = fixture();
      store.commitOutcome = outcome;
      await expect(repository.put(OWNER, command())).rejects.toMatchObject({
        code: "commit_unknown",
      });
      expect(
        store.calls.filter(
          (call) => (call.input as Input<"updateTransaction">).rollback,
        ),
      ).toHaveLength(0);
      expect(store.current().version).toBe(1);
      const before = store.calls.length;
      expect(await repository.put(OWNER, command())).toMatchObject({
        version: 1,
        replayed: true,
      });
      expect(store.calls.slice(before).map((call) => call.operation)).toEqual([
        "getRow",
      ]);
    },
  );

  it("reports a truncated native commit response as unknown without rollback or retry", async () => {
    const { options, command } = fixture();
    const endpoint = "https://appwrite.example.invalid/v1";
    const transactionId = "synthetic-interrupted-commit";
    const rowsPath = `/v1/tablesdb/${options.databaseId}/tables`;
    const transactionPath = "/v1/tablesdb/transactions";
    const calls: { method: string; path: string; body: string }[] = [];
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => {
        body += chunk;
      });
      request.on("end", () => {
        calls.push({ method: request.method!, path: request.url!, body });
        if (calls.length === 6) {
          response.socket!.end(
            'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{"status":',
          );
          return;
        }
        response.setHeader("content-type", "application/json");
        response.statusCode =
          calls.length <= 2 ? 404 : calls.length <= 5 ? 201 : 500;
        response.end(
          JSON.stringify(
            calls.length <= 2
              ? { message: "Missing invented row", type: "row_not_found" }
              : calls.length === 3
                ? { $id: transactionId, status: "pending" }
                : {},
          ),
        );
      });
    });
    let dispatcher: Agent | undefined;
    let transport: ReturnType<typeof createAppwriteTransport> | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => resolve());
      });
      const address = server.address();
      if (address === null || typeof address === "string")
        throw new Error("Missing synthetic server address");
      dispatcher = new Agent({
        allowH2: false,
        pipelining: 0,
        // Only this test maps the fixed synthetic HTTPS host to a local socket.
        connect: (target, callback) => {
          if (
            target.hostname !== "appwrite.example.invalid" ||
            target.protocol !== "https:"
          ) {
            callback(new Error("Unexpected synthetic target"), null);
            return;
          }
          const socket = connect({ host: "127.0.0.1", port: address.port });
          const onError = (error: Error) => callback(error, null);
          socket.once("error", onError);
          socket.once("connect", () => {
            socket.off("error", onError);
            callback(null, socket);
          });
        },
      });
      transport = createAppwriteTransport({ endpoint, dispatcher });
      const repository = createAppwriteWatchlistRepository({
        ...options,
        store: appwriteWatchlistStore(new TablesDB(transport.client)),
      });
      await expect(repository.put(OWNER, command())).rejects.toMatchObject({
        code: "commit_unknown",
        message: "commit_unknown",
      });
      expect(calls.map(({ method }) => method)).toEqual([
        "GET",
        "GET",
        "POST",
        "POST",
        "POST",
        "PATCH",
      ]);
      expect(calls[0]!.path).toMatch(
        new RegExp(`^${rowsPath}/receipts/rows/r[a-f0-9]{32}$`, "u"),
      );
      expect(calls[1]!.path).toMatch(
        new RegExp(`^${rowsPath}/watchlists/rows/w[a-f0-9]{32}$`, "u"),
      );
      expect(calls.slice(2).map(({ path }) => path)).toEqual([
        transactionPath,
        `${rowsPath}/watchlists/rows`,
        `${rowsPath}/receipts/rows`,
        `${transactionPath}/${transactionId}`,
      ]);
      expect(calls.slice(0, 2).map(({ body }) => body)).toEqual(["", ""]);
      expect(JSON.parse(calls[2]!.body)).toEqual({ ttl: 60 });
      for (const [write, read] of [
        [3, 1],
        [4, 0],
      ] as const) {
        expect(JSON.parse(calls[write]!.body)).toMatchObject({
          rowId: calls[read]!.path.split("/").at(-1),
          permissions: [],
          transactionId,
          data: { ownerId: OWNER.userId, watchlistId: "main", version: 1 },
        });
      }
      expect(JSON.parse(calls[5]!.body)).toEqual({ commit: true });
      expect(transport.snapshot()).toEqual({
        requests: 6,
        lastStatus: 200,
        closed: false,
      });
    } finally {
      try {
        if (transport) await transport.close();
        else await dispatcher?.destroy();
      } finally {
        server.closeAllConnections();
        if (server.listening)
          await new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          );
      }
    }
  });

  it("does not roll back an uncertain in-flight commit; same-key resubmission has one winner", async () => {
    const { store, repository, command } = fixture();
    store.commitOutcome = "lost-before";
    await expect(repository.put(OWNER, command())).rejects.toMatchObject({
      code: "commit_unknown",
    });
    expect(store.rows.size).toBe(0);
    const oldTransaction = [...store.transactions.keys()][0]!;
    store.commitOutcome = "normal";
    await repository.put(OWNER, command());
    await expect(
      store.updateTransaction({ transactionId: oldTransaction, commit: true }),
    ).rejects.toMatchObject({ code: 409 });
    expect(store.receipts()).toHaveLength(1);
    expect(store.current().version).toBe(1);
  });

  it("reconciles a typed commit-time limit with an observed advance and never retries or rolls back", async () => {
    const { store, repository, command } = fixture();
    await repository.put(OWNER, command());
    const before = store.calls.length;
    store.beforeCommit = async () => {
      await repository.put(OWNER, command(1, "winner", "Winner"));
      throw new AppwriteException(
        "Private response",
        400,
        "attribute_limit_exceeded",
      );
    };
    await expect(
      repository.put(OWNER, command(1, "loser")),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(store.current().version).toBe(2);
    expect(store.receipts()).toHaveLength(2);
    expect(
      store.calls
        .slice(before)
        .filter((call) => (call.input as Input<"updateTransaction">).rollback),
    ).toHaveLength(0);
    expect(store.calls.slice(-2).map((call) => call.operation)).toEqual([
      "getRow",
      "getRow",
    ]);
  });

  it.each([false, true])(
    "reconciles a typed commit limit against the exact same-key receipt (changed=%s)",
    async (changed) => {
      const { store, repository, command } = fixture();
      await repository.put(OWNER, command());
      const input = command(1, "same", "Draft");
      store.beforeCommit = async () => {
        await repository.put(
          OWNER,
          changed ? command(1, "same", "Other") : input,
        );
        throw new AppwriteException(
          "Private response",
          400,
          "attribute_limit_exceeded",
        );
      };
      const result = repository.put(OWNER, input);
      if (changed)
        await expect(result).rejects.toMatchObject({
          code: "idempotency_conflict",
        });
      else
        await expect(result).resolves.toMatchObject({
          version: 2,
          replayed: true,
        });
      expect(store.receipts()).toHaveLength(2);
    },
  );

  it.each(["no_advance", "receipt_unreadable", "current_unreadable"] as const)(
    "retains commit_unknown for a typed limit with %s",
    async (condition) => {
      const { store, repository, command } = fixture();
      await repository.put(OWNER, command());
      store.beforeCommit = () => {
        const failRead = () => {
          store.fail = {
            operation: "getRow",
            error: new AppwriteException("Private response", 503),
          };
        };
        if (condition === "receipt_unreadable") failRead();
        if (condition === "current_unreadable")
          store.beforeRead = () => {
            failRead();
            return Promise.resolve();
          };
        throw new AppwriteException(
          "Private response",
          400,
          "attribute_limit_exceeded",
        );
      };
      await expect(
        repository.put(OWNER, command(1, "loser")),
      ).rejects.toMatchObject({ code: "commit_unknown" });
      expect(store.current().version).toBe(1);
      expect(store.receipts()).toHaveLength(1);
      expect(
        store.calls.filter(
          (call) => (call.input as Input<"updateTransaction">).rollback,
        ),
      ).toHaveLength(0);
    },
  );

  it.each(["request_failed", "general_argument_invalid", "other"])(
    "keeps commit400/%s unknown even when another writer advanced",
    async (type) => {
      const { store, repository, command } = fixture();
      await repository.put(OWNER, command());
      store.beforeCommit = async () => {
        await repository.put(OWNER, command(1, "winner"));
        throw new AppwriteException("Private response", 400, type);
      };
      await expect(
        repository.put(OWNER, command(1, "loser")),
      ).rejects.toMatchObject({ code: "commit_unknown" });
      expect(store.current().version).toBe(2);
    },
  );

  it("does not misclassify an unrelated increment 400 as a version conflict", async () => {
    const { store, repository, command } = fixture();
    await repository.put(OWNER, command());
    store.fail = {
      operation: "incrementRowColumn",
      error: new AppwriteException("Wrong schema", 400),
    };
    await expect(
      repository.put(OWNER, command(1, "invalid")),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(store.current().version).toBe(1);
  });

  it.each([
    "database_not_found",
    "table_not_found",
    "general_route_not_found",
    "",
  ])("does not treat %s 404 as an absent watchlist", async (type) => {
    const { store, repository, command } = fixture();
    store.fail = {
      operation: "getRow",
      error: new AppwriteException(
        "Synthetic configuration failure",
        404,
        type,
      ),
    };
    await expect(repository.put(OWNER, command())).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(store.calls.map((call) => call.operation)).toEqual(["getRow"]);
  });

  it("isolates principals using opaque deterministic IDs and rejects a returned other-owner row", async () => {
    const { store, repository, command } = fixture();
    await repository.put(OWNER, command());
    expect(await repository.get(OTHER)).toBeNull();
    await repository.put(OTHER, command());
    expect(store.rows.size).toBe(4);
    for (const row of store.rows.values()) {
      expect(row.$id).toMatch(/^[wr][0-9a-f]{32}$/u);
      expect(String(row.$id)).not.toContain("synthetic");
    }
    store.current().ownerId = OTHER.userId;
    await expect(repository.get(OWNER)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("captures the payload and command before the first await", async () => {
    const { store, repository, command } = fixture();
    const input = structuredClone(command());
    store.beforeRead = () => {
      Object.assign(input, {
        expectedVersion: 5,
        idempotencyKey: "changed-command-key",
      });
      Object.assign(input.payload.memberships[0]!, {
        note: "Mutated after admission",
      });
      return Promise.resolve();
    };
    await repository.put(OWNER, input);
    expect(store.current().version).toBe(1);
    expect((await repository.get(OWNER))?.payload.memberships[0]?.note).toBe(
      "Invented note",
    );
  });

  it.each([
    ["negative version", { expectedVersion: -1 }],
    ["unsafe version", { expectedVersion: Number.MAX_SAFE_INTEGER }],
    ["fractional version", { expectedVersion: 1.5 }],
    ["short key", { idempotencyKey: "short" }],
    ["owner in body", { ownerId: "forged-owner" }],
  ])("rejects %s before IO", async (_name, changes) => {
    const { store, repository, command } = fixture();
    await expect(
      repository.put(OWNER, { ...command(), ...changes }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(store.calls).toHaveLength(0);
  });

  it.each(["snapshot", "identity", "duplicate", "extra", "oversize"])(
    "rejects %s payload before mutation",
    async (kind) => {
      const { store, repository, command } = fixture();
      const input = structuredClone(command());
      if (kind === "snapshot")
        Object.assign(input.payload, {
          snapshotSha256: `sha256:${"0".repeat(64)}`,
        });
      if (kind === "identity")
        Object.assign(input.payload.memberships[0]!, {
          issuerName: "Forged issuer",
        });
      if (kind === "duplicate")
        Object.assign(input.payload, {
          memberships: [
            input.payload.memberships[0],
            input.payload.memberships[0],
          ],
        });
      if (kind === "extra")
        Object.assign(input.payload, { ownerId: OTHER.userId });
      if (kind === "oversize")
        Object.assign(input.payload.memberships[0]!, {
          note: "x".repeat(2001),
        });
      await expect(repository.put(OWNER, input)).rejects.toMatchObject({
        code: "invalid_request",
      });
      expect(store.calls.map((call) => call.operation)).toEqual(
        kind === "snapshot" || kind === "identity" ? ["getRow"] : [],
      );
    },
  );

  it.each([
    "payload",
    "digest",
    "version",
    "table",
    "row",
    "permissions",
    "extra",
    "time",
    "metadata-time",
  ])("rejects malformed stored %s", async (kind) => {
    const { store, repository, command } = fixture();
    await repository.put(OWNER, command());
    const row = store.current();
    if (kind === "payload") row.payloadJson = "{";
    if (kind === "digest") row.digestSha256 = "0".repeat(64);
    if (kind === "version") row.version = Number.MAX_SAFE_INTEGER + 1;
    if (kind === "table") row.$tableId = "foreign";
    if (kind === "row") row.$id = "foreign";
    if (kind === "permissions") row.$permissions = ['read("any")'];
    if (kind === "extra") row.extra = "unknown";
    if (kind === "time") row.updatedAt = "2026-02-30T21:00:00.000Z";
    if (kind === "metadata-time")
      row.$createdAt = "2026-02-30T21:00:00.000000+00:00";
    await expect(repository.get(OWNER)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("rejects digest-valid forged current identities but retains a valid older snapshot for reconciliation", async () => {
    const { store, repository, command } = fixture();
    await repository.put(OWNER, command());
    const row = store.current();
    const payload = JSON.parse(
      row.payloadJson as string,
    ) as MainWatchlistPayload;
    Object.assign(payload.memberships[0]!, {
      issuerName: "Changed old identity",
    });
    row.payloadJson = JSON.stringify(payload);
    row.digestSha256 = createHash("sha256")
      .update(row.payloadJson as string)
      .digest("hex");
    await expect(repository.get(OWNER)).rejects.toMatchObject({
      code: "invalid_response",
    });
    Object.assign(payload, { snapshotSha256: `sha256:${"0".repeat(64)}` });
    row.payloadJson = JSON.stringify(payload);
    row.digestSha256 = createHash("sha256")
      .update(row.payloadJson as string)
      .digest("hex");
    expect((await repository.get(OWNER))?.payload.snapshotSha256).toBe(
      payload.snapshotSha256,
    );
  });

  it.each(["ownerId", "keyDigest", "digestSha256", "version"])(
    "rejects forged receipt %s",
    async (field) => {
      const { store, repository, command } = fixture();
      await repository.put(OWNER, command());
      store.receipts()[0]![field] = "invalid";
      await expect(repository.put(OWNER, command())).rejects.toMatchObject({
        code: "invalid_response",
      });
    },
  );

  it.each(["version", "digestSha256"])(
    "rejects shape-valid but wrong receipt %s",
    async (field) => {
      const { store, repository, command } = fixture();
      await repository.put(OWNER, command());
      store.receipts()[0]![field] = field === "version" ? 2 : "0".repeat(64);
      await expect(repository.put(OWNER, command())).rejects.toMatchObject({
        code: "invalid_response",
      });
    },
  );

  it("enforces the byte bound before IO even for an otherwise valid large watchlist", async () => {
    const { store, repository, command, options } = fixture(150);
    const members = Array.from({ length: 150 }, (_, index) => {
      const result = searchPersonalSecurityMaster(options.catalog, {
        query: `S${String(index).padStart(5, "0")}`,
        limit: 1,
      }).results[0]!;
      return { ...result, note: "x".repeat(2000) };
    });
    const sample = command();
    const memberships = members.map((result) => ({
      ...sample.payload.memberships[0]!,
      country: result.country,
      exchangeMic: result.exchangeMic,
      instrumentType: result.instrumentType,
      issuerId: result.issuerId,
      issuerName: result.issuerName,
      listingId: result.listingId,
      note: result.note,
      securityId: result.securityId,
      securityName: result.securityName,
      shareClassId: result.shareClassId,
      shareClassName: result.shareClassName,
      symbol: result.symbol,
    }));
    await expect(
      repository.put(OWNER, {
        ...sample,
        payload: { ...sample.payload, memberships },
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(store.calls).toHaveLength(0);
  });

  it("validates fixed configuration and principal before IO", async () => {
    const { store, repository, command, options } = fixture();
    expect(() =>
      createAppwriteWatchlistRepository({
        ...options,
        receiptsTableId: "watchlists",
      }),
    ).toThrow("invalid_request");
    expect(() =>
      createAppwriteWatchlistRepository({ ...options, databaseId: "../other" }),
    ).toThrow("invalid_request");
    await expect(
      repository.put({ userId: "../owner" }, command()),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(store.calls).toHaveLength(0);
  });

  it("uses the installed SDK object API without retries or implicit client construction", async () => {
    const client = new Client()
      .setEndpoint("https://synthetic.invalid/v1")
      .setProject("synthetic");
    const call = vi
      .spyOn(client, "call")
      .mockResolvedValue({ $id: "synthetic", status: "pending" });
    const adapter = appwriteWatchlistStore(new TablesDB(client));
    await adapter.createTransaction({ ttl: 60 });
    await adapter.incrementRowColumn({
      databaseId: "db",
      tableId: "table",
      rowId: "row",
      transactionId: "tx",
      column: "version",
      value: 1,
      max: 2,
    });
    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[1]?.[3]).toMatchObject({
      value: 1,
      max: 2,
      transactionId: "tx",
    });
    call.mockRestore();
  });
});
