import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_COST = 131_072;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_MAX_MEMORY = 256 * 1_024 * 1_024;
const HEX_32_BYTES = /^[0-9a-f]{64}$/u;
const RECORD_KEYS = [
  "blockSize",
  "cost",
  "kdf",
  "parallelization",
  "salt",
  "username",
  "verifier",
  "version",
];

export interface PersonalOwnerAccountRecord {
  readonly version: 1;
  readonly username: string;
  readonly kdf: "scrypt";
  readonly cost: 131072;
  readonly blockSize: 8;
  readonly parallelization: 1;
  readonly salt: string;
  readonly verifier: string;
}

export class PersonalOwnerAccountConfigurationError extends Error {
  readonly code = "INVALID_PERSONAL_OWNER_ACCOUNT" as const;

  constructor() {
    super("The local owner account is unavailable or invalid.");
    this.name = "PersonalOwnerAccountConfigurationError";
  }
}

export function isValidPersonalOwnerUsername(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._@+-]{0,63}$/u.test(value)
  );
}

export function isValidPersonalOwnerPassword(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 256) return false;
  const length = Array.from(value).length;
  return (
    length >= 15 &&
    length <= 128 &&
    Buffer.byteLength(value, "utf8") <= 1_024 &&
    Buffer.from(value, "utf8").toString("utf8") === value
  );
}

export function validatePersonalOwnerAccountRecord(
  value: unknown,
): PersonalOwnerAccountRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PersonalOwnerAccountConfigurationError();
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Object.keys(descriptors).sort().join(",") !== RECORD_KEYS.join(",") ||
    Object.values(descriptors).some((entry) => !("value" in entry))
  ) {
    throw new PersonalOwnerAccountConfigurationError();
  }
  const record = value as Record<string, unknown>;
  if (
    record.version !== 1 ||
    !isValidPersonalOwnerUsername(record.username) ||
    record.kdf !== "scrypt" ||
    record.cost !== SCRYPT_COST ||
    record.blockSize !== SCRYPT_BLOCK_SIZE ||
    record.parallelization !== SCRYPT_PARALLELIZATION ||
    typeof record.salt !== "string" ||
    !HEX_32_BYTES.test(record.salt) ||
    typeof record.verifier !== "string" ||
    !HEX_32_BYTES.test(record.verifier)
  ) {
    throw new PersonalOwnerAccountConfigurationError();
  }
  return Object.freeze({
    version: 1,
    username: record.username,
    kdf: "scrypt",
    cost: SCRYPT_COST,
    blockSize: SCRYPT_BLOCK_SIZE,
    parallelization: SCRYPT_PARALLELIZATION,
    salt: record.salt,
    verifier: record.verifier,
  });
}

export async function createPersonalOwnerAccountRecord(
  username: string,
  password: string,
): Promise<PersonalOwnerAccountRecord> {
  if (
    !isValidPersonalOwnerUsername(username) ||
    !isValidPersonalOwnerPassword(password)
  ) {
    throw new PersonalOwnerAccountConfigurationError();
  }
  const salt = randomBytes(32);
  const verifier = await derivePassword(password, salt);
  try {
    return validatePersonalOwnerAccountRecord({
      version: 1,
      username,
      kdf: "scrypt",
      cost: SCRYPT_COST,
      blockSize: SCRYPT_BLOCK_SIZE,
      parallelization: SCRYPT_PARALLELIZATION,
      salt: salt.toString("hex"),
      verifier: verifier.toString("hex"),
    });
  } finally {
    verifier.fill(0);
  }
}

/** The same KDF runs for a wrong username; no account-discovery response exists. */
export async function verifyPersonalOwnerAccountPassword(
  record: PersonalOwnerAccountRecord,
  username: string,
  password: string,
): Promise<boolean> {
  if (
    !isValidPersonalOwnerUsername(username) ||
    !isValidPersonalOwnerPassword(password)
  ) {
    return false;
  }
  const verified = validatePersonalOwnerAccountRecord(record);
  const derived = await derivePassword(
    password,
    Buffer.from(verified.salt, "hex"),
  );
  try {
    const matches = timingSafeEqual(
      derived,
      Buffer.from(verified.verifier, "hex"),
    );
    return matches && username === verified.username;
  } finally {
    derived.fill(0);
  }
}

function derivePassword(password: string, salt: Uint8Array): Promise<Buffer> {
  const bytes = Buffer.from(password, "utf8");
  return new Promise((resolvePromise, reject) => {
    scrypt(
      bytes,
      salt,
      32,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, key) => {
        bytes.fill(0);
        if (error !== null)
          reject(new PersonalOwnerAccountConfigurationError());
        else resolvePromise(key);
      },
    );
  });
}
