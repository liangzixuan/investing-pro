import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { types as utilTypes } from "node:util";

import {
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_DIAGNOSTIC_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_RUN,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE,
  FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_TRANSITION,
  filingParserCrossEngineExecutionEvidenceSha256,
  filingParserCrossEngineExecutionEvidenceV2Sha256,
  filingParserCrossEngineExecutionEvidenceV3Sha256,
  filingParserCrossEngineExecutionEvidenceV4Sha256,
  parseCanonicalFilingParserCrossEngineExecutionEvidence,
  parseCanonicalFilingParserCrossEngineExecutionEvidenceV2,
  parseCanonicalFilingParserCrossEngineExecutionEvidenceV3,
  parseCanonicalFilingParserCrossEngineExecutionEvidenceV4,
  type FilingParserCrossEngineExecutionEvidenceTransitionEntry,
} from "./filing-parser-cross-engine-execution-evidence";

export interface FilingParserCrossEngineExecutionEvidenceReviewOptions {
  readonly evidencePath: string;
  readonly expectedArtifactName: string;
  readonly expectedEvidenceSha256: `sha256:${string}`;
  readonly expectedRepository: string;
  readonly expectedRevision: string;
  readonly expectedRunAttempt: number;
  readonly expectedRunId: string;
  readonly repositoryPath: string;
}

export interface FilingParserCrossEngineExecutionEvidenceReviewV1 {
  readonly artifactName: string;
  readonly baseline: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE;
  readonly evidenceSha256: `sha256:${string}`;
  readonly failedCorrectiveRevision: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION;
  readonly failedDiagnosticRevision: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_DIAGNOSTIC_REVISION;
  readonly failedPrecursorRevision: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION;
  readonly failedRecoveryRevision: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION;
  readonly repository: string;
  readonly revision: string;
  readonly runAttempt: number;
  readonly runId: string;
  readonly sourceCount: number;
  readonly transitionPathCount: number;
  readonly verdict: "offline_consistent";
}

export interface FilingParserCrossEngineExecutionEvidenceReviewV2 {
  readonly artifactName: string;
  readonly baseline: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE;
  readonly evidenceSha256: `sha256:${string}`;
  readonly evidenceVersion: 2;
  readonly failedPrecursorRevision: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION;
  readonly failedRun: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_RUN;
  readonly historicalV1: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY;
  readonly repository: string;
  readonly revision: string;
  readonly runAttempt: number;
  readonly runId: string;
  readonly sourceCount: number;
  readonly transitionPathCount: number;
  readonly verdict: "offline_consistent";
}

export interface FilingParserCrossEngineExecutionEvidenceReviewV3 {
  readonly artifactName: string;
  readonly baseline: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE;
  readonly evidenceSha256: `sha256:${string}`;
  readonly evidenceVersion: 3;
  readonly historicalV1: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY;
  readonly historicalV2: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY;
  readonly repository: string;
  readonly revision: string;
  readonly runAttempt: number;
  readonly runId: string;
  readonly sourceCount: number;
  readonly transitionPathCount: number;
  readonly verdict: "offline_consistent";
}

export interface FilingParserCrossEngineExecutionEvidenceReviewV4 {
  readonly artifactName: string;
  readonly baseline: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE;
  readonly evidenceSha256: `sha256:${string}`;
  readonly evidenceVersion: 4;
  readonly historicalV1: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY;
  readonly historicalV2: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY;
  readonly historicalV3: typeof FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY;
  readonly repository: string;
  readonly revision: string;
  readonly runAttempt: number;
  readonly runId: string;
  readonly sourceCount: number;
  readonly transitionPathCount: number;
  readonly verdict: "offline_consistent";
}

export type FilingParserCrossEngineExecutionEvidenceReview =
  | FilingParserCrossEngineExecutionEvidenceReviewV1
  | FilingParserCrossEngineExecutionEvidenceReviewV2
  | FilingParserCrossEngineExecutionEvidenceReviewV3
  | FilingParserCrossEngineExecutionEvidenceReviewV4;

const HASH = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u;
const ARTIFACT = /^[A-Za-z0-9._-]{1,240}$/u;
const MAX_COMMAND_BYTES = 8_388_608;
const MAX_EVIDENCE_BYTES = 1_048_576;
const MAX_SOURCE_BYTES = 4_194_304;
const isProxy = utilTypes.isProxy;

export async function verifyFilingParserCrossEngineExecutionEvidenceOffline(
  options: FilingParserCrossEngineExecutionEvidenceReviewOptions,
): Promise<FilingParserCrossEngineExecutionEvidenceReview> {
  try {
    return await verifyOfflineV4(options);
  } catch {
    try {
      return await verifyOfflineV3(options);
    } catch {
      try {
        return await verifyOfflineV2(options);
      } catch {
        try {
          return await verifyOffline(options);
        } catch {
          return invalid();
        }
      }
    }
  }
}

