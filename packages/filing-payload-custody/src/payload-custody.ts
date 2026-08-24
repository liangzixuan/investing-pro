import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import type { Stats } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  realpath,
  rename,
  rm,
  unlink,
} from "node:fs/promises";
import {
  basename,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
  sep,
} from "node:path";

export const FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION = "1.0.0" as const;
export const FILING_PAYLOAD_CUSTODY_CLAIM =
  "bounded_synthetic_filing_payload_integrity_custody_and_logical_key_unavailability" as const;

export const FILING_PAYLOAD_CUSTODY_LIMITS = Object.freeze({
  auditBytes: 8_192,
  payloadBytes: 1_048_576,
  syntheticFixtureBytes: 4_096,
});

export const FILING_PAYLOAD_CUSTODY_ALGORITHM = Object.freeze({
  aadDomain: "research-cockpit:filing-payload-custody:aes-256-gcm:v1\u0000",
  keyBytes: 32,
  name: "aes-256-gcm" as const,
  nonceBytes: 12,
  tagBytes: 16,
});

export const FILING_PAYLOAD_CUSTODY_RETENTION_POLICY = Object.freeze({
  class: "synthetic_payload_24h_audit_retained" as const,
  payloadMilliseconds: 86_400_000,
});

export const FILING_PAYLOAD_CUSTODY_FIXTURE = Object.freeze({
  byteLength: 4_096,
  contentSha256:
    "sha256:19befbe96017f31d5bf5f723fc8e5bee21210049706dfb65e3a0f77e1c6297df" as const,
  fixtureId: "synthetic-filing-payload-v1" as const,
});

export const FILING_PAYLOAD_CUSTODY_ERROR_CODES = Object.freeze([
  "invalid_input",
  "hash_mismatch",
  "state_conflict",
  "retention_active",
  "payload_expired",
  "payload_unavailable",
  "resurrection_blocked",
  "record_invalid",
  "key_store_failure",
  "io_failure",
  "cleanup_failure",
  "closed",
] as const);

export type FilingPayloadCustodyErrorCode =
  (typeof FILING_PAYLOAD_CUSTODY_ERROR_CODES)[number];
export type FilingPayloadCustodyState =
  "available" | "logical_key_unavailability";
type Sha256 = `sha256:${string}`;

export class FilingPayloadCustodyError extends Error {
  readonly code: FilingPayloadCustodyErrorCode;

  constructor(code: FilingPayloadCustodyErrorCode) {
    super("FILING_PAYLOAD_CUSTODY_FAILURE");
    this.name = "FilingPayloadCustodyError";
    this.code = code;
  }
}

export interface FilingPayloadCustodyClock {
  readonly now: () => Date;
}

export interface FilingPayloadCustodyEntropy {
  readonly bytes: (length: number) => Uint8Array;
}

export interface FilingPayloadKeyStore {
  readonly forget: (
    keyId: string,
  ) => Promise<"forgotten" | "missing"> | "forgotten" | "missing";
  readonly putIfAbsent: (
    keyId: string,
    key: Uint8Array,
  ) => Promise<boolean> | boolean;
  readonly read: (
    keyId: string,
  ) => Promise<Uint8Array | undefined> | Uint8Array | undefined;
}

export interface FilingPayloadCustodyOptions {
  readonly clock: FilingPayloadCustodyClock;
  readonly entropy: FilingPayloadCustodyEntropy;
  readonly keyStore: FilingPayloadKeyStore;
  readonly workspaceParentDirectory: string;
}

export interface FilingPayloadStageCommand {
  readonly contentSha256: typeof FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256;
  readonly fixtureId: typeof FILING_PAYLOAD_CUSTODY_FIXTURE.fixtureId;
  readonly payload: Uint8Array;
  readonly retentionClass: typeof FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.class;
  readonly sourceBindingSha256: Sha256;
}

export interface FilingPayloadReadCommand {
  readonly payloadId: string;
}

export interface FilingPayloadExpireCommand {
  readonly payloadId: string;
}

export interface FilingPayloadAuditCommand {
  readonly payloadId: string;
}

export interface FilingPayloadCustodyReceipt {
  readonly algorithm: typeof FILING_PAYLOAD_CUSTODY_ALGORITHM.name;
  readonly byteLength: number;
  readonly claim: typeof FILING_PAYLOAD_CUSTODY_CLAIM;
  readonly contentSha256: Sha256;
  readonly createdAt: string;
  readonly fixtureId: typeof FILING_PAYLOAD_CUSTODY_FIXTURE.fixtureId;
  readonly payloadExpiresAt: string;
  readonly payloadId: string;
  readonly retentionClass: typeof FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.class;
  readonly schemaVersion: typeof FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION;
  readonly sourceBindingSha256: Sha256;
  readonly state: FilingPayloadCustodyState;
  readonly transitionedAt: string | null;
  readonly version: 1 | 2;
}

export interface FilingPayloadAuditRecord extends FilingPayloadCustodyReceipt {
  readonly aadSha256: Sha256;
  readonly ciphertextSha256: Sha256;
}

export interface FilingPayloadCustodyBoundary {
  readonly close: () => Promise<void>;
  readonly expire: (
    command: FilingPayloadExpireCommand,
  ) => Promise<FilingPayloadCustodyReceipt>;
  readonly inspectAudit: (
    command: FilingPayloadAuditCommand,
  ) => Promise<FilingPayloadAuditRecord>;
  readonly read: (command: FilingPayloadReadCommand) => Promise<Uint8Array>;
  readonly stage: (
    command: FilingPayloadStageCommand,
  ) => Promise<FilingPayloadCustodyReceipt>;
}

export const FILING_PAYLOAD_CUSTODY_FAULT_PHASES = Object.freeze([
  "key_created",
  "ciphertext_written",
  "audit_written",
  "before_publish",
  "published",
  "before_key_forget",
  "key_forgotten",
  "before_audit_update",
  "audit_updated",
  "ciphertext_deleted",
  "before_close_cleanup",
] as const);

export type FilingPayloadCustodyFaultPhase =
  (typeof FILING_PAYLOAD_CUSTODY_FAULT_PHASES)[number];

export interface FilingPayloadCustodyTestHarness {
  readonly boundary: FilingPayloadCustodyBoundary;
  readonly workspaceDirectory: string;
}

interface TestHooks {
  readonly afterPhase?: (
    phase: FilingPayloadCustodyFaultPhase,
  ) => Promise<void> | void;
}

interface NormalizedOptions {
  readonly clock: FilingPayloadCustodyClock;
  readonly entropy: FilingPayloadCustodyEntropy;
  readonly keyStore: FilingPayloadKeyStore;
  readonly workspaceParentDirectory: string;
}

