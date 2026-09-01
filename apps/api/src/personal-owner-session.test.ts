import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  isPersonalOwnerSessionAuthority,
  PersonalOwnerSessionAuthority,
  PersonalOwnerSessionConfigurationError,
} from "./personal-owner-session";

const binding = Object.freeze({
  authority: "127.0.0.1:3100",
  origin: "http://127.0.0.1:3000",
});

describe("personal owner-session authority", () => {
  it("requires the exact bootstrap encoding shape and rejects forgeries", () => {
    for (const invalid of [
      "",
      "0".repeat(63),
      "0".repeat(65),
      "G".repeat(64),
      "private-canary".repeat(8),
    ]) {
      expect(() => PersonalOwnerSessionAuthority.create(invalid)).toThrow(
        PersonalOwnerSessionConfigurationError,
      );
    }

    const authority = PersonalOwnerSessionAuthority.create(freshSecret());
    expect(isPersonalOwnerSessionAuthority(authority)).toBe(true);
    expect(isPersonalOwnerSessionAuthority({})).toBe(false);
    expect(JSON.stringify(authority)).toBe("{}");
    authority.close();
  });

  it("consumes one bootstrap exactly once while allowing normal session reuse", () => {
    const secret = freshSecret();
    const authority = PersonalOwnerSessionAuthority.create(secret);
    const token = authority.bootstrap(secret, binding);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    if (token === undefined) throw new Error("Expected a session token.");
    expect(authority.bootstrap(secret, binding)).toBeUndefined();
    expect(authority.authorize(token, binding)).toBe(true);
    expect(authority.authorize(token, binding)).toBe(true);
    expect(JSON.stringify(authority)).not.toContain(token);
    authority.close();
  });

  it("treats bootstrap freshness across process restarts as an operator precondition", () => {
    const secret = freshSecret();
    const firstProcess = PersonalOwnerSessionAuthority.create(secret);
    expect(firstProcess.bootstrap(secret, binding)).toMatch(
      /^[A-Za-z0-9_-]{43}$/u,
    );
    firstProcess.close();

    const restartedProcess = PersonalOwnerSessionAuthority.create(secret);
    expect(restartedProcess.bootstrap(secret, binding)).toMatch(
      /^[A-Za-z0-9_-]{43}$/u,
    );
    restartedProcess.close();
  });

  it("admits exactly one winner across concurrent bootstrap attempts", async () => {
    const secret = freshSecret();
    const authority = PersonalOwnerSessionAuthority.create(secret);

    const attempts = await Promise.all(
      Array.from({ length: 24 }, async () =>
        Promise.resolve().then(() => authority.bootstrap(secret, binding)),
      ),
    );

    expect(attempts.filter((value) => value !== undefined)).toHaveLength(1);
    authority.close();
  });

  it("binds a session to the exact browser origin and API authority", () => {
    const secret = freshSecret();
    const authority = PersonalOwnerSessionAuthority.create(secret);
    const token = authority.bootstrap(secret, binding);
    if (token === undefined) throw new Error("Expected a session token.");

    expect(
      authority.authorize(token, {
        ...binding,
        origin: "http://localhost:3000",
      }),
    ).toBe(false);
    expect(
      authority.authorize(token, {
        ...binding,
        authority: "127.0.0.1:65535",
      }),
    ).toBe(false);
    expect(authority.authorize(token, binding)).toBe(true);
    authority.close();
  });

  it("rotates atomically without extending the absolute deadline", () => {
    let now = 100;
    const secret = freshSecret();
    const authority = PersonalOwnerSessionAuthority.create(secret, {
      absoluteTtlMs: 1_000,
      idleTtlMs: 400,
      now: () => now,
    });
    const original = authority.bootstrap(secret, binding);
    if (original === undefined) throw new Error("Expected a session token.");

    now = 300;
    const replacement = authority.rotate(original, binding);
    expect(replacement).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    if (replacement === undefined)
      throw new Error("Expected a replacement token.");
    expect(replacement).not.toBe(original);
    expect(authority.authorize(original, binding)).toBe(false);
    expect(authority.authorize(replacement, binding)).toBe(true);

    now = 1_100;
    expect(authority.authorize(replacement, binding)).toBe(false);
    authority.close();
  });

  it("enforces half-open idle and absolute expiry with clock rollback denial", () => {
    let now = 10;
    const firstSecret = freshSecret();
    const idleAuthority = PersonalOwnerSessionAuthority.create(firstSecret, {
      absoluteTtlMs: 1_000,
      idleTtlMs: 100,
      now: () => now,
    });
    const idleToken = idleAuthority.bootstrap(firstSecret, binding);
    if (idleToken === undefined) throw new Error("Expected a session token.");
    now = 109;
    expect(idleAuthority.authorize(idleToken, binding)).toBe(true);
    now = 209;
    expect(idleAuthority.authorize(idleToken, binding)).toBe(false);
    idleAuthority.close();

    now = 500;
    const secondSecret = freshSecret();
    const rollbackAuthority = PersonalOwnerSessionAuthority.create(
      secondSecret,
      { absoluteTtlMs: 1_000, idleTtlMs: 500, now: () => now },
    );
    const rollbackToken = rollbackAuthority.bootstrap(secondSecret, binding);
    if (rollbackToken === undefined)
      throw new Error("Expected a session token.");
    now = 499;
    expect(rollbackAuthority.authorize(rollbackToken, binding)).toBe(false);
    now = 500;
    expect(rollbackAuthority.authorize(rollbackToken, binding)).toBe(false);
    rollbackAuthority.close();
  });

  it("invalidates immediately on logout, revocation, and process close", () => {
    const logoutSecret = freshSecret();
    const logoutAuthority = PersonalOwnerSessionAuthority.create(logoutSecret);
    const logoutToken = logoutAuthority.bootstrap(logoutSecret, binding);
    if (logoutToken === undefined) throw new Error("Expected a session token.");
    expect(logoutAuthority.logout(logoutToken, binding)).toBe(true);
    expect(logoutAuthority.authorize(logoutToken, binding)).toBe(false);
    expect(logoutAuthority.bootstrap(logoutSecret, binding)).toBeUndefined();
    logoutAuthority.close();

    const revokeSecret = freshSecret();
    const revokeAuthority = PersonalOwnerSessionAuthority.create(revokeSecret);
    const revokeToken = revokeAuthority.bootstrap(revokeSecret, binding);
    if (revokeToken === undefined) throw new Error("Expected a session token.");
    expect(revokeAuthority.revoke(revokeToken, binding)).toBe(true);
    expect(revokeAuthority.authorize(revokeToken, binding)).toBe(false);
    revokeAuthority.close();

    const closeSecret = freshSecret();
    const closeAuthority = PersonalOwnerSessionAuthority.create(closeSecret);
    const closeToken = closeAuthority.bootstrap(closeSecret, binding);
    if (closeToken === undefined) throw new Error("Expected a session token.");
    closeAuthority.close();
    closeAuthority.close();
    expect(closeAuthority.authorize(closeToken, binding)).toBe(false);
    expect(closeAuthority.rotate(closeToken, binding)).toBeUndefined();
    expect(closeAuthority.bootstrap(closeSecret, binding)).toBeUndefined();
  });

  it("fails closed when its clock or entropy source becomes invalid", () => {
    const clockSecret = freshSecret();
    const clockAuthority = PersonalOwnerSessionAuthority.create(clockSecret, {
      now: () => Number.NaN,
    });
    expect(clockAuthority.bootstrap(clockSecret, binding)).toBeUndefined();
    clockAuthority.close();

    const entropySecret = freshSecret();
    let calls = 0;
    const entropyAuthority = PersonalOwnerSessionAuthority.create(
      entropySecret,
      {
        randomBytes: (size) => {
          calls += 1;
          return calls === 1 ? randomBytes(size) : new Uint8Array(size - 1);
        },
      },
    );
    expect(entropyAuthority.bootstrap(entropySecret, binding)).toBeUndefined();
    entropyAuthority.close();
  });
});

function freshSecret(): string {
  return randomBytes(32).toString("hex");
}
