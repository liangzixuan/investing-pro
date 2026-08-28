import { createHash } from "node:crypto";
import { constants as fsConstants, type BigIntStats } from "node:fs";
import {
  lstat,
  open,
  opendir,
  realpath,
  type FileHandle,
} from "node:fs/promises";
import { isAbsolute, join, parse, relative, resolve, sep } from "node:path";

import {
  PERSONAL_FILING_CORPUS_LIMITS,
  PERSONAL_FILING_CORPUS_PROFILE,
  PersonalFilingCorpusError,
  verifyPersonalFilingCorpusManifest,
  type PERSONAL_FILING_CORPUS_SCHEMA_VERSION,
  type PersonalFilingCorpusRecord,
} from "./personal-filing-corpus";

export const PERSONAL_FILING_PAYLOAD_IDENTITY_SCHEMA_VERSION = "1.0.0" as const;
export const PERSONAL_FILING_PAYLOAD_PATH_MAPPING =
  "direct_root_accession_payload_v1" as const;
export const PERSONAL_FILING_PAYLOAD_IDENTITY_CLAIM =
  "bounded_streamed_local_payload_presence_length_and_sha256_verified_for_personal_single_user_local_use" as const;

export const PERSONAL_FILING_PAYLOAD_IDENTITY_CHECKS = Object.freeze([
  "owned_manifest_declaration_snapshots_reverified_before_filesystem_access",
  "fixed_direct_root_accession_payload_v1_mapping",
  "bounded_exact_root_inventory_before_and_after_reads",
  "node_visible_root_chain_symlink_and_junction_rejection",
  "canonical_direct_child_containment_and_same_device_requirement",
  "bigint_regular_single_link_path_and_descriptor_identity",
  "one_open_descriptor_and_sequential_64_kib_positional_reads",
  "declared_length_early_eof_and_extra_byte_probe",
  "incremental_sha256_equality_for_every_manifest_entry",
  "observed_pre_open_post_path_descriptor_and_root_stability_checks",
  "whole_set_atomic_verification_or_value_free_rejection",
  "aggregate_only_immutable_payload_identity_record",
] as const);

export const PERSONAL_FILING_PAYLOAD_IDENTITY_NOT_PROVEN = Object.freeze([
  "sec_source_authenticity_attestation_or_complete_filing_provenance",
  "mime_truth_archive_structure_malware_safety_parser_correctness_or_fact_quality",
  "adversarial_namespace_aba_elimination_file_locking_or_transactional_snapshot",
  "every_windows_reparse_cloud_placeholder_filter_driver_or_kernel_nofollow_behavior",
  "absence_of_transient_out_of_root_reads_against_an_active_same_machine_attacker",
  "filesystem_kernel_device_ownership_acl_or_local_storage_attestation",
  "hard_link_history_future_link_creation_or_post_verification_immutability",
  "any_specific_owner_corpus_without_a_successful_operation_invocation",
  "payload_confidentiality_in_memory_swap_storage_backups_or_other_processes",
  "wall_clock_deadline_cancellation_or_availability",
  "retention_enforcement_backup_deletion_or_cryptographic_erasure",
  "multi_user_commercial_redistributed_shared_service_or_production_safety",
  "enterprise_rights_steward_approval_database_api_web_or_b15_v15",
] as const);

export const PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS = Object.freeze({
  chunkBytes: 65_536,
  rootPathCodeUnits: 4_096,
});

export const PERSONAL_FILING_PAYLOAD_IDENTITY_FAILURE_CODES = Object.freeze([
  "PERSONAL_FILING_PAYLOAD_INVALID_INPUT",
  "PERSONAL_FILING_PAYLOAD_DOCUMENT_INVALID",
  "PERSONAL_FILING_PAYLOAD_SCOPE_MISMATCH",
  "PERSONAL_FILING_PAYLOAD_SET_INVALID",
] as const);

export type PersonalFilingPayloadIdentityFailureCode =
  (typeof PERSONAL_FILING_PAYLOAD_IDENTITY_FAILURE_CODES)[number];

