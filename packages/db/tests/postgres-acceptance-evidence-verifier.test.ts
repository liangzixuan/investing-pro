import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import {
  buildPostgresAcceptanceEvidence,
  POSTGRES_ACCEPTANCE_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V1_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V2_NOT_PROVEN,
  POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
  POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
  serializePostgresAcceptanceEvidence,
} from "../src/postgres-acceptance-evidence";
import {
  POSTGRES_ACCEPTANCE_OFFLINE_VERIFICATION_CHECKS,
  POSTGRES_ACCEPTANCE_OFFLINE_VERIFIER_NOT_PROVEN,
  PostgresAcceptanceEvidenceVerificationError,
  verifyPostgresAcceptanceEvidenceOffline,
  type VerifyPostgresAcceptanceEvidenceOfflineInput,
} from "../src/postgres-acceptance-evidence-verifier";

const SECRET_CANARY = "offline-verifier-secret-canary";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let BASE_INPUT: VerifyPostgresAcceptanceEvidenceOfflineInput;

interface MutableInput {
  evidenceBytes: Uint8Array;
  trustAnchors: {
    evidenceSha256: string;
    repository: string;
    repositoryId: string;
    commitSha: string;
    runId: string;
    runAttempt: number;
  };
  sources: {
    imageConfig: Uint8Array;
    workflow: Uint8Array;
    fixture: Uint8Array;
    migrationManifest: Uint8Array;
    acceptanceRunner: Uint8Array;
    projectionQuery?: Uint8Array;
    projectionNormalizer?: Uint8Array;
    migrations: Array<{ id: string; file: string; bytes: Uint8Array }>;
  };
}

beforeAll(async () => {
  BASE_INPUT = await createValidInput();
});

