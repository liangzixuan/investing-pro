import { generateKeyPairSync, sign } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createClerkTrialAuth,
  type ClerkTrialAuthOptions,
} from "./clerk-trial-auth";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const OTHER_KEYS = generateKeyPairSync("rsa", { modulusLength: 2048 });
const ISSUER = "https://trial.clerk.accounts.dev";
const ORIGIN = "https://trial.example.invalid";
const OPTIONS: ClerkTrialAuthOptions = {
  issuer: ISSUER,
  jwtKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
  allowedSubject: "user_trialOwner",
  authorizedParties: [ORIGIN],
};
function token(
  changes: Record<string, unknown> = {},
  privateKey = keys.privateKey,
) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: ISSUER,
    sub: OPTIONS.allowedSubject,
    azp: ORIGIN,
    sid: "sess_trialOne",
    iat: now,
    nbf: now - 1,
    exp: now + 60,
    v: 2,
    fva: [0, -1],
    ...changes,
  };
  const input = `${Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "synthetic-key" })).toString("base64url")}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
}
function request(value = token(), extra: Record<string, string> = {}) {
  return new Request("https://api.example.invalid/v1/trial/session", {
    headers: { authorization: `Bearer ${value}`, origin: ORIGIN, ...extra },
  });
}
afterEach(() => vi.unstubAllGlobals());

describe("Clerk trial actual SDK session verification", () => {
  it("verifies an actual RSA-signed session using the pinned public key without fetch", async () => {
    const fetch = vi.fn(() => {
      throw new Error("Unexpected network");
    });
    vi.stubGlobal("fetch", fetch);
    const result = await createClerkTrialAuth(OPTIONS)(request());
    expect(result.status).toBe("allowed");
    if (result.status !== "allowed")
      throw new Error("Expected verified session");
    expect(result.principal.userId).toMatch(/^clerk-[0-9a-f]{30}$/u);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps two allowed sessions under the same repository principal", async () => {
    const auth = createClerkTrialAuth(OPTIONS);
    expect(await auth(request(token({ sid: "sess_secondDevice" })))).toEqual(
      await auth(request()),
    );
  });
  it("denies a correctly signed different subject without trusting an email", async () => {
    expect(
      await createClerkTrialAuth(OPTIONS)(
        request(token({ sub: "user_other", email: "owner@example.invalid" })),
      ),
    ).toEqual({ status: "access_denied" });
  });
  it.each([
    { iss: "https://other.clerk.accounts.dev" },
    { azp: "https://other.example.invalid" },
    { azp: undefined },
    { sid: undefined },
    { sid: "m2m_token" },
    { exp: 1 },
    { exp: undefined },
    { iat: undefined },
    { nbf: undefined },
    { nbf: Math.floor(Date.now() / 1000) + 3600 },
    { sts: "pending" },
    { act: { sub: "user_impersonator" } },
    { sub: "mch_trial", sid: undefined },
  ])("rejects invalid or incomplete signed claims %#", async (claims) => {
    expect(await createClerkTrialAuth(OPTIONS)(request(token(claims)))).toEqual(
      { status: "unauthenticated" },
    );
  });
  it("rejects a forged signature and a malformed bearer without network", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const auth = createClerkTrialAuth(OPTIONS);
    expect(await auth(request(token({}, OTHER_KEYS.privateKey)))).toEqual({
      status: "unauthenticated",
    });
    expect(await auth(request("invalid"))).toEqual({
      status: "unauthenticated",
    });
    expect(await auth(request("mt_machine_token"))).toEqual({
      status: "unauthenticated",
    });
    expect(
      await auth(request(token(), { cookie: "__session=ignored" })),
    ).toEqual({ status: "unauthenticated" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(
    [
      [],
      ["*"],
      ["null"],
      ["https://trial.example.invalid/path"],
      [ORIGIN, ORIGIN],
    ].map((parties) => ({ parties })),
  )("rejects invalid authorized parties %j", ({ parties }) => {
    expect(() =>
      createClerkTrialAuth({ ...OPTIONS, authorizedParties: parties }),
    ).toThrow();
  });
  it("rejects every verified subject while owner setup is pending", async () => {
    expect(
      await createClerkTrialAuth({ ...OPTIONS, allowedSubject: null })(
        request(),
      ),
    ).toEqual({ status: "access_denied" });
  });
  it("admits absent azp only for the explicitly configured native origin after SDK signature/session verification", async () => {
    const auth = createClerkTrialAuth({
      ...OPTIONS,
      authorizedParties: [ORIGIN, "https://localhost"],
      nativeOrigin: "https://localhost",
    });
    expect(
      await auth(
        request(token({ azp: undefined }), { origin: "https://localhost" }),
      ),
    ).toMatchObject({ status: "allowed" });
    expect(await auth(request(token({ azp: undefined })))).toEqual({
      status: "unauthenticated",
    });
    expect(
      await auth(
        request(token({ azp: undefined }), { origin: "capacitor://localhost" }),
      ),
    ).toEqual({ status: "unauthenticated" });
    expect(
      await auth(
        request(token({ azp: "https://wrong.example.invalid" }), {
          origin: "https://localhost",
        }),
      ),
    ).toEqual({ status: "unauthenticated" });
    expect(
      await auth(
        request(token({ azp: undefined }, OTHER_KEYS.privateKey), {
          origin: "https://localhost",
        }),
      ),
    ).toEqual({ status: "unauthenticated" });
    expect(
      await auth(
        request(token({ azp: undefined, sub: "user_other" }), {
          origin: "https://localhost",
        }),
      ),
    ).toEqual({ status: "access_denied" });
  });
  it("freezes owner and party configuration independently of caller mutation", async () => {
    const parties = [ORIGIN];
    const config = { ...OPTIONS, authorizedParties: parties };
    const auth = createClerkTrialAuth(config);
    parties.push("https://other.example.invalid");
    config.allowedSubject = "user_other";
    expect(
      await auth(request(token({ azp: "https://other.example.invalid" }))),
    ).toEqual({ status: "unauthenticated" });
    expect(await auth(request())).toMatchObject({ status: "allowed" });
  });
});
