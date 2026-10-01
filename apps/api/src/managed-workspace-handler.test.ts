import { createHash } from "node:crypto";
import * as contracts from "@research-cockpit/contracts";
import type {
  ManagedCatalogSearchDto,
  ManagedCatalogStatusDto,
} from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  WatchlistRepositoryError,
  type MainWatchlistRepository,
} from "./watchlist-repository";
import type { ClerkTrialAuth } from "./clerk-trial-auth";
import {
  ManagedSecAnnualServiceError,
  type ManagedSecAnnualService,
} from "./managed-sec-annual-service";
import {
  createManagedCatalogService,
  type ManagedCatalogService,
} from "./managed-workspace-catalog";
import {
  createManagedWorkspaceHandler,
  type ManagedWorkspaceHandlerOptions,
} from "./managed-workspace-handler";

const ORIGIN = "https://app.investingpro.app";
const NATIVE_ORIGIN = "https://localhost";
const OWNER = { userId: "clerk-invented-owner" };
const STATUS = "/v1/managed/catalog";
const SEARCH = `${STATUS}/search`;

function inventedStatus(): ManagedCatalogStatusDto {
  return {
    snapshot: {
      schemaVersion: "1.0.0",
      profile: "personal_single_user_managed_security_master",
      snapshotSha256: `sha256:${"a".repeat(64)}`,
      catalogId: "catalog-demo",
      catalogVersion: "version-demo",
      acquiredAt: "2026-09-30T00:00:00.000Z",
      generatedAt: "2026-09-30T00:00:00.000Z",
      asOf: "2026-09-30T00:00:00.000Z",
      contentKind: "synthetic_engineering",
      attribution: "Invented test catalog",
      sources: [],
      excludedCandidates: [],
      coverage: {
        activeEligibleSecurities: 1,
        activeListings: 1,
        admittedSourceRecords: 1,
        basis: "synthetic_engineering_only_not_real_universe",
        eligibleSecurityBand: "under_1000",
        formerTickerEntries: 0,
        ineligibleSourceRecords: 0,
        inactiveSecurities: 0,
        issuers: 1,
        providerMappings: 0,
        quarantinedSourceRecords: 0,
        sourceRecords: 1,
        staleSourceRecords: 0,
        shareClasses: 1,
        totalSecurities: 1,
        unsupportedSourceRecords: 0,
      },
    },
  };
}

function fixture() {
  const statusDto = inventedStatus();
  const searchDto: ManagedCatalogSearchDto = {
    ...statusDto,
    results: [
      {
        cik: "0000000001",
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: `oid-issuer-${"a".repeat(32)}`,
        issuerName: "Invented Example Company",
        listingId: `oid-listing-${"b".repeat(32)}`,
        matchKind: "current_symbol_exact",
        matchedValue: "DEMO",
        securityId: `oid-security-${"c".repeat(32)}`,
        securityName: "Invented Common Stock",
        shareClassId: `oid-share-class-${"d".repeat(32)}`,
        shareClassName: "Invented Common Stock",
        symbol: "DEMO",
      },
    ],
    limitApplied: 25,
    totalMatches: 1,
    normalizedQuery: "DEMO",
  };
  const auth = vi
    .fn<ClerkTrialAuth>()
    .mockResolvedValue({ status: "allowed", principal: OWNER });
  const status = vi.fn<ManagedCatalogService["status"]>(() => statusDto);
  const search = vi.fn<ManagedCatalogService["search"]>(() => searchDto);
  const resolve = vi.fn<ManagedCatalogService["resolve"]>();
  const openRepository = vi.fn(() =>
    Promise.reject(new Error("Unexpected storage")),
  );
  const handler = createManagedWorkspaceHandler({
    auth,
    catalog: { status, search, resolve },
    openRepository,
  });
  return {
    handler,
    auth,
    status,
    search,
    resolve,
    openRepository,
    statusDto,
    searchDto,
  };
}

