import type { IncomingMessage, ServerResponse } from "node:http";

import {
  PERSONAL_BEA_CALENDAR_SOURCE,
  PERSONAL_ECONOMIC_CALENDAR_PATH,
  type PersonalEconomicCalendarDto,
} from "@research-cockpit/contracts";
import {
  LOCAL_RESEARCH_VAULT_PROFILE,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
import { admitPersonalSecurityMasterSnapshot } from "@research-cockpit/personal-security-master";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BeaReleaseProviderError,
  type BeaReleaseProvider,
} from "./bea-release-provider";
import { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { buildPersonalWorkspaceApp } from "./workspace-app";
import { registerPersonalWorkspaceEconomicCalendarRoutes } from "./workspace-economic-calendar-routes";

const OPTIONS = { host: "127.0.0.1" as const, port: 3100 };
const applications: FastifyInstance[] = [];
const authorities: PersonalOwnerSessionAuthority[] = [];
const result = (): PersonalEconomicCalendarDto => ({
  schemaVersion: "1.0.0",
  source: PERSONAL_BEA_CALENDAR_SOURCE,
  fetchedAt: "2026-09-26T12:00:00.000Z",
  window: {
    fromInclusive: "2026-09-26T12:00:00.000Z",
    toExclusive: "2026-10-26T12:00:00.000Z",
  },
  events: [{ series: "GDP", scheduledAt: "2026-09-27T12:30:00.000Z" }],
});
const headers = () => ({
  host: "127.0.0.1:3100",
  origin: "http://127.0.0.1:3000",
  accept: "application/json",
});
function fixture(
  load: BeaReleaseProvider["load"] = () => Promise.resolve(result()),
) {
  const app = Fastify({ logger: false });
  const authority = PersonalOwnerSessionAuthority.createForLocalAccess();
  const provider = { load: vi.fn(load), close: vi.fn() };
  registerPersonalWorkspaceEconomicCalendarRoutes(
    app,
    provider,
    authority,
    OPTIONS,
  );
  applications.push(app);
  authorities.push(authority);
  return { app, authority, provider };
}
afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
  for (const authority of authorities.splice(0)) authority.close();
});

describe("personal workspace economic calendar", () => {
  it("loads one authenticated schedule without catalog or owner records", async () => {
    const { app, provider } = fixture();
    expect(provider.load).not.toHaveBeenCalled();
    const response = await app.inject({
      method: "GET",
      url: PERSONAL_ECONOMIC_CALENDAR_PATH,
      headers: headers(),
      remoteAddress: "127.0.0.1",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(result());
    expect(provider.load).toHaveBeenCalledOnce();
    expect(provider.load).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it.each([
    { headers: { ...headers(), origin: "https://untrusted.example" } },
    { headers: { ...headers(), host: "localhost:3100" } },
    { headers: { ...headers(), "x-forwarded-host": "127.0.0.1:3100" } },
    {
      headers: { ...headers(), "content-type": "application/json" },
      payload: "{}",
    },
    { url: `${PERSONAL_ECONOMIC_CALENDAR_PATH}?days=365` },
    { remoteAddress: "192.0.2.9" },
  ])(
    "rejects invalid request boundaries before any provider call %#",
    async (changes) => {
      const { app, provider } = fixture();
      const response = await app.inject({
        method: "GET",
        url: PERSONAL_ECONOMIC_CALENDAR_PATH,
        headers: headers(),
        remoteAddress: "127.0.0.1",
        ...changes,
      });
      expect(response.statusCode).toBe(403);
      expect(provider.load).not.toHaveBeenCalled();
    },
  );

  it("rejects closed authority and unsupported HEAD/POST without provider work", async () => {
    const { app, authority, provider } = fixture();
    authority.close();
    const request = {
      url: PERSONAL_ECONOMIC_CALENDAR_PATH,
      headers: headers(),
      remoteAddress: "127.0.0.1",
    };
    expect((await app.inject({ ...request, method: "GET" })).statusCode).toBe(
      403,
    );
    expect((await app.inject({ ...request, method: "HEAD" })).statusCode).toBe(
      404,
    );
    expect((await app.inject({ ...request, method: "POST" })).statusCode).toBe(
      404,
    );
    expect(provider.load).not.toHaveBeenCalled();
  });

  it("does not expose provider errors or malformed successful DTOs", async () => {
    for (const load of [
      () => Promise.reject(new Error("secret-error-body")),
      () => Promise.reject(new BeaReleaseProviderError("invalid_response")),
      () => Promise.resolve({ ...result(), unexpected: "secret-field" }),
      () =>
        Promise.resolve({
          ...result(),
          source: {
            ...PERSONAL_BEA_CALENDAR_SOURCE,
            scheduleUrl: "https://untrusted.example",
          },
        } as unknown as PersonalEconomicCalendarDto),
    ]) {
      const { app } = fixture(load);
      const response = await app.inject({
        method: "GET",
        url: PERSONAL_ECONOMIC_CALENDAR_PATH,
        headers: headers(),
        remoteAddress: "127.0.0.1",
      });
      expect(response.statusCode).toBe(502);
      expect(response.json()).toMatchObject({
        title: "Economic calendar unavailable",
        instance: PERSONAL_ECONOMIC_CALENDAR_PATH,
      });
      expect(response.payload).not.toContain("secret");
      expect(response.payload).not.toContain("untrusted");
    }
  });

  it.each(["request", "reply"] as const)(
    "propagates %s cancellation and rejects a late response",
    async (side) => {
      let complete: ((value: PersonalEconomicCalendarDto) => void) | undefined;
      let request: IncomingMessage | undefined;
      let reply: ServerResponse | undefined;
      const { app, provider } = fixture(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
      app.addHook("preHandler", (input, output, done) => {
        request = input.raw;
        reply = output.raw;
        done();
      });
      const response = app.inject({
        method: "GET",
        url: PERSONAL_ECONOMIC_CALENDAR_PATH,
        headers: headers(),
        remoteAddress: "127.0.0.1",
      });
      await vi.waitFor(() => expect(provider.load).toHaveBeenCalledOnce());
      const closed =
        side === "reply"
          ? expect(response).rejects.toThrow(
              "response destroyed before completion",
            )
          : undefined;
      if (side === "request") request!.emit("aborted");
      else reply!.emit("close");
      expect(provider.load.mock.calls[0]?.[0]?.aborted).toBe(true);
      complete!(result());
      if (closed) await closed;
      else expect((await response).statusCode).toBe(502);
    },
  );

  it("registers and closes the injected provider in the complete workspace app", async () => {
    const admission = buildTestSecurityMasterAdmission();
    const catalog = admitPersonalSecurityMasterSnapshot({
      expectedSha256: admission.expectedSha256,
      snapshot: admission.snapshot,
    });
    const authority = PersonalOwnerSessionAuthority.createForLocalAccess();
    const vault = {
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
      close: vi.fn(),
    } as unknown as LocalResearchVault;
    const provider = {
      load: vi.fn(() => Promise.resolve(result())),
      close: vi.fn(),
    };
    const app = await buildPersonalWorkspaceApp(
      catalog,
      vault,
      authority,
      OPTIONS,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      provider,
    );
    applications.push(app);
    const response = await app.inject({
      method: "GET",
      url: PERSONAL_ECONOMIC_CALENDAR_PATH,
      headers: headers(),
      remoteAddress: "127.0.0.1",
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(provider.load).toHaveBeenCalledOnce();
    await app.close();
    expect(provider.close).toHaveBeenCalledOnce();
    applications.splice(applications.indexOf(app), 1);
  });
});
