import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  assertAuthenticatedOwnerDdlCanaryCreateResult,
  assertAuthenticatedOwnerDdlCanaryDropResult,
  assertAuthenticatedOwnerDdlCanaryRollbackFailure,
  assertAuthenticatedTestLoaderFixtureResult,
  assertAuthenticatedTestLoaderFixtureRollbackFailure,
  assertExpectedPsqlFailure,
  assertMigratorWrongPasswordRejection,
  assertOwnerDdlWrongPasswordRejection,
  assertPostgresProjectionAdapterWrongPasswordRejection,
  assertRuntimeWrongPasswordRejection,
  assertTestLoaderWrongPasswordRejection,
  buildOwnerDdlAuthPsqlInvocation,
  buildMigratorAuthPsqlInvocation,
  buildRuntimeAuthPsqlInvocation,
  buildTestLoaderAuthPsqlInvocation,
  checkPostgresAcceptanceHarness,
  collectRuntimeAuthOperationFailures,
  EXPECTED_CAPABILITY_ROLE_ATTRIBUTE_ROWS,
  extractReviewedSyntheticFixtureBody,
  generateMigrationDeployerAuthPassword,
  generatePrivacyRetentionAuthPassword,
  generateOwnerDdlAuthPassword,
  generateMigratorAuthPassword,
  generateRuntimeAuthPassword,
  generateTestLoaderAuthPassword,
  injectBootstrapFailure,
  inspectPostgresAcceptanceHarness,
  OWNER_DDL_AUTH_CANARY_TABLE,
  OWNER_DDL_AUTH_CAPABILITY_ROLE,
  OWNER_DDL_AUTH_FORBIDDEN_SESSION_AUTHORIZATION_ROLES,
  OWNER_DDL_AUTH_FORBIDDEN_SET_ROLES,
  OWNER_DDL_AUTH_LOGIN_ROLE,
  OWNER_DDL_AUTH_PASSFILE,
  OWNER_DDL_AUTH_WRONG_PASSFILE,
  MIGRATOR_AUTH_CAPABILITY_ROLE,
  MIGRATOR_AUTH_FORBIDDEN_SESSION_AUTHORIZATION_ROLES,
  MIGRATOR_AUTH_FORBIDDEN_SET_ROLES,
  MIGRATOR_AUTH_LOGIN_ROLE,
  MIGRATOR_AUTH_PASSFILE,
  MIGRATOR_AUTH_WRONG_PASSFILE,
  MIGRATION_DEPLOYER_AUTH_CAPABILITY_ROLE,
  MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE,
  parsePostgresProjectionAdapterEndpoint,
  POSTGRES_PRIVACY_RETENTION_DATABASE_NAME,
  PRIVACY_RETENTION_AUTH_CAPABILITY_ROLE,
  PRIVACY_RETENTION_AUTH_LOGIN_ROLE,
  renderB7AcceptanceTargetResetSql,
  renderAuthenticatedOwnerDdlCanaryCreateSql,
  renderAuthenticatedOwnerDdlCanaryDropSql,
  renderAuthenticatedOwnerDdlCanaryRollbackProbeSql,
  renderAuthenticatedTestLoaderFixtureRollbackProbeSql,
  renderAuthenticatedTestLoaderFixtureSql,
  renderAlternatingPreparedStatementSql,
  renderRuntimeAuthBackendDrainSql,
  renderRuntimeAuthCleanupSql,
  renderRuntimeAuthPassfile,
  renderRuntimeAuthProvisioningSql,
  renderRuntimeAuthenticatedFinancialFactProjectionSql,
  renderRuntimeContextSql,
  renderOwnerDdlAuthBackendDrainSql,
  renderOwnerDdlAuthCanaryCleanupSql,
  renderOwnerDdlAuthCleanupSql,
  renderOwnerDdlAuthPassfile,
  renderOwnerDdlAuthProvisioningSql,
  renderPostgresProjectionPoolProvisioningSql,
  renderPrivacyRetentionAuthProvisioningSql,
  renderMigratorAuthBackendDrainSql,
  renderMigratorAuthCleanupSql,
  renderMigratorAuthPassfile,
  renderMigratorAuthProvisioningSql,
  renderMigrationDeployerAuthBackendDrainSql,
  renderMigrationDeployerAuthCleanupSql,
  renderMigrationDeployerAuthProvisioningSql,
  renderTestLoaderAuthBackendDrainSql,
  renderTestLoaderAuthCleanupSql,
  renderTestLoaderAuthPassfile,
  renderTestLoaderAuthProvisioningSql,
  RUNTIME_AUTH_CAPABILITY_ROLE,
  RUNTIME_AUTH_FORBIDDEN_SET_ROLES,
  RUNTIME_AUTH_LOGIN_ROLE,
  RUNTIME_AUTH_PASSFILE,
  RUNTIME_AUTH_WRONG_PASSFILE,
  runRuntimeAuthCommandWithDrain,
  runPostgresAcceptance,
  TEST_LOADER_AUTH_CAPABILITY_ROLE,
  TEST_LOADER_AUTH_FORBIDDEN_SET_ROLES,
  TEST_LOADER_AUTH_LOGIN_ROLE,
  TEST_LOADER_AUTH_PASSFILE,
  TEST_LOADER_AUTH_WRONG_PASSFILE,
  type AcceptanceArtifacts,
} from "../src/postgres-acceptance";

