import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_VALIDATION_STAGES,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_VALIDATION_STAGES,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CASE_IDS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_VALIDATION_STAGES,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VALIDATION_STAGES,
} from "./filing-parser-cross-engine-execution-evidence";
import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CASE_IDS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_VALIDATION_STAGES,
} from "./filing-parser-cross-engine-execution-evidence-v5";

import {
  ACCEPTANCE_PHASES,
  NODE_IMAGE_INSPECTION_PROFILE,
  PYTHON_IMAGE_INSPECTION_PROFILE,
  filingParserCrossEngineExecutionAcceptanceCleanupShouldReplacePhase,
  filingParserCrossEngineExecutionAcceptanceFailureDiagnostic,
  filingParserCrossEngineExecutionEvidenceV2ValidationPhase,
  filingParserCrossEngineExecutionEvidenceV3ValidationPhase,
  filingParserCrossEngineExecutionEvidenceV4ValidationPhase,
  filingParserCrossEngineExecutionEvidenceV5ValidationPhase,
  filingParserCrossEngineExecutionEvidenceValidationPhase,
  imageIdValue,
  parseFilingParserCrossEngineExecutionNulTransition,
  validateBuiltImageInspection,
} from "./run-filing-parser-cross-engine-execution-acceptance";

const IMAGE = `sha256:${"1".repeat(64)}` as const;
const DIAGNOSTIC_PREFIX =
  "filing_parser_cross_engine_execution_acceptance_failed phase=";
