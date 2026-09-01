import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp, buildPersonalReadinessApp } from "./app";
import {
  PersonalOwnerSessionAuthority,
  PERSONAL_OWNER_SESSION_COOKIE_NAME,
} from "./personal-owner-session";
import {
  PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
  PERSONAL_OWNER_SESSION_BOOTSTRAP_PATH,
  PERSONAL_OWNER_SESSION_LOGOUT_PATH,
  PERSONAL_OWNER_SESSION_PATH,
  PERSONAL_OWNER_SESSION_REVOKE_PATH,
  PERSONAL_OWNER_SESSION_ROTATE_PATH,
} from "./personal-owner-session-routes";
import { PERSONAL_FILING_READINESS_PATH } from "./personal-readiness-routes";
import { createPublicPersonalQualityReadinessFixture } from "./test-personal-quality-readiness-builder";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
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

describe("personal owner-session routes", () => {
  it("bootstraps once into a host-only nonpersistent HttpOnly cookie", async () => {
    const { app, secret } = await personalApp();
    const response = await bootstrap(app, secret);

    expect(response.statusCode).toBe(204);
    expect(response.payload).toBe("");
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.headers.vary).toContain("Origin");
    const serialized = singleSetCookie(response.headers["set-cookie"]);
    expect(serialized).toMatch(
      new RegExp(
        `^${PERSONAL_OWNER_SESSION_COOKIE_NAME}=[A-Za-z0-9_-]{43}; Path=/v1/personal-filing; HttpOnly; SameSite=Strict$`,
        "u",
      ),
    );
    expect(serialized).not.toMatch(/Domain|Expires|Max-Age/iu);
    expect(serialized).not.toContain(secret);
    expect(response.payload).not.toContain(secret);

    const cookie = serialized.split(";", 1)[0];
    if (cookie === undefined) throw new Error("Expected a session cookie.");
    await expectActive(app, cookie);

    const replay = await bootstrap(app, secret);
    expect(replay.statusCode).toBe(403);
    expect(replay.payload).not.toContain(secret);
  });

  it("allows exactly one concurrent bootstrap winner", async () => {
    const { app, secret } = await personalApp();
    const responses = await Promise.all(
      Array.from({ length: 20 }, async () => bootstrap(app, secret)),
    );

    expect(
      responses.filter((response) => response.statusCode === 204),
    ).toHaveLength(1);
    expect(
      responses.filter((response) => response.statusCode === 403),
    ).toHaveLength(19);
    expect(
      responses.every((response) => !response.payload.includes(secret)),
    ).toBe(true);
  });

  it("rotates, logs out, and explicitly revokes without accepting stale cookies", async () => {
    const first = await personalApp();
    const firstCookie = cookieFrom(await bootstrap(first.app, first.secret));
    const rotated = await mutate(
      first.app,
      PERSONAL_OWNER_SESSION_ROTATE_PATH,
      "rotate",
      firstCookie,
    );
    expect(rotated.statusCode).toBe(204);
    const replacement = cookieFrom(rotated);
    expect(replacement).not.toBe(firstCookie);
    expect((await status(first.app, firstCookie)).statusCode).toBe(403);
    await expectActive(first.app, replacement);

    const logout = await mutate(
      first.app,
      PERSONAL_OWNER_SESSION_LOGOUT_PATH,
      "logout",
      replacement,
    );
    expect(logout.statusCode).toBe(204);
    expect(singleSetCookie(logout.headers["set-cookie"])).toBe(
      `${PERSONAL_OWNER_SESSION_COOKIE_NAME}=; Path=/v1/personal-filing; HttpOnly; SameSite=Strict; Max-Age=0`,
    );
    expect((await status(first.app, replacement)).statusCode).toBe(403);

    const second = await personalApp();
    const revocable = cookieFrom(await bootstrap(second.app, second.secret));
    const revoked = await mutate(
      second.app,
      PERSONAL_OWNER_SESSION_REVOKE_PATH,
      "revoke",
      revocable,
    );
    expect(revoked.statusCode).toBe(204);
    expect((await status(second.app, revocable)).statusCode).toBe(403);
  });

  it.each([
    ["missing cookie", {}],
    [
      "malformed cookie",
      { cookie: `${PERSONAL_OWNER_SESSION_COOKIE_NAME}=private-canary` },
    ],
    [
      "duplicate cookie",
      {
        cookie: `${PERSONAL_OWNER_SESSION_COOKIE_NAME}=${"a".repeat(43)}; ${PERSONAL_OWNER_SESSION_COOKIE_NAME}=${"b".repeat(43)}`,
      },
    ],
    ["wrong browser site", { origin: "http://localhost:3000" }],
    ["untrusted origin", { origin: "https://untrusted.example" }],
    ["wrong API authority", { host: "127.0.0.1:65535" }],
    ["forwarded identity", { forwarded: "for=127.0.0.1" }],
    ["cross-site fetch", { secFetchSite: "cross-site" }],
  ] as const)(
    "rejects %s without reflecting authority",
    async (_label, change) => {
      const { app, secret } = await personalApp();
      const validCookie = cookieFrom(await bootstrap(app, secret));
      const headers: Record<string, string> = allowedHeaders(
        "cookie" in change ? change.cookie : validCookie,
      );
      if ("origin" in change) headers.origin = change.origin;
      if ("host" in change) headers.host = change.host;
      if ("forwarded" in change) headers.forwarded = change.forwarded;
      if ("secFetchSite" in change)
        headers["sec-fetch-site"] = change.secFetchSite;
      if (!("cookie" in change) && _label === "missing cookie") {
        delete headers.cookie;
      }

      const response = await app.inject({
        method: "GET",
        url: PERSONAL_OWNER_SESSION_PATH,
        headers,
        remoteAddress: "127.0.0.1",
      });

      expect(response.statusCode).toBe(403);
      for (const canary of [
        "private-canary",
        "localhost:3000",
        "untrusted.example",
        "127.0.0.1:65535",
      ]) {
        expect(response.payload).not.toContain(canary);
      }
    },
  );

  it("requires the exact route-specific CSRF intent and an empty request body", async () => {
    const { app, secret } = await personalApp();
    const cookie = cookieFrom(await bootstrap(app, secret));
    const missingIntent = await app.inject({
      method: "POST",
      url: PERSONAL_OWNER_SESSION_ROTATE_PATH,
      headers: allowedHeaders(cookie),
      remoteAddress: "127.0.0.1",
    });
    const wrongIntent = await mutate(
      app,
      PERSONAL_OWNER_SESSION_ROTATE_PATH,
      "logout",
      cookie,
    );
    const body = await app.inject({
      method: "POST",
      url: PERSONAL_OWNER_SESSION_ROTATE_PATH,
      headers: {
        ...allowedHeaders(cookie),
        "content-type": "application/json",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "rotate",
      },
      payload: { private: "canary" },
      remoteAddress: "127.0.0.1",
    });

    for (const response of [missingIntent, wrongIntent, body]) {
      expect(response.statusCode).toBe(403);
      expect(response.payload).not.toContain("canary");
    }
    await expectActive(app, cookie);
  });

  it("enables credentialed CORS only for the exact same-site personal browser", async () => {
    const { app } = await personalApp();
    const allowed = await app.inject({
      method: "OPTIONS",
      url: PERSONAL_OWNER_SESSION_BOOTSTRAP_PATH,
      headers: {
        origin: "http://127.0.0.1:3000",
        "access-control-request-method": "POST",
        "access-control-request-headers":
          "x-research-cockpit-bootstrap,x-research-cockpit-intent",
      },
    });
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "http://127.0.0.1:3000",
    );
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
    expect(allowed.headers["access-control-allow-methods"]).toContain("POST");
    expect(allowed.headers["access-control-allow-headers"]).toContain(
      PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME,
    );
    expect(allowed.headers["access-control-allow-headers"]).toContain(
      PERSONAL_OWNER_INTENT_HEADER_NAME,
    );

    const rejected = await app.inject({
      method: "OPTIONS",
      url: PERSONAL_OWNER_SESSION_BOOTSTRAP_PATH,
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "POST",
      },
    });
    expect(rejected.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it.each([
    {
      label: "IPv4",
      listenOptions: { host: "127.0.0.1" as const, port: 80 },
      host: "127.0.0.1",
      origin: "http://127.0.0.1:3000",
      remoteAddress: "127.0.0.1",
    },
    {
      label: "IPv6",
      listenOptions: { host: "::1" as const, port: 80 },
      host: "[::1]",
      origin: "http://[::1]:3000",
      remoteAddress: "::1",
    },
  ])(
    "accepts the canonical default-port Host for $label personal mode",
    async ({ host, listenOptions, origin, remoteAddress }) => {
      const fixture = await createPublicPersonalQualityReadinessFixture();
      directories.push(fixture.directory);
      const secret = randomBytes(32).toString("hex");
      const authority = PersonalOwnerSessionAuthority.create(secret);
      const app = await buildPersonalReadinessApp(
        fixture.capability,
        authority,
        listenOptions,
      );
      apps.push(app);

      const bootstrapResponse = await app.inject({
        method: "POST",
        url: PERSONAL_OWNER_SESSION_BOOTSTRAP_PATH,
        headers: {
          accept: "application/json",
          host,
          origin,
          [PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME]: secret,
          [PERSONAL_OWNER_INTENT_HEADER_NAME]: "bootstrap",
        },
        remoteAddress,
      });
      expect(bootstrapResponse.statusCode).toBe(204);
      const cookie = cookieFrom(bootstrapResponse);

      const statusResponse = await app.inject({
        method: "GET",
        url: PERSONAL_OWNER_SESSION_PATH,
        headers: { accept: "application/json", cookie, host, origin },
        remoteAddress,
      });
      expect(statusResponse.statusCode).toBe(204);

      const readinessResponse = await app.inject({
        method: "GET",
        url: PERSONAL_FILING_READINESS_PATH,
        headers: { accept: "application/json", cookie, host, origin },
        remoteAddress,
      });
      expect(readinessResponse.statusCode).toBe(200);
    },
  );

  it("invalidates a cookie on process close and leaves synthetic startup unchanged", async () => {
    const first = await personalApp();
    const staleCookie = cookieFrom(await bootstrap(first.app, first.secret));
    await first.app.close();
    apps.splice(apps.indexOf(first.app), 1);

    const second = await personalApp();
    expect((await status(second.app, staleCookie)).statusCode).toBe(403);
    const replaced = await bootstrap(second.app, second.secret, staleCookie);
    expect(replaced.statusCode).toBe(204);
    expect(cookieFrom(replaced)).not.toBe(staleCookie);

    const synthetic = await buildApp();
    apps.push(synthetic);
    const session = await synthetic.inject({
      method: "GET",
      url: PERSONAL_OWNER_SESSION_PATH,
      headers: allowedHeaders(staleCookie),
      remoteAddress: "127.0.0.1",
    });
    expect(session.statusCode).toBe(404);
  });

  it("rejects an expired session before the personal route returns private state", async () => {
    let now = 0;
    const secret = randomBytes(32).toString("hex");
    const fixture = await createPublicPersonalQualityReadinessFixture();
    directories.push(fixture.directory);
    const authority = PersonalOwnerSessionAuthority.create(secret, {
      absoluteTtlMs: 100,
      idleTtlMs: 10,
      now: () => now,
    });
    const app = await buildPersonalReadinessApp(fixture.capability, authority);
    apps.push(app);
    const cookie = cookieFrom(await bootstrap(app, secret));

    now = 9;
    expect((await readiness(app, cookie)).statusCode).toBe(200);
    now = 19;
    const expired = await readiness(app, cookie);
    expect(expired.statusCode).toBe(403);
    expect(expired.payload).not.toContain("quality_gate_ready");
  });
});

