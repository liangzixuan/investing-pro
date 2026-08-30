import { createHash, timingSafeEqual } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import { link, lstat, open, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve } from "node:path";

import type { PersonalFilingSelectedFactsDto } from "@research-cockpit/contracts";
import {
  preparePersonalFilingSelectedFactRelease,
  type PersonalFilingSelectedFact,
} from "@research-cockpit/personal-filing-corpus";

import { loadValidatedPersonalQualityAdmission } from "./personal-quality-readiness";

const BUNDLE_PATH_KEY =
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH" as const;
const BUNDLE_SHA256_KEY =
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256" as const;
const APPROVAL_PATH_KEY =
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH" as const;
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
const ERROR_MESSAGE = "Personal selected-fact release is unavailable.";
const SCHEMA_VERSION = "1.0.0" as const;
const PROFILE = "personal_single_user_local" as const;
const BUNDLE_ROLE = "personal_selected_fact_release_bundle" as const;
const APPROVAL_ACTION =
  "APPROVE_EXACT_CYCLE2Z_PERSONAL_SELECTED_FACT_RELEASE" as const;

declare const selectedFactReleaseCapabilityBrand: unique symbol;

export type PersonalSelectedFactReleaseCapability = Readonly<{
  [selectedFactReleaseCapabilityBrand]: true;
}>;

export type PersonalSelectedFactReleaseEnvironment = Readonly<
  Record<string, string | undefined>
>;

interface StableFileSnapshot {
  readonly bytes: Uint8Array;
  readonly state: BigIntStats;
}

const selectedFactReleaseCapabilities = new WeakMap<
  object,
  PersonalFilingSelectedFactsDto
>();

export class PersonalSelectedFactReleaseError extends Error {
  public constructor() {
    super(ERROR_MESSAGE);
    Object.defineProperty(this, "name", {
      configurable: true,
      value: "PersonalSelectedFactReleaseError",
    });
  }
}

export async function loadPersonalSelectedFactRelease(
  environment: PersonalSelectedFactReleaseEnvironment,
  runtimeSourceCommit?: string,
): Promise<PersonalSelectedFactReleaseCapability | undefined> {
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
      basename(bundlePath) !==
        "cycle2z-personal-selected-fact-release.bundle.json" ||
      typeof expectedBundleSha256 !== "string" ||
      !HASH.test(expectedBundleSha256) ||
      !validAbsolutePath(approvalPath) ||
      basename(approvalPath) !==
        "cycle2z-personal-selected-fact-release-approval.once.json" ||
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
      "manifest",
      "normalizationPlan",
      "profile",
      "qualityPlan",
      "rawFilingDocuments",
      "releasePlan",
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
    const rawFilingDocuments = decodeBase64Array(
      bundle.rawFilingDocuments,
      MAX_RAW_DOCUMENT_BYTES,
      decoded,
    );
    const sourceDocuments = decodeBase64Array(
      bundle.sourceDocuments,
      MAX_SOURCE_DOCUMENT_BYTES,
      decoded,
    );
    if (rawFilingDocuments.length !== sourceDocuments.length) fail();
    const releasePlan = validateReleasePlan(bundle.releasePlan);

    const prepared = preparePersonalFilingSelectedFactRelease({
      declaration,
      manifest,
      normalizationPlan,
      qualityPlan,
      rawFilingDocuments,
      sourceDocuments,
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
      releasePlan,
    });
    if (
      prepared.schemaVersion !== SCHEMA_VERSION ||
      prepared.profile !== PROFILE ||
      prepared.role !== "personal_selected_fact_release" ||
      prepared.status !== "prepared_selected_facts_for_personal_use" ||
      !Array.isArray(prepared.facts) ||
      prepared.facts.length === 0
    ) {
      fail();
    }
    const preparedFacts: readonly PersonalFilingSelectedFact[] = prepared.facts;
    const response = freezeResponse({
      schemaVersion: SCHEMA_VERSION,
      profile: PROFILE,
      status: "selected_facts_released",
      facts: preparedFacts.map((fact) => ({
        key: fact.key,
        value: fact.value,
        unit: fact.unit,
        periodStart: fact.periodStart,
        periodEnd: fact.periodEnd,
      })),
    });
    const releaseResponseSha256 = sha256(
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
      "profile",
      "qualityResultSha256",
      "releaseBundleSha256",
      "releaseResponseSha256",
      "schemaVersion",
      "sourceCommit",
    ]);
    if (
      approval.schemaVersion !== SCHEMA_VERSION ||
      approval.action !== APPROVAL_ACTION ||
      approval.profile !== PROFILE ||
      approval.sourceCommit !== bundle.sourceCommit ||
      approval.qualityResultSha256 !== qualityResultSha256 ||
      approval.releaseBundleSha256 !== expectedBundleSha256 ||
      approval.releaseResponseSha256 !== releaseResponseSha256 ||
      typeof approval.authorizationToken !== "string" ||
      !TOKEN.test(approval.authorizationToken)
    ) {
      fail();
    }
    tokenBytes = new TextEncoder().encode(approval.authorizationToken);
    await consumeOnceFile(approvalPath, approvalSnapshot.state);

    const capability = Object.freeze(
      {},
    ) as PersonalSelectedFactReleaseCapability;
    selectedFactReleaseCapabilities.set(capability, response);
    return capability;
  } catch {
    throw new PersonalSelectedFactReleaseError();
  } finally {
    bundleBytes?.fill(0);
    approvalBytes?.fill(0);
    tokenBytes?.fill(0);
    for (const bytes of decoded) bytes.fill(0);
  }
}

