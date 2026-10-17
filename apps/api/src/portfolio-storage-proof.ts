import { createHash } from "node:crypto";
import {
  encodePortfolioPayload,
  type ManagedPortfolioCommand,
} from "@research-cockpit/contracts";
import { AppwriteException } from "node-appwrite";
import { createAppwritePortfolioRepository } from "./appwrite-portfolio-repository";
import {
  StorageProofPhase,
  ProofFailure,
  type ProofActor,
  type ProofStoreHooks,
  type OperationTrace,
  type ProofFailureReason,
} from "./appwrite-storage-proof-phase";
import type {
  AppwriteRowLocation,
  AppwriteVersionedRowStore,
} from "./appwrite-versioned-row-store";
import {
  PORTFOLIO_PROOF_COMMAND_PINS,
  PORTFOLIO_PROOF_LIMITS,
  PORTFOLIO_PROOF_PHASES,
  PORTFOLIO_PROOF_PLAN_SHA256,
  PORTFOLIO_PROOF_PRINCIPALS,
  PORTFOLIO_PROOF_ROWS,
  PORTFOLIO_PROOF_TARGET,
  portfolioProofData,
  portfolioProofLocation,
  type PortfolioProofCommandName,
  type PortfolioProofOwner,
  type PortfolioProofPhase,
} from "./portfolio-proof-data";
import {
  PortfolioRepositoryError,
  type PortfolioReceipt,
  type PortfolioRepositoryErrorCode,
} from "./portfolio-repository";

