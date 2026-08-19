import { describe, expect, it } from "vitest";

import {
  PRIVACY_RETENTION_POLICY_RELATIVE_FILE,
  PRIVACY_RETENTION_POLICY_SCHEMA_VERSION,
  PRIVACY_RETENTION_POLICY_VERSION,
  loadPrivacyRetentionPolicyV1,
  parsePrivacyRetentionPolicyV1,
} from "../src/privacy-retention-policy";

describe("privacy retention policy v1", () => {
  it("loads one immutable synthetic-only production-blocked decision", async () => {
    const policy = await loadPrivacyRetentionPolicyV1();

    expect(PRIVACY_RETENTION_POLICY_SCHEMA_VERSION).toBe(1);
    expect(PRIVACY_RETENTION_POLICY_VERSION).toBe(1);
    expect(PRIVACY_RETENTION_POLICY_RELATIVE_FILE).toBe(
      "privacy-retention-plans/v1/policy.json",
    );
    expect(policy.status).toBe("accepted_technical_model_production_blocked");
    expect(policy.dataAdmission).toBe("synthetic_only");
    expect(policy.resourceIdentifiers).toMatchObject({
      tokenScheme: "hmac-sha256-v1",
      tokenBytes: 32,
      tokenInput: "internal_only",
      rawDeletedRegistryRetention: "none",
    });
    expect(policy.productionAdmission.allowed).toBe(false);
    expect(policy.explicitNonClaims).toContain(
      "database_verification_of_externally_keyed_resource_tokens",
    );
    expect(policy.explicitNonClaims).toContain(
      "populated_database_privacy_migration_backfill_or_online_cutover",
    );
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.resourceIdentifiers)).toBe(true);
    expect(Object.isFrozen(policy.explicitNonClaims)).toBe(true);
  });

  it("rejects widened claims, omitted gates, reordered values, and extras", async () => {
    const policy = structuredClone(
      await loadPrivacyRetentionPolicyV1(),
    ) as unknown as MutablePolicy;
    expect(() =>
      parsePrivacyRetentionPolicyV1({ ...policy, unexpected: true }),
    ).toThrow(/unexpected fields/i);

    policy.productionAdmission.allowed = true;
    expect(() => parsePrivacyRetentionPolicyV1(policy)).toThrow(/differs/i);

    const missingGate = structuredClone(
      await loadPrivacyRetentionPolicyV1(),
    ) as unknown as MutablePolicy;
    missingGate.productionAdmission.requiredExternalGates.pop();
    expect(() => parsePrivacyRetentionPolicyV1(missingGate)).toThrow(
      /ordered values/i,
    );

    const reordered = structuredClone(
      await loadPrivacyRetentionPolicyV1(),
    ) as unknown as MutablePolicy;
    reordered.explicitNonClaims.reverse();
    expect(() => parsePrivacyRetentionPolicyV1(reordered)).toThrow(/differs/i);
  });
});

interface MutablePolicy extends Record<string, unknown> {
  productionAdmission: {
    allowed: boolean;
    requiredExternalGates: string[];
  };
  explicitNonClaims: string[];
}