async function verifyOfflineV4(
  options: FilingParserCrossEngineExecutionEvidenceReviewOptions,
): Promise<FilingParserCrossEngineExecutionEvidenceReviewV4> {
  validateOptions(options);
  const repositoryPath = await realpath(options.repositoryPath);
  const evidencePath = await realpath(options.evidencePath);
  const repositoryStat = await lstat(repositoryPath);
  const evidenceStat = await lstat(evidencePath);
  if (
    !repositoryStat.isDirectory() ||
    repositoryStat.isSymbolicLink() ||
    !evidenceStat.isFile() ||
    evidenceStat.isSymbolicLink()
  )
    return invalid();
  const evidenceBytes = await readExactRegularFile(
    evidencePath,
    MAX_EVIDENCE_BYTES,
  );
  if (sha256(evidenceBytes) !== options.expectedEvidenceSha256)
    return invalid();
  const evidence = parseCanonicalFilingParserCrossEngineExecutionEvidenceV4(
    Uint8Array.from(evidenceBytes),
  );
  if (
    filingParserCrossEngineExecutionEvidenceV4Sha256(evidence) !==
      options.expectedEvidenceSha256 ||
    evidence.repository !== options.expectedRepository ||
    evidence.revision !== options.expectedRevision ||
    evidence.workflow.runId !== options.expectedRunId ||
    evidence.workflow.runAttempt !== options.expectedRunAttempt ||
    evidence.workflow.artifactName !== options.expectedArtifactName ||
    evidence.baseline !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE ||
    JSON.stringify(evidence.historicalV1) !==
      JSON.stringify(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
      ) ||
    JSON.stringify(evidence.historicalV2) !==
      JSON.stringify(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY,
      ) ||
    JSON.stringify(evidence.historicalV3) !==
      JSON.stringify(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY)
  )
    return invalid();

  const head = exactLine(
    (await checkedCommand(repositoryPath, "git", ["rev-parse", "HEAD"])).stdout,
  );
  if (head !== options.expectedRevision) return invalid();
  const topLevel = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-parse",
        "--show-toplevel",
      ])
    ).stdout,
  );
  if (!samePath(await realpath(topLevel), repositoryPath)) return invalid();
  for (const revision of [
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY.sourceRevision,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_HISTORY.maintenance
      .revision,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY.sourceRevision,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY.sourceRevision,
  ])
    await checkedCommand(repositoryPath, "git", [
      "cat-file",
      "-e",
      `${revision}^{commit}`,
    ]);
  const mergeBase = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "merge-base",
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE,
        options.expectedRevision,
      ])
    ).stdout,
  );
  const range = `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE}..${options.expectedRevision}`;
  const successorCount = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--count",
        range,
      ])
    ).stdout,
  );
  const firstParentCount = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--first-parent",
        "--count",
        range,
      ])
    ).stdout,
  );
  const parentLine = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--parents",
        "--max-count=1",
        options.expectedRevision,
      ])
    ).stdout,
  );
  if (
    !filingParserCrossEngineExecutionV4ChainAllowed(
      mergeBase,
      successorCount,
      firstParentCount,
      options.expectedRevision,
      parentLine,
    )
  )
    return invalid();
  const status = await checkedCommand(repositoryPath, "git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (status.stdout.byteLength !== 0 || status.stderr.byteLength !== 0)
    return invalid();

  for (const source of evidence.sourceHashes) {
    const committed = (
      await checkedCommand(repositoryPath, "git", [
        "show",
        `${options.expectedRevision}:${source.path}`,
      ])
    ).stdout;
    if (committed.byteLength === 0 || committed.byteLength > MAX_SOURCE_BYTES)
      return invalid();
    if (sha256(committed) !== source.sha256) return invalid();
    const localPath = resolve(repositoryPath, source.path);
    const relativePath = relative(repositoryPath, localPath);
    if (!repositoryRelativePathIsContained(relativePath)) return invalid();
    const canonicalLocalPath = await realpath(localPath);
    if (
      !repositoryRelativePathIsContained(
        relative(repositoryPath, canonicalLocalPath),
      )
    )
      return invalid();
    const local = await readExactRegularFile(
      canonicalLocalPath,
      MAX_SOURCE_BYTES,
    );
    if (!exactBytes(local, committed)) return invalid();
  }

  const transition = parseTransition(
    (
      await checkedCommand(repositoryPath, "git", [
        "diff",
        "--name-status",
        "--no-renames",
        "-z",
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE,
        options.expectedRevision,
        "--",
      ])
    ).stdout,
  );
  if (
    JSON.stringify(transition) !==
      JSON.stringify(evidence.transition.entries) ||
    JSON.stringify(transition) !==
      JSON.stringify(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_TRANSITION,
      )
  )
    return invalid();

  return Object.freeze({
    artifactName: evidence.workflow.artifactName,
    baseline: evidence.baseline,
    evidenceSha256: options.expectedEvidenceSha256,
    evidenceVersion: 4 as const,
    historicalV1: evidence.historicalV1,
    historicalV2: evidence.historicalV2,
    historicalV3: evidence.historicalV3,
    repository: evidence.repository,
    revision: evidence.revision,
    runAttempt: evidence.workflow.runAttempt,
    runId: evidence.workflow.runId,
    sourceCount: evidence.sourceHashes.length,
    transitionPathCount: evidence.transition.pathCount,
    verdict: "offline_consistent" as const,
  });
}

