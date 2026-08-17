import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildPostgresAcceptanceEvidence,
  parsePostgresAcceptanceEvidence,
  POSTGRES_ACCEPTANCE_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME,
  POSTGRES_ACCEPTANCE_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V1_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V2_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V4_NOT_PROVEN,
  PostgresAcceptanceEvidenceError,
  serializePostgresAcceptanceEvidence,
  writePostgresAcceptanceEvidence,
  type BuildPostgresAcceptanceEvidenceInput,
  type PostgresAcceptanceEvidence,
  type PostgresAcceptanceEvidenceV1,
  type PostgresAcceptanceEvidenceV2,
  type PostgresAcceptanceEvidenceV3,
  type PostgresAcceptanceEvidenceV4,
} from "../src/postgres-acceptance-evidence";

const IMAGE_DIGEST = `sha256:${"a".repeat(64)}`;
const SECRET_CANARY = "never-copy-this-secret-canary";
const TEMP_DIRECTORIES: string[] = [];

function environment(overrides: Record<string, string | undefined> = {}) {
  return {
    CI: "true",
    GITHUB_ACTIONS: "true",
    GITHUB_JOB: "postgres-acceptance",
    GITHUB_WORKFLOW: "PostgreSQL acceptance",
    GITHUB_REPOSITORY: "example/research-cockpit",
    GITHUB_REPOSITORY_ID: "123456789",
    GITHUB_SHA: "b".repeat(40),
    GITHUB_RUN_ID: "9876543210",
    GITHUB_RUN_ATTEMPT: "2",
    ACTIONS_RUNTIME_TOKEN: SECRET_CANARY,
    DATABASE_PASSWORD: `${SECRET_CANARY}-database`,
    ...overrides,
  };
}

function input(
  overrides: Partial<BuildPostgresAcceptanceEvidenceInput> = {},
): BuildPostgresAcceptanceEvidenceInput {
  return {
    githubEnvironment: environment(),
    reviewedImageReference: `docker.io/library/postgres:17.11-bookworm@${IMAGE_DIGEST}`,
    reviewedImageIndexDigest: IMAGE_DIGEST,
    toolVersions: {
      postgres: "postgres (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      psql: "psql (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      pgDump: "pg_dump (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      pgRestore: "pg_restore (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
    },
    sourceHashes: {
      workflowSha256: "1".repeat(64),
      fixtureSha256: "2".repeat(64),
      migrationManifestSha256: "3".repeat(64),
      acceptanceRunnerSha256: "4".repeat(64),
      projectionQuerySha256: "5".repeat(64),
      projectionNormalizerSha256: "6".repeat(64),
    },
    completedAt: "2026-08-15T23:59:58.123Z",
    ...overrides,
  };
}

function evidence(): PostgresAcceptanceEvidenceV4 {
  return buildPostgresAcceptanceEvidence(input());
}

function historicalSourceHashes(): Record<string, unknown> {
  const hashes = input().sourceHashes;
  return {
    workflowSha256: hashes.workflowSha256,
    fixtureSha256: hashes.fixtureSha256,
    migrationManifestSha256: hashes.migrationManifestSha256,
    acceptanceRunnerSha256: hashes.acceptanceRunnerSha256,
  };
}

function mutableEvidence(): Record<string, unknown> {
  return JSON.parse(serializePostgresAcceptanceEvidence(evidence())) as Record<
    string,
    unknown
  >;
}

function mutableV1Evidence(): Record<string, unknown> {
  return {
    ...mutableEvidence(),
    schemaVersion: 1,
    sourceHashes: historicalSourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V1_NOT_PROVEN],
  };
}

function mutableV2Evidence(): Record<string, unknown> {
  return {
    ...mutableEvidence(),
    schemaVersion: 2,
    sourceHashes: historicalSourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V2_NOT_PROVEN],
  };
}

function mutableV3Evidence(): Record<string, unknown> {
  return {
    ...mutableEvidence(),
    schemaVersion: 3,
    sourceHashes: historicalSourceHashes(),
    checksPassed: [...POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED],
    notProven: [...POSTGRES_ACCEPTANCE_V3_NOT_PROVEN],
  };
}