interface PersistedAudit extends FilingPayloadAuditRecord {
  readonly authTag: string;
  readonly keyId: string;
  readonly nonce: string;
}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const PAYLOAD_ID = /^payload_[0-9a-f]{32}$/u;
const KEY_ID = /^key_[0-9a-f]{32}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const WORKSPACE_PREFIX = "research-cockpit-filing-payload-custody-";
const OWNER_FILE = ".research-cockpit-custody-owner";
const AUDIT_DOMAIN_DIRECTORY = "audit";
const PAYLOAD_DOMAIN_DIRECTORY = "payload";
const AVAILABLE_AUDIT = "available.json";
const UNAVAILABLE_AUDIT = "logical-key-unavailability.json";
const CIPHERTEXT_FILE = "ciphertext.bin";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: true,
});
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

export function createSyntheticFilingPayloadFixture(): Uint8Array {
  const prefix = textEncoder.encode(
    "research-cockpit:synthetic-filing-payload-custody:v1\n",
  );
  const bytes = new Uint8Array(
    FILING_PAYLOAD_CUSTODY_LIMITS.syntheticFixtureBytes,
  );
  for (let index = 0; index < bytes.byteLength; index += 1) {
    const prefixByte = prefix[index % prefix.byteLength];
    if (prefixByte === undefined) invalid("invalid_input");
    bytes[index] = prefixByte ^ ((index * 31 + 17) & 0xff);
  }
  if (sha256(bytes) !== FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256)
    invalid("record_invalid");
  return bytes;
}

export function createSyntheticInMemoryFilingPayloadKeyStore(): FilingPayloadKeyStore {
  const keys = new Map<string, Uint8Array>();
  return Object.freeze({
    forget: (keyId: string): "forgotten" | "missing" => {
      if (typeof keyId !== "string" || !KEY_ID.test(keyId))
        invalid("key_store_failure");
      const existing = keys.get(keyId);
      if (existing === undefined) return "missing";
      existing.fill(0);
      keys.delete(keyId);
      return "forgotten";
    },
    putIfAbsent: (keyId: string, key: Uint8Array): boolean => {
      if (typeof keyId !== "string" || !KEY_ID.test(keyId))
        invalid("key_store_failure");
      let snapshot: Uint8Array;
      try {
        snapshot = snapshotBytes(
          key,
          FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes,
        );
      } catch {
        invalid("key_store_failure");
      }
      if (keys.has(keyId)) return false;
      keys.set(keyId, snapshot);
      return true;
    },
    read: (keyId: string): Uint8Array | undefined => {
      if (typeof keyId !== "string" || !KEY_ID.test(keyId))
        invalid("key_store_failure");
      const key = keys.get(keyId);
      return key === undefined ? undefined : copyBytes(key);
    },
  });
}

export async function createFileSystemFilingPayloadCustodyBoundary(
  options: FilingPayloadCustodyOptions,
): Promise<FilingPayloadCustodyBoundary> {
  const initialized = await initialize(options, Object.freeze({}));
  return initialized.boundary;
}

/** @internal Test-only fault and workspace inspection seam. */
export async function createFileSystemFilingPayloadCustodyTestHarness(
  options: FilingPayloadCustodyOptions,
  hooks: TestHooks = Object.freeze({}),
): Promise<FilingPayloadCustodyTestHarness> {
  return initialize(options, hooks);
}

async function initialize(
  options: FilingPayloadCustodyOptions,
  hooks: TestHooks,
): Promise<FilingPayloadCustodyTestHarness> {
  const normalizedOptions = normalizeOptions(options);
  const normalizedHooks = normalizeHooks(hooks);
  let parent = normalizedOptions.workspaceParentDirectory;
  let workspaceDirectory: string | undefined;
  try {
    parent = await canonicalizeWorkspaceParentDirectory(parent);
    if ((await readdir(parent)).length !== 0) invalid("invalid_input");
    workspaceDirectory = await mkdtemp(join(parent, WORKSPACE_PREFIX));
    requireContained(parent, workspaceDirectory);
    await chmod(workspaceDirectory, 0o700);
    await mkdir(join(workspaceDirectory, ".staging"), { mode: 0o700 });
    await mkdir(join(workspaceDirectory, "records"), { mode: 0o700 });
    await writeExclusiveAndSync(
      join(workspaceDirectory, OWNER_FILE),
      textEncoder.encode(`${resolve(workspaceDirectory)}\n`),
    );
    const boundary = new FileSystemFilingPayloadCustodyBoundary(
      Object.freeze({
        ...normalizedOptions,
        workspaceParentDirectory: parent,
      }),
      workspaceDirectory,
      normalizedHooks,
    );
    await boundary.assertInitializedLayout();
    return Object.freeze({ boundary, workspaceDirectory });
  } catch {
    if (workspaceDirectory !== undefined) {
      try {
        requireContained(parent, workspaceDirectory);
        await rm(workspaceDirectory, { force: true, recursive: true });
      } catch {
        invalid("cleanup_failure");
      }
    }
    invalid("io_failure");
  }
}

async function canonicalizeWorkspaceParentDirectory(
  path: string,
): Promise<string> {
  try {
    const metadata = await requireLexicalDirectoryChain(path);
    const canonicalPath = resolve(await realpath(path));
    await requireExactDirectory(canonicalPath, "invalid_input");
    const canonicalMetadata = await lstat(canonicalPath);
    if (
      metadata.dev !== canonicalMetadata.dev ||
      metadata.ino !== canonicalMetadata.ino
    )
      invalid("invalid_input");
    return canonicalPath;
  } catch (error) {
    rethrowBoundary(error, "invalid_input");
  }
}

async function requireLexicalDirectoryChain(path: string): Promise<Stats> {
  const absolutePath = resolve(path);
  const root = parse(absolutePath).root;
  let currentPath = root;
  let metadata = await lstat(currentPath);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    invalid("invalid_input");
  const remainder = relative(root, absolutePath);
  for (const component of remainder === "" ? [] : remainder.split(sep)) {
    currentPath = join(currentPath, component);
    metadata = await lstat(currentPath);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      invalid("invalid_input");
  }
  if (sep === "/" && (metadata.mode & 0o777) !== 0o700)
    invalid("invalid_input");
  return metadata;
}

class FileSystemFilingPayloadCustodyBoundary implements FilingPayloadCustodyBoundary {
  readonly #clock: FilingPayloadCustodyClock;
  readonly #entropy: FilingPayloadCustodyEntropy;
  readonly #hooks: TestHooks;
  readonly #keyStore: FilingPayloadKeyStore;
  readonly #parentDirectory: string;
  readonly #recordsDirectory: string;
  readonly #stagingDirectory: string;
  readonly #workspaceDirectory: string;
  #closed = false;
  #current: PersistedAudit | undefined;
  #expiryTransition:
    { readonly payloadId: string; readonly transitionedAt: string } | undefined;
  #lastNowMilliseconds: number | undefined;
  readonly #ownedKeyIds = new Set<string>();
  #tail: Promise<void> = Promise.resolve();

  constructor(
    options: NormalizedOptions,
    workspaceDirectory: string,
    hooks: TestHooks,
  ) {
    this.#clock = options.clock;
    this.#entropy = options.entropy;
    this.#hooks = hooks;
    this.#keyStore = options.keyStore;
    this.#parentDirectory = resolve(options.workspaceParentDirectory);
    this.#workspaceDirectory = resolve(workspaceDirectory);
    this.#recordsDirectory = join(this.#workspaceDirectory, "records");
    this.#stagingDirectory = join(this.#workspaceDirectory, ".staging");
  }

