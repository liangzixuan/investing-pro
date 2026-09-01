import { createHash, timingSafeEqual } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import { link, lstat, open, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve } from "node:path";

import type { PersonalFilingDossierDto } from "@research-cockpit/contracts";
import {
  PERSONAL_FILING_FACT_KEYS,
  preparePersonalFilingDossier,
  type PersonalFilingDossierPlan,
} from "@research-cockpit/personal-filing-corpus";

import { loadValidatedPersonalQualityAdmission } from "./personal-quality-readiness";

const BUNDLE_PATH_KEY = "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH" as const;
const BUNDLE_SHA256_KEY =
  "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256" as const;
const APPROVAL_PATH_KEY =
  "PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH" as const;
const QUALITY_RESULT_SHA256_KEY =
  "PERSONAL_FILING_QUALITY_RESULT_SHA256" as const;
const MAX_BUNDLE_BYTES = 128 * 1024 * 1024;
const MAX_APPROVAL_BYTES = 16 * 1024;
const MAX_DECLARATION_BYTES = 8 * 1024;
const MAX_MANIFEST_BYTES = 512 * 1024;
const MAX_NORMALIZATION_PLAN_BYTES = 32 * 1024;
const MAX_QUALITY_PLAN_BYTES = 64 * 1024;
const MAX_RAW_DOCUMENT_BYTES = 32 * 1024 * 1024;
const MAX_SOURCE_DOCUMENT_BYTES = 128 * 1024;
const MAX_DOCUMENTS = 2;
const HASH = /^sha256:[0-9a-f]{64}$/u;
const SOURCE_COMMIT = /^[0-9a-f]{40}$/u;
const BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const TOKEN = /^[A-Za-z0-9_-]{43}$/u;
const ERROR_MESSAGE = "Personal dossier release is unavailable.";
const SCHEMA_VERSION = "1.0.0" as const;
const PROFILE = "personal_single_user_local" as const;
const BUNDLE_ROLE = "personal_dossier_release_bundle" as const;
const APPROVAL_ACTION =
  "APPROVE_EXACT_CYCLE3B_PERSONAL_DOSSIER_RELEASE" as const;
const BUNDLE_FILENAME = "cycle3b-personal-dossier-release.bundle.json";
const APPROVAL_FILENAME = "cycle3b-personal-dossier-release-approval.once.json";
const CONSUMED_APPROVAL_FILENAME =
  "cycle3b-personal-dossier-release-approval.consumed.json";

declare const personalDossierReleaseCapabilityBrand: unique symbol;

export type PersonalDossierReleaseCapability = Readonly<{
  [personalDossierReleaseCapabilityBrand]: true;
}>;

export type PersonalDossierReleaseEnvironment = Readonly<
  Record<string, string | undefined>
>;

interface StableFileSnapshot {
  readonly bytes: Uint8Array;
  readonly state: BigIntStats;
}

const personalDossierReleaseCapabilities = new WeakMap<
  object,
  PersonalFilingDossierDto
>();

export class PersonalDossierReleaseError extends Error {
  public constructor() {
    super(ERROR_MESSAGE);
    Object.defineProperty(this, "name", {
      configurable: true,
      value: "PersonalDossierReleaseError",
    });
  }
}