function v1Evidence(): PostgresAcceptanceEvidenceV1 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV1Evidence()),
  );
  if (parsed.schemaVersion !== 1) {
    throw new Error("expected historical v1 evidence");
  }
  return parsed;
}

function v2Evidence(): PostgresAcceptanceEvidenceV2 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV2Evidence()),
  );
  if (parsed.schemaVersion !== 2) {
    throw new Error("expected historical v2 evidence");
  }
  return parsed;
}

function v3Evidence(): PostgresAcceptanceEvidenceV3 {
  const parsed = parsePostgresAcceptanceEvidence(
    JSON.stringify(mutableV3Evidence()),
  );
  if (parsed.schemaVersion !== 3) {
    throw new Error("expected historical v3 evidence");
  }
  return parsed;
}

function expectValueFreeValidationFailure(run: () => unknown): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(PostgresAcceptanceEvidenceError);
  if (!(caught instanceof PostgresAcceptanceEvidenceError)) {
    throw new Error("expected PostgresAcceptanceEvidenceError");
  }
  expect(caught).toMatchObject({
    name: "PostgresAcceptanceEvidenceError",
    code: "INVALID_POSTGRES_ACCEPTANCE_EVIDENCE",
  });
  expect(caught.message).toBe(
    "PostgreSQL acceptance evidence failed validation.",
  );
  expect(caught.message).not.toContain(SECRET_CANARY);
  expect(caught).not.toHaveProperty("cause");
  expect(caught).not.toHaveProperty("field");
  expect(caught).not.toHaveProperty("value");
}

