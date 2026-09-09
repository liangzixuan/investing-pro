import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  PersonalSecIssuerFilingsDto,
  PersonalSecRecentFilingDto,
  PersonalWatchlistFilingsRequestDto,
  PersonalWatchlistFilingsResponseDto,
} from "@research-cockpit/contracts";
import {
  LOCAL_RESEARCH_VAULT_PROFILE,
  LocalResearchVaultError,
  type LocalResearchRecord,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
import {
  admitPersonalSecurityMasterSnapshot,
  searchPersonalSecurityMaster,
} from "@research-cockpit/personal-security-master";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PersonalOwnerSessionAuthority,
  PERSONAL_OWNER_SESSION_COOKIE_NAME,
} from "./personal-owner-session";
import { registerPersonalOwnerSessionRoutes } from "./personal-owner-session-routes";
import { PersonalSecFilingsProviderError } from "./personal-sec-filings-provider";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { bootstrapTestPersonalOwnerSession } from "./test-personal-owner-session-builder";
import { buildPersonalWorkspaceApp } from "./workspace-app";
import {
  PERSONAL_WATCHLIST_FILINGS_PATH,
  registerPersonalWorkspaceWatchlistFilingsRoutes,
} from "./workspace-watchlist-filings-routes";

const LISTEN_OPTIONS = { host: "127.0.0.1" as const, port: 3100 };
const applications: FastifyInstance[] = [];
const extraAuthorities: PersonalOwnerSessionAuthority[] = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map(async (app) => app.close()));
  for (const authority of extraAuthorities.splice(0)) authority.close();
  vi.useRealTimers();
});