  async assertInitializedLayout(): Promise<void> {
    await this.#assertWorkspaceLayout();
  }

  async stage(
    command: FilingPayloadStageCommand,
  ): Promise<FilingPayloadCustodyReceipt> {
    const input = normalizeStageCommand(command);
    return this.#serialize(async () => {
      this.#assertOpen();
      await this.#assertWorkspaceLayout();
      const existing = await this.#loadCurrentIfAny();
      if (existing !== undefined) {
        if (
          existing.contentSha256 !== input.contentSha256 ||
          existing.fixtureId !== input.fixtureId ||
          existing.sourceBindingSha256 !== input.sourceBindingSha256 ||
          existing.retentionClass !== input.retentionClass ||
          existing.byteLength !== input.payload.byteLength
        )
          invalid("state_conflict");
        if (existing.state === "logical_key_unavailability")
          invalid("resurrection_blocked");
        return receipt(existing);
      }

      if ((await readdir(this.#recordsDirectory)).length !== 0)
        invalid("record_invalid");

      const createdAtDate = this.#now();
      const createdAt = createdAtDate.toISOString();
      const expirationMilliseconds =
        createdAtDate.getTime() +
        FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.payloadMilliseconds;
      if (!Number.isFinite(expirationMilliseconds)) invalid("invalid_input");
      let payloadExpiresAt: string;
      try {
        payloadExpiresAt = new Date(expirationMilliseconds).toISOString();
      } catch {
        invalid("invalid_input");
      }
      const payloadId = `payload_${hex(this.#randomBytes(16))}`;
      const keyId = `key_${hex(this.#randomBytes(16))}`;
      const key = this.#randomBytes(FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes);
      const nonce = this.#randomBytes(
        FILING_PAYLOAD_CUSTODY_ALGORITHM.nonceBytes,
      );
      const aadObject = aadRecord({
        byteLength: input.payload.byteLength,
        contentSha256: input.contentSha256,
        createdAt,
        keyId,
        payloadExpiresAt,
        payloadId,
        sourceBindingSha256: input.sourceBindingSha256,
      });
      const aad = concatBytes(
        textEncoder.encode(FILING_PAYLOAD_CUSTODY_ALGORITHM.aadDomain),
        textEncoder.encode(canonicalJson(aadObject)),
      );
      const cipher = createCipheriv(
        FILING_PAYLOAD_CUSTODY_ALGORITHM.name,
        key,
        nonce,
        { authTagLength: FILING_PAYLOAD_CUSTODY_ALGORITHM.tagBytes },
      );
      cipher.setAAD(aad, { plaintextLength: input.payload.byteLength });
      const ciphertext = concatBytes(
        cipher.update(input.payload),
        cipher.final(),
      );
      const authTag = copyBytes(cipher.getAuthTag());
      const audit: PersistedAudit = Object.freeze({
        aadSha256: sha256(aad),
        algorithm: FILING_PAYLOAD_CUSTODY_ALGORITHM.name,
        authTag: base64url(authTag),
        byteLength: input.payload.byteLength,
        ciphertextSha256: sha256(ciphertext),
        claim: FILING_PAYLOAD_CUSTODY_CLAIM,
        contentSha256: input.contentSha256,
        createdAt,
        fixtureId: input.fixtureId,
        keyId,
        nonce: base64url(nonce),
        payloadExpiresAt,
        payloadId,
        retentionClass: input.retentionClass,
        schemaVersion: FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION,
        sourceBindingSha256: input.sourceBindingSha256,
        state: "available",
        transitionedAt: null,
        version: 1,
      });

      const stageDirectory = join(
        this.#stagingDirectory,
        `record_${hex(this.#randomBytes(16))}`,
      );
      const recordDirectory = this.#recordDirectory(payloadId);
      let keyCleanupRequired = false;
      let stageCreated = false;
      let published = false;
      try {
        keyCleanupRequired = true;
        this.#ownedKeyIds.add(keyId);
        const inserted = await this.#keyStore.putIfAbsent(
          keyId,
          copyBytes(key),
        );
        if (inserted !== true) {
          keyCleanupRequired = false;
          this.#ownedKeyIds.delete(keyId);
          invalid("key_store_failure");
        }
        await this.#phase("key_created");
        await this.#assertWorkspaceLayout();

        await mkdir(stageDirectory, { mode: 0o700 });
        stageCreated = true;
        const stagePayloadDirectory = join(
          stageDirectory,
          PAYLOAD_DOMAIN_DIRECTORY,
        );
        const stageAuditDirectory = join(
          stageDirectory,
          AUDIT_DOMAIN_DIRECTORY,
        );
        await mkdir(stagePayloadDirectory, { mode: 0o700 });
        await mkdir(stageAuditDirectory, { mode: 0o700 });
        await writeExclusiveAndSync(
          join(stagePayloadDirectory, CIPHERTEXT_FILE),
          ciphertext,
        );
        await this.#phase("ciphertext_written");
        await this.#assertStagedRecord(stageDirectory, audit, false);
        await writeExclusiveAndSync(
          join(stageAuditDirectory, AVAILABLE_AUDIT),
          textEncoder.encode(`${canonicalJson(audit)}\n`),
        );
        await this.#phase("audit_written");
        await this.#assertStagedRecord(stageDirectory, audit, true);
        await this.#phase("before_publish");
        await this.#assertStagedRecord(stageDirectory, audit, true);
        await rename(stageDirectory, recordDirectory);
        stageCreated = false;
        published = true;
        await this.#assertPublishedRecord(audit);
        await this.#phase("published");
        await this.#assertPublishedRecord(audit);
        this.#current = audit;
        return receipt(audit);
      } catch (error) {
        let cleanupFailed = false;
        if (published) {
          try {
            await rm(recordDirectory, { force: true, recursive: true });
          } catch {
            cleanupFailed = true;
          }
        }
        if (stageCreated) {
          try {
            await rm(stageDirectory, { force: true, recursive: true });
          } catch {
            cleanupFailed = true;
          }
        }
        if (keyCleanupRequired) {
          try {
            const forgotten = await this.#keyStore.forget(keyId);
            if (forgotten !== "forgotten" && forgotten !== "missing") {
              cleanupFailed = true;
            } else {
              this.#ownedKeyIds.delete(keyId);
              keyCleanupRequired = false;
            }
          } catch {
            cleanupFailed = true;
          }
        }
        if (cleanupFailed) invalid("cleanup_failure");
        rethrowBoundary(error, "io_failure");
      } finally {
        key.fill(0);
      }
    });
  }

  async read(command: FilingPayloadReadCommand): Promise<Uint8Array> {
    const payloadId = normalizePayloadCommand(command);
    return this.#serialize(async () => {
      this.#assertOpen();
      await this.#assertWorkspaceLayout();
      const audit = await this.#requireAudit(payloadId);
      if (audit.state === "logical_key_unavailability")
        invalid("payload_unavailable");
      if (this.#now().getTime() >= Date.parse(audit.payloadExpiresAt))
        invalid("payload_expired");
      return this.#authenticateAvailablePayload(audit);
    });
  }

  async expire(
    command: FilingPayloadExpireCommand,
  ): Promise<FilingPayloadCustodyReceipt> {
    const payloadId = normalizePayloadCommand(command);
    return this.#serialize(async () => {
      this.#assertOpen();
      await this.#assertWorkspaceLayout();
      const audit = await this.#requireAudit(payloadId);
      if (audit.state === "logical_key_unavailability") {
        await this.#removeCiphertextIfPresent(audit);
        this.#expiryTransition = undefined;
        return receipt(audit);
      }
      const observedAt = this.#now();
      if (this.#expiryTransition === undefined) {
        if (observedAt.getTime() < Date.parse(audit.payloadExpiresAt))
          invalid("retention_active");
        try {
          await this.#phase("before_key_forget");
          await this.#assertWorkspaceLayout();
          const refreshed = await this.#requireAudit(payloadId);
          const authenticated =
            await this.#authenticateAvailablePayload(refreshed);
          authenticated.fill(0);
          this.#expiryTransition = Object.freeze({
            payloadId,
            transitionedAt: this.#now().toISOString(),
          });
        } catch (error) {
          rethrowBoundary(error, "key_store_failure");
        }
      }
      const transition = this.#expiryTransition;
      if (transition === undefined || transition.payloadId !== payloadId)
        invalid("state_conflict");
      try {
        const forgotten = await this.#keyStore.forget(audit.keyId);
        if (forgotten !== "forgotten" && forgotten !== "missing")
          invalid("key_store_failure");
        this.#ownedKeyIds.delete(audit.keyId);
        await this.#phase("key_forgotten");
      } catch (error) {
        rethrowBoundary(error, "key_store_failure");
      }

      try {
        await this.#assertWorkspaceLayout();
        await this.#requireAudit(payloadId);
        await this.#phase("before_audit_update");
        await this.#assertWorkspaceLayout();
        await this.#requireAudit(payloadId);
        const unavailable: PersistedAudit = Object.freeze({
          ...audit,
          state: "logical_key_unavailability",
          transitionedAt: transition.transitionedAt,
          version: 2,
        });
        await writeExclusiveAndSync(
          join(
            this.#recordDirectory(payloadId),
            AUDIT_DOMAIN_DIRECTORY,
            UNAVAILABLE_AUDIT,
          ),
          textEncoder.encode(`${canonicalJson(unavailable)}\n`),
        );
        this.#current = unavailable;
        await this.#phase("audit_updated");
        await this.#removeCiphertextIfPresent(unavailable);
        await this.#assertWorkspaceLayout();
        const observed = await this.#requireAudit(payloadId);
        if (canonicalJson(observed) !== canonicalJson(unavailable))
          invalid("record_invalid");
        this.#expiryTransition = undefined;
        return receipt(unavailable);
      } catch (error) {
        rethrowBoundary(error, "io_failure");
      }
    });
  }

  async inspectAudit(
    command: FilingPayloadAuditCommand,
  ): Promise<FilingPayloadAuditRecord> {
    const payloadId = normalizePayloadCommand(command);
    return this.#serialize(async () => {
      this.#assertOpen();
      await this.#assertWorkspaceLayout();
      return publicAudit(await this.#requireAudit(payloadId));
    });
  }

  async close(): Promise<void> {
    return this.#serialize(async () => {
      if (this.#closed) return;
      try {
        await this.#phase("before_close_cleanup");
        await this.#assertWorkspaceLayout();
        for (const keyId of [...this.#ownedKeyIds]) {
          const forgotten = await this.#keyStore.forget(keyId);
          if (forgotten !== "forgotten" && forgotten !== "missing")
            invalid("cleanup_failure");
          this.#ownedKeyIds.delete(keyId);
        }
        requireContained(this.#parentDirectory, this.#workspaceDirectory);
        const expectedMarker = textEncoder.encode(
          `${this.#workspaceDirectory}\n`,
        );
        const marker = textDecoder.decode(
          await readBoundedRegularFile(
            join(this.#workspaceDirectory, OWNER_FILE),
            expectedMarker.byteLength,
            true,
          ),
        );
        if (marker !== `${this.#workspaceDirectory}\n`)
          invalid("cleanup_failure");
        await rm(this.#workspaceDirectory, { recursive: true });
        this.#closed = true;
      } catch {
        invalid("cleanup_failure");
      }
    });
  }

  async #assertWorkspaceLayout(stagingEntry?: string): Promise<void> {
    await requireExactDirectory(this.#parentDirectory, "record_invalid");
    const parentEntries = (await readdir(this.#parentDirectory)).sort();
    if (
      JSON.stringify(parentEntries) !==
      JSON.stringify([basename(this.#workspaceDirectory)])
    )
      invalid("record_invalid");
    await requireExactDirectory(this.#workspaceDirectory, "record_invalid");
    const workspaceEntries = (await readdir(this.#workspaceDirectory)).sort();
    if (
      JSON.stringify(workspaceEntries) !==
      JSON.stringify([OWNER_FILE, ".staging", "records"].sort())
    )
      invalid("record_invalid");
    await requireExactDirectory(this.#stagingDirectory, "record_invalid");
    await requireExactDirectory(this.#recordsDirectory, "record_invalid");
    const stagingEntries = (await readdir(this.#stagingDirectory)).sort();
    if (
      JSON.stringify(stagingEntries) !==
      JSON.stringify(stagingEntry === undefined ? [] : [stagingEntry])
    )
      invalid("record_invalid");
    const expectedMarker = textEncoder.encode(`${this.#workspaceDirectory}\n`);
    const marker = await readBoundedRegularFile(
      join(this.#workspaceDirectory, OWNER_FILE),
      expectedMarker.byteLength,
      true,
    );
    if (!equalBytes(marker, expectedMarker)) invalid("record_invalid");
  }

  async #assertStagedRecord(
    stageDirectory: string,
    expectedAudit: PersistedAudit,
    auditWritten: boolean,
  ): Promise<void> {
    requireContained(this.#stagingDirectory, stageDirectory);
    await this.#assertWorkspaceLayout(basename(stageDirectory));
    await requireExactDirectory(stageDirectory, "record_invalid");
    const stageEntries = (await readdir(stageDirectory)).sort();
    if (
      JSON.stringify(stageEntries) !==
      JSON.stringify([AUDIT_DOMAIN_DIRECTORY, PAYLOAD_DOMAIN_DIRECTORY])
    )
      invalid("record_invalid");
    const auditDirectory = join(stageDirectory, AUDIT_DOMAIN_DIRECTORY);
    const payloadDirectory = join(stageDirectory, PAYLOAD_DOMAIN_DIRECTORY);
    await requireExactDirectory(auditDirectory, "record_invalid");
    await requireExactDirectory(payloadDirectory, "record_invalid");
    const auditEntries = (await readdir(auditDirectory)).sort();
    const payloadEntries = (await readdir(payloadDirectory)).sort();
    if (
      JSON.stringify(auditEntries) !==
        JSON.stringify(auditWritten ? [AVAILABLE_AUDIT] : []) ||
      JSON.stringify(payloadEntries) !== JSON.stringify([CIPHERTEXT_FILE])
    )
      invalid("record_invalid");
    const ciphertext = await readBoundedRegularFile(
      join(payloadDirectory, CIPHERTEXT_FILE),
      FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength,
      true,
    );
    if (sha256(ciphertext) !== expectedAudit.ciphertextSha256)
      invalid("record_invalid");
    if (auditWritten) {
      const audit = parseAudit(
        await readBoundedRegularFile(
          join(auditDirectory, AVAILABLE_AUDIT),
          FILING_PAYLOAD_CUSTODY_LIMITS.auditBytes,
        ),
      );
      if (canonicalJson(audit) !== canonicalJson(expectedAudit))
        invalid("record_invalid");
    }
  }

  async #assertPublishedRecord(expectedAudit: PersistedAudit): Promise<void> {
    const entries = await readdir(this.#recordsDirectory, {
      withFileTypes: true,
    });
    if (
      entries.length !== 1 ||
      entries[0]?.name !== expectedAudit.payloadId ||
      !entries[0].isDirectory() ||
      entries[0].isSymbolicLink()
    )
      invalid("record_invalid");
    const observed = await this.#loadAudit(expectedAudit.payloadId);
    if (canonicalJson(observed) !== canonicalJson(expectedAudit))
      invalid("record_invalid");
    await this.#readCiphertext(expectedAudit);
  }

  async #removeCiphertextIfPresent(audit: PersistedAudit): Promise<void> {
    const ciphertextPath = join(
      this.#recordDirectory(audit.payloadId),
      PAYLOAD_DOMAIN_DIRECTORY,
      CIPHERTEXT_FILE,
    );
    try {
      await this.#assertWorkspaceLayout();
      const trusted = await this.#requireAudit(audit.payloadId);
      if (canonicalJson(trusted) !== canonicalJson(audit))
        invalid("record_invalid");
      const metadata = await lstat(ciphertextPath).catch((error: unknown) => {
        if (isFileSystemCode(error, "ENOENT")) return undefined;
        throw error;
      });
      if (metadata !== undefined) {
        requireRegularFileMetadata(
          metadata,
          FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength,
          true,
        );
        await unlink(ciphertextPath);
      }
      await this.#phase("ciphertext_deleted");
    } catch (error) {
      rethrowBoundary(error, "io_failure");
    }
  }

  async #loadCurrentIfAny(): Promise<PersistedAudit | undefined> {
    const entries = await readdir(this.#recordsDirectory, {
      withFileTypes: true,
    });
    if (this.#current === undefined) {
      if (entries.length === 0) return undefined;
      invalid("record_invalid");
    }
    if (
      entries.length !== 1 ||
      entries[0]?.name !== this.#current.payloadId ||
      !entries[0].isDirectory() ||
      entries[0].isSymbolicLink()
    )
      invalid("record_invalid");
    const observed = await this.#loadAudit(this.#current.payloadId);
    if (canonicalJson(observed) !== canonicalJson(this.#current))
      invalid("record_invalid");
    return this.#current;
  }

  async #authenticateAvailablePayload(
    audit: PersistedAudit,
  ): Promise<Uint8Array> {
    if (audit.state !== "available") invalid("payload_unavailable");
    const ciphertext = await this.#readCiphertext(audit);
    let key: Uint8Array | undefined;
    try {
      const candidate = await this.#keyStore.read(audit.keyId);
      key =
        candidate === undefined
          ? undefined
          : snapshotBytes(candidate, FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes);
    } catch {
      invalid("key_store_failure");
    }
    if (key === undefined) invalid("payload_unavailable");
    try {
      const aad = concatBytes(
        textEncoder.encode(FILING_PAYLOAD_CUSTODY_ALGORITHM.aadDomain),
        textEncoder.encode(
          canonicalJson(
            aadRecord({
              byteLength: audit.byteLength,
              contentSha256: audit.contentSha256,
              createdAt: audit.createdAt,
              keyId: audit.keyId,
              payloadExpiresAt: audit.payloadExpiresAt,
              payloadId: audit.payloadId,
              sourceBindingSha256: audit.sourceBindingSha256,
            }),
          ),
        ),
      );
      if (sha256(aad) !== audit.aadSha256) invalid("record_invalid");
      const nonce = decodeBase64url(
        audit.nonce,
        FILING_PAYLOAD_CUSTODY_ALGORITHM.nonceBytes,
      );
      const authTag = decodeBase64url(
        audit.authTag,
        FILING_PAYLOAD_CUSTODY_ALGORITHM.tagBytes,
      );
      const decipher = createDecipheriv(
        FILING_PAYLOAD_CUSTODY_ALGORITHM.name,
        key,
        nonce,
        { authTagLength: FILING_PAYLOAD_CUSTODY_ALGORITHM.tagBytes },
      );
      decipher.setAAD(aad, { plaintextLength: audit.byteLength });
      decipher.setAuthTag(authTag);
      let plaintext: Uint8Array;
      try {
        plaintext = concatBytes(decipher.update(ciphertext), decipher.final());
      } catch {
        invalid("record_invalid");
      }
      if (
        plaintext.byteLength !== audit.byteLength ||
        sha256(plaintext) !== audit.contentSha256
      )
        invalid("record_invalid");
      return copyBytes(plaintext);
    } finally {
      key.fill(0);
    }
  }

  async #requireAudit(payloadId: string): Promise<PersistedAudit> {
    const current = await this.#loadCurrentIfAny();
    if (current === undefined || current.payloadId !== payloadId)
      invalid("payload_unavailable");
    return current;
  }

  async #loadAudit(payloadId: string): Promise<PersistedAudit> {
    const recordDirectory = this.#recordDirectory(payloadId);
    await requireExactDirectory(recordDirectory, "record_invalid");
    const entries = await readdir(recordDirectory, { withFileTypes: true });
    const names = entries.map((entry) => entry.name).sort();
    if (
      JSON.stringify(names) !==
      JSON.stringify([AUDIT_DOMAIN_DIRECTORY, PAYLOAD_DOMAIN_DIRECTORY])
    )
      invalid("record_invalid");
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink())
        invalid("record_invalid");
      await requireExactDirectory(
        join(recordDirectory, entry.name),
        "record_invalid",
      );
    }
    const auditDirectory = join(recordDirectory, AUDIT_DOMAIN_DIRECTORY);
    const payloadDirectory = join(recordDirectory, PAYLOAD_DOMAIN_DIRECTORY);
    const auditNames = (await readdir(auditDirectory)).sort();
    const payloadNames = (await readdir(payloadDirectory)).sort();
    const unavailable = auditNames.includes(UNAVAILABLE_AUDIT);
    if (
      (!unavailable &&
        (JSON.stringify(auditNames) !== JSON.stringify([AVAILABLE_AUDIT]) ||
          JSON.stringify(payloadNames) !==
            JSON.stringify([CIPHERTEXT_FILE]))) ||
      (unavailable &&
        JSON.stringify(auditNames) !==
          JSON.stringify([AVAILABLE_AUDIT, UNAVAILABLE_AUDIT].sort())) ||
      (unavailable &&
        JSON.stringify(payloadNames) !== JSON.stringify([]) &&
        JSON.stringify(payloadNames) !== JSON.stringify([CIPHERTEXT_FILE]))
    )
      invalid("record_invalid");
    const availableAudit = parseAudit(
      await readBoundedRegularFile(
        join(auditDirectory, AVAILABLE_AUDIT),
        FILING_PAYLOAD_CUSTODY_LIMITS.auditBytes,
      ),
    );
    if (
      availableAudit.payloadId !== payloadId ||
      availableAudit.state !== "available"
    )
      invalid("record_invalid");
    if (!unavailable) {
      await requireRegularFile(
        join(payloadDirectory, CIPHERTEXT_FILE),
        FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength,
        true,
      );
      return availableAudit;
    }
    const unavailableAudit = parseAudit(
      await readBoundedRegularFile(
        join(auditDirectory, UNAVAILABLE_AUDIT),
        FILING_PAYLOAD_CUSTODY_LIMITS.auditBytes,
      ),
    );
    if (
      unavailableAudit.payloadId !== payloadId ||
      unavailableAudit.state !== "logical_key_unavailability" ||
      unavailableAudit.transitionedAt === null ||
      Date.parse(unavailableAudit.transitionedAt) <
        Date.parse(unavailableAudit.payloadExpiresAt) ||
      canonicalJson(unavailableAudit) !==
        canonicalJson({
          ...availableAudit,
          state: "logical_key_unavailability",
          transitionedAt: unavailableAudit.transitionedAt,
          version: 2,
        })
    )
      invalid("record_invalid");
    if (payloadNames.length === 1) {
      await requireRegularFile(
        join(payloadDirectory, CIPHERTEXT_FILE),
        FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength,
        true,
      );
    }
    return unavailableAudit;
  }

  async #readCiphertext(audit: PersistedAudit): Promise<Uint8Array> {
    const path = join(
      this.#recordDirectory(audit.payloadId),
      PAYLOAD_DOMAIN_DIRECTORY,
      CIPHERTEXT_FILE,
    );
    const ciphertext = await readBoundedRegularFile(
      path,
      FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength,
      true,
    );
    if (sha256(ciphertext) !== audit.ciphertextSha256)
      invalid("record_invalid");
    return ciphertext;
  }

  #recordDirectory(payloadId: string): string {
    if (!PAYLOAD_ID.test(payloadId)) invalid("invalid_input");
    const path = resolve(this.#recordsDirectory, payloadId);
    requireContained(this.#recordsDirectory, path);
    return path;
  }

  #now(): Date {
    try {
      const value = this.#clock.now();
      if (
        typeof value !== "object" ||
        value === null ||
        Object.getPrototypeOf(value) !== Date.prototype ||
        !Number.isFinite(value.getTime()) ||
        (this.#lastNowMilliseconds !== undefined &&
          value.getTime() < this.#lastNowMilliseconds)
      )
        invalid("invalid_input");
      this.#lastNowMilliseconds = value.getTime();
      return new Date(value.getTime());
    } catch (error) {
      rethrowBoundary(error, "invalid_input");
    }
  }

  #randomBytes(length: number): Uint8Array {
    let value: Uint8Array;
    try {
      value = this.#entropy.bytes(length);
    } catch {
      invalid("invalid_input");
    }
    return snapshotBytes(value, length);
  }

  async #phase(phase: FilingPayloadCustodyFaultPhase): Promise<void> {
    await this.#hooks.afterPhase?.(phase);
  }

  #assertOpen(): void {
    if (this.#closed) invalid("closed");
  }

  #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const guarded = async (): Promise<T> => {
      try {
        return await operation();
      } catch (error) {
        rethrowBoundary(error, "io_failure");
      }
    };
    const result = this.#tail.then(guarded, guarded);
    this.#tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function normalizeStageCommand(command: FilingPayloadStageCommand): {
  contentSha256: typeof FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256;
  fixtureId: typeof FILING_PAYLOAD_CUSTODY_FIXTURE.fixtureId;
  payload: Uint8Array;
  retentionClass: typeof FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.class;
  sourceBindingSha256: Sha256;
} {
  const values = exactDataObject(command, [
    "contentSha256",
    "fixtureId",
    "payload",
    "retentionClass",
    "sourceBindingSha256",
  ]);
  if (
    values.contentSha256 !== FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256 ||
    values.fixtureId !== FILING_PAYLOAD_CUSTODY_FIXTURE.fixtureId ||
    values.retentionClass !== FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.class ||
    typeof values.sourceBindingSha256 !== "string" ||
    !HASH.test(values.sourceBindingSha256)
  )
    invalid("invalid_input");
  const payload = snapshotBytes(
    values.payload as Uint8Array,
    FILING_PAYLOAD_CUSTODY_LIMITS.payloadBytes,
    false,
  );
  if (payload.byteLength !== FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength)
    invalid("invalid_input");
  if (sha256(payload) !== values.contentSha256) invalid("hash_mismatch");
  return Object.freeze({
    contentSha256: values.contentSha256,
    fixtureId: values.fixtureId,
    payload,
    retentionClass: values.retentionClass,
    sourceBindingSha256: values.sourceBindingSha256 as Sha256,
  });
}

function normalizePayloadCommand(
  command:
    | FilingPayloadReadCommand
    | FilingPayloadExpireCommand
    | FilingPayloadAuditCommand,
): string {
  const values = exactDataObject(command, ["payloadId"]);
  if (
    typeof values.payloadId !== "string" ||
    !PAYLOAD_ID.test(values.payloadId)
  )
    invalid("invalid_input");
  return values.payloadId;
}

function normalizeOptions(
  options: FilingPayloadCustodyOptions,
): NormalizedOptions {
  const values = exactDataObject(options, [
    "clock",
    "entropy",
    "keyStore",
    "workspaceParentDirectory",
  ]);
  const clock = exactFunctionObject(values.clock, ["now"]);
  const entropy = exactFunctionObject(values.entropy, ["bytes"]);
  const keyStore = exactFunctionObject(values.keyStore, [
    "forget",
    "putIfAbsent",
    "read",
  ]);
  if (
    typeof values.workspaceParentDirectory !== "string" ||
    !isAbsolute(values.workspaceParentDirectory) ||
    values.workspaceParentDirectory.includes("\u0000") ||
    /[\r\n]/u.test(values.workspaceParentDirectory)
  )
    invalid("invalid_input");
  const clockNow = clock.now as FilingPayloadCustodyClock["now"];
  const entropyBytes = entropy.bytes as FilingPayloadCustodyEntropy["bytes"];
  const keyForget = keyStore.forget as FilingPayloadKeyStore["forget"];
  const keyPutIfAbsent =
    keyStore.putIfAbsent as FilingPayloadKeyStore["putIfAbsent"];
  const keyRead = keyStore.read as FilingPayloadKeyStore["read"];
  return Object.freeze({
    clock: Object.freeze({ now: (): Date => clockNow() }),
    entropy: Object.freeze({
      bytes: (length: number): Uint8Array => entropyBytes(length),
    }),
    keyStore: Object.freeze({
      forget: (keyId: string) => keyForget(keyId),
      putIfAbsent: (keyId: string, key: Uint8Array) =>
        keyPutIfAbsent(keyId, key),
      read: (keyId: string) => keyRead(keyId),
    }),
    workspaceParentDirectory: resolve(values.workspaceParentDirectory),
  });
}

function normalizeHooks(hooks: TestHooks): TestHooks {
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(hooks);
  } catch {
    invalid("invalid_input");
  }
  const values = exactDataObject(
    hooks,
    keys.length === 0 ? ([] as const) : (["afterPhase"] as const),
  );
  const afterPhase = "afterPhase" in values ? values.afterPhase : undefined;
  if (afterPhase !== undefined && typeof afterPhase !== "function")
    invalid("invalid_input");
  const capturedAfterPhase = afterPhase as TestHooks["afterPhase"];
  return afterPhase === undefined
    ? Object.freeze({})
    : Object.freeze({
        afterPhase: (phase: FilingPayloadCustodyFaultPhase) =>
          capturedAfterPhase?.(phase),
      });
}

function aadRecord(input: {
  byteLength: number;
  contentSha256: Sha256;
  createdAt: string;
  keyId: string;
  payloadExpiresAt: string;
  payloadId: string;
  sourceBindingSha256: Sha256;
}): Record<string, unknown> {
  return Object.freeze({
    algorithm: FILING_PAYLOAD_CUSTODY_ALGORITHM.name,
    byteLength: input.byteLength,
    claim: FILING_PAYLOAD_CUSTODY_CLAIM,
    contentSha256: input.contentSha256,
    createdAt: input.createdAt,
    fixtureId: FILING_PAYLOAD_CUSTODY_FIXTURE.fixtureId,
    keyBytes: FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes,
    keyId: input.keyId,
    nonceBytes: FILING_PAYLOAD_CUSTODY_ALGORITHM.nonceBytes,
    payloadExpiresAt: input.payloadExpiresAt,
    payloadId: input.payloadId,
    retentionClass: FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.class,
    schemaVersion: FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION,
    sourceBindingSha256: input.sourceBindingSha256,
    tagBytes: FILING_PAYLOAD_CUSTODY_ALGORITHM.tagBytes,
  });
}

function receipt(audit: PersistedAudit): FilingPayloadCustodyReceipt {
  return Object.freeze({
    algorithm: audit.algorithm,
    byteLength: audit.byteLength,
    claim: audit.claim,
    contentSha256: audit.contentSha256,
    createdAt: audit.createdAt,
    fixtureId: audit.fixtureId,
    payloadExpiresAt: audit.payloadExpiresAt,
    payloadId: audit.payloadId,
    retentionClass: audit.retentionClass,
    schemaVersion: audit.schemaVersion,
    sourceBindingSha256: audit.sourceBindingSha256,
    state: audit.state,
    transitionedAt: audit.transitionedAt,
    version: audit.version,
  });
}

function publicAudit(audit: PersistedAudit): FilingPayloadAuditRecord {
  return Object.freeze({
    ...receipt(audit),
    aadSha256: audit.aadSha256,
    ciphertextSha256: audit.ciphertextSha256,
  });
}

function parseAudit(bytes: Uint8Array): PersistedAudit {
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > FILING_PAYLOAD_CUSTODY_LIMITS.auditBytes
  )
    invalid("record_invalid");
  let text: string;
  let value: unknown;
  try {
    text = textDecoder.decode(bytes);
    value = JSON.parse(text);
  } catch {
    invalid("record_invalid");
  }
  const keys = [
    "aadSha256",
    "algorithm",
    "authTag",
    "byteLength",
    "ciphertextSha256",
    "claim",
    "contentSha256",
    "createdAt",
    "fixtureId",
    "keyId",
    "nonce",
    "payloadExpiresAt",
    "payloadId",
    "retentionClass",
    "schemaVersion",
    "sourceBindingSha256",
    "state",
    "transitionedAt",
    "version",
  ] as const;
  const record = exactDataObject(value, keys, "record_invalid");
  if (text !== `${canonicalJson(record)}\n`) invalid("record_invalid");
  if (
    record.schemaVersion !== FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION ||
    record.claim !== FILING_PAYLOAD_CUSTODY_CLAIM ||
    record.algorithm !== FILING_PAYLOAD_CUSTODY_ALGORITHM.name ||
    record.fixtureId !== FILING_PAYLOAD_CUSTODY_FIXTURE.fixtureId ||
    record.retentionClass !== FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.class ||
    typeof record.byteLength !== "number" ||
    !Number.isSafeInteger(record.byteLength) ||
    record.byteLength !== FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength ||
    typeof record.payloadId !== "string" ||
    !PAYLOAD_ID.test(record.payloadId) ||
    typeof record.keyId !== "string" ||
    !KEY_ID.test(record.keyId) ||
    typeof record.contentSha256 !== "string" ||
    record.contentSha256 !== FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256 ||
    typeof record.sourceBindingSha256 !== "string" ||
    !HASH.test(record.sourceBindingSha256) ||
    typeof record.aadSha256 !== "string" ||
    !HASH.test(record.aadSha256) ||
    typeof record.ciphertextSha256 !== "string" ||
    !HASH.test(record.ciphertextSha256) ||
    typeof record.createdAt !== "string" ||
    !isCanonicalIsoUtc(record.createdAt) ||
    typeof record.payloadExpiresAt !== "string" ||
    !isCanonicalIsoUtc(record.payloadExpiresAt) ||
    Date.parse(record.payloadExpiresAt) - Date.parse(record.createdAt) !==
      FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.payloadMilliseconds ||
    typeof record.nonce !== "string" ||
    typeof record.authTag !== "string" ||
    (record.state !== "available" &&
      record.state !== "logical_key_unavailability") ||
    (record.state === "available" &&
      (record.version !== 1 || record.transitionedAt !== null)) ||
    (record.state === "logical_key_unavailability" &&
      (record.version !== 2 ||
        typeof record.transitionedAt !== "string" ||
        !isCanonicalIsoUtc(record.transitionedAt)))
  )
    invalid("record_invalid");
  decodeBase64url(record.nonce, FILING_PAYLOAD_CUSTODY_ALGORITHM.nonceBytes);
  decodeBase64url(record.authTag, FILING_PAYLOAD_CUSTODY_ALGORITHM.tagBytes);
  return Object.freeze(record as unknown as PersistedAudit);
}

async function writeExclusiveAndSync(
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(path, 0o600);
}

async function requireExactDirectory(
  path: string,
  code: FilingPayloadCustodyErrorCode,
): Promise<void> {
  try {
    const metadata = await lstat(path);
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      (sep === "/" && (metadata.mode & 0o777) !== 0o700)
    )
      invalid(code);
    const actualPath = resolve(await realpath(path));
    if (relative(resolve(path), actualPath) !== "") invalid(code);
  } catch (error) {
    rethrowBoundary(error, code);
  }
}

async function requireRegularFile(
  path: string,
  maximumBytes: number,
  exactBytes = false,
): Promise<void> {
  try {
    const metadata = await lstat(path);
    requireRegularFileMetadata(metadata, maximumBytes, exactBytes);
  } catch (error) {
    rethrowBoundary(error, "record_invalid");
  }
}

function requireRegularFileMetadata(
  metadata: Stats,
  maximumBytes: number,
  exactBytes: boolean,
): void {
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.nlink !== 1 ||
    metadata.size <= 0 ||
    (sep === "/" && (metadata.mode & 0o777) !== 0o600) ||
    (exactBytes ? metadata.size !== maximumBytes : metadata.size > maximumBytes)
  )
    invalid("record_invalid");
}

