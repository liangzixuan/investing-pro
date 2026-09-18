import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PERSONAL_FINANCIAL_COMPARISON_IDENTITY_FIELDS,
  type PersonalFinancialComparisonSelectionPayloadDto,
  type PersonalFinancialComparisonSelectionResolvedDto,
} from "@research-cockpit/contracts";
import {
  LocalResearchVault,
  WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
  type WindowsOwnerOnlyAclPort,
  type WindowsOwnerOnlyAclTarget,
  type WindowsOwnerOnlyAclVerificationReceipt,
} from "@research-cockpit/local-research-vault";
import {
  admitPersonalSecurityMasterSnapshot,
  screenPersonalSecurityMaster,
} from "@research-cockpit/personal-security-master";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPersonalWorkspaceApp } from "./workspace-app";
import {
  createTestPersonalOwnerSession,
  bootstrapTestPersonalOwnerSession,
} from "./test-personal-owner-session-builder";
import {
  buildMutableTestSecurityMasterDocument,
  bindTestSecurityMasterDocument,
} from "./test-personal-security-master-builder";
import {
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
} from "./personal-owner-session-routes";
import {
  PERSONAL_FINANCIAL_SAVED_COMPARISON_PATH as PATH,
  PERSONAL_FINANCIAL_SAVED_COMPARISON_RESOLVE_PATH as RESOLVE_PATH,
  PERSONAL_FINANCIAL_SAVED_COMPARISON_RECORD_ID as RECORD_ID,
  PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
} from "./workspace-financial-screen-routes";

const apps: FastifyInstance[] = [],
  vaults: LocalResearchVault[] = [],
  directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
  for (const vault of vaults.splice(0)) vault.close();
  await Promise.all(
    directories
      .splice(0)
      .map(async (directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
  );
});

