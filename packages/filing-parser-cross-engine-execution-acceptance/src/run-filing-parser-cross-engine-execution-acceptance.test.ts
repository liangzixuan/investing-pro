import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_VALIDATION_STAGES,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CASE_IDS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_VALIDATION_STAGES,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VALIDATION_STAGES,
} from "./filing-parser-cross-engine-execution-evidence";

import {
  ACCEPTANCE_PHASES,
  NODE_IMAGE_INSPECTION_PROFILE,
  PYTHON_IMAGE_INSPECTION_PROFILE,
  filingParserCrossEngineExecutionAcceptanceCleanupShouldReplacePhase,
  filingParserCrossEngineExecutionAcceptanceFailureDiagnostic,
  filingParserCrossEngineExecutionEvidenceV2ValidationPhase,
  filingParserCrossEngineExecutionEvidenceV3ValidationPhase,
  filingParserCrossEngineExecutionEvidenceValidationPhase,
  imageIdValue,
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

describe("Cycle 2m direct Docker live acceptance", () => {
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
      "direct_setup",
      "direct_success_first",
      "direct_success_second",
      "direct_success_validation",
      "adversarial_unknown_python_image",
      "adversarial_pre_aborted_signal",
      "adversarial_original_archive_tamper",
      "adversarial_original_amendment_role_swap",
      "adversarial_identical_archives",
      "direct_residue",
      "tool_versions",
      "evidence_assembly",
      "evidence_validation_root_contract",
      "evidence_validation_timestamps",
      "evidence_validation_claim_tuples",
      "evidence_validation_historical_evidence",
      "evidence_validation_direct_execution_validation",
      "evidence_validation_case_outcomes",
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

  it("maps every v3 validation stage to its closed acceptance phase", () => {
    for (const stage of FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_VALIDATION_STAGES) {
      const phase =
        filingParserCrossEngineExecutionEvidenceV3ValidationPhase(stage);
      expect(phase).toBe(`evidence_validation_${stage}`);
      expect(ACCEPTANCE_PHASES).toContain(phase);
    }
  });

  it("retains the historical v1 and v2 diagnostic mappers", () => {
    for (const stage of FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_VALIDATION_STAGES)
      expect(ACCEPTANCE_PHASES).toContain(
        filingParserCrossEngineExecutionEvidenceValidationPhase(stage),
      );
    for (const stage of FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_VALIDATION_STAGES)
      expect(ACCEPTANCE_PHASES).toContain(
        filingParserCrossEngineExecutionEvidenceV2ValidationPhase(stage),
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

  it("uses only the public source-owned direct boundary for live executions", () => {
    expect(runnerSource).toContain(
      "createFilingParserCrossEngineDirectExecutionBoundary({",
    );
    expect(runnerSource).not.toContain(
      "createFilingParserCrossEngineDirectExecutionBoundaryForTest",
    );
    expect(runnerSource).not.toContain("processRunner:");
    expect(runnerSource).not.toContain("generateKeyPairSync");
    expect(runnerSource).not.toContain(
      "createFilingParserNormalizationExecutionBoundary",
    );
    expect(
      runnerSource.match(/const (first|second) = await boundary\.execute\(/gu),
    ).toHaveLength(2);
    expect(runnerSource).toContain(
      "const containerIds = new Set(\n    receipts.map((receipt) => receipt.containerIdSha256),\n  )",
    );
    expect(runnerSource).toContain("containerIds.size !== 8");
    expect(runnerSource).toContain("lifecycleBindings.size !== 8");
  });

  it("freezes the exact six ordered v3 outcome IDs", () => {
    expect(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_CASE_IDS).toEqual([
      "same-input-direct-docker-distinct-lifecycle-invocations",
      "unknown-python-image",
      "pre-aborted-signal",
      "original-archive-tamper",
      "original-amendment-role-swap",
      "identical-archives",
    ]);
    expect(runnerSource).toContain(
      "const outcomes = Object.freeze([\n      successOutcome,\n      unknownImageOutcome,\n      preAbortedOutcome,\n      tamperedOutcome,\n      swappedOutcome,\n      identicalOutcome,",
    );
  });

  it("requires one exact direct child of the frozen Cycle 2m baseline", () => {
    expect(runnerSource).toContain(
      "const base = FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE",
    );
    expect(runnerSource).toContain('successorCount !== "1"');
    expect(runnerSource).toContain('firstParentCount !== "1"');
    expect(runnerSource).toContain("parentLine !== `${revision} ${base}`");
    expect(runnerSource).toContain(
      '["diff", "--name-status", "--no-renames", base, revision]',
    );
    expect(runnerSource).toContain(
      "filingParserCrossEngineExecutionV3RequiredSourcePaths(transition)",
    );
  });

  it("writes only canonical v3 evidence after image removal", () => {
    const removal = runnerSource.indexOf('markPhase("image_removal")');
    const write = runnerSource.indexOf('markPhase("evidence_write")');
    expect(removal).toBeGreaterThan(0);
    expect(write).toBeGreaterThan(removal);
    expect(runnerSource).toContain(
      "serializeCanonicalFilingParserCrossEngineExecutionEvidenceV3(evidence)",
    );
    expect(runnerSource).toContain(
      "research-cockpit-filing-parser-cross-engine-execution-v3.json",
    );
    expect(runnerSource).toContain(
      "await assertPathAbsent(environment.evidencePath)",
    );
    expect(runnerSource).toContain(
      "await rename(temporaryEvidencePath, environment.evidencePath)",
    );
    expect(runnerSource).toContain("evidenceWritten = true");
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