export async function loadPersonalDossierRelease(
  environment: PersonalDossierReleaseEnvironment,
  runtimeSourceCommit?: string,
): Promise<PersonalDossierReleaseCapability | undefined> {
  const bundlePath = environment[BUNDLE_PATH_KEY];
  const expectedBundleSha256 = environment[BUNDLE_SHA256_KEY];
  const approvalPath = environment[APPROVAL_PATH_KEY];
  if (
    bundlePath === undefined &&
    expectedBundleSha256 === undefined &&
    approvalPath === undefined
  ) {
    return undefined;
  }

  let bundleBytes: Uint8Array | undefined;
  let approvalBytes: Uint8Array | undefined;
  const decoded: Uint8Array[] = [];
  let tokenBytes: Uint8Array | undefined;
  try {
    if (
      !validAbsolutePath(bundlePath) ||
      basename(bundlePath) !== BUNDLE_FILENAME ||
      typeof expectedBundleSha256 !== "string" ||
      !HASH.test(expectedBundleSha256) ||
      !validAbsolutePath(approvalPath) ||
      basename(approvalPath) !== APPROVAL_FILENAME ||
      resolve(dirname(bundlePath)) !== resolve(dirname(approvalPath)) ||
      typeof runtimeSourceCommit !== "string" ||
      !SOURCE_COMMIT.test(runtimeSourceCommit)
    ) {
      fail();
    }
    const qualityResultSha256 = environment[QUALITY_RESULT_SHA256_KEY];
    if (
      typeof qualityResultSha256 !== "string" ||
      !HASH.test(qualityResultSha256)
    ) {
      fail();
    }
    const qualityAdmission =
      await loadValidatedPersonalQualityAdmission(environment);
    if (qualityAdmission === undefined) fail();

    const bundleSnapshot = await readStableRegularFile(
      bundlePath,
      MAX_BUNDLE_BYTES,
    );
    bundleBytes = bundleSnapshot.bytes;
    if (!equalAscii(sha256(bundleBytes), expectedBundleSha256)) fail();
    const bundle = parseCanonicalRecord(bundleBytes, [
      "declaration",
      "dossierPlan",
      "manifest",
      "normalizationPlan",
      "profile",
      "qualityPlan",
      "rawFilingDocuments",
      "role",
      "schemaVersion",
      "sourceCommit",
      "sourceDocuments",
    ]);
    if (
      bundle.schemaVersion !== SCHEMA_VERSION ||
      bundle.profile !== PROFILE ||
      bundle.role !== BUNDLE_ROLE ||
      typeof bundle.sourceCommit !== "string" ||
      !SOURCE_COMMIT.test(bundle.sourceCommit) ||
      bundle.sourceCommit !== runtimeSourceCommit
    ) {
      fail();
    }

    const declaration = decodeBase64(
      bundle.declaration,
      MAX_DECLARATION_BYTES,
      decoded,
    );
    const manifest = decodeBase64(bundle.manifest, MAX_MANIFEST_BYTES, decoded);
    const normalizationPlan = decodeBase64(
      bundle.normalizationPlan,
      MAX_NORMALIZATION_PLAN_BYTES,
      decoded,
    );
    const qualityPlan = decodeBase64(
      bundle.qualityPlan,
      MAX_QUALITY_PLAN_BYTES,
      decoded,
    );
    const dossierPlan = validateDossierPlan(bundle.dossierPlan);
    const prefixDocumentCount = dossierPlan.documentIndex + 1;
    const rawFilingDocuments = decodeBase64ArrayPrefix(
      bundle.rawFilingDocuments,
      MAX_RAW_DOCUMENT_BYTES,
      decoded,
      prefixDocumentCount,
    );
    const sourceDocuments = decodeBase64ArrayPrefix(
      bundle.sourceDocuments,
      MAX_SOURCE_DOCUMENT_BYTES,
      decoded,
      prefixDocumentCount,
    );

    const prepared = preparePersonalFilingDossier({
      declaration,
      dossierPlan,
      expectedBindings: {
        candidateCommitmentSha256:
          qualityAdmission.bindings.candidateCommitmentSha256,
        candidateObservationsSha256:
          qualityAdmission.bindings.candidateObservationsSha256,
        inputSetSha256: qualityAdmission.bindings.inputSetSha256,
        ownerReviewedReferenceSha256:
          qualityAdmission.bindings.ownerReviewedReferenceSha256,
        qualityPlanSha256: qualityAdmission.bindings.qualityPlanSha256,
      },
      manifest,
      normalizationPlan,
      qualityPlan,
      rawFilingDocuments,
      sourceDocuments,
    });
    if (
      prepared.schemaVersion !== SCHEMA_VERSION ||
      prepared.profile !== PROFILE ||
      prepared.role !== "personal_dossier" ||
      prepared.status !== "prepared_personal_dossier_for_personal_use" ||
      prepared.facts.length === 0 ||
      prepared.evidence.length !== prepared.facts.length
    ) {
      fail();
    }

    const response = Object.freeze({
      asOf: prepared.asOf,
      chart: prepared.chart,
      dataMode: "personal" as const,
      evidence: prepared.evidence,
      facts: prepared.facts,
      lineage: prepared.lineage,
      omissions: prepared.omissions,
      profile: PROFILE,
      schemaVersion: SCHEMA_VERSION,
      status: "personal_dossier_released" as const,
      valuationInputs: prepared.valuationInputs,
    }) satisfies PersonalFilingDossierDto;
    assertDeepFrozen(response);
    const dossierResponseSha256 = sha256(
      new TextEncoder().encode(canonicalJson(response)),
    );

    const approvalSnapshot = await readStableRegularFile(
      approvalPath,
      MAX_APPROVAL_BYTES,
    );
    approvalBytes = approvalSnapshot.bytes;
    const approval = parseCanonicalRecord(approvalBytes, [
      "action",
      "authorizationToken",
      "dossierBundleSha256",
      "dossierResponseSha256",
      "profile",
      "qualityResultSha256",
      "schemaVersion",
      "sourceCommit",
    ]);
    if (
      approval.schemaVersion !== SCHEMA_VERSION ||
      approval.action !== APPROVAL_ACTION ||
      approval.profile !== PROFILE ||
      approval.sourceCommit !== bundle.sourceCommit ||
      approval.qualityResultSha256 !== qualityResultSha256 ||
      approval.dossierBundleSha256 !== expectedBundleSha256 ||
      approval.dossierResponseSha256 !== dossierResponseSha256 ||
      typeof approval.authorizationToken !== "string" ||
      !TOKEN.test(approval.authorizationToken)
    ) {
      fail();
    }
    tokenBytes = new TextEncoder().encode(approval.authorizationToken);
    await consumeOnceFile(approvalPath, approvalSnapshot.state);

    const capability = Object.freeze({}) as PersonalDossierReleaseCapability;
    personalDossierReleaseCapabilities.set(capability, response);
    return capability;
  } catch {
    throw new PersonalDossierReleaseError();
  } finally {
    bundleBytes?.fill(0);
    approvalBytes?.fill(0);
    tokenBytes?.fill(0);
    for (const bytes of decoded) bytes.fill(0);
  }
}

