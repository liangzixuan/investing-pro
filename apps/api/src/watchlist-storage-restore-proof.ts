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
type Version = 1 | 2 | 3;
type CommandPin = (typeof WATCHLIST_RESTORE_PROOF_COMMAND_PINS)[number];
interface ObservedRow {
  readonly side: WatchlistRestoreProofSide;
  readonly row: Row;
}
interface PhaseOutcome {
  outcome: WatchlistRestoreProofReport["outcome"];
  failure: WatchlistRestoreProofReport["failure"];
  repositoryError: WatchlistRepositoryErrorCode | null;
}
interface ObservedOutcome extends PhaseOutcome {
  httpDispatches: number | null;
  lastStatus: number | null;
  closed: boolean;
}
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

/** Common storage envelope: exact fields, location, platform metadata and grants. */
function validateRowEnvelope(
  row: Row,
  input: AppwriteRowLocation,
  fields: readonly string[],
) {
  requireProof(
    Object.keys(row).sort().join(",") ===
      [...metadata, ...fields].sort().join(","),
  );
  requireProof(row.$id === input.rowId);
  requireProof(row.$databaseId === input.databaseId);
  requireProof(row.$tableId === input.tableId);
  requireProof(typeof row.$sequence === "string");
  requireProof(/^\d+$/u.test(row.$sequence));
  requireProof(metadataTime(row.$createdAt));
  requireProof(metadataTime(row.$updatedAt));
  const permissions = row.$permissions;
  requireProof(Array.isArray(permissions));
  requireProof(permissions.length === 0);
  requireProof(row.ownerId === WATCHLIST_RESTORE_PROOF_PRINCIPAL.userId);
  requireProof(row.watchlistId === "main");
}
function validatedCommandPin(row: Row): CommandPin {
  const version = row.version;
  requireProof(version === 1 || version === 2 || version === 3);
  const pin = WATCHLIST_RESTORE_PROOF_COMMAND_PINS[version - 1]!;
  requireProof(row.digestSha256 === pin.payloadSha256);
  return pin;
}
function validateCurrentRow(row: Row, pin: CommandPin) {
  requireProof(row.payloadJson === pin.payloadJson);
  requireProof(row.createdAt === WATCHLIST_RESTORE_PROOF_TIMES[0]);
  requireProof(row.updatedAt === pin.committedAt);
}
function validateReceiptRow(
  row: Row,
  expectedVersion: number,
  pin: CommandPin,
) {
  requireProof(row.version === expectedVersion);
  requireProof(row.keyDigest === pin.keySha256);
  requireProof(row.requestDigest === pin.requestSha256);
  requireProof(row.committedAt === pin.committedAt);
}

function expectedAbsenceType(
  phase: WatchlistRestoreProofPhase,
  side: WatchlistRestoreProofSide,
): "database_not_found" | "row_not_found" {
  if (phase !== "preflight") return "row_not_found";
  if (side !== "restored") return "row_not_found";
  return "database_not_found";
}
function isExpectedAbsence(
  error: unknown,
  expectedType: "database_not_found" | "row_not_found",
) {
  if (!(error instanceof AppwriteException)) return false;
  if (error.code !== 404) return false;
  return error.type === expectedType;
}

/** One invocation owns its operation, admitted rows and mutation fences. */
class RestoreProofRun {
  readonly lifetime: StorageProofPhase;
  readonly checks: string[] = [];
  readonly rows = new Map<string, ObservedRow>();
  readonly data = watchlistRestoreProofData();
  operation: WatchlistRestoreProofOperation | undefined;

