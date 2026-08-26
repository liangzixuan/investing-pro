import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  FilingParserNormalizationExecutionProcessRequest,
  FilingParserNormalizationExecutionProcessResult,
} from "@research-cockpit/filing-parser-normalization-execution";
import { buildSyntheticFilingParserNormalizationExecutionFixture } from "@research-cockpit/filing-parser-normalization-execution/test";

import {
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CHECKS,
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM,
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_NOT_PROVEN,
  createFilingParserCrossEngineDirectExecutionBoundary,
  createFilingParserCrossEngineDirectExecutionBoundaryForTest,
  type FilingParserCrossEngineDirectExecutionConfiguration,
  type FilingParserCrossEngineDirectExecutionResult,
} from "./filing-parser-cross-engine-direct-execution";

const PYTHON_IMAGE = `sha256:${"a".repeat(64)}` as const;
const NODE_IMAGE = `sha256:${"b".repeat(64)}` as const;
const PYTHON_IMPLEMENTATION = `sha256:${"c".repeat(64)}` as const;
const NODE_IMPLEMENTATION = `sha256:${"d".repeat(64)}` as const;
const CONFIGURATION: FilingParserCrossEngineDirectExecutionConfiguration =
  Object.freeze({
    nodeSecondary: Object.freeze({
      engineId: "node-24-secondary-v1",
      imageSha256: NODE_IMAGE,
      implementationSha256: NODE_IMPLEMENTATION,
      role: "node-secondary" as const,
    }),
    pythonPrimary: Object.freeze({
      engineId: "python-3.12-primary-v1",
      imageSha256: PYTHON_IMAGE,
      implementationSha256: PYTHON_IMPLEMENTATION,
      role: "python-primary" as const,
    }),
  });