function bytes(value: string): Uint8Array {
  return encoder.encode(value);
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function exactCopy(value: Uint8Array): Uint8Array {
  return new Uint8Array(value);
}

function cloneInput(): MutableInput {
  return {
    evidenceBytes: exactCopy(BASE_INPUT.evidenceBytes),
    trustAnchors: { ...BASE_INPUT.trustAnchors },
    sources: {
      imageConfig: exactCopy(BASE_INPUT.sources.imageConfig),
      workflow: exactCopy(BASE_INPUT.sources.workflow),
      fixture: exactCopy(BASE_INPUT.sources.fixture),
      migrationManifest: exactCopy(BASE_INPUT.sources.migrationManifest),
      acceptanceRunner: exactCopy(BASE_INPUT.sources.acceptanceRunner),
      projectionQuery: exactCopy(BASE_INPUT.sources.projectionQuery!),
      projectionNormalizer: exactCopy(BASE_INPUT.sources.projectionNormalizer!),
      migrations: BASE_INPUT.sources.migrations.map((migration) => ({
        id: migration.id,
        file: migration.file,
        bytes: exactCopy(migration.bytes),
      })),
    },
  };
}

function canonicalJson(value: unknown): Uint8Array {
  return bytes(`${JSON.stringify(value, null, 2)}\n`);
}

function parsedEvidence(input: VerifyPostgresAcceptanceEvidenceOfflineInput) {
  return JSON.parse(decoder.decode(input.evidenceBytes)) as Record<
    string,
    unknown
  >;
}

function replaceEvidenceBytes(
  input: VerifyPostgresAcceptanceEvidenceOfflineInput,
  replacement: Uint8Array,
): MutableInput {
  const changed = cloneFrom(input);
  changed.evidenceBytes = replacement;
  changed.trustAnchors = {
    ...changed.trustAnchors,
    evidenceSha256: sha256(replacement),
  };
  return changed;
}

function mutateEvidence(
  input: VerifyPostgresAcceptanceEvidenceOfflineInput,
  mutate: (value: Record<string, unknown>) => void,
): MutableInput {
  const value = parsedEvidence(input);
  mutate(value);
  return replaceEvidenceBytes(input, canonicalJson(value));
}

function historicalInput(
  schemaVersion: 1 | 2 | 3,
  checksPassed:
    | typeof POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED
    | typeof POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED
    | typeof POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
  notProven:
    | typeof POSTGRES_ACCEPTANCE_V1_NOT_PROVEN
    | typeof POSTGRES_ACCEPTANCE_V2_NOT_PROVEN
    | typeof POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
): MutableInput {
  const input = mutateEvidence(cloneInput(), (record) => {
    record.schemaVersion = schemaVersion;
    record.checksPassed = [...checksPassed];
    record.notProven = [...notProven];
    const hashes = record.sourceHashes as Record<string, unknown>;
    delete hashes.projectionQuerySha256;
    delete hashes.projectionNormalizerSha256;
  });
  delete input.sources.projectionQuery;
  delete input.sources.projectionNormalizer;
  return input;
}

function replaceCanonicalSourceJson(
  input: VerifyPostgresAcceptanceEvidenceOfflineInput,
  key: "imageConfig" | "migrationManifest",
  mutate: (value: Record<string, unknown>) => void,
  updateRecordedHash: boolean,
): MutableInput {
  const next = cloneFrom(input);
  const value = JSON.parse(decoder.decode(next.sources[key])) as Record<
    string,
    unknown
  >;
  mutate(value);
  const replacement = canonicalJson(value);
  next.sources = { ...next.sources, [key]: replacement };
  if (key === "migrationManifest" && updateRecordedHash) {
    return mutateEvidence(next, (record) => {
      const hashes = record.sourceHashes as Record<string, unknown>;
      hashes.migrationManifestSha256 = sha256(replacement);
    });
  }
  return next;
}

function cloneFrom(
  input: VerifyPostgresAcceptanceEvidenceOfflineInput,
): MutableInput {
  return {
    evidenceBytes: exactCopy(input.evidenceBytes),
    trustAnchors: { ...input.trustAnchors },
    sources: {
      imageConfig: exactCopy(input.sources.imageConfig),
      workflow: exactCopy(input.sources.workflow),
      fixture: exactCopy(input.sources.fixture),
      migrationManifest: exactCopy(input.sources.migrationManifest),
      acceptanceRunner: exactCopy(input.sources.acceptanceRunner),
      ...(input.sources.projectionQuery === undefined
        ? {}
        : { projectionQuery: exactCopy(input.sources.projectionQuery) }),
      ...(input.sources.projectionNormalizer === undefined
        ? {}
        : {
            projectionNormalizer: exactCopy(input.sources.projectionNormalizer),
          }),
      migrations: input.sources.migrations.map((migration) => ({
        id: migration.id,
        file: migration.file,
        bytes: exactCopy(migration.bytes),
      })),
    },
  };
}

function changedByte(value: Uint8Array): Uint8Array {
  const changed = exactCopy(value);
  changed[0] = (changed[0] ?? 0) ^ 1;
  return changed;
}

function expectValueFreeFailure(run: () => unknown): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(PostgresAcceptanceEvidenceVerificationError);
  if (!(caught instanceof PostgresAcceptanceEvidenceVerificationError)) {
    throw new Error("expected PostgresAcceptanceEvidenceVerificationError");
  }
  expect(caught).toMatchObject({
    name: "PostgresAcceptanceEvidenceVerificationError",
    code: "INVALID_POSTGRES_ACCEPTANCE_EVIDENCE_VERIFICATION",
  });
  expect(caught.message).toBe(
    "PostgreSQL acceptance evidence offline verification failed.",
  );
  expect(caught.message).not.toContain(SECRET_CANARY);
  expect(caught).not.toHaveProperty("cause");
  expect(caught).not.toHaveProperty("field");
  expect(caught).not.toHaveProperty("value");
}