export type PersonalFilingPayloadLinkAssurance =
  | "kernel_final_component_nofollow_plus_observed_snapshots"
  | "observed_snapshots_only";

export class PersonalFilingPayloadIdentityError extends Error {
  public constructor(
    public readonly code: PersonalFilingPayloadIdentityFailureCode,
  ) {
    super("Personal filing payload identity verification failed.");
    this.name = "PersonalFilingPayloadIdentityError";
  }
}

class InternalPersonalFilingPayloadIdentityFailure extends Error {
  public constructor(
    public readonly code: PersonalFilingPayloadIdentityFailureCode,
  ) {
    super();
  }
}

export interface PersonalFilingPayloadIdentityInput {
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
  readonly payloadRootPath: string;
}

export interface PersonalFilingPayloadIdentityRecord {
  readonly claim: typeof PERSONAL_FILING_PAYLOAD_IDENTITY_CLAIM;
  readonly corpusId: string;
  readonly corpusVersion: typeof PERSONAL_FILING_CORPUS_SCHEMA_VERSION;
  readonly declarationSha256: `sha256:${string}`;
  readonly filingCount: number;
  readonly frozenAt: string;
  readonly linkAssurance: PersonalFilingPayloadLinkAssurance;
  readonly manifestSha256: `sha256:${string}`;
  readonly pathMapping: typeof PERSONAL_FILING_PAYLOAD_PATH_MAPPING;
  readonly profile: typeof PERSONAL_FILING_CORPUS_PROFILE;
  readonly retentionDays: number;
  readonly schemaVersion: typeof PERSONAL_FILING_PAYLOAD_IDENTITY_SCHEMA_VERSION;
  readonly status: "payload_identity_verified_for_personal_use";
  readonly totalVerifiedBytes: number;
}

interface InputSnapshot {
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
  readonly payloadRootPath: string;
}

interface ManifestPayloadEntry {
  readonly accession: string;
  readonly contentBytes: number;
  readonly contentSha256: `sha256:${string}`;
}

interface FileIdentity {
  readonly ctimeNs: bigint;
  readonly dev: bigint;
  readonly ino: bigint;
  readonly mode: bigint;
  readonly mtimeNs: bigint;
  readonly nlink: bigint;
  readonly size: bigint;
}

interface RootSnapshot {
  readonly canonicalPath: string;
  readonly identity: FileIdentity;
}

const ACCESSION = /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u;
const HASH = /^sha256:[0-9a-f]{64}$/u;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_BUFFER_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
);
const TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
);
const TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
);
const ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
);

export function personalFilingPayloadRelativePath(accession: string): string {
  try {
    if (
      arguments.length !== 1 ||
      typeof accession !== "string" ||
      !ACCESSION.test(accession)
    ) {
      fail("PERSONAL_FILING_PAYLOAD_INVALID_INPUT");
    }
    return `${accession}.payload`;
  } catch {
    throw new PersonalFilingPayloadIdentityError(
      "PERSONAL_FILING_PAYLOAD_INVALID_INPUT",
    );
  }
}