describe("filing parser cross-engine direct execution", () => {
  it("exports the exact closed claim, checks, and nonclaims", () => {
    expect(FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM).toBe(
      "bounded_synthetic_source_owned_direct_docker_cross_engine_current_input_and_lineage_agreement_with_lifecycle_binding",
    );
    expect(FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CHECKS).toHaveLength(16);
    expect(FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_NOT_PROVEN).toHaveLength(
      16,
    );
    expect(
      Object.isFrozen(FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CHECKS),
    ).toBe(true);
  });

  it("binds four source-owned lifecycles and produces distinct invocations for stable same-input normalization", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    const executor = new SyntheticDockerExecutor(
      fixture.originalDocumentBytes,
      fixture.amendmentDocumentBytes,
    );
    const boundary =
      createFilingParserCrossEngineDirectExecutionBoundaryForTest(
        CONFIGURATION,
        executor,
      );
    const first = await boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    const second = await boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    assertAgreed(first);
    assertAgreed(second);
    expect(second.normalization).toEqual(first.normalization);
    expect(second.provenance.normalizationSha256).toBe(
      first.provenance.normalizationSha256,
    );
    expect(first.provenance.normalizationSha256).toBe(
      `sha256:${createHash("sha256")
        .update(`${canonicalJson(first.normalization)}\n`)
        .digest("hex")}`,
    );
    expect(second.provenance.invocationBindingSha256).not.toBe(
      first.provenance.invocationBindingSha256,
    );
    expect(second.provenance.ephemeralPublicKeySpkiSha256).not.toBe(
      first.provenance.ephemeralPublicKeySpkiSha256,
    );
    const receipts = first.provenance.engineLifecycles.flatMap(
      ({ lifecycles }) => lifecycles,
    );
    expect(receipts).toHaveLength(4);
    expect(receipts.map(({ documentRole }) => documentRole)).toEqual([
      "original",
      "amendment",
      "original",
      "amendment",
    ]);
    expect(
      new Set(receipts.map(({ containerIdSha256 }) => containerIdSha256)).size,
    ).toBe(4);
    expect(receipts.every(({ zeroResidue }) => zeroResidue)).toBe(true);
    for (const receipt of receipts) {
      const { lifecycleBindingSha256, ...preimage } = receipt;
      expect(lifecycleBindingSha256).toBe(
        domainSha256(
          "research-cockpit:synthetic-filing-parser-direct-container-lifecycle:v1\u0000",
          preimage,
        ),
      );
    }
    expect(first.provenance.invocationBindingSha256).toBe(
      domainSha256(
        "research-cockpit:synthetic-filing-parser-direct-cross-engine-invocation:v1\u0000",
        {
          agreementSha256: first.provenance.agreement.agreementSha256,
          executionMode: first.provenance.executionMode,
          keyId: first.provenance.keyId,
          lifecycleReceipts: receipts,
          normalizationSha256: first.provenance.normalizationSha256,
          publicKeySpkiSha256: first.provenance.ephemeralPublicKeySpkiSha256,
        },
      ),
    );
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.provenance)).toBe(true);
  });

  it("rejects public injection keys, accessors, proxies, wrong roles, and aliased declarations", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    const invalidValues: unknown[] = [
      { ...CONFIGURATION, processRunner: {} },
      { ...CONFIGURATION, boundary: {} },
      { ...CONFIGURATION, signer: {} },
      { ...CONFIGURATION, publicKey: new Uint8Array() },
      { ...CONFIGURATION, factory: () => undefined },
      new Proxy(structuredClone(CONFIGURATION), {}),
      {
        nodeSecondary: CONFIGURATION.nodeSecondary,
        get pythonPrimary() {
          return CONFIGURATION.pythonPrimary;
        },
      },
      {
        ...CONFIGURATION,
        pythonPrimary: {
          ...CONFIGURATION.pythonPrimary,
          role: "node-secondary",
        },
      },
      {
        nodeSecondary: {
          ...CONFIGURATION.nodeSecondary,
          imageSha256: PYTHON_IMAGE,
        },
        pythonPrimary: CONFIGURATION.pythonPrimary,
      },
    ];
    for (const invalid of invalidValues) {
      const result = await createFilingParserCrossEngineDirectExecutionBoundary(
        invalid,
      ).execute(fixture.originalArchive, fixture.amendmentArchive);
      assertQuarantined(result);
    }
  });

  it("fails closed for duplicate identity, process, cleanup, residue, signer, and abort failures", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    for (const mode of [
      "duplicate",
      "process",
      "cleanup",
      "residue",
      "timeout",
      "output",
      "throw",
    ] as const) {
      const executor = new SyntheticDockerExecutor(
        fixture.originalDocumentBytes,
        fixture.amendmentDocumentBytes,
        mode,
      );
      assertQuarantined(
        await createFilingParserCrossEngineDirectExecutionBoundaryForTest(
          CONFIGURATION,
          executor,
        ).execute(fixture.originalArchive, fixture.amendmentArchive),
      );
    }
    assertQuarantined(
      await createFilingParserCrossEngineDirectExecutionBoundaryForTest(
        CONFIGURATION,
        new SyntheticDockerExecutor(
          fixture.originalDocumentBytes,
          fixture.amendmentDocumentBytes,
        ),
        () => Promise.reject(new Error("signer canary")),
      ).execute(fixture.originalArchive, fixture.amendmentArchive),
    );
    const controller = new AbortController();
    controller.abort();
    assertQuarantined(
      await createFilingParserCrossEngineDirectExecutionBoundaryForTest(
        CONFIGURATION,
        new SyntheticDockerExecutor(
          fixture.originalDocumentBytes,
          fixture.amendmentDocumentBytes,
        ),
      ).execute(fixture.originalArchive, fixture.amendmentArchive, {
        signal: controller.signal,
      }),
    );
  });

  it("quarantines concurrent execution without starting a second lifecycle", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    const executor = new SyntheticDockerExecutor(
      fixture.originalDocumentBytes,
      fixture.amendmentDocumentBytes,
      "defer",
    );
    const boundary =
      createFilingParserCrossEngineDirectExecutionBoundaryForTest(
        CONFIGURATION,
        executor,
      );
    const first = boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    await executor.started;
    const second = await boundary.execute(
      fixture.originalArchive,
      fixture.amendmentArchive,
    );
    assertQuarantined(second);
    executor.release();
    assertAgreed(await first);
  });
});

