import { beforeAll, describe, expect, it } from "vitest";

import {
  createPersonalOwnerAccountRecord,
  type PersonalOwnerAccountRecord,
} from "./personal-owner-account";
import { PersonalOwnerSessionAuthority } from "./personal-owner-session";

const username = "synthetic.owner";
const password = "A synthetic reusable passphrase";
const binding = {
  authority: "127.0.0.1:3100",
  origin: "http://127.0.0.1:3000",
};
let account: PersonalOwnerAccountRecord;

beforeAll(async () => {
  account = await createPersonalOwnerAccountRecord(username, password);
});

describe("owner account sessions", () => {
  it("reuses the account after logout, expiry, and process restart without bootstrap", async () => {
    let now = 1_000;
    const authority = PersonalOwnerSessionAuthority.createWithAccount(account, {
      now: () => now,
      idleTtlMs: 10,
      absoluteTtlMs: 50,
    });
    expect(authority.bootstrap("a".repeat(64), binding)).toBeUndefined();
    const initial = await authority.login(username, password, binding);
    if (initial.kind !== "accepted")
      throw new Error("Expected a synthetic login.");
    expect(authority.authorize(initial.token, binding)).toBe(true);
    expect(authority.logout(initial.token, binding)).toBe(true);
    expect(authority.authorize(initial.token, binding)).toBe(false);
    const afterLogout = await authority.login(username, password, binding);
    if (afterLogout.kind !== "accepted")
      throw new Error("Expected a synthetic login.");
    now += 10;
    expect(authority.authorize(afterLogout.token, binding)).toBe(false);
    const afterExpiry = await authority.login(username, password, binding);
    if (afterExpiry.kind !== "accepted")
      throw new Error("Expected a synthetic login.");
    authority.close();
    expect(authority.authorize(afterExpiry.token, binding)).toBe(false);
    expect((await authority.login(username, password, binding)).kind).toBe(
      "denied",
    );
    const restarted = PersonalOwnerSessionAuthority.createWithAccount(account);
    const afterRestart = await restarted.login(username, password, binding);
    expect(afterRestart.kind).toBe("accepted");
    if (afterRestart.kind === "accepted")
      expect(afterRestart.token).not.toBe(afterExpiry.token);
    restarted.close();
  }, 15_000);

  it("rejects wrong credentials without disturbing a valid session and replaces it on successful login", async () => {
    const authority = PersonalOwnerSessionAuthority.createWithAccount(account);
    const first = await authority.login(username, password, binding);
    if (first.kind !== "accepted")
      throw new Error("Expected a synthetic login.");
    expect(await authority.login("different.owner", password, binding)).toEqual(
      { kind: "denied" },
    );
    expect(
      await authority.login(username, "Another synthetic passphrase", binding),
    ).toEqual({ kind: "denied" });
    expect(authority.authorize(first.token, binding)).toBe(true);
    const second = await authority.login(username, password, binding);
    if (second.kind !== "accepted")
      throw new Error("Expected a synthetic login.");
    expect(authority.authorize(first.token, binding)).toBe(false);
    expect(
      authority.authorize(second.token, {
        ...binding,
        origin: "http://localhost:3000",
      }),
    ).toBe(false);
    expect(authority.authorize(second.token, binding)).toBe(true);
    authority.close();
  }, 15_000);

  it("bounds guessing across usernames and allows retry when the process window expires", async () => {
    let now = 100;
    const authority = PersonalOwnerSessionAuthority.createWithAccount(account, {
      now: () => now,
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        await authority.login(
          `other${String(attempt)}`,
          "Wrong synthetic passphrase",
          binding,
        ),
      ).toEqual({ kind: "denied" });
    }
    expect(await authority.login(username, password, binding)).toEqual({
      kind: "rate-limited",
      retryAfterSeconds: 60,
    });
    now += 59_999;
    expect(await authority.login(username, password, binding)).toEqual({
      kind: "rate-limited",
      retryAfterSeconds: 1,
    });
    now += 1;
    expect((await authority.login(username, password, binding)).kind).toBe(
      "accepted",
    );
    authority.close();
  }, 15_000);

  it("runs only one password KDF at once and prevents a late login after close", async () => {
    const authority = PersonalOwnerSessionAuthority.createWithAccount(account);
    const attempts = await Promise.all(
      Array.from({ length: 20 }, () =>
        authority.login(username, password, binding),
      ),
    );
    expect(
      attempts.filter((result) => result.kind === "accepted"),
    ).toHaveLength(1);
    expect(
      attempts.filter((result) => result.kind === "rate-limited"),
    ).toHaveLength(19);
    authority.close();
    const closing = PersonalOwnerSessionAuthority.createWithAccount(account);
    const pending = closing.login(username, password, binding);
    closing.close();
    expect(await pending).toEqual({ kind: "denied" });
  });

  it("rejects password login in legacy mode and fails closed on an invalid login clock", async () => {
    const legacy = PersonalOwnerSessionAuthority.create("a".repeat(64));
    expect(await legacy.login(username, password, binding)).toEqual({
      kind: "denied",
    });
    expect(legacy.bootstrap("a".repeat(64), binding)).toBeDefined();
    legacy.close();
    let now = 100;
    const authority = PersonalOwnerSessionAuthority.createWithAccount(account, {
      now: () => now,
    });
    const accepted = await authority.login(username, password, binding);
    if (accepted.kind !== "accepted")
      throw new Error("Expected a synthetic login.");
    now = 99;
    expect(await authority.login(username, password, binding)).toEqual({
      kind: "denied",
    });
    now = 101;
    expect(authority.authorize(accepted.token, binding)).toBe(false);
    now = Number.NaN;
    expect(await authority.login(username, password, binding)).toEqual({
      kind: "denied",
    });
    authority.close();
  });
});
