import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CHECKS,
  FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_NOT_PROVEN,
} from "@research-cockpit/filing-parser-cross-engine-execution";

import {
  createFilingParserCrossEngineExecutionEvidence,
  createFilingParserCrossEngineExecutionEvidenceForAcceptance,
  createFilingParserCrossEngineExecutionEvidenceV2,
  createFilingParserCrossEngineExecutionEvidenceV2ForAcceptance,
  createFilingParserCrossEngineExecutionEvidenceV3,
  createFilingParserCrossEngineExecutionEvidenceV3ForAcceptance,
  createFilingParserCrossEngineExecutionEvidenceV4,
  createFilingParserCrossEngineExecutionEvidenceV4ForAcceptance,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_RUN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_VALIDATION_STAGES,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_VALIDATION_STAGES,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CASE_IDS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_TRANSITION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_VALIDATION_STAGES,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VALIDATION_STAGES,
  filingParserCrossEngineExecutionExpectedTransition,
  filingParserCrossEngineExecutionRequiredSourcePaths,
  filingParserCrossEngineExecutionV2RequiredSourcePaths,
  filingParserCrossEngineExecutionV3RequiredSourcePaths,
  filingParserCrossEngineExecutionV4RequiredSourcePaths,
  filingParserCrossEngineExecutionV4CompositionCommitmentSha256,
  filingParserCrossEngineExecutionV4EvaluationBindingSha256,
  filingParserCrossEngineExecutionV4QualityDocumentSha256,
  filingParserCrossEngineImplementationSha256,
  parseCanonicalFilingParserCrossEngineExecutionEvidence,
  parseCanonicalFilingParserCrossEngineExecutionEvidenceV2,
  parseCanonicalFilingParserCrossEngineExecutionEvidenceV3,
  parseCanonicalFilingParserCrossEngineExecutionEvidenceV4,
  serializeCanonicalFilingParserCrossEngineExecutionEvidence,
  serializeCanonicalFilingParserCrossEngineExecutionEvidenceV2,
  serializeCanonicalFilingParserCrossEngineExecutionEvidenceV3,
  serializeCanonicalFilingParserCrossEngineExecutionEvidenceV4,
} from "./filing-parser-cross-engine-execution-evidence";
import {
  buildFilingParserCrossEngineExecutionEvidenceInput,
  buildFilingParserCrossEngineExecutionEvidenceV2Input,
  buildFilingParserCrossEngineExecutionEvidenceV3Input,
  buildFilingParserCrossEngineExecutionEvidenceV4Input,
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
    expect(evidence.failedPrecursorRevision).toBe(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION,
    );
    expect(evidence.failedRun).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_RUN,
    );
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

  it("uses locale-independent binary ordering for mixed-case v2 source paths", () => {
    const paths = filingParserCrossEngineExecutionV2RequiredSourcePaths([
      { path: "README.md", status: "M" },
      { path: "packages/example.ts", status: "M" },
    ]);
    expect(paths).toEqual(
      [...paths].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    );
    expect(paths.indexOf("README.md")).toBeLessThan(
      paths.indexOf("packages/example.ts"),
    );
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
      (root: Record<string, unknown>) =>
        (root.failedPrecursorRevision = "0".repeat(40)),
      (root: Record<string, unknown>) =>
        ((root.failedRun as Record<string, unknown>).artifactCount = 1),
    ]) {
      const value = mutableEvidenceV2();
      mutate(value);
      expect(() =>
        createFilingParserCrossEngineExecutionEvidenceV2(value as never),
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
    }
  });

  it("rejects using the failed precursor itself as the corrective revision", () => {
    const value = mutableEvidenceV2();
    value.revision =
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION;
    workflow(value).artifactName =
      `filing-parser-cross-engine-execution-evidence-v2-${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION}-1`;
    expect(() =>
      createFilingParserCrossEngineExecutionEvidenceV2(value as never),
    ).toThrow("Filing parser cross-engine execution evidence is invalid.");
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

describe("filing parser cross-engine execution evidence v3", () => {
  it("round-trips one canonical line and preserves both historical protocols", () => {
    const evidence = createFilingParserCrossEngineExecutionEvidenceV3(
      buildFilingParserCrossEngineExecutionEvidenceV3Input(),
    );
    const serialized =
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV3(evidence);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(serialized.slice(0, -1)).not.toContain("\n");
    expect(
      parseCanonicalFilingParserCrossEngineExecutionEvidenceV3(
        new TextEncoder().encode(serialized),
      ),
    ).toEqual(evidence);
    expect(evidence.schemaVersion).toBe("3.0.0");
    expect(evidence.evidenceVersion).toBe(3);
    expect(evidence.historicalV1).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
    );
    expect(evidence.historicalV2).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
    );
    expect(evidence.checksPassed).toHaveLength(16);
    expect(evidence.notProven).toHaveLength(16);
  });

  it("uses binary source ordering and binds the v3 fixture pair", () => {
    const paths = filingParserCrossEngineExecutionV3RequiredSourcePaths([
      { path: "README.md", status: "M" },
      { path: "packages/example.ts", status: "M" },
    ]);
    expect(paths).toEqual(
      [...paths].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    );
    expect(paths).toEqual(
      expect.arrayContaining([
        "fixtures/synthetic/filing-parser-cross-engine-execution/v3/cases.json",
        "fixtures/synthetic/filing-parser-cross-engine-execution/v3/manifest.json",
      ]),
    );
  });

  it("validates two stable-normalization invocations and five value-free quarantines", () => {
    const evidence = createFilingParserCrossEngineExecutionEvidenceV3(
      buildFilingParserCrossEngineExecutionEvidenceV3Input(),
    );
    expect(evidence.caseOutcomes.map(({ caseId }) => caseId)).toEqual([
      "same-input-direct-docker-distinct-lifecycle-invocations",
      "unknown-python-image",
      "pre-aborted-signal",
      "original-archive-tamper",
      "original-amendment-role-swap",
      "identical-archives",
    ]);
    const success = evidence.caseOutcomes[0];
    expect(success?.invocations).toHaveLength(2);
    expect(success?.invocations?.[0]?.normalizationSha256).toBe(
      success?.invocations?.[1]?.normalizationSha256,
    );
    expect(success?.invocations?.[0]?.invocationBindingSha256).not.toBe(
      success?.invocations?.[1]?.invocationBindingSha256,
    );
    expect(
      new Set(
        success?.invocations?.flatMap(({ lifecycleReceipts }) =>
          lifecycleReceipts.map(({ containerIdSha256 }) => containerIdSha256),
        ),
      ).size,
    ).toBe(8);
    for (const outcome of evidence.caseOutcomes.slice(1)) {
      expect(outcome.observedStatus).toBe("quarantined");
      expect(outcome.invocations).toBeNull();
      for (const value of Object.values(outcome))
        if (
          value !== outcome.caseId &&
          value !== "quarantined" &&
          value !== false
        )
          expect(value).toBeNull();
    }
  });

  it("exposes only the frozen v3 stages, checks, and nonclaims", () => {
    const stages: string[] = [];
    createFilingParserCrossEngineExecutionEvidenceV3ForAcceptance(
      buildFilingParserCrossEngineExecutionEvidenceV3Input(),
      (stage) => stages.push(stage),
    );
    expect(stages).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_VALIDATION_STAGES,
    );
    expect(
      Object.isFrozen(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CHECKS),
    ).toBe(true);
    expect(
      Object.isFrozen(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_NOT_PROVEN,
      ),
    ).toBe(true);
    expect(FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_CHECKS).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CHECKS,
    );
    expect(FILING_PARSER_CROSS_ENGINE_DIRECT_EXECUTION_NOT_PROVEN).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_NOT_PROVEN,
    );
  });

  it("rejects every lifecycle and outer-invocation binding mutation", () => {
    for (const [mutationIndex, mutate] of [
      (root: Record<string, unknown>) =>
        (receiptV3(root, 0, 0).archiveSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (receiptV3(root, 0, 0).containerIdSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (receiptV3(root, 0, 0).documentRole = "amendment"),
      (root: Record<string, unknown>) =>
        (receiptV3(root, 0, 0).documentSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (receiptV3(root, 0, 0).engineId = "wrong-engine"),
      (root: Record<string, unknown>) =>
        (receiptV3(root, 0, 0).imageSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (receiptV3(root, 0, 0).implementationSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (receiptV3(root, 0, 0).keyId = "wrong-key"),
      (root: Record<string, unknown>) =>
        (receiptV3(root, 0, 0).lifecycleBindingSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (receiptV3(root, 0, 0).publicKeySpkiSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (receiptV3(root, 0, 0).role = "node-secondary"),
      (root: Record<string, unknown>) =>
        (receiptV3(root, 0, 0).zeroResidue = false),
      (root: Record<string, unknown>) =>
        (invocationV3(root, 0).agreementSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (invocationV3(root, 0).invocationBindingSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (invocationV3(root, 0).normalizationSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (invocationV3(root, 0).publicKeySpkiSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (records(
          invocationV3(root, 0).agreementEngines,
        )[0]!.executionBindingSha256 = HASH_Z),
    ].entries()) {
      const value = mutableEvidenceV3();
      mutate(value);
      expect(
        () => createFilingParserCrossEngineExecutionEvidenceV3(value as never),
        `mutation ${mutationIndex}`,
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
    }
  });

  it("rejects topology, history, identity, ordering, summary, and noncanonical mutations", () => {
    for (const mutate of [
      (root: Record<string, unknown>) => (root.baseline = "0".repeat(40)),
      (root: Record<string, unknown>) =>
        ((root.historicalV1 as Record<string, unknown>).artifactId = "1"),
      (root: Record<string, unknown>) =>
        ((root.historicalV2 as Record<string, unknown>).artifactId = "1"),
      (root: Record<string, unknown>) =>
        (root.checksPassed = [
          ...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CHECKS,
        ].reverse()),
      (root: Record<string, unknown>) =>
        (root.notProven = [
          ...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_NOT_PROVEN,
        ].slice(1)),
      (root: Record<string, unknown>) =>
        (outcome(root, 1).originalArchiveSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (outcome(root, 1).caseId = "pre-aborted-signal"),
      (root: Record<string, unknown>) =>
        (runtime(root).successfulContainerCount = 7),
      (root: Record<string, unknown>) =>
        (workflow(root).artifactName = "wrong"),
      (root: Record<string, unknown>) =>
        ((root.summary as Record<string, unknown>).normalizationStable = false),
    ]) {
      const value = mutableEvidenceV3();
      mutate(value);
      expect(() =>
        createFilingParserCrossEngineExecutionEvidenceV3(value as never),
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
    }
    const canonical =
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV3(
        buildFilingParserCrossEngineExecutionEvidenceV3Input(),
      );
    for (const text of [
      canonical.slice(0, -1),
      ` ${canonical}`,
      canonical.replace("\n", "\n\n"),
    ])
      expect(() =>
        parseCanonicalFilingParserCrossEngineExecutionEvidenceV3(
          new TextEncoder().encode(text),
        ),
      ).toThrow();
  });
});

describe("filing parser cross-engine execution evidence v4", () => {
  it("round-trips the canonical v4 artifact and preserves the closed history receipt", () => {
    const evidence = createFilingParserCrossEngineExecutionEvidenceV4(
      buildFilingParserCrossEngineExecutionEvidenceV4Input(),
    );
    const serialized =
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV4(evidence);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(serialized.slice(0, -1)).not.toContain("\n");
    expect(
      parseCanonicalFilingParserCrossEngineExecutionEvidenceV4(
        new TextEncoder().encode(serialized),
      ),
    ).toEqual(evidence);
    expect(evidence.schemaVersion).toBe("4.0.0");
    expect(evidence.evidenceVersion).toBe(4);
    expect(evidence.historicalV3).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY,
    );
    expect(evidence.historicalV3.maintenance).toEqual({
      artifactCount: 0,
      jobId: "98363074109",
      revision: "1860bb367afdb6d725e41880ebb121dda4a04f39",
      runId: "33024664259",
    });
    expect(evidence.checksPassed).toHaveLength(16);
    expect(evidence.notProven).toHaveLength(16);
    expect(evidence.transition.entries).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_TRANSITION,
    );
    expect(evidence.transition.pathCount).toBe(34);
  });

  it("hashes the exact quality dependencies and composition source tree", () => {
    const evidence = createFilingParserCrossEngineExecutionEvidenceV4(
      buildFilingParserCrossEngineExecutionEvidenceV4Input(),
    );
    const paths = filingParserCrossEngineExecutionV4RequiredSourcePaths(
      evidence.transition.entries,
    );
    expect(paths).toEqual(
      [...paths].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    );
    for (const path of [
      "packages/filing-quality-measurement/package.json",
      "packages/filing-quality-measurement/src/filing-quality-measurement-security.test.ts",
      "packages/filing-quality-measurement/src/test-filing-quality-measurement-builder.ts",
      "packages/filing-quality-precommitment/package.json",
      "packages/filing-quality-precommitment/src/filing-quality-precommitment-security.test.ts",
      "packages/filing-quality-precommitment/src/test-filing-quality-precommitment-builder.ts",
      "packages/filing-parser-quality-composition/src/filing-parser-quality-composition.ts",
      "packages/filing-parser-quality-composition/src/filing-parser-quality-composition-security.test.ts",
      "packages/filing-parser-quality-composition/src/test-filing-parser-quality-composition-builder.ts",
    ])
      expect(paths).toContain(path);
    expect(evidence.sourceHashes.map(({ path }) => path)).toEqual(paths);
  });

  it("uses the raw Cycle 2f document-id domain hash without JSON quoting", () => {
    const domain =
      "research-cockpit:synthetic-filing-quality-document:v1\u0000";
    for (const [documentId, frozenDigest] of [
      [
        "synthetic-filing-0001",
        "sha256:ff2c3013ee14945f73dd92a9431fd4d1194bb573ec3d88ddf244e82c658d16ec",
      ],
      [
        "synthetic-filing-0002",
        "sha256:194694b43b7a58977e60e99378533443cf4cfbe26e499ca073358fb25f4b61b9",
      ],
    ] as const) {
      const independentlyRecomputed = `sha256:${createHash("sha256")
        .update(domain, "utf8")
        .update(documentId, "utf8")
        .digest("hex")}`;
      expect(independentlyRecomputed).toBe(frozenDigest);
      expect(
        filingParserCrossEngineExecutionV4QualityDocumentSha256(documentId),
      ).toBe(frozenDigest);
    }
  });

  it("records the two-document not-met result and five value-free quarantines", () => {
    const evidence = createFilingParserCrossEngineExecutionEvidenceV4(
      buildFilingParserCrossEngineExecutionEvidenceV4Input(),
    );
    expect(evidence.caseOutcomes.map(({ caseId }) => caseId)).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CASE_IDS,
    );
    expect(evidence.summary).toEqual({
      candidateCommitmentsStable: true,
      candidateObservationsStable: true,
      compositionBindingsDistinct: true,
      evaluatedNotMet: 1,
      lifecycleBindingsDistinct: true,
      measurementStable: true,
      quarantined: 5,
      total: 6,
    });
    const first = evidence.caseOutcomes[0]?.invocations?.[0];
    const second = evidence.caseOutcomes[0]?.invocations?.[1];
    expect(first?.qualityAccounting.counts).toMatchObject({
      documentCount: 100,
      emittedFactCount: 20,
      expectedFactCount: 1_000,
      falseNegativeFactCount: 980,
      missingDocumentCount: 98,
      missingFactCount: 980,
      silentCriticalFailureCount: 1_960,
      succeededDocumentCount: 2,
      truePositiveFactCount: 20,
    });
    expect(first?.qualityAccounting.failedThresholds).toEqual([
      "document_success_minimum",
      "fact_recall_minimum",
      "maximum_silent_critical_failures",
    ]);
    expect(first?.qualityAccounting.metrics).toMatchObject({
      documentSuccess: {
        defined: true,
        threshold: { denominator: 100, numerator: 95 },
        thresholdKind: "minimum",
      },
      factPrecision: {
        defined: true,
        threshold: { denominator: 100, numerator: 99 },
        thresholdKind: "minimum",
      },
      factRecall: {
        defined: true,
        threshold: { denominator: 100, numerator: 99 },
        thresholdKind: "minimum",
      },
      quarantineRate: {
        defined: true,
        threshold: { denominator: 100, numerator: 5 },
        thresholdKind: "maximum",
      },
      silentCriticalFailure: { maximumCount: 0 },
      unitDateTolerance: {
        dateToleranceDays: 0,
        periodMismatchCount: 0,
        unitMismatchCount: 0,
        unitTolerancePolicy: "exact_canonical_unit.v1",
      },
    });
    expect(first?.candidateObservationsSha256).toBe(
      second?.candidateObservationsSha256,
    );
    expect(first?.candidateObservationsSha256).not.toBe(
      first?.measurementEvaluationSha256,
    );
    expect(
      first?.projectionReceipts.map(
        ({ observationSha256 }) => observationSha256,
      ),
    ).toEqual([
      "sha256:016ae1ef58be5df9d438e77e60b1586e2880752a5aac062633f6059cc40983d7",
      "sha256:c3e8c74ee319437219b79a659e0aa6175946f0e4c27430ade1be4bf6c1642488",
    ]);
    expect(first?.candidateCommitmentSha256).toBe(
      second?.candidateCommitmentSha256,
    );
    expect(first?.measurementEvaluationSha256).toBe(
      second?.measurementEvaluationSha256,
    );
    expect(first?.sourceExecution.invocationBindingSha256).not.toBe(
      second?.sourceExecution.invocationBindingSha256,
    );
    expect(first?.sourceExecution.agreementSha256).not.toBe(
      second?.sourceExecution.agreementSha256,
    );
    expect(first?.compositionCommitmentSha256).not.toBe(
      second?.compositionCommitmentSha256,
    );
    expect(first?.evaluationBindingSha256).not.toBe(
      second?.evaluationBindingSha256,
    );
    expect(
      new Set([
        ...(first?.sourceExecution.lifecycleBindingSha256s ?? []),
        ...(second?.sourceExecution.lifecycleBindingSha256s ?? []),
      ]).size,
    ).toBe(8);
    for (const outcome of evidence.caseOutcomes.slice(1)) {
      expect(outcome).toEqual({
        candidateCommitmentsStable: false,
        candidateObservationsStable: false,
        caseId: outcome.caseId,
        compositionBindingsDistinct: false,
        expectedStatus: "quarantined",
        invocations: null,
        lifecycleBindingsDistinct: false,
        measurementStable: false,
        observedStatus: "quarantined",
      });
    }
  });

  it("exposes only the frozen v4 stages, checks, and nonclaims", () => {
    const stages: string[] = [];
    createFilingParserCrossEngineExecutionEvidenceV4ForAcceptance(
      buildFilingParserCrossEngineExecutionEvidenceV4Input(),
      (stage) => stages.push(stage),
    );
    expect(stages).toEqual(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_VALIDATION_STAGES,
    );
    expect(
      Object.isFrozen(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CHECKS),
    ).toBe(true);
    expect(
      Object.isFrozen(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_NOT_PROVEN,
      ),
    ).toBe(true);
  });

  it("rejects history, mapping, accounting, binding, source-tree, and identity mutations", () => {
    for (const [mutationIndex, mutate] of [
      (root: Record<string, unknown>) =>
        ((
          (root.historicalV3 as Record<string, unknown>).maintenance as Record<
            string,
            unknown
          >
        ).artifactCount = 1),
      (root: Record<string, unknown>) =>
        (projectionV4(root, 0, 0).observationSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (projectionV4(root, 0, 0).projectionBindingSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (projectionV4(root, 0, 0).qualityDocumentId = "synthetic-filing-0002"),
      (root: Record<string, unknown>) =>
        ((
          projectionV4(root, 0, 0).sourceLifecycleBindingSha256s as unknown[]
        )[0] = HASH_Z),
      (root: Record<string, unknown>) =>
        (invocationV4(root, 0).compositionCommitmentSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (invocationV4(root, 0).evaluationBindingSha256 = HASH_Z),
      (root: Record<string, unknown>) =>
        (sourceExecutionV4(root, 0).executionMode = "injected"),
      (root: Record<string, unknown>) =>
        (sourceExecutionV4(root, 0).directExecutionSchemaVersion = "3.0.0"),
      (root: Record<string, unknown>) =>
        (sourceExecutionV4(root, 1).agreementSha256 = sourceExecutionV4(
          root,
          0,
        ).agreementSha256),
      (root: Record<string, unknown>) =>
        (qualityAccountingV4(root, 0).syntheticPilotThresholdOutcome = "met"),
      (root: Record<string, unknown>) =>
        ((
          qualityAccountingV4(root, 0).counts as Record<string, unknown>
        ).missingFactCount = 979),
      (root: Record<string, unknown>) =>
        ((
          metricV4(root, 0, "documentSuccess").threshold as Record<
            string,
            unknown
          >
        ).numerator = 94),
      (root: Record<string, unknown>) =>
        (metricV4(root, 0, "factPrecision").defined = false),
      (root: Record<string, unknown>) =>
        (metricV4(root, 0, "factRecall").thresholdKind = "maximum"),
      (root: Record<string, unknown>) =>
        ((
          metricV4(root, 0, "quarantineRate").threshold as Record<
            string,
            unknown
          >
        ).numerator = 6),
      (root: Record<string, unknown>) =>
        (metricV4(root, 0, "silentCriticalFailure").maximumCount = 1),
      (root: Record<string, unknown>) =>
        (metricV4(root, 0, "unitDateTolerance").unitTolerancePolicy =
          "approximate"),
      (root: Record<string, unknown>) =>
        (qualityAccountingV4(root, 0).failedThresholds = [
          "fact_recall_minimum",
          "document_success_minimum",
          "maximum_silent_critical_failures",
        ]),
      (root: Record<string, unknown>) => (outcome(root, 1).invocations = []),
      (root: Record<string, unknown>) =>
        ((root.transition as Record<string, unknown>).entries = records(
          (root.transition as Record<string, unknown>).entries,
        ).slice(1)),
      (root: Record<string, unknown>) =>
        (records(
          (root.transition as Record<string, unknown>).entries,
        )[0]!.status = "A"),
      (root: Record<string, unknown>) =>
        (records(
          (root.transition as Record<string, unknown>).entries,
        )[0]!.path = ".github/workflows/not-the-cycle2n-workflow.yml"),
      (root: Record<string, unknown>) => {
        records((root.transition as Record<string, unknown>).entries).push({
          path: "unexpected.ts",
          status: "A",
        });
        (root.transition as Record<string, unknown>).pathCount = 35;
      },
      (root: Record<string, unknown>) =>
        ((root.summary as Record<string, unknown>).candidateObservationsStable =
          false),
      (root: Record<string, unknown>) =>
        (runtime(root).successfulEvaluationCount = 2),
      (root: Record<string, unknown>) =>
        (workflow(root).artifactName = "wrong"),
    ].entries()) {
      const value = mutableEvidenceV4();
      mutate(value);
      expect(
        () => createFilingParserCrossEngineExecutionEvidenceV4(value as never),
        `mutation ${mutationIndex}`,
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
    }
  });

  it("rejects forged inner quality hashes after every dependent outer hash is recomputed", () => {
    const attacks: readonly ((invocation: Record<string, unknown>) => void)[] =
      [
        (invocation) => {
          invocation.candidateCommitmentSha256 = HASH_Z;
          refreshV4QualityEvaluationBinding(invocation);
          refreshV4OuterBindings(invocation);
        },
        (invocation) => {
          invocation.qualityEvaluationBindingSha256 = HASH_Z;
          refreshV4EvaluationBinding(invocation);
        },
        (invocation) => {
          invocation.measurementEvaluationSha256 = HASH_Z;
          refreshV4QualityEvaluationBinding(invocation);
          refreshV4EvaluationBinding(invocation);
        },
        (invocation) => {
          invocation.candidateObservationsSha256 = HASH_Z;
          refreshV4CandidateCommitment(invocation);
          refreshV4QualityEvaluationBinding(invocation);
          refreshV4OuterBindings(invocation);
        },
        (invocation) => {
          const candidateObservationsSha256 =
            invocation.candidateObservationsSha256;
          invocation.candidateObservationsSha256 =
            invocation.measurementEvaluationSha256;
          invocation.measurementEvaluationSha256 = candidateObservationsSha256;
          refreshV4CandidateCommitment(invocation);
          refreshV4QualityEvaluationBinding(invocation);
          refreshV4OuterBindings(invocation);
        },
      ];
    for (const [attackIndex, attack] of attacks.entries()) {
      const value = mutableEvidenceV4();
      attack(invocationV4(value, 0));
      expect(
        () => createFilingParserCrossEngineExecutionEvidenceV4(value as never),
        `forged inner binding ${attackIndex}`,
      ).toThrow("Filing parser cross-engine execution evidence is invalid.");
    }
  });

  it("rejects noncanonical v4 encodings", () => {
    const canonical =
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV4(
        buildFilingParserCrossEngineExecutionEvidenceV4Input(),
      );
    for (const text of [
      canonical.slice(0, -1),
      ` ${canonical}`,
      canonical.replace("\n", "\n\n"),
    ])
      expect(() =>
        parseCanonicalFilingParserCrossEngineExecutionEvidenceV4(
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
function mutableEvidenceV3(): Record<string, unknown> {
  return structuredClone(
    buildFilingParserCrossEngineExecutionEvidenceV3Input(),
  ) as unknown as Record<string, unknown>;
}
function mutableEvidenceV4(): Record<string, unknown> {
  return structuredClone(
    buildFilingParserCrossEngineExecutionEvidenceV4Input(),
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
function invocationV3(
  root: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  return records(outcome(root, 0).invocations)[index] as Record<
    string,
    unknown
  >;
}
function receiptV3(
  root: Record<string, unknown>,
  invocationIndex: number,
  receiptIndex: number,
): Record<string, unknown> {
  return records(invocationV3(root, invocationIndex).lifecycleReceipts)[
    receiptIndex
  ] as Record<string, unknown>;
}
function invocationV4(
  root: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  return records(outcome(root, 0).invocations)[index] as Record<
    string,
    unknown
  >;
}
function projectionV4(
  root: Record<string, unknown>,
  invocationIndex: number,
  projectionIndex: number,
): Record<string, unknown> {
  return records(invocationV4(root, invocationIndex).projectionReceipts)[
    projectionIndex
  ] as Record<string, unknown>;
}
function sourceExecutionV4(
  root: Record<string, unknown>,
  invocationIndex: number,
): Record<string, unknown> {
  return invocationV4(root, invocationIndex).sourceExecution as Record<
    string,
    unknown
  >;
}
function qualityAccountingV4(
  root: Record<string, unknown>,
  invocationIndex: number,
): Record<string, unknown> {
  return invocationV4(root, invocationIndex).qualityAccounting as Record<
    string,
    unknown
  >;
}
function metricV4(
  root: Record<string, unknown>,
  invocationIndex: number,
  metric: string,
): Record<string, unknown> {
  return (
    qualityAccountingV4(root, invocationIndex).metrics as Record<
      string,
      Record<string, unknown>
    >
  )[metric] as Record<string, unknown>;
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

function refreshV4CandidateCommitment(
  invocation: Record<string, unknown>,
): void {
  invocation.candidateCommitmentSha256 = testDomainCanonicalSha256(
    "research-cockpit:synthetic-filing-quality-precommitment:v1\u0000",
    {
      candidateObservationsSha256: invocation.candidateObservationsSha256,
      claim:
        "bounded_synthetic_in_process_one_shot_candidate_observation_commit_before_declared_reference_reveal_and_fail_closed_quality_evaluation",
      declaredReferenceSha256: invocation.declaredReferenceSha256,
      planSha256: invocation.planSha256,
      schemaVersion: "1.0.0",
    },
    true,
  );
}

function refreshV4QualityEvaluationBinding(
  invocation: Record<string, unknown>,
): void {
  invocation.qualityEvaluationBindingSha256 = testDomainCanonicalSha256(
    "research-cockpit:synthetic-filing-quality-precommitment-evaluation:v1\u0000",
    {
      candidateCommitmentSha256: invocation.candidateCommitmentSha256,
      candidateObservationsSha256: invocation.candidateObservationsSha256,
      measurementEvaluationSha256: invocation.measurementEvaluationSha256,
      planSha256: invocation.planSha256,
    },
    true,
  );
}

function refreshV4OuterBindings(invocation: Record<string, unknown>): void {
  invocation.compositionCommitmentSha256 =
    filingParserCrossEngineExecutionV4CompositionCommitmentSha256(
      invocation as never,
    );
  refreshV4EvaluationBinding(invocation);
}

function refreshV4EvaluationBinding(invocation: Record<string, unknown>): void {
  invocation.evaluationBindingSha256 =
    filingParserCrossEngineExecutionV4EvaluationBindingSha256(
      invocation as never,
    );
}

function testDomainCanonicalSha256(
  domain: string,
  value: unknown,
  newline: boolean,
): `sha256:${string}` {
  const hash = createHash("sha256");
  hash.update(domain, "utf8");
  hash.update(`${testCanonicalJson(value)}${newline ? "\n" : ""}`, "utf8");
  return `sha256:${hash.digest("hex")}`;
}

function testCanonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((child) => testCanonicalJson(child)).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${testCanonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}