export function isPersonalDossierReleaseCapability(
  value: unknown,
): value is PersonalDossierReleaseCapability {
  if (typeof value !== "object" || value === null) return false;
  try {
    return (
      Object.isFrozen(value) && personalDossierReleaseCapabilities.has(value)
    );
  } catch {
    return false;
  }
}

export function getPersonalDossierResponse(
  capability: PersonalDossierReleaseCapability,
): PersonalFilingDossierDto {
  const response = personalDossierReleaseCapabilities.get(capability);
  if (response === undefined) fail();
  return response;
}

function validateDossierPlan(value: unknown): PersonalFilingDossierPlan {
  const plan = exactRecord(value, [
    "chartFactKeys",
    "documentIndex",
    "factKeys",
    "profile",
    "role",
    "schemaVersion",
    "snapshotRule",
  ]);
  if (
    plan.schemaVersion !== SCHEMA_VERSION ||
    plan.profile !== PROFILE ||
    plan.role !== "personal_dossier_release_plan" ||
    plan.snapshotRule !== "exact_candidate_document_index.v1" ||
    !Number.isSafeInteger(plan.documentIndex) ||
    (plan.documentIndex as number) < 0 ||
    (plan.documentIndex as number) >= MAX_DOCUMENTS
  ) {
    fail();
  }
  const factKeys = validateFactKeys(plan.factKeys, false);
  const chartFactKeys = validateFactKeys(plan.chartFactKeys, true);
  if (chartFactKeys.some((key) => !factKeys.includes(key))) fail();
  return {
    chartFactKeys,
    documentIndex: plan.documentIndex as number,
    factKeys,
    profile: PROFILE,
    role: "personal_dossier_release_plan",
    schemaVersion: SCHEMA_VERSION,
    snapshotRule: "exact_candidate_document_index.v1",
  };
}

function validateFactKeys(
  value: unknown,
  allowEmpty: boolean,
): (typeof PERSONAL_FILING_FACT_KEYS)[number][] {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.length > PERSONAL_FILING_FACT_KEYS.length
  ) {
    fail();
  }
  let previous = -1;
  const keys: (typeof PERSONAL_FILING_FACT_KEYS)[number][] = [];
  for (const valueKey of value) {
    const index = PERSONAL_FILING_FACT_KEYS.indexOf(
      valueKey as (typeof PERSONAL_FILING_FACT_KEYS)[number],
    );
    if (index <= previous) fail();
    keys.push(PERSONAL_FILING_FACT_KEYS[index]!);
    previous = index;
  }
  return keys;
}

function decodeBase64ArrayPrefix(
  value: unknown,
  maxBytes: number,
  decoded: Uint8Array[],
  prefixDocumentCount: number,
): Uint8Array[] {
  if (
    !Array.isArray(value) ||
    !Number.isSafeInteger(prefixDocumentCount) ||
    prefixDocumentCount < 1 ||
    prefixDocumentCount > MAX_DOCUMENTS ||
    value.length < prefixDocumentCount ||
    value.length > MAX_DOCUMENTS
  )
    fail();
  const prefix: Uint8Array[] = [];
  for (let index = 0; index < prefixDocumentCount; index += 1) {
    prefix.push(decodeBase64(value[index], maxBytes, decoded));
  }
  return prefix;
}

