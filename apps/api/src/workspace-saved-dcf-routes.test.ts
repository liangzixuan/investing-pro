import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  normalizePersonalSavedDcfAssumptions,
  PERSONAL_SAVED_DCF_IDENTITY_FIELDS,
  type PersonalSavedDcfEntryDto,
  type PersonalSavedDcfIdentityDto,
  type PersonalSavedDcfPayloadDto,
  type PersonalSavedDcfResolvedDto,
} from "@research-cockpit/contracts";
import {
  LocalResearchVault,
  WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
  type JsonValue,
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
  PERSONAL_SAVED_DCF_PATH as PATH,
  PERSONAL_SAVED_DCF_RESOLVE_PATH as RESOLVE_PATH,
  PERSONAL_SAVED_DCF_RECORD_ID as RECORD_ID,
} from "./workspace-saved-dcf-routes";

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

describe("saved company DCF assumption routes", () => {
  it("persists only owner assumptions across encrypted reopen and resolves without source data or unrelated writes", async () => {
    const f = await ready();
    expect((await get(f)).statusCode).toBe(404);
    const watchlist = f.vault.getRecord("watchlist", "main");
    f.vault.putRecord({
      kind: "settings",
      id: "unrelated-dcf-test-record",
      expectedVersion: 0,
      idempotencyKey: "saved-dcf-unrelated-settings",
      payload: { criteria: "retained" },
    });
    const unrelated = f.vault.getRecord(
      "settings",
      "unrelated-dcf-test-record",
    );
    const p = payload([entry(f, 2)]);
    const saved = await save(f, p, 0, f.context, key());
    expect(saved.statusCode).toBe(201);
    expect(saved.headers.etag).toBe('"v1"');
    expect(saved.json()).toMatchObject({
      kind: "settings",
      id: RECORD_ID,
      operation: "put",
      version: 1,
      replayed: false,
    });
    expect(f.vault.getRecord("watchlist", "main")).toEqual(watchlist);
    expect(f.vault.getRecord("settings", "unrelated-dcf-test-record")).toEqual(
      unrelated,
    );
    const listed = await get(f);
    expect(listed.headers.etag).toBe('"v1"');
    expect(listed.json()).toMatchObject({
      kind: "settings",
      id: RECORD_ID,
      version: 1,
      payload: p,
    });
    expect(listed.payload).not.toContain("private-watchlist-note");
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    await closeFixture(f);
    const reopened = await ready(f.root);
    const response = await resolveEntry(reopened, p.entries[0]!.identity);
    expect(response.statusCode).toBe(200);
    expect(response.json<PersonalSavedDcfResolvedDto>()).toEqual({
      schemaVersion: "1.0.0",
      ...reopened.context,
      savedAssumptionsVersion: 1,
      entry: p.entries[0],
    });
    expect(reopened.vault.getRecord("watchlist", "main")).toEqual(watchlist);
    expect(
      reopened.vault.getRecord("settings", "unrelated-dcf-test-record"),
    ).toEqual(unrelated);
    expect(reopened.provider.loadSnapshot).not.toHaveBeenCalled();
  });

  it("preserves entry order and other companies on replace/clear, retaining an empty version for subsequent saves", async () => {
    const f = await ready();
    const a = entry(f, 1),
      b = entry(f, 2);
    expect((await save(f, payload([a]), 0)).statusCode).toBe(201);
    expect(
      (
        await save(
          f,
          payload([a, b]),
          1,
          f.context,
          key(),
          b.identity.listingId,
        )
      ).statusCode,
    ).toBe(200);
    const changed = {
      ...a,
      assumptions: { ...a.assumptions, waccPercent: "12.0000" },
    };
    expect((await save(f, payload([changed, b]), 2)).statusCode).toBe(200);
    expect(
      (await get(f)).json<{ payload: PersonalSavedDcfPayloadDto }>().payload
        .entries,
    ).toEqual([changed, b]);
    const clearKey = key();
    expect(
      (await clear(f, a.identity.listingId, payload([b]), 3, clearKey))
        .statusCode,
    ).toBe(200);
    expect(
      (await clear(f, a.identity.listingId, payload([b]), 3, clearKey)).json(),
    ).toMatchObject({ replayed: true, version: 4 });
    expect(
      (await clear(f, b.identity.listingId, payload([]), 4)).statusCode,
    ).toBe(200);
    expect((await get(f)).json()).toMatchObject({
      version: 5,
      payload: payload([]),
    });
    expect((await save(f, payload([a]), 5)).statusCode).toBe(200);
    expect((await get(f)).json()).toMatchObject({
      version: 6,
      payload: payload([a]),
    });
  });

  it("rejects unauthorized multi-entry edits, reordering, implicit deletions and nonexistent clears", async () => {
    const f = await ready();
    const a = entry(f, 1),
      b = entry(f, 2),
      c = entry(f, 3);
    expect((await save(f, payload([a, b]), 0)).statusCode).toBe(400);
    seed(f, payload([a, b]));
    const original = f.vault.getRecord("settings", RECORD_ID);
    const write = vi.spyOn(f.vault, "putRecord");
    for (const p of [
      payload([a]),
      payload([b, a]),
      payload([
        a,
        { ...b, assumptions: { ...b.assumptions, waccPercent: "11.0000" } },
      ]),
      payload([a, b, c]),
    ])
      expect((await save(f, p, 1)).statusCode).toBe(400);
    expect(
      (await clear(f, a.identity.listingId, payload([]), 1)).statusCode,
    ).toBe(400);
    expect(
      (await clear(f, c.identity.listingId, payload([a, b]), 1)).statusCode,
    ).toBe(404);
    expect(write).not.toHaveBeenCalled();
    expect(f.vault.getRecord("settings", RECORD_ID)).toEqual(original);
  });

  it("rejects clear with create preconditions, and does not create a missing collection", async () => {
    const f = await ready();
    const write = vi.spyOn(f.vault, "putRecord");
    expect(
      (await clear(f, f.identities[0]!.listingId, payload([]), 0)).statusCode,
    ).toBe(400);
    expect(
      (await clear(f, f.identities[0]!.listingId, payload([]), 1)).statusCode,
    ).toBe(404);
    expect((await get(f)).statusCode).toBe(404);
    expect(write).not.toHaveBeenCalled();
  });

  it("keeps stable payload replay hashing across later edits and refuses stale/conflicting writes", async () => {
    const f = await ready();
    const a = entry(f, 1),
      b = entry(f, 2),
      first = payload([a]),
      createKey = key();
    expect((await save(f, first, 0, f.context, createKey)).statusCode).toBe(
      201,
    );
    expect(
      (await save(f, first, 0, f.context, createKey)).json(),
    ).toMatchObject({ replayed: true, version: 1 });
    expect(
      (
        await save(
          f,
          payload([a, b]),
          1,
          f.context,
          key(),
          b.identity.listingId,
        )
      ).statusCode,
    ).toBe(200);
    const current = f.vault.getRecord("settings", RECORD_ID);
    expect(
      (await save(f, first, 0, f.context, createKey)).json(),
    ).toMatchObject({ replayed: true, version: 1 });
    expect(f.vault.getRecord("settings", RECORD_ID)).toEqual(current);
    const different = payload([
      { ...a, assumptions: { ...a.assumptions, waccPercent: "11.0000" } },
    ]);
    expect((await save(f, different, 0, f.context, createKey)).statusCode).toBe(
      409,
    );
    expect((await save(f, first, 0)).statusCode).toBe(409);
    expect((await save(f, different, 1)).statusCode).toBe(409);
    expect(
      (await clear(f, a.identity.listingId, payload([]), 1)).statusCode,
    ).toBe(409);
    expect((await resolveEntry(f, a.identity, 1)).statusCode).toBe(409);
    expect(f.vault.getRecord("settings", RECORD_ID)).toEqual(current);
  });

  it("caps the collection at twenty while allowing replacement and explicit removal at capacity", async () => {
    const f = await ready();
    const entries = Array.from({ length: 20 }, (_, i) => entry(f, i));
    seed(f, payload(entries));
    const changed = {
      ...entries[0]!,
      assumptions: { ...entries[0]!.assumptions, waccPercent: "12.0000" },
    };
    expect(
      (
        await save(
          f,
          payload([...entries, entry(f, 20)]),
          1,
          f.context,
          key(),
          f.identities[20]!.listingId,
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (await save(f, payload([changed, ...entries.slice(1)]), 1)).statusCode,
    ).toBe(200);
    expect(
      (await clear(f, changed.identity.listingId, payload(entries.slice(1)), 2))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await save(
          f,
          payload([...entries.slice(1), entry(f, 20)]),
          3,
          f.context,
          key(),
          f.identities[20]!.listingId,
        )
      ).statusCode,
    ).toBe(200);
  });

  it("requires current catalog/watchlist admission and rejects every altered full-identity field before a write", async () => {
    const f = await ready();
    const a = entry(f, 1);
    const write = vi.spyOn(f.vault, "putRecord");
    for (const field of PERSONAL_SAVED_DCF_IDENTITY_FIELDS) {
      const changes = {
        country: "CA",
        exchangeMic: a.identity.exchangeMic === "XNYS" ? "XNAS" : "XNYS",
        instrumentType:
          a.identity.instrumentType === "adr" ? "common_stock" : "adr",
        symbol: "OTHER",
      };
      const value =
        field in changes
          ? changes[field as keyof typeof changes]
          : `${a.identity[field]}-changed`;
      const rejected = await save(
        f,
        payload([{ ...a, identity: { ...a.identity, [field]: value } }]),
        0,
      );
      expect([400, 404, 409], field).toContain(rejected.statusCode);
    }
    expect(
      (await save(f, payload([a]), 0, { ...f.context, watchlistVersion: 2 }))
        .statusCode,
    ).toBe(409);
    const foreign = `sha256:${"f".repeat(64)}` as const;
    expect(
      (
        await save(
          f,
          payload([{ ...a, createdAgainstCatalogSnapshotSha256: foreign }]),
          0,
          { ...f.context, catalogSnapshotSha256: foreign },
        )
      ).statusCode,
    ).toBe(409);
    expect(write).not.toHaveBeenCalled();
  });

  it("requires clearing an old same-listing identity explicitly before saving a current replacement", async () => {
    const f = await ready();
    const current = entry(f, 1);
    const historical = {
      ...current,
      identity: { ...current.identity, issuerName: "Former issuer name" },
    };
    seed(f, payload([historical]));
    expect((await save(f, payload([current]), 1)).statusCode).toBe(409);
    expect((await resolveEntry(f, current.identity)).statusCode).toBe(409);
    expect(
      (await clear(f, current.identity.listingId, payload([]), 1)).statusCode,
    ).toBe(200);
    expect((await save(f, payload([current]), 2)).statusCode).toBe(200);
  });

  it("resolves unchanged exact identities after an explicit catalog reconciliation and unrelated note version", async () => {
    const f = await ready();
    const a = entry(f, 1);
    expect((await save(f, payload([a]), 0)).statusCode).toBe(201);
    const saved = f.vault.getRecord("settings", RECORD_ID);
    await closeFixture(f);
    const refreshed = await ready(f.root, true);
    expect((await resolveEntry(refreshed, a.identity)).statusCode).toBe(409);
    refreshed.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 1,
      idempotencyKey: key(),
      payload: {
        ...refreshed.watchlist,
        memberships: refreshed.watchlist.memberships.map((m) => ({
          ...m,
          note: "Changed unrelated note",
        })),
      },
    });
    const result = await resolveEntry(refreshed, a.identity, 1, {
      ...refreshed.context,
      watchlistVersion: 2,
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({
      catalogSnapshotSha256: refreshed.context.catalogSnapshotSha256,
      watchlistVersion: 2,
      entry: a,
    });
    expect(refreshed.vault.getRecord("settings", RECORD_ID)).toEqual(saved);
    expect(refreshed.provider.loadSnapshot).not.toHaveBeenCalled();
  });

  it("keeps orphan and unsupported-model entries readable/clearable and preserves them during unrelated saves", async () => {
    const f = await ready();
    const a = entry(f, 1),
      b = entry(f, 2);
    const future = {
      ...a,
      modelVersion: "2.0.0",
      assumptions: {
        ...a.assumptions,
        forecastYears: 20,
        waccPercent: "50.0000",
      },
    };
    seed(f, payload([future]));
    expect((await save(f, payload([a]), 1)).statusCode).toBe(409);
    f.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 1,
      idempotencyKey: key(),
      payload: {
        ...f.watchlist,
        memberships: f.watchlist.memberships.filter(
          (m) => m.listingId !== a.identity.listingId,
        ),
      },
    });
    const binding = { ...f.context, watchlistVersion: 2 };
    expect(
      (await get(f)).json<{ payload: PersonalSavedDcfPayloadDto }>().payload,
    ).toEqual(payload([future]));
    expect((await resolveEntry(f, a.identity, 1, binding)).statusCode).toBe(
      409,
    );
    expect(
      (
        await save(
          f,
          payload([future, b]),
          1,
          binding,
          key(),
          b.identity.listingId,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await get(f)).json<{ payload: PersonalSavedDcfPayloadDto }>().payload
        .entries[0],
    ).toEqual(future);
    expect(
      (await clear(f, a.identity.listingId, payload([b]), 2)).statusCode,
    ).toBe(200);
    expect((await resolveEntry(f, b.identity, 3, binding)).statusCode).toBe(
      200,
    );
  });

  it("rejects removed or catalog-mismatched current members while allowing explicit removal of their saved entry", async () => {
    const f = await ready();
    const a = entry(f, 1);
    seed(f, payload([a]));
    const altered = { ...a.identity, issuerName: "Catalog mismatch" };
    f.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 1,
      idempotencyKey: key(),
      payload: { ...f.watchlist, memberships: [{ ...altered, note: "" }] },
    });
    const binding = { ...f.context, watchlistVersion: 2 };
    expect((await resolveEntry(f, a.identity, 1, binding)).statusCode).toBe(
      409,
    );
    expect(
      (await save(f, payload([{ ...a, identity: altered }]), 1, binding))
        .statusCode,
    ).toBe(409);
    expect(
      (await clear(f, a.identity.listingId, payload([]), 1)).statusCode,
    ).toBe(200);
    expect(
      (await save(f, payload([{ ...a, identity: altered }]), 2, binding))
        .statusCode,
    ).toBe(409);
    f.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 2,
      idempotencyKey: key(),
      payload: { ...f.watchlist, memberships: [] },
    });
    expect(
      (await save(f, payload([a]), 2, { ...f.context, watchlistVersion: 3 }))
        .statusCode,
    ).toBe(404);
  });

  it("rechecks bound records before resolving and preserves a concurrent settings writer", async () => {
    const f = await ready();
    const a = entry(f, 1);
    seed(f, payload([a]));
    const originalGet = f.vault.getRecord.bind(f.vault);
    let watchlistReads = 0;
    const spy = vi
      .spyOn(f.vault, "getRecord")
      .mockImplementation((kind, id) => {
        if (kind === "watchlist" && ++watchlistReads === 2)
          return { ...originalGet(kind, id), version: 2 };
        return originalGet(kind, id);
      });
    expect((await resolveEntry(f, a.identity)).statusCode).toBe(409);
    spy.mockRestore();
    let savedReads = 0;
    vi.spyOn(f.vault, "getRecord").mockImplementation((kind, id) => {
      if (kind === "settings" && id === RECORD_ID && ++savedReads === 2) {
        f.vault.putRecord({
          kind,
          id,
          expectedVersion: 1,
          idempotencyKey: key(),
          payload: payload([]) as unknown as JsonValue,
        });
      }
      return originalGet(kind, id);
    });
    expect((await resolveEntry(f, a.identity)).statusCode).toBe(409);
    expect(originalGet("settings", RECORD_ID)).toMatchObject({
      version: 2,
      payload: payload([]),
    });
  });

  it("refuses a changed watchlist during save admission before invoking the settings write", async () => {
    const f = await ready();
    const a = entry(f, 1);
    const originalGet = f.vault.getRecord.bind(f.vault);
    let watchlistReads = 0;
    vi.spyOn(f.vault, "getRecord").mockImplementation((kind, id) => {
      const record = originalGet(kind, id);
      if (kind === "watchlist" && ++watchlistReads === 2)
        return { ...record, version: record.version + 1 };
      return record;
    });
    const write = vi.spyOn(f.vault, "putRecord");
    expect((await save(f, payload([a]), 0)).statusCode).toBe(409);
    expect(write).not.toHaveBeenCalled();
    expect((await get(f)).statusCode).toBe(404);
  });

  it("lets vault CAS reject a concurrent settings change after targeted validation", async () => {
    const f = await ready();
    const a = entry(f, 1);
    seed(f, payload([a]));
    const originalGet = f.vault.getRecord.bind(f.vault);
    let inserted = false;
    vi.spyOn(f.vault, "getRecord").mockImplementation((kind, id) => {
      const record = originalGet(kind, id);
      if (kind === "watchlist" && !inserted) {
        inserted = true;
        f.vault.putRecord({
          kind: "settings",
          id: RECORD_ID,
          expectedVersion: 1,
          idempotencyKey: key(),
          payload: payload([]) as unknown as JsonValue,
        });
      }
      return record;
    });
    const changed = {
      ...a,
      assumptions: { ...a.assumptions, waccPercent: "12.0000" },
    };
    expect((await save(f, payload([changed]), 1)).statusCode).toBe(409);
    expect(originalGet("settings", RECORD_ID)).toMatchObject({
      version: 2,
      payload: payload([]),
    });
  });

  it("rejects malformed numeric/source payloads and unknown storage without leaking contents or silently clearing", async () => {
    const f = await ready();
    const a = entry(f, 1);
    const write = vi.spyOn(f.vault, "putRecord");
    for (const item of [
      { ...a, assumptions: { ...a.assumptions, waccPercent: "2.5000" } },
      { ...a, assumptions: { ...a.assumptions, waccPercent: "10" } },
      { ...a, modelVersion: "2.0.0" },
      { ...a, quote: "private-source-canary" },
      { ...a, identity: { ...a.identity, note: "private-source-canary" } },
    ])
      expect((await save(f, payload([item]), 0)).statusCode).toBe(400);
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
    for (const stored of [
      { schemaVersion: 2, entries: [] },
      { schemaVersion: 1, entries: [{ provider: "private-storage-canary" }] },
    ]) {
      const prior = maybeSavedVersion(f);
      f.vault.putRecord({
        kind: "settings",
        id: RECORD_ID,
        expectedVersion: prior,
        idempotencyKey: key(),
        payload: stored,
      });
      const response = await get(f);
      expect(response.statusCode).toBe(409);
      expect(response.headers.etag).toBe(`"v${String(prior + 1)}"`);
      expect(response.payload).not.toContain("private-storage-canary");
      expect(
        (await clear(f, a.identity.listingId, payload([]), prior + 1))
          .statusCode,
      ).toBe(409);
      expect((await save(f, payload([a]), prior + 1)).statusCode).toBe(409);
    }
    vi.spyOn(f.vault, "getRecord").mockImplementationOnce(() => {
      throw new Error("private-storage-canary");
    });
    const unavailable = await get(f);
    expect(unavailable.statusCode).toBe(500);
    expect(unavailable.payload).not.toContain("private-storage-canary");
  });

  it("enforces owner/origin, intent, strong version and idempotency before any vault access", async () => {
    const f = await ready();
    const p = payload([entry(f, 1)]);
    const read = vi.spyOn(f.vault, "getRecord"),
      write = vi.spyOn(f.vault, "putRecord");
    const saveBody = {
      operation: "save",
      listingId: p.entries[0]!.identity.listingId,
      payload: p,
      context: f.context,
    };
    const resolveBody = {
      ...f.context,
      identity: p.entries[0]!.identity,
      expectedVersion: 1,
    };
    for (const [method, path, body] of [
      ["GET", PATH, undefined],
      ["POST", PATH, saveBody],
      ["POST", RESOLVE_PATH, resolveBody],
    ] as const) {
      for (const extra of [
        { cookie: "" },
        { origin: "http://foreign.invalid" },
        { host: "foreign.invalid" },
      ]) {
        const response = await request(f, method, path, body, {
          ...(path === PATH && method === "POST" ? mutationHeaders(0) : {}),
          ...extra,
        });
        expect([401, 403]).toContain(response.statusCode);
      }
    }
    for (const extra of [
      { "if-match": '"v1"' },
      { "if-none-match": "" },
      { [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]: "short" },
      { [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]: [key(), key()] },
      {
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: [
          "personal-vault-create",
          "personal-vault-create",
        ],
      },
    ]) {
      const response = await request(f, "POST", PATH, saveBody, {
        ...mutationHeaders(0),
        ...extra,
      });
      expect([400, 401, 403]).toContain(response.statusCode);
    }
    for (const match of ['W/"v1"', '"v0"', '"v01"', "*", '"v1", "v2"'])
      expect(
        (
          await request(f, "POST", PATH, saveBody, {
            ...mutationHeaders(1),
            "if-match": match,
          })
        ).statusCode,
      ).toBe(400);
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
  });
});