  constructor(readonly phase: WatchlistRestoreProofPhase) {
    this.lifetime = new StorageProofPhase(
      WATCHLIST_RESTORE_PROOF_LIMITS[phase],
      true,
    );
  }
  private location(input: AppwriteRowLocation) {
    this.lifetime.assertRunning();
    const expected = WATCHLIST_RESTORE_PROOF_ROWS.find(
      (row) =>
        row.databaseId === input.databaseId &&
        row.tableId === input.tableId &&
        row.rowId === input.rowId,
    );
    requireProof(expected);
    if (this.phase === "preflight") return expected;
    const side = this.phase === "verify-restored" ? "restored" : "source";
    requireProof(expected.side === side);
    return expected;
  }
  private inspect(input: AppwriteRowLocation, value: unknown) {
    const expected = this.location(input);
    requireProof(object(value));
    const fields = expected.version === null ? currentFields : receiptFields;
    validateRowEnvelope(value, input, fields);
    const pin = validatedCommandPin(value);
    if (expected.version === null) validateCurrentRow(value, pin);
    else validateReceiptRow(value, expected.version, pin);
    this.rows.set(JSON.stringify(input), {
      side: expected.side,
      row: structuredClone(value),
    });
  }
  private store() {
    const counted = this.lifetime.store(
      this.operation!.newStore(),
      {
        visit: (input) => this.location(input),
        read: (input, value) => this.inspect(input, value),
      },
      "inspection",
    );
    const mutationsAllowed =
      this.phase === "seed" || this.phase === "verify-restored";
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
  private repository(side: WatchlistRestoreProofSide, version: Version = 1) {
    return createAppwriteWatchlistRepository({
      store: this.store(),
      databaseId: watchlistRestoreProofLocation(side).databaseId,
      watchlistsTableId: "watchlists",
      receiptsTableId: "receipts",
      catalog: this.data.catalog,
      now: () => new Date(WATCHLIST_RESTORE_PROOF_TIMES[version - 1]!),
    });
  }
  async absent(side: WatchlistRestoreProofSide, version?: Version) {
    const absenceType = expectedAbsenceType(this.phase, side);
    try {
      await this.store().getRow(watchlistRestoreProofLocation(side, version));
    } catch (error) {
      if (isExpectedAbsence(error, absenceType)) return;
      throw error;
    }
    throw new ProofFailure("unexpected_result");
  }
  async absentSet(
    side: WatchlistRestoreProofSide,
    versions: readonly (Version | undefined)[],
  ) {
    for (const version of versions) await this.absent(side, version);
  }
  async current(side: WatchlistRestoreProofSide, version: Version) {
    const record = await this.repository(side).get(
      WATCHLIST_RESTORE_PROOF_PRINCIPAL,
    );
    requireProof(record?.version === version);
  }
  async readReceipts(
    side: WatchlistRestoreProofSide,
    versions: readonly Version[],
  ) {
    for (const version of versions)
      await this.store().getRow(watchlistRestoreProofLocation(side, version));
  }
  async readSet(side: WatchlistRestoreProofSide, version: 2 | 3) {
    await this.current(side, version);
    for (const receiptVersion of [1, 2, 3] as const) {
      if (receiptVersion > version) await this.absent(side, receiptVersion);
      else
        await this.store().getRow(
          watchlistRestoreProofLocation(side, receiptVersion),
        );
    }
  }
  async put(
    side: WatchlistRestoreProofSide,
    version: Version,
    replayed: boolean,
  ) {
    const before = this.lifetime.count;
    const receipt = await this.repository(side, version).put(
      WATCHLIST_RESTORE_PROOF_PRINCIPAL,
      this.data.commands[version - 1]!,
    );
    const pin = WATCHLIST_RESTORE_PROOF_COMMAND_PINS[version - 1]!;
    requireProof(receipt.version === version);
    requireProof(receipt.replayed === replayed);
    requireProof(receipt.digestSha256 === pin.payloadSha256);
    requireProof(receipt.committedAt === pin.committedAt);
    if (replayed) {
      requireProof(this.lifetime.count === before + 1);
      requireProof(this.lifetime.trace.at(-1)?.operation === "read_receipt");
    }
  }
  async execute(factory: WatchlistRestoreProofFactory) {
    this.operation = factory(this.lifetime.controller.signal);
    await phaseProcedures[this.phase](this);
  }
}

async function preflight(run: RestoreProofRun) {
  await run.absentSet("source", [undefined, 1, 2, 3]);
  await run.absentSet("restored", [undefined, 1, 2, 3]);
  run.checks.push(
    "source_four_fixed_locations_absent",
    "distinct_restore_database_absent",
  );
}
async function seed(run: RestoreProofRun) {
  // Put 1 checks its receipt and must create, leaving the rollback slot free.
  await run.absentSet("source", [undefined, 2, 3]);
  await run.put("source", 1, false);
  await run.put("source", 2, false);
  await run.current("source", 2);
  await run.readReceipts("source", [1, 2]);
  run.checks.push(
    "source_two_canonical_versions",
    "source_both_original_receipts",
    "source_application_and_metadata_fingerprints",
  );
}
async function verifyRestored(run: RestoreProofRun) {
  await run.readSet("restored", 2);
  await run.put("restored", 1, true);
  await run.current("restored", 2);
  run.checks.push(
    "restored_baseline_and_both_receipts",
    "older_original_receipt_only_replay_no_second_commit",
  );
  await run.put("restored", 3, false);
  await run.readSet("restored", 3);
  await run.put("restored", 3, true);
  run.checks.push(
    "next_version_save_at_distinct_target",
    "all_three_target_receipts",
    "target_next_save_receipt_only_replay",
  );
}
async function verifySource(run: RestoreProofRun) {
  await run.readSet("source", 2);
  await run.put("source", 1, true);
  await run.current("source", 2);
  run.checks.push(
    "source_baseline_and_original_receipts_retained",
    "source_target_only_receipt_absent",
    "source_read_only_replay",
    "source_application_and_metadata_fingerprints",
  );
}
const phaseProcedures: Record<
  WatchlistRestoreProofPhase,
  (run: RestoreProofRun) => Promise<void>
> = {
  preflight,
  seed,
  "verify-restored": verifyRestored,
  "verify-source": verifySource,
};

function failedPhase(
  lifetime: StorageProofPhase,
  error: unknown,
): PhaseOutcome {
  const failure = lifetime.controller.signal.aborted
    ? "deadline"
    : lifetime.limitReached
      ? "operation_limit"
      : error instanceof ProofFailure
        ? error.reason
        : "operation_failed";
  return {
    outcome:
      failure === "deadline" || failure === "operation_limit"
        ? "incomplete"
        : "failed",
    failure,
    repositoryError:
      error instanceof WatchlistRepositoryError ? error.code : null,
  };
}
async function closePhase(
  run: RestoreProofRun,
  result: PhaseOutcome,
): Promise<PhaseOutcome> {
  let cleanupFailed = false;
  try {
    await run.lifetime.close(run.operation);
  } catch {
    cleanupFailed = true;
  }
  if (run.lifetime.rollbackIncomplete) cleanupFailed = true;
  if (cleanupFailed)
    return { ...result, outcome: "incomplete", failure: "cleanup_failed" };
  return result;
}
async function executeOwnedPhase(
  run: RestoreProofRun,
  factory: WatchlistRestoreProofFactory,
) {
  let result: PhaseOutcome = {
    outcome: "passed",
    failure: "none",
    repositoryError: null,
  };
  try {
    const actor = run.execute(factory);
    // Keep the original failure below; cleanup waits for actor settlement only.
    run.lifetime.actors.push(
      actor.then(
        () => undefined,
        () => undefined,
      ),
    );
    await run.lifetime.bounded(actor);
    run.lifetime.assertRunning();
  } catch (error) {
    result = failedPhase(run.lifetime, error);
  } finally {
    result = await closePhase(run, result);
  }
  return result;
}
function validStatus(status: number | null) {
  return (
    status === null ||
    (Number.isInteger(status) && status >= 100 && status <= 599)
  );
}
function validateTraffic(
  snapshot: ReturnType<WatchlistRestoreProofOperation["snapshot"]> | undefined,
  phase: WatchlistRestoreProofPhase,
): asserts snapshot is ReturnType<WatchlistRestoreProofOperation["snapshot"]> {
  requireProof(snapshot);
  requireProof(Number.isSafeInteger(snapshot.requests));
  requireProof(snapshot.requests >= 0);
  requireProof(snapshot.requests <= WATCHLIST_RESTORE_PROOF_LIMITS[phase]);
  requireProof(validStatus(snapshot.lastStatus));
  requireProof(typeof snapshot.closed === "boolean");
}
function observeTraffic(
  run: RestoreProofRun,
  result: PhaseOutcome,
): ObservedOutcome {
  const empty = {
    ...result,
    httpDispatches: null,
    lastStatus: null,
    closed: false,
  };
  try {
    const snapshot = run.operation?.snapshot();
    validateTraffic(snapshot, run.phase);
    if (result.outcome === "passed")
      requireProof(snapshot.requests === run.lifetime.count);
    const observed = {
      ...result,
      httpDispatches: snapshot.requests,
      lastStatus: snapshot.lastStatus,
      closed: snapshot.closed,
    };
    if (!observed.closed)
      return { ...observed, outcome: "incomplete", failure: "cleanup_failed" };
    return observed;
  } catch {
    return { ...empty, outcome: "incomplete", failure: "cleanup_failed" };
  }
}
function rowFingerprints(rows: ReadonlyMap<string, ObservedRow>) {
  return [...rows.values()].map(({ side, row }) => ({
    side,
    rowId: row.$id as string,
    sha256: fingerprint(row, Object.keys(row)),
    applicationSha256: fingerprint(
      row,
      row.$tableId === "watchlists" ? currentFields : receiptFields,
    ),
  }));
}
function assembleReport(
  run: RestoreProofRun,
  buildProof: string,
  observed: ObservedOutcome,
) {
  const elapsed = performance.now() - run.lifetime.started;
  let elapsedMs: number | null = null;
  if (Number.isFinite(elapsed) && elapsed >= 0) elapsedMs = Math.round(elapsed);
  else
    observed = { ...observed, outcome: "failed", failure: "unexpected_result" };
  const report: WatchlistRestoreProofReport = {
    version: 1,
    buildProof,
    planSha256: WATCHLIST_RESTORE_PROOF_PLAN_SHA256,
    phase: run.phase,
    outcome: observed.outcome,
    failure: observed.failure,
    repositoryError: observed.repositoryError,
    operationCount: run.lifetime.count,
    httpDispatches: observed.httpDispatches,
    upstreamStatus: run.lifetime.upstreamStatus ?? observed.lastStatus,
    elapsedMs,
    closed: observed.closed,
    cleanupIncomplete:
      run.lifetime.rollbackIncomplete || observed.failure === "cleanup_failed",
    checks: run.checks,
    rowFingerprints: rowFingerprints(run.rows),
    trace: run.lifetime.trace.map((entry) => ({ ...entry })),
  };
  requireProof(Buffer.byteLength(JSON.stringify(report)) <= 8192);
  return report;
}

/** Fixed application checks only. Native backup/restore remains an operator action. */
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
  const run = new RestoreProofRun(phase);
  const result = await executeOwnedPhase(run, factory);
  return assembleReport(run, buildProof, observeTraffic(run, result));
}
