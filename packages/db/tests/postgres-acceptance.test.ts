import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  assertExpectedPsqlFailure,
  assertRuntimeWrongPasswordRejection,
  buildRuntimeAuthPsqlInvocation,
  checkPostgresAcceptanceHarness,
  collectRuntimeAuthOperationFailures,
  EXPECTED_CAPABILITY_ROLE_ATTRIBUTE_ROWS,
  generateRuntimeAuthPassword,
  injectBootstrapFailure,
  inspectPostgresAcceptanceHarness,
  renderRuntimeAuthBackendDrainSql,
  renderRuntimeAuthCleanupSql,
  renderRuntimeAuthPassfile,
  renderRuntimeAuthProvisioningSql,
  RUNTIME_AUTH_CAPABILITY_ROLE,
  RUNTIME_AUTH_FORBIDDEN_SET_ROLES,
  RUNTIME_AUTH_LOGIN_ROLE,
  RUNTIME_AUTH_PASSFILE,
  RUNTIME_AUTH_WRONG_PASSFILE,
  runRuntimeAuthCommandWithDrain,
  runPostgresAcceptance,
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
      PGREQUIREAUTH: "",
      PGSSLMODE: "disable",
      PGCONNECT_TIMEOUT: "5",
    });
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
    expect(wrongPasswordInvocation.environment).toEqual({
      ...correctPasswordInvocation.environment,
      PGPASSFILE: RUNTIME_AUTH_WRONG_PASSFILE,
      PGREQUIREAUTH: "",
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

  it("accepts the reviewed immutable workflow and synthetic fixture", async () => {
    await expect(checkPostgresAcceptanceHarness()).resolves.toEqual([]);
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
    const workflow = artifacts.workflow.replace(
      "POSTGRES_HOST_AUTH_METHOD: scram-sha-256",
      "POSTGRES_HOST_AUTH_METHOD: trust",
    );
    expect(
      inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
    ).toContain(
      "acceptance service must require SCRAM for host authentication",
    );
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
      "./research-cockpit-postgres-acceptance-v2.json",
    ]) {
      const workflow = artifacts.workflow.replace(
        "${{ runner.temp }}/research-cockpit-postgres-acceptance-v2.json",
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
      "postgres-acceptance-evidence-v2-${{ github.sha }}-${{ github.run_attempt }}",
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
