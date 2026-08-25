import {
  generateKeyPairSync,
  sign as ed25519Sign,
  type KeyObject,
} from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  FILING_PARSER_NORMALIZATION_EXECUTION_CHECKS,
  FILING_PARSER_NORMALIZATION_EXECUTION_CLAIM,
  FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL,
  FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS,
  FILING_PARSER_NORMALIZATION_EXECUTION_NOT_PROVEN,
  FILING_PARSER_NORMALIZATION_EXECUTION_SCHEMA_VERSION,
  createFilingParserNormalizationExecutionBoundary,
  type FilingParserNormalizationExecutionProcessRequest,
  type FilingParserNormalizationExecutionProcessResult,
  type FilingParserNormalizationExecutionProcessRunner,
} from "./filing-parser-normalization-execution";
import { buildSyntheticFilingParserNormalizationExecutionFixture } from "./test-filing-parser-normalization-execution-builder";

describe("filing parser normalization execution", () => {
  it("freezes the exact Cycle 2j claim, checks, nonclaims, and limits", () => {
    expect(FILING_PARSER_NORMALIZATION_EXECUTION_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_PARSER_NORMALIZATION_EXECUTION_CLAIM).toBe(
      "bounded_synthetic_one_shot_ten_fact_parser_execution_to_authenticated_normalization_handoff",
    );
    expect(FILING_PARSER_NORMALIZATION_EXECUTION_CONTAINER_LABEL).toBe(
      "research-cockpit.boundary=filing-parser-normalization-execution-v1",
    );
    expect(FILING_PARSER_NORMALIZATION_EXECUTION_CHECKS).toHaveLength(16);
    expect(FILING_PARSER_NORMALIZATION_EXECUTION_NOT_PROVEN).toHaveLength(16);
    expect(FILING_PARSER_NORMALIZATION_EXECUTION_LIMITS).toMatchObject({
      archiveBytes: 1_048_576,
      archives: 2,
      containers: 2,
      cpuCount: 0.5,
      memoryBytes: 134_217_728,
      processTerminationMilliseconds: 250,
      signerMilliseconds: 5_000,
      workerWallMilliseconds: 5_000,
    });
    expect(Object.isFrozen(FILING_PARSER_NORMALIZATION_EXECUTION_CHECKS)).toBe(
      true,
    );
  });

  it("executes, signs, and delegates one exact original/amendment pair", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    const runner = new DocumentRunner([
      fixture.originalDocumentBytes,
      fixture.amendmentDocumentBytes,
    ]);
    const signing = signingHarness();
    const boundary = createFilingParserNormalizationExecutionBoundary({
      imageSha256: TEST_IMAGE,
      processRunner: runner,
      publicKeySpki: signing.publicKeySpki,
      signer: signing.signer,
    });

    const result = await boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );

    expect(result.status).toBe("normalized");
    if (result.status !== "normalized") throw new Error("expected success");
    expect(result.normalization.audit).toEqual({
      factVersionCount: 20,
      lineageCount: 10,
      outcome: "normalized",
    });
    expect(result.provenance).toMatchObject({
      archiveCount: 2,
      containerCount: 2,
      documentCount: 2,
      imageSha256: TEST_IMAGE,
      keyId: TEST_KEY_ID,
    });
    expect(result.provenance.executionBindingSha256).toMatch(
      /^sha256:[0-9a-f]{64}$/u,
    );
    expect(signing.calls()).toBe(2);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.provenance)).toBe(true);
    expect(runner.startCount).toBe(2);
    expect(runner.removeCount).toBe(2);
    expect(runner.residueCount).toBe(2);
    for (const create of runner.requests.filter(
      ({ args }) => args[0] === "create",
    )) {
      expect(create.args).toContain("--network");
      expect(create.args).toContain("none");
      expect(create.args).toContain("--read-only");
      expect(create.args).toContain("ALL");
      expect(create.args).toContain("65532:65532");
      expect(create.args.at(-1)).toBe(TEST_IMAGE);
    }
  });

  it("is deterministic across fresh runner and boundary instances", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    const signing = signingHarness();
    const execute = async () =>
      createFilingParserNormalizationExecutionBoundary({
        imageSha256: TEST_IMAGE,
        processRunner: new DocumentRunner([
          fixture.originalDocumentBytes,
          fixture.amendmentDocumentBytes,
        ]),
        publicKeySpki: signing.publicKeySpki,
        signer: signing.signer,
      }).execute(fixture.originalArchive, fixture.amendmentArchive);
    const first = await execute();
    const second = await execute();
    expect(first.status).toBe("normalized");
    expect(second).toEqual(first);
  });

  it("supports the production default runner configuration shape", () => {
    const signing = signingHarness();
    expect(() =>
      createFilingParserNormalizationExecutionBoundary({
        imageSha256: TEST_IMAGE,
        publicKeySpki: signing.publicKeySpki,
        signer: signing.signer,
      }),
    ).not.toThrow();
  });
});

export const TEST_IMAGE = `sha256:${"a".repeat(64)}` as const;
export const TEST_KEY_ID = "cycle2j-synthetic-ed25519-v1";

export function signingHarness(): {
  readonly calls: () => number;
  readonly privateKey: KeyObject;
  readonly publicKeySpki: Uint8Array;
  readonly signer: {
    readonly algorithm: "ed25519";
    readonly keyId: string;
    sign(payload: Uint8Array): Promise<Uint8Array>;
  };
} {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeySpki = Uint8Array.from(
    publicKey.export({ format: "der", type: "spki" }),
  );
  let count = 0;
  return {
    calls: () => count,
    privateKey,
    publicKeySpki,
    signer: {
      algorithm: "ed25519",
      keyId: TEST_KEY_ID,
      sign(payload: Uint8Array): Promise<Uint8Array> {
        count += 1;
        return Promise.resolve(
          Uint8Array.from(ed25519Sign(null, payload, privateKey)),
        );
      },
    },
  };
}

export class DocumentRunner implements FilingParserNormalizationExecutionProcessRunner {
  public readonly requests: FilingParserNormalizationExecutionProcessRequest[] =
    [];
  public removeCount = 0;
  public residueCount = 0;
  public startCount = 0;

  public constructor(private readonly documents: readonly Uint8Array[]) {}

  public run(
    request: FilingParserNormalizationExecutionProcessRequest,
  ): Promise<FilingParserNormalizationExecutionProcessResult> {
    this.requests.push(request);
    const operation = request.args[0];
    if (operation === "create")
      return Promise.resolve(processResult(`${"b".repeat(64)}\n`));
    if (operation === "start") {
      const document = this.documents[this.startCount];
      this.startCount += 1;
      return Promise.resolve(
        document === undefined
          ? processResult("", "unexpected start", 1)
          : processResult(document),
      );
    }
    if (operation === "rm") {
      this.removeCount += 1;
      return Promise.resolve(processResult("removed\n"));
    }
    if (operation === "container") {
      this.residueCount += 1;
      return Promise.resolve(processResult(""));
    }
    return Promise.resolve(processResult("", "unexpected command", 1));
  }
}

export function processResult(
  stdoutValue: string | Uint8Array,
  stderrValue: string | Uint8Array = "",
  exitCode = 0,
): FilingParserNormalizationExecutionProcessResult {
  const encode = (value: string | Uint8Array): Uint8Array =>
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : Uint8Array.from(value);
  return {
    exitCode,
    stderr: encode(stderrValue),
    stdout: encode(stdoutValue),
  };
}