async function readBoundedRegularFile(
  path: string,
  maximumBytes: number,
  exactBytes = false,
): Promise<Uint8Array> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let result: Uint8Array | undefined;
  try {
    const pathMetadata = await lstat(path);
    requireRegularFileMetadata(pathMetadata, maximumBytes, exactBytes);
    handle = await open(path, "r");
    const openedMetadata = await handle.stat();
    requireRegularFileMetadata(openedMetadata, maximumBytes, exactBytes);
    if (
      openedMetadata.dev !== pathMetadata.dev ||
      openedMetadata.ino !== pathMetadata.ino ||
      openedMetadata.size !== pathMetadata.size
    )
      invalid("record_invalid");
    const storage = Buffer.alloc(maximumBytes + 1);
    let byteLength = 0;
    while (byteLength < storage.byteLength) {
      const { bytesRead } = await handle.read(
        storage,
        byteLength,
        storage.byteLength - byteLength,
        byteLength,
      );
      if (bytesRead === 0) break;
      byteLength += bytesRead;
    }
    const finalMetadata = await handle.stat();
    if (
      finalMetadata.dev !== openedMetadata.dev ||
      finalMetadata.ino !== openedMetadata.ino ||
      finalMetadata.size !== openedMetadata.size ||
      byteLength !== openedMetadata.size ||
      byteLength > maximumBytes ||
      (exactBytes && byteLength !== maximumBytes)
    )
      invalid("record_invalid");
    result = copyBytes(storage.subarray(0, byteLength));
  } catch (error) {
    rethrowBoundary(error, "record_invalid");
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch {
        invalid("record_invalid");
      }
    }
  }
  if (result === undefined) invalid("record_invalid");
  return result;
}

