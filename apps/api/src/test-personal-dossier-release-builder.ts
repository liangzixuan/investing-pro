import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { preparePersonalFilingDossier } from "@research-cockpit/personal-filing-corpus";
import { buildPersonalFilingDossierInput } from "../../../packages/personal-filing-corpus/src/test-personal-filing-dossier-builder";

import {
  loadPersonalDossierRelease,
  type PersonalDossierReleaseCapability,
  type PersonalDossierReleaseEnvironment,
} from "./personal-dossier-release";
import {
  createValidPersonalQualityReadinessWrapper,
  encodePersonalQualityReadinessWrapper,
} from "./test-personal-quality-readiness-builder";

const SOURCE_COMMIT = "3".repeat(40);
const AUTHORIZATION_TOKEN = "D".repeat(43);

export interface PublicPersonalDossierReleaseFixture {
  readonly approvalPath: string;
  readonly bundlePath: string;
  readonly capability: PersonalDossierReleaseCapability;
  readonly consumedApprovalPath: string;
  readonly directory: string;
  readonly environment: PersonalDossierReleaseEnvironment;
  readonly qualityPath: string;
}

export interface PublicPersonalDossierReleaseFixtureOptions {
  readonly documentIndex?: number;
  readonly rawDocumentSuffix?: string;
  readonly sourceDocumentSuffix?: string;
}

export async function createPublicPersonalDossierReleaseFixture(
  sourceCommit = SOURCE_COMMIT,
  withAmendment = true,
  options: PublicPersonalDossierReleaseFixtureOptions = {},
): Promise<PublicPersonalDossierReleaseFixture> {
  const documentIndex = options.documentIndex ?? (withAmendment ? 1 : 0);
  const input = buildPersonalFilingDossierInput(withAmendment, documentIndex);
  const prepared = preparePersonalFilingDossier(input);
  if (prepared.status !== "prepared_personal_dossier_for_personal_use") {
    throw new Error(
      "Generated public personal-dossier fixture did not prepare.",
    );
  }
  const response = {
    asOf: prepared.asOf,
    chart: prepared.chart,
    dataMode: "personal",
    evidence: prepared.evidence,
    facts: prepared.facts,
    lineage: prepared.lineage,
    omissions: prepared.omissions,
    profile: "personal_single_user_local",
    schemaVersion: "1.0.0",
    status: "personal_dossier_released",
    valuationInputs: prepared.valuationInputs,
  };
  const rawFilingDocuments = input.rawFilingDocuments.map(base64);
  const sourceDocuments = input.sourceDocuments.map(base64);
  if (options.rawDocumentSuffix !== undefined) {
    if (documentIndex !== 0) {
      throw new TypeError("Generated dossier suffix fixture is invalid.");
    }
    rawFilingDocuments[1] = options.rawDocumentSuffix;
  }
  if (options.sourceDocumentSuffix !== undefined) {
    if (documentIndex !== 0) {
      throw new TypeError("Generated dossier suffix fixture is invalid.");
    }
    sourceDocuments[1] = options.sourceDocumentSuffix;
  }
  const bundle = {
    declaration: base64(input.declaration),
    dossierPlan: input.dossierPlan,
    manifest: base64(input.manifest),
    normalizationPlan: base64(input.normalizationPlan),
    profile: "personal_single_user_local",
    qualityPlan: base64(input.qualityPlan),
    rawFilingDocuments,
    role: "personal_dossier_release_bundle",
    schemaVersion: "1.0.0",
    sourceCommit,
    sourceDocuments,
  };
  const bundleBytes = canonicalBytes(bundle);
  const qualityBytes = encodePersonalQualityReadinessWrapper(
    createValidPersonalQualityReadinessWrapper(
      documentIndex + 1,
      input.expectedBindings,
    ),
  );
  const approval = {
    action: "APPROVE_EXACT_CYCLE3B_PERSONAL_DOSSIER_RELEASE",
    authorizationToken: AUTHORIZATION_TOKEN,
    dossierBundleSha256: sha256(bundleBytes),
    dossierResponseSha256: sha256(
      new TextEncoder().encode(canonicalJson(response)),
    ),
    profile: "personal_single_user_local",
    qualityResultSha256: sha256(qualityBytes),
    schemaVersion: "1.0.0",
    sourceCommit,
  };
  const directory = await mkdtemp(join(tmpdir(), "personal-dossier-release-"));
  const bundlePath = join(
    directory,
    "cycle3b-personal-dossier-release.bundle.json",
  );
  const approvalPath = join(
    directory,
    "cycle3b-personal-dossier-release-approval.once.json",
  );
  const consumedApprovalPath = join(
    directory,
    "cycle3b-personal-dossier-release-approval.consumed.json",
  );
  const qualityPath = join(directory, "quality-result.json");
  await Promise.all([
    writeFile(bundlePath, bundleBytes),
    writeFile(approvalPath, canonicalBytes(approval)),
    writeFile(qualityPath, qualityBytes),
  ]);
  const environment = {
    PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH: approvalPath,
    PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH: bundlePath,
    PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256: sha256(bundleBytes),
    PERSONAL_FILING_QUALITY_RESULT_PATH: qualityPath,
    PERSONAL_FILING_QUALITY_RESULT_SHA256: sha256(qualityBytes),
  };
  const capability = await loadPersonalDossierRelease(
    environment,
    sourceCommit,
  );
  if (capability === undefined) {
    throw new Error("Expected generated public personal-dossier release.");
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
