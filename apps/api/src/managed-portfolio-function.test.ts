import { createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  MANAGED_PORTFOLIO_PATH,
  encodePortfolioPayload,
  type ManagedPortfolioCommand,
} from "@research-cockpit/contracts";
import { Client } from "node-appwrite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as authModule from "./clerk-trial-auth";
import * as portfolioModule from "./appwrite-portfolio-repository";
import * as watchlistModule from "./appwrite-watchlist-repository";
import * as followupsModule from "./appwrite-research-followups-repository";
import * as transportModule from "./appwrite-transport";
import { MANAGED_PORTFOLIO_STORAGE_ENVIRONMENT_KEY } from "./managed-portfolio-config";
import {
  createManagedWorkspaceFunction,
  type ManagedWorkspaceFunctionContext,
} from "./managed-workspace-function";
import type { PortfolioRepository } from "./portfolio-repository";

const ORIGIN = "https://app.investingpro.app";
const ISSUER = "https://clerk.investingpro.app";
const SUBJECT = "user_inventedPortfolioOwner";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
function configuration() {
  return {
    environment: "production",
    auth: {
      issuer: ISSUER,
      jwtKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
      allowedSubject: SUBJECT,
      authorizedParties: [ORIGIN],
    },
    allowedOrigins: [ORIGIN],
  };
}
function token(origin: string) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    { alg: "RS256", typ: "JWT", kid: "invented-portfolio" },
    {
      iss: ISSUER,
      sub: SUBJECT,
      ...(origin === ORIGIN ? { azp: ORIGIN } : {}),
      sid: "sess_inventedPortfolio",
      iat: now,
      nbf: now - 1,
      exp: now + 120,
      v: 2,
      sts: "active",
    },
  ]
    .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
    .join(".");
  return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), keys.privateKey).toString("base64url")}`;
}
function command(): ManagedPortfolioCommand {
  return {
    expectedVersion: 0,
    idempotencyKey: "invented-portfolio-function",
    payload: {
      schemaVersion: 3,
      name: "My Portfolio",
      currency: "USD",
      basisMethod: "fifo_with_opening_pool",
      snapshotSha256: `sha256:${"b".repeat(64)}`,
      identities: [],
      opening: { asOfDate: "2026-10-01", cashUsd: null, holdings: [] },
      transactions: [],
    },
  };
}
function context(
  origin = ORIGIN,
  method = "GET",
): ManagedWorkspaceFunctionContext {
  return {
    req: {
      method,
      path: MANAGED_PORTFOLIO_PATH,
      queryString: "",
      bodyBinary:
        method === "POST"
          ? Buffer.from(JSON.stringify(command()))
          : Buffer.alloc(0),
      headers: {
        origin,
        authorization: `Bearer ${token(origin)}`,
        "x-appwrite-key": "invented-portfolio-authority",
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
    },
    res: {
      json: (body, status, headers) => ({ body, status, headers }),
      text: (body, status, headers) => ({
        body: JSON.parse(body) as unknown,
        status,
        headers,
      }),
    },
  };
}
function fixture() {
  const get = vi.fn<PortfolioRepository["get"]>().mockResolvedValue(null);
  const put = vi
    .fn<PortfolioRepository["put"]>()
    .mockImplementation((_principal, input) =>
      Promise.resolve({
        id: "main",
        version: input.expectedVersion + 1,
        replayed: false,
        committedAt: "2026-10-16T12:00:00.000Z",
        digestSha256: createHash("sha256")
          .update(encodePortfolioPayload(input.payload))
          .digest("hex"),
      }),
    );
  const repository = vi
    .spyOn(portfolioModule, "createAppwritePortfolioRepository")
    .mockReturnValue({ get, put });
  const watchlist = vi.spyOn(
    watchlistModule,
    "createAppwriteWatchlistRepository",
  );
  const followups = vi.spyOn(
    followupsModule,
    "createAppwriteResearchFollowupsRepository",
  );
  const transport = vi.spyOn(transportModule, "createAppwriteTransport");
  return { get, put, repository, watchlist, followups, transport };
}
function isolated(f: ReturnType<typeof fixture>) {
  expect(f.watchlist).not.toHaveBeenCalled();
  expect(f.followups).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  for (const result of f.transport.mock.results) {
    const transport = result.value as ReturnType<
      typeof transportModule.createAppwriteTransport
    >;
    expect(transport.snapshot()).toEqual({
      closed: true,
      requests: 0,
      lastStatus: null,
    });
  }
}
beforeEach(() => {
  vi.stubEnv(MANAGED_PORTFOLIO_STORAGE_ENVIRONMENT_KEY, "true");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected network");
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each([ORIGIN, "https://localhost"])(
  "uses verified %s identity and fixed separate resources for GET and POST",
  async (origin) => {
    const f = fixture(),
      run = createManagedWorkspaceFunction(configuration(), null, null);
    expect(await run(context(origin))).toMatchObject({
      status: 200,
      body: { version: 0, payload: null },
      headers: {
        "cache-control": "no-store",
        "access-control-allow-origin": origin,
      },
    });
    expect(await run(context(origin, "POST"))).toMatchObject({
      status: 200,
      body: { version: 1, payload: command().payload, replayed: false },
    });
    const principal = {
      userId: `clerk-${createHash("sha256")
        .update(JSON.stringify([ISSUER, SUBJECT]))
        .digest("hex")
        .slice(0, 30)}`,
    };
    expect(f.get).toHaveBeenCalledExactlyOnceWith(principal);
    expect(f.put).toHaveBeenCalledExactlyOnceWith(principal, command());
    expect(f.repository).toHaveBeenCalledTimes(2);
    expect(f.transport).toHaveBeenCalledTimes(2);
    for (const [options] of f.repository.mock.calls) {
      expect(options).toMatchObject({
        databaseId: "investment_managed_portfolio_v1",
        portfoliosTableId: "portfolios",
        receiptsTableId: "receipts",
      });
      expect(Object.keys(options.store).sort()).toEqual([
        "createRow",
        "createTransaction",
        "getRow",
        "incrementRowColumn",
        "updateRow",
        "updateTransaction",
      ]);
    }
    expect(f.repository.mock.calls[0]![0].store).not.toBe(
      f.repository.mock.calls[1]![0].store,
    );
    isolated(f);
  },
);

it.each([undefined, "false", "TRUE", " true", "invalid"])(
  "keeps disabled setting %s from opening Portfolio and leaves catalog usable",
  async (setting) => {
    vi.stubEnv(MANAGED_PORTFOLIO_STORAGE_ENVIRONMENT_KEY, setting);
    const f = fixture(),
      run = createManagedWorkspaceFunction(configuration(), null, null);
    for (const method of ["GET", "POST"])
      expect(await run(context(ORIGIN, method))).toMatchObject({
        status: 503,
        body: { error: "unavailable" },
      });
    const read = context();
    expect(
      await run({ ...read, req: { ...read.req, path: "/v1/managed/catalog" } }),
    ).toMatchObject({ status: 200 });
    expect(f.repository).not.toHaveBeenCalled();
    expect(f.transport).not.toHaveBeenCalled();
    isolated(f);
  },
);

it("captures enable setting, authority and binary command before authentication awaits", async () => {
  const f = fixture(),
    actual = authModule.createClerkTrialAuth;
  let release!: () => void, entered!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  vi.spyOn(authModule, "createClerkTrialAuth").mockImplementation((options) => {
    const auth = actual(options);
    return async (request) => {
      entered();
      await held;
      return auth(request);
    };
  });
  const key = vi.spyOn(Client.prototype, "setKey");
  const run = createManagedWorkspaceFunction(configuration(), null, null),
    input = context(ORIGIN, "POST");
  const pending = run(input);
  await waiting;
  vi.stubEnv(MANAGED_PORTFOLIO_STORAGE_ENVIRONMENT_KEY, "false");
  (input.req.headers as Record<string, string>)["x-appwrite-key"] =
    "invented-mutated-authority";
  input.req.bodyBinary.fill(0);
  release();
  expect(await pending).toMatchObject({ status: 200 });
  expect(key).toHaveBeenCalledExactlyOnceWith("invented-portfolio-authority");
  expect(f.put.mock.calls[0]?.[1]).toEqual(command());
  isolated(f);
});

it("leaves existing Watchlist and Follow-ups routes usable with an invalid Portfolio setting", async () => {
  vi.stubEnv(MANAGED_PORTFOLIO_STORAGE_ENVIRONMENT_KEY, "invalid");
  const f = fixture();
  const unusedWrite = () =>
    Promise.reject(new Error("Unexpected existing-resource write"));
  f.watchlist.mockReturnValue({
    get: () => Promise.resolve(null),
    put: unusedWrite,
  });
  f.followups.mockReturnValue({
    get: () => Promise.resolve(null),
    put: unusedWrite,
  });
  const run = createManagedWorkspaceFunction(configuration(), null, null),
    input = context();
  expect(
    await run({
      ...input,
      req: { ...input.req, path: "/v1/managed/watchlist" },
    }),
  ).toMatchObject({
    status: 200,
    body: { version: 0, payload: { name: "My Watchlist", memberships: [] } },
  });
  expect(
    await run({
      ...input,
      req: { ...input.req, path: "/v1/managed/research-followups" },
    }),
  ).toMatchObject({
    status: 200,
    body: { version: 0, payload: { schemaVersion: 1, entries: [] } },
  });
  expect(f.watchlist).toHaveBeenCalledOnce();
  expect(f.followups).toHaveBeenCalledOnce();
  expect(f.repository).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  for (const result of f.transport.mock.results)
    expect(
      (
        result.value as ReturnType<
          typeof transportModule.createAppwriteTransport
        >
      ).snapshot().closed,
    ).toBe(true);
});

it("fails closed without execution authority before opening transport", async () => {
  const f = fixture(),
    input = context(),
    run = createManagedWorkspaceFunction(configuration(), null, null);
  expect(
    await run({
      ...input,
      req: {
        ...input.req,
        headers: {
          origin: ORIGIN,
          authorization: input.req.headers.authorization,
        },
      },
    }),
  ).toMatchObject({ status: 503, body: { error: "unavailable" } });
  expect(f.transport).not.toHaveBeenCalled();
  expect(f.repository).not.toHaveBeenCalled();
});

it.each(["query", "body-cap", "utf8", "method", "read-body"])(
  "rejects bridge/request %s before storage",
  async (condition) => {
    const f = fixture(),
      input = context(ORIGIN, "POST");
    const req = {
      ...input.req,
      ...(condition === "query" ? { queryString: "resource=watchlist" } : {}),
      ...(condition === "body-cap" ? { bodyBinary: Buffer.alloc(266241) } : {}),
      ...(condition === "utf8" ? { bodyBinary: Buffer.from([0xff]) } : {}),
      ...(condition === "method"
        ? { method: "DELETE", bodyBinary: Buffer.alloc(0) }
        : {}),
      ...(condition === "read-body" ? { method: "GET" } : {}),
    };
    expect(
      await createManagedWorkspaceFunction(
        configuration(),
        null,
        null,
      )({ ...input, req }),
    ).toMatchObject({
      status:
        condition === "body-cap" ? 413 : condition === "method" ? 405 : 400,
    });
    expect(f.repository).not.toHaveBeenCalled();
    expect(f.transport).not.toHaveBeenCalled();
  },
);

it("preserves post-write bridge failure as unknown without another Save", async () => {
  const f = fixture(),
    input = context(ORIGIN, "POST");
  const result = await createManagedWorkspaceFunction(
    configuration(),
    null,
    null,
  )({
    ...input,
    res: {
      ...input.res,
      text() {
        throw new Error("Invented lost bridge response");
      },
    },
  });
  expect(result).toMatchObject({
    status: 503,
    body: { error: "commit_unknown" },
  });
  expect(f.put).toHaveBeenCalledOnce();
  isolated(f);
});