function requireContained(parent: string, child: string): void {
  const normalizedParent = resolve(parent);
  const normalizedChild = resolve(child);
  const pathFromParent = relative(normalizedParent, normalizedChild);
  if (
    pathFromParent === "" ||
    pathFromParent === ".." ||
    pathFromParent.startsWith(`..${sep}`) ||
    isAbsolute(pathFromParent)
  )
    invalid("invalid_input");
}

function exactFunctionObject<TKeys extends string>(
  value: unknown,
  keys: readonly TKeys[],
): Readonly<Record<TKeys, unknown>> {
  const record = exactDataObject(value, keys);
  if (keys.some((key) => typeof record[key] !== "function"))
    invalid("invalid_input");
  return record;
}

function exactDataObject<TKeys extends string>(
  value: unknown,
  keys: readonly TKeys[],
  code: FilingPayloadCustodyErrorCode = "invalid_input",
): Readonly<Record<TKeys, unknown>> {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null)
    )
      invalid(code);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.some((key) => typeof key !== "string") ||
      JSON.stringify([...ownKeys].sort()) !== JSON.stringify([...keys].sort())
    )
      invalid(code);
    const snapshot = Object.create(null) as Record<TKeys, unknown>;
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined
      )
        invalid(code);
      snapshot[key] = descriptor.value as unknown;
    }
    return Object.freeze(snapshot);
  } catch (error) {
    rethrowBoundary(error, code);
  }
}

