import { describe, expect, it } from "vitest";

import { buildSyntheticFilingParserNormalizationExecutionFixture } from "@research-cockpit/filing-parser-normalization-execution/test";

import {
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM,
  createFilingParserCrossEngineDirectExecutionBoundary,
} from "./index";

const HASH_A = `sha256:${"a".repeat(64)}` as const;
const HASH_B = `sha256:${"b".repeat(64)}` as const;
const HASH_C = `sha256:${"c".repeat(64)}` as const;
const HASH_D = `sha256:${"d".repeat(64)}` as const;

describe("filing parser cross-engine direct execution security", () => {
  it("never admits caller-owned execution capabilities through the public configuration", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    for (const injected of [
      { boundary: { execute: () => undefined } },
      { processRunner: { run: () => undefined } },
      { signer: { sign: () => undefined } },
      { publicKey: new Uint8Array([1]) },
      { executionCallback: () => undefined },
    ]) {
      const result = await createFilingParserCrossEngineDirectExecutionBoundary(
        {
          ...configuration(),
          ...injected,
        },
      ).execute(fixture.originalArchive, fixture.amendmentArchive);
      expect(result).toEqual(quarantined());
      expect(Object.isFrozen(result)).toBe(true);
    }
  });

  it("rejects hostile descriptors and proxies without invoking attacker code", async () => {
    const fixture = buildSyntheticFilingParserNormalizationExecutionFixture();
    let getterCalls = 0;
    const hostile = {
      nodeSecondary: configuration().nodeSecondary,
      get pythonPrimary() {
        getterCalls += 1;
        throw new Error("descriptor canary");
      },
    };
    expect(
      await createFilingParserCrossEngineDirectExecutionBoundary(
        hostile,
      ).execute(fixture.originalArchive, fixture.amendmentArchive),
    ).toEqual(quarantined());
    expect(getterCalls).toBe(0);
    expect(
      await createFilingParserCrossEngineDirectExecutionBoundary(
        new Proxy(configuration(), {
          ownKeys() {
            throw new Error("proxy canary");
          },
        }),
      ).execute(fixture.originalArchive, fixture.amendmentArchive),
    ).toEqual(quarantined());
  });
});

function configuration() {
  return {
    nodeSecondary: {
      engineId: "node-24-secondary-v1",
      imageSha256: HASH_B,
      implementationSha256: HASH_D,
      role: "node-secondary" as const,
    },
    pythonPrimary: {
      engineId: "python-3.12-primary-v1",
      imageSha256: HASH_A,
      implementationSha256: HASH_C,
      role: "python-primary" as const,
    },
  };
}

function quarantined() {
  return {
    claim: FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CLAIM,
    code: "direct_execution_quarantined",
    schemaVersion: "1.0.0",
    status: "quarantined",
    synthetic: true,
  };
}
