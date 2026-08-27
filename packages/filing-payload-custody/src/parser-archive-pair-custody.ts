import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { BigIntStats } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { types as utilTypes } from "node:util";

export const FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION =
  "1.0.0" as const;
export const FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM =
  "bounded_synthetic_exact_parser_archive_pair_encrypted_custody_and_authenticated_readback" as const;

export const FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM = Object.freeze({
  aadDomain:
    "research-cockpit:synthetic-filing-parser-archive-pair-custody:aes-256-gcm:v1\u0000",
  keyBytes: 32,
  name: "aes-256-gcm" as const,
  nonceBytes: 12,
  tagBytes: 16,
});

export const FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES = Object.freeze({
  amendment: Object.freeze({
    byteLength: 2_330,
    contentSha256:
      "sha256:df7f1ff416b60168b09902bd7714fa47bf0453ef9732c8c5b476988bb70f47a8" as const,
    role: "amendment" as const,
  }),
  original: Object.freeze({
    byteLength: 2_306,
    contentSha256:
      "sha256:f331ff51540c11aca55a5d1d81d2c1daeaf4354acdea45530faed5275a5322ba" as const,
    role: "original" as const,
  }),
});

export const FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CHECKS = Object.freeze([
  "exact_frozen_original_and_amendment_archive_role_byte_length_and_content_identity",
  "role_source_bindings_are_internally_derived_from_common_context_role_and_both_archive_digests",
  "intrinsic_owned_input_snapshots_before_first_await",
  "one_shot_reservation_before_validation_or_io",
  "separate_fresh_aes_256_gcm_keys_and_nonces_per_archive_role",
  "closed_domain_separated_aad_binds_claim_schema_role_content_and_source",
  "separate_ciphertext_and_canonical_audit_files",
  "pair_publication_only_after_both_records_are_complete_and_key_nonce_uniqueness_is_verified",
  "exact_pair_role_and_file_enumeration_bounded_regular_file_and_closed_audit_readback",
  "authenticated_decrypt_and_exact_content_digest_recomputation",
  "exact_two_role_receipts_and_pair_binding",
  "no_caller_supplied_digest_receipt_key_nonce_path_clock_or_entropy",
  "automatic_key_forget_plaintext_wipe_and_device_inode_bound_owned_workspace_cleanup",
  "concurrency_replay_tamper_key_loss_and_partial_io_fail_closed",
  "single_deeply_frozen_value_free_quarantine",
  "cycle2c_v1_contract_and_evidence_immutability",
] as const);

export const FILING_PARSER_ARCHIVE_PAIR_CUSTODY_NOT_PROVEN = Object.freeze([
  "real_public_filing_sec_source_authenticity_or_attestation",
  "cycle2b_inventory_rights_steward_authority_or_human_review",
  "external_fetch_dns_tls_ssrf_rate_limit_or_malware_safety",
  "production_kms_hsm_key_identity_rotation_or_nonrepudiation",
  "host_os_filesystem_temp_directory_disk_or_entropy_attestation",
  "physical_or_cryptographic_erasure_disk_remanence_or_swap_absence",
  "durable_twenty_four_hour_retention_expiry_resurrection_or_backup_deletion",
  "process_crash_power_loss_or_cross_process_recovery",
  "parser_execution_normalization_agreement_or_quality",
  "docker_worker_image_or_runtime_authenticity",
  "general_archive_zip_xml_xbrl_ixbrl_or_taxonomy_safety",
  "multi_document_batch_scheduler_retry_load_or_slo",
  "database_api_web_queue_or_b15_v15_composition",
  "representative_corpus_or_independently_adjudicated_assertions",
  "real_data_admission_full_cycle2_exit_or_production_use",
  "javascript_memory_wipe_guarantee_or_gc_copy_absence",
] as const);

type Sha256 = `sha256:${string}`;
type ArchiveRole = "amendment" | "original";

export interface FilingParserArchivePairCustodyReceipt {
  readonly aadSha256: Sha256;
  readonly byteLength: number;
  readonly ciphertextSha256: Sha256;
  readonly contentSha256: Sha256;
  readonly readbackSha256: Sha256;
  readonly receiptSha256: Sha256;
  readonly role: ArchiveRole;
  readonly sourceBindingSha256: Sha256;
}

