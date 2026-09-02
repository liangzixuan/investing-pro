import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  canonicalizeJson,
  parseCanonicalJson,
  sha256Hex,
} from "./canonical-json";
import { LocalResearchVaultError, vaultError } from "./errors";
import {
  LOCAL_RESEARCH_RECORD_KINDS,
  LOCAL_RESEARCH_VAULT_PROFILE,
  type DeleteLocalResearchRecordCommand,
  type JsonValue,
  type LocalResearchAttachment,
  type LocalResearchMutationReceipt,
  type LocalResearchRecord,
  type LocalResearchRecordKind,
  type LocalResearchRecordSummary,
  type LocalResearchVaultInventory,
  type PutLocalResearchAttachmentCommand,
  type PutLocalResearchRecordCommand,
} from "./model";
import {
  configureLocalResearchVaultDatabase,
  initializeLocalResearchVaultSchema,
  installLocalResearchVaultAuthorizer,
  LOCAL_RESEARCH_VAULT_SCHEMA_VERSION,
  migrateLocalResearchVaultSchema,
  rollbackOrClose,
  verifyLocalResearchVaultSchema,
} from "./vault-schema";
import {
  localVaultAttachmentAad,
  localVaultRecordAad,
  LocalVaultCryptography,
  type EncryptedValue,
} from "./vault-crypto";

const RECORD_KIND_SET = new Set<string>(LOCAL_RESEARCH_RECORD_KINDS);
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const MEDIA_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,63}$/u;
const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;
const MAX_RECORDS_PER_KIND = 10_000;
const MAX_TOTAL_RECORDS =
  MAX_RECORDS_PER_KIND * LOCAL_RESEARCH_RECORD_KINDS.length;
const MAX_ATTACHMENTS = 10_000;
const MAX_LEDGER_ENTRIES = 100_000;

type Clock = () => Date;

interface RecordRow {
  readonly kind: LocalResearchRecordKind;
  readonly id: string;
  readonly version: number;
  readonly nonce: Buffer;
  readonly ciphertext: Buffer;
  readonly tag: Buffer;
  readonly payloadSha256: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface AttachmentRow {
  readonly attachmentId: string;
  readonly recordKind: LocalResearchRecordKind;
  readonly recordId: string;
  readonly recordVersion: number;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly nonce: Buffer;
  readonly ciphertext: Buffer;
  readonly tag: Buffer;
  readonly contentSha256: string;
  readonly createdAt: string;
}

type AuditAction =
  "attachment_added" | "record_created" | "record_deleted" | "record_updated";

interface AuditRow {
  readonly sequence: number;
  readonly occurredAt: string;
  readonly action: AuditAction;
  readonly recordKind: LocalResearchRecordKind;
  readonly recordId: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly requestSha256: string;
  readonly resultSha256: string;
  readonly attachmentId?: string;
}

interface IdempotencyRow {
  readonly idempotencyKey: string;
  readonly requestSha256: string;
  readonly operation: "delete" | "put" | "put_attachment";
  readonly recordKind: LocalResearchRecordKind;
  readonly recordId: string;
  readonly resultingVersion: number;
  readonly resultSha256: string;
  readonly attachmentId?: string;
  readonly committedAt: string;
}

interface TombstoneRow {
  readonly kind: LocalResearchRecordKind;
  readonly recordId: string;
  readonly deletedVersion: number;
  readonly priorPayloadSha256: string;
  readonly deletedAt: string;
}

/**
 * The SQLite adapter is intentionally not exported from the package root.
 * Callers receive it only after the startup path boundary has been verified.
 */
export class SqliteLocalResearchVault {
  readonly #db: DatabaseSync;
  readonly #cryptography: LocalVaultCryptography;
  readonly #clock: Clock;
  #closed = false;
  #backupInProgress = false;

