import { createHash } from "node:crypto";
import type {
  MainWatchlistPayload,
  ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { AppwriteException } from "node-appwrite";
import type {
  AppwriteRowLocation,
  AppwriteVersionedRowStore,
} from "./appwrite-versioned-row-store";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const MAX_PAYLOAD_BYTES = 262_144;
const ROW_METADATA = [
  "$id",
  "$sequence",
  "$tableId",
  "$databaseId",
  "$createdAt",
  "$updatedAt",
  "$permissions",
] as const;
export type ResourceKind = "watchlist" | "research-followups";
interface PayloadByKind {
  watchlist: MainWatchlistPayload;
  "research-followups": ResearchFollowupsPayload;
}
export interface ResourcePrincipal {
  readonly userId: string;
}
export interface ResourceCommand<K extends ResourceKind> {
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly payload: PayloadByKind[K];
}
interface PayloadCapture<K extends ResourceKind> {
  readonly expectedVersion: number;
  readonly key: string;
  readonly payload: PayloadByKind[K];
  readonly payloadJson: string;
}
interface CapturedCommand<K extends ResourceKind> extends PayloadCapture<K> {
  readonly payloadDigest: string;
  readonly requestDigest: string;
}
/** Internal trusted composition, limited to two closed payload kinds. No policy performs I/O. */
export interface ResourcePolicy<K extends ResourceKind> {
  readonly kind: K;
  capture(command: ResourceCommand<K>): PayloadCapture<K>;
  decodeStored(payloadJson: string): PayloadByKind[K] | null;
  admitFresh(
    payload: PayloadByKind[K],
    current: PayloadByKind[K] | null,
    actualUtcDay: string,
  ): boolean;
}
export interface VersionedResourceOptions {
  readonly store: AppwriteVersionedRowStore;
  readonly databaseId: string;
  readonly currentTableId: string;
  readonly receiptsTableId: string;
  readonly now?: () => Date;
}
export interface VersionedResourceRecord<K extends ResourceKind> {
  readonly id: "main";
  readonly version: number;
  readonly payload: PayloadByKind[K];
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface VersionedResourceReceipt {
  readonly id: "main";
  readonly version: number;
  readonly digestSha256: string;
  readonly committedAt: string;
  readonly replayed: boolean;
}
interface VersionedResourceRepository<K extends ResourceKind> {
  get(principal: ResourcePrincipal): Promise<VersionedResourceRecord<K> | null>;
  put(
    principal: ResourcePrincipal,
    command: ResourceCommand<K>,
  ): Promise<VersionedResourceReceipt>;
}
export type VersionedResourceErrorCode =
  | "invalid_request"
  | "conflict"
  | "idempotency_conflict"
  | "invalid_response"
  | "access_denied"
  | "unavailable"
  | "commit_unknown";
/** Internal finite error. Resource wrappers preserve their own public error types. */
export class VersionedResourceRepositoryError extends Error {
  constructor(readonly code: VersionedResourceErrorCode) {
    super(code);
    this.name = "VersionedResourceRepositoryError";
  }
}

interface StoredRecord<
  K extends ResourceKind,
> extends VersionedResourceRecord<K> {
  readonly digestSha256: string;
}

export function createAppwriteVersionedResourceRepository<
  K extends ResourceKind,
>(
  options: VersionedResourceOptions,
  policy: ResourcePolicy<K>,
): VersionedResourceRepository<K> {
  const { store, databaseId, currentTableId, receiptsTableId } = options;
  const now = options.now ?? (() => new Date());
  if (
    (policy.kind !== "watchlist" && policy.kind !== "research-followups") ||
    ![databaseId, currentTableId, receiptsTableId].every((id) => ID.test(id)) ||
    currentTableId === receiptsTableId
  ) {
    throw new VersionedResourceRepositoryError("invalid_request");
  }
  const resourceColumn =
    policy.kind === "watchlist" ? "watchlistId" : "resourceId";
  const namespace = (userId: string) =>
    policy.kind === "watchlist"
      ? [userId, "main"]
      : [userId, "research-followups", "main"];
  const location = (tableId: string, rowId: string): AppwriteRowLocation => ({
    databaseId,
    tableId,
    rowId,
  });
  const currentLocation = (userId: string) =>
    location(
      currentTableId,
      opaqueId(policy.kind === "watchlist" ? "w" : "f", namespace(userId)),
    );
  const receiptLocation = (userId: string, key: string) =>
    location(receiptsTableId, opaqueId("r", [...namespace(userId), key]));

  async function readCurrent(userId: string): Promise<StoredRecord<K> | null> {
    const target = currentLocation(userId);
    const row = await readOptional(store, target);
    if (row === null) return null;
    assertRow(row, target, [
      "ownerId",
      resourceColumn,
      "version",
      "payloadJson",
      "digestSha256",
      "createdAt",
      "updatedAt",
    ]);
    if (
      row.ownerId !== userId ||
      row[resourceColumn] !== "main" ||
      !positiveVersion(row.version) ||
      !date(row.createdAt) ||
      !date(row.updatedAt) ||
      row.createdAt > row.updatedAt ||
      typeof row.payloadJson !== "string" ||
      !digest(row.digestSha256) ||
      Buffer.byteLength(row.payloadJson, "utf8") > MAX_PAYLOAD_BYTES ||
      hash(row.payloadJson) !== row.digestSha256
    ) {
      throw new VersionedResourceRepositoryError("invalid_response");
    }
    let payload: PayloadByKind[K] | null;
    try {
      payload = policy.decodeStored(row.payloadJson);
    } catch {
      throw new VersionedResourceRepositoryError("invalid_response");
    }
    if (payload === null)
      throw new VersionedResourceRepositoryError("invalid_response");
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
  ): Promise<VersionedResourceReceipt | null> {
    const target = receiptLocation(userId, key);
    const row = await readOptional(store, target);
    if (row === null) return null;
    assertRow(row, target, [
      "ownerId",
      resourceColumn,
      "keyDigest",
      "requestDigest",
      "version",
      "digestSha256",
      "committedAt",
    ]);
    if (
      row.ownerId !== userId ||
      row[resourceColumn] !== "main" ||
      row.keyDigest !== hash(key) ||
      !digest(row.requestDigest) ||
      !positiveVersion(row.version) ||
      !digest(row.digestSha256) ||
      !date(row.committedAt)
    ) {
      throw new VersionedResourceRepositoryError("invalid_response");
    }
    if (row.requestDigest !== requestDigest)
      throw new VersionedResourceRepositoryError("idempotency_conflict");
    if (
      row.version !== expectedVersion + 1 ||
      row.digestSha256 !== payloadDigest
    )
      throw new VersionedResourceRepositoryError("invalid_response");
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
      let captured: CapturedCommand<K>;
      try {
        userId = owner(principal);
        captured = captureCommand(command, policy);
      } catch {
        throw new VersionedResourceRepositoryError("invalid_request");
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
          policy.kind === "watchlist" &&
          !policy.admitFresh(captured.payload, null, "")
        )
          throw new VersionedResourceRepositoryError("invalid_request");
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
          throw new VersionedResourceRepositoryError("conflict");
        }
        const committedAt = now().toISOString();
        if (
          !date(committedAt) ||
          (current !== null && committedAt < current.updatedAt)
        )
          throw new VersionedResourceRepositoryError("unavailable");
        if (
          policy.kind === "research-followups" &&
          !policy.admitFresh(
            captured.payload,
            current?.payload ?? null,
            committedAt.slice(0, 10),
          )
        )
          throw new VersionedResourceRepositoryError("invalid_request");
        const transaction = await store.createTransaction({ ttl: 60 });
        if (
          !object(transaction) ||
          typeof transaction.$id !== "string" ||
          !ID.test(transaction.$id)
        )
          throw new VersionedResourceRepositoryError("invalid_response");
        transactionId = transaction.$id;
        if (transaction.status !== "pending")
          throw new VersionedResourceRepositoryError("invalid_response");
        const target = currentLocation(userId);
        if (expectedVersion === 0) {
          await store.createRow({
            ...target,
            transactionId,
            permissions: [],
            data: {
              ownerId: userId,
              [resourceColumn]: "main",
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
            [resourceColumn]: "main",
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
          throw new VersionedResourceRepositoryError("commit_unknown");
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
              readError instanceof VersionedResourceRepositoryError &&
              readError.code === "idempotency_conflict"
            )
              throw readError;
            throw commitStarted
              ? new VersionedResourceRepositoryError("commit_unknown")
              : safeError(readError);
          });
          if (previous !== null) return previous;
          throw new VersionedResourceRepositoryError("conflict");
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
              readError instanceof VersionedResourceRepositoryError &&
              readError.code === "idempotency_conflict"
            )
              throw readError;
            throw new VersionedResourceRepositoryError("commit_unknown");
          });
          if (previous !== null) return previous;
          const current = await readCurrent(userId).catch(() => {
            throw new VersionedResourceRepositoryError("commit_unknown");
          });
          if (current !== null && current.version > expectedVersion)
            throw new VersionedResourceRepositoryError("conflict");
          throw new VersionedResourceRepositoryError("commit_unknown");
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
            throw new VersionedResourceRepositoryError("conflict");
        }
        if (commitStarted)
          throw new VersionedResourceRepositoryError("commit_unknown");
        throw safeError(error);
      }
    },
  };
}

