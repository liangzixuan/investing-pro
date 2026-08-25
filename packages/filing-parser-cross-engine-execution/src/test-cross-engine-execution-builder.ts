import { generateKeyPairSync, sign as ed25519Sign } from "node:crypto";

import {
  createFilingParserNormalizationExecutionBoundary,
  type FilingParserNormalizationExecutionBoundary,
  type FilingParserNormalizationExecutionProcessRequest,
  type FilingParserNormalizationExecutionProcessResult,
  type FilingParserNormalizationExecutionProcessRunner,
  type FilingParserNormalizationExecutionResult,
  type FilingParserNormalizationExecutionSuccess,
} from "@research-cockpit/filing-parser-normalization-execution";
import { buildSyntheticFilingParserNormalizationExecutionFixture } from "@research-cockpit/filing-parser-normalization-execution/test";

import type { FilingParserCrossEngineExecutionConfiguration } from "./filing-parser-cross-engine-execution";

export const PYTHON_IMAGE = `sha256:${"a".repeat(64)}` as const;
export const NODE_IMAGE = `sha256:${"b".repeat(64)}` as const;
export const PYTHON_IMPLEMENTATION = `sha256:${"c".repeat(64)}` as const;
export const NODE_IMPLEMENTATION = `sha256:${"d".repeat(64)}` as const;

export class StaticExecutionBoundary implements FilingParserNormalizationExecutionBoundary {
  public readonly calls: Array<{
    amendment: Uint8Array;
    original: Uint8Array;
    signal: AbortSignal | undefined;
  }> = [];
  public mutateInputs = false;
  public outcome:
    | FilingParserNormalizationExecutionResult
    | (() =>
        | FilingParserNormalizationExecutionResult
        | Promise<FilingParserNormalizationExecutionResult>);

  public constructor(
    outcome:
      | FilingParserNormalizationExecutionResult
      | (() =>
          | FilingParserNormalizationExecutionResult
          | Promise<FilingParserNormalizationExecutionResult>),
  ) {
    this.outcome = outcome;
  }

  public async execute(
    originalArchive: unknown,
    amendmentArchive: unknown,
    options?: { readonly signal?: AbortSignal },
  ): Promise<FilingParserNormalizationExecutionResult> {
    if (
      !(originalArchive instanceof Uint8Array) ||
      !(amendmentArchive instanceof Uint8Array)
    )
      throw new TypeError();
    this.calls.push({
      amendment: amendmentArchive,
      original: originalArchive,
      signal: options?.signal,
    });
    if (this.mutateInputs) {
      originalArchive.fill(0);
      amendmentArchive.fill(0);
    }
    return typeof this.outcome === "function" ? this.outcome() : this.outcome;
  }
}

export interface CrossEngineTestHarness {
  readonly amendmentArchive: Uint8Array;
  readonly configuration: FilingParserCrossEngineExecutionConfiguration;
  readonly node: StaticExecutionBoundary;
  readonly nodeResult: FilingParserNormalizationExecutionSuccess;
  readonly originalArchive: Uint8Array;
  readonly python: StaticExecutionBoundary;
  readonly pythonResult: FilingParserNormalizationExecutionSuccess;
}

export async function buildCrossEngineTestHarness(): Promise<CrossEngineTestHarness> {
  const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
  const pythonResult = await buildExecutionResult(
    PYTHON_IMAGE,
    "cycle2k-python-ed25519-v1",
    fixture.originalDocumentBytes,
    fixture.amendmentDocumentBytes,
  );
  const nodeResult = await buildExecutionResult(
    NODE_IMAGE,
    "cycle2k-node-ed25519-v1",
    fixture.originalDocumentBytes,
    fixture.amendmentDocumentBytes,
  );
  const python = new StaticExecutionBoundary(pythonResult);
  const node = new StaticExecutionBoundary(nodeResult);
  return {
    amendmentArchive: fixture.amendmentArchive,
    configuration: {
      nodeSecondary: {
        boundary: node,
        engineId: "node-24-secondary-v1",
        imageSha256: NODE_IMAGE,
        implementationSha256: NODE_IMPLEMENTATION,
        role: "node-secondary",
      },
      pythonPrimary: {
        boundary: python,
        engineId: "python-3.12-primary-v1",
        imageSha256: PYTHON_IMAGE,
        implementationSha256: PYTHON_IMPLEMENTATION,
        role: "python-primary",
      },
    },
    node,
    nodeResult,
    originalArchive: fixture.originalArchive,
    python,
    pythonResult,
  };
}

async function buildExecutionResult(
  imageSha256: `sha256:${string}`,
  keyId: string,
  originalDocument: Uint8Array,
  amendmentDocument: Uint8Array,
): Promise<FilingParserNormalizationExecutionSuccess> {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const boundary = createFilingParserNormalizationExecutionBoundary({
    imageSha256,
    processRunner: new DocumentRunner([originalDocument, amendmentDocument]),
    publicKeySpki: Uint8Array.from(
      publicKey.export({ format: "der", type: "spki" }),
    ),
    signer: {
      algorithm: "ed25519",
      keyId,
      sign(payload: Uint8Array): Promise<Uint8Array> {
        return Promise.resolve(
          Uint8Array.from(ed25519Sign(null, payload, privateKey)),
        );
      },
    },
  });
  const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
  const result = await boundary.execute(
    fixture.originalArchive,
    fixture.amendmentArchive,
  );
  if (result.status !== "normalized") throw new Error("test setup failed");
  return result;
}

class DocumentRunner implements FilingParserNormalizationExecutionProcessRunner {
  #start = 0;

  public constructor(private readonly documents: readonly Uint8Array[]) {}

  public run(
    request: FilingParserNormalizationExecutionProcessRequest,
  ): Promise<FilingParserNormalizationExecutionProcessResult> {
    const operation = request.args[0];
    if (operation === "create")
      return Promise.resolve(result(`${"e".repeat(64)}\n`));
    if (operation === "start") {
      const document = this.documents[this.#start];
      this.#start += 1;
      return Promise.resolve(
        document === undefined
          ? result("", "unexpected start", 1)
          : result(document),
      );
    }
    if (operation === "rm") return Promise.resolve(result("removed\n"));
    if (operation === "container") return Promise.resolve(result(""));
    return Promise.resolve(result("", "unexpected command", 1));
  }
}

function result(
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
