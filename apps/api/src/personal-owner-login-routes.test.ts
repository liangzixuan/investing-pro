import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createPersonalOwnerAccountRecord,
  type PersonalOwnerAccountRecord,
} from "./personal-owner-account-credentials";
import {
  PersonalOwnerSessionAuthority,
  PERSONAL_OWNER_SESSION_COOKIE_NAME,
} from "./personal-owner-session";
import {
  PERSONAL_OWNER_SESSION_LOGIN_PATH,
  PERSONAL_OWNER_SESSION_LOGOUT_PATH,
  PERSONAL_OWNER_SESSION_PATH,
  registerPersonalOwnerSessionRoutes,
} from "./personal-owner-session-routes";

const username = "synthetic.owner";
const password = "A synthetic reusable passphrase";
const apps: FastifyInstance[] = [];
let record: PersonalOwnerAccountRecord;

beforeAll(async () => {
  record = await createPersonalOwnerAccountRecord(username, password);
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("normal owner sign-in route", () => {
  it("issues the existing private HttpOnly cookie and can sign in again after logout", async () => {
    const app = await accountApp();
    const first = await login(app);
    expect(first.statusCode).toBe(204);
    expect(first.payload).toBe("");
    expect(first.headers["cache-control"]).toBe("private, no-store");
    expect(first.headers["set-cookie"]).toMatch(
      /^research_cockpit_owner_session=[A-Za-z0-9_-]{43}; Path=\/v1\/personal-filing; HttpOnly; SameSite=Strict$/u,
    );
    const cookie = String(first.headers["set-cookie"]).split(";", 1)[0] ?? "";
    expect(
      (
        await app.inject({
          method: "GET",
          url: PERSONAL_OWNER_SESSION_PATH,
          headers: { ...headers(), cookie },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await app.inject({
          method: "POST",
          url: PERSONAL_OWNER_SESSION_LOGOUT_PATH,
          headers: {
            ...headers(),
            cookie,
            "x-research-cockpit-intent": "logout",
          },
        })
      ).statusCode,
    ).toBe(204);
    const again = await login(app, { cookie });
    expect(again.statusCode).toBe(204);
    expect(again.headers["set-cookie"]).not.toBe(first.headers["set-cookie"]);
  });

  it("uses identical generic failures for incorrect username and password", async () => {
    const app = await accountApp();
    const wrongUser = await login(
      app,
      {},
      { username: "someone.else", password },
    );
    const wrongPassword = await login(
      app,
      {},
      { username, password: "A different synthetic passphrase" },
    );
    for (const response of [wrongUser, wrongPassword]) {
      expect(response.statusCode).toBe(401);
      expect(response.headers["set-cookie"]).toBeUndefined();
      expect(response.headers["cache-control"]).toBe("private, no-store");
      expect(response.payload).not.toContain(username);
      expect(response.payload).not.toContain(password);
      expect(response.json<{ detail: string }>().detail).toBe(
        "The local owner-session request was not accepted.",
      );
    }
  });

  it("checks exact origin, host, intent, framing, and cookies before parsing credentials", async () => {
    let parsed = 0;
    const app = await accountApp((app) => {
      app.removeContentTypeParser("application/json");
      app.addContentTypeParser(
        "application/json",
        { parseAs: "string" },
        (_request, body, done) => {
          parsed += 1;
          try {
            done(null, JSON.parse(String(body)) as unknown);
          } catch {
            done(new Error("synthetic-parser-failure"));
          }
        },
      );
    });
    const malformed = '{"password":"must-not-be-echoed"';
    for (const extra of [
      { origin: "http://localhost:3000" },
      { host: "127.0.0.1:3200" },
      { "x-research-cockpit-intent": "bootstrap" },
      { "x-research-cockpit-intent": "" },
      { "x-research-cockpit-bootstrap": "a".repeat(64) },
      { "x-research-cockpit-idempotency-key": "unexpected" },
      { authorization: "Bearer must-not-be-echoed" },
      { forwarded: "for=127.0.0.1" },
      { "sec-fetch-site": "cross-site" },
      { "content-type": "text/plain" },
      { "content-encoding": "gzip" },
      { "if-match": '"unexpected"' },
      { cookie: `${PERSONAL_OWNER_SESSION_COOKIE_NAME}=malformed` },
      {
        cookie: `${PERSONAL_OWNER_SESSION_COOKIE_NAME}=${"a".repeat(43)}; ${PERSONAL_OWNER_SESSION_COOKIE_NAME}=${"b".repeat(43)}`,
      },
    ]) {
      const response = await login(app, extra, malformed);
      expect(response.statusCode).toBe(403);
      expect(response.payload).not.toContain("must-not-be-echoed");
      expect(parsed).toBe(0);
    }
    expect(
      (
        await app.inject({
          method: "POST",
          url: PERSONAL_OWNER_SESSION_LOGIN_PATH,
          headers: {
            ...headers(),
            "content-type": "application/json",
            "x-research-cockpit-intent": "login",
          },
          payload: malformed,
          remoteAddress: "192.0.2.1",
        })
      ).statusCode,
    ).toBe(403);
    expect(parsed).toBe(0);
    expect((await login(app, {}, malformed)).statusCode).toBe(403);
    expect(parsed).toBe(1);
  });

  it("rejects oversized and non-exact login bodies without returning their values", async () => {
    const app = await accountApp();
    for (const body of [
      { username, password, extra: "synthetic-private-value" },
      { username },
      { password },
      { username: 1, password },
      { username, password: null },
      [],
      null,
      { username, password: "synthetic-private-value".repeat(300) },
    ]) {
      const response = await login(app, {}, JSON.stringify(body));
      expect(response.statusCode).toBe(403);
      expect(response.payload).not.toContain("synthetic-private-value");
      expect(response.headers["set-cookie"]).toBeUndefined();
    }
  });

  it("returns bounded retry instructions for shared guessing limits and concurrent KDF work", async () => {
    const limited = await accountApp();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        (
          await login(
            limited,
            {},
            { username: `other${String(attempt)}`, password: "short" },
          )
        ).statusCode,
      ).toBe(401);
    }
    const blocked = await login(limited);
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(blocked.headers["retry-after"])).toBeLessThanOrEqual(60);
    expect(blocked.headers["cache-control"]).toBe("private, no-store");
    const concurrent = await accountApp();
    const responses = await Promise.all(
      Array.from({ length: 12 }, () => login(concurrent)),
    );
    expect(
      responses.filter((response) => response.statusCode === 204),
    ).toHaveLength(1);
    expect(
      responses.filter((response) => response.statusCode === 429),
    ).toHaveLength(11);
    for (const response of responses.filter(
      (value) => value.statusCode === 429,
    )) {
      expect(response.headers["retry-after"]).toBe("1");
    }
  });
});

async function accountApp(
  configure?: (app: FastifyInstance) => void,
): Promise<FastifyInstance> {
  const authority = PersonalOwnerSessionAuthority.createWithAccount(record);
  const app = Fastify({ logger: false, trustProxy: false });
  configure?.(app);
  app.addHook("onClose", () => {
    authority.close();
  });
  await registerPersonalOwnerSessionRoutes(app, authority, {
    host: "127.0.0.1",
    port: 3100,
  });
  apps.push(app);
  return app;
}

function headers(): Record<string, string> {
  return {
    accept: "application/json",
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
  };
}

function login(
  app: FastifyInstance,
  extraHeaders: Record<string, string> = {},
  payload: unknown = { username, password },
) {
  return app.inject({
    method: "POST",
    url: PERSONAL_OWNER_SESSION_LOGIN_PATH,
    headers: {
      ...headers(),
      "content-type": "application/json",
      "x-research-cockpit-intent": "login",
      ...extraHeaders,
    },
    payload: typeof payload === "string" ? payload : JSON.stringify(payload),
    remoteAddress: "127.0.0.1",
  });
}
