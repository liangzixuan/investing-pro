import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { loadAuthenticatedMigrationPlan } from "../src/authenticated-migration-plan";
import {
  POPULATED_CUTOVER_ADVISORY_LOCK_KEY,
  POPULATED_CUTOVER_BASE_EXCLUDED_ID,
  POPULATED_CUTOVER_BASE_SELECTED_IDS,
  POPULATED_CUTOVER_CLAIM_BATCH_ROWS,
  POPULATED_CUTOVER_CONTRACT_DEADLINE_MILLISECONDS,
  POPULATED_CUTOVER_CONTRACT_MAX_ATTEMPTS,
  POPULATED_CUTOVER_DATABASE_NAME,
  POPULATED_CUTOVER_FIXTURE_IDS_V1,
  POPULATED_CUTOVER_FIXTURE_SHA256,
  POPULATED_CUTOVER_PLAN_APPLICATION_SHA256,
  POPULATED_CUTOVER_PLAN_MANIFEST_SHA256,
  POPULATED_CUTOVER_PLAN_PLATFORM_SHA256,
  expectedPopulatedCutoverBaseLedgerRowsV1,
  expectedPopulatedCutoverLedgerRowsV1,
  loadPopulatedCutoverFixture,
  loadPopulatedCutoverPlanV1,
  parsePopulatedCutoverPlanManifestV1,
  renderCreatePopulatedCutoverDatabaseSql,
  renderDropPopulatedCutoverDatabaseSql,
  renderPopulatedCutoverBaseMigration,
  renderPopulatedCutoverConcurrentLegacyInsert,
  renderPopulatedCutoverContractBarrier,
  renderPopulatedCutoverContractFinalize,
  renderPopulatedCutoverContractMigration,
  renderPopulatedCutoverExpandMigration,
  renderPopulatedCutoverFixture,
  renderPopulatedCutoverPlatformMigration,
  renderPopulatedCutoverPostContractInsert,
  renderPopulatedCutoverSharedAdvisorySql,
  snapshotPopulatedCutoverPlanV1,
} from "../src/populated-cutover-plan";
import { loadPrivacyRetentionPlanV1 } from "../src/privacy-retention-plan";