async function personalApp() {
  const fixture = await createPublicPersonalQualityReadinessFixture();
  directories.push(fixture.directory);
  const secret = randomBytes(32).toString("hex");
  const authority = PersonalOwnerSessionAuthority.create(secret);
  const app = await buildPersonalReadinessApp(fixture.capability, authority);
  apps.push(app);
  return { app, secret };
}

function bootstrap(
  app: Awaited<ReturnType<typeof buildApp>>,
  secret: string,
  staleCookie?: string,
) {
  return app.inject({
    method: "POST",
    url: PERSONAL_OWNER_SESSION_BOOTSTRAP_PATH,
    headers: {
      ...allowedHeaders(staleCookie),
      [PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME]: secret,
      [PERSONAL_OWNER_INTENT_HEADER_NAME]: "bootstrap",
    },
    remoteAddress: "127.0.0.1",
  });
}

function mutate(
  app: Awaited<ReturnType<typeof buildApp>>,
  path: string,
  intent: string,
  cookie: string,
) {
  return app.inject({
    method: "POST",
    url: path,
    headers: {
      ...allowedHeaders(cookie),
      [PERSONAL_OWNER_INTENT_HEADER_NAME]: intent,
    },
    remoteAddress: "127.0.0.1",
  });
}

function status(app: Awaited<ReturnType<typeof buildApp>>, cookie: string) {
  return app.inject({
    method: "GET",
    url: PERSONAL_OWNER_SESSION_PATH,
    headers: allowedHeaders(cookie),
    remoteAddress: "127.0.0.1",
  });
}

function readiness(app: Awaited<ReturnType<typeof buildApp>>, cookie: string) {
  return app.inject({
    method: "GET",
    url: PERSONAL_FILING_READINESS_PATH,
    headers: allowedHeaders(cookie),
    remoteAddress: "127.0.0.1",
  });
}

async function expectActive(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookie: string,
): Promise<void> {
  const response = await status(app, cookie);
  expect(response.statusCode).toBe(204);
  expect(response.payload).toBe("");
}

function allowedHeaders(cookie?: string): Record<string, string> {
  return {
    accept: "application/json",
    ...(cookie === undefined ? {} : { cookie }),
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
  };
}

function cookieFrom(
  response: Awaited<ReturnType<Awaited<ReturnType<typeof buildApp>>["inject"]>>,
): string {
  expect(response.statusCode).toBe(204);
  const serialized = singleSetCookie(response.headers["set-cookie"]);
  const cookie = serialized.split(";", 1)[0];
  if (cookie === undefined) throw new Error("Expected a session cookie.");
  return cookie;
}

function singleSetCookie(value: string | string[] | undefined): string {
  const serialized = Array.isArray(value) ? value[0] : value;
  if (serialized === undefined) throw new Error("Expected Set-Cookie.");
  return serialized;
}
