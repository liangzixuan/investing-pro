import { createHash } from "node:crypto";

import {
  parsePostgresAcceptanceEvidence,
  serializePostgresAcceptanceEvidence,
  type PostgresAcceptanceEvidence,
} from "./postgres-acceptance-evidence";

export const POSTGRES_ACCEPTANCE_OFFLINE_VERIFICATION_CHECKS = Object.freeze([
  "canonical_record_bytes",
  "external_record_sha256",
  "metadata_anchor_match",
  "reviewed_target_at_commit",
  "recorded_source_hashes_at_commit",
  "migration_manifest_at_commit",
] as const);

export const POSTGRES_ACCEPTANCE_OFFLINE_VERIFIER_NOT_PROVEN = Object.freeze([
  "github_run_or_artifact_authenticity",
  "workflow_logs_or_database_execution",
  "commit_signature_or_branch_reachability",
  "trust_anchor_provenance",
] as const);

const INPUT_KEYS = ["evidenceBytes", "trustAnchors", "sources"] as const;
const TRUST_ANCHOR_KEYS = [
  "evidenceSha256",
  "repository",
  "repositoryId",
  "commitSha",
  "runId",
  "runAttempt",
] as const;
const HISTORICAL_SOURCE_KEYS = [
  "imageConfig",
  "workflow",
  "fixture",
  "migrationManifest",
  "acceptanceRunner",
  "migrations",
] as const;
const PROJECTION_SOURCE_KEYS = [
  ...HISTORICAL_SOURCE_KEYS,
  "projectionQuery",
  "projectionNormalizer",
] as const;
const MIGRATION_SOURCE_KEYS = ["id", "file", "bytes"] as const;
const IMAGE_CONFIG_KEYS = [
  "schemaVersion",
  "repository",
  "tag",
  "indexDigest",
  "reference",
  "mediaType",
  "expectedServerVersion",
  "expectedServerVersionNumber",
  "databaseName",
  "workflowSha256",
  "fixtureSha256",
  "verifiedOn",
  "runner",
] as const;
const IMAGE_RUNNER_KEYS = ["label", "os", "architecture"] as const;
const MANIFEST_KEYS = ["schemaVersion", "algorithm", "migrations"] as const;
const MANIFEST_ENTRY_KEYS = ["id", "file", "sha256"] as const;

const MAX_EVIDENCE_BYTES = 32 * 1024;
const MAX_IMAGE_CONFIG_BYTES = 32 * 1024;
const MAX_WORKFLOW_BYTES = 128 * 1024;
const MAX_FIXTURE_BYTES = 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_RUNNER_BYTES = 2 * 1024 * 1024;
const MAX_PROJECTION_QUERY_BYTES = 2 * 1024 * 1024;
const MAX_PROJECTION_NORMALIZER_BYTES = 2 * 1024 * 1024;
const MAX_MIGRATION_BYTES = 2 * 1024 * 1024;
const MAX_MIGRATIONS = 100;

const SHA256_HEX = /^[0-9a-f]{64}$/;
const SHA1_HEX = /^[0-9a-f]{40}$/;
const POSITIVE_DECIMAL = /^[1-9][0-9]*$/;
const REPOSITORY =
  /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,99})\/[A-Za-z0-9_.-]{1,100}$/;
const MIGRATION_ID = /^\d{4}$/;
const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;

type DataRecord = Readonly<Record<string, unknown>>;

export interface PostgresAcceptanceEvidenceTrustAnchors {
  readonly evidenceSha256: string;
  readonly repository: string;
  readonly repositoryId: string;
  readonly commitSha: string;
  readonly runId: string;
  readonly runAttempt: number;
}

export interface PostgresAcceptanceMigrationSource {
  readonly id: string;
  readonly file: string;
  readonly bytes: Uint8Array;
}