describe("saved financial comparison selection routes", () => {
  it("persists ordered identities across encrypted vault reopen without touching views/watchlist or loading providers", async () => {
    const f = await ready();
    expect((await get(f)).statusCode).toBe(404);
    const watchlist = f.vault.getRecord("watchlist", "main");
    f.vault.putRecord({
      kind: "settings",
      id: PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
      expectedVersion: 0,
      idempotencyKey: "saved-comparison-unrelated-views",
      payload: { schemaVersion: 1, views: [] },
    });
    const views = f.vault.getRecord(
      "settings",
      PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
    );
    const result = await put(f, f.payload, 0);
    expect(result.statusCode).toBe(201);
    expect(result.headers.etag).toBe('"v1"');
    expect(result.json()).toMatchObject({
      id: RECORD_ID,
      kind: "settings",
      version: 1,
      operation: "put",
      replayed: false,
    });
    expect((await get(f)).json()).toMatchObject({
      version: 1,
      payload: f.payload,
    });
    await f.app.close();
    const reopened = await ready(f.root);
    expect((await get(reopened)).json()).toMatchObject({
      version: 1,
      payload: f.payload,
    });
    const resolved = await resolve(reopened);
    expect(resolved.statusCode).toBe(200);
    expect(
      resolved.json<PersonalFinancialComparisonSelectionResolvedDto>(),
    ).toEqual({
      schemaVersion: "1.0.0",
      ...reopened.context,
      savedSelectionVersion: 1,
      members: f.payload.selection!.members,
    });
    expect(reopened.vault.getRecord("watchlist", "main")).toEqual(watchlist);
    expect(
      reopened.vault.getRecord(
        "settings",
        PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
      ),
    ).toEqual(views);
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    expect(reopened.provider.loadSnapshot).not.toHaveBeenCalled();
    expect(
      JSON.stringify(reopened.vault.getRecord("settings", RECORD_ID).payload),
    ).not.toContain("private-watchlist-note");
  });

  it("replaces two with three, clears with unavailable members, and saves again at the retained version", async () => {
    const f = await ready();
    await put(f, f.payload, 0);
    const three = {
      ...f.payload,
      selection: {
        ...f.payload.selection!,
        members: [...f.payload.selection!.members, f.rows[4]!],
      },
    };
    expect((await put(f, three, 1)).statusCode).toBe(200);
    expect((await resolve(f, 2)).json()).toMatchObject({
      members: three.selection.members,
    });
    f.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 1,
      idempotencyKey: "saved-comparison-empty-watchlist",
      payload: { ...f.watchlist, memberships: [] },
    });
    expect((await resolve(f, 2)).statusCode).toBe(409);
    expect((await get(f)).json()).toMatchObject({ payload: three });
    expect(
      (await put(f, { schemaVersion: 1, selection: null }, 2, null)).statusCode,
    ).toBe(200);
    expect((await resolve(f, 3)).statusCode).toBe(404);
    f.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 2,
      idempotencyKey: "saved-comparison-restore-watchlist",
      payload: f.watchlist,
    });
    expect(
      (await put(f, f.payload, 3, { ...f.context, watchlistVersion: 3 }))
        .statusCode,
    ).toBe(200);
    expect((await get(f)).json()).toMatchObject({
      version: 4,
      payload: f.payload,
    });
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
  });

  it("permits unchanged identities after unrelated watchlist edits and catalog reconciliation without rewriting provenance", async () => {
    const f = await ready();
    await put(f, f.payload, 0);
    const saved = f.vault.getRecord("settings", RECORD_ID);
    await f.app.close();
    const refreshed = await ready(f.root, true);
    expect(refreshed.context.catalogSnapshotSha256).not.toBe(
      f.context.catalogSnapshotSha256,
    );
    expect((await resolve(refreshed)).statusCode).toBe(409);
    const updated = {
      ...refreshed.watchlist,
      memberships: refreshed.watchlist.memberships.map((member) => ({
        ...member,
        note: "changed unrelated note",
      })),
    };
    refreshed.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 1,
      idempotencyKey: "saved-comparison-reconciled-watchlist",
      payload: updated,
    });
    const result = await resolve(refreshed, 1, {
      ...refreshed.context,
      watchlistVersion: 2,
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({
      members: f.payload.selection!.members,
      watchlistVersion: 2,
    });
    expect(refreshed.vault.getRecord("settings", RECORD_ID)).toEqual(saved);
    expect(refreshed.provider.loadSnapshot).not.toHaveBeenCalled();
  });

  it("uses optimistic record versions and idempotent receipts without overwriting newer definitions", async () => {
    const f = await ready();
    const key = "saved-comparison-idempotent-create";
    expect((await put(f, f.payload, 0, f.context, key)).statusCode).toBe(201);
    expect((await put(f, f.payload, 0, f.context, key)).json()).toMatchObject({
      replayed: true,
      version: 1,
    });
    const reversed = {
      ...f.payload,
      selection: {
        ...f.payload.selection!,
        members: [...f.payload.selection!.members].reverse(),
      },
    };
    expect((await put(f, reversed, 0, f.context, key)).statusCode).toBe(409);
    expect((await put(f, reversed, 0)).statusCode).toBe(409);
    expect((await put(f, reversed, 1)).statusCode).toBe(200);
    expect((await resolve(f, 1)).statusCode).toBe(409);
    expect((await resolve(f, 2)).json()).toMatchObject({
      members: reversed.selection.members,
    });
  });

  it("rejects every changed full-identity field and wrong current bindings before a settings write", async () => {
    const f = await ready();
    const putRecord = vi.spyOn(f.vault, "putRecord");
    for (const field of PERSONAL_FINANCIAL_COMPARISON_IDENTITY_FIELDS) {
      const member = f.payload.selection!.members[0]!;
      const changes = {
        cik: "0000000999",
        country: "CA",
        exchangeMic: "XNYS",
        instrumentType:
          member.instrumentType === "adr" ? "common_stock" : "adr",
        symbol: "OTHER",
      };
      const value =
        changes[field as keyof typeof changes] ?? `${member[field]}-different`;
      const payload = {
        ...f.payload,
        selection: {
          ...f.payload.selection!,
          members: [
            { ...member, [field]: value },
            f.payload.selection!.members[1]!,
          ],
        },
      };
      expect([400, 409]).toContain((await put(f, payload, 0)).statusCode);
    }
    expect(
      (await put(f, f.payload, 0, { ...f.context, watchlistVersion: 2 }))
        .statusCode,
    ).toBe(409);
    const otherDigest = `sha256:${"e".repeat(64)}`;
    const wrong = {
      ...f.payload,
      selection: {
        ...f.payload.selection!,
        createdAgainstCatalogSnapshotSha256: otherDigest,
      },
    };
    expect(
      (
        await put(f, wrong, 0, {
          ...f.context,
          catalogSnapshotSha256: otherDigest,
        })
      ).statusCode,
    ).toBe(409);
    expect(putRecord).not.toHaveBeenCalled();
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
  });

  it("rejects subsets and same-symbol replacements while preserving the unresolvable saved definition", async () => {
    const f = await ready();
    await put(f, f.payload, 0);
    const saved = f.vault.getRecord("settings", RECORD_ID);
    const first = f.payload.selection!.members[0]!;
    const missing = {
      ...f.watchlist,
      memberships: f.watchlist.memberships.filter(
        (member) => member.listingId !== first.listingId,
      ),
    };
    f.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 1,
      idempotencyKey: "saved-comparison-remove-member",
      payload: missing,
    });
    expect(
      (await resolve(f, 1, { ...f.context, watchlistVersion: 2 })).statusCode,
    ).toBe(409);
    const replacement = {
      ...f.watchlist,
      memberships: f.watchlist.memberships.map((member) =>
        member.listingId === first.listingId
          ? { ...member, securityId: "same-symbol-substitution" }
          : member,
      ),
    };
    f.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 2,
      idempotencyKey: "saved-comparison-substitute-member",
      payload: replacement,
    });
    expect(
      (await resolve(f, 1, { ...f.context, watchlistVersion: 3 })).statusCode,
    ).toBe(409);
    expect((await get(f)).json()).toEqual(saved);
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
  });

  it.each(["settings", "watchlist"] as const)(
    "rejects a %s version changed during read-only resolution",
    async (kind) => {
      const f = await ready();
      await put(f, f.payload, 0);
      const original = f.vault.getRecord.bind(f.vault);
      let relevantReads = 0;
      vi.spyOn(f.vault, "getRecord").mockImplementation((requestedKind, id) => {
        const record = original(requestedKind, id);
        if (requestedKind === kind && ++relevantReads === 2)
          return { ...record, version: record.version + 1 };
        return record;
      });
      const putRecord = vi.spyOn(f.vault, "putRecord");
      expect((await resolve(f)).statusCode).toBe(409);
      expect(putRecord).not.toHaveBeenCalled();
      expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    },
  );

  it("requires exact payloads, nonnull save context and null clear context", async () => {
    const f = await ready();
    for (const body of [
      { payload: f.payload, context: null },
      { payload: { schemaVersion: 1, selection: null }, context: f.context },
      { payload: f.payload, context: f.context, prices: [] },
      {
        payload: {
          ...f.payload,
          selection: {
            ...f.payload.selection!,
            members: [f.rows[0]!, f.rows[1]!],
          },
        },
        context: f.context,
      },
      {
        payload: {
          ...f.payload,
          selection: { ...f.payload.selection!, members: [f.rows[0]!] },
        },
        context: f.context,
      },
    ])
      expect(
        (await request(f, "POST", PATH, body, mutationHeaders(0))).statusCode,
      ).toBe(400);
    expect(
      (
        await request(f, "POST", RESOLVE_PATH, {
          ...f.context,
          expectedVersion: 0,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request(f, "POST", RESOLVE_PATH, {
          ...f.context,
          expectedVersion: 1,
          prices: [],
        })
      ).statusCode,
    ).toBe(400);
    expect((await get(f)).statusCode).toBe(404);
  });

  it("rejects unauthenticated/foreign routes and invalid write preconditions before vault access", async () => {
    const f = await ready();
    const read = vi.spyOn(f.vault, "getRecord"),
      write = vi.spyOn(f.vault, "putRecord");
    for (const [method, path, payload] of [
      ["GET", PATH, undefined],
      ["POST", PATH, { payload: f.payload, context: f.context }],
      ["POST", RESOLVE_PATH, { ...f.context, expectedVersion: 1 }],
    ] as const) {
      for (const extra of [
        { cookie: "" },
        { origin: "http://foreign.invalid" },
      ]) {
        const result = await request(f, method, path, payload, {
          ...(method === "POST" && path === PATH ? mutationHeaders(0) : {}),
          ...extra,
        });
        expect([401, 403]).toContain(result.statusCode);
      }
    }
    for (const extra of [
      { "if-none-match": "", "if-match": '"v1"' },
      { "if-match": 'W/"v1"' },
      { [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]: "short" },
    ]) {
      const result = await request(
        f,
        "POST",
        PATH,
        { payload: f.payload, context: f.context },
        { ...mutationHeaders(0), ...extra },
      );
      expect(result.statusCode).toBe(400);
    }
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
  });

  it("keeps malformed stored definitions clearable and sanitizes unexpected storage failures", async () => {
    const f = await ready();
    f.vault.putRecord({
      kind: "settings",
      id: RECORD_ID,
      expectedVersion: 0,
      idempotencyKey: "saved-comparison-malformed-stored",
      payload: {
        schemaVersion: 1,
        selection: { prices: "private-value-canary" },
      },
    });
    const invalid = await get(f);
    expect(invalid.statusCode).toBe(409);
    expect(invalid.payload).not.toContain("private-value-canary");
    expect((await resolve(f)).statusCode).toBe(409);
    expect(
      (await put(f, { schemaVersion: 1, selection: null }, 1, null)).statusCode,
    ).toBe(200);
    vi.spyOn(f.vault, "getRecord").mockImplementationOnce(() => {
      throw new Error("private-storage-canary");
    });
    const failed = await get(f);
    expect(failed.statusCode).toBe(500);
    expect(failed.payload).not.toContain("private-storage-canary");
  });
});