function request(
  path = STATUS,
  options: {
    method?: string;
    origin?: string | null;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  } = {},
) {
  return new Request(`https://api.example.invalid${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.origin === null ? {} : { origin: options.origin ?? ORIGIN }),
      authorization: "Bearer invented.session.signature",
      ...options.headers,
    },
    ...(options.signal ? { signal: options.signal } : {}),
  });
}

afterEach(() => vi.restoreAllMocks());

describe("managed catalog request boundary", () => {
  it.each([ORIGIN, NATIVE_ORIGIN])(
    "returns authenticated status and search identities at %s",
    async (origin) => {
      const f = fixture();
      const statusRequest = request(STATUS, { origin });
      const response = await f.handler(statusRequest);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(f.statusDto);
      expect(f.auth).toHaveBeenCalledWith(statusRequest);
      expect(f.auth.mock.invocationCallOrder[0]).toBeLessThan(
        f.status.mock.invocationCallOrder[0]!,
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("content-type")).toBe(
        "application/json; charset=utf-8",
      );
      expect(response.headers.get("access-control-allow-origin")).toBe(origin);
      expect(response.headers.has("access-control-allow-credentials")).toBe(
        false,
      );
      expect(response.headers.get("vary")).toBe("Origin");
      const found = await f.handler(
        request(`${SEARCH}?q=%20demo%20`, { origin }),
      );
      expect(found.status).toBe(200);
      expect(await found.json()).toEqual(f.searchDto);
      expect(f.search).toHaveBeenCalledWith(" demo ");
      expect(f.status).toHaveBeenCalledTimes(1);
      expect(f.search).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    null,
    "null",
    `${ORIGIN}/`,
    "https://other.example.invalid",
    `${NATIVE_ORIGIN}/`,
    `${NATIVE_ORIGIN}:443`,
    `${NATIVE_ORIGIN}.invalid`,
    "http://localhost",
  ])(
    "rejects origin %s before authentication or catalog access",
    async (origin) => {
      const f = fixture();
      const response = await f.handler(request(STATUS, { origin }));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "origin_denied" });
      expect(response.headers.has("access-control-allow-origin")).toBe(false);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(f.auth).not.toHaveBeenCalled();
      expect(f.status).not.toHaveBeenCalled();
      expect(f.search).not.toHaveBeenCalled();
      expect(f.openRepository).not.toHaveBeenCalled();
    },
  );

  it.each(["unauthenticated", "access_denied"] as const)(
    "rejects %s before query normalization or catalog access",
    async (status) => {
      const f = fixture();
      f.auth.mockResolvedValue({ status });
      const response = await f.handler(request(`${SEARCH}?q=%20%20`));
      expect(response.status).toBe(status === "unauthenticated" ? 401 : 403);
      expect(await response.json()).toEqual({ error: status });
      expect(f.status).not.toHaveBeenCalled();
      expect(f.search).not.toHaveBeenCalled();
    },
  );

  it("passes cookie-bearing requests through the existing authentication gate", async () => {
    const f = fixture();
    const incoming = request(STATUS, { headers: { cookie: "invented=only" } });
    f.auth.mockImplementation((value) => {
      expect(value).toBe(incoming);
      expect(value.headers.get("cookie")).toBe("invented=only");
      return Promise.resolve({ status: "unauthenticated" });
    });
    expect((await f.handler(incoming)).status).toBe(401);
    expect(f.status).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/v1/managed/unknown", 404, "not_found"],
    ["GET", `${STATUS}/`, 404, "not_found"],
    ["POST", STATUS, 405, "method_not_allowed"],
    ["HEAD", STATUS, 405, "method_not_allowed"],
    ["DELETE", `${SEARCH}?q=DEMO`, 405, "method_not_allowed"],
    ["GET", `${STATUS}?`, 400, "invalid_request"],
    ["GET", `${STATUS}?extra=1`, 400, "invalid_request"],
    ["GET", `${STATUS}#`, 400, "invalid_request"],
    ["GET", `${STATUS}#fragment`, 400, "invalid_request"],
    ["GET", SEARCH, 400, "invalid_request"],
    ["GET", `${SEARCH}?q=DEMO&q=OTHER`, 400, "invalid_request"],
    ["GET", `${SEARCH}?q=DEMO&extra=1`, 400, "invalid_request"],
    ["GET", `${SEARCH}?q=DEMO&`, 400, "invalid_request"],
    ["GET", `${SEARCH}?%71=DEMO`, 400, "invalid_request"],
    ["GET", `${SEARCH}?q=%`, 400, "invalid_request"],
    ["GET", `${SEARCH}?q=%C0%AF`, 400, "invalid_request"],
    ["GET", `${SEARCH}?q=%ED%A0%80`, 400, "invalid_request"],
  ] as const)(
    "rejects %s %s before authentication with %s",
    async (method, path, expectedStatus, error) => {
      const f = fixture();
      const response = await f.handler(request(path, { method }));
      expect(response.status).toBe(expectedStatus);
      expect(await response.json()).toEqual({ error });
      expect(f.auth).not.toHaveBeenCalled();
      expect(f.status).not.toHaveBeenCalled();
      expect(f.search).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "envelope before path",
      "/v1/managed/unknown",
      { headers: { "content-encoding": "gzip" } },
      400,
      "invalid_request",
    ],
    [
      "path before method",
      "/v1/managed/unknown?q=%",
      { method: "POST" },
      404,
      "not_found",
    ],
    [
      "method before query decoding",
      `${SEARCH}?q=%`,
      { method: "POST" },
      405,
      "method_not_allowed",
    ],
  ] as const)(
    "preserves validation order: %s",
    async (_phase, path, init, expectedStatus, error) => {
      const f = fixture();
      const response = await f.handler(request(path, init));
      expect(response.status).toBe(expectedStatus);
      expect(await response.json()).toEqual({ error });
      expect(f.auth).not.toHaveBeenCalled();
      expect(f.status).not.toHaveBeenCalled();
      expect(f.search).not.toHaveBeenCalled();
    },
  );

  it("bounds the request target and decoded query in code points", async () => {
    const f = fixture();
    const maximumQuery = "\u{1f600}".repeat(
      contracts.MANAGED_CATALOG_LIMITS.searchQueryCodePoints,
    );
    expect(
      (
        await f.handler(
          request(`${SEARCH}?q=${encodeURIComponent(maximumQuery)}`),
        )
      ).status,
    ).toBe(200);
    expect(f.search).toHaveBeenCalledWith(maximumQuery);
    f.auth.mockClear();
    f.search.mockClear();
    const tooLongQuery = encodeURIComponent(`${maximumQuery}x`);
    expect(
      (await f.handler(request(`${SEARCH}?q=${tooLongQuery}`))).status,
    ).toBe(400);
    const tooLongTarget = `/${"x".repeat(
      contracts.MANAGED_CATALOG_LIMITS.maximumRequestTargetCodeUnits,
    )}`;
    expect((await f.handler(request(tooLongTarget))).status).toBe(400);
    expect(f.auth).not.toHaveBeenCalled();
    expect(f.search).not.toHaveBeenCalled();
  });

  it.each([{ "content-length": "1" }, { "content-encoding": "gzip" }])(
    "rejects declared GET body metadata %j without reading a body",
    async (headers) => {
      const f = fixture();
      expect((await f.handler(request(STATUS, { headers }))).status).toBe(400);
      expect(f.auth).not.toHaveBeenCalled();
      expect(f.status).not.toHaveBeenCalled();
    },
  );

  it.each(["", " ", "\t", "\u0000"])(
    "maps the service's invalid query result to 400 for %j",
    async (query) => {
      const f = fixture();
      f.search.mockReturnValue(null);
      const response = await f.handler(
        request(`${SEARCH}?q=${encodeURIComponent(query)}`),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_request" });
      expect(f.search).toHaveBeenCalledWith(query);
      expect(f.auth.mock.invocationCallOrder[0]).toBeLessThan(
        f.search.mock.invocationCallOrder[0]!,
      );
    },
  );

  it.each([
    [ORIGIN, STATUS],
    [ORIGIN, `${SEARCH}?q=DEMO`],
    [NATIVE_ORIGIN, STATUS],
    [NATIVE_ORIGIN, `${SEARCH}?q=DEMO`],
  ])(
    "permits a narrow unauthenticated GET preflight at %s for %s",
    async (origin, path) => {
      const f = fixture();
      const response = await f.handler(
        request(path, {
          method: "OPTIONS",
          origin,
          headers: {
            "access-control-request-method": "GET",
            "access-control-request-headers": " AUTHORIZATION ",
          },
        }),
      );
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe(origin);
      expect(await response.text()).toBe("");
      expect(response.headers.get("access-control-allow-methods")).toBe("GET");
      expect(response.headers.get("access-control-allow-headers")).toBe(
        "Authorization",
      );
      expect(response.headers.get("vary")).toBe(
        "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
      );
      expect(response.headers.has("access-control-allow-credentials")).toBe(
        false,
      );
      expect(f.auth).not.toHaveBeenCalled();
      expect(f.status).not.toHaveBeenCalled();
      expect(f.search).not.toHaveBeenCalled();
      expect(f.openRepository).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["POST", "authorization"],
    ["get", "authorization"],
    ["", "authorization"],
    ["GET", "authorization, x-owner"],
    ["GET", "authorization, authorization"],
    ["GET", "content-type"],
    ["GET", ","],
  ])(
    "rejects preflight method %s and headers %s",
    async (method, requested) => {
      const f = fixture();
      const response = await f.handler(
        request(STATUS, {
          method: "OPTIONS",
          headers: {
            "access-control-request-method": method,
            "access-control-request-headers": requested,
          },
        }),
      );
      expect(response.status).toBe(403);
      expect(response.headers.has("access-control-allow-methods")).toBe(false);
      expect(f.auth).not.toHaveBeenCalled();
      expect(f.status).not.toHaveBeenCalled();
    },
  );

  it("retires a request aborted while authentication is pending", async () => {
    const f = fixture();
    const controller = new AbortController();
    f.auth.mockImplementation(
      () =>
        new Promise((resolve) => {
          controller.abort();
          resolve({ status: "allowed", principal: OWNER });
        }),
    );
    const response = await f.handler(
      request(STATUS, { signal: controller.signal }),
    );
    expect(response.status).toBe(408);
    expect(await response.json()).toEqual({ error: "request_timeout" });
    expect(f.status).not.toHaveBeenCalled();
    expect(f.search).not.toHaveBeenCalled();
  });

  it("does not release a result after the request is retired", async () => {
    const f = fixture();
    const controller = new AbortController();
    f.status.mockImplementation(() => {
      controller.abort();
      return f.statusDto;
    });
    const response = await f.handler(
      request(STATUS, { signal: controller.signal }),
    );
    expect(response.status).toBe(408);
    expect(await response.json()).toEqual({ error: "request_timeout" });
  });

  it.each(["auth", "status", "search"] as const)(
    "hides unexpected %s failures behind unavailable",
    async (operation) => {
      const f = fixture();
      f[operation].mockImplementation(() => {
        throw new Error("private diagnostic must not escape");
      });
      const response = await f.handler(
        request(operation === "search" ? `${SEARCH}?q=DEMO` : STATUS),
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "unavailable" });
    },
  );

  it.each([null, { snapshot: { profile: "personal_single_user_local" } }])(
    "rejects malformed status output through the shared parser",
    async (invalid) => {
      const f = fixture();
      f.status.mockReturnValue(invalid as unknown as ManagedCatalogStatusDto);
      const response = await f.handler(request());
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "unavailable" });
    },
  );

  it("rejects malformed search output without exposing unknown fields", async () => {
    const f = fixture();
    f.search.mockReturnValue({
      ...f.searchDto,
      diagnostic: "private detail",
    } as ManagedCatalogSearchDto);
    const response = await f.handler(request(`${SEARCH}?q=DEMO`));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
  });

  it("enforces the UTF-8 response cap even if a validator admits a wider shape", async () => {
    const f = fixture();
    const wide = {
      snapshot: {
        ...f.statusDto.snapshot,
        attribution: "\u{1f600}".repeat(
          contracts.MANAGED_CATALOG_LIMITS.responseBytes / 4,
        ),
      },
    };
    expect(JSON.stringify(wide).length).toBeLessThan(
      contracts.MANAGED_CATALOG_LIMITS.responseBytes,
    );
    vi.spyOn(contracts, "parseManagedCatalogStatus").mockReturnValue(wide);
    const response = await f.handler(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
  });

  it("reads the fixed admitted catalog and preserves its search identity", async () => {
    const catalog = createManagedCatalogService();
    const auth = vi
      .fn<ClerkTrialAuth>()
      .mockResolvedValue({ status: "allowed", principal: OWNER });
    const handler = createManagedWorkspaceHandler({
      auth,
      catalog,
      openRepository: () => Promise.reject(new Error("Unexpected storage")),
    });
    const status = await handler(request());
    const found = await handler(request(`${SEARCH}?q=AAPL`));
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual(catalog.status());
    expect(found.status).toBe(200);
    expect(await found.json()).toEqual(catalog.search("AAPL"));
    const invalid = await handler(request(`${SEARCH}?q=%20%09%20`));
    expect(invalid.status).toBe(400);
  });
});

