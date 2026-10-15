import { encodeResearchFollowupsPayload } from "@research-cockpit/contracts";
import { AppwriteException } from "node-appwrite";
import { createAppwriteResearchFollowupsRepository } from "./appwrite-research-followups-repository";
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
  FOLLOWUPS_PROOF_COMMAND_PINS,
  FOLLOWUPS_PROOF_LIMITS,
  FOLLOWUPS_PROOF_PHASES,
  FOLLOWUPS_PROOF_PLAN_SHA256,
  FOLLOWUPS_PROOF_PRINCIPALS,
  FOLLOWUPS_PROOF_ROWS,
  FOLLOWUPS_PROOF_TARGET,
  followupsProofData,
  followupsProofLocation,
  proofHash,
  type ProofCommandName,
  type ProofOwner,
  type ResearchFollowupsProofPhase,
} from "./research-followups-proof-data";
import {
  ResearchFollowupsRepositoryError,
  type ResearchFollowupsReceipt,
  type ResearchFollowupsRepositoryErrorCode,
} from "./research-followups-repository";

export interface ResearchFollowupsProofOperation {
  newStore(): AppwriteVersionedRowStore;
  snapshot(): {
    readonly requests: number;
    readonly lastStatus: number | null;
    readonly closed: boolean;
  };
  close(): Promise<void>;
}
export type ResearchFollowupsProofFactory = (
  signal: AbortSignal,
) => ResearchFollowupsProofOperation;
export interface ResearchFollowupsProofReport {
  readonly version: 1;
  readonly buildProof: string;
  readonly planSha256: string;
  readonly phase: ResearchFollowupsProofPhase;
  readonly outcome: "passed" | "failed" | "incomplete";
  readonly failure: "none" | ProofFailureReason;
  readonly repositoryError: ResearchFollowupsRepositoryErrorCode | null;
  readonly operationCount: number;
  readonly httpDispatches: number;
  readonly upstreamStatus: number | null;
  readonly elapsedMs: number;
  readonly closed: boolean;
  readonly observedVersion: number | null;
  readonly rollbackObserved: boolean;
  readonly cleanupIncomplete: boolean;
  readonly checks: readonly string[];
  readonly rowFingerprints: readonly {
    readonly rowId: string;
    readonly sha256: string;
  }[];
  readonly trace: readonly Readonly<OperationTrace>[];
}
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
  | { ok: true; receipt: ResearchFollowupsReceipt }
  | { ok: false; error: unknown };
const code = (error: unknown) =>
  error instanceof ResearchFollowupsRepositoryError ? error.code : null;

