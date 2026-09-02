import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  LocalResearchVault,
  WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
  type WindowsOwnerOnlyAclPort,
  type WindowsOwnerOnlyAclTarget,
  type WindowsOwnerOnlyAclVerificationReceipt,
} from "@research-cockpit/local-research-vault";
import { afterEach, describe, expect, it } from "vitest";

import { buildPersonalVaultApp } from "./vault-app";
import {
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
} from "./personal-owner-session-routes";
import {
  bootstrapTestPersonalOwnerSession,
  createTestPersonalOwnerSession,
} from "./test-personal-owner-session-builder";

const applications: Awaited<ReturnType<typeof buildPersonalVaultApp>>[] = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map(async (app) => app.close()));
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async (path) => rm(path, { recursive: true, force: true })),
  );
});

describe("personal vault routes", () => {
  it("authenticates before JSON parsing and never composes demo routes", async () => {
    const fixture = await vaultApp("initialize");
    const unauthorized = await fixture.app.inject({
      method: "POST",
      url: "/v1/personal-filing/vault/records/thesis/private-one",
      remoteAddress: "127.0.0.1",
      headers: {
        ...ownerHeaders(),
        "content-type": "application/json",
        "if-none-match": "*",
        [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]:
          "idempotency-unauthorized-create",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-create",
      },
      payload: "{ malformed private canary",
    });
    expect(unauthorized.statusCode).toBe(403);
    expect(unauthorized.payload).not.toContain("private canary");

    const demo = await fixture.app.inject({
      method: "PUT",
      url: "/v1/theses/demo-thesis",
      remoteAddress: "127.0.0.1",
      headers: { ...ownerHeaders(fixture.cookie), "x-demo-persona": "analyst" },
    });
    expect(demo.statusCode).toBe(404);
  });

  it("creates, replays, updates, lists, and deletes with strong preconditions", async () => {
    const fixture = await vaultApp("initialize");
    const status = await fixture.app.inject({
      method: "GET",
      url: "/v1/personal-filing/vault",
      remoteAddress: "127.0.0.1",
      headers: ownerHeaders(fixture.cookie),
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({
      profile: "personal_single_user_local_vault",
      schemaVersion: 2,
      durableSource: "sqlite",
      browserDurableSource: false,
    });

    const createHeaders = {
      ...ownerHeaders(fixture.cookie),
      "content-type": "application/json",
      "if-none-match": "*",
      [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]: "idempotency-api-create-thesis",
      [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-create",
    };
    const create = await fixture.app.inject({
      method: "POST",
      url: "/v1/personal-filing/vault/records/thesis/primary-thesis",
      remoteAddress: "127.0.0.1",
      headers: createHeaders,
      payload: { payload: { title: "Owner private thesis" } },
    });
    expect(create.statusCode).toBe(201);
    expect(create.headers.etag).toBe('"v1"');
    expect(create.json()).toMatchObject({ version: 1, replayed: false });
    const replay = await fixture.app.inject({
      method: "POST",
      url: "/v1/personal-filing/vault/records/thesis/primary-thesis",
      remoteAddress: "127.0.0.1",
      headers: createHeaders,
      payload: { payload: { title: "Owner private thesis" } },
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toMatchObject({ version: 1, replayed: true });

    const stale = await fixture.app.inject({
      method: "POST",
      url: "/v1/personal-filing/vault/records/thesis/primary-thesis",
      remoteAddress: "127.0.0.1",
      headers: {
        ...ownerHeaders(fixture.cookie),
        "content-type": "application/json",
        "if-match": '"v9"',
        [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]:
          "idempotency-api-stale-thesis",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-update",
      },
      payload: { payload: { title: "Stale" } },
    });
    expect(stale.statusCode).toBe(409);

    const update = await fixture.app.inject({
      method: "POST",
      url: "/v1/personal-filing/vault/records/thesis/primary-thesis",
      remoteAddress: "127.0.0.1",
      headers: {
        ...ownerHeaders(fixture.cookie),
        "content-type": "application/json",
        "if-match": '"v1"',
        [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]:
          "idempotency-api-update-thesis",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-update",
      },
      payload: { payload: { title: "Updated" } },
    });
    expect(update.statusCode).toBe(200);
    expect(update.headers.etag).toBe('"v2"');

    const list = await fixture.app.inject({
      method: "GET",
      url: "/v1/personal-filing/vault/records/thesis",
      remoteAddress: "127.0.0.1",
      headers: ownerHeaders(fixture.cookie),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      records: [
        { id: "primary-thesis", version: 2, payload: { title: "Updated" } },
      ],
    });

    const deletion = await fixture.app.inject({
      method: "POST",
      url: "/v1/personal-filing/vault/records/thesis/primary-thesis/delete",
      remoteAddress: "127.0.0.1",
      headers: {
        ...ownerHeaders(fixture.cookie),
        "if-match": '"v2"',
        [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]:
          "idempotency-api-delete-thesis",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-delete",
      },
    });
    expect(deletion.statusCode).toBe(200);
    expect(deletion.headers.etag).toBe('"v3"');
    const unavailable = await fixture.app.inject({
      method: "GET",
      url: "/v1/personal-filing/vault/records/thesis/primary-thesis",
      remoteAddress: "127.0.0.1",
      headers: ownerHeaders(fixture.cookie),
    });
    expect(unavailable.statusCode).toBe(404);
  });

  it("survives API restart without retaining the owner session", async () => {
    const first = await vaultApp("initialize");
    const created = await first.app.inject({
      method: "POST",
      url: "/v1/personal-filing/vault/records/settings/owner-settings",
      remoteAddress: "127.0.0.1",
      headers: {
        ...ownerHeaders(first.cookie),
        "content-type": "application/json",
        "if-none-match": "*",
        [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]:
          "idempotency-api-owner-settings",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-create",
      },
      payload: { payload: { color: "dark" } },
    });
    expect(created.statusCode).toBe(201);
    await first.app.close();
    applications.splice(applications.indexOf(first.app), 1);

    const second = await vaultApp("open", first.parent, first.root);
    const staleSession = await second.app.inject({
      method: "GET",
      url: "/v1/personal-filing/vault/records/settings/owner-settings",
      remoteAddress: "127.0.0.1",
      headers: ownerHeaders(first.cookie),
    });
    expect(staleSession.statusCode).toBe(403);
    const durable = await second.app.inject({
      method: "GET",
      url: "/v1/personal-filing/vault/records/settings/owner-settings",
      remoteAddress: "127.0.0.1",
      headers: ownerHeaders(second.cookie),
    });
    expect(durable.statusCode).toBe(200);
    expect(durable.json()).toMatchObject({ payload: { color: "dark" } });
  });
});

async function vaultApp(
  action: "initialize" | "open",
  existingParent?: string,
  existingRoot?: string,
) {
  const parent =
    existingParent ?? (await mkdtemp(join(tmpdir(), "api-vault-test-")));
  if (existingParent === undefined) temporaryDirectories.push(parent);
  const root = existingRoot ?? join(parent, "vault");
  const options = {
    startupRootPath: root,
    permissionPlatform: "win32" as const,
    windowsAcl: receiptAcl(),
  };
  const vault =
    action === "initialize"
      ? await LocalResearchVault.initialize(options)
      : await LocalResearchVault.open(options);
  const owner = createTestPersonalOwnerSession();
  const app = await buildPersonalVaultApp(vault, owner.authority);
  applications.push(app);
  const cookie = await bootstrapTestPersonalOwnerSession(app, owner.secret);
  return { app, cookie, parent, root };
}

function ownerHeaders(cookie?: string): Record<string, string> {
  return {
    accept: "application/json",
    ...(cookie === undefined ? {} : { cookie }),
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
  };
}

function receiptAcl(): WindowsOwnerOnlyAclPort {
  const receipt = (
    target: WindowsOwnerOnlyAclTarget,
  ): WindowsOwnerOnlyAclVerificationReceipt => ({
    profile: WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
    canonicalRootPath: target.canonicalRootPath,
    verifiedPaths: [...target.targetPaths],
    ownerIdentity: "test-owner",
    inheritanceProtected: true,
    ownerOnly: true,
  });
  return {
    provisionAndVerifyOwnerOnly: (target) => Promise.resolve(receipt(target)),
    verifyOwnerOnly: (target) => Promise.resolve(receipt(target)),
  };
}
