import { randomBytes } from "node:crypto";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  createPersonalOwnerAccountRecord,
  PERSONAL_OWNER_ACCOUNT_FILE_ENVIRONMENT_KEY,
  writePersonalOwnerAccountFile,
} from "./personal-owner-account";
import { PERSONAL_MARKET_DATA_TIINGO_TOKEN_ENVIRONMENT_KEY } from "./personal-market-data-provider";
import { PERSONAL_SEC_USER_AGENT } from "./personal-sec-financial-provider";
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
  PERSONAL_WORKSPACE_LOCAL_ACCESS_ENVIRONMENT_KEY,
} from "./workspace-composition-root";
import { PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH } from "./workspace-watchlist-routes";
import { PERSONAL_MARKET_DATA_STATUS_PATH } from "./workspace-market-data-routes";
import { PERSONAL_SEC_FILING_CONTEXT_PATH } from "./workspace-sec-filing-context-routes";
import { PERSONAL_SEC_QUARTERLY_EVIDENCE_PATH } from "./workspace-sec-quarterly-evidence-routes";
import { PERSONAL_SEC_ANNUAL_EVIDENCE_PATH } from "./workspace-sec-annual-evidence-routes";
import {
  PERSONAL_SECURITY_MASTER_SCREEN_PATH,
  PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
} from "./workspace-screener-routes";

interface WorkspaceFixture {
  readonly expectedSnapshotSha256: string;
  readonly parent: string;
  readonly snapshotPath: string;
  readonly vaultRoot: string;
}

const applications: FastifyInstance[] = [];
const directories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await Promise.all(applications.splice(0).map(async (app) => app.close()));
  await Promise.all(
    directories
      .splice(0)
      .map(async (path) => rm(path, { recursive: true, force: true })),
  );
});

