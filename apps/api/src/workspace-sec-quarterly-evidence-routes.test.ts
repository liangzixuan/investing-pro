import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  PersonalSecQuarterlyEvidenceDto,
  PersonalSecQuarterlyEvidenceResponseDto,
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
  PersonalSecQuarterlyEvidenceProviderError,
  type PersonalSecQuarterlyEvidenceProvider,
} from "./personal-sec-quarterly-evidence-provider";
import { bootstrapTestPersonalOwnerSession } from "./test-personal-owner-session-builder";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { buildPersonalWorkspaceApp } from "./workspace-app";
import { PERSONAL_SEC_QUARTERLY_EVIDENCE_PATH } from "./workspace-sec-quarterly-evidence-routes";

const applications: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

describe("selected-company SEC evidence route", () => {
  it("derives issuer and CIK from the catalog and closes its provider", async () => {
    const fixture = await setup();
    const response = await fixture.request();
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    const body = response.json<PersonalSecQuarterlyEvidenceResponseDto>();
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

  it.each([
    null,
    [],
    {},
    { listingId: "lst-00000", symbol: "S00000" },
    {
      schemaVersion: "1.0.0",
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
      url: `${PERSONAL_SEC_QUARTERLY_EVIDENCE_PATH}?cik=1`,
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
      new PersonalSecQuarterlyEvidenceProviderError(error),
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
    ): Promise<PersonalSecQuarterlyEvidenceDto> => {
      void _signal;
      return Promise.resolve(evidence(cik));
    },
  );
  const close = vi.fn();
  const provider: PersonalSecQuarterlyEvidenceProvider = {
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
    provider,
  );
  applications.push(app);
  const body = {
    schemaVersion: "1.0.0",
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
        url: PERSONAL_SEC_QUARTERLY_EVIDENCE_PATH,
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

function evidence(cik: string): PersonalSecQuarterlyEvidenceDto {
  return {
    cik,
    fetchedAt: "2026-09-10T12:00:00.000Z",
    sources: {
      companyFacts: {
        status: "available",
        sourceUrl: `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      },
      submissions: {
        status: "available",
        sourceUrl: `https://data.sec.gov/submissions/CIK${cik}.json`,
      },
    },
    olderHistoryAvailable: false,
    coverage: {
      inspectedRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      availableObservations: 0,
      returnedObservations: 0,
      truncated: false,
      conceptsWithoutUsd: [],
    },
    observations: [],
    ttm: { status: "unavailable", reason: "period_and_revision_not_admitted" },
  };
}
