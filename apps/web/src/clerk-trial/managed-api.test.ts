import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MANAGED_CATALOG_LIMITS,
  MANAGED_WATCHLIST_LIMITS,
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  type ManagedCatalogSnapshotDto,
  type ManagedWatchlistCommand,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  createManagedApi,
  ManagedCatalogChangedError,
  ManagedAnnualCooldownError,
  ManagedAnnualReportError,
} from "./managed-api";
import {
  request as annualRequest,
  response as annualResponse,
} from "../features/research/sec-annual-evidence-fixture";
import * as annualDecoder from "../lib/sec-annual-evidence-response";
import type { TrialSession } from "./session";

const digest = `sha256:${"a".repeat(64)}` as const;
const payload = {
  name: "My Watchlist" as const,
  schemaVersion: 1 as const,
  snapshotSha256: digest,
  memberships: [],
};
const command: ManagedWatchlistCommand = {
  expectedVersion: 2,
  idempotencyKey: "synthetic-command-123",
  payload,
};
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "synthetic-catalog",
  catalogVersion: "synthetic-version",
  acquiredAt: "2026-09-29T00:00:00.000Z",
  generatedAt: "2026-09-30T00:00:00.000Z",
  asOf: "2026-09-30T12:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented engineering catalog",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 0,
    activeListings: 0,
    admittedSourceRecords: 0,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 0,
    providerMappings: 0,
    quarantinedSourceRecords: 0,
    sourceRecords: 0,
    staleSourceRecords: 0,
    shareClasses: 0,
    totalSecurities: 0,
    unsupportedSourceRecords: 0,
  },
};
const origin = "https://managed.example.invalid";
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
    api: createManagedApi(origin, session, fetcher),
    abort: new AbortController(),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("managed browser transport", () => {
  it("uses fixed routes, fresh session tokens and private bearer transport", async () => {
    const { api, fetcher, session, abort } = fixture();
    fetcher
      .mockResolvedValueOnce(Response.json({ snapshot }))
      .mockResolvedValueOnce(
        Response.json({
          snapshot,
          results: [],
          totalMatches: 0,
          limitApplied: 25,
          normalizedQuery: "A & B",
        }),
      )
      .mockResolvedValueOnce(Response.json({ version: 2, payload }))
      .mockResolvedValueOnce(
        Response.json({ version: 3, payload, replayed: true }),
      )
      .mockResolvedValueOnce(
        Response.json({
          snapshotSha256: digest,
          results: [{ listingId: "listing-one", listing: null }],
        }),
      );
    await api.status(abort.signal);
    await api.search("A & B", abort.signal);
    await api.load(abort.signal);
    await api.save(command, abort.signal);
    await api.resolve(
      { snapshotSha256: digest, listingIds: ["listing-one"] },
      abort.signal,
    );
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      `${origin}/v1/managed/catalog`,
      `${origin}/v1/managed/catalog/search?q=A%20%26%20B`,
      `${origin}/v1/managed/watchlist`,
      `${origin}/v1/managed/watchlist`,
      `${origin}/v1/managed/catalog/resolve`,
    ]);
    expect(session.getToken).toHaveBeenCalledTimes(5);
    for (const [, init] of fetcher.mock.calls)
      expect(init).toMatchObject({
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        headers: { Authorization: "Bearer synthetic-token" },
      });
    expect(
      JSON.parse(fetcher.mock.calls[3]?.[1]?.body as string) as unknown,
    ).toEqual(command);
    expect(fetcher.mock.calls[4]?.[1]?.method).toBe("POST");
  });

  it("owns the command and resolve IDs before waiting for a token", async () => {
    const { api, fetcher, session, abort } = fixture();
    const token = deferred<string | null>();
    vi.mocked(session.getToken).mockReturnValue(token.promise);
    const input = {
      ...command,
      payload: {
        ...command.payload,
        memberships: [...command.payload.memberships],
      },
    };
    const ids = ["listing-one"];
    const saving = api.save(input, abort.signal);
    const resolving = api.resolve(
      { snapshotSha256: digest, listingIds: ids },
      abort.signal,
    );
    input.payload.snapshotSha256 = `sha256:${"b".repeat(64)}`;
    ids[0] = "different-listing";
    fetcher
      .mockResolvedValueOnce(
        Response.json({ version: 3, payload, replayed: false }),
      )
      .mockResolvedValueOnce(
        Response.json({
          snapshotSha256: digest,
          results: [{ listingId: "listing-one", listing: null }],
        }),
      );
    token.resolve("synthetic-token");
    await saving;
    await resolving;
    expect(
      JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as unknown,
    ).toEqual(command);
    expect(
      JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string) as unknown,
    ).toEqual({ snapshotSha256: digest, listingIds: ["listing-one"] });
  });

  it.each(["", " ", "x".repeat(129), "bad\u0000query", "\ud800"])(
    "rejects invalid search locally %#",
    async (query) => {
      const { api, fetcher, session, abort } = fixture();
      await expect(api.search(query, abort.signal)).rejects.toMatchObject({
        code: "invalid_request",
      });
      expect(fetcher).not.toHaveBeenCalled();
      expect(session.getToken).not.toHaveBeenCalled();
    },
  );

  it.each([401, 403])(
    "retires through the shared finite error for status %i",
    async (status) => {
      const { api, fetcher, abort } = fixture();
      fetcher.mockResolvedValue(new Response("untrusted body", { status }));
      await expect(api.load(abort.signal)).rejects.toEqual(
        new TrialApiError(status === 401 ? "unauthenticated" : "access_denied"),
      );
    },
  );

  it.each([
    [400, "invalid_request"],
    [409, "conflict"],
    [409, "idempotency_conflict"],
    [413, "payload_too_large"],
    [415, "unsupported_media_type"],
    [503, "commit_unknown"],
  ] as const)(
    "preserves finite save rejection %i/%s",
    async (status, error) => {
      const { api, fetcher, abort } = fixture();
      fetcher.mockResolvedValue(Response.json({ error }, { status }));
      await expect(api.save(command, abort.signal)).rejects.toEqual(
        new TrialApiError(error),
      );
    },
  );

  it("keeps catalog_changed a read-only outcome and rejects write uncertainty on resolve", async () => {
    const { api, fetcher, abort } = fixture();
    const request = { snapshotSha256: digest, listingIds: ["listing-one"] };
    fetcher
      .mockResolvedValueOnce(
        Response.json({ error: "catalog_changed" }, { status: 409 }),
      )
      .mockResolvedValueOnce(
        Response.json({ error: "commit_unknown" }, { status: 503 }),
      );
    await expect(api.resolve(request, abort.signal)).rejects.toBeInstanceOf(
      ManagedCatalogChangedError,
    );
    await expect(api.resolve(request, abort.signal)).rejects.toEqual(
      new TrialApiError("invalid_response"),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    { version: 4, payload, replayed: false },
    {
      version: 3,
      payload: { ...payload, snapshotSha256: `sha256:${"b".repeat(64)}` },
      replayed: false,
    },
    { version: 3, payload, replayed: true, principal: "not-public" },
  ])("rejects a receipt that is not the captured command %#", async (body) => {
    const { api, fetcher, abort } = fixture();
    fetcher.mockResolvedValue(Response.json(body));
    await expect(api.save(command, abort.signal)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("rejects resolve omission, reorder and digest drift", async () => {
    const { api, fetcher, abort } = fixture();
    const request = {
      snapshotSha256: digest,
      listingIds: ["listing-one", "listing-two"],
    };
    for (const body of [
      { snapshotSha256: digest, results: [] },
      {
        snapshotSha256: digest,
        results: [
          { listingId: "listing-two", listing: null },
          { listingId: "listing-one", listing: null },
        ],
      },
      {
        snapshotSha256: `sha256:${"b".repeat(64)}`,
        results: [
          { listingId: "listing-one", listing: null },
          { listingId: "listing-two", listing: null },
        ],
      },
    ]) {
      fetcher.mockResolvedValueOnce(Response.json(body));
      await expect(api.resolve(request, abort.signal)).rejects.toMatchObject({
        code: "invalid_response",
      });
    }
  });

  it("reads a split multibyte sequence with fatal UTF-8 and rejects damaged bytes", async () => {
    const { api, fetcher, abort } = fixture();
    const json = JSON.stringify({
      snapshot: { ...snapshot, attribution: "Invented café" },
    });
    const bytes = new TextEncoder().encode(json);
    const split = bytes.indexOf(0xc3) + 1;
    fetcher.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.slice(0, split));
            controller.enqueue(bytes.slice(split));
            controller.close();
          },
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    expect((await api.status(abort.signal)).snapshot.attribution).toBe(
      "Invented café",
    );
    fetcher.mockResolvedValueOnce(
      new Response(new Uint8Array([0xff]), {
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(api.status(abort.signal)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it.each(["status", "load"] as const)(
    "measures %s bytes despite a false Content-Length and cancels an oversized stream",
    async (method) => {
      const { api, fetcher, abort } = fixture();
      const cap =
        method === "status"
          ? MANAGED_CATALOG_LIMITS.responseBytes
          : MANAGED_WATCHLIST_LIMITS.envelopeBytes;
      const cancel = vi.fn();
      const bytes = new TextEncoder().encode(
        `"${"😀".repeat(Math.ceil(cap / 4))}"`,
      );
      fetcher.mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(bytes);
            },
            cancel,
          }),
          {
            headers: {
              "content-type": "application/json",
              "content-length": "2",
            },
          },
        ),
      );
      await expect(api[method](abort.signal)).rejects.toMatchObject({
        code: "invalid_response",
      });
      expect(cancel).toHaveBeenCalledTimes(1);
    },
  );

  it("accepts exactly the byte cap and rejects one additional byte", async () => {
    const { api, fetcher, abort } = fixture();
    const json = JSON.stringify({ snapshot });
    const padded = json.padEnd(MANAGED_CATALOG_LIMITS.responseBytes, " ");
    fetcher
      .mockResolvedValueOnce(
        new Response(padded, {
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(`${padded} `, {
          headers: { "content-type": "application/json" },
        }),
      );
    expect(await api.status(abort.signal)).toEqual({ snapshot });
    await expect(api.status(abort.signal)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("aborts during token acquisition and fences the late token before fetch", async () => {
    const { api, fetcher, session, abort } = fixture();
    const token = deferred<string | null>();
    vi.mocked(session.getToken).mockReturnValue(token.promise);
    const pending = api.load(abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({ code: "aborted" });
    token.resolve("late-token");
    await Promise.resolve();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("bounds a stalled token, fetch and response stream by the same deadline", async () => {
    vi.useFakeTimers();
    for (const stage of ["token", "fetch", "stream"]) {
      const { api, fetcher, session, abort } = fixture();
      const cancel = vi.fn();
      if (stage === "token")
        vi.mocked(session.getToken).mockReturnValue(
          new Promise(() => undefined),
        );
      if (stage === "fetch")
        fetcher.mockReturnValue(new Promise(() => undefined));
      if (stage === "stream")
        fetcher.mockResolvedValue(
          new Response(new ReadableStream({ cancel }), {
            headers: { "content-type": "application/json" },
          }),
        );
      const pending = expect(api.load(abort.signal)).rejects.toMatchObject({
        code: "unavailable",
      });
      await vi.advanceTimersByTimeAsync(20_000);
      await pending;
      if (stage === "stream") expect(cancel).toHaveBeenCalledTimes(1);
    }
  });

  it("makes no request for malformed or oversized commands and resolve batches", async () => {
    const { api, fetcher, session, abort } = fixture();
    await expect(
      api.save({ ...command, expectedVersion: -1 }, abort.signal),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      api.resolve(
        {
          snapshotSha256: digest,
          listingIds: Array.from(
            { length: 51 },
            (_, index) => `listing-${index}`,
          ),
        },
        abort.signal,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(session.getToken).not.toHaveBeenCalled();
  });
});

describe("managed annual transport", () => {
  it("captures the exact four-key request before awaiting the token and validates owned evidence", async () => {
    const { api, fetcher, session, abort } = fixture();
    const token = deferred<string | null>();
    vi.mocked(session.getToken).mockReturnValue(token.promise);
    const input = annualRequest();
    const wire = await annualResponse();
    fetcher.mockResolvedValue(Response.json(wire));
    const loading = api.annualReport(input, abort.signal);
    Object.assign(input, { symbol: "CHANGED" });
    token.resolve("synthetic-token");
    const result = await loading;
    expect(result).toEqual(wire);
    expect(Object.isFrozen(result.evidence.observations[0]?.filing)).toBe(true);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      `${origin}/v1/managed/sec-annual-evidence`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(annualRequest()),
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
      }),
    );
  });

  it.each(["cancel", "deadline"])(
    "keeps async hash/semantic parsing inside the request lifetime: %s",
    async (ending) => {
      vi.useFakeTimers();
      const { api, fetcher, abort } = fixture();
      const entered = deferred<AbortSignal>();
      const decoding =
        deferred<
          Awaited<
            ReturnType<typeof annualDecoder.parseSecAnnualEvidenceResponse>
          >
        >();
      vi.spyOn(
        annualDecoder,
        "parseSecAnnualEvidenceResponse",
      ).mockImplementation((_value, _request, signal) => {
        entered.resolve(signal);
        return decoding.promise;
      });
      fetcher.mockResolvedValue(
        Response.json({ synthetic: "deferred parser boundary" }),
      );
      const pending = api.annualReport(annualRequest(), abort.signal);
      const checked = expect(pending).rejects.toMatchObject({
        code: ending === "cancel" ? "aborted" : "unavailable",
      });
      const parserSignal = await entered.promise;
      expect(parserSignal.aborted).toBe(false);
      if (ending === "cancel") abort.abort();
      else await vi.advanceTimersByTimeAsync(20_000);
      await checked;
      expect(parserSignal.aborted).toBe(true);
      decoding.resolve(await annualResponse());
      await Promise.resolve();
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it("rejects a tampered normalized generation without returning any evidence", async () => {
    const { api, fetcher, abort } = fixture();
    const wire = await annualResponse();
    fetcher.mockResolvedValue(
      Response.json({
        ...wire,
        evidence: {
          ...wire.evidence,
          generation: { ...wire.evidence.generation, sha256: digest },
        },
      }),
    );
    await expect(
      api.annualReport(annualRequest(), abort.signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("measures the 2 MiB response cap with fatal UTF-8, ignoring a false Content-Length", async () => {
    const { api, fetcher, abort } = fixture();
    const wire = await annualResponse();
    const padded = JSON.stringify(wire).padEnd(
      MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes,
      " ",
    );
    fetcher.mockResolvedValueOnce(
      new Response(padded, {
        headers: { "content-type": "application/json", "content-length": "1" },
      }),
    );
    expect(await api.annualReport(annualRequest(), abort.signal)).toEqual(wire);
    for (const bytes of [
      new TextEncoder().encode(padded + " "),
      new Uint8Array([0xff]),
    ]) {
      fetcher.mockResolvedValueOnce(
        new Response(bytes, {
          headers: {
            "content-type": "application/json",
            "content-length": "1",
          },
        }),
      );
      await expect(
        api.annualReport(annualRequest(), abort.signal),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it("accepts only the exact annual cooldown body and canonical UTC date", async () => {
    const { api, fetcher, abort } = fixture();
    const nextAllowedAt = "2026-10-01T00:00:20.000Z";
    fetcher.mockResolvedValueOnce(
      Response.json({ error: "rate_limited", nextAllowedAt }, { status: 429 }),
    );
    await expect(
      api.annualReport(annualRequest(), abort.signal),
    ).rejects.toEqual(new ManagedAnnualCooldownError(nextAllowedAt));
    for (const body of [
      { error: "rate_limited" },
      { error: "rate_limited", nextAllowedAt, ownerId: "not-public" },
      { error: "rate_limited", nextAllowedAt: "2026-02-30T00:00:20.000Z" },
      { error: "rate_limited", nextAllowedAt: "2026-10-01T00:00:20+00:00" },
      { error: "rate_limited", nextAllowedAt: 20 },
    ]) {
      fetcher.mockResolvedValueOnce(Response.json(body, { status: 429 }));
      await expect(
        api.annualReport(annualRequest(), abort.signal),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it("keeps annual configuration/timeout/catalog errors finite and never admits save uncertainty", async () => {
    const { api, fetcher, abort } = fixture();
    for (const [status, error, expected] of [
      [503, "not_configured", new ManagedAnnualReportError("not_configured")],
      [408, "request_timeout", new ManagedAnnualReportError("request_timeout")],
      [409, "catalog_changed", new ManagedCatalogChangedError()],
      [503, "commit_unknown", new TrialApiError("invalid_response")],
      [409, "conflict", new TrialApiError("invalid_response")],
    ] as const) {
      fetcher.mockResolvedValueOnce(Response.json({ error }, { status }));
      await expect(
        api.annualReport(annualRequest(), abort.signal),
      ).rejects.toEqual(expected);
    }
  });

  it.each([401, 403])(
    "preserves shared retirement errors for annual status %i",
    async (status) => {
      const { api, fetcher, abort } = fixture();
      fetcher.mockResolvedValue(new Response("discarded", { status }));
      await expect(
        api.annualReport(annualRequest(), abort.signal),
      ).rejects.toEqual(
        new TrialApiError(status === 401 ? "unauthenticated" : "access_denied"),
      );
    },
  );

  it("rejects non-current request shapes before token or fetch", async () => {
    const { api, fetcher, session, abort } = fixture();
    await expect(
      api.annualReport(
        { ...annualRequest(), symbol: "bad ticker" },
        abort.signal,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(session.getToken).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