describe("personal watchlist recent SEC filings routes", () => {
  it("authenticates before parsing, rejects alternate origins, and performs no source work", async () => {
    const f = await readyApp();
    for (const headers of [
      ownerHeaders(),
      { ...ownerHeaders(f.cookie), origin: "https://untrusted.invalid" },
    ]) {
      const response = await f.app.inject({
        method: "POST",
        url: PERSONAL_WATCHLIST_FILINGS_PATH,
        headers: { ...headers, "content-type": "application/json" },
        payload: "{ private-watchlist-canary",
        remoteAddress: "127.0.0.1",
      });
      expect(response.statusCode).toBe(403);
      expect(response.payload).not.toContain("private-watchlist-canary");
    }
    expect(f.provider.loadFilings).not.toHaveBeenCalled();
    expect(f.vault.getRecord).not.toHaveBeenCalled();
  });

  it("accepts only a closed bounded request and rejects stale catalog before reading the vault", async () => {
    const f = await readyApp();
    const request = filingsRequest(f.snapshotSha256);
    for (const invalid of [
      null,
      [],
      { ...request, schemaVersion: "2.0.0" },
      { ...request, extra: "private-canary" },
      { ...request, watchlistVersion: 0 },
      { ...request, watchlistVersion: 1.5 },
      { ...request, watchlistVersion: Number.MAX_SAFE_INTEGER + 1 },
      { ...request, lookbackDays: 8 },
      { ...request, catalogSnapshotSha256: "not-a-digest" },
      { ...request, listingIds: [] },
      { ...request, listingIds: ["lst-00000", "lst-00000"] },
      { ...request, listingIds: ["https://untrusted.invalid"] },
      {
        ...request,
        listingIds: Array.from({ length: 21 }, (_, i) => `lst-${i}`),
      },
      { ...request, listingIds: [true] },
    ]) {
      const response = await requestFilings(f.app, f.cookie, invalid);
      expect(response.statusCode, JSON.stringify(invalid)).toBe(400);
      expect(response.payload).not.toContain("private-canary");
    }
    const stale = await requestFilings(f.app, f.cookie, {
      ...request,
      catalogSnapshotSha256: `sha256:${"f".repeat(64)}`,
    });
    expect(stale.statusCode).toBe(409);
    expect(f.vault.getRecord).not.toHaveBeenCalled();
    expect(f.provider.loadFilings).not.toHaveBeenCalled();
  });

  it("rejects missing, deleted, stale, malformed, unsaved and mismatched identities before fetch", async () => {
    const f = await readyApp();
    const original = f.vault.record!;
    for (const code of ["VAULT_NOT_FOUND", "VAULT_DELETED"] as const) {
      f.vault.getRecord.mockImplementationOnce(() => {
        throw new LocalResearchVaultError(code);
      });
      expect(
        (
          await requestFilings(
            f.app,
            f.cookie,
            filingsRequest(f.snapshotSha256),
          )
        ).statusCode,
      ).toBe(404);
    }
    f.vault.record = { ...original, version: 2 };
    expect(
      (await requestFilings(f.app, f.cookie, filingsRequest(f.snapshotSha256)))
        .statusCode,
    ).toBe(409);
    const payload = original.payload as Record<string, unknown>;
    f.vault.record = {
      ...original,
      payload: { ...payload, snapshotSha256: `sha256:${"f".repeat(64)}` },
    };
    expect(
      (await requestFilings(f.app, f.cookie, filingsRequest(f.snapshotSha256)))
        .statusCode,
    ).toBe(409);
    f.vault.record = {
      ...original,
      payload: { ...payload, unexpected: "private-note-canary" },
    };
    expect(
      (await requestFilings(f.app, f.cookie, filingsRequest(f.snapshotSha256)))
        .statusCode,
    ).toBe(409);
    f.vault.record = original;
    expect(
      (
        await requestFilings(f.app, f.cookie, {
          ...filingsRequest(f.snapshotSha256),
          listingIds: ["lst-99999"],
        })
      ).statusCode,
    ).toBe(400);
    const memberships = payload.memberships as Record<string, unknown>[];
    f.vault.record = {
      ...original,
      payload: {
        ...payload,
        memberships: memberships.map((membership, index) =>
          index === 0
            ? { ...membership, issuerName: "Wrong issuer" }
            : membership,
        ),
      } as LocalResearchRecord["payload"],
    };
    expect(
      (await requestFilings(f.app, f.cookie, filingsRequest(f.snapshotSha256)))
        .statusCode,
    ).toBe(409);
    expect(f.provider.loadFilings).not.toHaveBeenCalled();
  });

  it("deduplicates issuer fetches and preserves both saved share classes without notes or writes", async () => {
    const f = await readyApp();
    const response = await requestFilings(f.app, f.cookie, {
      ...filingsRequest(f.snapshotSha256),
      listingIds: ["lst-00000", "lst-00002", "lst-00001"],
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    const body = response.json<PersonalWatchlistFilingsResponseDto>();
    expect(body).toMatchObject({
      schemaVersion: "1.0.0",
      watchlistVersion: 1,
      totalWatchlistListings: 6,
      selectedListingIds: ["lst-00000", "lst-00002", "lst-00001"],
      matchingFilings: 2,
      truncated: false,
      issuers: [
        {
          cik: "0000000001",
          listings: [{ listingId: "lst-00000" }, { listingId: "lst-00001" }],
        },
        { cik: "0000000002", listings: [{ listingId: "lst-00002" }] },
      ],
    });
    expect(f.provider.loadFilings).toHaveBeenCalledWith(
      ["0000000001", "0000000002"],
      body.fromDate,
      body.throughDate,
      expect.any(AbortSignal),
    );
    expect(body.filings[0]?.listings).toEqual(body.issuers[0]?.listings);
    expect(response.payload).not.toContain("private-note-canary");
    expect(f.vault.putRecord).not.toHaveBeenCalled();
    expect(f.vault.getRecord).toHaveBeenCalledTimes(2);
  });

  it("uses inclusive UTC filing-date windows, captured once across midnight", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-09T23:59:59.999Z"));
    const f = await readyApp();
    const normalLoad = f.provider.loadFilings.getMockImplementation()!;
    f.provider.loadFilings.mockImplementationOnce((...args) => {
      vi.setSystemTime(new Date("2026-09-10T00:00:01.000Z"));
      return normalLoad(...args);
    });
    const body = (
      await requestFilings(f.app, f.cookie, filingsRequest(f.snapshotSha256))
    ).json<PersonalWatchlistFilingsResponseDto>();
    expect(body).toMatchObject({
      lookbackDays: 7,
      fromDate: "2026-09-03",
      throughDate: "2026-09-09",
      fetchedAt: "2026-09-09T23:59:59.999Z",
    });
    vi.setSystemTime(new Date("2026-09-09T12:00:00.000Z"));
    for (const [lookbackDays, fromDate] of [
      [30, "2026-08-11"],
      [90, "2026-06-12"],
    ] as const) {
      const response = await requestFilings(f.app, f.cookie, {
        ...filingsRequest(f.snapshotSha256),
        lookbackDays,
      });
      expect(response.json()).toMatchObject({
        fromDate,
        throughDate: "2026-09-09",
      });
    }
  });

  it("keeps successful empty coverage distinct from source failure and disclosed source truncation", async () => {
    const provider = testProvider();
    provider.loadFilings.mockImplementation(
      async (ciks, _fromDate, throughDate) =>
        await Promise.resolve(
          ciks.map((cik, index) => {
            const result = issuerResult(cik, throughDate);
            return index === 0
              ? {
                  ...result,
                  matchingFilings: 0,
                  filings: [],
                  olderHistoryAvailable: true,
                }
              : index === 1
                ? {
                    ...result,
                    status: "rate_limited" as const,
                    matchingFilings: 0,
                    filings: [],
                  }
                : { ...result, matchingFilings: 5, truncated: true };
          }),
        ),
    );
    const f = await readyApp(provider);
    const response = await requestFilings(f.app, f.cookie, {
      ...filingsRequest(f.snapshotSha256),
      listingIds: ["lst-00000", "lst-00002", "lst-00004"],
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      matchingFilings: 5,
      truncated: true,
      issuers: [
        {
          status: "available",
          matchingFilings: 0,
          olderHistoryAvailable: true,
        },
        { status: "rate_limited", matchingFilings: 0 },
        { status: "available", matchingFilings: 5, truncated: true },
      ],
      filings: [{ cik: "0000000003" }],
    });
  });

  it("sorts all selected issuers together, applies the global cap, and preserves the matching count", async () => {
    const provider = testProvider();
    provider.loadFilings.mockImplementation(
      async (ciks, fromDate, throughDate) =>
        await Promise.resolve(
          [...ciks].reverse().map((cik) => ({
            ...issuerResult(cik, throughDate),
            matchingFilings: 60,
            filings: Array.from({ length: 60 }, (_, index) =>
              filing(cik, index % 2 === 0 ? throughDate : fromDate, index + 1),
            ).reverse(),
          })),
        ),
    );
    const f = await readyApp(provider, 40);
    const selected = Array.from(
      { length: 20 },
      (_, index) => `lst-${String(index * 2).padStart(5, "0")}`,
    );
    const response = await requestFilings(f.app, f.cookie, {
      ...filingsRequest(f.snapshotSha256),
      listingIds: selected,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<PersonalWatchlistFilingsResponseDto>();
    expect(body.matchingFilings).toBe(1200);
    expect(body.truncated).toBe(true);
    expect(body.filings).toHaveLength(1000);
    expect(body.issuers).toHaveLength(20);
    expect(body.filings[0]?.filingDate).toBe(body.throughDate);
    expect(body.filings[600]?.filingDate).toBe(body.fromDate);
    const expected = [...body.filings].sort(
      (a, b) =>
        compare(b.filingDate, a.filingDate) ||
        compare(a.accessionNumber, b.accessionNumber) ||
        compare(a.cik, b.cik),
    );
    expect(body.filings).toEqual(expected);
  });

  it("invalidates a source result after concurrent watchlist update or deletion", async () => {
    const f = await readyApp();
    const original = f.vault.record!;
    const normalLoad = f.provider.loadFilings.getMockImplementation()!;
    for (const mutation of [
      () => {
        f.vault.record = { ...original, version: 2 };
      },
      () => {
        f.vault.record = {
          ...original,
          payload: {
            ...(original.payload as Record<string, unknown>),
            snapshotSha256: `sha256:${"f".repeat(64)}`,
          },
        };
      },
      () => {
        f.vault.record = undefined;
      },
    ]) {
      f.vault.record = original;
      f.provider.loadFilings.mockImplementationOnce((...args) => {
        mutation();
        return normalLoad(...args);
      });
      const response = await requestFilings(
        f.app,
        f.cookie,
        filingsRequest(f.snapshotSha256),
      );
      expect(response.statusCode).toBe(409);
      expect(response.payload).not.toContain("accessionNumber");
    }
    expect(f.vault.putRecord).not.toHaveBeenCalled();
  });

  it("rejects missing, foreign, repeated, outside-window and inconsistent provider issuer output", async () => {
    const f = await readyApp();
    const result = issuerResult(
      "0000000001",
      new Date().toISOString().slice(0, 10),
    );
    for (const output of [
      [],
      [issuerResult("0000000099", result.filings[0]!.filingDate)],
      [result, result],
      [{ ...result, matchingFilings: 0 }],
      [{ ...result, truncated: true }],
      [{ ...result, matchingFilings: 2, truncated: false }],
      [
        {
          ...result,
          matchingFilings: 1001,
          filings: Array.from({ length: 1001 }, (_, i) =>
            filing(result.cik, result.filings[0]!.filingDate, i + 1),
          ),
        },
      ],
      [{ ...result, status: "invalid_response" as const }],
      [
        {
          ...result,
          status: "invalid_response" as const,
          matchingFilings: 0,
          filings: [],
          olderHistoryAvailable: true,
        },
      ],
      [
        {
          ...result,
          matchingFilings: 2,
          filings: [result.filings[0]!, result.filings[0]!],
        },
      ],
      [{ ...result, filings: [{ ...result.filings[0]!, cik: "0000000099" }] }],
      [
        {
          ...result,
          filings: [{ ...result.filings[0]!, filingDate: "2000-01-01" }],
        },
      ],
    ]) {
      f.provider.loadFilings.mockResolvedValueOnce(output);
      const response = await requestFilings(
        f.app,
        f.cookie,
        filingsRequest(f.snapshotSha256),
      );
      expect(response.statusCode).toBe(502);
      expect(response.payload).not.toContain("accessionNumber");
    }
  });

  it("maps bounded provider failures without echoing private diagnostics and closes the provider with the workspace", async () => {
    const f = await readyApp();
    for (const [code, status] of [
      ["not_configured", 503],
      ["busy", 429],
      ["invalid_request", 400],
      ["aborted", 502],
    ] as const) {
      f.provider.loadFilings.mockRejectedValueOnce(
        new PersonalSecFilingsProviderError(code),
      );
      expect(
        (
          await requestFilings(
            f.app,
            f.cookie,
            filingsRequest(f.snapshotSha256),
          )
        ).statusCode,
      ).toBe(status);
    }
    f.provider.loadFilings.mockRejectedValueOnce(
      new Error("private-provider-contact-canary"),
    );
    const response = await requestFilings(
      f.app,
      f.cookie,
      filingsRequest(f.snapshotSha256),
    );
    expect(response.statusCode).toBe(502);
    expect(response.payload).not.toContain("private-provider-contact-canary");
    await f.app.close();
    expect(f.provider.close).toHaveBeenCalledOnce();
  });

  it("removes request and response abort listeners after successful completion", async () => {
    let requestRaw: IncomingMessage | undefined;
    let replyRaw: ServerResponse | undefined;
    let initialRequestListeners: readonly unknown[] = [];
    let initialReplyListeners: readonly unknown[] = [];
    let addedRequestListener: unknown;
    let addedReplyListener: unknown;
    const f = await readyApp(testProvider(), 6, (app) => {
      app.addHook("preHandler", async (request, reply) => {
        if (request.url !== PERSONAL_WATCHLIST_FILINGS_PATH) return;
        requestRaw = request.raw;
        replyRaw = reply.raw;
        initialRequestListeners = request.raw.listeners("aborted");
        initialReplyListeners = reply.raw.listeners("close");
      });
    });
    const normalLoad = f.provider.loadFilings.getMockImplementation()!;
    f.provider.loadFilings.mockImplementationOnce((...args) => {
      const requests = requestRaw!
        .listeners("aborted")
        .filter((listener) => !initialRequestListeners.includes(listener));
      const replies = replyRaw!
        .listeners("close")
        .filter((listener) => !initialReplyListeners.includes(listener));
      expect(requests).toHaveLength(1);
      expect(replies).toHaveLength(1);
      [addedRequestListener] = requests;
      [addedReplyListener] = replies;
      return normalLoad(...args);
    });
    expect(
      (await requestFilings(f.app, f.cookie, filingsRequest(f.snapshotSha256)))
        .statusCode,
    ).toBe(200);
    expect(requestRaw!.listeners("aborted")).not.toContain(
      addedRequestListener,
    );
    expect(replyRaw!.listeners("close")).not.toContain(addedReplyListener);
  });

  it("aborts provider work when the browser disconnects after parsing the selection", async () => {
    const state = testState();
    const provider = testProvider();
    let providerSignal: AbortSignal | undefined;
    let resolveStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    provider.loadFilings.mockImplementation(
      (_ciks, _fromDate, _throughDate, signal) =>
        new Promise((_resolve, reject) => {
          providerSignal = signal;
          signal?.addEventListener(
            "abort",
            () => reject(new PersonalSecFilingsProviderError("aborted")),
            { once: true },
          );
          resolveStarted?.();
        }),
    );
    const app = Fastify({ bodyLimit: 300 * 1024, trustProxy: false });
    const options = { host: "127.0.0.1" as const, port: 0 };
    await registerPersonalOwnerSessionRoutes(app, state.authority, options);
    registerPersonalWorkspaceWatchlistFilingsRoutes(
      app,
      state.catalog,
      state.vault as unknown as LocalResearchVault,
      provider,
      state.authority,
      options,
    );
    applications.push(app);
    extraAuthorities.push(state.authority);
    const address = await app.listen(options);
    const token = state.authority.bootstrap(state.secret, {
      authority: new URL(address).host,
      origin: "http://127.0.0.1:3000",
    });
    const controller = new AbortController();
    const pending = fetch(new URL(PERSONAL_WATCHLIST_FILINGS_PATH, address), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Cookie: `${PERSONAL_OWNER_SESSION_COOKIE_NAME}=${token ?? ""}`,
        Origin: "http://127.0.0.1:3000",
      },
      body: JSON.stringify(filingsRequest(state.snapshotSha256)),
      signal: controller.signal,
    });
    await started;
    controller.abort();
    await pending.catch(() => undefined);
    await vi.waitFor(() => expect(providerSignal?.aborted).toBe(true));
    expect(provider.loadFilings).toHaveBeenCalledOnce();
    expect(state.vault.getRecord).toHaveBeenCalledOnce();
  });
});

async function readyApp(
  provider = testProvider(),
  recordCount = 6,
  configure?: (app: FastifyInstance) => void,
) {
  const state = testState(recordCount);
  const app = await buildPersonalWorkspaceApp(
    state.catalog,
    state.vault as unknown as LocalResearchVault,
    state.authority,
    LISTEN_OPTIONS,
    undefined,
    undefined,
    provider,
  );
  configure?.(app);
  applications.push(app);
  const cookie = await bootstrapTestPersonalOwnerSession(app, state.secret);
  return { ...state, app, cookie, provider };
}

function testState(recordCount = 6) {
  const admission = buildTestSecurityMasterAdmission(recordCount);
  const catalog = admitPersonalSecurityMasterSnapshot({
    expectedSha256: admission.expectedSha256,
    snapshot: admission.snapshot,
  });
  const secret = randomBytes(32).toString("hex");
  const authority = PersonalOwnerSessionAuthority.create(secret);
  const memberships = Array.from({ length: recordCount }, (_, index) => {
    const row = searchPersonalSecurityMaster(catalog, {
      query: `S${String(index).padStart(5, "0")}`,
      limit: 1,
    }).results[0]!;
    return {
      country: row.country,
      exchangeMic: row.exchangeMic,
      instrumentType: row.instrumentType,
      issuerId: row.issuerId,
      issuerName: row.issuerName,
      listingId: row.listingId,
      note: "private-note-canary",
      securityId: row.securityId,
      securityName: row.securityName,
      shareClassId: row.shareClassId,
      shareClassName: row.shareClassName,
      symbol: row.symbol,
    };
  });
  const vault = new TestVault({
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
    id: "main",
    kind: "watchlist",
    version: 1,
    profile: LOCAL_RESEARCH_VAULT_PROFILE,
    payloadSha256: "a".repeat(64),
    payload: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: admission.expectedSha256,
      memberships,
    },
  });
  return {
    catalog,
    secret,
    authority,
    vault,
    snapshotSha256: admission.expectedSha256,
  };
}