async function verifyOfflineV3(
  options: FilingParserCrossEngineExecutionEvidenceReviewOptions,
): Promise<FilingParserCrossEngineExecutionEvidenceReviewV3> {
  validateOptions(options);
  const repositoryPath = await realpath(options.repositoryPath);
  const evidencePath = await realpath(options.evidencePath);
  const repositoryStat = await lstat(repositoryPath);
  const evidenceStat = await lstat(evidencePath);
  if (
    !repositoryStat.isDirectory() ||
    repositoryStat.isSymbolicLink() ||
    !evidenceStat.isFile() ||
    evidenceStat.isSymbolicLink()
  )
    return invalid();
  const evidenceBytes = await readExactRegularFile(
    evidencePath,
    MAX_EVIDENCE_BYTES,
  );
  if (sha256(evidenceBytes) !== options.expectedEvidenceSha256)
    return invalid();
  const evidence = parseCanonicalFilingParserCrossEngineExecutionEvidenceV3(
    Uint8Array.from(evidenceBytes),
  );
  if (
    filingParserCrossEngineExecutionEvidenceV3Sha256(evidence) !==
      options.expectedEvidenceSha256 ||
    evidence.repository !== options.expectedRepository ||
    evidence.revision !== options.expectedRevision ||
    evidence.workflow.runId !== options.expectedRunId ||
    evidence.workflow.runAttempt !== options.expectedRunAttempt ||
    evidence.workflow.artifactName !== options.expectedArtifactName ||
    evidence.baseline !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE ||
    JSON.stringify(evidence.historicalV1) !==
      JSON.stringify(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY,
      ) ||
    JSON.stringify(evidence.historicalV2) !==
      JSON.stringify(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY)
  )
    return invalid();

  const head = exactLine(
    (await checkedCommand(repositoryPath, "git", ["rev-parse", "HEAD"])).stdout,
  );
  if (head !== options.expectedRevision) return invalid();
  const topLevel = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-parse",
        "--show-toplevel",
      ])
    ).stdout,
  );
  if (!samePath(await realpath(topLevel), repositoryPath)) return invalid();
  for (const revision of [
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_HISTORY.sourceRevision,
    FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY.sourceRevision,
  ])
    await checkedCommand(repositoryPath, "git", [
      "cat-file",
      "-e",
      `${revision}^{commit}`,
    ]);
  const mergeBase = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "merge-base",
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
        options.expectedRevision,
      ])
    ).stdout,
  );
  const range = `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE}..${options.expectedRevision}`;
  const successorCount = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--count",
        range,
      ])
    ).stdout,
  );
  const firstParentCount = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--first-parent",
        "--count",
        range,
      ])
    ).stdout,
  );
  const parentLine = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--parents",
        "--max-count=1",
        options.expectedRevision,
      ])
    ).stdout,
  );
  if (
    !filingParserCrossEngineExecutionV3ChainAllowed(
      mergeBase,
      successorCount,
      firstParentCount,
      options.expectedRevision,
      parentLine,
    )
  )
    return invalid();
  const status = await checkedCommand(repositoryPath, "git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (status.stdout.byteLength !== 0 || status.stderr.byteLength !== 0)
    return invalid();

  for (const source of evidence.sourceHashes) {
    const committed = (
      await checkedCommand(repositoryPath, "git", [
        "show",
        `${options.expectedRevision}:${source.path}`,
      ])
    ).stdout;
    if (committed.byteLength === 0 || committed.byteLength > MAX_SOURCE_BYTES)
      return invalid();
    if (sha256(committed) !== source.sha256) return invalid();
    const localPath = resolve(repositoryPath, source.path);
    const relativePath = relative(repositoryPath, localPath);
    if (!repositoryRelativePathIsContained(relativePath)) return invalid();
    const canonicalLocalPath = await realpath(localPath);
    if (
      !repositoryRelativePathIsContained(
        relative(repositoryPath, canonicalLocalPath),
      )
    )
      return invalid();
    const local = await readExactRegularFile(
      canonicalLocalPath,
      MAX_SOURCE_BYTES,
    );
    if (!exactBytes(local, committed)) return invalid();
  }

  const transition = parseTransition(
    (
      await checkedCommand(repositoryPath, "git", [
        "diff",
        "--name-status",
        "--no-renames",
        "-z",
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE,
        options.expectedRevision,
        "--",
      ])
    ).stdout,
  );
  if (
    JSON.stringify(transition) !== JSON.stringify(evidence.transition.entries)
  )
    return invalid();

  return Object.freeze({
    artifactName: evidence.workflow.artifactName,
    baseline: evidence.baseline,
    evidenceSha256: options.expectedEvidenceSha256,
    evidenceVersion: 3 as const,
    historicalV1: evidence.historicalV1,
    historicalV2: evidence.historicalV2,
    repository: evidence.repository,
    revision: evidence.revision,
    runAttempt: evidence.workflow.runAttempt,
    runId: evidence.workflow.runId,
    sourceCount: evidence.sourceHashes.length,
    transitionPathCount: evidence.transition.pathCount,
    verdict: "offline_consistent" as const,
  });
}

