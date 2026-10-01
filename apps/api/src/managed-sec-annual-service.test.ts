import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersonalSecAnnualEvidenceRequestDto } from "@research-cockpit/contracts";

import { ManagedSecAnnualAdmissionError } from "./managed-sec-annual-admission";
import { createManagedSecAnnualService } from "./managed-sec-annual-service";
import {
  createManagedCatalogService,
  getManagedWorkspaceCatalog,
} from "./managed-workspace-catalog";

const ENTRY = "2026-10-01T12:00:00.000Z";
const CONTACT = "Synthetic annual fixture fixture@example.test";
const PRINCIPAL = { userId: "synthetic_sec_principal_01" };
function command(symbol = "AAPL"): PersonalSecAnnualEvidenceRequestDto {
  const catalog = createManagedCatalogService();
  const listing = catalog
    .search(symbol)!
    .results.find((r) => r.symbol === symbol)!;
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: catalog.status().snapshot.snapshotSha256,
    listingId: listing.listingId,
    symbol,
  };
}
function packets(cik = "0000320193") {
  const accession = `${cik}-25-000042`;
  const fact = {
    start: "2024-10-01",
    end: "2025-09-30",
    val: 120,
    accn: accession,
    fy: 2025,
    fp: "FY",
    form: "10-K",
    filed: "2025-11-01",
  };
  return [
    {
      cik,
      filings: {
        recent: {
          accessionNumber: [accession],
          form: ["10-K"],
          filingDate: ["2025-11-01"],
          reportDate: ["2025-09-30"],
          acceptanceDateTime: ["2025-11-01T12:00:00.000Z"],
        },
        files: [],
      },
    },
    {
      cik: Number(cik),
      facts: {
        "us-gaap": {
          Revenues: { units: { USD: [fact] } },
          NetIncomeLoss: { units: { USD: [{ ...fact, val: -30 }] } },
        },
      },
    },
  ];
}
function fixture(
  configuration: { userAgent: string } | null = { userAgent: CONTACT },
) {
  let elapsed = 0;
  const reserve = vi.fn(() =>
    Promise.resolve({ version: 2, nextAllowedAt: "2026-10-01T12:00:20.000Z" }),
  );
  const close = vi.fn(() => Promise.resolve());
  const openAdmission = vi.fn(() => ({ admission: { reserve }, close }));
  const fetch = vi.fn<typeof globalThis.fetch>((input) => {
    const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      cik = /CIK([0-9]{10})/u.exec(url)?.[1];
    if (!cik) throw new Error("Unexpected test network");
    return Promise.resolve(
      Response.json(packets(cik)[url.includes("companyfacts") ? 1 : 0]),
    );
  });
  const service = createManagedSecAnnualService({
    configuration,
    catalog: getManagedWorkspaceCatalog(),
    enteredAt: ENTRY,
    startedAt: 0,
    monotonic: () => elapsed,
    now: () => new Date(ENTRY),
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
    elapsed: (ms: number) => {
      elapsed = ms;
    },
  };
}
afterEach(() => {
  vi.useRealTimers();
});

describe("managed annual evidence service", () => {
  it.each(["AAPL", "GOOG", "GOOGL"])(
    "preserves %s identity and derives its issuer before two fixed source reads",
    async (symbol) => {
      const f = fixture(),
        request = command(symbol),
        signal = new AbortController().signal;
      const result = await f.service.load(request, PRINCIPAL, signal);
      const cik = symbol === "AAPL" ? "0000320193" : "0001652044";
      expect(result.security).toMatchObject({
        symbol,
        listingId: request.listingId,
        cik,
      });
      expect(result.evidence.resolution.currentTargetEligible).toBe(true);
      expect(f.fetch.mock.calls.map(([url]) => url)).toEqual([
        `https://data.sec.gov/submissions/CIK${cik}.json`,
        `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      ]);
      expect(f.reserve).toHaveBeenCalledExactlyOnceWith(
        PRINCIPAL,
        ENTRY,
        expect.any(AbortSignal),
      );
      expect(f.close).toHaveBeenCalledTimes(1);
      expect(f.close.mock.invocationCallOrder[0]).toBeLessThan(
        f.fetch.mock.invocationCallOrder[0]!,
      );
      for (const [, init] of f.fetch.mock.calls)
        expect(init).toMatchObject({
          method: "GET",
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
        });
    },
  );
  it.each([
    { catalogSnapshotSha256: `sha256:${"a".repeat(64)}` },
    { symbol: "GOOG" },
    { listingId: "listing-absent" },
  ])(
    "denies stale or mismatched selection before storage/source %j",
    async (patch) => {
      const f = fixture();
      await expect(
        f.service.load(
          { ...command(), ...patch } as PersonalSecAnnualEvidenceRequestDto,
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
  it("explicit unconfigured source is checked after catalog identity and before storage", async () => {
    const f = fixture(null);
    await expect(
      f.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "not_configured" });
    expect(f.openAdmission).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it.each([
    new ManagedSecAnnualAdmissionError(
      "rate_limited",
      "2026-10-01T12:00:20.000Z",
    ),
    new Error("Unknown commit"),
  ])(
    "never dispatches SEC after denied or uncertain admission",
    async (error) => {
      const f = fixture();
      f.reserve.mockRejectedValue(error);
      await expect(
        f.service.load(command(), PRINCIPAL, new AbortController().signal),
      ).rejects.toMatchObject({
        code:
          error instanceof ManagedSecAnnualAdmissionError
            ? "rate_limited"
            : "unavailable",
      });
      expect(f.close).toHaveBeenCalledTimes(1);
      expect(f.fetch).not.toHaveBeenCalled();
    },
  );
  it("late admission acknowledgment is discarded and storage closes before any SEC call", async () => {
    const f = fixture();
    f.reserve.mockImplementation(() => {
      f.elapsed(2000);
      return Promise.resolve({
        version: 2,
        nextAllowedAt: "2026-10-01T12:00:20.000Z",
      });
    });
    await expect(
      f.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "request_timeout" });
    expect(f.close).toHaveBeenCalledTimes(1);
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("failed storage cleanup grants zero source calls despite acknowledged admission", async () => {
    const f = fixture();
    f.close.mockRejectedValue(new Error("Synthetic close failure"));
    await expect(
      f.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toThrow();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it.each([403, 429])(
    "stops after the first HTTP%d without fallback source calls",
    async (status) => {
      const f = fixture();
      f.fetch.mockResolvedValue(new Response("Synthetic denial", { status }));
      await expect(
        f.service.load(command(), PRINCIPAL, new AbortController().signal),
      ).rejects.toMatchObject({ code: "unavailable" });
      expect(f.fetch).toHaveBeenCalledTimes(1);
    },
  );
  it("keeps the accepted first-body failure latch", async () => {
    const f = fixture();
    f.fetch.mockResolvedValue(
      new Response(
        new ReadableStream({
          pull(stream) {
            stream.error(new Error("Synthetic body failure"));
          },
        }),
      ),
    );
    await expect(
      f.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it("retains truthful refusal for malformed received200 and never exceeds two sources", async () => {
    const f = fixture();
    f.fetch.mockResolvedValueOnce(new Response("{broken"));
    const result = await f.service.load(
      command(),
      PRINCIPAL,
      new AbortController().signal,
    );
    expect(result.evidence.completeness.status).toBe("refused");
    expect(result.evidence.target.status).toBe("unresolved");
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects late source completion and aborts a pending source on retirement", async () => {
    const f = fixture();
    f.fetch.mockImplementationOnce(() => {
      f.elapsed(7500);
      return Promise.resolve(Response.json(packets()[0]));
    });
    await expect(
      f.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "request_timeout" });
    expect(f.fetch).toHaveBeenCalledTimes(1);
    const g = fixture(),
      controller = new AbortController();
    g.fetch.mockImplementation(() => {
      controller.abort();
      return new Promise(() => undefined);
    });
    await expect(
      g.service.load(command(), PRINCIPAL, controller.signal),
    ).rejects.toMatchObject({ code: "request_timeout" });
    expect(g.fetch).toHaveBeenCalledTimes(1);
  });
  it("uses entry time rather than a new admission window after slow authentication", async () => {
    const f = fixture();
    f.elapsed(2000);
    await expect(
      f.service.load(command(), PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "request_timeout" });
    expect(f.openAdmission).not.toHaveBeenCalled();
  });
});