describe("PostgreSQL acceptance harness guardrails", () => {
  it("renders the exact ephemeral B13 privacy login and SET-only capability edge", () => {
    const password = "Q".repeat(43);
    const sql = renderPrivacyRetentionAuthProvisioningSql(password);

    expect(POSTGRES_PRIVACY_RETENTION_DATABASE_NAME).toBe(
      "research_cockpit_b13_privacy_retention_test",
    );
    expect(sql).toContain(`CREATE ROLE ${PRIVACY_RETENTION_AUTH_LOGIN_ROLE}`);
    expect(sql).not.toContain(
      `CREATE ROLE ${PRIVACY_RETENTION_AUTH_CAPABILITY_ROLE}`,
    );
    for (const attribute of [
      "NOSUPERUSER",
      "NOCREATEDB",
      "NOCREATEROLE",
      "NOREPLICATION",
      "NOINHERIT",
      "NOBYPASSRLS",
    ]) {
      expect(sql).toContain(attribute);
    }
    expect(sql).toContain("CONNECTION LIMIT 2");
    expect(sql).toContain(
      `GRANT ${PRIVACY_RETENTION_AUTH_CAPABILITY_ROLE}\n  TO ${PRIVACY_RETENTION_AUTH_LOGIN_ROLE}\n  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
    );
    expect(sql.match(new RegExp(password, "g"))).toHaveLength(1);

    const generated = Array.from({ length: 8 }, () =>
      generatePrivacyRetentionAuthPassword(),
    );
    expect(new Set(generated).size).toBe(generated.length);
    for (const value of generated) expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(() =>
      renderPrivacyRetentionAuthProvisioningSql(`invalid-${password}`),
    ).toThrow(/32-byte base64url/i);
  });

  it("matches PostgreSQL boolean-to-text catalog serialization", () => {
    expect(EXPECTED_CAPABILITY_ROLE_ATTRIBUTE_ROWS).toEqual([
      "research_cockpit_backup|false|false|false|false|false|false|false",
      "research_cockpit_owner|false|false|false|false|false|false|false",
      "research_cockpit_runtime|false|false|false|false|false|false|false",
      "research_cockpit_test_seed|false|false|false|false|false|false|false",
    ]);
  });

  it("renders the exact ephemeral runtime login and one-way role edge", () => {
    const password = "A".repeat(43);
    const sql = renderRuntimeAuthProvisioningSql(password);
    expect(sql).toContain(`CREATE ROLE ${RUNTIME_AUTH_LOGIN_ROLE}`);
    for (const attribute of [
      "LOGIN",
      "NOSUPERUSER",
      "NOCREATEDB",
      "NOCREATEROLE",
      "NOREPLICATION",
      "NOINHERIT",
      "NOBYPASSRLS",
      "CONNECTION LIMIT 1",
    ]) {
      expect(sql).toContain(attribute);
    }
    expect(sql).toContain(
      `GRANT ${RUNTIME_AUTH_CAPABILITY_ROLE}\n  TO ${RUNTIME_AUTH_LOGIN_ROLE}\n  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
    );
    const passwordPosition = sql.indexOf(`PASSWORD '${password}'`);
    expect(passwordPosition).toBeGreaterThan(-1);
    for (const suppression of [
      "SET LOCAL log_statement = 'none';",
      "SET LOCAL log_min_error_statement = 'panic';",
      "SET LOCAL log_duration = off;",
      "SET LOCAL log_min_duration_statement = -1;",
      "SET LOCAL log_min_duration_sample = -1;",
      "SET LOCAL log_statement_sample_rate = 0;",
      "SET LOCAL log_transaction_sample_rate = 0;",
    ]) {
      expect(sql.indexOf(suppression)).toBeGreaterThan(-1);
      expect(sql.indexOf(suppression)).toBeLessThan(passwordPosition);
    }
    expect(
      sql.indexOf("SET LOCAL password_encryption = 'scram-sha-256';"),
    ).toBeGreaterThan(-1);
    expect(
      sql.indexOf("SET LOCAL password_encryption = 'scram-sha-256';"),
    ).toBeLessThan(passwordPosition);
    expect(sql.match(new RegExp(password, "g"))).toHaveLength(1);
    expect(renderRuntimeAuthCleanupSql()).toContain(
      `DROP ROLE IF EXISTS ${RUNTIME_AUTH_LOGIN_ROLE};`,
    );
  });

  it("raises only the bounded B10 runtime-login connection limit", () => {
    const password = "P".repeat(43);
    const poolSql = renderPostgresProjectionPoolProvisioningSql(password);
    const singleClientSql = renderRuntimeAuthProvisioningSql(password);

    expect(poolSql).toContain("CONNECTION LIMIT 2");
    expect(poolSql).not.toContain("CONNECTION LIMIT 1");
    expect(singleClientSql).toContain("CONNECTION LIMIT 1");
    expect(singleClientSql).not.toContain("CONNECTION LIMIT 2");
    expect(poolSql).toContain(
      `GRANT ${RUNTIME_AUTH_CAPABILITY_ROLE}\n  TO ${RUNTIME_AUTH_LOGIN_ROLE}\n  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
    );
    expect(poolSql.match(new RegExp(password, "g"))).toHaveLength(1);
  });

  it("uses random 32-byte base64url credentials without exposing them in process arguments", () => {
    const passwords = Array.from({ length: 8 }, () =>
      generateRuntimeAuthPassword(),
    );
    expect(new Set(passwords).size).toBe(passwords.length);
    for (const password of passwords) {
      expect(password).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }

    const password = passwords[0];
    if (!password) throw new Error("Missing generated runtime-auth password");
    const invocation = buildRuntimeAuthPsqlInvocation(RUNTIME_AUTH_PASSFILE);
    expect(invocation.environment).toEqual({
      PGPASSFILE: RUNTIME_AUTH_PASSFILE,
      PGREQUIREAUTH: "scram-sha-256",
      PGSSLMODE: "disable",
      PGCONNECT_TIMEOUT: "5",
    });
    expect(invocation.command).toEqual(
      expect.arrayContaining([
        "--no-password",
        "--host=127.0.0.1",
        "--port=5432",
        `--username=${RUNTIME_AUTH_LOGIN_ROLE}`,
      ]),
    );
    expect(JSON.stringify(invocation)).not.toContain(password);
    expect(renderRuntimeAuthPassfile(password)).toBe(
      `127.0.0.1:5432:research_cockpit_acceptance_test:${RUNTIME_AUTH_LOGIN_ROLE}:${password}\n`,
    );
    expect(() =>
      renderRuntimeAuthProvisioningSql(`invalid-${password}`),
    ).toThrow(/32-byte base64url/i);
    for (const suffix of ["\n", "\r", "\r\n"]) {
      expect(() => renderRuntimeAuthPassfile(`A`.repeat(43) + suffix)).toThrow(
        /32-byte base64url/i,
      );
    }
  });

  it("keeps both fixed credential files out of command-line passwords", () => {
    for (const path of [RUNTIME_AUTH_PASSFILE, RUNTIME_AUTH_WRONG_PASSFILE]) {
      const invocation = buildRuntimeAuthPsqlInvocation(path, {
        verboseErrors: true,
      });
      expect(invocation.environment.PGPASSFILE).toBe(path);
      expect(invocation.environment.PGREQUIREAUTH).toBe("scram-sha-256");
      expect(invocation.command).toContain("--set=VERBOSITY=verbose");
      expect(invocation.command.join(" ")).not.toMatch(/PGPASSWORD|password=/i);
    }

    const wrongPasswordInvocation = buildRuntimeAuthPsqlInvocation(
      RUNTIME_AUTH_WRONG_PASSFILE,
      { requireScram: false },
    );
    expect(wrongPasswordInvocation.environment).toEqual({
      PGPASSFILE: RUNTIME_AUTH_WRONG_PASSFILE,
      PGSSLMODE: "disable",
      PGCONNECT_TIMEOUT: "5",
    });
    expect(wrongPasswordInvocation.environment).not.toHaveProperty(
      "PGREQUIREAUTH",
    );
    expect(wrongPasswordInvocation.command).toEqual(
      expect.arrayContaining([
        "--no-password",
        "--host=127.0.0.1",
        "--port=5432",
        `--username=${RUNTIME_AUTH_LOGIN_ROLE}`,
      ]),
    );
    const correctPasswordInvocation = buildRuntimeAuthPsqlInvocation(
      RUNTIME_AUTH_PASSFILE,
    );
    expect(wrongPasswordInvocation.command).toEqual(
      correctPasswordInvocation.command,
    );
    const { PGREQUIREAUTH: requiredAuthentication, ...correctEnvironment } =
      correctPasswordInvocation.environment;
    expect(requiredAuthentication).toBe("scram-sha-256");
    expect(wrongPasswordInvocation.environment).toEqual({
      ...correctEnvironment,
      PGPASSFILE: RUNTIME_AUTH_WRONG_PASSFILE,
    });
  });

  it("classifies only the exact wrong-password connection failure", () => {
    expect(() =>
      assertRuntimeWrongPasswordRejection({
        exitCode: 2,
        stdout: "",
        stderr: `psql: error: connection failed: FATAL:  password authentication failed\n  for user "${RUNTIME_AUTH_LOGIN_ROLE}"\n`,
      }),
    ).not.toThrow();

    for (const result of [
      { exitCode: 0, stdout: "1\n", stderr: "" },
      {
        exitCode: 1,
        stdout: "",
        stderr: `FATAL: password authentication failed for user "${RUNTIME_AUTH_LOGIN_ROLE}"`,
      },
      {
        exitCode: 3,
        stdout: "",
        stderr: `FATAL: password authentication failed for user "${RUNTIME_AUTH_LOGIN_ROLE}"`,
      },
      {
        exitCode: 2,
        stdout: "unexpected",
        stderr: `FATAL: password authentication failed for user "${RUNTIME_AUTH_LOGIN_ROLE}"`,
      },
      {
        exitCode: 2,
        stdout: "",
        stderr: "connection refused",
      },
      {
        exitCode: 2,
        stdout: "",
        stderr: "no pg_hba.conf entry",
      },
      {
        exitCode: 2,
        stdout: "",
        stderr:
          'authentication method requirement "scram-sha-256" failed: server did not complete authentication',
      },
      {
        exitCode: 2,
        stdout: "",
        stderr: 'FATAL: password authentication failed for user "another_role"',
      },
    ]) {
      expect(() => assertRuntimeWrongPasswordRejection(result)).toThrow(
        /wrong-password runtime authentication/i,
      );
    }
  });

  it("accepts only the exact value-free node-postgres wrong-password code", () => {
    expect(() =>
      assertPostgresProjectionAdapterWrongPasswordRejection({
        code: "28P01",
        message: "driver details remain internal",
      }),
    ).not.toThrow();

    const secret = "b9-wrong-password-secret-canary";
    for (const error of [
      new Error(secret),
      { code: "08001", message: secret },
      { code: "28P01 ", message: secret },
      Object.defineProperty({}, "code", {
        get: () => {
          throw new Error(secret);
        },
      }),
    ]) {
      let thrown: unknown;
      try {
        assertPostgresProjectionAdapterWrongPasswordRejection(error);
      } catch (caught) {
        thrown = caught;
      }
      expect(thrown).toMatchObject({
        name: "PostgresProjectionAdapterError",
        code: "POSTGRES_PROJECTION_ADAPTER_FAILURE",
        message: "PostgreSQL projection adapter failed.",
      });
      expect(String(thrown)).not.toContain(secret);
      expect(thrown).not.toHaveProperty("cause");
    }
  });

  it("requires the exact loopback host and one canonical dynamic adapter port", () => {
    expect(
      parsePostgresProjectionAdapterEndpoint({
        RESEARCH_COCKPIT_PG_ADAPTER_HOST: "127.0.0.1",
        RESEARCH_COCKPIT_PG_ADAPTER_PORT: "49152",
      }),
    ).toEqual({ host: "127.0.0.1", port: 49152 });

    for (const [host, port] of [
      [undefined, "49152"],
      ["localhost", "49152"],
      ["0.0.0.0", "49152"],
      ["127.0.0.1", undefined],
      ["127.0.0.1", ""],
      ["127.0.0.1", "05432"],
      ["127.0.0.1", "5432x"],
      ["127.0.0.1", "0"],
      ["127.0.0.1", "65536"],
    ] as const) {
      expect(() =>
        parsePostgresProjectionAdapterEndpoint({
          RESEARCH_COCKPIT_PG_ADAPTER_HOST: host,
          RESEARCH_COCKPIT_PG_ADAPTER_PORT: port,
        }),
      ).toThrow(/B9 PostgreSQL adapter/i);
    }
  });

  it("denies SET ROLE for every ungranted capability and postgres", () => {
    expect(RUNTIME_AUTH_FORBIDDEN_SET_ROLES).toEqual([
      "research_cockpit_owner",
      "research_cockpit_test_seed",
      "research_cockpit_backup",
      "postgres",
    ]);
  });

  it("renders the exact ephemeral test-loader login and SET-only role edge", () => {
    const password = "B".repeat(43);
    const sql = renderTestLoaderAuthProvisioningSql(password);
    expect(sql).toContain(`CREATE ROLE ${TEST_LOADER_AUTH_LOGIN_ROLE}`);
    for (const attribute of [
      "LOGIN",
      "NOSUPERUSER",
      "NOCREATEDB",
      "NOCREATEROLE",
      "NOREPLICATION",
      "NOINHERIT",
      "NOBYPASSRLS",
      "CONNECTION LIMIT 1",
    ]) {
      expect(sql).toContain(attribute);
    }
    expect(sql).toContain(
      `GRANT ${TEST_LOADER_AUTH_CAPABILITY_ROLE}\n  TO ${TEST_LOADER_AUTH_LOGIN_ROLE}\n  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
    );
    const passwordPosition = sql.indexOf(`PASSWORD '${password}'`);
    expect(passwordPosition).toBeGreaterThan(-1);
    for (const suppression of [
      "SET LOCAL log_statement = 'none';",
      "SET LOCAL log_min_error_statement = 'panic';",
      "SET LOCAL log_duration = off;",
      "SET LOCAL log_min_duration_statement = -1;",
      "SET LOCAL log_min_duration_sample = -1;",
      "SET LOCAL log_statement_sample_rate = 0;",
      "SET LOCAL log_transaction_sample_rate = 0;",
      "SET LOCAL password_encryption = 'scram-sha-256';",
    ]) {
      expect(sql.indexOf(suppression)).toBeGreaterThan(-1);
      expect(sql.indexOf(suppression)).toBeLessThan(passwordPosition);
    }
    expect(sql.match(new RegExp(password, "g"))).toHaveLength(1);
    expect(renderTestLoaderAuthCleanupSql()).toBe(
      `BEGIN;\nDROP ROLE IF EXISTS ${TEST_LOADER_AUTH_LOGIN_ROLE};\nCOMMIT;\n`,
    );
    expect(TEST_LOADER_AUTH_FORBIDDEN_SET_ROLES).toEqual([
      "research_cockpit_owner",
      "research_cockpit_runtime",
      "research_cockpit_backup",
      "postgres",
    ]);
  });

  it("keeps test-loader SCRAM credentials fixed-path, random, and out of arguments", () => {
    const passwords = Array.from({ length: 8 }, () =>
      generateTestLoaderAuthPassword(),
    );
    expect(new Set(passwords).size).toBe(passwords.length);
    for (const password of passwords) {
      expect(password).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }

    const password = passwords[0];
    if (!password) throw new Error("Missing generated test-loader password");
    expect(renderTestLoaderAuthPassfile(password)).toBe(
      `127.0.0.1:5432:research_cockpit_acceptance_test:${TEST_LOADER_AUTH_LOGIN_ROLE}:${password}\n`,
    );
    for (const path of [
      TEST_LOADER_AUTH_PASSFILE,
      TEST_LOADER_AUTH_WRONG_PASSFILE,
    ]) {
      const invocation = buildTestLoaderAuthPsqlInvocation(path, {
        verboseErrors: true,
      });
      expect(invocation.environment).toEqual({
        PGPASSFILE: path,
        PGREQUIREAUTH: "scram-sha-256",
        PGSSLMODE: "disable",
        PGCONNECT_TIMEOUT: "5",
      });
      expect(invocation.command).toEqual(
        expect.arrayContaining([
          "--no-psqlrc",
          "--no-password",
          "--set=ON_ERROR_STOP=1",
          "--set=VERBOSITY=verbose",
          "--host=127.0.0.1",
          "--port=5432",
          `--username=${TEST_LOADER_AUTH_LOGIN_ROLE}`,
        ]),
      );
      expect(JSON.stringify(invocation)).not.toContain(password);
      expect(invocation.command.join(" ")).not.toMatch(/PGPASSWORD|password=/i);
    }

    const wrongPasswordInvocation = buildTestLoaderAuthPsqlInvocation(
      TEST_LOADER_AUTH_WRONG_PASSFILE,
      { requireScram: false },
    );
    expect(wrongPasswordInvocation.environment).toEqual({
      PGPASSFILE: TEST_LOADER_AUTH_WRONG_PASSFILE,
      PGSSLMODE: "disable",
      PGCONNECT_TIMEOUT: "5",
    });
    expect(() =>
      renderTestLoaderAuthProvisioningSql(`invalid-${password}`),
    ).toThrow(/32-byte base64url/i);
    for (const suffix of ["\n", "\r", "\r\n"]) {
      expect(() =>
        renderTestLoaderAuthPassfile("B".repeat(43) + suffix),
      ).toThrow(/32-byte base64url/i);
    }
  });

  it("classifies only the exact test-loader wrong-password rejection", () => {
    expect(() =>
      assertTestLoaderWrongPasswordRejection({
        exitCode: 2,
        stdout: "",
        stderr: `psql: error: connection failed: FATAL: password authentication failed\n for user "${TEST_LOADER_AUTH_LOGIN_ROLE}"\n`,
      }),
    ).not.toThrow();

    for (const result of [
      { exitCode: 0, stdout: "1\n", stderr: "" },
      {
        exitCode: 1,
        stdout: "",
        stderr: `FATAL: password authentication failed for user "${TEST_LOADER_AUTH_LOGIN_ROLE}"`,
      },
      {
        exitCode: 2,
        stdout: "unexpected",
        stderr: `FATAL: password authentication failed for user "${TEST_LOADER_AUTH_LOGIN_ROLE}"`,
      },
      { exitCode: 2, stdout: "", stderr: "connection refused" },
      {
        exitCode: 2,
        stdout: "",
        stderr: 'FATAL: password authentication failed for user "another_role"',
      },
    ]) {
      expect(() => assertTestLoaderWrongPasswordRejection(result)).toThrow(
        /wrong-password test-loader authentication/i,
      );
    }
  });

  it("extracts only the reviewed insert body and renders one authenticated transaction", async () => {
    const { fixture } = await loadArtifacts();
    const normalized = fixture.replaceAll("\r\n", "\n");
    const prefix = `SET SESSION AUTHORIZATION ${TEST_LOADER_AUTH_CAPABILITY_ROLE};\n\nBEGIN;\n\n`;
    const suffix = `\n\nCOMMIT;\n\nRESET SESSION AUTHORIZATION;\n`;
    const expectedBody = normalized.slice(
      prefix.length,
      normalized.length - suffix.length,
    );
    const body = extractReviewedSyntheticFixtureBody(fixture);
    expect(body).toBe(expectedBody);
    expect(body).not.toMatch(/SESSION AUTHORIZATION|\bBEGIN\b|\bCOMMIT\b/);

    const rendered = renderAuthenticatedTestLoaderFixtureSql(fixture);
    expect(rendered).toMatch(
      /^BEGIN;\nSET LOCAL ROLE research_cockpit_test_seed;/,
    );
    expect(rendered).not.toMatch(/SESSION AUTHORIZATION|RESET ROLE/);
    expect(rendered.match(/SET LOCAL ROLE/g)).toHaveLength(1);
    expect(
      rendered.match(/INSERT INTO private_data\.organizations/g),
    ).toHaveLength(1);
    expect(rendered.indexOf(body)).toBeGreaterThan(-1);
    expect(rendered.indexOf("COMMIT;\nSELECT CASE")).toBeGreaterThan(
      rendered.indexOf(body),
    );
    expect(rendered).not.toContain("SELECT 1 / 0;");

    const rollback =
      renderAuthenticatedTestLoaderFixtureRollbackProbeSql(fixture);
    expect(rollback.match(/SELECT 1 \/ 0;/g)).toHaveLength(1);
    expect(rollback).toContain(`${body}\nSELECT 1 / 0;\nCOMMIT;`);
  });

  it("rejects adversarial fixture envelopes before authenticated rendering", async () => {
    const { fixture } = await loadArtifacts();
    const mutations = [
      fixture.replace(
        `SET SESSION AUTHORIZATION ${TEST_LOADER_AUTH_CAPABILITY_ROLE};`,
        `SET ROLE ${TEST_LOADER_AUTH_CAPABILITY_ROLE};`,
      ),
      fixture.replace("BEGIN;", "BEGIN;\nSELECT 1;"),
      fixture.replace(
        ";\n\nINSERT INTO private_data.principals",
        " RETURNING id;\n\nINSERT INTO private_data.principals",
      ),
      fixture.replace(
        ";\n\nINSERT INTO private_data.principals",
        " ON CONFLICT DO NOTHING;\n\nINSERT INTO private_data.principals",
      ),
      fixture.replace("\n\nCOMMIT;", "\n\\gexec\n\nCOMMIT;"),
      fixture.replaceAll("\r\n", "\n").replace("BEGIN;\n", "BEGIN;\r"),
    ];
    for (const mutation of mutations) {
      expect(() => extractReviewedSyntheticFixtureBody(mutation)).toThrow(
        /fixture envelope is invalid/i,
      );
      expect(() => renderAuthenticatedTestLoaderFixtureSql(mutation)).toThrow(
        /fixture envelope is invalid/i,
      );
    }
  });

  it("accepts only exact authenticated fixture and rollback markers", () => {
    const identity = `b5-test-loader-identity|${TEST_LOADER_AUTH_LOGIN_ROLE}|${TEST_LOADER_AUTH_CAPABILITY_ROLE}|scram-sha-256:${TEST_LOADER_AUTH_LOGIN_ROLE}`;
    const reset = `b5-test-loader-reset|${TEST_LOADER_AUTH_LOGIN_ROLE}|${TEST_LOADER_AUTH_LOGIN_ROLE}|scram-sha-256:${TEST_LOADER_AUTH_LOGIN_ROLE}`;
    expect(() =>
      assertAuthenticatedTestLoaderFixtureResult({
        exitCode: 0,
        stdout: `${identity}\n${reset}\n`,
        stderr: "",
      }),
    ).not.toThrow();
    for (const result of [
      { exitCode: 1, stdout: `${identity}\n${reset}\n`, stderr: "" },
      { exitCode: 0, stdout: `${identity}\n`, stderr: "" },
      { exitCode: 0, stdout: `${identity}\n${reset}\nextra\n`, stderr: "" },
      {
        exitCode: 0,
        stdout: `${identity}\n${reset}\n`,
        stderr: "NOTICE: unexpected",
      },
    ]) {
      expect(() => assertAuthenticatedTestLoaderFixtureResult(result)).toThrow(
        /authenticated test-loader fixture/i,
      );
    }

    expect(() =>
      assertAuthenticatedTestLoaderFixtureRollbackFailure({
        exitCode: 3,
        stdout: `${identity}\n`,
        stderr: "ERROR:  22012: division by zero",
      }),
    ).not.toThrow();
    for (const result of [
      {
        exitCode: 1,
        stdout: `${identity}\n`,
        stderr: "ERROR:  22012: division by zero",
      },
      {
        exitCode: 3,
        stdout: `${identity}\n`,
        stderr: "ERROR:  42501: permission denied",
      },
      {
        exitCode: 3,
        stdout: `${identity}\n${reset}\n`,
        stderr: "ERROR:  22012: division by zero",
      },
    ]) {
      expect(() =>
        assertAuthenticatedTestLoaderFixtureRollbackFailure(result),
      ).toThrow(/rollback probe/i);
    }
  });

  it("uses a bounded administrator-side drain for test-loader backends", () => {
    const drainSql = renderTestLoaderAuthBackendDrainSql();
    expect(drainSql).toContain("FROM pg_catalog.pg_stat_activity");
    expect(drainSql).toContain(`usename = '${TEST_LOADER_AUTH_LOGIN_ROLE}'`);
    expect(drainSql).toContain("backend_type = 'client backend'");
    expect(drainSql).toContain("interval '5 seconds'");
    expect(drainSql).toContain("pg_catalog.pg_sleep(0.05)");
    expect(drainSql).toContain("USING ERRCODE = '55000'");
    expect(drainSql).toContain("END;\n$test_loader_auth_backend_drain$;");
  });

  it("renders the exact ephemeral owner-DDL login and SET-only owner edge", () => {
    const password = "C".repeat(43);
    const sql = renderOwnerDdlAuthProvisioningSql(password);
    expect(sql).toContain(`CREATE ROLE ${OWNER_DDL_AUTH_LOGIN_ROLE}`);
    for (const attribute of [
      "LOGIN",
      "NOSUPERUSER",
      "NOCREATEDB",
      "NOCREATEROLE",
      "NOREPLICATION",
      "NOINHERIT",
      "NOBYPASSRLS",
      "CONNECTION LIMIT 1",
    ]) {
      expect(sql).toContain(attribute);
    }
    expect(sql).toContain(
      `GRANT ${OWNER_DDL_AUTH_CAPABILITY_ROLE}\n  TO ${OWNER_DDL_AUTH_LOGIN_ROLE}\n  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
    );
    const passwordPosition = sql.indexOf(`PASSWORD '${password}'`);
    expect(passwordPosition).toBeGreaterThan(-1);
    for (const suppression of [
      "SET LOCAL log_statement = 'none';",
      "SET LOCAL log_min_error_statement = 'panic';",
      "SET LOCAL log_duration = off;",
      "SET LOCAL log_min_duration_statement = -1;",
      "SET LOCAL log_min_duration_sample = -1;",
      "SET LOCAL log_statement_sample_rate = 0;",
      "SET LOCAL log_transaction_sample_rate = 0;",
      "SET LOCAL password_encryption = 'scram-sha-256';",
    ]) {
      expect(sql.indexOf(suppression)).toBeGreaterThan(-1);
      expect(sql.indexOf(suppression)).toBeLessThan(passwordPosition);
    }
    expect(sql.match(new RegExp(password, "g"))).toHaveLength(1);
    expect(renderOwnerDdlAuthCleanupSql()).toBe(
      `BEGIN;\nDROP ROLE IF EXISTS ${OWNER_DDL_AUTH_LOGIN_ROLE};\nCOMMIT;\n`,
    );
    expect(renderOwnerDdlAuthCanaryCleanupSql()).toBe(
      `BEGIN;\nDROP TABLE IF EXISTS ${OWNER_DDL_AUTH_CANARY_TABLE};\nCOMMIT;\n`,
    );
    expect(OWNER_DDL_AUTH_FORBIDDEN_SET_ROLES).toEqual([
      "research_cockpit_runtime",
      "research_cockpit_test_seed",
      "research_cockpit_backup",
      "postgres",
    ]);
    expect(OWNER_DDL_AUTH_FORBIDDEN_SESSION_AUTHORIZATION_ROLES).toEqual([
      "research_cockpit_owner",
      "research_cockpit_runtime",
      "research_cockpit_test_seed",
      "research_cockpit_backup",
      "postgres",
    ]);
  });

  it("keeps owner-DDL SCRAM credentials fixed-path, random, and out of arguments", () => {
    const passwords = Array.from({ length: 8 }, () =>
      generateOwnerDdlAuthPassword(),
    );
    expect(new Set(passwords).size).toBe(passwords.length);
    for (const password of passwords) {
      expect(password).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }

    const password = passwords[0];
    if (!password) throw new Error("Missing generated owner-DDL password");
    expect(renderOwnerDdlAuthPassfile(password)).toBe(
      `127.0.0.1:5432:research_cockpit_acceptance_test:${OWNER_DDL_AUTH_LOGIN_ROLE}:${password}\n`,
    );
    for (const path of [
      OWNER_DDL_AUTH_PASSFILE,
      OWNER_DDL_AUTH_WRONG_PASSFILE,
    ]) {
      const invocation = buildOwnerDdlAuthPsqlInvocation(path, {
        verboseErrors: true,
      });
      expect(invocation.environment).toEqual({
        PGPASSFILE: path,
        PGREQUIREAUTH: "scram-sha-256",
        PGSSLMODE: "disable",
        PGCONNECT_TIMEOUT: "5",
      });
      expect(invocation.command).toEqual(
        expect.arrayContaining([
          "--no-psqlrc",
          "--no-password",
          "--set=ON_ERROR_STOP=1",
          "--set=VERBOSITY=verbose",
          "--host=127.0.0.1",
          "--port=5432",
          `--username=${OWNER_DDL_AUTH_LOGIN_ROLE}`,
        ]),
      );
      expect(JSON.stringify(invocation)).not.toContain(password);
      expect(invocation.command.join(" ")).not.toMatch(/PGPASSWORD|password=/i);
    }

    const wrongPasswordInvocation = buildOwnerDdlAuthPsqlInvocation(
      OWNER_DDL_AUTH_WRONG_PASSFILE,
      { requireScram: false },
    );
    expect(wrongPasswordInvocation.environment).toEqual({
      PGPASSFILE: OWNER_DDL_AUTH_WRONG_PASSFILE,
      PGSSLMODE: "disable",
      PGCONNECT_TIMEOUT: "5",
    });
    expect(() =>
      renderOwnerDdlAuthProvisioningSql(`invalid-${password}`),
    ).toThrow(/32-byte base64url/i);
    for (const suffix of ["\n", "\r", "\r\n"]) {
      expect(() => renderOwnerDdlAuthPassfile("C".repeat(43) + suffix)).toThrow(
        /32-byte base64url/i,
      );
    }
  });

  it("classifies only the exact owner-DDL wrong-password rejection", () => {
    expect(() =>
      assertOwnerDdlWrongPasswordRejection({
        exitCode: 2,
        stdout: "",
        stderr: `psql: error: connection failed: FATAL: password authentication failed\n for user "${OWNER_DDL_AUTH_LOGIN_ROLE}"\n`,
      }),
    ).not.toThrow();

    for (const result of [
      { exitCode: 0, stdout: "1\n", stderr: "" },
      {
        exitCode: 1,
        stdout: "",
        stderr: `FATAL: password authentication failed for user "${OWNER_DDL_AUTH_LOGIN_ROLE}"`,
      },
      {
        exitCode: 2,
        stdout: "unexpected",
        stderr: `FATAL: password authentication failed for user "${OWNER_DDL_AUTH_LOGIN_ROLE}"`,
      },
      { exitCode: 2, stdout: "", stderr: "connection refused" },
      {
        exitCode: 2,
        stdout: "",
        stderr: 'FATAL: password authentication failed for user "another_role"',
      },
    ]) {
      expect(() => assertOwnerDdlWrongPasswordRejection(result)).toThrow(
        /wrong-password owner-DDL authentication/i,
      );
    }
  });

  it("renders one fixed authenticated owner-DDL create, rollback, and drop lifecycle", () => {
    const create = renderAuthenticatedOwnerDdlCanaryCreateSql();
    const rollback = renderAuthenticatedOwnerDdlCanaryRollbackProbeSql();
    const drop = renderAuthenticatedOwnerDdlCanaryDropSql();

    expect(create).toMatch(/^BEGIN;\nSET LOCAL ROLE research_cockpit_owner;/);
    expect(create.match(/SET LOCAL ROLE/g)).toHaveLength(1);
    expect(
      create.match(/CREATE TABLE private_data\.b6_owner_ddl_canary/g),
    ).toHaveLength(1);
    expect(create).toContain("b6_owner_ddl_canary_pkey PRIMARY KEY");
    expect(create).toContain("b6_owner_ddl_canary_marker_check");
    expect(create).toContain("privilege.grantee <> class.relowner");
    expect(create).toContain("pg_get_userbyid(class.relowner)");
    expect(create).not.toContain("SELECT 1 / 0;");
    expect(create).not.toMatch(
      /schema_migrations|acceptance\/synthetic-fixture/,
    );

    expect(rollback.match(/SELECT 1 \/ 0;/g)).toHaveLength(1);
    expect(rollback.replace("\nSELECT 1 / 0;", "")).toBe(create);
    expect(rollback.indexOf("SELECT 1 / 0;")).toBeGreaterThan(
      rollback.indexOf("b6-owner-ddl-catalog-invalid"),
    );
    expect(rollback.indexOf("SELECT 1 / 0;")).toBeLessThan(
      rollback.indexOf("COMMIT;"),
    );

    expect(drop).toMatch(/^BEGIN;\nSET LOCAL ROLE research_cockpit_owner;/);
    expect(drop).toContain(`DROP TABLE ${OWNER_DDL_AUTH_CANARY_TABLE};`);
    expect(drop).toContain(
      `pg_catalog.to_regclass('${OWNER_DDL_AUTH_CANARY_TABLE}') IS NULL`,
    );
    expect(drop.indexOf("COMMIT;")).toBeLessThan(
      drop.indexOf("b6-owner-ddl-reset"),
    );
  });

  it("accepts only exact owner-DDL create, rollback, and drop markers", () => {
    const identity = `b6-owner-ddl-identity|${OWNER_DDL_AUTH_LOGIN_ROLE}|${OWNER_DDL_AUTH_CAPABILITY_ROLE}|scram-sha-256:${OWNER_DDL_AUTH_LOGIN_ROLE}`;
    const catalog = `b6-owner-ddl-catalog|${OWNER_DDL_AUTH_CANARY_TABLE}|${OWNER_DDL_AUTH_CAPABILITY_ROLE}|no-non-owner-acl`;
    const reset = `b6-owner-ddl-reset|${OWNER_DDL_AUTH_LOGIN_ROLE}|${OWNER_DDL_AUTH_LOGIN_ROLE}|scram-sha-256:${OWNER_DDL_AUTH_LOGIN_ROLE}`;
    const drop = `b6-owner-ddl-drop|${OWNER_DDL_AUTH_CANARY_TABLE}|absent`;

    expect(() =>
      assertAuthenticatedOwnerDdlCanaryCreateResult({
        exitCode: 0,
        stdout: `${identity}\n${catalog}\n${reset}\n`,
        stderr: "",
      }),
    ).not.toThrow();
    expect(() =>
      assertAuthenticatedOwnerDdlCanaryRollbackFailure({
        exitCode: 3,
        stdout: `${identity}\n${catalog}\n`,
        stderr: "ERROR:  22012: division by zero",
      }),
    ).not.toThrow();
    expect(() =>
      assertAuthenticatedOwnerDdlCanaryDropResult({
        exitCode: 0,
        stdout: `${drop}\n${reset}\n`,
        stderr: "",
      }),
    ).not.toThrow();

    for (const result of [
      {
        exitCode: 1,
        stdout: `${identity}\n${catalog}\n${reset}\n`,
        stderr: "",
      },
      { exitCode: 0, stdout: `${identity}\n${catalog}\n`, stderr: "" },
      {
        exitCode: 0,
        stdout: `${identity}\n${catalog}\n${reset}\nextra\n`,
        stderr: "",
      },
      {
        exitCode: 0,
        stdout: `${identity}\n${catalog}\n${reset}\n`,
        stderr: "NOTICE: unexpected",
      },
    ]) {
      expect(() =>
        assertAuthenticatedOwnerDdlCanaryCreateResult(result),
      ).toThrow(/owner-DDL canary create/i);
    }

    for (const result of [
      {
        exitCode: 1,
        stdout: `${identity}\n${catalog}\n`,
        stderr: "ERROR:  22012: division by zero",
      },
      {
        exitCode: 3,
        stdout: `${identity}\n${catalog}\n`,
        stderr: "ERROR:  42501: permission denied",
      },
      {
        exitCode: 3,
        stdout: `${identity}\n${catalog}\n${reset}\n`,
        stderr: "ERROR:  22012: division by zero",
      },
      {
        exitCode: 3,
        stdout: `${identity}\n${catalog}\n`,
        stderr: "WARNING: unexpected\nERROR:  22012: division by zero",
      },
    ]) {
      expect(() =>
        assertAuthenticatedOwnerDdlCanaryRollbackFailure(result),
      ).toThrow(/rollback probe/i);
    }

    for (const result of [
      { exitCode: 1, stdout: `${drop}\n${reset}\n`, stderr: "" },
      { exitCode: 0, stdout: `${drop}\n`, stderr: "" },
      { exitCode: 0, stdout: `${drop}\n${reset}\nextra\n`, stderr: "" },
      {
        exitCode: 0,
        stdout: `${drop}\n${reset}\n`,
        stderr: "NOTICE: unexpected",
      },
    ]) {
      expect(() => assertAuthenticatedOwnerDdlCanaryDropResult(result)).toThrow(
        /owner-DDL canary drop/i,
      );
    }
  });

  it("uses a bounded administrator-side drain for owner-DDL backends", () => {
    const drainSql = renderOwnerDdlAuthBackendDrainSql();
    expect(drainSql).toContain("FROM pg_catalog.pg_stat_activity");
    expect(drainSql).toContain(`usename = '${OWNER_DDL_AUTH_LOGIN_ROLE}'`);
    expect(drainSql).toContain("backend_type = 'client backend'");
    expect(drainSql).toContain("interval '5 seconds'");
    expect(drainSql).toContain("pg_catalog.pg_sleep(0.05)");
    expect(drainSql).toContain("USING ERRCODE = '55000'");
    expect(drainSql).toContain("END;\n$owner_ddl_auth_backend_drain$;");
  });

  it("renders the exact ephemeral migrator login and SET-only owner edge", () => {
    const password = "A".repeat(43);
    const sql = renderMigratorAuthProvisioningSql(password);
    expect(sql).toContain(`CREATE ROLE ${MIGRATOR_AUTH_LOGIN_ROLE}`);
    for (const attribute of [
      "LOGIN",
      "NOSUPERUSER",
      "NOCREATEDB",
      "NOCREATEROLE",
      "NOREPLICATION",
      "NOINHERIT",
      "NOBYPASSRLS",
      "CONNECTION LIMIT 1",
    ]) {
      expect(sql).toContain(attribute);
    }
    expect(sql).toContain(
      `GRANT ${MIGRATOR_AUTH_CAPABILITY_ROLE}\n  TO ${MIGRATOR_AUTH_LOGIN_ROLE}\n  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
    );
    const passwordPosition = sql.indexOf(`PASSWORD '${password}'`);
    expect(passwordPosition).toBeGreaterThan(-1);
    for (const suppression of [
      "SET LOCAL log_statement = 'none';",
      "SET LOCAL log_min_error_statement = 'panic';",
      "SET LOCAL log_duration = off;",
      "SET LOCAL log_min_duration_statement = -1;",
      "SET LOCAL log_min_duration_sample = -1;",
      "SET LOCAL log_statement_sample_rate = 0;",
      "SET LOCAL log_transaction_sample_rate = 0;",
      "SET LOCAL password_encryption = 'scram-sha-256';",
    ]) {
      expect(sql.indexOf(suppression)).toBeGreaterThan(-1);
      expect(sql.indexOf(suppression)).toBeLessThan(passwordPosition);
    }
    expect(sql.match(new RegExp(password, "g"))).toHaveLength(1);
    expect(MIGRATOR_AUTH_FORBIDDEN_SET_ROLES).toEqual([
      "research_cockpit_runtime",
      "research_cockpit_test_seed",
      "research_cockpit_backup",
      "postgres",
    ]);
    expect(MIGRATOR_AUTH_FORBIDDEN_SESSION_AUTHORIZATION_ROLES).toEqual([
      "research_cockpit_owner",
      "research_cockpit_runtime",
      "research_cockpit_test_seed",
      "research_cockpit_backup",
      "postgres",
    ]);
    const cleanup = renderMigratorAuthCleanupSql();
    expect(cleanup).toContain(
      `DROP ROLE IF EXISTS ${MIGRATOR_AUTH_LOGIN_ROLE};`,
    );
    expect(cleanup).not.toMatch(/DROP OWNED|REASSIGN OWNED/i);
    expect(() => renderMigratorAuthProvisioningSql(`${password}\n`)).toThrow(
      /32-byte base64url/i,
    );
  });

  it("keeps migrator SCRAM credentials fixed-path, random, and out of arguments", () => {
    const passwords = Array.from({ length: 8 }, () =>
      generateMigratorAuthPassword(),
    );
    expect(new Set(passwords).size).toBe(passwords.length);
    for (const password of passwords) {
      expect(password).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
    const password = passwords[0];
    if (!password) throw new Error("Missing generated migrator password");
    expect(renderMigratorAuthPassfile(password)).toBe(
      `127.0.0.1:5432:research_cockpit_acceptance_test:${MIGRATOR_AUTH_LOGIN_ROLE}:${password}\n`,
    );

    const correct = buildMigratorAuthPsqlInvocation(MIGRATOR_AUTH_PASSFILE);
    expect(correct.environment).toEqual({
      PGPASSFILE: MIGRATOR_AUTH_PASSFILE,
      PGSSLMODE: "disable",
      PGCONNECT_TIMEOUT: "5",
      PGREQUIREAUTH: "scram-sha-256",
    });
    expect(correct.command).toEqual(
      expect.arrayContaining([
        "--no-password",
        "--host=127.0.0.1",
        "--port=5432",
        `--username=${MIGRATOR_AUTH_LOGIN_ROLE}`,
        "--dbname=research_cockpit_acceptance_test",
      ]),
    );
    expect(JSON.stringify(correct)).not.toContain(password);

    const wrong = buildMigratorAuthPsqlInvocation(
      MIGRATOR_AUTH_WRONG_PASSFILE,
      { requireScram: false },
    );
    expect(wrong.command).toEqual(correct.command);
    expect(wrong.environment).not.toHaveProperty("PGREQUIREAUTH");
    expect(wrong.environment.PGPASSFILE).toBe(MIGRATOR_AUTH_WRONG_PASSFILE);
    expect(() =>
      assertMigratorWrongPasswordRejection({
        exitCode: 2,
        stdout: "",
        stderr: `psql: error: FATAL: password authentication failed for user "${MIGRATOR_AUTH_LOGIN_ROLE}"`,
      }),
    ).not.toThrow();
    for (const result of [
      { exitCode: 0, stdout: "", stderr: "" },
      {
        exitCode: 2,
        stdout: "unexpected",
        stderr: `FATAL: password authentication failed for user "${MIGRATOR_AUTH_LOGIN_ROLE}"`,
      },
      { exitCode: 2, stdout: "", stderr: "connection refused" },
    ]) {
      expect(() => assertMigratorWrongPasswordRejection(result)).toThrow(
        /wrong-password migrator authentication/i,
      );
    }

    const drain = renderMigratorAuthBackendDrainSql();
    expect(drain).toContain(`usename = '${MIGRATOR_AUTH_LOGIN_ROLE}'`);
    expect(drain).toContain("pg_catalog.pg_stat_clear_snapshot()");
    expect(drain).toContain("interval '5 seconds'");
    expect(drain).toContain("USING ERRCODE = '55000'");
    expect(drain).toContain("END;\n$migrator_auth_backend_drain$;");
  });

  it("renders the distinct two-client B11 deployer login and bounded cleanup", () => {
    const password = "A".repeat(43);
    const sql = renderMigrationDeployerAuthProvisioningSql(password);
    expect(MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE).toBe(
      "research_cockpit_migration_deployer_login",
    );
    expect(MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE).not.toBe(
      MIGRATOR_AUTH_LOGIN_ROLE,
    );
    expect(MIGRATION_DEPLOYER_AUTH_CAPABILITY_ROLE).toBe(
      MIGRATOR_AUTH_CAPABILITY_ROLE,
    );
    expect(sql).toContain(`CREATE ROLE ${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}`);
    for (const attribute of [
      "LOGIN",
      "NOSUPERUSER",
      "NOCREATEDB",
      "NOCREATEROLE",
      "NOREPLICATION",
      "NOINHERIT",
      "NOBYPASSRLS",
      "CONNECTION LIMIT 2",
    ]) {
      expect(sql).toContain(attribute);
    }
    expect(sql).not.toContain(`ALTER ROLE ${MIGRATOR_AUTH_LOGIN_ROLE}`);
    expect(sql).toContain(
      `GRANT ${MIGRATION_DEPLOYER_AUTH_CAPABILITY_ROLE}\n  TO ${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}\n  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
    );
    expect(sql.match(/\bGRANT\b/g)).toHaveLength(1);
    const passwordPosition = sql.indexOf(`PASSWORD '${password}'`);
    expect(passwordPosition).toBeGreaterThan(-1);
    for (const suppression of [
      "SET LOCAL log_statement = 'none';",
      "SET LOCAL log_min_error_statement = 'panic';",
      "SET LOCAL log_duration = off;",
      "SET LOCAL log_min_duration_statement = -1;",
      "SET LOCAL log_min_duration_sample = -1;",
      "SET LOCAL log_statement_sample_rate = 0;",
      "SET LOCAL log_transaction_sample_rate = 0;",
      "SET LOCAL password_encryption = 'scram-sha-256';",
    ]) {
      expect(sql.indexOf(suppression)).toBeGreaterThan(-1);
      expect(sql.indexOf(suppression)).toBeLessThan(passwordPosition);
    }
    expect(sql.match(new RegExp(password, "g"))).toHaveLength(1);
    expect(renderMigrationDeployerAuthCleanupSql()).toBe(
      `BEGIN;\nDROP ROLE IF EXISTS ${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE};\nCOMMIT;\n`,
    );
    expect(renderMigrationDeployerAuthCleanupSql()).not.toMatch(
      /DROP OWNED|REASSIGN OWNED/i,
    );
    expect(() =>
      renderMigrationDeployerAuthProvisioningSql(`${password}\n`),
    ).toThrow(/32-byte base64url/i);
    expect(() =>
      renderMigrationDeployerAuthProvisioningSql(`${"A".repeat(42)}B`),
    ).toThrow(/32-byte base64url/i);

    const passwords = Array.from({ length: 8 }, () =>
      generateMigrationDeployerAuthPassword(),
    );
    expect(new Set(passwords).size).toBe(passwords.length);
    for (const generated of passwords) {
      expect(generated).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }

    const drainSql = renderMigrationDeployerAuthBackendDrainSql();
    expect(drainSql).toContain("FROM pg_catalog.pg_stat_activity");
    expect(drainSql).toContain(
      `usename = '${MIGRATION_DEPLOYER_AUTH_LOGIN_ROLE}'`,
    );
    expect(drainSql).toContain("backend_type = 'client backend'");
    expect(drainSql).toContain("interval '5 seconds'");
    expect(drainSql).toContain("pg_catalog.pg_stat_clear_snapshot()");
    expect(drainSql).toContain("pg_catalog.pg_sleep(0.05)");
    expect(drainSql).toContain("USING ERRCODE = '55000'");
  });

  it("renders one fixed non-forced reset of the disposable B7 target", () => {
    const sql = renderB7AcceptanceTargetResetSql();
    expect(sql).toBe(`DROP DATABASE research_cockpit_acceptance_test;
DROP ROLE research_cockpit_backup;
DROP ROLE research_cockpit_runtime;
DROP ROLE research_cockpit_test_seed;
DROP ROLE research_cockpit_owner;
CREATE DATABASE research_cockpit_acceptance_test
  WITH OWNER postgres TEMPLATE template0;
`);
    expect(sql).not.toMatch(/\bFORCE\b|DROP OWNED|REASSIGN OWNED/i);
  });

  it("attempts every runtime-auth finalization target before returning failures", async () => {
    const attempted: string[] = [];
    const firstFailure = new Error("first failure");
    const thirdFailure = new Error("third failure");

    const failures = await collectRuntimeAuthOperationFailures([
      {
        label: "primary passfile",
        run: () => {
          attempted.push("primary passfile");
          return Promise.reject(firstFailure);
        },
      },
      {
        label: "wrong-password passfile",
        run: () => {
          attempted.push("wrong-password passfile");
          return Promise.resolve();
        },
      },
      {
        label: "login role",
        run: () => {
          attempted.push("login role");
          return Promise.reject(thirdFailure);
        },
      },
    ]);

    expect(attempted).toEqual([
      "primary passfile",
      "wrong-password passfile",
      "login role",
    ]);
    expect(failures).toEqual([
      { label: "primary passfile", error: firstFailure },
      { label: "login role", error: thirdFailure },
    ]);
  });

  it("uses a bounded administrator-side drain after every runtime-auth command", async () => {
    const drainSql = renderRuntimeAuthBackendDrainSql();
    expect(drainSql).toContain("FROM pg_catalog.pg_stat_activity");
    expect(drainSql).toContain(`usename = '${RUNTIME_AUTH_LOGIN_ROLE}'`);
    expect(drainSql).toContain("backend_type = 'client backend'");
    expect(drainSql).toContain("interval '5 seconds'");
    expect(drainSql).toContain("pg_catalog.pg_sleep(0.05)");
    expect(drainSql).toContain("USING ERRCODE = '55000'");
    expect(drainSql).toContain("END;\n$runtime_auth_backend_drain$;");
    expect(
      drainSql.indexOf("pg_catalog.pg_stat_clear_snapshot()"),
    ).toBeGreaterThan(-1);
    expect(
      drainSql.indexOf("pg_catalog.pg_stat_clear_snapshot()"),
    ).toBeLessThan(drainSql.indexOf("EXIT WHEN NOT EXISTS"));

    const successOrder: string[] = [];
    await expect(
      runRuntimeAuthCommandWithDrain(
        () => {
          successOrder.push("command");
          return Promise.resolve("result");
        },
        () => {
          successOrder.push("drain");
          return Promise.resolve();
        },
      ),
    ).resolves.toBe("result");
    expect(successOrder).toEqual(["command", "drain"]);

    const commandFailure = new Error("command failure");
    const failureOrder: string[] = [];
    await expect(
      runRuntimeAuthCommandWithDrain(
        () => {
          failureOrder.push("command");
          return Promise.reject(commandFailure);
        },
        () => {
          failureOrder.push("drain");
          return Promise.resolve();
        },
      ),
    ).rejects.toBe(commandFailure);
    expect(failureOrder).toEqual(["command", "drain"]);
  });

  it("renders one shared context query behind explicit impersonated and authenticated role boundaries", () => {
    const statement = "SELECT count(*) FROM private_data.organizations;";
    const arguments_ = [
      "20000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000001",
      "display",
      "api",
      statement,
    ] as const;
    const impersonated = renderRuntimeContextSql("impersonated", ...arguments_);
    const authenticated = renderRuntimeContextSql(
      "authenticated",
      ...arguments_,
    );

    expect(impersonated).toMatch(
      /^SET SESSION AUTHORIZATION research_cockpit_runtime;\nBEGIN;\nCALL /,
    );
    expect(impersonated).toMatch(/\nCOMMIT;\nRESET SESSION AUTHORIZATION;$/);
    expect(impersonated).not.toContain("SET LOCAL ROLE");

    expect(authenticated).toMatch(
      /^BEGIN;\nSET LOCAL ROLE research_cockpit_runtime;\nCALL /,
    );
    expect(authenticated).toMatch(/\nCOMMIT;$/);
    expect(authenticated).not.toMatch(/SESSION AUTHORIZATION|RESET ROLE/);

    for (const sharedSql of [
      "CALL private_data.set_request_context(",
      `'${arguments_[0]}'`,
      `'${arguments_[1]}'`,
      "'display'",
      "'api'",
      "'demo_only'",
      "'synthetic'",
      statement,
    ]) {
      expect(impersonated).toContain(sharedSql);
      expect(authenticated).toContain(sharedSql);
    }
  });

  it.each([
    ["display_api", "display", "api"],
    ["derive_api", "derive", "api"],
    ["alert_local_alert", "alert", "local_alert"],
  ] as const)(
    "renders the authenticated %s projection on one prepared transaction",
    (operation, purpose, channel) => {
      const sql = renderRuntimeAuthenticatedFinancialFactProjectionSql(
        {
          scope: {
            instrumentId: "listing-syn1",
            publicKnownAt: "2025-01-01T00:00:01.000Z",
            systemRecordedAt: "2025-01-01T00:00:02.000Z",
          },
          operation,
          context: {
            territory: "demo_only",
            evaluatedAt: "2026-08-17T12:00:00.000Z",
          },
        },
        "20000000-0000-4000-8000-000000000001",
        "10000000-0000-4000-8000-000000000001",
      );

      expect(sql).toMatch(
        /^BEGIN;\nSET LOCAL ROLE research_cockpit_runtime;\nCALL /,
      );
      expect(sql).toContain(`'${purpose}',\n  '${channel}'`);
      expect(sql).toContain(
        "'b4-projection-identity|',\n  session_user, '|', current_user, '|', system_user",
      );
      expect(sql).toContain(
        "PREPARE b4_financial_fact_projection (\n  text, timestamptz, timestamptz\n) AS",
      );
      expect(sql).toContain("listing.id = $1::text");
      expect(sql).toContain("fact.known_from <= $2::timestamptz");
      expect(sql).toContain("fact.system_from <= $3::timestamptz");
      expect(sql).toContain(
        "EXECUTE b4_financial_fact_projection(\n  'listing-syn1',\n  '2025-01-01T00:00:01.000Z',\n  '2025-01-01T00:00:02.000Z'\n);",
      );
      expect(sql).toMatch(/DEALLOCATE b4_financial_fact_projection;\nCOMMIT;$/);
      expect(sql).not.toMatch(/SESSION AUTHORIZATION|RESET ROLE/);

      const contextPosition = sql.indexOf(
        "CALL private_data.set_request_context(",
      );
      const identityPosition = sql.indexOf("b4-projection-identity|");
      const preparePosition = sql.indexOf(
        "PREPARE b4_financial_fact_projection",
      );
      const executePosition = sql.indexOf(
        "EXECUTE b4_financial_fact_projection",
      );
      const deallocatePosition = sql.indexOf(
        "DEALLOCATE b4_financial_fact_projection",
      );
      expect(identityPosition).toBeGreaterThan(contextPosition);
      expect(preparePosition).toBeGreaterThan(identityPosition);
      expect(executePosition).toBeGreaterThan(preparePosition);
      expect(deallocatePosition).toBeGreaterThan(executePosition);
    },
  );

  it("keeps the authenticated alternating prepared matrix on one locally scoped backend script", () => {
    const authenticated =
      renderAlternatingPreparedStatementSql("authenticated");
    const impersonated = renderAlternatingPreparedStatementSql("impersonated");
    const count = (source: string, pattern: RegExp) =>
      source.match(pattern)?.length ?? 0;

    expect(count(authenticated, /PREPARE tenant_visibility AS/g)).toBe(1);
    expect(count(authenticated, /EXECUTE tenant_visibility;/g)).toBe(4);
    expect(count(authenticated, /DEALLOCATE tenant_visibility;/g)).toBe(1);
    expect(
      count(authenticated, /SET LOCAL ROLE research_cockpit_runtime;/g),
    ).toBe(5);
    expect(count(authenticated, /^BEGIN;$/gm)).toBe(5);
    expect(count(authenticated, /^COMMIT;$/gm)).toBe(5);
    expect(authenticated).not.toMatch(/SESSION AUTHORIZATION|RESET ROLE/);
    expect(authenticated.indexOf("SET LOCAL ROLE")).toBeLessThan(
      authenticated.indexOf("PREPARE tenant_visibility AS"),
    );

    const contexts = [
      ...authenticated.matchAll(
        /CALL private_data\.set_request_context\(\n {2}'([^']+)', '([^']+)'/g,
      ),
    ].map((match) => [match[1], match[2]]);
    expect(contexts).toEqual([
      [
        "20000000-0000-4000-8000-000000000001",
        "10000000-0000-4000-8000-000000000001",
      ],
      [
        "20000000-0000-4000-8000-000000000002",
        "10000000-0000-4000-8000-000000000002",
      ],
      [
        "20000000-0000-4000-8000-000000000001",
        "10000000-0000-4000-8000-000000000001",
      ],
      [
        "20000000-0000-4000-8000-000000000002",
        "10000000-0000-4000-8000-000000000002",
      ],
    ]);

    expect(count(impersonated, /PREPARE tenant_visibility AS/g)).toBe(1);
    expect(count(impersonated, /EXECUTE tenant_visibility;/g)).toBe(4);
    expect(impersonated).toMatch(
      /^SET SESSION AUTHORIZATION research_cockpit_runtime;/,
    );
    expect(impersonated).toMatch(/RESET SESSION AUTHORIZATION;$/);
    expect(impersonated).not.toContain("SET LOCAL ROLE");
  });

  it("accepts the reviewed immutable workflow and synthetic fixture", async () => {
    await expect(checkPostgresAcceptanceHarness()).resolves.toEqual([]);
    const artifacts = await loadArtifacts();
    expect(artifacts.config).toMatchObject({
      workflowSha256:
        "5f8ab0336cfb9fc35363f5b69d5db4564eaa79c7dd7fc16eecb266aa902e844f",
      fixtureSha256:
        "0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7",
      queryPlanLoadFixtureSha256:
        "e344c31adeb4cef3d7de2fad65bd4837a0c51c57f3b359a634eb42da9d0642ad",
      privacyRetentionFixtureSha256:
        "9be0682dffbb981350bde888b2880b99e2bfa587da96acdfae281c41be67a6c7",
      populatedCutoverFixtureSha256:
        "f30651fd5b847a6d1b365830c32335c98ff8106f49200dc40b4f33494a583198",
    });
    expect(artifacts.workflow).toContain(
      "name: postgres-acceptance-evidence-v14-${{ github.sha }}-${{ github.run_attempt }}",
    );
    expect(artifacts.workflow).toContain(
      "path: ${{ runner.temp }}/research-cockpit-postgres-acceptance-v14.json",
    );
    expect(artifacts.workflow).toContain('          - "127.0.0.1::5432"');
    expect(artifacts.workflow).toContain("      - modules/research-core/**");
    expect(artifacts.workflow).toContain(
      "RESEARCH_COCKPIT_PG_ADAPTER_HOST: 127.0.0.1",
    );
    expect(artifacts.workflow).toContain(
      "RESEARCH_COCKPIT_PG_ADAPTER_PORT: ${{ job.services.postgres.ports[5432] }}",
    );
    expect(artifacts.workflow).toContain(
      '--health-cmd "pg_isready --username=postgres --dbname=postgres"',
    );
    expect(artifacts.workflow).not.toContain(
      '--health-cmd "pg_isready --username=postgres --dbname=research_cockpit_acceptance_test"',
    );
  });

  it("rejects image drift and mutable service tags", async () => {
    const artifacts = await loadArtifacts();
    const driftedConfig = structuredClone(artifacts.config) as Record<
      string,
      unknown
    >;
    driftedConfig.indexDigest = `sha256:${"0".repeat(64)}`;
    expect(
      inspectPostgresAcceptanceHarness({
        ...artifacts,
        config: driftedConfig,
      }),
    ).toContain("PostgreSQL image config does not match the reviewed pin");

    const mutableWorkflow = artifacts.workflow.replace(
      /image: docker\.io\/library\/postgres:[^\r\n]+/,
      "image: postgres:latest",
    );
    const violations = inspectPostgresAcceptanceHarness({
      ...artifacts,
      workflow: mutableWorkflow,
    });
    expect(violations).toContain(
      "workflow must not use a mutable PostgreSQL tag",
    );
    expect(violations).toContain(
      "workflow image must match the immutable declaration",
    );
  });

  it("rejects widened port, URL, host, and container plumbing", async () => {
    const artifacts = await loadArtifacts();
    const workflow = artifacts.workflow
      .replace(
        '          - "127.0.0.1::5432"',
        '          - "127.0.0.1::5432"\n          - "5433:5432"',
      )
      .replace(
        "RESEARCH_COCKPIT_PG_ADAPTER_HOST: 127.0.0.1",
        "RESEARCH_COCKPIT_PG_ADAPTER_HOST: localhost\n          DATABASE_URL: postgres://localhost/demo",
      )
      .replace(
        "RESEARCH_COCKPIT_PG_CONTAINER_ID: ${{ job.services.postgres.id }}",
        "RESEARCH_COCKPIT_PG_CONTAINER_ID: forged",
      );
    const violations = inspectPostgresAcceptanceHarness({
      ...artifacts,
      workflow,
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        "PostgreSQL service must publish only one random loopback mapping for target 5432",
        "workflow must not construct a database URL",
        "workflow must use only exact IPv4 loopback",
        "workflow must pass the GitHub service container ID",
        "acceptance step must receive the exact service container ID",
        "acceptance step must receive only the exact loopback adapter host",
      ]),
    );
  });

  it("rejects alternate adapter host and port plumbing anywhere in the workflow", async () => {
    const artifacts = await loadArtifacts();
    for (const [source, replacement, expected] of [
      [
        '          - "127.0.0.1::5432"',
        '          - "127.0.0.1::5432"\n        expose:\n          - 5432',
        "PostgreSQL service must not declare an alternate expose block",
      ],
      [
        '          - "127.0.0.1::5432"',
        '          - "127.0.0.1::5432"\n        ports:\n          - "127.0.0.1::5433"',
        "PostgreSQL service must declare exactly one B9 adapter port block",
      ],
      [
        "          POSTGRES_USER: postgres",
        "          POSTGRES_USER: postgres\n          ALTERNATE_DB_HOST: database.example.invalid",
        "workflow must not declare an alternate host, port, or URL environment variable",
      ],
      [
        "          --health-retries 10",
        "          --health-retries 10\n          --publish 15432:5432",
        "workflow must not declare alternate Docker host or port plumbing",
      ],
      [
        "RESEARCH_COCKPIT_PG_ADAPTER_HOST: 127.0.0.1",
        "RESEARCH_COCKPIT_PG_ADAPTER_HOST: 192.0.2.1",
        "workflow must contain only the two reviewed IPv4 loopback host literals",
      ],
    ] as const) {
      const workflow = artifacts.workflow.replace(source, replacement);
      expect(
        inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
      ).toContain(expected);
    }
  });

  it("requires explicit SCRAM host authentication in the service", async () => {
    const artifacts = await loadArtifacts();
    for (const [source, replacement, expected] of [
      [
        "POSTGRES_HOST_AUTH_METHOD: scram-sha-256",
        "POSTGRES_HOST_AUTH_METHOD: trust",
        "acceptance service must require SCRAM for host authentication",
      ],
      [
        "POSTGRES_INITDB_ARGS: --auth-host=scram-sha-256",
        "POSTGRES_INITDB_ARGS: --auth-host=trust",
        "acceptance service must initialize loopback host rules with SCRAM",
      ],
    ] as const) {
      const workflow = artifacts.workflow.replace(source, replacement);
      expect(
        inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
      ).toContain(expected);
    }
  });

  it("requires every workspace input that can alter the live job to trigger it", async () => {
    const artifacts = await loadArtifacts();
    for (const triggerPath of [
      "modules/research-core/**",
      "tsconfig.base.json",
    ]) {
      const workflow = artifacts.workflow.replaceAll(
        `      - ${triggerPath}\n`,
        "",
      );
      expect(
        inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
      ).toContain(`workflow must rerun when ${triggerPath} changes`);
    }
  });

  it("requires the immutable upload-artifact action pin", async () => {
    const artifacts = await loadArtifacts();
    for (const mutableAction of [
      "actions/upload-artifact@v7",
      "actions/upload-artifact@main",
      "actions/upload-artifact@7.0.1",
      "actions/upload-artifact",
    ]) {
      const workflow = artifacts.workflow.replace(
        /actions\/upload-artifact@[0-9a-f]{40}/,
        mutableAction,
      );
      expect(
        inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
      ).toContain("evidence upload action must use the reviewed immutable SHA");
    }
  });

  it("uploads evidence only after successful acceptance", async () => {
    const artifacts = await loadArtifacts();
    for (const unsafeCondition of [
      "${{ always() }}",
      "${{ failure() }}",
      "${{ !cancelled() }}",
    ]) {
      const workflow = artifacts.workflow.replace(
        "if: ${{ success() }}",
        `if: ${unsafeCondition}`,
      );
      expect(
        inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
      ).toContain("evidence upload must run only after successful acceptance");
    }
  });

  it("requires the exact evidence file rather than a wildcard or alternate path", async () => {
    const artifacts = await loadArtifacts();
    for (const unsafePath of [
      "${{ runner.temp }}/research-cockpit-postgres-acceptance-*.json",
      "./research-cockpit-postgres-acceptance-v4.json",
    ]) {
      const workflow = artifacts.workflow.replace(
        "${{ runner.temp }}/research-cockpit-postgres-acceptance-v14.json",
        unsafePath,
      );
      expect(
        inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
      ).toContain(
        "evidence upload path must be the exact runner-temporary evidence file",
      );
    }
  });

  it("fails closed when evidence is absent or upload fails", async () => {
    const artifacts = await loadArtifacts();
    for (const missingFileBehavior of ["warn", "ignore"]) {
      const workflow = artifacts.workflow.replace(
        "if-no-files-found: error",
        `if-no-files-found: ${missingFileBehavior}`,
      );
      expect(
        inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
      ).toContain(
        "evidence upload must fail when the evidence file is missing",
      );
    }

    for (const continueOnError of ["true", "false"]) {
      const workflow = artifacts.workflow.replace(
        "        if: ${{ success() }}",
        "        if: ${{ success() }}\n        continue-on-error: " +
          continueOnError,
      );
      expect(
        inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
      ).toContain("evidence upload must not continue on error");
    }
  });

  it("binds the evidence artifact name to the commit and run attempt", async () => {
    const artifacts = await loadArtifacts();
    const workflow = artifacts.workflow.replace(
      "postgres-acceptance-evidence-v14-${{ github.sha }}-${{ github.run_attempt }}",
      "postgres-acceptance-evidence-latest",
    );
    expect(
      inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
    ).toContain(
      "evidence artifact name must include the commit SHA and run attempt",
    );
  });

  it("rejects decoy markers and unused workflow changes by reviewed hash", async () => {
    const artifacts = await loadArtifacts();
    const pinnedLine = artifacts.workflow.match(
      /^\s*image: docker\.io\/library\/postgres:[^\r\n]+/m,
    )?.[0];
    if (!pinnedLine) throw new Error("Pinned workflow image line is missing");
    const workflow = artifacts.workflow.replace(
      pinnedLine,
      `${pinnedLine.replace(/@sha256:[0-9a-f]{64}/, "")}\n        # ${pinnedLine.trim()}`,
    );
    expect(
      inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
    ).toContain("workflow differs from its reviewed SHA-256");
  });

  it("rejects fixture mutation commands and live rows before their registry", async () => {
    const artifacts = await loadArtifacts();
    const mutatedFixture = artifacts.fixture.replace(
      "INSERT INTO private_data.resource_id_registry",
      "UPDATE private_data.organizations SET name = name;\n\nINSERT INTO private_data.resource_id_registry",
    );
    expect(
      inspectPostgresAcceptanceHarness({
        ...artifacts,
        fixture: mutatedFixture,
      }),
    ).toContain("synthetic fixture must remain insert-only");

    const registry = artifacts.fixture.indexOf(
      "INSERT INTO private_data.resource_id_registry",
    );
    const thesis = artifacts.fixture.indexOf("INSERT INTO private_data.theses");
    const reorderedFixture =
      artifacts.fixture.slice(0, registry) +
      artifacts.fixture.slice(thesis) +
      artifacts.fixture.slice(registry, thesis);
    expect(
      inspectPostgresAcceptanceHarness({
        ...artifacts,
        fixture: reorderedFixture,
      }),
    ).toContain("resource registry rows must precede theses");

    expect(
      inspectPostgresAcceptanceHarness({
        ...artifacts,
        fixture: `${artifacts.fixture}\n\\gexec\n`,
      }),
    ).toEqual(
      expect.arrayContaining([
        "synthetic fixture differs from its reviewed SHA-256",
        "synthetic fixture must not contain psql meta-commands",
      ]),
    );
  });

  it("rejects query-plan/load fixture drift and contract widening", async () => {
    const artifacts = await loadArtifacts();
    const mutatedFixture = artifacts.queryPlanLoadFixture.replace(
      "generate_series(1, 2048)",
      "generate_series(1, 2049)",
    );
    expect(
      inspectPostgresAcceptanceHarness({
        ...artifacts,
        queryPlanLoadFixture: mutatedFixture,
      }),
    ).toEqual(
      expect.arrayContaining([
        "query-plan/load fixture differs from its reviewed SHA-256",
        "query-plan/load fixture contract is invalid",
      ]),
    );
  });

  it("stores both synthetic financial facts in the closed USD-millions pair", async () => {
    const { fixture } = await loadArtifacts();
    const factInsertStart = fixture.indexOf(
      "INSERT INTO shared_data.financial_facts (",
    );
    const factInsertEnd = fixture.indexOf(
      "INSERT INTO shared_data.metric_definitions (",
      factInsertStart,
    );
    expect(factInsertStart).toBeGreaterThan(-1);
    expect(factInsertEnd).toBeGreaterThan(factInsertStart);
    const financialFacts = fixture.slice(factInsertStart, factInsertEnd);

    expect(financialFacts.match(/'USD_MILLIONS',\r?\n\s*'USD'/g)).toHaveLength(
      2,
    );
    expect(financialFacts).not.toMatch(/\n\s*'USD',\r?\n\s*'USD',/);
    for (const factId of ["fact-full-v1", "fact-display-only"]) {
      const factStart = financialFacts.indexOf(`'${factId}'`);
      const nextTuple = financialFacts.indexOf("\n  ),", factStart);
      const factTuple = financialFacts.slice(
        factStart,
        nextTuple === -1 ? financialFacts.length : nextTuple,
      );
      expect(factStart).toBeGreaterThan(-1);
      expect(factTuple).toContain("'USD_MILLIONS',\n    'USD'");
    }
  });

  it("cannot run outside the isolated GitHub Actions boundary", async () => {
    await expect(runPostgresAcceptance({})).rejects.toThrow(
      /restricted to the isolated GitHub Actions job/i,
    );
    await expect(
      runPostgresAcceptance({ CI: "true", GITHUB_ACTIONS: "true" }),
    ).rejects.toThrow(/container ID is required/i);
    await expect(
      runPostgresAcceptance({
        CI: "true",
        GITHUB_ACTIONS: "true",
        RESEARCH_COCKPIT_PG_CONTAINER_ID: "a".repeat(12),
        RESEARCH_COCKPIT_PG_ADAPTER_HOST: "127.0.0.1",
        RESEARCH_COCKPIT_PG_ADAPTER_PORT: "49152",
        GITHUB_SHA: "not-a-canonical-commit",
      }),
    ).rejects.toThrow(/canonical GitHub checkout commit is required/i);
  });

  it("writes success evidence only after the final implemented probe", () => {
    const source = runPostgresAcceptance.toString();
    const impersonatedProbe = source.indexOf("await verifyWriteDenials");
    const runtimeProbe = source.indexOf(
      "await verifyAuthenticatedRuntimeSession",
    );
    const b7Probe = source.indexOf(
      "await verifyVersionedAuthenticatedMigrationPlan",
    );
    const b11Probe = source.indexOf(
      "await verifyAuthenticatedPostgresMigrationDeployment",
    );
    const poolProbe = source.indexOf(
      "await verifyAuthenticatedPostgresProjectionPool",
    );
    const finalProbe = source.indexOf(
      "await verifyAuthenticatedBackupAndBoundedRestore",
    );
    const buildEvidence = source.indexOf("buildPostgresAcceptanceEvidence");
    const writeEvidence = source.indexOf("writePostgresAcceptanceEvidence");
    const evidenceHash = source.indexOf("writtenEvidence.sha256");
    const successMessage = source.indexOf("process.stdout.write");
    expect(impersonatedProbe).toBeGreaterThan(-1);
    expect(runtimeProbe).toBeGreaterThan(impersonatedProbe);
    expect(b7Probe).toBeGreaterThan(runtimeProbe);
    expect(b11Probe).toBeGreaterThan(b7Probe);
    expect(poolProbe).toBeGreaterThan(b11Probe);
    expect(finalProbe).toBeGreaterThan(poolProbe);
    expect(buildEvidence).toBeGreaterThan(finalProbe);
    expect(writeEvidence).toBeGreaterThan(buildEvidence);
    expect(successMessage).toBeGreaterThan(writeEvidence);
    expect(evidenceHash).toBeGreaterThan(successMessage);
    expect(source).not.toContain("writtenEvidence.path");
    expect(source).toContain("authenticated test-loader");
    expect(source).toContain("driverless financial-fact projection");
    expect(source).toContain(
      "single-client read-only financial-fact projection adapter",
    );
    expect(source).toContain(
      "bounded two-client pool lifecycle/concurrency/cancellation/timeout recovery",
    );
    expect(source).toContain("version 14 success-only run record");
  });

  it("finishes mandatory B8 cleanup and hashes its exact sources before v13 evidence", async () => {
    const source = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    const section = (start: string, end: string) => {
      const startIndex = source.indexOf(start);
      const endIndex = source.indexOf(end, startIndex + start.length);
      expect(startIndex, start).toBeGreaterThan(-1);
      expect(endIndex, end).toBeGreaterThan(startIndex);
      return source.slice(startIndex, endIndex);
    };

    const orchestrator = section(
      "export async function runPostgresAcceptance(",
      "async function verifyVersionedAuthenticatedMigrationPlan(",
    );
    const b7 = orchestrator.indexOf(
      "await verifyVersionedAuthenticatedMigrationPlan(",
    );
    const b8 = orchestrator.indexOf(
      "await verifyAuthenticatedBackupAndBoundedRestore(",
    );
    const finalCheckout = orchestrator.indexOf(
      "await verifyCheckedOutCommit(environment);",
      b8,
    );
    const sourceHashes = orchestrator.indexOf(
      "await collectAcceptanceSourceHashes(config);",
    );
    const buildEvidence = orchestrator.indexOf(
      "buildPostgresAcceptanceEvidence",
    );
    const writeEvidence = orchestrator.indexOf(
      "writePostgresAcceptanceEvidence",
    );
    expect(b7).toBeGreaterThan(-1);
    expect(b8).toBeGreaterThan(b7);
    expect(finalCheckout).toBeGreaterThan(b8);
    expect(sourceHashes).toBeGreaterThan(finalCheckout);
    expect(buildEvidence).toBeGreaterThan(sourceHashes);
    expect(writeEvidence).toBeGreaterThan(buildEvidence);

    const b8Probe = section(
      "async function verifyAuthenticatedBackupAndBoundedRestore(",
      "async function createBoundedRestoreTarget(",
    );
    const initialResidue = b8Probe.indexOf(
      "await verifyAuthenticatedBackupRestoreResidueAbsent(containerId);",
    );
    const cleanupBoundary = b8Probe.indexOf("} finally {");
    const cleanup = b8Probe.indexOf(
      "cleanupAuthenticatedBackupRestoreFilesAndRoles(containerId)",
      cleanupBoundary,
    );
    const dropTarget = b8Probe.indexOf(
      "dropBoundedRestoreTargetIfPresent(containerId)",
      cleanup,
    );
    const finalResidue = b8Probe.indexOf(
      "verifyAuthenticatedBackupRestoreResidueAbsent(containerId)",
      dropTarget,
    );
    const combinedFailure = b8Probe.indexOf(
      "if (probeFailed && cleanupFailed)",
      finalResidue,
    );
    const probeFailure = b8Probe.indexOf(
      "if (probeFailed) throw probeError;",
      combinedFailure,
    );
    const cleanupFailure = b8Probe.indexOf(
      "if (cleanupFailed) throw cleanupError;",
      probeFailure,
    );
    expect(initialResidue).toBeGreaterThan(-1);
    expect(cleanupBoundary).toBeGreaterThan(initialResidue);
    expect(cleanup).toBeGreaterThan(cleanupBoundary);
    expect(dropTarget).toBeGreaterThan(cleanup);
    expect(finalResidue).toBeGreaterThan(dropTarget);
    expect(combinedFailure).toBeGreaterThan(finalResidue);
    expect(probeFailure).toBeGreaterThan(combinedFailure);
    expect(cleanupFailure).toBeGreaterThan(probeFailure);
    expect(b8Probe).not.toContain("buildPostgresAcceptanceEvidence");
    expect(b8Probe).not.toContain("writePostgresAcceptanceEvidence");

    const pathDeclarations = section(
      "const restorePlatformV1Path = join(",
      "const EXPECTED_IMAGE_REFERENCE",
    );
    expect(pathDeclarations).toContain(`const restorePlatformV1Path = join(
  packageRoot,
  "backup-restore-plans",
  "v1",
  "restore-platform.sql",
);`);
    expect(pathDeclarations)
      .toContain(`const authenticatedBackupRestorePlanV1Path = join(
  packageRoot,
  "src",
  "authenticated-backup-restore-plan.ts",
);`);

    const hashCollector = section(
      "async function collectAcceptanceSourceHashes(",
      "async function exactFileSha256(",
    );
    const tupleRenderer = hashCollector.indexOf(
      "authenticatedMigrationRendererV2Sha256,",
    );
    const tupleRestore = hashCollector.indexOf(
      "restorePlatformV1Sha256,",
      tupleRenderer + 1,
    );
    const tuplePlan = hashCollector.indexOf(
      "authenticatedBackupRestorePlanV1Sha256,",
      tupleRestore + 1,
    );
    const rendererPath = hashCollector.indexOf(
      "exactFileSha256(authenticatedMigrationRendererV2Path)",
    );
    const restorePath = hashCollector.indexOf(
      "exactFileSha256(restorePlatformV1Path)",
      rendererPath + 1,
    );
    const planPath = hashCollector.indexOf(
      "exactFileSha256(authenticatedBackupRestorePlanV1Path)",
      restorePath + 1,
    );
    const returned = hashCollector.indexOf("return Object.freeze({");
    const returnedRestore = hashCollector.indexOf(
      "restorePlatformV1Sha256,",
      returned,
    );
    const returnedPlan = hashCollector.indexOf(
      "authenticatedBackupRestorePlanV1Sha256,",
      returnedRestore + 1,
    );
    expect(tupleRenderer).toBeGreaterThan(-1);
    expect(tupleRestore).toBeGreaterThan(tupleRenderer);
    expect(tuplePlan).toBeGreaterThan(tupleRestore);
    expect(rendererPath).toBeGreaterThan(tuplePlan);
    expect(restorePath).toBeGreaterThan(rendererPath);
    expect(planPath).toBeGreaterThan(restorePath);
    expect(returned).toBeGreaterThan(planPath);
    expect(returnedRestore).toBeGreaterThan(returned);
    expect(returnedPlan).toBeGreaterThan(returnedRestore);
  });

  it("loads the reviewed fixture only through the bounded authenticated test-loader boundary", async () => {
    const source = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    const section = (start: string, end: string) => {
      const startIndex = source.indexOf(start);
      const endIndex = source.indexOf(end, startIndex + start.length);
      expect(startIndex).toBeGreaterThan(-1);
      expect(endIndex).toBeGreaterThan(startIndex);
      return source.slice(startIndex, endIndex);
    };

    const orchestrator = section(
      "export async function runPostgresAcceptance(",
      "async function verifyCheckedOutCommit(",
    );
    const loader = orchestrator.indexOf(
      "await verifyAuthenticatedTestLoaderSession(",
    );
    expect(loader).toBeGreaterThan(
      orchestrator.lastIndexOf("await verifyMigrationLedger", loader),
    );
    expect(orchestrator.indexOf("await verifyCatalogContract")).toBeGreaterThan(
      loader,
    );
    expect(
      orchestrator.indexOf("await verifyAuthenticatedRuntimeSession"),
    ).toBeGreaterThan(loader);
    expect(orchestrator).not.toMatch(
      /await psql\([^;]+readFile\(syntheticFixturePath/,
    );

    const loaderProbe = section(
      "async function verifyAuthenticatedTestLoaderSession(",
      "async function provisionTestLoaderAuthLogin(",
    );
    const orderedCalls = [
      "await verifyTestLoaderAuthResidueAbsent(containerId);",
      "await provisionTestLoaderAuthLogin(containerId, password);",
      "await verifyTestLoaderAuthRoleCatalog(containerId);",
      "await verifyTestLoaderWrongPasswordRejection(containerId);",
      "await verifyTestLoaderLoginBeforeSetRole(containerId);",
      "await verifyTestLoaderRoleEscalationDenials(containerId);",
      "await verifyFixtureTablesEmpty(containerId);",
      "await verifyAuthenticatedTestLoaderRollback(",
      "await verifyAuthenticatedTestLoaderFixtureLoad(containerId, fixtureSql);",
      "await verifyAuthenticatedTestLoaderDenials(",
      "} finally {",
      "run: () => cleanupTestLoaderAuthProbe(containerId)",
      "run: () => verifyTestLoaderAuthResidueAbsent(containerId)",
    ];
    let previous = -1;
    for (const call of orderedCalls) {
      const position = loaderProbe.indexOf(call);
      expect(position, call).toBeGreaterThan(previous);
      previous = position;
    }

    const preRole = section(
      "async function verifyTestLoaderLoginBeforeSetRole(",
      "async function verifyTestLoaderRoleEscalationDenials(",
    );
    for (const marker of [
      "session_user",
      "current_user",
      "system_user",
      "inet_client_addr",
      "inet_server_addr",
      "pg_stat_ssl",
      "'MEMBER'",
      "'USAGE'",
      "'SET'",
      "test-loader login data access before SET ROLE",
      "test-loader login insert before SET ROLE",
      "test-loader login context routine before SET ROLE",
      "test-loader login temporary table before SET ROLE",
    ]) {
      expect(preRole).toContain(marker);
    }

    const denials = section(
      "async function verifyAuthenticatedTestLoaderDenials(",
      "function renderTestLoaderCapabilitySql(",
    );
    for (const marker of [
      "test-loader non-synthetic insert",
      "authenticated test-loader update",
      "authenticated test-loader delete",
      "authenticated test-loader truncate",
      "authenticated test-loader ledger read",
      "authenticated test-loader ledger write",
      "authenticated test-loader persistent DDL",
      "authenticated test-loader temporary DDL",
      "await verifyMigrationLedger(containerId, expectedLedger)",
    ]) {
      expect(denials).toContain(marker);
    }

    const cleanup = section(
      "async function cleanupTestLoaderAuthProbe(",
      "async function verifyTestLoaderAuthResidueAbsent(",
    );
    expect(cleanup.indexOf("drain test-loader-auth backends")).toBeLessThan(
      cleanup.indexOf("remove test-loader-auth passfile"),
    );
    expect(cleanup.indexOf("remove test-loader-auth passfile")).toBeLessThan(
      cleanup.indexOf("drop ephemeral test-loader login"),
    );

    const authenticatedPsql = section(
      "async function testLoaderAuthenticatedPsql(",
      "async function waitForTestLoaderAuthBackendDrain(",
    );
    expect(authenticatedPsql).toContain("dockerExecWithEnvironment(");
    expect(authenticatedPsql).toContain("runRuntimeAuthCommandWithDrain(");
    expect(authenticatedPsql).not.toContain("await psqlScalar(");
  });

  it("runs the authenticated owner-DDL canary through one bounded cleanup boundary", async () => {
    const source = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    const section = (start: string, end: string) => {
      const startIndex = source.indexOf(start);
      const endIndex = source.indexOf(end, startIndex + start.length);
      expect(startIndex).toBeGreaterThan(-1);
      expect(endIndex).toBeGreaterThan(startIndex);
      return source.slice(startIndex, endIndex);
    };

    const orchestrator = section(
      "export async function runPostgresAcceptance(",
      "async function verifyCheckedOutCommit(",
    );
    const loader = orchestrator.indexOf(
      "await verifyAuthenticatedTestLoaderSession(",
    );
    const ownerDdl = orchestrator.indexOf(
      "await verifyAuthenticatedOwnerDdlCanarySession(containerId);",
    );
    const catalog = orchestrator.indexOf("await verifyCatalogContract");
    const evidence = orchestrator.indexOf("buildPostgresAcceptanceEvidence");
    expect(ownerDdl).toBeGreaterThan(loader);
    expect(catalog).toBeGreaterThan(ownerDdl);
    expect(evidence).toBeGreaterThan(catalog);

    const probe = section(
      "async function verifyAuthenticatedOwnerDdlCanarySession(",
      "async function provisionOwnerDdlAuthLogin(",
    );
    const orderedMarkers = [
      "await verifyOwnerDdlAuthResidueAbsent(containerId, expectedLedger);",
      "await provisionOwnerDdlAuthLogin(containerId, password);",
      "await verifyOwnerDdlAuthRoleCatalog(containerId);",
      "OWNER_DDL_AUTH_PASSFILE,",
      "OWNER_DDL_AUTH_WRONG_PASSFILE,",
      "await verifyOwnerDdlWrongPasswordRejection(containerId);",
      "await verifyOwnerDdlLoginBeforeSetRole(containerId);",
      "await verifyOwnerDdlRoleEscalationDenials(containerId);",
      "await verifyMigrationLedger(containerId, expectedLedger);",
      "await verifyAuthenticatedOwnerDdlRollback(containerId, expectedLedger);",
      "await verifyAuthenticatedOwnerDdlCreate(containerId);",
      "await verifyOwnerDdlCanaryPresent(containerId);",
      "await verifyMigrationLedger(containerId, expectedLedger);",
      "await verifyAuthenticatedOwnerDdlDrop(containerId);",
      "await verifyOwnerDdlCanaryAbsent(containerId);",
      "await verifyMigrationLedger(containerId, expectedLedger);",
      "} finally {",
      "run: () => cleanupOwnerDdlAuthProbe(containerId)",
      "verifyOwnerDdlAuthResidueAbsent(containerId, expectedLedger)",
    ];
    let previous = -1;
    for (const marker of orderedMarkers) {
      const position = probe.indexOf(marker, previous + 1);
      expect(position, marker).toBeGreaterThan(previous);
      previous = position;
    }

    const preRole = section(
      "async function verifyOwnerDdlLoginBeforeSetRole(",
      "async function verifyOwnerDdlRoleEscalationDenials(",
    );
    for (const marker of [
      "session_user",
      "current_user",
      "system_user",
      "inet_client_addr",
      "inet_server_addr",
      "pg_stat_ssl",
      "'MEMBER'",
      "'USAGE'",
      "'SET'",
      "owner-DDL login data access before SET ROLE",
      "owner-DDL login ledger read before SET ROLE",
      "owner-DDL login context routine before SET ROLE",
      "CALL private_data.set_request_context(",
      "owner-DDL login persistent DDL before SET ROLE",
      "owner-DDL login public DDL before SET ROLE",
      "owner-DDL login temporary DDL before SET ROLE",
      'sqlState: "42501"',
    ]) {
      expect(preRole).toContain(marker);
    }

    for (const [start, end] of [
      [
        "async function verifyAuthenticatedOwnerDdlRollback(",
        "async function verifyAuthenticatedOwnerDdlCreate(",
      ],
      [
        "async function verifyAuthenticatedOwnerDdlCreate(",
        "async function verifyAuthenticatedOwnerDdlDrop(",
      ],
      [
        "async function verifyAuthenticatedOwnerDdlDrop(",
        "async function verifyOwnerDdlCanaryPresent(",
      ],
    ] as const) {
      const authenticatedOperation = section(start, end);
      expect(authenticatedOperation).toContain("ownerDdlAuthenticatedPsql(");
      expect(authenticatedOperation).not.toContain("await psql(");
      expect(authenticatedOperation).not.toContain("await psqlScalar(");
    }

    const cleanup = section(
      "async function cleanupOwnerDdlAuthProbe(",
      "async function verifyOwnerDdlAuthResidueAbsent(",
    );
    const drain = cleanup.indexOf("drain owner-DDL-auth backends");
    const passfiles = cleanup.indexOf("remove owner-DDL-auth passfile");
    const canary = cleanup.indexOf("drop owner-DDL canary residue");
    const login = cleanup.indexOf("drop ephemeral owner-DDL login");
    expect(passfiles).toBeGreaterThan(drain);
    expect(canary).toBeGreaterThan(passfiles);
    expect(login).toBeGreaterThan(canary);

    const residue = section(
      "async function verifyOwnerDdlAuthResidueAbsent(",
      "async function ownerDdlAuthenticatedPsqlScalar(",
    );
    for (const marker of [
      "ephemeral owner-DDL login residue",
      "ephemeral owner-DDL membership residue",
      "ephemeral owner-DDL backend residue",
      "verify owner-DDL canary is absent",
      "verify owner-DDL-auth passfile is absent",
      "verify owner-DDL-auth passfile symlink is absent",
      "verify migration ledger after owner-DDL cleanup",
    ]) {
      expect(residue).toContain(marker);
    }
  });

  it("runs the versioned platform and authenticated application phases before current evidence", async () => {
    const source = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    const section = (start: string, end: string) => {
      const startIndex = source.indexOf(start);
      const endIndex = source.indexOf(end, startIndex + start.length);
      expect(startIndex, start).toBeGreaterThan(-1);
      expect(endIndex, end).toBeGreaterThan(startIndex);
      return source.slice(startIndex, endIndex);
    };

    const b7 = section(
      "async function verifyVersionedAuthenticatedMigrationPlan(",
      "async function verifyAuthenticatedApplicationMigrationSession(",
    );
    const b7Order = [
      "await verifyCatalogContract(containerId);",
      "await resetAcceptanceTargetForAuthenticatedMigrations(containerId);",
      'label: "injected B7 platform-bootstrap rollback"',
      "await verifyB7PristineTarget(containerId);",
      "renderAuthenticatedPlatformMigration(plan),",
      "await verifyAuthenticatedMigrationPlatformState(containerId);",
      'label: "B7 platform-bootstrap replay"',
      "await verifyAuthenticatedApplicationMigrationSession(",
      "await verifyMigrationLedger(containerId, expectedLedger);",
      "await verifyB7PlatformArtifactsAfterApplication(containerId);",
      "await verifyAuthenticatedTestLoaderSession(",
      "await verifyAuthenticatedOwnerDdlCanarySession(containerId, expectedLedger);",
      "await verifyAuthenticatedRuntimeSession(containerId, adapterEndpoint);",
      "await verifyMigrationLedger(containerId, expectedLedger);",
      "await verifyB7PlatformArtifactsAfterApplication(containerId);",
    ];
    let previous = -1;
    for (const marker of b7Order) {
      const position = b7.indexOf(marker, previous + 1);
      expect(position, marker).toBeGreaterThan(previous);
      previous = position;
    }

    const authenticated = section(
      "async function verifyAuthenticatedApplicationMigrationSession(",
      "async function verifyAuthenticatedMigrationLedger(",
    );
    const authenticatedOrder = [
      "await verifyMigratorAuthResidueAbsent(containerId);",
      "await provisionMigratorAuthLogin(containerId, password);",
      "await verifyMigratorAuthRoleCatalog(containerId);",
      "MIGRATOR_AUTH_PASSFILE,",
      "MIGRATOR_AUTH_WRONG_PASSFILE,",
      "await verifyMigratorWrongPasswordRejection(containerId, databaseName);",
      "await verifyMigratorLoginBeforeSetRole(containerId, databaseName);",
      "await verifyMigratorRoleEscalationDenials(containerId, databaseName);",
      "await verifyAuthenticatedMigrationPlatformState(",
      "renderAuthenticatedApplicationMigration(plan, true, databaseName),",
      'label: "injected authenticated application-migration rollback"',
      "await verifyAuthenticatedMigrationPlatformState(",
      "renderAuthenticatedApplicationMigration(plan, false, databaseName),",
      "await verifyAuthenticatedMigrationLedger(",
      "await verifyMigratorOwnsNoObjects(containerId, databaseName);",
      'label: "authenticated application-migration replay"',
      "await verifyAuthenticatedMigrationLedger(",
      "await verifyMigratorOwnsNoObjects(containerId, databaseName);",
      "run: () => cleanupMigratorAuthProbe(containerId)",
      "run: () => verifyMigratorAuthResidueAbsent(containerId)",
    ];
    previous = -1;
    for (const marker of authenticatedOrder) {
      const position = authenticated.indexOf(marker, previous + 1);
      expect(position, marker).toBeGreaterThan(previous);
      previous = position;
    }

    const preRole = section(
      "async function verifyMigratorLoginBeforeSetRole(",
      "async function verifyMigratorRoleEscalationDenials(",
    );
    for (const marker of [
      "session_user",
      "current_user",
      "system_user",
      "inet_client_addr",
      "inet_server_addr",
      "pg_stat_ssl",
      "migrator persistent DDL before SET ROLE",
      "migrator public DDL before SET ROLE",
      "migrator schema DDL before SET ROLE",
      "CREATE SCHEMA b7_migrator_schema_escape",
      "migrator trusted extension DDL before SET ROLE",
      "CREATE EXTENSION hstore WITH SCHEMA shared_data",
      "migrator temporary DDL before SET ROLE",
    ]) {
      expect(preRole).toContain(marker);
    }

    const reset = section(
      "async function resetAcceptanceTargetForAuthenticatedMigrations(",
      "async function verifyB7PristineTarget(",
    );
    expect(reset).toContain("FROM pg_catalog.pg_stat_activity");
    expect(reset).not.toContain("backend_type = 'client backend'");

    const platformState = section(
      "async function verifyAuthenticatedMigrationPlatformState(",
      "export function injectBootstrapFailure(",
    );
    expect(platformState).toContain(`SELECT count(*)
FROM pg_catalog.pg_default_acl AS defaults
JOIN pg_catalog.pg_roles AS role ON role.oid = defaults.defaclrole
WHERE role.rolname = 'research_cockpit_owner';`);

    const cleanup = section(
      "async function cleanupMigratorAuthProbe(",
      "async function verifyMigratorAuthResidueAbsent(",
    );
    expect(cleanup.indexOf("drain migrator-auth backends")).toBeLessThan(
      cleanup.indexOf("remove migrator-auth passfile"),
    );
    expect(cleanup.indexOf("remove migrator-auth passfile")).toBeLessThan(
      cleanup.indexOf("drop ephemeral migrator login"),
    );
    expect(cleanup).not.toMatch(/DROP OWNED|REASSIGN OWNED/i);

    const finalPlatform = section(
      "async function verifyB7PlatformArtifactsAfterApplication(",
      "async function verifyCheckedOutCommit(",
    );
    expect(finalPlatform).toContain("FROM pg_catalog.pg_default_acl");
    expect(finalPlatform).toContain("defaults.defaclnamespace = 0");
    expect(finalPlatform).toContain("defaults.defaclobjtype = 'f'");
    expect(finalPlatform).toContain("privilege.grantee = 0");
    expect(finalPlatform).toContain('"1|0"');
  });

  it("runs B11 rollback, replay, checksum-drift refusal, and concurrent deployment with mandatory cleanup", async () => {
    const source = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    const section = (start: string, end: string) => {
      const startIndex = source.indexOf(start);
      const endIndex = source.indexOf(end, startIndex + start.length);
      expect(startIndex, start).toBeGreaterThan(-1);
      expect(endIndex, end).toBeGreaterThan(startIndex);
      return source.slice(startIndex, endIndex);
    };
    const expectOrdered = (body: string, markers: readonly string[]) => {
      let previous = -1;
      for (const marker of markers) {
        const position = body.indexOf(marker, previous + 1);
        expect(position, marker).toBeGreaterThan(previous);
        previous = position;
      }
    };

    const entrypoint = section(
      "export async function runPostgresAcceptance(",
      "async function verifyVersionedAuthenticatedMigrationPlan(",
    );
    expectOrdered(entrypoint, [
      "await verifyVersionedAuthenticatedMigrationPlan(",
      "await verifyAuthenticatedPostgresMigrationDeployment(",
      "await verifyAuthenticatedPostgresProjectionPool(",
      "await verifyAuthenticatedBackupAndBoundedRestore(",
      "await verifyCheckedOutCommit(environment);",
      "const sourceHashes = await collectAcceptanceSourceHashes(config);",
      "const evidence = buildPostgresAcceptanceEvidence({",
      "const writtenEvidence = await writePostgresAcceptanceEvidence(",
      "the version 14 success-only run record was written",
    ]);
    expect(
      entrypoint.match(
        /await verifyAuthenticatedPostgresMigrationDeployment\(/g,
      ),
    ).toHaveLength(1);

    const orchestrator = section(
      "async function verifyAuthenticatedPostgresMigrationDeployment(",
      "async function provisionMigrationDeployerAuthLogin(",
    );
    expectOrdered(orchestrator, [
      "await verifyMigrationDeployerAuthResidueAbsent(containerId);",
      "await provisionMigrationDeployerAuthLogin(containerId, password);",
      "await verifyMigrationDeployerAuthRoleCatalog(containerId);",
      "clientA = registerClient(",
      "await clientA.connect();",
      "renderAuthenticatedMigrationV2PrefixFiveReconstruction(plan),",
      "deployerA.deploy({ injectFailure: true })",
      '"POSTGRES_MIGRATION_DEPLOYMENT_FAILURE"',
      '"B11 injected deployment rollback target fingerprint"',
      'assertMigrationDeploymentResult(await deployerA.deploy(), "applied");',
      "const replayResult = await deployerA.deploy();",
      'assertMigrationDeploymentResult(replayResult, "current");',
      "await verifyMigrationDeployerLiveChecksumDrift(",
      "clientB = registerClient(",
      "await clientB.connect();",
      "await verifyMigrationDeployerConnectionLimit(endpoint, password);",
      "renderAuthenticatedMigrationV2PrefixFiveReconstruction(plan),",
      "barrierClient = registerClient(",
      "await beginMigrationDeployerLedgerBarrier(barrierClient);",
      "const deploymentA = deployerA.deploy();",
      "await waitForMigrationDeployerBlockingChain(barrierClient, {",
      "const deploymentB = deployerB.deploy();",
      "await waitForMigrationDeployerBlockingChain(barrierClient, {",
      "await releaseMigrationDeployerLedgerBarrier(barrierClient);",
      "const concurrentResults =",
      "await settleMigrationDeployments(pendingDeployments);",
      "assertConcurrentMigrationDeploymentResults(concurrentResults);",
      "assertMigrationDeployerTargetCurrent(",
      "} finally {",
      'label: "release B11 ledger barrier"',
      'label: "settle B11 migration deployments"',
      'label: "close B11 PostgreSQL client"',
      'label: "repair B11 acceptance target"',
      'label: "drain B11 migration deployer backends"',
      'label: "drop B11 migration deployer login"',
      'label: "verify B11 migration deployer residue"',
      'label: "verify B11 final ledger and catalog"',
      "await collectRuntimeAuthOperationFailures(cleanupFailures)",
      "if (probeError !== undefined && cleanupError !== undefined)",
      "throw new AggregateError(",
    ]);
    for (const marker of [
      "const clients:",
      "const pendingDeployments:",
      "unexpectedClientErrors",
      "registered.removeErrorListener();",
      "await registered.client.end();",
      "targetModified",
    ]) {
      expect(orchestrator).toContain(marker);
    }

    const catalog = section(
      "async function verifyMigrationDeployerAuthRoleCatalog(",
      "function createPostgresMigrationDeployerClient(",
    );
    expect(catalog).toContain(
      "|true|false|false|false|false|false|false|2|true`",
    );
    expect(catalog).toContain("|false|false|true`");
    expect(catalog).toContain("FROM pg_catalog.pg_db_role_setting");
    expect(catalog).toContain("SELECT count(*) FROM direct_acl");
    expect(catalog).toContain('"0|0"');

    const targetState = section(
      "async function collectMigrationDeployerTargetState(",
      "function assertMigrationDeployerTargetPrefix(",
    );
    for (const marker of [
      "'oid', procedure.oid::bigint,",
      "pg_catalog.aclexplode(",
      "count(*) FILTER (WHERE privilege.grantee = 0)",
      "count(*) FILTER (WHERE privilege.grantee = procedure.proowner)",
      "privilege.privilege_type <> 'EXECUTE'",
      "privilege.grantor <> procedure.proowner",
      "privilege.is_grantable",
    ]) {
      expect(targetState).toContain(marker);
    }
    const procedureAssertion = section(
      "function assertMigrationDeployerProcedureState(",
      "function extractMigrationDeployerProcedureSource(",
    );
    expect(procedureAssertion).toContain(
      'actual.accessControlFingerprint !== "2|0|1|1|0|0"',
    );
    expect(source).not.toMatch(/accessControl(?:List)?\.includes\s*\(/);

    const drift = section(
      "async function verifyMigrationDeployerLiveChecksumDrift(",
      "function assertMigrationDeployerTargetCurrentWithDrift(",
    );
    expectOrdered(drift, [
      "await setMigrationDeployerLedgerChecksum(",
      "const drifted = await collectMigrationDeployerTargetState(containerId);",
      "const driftError = await captureMigrationDeploymentError(deployer.deploy());",
      '"POSTGRES_MIGRATION_LEDGER_DRIFT"',
      '"B11 checksum-drift refusal target fingerprint"',
      "} finally {",
      "await setMigrationDeployerLedgerChecksum(",
      '"B11 checksum-drift repair target fingerprint"',
    ]);
    expect(source).toContain(
      'const POSTGRES_MIGRATION_DEPLOYER_DRIFT_SHA256 = "0".repeat(64);',
    );
    const checksumMutation = section(
      "async function setMigrationDeployerLedgerChecksum(",
      "async function beginMigrationDeployerLedgerBarrier(",
    );
    expectOrdered(checksumMutation, [
      "BEGIN;",
      "pg_catalog.pg_advisory_xact_lock(${AUTHENTICATED_MIGRATION_ADVISORY_LOCK_KEY}::bigint)",
      "SET LOCAL ROLE ${MIGRATION_DEPLOYER_AUTH_CAPABILITY_ROLE};",
      "LOCK TABLE ONLY shared_data.schema_migrations IN SHARE ROW EXCLUSIVE MODE;",
      "UPDATE shared_data.schema_migrations",
      "AND file_name = '${fileName}'",
      "AND sha256 = '${expectedSha256}'",
      "IF NOT FOUND THEN",
      "COMMIT;",
    ]);

    const barrier = section(
      "async function beginMigrationDeployerLedgerBarrier(",
      "async function releaseMigrationDeployerLedgerBarrier(",
    );
    expectOrdered(barrier, [
      'await client.query("BEGIN READ WRITE")',
      "SET LOCAL statement_timeout = '10s'; SET LOCAL lock_timeout = '5s'",
      "LOCK TABLE ONLY shared_data.schema_migrations IN ROW EXCLUSIVE MODE",
      "SELECT pg_catalog.pg_backend_pid() AS backend_pid",
    ]);
    const observer = section(
      "async function waitForMigrationDeployerBlockingChain(",
      "function delayMigrationDeployerPoll(",
    );
    for (const marker of [
      "pg_catalog.pg_stat_clear_snapshot()",
      "RowExclusiveLock",
      "ShareRowExclusiveLock",
      "held.locktype = 'advisory'",
      "activity.wait_event = 'advisory'",
      "pg_catalog.pg_blocking_pids($2::integer)",
      "pg_catalog.pg_blocking_pids($5::integer)",
      "result.rows[0]?.valid === true",
      "valid && now <= deadline",
    ]) {
      expect(observer).toContain(marker);
    }
    for (const b14OnlyMarker of [
      "POPULATED_CUTOVER_ADVISORY_LOCK_KEY",
      "classid::bigint",
      "objid::bigint",
      "$4::bigint",
    ]) {
      expect(observer).not.toContain(b14OnlyMarker);
    }

    const concurrencyResult = section(
      "function assertConcurrentMigrationDeploymentResults(",
      "async function repairMigrationDeployerTarget(",
    );
    expect(concurrencyResult).toContain(
      'JSON.stringify(["applied", "current"])',
    );
    expect(concurrencyResult).toContain(
      "assertMigrationDeploymentResult(result, result.status)",
    );

    const repair = section(
      "async function repairMigrationDeployerTarget(",
      "function isMigrationDeployerCanonicalCurrent(",
    );
    expectOrdered(repair, [
      "const state = await collectMigrationDeployerTargetState(containerId);",
      "assertMigrationDeployerB7Baseline(state, plan);",
      "if (isMigrationDeployerCanonicalCurrent(state, plan)) return;",
      "assertMigrationDeployerRepairableState(state, plan);",
      "pg_catalog.pg_advisory_xact_lock(${AUTHENTICATED_MIGRATION_ADVISORY_LOCK_KEY}::bigint)",
      "LOCK TABLE ONLY shared_data.schema_migrations IN SHARE ROW EXCLUSIVE MODE;",
      "UPDATE shared_data.schema_migrations",
      "INSERT INTO shared_data.schema_migrations (",
      "ON CONFLICT (migration_id) DO UPDATE",
      "assertMigrationDeployerTargetCurrent(",
    ]);
    expect(repair).not.toMatch(/DROP OWNED|REASSIGN OWNED/i);
    const repairGuard = section(
      "function assertMigrationDeployerRepairableState(",
      "async function cleanupMigrationDeployerAuthProbe(",
    );
    expect(repairGuard).toContain(
      'throw new Error("B11 cleanup refuses unknown ledger drift")',
    );
    expect(repairGuard).toContain(
      'throw new Error("B11 cleanup refuses unknown procedure drift")',
    );

    const residue = section(
      "async function verifyMigrationDeployerAuthResidueAbsent(",
      "async function verifyMigrationDeployerFinalTarget(",
    );
    expect(residue).toContain("FROM pg_catalog.pg_auth_members");
    expect(residue).toContain("FROM pg_catalog.pg_stat_activity");
    expect(residue).toContain("application_name IN (");
    expect(residue).toContain('"0|0|0|0"');

    const finalTarget = section(
      "async function verifyMigrationDeployerFinalTarget(",
      "async function verifyAuthenticatedPostgresProjectionPool(",
    );
    for (const marker of [
      "await verifyMigrationLedger(",
      "await verifyCatalogContract(containerId);",
      "await verifyB7PlatformArtifactsAfterApplication(containerId);",
      "await verifyContextCleanup(containerId);",
    ]) {
      expect(finalTarget).toContain(marker);
    }

    const sourceHashes = section(
      "async function collectAcceptanceSourceHashes(",
      "async function exactFileSha256(",
    );
    expect(sourceHashes).toContain(
      "exactFileSha256(postgresMigrationDeployerPath)",
    );
    expect(sourceHashes).toContain("postgresMigrationDeployerSha256,");
  });

  it("runs the authenticated backup and bounded restore before v13 evidence", async () => {
    const source = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    const section = (start: string, end: string) => {
      const startIndex = source.indexOf(start);
      const endIndex = source.indexOf(end, startIndex + start.length);
      expect(startIndex, start).toBeGreaterThan(-1);
      expect(endIndex, end).toBeGreaterThan(startIndex);
      return source.slice(startIndex, endIndex);
    };
    const expectOrdered = (body: string, markers: readonly string[]) => {
      let previous = -1;
      for (const marker of markers) {
        const position = body.indexOf(marker, previous + 1);
        expect(position, marker).toBeGreaterThan(previous);
        previous = position;
      }
    };

    const entrypoint = section(
      "export async function runPostgresAcceptance(",
      "async function verifyVersionedAuthenticatedMigrationPlan(",
    );
    expectOrdered(entrypoint, [
      "await verifyVersionedAuthenticatedMigrationPlan(",
      "await verifyAuthenticatedPostgresMigrationDeployment(",
      "await verifyAuthenticatedPostgresProjectionPool(",
      "await verifyAuthenticatedBackupAndBoundedRestore(",
      "await verifyCheckedOutCommit(environment);",
      "const sourceHashes = await collectAcceptanceSourceHashes(config);",
      "const evidence = buildPostgresAcceptanceEvidence({",
      "const writtenEvidence = await writePostgresAcceptanceEvidence(",
      "the version 14 success-only run record was written",
    ]);

    const orchestrator = section(
      "async function verifyAuthenticatedBackupAndBoundedRestore(",
      "async function createBoundedRestoreTarget(",
    );
    expectOrdered(orchestrator, [
      "await verifyAuthenticatedBackupRestoreResidueAbsent(containerId);",
      "const sourceBefore = await collectAuthenticatedBackupFingerprints(",
      "await createAuthenticatedPolicyScopedBackup(containerId);",
      "const sourceAfterDump = await collectAuthenticatedBackupFingerprints(",
      "await createBoundedRestoreTarget(",
      "await verifyRestorableApplicationTablesEmpty(containerId);",
      "await restoreAuthenticatedPolicyScopedBackup(containerId, archiveSha256);",
      "const restored = await collectAuthenticatedBackupFingerprints(",
      "await verifyMigrationLedger(",
      "await verifyCatalogContract(containerId, AUTHENTICATED_RESTORE_DATABASE);",
      "await verifyB7PlatformArtifactsAfterApplication(",
      "await verifyBackupCapability(containerId, AUTHENTICATED_RESTORE_DATABASE);",
      "await verifyContextCleanup(containerId, AUTHENTICATED_RESTORE_DATABASE);",
      "await verifyRuntimeAuthorizationMatrix(",
      "await verifyWriteDenials(containerId, AUTHENTICATED_RESTORE_DATABASE);",
      "const sourceAfterRestore = await collectAuthenticatedBackupFingerprints(",
      "await authenticatedBackupArchiveSha256(containerId)",
      'label: "B8 ephemeral principals and files cleanup"',
      'label: "B8 bounded restore database cleanup"',
      'label: "B8 final residue verification"',
    ]);

    const backup = section(
      "async function createAuthenticatedPolicyScopedBackup(",
      "async function provisionAuthenticatedBackupLogin(",
    );
    expectOrdered(backup, [
      "await provisionAuthenticatedBackupLogin(containerId, password);",
      "await verifyAuthenticatedBackupLoginCatalog(containerId);",
      "AUTHENTICATED_BACKUP_PASSFILE,",
      "AUTHENTICATED_BACKUP_WRONG_PASSFILE,",
      "for (const archive of AUTHENTICATED_BACKUP_ARCHIVE_PATHS)",
      "await verifyAuthenticatedBackupWrongPassword(containerId);",
      "await verifyAuthenticatedBackupLoginBeforeSetRole(containerId);",
      "await verifyAuthenticatedBackupRoleEscalationDenials(containerId);",
      "await verifyAuthenticatedBackupCapabilitySession(containerId);",
      "await verifyAuthenticatedBackupFailClosedVariants(containerId);",
      "const invocation = buildAuthenticatedBackupDumpInvocation();",
      "await verifyAuthenticatedBackupArchiveFile(containerId);",
      '"pg_restore",',
      "const toc = parseAuthenticatedBackupArchiveToc(tocResult.stdout);",
      "archiveSha256 = await authenticatedBackupArchiveSha256(containerId);",
      'label: "authenticated backup backend drain"',
      'label: "drop authenticated backup login"',
      'label: "verify authenticated backup login residue"',
    ]);

    const backupCapability = section(
      "async function verifyAuthenticatedBackupCapabilitySession(",
      "async function verifyAuthenticatedBackupFailClosedVariants(",
    );
    for (const marker of [
      "authenticated backup synthetic visibility",
      "authenticated backup write",
      "authenticated backup update",
      "authenticated backup delete",
      "authenticated backup truncate",
      "authenticated backup context mutation",
      "authenticated backup persistent DDL",
      "authenticated backup temporary DDL",
      `SET LOCAL ROLE \${AUTHENTICATED_BACKUP_CAPABILITY_ROLE};`,
      'sqlState: "42501"',
    ]) {
      expect(backupCapability).toContain(marker);
    }

    const restore = section(
      "async function restoreAuthenticatedPolicyScopedBackup(",
      "async function provisionAuthenticatedRestoreLogin(",
    );
    expectOrdered(restore, [
      "await provisionAuthenticatedRestoreLogin(containerId, password);",
      "await verifyAuthenticatedRestoreLoginCatalog(containerId);",
      "AUTHENTICATED_RESTORE_PASSFILE,",
      "AUTHENTICATED_RESTORE_WRONG_PASSFILE,",
      "await verifyAuthenticatedRestoreWrongPassword(containerId);",
      "await verifyAuthenticatedRestoreLoginBeforeSetRole(containerId);",
      "await verifyAuthenticatedRestoreRoleEscalationDenials(containerId);",
      "await verifyAuthenticatedRestoreFailClosedVariants(",
      "renderAuthenticatedRestoreFailureCreateSql()",
      "const failedRestore = await runAuthenticatedRestoreCommand(containerId);",
      "await verifyRestorableApplicationTablesEmpty(containerId);",
      "renderAuthenticatedRestoreFailureCleanupSql()",
      "renderAuthenticatedRestoreFailureResidueSql()",
      "const restored = await runAuthenticatedRestoreCommand(containerId);",
      "const replay = await runAuthenticatedRestoreCommand(containerId);",
      'label: "authenticated restore backend drain"',
      'label: "drop authenticated restore login"',
      'label: "verify authenticated restore login residue"',
    ]);

    const finalCleanup = section(
      "async function cleanupAuthenticatedBackupRestoreFilesAndRoles(",
      "async function dropBoundedRestoreTargetIfPresent(",
    );
    expectOrdered(finalCleanup, [
      'label: "drain authenticated backup backends"',
      'label: "drain authenticated restore backends"',
      'label: "drain authenticated migrator backends"',
      "...AUTHENTICATED_BACKUP_RESTORE_FILE_PATHS.map",
      'label: "drop residual authenticated backup login"',
      'label: "drop residual authenticated restore login"',
      'label: "drop residual authenticated migrator login"',
    ]);
    expect(finalCleanup).not.toMatch(/DROP OWNED|REASSIGN OWNED/i);

    const dropTarget = section(
      "async function dropBoundedRestoreTargetIfPresent(",
      "async function waitForBoundedRestoreDatabaseDrain(",
    );
    expect(dropTarget).toContain("await waitForBoundedRestoreDatabaseDrain");
    expect(dropTarget).toContain("renderDropAuthenticatedRestoreDatabaseSql()");
    expect(dropTarget).not.toMatch(/\bFORCE\b/i);

    const residue = section(
      "async function verifyAuthenticatedBackupRestoreResidueAbsent(",
      "async function verifyAuthenticatedApplicationMigrationSession(",
    );
    for (const marker of [
      "B8 ephemeral role, edge, and backend residue",
      "B8 bounded restore database residue",
      "AUTHENTICATED_BACKUP_RESTORE_FILE_PATHS.map",
      "verify source catalog after B8 cleanup",
      "verify source platform artifacts after B8 cleanup",
    ]) {
      expect(residue).toContain(marker);
    }
  });

  it("reuses the exact authorization matrix inside the authenticated cleanup boundary", async () => {
    const source = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    const section = (start: string, end: string) => {
      const startIndex = source.indexOf(start);
      const endIndex = source.indexOf(end, startIndex + start.length);
      expect(startIndex).toBeGreaterThan(-1);
      expect(endIndex).toBeGreaterThan(startIndex);
      return source.slice(startIndex, endIndex);
    };

    const orchestrator = section(
      "export async function runPostgresAcceptance(",
      "async function verifyCheckedOutCommit(",
    );
    expect(orchestrator).toContain(
      'runtimeAuthorizationMatrixClient(\n    containerId,\n    "impersonated",\n  )',
    );
    expect(orchestrator).toContain(
      "await verifyRuntimeAuthorizationMatrix(impersonatedRuntimeMatrix);",
    );

    const sharedMatrix = section(
      "async function verifyRuntimeAuthorizationMatrix(",
      "async function verifyTenantIsolation(",
    );
    expect(sharedMatrix.match(/verifyTenantIsolation\(client\)/g)).toHaveLength(
      1,
    );
    expect(sharedMatrix.match(/verifyOperationRights\(client\)/g)).toHaveLength(
      1,
    );

    const authenticatedProbe = section(
      "async function verifyAuthenticatedRuntimeSession(",
      "async function verifyRuntimeAuthResidueAbsent(",
    );
    const boundedWrite = authenticatedProbe.indexOf(
      "await verifyRuntimeAuthenticatedWriteDenial(containerId);",
    );
    const fullMatrix = authenticatedProbe.indexOf(
      "await verifyRuntimeAuthorizationMatrix(",
    );
    const financialFactProjection = authenticatedProbe.indexOf(
      "await verifyRuntimeAuthenticatedFinancialFactProjection(containerId);",
    );
    const adapterWrongPassword = authenticatedProbe.indexOf(
      "await verifyPostgresProjectionAdapterWrongPasswordRejection(",
    );
    const adapterProjection = authenticatedProbe.indexOf(
      "await verifyPostgresProjectionAdapter(",
    );
    const cleanupBoundary = authenticatedProbe.indexOf("} finally {");
    expect(boundedWrite).toBeGreaterThan(-1);
    expect(fullMatrix).toBeGreaterThan(boundedWrite);
    expect(financialFactProjection).toBeGreaterThan(fullMatrix);
    expect(adapterWrongPassword).toBeGreaterThan(financialFactProjection);
    expect(adapterProjection).toBeGreaterThan(adapterWrongPassword);
    expect(cleanupBoundary).toBeGreaterThan(adapterProjection);
    expect(authenticatedProbe.slice(fullMatrix, cleanupBoundary)).toContain(
      'runtimeAuthorizationMatrixClient(containerId, "authenticated")',
    );

    const projectionProbe = section(
      "async function verifyRuntimeAuthenticatedFinancialFactProjection(",
      "async function verifyRuntimeAuthResidueAbsent(",
    );
    expect(projectionProbe).toContain("await runtimeAuthenticatedPsqlScalar(");
    expect(projectionProbe).not.toContain("await psqlScalar(");
    expect(projectionProbe).toContain(
      "renderRuntimeAuthenticatedFinancialFactProjectionSql(",
    );
    expect(projectionProbe).toContain(
      "parsePostgresFinancialFactProjectionRows(",
    );
    expect(projectionProbe).toContain(
      "normalizePostgresFinancialFactProjectionRows(query, rows)",
    );
    for (const marker of [
      'runtimeProjectionQuery("display_api")',
      'runtimeProjectionQuery("derive_api")',
      'runtimeProjectionQuery("alert_local_alert")',
      "POSTGRES_PROJECTION_MISSING_LISTING_ID",
      "POSTGRES_PROJECTION_PRE_PUBLIC_KNOWN_AT",
      "PRINCIPAL_INACTIVE",
      "PRINCIPAL_NO_MEMBERSHIP",
      "POSTGRES_PROJECTION_IDENTITY_MARKER",
    ]) {
      expect(projectionProbe).toContain(marker);
    }

    const sourceHashCollector = section(
      "async function collectAcceptanceSourceHashes(",
      "async function exactFileSha256(",
    );
    expect(sourceHashCollector).toContain(
      "exactFileSha256(projectionQueryPath)",
    );
    expect(sourceHashCollector).toContain(
      "exactFileSha256(projectionNormalizerPath)",
    );
    expect(sourceHashCollector).toContain("projectionQuerySha256,");
    expect(sourceHashCollector).toContain("projectionNormalizerSha256,");
    for (const [pathMarker, hashMarker] of [
      [
        "exactFileSha256(postgresProjectionAdapterPath)",
        "postgresProjectionAdapterSha256,",
      ],
      [
        "exactFileSha256(postgresProjectionPoolAdapterPath)",
        "postgresProjectionPoolSha256,",
      ],
      [
        "exactFileSha256(operationProjectionContractPath)",
        "operationProjectionContractSha256,",
      ],
      [
        "exactFileSha256(databasePackageManifestPath)",
        "databasePackageManifestSha256,",
      ],
      ["exactFileSha256(pnpmLockfilePath)", "pnpmLockfileSha256,"],
    ] as const) {
      expect(sourceHashCollector).toContain(pathMarker);
      expect(sourceHashCollector).toContain(hashMarker);
    }

    const matrixClient = section(
      "function runtimeAuthorizationMatrixClient(",
      "async function privateVisibility(",
    );
    expect(matrixClient).toContain(
      'mode === "authenticated"\n        ? runtimeAuthenticatedPsqlScalar(containerId, sql)\n        : psqlScalar(containerId, sql, databaseName)',
    );

    const tenantMatrix = section(
      "async function verifyTenantIsolation(",
      "async function verifyOperationRights(",
    );
    expect(tenantMatrix).toContain(
      "await client.scalar(renderAlternatingPreparedStatementSql(client.mode))",
    );
    expect(tenantMatrix.match(/privateVisibility\(/g)).toHaveLength(3);
    expect(tenantMatrix).toMatch(
      /foreignThesisJoin[\s\S]*JOIN private_data\.organizations/,
    );
    expect(tenantMatrix).toMatch(/foreignExists[\s\S]*EXISTS \(/);
    expect(tenantMatrix).toContain("foreignScalar");
    expect(tenantMatrix).toContain("sameThesisIdVisible");

    const rightsMatrix = section(
      "async function verifyOperationRights(",
      "async function verifyWriteDenials(",
    );
    for (const combination of [
      ['purpose: "display"', 'channel: "api"'],
      ['purpose: "derive"', 'channel: "api"'],
      ['purpose: "alert"', 'channel: "local_alert"'],
    ]) {
      expect(rightsMatrix).toContain(combination[0]);
      expect(rightsMatrix).toContain(combination[1]);
    }
  });

  it("runs the real single-client B9 adapter through the bounded runtime lifecycle", async () => {
    const source = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    const section = (start: string, end: string) => {
      const startIndex = source.indexOf(start);
      const endIndex = source.indexOf(end, startIndex + start.length);
      expect(startIndex, start).toBeGreaterThan(-1);
      expect(endIndex, end).toBeGreaterThan(startIndex);
      return source.slice(startIndex, endIndex);
    };

    const entrypoint = section(
      "export async function runPostgresAcceptance(",
      "async function verifyVersionedAuthenticatedMigrationPlan(",
    );
    expect(
      entrypoint.indexOf("parsePostgresProjectionAdapterEndpoint("),
    ).toBeLessThan(
      entrypoint.indexOf("await verifyCheckedOutCommit(environment)"),
    );
    expect(entrypoint).toContain(
      "await verifyAuthenticatedRuntimeSession(containerId, adapterEndpoint);",
    );
    expect(entrypoint).toContain("fixtureSql,\n    adapterEndpoint,\n  );");

    const runtime = section(
      "async function verifyAuthenticatedRuntimeSession(",
      "async function verifyRuntimeAuthenticatedFinancialFactProjection(",
    );
    const b4 = runtime.indexOf(
      "await verifyRuntimeAuthenticatedFinancialFactProjection(containerId);",
    );
    const wrongPassword = runtime.indexOf(
      "await verifyPostgresProjectionAdapterWrongPasswordRejection(",
    );
    const adapter = runtime.indexOf("await verifyPostgresProjectionAdapter(");
    const cleanup = runtime.indexOf("} finally {");
    expect(b4).toBeGreaterThan(-1);
    expect(wrongPassword).toBeGreaterThan(b4);
    expect(adapter).toBeGreaterThan(wrongPassword);
    expect(cleanup).toBeGreaterThan(adapter);

    const adapterProbe = section(
      "async function verifyPostgresProjectionAdapter(",
      "function createPostgresProjectionAdapterClient(",
    );
    for (const marker of [
      "await client.connect();",
      "new PostgresFinancialFactProjectionSource(",
      "runtimeProjectionAcceptanceCases()",
      "await verifyPostgresProjectionAdapterOuterTransactionReset(",
      'label: "B9 alpha sequential read"',
      'label: "B9 beta sequential read"',
      'label: "B9 alpha sequential reuse"',
      'label: "B9 cross-tenant actor mismatch"',
      "await assertPostgresProjectionAdapterClientIdle(client, backendPid);",
      "await verifyPostgresProjectionAdapterInjectedRollback(",
      "await client.end();",
      "await waitForRuntimeAuthBackendDrain(containerId);",
    ]) {
      expect(adapterProbe).toContain(marker);
    }
    expect(adapterProbe.indexOf("await client.end();")).toBeLessThan(
      adapterProbe.indexOf("await waitForRuntimeAuthBackendDrain(containerId)"),
    );
    expect(
      adapterProbe.indexOf(
        "await verifyPostgresProjectionAdapterOuterTransactionReset(",
      ),
    ).toBeLessThan(adapterProbe.indexOf("const sequentialCases:"));

    const clientConfig = section(
      "function createPostgresProjectionAdapterClient(",
      "async function assertPostgresProjectionAdapterClientIdle(",
    );
    for (const marker of [
      "host: endpoint.host",
      "port: endpoint.port",
      "database: CLEAN_BOOTSTRAP_DATABASE_NAME",
      "user: RUNTIME_AUTH_LOGIN_ROLE",
      "password,",
      "ssl: false",
      "application_name: POSTGRES_PROJECTION_ADAPTER_APPLICATION_NAME",
    ]) {
      expect(clientConfig).toContain(marker);
    }
    expect(clientConfig).not.toMatch(
      /process\.env|DATABASE_URL|connectionString|new Pool|\.connect\(|\.end\(/,
    );

    const outerTransactionReset = section(
      "async function verifyPostgresProjectionAdapterOuterTransactionReset(",
      "async function verifyPostgresProjectionAdapterReadOnlyBoundary(",
    );
    for (const marker of [
      'await client.query("BEGIN READ WRITE")',
      "outer-must-rollback",
      "WITH bounded_projection AS",
      "transaction_read_only') = 'on'",
      "adapterTransactionObserved = true",
      "= 'baseline'",
      'await client.query("RESET app.b9_outer_transaction_canary")',
    ]) {
      expect(outerTransactionReset).toContain(marker);
    }

    const readOnly = section(
      "async function verifyPostgresProjectionAdapterReadOnlyBoundary(",
      "async function verifyPostgresProjectionAdapterInjectedRollback(",
    );
    expect(readOnly).toContain('await client.query("BEGIN READ ONLY")');
    expect(readOnly).toContain(
      "SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE}",
    );
    expect(readOnly).toContain("CALL private_data.set_request_context(");
    expect(readOnly).toContain("transaction_read_only') = 'on'");
    expect(readOnly).toContain('postgresErrorCode(error) === "25006"');
    expect(readOnly).toContain('await client.query("ROLLBACK")');

    const injected = section(
      "async function verifyPostgresProjectionAdapterInjectedRollback(",
      "function postgresErrorCode(",
    );
    expect(injected).toContain("WITH bounded_projection AS");
    expect(injected).toContain("b9-injected-driver-secret-canary");
    expect(injected).toContain(
      "failure instanceof PostgresProjectionAdapterError",
    );
    expect(injected).toContain('Object.hasOwn(failure, "cause")');
    expect(injected.match(/await source\.load\(/g)).toHaveLength(2);

    const versions = section(
      "async function verifyToolVersions(",
      "async function verifyMigrationLedger(",
    );
    expect(versions).toContain("await readFile(nodePostgresPackagePath");
    expect(versions).toContain(
      "nodePostgresPackage.version !== EXPECTED_NODE_POSTGRES_VERSION",
    );
    expect(versions).toContain("nodePostgres: nodePostgresPackage.version");
  });

  it("runs B12 authenticated indexed plans and 2,000 bounded reads with zero residue", async () => {
    const source = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    const section = (start: string, end: string) => {
      const startIndex = source.indexOf(start);
      const endIndex = source.indexOf(end, startIndex + start.length);
      expect(startIndex, start).toBeGreaterThan(-1);
      expect(endIndex, end).toBeGreaterThan(startIndex);
      return source.slice(startIndex, endIndex);
    };
    const expectOrdered = (body: string, markers: readonly string[]) => {
      let previous = -1;
      for (const marker of markers) {
        const position = body.indexOf(marker, previous + 1);
        expect(position, marker).toBeGreaterThan(previous);
        previous = position;
      }
    };

    const entrypoint = section(
      "export async function runPostgresAcceptance(",
      "async function verifyVersionedAuthenticatedMigrationPlan(",
    );
    expectOrdered(entrypoint, [
      "await verifyVersionedAuthenticatedMigrationPlan(",
      "await verifyAuthenticatedPostgresMigrationDeployment(",
      "await verifyAuthenticatedPostgresQueryPlanLoad(",
      "await verifyAuthenticatedPostgresProjectionPool(",
      "await verifyAuthenticatedBackupAndBoundedRestore(",
      "await verifyCheckedOutCommit(environment);",
      "const sourceHashes = await collectAcceptanceSourceHashes(config);",
      "the version 14 success-only run record was written",
    ]);
    expect(
      entrypoint.match(/await verifyAuthenticatedPostgresQueryPlanLoad\(/g),
    ).toHaveLength(1);
    expect(entrypoint).toContain(
      "queryPlanLoadFixtureSql,\n    authenticatedMigrationPlan,",
    );

    const lifecycle = section(
      "async function verifyAuthenticatedPostgresQueryPlanLoad(",
      "interface PostgresQueryPlanLoadReadResult",
    );
    expectOrdered(lifecycle, [
      "await verifyPostgresQueryPlanLoadResidueAbsent(containerId);",
      "sourceBefore = await collectAuthenticatedBackupFingerprints(",
      "inspectPostgresQueryPlanLoadFixture(fixtureSql)",
      "await assertPostgresQueryPlanLoadSourceSessionsAbsent(containerId);",
      "cloneProvisioningStarted = true;",
      "await createPostgresQueryPlanLoadClone(containerId);",
      "seedLoginProvisioningStarted = true;",
      "await provisionPostgresQueryPlanLoadSeedLogin(containerId, seedPassword);",
      'verifyPostgresQueryPlanLoadRoleCatalog(containerId, "seed")',
      "await seedPostgresQueryPlanLoadClone(seedClient, fixtureSql);",
      "await analyzePostgresQueryPlanLoadClone(containerId);",
      "await verifyPostgresQueryPlanLoadFixtureState(containerId);",
      "loginProvisioningStarted = true;",
      "await provisionPostgresQueryPlanLoadLogin(containerId, password);",
      'verifyPostgresQueryPlanLoadRoleCatalog(containerId, "runtime")',
      "await verifyPostgresQueryPlanLoadPlans(adminClient, runtimePlanClient);",
      "await beginPostgresQueryPlanLoadBarrier(adminClient);",
      "pool = createPostgresQueryPlanLoadPool(endpoint, password);",
      "const requests = submitPostgresQueryPlanLoadRequests(pool);",
      "loadSettlement = Promise.allSettled(requests);",
      "await waitForPostgresQueryPlanLoadBlockedBackends(adminClient);",
      "await releasePostgresQueryPlanLoadBarrier(adminClient);",
      "const outcomes = await withPostgresQueryPlanLoadTimeout(",
      "assertPostgresQueryPlanLoadOutcomes(outcomes);",
      "} finally {",
      'label: "release B12 query-load barrier"',
      'label: "settle B12 submitted reads"',
      'label: "close B12 bounded PostgreSQL pool"',
      'label: "close B12 PostgreSQL client"',
      'label: "drain B12 PostgreSQL backends"',
      'label: "drop B12 disposable clone without FORCE"',
      'label: "drop B12 ephemeral runtime login"',
      'label: "drop B12 ephemeral seed login"',
      'label: "verify B12 source fingerprint"',
      'label: "verify B12 zero residue"',
      'label: "verify B12 final source catalog"',
      "await collectRuntimeAuthOperationFailures(cleanupOperations)",
      "if (probeError !== undefined && cleanupError !== undefined)",
      "throw new AggregateError(",
    ]);
    expect(lifecycle).toContain(
      "POSTGRES_QUERY_PLAN_LOAD_PROFILE.totalRequestCount",
    );
    expect(lifecycle).toContain("loadSettlementComplete = true;");
    expect(lifecycle).toContain(
      "expectedAuthenticatedMigrationLedgerRows(plan.manifest).map(",
    );
    expectOrdered(lifecycle, [
      "if (!loadSettlementComplete) throw new PostgresQueryPlanLoadError();",
      "await poolToClose.end();",
    ]);

    const clone = section(
      "async function assertPostgresQueryPlanLoadSourceSessionsAbsent(",
      "async function provisionPostgresQueryPlanLoadSeedLogin(",
    );
    expectOrdered(clone, [
      "FROM pg_catalog.pg_stat_activity",
      "AND backend_type = 'client backend';",
      "CREATE DATABASE ${POSTGRES_QUERY_PLAN_LOAD_PROFILE.databaseName}",
      "WITH TEMPLATE ${CLEAN_BOOTSTRAP_DATABASE_NAME}",
      "OWNER postgres;",
    ]);
    expect(clone).not.toContain("FORCE");

    const provisioning = section(
      "function renderPostgresQueryPlanLoadLoginProvisioningSql(",
      "async function verifyPostgresQueryPlanLoadRoleCatalog(",
    );
    for (const marker of [
      "NOSUPERUSER",
      "NOCREATEDB",
      "NOCREATEROLE",
      "NOREPLICATION",
      "NOINHERIT",
      "NOBYPASSRLS",
      "POSTGRES_QUERY_PLAN_LOAD_PROFILE.loginConnectionLimit",
      "WITH ADMIN FALSE, INHERIT FALSE, SET TRUE",
    ]) {
      expect(provisioning).toContain(marker);
    }
    expect(provisioning).toContain("assertPostgresQueryPlanLoadPassword");

    const seed = section(
      "async function seedPostgresQueryPlanLoadClone(",
      "async function analyzePostgresQueryPlanLoadClone(",
    );
    expect(seed).toContain(
      "renderPostgresQueryPlanLoadFixtureTransaction(fixtureSql)",
    );
    expect(seed).toContain("result.length !== 9");
    expect(seed.match(/"INSERT"/g)).toHaveLength(6);
    expect(seed).toContain("POSTGRES_QUERY_PLAN_LOAD_PROFILE.factCount");
    expect(seed).toContain("POSTGRES_QUERY_PLAN_LOAD_PROFILE.thesisCount");
    const finiteSeedAndAnalyze = section(
      "function createPostgresQueryPlanLoadSeedClient(",
      "async function verifyPostgresQueryPlanLoadFixtureState(",
    );
    expect(finiteSeedAndAnalyze).toContain(
      "statement_timeout:\n      POSTGRES_QUERY_PLAN_LOAD_PROFILE.statementTimeoutMilliseconds",
    );
    expect(finiteSeedAndAnalyze).toContain(
      "SET statement_timeout = '${POSTGRES_QUERY_PLAN_LOAD_PROFILE.statementTimeoutMilliseconds}ms';",
    );

    const plans = section(
      "async function verifyPostgresQueryPlanLoadPlans(",
      "async function setPostgresQueryPlanLoadRequestContext(",
    );
    expectOrdered(plans, [
      '["runtime_rls", runtimeClient]',
      '["superuser_bypass", adminClient]',
      'executePostgresQueryPlanLoadPlan(\n      client,\n      authorization,\n      "fact"',
      'assertPostgresQueryPlan("fact", authorization, factPlan)',
      'executePostgresQueryPlanLoadPlan(\n      client,\n      authorization,\n      "tenant"',
      'assertPostgresQueryPlan("tenant", authorization, tenantPlan)',
      "process.stdout.write(renderPostgresQueryPlanLoadMetrics(summaries));",
    ]);
    for (const marker of [
      "planning_ms=",
      "execution_ms=",
      "shared_hit_blocks=",
      "shared_read_blocks=",
      "BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY",
      "POSTGRES_QUERY_PLAN_LOAD_PLANNER_SETTINGS",
      "SET LOCAL ROLE ${POSTGRES_QUERY_PLAN_LOAD_PROFILE.runtimeCapabilityRole}",
      "renderPostgresFinancialFactExplainQuery()",
      "renderPostgresTenantThesisExplainQuery()",
      'result.command !== "EXPLAIN"',
      "result.rowCount !== null",
      'result.fields[0]?.name !== "QUERY PLAN"',
      "result.fields[0]?.dataTypeID !== 114",
    ]) {
      expect(plans).toContain(marker);
    }
    expect(plans).not.toContain("enable_seqscan");

    const submissions = section(
      "function submitPostgresQueryPlanLoadRequests(",
      "function assertPostgresQueryPlanLoadOutcomes(",
    );
    expectOrdered(submissions, [
      "index < POSTGRES_QUERY_PLAN_LOAD_PROFILE.factRequestCount",
      'index % 2 === 0 ? "alpha" : "beta"',
      "requests.push(runPostgresQueryPlanLoadFactRead(pool, actor));",
      "requests.push(runPostgresQueryPlanLoadTenantRead(pool, actor));",
      "POSTGRES_QUERY_PLAN_LOAD_PROFILE.tenantRequestCount",
      "POSTGRES_QUERY_PLAN_LOAD_PROFILE.totalRequestCount",
    ]);
    expect(submissions).toContain(
      "BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY",
    );
    expect(submissions).toContain(
      "SET LOCAL ROLE ${POSTGRES_QUERY_PLAN_LOAD_PROFILE.runtimeCapabilityRole}",
    );
    expect(submissions).toContain(
      "assertPostgresTenantThesisRows(actor, result.rows)",
    );
    expect(submissions).toContain(
      "assertRuntimeAuthenticatedFinancialFactProjectionResult(",
    );

    const barrier = section(
      "async function beginPostgresQueryPlanLoadBarrier(",
      "async function closePostgresQueryPlanLoadClient(",
    );
    expectOrdered(barrier, [
      "LOCK TABLE ONLY shared_data.financial_facts IN ACCESS EXCLUSIVE MODE",
      "LOCK TABLE ONLY private_data.theses IN ACCESS EXCLUSIVE MODE",
      "POSTGRES_QUERY_PLAN_LOAD_BLOCKED_DEADLINE_MILLISECONDS",
      "pg_catalog.pg_stat_clear_snapshot()",
      "pg_catalog.pg_blocking_pids(activity.pid)",
      "Date.now() < deadline &&",
      "isPostgresQueryPlanLoadBlockedObservation(",
      "backendPids.size === POSTGRES_QUERY_PLAN_LOAD_PROFILE.poolMax",
      "factCount === POSTGRES_QUERY_PLAN_LOAD_PROFILE.poolMax / 2",
      "tenantCount === POSTGRES_QUERY_PLAN_LOAD_PROFILE.poolMax / 2",
      'await client.query("ROLLBACK")',
    ]);
    expect(barrier).toContain(
      "row.blockingPids[0] !== value.barrierBackendPid",
    );

    const cleanup = section(
      "async function waitForPostgresQueryPlanLoadBackendDrain(",
      "function assertPostgresQueryPlanLoadPassword(",
    );
    expect(cleanup).toContain(
      "DROP DATABASE ${POSTGRES_QUERY_PLAN_LOAD_PROFILE.databaseName};",
    );
    expect(cleanup).not.toMatch(/DROP DATABASE[^;]*(?:FORCE|WITH\s*\()/i);
    expect(cleanup).toContain("DROP ROLE IF EXISTS");
    expect(cleanup).toContain('"0|0|0|0|0|0"');

    const sourceHashes = section(
      "async function collectAcceptanceSourceHashes(",
      "async function exactFileSha256(",
    );
    for (const marker of [
      "exactFileSha256(postgresQueryPlanLoadPath)",
      "exactFileSha256(queryPlanLoadFixturePath)",
      "queryPlanLoadFixtureSha256 !== config.queryPlanLoadFixtureSha256",
      "postgresQueryPlanLoadSha256,",
      "queryPlanLoadFixtureSha256,",
    ]) {
      expect(sourceHashes).toContain(marker);
    }
  });

  it("runs B13 keyed privacy retention in a bounded authenticated template0 lane", async () => {
    const source = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    const section = (start: string, end: string) => {
      const startIndex = source.indexOf(start);
      const endIndex = source.indexOf(end, startIndex + start.length);
      expect(startIndex, start).toBeGreaterThan(-1);
      expect(endIndex, end).toBeGreaterThan(startIndex);
      return source.slice(startIndex, endIndex);
    };
    const expectOrdered = (body: string, markers: readonly string[]) => {
      let previous = -1;
      for (const marker of markers) {
        const position = body.indexOf(marker, previous + 1);
        expect(position, marker).toBeGreaterThan(previous);
        previous = position;
      }
    };

    const entrypoint = section(
      "export async function runPostgresAcceptance(",
      "async function verifyVersionedAuthenticatedMigrationPlan(",
    );
    expectOrdered(entrypoint, [
      "const privacyRetentionPolicy = await loadPrivacyRetentionPolicyV1();",
      "assertPostgresPrivacyRetentionAcceptancePolicy(privacyRetentionPolicy);",
      "const privacyRetentionPlan = await loadPrivacyRetentionPlanV1();",
      "const populatedCutoverPlan = await loadPopulatedCutoverPlanV1();",
      "const privacyRetentionFixtureSql = await loadPrivacyRetentionFixture();",
      "const populatedCutoverFixtureSql = await loadPopulatedCutoverFixture();",
      "await verifyAuthenticatedPostgresQueryPlanLoad(",
      "const keyedPrivacyCatalogFingerprint =",
      "await verifyAuthenticatedPostgresPrivacyRetention(",
      "await verifyAuthenticatedPostgresPopulatedCutover(",
      "await verifyAuthenticatedPostgresProjectionPool(",
      "await verifyAuthenticatedBackupAndBoundedRestore(",
      "await verifyCheckedOutCommit(environment);",
      "const sourceHashes = await collectAcceptanceSourceHashes(config);",
      "the version 14 success-only run record was written",
    ]);
    expect(
      entrypoint.match(/await verifyAuthenticatedPostgresPrivacyRetention\(/g),
    ).toHaveLength(1);
    expect(entrypoint).toMatch(
      /privacyRetentionFixtureSql,\s+authenticatedMigrationPlan,\s+privacyRetentionPlan,/,
    );

    const lifecycle = section(
      "async function verifyAuthenticatedPostgresPrivacyRetention(",
      "async function verifyAuthenticatedPostgresPopulatedCutover(",
    );
    expectOrdered(lifecycle, [
      "await verifyPostgresPrivacyRetentionResidueAbsent(containerId);",
      "sourceBefore = await collectAuthenticatedBackupFingerprints(",
      "const tokens = await derivePrivacyRetentionTokens();",
      "const renderedFixture = renderPrivacyRetentionFixture(fixtureSql, {",
      "databaseProvisioningStarted = true;",
      "await createPostgresPrivacyRetentionDatabase(containerId);",
      "roleProvisioningStarted = true;",
      "await verifyPostgresPrivacyRetentionPlanDeployment(",
      "await provisionTestLoaderAuthLogin(containerId, seedPassword);",
      "await provisionPostgresPrivacyRetentionLogin(containerId, privacyPassword);",
      "await verifyPostgresPrivacyRetentionWrongPasswordRejection(",
      "await seedPostgresPrivacyRetentionFixture(seedClient, renderedFixture);",
      "await verifyPostgresPrivacyRetentionFixtureState(adminClient, tokens);",
      "await verifyPostgresPrivacyRetentionDenials(allocationClient);",
      "await verifyPostgresPrivacyRetentionMetadataBoundaries(",
      "await verifyPostgresPrivacyRetentionTombstone(",
      "const betaBefore =",
      "await verifyPostgresPrivacyRetentionOffboarding(",
      "const betaAfter =",
      "if (betaAfter !== betaBefore || clientErrors.length > 0)",
      "} finally {",
      'label: "rollback and close B13 PostgreSQL client"',
      'label: "drain B13 PostgreSQL backends"',
      'label: "drop B13 template0 database without FORCE"',
      'label: "drop B13 ephemeral logins and privacy capability"',
      'label: "verify B13 source fingerprint"',
      'label: "verify B13 zero residue"',
      'label: "verify B13 final source catalog"',
      "await collectRuntimeAuthOperationFailures(cleanupOperations)",
      "if (probeError !== undefined && cleanupError !== undefined)",
      "throw new AggregateError(",
    ]);
    expect(lifecycle).not.toMatch(/process\.stdout|console\.|resource_token/);
    expect(lifecycle).toContain(
      "error instanceof PostgresPrivacyRetentionDiagnosticError",
    );
    expect(lifecycle).toContain("process.stderr.write(`${error.message}\\n`)");

    const deployment = section(
      "async function verifyPostgresPrivacyRetentionPlanDeployment(",
      "async function expectPostgresPrivacyRetentionClientFailure(",
    );
    expectOrdered(deployment, [
      "renderPrivacyRetentionPlatformMigration(privacyPlan, true)",
      "await verifyPostgresPrivacyRetentionPlatformPristine(containerId);",
      "renderPrivacyRetentionPlatformMigration(privacyPlan)",
      'label: "B13 privacy platform replay"',
      "await provisionMigratorAuthLogin(containerId, migratorPassword);",
      "renderPrivacyRetentionBaseMigration(authenticatedPlan, true)",
      "await verifyPostgresPrivacyRetentionBasePristine(containerId);",
      "renderPrivacyRetentionBaseMigration(authenticatedPlan)",
      "await verifyPostgresPrivacyRetentionBaseState(",
      "renderPrivacyRetentionBaseMigration(authenticatedPlan)",
      "renderPrivacyRetentionApplicationMigration(\n      authenticatedPlan,\n      privacyPlan,\n      true,",
      "await verifyPostgresPrivacyRetentionSuffixAbsent(",
      "await verifyPostgresPrivacyRetentionSuffixEmptyOnlyRace(",
      "await verifyPostgresPrivacyRetentionSuffixAbsent(",
      "privacy-populated-rejection",
      'label: "B13 populated privacy suffix rejection"',
      '"B13 populated-rejection transaction preserved its canary"',
      "await verifyPostgresPrivacyRetentionSuffixAbsent(\n    containerId,\n    authenticatedPlan,\n    1,\n  );",
      "renderPrivacyRetentionApplicationMigration(authenticatedPlan, privacyPlan)",
      "await verifyPostgresPrivacyRetentionSuffixState(",
      'label: "B13 privacy suffix replay"',
    ]);
    expect(deployment).toContain('sqlState: "22012"');
    expect(deployment).toContain('sqlState: "P0001"');

    const suffixAbsence = section(
      "async function verifyPostgresPrivacyRetentionSuffixAbsent(",
      "async function verifyPostgresPrivacyRetentionSuffixState(",
    );
    expect(suffixAbsence).toContain("expectedOrganizationCount: 0 | 1 = 0");
    expect(suffixAbsence).toContain("|true|0|${expectedOrganizationCount}`");

    const suffixRace = section(
      "async function verifyPostgresPrivacyRetentionSuffixEmptyOnlyRace(",
      "async function expectPostgresPrivacyRetentionClientFailure(",
    );
    expectOrdered(suffixRace, [
      "PRIVACY_RETENTION_SUFFIX_WRITER_APPLICATION_NAME",
      "PRIVACY_RETENTION_SUFFIX_DEPLOYER_APPLICATION_NAME",
      "await writerClient.connect();",
      "await deployerClient.connect();",
      'await writerClient.query("BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE")',
      "INSERT INTO private_data.organizations",
      "deployment = deployerClient",
      "renderPrivacyRetentionApplicationMigration(",
      "await waitForPostgresPrivacyRetentionSuffixDeploymentBlock(",
      'const committed = await writerClient.query("COMMIT")',
      "const outcome = await deployment;",
      'outcome.code !== "P0001"',
      "privacy-retention v1 requires empty tenant data",
      'const rolledBack = await deployerClient.query("ROLLBACK")',
      "const preserved = await writerClient.query",
      'text: "DELETE FROM private_data.organizations WHERE id = $1::uuid"',
      "const reset = await writerClient.query",
      "if (reset.rows[0]?.row_count !== 0)",
      "cleanupFailures",
    ]);
    for (const marker of [
      "private_data.organizations'::pg_catalog.regclass",
      "RowExclusiveLock",
      "ShareRowExclusiveLock",
      "pg_catalog.pg_blocking_pids",
      "PRIVACY_RETENTION_SUFFIX_BLOCKED_DEADLINE_MILLISECONDS",
    ]) {
      expect(suffixRace).toContain(marker);
    }

    const tokenDerivation = section(
      "async function derivePrivacyRetentionTokens(",
      "async function verifyPostgresPrivacyRetentionPlanDeployment(",
    );
    for (const marker of [
      "const alphaKey = randomBytes(32);",
      "const betaKey = randomBytes(32);",
      "privacyRetentionMacProvider(alphaKey)",
      "privacyRetentionMacProvider(betaKey)",
      "PRIVACY_RETENTION_FIXTURE_TOKEN_INPUTS_V1.alphaThesis",
      "PRIVACY_RETENTION_FIXTURE_TOKEN_INPUTS_V1.betaThesis",
      "PRIVACY_RETENTION_FIXTURE_TOKEN_INPUTS_V1.alphaAlert",
      "PRIVACY_RETENTION_FIXTURE_TOKEN_INPUTS_V1.betaAlert",
      "deriveResourceIdentifierToken(",
      "alphaKey.fill(0);",
      "betaKey.fill(0);",
    ]) {
      expect(tokenDerivation).toContain(marker);
    }
    expect(tokenDerivation).not.toMatch(/PGPASSWORD|process\.env|console\./);

    const fixtureLoad = section(
      "async function seedPostgresPrivacyRetentionFixture(",
      "async function verifyPostgresPrivacyRetentionFixtureState(",
    );
    expect(fixtureLoad).toContain('...Array<string>(4).fill("SELECT")');
    expect(fixtureLoad).toContain('...Array<string>(12).fill("INSERT")');
    expect(fixtureLoad).toContain('...Array<string>(4).fill("INSERT")');

    const boundaries = section(
      "async function verifyPostgresPrivacyRetentionMetadataBoundaries(",
      "async function verifyPostgresPrivacyRetentionTombstone(",
    );
    expectOrdered(boundaries, [
      "await beginPostgresPrivacyRetentionCapabilityTransaction(privacyClient);",
      '"SELECT transaction_timestamp()::text AS reference_time"',
      "await seedPostgresPrivacyRetentionBoundaryRows(seedClient, referenceTime);",
      '"SELECT * FROM private_data.purge_expired_privacy_metadata()"',
      'purgeRow?.idempotency_rows !== "3"',
      'purgeRow?.audit_rows !== "3"',
      "idempotency_past_or_at",
      "audit_past_or_at",
      "future_after_clock",
      "interval '24 hours'",
      "interval '90 days'",
      "interval '1 microsecond'",
    ]);
    for (const marker of [
      '"metadata_purge"',
      "idempotency_rows=${safePostgresPrivacyRetentionDiagnosticScalar(",
      '"metadata_state"',
      "future_after_clock=${safePostgresPrivacyRetentionDiagnosticScalar(",
    ]) {
      expect(boundaries).toContain(marker);
    }

    const tombstone = section(
      "async function verifyPostgresPrivacyRetentionTombstone(",
      "async function collectPostgresPrivacyRetentionBetaFingerprint(",
    );
    expectOrdered(tombstone, [
      "await beginPostgresPrivacyRetentionCapabilityTransaction(privacyClient);",
      "private_data.delete_live_resource_by_allocation(",
      "PRIVACY_RETENTION_ALPHA_THESIS_ALLOCATION_ID",
      "await commitPostgresPrivacyRetentionCapabilityTransaction(privacyClient);",
      "await verifyPostgresPrivacyRetentionClientIdentity(",
      "lifecycle_state = 'deleted' AS deleted",
      "organization_id IS NULL AND resource_id IS NULL AS raw_cleared",
      "resource_token = pg_catalog.decode($1, 'hex') AS token_preserved",
      "await expectPostgresPrivacyRetentionCapabilityFailure(",
      "private_data.allocate_resource_identifier(",
      '"23505"',
    ]);
    expect(tombstone).not.toContain("DELETE FROM private_data.theses");
    for (const marker of [
      '"tombstone_delete"',
      "allocation_match=${String(",
      '"tombstone_state"',
      "token_preserved=${safePostgresPrivacyRetentionDiagnosticScalar(",
    ]) {
      expect(tombstone).toContain(marker);
    }

    const suffixCatalog = section(
      "async function verifyPostgresPrivacyRetentionSuffixState(",
      "async function seedPostgresPrivacyRetentionFixture(",
    );
    expectOrdered(suffixCatalog, [
      "`${privacyEntry.id}|${privacyEntry.file}|${privacyEntry.sha256}`",
      "...expectedAuthenticatedMigrationLedgerRows(",
      "const actualLedger = await collectMigrationLedger(",
      '"suffix_ledger"',
      "const catalogFingerprint = await psqlScalar(",
      '"suffix_catalog"',
    ]);
    for (const marker of [
      "private_data.delete_live_resource_by_allocation(uuid)",
      "pg_catalog.pg_get_function_result(",
      "pg_catalog.has_function_privilege(",
      "NOT pg_catalog.has_table_privilege(",
      '"true|3|true|5|5|0|0"',
    ]) {
      expect(suffixCatalog).toContain(marker);
    }
    expect(suffixCatalog).toContain(
      "summarizePostgresPrivacyRetentionLedgerDiagnostic(",
    );
    expect(suffixCatalog).toContain(
      "summarizePostgresPrivacyRetentionCatalogDiagnostic(catalogFingerprint)",
    );
    const suffixDiagnostics = section(
      "function summarizePostgresPrivacyRetentionLedgerDiagnostic(",
      "async function seedPostgresPrivacyRetentionFixture(",
    );
    expect(suffixDiagnostics).not.toMatch(
      /password|resource_token|fixtureSql|fileName|sha256/,
    );
    expect(suffixDiagnostics).toContain("const expectedIds = new Set(");
    expect(suffixDiagnostics).toContain(
      'expectedIds.has(migrationId) ? migrationId : "<unexpected>"',
    );
    expect(suffixDiagnostics).toContain("field_matches=${fieldMatches}");
    expect(suffixDiagnostics).not.toContain(
      "/^[a-z0-9-]{1,64}$/.test(migrationId)",
    );
    expect(suffixDiagnostics).toContain(
      "function safePostgresPrivacyRetentionDiagnosticScalar(",
    );
    expect(suffixDiagnostics).toContain('return "<unexpected>"');

    const acceptancePolicy = section(
      "function assertPostgresPrivacyRetentionAcceptancePolicy(",
      "class PostgresPrivacyRetentionError extends Error",
    );
    for (const marker of [
      'policy.status !== "accepted_technical_model_production_blocked"',
      'policy.dataAdmission !== "synthetic_only"',
      "policy.productionAdmission.allowed !== false",
    ]) {
      expect(acceptancePolicy).toContain(marker);
    }

    const offboarding = section(
      "async function verifyPostgresPrivacyRetentionOffboarding(",
      "async function beginAndCommitPostgresPrivacyRetentionOffboarding(",
    );
    expectOrdered(offboarding, [
      "await beginPostgresPrivacyRetentionCapabilityTransaction(allocationClient);",
      "private_data.allocate_resource_identifier(",
      "const offboarding = beginAndCommitPostgresPrivacyRetentionOffboarding(",
      "await waitForPostgresPrivacyRetentionBlockedOffboarding(",
      "await commitPostgresPrivacyRetentionCapabilityTransaction(allocationClient);",
      "offboardingOutcome.privacyDomainId",
      "await expectPostgresPrivacyRetentionCapabilityFailure(",
      "private_data.purge_tenant_privacy_domain($1::uuid)",
      'resource_token_rows: "3"',
      'privacy_domain_rows: "1"',
      'organization_rows: "1"',
      '"0|0|0|0|1|1|2"',
    ]);
    expect(offboarding).toContain('"P0001"');

    const databaseLifecycle = section(
      "async function createPostgresPrivacyRetentionDatabase(",
      "async function verifyAuthenticatedPostgresProjectionPool(",
    );
    expect(databaseLifecycle).toContain(
      "renderCreatePrivacyRetentionDatabaseSql()",
    );
    expect(databaseLifecycle).toContain(
      "renderDropPrivacyRetentionDatabaseSql()",
    );
    expect(databaseLifecycle).toContain(
      "POSTGRES_PRIVACY_RETENTION_DATABASE_NAME",
    );
    expect(databaseLifecycle).not.toMatch(
      /DROP DATABASE[^;]*(?:FORCE|WITH\s*\()/i,
    );
    expect(databaseLifecycle).not.toContain(
      `WITH TEMPLATE \${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    );

    const sourceHashes = section(
      "async function collectAcceptanceSourceHashes(",
      "async function exactFileSha256(",
    );
    for (const marker of [
      "exactFileSha256(privacyRetentionPolicyV1Path)",
      "exactFileSha256(privacyRetentionPlanManifestV1Path)",
      "exactFileSha256(privacyRetentionPolicySourceV1Path)",
      "exactFileSha256(privacyRetentionPlanSourceV1Path)",
      "exactFileSha256(resourceIdentifierTokenV1Path)",
      "exactFileSha256(privacyRetentionFixtureV1Path)",
      "privacyRetentionFixtureV1Sha256 !==",
      "config.privacyRetentionFixtureSha256",
    ]) {
      expect(sourceHashes).toContain(marker);
    }
  });

  it("runs B10 once through a bounded two-backend pool and destroys interrupted leases", async () => {
    const source = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    const section = (start: string, end: string) => {
      const startIndex = source.indexOf(start);
      const endIndex = source.indexOf(end, startIndex + start.length);
      expect(startIndex, start).toBeGreaterThan(-1);
      expect(endIndex, end).toBeGreaterThan(startIndex);
      return source.slice(startIndex, endIndex);
    };

    const entrypoint = section(
      "export async function runPostgresAcceptance(",
      "async function verifyVersionedAuthenticatedMigrationPlan(",
    );
    const b7 = entrypoint.indexOf(
      "await verifyVersionedAuthenticatedMigrationPlan(",
    );
    const b11 = entrypoint.indexOf(
      "await verifyAuthenticatedPostgresMigrationDeployment(",
    );
    const b10 = entrypoint.indexOf(
      "await verifyAuthenticatedPostgresProjectionPool(",
    );
    const b8 = entrypoint.indexOf(
      "await verifyAuthenticatedBackupAndBoundedRestore(",
    );
    expect(b11).toBeGreaterThan(b7);
    expect(b10).toBeGreaterThan(b11);
    expect(b8).toBeGreaterThan(b10);
    expect(
      entrypoint.match(/await verifyAuthenticatedPostgresProjectionPool\(/g),
    ).toHaveLength(1);

    const lifecycle = section(
      "async function verifyAuthenticatedPostgresProjectionPool(",
      "async function provisionPostgresProjectionPoolLogin(",
    );
    for (const marker of [
      "await verifyRuntimeAuthResidueAbsent(containerId);",
      "await verifyPostgresProjectionPoolWrongPasswordRejection(",
      "await verifyPostgresProjectionPoolCapacityAndDirtyLease(",
      "new PooledPostgresFinancialFactProjectionSource(pool,",
      'label: "B10 dirty-checkout reset"',
      "await verifyPostgresProjectionPoolDiscardedSessionState(",
      'label: "B10 beta sequential pooled reuse"',
      "await verifyPostgresProjectionPoolConcurrentTenantIsolation(",
      "const abortDiscardedPid = await verifyPostgresProjectionPoolActiveAbort(",
      "await verifyPostgresProjectionPoolStatementTimeout(",
      'label: "B10 post-discard replacement"',
      "abortDiscardedPid,",
      "timeoutDiscardedPid,",
      "sourceToClose.close()",
      "pool.totalCount !== 0",
      "pool.idleCount !== 0",
      "pool.waitingCount !== 0",
      "() => waitForRuntimeAuthBackendDrain(containerId)",
      "() => assertPostgresProjectionPoolBackendResidueAbsent(containerId)",
      "() => cleanupRuntimeAuthProbe(containerId)",
      "() => verifyRuntimeAuthResidueAbsent(containerId)",
      "const cleanupErrors: unknown[] = [];",
      "for (const cleanup of [",
    ]) {
      expect(lifecycle).toContain(marker);
    }

    const poolConfig = section(
      "function createPostgresProjectionPool(",
      "async function verifyPostgresProjectionPoolWrongPasswordRejection(",
    );
    for (const marker of [
      "new Pool({",
      "host: endpoint.host",
      "port: endpoint.port",
      "database: CLEAN_BOOTSTRAP_DATABASE_NAME",
      "user: RUNTIME_AUTH_LOGIN_ROLE",
      "password,",
      "ssl: false",
      "application_name: POSTGRES_PROJECTION_POOL_APPLICATION_NAME",
      "max: POSTGRES_PROJECTION_POOL_MAX",
      "connectionTimeoutMillis:",
      "statement_timeout:",
    ]) {
      expect(poolConfig).toContain(marker);
    }
    expect(poolConfig).not.toMatch(
      /process\.env|DATABASE_URL|connectionString|query_timeout/,
    );

    const wrongPassword = section(
      "async function verifyPostgresProjectionPoolWrongPasswordRejection(",
      "async function verifyPostgresProjectionPoolCapacityAndDirtyLease(",
    );
    expect(wrongPassword).toContain(
      "new PooledPostgresFinancialFactProjectionSource(pool,",
    );
    expect(wrongPassword).toContain('"POSTGRES_PROJECTION_POOL_FAILURE"');
    expect(wrongPassword).toContain("await source.close();");
    expect(wrongPassword).toContain("await waitForRuntimeAuthBackendDrain(");

    const capacity = section(
      "async function verifyPostgresProjectionPoolCapacityAndDirtyLease(",
      "async function verifyPostgresProjectionPoolDiscardedSessionState(",
    );
    for (const marker of [
      "first = await pool.connect();",
      "second = await pool.connect();",
      "app.b10_session_canary",
      "PREPARE b10_discard_canary AS SELECT 1",
      "pg_advisory_lock(10210)",
      'await second.query("BEGIN READ WRITE")',
      "CALL private_data.set_request_context(",
    ]) {
      expect(capacity).toContain(marker);
    }

    const discard = section(
      "async function verifyPostgresProjectionPoolDiscardedSessionState(",
      "async function queryPostgresProjectionPoolBackendPid(",
    );
    for (const marker of [
      "pg_catalog.pg_stat_activity",
      "pg_catalog.pg_stat_ssl",
      "userName",
      "applicationName",
      "transactionIdle",
      "advisoryLockCount",
      "ssl",
      "backendPid: expectedBackendPid",
      "userName: RUNTIME_AUTH_LOGIN_ROLE",
      'state: "idle"',
      "transactionIdle: true",
      "advisoryLockCount: 0",
      "ssl: false",
    ]) {
      expect(discard).toContain(marker);
    }
    expect(discard).not.toMatch(/pool\.connect|client\.release/);

    const concurrent = section(
      "async function verifyPostgresProjectionPoolConcurrentTenantIsolation(",
      "async function verifyPostgresProjectionPoolActiveAbort(",
    );
    expect(concurrent).toContain("const alphaLoad = source.load(");
    expect(concurrent).toContain("const betaLoad = source.load(");
    expect(concurrent).toContain("initialBlockedBackendDeadline");
    expect(
      concurrent.match(/waitForPostgresProjectionPoolBlockedBackends\(/g),
    ).toHaveLength(2);
    expect(concurrent).toContain("new Set(blockedPids).size !== 2");
    expect(concurrent).toContain(
      "const queuedLoad = source.load(displayCase.query)",
    );
    expect(concurrent).toContain('"POSTGRES_PROJECTION_POOL_TIMEOUT"');
    expect(concurrent).toContain("const stillBlockedPids =");
    expect(concurrent).toContain(
      '"B10 acquisition timeout preserved both leased backends"',
    );
    expect(concurrent).not.toMatch(/pool\.(?:total|idle|waiting)Count/);
    expect(concurrent).toContain("await Promise.all(loads)");

    const activeAbort = section(
      "async function verifyPostgresProjectionPoolActiveAbort(",
      "async function verifyPostgresProjectionPoolStatementTimeout(",
    );
    for (const marker of [
      "new AbortController()",
      "signal: controller.signal",
      "controller.abort(new Error(secretCanary))",
      '"POSTGRES_PROJECTION_POOL_ABORTED"',
      "assertPostgresProjectionPoolBackendQuerySettled(",
      "waitForPostgresProjectionPoolBackendPidDrain(",
      "return blockedPid",
    ]) {
      expect(activeAbort).toContain(marker);
    }

    const timeout = section(
      "async function verifyPostgresProjectionPoolStatementTimeout(",
      "async function capturePostgresProjectionPoolError(",
    );
    expect(timeout).toContain('"POSTGRES_PROJECTION_POOL_TIMEOUT"');
    expect(timeout).toContain(
      "await waitForPostgresProjectionPoolBackendPidDrain(",
    );

    const blockedBackendWait = section(
      "async function waitForPostgresProjectionPoolBlockedBackends(",
      "async function assertPostgresProjectionPoolBackendQuerySettled(",
    );
    expect(blockedBackendWait).toContain(
      "POSTGRES_PROJECTION_POOL_BLOCKED_BACKEND_DEADLINE_MILLISECONDS",
    );
    expect(source).toContain(
      "POSTGRES_PROJECTION_POOL_STATEMENT_TIMEOUT_MILLISECONDS -\n  POSTGRES_PROJECTION_POOL_CONNECTION_TIMEOUT_MILLISECONDS -\n  1_000",
    );

    const tableLock = section(
      "function startPostgresProjectionPoolTableLock(",
      "async function waitForPostgresProjectionPoolTableLock(",
    );
    expect(tableLock).toContain(
      "LOCK TABLE shared_data.financial_facts IN ACCESS EXCLUSIVE MODE;",
    );
    expect(tableLock).toContain("SELECT pg_catalog.pg_sleep(30);");
    expect(tableLock).toContain(
      "POSTGRES_PROJECTION_POOL_BLOCKER_APPLICATION_NAME",
    );

    const tableLockLifecycle = section(
      "async function withPostgresProjectionPoolTableLock<T>(",
      "function startPostgresProjectionPoolTableLock(",
    );
    for (const marker of [
      "const blockerOutcome:",
      "blockerPid === null",
      "releasePostgresProjectionPoolTableLock(",
      "terminatePostgresProjectionPoolTableLockByApplication(",
      "pg_cancel_backend",
      "pg_terminate_backend",
      "POSTGRES_PROJECTION_POOL_BLOCKER_APPLICATION_NAME",
    ]) {
      expect(tableLockLifecycle).toContain(marker);
    }
    expect(tableLockLifecycle).toMatch(
      /pg_cancel_backend\(\$\{blockerPid\}\);`,\s*\),\s*"t",\s*"B10 projection table-lock release"/,
    );
    expect(tableLockLifecycle).toContain(
      'terminated !== "t" && terminated !== "f"',
    );

    const versions = section(
      "async function verifyToolVersions(",
      "async function verifyMigrationLedger(",
    );
    expect(versions).toContain("await readFile(nodePostgresPoolPackagePath");
    expect(versions).toContain('nodePostgresPoolPackage.name !== "pg-pool"');
    expect(versions).toContain(
      "nodePostgresPoolPackage.version !== EXPECTED_NODE_POSTGRES_POOL_VERSION",
    );
    expect(versions).toContain(
      "nodePostgresPool: nodePostgresPoolPackage.version",
    );

    const sourceHashes = section(
      "async function collectAcceptanceSourceHashes(",
      "async function exactFileSha256(",
    );
    expect(sourceHashes).toContain(
      "exactFileSha256(postgresProjectionPoolAdapterPath)",
    );
    expect(sourceHashes).toContain("postgresProjectionPoolSha256,");
    expect(source).toContain(
      "the version 14 success-only run record was written",
    );
  });

  it("runs B14 populated resource-registry cutover with bounded concurrent-write proofs", async () => {
    const source = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    const section = (start: string, end: string) => {
      const startIndex = source.indexOf(start);
      const endIndex = source.indexOf(end, startIndex + start.length);
      expect(startIndex, start).toBeGreaterThan(-1);
      expect(endIndex, end).toBeGreaterThan(startIndex);
      return source.slice(startIndex, endIndex);
    };
    const expectOrdered = (body: string, markers: readonly string[]) => {
      let previous = -1;
      for (const marker of markers) {
        const position = body.indexOf(marker, previous + 1);
        expect(position, marker).toBeGreaterThan(previous);
        previous = position;
      }
    };

    const lifecycle = section(
      "async function verifyAuthenticatedPostgresPopulatedCutover(",
      "type PopulatedCutoverAsyncOutcome =",
    );
    expectOrdered(lifecycle, [
      "await verifyPostgresPopulatedCutoverResidueAbsent(containerId);",
      "sourceBefore = await collectAuthenticatedBackupFingerprints(",
      "databaseProvisioningStarted = true;",
      "await createPostgresPopulatedCutoverDatabase(containerId);",
      "await verifyPostgresPopulatedCutoverPlatformDeployment(",
      "await provisionPostgresPopulatedCutoverMigratorLogin(",
      "await deployPostgresPopulatedCutoverBase(",
      "await provisionPostgresPopulatedCutoverSeedLogin(",
      "await verifyPostgresPopulatedCutoverSeedRoleCatalog(containerId);",
      "await seedPostgresPopulatedCutoverFixture(seedClient, fixtureSql);",
      "await deployPostgresPopulatedCutoverExpand(",
      "await provisionPostgresPopulatedCutoverLogin(",
      "await verifyPostgresPopulatedCutoverWrongPasswordRejection(",
      "await verifyPostgresPopulatedCutoverDenials(cutoverClientA);",
      "await createPostgresPopulatedCutoverPrivacyDomains(cutoverClientA);",
      "const initialClaims = await claimPostgresPopulatedCutoverSkipLocked(",
      "await derivePostgresPopulatedCutoverClaims(",
      "await verifyPostgresPopulatedCutoverDeleteApplyRace(",
      "await drainPostgresPopulatedCutoverWork(",
      "await verifyPostgresPopulatedCutoverInjectedContractRollback(",
      "const staleCaptureEpoch = inspection.captureEpoch;",
      "await insertPostgresPopulatedCutoverConcurrentLegacyResource(seedClient);",
      "contractAttempts += 1;",
      "await expectPostgresPopulatedCutoverContractFailure(",
      "populated cutover capture changed before contract",
      "await drainPostgresPopulatedCutoverWork(",
      "const postContractToken = await derivePostgresPopulatedCutoverResourceToken(",
      "contractAttempts += 1;",
      "renderPopulatedCutoverContractBarrier(",
      "pendingPostContractWriter = runPostgresPopulatedCutoverPostContractWriter(",
      "pendingContractReplay = runPostgresPopulatedCutoverContractReplay(",
      "await waitForPostgresPopulatedCutoverBarrier(",
      "renderPopulatedCutoverContractFinalize(",
      "await verifyPostgresPopulatedCutoverFinalState(",
      "await verifyPostgresPopulatedCutoverTokenReuseRejection(",
      "await collectPostgresPrivacyTargetCatalogFingerprint(",
      "if (finalCatalogFingerprint !== keyedPrivacyCatalogFingerprint)",
      "alphaKey.fill(0);",
      "betaKey.fill(0);",
      "derivedTokens.clear();",
      'label: "rollback B14 open contract barrier"',
      'label: "settle B14 post-contract writer"',
      'label: "settle B14 serialized contract replay"',
      'label: "drain B14 PostgreSQL backends"',
      'label: "drop B14 template0 database without FORCE"',
      'label: "drop B14 ephemeral and plan roles"',
      'label: "verify B14 source fingerprint"',
      'label: "verify B14 zero residue"',
    ]);
    expect(lifecycle).not.toMatch(/console\.|process\.stdout/);
    expect(lifecycle).toContain(
      "error instanceof PostgresPopulatedCutoverDiagnosticError",
    );

    const finalBarrier = lifecycle.slice(
      lifecycle.indexOf("const barrierResult:"),
      lifecycle.indexOf("const finalizeResult:"),
    );
    expect(finalBarrier).not.toMatch(
      /deriveResourceIdentifierToken|createHmac|derivePostgresPopulatedCutover/,
    );

    const deleteRace = section(
      "async function verifyPostgresPopulatedCutoverDeleteApplyRace(",
      "async function waitForPostgresPopulatedCutoverApplyBlockedByDelete(",
    );
    expectOrdered(deleteRace, [
      'deleteClient.query("BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE")',
      "deleteClient.query(renderPopulatedCutoverSharedAdvisorySql())",
      "SET LOCAL ROLE ${MIGRATOR_AUTH_CAPABILITY_ROLE}",
      "DELETE FROM private_data.alert_rules",
      "applyOutcome = runPostgresPopulatedCutoverApply(",
      "await waitForPostgresPopulatedCutoverApplyBlockedByDelete(",
      'deleteClient.query("COMMIT")',
      'outcome.code !== "P0001"',
    ]);

    const applyBlock = section(
      "async function waitForPostgresPopulatedCutoverApplyBlockedByDelete(",
      "async function claimPostgresPopulatedCutoverBatch(",
    );
    for (const marker of [
      "private_data.alert_rules",
      "private_data.resource_identifier_cutover_work",
      "RowExclusiveLock",
      "pg_catalog.pg_blocking_pids",
      "wait_event_type = 'Lock'",
    ]) {
      expect(applyBlock).toContain(marker);
    }

    const claim = section(
      "async function claimPostgresPopulatedCutoverSkipLocked(",
      "async function applyPostgresPopulatedCutoverClaim(",
    );
    expectOrdered(claim, [
      "const claimed = await queryPostgresPopulatedCutoverClaims(first);",
      "const skipped = await queryPostgresPopulatedCutoverClaims(second);",
      "await commitPostgresPopulatedCutoverCapabilityTransaction(second);",
      "await commitPostgresPopulatedCutoverCapabilityTransaction(first);",
      "return claimed;",
    ]);
    expect(claim).not.toMatch(/derive|createHmac/);

    const backfill = section(
      "async function applyPostgresPopulatedCutoverClaim(",
      "async function runPostgresPopulatedCutoverApply(",
    );
    expect(backfill).toContain("$5::bigint");
    expect(backfill).toContain("pg_catalog.decode($7::text, 'hex')");
    expect(backfill).toContain("values: [");

    const injectedRollback = section(
      "async function verifyPostgresPopulatedCutoverInjectedContractRollback(",
      "async function expectPostgresPopulatedCutoverContractFailure(",
    );
    expectOrdered(injectedRollback, [
      "const catalogFingerprintBefore =",
      "await collectPostgresPrivacyTargetCatalogFingerprint(",
      "await expectPostgresPopulatedCutoverContractFailure(",
      "const catalogFingerprintAfter =",
      "await collectPostgresPrivacyTargetCatalogFingerprint(",
      "catalogFingerprintAfter !== catalogFingerprintBefore",
      '"scope=injected_rollback;equal=false"',
      "await verifyPostgresPopulatedCutoverExpandedState(",
    ]);
    expect(
      injectedRollback.match(/POPULATED_CUTOVER_DATABASE_NAME/g),
    ).toHaveLength(2);

    const barrier = section(
      "async function waitForPostgresPopulatedCutoverBarrier(",
      "async function verifyPostgresPopulatedCutoverFinalState(",
    );
    for (const marker of [
      "ExclusiveLock",
      "ShareRowExclusiveLock",
      "ShareLock",
      "private_data.resource_privacy_domains",
      "private_data.theses",
      "private_data.alert_rules",
      "private_data.resource_identifier_cutover_work",
      "private_data.resource_id_registry",
      "POPULATED_CUTOVER_CONTRACT_A_APPLICATION_NAME",
      "POPULATED_CUTOVER_CONTRACT_B_APPLICATION_NAME",
      "POPULATED_CUTOVER_POST_CONTRACT_WRITER_APPLICATION_NAME",
    ]) {
      expect(barrier).toContain(marker);
    }
    expect(barrier).toContain("POPULATED_CUTOVER_ADVISORY_LOCK_KEY");
    expect(
      barrier.match(
        /database_row\.datname = pg_catalog\.current_database\(\)/g,
      ),
    ).toHaveLength(3);
    expect(barrier.match(/classid::bigint = 190566459::bigint/g)).toHaveLength(
      3,
    );
    expect(barrier.match(/objid::bigint = 520803390::bigint/g)).toHaveLength(3);
    expect(barrier.match(/objsubid = 1/g)).toHaveLength(3);
    expect(
      barrier.match(
        /classid::bigint =\s*\(\(\$4::bigint >> 32\) & 4294967295::bigint\)/g,
      ),
    ).toHaveLength(3);
    expect(
      barrier.match(/objid::bigint = \(\$4::bigint & 4294967295::bigint\)/g),
    ).toHaveLength(3);

    const expandedState = section(
      "async function verifyPostgresPopulatedCutoverExpandedState(",
      "async function verifyPostgresPopulatedCutoverDenials(",
    );
    expect(expandedState).toContain(
      "'private_data.allocate_resource_identifier(uuid,uuid,uuid,text,uuid,bytea)'",
    );
    expect(expandedState).toContain("PRIVACY_RETENTION_AUTH_CAPABILITY_ROLE");
    expect(expandedState).toContain("TEST_LOADER_AUTH_CAPABILITY_ROLE");
    expect(expandedState).toContain("false,\n    false,");

    const finalState = section(
      "async function verifyPostgresPopulatedCutoverFinalState(",
      "async function verifyPostgresPopulatedCutoverTokenReuseRejection(",
    );
    expect(finalState).toContain("TEST_LOADER_AUTH_CAPABILITY_ROLE");
    expect(finalState).toContain("lifecycle_state = 'deleted'");
    expect(finalState).toContain("organization_id IS NULL");
    expect(finalState).toContain("resource_id IS NULL");
    expect(finalState).toContain("matched_tokens !== 6");
    expect(finalState).toContain("distinct_tokens !== 6");

    const cleanup = section(
      "async function dropPostgresPopulatedCutoverDatabase(",
      "async function cleanupPostgresPopulatedCutoverRoles(",
    );
    expect(cleanup).toContain("renderDropPopulatedCutoverDatabaseSql()");
    expect(cleanup).not.toMatch(
      /WITH\s*\(\s*FORCE\s*\)|DROP DATABASE[^;]*FORCE/i,
    );

    expect(source).toContain(
      "authenticated bounded synthetic populated resource-registry backfill and online cutover",
    );
    expect(source).toContain(
      "the version 14 success-only run record was written",
    );
  });

  it("injects a deterministic error immediately before final commit", () => {
    const bootstrap = "BEGIN;\nSELECT 1;\nCOMMIT;\n";
    const injected = injectBootstrapFailure(bootstrap);
    expect(injected).toContain("SELECT 1;\nSELECT 1 / 0;\nCOMMIT;");
    expect(injected.match(/SELECT 1 \/ 0;/g)).toHaveLength(1);
  });

  it("requires the expected SQLSTATE and error marker for negative probes", () => {
    const expected = {
      label: "write denial",
      sqlState: "42501",
      message: "permission denied for table organizations",
    };
    expect(() =>
      assertExpectedPsqlFailure(
        {
          exitCode: 1,
          stdout: "",
          stderr: "ERROR:  42501: permission denied for table organizations",
        },
        expected,
      ),
    ).not.toThrow();
    expect(() =>
      assertExpectedPsqlFailure(
        { exitCode: 1, stdout: "", stderr: "ERROR:  42601: syntax error" },
        expected,
      ),
    ).toThrow(/wrong SQLSTATE/i);
    expect(() =>
      assertExpectedPsqlFailure(
        {
          exitCode: 1,
          stdout: "",
          stderr: "ERROR:  42501: permission denied for schema private_data",
        },
        expected,
      ),
    ).toThrow(/wrong reason/i);
    expect(() =>
      assertExpectedPsqlFailure(
        { exitCode: 0, stdout: "", stderr: "" },
        expected,
      ),
    ).toThrow(/unexpectedly succeeded/i);
  });

  it("keeps PostgreSQL conditional expressions unqualified", async () => {
    const runner = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    expect(runner).not.toMatch(/\bpg_catalog\.(?:coalesce|nullif)\s*\(/i);
  });

  it("casts internal catalog char columns before text fingerprints", async () => {
    const runner = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    expect(runner).toContain("class.relkind::text ||");
    expect(runner).toContain("constraint_row.contype::text ||");
    expect(runner).toContain("trigger.tgenabled::text ||");
    expect(runner).not.toMatch(
      /\b(?:class\.relkind|constraint_row\.contype|trigger\.tgenabled)\s*\|\|/,
    );
  });

  it("normalizes loopback inet values without CIDR suffixes", async () => {
    const runner = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    expect(runner).toContain("pg_catalog.host(pg_catalog.inet_client_addr())");
    expect(runner).toContain("pg_catalog.host(pg_catalog.inet_server_addr())");
    expect(runner).not.toMatch(
      /(?:pg_catalog\.)?inet_(?:client|server)_addr\s*\(\s*\)\s*::\s*text/i,
    );
  });
});

async function loadArtifacts(): Promise<AcceptanceArtifacts> {
  return {
    config: JSON.parse(
      await readFile(
        new URL("../acceptance/postgres-image.json", import.meta.url),
        "utf8",
      ),
    ) as unknown,
    workflow: await readFile(
      new URL(
        "../../../.github/workflows/postgres-acceptance.yml",
        import.meta.url,
      ),
      "utf8",
    ),
    fixture: await readFile(
      new URL("../acceptance/synthetic-fixture.sql", import.meta.url),
      "utf8",
    ),
    queryPlanLoadFixture: await readFile(
      new URL("../acceptance/query-plan-load-fixture.sql", import.meta.url),
      "utf8",
    ),
    privacyRetentionFixture: await readFile(
      new URL("../acceptance/privacy-retention-fixture.sql", import.meta.url),
      "utf8",
    ),
    populatedCutoverFixture: await readFile(
      new URL("../acceptance/populated-cutover-fixture.sql", import.meta.url),
      "utf8",
    ),
  };
}