describe("personal workspace composition root", () => {
  it("explicitly opens the existing encrypted vault without login and preserves data across restart", async () => {
    const fixture = await createWorkspaceFixture();
    const bootstrap = randomBytes(32).toString("hex");
    const original = await createPersonalWorkspaceConfiguredApp(
      capturePersonalWorkspaceApiEnvironment(
        workspaceEnvironment(fixture, "initialize", bootstrap),
      ),
    );
    applications.push(original);
    const originalCookie = await bootstrapTestPersonalOwnerSession(
      original,
      bootstrap,
    );
    const payload = productionWatchlistPayload(fixture.expectedSnapshotSha256);
    expect(
      (
        await putMainWatchlist(
          original,
          originalCookie,
          payload,
          0,
          "local-access-seed",
        )
      ).statusCode,
    ).toBe(201);
    const before = await original.inject({
      method: "GET",
      url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
      headers: ownerHeaders(originalCookie),
      remoteAddress: "127.0.0.1",
    });
    await closeTracked(original);

    for (let attempt = 0; attempt < 2; attempt++) {
      const environment = {
        ...workspaceEnvironment(fixture, "open", bootstrap),
        [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: undefined,
        [PERSONAL_WORKSPACE_LOCAL_ACCESS_ENVIRONMENT_KEY]: "enabled",
      };
      const captured = capturePersonalWorkspaceApiEnvironment(environment);
      expect(
        environment[PERSONAL_WORKSPACE_LOCAL_ACCESS_ENVIRONMENT_KEY],
      ).toBeUndefined();
      const app = await createPersonalWorkspaceConfiguredApp(captured);
      applications.push(app);
      expect(
        captured[PERSONAL_WORKSPACE_LOCAL_ACCESS_ENVIRONMENT_KEY],
      ).toBeUndefined();
      const probe = await app.inject({
        method: "GET",
        url: "/v1/personal-filing/session/local-access",
        headers: ownerHeaders(),
        remoteAddress: "127.0.0.1",
      });
      expect(probe.statusCode).toBe(204);
      expect(probe.headers["set-cookie"]).toBeUndefined();
      const after = await app.inject({
        method: "GET",
        url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
        headers: ownerHeaders(),
        remoteAddress: "127.0.0.1",
      });
      expect(after.statusCode).toBe(200);
      expect(after.json()).toEqual(before.json());
      await closeTracked(app);
    }

    const restored = await createPersonalWorkspaceConfiguredApp(
      capturePersonalWorkspaceApiEnvironment(
        workspaceEnvironment(fixture, "open", bootstrap),
      ),
    );
    applications.push(restored);
    const denied = await restored.inject({
      method: "GET",
      url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
      headers: ownerHeaders(),
      remoteAddress: "127.0.0.1",
    });
    expect(denied.statusCode).toBe(403);
    const restoredCookie = await bootstrapTestPersonalOwnerSession(
      restored,
      bootstrap,
    );
    const retained = await restored.inject({
      method: "GET",
      url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
      headers: ownerHeaders(restoredCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(retained.json()).toEqual(before.json());
  }, 30_000);

  it("rejects invalid and mixed local-access configuration before opening a vault", async () => {
    const fixture = await createWorkspaceFixture();
    const secret = randomBytes(32).toString("hex");
    const base = {
      ...workspaceEnvironment(fixture, "initialize", secret),
      [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: undefined,
    };
    for (const value of ["", "true", "disabled", " enabled", "ENABLED"]) {
      await expect(
        createPersonalWorkspaceConfiguredApp(
          capturePersonalWorkspaceApiEnvironment({
            ...base,
            [PERSONAL_WORKSPACE_LOCAL_ACCESS_ENVIRONMENT_KEY]: value,
          }),
        ),
      ).rejects.toMatchObject({
        code: "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID",
      });
    }
    for (const extra of [
      { [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: secret },
      {
        [PERSONAL_OWNER_ACCOUNT_FILE_ENVIRONMENT_KEY]: join(
          fixture.parent,
          "missing-account.json",
        ),
      },
    ]) {
      await expect(
        createPersonalWorkspaceConfiguredApp(
          capturePersonalWorkspaceApiEnvironment({
            ...base,
            ...extra,
            [PERSONAL_WORKSPACE_LOCAL_ACCESS_ENVIRONMENT_KEY]: "enabled",
          }),
        ),
      ).rejects.toMatchObject({
        code: "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID",
      });
    }
    await expect(
      createPersonalWorkspaceConfiguredApp(
        capturePersonalWorkspaceApiEnvironment({ ...base }),
      ),
    ).rejects.toMatchObject({
      code: "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED",
    });
  });

  it("migrates an existing vault to reusable account login and retains it across restart", async () => {
    const fixture = await createWorkspaceFixture();
    const bootstrap = randomBytes(32).toString("hex");
    const original = await createPersonalWorkspaceConfiguredApp(
      capturePersonalWorkspaceApiEnvironment(
        workspaceEnvironment(fixture, "initialize", bootstrap),
      ),
    );
    applications.push(original);
    const originalCookie = await bootstrapTestPersonalOwnerSession(
      original,
      bootstrap,
    );
    const created = await putMainWatchlist(
      original,
      originalCookie,
      productionWatchlistPayload(fixture.expectedSnapshotSha256),
      0,
      "owner-login-migration-watchlist",
    );
    expect(created.statusCode).toBe(201);
    const before = await original.inject({
      method: "GET",
      url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
      headers: ownerHeaders(originalCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(before.statusCode).toBe(200);
    await closeTracked(original);

    const accountFile = join(fixture.parent, "owner-account.json");
    writePersonalOwnerAccountFile(
      accountFile,
      await createPersonalOwnerAccountRecord(
        "owner",
        "Synthetic owner password 2026!",
      ),
    );
    const environment = {
      ...workspaceEnvironment(fixture, "open", bootstrap),
      [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: undefined,
      [PERSONAL_OWNER_ACCOUNT_FILE_ENVIRONMENT_KEY]: accountFile,
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = { ...environment };
      const captured = capturePersonalWorkspaceApiEnvironment(raw);
      expect(raw[PERSONAL_OWNER_ACCOUNT_FILE_ENVIRONMENT_KEY]).toBeUndefined();
      const app = await createPersonalWorkspaceConfiguredApp(captured);
      applications.push(app);
      expect(
        captured[PERSONAL_OWNER_ACCOUNT_FILE_ENVIRONMENT_KEY],
      ).toBeUndefined();
      const login = await app.inject({
        method: "POST",
        url: "/v1/personal-filing/session/login",
        remoteAddress: "127.0.0.1",
        headers: {
          host: "127.0.0.1:3100",
          origin: "http://127.0.0.1:3000",
          "content-type": "application/json",
          "x-research-cockpit-intent": "login",
        },
        payload: {
          username: "owner",
          password: "Synthetic owner password 2026!",
        },
      });
      expect(login.statusCode).toBe(204);
      const cookie = String(login.headers["set-cookie"]).split(";")[0]!;
      const after = await app.inject({
        method: "GET",
        url: PERSONAL_WORKSPACE_MAIN_WATCHLIST_PATH,
        headers: ownerHeaders(cookie),
        remoteAddress: "127.0.0.1",
      });
      expect(after.statusCode).toBe(200);
      expect(after.json()).toEqual(before.json());
      await closeTracked(app);
    }
  }, 30_000);

  it("rejects mixed authentication configuration and a missing account file before opening a vault", async () => {
    const fixture = await createWorkspaceFixture();
    const environment = {
      ...workspaceEnvironment(
        fixture,
        "initialize",
        randomBytes(32).toString("hex"),
      ),
      [PERSONAL_OWNER_ACCOUNT_FILE_ENVIRONMENT_KEY]: join(
        fixture.parent,
        "missing-account.json",
      ),
    };
    await expect(
      createPersonalWorkspaceConfiguredApp(
        capturePersonalWorkspaceApiEnvironment({ ...environment }),
      ),
    ).rejects.toMatchObject({
      code: "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID",
    });
    await expect(
      createPersonalWorkspaceConfiguredApp(
        capturePersonalWorkspaceApiEnvironment({
          ...environment,
          [PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY]: undefined,
        }),
      ),
    ).rejects.toMatchObject({
      code: "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID",
    });
  });

  it("captures an optional market-data token without requiring or exposing it", async () => {
    const fixture = await createWorkspaceFixture();
    const firstSecret = randomBytes(32).toString("hex");
    const token = "private-tiingo-token-canary";
    const sourceEnvironment = {
      ...workspaceEnvironment(fixture, "initialize", firstSecret),
      [PERSONAL_MARKET_DATA_TIINGO_TOKEN_ENVIRONMENT_KEY]: token,
      [PERSONAL_SEC_USER_AGENT]: "ResearchCockpit test@example.invalid",
    };
    const captured = capturePersonalWorkspaceApiEnvironment(sourceEnvironment);
    expect(sourceEnvironment[PERSONAL_SEC_USER_AGENT]).toBeUndefined();
    expect(captured[PERSONAL_SEC_USER_AGENT]).toBe(
      "ResearchCockpit test@example.invalid",
    );
    expect(
      sourceEnvironment[PERSONAL_MARKET_DATA_TIINGO_TOKEN_ENVIRONMENT_KEY],
    ).toBeUndefined();
    const source = vi.fn<typeof fetch>((input, init) => {
      expect(new Headers(init?.headers).get("User-Agent")).toBe(
        "ResearchCockpit test@example.invalid",
      );
      const sourceUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      return Promise.resolve(
        Response.json(
          sourceUrl.includes("/companyfacts/")
            ? { cik: 1, facts: { "us-gaap": {} } }
            : {
                cik: "0000000001",
                filings: {
                  recent: {
                    accessionNumber: [],
                    form: [],
                    filingDate: [],
                    reportDate: [],
                    acceptanceDateTime: [],
                  },
                  files: [],
                },
              },
        ),
      );
    });
    vi.stubGlobal("fetch", source);
    expect(source).not.toHaveBeenCalled();
    const configured = await createPersonalWorkspaceConfiguredApp(captured);
    expect(captured[PERSONAL_SEC_USER_AGENT]).toBeUndefined();
    applications.push(configured);
    expect(source).not.toHaveBeenCalled();
    expect(
      captured[PERSONAL_MARKET_DATA_TIINGO_TOKEN_ENVIRONMENT_KEY],
    ).toBeUndefined();
    const configuredCookie = await bootstrapTestPersonalOwnerSession(
      configured,
      firstSecret,
    );
    const configuredStatus = await configured.inject({
      method: "GET",
      url: PERSONAL_MARKET_DATA_STATUS_PATH,
      headers: ownerHeaders(configuredCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(configuredStatus.statusCode).toBe(200);
    expect(configuredStatus.json()).toMatchObject({ status: "configured" });
    expect(configuredStatus.payload).not.toContain(token);
    const evidenceRequest = {
      method: "POST" as const,
      url: PERSONAL_SEC_QUARTERLY_EVIDENCE_PATH,
      payload: {
        schemaVersion: "1.0.0",
        catalogSnapshotSha256: fixture.expectedSnapshotSha256,
        listingId: "lst-00000",
        symbol: "S00000",
      },
      remoteAddress: "127.0.0.1",
    };
    const configuredEvidence = await configured.inject({
      ...evidenceRequest,
      headers: {
        ...ownerHeaders(configuredCookie),
        "content-type": "application/json",
      },
    });
    expect(configuredEvidence.statusCode).toBe(200);
    expect(configuredEvidence.json()).toMatchObject({
      evidence: {
        sources: {
          companyFacts: { status: "available" },
          submissions: { status: "available" },
        },
      },
    });
    expect(source).toHaveBeenCalledTimes(2);
    expect(configuredEvidence.payload).not.toContain("test@example.invalid");
    const contextRequest = {
      ...evidenceRequest,
      url: PERSONAL_SEC_FILING_CONTEXT_PATH,
      payload: {
        ...evidenceRequest.payload,
        schemaVersion: "2.0.0",
        selection: {
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
        },
      },
    };
    const context = await configured.inject({
      ...contextRequest,
      headers: {
        ...ownerHeaders(configuredCookie),
        "content-type": "application/json",
      },
    });
    expect(context.statusCode).toBe(200);
    expect(context.json()).toMatchObject({
      inspection: {
        status: "unavailable",
        stage: "company_facts",
        reason: "selection_changed_or_not_retained",
      },
    });
    expect(source).toHaveBeenCalledTimes(3);
    expect(context.payload).not.toContain("test@example.invalid");
    const annualRequest = {
      ...evidenceRequest,
      url: PERSONAL_SEC_ANNUAL_EVIDENCE_PATH,
    };
    const annual = await configured.inject({
      ...annualRequest,
      headers: {
        ...ownerHeaders(configuredCookie),
        "content-type": "application/json",
      },
    });
    expect(annual.statusCode).toBe(200);
    expect(source).toHaveBeenCalledTimes(5);
    expect(annual.payload).not.toContain("test@example.invalid");
    expect(annual.payload).not.toContain(token);
    vi.unstubAllGlobals();
    await closeTracked(configured);

    const secondSecret = randomBytes(32).toString("hex");
    const unconfigured = await createPersonalWorkspaceConfiguredApp(
      capturePersonalWorkspaceApiEnvironment(
        workspaceEnvironment(fixture, "open", secondSecret),
      ),
    );
    applications.push(unconfigured);
    const unconfiguredCookie = await bootstrapTestPersonalOwnerSession(
      unconfigured,
      secondSecret,
    );
    const unconfiguredStatus = await unconfigured.inject({
      method: "GET",
      url: PERSONAL_MARKET_DATA_STATUS_PATH,
      headers: ownerHeaders(unconfiguredCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(unconfiguredStatus.statusCode).toBe(200);
    expect(unconfiguredStatus.json()).toMatchObject({
      status: "not_configured",
    });
    const unconfiguredEvidence = await unconfigured.inject({
      ...evidenceRequest,
      headers: {
        ...ownerHeaders(unconfiguredCookie),
        "content-type": "application/json",
      },
    });
    const unconfiguredContext = await unconfigured.inject({
      ...contextRequest,
      headers: {
        ...ownerHeaders(unconfiguredCookie),
        "content-type": "application/json",
      },
    });
    expect(unconfiguredContext.statusCode).toBe(503);
    expect(unconfiguredContext.json()).toMatchObject({
      code: "not_configured",
    });
    expect(unconfiguredEvidence.statusCode).toBe(503);
    expect(unconfiguredEvidence.json()).toMatchObject({
      code: "not_configured",
    });
    const unconfiguredAnnual = await unconfigured.inject({
      ...annualRequest,
      headers: {
        ...ownerHeaders(unconfiguredCookie),
        "content-type": "application/json",
      },
    });
    expect(unconfiguredAnnual.statusCode).toBe(503);
    expect(unconfiguredAnnual.json()).toMatchObject({ code: "not_configured" });
  }, 30_000);

  it("serves catalog screening plus restart-persistent typed watchlist and saved views", async () => {
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

    const screened = await first.inject({
      method: "POST",
      url: PERSONAL_SECURITY_MASTER_SCREEN_PATH,
      headers: {
        ...ownerHeaders(firstCookie),
        "content-type": "application/json",
      },
      payload: {
        page: { limit: 2, offset: 0 },
        query: {
          clauses: [
            { field: "exchange_mic", operator: "in", values: ["XNAS"] },
          ],
          operator: "and",
        },
        schemaVersion: "1.0.0",
        snapshotSha256: fixture.expectedSnapshotSha256,
        sort: { direction: "asc", field: "symbol" },
      },
      remoteAddress: "127.0.0.1",
    });
    expect(screened.statusCode).toBe(200);
    expect(screened.json()).toMatchObject({
      rows: [{ listingId: "lst-00000", symbol: "S00000" }],
      snapshotSha256: fixture.expectedSnapshotSha256,
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

    const savedViewsPayload = productionSavedViewsPayload(
      fixture.expectedSnapshotSha256,
    );
    const createSavedViews = await first.inject({
      method: "POST",
      url: PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
      headers: {
        ...ownerHeaders(firstCookie),
        "content-type": "application/json",
        "if-none-match": "*",
        [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]:
          "workspace-screener-saved-views-create",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-create",
      },
      payload: { payload: savedViewsPayload },
      remoteAddress: "127.0.0.1",
    });
    expect(createSavedViews.statusCode).toBe(201);
    expect(createSavedViews.headers.etag).toBe('"v1"');

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
    const persistedSavedViews = await second.inject({
      method: "GET",
      url: PERSONAL_WORKSPACE_SCREENER_SAVED_VIEWS_PATH,
      headers: ownerHeaders(secondCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(persistedSavedViews.statusCode).toBe(200);
    expect(persistedSavedViews.headers.etag).toBe('"v1"');
    expect(persistedSavedViews.json()).toMatchObject({
      id: "stock-screener-saved-views",
      kind: "settings",
      payload: savedViewsPayload,
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

function productionSavedViewsPayload(snapshotSha256: string) {
  return {
    schemaVersion: 1,
    views: [
      {
        columns: ["symbol", "issuer_name", "exchange_mic"],
        createdAgainstSnapshotSha256: snapshotSha256,
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

function ownerHeaders(cookie?: string): Record<string, string> {
  return {
    accept: "application/json",
    ...(cookie === undefined ? {} : { cookie }),
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
  };
}
