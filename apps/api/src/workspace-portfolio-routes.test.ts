import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PersonalPortfolioPayload } from "@research-cockpit/contracts";
import {
  LocalResearchVault,
  WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
  type WindowsOwnerOnlyAclPort,
  type WindowsOwnerOnlyAclTarget,
  type WindowsOwnerOnlyAclVerificationReceipt,
} from "@research-cockpit/local-research-vault";
import {
  admitPersonalSecurityMasterSnapshot,
  searchPersonalSecurityMaster,
} from "@research-cockpit/personal-security-master";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
} from "./personal-owner-session-routes";
import {
  bootstrapTestPersonalOwnerSession,
  createTestPersonalOwnerSession,
} from "./test-personal-owner-session-builder";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { buildPersonalWorkspaceApp } from "./workspace-app";
import { PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH } from "./workspace-portfolio-routes";

const applications: FastifyInstance[] = [];
const vaults: LocalResearchVault[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map(async (app) => app.close()));
  for (const vault of vaults.splice(0)) vault.close();
  await Promise.all(
    directories
      .splice(0)
      .map(async (path) => rm(path, { recursive: true, force: true })),
  );
  vi.restoreAllMocks();
});

describe("personal portfolio storage routes", () => {
  it("authenticates before parsing and never reveals private input", async () => {
    const f = await readyApp();
    const get = vi.spyOn(f.vault, "getRecord");
    const put = vi.spyOn(f.vault, "putRecord");
    for (const headers of [
      ownerHeaders(),
      { ...ownerHeaders(f.cookie), origin: "https://untrusted.invalid" },
      { ...ownerHeaders(f.cookie), host: "untrusted.invalid" },
    ]) {
      const response = await f.app.inject({
        method: "POST",
        url: PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH,
        remoteAddress: "127.0.0.1",
        headers: {
          ...headers,
          ...mutationHeaders(0, "portfolio-unauthorized-key"),
        },
        payload: "{ private-holdings-canary",
      });
      expect(response.statusCode).toBe(403);
      expect(response.payload).not.toContain("private-holdings-canary");
    }
    const read = await f.app.inject({
      method: "GET",
      url: PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH,
      headers: ownerHeaders(),
      remoteAddress: "127.0.0.1",
    });
    expect(read.statusCode).toBe(403);
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("creates, reads, durably reopens, and updates the single encrypted portfolio", async () => {
    const f = await readyApp();
    expect((await readPortfolio(f)).statusCode).toBe(404);
    const created = await writePortfolio(
      f,
      f.payload,
      0,
      "portfolio-create-key",
    );
    expect(created.statusCode).toBe(201);
    expect(created.headers.etag).toBe('"v1"');
    expect(created.headers["cache-control"]).toBe("private, no-store");
    expect(created.json()).toMatchObject({
      kind: "portfolio",
      id: "main",
      version: 1,
      replayed: false,
      operation: "put",
    });
    const read = await readPortfolio(f);
    expect(read.statusCode).toBe(200);
    expect(read.headers.etag).toBe('"v1"');
    expect(read.json()).toMatchObject({ payload: f.payload, version: 1 });
    await f.app.close();
    const reopened = await readyApp(f.root);
    expect((await readPortfolio(reopened)).json()).toMatchObject({
      payload: f.payload,
      version: 1,
    });
    const payload = {
      ...f.payload,
      cashUsd: "0.00",
      holdings: [
        {
          ...f.payload.holdings[0]!,
          shares: "2.500001",
          totalCostBasisUsd: null,
        },
      ],
    };
    const updated = await writePortfolio(
      reopened,
      payload,
      1,
      "portfolio-update-key",
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.headers.etag).toBe('"v2"');
    expect((await readPortfolio(reopened)).json()).toMatchObject({
      payload,
      version: 2,
    });
    expect(reopened.vault.inventory().records).toHaveLength(1);
  });

  it("replays identical mutations and rejects stale, racing, or reused-key changes", async () => {
    const f = await readyApp();
    await writePortfolio(f, f.payload, 0, "portfolio-replay-key");
    const replay = await writePortfolio(
      f,
      f.payload,
      0,
      "portfolio-replay-key",
    );
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toMatchObject({ version: 1, replayed: true });
    const reused = await writePortfolio(
      f,
      { ...f.payload, cashUsd: "1.00" },
      0,
      "portfolio-replay-key",
    );
    expect(reused.statusCode).toBe(409);
    const competing = await Promise.all([
      writePortfolio(
        f,
        { ...f.payload, cashUsd: "2.00" },
        1,
        "portfolio-race-first-key",
      ),
      writePortfolio(
        f,
        { ...f.payload, cashUsd: "3.00" },
        1,
        "portfolio-race-second-key",
      ),
    ]);
    expect(competing.map((response) => response.statusCode).sort()).toEqual([
      200, 409,
    ]);
    expect((await readPortfolio(f)).json()).toMatchObject({ version: 2 });
  });

  it("requires exact strong mutation headers and one closed payload body", async () => {
    const f = await readyApp();
    const put = vi.spyOn(f.vault, "putRecord");
    const valid = mutationHeaders(0, "portfolio-precondition-key");
    for (const headers of [
      { ...valid, "if-none-match": "" },
      { ...valid, "if-match": '"v1"' },
      { ...valid, [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]: "short" },
      {
        ...mutationHeaders(1, "portfolio-precondition-key"),
        "if-match": 'W/"v1"',
      },
      {
        ...mutationHeaders(1, "portfolio-precondition-key"),
        "if-match": '"v0"',
      },
      {
        ...mutationHeaders(1, "portfolio-precondition-key"),
        "if-match": '"v1", "v2"',
      },
      {
        ...mutationHeaders(1, "portfolio-precondition-key"),
        "if-match": '"v9007199254740992"',
      },
      {
        ...mutationHeaders(1, "portfolio-precondition-key"),
        "if-none-match": "*",
      },
    ]) {
      const response = await f.app.inject({
        method: "POST",
        url: PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH,
        remoteAddress: "127.0.0.1",
        headers: { ...ownerHeaders(f.cookie), ...headers },
        payload: { payload: f.payload },
      });
      expect(response.statusCode).toBe(400);
    }
    for (const payload of [
      null,
      [],
      {},
      { payload: f.payload, secret: "private-holdings-canary" },
      "{ private-holdings-canary",
    ]) {
      const response = await f.app.inject({
        method: "POST",
        url: PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH,
        remoteAddress: "127.0.0.1",
        headers: { ...ownerHeaders(f.cookie), ...valid },
        payload:
          typeof payload === "string" ? payload : JSON.stringify(payload),
      });
      expect(response.statusCode).toBe(400);
      expect(response.payload).not.toContain("private-holdings-canary");
    }
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects invalid decimals, future dates, duplicate holdings and unknown fields before persistence", async () => {
    const f = await readyApp();
    const put = vi.spyOn(f.vault, "putRecord");
    const first = f.payload.holdings[0]!;
    for (const payload of [
      { ...f.payload, currency: "EUR" },
      { ...f.payload, cashUsd: "-1" },
      { ...f.payload, cashUsd: 0 },
      { ...f.payload, balance: "private-holdings-canary" },
      { ...f.payload, holdings: [first, first] },
      ...["0", "-1", "1e3", "0.0000001", "1000000001"].map((shares) => ({
        ...f.payload,
        holdings: [{ ...first, shares }],
      })),
      ...["-1", "1.001", "1000000000001"].map((totalCostBasisUsd) => ({
        ...f.payload,
        holdings: [{ ...first, totalCostBasisUsd }],
      })),
      ...["2026-02-30", "9999-12-31"].map((confirmedOn) => ({
        ...f.payload,
        holdings: [{ ...first, confirmedOn }],
      })),
      {
        ...f.payload,
        holdings: [{ ...first, note: "private-holdings-canary" }],
      },
    ]) {
      const response = await writePortfolio(
        f,
        payload,
        0,
        "portfolio-invalid-key",
      );
      expect(response.statusCode, JSON.stringify(payload)).toBe(400);
      expect(response.payload).not.toContain("private-holdings-canary");
    }
    expect(put).not.toHaveBeenCalled();
  });

  it("requires the current catalog and every exact admitted identity field", async () => {
    const f = await readyApp();
    const put = vi.spyOn(f.vault, "putRecord");
    const first = f.payload.holdings[0]!;
    const stale = await writePortfolio(
      f,
      { ...f.payload, snapshotSha256: `sha256:${"f".repeat(64)}` },
      0,
      "portfolio-stale-key",
    );
    expect(stale.statusCode).toBe(409);
    for (const field of [
      "issuerId",
      "issuerName",
      "securityId",
      "securityName",
      "shareClassId",
      "shareClassName",
      "listingId",
      "symbol",
    ] as const) {
      const identity = {
        ...first.identity,
        [field]: field === "symbol" ? "UNKNOWN" : "wrong-identity",
      };
      expect(
        (
          await writePortfolio(
            f,
            { ...f.payload, holdings: [{ ...first, identity }] },
            0,
            "portfolio-identity-key",
          )
        ).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await writePortfolio(
          f,
          {
            ...f.payload,
            holdings: [
              {
                ...first,
                identity: { ...first.identity, exchangeMic: "XASE" },
              },
            ],
          },
          0,
          "portfolio-identity-key",
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await writePortfolio(
          f,
          {
            ...f.payload,
            holdings: [
              {
                ...first,
                identity: {
                  ...first.identity,
                  instrumentType:
                    first.identity.instrumentType === "adr"
                      ? "common_stock"
                      : "adr",
                },
              },
            ],
          },
          0,
          "portfolio-identity-key",
        )
      ).statusCode,
    ).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it("preserves stale holdings for explicit reconciliation and rejects inconsistent current records", async () => {
    const f = await readyApp();
    const first = f.payload.holdings[0]!;
    const payload = {
      ...f.payload,
      snapshotSha256: `sha256:${"f".repeat(64)}`,
      holdings: [{ ...first, identity: { ...first.identity, symbol: "OLD" } }],
    };
    f.vault.putRecord({
      kind: "portfolio",
      id: "main",
      expectedVersion: 0,
      idempotencyKey: "portfolio-old-record-key",
      payload,
    });
    const read = await readPortfolio(f);
    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({ payload, version: 1 });
    f.vault.putRecord({
      kind: "portfolio",
      id: "main",
      expectedVersion: 1,
      idempotencyKey: "portfolio-bad-record-key",
      payload: { ...payload, snapshotSha256: f.payload.snapshotSha256 },
    });
    const invalid = await readPortfolio(f);
    expect(invalid.statusCode).toBe(409);
    expect(invalid.headers.etag).toBe('"v2"');
    expect(invalid.json()).not.toHaveProperty("payload");
  });
});

async function readyApp(existingRoot?: string) {
  const parent =
    existingRoot === undefined
      ? await mkdtemp(join(await realpath(tmpdir()), "api-portfolio-test-"))
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
  const admission = buildTestSecurityMasterAdmission();
  const catalog = admitPersonalSecurityMasterSnapshot(admission);
  const owner = createTestPersonalOwnerSession();
  const app = await buildPersonalWorkspaceApp(catalog, vault, owner.authority);
  applications.push(app);
  const cookie = await bootstrapTestPersonalOwnerSession(app, owner.secret);
  const result = searchPersonalSecurityMaster(catalog, {
    limit: 25,
    query: "S00000",
  }).results[0]!;
  const payload: PersonalPortfolioPayload = {
    schemaVersion: 1,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: catalog.snapshotSha256,
    cashUsd: null,
    holdings: [
      {
        identity: {
          country: result.country,
          exchangeMic: result.exchangeMic,
          instrumentType: result.instrumentType,
          issuerId: result.issuerId,
          issuerName: result.issuerName,
          listingId: result.listingId,
          securityId: result.securityId,
          securityName: result.securityName,
          shareClassId: result.shareClassId,
          shareClassName: result.shareClassName,
          symbol: result.symbol,
        },
        shares: "1.250001",
        totalCostBasisUsd: "123.45",
        confirmedOn: "2020-01-01",
      },
    ],
  };
  return { app, cookie, vault, root, payload };
}

function ownerHeaders(cookie?: string): Record<string, string> {
  return {
    accept: "application/json",
    ...(cookie === undefined ? {} : { cookie }),
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
  };
}

function mutationHeaders(version: number, key: string): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(version === 0
      ? { "if-none-match": "*" }
      : { "if-match": `"v${String(version)}"` }),
    [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]: key,
    [PERSONAL_OWNER_INTENT_HEADER_NAME]:
      version === 0 ? "personal-vault-create" : "personal-vault-update",
  };
}

function writePortfolio(
  f: { app: FastifyInstance; cookie: string },
  payload: unknown,
  version: number,
  key: string,
) {
  return f.app.inject({
    method: "POST",
    url: PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH,
    remoteAddress: "127.0.0.1",
    headers: { ...ownerHeaders(f.cookie), ...mutationHeaders(version, key) },
    payload: { payload },
  });
}

function readPortfolio(f: { app: FastifyInstance; cookie: string }) {
  return f.app.inject({
    method: "GET",
    url: PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH,
    remoteAddress: "127.0.0.1",
    headers: ownerHeaders(f.cookie),
  });
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