describe("populated cutover plan v1", () => {
  it("loads one closed manifest with exact v2 branch and B13 target bindings", async () => {
    const plan = await loadPopulatedCutoverPlanV1();

    expect(sha256(plan.platformSql)).toBe(
      POPULATED_CUTOVER_PLAN_PLATFORM_SHA256,
    );
    expect(plan.applicationFiles.map(({ sql }) => sha256(sql))).toEqual(
      POPULATED_CUTOVER_PLAN_APPLICATION_SHA256,
    );
    expect(plan.manifest.base.selectedMigrations.map(({ id }) => id)).toEqual(
      POPULATED_CUTOVER_BASE_SELECTED_IDS,
    );
    expect(plan.manifest.base.excludedMigration.id).toBe(
      POPULATED_CUTOVER_BASE_EXCLUDED_ID,
    );
    expect(plan.manifest.target.applicationSha256).toBe(
      "87df05b88653621b1999343786de0c3a60d0f5e7468348dc24269d6ae493af62",
    );
    expect(POPULATED_CUTOVER_PLAN_MANIFEST_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.manifest.base.selectedMigrations)).toBe(true);
  });

  it("renders the selected immutable v2 files and never executes v2-0005", async () => {
    const [base, cutover] = await Promise.all([
      loadAuthenticatedMigrationPlan(),
      loadPopulatedCutoverPlanV1(),
    ]);
    const sql = renderPopulatedCutoverBaseMigration(base, cutover);
    const orderedIds = ["v2-0001", "v2-0002", "v2-0003", "v2-0004", "v2-0006"];

    expectOrdered(
      sql,
      orderedIds.map((id) => `cutover base ${id}:`),
    );
    expect(sql).not.toContain("cutover base v2-0005:");
    expect(sql).toContain("purpose IS NULL");
    expect(sql).toContain("b14-populated-cutover-base-identity-ok");
    expect(expectedPopulatedCutoverBaseLedgerRowsV1(cutover)).toHaveLength(5);
    expect(
      expectedPopulatedCutoverLedgerRowsV1(cutover).map(
        ({ migrationId }) => migrationId,
      ),
    ).toEqual([
      "populated-cutover-v1-0001",
      "populated-cutover-v1-0002",
      "v2-0001",
      "v2-0002",
      "v2-0003",
      "v2-0004",
      "v2-0006",
    ]);
  });

  it("renders rollback-safe platform, expand, and contract transactions", async () => {
    const [base, privacy, cutover] = await Promise.all([
      loadAuthenticatedMigrationPlan(),
      loadPrivacyRetentionPlanV1(),
      loadPopulatedCutoverPlanV1(),
    ]);

    for (const sql of [
      renderPopulatedCutoverPlatformMigration(cutover, true),
      renderPopulatedCutoverBaseMigration(base, cutover, true),
      renderPopulatedCutoverExpandMigration(base, privacy, cutover, true),
      renderPopulatedCutoverContractMigration(base, privacy, cutover, 7, true),
    ]) {
      expect(sql).toContain("SELECT 1 / 0;");
      expect(sql).toContain("BEGIN;");
      expect(sql).toContain("COMMIT;");
    }
  });

  it("pins the short expand capture boundary and temporary FORCE-RLS policies", async () => {
    const [base, privacy, cutover] = await Promise.all([
      loadAuthenticatedMigrationPlan(),
      loadPrivacyRetentionPlanV1(),
      loadPopulatedCutoverPlanV1(),
    ]);
    const sql = renderPopulatedCutoverExpandMigration(base, privacy, cutover);

    expectOrdered(sql, [
      `pg_advisory_xact_lock(${POPULATED_CUTOVER_ADVISORY_LOCK_KEY}::bigint)`,
      "LOCK TABLE\n  ONLY private_data.theses,",
      "IN ACCESS EXCLUSIVE MODE;",
      "CREATE TABLE private_data.resource_identifier_cutover_work",
      "CREATE TRIGGER theses_cutover_capture",
    ]);
    expect(
      sql.lastIndexOf(
        "INSERT INTO private_data.resource_identifier_cutover_work",
      ),
    ).toBeGreaterThan(sql.indexOf("CREATE TRIGGER theses_cutover_capture"));
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("populated_cutover_owner_theses");
    expect(sql).toContain("AFTER INSERT OR DELETE ON private_data.theses");
    expect(sql).not.toContain(
      "AFTER INSERT OR UPDATE OR DELETE ON private_data.theses",
    );
  });

  it("installs the exact target allocation function without an early execute grant", async () => {
    const [base, privacy, cutover] = await Promise.all([
      loadAuthenticatedMigrationPlan(),
      loadPrivacyRetentionPlanV1(),
      loadPopulatedCutoverPlanV1(),
    ]);
    const expand = renderPopulatedCutoverExpandMigration(
      base,
      privacy,
      cutover,
    );
    const allocationStart = expand.indexOf(
      "CREATE FUNCTION private_data.allocate_resource_identifier(",
    );
    const allocationEnd = expand.indexOf(
      "CREATE FUNCTION private_data.delete_live_resource_by_allocation(",
    );

    expect(allocationStart).toBeGreaterThan(-1);
    expect(allocationEnd).toBe(-1);
    expect(expand).toContain(
      "REVOKE ALL ON FUNCTION private_data.allocate_resource_identifier(",
    );
    expect(expand).not.toContain(") TO research_cockpit_privacy_retention;");
    expect(expand).not.toContain(") TO research_cockpit_test_seed;");
  });

  it("takes the shared gate before a fixed optimistic claim batch", async () => {
    const cutover = await loadPopulatedCutoverPlanV1();
    const sql = cutover.applicationFiles[0]?.sql ?? "";
    const claim = section(
      sql,
      "CREATE FUNCTION private_data.claim_resource_identifier_cutover_batch()",
      "CREATE FUNCTION private_data.backfill_resource_identifier_cutover(",
    );

    expectOrdered(claim, [
      "pg_advisory_xact_lock_shared",
      "FROM private_data.resource_identifier_cutover_work",
      `LIMIT ${POPULATED_CUTOVER_CLAIM_BATCH_ROWS}`,
      "FOR UPDATE SKIP LOCKED",
    ]);
  });

  it("pins apply order as advisory, domain, source row, work row, registry", async () => {
    const cutover = await loadPopulatedCutoverPlanV1();
    const sql = cutover.applicationFiles[0]?.sql ?? "";
    const apply = section(
      sql,
      "CREATE FUNCTION private_data.backfill_resource_identifier_cutover(",
      "CREATE FUNCTION private_data.inspect_resource_identifier_cutover()",
    );

    expectOrdered(apply, [
      "pg_advisory_xact_lock_shared",
      "SELECT work_row.desired_state",
      "FROM private_data.resource_privacy_domains",
      "FROM private_data.theses AS thesis_row",
      "SELECT\n    work_row.desired_state,",
      "INSERT INTO private_data.resource_id_registry",
      "UPDATE private_data.resource_identifier_cutover_work",
      "UPDATE private_data.theses",
    ]);
    expect(
      apply.indexOf("FROM private_data.theses AS thesis_row"),
    ).toBeLessThan(apply.indexOf("SELECT\n    work_row.desired_state,"));
  });

  it("splits the exclusive final barrier from local-only contract finalization", async () => {
    const [base, privacy, cutover] = await Promise.all([
      loadAuthenticatedMigrationPlan(),
      loadPrivacyRetentionPlanV1(),
      loadPopulatedCutoverPlanV1(),
    ]);
    const barrier = renderPopulatedCutoverContractBarrier(
      base,
      privacy,
      cutover,
      9,
    );
    const finalize = renderPopulatedCutoverContractFinalize(
      base,
      privacy,
      cutover,
      9,
    );

    expectOrdered(barrier, [
      `pg_advisory_xact_lock(${POPULATED_CUTOVER_ADVISORY_LOCK_KEY}::bigint)`,
      "resource_privacy_domains IN EXCLUSIVE MODE",
      "private_data.theses IN SHARE ROW EXCLUSIVE MODE",
      "private_data.alert_rules IN SHARE ROW EXCLUSIVE MODE",
      "LOCK TABLE ONLY private_data.resource_identifier_cutover_work",
      "LOCK TABLE ONLY private_data.resource_id_registry",
      "actual_capture_epoch <> expected_capture_epoch",
      "b14-populated-cutover-contract-barrier-ok",
    ]);
    expect(barrier).not.toContain("COMMIT;");
    expect(finalize).toContain(
      "finalize requires its open barrier transaction",
    );
    expect(finalize).toContain(
      "ALTER COLUMN registered_allocation_id SET NOT NULL",
    );
    expect(finalize).toContain(
      "DROP TABLE private_data.resource_identifier_cutover_work",
    );
    expect(finalize).toContain(
      "CREATE FUNCTION private_data.delete_live_resource_by_allocation(",
    );
    expect(finalize).not.toContain(
      "CREATE FUNCTION private_data.allocate_resource_identifier(",
    );
    expect(finalize).toContain(")\n  TO research_cockpit_privacy_retention;");
    expect(finalize).toContain("COMMIT;");
  });

  it("rejects unsafe epoch values before rendering SQL", async () => {
    const [base, privacy, cutover] = await Promise.all([
      loadAuthenticatedMigrationPlan(),
      loadPrivacyRetentionPlanV1(),
      loadPopulatedCutoverPlanV1(),
    ]);

    for (const epoch of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() =>
        renderPopulatedCutoverContractBarrier(base, privacy, cutover, epoch),
      ).toThrow("capture epoch must be nonnegative");
    }
  });

  it("loads the exact populated fixture and keeps later writers separate", async () => {
    const fixture = await loadPopulatedCutoverFixture();
    expect(sha256(fixture)).toBe(POPULATED_CUTOVER_FIXTURE_SHA256);
    expect(fixture).toContain(
      POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.alphaDeletedAlert,
    );
    expect(fixture).not.toContain(
      POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.alphaConcurrentThesis,
    );
    expect(renderPopulatedCutoverFixture(fixture)).toContain(
      "SET LOCAL ROLE research_cockpit_test_seed;",
    );
    expect(renderPopulatedCutoverConcurrentLegacyInsert()).toContain(
      POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.alphaConcurrentThesis,
    );
    expect(renderPopulatedCutoverPostContractInsert()).toContain(
      POPULATED_CUTOVER_FIXTURE_IDS_V1.allocations.alphaPostContractThesis,
    );
  });

  it("renders bounded protocol constants and template0 cleanup", () => {
    expect(renderPopulatedCutoverSharedAdvisorySql()).toBe(
      `SELECT pg_catalog.pg_advisory_xact_lock_shared(${POPULATED_CUTOVER_ADVISORY_LOCK_KEY}::bigint);`,
    );
    expect(POPULATED_CUTOVER_CONTRACT_MAX_ATTEMPTS).toBe(3);
    expect(POPULATED_CUTOVER_CONTRACT_DEADLINE_MILLISECONDS).toBe(10_000);
    expect(renderCreatePopulatedCutoverDatabaseSql()).toContain(
      `CREATE DATABASE ${POPULATED_CUTOVER_DATABASE_NAME}`,
    );
    expect(renderCreatePopulatedCutoverDatabaseSql()).toContain(
      "TEMPLATE template0",
    );
    expect(renderDropPopulatedCutoverDatabaseSql()).not.toContain("FORCE");
  });

  it("fails closed on manifest or SQL drift and unexpected fields", async () => {
    const plan = await loadPopulatedCutoverPlanV1();
    expect(() =>
      parsePopulatedCutoverPlanManifestV1({
        ...structuredClone(plan.manifest),
        unexpected: true,
      }),
    ).toThrow("missing or unexpected fields");
    expect(() =>
      snapshotPopulatedCutoverPlanV1({
        ...plan,
        applicationFiles: plan.applicationFiles.map((entry, index) =>
          index === 0 ? { ...entry, sql: `${entry.sql}\n-- drift` } : entry,
        ),
      }),
    ).toThrow("application 0 is unsupported");
  });
});

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function expectOrdered(value: string, markers: readonly string[]): void {
  let previous = -1;
  for (const marker of markers) {
    const next = value.indexOf(marker);
    expect(next, `missing marker: ${marker}`).toBeGreaterThan(previous);
    previous = next;
  }
}

function section(value: string, start: string, end: string): string {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return value.slice(startIndex, endIndex);
}