async function ready(existingRoot?: string, refreshed = false) {
  const parent =
    existingRoot === undefined
      ? await mkdtemp(join(await realpath(tmpdir()), "saved-comparison-test-"))
      : undefined;
  if (parent !== undefined) directories.push(parent);
  const root = existingRoot ?? join(parent!, "vault");
  const options = {
    startupRootPath: root,
    permissionPlatform: "win32" as const,
    windowsAcl: receiptAcl(),
  };
  const vault =
    existingRoot === undefined
      ? await LocalResearchVault.initialize(options)
      : await LocalResearchVault.open(options);
  vaults.push(vault);
  const document = buildMutableTestSecurityMasterDocument(6);
  if (refreshed) document.generatedAt = "2026-09-01T17:31:00.000Z";
  const catalog = admitPersonalSecurityMasterSnapshot(
    bindTestSecurityMasterDocument(document),
  );
  const rows = screenPersonalSecurityMaster(catalog, {
    schemaVersion: "1.0.0",
    snapshotSha256: catalog.snapshotSha256,
    query: { operator: "and", clauses: [] },
    sort: { field: "symbol", direction: "asc" },
    page: { offset: 0, limit: 25 },
  }).rows;
  const watchlist = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: catalog.snapshotSha256,
    memberships: rows.map((identity) => ({
      country: identity.country,
      exchangeMic: identity.exchangeMic,
      instrumentType: identity.instrumentType,
      issuerId: identity.issuerId,
      issuerName: identity.issuerName,
      listingId: identity.listingId,
      securityId: identity.securityId,
      securityName: identity.securityName,
      shareClassId: identity.shareClassId,
      shareClassName: identity.shareClassName,
      symbol: identity.symbol,
      note: "private-watchlist-note",
    })),
  };
  if (existingRoot === undefined)
    vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 0,
      idempotencyKey: "saved-comparison-seed-watchlist",
      payload: watchlist,
    });
  const provider = {
    status: () => ({ configured: true }),
    close: vi.fn(),
    loadSnapshot: vi.fn(() => {
      throw new Error("Provider must not be called");
    }),
  };
  const owner = createTestPersonalOwnerSession();
  const app = await buildPersonalWorkspaceApp(
    catalog,
    vault,
    owner.authority,
    undefined,
    undefined,
    provider,
  );
  apps.push(app);
  const cookie = await bootstrapTestPersonalOwnerSession(app, owner.secret);
  const payload: PersonalFinancialComparisonSelectionPayloadDto = {
    schemaVersion: 1,
    selection: {
      createdAgainstCatalogSnapshotSha256: catalog.snapshotSha256,
      members: [rows[2]!, rows[0]!],
    },
  };
  return {
    app,
    vault,
    root,
    cookie,
    payload,
    rows,
    provider,
    watchlist,
    context: {
      catalogSnapshotSha256: catalog.snapshotSha256,
      watchlistVersion: 1,
    },
  };
}
type Fixture = Awaited<ReturnType<typeof ready>>;
let keySequence = 0;
function mutationHeaders(
  version: number,
  key = `saved-comparison-test-key-${String(++keySequence)}`,
) {
  return {
    ...(version === 0
      ? { "if-none-match": "*" }
      : { "if-match": `"v${String(version)}"` }),
    [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]: key,
    [PERSONAL_OWNER_INTENT_HEADER_NAME]:
      version === 0 ? "personal-vault-create" : "personal-vault-update",
  };
}
function request(
  f: Fixture,
  method: "GET" | "POST",
  url: string,
  payload?: unknown,
  extra = {},
) {
  return f.app.inject({
    method,
    url,
    remoteAddress: "127.0.0.1",
    headers: {
      accept: "application/json",
      cookie: f.cookie,
      host: "127.0.0.1:3100",
      origin: "http://127.0.0.1:3000",
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
      ...extra,
    },
    ...(payload === undefined
      ? {}
      : { payload: payload as Record<string, unknown> }),
  });
}
function get(f: Fixture) {
  return request(f, "GET", PATH);
}
function put(
  f: Fixture,
  payload: unknown,
  version: number,
  context: unknown = f.context,
  key?: string,
) {
  return request(
    f,
    "POST",
    PATH,
    { payload, context },
    mutationHeaders(version, key),
  );
}
function resolve(f: Fixture, expectedVersion = 1, context = f.context) {
  return request(f, "POST", RESOLVE_PATH, { ...context, expectedVersion });
}
function receiptAcl(): WindowsOwnerOnlyAclPort {
  const receipt = (
    target: WindowsOwnerOnlyAclTarget,
  ): WindowsOwnerOnlyAclVerificationReceipt => ({
    profile: WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
    canonicalRootPath: target.canonicalRootPath,
    verifiedPaths: target.targetPaths,
    ownerIdentity: "synthetic-owner",
    inheritanceProtected: true,
    ownerOnly: true,
  });
  return {
    provisionAndVerifyOwnerOnly: (target) => Promise.resolve(receipt(target)),
    verifyOwnerOnly: (target) => Promise.resolve(receipt(target)),
  };
}
