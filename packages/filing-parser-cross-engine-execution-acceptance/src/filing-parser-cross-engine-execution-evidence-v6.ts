import { createHash } from "node:crypto";
import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY,
} from "./filing-parser-cross-engine-execution-evidence";
import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CHECKS,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CLAIM,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_NOT_PROVEN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_WORKFLOW,
  filingParserCrossEngineExecutionV5RequiredSourcePaths,
  normalizeFilingParserCrossEngineExecutionDomain,
  filingParserCrossEngineEvidenceCanonicalJson as canonicalJson,
  filingParserCrossEngineEvidenceSnapshot as snapshot,
  freezeFilingParserCrossEngineEvidence as freeze,
  type FilingParserCrossEngineExecutionEvidenceV5,
  type FilingParserCrossEngineExecutionEvidenceV5ValidationStage,
} from "./filing-parser-cross-engine-execution-evidence-v5";

// Current evidence binds the actual running revision. These anchors describe
// historical provenance only; no historical successor count applies to HEAD.
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_V6_SOURCE_BOUNDARY =
  Object.freeze({
    policy: "exact_current_committed_sources" as const,
    historicalAnchor: "65cb08c94dd8767d1a59b01dd1b7a355d5c5667e" as const,
  });
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_V5_HISTORICAL_BOUNDARY =
  Object.freeze({
    baseline: "711fe866594d5e20a657a24c0a0c72fd78ab90be" as const,
    sourceRevision: "46408ec875755ef531c124846143e9b619c1961f" as const,
    correctiveRevision: "472cc10b8df90bee01925b2efd4fbcb614d7590c" as const,
    transitionPathCount: 39 as const,
    transitionSha256:
      "sha256:d830b547c4c0727bd948267819a01e8beba575e2d80d8a5e89fd1d8542b30212" as const,
    correctivePathCount: 14 as const,
    correctiveSha256:
      "sha256:5104d3ef85cfcee8e62010d9a76e3efbf0479dcf7f777fa784e956620b02df63" as const,
  });