describe("offline PostgreSQL acceptance evidence verifier", () => {
  it("returns only the fixed offline-consistency result", () => {
    const result = verifyPostgresAcceptanceEvidenceOffline(cloneInput());
    expect(Object.keys(result)).toEqual([
      "schemaVersion",
      "verdict",
      "evidenceSha256",
      "repository",
      "repositoryId",
      "commitSha",
      "runId",
      "runAttempt",
      "completedAt",
      "verificationChecks",
      "recordedChecksPassed",
      "recordedNotProven",
      "verifierNotProven",
    ]);
    expect(result).toEqual({
      schemaVersion: 1,
      verdict: "offline_consistent",
      evidenceSha256: BASE_INPUT.trustAnchors.evidenceSha256,
      repository: BASE_INPUT.trustAnchors.repository,
      repositoryId: BASE_INPUT.trustAnchors.repositoryId,
      commitSha: BASE_INPUT.trustAnchors.commitSha,
      runId: BASE_INPUT.trustAnchors.runId,
      runAttempt: BASE_INPUT.trustAnchors.runAttempt,
      completedAt: "2026-08-16T02:03:04.567Z",
      verificationChecks: [...POSTGRES_ACCEPTANCE_OFFLINE_VERIFICATION_CHECKS],
      recordedChecksPassed: [...POSTGRES_ACCEPTANCE_CHECKS_PASSED],
      recordedNotProven: [...POSTGRES_ACCEPTANCE_NOT_PROVEN],
      verifierNotProven: [...POSTGRES_ACCEPTANCE_OFFLINE_VERIFIER_NOT_PROVEN],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.verificationChecks)).toBe(true);
    expect(Object.isFrozen(result.recordedChecksPassed)).toBe(true);
    expect(Object.isFrozen(result.recordedNotProven)).toBe(true);
    expect(Object.isFrozen(result.verifierNotProven)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(
      /live_verified|database_verified/,
    );
  });

  it("verifies canonical historical v1 evidence with its v1 claims", () => {
    const input = historicalInput(
      1,
      POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED,
      POSTGRES_ACCEPTANCE_V1_NOT_PROVEN,
    );

    const result = verifyPostgresAcceptanceEvidenceOffline(input);

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V1_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "bounded_container_local_scram_runtime_probe",
    );
  });

  it("verifies canonical historical v2 evidence with its v2 claims", () => {
    const input = historicalInput(
      2,
      POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
      POSTGRES_ACCEPTANCE_V2_NOT_PROVEN,
    );

    const result = verifyPostgresAcceptanceEvidenceOffline(input);

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V2_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_runtime_authorization_matrix",
    );
    expect(result.recordedNotProven).toContain(
      "full_authenticated_runtime_authorization_matrix",
    );
  });

  it("verifies canonical historical v3 evidence without v4 source blobs", () => {
    const input = historicalInput(
      3,
      POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
      POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
    );

    const result = verifyPostgresAcceptanceEvidenceOffline(input);

    expect(result.recordedChecksPassed).toEqual([
      ...POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
    ]);
    expect(result.recordedNotProven).toEqual([
      ...POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
    ]);
    expect(result.recordedChecksPassed).not.toContain(
      "authenticated_financial_fact_projection_query",
    );
  });

  it("rejects evidence that mixes claims and source bundles across versions", () => {
    for (const input of [
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 1;
        record.notProven = [...POSTGRES_ACCEPTANCE_V1_NOT_PROVEN];
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.checksPassed = [...POSTGRES_ACCEPTANCE_V1_CHECKS_PASSED];
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 2;
        record.notProven = [...POSTGRES_ACCEPTANCE_V2_NOT_PROVEN];
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.checksPassed = [...POSTGRES_ACCEPTANCE_V2_CHECKS_PASSED];
      }),
      mutateEvidence(cloneInput(), (record) => {
        record.schemaVersion = 3;
        record.checksPassed = [...POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED];
        record.notProven = [...POSTGRES_ACCEPTANCE_V3_NOT_PROVEN];
      }),
    ]) {
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }
  });

  it("requires the exact version-specific source bundle", () => {
    const missingV4 = cloneInput();
    delete missingV4.sources.projectionQuery;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missingV4),
    );

    const extraHistorical = historicalInput(
      3,
      POSTGRES_ACCEPTANCE_V3_CHECKS_PASSED,
      POSTGRES_ACCEPTANCE_V3_NOT_PROVEN,
    );
    (
      extraHistorical.sources as unknown as Record<string, unknown>
    ).projectionQuery = exactCopy(BASE_INPUT.sources.projectionQuery!);
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extraHistorical),
    );
  });

  it("uses defensive byte copies and does not mutate the input", () => {
    const input = cloneInput();
    const before = structuredClone(input);
    const result = verifyPostgresAcceptanceEvidenceOffline(input);
    expect(input).toEqual(before);
    input.evidenceBytes.fill(0);
    input.sources.workflow.fill(0);
    expect(result.evidenceSha256).toBe(BASE_INPUT.trustAnchors.evidenceSha256);
    expect(result.verdict).toBe("offline_consistent");
  });

  it.each([
    "evidenceSha256",
    "repository",
    "repositoryId",
    "commitSha",
    "runId",
    "runAttempt",
  ] as const)("rejects an independently mismatched %s anchor", (key) => {
    const input = cloneInput();
    const replacements = {
      evidenceSha256: "f".repeat(64),
      repository: "different/repository",
      repositoryId: "999999",
      commitSha: "f".repeat(40),
      runId: "999999",
      runAttempt: 99,
    } as const;
    input.trustAnchors = {
      ...input.trustAnchors,
      [key]: replacements[key],
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(input),
    );
  });

  it.each([
    ["evidenceSha256", `sha256:${"a".repeat(64)}`],
    ["repository", "no-slash"],
    ["repositoryId", "01"],
    ["commitSha", "A".repeat(40)],
    ["runId", "0"],
    ["runAttempt", "1"],
    ["runAttempt", 0],
    ["runAttempt", 1.5],
  ] as const)("rejects malformed anchor %s", (key, replacement) => {
    const input = cloneInput();
    input.trustAnchors = {
      ...input.trustAnchors,
      [key]: replacement,
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(input),
    );
  });

  it("rejects missing, additional, inherited, accessor, and symbol input fields", () => {
    const missing = cloneInput() as unknown as Record<string, unknown>;
    delete missing.sources;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(
        missing as unknown as VerifyPostgresAcceptanceEvidenceOfflineInput,
      ),
    );

    const additional = cloneInput() as unknown as Record<string, unknown>;
    additional.secret = SECRET_CANARY;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(
        additional as unknown as VerifyPostgresAcceptanceEvidenceOfflineInput,
      ),
    );

    const inherited = Object.assign(
      Object.create({ secret: SECRET_CANARY }) as Record<string, unknown>,
      cloneInput(),
    );
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(inherited),
    );

    const accessor = cloneInput() as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, "sources", {
      enumerable: true,
      get() {
        throw new Error(SECRET_CANARY);
      },
    });
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(
        accessor as unknown as VerifyPostgresAcceptanceEvidenceOfflineInput,
      ),
    );

    const symbol = cloneInput() as unknown as Record<PropertyKey, unknown>;
    symbol[Symbol("secret")] = SECRET_CANARY;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(
        symbol as unknown as VerifyPostgresAcceptanceEvidenceOfflineInput,
      ),
    );
  });

  it("rejects non-plain nested records and accessor-backed migration entries", () => {
    const anchorInput = cloneInput();
    const nullPrototypeAnchors = { ...anchorInput.trustAnchors };
    Object.setPrototypeOf(nullPrototypeAnchors, null);
    anchorInput.trustAnchors = nullPrototypeAnchors;
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(anchorInput),
    );

    const sourceInput = cloneInput();
    const migration = sourceInput.sources.migrations[0]!;
    Object.defineProperty(migration, "bytes", {
      enumerable: true,
      get() {
        throw new Error(SECRET_CANARY);
      },
    });
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(sourceInput),
    );
  });

  it("requires genuine bounded Uint8Array values", () => {
    const bufferInput = cloneInput();
    bufferInput.evidenceBytes = Buffer.from(bufferInput.evidenceBytes);
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(bufferInput),
    );

    const decoratedInput = cloneInput();
    Object.defineProperty(decoratedInput.evidenceBytes, "secret", {
      enumerable: true,
      value: SECRET_CANARY,
    });
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(decoratedInput),
    );

    const oversized = cloneInput();
    oversized.evidenceBytes = new Uint8Array(32 * 1024 + 1);
    oversized.trustAnchors = {
      ...oversized.trustAnchors,
      evidenceSha256: sha256(oversized.evidenceBytes),
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(oversized),
    );
  });

  it.each(["leading", "trailing", "compact", "crlf", "bom"] as const)(
    "rejects %s noncanonical evidence bytes even with a matching outer hash",
    (variant) => {
      const input = cloneInput();
      const text = decoder.decode(input.evidenceBytes);
      const replacements = {
        leading: bytes(` ${text}`),
        trailing: bytes(`${text}\n`),
        compact: bytes(JSON.stringify(JSON.parse(text) as unknown)),
        crlf: bytes(text.replaceAll("\n", "\r\n")),
        bom: Uint8Array.from([0xef, 0xbb, 0xbf, ...input.evidenceBytes]),
      };
      const changed = replaceEvidenceBytes(input, replacements[variant]);
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(changed),
      );
    },
  );

  it("rejects duplicate top-level and nested members instead of JSON last-wins", () => {
    for (const duplicate of [
      decoder
        .decode(BASE_INPUT.evidenceBytes)
        .replace(
          '  "repository":',
          `  "repository": "${SECRET_CANARY}/forged",\n  "repository":`,
        ),
      decoder
        .decode(BASE_INPUT.evidenceBytes)
        .replace(
          '    "workflowSha256":',
          `    "workflowSha256": "${"0".repeat(64)}",\n    "workflowSha256":`,
        ),
    ]) {
      const changed = replaceEvidenceBytes(cloneInput(), bytes(duplicate));
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(changed),
      );
    }
  });

  it("rejects canonical records with altered success claims or closed lists", () => {
    const changes: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        value.outcome = "failed";
      },
      (value) => {
        (value.checksPassed as unknown[]).pop();
      },
      (value) => {
        (value.notProven as unknown[]).push(SECRET_CANARY);
      },
      (value) => {
        delete (value.sourceHashes as Record<string, unknown>)
          .acceptanceRunnerSha256;
      },
    ];
    for (const change of changes) {
      const input = mutateEvidence(cloneInput(), change);
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }
  });

  it("rejects malformed UTF-8 before interpreting evidence", () => {
    const input = replaceEvidenceBytes(cloneInput(), Uint8Array.of(0xff));
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(input),
    );
  });

  it("rejects every changed recorded source byte", () => {
    for (const key of [
      "workflow",
      "fixture",
      "migrationManifest",
      "acceptanceRunner",
      "projectionQuery",
      "projectionNormalizer",
    ] as const) {
      const input = cloneInput();
      input.sources = {
        ...input.sources,
        [key]: changedByte(input.sources[key]!),
      };
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }
  });

  it("rejects image target, version, runner, and reviewed-input inconsistencies", () => {
    const changes: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        value.indexDigest = `sha256:${"0".repeat(64)}`;
      },
      (value) => {
        value.reference = `docker.io/library/postgres:17.11-bookworm@sha256:${"0".repeat(64)}`;
      },
      (value) => {
        value.expectedServerVersionNumber = 170012;
      },
      (value) => {
        value.databaseName = "another_database";
      },
      (value) => {
        value.workflowSha256 = "0".repeat(64);
      },
      (value) => {
        (value.runner as Record<string, unknown>).architecture = "arm64";
      },
    ];
    for (const change of changes) {
      const input = replaceCanonicalSourceJson(
        cloneInput(),
        "imageConfig",
        change,
        false,
      );
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }
  });

  it("requires canonical exact-schema image config bytes", () => {
    const noncanonical = cloneInput();
    noncanonical.sources = {
      ...noncanonical.sources,
      imageConfig: bytes(
        ` ${decoder.decode(noncanonical.sources.imageConfig)}`,
      ),
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(noncanonical),
    );

    const extra = replaceCanonicalSourceJson(
      cloneInput(),
      "imageConfig",
      (value) => {
        value.secret = SECRET_CANARY;
      },
      false,
    );
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extra),
    );
  });

  it("requires the manifest and migration source inventories to match exactly", () => {
    const missing = cloneInput();
    missing.sources = {
      ...missing.sources,
      migrations: missing.sources.migrations.slice(1),
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(missing),
    );

    const extra = cloneInput();
    extra.sources = {
      ...extra.sources,
      migrations: [
        ...extra.sources.migrations,
        {
          id: "0008",
          file: "0008_unexpected.sql",
          bytes: bytes("SELECT 1;\n"),
        },
      ],
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extra),
    );

    const reordered = cloneInput();
    reordered.sources = {
      ...reordered.sources,
      migrations: [...reordered.sources.migrations].reverse(),
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(reordered),
    );
  });

  it("rejects migration ID, filename, and exact-byte hash mismatches", () => {
    for (const mutate of [
      (input: MutableInput) => {
        const migrations = [...input.sources.migrations];
        migrations[0] = { ...migrations[0]!, id: "0002" };
        input.sources = { ...input.sources, migrations };
      },
      (input: MutableInput) => {
        const migrations = [...input.sources.migrations];
        migrations[0] = { ...migrations[0]!, file: "0001_wrong.sql" };
        input.sources = { ...input.sources, migrations };
      },
      (input: MutableInput) => {
        const migrations = [...input.sources.migrations];
        migrations[0] = {
          ...migrations[0]!,
          bytes: changedByte(migrations[0]!.bytes),
        };
        input.sources = { ...input.sources, migrations };
      },
    ]) {
      const input = cloneInput();
      mutate(input);
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }
  });

  it("rejects reordered, duplicated, malformed, and mis-hashed manifest entries", () => {
    const changes: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        (value.migrations as unknown[]).reverse();
      },
      (value) => {
        const migrations = value.migrations as Array<Record<string, unknown>>;
        migrations[1] = { ...migrations[0]! };
      },
      (value) => {
        const migrations = value.migrations as Array<Record<string, unknown>>;
        migrations[0]!.file = "0002_wrong_prefix.sql";
      },
      (value) => {
        const migrations = value.migrations as Array<Record<string, unknown>>;
        migrations[0]!.sha256 = "A".repeat(64);
      },
    ];
    for (const change of changes) {
      const input = replaceCanonicalSourceJson(
        cloneInput(),
        "migrationManifest",
        change,
        true,
      );
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }
  });

  it("rejects noncanonical, duplicate-key, and extra-field manifests", () => {
    const text = decoder.decode(BASE_INPUT.sources.migrationManifest);
    for (const replacement of [
      bytes(` ${text}`),
      bytes(
        text.replace(
          '  "algorithm":',
          '  "algorithm": "sha512",\n  "algorithm":',
        ),
      ),
    ]) {
      let input = cloneInput();
      input.sources = { ...input.sources, migrationManifest: replacement };
      input = mutateEvidence(input, (record) => {
        (
          record.sourceHashes as Record<string, unknown>
        ).migrationManifestSha256 = sha256(replacement);
      });
      expectValueFreeFailure(() =>
        verifyPostgresAcceptanceEvidenceOffline(input),
      );
    }

    const extra = replaceCanonicalSourceJson(
      cloneInput(),
      "migrationManifest",
      (value) => {
        value.secret = SECRET_CANARY;
      },
      true,
    );
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(extra),
    );
  });

  it("rejects accessor-backed and symbol-decorated migration arrays", () => {
    const accessor = cloneInput();
    const migrations = [...accessor.sources.migrations];
    Object.defineProperty(migrations, "0", {
      enumerable: true,
      get() {
        throw new Error(SECRET_CANARY);
      },
    });
    accessor.sources = { ...accessor.sources, migrations };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(accessor),
    );

    const symbol = cloneInput();
    const decorated = [...symbol.sources.migrations] as Array<unknown> & {
      [key: symbol]: unknown;
    };
    decorated[Symbol("secret")] = SECRET_CANARY;
    symbol.sources = {
      ...symbol.sources,
      migrations: decorated as unknown as MutableInput["sources"]["migrations"],
    };
    expectValueFreeFailure(() =>
      verifyPostgresAcceptanceEvidenceOffline(symbol),
    );
  });
});

