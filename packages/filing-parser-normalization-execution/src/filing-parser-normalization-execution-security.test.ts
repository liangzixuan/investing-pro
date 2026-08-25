import { generateKeyPairSync, sign as ed25519Sign } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  FILING_PARSER_NORMALIZATION_EXECUTION_CLAIM,
  FILING_PARSER_NORMALIZATION_EXECUTION_SCHEMA_VERSION,
  FilingParserNormalizationExecutionConfigurationError,
  createFilingParserNormalizationExecutionBoundary,
  type FilingParserNormalizationExecutionProcessRequest,
  type FilingParserNormalizationExecutionProcessResult,
  type FilingParserNormalizationExecutionProcessRunner,
} from "./filing-parser-normalization-execution";
import { buildSyntheticFilingParserNormalizationExecutionFixture } from "./test-filing-parser-normalization-execution-builder";

const IMAGE = `sha256:${"a".repeat(64)}` as const;
const KEY_ID = "cycle2j-synthetic-ed25519-v1";

describe("filing parser normalization execution security", () => {
  it("returns one value-free quarantine for archive tamper and role swap", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    const tampered = Uint8Array.from(fixture.originalArchive);
    tampered[0] = (tampered[0] ?? 0) ^ 1;
    const tamperedHarness = harness([
      fixture.originalDocumentBytes,
      fixture.amendmentDocumentBytes,
    ]);
    assertQuarantined(
      await tamperedHarness.boundary.execute(
        tampered,
        fixture.amendmentArchive,
      ),
    );
    expect(tamperedHarness.signCalls()).toBe(0);

    const swappedHarness = harness([
      fixture.amendmentDocumentBytes,
      fixture.originalDocumentBytes,
    ]);
    assertQuarantined(
      await swappedHarness.boundary.execute(
        fixture.originalArchive,
        fixture.amendmentArchive,
      ),
    );
    expect(swappedHarness.signCalls()).toBe(0);
  });

  it("validates the complete Cycle 2d fact contract before invoking signer", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    for (const mutate of [
      (document: Record<string, unknown>) => {
        const facts = document.facts as Record<string, unknown>[];
        if (facts[0] !== undefined) facts[0].value = "-0";
      },
      (document: Record<string, unknown>) => {
        const facts = document.facts as Record<string, unknown>[];
        if (facts[4] !== undefined) facts[4].periodEnd = "2025-12-30";
      },
      (document: Record<string, unknown>) => {
        const facts = document.facts as Record<string, unknown>[];
        facts.pop();
      },
    ]) {
      const invalidOriginal = rewriteDocument(
        fixture.originalDocumentBytes,
        mutate,
      );
      const execution = harness([
        invalidOriginal,
        fixture.amendmentDocumentBytes,
      ]);
      assertQuarantined(
        await execution.boundary.execute(
          fixture.originalArchive,
          fixture.amendmentArchive,
        ),
      );
      expect(execution.signCalls()).toBe(0);
    }
  });

  it("rejects hostile carriers, accessors, extra options, and invalid configuration", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    const execution = harness([
      fixture.originalDocumentBytes,
      fixture.amendmentDocumentBytes,
    ]);
    assertQuarantined(
      await execution.boundary.execute(
        new Proxy(fixture.originalArchive, {}),
        fixture.amendmentArchive,
      ),
    );
    assertQuarantined(
      await execution.boundary.execute(
        Buffer.from(fixture.originalArchive),
        fixture.amendmentArchive,
      ),
    );
    assertQuarantined(
      await execution.boundary.execute(
        fixture.originalArchive,
        fixture.amendmentArchive,
        { extra: true } as never,
      ),
    );
    expect(() =>
      createFilingParserNormalizationExecutionBoundary({
        extra: true,
        imageSha256: IMAGE,
        publicKeySpki: execution.publicKeySpki,
        signer: execution.signer,
      }),
    ).toThrow(FilingParserNormalizationExecutionConfigurationError);
    const accessor = {
      algorithm: "ed25519",
      keyId: KEY_ID,
      get sign(): () => Promise<Uint8Array> {
        throw new Error("must not run");
      },
    };
    expect(() =>
      createFilingParserNormalizationExecutionBoundary({
        imageSha256: IMAGE,
        publicKeySpki: execution.publicKeySpki,
        signer: accessor,
      }),
    ).toThrow(FilingParserNormalizationExecutionConfigurationError);
  });

  it("requires create, start, remove, and exact residue checks to succeed", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    for (const failOperation of ["create", "start", "rm", "container"]) {
      const runner = new ScriptedRunner(
        [fixture.originalDocumentBytes, fixture.amendmentDocumentBytes],
        (request) =>
          request.args[0] === failOperation
            ? result("", "", failOperation === "create" ? 1 : 2)
            : undefined,
      );
      const execution = harness(
        [fixture.originalDocumentBytes, fixture.amendmentDocumentBytes],
        { runner },
      );
      assertQuarantined(
        await execution.boundary.execute(
          fixture.originalArchive,
          fixture.amendmentArchive,
        ),
      );
    }
    const residueRunner = new ScriptedRunner(
      [fixture.originalDocumentBytes, fixture.amendmentDocumentBytes],
      (request) =>
        request.args[0] === "container"
          ? result(`${"c".repeat(64)}\n`)
          : undefined,
    );
    const residueExecution = harness(
      [fixture.originalDocumentBytes, fixture.amendmentDocumentBytes],
      { runner: residueRunner },
    );
    assertQuarantined(
      await residueExecution.boundary.execute(
        fixture.originalArchive,
        fixture.amendmentArchive,
      ),
    );
  });

  it("waits for abort-responsive create settlement before cleanup", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    const controller = new AbortController();
    const events: string[] = [];
    let createStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      createStarted = resolve;
    });
    const runner = new ScriptedRunner(
      [fixture.originalDocumentBytes, fixture.amendmentDocumentBytes],
      (request) => {
        if (request.args[0] === "create") {
          events.push("create_started");
          createStarted?.();
          return new Promise<FilingParserNormalizationExecutionProcessResult>(
            (resolve) => {
              request.signal?.addEventListener(
                "abort",
                () => {
                  events.push("create_aborted");
                  setTimeout(() => {
                    events.push("create_settled");
                    resolve(result("", "", 1));
                  }, 10);
                },
                { once: true },
              );
            },
          );
        }
        if (request.args[0] === "rm") events.push("remove");
        if (request.args[0] === "container") events.push("residue");
        return undefined;
      },
    );
    const execution = harness(
      [fixture.originalDocumentBytes, fixture.amendmentDocumentBytes],
      { runner },
    );
    const pending = execution.boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
      { signal: controller.signal },
    );
    await started;
    controller.abort();
    assertQuarantined(await pending);
    expect(events).toEqual([
      "create_started",
      "create_aborted",
      "create_settled",
      "remove",
      "residue",
    ]);
  });

  it("bounds a never-settling injected process runner and absorbs late work", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    let first = true;
    const runner = new ScriptedRunner(
      [fixture.originalDocumentBytes, fixture.amendmentDocumentBytes],
      (request) => {
        if (first && request.args[0] === "create") {
          first = false;
          return new Promise<FilingParserNormalizationExecutionProcessResult>(
            () => undefined,
          );
        }
        return undefined;
      },
    );
    const execution = harness(
      [fixture.originalDocumentBytes, fixture.amendmentDocumentBytes],
      { runner },
    );
    assertQuarantined(
      await execution.boundary.execute(
        fixture.originalArchive,
        fixture.amendmentArchive,
      ),
    );
    expect(runner.operations()).toContain("rm");
    expect(runner.operations()).toContain("container");
  }, 7_000);

  it("aborts a never-settling signer and remains reusable", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    const controller = new AbortController();
    const execution = harness(
      [fixture.originalDocumentBytes, fixture.amendmentDocumentBytes],
      {
        onSign: () => {
          controller.abort();
          return new Promise<Uint8Array>(() => undefined);
        },
      },
    );
    assertQuarantined(
      await execution.boundary.execute(
        fixture.originalArchive,
        fixture.amendmentArchive,
        { signal: controller.signal },
      ),
    );
    const replay = harness([
      fixture.originalDocumentBytes,
      fixture.amendmentDocumentBytes,
    ]);
    expect(
      await replay.boundary.execute(
        fixture.originalArchive,
        fixture.amendmentArchive,
      ),
    ).toMatchObject({ status: "normalized" });
  });

  it("times out a never-settling signer without exposing a partial result", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    const execution = harness(
      [fixture.originalDocumentBytes, fixture.amendmentDocumentBytes],
      { onSign: () => new Promise<Uint8Array>(() => undefined) },
    );
    assertQuarantined(
      await execution.boundary.execute(
        fixture.originalArchive,
        fixture.amendmentArchive,
      ),
    );
    expect(execution.signCalls()).toBe(1);
  }, 7_000);

  it("returns busy quarantine while preserving the first atomic execution", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let firstStart = true;
    const runner = new ScriptedRunner(
      [fixture.originalDocumentBytes, fixture.amendmentDocumentBytes],
      async (request) => {
        if (firstStart && request.args[0] === "start") {
          firstStart = false;
          await blocked;
        }
        return undefined;
      },
    );
    const execution = harness(
      [fixture.originalDocumentBytes, fixture.amendmentDocumentBytes],
      { runner },
    );
    const first = execution.boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    await vi.waitFor(() => expect(runner.operations()).toContain("start"));
    assertQuarantined(
      await execution.boundary.execute(
        fixture.originalArchive,
        fixture.amendmentArchive,
      ),
    );
    release?.();
    expect(await first).toMatchObject({ status: "normalized" });
  });
});