export interface PortfolioProofOperation {
  newStore(): AppwriteVersionedRowStore;
  snapshot(): {
    readonly requests: number;
    readonly lastStatus: number | null;
    readonly closed: boolean;
  };
  close(): Promise<void>;
}
export type PortfolioProofFactory = (
  signal: AbortSignal,
) => PortfolioProofOperation;
export interface PortfolioProofReport {
  readonly version: 1;
  readonly buildProof: string;
  readonly planSha256: string;
  readonly phase: PortfolioProofPhase;
  readonly outcome: "passed" | "failed" | "incomplete";
  readonly failure: "none" | ProofFailureReason;
  readonly repositoryError: PortfolioRepositoryErrorCode | null;
  readonly operationCount: number;
  readonly httpDispatches: number | null;
  readonly upstreamStatus: number | null;
  readonly elapsedMs: number | null;
  readonly closed: boolean;
  readonly observedVersion: number | null;
  readonly rollbackObserved: boolean;
  readonly cleanupIncomplete: boolean;
  readonly checks: readonly string[];
  readonly rowFingerprints: readonly {
    readonly rowId: string;
    readonly sha256: string;
  }[];
  readonly receipts: readonly {
    readonly rowId: string;
    readonly version: number;
    readonly digestSha256: string;
    readonly committedAt: string;
  }[];
  readonly trace: readonly Readonly<OperationTrace>[];
}
const proofHash = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const rowHash = (row: Raw | undefined) => {
  requireProof(row);
  return proofHash(
    JSON.stringify(
      Object.fromEntries(
        Object.keys(row)
          .sort()
          .map((key) => [key, row[key]]),
      ),
    ),
  );
};
function requireProof(value: unknown): asserts value {
  if (!value) throw new ProofFailure("unexpected_result");
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function applicationTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
function metadataTime(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/u.exec(
      value,
    );
  return (
    match !== null &&
    applicationTime(
      `${match[1]}.${(match[2] ?? "").padEnd(3, "0").slice(0, 3)}Z`,
    )
  );
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
type Raw = Record<string, unknown>;
type Outcome =
  { ok: true; receipt: PortfolioReceipt } | { ok: false; error: unknown };
const code = (error: unknown) =>
  error instanceof PortfolioRepositoryError ? error.code : null;

/** One fixed phase per invocation. The external runner must stop on any non-pass. */
export async function runPortfolioStorageProof(
  phase: PortfolioProofPhase,
  buildProof: string,
  factory: PortfolioProofFactory,
): Promise<PortfolioProofReport> {
  if (
    !PORTFOLIO_PROOF_PHASES.includes(phase) ||
    !/^[0-9a-f]{64}$/u.test(buildProof)
  )
    throw new Error("Invalid proof configuration");
  const data = portfolioProofData(),
    commands = data.commands;
  const lifetime = new StorageProofPhase(PORTFOLIO_PROOF_LIMITS[phase], true);
  const checks: string[] = [];
  const rows = new Map<string, Raw>();
  const absent = new Set<string>();
  const firstCurrent = new Set<PortfolioProofOwner>();
  let operation: PortfolioProofOperation | undefined;
  let repositoryError: PortfolioRepositoryErrorCode | null = null;
  let observedVersion: number | null = null;
  let outcome: PortfolioProofReport["outcome"];
  let failure: PortfolioProofReport["failure"] = "none";
  const predecessor: Record<PortfolioProofPhase, number> = {
    preflight: 0,
    create: 0,
    isolation: 0,
    stale: 1,
    prestage: 2,
    overlap: 3,
    rollback: 4,
    unknown: 4,
    reopen: 5,
    capacity: 0,
    "domain-guards": 5,
  };
  function command(
    owner: PortfolioProofOwner,
    name: PortfolioProofCommandName,
  ) {
    const available: Readonly<
      Partial<Record<PortfolioProofCommandName, ManagedPortfolioCommand>>
    > = commands[owner];
    const found = available[name];
    requireProof(found);
    return found;
  }
  const pin = (owner: PortfolioProofOwner, name: PortfolioProofCommandName) => {
    const found = PORTFOLIO_PROOF_COMMAND_PINS.find(
      (item) => item.owner === owner && item.name === name,
    );
    requireProof(found);
    return found;
  };
  const currentCommand = (
    owner: PortfolioProofOwner,
    version: number,
  ): PortfolioProofCommandName =>
    owner === "size"
      ? "capacity"
      : owner === "b"
        ? "create"
        : (
            [
              "create",
              "stale-winner",
              "prestage-winner",
              "overlap-winner",
              "unknown",
            ] as const
          )[version - 1]!;
  function target(input: AppwriteRowLocation) {
    const allowed = PORTFOLIO_PROOF_ROWS.find(
      (row) =>
        row.databaseId === input.databaseId &&
        row.tableId === input.tableId &&
        row.rowId === input.rowId,
    );
    requireProof(allowed);
    return allowed;
  }
  function inspect(input: AppwriteRowLocation, value: unknown) {
    const location = target(input);
    requireProof(object(value));
    const fields =
      location.name === null
        ? [
            "ownerId",
            "resourceId",
            "version",
            "payloadJson",
            "digestSha256",
            "createdAt",
            "updatedAt",
          ]
        : [
            "ownerId",
            "resourceId",
            "keyDigest",
            "requestDigest",
            "version",
            "digestSha256",
            "committedAt",
          ];
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
        value.$permissions.length === 0,
    );
    requireProof(
      value.ownerId === PORTFOLIO_PROOF_PRINCIPALS[location.owner].userId &&
        value.resourceId === "main" &&
        typeof value.version === "number" &&
        Number.isSafeInteger(value.version) &&
        value.version > 0,
    );
    if (location.name === null) {
      requireProof(
        applicationTime(value.createdAt) &&
          applicationTime(value.updatedAt) &&
          value.createdAt <= value.updatedAt,
      );
      const name = currentCommand(location.owner, value.version);
      requireProof(
        name &&
          value.payloadJson ===
            encodePortfolioPayload(command(location.owner, name).payload) &&
          value.digestSha256 === proofHash(value.payloadJson),
      );
      if (!firstCurrent.has(location.owner)) {
        const expected =
          phase === "isolation" && location.owner === "a"
            ? 1
            : predecessor[phase];
        requireProof(value.version === expected);
        firstCurrent.add(location.owner);
      }
      observedVersion = value.version;
    } else {
      const expected = pin(location.owner, location.name);
      requireProof(location.expectedPresentAfterProof);
      requireProof(
        value.keyDigest === expected.keySha256 &&
          value.requestDigest === expected.requestSha256 &&
          value.version === expected.expectedVersion + 1 &&
          value.digestSha256 === expected.payloadSha256 &&
          applicationTime(value.committedAt),
      );
    }
    rows.set(input.rowId, structuredClone(value));
    absent.delete(input.rowId);
  }
  function readError(input: AppwriteRowLocation, error: unknown) {
    const location = target(input);
    if (
      error instanceof AppwriteException &&
      error.code === 404 &&
      error.type === "row_not_found"
    ) {
      absent.add(input.rowId);
      rows.delete(input.rowId);
      if (location.name === null && !firstCurrent.has(location.owner)) {
        requireProof(predecessor[phase] === 0);
        firstCurrent.add(location.owner);
      }
    }
  }
  function store(hooks: ProofStoreHooks = {}, actor: ProofActor = "writer") {
    return lifetime.store(
      operation!.newStore(),
      { ...hooks, visit: target, read: inspect, readError },
      actor,
    );
  }
  function repository(
    owner: PortfolioProofOwner,
    hooks: ProofStoreHooks = {},
    actor: ProofActor = "writer",
    catalog: "original" | "revised" | "rebound" = "original",
    negativeClock = false,
  ) {
    return createAppwritePortfolioRepository({
      store: store(hooks, actor),
      databaseId: PORTFOLIO_PROOF_TARGET.databaseId,
      portfoliosTableId: "portfolios",
      receiptsTableId: "receipts",
      catalog:
        catalog === "revised"
          ? data.revisedCatalog
          : catalog === "rebound"
            ? data.reboundCatalog
            : data.catalog,
      ...(negativeClock
        ? { now: () => new Date("2000-01-01T00:00:00.000Z") }
        : {}),
    });
  }
  function put(
    owner: PortfolioProofOwner,
    name: PortfolioProofCommandName,
    hooks: ProofStoreHooks = {},
    actor: ProofActor = "writer",
    catalog: "original" | "revised" | "rebound" = "original",
    negativeClock = false,
  ) {
    const promise = repository(owner, hooks, actor, catalog, negativeClock)
      .put(PORTFOLIO_PROOF_PRINCIPALS[owner], command(owner, name))
      .then(
        (receipt) => ({ ok: true as const, receipt }),
        (error: unknown) => ({ ok: false as const, error }),
      );
    lifetime.actors.push(promise);
    return promise;
  }
  async function success(
    owner: PortfolioProofOwner,
    name: PortfolioProofCommandName,
    hooks: ProofStoreHooks = {},
    actor: ProofActor = "writer",
    catalog: "original" | "revised" | "rebound" = "original",
  ) {
    const result = await lifetime.bounded(
      put(owner, name, hooks, actor, catalog),
    );
    if (!result.ok) throw result.error;
    requireProof(
      !result.receipt.replayed &&
        result.receipt.version === command(owner, name).expectedVersion + 1 &&
        result.receipt.digestSha256 ===
          proofHash(encodePortfolioPayload(command(owner, name).payload)) &&
        applicationTime(result.receipt.committedAt),
    );
    return result.receipt;
  }
  async function refusal(
    task: Promise<Outcome>,
    expected: PortfolioRepositoryErrorCode,
  ) {
    const result = await lifetime.bounded(task);
    repositoryError = result.ok ? null : code(result.error);
    requireProof(!result.ok && repositoryError === expected);
  }
  async function read(owner: PortfolioProofOwner, version: number) {
    const result = await repository(owner, {}, "read").get(
      PORTFOLIO_PROOF_PRINCIPALS[owner],
    );
    requireProof(
      version === 0
        ? result === null
        : result !== null && result.version === version,
    );
    observedVersion = version;
  }
  async function rawReceipt(
    owner: PortfolioProofOwner,
    name: PortfolioProofCommandName,
  ) {
    await store({}, "inspection").getRow(portfolioProofLocation(owner, name));
  }
  function joined(owner: PortfolioProofOwner, name: PortfolioProofCommandName) {
    const current = rows.get(portfolioProofLocation(owner).rowId),
      receipt = rows.get(portfolioProofLocation(owner, name).rowId);
    requireProof(
      current &&
        receipt &&
        current.version === receipt.version &&
        current.digestSha256 === receipt.digestSha256 &&
        current.updatedAt === receipt.committedAt,
    );
  }
  async function replay(
    owner: PortfolioProofOwner,
    name: PortfolioProofCommandName,
    negativeClock = false,
    catalog: "original" | "revised" | "rebound" = "original",
  ) {
    const result = await lifetime.bounded(
      put(owner, name, {}, "replay", catalog, negativeClock),
    );
    requireProof(
      result.ok &&
        result.receipt.replayed &&
        result.receipt.version === command(owner, name).expectedVersion + 1 &&
        result.receipt.digestSha256 === pin(owner, name).payloadSha256 &&
        applicationTime(result.receipt.committedAt),
    );
    const saved = rows.get(portfolioProofLocation(owner, name).rowId);
    requireProof(
      saved &&
        saved.version === result.receipt.version &&
        saved.digestSha256 === result.receipt.digestSha256 &&
        saved.committedAt === result.receipt.committedAt,
    );
    return result.receipt;
  }
  async function requireAbsent(
    owner: PortfolioProofOwner,
    name: PortfolioProofCommandName,
  ) {
    const location = portfolioProofLocation(owner, name);
    absent.delete(location.rowId);
    try {
      await store({}, "inspection").getRow(location);
    } catch (error) {
      if (!(
        error instanceof AppwriteException &&
        error.code === 404 &&
        error.type === "row_not_found"
      ))
        throw error;
    }
    requireProof(absent.has(location.rowId));
  }
  try {
    operation = factory(lifetime.controller.signal);
    if (phase === "preflight") {
      requireProof(PORTFOLIO_PROOF_ROWS.length === 17);
      for (const location of PORTFOLIO_PROOF_ROWS) {
        try {
          await store({}, "inspection").getRow(location);
        } catch (error) {
          if (!(
            error instanceof AppwriteException &&
            error.code === 404 &&
            error.type === "row_not_found"
          ))
            throw error;
        }
        requireProof(absent.has(location.rowId));
      }
      checks.push("17_exact_locations_absent");
    } else if (phase === "create") {
      await read("a", 0);
      const saved = await success("a", "create");
      await read("a", 1);
      const receipt = await replay("a", "create");
      requireProof(receipt.committedAt === saved.committedAt);
      joined("a", "create");
      checks.push("canonical_create", "receipt_first_replay");
    } else if (phase === "isolation") {
      await read("b", 0);
      await success("b", "create");
      await read("a", 1);
      await read("b", 1);
      await replay("b", "create");
      joined("b", "create");
      checks.push("principal_namespaces_independent");
    } else if (phase === "stale") {
      await success("a", "stale-winner", {}, "winner");
      await refusal(put("a", "stale-loser", {}, "loser"), "conflict");
      await replay("a", "create");
      await read("a", 2);
      await rawReceipt("a", "stale-winner");
      joined("a", "stale-winner");
      await requireAbsent("a", "stale-loser");
      checks.push(
        "stale_refused",
        "original_receipt_retained",
        "loser_receipt_absent",
      );
    } else if (phase === "prestage") {
      const ready = lifetime.barrier(),
        release = lifetime.barrier();
      const loser = put(
        "a",
        "prestage-loser",
        {
          beforeIncrement: async () => {
            ready.release();
            await release.wait();
          },
        },
        "loser",
      );
      if (
        !(await Promise.race([
          ready.wait().then(() => true),
          loser.then(() => false),
        ]))
      )
        throw new ProofFailure("stage_not_reached");
      await success("a", "prestage-winner", {}, "winner");
      release.release();
      await refusal(loser, "conflict");
      // Conflict reconciliation need not read current on every supported path.
      await read("a", 3);
      await rawReceipt("a", "prestage-winner");
      joined("a", "prestage-winner");
      await requireAbsent("a", "prestage-loser");
      // A commit-time rejection has no separate client rollback. The dedicated
      // rollback phase below still requires its acknowledged rollback.
      checks.push(
        "prestage_CAS_refusal",
        "winner_current_and_receipt_preserved",
        "loser_receipt_absent",
      );
    } else if (phase === "overlap") {
      const ready = lifetime.barrier(),
        release = lifetime.barrier();
      const loser = put(
        "a",
        "overlap-loser",
        {
          beforeCommit: async () => {
            ready.release();
            await release.wait();
          },
        },
        "loser",
      );
      if (
        !(await Promise.race([
          ready.wait().then(() => true),
          loser.then(() => false),
        ]))
      )
        throw new ProofFailure("stage_not_reached");
      await success("a", "overlap-winner", {}, "winner");
      release.release();
      await refusal(loser, "conflict");
      await read("a", 4);
      await rawReceipt("a", "overlap-winner");
      joined("a", "overlap-winner");
      await requireAbsent("a", "overlap-loser");
      checks.push("overlap_one_winner", "loser_receipt_absent");
    } else if (phase === "rollback") {
      let fingerprint: string | undefined;
      await refusal(
        put("a", "rollback", {
          beforeReceipt: () => {
            fingerprint = rowHash(rows.get(portfolioProofLocation("a").rowId));
            throw new AppwriteException("Synthetic proof interruption", 403);
          },
        }),
        "access_denied",
      );
      requireProof(lifetime.rollbackObserved);
      await read("a", 4);
      requireProof(
        fingerprint === rowHash(rows.get(portfolioProofLocation("a").rowId)),
      );
      // This post-rollback read must be fresh, not the pre-write absence.
      absent.delete(portfolioProofLocation("a", "rollback").rowId);
      await requireAbsent("a", "rollback");
      await rawReceipt("a", "overlap-winner");
      joined("a", "overlap-winner");
      checks.push(
        "rollback_unchanged_row_and_metadata",
        "rollback_receipt_absent",
      );
    } else if (phase === "unknown") {
      let acknowledged = false;
      await refusal(
        put("a", "unknown", {
          afterCommit: (input, result) => {
            requireProof(
              object(result) &&
                result.$id === input.transactionId &&
                result.status === "committed",
            );
            acknowledged = true;
            throw new Error("Synthetic acknowledgment suppression");
          },
        }),
        "commit_unknown",
      );
      requireProof(acknowledged);
      requireProof(!lifetime.rollbackObserved);
      const before = lifetime.count;
      await replay("a", "unknown");
      requireProof(lifetime.count === before + 1);
      await read("a", 5);
      joined("a", "unknown");
      checks.push(
        "real_commit_ack_locally_suppressed",
        "receipt_only_replay_no_second_commit",
      );
    } else if (phase === "reopen") {
      await read("a", 5);
      await replay("a", "unknown");
      joined("a", "unknown");
      checks.push("fresh_invocation_reopen");
    } else if (phase === "capacity") {
      requireProof(
        Buffer.byteLength(
          encodePortfolioPayload(commands.size.capacity.payload),
        ) === pin("size", "capacity").payloadBytes,
      );
      await success("size", "capacity");
      await read("size", 1);
      await rawReceipt("size", "capacity");
      joined("size", "capacity");
      const before = lifetime.count;
      const over = data.overCapacityCommand;
      try {
        await repository("size").put(PORTFOLIO_PROOF_PRINCIPALS.size, over);
        throw new ProofFailure("unexpected_result");
      } catch (error) {
        requireProof(code(error) === "invalid_request");
      }
      requireProof(lifetime.count === before);
      checks.push(
        "measured_cardinality_cap_payload",
        "over_bound_zero_port_calls",
      );
    } else {
      requireProof(new Date().toISOString().slice(0, 10) < "9999-12-30");
      await replay("a", "create", true, "revised");
      const historical = await repository("a", {}, "read", "revised").get(
        PORTFOLIO_PROOF_PRINCIPALS.a,
      );
      requireProof(historical?.version === 5);
      await refusal(put("a", "future"), "invalid_request");
      await refusal(
        put("a", "stale-catalog", {}, "writer", "revised"),
        "invalid_request",
      );
      await refusal(
        put("a", "rebind", {}, "writer", "rebound"),
        "invalid_request",
      );
      for (const name of ["future", "stale-catalog", "rebind"] as const)
        await requireAbsent("a", name);
      requireProof(
        lifetime.trace.every((item) => item.operation.startsWith("read_")),
      );
      checks.push(
        "original_receipt_replay_after_version_catalog_clock_change",
        "historical_ledger_readable",
        "future_activity_refused",
        "stale_catalog_refused",
        "retained_stable_rebind_refused",
        "guard_receipts_absent_no_transaction",
      );
    }
    outcome = "passed";
  } catch (error) {
    repositoryError = code(error) ?? repositoryError;
    failure = lifetime.controller.signal.aborted
      ? "deadline"
      : lifetime.limitReached
        ? "operation_limit"
        : error instanceof ProofFailure
          ? error.reason
          : "operation_failed";
    outcome = ["deadline", "operation_limit", "stage_not_reached"].includes(
      failure,
    )
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
        snapshot.requests <= 20 &&
        (snapshot.lastStatus === null ||
          (Number.isInteger(snapshot.lastStatus) &&
            snapshot.lastStatus >= 100 &&
            snapshot.lastStatus <= 599)) &&
        typeof snapshot.closed === "boolean",
    );
    // Each store method has one dispatch, except the deliberate beforeReceipt
    // interruption. A passed report cannot conceal an extra/missing dispatch.
    if (outcome === "passed")
      requireProof(
        snapshot.requests === lifetime.count - (phase === "rollback" ? 1 : 0),
      );
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
  const report: PortfolioProofReport = {
    version: 1,
    buildProof,
    planSha256: PORTFOLIO_PROOF_PLAN_SHA256,
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
    observedVersion,
    rollbackObserved: lifetime.rollbackObserved,
    cleanupIncomplete:
      lifetime.rollbackIncomplete || failure === "cleanup_failed",
    checks,
    rowFingerprints: [...rows].map(([rowId, row]) => ({
      rowId,
      sha256: rowHash(row),
    })),
    receipts: [...rows]
      .filter(([, row]) => row.$tableId === "receipts")
      .map(([rowId, row]) => ({
        rowId,
        version: row.version as number,
        digestSha256: row.digestSha256 as string,
        committedAt: row.committedAt as string,
      })),
    trace: lifetime.trace.map((item) => ({ ...item })),
  };
  requireProof(Buffer.byteLength(JSON.stringify(report)) <= 8192);
  return report;
}