export async function verifyPersonalFilingCorpusPayloadIdentity(
  input: PersonalFilingPayloadIdentityInput,
): Promise<PersonalFilingPayloadIdentityRecord> {
  try {
    if (arguments.length !== 1) fail("PERSONAL_FILING_PAYLOAD_INVALID_INPUT");
    const snapshot = snapshotInput(input);
    const manifestRecord = verifyDocuments(snapshot);
    const entries = parseManifestEntries(snapshot.manifest, manifestRecord);
    const root = await captureRoot(snapshot.payloadRootPath);
    const expectedNames = entries.map((entry) =>
      relativePathForAccession(entry.accession),
    );
    await requireExactRootInventory(root, expectedNames);

    let totalVerifiedBytes = 0;
    for (const entry of entries) {
      await revalidateRoot(root);
      await verifyPayload(root, entry);
      totalVerifiedBytes += entry.contentBytes;
      if (
        totalVerifiedBytes >
        PERSONAL_FILING_CORPUS_LIMITS.totalDeclaredContentBytes
      ) {
        fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
      }
    }

    await revalidateRoot(root);
    await requireExactRootInventory(root, expectedNames);
    await revalidateRoot(root);
    if (totalVerifiedBytes !== manifestRecord.totalDeclaredBytes) {
      fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
    }

    return Object.freeze({
      claim: PERSONAL_FILING_PAYLOAD_IDENTITY_CLAIM,
      corpusId: manifestRecord.corpusId,
      corpusVersion: manifestRecord.corpusVersion,
      declarationSha256: manifestRecord.declarationSha256,
      filingCount: manifestRecord.filingCount,
      frozenAt: manifestRecord.frozenAt,
      linkAssurance: linkAssurance(),
      manifestSha256: manifestRecord.manifestSha256,
      pathMapping: PERSONAL_FILING_PAYLOAD_PATH_MAPPING,
      profile: PERSONAL_FILING_CORPUS_PROFILE,
      retentionDays: manifestRecord.retentionDays,
      schemaVersion: PERSONAL_FILING_PAYLOAD_IDENTITY_SCHEMA_VERSION,
      status: "payload_identity_verified_for_personal_use",
      totalVerifiedBytes,
    });
  } catch (error) {
    throw new PersonalFilingPayloadIdentityError(
      error instanceof InternalPersonalFilingPayloadIdentityFailure
        ? error.code
        : "PERSONAL_FILING_PAYLOAD_INVALID_INPUT",
    );
  }
}

function snapshotInput(value: unknown): InputSnapshot {
  try {
    const descriptors = exactDataDescriptors(value, [
      "declaration",
      "manifest",
      "payloadRootPath",
    ]);
    if (descriptors === undefined) {
      fail("PERSONAL_FILING_PAYLOAD_INVALID_INPUT");
    }
    const declaration = descriptors.declaration?.value as unknown;
    const manifest = descriptors.manifest?.value as unknown;
    const payloadRootPath = descriptors.payloadRootPath?.value as unknown;
    if (
      typeof payloadRootPath !== "string" ||
      payloadRootPath.length < 1 ||
      payloadRootPath.length >
        PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS.rootPathCodeUnits ||
      payloadRootPath.includes("\u0000") ||
      !isAbsolute(payloadRootPath) ||
      /^[\\/]{2}/u.test(payloadRootPath)
    ) {
      fail("PERSONAL_FILING_PAYLOAD_INVALID_INPUT");
    }
    const resolvedRoot = resolve(payloadRootPath);
    if (samePath(resolvedRoot, parse(resolvedRoot).root)) {
      fail("PERSONAL_FILING_PAYLOAD_INVALID_INPUT");
    }
    return Object.freeze({
      declaration: byteSnapshot(
        declaration,
        PERSONAL_FILING_CORPUS_LIMITS.declarationBytes,
      ),
      manifest: byteSnapshot(
        manifest,
        PERSONAL_FILING_CORPUS_LIMITS.manifestBytes,
      ),
      payloadRootPath: resolvedRoot,
    });
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadIdentityFailure) {
      throw error;
    }
    fail("PERSONAL_FILING_PAYLOAD_INVALID_INPUT");
  }
}

function byteSnapshot(value: unknown, maximumBytes: number): Uint8Array {
  try {
    if (typeof value !== "object" || value === null) {
      fail("PERSONAL_FILING_PAYLOAD_INVALID_INPUT");
    }
    const bytes = value as Uint8Array;
    const tag = TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR?.get?.call(bytes) as unknown;
    const byteLength = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const backingByteLength = ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      buffer,
    ) as unknown;
    if (
      tag !== "Uint8Array" ||
      typeof byteLength !== "number" ||
      typeof backingByteLength !== "number" ||
      byteLength > maximumBytes ||
      Object.getPrototypeOf(bytes) !== Uint8Array.prototype ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    ) {
      fail("PERSONAL_FILING_PAYLOAD_INVALID_INPUT");
    }
    const snapshot = new Uint8Array(byteLength);
    Uint8Array.prototype.set.call(snapshot, bytes);
    return snapshot;
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadIdentityFailure) {
      throw error;
    }
    fail("PERSONAL_FILING_PAYLOAD_INVALID_INPUT");
  }
}