async function verifyOfflineV2(
  options: FilingParserCrossEngineExecutionEvidenceReviewOptions,
): Promise<FilingParserCrossEngineExecutionEvidenceReviewV2> {
  validateOptions(options);
  const repositoryPath = await realpath(options.repositoryPath);
  const evidencePath = await realpath(options.evidencePath);
  const repositoryStat = await lstat(repositoryPath);
  const evidenceStat = await lstat(evidencePath);
  if (
    !repositoryStat.isDirectory() ||
    repositoryStat.isSymbolicLink() ||
    !evidenceStat.isFile() ||
    evidenceStat.isSymbolicLink()
  )
    return invalid();
  const evidenceBytes = await readExactRegularFile(
    evidencePath,
    MAX_EVIDENCE_BYTES,
  );
  if (sha256(evidenceBytes) !== options.expectedEvidenceSha256)
    return invalid();
  const evidence = parseCanonicalFilingParserCrossEngineExecutionEvidenceV2(
    Uint8Array.from(evidenceBytes),
  );
  if (
    filingParserCrossEngineExecutionEvidenceV2Sha256(evidence) !==
      options.expectedEvidenceSha256 ||
    evidence.repository !== options.expectedRepository ||
    evidence.revision !== options.expectedRevision ||
    evidence.workflow.runId !== options.expectedRunId ||
    evidence.workflow.runAttempt !== options.expectedRunAttempt ||
    evidence.workflow.artifactName !== options.expectedArtifactName ||
    evidence.baseline !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE ||
    evidence.failedPrecursorRevision !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION ||
    JSON.stringify(evidence.failedRun) !==
      JSON.stringify(
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_RUN,
      ) ||
    JSON.stringify(evidence.historicalV1) !==
      JSON.stringify(FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY)
  )
    return invalid();

  const head = exactLine(
    (await checkedCommand(repositoryPath, "git", ["rev-parse", "HEAD"])).stdout,
  );
  if (head !== options.expectedRevision) return invalid();
  const topLevel = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-parse",
        "--show-toplevel",
      ])
    ).stdout,
  );
  if (!samePath(await realpath(topLevel), repositoryPath)) return invalid();
  await checkedCommand(repositoryPath, "git", [
    "cat-file",
    "-e",
    `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE}^{commit}`,
  ]);
  await checkedCommand(repositoryPath, "git", [
    "cat-file",
    "-e",
    `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION}^{commit}`,
  ]);
  await checkedCommand(repositoryPath, "git", [
    "cat-file",
    "-e",
    `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V1_HISTORY.sourceRevision}^{commit}`,
  ]);
  const mergeBase = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "merge-base",
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE,
        options.expectedRevision,
      ])
    ).stdout,
  );
  const range = `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE}..${options.expectedRevision}`;
  const successorCount = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--count",
        range,
      ])
    ).stdout,
  );
  const firstParentCount = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--first-parent",
        "--count",
        range,
      ])
    ).stdout,
  );
  const parentLine = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--parents",
        "--max-count=1",
        options.expectedRevision,
      ])
    ).stdout,
  );
  const failedPrecursorParentLine = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--parents",
        "--max-count=1",
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION,
      ])
    ).stdout,
  );
  if (
    !filingParserCrossEngineExecutionV2ChainAllowed(
      mergeBase,
      successorCount,
      firstParentCount,
      options.expectedRevision,
      parentLine,
      failedPrecursorParentLine,
    )
  )
    return invalid();
  const status = await checkedCommand(repositoryPath, "git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (status.stdout.byteLength !== 0 || status.stderr.byteLength !== 0)
    return invalid();

  for (const source of evidence.sourceHashes) {
    const committed = (
      await checkedCommand(repositoryPath, "git", [
        "show",
        `${options.expectedRevision}:${source.path}`,
      ])
    ).stdout;
    if (committed.byteLength === 0 || committed.byteLength > MAX_SOURCE_BYTES)
      return invalid();
    if (sha256(committed) !== source.sha256) return invalid();
    const localPath = resolve(repositoryPath, source.path);
    const relativePath = relative(repositoryPath, localPath);
    if (!repositoryRelativePathIsContained(relativePath)) return invalid();
    const canonicalLocalPath = await realpath(localPath);
    if (
      !repositoryRelativePathIsContained(
        relative(repositoryPath, canonicalLocalPath),
      )
    )
      return invalid();
    const local = await readExactRegularFile(
      canonicalLocalPath,
      MAX_SOURCE_BYTES,
    );
    if (!exactBytes(local, committed)) return invalid();
  }

  const transition = parseTransition(
    (
      await checkedCommand(repositoryPath, "git", [
        "diff",
        "--name-status",
        "--no-renames",
        "-z",
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE,
        options.expectedRevision,
        "--",
      ])
    ).stdout,
  );
  if (
    JSON.stringify(transition) !== JSON.stringify(evidence.transition.entries)
  )
    return invalid();

  return Object.freeze({
    artifactName: evidence.workflow.artifactName,
    baseline: evidence.baseline,
    evidenceSha256: options.expectedEvidenceSha256,
    evidenceVersion: 2 as const,
    failedPrecursorRevision: evidence.failedPrecursorRevision,
    failedRun: evidence.failedRun,
    historicalV1: evidence.historicalV1,
    repository: evidence.repository,
    revision: evidence.revision,
    runAttempt: evidence.workflow.runAttempt,
    runId: evidence.workflow.runId,
    sourceCount: evidence.sourceHashes.length,
    transitionPathCount: evidence.transition.pathCount,
    verdict: "offline_consistent" as const,
  });
}

