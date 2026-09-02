import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { vaultError } from "./errors";
import type { LocalResearchRecordKind } from "./model";

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KDF_SALT = createHash("sha256")
  .update("research-cockpit:local-research-vault:kdf-salt:v1\0")
  .digest();

export interface EncryptedValue {
  readonly nonce: Buffer;
  readonly ciphertext: Buffer;
  readonly tag: Buffer;
}

export class LocalVaultCryptography {
  readonly #recordKey: Buffer;
  readonly #attachmentKey: Buffer;
  readonly #backupKey: Buffer;
  #closed = false;

  constructor(masterKey: Uint8Array) {
    if (masterKey.byteLength !== KEY_BYTES) {
      throw vaultError("VAULT_SECURITY_BOUNDARY_REJECTED");
    }
    const input = Buffer.from(masterKey);
    this.#recordKey = derive(input, "record-payload");
    this.#attachmentKey = derive(input, "attachment-content");
    this.#backupKey = derive(input, "encrypted-backup");
    input.fill(0);
  }

  encryptRecord(plaintext: Uint8Array, aad: string): EncryptedValue {
    return this.#encrypt(this.#recordKey, plaintext, aad);
  }

  decryptRecord(value: EncryptedValue, aad: string): Buffer {
    return this.#decrypt(this.#recordKey, value, aad);
  }

  encryptAttachment(plaintext: Uint8Array, aad: string): EncryptedValue {
    return this.#encrypt(this.#attachmentKey, plaintext, aad);
  }

  decryptAttachment(value: EncryptedValue, aad: string): Buffer {
    return this.#decrypt(this.#attachmentKey, value, aad);
  }

  encryptBackup(plaintext: Uint8Array, aad: Uint8Array): EncryptedValue {
    return this.#encrypt(this.#backupKey, plaintext, aad);
  }

  decryptBackup(value: EncryptedValue, aad: Uint8Array): Buffer {
    return this.#decrypt(this.#backupKey, value, aad);
  }

  equalHexDigest(left: string, right: string): boolean {
    if (!/^[a-f0-9]{64}$/u.test(left) || !/^[a-f0-9]{64}$/u.test(right)) {
      return false;
    }
    return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#recordKey.fill(0);
    this.#attachmentKey.fill(0);
    this.#backupKey.fill(0);
  }

  #encrypt(
    key: Buffer,
    plaintext: Uint8Array,
    aad: string | Uint8Array,
  ): EncryptedValue {
    this.#assertOpen();
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv("aes-256-gcm", key, nonce, {
      authTagLength: TAG_BYTES,
    });
    cipher.setAAD(typeof aad === "string" ? Buffer.from(aad, "utf8") : aad);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    return { nonce, ciphertext, tag: cipher.getAuthTag() };
  }

  #decrypt(
    key: Buffer,
    value: EncryptedValue,
    aad: string | Uint8Array,
  ): Buffer {
    this.#assertOpen();
    if (
      value.nonce.byteLength !== NONCE_BYTES ||
      value.tag.byteLength !== TAG_BYTES
    ) {
      throw vaultError("VAULT_CORRUPT");
    }
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, value.nonce, {
        authTagLength: TAG_BYTES,
      });
      decipher.setAAD(typeof aad === "string" ? Buffer.from(aad, "utf8") : aad);
      decipher.setAuthTag(value.tag);
      return Buffer.concat([
        decipher.update(value.ciphertext),
        decipher.final(),
      ]);
    } catch (error) {
      throw vaultError("VAULT_CORRUPT", error);
    }
  }

  #assertOpen(): void {
    if (this.#closed) throw vaultError("VAULT_CLOSED");
  }
}

function derive(masterKey: Buffer, purpose: string): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      masterKey,
      KDF_SALT,
      Buffer.from(`research-cockpit:local-research-vault:${purpose}:v1\0`),
      KEY_BYTES,
    ),
  );
}

export function localVaultRecordAad(
  kind: LocalResearchRecordKind,
  id: string,
  version: number,
  payloadSha256: string,
  createdAt: string,
  updatedAt: string,
): string {
  return `research-cockpit:local-research-vault:record:v1\0${kind}\0${id}\0${String(
    version,
  )}\0${payloadSha256}\0${createdAt}\0${updatedAt}`;
}

export function localVaultAttachmentAad(
  attachmentId: string,
  recordKind: LocalResearchRecordKind,
  recordId: string,
  recordVersion: number,
  mediaType: string,
  byteLength: number,
  contentSha256: string,
  createdAt: string,
): string {
  return `research-cockpit:local-research-vault:attachment:v1\0${attachmentId}\0${recordKind}\0${recordId}\0${String(
    recordVersion,
  )}\0${mediaType}\0${String(byteLength)}\0${contentSha256}\0${createdAt}`;
}