function harness(
  documents: readonly Uint8Array[],
  overrides: {
    readonly onSign?: (payload: Uint8Array) => Promise<Uint8Array>;
    readonly runner?: FilingParserNormalizationExecutionProcessRunner;
  } = {},
): {
  readonly boundary: ReturnType<
    typeof createFilingParserNormalizationExecutionBoundary
  >;
  readonly publicKeySpki: Uint8Array;
  readonly signCalls: () => number;
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
  let calls = 0;
  const signer = {
    algorithm: "ed25519" as const,
    keyId: KEY_ID,
    async sign(payload: Uint8Array): Promise<Uint8Array> {
      calls += 1;
      if (overrides.onSign !== undefined) return overrides.onSign(payload);
      return Uint8Array.from(ed25519Sign(null, payload, privateKey));
    },
  };
  const boundary = createFilingParserNormalizationExecutionBoundary({
    imageSha256: IMAGE,
    processRunner: overrides.runner ?? new ScriptedRunner(documents),
    publicKeySpki,
    signer,
  });
  return { boundary, publicKeySpki, signCalls: () => calls, signer };
}

class ScriptedRunner implements FilingParserNormalizationExecutionProcessRunner {
  readonly #operations: string[] = [];
  #startIndex = 0;

  public constructor(
    private readonly documents: readonly Uint8Array[],
    private readonly override?: (
      request: FilingParserNormalizationExecutionProcessRequest,
    ) =>
      | FilingParserNormalizationExecutionProcessResult
      | Promise<FilingParserNormalizationExecutionProcessResult | undefined>
      | undefined,
  ) {}

