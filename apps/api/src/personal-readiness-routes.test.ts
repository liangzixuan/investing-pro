import { rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";

import type { PersonalFilingReadinessDto } from "@research-cockpit/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { buildPersonalReadinessApp } from "./app";
import { PERSONAL_FILING_READINESS_PATH } from "./personal-readiness-routes";
import {
  bootstrapLiveTestPersonalOwnerSession,
  bootstrapTestPersonalOwnerSession,
  createTestPersonalOwnerSession,
} from "./test-personal-owner-session-builder";
import { createPublicPersonalQualityReadinessFixture } from "./test-personal-quality-readiness-builder";

const apps: Awaited<ReturnType<typeof buildPersonalReadinessApp>>[] = [];
const directories: string[] = [];
const sessionCookies = new WeakMap<
  Awaited<ReturnType<typeof buildPersonalReadinessApp>>,
  string
>();

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

describe("personal filing readiness route", () => {
  it("returns only the fixed value-free readiness DTO", async () => {
    const app = await readyApp();
    const response = await allowedRequest(app);

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.headers.etag).toBeUndefined();
    expect(response.headers["x-data-as-of"]).toBeUndefined();
    expect(response.headers["x-trace-id"]).toMatch(/^trace-/u);
    const body = response.json<PersonalFilingReadinessDto>();
    expect(body).toEqual({
      schemaVersion: "1.0.0",
      profile: "personal_single_user_local",
      status: "quality_gate_ready",
      dataPlane: "disabled",
    });
    expect(Object.keys(body)).toEqual([
      "schemaVersion",
      "profile",
      "status",
      "dataPlane",
    ]);
    for (const forbidden of [
      "count",
      "metric",
      "hash",
      "path",
      "reference",
      "approval",
      "fact",
      "value",
    ]) {
      expect(response.payload.toLowerCase()).not.toContain(forbidden);
    }
    const health = await app.inject({ method: "GET", url: "/health/live" });
    expect(health.json()).toEqual({ status: "alive" });
    expect(health.payload).not.toContain("personal_readiness");
  });

  it("serves one immutable snapshot under concurrent reads", async () => {
    const app = await readyApp();
    const responses = await Promise.all(
      Array.from({ length: 24 }, async () => allowedRequest(app)),
    );
    expect(responses.every((response) => response.statusCode === 200)).toBe(
      true,
    );
    expect(new Set(responses.map((response) => response.payload)).size).toBe(1);
  });

  it.each([
    ["missing session", { cookie: undefined }],
    ["nonloopback peer", { remoteAddress: "192.0.2.1" }],
    ["missing origin", { origin: undefined }],
    ["untrusted origin", { origin: "https://untrusted.example" }],
    ["nonliteral host", { host: "localhost:3100" }],
    ["wrong loopback port", { host: "127.0.0.1:65535" }],
    ["forwarded identity", { forwarded: "for=127.0.0.1" }],
    ["unexpected accept", { accept: "text/html" }],
    ["request body framing", { contentLength: "0" }],
  ] as const)(
    "rejects %s with one value-free response",
    async (_label, change) => {
      const app = await readyApp();
      const headers = allowedHeaders(requireSessionCookie(app));
      if ("cookie" in change && change.cookie === undefined) {
        delete headers.cookie;
      }
      if ("origin" in change) {
        if (change.origin === undefined) delete headers.origin;
        else headers.origin = change.origin;
      }
      if ("host" in change) headers.host = change.host;
      if ("forwarded" in change) headers.forwarded = change.forwarded;
      if ("accept" in change) headers.accept = change.accept;
      if ("contentLength" in change)
        headers["content-length"] = change.contentLength;
      const response = await app.inject({
        method: "GET",
        url: PERSONAL_FILING_READINESS_PATH,
        headers,
        remoteAddress:
          "remoteAddress" in change ? change.remoteAddress : "127.0.0.1",
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      expect(response.headers.pragma).toBe("no-cache");
      expect(response.payload).toContain("local readiness request");
      expect(response.payload).not.toContain("untrusted.example");
      expect(response.payload).not.toContain("192.0.2.1");
    },
  );

  it("rejects queries, unexpected methods, and forged capabilities", async () => {
    const app = await readyApp();
    const headers = allowedHeaders(requireSessionCookie(app));
    const query = await app.inject({
      method: "GET",
      url: `${PERSONAL_FILING_READINESS_PATH}?private=canary`,
      headers,
      remoteAddress: "127.0.0.1",
    });
    const method = await app.inject({
      method: "POST",
      url: PERSONAL_FILING_READINESS_PATH,
      headers,
      remoteAddress: "127.0.0.1",
    });
    const head = await app.inject({
      method: "HEAD",
      url: PERSONAL_FILING_READINESS_PATH,
      headers,
      remoteAddress: "127.0.0.1",
    });

    expect(query.statusCode).toBe(403);
    expect(query.payload).not.toContain("private=canary");
    expect(method.statusCode).toBe(404);
    expect(head.statusCode).toBe(404);
    const ownerSession = createTestPersonalOwnerSession();
    await expect(
      buildPersonalReadinessApp(
        Object.freeze({}) as Parameters<typeof buildPersonalReadinessApp>[0],
        ownerSession.authority,
      ),
    ).rejects.toThrow("Personal filing readiness is unavailable.");
    ownerSession.authority.close();
  });

  it("binds Host to the actual listening authority", async () => {
    const fixture = await createPublicPersonalQualityReadinessFixture();
    directories.push(fixture.directory);
    const ownerSession = createTestPersonalOwnerSession();
    const app = await buildPersonalReadinessApp(
      fixture.capability,
      ownerSession.authority,
      { host: "127.0.0.1", port: 0 },
    );
    apps.push(app);
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected an IP socket address.");
    }
    const url = `http://127.0.0.1:${String(address.port)}${PERSONAL_FILING_READINESS_PATH}`;
    const cookie = await bootstrapLiveTestPersonalOwnerSession(
      `http://127.0.0.1:${String(address.port)}`,
      ownerSession.secret,
    );
    const valid = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        Cookie: cookie,
        Origin: "http://127.0.0.1:3000",
      },
    });
    const spoofedStatus = await requestStatus(url, "127.0.0.1:65535");

    expect(valid.status).toBe(200);
    await expect(valid.json()).resolves.toMatchObject({
      status: "quality_gate_ready",
      dataPlane: "disabled",
    });
    expect(spoofedStatus).toBe(403);
  });

  it("supports the exact IPv6 loopback browser authority", async () => {
    const fixture = await createPublicPersonalQualityReadinessFixture();
    directories.push(fixture.directory);
    const ownerSession = createTestPersonalOwnerSession();
    const app = await buildPersonalReadinessApp(
      fixture.capability,
      ownerSession.authority,
      { host: "::1", port: 3100 },
    );
    apps.push(app);
    const cookie = await bootstrapTestPersonalOwnerSession(
      app,
      ownerSession.secret,
      "[::1]:3100",
      "http://[::1]:3000",
    );
    const response = await app.inject({
      method: "GET",
      url: PERSONAL_FILING_READINESS_PATH,
      headers: {
        accept: "application/json",
        cookie,
        host: "[::1]:3100",
        origin: "http://[::1]:3000",
      },
      remoteAddress: "::1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://[::1]:3000",
    );
  });
});