export interface FilingParserArchivePairCustodyReadbackResult {
  readonly amendmentArchive: Uint8Array;
  readonly audit: Readonly<{
    cleanupCount: 1;
    readbackCount: 2;
    stagedArchiveCount: 2;
    zeroResidue: true;
  }>;
  readonly claim: typeof FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM;
  readonly custodyPairBindingSha256: Sha256;
  readonly originalArchive: Uint8Array;
  readonly receipts: readonly [
    FilingParserArchivePairCustodyReceipt,
    FilingParserArchivePairCustodyReceipt,
  ];
  readonly schemaVersion: typeof FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION;
  readonly status: "readback";
  readonly synthetic: true;
}

export interface FilingParserArchivePairCustodyQuarantinedResult {
  readonly claim: typeof FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM;
  readonly code: "parser_archive_pair_custody_quarantined";
  readonly schemaVersion: typeof FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION;
  readonly status: "quarantined";
  readonly synthetic: true;
}

export type FilingParserArchivePairCustodyResult =
  | FilingParserArchivePairCustodyQuarantinedResult
  | FilingParserArchivePairCustodyReadbackResult;

export interface FilingParserArchivePairCustodyProtocol {
  readonly custodyAndRead: (
    sourceContextSha256: unknown,
    originalArchive: unknown,
    amendmentArchive: unknown,
  ) => Promise<FilingParserArchivePairCustodyResult>;
}

export const FILING_PARSER_ARCHIVE_PAIR_CUSTODY_PHASES = Object.freeze([
  "workspace_created",
  "original_encrypted",
  "amendment_encrypted",
  "before_publish",
  "pair_published",
  "before_original_readback",
  "before_amendment_readback",
  "readback_complete",
  "before_cleanup",
] as const);

export type FilingParserArchivePairCustodyPhase =
  (typeof FILING_PARSER_ARCHIVE_PAIR_CUSTODY_PHASES)[number];

interface TestRuntime {
  readonly afterPhase?: (
    phase: FilingParserArchivePairCustodyPhase,
    workspaceDirectory: string,
  ) => Promise<void> | void;
  readonly entropy?: (length: number) => Uint8Array;
  readonly workspaceParentDirectory?: string;
}

interface Runtime {
  readonly afterPhase: (
    phase: FilingParserArchivePairCustodyPhase,
    workspaceDirectory: string,
  ) => Promise<void>;
  readonly entropy: (length: number) => Uint8Array;
  readonly workspaceParentDirectory: string;
}

interface PersistedAudit {
  readonly aadSha256: Sha256;
  readonly algorithm: typeof FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM.name;
  readonly authTag: string;
  readonly byteLength: number;
  readonly claim: typeof FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM;
  readonly ciphertextSha256: Sha256;
  readonly contentSha256: Sha256;
  readonly nonce: string;
  readonly role: ArchiveRole;
  readonly schemaVersion: typeof FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION;
  readonly sourceBindingSha256: Sha256;
}

interface WorkspaceIdentity {
  readonly canonicalPath: string;
  readonly dev: bigint;
  readonly ino: bigint;
  readonly parentDirectory: string;
}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder("utf-8", { fatal: true });
const WORKSPACE_PREFIX = "research-cockpit-parser-pair-custody-";
const STAGING_DIRECTORY = ".pair-staging";
const RECORD_DIRECTORY = "pair";
const AUDIT_FILE = "audit.json";
const CIPHERTEXT_FILE = "ciphertext.bin";
const MAXIMUM_WORKSPACE_SCAN_ENTRIES = 128;
const RECEIPT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-archive-custody-receipt:v1\u0000",
);
const ROLE_SOURCE_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-archive-custody-role-source:v1\u0000",
);
const PAIR_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-archive-custody-pair:v1\u0000",
);
const QUARANTINED: FilingParserArchivePairCustodyQuarantinedResult = deepFreeze(
  {
    claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
    code: "parser_archive_pair_custody_quarantined" as const,
    schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: true as const,
  },
);

export function createFilingParserArchivePairCustodyProtocol(): FilingParserArchivePairCustodyProtocol {
  return createProtocol(normalizeRuntime({}));
}

/** @internal Test-only runtime seam; intentionally absent from package exports. */
export function createFilingParserArchivePairCustodyProtocolForTest(
  runtime: TestRuntime,
): FilingParserArchivePairCustodyProtocol {
  return createProtocol(normalizeRuntime(runtime));
}

/** @internal Deterministic regression seam for exact 64-bit file identity. */
export function exactFileIdentityMatchesForTest(
  leftDevice: bigint,
  leftInode: bigint,
  rightDevice: bigint,
  rightInode: bigint,
): boolean {
  return sameExactFileIdentity(
    { dev: leftDevice, ino: leftInode },
    { dev: rightDevice, ino: rightInode },
  );
}

