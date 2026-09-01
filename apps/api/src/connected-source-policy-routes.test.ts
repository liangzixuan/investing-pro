import { rm } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { buildConnectedSourcePolicyApp } from "./connected-app";
import {
  CONNECTED_SOURCE_POLICY_KILL_INTENT,
  CONNECTED_SOURCE_POLICY_KILL_PATH,
  CONNECTED_SOURCE_POLICY_STATUS_PATH,
} from "./connected-source-policy-routes";
import { PERSONAL_FILING_DOSSIER_PATH } from "./personal-dossier-routes";
import { PERSONAL_OWNER_INTENT_HEADER_NAME } from "./personal-owner-session-routes";
import { PERSONAL_FILING_READINESS_PATH } from "./personal-readiness-routes";
import { PERSONAL_FILING_SELECTED_FACTS_PATH } from "./personal-selected-fact-routes";
import {
  bootstrapTestPersonalOwnerSession,
  createTestPersonalOwnerSession,
} from "./test-personal-owner-session-builder";
import {
  createTestConnectedSourcePolicyFixture,
  TEST_CONNECTED_SOURCE_SECRET_REFERENCE,
} from "./test-connected-source-policy-builder";

const apps: Awaited<ReturnType<typeof buildConnectedSourcePolicyApp>>[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
  await Promise.all(
    directories
      .splice(0)
      .map(async (directory) =>
        rm(directory, { force: true, recursive: true }),
      ),
  );
});

