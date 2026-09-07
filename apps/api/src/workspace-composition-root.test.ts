import { randomBytes } from "node:crypto";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import {
  captureSecurityMasterApiEnvironment,
  createSecurityMasterConfiguredApp,
  PERSONAL_SECURITY_MASTER_SNAPSHOT_FILENAME,
  PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY,
  PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY,
} from "./security-master-composition-root";
import {
  captureVaultApiEnvironment,
  createVaultConfiguredApp,
  PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY,
  PERSONAL_VAULT_STARTUP_ENVIRONMENT_KEY,
  VAULT_API_MODE,
} from "./vault-composition-root";
import { PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY } from "./personal-owner-session";
import {
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
} from "./personal-owner-session-routes";
import { PERSONAL_SECURITY_MASTER_SEARCH_PATH } from "./personal-security-master-routes";
import { PERSONAL_VAULT_RECORDS_PREFIX } from "./personal-vault-routes";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { bootstrapTestPersonalOwnerSession } from "./test-personal-owner-session-builder";
import {
  capturePersonalWorkspaceApiEnvironment,
  createPersonalWorkspaceConfiguredApp,
  PERSONAL_WORKSPACE_API_MODE,
} from "./workspace-composition-root";
import { PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH } from "./workspace-watchlist-routes";

interface WorkspaceFixture {
  readonly expectedSnapshotSha256: string;
  readonly parent: string;
  readonly snapshotPath: string;
  readonly vaultRoot: string;
}

const applications: FastifyInstance[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map(async (app) => app.close()));
  await Promise.all(
    directories
      .splice(0)
      .map(async (path) => rm(path, { recursive: true, force: true })),
  );
});