type FailureMode =
  | "cleanup"
  | "defer"
  | "duplicate"
  | "output"
  | "process"
  | "residue"
  | "throw"
  | "timeout";

class SyntheticDockerExecutor {
  readonly #containers = new Map<string, { image: string }>();
  readonly #documentCounts = new Map<string, number>();
  #identifier = 0;
  #released = false;
  readonly #releasePromise: Promise<void>;
  readonly #resolveRelease: () => void;
  readonly started: Promise<void>;
  readonly #resolveStarted: () => void;

  public constructor(
    private readonly originalDocument: Uint8Array,
    private readonly amendmentDocument: Uint8Array,
    private readonly mode?: FailureMode,
  ) {
    let resolveRelease = (): void => undefined;
    let resolveStarted = (): void => undefined;
    this.#releasePromise = new Promise((resolve) => {
      resolveRelease = resolve;
    });
    this.started = new Promise((resolve) => {
      resolveStarted = resolve;
    });
    this.#resolveRelease = resolveRelease;
    this.#resolveStarted = resolveStarted;
  }

  public release(): void {
    this.#released = true;
    this.#resolveRelease();
  }

  public async execute(
    request: FilingParserNormalizationExecutionProcessRequest,
  ): Promise<FilingParserNormalizationExecutionProcessResult> {
    const operation = request.args[0];
    if (this.mode === "timeout" && operation === "create")
      return Promise.reject(new Error("timeout canary"));
    if (this.mode === "throw" && operation === "create") throw new TypeError();
    if (this.mode === "process" && operation === "start")
      return processResult("", "failed", 1);
    if (this.mode === "output" && operation === "start")
      return processResult("noncanonical output");
    if (this.mode === "cleanup" && operation === "rm")
      return processResult("", "", 1);
    if (this.mode === "residue" && operation === "container")
      return processResult(`${"f".repeat(64)}\n`);
    if (operation === "create") {
      this.#resolveStarted();
      if (this.mode === "defer" && !this.#released) await this.#releasePromise;
      const name = request.args[request.args.indexOf("--name") + 1];
      const image = request.args.at(-1);
      if (name === undefined || image === undefined) throw new TypeError();
      this.#identifier += 1;
      const identifier =
        this.mode === "duplicate"
          ? "1".repeat(64)
          : this.#identifier.toString(16).padStart(64, "0");
      this.#containers.set(name, { image });
      return processResult(`${identifier}\n`);
    }
    if (operation === "start") {
      const name = request.args[2];
      const container =
        name === undefined ? undefined : this.#containers.get(name);
      if (container === undefined) throw new TypeError();
      const count = this.#documentCounts.get(container.image) ?? 0;
      this.#documentCounts.set(container.image, count + 1);
      return processResult(
        count % 2 === 0 ? this.originalDocument : this.amendmentDocument,
      );
    }
    if (operation === "rm") return processResult("removed\n");
    if (operation === "container") return processResult("");
    throw new TypeError();
  }
}

function processResult(
  stdout: string | Uint8Array,
  stderr: string | Uint8Array = "",
  exitCode = 0,
): FilingParserNormalizationExecutionProcessResult {
  const bytes = (value: string | Uint8Array): Uint8Array =>
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : Uint8Array.from(value);
  return { exitCode, stderr: bytes(stderr), stdout: bytes(stdout) };
}

function assertAgreed(
  value: FilingParserCrossEngineDirectExecutionResult,
): asserts value is Extract<
  FilingParserCrossEngineDirectExecutionResult,
  { status: "agreed" }
> {
  expect(value.status).toBe("agreed");
  if (value.status !== "agreed") throw new TypeError();
}

function assertQuarantined(
  value: FilingParserCrossEngineDirectExecutionResult,
): void {
  expect(value).toEqual({
    claim: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM,
    code: "direct_execution_quarantined",
    schemaVersion: "1.0.0",
    status: "quarantined",
    synthetic: true,
  });
  expect(JSON.stringify(value)).not.toContain("canary");
}

function domainSha256(domain: string, value: object): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(new TextEncoder().encode(domain))
    .update(new TextEncoder().encode(canonicalJson(value)))
    .digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}