afterEach(async () => {
  await Promise.all(
    TEMP_DIRECTORIES.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("PostgreSQL acceptance success evidence", () => {
  it("builds the exact success-only v4 schema in its canonical order", () => {
    const result = evidence();
    expect(POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME).toBe(
      "research-cockpit-postgres-acceptance-v4.json",
    );
    expect(Object.keys(result)).toEqual([
      "schemaVersion",
      "suite",
      "outcome",
      "job",
      "workflow",
      "repository",
      "repositoryId",
      "commitSha",
      "runId",
      "runAttempt",
      "reviewedImageReference",
      "reviewedImageIndexDigest",
      "databaseName",
      "serverVersionNumber",
      "serverVersion",
      "toolVersions",
      "sourceHashes",
      "checksPassed",
      "notProven",
      "completedAt",
    ]);
    expect(result).toEqual({
      schemaVersion: 4,
      suite: "research-cockpit-postgresql-acceptance",
      outcome: "passed",
      job: "postgres-acceptance",
      workflow: "PostgreSQL acceptance",
      repository: "example/research-cockpit",
      repositoryId: "123456789",
      commitSha: "b".repeat(40),
      runId: "9876543210",
      runAttempt: 2,
      reviewedImageReference: `docker.io/library/postgres:17.11-bookworm@${IMAGE_DIGEST}`,
      reviewedImageIndexDigest: IMAGE_DIGEST,
      databaseName: "research_cockpit_acceptance_test",
      serverVersionNumber: "170011",
      serverVersion: "17.11",
      toolVersions: input().toolVersions,
      sourceHashes: input().sourceHashes,
      checksPassed: [...POSTGRES_ACCEPTANCE_CHECKS_PASSED],
      notProven: [...POSTGRES_ACCEPTANCE_NOT_PROVEN],
      completedAt: "2026-08-15T23:59:58.123Z",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.toolVersions)).toBe(true);
    expect(Object.isFrozen(result.sourceHashes)).toBe(true);
    expect(Object.isFrozen(result.checksPassed)).toBe(true);
    expect(Object.isFrozen(result.notProven)).toBe(true);
  });

  it("preserves exact historical v1 parsing and canonical serialization", () => {
    const historical = mutableV1Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V1_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.checksPassed)).toBe(true);
    expect(Object.isFrozen(parsed.notProven)).toBe(true);
  });

  it("preserves exact historical v2 parsing and canonical serialization", () => {
    const historical = mutableV2Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V2_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.checksPassed)).toBe(true);
    expect(Object.isFrozen(parsed.notProven)).toBe(true);
  });

  it("preserves exact historical v3 parsing and canonical serialization", () => {
    const historical = mutableV3Evidence();
    const canonical = `${JSON.stringify(historical, null, 2)}\n`;
    const parsed = parsePostgresAcceptanceEvidence(canonical);

    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.checksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
    ]);
    expect(parsed.notProven).toEqual([...POSTGRES_ACCEPTANCE_V3_NOT_PROVEN]);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(canonical);
    expect(Object.keys(parsed.sourceHashes)).toEqual([
      "workflowSha256",
      "fixtureSha256",
      "migrationManifestSha256",
      "acceptanceRunnerSha256",
    ]);
  });

  it("adds only the authenticated matrix claim between v2 and v3", () => {
    expect(POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
      "authenticated_runtime_authorization_matrix",
    ]);
    expect(POSTGRES_ACCEPTANCE_V3_NOT_PROVEN).toEqual(
      POSTGRES_ACCEPTANCE_V2_NOT_PROVEN.filter(
        (limitation) =>
          limitation !== "full_authenticated_runtime_authorization_matrix",
      ),
    );
  });

  it("adds the exact projection claim, source hashes, and limitations in v4", () => {
    expect(POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED).toEqual([
      ...POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
      "authenticated_financial_fact_projection_query",
    ]);
    expect(POSTGRES_ACCEPTANCE_V4_NOT_PROVEN).toEqual([
      ...POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
      "application_driver_pool_or_composition_root",
      "complete_dossier_history_timeline_or_dimensioned_projection",
    ]);
    expect(Object.keys(evidence().sourceHashes)).toEqual([
      "workflowSha256",
      "fixtureSha256",
      "migrationManifestSha256",
      "acceptanceRunnerSha256",
      "projectionQuerySha256",
      "projectionNormalizerSha256",
    ]);
  });

  it("rejects cross-version check and limitation combinations", () => {
    const v3AsV1 = mutableV3Evidence();
    v3AsV1.schemaVersion = 1;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v3AsV1)),
    );

    const v1AsV2 = mutableV1Evidence();
    v1AsV2.schemaVersion = 2;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v1AsV2)),
    );

    const v2AsV3 = mutableV2Evidence();
    v2AsV3.schemaVersion = 3;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v2AsV3)),
    );

    const v3AsV4 = mutableV3Evidence();
    v3AsV4.schemaVersion = 4;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v3AsV4)),
    );

    const v4AsV3 = mutableEvidence();
    v4AsV3.schemaVersion = 3;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(v4AsV3)),
    );

    const mixedV1 = mutableV1Evidence();
    mixedV1.notProven = [...POSTGRES_ACCEPTANCE_NOT_PROVEN];
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(mixedV1)),
    );

    const mixedV2 = mutableV2Evidence();
    mixedV2.checksPassed = [...POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED];
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(mixedV2)),
    );

    const mixedV3 = mutableV3Evidence();
    mixedV3.notProven = [...POSTGRES_ACCEPTANCE_V2_NOT_PROVEN];
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(mixedV3)),
    );

    expect(POSTGRES_ACCEPTANCE_CHECKS_PASSED).toBe(
      POSTGRES_ACCEPTANCE_V4_CHECKS_PASSED,
    );
    expect(POSTGRES_ACCEPTANCE_NOT_PROVEN).toBe(
      POSTGRES_ACCEPTANCE_V4_NOT_PROVEN,
    );
  });

  it("selects only reviewed GitHub metadata and never serializes environment secrets", () => {
    const result = buildPostgresAcceptanceEvidence(
      input({
        githubEnvironment: environment({
          GITHUB_TOKEN: `${SECRET_CANARY}-github`,
          INPUT_PASSWORD: `${SECRET_CANARY}-input`,
          RUNNER_TEMP: `${SECRET_CANARY}-path`,
        }),
      }),
    );
    const serialized = serializePostgresAcceptanceEvidence(result);
    expect(serialized).not.toContain(SECRET_CANARY);
    expect(serialized).not.toMatch(/TOKEN|PASSWORD|RUNNER_TEMP/);
    expect(Object.keys(result)).not.toContain("githubEnvironment");
  });

  it("does not inspect unrelated environment accessors", () => {
    const githubEnvironment = environment();
    Object.defineProperty(githubEnvironment, "SECRET_GETTER", {
      enumerable: true,
      get() {
        throw new Error(SECRET_CANARY);
      },
    });
    expect(() =>
      buildPostgresAcceptanceEvidence(input({ githubEnvironment })),
    ).not.toThrow();
  });

  it("serializes deterministic exact bytes and round-trips them", () => {
    const first = serializePostgresAcceptanceEvidence(evidence());
    const second = serializePostgresAcceptanceEvidence(
      buildPostgresAcceptanceEvidence(input()),
    );
    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(first.endsWith("\n\n")).toBe(false);
    expect(first).not.toContain("\r");
    expect(
      serializePostgresAcceptanceEvidence(
        parsePostgresAcceptanceEvidence(first),
      ),
    ).toBe(first);
  });

  it("parses non-canonical JSON but always reserializes canonically", () => {
    const compact = JSON.stringify(mutableEvidence());
    const parsed = parsePostgresAcceptanceEvidence(`  ${compact}\n`);
    expect(serializePostgresAcceptanceEvidence(parsed)).toBe(
      serializePostgresAcceptanceEvidence(evidence()),
    );
  });

  it.each([
    ["schemaVersion", 5],
    ["suite", "different-suite"],
    ["outcome", "failed"],
    ["job", "different-job"],
    ["workflow", "Different workflow"],
    ["databaseName", "postgres"],
    ["serverVersionNumber", "170012"],
    ["serverVersion", "17.12"],
  ])("rejects a changed fixed field %s", (field, replacement) => {
    const changed = mutableEvidence();
    changed[field] = replacement;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(changed)),
    );
  });

  it("rejects missing, additional, inherited, accessor, and symbol fields", () => {
    const missing = mutableEvidence();
    delete missing.completedAt;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(missing)),
    );

    const additional = mutableEvidence();
    additional.secret = SECRET_CANARY;
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(JSON.stringify(additional)),
    );

    const inherited = Object.assign(
      Object.create({ inherited: SECRET_CANARY }) as Record<string, unknown>,
      mutableEvidence(),
    );
    expectValueFreeValidationFailure(() =>
      serializePostgresAcceptanceEvidence(
        inherited as unknown as PostgresAcceptanceEvidence,
      ),
    );

    const accessor = mutableEvidence();
    Object.defineProperty(accessor, "completedAt", {
      enumerable: true,
      get: () => {
        throw new Error(SECRET_CANARY);
      },
    });
    expectValueFreeValidationFailure(() =>
      serializePostgresAcceptanceEvidence(
        accessor as unknown as PostgresAcceptanceEvidence,
      ),
    );

    const symbol = mutableEvidence();
    Object.defineProperty(symbol, Symbol("secret"), {
      enumerable: true,
      value: SECRET_CANARY,
    });
    expectValueFreeValidationFailure(() =>
      serializePostgresAcceptanceEvidence(
        symbol as unknown as PostgresAcceptanceEvidence,
      ),
    );
  });

  it("rejects missing and additional nested fields", () => {
    for (const key of ["toolVersions", "sourceHashes"] as const) {
      const missing = mutableEvidence();
      const nested = missing[key] as Record<string, unknown>;
      delete nested[Object.keys(nested)[0]!];
      expectValueFreeValidationFailure(() =>
        parsePostgresAcceptanceEvidence(JSON.stringify(missing)),
      );

      const additional = mutableEvidence();
      (additional[key] as Record<string, unknown>).secret = SECRET_CANARY;
      expectValueFreeValidationFailure(() =>
        parsePostgresAcceptanceEvidence(JSON.stringify(additional)),
      );
    }
  });

  it("requires the fixed ordered checks and limitations without extras", () => {
    for (const key of ["checksPassed", "notProven"] as const) {
      const changed = mutableEvidence();
      (changed[key] as unknown[]).reverse();
      expectValueFreeValidationFailure(() =>
        parsePostgresAcceptanceEvidence(JSON.stringify(changed)),
      );

      const missing = mutableEvidence();
      (missing[key] as unknown[]).pop();
      expectValueFreeValidationFailure(() =>
        parsePostgresAcceptanceEvidence(JSON.stringify(missing)),
      );

      const additional = mutableEvidence();
      (additional[key] as unknown[]).push(SECRET_CANARY);
      expectValueFreeValidationFailure(() =>
        parsePostgresAcceptanceEvidence(JSON.stringify(additional)),
      );
    }
  });

  it("rejects fixed-array accessors without invoking them", () => {
    const changed = mutableEvidence();
    const checks = changed.checksPassed as unknown[];
    let accessed = false;
    Object.defineProperty(checks, "0", {
      enumerable: true,
      configurable: true,
      get() {
        accessed = true;
        return POSTGRES_ACCEPTANCE_CHECKS_PASSED[0];
      },
    });
    expectValueFreeValidationFailure(() =>
      serializePostgresAcceptanceEvidence(
        changed as unknown as PostgresAcceptanceEvidence,
      ),
    );
    expect(accessed).toBe(false);
  });

  it.each(["2", 0, 1.5, 9_007_199_254_740_992])(
    "rejects a non-positive-integer artifact run attempt %s",
    (runAttempt) => {
      const changed = mutableEvidence();
      changed.runAttempt = runAttempt;
      expectValueFreeValidationFailure(() =>
        parsePostgresAcceptanceEvidence(JSON.stringify(changed)),
      );
    },
  );

  it.each([
    ["GITHUB_REPOSITORY", "missing-slash"],
    ["GITHUB_REPOSITORY_ID", "0"],
    ["GITHUB_REPOSITORY_ID", "01"],
    ["GITHUB_SHA", "B".repeat(40)],
    ["GITHUB_SHA", "b".repeat(39)],
    ["GITHUB_RUN_ID", "1e3"],
    ["GITHUB_RUN_ATTEMPT", "0"],
    ["GITHUB_RUN_ATTEMPT", "1.5"],
    ["GITHUB_RUN_ATTEMPT", "9007199254740992"],
    ["GITHUB_JOB", "another-job"],
    ["GITHUB_WORKFLOW", "Another workflow"],
    ["GITHUB_ACTIONS", "false"],
    ["CI", "false"],
  ])("rejects invalid GitHub metadata %s", (key, replacement) => {
    expectValueFreeValidationFailure(() =>
      buildPostgresAcceptanceEvidence(
        input({ githubEnvironment: environment({ [key]: replacement }) }),
      ),
    );
  });

  it("rejects absent selected GitHub metadata without coercion", () => {
    for (const key of [
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_SHA",
      "GITHUB_RUN_ID",
      "GITHUB_RUN_ATTEMPT",
    ]) {
      expectValueFreeValidationFailure(() =>
        buildPostgresAcceptanceEvidence(
          input({ githubEnvironment: environment({ [key]: undefined }) }),
        ),
      );
    }
  });

  it("rejects mismatched, malformed, and uppercase image digests", () => {
    for (const badInput of [
      input({ reviewedImageIndexDigest: `sha256:${"A".repeat(64)}` }),
      input({ reviewedImageIndexDigest: `sha256:${"a".repeat(63)}` }),
      input({
        reviewedImageReference: `docker.io/library/postgres:17.11-bookworm@sha256:${"c".repeat(64)}`,
      }),
      input({ reviewedImageReference: `postgres:17.11@${IMAGE_DIGEST}` }),
    ]) {
      expectValueFreeValidationFailure(() =>
        buildPostgresAcceptanceEvidence(badInput),
      );
    }
  });

  it("requires every exact lowercase SHA-256 source hash", () => {
    for (const key of [
      "workflowSha256",
      "fixtureSha256",
      "migrationManifestSha256",
      "acceptanceRunnerSha256",
      "projectionQuerySha256",
      "projectionNormalizerSha256",
    ] as const) {
      for (const replacement of [
        "f".repeat(63),
        "F".repeat(64),
        `sha256:${"f".repeat(64)}`,
      ]) {
        expectValueFreeValidationFailure(() =>
          buildPostgresAcceptanceEvidence(
            input({
              sourceHashes: { ...input().sourceHashes, [key]: replacement },
            }),
          ),
        );
      }
    }
  });

  it("rejects inexact tool identities, versions, and control characters", () => {
    for (const [key, replacement] of [
      ["postgres", "psql (PostgreSQL) 17.11"],
      ["psql", "psql (PostgreSQL) 17.12"],
      ["pgDump", "pg-dump (PostgreSQL) 17.11"],
      ["pgRestore", `pg_restore (PostgreSQL) 17.11\n${SECRET_CANARY}`],
    ] as const) {
      expectValueFreeValidationFailure(() =>
        buildPostgresAcceptanceEvidence(
          input({
            toolVersions: { ...input().toolVersions, [key]: replacement },
          }),
        ),
      );
    }
  });

  it.each([
    "2026-08-15T23:59:58Z",
    "2026-08-15T18:59:58.123-05:00",
    "2026-02-30T23:59:58.123Z",
    "2026-08-15T23:59:58.123000Z",
    "2026-08-15 23:59:58.123Z",
  ])("rejects noncanonical or impossible completion time %s", (completedAt) => {
    expectValueFreeValidationFailure(() =>
      buildPostgresAcceptanceEvidence(input({ completedAt })),
    );
  });

  it("rejects malformed JSON with the same value-free error", () => {
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(`{"secret":"${SECRET_CANARY}"`),
    );
    expectValueFreeValidationFailure(() =>
      parsePostgresAcceptanceEvidence(" ".repeat(32_769)),
    );
  });

  it("writes only the fixed RUNNER_TEMP path with exact-byte SHA-256", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rc-pg-evidence-"));
    TEMP_DIRECTORIES.push(directory);
    const expectedBytes = Buffer.from(
      serializePostgresAcceptanceEvidence(evidence()),
      "utf8",
    );

    const result = await writePostgresAcceptanceEvidence(evidence(), {
      RUNNER_TEMP: directory,
      SECRET: SECRET_CANARY,
    });

    expect(dirname(result.path)).toBe(directory);
    expect(basename(result.path)).toBe(POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME);
    expect(await readFile(result.path)).toEqual(expectedBytes);
    expect(result.byteLength).toBe(expectedBytes.byteLength);
    expect(result.sha256).toBe(
      createHash("sha256").update(expectedBytes).digest("hex"),
    );
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(result)).toBe(true);

    if (process.platform !== "win32") {
      expect((await stat(result.path)).mode & 0o777).toBe(0o600);
    }
  });

  it("never writes a historical v1, v2, or v3 record under the v4 filename", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rc-pg-evidence-"));
    TEMP_DIRECTORIES.push(directory);

    for (const historical of [v1Evidence(), v2Evidence(), v3Evidence()]) {
      await expect(
        writePostgresAcceptanceEvidence(
          historical as unknown as PostgresAcceptanceEvidenceV4,
          { RUNNER_TEMP: directory },
        ),
      ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceError);
    }
  });

  it("fails atomically and preserves a pre-existing evidence file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rc-pg-evidence-"));
    TEMP_DIRECTORIES.push(directory);
    const path = join(directory, POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME);
    const sentinel = Buffer.from(SECRET_CANARY, "utf8");
    await writeFile(path, sentinel);

    await expect(
      writePostgresAcceptanceEvidence(evidence(), { RUNNER_TEMP: directory }),
    ).rejects.toMatchObject({ code: "EEXIST" });
    expect(await readFile(path)).toEqual(sentinel);
  });

  it.each([undefined, "", "relative/path", " /absolute/path", "/path\nsecret"])(
    "rejects an invalid runner temporary directory %s",
    async (runnerTemp) => {
      await expect(
        writePostgresAcceptanceEvidence(evidence(), {
          RUNNER_TEMP: runnerTemp,
        }),
      ).rejects.toBeInstanceOf(PostgresAcceptanceEvidenceError);
    },
  );
});
