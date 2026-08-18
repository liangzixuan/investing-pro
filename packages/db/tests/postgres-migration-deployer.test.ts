import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  AUTHENTICATED_MIGRATION_ADVISORY_LOCK_KEY,
  loadAuthenticatedMigrationPlan,
  snapshotAuthenticatedMigrationPlan,
  type AuthenticatedMigrationPlan,
} from "../src/authenticated-migration-plan";
import {
  POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE,
  PostgresMigrationDeployer,
  PostgresMigrationDeploymentError,
  renderAuthenticatedMigrationV2PrefixFiveReconstruction,
  type PostgresMigrationClient,
} from "../src/postgres-migration-deployer";

const ownerRole = "research_cockpit_owner";
const databaseName = "research_cockpit_acceptance_test";
const textOid = 25;

describe("PostgresMigrationDeployer", () => {
  it("applies only the missing suffix and then reports the exact current plan", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const client = new ScriptedMigrationClient(ledgerRows(plan, 5));
    const deployer = new PostgresMigrationDeployer(
      client as unknown as PostgresMigrationClient,
      plan,
    );

    await expect(
      deployer.deploy({ injectFailure: true }),
    ).rejects.toMatchObject({
      name: "PostgresMigrationDeploymentError",
      code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
      message: "PostgreSQL migration deployment failed.",
    });
    expect(client.ledger).toEqual(ledgerRows(plan, 5));

    const applied = await deployer.deploy();
    expect(applied).toEqual({
      status: "applied",
      appliedMigrationIds: ["v2-0006"],
    });
    expect(Object.isFrozen(applied)).toBe(true);
    expect(Object.isFrozen(applied.appliedMigrationIds)).toBe(true);
    expect(client.ledger).toEqual(ledgerRows(plan, 6));

    const current = await deployer.deploy();
    expect(current).toEqual({ status: "current", appliedMigrationIds: [] });
    expect(client.bodyQueries).toEqual([
      plan.applicationFiles[5]?.sql,
      plan.applicationFiles[5]?.sql,
    ]);

    const firstRun = client.transactionCalls[0] ?? [];
    expect(firstRun[0]?.text).toBe(
      "BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE",
    );
    const advisory = firstRun.findIndex(({ text }) =>
      text.includes("pg_advisory_xact_lock"),
    );
    const role = firstRun.findIndex(({ text }) =>
      text.includes("SET LOCAL ROLE research_cockpit_owner"),
    );
    const ledgerLock = firstRun.findIndex(({ text }) =>
      text.includes("LOCK TABLE ONLY shared_data.schema_migrations"),
    );
    const ledgerRead = firstRun.findIndex(({ text }) =>
      text.includes("ORDER BY migration_id COLLATE"),
    );
    expect(advisory).toBeGreaterThan(0);
    expect(advisory).toBeLessThan(role);
    expect(role).toBeLessThan(ledgerLock);
    expect(ledgerLock).toBeLessThan(ledgerRead);
    expect(firstRun[advisory]?.values).toEqual([
      AUTHENTICATED_MIGRATION_ADVISORY_LOCK_KEY,
    ]);
    expect(firstRun[advisory]?.text).not.toContain("schema_migrations");
    expect(firstRun[ledgerRead]?.text).not.toContain("pg_advisory");
    expect(firstRun[ledgerLock]?.text).toContain("SHARE ROW EXCLUSIVE");
    expect(client.calls.map(({ text }) => text).join("\n")).not.toMatch(
      /REPEATABLE READ|SERIALIZABLE|ON CONFLICT/i,
    );
  });

  it.each([
    ["empty", []],
    [
      "checksum mismatch",
      [["v2-0001", "0001_request_context_and_ledger.sql", "0".repeat(64)]],
    ],
    ["file mismatch", [["v2-0001", "0001_wrong.sql", "0".repeat(64)]]],
    ["gap", [["v2-0002", "0002_canonical_entities.sql", "0".repeat(64)]]],
    [
      "unexpected row",
      Array.from({ length: 7 }, (_value, index) => [
        `v2-${String(index + 1).padStart(4, "0")}`,
        `000${index + 1}_unexpected.sql`,
        "0".repeat(64),
      ]),
    ],
  ])(
    "rejects %s ledger drift before a migration body",
    async (_label, rows) => {
      const plan = await loadAuthenticatedMigrationPlan();
      const client = new ScriptedMigrationClient(rows);
      const deployer = new PostgresMigrationDeployer(
        client as unknown as PostgresMigrationClient,
        plan,
      );

      const error = await rejected(deployer.deploy());
      expect(error).toBeInstanceOf(PostgresMigrationDeploymentError);
      expect(error).toMatchObject({
        code: "POSTGRES_MIGRATION_LEDGER_DRIFT",
        message: "PostgreSQL migration deployment failed.",
      });
      expect(
        typeof error === "object" &&
          error !== null &&
          Object.hasOwn(error, "cause"),
      ).toBe(false);
      expect(client.bodyQueries).toEqual([]);
      expect(client.rollbackCount).toBe(2);
    },
  );

  it.each(["42P01", "42501", "42809"])(
    "maps ledger lock SQLSTATE %s to the distinct drift code",
    async (code) => {
      const plan = await loadAuthenticatedMigrationPlan();
      const client = new ScriptedMigrationClient(ledgerRows(plan, 6));
      client.ledgerLockErrorCode = code;
      const deployer = new PostgresMigrationDeployer(
        client as unknown as PostgresMigrationClient,
        plan,
      );

      await expect(deployer.deploy()).rejects.toMatchObject({
        code: "POSTGRES_MIGRATION_LEDGER_DRIFT",
      });
      expect(client.bodyQueries).toEqual([]);
    },
  );

  it("maps a malformed locked ledger to the distinct drift code", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const malformed = new ScriptedMigrationClient(ledgerRows(plan, 6));
    malformed.ledgerShapeValid = false;
    const malformedDeployer = new PostgresMigrationDeployer(
      malformed as unknown as PostgresMigrationClient,
      plan,
    );
    await expect(malformedDeployer.deploy()).rejects.toMatchObject({
      code: "POSTGRES_MIGRATION_LEDGER_DRIFT",
    });
    expect(malformed.bodyQueries).toEqual([]);
  });

  it("refuses widened capability-role attributes before locking the ledger", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const client = new ScriptedMigrationClient(ledgerRows(plan, 6));
    client.capabilityRolesValid = false;
    const deployer = new PostgresMigrationDeployer(
      client as unknown as PostgresMigrationClient,
      plan,
    );

    await expect(deployer.deploy()).rejects.toMatchObject({
      code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    });
    expect(client.bodyQueries).toEqual([]);
    expect(client.calls.map(({ text }) => text)).not.toContainEqual(
      expect.stringContaining("LOCK TABLE ONLY"),
    );
  });

  it("validates exact ledger columns, constraints, and PUBLIC ACL entries after locking", async () => {
    const source = await readFile(
      new URL("../src/postgres-migration-deployer.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain("pg_catalog.aclexplode(");
    expect(source).toContain("privilege.grantee = 0");
    expect(source).not.toMatch(/has_table_privilege\(\s*['"]public['"]/i);
    expect(source).toContain("schema_migrations_pkey");
    expect(source).toContain("PRIMARY KEY (migration_id)");
    expect(source).toContain("schema_migrations_file_name_key");
    expect(source).toContain("UNIQUE (file_name)");
    expect(source).toContain("schema_migrations_sha256_check");
    expect(source).toContain("constraint_row.conkey = ARRAY[3]::smallint[]");
    expect(source).toContain(
      "CHECK (((sha256)::text ~ ''^[0-9a-f]{64}$''::text))",
    );
  });

  it("rolls back a generic body failure and remains reusable only after clean rollback", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const client = new ScriptedMigrationClient(ledgerRows(plan, 5));
    client.failBodyOnce = true;
    const deployer = new PostgresMigrationDeployer(
      client as unknown as PostgresMigrationClient,
      plan,
    );

    await expect(deployer.deploy()).rejects.toMatchObject({
      code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    });
    expect(client.ledger).toEqual(ledgerRows(plan, 5));
    await expect(deployer.deploy()).resolves.toEqual({
      status: "applied",
      appliedMigrationIds: ["v2-0006"],
    });
  });

  it("poisons itself when rollback is ambiguous and rejects later work before SQL", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const client = new ScriptedMigrationClient(ledgerRows(plan, 5));
    client.failRollbackInTransaction = true;
    const deployer = new PostgresMigrationDeployer(
      client as unknown as PostgresMigrationClient,
      plan,
    );

    await expect(
      deployer.deploy({ injectFailure: true }),
    ).rejects.toMatchObject({ code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE" });
    const calls = client.calls.length;
    await expect(deployer.deploy()).rejects.toMatchObject({
      code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    });
    expect(client.calls).toHaveLength(calls);
  });

  it("poisons itself on commit ambiguity even when best-effort rollback returns", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const client = new ScriptedMigrationClient(ledgerRows(plan, 5));
    client.failCommit = true;
    const deployer = new PostgresMigrationDeployer(
      client as unknown as PostgresMigrationClient,
      plan,
    );

    await expect(deployer.deploy()).rejects.toMatchObject({
      code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    });
    const calls = client.calls.length;
    await expect(deployer.deploy()).rejects.toMatchObject({
      code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    });
    expect(client.calls).toHaveLength(calls);
  });

  it("attempts rollback after an ambiguous BEGIN and poisons the instance", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const client = new ScriptedMigrationClient(ledgerRows(plan, 5));
    client.failBegin = true;
    const deployer = new PostgresMigrationDeployer(
      client as unknown as PostgresMigrationClient,
      plan,
    );

    await expect(deployer.deploy()).rejects.toMatchObject({
      code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    });
    expect(client.rollbackCount).toBe(2);
    expect(client.resetRoleCount).toBe(2);
    const calls = client.calls.length;
    await expect(deployer.deploy()).rejects.toMatchObject({
      code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    });
    expect(client.calls).toHaveLength(calls);
  });

  it("resets role after a committed postcondition failure and poisons the instance", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const client = new ScriptedMigrationClient(ledgerRows(plan, 6));
    client.failPostCommitIdentity = true;
    const deployer = new PostgresMigrationDeployer(
      client as unknown as PostgresMigrationClient,
      plan,
    );

    await expect(deployer.deploy()).rejects.toMatchObject({
      code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    });
    expect(client.resetRoleCount).toBe(2);
    const calls = client.calls.length;
    await expect(deployer.deploy()).rejects.toMatchObject({
      code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    });
    expect(client.calls).toHaveLength(calls);
  });

  it("rejects same-instance overlap without issuing a second SQL sequence", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const client = new ScriptedMigrationClient(ledgerRows(plan, 6));
    const gate = deferred<void>();
    client.advisoryGate = gate.promise;
    const deployer = new PostgresMigrationDeployer(
      client as unknown as PostgresMigrationClient,
      plan,
    );

    const first = deployer.deploy();
    await client.advisoryReached.promise;
    const calls = client.calls.length;
    await expect(deployer.deploy()).rejects.toMatchObject({
      code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    });
    expect(client.calls).toHaveLength(calls);
    gate.resolve();
    await expect(first).resolves.toMatchObject({ status: "current" });
  });

  it("snapshots the complete reviewed plan before the first await", async () => {
    const reviewed = await loadAuthenticatedMigrationPlan();
    const mutable = mutablePlan(reviewed);
    const originalLastSql = mutable.applicationFiles[5]!.sql;
    const client = new ScriptedMigrationClient(ledgerRows(reviewed, 5));
    const deployer = new PostgresMigrationDeployer(
      client as unknown as PostgresMigrationClient,
      mutable,
    );

    mutable.applicationFiles[5]!.sql = "SELECT 'mutated';";
    mutable.manifest.migrations[5]!.sha256 = "0".repeat(64);
    await deployer.deploy();
    expect(client.bodyQueries).toEqual([originalLastSql]);
  });

  it("validates options and construction without leaking caller values or running SQL", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const client = new ScriptedMigrationClient(ledgerRows(plan, 6));
    const deployer = new PostgresMigrationDeployer(
      client as unknown as PostgresMigrationClient,
      plan,
    );
    const secret = "b11-secret-option";

    const error = await rejected(
      deployer.deploy({ injectFailure: secret as never }),
    );
    expect(error).toEqual(
      expect.objectContaining({
        code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
        message: "PostgreSQL migration deployment failed.",
      }),
    );
    expect(String(error)).not.toContain(secret);
    expect(client.calls).toEqual([]);
    expect(() => new PostgresMigrationDeployer({} as never, plan)).toThrowError(
      PostgresMigrationDeploymentError,
    );
  });

  it("accepts node-postgres Result instances without weakening plain input records", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const client = new ScriptedMigrationClient(ledgerRows(plan, 6));
    client.useResultPrototype = true;
    const deployer = new PostgresMigrationDeployer(
      client as unknown as PostgresMigrationClient,
      plan,
    );

    await expect(deployer.deploy()).resolves.toEqual({
      status: "current",
      appliedMigrationIds: [],
    });
    await expect(
      deployer.deploy(Object.create({ injectFailure: false }) as never),
    ).rejects.toMatchObject({
      code: "POSTGRES_MIGRATION_DEPLOYMENT_FAILURE",
    });
  });
});