const HISTORICAL_TRANSITION = [
  {
    status: "M",
    path: ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml",
  },
  {
    status: "M",
    path: "README.md",
  },
  {
    status: "M",
    path: "docs/BUILD_ROADMAP.md",
  },
  {
    status: "M",
    path: "docs/CANONICAL_MODEL.md",
  },
  {
    status: "A",
    path: "docs/CYCLE_2O_EXIT_MATRIX.md",
  },
  {
    status: "M",
    path: "docs/THREAT_MODEL.md",
  },
  {
    status: "A",
    path: "docs/adr/0042-bounded-synthetic-parser-archive-custody-quality-composition.md",
  },
  {
    status: "A",
    path: "fixtures/synthetic/filing-parser-cross-engine-execution/v5/cases.json",
  },
  {
    status: "A",
    path: "fixtures/synthetic/filing-parser-cross-engine-execution/v5/manifest.json",
  },
  {
    status: "M",
    path: "packages/filing-parser-cross-engine-execution-acceptance/package.json",
  },
  {
    status: "M",
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-review.ts",
  },
  {
    status: "A",
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-v5.test.ts",
  },
  {
    status: "A",
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-v5.ts",
  },
  {
    status: "A",
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier-v5.test.ts",
  },
  {
    status: "A",
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier-v5.ts",
  },
  {
    status: "M",
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-verifier.ts",
  },
  {
    status: "M",
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence.ts",
  },
  {
    status: "M",
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/index.ts",
  },
  {
    status: "M",
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.test.ts",
  },
  {
    status: "M",
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/run-filing-parser-cross-engine-execution-acceptance.ts",
  },
  {
    status: "M",
    path: "packages/filing-parser-cross-engine-execution-acceptance/src/test-filing-parser-cross-engine-execution-evidence-builder.ts",
  },
  {
    status: "A",
    path: "packages/filing-parser-custody-quality-composition/package.json",
  },
  {
    status: "A",
    path: "packages/filing-parser-custody-quality-composition/src/filing-parser-custody-quality-composition-security.test.ts",
  },
  {
    status: "A",
    path: "packages/filing-parser-custody-quality-composition/src/filing-parser-custody-quality-composition.test.ts",
  },
  {
    status: "A",
    path: "packages/filing-parser-custody-quality-composition/src/filing-parser-custody-quality-composition.ts",
  },
  {
    status: "A",
    path: "packages/filing-parser-custody-quality-composition/src/index.ts",
  },
  {
    status: "A",
    path: "packages/filing-parser-custody-quality-composition/src/test-filing-parser-custody-quality-composition-builder.ts",
  },
  {
    status: "A",
    path: "packages/filing-parser-custody-quality-composition/tsconfig.json",
  },
  {
    status: "M",
    path: "packages/filing-parser/src/filing-parser-evidence-verifier.test.ts",
  },
  {
    status: "M",
    path: "packages/filing-parser/src/filing-parser-evidence-verifier.ts",
  },
  {
    status: "M",
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts",
  },
  {
    status: "M",
    path: "packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts",
  },
  {
    status: "M",
    path: "packages/filing-payload-custody/src/index.ts",
  },
  {
    status: "A",
    path: "packages/filing-payload-custody/src/parser-archive-pair-custody.test.ts",
  },
  {
    status: "A",
    path: "packages/filing-payload-custody/src/parser-archive-pair-custody.ts",
  },
  {
    status: "A",
    path: "packages/filing-payload-custody/src/parser-archive-pair-fixture.ts",
  },
  {
    status: "M",
    path: "pnpm-lock.yaml",
  },
  {
    status: "M",
    path: "scripts/verify-boundaries.ts",
  },
  {
    status: "M",
    path: "scripts/verify-filing-parser-cross-engine-execution-fixtures.ts",
  },
] as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_V6_SOURCE_PATHS =
  Object.freeze(
    [
      ...filingParserCrossEngineExecutionV5RequiredSourcePaths(
        HISTORICAL_TRANSITION,
      ),
      "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-v6.ts",
      "packages/filing-parser-cross-engine-execution-acceptance/src/filing-parser-cross-engine-execution-evidence-v6.test.ts",
    ].sort(),
  );
export type FilingParserCrossEngineExecutionEvidenceV6 = Omit<
  FilingParserCrossEngineExecutionEvidenceV5,
  "baseline" | "transition" | "schemaVersion" | "evidenceVersion"
