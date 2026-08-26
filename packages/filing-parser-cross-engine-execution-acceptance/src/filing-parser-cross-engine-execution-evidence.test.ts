import { describe, expect, it } from "vitest";

import {
  createFilingParserCrossEngineExecutionEvidence,
  createFilingParserCrossEngineExecutionEvidenceForAcceptance,
  createFilingParserCrossEngineExecutionEvidenceV2,
  createFilingParserCrossEngineExecutionEvidenceV2ForAcceptance,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_VALIDATION_STAGES,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VALIDATION_STAGES,
  filingParserCrossEngineExecutionExpectedTransition,
  filingParserCrossEngineExecutionRequiredSourcePaths,
  filingParserCrossEngineImplementationSha256,
  parseCanonicalFilingParserCrossEngineExecutionEvidence,
  parseCanonicalFilingParserCrossEngineExecutionEvidenceV2,
  serializeCanonicalFilingParserCrossEngineExecutionEvidence,
  serializeCanonicalFilingParserCrossEngineExecutionEvidenceV2,
} from "./filing-parser-cross-engine-execution-evidence";
import {
  buildFilingParserCrossEngineExecutionEvidenceInput,
  buildFilingParserCrossEngineExecutionEvidenceV2Input,
} from "./test-filing-parser-cross-engine-execution-evidence-builder";

const HASH_Z = `sha256:${"0".repeat(64)}`;

