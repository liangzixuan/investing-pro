import {
  PERSONAL_FED_MONETARY_SOURCE,
  PERSONAL_MONETARY_ANNOUNCEMENTS_PATH,
} from "@research-cockpit/contracts";
import {
  LOCAL_RESEARCH_VAULT_PROFILE,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
import { admitPersonalSecurityMasterSnapshot } from "@research-cockpit/personal-security-master";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFedMonetaryAnnouncementsProvider,
  type FedMonetaryAnnouncementsProvider,
} from "./fed-monetary-announcements-provider";
import { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { buildPersonalWorkspaceApp } from "./workspace-app";

const applications: FastifyInstance[] = [];
const unexpectedFetch = vi.fn<typeof fetch>(() => {
  throw new Error("Unexpected global transport in a synthetic test");
});
const feed = `<rss version="2.0"><channel>
  <title>FRB: Press Release - Monetary Policy</title>
  <link>https://www.federalreserve.gov/feeds/feeds.htm</link>
  <item><title>Synthetic monetary announcement</title>
    <link>https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm</link>
    <pubDate>Wed, 16 Sep 2026 18:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

beforeEach(() => {
  unexpectedFetch.mockClear();
  vi.stubGlobal("fetch", unexpectedFetch);
});
afterEach(async () => {
  try {
    await Promise.all(applications.splice(0).map((app) => app.close()));
    expect(unexpectedFetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

describe("workspace monetary announcements integration", () => {
  it("wires the authenticated feed route without acquisition during startup", async () => {
    const transport = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(feed)),
    );
    const provider = createFedMonetaryAnnouncementsProvider({
      fetch: transport,
      now: () => new Date("2026-09-27T06:00:00.000Z"),
    });
    const f = await fixture(provider);
    expect(transport).not.toHaveBeenCalled();
    await f.app.ready();
    expect(transport).not.toHaveBeenCalled();
    const request = {
      method: "GET" as const,
      url: PERSONAL_MONETARY_ANNOUNCEMENTS_PATH,
      headers: {
        host: "127.0.0.1:3100",
        origin: "http://127.0.0.1:3000",
        accept: "application/json",
      },
      remoteAddress: "127.0.0.1",
    };
    const rejected = await f.app.inject({
      ...request,
      headers: { ...request.headers, origin: "https://untrusted.example" },
    });
    expect(rejected.statusCode).toBe(403);
    expect(transport).not.toHaveBeenCalled();

    const response = await f.app.inject(request);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      schemaVersion: "1.0.0",
      source: PERSONAL_FED_MONETARY_SOURCE,
      fetchedAt: "2026-09-27T06:00:00.000Z",
      availableItemCount: 1,
      items: [
        {
          title: "Synthetic monetary announcement",
          url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm",
          publishedAt: "2026-09-16T18:00:00.000Z",
        },
      ],
    });
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(transport).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0]?.[0]).toBe(
      PERSONAL_FED_MONETARY_SOURCE.feedUrl,
    );
    expect(f.closeVault).not.toHaveBeenCalled();
  });

  it("aborts the provider's pending transport and retires authority on workspace close", async () => {
    let capturedSignal: AbortSignal | undefined;
    const transport = vi.fn<typeof fetch>((_input, options) => {
      capturedSignal = options?.signal ?? undefined;
      // The injected transport ignores abort; the real provider owns cancellation.
      return new Promise<Response>(() => undefined);
    });
    const provider = createFedMonetaryAnnouncementsProvider({
      fetch: transport,
    });
    const f = await fixture(provider);
    await f.app.ready();
    const pending = expect(provider.load()).rejects.toMatchObject({
      code: "aborted",
    });
    expect(transport).toHaveBeenCalledOnce();
    expect(capturedSignal?.aborted).toBe(false);
    await closeTracked(f.app);
    await pending;
    expect(capturedSignal?.aborted).toBe(true);
    expect(f.closeVault).toHaveBeenCalledOnce();
    expect(f.owner.isLocalAccessEnabled()).toBe(false);
    await expect(provider.load()).rejects.toMatchObject({ code: "aborted" });
    expect(transport).toHaveBeenCalledOnce();
  });

  it("still retires owner authority when Fed provider disposal fails", async () => {
    const load = vi.fn(() => Promise.reject(new Error("Unexpected load")));
    const close = vi.fn(() => {
      throw new Error("synthetic-fed-close-failure");
    });
    const provider: FedMonetaryAnnouncementsProvider = {
      load,
      close,
    };
    const f = await fixture(provider);
    await f.app.ready();
    await expect(closeTracked(f.app)).rejects.toThrow(
      "synthetic-fed-close-failure",
    );
    expect(close).toHaveBeenCalledOnce();
    expect(load).not.toHaveBeenCalled();
    expect(f.closeVault).toHaveBeenCalledOnce();
    expect(f.owner.isLocalAccessEnabled()).toBe(false);
  });
});

async function fixture(provider: FedMonetaryAnnouncementsProvider) {
  const catalog = admitPersonalSecurityMasterSnapshot(
    buildTestSecurityMasterAdmission(),
  );
  const closeVault = vi.fn();
  const vault = {
    profile: LOCAL_RESEARCH_VAULT_PROFILE,
    close: closeVault,
  } as unknown as LocalResearchVault;
  const owner = PersonalOwnerSessionAuthority.createForLocalAccess();
  const app = await buildPersonalWorkspaceApp(
    catalog,
    vault,
    owner,
    { host: "127.0.0.1", port: 3100 },
    undefined,
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
  return { app, owner, closeVault };
}

async function closeTracked(app: FastifyInstance): Promise<void> {
  const index = applications.indexOf(app);
  if (index >= 0) applications.splice(index, 1);
  await app.close();
}