describe("authenticated v2 prefix reconstruction", () => {
  it("derives one strict v2-0005 reset from the reviewed plan", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const sql = renderAuthenticatedMigrationV2PrefixFiveReconstruction(plan);

    expect(sql.match(/^BEGIN .*READ COMMITTED READ WRITE;$/gm)).toHaveLength(1);
    expect(sql.match(/^COMMIT;$/gm)).toHaveLength(1);
    expect(sql.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      sql.indexOf("SET LOCAL ROLE research_cockpit_owner"),
    );
    expect(sql.indexOf("SET LOCAL ROLE research_cockpit_owner")).toBeLessThan(
      sql.indexOf("LOCK TABLE ONLY shared_data.schema_migrations"),
    );
    expect(sql).toContain("SHARE ROW EXCLUSIVE MODE");
    expect(sql).toContain("CREATE OR REPLACE PROCEDURE");
    expect(sql).toContain(
      "purpose NOT IN ('display', 'derive', 'alert', 'export', 'ai')",
    );
    expect(sql).not.toContain("purpose IS NULL");
    expect(sql).not.toContain("IS DISTINCT FROM");
    expect(sql).toContain(
      "B11 prefix reconstruction requires the exact complete ledger",
    );
    expect(sql).toContain("WHERE migration_id = 'v2-0006'");
    expect(sql).toContain(plan.manifest.migrations[5]!.sha256);
    for (const entry of plan.manifest.migrations) {
      expect(sql).toContain(
        `('${entry.id}', '${entry.file}', '${entry.sha256}')`,
      );
    }
  });

  it("returns a new frozen validated plan snapshot", async () => {
    const plan = await loadAuthenticatedMigrationPlan();
    const snapshot = snapshotAuthenticatedMigrationPlan(plan);

    expect(snapshot).toEqual(plan);
    expect(snapshot).not.toBe(plan);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest.migrations)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest.migrations[0])).toBe(true);
    expect(Object.isFrozen(snapshot.applicationFiles)).toBe(true);
    expect(Object.isFrozen(snapshot.applicationFiles[0])).toBe(true);
    expect(
      createHash("sha256")
        .update(snapshot.applicationFiles[5]!.sql)
        .digest("hex"),
    ).toBe(snapshot.manifest.migrations[5]!.sha256);
  });
});

