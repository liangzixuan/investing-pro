import type { AppwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import {
  MANAGED_WATCHLIST_PATH,
  parseManagedCatalogStatus,
  parseManagedWatchlistCommand,
  type MainWatchlistPayload,
  type ManagedWatchlistCommand,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import {
  MANAGED_SECURITY_MASTER_PROFILE,
  admitManagedSecurityMasterSnapshot,
  lookupPersonalSecurityMasterListing,
} from "@research-cockpit/personal-security-master";
import { AppwriteException } from "node-appwrite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createManagedApi } from "../../web/src/clerk-trial/managed-api";
import { ManagedWorkspace } from "../../web/src/clerk-trial/managed-workspace";
import type { TrialSession } from "../../web/src/clerk-trial/session";
import { createAppwriteWatchlistRepository } from "./appwrite-watchlist-repository";
import {
  createManagedWorkspaceHandler,
  MANAGED_WORKSPACE_ORIGIN,
} from "./managed-workspace-handler";
import {
  bindTestSecurityMasterDocument,
  buildMutableTestSecurityMasterDocument,
} from "./test-personal-security-master-builder";

const OWNER = { userId: "invented-recovery-owner" };
const TIME = "2026-10-11T12:00:00.000Z";
const FIRST = "lst-00000";
const SECOND = "lst-00001";
type Row = Record<string, unknown>;
type Input<K extends keyof AppwriteVersionedRowStore> = Parameters<
  AppwriteVersionedRowStore[K]
>[0];
interface Transaction {
  readonly bases: Map<string, string | undefined>;
  readonly rows: Map<string, Row>;
}

/** TablesDB storage only. Production code owns payloads, versions and receipts. */
class AtomicRows implements AppwriteVersionedRowStore {
  readonly rows = new Map<string, Row>();
  readonly transactions = new Map<string, Transaction>();
  failNextRead = false;
  private nextId = 0;

  private key(input: Input<"getRow">) {
    return JSON.stringify([input.databaseId, input.tableId, input.rowId]);
  }
  private stage(input: Input<"updateRow">) {
    const transaction = this.transactions.get(input.transactionId);
    if (!transaction) throw new Error("Missing invented transaction");
    const key = this.key(input);
    if (!transaction.bases.has(key))
      transaction.bases.set(key, JSON.stringify(this.rows.get(key)));
    return {
      transaction,
      key,
      row: structuredClone(transaction.rows.get(key) ?? this.rows.get(key)),
    };
  }
  getRow(input: Input<"getRow">) {
    if (this.failNextRead) {
      this.failNextRead = false;
      return Promise.reject(new Error("Controlled storage read failure"));
    }
    const row = this.rows.get(this.key(input));
    return row
      ? Promise.resolve(structuredClone(row))
      : Promise.reject(
          new AppwriteException("Invented missing row", 404, "row_not_found"),
        );
  }
  createTransaction(input: Input<"createTransaction">) {
    expect(input.ttl).toBe(60);
    const id = `invented-transaction-${++this.nextId}`;
    this.transactions.set(id, { bases: new Map(), rows: new Map() });
    return Promise.resolve({ $id: id, status: "pending" });
  }
  createRow(input: Input<"createRow">) {
    const { transaction, key, row } = this.stage(input);
    if (row) return Promise.reject(new AppwriteException("Duplicate", 409));
    const created = {
      ...input.data,
      $id: input.rowId,
      $databaseId: input.databaseId,
      $tableId: input.tableId,
      $sequence: "1",
      $createdAt: TIME,
      $updatedAt: TIME,
      $permissions: [...input.permissions],
    };
    transaction.rows.set(key, created);
    return Promise.resolve(structuredClone(created));
  }
  updateRow(input: Input<"updateRow">) {
    const { transaction, key, row } = this.stage(input);
    if (!row) return Promise.reject(new AppwriteException("Missing", 404));
    const updated = { ...row, ...input.data };
    transaction.rows.set(key, updated);
    return Promise.resolve(structuredClone(updated));
  }
  incrementRowColumn(input: Input<"incrementRowColumn">) {
    const { transaction, key, row } = this.stage({ ...input, data: {} });
    if (!row || typeof row.version !== "number")
      return Promise.reject(new Error("Invalid invented version row"));
    const version = row.version + input.value;
    if (version > input.max)
      return Promise.reject(new AppwriteException("Maximum exceeded", 400));
    const updated = { ...row, version };
    transaction.rows.set(key, updated);
    return Promise.resolve(structuredClone(updated));
  }
  updateTransaction(input: Input<"updateTransaction">) {
    const transaction = this.transactions.get(input.transactionId);
    if (!transaction) throw new Error("Missing invented transaction");
    if (input.rollback) {
      this.transactions.delete(input.transactionId);
      return Promise.resolve({ $id: input.transactionId, status: "failed" });
    }
    expect(input.commit).toBe(true);
    for (const [key, base] of transaction.bases)
      if (JSON.stringify(this.rows.get(key)) !== base)
        return Promise.reject(new AppwriteException("Write conflict", 409));
    for (const [key, row] of transaction.rows)
      this.rows.set(key, structuredClone(row));
    this.transactions.delete(input.transactionId);
    return Promise.resolve({ $id: input.transactionId, status: "committed" });
  }
  receiptVersions() {
    return [...this.rows.values()]
      .filter((row) => row.$tableId === "receipts")
      .map((row) => row.version);
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of workspaces.splice(0)) workspace.coordinator.retire();
  vi.restoreAllMocks();
});

async function fixture() {
  const document = buildMutableTestSecurityMasterDocument(2);
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
  const catalog = admitManagedSecurityMasterSnapshot(
    bindTestSecurityMasterDocument(document),
  );
  const status = parseManagedCatalogStatus({
    snapshot: {
      schemaVersion: catalog.schemaVersion,
      profile: catalog.profile,
      snapshotSha256: catalog.snapshotSha256,
      catalogId: catalog.catalogId,
      catalogVersion: catalog.catalogVersion,
      asOf: catalog.asOf,
      generatedAt: catalog.generatedAt,
      acquiredAt: catalog.provenance.acquiredAt,
      contentKind: catalog.provenance.contentKind,
      attribution: catalog.provenance.attribution,
      coverage: catalog.coverage,
      sources: [],
      excludedCandidates: [],
    },
  });
  if (!status) throw new Error("Invalid invented catalog status");
  const snapshot = status.snapshot;
  const memberships = [FIRST, SECOND].map((listingId): WatchlistMembership => {
    const found = lookupPersonalSecurityMasterListing(catalog, listingId);
    if (!found) throw new Error("Missing invented listing");
    return {
      country: found.country,
      exchangeMic: found.exchangeMic,
      instrumentType: found.instrumentType,
      issuerId: found.issuerId,
      issuerName: found.issuerName,
      listingId: found.listingId,
      note: `Saved invented note for ${listingId}`,
      securityId: found.securityId,
      securityName: found.securityName,
      shareClassId: found.shareClassId,
      shareClassName: found.shareClassName,
      symbol: found.symbol,
    };
  });
  const payload: MainWatchlistPayload = {
    name: "My Watchlist",
    schemaVersion: 1,
    snapshotSha256: catalog.snapshotSha256,
    memberships,
  };
  const store = new AtomicRows();
  const repository = createAppwriteWatchlistRepository({
    store,
    catalog,
    databaseId: "invented-recovery",
    watchlistsTableId: "watchlists",
    receiptsTableId: "receipts",
    now: () => new Date(TIME),
  });
  await repository.put(OWNER, {
    expectedVersion: 0,
    idempotencyKey: "invented-seed-command",
    payload,
  });
  const accepted = new Set<string>();
  const close = vi.fn(() => Promise.resolve());
  const openRepository = vi.fn(() => Promise.resolve({ repository, close }));
  const handler = createManagedWorkspaceHandler({
    // Controlled admission, without Clerk credentials or SDK/network claims.
    auth: (request) =>
      Promise.resolve(
        accepted.has(request.headers.get("authorization") ?? "")
          ? { status: "allowed", principal: OWNER }
          : { status: "unauthenticated" },
      ),
    catalog: {
      status: () => status,
      search: () => {
        throw new Error("Unexpected search in recovery acceptance");
      },
      resolve: () => {
        throw new Error("Unexpected catalog resolve in recovery acceptance");
      },
    },
    openRepository,
    openFollowupsRepository: () =>
      Promise.reject(new Error("Unexpected follow-up resource")),
  });
  const requests: {
    session: string;
    method: string;
    path: string;
    status: number;
  }[] = [];
  const commands: { session: string; command: ManagedWatchlistCommand }[] = [];
  async function client(id: string) {
    const authorization = `Bearer invented.${id}.signature`;
    accepted.add(authorization);
    let tokenAvailable = true;
    let nextResponse: "drop" | ReturnType<typeof responseHold> | null = null;
    const session: TrialSession = {
      userId: "invented-owner",
      sessionId: id,
      getToken: vi.fn(() =>
        Promise.resolve(tokenAvailable ? authorization.slice(7) : null),
      ),
      signOut: vi.fn(() => {
        accepted.delete(authorization);
        return Promise.resolve();
      }),
    };
    const fetcher: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("origin", MANAGED_WORKSPACE_ORIGIN);
      const request = new Request(input, { ...init, headers });
      const path = new URL(request.url).pathname;
      const writing =
        request.method === "POST" && path === MANAGED_WATCHLIST_PATH;
      const policy = writing ? nextResponse : null;
      if (writing) {
        nextResponse = null;
        const command = parseManagedWatchlistCommand(
          await request.clone().json(),
        );
        if (!command) throw new Error("Invalid captured client command");
        commands.push({ session: id, command });
      }
      const response = await handler(request);
      requests.push({
        session: id,
        method: request.method,
        path,
        status: response.status,
      });
      if (policy) {
        expect(response.status).toBe(200);
        if (policy === "drop") {
          await response.body?.cancel();
          throw new TypeError("Controlled loss after committed response");
        }
        policy.received.resolve(response.status);
        await policy.released.promise;
        policy.delivered.resolve(response.status);
      }
      return response;
    };
    const api = createManagedApi(
      "https://recovery.example.invalid",
      session,
      fetcher,
    );
    let commandNumber = 0;
    const workspace = new ManagedWorkspace(
      api,
      session,
      () => `invented-${id}-command-${++commandNumber}`,
    );
    workspaces.push(workspace);
    workspace.setView("watchlist");
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    expect(workspace.coordinator.getSnapshot().phase).toBe("idle");
    expect(workspace.getSnapshot().snapshot).toEqual(snapshot);
    return {
      workspace,
      session,
      expire() {
        accepted.delete(authorization);
      },
      loseToken() {
        tokenAvailable = false;
      },
      loseNextSaveResponse() {
        nextResponse = "drop";
      },
      holdNextSaveResponse() {
        const hold = responseHold();
        nextResponse = hold;
        return hold;
      },
    };
  }
  return {
    client,
    store,
    repository,
    requests,
    commands,
    openRepository,
    close,
    payload,
  };
}