function createProtocol(
  runtime: Runtime,
): FilingParserArchivePairCustodyProtocol {
  let state: "consumed" | "open" | "running" = "open";

  const custodyAndRead = async function (
    sourceContextValue: unknown,
    originalValue: unknown,
    amendmentValue: unknown,
  ): Promise<FilingParserArchivePairCustodyResult> {
    if (state === "running") {
      state = "consumed";
      return QUARANTINED;
    }
    if (state !== "open") return QUARANTINED;
    state = "running";

    let workspaceDirectory: string | undefined;
    let workspaceIdentity: WorkspaceIdentity | undefined;
    let originalSnapshot: Uint8Array | undefined;
    let amendmentSnapshot: Uint8Array | undefined;
    let originalReadback: Uint8Array | undefined;
    let amendmentReadback: Uint8Array | undefined;
    const keys = new Map<ArchiveRole, Uint8Array>();
    const nonces = new Map<ArchiveRole, Uint8Array>();
    let receipts:
      | readonly [
          FilingParserArchivePairCustodyReceipt,
          FilingParserArchivePairCustodyReceipt,
        ]
      | undefined;
    let pairBinding: Sha256 | undefined;
    let operationSucceeded: boolean;
    let cleanupSucceeded = false;

    try {
      if (arguments.length !== 3 || !isSha256(sourceContextValue)) fail();
      const sourceContextSha256 = sourceContextValue;
      originalSnapshot = snapshotExactArchive(originalValue, "original");
      amendmentSnapshot = snapshotExactArchive(amendmentValue, "amendment");
      if (equalBytes(originalSnapshot, amendmentSnapshot)) fail();

      const parentDirectory = await canonicalDirectory(
        runtime.workspaceParentDirectory,
      );
      workspaceDirectory = await mkdtemp(
        join(parentDirectory, WORKSPACE_PREFIX),
      );
      workspaceIdentity = await captureWorkspaceIdentity(
        parentDirectory,
        workspaceDirectory,
      );
      await chmod(workspaceDirectory, 0o700);
      requireContained(parentDirectory, workspaceDirectory);
      await phase(runtime, "workspace_created", workspaceDirectory);
      if (state !== "running") fail();

      const stagingDirectory = join(workspaceDirectory, STAGING_DIRECTORY);
      await mkdir(stagingDirectory, { mode: 0o700 });
      const originalAudit = await encryptArchive(
        runtime,
        workspaceDirectory,
        stagingDirectory,
        "original",
        roleSourceBinding(sourceContextSha256, "original"),
        originalSnapshot,
        keys,
        nonces,
      );
      if (state !== "running") fail();
      const amendmentAudit = await encryptArchive(
        runtime,
        workspaceDirectory,
        stagingDirectory,
        "amendment",
        roleSourceBinding(sourceContextSha256, "amendment"),
        amendmentSnapshot,
        keys,
        nonces,
      );
      if (state !== "running") fail();
      await phase(runtime, "before_publish", workspaceDirectory);
      if (state !== "running") fail();
      await rename(
        stagingDirectory,
        join(workspaceDirectory, RECORD_DIRECTORY),
      );
      await phase(runtime, "pair_published", workspaceDirectory);
      if (state !== "running") fail();
      await validateExactPairWorkspace(workspaceDirectory);

      await phase(runtime, "before_original_readback", workspaceDirectory);
      await validateExactPairWorkspace(workspaceDirectory);
      originalReadback = await readArchive(
        workspaceDirectory,
        originalAudit,
        keys,
      );
      if (state !== "running") fail();
      await phase(runtime, "before_amendment_readback", workspaceDirectory);
      await validateExactPairWorkspace(workspaceDirectory);
      amendmentReadback = await readArchive(
        workspaceDirectory,
        amendmentAudit,
        keys,
      );
      if (state !== "running") fail();
      await phase(runtime, "readback_complete", workspaceDirectory);
      await validateExactPairWorkspace(workspaceDirectory);
      if (
        state !== "running" ||
        !equalBytes(originalSnapshot, originalReadback) ||
        !equalBytes(amendmentSnapshot, amendmentReadback)
      )
        fail();

      receipts = Object.freeze([
        publicReceipt(originalAudit, originalReadback),
        publicReceipt(amendmentAudit, amendmentReadback),
      ] as const);
      pairBinding = domainSha256(PAIR_DOMAIN, {
        claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
        receipts,
        schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
        sourceContextSha256,
      });
      operationSucceeded = true;
    } catch {
      operationSucceeded = false;
    } finally {
      wipe(originalSnapshot);
      wipe(amendmentSnapshot);
      for (const key of keys.values()) wipe(key);
      keys.clear();
      for (const nonce of nonces.values()) wipe(nonce);
      nonces.clear();
      if (workspaceIdentity !== undefined)
        cleanupSucceeded = await cleanupWorkspace(runtime, workspaceIdentity);
      state = "consumed";
    }

    if (
      !operationSucceeded ||
      !cleanupSucceeded ||
      originalReadback === undefined ||
      amendmentReadback === undefined ||
      receipts === undefined ||
      pairBinding === undefined
    ) {
      wipe(originalReadback);
      wipe(amendmentReadback);
      return QUARANTINED;
    }

    return Object.freeze({
      amendmentArchive: amendmentReadback,
      audit: deepFreeze({
        cleanupCount: 1 as const,
        readbackCount: 2 as const,
        stagedArchiveCount: 2 as const,
        zeroResidue: true as const,
      }),
      claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
      custodyPairBindingSha256: pairBinding,
      originalArchive: originalReadback,
      receipts,
      schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
      status: "readback" as const,
      synthetic: true as const,
    });
  };

  return Object.freeze({ custodyAndRead });
}

