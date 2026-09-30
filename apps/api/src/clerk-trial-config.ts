import { createPublicKey } from "node:crypto";

import type { ClerkTrialAuthOptions } from "./clerk-trial-auth";

export interface ClerkTrialFunctionConfiguration {
  readonly environment: "development" | "production";
  readonly auth: ClerkTrialAuthOptions;
  readonly allowedOrigins: readonly string[];
}

export interface CheckedClerkTrialFunctionConfiguration extends ClerkTrialFunctionConfiguration {
  readonly storage: {
    readonly endpoint: "https://nyc.cloud.appwrite.io/v1";
    readonly projectId: "6abac57a0007b7c1a671";
    readonly databaseId:
      "investment_clerk_trial_v1" | "investment_clerk_prod_trial_v1";
    readonly watchlistsTableId: "watchlists";
    readonly receiptsTableId: "receipts";
  };
}

const DEVELOPMENT_ORIGIN = "https://investment-clerk-6abac57a.appwrite.network";
const PRODUCTION_ORIGIN = "https://app.investingpro.app";
const NATIVE_ORIGIN = "https://localhost";

function invalid(): never {
  throw new Error("Invalid Clerk function configuration");
}

function record(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(value).some(
      (key) =>
        typeof key !== "string" ||
        (!required.includes(key) && !optional.includes(key)) ||
        !("value" in (descriptors[key] ?? {})),
    ) ||
    required.some((key) => !Object.hasOwn(value, key))
  )
    return invalid();
  return value as Record<string, unknown>;
}

function origins(value: unknown, allowed: readonly string[]): string[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > allowed.length
  )
    return invalid();
  const checked: unknown[] = Array.from(value);
  if (
    !checked.every(
      (origin): origin is string =>
        typeof origin === "string" && allowed.includes(origin),
    ) ||
    new Set(checked).size !== checked.length
  )
    return invalid();
  return checked;
}

function publicKey(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 8192 ||
    !/^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----\r?\n?$/u.test(
      value,
    )
  )
    return invalid();
  try {
    if (createPublicKey(value).asymmetricKeyType !== "rsa") return invalid();
  } catch {
    return invalid();
  }
  return value;
}

function checkedSubject(value: unknown, production: boolean): string | null {
  if (production) {
    if (value !== null) return invalid();
    return null;
  }
  if (value === null) return null;
  if (typeof value !== "string" || !/^user_[A-Za-z0-9]{1,128}$/u.test(value))
    return invalid();
  return value;
}

function validateOriginAgreement(
  allowedOrigins: readonly string[],
  authorizedParties: readonly string[],
  production: boolean,
): void {
  if (allowedOrigins.length !== authorizedParties.length) return invalid();
  if (!allowedOrigins.every((origin) => authorizedParties.includes(origin)))
    return invalid();
  if (!production && !allowedOrigins.includes(DEVELOPMENT_ORIGIN))
    return invalid();
}

function nativeOriginEnabled(
  auth: Record<string, unknown>,
  authorizedParties: readonly string[],
): boolean {
  if (!Object.hasOwn(auth, "nativeOrigin")) return false;
  if (auth.nativeOrigin !== NATIVE_ORIGIN) return invalid();
  if (!authorizedParties.includes(NATIVE_ORIGIN)) return invalid();
  return true;
}

/** Storage is derived locally; no caller can select a database or project. */
export function validateClerkTrialFunctionConfiguration(
  input: unknown,
): CheckedClerkTrialFunctionConfiguration {
  const config = record(input, ["environment", "auth", "allowedOrigins"]);
  const environment = config.environment;
  if (environment !== "development" && environment !== "production")
    return invalid();
  const production = environment === "production";
  const auth = record(
    config.auth,
    ["issuer", "jwtKey", "allowedSubject", "authorizedParties"],
    production ? [] : ["nativeOrigin"],
  );
  const issuer = auth.issuer;
  if (
    typeof issuer !== "string" ||
    (production
      ? issuer !== "https://clerk.investingpro.app"
      : issuer !== "https://allowed-lobster-3386.clerk.accounts.dev")
  )
    return invalid();
  const allowedSubject = checkedSubject(auth.allowedSubject, production);
  const allowed = production
    ? [PRODUCTION_ORIGIN]
    : [DEVELOPMENT_ORIGIN, NATIVE_ORIGIN];
  const allowedOrigins = origins(config.allowedOrigins, allowed);
  const authorizedParties = origins(auth.authorizedParties, allowed);
  validateOriginAgreement(allowedOrigins, authorizedParties, production);
  const native = nativeOriginEnabled(auth, authorizedParties);
  return Object.freeze({
    environment,
    auth: Object.freeze({
      issuer,
      jwtKey: publicKey(auth.jwtKey),
      allowedSubject,
      authorizedParties: Object.freeze(authorizedParties),
      ...(native ? { nativeOrigin: NATIVE_ORIGIN } : {}),
    }),
    allowedOrigins: Object.freeze(allowedOrigins),
    storage: Object.freeze({
      endpoint: "https://nyc.cloud.appwrite.io/v1",
      projectId: "6abac57a0007b7c1a671",
      databaseId: production
        ? "investment_clerk_prod_trial_v1"
        : "investment_clerk_trial_v1",
      watchlistsTableId: "watchlists",
      receiptsTableId: "receipts",
    }),
  });
}