const WATCHLIST = "/v1/managed/watchlist";
const RESOLVE = "/v1/managed/catalog/resolve";

function watchlistCommand(): contracts.ManagedWatchlistCommand {
  return {
    expectedVersion: 0,
    idempotencyKey: "invented-command-0001",
    payload: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: `sha256:${"a".repeat(64)}`,
      memberships: [
        {
          country: "US",
          exchangeMic: "XNAS",
          instrumentType: "common_stock",
          issuerId: "issuer-demo",
          issuerName: "Invented issuer",
          listingId: "listing-demo",
          note: "Invented note",
          securityId: "security-demo",
          securityName: "Common stock",
          shareClassId: "class-demo",
          shareClassName: "Common",
          symbol: "DEMO",
        },
      ],
    },
  };
}

function storageFixture() {
  const f = fixture();
  const get = vi.fn<MainWatchlistRepository["get"]>().mockResolvedValue(null);
  const put = vi
    .fn<MainWatchlistRepository["put"]>()
    .mockImplementation((_principal, command) =>
      Promise.resolve({
        id: "main",
        version: command.expectedVersion + 1,
        replayed: false,
        committedAt: "2026-10-01T00:00:00.000Z",
        digestSha256: createHash("sha256")
          .update(contracts.encodeMainWatchlistPayload(command.payload))
          .digest("hex"),
      }),
    );
  const close = vi.fn(() => Promise.resolve());
  const openRepository = vi.fn<
    ManagedWorkspaceHandlerOptions["openRepository"]
  >(() => Promise.resolve({ repository: { get, put }, close }));
  const handler = createManagedWorkspaceHandler({
    auth: f.auth,
    catalog: { status: f.status, search: f.search, resolve: f.resolve },
    openRepository,
  });
  return { ...f, handler, get, put, close, openRepository };
}