function filingsRequest(
  catalogSnapshotSha256: `sha256:${string}`,
): PersonalWatchlistFilingsRequestDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256,
    watchlistVersion: 1,
    listingIds: ["lst-00000"],
    lookbackDays: 7,
  };
}

function requestFilings(
  app: FastifyInstance,
  cookie: string,
  payload: unknown,
) {
  return app.inject({
    method: "POST",
    url: PERSONAL_WATCHLIST_FILINGS_PATH,
    headers: { ...ownerHeaders(cookie), "content-type": "application/json" },
    remoteAddress: "127.0.0.1",
    payload: payload === null ? "null" : (payload as Record<string, unknown>),
  });
}

function ownerHeaders(cookie?: string): Record<string, string> {
  return {
    accept: "application/json",
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
    ...(cookie === undefined ? {} : { cookie }),
  };
}

function testProvider() {
  return {
    status: () => ({ configured: true }),
    close: vi.fn(),
    loadFilings: vi.fn(
      (
        ciks: readonly string[],
        _fromDate: string,
        throughDate: string,
        _signal?: AbortSignal,
      ): Promise<readonly PersonalSecIssuerFilingsDto[]> => {
        void _signal;
        return Promise.resolve(
          ciks.map((cik) => issuerResult(cik, throughDate)),
        );
      },
    ),
  };
}