interface QueryCall {
  readonly text: string;
  readonly values?: readonly unknown[];
  readonly rowMode?: string;
}

class ScriptedMigrationClient {
  public ledger: string[][];
  public readonly calls: QueryCall[] = [];
  public readonly bodyQueries: string[] = [];
  public readonly transactionCalls: QueryCall[][] = [];
  public rollbackCount = 0;
  public resetRoleCount = 0;
  public ledgerLockErrorCode: string | null = null;
  public ledgerShapeValid = true;
  public capabilityRolesValid = true;
  public failBodyOnce = false;
  public failBegin = false;
  public failRollbackInTransaction = false;
  public failCommit = false;
  public failPostCommitIdentity = false;
  public useResultPrototype = false;
  public advisoryGate: Promise<void> | null = null;
  public readonly advisoryReached = deferred<void>();

  private transactionSnapshot: string[][] | null = null;
  private transactionCallIndex = -1;
  private ownerSelected = false;

  public constructor(rows: readonly (readonly string[])[]) {
    this.ledger = rows.map((row) => [...row]);
  }

  public readonly query = async (input: unknown): Promise<unknown> => {
    const call = normalizeQuery(input);
    this.calls.push(call);
    const text = call.text;

    if (text === "ROLLBACK") {
      this.rollbackCount += 1;
      if (this.transactionSnapshot !== null) {
        if (this.failRollbackInTransaction) throw pgError("08006");
        this.ledger = this.transactionSnapshot.map((row) => [...row]);
        this.transactionSnapshot = null;
      }
      this.ownerSelected = false;
      return emptyResult("ROLLBACK");
    }
    if (text === "RESET ROLE") {
      this.resetRoleCount += 1;
      this.ownerSelected = false;
      return emptyResult("RESET");
    }
    if (text.startsWith("BEGIN ISOLATION LEVEL")) {
      this.transactionSnapshot = this.ledger.map((row) => [...row]);
      this.transactionCallIndex += 1;
      this.transactionCalls.push([]);
      this.recordTransactionCall(call);
      if (this.failBegin) throw pgError("08006");
      return emptyResult("BEGIN");
    }
    this.recordTransactionCall(call);
    if (text.includes("pg_advisory_xact_lock")) {
      this.advisoryReached.resolve();
      if (this.advisoryGate !== null) await this.advisoryGate;
      return this.result(selectResult(["pg_advisory_xact_lock"], [[""]]));
    }
    if (text === "SET LOCAL ROLE research_cockpit_owner") {
      this.ownerSelected = true;
      return emptyResult("SET");
    }
    if (text.includes("'loginAttributesValid'")) {
      return this.result(
        jsonResult("migration_deployment_identity", {
          databaseName,
          sessionUser: POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE,
          currentUser: ownerRole,
          systemUser: `scram-sha-256:${POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE}`,
          transactionIsolation: "read committed",
          transactionReadOnly: "off",
          loginAttributesValid: true,
          capabilityRolesValid: this.capabilityRolesValid,
          roleSettingsCount: 0,
          exactMembershipCount: 1,
          relatedMembershipCount: 1,
          ownedSchemaCount: 2,
          platformExtensionCount: 1,
        }),
      );
    }
    if (text.startsWith("LOCK TABLE ONLY")) {
      if (this.ledgerLockErrorCode !== null) {
        throw pgError(this.ledgerLockErrorCode);
      }
      return emptyResult("LOCK TABLE");
    }
    if (text.includes("'relationValid'")) {
      return this.result(
        jsonResult("migration_ledger_shape", {
          relationValid: this.ledgerShapeValid,
          columnsValid: this.ledgerShapeValid,
          constraintsValid: this.ledgerShapeValid,
          publicPrivilegesAbsent: this.ledgerShapeValid,
          runtimePrivilegesAbsent: this.ledgerShapeValid,
        }),
      );
    }
    if (text.includes("ORDER BY migration_id COLLATE")) {
      return this.result(
        selectResult(["migration_id", "file_name", "sha256"], this.ledger),
      );
    }
    if (text.startsWith("-- Versioned v2 application migration.")) {
      this.bodyQueries.push(text);
      if (this.failBodyOnce) {
        this.failBodyOnce = false;
        throw pgError("P0001");
      }
      return emptyResult("CREATE");
    }
    if (text.startsWith("INSERT INTO shared_data.schema_migrations")) {
      const values = call.values;
      if (
        values?.length !== 3 ||
        values.some((value) => typeof value !== "string")
      ) {
        throw new Error("invalid test insertion");
      }
      const row = values as readonly string[];
      this.ledger.push([...row]);
      return this.result(queryResult("INSERT", ["migration_id"], [[row[0]]]));
    }
    if (text === "SELECT 1 / 0") throw pgError("22012");
    if (text.includes("'sessionUser'")) {
      if (this.failPostCommitIdentity && this.transactionSnapshot === null) {
        throw pgError("08006");
      }
      return this.result(
        jsonResult("migration_deployment_identity", {
          sessionUser: POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE,
          currentUser: this.ownerSelected
            ? ownerRole
            : POSTGRES_MIGRATION_DEPLOYER_LOGIN_ROLE,
        }),
      );
    }
    if (text === "COMMIT") {
      if (this.failCommit) throw pgError("08006");
      this.transactionSnapshot = null;
      this.ownerSelected = false;
      return emptyResult("COMMIT");
    }
    if (text.includes("set_config('statement_timeout'")) {
      return this.result(
        selectResult(["set_config", "set_config"], [["", ""]]),
      );
    }
    throw new Error(`unexpected test query: ${text}`);
  };