function verifyDocuments(snapshot: InputSnapshot): PersonalFilingCorpusRecord {
  try {
    return verifyPersonalFilingCorpusManifest({
      declaration: snapshot.declaration,
      manifest: snapshot.manifest,
    });
  } catch (error) {
    if (
      error instanceof PersonalFilingCorpusError &&
      error.code === "PERSONAL_FILING_CORPUS_SCOPE_MISMATCH"
    ) {
      fail("PERSONAL_FILING_PAYLOAD_SCOPE_MISMATCH");
    }
    fail("PERSONAL_FILING_PAYLOAD_DOCUMENT_INVALID");
  }
}

function parseManifestEntries(
  manifestBytes: Uint8Array,
  manifestRecord: PersonalFilingCorpusRecord,
): readonly ManifestPayloadEntry[] {
  try {
    const decoded = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(manifestBytes);
    const document = JSON.parse(decoded) as unknown;
    if (!isPlainRecord(document) || !Array.isArray(document.entries)) {
      fail("PERSONAL_FILING_PAYLOAD_DOCUMENT_INVALID");
    }
    const entries = document.entries.map((value) => {
      if (!isPlainRecord(value)) {
        fail("PERSONAL_FILING_PAYLOAD_DOCUMENT_INVALID");
      }
      if (
        typeof value.accession !== "string" ||
        !ACCESSION.test(value.accession) ||
        !Number.isInteger(value.contentBytes) ||
        (value.contentBytes as number) < 1 ||
        (value.contentBytes as number) >
          PERSONAL_FILING_CORPUS_LIMITS.entryContentBytes ||
        typeof value.contentSha256 !== "string" ||
        !HASH.test(value.contentSha256)
      ) {
        fail("PERSONAL_FILING_PAYLOAD_DOCUMENT_INVALID");
      }
      return Object.freeze({
        accession: value.accession,
        contentBytes: value.contentBytes as number,
        contentSha256: value.contentSha256 as `sha256:${string}`,
      });
    });
    const totalDeclaredBytes = entries.reduce(
      (total, entry) => total + entry.contentBytes,
      0,
    );
    if (
      entries.length !== manifestRecord.filingCount ||
      totalDeclaredBytes !== manifestRecord.totalDeclaredBytes
    ) {
      fail("PERSONAL_FILING_PAYLOAD_DOCUMENT_INVALID");
    }
    return Object.freeze(entries);
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadIdentityFailure) {
      throw error;
    }
    fail("PERSONAL_FILING_PAYLOAD_DOCUMENT_INVALID");
  }
}

async function captureRoot(path: string): Promise<RootSnapshot> {
  try {
    const before = await requireLexicalDirectoryChain(path);
    const canonicalPath = resolve(await realpath(path));
    const after = await requireLexicalDirectoryChain(path);
    const canonical = await requireLexicalDirectoryChain(canonicalPath);
    if (
      !samePath(path, canonicalPath) ||
      !sameFileIdentity(before, after) ||
      !sameFileIdentity(before, canonical)
    ) {
      fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
    }
    return Object.freeze({
      canonicalPath,
      identity: fileIdentity(canonical),
    });
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadIdentityFailure) {
      throw error;
    }
    fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
  }
}

async function revalidateRoot(root: RootSnapshot): Promise<void> {
  try {
    const current = await requireLexicalDirectoryChain(root.canonicalPath);
    const canonicalPath = resolve(await realpath(root.canonicalPath));
    if (
      !samePath(canonicalPath, root.canonicalPath) ||
      !sameIdentity(fileIdentity(current), root.identity)
    ) {
      fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
    }
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadIdentityFailure) {
      throw error;
    }
    fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
  }
}