  private constructor(
    databasePath: string,
    masterKey: Uint8Array,
    initialize: boolean,
    clock: Clock,
  ) {
    this.#clock = clock;
    this.#cryptography = new LocalVaultCryptography(masterKey);
    this.#db = new DatabaseSync(databasePath, {
      allowBareNamedParameters: false,
      allowExtension: false,
      allowUnknownNamedParameters: false,
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
      open: true,
      readBigInts: false,
      readOnly: false,
      returnArrays: false,
      timeout: 5_000,
    });
    try {
      configureLocalResearchVaultDatabase(this.#db);
      if (initialize) {
        initializeLocalResearchVaultSchema(this.#db, this.#now());
      } else {
        migrateLocalResearchVaultSchema(this.#db, this.#now());
      }
      verifyLocalResearchVaultSchema(this.#db);
      this.#db.enableDefensive(true);
      installLocalResearchVaultAuthorizer(this.#db);
    } catch (error) {
      this.#cryptography.close();
      try {
        this.#db.close();
      } catch {
        // Initialization errors remain generic at the public boundary.
      }
      if (error instanceof LocalResearchVaultError) throw error;
      throw vaultError("VAULT_CORRUPT", error);
    }
  }

  static createNew(
    databasePath: string,
    masterKey: Uint8Array,
    clock: Clock = () => new Date(),
  ): SqliteLocalResearchVault {
    return new SqliteLocalResearchVault(databasePath, masterKey, true, clock);
  }

  static openExisting(
    databasePath: string,
    masterKey: Uint8Array,
    clock: Clock = () => new Date(),
  ): SqliteLocalResearchVault {
    return new SqliteLocalResearchVault(databasePath, masterKey, false, clock);
  }

  getRecord(kind: LocalResearchRecordKind, id: string): LocalResearchRecord {
    this.#assertOpen();
    validateKind(kind);
    validateIdentifier(id);
    const row = this.#selectRecord(kind, id);
    if (row === undefined) {
      if (this.#isTombstoned(kind, id)) throw vaultError("VAULT_DELETED");
      throw vaultError("VAULT_NOT_FOUND");
    }
    return this.#decryptRecord(row);
  }

  listRecords(kind: LocalResearchRecordKind): readonly LocalResearchRecord[] {
    this.#assertOpen();
    validateKind(kind);
    const rows = this.#db
      .prepare(
        `SELECT kind, record_id, version, payload_nonce, payload_ciphertext,
                payload_tag, payload_sha256, created_at, updated_at
           FROM vault_records WHERE kind = ? ORDER BY record_id LIMIT ?`,
      )
      .all(kind, MAX_RECORDS_PER_KIND + 1);
    if (rows.length > MAX_RECORDS_PER_KIND) throw vaultError("VAULT_CORRUPT");
    return rows.map((row) => this.#decryptRecord(asRecordRow(row)));
  }

  putRecord(
    command: PutLocalResearchRecordCommand,
  ): LocalResearchMutationReceipt {
    this.#assertOpen();
    validateKind(command.kind);
    validateIdentifier(command.id);
    validateExpectedVersion(command.expectedVersion, true);
    validateIdempotencyKey(command.idempotencyKey);
    const canonicalPayload = canonicalizeJson(command.payload);
    const payloadSha256 = sha256Hex(canonicalPayload);
    const requestSha256 = hashRequest({
      expectedVersion: command.expectedVersion,
      id: command.id,
      kind: command.kind,
      operation: "put",
      payloadSha256,
    });
    const committedAt = this.#now();

    this.#begin();
    try {
      const replay = this.#readReplay(command.idempotencyKey, requestSha256);
      if (replay !== undefined) {
        this.#db.exec("COMMIT");
        return { ...replay, replayed: true };
      }
      this.#assertCommitTimestamp(committedAt);
      this.#assertLedgerCapacity();
      if (this.#isTombstoned(command.kind, command.id)) {
        throw vaultError("VAULT_DELETED");
      }
      const existing = this.#selectRecord(command.kind, command.id);
      if (command.expectedVersion === 0) {
        if (existing !== undefined) throw vaultError("VAULT_CONFLICT");
        if (this.#recordIdHasAudit(command.kind, command.id)) {
          throw vaultError("VAULT_CORRUPT");
        }
      } else if (
        existing === undefined ||
        existing.version !== command.expectedVersion
      ) {
        throw vaultError("VAULT_CONFLICT");
      }
      if (existing === undefined) {
        const count = this.#recordCount(command.kind);
        if (count > MAX_RECORDS_PER_KIND) throw vaultError("VAULT_CORRUPT");
        if (count === MAX_RECORDS_PER_KIND) {
          throw vaultError("VAULT_CONFLICT");
        }
      }
      const version = command.expectedVersion + 1;
      const createdAt = existing?.createdAt ?? committedAt;
      const encrypted = this.#cryptography.encryptRecord(
        Buffer.from(canonicalPayload, "utf8"),
        localVaultRecordAad(
          command.kind,
          command.id,
          version,
          payloadSha256,
          createdAt,
          committedAt,
        ),
      );
      const changed =
        existing === undefined
          ? this.#insertRecord(
              command.kind,
              command.id,
              version,
              encrypted,
              payloadSha256,
              createdAt,
              committedAt,
            )
          : this.#updateRecord(
              command.kind,
              command.id,
              command.expectedVersion,
              version,
              encrypted,
              payloadSha256,
              committedAt,
            );
      if (changed !== 1) throw vaultError("VAULT_CONFLICT");
      const receipt: LocalResearchMutationReceipt = {
        profile: LOCAL_RESEARCH_VAULT_PROFILE,
        operation: "put",
        kind: command.kind,
        id: command.id,
        version,
        digestSha256: payloadSha256,
        committedAt,
        replayed: false,
      };
      this.#writeIdempotency(command.idempotencyKey, requestSha256, receipt);
      this.#writeAudit(
        existing === undefined ? "record_created" : "record_updated",
        receipt,
        command.expectedVersion,
        requestSha256,
      );
      this.#db.exec("COMMIT");
      return receipt;
    } catch (error) {
      return rollbackOrClose(this.#db, error);
    }
  }

  deleteRecord(
    command: DeleteLocalResearchRecordCommand,
  ): LocalResearchMutationReceipt {
    this.#assertOpen();
    validateKind(command.kind);
    validateIdentifier(command.id);
    validateExpectedVersion(command.expectedVersion, false);
    validateIdempotencyKey(command.idempotencyKey);
    const requestSha256 = hashRequest({
      expectedVersion: command.expectedVersion,
      id: command.id,
      kind: command.kind,
      operation: "delete",
    });
    const committedAt = this.#now();

    this.#begin();
    try {
      const replay = this.#readReplay(command.idempotencyKey, requestSha256);
      if (replay !== undefined) {
        this.#db.exec("COMMIT");
        return { ...replay, replayed: true };
      }
      this.#assertCommitTimestamp(committedAt);
      this.#assertLedgerCapacity();
      const existing = this.#selectRecord(command.kind, command.id);
      if (
        existing === undefined ||
        existing.version !== command.expectedVersion
      ) {
        throw vaultError("VAULT_CONFLICT");
      }
      const deletionVersion = existing.version + 1;
      const changed = this.#db
        .prepare(
          "DELETE FROM vault_records WHERE kind = ? AND record_id = ? AND version = ?",
        )
        .run(command.kind, command.id, command.expectedVersion).changes;
      if (Number(changed) !== 1) throw vaultError("VAULT_CONFLICT");
      this.#db
        .prepare(
          `INSERT INTO vault_tombstones(
             kind, record_id, deleted_version, prior_payload_sha256, deleted_at
           ) VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          command.kind,
          command.id,
          deletionVersion,
          existing.payloadSha256,
          committedAt,
        );
      const receipt: LocalResearchMutationReceipt = {
        profile: LOCAL_RESEARCH_VAULT_PROFILE,
        operation: "delete",
        kind: command.kind,
        id: command.id,
        version: deletionVersion,
        digestSha256: existing.payloadSha256,
        committedAt,
        replayed: false,
      };
      this.#writeIdempotency(command.idempotencyKey, requestSha256, receipt);
      this.#writeAudit(
        "record_deleted",
        receipt,
        command.expectedVersion,
        requestSha256,
      );
      this.#db.exec("COMMIT");
      return receipt;
    } catch (error) {
      return rollbackOrClose(this.#db, error);
    }
  }

  putAttachment(
    command: PutLocalResearchAttachmentCommand,
  ): LocalResearchMutationReceipt {
    this.#assertOpen();
    validateIdentifier(command.attachmentId);
    validateKind(command.recordKind);
    validateIdentifier(command.recordId);
    validateExpectedVersion(command.expectedRecordVersion, false);
    validateIdempotencyKey(command.idempotencyKey);
    validateMediaType(command.mediaType);
    if (
      !(command.bytes instanceof Uint8Array) ||
      command.bytes.byteLength > MAX_ATTACHMENT_BYTES
    ) {
      throw vaultError("VAULT_INVALID_INPUT");
    }
    const sourceByteLength = command.bytes.byteLength;
    const bytes = Buffer.from(command.bytes);
    if (bytes.byteLength !== sourceByteLength) {
      throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
    }
    const contentSha256 = sha256Hex(bytes);
    const requestSha256 = hashRequest({
      attachmentId: command.attachmentId,
      byteLength: bytes.byteLength,
      contentSha256,
      expectedRecordVersion: command.expectedRecordVersion,
      mediaType: command.mediaType,
      operation: "put_attachment",
      recordId: command.recordId,
      recordKind: command.recordKind,
    });
    const committedAt = this.#now();

    this.#begin();
    try {
      const replay = this.#readReplay(command.idempotencyKey, requestSha256);
      if (replay !== undefined) {
        this.#db.exec("COMMIT");
        return { ...replay, replayed: true };
      }
      this.#assertCommitTimestamp(committedAt);
      this.#assertLedgerCapacity();
      const record = this.#selectRecord(command.recordKind, command.recordId);
      if (record?.version !== command.expectedRecordVersion) {
        throw vaultError("VAULT_CONFLICT");
      }
      if (this.#attachmentIdWasUsed(command.attachmentId)) {
        throw vaultError("VAULT_CONFLICT");
      }
      const attachmentCount = this.#attachmentCount();
      if (attachmentCount > MAX_ATTACHMENTS) throw vaultError("VAULT_CORRUPT");
      if (attachmentCount === MAX_ATTACHMENTS) {
        throw vaultError("VAULT_CONFLICT");
      }
      const encrypted = this.#cryptography.encryptAttachment(
        bytes,
        localVaultAttachmentAad(
          command.attachmentId,
          command.recordKind,
          command.recordId,
          command.expectedRecordVersion,
          command.mediaType,
          bytes.byteLength,
          contentSha256,
          committedAt,
        ),
      );
      this.#db
        .prepare(
          `INSERT INTO vault_attachments(
             attachment_id, record_kind, record_id, record_version, media_type,
             byte_length, content_nonce, content_ciphertext, content_tag,
             content_sha256, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          command.attachmentId,
          command.recordKind,
          command.recordId,
          command.expectedRecordVersion,
          command.mediaType,
          bytes.byteLength,
          encrypted.nonce,
          encrypted.ciphertext,
          encrypted.tag,
          contentSha256,
          committedAt,
        );
      const receipt: LocalResearchMutationReceipt = {
        profile: LOCAL_RESEARCH_VAULT_PROFILE,
        operation: "put_attachment",
        kind: command.recordKind,
        id: command.recordId,
        version: command.expectedRecordVersion,
        digestSha256: contentSha256,
        committedAt,
        replayed: false,
        attachmentId: command.attachmentId,
      };
      this.#writeIdempotency(command.idempotencyKey, requestSha256, receipt);
      this.#writeAudit(
        "attachment_added",
        receipt,
        command.expectedRecordVersion,
        requestSha256,
      );
      this.#db.exec("COMMIT");
      return receipt;
    } catch (error) {
      return rollbackOrClose(this.#db, error);
    }
  }

  getAttachment(attachmentId: string): LocalResearchAttachment {
    this.#assertOpen();
    validateIdentifier(attachmentId);
    const raw = this.#db
      .prepare(
        `SELECT attachment_id, record_kind, record_id, record_version,
                media_type, byte_length, content_nonce, content_ciphertext,
                content_tag, content_sha256, created_at
           FROM vault_attachments WHERE attachment_id = ?`,
      )
      .get(attachmentId);
    if (raw === undefined) throw vaultError("VAULT_NOT_FOUND");
    return this.#decryptAttachment(asAttachmentRow(raw));
  }

  inventory(): LocalResearchVaultInventory {
    this.#assertOpen();
    const recordRows = this.#db
      .prepare(
        `SELECT kind, record_id, version, payload_nonce, payload_ciphertext,
                payload_tag, payload_sha256, created_at, updated_at
           FROM vault_records ORDER BY kind, record_id LIMIT ?`,
      )
      .all(MAX_TOTAL_RECORDS + 1)
      .map(asRecordRow);
    const attachmentRows = this.#db
      .prepare(
        `SELECT attachment_id, record_kind, record_id, record_version,
                media_type, byte_length, content_nonce, content_ciphertext,
                content_tag, content_sha256, created_at
           FROM vault_attachments ORDER BY attachment_id LIMIT ?`,
      )
      .all(MAX_ATTACHMENTS + 1)
      .map(asAttachmentRow);
    if (
      recordRows.length > MAX_TOTAL_RECORDS ||
      attachmentRows.length > MAX_ATTACHMENTS
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
    const recordCounts = new Map<LocalResearchRecordKind, number>();
    for (const row of recordRows) {
      const count = (recordCounts.get(row.kind) ?? 0) + 1;
      if (count > MAX_RECORDS_PER_KIND) throw vaultError("VAULT_CORRUPT");
      recordCounts.set(row.kind, count);
    }
    for (const row of recordRows) this.#decryptRecord(row);
    for (const row of attachmentRows) this.#decryptAttachment(row);
    return {
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
      schemaVersion: LOCAL_RESEARCH_VAULT_SCHEMA_VERSION,
      records: recordRows.map(toSummary),
      attachments: attachmentRows.map((row) => ({
        attachmentId: row.attachmentId,
        recordKind: row.recordKind,
        recordId: row.recordId,
        recordVersion: row.recordVersion,
        mediaType: row.mediaType,
        byteLength: row.byteLength,
        contentSha256: row.contentSha256,
        createdAt: row.createdAt,
      })),
    };
  }

  verifyIntegrity(): LocalResearchVaultInventory {
    this.#assertOpen();
    verifyLocalResearchVaultSchema(this.#db);
    this.#verifyLedgerConsistency();
    return this.inventory();
  }

  close(): void {
    if (this.#closed) return;
    if (this.#backupInProgress) throw vaultError("VAULT_CONFLICT");
    this.#closed = true;
    this.#cryptography.close();
    try {
      if (this.#db.isTransaction) this.#db.exec("ROLLBACK");
    } finally {
      this.#db.close();
    }
  }

  /** Used only by the offline backup boundary in this package. */
  acquireBackupLease(): Readonly<{
    database: DatabaseSync;
    inventory: LocalResearchVaultInventory;
    release: () => void;
  }> {
    this.#assertOpen();
    if (this.#backupInProgress || this.#db.isTransaction) {
      throw vaultError("VAULT_CONFLICT");
    }
    this.#backupInProgress = true;
    try {
      const inventory = this.verifyIntegrity();
      let released = false;
      return {
        database: this.#db,
        inventory,
        release: () => {
          if (released) return;
          released = true;
          this.#backupInProgress = false;
        },
      };
    } catch (error) {
      this.#backupInProgress = false;
      throw error;
    }
  }

  #begin(): void {
    this.#assertOpen();
    if (this.#backupInProgress) throw vaultError("VAULT_CONFLICT");
    if (this.#db.isTransaction) throw vaultError("VAULT_CORRUPT");
    this.#db.exec("BEGIN IMMEDIATE");
  }

  #recordCount(kind: LocalResearchRecordKind): number {
    const count = this.#db
      .prepare("SELECT count(*) AS count FROM vault_records WHERE kind = ?")
      .get(kind)?.["count"];
    if (
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count < 0
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
    return count;
  }

  #attachmentCount(): number {
    const count = this.#db
      .prepare("SELECT count(*) AS count FROM vault_attachments")
      .get()?.["count"];
    if (
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count < 0
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
    return count;
  }

  #assertLedgerCapacity(): void {
    const auditCount = exactCount(
      this.#db.prepare("SELECT count(*) AS count FROM vault_audit").get()?.[
        "count"
      ],
    );
    const idempotencyCount = exactCount(
      this.#db
        .prepare("SELECT count(*) AS count FROM vault_idempotency")
        .get()?.["count"],
    );
    if (auditCount !== idempotencyCount || auditCount > MAX_LEDGER_ENTRIES) {
      throw vaultError("VAULT_CORRUPT");
    }
    if (auditCount === MAX_LEDGER_ENTRIES) {
      throw vaultError("VAULT_CONFLICT");
    }
  }

  #assertCommitTimestamp(committedAt: string): void {
    const prior = this.#db
      .prepare(
        "SELECT occurred_at FROM vault_audit ORDER BY sequence DESC LIMIT 1",
      )
      .get()?.["occurred_at"];
    if (
      prior !== undefined &&
      (!isCanonicalTimestamp(prior) || committedAt < prior)
    ) {
      throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
    }
  }

  #verifyLedgerConsistency(): void {
    const audits = this.#db
      .prepare(
        `SELECT sequence, occurred_at, action, record_kind, record_id,
                from_version, to_version, request_sha256, result_sha256,
                attachment_id
           FROM vault_audit ORDER BY sequence LIMIT ?`,
      )
      .all(MAX_LEDGER_ENTRIES + 1)
      .map(asAuditRow);
    const idempotency = this.#db
      .prepare(
        `SELECT idempotency_key, request_sha256, operation, record_kind,
                record_id, resulting_version, result_sha256, attachment_id,
                committed_at
           FROM vault_idempotency ORDER BY idempotency_key LIMIT ?`,
      )
      .all(MAX_LEDGER_ENTRIES + 1)
      .map(asIdempotencyRow);
    const tombstones = this.#db
      .prepare(
        `SELECT kind, record_id, deleted_version, prior_payload_sha256,
                deleted_at
           FROM vault_tombstones ORDER BY kind, record_id LIMIT ?`,
      )
      .all(MAX_TOTAL_RECORDS + 1)
      .map(asTombstoneRow);
    if (
      audits.length > MAX_LEDGER_ENTRIES ||
      idempotency.length > MAX_LEDGER_ENTRIES ||
      tombstones.length > MAX_TOTAL_RECORDS ||
      audits.length !== idempotency.length
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
    verifyLedgerRows(this.#db, audits, idempotency, tombstones);
  }

  #now(): string {
    const value = this.#clock();
    if (!(value instanceof Date) || !Number.isFinite(value.valueOf())) {
      throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
    }
    return value.toISOString();
  }

  #assertOpen(): void {
    if (this.#closed || !this.#db.isOpen) throw vaultError("VAULT_CLOSED");
  }

  #selectRecord(
    kind: LocalResearchRecordKind,
    id: string,
  ): RecordRow | undefined {
    const row = this.#db
      .prepare(
        `SELECT kind, record_id, version, payload_nonce, payload_ciphertext,
                payload_tag, payload_sha256, created_at, updated_at
           FROM vault_records WHERE kind = ? AND record_id = ?`,
      )
      .get(kind, id);
    return row === undefined ? undefined : asRecordRow(row);
  }

  #isTombstoned(kind: LocalResearchRecordKind, id: string): boolean {
    return (
      this.#db
        .prepare(
          "SELECT 1 AS present FROM vault_tombstones WHERE kind = ? AND record_id = ?",
        )
        .get(kind, id)?.["present"] === 1
    );
  }

  #recordIdHasAudit(kind: LocalResearchRecordKind, id: string): boolean {
    return (
      this.#db
        .prepare(
          `SELECT 1 AS present FROM vault_audit
            WHERE record_kind = ? AND record_id = ?
              AND action <> 'attachment_added' LIMIT 1`,
        )
        .get(kind, id)?.["present"] === 1
    );
  }

  #attachmentIdWasUsed(attachmentId: string): boolean {
    return (
      this.#db
        .prepare(
          `SELECT 1 AS present FROM vault_attachments WHERE attachment_id = ?
           UNION ALL
           SELECT 1 AS present FROM vault_audit WHERE attachment_id = ? LIMIT 1`,
        )
        .get(attachmentId, attachmentId)?.["present"] === 1
    );
  }

  #insertRecord(
    kind: LocalResearchRecordKind,
    id: string,
    version: number,
    encrypted: EncryptedValue,
    payloadSha256: string,
    createdAt: string,
    updatedAt: string,
  ): number {
    const result = this.#db
      .prepare(
        `INSERT INTO vault_records(
           kind, record_id, version, payload_nonce, payload_ciphertext,
           payload_tag, payload_sha256, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        kind,
        id,
        version,
        encrypted.nonce,
        encrypted.ciphertext,
        encrypted.tag,
        payloadSha256,
        createdAt,
        updatedAt,
      );
    return Number(result.changes);
  }

  #updateRecord(
    kind: LocalResearchRecordKind,
    id: string,
    expectedVersion: number,
    version: number,
    encrypted: EncryptedValue,
    payloadSha256: string,
    updatedAt: string,
  ): number {
    const result = this.#db
      .prepare(
        `UPDATE vault_records
            SET version = ?, payload_nonce = ?, payload_ciphertext = ?,
                payload_tag = ?, payload_sha256 = ?, updated_at = ?
          WHERE kind = ? AND record_id = ? AND version = ?`,
      )
      .run(
        version,
        encrypted.nonce,
        encrypted.ciphertext,
        encrypted.tag,
        payloadSha256,
        updatedAt,
        kind,
        id,
        expectedVersion,
      );
    return Number(result.changes);
  }

  #readReplay(
    idempotencyKey: string,
    requestSha256: string,
  ): LocalResearchMutationReceipt | undefined {
    const row = this.#db
      .prepare(
        `SELECT request_sha256, operation, record_kind, record_id,
                resulting_version, result_sha256, attachment_id, committed_at
           FROM vault_idempotency WHERE idempotency_key = ?`,
      )
      .get(idempotencyKey);
    if (row === undefined) return undefined;
    if (row["request_sha256"] !== requestSha256) {
      throw vaultError("VAULT_IDEMPOTENCY_CONFLICT");
    }
    const operation = row["operation"];
    const kind = row["record_kind"];
    const id = row["record_id"];
    const version = row["resulting_version"];
    const digestSha256 = row["result_sha256"];
    const committedAt = row["committed_at"];
    const attachmentId = row["attachment_id"];
    if (
      (operation !== "put" &&
        operation !== "delete" &&
        operation !== "put_attachment") ||
      !isKind(kind) ||
      typeof id !== "string" ||
      !isPositiveSafeInteger(version) ||
      !isSha256(digestSha256) ||
      typeof committedAt !== "string" ||
      (attachmentId !== null && typeof attachmentId !== "string")
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
    return {
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
      operation,
      kind,
      id,
      version,
      digestSha256,
      committedAt,
      replayed: true,
      ...(attachmentId === null ? {} : { attachmentId }),
    };
  }

  #writeIdempotency(
    idempotencyKey: string,
    requestSha256: string,
    receipt: LocalResearchMutationReceipt,
  ): void {
    this.#db
      .prepare(
        `INSERT INTO vault_idempotency(
           idempotency_key, request_sha256, operation, record_kind, record_id,
           resulting_version, result_sha256, attachment_id, committed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        idempotencyKey,
        requestSha256,
        receipt.operation,
        receipt.kind,
        receipt.id,
        receipt.version,
        receipt.digestSha256,
        receipt.attachmentId ?? null,
        receipt.committedAt,
      );
  }

  #writeAudit(
    action:
      | "attachment_added"
      | "record_created"
      | "record_deleted"
      | "record_updated",
    receipt: LocalResearchMutationReceipt,
    fromVersion: number,
    requestSha256: string,
  ): void {
    this.#db
      .prepare(
        `INSERT INTO vault_audit(
           occurred_at, action, record_kind, record_id, from_version,
           to_version, request_sha256, result_sha256, attachment_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        receipt.committedAt,
        action,
        receipt.kind,
        receipt.id,
        fromVersion,
        receipt.version,
        requestSha256,
        receipt.digestSha256,
        receipt.attachmentId ?? null,
      );
  }

  #decryptRecord(row: RecordRow): LocalResearchRecord {
    const plaintext = this.#cryptography.decryptRecord(
      { nonce: row.nonce, ciphertext: row.ciphertext, tag: row.tag },
      localVaultRecordAad(
        row.kind,
        row.id,
        row.version,
        row.payloadSha256,
        row.createdAt,
        row.updatedAt,
      ),
    );
    const canonical = plaintext.toString("utf8");
    if (
      !this.#cryptography.equalHexDigest(
        sha256Hex(canonical),
        row.payloadSha256,
      )
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
    return {
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
      kind: row.kind,
      id: row.id,
      version: row.version,
      payload: parseCanonicalJson(canonical),
      payloadSha256: row.payloadSha256,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  #decryptAttachment(row: AttachmentRow): LocalResearchAttachment {
    const bytes = this.#cryptography.decryptAttachment(
      { nonce: row.nonce, ciphertext: row.ciphertext, tag: row.tag },
      localVaultAttachmentAad(
        row.attachmentId,
        row.recordKind,
        row.recordId,
        row.recordVersion,
        row.mediaType,
        row.byteLength,
        row.contentSha256,
        row.createdAt,
      ),
    );
    if (
      bytes.byteLength !== row.byteLength ||
      !this.#cryptography.equalHexDigest(sha256Hex(bytes), row.contentSha256)
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
    return {
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
      attachmentId: row.attachmentId,
      recordKind: row.recordKind,
      recordId: row.recordId,
      recordVersion: row.recordVersion,
      mediaType: row.mediaType,
      byteLength: row.byteLength,
      contentSha256: row.contentSha256,
      createdAt: row.createdAt,
      bytes,
    };
  }
}

function asRecordRow(row: Record<string, unknown>): RecordRow {
  const kind = row["kind"];
  const id = row["record_id"];
  const version = row["version"];
  const payloadSha256 = row["payload_sha256"];
  const createdAt = row["created_at"];
  const updatedAt = row["updated_at"];
  if (
    !isKind(kind) ||
    typeof id !== "string" ||
    !isPositiveSafeInteger(version) ||
    !isSha256(payloadSha256) ||
    !isCanonicalTimestamp(createdAt) ||
    !isCanonicalTimestamp(updatedAt) ||
    createdAt > updatedAt
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  return {
    kind,
    id,
    version,
    nonce: asBuffer(row["payload_nonce"]),
    ciphertext: asBuffer(row["payload_ciphertext"]),
    tag: asBuffer(row["payload_tag"]),
    payloadSha256,
    createdAt,
    updatedAt,
  };
}

function asAttachmentRow(row: Record<string, unknown>): AttachmentRow {
  const attachmentId = row["attachment_id"];
  const recordKind = row["record_kind"];
  const recordId = row["record_id"];
  const recordVersion = row["record_version"];
  const mediaType = row["media_type"];
  const byteLength = row["byte_length"];
  const contentSha256 = row["content_sha256"];
  const createdAt = row["created_at"];
  if (
    typeof attachmentId !== "string" ||
    !isKind(recordKind) ||
    typeof recordId !== "string" ||
    !isPositiveSafeInteger(recordVersion) ||
    typeof mediaType !== "string" ||
    !Number.isSafeInteger(byteLength) ||
    typeof byteLength !== "number" ||
    byteLength < 0 ||
    byteLength > MAX_ATTACHMENT_BYTES ||
    !isSha256(contentSha256) ||
    !isCanonicalTimestamp(createdAt)
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  return {
    attachmentId,
    recordKind,
    recordId,
    recordVersion,
    mediaType,
    byteLength,
    nonce: asBuffer(row["content_nonce"]),
    ciphertext: asBuffer(row["content_ciphertext"]),
    tag: asBuffer(row["content_tag"]),
    contentSha256,
    createdAt,
  };
}

function asAuditRow(row: Record<string, unknown>): AuditRow {
  const sequence = row["sequence"];
  const occurredAt = row["occurred_at"];
  const action = row["action"];
  const recordKind = row["record_kind"];
  const recordId = row["record_id"];
  const fromVersion = row["from_version"];
  const toVersion = row["to_version"];
  const requestSha256 = row["request_sha256"];
  const resultSha256 = row["result_sha256"];
  const attachmentId = optionalIdentifier(row["attachment_id"]);
  if (
    !isPositiveSafeInteger(sequence) ||
    !isCanonicalTimestamp(occurredAt) ||
    !isAuditAction(action) ||
    !isKind(recordKind) ||
    typeof recordId !== "string" ||
    !IDENTIFIER_PATTERN.test(recordId) ||
    typeof fromVersion !== "number" ||
    !Number.isSafeInteger(fromVersion) ||
    fromVersion < 0 ||
    !isPositiveSafeInteger(toVersion) ||
    !isSha256(requestSha256) ||
    !isSha256(resultSha256)
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  return {
    sequence,
    occurredAt,
    action,
    recordKind,
    recordId,
    fromVersion,
    toVersion,
    requestSha256,
    resultSha256,
    ...(attachmentId === undefined ? {} : { attachmentId }),
  };
}

function asIdempotencyRow(row: Record<string, unknown>): IdempotencyRow {
  const idempotencyKey = row["idempotency_key"];
  const requestSha256 = row["request_sha256"];
  const operation = row["operation"];
  const recordKind = row["record_kind"];
  const recordId = row["record_id"];
  const resultingVersion = row["resulting_version"];
  const resultSha256 = row["result_sha256"];
  const attachmentId = optionalIdentifier(row["attachment_id"]);
  const committedAt = row["committed_at"];
  if (
    typeof idempotencyKey !== "string" ||
    !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey) ||
    !isSha256(requestSha256) ||
    (operation !== "put" &&
      operation !== "delete" &&
      operation !== "put_attachment") ||
    !isKind(recordKind) ||
    typeof recordId !== "string" ||
    !IDENTIFIER_PATTERN.test(recordId) ||
    !isPositiveSafeInteger(resultingVersion) ||
    !isSha256(resultSha256) ||
    !isCanonicalTimestamp(committedAt)
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  return {
    idempotencyKey,
    requestSha256,
    operation,
    recordKind,
    recordId,
    resultingVersion,
    resultSha256,
    ...(attachmentId === undefined ? {} : { attachmentId }),
    committedAt,
  };
}

function asTombstoneRow(row: Record<string, unknown>): TombstoneRow {
  const kind = row["kind"];
  const recordId = row["record_id"];
  const deletedVersion = row["deleted_version"];
  const priorPayloadSha256 = row["prior_payload_sha256"];
  const deletedAt = row["deleted_at"];
  if (
    !isKind(kind) ||
    typeof recordId !== "string" ||
    !IDENTIFIER_PATTERN.test(recordId) ||
    !isPositiveSafeInteger(deletedVersion) ||
    deletedVersion < 2 ||
    !isSha256(priorPayloadSha256) ||
    !isCanonicalTimestamp(deletedAt)
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  return { kind, recordId, deletedVersion, priorPayloadSha256, deletedAt };
}

function verifyLedgerRows(
  db: DatabaseSync,
  audits: readonly AuditRow[],
  idempotency: readonly IdempotencyRow[],
  tombstones: readonly TombstoneRow[],
): void {
  if (
    audits.some(
      (row, index) =>
        row.sequence !== index + 1 ||
        (index > 0 && row.occurredAt < audits[index - 1]!.occurredAt),
    )
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  const sqliteSequence = db
    .prepare("SELECT seq FROM sqlite_sequence WHERE name = 'vault_audit'")
    .get()?.["seq"];
  if (
    (audits.length === 0 && sqliteSequence !== undefined) ||
    (audits.length > 0 && sqliteSequence !== audits.length)
  ) {
    throw vaultError("VAULT_CORRUPT");
  }
  const idempotencyByRequest = new Map(
    idempotency.map((row) => [row.requestSha256, row] as const),
  );
  if (idempotencyByRequest.size !== idempotency.length) {
    throw vaultError("VAULT_CORRUPT");
  }
  const recordEvents = new Map<string, AuditRow[]>();
  const attachmentEvents = new Map<string, AuditRow>();
  for (const audit of audits) {
    const idempotent = idempotencyByRequest.get(audit.requestSha256);
    if (
      idempotent === undefined ||
      !auditMatchesIdempotency(audit, idempotent)
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
    if (audit.action === "attachment_added") {
      if (
        audit.attachmentId === undefined ||
        audit.fromVersion !== audit.toVersion ||
        attachmentEvents.has(audit.attachmentId)
      ) {
        throw vaultError("VAULT_CORRUPT");
      }
      attachmentEvents.set(audit.attachmentId, audit);
      continue;
    }
    if (audit.attachmentId !== undefined) throw vaultError("VAULT_CORRUPT");
    const key = recordKey(audit.recordKind, audit.recordId);
    const events = recordEvents.get(key) ?? [];
    events.push(audit);
    recordEvents.set(key, events);
  }
  if (audits.length !== idempotencyByRequest.size) {
    throw vaultError("VAULT_CORRUPT");
  }

  const liveRecords = new Map<string, Record<string, unknown>>();
  for (const row of db
    .prepare(
      `SELECT kind, record_id, version, payload_sha256, created_at, updated_at
         FROM vault_records ORDER BY kind, record_id LIMIT ?`,
    )
    .all(MAX_TOTAL_RECORDS + 1)) {
    const kind = row["kind"];
    const id = row["record_id"];
    if (!isKind(kind) || typeof id !== "string") {
      throw vaultError("VAULT_CORRUPT");
    }
    liveRecords.set(recordKey(kind, id), row);
  }
  if (liveRecords.size > MAX_TOTAL_RECORDS) throw vaultError("VAULT_CORRUPT");
  const tombstonesByRecord = new Map(
    tombstones.map((row) => [recordKey(row.kind, row.recordId), row] as const),
  );
  if (tombstonesByRecord.size !== tombstones.length) {
    throw vaultError("VAULT_CORRUPT");
  }

  for (const [key, events] of recordEvents) {
    verifyRecordEventChain(events);
    const first = events[0];
    const last = events.at(-1);
    if (first === undefined || last === undefined) {
      throw vaultError("VAULT_CORRUPT");
    }
    const live = liveRecords.get(key);
    const tombstone = tombstonesByRecord.get(key);
    if (last.action === "record_deleted") {
      if (
        live !== undefined ||
        tombstone === undefined ||
        tombstone.deletedVersion !== last.toVersion ||
        tombstone.priorPayloadSha256 !== last.resultSha256 ||
        tombstone.deletedAt !== last.occurredAt
      ) {
        throw vaultError("VAULT_CORRUPT");
      }
    } else if (
      tombstone !== undefined ||
      live === undefined ||
      live["version"] !== last.toVersion ||
      live["payload_sha256"] !== last.resultSha256 ||
      live["created_at"] !== first.occurredAt ||
      live["updated_at"] !== last.occurredAt
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
  }
  if (
    [...liveRecords.keys()].some((key) => !recordEvents.has(key)) ||
    [...tombstonesByRecord.keys()].some((key) => !recordEvents.has(key))
  ) {
    throw vaultError("VAULT_CORRUPT");
  }

  const liveAttachments = new Map<string, Record<string, unknown>>();
  for (const row of db
    .prepare(
      `SELECT attachment_id, record_kind, record_id, record_version,
              content_sha256, created_at
         FROM vault_attachments ORDER BY attachment_id LIMIT ?`,
    )
    .all(MAX_ATTACHMENTS + 1)) {
    const id = row["attachment_id"];
    if (typeof id !== "string") throw vaultError("VAULT_CORRUPT");
    liveAttachments.set(id, row);
  }
  if (liveAttachments.size > MAX_ATTACHMENTS) throw vaultError("VAULT_CORRUPT");
  for (const [attachmentId, event] of attachmentEvents) {
    const live = liveAttachments.get(attachmentId);
    const recordWasDeleted =
      recordEvents.get(recordKey(event.recordKind, event.recordId))?.at(-1)
        ?.action === "record_deleted";
    if (live === undefined) {
      if (!recordWasDeleted) throw vaultError("VAULT_CORRUPT");
      continue;
    }
    if (
      live["record_kind"] !== event.recordKind ||
      live["record_id"] !== event.recordId ||
      live["record_version"] !== event.toVersion ||
      live["content_sha256"] !== event.resultSha256 ||
      live["created_at"] !== event.occurredAt
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
  }
  if ([...liveAttachments.keys()].some((id) => !attachmentEvents.has(id))) {
    throw vaultError("VAULT_CORRUPT");
  }
}

function auditMatchesIdempotency(
  audit: AuditRow,
  row: IdempotencyRow,
): boolean {
  const expectedOperation =
    audit.action === "record_deleted"
      ? "delete"
      : audit.action === "attachment_added"
        ? "put_attachment"
        : "put";
  return (
    row.operation === expectedOperation &&
    row.recordKind === audit.recordKind &&
    row.recordId === audit.recordId &&
    row.resultingVersion === audit.toVersion &&
    row.resultSha256 === audit.resultSha256 &&
    row.committedAt === audit.occurredAt &&
    row.attachmentId === audit.attachmentId
  );
}

function verifyRecordEventChain(events: readonly AuditRow[]): void {
  let version = 0;
  let deleted = false;
  for (const [index, event] of events.entries()) {
    if (
      deleted ||
      (index === 0
        ? event.action !== "record_created" ||
          event.fromVersion !== 0 ||
          event.toVersion !== 1
        : event.action === "record_created" ||
          event.fromVersion !== version ||
          event.toVersion !== version + 1)
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
    version = event.toVersion;
    deleted = event.action === "record_deleted";
  }
}

function optionalIdentifier(value: unknown): string | undefined {
  if (value === null) return undefined;
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw vaultError("VAULT_CORRUPT");
  }
  return value;
}

function isAuditAction(value: unknown): value is AuditAction {
  return (
    value === "attachment_added" ||
    value === "record_created" ||
    value === "record_deleted" ||
    value === "record_updated"
  );
}

function recordKey(kind: LocalResearchRecordKind, id: string): string {
  return `${kind}\0${id}`;
}

function asBuffer(value: unknown): Buffer {
  if (!(value instanceof Uint8Array)) throw vaultError("VAULT_CORRUPT");
  return Buffer.from(value);
}

function toSummary(row: RecordRow): LocalResearchRecordSummary {
  return {
    profile: LOCAL_RESEARCH_VAULT_PROFILE,
    kind: row.kind,
    id: row.id,
    version: row.version,
    payloadSha256: row.payloadSha256,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function validateKind(value: string): asserts value is LocalResearchRecordKind {
  if (!isKind(value)) throw vaultError("VAULT_INVALID_INPUT");
}

function isKind(value: unknown): value is LocalResearchRecordKind {
  return typeof value === "string" && RECORD_KIND_SET.has(value);
}

function validateIdentifier(value: string): void {
  if (!IDENTIFIER_PATTERN.test(value)) throw vaultError("VAULT_INVALID_INPUT");
}

function validateIdempotencyKey(value: string): void {
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw vaultError("VAULT_INVALID_INPUT");
  }
}

function validateExpectedVersion(value: number, allowZero: boolean): void {
  if (
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1) ||
    value >= Number.MAX_SAFE_INTEGER
  ) {
    throw vaultError("VAULT_INVALID_INPUT");
  }
}

function validateMediaType(value: string): void {
  if (!MEDIA_TYPE_PATTERN.test(value)) throw vaultError("VAULT_INVALID_INPUT");
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function exactCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw vaultError("VAULT_CORRUPT");
  }
  return value;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function hashRequest(value: JsonValue): string {
  return createHash("sha256").update(canonicalizeJson(value)).digest("hex");
}
