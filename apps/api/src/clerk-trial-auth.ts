import { createHash } from "node:crypto";

import { verifyToken } from "@clerk/backend";

import type { WatchlistPrincipal } from "./watchlist-repository";

export type ClerkTrialAuthResult =
  | { readonly status: "allowed"; readonly principal: WatchlistPrincipal }
  | { readonly status: "unauthenticated" | "access_denied" };
export type ClerkTrialAuth = (
  request: Request,
) => Promise<ClerkTrialAuthResult>;
export interface ClerkTrialAuthOptions {
  readonly issuer: string;
  readonly jwtKey: string;
  readonly allowedSubject: string | null;
  readonly authorizedParties: readonly string[];
  readonly nativeOrigin?: "https://localhost";
}

export function isClerkTrialOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === value &&
      !url.username &&
      !url.password &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["127.0.0.1", "localhost"].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}

/** Verification uses the official SDK and a pinned public key; no JWKS request. */
export function createClerkTrialAuth(
  options: ClerkTrialAuthOptions,
): ClerkTrialAuth {
  if (
    !isClerkTrialOrigin(options.issuer) ||
    !options.issuer.startsWith("https:") ||
    (options.allowedSubject !== null &&
      !/^user_[A-Za-z0-9]{1,128}$/u.test(options.allowedSubject)) ||
    options.authorizedParties.length < 1 ||
    options.authorizedParties.length > 8 ||
    !options.authorizedParties.every(isClerkTrialOrigin) ||
    (options.nativeOrigin !== undefined &&
      (options.nativeOrigin !== "https://localhost" ||
        !options.authorizedParties.includes(options.nativeOrigin))) ||
    new Set(options.authorizedParties).size !==
      options.authorizedParties.length ||
    !options.jwtKey.startsWith("-----BEGIN PUBLIC KEY-----") ||
    options.jwtKey.length > 8192
  ) {
    throw new Error("Invalid trial authentication configuration");
  }
  const { issuer, allowedSubject, jwtKey, nativeOrigin } = options;
  const authorizedParties = [...options.authorizedParties];
  const principal = Object.freeze({
    userId: `clerk-${createHash("sha256")
      .update(JSON.stringify([issuer, allowedSubject]))
      .digest("hex")
      .slice(0, 30)}`,
  });
  return async (request) => {
    const authorization = request.headers.get("authorization");
    if (
      !authorization ||
      authorization.length > 8192 ||
      !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(
        authorization,
      ) ||
      request.headers.has("cookie")
    ) {
      return { status: "unauthenticated" };
    }
    try {
      const nativeRequest =
        nativeOrigin !== undefined &&
        request.headers.get("origin") === nativeOrigin;
      const claims = await verifyToken(authorization.slice(7), {
        // Native SDK sessions can omit azp. Present values are checked below
        // after signature verification, including on this explicit native path.
        ...(nativeRequest ? {} : { authorizedParties }),
        jwtKey,
        clockSkewInMs: 0,
      });
      if (
        claims.iss !== issuer ||
        claims.act !== undefined ||
        typeof claims.sub !== "string" ||
        !/^user_[A-Za-z0-9]{1,128}$/u.test(claims.sub) ||
        !(typeof claims.azp === "string"
          ? authorizedParties.includes(claims.azp)
          : claims.azp === undefined && nativeRequest) ||
        typeof claims.sid !== "string" ||
        !/^sess_[A-Za-z0-9]+$/u.test(claims.sid) ||
        !Number.isSafeInteger(claims.exp) ||
        !Number.isSafeInteger(claims.iat) ||
        !Number.isSafeInteger(claims.nbf) ||
        (claims.sts !== undefined && claims.sts !== "active")
      )
        return { status: "unauthenticated" };
      if (allowedSubject === null || claims.sub !== allowedSubject)
        return { status: "access_denied" };
      return { status: "allowed", principal };
    } catch {
      return { status: "unauthenticated" };
    }
  };
}