describe("filing parser cross-engine execution evidence", () => {
  it("projects the exact sorted 66-path source union including historical routing", () => {
    const paths = filingParserCrossEngineExecutionRequiredSourcePaths(
      filingParserCrossEngineExecutionExpectedTransition(),
    );
    expect(paths).toHaveLength(66);
    expect([...paths].sort((left, right) => left.localeCompare(right))).toEqual(
      paths,
    );
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of [
      "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
      "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
      "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
      "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
    ])
      expect(paths).toContain(path);
  });

  it("round-trips exactly one canonical line", () => {
    const evidence = createFilingParserCrossEngineExecutionEvidence(
      buildFilingParserCrossEngineExecutionEvidenceInput(),
    );
    const serialized =
      serializeCanonicalFilingParserCrossEngineExecutionEvidence(evidence);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(serialized.slice(0, -1)).not.toContain("\n");
    expect(
      parseCanonicalFilingParserCrossEngineExecutionEvidence(
        new TextEncoder().encode(serialized),
      ),
    ).toEqual(evidence);
  });

  it("canonicalizes transition entry property order without weakening semantics", () => {
    const value = buildFilingParserCrossEngineExecutionEvidenceInput();
    const reversedEntries = value.transition.entries.map(({ path, status }) =>
      Object.freeze({ status, path }),
    );
    const evidence = createFilingParserCrossEngineExecutionEvidence({
      ...value,
      transition: Object.freeze({
        entries: Object.freeze(reversedEntries),
        pathCount: reversedEntries.length,
      }),
    });
    expect(evidence.transition.entries).toEqual(value.transition.entries);
    for (const entry of evidence.transition.entries)
      expect(Object.keys(entry)).toEqual(["path", "status"]);
  });

  it("exposes only the closed validation stage to live acceptance", () => {
    const stages: string[] = [];
    const evidence =
      createFilingParserCrossEngineExecutionEvidenceForAcceptance(
        buildFilingParserCrossEngineExecutionEvidenceInput(),
        (stage) => stages.push(stage),
      );
    expect(stages).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VALIDATION_STAGES,
    );
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(
      Object.isFrozen(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VALIDATION_STAGES,
      ),
    ).toBe(true);
    for (const stage of stages) {
      expect(stage).toMatch(/^[a-z_]+$/u);
      expect(stage).not.toMatch(
        /sha256|github|artifact|revision|secret|token|key|path/iu,
      );
    }
  });

  it("classifies invalid carriers without reflecting their values", () => {
    const cases: readonly [
      expected: string,
      mutate: (root: Record<string, unknown>) => void,
    ][] = [
      ["root_contract", (root) => (root.unexpected = "secret")],
      ["timestamps", (root) => (root.startedAt = "not-a-time")],
      ["claim_tuples", (root) => (root.checksPassed = [])],
      ["case_outcomes", (root) => (outcome(root, 0).factVersionCount = 19)],
      ["transition", (root) => records(transition(root).entries).pop()],
      ["runtime", (root) => (runtime(root).auditedContainerCount = 14)],
      ["source_hashes", (root) => records(root.sourceHashes).pop()],
      ["engines", (root) => (engine(root, 0).runtimeVersion = "wrong")],
      ["fixture_binding", (root) => (root.fixtureManifestSha256 = HASH_Z)],
      [
        "summary",
        (root) => ((root.summary as Record<string, unknown>).total = 3),
      ],
      [
        "tools_contract",
        (root) =>
          ((root.tools as Record<string, unknown>).unexpected = "secret"),
      ],
      ["tool_docker_client", (root) => setTool(root, "dockerClient", "")],
      ["tool_docker_server", (root) => setTool(root, "dockerServer", "")],
      ["tool_git", (root) => setTool(root, "git", "")],
      ["tool_node", (root) => setTool(root, "node", "")],
      ["tool_pnpm", (root) => setTool(root, "pnpm", "")],
      ["tool_python", (root) => setTool(root, "python", "")],
      ["workflow", (root) => (workflow(root).artifactName = "wrong")],
    ];
    for (const [expected, mutate] of cases) {
      const value = mutableEvidence();
      mutate(value);
      let observed = "not_started";
      expect(() =>
        createFilingParserCrossEngineExecutionEvidenceForAcceptance(
          value as never,
          (stage) => {
            observed = stage;
          },
        ),
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
      expect(observed).toBe(expected);
    }
  });

  it("never lets the stage callback change canonical acceptance semantics", () => {
    for (const [target, afterStage] of [
      ["baseline", "timestamps"],
      ["completedAt", "claim_tuples"],
      ["checksPassed", "case_outcomes"],
      ["caseOutcomes", "transition"],
      ["transition", "runtime"],
      ["runtime", "source_hashes"],
      ["sourceHashes", "engines"],
      ["engines", "fixture_binding"],
      ["fixtureManifestSha256", "summary"],
      ["summary", "tools_contract"],
      ["tools", "workflow"],
      ["workflow", "canonical_freeze"],
    ] as const) {
      const value = mutableEvidence();
      let mutated = false;
      expect(() =>
        createFilingParserCrossEngineExecutionEvidenceForAcceptance(
          value as never,
          (stage) => {
            if (mutated || stage !== afterStage) return;
            mutated = true;
            value[target] = "mutated-after-validation";
          },
        ),
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
      expect(() =>
        createFilingParserCrossEngineExecutionEvidence(value as never),
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
    }
  });

  it("maps throwing stage callbacks to the same generic evidence error", () => {
    expect(() =>
      createFilingParserCrossEngineExecutionEvidenceForAcceptance(
        buildFilingParserCrossEngineExecutionEvidenceInput(),
        () => {
          throw new Error("secret callback detail");
        },
      ),
    ).toThrow("Filing parser cross-engine execution evidence is invalid.");
  });

  it("rejects contradictory success bindings and value-bearing quarantines", () => {
    for (const mutate of [
      (root: Record<string, unknown>) =>
        (outcome(root, 0).nodeOriginalStdoutSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).nodeAmendmentStdoutSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).nodeKeyId = "substituted-key-v1"),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).nodePublicKeySpkiSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).nodeExecutionBindingSha256 = outcome(
          root,
          0,
        ).pythonExecutionBindingSha256),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).factVersionCount = 19),
      (root: Record<string, unknown>) => (outcome(root, 0).lineageCount = 9),
      (root: Record<string, unknown>) =>
        (outcome(root, 1).originalArchiveSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 1).factVersionCount = 0),
      (root: Record<string, unknown>) =>
        (outcome(root, 1).resultSha256 = HASH_Z),
    ]) {
      const value = mutableEvidence();
      mutate(value);
      expect(() =>
        createFilingParserCrossEngineExecutionEvidence(value as never),
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
    }
  });

  it("binds implementations, fixture, artifact, engines, and runtime exactly", () => {
    for (const mutate of [
      (root: Record<string, unknown>) =>
        (engine(root, 0).runtimeVersion = "Python 3.12.14"),
      (root: Record<string, unknown>) =>
        (engine(root, 1).baseIndexDigest = HASH_Z),
      (root: Record<string, unknown>) => mutateImplementationProjection(root),
      (root: Record<string, unknown>) => (root.fixtureManifestSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (root.failedPrecursorRevision = "0".repeat(40)),
      (root: Record<string, unknown>) =>
        (root.failedCorrectiveRevision = "0".repeat(40)),
      (root: Record<string, unknown>) =>
        (root.failedDiagnosticRevision = "0".repeat(40)),
      (root: Record<string, unknown>) =>
        (root.failedRecoveryRevision = "0".repeat(40)),
      (root: Record<string, unknown>) =>
        (workflow(root).artifactName = "wrong"),
      (root: Record<string, unknown>) =>
        (runtime(root).auditedContainerCount = 14),
      (root: Record<string, unknown>) =>
        (runtime(root).productionContainerCount = 10),
      (root: Record<string, unknown>) =>
        (runtime(root).successfulPairContainerCount = 3),
      (root: Record<string, unknown>) =>
        records(transition(root).entries).pop(),
      (root: Record<string, unknown>) =>
        ((
          records(transition(root).entries)[0] as Record<string, unknown>
        ).status = "M"),
      (root: Record<string, unknown>) => {
        records(transition(root).entries).push({
          path: "unexpected",
          status: "A",
        });
        transition(root).pathCount = 45;
      },
    ]) {
      const value = mutableEvidence();
      mutate(value);
      expect(() =>
        createFilingParserCrossEngineExecutionEvidence(value as never),
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
    }
  });

  it("rejects noncanonical, duplicate, multiline, and extra-field encodings", () => {
    const canonical =
      serializeCanonicalFilingParserCrossEngineExecutionEvidence(
        buildFilingParserCrossEngineExecutionEvidenceInput(),
      );
    for (const text of [
      ` ${canonical}`,
      canonical.replace("{", '{"status":"passed",'),
      canonical.replace("\n", "\n\n"),
      canonical.slice(0, -1),
    ])
      expect(() =>
        parseCanonicalFilingParserCrossEngineExecutionEvidence(
          new TextEncoder().encode(text),
        ),
      ).toThrow();
  });

  it("maps hostile carriers to the generic evidence error", () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error("secret");
        },
      },
    );
    expect(() =>
      createFilingParserCrossEngineExecutionEvidence(hostile as never),
    ).toThrow("Filing parser cross-engine execution evidence is invalid.");
  });
});

