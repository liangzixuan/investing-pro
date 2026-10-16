import { afterEach, expect, it, vi } from "vitest";
import {
  MANAGED_PORTFOLIO_LIMITS,
  type ManagedPortfolioCommand,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import { createManagedApi } from "./managed-api";
import type { TrialSession } from "./session";

function command(): ManagedPortfolioCommand {
  return {
    expectedVersion: 0,
    idempotencyKey: "portfolio-command-0001",
    payload: {
      schemaVersion: 3,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: `sha256:${"a".repeat(64)}`,
      basisMethod: "fifo_with_opening_pool",
      identities: [
        {
          country: "US",
          exchangeMic: "XNAS",
          instrumentType: "common_stock",
          issuerId: "issuer-invented",
          issuerName: "Invented issuer",
          listingId: "listing-invented",
          securityId: "security-invented",
          securityName: "Invented common stock",
          shareClassId: "class-invented",
          shareClassName: "Class A",
          symbol: "ZERO",
        },
      ],
      opening: { asOfDate: "2026-10-01", cashUsd: "1000.00", holdings: [] },
      transactions: [
        {
          id: "buy-invented",
          date: "2026-10-02",
          type: "buy",
          listingId: "listing-invented",
          shares: "2.000000",
          grossUsd: "200.00",
          feeUsd: "1.00",
        },
      ],
    },
  };
}
function fixture() {
  const session: TrialSession = {
    userId: "user_synthetic",
    sessionId: "session_synthetic",
    getToken: vi
      .fn<TrialSession["getToken"]>()
      .mockResolvedValue("synthetic-token"),
    signOut: vi.fn(),
  };
  const fetcher = vi.fn<typeof fetch>();
  return {
    session,
    fetcher,
    api: createManagedApi("https://managed.example.invalid", session, fetcher),
    signal: new AbortController().signal,
  };
}
afterEach(() => vi.restoreAllMocks());

it("loads explicit absence, then saves and reopens only the fixed portfolio route", async () => {
  const { api, fetcher, session, signal } = fixture();
  const input = command();
  fetcher
    .mockResolvedValueOnce(Response.json({ version: 0, payload: null }))
    .mockResolvedValueOnce(
      Response.json({ version: 1, payload: input.payload, replayed: false }),
    )
    .mockResolvedValueOnce(
      Response.json({ version: 1, payload: input.payload }),
    );
  expect(await api.loadPortfolio(signal)).toEqual({
    version: 0,
    payload: null,
  });
  expect(await api.savePortfolio(input, signal)).toEqual({
    version: 1,
    payload: input.payload,
    replayed: false,
  });
  expect(await api.loadPortfolio(signal)).toEqual({
    version: 1,
    payload: input.payload,
  });
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(
    Array(3).fill("https://managed.example.invalid/v1/managed/portfolio"),
  );
  expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual([
    "GET",
    "POST",
    "GET",
  ]);
  for (const [, init] of fetcher.mock.calls)
    expect(init).toMatchObject({
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: { Authorization: "Bearer synthetic-token" },
    });
  expect(session.getToken).toHaveBeenCalledTimes(3);
  expect(JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string)).toEqual(input);
});

it("captures the exact authored command before waiting for a bearer token", async () => {
  const { api, session, fetcher, signal } = fixture();
  let release!: (token: string) => void;
  vi.mocked(session.getToken).mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const input = structuredClone(command()),
    expected = structuredClone(input);
  const saving = api.savePortfolio(input, signal);
  Object.assign(input.payload.transactions[0]!, { grossUsd: "300.00" });
  Object.assign(input.payload.identities[0]!, { symbol: "CHANGED" });
  fetcher.mockResolvedValue(
    Response.json({ version: 1, payload: expected.payload, replayed: true }),
  );
  release("synthetic-token");
  expect(await saving).toEqual({
    version: 1,
    payload: expected.payload,
    replayed: true,
  });
  expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual(
    expected,
  );
});