async function ready(existingRoot?: string, refreshed = false) {
  const parent =
    existingRoot === undefined
      ? await mkdtemp(join(await realpath(tmpdir()), "saved-dcf-test-"))
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
  const document = buildMutableTestSecurityMasterDocument(24);
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
  const identities = rows.map((row): PersonalSavedDcfIdentityDto => ({
    country: row.country,
    exchangeMic: row.exchangeMic,
    instrumentType: row.instrumentType,
    issuerId: row.issuerId,
    issuerName: row.issuerName,
    listingId: row.listingId,
    securityId: row.securityId,
    securityName: row.securityName,
    shareClassId: row.shareClassId,
    shareClassName: row.shareClassName,
    symbol: row.symbol,
  }));
  const watchlist = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: catalog.snapshotSha256,
    memberships: identities.map((identity) => ({
      ...identity,
      note: "private-watchlist-note",
    })),
  };
  if (existingRoot === undefined)
    vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 0,
      idempotencyKey: key(),
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
  return {
    app,
    vault,
    root,
    cookie,
    provider,
    watchlist,
    identities,
    context: {
      catalogSnapshotSha256: catalog.snapshotSha256,
      watchlistVersion: 1,
    },
  };
}
type Fixture = Awaited<ReturnType<typeof ready>>;
let sequence = 0;
function key() {
  return `saved-dcf-request-key-${String(++sequence)}`;
}
function entry(f: Fixture, index: number): PersonalSavedDcfEntryDto {
  return {
    identity: f.identities[index]!,
    createdAgainstCatalogSnapshotSha256: f.context.catalogSnapshotSha256,
    modelVersion: "1.0.0",
    assumptions: normalizePersonalSavedDcfAssumptions({
      forecastYears: 5,
      taxShieldRatePercent: "21",
      waccPercent: "10",
      terminalGrowthPercent: "2.5",
      scenarios: {
        conservative: { annualFcfProxyGrowthPercent: "0" },
        base: { annualFcfProxyGrowthPercent: "5" },
        expansion: { annualFcfProxyGrowthPercent: "10" },
      },
    })!,
  };
}
function payload(
  entries: readonly PersonalSavedDcfEntryDto[],
): PersonalSavedDcfPayloadDto {
  return { schemaVersion: 1, entries };
}
function seed(f: Fixture, p: PersonalSavedDcfPayloadDto) {
  f.vault.putRecord({
    kind: "settings",
    id: RECORD_ID,
    expectedVersion: 0,
    idempotencyKey: key(),
    payload: p as unknown as JsonValue,
  });
}
function maybeSavedVersion(f: Fixture): number {
  try {
    return f.vault.getRecord("settings", RECORD_ID).version;
  } catch {
    return 0;
  }
}
async function closeFixture(f: Fixture) {
  await f.app.close();
  apps.splice(apps.indexOf(f.app), 1);
  f.vault.close();
  vaults.splice(vaults.indexOf(f.vault), 1);
}
function mutationHeaders(version: number, requestKey = key()) {
  return {
    ...(version === 0
      ? { "if-none-match": "*" }
      : { "if-match": `"v${String(version)}"` }),
    [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]: requestKey,
    [PERSONAL_OWNER_INTENT_HEADER_NAME]:
      version === 0 ? "personal-vault-create" : "personal-vault-update",
  };
}
function request(
  f: Fixture,
  method: "GET" | "POST",
  url: string,
  body?: unknown,
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
    ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
  });
}
function get(f: Fixture) {
  return request(f, "GET", PATH);
}
function save(
  f: Fixture,
  p: PersonalSavedDcfPayloadDto,
  version: number,
  context: unknown = f.context,
  requestKey = key(),
  listingId = p.entries[0]!.identity.listingId,
) {
  return request(
    f,
    "POST",
    PATH,
    { operation: "save", listingId, payload: p, context },
    mutationHeaders(version, requestKey),
  );
}
function clear(
  f: Fixture,
  listingId: string,
  p: PersonalSavedDcfPayloadDto,
  version: number,
  requestKey = key(),
) {
  return request(
    f,
    "POST",
    PATH,
    { operation: "clear", listingId, payload: p, context: null },
    mutationHeaders(version, requestKey),
  );
}
function resolveEntry(
  f: Fixture,
  identity: PersonalSavedDcfIdentityDto,
  expectedVersion = 1,
  context = f.context,
) {
  return request(f, "POST", RESOLVE_PATH, {
    ...context,
    identity,
    expectedVersion,
  });
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