function responseHold() {
  return {
    received: deferred<number>(),
    released: deferred<void>(),
    delivered: deferred<number>(),
  };
}

describe("managed recovery through client, handler and watchlist repository", () => {
  it("retains a stale session's exact draft through failed reads and requires a fresh read and explicit whole-version choice", async () => {
    const f = await fixture();
    const a = (await f.client("session-a")).workspace;
    const b = (await f.client("session-b")).workspace;
    a.note(FIRST, "Session A saved note");
    a.move(SECOND, -1);
    b.note(SECOND, "Session B retained note");
    const retained = structuredClone(b.coordinator.getSnapshot().draft);
    await a.coordinator.save();
    const savedByA = (await f.repository.get(OWNER))!;
    expect(savedByA).toMatchObject({
      version: 2,
      payload: {
        memberships: [
          { listingId: SECOND },
          { listingId: FIRST, note: "Session A saved note" },
        ],
      },
    });
    await b.coordinator.save();
    expect(f.requests.at(-1)?.status).toBe(409);
    expect(b.coordinator.getSnapshot()).toMatchObject({
      conflict: true,
      uncertain: false,
      dirty: true,
      baseVersion: 1,
      draft: retained,
    });
    f.store.failNextRead = true;
    await b.coordinator.load();
    expect(b.coordinator.getSnapshot()).toMatchObject({
      latestLoaded: false,
      draft: retained,
      saved: { version: 1, payload: f.payload },
    });
    b.coordinator.keepDraft();
    b.coordinator.useSaved();
    await b.coordinator.save();
    expect(f.commands).toHaveLength(2);
    await b.coordinator.load();
    expect(b.coordinator.getSnapshot()).toMatchObject({
      latestLoaded: true,
      conflict: true,
      draft: retained,
      saved: { version: 2, payload: savedByA.payload },
    });
    f.store.failNextRead = true;
    await b.coordinator.load();
    b.coordinator.keepDraft();
    b.coordinator.useSaved();
    expect(b.coordinator.getSnapshot()).toMatchObject({
      latestLoaded: false,
      conflict: true,
      baseVersion: 1,
      draft: retained,
      saved: { version: 2, payload: savedByA.payload },
    });
    expect(f.commands).toHaveLength(2);
    await b.coordinator.load();
    b.coordinator.keepDraft();
    expect(f.commands).toHaveLength(2);
    expect(b.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 2,
      conflict: false,
      dirty: true,
      draft: retained,
    });
    await b.coordinator.save();
    expect(f.commands.map(({ command }) => command.expectedVersion)).toEqual([
      1, 1, 2,
    ]);
    expect(f.commands[2]!.command.idempotencyKey).not.toBe(
      f.commands[1]!.command.idempotencyKey,
    );
    expect(await f.repository.get(OWNER)).toMatchObject({
      version: 3,
      payload: retained,
    });
    expect(f.store.receiptVersions()).toEqual([1, 2, 3]);
    const fresh = (await f.client("session-fresh")).workspace;
    expect(fresh.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 3,
      dirty: false,
      draft: retained,
    });
    expect(f.close).toHaveBeenCalledTimes(f.openRepository.mock.calls.length);
  });

  it("replays the original lost version after another session saves a newer version, then uses the latest saved payload without a write", async () => {
    const f = await fixture();
    const a = await f.client("session-a");
    const b = (await f.client("session-b")).workspace;
    a.workspace.note(FIRST, "Committed before acknowledgement loss");
    const original = structuredClone(
      a.workspace.coordinator.getSnapshot().draft,
    );
    a.loseNextSaveResponse();
    await a.workspace.coordinator.save();
    expect(a.workspace.coordinator.getSnapshot()).toMatchObject({
      uncertain: true,
      draft: original,
    });
    expect(await f.repository.get(OWNER)).toMatchObject({
      version: 2,
      payload: original,
    });
    await b.coordinator.load();
    b.note(SECOND, "Newer session B note");
    b.move(SECOND, -1);
    await b.coordinator.save();
    const latest = (await f.repository.get(OWNER))!;
    expect(latest.version).toBe(3);
    await a.workspace.coordinator.reconcile();
    expect(f.commands[2]).toEqual(f.commands[0]);
    expect(a.workspace.coordinator.getSnapshot()).toMatchObject({
      uncertain: false,
      replayPending: true,
      conflict: true,
      baseVersion: 2,
      draft: original,
      saved: { version: 2, payload: original },
    });
    a.workspace.note(FIRST, "Blocked edit");
    await a.workspace.coordinator.save();
    a.workspace.coordinator.keepDraft();
    a.workspace.coordinator.useSaved();
    expect(f.commands).toHaveLength(3);
    expect(a.workspace.coordinator.getSnapshot().draft).toEqual(original);
    expect(await f.repository.get(OWNER)).toEqual(latest);
    expect(f.store.receiptVersions()).toEqual([1, 2, 3]);
    await a.workspace.coordinator.load();
    expect(a.workspace.coordinator.getSnapshot()).toMatchObject({
      replayPending: true,
      conflict: true,
      draft: original,
      saved: { version: 3, payload: latest.payload },
    });
    a.workspace.coordinator.useSaved();
    expect(a.workspace.coordinator.getSnapshot()).toMatchObject({
      replayPending: false,
      conflict: false,
      dirty: false,
      baseVersion: 3,
      draft: latest.payload,
    });
    expect(f.commands).toHaveLength(3);
    expect(await f.repository.get(OWNER)).toEqual(latest);
  });

  it.each(["save", "reconcile"] as const)(
    "retires an expired session during a held %s response and fences its late receipt while a fresh session reads the committed data",
    async (operation) => {
      const f = await fixture();
      const client = await f.client("session-expiring");
      const workspace = client.workspace;
      workspace.note(FIRST, "Committed before controlled expiry");
      workspace.move(SECOND, -1);
      const committed = structuredClone(
        workspace.coordinator.getSnapshot().draft,
      );
      if (operation === "reconcile") {
        client.loseNextSaveResponse();
        await workspace.coordinator.save();
        expect(workspace.coordinator.getSnapshot().uncertain).toBe(true);
      }
      const held = client.holdNextSaveResponse();
      const pending =
        operation === "save"
          ? workspace.coordinator.save()
          : workspace.coordinator.reconcile();
      await expect(held.received.promise).resolves.toBe(200);
      try {
        expect(workspace.coordinator.getSnapshot().phase).toBe(
          operation === "save" ? "saving" : "reconciling",
        );
        expect(await f.repository.get(OWNER)).toMatchObject({
          version: 2,
          payload: committed,
        });
        const openedBeforeExpiry = f.openRepository.mock.calls.length;
        client.expire();
        await workspace.refreshCatalog();
        expect(f.requests.at(-1)?.status).toBe(401);
        expect(f.openRepository).toHaveBeenCalledTimes(openedBeforeExpiry);
        await pending;
        const retired = workspace.coordinator.getSnapshot();
        expect(retired).toMatchObject({
          phase: "retired",
          draft: null,
          saved: null,
          uncertain: false,
        });
        expect(workspace.getSnapshot()).toMatchObject({
          snapshot: null,
          results: [],
          research: null,
          review: null,
        });
        expect(client.session.signOut).not.toHaveBeenCalled();
        const fresh = (await f.client("session-replacement")).workspace;
        expect(fresh.coordinator.getSnapshot()).toMatchObject({
          baseVersion: 2,
          dirty: false,
          draft: committed,
        });
        fresh.note(FIRST, "Fresh session draft stays local");
        const freshState = fresh.coordinator.getSnapshot();
        held.released.resolve();
        await expect(held.delivered.promise).resolves.toBe(200);
        await Promise.resolve();
        expect(workspace.coordinator.getSnapshot()).toBe(retired);
        expect(fresh.coordinator.getSnapshot()).toBe(freshState);
        await workspace.coordinator.save();
        await workspace.coordinator.reconcile();
        await workspace.coordinator.load();
        expect(f.commands).toHaveLength(operation === "save" ? 1 : 2);
        if (operation === "reconcile")
          expect(f.commands[1]).toEqual(f.commands[0]);
        expect(f.store.receiptVersions()).toEqual([1, 2]);
        expect(await f.repository.get(OWNER)).toMatchObject({
          version: 2,
          payload: committed,
        });
        expect(f.close).toHaveBeenCalledTimes(
          f.openRepository.mock.calls.length,
        );
      } finally {
        held.released.resolve();
        await pending;
      }
    },
  );

  it("clears an unsaved draft when the session has no token and reopens only saved data without dispatching the rejected write", async () => {
    const f = await fixture();
    const client = await f.client("session-token-ended");
    client.workspace.note(FIRST, "Unsaved draft that must retire");
    const requestsBefore = f.requests.length;
    client.loseToken();
    await client.workspace.coordinator.save();
    expect(client.workspace.coordinator.getSnapshot()).toMatchObject({
      phase: "retired",
      draft: null,
      saved: null,
    });
    expect(f.requests).toHaveLength(requestsBefore);
    expect(f.commands).toHaveLength(0);
    expect(await f.repository.get(OWNER)).toMatchObject({
      version: 1,
      payload: f.payload,
    });
    const fresh = (await f.client("session-new-token")).workspace;
    expect(fresh.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 1,
      dirty: false,
      draft: f.payload,
    });
    expect(f.store.receiptVersions()).toEqual([1]);
  });
});
