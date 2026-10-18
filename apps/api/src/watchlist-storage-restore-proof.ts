import { AppwriteException } from "node-appwrite";
import { createAppwriteWatchlistRepository } from "./appwrite-watchlist-repository";
import {
  ProofFailure,
  StorageProofPhase,
  type OperationTrace,
  type ProofFailureReason,
} from "./appwrite-storage-proof-phase";
import type {
  AppwriteRowLocation,
  AppwriteVersionedRowStore,
} from "./appwrite-versioned-row-store";
import {
  WATCHLIST_RESTORE_PROOF_COMMAND_PINS,
  WATCHLIST_RESTORE_PROOF_LIMITS,
  WATCHLIST_RESTORE_PROOF_PHASES,
  WATCHLIST_RESTORE_PROOF_PLAN_SHA256,
  WATCHLIST_RESTORE_PROOF_PRINCIPAL,
  WATCHLIST_RESTORE_PROOF_ROWS,
  WATCHLIST_RESTORE_PROOF_TIMES,
  watchlistRestoreProofData,
  watchlistRestoreProofHash,
  watchlistRestoreProofLocation,
  type WatchlistRestoreProofPhase,
  type WatchlistRestoreProofSide,
} from "./watchlist-restore-proof-data";
import {
  WatchlistRepositoryError,
  type WatchlistRepositoryErrorCode,
} from "./watchlist-repository";