async function verifyOffline(
  options: FilingParserCrossEngineExecutionEvidenceReviewOptions,
): Promise<FilingParserCrossEngineExecutionEvidenceReview> {
  validateOptions(options);
  const repositoryPath = await realpath(options.repositoryPath);
  const evidencePath = await realpath(options.evidencePath);
  const repositoryStat = await lstat(repositoryPath);
  const evidenceStat = await lstat(evidencePath);
  if (
    !repositoryStat.isDirectory() ||
    repositoryStat.isSymbolicLink() ||
    !evidenceStat.isFile() ||
    evidenceStat.isSymbolicLink()
  )
    return invalid();
  const evidenceBytes = await readExactRegularFile(
    evidencePath,
    MAX_EVIDENCE_BYTES,
  );
  if (sha256(evidenceBytes) !== options.expectedEvidenceSha256)
    return invalid();
  const evidence = parseCanonicalFilingParserCrossEngineExecutionEvidence(
    Uint8Array.from(evidenceBytes),
  );
  if (
    filingParserCrossEngineExecutionEvidenceSha256(evidence) !==
      options.expectedEvidenceSha256 ||
    evidence.repository !== options.expectedRepository ||
    evidence.revision !== options.expectedRevision ||
    evidence.workflow.runId !== options.expectedRunId ||
    evidence.workflow.runAttempt !== options.expectedRunAttempt ||
    evidence.workflow.artifactName !== options.expectedArtifactName ||
    evidence.baseline !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE ||
    evidence.failedCorrectiveRevision !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION ||
    evidence.failedDiagnosticRevision !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_DIAGNOSTIC_REVISION ||
    evidence.failedPrecursorRevision !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION ||
    evidence.failedRecoveryRevision !==
      FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION
  )
    return invalid();

  const head = exactLine(
    (await checkedCommand(repositoryPath, "git", ["rev-parse", "HEAD"])).stdout,
  );
  if (head !== options.expectedRevision) return invalid();
  const topLevel = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-parse",
        "--show-toplevel",
      ])
    ).stdout,
  );
  if (!samePath(await realpath(topLevel), repositoryPath)) return invalid();
  await checkedCommand(repositoryPath, "git", [
    "cat-file",
    "-e",
    `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE}^{commit}`,
  ]);
  await checkedCommand(repositoryPath, "git", [
    "cat-file",
    "-e",
    `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION}^{commit}`,
  ]);
  await checkedCommand(repositoryPath, "git", [
    "cat-file",
    "-e",
    `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION}^{commit}`,
  ]);
  await checkedCommand(repositoryPath, "git", [
    "cat-file",
    "-e",
    `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION}^{commit}`,
  ]);
  await checkedCommand(repositoryPath, "git", [
    "cat-file",
    "-e",
    `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_DIAGNOSTIC_REVISION}^{commit}`,
  ]);
  const mergeBase = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "merge-base",
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE,
        options.expectedRevision,
      ])
    ).stdout,
  );
  const successorCount = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--count",
        `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE}..${options.expectedRevision}`,
      ])
    ).stdout,
  );
  const firstParentCount = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--first-parent",
        "--count",
        `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE}..${options.expectedRevision}`,
      ])
    ).stdout,
  );
  const parentLine = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--parents",
        "--max-count=1",
        options.expectedRevision,
      ])
    ).stdout,
  );
  const failedPrecursorParentLine = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--parents",
        "--max-count=1",
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION,
      ])
    ).stdout,
  );
  const failedCorrectiveParentLine = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--parents",
        "--max-count=1",
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION,
      ])
    ).stdout,
  );
  const failedRecoveryParentLine = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--parents",
        "--max-count=1",
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION,
      ])
    ).stdout,
  );
  const failedDiagnosticParentLine = exactLine(
    (
      await checkedCommand(repositoryPath, "git", [
        "rev-list",
        "--parents",
        "--max-count=1",
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_DIAGNOSTIC_REVISION,
      ])
    ).stdout,
  );
  if (
    !filingParserCrossEngineExecutionCorrectiveChainAllowed(
      mergeBase,
      successorCount,
      firstParentCount,
      options.expectedRevision,
      parentLine,
      failedDiagnosticParentLine,
      failedRecoveryParentLine,
      failedCorrectiveParentLine,
      failedPrecursorParentLine,
    )
  )
    return invalid();
  const status = await checkedCommand(repositoryPath, "git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (status.stdout.byteLength !== 0 || status.stderr.byteLength !== 0)
    return invalid();

  for (const source of evidence.sourceHashes) {
    const committed = (
      await checkedCommand(repositoryPath, "git", [
        "show",
        `${options.expectedRevision}:${source.path}`,
      ])
    ).stdout;
    if (committed.byteLength === 0 || committed.byteLength > MAX_SOURCE_BYTES)
      return invalid();
    if (sha256(committed) !== source.sha256) return invalid();
    const localPath = resolve(repositoryPath, source.path);
    const relativePath = relative(repositoryPath, localPath);
    if (!repositoryRelativePathIsContained(relativePath)) return invalid();
    const canonicalLocalPath = await realpath(localPath);
    if (
      !repositoryRelativePathIsContained(
        relative(repositoryPath, canonicalLocalPath),
      )
    )
      return invalid();
    const local = await readExactRegularFile(
      canonicalLocalPath,
      MAX_SOURCE_BYTES,
    );
    if (!exactBytes(local, committed)) return invalid();
  }

  const transition = parseTransition(
    (
      await checkedCommand(repositoryPath, "git", [
        "diff",
        "--name-status",
        "--no-renames",
        "-z",
        FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE,
        options.expectedRevision,
        "--",
      ])
    ).stdout,
  );
  if (
    JSON.stringify(transition) !== JSON.stringify(evidence.transition.entries)
  )
    return invalid();

  return Object.freeze({
    artifactName: evidence.workflow.artifactName,
    baseline: evidence.baseline,
    evidenceSha256: options.expectedEvidenceSha256,
    failedCorrectiveRevision: evidence.failedCorrectiveRevision,
    failedDiagnosticRevision: evidence.failedDiagnosticRevision,
    failedPrecursorRevision: evidence.failedPrecursorRevision,
    failedRecoveryRevision: evidence.failedRecoveryRevision,
    repository: evidence.repository,
    revision: evidence.revision,
    runAttempt: evidence.workflow.runAttempt,
    runId: evidence.workflow.runId,
    sourceCount: evidence.sourceHashes.length,
    transitionPathCount: evidence.transition.pathCount,
    verdict: "offline_consistent" as const,
  });
}

