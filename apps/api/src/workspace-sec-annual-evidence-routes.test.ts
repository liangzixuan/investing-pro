import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  type PersonalSecAnnualCanonicalEvidenceDto,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import {
  LOCAL_RESEARCH_VAULT_PROFILE,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
import { admitPersonalSecurityMasterSnapshot } from "@research-cockpit/personal-security-master";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import {
  PersonalSecAnnualEvidenceProviderError,
  type PersonalSecAnnualEvidenceProvider,
} from "./personal-sec-annual-evidence-provider";
import { bootstrapTestPersonalOwnerSession } from "./test-personal-owner-session-builder";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { buildPersonalWorkspaceApp } from "./workspace-app";
import { PERSONAL_SEC_ANNUAL_EVIDENCE_PATH } from "./workspace-sec-annual-evidence-routes";
import { createPersonalSecAnnualCanonicalEvidence } from "./personal-sec-annual-canonical-evidence";
import { normalizePersonalSecAnnualStatementCompanyFacts } from "./personal-sec-annual-statement-company-facts";
import {
  normalizePersonalSecSubmissions,
  parsePersonalSecSourceJson,
} from "./personal-sec-quarterly-evidence-provider";

const applications: FastifyInstance[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

describe("selected-company observed annual SEC evidence route", () => {
  it("derives issuer and CIK from the catalog and closes its provider", async () => {
    const fixture = await setup();
    const response = await fixture.request();
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    const body = response.json<PersonalSecAnnualCanonicalResponseDto>();
    expect(body.schemaVersion).toBe(PERSONAL_SEC_ANNUAL_CANONICAL_VERSION);
    expect(body.catalogSnapshotSha256).toBe(fixture.body.catalogSnapshotSha256);
    expect(body.security).toEqual({
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "iss-00000",
      issuerName: "Zéro Alpha Holdings",
      listingId: "lst-00000",
      securityName: "Zéro Alpha Security",
      symbol: "S00000",
      cik: "0000000001",
    });
    expect(body.evidence.cik).toBe(body.security.cik);
    expect(body.evidence.generation.definitionVersion).toBe("6.0.0");
    expect(body.evidence.facts.scans).toHaveLength(32);
    expect(body.evidence.facts.observations).toHaveLength(32);
    expect(
      body.evidence.facts.observations.find(
        (row) => row.concept === "StockholdersEquity",
      )!.value,
    ).toBe("-9007199254740993.125");
    expect(
      body.evidence.facts.observations.find(
        (row) => row.concept === "Revenues",
      )!.value,
    ).toBe("9007199254740993.125");
    expect(
      body.evidence.facts.observations.find(
        (row) => row.concept === "Revenues",
      )!.sourceLocator,
    ).toBe("/facts/us-gaap/Revenues/units/USD/0");
    expect(response.payload.match(/"observations":/gu)).toHaveLength(1);
    expect(fixture.loadEvidence).toHaveBeenCalledWith(
      "0000000001",
      expect.any(AbortSignal),
    );
    await fixture.app.close();
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it("authenticates before parsing malformed JSON or calling the source", async () => {
    const fixture = await setup();
    const response = await fixture.request("{ private-canary", false);
    expect(response.statusCode).toBe(403);
    expect(response.payload).not.toContain("private-canary");
    expect(fixture.loadEvidence).not.toHaveBeenCalled();
    expect((await fixture.request("{ private-canary")).statusCode).toBe(400);
  });

  it.each(["1.0.0", "2.0.0", "3.0.0", "4.0.0", "5.0.0"])(
    "rejects version %s before calling the source",
    async (schemaVersion) => {
      const fixture = await setup();
      expect(
        (await fixture.request({ ...fixture.body, schemaVersion })).statusCode,
      ).toBe(400);
      expect(fixture.loadEvidence).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    [],
    {},
    { listingId: "lst-00000", symbol: "S00000" },
    {
      schemaVersion: PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
      catalogSnapshotSha256: "bad",
      listingId: "lst-00000",
      symbol: "S00000",
    },
  ])("rejects malformed request %j", async (body) => {
    const fixture = await setup();
    expect((await fixture.request(body)).statusCode).toBe(400);
    expect(fixture.loadEvidence).not.toHaveBeenCalled();
  });

  it("rejects caller-supplied CIK, unknown listing, stale catalog and query variants", async () => {
    const fixture = await setup();
    expect(
      (await fixture.request({ ...fixture.body, cik: "0000000001" }))
        .statusCode,
    ).toBe(400);
    expect(
      (await fixture.request({ ...fixture.body, listingId: "lst-99999" }))
        .statusCode,
    ).toBe(404);
    expect(
      (await fixture.request({ ...fixture.body, symbol: "S00001" })).statusCode,
    ).toBe(404);
    expect(
      (
        await fixture.request({
          ...fixture.body,
          catalogSnapshotSha256: `sha256:${"0".repeat(64)}`,
        })
      ).statusCode,
    ).toBe(409);
    const query = await fixture.app.inject({
      method: "POST",
      url: `${PERSONAL_SEC_ANNUAL_EVIDENCE_PATH}?cik=1`,
      headers: headers(fixture.cookie),
      payload: fixture.body,
      remoteAddress: "127.0.0.1",
    });
    expect(query.statusCode).toBe(403);
    expect(fixture.loadEvidence).not.toHaveBeenCalled();
  });

  it.each([
    ["not_configured", 503, "not_configured"],
    ["busy", 429, "rate_limited"],
    ["invalid_request", 400, "invalid_request"],
    ["aborted", 502, "provider_unavailable"],
  ] as const)("sanitizes %s", async (error, status, code) => {
    const fixture = await setup();
    fixture.loadEvidence.mockRejectedValueOnce(
      new PersonalSecAnnualEvidenceProviderError(error),
    );
    const response = await fixture.request();
    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ code });
  });

  it("rejects wrong-issuer responses and suppresses raw errors", async () => {
    const fixture = await setup();
    fixture.loadEvidence.mockResolvedValueOnce(evidence("0000000002"));
    expect((await fixture.request()).statusCode).toBe(502);
    fixture.loadEvidence.mockRejectedValueOnce(
      new Error("private-provider-canary"),
    );
    const response = await fixture.request();
    expect(response.statusCode).toBe(502);
    expect(response.payload).not.toContain("private-provider-canary");
  });

  it("does not send results after the owner session becomes invalid", async () => {
    const fixture = await setup();
    fixture.loadEvidence.mockImplementationOnce((cik) => {
      fixture.authority.close();
      return Promise.resolve(evidence(cik));
    });
    const response = await fixture.request();
    expect(response.statusCode).toBe(403);
    expect(response.payload).not.toContain("observations");
  });

  it("preserves the shared local owner JSON framing limit before body parsing", async () => {
    const fixture = await setup();
    const body = JSON.stringify(fixture.body);
    expect(
      (await fixture.request(" ".repeat(4096 - Buffer.byteLength(body)) + body))
        .statusCode,
    ).toBe(200);
    fixture.loadEvidence.mockClear();
    const response = await fixture.request(
      " ".repeat(4097 - Buffer.byteLength(body)) + body,
    );
    expect(response.statusCode).toBe(403);
    expect(fixture.loadEvidence).not.toHaveBeenCalled();
  });

  it.each([50, 100])(
    "delivers all 32 concepts with %d rows or refuses the whole over-bound response",
    async (rowsPerConcept) => {
      const fixture = await setup();
      const graph = evidence(
        "0000000001",
        rowsPerConcept,
        rowsPerConcept === 100,
      );
      const before = JSON.stringify(graph);
      fixture.loadEvidence.mockResolvedValueOnce(graph);
      const response = await fixture.request();
      expect(response.statusCode).toBe(rowsPerConcept === 50 ? 200 : 502);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      if (rowsPerConcept === 50) {
        const body = response.json<PersonalSecAnnualCanonicalResponseDto>();
        expect(body.evidence.facts.observations).toHaveLength(1600);
        expect(body.evidence).toEqual(graph);
        expect(Buffer.byteLength(response.payload)).toBeLessThanOrEqual(
          2_097_152,
        );
      } else {
        expect(graph.facts.observations).toHaveLength(3200);
        expect(response.json()).toMatchObject({ code: "provider_unavailable" });
        expect(response.payload).not.toContain("observations");
        expect(response.payload).not.toContain("response_too_large");
      }
      expect(JSON.stringify(graph)).toBe(before);
      expect(fixture.loadEvidence).toHaveBeenCalledOnce();
    },
  );

  it.each(["unfrozen", "generation", "extra"] as const)(
    "sanitizes an invalid canonical provider graph: %s",
    async (kind) => {
      const fixture = await setup();
      const graph = evidence("0000000001");
      const changed =
        kind === "unfrozen"
          ? structuredClone(graph)
          : kind === "generation"
            ? Object.freeze({
                ...graph,
                generation: Object.freeze({
                  ...graph.generation,
                  sha256: `sha256:${"f".repeat(64)}` as const,
                }),
              })
            : Object.freeze({ ...graph, derivedPrivateCanary: true });
      fixture.loadEvidence.mockResolvedValueOnce(changed);
      const response = await fixture.request();
      expect(response.statusCode).toBe(502);
      expect(response.json()).toMatchObject({ code: "provider_unavailable" });
      expect(response.payload).not.toContain("derivedPrivateCanary");
      expect(response.payload).not.toContain("Invalid canonical");
    },
  );

  it("rechecks owner authority after final packet serialization", async () => {
    const fixture = await setup();
    const stringify = JSON.stringify;
    let prepared = false;
    vi.spyOn(JSON, "stringify").mockImplementation((value, ...args) => {
      if (
        value !== null &&
        typeof value === "object" &&
        "security" in value &&
        "evidence" in value
      ) {
        prepared = true;
        fixture.authority.close();
      }
      return stringify(value, ...args);
    });
    const response = await fixture.request();
    expect(prepared).toBe(true);
    expect(response.statusCode).toBe(403);
    expect(response.payload).not.toContain("observations");
  });

  it("suppresses a prepared body after disconnect during encoding and removes its listeners", async () => {
    const fixture = await setup();
    let requestRaw: IncomingMessage | undefined;
    let replyRaw: ServerResponse | undefined;
    fixture.app.addHook("preHandler", (request, reply, done) => {
      requestRaw = request.raw;
      replyRaw = reply.raw;
      done();
    });
    const stringify = JSON.stringify;
    let prepared = false;
    vi.spyOn(JSON, "stringify").mockImplementation((value, ...args) => {
      if (
        value !== null &&
        typeof value === "object" &&
        "security" in value &&
        "evidence" in value
      ) {
        prepared = true;
        requestRaw!.emit("aborted");
        replyRaw!.end();
      }
      return stringify(value, ...args);
    });
    const response = await fixture.request();
    expect(prepared).toBe(true);
    expect(response.payload).not.toContain("observations");
    expect(requestRaw!.listenerCount("aborted")).toBe(0);
    expect(replyRaw!.listenerCount("close")).toBe(0);
  });

  it.each(["cutoffAt", "accessionNumber", "sourceUrl", "target", "generation"])(
    "rejects caller control over %s before source work",
    async (key) => {
      const fixture = await setup();
      const response = await fixture.request({
        ...fixture.body,
        [key]: "private-canary",
      });
      expect(response.statusCode).toBe(400);
      expect(response.payload).not.toContain("private-canary");
      expect(fixture.loadEvidence).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      host: "attacker.invalid:3100",
      origin: "http://127.0.0.1:3000",
      remote: "127.0.0.1",
    },
    {
      host: "127.0.0.1:3100",
      origin: "https://attacker.invalid",
      remote: "127.0.0.1",
    },
    {
      host: "127.0.0.1:3100",
      origin: "http://127.0.0.1:3000",
      remote: "192.0.2.1",
    },
  ])(
    "rejects forged host/origin or non-loopback caller %j before source work",
    async (boundary) => {
      const fixture = await setup();
      await fixture.request();
      fixture.loadEvidence.mockClear();
      const response = await fixture.app.inject({
        method: "POST",
        url: PERSONAL_SEC_ANNUAL_EVIDENCE_PATH,
        headers: {
          ...headers(fixture.cookie),
          host: boundary.host,
          origin: boundary.origin,
        },
        remoteAddress: boundary.remote,
        payload: fixture.body,
      });
      expect(response.statusCode).toBe(403);
      expect(fixture.loadEvidence).not.toHaveBeenCalled();
    },
  );

  it("prioritizes revoked authorization over a late provider rejection", async () => {
    const fixture = await setup();
    fixture.loadEvidence.mockImplementationOnce(() => {
      fixture.authority.close();
      return Promise.reject(new Error("private-provider-canary"));
    });
    const response = await fixture.request();
    expect(response.statusCode).toBe(403);
    expect(response.payload).not.toContain("private-provider-canary");
  });

  it("aborts provider work on request disconnect and removes listeners", async () => {
    const fixture = await setup();
    let requestRaw: IncomingMessage | undefined;
    let replyRaw: ServerResponse | undefined;
    // Inject has no network socket; use its raw request to model a disconnect.
    fixture.app.addHook("preHandler", (request, reply, done) => {
      requestRaw = request.raw;
      replyRaw = reply.raw;
      done();
    });
    fixture.loadEvidence.mockImplementationOnce((cik, signal) => {
      requestRaw!.emit("aborted");
      expect(signal?.aborted).toBe(true);
      // Complete the synthetic response to allow light-my-request to settle.
      replyRaw!.end();
      return Promise.resolve(evidence(cik));
    });
    await fixture.request();
    expect(requestRaw!.listenerCount("aborted")).toBe(0);
    expect(replyRaw!.listenerCount("close")).toBe(0);
  });
});

async function setup() {
  const admission = buildTestSecurityMasterAdmission();
  const catalog = admitPersonalSecurityMasterSnapshot({
    expectedSha256: admission.expectedSha256,
    snapshot: admission.snapshot,
  });
  const secret = randomBytes(32).toString("hex");
  const authority = PersonalOwnerSessionAuthority.create(secret);
  const loadEvidence = vi.fn(
    (
      cik: string,
      _signal?: AbortSignal,
    ): Promise<PersonalSecAnnualCanonicalEvidenceDto> => {
      void _signal;
      return Promise.resolve(evidence(cik));
    },
  );
  const close = vi.fn();
  const provider: PersonalSecAnnualEvidenceProvider = {
    loadEvidence,
    close,
    status: () => ({ configured: true }),
  };
  const vault = {
    profile: LOCAL_RESEARCH_VAULT_PROFILE,
    close: vi.fn(),
  } as unknown as LocalResearchVault;
  const app = await buildPersonalWorkspaceApp(
    catalog,
    vault,
    authority,
    { host: "127.0.0.1", port: 3100 },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    provider,
  );
  applications.push(app);
  const body = {
    schemaVersion: PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
    catalogSnapshotSha256: catalog.snapshotSha256,
    listingId: "lst-00000",
    symbol: "S00000",
  };
  // Bootstrap is delayed until the first request so tests can install hooks.
  let cookie = "";
  return {
    app,
    authority,
    body,
    loadEvidence,
    close,
    get cookie() {
      return cookie;
    },
    request: async (payload: unknown = body, authenticated = true) => {
      if (cookie === "")
        cookie = await bootstrapTestPersonalOwnerSession(app, secret);
      return app.inject({
        method: "POST",
        url: PERSONAL_SEC_ANNUAL_EVIDENCE_PATH,
        headers: headers(authenticated ? cookie : undefined),
        remoteAddress: "127.0.0.1",
        payload:
          payload === null ? "null" : (payload as Record<string, unknown>),
      });
    },
  };
}

function headers(cookie?: string) {
  return {
    accept: "application/json",
    "content-type": "application/json",
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
    ...(cookie === undefined ? {} : { cookie }),
  };
}

function evidence(
  cik: string,
  rowsPerConcept = 1,
  escapedMetadata = false,
): PersonalSecAnnualCanonicalEvidenceDto {
  const accession = cik + "-26-000001";
  const companyText = JSON.stringify({
    cik: Number(cik),
    facts: {
      "us-gaap": Object.fromEntries(
        PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map((entry) => [
          entry.concept,
          {
            units: {
              USD: Array.from({ length: rowsPerConcept }, (_, index) => ({
                start:
                  entry.periodType === "instant" ? undefined : "2025-01-01",
                end: "2025-12-31",
                val:
                  entry.concept === "StockholdersEquity" && index === 0
                    ? "UNSAFE_NEGATIVE"
                    : index === 0
                      ? "UNSAFE_POSITIVE"
                      : entry.concept === "StockholdersEquity"
                        ? -index
                        : index,
                accn: accession,
                form: "10-K",
                filed: "2026-02-01",
                fy: 2025,
                fp: escapedMetadata ? '\\"'.repeat(16) : "FY",
                frame: escapedMetadata ? '\\"'.repeat(64) : "fixture-" + index,
              })),
            },
          },
        ]),
      ),
    },
  })
    .replaceAll('"UNSAFE_POSITIVE"', "9007199254740993.125")
    .replaceAll('"UNSAFE_NEGATIVE"', "-9007199254740993.125");
  const submissionsText = JSON.stringify({
    cik: Number(cik),
    filings: {
      recent: {
        accessionNumber: [accession],
        form: ["10-K"],
        filingDate: ["2026-02-01"],
        reportDate: ["2025-12-31"],
        acceptanceDateTime: ["2026-02-01T12:00:00.000Z"],
      },
      files: [],
    },
  });
  const source = (sourceUrl: string, text: string) => ({
    status: "available" as const,
    sourceUrl,
    fetchedAt: "2026-09-20T12:00:00.000Z",
    sha256: ("sha256:" +
      createHash("sha256").update(text).digest("hex")) as `sha256:${string}`,
    bytes: Buffer.byteLength(text),
  });
  return createPersonalSecAnnualCanonicalEvidence({
    cik,
    generation: {
      definitionVersion: "6.0.0",
      cutoffAt: "2026-09-20T12:00:00.000Z",
      completedAt: "2026-09-20T12:00:00.000Z",
      sources: {
        companyFacts: source(
          `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
          companyText,
        ),
        submissions: source(
          `https://data.sec.gov/submissions/CIK${cik}.json`,
          submissionsText,
        ),
      },
    },
    target: {
      status: "target",
      accessionNumber: accession,
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-12-31",
      acceptedAt: "2026-02-01T12:00:00.000Z",
    },
    targetScan: {
      currentFilings: 1,
      annualFilings: 1,
      olderHistoryAvailable: false,
    },
    facts: normalizePersonalSecAnnualStatementCompanyFacts(
      parsePersonalSecSourceJson(companyText),
      cik,
      accession,
    ),
    submissions: normalizePersonalSecSubmissions(
      parsePersonalSecSourceJson(submissionsText),
      cik,
    ),
  });
}
