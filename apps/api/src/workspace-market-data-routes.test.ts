import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  PersonalAnnualFinancialReportedValuesDto,
  PersonalAnnualFinancialsDto,
  PersonalMarketDataIdentityDto,
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
} from "@research-cockpit/contracts";
import {
  LOCAL_RESEARCH_VAULT_PROFILE,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
import { admitPersonalSecurityMasterSnapshot } from "@research-cockpit/personal-security-master";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PersonalOwnerSessionAuthority,
  PERSONAL_OWNER_SESSION_COOKIE_NAME,
} from "./personal-owner-session";
import { registerPersonalOwnerSessionRoutes } from "./personal-owner-session-routes";
import {
  PersonalMarketDataProviderError,
  type PersonalMarketDataProvider,
} from "./personal-market-data-provider";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { bootstrapTestPersonalOwnerSession } from "./test-personal-owner-session-builder";
import {
  PERSONAL_ANNUAL_FINANCIALS_PATH,
  PERSONAL_MARKET_DATA_OVERVIEW_PATH,
  PERSONAL_MARKET_DATA_STATUS_PATH,
  registerPersonalWorkspaceMarketDataRoutes,
} from "./workspace-market-data-routes";
import { buildPersonalWorkspaceApp } from "./workspace-app";

const LISTEN_OPTIONS = { host: "127.0.0.1" as const, port: 3100 };
const IDENTITY: PersonalMarketDataIdentityDto = {
  country: "US",
  exchangeMic: "XNAS",
  issuerName: "Zéro Alpha Holdings",
  listingId: "lst-00000",
  securityName: "Zéro Alpha Security",
  symbol: "S00000",
};
const STATUS: PersonalMarketDataStatusDto = {
  profile: "personal_single_user_local_market_data",
  provider: {
    attribution: "Tiingo",
    export: "prohibited",
    historyFeed: "tiingo_eod_composite",
    id: "tiingo",
    name: "Tiingo",
    persistence: "none",
    quoteFeed: "tiingo_iex_derived_reference",
    redistribution: "prohibited",
    retention: "active_owner_session_memory_only",
  },
  schemaVersion: "1.0.0",
  status: "configured",
};
const FINANCIALS_PROVIDER = {
  attribution: "Tiingo",
  export: "prohibited",
  id: "tiingo",
  name: "Tiingo",
  persistence: "none",
  redistribution: "prohibited",
  retention: "active_owner_session_memory_only",
  revisionBasis: "provider_most_recent",
  statementFeed: "tiingo_fundamentals_statements",
  valueCurrency: "USD",
} as const;

const applications: FastifyInstance[] = [];
const authorities: PersonalOwnerSessionAuthority[] = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map(async (app) => app.close()));
  for (const authority of authorities.splice(0)) authority.close();
});

