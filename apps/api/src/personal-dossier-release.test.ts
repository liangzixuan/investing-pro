import { randomBytes } from "node:crypto";
import { copyFile, readFile, rm, writeFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { buildPersonalDossierApp } from "./app";
import type { buildApp } from "./app";
import {
  captureLocalApiEnvironment,
  createConfiguredApp,
  LocalApiCompositionError,
} from "./composition-root";
import {
  getPersonalDossierResponse,
  loadPersonalDossierRelease,
  PersonalDossierReleaseError,
} from "./personal-dossier-release";
import {
  bootstrapTestPersonalOwnerSession,
  createTestPersonalOwnerSession,
} from "./test-personal-owner-session-builder";
import { createPublicPersonalDossierReleaseFixture } from "./test-personal-dossier-release-builder";

const directories: string[] = [];
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
const SOURCE_COMMIT = "3".repeat(40);

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
  await Promise.all(
    directories
      .splice(0)
      .map(async (path) => rm(path, { force: true, recursive: true })),
  );
});

describe("personal dossier release boundary", () => {
  it("consumes one fresh exact approval and retains one immutable closed graph", async () => {
    const fixture = await createPublicPersonalDossierReleaseFixture();
    directories.push(fixture.directory);
    await expect(readFile(fixture.approvalPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(fixture.consumedApprovalPath)).resolves.toBeDefined();

    const response = getPersonalDossierResponse(fixture.capability);
    expect(response).toMatchObject({
      dataMode: "personal",
      profile: "personal_single_user_local",
      schemaVersion: "1.0.0",
      status: "personal_dossier_released",
    });
    expect(response.facts).toHaveLength(20);
    expect(response.evidence).toHaveLength(20);
    expect(response.facts[0]).toMatchObject({
      knownFrom: "2026-02-20T20:00:01.000Z",
      knownToExclusive: "2026-03-15T20:00:01.000Z",
      version: "superseded",
    });
    expect(response.evidence[4]?.derivationOperands).toHaveLength(2);
    expect(
      response.evidence[4]?.derivationOperands.map(({ role }) => role),
    ).toEqual(["minuend", "subtrahend"]);
    expect(response.lineage.events).toHaveLength(10);
    expectDeepFrozen(response);
    expect(JSON.stringify(fixture.capability)).toBe("{}");
  });

  it("fails closed on replay, bundle mutation, cross-build use, and wrong action", async () => {
    const fixture = await createPublicPersonalDossierReleaseFixture();
    directories.push(fixture.directory);
    await expect(
      loadPersonalDossierRelease(fixture.environment, SOURCE_COMMIT),
    ).rejects.toBeInstanceOf(PersonalDossierReleaseError);

    await copyFile(fixture.consumedApprovalPath, fixture.approvalPath);
    const bundleBytes = await readFile(fixture.bundlePath);
    bundleBytes[0] = (bundleBytes[0] ?? 0) ^ 1;
    await writeFile(fixture.bundlePath, bundleBytes);
    await expect(
      loadPersonalDossierRelease(fixture.environment, SOURCE_COMMIT),
    ).rejects.toBeInstanceOf(PersonalDossierReleaseError);

    bundleBytes[0] = (bundleBytes[0] ?? 0) ^ 1;
    await writeFile(fixture.bundlePath, bundleBytes);
    await expect(
      loadPersonalDossierRelease(fixture.environment, "4".repeat(40)),
    ).rejects.toBeInstanceOf(PersonalDossierReleaseError);

    const approval = JSON.parse(
      await readFile(fixture.approvalPath, "utf8"),
    ) as Record<string, unknown>;
    approval.action = "APPROVE_EXACT_CYCLE2Z_PERSONAL_SELECTED_FACT_RELEASE";
    await writeFile(fixture.approvalPath, `${canonicalJson(approval)}\n`);
    await expect(
      loadPersonalDossierRelease(fixture.environment, SOURCE_COMMIT),
    ).rejects.toBeInstanceOf(PersonalDossierReleaseError);
  });

  it("does not decode or validate sealed document strings beyond the fixed manifest prefix", async () => {
    const baseline = await createPublicPersonalDossierReleaseFixture(
      SOURCE_COMMIT,
      true,
      { documentIndex: 0 },
    );
    directories.push(baseline.directory);
    const expected = getPersonalDossierResponse(baseline.capability);

    for (const options of [
      { rawDocumentSuffix: "not-base64***" },
      { sourceDocumentSuffix: "AB==" },
      { sourceDocumentSuffix: "A".repeat(174_768) },
    ]) {
      const fixture = await createPublicPersonalDossierReleaseFixture(
        SOURCE_COMMIT,
        true,
        { documentIndex: 0, ...options },
      );
      directories.push(fixture.directory);
      expect(getPersonalDossierResponse(fixture.capability)).toEqual(expected);
    }
  });

  it("serves only the authenticated atomic GET with private no-store headers", async () => {
    const fixture = await createPublicPersonalDossierReleaseFixture();
    directories.push(fixture.directory);
    const ownerSession = createTestPersonalOwnerSession();
    const app = await buildPersonalDossierApp(
      fixture.capability,
      ownerSession.authority,
    );
    apps.push(app);
    const cookie = await bootstrapTestPersonalOwnerSession(
      app,
      ownerSession.secret,
    );
    const headers = {
      accept: "application/json",
      cookie,
      host: "127.0.0.1:3100",
      origin: "http://127.0.0.1:3000",
    };
    const response = await app.inject({
      method: "GET",
      url: "/v1/personal-filing/dossier",
      remoteAddress: "127.0.0.1",
      headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.headers.vary).toBe("Origin");
    expect(response.headers.etag).toBeUndefined();
    expect(response.json()).toEqual(
      getPersonalDossierResponse(fixture.capability),
    );

    for (const request of [
      { method: "GET" as const, url: "/v1/personal-filing/dossier" },
      {
        method: "HEAD" as const,
        url: "/v1/personal-filing/dossier",
        headers,
      },
      {
        method: "POST" as const,
        url: "/v1/personal-filing/dossier",
        headers,
      },
      {
        method: "POST" as const,
        url: "/v1/personal-filing/dossier",
        headers: { ...headers, "content-type": "application/json" },
        payload: "{",
      },
      {
        method: "GET" as const,
        url: "/v1/personal-filing/dossier?oracle=1",
        headers,
      },
      {
        method: "GET" as const,
        url: "/v1/personal-filing/dossier",
        headers: { ...headers, forwarded: "for=127.0.0.1" },
      },
      {
        method: "GET" as const,
        url: "/v1/personal-filing/dossier",
        headers: { ...headers, authorization: "Bearer private-canary" },
      },
      {
        method: "GET" as const,
        url: "/v1/personal-filing/dossier",
        headers: { ...headers, "if-none-match": '"private-canary"' },
      },
      {
        method: "GET" as const,
        url: "/v1/personal-filing/dossier",
        headers,
        payload: "private-canary",
      },
    ]) {
      const denied = await app.inject({
        ...request,
        remoteAddress: "127.0.0.1",
        headers: request.headers ?? {
          accept: headers.accept,
          host: headers.host,
          origin: headers.origin,
        },
      });
      expect(denied.statusCode).not.toBe(200);
      expect(denied.payload).not.toContain("private-canary");
      expect(denied.headers["cache-control"]).toBe("private, no-store");
      expect(denied.headers.pragma).toBe("no-cache");
      expect(denied.headers.vary).toBe("Origin");
    }

    for (const request of [
      { method: "GET" as const, url: "/v1/instruments/SYN1/dossier" },
      { method: "GET" as const, url: "/v1/evidence/evidence-canary" },
      { method: "PUT" as const, url: "/v1/theses/thesis-canary" },
      { method: "PUT" as const, url: "/v1/alerts/alert-canary" },
      { method: "GET" as const, url: "/v1/personal-filing/readiness" },
      { method: "GET" as const, url: "/v1/personal-filing/selected-facts" },
    ]) {
      const unavailable = await app.inject({
        ...request,
        remoteAddress: "127.0.0.1",
        headers,
      });
      expect(unavailable.statusCode).toBe(404);
      expect(unavailable.headers["cache-control"]).toBe("private, no-store");
      expect(unavailable.headers.pragma).toBe("no-cache");
      expect(unavailable.headers.vary).toBe("Origin");
      expect(unavailable.headers.etag).toBeUndefined();
      expect(unavailable.headers["x-data-as-of"]).toBeUndefined();
      expect(unavailable.payload).not.toContain("synthetic");
    }

    const health = await app.inject({
      method: "GET",
      url: "/health/ready",
      remoteAddress: "127.0.0.1",
      headers,
    });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ready" });
    expect(health.headers["cache-control"]).toBe("private, no-store");
    expect(health.headers.pragma).toBe("no-cache");
    expect(health.headers.vary).toBe("Origin");
  });

  it("composes only in the exact dossier mode and scrubs private configuration", async () => {
    const fixture = await createPublicPersonalDossierReleaseFixture();
    directories.push(fixture.directory);
    await copyFile(fixture.consumedApprovalPath, fixture.approvalPath);
    await rm(fixture.consumedApprovalPath);
    const environment: Record<string, string | undefined> = {
      ...fixture.environment,
      RESEARCH_COCKPIT_MODE: "personal_dossier",
      RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET: freshSecret(),
    };
    const captured = captureLocalApiEnvironment(environment);
    expect(
      environment.PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH,
    ).toBeUndefined();
    expect(
      environment.PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256,
    ).toBeUndefined();
    expect(
      environment.PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH,
    ).toBeUndefined();
    const app = await createConfiguredApp(captured, SOURCE_COMMIT);
    apps.push(app);

    const wrongMode = await createConfiguredApp({
      RESEARCH_COCKPIT_MODE: "personal_readiness",
      PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH: "private-canary",
    }).catch((error: unknown) => error);
    expect(wrongMode).toBeInstanceOf(LocalApiCompositionError);
    expect(wrongMode).toMatchObject({
      code: "PERSONAL_CONFIGURATION_REQUIRES_DOSSIER_MODE",
    });
    expect(String(wrongMode)).not.toContain("private-canary");
  });
});

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, seen);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function freshSecret(): string {
  return randomBytes(32).toString("hex");
}