function roleSourceBinding(
  sourceContextSha256: Sha256,
  role: ArchiveRole,
): Sha256 {
  return domainSha256(ROLE_SOURCE_DOMAIN, {
    amendmentArchiveSha256:
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES.amendment.contentSha256,
    claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
    originalArchiveSha256:
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES.original.contentSha256,
    role,
    schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
    sourceContextSha256,
  });
}

async function cleanupWorkspace(
  runtime: Runtime,
  identity: WorkspaceIdentity,
): Promise<boolean> {
  let phaseSucceeded = true;
  try {
    await phase(runtime, "before_cleanup", identity.canonicalPath);
  } catch {
    phaseSucceeded = false;
  }
  try {
    const parentDirectory = await canonicalDirectory(
      runtime.workspaceParentDirectory,
    );
    if (parentDirectory !== identity.parentDirectory) return false;
    const matches = await findWorkspaceIdentity(identity);
    if (matches.length !== 1) return false;
    const actualPath = matches[0];
    if (actualPath === undefined) return false;
    const identityWasStable = actualPath === identity.canonicalPath;
    await requireWorkspaceIdentity(actualPath, identity);
    try {
      await rm(actualPath, { force: true, recursive: true });
    } catch {
      await requireWorkspaceIdentity(actualPath, identity);
      await chmod(actualPath, 0o700).catch(() => undefined);
      await requireWorkspaceIdentity(actualPath, identity);
      await rm(actualPath, { force: true, recursive: true });
    }
    const remainingMatches = await findWorkspaceIdentity(identity);
    return phaseSucceeded && identityWasStable && remainingMatches.length === 0;
  } catch {
    return false;
  }
}

async function captureWorkspaceIdentity(
  parentDirectory: string,
  workspaceDirectory: string,
): Promise<WorkspaceIdentity> {
  requireContained(parentDirectory, workspaceDirectory);
  const before = await lstat(workspaceDirectory, { bigint: true });
  if (!before.isDirectory() || before.isSymbolicLink()) fail();
  const canonicalPath = resolve(await realpath(workspaceDirectory));
  if (canonicalPath !== resolve(workspaceDirectory)) fail();
  const after = await lstat(workspaceDirectory, { bigint: true });
  if (
    !after.isDirectory() ||
    after.isSymbolicLink() ||
    !sameExactFileIdentity(after, before)
  )
    fail();
  return Object.freeze({
    canonicalPath,
    dev: before.dev,
    ino: before.ino,
    parentDirectory,
  });
}

async function findWorkspaceIdentity(
  identity: WorkspaceIdentity,
): Promise<readonly string[]> {
  const names = (await readdir(identity.parentDirectory)).filter((name) =>
    name.startsWith(WORKSPACE_PREFIX),
  );
  if (names.length > MAXIMUM_WORKSPACE_SCAN_ENTRIES) fail();
  const matches: string[] = [];
  for (const name of names) {
    const candidate = join(identity.parentDirectory, name);
    requireContained(identity.parentDirectory, candidate);
    let metadata: BigIntStats;
    try {
      metadata = await lstat(candidate, { bigint: true });
    } catch (error) {
      if (isFileSystemCode(error, "ENOENT")) continue;
      throw error;
    }
    if (
      metadata.isDirectory() &&
      !metadata.isSymbolicLink() &&
      sameExactFileIdentity(metadata, identity)
    )
      matches.push(resolve(candidate));
  }
  return Object.freeze(matches);
}