  public operations(): readonly string[] {
    return this.#operations;
  }

  public async run(
    request: FilingParserNormalizationExecutionProcessRequest,
  ): Promise<FilingParserNormalizationExecutionProcessResult> {
    const operation = request.args[0] ?? "";
    this.#operations.push(operation);
    const overridden = await this.override?.(request);
    if (overridden !== undefined) return overridden;
    if (operation === "create") return result(`${"b".repeat(64)}\n`);
    if (operation === "start") {
      const document = this.documents[this.#startIndex];
      this.#startIndex += 1;
      return document === undefined ? result("", "", 1) : result(document);
    }
    if (operation === "rm") return result("removed\n");
    if (operation === "container") return result("");
    return result("", "", 1);
  }
}

function result(
  stdoutValue: string | Uint8Array,
  stderrValue: string | Uint8Array = "",
  exitCode = 0,
): FilingParserNormalizationExecutionProcessResult {
  const encode = (value: string | Uint8Array): Uint8Array =>
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : Uint8Array.from(value);
  return { exitCode, stderr: encode(stderrValue), stdout: encode(stdoutValue) };
}

function rewriteDocument(
  bytes: Uint8Array,
  mutate: (document: Record<string, unknown>) => void,
): Uint8Array {
  const document = JSON.parse(new TextDecoder().decode(bytes)) as Record<
    string,
    unknown
  >;
  mutate(document);
  return new TextEncoder().encode(`${canonicalJson(document)}\n`);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null) throw new TypeError();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function assertQuarantined(value: unknown): void {
  expect(value).toEqual({
    claim: FILING_PARSER_NORMALIZATION_EXECUTION_CLAIM,
    code: "execution_quarantined",
    normalization: null,
    provenance: null,
    schemaVersion: FILING_PARSER_NORMALIZATION_EXECUTION_SCHEMA_VERSION,
    status: "quarantined",
    synthetic: true,
  });
  expect(JSON.stringify(value)).not.toContain("120000000");
}