const runnerSource = readFileSync(
  fileURLToPath(
    new URL(
      "./run-filing-parser-cross-engine-execution-acceptance.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);
const workflowSource = readFileSync(
  fileURLToPath(
    new URL(
      "../../../.github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("Cycle 2o custody-quality-composition live acceptance", () => {
  it("emits only closed value-free phase diagnostics", () => {
    expect(Object.isFrozen(ACCEPTANCE_PHASES)).toBe(true);
    expect(ACCEPTANCE_PHASES).toEqual([
      "environment",
      "repository_anchor",
      "source_inventory",
      "image_metadata",
      "staging",
      "image_build",
      "image_inspection",
      "quality_setup",
      "quality_success_first",
      "quality_success_second",
      "quality_success_validation",
      "adversarial_declared_reference_digest_mismatch",
      "adversarial_quality_capability_replay",
      "adversarial_reference_content_at_commit",
      "adversarial_original_archive_tamper",
      "adversarial_original_amendment_role_swap",
      "quality_residue",
      "tool_versions",
      "evidence_assembly",
      "evidence_validation_root_contract",
      "evidence_validation_timestamps",
      "evidence_validation_claim_tuples",
      "evidence_validation_historical_evidence",
      "evidence_validation_composition_validation",
      "evidence_validation_direct_execution_validation",
      "evidence_validation_case_outcomes",
      "evidence_validation_source_bindings",
      "evidence_validation_quality_bindings",
      "evidence_validation_lifecycle_bindings",
      "evidence_validation_outer_invocation_bindings",
      "evidence_validation_transition",
      "evidence_validation_runtime",
      "evidence_validation_source_hashes",
      "evidence_validation_engines",
      "evidence_validation_fixture_binding",
      "evidence_validation_summary",
      "evidence_validation_tools_contract",
      "evidence_validation_workflow",
      "evidence_validation_canonical_freeze",
      "evidence_validation_historical_v1",
      "evidence_validation_binding_validation",
      "evidence_validation_tool_docker_client",
      "evidence_validation_tool_docker_server",
      "evidence_validation_tool_git",
      "evidence_validation_tool_node",
      "evidence_validation_tool_pnpm",
      "evidence_validation_tool_python",
      "image_removal",
      "evidence_write",
      "cleanup",
    ]);
    for (const phase of ACCEPTANCE_PHASES) {
      const diagnostic =
        filingParserCrossEngineExecutionAcceptanceFailureDiagnostic(phase);
      expect(diagnostic).toBe(`${DIAGNOSTIC_PREFIX}${phase}\n`);
      expect(diagnostic.match(/\n/gu)).toHaveLength(1);
      expect(diagnostic).not.toMatch(
        /sha256:|github\.com|artifact[_=:]|revision[_=:]|secret[_=:]|token[_=:]|key[_=:]/iu,
      );
    }
  });

  it("maps every v4 validation stage to its closed acceptance phase", () => {
    for (const stage of FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_VALIDATION_STAGES) {
      const phase =
        filingParserCrossEngineExecutionEvidenceV4ValidationPhase(stage);
      expect(phase).toBe(`evidence_validation_${stage}`);
      expect(ACCEPTANCE_PHASES).toContain(phase);
    }
  });

  it("maps every v5 validation stage to its closed acceptance phase", () => {
    for (const stage of FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_VALIDATION_STAGES)
      expect(ACCEPTANCE_PHASES).toContain(
        filingParserCrossEngineExecutionEvidenceV5ValidationPhase(stage),
      );
  });

  it("retains the historical v1, v2, and v3 diagnostic mappers", () => {
    for (const stage of FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VALIDATION_STAGES)
      expect(ACCEPTANCE_PHASES).toContain(
        filingParserCrossEngineExecutionEvidenceValidationPhase(stage),
      );
    for (const stage of FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_VALIDATION_STAGES)
      expect(ACCEPTANCE_PHASES).toContain(
        filingParserCrossEngineExecutionEvidenceV2ValidationPhase(stage),
      );
    for (const stage of FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_VALIDATION_STAGES)
      expect(ACCEPTANCE_PHASES).toContain(
        filingParserCrossEngineExecutionEvidenceV3ValidationPhase(stage),
      );
  });

  it("does not inspect or reflect a hostile unknown diagnostic phase", () => {
    let reads = 0;
    const hostile = new Proxy(
      {},
      {
        get: () => {
          reads += 1;
          throw new Error("must not inspect input");
        },
        getPrototypeOf: () => {
          reads += 1;
          throw new Error("must not inspect input");
        },
      },
    );
    for (const value of [
      undefined,
      null,
      "evidence_write\nsecret=value",
      `sha256:${"a".repeat(64)}`,
      hostile,
    ])
      expect(
        filingParserCrossEngineExecutionAcceptanceFailureDiagnostic(value),
      ).toBe(`${DIAGNOSTIC_PREFIX}internal\n`);
    expect(reads).toBe(0);
  });

  it("preserves a primary failure and replaces only cleanup-primary failure", () => {
    expect(
      filingParserCrossEngineExecutionAcceptanceCleanupShouldReplacePhase(true),
    ).toBe(false);
    expect(
      filingParserCrossEngineExecutionAcceptanceCleanupShouldReplacePhase(
        false,
      ),
    ).toBe(true);
  });

  it("uses only the public exact-5 custody-quality protocol", () => {
    expect(runnerSource).toContain(
      "createFilingParserCustodyQualityCompositionProtocol(configuration)",
    );
    expect(runnerSource).not.toContain(
      "createFilingParserCrossEngineDirectExecutionBoundary",
    );
    expect(runnerSource).not.toContain("ForTest");
    expect(runnerSource).not.toContain("processRunner:");
    expect(runnerSource).not.toContain("generateKeyPairSync");
    expect(runnerSource).not.toContain(
      "createFilingParserNormalizationExecutionBoundary",
    );
    expect(runnerSource).toContain(
      "const contentAtCommit = await Reflect.apply(",
    );
    expect(runnerSource).toContain(
      "archives.amendmentArchive,\n        quality.declaredReference,",
    );
    expect(runnerSource).toContain("custodyCommitCount: 4 as const");
    expect(runnerSource).toContain("authenticatedReadbackCount: 8 as const");
    expect(runnerSource).toContain("successfulEvaluationCount: 3 as const");
    expect(runnerSource).toContain(
      "successfulLifecycleReceiptCount: 16 as const",
    );
    expect(runnerSource).toContain("custodyCleanupCount: 4 as const");
    expect(runnerSource).toContain(
      "Object.getPrototypeOf(result.capability) !== null",
    );
    expect(runnerSource).toContain("!Object.isFrozen(result.measurement)");
  });

  it("freezes the exact six ordered v4 outcome IDs", () => {
    expect(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_CASE_IDS).toEqual([
      "same-input-quality-evaluation-distinct-lifecycle-invocations",
      "declared-reference-digest-mismatch",
      "quality-capability-replay",
      "reference-content-at-commit",
      "original-archive-tamper",
      "original-amendment-role-swap",
    ]);
    expect(runnerSource).toContain(
      "const outcomes = Object.freeze([\n      successOutcome,\n      mismatchOutcome,\n      replayOutcome,\n      contentAtCommitOutcome,\n      tamperedOutcome,\n      swappedOutcome,",
    );
  });

  it("freezes the exact six ordered v5 outcome IDs", () => {
    expect(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CASE_IDS).toEqual([
      "same-input-custody-quality-evaluation-distinct-custody-invocations",
      "declared-reference-digest-mismatch",
      "custody-quality-capability-replay",
      "reference-content-at-commit",
      "original-archive-tamper",
      "original-amendment-role-swap",
    ]);
  });

  it("requires the NUL-safe direct child of the Cycle 2o baseline", () => {
    expect(runnerSource).toContain(
      "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE,\n    revision,",
    );
    expect(runnerSource).toContain('successorCount !== "1"');
    expect(runnerSource).toContain('firstParentCount !== "1"');
    expect(runnerSource).toContain("parentLine !== `${revision} ${base}`");
    expect(runnerSource).toContain(
      '["diff", "--name-status", "--no-renames", "-z", base, revision, "--"]',
    );
    expect(runnerSource).toContain(
      "filingParserCrossEngineExecutionV5RequiredSourcePaths(transition)",
    );
    expect(runnerSource).toContain("const CYCLE_2O_TRANSITION_PATH_COUNT = 39");
    expect(runnerSource).toContain(
      '"sha256:d830b547c4c0727bd948267819a01e8beba575e2d80d8a5e89fd1d8542b30212"',
    );
    expect(runnerSource).toContain(
      "entries.length !== CYCLE_2O_TRANSITION_PATH_COUNT",
    );
    expect(runnerSource).toContain(
      "sha256(output) !== CYCLE_2O_TRANSITION_SHA256",
    );
    expect(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE).toBe(
      "711fe866594d5e20a657a24c0a0c72fd78ab90be",
    );
  });

  it("parses only alternating A/M NUL fields without filename splitting", () => {
    const encoded = new TextEncoder().encode(
      "M\0line\nname.ts\0A\0tab\tname.ts\0",
    );
    expect(parseFilingParserCrossEngineExecutionNulTransition(encoded)).toEqual(
      [
        { path: "line\nname.ts", status: "M" },
        { path: "tab\tname.ts", status: "A" },
      ],
    );
    for (const malformed of [
      new Uint8Array(),
      new TextEncoder().encode("M\0path"),
      new TextEncoder().encode("M\0path\0A\0"),
      new TextEncoder().encode("M\0\0"),
      new TextEncoder().encode("R100\0old\0new\0"),
      Uint8Array.of(0xff, 0),
    ])
      expect(() =>
        parseFilingParserCrossEngineExecutionNulTransition(malformed),
      ).toThrow("acceptance failed");
  });

  it("writes only canonical v5 evidence after image removal", () => {
    const removal = runnerSource.indexOf('markPhase("image_removal")');
    const write = runnerSource.indexOf('markPhase("evidence_write")');
    expect(removal).toBeGreaterThan(0);
    expect(write).toBeGreaterThan(removal);
    expect(runnerSource).toContain(
      "serializeCanonicalFilingParserCrossEngineExecutionEvidenceV5(evidence)",
    );
    expect(runnerSource).toContain(
      "research-cockpit-filing-parser-cross-engine-execution-v5.json",
    );
    expect(runnerSource).toContain(
      "await assertPathAbsent(environment.evidencePath)",
    );
    expect(runnerSource).toContain(
      "await rename(temporaryEvidencePath, environment.evidencePath)",
    );
    expect(runnerSource).toContain("evidenceWritten = true");
  });

  it("routes only the Cycle 2o source to v5 and preserves inherited routes", () => {
    expect(workflowSource.indexOf("id: cycle2o_source")).toBeLessThan(
      workflowSource.indexOf("id: admission_validity_bridge"),
    );
    expect(workflowSource.indexOf("id: cycle2n_source")).toBeLessThan(
      workflowSource.indexOf("id: legacy_bridge"),
    );
    expect(workflowSource).toContain(
      'baseline="09e76235b5683427f2dd3201aefa740bb5adb16e"',
    );
    expect(workflowSource).toContain(
      'transition_sha256" == "fba65e4ad0f41de9570b7b7f79edd9f4d291337ca76c4e7d9b7b3466e042ad10"',
    );
    expect(workflowSource).toContain('"${#actual[@]}" == "78"');
    expect(workflowSource).toContain(
      'transition_sha256" == "d830b547c4c0727bd948267819a01e8beba575e2d80d8a5e89fd1d8542b30212"',
    );
    expect(workflowSource).toContain(
      "research-cockpit-filing-parser-cross-engine-execution-v5.json",
    );
    expect(workflowSource).toContain(
      "filing-parser-cross-engine-execution-evidence-v5-${GITHUB_SHA}-${GITHUB_RUN_ATTEMPT}",
    );
    expect(workflowSource).toContain(
      "pnpm --filter @research-cockpit/filing-parser-quality-composition test",
    );
    expect(workflowSource).toContain(
      "pnpm --filter @research-cockpit/filing-parser-custody-quality-composition test",
    );
    expect(workflowSource).toContain(
      "Unrecognized evidence source route; refusing to mint or silently skip evidence.",
    );
    expect(workflowSource).toContain("exit 1");
  });

  it("accepts only exact lowercase Docker image IDs", () => {
    expect(imageIdValue(IMAGE)).toBe(IMAGE);
    for (const value of [
      `${IMAGE}\n`,
      IMAGE.toUpperCase(),
      IMAGE.slice(0, -1),
      ` ${IMAGE}`,
      `sha512:${"1".repeat(64)}`,
    ])
      expect(() => imageIdValue(value)).toThrow("acceptance failed");
  });

  it("accepts only the exact pinned non-root image profiles", () => {
    for (const profile of [
      PYTHON_IMAGE_INSPECTION_PROFILE,
      NODE_IMAGE_INSPECTION_PROFILE,
    ]) {
      const value = validImageInspection(profile);
      expect(() =>
        validateBuiltImageInspection(value, IMAGE, profile),
      ).not.toThrow();
      for (const mutate of [
        (copy: ReturnType<typeof validImageInspection>) => {
          copy[0]!.Architecture = "arm64";
        },
        (copy: ReturnType<typeof validImageInspection>) => {
          copy[0]!.Config.User = "0:0";
        },
        (copy: ReturnType<typeof validImageInspection>) => {
          (copy[0]!.Config as { WorkingDir: string }).WorkingDir = "/tmp";
        },
        (copy: ReturnType<typeof validImageInspection>) => {
          copy[0]!.Config.Env.push("SECRET=value");
        },
      ]) {
        const copy = structuredClone(value);
        mutate(copy);
        expect(() =>
          validateBuiltImageInspection(copy, IMAGE, profile),
        ).toThrow("acceptance failed");
      }
    }
  });
});

function validImageInspection(
  profile:
    | typeof NODE_IMAGE_INSPECTION_PROFILE
    | typeof PYTHON_IMAGE_INSPECTION_PROFILE,
) {
  return [
    {
      Architecture: "amd64",
      Config: {
        Cmd: [],
        Entrypoint: [...profile.entrypoint],
        Env: ["LANG=C.UTF-8", "TZ=UTC"],
        ExposedPorts: null,
        User: "65532:65532",
        WorkingDir: profile.workingDirectory,
      },
      Id: IMAGE,
      Os: "linux",
    },
  ];
}
