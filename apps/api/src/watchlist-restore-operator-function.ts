import { ProjectKeyScopes, Runtime } from "node-appwrite";
import type { OperationTrace } from "./appwrite-storage-proof-phase";
import type { WatchlistRestoreProofReport } from "./watchlist-storage-restore-proof";
import {
  WATCHLIST_RESTORE_PROOF_COMMAND_PINS,
  WATCHLIST_RESTORE_PROOF_PRINCIPAL,
  WATCHLIST_RESTORE_PROOF_TIMES,
  watchlistRestoreProofHash,
  WATCHLIST_RESTORE_PROOF_LIMITS,
  WATCHLIST_RESTORE_PROOF_PHASES,
  WATCHLIST_RESTORE_PROOF_PLAN_SHA256,
  WATCHLIST_RESTORE_PROOF_ROWS,
  type WatchlistRestoreProofPhase,
} from "./watchlist-restore-proof-data";

export const WATCHLIST_RESTORE_OPERATOR_FUNCTION_ID =
  "investment_watchlist_restore_v1";
export const WATCHLIST_RESTORE_OPERATOR_BUILD_PROOF =
  "cb6a6f9cd005bf554fa32ac2436195b53fd4cd4473dff49f721edd5869f966f4";
export const WATCHLIST_RESTORE_OPERATOR_FUNCTION_SETTINGS = Object.freeze({
  functionId: WATCHLIST_RESTORE_OPERATOR_FUNCTION_ID,
  name: "Investment Watchlist Restore Qualification",
  runtime: Runtime.Node24,
  execute: Object.freeze([] as string[]),
  events: Object.freeze([] as string[]),
  schedule: "",
  timeout: 15,
  enabled: true,
  logging: false,
  entrypoint: "main.js",
  commands: "node --check main.js",
  scopes: Object.freeze([
    ProjectKeyScopes.RowsRead,
    ProjectKeyScopes.RowsWrite,
  ]),
  buildSpecification: "s-2vcpu-2gb",
  runtimeSpecification: "s-0.5vcpu-512mb",
  deploymentRetention: 0,
  installationId: "",
  providerRepositoryId: "",
  providerBranch: "",
  providerRootDirectory: "",
  providerBranches: Object.freeze([] as string[]),
  providerPaths: Object.freeze([] as string[]),
});

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
type Row = Record<string, unknown>;
function requireEvidence(value: unknown): asserts value {
  if (!value) throw new Error("Invalid Watchlist restore operator evidence");
}
function bounded<T>(action: () => T): T {
  try {
    return action();
  } catch {
    throw new Error("Invalid Watchlist restore operator evidence");
  }
}
function sdkStringifier(key: string, descriptor: PropertyDescriptor): boolean {
  return (
    key === "toString" &&
    !descriptor.enumerable &&
    typeof descriptor.value === "function"
  );
}
function jsonDataValue(descriptor: PropertyDescriptor): unknown {
  requireEvidence(descriptor.enumerable && Object.hasOwn(descriptor, "value"));
  const value: unknown = descriptor.value;
  if (typeof value === "string")
    requireEvidence(Buffer.byteLength(value) <= 65536);
  if (Array.isArray(value)) requireEvidence(value.length <= 128);
  return value;
}
/** Copy only own data properties; SDK29 adds a nonenumerable toString method. */
function record(value: unknown): Row {
  requireEvidence(
    value !== null && typeof value === "object" && !Array.isArray(value),
  );
  const result: Row = {};
  const descriptors = Object.getOwnPropertyDescriptors(value);
  requireEvidence(Reflect.ownKeys(descriptors).length <= 64);
  for (const key of Reflect.ownKeys(descriptors)) {
    requireEvidence(typeof key === "string");
    const descriptor = descriptors[key]!;
    if (sdkStringifier(key, descriptor)) continue;
    Object.defineProperty(result, key, {
      value: jsonDataValue(descriptor),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return result;
}
function nonnegativeNumber(
  value: unknown,
  maximum: number,
): asserts value is number {
  requireEvidence(
    typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= maximum,
  );
}
function safeCount(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER,
): asserts value is number {
  nonnegativeNumber(value, maximum);
  requireEvidence(Number.isSafeInteger(value));
}
function emptyMetadataFields(row: Row, keys: readonly string[]) {
  for (const key of keys)
    if (Object.hasOwn(row, key)) requireEvidence(row[key] === "");
}

function exactKeys(row: Row, keys: readonly string[]) {
  requireEvidence(
    Object.keys(row).length === keys.length &&
      keys.every((key) => Object.hasOwn(row, key)),
  );
}
function identifier(value: unknown): asserts value is string {
  requireEvidence(typeof value === "string" && ID.test(value));
}
function timestamp(value: unknown) {
  requireEvidence(typeof value === "string" && value.length <= 40);
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/u.exec(
      value,
    );
  requireEvidence(match);
  const normalized = `${match[1]}.${(match[2] ?? "").padEnd(3, "0").slice(0, 3)}Z`;
  requireEvidence(
    Number.isFinite(Date.parse(normalized)) &&
      new Date(normalized).toISOString() === normalized,
  );
}
function metadata(row: Row) {
  for (const key of ["$createdAt", "$updatedAt"]) {
    if (!Object.hasOwn(row, key)) continue;
    timestamp(row[key]);
  }
  if (Object.hasOwn(row, "buildDuration")) {
    nonnegativeNumber(row.buildDuration, Number.MAX_SAFE_INTEGER);
  }
}

function equalList(value: unknown, expected: readonly string[]) {
  requireEvidence(Array.isArray(value) && value.length === expected.length);
  requireEvidence(Object.keys(value).length === expected.length);
  requireEvidence(
    expected.every((item, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      return (
        descriptor?.enumerable &&
        Object.hasOwn(descriptor, "value") &&
        descriptor.value === item
      );
    }),
  );
}

export function inspectRestoreFunction(
  value: unknown,
  deploymentId?: string,
): void {
  bounded(() => {
    const row = record(value);
    metadata(row);
    requireEvidence(row.$id === WATCHLIST_RESTORE_OPERATOR_FUNCTION_ID);
    for (const [key, expected] of Object.entries(
      WATCHLIST_RESTORE_OPERATOR_FUNCTION_SETTINGS,
    )) {
      if (key === "functionId") continue;
      if (Array.isArray(expected)) equalList(row[key], expected);
      else requireEvidence(row[key] === expected);
    }
    if (Object.hasOwn(row, "vars")) equalList(row.vars, []);
    if (Object.hasOwn(row, "providerSilentMode"))
      requireEvidence(typeof row.providerSilentMode === "boolean");
    if (deploymentId !== undefined) {
      identifier(deploymentId);
      requireEvidence(row.deploymentId === deploymentId && row.live === true);
    }
  });
}

function deploymentSizes(row: Row) {
  for (const key of ["sourceSize", "buildSize", "totalSize"]) {
    if (!Object.hasOwn(row, key)) continue;
    safeCount(row[key]);
    if (key === "sourceSize") requireEvidence(row[key] <= 2 * 1024 * 1024);
  }
}
const DEPLOYMENT_REPOSITORY_FIELDS = [
  "providerRepositoryName",
  "providerRepositoryOwner",
  "providerRepositoryUrl",
  "providerCommitHash",
  "providerCommitAuthorUrl",
  "providerCommitAuthor",
  "providerCommitMessage",
  "providerCommitUrl",
  "providerBranch",
  "providerBranchUrl",
] as const;

export function inspectRestoreDeployment(
  value: unknown,
  expectation: { readonly deploymentId?: string },
): Readonly<{ id: string; status: "pending" | "ready" }> {
  return bounded(() => {
    const row = record(value);
    metadata(row);
    identifier(row.$id);
    if (expectation.deploymentId !== undefined) {
      identifier(expectation.deploymentId);
      requireEvidence(row.$id === expectation.deploymentId);
    }
    requireEvidence(
      row.resourceId === WATCHLIST_RESTORE_OPERATOR_FUNCTION_ID &&
        row.resourceType === "functions",
    );
    requireEvidence(row.entrypoint === "main.js" && row.activate === false);
    deploymentSizes(row);
    emptyMetadataFields(row, DEPLOYMENT_REPOSITORY_FIELDS);
    if (row.status === "ready")
      return Object.freeze({ id: row.$id, status: "ready" as const });
    requireEvidence(
      ["waiting", "processing", "building"].includes(row.status as string),
    );
    return Object.freeze({ id: row.$id, status: "pending" as const });
  });
}

const CHECKS: Record<WatchlistRestoreProofPhase, readonly string[]> = {
  preflight: [
    "source_four_fixed_locations_absent",
    "distinct_restore_database_absent",
  ],
  seed: [
    "source_two_canonical_versions",
    "source_both_original_receipts",
    "source_application_and_metadata_fingerprints",
  ],
  "verify-restored": [
    "restored_baseline_and_both_receipts",
    "older_original_receipt_only_replay_no_second_commit",
    "next_version_save_at_distinct_target",
    "all_three_target_receipts",
    "target_next_save_receipt_only_replay",
  ],
  "verify-source": [
    "source_baseline_and_original_receipts_retained",
    "source_target_only_receipt_absent",
    "source_read_only_replay",
    "source_application_and_metadata_fingerprints",
  ],
};
type Step = readonly [
  OperationTrace["operation"],
  "ok" | "row_not_found" | "other",
];
const TRACE: Record<WatchlistRestoreProofPhase, readonly Step[]> = {
  preflight: [
    ["read_current", "row_not_found"],
    ["read_receipt", "row_not_found"],
    ["read_receipt", "row_not_found"],
    ["read_receipt", "row_not_found"],
    ["read_current", "other"],
    ["read_receipt", "other"],
    ["read_receipt", "other"],
    ["read_receipt", "other"],
  ],
  seed: [
    ["read_current", "row_not_found"],
    ["read_receipt", "row_not_found"],
    ["read_receipt", "row_not_found"],
    ["read_receipt", "row_not_found"],
    ["read_current", "row_not_found"],
    ["begin", "ok"],
    ["create_current", "ok"],
    ["create_receipt", "ok"],
    ["commit", "ok"],
    ["read_receipt", "row_not_found"],
    ["read_current", "ok"],
    ["begin", "ok"],
    ["increment", "ok"],
    ["update_payload", "ok"],
    ["create_receipt", "ok"],
    ["commit", "ok"],
    ["read_current", "ok"],
    ["read_receipt", "ok"],
    ["read_receipt", "ok"],
  ],
  "verify-restored": [
    ["read_current", "ok"],
    ["read_receipt", "ok"],
    ["read_receipt", "ok"],
    ["read_receipt", "row_not_found"],
    ["read_receipt", "ok"],
    ["read_current", "ok"],
    ["read_receipt", "row_not_found"],
    ["read_current", "ok"],
    ["begin", "ok"],
    ["increment", "ok"],
    ["update_payload", "ok"],
    ["create_receipt", "ok"],
    ["commit", "ok"],
    ["read_current", "ok"],
    ["read_receipt", "ok"],
    ["read_receipt", "ok"],
    ["read_receipt", "ok"],
    ["read_receipt", "ok"],
  ],
  "verify-source": [
    ["read_current", "ok"],
    ["read_receipt", "ok"],
    ["read_receipt", "ok"],
    ["read_receipt", "row_not_found"],
    ["read_receipt", "ok"],
    ["read_current", "ok"],
  ],
};
const TRACE_RESULTS = {
  ok: { outcome: "ok", status: null, errorType: null },
  row_not_found: {
    outcome: "appwrite_error",
    status: 404,
    errorType: "row_not_found",
  },
  other: { outcome: "appwrite_error", status: 404, errorType: "other" },
} as const;
const TRACE_TRANSACTIONS: Partial<
  Record<OperationTrace["operation"], OperationTrace["transactionStatus"]>
> = { begin: "pending", commit: "committed" };
function inspectTraceEntry(value: unknown, index: number, step: Step) {
  const row = record(value);
  const [operation, result] = step;
  const expected = {
    sequence: index + 1,
    actor: "inspection",
    operation,
    ...TRACE_RESULTS[result],
    transactionStatus: TRACE_TRANSACTIONS[operation] ?? null,
  };
  exactKeys(row, Object.keys(expected));
  for (const [key, field] of Object.entries(expected))
    requireEvidence(row[key] === field);
}
function inspectTrace(value: unknown, phase: WatchlistRestoreProofPhase) {
  requireEvidence(Array.isArray(value) && value.length === TRACE[phase].length);
  value.forEach((entry, index) =>
    inspectTraceEntry(entry, index, TRACE[phase][index]!),
  );
}

function applicationFingerprint(version: 1 | 2 | 3, current: boolean): string {
  const pin = WATCHLIST_RESTORE_PROOF_COMMAND_PINS[version - 1]!;
  const identity = {
    ownerId: WATCHLIST_RESTORE_PROOF_PRINCIPAL.userId,
    watchlistId: "main",
    version,
    digestSha256: pin.payloadSha256,
  };
  const fields: Row = current
    ? {
        ...identity,
        payloadJson: pin.payloadJson,
        createdAt: WATCHLIST_RESTORE_PROOF_TIMES[0],
        updatedAt: pin.committedAt,
      }
    : {
        ...identity,
        keyDigest: pin.keySha256,
        requestDigest: pin.requestSha256,
        committedAt: pin.committedAt,
      };
  return watchlistRestoreProofHash(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)),
      ),
    ),
  );
}
function inspectFingerprints(
  value: unknown,
  phase: WatchlistRestoreProofPhase,
) {
  requireEvidence(Array.isArray(value));
  const side = phase === "verify-restored" ? "restored" : "source";
  const expected =
    phase === "preflight"
      ? []
      : WATCHLIST_RESTORE_PROOF_ROWS.filter(
          (row) =>
            row.side === side &&
            row.version !== (phase === "verify-restored" ? -1 : 3),
        );
  requireEvidence(value.length === expected.length);
  value.forEach((entry, index) => {
    const row = record(entry);
    exactKeys(row, ["side", "rowId", "sha256", "applicationSha256"]);
    requireEvidence(row.side === side && row.rowId === expected[index]!.rowId);
    requireEvidence(typeof row.sha256 === "string" && SHA256.test(row.sha256));
    const location = expected[index]!;
    const currentVersion = phase === "verify-restored" ? 3 : 2;
    requireEvidence(
      row.applicationSha256 ===
        applicationFingerprint(
          location.version ?? currentVersion,
          location.version === null,
        ),
    );
  });
}
function reportLifetime(row: Row, phase: WatchlistRestoreProofPhase) {
  requireEvidence(
    row.operationCount === WATCHLIST_RESTORE_PROOF_LIMITS[phase] &&
      row.httpDispatches === row.operationCount,
  );
  requireEvidence(row.upstreamStatus === (phase === "preflight" ? 404 : 200));
  safeCount(row.elapsedMs, 12000);
  requireEvidence(row.closed === true && row.cleanupIncomplete === false);
}
function proofReport(
  value: unknown,
  phase: WatchlistRestoreProofPhase,
): WatchlistRestoreProofReport {
  const row = record(value);
  exactKeys(row, [
    "version",
    "buildProof",
    "planSha256",
    "phase",
    "outcome",
    "failure",
    "repositoryError",
    "operationCount",
    "httpDispatches",
    "upstreamStatus",
    "elapsedMs",
    "closed",
    "cleanupIncomplete",
    "checks",
    "rowFingerprints",
    "trace",
  ]);
  requireEvidence(
    row.version === 1 &&
      row.buildProof === WATCHLIST_RESTORE_OPERATOR_BUILD_PROOF &&
      row.planSha256 === WATCHLIST_RESTORE_PROOF_PLAN_SHA256 &&
      row.phase === phase,
  );
  requireEvidence(
    row.outcome === "passed" &&
      row.failure === "none" &&
      row.repositoryError === null,
  );
  reportLifetime(row, phase);
  equalList(row.checks, CHECKS[phase]);
  inspectTrace(row.trace, phase);
  inspectFingerprints(row.rowFingerprints, phase);
  // The parsed JSON is caller-independent and every field has been admitted above.
  return row as unknown as WatchlistRestoreProofReport;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function executionLifetime(row: Row) {
  requireEvidence(row.status === "completed" && row.responseStatusCode === 200);
  emptyMetadataFields(row, ["scheduledAt"]);
  if (Object.hasOwn(row, "duration")) nonnegativeNumber(row.duration, 15);
  emptyMetadataFields(row, ["logs", "errors"]);
}
function executionIdentity(
  row: Row,
  phase: WatchlistRestoreProofPhase,
  deploymentId: string,
) {
  requireEvidence(
    row.resourceId === WATCHLIST_RESTORE_OPERATOR_FUNCTION_ID &&
      row.resourceType === "functions" &&
      row.deploymentId === deploymentId,
  );
  requireEvidence(
    row.trigger === "http" &&
      row.requestMethod === "POST" &&
      row.requestPath === `/proof/${phase}`,
  );
}

export function decodeRestoreExecution(
  value: unknown,
  expectation: {
    readonly phase: WatchlistRestoreProofPhase;
    readonly deploymentId: string;
  },
): WatchlistRestoreProofReport {
  return bounded(() => {
    requireEvidence(WATCHLIST_RESTORE_PROOF_PHASES.includes(expectation.phase));
    identifier(expectation.deploymentId);
    const row = record(value);
    metadata(row);
    identifier(row.$id);
    executionIdentity(row, expectation.phase, expectation.deploymentId);
    executionLifetime(row);
    requireEvidence(
      typeof row.responseBody === "string" &&
        Buffer.byteLength(row.responseBody) <= 8192,
    );
    const parsed: unknown = JSON.parse(row.responseBody);
    return freeze(proofReport(parsed, expectation.phase));
  });
}