export interface WatchlistRestoreProofOperation {
  newStore(): AppwriteVersionedRowStore;
  snapshot(): {
    readonly requests: number;
    readonly lastStatus: number | null;
    readonly closed: boolean;
  };
  close(): Promise<void>;
}
export type WatchlistRestoreProofFactory = (
  signal: AbortSignal,
) => WatchlistRestoreProofOperation;
export interface WatchlistRestoreProofReport {
  readonly version: 1;
  readonly buildProof: string;
  readonly planSha256: string;
  readonly phase: WatchlistRestoreProofPhase;
  readonly outcome: "passed" | "failed" | "incomplete";
  readonly failure: "none" | ProofFailureReason;
  readonly repositoryError: WatchlistRepositoryErrorCode | null;
  readonly operationCount: number;
  readonly httpDispatches: number | null;
  readonly upstreamStatus: number | null;
  readonly elapsedMs: number | null;
  readonly closed: boolean;
  readonly cleanupIncomplete: boolean;
  readonly checks: readonly string[];
  readonly rowFingerprints: readonly {
    readonly side: WatchlistRestoreProofSide;
    readonly rowId: string;
    readonly sha256: string;
    readonly applicationSha256: string;
  }[];
  readonly trace: readonly Readonly<OperationTrace>[];
}
type Row = Record<string, unknown>;
const metadata = [
  "$id",
  "$sequence",
  "$tableId",
  "$databaseId",
  "$createdAt",
  "$updatedAt",
  "$permissions",
];
const currentFields = [
  "ownerId",
  "watchlistId",
  "version",
  "payloadJson",
  "digestSha256",
  "createdAt",
  "updatedAt",
];
const receiptFields = [
  "ownerId",
  "watchlistId",
  "keyDigest",
  "requestDigest",
  "version",
  "digestSha256",
  "committedAt",
];
function requireProof(value: unknown): asserts value {
  if (!value) throw new ProofFailure("unexpected_result");
}
function object(value: unknown): value is Row {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function metadataTime(value: unknown) {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/u.exec(
      value,
    );
  if (!match) return false;
  const normalized = `${match[1]}.${(match[2] ?? "").padEnd(3, "0").slice(0, 3)}Z`;
  return (
    Number.isFinite(Date.parse(normalized)) &&
    new Date(normalized).toISOString() === normalized
  );
}
function fingerprint(row: Row, fields: readonly string[]) {
  return watchlistRestoreProofHash(
    JSON.stringify(
      Object.fromEntries([...fields].sort().map((key) => [key, row[key]])),
    ),
  );
}

/** Fixed application checks only. The operator performs native backup/restore separately. */
export async function runWatchlistRestoreProof(
  phase: WatchlistRestoreProofPhase,
  buildProof: string,
  factory: WatchlistRestoreProofFactory,
): Promise<WatchlistRestoreProofReport> {
  if (
    !WATCHLIST_RESTORE_PROOF_PHASES.includes(phase) ||
    !/^[0-9a-f]{64}$/u.test(buildProof)
  )
    throw new Error("Invalid restore proof configuration");
  const lifetime = new StorageProofPhase(
    WATCHLIST_RESTORE_PROOF_LIMITS[phase],
    true,
  );
  const data = watchlistRestoreProofData();
  const checks: string[] = [];
  const rows = new Map<string, { side: WatchlistRestoreProofSide; row: Row }>();
  let operation: WatchlistRestoreProofOperation | undefined;
  let outcome: WatchlistRestoreProofReport["outcome"];
  let failure: WatchlistRestoreProofReport["failure"] = "none";
  let repositoryError: WatchlistRepositoryErrorCode | null = null;

  function location(input: AppwriteRowLocation) {
    lifetime.assertRunning();
    const expected = WATCHLIST_RESTORE_PROOF_ROWS.find(
      (row) =>
        row.databaseId === input.databaseId &&
        row.tableId === input.tableId &&
        row.rowId === input.rowId,
    );
    requireProof(
      expected &&
        (phase === "preflight" ||
          expected.side ===
            (phase === "verify-restored" ? "restored" : "source")),
    );
    return expected;
  }
  function inspect(input: AppwriteRowLocation, value: unknown) {
    const expected = location(input);
    requireProof(object(value));
    const fields = expected.version === null ? currentFields : receiptFields;
    requireProof(
      Object.keys(value).sort().join(",") ===
        [...metadata, ...fields].sort().join(",") &&
        value.$id === input.rowId &&
        value.$databaseId === input.databaseId &&
        value.$tableId === input.tableId &&
        typeof value.$sequence === "string" &&
        /^\d+$/u.test(value.$sequence) &&
        metadataTime(value.$createdAt) &&
        metadataTime(value.$updatedAt) &&
        Array.isArray(value.$permissions) &&
        value.$permissions.length === 0 &&
        value.ownerId === WATCHLIST_RESTORE_PROOF_PRINCIPAL.userId &&
        value.watchlistId === "main",
    );
    const version = value.version;
    requireProof(version === 1 || version === 2 || version === 3);
    const pin = WATCHLIST_RESTORE_PROOF_COMMAND_PINS[version - 1]!;
    requireProof(value.digestSha256 === pin.payloadSha256);
    if (expected.version === null) {
      requireProof(
        value.payloadJson === pin.payloadJson &&
          value.createdAt === WATCHLIST_RESTORE_PROOF_TIMES[0] &&
          value.updatedAt === pin.committedAt,
      );
    } else {
      requireProof(
        version === expected.version &&
          value.keyDigest === pin.keySha256 &&
          value.requestDigest === pin.requestSha256 &&
          value.committedAt === pin.committedAt,
      );
    }
    rows.set(JSON.stringify(input), {
      side: expected.side,
      row: structuredClone(value),
    });
  }
  function store() {
    const counted = lifetime.store(
      operation!.newStore(),
      { visit: location, read: inspect },
      "inspection",
    );
    const mutationsAllowed = phase === "seed" || phase === "verify-restored";
    const deny = () => Promise.reject(new ProofFailure("unexpected_result"));
    return mutationsAllowed
      ? counted
      : ({
          ...counted,
          createTransaction: deny,
          createRow: deny,
          updateRow: deny,
          incrementRowColumn: deny,
          updateTransaction: deny,
        } satisfies AppwriteVersionedRowStore);
  }
  function repository(side: WatchlistRestoreProofSide, version: 1 | 2 | 3 = 1) {
    return createAppwriteWatchlistRepository({
      store: store(),
      databaseId: watchlistRestoreProofLocation(side).databaseId,
      watchlistsTableId: "watchlists",
      receiptsTableId: "receipts",
      catalog: data.catalog,
      now: () => new Date(WATCHLIST_RESTORE_PROOF_TIMES[version - 1]!),
    });
  }
  async function absent(side: WatchlistRestoreProofSide, version?: 1 | 2 | 3) {
    try {
      await store().getRow(watchlistRestoreProofLocation(side, version));
    } catch (error) {
      if (
        error instanceof AppwriteException &&
        error.code === 404 &&
        error.type ===
          (phase === "preflight" && side === "restored"
            ? "database_not_found"
            : "row_not_found")
      )
        return;
      throw error;
    }
    throw new ProofFailure("unexpected_result");
  }
  async function current(side: WatchlistRestoreProofSide, version: 1 | 2 | 3) {
    const record = await repository(side).get(
      WATCHLIST_RESTORE_PROOF_PRINCIPAL,
    );
    requireProof(record?.version === version);
  }
  async function readSet(side: WatchlistRestoreProofSide, version: 2 | 3) {
    await current(side, version);
    for (const receiptVersion of [1, 2, 3] as const) {
      if (receiptVersion > version) await absent(side, receiptVersion);
      else
        await store().getRow(
          watchlistRestoreProofLocation(side, receiptVersion),
        );
    }
  }
  async function put(
    side: WatchlistRestoreProofSide,
    version: 1 | 2 | 3,
    replayed: boolean,
  ) {
    const before = lifetime.count;
    const receipt = await repository(side, version).put(
      WATCHLIST_RESTORE_PROOF_PRINCIPAL,
      data.commands[version - 1]!,
    );
    const pin = WATCHLIST_RESTORE_PROOF_COMMAND_PINS[version - 1]!;
    requireProof(
      receipt.version === version &&
        receipt.replayed === replayed &&
        receipt.digestSha256 === pin.payloadSha256 &&
        receipt.committedAt === pin.committedAt,
    );
    if (replayed)
      requireProof(
        lifetime.count === before + 1 &&
          lifetime.trace.at(-1)?.operation === "read_receipt",
      );
  }
  async function execute() {
    operation = factory(lifetime.controller.signal);
    if (phase === "preflight") {
      for (const side of ["source", "restored"] as const)
        for (const version of [undefined, 1, 2, 3] as const)
          await absent(side, version);
      checks.push(
        "source_four_fixed_locations_absent",
        "distinct_restore_database_absent",
      );
    } else if (phase === "seed") {
      // The first put itself checks receipt 1 and must create, never replay.
      // Avoid a redundant read so the transport retains its rollback slot.
      for (const version of [undefined, 2, 3] as const)
        await absent("source", version);
      await put("source", 1, false);
      await put("source", 2, false);
      await current("source", 2);
      for (const version of [1, 2] as const)
        await store().getRow(watchlistRestoreProofLocation("source", version));
      checks.push(
        "source_two_canonical_versions",
        "source_both_original_receipts",
        "source_application_and_metadata_fingerprints",
      );
    } else if (phase === "verify-restored") {
      await readSet("restored", 2);
      await put("restored", 1, true);
      await current("restored", 2);
      checks.push(
        "restored_baseline_and_both_receipts",
        "older_original_receipt_only_replay_no_second_commit",
      );
      await put("restored", 3, false);
      await readSet("restored", 3);
      await put("restored", 3, true);
      checks.push(
        "next_version_save_at_distinct_target",
        "all_three_target_receipts",
        "target_next_save_receipt_only_replay",
      );
    } else {
      await readSet("source", 2);
      await put("source", 1, true);
      await current("source", 2);
      checks.push(
        "source_baseline_and_original_receipts_retained",
        "source_target_only_receipt_absent",
        "source_read_only_replay",
        "source_application_and_metadata_fingerprints",
      );
    }
  }
  try {
    const actor = execute();
    // The phase records the actor's original rejection below. Cleanup waits for
    // settlement without reclassifying that known failure as a cleanup failure.
    lifetime.actors.push(
      actor.then(
        () => undefined,
        () => undefined,
      ),
    );
    await lifetime.bounded(actor);
    lifetime.assertRunning();
    outcome = "passed";
  } catch (error) {
    repositoryError =
      error instanceof WatchlistRepositoryError ? error.code : null;
    failure = lifetime.controller.signal.aborted
      ? "deadline"
      : lifetime.limitReached
        ? "operation_limit"
        : error instanceof ProofFailure
          ? error.reason
          : "operation_failed";
    outcome =
      failure === "deadline" || failure === "operation_limit"
        ? "incomplete"
        : "failed";
  } finally {
    try {
      await lifetime.close(operation);
    } catch {
      outcome = "incomplete";
      failure = "cleanup_failed";
    }
    if (lifetime.rollbackIncomplete) {
      outcome = "incomplete";
      failure = "cleanup_failed";
    }
  }
  let dispatches: number | null = null,
    lastStatus: number | null = null,
    closed = false;
  try {
    const snapshot = operation?.snapshot();
    requireProof(
      snapshot &&
        Number.isSafeInteger(snapshot.requests) &&
        snapshot.requests >= 0 &&
        snapshot.requests <= WATCHLIST_RESTORE_PROOF_LIMITS[phase] &&
        (snapshot.lastStatus === null ||
          (Number.isInteger(snapshot.lastStatus) &&
            snapshot.lastStatus >= 100 &&
            snapshot.lastStatus <= 599)) &&
        typeof snapshot.closed === "boolean",
    );
    if (outcome === "passed")
      requireProof(snapshot.requests === lifetime.count);
    dispatches = snapshot.requests;
    lastStatus = snapshot.lastStatus;
    closed = snapshot.closed;
    if (!closed) {
      outcome = "incomplete";
      failure = "cleanup_failed";
    }
  } catch {
    outcome = "incomplete";
    failure = "cleanup_failed";
  }
  const elapsed = performance.now() - lifetime.started;
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    outcome = "failed";
    failure = "unexpected_result";
  }
  const report: WatchlistRestoreProofReport = {
    version: 1,
    buildProof,
    planSha256: WATCHLIST_RESTORE_PROOF_PLAN_SHA256,
    phase,
    outcome,
    failure,
    repositoryError,
    operationCount: lifetime.count,
    httpDispatches: dispatches,
    upstreamStatus: lifetime.upstreamStatus ?? lastStatus,
    elapsedMs:
      Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed) : null,
    closed,
    cleanupIncomplete:
      lifetime.rollbackIncomplete || failure === "cleanup_failed",
    checks,
    rowFingerprints: [...rows.values()].map(({ side, row }) => ({
      side,
      rowId: row.$id as string,
      sha256: fingerprint(row, Object.keys(row)),
      applicationSha256: fingerprint(
        row,
        row.$tableId === "watchlists" ? currentFields : receiptFields,
      ),
    })),
    trace: lifetime.trace.map((entry) => ({ ...entry })),
  };
  requireProof(Buffer.byteLength(JSON.stringify(report)) <= 8192);
  return report;
}