  private recordTransactionCall(call: QueryCall): void {
    if (this.transactionCallIndex < 0) return;
    this.transactionCalls[this.transactionCallIndex]?.push(call);
  }

  private result(value: object): object {
    if (!this.useResultPrototype) return value;
    return Object.assign(new RepresentativeQueryResult(), value);
  }
}

class RepresentativeQueryResult {
  public readonly resultPrototype = true;
}

function ledgerRows(
  plan: AuthenticatedMigrationPlan,
  count: number,
): string[][] {
  return plan.manifest.migrations
    .slice(0, count)
    .map(({ id, file, sha256 }) => [id, file, sha256]);
}

function normalizeQuery(input: unknown): QueryCall {
  if (typeof input === "string") return { text: input };
  if (typeof input !== "object" || input === null) {
    throw new Error("invalid test query");
  }
  const value = input as {
    text?: unknown;
    values?: unknown;
    rowMode?: unknown;
  };
  if (typeof value.text !== "string") throw new Error("invalid test query");
  const values = Array.isArray(value.values) ? value.values : undefined;
  const rowMode = typeof value.rowMode === "string" ? value.rowMode : undefined;
  return {
    text: value.text,
    ...(values === undefined ? {} : { values }),
    ...(rowMode === undefined ? {} : { rowMode }),
  };
}

