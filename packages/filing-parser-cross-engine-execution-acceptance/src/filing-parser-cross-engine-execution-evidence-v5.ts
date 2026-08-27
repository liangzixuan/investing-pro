import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CHECKS,
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_NOT_PROVEN,
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CUSTODY_PROFILE,
  type FilingParserCustodyQualityCompositionAudit,
  type FilingParserCustodyQualityCompositionEvaluatedResult,
  type FilingParserCustodyQualityCompositionQuality,
} from "@research-cockpit/filing-parser-custody-quality-composition";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE,
  FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS,
  filingParserCrossEngineExecutionV4ExpectedInnerBindings,
  filingParserCrossEngineImplementationSha256,
  verifyFilingParserCrossEngineExecutionV4Invocation,
  filingParserCrossEngineExecutionV4RequiredSourcePaths,
  type FilingParserCrossEngineExecutionEvidenceEngine,
  type FilingParserCrossEngineExecutionEvidenceSourceHash,
  type FilingParserCrossEngineExecutionEvidenceTransitionEntry,
} from "./filing-parser-cross-engine-execution-evidence";

type Sha256 = `sha256:${string}`;
type QualityMeasurement =
  FilingParserCustodyQualityCompositionEvaluatedResult["measurement"];
type CustodyReceipt =
  FilingParserCustodyQualityCompositionEvaluatedResult["custody"]["receipts"][number];

const CUSTODY_CLAIM =
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CUSTODY_PROFILE.claim;
const CUSTODY_SCHEMA_VERSION =
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CUSTODY_PROFILE.schemaVersion;
const CUSTODY_ALGORITHM =
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CUSTODY_PROFILE.algorithm;
const CUSTODY_FIXTURES =
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CUSTODY_PROFILE.fixtures;

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_SCHEMA_VERSION =
  "5.0.0" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_VERSION =
  5 as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE =
  "711fe866594d5e20a657a24c0a0c72fd78ab90be" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CLAIM =
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_WORKFLOW =
  "Filing parser cross-engine execution acceptance" as const;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CHECKS =
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CHECKS;
export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_NOT_PROVEN =
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_NOT_PROVEN;

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_HISTORY =
  Object.freeze({
    artifactId: "9632073116" as const,
    baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE,
    claimStatus: "historical_pass" as const,
    evidenceSha256:
      "sha256:4fdbb860468413929968c56cf72037a0f72b65669b3ae9c46844476bddf12c5c" as const,
    evidenceVersion: 4 as const,
    jobId: "98398989554" as const,
    promotionRevision: "75fbe518efe1c5879b1adcd50dacec709444e8de" as const,
    runId: "33036093863" as const,
    sourceRevision: "1d7dee56c66c1ad0f5d612603567adf2589e0930" as const,
  });

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CASE_IDS =
  Object.freeze([
    "same-input-custody-quality-evaluation-distinct-custody-invocations",
    "declared-reference-digest-mismatch",
    "custody-quality-capability-replay",
    "reference-content-at-commit",
    "original-archive-tamper",
    "original-amendment-role-swap",
  ] as const);
export type FilingParserCrossEngineExecutionEvidenceV5CaseId =
  (typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CASE_IDS)[number];

export interface FilingParserCrossEngineExecutionEvidenceV5Custody {
  readonly custodyPairBindingSha256: Sha256;
  readonly receipts: readonly [CustodyReceipt, CustodyReceipt];
  readonly sourceContextSha256: Sha256;
}

export interface FilingParserCrossEngineExecutionEvidenceV5Invocation {
  readonly audit: FilingParserCustodyQualityCompositionAudit;
  readonly candidateCommitmentSha256: Sha256;
  readonly candidateObservationsSha256: Sha256;
  readonly custody: FilingParserCrossEngineExecutionEvidenceV5Custody;
  readonly custodyCompositionCommitmentSha256: Sha256;
  readonly custodyCompositionEvaluationBindingSha256: Sha256;
  readonly declaredReferenceSha256: Sha256;
  readonly measurement: QualityMeasurement;
  readonly planSha256: Sha256;
  readonly quality: FilingParserCustodyQualityCompositionQuality;
  readonly qualityCompositionCommitmentSha256: Sha256;
  readonly qualityCompositionEvaluationBindingSha256: Sha256;
  readonly qualityEvaluationBindingSha256: Sha256;
}

export interface FilingParserCrossEngineExecutionEvidenceV5CaseOutcome {
  readonly caseId: FilingParserCrossEngineExecutionEvidenceV5CaseId;
  readonly expectedStatus: "evaluated_not_met" | "quarantined";
  readonly invocations:
    | readonly [
        FilingParserCrossEngineExecutionEvidenceV5Invocation,
        FilingParserCrossEngineExecutionEvidenceV5Invocation,
      ]
    | null;
  readonly observedStatus: "evaluated_not_met" | "quarantined";
}

