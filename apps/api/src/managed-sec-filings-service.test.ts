import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseManagedSecFilingsResponse,
  type ManagedSecFilingsRequestDto,
} from "@research-cockpit/contracts";
import { ManagedSecAdmissionError } from "./managed-sec-admission";
import { createManagedSecFilingsService } from "./managed-sec-filings-service";
import * as filingsProvider from "./personal-sec-filings-provider";
import {
  createManagedCatalogService,
  getManagedWorkspaceCatalog,
} from "./managed-workspace-catalog";

const ENTRY = "2026-10-12T00:00:00.000Z";
const CONTACT = "Synthetic filings fixture fixture@example.test";
const PRINCIPAL = { userId: "synthetic_sec_principal_01" };
function command(symbol = "AAPL"): ManagedSecFilingsRequestDto {
  const catalog = createManagedCatalogService();
  const listing = catalog
    .search(symbol)!
    .results.find((row) => row.symbol === symbol)!;
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: catalog.status().snapshot.snapshotSha256,
    listingId: listing.listingId,
    symbol,
  };
}
function packet(cik = "0000320193") {
  return {
    cik,
    filings: {
      recent: {
        accessionNumber: [
          `${cik}-26-000004`,
          `${cik}-26-000003`,
          `${cik}-26-000002`,
          `${cik}-26-000001`,
        ],
        form: ["8-K", "10-K/A", "10-Q", "4"],
        filingDate: ["2026-10-13", "2026-10-12", "2026-07-15", "2026-07-14"],
        reportDate: ["", "2026-06-30", null, ""],
      },
      files: [{ name: "must-not-fetch.json" }],
    },
  };
}
function fixture(
  configuration: { userAgent: string } | null = { userAgent: CONTACT },
  enteredAt = ENTRY,
) {
  let elapsed = 0;
  const reserve = vi.fn(() =>
    Promise.resolve({ version: 2, nextAllowedAt: "2026-10-12T00:00:20.000Z" }),
  );
  const close = vi.fn(() => Promise.resolve());
  const openAdmission = vi.fn(() => ({ admission: { reserve }, close }));
  const fetch = vi.fn<typeof globalThis.fetch>((input) => {
    const cik = /CIK([0-9]{10})/u.exec(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    )?.[1];
    if (!cik) throw new Error("Unexpected synthetic source");
    return Promise.resolve(Response.json(packet(cik)));
  });
  const service = createManagedSecFilingsService({
    configuration,
    catalog: getManagedWorkspaceCatalog(),
    enteredAt,
    startedAt: 0,
    monotonic: () => elapsed,
    now: () => new Date(Date.parse(enteredAt) + elapsed),
    openAdmission,
    fetch,
    scheduler: { wait: () => Promise.resolve() },
  });
  return {
    service,
    reserve,
    close,
    openAdmission,
    fetch,
    elapsed: (value: number) => {
      elapsed = value;
    },
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("managed company Filings service", () => {
  it.each([
    "authorization",
    "extra_header",
    "request_object",
    "url_object",
  ] as const)(
    "blocks provider request authority expansion: %s",
    async (expansion) => {
      const original = filingsProvider.createSecPersonalFilingsProvider;
      vi.spyOn(
        filingsProvider,
        "createSecPersonalFilingsProvider",
      ).mockImplementation((contact, dependencies) =>
        original(contact, {
          ...dependencies,
          fetch: (input, init) => {
            if (typeof input !== "string")
              throw new Error("Expected provider string URL");
            if (expansion === "request_object")
              return dependencies!.fetch!(
                new Request(input, {
                  headers: { Authorization: "invented-forbidden-header" },
                }),
                init,
              );
            if (expansion === "url_object")
              return dependencies!.fetch!(new URL(input), init);
            const headers = new Headers(init?.headers);
            headers.set(
              expansion === "authorization" ? "Authorization" : "X-Extra",
              "invented-forbidden-header",
            );
            return dependencies!.fetch!(input, { ...init, headers });
          },
        }),
      );
      const f = fixture();
      const result = await f.service.load(
        command(),
        PRINCIPAL,
        new AbortController().signal,
      );
      expect(result.issuer.status).toBe("upstream_unavailable");
      expect(result.issuer.filings).toEqual([]);
      expect(f.reserve).toHaveBeenCalledTimes(1);
      expect(f.fetch).not.toHaveBeenCalled();
    },
  );
  it("keeps the entry day's window when source completion crosses UTC midnight", async () => {
    const enteredAt = "2026-10-11T23:59:59.900Z";
    const f = fixture({ userAgent: CONTACT }, enteredAt);
    f.fetch.mockImplementation(() => {
      f.elapsed(200);
      return Promise.resolve(Response.json(packet()));
    });
    const result = await f.service.load(
      command(),
      PRINCIPAL,
      new AbortController().signal,
    );
    expect(result.requestStartedAt).toBe(enteredAt);
    expect(result.completedAt).toBe("2026-10-12T00:00:00.100Z");
    expect(result.window).toEqual({
      lookbackDays: 90,
      fromDate: "2026-07-14",
      throughDate: "2026-10-11",
    });
    expect(result.issuer.filings.map((row) => row.filingDate)).toEqual([
      "2026-07-15",
      "2026-07-14",
    ]);
    expect(f.reserve).toHaveBeenCalledWith(
      PRINCIPAL,
      enteredAt,
      expect.any(AbortSignal),
    );
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    { symbol: "AAPL", cik: "0000320193" },
    { symbol: "GOOG", cik: "0001652044" },
    { symbol: "GOOGL", cik: "0001652044" },
    { symbol: "MSFT", cik: "0000789019" },
    { symbol: "AFL", cik: "0000004977" },
    { symbol: "AIG", cik: "0000005272" },
    { symbol: "ALCO", cik: "0000003545" },
    { symbol: "AMD", cik: "0000002488" },
    { symbol: "AP", cik: "0000006176" },
    { symbol: "AVD", cik: "0000005981" },
    { symbol: "AXP", cik: "0000004962" },
    { symbol: "BKTI", cik: "0000002186" },
    { symbol: "HWM", cik: "0000004281" },
    { symbol: "LNG", cik: "0000003570" },
    { symbol: "MATX", cik: "0000003453" },
    { symbol: "SWKS", cik: "0000004127" },
    { symbol: "UHAL", cik: "0000004457" },
    { symbol: "UNM", cik: "0000005513" },
  ])(
    "joins exact $symbol identity, one Submissions read and original 90-day window",
    async ({ symbol, cik }) => {
      const f = fixture(),
        request = command(symbol);
      const result = await f.service.load(
        request,
        PRINCIPAL,
        new AbortController().signal,
      );
      expect(parseManagedSecFilingsResponse(result, request)).toEqual(result);
      const resolved = createManagedCatalogService().resolve({
        snapshotSha256: request.catalogSnapshotSha256,
        listingIds: [request.listingId],
      })!.results[0]!.listing!;
      expect(result.security).toEqual({ ...resolved, cik });
      expect(result.window).toEqual({
        lookbackDays: 90,
        fromDate: "2026-07-15",
        throughDate: "2026-10-12",
      });
      expect(result.issuer).toMatchObject({
        status: "available",
        matchingFilings: 2,
        truncated: false,
        olderHistoryAvailable: true,
      });
      expect(
        result.issuer.filings.map((row) => [
          row.form,
          row.filingDate,
          row.reportDate,
        ]),
      ).toEqual([
        ["10-K/A", "2026-10-12", "2026-06-30"],
        ["10-Q", "2026-07-15", null],
      ]);
      expect(f.fetch).toHaveBeenCalledExactlyOnceWith(
        `https://data.sec.gov/submissions/CIK${cik}.json`,
        expect.objectContaining({
          method: "GET",
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
          referrerPolicy: "no-referrer",
          headers: { Accept: "application/json", "User-Agent": CONTACT },
        }),
      );
      expect(f.reserve).toHaveBeenCalledExactlyOnceWith(
        PRINCIPAL,
        ENTRY,
        expect.any(AbortSignal),
      );
      expect(f.close).toHaveBeenCalledTimes(1);
      expect(f.close.mock.invocationCallOrder[0]).toBeLessThan(
        f.fetch.mock.invocationCallOrder[0]!,
      );
    },
  );
  it.each([
    { cik: "0000000001" },
    { fromDate: "2026-01-01" },
    { symbol: "GOOG" },
    { listingId: "listing-absent" },
    { catalogSnapshotSha256: `sha256:${"a".repeat(64)}` },
  ])(
    "rejects widened or stale selection before admission/source %j",
    async (patch) => {
      const f = fixture();
      await expect(
        f.service.load(
          { ...command(), ...patch } as ManagedSecFilingsRequestDto,
          PRINCIPAL,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({
        code: patch.catalogSnapshotSha256
          ? "catalog_changed"
          : "invalid_request",
      });
      expect(f.openAdmission).not.toHaveBeenCalled();
      expect(f.fetch).not.toHaveBeenCalled();
    },
  );
  it("keeps unconfigured and retired requests source-free", async () => {
    const f = fixture(null);
    await expect(
      f.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "not_configured" });
    expect(f.openAdmission).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
    const g = fixture(),
      controller = new AbortController();
    controller.abort();
    await expect(
      g.service.load(command(), PRINCIPAL, controller.signal),
    ).rejects.toMatchObject({ code: "request_timeout" });
    expect(g.openAdmission).not.toHaveBeenCalled();
    expect(g.fetch).not.toHaveBeenCalled();
  });
  it.each([
    new ManagedSecAdmissionError("rate_limited", "2026-10-12T00:00:20.000Z"),
    new Error("Uncertain commit"),
  ])("denied or uncertain admission never reads SEC", async (error) => {
    const f = fixture();
    f.reserve.mockRejectedValue(error);
    await expect(
      f.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({
      code:
        error instanceof ManagedSecAdmissionError
          ? "rate_limited"
          : "unavailable",
    });
    expect(f.close).toHaveBeenCalledTimes(1);
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("does not reuse an operation or grant reads after failed cleanup", async () => {
    const f = fixture();
    await f.service.load(command(), PRINCIPAL, new AbortController().signal);
    await expect(
      f.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(f.reserve).toHaveBeenCalledTimes(1);
    expect(f.fetch).toHaveBeenCalledTimes(1);
    const g = fixture();
    g.close.mockRejectedValue(new Error("Cleanup failed"));
    await expect(
      g.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toThrow();
    expect(g.fetch).not.toHaveBeenCalled();
  });
  it.each([
    { status: 404, expected: "not_covered" },
    { status: 429, expected: "rate_limited" },
    { status: 503, expected: "upstream_unavailable" },
  ])(
    "retains HTTP$status as source $expected without retries or a fabricated budget",
    async ({ status, expected }) => {
      const f = fixture();
      f.fetch.mockResolvedValue(new Response("Synthetic refusal", { status }));
      const result = await f.service.load(
        command(),
        PRINCIPAL,
        new AbortController().signal,
      );
      expect(result.issuer).toMatchObject({
        status: expected,
        matchingFilings: 0,
        truncated: false,
        olderHistoryAvailable: false,
        filings: [],
      });
      expect(result.issuer).not.toHaveProperty("nextAllowedAt");
      expect(f.fetch).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    "{broken",
    JSON.stringify({ cik: "0000000002", filings: packet().filings }),
    JSON.stringify({
      ...packet(),
      filings: {
        ...packet().filings,
        recent: { ...packet().filings.recent, form: [] },
      },
    }),
  ])("retains malformed source refusal %s", async (body) => {
    const f = fixture();
    f.fetch.mockResolvedValue(new Response(body));
    const result = await f.service.load(
      command(),
      PRINCIPAL,
      new AbortController().signal,
    );
    expect(result.issuer.status).toBe("invalid_response");
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves the source byte cap and aborts the over-limit body without a second read", async () => {
    const f = fixture(),
      cancel = vi.fn();
    f.fetch.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(stream) {
            stream.enqueue(new Uint8Array(4 * 1024 * 1024 + 1));
          },
          cancel,
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    expect(
      (await f.service.load(command(), PRINCIPAL, new AbortController().signal))
        .issuer.status,
    ).toBe("invalid_response");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves 1000 retained filings and the full matching count from one current object", async () => {
    const f = fixture(),
      original = packet();
    const recent = {
      accessionNumber: Array.from(
        { length: 1001 },
        (_, i) => `0000320193-26-${String(i + 1).padStart(6, "0")}`,
      ),
      form: Array(1001).fill("8-K"),
      filingDate: Array(1001).fill("2026-10-12"),
      reportDate: Array(1001).fill(""),
    };
    f.fetch.mockResolvedValue(
      Response.json({ ...original, filings: { ...original.filings, recent } }),
    );
    const result = await f.service.load(
      command(),
      PRINCIPAL,
      new AbortController().signal,
    );
    expect(result.issuer).toMatchObject({
      matchingFilings: 1001,
      truncated: true,
      olderHistoryAvailable: true,
    });
    expect(result.issuer.filings).toHaveLength(1000);
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it("discards late admission and source completion using original entry deadlines", async () => {
    const f = fixture();
    f.reserve.mockImplementation(() => {
      f.elapsed(2000);
      return Promise.resolve({
        version: 2,
        nextAllowedAt: "2026-10-12T00:00:20.000Z",
      });
    });
    await expect(
      f.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "request_timeout" });
    expect(f.fetch).not.toHaveBeenCalled();
    const g = fixture();
    g.fetch.mockImplementation(() => {
      g.elapsed(7500);
      return Promise.resolve(Response.json(packet()));
    });
    await expect(
      g.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "request_timeout" });
    expect(g.fetch).toHaveBeenCalledTimes(1);
    const h = fixture();
    h.elapsed(2000);
    await expect(
      h.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "request_timeout" });
    expect(h.openAdmission).not.toHaveBeenCalled();
  });
  it("retires noncooperative admission and transport on the original abort signal", async () => {
    const f = fixture(),
      c = new AbortController();
    f.reserve.mockImplementation(() => {
      c.abort();
      return new Promise(() => undefined);
    });
    await expect(
      f.service.load(command(), PRINCIPAL, c.signal),
    ).rejects.toMatchObject({ code: "request_timeout" });
    expect(f.close).toHaveBeenCalledTimes(1);
    expect(f.fetch).not.toHaveBeenCalled();
    const g = fixture(),
      d = new AbortController();
    g.fetch.mockImplementation(() => {
      d.abort();
      return new Promise(() => undefined);
    });
    await expect(
      g.service.load(command(), PRINCIPAL, d.signal),
    ).rejects.toMatchObject({ code: "request_timeout" });
    expect(g.fetch).toHaveBeenCalledTimes(1);
  });
  it("times out a stalled body within 7.5 seconds without waiting for provider's longer timer", async () => {
    vi.useFakeTimers();
    const f = fixture(),
      cancel = vi.fn();
    f.fetch.mockResolvedValue(new Response(new ReadableStream({ cancel })));
    const work = expect(
      f.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(7500);
    await work;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
});