/** @internal Exported for cross-platform containment regression tests. */
export function repositoryRelativePathIsContained(
  relativePath: string,
): boolean {
  return (
    relativePath.length > 0 &&
    relativePath !== ".." &&
    !relativePath.startsWith("../") &&
    !relativePath.startsWith("..\\") &&
    !isAbsolute(relativePath) &&
    !/^[A-Za-z]:[\\/]/u.test(relativePath) &&
    !relativePath.startsWith("/") &&
    !relativePath.startsWith("\\")
  );
}

function validateOptions(
  options: FilingParserCrossEngineExecutionEvidenceReviewOptions,
): void {
  const keys = [
    "evidencePath",
    "expectedArtifactName",
    "expectedEvidenceSha256",
    "expectedRepository",
    "expectedRevision",
    "expectedRunAttempt",
    "expectedRunId",
    "repositoryPath",
  ] as const;
  const descriptors = Object.getOwnPropertyDescriptors(options);
  if (
    typeof options !== "object" ||
    options === null ||
    isProxy(options) ||
    Object.getPrototypeOf(options) !== Object.prototype ||
    JSON.stringify(Reflect.ownKeys(options).sort()) !==
      JSON.stringify([...keys].sort()) ||
    keys.some((key) => {
      const descriptor = descriptors[key];
      return (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      );
    }) ||
    !isAbsolute(options.evidencePath) ||
    !isAbsolute(options.repositoryPath) ||
    !ARTIFACT.test(options.expectedArtifactName) ||
    !HASH.test(options.expectedEvidenceSha256) ||
    !REPOSITORY.test(options.expectedRepository) ||
    !COMMIT.test(options.expectedRevision) ||
    !Number.isSafeInteger(options.expectedRunAttempt) ||
    options.expectedRunAttempt < 1 ||
    !/^[1-9][0-9]{0,19}$/u.test(options.expectedRunId)
  )
    return invalid();
}

export function parseFilingParserCrossEngineExecutionEvidenceNulTransition(
  bytes: Uint8Array,
): readonly FilingParserCrossEngineExecutionEvidenceTransitionEntry[] {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return invalid();
  }
  if (text.length === 0 || !text.endsWith("\0")) return invalid();
  const fields = text.slice(0, -1).split("\0");
  if (fields.length % 2 !== 0 || fields.some((field) => field.length === 0))
    return invalid();
  const entries: FilingParserCrossEngineExecutionEvidenceTransitionEntry[] = [];
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index];
    const path = fields[index + 1];
    if ((status !== "A" && status !== "M") || path === undefined)
      return invalid();
    entries.push(Object.freeze({ path, status }));
  }
  return Object.freeze(
    [...entries].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
  );
}