async function createValidInput(): Promise<VerifyPostgresAcceptanceEvidenceOfflineInput> {
  const [
    imageConfig,
    workflow,
    fixture,
    migrationManifest,
    acceptanceRunner,
    projectionQuery,
    projectionNormalizer,
  ] = await Promise.all([
    readExact(new URL("../acceptance/postgres-image.json", import.meta.url)),
    readExact(
      new URL(
        "../../../.github/workflows/postgres-acceptance.yml",
        import.meta.url,
      ),
    ),
    readExact(new URL("../acceptance/synthetic-fixture.sql", import.meta.url)),
    readExact(new URL("../migration-manifest.json", import.meta.url)),
    readExact(new URL("../src/postgres-acceptance.ts", import.meta.url)),
    readExact(new URL("../src/postgres-projection-query.ts", import.meta.url)),
    readExact(new URL("../src/projection-normalization.ts", import.meta.url)),
  ]);
  const image = JSON.parse(decoder.decode(imageConfig)) as {
    reference: string;
    indexDigest: string;
  };
  const manifest = JSON.parse(decoder.decode(migrationManifest)) as {
    migrations: Array<{ id: string; file: string }>;
  };
  const migrationNames = (
    await readdir(new URL("../migrations/", import.meta.url))
  )
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  expect(migrationNames).toEqual(
    manifest.migrations.map((migration) => migration.file),
  );
  const migrations = await Promise.all(
    manifest.migrations.map(async (migration) => ({
      id: migration.id,
      file: migration.file,
      bytes: await readExact(
        new URL(`../migrations/${migration.file}`, import.meta.url),
      ),
    })),
  );

  const repository = "example/research-cockpit";
  const repositoryId = "123456789";
  const commitSha = "b".repeat(40);
  const runId = "9876543210";
  const runAttempt = 2;
  const evidence = buildPostgresAcceptanceEvidence({
    githubEnvironment: {
      CI: "true",
      GITHUB_ACTIONS: "true",
      GITHUB_JOB: "postgres-acceptance",
      GITHUB_WORKFLOW: "PostgreSQL acceptance",
      GITHUB_REPOSITORY: repository,
      GITHUB_REPOSITORY_ID: repositoryId,
      GITHUB_SHA: commitSha,
      GITHUB_RUN_ID: runId,
      GITHUB_RUN_ATTEMPT: String(runAttempt),
      SECRET: SECRET_CANARY,
    },
    reviewedImageReference: image.reference,
    reviewedImageIndexDigest: image.indexDigest,
    toolVersions: {
      postgres: "postgres (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      psql: "psql (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      pgDump: "pg_dump (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
      pgRestore: "pg_restore (PostgreSQL) 17.11 (Debian 17.11-1.pgdg13+1)",
    },
    sourceHashes: {
      workflowSha256: sha256(workflow),
      fixtureSha256: sha256(fixture),
      migrationManifestSha256: sha256(migrationManifest),
      acceptanceRunnerSha256: sha256(acceptanceRunner),
      projectionQuerySha256: sha256(projectionQuery),
      projectionNormalizerSha256: sha256(projectionNormalizer),
    },
    completedAt: "2026-08-16T02:03:04.567Z",
  });
  const evidenceBytes = bytes(serializePostgresAcceptanceEvidence(evidence));
  return {
    evidenceBytes,
    trustAnchors: {
      evidenceSha256: sha256(evidenceBytes),
      repository,
      repositoryId,
      commitSha,
      runId,
      runAttempt,
    },
    sources: {
      imageConfig,
      workflow,
      fixture,
      migrationManifest,
      acceptanceRunner,
      projectionQuery,
      projectionNormalizer,
      migrations,
    },
  };
}

async function readExact(url: URL): Promise<Uint8Array> {
  return new Uint8Array(await readFile(url));
}