function post(
  path: string,
  value: unknown,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
) {
  return new Request(`https://api.example.invalid${path}`, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      authorization: "Bearer invented.session.signature",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(value),
    ...(signal ? { signal } : {}),
  });
}

function bytesRequest(
  path: string,
  body: Uint8Array | ReadableStream<Uint8Array>,
  signal?: AbortSignal,
) {
  return new Request(`https://api.example.invalid${path}`, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      authorization: "Bearer invented.session.signature",
      "content-type": "application/json",
    },
    body,
    signal,
    duplex: "half",
  } as RequestInit);
}

describe("managed watchlist repository lifetime", () => {
  it("loads an empty list and a saved older snapshot with a separate operation each time", async () => {
    const f = storageFixture();
    const first = request(WATCHLIST);
    expect(await (await f.handler(first)).json()).toEqual({
      version: 0,
      payload: {
        schemaVersion: 1,
        name: "My Watchlist",
        snapshotSha256: f.statusDto.snapshot.snapshotSha256,
        memberships: [],
      },
    });
    const payload = {
      ...watchlistCommand().payload,
      snapshotSha256: `sha256:${"b".repeat(64)}`,
    };
    f.get.mockResolvedValue({
      id: "main",
      version: 7,
      payload,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    expect(await (await f.handler(request(WATCHLIST))).json()).toEqual({
      version: 7,
      payload,
    });
    expect(f.openRepository).toHaveBeenCalledWith(first.signal);
    expect(f.get).toHaveBeenCalledWith(OWNER);
    expect(f.close).toHaveBeenCalledTimes(2);
    expect(f.put).not.toHaveBeenCalled();
  });

  it("passes an owned structural command to put and confirms an older-digest replay without pre-admission", async () => {
    const f = storageFixture();
    const command = {
      ...watchlistCommand(),
      expectedVersion: 3,
      payload: {
        ...watchlistCommand().payload,
        snapshotSha256: `sha256:${"b".repeat(64)}`,
      },
    };
    f.put.mockImplementation((_principal, value) =>
      Promise.resolve({
        id: "main",
        version: 4,
        replayed: true,
        committedAt: "2026-10-01T00:00:00.000Z",
        digestSha256: createHash("sha256")
          .update(contracts.encodeMainWatchlistPayload(value.payload))
          .digest("hex"),
      }),
    );
    const response = await f.handler(post(WATCHLIST, command));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      version: 4,
      payload: command.payload,
      replayed: true,
    });
    expect(f.put).toHaveBeenCalledWith(OWNER, command);
    expect(f.put.mock.calls[0]?.[1]).not.toBe(command);
    expect(f.status).not.toHaveBeenCalled();
    expect(f.resolve).not.toHaveBeenCalled();
    expect(f.close).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    {},
    { ...watchlistCommand(), owner: "other" },
    { ...watchlistCommand(), expectedVersion: -1 },
  ])("rejects malformed command %# before storage", async (value) => {
    const f = storageFixture();
    expect((await f.handler(post(WATCHLIST, value))).status).toBe(400);
    expect(f.openRepository).not.toHaveBeenCalled();
  });

  it.each([
    "invalid_request",
    "access_denied",
    "conflict",
    "idempotency_conflict",
    "commit_unknown",
    "unavailable",
    "invalid_response",
  ] as const)("preserves finite write outcome %s and closes", async (code) => {
    const f = storageFixture();
    f.put.mockRejectedValue(new WatchlistRepositoryError(code));
    const response = await f.handler(post(WATCHLIST, watchlistCommand()));
    expect(response.status).toBe(
      code === "invalid_request"
        ? 400
        : code === "access_denied"
          ? 403
          : code.includes("conflict")
            ? 409
            : 503,
    );
    expect(await response.json()).toEqual({
      error: code === "invalid_response" ? "commit_unknown" : code,
    });
    expect(f.close).toHaveBeenCalledOnce();
  });

  it.each(["GET", "POST"])(
    "keeps %s acquisition failure definite and does not close an unacquired operation",
    async (method) => {
      const f = storageFixture();
      f.openRepository.mockRejectedValue(new Error("private authority"));
      expect(
        await (
          await f.handler(
            method === "POST"
              ? post(WATCHLIST, watchlistCommand())
              : request(WATCHLIST),
          )
        ).json(),
      ).toEqual({ error: "unavailable" });
      expect(f.close).not.toHaveBeenCalled();
    },
  );

  it.each(["GET", "POST"])(
    "makes %s cleanup failure unavailable or uncertain",
    async (method) => {
      const f = storageFixture();
      f.close.mockRejectedValue(new Error("private close detail"));
      expect(
        await (
          await f.handler(
            method === "POST"
              ? post(WATCHLIST, watchlistCommand())
              : request(WATCHLIST),
          )
        ).json(),
      ).toEqual({
        error: method === "POST" ? "commit_unknown" : "unavailable",
      });
      expect(f.close).toHaveBeenCalledOnce();
    },
  );

  it("keeps cleanup failure after a definite repository rejection conservative", async () => {
    const f = storageFixture();
    f.put.mockRejectedValue(new WatchlistRepositoryError("conflict"));
    f.close.mockRejectedValue(new Error("close failed"));
    expect(
      await (await f.handler(post(WATCHLIST, watchlistCommand()))).json(),
    ).toEqual({ error: "commit_unknown" });
  });

  it.each(["acquisition", "read", "write", "close"])(
    "retires after %s and closes acquired storage",
    async (stage) => {
      const f = storageFixture(),
        controller = new AbortController();
      if (stage === "acquisition")
        f.openRepository.mockImplementation(() => {
          controller.abort();
          return Promise.resolve({
            repository: { get: f.get, put: f.put },
            close: f.close,
          });
        });
      if (stage === "read")
        f.get.mockImplementation(() => {
          controller.abort();
          return Promise.resolve(null);
        });
      if (stage === "write")
        f.put.mockImplementation(() => {
          controller.abort();
          return Promise.reject(new Error("aborted operation"));
        });
      if (stage === "close")
        f.close.mockImplementation(() => {
          controller.abort();
          return Promise.resolve();
        });
      const write = stage === "write" || stage === "close";
      const response = await f.handler(
        write
          ? post(WATCHLIST, watchlistCommand(), {}, controller.signal)
          : request(WATCHLIST, { signal: controller.signal }),
      );
      expect(await response.json()).toEqual({
        error: write ? "commit_unknown" : "request_timeout",
      });
      expect(f.close).toHaveBeenCalledOnce();
      if (stage === "acquisition") expect(f.get).not.toHaveBeenCalled();
    },
  );

  it("rejects a mismatched receipt digest instead of claiming a save", async () => {
    const f = storageFixture();
    f.put.mockResolvedValue({
      id: "main",
      version: 1,
      replayed: false,
      committedAt: "2026-10-01T00:00:00.000Z",
      digestSha256: "0".repeat(64),
    });
    expect(
      await (await f.handler(post(WATCHLIST, watchlistCommand()))).json(),
    ).toEqual({ error: "commit_unknown" });
  });

  it("rejects malformed saved output and enforces the watchlist response byte cap", async () => {
    const f = storageFixture();
    f.get.mockResolvedValue({
      id: "main",
      version: 0,
      payload: watchlistCommand().payload,
      createdAt: "",
      updatedAt: "",
    });
    expect((await f.handler(request(WATCHLIST))).status).toBe(503);
    f.get.mockResolvedValue(null);
    vi.spyOn(contracts, "parseManagedWatchlist").mockReturnValue({
      version: 0,
      payload: {
        ...watchlistCommand().payload,
        name: "x".repeat(contracts.MANAGED_WATCHLIST_LIMITS.envelopeBytes),
      },
    } as unknown as contracts.ManagedWatchlistDto);
    expect((await f.handler(request(WATCHLIST))).status).toBe(503);
  });
});