export function isPersonalSelectedFactReleaseCapability(
  value: unknown,
): value is PersonalSelectedFactReleaseCapability {
  if (typeof value !== "object" || value === null) return false;
  try {
    return Object.isFrozen(value) && selectedFactReleaseCapabilities.has(value);
  } catch {
    return false;
  }
}

export function getPersonalSelectedFactReleaseResponse(
  capability: PersonalSelectedFactReleaseCapability,
): PersonalFilingSelectedFactsDto {
  const state = selectedFactReleaseCapabilities.get(capability);
  if (state === undefined) fail();
  return state;
}

function validateReleasePlan(value: unknown) {
  const plan = exactRecord(value, [
    "documentIndex",
    "factKeys",
    "profile",
    "role",
    "schemaVersion",
    "selectionRule",
  ]);
  const factKeys = [
    "assets",
    "cash",
    "debt",
    "diluted_shares",
    "free_cash_flow",
    "gross_profit",
    "net_income",
    "operating_cash_flow",
    "operating_income",
    "revenue",
  ] as const;
  if (
    plan.schemaVersion !== SCHEMA_VERSION ||
    plan.profile !== PROFILE ||
    plan.role !== "personal_selected_fact_release_plan" ||
    plan.selectionRule !== "exact_candidate_document_index_and_fact_key.v1" ||
    !Number.isSafeInteger(plan.documentIndex) ||
    (plan.documentIndex as number) < 0 ||
    !Array.isArray(plan.factKeys) ||
    plan.factKeys.length === 0 ||
    plan.factKeys.length > factKeys.length
  ) {
    fail();
  }
  let previous = -1;
  for (const key of plan.factKeys) {
    const index = factKeys.indexOf(key as (typeof factKeys)[number]);
    if (index <= previous) fail();
    previous = index;
  }
  return plan as {
    readonly schemaVersion: "1.0.0";
    readonly profile: "personal_single_user_local";
    readonly role: "personal_selected_fact_release_plan";
    readonly selectionRule: "exact_candidate_document_index_and_fact_key.v1";
    readonly documentIndex: number;
    readonly factKeys: (typeof factKeys)[number][];
  };
}

function decodeBase64Array(
  value: unknown,
  maxBytes: number,
  decoded: Uint8Array[],
): Uint8Array[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > MAX_DOCUMENTS
  ) {
    fail();
  }
  return value.map((entry) => decodeBase64(entry, maxBytes, decoded));
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

function freezeResponse(
  value: PersonalFilingSelectedFactsDto,
): PersonalFilingSelectedFactsDto {
  for (const fact of value.facts) Object.freeze(fact);
  Object.freeze(value.facts);
  return Object.freeze(value);
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
  ) {
    fail();
  }
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
  const targetPath = resolve(
    dirname(sourcePath),
    "cycle2z-personal-selected-fact-release-approval.consumed.json",
  );
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
    !sourceLinked.isFile() ||
    sourceLinked.isSymbolicLink() ||
    !targetLinked.isFile() ||
    targetLinked.isSymbolicLink() ||
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
  if (
    !targetAfter.isFile() ||
    targetAfter.isSymbolicLink() ||
    !sameMovedFileIdentity(targetAfter, expectedState, 1n)
  ) {
    fail();
  }
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
  ) {
    fail();
  }
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
  throw new PersonalSelectedFactReleaseError();
}