export interface FilingParserCrossEngineExecutionEvidenceV5 {
  readonly baseline: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE;
  readonly caseOutcomes: readonly FilingParserCrossEngineExecutionEvidenceV5CaseOutcome[];
  readonly checksPassed: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CHECKS;
  readonly claim: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CLAIM;
  readonly completedAt: string;
  readonly custodyValidation: {
    readonly archivePair: "exact_frozen_original_amendment_pair";
    readonly authenticatedReadback: "only_owned_readback_enters_cycle2n";
    readonly cleanup: "complete_before_publication";
    readonly outerBindings: "custody_pair_and_unchanged_cycle2n_bound";
  };
  readonly engines: readonly [
    FilingParserCrossEngineExecutionEvidenceEngine,
    FilingParserCrossEngineExecutionEvidenceEngine,
  ];
  readonly evidenceVersion: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_VERSION;
  readonly fixtureManifestSha256: Sha256;
  readonly historicalV1: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY;
  readonly historicalV2: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY;
  readonly historicalV3: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY;
  readonly historicalV4: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_HISTORY;
  readonly notProven: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_NOT_PROVEN;
  readonly repository: string;
  readonly revision: string;
  readonly runtime: {
    readonly authenticatedReadbackCount: 8;
    readonly capabilitiesDropped: readonly ["ALL"];
    readonly custodyCommitCount: 4;
    readonly custodyCleanupCount: 4;
    readonly directExecutionCount: 4;
    readonly engineCount: 2;
    readonly networkMode: "none";
    readonly readOnlyRootFilesystem: true;
    readonly successfulEvaluationCount: 3;
    readonly successfulLifecycleReceiptCount: 16;
    readonly zeroResidue: true;
  };
  readonly schemaVersion: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_SCHEMA_VERSION;
  readonly sourceHashes: readonly FilingParserCrossEngineExecutionEvidenceSourceHash[];
  readonly startedAt: string;
  readonly status: "passed";
  readonly summary: {
    readonly candidateCommitmentsStable: true;
    readonly candidateObservationsStable: true;
    readonly custodyBindingsDistinct: true;
    readonly evaluatedNotMet: 1;
    readonly measurementStable: true;
    readonly quarantined: 5;
    readonly sourceBindingsStable: true;
    readonly total: 6;
  };
  readonly synthetic: true;
  readonly tools: {
    readonly dockerClient: string;
    readonly dockerServer: string;
    readonly git: string;
    readonly node: string;
    readonly pnpm: string;
    readonly python: string;
  };
  readonly transition: {
    readonly entries: readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[];
    readonly pathCount: number;
  };
  readonly workflow: {
    readonly artifactName: string;
    readonly event: string;
    readonly job: "acceptance";
    readonly ref: string;
    readonly runAttempt: number;
    readonly runId: string;
    readonly workflowName: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_WORKFLOW;
  };
}

export const FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_VALIDATION_STAGES =
  Object.freeze([
    "root_contract",
    "timestamps",
    "claim_tuples",
    "historical_evidence",
    "case_outcomes",
    "custody_bindings",
    "quality_bindings",
    "transition",
    "runtime",
    "source_hashes",
    "engines",
    "fixture_binding",
    "summary",
    "tools_contract",
    "workflow",
    "canonical_freeze",
  ] as const);
export type FilingParserCrossEngineExecutionEvidenceV5ValidationStage =
  (typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_VALIDATION_STAGES)[number];

const HASH = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const SAFE_PATH =
  /^(?!\/)(?![A-Za-z]:)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/u;
const MEASUREMENT_CLAIM =
  "bounded_synthetic_fixed_population_declared_reference_quality_metric_accounting_and_fail_closed_threshold_evaluation";
const TEXT_ENCODER = new TextEncoder();
const SOURCE_CONTEXT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-custody-quality-source-context:v1\u0000",
);
const CUSTODY_ROLE_SOURCE_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-archive-custody-role-source:v1\u0000",
);
const CUSTODY_RECEIPT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-archive-custody-receipt:v1\u0000",
);
const CUSTODY_PAIR_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-archive-custody-pair:v1\u0000",
);
const OUTER_COMMITMENT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-custody-quality-commitment:v1\u0000",
);
const OUTER_EVALUATION_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-custody-quality-evaluation:v1\u0000",
);
const MEASUREMENT_EVALUATION_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-quality-measurement:v1\u0000",
);

export function filingParserCrossEngineExecutionV5RequiredSourcePaths(
  transition: readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[],
): readonly string[] {
  return Object.freeze(
    [
      ...filingParserCrossEngineExecutionV4RequiredSourcePaths(transition),
    ].sort(),
  );
}

export function createFilingParserCrossEngineExecutionEvidenceV5(
  value: FilingParserCrossEngineExecutionEvidenceV5,
): FilingParserCrossEngineExecutionEvidenceV5 {
  return normalize(plainClone(value));
}

export function createFilingParserCrossEngineExecutionEvidenceV5ForAcceptance(
  value: FilingParserCrossEngineExecutionEvidenceV5,
  markStage: (
    stage: FilingParserCrossEngineExecutionEvidenceV5ValidationStage,
  ) => void,
): FilingParserCrossEngineExecutionEvidenceV5 {
  const first = normalize(plainClone(value), markStage);
  return normalize(plainClone(first));
}

export function parseCanonicalFilingParserCrossEngineExecutionEvidenceV5(
  bytes: Uint8Array,
): FilingParserCrossEngineExecutionEvidenceV5 {
  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    if (!text.endsWith("\n") || text.startsWith("\ufeff")) fail();
    const parsed = JSON.parse(text) as unknown;
    const evidence = normalize(parsed);
    if (
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV5(evidence) !==
      text
    )
      fail();
    return evidence;
  } catch {
    return fail();
  }
}