const parseTransition =
  parseFilingParserCrossEngineExecutionEvidenceNulTransition;

async function readExactRegularFile(
  path: string,
  maximumBytes: number,
): Promise<Uint8Array> {
  if (!isAbsolute(path)) return invalid();
  const canonicalBefore = await realpath(path);
  if (!samePath(canonicalBefore, resolve(path))) return invalid();
  const before = await lstat(path);
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    !filingParserCrossEngineExecutionFileSizeAllowed(before.size, maximumBytes)
  )
    return invalid();
  const noFollow = process.platform === "win32" ? 0 : fsConstants.O_NOFOLLOW;
  const handle = await open(path, fsConstants.O_RDONLY | noFollow);
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.size !== before.size ||
      (before.ino !== 0 && opened.ino !== before.ino) ||
      (before.dev !== 0 && opened.dev !== before.dev)
    )
      return invalid();
    const output = new Uint8Array(opened.size + 1);
    let offset = 0;
    while (offset < output.byteLength) {
      const { bytesRead } = await handle.read(
        output,
        offset,
        output.byteLength - offset,
        offset,
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = await handle.stat();
    const pathAfter = await lstat(path);
    const canonicalAfter = await realpath(path);
    if (
      offset !== opened.size ||
      after.size !== opened.size ||
      after.mtimeMs !== opened.mtimeMs ||
      after.ctimeMs !== opened.ctimeMs ||
      pathAfter.isSymbolicLink() ||
      !pathAfter.isFile() ||
      pathAfter.size !== opened.size ||
      !samePath(canonicalAfter, canonicalBefore) ||
      (opened.ino !== 0 && pathAfter.ino !== opened.ino) ||
      (opened.dev !== 0 && pathAfter.dev !== opened.dev)
    )
      return invalid();
    return output.subarray(0, offset);
  } finally {
    await handle.close();
  }
}

function samePath(left: string, right: string): boolean {
  return relative(left, right) === "" && relative(right, left) === "";
}

/** @internal Bounded-file regression seam. */
export function filingParserCrossEngineExecutionFileSizeAllowed(
  size: number,
  maximumBytes: number,
): boolean {
  return (
    Number.isSafeInteger(size) &&
    Number.isSafeInteger(maximumBytes) &&
    size > 0 &&
    maximumBytes > 0 &&
    size <= maximumBytes
  );
}

/** @internal Exact five-commit corrective-chain regression seam. */
export function filingParserCrossEngineExecutionCorrectiveChainAllowed(
  mergeBase: string,
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
  failedDiagnosticParentLine: string,
  failedRecoveryParentLine: string,
  failedCorrectiveParentLine: string,
  failedPrecursorParentLine: string,
): boolean {
  return (
    mergeBase === FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE &&
    successorCount === "5" &&
    firstParentCount === "5" &&
    COMMIT.test(revision) &&
    parentLine ===
      `${revision} ${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_DIAGNOSTIC_REVISION}` &&
    failedDiagnosticParentLine ===
      `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_DIAGNOSTIC_REVISION} ${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION}` &&
    failedRecoveryParentLine ===
      `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_RECOVERY_REVISION} ${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION}` &&
    failedCorrectiveParentLine ===
      `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_CORRECTIVE_REVISION} ${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION}` &&
    failedPrecursorParentLine ===
      `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_FAILED_PRECURSOR_REVISION} ${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_BASELINE}`
  );
}

/** @internal Exact two-commit Cycle 2l corrective transition regression seam. */
export function filingParserCrossEngineExecutionV2ChainAllowed(
  mergeBase: string,
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
  failedPrecursorParentLine: string,
): boolean {
  return (
    mergeBase === FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE &&
    successorCount === "2" &&
    firstParentCount === "2" &&
    COMMIT.test(revision) &&
    parentLine ===
      `${revision} ${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION}` &&
    failedPrecursorParentLine ===
      `${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_FAILED_PRECURSOR_REVISION} ${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V2_BASELINE}`
  );
}

/** @internal Exact one-commit Cycle 2m direct-child transition seam. */
export function filingParserCrossEngineExecutionV3ChainAllowed(
  mergeBase: string,
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
): boolean {
  return (
    mergeBase === FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE &&
    successorCount === "1" &&
    firstParentCount === "1" &&
    COMMIT.test(revision) &&
    revision !== FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE &&
    parentLine ===
      `${revision} ${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V3_BASELINE}`
  );
}

