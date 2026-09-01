import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  captureLocalApiEnvironment,
  createConfiguredApp,
  disposeCapturedLocalApiEnvironment,
  LocalApiCompositionError,
} from "./composition-root";
import { resolveDemoApiListenOptions } from "./listen-options";
import { bootstrapTestPersonalOwnerSession } from "./test-personal-owner-session-builder";
import { createPublicPersonalQualityReadinessFixture } from "./test-personal-quality-readiness-builder";

const apps: Awaited<ReturnType<typeof createConfiguredApp>>[] = [];
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

describe("local API composition root", () => {
  it("removes private child-process inputs before invalid listen configuration can fail", () => {
    const environment: Record<string, string | undefined> = {
      HOST: "not-loopback",
      PERSONAL_FILING_QUALITY_RESULT_PATH: "private-quality-path",
      PERSONAL_FILING_QUALITY_RESULT_SHA256: `sha256:${"1".repeat(64)}`,
      PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH:
        "private-approval-path",
      PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH: "private-bundle-path",
      PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256: `sha256:${"2".repeat(64)}`,
      RESEARCH_COCKPIT_MODE: "personal_readiness",
      RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET: "a".repeat(64),
    };

    const captured = captureLocalApiEnvironment(environment);

    expect(() => resolveDemoApiListenOptions(captured)).toThrow(
      "The demo API listen host must be an exact loopback IP literal.",
    );
    disposeCapturedLocalApiEnvironment(captured);
    disposeCapturedLocalApiEnvironment(captured);
    for (const key of [
      "PERSONAL_FILING_QUALITY_RESULT_PATH",
      "PERSONAL_FILING_QUALITY_RESULT_SHA256",
      "PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH",
      "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH",
      "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256",
      "RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET",
    ]) {
      expect(environment[key]).toBeUndefined();
      expect(captured[key]).toBeUndefined();
    }
    expect(Object.isFrozen(captured)).toBe(false);
  });

  it("scrubs a captured bootstrap before asynchronous personal composition", async () => {
    const fixture = await createPublicPersonalQualityReadinessFixture();
    directories.push(fixture.directory);
    const bootstrapSecret = freshSecret();
    const childEnvironment: Record<string, string | undefined> = {
      ...fixture.environment,
      RESEARCH_COCKPIT_MODE: "personal_readiness",
      RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET: bootstrapSecret,
    };
    const captured = captureLocalApiEnvironment(childEnvironment);

    const appPromise = createConfiguredApp(captured);

    expect(captured.RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET).toBeUndefined();
    const app = await appPromise;
    apps.push(app);
    const cookie = await bootstrapTestPersonalOwnerSession(
      app,
      bootstrapSecret,
    );
    expect(cookie).toContain("research_cockpit_owner_session=");
  });

  it("does not mutate caller-owned composition inputs", async () => {
    const fixture = await createPublicPersonalQualityReadinessFixture();
    directories.push(fixture.directory);
    const bootstrapSecret = freshSecret();
    const environment = {
      ...fixture.environment,
      RESEARCH_COCKPIT_MODE: "personal_readiness",
      RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET: bootstrapSecret,
    };

    const app = await createConfiguredApp(environment);
    apps.push(app);

    expect(environment.RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET).toBe(
      bootstrapSecret,
    );
  });

  it("keeps the default synthetic app unchanged and personal readiness unavailable", async () => {
    const app = await createConfiguredApp({});
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/personal-filing/readiness",
      remoteAddress: "127.0.0.1",
      headers: {
        accept: "application/json",
        host: "127.0.0.1:3100",
        origin: "http://127.0.0.1:3000",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.payload).not.toContain("PERSONAL_FILING_QUALITY");
  });

  it("admits a valid pinned result only in explicit personal mode", async () => {
    const fixture = await createPublicPersonalQualityReadinessFixture();
    directories.push(fixture.directory);
    const bootstrapSecret = freshSecret();
    const app = await createConfiguredApp({
      ...fixture.environment,
      RESEARCH_COCKPIT_MODE: "personal_readiness",
      RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET: bootstrapSecret,
    });
    apps.push(app);
    const cookie = await bootstrapTestPersonalOwnerSession(
      app,
      bootstrapSecret,
    );
    const response = await app.inject({
      method: "GET",
      url: "/v1/personal-filing/readiness",
      remoteAddress: "127.0.0.1",
      headers: {
        accept: "application/json",
        cookie,
        host: "127.0.0.1:3100",
        origin: "http://127.0.0.1:3000",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      schemaVersion: "1.0.0",
      profile: "personal_single_user_local",
      status: "quality_gate_ready",
      dataPlane: "disabled",
    });
  });

  it("requires explicit personal mode and never falls back to synthetic", async () => {
    const implicit = await createConfiguredApp({
      PERSONAL_FILING_QUALITY_RESULT_PATH: "private-canary",
    }).catch((error: unknown) => error);
    const missing = await createConfiguredApp({
      RESEARCH_COCKPIT_MODE: "personal_readiness",
      RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET: freshSecret(),
    }).catch((error: unknown) => error);

    expect(implicit).toBeInstanceOf(LocalApiCompositionError);
    expect(implicit).toMatchObject({
      code: "PERSONAL_CONFIGURATION_REQUIRES_EXPLICIT_MODE",
    });
    expect(missing).toBeInstanceOf(LocalApiCompositionError);
    expect(missing).toMatchObject({ code: "PERSONAL_READINESS_UNAVAILABLE" });
    for (const error of [implicit, missing]) {
      expect(String(error)).not.toContain("private-canary");
    }
  });

  it("requires a fresh exact owner bootstrap secret in personal modes", async () => {
    const missing = await createConfiguredApp({
      RESEARCH_COCKPIT_MODE: "personal_readiness",
    }).catch((error: unknown) => error);
    const malformed = await createConfiguredApp({
      RESEARCH_COCKPIT_MODE: "personal_readiness",
      RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET: "private-canary",
    }).catch((error: unknown) => error);

    expect(missing).toMatchObject({
      code: "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED",
    });
    expect(malformed).toMatchObject({
      code: "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID",
    });
    expect(String(malformed)).not.toContain("private-canary");
  });
});

function freshSecret(): string {
  return randomBytes(32).toString("hex");
}