export function serializeCanonicalFilingParserCrossEngineExecutionEvidenceV5(
  evidence: FilingParserCrossEngineExecutionEvidenceV5,
): string {
  return `${canonicalJson(normalize(plainClone(evidence)))}\n`;
}

export function filingParserCrossEngineExecutionEvidenceV5Sha256(
  evidence: FilingParserCrossEngineExecutionEvidenceV5,
): Sha256 {
  return sha256(
    new TextEncoder().encode(
      serializeCanonicalFilingParserCrossEngineExecutionEvidenceV5(evidence),
    ),
  );
}

function normalize(
  value: unknown,
  markStage?: (
    stage: FilingParserCrossEngineExecutionEvidenceV5ValidationStage,
  ) => void,
): FilingParserCrossEngineExecutionEvidenceV5 {
  const root = exactRecord(value, [
    "baseline",
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
    "notProven",
    "repository",
    "revision",
    "runtime",
    "schemaVersion",
    "sourceHashes",
    "startedAt",
    "status",
    "summary",
    "synthetic",
    "tools",
    "transition",
    "workflow",
  ]);
  markStage?.("root_contract");
  if (
    root.baseline !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE ||
    root.schemaVersion !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_SCHEMA_VERSION ||
    root.evidenceVersion !== 5 ||
    root.status !== "passed" ||
    root.synthetic !== true ||
    typeof root.repository !== "string" ||
    root.repository.length === 0 ||
    typeof root.revision !== "string" ||
    !COMMIT.test(root.revision)
  )
    fail();
  if (
    typeof root.startedAt !== "string" ||
    typeof root.completedAt !== "string" ||
    !ISO.test(root.startedAt) ||
    !ISO.test(root.completedAt) ||
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
  if (
    canonicalJson(root.historicalV1) !==
      canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY) ||
    canonicalJson(root.historicalV2) !==
      canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY) ||
    canonicalJson(root.historicalV3) !==
      canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY) ||
    canonicalJson(root.historicalV4) !==
      canonicalJson(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_HISTORY)
  )
    fail();
  markStage?.("historical_evidence");

  const outcomes = denseArray(root.caseOutcomes);
  if (outcomes.length !== 6) fail();
  const normalizedOutcomes = outcomes.map((outcome, index) =>
    normalizeOutcome(
      outcome,
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CASE_IDS[index],
    ),
  );
  markStage?.("case_outcomes");
  validateSuccess(normalizedOutcomes[0]);
  markStage?.("custody_bindings");
  markStage?.("quality_bindings");

  const transition = exactRecord(root.transition, ["entries", "pathCount"]);
  const entries = denseArray(transition.entries).map(normalizeTransitionEntry);
  if (
    transition.pathCount !== entries.length ||
    entries.length === 0 ||
    entries.some(
      (entry, index) => index > 0 && entry.path <= entries[index - 1]!.path,
    )
  )
    fail();
  markStage?.("transition");

  const custodyValidation = exactRecord(root.custodyValidation, [
    "archivePair",
    "authenticatedReadback",
    "cleanup",
    "outerBindings",
  ]);
  if (
    custodyValidation.archivePair !== "exact_frozen_original_amendment_pair" ||
    custodyValidation.authenticatedReadback !==
      "only_owned_readback_enters_cycle2n" ||
    custodyValidation.cleanup !== "complete_before_publication" ||
    custodyValidation.outerBindings !==
      "custody_pair_and_unchanged_cycle2n_bound"
  )
    fail();
  const runtime = exactRecord(root.runtime, [
    "authenticatedReadbackCount",
    "capabilitiesDropped",
    "custodyCommitCount",
    "custodyCleanupCount",
    "directExecutionCount",
    "engineCount",
    "networkMode",
    "readOnlyRootFilesystem",
    "successfulEvaluationCount",
    "successfulLifecycleReceiptCount",
    "zeroResidue",
  ]);
  if (
    canonicalJson(runtime) !==
    canonicalJson({
      authenticatedReadbackCount: 8,
      capabilitiesDropped: ["ALL"],
      custodyCommitCount: 4,
      custodyCleanupCount: 4,
      directExecutionCount: 4,
      engineCount: 2,
      networkMode: "none",
      readOnlyRootFilesystem: true,
      successfulEvaluationCount: 3,
      successfulLifecycleReceiptCount: 16,
      zeroResidue: true,
    })
  )
    fail();
  const normalizedRuntime = {
    authenticatedReadbackCount: 8 as const,
    capabilitiesDropped: ["ALL"] as const,
    custodyCommitCount: 4 as const,
    custodyCleanupCount: 4 as const,
    directExecutionCount: 4 as const,
    engineCount: 2 as const,
    networkMode: "none" as const,
    readOnlyRootFilesystem: true as const,
    successfulEvaluationCount: 3 as const,
    successfulLifecycleReceiptCount: 16 as const,
    zeroResidue: true as const,
  };
  markStage?.("runtime");

  const sourceHashes = denseArray(root.sourceHashes).map(normalizeSourceHash);
  const requiredPaths =
    filingParserCrossEngineExecutionV5RequiredSourcePaths(entries);
  if (
    sourceHashes.length !== requiredPaths.length ||
    sourceHashes.some((entry, index) => entry.path !== requiredPaths[index])
  )
    fail();
  markStage?.("source_hashes");
  const engines = normalizeEngines(root.engines, sourceHashes);
  markStage?.("engines");
  if (!isHash(root.fixtureManifestSha256)) fail();
  const fixture = sourceHashes.find(
    (entry) =>
      entry.path ===
      "fixtures/synthetic/filing-parser-cross-engine-execution/v5/manifest.json",
  );
  if (fixture?.sha256 !== root.fixtureManifestSha256) fail();
  markStage?.("fixture_binding");

  const summary = exactRecord(root.summary, [
    "candidateCommitmentsStable",
    "candidateObservationsStable",
    "custodyBindingsDistinct",
    "evaluatedNotMet",
    "measurementStable",
    "quarantined",
    "sourceBindingsStable",
    "total",
  ]);
  if (
    canonicalJson(summary) !==
    canonicalJson({
      candidateCommitmentsStable: true,
      candidateObservationsStable: true,
      custodyBindingsDistinct: true,
      evaluatedNotMet: 1,
      measurementStable: true,
      quarantined: 5,
      sourceBindingsStable: true,
      total: 6,
    })
  )
    fail();
  markStage?.("summary");
  const tools = exactRecord(root.tools, [
    "dockerClient",
    "dockerServer",
    "git",
    "node",
    "pnpm",
    "python",
  ]);
  if (
    Object.values(tools).some(
      (entry) =>
        typeof entry !== "string" || entry.length === 0 || entry.length > 240,
    )
  )
    fail();
  markStage?.("tools_contract");
  const workflow = exactRecord(root.workflow, [
    "artifactName",
    "event",
    "job",
    "ref",
    "runAttempt",
    "runId",
    "workflowName",
  ]);
  if (
    workflow.artifactName !==
      `filing-parser-cross-engine-execution-evidence-v5-${root.revision}-${String(workflow.runAttempt)}` ||
    typeof workflow.event !== "string" ||
    workflow.event.length === 0 ||
    workflow.job !== "acceptance" ||
    typeof workflow.ref !== "string" ||
    workflow.ref.length === 0 ||
    !Number.isSafeInteger(workflow.runAttempt) ||
    (workflow.runAttempt as number) < 1 ||
    typeof workflow.runId !== "string" ||
    !/^[1-9][0-9]*$/u.test(workflow.runId) ||
    workflow.workflowName !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_WORKFLOW
  )
    fail();
  markStage?.("workflow");

  const normalized = deepFreeze({
    baseline: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_BASELINE,
    caseOutcomes: normalizedOutcomes,
    checksPassed: [...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CHECKS],
    claim: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CLAIM,
    completedAt: root.completedAt,
    custodyValidation,
    engines,
    evidenceVersion: FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_VERSION,
    fixtureManifestSha256: root.fixtureManifestSha256,
    historicalV1: plainClone(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
    ),
    historicalV2: plainClone(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
    ),
    historicalV3: plainClone(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY,
    ),
    historicalV4: plainClone(
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_HISTORY,
    ),
    notProven: [...FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_NOT_PROVEN],
    repository: root.repository,
    revision: root.revision,
    runtime: normalizedRuntime,
    schemaVersion:
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_SCHEMA_VERSION,
    sourceHashes,
    startedAt: root.startedAt,
    status: "passed" as const,
    summary,
    synthetic: true as const,
    tools,
    transition: { entries, pathCount: entries.length },
    workflow,
  }) as unknown as FilingParserCrossEngineExecutionEvidenceV5;
  markStage?.("canonical_freeze");
  return normalized;
}

