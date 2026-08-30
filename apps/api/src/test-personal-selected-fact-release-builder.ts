import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createPersonalFilingQualityMeasurementProtocol,
  preparePersonalFilingSelectedFactRelease,
} from "@research-cockpit/personal-filing-corpus";
import { buildPersonalFilingQualityMeasurementFixture } from "../../../packages/personal-filing-corpus/src/test-personal-filing-quality-measurement-builder";

import {
  loadPersonalSelectedFactRelease,
  type PersonalSelectedFactReleaseCapability,
  type PersonalSelectedFactReleaseEnvironment,
} from "./personal-selected-fact-release";
import {
  createValidPersonalQualityReadinessWrapper,
  encodePersonalQualityReadinessWrapper,
} from "./test-personal-quality-readiness-builder";

const SOURCE_COMMIT = "1".repeat(40);
const AUTHORIZATION_TOKEN = "A".repeat(43);

export interface PublicPersonalSelectedFactReleaseFixture {
  readonly approvalPath: string;
  readonly bundlePath: string;
  readonly capability: PersonalSelectedFactReleaseCapability;
  readonly consumedApprovalPath: string;
  readonly directory: string;
  readonly environment: PersonalSelectedFactReleaseEnvironment;
  readonly qualityPath: string;
}

export async function createPublicPersonalSelectedFactReleaseFixture(): Promise<PublicPersonalSelectedFactReleaseFixture> {
  const generated = buildPersonalFilingQualityMeasurementFixture(false);
  const committed = createPersonalFilingQualityMeasurementProtocol().commit(
    generated.commitInput,
  );
  if (committed.status !== "candidate_committed_for_personal_use") {
    throw new Error("Generated public selected-fact fixture did not commit.");
  }
  const expectedBindings = {
    candidateCommitmentSha256: committed.candidateCommitmentSha256,
    candidateObservationsSha256: committed.candidateObservationsSha256,
    inputSetSha256: committed.inputSetSha256,
    ownerReviewedReferenceSha256: committed.ownerReviewedReferenceSha256,
    qualityPlanSha256: committed.qualityPlanSha256,
  };
  const releasePlan = {
    documentIndex: 0,
    factKeys: ["assets", "revenue"] as const,
    profile: "personal_single_user_local" as const,
    role: "personal_selected_fact_release_plan" as const,
    schemaVersion: "1.0.0" as const,
    selectionRule: "exact_candidate_document_index_and_fact_key.v1" as const,
  };
  const prepared = preparePersonalFilingSelectedFactRelease({
    ...generated.commitInput,
    expectedBindings,
    releasePlan,
  });
  if (prepared.status !== "prepared_selected_facts_for_personal_use") {
    throw new Error("Generated public selected-fact fixture did not prepare.");
  }
  const response = {
    facts: prepared.facts,
    profile: "personal_single_user_local",
    schemaVersion: "1.0.0",
    status: "selected_facts_released",
  };
  const bundle = {
    declaration: base64(generated.commitInput.declaration),
    manifest: base64(generated.commitInput.manifest),
    normalizationPlan: base64(generated.commitInput.normalizationPlan),
    profile: "personal_single_user_local",
    qualityPlan: base64(generated.commitInput.qualityPlan),
    rawFilingDocuments: generated.commitInput.rawFilingDocuments.map(base64),
    releasePlan,
    role: "personal_selected_fact_release_bundle",
    schemaVersion: "1.0.0",
    sourceCommit: SOURCE_COMMIT,
    sourceDocuments: generated.commitInput.sourceDocuments.map(base64),
  };
  const bundleBytes = canonicalBytes(bundle);
  const qualityBytes = encodePersonalQualityReadinessWrapper(
    createValidPersonalQualityReadinessWrapper(
      generated.commitInput.rawFilingDocuments.length,
      expectedBindings,
    ),
  );
  const approval = {
    action: "APPROVE_EXACT_CYCLE2Z_PERSONAL_SELECTED_FACT_RELEASE",
    authorizationToken: AUTHORIZATION_TOKEN,
    profile: "personal_single_user_local",
    qualityResultSha256: sha256(qualityBytes),
    releaseBundleSha256: sha256(bundleBytes),
    releaseResponseSha256: sha256(
      new TextEncoder().encode(canonicalJson(response)),
    ),
    schemaVersion: "1.0.0",
    sourceCommit: SOURCE_COMMIT,
  };
  const directory = await mkdtemp(join(tmpdir(), "personal-fact-release-"));
  const bundlePath = join(
    directory,
    "cycle2z-personal-selected-fact-release.bundle.json",
  );
  const approvalPath = join(
    directory,
    "cycle2z-personal-selected-fact-release-approval.once.json",
  );
  const consumedApprovalPath = join(
    directory,
    "cycle2z-personal-selected-fact-release-approval.consumed.json",
  );
  const qualityPath = join(directory, "quality-result.json");
  await Promise.all([
    writeFile(bundlePath, bundleBytes),
    writeFile(approvalPath, canonicalBytes(approval)),
    writeFile(qualityPath, qualityBytes),
  ]);
  const environment = {
    PERSONAL_FILING_QUALITY_RESULT_PATH: qualityPath,
    PERSONAL_FILING_QUALITY_RESULT_SHA256: sha256(qualityBytes),
    PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH: approvalPath,
    PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH: bundlePath,
    PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256: sha256(bundleBytes),
  };
  const capability = await loadPersonalSelectedFactRelease(
    environment,
    SOURCE_COMMIT,
  );
  if (capability === undefined) {
    throw new Error("Expected generated public selected-fact release.");
  }
  return {
    approvalPath,
    bundlePath,
    capability,
    consumedApprovalPath,
    directory,
    environment,
    qualityPath,
  };
}

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}
