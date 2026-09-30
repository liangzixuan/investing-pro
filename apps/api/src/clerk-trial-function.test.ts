import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as appwriteTransport from "./appwrite-transport";
import * as watchlistRepository from "./appwrite-watchlist-repository";
import type { MainWatchlistRepository } from "./watchlist-repository";
import {
  createClerkTrialFunction,
  type ClerkTrialFunctionContext,
} from "./clerk-trial-function";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const key = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const origin = "https://investment-clerk-6abac57a.appwrite.network";
const productionOrigin = "https://app.investingpro.app";
const productionIssuer = "https://clerk.investingpro.app";
const productionSubject = "user_syntheticProductionOwner";

function productionConfiguration(allowedSubject: string | null) {
  return {
    environment: "production",
    auth: {
      issuer: productionIssuer,
      jwtKey: key,
      allowedSubject,
      authorizedParties: [productionOrigin],
    },
    allowedOrigins: [productionOrigin],
  };
}

function productionToken(
  overrides: Record<string, unknown> = {},
  signingKey = keys.privateKey,
) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: productionIssuer,
    sub: productionSubject,
    azp: productionOrigin,
    sid: "sess_productionFixture",
    iat: now,
    nbf: now - 1,
    exp: now + 60,
    v: 2,
    sts: "active",
    ...overrides,
  };
  const header = { alg: "RS256", typ: "JWT", kid: "synthetic-key" };
  const unsigned = [header, claims]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".");
  return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), signingKey).toString("base64url")}`;
}

function productionRequest(token: string, requestOrigin = productionOrigin) {
  return context({
    path: "/v1/trial/watchlist",
    headers: {
      origin: requestOrigin,
      authorization: `Bearer ${token}`,
      "x-appwrite-key": "synthetic-service-key",
    },
  });
}
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

  it("opens only the fixed production repository for the copied allowed subject and closes it after a read", async () => {
    const input = productionConfiguration(productionSubject);
    const productionRun = createClerkTrialFunction(input);
    input.auth.allowedSubject = "user_differentAccount";
    const get = vi.fn<MainWatchlistRepository["get"]>().mockResolvedValue(null);
    const put = vi.fn<MainWatchlistRepository["put"]>();
    const repository = vi
      .spyOn(watchlistRepository, "createAppwriteWatchlistRepository")
      .mockReturnValue({ get, put });
    const open = vi.spyOn(appwriteTransport, "createAppwriteTransport");
    const fetch = vi.fn(() => {
      throw new Error("Unexpected network");
    });
    vi.stubGlobal("fetch", fetch);

    expect(
      await productionRun(productionRequest(productionToken())),
    ).toMatchObject({
      status: 200,
      body: { version: 0, selected: [], note: "" },
      headers: { "access-control-allow-origin": productionOrigin },
    });
    expect(open).toHaveBeenCalledExactlyOnceWith({
      endpoint: "https://nyc.cloud.appwrite.io/v1",
    });
    expect(repository).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        databaseId: "investment_clerk_prod_trial_v1",
        watchlistsTableId: "watchlists",
        receiptsTableId: "receipts",
      }),
    );
    expect(get).toHaveBeenCalledOnce();
    expect(get.mock.calls[0]?.[0].userId).toMatch(/^clerk-[a-f0-9]{30}$/u);
    expect(put).not.toHaveBeenCalled();
    const opened = open.mock.results[0]?.value as
      ReturnType<typeof appwriteTransport.createAppwriteTransport> | undefined;
    expect(opened?.snapshot().closed).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [
      "different subject",
      { sub: "user_differentAccount" },
      productionOrigin,
      403,
      "access_denied",
    ],
    [
      "development issuer",
      { iss: "https://allowed-lobster-3386.clerk.accounts.dev" },
      productionOrigin,
      401,
      "unauthenticated",
    ],
    [
      "different authorized party",
      { azp: "https://unrelated.invalid" },
      productionOrigin,
      401,
      "unauthenticated",
    ],
    [
      "missing authorized party",
      { azp: undefined },
      productionOrigin,
      401,
      "unauthenticated",
    ],
    [
      "inactive session",
      { sts: "pending" },
      productionOrigin,
      401,
      "unauthenticated",
    ],
    ["expired session", { exp: 1 }, productionOrigin, 401, "unauthenticated"],
    ["native origin", {}, "https://localhost", 403, "origin_denied"],
    ["unrelated origin", {}, "https://unrelated.invalid", 403, "origin_denied"],
  ] as const)(
    "keeps production %s denied before storage opens",
    async (_name, claims, requestOrigin, status, error) => {
      const productionRun = createClerkTrialFunction(
        productionConfiguration(productionSubject),
      );
      const open = vi.spyOn(appwriteTransport, "createAppwriteTransport");
      const fetch = vi.fn(() => {
        throw new Error("Unexpected network");
      });
      vi.stubGlobal("fetch", fetch);
      expect(
        await productionRun(
          productionRequest(productionToken(claims), requestOrigin),
        ),
      ).toMatchObject({
        status,
        body: { error },
      });
      expect(open).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("rejects another signing key even when the production subject matches", async () => {
    const productionRun = createClerkTrialFunction(
      productionConfiguration(productionSubject),
    );
    const otherKey = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }).privateKey;
    const open = vi.spyOn(appwriteTransport, "createAppwriteTransport");
    expect(
      await productionRun(productionRequest(productionToken({}, otherKey))),
    ).toMatchObject({
      status: 401,
      body: { error: "unauthenticated" },
    });
    expect(open).not.toHaveBeenCalled();
  });

  it("rejects a missing environment before composing a function", () => {
    expect(() =>
      createClerkTrialFunction({ auth: {}, allowedOrigins: [] }),
    ).toThrow("Invalid Clerk function configuration");
  });
});