function normalizeOutcome(
  value: unknown,
  caseId: FilingParserCrossEngineExecutionEvidenceV5CaseId | undefined,
): FilingParserCrossEngineExecutionEvidenceV5CaseOutcome {
  if (caseId === undefined) fail();
  const outcome = exactRecord(value, [
    "caseId",
    "expectedStatus",
    "invocations",
    "observedStatus",
  ]);
  if (outcome.caseId !== caseId) fail();
  const success =
    caseId === FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_CASE_IDS[0];
  const status = success ? "evaluated_not_met" : "quarantined";
  if (outcome.expectedStatus !== status || outcome.observedStatus !== status)
    fail();
  if (!success) {
    if (outcome.invocations !== null) fail();
    return deepFreeze({
      ...outcome,
    }) as unknown as FilingParserCrossEngineExecutionEvidenceV5CaseOutcome;
  }
  const invocations = denseArray(outcome.invocations);
  if (invocations.length !== 2) fail();
  return deepFreeze({
    ...outcome,
    invocations: invocations.map(normalizeInvocation),
  }) as unknown as FilingParserCrossEngineExecutionEvidenceV5CaseOutcome;
}

function normalizeInvocation(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceV5Invocation {
  const invocation = exactRecord(value, [
    "audit",
    "candidateCommitmentSha256",
    "candidateObservationsSha256",
    "custody",
    "custodyCompositionCommitmentSha256",
    "custodyCompositionEvaluationBindingSha256",
    "declaredReferenceSha256",
    "measurement",
    "planSha256",
    "quality",
    "qualityCompositionCommitmentSha256",
    "qualityCompositionEvaluationBindingSha256",
    "qualityEvaluationBindingSha256",
  ]);
  const hashes = [
    invocation.candidateCommitmentSha256,
    invocation.candidateObservationsSha256,
    invocation.custodyCompositionCommitmentSha256,
    invocation.custodyCompositionEvaluationBindingSha256,
    invocation.declaredReferenceSha256,
    invocation.planSha256,
    invocation.qualityCompositionCommitmentSha256,
    invocation.qualityCompositionEvaluationBindingSha256,
    invocation.qualityEvaluationBindingSha256,
  ];
  if (hashes.some((entry) => !isHash(entry))) fail();
  const audit = exactRecord(invocation.audit, [
    "authenticatedReadbackCount",
    "cleanupCount",
    "directExecutionCount",
    "emittedFactCount",
    "stagedArchiveCount",
    "zeroResidue",
  ]);
  if (
    canonicalJson(audit) !==
    canonicalJson({
      authenticatedReadbackCount: 2,
      cleanupCount: 1,
      directExecutionCount: 1,
      emittedFactCount: 20,
      stagedArchiveCount: 2,
      zeroResidue: true,
    })
  )
    fail();
  const custody = normalizeCustody(invocation.custody);
  const measurement = normalizeMeasurement(invocation.measurement, invocation);
  const expectedInner = filingParserCrossEngineExecutionV4ExpectedInnerBindings(
    {
      counts: measurement.counts,
      failedThresholds: measurement.failedThresholds,
      metrics: measurement.metrics,
      syntheticPilotThresholdOutcome:
        measurement.syntheticPilotThresholdOutcome,
    } as Parameters<
      typeof filingParserCrossEngineExecutionV4ExpectedInnerBindings
    >[0],
  );
  if (
    invocation.planSha256 !== expectedInner.planSha256 ||
    invocation.declaredReferenceSha256 !==
      expectedInner.declaredReferenceSha256 ||
    invocation.candidateCommitmentSha256 !==
      expectedInner.candidateCommitmentSha256 ||
    invocation.candidateObservationsSha256 !==
      expectedInner.candidateObservationsSha256 ||
    invocation.qualityEvaluationBindingSha256 !==
      expectedInner.qualityEvaluationBindingSha256 ||
    measurement.candidateSha256 !== expectedInner.measurementCandidateSha256 ||
    measurement.evaluationSha256 !== expectedInner.measurementEvaluationSha256
  )
    fail();
  const verifiedInner = verifyFilingParserCrossEngineExecutionV4Invocation({
    candidateCommitmentSha256: invocation.candidateCommitmentSha256,
    candidateObservationsSha256: invocation.candidateObservationsSha256,
    compositionCommitmentSha256: invocation.qualityCompositionCommitmentSha256,
    declaredReferenceSha256: invocation.declaredReferenceSha256,
    evaluationBindingSha256:
      invocation.qualityCompositionEvaluationBindingSha256,
    measurementEvaluationSha256: measurement.evaluationSha256,
    planSha256: invocation.planSha256,
    projectionReceipts: exactRecord(invocation.quality, [
      "projectionReceipts",
      "sourceExecution",
    ]).projectionReceipts,
    qualityAccounting: {
      counts: measurement.counts,
      failedThresholds: measurement.failedThresholds,
      metrics: measurement.metrics,
      syntheticPilotThresholdOutcome:
        measurement.syntheticPilotThresholdOutcome,
    },
    qualityEvaluationBindingSha256: invocation.qualityEvaluationBindingSha256,
    sourceExecution: exactRecord(invocation.quality, [
      "projectionReceipts",
      "sourceExecution",
    ]).sourceExecution,
  });
  const quality = deepFreeze({
    projectionReceipts: plainClone(verifiedInner.projectionReceipts),
    sourceExecution: plainClone(verifiedInner.sourceExecution),
  }) as FilingParserCustodyQualityCompositionQuality;
  const sourceContextSha256 = domainSha256(SOURCE_CONTEXT_DOMAIN, {
    amendmentArchiveSha256: CUSTODY_FIXTURES.amendment.contentSha256,
    claim: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
    declaredReferenceSha256: invocation.declaredReferenceSha256,
    originalArchiveSha256: CUSTODY_FIXTURES.original.contentSha256,
    planSha256: invocation.planSha256,
    schemaVersion: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
  });
  if (custody.sourceContextSha256 !== sourceContextSha256) fail();
  const custodyCompositionCommitmentSha256 = domainSha256(
    OUTER_COMMITMENT_DOMAIN,
    {
      candidateCommitmentSha256: invocation.candidateCommitmentSha256,
      candidateObservationsSha256: invocation.candidateObservationsSha256,
      claim: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
      custody,
      declaredReferenceSha256: invocation.declaredReferenceSha256,
      planSha256: invocation.planSha256,
      quality,
      qualityCompositionCommitmentSha256:
        invocation.qualityCompositionCommitmentSha256,
      schemaVersion: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
    },
  );
  if (
    invocation.custodyCompositionCommitmentSha256 !==
    custodyCompositionCommitmentSha256
  )
    fail();
  const custodyCompositionEvaluationBindingSha256 = domainSha256(
    OUTER_EVALUATION_DOMAIN,
    {
      candidateCommitmentSha256: invocation.candidateCommitmentSha256,
      candidateObservationsSha256: invocation.candidateObservationsSha256,
      claim: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
      custody,
      custodyCompositionCommitmentSha256,
      declaredReferenceSha256: invocation.declaredReferenceSha256,
      measurementEvaluationSha256: measurement.evaluationSha256,
      planSha256: invocation.planSha256,
      quality,
      qualityCompositionCommitmentSha256:
        invocation.qualityCompositionCommitmentSha256,
      qualityCompositionEvaluationBindingSha256:
        invocation.qualityCompositionEvaluationBindingSha256,
      qualityEvaluationBindingSha256: invocation.qualityEvaluationBindingSha256,
      schemaVersion: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
    },
  );
  if (
    invocation.custodyCompositionEvaluationBindingSha256 !==
    custodyCompositionEvaluationBindingSha256
  )
    fail();
  return deepFreeze({
    ...invocation,
    audit,
    custody,
    measurement,
    quality,
  }) as unknown as FilingParserCrossEngineExecutionEvidenceV5Invocation;
}

function normalizeCustody(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceV5Custody {
  const custody = exactRecord(value, [
    "custodyPairBindingSha256",
    "receipts",
    "sourceContextSha256",
  ]);
  if (
    !isHash(custody.custodyPairBindingSha256) ||
    !isHash(custody.sourceContextSha256)
  )
    fail();
  const receipts = denseArray(custody.receipts);
  if (receipts.length !== 2) fail();
  const normalized = receipts.map((receiptValue, index) => {
    const receipt = exactRecord(receiptValue, [
      "aadSha256",
      "byteLength",
      "ciphertextSha256",
      "contentSha256",
      "readbackSha256",
      "receiptSha256",
      "role",
      "sourceBindingSha256",
    ]);
    const role = index === 0 ? "original" : "amendment";
    const fixture = CUSTODY_FIXTURES[role];
    if (
      receipt.role !== role ||
      receipt.byteLength !== fixture.byteLength ||
      receipt.contentSha256 !== fixture.contentSha256 ||
      receipt.readbackSha256 !== fixture.contentSha256 ||
      [
        receipt.aadSha256,
        receipt.ciphertextSha256,
        receipt.receiptSha256,
        receipt.sourceBindingSha256,
      ].some((entry) => !isHash(entry))
    )
      fail();
    const sourceBindingSha256 = domainSha256(CUSTODY_ROLE_SOURCE_DOMAIN, {
      amendmentArchiveSha256: CUSTODY_FIXTURES.amendment.contentSha256,
      claim: CUSTODY_CLAIM,
      originalArchiveSha256: CUSTODY_FIXTURES.original.contentSha256,
      role,
      schemaVersion: CUSTODY_SCHEMA_VERSION,
      sourceContextSha256: custody.sourceContextSha256,
    });
    if (receipt.sourceBindingSha256 !== sourceBindingSha256) fail();
    const aadDocument = canonicalBytes({
      algorithm: CUSTODY_ALGORITHM.name,
      byteLength: fixture.byteLength,
      claim: CUSTODY_CLAIM,
      contentSha256: fixture.contentSha256,
      role,
      schemaVersion: CUSTODY_SCHEMA_VERSION,
      sourceBindingSha256,
    });
    const aadSha256 = sha256(
      concatBytes(
        TEXT_ENCODER.encode(CUSTODY_ALGORITHM.aadDomain),
        aadDocument,
      ),
    );
    if (receipt.aadSha256 !== aadSha256) fail();
    const preimage = {
      aadSha256,
      byteLength: fixture.byteLength,
      ciphertextSha256: receipt.ciphertextSha256,
      contentSha256: fixture.contentSha256,
      readbackSha256: fixture.contentSha256,
      role,
      sourceBindingSha256,
    };
    const receiptSha256 = domainSha256(CUSTODY_RECEIPT_DOMAIN, preimage);
    if (receipt.receiptSha256 !== receiptSha256) fail();
    return deepFreeze({ ...preimage, receiptSha256 });
  });
  const custodyPairBindingSha256 = domainSha256(CUSTODY_PAIR_DOMAIN, {
    claim: CUSTODY_CLAIM,
    receipts: normalized,
    schemaVersion: CUSTODY_SCHEMA_VERSION,
    sourceContextSha256: custody.sourceContextSha256,
  });
  if (custody.custodyPairBindingSha256 !== custodyPairBindingSha256) fail();
  return deepFreeze({
    custodyPairBindingSha256,
    receipts: normalized,
    sourceContextSha256: custody.sourceContextSha256,
  }) as unknown as FilingParserCrossEngineExecutionEvidenceV5Custody;
}

function normalizeMeasurement(
  value: unknown,
  invocation: Record<string, unknown>,
): QualityMeasurement {
  const measurement = exactRecord(value, [
    "candidateSha256",
    "claim",
    "counts",
    "declaredReferenceSha256",
    "evaluationSha256",
    "failedThresholds",
    "metrics",
    "planSha256",
    "schemaVersion",
    "status",
    "synthetic",
    "syntheticPilotThresholdOutcome",
  ]);
  if (
    measurement.claim !== MEASUREMENT_CLAIM ||
    measurement.schemaVersion !== "1.0.0" ||
    measurement.status !== "evaluated" ||
    measurement.synthetic !== true ||
    measurement.syntheticPilotThresholdOutcome !== "not_met" ||
    !isHash(measurement.candidateSha256) ||
    measurement.declaredReferenceSha256 !==
      invocation.declaredReferenceSha256 ||
    measurement.planSha256 !== invocation.planSha256 ||
    !isHash(measurement.evaluationSha256)
  )
    fail();
  const exactCounts = {
    conceptMismatchCount: 0,
    criticalAssertionCount: 2000,
    dimensionMismatchCount: 0,
    documentCount: 100,
    emittedFactCount: 20,
    expectedFactCount: 1000,
    falseNegativeFactCount: 980,
    falsePositiveFactCount: 0,
    missingDocumentCount: 98,
    missingFactCount: 980,
    periodMismatchCount: 0,
    quarantinedDocumentCount: 0,
    semanticAssertionPassCount: 20,
    silentCriticalFailureCount: 1960,
    succeededDocumentCount: 2,
    truePositiveFactCount: 20,
    unitMismatchCount: 0,
    unitPeriodAssertionPassCount: 20,
    valueMismatchCount: 0,
  };
  const ratio = (
    numerator: number,
    denominator: number,
    met: boolean,
    thresholdNumerator: number,
    thresholdKind: "maximum" | "minimum",
  ) => ({
    defined: true,
    denominator,
    met,
    numerator,
    threshold: { denominator: 100, numerator: thresholdNumerator },
    thresholdKind,
  });
  const exactMetrics = {
    documentSuccess: ratio(2, 100, false, 95, "minimum"),
    factPrecision: ratio(20, 20, true, 99, "minimum"),
    factRecall: ratio(20, 1000, false, 99, "minimum"),
    quarantineRate: ratio(0, 100, true, 5, "maximum"),
    silentCriticalFailure: {
      count: 1960,
      denominator: 2000,
      maximumCount: 0,
      met: false,
    },
    unitDateTolerance: {
      dateToleranceDays: 0,
      periodMismatchCount: 0,
      unitMismatchCount: 0,
      unitTolerancePolicy: "exact_canonical_unit.v1",
    },
  };
  if (
    canonicalJson(measurement.counts) !== canonicalJson(exactCounts) ||
    canonicalJson(measurement.metrics) !== canonicalJson(exactMetrics) ||
    canonicalJson(measurement.failedThresholds) !==
      canonicalJson([
        "document_success_minimum",
        "fact_recall_minimum",
        "maximum_silent_critical_failures",
      ])
  )
    fail();
  const evaluationSha256 = compactDomainSha256(MEASUREMENT_EVALUATION_DOMAIN, {
    candidateSha256: measurement.candidateSha256,
    counts: measurement.counts,
    declaredReferenceSha256: measurement.declaredReferenceSha256,
    failedThresholds: measurement.failedThresholds,
    planSha256: measurement.planSha256,
    syntheticPilotThresholdOutcome: "not_met",
  });
  if (measurement.evaluationSha256 !== evaluationSha256) fail();
  return deepFreeze({ ...measurement }) as unknown as QualityMeasurement;
}

function validateSuccess(
  outcome: FilingParserCrossEngineExecutionEvidenceV5CaseOutcome | undefined,
): void {
  if (outcome?.invocations === null || outcome?.invocations === undefined)
    fail();
  const [first, second] = outcome.invocations;
  if (
    first.planSha256 !== second.planSha256 ||
    first.declaredReferenceSha256 !== second.declaredReferenceSha256 ||
    first.candidateCommitmentSha256 !== second.candidateCommitmentSha256 ||
    first.candidateObservationsSha256 !== second.candidateObservationsSha256 ||
    first.measurement.evaluationSha256 !==
      second.measurement.evaluationSha256 ||
    first.qualityEvaluationBindingSha256 !==
      second.qualityEvaluationBindingSha256 ||
    canonicalJson(first.measurement) !== canonicalJson(second.measurement) ||
    first.quality.sourceExecution.normalizationSha256 !==
      second.quality.sourceExecution.normalizationSha256 ||
    first.quality.sourceExecution.agreementSha256 ===
      second.quality.sourceExecution.agreementSha256 ||
    first.quality.sourceExecution.invocationBindingSha256 ===
      second.quality.sourceExecution.invocationBindingSha256 ||
    new Set([
      ...first.quality.sourceExecution.lifecycleBindingSha256s,
      ...second.quality.sourceExecution.lifecycleBindingSha256s,
    ]).size !== 8 ||
    first.custody.sourceContextSha256 !== second.custody.sourceContextSha256 ||
    first.custody.custodyPairBindingSha256 ===
      second.custody.custodyPairBindingSha256 ||
    first.custodyCompositionCommitmentSha256 ===
      second.custodyCompositionCommitmentSha256 ||
    first.custodyCompositionEvaluationBindingSha256 ===
      second.custodyCompositionEvaluationBindingSha256 ||
    first.qualityCompositionCommitmentSha256 ===
      second.qualityCompositionCommitmentSha256 ||
    first.qualityCompositionEvaluationBindingSha256 ===
      second.qualityCompositionEvaluationBindingSha256
  )
    fail();
  for (let index = 0; index < 2; index += 1) {
    const left = first.custody.receipts[index]!;
    const right = second.custody.receipts[index]!;
    if (
      left.contentSha256 !== right.contentSha256 ||
      left.readbackSha256 !== right.readbackSha256 ||
      left.sourceBindingSha256 !== right.sourceBindingSha256 ||
      left.aadSha256 !== right.aadSha256 ||
      left.ciphertextSha256 === right.ciphertextSha256 ||
      left.receiptSha256 === right.receiptSha256
    )
      fail();
  }
}

function normalizeTransitionEntry(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceTransitionEntry {
  const entry = exactRecord(value, ["path", "status"]);
  if (
    (entry.status !== "A" && entry.status !== "M") ||
    typeof entry.path !== "string" ||
    !SAFE_PATH.test(entry.path)
  )
    fail();
  return deepFreeze({ path: entry.path, status: entry.status });
}

function normalizeSourceHash(
  value: unknown,
): FilingParserCrossEngineExecutionEvidenceSourceHash {
  const entry = exactRecord(value, ["path", "sha256"]);
  if (
    typeof entry.path !== "string" ||
    !SAFE_PATH.test(entry.path) ||
    !isHash(entry.sha256)
  )
    fail();
  return deepFreeze({ path: entry.path, sha256: entry.sha256 });
}

function normalizeEngines(
  value: unknown,
  sourceHashes: readonly FilingParserCrossEngineExecutionEvidenceSourceHash[],
): readonly [
  FilingParserCrossEngineExecutionEvidenceEngine,
  FilingParserCrossEngineExecutionEvidenceEngine,
] {
  const engines = denseArray(value);
  if (engines.length !== 2) fail();
  const normalized = engines.map((value, index) => {
    const engine = exactRecord(value, [
      "architecture",
      "baseIndexDigest",
      "basePlatformManifestDigest",
      "builtImageId",
      "engineId",
      "implementationSha256",
      "implementationSourceHashes",
      "operatingSystem",
      "role",
      "runtimeVersion",
    ]);
    const expectedRole = index === 0 ? "python-primary" : "node-secondary";
    const expectedPaths =
      index === 0
        ? FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.python
        : FILING_PARSER_CROSS_ENGINE_IMPLEMENTATION_PATHS.node;
    const sources = denseArray(engine.implementationSourceHashes).map(
      normalizeSourceHash,
    );
    if (
      engine.architecture !== "amd64" ||
      engine.operatingSystem !== "linux" ||
      engine.role !== expectedRole ||
      typeof engine.engineId !== "string" ||
      engine.engineId.length === 0 ||
      typeof engine.runtimeVersion !== "string" ||
      engine.runtimeVersion.length === 0 ||
      [
        engine.baseIndexDigest,
        engine.basePlatformManifestDigest,
        engine.builtImageId,
        engine.implementationSha256,
      ].some((entry) => !isHash(entry)) ||
      sources.length !== expectedPaths.length ||
      sources.some(
        (entry, sourceIndex) =>
          entry.path !== expectedPaths[sourceIndex] ||
          sourceHashes.find((candidate) => candidate.path === entry.path)
            ?.sha256 !== entry.sha256,
      )
    )
      fail();
    if (
      engine.implementationSha256 !==
      filingParserCrossEngineImplementationSha256(sources)
    )
      fail();
    return deepFreeze({ ...engine, implementationSourceHashes: sources });
  });
  return deepFreeze(normalized) as unknown as readonly [
    FilingParserCrossEngineExecutionEvidenceEngine,
    FilingParserCrossEngineExecutionEvidenceEngine,
  ];
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(descriptors).some((key) => typeof key !== "string") ||
    canonicalJson(Object.keys(descriptors).sort()) !==
      canonicalJson([...keys].sort())
  )
    fail();
  const snapshot: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    )
      fail();
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function denseArray(value: unknown): unknown[] {
  if (
    !Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  )
    fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(descriptors).some(
      (key) =>
        typeof key !== "string" ||
        (key !== "length" && !/^(0|[1-9][0-9]*)$/u.test(key)),
    )
  )
    fail();
  const snapshot: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    )
      fail();
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function isHash(value: unknown): value is Sha256 {
  return typeof value === "string" && HASH.test(value);
}

function sha256(value: Uint8Array): Sha256 {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalBytes(value: unknown): Uint8Array {
  return TEXT_ENCODER.encode(`${canonicalJson(value)}\n`);
}

function domainSha256(domain: Uint8Array, value: unknown): Sha256 {
  return sha256(concatBytes(domain, canonicalBytes(value)));
}

function compactDomainSha256(domain: Uint8Array, value: unknown): Sha256 {
  return sha256(concatBytes(domain, TEXT_ENCODER.encode(canonicalJson(value))));
}

function concatBytes(...values: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    values.reduce((total, value) => total + value.byteLength, 0),
  );
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.byteLength;
  }
  return result;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null) fail();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function plainClone<T>(value: T): T {
  return JSON.parse(canonicalJson(safeSnapshot(value, { nodes: 0 }))) as T;
}

function safeSnapshot(
  value: unknown,
  budget: { nodes: number },
  depth = 0,
): unknown {
  budget.nodes += 1;
  if (budget.nodes > 20_000 || depth > 48) fail();
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isSafeInteger(value))
  )
    return value;
  if (typeof value !== "object" || utilTypes.isProxy(value)) fail();
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) fail();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).some(
        (key) =>
          typeof key !== "string" ||
          (key !== "length" && !/^(0|[1-9][0-9]*)$/u.test(key)),
      )
    )
      fail();
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      )
        fail();
      result.push(safeSnapshot(descriptor.value, budget, depth + 1));
    }
    return result;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some((key) => typeof key !== "string"))
    fail();
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(descriptors)) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    )
      fail();
    result[key] = safeSnapshot(descriptor.value, budget, depth + 1);
  }
  return result;
}

function deepFreeze<T>(value: T): T {
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    Object.isFrozen(value)
  )
    return value;
  for (const child of Object.values(value as Record<string, unknown>))
    deepFreeze(child);
  return Object.freeze(value);
}

function fail(): never {
  throw new TypeError(
    "FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V5_INVALID",
  );
}