async function readyApp(): Promise<
  Awaited<ReturnType<typeof buildPersonalReadinessApp>>
> {
  const fixture = await createPublicPersonalQualityReadinessFixture();
  directories.push(fixture.directory);
  const ownerSession = createTestPersonalOwnerSession();
  const app = await buildPersonalReadinessApp(
    fixture.capability,
    ownerSession.authority,
  );
  apps.push(app);
  sessionCookies.set(
    app,
    await bootstrapTestPersonalOwnerSession(app, ownerSession.secret),
  );
  return app;
}

function allowedRequest(
  app: Awaited<ReturnType<typeof buildPersonalReadinessApp>>,
) {
  return app.inject({
    method: "GET",
    url: PERSONAL_FILING_READINESS_PATH,
    headers: allowedHeaders(requireSessionCookie(app)),
    remoteAddress: "127.0.0.1",
  });
}

function allowedHeaders(cookie: string): Record<string, string> {
  return {
    accept: "application/json",
    cookie,
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
  };
}

function requireSessionCookie(
  app: Awaited<ReturnType<typeof buildPersonalReadinessApp>>,
): string {
  const cookie = sessionCookies.get(app);
  if (cookie === undefined) throw new Error("Expected an owner session.");
  return cookie;
}

function requestStatus(url: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      url,
      {
        headers: {
          Accept: "application/json",
          Host: host,
          Origin: "http://127.0.0.1:3000",
        },
      },
      (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode ?? 0));
      },
    );
    request.once("error", reject);
    request.end();
  });
}
