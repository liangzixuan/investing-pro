import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

import type {
  PersonalSecQuarterAssessmentDto,
  PersonalSecQuarterAssessmentRequestDto,
  PersonalSecQuarterAssessmentTargetDto,
  PersonalSecQuarterAssessmentResponseDto,
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
  PersonalSecQuarterAssessmentProviderError,
  type PersonalSecQuarterAssessmentProvider,
} from "./personal-sec-quarter-assessment-provider";
import { bootstrapTestPersonalOwnerSession } from "./test-personal-owner-session-builder";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { buildPersonalWorkspaceApp } from "./workspace-app";
import { PERSONAL_SEC_QUARTER_ASSESSMENT_PATH } from "./workspace-sec-quarter-assessment-routes";

const applications: FastifyInstance[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

describe("SEC quarter assessment route", () => {
  it("resolves the complete company identity from the catalog and closes the provider", async () => {
    const fixture = await setup();
    const response = await fixture.request();
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(fixture.assess).toHaveBeenCalledWith(
      {
        catalogSnapshotSha256: fixture.body.catalogSnapshotSha256,
        security:
          response.json<PersonalSecQuarterAssessmentResponseDto>().security,
      },
      fixture.body.selection,
      expect.any(AbortSignal),
    );
    expect(
      response.json<PersonalSecQuarterAssessmentResponseDto>().security,
    ).toMatchObject({
      cik: "0000000001",
      issuerId: "iss-00000",
      listingId: "lst-00000",
      symbol: "S00000",
    });
    await fixture.app.close();
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it.each(["cik", "sourceUrl", "value", "supported", "predicate"])(
    "rejects extra request %s before acquisition",
    async (field) => {
      const fixture = await setup();
      expect(
        (await fixture.request({ ...fixture.body, [field]: true })).statusCode,
      ).toBe(400);
      expect(fixture.assess).not.toHaveBeenCalled();
    },
  );

  it("rejects escaped duplicate keys before a provider call", async () => {
    const fixture = await setup();
    const text = JSON.stringify(fixture.body).replace(
      '"form":"10-Q"',
      '"form":"10-Q/A","fo\\u0072m":"10-Q"',
    );
    expect((await fixture.request(text)).statusCode).toBe(400);
    expect(fixture.assess).not.toHaveBeenCalled();
  });

  it("rejects invalid UTF-8 and dangerous object keys", async () => {
    const fixture = await setup();
    expect((await fixture.request(Buffer.from([0xc3, 0x28]))).statusCode).toBe(
      400,
    );
    expect(
      (await fixture.request('{"__proto__":{"polluted":true}}')).statusCode,
    ).toBe(400);
    expect(fixture.assess).not.toHaveBeenCalled();
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });

  it("keeps the strict JSON parser scoped to this route", async () => {
    const fixture = await setup();
    fixture.app.post("/test-json-parser", (request) =>
      Promise.resolve(request.body),
    );
    const result = await fixture.app.inject({
      method: "POST",
      url: "/test-json-parser",
      headers: { "content-type": "application/json" },
      payload: '{"x":1,"x":2}',
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ x: 2 });
  });

  it("requires an active owner session before parsing or acquiring", async () => {
    const fixture = await setup();
    const response = await fixture.request("{bad", false);
    expect([401, 403]).toContain(response.statusCode);
    expect(fixture.assess).not.toHaveBeenCalled();
  });

  it("rejects a foreign origin", async () => {
    const fixture = await setup();
    const response = await fixture.request(fixture.body, true, {
      origin: "https://example.invalid",
    });
    expect([401, 403]).toContain(response.statusCode);
    expect(fixture.assess).not.toHaveBeenCalled();
  });

  it("rejects a stale catalog before source requests", async () => {
    const fixture = await setup();
    expect(
      (
        await fixture.request({
          ...fixture.body,
          catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
        })
      ).statusCode,
    ).toBe(409);
    expect(fixture.assess).not.toHaveBeenCalled();
  });

  it("withholds a result after the owner session is revoked", async () => {
    const fixture = await setup();
    fixture.assess.mockImplementation((target) => {
      fixture.authority.close();
      return Promise.resolve(unavailable(target.security.cik, fixture.body));
    });
    const response = await fixture.request();
    expect([401, 403]).toContain(response.statusCode);
    expect(response.payload).not.toContain('"assessment"');
  });

  it("rejects mismatched provider identity instead of relabelling its result", async () => {
    const fixture = await setup();
    fixture.assess.mockResolvedValue(unavailable("0000000002", fixture.body));
    expect((await fixture.request()).statusCode).toBe(502);
  });

  it("detects synchronous deadline overrun before publishing a result", async () => {
    const fixture = await setup();
    const clock = vi.spyOn(performance, "now").mockReturnValue(10);
    fixture.assess.mockImplementation((target) => {
      clock.mockReturnValue(60_010);
      return Promise.resolve(unavailable(target.security.cik, fixture.body));
    });
    const response = await fixture.request();
    expect(response.statusCode).toBe(200);
    expect(
      response.json<PersonalSecQuarterAssessmentResponseDto>().assessment,
    ).toMatchObject({
      status: "unavailable",
      stage: "assembly",
      reason: "operation_deadline",
    });
  });

  it.each([
    ["busy", 429],
    ["not_configured", 503],
    ["invalid_request", 400],
  ] as const)("maps %s errors without source details", async (code, status) => {
    const fixture = await setup();
    fixture.assess.mockRejectedValue(
      new PersonalSecQuarterAssessmentProviderError(code),
    );
    const response = await fixture.request();
    expect(response.statusCode).toBe(status);
    expect(response.payload).not.toContain("User-Agent");
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
  const body: PersonalSecQuarterAssessmentRequestDto = {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: catalog.snapshotSha256,
    listingId: "lst-00000",
    symbol: "S00000",
    selection: {
      accessionNumber: "0000000001-26-000001",
      form: "10-Q",
      filedDate: "2026-05-01",
      reportDate: "2026-03-31",
    },
  };
  const assess = vi.fn<PersonalSecQuarterAssessmentProvider["assess"]>(
    (target: PersonalSecQuarterAssessmentTargetDto) =>
      Promise.resolve(unavailable(target.security.cik, body)),
  );
  const close = vi.fn();
  const provider: PersonalSecQuarterAssessmentProvider = {
    assess,
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
    undefined,
    undefined,
    undefined,
    provider,
  );
  applications.push(app);
  let cookie = "";
  return {
    app,
    authority,
    body,
    assess,
    close,
    request: async (
      payload: unknown = body,
      authenticated = true,
      extraHeaders: Record<string, string> = {},
    ) => {
      if (cookie === "")
        cookie = await bootstrapTestPersonalOwnerSession(app, secret);
      return app.inject({
        method: "POST",
        url: PERSONAL_SEC_QUARTER_ASSESSMENT_PATH,
        remoteAddress: "127.0.0.1",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          host: "127.0.0.1:3100",
          origin: "http://127.0.0.1:3000",
          ...(authenticated ? { cookie } : {}),
          ...extraHeaders,
        },
        payload: payload as Record<string, unknown> | string | Buffer,
      });
    },
  };
}

function unavailable(
  cik: string,
  body: PersonalSecQuarterAssessmentRequestDto,
): PersonalSecQuarterAssessmentDto {
  return {
    status: "unavailable",
    cik,
    selection: body.selection,
    stage: "submissions",
    reason: "upstream_unavailable",
    sources: [],
  };
}