export interface PostgresAcceptanceEvidenceSourceBundle {
  readonly imageConfig: Uint8Array;
  readonly workflow: Uint8Array;
  readonly fixture: Uint8Array;
  readonly migrationManifest: Uint8Array;
  readonly acceptanceRunner: Uint8Array;
  readonly migrations: readonly PostgresAcceptanceMigrationSource[];
  readonly projectionQuery?: Uint8Array;
  readonly projectionNormalizer?: Uint8Array;
}

export interface VerifyPostgresAcceptanceEvidenceOfflineInput {
  readonly evidenceBytes: Uint8Array;
  readonly trustAnchors: PostgresAcceptanceEvidenceTrustAnchors;
  readonly sources: PostgresAcceptanceEvidenceSourceBundle;
}

export interface VerifiedPostgresAcceptanceEvidence {
  readonly schemaVersion: 1;
  readonly verdict: "offline_consistent";
  readonly evidenceSha256: string;
  readonly repository: string;
  readonly repositoryId: string;
  readonly commitSha: string;
  readonly runId: string;
  readonly runAttempt: number;
  readonly completedAt: string;
  readonly verificationChecks: typeof POSTGRES_ACCEPTANCE_OFFLINE_VERIFICATION_CHECKS;
  readonly recordedChecksPassed: PostgresAcceptanceEvidence["checksPassed"];
  readonly recordedNotProven: PostgresAcceptanceEvidence["notProven"];
  readonly verifierNotProven: typeof POSTGRES_ACCEPTANCE_OFFLINE_VERIFIER_NOT_PROVEN;
}

interface NormalizedSources {
  readonly imageConfig: Uint8Array;
  readonly workflow: Uint8Array;
  readonly fixture: Uint8Array;
  readonly migrationManifest: Uint8Array;
  readonly acceptanceRunner: Uint8Array;
  readonly migrations: readonly NormalizedMigrationSource[];
  readonly projectionQuery?: Uint8Array;
  readonly projectionNormalizer?: Uint8Array;
}

interface NormalizedMigrationSource {
  readonly id: string;
  readonly file: string;
  readonly bytes: Uint8Array;
}

interface ReviewedImageConfig {
  readonly indexDigest: string;
  readonly reference: string;
  readonly expectedServerVersion: string;
  readonly expectedServerVersionNumber: number;
  readonly databaseName: string;
  readonly workflowSha256: string;
  readonly fixtureSha256: string;
}

/** A stable, value-free failure for every rejected offline verification. */
export class PostgresAcceptanceEvidenceVerificationError extends Error {
  public readonly code =
    "INVALID_POSTGRES_ACCEPTANCE_EVIDENCE_VERIFICATION" as const;

  public constructor() {
    super("PostgreSQL acceptance evidence offline verification failed.");
    this.name = "PostgresAcceptanceEvidenceVerificationError";
  }
}

/**
 * Verifies canonical evidence bytes against independent metadata anchors and
 * an exact raw source bundle supplied by a commit-aware adapter. This function
 * performs no I/O and does not establish that GitHub or PostgreSQL executed.
 */
