import { afterEach, describe, expect, it, vi } from "vitest";
import * as securityMaster from "@research-cockpit/personal-security-master";
import {
  MANAGED_EOD_HISTORY_RANGE_LIMITS,
  type ManagedEodHistoryRange,
  type ManagedEodHistoryRequestDto,
} from "@research-cockpit/contracts";
import { createManagedEodService } from "./managed-eod-service";
import { ManagedEodAdmissionError } from "./managed-eod-admission";
import {
  MANAGED_EOD_MAPPING_CANDIDATES,
  type ManagedEodConfiguration,
} from "./managed-eod-config";
import {
  createManagedCatalogService,
  getManagedWorkspaceCatalog,
} from "./managed-workspace-catalog";

const ENTRY = "2026-10-02T12:00:00.000Z",
  TOKEN = "invented-EOD-token";
const PRINCIPAL = { userId: "invented-owner" };
const command = (
  symbol = "AAPL",
  range: ManagedEodHistoryRange = "1m",
): ManagedEodHistoryRequestDto => ({
  catalogSnapshotSha256: getManagedWorkspaceCatalog().snapshotSha256,
  listingId: MANAGED_EOD_MAPPING_CANDIDATES.find(
    (x) => x.security.symbol === symbol,
  )!.security.listingId,
  range,
});
function bar(date = "2026-10-01", extra: Record<string, unknown> = {}) {
  return {
    date: `${date}T00:00:00.000Z`,
    open: 100,
    high: 110,
    low: 90,
    close: 103.125,
    volume: 1000,
    adjOpen: 100,
    adjHigh: 110,
    adjLow: 90,
    adjClose: 103.125,
    adjVolume: 1000,
    divCash: 0,
    splitFactor: 1,
    ...extra,
  };
}
function fixture(
  configuration: ManagedEodConfiguration | null = {
    enabledSymbols: ["AAPL", "GOOG", "GOOGL"],
  },
  token: string | undefined = TOKEN,
  enteredAt = ENTRY,
) {
  let elapsed = 0;
  const reserve = vi.fn(() =>
    Promise.resolve({ version: 2, reservedAt: enteredAt }),
  );
  const close = vi.fn(() => Promise.resolve());
  const openAdmission = vi.fn(() => ({ admission: { reserve }, close }));
  const fetch = vi.fn<typeof globalThis.fetch>(() => {
    elapsed += 75;
    return Promise.resolve(Response.json([bar()]));
  });
  const make = () =>
    createManagedEodService({
      configuration,
      token,
      catalog: getManagedWorkspaceCatalog(),
      enteredAt,
      startedAt: 0,
      openAdmission,
      monotonic: () => elapsed,
      now: () => new Date(Date.parse(enteredAt) + elapsed),
      fetch,
    });
  return {
    make,
    fetch,
    reserve,
    openAdmission,
    close,
    elapsed: (value: number) => {
      elapsed = value;
    },
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("managed EOD history service", () => {
  it.each(
    (["1m", "1y"] as const).flatMap((range) =>
      ["AAPL", "GOOG", "GOOGL"].map((symbol) => ({ range, symbol })),
    ),
  )(
    "preserves the complete $symbol class and makes one admitted $range history-only read",
    async ({ symbol, range }) => {
      const f = fixture();
      const request = command(symbol, range);
      const startDate = range === "1m" ? "2026-09-02" : "2025-10-02";
      const result = await f
        .make()
        .load(request, PRINCIPAL, new AbortController().signal);
      expect(result).toMatchObject({
        security: MANAGED_EOD_MAPPING_CANDIDATES.find(
          (x) => x.security.symbol === symbol,
        )!.security,
        rows: [{ date: "2026-10-01", close: "103.125" }],
        requestStartedAt: ENTRY,
        completedAt: "2026-10-02T12:00:00.075Z",
        priceBasis: "raw_close",
        provider: "Tiingo",
        currency: "USD",
        range,
        window: { startDate, endDate: "2026-10-02" },
      });
      expect(f.reserve).toHaveBeenCalledExactlyOnceWith(
        PRINCIPAL,
        ENTRY,
        expect.any(AbortSignal),
      );
      expect(f.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = f.fetch.mock.calls[0]!;
      expect(url).toBe(
        `https://api.tiingo.com/tiingo/daily/${symbol}/prices?startDate=${startDate}&endDate=2026-10-02`,
      );
      expect(init).toMatchObject({
        method: "GET",
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
      });
      expect(new Headers(init?.headers).get("authorization")).toBe(
        `Token ${TOKEN}`,
      );
      expect(init?.signal?.aborted).toBe(true);
      expect(f.reserve.mock.invocationCallOrder[0]).toBeLessThan(
        f.fetch.mock.invocationCallOrder[0]!,
      );
      expect(f.close).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toContain(TOKEN);
      expect(Object.isFrozen(result.rows[0])).toBe(true);
    },
  );
  it.each([
    {
      range: "1m",
      enteredAt: "2026-08-31T23:59:59.000Z",
      startDate: "2026-07-31",
      count: 32,
      accepted: true,
    },
    {
      range: "1m",
      enteredAt: "2026-08-31T23:59:59.000Z",
      startDate: "2026-07-31",
      count: 33,
      accepted: false,
    },
    {
      range: "1y",
      enteredAt: "2024-03-01T00:00:00.000Z",
      startDate: "2023-03-01",
      count: 367,
      accepted: true,
    },
    {
      range: "1y",
      enteredAt: "2024-03-01T00:00:00.000Z",
      startDate: "2023-03-01",
      count: 368,
      accepted: false,
    },
  ] as const)(
    "keeps $range inclusive source dates bounded at $count rows",
    async ({ range, enteredAt, startDate, count, accepted }) => {
      const f = fixture(undefined, undefined, enteredAt);
      const first = Date.parse(`${startDate}T00:00:00.000Z`);
      const bars = Array.from({ length: count }, (_, index) =>
        bar(new Date(first + index * 86_400_000).toISOString().slice(0, 10)),
      );
      f.fetch.mockResolvedValue(Response.json(bars));
      const pending = f
        .make()
        .load(command("AAPL", range), PRINCIPAL, new AbortController().signal);
      if (accepted) {
        const result = await pending;
        expect(result.range).toBe(range);
        expect(result.rows).toHaveLength(count);
        expect(result.rows[0]?.date).toBe(startDate);
        expect(result.rows.at(-1)?.date).toBe(enteredAt.slice(0, 10));
        expect(result.window).toEqual({
          startDate,
          endDate: enteredAt.slice(0, 10),
        });
      } else {
        await expect(pending).rejects.toMatchObject({ code: "unavailable" });
      }
      expect(f.fetch).toHaveBeenCalledTimes(1);
      expect(f.reserve).toHaveBeenCalledTimes(1);
      expect(f.close).toHaveBeenCalledTimes(1);
    },
  );
  it("uses the calendar-clamped year window on leap day", async () => {
    const f = fixture(undefined, undefined, "2024-02-29T12:00:00.000Z");
    f.fetch.mockResolvedValue(
      Response.json([bar("2023-02-28"), bar("2024-02-29")]),
    );
    const result = await f
      .make()
      .load(command("AAPL", "1y"), PRINCIPAL, new AbortController().signal);
    expect(result.window).toEqual({
      startDate: "2023-02-28",
      endDate: "2024-02-29",
    });
    expect(result.rows.map((row) => row.date)).toEqual([
      "2023-02-28",
      "2024-02-29",
    ]);
    expect(f.fetch).toHaveBeenCalledTimes(1);
    expect(f.fetch.mock.calls[0]?.[0]).toBe(
      "https://api.tiingo.com/tiingo/daily/AAPL/prices?startDate=2023-02-28&endDate=2024-02-29",
    );
  });
  it.each(
    (["1m", "1y"] as const).flatMap((range) =>
      [false, true].map((declared) => ({ range, declared })),
    ),
  )(
    "admits a complete $range source at its exact byte cap (declared=$declared)",
    async ({ range, declared }) => {
      const f = fixture();
      const cap = MANAGED_EOD_HISTORY_RANGE_LIMITS[range].sourceBytes;
      const json = JSON.stringify([bar()]);
      const text =
        json + " ".repeat(cap - new TextEncoder().encode(json).byteLength);
      expect(new TextEncoder().encode(text)).toHaveLength(cap);
      f.fetch.mockResolvedValue(
        new Response(text, {
          headers: declared ? { "content-length": String(cap) } : {},
        }),
      );
      const result = await f
        .make()
        .load(command("AAPL", range), PRINCIPAL, new AbortController().signal);
      expect(result.range).toBe(range);
      expect(result.rows).toEqual([{ date: "2026-10-01", close: "103.125" }]);
      expect(f.fetch).toHaveBeenCalledTimes(1);
      expect(f.reserve).toHaveBeenCalledTimes(1);
      expect(f.close).toHaveBeenCalledTimes(1);
      expect(f.fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    },
  );
  it.each(
    (["1m", "1y"] as const).flatMap((range) =>
      [false, true].map((declared) => ({ range, declared })),
    ),
  )(
    "refuses one byte beyond the $range source cap without fallback (declared=$declared)",
    async ({ range, declared }) => {
      const f = fixture();
      const cap = MANAGED_EOD_HISTORY_RANGE_LIMITS[range].sourceBytes;
      const json = JSON.stringify([bar()]);
      const first = new TextEncoder().encode(
        json + " ".repeat(cap - json.length),
      );
      const pull = vi.fn();
      const cancel = vi.fn();
      let chunk = 0;
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            pull();
            if (chunk++ === 0) controller.enqueue(first);
            else if (chunk === 2) controller.enqueue(new Uint8Array([32]));
            else controller.close();
          },
          cancel,
        },
        { highWaterMark: 0 },
      );
      f.fetch.mockResolvedValue(
        new Response(body, {
          headers: declared ? { "content-length": String(cap + 1) } : {},
        }),
      );
      await expect(
        f
          .make()
          .load(
            command("AAPL", range),
            PRINCIPAL,
            new AbortController().signal,
          ),
      ).rejects.toMatchObject({ code: "unavailable" });
      expect(f.fetch).toHaveBeenCalledTimes(1);
      expect(f.reserve).toHaveBeenCalledTimes(1);
      expect(f.close).toHaveBeenCalledTimes(1);
      expect(f.fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      if (declared) expect(pull).not.toHaveBeenCalled();
      else {
        expect(pull).toHaveBeenCalledTimes(2);
        expect(cancel).toHaveBeenCalledTimes(1);
      }
    },
  );
  it("uses the captured year range even if the caller mutates its request during admission", async () => {
    const f = fixture();
    let admit!: () => void;
    f.reserve.mockImplementation(
      () =>
        new Promise((resolve) => {
          admit = () => resolve({ version: 2, reservedAt: ENTRY });
        }),
    );
    const request = { ...command("AAPL", "1y") };
    const pending = f
      .make()
      .load(request, PRINCIPAL, new AbortController().signal);
    expect(f.reserve).toHaveBeenCalledTimes(1);
    request.range = "1m";
    admit();
    const result = await pending;
    expect(result.range).toBe("1y");
    expect(result.window).toEqual({
      startDate: "2025-10-02",
      endDate: "2026-10-02",
    });
    expect(f.fetch).toHaveBeenCalledTimes(1);
    expect(f.fetch.mock.calls[0]?.[0]).toBe(
      "https://api.tiingo.com/tiingo/daily/AAPL/prices?startDate=2025-10-02&endDate=2026-10-02",
    );
  });
  it.each(["3m", "1Y", " 1y", "1y ", null, 1])(
    "rejects unsupported range %s before admission or source work",
    async (range) => {
      const f = fixture();
      await expect(
        f
          .make()
          .load(
            { ...command(), range } as ManagedEodHistoryRequestDto,
            PRINCIPAL,
            new AbortController().signal,
          ),
      ).rejects.toMatchObject({ code: "invalid_request" });
      expect(f.openAdmission).not.toHaveBeenCalled();
      expect(f.reserve).not.toHaveBeenCalled();
      expect(f.fetch).not.toHaveBeenCalled();
    },
  );
  it.each([
    { label: "null config", config: null, token: TOKEN },
    {
      label: "missing key",
      config: { enabledSymbols: ["AAPL"] } satisfies ManagedEodConfiguration,
      token: undefined,
    },
  ])("closes $label before admission or source", async ({ config, token }) => {
    const f = fixture(config, token);
    // Explicit assignment avoids the fixture's ordinary default argument.
    const service =
      token === undefined
        ? createManagedEodService({
            configuration: config,
            token,
            catalog: getManagedWorkspaceCatalog(),
            enteredAt: ENTRY,
            startedAt: 0,
            monotonic: () => 0,
            openAdmission: f.openAdmission,
            fetch: f.fetch,
          })
        : f.make();
    await expect(
      service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "not_configured" });
    expect(f.openAdmission).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("keeps unaccepted GOOG closed even when AAPL mapping is enabled", async () => {
    const f = fixture({ enabledSymbols: ["AAPL"] });
    await expect(
      f.make().load(command("GOOG"), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "unsupported_listing" });
    expect(f.openAdmission).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("keeps catalog-admitted MSFT outside EOD coverage before reservation or provider reads", async () => {
    const catalog = createManagedCatalogService();
    const listing = catalog
      .search("MSFT")!
      .results.find((result) => result.symbol === "MSFT");
    expect(listing).toBeDefined();
    expect(
      MANAGED_EOD_MAPPING_CANDIDATES.some(
        (candidate) => candidate.security.symbol === "MSFT",
      ),
    ).toBe(false);
    const f = fixture();
    await expect(
      f.make().load(
        {
          catalogSnapshotSha256: catalog.status().snapshot.snapshotSha256,
          listingId: listing!.listingId,
          range: "1m",
        },
        PRINCIPAL,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "unsupported_listing" });
    expect(f.openAdmission).not.toHaveBeenCalled();
    expect(f.reserve).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it.each([
    "securityId",
    "shareClassId",
    "shareClassName",
    "symbol",
    "exchangeMic",
    "issuerId",
    "cik",
  ])("rejects altered %s before quota use", async (key) => {
    const lookup = securityMaster.lookupPersonalSecurityMasterListing;
    vi.spyOn(
      securityMaster,
      "lookupPersonalSecurityMasterListing",
    ).mockImplementation((catalog, id) => ({
      ...lookup(catalog, id)!,
      [key]: "CHANGED",
    }));
    const f = fixture();
    await expect(
      f.make().load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "unsupported_listing" });
    expect(f.openAdmission).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("refuses stale catalog and unknown listing before source admission", async () => {
    const f = fixture();
    await expect(
      f
        .make()
        .load(
          { ...command(), catalogSnapshotSha256: `sha256:${"a".repeat(64)}` },
          PRINCIPAL,
          new AbortController().signal,
        ),
    ).rejects.toMatchObject({ code: "catalog_changed" });
    await expect(
      f
        .make()
        .load(
          { ...command(), listingId: "unknown" },
          PRINCIPAL,
          new AbortController().signal,
        ),
    ).rejects.toMatchObject({ code: "unsupported_listing" });
    expect(f.reserve).not.toHaveBeenCalled();
  });
  it.each([
    { status: 429, code: "source_rate_limited" },
    { status: 401, code: "unavailable" },
    { status: 403, code: "unavailable" },
    { status: 500, code: "unavailable" },
  ])(
    "converts resolved upstream $status without a Clerk error or invented cooldown",
    async ({ status, code }) => {
      const f = fixture();
      f.fetch.mockResolvedValue(new Response(null, { status }));
      await expect(
        f.make().load(command(), PRINCIPAL, new AbortController().signal),
      ).rejects.toMatchObject({ code, nextAllowedAt: undefined });
      expect(f.fetch).toHaveBeenCalledTimes(1);
      expect(f.reserve).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    { label: "empty", body: [] },
    { label: "duplicate", body: [bar(), bar()] },
    { label: "outside window", body: [bar("2026-09-01")] },
    { label: "negative close", body: [bar("2026-10-01", { close: -1 })] },
    {
      label: "body cap",
      body: [bar("2026-10-01", { padding: "a".repeat(32768) })],
    },
  ])(
    "refuses $label source rows without projecting a report",
    async ({ body }) => {
      const f = fixture();
      f.fetch.mockResolvedValue(Response.json(body));
      await expect(
        f.make().load(command(), PRINCIPAL, new AbortController().signal),
      ).rejects.toMatchObject({ code: "unavailable" });
      expect(f.fetch).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["1m", "1y"] as const)(
    "returns the checked local cooldown and never opens the source (%s)",
    async (range) => {
      const f = fixture();
      const next = "2026-10-02T13:00:04.000Z";
      f.reserve.mockRejectedValue(
        new ManagedEodAdmissionError("rate_limited", next),
      );
      await expect(
        f
          .make()
          .load(
            command("AAPL", range),
            PRINCIPAL,
            new AbortController().signal,
          ),
      ).rejects.toMatchObject({ code: "rate_limited", nextAllowedAt: next });
      expect(f.fetch).not.toHaveBeenCalled();
      expect(f.close).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["1m", "1y"] as const)(
    "does not fetch after an uncertain or late admission (%s)",
    async (range) => {
      const f = fixture();
      f.reserve.mockRejectedValue(new ManagedEodAdmissionError("unavailable"));
      await expect(
        f
          .make()
          .load(
            command("AAPL", range),
            PRINCIPAL,
            new AbortController().signal,
          ),
      ).rejects.toMatchObject({ code: "unavailable" });
      f.reserve.mockImplementation(() => {
        f.elapsed(2000);
        return Promise.resolve({ version: 2, reservedAt: ENTRY });
      });
      await expect(
        f
          .make()
          .load(
            command("AAPL", range),
            PRINCIPAL,
            new AbortController().signal,
          ),
      ).rejects.toMatchObject({ code: "request_timeout" });
      expect(f.fetch).not.toHaveBeenCalled();
    },
  );
  it.each(["1m", "1y"] as const)(
    "retires an uncooperative late source and aborts the owned provider (%s)",
    async (range) => {
      const f = fixture();
      let finish!: (value: Response) => void;
      f.fetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const controller = new AbortController();
      const pending = f
        .make()
        .load(command("AAPL", range), PRINCIPAL, controller.signal);
      await vi.waitFor(() => expect(f.fetch).toHaveBeenCalledTimes(1));
      const rejected = expect(pending).rejects.toMatchObject({
        code: "request_timeout",
      });
      controller.abort();
      await rejected;
      expect(f.fetch.mock.calls[0]![1]?.signal?.aborted).toBe(true);
      finish(Response.json([bar()]));
      await Promise.resolve();
      expect(f.fetch).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["1m", "1y"] as const)(
    "bounds an uncooperative admission close and never dispatches after it completes late (%s)",
    async (range) => {
      vi.useFakeTimers();
      const f = fixture();
      let finish!: () => void;
      f.close.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const pending = f
        .make()
        .load(command("AAPL", range), PRINCIPAL, new AbortController().signal);
      const rejected = expect(pending).rejects.toMatchObject({
        code: "request_timeout",
      });
      await vi.advanceTimersByTimeAsync(2000);
      await rejected;
      expect(f.fetch).not.toHaveBeenCalled();
      finish();
      await Promise.resolve();
      expect(f.fetch).not.toHaveBeenCalled();
    },
  );
  it.each(["1m", "1y"] as const)(
    "enforces the shorter source deadline even when source ignores its signal (%s)",
    async (range) => {
      vi.useFakeTimers();
      const f = fixture();
      f.fetch.mockImplementation(() => new Promise(() => undefined));
      const pending = f
        .make()
        .load(command("AAPL", range), PRINCIPAL, new AbortController().signal);
      const rejected = expect(pending).rejects.toMatchObject({
        code: "request_timeout",
      });
      await vi.advanceTimersByTimeAsync(7500);
      await rejected;
      expect(f.fetch.mock.calls[0]![1]?.signal?.aborted).toBe(true);
    },
  );
  it.each(["1m", "1y"] as const)(
    "rejects late normalization and refuses final serialization after the whole deadline (%s)",
    async (range) => {
      const f = fixture();
      f.fetch.mockImplementation(() => {
        f.elapsed(7500);
        return Promise.resolve(Response.json([bar()]));
      });
      await expect(
        f
          .make()
          .load(
            command("AAPL", range),
            PRINCIPAL,
            new AbortController().signal,
          ),
      ).rejects.toMatchObject({ code: "request_timeout" });
      f.elapsed(10000);
      expect(() => f.make().assertActive(new AbortController().signal)).toThrow(
        "request_timeout",
      );
    },
  );
});
