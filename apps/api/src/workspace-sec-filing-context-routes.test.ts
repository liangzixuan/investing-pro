import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  PersonalSecFilingContextInspectionDto,
  PersonalSecFilingContextSelectionDto,
  PersonalSecFilingContextResponseDto,
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
  createSecPersonalFilingContextProvider,
  PersonalSecFilingContextProviderError,
  type PersonalSecFilingContextProvider,
} from "./personal-sec-filing-context-provider";
import {
  normalizePersonalSecCompanyFacts,
  parsePersonalSecSourceJson,
} from "./personal-sec-quarterly-evidence-provider";
import { bootstrapTestPersonalOwnerSession } from "./test-personal-owner-session-builder";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { buildPersonalWorkspaceApp } from "./workspace-app";
import { PERSONAL_SEC_FILING_CONTEXT_PATH } from "./workspace-sec-filing-context-routes";

const applications: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

describe("selected SEC filing context route", () => {
  it("serializes real primary-filing evidence through source revalidation, worker and owner route", async () => {
    const fixture = await setup();
    const facts = {
      cik: 1,
      facts: {
        "us-gaap": {
          Revenues: {
            units: {
              USD: [
                {
                  start: "2026-01-01",
                  end: "2026-03-31",
                  val: 100,
                  accn: "0000000001-26-000001",
                  form: "10-Q",
                  filed: "2026-05-01",
                },
              ],
            },
          },
        },
      },
    };
    const retained = normalizePersonalSecCompanyFacts(
      parsePersonalSecSourceJson(JSON.stringify(facts)),
      "0000000001",
    ).observations[0]!;
    const submissions = {
      cik: 1,
      filings: {
        recent: {
          accessionNumber: [retained.accessionNumber],
          form: ["10-Q"],
          filingDate: ["2026-05-01"],
          reportDate: ["2026-03-31"],
          acceptanceDateTime: ["2026-05-01T12:00:00Z"],
          primaryDocument: ["report.htm"],
        },
        files: [],
      },
    };
    const document = `<html xmlns:ix="http://www.xbrl.org/2013/inlineXBRL" xmlns:x="http://www.xbrl.org/2003/instance" xmlns:g="http://fasb.org/us-gaap/2025" xmlns:iso="http://www.xbrl.org/2003/iso4217"><x:context id="c"><x:entity><x:identifier scheme="http://www.sec.gov/CIK">1</x:identifier></x:entity><x:period><x:startDate>2026-01-01</x:startDate><x:endDate>2026-03-31</x:endDate></x:period></x:context><x:unit id="u"><x:measure>iso:USD</x:measure></x:unit><ix:nonFraction id="revenue" name="g:Revenues" contextRef="c" unitRef="u" decimals="0">100</ix:nonFraction></html>`;
    const source = vi.fn<typeof fetch>((input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      return Promise.resolve(
        url.includes("/companyfacts/")
          ? Response.json(facts)
          : url.includes("/submissions/")
            ? Response.json(submissions)
            : new Response(document, {
                headers: { "content-type": "text/html" },
              }),
      );
    });
    const provider = createSecPersonalFilingContextProvider(
      "SyntheticResearch owner@example.test",
      {
        fetch: source,
        scheduler: { wait: () => Promise.resolve() },
        now: () => new Date("2026-09-10T12:00:00.000Z"),
      },
    );
    fixture.loadContext.mockImplementation((cik, selected, signal) =>
      provider.loadContext(cik, selected, signal),
    );
    try {
      const response = await fixture.request({
        ...fixture.body,
        selection: { ...selection(), id: retained.id },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        inspection: {
          status: "available",
          cik: "0000000001",
          observation: { id: retained.id, value: "100" },
          analysis: {
            status: "matched",
            candidates: [
              { factId: "revenue", value: "100", entityCik: "0000000001" },
            ],
          },
        },
      });
      expect(source).toHaveBeenCalledTimes(3);
      expect(response.payload).not.toContain("<html");
      expect(response.payload).not.toContain("owner@example.test");
    } finally {
      provider.close();
    }
  });

  it("derives issuer and CIK from the catalog and closes its provider", async () => {
    const fixture = await setup();
    const response = await fixture.request();
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    const body = response.json<PersonalSecFilingContextResponseDto>();
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
    expect(body.inspection.cik).toBe(body.security.cik);
    expect(fixture.loadContext).toHaveBeenCalledWith(
      "0000000001",
      fixture.body.selection,
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
    expect(fixture.loadContext).not.toHaveBeenCalled();
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
    expect(fixture.loadContext).not.toHaveBeenCalled();
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
      url: `${PERSONAL_SEC_FILING_CONTEXT_PATH}?cik=1`,
      headers: headers(fixture.cookie),
      payload: fixture.body,
      remoteAddress: "127.0.0.1",
    });
    expect(query.statusCode).toBe(403);
    expect(fixture.loadContext).not.toHaveBeenCalled();
  });

  it.each([
    { startDate: null },
    { form: "10-K" },
    { value: "100.0" },
    { startDate: "2026-02-30" },
    { startDate: "2026-04-01" },
    { metric: "net_income" },
    { id: "sec-fact:tampered" },
    { sourceUrl: "https://unreviewed.invalid/filing" },
    { filing: { status: "matched" } },
    { cik: "0000000002" },
  ])(
    "rejects an invalid or expanded selection %j before acquisition",
    async (changes) => {
      const fixture = await setup();
      const response = await fixture.request({
        ...fixture.body,
        selection: { ...fixture.body.selection, ...changes },
      });
      expect(response.statusCode).toBe(400);
      expect(fixture.loadContext).not.toHaveBeenCalled();
    },
  );

  it("rejects a provider substituting another selected amount", async () => {
    const fixture = await setup();
    fixture.loadContext.mockResolvedValueOnce({
      cik: "0000000001",
      status: "available",
      observation: { ...selection(), value: "999" },
    } as PersonalSecFilingContextInspectionDto);
    const response = await fixture.request();
    expect(response.statusCode).toBe(502);
    expect(response.payload).not.toContain("999");
  });

  it.each([
    ["not_configured", 503, "not_configured"],
    ["busy", 429, "rate_limited"],
    ["invalid_request", 400, "invalid_request"],
    ["aborted", 502, "provider_unavailable"],
  ] as const)("sanitizes %s", async (error, status, code) => {
    const fixture = await setup();
    fixture.loadContext.mockRejectedValueOnce(
      new PersonalSecFilingContextProviderError(error),
    );
    const response = await fixture.request();
    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ code });
  });

  it("rejects wrong-issuer responses and suppresses raw errors", async () => {
    const fixture = await setup();
    fixture.loadContext.mockResolvedValueOnce(evidence("0000000002"));
    expect((await fixture.request()).statusCode).toBe(502);
    fixture.loadContext.mockRejectedValueOnce(
      new Error("private-provider-canary"),
    );
    const response = await fixture.request();
    expect(response.statusCode).toBe(502);
    expect(response.payload).not.toContain("private-provider-canary");
  });

  it("does not send results after the owner session becomes invalid", async () => {
    const fixture = await setup();
    fixture.loadContext.mockImplementationOnce((cik) => {
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
    fixture.loadContext.mockImplementationOnce((cik, _selection, signal) => {
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
  const loadContext = vi.fn(
    (
      cik: string,
      _selection: PersonalSecFilingContextSelectionDto,
      _signal?: AbortSignal,
    ): Promise<PersonalSecFilingContextInspectionDto> => {
      void _signal;
      void _selection;
      return Promise.resolve(evidence(cik));
    },
  );
  const close = vi.fn();
  const provider: PersonalSecFilingContextProvider = {
    loadContext,
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
    provider,
  );
  applications.push(app);
  const body = {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: catalog.snapshotSha256,
    listingId: "lst-00000",
    symbol: "S00000",
    selection: selection(),
  };
  // Bootstrap is delayed until the first request so tests can install hooks.
  let cookie = "";
  return {
    app,
    authority,
    body,
    loadContext,
    close,
    get cookie() {
      return cookie;
    },
    request: async (payload: unknown = body, authenticated = true) => {
      if (cookie === "")
        cookie = await bootstrapTestPersonalOwnerSession(app, secret);
      return app.inject({
        method: "POST",
        url: PERSONAL_SEC_FILING_CONTEXT_PATH,
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

function evidence(cik: string): PersonalSecFilingContextInspectionDto {
  return {
    cik,
    status: "unavailable",
    stage: "company_facts",
    reason: "selection_changed_or_not_retained",
  };
}

function selection(): PersonalSecFilingContextSelectionDto {
  return {
    id: `sec-fact:${"a".repeat(64)}`,
    metric: "revenue",
    taxonomy: "us-gaap",
    concept: "Revenues",
    unit: "USD",
    value: "100",
    startDate: "2026-01-01",
    endDate: "2026-03-31",
    accessionNumber: "0000000001-26-000001",
    form: "10-Q",
    filedDate: "2026-05-01",
  };
}