describe("filing parser cross-engine execution evidence v2", () => {
  it("round-trips the canonical v2 artifact and preserves the immutable v1 anchors", () => {
    const evidence = createFilingParserCrossEngineExecutionEvidenceV2(
      buildFilingParserCrossEngineExecutionEvidenceV2Input(),
    );
    const serialized =
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV2(evidence);
    expect(
      parseCanonicalFilingParserCrossEngineExecutionEvidenceV2(
        new TextEncoder().encode(serialized),
      ),
    ).toEqual(evidence);
    expect(evidence.schemaVersion).toBe("2.0.0");
    expect(evidence.evidenceVersion).toBe(2);
    expect(evidence.historicalV1).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
    );
    expect(evidence.historicalV1.claimStatus).toBe("superseded");
    expect(evidence.checksPassed).toHaveLength(16);
    expect(evidence.notProven).toHaveLength(16);
    expect(evidence.notProven).toContain(
      "injected_child_boundary_factory_runner_signer_receipt_authenticity_or_fresh_execution",
    );
    expect(evidence.sourceHashes.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "fixtures/synthetic/filing-parser-cross-engine-execution/v2/cases.json",
        "fixtures/synthetic/filing-parser-cross-engine-execution/v2/manifest.json",
      ]),
    );
    expect(evidence.fixtureManifestSha256).toBe(
      evidence.sourceHashes.find(
        ({ path }) =>
          path ===
          "fixtures/synthetic/filing-parser-cross-engine-execution/v2/manifest.json",
      )?.sha256,
    );
    expect(evidence.caseOutcomes[0]).toMatchObject({
      agreementSha256:
        "sha256:983a8ac24edec0d5c1a9bda408a9818ea7fcf036805015d7454d807ccf974174",
      nodeExecutionBindingSha256:
        "sha256:3e6d9a253f15b0b2931e5c5e4ace9c2ab02357d4ccdd3426e613d5b2b9af197f",
      nodeHandoffPairBindingSha256:
        "sha256:ae4b5ee5bfe663eee0c375b11e877073962cc5969a3e01eee2e01686a9ba1940",
      pythonExecutionBindingSha256:
        "sha256:536ef7823d52bdfe9ac30b55d72d6e7048be430f11c7806e3c62adf18ba8e11f",
      pythonHandoffPairBindingSha256:
        "sha256:904c0cc1cb434d762f5fc5dd28a3bf5ce73dd90ccb994906221941d6cd825cee",
    });
  });

  it("validates six ordered cases with five value-free quarantines", () => {
    const evidence = createFilingParserCrossEngineExecutionEvidenceV2(
      buildFilingParserCrossEngineExecutionEvidenceV2Input(),
    );
    expect(evidence.caseOutcomes.map(({ caseId }) => caseId)).toEqual([
      "exact-original-amendment-cross-engine-bound-pair",
      "cached-genuine-child-receipts-under-different-archives",
      "common-mode-lineage-mutation",
      "cross-engine-normalization-mismatch",
      "original-archive-tamper",
      "original-amendment-role-swap",
    ]);
    expect(evidence.summary).toEqual({
      agreed: 1,
      quarantined: 5,
      replayMatched: true,
      total: 6,
    });
    for (const outcome of evidence.caseOutcomes.slice(1)) {
      expect(outcome.observedStatus).toBe("quarantined");
      expect(outcome.replayMatched).toBe(false);
      for (const value of Object.values(outcome))
        if (
          value !== outcome.caseId &&
          value !== "quarantined" &&
          value !== false
        )
          expect(value).toBeNull();
    }
  });

  it("exposes only the closed v2 validation stages", () => {
    const stages: string[] = [];
    createFilingParserCrossEngineExecutionEvidenceV2ForAcceptance(
      buildFilingParserCrossEngineExecutionEvidenceV2Input(),
      (stage) => stages.push(stage),
    );
    expect(stages).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_VALIDATION_STAGES,
    );
    expect(
      Object.isFrozen(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CHECKS),
    ).toBe(true);
    expect(
      Object.isFrozen(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_NOT_PROVEN,
      ),
    ).toBe(true);
  });

  it("rejects changes to historical anchors, binding claims, cases, and artifact identity", () => {
    for (const mutate of [
      (root: Record<string, unknown>) =>
        ((root.historicalV1 as Record<string, unknown>).artifactId = "1"),
      (root: Record<string, unknown>) =>
        ((root.bindingValidation as Record<string, unknown>).executionBinding =
          "trusted"),
      (root: Record<string, unknown>) =>
        (outcome(root, 1).originalArchiveSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 2).caseId = "cross-engine-normalization-mismatch"),
      (root: Record<string, unknown>) =>
        (workflow(root).artifactName = "wrong"),
      (root: Record<string, unknown>) =>
        (root.checksPassed = [
          ...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CHECKS,
        ].reverse()),
      (root: Record<string, unknown>) =>
        (root.notProven = [
          ...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_NOT_PROVEN,
        ].slice(1)),
    ]) {
      const value = mutableEvidenceV2();
      mutate(value);
      expect(() =>
        createFilingParserCrossEngineExecutionEvidenceV2(value as never),
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
    }
  });

  it("independently rejects archive, document, pair, execution, and agreement inconsistencies", () => {
    for (const mutate of [
      (root: Record<string, unknown>) => {
        const success = outcome(root, 0);
        success.originalArchiveSha256 = success.amendmentArchiveSha256;
      },
      (root: Record<string, unknown>) => {
        const success = outcome(root, 0);
        success.originalDocumentSha256 = success.amendmentDocumentSha256;
      },
      (root: Record<string, unknown>) =>
        (outcome(root, 0).pythonHandoffPairBindingSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).nodeHandoffPairBindingSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).pythonExecutionBindingSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).nodeExecutionBindingSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).agreementSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).pythonOriginalStdoutSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 0).nodeAmendmentStdoutSha256 = HASH_Z),
    ]) {
      const value = mutableEvidenceV2();
      mutate(value);
      expect(() =>
        createFilingParserCrossEngineExecutionEvidenceV2(value as never),
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
    }
  });

  it("rejects noncanonical v2 encodings", () => {
    const canonical =
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV2(
        buildFilingParserCrossEngineExecutionEvidenceV2Input(),
      );
    for (const text of [
      canonical.slice(0, -1),
      ` ${canonical}`,
      canonical.replace("\n", "\n\n"),
    ])
      expect(() =>
        parseCanonicalFilingParserCrossEngineExecutionEvidenceV2(
          new TextEncoder().encode(text),
        ),
      ).toThrow();
  });
});