async function requireWorkspaceIdentity(
  path: string,
  identity: WorkspaceIdentity,
): Promise<void> {
  requireContained(identity.parentDirectory, path);
  const metadata = await lstat(path, { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    !sameExactFileIdentity(metadata, identity)
  )
    fail();
}

async function encryptArchive(
  runtime: Runtime,
  workspaceDirectory: string,
  stagingDirectory: string,
  role: ArchiveRole,
  sourceBindingSha256: Sha256,
  plaintext: Uint8Array,
  keys: Map<ArchiveRole, Uint8Array>,
  nonces: Map<ArchiveRole, Uint8Array>,
): Promise<PersistedAudit> {
  const fixture = FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES[role];
  let key: Uint8Array | undefined;
  let nonce: Uint8Array | undefined;
  let retainedNonce: Uint8Array | undefined;
  let domainAad: Uint8Array | undefined;
  let ciphertext: Uint8Array | undefined;
  let authTag: Uint8Array | undefined;
  let auditBytes: Uint8Array | undefined;
  let completed = false;
  try {
    key = entropy(
      runtime,
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM.keyBytes,
    );
    nonce = entropy(
      runtime,
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM.nonceBytes,
    );
    if (
      [...keys.values()].some((prior) =>
        equalBytes(prior, key as Uint8Array),
      ) ||
      [...nonces.values()].some((prior) =>
        equalBytes(prior, nonce as Uint8Array),
      )
    )
      fail();
    retainedNonce = Uint8Array.from(nonce);
    keys.set(role, key);
    nonces.set(role, retainedNonce);
    const aad = canonicalBytes({
      algorithm: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM.name,
      byteLength: fixture.byteLength,
      claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
      contentSha256: fixture.contentSha256,
      role,
      schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
      sourceBindingSha256,
    });
    domainAad = concatBytes(
      TEXT_ENCODER.encode(
        FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM.aadDomain,
      ),
      aad,
    );
    wipe(aad);
    const cipher = createCipheriv(
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM.name,
      key,
      nonce,
      { authTagLength: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM.tagBytes },
    );
    cipher.setAAD(domainAad, { plaintextLength: plaintext.byteLength });
    ciphertext = concatBytes(cipher.update(plaintext), cipher.final());
    authTag = Uint8Array.from(cipher.getAuthTag());
    const audit: PersistedAudit = Object.freeze({
      aadSha256: sha256(domainAad),
      algorithm: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM.name,
      authTag: Buffer.from(authTag).toString("base64url"),
      byteLength: fixture.byteLength,
      claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
      ciphertextSha256: sha256(ciphertext),
      contentSha256: fixture.contentSha256,
      nonce: Buffer.from(nonce).toString("base64url"),
      role,
      schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
      sourceBindingSha256,
    });
    const roleDirectory = join(stagingDirectory, role);
    await mkdir(roleDirectory, { mode: 0o700 });
    await writeExclusive(join(roleDirectory, CIPHERTEXT_FILE), ciphertext);
    auditBytes = TEXT_ENCODER.encode(`${canonicalJson(audit)}\n`);
    await writeExclusive(join(roleDirectory, AUDIT_FILE), auditBytes);
    await phase(
      runtime,
      role === "original" ? "original_encrypted" : "amendment_encrypted",
      workspaceDirectory,
    );
    completed = true;
    return audit;
  } finally {
    wipe(nonce);
    wipe(domainAad);
    wipe(ciphertext);
    wipe(authTag);
    wipe(auditBytes);
    if (!completed) {
      if (keys.get(role) === key) keys.delete(role);
      if (nonces.get(role) === retainedNonce) nonces.delete(role);
      wipe(key);
      wipe(retainedNonce);
    }
  }
}

async function readArchive(
  workspaceDirectory: string,
  expected: PersistedAudit,
  keys: ReadonlyMap<ArchiveRole, Uint8Array>,
): Promise<Uint8Array> {
  let auditBytes: Uint8Array | undefined;
  let ciphertext: Uint8Array | undefined;
  let nonce: Uint8Array | undefined;
  let authTag: Uint8Array | undefined;
  let aadDocument: Uint8Array | undefined;
  let domainAad: Uint8Array | undefined;
  let plaintextPrefix: Uint8Array | undefined;
  let plaintextFinal: Uint8Array | undefined;
  let plaintext: Uint8Array | undefined;
  let completed = false;
  try {
    const roleDirectory = join(
      workspaceDirectory,
      RECORD_DIRECTORY,
      expected.role,
    );
    await requireDirectory(roleDirectory);
    auditBytes = await boundedRegularFile(
      join(roleDirectory, AUDIT_FILE),
      4_096,
    );
    const persisted = parseAudit(auditBytes, expected);
    ciphertext = await boundedRegularFile(
      join(roleDirectory, CIPHERTEXT_FILE),
      persisted.byteLength,
      true,
    );
    if (sha256(ciphertext) !== persisted.ciphertextSha256) fail();
    const key = keys.get(persisted.role);
    if (key === undefined) fail();
    nonce = decodeBase64url(
      persisted.nonce,
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM.nonceBytes,
    );
    authTag = decodeBase64url(
      persisted.authTag,
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM.tagBytes,
    );
    aadDocument = canonicalBytes({
      algorithm: persisted.algorithm,
      byteLength: persisted.byteLength,
      claim: persisted.claim,
      contentSha256: persisted.contentSha256,
      role: persisted.role,
      schemaVersion: persisted.schemaVersion,
      sourceBindingSha256: persisted.sourceBindingSha256,
    });
    domainAad = concatBytes(
      TEXT_ENCODER.encode(
        FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM.aadDomain,
      ),
      aadDocument,
    );
    if (sha256(domainAad) !== persisted.aadSha256) fail();
    const decipher = createDecipheriv(
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM.name,
      key,
      nonce,
      { authTagLength: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_ALGORITHM.tagBytes },
    );
    decipher.setAAD(domainAad, { plaintextLength: persisted.byteLength });
    decipher.setAuthTag(authTag);
    plaintextPrefix = decipher.update(ciphertext);
    plaintextFinal = decipher.final();
    plaintext = concatBytes(plaintextPrefix, plaintextFinal);
    if (
      plaintext.byteLength !== persisted.byteLength ||
      sha256(plaintext) !== persisted.contentSha256
    )
      fail();
    completed = true;
    return plaintext;
  } finally {
    wipe(auditBytes);
    wipe(ciphertext);
    wipe(nonce);
    wipe(authTag);
    wipe(aadDocument);
    wipe(domainAad);
    wipe(plaintextPrefix);
    wipe(plaintextFinal);
    if (!completed) wipe(plaintext);
  }
}

function parseAudit(
  bytes: Uint8Array,
  expected: PersistedAudit,
): PersistedAudit {
  let text: string;
  let value: unknown;
  try {
    text = TEXT_DECODER.decode(bytes);
    value = JSON.parse(text);
  } catch {
    fail();
  }
  const record = exactRecord(value, [
    "aadSha256",
    "algorithm",
    "authTag",
    "byteLength",
    "claim",
    "ciphertextSha256",
    "contentSha256",
    "nonce",
    "role",
    "schemaVersion",
    "sourceBindingSha256",
  ]);
  if (
    text !== `${canonicalJson(record)}\n` ||
    canonicalJson(record) !== canonicalJson(expected)
  )
    fail();
  return expected;
}

function publicReceipt(
  audit: PersistedAudit,
  readback: Uint8Array,
): FilingParserArchivePairCustodyReceipt {
  const preimage = Object.freeze({
    aadSha256: audit.aadSha256,
    byteLength: audit.byteLength,
    ciphertextSha256: audit.ciphertextSha256,
    contentSha256: audit.contentSha256,
    readbackSha256: sha256(readback),
    role: audit.role,
    sourceBindingSha256: audit.sourceBindingSha256,
  });
  return Object.freeze({
    ...preimage,
    receiptSha256: domainSha256(RECEIPT_DOMAIN, preimage),
  });
}

function normalizeRuntime(value: TestRuntime): Runtime {
  const runtime = exactOptionalRecord(value, [
    "afterPhase",
    "entropy",
    "workspaceParentDirectory",
  ]);
  if (
    runtime.afterPhase !== undefined &&
    typeof runtime.afterPhase !== "function"
  )
    fail();
  if (runtime.entropy !== undefined && typeof runtime.entropy !== "function")
    fail();
  if (
    runtime.workspaceParentDirectory !== undefined &&
    typeof runtime.workspaceParentDirectory !== "string"
  )
    fail();
  const afterPhase = runtime.afterPhase as TestRuntime["afterPhase"];
  const entropyFunction = runtime.entropy as TestRuntime["entropy"];
  return Object.freeze({
    afterPhase: async (
      phaseValue: FilingParserArchivePairCustodyPhase,
      workspaceDirectory: string,
    ): Promise<void> => {
      await afterPhase?.(phaseValue, workspaceDirectory);
    },
    entropy: (length: number): Uint8Array => {
      if (entropyFunction !== undefined) return entropyFunction(length);
      const generated = randomBytes(length);
      try {
        return Uint8Array.from(generated);
      } finally {
        generated.fill(0);
      }
    },
    workspaceParentDirectory: runtime.workspaceParentDirectory ?? tmpdir(),
  });
}

async function phase(
  runtime: Runtime,
  value: FilingParserArchivePairCustodyPhase,
  workspaceDirectory: string,
): Promise<void> {
  await runtime.afterPhase(value, workspaceDirectory);
}

function entropy(runtime: Runtime, length: number): Uint8Array {
  const provided = runtime.entropy(length);
  try {
    return snapshotExactLength(provided, length);
  } finally {
    wipeIfOrdinaryBytes(provided);
  }
}

async function canonicalDirectory(value: string): Promise<string> {
  const absolute = resolve(value);
  const before = await requireLexicalDirectoryChain(absolute);
  const canonical = resolve(await realpath(absolute));
  const after = await requireLexicalDirectoryChain(absolute);
  const canonicalMetadata = await requireLexicalDirectoryChain(canonical);
  if (
    !sameExactFileIdentity(after, before) ||
    !sameExactFileIdentity(canonicalMetadata, before)
  )
    fail();
  return canonical;
}

async function requireLexicalDirectoryChain(
  value: string,
): Promise<BigIntStats> {
  const absolute = resolve(value);
  const root = parse(absolute).root;
  let current = root;
  let metadata = await lstat(current, { bigint: true });
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail();
  const remainder = relative(root, absolute);
  for (const component of remainder === "" ? [] : remainder.split(sep)) {
    current = join(current, component);
    metadata = await lstat(current, { bigint: true });
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail();
  }
  return metadata;
}

async function requireDirectory(value: string): Promise<void> {
  const metadata = await lstat(value);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail();
}

async function validateExactPairWorkspace(
  workspaceDirectory: string,
): Promise<void> {
  await requireExactDirectoryEntries(workspaceDirectory, [RECORD_DIRECTORY]);
  const pairDirectory = join(workspaceDirectory, RECORD_DIRECTORY);
  await requireDirectory(pairDirectory);
  await requireExactDirectoryEntries(pairDirectory, ["amendment", "original"]);
  for (const role of ["original", "amendment"] as const) {
    const roleDirectory = join(pairDirectory, role);
    await requireDirectory(roleDirectory);
    await requireExactDirectoryEntries(roleDirectory, [
      AUDIT_FILE,
      CIPHERTEXT_FILE,
    ]);
  }
}

async function requireExactDirectoryEntries(
  directory: string,
  expectedNames: readonly string[],
): Promise<void> {
  const names = await readdir(directory);
  if (
    names.length !== expectedNames.length ||
    JSON.stringify([...names].sort()) !==
      JSON.stringify([...expectedNames].sort())
  )
    fail();
}

async function writeExclusive(path: string, bytes: Uint8Array): Promise<void> {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(path, 0o600);
}

async function boundedRegularFile(
  path: string,
  maximumBytes: number,
  exactLength = false,
): Promise<Uint8Array> {
  const metadata = await lstat(path, { bigint: true });
  const maximumBytesBigInt = BigInt(maximumBytes);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.nlink !== 1n ||
    metadata.size <= 0n ||
    metadata.size > maximumBytesBigInt ||
    (exactLength && metadata.size !== maximumBytesBigInt)
  )
    fail();
  const bytes = Uint8Array.from(await readFile(path));
  const finalMetadata = await lstat(path, { bigint: true });
  if (
    !sameExactFileIdentity(finalMetadata, metadata) ||
    finalMetadata.size !== metadata.size ||
    BigInt(bytes.byteLength) !== metadata.size
  )
    fail();
  return bytes;
}