describe("personal workspace composition root", () => {
  it("serves search and a restart-persistent typed main watchlist through one owner session", async () => {
    const fixture = await createWorkspaceFixture();
    const firstSecret = randomBytes(32).toString("hex");
    const sourceEnvironment = workspaceEnvironment(
      fixture,
      "initialize",
      firstSecret,
    );
    const captured = capturePersonalWorkspaceApiEnvironment(sourceEnvironment);
    expect(
      sourceEnvironment[PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY],
    ).toBeUndefined();
    expect(
      sourceEnvironment[PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY],
    ).toBeUndefined();
    expect(
      sourceEnvironment[PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY],
    ).toBeUndefined();

    const first = await createPersonalWorkspaceConfiguredApp(captured);
    applications.push(first);
    expect(captured[PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]).toBeUndefined();
    expect(captured[PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY]).toBeUndefined();
    const firstCookie = await bootstrapTestPersonalOwnerSession(
      first,
      firstSecret,
    );

    const search = await first.inject({
      method: "GET",
      url: `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=S00000`,
      headers: ownerHeaders(firstCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(search.statusCode).toBe(200);
    expect(search.json()).toMatchObject({
      results: [{ listingId: "lst-00000", symbol: "S00000" }],
      totalMatches: 1,
    });

    const watchlistPath = PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH;
    const payload = productionWatchlistPayload(fixture.expectedSnapshotSha256);
    const create = await first.inject({
      method: "POST",
      url: watchlistPath,
      headers: {
        ...ownerHeaders(firstCookie),
        "content-type": "application/json",
        "if-none-match": "*",
        [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]:
          "workspace-watchlist-create-primary",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-create",
      },
      payload: {
        payload,
      },
      remoteAddress: "127.0.0.1",
    });
    expect(create.statusCode).toBe(201);
    expect(create.headers.etag).toBe('"v1"');

    await first.close();
    applications.splice(applications.indexOf(first), 1);

    const secondSecret = randomBytes(32).toString("hex");
    const second = await createPersonalWorkspaceConfiguredApp(
      capturePersonalWorkspaceApiEnvironment(
        workspaceEnvironment(fixture, "open", secondSecret),
      ),
    );
    applications.push(second);
    const secondCookie = await bootstrapTestPersonalOwnerSession(
      second,
      secondSecret,
    );
    const persisted = await second.inject({
      method: "GET",
      url: watchlistPath,
      headers: ownerHeaders(secondCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(persisted.statusCode).toBe(200);
    expect(persisted.headers.etag).toBe('"v1"');
    expect(persisted.json()).toMatchObject({
      kind: "watchlist",
      id: "main",
      payload,
      version: 1,
    });
    const secondSearch = await second.inject({
      method: "GET",
      url: `${PERSONAL_SECURITY_MASTER_SEARCH_PATH}?q=Alpha`,
      headers: ownerHeaders(secondCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(secondSearch.statusCode).toBe(200);
    expect(secondSearch.json()).toMatchObject({ totalMatches: 2 });
  }, 30_000);

  it("keeps absent main state independent of unrelated legacy watchlists", async () => {
    const fixture = await createWorkspaceFixture();
    const legacySecret = randomBytes(32).toString("hex");
    const legacy = await createVaultConfiguredApp(
      captureVaultApiEnvironment(
        vaultEnvironment(fixture, "initialize", legacySecret),
      ),
    );
    applications.push(legacy);
    const legacyCookie = await bootstrapTestPersonalOwnerSession(
      legacy,
      legacySecret,
    );
    for (const [index, id] of ["primary", "secondary"].entries()) {
      const created = await legacy.inject({
        method: "POST",
        url: `${PERSONAL_VAULT_RECORDS_PREFIX}/watchlist/${id}`,
        headers: {
          ...ownerHeaders(legacyCookie),
          "content-type": "application/json",
          "if-none-match": "*",
          [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]: `workspace-legacy-list-${String(index).padStart(2, "0")}`,
          [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-create",
        },
        payload: {
          payload: {
            items: [{ listingId: `legacy-${String(index)}` }],
            name: id,
            schemaVersion: "legacy",
          },
        },
        remoteAddress: "127.0.0.1",
      });
      expect(created.statusCode).toBe(201);
    }
    await closeTracked(legacy);

    const workspaceSecret = randomBytes(32).toString("hex");
    const workspace = await createPersonalWorkspaceConfiguredApp(
      capturePersonalWorkspaceApiEnvironment(
        workspaceEnvironment(fixture, "open", workspaceSecret),
      ),
    );
    applications.push(workspace);
    const workspaceCookie = await bootstrapTestPersonalOwnerSession(
      workspace,
      workspaceSecret,
    );
    const absent = await workspace.inject({
      method: "GET",
      url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
      headers: ownerHeaders(workspaceCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(absent.statusCode).toBe(404);

    const genericCollection = await workspace.inject({
      method: "GET",
      url: `${PERSONAL_VAULT_RECORDS_PREFIX}/watchlist`,
      headers: ownerHeaders(workspaceCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(genericCollection.statusCode).toBe(404);

    const createdMain = await putMainWatchlist(
      workspace,
      workspaceCookie,
      productionWatchlistPayload(fixture.expectedSnapshotSha256),
      0,
      "workspace-main-after-legacy",
    );
    expect(createdMain.statusCode).toBe(201);
    await closeTracked(workspace);

    const auditSecret = randomBytes(32).toString("hex");
    const audit = await createVaultConfiguredApp(
      captureVaultApiEnvironment(
        vaultEnvironment(fixture, "open", auditSecret),
      ),
    );
    applications.push(audit);
    const auditCookie = await bootstrapTestPersonalOwnerSession(
      audit,
      auditSecret,
    );
    const allWatchlists = await audit.inject({
      method: "GET",
      url: `${PERSONAL_VAULT_RECORDS_PREFIX}/watchlist`,
      headers: ownerHeaders(auditCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(allWatchlists.statusCode).toBe(200);
    expect(
      allWatchlists
        .json<{ records: { id: string }[] }>()
        .records.map((record) => record.id)
        .sort(),
    ).toEqual(["main", "primary", "secondary"]);
  }, 30_000);

  it("rejects malformed main payloads and permits an exact versioned repair", async () => {
    const fixture = await createWorkspaceFixture();
    const legacySecret = randomBytes(32).toString("hex");
    const legacy = await createVaultConfiguredApp(
      captureVaultApiEnvironment(
        vaultEnvironment(fixture, "initialize", legacySecret),
      ),
    );
    applications.push(legacy);
    const legacyCookie = await bootstrapTestPersonalOwnerSession(
      legacy,
      legacySecret,
    );
    const malformed = await legacy.inject({
      method: "POST",
      url: `${PERSONAL_VAULT_RECORDS_PREFIX}/watchlist/main`,
      headers: {
        ...ownerHeaders(legacyCookie),
        "content-type": "application/json",
        "if-none-match": "*",
        [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]:
          "workspace-malformed-main-seed",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-create",
      },
      payload: { payload: { schemaVersion: "legacy" } },
      remoteAddress: "127.0.0.1",
    });
    expect(malformed.statusCode).toBe(201);
    await closeTracked(legacy);

    const workspaceSecret = randomBytes(32).toString("hex");
    const workspace = await createPersonalWorkspaceConfiguredApp(
      capturePersonalWorkspaceApiEnvironment(
        workspaceEnvironment(fixture, "open", workspaceSecret),
      ),
    );
    applications.push(workspace);
    const workspaceCookie = await bootstrapTestPersonalOwnerSession(
      workspace,
      workspaceSecret,
    );
    const rejected = await workspace.inject({
      method: "GET",
      url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
      headers: ownerHeaders(workspaceCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(rejected.statusCode).toBe(409);
    expect(rejected.headers.etag).toBe('"v1"');
    expect(rejected.json()).not.toHaveProperty("payload");

    const invalidRepair = await putMainWatchlist(
      workspace,
      workspaceCookie,
      {
        ...productionWatchlistPayload(fixture.expectedSnapshotSha256),
        extra: true,
      },
      1,
      "workspace-invalid-main-repair",
    );
    expect(invalidRepair.statusCode).toBe(400);

    const repaired = await putMainWatchlist(
      workspace,
      workspaceCookie,
      productionWatchlistPayload(fixture.expectedSnapshotSha256),
      1,
      "workspace-valid-main-repair",
    );
    expect(repaired.statusCode).toBe(200);
    expect(repaired.headers.etag).toBe('"v2"');
    const readback = await workspace.inject({
      method: "GET",
      url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
      headers: ownerHeaders(workspaceCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(readback.statusCode).toBe(200);
    expect(readback.json()).toMatchObject({
      id: "main",
      payload: productionWatchlistPayload(fixture.expectedSnapshotSha256),
      version: 2,
    });
  }, 30_000);

  it("rejects a stale catalog snapshot before mutation and accepts the current snapshot", async () => {
    const fixture = await createWorkspaceFixture();
    const workspaceSecret = randomBytes(32).toString("hex");
    const workspace = await createPersonalWorkspaceConfiguredApp(
      capturePersonalWorkspaceApiEnvironment(
        workspaceEnvironment(fixture, "initialize", workspaceSecret),
      ),
    );
    applications.push(workspace);
    const workspaceCookie = await bootstrapTestPersonalOwnerSession(
      workspace,
      workspaceSecret,
    );

    const stale = await putMainWatchlist(
      workspace,
      workspaceCookie,
      productionWatchlistPayload(`sha256:${"f".repeat(64)}`),
      0,
      "workspace-stale-snapshot-rejected",
    );
    expect(stale.statusCode).toBe(409);
    const absentAfterStaleWrite = await workspace.inject({
      method: "GET",
      url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
      headers: ownerHeaders(workspaceCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(absentAfterStaleWrite.statusCode).toBe(404);

    const current = await putMainWatchlist(
      workspace,
      workspaceCookie,
      productionWatchlistPayload(fixture.expectedSnapshotSha256),
      0,
      "workspace-current-snapshot-accepted",
    );
    expect(current.statusCode).toBe(201);
  }, 30_000);

  it("rejects fabricated and mismatched catalog memberships without blocking a valid membership", async () => {
    const fixture = await createWorkspaceFixture();
    const workspaceSecret = randomBytes(32).toString("hex");
    const workspace = await createPersonalWorkspaceConfiguredApp(
      capturePersonalWorkspaceApiEnvironment(
        workspaceEnvironment(fixture, "initialize", workspaceSecret),
      ),
    );
    applications.push(workspace);
    const workspaceCookie = await bootstrapTestPersonalOwnerSession(
      workspace,
      workspaceSecret,
    );

    const fabricated = await putMainWatchlist(
      workspace,
      workspaceCookie,
      watchlistWithMembershipOverride(fixture.expectedSnapshotSha256, {
        issuerId: "iss-99999",
        issuerName: "Fabricated Issuer",
        listingId: "lst-99999",
        securityId: "sec-99999",
        securityName: "Fabricated Security",
        shareClassId: "shr-99999",
        shareClassName: "Fabricated Class",
        symbol: "S99999",
      }),
      0,
      "workspace-fabricated-membership-rejected",
    );
    expect(fabricated.statusCode).toBe(400);

    const mismatched = await putMainWatchlist(
      workspace,
      workspaceCookie,
      watchlistWithMembershipOverride(fixture.expectedSnapshotSha256, {
        exchangeMic: "XNYS",
      }),
      0,
      "workspace-mismatched-membership-rejected",
    );
    expect(mismatched.statusCode).toBe(400);
    const absentAfterInvalidWrites = await workspace.inject({
      method: "GET",
      url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
      headers: ownerHeaders(workspaceCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(absentAfterInvalidWrites.statusCode).toBe(404);

    const valid = await putMainWatchlist(
      workspace,
      workspaceCookie,
      watchlistWithMembershipOverride(fixture.expectedSnapshotSha256, {
        note: "A user-authored note may differ from catalog data.",
      }),
      0,
      "workspace-valid-membership-accepted",
    );
    expect(valid.statusCode).toBe(201);
  }, 30_000);

  it("hides current-snapshot identity corruption while preserving a stale record for reconciliation", async () => {
    const fixture = await createWorkspaceFixture();
    const identityOverride = {
      issuerId: "iss-99999",
      issuerName: "Fabricated Issuer",
      listingId: "lst-99999",
      securityId: "sec-99999",
      securityName: "Fabricated Security",
      shareClassId: "shr-99999",
      shareClassName: "Fabricated Class",
      symbol: "S99999",
    };
    const legacySecret = randomBytes(32).toString("hex");
    const legacy = await createVaultConfiguredApp(
      captureVaultApiEnvironment(
        vaultEnvironment(fixture, "initialize", legacySecret),
      ),
    );
    applications.push(legacy);
    const legacyCookie = await bootstrapTestPersonalOwnerSession(
      legacy,
      legacySecret,
    );
    const seeded = await putGenericMainWatchlist(
      legacy,
      legacyCookie,
      watchlistWithMembershipOverride(
        fixture.expectedSnapshotSha256,
        identityOverride,
      ),
      0,
      "workspace-current-identity-corruption-seed",
    );
    expect(seeded.statusCode).toBe(201);
    await closeTracked(legacy);

    const workspaceSecret = randomBytes(32).toString("hex");
    const workspace = await createPersonalWorkspaceConfiguredApp(
      capturePersonalWorkspaceApiEnvironment(
        workspaceEnvironment(fixture, "open", workspaceSecret),
      ),
    );
    applications.push(workspace);
    const workspaceCookie = await bootstrapTestPersonalOwnerSession(
      workspace,
      workspaceSecret,
    );
    const hiddenCurrentCorruption = await workspace.inject({
      method: "GET",
      url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
      headers: ownerHeaders(workspaceCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(hiddenCurrentCorruption.statusCode).toBe(409);
    expect(hiddenCurrentCorruption.headers.etag).toBe('"v1"');
    expect(hiddenCurrentCorruption.json()).not.toHaveProperty("payload");
    await closeTracked(workspace);

    const staleSnapshotSha256 = `sha256:${"e".repeat(64)}`;
    const repairSecret = randomBytes(32).toString("hex");
    const repair = await createVaultConfiguredApp(
      captureVaultApiEnvironment(
        vaultEnvironment(fixture, "open", repairSecret),
      ),
    );
    applications.push(repair);
    const repairCookie = await bootstrapTestPersonalOwnerSession(
      repair,
      repairSecret,
    );
    const stalePayload = watchlistWithMembershipOverride(
      staleSnapshotSha256,
      identityOverride,
    );
    const madeStale = await putGenericMainWatchlist(
      repair,
      repairCookie,
      stalePayload,
      1,
      "workspace-stale-record-reconciliation-seed",
    );
    expect(madeStale.statusCode).toBe(200);
    expect(madeStale.headers.etag).toBe('"v2"');
    await closeTracked(repair);

    const reopenedSecret = randomBytes(32).toString("hex");
    const reopened = await createPersonalWorkspaceConfiguredApp(
      capturePersonalWorkspaceApiEnvironment(
        workspaceEnvironment(fixture, "open", reopenedSecret),
      ),
    );
    applications.push(reopened);
    const reopenedCookie = await bootstrapTestPersonalOwnerSession(
      reopened,
      reopenedSecret,
    );
    const readableStaleRecord = await reopened.inject({
      method: "GET",
      url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
      headers: ownerHeaders(reopenedCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(readableStaleRecord.statusCode).toBe(200);
    expect(readableStaleRecord.headers.etag).toBe('"v2"');
    expect(readableStaleRecord.json()).toMatchObject({
      id: "main",
      payload: stalePayload,
      version: 2,
    });
  }, 30_000);

  it("keeps both legacy entrypoints isolated from the combined mode", async () => {
    const fixture = await createWorkspaceFixture();

    await expect(
      createSecurityMasterConfiguredApp(
        captureSecurityMasterApiEnvironment(
          workspaceEnvironment(
            fixture,
            "initialize",
            randomBytes(32).toString("hex"),
          ),
        ),
      ),
    ).rejects.toMatchObject({ code: "SECURITY_MASTER_MODE_REQUIRED" });
    await expect(
      createVaultConfiguredApp(
        captureVaultApiEnvironment(
          workspaceEnvironment(
            fixture,
            "initialize",
            randomBytes(32).toString("hex"),
          ),
        ),
      ),
    ).rejects.toMatchObject({ code: "VAULT_MODE_REQUIRED" });
    await expect(
      createPersonalWorkspaceConfiguredApp(
        capturePersonalWorkspaceApiEnvironment({
          ...workspaceEnvironment(
            fixture,
            "initialize",
            randomBytes(32).toString("hex"),
          ),
          RESEARCH_COCKPIT_MODE: "personal_single_user_local_security_master",
        }),
      ),
    ).rejects.toMatchObject({ code: "PERSONAL_WORKSPACE_MODE_REQUIRED" });
  });

  it("rejects adjacent private configuration from the combined mode", async () => {
    const fixture = await createWorkspaceFixture();
    await expect(
      createPersonalWorkspaceConfiguredApp(
        capturePersonalWorkspaceApiEnvironment({
          ...workspaceEnvironment(
            fixture,
            "initialize",
            randomBytes(32).toString("hex"),
          ),
          PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH: "private-canary",
        }),
      ),
    ).rejects.toMatchObject({
      code: "PERSONAL_WORKSPACE_MODE_REJECTS_OTHER_PRIVATE_CONFIGURATION",
    });
  });
});

async function createWorkspaceFixture(): Promise<WorkspaceFixture> {
  const parent = await mkdtemp(
    join(await realpath(tmpdir()), "workspace-composition-test-"),
  );
  directories.push(parent);
  const admission = buildTestSecurityMasterAdmission();
  const snapshotPath = join(parent, PERSONAL_SECURITY_MASTER_SNAPSHOT_FILENAME);
  await writeFile(snapshotPath, admission.snapshot, { flag: "wx" });
  return {
    expectedSnapshotSha256: admission.expectedSha256,
    parent,
    snapshotPath,
    vaultRoot: join(parent, "owner-vault"),
  };
}

function workspaceEnvironment(
  fixture: WorkspaceFixture,
  vaultStartup: "initialize" | "open",
  bootstrapSecret: string,
): Record<string, string | undefined> {
  return {
    HOST: "127.0.0.1",
    PORT: "3100",
    RESEARCH_COCKPIT_MODE: PERSONAL_WORKSPACE_API_MODE,
    [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: bootstrapSecret,
    [PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY]:
      fixture.snapshotPath,
    [PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY]:
      fixture.expectedSnapshotSha256,
    [PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY]: fixture.vaultRoot,
    [PERSONAL_VAULT_STARTUP_ENVIRONMENT_KEY]: vaultStartup,
  };
}

function vaultEnvironment(
  fixture: WorkspaceFixture,
  vaultStartup: "initialize" | "open",
  bootstrapSecret: string,
): Record<string, string | undefined> {
  return {
    HOST: "127.0.0.1",
    PORT: "3100",
    RESEARCH_COCKPIT_MODE: VAULT_API_MODE,
    [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: bootstrapSecret,
    [PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY]: fixture.vaultRoot,
    [PERSONAL_VAULT_STARTUP_ENVIRONMENT_KEY]: vaultStartup,
  };
}

function productionWatchlistPayload(snapshotSha256: string) {
  return {
    memberships: [
      {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "adr",
        issuerId: "iss-00000",
        issuerName: "Zéro Alpha Holdings",
        listingId: "lst-00000",
        note: "Review the next filing.",
        securityId: "sec-00000",
        securityName: "Zéro Alpha Security",
        shareClassId: "shr-00000",
        shareClassName: "Zéro Alpha ADR",
        symbol: "S00000",
      },
    ],
    name: "My Watchlist",
    schemaVersion: 1,
    snapshotSha256,
  } as const;
}

function watchlistWithMembershipOverride(
  snapshotSha256: string,
  override: Record<string, string>,
) {
  const payload = productionWatchlistPayload(snapshotSha256);
  return {
    ...payload,
    memberships: [{ ...payload.memberships[0], ...override }],
  };
}

function putMainWatchlist(
  app: FastifyInstance,
  cookie: string,
  payload: unknown,
  currentVersion: number,
  idempotencyKey: string,
) {
  const creating = currentVersion === 0;
  return app.inject({
    method: "POST",
    url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
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
    payload: { payload },
    remoteAddress: "127.0.0.1",
  });
}

function putGenericMainWatchlist(
  app: FastifyInstance,
  cookie: string,
  payload: unknown,
  currentVersion: number,
  idempotencyKey: string,
) {
  const creating = currentVersion === 0;
  return app.inject({
    method: "POST",
    url: `${PERSONAL_VAULT_RECORDS_PREFIX}/watchlist/main`,
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
    payload: { payload },
    remoteAddress: "127.0.0.1",
  });
}

async function closeTracked(app: FastifyInstance): Promise<void> {
  await app.close();
  applications.splice(applications.indexOf(app), 1);
}

function ownerHeaders(cookie: string): Record<string, string> {
  return {
    accept: "application/json",
    cookie,
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
  };
}