describe("managed JSON admission and read-only resolve", () => {
  it.each([
    new Uint8Array([0xc3]),
    new Uint8Array([0xc0, 0xaf]),
    Buffer.from("{"),
  ])("rejects malformed UTF-8 or JSON %# before storage", async (bytes) => {
    const f = storageFixture();
    const response = await f.handler(bytesRequest(WATCHLIST, bytes));
    expect(response.status).toBe(400);
    expect(f.openRepository).not.toHaveBeenCalled();
  });

  it("authenticates before decoding malformed POST bytes", async () => {
    const f = storageFixture();
    f.auth.mockResolvedValue({ status: "unauthenticated" });
    const response = await f.handler(
      bytesRequest(WATCHLIST, new Uint8Array([0xc3])),
    );
    expect(response.status).toBe(401);
    expect(f.openRepository).not.toHaveBeenCalled();
  });

  it.each([
    ["text/plain", undefined, 415],
    ["application/json", "gzip", 415],
    ["application/json", undefined, 413],
  ] as const)(
    "bounds JSON metadata %# before storage",
    async (type, encoding, status) => {
      const f = storageFixture();
      const headers: Record<string, string> = { "content-type": type };
      if (encoding) headers["content-encoding"] = encoding;
      if (status === 413)
        headers["content-length"] = String(
          contracts.MANAGED_WATCHLIST_LIMITS.envelopeBytes + 1,
        );
      expect(
        (await f.handler(post(WATCHLIST, watchlistCommand(), headers))).status,
      ).toBe(status);
      expect(f.openRepository).not.toHaveBeenCalled();
    },
  );

  it("bounds actual multibyte input and rejects a false declared length", async () => {
    const f = storageFixture();
    const bytes = Buffer.from(
      "😀".repeat(contracts.MANAGED_WATCHLIST_LIMITS.envelopeBytes / 4 + 1),
    );
    expect((await f.handler(bytesRequest(WATCHLIST, bytes))).status).toBe(413);
    expect(
      (
        await f.handler(
          post(WATCHLIST, watchlistCommand(), { "content-length": "0" }),
        )
      ).status,
    ).toBe(400);
    expect(f.openRepository).not.toHaveBeenCalled();
  });

  it.each(["timeout", "abort"])(
    "stops a stalled body on %s without opening storage",
    async (reason) => {
      vi.useFakeTimers();
      try {
        const f = storageFixture(),
          controller = new AbortController();
        const response = f.handler(
          bytesRequest(
            WATCHLIST,
            new ReadableStream<Uint8Array>(),
            controller.signal,
          ),
        );
        await vi.advanceTimersByTimeAsync(0);
        if (reason === "abort") controller.abort();
        else await vi.advanceTimersByTimeAsync(2001);
        expect((await response).status).toBe(408);
        expect(f.openRepository).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("resolves exact IDs in captured order without opening storage", async () => {
    const f = storageFixture();
    const command = {
      snapshotSha256: f.statusDto.snapshot.snapshotSha256,
      listingIds: ["listing-demo", "Missing"],
    };
    const { note, ...listing } = watchlistCommand().payload.memberships[0]!;
    expect(note).toBe("Invented note");
    f.resolve.mockReturnValue({
      snapshotSha256: command.snapshotSha256,
      results: [
        { listingId: "listing-demo", listing },
        { listingId: "Missing", listing: null },
      ],
    });
    const response = await f.handler(post(RESOLVE, command));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(f.resolve.mock.results[0]?.value);
    expect(f.resolve).toHaveBeenCalledWith(command);
    expect(f.openRepository).not.toHaveBeenCalled();
  });

  it.each(["changed", "throws", "invalid", "aborted"])(
    "keeps read-only resolve %s outside write uncertainty",
    async (mode) => {
      const f = storageFixture(),
        controller = new AbortController();
      const command = {
        snapshotSha256: f.statusDto.snapshot.snapshotSha256,
        listingIds: ["listing-demo"],
      };
      if (mode === "changed") f.resolve.mockReturnValue(null);
      else if (mode === "throws")
        f.resolve.mockImplementation(() => {
          throw new WatchlistRepositoryError("commit_unknown");
        });
      else
        f.resolve.mockImplementation(() => {
          if (mode === "aborted") controller.abort();
          return {
            snapshotSha256: command.snapshotSha256,
            results: [
              {
                listingId:
                  mode === "invalid" ? "wrong-listing" : "listing-demo",
                listing: null,
              },
            ],
          };
        });
      const response = await f.handler(
        post(RESOLVE, command, {}, controller.signal),
      );
      expect(await response.json()).toEqual({
        error:
          mode === "changed"
            ? "catalog_changed"
            : mode === "aborted"
              ? "request_timeout"
              : "unavailable",
      });
      expect(f.openRepository).not.toHaveBeenCalled();
    },
  );

  it("rejects resolve duplicates, oversize bodies and query strings before lookup", async () => {
    const f = storageFixture();
    const command = {
      snapshotSha256: f.statusDto.snapshot.snapshotSha256,
      listingIds: ["listing-demo", "listing-demo"],
    };
    expect((await f.handler(post(RESOLVE, command))).status).toBe(400);
    expect(
      (await f.handler(bytesRequest(RESOLVE, Buffer.alloc(8193)))).status,
    ).toBe(413);
    expect((await f.handler(post(`${RESOLVE}?`, command))).status).toBe(400);
    expect(f.resolve).not.toHaveBeenCalled();
    expect(f.openRepository).not.toHaveBeenCalled();
  });

  it.each([
    [ORIGIN, WATCHLIST],
    [ORIGIN, RESOLVE],
    [NATIVE_ORIGIN, WATCHLIST],
    [NATIVE_ORIGIN, RESOLVE],
  ])(
    "permits only the selected POST preflight at %s for %s",
    async (origin, path) => {
      const f = storageFixture();
      expect(
        (
          await f.handler(
            request(path, {
              method: "OPTIONS",
              origin,
              headers: {
                "access-control-request-method": "POST",
                "access-control-request-headers": "authorization, content-type",
              },
            }),
          )
        ).status,
      ).toBe(204);
      expect(
        (
          await f.handler(
            request(path, {
              method: "OPTIONS",
              origin,
              headers: {
                "access-control-request-method": "POST",
                "access-control-request-headers": "authorization, cookie",
              },
            }),
          )
        ).status,
      ).toBe(403);
      expect(f.auth).not.toHaveBeenCalled();
      expect(f.openRepository).not.toHaveBeenCalled();
    },
  );
});

describe("managed annual read-only POST boundary", () => {
  const path = "/v1/managed/sec-annual-evidence";
  const value = {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    listingId: "listing-demo",
    symbol: "DEMO",
  };
  function setup() {
    const f = fixture();
    const load = vi
      .fn<ManagedSecAnnualService["load"]>()
      .mockRejectedValue(new ManagedSecAnnualServiceError("unavailable"));
    const assertActive = vi.fn<ManagedSecAnnualService["assertActive"]>();
    const handler = createManagedWorkspaceHandler({
      auth: f.auth,
      catalog: { status: f.status, search: f.search, resolve: f.resolve },
      openRepository: f.openRepository,
      annual: { load, assertActive },
    });
    const post = (
      body: unknown = value,
      headers: Record<string, string> = {},
    ) =>
      new Request(`https://managed.invalid${path}`, {
        method: "POST",
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
      });
    return { ...f, load, assertActive, handler, post };
  }
  it("authenticates before body/service and never opens the watchlist repository", async () => {
    const f = setup();
    f.auth.mockResolvedValue({ status: "unauthenticated" });
    expect((await f.handler(f.post({ invalid: true }))).status).toBe(401);
    expect(f.load).not.toHaveBeenCalled();
    expect(f.openRepository).not.toHaveBeenCalled();
  });
  it("strictly owns the four request fields before annual dispatch", async () => {
    const f = setup();
    expect(
      (await f.handler(f.post({ ...value, cik: "0000320193" }))).status,
    ).toBe(400);
    expect(f.load).not.toHaveBeenCalled();
    const response = await f.handler(f.post());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
    expect(f.load).toHaveBeenCalledExactlyOnceWith(
      value,
      OWNER,
      expect.any(AbortSignal),
    );
    expect(f.openRepository).not.toHaveBeenCalled();
  });
  it.each([
    ["not_configured", 503],
    ["catalog_changed", 409],
    ["request_timeout", 408],
    ["invalid_request", 400],
  ] as const)(
    "keeps annual %s finite and outside watchlist uncertainty",
    async (code, status) => {
      const f = setup();
      f.load.mockRejectedValue(new ManagedSecAnnualServiceError(code));
      const response = await f.handler(f.post());
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: code });
    },
  );
  it("returns only the checked cooldown and preserves no-store/origin headers", async () => {
    const f = setup();
    f.load.mockRejectedValue(
      new ManagedSecAnnualServiceError(
        "rate_limited",
        "2026-10-01T12:00:20.000Z",
      ),
    );
    const response = await f.handler(f.post());
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "rate_limited",
      nextAllowedAt: "2026-10-01T12:00:20.000Z",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });
  it("admits exact POST preflight without auth and rejects query/oversized body", async () => {
    const f = setup();
    expect(
      (
        await f.handler(
          new Request(`https://managed.invalid${path}`, {
            method: "OPTIONS",
            headers: {
              origin: NATIVE_ORIGIN,
              "access-control-request-method": "POST",
              "access-control-request-headers": "Authorization, Content-Type",
            },
          }),
        )
      ).status,
    ).toBe(204);
    expect(f.auth).not.toHaveBeenCalled();
    expect(
      (
        await f.handler(
          new Request(`https://managed.invalid${path}?x=1`, {
            method: "POST",
            headers: { origin: ORIGIN },
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await f.handler(f.post({ ...value, symbol: "A".repeat(4096) }))).status,
    ).toBe(413);
    expect(f.load).not.toHaveBeenCalled();
  });
  it("checks the serialized response cap and late liveness before returning", async () => {
    const f = setup();
    f.load.mockResolvedValue({
      oversized: "x".repeat(2097152),
    } as unknown as Awaited<ReturnType<ManagedSecAnnualService["load"]>>);
    expect((await f.handler(f.post())).status).toBe(503);
    f.load.mockResolvedValue(
      {} as Awaited<ReturnType<ManagedSecAnnualService["load"]>>,
    );
    f.assertActive
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new ManagedSecAnnualServiceError("request_timeout");
      });
    expect((await f.handler(f.post())).status).toBe(408);
  });
});