function issuerResult(
  cik: string,
  filingDate: string,
): PersonalSecIssuerFilingsDto {
  return {
    cik,
    status: "available",
    fetchedAt: new Date().toISOString(),
    sourceUrl: `https://data.sec.gov/submissions/CIK${cik}.json`,
    olderHistoryAvailable: false,
    matchingFilings: 1,
    truncated: false,
    filings: [filing(cik, filingDate)],
  };
}

function filing(
  cik: string,
  filingDate: string,
  sequence = 1,
): PersonalSecRecentFilingDto {
  const accessionNumber = `${cik}-26-${String(sequence).padStart(6, "0")}`;
  return {
    cik,
    accessionNumber,
    form: "8-K",
    filingDate,
    reportDate: null,
    sourceUrl: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionNumber}-index.htm`,
  };
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

class TestVault {
  readonly profile = LOCAL_RESEARCH_VAULT_PROFILE;
  constructor(public record: LocalResearchRecord | undefined) {}
  close(): void {}
  readonly putRecord = vi.fn();
  readonly getRecord = vi.fn(
    (kind: string, id: string): LocalResearchRecord => {
      if (kind !== "watchlist" || id !== "main" || this.record === undefined)
        throw new LocalResearchVaultError("VAULT_NOT_FOUND");
      return this.record;
    },
  );
}
