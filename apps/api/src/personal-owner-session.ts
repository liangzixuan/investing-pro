import {
  createHash,
  createHmac,
  randomBytes as secureRandomBytes,
  timingSafeEqual,
} from "node:crypto";
import { performance } from "node:perf_hooks";

export const PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY =
  "RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET" as const;
export const PERSONAL_OWNER_SESSION_COOKIE_NAME =
  "research_cockpit_owner_session" as const;
export const PERSONAL_OWNER_SESSION_IDLE_TTL_MS = 10 * 60 * 1_000;
export const PERSONAL_OWNER_SESSION_ABSOLUTE_TTL_MS = 60 * 60 * 1_000;

const BOOTSTRAP_SECRET_PATTERN = /^[0-9a-f]{64}$/u;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const TOKEN_BYTES = 32;
const ownerSessionAuthorities = new WeakSet<PersonalOwnerSessionAuthority>();

export interface PersonalOwnerSessionBinding {
  readonly authority: string;
  readonly origin: string;
}

export interface PersonalOwnerSessionOptions {
  readonly absoluteTtlMs?: number;
  readonly idleTtlMs?: number;
  readonly now?: () => number;
  readonly randomBytes?: (size: number) => Uint8Array;
}

interface ActiveSession {
  absoluteExpiresAt: number;
  authority: string;
  digest: Uint8Array;
  lastSeenAt: number;
  origin: string;
}

export class PersonalOwnerSessionConfigurationError extends Error {
  readonly code = "INVALID_PERSONAL_OWNER_BOOTSTRAP_SECRET" as const;

  constructor() {
    super("The personal owner-session configuration is invalid.");
    this.name = "PersonalOwnerSessionConfigurationError";
  }
}

export class PersonalOwnerSessionAuthority {
  readonly #absoluteTtlMs: number;
  #activeSession: ActiveSession | undefined;
  #bootstrapDigest: Uint8Array | undefined;
  #closed = false;
  readonly #digestKey: Uint8Array;
  readonly #idleTtlMs: number;
  readonly #now: () => number;
  readonly #randomBytes: (size: number) => Uint8Array;

