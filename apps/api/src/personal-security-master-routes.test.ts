import type {
  PersonalSecurityMasterSearchResponseDto,
  PersonalSecurityMasterStatusDto,
} from "@research-cockpit/contracts";
import { admitPersonalSecurityMasterSnapshot } from "@research-cockpit/personal-security-master";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildPersonalSecurityMasterApp } from "./security-master-app";
import {
  parseCanonicalSecurityMasterSearchUrl,
  PERSONAL_SECURITY_MASTER_SEARCH_PATH,
  PERSONAL_SECURITY_MASTER_STATUS_PATH,
} from "./personal-security-master-routes";
import {
  bootstrapTestPersonalOwnerSession,
  createTestPersonalOwnerSession,
} from "./test-personal-owner-session-builder";
import type { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";

const apps: FastifyInstance[] = [];
const cookies = new WeakMap<FastifyInstance, string>();

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe("personal security-master routes", () => {
  it("returns the bounded snapshot receipt without local paths or raw records", async () => {
    const app = await readyApp();
    const response = await allowedRequest(
      app,
      PERSONAL_SECURITY_MASTER_STATUS_PATH,
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.headers.etag).toBeUndefined();
    expect(response.headers["x-trace-id"]).toMatch(/^trace-/u);
    const body = response.json<PersonalSecurityMasterStatusDto>();
    expect(body.snapshot).toMatchObject({
      catalogId: "personal-security-master-2026-09",
      claim: "bounded_exact_owner_local_security_master_snapshot_admitted",
      coverage: {
        activeEligibleSecurities: 2,
        activeListings: 2,
        admittedSourceRecords: 2,
        basis: "synthetic_engineering_only_not_real_universe",
        issuers: 1,
        providerMappings: 4,
        shareClasses: 2,
        totalSecurities: 2,
      },
      profile: "personal_single_user_local_security_master",
      provenance: {
        contentKind: "synthetic_engineering",
        sourceId: "synthetic-security-source",
      },
      status: "admitted_for_personal_local_search",
    });
    expect(Object.keys(body)).toEqual(["snapshot"]);
    expect(Object.keys(body.snapshot)).toEqual([
      "asOf",
      "catalogId",
      "catalogVersion",
      "claim",
      "coverage",
      "generatedAt",
      "profile",
      "provenance",
      "schemaVersion",
      "snapshotSha256",
      "sourcePolicyCompatibility",
      "status",
    ]);
    expect(Object.keys(body.snapshot.coverage)).toEqual([
      "activeEligibleSecurities",
      "activeListings",
      "admittedSourceRecords",
      "basis",
      "eligibleSecurityBand",
      "formerTickerEntries",
      "ineligibleSourceRecords",
      "inactiveSecurities",
      "issuers",
      "providerMappings",
      "quarantinedSourceRecords",
      "sourceRecords",
      "staleSourceRecords",
      "shareClasses",
      "totalSecurities",
      "unsupportedSourceRecords",
    ]);
    expect(body.snapshot.coverage).toMatchObject({
      admittedSourceRecords: 2,
      ineligibleSourceRecords: 5,
      quarantinedSourceRecords: 3,
      sourceRecords: 17,
      staleSourceRecords: 4,
      unsupportedSourceRecords: 3,
    });
    expect(Object.keys(body.snapshot.provenance)).toEqual([
      "acquiredAt",
      "artifacts",
      "attribution",
      "contentKind",
      "sourceId",
      "sourceRevision",
    ]);
    expect(Object.keys(body.snapshot.provenance.artifacts[0] ?? {})).toEqual([
      "acquiredAt",
      "artifactId",
      "contentSha256",
      "mediaType",
      "sourceUri",
      "sourceVersion",
    ]);
    expect(
      body.snapshot.provenance.artifacts.map((artifact) => artifact.mediaType),
    ).toEqual(["application/json", "text/html"]);
    expect(Object.keys(body.snapshot.sourcePolicyCompatibility)).toEqual([
      "attribution",
      "cache",
      "decision",
      "deleteOnRequest",
      "display",
      "effectiveAt",
      "expiresAt",
      "export",
      "intendedUse",
      "localOnly",
      "operation",
      "policyDocumentSha256",
      "policyId",
      "policyProfile",
      "policySchemaVersion",
      "policyVersion",
      "redistribution",
      "retention",
      "reviewedAt",
      "revocationCheck",
      "revokedAt",
      "rightsBasis",
      "search",
      "sourceId",
    ]);
    expect(response.payload).not.toContain("sourceLocator");
    expect(response.payload).not.toContain("owner-local-composite-manifest");
    expect(response.payload).not.toContain("listing-figi-00000");
    expect(response.payload).not.toContain("share-class-figi-00000");
    expect(response.payload).not.toContain("OLDZERO");
  });

  it.each([
    ["S00000", "current_symbol_exact", "S00000"],
    ["S000", "current_symbol_prefix", "S00000"],
    ["OLDZERO", "former_symbol_exact", "S00000"],
    ["Z%C3%A9ro%20Alpha%20Holdings", "name_exact", "S00000"],
    ["Alpha", "name_token_prefix", "S00000"],
  ] as const)(
    "serves deterministic bounded search for %s",
    async (encodedQuery, matchKind, symbol) => {
      const app = await readyApp();
      const response = await allowedRequest(
        app,
        `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=${encodedQuery}&limit=2`,
      );

      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      const body = response.json<PersonalSecurityMasterSearchResponseDto>();
      expect(body.limitApplied).toBe(2);
      expect(body.totalMatches).toBeGreaterThanOrEqual(1);
      expect(body.results[0]).toMatchObject({
        country: "US",
        issuerId: "iss-00000",
        matchKind,
        shareClassId: "shr-00000",
        shareClassName: "Zéro Alpha ADR",
        symbol,
      });
      expect(Object.keys(body.results[0] ?? {}).sort()).toEqual(
        [
          "cik",
          "country",
          "exchangeMic",
          "instrumentType",
          "issuerId",
          "issuerName",
          "listingId",
          "matchKind",
          "matchedValue",
          "securityId",
          "securityName",
          "shareClassId",
          "shareClassName",
          "symbol",
        ].sort(),
      );
      expect(response.payload).not.toContain("sourceLocator");
      expect(response.payload).not.toContain("listing-figi-00000");
      expect(response.payload).not.toContain("share-class-figi-00000");
    },
  );

  it("defaults the limit and produces byte-identical concurrent responses", async () => {
    const app = await readyApp();
    const responses = await Promise.all(
      Array.from({ length: 20 }, async () =>
        allowedRequest(app, `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=S000`),
      ),
    );

    expect(responses.every((response) => response.statusCode === 200)).toBe(
      true,
    );
    expect(new Set(responses.map((response) => response.payload)).size).toBe(1);
    expect(
      responses[0]?.json<PersonalSecurityMasterSearchResponseDto>()
        .limitApplied,
    ).toBe(10);
  });

  it("accepts a canonical 128-code-point supplementary Unicode query", async () => {
    const app = await readyApp();
    const query = "\u{20000}".repeat(128);
    const url = `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=${encodeURIComponent(query)}`;

    expect(url.length).toBeGreaterThan(1_024);
    expect(url.length).toBeLessThanOrEqual(2_048);
    expect(parseCanonicalSecurityMasterSearchUrl(url)).toEqual({
      limit: 10,
      query,
    });

    const response = await allowedRequest(app, url);
    expect(response.statusCode).toBe(200);
    expect(
      response.json<PersonalSecurityMasterSearchResponseDto>(),
    ).toMatchObject({
      limitApplied: 10,
      normalizedQuery: query,
      results: [],
      totalMatches: 0,
    });
  });

  it("rejects a canonical query whose compatibility normalization exceeds the response bound", async () => {
    const app = await readyApp();
    const query = "\uFDFA".repeat(100);
    const url = `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=${encodeURIComponent(query)}`;

    expect([...query.normalize("NFKD")]).toHaveLength(1_800);
    expect(parseCanonicalSecurityMasterSearchUrl(url)).toEqual({
      limit: 10,
      query,
    });

    const response = await allowedRequest(app, url);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      detail: "The personal security-master search request was not accepted.",
      status: 400,
      title: "Invalid request",
    });
    expect(response.payload).not.toContain(query);
  });

  it.each([
    ["missing session", {}],
    ["nonloopback peer", { remoteAddress: "192.0.2.1" }],
    ["wrong host", { host: "localhost:3100" }],
    ["wrong origin", { origin: "https://untrusted.example" }],
    ["forwarded authority", { forwarded: "for=127.0.0.1" }],
    ["authorization", { authorization: "Bearer private-canary" }],
    ["range", { range: "bytes=0-1" }],
    ["GET content length", { contentLength: "0" }],
    ["GET content type", { contentType: "application/json" }],
    ["transfer encoding", { transferEncoding: "chunked" }],
  ] as const)("rejects %s at the owner boundary", async (label, change) => {
    const app = await readyApp();
    const headers = allowedHeaders(
      label === "missing session" ? undefined : requireCookie(app),
    );
    if ("host" in change) headers.host = change.host;
    if ("origin" in change) headers.origin = change.origin;
    if ("forwarded" in change) headers.forwarded = change.forwarded;
    if ("authorization" in change) headers.authorization = change.authorization;
    if ("range" in change) headers.range = change.range;
    if ("contentLength" in change)
      headers["content-length"] = change.contentLength;
    if ("contentType" in change) headers["content-type"] = change.contentType;
    if ("transferEncoding" in change)
      headers["transfer-encoding"] = change.transferEncoding;
    const response = await app.inject({
      method: "GET",
      url: `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=S00000`,
      headers,
      remoteAddress:
        "remoteAddress" in change ? change.remoteAddress : "127.0.0.1",
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.payload).not.toContain("private-canary");
    expect(response.payload).not.toContain("untrusted.example");
    expect(response.payload).not.toContain("192.0.2.1");
  });

  it.each([
    "",
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=A&q=B`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=A&unknown=B`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?limit=2&q=A`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=A&limit=2&limit=3`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=A&limit=01`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=A&limit=0`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=A&limit=26`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=%41`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=%c3%a9`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=A+B`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=%20A`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=A%20`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=%00`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=%E2%80%AE`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=%FF`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=%C3%28`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=%ED%A0%80`,
    `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=A#fragment`,
    `${PERSONAL_SECURITY_MASTER_STATUS_PATH}?q=A`,
  ])("rejects noncanonical or unsafe search URL %s", async (url) => {
    expect(parseCanonicalSecurityMasterSearchUrl(url)).toBeUndefined();
    if (
      !url.startsWith(PERSONAL_SECURITY_MASTER_SEARCH_PATH) ||
      !url.includes("?") ||
      url.includes("#")
    ) {
      return;
    }
    const app = await readyApp();
    const response = await allowedRequest(app, url);
    expect(response.statusCode).toBe(403);
    expect(response.payload).not.toContain(url.slice(url.indexOf("?")));
  });

  it("fails closed for literal lone surrogates and all parser bounds", () => {
    const loneHighSurrogate = `\uD800`;
    expect(() =>
      parseCanonicalSecurityMasterSearchUrl(
        `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=${loneHighSurrogate}`,
      ),
    ).not.toThrow();
    expect(
      parseCanonicalSecurityMasterSearchUrl(
        `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=${loneHighSurrogate}`,
      ),
    ).toBeUndefined();
    expect(
      parseCanonicalSecurityMasterSearchUrl(
        `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=${"A".repeat(129)}`,
      ),
    ).toBeUndefined();
    expect(
      parseCanonicalSecurityMasterSearchUrl(
        `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=${"A".repeat(2_049)}`,
      ),
    ).toBeUndefined();
  });

  it("accepts only GET and exposes no implicit HEAD route", async () => {
    const app = await readyApp();
    const headers = allowedHeaders(requireCookie(app));
    for (const [method, url] of [
      ["HEAD", PERSONAL_SECURITY_MASTER_STATUS_PATH],
      ["POST", PERSONAL_SECURITY_MASTER_STATUS_PATH],
      ["HEAD", `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=A`],
      ["POST", `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=A`],
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers,
        remoteAddress: "127.0.0.1",
      });
      expect(response.statusCode).toBe(404);
      expect(response.headers["cache-control"]).toBe("private, no-store");
    }
  });

  it("rejects forged catalog and owner-session capabilities", async () => {
    const admission = buildTestSecurityMasterAdmission();
    const catalog = admitPersonalSecurityMasterSnapshot(admission);
    const ownerSession = createTestPersonalOwnerSession();
    const forgedCatalog = Object.freeze({ ...catalog });

    await expect(
      buildPersonalSecurityMasterApp(forgedCatalog, ownerSession.authority),
    ).rejects.toThrow("Personal security master is unavailable.");
    ownerSession.authority.close();
    await expect(
      buildPersonalSecurityMasterApp(
        catalog,
        Object.freeze({}) as PersonalOwnerSessionAuthority,
      ),
    ).rejects.toThrow("Personal owner session is unavailable.");
  });
});

async function readyApp(): Promise<FastifyInstance> {
  const admission = buildTestSecurityMasterAdmission();
  const catalog = admitPersonalSecurityMasterSnapshot(admission);
  const ownerSession = createTestPersonalOwnerSession();
  const app = await buildPersonalSecurityMasterApp(
    catalog,
    ownerSession.authority,
  );
  apps.push(app);
  cookies.set(
    app,
    await bootstrapTestPersonalOwnerSession(app, ownerSession.secret),
  );
  return app;
}

async function allowedRequest(app: FastifyInstance, url: string) {
  return app.inject({
    method: "GET",
    url,
    headers: allowedHeaders(requireCookie(app)),
    remoteAddress: "127.0.0.1",
  });
}

function allowedHeaders(cookie: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
  };
  if (cookie !== undefined) headers.cookie = cookie;
  return headers;
}

function requireCookie(app: FastifyInstance): string {
  const cookie = cookies.get(app);
  if (cookie === undefined) throw new Error("Test owner-session unavailable.");
  return cookie;
}
