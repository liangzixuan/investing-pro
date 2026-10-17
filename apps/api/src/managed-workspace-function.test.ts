import { createHash, generateKeyPairSync, sign } from "node:crypto";

import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
  MANAGED_RESEARCH_FOLLOWUPS_LIMITS,
  MANAGED_RESEARCH_FOLLOWUPS_PATH,
  MANAGED_ECONOMIC_CALENDAR_PATH,
  MANAGED_MONETARY_ANNOUNCEMENTS_PATH,
  PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
  parseManagedMonetaryAnnouncements,
  parseManagedEconomicCalendar,
  type ManagedWatchlistCommand,
  type ManagedResearchFollowupsCommand,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolvePersonalSecAnnualCanonicalIncome,
  resolvePersonalSecAnnualCanonicalOperatingResults,
  resolvePersonalSecAnnualCanonicalLiquidity,
} from "@research-cockpit/personal-financial-analytics";

import * as authModule from "./clerk-trial-auth";
import * as configModule from "./clerk-trial-config";
import * as transportModule from "./appwrite-transport";
import * as repositoryModule from "./appwrite-watchlist-repository";
import * as followupsRepositoryModule from "./appwrite-research-followups-repository";
import * as versionedStoreModule from "./appwrite-versioned-row-store";
import * as catalogModule from "./managed-workspace-catalog";
import * as secAdmissionModule from "./managed-sec-admission";
import * as eodAdmissionModule from "./managed-eod-admission";
import * as beaProviderModule from "./bea-release-provider";
import * as fedProviderModule from "./fed-monetary-announcements-provider";
import * as annualServiceModule from "./managed-sec-annual-service";
import * as eodServiceModule from "./managed-eod-service";
import {
  MANAGED_EOD_MAPPING_CANDIDATES,
  MANAGED_EOD_TOKEN_ENVIRONMENT_KEY,
} from "./managed-eod-config";
import main, {
  createManagedWorkspaceFunction,
  type ManagedWorkspaceFunctionContext,
} from "./managed-workspace-function";
import type { MainWatchlistRepository } from "./watchlist-repository";
import type { ResearchFollowupsRepository } from "./research-followups-repository";

