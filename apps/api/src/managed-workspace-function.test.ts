import { createHash, generateKeyPairSync, sign } from "node:crypto";

import {
  encodeMainWatchlistPayload,
  type ManagedWatchlistCommand,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authModule from "./clerk-trial-auth";
import * as transportModule from "./appwrite-transport";
import * as repositoryModule from "./appwrite-watchlist-repository";
import * as catalogModule from "./managed-workspace-catalog";
import {
  createManagedWorkspaceFunction,
  type ManagedWorkspaceFunctionContext,
} from "./managed-workspace-function";
import type { MainWatchlistRepository } from "./watchlist-repository";

const ORIGIN = "https://app.investingpro.app";
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
});

describe("managed production Appwrite function", () => {
  it("uses the checked production auth and a separate fixed repository per operation", async () => {
    const f = memoryRepository(),
      input = configuration(),
      run = createManagedWorkspaceFunction(input);
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
      run = createManagedWorkspaceFunction(configuration()),
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

  it.each([
    ["subject", { sub: "user_other" }, 403],
    ["issuer", { iss: `${ISSUER}.invalid` }, 401],
    ["party", { azp: `${ORIGIN}.invalid` }, 401],
    ["missing party", { azp: undefined }, 401],
    ["expired", { exp: 1 }, 401],
    ["inactive", { sts: "pending" }, 401],
  ] as const)(
    "rejects %s before opening storage",
    async (_reason, patch, status) => {
      const f = memoryRepository(),
        run = createManagedWorkspaceFunction(configuration()),
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

  it("does not trust execution headers as login and preserves cookie denial", async () => {
    const f = memoryRepository(),
      run = createManagedWorkspaceFunction(configuration()),
      c = context({ path: WATCHLIST });
    for (const headers of [
      {
        origin: ORIGIN,
        "x-appwrite-key": "invented-key",
        "x-appwrite-user-id": SUBJECT,
      },
      { ...c.req.headers, cookie: "invented=only" },
    ]) {
      expect(await run({ ...c, req: { ...c.req, headers } })).toMatchObject({
        status: 401,
      });
    }
    expect(f.transport).not.toHaveBeenCalled();
  });

  it("denies native origin and closed admission", async () => {
    const f = memoryRepository(),
      input = configuration();
    input.auth.allowedSubject = null;
    const run = createManagedWorkspaceFunction(input),
      c = context({ path: WATCHLIST });
    expect(await run(c)).toMatchObject({
      status: 403,
      body: { error: "access_denied" },
    });
    expect(
      await run({
        ...c,
        req: {
          ...c.req,
          headers: { ...c.req.headers, origin: "https://localhost" },
        },
      }),
    ).toMatchObject({ status: 403, body: { error: "origin_denied" } });
    expect(f.transport).not.toHaveBeenCalled();
  });

  it("returns a finite missing execution authority failure before put", async () => {
    const f = memoryRepository(),
      run = createManagedWorkspaceFunction(configuration()),
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
      await createManagedWorkspaceFunction(configuration())(
        context({ path: WATCHLIST }),
      ),
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
      createManagedWorkspaceFunction({ ...input, databaseId: "other" }),
    ).toThrow();
    expect(() =>
      createManagedWorkspaceFunction({
        environment: "development",
        auth: {
          ...input.auth,
          issuer: "https://allowed-lobster-3386.clerk.accounts.dev",
          authorizedParties: [
            "https://investment-clerk-6abac57a.appwrite.network",
          ],
        },
        allowedOrigins: ["https://investment-clerk-6abac57a.appwrite.network"],
      }),
    ).toThrow("Managed function requires production configuration");
  });
});

describe("managed binary and supplied query bridge", () => {
  it.each([undefined, null, "{}", new Uint8Array(), {}])(
    "requires a Buffer for bodyBinary %#",
    async (body) => {
      const f = memoryRepository(),
        run = createManagedWorkspaceFunction(configuration());
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
      const run = createManagedWorkspaceFunction(configuration());
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
        run = createManagedWorkspaceFunction(configuration()),
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
      const run = createManagedWorkspaceFunction(configuration());
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
      run = createManagedWorkspaceFunction(configuration()),
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
    const run = createManagedWorkspaceFunction(configuration());
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
    const run = createManagedWorkspaceFunction(configuration());
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
      await createManagedWorkspaceFunction(configuration())(context({ path })),
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
    const run = createManagedWorkspaceFunction(configuration());
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
