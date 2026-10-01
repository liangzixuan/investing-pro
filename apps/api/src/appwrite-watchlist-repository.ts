import { createHash } from "node:crypto";

import {
  isMainWatchlistPayload,
  membershipMatchesResult,
  type MainWatchlistPayload,
} from "@research-cockpit/contracts";
import {
  lookupPersonalSecurityMasterListing,
  type ManagedSecurityMasterCatalog,
  type PersonalSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";
import { AppwriteException, type TablesDB } from "node-appwrite";

import {
  WatchlistRepositoryError,
  type MainWatchlistReceipt,
  type MainWatchlistRecord,
  type MainWatchlistRepository,
  type PutMainWatchlistCommand,
  type WatchlistPrincipal,
} from "./watchlist-repository";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/u;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const MAX_PAYLOAD_BYTES = 256 * 1024;
const ROW_METADATA = [
  "$id",
  "$sequence",
  "$tableId",
  "$databaseId",
  "$createdAt",
  "$updatedAt",
  "$permissions",
] as const;

interface RowLocation {
  readonly databaseId: string;
  readonly tableId: string;
  readonly rowId: string;
}
type RowData = Readonly<Record<string, string | number>>;

/** Object-parameter subset of TablesDB 29, also used by the atomic test model. */
export interface AppwriteWatchlistStore {
  getRow(input: RowLocation): Promise<unknown>;
  createTransaction(input: { ttl: number }): Promise<unknown>;
  createRow(
    input: RowLocation & {
      data: RowData;
      permissions: string[];
      transactionId: string;
    },
  ): Promise<unknown>;
  updateRow(
    input: RowLocation & { data: RowData; transactionId: string },
  ): Promise<unknown>;
  incrementRowColumn(
    input: RowLocation & {
      column: "version";
      value: 1;
      max: number;
      transactionId: string;
    },
  ): Promise<unknown>;
  updateTransaction(input: {
    transactionId: string;
    commit?: boolean;
    rollback?: boolean;
  }): Promise<unknown>;
}

/** Client construction, credentials and transport lifetime belong to the server. */
export function appwriteWatchlistStore(
  tables: TablesDB,
): AppwriteWatchlistStore {
  return {
    getRow: (input) => tables.getRow(input),
    createTransaction: (input) => tables.createTransaction(input),
    createRow: (input) => tables.createRow(input),
    updateRow: (input) => tables.updateRow(input),
    incrementRowColumn: (input) => tables.incrementRowColumn(input),
    updateTransaction: (input) => tables.updateTransaction(input),
  };
}

export interface AppwriteWatchlistRepositoryOptions {
  readonly store: AppwriteWatchlistStore;
  readonly databaseId: string;
  readonly watchlistsTableId: string;
  readonly receiptsTableId: string;
  readonly catalog:
    PersonalSecurityMasterCatalog | ManagedSecurityMasterCatalog;
  readonly now?: () => Date;
}

interface StoredRecord extends MainWatchlistRecord {
  readonly digestSha256: string;
}

export function createAppwriteWatchlistRepository(
  options: AppwriteWatchlistRepositoryOptions,
): MainWatchlistRepository {
  const { store, databaseId, watchlistsTableId, receiptsTableId, catalog } =
    options;
  const now = options.now ?? (() => new Date());
  if (
    ![databaseId, watchlistsTableId, receiptsTableId].every((id) =>
      ID.test(id),
    ) ||
    watchlistsTableId === receiptsTableId
  ) {
    throw new WatchlistRepositoryError("invalid_request");
  }
  const location = (tableId: string, rowId: string): RowLocation => ({
    databaseId,
    tableId,
    rowId,
  });
  const currentLocation = (userId: string) =>
    location(watchlistsTableId, opaqueId("w", [userId, "main"]));
  const receiptLocation = (userId: string, key: string) =>
    location(receiptsTableId, opaqueId("r", [userId, "main", key]));

  async function readCurrent(userId: string): Promise<StoredRecord | null> {
    const target = currentLocation(userId);
    const row = await readOptional(store, target);
    if (row === null) return null;
    assertRow(row, target, [
      "ownerId",
      "watchlistId",
      "version",
      "payloadJson",
      "digestSha256",
      "createdAt",
      "updatedAt",
    ]);
    if (
      row.ownerId !== userId ||
      row.watchlistId !== "main" ||
      !positiveVersion(row.version) ||
      !date(row.createdAt) ||
      !date(row.updatedAt) ||
      row.createdAt > row.updatedAt ||
      typeof row.payloadJson !== "string" ||
      !digest(row.digestSha256) ||
      Buffer.byteLength(row.payloadJson, "utf8") > MAX_PAYLOAD_BYTES
    ) {
      throw new WatchlistRepositoryError("invalid_response");
    }
    let payload: unknown;
    try {
      payload = JSON.parse(row.payloadJson);
    } catch {
      throw new WatchlistRepositoryError("invalid_response");
    }
    if (
      !isMainWatchlistPayload(payload) ||
      encodePayload(payload) !== row.payloadJson ||
      hash(row.payloadJson) !== row.digestSha256 ||
      (payload.snapshotSha256 === catalog.snapshotSha256 &&
        !admitted(catalog, payload))
    ) {
      throw new WatchlistRepositoryError("invalid_response");
    }
    return {
      id: "main",
      version: row.version,
      payload,
      digestSha256: row.digestSha256,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async function replay(
    userId: string,
    key: string,
    requestDigest: string,
    expectedVersion: number,
    payloadDigest: string,
  ): Promise<MainWatchlistReceipt | null> {
    const target = receiptLocation(userId, key);
    const row = await readOptional(store, target);
    if (row === null) return null;
    assertRow(row, target, [
      "ownerId",
      "watchlistId",
      "keyDigest",
      "requestDigest",
      "version",
      "digestSha256",
      "committedAt",
    ]);
    if (
      row.ownerId !== userId ||
      row.watchlistId !== "main" ||
      row.keyDigest !== hash(key) ||
      !digest(row.requestDigest) ||
      !positiveVersion(row.version) ||
      !digest(row.digestSha256) ||
      !date(row.committedAt)
    ) {
      throw new WatchlistRepositoryError("invalid_response");
    }
    if (row.requestDigest !== requestDigest)
      throw new WatchlistRepositoryError("idempotency_conflict");
    if (
      row.version !== expectedVersion + 1 ||
      row.digestSha256 !== payloadDigest
    )
      throw new WatchlistRepositoryError("invalid_response");
    return {
      id: "main",
      version: row.version,
      digestSha256: row.digestSha256,
      committedAt: row.committedAt,
      replayed: true,
    };
  }

  return {
    async get(principal) {
      try {
        const record = await readCurrent(owner(principal));
        if (record === null) return null;
        return {
          id: record.id,
          version: record.version,
          payload: record.payload,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
      } catch (error) {
        throw safeError(error);
      }
    },
    async put(principal, command) {
      let transactionId: string | undefined;
      let commitStarted = false;
      let incrementRejected = false;
      let userId: string;
      let captured: ReturnType<typeof captureCommand>;
      try {
        userId = owner(principal);
        captured = captureCommand(command);
      } catch {
        throw new WatchlistRepositoryError("invalid_request");
      }
      const {
        expectedVersion,
        key,
        payloadJson,
        payloadDigest,
        requestDigest,
      } = captured;
      try {
        const previous = await replay(
          userId,
          key,
          requestDigest,
          expectedVersion,
          payloadDigest,
        );
        if (previous !== null) return previous;
        if (
          captured.payload.snapshotSha256 !== catalog.snapshotSha256 ||
          !admitted(catalog, captured.payload)
        )
          throw new WatchlistRepositoryError("invalid_request");
        const current = await readCurrent(userId);
        if ((current?.version ?? 0) !== expectedVersion) {
          const concurrent = await replay(
            userId,
            key,
            requestDigest,
            expectedVersion,
            payloadDigest,
          );
          if (concurrent !== null) return concurrent;
          throw new WatchlistRepositoryError("conflict");
        }
        const committedAt = now().toISOString();
        if (
          !date(committedAt) ||
          (current !== null && committedAt < current.updatedAt)
        )
          throw new WatchlistRepositoryError("unavailable");
        const transaction = await store.createTransaction({ ttl: 60 });
        if (
          !object(transaction) ||
          typeof transaction.$id !== "string" ||
          !ID.test(transaction.$id)
        )
          throw new WatchlistRepositoryError("invalid_response");
        transactionId = transaction.$id;
        if (transaction.status !== "pending")
          throw new WatchlistRepositoryError("invalid_response");
        const target = currentLocation(userId);
        if (expectedVersion === 0) {
          await store.createRow({
            ...target,
            transactionId,
            permissions: [],
            data: {
              ownerId: userId,
              watchlistId: "main",
              version: 1,
              payloadJson,
              digestSha256: payloadDigest,
              createdAt: committedAt,
              updatedAt: committedAt,
            },
          });
        } else {
          try {
            await store.incrementRowColumn({
              ...target,
              transactionId,
              column: "version",
              value: 1,
              max: expectedVersion + 1,
            });
          } catch (error) {
            incrementRejected =
              error instanceof AppwriteException && error.code === 400;
            throw error;
          }
          // The increment is the CAS guard. Assigning version here would erase it.
          await store.updateRow({
            ...target,
            transactionId,
            data: {
              payloadJson,
              digestSha256: payloadDigest,
              updatedAt: committedAt,
            },
          });
        }
        await store.createRow({
          ...receiptLocation(userId, key),
          transactionId,
          permissions: [],
          data: {
            ownerId: userId,
            watchlistId: "main",
            keyDigest: hash(key),
            requestDigest,
            version: expectedVersion + 1,
            digestSha256: payloadDigest,
            committedAt,
          },
        });
        commitStarted = true;
        const committed = await store.updateTransaction({
          transactionId,
          commit: true,
        });
        if (
          !object(committed) ||
          committed.$id !== transactionId ||
          committed.status !== "committed"
        )
          throw new WatchlistRepositoryError("commit_unknown");
        return {
          id: "main",
          version: expectedVersion + 1,
          digestSha256: payloadDigest,
          committedAt,
          replayed: false,
        };
      } catch (error) {
        // Once commit is dispatched, a timeout cannot prove whether it committed.
        if (transactionId !== undefined && !commitStarted) {
          try {
            await store.updateTransaction({ transactionId, rollback: true });
          } catch {
            /* A pending transaction expires; preserve the primary error. */
          }
        }
        if (error instanceof AppwriteException && error.code === 409) {
          const previous = await replay(
            userId,
            key,
            requestDigest,
            expectedVersion,
            payloadDigest,
          ).catch((readError: unknown) => {
            if (
              readError instanceof WatchlistRepositoryError &&
              readError.code === "idempotency_conflict"
            )
              throw readError;
            throw commitStarted
              ? new WatchlistRepositoryError("commit_unknown")
              : safeError(readError);
          });
          if (previous !== null) return previous;
          throw new WatchlistRepositoryError("conflict");
        }
        if (
          commitStarted &&
          error instanceof AppwriteException &&
          error.code === 400 &&
          error.type === "attribute_limit_exceeded"
        ) {
          const previous = await replay(
            userId,
            key,
            requestDigest,
            expectedVersion,
            payloadDigest,
          ).catch((readError: unknown) => {
            if (
              readError instanceof WatchlistRepositoryError &&
              readError.code === "idempotency_conflict"
            )
              throw readError;
            throw new WatchlistRepositoryError("commit_unknown");
          });
          if (previous !== null) return previous;
          const current = await readCurrent(userId).catch(() => {
            throw new WatchlistRepositoryError("commit_unknown");
          });
          if (current !== null && current.version > expectedVersion)
            throw new WatchlistRepositoryError("conflict");
          throw new WatchlistRepositoryError("commit_unknown");
        }
        if (incrementRejected) {
          // Appwrite 400 has several causes. Only an observed advance proves conflict.
          const previous = await replay(
            userId,
            key,
            requestDigest,
            expectedVersion,
            payloadDigest,
          ).catch((readError: unknown) => {
            throw safeError(readError);
          });
          if (previous !== null) return previous;
          const current = await readCurrent(userId).catch(
            (readError: unknown) => {
              throw safeError(readError);
            },
          );
          if (current !== null && current.version > expectedVersion)
            throw new WatchlistRepositoryError("conflict");
        }
        if (commitStarted) throw new WatchlistRepositoryError("commit_unknown");
        throw safeError(error);
      }
    },
  };
}

function owner(principal: WatchlistPrincipal): string {
  if (
    !object(principal) ||
    Object.keys(principal).length !== 1 ||
    typeof principal.userId !== "string" ||
    !ID.test(principal.userId)
  )
    throw new WatchlistRepositoryError("invalid_request");
  return principal.userId;
}

function captureCommand(command: PutMainWatchlistCommand) {
  if (
    !object(command) ||
    Object.keys(command).sort().join(",") !==
      "expectedVersion,idempotencyKey,payload" ||
    !Number.isSafeInteger(command.expectedVersion) ||
    command.expectedVersion < 0 ||
    command.expectedVersion >= Number.MAX_SAFE_INTEGER ||
    typeof command.idempotencyKey !== "string" ||
    !KEY.test(command.idempotencyKey) ||
    !isMainWatchlistPayload(command.payload)
  )
    throw new WatchlistRepositoryError("invalid_request");
  const payloadJson = encodePayload(command.payload);
  const payload: unknown = JSON.parse(payloadJson);
  if (
    Buffer.byteLength(payloadJson, "utf8") > MAX_PAYLOAD_BYTES ||
    !isMainWatchlistPayload(payload)
  )
    throw new WatchlistRepositoryError("invalid_request");
  const payloadDigest = hash(payloadJson);
  return {
    expectedVersion: command.expectedVersion,
    key: command.idempotencyKey,
    payload,
    payloadJson,
    payloadDigest,
    requestDigest: hash(
      JSON.stringify({
        expectedVersion: command.expectedVersion,
        id: "main",
        operation: "put",
        payloadSha256: payloadDigest,
      }),
    ),
  };
}

function admitted(
  catalog: AppwriteWatchlistRepositoryOptions["catalog"],
  payload: MainWatchlistPayload,
): boolean {
  try {
    return payload.memberships.every((membership) => {
      const result = lookupPersonalSecurityMasterListing(
        catalog,
        membership.listingId,
      );
      return result !== null && membershipMatchesResult(membership, result);
    });
  } catch {
    return false;
  }
}

/** Schema-specific canonical encoding; membership order is meaningful. */
function encodePayload(payload: MainWatchlistPayload): string {
  return JSON.stringify({
    memberships: payload.memberships.map((entry) => ({
      country: entry.country,
      exchangeMic: entry.exchangeMic,
      instrumentType: entry.instrumentType,
      issuerId: entry.issuerId,
      issuerName: entry.issuerName,
      listingId: entry.listingId,
      note: entry.note,
      securityId: entry.securityId,
      securityName: entry.securityName,
      shareClassId: entry.shareClassId,
      shareClassName: entry.shareClassName,
      symbol: entry.symbol,
    })),
    name: payload.name,
    schemaVersion: payload.schemaVersion,
    snapshotSha256: payload.snapshotSha256,
  });
}

async function readOptional(
  store: AppwriteWatchlistStore,
  target: RowLocation,
): Promise<unknown> {
  try {
    return await store.getRow(target);
  } catch (error) {
    if (
      error instanceof AppwriteException &&
      error.code === 404 &&
      error.type === "row_not_found"
    )
      return null;
    throw error;
  }
}

function assertRow(
  row: unknown,
  target: RowLocation,
  fields: string[],
): asserts row is Record<string, unknown> {
  if (
    !object(row) ||
    Object.keys(row).sort().join(",") !==
      [...ROW_METADATA, ...fields].sort().join(",") ||
    row.$id !== target.rowId ||
    row.$databaseId !== target.databaseId ||
    row.$tableId !== target.tableId ||
    typeof row.$sequence !== "string" ||
    !/^[0-9]+$/u.test(row.$sequence) ||
    !metadataDate(row.$createdAt) ||
    !metadataDate(row.$updatedAt) ||
    !Array.isArray(row.$permissions) ||
    row.$permissions.length !== 0
  )
    throw new WatchlistRepositoryError("invalid_response");
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function date(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
function metadataDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/u.exec(
      value,
    );
  if (match === null) return false;
  return date(`${match[1]}.${(match[2] ?? "").padEnd(3, "0").slice(0, 3)}Z`);
}
function positiveVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function digest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}
function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function opaqueId(prefix: string, values: string[]): string {
  return prefix + hash(JSON.stringify(values)).slice(0, 32);
}
function safeError(error: unknown): WatchlistRepositoryError {
  if (error instanceof WatchlistRepositoryError) return error;
  if (
    error instanceof AppwriteException &&
    (error.code === 401 || error.code === 403)
  )
    return new WatchlistRepositoryError("access_denied");
  return new WatchlistRepositoryError("unavailable");
}