function snapshotExactArchive(value: unknown, role: ArchiveRole): Uint8Array {
  const fixture = FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES[role];
  const snapshot = snapshotExactLength(value, fixture.byteLength);
  if (sha256(snapshot) !== fixture.contentSha256) {
    wipe(snapshot);
    fail();
  }
  return snapshot;
}

function snapshotExactLength(
  value: unknown,
  expectedLength: number,
): Uint8Array {
  try {
    if (typeof value !== "object" || value === null || utilTypes.isProxy(value))
      fail();
    const typedArrayPrototype = Object.getPrototypeOf(
      Uint8Array.prototype,
    ) as object;
    const bufferDescriptor = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      "buffer",
    );
    const lengthDescriptor = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      "byteLength",
    );
    const tagDescriptor = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      Symbol.toStringTag,
    );
    const arrayBufferLengthDescriptor = Object.getOwnPropertyDescriptor(
      ArrayBuffer.prototype,
      "byteLength",
    );
    const tag = tagDescriptor?.get?.call(value) as unknown;
    const buffer = bufferDescriptor?.get?.call(value) as unknown;
    const byteLength = lengthDescriptor?.get?.call(value) as unknown;
    const backingLength = arrayBufferLengthDescriptor?.get?.call(
      buffer,
    ) as unknown;
    if (
      tag !== "Uint8Array" ||
      byteLength !== expectedLength ||
      backingLength !== expectedLength ||
      Object.getPrototypeOf(value) !== Uint8Array.prototype ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    )
      fail();
    const snapshot = new Uint8Array(expectedLength);
    Uint8Array.prototype.set.call(snapshot, value as Uint8Array);
    return snapshot;
  } catch {
    fail();
  }
}

