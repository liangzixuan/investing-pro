import { afterEach, describe, expect, it, vi } from "vitest";
import * as securityMaster from "@research-cockpit/personal-security-master";
import type { ManagedEodHistoryRequestDto } from "@research-cockpit/contracts";
import { createManagedEodService } from "./managed-eod-service";
import { ManagedEodAdmissionError } from "./managed-eod-admission";
import {
  MANAGED_EOD_MAPPING_CANDIDATES,
  type ManagedEodConfiguration,
} from "./managed-eod-config";
import { getManagedWorkspaceCatalog } from "./managed-workspace-catalog";

const ENTRY = "2026-10-02T12:00:00.000Z",
  TOKEN = "invented-EOD-token";
const PRINCIPAL = { userId: "invented-owner" };
const command = (symbol = "AAPL"): ManagedEodHistoryRequestDto => ({
  catalogSnapshotSha256: getManagedWorkspaceCatalog().snapshotSha256,
  listingId: MANAGED_EOD_MAPPING_CANDIDATES.find(
    (x) => x.security.symbol === symbol,
  )!.security.listingId,
  range: "1m",
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
) {
  let elapsed = 0;
  const reserve = vi.fn(() =>
    Promise.resolve({ version: 2, reservedAt: ENTRY }),
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
      enteredAt: ENTRY,
      startedAt: 0,
      openAdmission,
      monotonic: () => elapsed,
      now: () => new Date(Date.parse(ENTRY) + elapsed),
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
  it.each(["AAPL", "GOOG", "GOOGL"])(
    "preserves the complete %s class and makes one admitted history-only read",
    async (symbol) => {
      const f = fixture();
      const request = command(symbol);
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
        window: { startDate: "2026-09-02", endDate: "2026-10-02" },
      });
      expect(f.reserve).toHaveBeenCalledExactlyOnceWith(
        PRINCIPAL,
        ENTRY,
        expect.any(AbortSignal),
      );
      expect(f.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = f.fetch.mock.calls[0]!;
      expect(url).toBe(
        `https://api.tiingo.com/tiingo/daily/${symbol}/prices?startDate=2026-09-02&endDate=2026-10-02`,
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
  it("returns the checked local cooldown and never opens the source", async () => {
    const f = fixture();
    const next = "2026-10-02T13:00:04.000Z";
    f.reserve.mockRejectedValue(
      new ManagedEodAdmissionError("rate_limited", next),
    );
    await expect(
      f.make().load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "rate_limited", nextAllowedAt: next });
    expect(f.fetch).not.toHaveBeenCalled();
    expect(f.close).toHaveBeenCalledTimes(1);
  });
  it("does not fetch after an uncertain or late admission", async () => {
    const f = fixture();
    f.reserve.mockRejectedValue(new ManagedEodAdmissionError("unavailable"));
    await expect(
      f.make().load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "unavailable" });
    f.reserve.mockImplementation(() => {
      f.elapsed(2000);
      return Promise.resolve({ version: 2, reservedAt: ENTRY });
    });
    await expect(
      f.make().load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "request_timeout" });
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("retires an uncooperative late source and aborts the owned provider", async () => {
    const f = fixture();
    let finish!: (value: Response) => void;
    f.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const controller = new AbortController();
    const pending = f.make().load(command(), PRINCIPAL, controller.signal);
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
  });
  it("bounds an uncooperative admission close and never dispatches after it completes late", async () => {
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
      .load(command(), PRINCIPAL, new AbortController().signal);
    const rejected = expect(pending).rejects.toMatchObject({
      code: "request_timeout",
    });
    await vi.advanceTimersByTimeAsync(2000);
    await rejected;
    expect(f.fetch).not.toHaveBeenCalled();
    finish();
    await Promise.resolve();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("enforces the shorter source deadline even when source ignores its signal", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.fetch.mockImplementation(() => new Promise(() => undefined));
    const pending = f
      .make()
      .load(command(), PRINCIPAL, new AbortController().signal);
    const rejected = expect(pending).rejects.toMatchObject({
      code: "request_timeout",
    });
    await vi.advanceTimersByTimeAsync(7500);
    await rejected;
    expect(f.fetch.mock.calls[0]![1]?.signal?.aborted).toBe(true);
  });
  it("rejects late normalization and refuses final serialization after the whole deadline", async () => {
    const f = fixture();
    f.fetch.mockImplementation(() => {
      f.elapsed(7500);
      return Promise.resolve(Response.json([bar()]));
    });
    await expect(
      f.make().load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "request_timeout" });
    f.elapsed(10000);
    expect(() => f.make().assertActive(new AbortController().signal)).toThrow(
      "request_timeout",
    );
  });
});
