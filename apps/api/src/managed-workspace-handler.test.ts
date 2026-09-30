import * as contracts from "@research-cockpit/contracts";
import type {
  ManagedCatalogSearchDto,
  ManagedCatalogStatusDto,
} from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ClerkTrialAuth } from "./clerk-trial-auth";
import {
  createManagedCatalogService,
  type ManagedCatalogService,
} from "./managed-workspace-catalog";
import { createManagedWorkspaceHandler } from "./managed-workspace-handler";

const ORIGIN = "https://app.investingpro.app";
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
  const handler = createManagedWorkspaceHandler({
    auth,
    catalog: { status, search },
  });
  return { handler, auth, status, search, statusDto, searchDto };
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
  it("returns the shared status and search identities after authenticating", async () => {
    const f = fixture();
    const statusRequest = request();
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
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(response.headers.has("access-control-allow-credentials")).toBe(
      false,
    );
    expect(response.headers.get("vary")).toBe("Origin");
    const found = await f.handler(request(`${SEARCH}?q=%20demo%20`));
    expect(found.status).toBe(200);
    expect(await found.json()).toEqual(f.searchDto);
    expect(f.search).toHaveBeenCalledWith(" demo ");
    expect(f.status).toHaveBeenCalledTimes(1);
    expect(f.search).toHaveBeenCalledTimes(1);
  });

  it.each([null, "null", `${ORIGIN}/`, "https://other.example.invalid"])(
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

  it.each([STATUS, `${SEARCH}?q=DEMO`])(
    "permits a narrow unauthenticated GET preflight for %s",
    async (path) => {
      const f = fixture();
      const response = await f.handler(
        request(path, {
          method: "OPTIONS",
          headers: {
            "access-control-request-method": "GET",
            "access-control-request-headers": " AUTHORIZATION ",
          },
        }),
      );
      expect(response.status).toBe(204);
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
    const handler = createManagedWorkspaceHandler({ auth, catalog });
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