function owner(principal: ResourcePrincipal): string {
  if (
    !object(principal) ||
    Object.keys(principal).length !== 1 ||
    typeof principal.userId !== "string" ||
    !ID.test(principal.userId)
  )
    throw new VersionedResourceRepositoryError("invalid_request");
  return principal.userId;
}

function captureCommand<K extends ResourceKind>(
  command: ResourceCommand<K>,
  policy: ResourcePolicy<K>,
): CapturedCommand<K> {
  const captured = policy.capture(command);
  if (Buffer.byteLength(captured.payloadJson, "utf8") > MAX_PAYLOAD_BYTES)
    throw new VersionedResourceRepositoryError("invalid_request");
  const payloadDigest = hash(captured.payloadJson);
  const request =
    policy.kind === "watchlist"
      ? {
          expectedVersion: captured.expectedVersion,
          id: "main",
          operation: "put",
          payloadSha256: payloadDigest,
        }
      : {
          expectedVersion: captured.expectedVersion,
          resource: "research-followups",
          id: "main",
          operation: "put",
          payloadSha256: payloadDigest,
        };
  return {
    ...captured,
    payloadDigest,
    requestDigest: hash(JSON.stringify(request)),
  };
}

async function readOptional(
  store: AppwriteVersionedRowStore,
  target: AppwriteRowLocation,
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
  target: AppwriteRowLocation,
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
    throw new VersionedResourceRepositoryError("invalid_response");
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
function safeError(error: unknown): VersionedResourceRepositoryError {
  if (error instanceof VersionedResourceRepositoryError) return error;
  if (
    error instanceof AppwriteException &&
    (error.code === 401 || error.code === 403)
  )
    return new VersionedResourceRepositoryError("access_denied");
  return new VersionedResourceRepositoryError("unavailable");
}