export function verifyPostgresAcceptanceEvidenceOffline(
  value: VerifyPostgresAcceptanceEvidenceOfflineInput,
): VerifiedPostgresAcceptanceEvidence {
  try {
    const input = exactPlainDataRecord(value, INPUT_KEYS);
    const evidenceBytes = exactBytes(input.evidenceBytes, MAX_EVIDENCE_BYTES);
    const anchors = normalizeTrustAnchors(input.trustAnchors);
    const evidenceSha256 = sha256(evidenceBytes);
    if (evidenceSha256 !== anchors.evidenceSha256) invalid();

    const evidenceText = decodeUtf8(evidenceBytes);
    const evidence = parsePostgresAcceptanceEvidence(evidenceText);
    const canonicalBytes = new TextEncoder().encode(
      serializePostgresAcceptanceEvidence(evidence),
    );
    if (!sameBytes(evidenceBytes, canonicalBytes)) invalid();

    if (
      evidence.repository !== anchors.repository ||
      evidence.repositoryId !== anchors.repositoryId ||
      evidence.commitSha !== anchors.commitSha ||
      evidence.runId !== anchors.runId ||
      evidence.runAttempt !== anchors.runAttempt
    ) {
      invalid();
    }

    const sources = normalizeSources(input.sources, evidence.schemaVersion);

    const imageConfig = parseReviewedImageConfig(sources.imageConfig);
    if (
      evidence.reviewedImageReference !== imageConfig.reference ||
      evidence.reviewedImageIndexDigest !== imageConfig.indexDigest ||
      evidence.databaseName !== imageConfig.databaseName ||
      evidence.serverVersion !== imageConfig.expectedServerVersion ||
      evidence.serverVersionNumber !==
        String(imageConfig.expectedServerVersionNumber)
    ) {
      invalid();
    }

    if (
      evidence.schemaVersion === 4 ||
      evidence.schemaVersion === 5 ||
      evidence.schemaVersion === 6
    ) {
      if (
        sources.projectionQuery === undefined ||
        sources.projectionNormalizer === undefined ||
        evidence.sourceHashes.projectionQuerySha256 !==
          sha256(sources.projectionQuery) ||
        evidence.sourceHashes.projectionNormalizerSha256 !==
          sha256(sources.projectionNormalizer)
      ) {
        invalid();
      }
    }

    const workflowSha256 = sha256(sources.workflow);
    const fixtureSha256 = sha256(sources.fixture);
    const migrationManifestSha256 = sha256(sources.migrationManifest);
    const acceptanceRunnerSha256 = sha256(sources.acceptanceRunner);
    if (
      evidence.sourceHashes.workflowSha256 !== workflowSha256 ||
      evidence.sourceHashes.fixtureSha256 !== fixtureSha256 ||
      evidence.sourceHashes.migrationManifestSha256 !==
        migrationManifestSha256 ||
      evidence.sourceHashes.acceptanceRunnerSha256 !== acceptanceRunnerSha256 ||
      imageConfig.workflowSha256 !== workflowSha256 ||
      imageConfig.fixtureSha256 !== fixtureSha256
    ) {
      invalid();
    }

    verifyMigrationManifest(sources.migrationManifest, sources.migrations);

    return Object.freeze({
      schemaVersion: 1,
      verdict: "offline_consistent",
      evidenceSha256,
      repository: evidence.repository,
      repositoryId: evidence.repositoryId,
      commitSha: evidence.commitSha,
      runId: evidence.runId,
      runAttempt: evidence.runAttempt,
      completedAt: evidence.completedAt,
      verificationChecks: POSTGRES_ACCEPTANCE_OFFLINE_VERIFICATION_CHECKS,
      recordedChecksPassed: evidence.checksPassed,
      recordedNotProven: evidence.notProven,
      verifierNotProven: POSTGRES_ACCEPTANCE_OFFLINE_VERIFIER_NOT_PROVEN,
    });
  } catch {
    throw new PostgresAcceptanceEvidenceVerificationError();
  }
}

function normalizeTrustAnchors(
  value: unknown,
): PostgresAcceptanceEvidenceTrustAnchors {
  const anchors = exactPlainDataRecord(value, TRUST_ANCHOR_KEYS);
  return Object.freeze({
    evidenceSha256: sha256Hex(anchors.evidenceSha256),
    repository: githubRepository(anchors.repository),
    repositoryId: positiveDecimalString(anchors.repositoryId),
    commitSha: sha1Hex(anchors.commitSha),
    runId: positiveDecimalString(anchors.runId),
    runAttempt: positiveSafeInteger(anchors.runAttempt),
  });
}

