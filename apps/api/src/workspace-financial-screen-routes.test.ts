import { randomBytes } from "node:crypto";

import type {
  PersonalFinancialSavedViewsPayloadDto,
  PersonalFinancialScreenRequestDto,
  PersonalFinancialScreenResponseDto,
} from "@research-cockpit/contracts";
import {
  LOCAL_RESEARCH_VAULT_PROFILE,
  LocalResearchVaultError,
  type LocalResearchRecord,
  type LocalResearchVault,
  type PutLocalResearchRecordCommand,
} from "@research-cockpit/local-research-vault";
import { admitPersonalSecurityMasterSnapshot } from "@research-cockpit/personal-security-master";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import {
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
} from "./personal-owner-session-routes";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { bootstrapTestPersonalOwnerSession } from "./test-personal-owner-session-builder";
import { buildPersonalWorkspaceApp } from "./workspace-app";
import {
  PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
  PERSONAL_FINANCIAL_SCREEN_PATH,
  PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
} from "./workspace-financial-screen-routes";

const LISTEN_OPTIONS = { host: "127.0.0.1" as const, port: 3100 };
const applications: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map(async (app) => app.close()));
});

import {
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  type PersonalSecAnnualFinancialSnapshotDto,
} from "@research-cockpit/contracts";
import { PersonalSecFinancialProviderError } from "./personal-sec-financial-provider";