function mutableEvidence(): Record<string, unknown> {
  return structuredClone(
    buildFilingParserCrossEngineExecutionEvidenceInput(),
  ) as unknown as Record<string, unknown>;
}
function mutableEvidenceV2(): Record<string, unknown> {
  return structuredClone(
    buildFilingParserCrossEngineExecutionEvidenceV2Input(),
  ) as unknown as Record<string, unknown>;
}
function records(value: unknown): Record<string, unknown>[] {
  return value as Record<string, unknown>[];
}
function outcome(
  root: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  return records(root.caseOutcomes)[index] as Record<string, unknown>;
}
function engine(
  root: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  return records(root.engines)[index] as Record<string, unknown>;
}
function implementation(
  value: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  return records(value.implementationSourceHashes)[index] as Record<
    string,
    unknown
  >;
}
function mutateImplementationProjection(root: Record<string, unknown>): void {
  const target = engine(root, 0);
  implementation(target, 0).sha256 = HASH_Z;
  target.implementationSha256 = filingParserCrossEngineImplementationSha256(
    target.implementationSourceHashes as never,
  );
}
function runtime(root: Record<string, unknown>): Record<string, unknown> {
  return root.runtime as Record<string, unknown>;
}
function workflow(root: Record<string, unknown>): Record<string, unknown> {
  return root.workflow as Record<string, unknown>;
}
function setTool(
  root: Record<string, unknown>,
  key: string,
  value: string,
): void {
  (root.tools as Record<string, unknown>)[key] = value;
}
function transition(root: Record<string, unknown>): Record<string, unknown> {
  return root.transition as Record<string, unknown>;
}