async function requireLexicalDirectoryChain(
  path: string,
): Promise<BigIntStats> {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  let current = root;
  let metadata = await lstat(current, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.ino <= 0n
  ) {
    fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
  }
  const remainder = relative(root, absolute);
  for (const component of remainder === "" ? [] : remainder.split(sep)) {
    current = join(current, component);
    metadata = await lstat(current, { bigint: true });
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      metadata.ino <= 0n
    ) {
      fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
    }
  }
  return metadata;
}

async function requireExactRootInventory(
  root: RootSnapshot,
  expectedNames: readonly string[],
): Promise<void> {
  try {
    const directory = await opendir(root.canonicalPath);
    const actualNames: string[] = [];
    try {
      while (true) {
        const entry = await directory.read();
        if (entry === null) break;
        actualNames.push(entry.name);
        if (actualNames.length > PERSONAL_FILING_CORPUS_LIMITS.entries) {
          fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
        }
      }
    } finally {
      await directory.close();
    }
    actualNames.sort();
    if (
      actualNames.length !== expectedNames.length ||
      actualNames.some((name, index) => name !== expectedNames[index])
    ) {
      fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
    }
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadIdentityFailure) {
      throw error;
    }
    fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
  }
}

async function verifyPayload(
  root: RootSnapshot,
  entry: ManifestPayloadEntry,
): Promise<void> {
  try {
    const candidate = join(
      root.canonicalPath,
      relativePathForAccession(entry.accession),
    );
    requireDirectChild(root.canonicalPath, candidate);
    const before = await lstat(candidate, { bigint: true });
    requireExpectedFile(before, root, entry.contentBytes);
    const canonicalBefore = resolve(await realpath(candidate));
    if (!samePath(candidate, canonicalBefore)) {
      fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
    }

    const handle = await open(candidate, readOnlyNoFollowFlags());
    try {
      const opened = await handle.stat({ bigint: true });
      requireExpectedFile(opened, root, entry.contentBytes);
      if (!sameIdentity(fileIdentity(before), fileIdentity(opened))) {
        fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
      }
      const actualSha256 = await readPayloadSha256(handle, entry.contentBytes);
      const afterDescriptor = await handle.stat({ bigint: true });
      requireExpectedFile(afterDescriptor, root, entry.contentBytes);
      if (!sameIdentity(fileIdentity(opened), fileIdentity(afterDescriptor))) {
        fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
      }
      const afterPath = await lstat(candidate, { bigint: true });
      requireExpectedFile(afterPath, root, entry.contentBytes);
      const canonicalAfter = resolve(await realpath(candidate));
      const finalPath = await lstat(candidate, { bigint: true });
      requireExpectedFile(finalPath, root, entry.contentBytes);
      if (
        !samePath(canonicalAfter, canonicalBefore) ||
        !sameIdentity(fileIdentity(afterDescriptor), fileIdentity(afterPath)) ||
        !sameIdentity(fileIdentity(afterPath), fileIdentity(finalPath)) ||
        actualSha256 !== entry.contentSha256
      ) {
        fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
      }
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error instanceof InternalPersonalFilingPayloadIdentityFailure) {
      throw error;
    }
    fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
  }
}

async function readPayloadSha256(
  handle: FileHandle,
  expectedBytes: number,
): Promise<`sha256:${string}`> {
  const buffer = new Uint8Array(
    PERSONAL_FILING_PAYLOAD_IDENTITY_LIMITS.chunkBytes,
  );
  try {
    const hash = createHash("sha256");
    let offset = 0;
    while (offset < expectedBytes) {
      const requested = Math.min(buffer.byteLength, expectedBytes - offset);
      const { bytesRead } = await handle.read(buffer, 0, requested, offset);
      if (
        !Number.isSafeInteger(bytesRead) ||
        bytesRead < 1 ||
        bytesRead > requested
      ) {
        fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
      }
      hash.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }
    const { bytesRead: extraBytes } = await handle.read(buffer, 0, 1, offset);
    if (!Number.isSafeInteger(extraBytes) || extraBytes !== 0) {
      fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
    }
    return `sha256:${hash.digest("hex")}`;
  } finally {
    buffer.fill(0);
  }
}