describe("personal annual financial screen routes", () => {
  it("authenticates before parsing and returns issuer financial metrics for both share-class listings", async () => {
    const f = await readyApp();
    const unauthorized = await f.app.inject({
      method: "POST",
      url: PERSONAL_FINANCIAL_SCREEN_PATH,
      headers: { ...ownerHeaders(), "content-type": "application/json" },
      payload: "{ private-financial-canary",
      remoteAddress: "127.0.0.1",
    });
    expect(unauthorized.statusCode).toBe(403);
    expect(unauthorized.payload).not.toContain("private-financial-canary");
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    const response = await screen(
      f.app,
      f.cookie,
      screenRequest(f.snapshotSha256),
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    const body = response.json<PersonalFinancialScreenResponseDto>();
    expect(body).toMatchObject({
      totalUniverse: 2,
      identityMatches: 2,
      totalMatches: 2,
      totalUnknown: 0,
      hasMore: true,
      rows: [
        {
          identity: { symbol: "S00000" },
          metrics: {
            revenue: { status: "available", value: "1000" },
            netMargin: { status: "available", value: "10.00" },
          },
        },
      ],
    });
    expect(f.vault.record).toBeUndefined();
  });
  it("rejects stale catalogs before fetching, malformed filters, and mixed snapshot pages", async () => {
    const f = await readyApp();
    const req = screenRequest(f.snapshotSha256);
    expect(
      (
        await screen(f.app, f.cookie, {
          ...req,
          catalogSnapshotSha256: "sha256:" + "f".repeat(64),
        })
      ).statusCode,
    ).toBe(409);
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    expect(
      (await screen(f.app, f.cookie, { ...req, page: { offset: 1, limit: 1 } }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await screen(f.app, f.cookie, {
          ...req,
          refresh: true,
          page: { offset: 1, limit: 1 },
        })
      ).statusCode,
    ).toBe(400);
    for (const criteria of [
      { ...req.criteria, calendarYear: new Date().getUTCFullYear() },
      {
        ...req.criteria,
        clauses: [{ field: "revenue", operator: "gte", value: "NaN" }],
      },
    ]) {
      expect(
        (await screen(f.app, f.cookie, { ...req, criteria })).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await screen(f.app, f.cookie, {
          ...req,
          financialSnapshotSha256: "sha256:" + "e".repeat(64),
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await screen(f.app, f.cookie, {
          ...req,
          financialSnapshotSha256: FINANCIAL_DIGEST,
          page: { offset: 1, limit: 1 },
        })
      ).json(),
    ).toMatchObject({
      offset: 1,
      hasMore: false,
      rows: [{ identity: { symbol: "S00001" } }],
    });
  });
  it("keeps unavailable sources unknown and forwards explicit refresh", async () => {
    const provider = testProvider();
    provider.loadSnapshot.mockResolvedValue({
      ...snapshot(),
      frames: snapshot().frames.map((frame) => ({
        ...frame,
        status: "upstream_unavailable" as const,
        facts: [],
      })),
    });
    const f = await readyApp(provider);
    const req = screenRequest(f.snapshotSha256);
    const response = await screen(f.app, f.cookie, {
      ...req,
      refresh: true,
      criteria: {
        ...req.criteria,
        clauses: [{ field: "revenue", operator: "gte", value: "0" }],
      },
    });
    expect(response.json()).toMatchObject({
      totalMatches: 0,
      totalUnknown: 2,
      rows: [],
      metricCoverage: { revenue: { known: 0, unknown: 2 } },
    });
    expect(provider.loadSnapshot).toHaveBeenCalledWith(
      2025,
      expect.any(AbortSignal),
      true,
    );
  });
  it("returns actionable missing configuration and bounded upstream errors without echoing details", async () => {
    const provider = testProvider();
    const f = await readyApp(provider);
    for (const [code, status] of [
      ["not_configured", 503],
      ["busy", 429],
      ["aborted", 502],
    ] as const) {
      provider.loadSnapshot.mockRejectedValueOnce(
        new PersonalSecFinancialProviderError(code),
      );
      expect(
        (await screen(f.app, f.cookie, screenRequest(f.snapshotSha256)))
          .statusCode,
      ).toBe(status);
    }
    provider.loadSnapshot.mockRejectedValueOnce(
      new Error("private-contact-canary"),
    );
    const failed = await screen(
      f.app,
      f.cookie,
      screenRequest(f.snapshotSha256),
    );
    expect(failed.statusCode).toBe(502);
    expect(failed.payload).not.toContain("private-contact-canary");
  });
  it("creates, reads, and updates only the bounded saved-view definition record", async () => {
    const fixture = await readyApp();
    const absent = await fixture.app.inject({
      headers: ownerHeaders(fixture.cookie),
      method: "GET",
      remoteAddress: "127.0.0.1",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    });
    expect(absent.statusCode).toBe(404);

    const payload = savedViewsPayload(fixture.snapshotSha256);
    const created = await putSavedViews(
      fixture.app,
      fixture.cookie,
      payload,
      0,
      "screener-saved-views-create",
    );
    expect(created.statusCode).toBe(201);
    expect(created.headers.etag).toBe('"v1"');
    expect(created.json()).toMatchObject({
      id: PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
      kind: "settings",
      operation: "put",
      version: 1,
    });

    const loaded = await fixture.app.inject({
      headers: ownerHeaders(fixture.cookie),
      method: "GET",
      remoteAddress: "127.0.0.1",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.headers.etag).toBe('"v1"');
    expect(loaded.json()).toMatchObject({
      id: PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
      kind: "settings",
      payload,
      version: 1,
    });
    expect(loaded.payload).not.toContain("rows");
    expect(loaded.payload).not.toContain("totalMatches");

    const updatedPayload = {
      ...payload,
      views: [{ ...payload.views[0], name: "Nasdaq catalog" }],
    } as const;
    const updated = await putSavedViews(
      fixture.app,
      fixture.cookie,
      updatedPayload,
      1,
      "screener-saved-views-update",
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.headers.etag).toBe('"v2"');
    expect(fixture.vault.record?.payload).toEqual(updatedPayload);

    const staleUpdate = await putSavedViews(
      fixture.app,
      fixture.cookie,
      payload,
      1,
      "screener-stale-saved-views-update",
    );
    expect(staleUpdate.statusCode).toBe(409);
    expect(fixture.vault.record?.payload).toEqual(updatedPayload);
  });

  it("requires exact mutation carriers and rejects unsafe saved definitions", async () => {
    const fixture = await readyApp();
    const payload = savedViewsPayload(fixture.snapshotSha256);
    const unauthorized = await fixture.app.inject({
      headers: {
        ...ownerHeaders(),
        "content-type": "application/json",
        "if-none-match": "*",
        [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]:
          "screener-unauthorized-create",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-create",
      },
      method: "POST",
      payload: { payload },
      remoteAddress: "127.0.0.1",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    });
    expect(unauthorized.statusCode).toBe(403);

    const noPrecondition = await fixture.app.inject({
      headers: {
        ...ownerHeaders(fixture.cookie),
        "content-type": "application/json",
        [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]:
          "screener-missing-precondition",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-create",
      },
      method: "POST",
      payload: { payload },
      remoteAddress: "127.0.0.1",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    });
    expect(noPrecondition.statusCode).toBe(400);

    const duplicateNames = await putSavedViews(
      fixture.app,
      fixture.cookie,
      {
        schemaVersion: 1,
        views: [
          payload.views[0],
          { ...payload.views[0], id: "nasdaq-two", name: "nasdaq" },
        ],
      },
      0,
      "screener-duplicate-names",
    );
    expect(duplicateNames.statusCode).toBe(400);

    const resultBearingDefinition = await putSavedViews(
      fixture.app,
      fixture.cookie,
      {
        schemaVersion: 1,
        views: [{ ...payload.views[0], rows: [{ symbol: "PRIVATE" }] }],
      },
      0,
      "screener-result-bearing-view",
    );
    expect(resultBearingDefinition.statusCode).toBe(400);
    expect(resultBearingDefinition.payload).not.toContain("PRIVATE");

    const missingRequiredSymbol = await putSavedViews(
      fixture.app,
      fixture.cookie,
      {
        schemaVersion: 1,
        views: [
          {
            ...payload.views[0],
            columns: ["issuer_name", "exchange_mic"],
          },
        ],
      },
      0,
      "screener-missing-symbol-column",
    );
    expect(missingRequiredSymbol.statusCode).toBe(400);

    for (const id of ["ab", "Nasdaq"]) {
      const noncanonicalId = await putSavedViews(
        fixture.app,
        fixture.cookie,
        {
          schemaVersion: 1,
          views: [{ ...payload.views[0], id }],
        },
        0,
        `screener-noncanonical-id-${id.toLowerCase()}`,
      );
      expect(noncanonicalId.statusCode).toBe(400);
    }

    const invalidNormalizedQueries = [
      { id: "punctuation", value: "---" },
      { id: "emoji", value: "😀" },
      { id: "nfkd-expansion", value: "\uFDFA".repeat(128) },
    ];
    for (const { id, value } of invalidNormalizedQueries) {
      const invalidNormalizedSavedQuery = await putSavedViews(
        fixture.app,
        fixture.cookie,
        {
          schemaVersion: 1,
          views: [
            {
              ...payload.views[0],
              query: {
                clauses: [
                  { field: "identity_text", operator: "matches", value },
                ],
                operator: "and",
              },
            },
          ],
        },
        0,
        `screener-invalid-normalized-query-${id}`,
      );
      expect(invalidNormalizedSavedQuery.statusCode).toBe(400);
    }
  });

  it("exposes no saved-view collection through the generic workspace route", async () => {
    const fixture = await readyApp();
    const generic = await fixture.app.inject({
      headers: ownerHeaders(fixture.cookie),
      method: "GET",
      remoteAddress: "127.0.0.1",
      url: "/v1/personal-filing/workspace/screener/saved-views/another",
    });
    expect(generic.statusCode).toBe(404);
  });
});
async function readyApp(provider = testProvider()) {
  const admission = buildTestSecurityMasterAdmission();
  const catalog = admitPersonalSecurityMasterSnapshot({
    expectedSha256: admission.expectedSha256,
    snapshot: admission.snapshot,
  });
  const secret = randomBytes(32).toString("hex");
  const authority = PersonalOwnerSessionAuthority.create(secret);
  const vault = new TestVault();
  const app = await buildPersonalWorkspaceApp(
    catalog,
    vault as unknown as LocalResearchVault,
    authority,
    LISTEN_OPTIONS,
    undefined,
    provider,
  );
  applications.push(app);
  const cookie = await bootstrapTestPersonalOwnerSession(app, secret);
  return {
    app,
    cookie,
    snapshotSha256: admission.expectedSha256,
    vault,
    provider,
  };
}

async function screen(app: FastifyInstance, cookie: string, payload: unknown) {
  return await app.inject({
    headers: {
      ...ownerHeaders(cookie),
      "content-type": "application/json",
    },
    method: "POST",
    payload: payload as Record<string, unknown>,
    remoteAddress: "127.0.0.1",
    url: PERSONAL_FINANCIAL_SCREEN_PATH,
  });
}

const FINANCIAL_DIGEST = ("sha256:" + "c".repeat(64)) as `sha256:${string}`;
function screenRequest(
  catalogSnapshotSha256: string,
): PersonalFinancialScreenRequestDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: catalogSnapshotSha256 as `sha256:${string}`,
    financialSnapshotSha256: null,
    criteria: {
      calendarYear: 2025,
      identityText: "",
      clauses: [],
      sort: { field: "symbol", direction: "asc" },
    },
    page: { offset: 0, limit: 1 },
    refresh: false,
  };
}
function savedViewsPayload(
  catalogSnapshotSha256: string,
): PersonalFinancialSavedViewsPayloadDto {
  return {
    schemaVersion: 1,
    views: [
      {
        id: "nasdaq",
        name: "Nasdaq",
        criteria: screenRequest(catalogSnapshotSha256).criteria,
        createdAgainstCatalogSnapshotSha256:
          catalogSnapshotSha256 as `sha256:${string}`,
        createdAgainstFinancialSnapshotSha256: FINANCIAL_DIGEST,
      },
    ],
  };
}
function snapshot(): PersonalSecAnnualFinancialSnapshotDto {
  return {
    calendarYear: 2025,
    fetchedAt: "2026-09-09T00:00:00.000Z",
    expiresAt: "2026-09-09T00:30:00.000Z",
    snapshotSha256: FINANCIAL_DIGEST,
    frames: PERSONAL_SEC_ANNUAL_CONCEPTS.map((concept, index) => ({
      concept,
      status: "available",
      sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2025.json`,
      facts:
        index < 3 && index !== 0
          ? []
          : [
              {
                cik: "0000000001",
                accessionNumber: "0000000001-26-000001",
                startDate: "2025-01-01",
                endDate: "2025-12-31",
                value: index === 0 ? "1000" : "100",
              },
            ],
      unknownCiks: [],
    })),
  };
}
function testProvider() {
  return {
    status: () => ({ configured: true }),
    close: vi.fn(),
    loadSnapshot: vi.fn(() => Promise.resolve(snapshot())),
  };
}

function putSavedViews(
  app: FastifyInstance,
  cookie: string,
  payload: unknown,
  currentVersion: number,
  idempotencyKey: string,
) {
  const creating = currentVersion === 0;
  return app.inject({
    headers: {
      ...ownerHeaders(cookie),
      "content-type": "application/json",
      ...(creating
        ? { "if-none-match": "*" }
        : { "if-match": `"v${String(currentVersion)}"` }),
      [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]: idempotencyKey,
      [PERSONAL_OWNER_INTENT_HEADER_NAME]: creating
        ? "personal-vault-create"
        : "personal-vault-update",
    },
    method: "POST",
    payload: { payload },
    remoteAddress: "127.0.0.1",
    url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
  });
}

function ownerHeaders(cookie?: string): Record<string, string> {
  return {
    accept: "application/json",
    ...(cookie === undefined ? {} : { cookie }),
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
  };
}

class TestVault {
  readonly profile = LOCAL_RESEARCH_VAULT_PROFILE;
  record: LocalResearchRecord | undefined;

  close(): void {}

  getRecord(kind: "settings", id: string): LocalResearchRecord {
    if (
      kind !== "settings" ||
      id !== PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID ||
      this.record === undefined
    ) {
      throw new LocalResearchVaultError("VAULT_NOT_FOUND");
    }
    return this.record;
  }

  putRecord(command: PutLocalResearchRecordCommand) {
    const currentVersion = this.record?.version ?? 0;
    if (
      command.kind !== "settings" ||
      command.id !== PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID ||
      command.expectedVersion !== currentVersion
    ) {
      throw new LocalResearchVaultError("VAULT_CONFLICT");
    }
    const version = currentVersion + 1;
    this.record = {
      createdAt: this.record?.createdAt ?? "2026-09-09T00:00:00.000Z",
      id: command.id,
      kind: command.kind,
      payload: command.payload,
      payloadSha256: "a".repeat(64),
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
      updatedAt: "2026-09-09T00:00:00.000Z",
      version,
    };
    return {
      committedAt: "2026-09-09T00:00:00.000Z",
      digestSha256: "a".repeat(64),
      id: command.id,
      kind: command.kind,
      operation: "put" as const,
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
      replayed: false,
      version,
    };
  }
}