/** @internal Exact one-commit Cycle 2n direct-child transition seam. */
export function filingParserCrossEngineExecutionV4ChainAllowed(
  mergeBase: string,
  successorCount: string,
  firstParentCount: string,
  revision: string,
  parentLine: string,
): boolean {
  return (
    mergeBase === FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE &&
    successorCount === "1" &&
    firstParentCount === "1" &&
    COMMIT.test(revision) &&
    revision !== FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE &&
    parentLine ===
      `${revision} ${FILING_PARSER_CROSS_ENGINE_EXECUTION_EVIDENCE_V4_BASELINE}`
  );
}

interface CommandResult {
  readonly stderr: Uint8Array;
  readonly stdout: Uint8Array;
}

function checkedCommand(
  cwd: string,
  command: string,
  args: readonly string[],
): Promise<CommandResult> {
  return Promise.all([trustedGitExecutable(), realpath(cwd)])
    .then(
      ([executable, repositoryPath]) =>
        new Promise<CommandResult>((resolvePromise, rejectPromise) => {
          if (command !== "git")
            return rejectPromise(new Error("command failed"));
          const child = spawn(
            executable,
            filingParserCrossEngineExecutionGitArguments(repositoryPath, args),
            {
              env: cleanFilingParserCrossEngineExecutionGitEnvironment(
                process.env,
              ),
              shell: false,
              stdio: ["ignore", "pipe", "pipe"],
              windowsHide: true,
            },
          );
          const stdout: Buffer[] = [];
          const stderr: Buffer[] = [];
          let size = 0;
          let stderrSize = 0;
          let settled = false;
          const finish = (error?: Error, value?: CommandResult): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error !== undefined) rejectPromise(error);
            else resolvePromise(value as CommandResult);
          };
          const timer = setTimeout(() => {
            child.kill("SIGKILL");
            finish(new Error("command failed"));
          }, 30_000);
          const collect = (target: Buffer[]) => (chunk: Buffer) => {
            size += chunk.byteLength;
            if (size > MAX_COMMAND_BYTES) {
              child.kill("SIGKILL");
              finish(new Error("command failed"));
            } else target.push(Buffer.from(chunk));
          };
          child.stdout.on("data", collect(stdout));
          child.stderr.on("data", (chunk: Buffer) => {
            stderrSize += chunk.byteLength;
            if (stderrSize > 65_536) {
              child.kill("SIGKILL");
              finish(new Error("command failed"));
            } else stderr.push(Buffer.from(chunk));
          });
          child.once("error", (error) => finish(error));
          child.once("close", (code, signal) => {
            if (
              code !== 0 ||
              signal !== null ||
              size > MAX_COMMAND_BYTES ||
              stderrSize !== 0
            )
              finish(new Error("command failed"));
            else
              finish(undefined, {
                stderr: Uint8Array.from(Buffer.concat(stderr)),
                stdout: Uint8Array.from(Buffer.concat(stdout)),
              });
          });
        }),
    )
    .catch(() => invalid());
}

/** @internal Hostile-environment regression seam. */
export function filingParserCrossEngineExecutionGitArguments(
  repositoryPath: string,
  args: readonly string[],
): readonly string[] {
  return Object.freeze([
    "--no-replace-objects",
    "--no-lazy-fetch",
    "-c",
    "advice.graftFileDeprecated=false",
    "-C",
    repositoryPath,
    ...args,
  ]);
}

/** @internal Hostile-environment regression seam. */
export function cleanFilingParserCrossEngineExecutionGitEnvironment(
  ambient: Readonly<NodeJS.ProcessEnv>,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(ambient))
    if (
      !/^GIT_/iu.test(key) &&
      key.toUpperCase() !== "GCM_INTERACTIVE" &&
      !/^(?:LD|DYLD)_/iu.test(key)
    )
      environment[key] = value;
  const nullDevice = platform === "win32" ? "NUL" : "/dev/null";
  Object.assign(environment, {
    GIT_ATTR_NOSYSTEM: "1",
    GIT_CONFIG_COUNT: "0",
    GIT_CONFIG_GLOBAL: nullDevice,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: nullDevice,
    GIT_GRAFT_FILE: nullDevice,
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "Never",
  });
  return Object.freeze(environment);
}

async function trustedGitExecutable(): Promise<string> {
  const candidates =
    process.platform === "win32"
      ? [
          join("C:\\Program Files", "Git", "cmd", "git.exe"),
          join("C:\\Program Files", "Git", "bin", "git.exe"),
        ]
      : ["/usr/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"];
  for (const candidate of candidates) {
    try {
      const resolved = await realpath(candidate);
      const info = await lstat(resolved);
      if (isAbsolute(resolved) && info.isFile() && !info.isSymbolicLink())
        return resolved;
    } catch {
      /* fixed candidates only */
    }
  }
  return invalid();
}

function exactLine(bytes: Uint8Array): string {
  const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!value.endsWith("\n") || value.slice(0, -1).includes("\n"))
    return invalid();
  return value.slice(0, -1);
}

function exactBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength &&
    left.every((byte, index) => byte === right[index])
  );
}

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function invalid(): never {
  throw new Error(
    "Offline filing parser cross-engine execution evidence review failed.",
  );
}