function requireExpectedFile(
  metadata: BigIntStats,
  root: RootSnapshot,
  expectedBytes: number,
): void {
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.ino <= 0n ||
    metadata.nlink !== 1n ||
    metadata.dev !== root.identity.dev ||
    metadata.size !== BigInt(expectedBytes)
  ) {
    fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
  }
}

function requireDirectChild(root: string, candidate: string): void {
  const pathFromRoot = relative(resolve(root), resolve(candidate));
  if (
    pathFromRoot === "" ||
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot) ||
    pathFromRoot.includes(sep)
  ) {
    fail("PERSONAL_FILING_PAYLOAD_SET_INVALID");
  }
}

function fileIdentity(metadata: BigIntStats): FileIdentity {
  return Object.freeze({
    ctimeNs: metadata.ctimeNs,
    dev: metadata.dev,
    ino: metadata.ino,
    mode: metadata.mode,
    mtimeNs: metadata.mtimeNs,
    nlink: metadata.nlink,
    size: metadata.size,
  });
}

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return isPersonalFilingPayloadFileIdentityStable(left, right);
}

/** @internal Bigint regression seam for observed filesystem identity checks. */
export function isPersonalFilingPayloadFileIdentityStable(
  left: Readonly<FileIdentity>,
  right: Readonly<FileIdentity>,
): boolean {
  return (
    left.ctimeNs === right.ctimeNs &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.nlink === right.nlink &&
    left.size === right.size
  );
}

function sameFileIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function samePath(left: string, right: string): boolean {
  const resolvedLeft = resolve(left);
  const resolvedRight = resolve(right);
  return process.platform === "win32"
    ? resolvedLeft.toLowerCase() === resolvedRight.toLowerCase()
    : resolvedLeft === resolvedRight;
}

function relativePathForAccession(accession: string): string {
  if (!ACCESSION.test(accession)) {
    fail("PERSONAL_FILING_PAYLOAD_DOCUMENT_INVALID");
  }
  return `${accession}.payload`;
}

function readOnlyNoFollowFlags(): number {
  let flags = fsConstants.O_RDONLY;
  if (
    process.platform !== "win32" &&
    typeof fsConstants.O_NOFOLLOW === "number"
  ) {
    flags |= fsConstants.O_NOFOLLOW;
  }
  if (
    process.platform !== "win32" &&
    typeof fsConstants.O_NONBLOCK === "number"
  ) {
    flags |= fsConstants.O_NONBLOCK;
  }
  return flags;
}

function linkAssurance(): PersonalFilingPayloadLinkAssurance {
  return process.platform !== "win32" &&
    typeof fsConstants.O_NOFOLLOW === "number"
    ? "kernel_final_component_nofollow_plus_observed_snapshots"
    : "observed_snapshots_only";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataDescriptors(
  value: unknown,
  keys: readonly string[],
): PropertyDescriptorMap | undefined {
  if (!isPlainRecord(value)) return undefined;
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return undefined;
  }
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.some((key) => typeof key !== "string") ||
    !exactKeys(ownKeys as string[], keys) ||
    !exactKeys(Object.keys(descriptors), keys)
  ) {
    return undefined;
  }
  const hasOnlyEnumerableDataProperties = keys.every((key) => {
    const descriptor = descriptors[key];
    return (
      descriptor !== undefined &&
      "value" in descriptor &&
      descriptor.enumerable === true
    );
  });
  return hasOnlyEnumerableDataProperties ? descriptors : undefined;
}

function exactKeys(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  if (actual.length !== expected.length) return false;
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedExpected.every((key, index) => sortedActual[index] === key);
}

function fail(code: PersonalFilingPayloadIdentityFailureCode): never {
  throw new InternalPersonalFilingPayloadIdentityFailure(code);
}