function decodeBase64(
  value: unknown,
  maxBytes: number,
  decoded: Uint8Array[],
): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > Math.ceil(maxBytes / 3) * 4 ||
    !BASE64.test(value)
  ) {
    fail();
  }
  const buffer = Buffer.from(value, "base64");
  if (
    buffer.length === 0 ||
    buffer.length > maxBytes ||
    buffer.toString("base64") !== value
  ) {
    buffer.fill(0);
    fail();
  }
  const bytes = Uint8Array.from(buffer);
  buffer.fill(0);
  decoded.push(bytes);
  return bytes;
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  if (!Object.isFrozen(value)) fail();
  seen.add(value);
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

async function readStableRegularFile(
  path: string,
  maximumBytes: number,
): Promise<StableFileSnapshot> {
  const pathBefore = await lstat(path, { bigint: true });
  if (
    !pathBefore.isFile() ||
    pathBefore.isSymbolicLink() ||
    pathBefore.nlink !== 1n
  )
    fail();
  const noFollow = "O_NOFOLLOW" in constants ? constants.O_NOFOLLOW : 0;
  const handle = await open(path, constants.O_RDONLY | noFollow);
  let buffer: Buffer | undefined;
  try {
    const handleBefore = await handle.stat({ bigint: true });
    if (
      !handleBefore.isFile() ||
      !sameFileState(pathBefore, handleBefore) ||
      handleBefore.size <= 0n ||
      handleBefore.size > BigInt(maximumBytes)
    ) {
      fail();
    }
    buffer = Buffer.alloc(Number(handleBefore.size));
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        offset,
        buffer.length - offset,
        offset,
      );
      if (bytesRead === 0) fail();
      offset += bytesRead;
    }
    const handleAfter = await handle.stat({ bigint: true });
    const pathAfter = await lstat(path, { bigint: true });
    if (
      !handleAfter.isFile() ||
      !pathAfter.isFile() ||
      pathAfter.isSymbolicLink() ||
      pathAfter.nlink !== 1n ||
      !sameFileState(handleBefore, handleAfter) ||
      !sameFileState(handleAfter, pathAfter)
    ) {
      fail();
    }
    return { bytes: Uint8Array.from(buffer), state: pathAfter };
  } finally {
    buffer?.fill(0);
    await handle.close();
  }
}

async function consumeOnceFile(
  sourcePath: string,
  expectedState: BigIntStats,
): Promise<void> {
  const targetPath = resolve(dirname(sourcePath), CONSUMED_APPROVAL_FILENAME);
  try {
    await lstat(targetPath, { bigint: true });
    fail();
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }
  const sourceBefore = await lstat(sourcePath, { bigint: true });
  if (
    !sourceBefore.isFile() ||
    sourceBefore.isSymbolicLink() ||
    sourceBefore.nlink !== 1n ||
    !sameFileState(sourceBefore, expectedState)
  ) {
    fail();
  }
  await link(sourcePath, targetPath);
  const sourceLinked = await lstat(sourcePath, { bigint: true });
  const targetLinked = await lstat(targetPath, { bigint: true });
  if (
    !sameMovedFileIdentity(sourceLinked, expectedState, 2n) ||
    !sameMovedFileIdentity(targetLinked, expectedState, 2n)
  ) {
    fail();
  }
  await unlink(sourcePath);
  try {
    await lstat(sourcePath, { bigint: true });
    fail();
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }
  const targetAfter = await lstat(targetPath, { bigint: true });
  if (!sameMovedFileIdentity(targetAfter, expectedState, 1n)) fail();
}

function parseCanonicalRecord<const Keys extends readonly string[]>(
  bytes: Uint8Array,
  keys: Keys,
): Record<Keys[number], unknown> {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const value: unknown = JSON.parse(text);
  if (text !== `${canonicalJson(value)}\n`) fail();
  return exactRecord(value, keys);
}

function exactRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): Record<Keys[number], unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    JSON.stringify(Object.keys(value).sort()) !==
      JSON.stringify([...keys].sort())
  ) {
    fail();
  }
  return value as Record<Keys[number], unknown>;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail();
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    fail();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function sameFileState(left: BigIntStats, right: BigIntStats): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function sameMovedFileIdentity(
  left: BigIntStats,
  right: BigIntStats,
  expectedLinks: bigint,
): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.nlink === expectedLinks &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs
  );
}

function validAbsolutePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 32_767 &&
    isAbsolute(value)
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function equalAscii(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "ascii");
  const rightBytes = Buffer.from(right, "ascii");
  try {
    return (
      leftBytes.length === rightBytes.length &&
      timingSafeEqual(leftBytes, rightBytes)
    );
  } finally {
    leftBytes.fill(0);
    rightBytes.fill(0);
  }
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fail(): never {
  throw new PersonalDossierReleaseError();
}
