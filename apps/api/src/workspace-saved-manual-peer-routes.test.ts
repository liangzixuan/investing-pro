import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PERSONAL_SAVED_MANUAL_PEER_IDENTITY_FIELDS,
  type PersonalSavedManualPeerGroupDto,
  type PersonalSavedManualPeerIdentityDto,
  type PersonalSavedManualPeerPayloadDto,
  type PersonalSavedManualPeerResolvedDto,
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
  PERSONAL_SAVED_MANUAL_PEER_PATH as PATH,
  PERSONAL_SAVED_MANUAL_PEER_RESOLVE_PATH as RESOLVE_PATH,
  PERSONAL_SAVED_MANUAL_PEER_RECORD_ID as RECORD_ID,
} from "./workspace-saved-manual-peer-routes";

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

describe("saved manual peer group routes", () => {
  it("round trips all identities and peer order through encrypted reopen without provider or unrelated writes", async () => {
    const f = await ready();
    expect((await get(f)).statusCode).toBe(404);
    const originalWatchlist = f.vault.getRecord("watchlist", "main");
    f.vault.putRecord({
      kind: "settings",
      id: "unrelated-peer-test",
      expectedVersion: 0,
      idempotencyKey: key(),
      payload: { criteria: "retained" },
    });
    const unrelated = f.vault.getRecord("settings", "unrelated-peer-test"),
      p = payload(group(f));
    const saved = await save(f, p, 0);
    expect(saved.statusCode).toBe(201);
    expect(saved.headers.etag).toBe('"v1"');
    expect(saved.json()).toMatchObject({
      kind: "settings",
      id: RECORD_ID,
      operation: "put",
      version: 1,
      replayed: false,
    });
    const loaded = await get(f);
    expect(loaded.headers.etag).toBe('"v1"');
    expect(loaded.json()).toMatchObject({
      kind: "settings",
      id: RECORD_ID,
      version: 1,
      payload: p,
    });
    expect(loaded.payload).not.toContain("private-watchlist-note");
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    await closeFixture(f);
    const reopened = await ready(f.root),
      resolved = await resolveGroup(reopened);
    expect(resolved.statusCode).toBe(200);
    expect(resolved.headers.etag).toBe('"v1"');
    expect(resolved.json<PersonalSavedManualPeerResolvedDto>()).toEqual({
      schemaVersion: "1.0.0",
      ...reopened.context,
      savedPeerGroupVersion: 1,
      group: p.group,
    });
    expect(reopened.vault.getRecord("watchlist", "main")).toEqual(
      originalWatchlist,
    );
    expect(reopened.vault.getRecord("settings", "unrelated-peer-test")).toEqual(
      unrelated,
    );
    expect(reopened.provider.loadSnapshot).not.toHaveBeenCalled();
  });
  it("replaces the complete ordered slot, retains versioned null after Clear, and saves again", async () => {
    const f = await ready(),
      first = payload(group(f)),
      next = payload({ ...group(f, [2, 1]), primary: f.identities[4]! });
    expect((await save(f, first, 0)).statusCode).toBe(201);
    expect((await save(f, next, 1)).statusCode).toBe(200);
    expect((await get(f)).json()).toMatchObject({ version: 2, payload: next });
    const clearKey = key();
    expect((await clear(f, 2, clearKey)).statusCode).toBe(200);
    expect((await clear(f, 2, clearKey)).json()).toMatchObject({
      version: 3,
      replayed: true,
    });
    expect((await get(f)).json()).toMatchObject({
      version: 3,
      payload: payload(null),
    });
    expect((await resolveGroup(f, next.group!.primary, 3)).statusCode).toBe(
      404,
    );
    expect((await save(f, first, 3)).statusCode).toBe(200);
    expect((await resolveGroup(f, first.group!.primary, 4)).statusCode).toBe(
      200,
    );
  });
  it("does not create a missing slot when Clear is requested", async () => {
    const f = await ready(),
      write = vi.spyOn(f.vault, "putRecord");
    expect((await clear(f, 0)).statusCode).toBe(400);
    expect((await clear(f, 1)).statusCode).toBe(404);
    expect((await get(f)).statusCode).toBe(404);
    expect(write).not.toHaveBeenCalled();
  });
  it("preserves exact idempotent replay across subsequent edits and rejects stale or key-conflicting writes", async () => {
    const f = await ready(),
      p = payload(group(f, [1])),
      createKey = key();
    expect((await save(f, p, 0, f.context, createKey)).statusCode).toBe(201);
    expect((await save(f, p, 0, f.context, createKey)).json()).toMatchObject({
      version: 1,
      replayed: true,
    });
    const next = payload(group(f, [2, 1]));
    expect((await save(f, next, 1)).statusCode).toBe(200);
    expect((await save(f, p, 0, f.context, createKey)).json()).toMatchObject({
      version: 1,
      replayed: true,
    });
    expect((await save(f, next, 0, f.context, createKey)).statusCode).toBe(409);
    expect((await save(f, p, 1)).statusCode).toBe(409);
    expect((await clear(f, 1)).statusCode).toBe(409);
    expect((await get(f)).json()).toMatchObject({ version: 2, payload: next });
  });
  it("rejects every changed primary or peer identity field and stale catalog/watchlist before writing", async () => {
    const f = await ready(),
      g = group(f, [1]),
      write = vi.spyOn(f.vault, "putRecord");
    for (const role of ["primary", "peer"] as const)
      for (const field of PERSONAL_SAVED_MANUAL_PEER_IDENTITY_FIELDS) {
        const original = role === "primary" ? g.primary : g.peers[0]!;
        const value =
          field === "country"
            ? "CA"
            : field === "exchangeMic"
              ? original.exchangeMic === "XNAS"
                ? "XNYS"
                : "XNAS"
              : field === "instrumentType"
                ? original.instrumentType === "adr"
                  ? "common_stock"
                  : "adr"
                : field === "symbol"
                  ? "OTHER"
                  : `${original[field]}-changed`;
        const changed = { ...original, [field]: value };
        const candidate =
          role === "primary"
            ? { ...g, primary: changed }
            : { ...g, peers: [changed] };
        expect([400, 404, 409], `${role}:${field}`).toContain(
          (await save(f, payload(candidate), 0)).statusCode,
        );
      }
    expect(
      (await save(f, payload(g), 0, { ...f.context, watchlistVersion: 2 }))
        .statusCode,
    ).toBe(409);
    const foreign = `sha256:${"f".repeat(64)}` as const;
    expect(
      (
        await save(
          f,
          payload({ ...g, createdAgainstCatalogSnapshotSha256: foreign }),
          0,
          { ...f.context, catalogSnapshotSha256: foreign },
        )
      ).statusCode,
    ).toBe(409);
    expect(write).not.toHaveBeenCalled();
  });
  it("requires the same exact primary and every saved member, returning no partial group", async () => {
    const f = await ready(),
      g = group(f);
    seed(f, payload(g));
    expect((await resolveGroup(f, f.identities[5])).statusCode).toBe(409);
    for (const field of [
      "country",
      "instrumentType",
      "shareClassId",
      "shareClassName",
    ] as const) {
      const primary = {
        ...g.primary,
        [field]:
          field === "country"
            ? "CA"
            : field === "instrumentType"
              ? g.primary.instrumentType === "adr"
                ? "common_stock"
                : "adr"
              : `${g.primary[field]}-changed`,
      };
      expect([400, 409]).toContain((await resolveGroup(f, primary)).statusCode);
    }
    expect((await resolveGroup(f, g.primary, 2)).statusCode).toBe(409);
    f.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 1,
      idempotencyKey: key(),
      payload: {
        ...f.watchlist,
        memberships: f.watchlist.memberships.filter(
          (m) => m.listingId !== g.peers[2]!.listingId,
        ),
      },
    });
    const response = await resolveGroup(f, g.primary, 1, {
      ...f.context,
      watchlistVersion: 2,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).not.toHaveProperty("group");
    expect((await get(f)).json()).toMatchObject({ payload: payload(g) });
    expect((await clear(f, 1)).statusCode).toBe(200);
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
  });
  it("resolves unchanged members after catalog reconciliation without rewriting stored provenance", async () => {
    const f = await ready(),
      g = group(f);
    seed(f, payload(g));
    const saved = f.vault.getRecord("settings", RECORD_ID);
    await closeFixture(f);
    const refreshed = await ready(f.root, true);
    expect((await resolveGroup(refreshed, g.primary)).statusCode).toBe(409);
    refreshed.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 1,
      idempotencyKey: key(),
      payload: {
        ...refreshed.watchlist,
        memberships: refreshed.watchlist.memberships.map((m) => ({
          ...m,
          note: "Unrelated new note",
        })),
      },
    });
    const response = await resolveGroup(refreshed, g.primary, 1, {
      ...refreshed.context,
      watchlistVersion: 2,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      catalogSnapshotSha256: refreshed.context.catalogSnapshotSha256,
      watchlistVersion: 2,
      group: g,
    });
    expect(refreshed.vault.getRecord("settings", RECORD_ID)).toEqual(saved);
  });
  it("rejects catalog-mismatched current membership but keeps the orphan readable and clearable", async () => {
    const f = await ready(),
      g = group(f, [1]);
    seed(f, payload(g));
    const altered = { ...g.peers[0]!, shareClassName: "Former class" };
    f.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 1,
      idempotencyKey: key(),
      payload: {
        ...f.watchlist,
        memberships: f.watchlist.memberships.map((m) =>
          m.listingId === altered.listingId ? { ...altered, note: "" } : m,
        ),
      },
    });
    const context = { ...f.context, watchlistVersion: 2 };
    expect((await resolveGroup(f, g.primary, 1, context)).statusCode).toBe(409);
    expect(
      (await save(f, payload({ ...g, peers: [altered] }), 1, context))
        .statusCode,
    ).toBe(409);
    expect((await get(f)).json()).toMatchObject({ payload: payload(g) });
    expect((await clear(f, 1)).statusCode).toBe(200);
  });
  it.each(["save", "resolve"] as const)(
    "rechecks the watchlist after all members before %s finishes",
    async (operation) => {
      const f = await ready(),
        g = group(f, [1, 2]);
      seed(f, payload(g));
      const original = f.vault.getRecord.bind(f.vault);
      let reads = 0;
      vi.spyOn(f.vault, "getRecord").mockImplementation((kind, id) => {
        const record = original(kind, id);
        return kind === "watchlist" && ++reads === 4
          ? { ...record, version: 2 }
          : record;
      });
      const write = vi.spyOn(f.vault, "putRecord");
      const response =
        operation === "save"
          ? await save(f, payload(g), 1)
          : await resolveGroup(f, g.primary);
      expect(response.statusCode).toBe(409);
      expect(write).not.toHaveBeenCalled();
      expect(original("settings", RECORD_ID)).toMatchObject({ version: 1 });
    },
  );
  it("rechecks the saved version before returning a resolved group", async () => {
    const f = await ready(),
      g = group(f);
    seed(f, payload(g));
    const original = f.vault.getRecord.bind(f.vault);
    let reads = 0;
    vi.spyOn(f.vault, "getRecord").mockImplementation((kind, id) => {
      if (kind === "settings" && id === RECORD_ID && ++reads === 2)
        f.vault.putRecord({
          kind,
          id,
          expectedVersion: 1,
          idempotencyKey: key(),
          payload: payload(null) as unknown as JsonValue,
        });
      return original(kind, id);
    });
    expect((await resolveGroup(f)).statusCode).toBe(409);
    expect(original("settings", RECORD_ID)).toMatchObject({
      version: 2,
      payload: payload(null),
    });
  });
  it("lets vault CAS preserve a concurrent writer during member admission", async () => {
    const f = await ready(),
      g = group(f);
    seed(f, payload(g));
    const original = f.vault.getRecord.bind(f.vault);
    let changed = false;
    vi.spyOn(f.vault, "getRecord").mockImplementation((kind, id) => {
      const record = original(kind, id);
      if (kind === "watchlist" && !changed) {
        changed = true;
        f.vault.putRecord({
          kind: "settings",
          id: RECORD_ID,
          expectedVersion: 1,
          idempotencyKey: key(),
          payload: payload(null) as unknown as JsonValue,
        });
      }
      return record;
    });
    expect((await save(f, payload(group(f, [2, 1])), 1)).statusCode).toBe(409);
    expect(original("settings", RECORD_ID)).toMatchObject({
      version: 2,
      payload: payload(null),
    });
  });
  it("refuses malformed payloads and unknown stored schemas without leaking or erasing", async () => {
    const f = await ready(),
      g = group(f),
      write = vi.spyOn(f.vault, "putRecord");
    for (const changed of [
      { ...g, note: "private-canary" },
      { ...g, peers: [] },
      { ...g, peers: [g.primary] },
      { ...g, peers: [{ ...g.peers[0]!, issuerId: g.primary.issuerId }] },
      { ...g, primary: { ...g.primary, provider: "private-canary" } },
    ])
      expect((await save(f, payload(changed), 0)).statusCode).toBe(400);
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
    for (const stored of [
      { schemaVersion: 2, group: null },
      { schemaVersion: 1, group: { provider: "private-storage-canary" } },
    ]) {
      const version = maybeSavedVersion(f);
      f.vault.putRecord({
        kind: "settings",
        id: RECORD_ID,
        expectedVersion: version,
        idempotencyKey: key(),
        payload: stored,
      });
      const response = await get(f);
      expect(response.statusCode).toBe(409);
      expect(response.payload).not.toContain("private-storage-canary");
      expect((await clear(f, version + 1)).statusCode).toBe(409);
      expect((await save(f, payload(g), version + 1)).statusCode).toBe(409);
    }
    vi.spyOn(f.vault, "getRecord").mockImplementationOnce(() => {
      throw new Error("private-error-canary");
    });
    const response = await get(f);
    expect(response.statusCode).toBe(500);
    expect(response.payload).not.toContain("private-error-canary");
  });
  it("rejects owner/origin, intent, strong version and idempotency failures before any vault access", async () => {
    const f = await ready(),
      p = payload(group(f)),
      read = vi.spyOn(f.vault, "getRecord"),
      write = vi.spyOn(f.vault, "putRecord");
    const saveBody = { operation: "save", payload: p, context: f.context },
      resolveBody = {
        ...f.context,
        primary: p.group!.primary,
        expectedVersion: 1,
      };
    for (const [method, path, body] of [
      ["GET", PATH, undefined],
      ["POST", PATH, saveBody],
      ["POST", RESOLVE_PATH, resolveBody],
    ] as const)
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
    ])
      expect([400, 401, 403]).toContain(
        (
          await request(f, "POST", PATH, saveBody, {
            ...mutationHeaders(0),
            ...extra,
          })
        ).statusCode,
      );
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
      ? await mkdtemp(join(await realpath(tmpdir()), "saved-manual-peer-test-"))
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
  const distinctIssuers = rows.filter(
    (row, index) =>
      rows.findIndex((candidate) => candidate.issuerId === row.issuerId) ===
      index,
  );
  const identities = distinctIssuers.map(
    (row): PersonalSavedManualPeerIdentityDto => ({
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
    }),
  );
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
  return `saved-manual-peer-request-key-${String(++sequence)}`;
}
function group(
  f: Fixture,
  indices = [3, 1, 2],
): PersonalSavedManualPeerGroupDto {
  return {
    primary: f.identities[0]!,
    peers: indices.map((i) => f.identities[i]!),
    createdAgainstCatalogSnapshotSha256: f.context.catalogSnapshotSha256,
  };
}
function payload(
  group: PersonalSavedManualPeerGroupDto | null,
): PersonalSavedManualPeerPayloadDto {
  return { schemaVersion: 1, group };
}
function seed(f: Fixture, p: PersonalSavedManualPeerPayloadDto) {
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
  p: PersonalSavedManualPeerPayloadDto,
  version: number,
  context: unknown = f.context,
  requestKey = key(),
) {
  return request(
    f,
    "POST",
    PATH,
    { operation: "save", payload: p, context },
    mutationHeaders(version, requestKey),
  );
}
function clear(f: Fixture, version: number, requestKey = key()) {
  return request(
    f,
    "POST",
    PATH,
    { operation: "clear", payload: payload(null), context: null },
    mutationHeaders(version, requestKey),
  );
}
function resolveGroup(
  f: Fixture,
  primary: PersonalSavedManualPeerIdentityDto = f.identities[0]!,
  expectedVersion = 1,
  context = f.context,
) {
  return request(f, "POST", RESOLVE_PATH, {
    ...context,
    primary,
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