describe("personal workspace market-data routes", () => {
  it("closes the injected provider with the composed workspace app", async () => {
    const admission = buildTestSecurityMasterAdmission();
    const catalog = admitPersonalSecurityMasterSnapshot({
      expectedSha256: admission.expectedSha256,
      snapshot: admission.snapshot,
    });
    const authority = PersonalOwnerSessionAuthority.create(
      randomBytes(32).toString("hex"),
    );
    const close = vi.fn();
    const provider = fakeProvider(close).provider;
    const vault = {
      close: vi.fn(),
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
    } as unknown as LocalResearchVault;
    const app = await buildPersonalWorkspaceApp(
      catalog,
      vault,
      authority,
      LISTEN_OPTIONS,
      provider,
    );
    applications.push(app);

    await app.close();
    applications.splice(applications.indexOf(app), 1);
    expect(close).toHaveBeenCalledOnce();
  });

  it("requires the owner session for provider status without exposing configuration", async () => {
    const fixture = await marketApp();
    const forbidden = await fixture.app.inject({
      method: "GET",
      url: PERSONAL_MARKET_DATA_STATUS_PATH,
      headers: ownerHeaders(),
      remoteAddress: "127.0.0.1",
    });
    expect(forbidden.statusCode).toBe(403);

    const response = await fixture.app.inject({
      method: "GET",
      url: PERSONAL_MARKET_DATA_STATUS_PATH,
      headers: ownerHeaders(fixture.cookie),
      remoteAddress: "127.0.0.1",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(STATUS);
    expect(response.payload).not.toContain("private-token-canary");
  });

  it("resolves the exact admitted listing and passes only server-derived identity", async () => {
    const fixture = await marketApp();
    const response = await requestOverview(fixture.app, fixture.cookie, {
      listingId: "lst-00000",
      range: "1y",
      symbol: "S00000",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(overview(IDENTITY, "1y"));
    expect(fixture.loadOverview).toHaveBeenCalledTimes(1);
    expect(fixture.loadOverview.mock.calls[0]?.[0]).toEqual(IDENTITY);
    expect(fixture.loadOverview.mock.calls[0]?.[1]).toBe("1y");
    expect(fixture.loadOverview.mock.calls[0]?.[2]).toBeInstanceOf(AbortSignal);
  });

  it("authenticates annual-financial requests before parsing their JSON body", async () => {
    const fixture = await marketApp();
    const unauthorized = await fixture.app.inject({
      method: "POST",
      url: PERSONAL_ANNUAL_FINANCIALS_PATH,
      headers: {
        ...ownerHeaders(),
        "content-type": "application/json",
      },
      payload: "{ malformed private-financials-canary",
      remoteAddress: "127.0.0.1",
    });

    expect(unauthorized.statusCode).toBe(403);
    expect(unauthorized.payload).not.toContain("private-financials-canary");
    expect(fixture.loadAnnualFinancials).not.toHaveBeenCalled();

    const malformed = await fixture.app.inject({
      method: "POST",
      url: PERSONAL_ANNUAL_FINANCIALS_PATH,
      headers: {
        ...ownerHeaders(fixture.cookie),
        "content-type": "application/json",
      },
      payload: "{ malformed authenticated-financials-canary",
      remoteAddress: "127.0.0.1",
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toMatchObject({
      detail: "The personal market-data request was not accepted.",
      instance: PERSONAL_ANNUAL_FINANCIALS_PATH,
      status: 400,
    });
    expect(malformed.payload).not.toContain("authenticated-financials-canary");
    expect(fixture.loadAnnualFinancials).not.toHaveBeenCalled();
  });

  it("loads annual financials for the exact admitted listing with private no-store headers", async () => {
    const fixture = await marketApp();
    const response = await requestAnnualFinancials(
      fixture.app,
      fixture.cookie,
      {
        listingId: "lst-00000",
        symbol: "S00000",
      },
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.json()).toEqual(annualFinancials(IDENTITY));
    expect(fixture.loadAnnualFinancials).toHaveBeenCalledOnce();
    expect(fixture.loadAnnualFinancials.mock.calls[0]?.[0]).toEqual(IDENTITY);
    expect(fixture.loadAnnualFinancials.mock.calls[0]?.[1]).toBeInstanceOf(
      AbortSignal,
    );
    expect(fixture.loadAnnualFinancials.mock.calls[0]?.[1]?.aborted).toBe(
      false,
    );
  });

  it("rejects fabricated, cross-listing, non-exact, and query-carried annual-financial identities", async () => {
    const fixture = await marketApp();
    for (const body of [
      { listingId: "lst-fabricated", symbol: "S00000" },
      { listingId: "lst-00001", symbol: "S00000" },
      { listingId: "lst-00000", symbol: "S00001" },
      { listingId: "lst-00000", symbol: "s00000" },
      { listingId: "lst-00000", symbol: "S00000", range: "1y" },
      { listingId: "lst-00000" },
      { symbol: "S00000" },
      [],
    ]) {
      const response = await requestAnnualFinancials(
        fixture.app,
        fixture.cookie,
        body,
      );
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        detail: "The personal market-data request was not accepted.",
        instance: PERSONAL_ANNUAL_FINANCIALS_PATH,
        status: 400,
      });
    }

    const queryCarrier = await fixture.app.inject({
      method: "POST",
      url: `${PERSONAL_ANNUAL_FINANCIALS_PATH}?symbol=S00000`,
      headers: {
        ...ownerHeaders(fixture.cookie),
        "content-type": "application/json",
      },
      payload: { listingId: "lst-00000", symbol: "S00000" },
      remoteAddress: "127.0.0.1",
    });
    expect(queryCarrier.statusCode).toBe(403);
    expect(fixture.loadAnnualFinancials).not.toHaveBeenCalled();
  });

  it("maps annual-financial provider failures, including entitlement, to value-free problems", async () => {
    const fixture = await marketApp();
    const cases = [
      ["not_configured", 503],
      ["credentials_invalid", 424],
      ["not_entitled", 402],
      ["rate_limited", 429],
      ["not_covered", 404],
      ["upstream_unavailable", 502],
      ["invalid_response", 502],
      ["aborted", 502],
    ] as const;
    for (const [code, status] of cases) {
      fixture.loadAnnualFinancials.mockRejectedValueOnce(
        new PersonalMarketDataProviderError(code),
      );
      const response = await requestAnnualFinancials(
        fixture.app,
        fixture.cookie,
        {
          listingId: "lst-00000",
          symbol: "S00000",
        },
      );
      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({
        detail: "The personal market-data request was not accepted.",
        instance: PERSONAL_ANNUAL_FINANCIALS_PATH,
        status,
      });
      expect(response.payload).not.toContain(code);
    }

    fixture.loadAnnualFinancials.mockRejectedValueOnce(new Error("canary"));
    const unknown = await requestAnnualFinancials(fixture.app, fixture.cookie, {
      listingId: "lst-00000",
      symbol: "S00000",
    });
    expect(unknown.statusCode).toBe(502);
    expect(unknown.payload).not.toContain("canary");
  });

  it("rejects an annual-financial response whose provider identity is not exact", async () => {
    const fixture = await marketApp();
    fixture.loadAnnualFinancials.mockResolvedValueOnce(
      annualFinancials({ ...IDENTITY, issuerName: "Fabricated issuer" }),
    );

    const response = await requestAnnualFinancials(
      fixture.app,
      fixture.cookie,
      {
        listingId: "lst-00000",
        symbol: "S00000",
      },
    );
    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({
      instance: PERSONAL_ANNUAL_FINANCIALS_PATH,
      status: 502,
    });
    expect(response.payload).not.toContain("Fabricated issuer");
  });

  it("rejects fabricated, cross-listing, and non-exact request identities", async () => {
    const fixture = await marketApp();
    for (const body of [
      { listingId: "lst-fabricated", range: "1m", symbol: "S00000" },
      { listingId: "lst-00001", range: "1m", symbol: "S00000" },
      { listingId: "lst-00000", range: "1m", symbol: "S00001" },
      { listingId: "lst-00000", range: "1m", symbol: "s00000" },
      { listingId: "lst-00000", range: "max", symbol: "S00000" },
      {
        listingId: "lst-00000",
        range: "1m",
        symbol: "S00000",
        issuerName: "fabricated",
      },
      { listingId: "lst-00000", symbol: "S00000" },
      [],
    ]) {
      const response = await requestOverview(fixture.app, fixture.cookie, body);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        detail: "The personal market-data request was not accepted.",
        status: 400,
      });
    }
    const malformedJson = await fixture.app.inject({
      method: "POST",
      url: PERSONAL_MARKET_DATA_OVERVIEW_PATH,
      headers: {
        ...ownerHeaders(fixture.cookie),
        "content-type": "application/json",
      },
      payload: '{"listingId":',
      remoteAddress: "127.0.0.1",
    });
    expect(malformedJson.statusCode).toBe(400);
    expect(fixture.loadOverview).not.toHaveBeenCalled();
  });

  it("maps provider failures to distinct value-free problem details", async () => {
    const fixture = await marketApp();
    const cases = [
      ["not_configured", 503],
      ["credentials_invalid", 424],
      ["rate_limited", 429],
      ["not_covered", 404],
      ["upstream_unavailable", 502],
      ["invalid_response", 502],
      ["aborted", 502],
    ] as const;
    for (const [code, status] of cases) {
      fixture.loadOverview.mockRejectedValueOnce(
        new PersonalMarketDataProviderError(code),
      );
      const response = await requestOverview(fixture.app, fixture.cookie, {
        listingId: "lst-00000",
        range: "3m",
        symbol: "S00000",
      });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({
        detail: "The personal market-data request was not accepted.",
        status,
      });
      expect(response.payload).not.toContain(code);
    }
  });

  it("removes annual-financial abort listeners after a completed response", async () => {
    const admission = buildTestSecurityMasterAdmission();
    const catalog = admitPersonalSecurityMasterSnapshot({
      expectedSha256: admission.expectedSha256,
      snapshot: admission.snapshot,
    });
    const secret = randomBytes(32).toString("hex");
    const authority = PersonalOwnerSessionAuthority.create(secret);
    let requestRaw: IncomingMessage | undefined;
    let replyRaw: ServerResponse | undefined;
    let initialRequestAbortListeners: readonly unknown[] = [];
    let initialReplyCloseListeners: readonly unknown[] = [];
    let routeRequestAbortListener: unknown;
    let routeReplyCloseListener: unknown;
    const loadAnnualFinancials = vi.fn(
      (
        identity: PersonalMarketDataIdentityDto,
        signal?: AbortSignal,
      ): Promise<PersonalAnnualFinancialsDto> => {
        const addedRequestListeners =
          requestRaw
            ?.listeners("aborted")
            .filter(
              (listener) => !initialRequestAbortListeners.includes(listener),
            ) ?? [];
        const addedReplyListeners =
          replyRaw
            ?.listeners("close")
            .filter(
              (listener) => !initialReplyCloseListeners.includes(listener),
            ) ?? [];
        expect(addedRequestListeners).toHaveLength(1);
        expect(addedReplyListeners).toHaveLength(1);
        [routeRequestAbortListener] = addedRequestListeners;
        [routeReplyCloseListener] = addedReplyListeners;
        expect(signal?.aborted).toBe(false);
        return Promise.resolve(annualFinancials(identity));
      },
    );
    const provider: PersonalMarketDataProvider = {
      close: vi.fn(),
      getStatus: () => STATUS,
      loadAnnualFinancials,
      loadOverview: (identity, range, signal) => {
        void signal;
        return Promise.resolve(overview(identity, range));
      },
      status: () => STATUS,
    };
    const app = Fastify({ bodyLimit: 300 * 1_024, trustProxy: false });
    await registerPersonalOwnerSessionRoutes(app, authority, LISTEN_OPTIONS);
    app.addHook("preHandler", async (request, reply) => {
      if (request.url !== PERSONAL_ANNUAL_FINANCIALS_PATH) return;
      requestRaw = request.raw;
      replyRaw = reply.raw;
      initialRequestAbortListeners = request.raw.listeners("aborted");
      initialReplyCloseListeners = reply.raw.listeners("close");
    });
    registerPersonalWorkspaceMarketDataRoutes(
      app,
      catalog,
      provider,
      authority,
      LISTEN_OPTIONS,
    );
    applications.push(app);
    authorities.push(authority);
    const cookie = await bootstrapTestPersonalOwnerSession(app, secret);

    const response = await requestAnnualFinancials(app, cookie, {
      listingId: "lst-00000",
      symbol: "S00000",
    });
    expect(response.statusCode).toBe(200);
    expect(loadAnnualFinancials).toHaveBeenCalledOnce();
    expect(requestRaw?.listeners("aborted")).not.toContain(
      routeRequestAbortListener,
    );
    expect(replyRaw?.listeners("close")).not.toContain(routeReplyCloseListener);
  });

  it("aborts provider work when the response connection closes after body parsing", async () => {
    const admission = buildTestSecurityMasterAdmission();
    const catalog = admitPersonalSecurityMasterSnapshot({
      expectedSha256: admission.expectedSha256,
      snapshot: admission.snapshot,
    });
    const secret = randomBytes(32).toString("hex");
    const authority = PersonalOwnerSessionAuthority.create(secret);
    let providerSignal: AbortSignal | undefined;
    let resolveStarted: (() => void) | undefined;
    let resolveProvider:
      ((value: PersonalMarketOverviewDto) => void) | undefined;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const loadOverview = vi.fn(
      (
        identity: PersonalMarketDataIdentityDto,
        range: "1m" | "3m" | "ytd" | "1y" | "5y" | "10y",
        signal?: AbortSignal,
      ) =>
        new Promise<PersonalMarketOverviewDto>((resolve, reject) => {
          providerSignal = signal;
          resolveProvider = resolve;
          signal?.addEventListener(
            "abort",
            () => reject(new PersonalMarketDataProviderError("aborted")),
            { once: true },
          );
          resolveStarted?.();
          void identity;
          void range;
        }),
    );
    const provider: PersonalMarketDataProvider = {
      close: vi.fn(),
      getStatus: () => STATUS,
      loadAnnualFinancials: (identity, signal) => {
        void signal;
        return Promise.resolve(annualFinancials(identity));
      },
      loadOverview,
      status: () => STATUS,
    };
    const app = Fastify({ bodyLimit: 300 * 1_024, trustProxy: false });
    await registerPersonalOwnerSessionRoutes(app, authority, {
      host: "127.0.0.1",
      port: 0,
    });
    registerPersonalWorkspaceMarketDataRoutes(
      app,
      catalog,
      provider,
      authority,
      { host: "127.0.0.1", port: 0 },
    );
    applications.push(app);
    authorities.push(authority);
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const authorityHost = new URL(address).host;
    const token = authority.bootstrap(secret, {
      authority: authorityHost,
      origin: "http://127.0.0.1:3000",
    });
    expect(token).toBeDefined();

    const controller = new AbortController();
    const pending = fetch(
      new URL(PERSONAL_MARKET_DATA_OVERVIEW_PATH, address),
      {
        body: JSON.stringify({
          listingId: "lst-00000",
          range: "1y",
          symbol: "S00000",
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Cookie: `${PERSONAL_OWNER_SESSION_COOKIE_NAME}=${token ?? ""}`,
          Origin: "http://127.0.0.1:3000",
        },
        method: "POST",
        signal: controller.signal,
      },
    );
    await started;
    controller.abort();
    await pending.catch(() => undefined);
    try {
      await vi.waitFor(() => expect(providerSignal?.aborted).toBe(true));
      expect(loadOverview).toHaveBeenCalledOnce();
    } finally {
      resolveProvider?.(overview(IDENTITY, "1y"));
    }
  });

  it("aborts annual-financial provider work when the response connection closes", async () => {
    const admission = buildTestSecurityMasterAdmission();
    const catalog = admitPersonalSecurityMasterSnapshot({
      expectedSha256: admission.expectedSha256,
      snapshot: admission.snapshot,
    });
    const secret = randomBytes(32).toString("hex");
    const authority = PersonalOwnerSessionAuthority.create(secret);
    let providerSignal: AbortSignal | undefined;
    let resolveStarted: (() => void) | undefined;
    let resolveProvider:
      ((value: PersonalAnnualFinancialsDto) => void) | undefined;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const loadAnnualFinancials = vi.fn(
      (identity: PersonalMarketDataIdentityDto, signal?: AbortSignal) =>
        new Promise<PersonalAnnualFinancialsDto>((resolve, reject) => {
          providerSignal = signal;
          resolveProvider = resolve;
          signal?.addEventListener(
            "abort",
            () => reject(new PersonalMarketDataProviderError("aborted")),
            { once: true },
          );
          resolveStarted?.();
          void identity;
        }),
    );
    const provider: PersonalMarketDataProvider = {
      close: vi.fn(),
      getStatus: () => STATUS,
      loadAnnualFinancials,
      loadOverview: (identity, range, signal) => {
        void signal;
        return Promise.resolve(overview(identity, range));
      },
      status: () => STATUS,
    };
    const app = Fastify({ bodyLimit: 300 * 1_024, trustProxy: false });
    await registerPersonalOwnerSessionRoutes(app, authority, {
      host: "127.0.0.1",
      port: 0,
    });
    registerPersonalWorkspaceMarketDataRoutes(
      app,
      catalog,
      provider,
      authority,
      { host: "127.0.0.1", port: 0 },
    );
    applications.push(app);
    authorities.push(authority);
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const authorityHost = new URL(address).host;
    const token = authority.bootstrap(secret, {
      authority: authorityHost,
      origin: "http://127.0.0.1:3000",
    });
    expect(token).toBeDefined();

    const controller = new AbortController();
    const pending = fetch(new URL(PERSONAL_ANNUAL_FINANCIALS_PATH, address), {
      body: JSON.stringify({ listingId: "lst-00000", symbol: "S00000" }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Cookie: `${PERSONAL_OWNER_SESSION_COOKIE_NAME}=${token ?? ""}`,
        Origin: "http://127.0.0.1:3000",
      },
      method: "POST",
      signal: controller.signal,
    });
    await started;
    controller.abort();
    await pending.catch(() => undefined);
    try {
      await vi.waitFor(() => expect(providerSignal?.aborted).toBe(true));
      expect(loadAnnualFinancials).toHaveBeenCalledOnce();
    } finally {
      resolveProvider?.(annualFinancials(IDENTITY));
    }
  });

  it("rejects session loss, query carriers, and mismatched provider identity", async () => {
    const fixture = await marketApp();
    const queryCarrier = await fixture.app.inject({
      method: "POST",
      url: `${PERSONAL_MARKET_DATA_OVERVIEW_PATH}?symbol=S00000`,
      headers: {
        ...ownerHeaders(fixture.cookie),
        "content-type": "application/json",
      },
      payload: { listingId: "lst-00000", range: "1m", symbol: "S00000" },
      remoteAddress: "127.0.0.1",
    });
    expect(queryCarrier.statusCode).toBe(403);

    fixture.loadOverview.mockResolvedValueOnce(
      overview({ ...IDENTITY, listingId: "lst-fabricated" }, "1m"),
    );
    const mismatched = await requestOverview(fixture.app, fixture.cookie, {
      listingId: "lst-00000",
      range: "1m",
      symbol: "S00000",
    });
    expect(mismatched.statusCode).toBe(502);

    fixture.authority.close();
    const lost = await requestOverview(fixture.app, fixture.cookie, {
      listingId: "lst-00000",
      range: "1m",
      symbol: "S00000",
    });
    expect(lost.statusCode).toBe(403);
  });
});

async function marketApp() {
  const admission = buildTestSecurityMasterAdmission();
  const catalog = admitPersonalSecurityMasterSnapshot({
    expectedSha256: admission.expectedSha256,
    snapshot: admission.snapshot,
  });
  const secret = randomBytes(32).toString("hex");
  const authority = PersonalOwnerSessionAuthority.create(secret);
  const { loadAnnualFinancials, loadOverview, provider } = fakeProvider();
  const vault = {
    close: vi.fn(),
    profile: LOCAL_RESEARCH_VAULT_PROFILE,
  } as unknown as LocalResearchVault;
  const app = await buildPersonalWorkspaceApp(
    catalog,
    vault,
    authority,
    LISTEN_OPTIONS,
    provider,
  );
  applications.push(app);
  authorities.push(authority);
  const cookie = await bootstrapTestPersonalOwnerSession(app, secret);
  return {
    app,
    authority,
    cookie,
    loadAnnualFinancials,
    loadOverview,
  };
}

function fakeProvider(close = vi.fn()) {
  const loadAnnualFinancials = vi.fn(
    (identity: PersonalMarketDataIdentityDto, signal?: AbortSignal) => {
      void signal;
      return Promise.resolve(annualFinancials(identity));
    },
  );
  const loadOverview = vi.fn(
    (
      identity: PersonalMarketDataIdentityDto,
      range: "1m" | "3m" | "ytd" | "1y" | "5y" | "10y",
      signal?: AbortSignal,
    ) => {
      void signal;
      return Promise.resolve(overview(identity, range));
    },
  );
  const provider: PersonalMarketDataProvider = {
    close,
    getStatus: () => STATUS,
    loadAnnualFinancials,
    loadOverview,
    status: () => STATUS,
  };
  return { loadAnnualFinancials, loadOverview, provider };
}

function requestAnnualFinancials(
  app: FastifyInstance,
  cookie: string,
  payload: Record<string, unknown> | unknown[],
) {
  return app.inject({
    method: "POST",
    url: PERSONAL_ANNUAL_FINANCIALS_PATH,
    headers: {
      ...ownerHeaders(cookie),
      "content-type": "application/json",
    },
    payload,
    remoteAddress: "127.0.0.1",
  });
}

function requestOverview(
  app: FastifyInstance,
  cookie: string,
  payload: Record<string, unknown> | unknown[],
) {
  return app.inject({
    method: "POST",
    url: PERSONAL_MARKET_DATA_OVERVIEW_PATH,
    headers: {
      ...ownerHeaders(cookie),
      "content-type": "application/json",
    },
    payload,
    remoteAddress: "127.0.0.1",
  });
}

function ownerHeaders(cookie?: string): Record<string, string> {
  return {
    accept: "application/json",
    ...(cookie === undefined ? {} : { cookie }),
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
  };
}

function annualFinancials(
  identity: PersonalMarketDataIdentityDto,
): PersonalAnnualFinancialsDto {
  return {
    asOf: "2026-09-07T15:00:00.000Z",
    coverage: {
      earliestFiscalYear: 2025,
      knownReportedCells: 1,
      latestFiscalYear: 2025,
      missingFiscalYears: [
        2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016,
      ],
      requestedAnnualYears: 10,
      returnedAnnualYears: 1,
      status: "partial",
      unknownReportedCells: 29,
    },
    profile: "personal_single_user_local_fundamentals",
    provider: FINANCIALS_PROVIDER,
    schemaVersion: "1.0.0",
    security: identity,
    status: "available",
    years: [
      {
        fiscalYear: 2025,
        periodEnd: "2026-02-20",
        reported: annualReportedValues(),
      },
    ],
  };
}

function annualReportedValues(): PersonalAnnualFinancialReportedValuesDto {
  const unknown = {
    reason: "not_supplied_by_provider",
    status: "unknown",
    value: null,
  } as const;
  return {
    accounts_receivable: unknown,
    assets: unknown,
    capital_expenditures: unknown,
    cash: unknown,
    cost_of_revenue: unknown,
    current_assets: unknown,
    current_liabilities: unknown,
    debt: unknown,
    depreciation_and_amortization: unknown,
    ebitda: unknown,
    financing_cash_flow: unknown,
    free_cash_flow: unknown,
    gross_profit: unknown,
    income_tax_expense: unknown,
    intangibles: unknown,
    interest_expense: unknown,
    inventory: unknown,
    investing_cash_flow: unknown,
    liabilities: unknown,
    net_income: unknown,
    operating_cash_flow: unknown,
    operating_expenses: unknown,
    operating_income: unknown,
    pretax_income: unknown,
    property_plant_equipment_net: unknown,
    research_and_development: unknown,
    revenue: { status: "known", value: "1000000" },
    selling_general_and_administrative: unknown,
    share_based_compensation: unknown,
    shareholders_equity: unknown,
  };
}

function overview(
  identity: PersonalMarketDataIdentityDto,
  range: "1m" | "3m" | "ytd" | "1y" | "5y" | "10y",
): PersonalMarketOverviewDto {
  return {
    history: {
      bars: [
        {
          adjusted: {
            close: "101.00",
            high: "102.00",
            low: "99.00",
            open: "100.00",
            volume: "1000",
          },
          date: "2026-09-04",
          dividendCash: "0.00",
          raw: {
            close: "101.00",
            high: "102.00",
            low: "99.00",
            open: "100.00",
            volume: "1000",
          },
          splitFactor: "1.00",
        },
      ],
      endDate: "2026-09-07",
      range,
      startDate: "2026-08-07",
    },
    profile: "personal_single_user_local_market_data",
    provider: STATUS.provider,
    quote: {
      change: "1.00",
      changePercent: "1.00",
      currency: "USD",
      freshness: "current",
      ingestedAt: "2026-09-07T15:00:00.000Z",
      kind: "derived_realtime_reference",
      previousClose: "100.00",
      price: "101.00",
      sourceTime: "2026-09-07T14:59:00.000Z",
    },
    schemaVersion: "1.0.0",
    security: identity,
    status: "available",
  };
}
