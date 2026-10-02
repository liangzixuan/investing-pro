import { createHash, generateKeyPairSync, sign } from "node:crypto";

import {
  encodeMainWatchlistPayload,
  type ManagedWatchlistCommand,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authModule from "./clerk-trial-auth";
import * as configModule from "./clerk-trial-config";
import * as transportModule from "./appwrite-transport";
import * as repositoryModule from "./appwrite-watchlist-repository";
import * as catalogModule from "./managed-workspace-catalog";
import * as annualAdmissionModule from "./managed-sec-annual-admission";
import * as eodAdmissionModule from "./managed-eod-admission";
import {
  MANAGED_EOD_MAPPING_CANDIDATES,
  MANAGED_EOD_TOKEN_ENVIRONMENT_KEY,
} from "./managed-eod-config";
import main, {
  createManagedWorkspaceFunction,
  type ManagedWorkspaceFunctionContext,
} from "./managed-workspace-function";
import type { MainWatchlistRepository } from "./watchlist-repository";

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
      vi.stubGlobal("__MANAGED_SEC_ANNUAL_CONFIG__", annualConfig);
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
      schemaVersion: "1.0.0",
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
          new annualAdmissionModule.ManagedSecAnnualAdmissionError(
            "rate_limited",
            "2026-10-01T12:00:20.000Z",
          ),
        );
      const admission = vi
        .spyOn(annualAdmissionModule, "createManagedSecAnnualAdmission")
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
    vi.spyOn(
      annualAdmissionModule,
      "createManagedSecAnnualAdmission",
    ).mockReturnValue({ reserve });
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
        security: { symbol: "AAPL", cik: "0000320193" },
        evidence: { resolution: { currentTargetEligible: true } },
      },
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
      vi.stubGlobal("__MANAGED_SEC_ANNUAL_CONFIG__", null);
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
