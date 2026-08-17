import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  assertAuthenticatedTestLoaderFixtureResult,
  assertAuthenticatedTestLoaderFixtureRollbackFailure,
  assertExpectedPsqlFailure,
  assertRuntimeWrongPasswordRejection,
  assertTestLoaderWrongPasswordRejection,
  buildRuntimeAuthPsqlInvocation,
  buildTestLoaderAuthPsqlInvocation,
  checkPostgresAcceptanceHarness,
  collectRuntimeAuthOperationFailures,
  EXPECTED_CAPABILITY_ROLE_ATTRIBUTE_ROWS,
  extractReviewedSyntheticFixtureBody,
  generateRuntimeAuthPassword,
  generateTestLoaderAuthPassword,
  injectBootstrapFailure,
  inspectPostgresAcceptanceHarness,
  renderAuthenticatedTestLoaderFixtureRollbackProbeSql,
  renderAuthenticatedTestLoaderFixtureSql,
  renderAlternatingPreparedStatementSql,
  renderRuntimeAuthBackendDrainSql,
  renderRuntimeAuthCleanupSql,
  renderRuntimeAuthPassfile,
  renderRuntimeAuthProvisioningSql,
  renderRuntimeAuthenticatedFinancialFactProjectionSql,
  renderRuntimeContextSql,
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
        "3e371584789e8408e223da4386caf2dfcaf0edf9974116fd42ea74f907b8901d",
      fixtureSha256:
        "0c1436ca60b51ebddb2f8bf77b24960f77831efd2010bcb4449a837c1d9a78e7",
    });
    expect(artifacts.workflow).toContain(
      "name: postgres-acceptance-evidence-v5-${{ github.sha }}-${{ github.run_attempt }}",
    );
    expect(artifacts.workflow).toContain(
      "path: ${{ runner.temp }}/research-cockpit-postgres-acceptance-v5.json",
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

  it("rejects ports, URLs, host addressing, and forged container plumbing", async () => {
    const artifacts = await loadArtifacts();
    const workflow = artifacts.workflow
      .replace("    steps:", "    ports:\n      - 5432:5432\n    steps:")
      .replace(
        "RESEARCH_COCKPIT_PG_CONTAINER_ID: ${{ job.services.postgres.id }}",
        "RESEARCH_COCKPIT_PG_CONTAINER_ID: forged\n          DATABASE_URL: postgres://localhost/demo",
      );
    const violations = inspectPostgresAcceptanceHarness({
      ...artifacts,
      workflow,
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        "workflow must not publish a database port",
        "workflow must not construct a database URL",
        "workflow must not address PostgreSQL through the host",
        "workflow must pass only the GitHub service container ID",
      ]),
    );
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
    const workflow = artifacts.workflow.replaceAll(
      "      - tsconfig.base.json\n",
      "",
    );
    expect(
      inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
    ).toContain("workflow must rerun when tsconfig.base.json changes");
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
        "${{ runner.temp }}/research-cockpit-postgres-acceptance-v5.json",
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
      "postgres-acceptance-evidence-v5-${{ github.sha }}-${{ github.run_attempt }}",
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
        GITHUB_SHA: "not-a-canonical-commit",
      }),
    ).rejects.toThrow(/canonical GitHub checkout commit is required/i);
  });

  it("writes success evidence only after the final implemented probe", () => {
    const source = runPostgresAcceptance.toString();
    const impersonatedProbe = source.indexOf("await verifyWriteDenials");
    const finalProbe = source.indexOf(
      "await verifyAuthenticatedRuntimeSession",
    );
    const buildEvidence = source.indexOf("buildPostgresAcceptanceEvidence");
    const writeEvidence = source.indexOf("writePostgresAcceptanceEvidence");
    const evidenceHash = source.indexOf("writtenEvidence.sha256");
    const successMessage = source.indexOf("process.stdout.write");
    expect(impersonatedProbe).toBeGreaterThan(-1);
    expect(finalProbe).toBeGreaterThan(impersonatedProbe);
    expect(buildEvidence).toBeGreaterThan(finalProbe);
    expect(writeEvidence).toBeGreaterThan(buildEvidence);
    expect(successMessage).toBeGreaterThan(writeEvidence);
    expect(evidenceHash).toBeGreaterThan(successMessage);
    expect(source).not.toContain("writtenEvidence.path");
    expect(source).toContain("authenticated test-loader");
    expect(source).toContain("driverless financial-fact projection");
    expect(source).toContain("version 5 success-only run record");
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
      "await verifyAuthenticatedTestLoaderRollback(containerId, fixtureSql);",
      "await verifyAuthenticatedTestLoaderFixtureLoad(containerId, fixtureSql);",
      "await verifyAuthenticatedTestLoaderDenials(containerId);",
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
      "await verifyMigrationLedger(containerId)",
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
    const cleanupBoundary = authenticatedProbe.indexOf("} finally {");
    expect(boundedWrite).toBeGreaterThan(-1);
    expect(fullMatrix).toBeGreaterThan(boundedWrite);
    expect(financialFactProjection).toBeGreaterThan(fullMatrix);
    expect(cleanupBoundary).toBeGreaterThan(financialFactProjection);
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

    const matrixClient = section(
      "function runtimeAuthorizationMatrixClient(",
      "async function privateVisibility(",
    );
    expect(matrixClient).toContain(
      'mode === "authenticated"\n        ? runtimeAuthenticatedPsqlScalar(containerId, sql)\n        : psqlScalar(containerId, sql)',
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
  };
}
