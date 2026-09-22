import { randomUUID } from "node:crypto";

import type { PersonalFilingMonitorDto } from "@research-cockpit/contracts";
import { LocalResearchVaultError } from "@research-cockpit/local-research-vault";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PersonalFilingMonitorError,
  type PersonalFilingMonitor,
} from "./personal-filing-monitor";
import { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import { registerPersonalOwnerSessionRoutes } from "./personal-owner-session-routes";
import {
  bootstrapTestPersonalOwnerSession,
  createTestPersonalOwnerSession,
} from "./test-personal-owner-session-builder";
import {
  PERSONAL_FILING_MONITOR_PATH as PATH,
  registerPersonalWorkspaceFilingMonitorRoutes,
} from "./workspace-filing-monitor-routes";

const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
const policy = {
  enabled: true,
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
  watchlistVersion: 1,
  listingIds: ["lst-00000"],
  dailyTime: "09:00",
  timeZone: "America/Chicago",
  quietHours: true,
  desktopNotifications: true,
};
const empty: PersonalFilingMonitorDto = {
  schemaVersion: "1.0.0",
  version: 0,
  policy: null,
  bindingStatus: "unconfigured",
  running: false,
  nextCheckAt: null,
  lastCheckAt: null,
  lastOutcome: null,
  coverageGap: false,
  issuers: [],
  inbox: [],
  unreadCount: 0,
};
async function fixture(localAccess = false) {
  const app = Fastify(),
    owner = localAccess
      ? {
          authority: PersonalOwnerSessionAuthority.createForLocalAccess(),
          secret: "",
        }
      : createTestPersonalOwnerSession();
  apps.push(app);
  app.addHook("onClose", () => owner.authority.close());
  await registerPersonalOwnerSessionRoutes(app, owner.authority, {
    host: "127.0.0.1",
    port: 3100,
  });
  const monitor = {
    get: vi.fn(() => empty),
    configure: vi.fn(() => ({ ...empty, version: 2 })),
    pause: vi.fn(() => ({ ...empty, version: 3 })),
    acknowledge: vi.fn(() => ({ ...empty, version: 4 })),
    reset: vi.fn(() => ({ ...empty, version: 4 })),
    start: vi.fn(),
    tick: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  } satisfies PersonalFilingMonitor;
  registerPersonalWorkspaceFilingMonitorRoutes(app, monitor, owner.authority, {
    host: "127.0.0.1",
    port: 3100,
  });
  const cookie = localAccess
    ? ""
    : await bootstrapTestPersonalOwnerSession(app, owner.secret);
  return { app, monitor, cookie };
}
function headers(cookie?: string) {
  return {
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
    accept: "application/json",
    ...(cookie ? { cookie } : {}),
  };
}
function mutation(cookie: string, version: number) {
  return {
    ...headers(cookie),
    "content-type": "application/json",
    "x-research-cockpit-intent":
      version === 0 ? "personal-vault-create" : "personal-vault-update",
    "x-research-cockpit-idempotency-key": randomUUID(),
    ...(version === 0
      ? { "if-none-match": "*" }
      : { "if-match": `"v${version}"` }),
  };
}

describe("authenticated filing monitor routes", () => {
  it("authenticates before parsing mutations or reading saved state", async () => {
    const f = await fixture();
    for (const suffix of ["", "/pause", "/reset", "/acknowledge"]) {
      const response = await f.app.inject({
        method: "POST",
        url: PATH + suffix,
        headers: {
          ...mutation(f.cookie, suffix ? 1 : 0),
          cookie: "",
          "content-type": "application/json",
        },
        payload: "{secret-canary",
      });
      expect(response.statusCode).toBe(403);
      expect(response.payload).not.toContain("secret-canary");
    }
    const read = await f.app.inject({
      method: "GET",
      url: PATH,
      headers: headers(),
    });
    expect(read.statusCode).toBe(403);
    expect(f.monitor.get).not.toHaveBeenCalled();
    expect(f.monitor.configure).not.toHaveBeenCalled();
    expect(f.monitor.pause).not.toHaveBeenCalled();
    expect(f.monitor.acknowledge).not.toHaveBeenCalled();
    expect(f.monitor.reset).not.toHaveBeenCalled();
  });
  it("rejects alternate origins and malformed mutation headers without invoking the monitor", async () => {
    const f = await fixture();
    for (const changes of [
      { origin: "https://untrusted.invalid" },
      { "x-research-cockpit-intent": "personal-vault-delete" },
      { "if-match": '"v1"' },
      { "x-research-cockpit-idempotency-key": "short" },
    ]) {
      const response = await f.app.inject({
        method: "POST",
        url: PATH,
        headers: { ...mutation(f.cookie, 0), ...changes },
        payload: { schemaVersion: "1.0.0", expectedVersion: 0, policy },
      });
      expect([400, 403]).toContain(response.statusCode);
    }
    expect(f.monitor.configure).not.toHaveBeenCalled();
  });
  it("returns status and forwards exact typed commands with the caller idempotency key", async () => {
    const f = await fixture();
    const read = await f.app.inject({
      method: "GET",
      url: PATH,
      headers: headers(f.cookie),
    });
    expect(read.statusCode).toBe(200);
    expect(read.headers.etag).toBe('"v0"');
    expect(read.json()).toEqual(empty);
    const h = mutation(f.cookie, 0),
      body = { schemaVersion: "1.0.0", expectedVersion: 0, policy };
    const configured = await f.app.inject({
      method: "POST",
      url: PATH,
      headers: h,
      payload: body,
    });
    expect(configured.statusCode).toBe(200);
    expect(configured.headers.etag).toBe('"v2"');
    expect(f.monitor.configure).toHaveBeenCalledWith(
      body,
      h["x-research-cockpit-idempotency-key"],
    );
    for (const operation of ["pause", "reset", "acknowledge"] as const) {
      const command = {
        schemaVersion: "1.0.0",
        expectedVersion: 2,
        ...(operation === "acknowledge"
          ? { eventIds: ["0000000001:0000000001-26-000001"] }
          : {}),
      };
      const updated = await f.app.inject({
        method: "POST",
        url: `${PATH}/${operation}`,
        headers: mutation(f.cookie, 2),
        payload: command,
      });
      expect(updated.statusCode).toBe(200);
      expect(f.monitor[operation]).toHaveBeenCalledOnce();
    }
  });
  it.each([
    { schemaVersion: "1.0.0", expectedVersion: 1, policy },
    { schemaVersion: "1.0.0", expectedVersion: 0, policy, extra: true },
    {
      schemaVersion: "1.0.0",
      expectedVersion: 0,
      policy: { ...policy, timeZone: "Unknown/City" },
    },
    {
      schemaVersion: "1.0.0",
      expectedVersion: 0,
      policy: { ...policy, dailyTime: "24:00" },
    },
    {
      schemaVersion: "1.0.0",
      expectedVersion: 0,
      policy: { ...policy, listingIds: ["lst-00000", "lst-00000"] },
    },
  ])("rejects an invalid or mismatched configure body %#", async (body) => {
    const f = await fixture();
    const response = await f.app.inject({
      method: "POST",
      url: PATH,
      headers: mutation(f.cookie, 0),
      payload: body,
    });
    expect(response.statusCode).toBe(400);
    expect(f.monitor.configure).not.toHaveBeenCalled();
  });
  it("does not expose stored or provider errors and distinguishes history conflicts", async () => {
    const f = await fixture();
    f.monitor.get.mockImplementationOnce(() => {
      throw new Error("private-vault-canary");
    });
    const read = await f.app.inject({
      method: "GET",
      url: PATH,
      headers: headers(f.cookie),
    });
    expect(read.statusCode).toBe(503);
    expect(read.payload).not.toContain("private-vault-canary");
    for (const error of [
      new PersonalFilingMonitorError(409, "history_requires_reset"),
      new LocalResearchVaultError("VAULT_IDEMPOTENCY_CONFLICT"),
    ]) {
      f.monitor.configure.mockImplementationOnce(() => {
        throw error;
      });
      const response = await f.app.inject({
        method: "POST",
        url: PATH,
        headers: mutation(f.cookie, 0),
        payload: { schemaVersion: "1.0.0", expectedVersion: 0, policy },
      });
      expect(response.statusCode).toBe(409);
    }
  });
  it("accepts configured local access while rejecting duplicated origins, intents and preconditions", async () => {
    const f = await fixture(true);
    const read = await f.app.inject({
      method: "GET",
      url: PATH,
      headers: headers(),
    });
    expect(read.statusCode).toBe(200);
    const accepted = await f.app.inject({
      method: "POST",
      url: PATH,
      headers: mutation("", 0),
      payload: { schemaVersion: "1.0.0", expectedVersion: 0, policy },
    });
    expect(accepted.statusCode).toBe(200);
    f.monitor.configure.mockClear();
    for (const [name, values] of [
      ["origin", ["http://127.0.0.1:3000", "http://127.0.0.1:3000"]],
      [
        "x-research-cockpit-intent",
        ["personal-vault-create", "personal-vault-create"],
      ],
      ["if-none-match", ["*", "*"]],
    ] as const) {
      const response = await f.app.inject({
        method: "POST",
        url: PATH,
        headers: { ...mutation("", 0), [name]: [...values] },
        payload: { schemaVersion: "1.0.0", expectedVersion: 0, policy },
      });
      expect([400, 403]).toContain(response.statusCode);
    }
    const malformed = await f.app.inject({
      method: "POST",
      url: PATH,
      headers: mutation("", 0),
      payload: "{ synthetic-malformed",
    });
    expect(malformed.statusCode).toBe(400);
    expect(f.monitor.configure).not.toHaveBeenCalled();
  });
});
