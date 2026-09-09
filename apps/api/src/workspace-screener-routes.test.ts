import { randomBytes } from "node:crypto";

import type {
  PersonalScreenerSavedViewsPayloadDto,
  PersonalSecurityMasterScreenRequestDto,
  PersonalSecurityMasterScreenResponseDto,
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
import { afterEach, describe, expect, it } from "vitest";

import { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import {
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
} from "./personal-owner-session-routes";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { bootstrapTestPersonalOwnerSession } from "./test-personal-owner-session-builder";
import { buildPersonalWorkspaceApp } from "./workspace-app";
import {
  PERSONAL_SCREENER_SAVED_VIEWS_RECORD_ID,
  PERSONAL_SECURITY_MASTER_SCREEN_PATH,
  PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
} from "./workspace-screener-routes";

const LISTEN_OPTIONS = { host: "127.0.0.1" as const, port: 3100 };
const applications: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map(async (app) => app.close()));
});

describe("personal workspace screener routes", () => {
  it("authenticates before parsing and returns a snapshot-bound deterministic page", async () => {
    const fixture = await readyApp();
    const unauthorized = await fixture.app.inject({
      headers: {
        ...ownerHeaders(),
        "content-type": "application/json",
      },
      method: "POST",
      payload: "{ private-screener-canary",
      remoteAddress: "127.0.0.1",
      url: PERSONAL_SECURITY_MASTER_SCREEN_PATH,
    });
    expect(unauthorized.statusCode).toBe(403);
    expect(unauthorized.payload).not.toContain("private-screener-canary");

    const response = await screen(
      fixture.app,
      fixture.cookie,
      screenRequest(fixture.snapshotSha256),
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.etag).toBeUndefined();
    const body = response.json<PersonalSecurityMasterScreenResponseDto>();
    expect(body).toMatchObject({
      hasMore: true,
      limitApplied: 1,
      offset: 0,
      rows: [{ listingId: "lst-00000", symbol: "S00000" }],
      schemaVersion: "1.0.0",
      snapshotSha256: fixture.snapshotSha256,
      totalMatches: 2,
      totalUniverse: 2,
    });
    expect(body.snapshot.snapshotSha256).toBe(fixture.snapshotSha256);
    expect(Object.keys(body).sort()).toEqual(
      [
        "hasMore",
        "limitApplied",
        "offset",
        "rows",
        "schemaVersion",
        "snapshot",
        "snapshotSha256",
        "totalMatches",
        "totalUniverse",
      ].sort(),
    );
  });

  it("rejects stale snapshots, extra keys, and malformed closed clauses", async () => {
    const fixture = await readyApp();
    const stale = await screen(fixture.app, fixture.cookie, {
      ...screenRequest(fixture.snapshotSha256),
      snapshotSha256: `sha256:${"f".repeat(64)}`,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).not.toHaveProperty("rows");

    const extra = await screen(fixture.app, fixture.cookie, {
      ...screenRequest(fixture.snapshotSha256),
      rawSql: "select private_screener_canary",
    });
    expect(extra.statusCode).toBe(400);
    expect(extra.payload).not.toContain("private_screener_canary");

    const malformed = screenRequest(fixture.snapshotSha256);
    const duplicateFields = await screen(fixture.app, fixture.cookie, {
      ...malformed,
      query: {
        clauses: [
          { field: "exchange_mic", operator: "in", values: ["XNAS"] },
          { field: "exchange_mic", operator: "in", values: ["XNYS"] },
        ],
        operator: "and",
      },
    });
    expect(duplicateFields.statusCode).toBe(400);

    for (const value of ["---", "😀", "\uFDFA".repeat(128)]) {
      const invalidAfterNormalization = await screen(
        fixture.app,
        fixture.cookie,
        {
          ...malformed,
          query: {
            clauses: [{ field: "identity_text", operator: "matches", value }],
            operator: "and",
          },
        },
      );
      expect(invalidAfterNormalization.statusCode).toBe(400);
    }
  });

  it("creates, reads, and updates only the bounded saved-view definition record", async () => {
    const fixture = await readyApp();
    const absent = await fixture.app.inject({
      headers: ownerHeaders(fixture.cookie),
      method: "GET",
      remoteAddress: "127.0.0.1",
      url: PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
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
      id: PERSONAL_SCREENER_SAVED_VIEWS_RECORD_ID,
      kind: "settings",
      operation: "put",
      version: 1,
    });

    const loaded = await fixture.app.inject({
      headers: ownerHeaders(fixture.cookie),
      method: "GET",
      remoteAddress: "127.0.0.1",
      url: PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.headers.etag).toBe('"v1"');
    expect(loaded.json()).toMatchObject({
      id: PERSONAL_SCREENER_SAVED_VIEWS_RECORD_ID,
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
      url: PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
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
      url: PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
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

async function readyApp() {
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
  );
  applications.push(app);
  const cookie = await bootstrapTestPersonalOwnerSession(app, secret);
  return { app, cookie, snapshotSha256: admission.expectedSha256, vault };
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
    url: PERSONAL_SECURITY_MASTER_SCREEN_PATH,
  });
}

function screenRequest(
  snapshotSha256: string,
): PersonalSecurityMasterScreenRequestDto {
  return {
    page: { limit: 1, offset: 0 },
    query: { clauses: [], operator: "and" },
    schemaVersion: "1.0.0",
    snapshotSha256: snapshotSha256 as `sha256:${string}`,
    sort: { direction: "asc", field: "symbol" },
  };
}

function savedViewsPayload(
  snapshotSha256: string,
): PersonalScreenerSavedViewsPayloadDto {
  return {
    schemaVersion: 1,
    views: [
      {
        columns: ["symbol", "issuer_name", "exchange_mic"],
        createdAgainstSnapshotSha256: snapshotSha256 as `sha256:${string}`,
        id: "nasdaq",
        name: "Nasdaq",
        query: {
          clauses: [
            { field: "exchange_mic", operator: "in", values: ["XNAS"] },
          ],
          operator: "and",
        },
        sort: { direction: "asc", field: "symbol" },
      },
    ],
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
    url: PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
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
      id !== PERSONAL_SCREENER_SAVED_VIEWS_RECORD_ID ||
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
      command.id !== PERSONAL_SCREENER_SAVED_VIEWS_RECORD_ID ||
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
