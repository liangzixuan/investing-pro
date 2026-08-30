import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import type * as FileSystemPromises from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

const linkControl = vi.hoisted(() => ({
  createTargetBeforeLink: false,
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof FileSystemPromises>();
  return {
    ...actual,
    async link(existingPath: string, newPath: string) {
      if (linkControl.createTargetBeforeLink) {
        linkControl.createTargetBeforeLink = false;
        await actual.writeFile(newPath, "public-race-sentinel\n");
      }
      return actual.link(existingPath, newPath);
    },
  };
});

import { buildPersonalFactReleaseApp } from "./app";
import type { buildApp } from "./app";
import {
  createConfiguredApp,
  LocalApiCompositionError,
} from "./composition-root";
import {
  getPersonalSelectedFactReleaseResponse,
  loadPersonalSelectedFactRelease,
  PersonalSelectedFactReleaseError,
} from "./personal-selected-fact-release";
import { createPublicPersonalSelectedFactReleaseFixture } from "./test-personal-selected-fact-release-builder";

const directories: string[] = [];
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  linkControl.createTargetBeforeLink = false;
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
  await Promise.all(
    directories
      .splice(0)
      .map(async (path) => rm(path, { force: true, recursive: true })),
  );
});

describe("personal selected-fact release boundary", () => {
  it("consumes one exact approval and retains only an immutable projection", async () => {
    const fixture = await createPublicPersonalSelectedFactReleaseFixture();
    directories.push(fixture.directory);
    await expect(readFile(fixture.approvalPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(fixture.consumedApprovalPath)).resolves.toBeDefined();

    const response = getPersonalSelectedFactReleaseResponse(fixture.capability);
    expect(response.status).toBe("selected_facts_released");
    expect(response.facts).toHaveLength(2);
    expect(Object.isFrozen(response)).toBe(true);
    expect(Object.isFrozen(response.facts)).toBe(true);
    expect(response.facts.every(Object.isFrozen)).toBe(true);
    expect(JSON.stringify(fixture.capability)).toBe("{}");
  });

  it("fails closed on replay, bundle mutation, and cross-bound source commit", async () => {
    const fixture = await createPublicPersonalSelectedFactReleaseFixture();
    directories.push(fixture.directory);
    await expect(
      loadPersonalSelectedFactRelease(fixture.environment, "1".repeat(40)),
    ).rejects.toBeInstanceOf(PersonalSelectedFactReleaseError);

    await copyFile(fixture.consumedApprovalPath, fixture.approvalPath);
    const bundleBytes = await readFile(fixture.bundlePath);
    bundleBytes[0] = (bundleBytes[0] ?? 0) ^ 1;
    await writeFile(fixture.bundlePath, bundleBytes);
    await expect(
      loadPersonalSelectedFactRelease(fixture.environment, "1".repeat(40)),
    ).rejects.toBeInstanceOf(PersonalSelectedFactReleaseError);

    bundleBytes[0] = (bundleBytes[0] ?? 0) ^ 1;
    await writeFile(fixture.bundlePath, bundleBytes);
    const approval = JSON.parse(
      await readFile(fixture.approvalPath, "utf8"),
    ) as Record<string, unknown>;
    approval.sourceCommit = "2".repeat(40);
    await writeFile(fixture.approvalPath, `${canonicalJson(approval)}\n`);
    await expect(
      loadPersonalSelectedFactRelease(fixture.environment, "1".repeat(40)),
    ).rejects.toBeInstanceOf(PersonalSelectedFactReleaseError);
  });

  it("rejects a bundle and approval consistently bound to another build", async () => {
    const fixture = await createPublicPersonalSelectedFactReleaseFixture();
    directories.push(fixture.directory);
    await copyFile(fixture.consumedApprovalPath, fixture.approvalPath);
    await rm(fixture.consumedApprovalPath);

    await expect(
      loadPersonalSelectedFactRelease(fixture.environment, "2".repeat(40)),
    ).rejects.toBeInstanceOf(PersonalSelectedFactReleaseError);
    await expect(readFile(fixture.approvalPath)).resolves.toBeDefined();
    await expect(readFile(fixture.consumedApprovalPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("never replaces a preexisting consumed target", async () => {
    const fixture = await createPublicPersonalSelectedFactReleaseFixture();
    directories.push(fixture.directory);
    const sentinel = await readFile(fixture.consumedApprovalPath);
    await copyFile(fixture.consumedApprovalPath, fixture.approvalPath);

    await expect(
      loadPersonalSelectedFactRelease(fixture.environment, "1".repeat(40)),
    ).rejects.toBeInstanceOf(PersonalSelectedFactReleaseError);
    await expect(readFile(fixture.consumedApprovalPath)).resolves.toEqual(
      sentinel,
    );
    await expect(readFile(fixture.approvalPath)).resolves.toEqual(sentinel);
  });

  it("fails closed when the consumed target is created at the link point", async () => {
    const fixture = await createPublicPersonalSelectedFactReleaseFixture();
    directories.push(fixture.directory);
    const approval = await readFile(fixture.consumedApprovalPath);
    await rm(fixture.consumedApprovalPath);
    await writeFile(fixture.approvalPath, approval);
    linkControl.createTargetBeforeLink = true;

    await expect(
      loadPersonalSelectedFactRelease(fixture.environment, "1".repeat(40)),
    ).rejects.toBeInstanceOf(PersonalSelectedFactReleaseError);
    await expect(readFile(fixture.consumedApprovalPath, "utf8")).resolves.toBe(
      "public-race-sentinel\n",
    );
    await expect(readFile(fixture.approvalPath)).resolves.toEqual(approval);
  });

  it("serves only the guarded GET with private noncacheable responses", async () => {
    const fixture = await createPublicPersonalSelectedFactReleaseFixture();
    directories.push(fixture.directory);
    const app = await buildPersonalFactReleaseApp(fixture.capability);
    apps.push(app);
    const headers = {
      accept: "application/json",
      host: "127.0.0.1:3100",
      origin: "http://127.0.0.1:3000",
    };
    const response = await app.inject({
      method: "GET",
      url: "/v1/personal-filing/selected-facts",
      remoteAddress: "127.0.0.1",
      headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.headers.vary).toBe("Origin");
    expect(response.headers.etag).toBeUndefined();
    expect(response.json()).toEqual(
      getPersonalSelectedFactReleaseResponse(fixture.capability),
    );

    for (const request of [
      { method: "HEAD" as const, url: "/v1/personal-filing/selected-facts" },
      {
        method: "GET" as const,
        url: "/v1/personal-filing/selected-facts?oracle=1",
      },
      {
        method: "GET" as const,
        url: "/v1/personal-filing/selected-facts",
        headers: { ...headers, forwarded: "for=127.0.0.1" },
      },
      {
        method: "GET" as const,
        url: "/v1/personal-filing/selected-facts",
        headers: { ...headers, authorization: "Bearer private-canary" },
      },
      {
        method: "GET" as const,
        url: "/v1/personal-filing/selected-facts",
        headers: { ...headers, cookie: "session=private-canary" },
      },
      {
        method: "GET" as const,
        url: "/v1/personal-filing/selected-facts",
        headers: { ...headers, "if-none-match": '"private-canary"' },
      },
    ]) {
      const denied = await app.inject({
        ...request,
        remoteAddress: "127.0.0.1",
        headers: request.headers ?? headers,
      });
      expect(denied.statusCode).not.toBe(200);
      expect(denied.payload).not.toContain("private-canary");
    }

    const readiness = await app.inject({
      method: "GET",
      url: "/v1/personal-filing/readiness",
      remoteAddress: "127.0.0.1",
      headers,
    });
    expect(readiness.statusCode).toBe(404);
  });

  it("requires the exact explicit fact mode and a complete five-field configuration", async () => {
    const partial = await createConfiguredApp({
      RESEARCH_COCKPIT_MODE: "personal_fact_release",
      PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH: "private-canary",
    }).catch((error: unknown) => error);
    const wrongMode = await createConfiguredApp({
      RESEARCH_COCKPIT_MODE: "personal_readiness",
      PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH: "private-canary",
    }).catch((error: unknown) => error);
    expect(partial).toBeInstanceOf(PersonalSelectedFactReleaseError);
    expect(wrongMode).toBeInstanceOf(LocalApiCompositionError);
    expect(wrongMode).toMatchObject({
      code: "PERSONAL_CONFIGURATION_REQUIRES_FACT_RELEASE_MODE",
    });
    expect(String(partial)).not.toContain("private-canary");
    expect(String(wrongMode)).not.toContain("private-canary");
  });
});

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