const ORIGIN = "https://app.investingpro.app";
const NATIVE_ORIGIN = "https://localhost";
const ISSUER = "https://clerk.investingpro.app";
const SUBJECT = "user_inventedManagedOwner";
const WATCHLIST = "/v1/managed/watchlist";
const RESOLVE = "/v1/managed/catalog/resolve";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicKey = keys.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
function configuration() {
  return {
    environment: "production",
    auth: {
      issuer: ISSUER,
      jwtKey: publicKey,
      allowedSubject: SUBJECT as string | null,
      authorizedParties: [ORIGIN],
    },
    allowedOrigins: [ORIGIN],
  };
}
function token(patch: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const data = [
    { alg: "RS256", typ: "JWT", kid: "invented-key" },
    {
      iss: ISSUER,
      sub: SUBJECT,
      azp: ORIGIN,
      sid: "sess_inventedManaged",
      iat: now,
      nbf: now - 1,
      exp: now + 120,
      v: 2,
      sts: "active",
      ...patch,
    },
  ];
  const unsigned = data
    .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
    .join(".");
  return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), keys.privateKey).toString("base64url")}`;
}
function context(
  patch: Partial<ManagedWorkspaceFunctionContext["req"]> = {},
): ManagedWorkspaceFunctionContext {
  return {
    req: {
      method: "GET",
      path: "/v1/managed/catalog",
      queryString: "",
      bodyBinary: Buffer.alloc(0),
      headers: {
        origin: ORIGIN,
        authorization: `Bearer ${token()}`,
        "x-appwrite-key": "invented-execution-authority",
      },
      ...patch,
    },
    res: {
      json: (body, status, headers) => ({ body, status, headers }),
      text: (body, status, headers) => ({
        body: body === "" ? "" : (JSON.parse(body) as unknown),
        status,
        headers,
      }),
    },
  };
}
function command(): ManagedWatchlistCommand {
  return {
    expectedVersion: 0,
    idempotencyKey: "invented-managed-save-0001",
    payload: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: `sha256:${"b".repeat(64)}`,
      memberships: [],
    },
  };
}
function writeContext(path = WATCHLIST, value: unknown = command()) {
  const c = context({
    method: "POST",
    path,
    bodyBinary: Buffer.from(JSON.stringify(value)),
  });
  return {
    ...c,
    req: {
      ...c.req,
      headers: { ...c.req.headers, "content-type": "application/json" },
    },
  };
}
function memoryRepository() {
  const get = vi.fn<MainWatchlistRepository["get"]>().mockResolvedValue(null);
  const put = vi
    .fn<MainWatchlistRepository["put"]>()
    .mockImplementation((_principal, value) =>
      Promise.resolve({
        id: "main",
        version: value.expectedVersion + 1,
        replayed: true,
        committedAt: "2026-10-01T00:00:00.000Z",
        digestSha256: createHash("sha256")
          .update(encodeMainWatchlistPayload(value.payload))
          .digest("hex"),
      }),
    );
  const repository = vi
    .spyOn(repositoryModule, "createAppwriteWatchlistRepository")
    .mockReturnValue({ get, put });
  const transport = vi.spyOn(transportModule, "createAppwriteTransport");
  return { get, put, repository, transport };
}
beforeEach(() => {
  vi.stubGlobal("__MANAGED_EOD_CONFIG__", null);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected network");
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("managed production Appwrite function", () => {
  it("uses the checked production auth and a separate fixed repository per operation", async () => {
    const f = memoryRepository(),
      input = configuration(),
      run = createManagedWorkspaceFunction(input, null, null);
    input.auth.allowedSubject = "user_changed";
    const first = await run(context({ path: WATCHLIST }));
    expect(first).toMatchObject({
      status: 200,
      body: { version: 0, payload: { name: "My Watchlist", memberships: [] } },
    });
    const written = await run(writeContext());
    expect(written).toMatchObject({
      status: 200,
      body: { version: 1, payload: command().payload, replayed: true },
    });
    expect(f.repository).toHaveBeenCalledTimes(2);
    for (const [options] of f.repository.mock.calls)
      expect(options).toMatchObject({
        databaseId: "investment_managed_watchlist_v1",
        watchlistsTableId: "watchlists",
        receiptsTableId: "receipts",
      });
    for (const [options] of f.transport.mock.calls) {
      expect(options.endpoint).toBe("https://nyc.cloud.appwrite.io/v1");
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
    for (const result of f.transport.mock.results)
      expect(
        (
          result.value as ReturnType<
            typeof transportModule.createAppwriteTransport
          >
        ).snapshot().closed,
      ).toBe(true);
    expect(f.get.mock.calls[0]?.[0].userId).toMatch(/^clerk-[a-f0-9]{30}$/u);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reads the admitted catalog and resolves without execution authority or storage", async () => {
    const f = memoryRepository(),
      run = createManagedWorkspaceFunction(configuration(), null, null),
      c = context();
    const headers = {
      origin: ORIGIN,
      authorization: c.req.headers.authorization,
    };
    expect(await run({ ...c, req: { ...c.req, headers } })).toMatchObject({
      status: 200,
    });
    const snapshotSha256 = catalogModule.createManagedCatalogService().status()
      .snapshot.snapshotSha256;
    const resolve = writeContext(RESOLVE, {
      snapshotSha256,
      listingIds: ["MissingOlderId"],
    });
    expect(
      await run({
        ...resolve,
        req: {
          ...resolve.req,
          headers: { ...headers, "content-type": "application/json" },
        },
      }),
    ).toMatchObject({
      status: 200,
      body: {
        snapshotSha256,
        results: [{ listingId: "MissingOlderId", listing: null }],
      },
    });
    expect(f.transport).not.toHaveBeenCalled();
  });

  it("admits native sessions to the same principal without changing the captured web policy", async () => {
    const f = memoryRepository(),
      input = configuration(),
      run = createManagedWorkspaceFunction(input, null, null);
    input.auth.allowedSubject = "user_changed";
    input.auth.issuer = `${ISSUER}.invalid`;
    input.auth.jwtKey = "changed";
    input.auth.authorizedParties.push(NATIVE_ORIGIN);
    input.allowedOrigins.push(NATIVE_ORIGIN);
    for (const [origin, azp] of [
      [ORIGIN, ORIGIN],
      [NATIVE_ORIGIN, undefined],
      [NATIVE_ORIGIN, NATIVE_ORIGIN],
    ]) {
      const c = context({ path: WATCHLIST });
      expect(
        await run({
          ...c,
          req: {
            ...c.req,
            headers: {
              ...c.req.headers,
              origin,
              authorization: `Bearer ${token({ azp })}`,
            },
          },
        }),
      ).toMatchObject({
        status: 200,
        body: { version: 0 },
        headers: { "access-control-allow-origin": origin, vary: "Origin" },
      });
    }
    const principal = f.get.mock.calls[0]?.[0];
    expect(principal?.userId).toMatch(/^clerk-[a-f0-9]{30}$/u);
    expect(f.get.mock.calls.map(([value]) => value)).toEqual([
      principal,
      principal,
      principal,
    ]);
    const nativeSave = writeContext();
    expect(
      await run({
        ...nativeSave,
        req: {
          ...nativeSave.req,
          headers: {
            ...nativeSave.req.headers,
            origin: NATIVE_ORIGIN,
            authorization: `Bearer ${token({ azp: undefined })}`,
          },
        },
      }),
    ).toMatchObject({
      status: 200,
      body: { version: 1, payload: command().payload, replayed: true },
    });
    expect(f.put).toHaveBeenCalledExactlyOnceWith(principal, command());
    expect(f.repository).toHaveBeenCalledTimes(4);
    for (const [options] of f.repository.mock.calls)
      expect(options.databaseId).toBe("investment_managed_watchlist_v1");
    for (const result of f.transport.mock.results)
      expect(
        (
          result.value as ReturnType<
            typeof transportModule.createAppwriteTransport
          >
        ).snapshot().closed,
      ).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["subject", { sub: "user_other" }, 403],
    ["issuer", { iss: `${ISSUER}.invalid` }, 401],
    ["party", { azp: `${ORIGIN}.invalid` }, 401],
    ["missing party", { azp: undefined }, 401],
    ["native party", { azp: NATIVE_ORIGIN }, 401],
    ["expired", { exp: 1 }, 401],
    ["inactive", { sts: "pending" }, 401],
  ] as const)(
    "rejects %s before opening storage",
    async (_reason, patch, status) => {
      const f = memoryRepository(),
        run = createManagedWorkspaceFunction(configuration(), null, null),
        c = context({ path: WATCHLIST });
      expect(
        await run({
          ...c,
          req: {
            ...c.req,
            headers: {
              ...c.req.headers,
              authorization: `Bearer ${token(patch)}`,
            },
          },
        }),
      ).toMatchObject({ status });
      expect(f.transport).not.toHaveBeenCalled();
    },
  );

  it.each([ORIGIN, NATIVE_ORIGIN])(
    "does not trust execution headers or cookies at %s",
    async (origin) => {
      const f = memoryRepository(),
        run = createManagedWorkspaceFunction(configuration(), null, null),
        c = context({ path: WATCHLIST });
      for (const headers of [
        {
          origin,
          "x-appwrite-key": "invented-key",
          "x-appwrite-user-id": SUBJECT,
        },
        {
          ...c.req.headers,
          origin,
          authorization: `Bearer ${token({ azp: origin })}`,
          cookie: "invented=only",
        },
      ]) {
        expect(await run({ ...c, req: { ...c.req, headers } })).toMatchObject({
          status: 401,
        });
      }
      expect(f.transport).not.toHaveBeenCalled();
    },
  );

  it.each([ORIGIN, NATIVE_ORIGIN])(
    "keeps account admission closed at %s",
    async (origin) => {
      const f = memoryRepository(),
        input = configuration();
      input.auth.allowedSubject = null;
      const run = createManagedWorkspaceFunction(input, null, null),
        c = context({ path: WATCHLIST });
      expect(
        await run({
          ...c,
          req: {
            ...c.req,
            headers: {
              ...c.req.headers,
              origin,
              authorization: `Bearer ${token({ azp: origin })}`,
            },
          },
        }),
      ).toMatchObject({ status: 403, body: { error: "access_denied" } });
      expect(f.transport).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["web party", { azp: ORIGIN }, "unauthenticated"],
    ["foreign party", { azp: `${NATIVE_ORIGIN}.invalid` }, "unauthenticated"],
    ["null party", { azp: null }, "unauthenticated"],
    ["non-string party", { azp: [NATIVE_ORIGIN] }, "unauthenticated"],
    ["foreign issuer", { iss: `${ISSUER}.invalid` }, "unauthenticated"],
    ["expired", { exp: 1 }, "unauthenticated"],
    [
      "future",
      { nbf: Math.floor(Date.now() / 1000) + 3600 },
      "unauthenticated",
    ],
    ["missing session", { sid: undefined }, "unauthenticated"],
    ["actor", { act: { sub: SUBJECT } }, "unauthenticated"],
    ["pending session", { sts: "pending" }, "unauthenticated"],
    ["other subject", { sub: "user_other" }, "access_denied"],
  ] as const)(
    "rejects native %s before storage",
    async (_reason, claims, error) => {
      const f = memoryRepository(),
        run = createManagedWorkspaceFunction(configuration(), null, null),
        c = context({ path: WATCHLIST });
      expect(
        await run({
          ...c,
          req: {
            ...c.req,
            headers: {
              ...c.req.headers,
              origin: NATIVE_ORIGIN,
              authorization: `Bearer ${token({ azp: undefined, ...claims })}`,
            },
          },
        }),
      ).toMatchObject({
        status: error === "access_denied" ? 403 : 401,
        body: { error },
      });
      expect(f.transport).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    undefined,
    "null",
    `${ORIGIN}/`,
    `${NATIVE_ORIGIN}/`,
    `${NATIVE_ORIGIN}:443`,
    `${NATIVE_ORIGIN}.invalid`,
    "http://localhost",
  ])(
    "rejects origin %s without inspecting the body or execution authority",
    async (origin) => {
      const authenticate = vi.fn<authModule.ClerkTrialAuth>();
      vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(
        authenticate,
      );
      const f = memoryRepository(),
        run = createManagedWorkspaceFunction(configuration(), null, null),
        c = context();
      Object.defineProperty(c.req, "bodyBinary", {
        get: () => {
          throw new Error("Body must not be read");
        },
      });
      const executionKey = vi.fn(() => {
        throw new Error("Authority must not be read");
      });
      const headers = { origin };
      Object.defineProperty(headers, "x-appwrite-key", { get: executionKey });
      Object.defineProperty(c.req, "headers", { value: headers });
      const result = await run(c);
      expect(result).toEqual({
        status: 403,
        body: { error: "origin_denied" },
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          vary: "Origin",
        },
      });
      expect(authenticate).not.toHaveBeenCalled();
      expect(executionKey).not.toHaveBeenCalled();
      expect(f.transport).not.toHaveBeenCalled();
    },
  );

  it("returns a finite missing execution authority failure before put", async () => {
    const f = memoryRepository(),
      run = createManagedWorkspaceFunction(configuration(), null, null),
      c = writeContext();
    expect(
      await run({
        ...c,
        req: {
          ...c.req,
          headers: { ...c.req.headers, "x-appwrite-key": undefined },
        },
      }),
    ).toMatchObject({ status: 503, body: { error: "unavailable" } });
    expect(f.transport).not.toHaveBeenCalled();
    expect(f.put).not.toHaveBeenCalled();
  });

  it("closes transport if repository composition fails", async () => {
    const f = memoryRepository();
    f.repository.mockImplementation(() => {
      throw new Error("private detail");
    });
    expect(
      await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )(context({ path: WATCHLIST })),
    ).toMatchObject({ status: 503, body: { error: "unavailable" } });
    expect(
      (
        f.transport.mock.results[0]?.value as ReturnType<
          typeof transportModule.createAppwriteTransport
        >
      ).snapshot().closed,
    ).toBe(true);
  });

  it("requires production and rejects arbitrary storage configuration", () => {
    const input = configuration();
    expect(() =>
      createManagedWorkspaceFunction(
        { ...input, databaseId: "other" },
        null,
        null,
      ),
    ).toThrow();
    expect(() =>
      createManagedWorkspaceFunction(
        {
          ...input,
          auth: { ...input.auth, nativeOrigin: NATIVE_ORIGIN },
        },
        null,
        null,
      ),
    ).toThrow();
    expect(() =>
      createManagedWorkspaceFunction(
        {
          ...input,
          auth: { ...input.auth, authorizedParties: [ORIGIN, NATIVE_ORIGIN] },
          allowedOrigins: [ORIGIN, NATIVE_ORIGIN],
        },
        null,
        null,
      ),
    ).toThrow();
    expect(() =>
      createManagedWorkspaceFunction(
        {
          environment: "development",
          auth: {
            ...input.auth,
            issuer: "https://allowed-lobster-3386.clerk.accounts.dev",
            authorizedParties: [
              "https://investment-clerk-6abac57a.appwrite.network",
            ],
          },
          allowedOrigins: [
            "https://investment-clerk-6abac57a.appwrite.network",
          ],
        },
        null,
        null,
      ),
    ).toThrow("Managed function requires production configuration");
  });
});

describe("managed binary and supplied query bridge", () => {
  it("answers the native POST preflight without authenticating or opening storage", async () => {
    const authenticate = vi.fn<authModule.ClerkTrialAuth>();
    vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(authenticate);
    const f = memoryRepository(),
      run = createManagedWorkspaceFunction(configuration(), null, null);
    expect(
      await run(
        context({
          method: "OPTIONS",
          path: WATCHLIST,
          headers: {
            origin: NATIVE_ORIGIN,
            "access-control-request-method": "POST",
            "access-control-request-headers": "authorization, content-type",
          },
        }),
      ),
    ).toMatchObject({
      status: 204,
      body: "",
      headers: {
        "access-control-allow-origin": NATIVE_ORIGIN,
        "access-control-allow-methods": "GET, POST",
        "access-control-allow-headers": "Authorization, Content-Type",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
    expect(authenticate).not.toHaveBeenCalled();
    expect(f.transport).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "{}", new Uint8Array(), {}])(
    "requires a Buffer for bodyBinary %#",
    async (body) => {
      const f = memoryRepository(),
        run = createManagedWorkspaceFunction(configuration(), null, null);
      expect(await run(context({ bodyBinary: body as Buffer }))).toMatchObject({
        status: 400,
        body: { error: "invalid_request" },
      });
      expect(f.transport).not.toHaveBeenCalled();
    },
  );

  it.each(["GET", "OPTIONS"])(
    "rejects nonempty %s bytes instead of discarding them",
    async (method) => {
      const run = createManagedWorkspaceFunction(configuration(), null, null);
      expect(
        await run(context({ method, bodyBinary: Buffer.from("x") })),
      ).toMatchObject({ status: 400 });
    },
  );

  it.each([
    Buffer.from([0xc3]),
    Buffer.from([0xed, 0xa0, 0x80]),
    Buffer.from("{"),
  ])(
    "rejects malformed supplied bytes %# without write uncertainty",
    async (bodyBinary) => {
      const f = memoryRepository(),
        run = createManagedWorkspaceFunction(configuration(), null, null),
        c = writeContext();
      expect(await run({ ...c, req: { ...c.req, bodyBinary } })).toMatchObject({
        status: 400,
        body: { error: "invalid_request" },
      });
      expect(f.transport).not.toHaveBeenCalled();
    },
  );

  it.each([
    [WATCHLIST, 266241],
    [RESOLVE, 8193],
  ] as const)(
    "bounds actual Buffer bytes for %s before auth",
    async (path, size) => {
      const auth = vi
        .spyOn(authModule, "createClerkTrialAuth")
        .mockReturnValue(vi.fn());
      const run = createManagedWorkspaceFunction(configuration(), null, null);
      expect(
        await run(
          context({ method: "POST", path, bodyBinary: Buffer.alloc(size) }),
        ),
      ).toMatchObject({ status: 413 });
      expect(auth.mock.results[0]?.value).not.toHaveBeenCalled();
    },
  );

  it("takes ownership of binary input before authentication awaits", async () => {
    let allow!: (value: authModule.ClerkTrialAuthResult) => void;
    vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(
      () =>
        new Promise((resolve) => {
          allow = resolve;
        }),
    );
    const f = memoryRepository(),
      run = createManagedWorkspaceFunction(configuration(), null, null),
      c = writeContext();
    const result = run(c);
    c.req.bodyBinary.fill(0xff);
    allow({ status: "allowed", principal: { userId: "invented-principal" } });
    expect(await result).toMatchObject({
      status: 200,
      body: { payload: command().payload },
    });
    expect(f.put.mock.calls[0]?.[1]).toEqual(command());
  });

  it.each([
    "q=AAPL\t",
    "q=AAPL\n",
    "q= AAPL",
    "q=é",
    "q=AAPL#lost",
    "q='AAPL'",
    "?q=AAPL",
    "q=%",
    "q=%71&extra=1",
    "%71=AAPL",
    "q=AAPL&q=GOOG",
  ])("rejects unsupported supplied query %j", async (queryString) => {
    const run = createManagedWorkspaceFunction(configuration(), null, null);
    expect(
      await run(context({ path: "/v1/managed/catalog/search", queryString })),
    ).toMatchObject({ status: 400 });
  });

  it("forwards one supplied query separator and decodes its value once", async () => {
    const service = catalogModule.createManagedCatalogService(),
      result = service.search("AAPL");
    const search = vi.fn(() => result);
    vi.spyOn(catalogModule, "createManagedCatalogService").mockReturnValue({
      ...service,
      search,
    });
    const run = createManagedWorkspaceFunction(configuration(), null, null);
    expect(
      await run(
        context({
          path: "/v1/managed/catalog/search",
          queryString: "q=+AAPL%253F?",
        }),
      ),
    ).toMatchObject({ status: 200 });
    expect(search).toHaveBeenCalledExactlyOnceWith(" AAPL%3F?");
    expect(await run(context({ queryString: "" }))).toMatchObject({
      status: 200,
    });
  });

  it.each([
    "/v1/managed/catalog?",
    "/v1/managed/../managed/catalog",
    "//other.invalid/catalog",
    "/v1/managed/catalog#fragment",
  ])("rejects supplied path normalization at %s", async (path) => {
    expect(
      await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )(context({ path })),
    ).toMatchObject({ status: 404 });
  });

  it("keeps resolve failures unavailable and preserves exact preflight headers", async () => {
    const service = catalogModule.createManagedCatalogService();
    vi.spyOn(catalogModule, "createManagedCatalogService").mockReturnValue({
      ...service,
      resolve: () => {
        throw new Error("invented failure");
      },
    });
    const run = createManagedWorkspaceFunction(configuration(), null, null);
    expect(
      await run(
        writeContext(RESOLVE, {
          snapshotSha256: service.status().snapshot.snapshotSha256,
          listingIds: ["listing-demo"],
        }),
      ),
    ).toMatchObject({ status: 503, body: { error: "unavailable" } });
    expect(
      await run(
        context({
          method: "OPTIONS",
          path: RESOLVE,
          headers: {
            origin: ORIGIN,
            "access-control-request-method": "POST",
            "access-control-request-headers": "authorization, content-type",
          },
        }),
      ),
    ).toMatchObject({
      status: 204,
      body: "",
      headers: {
        "access-control-allow-origin": ORIGIN,
        "access-control-allow-methods": "POST",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  });
});

describe("managed annual composed function", () => {
  const path = "/v1/managed/sec-annual-evidence";
  const annualConfig = {
    userAgent: "Synthetic managed fixture fixture@example.test",
  };
  it.each([2_000, 10_000])(
    "counts %ims of default-entry configuration time before storage or SEC",
    async (delay) => {
      let elapsed = 0;
      vi.spyOn(performance, "now").mockImplementation(() => elapsed);
      const validate = configModule.validateClerkTrialFunctionConfiguration;
      vi.spyOn(
        configModule,
        "validateClerkTrialFunctionConfiguration",
      ).mockImplementation((input) => {
        elapsed += delay;
        return validate(input);
      });
      vi.stubGlobal("__MANAGED_WORKSPACE_SERVER_CONFIG__", configuration());
      vi.stubGlobal("__MANAGED_SEC_CONFIG__", annualConfig);
      const f = memoryRepository();
      expect(await main(writeContext(path, annualCommand()))).toMatchObject({
        status: 408,
        body: { error: "request_timeout" },
      });
      expect(f.transport).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    },
  );
  function annualCommand(symbol = "AAPL") {
    const service = catalogModule.createManagedCatalogService();
    const selected = service
      .search(symbol)!
      .results.find((row) => row.symbol === symbol)!;
    return {
      schemaVersion: PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
      catalogSnapshotSha256: service.status().snapshot.snapshotSha256,
      listingId: selected.listingId,
      symbol,
    };
  }
  it("rejects missing separate source configuration at construction; explicitnull fails after signed auth", async () => {
    expect(() =>
      createManagedWorkspaceFunction(configuration(), undefined, null),
    ).toThrow();
    const f = memoryRepository();
    const run = createManagedWorkspaceFunction(configuration(), null, null);
    expect(await run(writeContext(path, annualCommand()))).toMatchObject({
      status: 503,
      body: { error: "not_configured" },
    });
    expect(f.transport).not.toHaveBeenCalled();
    expect(f.repository).not.toHaveBeenCalled();
  });
  it.each([ORIGIN, NATIVE_ORIGIN])(
    "keeps the signed %s caller and fixed admission storage separate from watchlist writes",
    async (origin) => {
      const f = memoryRepository();
      const reserve = vi
        .fn()
        .mockRejectedValue(
          new secAdmissionModule.ManagedSecAdmissionError(
            "rate_limited",
            "2026-10-01T12:00:20.000Z",
          ),
        );
      const admission = vi
        .spyOn(secAdmissionModule, "createManagedSecAdmission")
        .mockReturnValue({ reserve });
      const run = createManagedWorkspaceFunction(
          configuration(),
          annualConfig,
          null,
        ),
        c = writeContext(path, annualCommand());
      const answer = await run({
        ...c,
        req: {
          ...c.req,
          headers: {
            ...c.req.headers,
            origin,
            authorization: `Bearer ${token({ azp: origin })}`,
          },
        },
      });
      expect(answer).toMatchObject({
        status: 429,
        body: {
          error: "rate_limited",
          nextAllowedAt: "2026-10-01T12:00:20.000Z",
        },
      });
      expect(admission).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseId: "investment_managed_watchlist_v1",
          tableId: "sec_annual_budget",
          rowId: "observed-annual-v1",
        }),
      );
      const limits = f.transport.mock.calls[0]![0].limits!;
      expect(limits.maxRequests).toBe(6);
      expect(limits.timeoutMs).toBeGreaterThan(0);
      expect(limits.timeoutMs).toBeLessThanOrEqual(2_000);
      expect(limits.mutationWindowMs).toBe(limits.timeoutMs);
      expect(limits.requestTimeoutMs).toBe(limits.timeoutMs);
      const transport = f.transport.mock.results[0]!.value as ReturnType<
        typeof transportModule.createAppwriteTransport
      >;
      expect(transport.client.config.project).toBe("6abac57a0007b7c1a671");
      expect(f.put).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(reserve).toHaveBeenCalledTimes(1);
    },
  );
  it("bounds supplied annual bytes and query before auth or storage", async () => {
    const authenticate = vi.fn<authModule.ClerkTrialAuth>();
    vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(authenticate);
    const f = memoryRepository(),
      run = createManagedWorkspaceFunction(configuration(), annualConfig, null);
    expect(
      await run(
        context({ method: "POST", path, bodyBinary: Buffer.alloc(4097) }),
      ),
    ).toMatchObject({ status: 413 });
    expect(
      await run(context({ method: "POST", path, queryString: "x=1" })),
    ).toMatchObject({ status: 400 });
    expect(f.transport).not.toHaveBeenCalled();
    expect(authenticate).not.toHaveBeenCalled();
  });
  it("composes signed auth, acknowledged admission and two invented SEC packets without watchlist access", async () => {
    const f = memoryRepository();
    const reserve = vi.fn().mockResolvedValue({
      version: 2,
      nextAllowedAt: new Date(Date.now() + 20_000).toISOString(),
    });
    vi.spyOn(secAdmissionModule, "createManagedSecAdmission").mockReturnValue({
      reserve,
    });
    const accession = "0000320193-25-000042";
    const fact = {
      start: "2024-10-01",
      end: "2025-09-30",
      val: 120,
      accn: accession,
      fy: 2025,
      fp: "FY",
      form: "10-K",
      filed: "2025-11-01",
    };
    const packets = [
      {
        cik: "0000320193",
        filings: {
          recent: {
            accessionNumber: [accession],
            form: ["10-K"],
            filingDate: ["2025-11-01"],
            reportDate: ["2025-09-30"],
            acceptanceDateTime: ["2025-11-01T12:00:00.000Z"],
          },
          files: [],
        },
      },
      {
        cik: 320193,
        facts: {
          "us-gaap": {
            Revenues: { units: { USD: [fact] } },
            NetIncomeLoss: { units: { USD: [{ ...fact, val: -30 }] } },
            OperatingIncomeLoss: { units: { USD: [{ ...fact, val: 18 }] } },
            AssetsCurrent: {
              units: { USD: [{ ...fact, start: undefined, val: 120 }] },
            },
            LiabilitiesCurrent: {
              units: { USD: [{ ...fact, start: undefined, val: 80 }] },
            },
          },
        },
      },
    ];
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(packets[0]))
      .mockResolvedValueOnce(Response.json(packets[1]));
    vi.stubGlobal("fetch", fetch);
    const run = createManagedWorkspaceFunction(
      configuration(),
      annualConfig,
      null,
    );
    const answer = await run(writeContext(path, annualCommand()));
    expect(answer).toMatchObject({
      status: 200,
      body: {
        schemaVersion: "6.0.0",
        security: { symbol: "AAPL", cik: "0000320193" },
        evidence: { generation: { definitionVersion: "6.0.0" } },
      },
    });
    const evidence = (answer as { body: PersonalSecAnnualCanonicalResponseDto })
      .body.evidence;
    expect(evidence.facts.scans).toHaveLength(32);
    expect(
      evidence.facts.observations.every((row) => !Object.hasOwn(row, "metric")),
    ).toBe(true);
    expect(resolvePersonalSecAnnualCanonicalIncome(evidence)).toMatchObject({
      currentTargetEligible: true,
    });
    expect(
      resolvePersonalSecAnnualCanonicalOperatingResults(evidence),
    ).toMatchObject({
      operatingIncome: { status: "available", unit: "USD", value: "18" },
      margins: [
        { concept: "RevenueFromContractWithCustomerExcludingAssessedTax" },
        {
          concept: "Revenues",
          revenue: { status: "available", value: "120" },
          operatingMargin: {
            status: "available",
            unit: "percent",
            value: "15",
          },
        },
        { concept: "SalesRevenueNet" },
      ],
    });
    expect(resolvePersonalSecAnnualCanonicalLiquidity(evidence)).toMatchObject({
      workingCapital: { status: "available", unit: "USD", value: "40" },
      currentRatio: { status: "available", unit: "multiple", value: "1.50" },
    });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://data.sec.gov/submissions/CIK0000320193.json",
      "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
    ]);
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(f.repository).not.toHaveBeenCalled();
    const transport = f.transport.mock.results[0]!.value as ReturnType<
      typeof transportModule.createAppwriteTransport
    >;
    expect(transport.snapshot().closed).toBe(true);
  });
  it("expires slow auth from function entry without opening storage or source", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(
        () => new Promise(() => undefined),
      );
      const f = memoryRepository(),
        run = createManagedWorkspaceFunction(
          configuration(),
          annualConfig,
          null,
        );
      const pending = run(writeContext(path, annualCommand()));
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await pending).toMatchObject({
        status: 408,
        body: { error: "request_timeout" },
      });
      expect(f.transport).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("managed EOD composed function", () => {
  const path = "/v1/managed/eod-history";
  const eodConfig = { enabledSymbols: ["AAPL"] };
  const eodCommand = () => ({
    catalogSnapshotSha256:
      catalogModule.getManagedWorkspaceCatalog().snapshotSha256,
    listingId: MANAGED_EOD_MAPPING_CANDIDATES.find(
      (x) => x.security.symbol === "AAPL",
    )!.security.listingId,
    range: "1m",
  });
  it("requires an explicit third public input and keeps other routes usable when EOD is closed", async () => {
    expect(() =>
      createManagedWorkspaceFunction(configuration(), null, undefined),
    ).toThrow("Invalid managed EOD configuration");
    const f = memoryRepository(),
      run = createManagedWorkspaceFunction(configuration(), null, null);
    expect(await run(writeContext(path, eodCommand()))).toMatchObject({
      status: 503,
      body: { error: "not_configured" },
    });
    expect(await run(context())).toMatchObject({ status: 200 });
    expect(f.transport).not.toHaveBeenCalled();
  });
  it("does not reserve with a missing runtime key or start source work before signed authentication", async () => {
    vi.stubEnv(MANAGED_EOD_TOKEN_ENVIRONMENT_KEY, undefined);
    const f = memoryRepository(),
      run = createManagedWorkspaceFunction(configuration(), null, eodConfig);
    expect(await run(writeContext(path, eodCommand()))).toMatchObject({
      status: 503,
      body: { error: "not_configured" },
    });
    const c = writeContext(path, eodCommand());
    expect(
      await run({
        ...c,
        req: {
          ...c.req,
          headers: { origin: ORIGIN, "content-type": "application/json" },
        },
      }),
    ).toMatchObject({ status: 401 });
    expect(f.transport).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it.each([ORIGIN, NATIVE_ORIGIN])(
    "uses signed %s auth, separate fixed budget and one history-only source",
    async (origin) => {
      vi.stubEnv(MANAGED_EOD_TOKEN_ENVIRONMENT_KEY, "invented-eod-only-token");
      const f = memoryRepository();
      const reserve = vi.fn(() =>
        Promise.resolve({ version: 2, reservedAt: new Date().toISOString() }),
      );
      const admission = vi
        .spyOn(eodAdmissionModule, "createManagedEodAdmission")
        .mockReturnValue({ reserve });
      const date = new Date().toISOString().slice(0, 10);
      const fetch = vi.fn<typeof globalThis.fetch>(() =>
        Promise.resolve(
          Response.json([
            {
              date: `${date}T00:00:00.000Z`,
              open: 100,
              high: 110,
              low: 90,
              close: 101.125,
              volume: 1000,
              adjOpen: 100,
              adjHigh: 110,
              adjLow: 90,
              adjClose: 101.125,
              adjVolume: 1000,
              divCash: 0,
              splitFactor: 1,
            },
          ]),
        ),
      );
      vi.stubGlobal("fetch", fetch);
      const c = writeContext(path, eodCommand());
      const answer = await createManagedWorkspaceFunction(
        configuration(),
        null,
        eodConfig,
      )({
        ...c,
        req: {
          ...c.req,
          headers: {
            ...c.req.headers,
            origin,
            authorization: `Bearer ${token({ azp: origin })}`,
          },
        },
      });
      expect(answer).toMatchObject({
        status: 200,
        body: {
          security: { symbol: "AAPL" },
          rows: [{ date, close: "101.125" }],
          priceBasis: "raw_close",
        },
      });
      expect(JSON.stringify(answer)).not.toContain("invented-eod-only-token");
      expect(JSON.stringify(answer)).not.toContain(
        "invented-execution-authority",
      );
      expect(admission).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseId: "investment_managed_watchlist_v1",
          tableId: "tiingo_eod_budget",
          rowId: "managed-eod-v1",
        }),
      );
      expect(reserve).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0]![0]).toEqual(
        expect.stringContaining("/tiingo/daily/AAPL/prices?"),
      );
      expect(
        new Headers(fetch.mock.calls[0]![1]?.headers).get("authorization"),
      ).toBe("Token invented-eod-only-token");
      expect(f.repository).not.toHaveBeenCalled();
      const limits = f.transport.mock.calls[0]![0].limits!;
      expect(limits.maxRequests).toBe(6);
      expect(limits.timeoutMs).toBeLessThanOrEqual(2000);
      const transport = f.transport.mock.results[0]!.value as ReturnType<
        typeof transportModule.createAppwriteTransport
      >;
      expect(transport.snapshot().closed).toBe(true);
    },
  );
  it("returns quota or storage denial without source work or commit_unknown", async () => {
    vi.stubEnv(MANAGED_EOD_TOKEN_ENVIRONMENT_KEY, "invented-token");
    const f = memoryRepository();
    vi.spyOn(eodAdmissionModule, "createManagedEodAdmission").mockReturnValue({
      reserve: vi.fn(() =>
        Promise.reject(
          new eodAdmissionModule.ManagedEodAdmissionError(
            "rate_limited",
            "2026-10-03T12:00:00.000Z",
          ),
        ),
      ),
    });
    const run = createManagedWorkspaceFunction(
      configuration(),
      null,
      eodConfig,
    );
    expect(await run(writeContext(path, eodCommand()))).toMatchObject({
      status: 429,
      body: {
        error: "rate_limited",
        nextAllowedAt: "2026-10-03T12:00:00.000Z",
      },
    });
    const c = writeContext(path, eodCommand());
    expect(
      await run({
        ...c,
        req: {
          ...c.req,
          headers: { ...c.req.headers, "x-appwrite-key": undefined },
        },
      }),
    ).toMatchObject({ status: 503, body: { error: "unavailable" } });
    expect(f.repository).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("bounds EOD bytes/query before auth and counts default-entry configuration time", async () => {
    const auth = vi.fn<authModule.ClerkTrialAuth>();
    vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(auth);
    const run = createManagedWorkspaceFunction(
      configuration(),
      null,
      eodConfig,
    );
    expect(
      await run(
        context({ method: "POST", path, bodyBinary: Buffer.alloc(4097) }),
      ),
    ).toMatchObject({ status: 413 });
    expect(
      await run(context({ method: "POST", path, queryString: "x=1" })),
    ).toMatchObject({ status: 400 });
    expect(auth).not.toHaveBeenCalled();
  });
  it.each([2000, 10000])(
    "accounts for %ims of default-entry setup before EOD admission",
    async (delay) => {
      let elapsed = 0;
      vi.spyOn(performance, "now").mockImplementation(() => elapsed);
      const validate = configModule.validateClerkTrialFunctionConfiguration;
      vi.spyOn(
        configModule,
        "validateClerkTrialFunctionConfiguration",
      ).mockImplementation((input) => {
        elapsed += delay;
        return validate(input);
      });
      vi.stubGlobal("__MANAGED_WORKSPACE_SERVER_CONFIG__", configuration());
      vi.stubGlobal("__MANAGED_SEC_CONFIG__", null);
      vi.stubGlobal("__MANAGED_EOD_CONFIG__", eodConfig);
      vi.stubEnv(MANAGED_EOD_TOKEN_ENVIRONMENT_KEY, "invented-token");
      const f = memoryRepository();
      expect(await main(writeContext(path, eodCommand()))).toMatchObject({
        status: 408,
        body: { error: "request_timeout" },
      });
      expect(f.transport).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    },
  );
  it("retires uncooperative auth under the whole EOD deadline", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(
        () => new Promise(() => undefined),
      );
      const f = memoryRepository();
      const pending = createManagedWorkspaceFunction(
        configuration(),
        null,
        eodConfig,
      )(writeContext(path, eodCommand()));
      await vi.advanceTimersByTimeAsync(10000);
      expect(await pending).toMatchObject({
        status: 408,
        body: { error: "request_timeout" },
      });
      expect(f.transport).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("managed BEA calendar composed function", () => {
  const path = MANAGED_ECONOMIC_CALENDAR_PATH;
  const schedule = () => ({
    "Invented GDP": {
      release_dates: [new Date(Date.now() + 86_400_000).toISOString()],
    },
  });
  it.each([ORIGIN, NATIVE_ORIGIN])(
    "loads one fixed public request for the signed %s caller without execution credentials or storage",
    async (origin) => {
      const f = memoryRepository();
      const annual = vi.spyOn(
        annualServiceModule,
        "createManagedSecAnnualService",
      );
      const eod = vi.spyOn(eodServiceModule, "createManagedEodService");
      const provider = vi.spyOn(beaProviderModule, "createBeaReleaseProvider");
      const fetch = vi.fn(() => Promise.resolve(Response.json(schedule())));
      vi.stubGlobal("fetch", fetch);
      const run = createManagedWorkspaceFunction(configuration(), null, null);
      expect(provider).not.toHaveBeenCalled();
      const answer = (await run(
        context({
          path,
          headers: {
            origin,
            authorization: `Bearer ${token({ azp: origin })}`,
          },
        }),
      )) as { status: number; body: unknown; headers: Record<string, string> };
      expect(answer.status).toBe(200);
      expect(parseManagedEconomicCalendar(answer.body)?.events[0]?.series).toBe(
        "Invented GDP",
      );
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(fetch).toHaveBeenCalledExactlyOnceWith(
        "https://apps.bea.gov/API/signup/release_dates.json",
        {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
          cache: "no-store",
          signal: expect.any(AbortSignal) as AbortSignal,
        },
      );
      expect(provider).toHaveBeenCalledOnce();
      expect(annual).not.toHaveBeenCalled();
      expect(eod).not.toHaveBeenCalled();
      expect(f.transport).not.toHaveBeenCalled();
      expect(f.repository).not.toHaveBeenCalled();
    },
  );
  it.each([
    { method: "POST", bodyBinary: Buffer.from("{}") },
    { method: "HEAD" },
    { bodyBinary: Buffer.from("x") },
    { queryString: "days=365" },
    { headers: { origin: ORIGIN } },
    { headers: { origin: "https://untrusted.example" } },
  ])(
    "denies an unadmitted calendar request before upstream or repository work %#",
    async (patch) => {
      const f = memoryRepository();
      const provider = vi.spyOn(beaProviderModule, "createBeaReleaseProvider");
      const answer = (await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )(context({ path, ...patch }))) as { status: number };
      expect([400, 401, 403, 405]).toContain(answer.status);
      expect(provider).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(f.transport).not.toHaveBeenCalled();
    },
  );
  it("includes default-entry configuration work in its total deadline before BEA can start", async () => {
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    const validate = configModule.validateClerkTrialFunctionConfiguration;
    vi.spyOn(
      configModule,
      "validateClerkTrialFunctionConfiguration",
    ).mockImplementation((input) => {
      elapsed = 10_000;
      return validate(input);
    });
    vi.stubGlobal("__MANAGED_WORKSPACE_SERVER_CONFIG__", configuration());
    vi.stubGlobal("__MANAGED_SEC_CONFIG__", null);
    const f = memoryRepository();
    expect(await main(context({ path }))).toMatchObject({
      status: 408,
      body: { error: "request_timeout" },
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(f.transport).not.toHaveBeenCalled();
  });
  it("bounds stalled authentication and rejects its late acceptance without creating a provider", async () => {
    vi.useFakeTimers();
    let finish!: (value: authModule.ClerkTrialAuthResult) => void;
    vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const provider = vi.spyOn(beaProviderModule, "createBeaReleaseProvider");
    const f = memoryRepository();
    const pending = createManagedWorkspaceFunction(
      configuration(),
      null,
      null,
    )(context({ path }));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toMatchObject({
      status: 408,
      body: { error: "request_timeout" },
    });
    finish({
      status: "allowed",
      principal: { userId: "invented-calendar-owner" },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(provider).not.toHaveBeenCalled();
    expect(f.transport).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("bounds provider work by time left after auth, closes it, and makes no retry", async () => {
    vi.useFakeTimers();
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(() => {
      elapsed = 4_000;
      return Promise.resolve({
        status: "allowed",
        principal: { userId: "invented-calendar-owner" },
      });
    });
    const original = beaProviderModule.createBeaReleaseProvider;
    const close = vi.fn();
    vi.spyOn(beaProviderModule, "createBeaReleaseProvider").mockImplementation(
      () => {
        const provider = original();
        return {
          load: provider.load.bind(provider),
          close: () => {
            close();
            provider.close();
          },
        };
      },
    );
    const fetch = vi.fn<typeof globalThis.fetch>(
      () => new Promise(() => undefined),
    );
    vi.stubGlobal("fetch", fetch);
    const f = memoryRepository();
    const pending = createManagedWorkspaceFunction(
      configuration(),
      null,
      null,
    )(context({ path }));
    await vi.advanceTimersByTimeAsync(5_999);
    expect(close).not.toHaveBeenCalled();
    elapsed = 10_000;
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({
      status: 408,
      body: { error: "request_timeout" },
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    expect(f.transport).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("checks the total deadline after reading the serialized response body", async () => {
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json(schedule()))),
    );
    vi.spyOn(Response.prototype, "text").mockImplementation(() => {
      elapsed = 10_000;
      return Promise.resolve("{}");
    });
    const f = memoryRepository();
    expect(
      await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )(context({ path })),
    ).toMatchObject({ status: 408, body: { error: "request_timeout" } });
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(f.transport).not.toHaveBeenCalled();
  });
  it.each(["invalid", "failure"] as const)(
    "returns generic unavailable for %s provider output without a source body",
    async (failure) => {
      const f = memoryRepository();
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          failure === "failure"
            ? Promise.reject(new Error("private-provider-body"))
            : Promise.resolve(Response.json({ "private-provider-body": {} })),
        ),
      );
      const answer = await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )(context({ path }));
      expect(answer).toMatchObject({
        status: 503,
        body: { error: "unavailable" },
      });
      expect(JSON.stringify(answer)).not.toContain("private-provider-body");
      expect(globalThis.fetch).toHaveBeenCalledOnce();
      expect(f.transport).not.toHaveBeenCalled();
    },
  );
});

describe("managed Fed announcements composed function", () => {
  const path = MANAGED_MONETARY_ANNOUNCEMENTS_PATH;
  const schedule = () => `<rss version="2.0"><channel>
    <title>FRB: Press Release - Monetary Policy</title>
    <link>https://www.federalreserve.gov/feeds/feeds.htm</link>
    <item><title>Invented monetary announcement</title>
      <link>https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm</link>
      <pubDate>Wed, 16 Sep 2026 18:00:00 GMT</pubDate></item>
    <item><title>Invented announcement without time</title>
      <link>https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916b.htm</link></item>
  </channel></rss>`;
  it.each([ORIGIN, NATIVE_ORIGIN])(
    "loads one fixed public request for the signed %s caller without execution credentials or storage",
    async (origin) => {
      const f = memoryRepository();
      const annual = vi.spyOn(
        annualServiceModule,
        "createManagedSecAnnualService",
      );
      const eod = vi.spyOn(eodServiceModule, "createManagedEodService");
      const provider = vi.spyOn(
        fedProviderModule,
        "createFedMonetaryAnnouncementsProvider",
      );
      const fetch = vi.fn(() => Promise.resolve(new Response(schedule())));
      vi.stubGlobal("fetch", fetch);
      const run = createManagedWorkspaceFunction(configuration(), null, null);
      expect(provider).not.toHaveBeenCalled();
      const answer = (await run(
        context({
          path,
          headers: {
            origin,
            authorization: `Bearer ${token({ azp: origin })}`,
          },
        }),
      )) as { status: number; body: unknown; headers: Record<string, string> };
      expect(answer.status).toBe(200);
      expect(
        parseManagedMonetaryAnnouncements(answer.body)?.items[0]?.title,
      ).toBe("Invented monetary announcement");
      expect(parseManagedMonetaryAnnouncements(answer.body)).toMatchObject({
        availableItemCount: 2,
        items: [
          { publishedAt: "2026-09-16T18:00:00.000Z" },
          { publishedAt: null },
        ],
      });
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(answer.headers["access-control-allow-origin"]).toBe(origin);
      expect(fetch).toHaveBeenCalledExactlyOnceWith(
        "https://www.federalreserve.gov/feeds/press_monetary.xml",
        {
          method: "GET",
          headers: { Accept: "application/rss+xml, application/xml;q=0.9" },
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
          cache: "no-store",
          signal: expect.any(AbortSignal) as AbortSignal,
        },
      );
      expect(provider).toHaveBeenCalledOnce();
      expect(annual).not.toHaveBeenCalled();
      expect(eod).not.toHaveBeenCalled();
      expect(f.transport).not.toHaveBeenCalled();
      expect(f.repository).not.toHaveBeenCalled();
    },
  );
  it.each([
    [{ method: "POST", bodyBinary: Buffer.from("{}") }, 400, "invalid_request"],
    [{ method: "POST" }, 400, "invalid_request"],
    [{ method: "HEAD" }, 405, "method_not_allowed"],
    [{ bodyBinary: Buffer.from("x") }, 400, "invalid_request"],
    [{ bodyBinary: Buffer.alloc(20_000) }, 413, "payload_too_large"],
    [{ queryString: "days=365" }, 400, "invalid_request"],
    [{ queryString: "%" }, 400, "invalid_request"],
    [{ headers: { origin: ORIGIN } }, 401, "unauthenticated"],
    [
      { headers: { origin: "https://untrusted.example" } },
      403,
      "origin_denied",
    ],
  ] as const)(
    "denies unadmitted announcements before provider, upstream or repository work %#",
    async (patch, status, code) => {
      const f = memoryRepository();
      const provider = vi.spyOn(
        fedProviderModule,
        "createFedMonetaryAnnouncementsProvider",
      );
      const answer = await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )(context({ path, ...patch }));
      expect(answer).toMatchObject({ status, body: { error: code } });
      expect(provider).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(f.transport).not.toHaveBeenCalled();
    },
  );
  it.each([
    [ORIGIN, NATIVE_ORIGIN],
    [NATIVE_ORIGIN, ORIGIN],
  ])(
    "refuses a valid token for a different authorized party (%s/%s)",
    async (origin, azp) => {
      const f = memoryRepository();
      const provider = vi.spyOn(
        fedProviderModule,
        "createFedMonetaryAnnouncementsProvider",
      );
      const answer = await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )(
        context({
          path,
          headers: { origin, authorization: `Bearer ${token({ azp })}` },
        }),
      );
      expect(answer).toMatchObject({
        status: 401,
        body: { error: "unauthenticated" },
      });
      expect(provider).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(f.transport).not.toHaveBeenCalled();
    },
  );
  it("refuses a signed non-owner before source construction", async () => {
    const f = memoryRepository();
    const provider = vi.spyOn(
      fedProviderModule,
      "createFedMonetaryAnnouncementsProvider",
    );
    const answer = await createManagedWorkspaceFunction(
      configuration(),
      null,
      null,
    )(
      context({
        path,
        headers: {
          origin: ORIGIN,
          authorization: `Bearer ${token({ sub: "user_otherInvented" })}`,
        },
      }),
    );
    expect(answer).toMatchObject({
      status: 403,
      body: { error: "access_denied" },
    });
    expect(provider).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(f.transport).not.toHaveBeenCalled();
  });
  it.each([ORIGIN, NATIVE_ORIGIN])(
    "admits only body-free GET preflight without auth or source (%s)",
    async (origin) => {
      const f = memoryRepository();
      const auth = vi.fn<authModule.ClerkTrialAuth>();
      vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(auth);
      const provider = vi.spyOn(
        fedProviderModule,
        "createFedMonetaryAnnouncementsProvider",
      );
      const run = createManagedWorkspaceFunction(configuration(), null, null);
      for (const [method, requestedHeaders, status] of [
        ["GET", "Authorization", 204],
        ["POST", "Authorization", 403],
        ["GET", "Authorization, Content-Type", 403],
        ["GET", "Authorization, Authorization", 403],
      ] as const) {
        expect(
          await run(
            context({
              path,
              method: "OPTIONS",
              headers: {
                origin,
                "access-control-request-method": method,
                "access-control-request-headers": requestedHeaders,
              },
            }),
          ),
        ).toMatchObject({ status });
      }
      expect(auth).not.toHaveBeenCalled();
      expect(provider).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(f.transport).not.toHaveBeenCalled();
    },
  );
  it("includes default-entry configuration work in its total deadline before Fed can start", async () => {
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    const validate = configModule.validateClerkTrialFunctionConfiguration;
    vi.spyOn(
      configModule,
      "validateClerkTrialFunctionConfiguration",
    ).mockImplementation((input) => {
      elapsed = 10_000;
      return validate(input);
    });
    vi.stubGlobal("__MANAGED_WORKSPACE_SERVER_CONFIG__", configuration());
    vi.stubGlobal("__MANAGED_SEC_CONFIG__", null);
    const f = memoryRepository();
    expect(await main(context({ path }))).toMatchObject({
      status: 408,
      body: { error: "request_timeout" },
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(f.transport).not.toHaveBeenCalled();
  });
  it("bounds stalled authentication and rejects its late acceptance without creating a provider", async () => {
    vi.useFakeTimers();
    let finish!: (value: authModule.ClerkTrialAuthResult) => void;
    vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const provider = vi.spyOn(
      fedProviderModule,
      "createFedMonetaryAnnouncementsProvider",
    );
    const f = memoryRepository();
    const pending = createManagedWorkspaceFunction(
      configuration(),
      null,
      null,
    )(context({ path }));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toMatchObject({
      status: 408,
      body: { error: "request_timeout" },
    });
    finish({
      status: "allowed",
      principal: { userId: "invented-announcements-owner" },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(provider).not.toHaveBeenCalled();
    expect(f.transport).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("bounds provider work by time left after auth, closes it, and makes no retry", async () => {
    vi.useFakeTimers();
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(() => {
      elapsed = 4_000;
      return Promise.resolve({
        status: "allowed",
        principal: { userId: "invented-announcements-owner" },
      });
    });
    const original = fedProviderModule.createFedMonetaryAnnouncementsProvider;
    const close = vi.fn();
    vi.spyOn(
      fedProviderModule,
      "createFedMonetaryAnnouncementsProvider",
    ).mockImplementation(() => {
      const provider = original();
      return {
        load: provider.load.bind(provider),
        close: () => {
          close();
          provider.close();
        },
      };
    });
    const fetch = vi.fn<typeof globalThis.fetch>(
      () => new Promise(() => undefined),
    );
    vi.stubGlobal("fetch", fetch);
    const f = memoryRepository();
    const pending = createManagedWorkspaceFunction(
      configuration(),
      null,
      null,
    )(context({ path }));
    await vi.advanceTimersByTimeAsync(5_999);
    expect(close).not.toHaveBeenCalled();
    elapsed = 10_000;
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({
      status: 408,
      body: { error: "request_timeout" },
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    expect(f.transport).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("checks the total deadline after reading the serialized response body", async () => {
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(schedule()))),
    );
    vi.spyOn(Response.prototype, "text").mockImplementation(() => {
      elapsed = 10_000;
      return Promise.resolve("{}");
    });
    const f = memoryRepository();
    expect(
      await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )(context({ path })),
    ).toMatchObject({ status: 408, body: { error: "request_timeout" } });
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(f.transport).not.toHaveBeenCalled();
  });
  it.each(["invalid", "failure", "status"] as const)(
    "returns generic unavailable for %s provider output without a source body",
    async (failure) => {
      const f = memoryRepository();
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          failure === "failure"
            ? Promise.reject(new Error("private-provider-body"))
            : Promise.resolve(
                new Response("private-provider-body", {
                  status: failure === "status" ? 429 : 200,
                }),
              ),
        ),
      );
      const answer = await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )(context({ path }));
      expect(answer).toMatchObject({
        status: 503,
        body: { error: "unavailable" },
      });
      expect(JSON.stringify(answer)).not.toContain("private-provider-body");
      expect(globalThis.fetch).toHaveBeenCalledOnce();
      expect(f.transport).not.toHaveBeenCalled();
    },
  );
});

describe("managed company filings composed function", () => {
  const path = "/v1/managed/sec-filings";
  const secConfig = { userAgent: "Invented SEC fixture fixture@example.test" };
  function filingsCommand() {
    const catalog = catalogModule.createManagedCatalogService();
    const selected = catalog
      .search("AAPL")!
      .results.find((row) => row.symbol === "AAPL")!;
    return {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: catalog.status().snapshot.snapshotSha256,
      listingId: selected.listingId,
      symbol: selected.symbol,
    };
  }
  it("rejects extra query, oversized bytes and wrong method without source or storage", async () => {
    const authenticate = vi.fn<authModule.ClerkTrialAuth>();
    vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(authenticate);
    const f = memoryRepository();
    const run = createManagedWorkspaceFunction(
      configuration(),
      secConfig,
      null,
    );
    expect(
      await run(
        context({ method: "POST", path, bodyBinary: Buffer.alloc(4097) }),
      ),
    ).toMatchObject({ status: 413 });
    expect(
      await run(context({ method: "POST", path, queryString: "cik=1" })),
    ).toMatchObject({ status: 400 });
    expect(await run(context({ method: "GET", path }))).toMatchObject({
      status: 405,
    });
    expect(authenticate).not.toHaveBeenCalled();
    expect(f.transport).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it.each([ORIGIN, NATIVE_ORIGIN])(
    "uses the existing SEC row for signed %s requests",
    async (origin) => {
      const f = memoryRepository();
      const reserve = vi
        .fn()
        .mockRejectedValue(
          new secAdmissionModule.ManagedSecAdmissionError(
            "rate_limited",
            "2026-10-12T12:00:20.000Z",
          ),
        );
      const admission = vi
        .spyOn(secAdmissionModule, "createManagedSecAdmission")
        .mockReturnValue({ reserve });
      const run = createManagedWorkspaceFunction(
        configuration(),
        secConfig,
        null,
      );
      const c = writeContext(path, filingsCommand());
      const result = await run({
        ...c,
        req: {
          ...c.req,
          headers: {
            ...c.req.headers,
            origin,
            authorization: `Bearer ${token({ azp: origin })}`,
          },
        },
      });
      expect(result).toMatchObject({
        status: 429,
        body: {
          error: "rate_limited",
          nextAllowedAt: "2026-10-12T12:00:20.000Z",
        },
      });
      expect(admission).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          databaseId: "investment_managed_watchlist_v1",
          tableId: "sec_annual_budget",
          rowId: "observed-annual-v1",
        }),
      );
      expect(f.transport.mock.calls[0]![0].limits).toMatchObject({
        maxRequests: 6,
      });
      expect(reserve).toHaveBeenCalledTimes(1);
      expect(f.repository).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
      const transport = f.transport.mock.results[0]!.value as ReturnType<
        typeof transportModule.createAppwriteTransport
      >;
      expect(transport.snapshot().closed).toBe(true);
    },
  );
  it("composes one fixed Submissions read with the original UTC entry window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T00:00:00.000Z"));
    const f = memoryRepository();
    const reserve = vi.fn().mockResolvedValue({
      version: 2,
      nextAllowedAt: "2026-10-12T00:00:10.000Z",
    });
    vi.spyOn(secAdmissionModule, "createManagedSecAdmission").mockReturnValue({
      reserve,
    });
    const accession = "0000320193-26-000042";
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      Response.json({
        cik: "0000320193",
        filings: {
          recent: {
            accessionNumber: [accession],
            form: ["8-K"],
            filingDate: ["2026-10-11"],
            reportDate: [""],
          },
          files: [{ name: "ignored-older.json" }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const run = createManagedWorkspaceFunction(
      configuration(),
      secConfig,
      null,
    );
    const enteredAt = "2026-10-11T23:59:59.000Z";
    const result = await run(writeContext(path, filingsCommand()), {
      startedAt: performance.now(),
      enteredAt,
    });
    expect(result).toMatchObject({
      status: 200,
      body: {
        security: { symbol: "AAPL", cik: "0000320193" },
        window: {
          lookbackDays: 90,
          fromDate: "2026-07-14",
          throughDate: "2026-10-11",
        },
        requestStartedAt: enteredAt,
        issuer: {
          status: "available",
          matchingFilings: 1,
          truncated: false,
          olderHistoryAvailable: true,
          filings: [
            {
              accessionNumber: accession,
              form: "8-K",
              reportDate: null,
              sourceUrl: `https://www.sec.gov/Archives/edgar/data/320193/${accession}-index.htm`,
            },
          ],
        },
      },
    });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "https://data.sec.gov/submissions/CIK0000320193.json",
      expect.objectContaining({
        method: "GET",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
      }),
    );
    expect(reserve).toHaveBeenCalledExactlyOnceWith(
      { userId: "clerk-18eee2905fe941fd6272a0203ecfe2" },
      enteredAt,
      expect.any(AbortSignal),
    );
    expect(f.repository).not.toHaveBeenCalled();
  });
  it.each([2_000, 10_000])(
    "counts %ims before default-entry authentication/storage/source",
    async (delay) => {
      let elapsed = 0;
      vi.spyOn(performance, "now").mockImplementation(() => elapsed);
      const validate = configModule.validateClerkTrialFunctionConfiguration;
      vi.spyOn(
        configModule,
        "validateClerkTrialFunctionConfiguration",
      ).mockImplementation((input) => {
        elapsed += delay;
        return validate(input);
      });
      vi.stubGlobal("__MANAGED_WORKSPACE_SERVER_CONFIG__", configuration());
      vi.stubGlobal("__MANAGED_SEC_CONFIG__", secConfig);
      const f = memoryRepository();
      expect(await main(writeContext(path, filingsCommand()))).toMatchObject({
        status: 408,
        body: { error: "request_timeout" },
      });
      expect(f.transport).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    },
  );
  it("expires pending auth and refuses its late completion without any source read", async () => {
    vi.useFakeTimers();
    let release!: (
      value: Awaited<ReturnType<authModule.ClerkTrialAuth>>,
    ) => void;
    vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const f = memoryRepository();
    const run = createManagedWorkspaceFunction(
      configuration(),
      secConfig,
      null,
    );
    const pending = run(writeContext(path, filingsCommand()));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toMatchObject({
      status: 408,
      body: { error: "request_timeout" },
    });
    release({ status: "allowed", principal: { userId: SUBJECT } });
    await vi.advanceTimersByTimeAsync(1);
    expect(f.transport).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("keeps explicit null SEC configuration disabled after authentication", async () => {
    const f = memoryRepository();
    const run = createManagedWorkspaceFunction(configuration(), null, null);
    expect(await run(writeContext(path, filingsCommand()))).toMatchObject({
      status: 503,
      body: { error: "not_configured" },
    });
    expect(f.transport).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("managed follow-up composed function", () => {
  function followupCommand(): ManagedResearchFollowupsCommand {
    return {
      expectedVersion: 0,
      idempotencyKey: "invented-followup-function-save",
      payload: {
        schemaVersion: 1,
        entries: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
            listing: {
              country: "US",
              exchangeMic: "XNAS",
              instrumentType: "common_stock",
              issuerId: "issuer-invented",
              issuerName: "Invented Company",
              listingId: "listing-invented",
              securityId: "security-invented",
              securityName: "Invented Common Stock",
              shareClassId: "class-invented",
              shareClassName: "Common",
              symbol: "ZERO",
            },
            check: "Check the dated capacity disclosure · Café 東京 📈",
            dueOn: "2026-12-31",
            status: "open",
            completedOn: null,
            result: "Authored invented result",
          },
        ],
      },
    };
  }

  function followupFixture() {
    const watchlist = memoryRepository();
    const get = vi
      .fn<ResearchFollowupsRepository["get"]>()
      .mockResolvedValue(null);
    const put = vi
      .fn<ResearchFollowupsRepository["put"]>()
      .mockImplementation((_principal, value) =>
        Promise.resolve({
          id: "main",
          version: value.expectedVersion + 1,
          replayed: false,
          committedAt: "2026-10-15T12:00:00.000Z",
          digestSha256: createHash("sha256")
            .update(encodeResearchFollowupsPayload(value.payload))
            .digest("hex"),
        }),
      );
    const repository = vi
      .spyOn(
        followupsRepositoryModule,
        "createAppwriteResearchFollowupsRepository",
      )
      .mockReturnValue({ get, put });
    return { watchlist, get, put, repository };
  }

  function assertIsolatedAndClosed(f: ReturnType<typeof followupFixture>) {
    expect(f.watchlist.repository).not.toHaveBeenCalled();
    expect(f.watchlist.get).not.toHaveBeenCalled();
    expect(f.watchlist.put).not.toHaveBeenCalled();
    for (const result of f.watchlist.transport.mock.results) {
      const transport = result.value as ReturnType<
        typeof transportModule.createAppwriteTransport
      >;
      expect(transport.snapshot()).toEqual({
        requests: 0,
        lastStatus: null,
        closed: true,
      });
    }
    expect(fetch).not.toHaveBeenCalled();
  }

  it.each([ORIGIN, NATIVE_ORIGIN])(
    "uses signed %s identity and a separate fixed follow-up store for GET and POST",
    async (origin) => {
      const f = followupFixture();
      const store = vi.spyOn(versionedStoreModule, "appwriteVersionedRowStore");
      const run = createManagedWorkspaceFunction(configuration(), null, null);
      const headers = {
        origin,
        authorization: `Bearer ${token({ azp: origin === NATIVE_ORIGIN ? undefined : ORIGIN })}`,
        "x-appwrite-key": "invented-followup-authority",
      };
      const read = context({ path: MANAGED_RESEARCH_FOLLOWUPS_PATH, headers });
      expect(await run(read)).toMatchObject({
        status: 200,
        body: { version: 0, payload: { schemaVersion: 1, entries: [] } },
        headers: {
          "access-control-allow-origin": origin,
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
      const write = writeContext(
        MANAGED_RESEARCH_FOLLOWUPS_PATH,
        followupCommand(),
      );
      expect(
        await run({
          ...write,
          req: {
            ...write.req,
            headers: { ...headers, "content-type": "application/json" },
          },
        }),
      ).toMatchObject({
        status: 200,
        body: {
          version: 1,
          payload: followupCommand().payload,
          replayed: false,
        },
      });
      const principal = {
        userId: `clerk-${createHash("sha256")
          .update(JSON.stringify([ISSUER, SUBJECT]))
          .digest("hex")
          .slice(0, 30)}`,
      };
      expect(f.get).toHaveBeenCalledExactlyOnceWith(principal);
      expect(f.put).toHaveBeenCalledExactlyOnceWith(
        principal,
        followupCommand(),
      );
      expect(f.repository).toHaveBeenCalledTimes(2);
      expect(store).toHaveBeenCalledTimes(2);
      for (const [options] of f.repository.mock.calls) {
        expect(options).toMatchObject({
          databaseId: "investment_managed_followups_v1",
          followupsTableId: "followups",
          receiptsTableId: "receipts",
          catalog: catalogModule.getManagedWorkspaceCatalog(),
        });
        expect(Object.keys(options.store).sort()).toEqual([
          "createRow",
          "createTransaction",
          "getRow",
          "incrementRowColumn",
          "updateRow",
          "updateTransaction",
        ]);
        for (const method of Object.values(options.store))
          expect(typeof method).toBe("function");
      }
      expect(f.repository.mock.calls[0]![0].store).not.toBe(
        f.repository.mock.calls[1]![0].store,
      );
      expect(f.watchlist.transport).toHaveBeenCalledTimes(2);
      const [first, second] = f.watchlist.transport.mock.results.map(
        (result) =>
          result.value as ReturnType<
            typeof transportModule.createAppwriteTransport
          >,
      );
      expect(first).not.toBe(second);
      for (const [options] of f.watchlist.transport.mock.calls) {
        expect(options.endpoint).toBe("https://nyc.cloud.appwrite.io/v1");
        expect(options.signal).toBeInstanceOf(AbortSignal);
      }
      assertIsolatedAndClosed(f);
    },
  );

  it("captures execution authority and exact binary input before real authentication awaits", async () => {
    const actualAuth = authModule.createClerkTrialAuth;
    let entered!: () => void;
    let release!: () => void;
    const authEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const authReleased = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(authModule, "createClerkTrialAuth").mockImplementation(
      (options) => {
        const authenticate = actualAuth(options);
        return async (request) => {
          const result = await authenticate(request);
          entered();
          await authReleased;
          return result;
        };
      },
    );
    const f = followupFixture();
    const run = createManagedWorkspaceFunction(configuration(), null, null);
    const c = writeContext(MANAGED_RESEARCH_FOLLOWUPS_PATH, followupCommand());
    const pending = run(c);
    await authEntered;
    expect(f.repository).not.toHaveBeenCalled();
    Object.assign(c.req.headers, {
      "x-appwrite-key": "changed-after-auth-await",
    });
    c.req.bodyBinary.fill(0xff);
    release();
    expect(await pending).toMatchObject({
      status: 200,
      body: { payload: followupCommand().payload },
    });
    const transport = f.watchlist.transport.mock.results[0]
      ?.value as ReturnType<typeof transportModule.createAppwriteTransport>;
    expect(transport.client.config.key).toBe("invented-execution-authority");
    expect(f.put.mock.calls[0]?.[1]).toEqual(followupCommand());
    assertIsolatedAndClosed(f);
  });

  it.each(["GET", "POST"])(
    "fails closed without execution authority before %s storage",
    async (method) => {
      const f = followupFixture();
      const run = createManagedWorkspaceFunction(configuration(), null, null);
      const c =
        method === "POST"
          ? writeContext(MANAGED_RESEARCH_FOLLOWUPS_PATH, followupCommand())
          : context({ path: MANAGED_RESEARCH_FOLLOWUPS_PATH });
      expect(
        await run({
          ...c,
          req: {
            ...c.req,
            headers: { ...c.req.headers, "x-appwrite-key": undefined },
          },
        }),
      ).toMatchObject({ status: 503, body: { error: "unavailable" } });
      expect(f.repository).not.toHaveBeenCalled();
      expect(f.watchlist.transport).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
      expect(f.put).not.toHaveBeenCalled();
      assertIsolatedAndClosed(f);
    },
  );

  it("rejects another signed account before opening either resource", async () => {
    const f = followupFixture();
    const c = writeContext(MANAGED_RESEARCH_FOLLOWUPS_PATH, followupCommand());
    expect(
      await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )({
        ...c,
        req: {
          ...c.req,
          headers: {
            ...c.req.headers,
            authorization: `Bearer ${token({ sub: "user_other" })}`,
          },
        },
      }),
    ).toMatchObject({ status: 403, body: { error: "access_denied" } });
    expect(f.repository).not.toHaveBeenCalled();
    expect(f.watchlist.transport).not.toHaveBeenCalled();
    assertIsolatedAndClosed(f);
  });

  it("closes the newly constructed transport when only follow-up composition fails", async () => {
    const f = followupFixture();
    f.repository.mockImplementation(() => {
      throw new Error("Invented private composition failure");
    });
    expect(
      await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )(context({ path: MANAGED_RESEARCH_FOLLOWUPS_PATH })),
    ).toMatchObject({ status: 503, body: { error: "unavailable" } });
    expect(f.repository).toHaveBeenCalledTimes(1);
    expect(f.get).not.toHaveBeenCalled();
    expect(f.put).not.toHaveBeenCalled();
    expect(f.watchlist.transport).toHaveBeenCalledTimes(1);
    assertIsolatedAndClosed(f);
  });

  it.each(["GET", "POST"])(
    "refuses supplied follow-up query on %s before storage",
    async (method) => {
      const f = followupFixture();
      const c =
        method === "POST"
          ? writeContext(MANAGED_RESEARCH_FOLLOWUPS_PATH, followupCommand())
          : context({ path: MANAGED_RESEARCH_FOLLOWUPS_PATH });
      expect(
        await createManagedWorkspaceFunction(
          configuration(),
          null,
          null,
        )({ ...c, req: { ...c.req, queryString: "q=ZERO" } }),
      ).toMatchObject({ status: 400, body: { error: "invalid_request" } });
      expect(f.watchlist.transport).not.toHaveBeenCalled();
      expect(f.repository).not.toHaveBeenCalled();
      assertIsolatedAndClosed(f);
    },
  );

  it.each(["PUT", "DELETE"])(
    "rejects unsupported follow-up method %s without storage",
    async (method) => {
      const f = followupFixture();
      expect(
        await createManagedWorkspaceFunction(
          configuration(),
          null,
          null,
        )(context({ method, path: MANAGED_RESEARCH_FOLLOWUPS_PATH })),
      ).toMatchObject({ status: 405, body: { error: "method_not_allowed" } });
      expect(f.watchlist.transport).not.toHaveBeenCalled();
      expect(f.repository).not.toHaveBeenCalled();
      assertIsolatedAndClosed(f);
    },
  );

  it.each([
    Buffer.from([0xc3]),
    Buffer.from([0xed, 0xa0, 0x80]),
    Buffer.from("{"),
  ])(
    "rejects malformed follow-up UTF-8/JSON bytes %# before repository dispatch",
    async (bodyBinary) => {
      const f = followupFixture();
      const c = writeContext(
        MANAGED_RESEARCH_FOLLOWUPS_PATH,
        followupCommand(),
      );
      expect(
        await createManagedWorkspaceFunction(
          configuration(),
          null,
          null,
        )({ ...c, req: { ...c.req, bodyBinary } }),
      ).toMatchObject({ status: 400, body: { error: "invalid_request" } });
      expect(f.watchlist.transport).not.toHaveBeenCalled();
      expect(f.repository).not.toHaveBeenCalled();
      assertIsolatedAndClosed(f);
    },
  );

  it.each([
    "media-type",
    "encoding",
    "empty",
    "unknown-field",
    "non-buffer",
    "GET-body",
  ])(
    "rejects follow-up %s without declaring commit uncertainty",
    async (kind) => {
      const f = followupFixture();
      const c = writeContext(
        MANAGED_RESEARCH_FOLLOWUPS_PATH,
        followupCommand(),
      );
      let req: ManagedWorkspaceFunctionContext["req"] = c.req;
      if (kind === "media-type")
        req = {
          ...req,
          headers: { ...req.headers, "content-type": "text/plain" },
        };
      if (kind === "encoding")
        req = {
          ...req,
          headers: { ...req.headers, "content-encoding": "gzip" },
        };
      if (kind === "empty") req = { ...req, bodyBinary: Buffer.alloc(0) };
      if (kind === "unknown-field")
        req = {
          ...req,
          bodyBinary: Buffer.from(
            JSON.stringify({ ...followupCommand(), ownerId: "forged" }),
          ),
        };
      if (kind === "non-buffer")
        req = { ...req, bodyBinary: new Uint8Array() as Buffer };
      if (kind === "GET-body") req = { ...req, method: "GET" };
      const media = kind === "media-type" || kind === "encoding";
      expect(
        await createManagedWorkspaceFunction(
          configuration(),
          null,
          null,
        )({ ...c, req }),
      ).toMatchObject({
        status: media ? 415 : 400,
        body: { error: media ? "unsupported_media_type" : "invalid_request" },
      });
      expect(f.repository).not.toHaveBeenCalled();
      expect(f.watchlist.transport).not.toHaveBeenCalled();
      assertIsolatedAndClosed(f);
    },
  );

  it("admits the exact raw envelope bound with Unicode but refuses one extra byte before auth", async () => {
    const f = followupFixture();
    const run = createManagedWorkspaceFunction(configuration(), null, null);
    const c = writeContext(MANAGED_RESEARCH_FOLLOWUPS_PATH, followupCommand());
    const max = MANAGED_RESEARCH_FOLLOWUPS_LIMITS.envelopeBytes;
    const bodyBinary = Buffer.concat([
      c.req.bodyBinary,
      Buffer.alloc(max - c.req.bodyBinary.byteLength, 0x20),
    ]);
    expect(bodyBinary.byteLength).toBe(266_240);
    expect(await run({ ...c, req: { ...c.req, bodyBinary } })).toMatchObject({
      status: 200,
      body: { payload: followupCommand().payload },
    });
    expect(f.put).toHaveBeenCalledTimes(1);
    expect(f.put.mock.calls[0]?.[0].userId).toMatch(/^clerk-[a-f0-9]{30}$/u);
    expect(f.put.mock.calls[0]?.[1]).toEqual(followupCommand());
    const factoryCount = f.repository.mock.calls.length;
    const authenticate = vi.fn<authModule.ClerkTrialAuth>();
    vi.spyOn(authModule, "createClerkTrialAuth").mockReturnValue(authenticate);
    const reject = createManagedWorkspaceFunction(configuration(), null, null);
    expect(
      await reject({
        ...c,
        req: {
          ...c.req,
          bodyBinary: Buffer.concat([bodyBinary, Buffer.from(" ")]),
        },
      }),
    ).toMatchObject({ status: 413, body: { error: "payload_too_large" } });
    expect(authenticate).not.toHaveBeenCalled();
    expect(f.repository).toHaveBeenCalledTimes(factoryCount);
    assertIsolatedAndClosed(f);
  });

  it("keeps the new route's native preflight independent of both repositories", async () => {
    const f = followupFixture();
    const run = createManagedWorkspaceFunction(configuration(), null, null);
    expect(
      await run(
        context({
          method: "OPTIONS",
          path: MANAGED_RESEARCH_FOLLOWUPS_PATH,
          headers: {
            origin: NATIVE_ORIGIN,
            "access-control-request-method": "POST",
            "access-control-request-headers": "authorization, content-type",
          },
        }),
      ),
    ).toMatchObject({
      status: 204,
      body: "",
      headers: {
        "access-control-allow-origin": NATIVE_ORIGIN,
        "access-control-allow-methods": "GET, POST",
      },
    });
    expect(f.repository).not.toHaveBeenCalled();
    expect(f.watchlist.transport).not.toHaveBeenCalled();
    assertIsolatedAndClosed(f);
  });

  it("keeps a dispatched follow-up write uncertain after response delivery fails, with no retry", async () => {
    const f = followupFixture();
    const c = writeContext(MANAGED_RESEARCH_FOLLOWUPS_PATH, followupCommand());
    const responseFailure = vi.fn(() => {
      throw new Error("Invented failure after committed receipt");
    });
    expect(
      await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )({ ...c, res: { ...c.res, text: responseFailure } }),
    ).toMatchObject({ status: 503, body: { error: "commit_unknown" } });
    expect(responseFailure).toHaveBeenCalledTimes(1);
    expect(f.put).toHaveBeenCalledTimes(1);
    expect(f.repository).toHaveBeenCalledTimes(1);
    expect(f.get).not.toHaveBeenCalled();
    assertIsolatedAndClosed(f);
  });

  it.each(["GET", "POST"])(
    "closes a failed %s operation and preserves read versus write uncertainty",
    async (method) => {
      const f = followupFixture();
      if (method === "POST")
        f.put.mockRejectedValueOnce(new Error("Invented uncertain commit"));
      else f.get.mockRejectedValueOnce(new Error("Invented unavailable read"));
      const c =
        method === "POST"
          ? writeContext(MANAGED_RESEARCH_FOLLOWUPS_PATH, followupCommand())
          : context({ path: MANAGED_RESEARCH_FOLLOWUPS_PATH });
      expect(
        await createManagedWorkspaceFunction(configuration(), null, null)(c),
      ).toMatchObject({
        status: 503,
        body: { error: method === "POST" ? "commit_unknown" : "unavailable" },
      });
      expect(f.repository).toHaveBeenCalledTimes(1);
      expect(method === "POST" ? f.put : f.get).toHaveBeenCalledTimes(1);
      assertIsolatedAndClosed(f);
    },
  );
});