function exactRecord<TKeys extends string>(
  value: unknown,
  keys: readonly TKeys[],
): Readonly<Record<TKeys, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    fail();
  const ownKeys = Reflect.ownKeys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    ownKeys.some((key) => typeof key !== "string") ||
    JSON.stringify([...ownKeys].sort()) !== JSON.stringify([...keys].sort())
  )
    fail();
  const result = Object.create(null) as Record<TKeys, unknown>;
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor)) fail();
    result[key] = descriptor.value as unknown;
  }
  return Object.freeze(result);
}

function exactOptionalRecord<TKeys extends string>(
  value: unknown,
  allowedKeys: readonly TKeys[],
): Partial<Readonly<Record<TKeys, unknown>>> {
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    fail();
  const ownKeys = Reflect.ownKeys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    ownKeys.some(
      (key) => typeof key !== "string" || !allowedKeys.includes(key as TKeys),
    )
  )
    fail();
  const result = Object.create(null) as Record<TKeys, unknown>;
  for (const key of ownKeys as unknown as readonly TKeys[]) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor)) fail();
    result[key] = descriptor.value as unknown;
  }
  return Object.freeze(result);
}

function canonicalBytes(value: unknown): Uint8Array {
  return TEXT_ENCODER.encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail();
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (typeof value !== "object" || value === null) fail();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function domainSha256(domain: Uint8Array, value: unknown): Sha256 {
  return `sha256:${createHash("sha256")
    .update(domain)
    .update(canonicalBytes(value))
    .digest("hex")}`;
}

function sha256(value: Uint8Array): Sha256 {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function concatBytes(first: Uint8Array, second: Uint8Array): Uint8Array {
  const result = new Uint8Array(first.byteLength + second.byteLength);
  result.set(first, 0);
  result.set(second, first.byteLength);
  return result;
}

function decodeBase64url(value: string, expectedLength: number): Uint8Array {
  if (!BASE64URL.test(value)) fail();
  const bytes = Uint8Array.from(Buffer.from(value, "base64url"));
  if (
    bytes.byteLength !== expectedLength ||
    Buffer.from(bytes).toString("base64url") !== value
  )
    fail();
  return bytes;
}

function equalBytes(first: Uint8Array, second: Uint8Array): boolean {
  if (first.byteLength !== second.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < first.byteLength; index += 1)
    difference |= (first[index] ?? 0) ^ (second[index] ?? 0);
  return difference === 0;
}

function requireContained(parent: string, child: string): void {
  const pathFromParent = relative(resolve(parent), resolve(child));
  if (
    pathFromParent === "" ||
    pathFromParent === ".." ||
    pathFromParent.startsWith(`..${sep}`) ||
    isAbsolute(pathFromParent)
  )
    fail();
}

function isSha256(value: unknown): value is Sha256 {
  return typeof value === "string" && HASH.test(value);
}

function sameExactFileIdentity(
  left: Readonly<{ readonly dev: bigint; readonly ino: bigint }>,
  right: Readonly<{ readonly dev: bigint; readonly ino: bigint }>,
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function isFileSystemCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

function wipe(value: Uint8Array | undefined): void {
  if (value !== undefined) Uint8Array.prototype.fill.call(value, 0);
}

function wipeIfOrdinaryBytes(value: unknown): void {
  try {
    if (
      typeof value === "object" &&
      value !== null &&
      !utilTypes.isProxy(value) &&
      utilTypes.isUint8Array(value)
    )
      Uint8Array.prototype.fill.call(value, 0);
  } catch {
    return;
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value))
    return value;
  for (const key of Reflect.ownKeys(value))
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  return Object.freeze(value);
}

function fail(): never {
  throw new TypeError("FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FAILURE");
}
