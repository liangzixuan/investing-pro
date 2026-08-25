import { describe, expect, it } from "vitest";

import type { FilingParserNormalizationExecutionResult } from "@research-cockpit/filing-parser-normalization-execution";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_CLAIM,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_SCHEMA_VERSION,
  createFilingParserCrossEngineExecutionBoundary,
  type FilingParserCrossEngineExecutionResult,
} from "./filing-parser-cross-engine-execution";
import { buildCrossEngineTestHarness } from "./test-cross-engine-execution-builder";

describe("filing parser cross-engine execution security", () => {
  it("fails closed when either engine quarantines or throws", async () => {
    for (const engine of ["python", "node"] as const) {
      const harness = await buildCrossEngineTestHarness();
      const target = engine === "python" ? harness.python : harness.node;
      target.outcome = {
        claim:
          "bounded_synthetic_one_shot_ten_fact_parser_execution_to_authenticated_normalization_handoff",
        code: "execution_quarantined",
        normalization: null,
        provenance: null,
        schemaVersion: "1.0.0",
        status: "quarantined",
        synthetic: true,
      };
      assertQuarantined(
        await createFilingParserCrossEngineExecutionBoundary(
          harness.configuration,
        ).execute(harness.originalArchive, harness.amendmentArchive),
      );
    }

    const harness = await buildCrossEngineTestHarness();
    harness.python.outcome = () => {
      throw new Error("canary secret and sha256:deadbeef");
    };
    const result = await createFilingParserCrossEngineExecutionBoundary(
      harness.configuration,
    ).execute(harness.originalArchive, harness.amendmentArchive);
    assertQuarantined(result);
    expect(JSON.stringify(result)).not.toContain("canary");
    expect(harness.node.calls).toHaveLength(0);
  });

  it("quarantines exact normalized-record mismatch without primary preference", async () => {
    const harness = await buildCrossEngineTestHarness();
    const mismatch = structuredClone(harness.nodeResult) as unknown as Record<
      string,
      unknown
    >;
    const mismatchNormalization = mismatch.normalization as Record<
      string,
      unknown
    >;
    const mismatchVersions = mismatchNormalization.factVersions as Record<
      string,
      unknown
    >[];
    mismatchVersions[0]!.value = "999999999";
    harness.node.outcome =
      mismatch as unknown as FilingParserNormalizationExecutionResult;
    assertQuarantined(
      await createFilingParserCrossEngineExecutionBoundary(
        harness.configuration,
      ).execute(harness.originalArchive, harness.amendmentArchive),
    );
  });

  it("quarantines wrong images, equal execution bindings, and malformed provenance", async () => {
    const mutations: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        (value.provenance as Record<string, unknown>).imageSha256 =
          `sha256:${"f".repeat(64)}`;
      },
      (value) => {
        (value.provenance as Record<string, unknown>).extra = true;
      },
      (value) => {
        const provenance = value.provenance as Record<string, unknown>;
        (provenance.handoff as Record<string, unknown>).imageSha256 =
          `sha256:${"f".repeat(64)}`;
      },
      (value) => {
        (value.provenance as Record<string, unknown>).executionBindingSha256 =
          "not-a-digest";
      },
    ];
    for (const mutate of mutations) {
      const harness = await buildCrossEngineTestHarness();
      const invalid = structuredClone(harness.nodeResult) as unknown as Record<
        string,
        unknown
      >;
      mutate(invalid);
      harness.node.outcome =
        invalid as unknown as FilingParserNormalizationExecutionResult;
      assertQuarantined(
        await createFilingParserCrossEngineExecutionBoundary(
          harness.configuration,
        ).execute(harness.originalArchive, harness.amendmentArchive),
      );
    }

    const equal = await buildCrossEngineTestHarness();
    const equalBinding = structuredClone(equal.nodeResult) as unknown as Record<
      string,
      unknown
    >;
    (
      equalBinding.provenance as Record<string, unknown>
    ).executionBindingSha256 =
      equal.pythonResult.provenance.executionBindingSha256;
    equal.node.outcome =
      equalBinding as unknown as FilingParserNormalizationExecutionResult;
    assertQuarantined(
      await createFilingParserCrossEngineExecutionBoundary(
        equal.configuration,
      ).execute(equal.originalArchive, equal.amendmentArchive),
    );
  });

  it("strictly rejects malformed normalization carriers", async () => {
    const mutations: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        (value.normalization as Record<string, unknown>).extra = true;
      },
      (value) => {
        const normalization = value.normalization as Record<string, unknown>;
        (normalization.audit as Record<string, unknown>).factVersionCount = 19;
      },
      (value) => {
        const normalization = value.normalization as Record<string, unknown>;
        (normalization.factVersions as unknown[]).pop();
      },
      (value) => {
        const normalization = value.normalization as Record<string, unknown>;
        const versions = normalization.factVersions as Record<
          string,
          unknown
        >[];
        versions[0]!.key = "unknown";
      },
      (value) => {
        const normalization = value.normalization as Record<string, unknown>;
        const lineage = normalization.lineage as Record<string, unknown>[];
        lineage[0]!.effectiveAt = "2026-02-31T00:00:00.000Z";
      },
    ];
    for (const mutate of mutations) {
      const harness = await buildCrossEngineTestHarness();
      const invalid = structuredClone(
        harness.pythonResult,
      ) as unknown as Record<string, unknown>;
      mutate(invalid);
      harness.python.outcome =
        invalid as unknown as FilingParserNormalizationExecutionResult;
      assertQuarantined(
        await createFilingParserCrossEngineExecutionBoundary(
          harness.configuration,
        ).execute(harness.originalArchive, harness.amendmentArchive),
      );
      expect(harness.node.calls).toHaveLength(0);
    }
  });

  it("rejects accessors, proxies, subclasses, Buffer, and shared backing", async () => {
    const harness = await buildCrossEngineTestHarness();
    const boundary = createFilingParserCrossEngineExecutionBoundary(
      harness.configuration,
    );
    class DerivedBytes extends Uint8Array {}
    const hostileInputs: unknown[] = [
      Buffer.from(harness.originalArchive),
      new DerivedBytes(harness.originalArchive),
      new Proxy(harness.originalArchive.slice(), {}),
      new Uint8Array(new SharedArrayBuffer(harness.originalArchive.byteLength)),
    ];
    for (const hostile of hostileInputs) {
      assertQuarantined(
        await boundary.execute(hostile, harness.amendmentArchive),
      );
    }

    const accessor = structuredClone(harness.pythonResult) as unknown as Record<
      string,
      unknown
    >;
    Object.defineProperty(accessor, "normalization", {
      enumerable: true,
      get: () => harness.pythonResult.normalization,
    });
    harness.python.outcome =
      accessor as unknown as FilingParserNormalizationExecutionResult;
    assertQuarantined(
      await boundary.execute(harness.originalArchive, harness.amendmentArchive),
    );

    const proxyHarness = await buildCrossEngineTestHarness();
    proxyHarness.python.outcome = new Proxy(proxyHarness.pythonResult, {});
    assertQuarantined(
      await createFilingParserCrossEngineExecutionBoundary(
        proxyHarness.configuration,
      ).execute(proxyHarness.originalArchive, proxyHarness.amendmentArchive),
    );
  });

  it("copies and recursively freezes an accepted mutable result carrier", async () => {
    const harness = await buildCrossEngineTestHarness();
    const mutable = structuredClone(harness.pythonResult) as unknown as Record<
      string,
      unknown
    >;
    harness.python.outcome =
      mutable as unknown as FilingParserNormalizationExecutionResult;
    const boundary = createFilingParserCrossEngineExecutionBoundary(
      harness.configuration,
    );
    const result = await boundary.execute(
      harness.originalArchive,
      harness.amendmentArchive,
    );
    expect(result.status).toBe("agreed");
    if (result.status !== "agreed") throw new Error("expected agreement");
    const acceptedValue = result.normalization.factVersions[0]?.value;
    const mutableNormalization = mutable.normalization as Record<
      string,
      unknown
    >;
    const mutableVersions = mutableNormalization.factVersions as Record<
      string,
      unknown
    >[];
    mutableVersions[0]!.value = "777";
    expect(result.normalization.factVersions[0]?.value).toBe(acceptedValue);
    expect(Object.isFrozen(result.normalization.factVersions[0])).toBe(true);
    expect(Object.isFrozen(result.normalization.lineage[0])).toBe(true);
  });

  it("propagates the exact signal and quarantines pre-abort and mid-flight abort", async () => {
    const pre = await buildCrossEngineTestHarness();
    const preController = new AbortController();
    preController.abort();
    assertQuarantined(
      await createFilingParserCrossEngineExecutionBoundary(
        pre.configuration,
      ).execute(pre.originalArchive, pre.amendmentArchive, {
        signal: preController.signal,
      }),
    );
    expect(pre.python.calls).toHaveLength(0);

    const mid = await buildCrossEngineTestHarness();
    const midController = new AbortController();
    mid.python.outcome = () => {
      midController.abort();
      return mid.pythonResult;
    };
    assertQuarantined(
      await createFilingParserCrossEngineExecutionBoundary(
        mid.configuration,
      ).execute(mid.originalArchive, mid.amendmentArchive, {
        signal: midController.signal,
      }),
    );
    expect(mid.python.calls[0]?.signal).toBe(midController.signal);
    expect(mid.node.calls).toHaveLength(0);
  });

  it("rejects overlapping use while allowing the original call to finish", async () => {
    const harness = await buildCrossEngineTestHarness();
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.python.outcome = async () => {
      await pending;
      return harness.pythonResult;
    };
    const boundary = createFilingParserCrossEngineExecutionBoundary(
      harness.configuration,
    );
    const first = boundary.execute(
      harness.originalArchive,
      harness.amendmentArchive,
    );
    await Promise.resolve();
    assertQuarantined(
      await boundary.execute(harness.originalArchive, harness.amendmentArchive),
    );
    release?.();
    expect((await first).status).toBe("agreed");
  });

  it("does not invoke a third engine or retry either fixed role", async () => {
    const harness = await buildCrossEngineTestHarness();
    await createFilingParserCrossEngineExecutionBoundary(
      harness.configuration,
    ).execute(harness.originalArchive, harness.amendmentArchive);
    expect(harness.python.calls).toHaveLength(1);
    expect(harness.node.calls).toHaveLength(1);
  });
});

function assertQuarantined(
  value: FilingParserCrossEngineExecutionResult,
): void {
  expect(value).toEqual({
    claim: FILING_PARSER_CROSS_ENGINE_EXECUTION_CLAIM,
    code: "agreement_quarantined",
    normalization: null,
    provenance: null,
    schemaVersion: FILING_PARSER_CROSS_ENGINE_EXECUTION_SCHEMA_VERSION,
    status: "quarantined",
    synthetic: true,
  });
  expect(JSON.stringify(value)).not.toMatch(/sha256:|SYN-|fact:|canary/u);
  expect(Object.isFrozen(value)).toBe(true);
}
