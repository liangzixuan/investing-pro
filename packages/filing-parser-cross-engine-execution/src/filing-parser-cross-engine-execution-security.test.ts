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

  it("quarantines cached child successes replayed for unrelated archives", async () => {
    const harness = await buildCrossEngineTestHarness();
    const unrelatedOriginal = new Uint8Array([1, 2, 3]);
    const unrelatedAmendment = new Uint8Array([4, 5, 6]);
    const result = await createFilingParserCrossEngineExecutionBoundary(
      harness.configuration,
    ).execute(unrelatedOriginal, unrelatedAmendment);

    assertQuarantined(result);
    expect(harness.python.calls).toHaveLength(1);
    expect(harness.node.calls).toHaveLength(0);
  });

  it("recomputes and rejects forged handoff-pair and execution bindings from either engine", async () => {
    const bindingMutations: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        const provenance = value.provenance as Record<string, unknown>;
        const handoff = provenance.handoff as Record<string, unknown>;
        handoff.pairBindingSha256 = `sha256:${"e".repeat(64)}`;
      },
      (value) => {
        const provenance = value.provenance as Record<string, unknown>;
        provenance.executionBindingSha256 = `sha256:${"f".repeat(64)}`;
      },
    ];
    for (const role of ["python", "node"] as const) {
      for (const mutate of bindingMutations) {
        const harness = await buildCrossEngineTestHarness();
        const forged = structuredClone(
          role === "python" ? harness.pythonResult : harness.nodeResult,
        ) as unknown as Record<string, unknown>;
        mutate(forged);
        const target = role === "python" ? harness.python : harness.node;
        target.outcome =
          forged as unknown as FilingParserNormalizationExecutionResult;

        assertQuarantined(
          await createFilingParserCrossEngineExecutionBoundary(
            harness.configuration,
          ).execute(harness.originalArchive, harness.amendmentArchive),
        );
      }
    }
  });

  it("quarantines identical cross-engine lineage and fact-contract mutations", async () => {
    const mutations: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        const lineage = (value.normalization as Record<string, unknown>)
          .lineage as Record<string, unknown>[];
        const firstKey = lineage[0]?.key;
        if (firstKey === undefined || lineage[1] === undefined)
          throw new Error("test setup failed");
        lineage[0]!.key = lineage[1].key;
        lineage[1].key = firstKey;
      },
      (value) => {
        const lineage = (value.normalization as Record<string, unknown>)
          .lineage as Record<string, unknown>[];
        if (lineage[0] === undefined || lineage[1] === undefined)
          throw new Error("test setup failed");
        lineage[0].successorFactId = lineage[1].successorFactId;
      },
      (value) => {
        const lineage = (value.normalization as Record<string, unknown>)
          .lineage as Record<string, unknown>[];
        if (lineage[0] === undefined) throw new Error("test setup failed");
        lineage[0].effectiveAt = "2099-01-01T00:00:00.000Z";
      },
      (value) => {
        const versions = (value.normalization as Record<string, unknown>)
          .factVersions as Record<string, unknown>[];
        if (versions[0] === undefined) throw new Error("test setup failed");
        versions[0].sourceConcept = "rc-synthetic:WrongConcept";
      },
      (value) => {
        const versions = (value.normalization as Record<string, unknown>)
          .factVersions as Record<string, unknown>[];
        if (versions[10] === undefined) throw new Error("test setup failed");
        versions[10].sourceDocumentSha256 = `sha256:${"9".repeat(64)}`;
      },
      (value) => {
        const versions = (value.normalization as Record<string, unknown>)
          .factVersions as Record<string, unknown>[];
        if (versions[3] === undefined) throw new Error("test setup failed");
        versions[3].unit = "USD";
      },
      (value) => {
        const versions = (value.normalization as Record<string, unknown>)
          .factVersions as Record<string, unknown>[];
        if (versions[0] === undefined) throw new Error("test setup failed");
        versions[0].value = "01";
      },
      (value) => {
        const versions = (value.normalization as Record<string, unknown>)
          .factVersions as Record<string, unknown>[];
        if (versions.length !== 20) throw new Error("test setup failed");
        for (let index = 0; index < 10; index += 1)
          versions[index + 10]!.value = versions[index]!.value;
      },
      (value) => {
        const versions = (value.normalization as Record<string, unknown>)
          .factVersions as Record<string, unknown>[];
        if (versions.length !== 20) throw new Error("test setup failed");
        for (let index = 0; index < 10; index += 1) {
          versions[index]!.value = "1";
          versions[index + 10]!.value = "2";
        }
      },
      (value) => {
        const versions = (value.normalization as Record<string, unknown>)
          .factVersions as Record<string, unknown>[];
        if (versions.length !== 20) throw new Error("test setup failed");
        for (const version of versions)
          version.sourceAcceptedAt = version.sourceAvailableAt;
      },
    ];
    for (const mutate of mutations) {
      const harness = await buildCrossEngineTestHarness();
      for (const [target, source] of [
        [harness.python, harness.pythonResult],
        [harness.node, harness.nodeResult],
      ] as const) {
        const commonModeMutation = structuredClone(source) as unknown as Record<
          string,
          unknown
        >;
        mutate(commonModeMutation);
        target.outcome =
          commonModeMutation as unknown as FilingParserNormalizationExecutionResult;
      }

      assertQuarantined(
        await createFilingParserCrossEngineExecutionBoundary(
          harness.configuration,
        ).execute(harness.originalArchive, harness.amendmentArchive),
      );
    }
  });

  it("quarantines identical cross-engine period and accession-context mutations", async () => {
    const mutations: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        const versions = mutableFactVersions(value);
        versions[3]!.periodStart = versions[3]!.periodEnd;
        versions[13]!.periodStart = versions[13]!.periodEnd;
      },
      (value) => {
        const versions = mutableFactVersions(value);
        const periodEnd =
          versions[0]!.periodEnd === "2025-12-30" ? "2025-12-29" : "2025-12-30";
        versions[0]!.periodEnd = periodEnd;
        versions[10]!.periodEnd = periodEnd;
      },
      (value) => {
        const versions = mutableFactVersions(value);
        const issuer = String(versions[10]!.sourceAccession).startsWith(
          "SYN-8888888888-",
        )
          ? "7777777777"
          : "8888888888";
        const accession = String(versions[10]!.sourceAccession).replace(
          /^SYN-[0-9]{10}/u,
          `SYN-${issuer}`,
        );
        for (let index = 10; index < 20; index += 1)
          versions[index]!.sourceAccession = accession;
      },
      (value) => {
        const versions = mutableFactVersions(value);
        const current = String(versions[0]!.sourceAccession);
        const year = current.slice(15, 17) === "99" ? "98" : "99";
        const accession = current.replace(
          /^SYN-([0-9]{10})-[0-9]{2}-/u,
          `SYN-$1-${year}-`,
        );
        for (let index = 0; index < 10; index += 1)
          versions[index]!.sourceAccession = accession;
      },
    ];
    for (const mutate of mutations)
      await assertCommonModeMutationQuarantined(mutate);
  });

  it("binds both source roles and both lineage pointer directions", async () => {
    const mutations: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        const versions = mutableFactVersions(value);
        for (let index = 0; index < 10; index += 1)
          versions[index]!.sourceContentSha256 = `sha256:${"7".repeat(64)}`;
      },
      (value) => {
        const versions = mutableFactVersions(value);
        for (let index = 10; index < 20; index += 1)
          versions[index]!.sourceContentSha256 = `sha256:${"8".repeat(64)}`;
      },
      (value) => {
        const versions = mutableFactVersions(value);
        for (let index = 0; index < 10; index += 1)
          versions[index]!.sourceDocumentSha256 = `sha256:${"7".repeat(64)}`;
      },
      (value) => {
        const versions = mutableFactVersions(value);
        for (let index = 10; index < 20; index += 1)
          versions[index]!.sourceDocumentSha256 = `sha256:${"8".repeat(64)}`;
      },
      (value) => {
        const versions = mutableFactVersions(value);
        versions[0]!.successorFactId = versions[11]!.factId;
      },
      (value) => {
        const versions = mutableFactVersions(value);
        versions[10]!.predecessorFactId = versions[1]!.factId;
      },
    ];
    for (const mutate of mutations)
      await assertCommonModeMutationQuarantined(mutate);
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

async function assertCommonModeMutationQuarantined(
  mutate: (value: Record<string, unknown>) => void,
): Promise<void> {
  const harness = await buildCrossEngineTestHarness();
  for (const [target, source] of [
    [harness.python, harness.pythonResult],
    [harness.node, harness.nodeResult],
  ] as const) {
    const commonModeMutation = structuredClone(source) as unknown as Record<
      string,
      unknown
    >;
    mutate(commonModeMutation);
    target.outcome =
      commonModeMutation as unknown as FilingParserNormalizationExecutionResult;
  }
  assertQuarantined(
    await createFilingParserCrossEngineExecutionBoundary(
      harness.configuration,
    ).execute(harness.originalArchive, harness.amendmentArchive),
  );
}

function mutableFactVersions(
  value: Record<string, unknown>,
): Record<string, unknown>[] {
  const versions = (value.normalization as Record<string, unknown>)
    .factVersions as Record<string, unknown>[];
  if (versions.length !== 20) throw new Error("test setup failed");
  return versions;
}
