import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  captureConnectedApiEnvironment,
  ConnectedApiCompositionError,
  createConnectedConfiguredApp,
  disposeCapturedConnectedApiEnvironment,
} from "./connected-composition-root";
import { CONNECTED_SOURCE_POLICY_STATUS_PATH } from "./connected-source-policy-routes";
import { bootstrapTestPersonalOwnerSession } from "./test-personal-owner-session-builder";
import {
  createTestConnectedSourcePolicyFixture,
  TEST_CONNECTED_SOURCE_CLOCK,
  TEST_CONNECTED_SOURCE_SECRET_REFERENCE,
} from "./test-connected-source-policy-builder";

const apps: Awaited<ReturnType<typeof createConnectedConfiguredApp>>[] = [];
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

describe("connected API composition root", () => {
  it("scrubs every private binding before asynchronous connected composition", async () => {
    const fixture = await createTestConnectedSourcePolicyFixture();
    directories.push(fixture.directory);
    const bootstrapSecret = freshSecret();
    const childEnvironment: Record<string, string | undefined> = {
      ...fixture.environment,
      RESEARCH_COCKPIT_MODE: "personal_single_user_local_connected",
      RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET: bootstrapSecret,
    };
    const captured = captureConnectedApiEnvironment(childEnvironment);
    const appPromise = createConnectedConfiguredApp(captured, {
      connectedSourceClock: TEST_CONNECTED_SOURCE_CLOCK,
    });

    for (const key of [
      "CONNECTED_SOURCE_POLICY_BUNDLE_PATH",
      "CONNECTED_SOURCE_POLICY_BUNDLE_SHA256",
      "CONNECTED_SOURCE_POLICY_SECRET_REFERENCE",
      "RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET",
    ]) {
      expect(childEnvironment[key]).toBeUndefined();
      expect(captured[key]).toBeUndefined();
    }

    const app = await appPromise;
    apps.push(app);
    const cookie = await bootstrapTestPersonalOwnerSession(
      app,
      bootstrapSecret,
    );
    const response = await app.inject({
      method: "GET",
      url: CONNECTED_SOURCE_POLICY_STATUS_PATH,
      remoteAddress: "127.0.0.1",
      headers: {
        accept: "application/json",
        cookie,
        host: "127.0.0.1:3100",
        origin: "http://127.0.0.1:3000",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      profile: "personal_single_user_local_connected",
      status: "ready",
    });
    expect(response.payload).not.toContain(
      TEST_CONNECTED_SOURCE_SECRET_REFERENCE,
    );

    for (const url of ["/private-path-canary", "/private-%70ath-canary"]) {
      const unknown = await app.inject({
        method: "GET",
        url,
        remoteAddress: "127.0.0.1",
        headers: {
          accept: "application/json",
          host: "127.0.0.1:3100",
          origin: "http://127.0.0.1:3000",
        },
      });
      expect(unknown.statusCode).toBe(404);
      expect(unknown.json()).toMatchObject({
        instance: "/v1/personal-filing/connected-source-policy",
        status: 404,
      });
      expect(unknown.payload).not.toContain("private-path-canary");
      expect(unknown.payload).not.toContain("private-%70ath-canary");
    }
  });

  it("requires the exact connected mode and rejects every offline binding", async () => {
    const missingMode = await createConnectedConfiguredApp({}).catch(
      (error: unknown) => error,
    );
    const offline = await createConnectedConfiguredApp({
      PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH: "offline-private-canary",
      RESEARCH_COCKPIT_MODE: "personal_single_user_local_connected",
    }).catch((error: unknown) => error);
    const securityMaster = await createConnectedConfiguredApp({
      PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH: "security-master-private-canary",
      RESEARCH_COCKPIT_MODE: "personal_single_user_local_connected",
    }).catch((error: unknown) => error);

    expect(missingMode).toBeInstanceOf(ConnectedApiCompositionError);
    expect(missingMode).toMatchObject({ code: "CONNECTED_MODE_REQUIRED" });
    expect(offline).toMatchObject({
      code: "CONNECTED_MODE_REJECTS_OFFLINE_CONFIGURATION",
    });
    expect(String(offline)).not.toContain("offline-private-canary");
    expect(securityMaster).toMatchObject({
      code: "CONNECTED_MODE_REJECTS_OFFLINE_CONFIGURATION",
    });
    expect(String(securityMaster)).not.toContain(
      "security-master-private-canary",
    );
  });

  it("fails closed on missing, partial, malformed, clockless, or ownerless configuration", async () => {
    const fixture = await createTestConnectedSourcePolicyFixture();
    directories.push(fixture.directory);
    const base = {
      RESEARCH_COCKPIT_MODE: "personal_single_user_local_connected",
      RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET: freshSecret(),
    } as const;
    const missing = await createConnectedConfiguredApp(base, {
      connectedSourceClock: TEST_CONNECTED_SOURCE_CLOCK,
    }).catch((error: unknown) => error);
    const partial = await createConnectedConfiguredApp(
      {
        ...base,
        CONNECTED_SOURCE_POLICY_BUNDLE_PATH:
          fixture.environment.CONNECTED_SOURCE_POLICY_BUNDLE_PATH,
      },
      { connectedSourceClock: TEST_CONNECTED_SOURCE_CLOCK },
    ).catch((error: unknown) => error);
    const malformed = await createConnectedConfiguredApp(
      {
        ...base,
        ...fixture.environment,
        CONNECTED_SOURCE_POLICY_BUNDLE_SHA256: `sha256:${"0".repeat(64)}`,
      },
      { connectedSourceClock: TEST_CONNECTED_SOURCE_CLOCK },
    ).catch((error: unknown) => error);
    const clockless = await createConnectedConfiguredApp({
      ...base,
      ...fixture.environment,
    }).catch((error: unknown) => error);
    const ownerless = await createConnectedConfiguredApp(
      {
        ...fixture.environment,
        RESEARCH_COCKPIT_MODE: "personal_single_user_local_connected",
      },
      { connectedSourceClock: TEST_CONNECTED_SOURCE_CLOCK },
    ).catch((error: unknown) => error);

    expect(missing).toMatchObject({
      code: "CONNECTED_SOURCE_POLICY_CONFIGURATION_REQUIRED",
    });
    for (const error of [partial, malformed]) {
      expect(error).toMatchObject({
        code: "CONNECTED_SOURCE_POLICY_UNAVAILABLE",
      });
      expect(String(error)).not.toContain(fixture.bundlePath);
    }
    expect(clockless).toMatchObject({
      code: "CONNECTED_SOURCE_POLICY_DEPENDENCY_INVALID",
    });
    expect(ownerless).toMatchObject({
      code: "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED",
    });
  });

  it("supports idempotent explicit disposal of captured private bindings", () => {
    const environment: Record<string, string | undefined> = {
      CONNECTED_SOURCE_POLICY_BUNDLE_PATH: "private-path",
      RESEARCH_COCKPIT_MODE: "personal_single_user_local_connected",
      RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET: freshSecret(),
    };
    const captured = captureConnectedApiEnvironment(environment);
    disposeCapturedConnectedApiEnvironment(captured);
    disposeCapturedConnectedApiEnvironment(captured);
    expect(captured.CONNECTED_SOURCE_POLICY_BUNDLE_PATH).toBeUndefined();
    expect(captured.RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET).toBeUndefined();
  });
});

function freshSecret(): string {
  return randomBytes(32).toString("hex");
}