describe("connected source policy administration routes", () => {
  it("returns only owner-authenticated non-secret status with private headers", async () => {
    const { app, bootstrapSecret, cookie } = await connectedApp();
    const response = await app.inject({
      method: "GET",
      url: CONNECTED_SOURCE_POLICY_STATUS_PATH,
      remoteAddress: "127.0.0.1",
      headers: ownerHeaders(cookie),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.headers.vary).toContain("Origin");
    expect(response.json()).toEqual({
      budget: {
        currency: "USD",
        estimatedSpendMicrounits: { limit: 5_000_000, used: 0 },
        requestBytes: { limit: 1_000_000, used: 0 },
        requests: { limit: 100, used: 0 },
        responseBytes: { limit: 1_000_000, used: 0 },
        storageBytes: { limit: 0, used: 0 },
      },
      policyId: "connected_policy_primary",
      policyVersion: "policy_v1",
      profile: "personal_single_user_local_connected",
      reasonCode: null,
      schemaVersion: "1.0.0",
      sourceId: "connected_source_primary",
      status: "ready",
    });
    for (const canary of [
      TEST_CONNECTED_SOURCE_SECRET_REFERENCE,
      bootstrapSecret,
      cookie,
      "owner_entitlement",
      "example.invalid/license",
      "Example source attribution",
    ]) {
      expect(response.payload).not.toContain(canary);
    }
  });

  it("requires the exact owner session boundary for status", async () => {
    const { app, cookie } = await connectedApp();
    const changes: Array<Record<string, string | undefined>> = [
      { cookie: undefined },
      { origin: "http://localhost:3000" },
      { host: "127.0.0.1:65535" },
      { forwarded: "for=127.0.0.1" },
      { authorization: "Bearer private-canary" },
    ];
    for (const change of changes) {
      const headers = ownerHeaders(cookie);
      for (const [key, value] of Object.entries(change)) {
        if (value === undefined) delete headers[key];
        else headers[key] = value;
      }
      const response = await app.inject({
        method: "GET",
        url: CONNECTED_SOURCE_POLICY_STATUS_PATH,
        remoteAddress: "127.0.0.1",
        headers,
      });
      expect(response.statusCode).toBe(403);
      expect(response.payload).not.toContain("private-canary");
      expect(response.headers["cache-control"]).toBe("private, no-store");
    }

    const query = await app.inject({
      method: "GET",
      url: `${CONNECTED_SOURCE_POLICY_STATUS_PATH}?secret=private-canary`,
      remoteAddress: "127.0.0.1",
      headers: ownerHeaders(cookie),
    });
    expect(query.statusCode).toBe(403);
    expect(query.payload).not.toContain("private-canary");
    const head = await app.inject({
      method: "HEAD",
      url: CONNECTED_SOURCE_POLICY_STATUS_PATH,
      remoteAddress: "127.0.0.1",
      headers: ownerHeaders(cookie),
    });
    expect(head.statusCode).toBe(404);
  });

  it("kills idempotently only with the exact empty mutation intent", async () => {
    const { app, cookie } = await connectedApp();
    const missingIntent = await app.inject({
      method: "POST",
      url: CONNECTED_SOURCE_POLICY_KILL_PATH,
      remoteAddress: "127.0.0.1",
      headers: ownerHeaders(cookie),
    });
    const wrongIntent = await app.inject({
      method: "POST",
      url: CONNECTED_SOURCE_POLICY_KILL_PATH,
      remoteAddress: "127.0.0.1",
      headers: {
        ...ownerHeaders(cookie),
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "revoke",
      },
    });
    const withBody = await app.inject({
      method: "POST",
      url: CONNECTED_SOURCE_POLICY_KILL_PATH,
      remoteAddress: "127.0.0.1",
      headers: {
        ...ownerHeaders(cookie),
        "content-type": "application/json",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]:
          CONNECTED_SOURCE_POLICY_KILL_INTENT,
      },
      payload: { secret: "private-canary" },
    });
    for (const response of [missingIntent, wrongIntent, withBody]) {
      expect(response.statusCode).toBe(403);
      expect(response.payload).not.toContain("private-canary");
    }
    expect((await status(app, cookie)).json()).toMatchObject({
      status: "ready",
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const killed = await app.inject({
        method: "POST",
        url: CONNECTED_SOURCE_POLICY_KILL_PATH,
        remoteAddress: "127.0.0.1",
        headers: {
          ...ownerHeaders(cookie),
          [PERSONAL_OWNER_INTENT_HEADER_NAME]:
            CONNECTED_SOURCE_POLICY_KILL_INTENT,
        },
      });
      expect(killed.statusCode).toBe(204);
      expect(killed.payload).toBe("");
      expect(killed.headers["cache-control"]).toBe("private, no-store");
    }
    const finalStatus = await status(app, cookie);
    expect(finalStatus.json()).toMatchObject({
      reasonCode: "OWNER_KILL_SWITCH",
      status: "killed",
    });
  });

  it("suppresses every synthetic and offline-release business route", async () => {
    const { app, cookie } = await connectedApp();
    for (const url of [
      "/v1/instruments/SYN1/dossier",
      "/v1/evidence/evidence.synthetic.public-filing",
      "/v1/theses/66666666-6666-4666-8666-666666666666",
      PERSONAL_FILING_READINESS_PATH,
      PERSONAL_FILING_SELECTED_FACTS_PATH,
      PERSONAL_FILING_DOSSIER_PATH.replace(":symbol", "SYN1"),
    ]) {
      const response = await app.inject({
        method: "GET",
        url,
        remoteAddress: "127.0.0.1",
        headers: ownerHeaders(cookie),
      });
      expect(response.statusCode).toBe(404);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      expect(response.payload).not.toContain("synthetic/v1");
    }
    const ready = await app.inject({ method: "GET", url: "/health/ready" });
    expect(ready.json()).toEqual({ status: "ready" });
    expect(ready.headers["cache-control"]).toBe("private, no-store");
  });

  it("limits credentialed CORS to the exact local browser and admin headers", async () => {
    const { app } = await connectedApp();
    const allowed = await app.inject({
      method: "OPTIONS",
      url: CONNECTED_SOURCE_POLICY_KILL_PATH,
      headers: {
        origin: "http://127.0.0.1:3000",
        "access-control-request-method": "POST",
        "access-control-request-headers": PERSONAL_OWNER_INTENT_HEADER_NAME,
      },
    });
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "http://127.0.0.1:3000",
    );
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
    expect(allowed.headers["access-control-allow-methods"]).toBe("GET, POST");
    expect(
      allowed.headers["access-control-allow-headers"]?.toLowerCase(),
    ).toContain("x-research-cockpit-intent");
    const rejected = await app.inject({
      method: "OPTIONS",
      url: CONNECTED_SOURCE_POLICY_STATUS_PATH,
      headers: {
        origin: "https://untrusted.example",
        "access-control-request-method": "GET",
      },
    });
    expect(rejected.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

async function connectedApp() {
  const fixture = await createTestConnectedSourcePolicyFixture();
  directories.push(fixture.directory);
  const owner = createTestPersonalOwnerSession();
  const app = await buildConnectedSourcePolicyApp(
    fixture.administration,
    owner.authority,
  );
  apps.push(app);
  const cookie = await bootstrapTestPersonalOwnerSession(app, owner.secret);
  return { app, bootstrapSecret: owner.secret, cookie };
}

function ownerHeaders(cookie: string): Record<string, string> {
  return {
    accept: "application/json",
    cookie,
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
  };
}

function status(
  app: Awaited<ReturnType<typeof buildConnectedSourcePolicyApp>>,
  cookie: string,
) {
  return app.inject({
    method: "GET",
    url: CONNECTED_SOURCE_POLICY_STATUS_PATH,
    remoteAddress: "127.0.0.1",
    headers: ownerHeaders(cookie),
  });
}