  private constructor(
    bootstrapSecret: string,
    options: PersonalOwnerSessionOptions,
  ) {
    this.#absoluteTtlMs =
      options.absoluteTtlMs ?? PERSONAL_OWNER_SESSION_ABSOLUTE_TTL_MS;
    this.#idleTtlMs = options.idleTtlMs ?? PERSONAL_OWNER_SESSION_IDLE_TTL_MS;
    this.#now = options.now ?? (() => performance.now());
    this.#randomBytes =
      options.randomBytes ?? ((size) => secureRandomBytes(size));
    if (
      !Number.isSafeInteger(this.#absoluteTtlMs) ||
      !Number.isSafeInteger(this.#idleTtlMs) ||
      this.#idleTtlMs < 1 ||
      this.#absoluteTtlMs < this.#idleTtlMs
    ) {
      throw new PersonalOwnerSessionConfigurationError();
    }
    this.#digestKey = copyExactRandomBytes(this.#randomBytes, TOKEN_BYTES);
    this.#bootstrapDigest = bootstrapDigest(bootstrapSecret);
    ownerSessionAuthorities.add(this);
  }

  static create(
    bootstrapSecret: string,
    options: PersonalOwnerSessionOptions = {},
  ): PersonalOwnerSessionAuthority {
    if (!BOOTSTRAP_SECRET_PATTERN.test(bootstrapSecret)) {
      throw new PersonalOwnerSessionConfigurationError();
    }
    return new PersonalOwnerSessionAuthority(bootstrapSecret, options);
  }

  bootstrap(
    presentedSecret: string,
    binding: PersonalOwnerSessionBinding,
  ): string | undefined {
    const expected = this.#bootstrapDigest;
    if (
      this.#closed ||
      expected === undefined ||
      this.#activeSession !== undefined ||
      !BOOTSTRAP_SECRET_PATTERN.test(presentedSecret)
    ) {
      return undefined;
    }
    const presented = bootstrapDigest(presentedSecret);
    const accepted = safeEqual(expected, presented);
    presented.fill(0);
    if (!accepted) return undefined;

    const now = this.#readClock();
    if (now === undefined) return undefined;
    const token = this.#newToken();
    if (token === undefined) return undefined;

    expected.fill(0);
    this.#bootstrapDigest = undefined;
    this.#activeSession = {
      absoluteExpiresAt: now + this.#absoluteTtlMs,
      authority: binding.authority,
      digest: this.#tokenDigest(token),
      lastSeenAt: now,
      origin: binding.origin,
    };
    return token;
  }

  authorize(token: string, binding: PersonalOwnerSessionBinding): boolean {
    if (this.#closed) return false;
    const validated = this.#validate(token, binding);
    if (validated === undefined) return false;
    validated.session.lastSeenAt = validated.now;
    return true;
  }

  rotate(
    token: string,
    binding: PersonalOwnerSessionBinding,
  ): string | undefined {
    if (this.#closed) return undefined;
    const validated = this.#validate(token, binding);
    if (validated === undefined) return undefined;
    const replacement = this.#newToken();
    if (replacement === undefined) {
      this.#invalidateActiveSession();
      return undefined;
    }
    validated.session.digest.fill(0);
    validated.session.digest = this.#tokenDigest(replacement);
    validated.session.lastSeenAt = validated.now;
    return replacement;
  }

  logout(token: string, binding: PersonalOwnerSessionBinding): boolean {
    if (this.#closed) return false;
    if (this.#validate(token, binding) === undefined) return false;
    this.#invalidateActiveSession();
    return true;
  }

  revoke(token: string, binding: PersonalOwnerSessionBinding): boolean {
    if (this.#closed) return false;
    if (this.#validate(token, binding) === undefined) return false;
    this.#invalidateActiveSession();
    return true;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#bootstrapDigest?.fill(0);
    this.#bootstrapDigest = undefined;
    this.#invalidateActiveSession();
    this.#digestKey.fill(0);
  }

  #invalidateActiveSession(): void {
    this.#activeSession?.digest.fill(0);
    this.#activeSession = undefined;
  }

  #newToken(): string | undefined {
    try {
      return Buffer.from(
        copyExactRandomBytes(this.#randomBytes, TOKEN_BYTES),
      ).toString("base64url");
    } catch {
      return undefined;
    }
  }

  #readClock(): number | undefined {
    try {
      const value = this.#now();
      return Number.isFinite(value) && value >= 0 ? value : undefined;
    } catch {
      return undefined;
    }
  }

  #tokenDigest(token: string): Uint8Array {
    return createHmac("sha256", this.#digestKey)
      .update("personal-owner-session\0", "utf8")
      .update(token, "utf8")
      .digest();
  }

  #validate(
    token: string,
    binding: PersonalOwnerSessionBinding,
  ): { now: number; session: ActiveSession } | undefined {
    const session = this.#activeSession;
    if (session === undefined || !SESSION_TOKEN_PATTERN.test(token)) {
      return undefined;
    }
    const presented = this.#tokenDigest(token);
    const tokenMatches = safeEqual(session.digest, presented);
    presented.fill(0);
    if (
      !tokenMatches ||
      session.authority !== binding.authority ||
      session.origin !== binding.origin
    ) {
      return undefined;
    }

    const now = this.#readClock();
    if (
      now === undefined ||
      now < session.lastSeenAt ||
      now >= session.absoluteExpiresAt ||
      now - session.lastSeenAt >= this.#idleTtlMs
    ) {
      this.#invalidateActiveSession();
      return undefined;
    }
    return { now, session };
  }
}

export function isPersonalOwnerSessionAuthority(
  value: unknown,
): value is PersonalOwnerSessionAuthority {
  return (
    typeof value === "object" &&
    value !== null &&
    ownerSessionAuthorities.has(value as PersonalOwnerSessionAuthority)
  );
}

export function isPersonalOwnerSessionToken(value: string): boolean {
  return SESSION_TOKEN_PATTERN.test(value);
}

function bootstrapDigest(secret: string): Uint8Array {
  return createHash("sha256")
    .update("personal-owner-bootstrap\0", "utf8")
    .update(secret, "utf8")
    .digest();
}

function copyExactRandomBytes(
  source: (size: number) => Uint8Array,
  size: number,
): Uint8Array {
  const bytes = source(size);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== size) {
    throw new PersonalOwnerSessionConfigurationError();
  }
  return Uint8Array.from(bytes);
}

function safeEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}