> & {
  readonly schemaVersion: "6.0.0";
  readonly evidenceVersion: 6;
  readonly sourceBoundary: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_V6_SOURCE_BOUNDARY;
  readonly historicalV5: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_V5_HISTORICAL_BOUNDARY;
};
export function createFilingParserCrossEngineExecutionEvidenceV6(
  value: FilingParserCrossEngineExecutionEvidenceV6,
  markStage?: (
    stage: FilingParserCrossEngineExecutionEvidenceV5ValidationStage,
  ) => void,
): FilingParserCrossEngineExecutionEvidenceV6 {
  const root = snapshot(value) as Record<string, unknown>;
  const keys = [
    "caseOutcomes",
    "checksPassed",
    "claim",
    "completedAt",
    "custodyValidation",
    "engines",
    "evidenceVersion",
    "fixtureManifestSha256",
    "historicalV1",
    "historicalV2",
    "historicalV3",
    "historicalV4",
    "historicalV5",
    "notProven",
    "repository",
    "revision",
    "runtime",
    "schemaVersion",
    "sourceBoundary",
    "sourceHashes",
    "startedAt",
    "status",
    "summary",
    "synthetic",
    "tools",
    "workflow",
  ];
  if (
    !root ||
    Array.isArray(root) ||
    canonicalJson(Object.keys(root).sort()) !== canonicalJson(keys.sort()) ||
    root.schemaVersion !== "6.0.0" ||
    root.evidenceVersion !== 6 ||
    root.status !== "passed" ||
    root.synthetic !== true ||
    typeof root.repository !== "string" ||
    root.repository.length === 0 ||
    typeof root.revision !== "string" ||
    !/^[0-9a-f]{40}$/u.test(root.revision)
  )
    fail();
  markStage?.("root_contract");
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
  if (
    typeof root.startedAt !== "string" ||
    typeof root.completedAt !== "string" ||
    !iso.test(root.startedAt) ||
    !iso.test(root.completedAt) ||
    !Number.isFinite(Date.parse(root.startedAt)) ||
    !Number.isFinite(Date.parse(root.completedAt)) ||
    Date.parse(root.completedAt) < Date.parse(root.startedAt)
  )
    fail();
  markStage?.("timestamps");
  if (
    root.claim !== FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CLAIM ||
    canonicalJson(root.checksPassed) !==
      canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CHECKS) ||
    canonicalJson(root.notProven) !==
      canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_NOT_PROVEN)
  )
    fail();
  markStage?.("claim_tuples");
  for (const [key, expected] of Object.entries({
    historicalV1: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
    historicalV2: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
    historicalV3: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY,
    historicalV4: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_HISTORY,
    historicalV5: FILING_PARSER_CROSS_ENGINE_EXECUTION_V5_HISTORICAL_BOUNDARY,
    sourceBoundary: FILING_PARSER_CROSS_ENGINE_EXECUTION_V6_SOURCE_BOUNDARY,
  }))
    if (canonicalJson(root[key]) !== canonicalJson(expected)) fail();
  markStage?.("historical_evidence");
  const domain = normalizeFilingParserCrossEngineExecutionDomain(
    root,
    () => FILING_PARSER_CROSS_ENGINE_EXECUTION_V6_SOURCE_PATHS,
    markStage,
  );
  const workflow =
    root.workflow as FilingParserCrossEngineExecutionEvidenceV6["workflow"];
  if (
    !workflow ||
    Array.isArray(workflow) ||
    canonicalJson(Object.keys(workflow).sort()) !==
      canonicalJson([
        "artifactName",
        "event",
        "job",
        "ref",
        "runAttempt",
        "runId",
        "workflowName",
      ]) ||
    workflow.artifactName !==
      `filing-parser-cross-engine-execution-evidence-v6-${root.revision}-${workflow.runAttempt}` ||
    typeof workflow.event !== "string" ||
    workflow.event.length === 0 ||
    workflow.job !== "acceptance" ||
    typeof workflow.ref !== "string" ||
    workflow.ref.length === 0 ||
    !Number.isSafeInteger(workflow.runAttempt) ||
    workflow.runAttempt < 1 ||
    typeof workflow.runId !== "string" ||
    !/^[1-9][0-9]*$/u.test(workflow.runId) ||
    workflow.workflowName !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_WORKFLOW
  )
    fail();
  markStage?.("workflow");
  const result = freeze({
    ...root,
    ...domain,
  }) as unknown as FilingParserCrossEngineExecutionEvidenceV6;
  markStage?.("canonical_freeze");
  return result;
}
export function serializeCanonicalFilingParserCrossEngineExecutionEvidenceV6(
  value: FilingParserCrossEngineExecutionEvidenceV6,
): string {
  return `${canonicalJson(createFilingParserCrossEngineExecutionEvidenceV6(value))}\n`;
}
export function parseCanonicalFilingParserCrossEngineExecutionEvidenceV6(
  bytes: Uint8Array,
): FilingParserCrossEngineExecutionEvidenceV6 {
  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    if (!text.endsWith("\n") || text.startsWith("\ufeff")) fail();
    const evidence = createFilingParserCrossEngineExecutionEvidenceV6(
      JSON.parse(text) as FilingParserCrossEngineExecutionEvidenceV6,
    );
    if (
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV6(evidence) !==
      text
    )
      fail();
    return evidence;
  } catch {
    return fail();
  }
}
export function filingParserCrossEngineExecutionEvidenceV6Sha256(
  value: FilingParserCrossEngineExecutionEvidenceV6,
): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(serializeCanonicalFilingParserCrossEngineExecutionEvidenceV6(value)).digest("hex")}`;
}
function fail(): never {
  throw new TypeError(
    "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V6_INVALID",
  );
}
