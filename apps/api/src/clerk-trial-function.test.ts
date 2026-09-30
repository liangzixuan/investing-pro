import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as appwriteTransport from "./appwrite-transport";
import {
  createClerkTrialFunction,
  type ClerkTrialFunctionContext,
} from "./clerk-trial-function";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const key = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const origin = "https://investment-clerk-6abac57a.appwrite.network";
const run = createClerkTrialFunction({
  environment: "development",
  auth: {
    issuer: "https://allowed-lobster-3386.clerk.accounts.dev",
    jwtKey: key,
    allowedSubject: null,
    authorizedParties: [origin],
  },
  allowedOrigins: [origin],
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function context(
  overrides: Partial<ClerkTrialFunctionContext["req"]> = {},
): ClerkTrialFunctionContext {
  return {
    req: {
      method: "GET",
      path: "/v1/trial/session",
      bodyText: "",
      headers: { origin },
      ...overrides,
    },
    res: {
      json: (body, status, headers) => ({ body, status, headers }),
      text: (body, status, headers) => ({ body, status, headers }),
      empty: () => ({ status: 204 }),
    },
  };
}
describe("Appwrite Clerk trial adapter", () => {
  it("does not trust platform user or execution-key headers as account authority", async () => {
    const result = await run(
      context({
        headers: {
          origin,
          "x-appwrite-user-id": "owner",
          "x-appwrite-key": "synthetic-service-key",
        },
      }),
    );
    expect(result).toMatchObject({
      status: 401,
      body: { error: "unauthenticated" },
    });
    expect(JSON.stringify(result)).not.toContain("synthetic-service-key");
  });
  it("returns exact preflight headers without a JSON body", async () => {
    expect(
      await run(
        context({
          method: "OPTIONS",
          headers: {
            origin,
            "access-control-request-method": "GET",
            "access-control-request-headers": "Authorization",
          },
        }),
      ),
    ).toMatchObject({
      status: 204,
      body: "",
      headers: { "access-control-allow-origin": origin },
    });
  });
  it.each([
    "//elsewhere.invalid",
    "v1/trial/session",
    "/v1/trial/session?unexpected=1",
  ])("rejects altered request paths %s", async (path) => {
    expect(await run(context({ path }))).toMatchObject({ status: 404 });
  });
  it("rejects platform queryString before authentication", async () => {
    expect(await run(context({ queryString: "unexpected=1" }))).toMatchObject({
      status: 404,
    });
  });
  it("bounds buffered platform bodies", async () => {
    expect(
      await run(
        context({
          method: "POST",
          path: "/v1/trial/watchlist",
          bodyText: "x".repeat(8193),
        }),
      ),
    ).toMatchObject({ status: 413 });
  });
  it("rejects an unapproved browser origin without a CORS grant", async () => {
    const result = await run(
      context({ headers: { origin: "https://unrelated.invalid" } }),
    );
    expect(result).toMatchObject({ status: 403 });
    expect(JSON.stringify(result)).not.toContain("access-control-allow-origin");
  });

  it.each(["GET", "POST"])(
    "denies a correctly signed production %s session before opening storage",
    async (method) => {
      const productionOrigin = "https://app.investingpro.app";
      const now = Math.floor(Date.now() / 1000);
      const claims = {
        iss: "https://clerk.investingpro.app",
        sub: "user_syntheticOwner",
        azp: productionOrigin,
        sid: "sess_productionFixture",
        iat: now,
        nbf: now - 1,
        exp: now + 60,
        v: 2,
        sts: "active",
      };
      const unsigned = `${Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "synthetic-key" })).toString("base64url")}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}`;
      const token = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), keys.privateKey).toString("base64url")}`;
      const input = {
        environment: "production",
        auth: {
          issuer: claims.iss,
          jwtKey: key,
          allowedSubject: null as string | null,
          authorizedParties: [productionOrigin],
        },
        allowedOrigins: [productionOrigin],
      };
      const productionRun = createClerkTrialFunction(input);
      input.auth.allowedSubject = claims.sub;
      const open = vi
        .spyOn(appwriteTransport, "createAppwriteTransport")
        .mockImplementation(() => {
          throw new Error("Unexpected transport");
        });
      const fetch = vi.fn(() => {
        throw new Error("Unexpected network");
      });
      vi.stubGlobal("fetch", fetch);
      expect(
        await productionRun(
          context({
            method,
            path: "/v1/trial/watchlist",
            headers: {
              origin: productionOrigin,
              authorization: `Bearer ${token}`,
              "x-appwrite-key": "synthetic-service-key",
              "content-type": "application/json",
            },
            bodyText:
              method === "POST"
                ? JSON.stringify({
                    expectedVersion: 0,
                    idempotencyKey: "synthetic-command-key-0001",
                    selected: [],
                    note: "",
                  })
                : "",
          }),
        ),
      ).toMatchObject({ status: 403, body: { error: "access_denied" } });
      expect(open).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("does not retain mutable configuration origin arrays in its request closure", async () => {
    const input = {
      environment: "development",
      auth: {
        issuer: "https://allowed-lobster-3386.clerk.accounts.dev",
        jwtKey: key,
        allowedSubject: null,
        authorizedParties: [origin],
      },
      allowedOrigins: [origin],
    };
    const checkedRun = createClerkTrialFunction(input);
    input.allowedOrigins[0] = "https://changed.invalid";
    input.auth.authorizedParties[0] = "https://changed.invalid";
    expect(
      await checkedRun(
        context({
          method: "OPTIONS",
          headers: {
            origin,
            "access-control-request-method": "GET",
            "access-control-request-headers": "Authorization",
          },
        }),
      ),
    ).toMatchObject({ status: 204 });
    expect(
      await checkedRun(
        context({ headers: { origin: "https://changed.invalid" } }),
      ),
    ).toMatchObject({ status: 403 });
  });

  it("rejects a missing environment before composing a function", () => {
    expect(() =>
      createClerkTrialFunction({ auth: {}, allowedOrigins: [] }),
    ).toThrow("Invalid Clerk function configuration");
  });
});
