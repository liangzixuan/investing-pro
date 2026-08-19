import { createHash, createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { loadAuthenticatedMigrationPlan } from "../src/authenticated-migration-plan";
import {
  PRIVACY_RETENTION_ADVISORY_LOCK_KEY,
  PRIVACY_RETENTION_CAPABILITY_ROLE,
  PRIVACY_RETENTION_DATABASE_NAME,
  PRIVACY_RETENTION_FIXTURE_TOKEN_INPUTS_V1,
  PRIVACY_RETENTION_PLAN_APPLICATION_FILES,
  PRIVACY_RETENTION_PLAN_APPLICATION_SHA256,
  PRIVACY_RETENTION_PLAN_MANIFEST_SHA256,
  PRIVACY_RETENTION_PLAN_PLATFORM_SHA256,
  loadPrivacyRetentionFixture,
  loadPrivacyRetentionPlanV1,
  parsePrivacyRetentionPlanManifestV1,
  renderCreatePrivacyRetentionDatabaseSql,
  renderDropPrivacyRetentionDatabaseSql,
  renderPrivacyRetentionApplicationMigration,
  renderPrivacyRetentionBaseMigration,
  renderPrivacyRetentionFixture,
  renderPrivacyRetentionPlatformMigration,
  snapshotPrivacyRetentionPlanV1,
  type PrivacyRetentionFixtureTokenNameV1,
  type PrivacyRetentionFixtureTokensV1,
  type PrivacyRetentionPlanV1,
} from "../src/privacy-retention-plan";
import { deriveResourceIdentifierToken } from "../src/resource-identifier-token";

describe("privacy retention plan v1", () => {
  it("loads one closed platform and empty-only suffix inventory", async () => {
    const plan = await loadPrivacyRetentionPlanV1();

    expect(sha256(plan.platformSql)).toBe(
      PRIVACY_RETENTION_PLAN_PLATFORM_SHA256,
    );
    expect(plan.manifest).toMatchObject({
      schemaVersion: 1,
      planVersion: 1,
      algorithm: "sha256",
      platform: {
        file: "platform-bootstrap.sql",
        sha256: PRIVACY_RETENTION_PLAN_PLATFORM_SHA256,
      },
    });
    expect(plan.applicationFiles.map(({ file }) => file)).toEqual(
      PRIVACY_RETENTION_PLAN_APPLICATION_FILES,
    );
    expect(plan.applicationFiles.map(({ sql }) => sha256(sql))).toEqual(
      PRIVACY_RETENTION_PLAN_APPLICATION_SHA256,
    );
    expect(plan.manifest.migrations).toEqual([
      {
        id: "privacy-v1-0001",
        file: "application/0001_keyed_resource_identifier_lifecycle.sql",
        sha256: PRIVACY_RETENTION_PLAN_APPLICATION_SHA256[0],
      },
    ]);
    expect(PRIVACY_RETENTION_PLAN_MANIFEST_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.applicationFiles)).toBe(true);
  });

  it("renders fixed template0, platform, v2 base, and superuser-gated suffix lanes", async () => {
    const [base, privacy] = await Promise.all([
      loadAuthenticatedMigrationPlan(),
      loadPrivacyRetentionPlanV1(),
    ]);
    const create = renderCreatePrivacyRetentionDatabaseSql();
    const drop = renderDropPrivacyRetentionDatabaseSql();
    const platform = renderPrivacyRetentionPlatformMigration(privacy);
    const baseSql = renderPrivacyRetentionBaseMigration(base);
    const suffix = renderPrivacyRetentionApplicationMigration(base, privacy);

    expect(create).toContain(
      `CREATE DATABASE ${PRIVACY_RETENTION_DATABASE_NAME}`,
    );
    expect(create).toContain("TEMPLATE template0");
    expect(drop).toContain(`DROP DATABASE ${PRIVACY_RETENTION_DATABASE_NAME};`);
    expect(platform).toContain(
      `pg_advisory_xact_lock(${PRIVACY_RETENTION_ADVISORY_LOCK_KEY}::bigint)`,
    );
    expect(platform).toContain(
      `CREATE ROLE ${PRIVACY_RETENTION_CAPABILITY_ROLE}`,
    );
    expect(
      baseSql.match(/^SET LOCAL ROLE research_cockpit_owner;$/gm),
    ).toHaveLength(1);
    expect(
      baseSql.match(/INSERT INTO shared_data\.schema_migrations/g),
    ).toHaveLength(6);
    expect(suffix.indexOf("privacy_suffix_superuser_preflight")).toBeLessThan(
      suffix.indexOf("SET LOCAL ROLE research_cockpit_owner"),
    );
    expect(
      suffix.indexOf("SET LOCAL ROLE research_cockpit_owner"),
    ).toBeLessThan(suffix.indexOf("privacy_empty_only_preflight"));
    const writeBarriers = [...suffix.matchAll(/^LOCK TABLE$/gm)].map(
      ({ index }) => index,
    );
    expect(writeBarriers).toHaveLength(2);
    expect(writeBarriers[0]).toBeLessThan(
      suffix.indexOf("privacy_suffix_superuser_preflight"),
    );
    expect(writeBarriers[1]).toBeGreaterThan(
      suffix.indexOf("SET LOCAL ROLE research_cockpit_owner"),
    );
    expect(writeBarriers[1]).toBeLessThan(
      suffix.indexOf("privacy_empty_only_preflight"),
    );
    expect(suffix).toContain("privacy-retention v1 requires empty tenant data");
    expect(suffix).toContain(
      "privacy suffix requires the exact six-row v2 ledger",
    );
    expect(suffix).toContain("VALUES ('privacy-v1-0001'");
    expect(suffix.match(/^BEGIN;$/gm)).toHaveLength(1);
    expect(suffix.match(/^COMMIT;$/gm)).toHaveLength(1);
  });

  it("offers deterministic rollback variants and rejects source drift", async () => {
    const [base, privacy] = await Promise.all([
      loadAuthenticatedMigrationPlan(),
      loadPrivacyRetentionPlanV1(),
    ]);
    expect(renderPrivacyRetentionPlatformMigration(privacy, true)).toContain(
      "SELECT 1 / 0;",
    );
    expect(renderPrivacyRetentionBaseMigration(base, true)).toContain(
      "SELECT 1 / 0;",
    );
    expect(
      renderPrivacyRetentionApplicationMigration(base, privacy, true),
    ).toContain("SELECT 1 / 0;");

    const drifted = mutablePlan(privacy);
    drifted.applicationFiles[0]!.sql += "\nSELECT 1;\n";
    expect(() => snapshotPrivacyRetentionPlanV1(drifted)).toThrow(
      /checksum differs/i,
    );
    expect(() =>
      parsePrivacyRetentionPlanManifestV1({
        ...privacy.manifest,
        migrations: [],
      }),
    ).toThrow(/exactly one/i);
  });

  it("keeps lifecycle, offboarding, retention, and privilege contracts bounded", async () => {
    const sql = (await loadPrivacyRetentionPlanV1()).applicationFiles[0]!.sql;

    expect(sql).toContain(
      "CREATE FUNCTION private_data.allocate_resource_identifier(",
    );
    expect(sql).toContain(
      "CREATE FUNCTION private_data.delete_live_resource_by_allocation(",
    );
    expect(sql).toContain(
      "CREATE FUNCTION private_data.begin_resource_privacy_offboarding(",
    );
    expect(sql).toContain(
      "CREATE FUNCTION private_data.purge_tenant_privacy_domain(",
    );
    expect(sql).toContain(
      "CREATE FUNCTION private_data.purge_expired_privacy_metadata()",
    );
    expect(sql).toContain("FOR UPDATE;");
    expect(sql).toContain(
      "live resource write requires one active privacy domain",
    );
    expect(sql).toContain("DELETE FROM private_data.theses");
    expect(sql).toContain("DELETE FROM private_data.alert_rules");
    expect(sql).toContain("DELETE FROM private_data.organization_principals");
    expect(sql).toContain(
      "NOT EXISTS (\n      SELECT 1\n      FROM private_data.organization_principals",
    );
    expect(sql).not.toMatch(
      /GRANT SELECT, INSERT ON private_data\.resource_id_registry\s+TO research_cockpit_test_seed/,
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION private_data.allocate_resource_identifier(",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION\n  private_data.delete_live_resource_by_allocation(uuid)\n  TO research_cockpit_privacy_retention;",
    );
    expect(sql).not.toContain(
      "private_data.delete_live_resource_by_allocation(uuid)\n  TO research_cockpit_test_seed",
    );
    expect(sql).not.toMatch(
      /GRANT DELETE ON (?:TABLE )?private_data\.(?:theses|alert_rules)\s+TO research_cockpit_privacy_retention/,
    );
    expect(sql).toContain(`CREATE POLICY privacy_owner_active_theses_select
  ON private_data.theses
  FOR SELECT TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = theses.organization_id
        AND domain_row.lifecycle_state = 'active'
        AND domain_row.data_classification = 'synthetic'
    )
  );`);
    expect(sql).toContain(`CREATE POLICY privacy_owner_active_alert_rules_select
  ON private_data.alert_rules
  FOR SELECT TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = alert_rules.organization_id
        AND domain_row.lifecycle_state = 'active'
        AND domain_row.data_classification = 'synthetic'
    )
  );`);
    expect(sql)
      .toContain(`CREATE POLICY privacy_owner_purged_organizations_select
  ON private_data.organizations
  FOR SELECT TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND NOT EXISTS (
      SELECT 1
      FROM private_data.resource_privacy_domains AS domain_row
      WHERE domain_row.organization_id = organizations.id
    )
  );`);
    expect(sql).toContain(`CREATE POLICY privacy_owner_purged_organizations
  ON private_data.organizations
  FOR DELETE TO research_cockpit_owner
  USING (data_classification = 'synthetic');`);
    expect(sql)
      .toContain(`CREATE POLICY privacy_owner_expired_idempotency_update
  ON private_data.idempotency_records
  FOR UPDATE TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND expires_at <= transaction_timestamp()
  )
  WITH CHECK (false);`);
    expect(sql).toContain(`CREATE POLICY privacy_owner_expired_audit_update
  ON private_data.audit_events
  FOR UPDATE TO research_cockpit_owner
  USING (
    data_classification = 'synthetic'
    AND retention_until <= transaction_timestamp()
  )
  WITH CHECK (false);`);
    expect(sql).toContain("LIMIT 1000");
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
  });

  it("locks every admitted tenant table before checking the empty-only suffix", async () => {
    const sql = (await loadPrivacyRetentionPlanV1()).applicationFiles[0]!.sql;
    const lockPosition = sql.indexOf("LOCK TABLE");
    const emptyCheckPosition = sql.indexOf("DO $privacy_empty_only_preflight$");

    expect(lockPosition).toBeGreaterThan(-1);
    expect(lockPosition).toBeLessThan(emptyCheckPosition);
    expect(sql.match(/^LOCK TABLE$/gm)).toHaveLength(1);
    expect(sql).toContain("IN SHARE ROW EXCLUSIVE MODE;");
    for (const table of [
      "organizations",
      "principals",
      "organization_principals",
      "memberships",
      "entitlements",
      "theses",
      "alert_rules",
      "idempotency_records",
      "audit_events",
      "resource_id_registry",
    ]) {
      expect(sql).toContain(`ONLY private_data.${table}`);
    }
  });

  it("exposes one allocation-keyed live-delete routine without table delete power", async () => {
    const sql = (await loadPrivacyRetentionPlanV1()).applicationFiles[0]!.sql;
    const routineStart = sql.indexOf(
      "CREATE FUNCTION private_data.delete_live_resource_by_allocation(",
    );
    const routineEnd =
      sql.indexOf("$function$;", routineStart) + "$function$;".length;
    const routine = sql.slice(routineStart, routineEnd);

    expect(routineStart).toBeGreaterThan(-1);
    expect(routine).toContain("target_allocation_id uuid");
    expect(routine).toContain("RETURNS uuid");
    expect(routine).toContain("SECURITY DEFINER");
    expect(routine).toContain("SET search_path = pg_catalog, private_data");
    expect(routine).toContain("lifecycle_state = 'active'");
    expect(routine).toContain("lifecycle_state = 'live'");
    expect(routine).toContain("FOR UPDATE;");
    expect(routine).toContain("DELETE FROM private_data.theses");
    expect(routine).toContain("DELETE FROM private_data.alert_rules");
    expect(routine).toContain(
      "live resource deletion must delete exactly one row",
    );
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION\n  private_data.delete_live_resource_by_allocation(uuid)\n  FROM PUBLIC;",
    );
    expect(
      sql.match(
        /CREATE FUNCTION private_data\.(?:allocate_resource_identifier|delete_live_resource_by_allocation|begin_resource_privacy_offboarding|purge_tenant_privacy_domain|purge_expired_privacy_metadata)\(/g,
      ),
    ).toHaveLength(5);
  });

  it("renders only exact one-use fixture slots from derived run-local MACs", async () => {
    const fixture = await loadPrivacyRetentionFixture();
    const key = Buffer.from("acceptance-only-run-local-key");
    const tokenEntries = await Promise.all(
      Object.entries(PRIVACY_RETENTION_FIXTURE_TOKEN_INPUTS_V1).map(
        async ([name, input]) => [
          name,
          await deriveResourceIdentifierToken(
            {
              macSha256: (message) =>
                createHmac("sha256", key).update(message).digest(),
            },
            input,
          ),
        ],
      ),
    );
    const tokens = Object.fromEntries(
      tokenEntries,
    ) as PrivacyRetentionFixtureTokensV1;
    const rendered = renderPrivacyRetentionFixture(fixture, tokens);

    expect(rendered).toContain("SET LOCAL ROLE research_cockpit_test_seed;");
    expect(rendered).not.toContain("__PRIVACY_TOKEN_");
    expect(
      rendered.match(/pg_catalog\.decode\(\s*'[0-9a-f]{64}'/g),
    ).toHaveLength(4);
    expect(
      rendered.match(/private_data\.allocate_resource_identifier\(/g),
    ).toHaveLength(4);
    expect(rendered).not.toContain(
      "INSERT INTO private_data.resource_id_registry",
    );
    expect(() =>
      renderPrivacyRetentionFixture(`${fixture}\n-- drift\n`, tokens),
    ).toThrow(/checksum differs/i);

    const missing = { ...tokens } as Record<
      PrivacyRetentionFixtureTokenNameV1,
      string
    >;
    delete (missing as Partial<typeof missing>).betaAlert;
    expect(() =>
      renderPrivacyRetentionFixture(fixture, missing as never),
    ).toThrow(/missing or unexpected/i);
  });
});

function mutablePlan(plan: PrivacyRetentionPlanV1): {
  platformSql: string;
  manifest: PrivacyRetentionPlanV1["manifest"];
  applicationFiles: Array<{
    file: (typeof PRIVACY_RETENTION_PLAN_APPLICATION_FILES)[number];
    sql: string;
  }>;
} {
  return {
    platformSql: plan.platformSql,
    manifest: plan.manifest,
    applicationFiles: plan.applicationFiles.map((entry) => ({ ...entry })),
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