it("rejects an invalid ledger before token retrieval or dispatch", async () => {
  const { api, session, fetcher, signal } = fixture();
  const input = structuredClone(command());
  Object.assign(input.payload.transactions[0]!, { type: "sell" });
  await expect(api.savePortfolio(input, signal)).rejects.toEqual(
    new TrialApiError("invalid_request"),
  );
  expect(session.getToken).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([
  [0, command().payload],
  [1, null],
  [-1, null],
] as const)(
  "rejects a mismatched initial/saved version %s",
  async (version, payload) => {
    const { api, fetcher, signal } = fixture();
    fetcher.mockResolvedValue(Response.json({ version, payload }));
    await expect(api.loadPortfolio(signal)).rejects.toEqual(
      new TrialApiError("invalid_response"),
    );
  },
);

it.each(["version", "payload", "extra", "replayed"] as const)(
  "rejects an acknowledgement with wrong %s",
  async (change) => {
    const { api, fetcher, signal } = fixture();
    const input = command();
    const result = {
      version: 1,
      payload: structuredClone(input.payload),
      replayed: false,
    };
    if (change === "version") result.version++;
    if (change === "payload")
      Object.assign(result.payload.transactions[0]!, { grossUsd: "201.00" });
    if (change === "extra") Object.assign(result, { owner: "untrusted" });
    if (change === "replayed") Object.assign(result, { replayed: "true" });
    fetcher.mockResolvedValue(Response.json(result));
    await expect(api.savePortfolio(input, signal)).rejects.toEqual(
      new TrialApiError("invalid_response"),
    );
  },
);

it.each([
  [409, "conflict"],
  [409, "idempotency_conflict"],
  [503, "commit_unknown"],
  [503, "unavailable"],
] as const)(
  "keeps the portfolio write outcome %i/%s finite",
  async (status, code) => {
    const { api, fetcher, signal } = fixture();
    fetcher.mockResolvedValue(Response.json({ error: code }, { status }));
    await expect(api.savePortfolio(command(), signal)).rejects.toEqual(
      new TrialApiError(code),
    );
    expect(fetcher).toHaveBeenCalledOnce();
  },
);

it("rejects another resource's refusal without retargeting or retrying", async () => {
  const { api, fetcher, signal } = fixture();
  fetcher.mockResolvedValue(
    Response.json({ error: "catalog_changed" }, { status: 409 }),
  );
  await expect(api.savePortfolio(command(), signal)).rejects.toEqual(
    new TrialApiError("invalid_response"),
  );
  expect(fetcher).toHaveBeenCalledOnce();
});

it.each([401, 403])(
  "handles %i without reading an untrusted upstream body",
  async (status) => {
    const { api, fetcher, signal } = fixture();
    fetcher.mockResolvedValue(
      new Response("untrusted upstream body", { status }),
    );
    await expect(api.loadPortfolio(signal)).rejects.toEqual(
      new TrialApiError(status === 401 ? "unauthenticated" : "access_denied"),
    );
  },
);

it("enforces the complete response byte and UTF-8 boundaries", async () => {
  const { api, fetcher, signal } = fixture();
  fetcher
    .mockResolvedValueOnce(
      new Response(" ".repeat(MANAGED_PORTFOLIO_LIMITS.envelopeBytes + 1), {
        headers: { "content-type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(new Uint8Array([0xff]), {
        headers: { "content-type": "application/json" },
      }),
    );
  for (let index = 0; index < 2; index++)
    await expect(api.loadPortfolio(signal)).rejects.toEqual(
      new TrialApiError("invalid_response"),
    );
});

it("cancels a held portfolio response before a late body can be admitted", async () => {
  const { api, fetcher } = fixture();
  const abort = new AbortController(),
    cancel = vi.fn();
  fetcher.mockResolvedValue(
    new Response(new ReadableStream({ cancel }), {
      headers: { "content-type": "application/json" },
    }),
  );
  const loading = api.loadPortfolio(abort.signal);
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  abort.abort();
  await expect(loading).rejects.toEqual(new TrialApiError("aborted"));
  expect(cancel).toHaveBeenCalledOnce();
});
