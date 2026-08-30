import { rm } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  createConfiguredApp,
  LocalApiCompositionError,
} from "./composition-root";
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
    const app = await createConfiguredApp({
      ...fixture.environment,
      RESEARCH_COCKPIT_MODE: "personal_readiness",
    });
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
});