function normalizeSources(
  value: unknown,
  schemaVersion: PostgresAcceptanceEvidence["schemaVersion"],
): NormalizedSources {
  if (usesProjectionSources(schemaVersion)) {
    const sources = exactPlainDataRecord(value, PROJECTION_SOURCE_KEYS);
    return normalizeSourceFields(sources, {
      projectionQuery: exactBytes(
        sources.projectionQuery,
        MAX_PROJECTION_QUERY_BYTES,
      ),
      projectionNormalizer: exactBytes(
        sources.projectionNormalizer,
        MAX_PROJECTION_NORMALIZER_BYTES,
      ),
    });
  }
  return normalizeSourceFields(
    exactPlainDataRecord(value, HISTORICAL_SOURCE_KEYS),
  );
}

function usesProjectionSources(
  schemaVersion: PostgresAcceptanceEvidence["schemaVersion"],
): schemaVersion is 4 | 5 | 6 {
  return schemaVersion === 4 || schemaVersion === 5 || schemaVersion === 6;
}

function normalizeSourceFields(
  sources: DataRecord & {
    readonly imageConfig: unknown;
    readonly workflow: unknown;
    readonly fixture: unknown;
    readonly migrationManifest: unknown;
    readonly acceptanceRunner: unknown;
    readonly migrations: unknown;
  },
  v4Sources: Pick<
    NormalizedSources,
    "projectionQuery" | "projectionNormalizer"
  > = {},
): NormalizedSources {
  const migrations = exactDataArray(sources.migrations, MAX_MIGRATIONS, false);
  return Object.freeze({
    imageConfig: exactBytes(sources.imageConfig, MAX_IMAGE_CONFIG_BYTES),
    workflow: exactBytes(sources.workflow, MAX_WORKFLOW_BYTES),
    fixture: exactBytes(sources.fixture, MAX_FIXTURE_BYTES),
    migrationManifest: exactBytes(
      sources.migrationManifest,
      MAX_MANIFEST_BYTES,
    ),
    acceptanceRunner: exactBytes(sources.acceptanceRunner, MAX_RUNNER_BYTES),
    migrations: Object.freeze(
      migrations.map((migration) => normalizeMigrationSource(migration)),
    ),
    ...v4Sources,
  });
}

function normalizeMigrationSource(value: unknown): NormalizedMigrationSource {
  const migration = exactPlainDataRecord(value, MIGRATION_SOURCE_KEYS);
  return Object.freeze({
    id: migrationId(migration.id),
    file: migrationFile(migration.file),
    bytes: exactBytes(migration.bytes, MAX_MIGRATION_BYTES),
  });
}

function parseReviewedImageConfig(bytes: Uint8Array): ReviewedImageConfig {
  const value = exactPlainDataRecord(
    parseCanonicalJson(bytes),
    IMAGE_CONFIG_KEYS,
  );
  const runner = exactPlainDataRecord(value.runner, IMAGE_RUNNER_KEYS);
  const indexDigest = sha256Digest(value.indexDigest);
  const workflowSha256 = sha256Hex(value.workflowSha256);
  const fixtureSha256 = sha256Hex(value.fixtureSha256);
  if (
    value.schemaVersion !== 1 ||
    value.repository !== "docker.io/library/postgres" ||
    value.tag !== "17.11-bookworm" ||
    value.reference !== `${value.repository}:${value.tag}@${indexDigest}` ||
    value.mediaType !== "application/vnd.oci.image.index.v1+json" ||
    value.expectedServerVersion !== "17.11" ||
    value.expectedServerVersionNumber !== 170011 ||
    value.databaseName !== "research_cockpit_acceptance_test" ||
    !isCanonicalDate(value.verifiedOn) ||
    runner.label !== "ubuntu-24.04" ||
    runner.os !== "linux" ||
    runner.architecture !== "amd64"
  ) {
    invalid();
  }
  return Object.freeze({
    indexDigest,
    reference: value.reference,
    expectedServerVersion: value.expectedServerVersion,
    expectedServerVersionNumber: value.expectedServerVersionNumber,
    databaseName: value.databaseName,
    workflowSha256,
    fixtureSha256,
  });
}

