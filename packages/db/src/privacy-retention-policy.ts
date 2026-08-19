import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PRIVACY_RETENTION_POLICY_SCHEMA_VERSION = 1 as const;
export const PRIVACY_RETENTION_POLICY_VERSION = 1 as const;
export const PRIVACY_RETENTION_POLICY_RELATIVE_FILE =
  "privacy-retention-plans/v1/policy.json" as const;

const reviewedPolicyFile = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "privacy-retention-plans",
  "v1",
  "policy.json",
);

const reviewedPrivacyRetentionPolicyV1 = {
  schemaVersion: PRIVACY_RETENTION_POLICY_SCHEMA_VERSION,
  policyVersion: PRIVACY_RETENTION_POLICY_VERSION,
  status: "accepted_technical_model_production_blocked",
  dataAdmission: "synthetic_only",
  resourceIdentifiers: {
    classification: "pseudonymous_identifier",
    tokenScheme: "hmac-sha256-v1",
    tokenBytes: 32,
    keyScope: "tenant_privacy_domain",
    keyCustody: "external_non_exportable_kms",
    tokenInput: "internal_only",
    rawDeletedRegistryRetention: "none",
    tokenRetention: "active_tenant_lifetime",
  },
  ephemeralMetadata: {
    idempotencyHours: 24,
    securityAuditDays: 90,
    purgeClock: "database_transaction_timestamp",
    maximumPurgeBatchRows: 1000,
  },
  tenantOffboarding: {
    blockNewAllocationsBeforePurge: true,
    purgeOnlineResourceTokens: true,
    destroyExternalTokenKey: true,
    onlinePurgeTargetHours: 24,
  },
  backup: {
    maximumExpiryDays: 30,
    restoreRequiresErasureReplay: true,
  },
  dsar: {
    responseTargetDays: 30,
    tokensNeverExported: true,
    deletedRegistryTokensRemainPrincipalFree: true,
  },
  productionAdmission: {
    allowed: false,
    requiredExternalGates: [
      "product_privacy_legal_approval",
      "production_kms_and_secret_operations",
      "production_dsar_and_legal_hold_orchestration",
      "production_retention_scheduler_and_monitoring",
      "external_backup_expiry_deletion_and_restore_erasure_replay",
      "populated_database_backfill_and_online_cutover",
    ],
  },
  explicitNonClaims: [
    "real_tenant_or_personal_data",
    "production_kms_key_custody_rotation_destruction_or_attestation",
    "database_verification_of_externally_keyed_resource_tokens",
    "production_dsar_identity_resolution_legal_hold_or_regulatory_compliance",
    "production_retention_scheduler_monitoring_or_failure_recovery",
    "external_backup_expiry_deletion_or_restore_erasure_replay",
    "populated_database_privacy_migration_backfill_or_online_cutover",
  ],
} as const;

export type PrivacyRetentionPolicyV1 = typeof reviewedPrivacyRetentionPolicyV1;

export async function loadPrivacyRetentionPolicyV1(
  file = reviewedPolicyFile,
): Promise<PrivacyRetentionPolicyV1> {
  const value = JSON.parse(await readFile(file, "utf8")) as unknown;
  return parsePrivacyRetentionPolicyV1(value);
}

export function parsePrivacyRetentionPolicyV1(
  value: unknown,
): PrivacyRetentionPolicyV1 {
  assertExactValue(
    value,
    reviewedPrivacyRetentionPolicyV1,
    "privacy retention policy v1",
  );
  return deepFreeze(structuredClone(value)) as PrivacyRetentionPolicyV1;
}

function assertExactValue(
  actual: unknown,
  expected: unknown,
  path: string,
): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      throw new Error(`${path} must preserve the reviewed ordered values`);
    }
    for (const [index, expectedValue] of expected.entries()) {
      assertExactValue(actual[index], expectedValue, `${path}[${index}]`);
    }
    return;
  }
  if (isRecord(expected)) {
    if (!isRecord(actual)) {
      throw new Error(`${path} must be an object`);
    }
    const actualKeys = Object.keys(actual).sort(compareText);
    const expectedKeys = Object.keys(expected).sort(compareText);
    if (
      actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key, index) => key !== expectedKeys[index])
    ) {
      throw new Error(`${path} contains missing or unexpected fields`);
    }
    for (const key of expectedKeys) {
      assertExactValue(actual[key], expected[key], `${path}.${key}`);
    }
    return;
  }
  if (actual !== expected) {
    throw new Error(`${path} differs from the reviewed policy`);
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