function jsonResult(fieldName: string, value: object): object {
  return selectResult([fieldName], [[JSON.stringify(value)]]);
}

function selectResult(
  fieldNames: readonly string[],
  rows: readonly (readonly unknown[])[],
): object {
  return queryResult("SELECT", fieldNames, rows);
}

function queryResult(
  command: string,
  fieldNames: readonly string[],
  rows: readonly (readonly unknown[])[],
): object {
  return {
    command,
    rowCount: rows.length,
    oid: 0,
    rows: rows.map((row) => [...row]),
    fields: fieldNames.map((name) => ({ name, dataTypeID: textOid })),
  };
}

function emptyResult(command: string): object {
  return { command, rowCount: null, oid: 0, rows: [], fields: [] };
}

function pgError(code: string): Error {
  const error = new Error("test PostgreSQL error");
  Object.assign(error, { code });
  return error;
}

async function rejected(value: Promise<unknown>): Promise<unknown> {
  try {
    await value;
  } catch (error) {
    return error;
  }
  throw new Error("expected promise rejection");
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

interface MutableAuthenticatedMigrationPlan {
  platformSql: string;
  manifest: {
    schemaVersion: 1;
    planVersion: 2;
    algorithm: "sha256";
    migrations: Array<{ id: string; file: string; sha256: string }>;
  };
  applicationFiles: Array<{ file: string; sql: string }>;
}

function mutablePlan(
  plan: AuthenticatedMigrationPlan,
): MutableAuthenticatedMigrationPlan {
  return {
    platformSql: plan.platformSql,
    manifest: {
      schemaVersion: 1,
      planVersion: 2,
      algorithm: "sha256",
      migrations: plan.manifest.migrations.map((entry) => ({ ...entry })),
    },
    applicationFiles: plan.applicationFiles.map((migration) => ({
      ...migration,
    })),
  };
}