function snapshotBytes(
  value: Uint8Array,
  limit: number,
  exactLength = true,
): Uint8Array {
  try {
    if (typeof value !== "object" || value === null) invalid("invalid_input");
    const bytes = value;
    const tag = TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR?.get?.call(bytes) as unknown;
    const length = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const backingByteLength = ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      buffer,
    ) as unknown;
    if (
      tag !== "Uint8Array" ||
      typeof length !== "number" ||
      typeof backingByteLength !== "number" ||
      Object.getPrototypeOf(bytes) !== Uint8Array.prototype ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype ||
      length <= 0 ||
      (exactLength ? length !== limit : length > limit)
    ) {
      invalid("invalid_input");
    }
    const snapshot = new Uint8Array(length);
    Uint8Array.prototype.set.call(snapshot, bytes);
    return snapshot;
  } catch (error) {
    rethrowBoundary(error, "invalid_input");
  }
}

function copyBytes(value: Uint8Array): Uint8Array {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

function equalBytes(first: Uint8Array, second: Uint8Array): boolean {
  if (first.byteLength !== second.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < first.byteLength; index += 1) {
    difference |= (first[index] ?? 0) ^ (second[index] ?? 0);
  }
  return difference === 0;
}

function concatBytes(first: Uint8Array, second: Uint8Array): Uint8Array {
  const result = new Uint8Array(first.byteLength + second.byteLength);
  result.set(first, 0);
  result.set(second, first.byteLength);
  return result;
}

function sha256(value: Uint8Array): Sha256 {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function hex(value: Uint8Array): string {
  return Buffer.from(value).toString("hex");
}

function base64url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64url(value: string, length: number): Uint8Array {
  if (!BASE64URL.test(value)) invalid("record_invalid");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength !== length || decoded.toString("base64url") !== value)
    invalid("record_invalid");
  return copyBytes(decoded);
}

function canonicalJson(value: unknown): string {
  const budget = { nodes: 0 };
  return canonicalJsonValue(value, 0, budget);
}

function canonicalJsonValue(
  value: unknown,
  depth: number,
  budget: { nodes: number },
): string {
  budget.nodes += 1;
  if (depth > 16 || budget.nodes > 128) invalid("record_invalid");
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) invalid("record_invalid");
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return `[${value
      .map((entry) => canonicalJsonValue(entry, depth + 1, budget))
      .join(",")}]`;
  if (typeof value !== "object" || value === null) invalid("record_invalid");
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJsonValue(record[key], depth + 1, budget)}`,
    )
    .join(",")}}`;
}

function isCanonicalIsoUtc(value: string): boolean {
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}

function isFileSystemCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function rethrowBoundary(
  error: unknown,
  fallback: FilingPayloadCustodyErrorCode,
): never {
  if (error instanceof FilingPayloadCustodyError) throw error;
  invalid(fallback);
}

function invalid(code: FilingPayloadCustodyErrorCode): never {
  throw new FilingPayloadCustodyError(code);
}