function verifyMigrationManifest(
  manifestBytes: Uint8Array,
  migrationSources: readonly NormalizedMigrationSource[],
): void {
  const manifest = exactPlainDataRecord(
    parseCanonicalJson(manifestBytes),
    MANIFEST_KEYS,
  );
  if (manifest.schemaVersion !== 1 || manifest.algorithm !== "sha256") {
    invalid();
  }
  const entries = exactDataArray(manifest.migrations, MAX_MIGRATIONS, false);
  if (entries.length !== migrationSources.length) invalid();

  entries.forEach((entryValue, index) => {
    const entry = exactPlainDataRecord(entryValue, MANIFEST_ENTRY_KEYS);
    const id = migrationId(entry.id);
    const file = migrationFile(entry.file);
    const expectedId = String(index + 1).padStart(4, "0");
    const expectedHash = sha256Hex(entry.sha256);
    const source = migrationSources[index];
    if (
      source === undefined ||
      id !== expectedId ||
      !file.startsWith(`${id}_`) ||
      source.id !== id ||
      source.file !== file ||
      sha256(source.bytes) !== expectedHash
    ) {
      invalid();
    }
  });
}

function parseCanonicalJson(bytes: Uint8Array): unknown {
  const text = decodeUtf8(bytes);
  const parsed = JSON.parse(text) as unknown;
  const canonical = new TextEncoder().encode(
    `${JSON.stringify(parsed, null, 2)}\n`,
  );
  if (!sameBytes(bytes, canonical)) invalid();
  return parsed;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function exactPlainDataRecord<const Keys extends readonly string[]>(
  value: unknown,
  expectedKeys: Keys,
): DataRecord & { readonly [Key in Keys[number]]: unknown } {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    invalid();
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !keys.includes(key)) ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    invalid();
  }
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) invalid();
  }
  return value as DataRecord & {
    readonly [Key in Keys[number]]: unknown;
  };
}

function exactDataArray(
  value: unknown,
  maximumLength: number,
  allowEmpty: boolean,
): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length > maximumLength ||
    (!allowEmpty && value.length === 0)
  ) {
    invalid();
  }
  const keys = Reflect.ownKeys(value);
  const expectedKeys = [
    ...Array.from({ length: value.length }, (_, index) => String(index)),
    "length",
  ];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    invalid();
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.value !== value.length
  ) {
    invalid();
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) invalid();
  }
  return value;
}

function exactBytes(value: unknown, maximumLength: number): Uint8Array {
  if (
    !(value instanceof Uint8Array) ||
    Object.getPrototypeOf(value) !== Uint8Array.prototype ||
    !(value.buffer instanceof ArrayBuffer) ||
    value.byteLength === 0 ||
    value.byteLength > maximumLength
  ) {
    invalid();
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== value.byteLength ||
    keys.some((key, index) => key !== String(index))
  ) {
    invalid();
  }
  return new Uint8Array(value);
}

function githubRepository(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 201 ||
    !REPOSITORY.test(value)
  ) {
    invalid();
  }
  return value;
}

function positiveDecimalString(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 20 ||
    !POSITIVE_DECIMAL.test(value)
  ) {
    invalid();
  }
  return value;
}

function positiveSafeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    invalid();
  }
  return value;
}

function sha1Hex(value: unknown): string {
  if (typeof value !== "string" || !SHA1_HEX.test(value)) invalid();
  return value;
}

function sha256Hex(value: unknown): string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) invalid();
  return value;
}

function sha256Digest(value: unknown): string {
  if (typeof value !== "string" || !SHA256_DIGEST.test(value)) invalid();
  return value;
}

function migrationId(value: unknown): string {
  if (typeof value !== "string" || !MIGRATION_ID.test(value)) invalid();
  return value;
}

function migrationFile(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 240 ||
    !MIGRATION_FILE.test(value)
  ) {
    invalid();
  }
  return value;
}

function isCanonicalDate(value: unknown): boolean {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString() === `${value}T00:00:00.000Z`
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function invalid(): never {
  throw new Error("invalid");
}