/** One fixed phase per invocation. The external runner must stop on any non-pass. */
export async function runResearchFollowupsStorageProof(
  phase: ResearchFollowupsProofPhase,
  buildProof: string,
  factory: ResearchFollowupsProofFactory,
): Promise<ResearchFollowupsProofReport> {
  if (
    !FOLLOWUPS_PROOF_PHASES.includes(phase) ||
    !/^[0-9a-f]{64}$/u.test(buildProof)
  )
    throw new Error("Invalid proof configuration");
  const data = followupsProofData(),
    commands = data.commands;
  const lifetime = new StorageProofPhase(FOLLOWUPS_PROOF_LIMITS[phase], true);
  const checks: string[] = [];
  const rows = new Map<string, Raw>();
  const absent = new Set<string>();
  const firstCurrent = new Set<ProofOwner>();
  let operation: ResearchFollowupsProofOperation | undefined;
  let repositoryError: ResearchFollowupsRepositoryErrorCode | null = null;
  let observedVersion: number | null = null;
  let outcome: ResearchFollowupsProofReport["outcome"];
  let failure: ResearchFollowupsProofReport["failure"] = "none";
  const predecessor: Record<ResearchFollowupsProofPhase, number> = {
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
    "domain-guards": 1,
  };
  const currentCommand = (
    owner: ProofOwner,
    version: number,
  ): ProofCommandName =>
    owner === "size"
      ? version === 1
        ? "capacity"
        : "retained"
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
    const allowed = FOLLOWUPS_PROOF_ROWS.find(
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
      value.ownerId === FOLLOWUPS_PROOF_PRINCIPALS[location.owner].userId &&
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
          commands[name] &&
          value.payloadJson ===
            encodeResearchFollowupsPayload(commands[name].payload) &&
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
      const pin = FOLLOWUPS_PROOF_COMMAND_PINS.find(
        (item) => item.name === location.name,
      )!;
      requireProof(
        value.keyDigest === proofHash(pin.idempotencyKey) &&
          value.requestDigest === pin.requestSha256 &&
          value.version === pin.expectedVersion + 1 &&
          value.digestSha256 === pin.payloadSha256 &&
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
    owner: ProofOwner,
    hooks: ProofStoreHooks = {},
    actor: ProofActor = "writer",
    revised = false,
    negativeClock = false,
  ) {
    return createAppwriteResearchFollowupsRepository({
      store: store(hooks, actor),
      databaseId: FOLLOWUPS_PROOF_TARGET.databaseId,
      followupsTableId: "followups",
      receiptsTableId: "receipts",
      catalog: revised ? data.revisedCatalog : data.catalog,
      ...(negativeClock
        ? { now: () => new Date("2000-01-01T00:00:00.000Z") }
        : {}),
    });
  }
  function put(
    owner: ProofOwner,
    name: ProofCommandName,
    hooks: ProofStoreHooks = {},
    actor: ProofActor = "writer",
    revised = false,
    negativeClock = false,
  ) {
    const promise = repository(owner, hooks, actor, revised, negativeClock)
      .put(FOLLOWUPS_PROOF_PRINCIPALS[owner], commands[name])
      .then(
        (receipt) => ({ ok: true as const, receipt }),
        (error: unknown) => ({ ok: false as const, error }),
      );
    lifetime.actors.push(promise);
    return promise;
  }
  async function success(
    owner: ProofOwner,
    name: ProofCommandName,
    hooks: ProofStoreHooks = {},
    actor: ProofActor = "writer",
    revised = false,
  ) {
    const result = await lifetime.bounded(
      put(owner, name, hooks, actor, revised),
    );
    if (!result.ok) throw result.error;
    requireProof(
      !result.receipt.replayed &&
        result.receipt.version === commands[name].expectedVersion + 1 &&
        result.receipt.digestSha256 ===
          proofHash(encodeResearchFollowupsPayload(commands[name].payload)) &&
        applicationTime(result.receipt.committedAt),
    );
    return result.receipt;
  }
  async function refusal(
    task: Promise<Outcome>,
    expected: ResearchFollowupsRepositoryErrorCode,
  ) {
    const result = await lifetime.bounded(task);
    repositoryError = result.ok ? null : code(result.error);
    requireProof(!result.ok && repositoryError === expected);
  }
  async function read(owner: ProofOwner, version: number) {
    const result = await repository(owner, {}, "read").get(
      FOLLOWUPS_PROOF_PRINCIPALS[owner],
    );
    requireProof(
      version === 0
        ? result === null
        : result !== null && result.version === version,
    );
    observedVersion = version;
  }
  async function rawReceipt(
    owner: ProofOwner,
    name: Exclude<ProofCommandName, "changed-same-key">,
  ) {
    await store({}, "inspection").getRow(followupsProofLocation(owner, name));
  }
  function joined(
    owner: ProofOwner,
    name: Exclude<ProofCommandName, "changed-same-key">,
  ) {
    const current = rows.get(followupsProofLocation(owner).rowId),
      receipt = rows.get(followupsProofLocation(owner, name).rowId);
    requireProof(
      current &&
        receipt &&
        current.version === receipt.version &&
        current.digestSha256 === receipt.digestSha256 &&
        current.updatedAt === receipt.committedAt,
    );
  }
  async function replay(
    owner: ProofOwner,
    name: ProofCommandName,
    negativeClock = false,
  ) {
    const result = await lifetime.bounded(
      put(owner, name, {}, "replay", false, negativeClock),
    );
    requireProof(
      result.ok &&
        result.receipt.replayed &&
        result.receipt.version === commands[name].expectedVersion + 1,
    );
    return result.receipt;
  }
  async function requireAbsent(
    owner: ProofOwner,
    name: Exclude<ProofCommandName, "changed-same-key">,
  ) {
    const location = followupsProofLocation(owner, name);
    if (!absent.has(location.rowId)) {
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
    }
    requireProof(absent.has(location.rowId));
  }
  try {
    operation = factory(lifetime.controller.signal);
    if (phase === "preflight") {
      requireProof(FOLLOWUPS_PROOF_ROWS.length === 18);
      for (const location of FOLLOWUPS_PROOF_ROWS) {
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
      checks.push("18_exact_locations_absent");
    } else if (phase === "create") {
      await read("a", 0);
      const saved = await success("a", "create");
      await read("a", 1);
      const receipt = await replay("a", "create");
      requireProof(receipt.committedAt === saved.committedAt);
      joined("a", "create");
      await refusal(put("a", "changed-same-key"), "idempotency_conflict");
      checks.push(
        "canonical_create",
        "receipt_first_replay",
        "changed_key_refused",
      );
    } else if (phase === "isolation") {
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
      await rawReceipt("a", "prestage-winner");
      joined("a", "prestage-winner");
      await requireAbsent("a", "prestage-loser");
      requireProof(lifetime.rollbackObserved);
      checks.push("prestage_CAS_refusal", "rollback", "loser_receipt_absent");
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
            fingerprint = proofHash(
              JSON.stringify(rows.get(followupsProofLocation("a").rowId)),
            );
            throw new AppwriteException("Synthetic proof interruption", 403);
          },
        }),
        "access_denied",
      );
      requireProof(lifetime.rollbackObserved);
      await read("a", 4);
      requireProof(
        fingerprint ===
          proofHash(
            JSON.stringify(rows.get(followupsProofLocation("a").rowId)),
          ),
      );
      // This post-rollback read must be fresh, not the pre-write absence.
      absent.delete(followupsProofLocation("a", "rollback").rowId);
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
      requireProof(new Date().toISOString().slice(0, 10) >= "2026-10-15");
      requireProof(
        Buffer.byteLength(
          encodeResearchFollowupsPayload(commands.capacity.payload),
        ) === 250191,
      );
      await success("size", "capacity");
      await read("size", 1);
      await rawReceipt("size", "capacity");
      joined("size", "capacity");
      const before = lifetime.count;
      const over = { ...commands.capacity, payload: data.over };
      try {
        await repository("size").put(FOLLOWUPS_PROOF_PRINCIPALS.size, over);
        throw new ProofFailure("unexpected_result");
      } catch (error) {
        requireProof(code(error) === "invalid_request");
      }
      requireProof(lifetime.count === before);
      checks.push(
        "250191_byte_current_catalog_payload",
        "over_bound_zero_port_calls",
      );
    } else {
      requireProof(new Date().toISOString().slice(0, 10) < "9999-12-31");
      await refusal(put("size", "future"), "invalid_request");
      await refusal(put("size", "rebind"), "invalid_request");
      await refusal(
        put("size", "clock", {}, "writer", false, true),
        "unavailable",
      );
      await replay("size", "capacity", true);
      requireProof(
        lifetime.trace.every((item) => item.operation.startsWith("read_")),
      );
      await success("size", "retained", {}, "writer", true);
      await read("size", 2);
      await rawReceipt("size", "retained");
      joined("size", "retained");
      checks.push(
        "future_completion_refused",
        "stable_identity_rebind_refused",
        "injected_old_clock_write_refused_replay_allowed",
        "retained_snapshot_write",
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
  const snapshot = operation?.snapshot();
  const report: ResearchFollowupsProofReport = {
    version: 1,
    buildProof,
    planSha256: FOLLOWUPS_PROOF_PLAN_SHA256,
    phase,
    outcome,
    failure,
    repositoryError,
    operationCount: lifetime.count,
    httpDispatches: snapshot?.requests ?? 0,
    upstreamStatus: lifetime.upstreamStatus ?? snapshot?.lastStatus ?? null,
    elapsedMs: Math.max(0, Math.round(performance.now() - lifetime.started)),
    closed: snapshot?.closed ?? false,
    observedVersion,
    rollbackObserved: lifetime.rollbackObserved,
    cleanupIncomplete:
      lifetime.rollbackIncomplete || failure === "cleanup_failed",
    checks,
    rowFingerprints: [...rows].map(([rowId, row]) => ({
      rowId,
      sha256: proofHash(JSON.stringify(row)),
    })),
    trace: lifetime.trace.map((item) => ({ ...item })),
  };
  requireProof(Buffer.byteLength(JSON.stringify(report)) <= 8192);
  return report;
}
