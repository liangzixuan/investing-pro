import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  type PersonalSecAnnualCanonicalRequestDto,
} from "@research-cockpit/contracts";

import {
  derivePersonalSecAnnualCanonicalView,
  derivePersonalSecAnnualFinancialInputs,
} from "@research-cockpit/personal-financial-analytics";
import { ManagedSecAdmissionError } from "./managed-sec-admission";
import { createManagedSecAnnualService } from "./managed-sec-annual-service";
import {
  createManagedCatalogService,
  getManagedWorkspaceCatalog,
} from "./managed-workspace-catalog";

const ENTRY = "2026-10-01T12:00:00.000Z";
const CONTACT = "Synthetic annual fixture fixture@example.test";
const PRINCIPAL = { userId: "synthetic_sec_principal_01" };
function command(symbol = "AAPL"): PersonalSecAnnualCanonicalRequestDto {
  const catalog = createManagedCatalogService();
  const listing = catalog
    .search(symbol)!
    .results.find((r) => r.symbol === symbol)!;
  return {
    schemaVersion: PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
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
          OperatingIncomeLoss: { units: { USD: [{ ...fact, val: 18 }] } },
          NetCashProvidedByUsedInOperatingActivities: {
            units: { USD: [{ ...fact, val: -2 }] },
          },
          PaymentsToAcquirePropertyPlantAndEquipment: {
            units: { USD: [{ ...fact, val: 3 }] },
          },
          AssetsCurrent: {
            units: { USD: [{ ...fact, start: undefined, val: 120 }] },
          },
          LiabilitiesCurrent: {
            units: { USD: [{ ...fact, start: undefined, val: 80 }] },
          },
          Assets: {
            units: { USD: [{ ...fact, start: undefined, val: 500 }] },
          },
          Liabilities: {
            units: { USD: [{ ...fact, start: undefined, val: 600 }] },
          },
          StockholdersEquity: {
            units: { USD: [{ ...fact, start: undefined, val: -100 }] },
          },
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
  vi.restoreAllMocks();
});

describe("managed annual evidence service", () => {
  it.each(["1.0.0", "2.0.0", "3.0.0", "4.0.0", "5.0.0"])(
    "rejects version %s before reserving a budget or acquiring either source",
    async (schemaVersion) => {
      const f = fixture();
      await expect(
        f.service.load(
          {
            ...command(),
            schemaVersion,
          } as unknown as PersonalSecAnnualCanonicalRequestDto,
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
    { symbol: "AAPL", cik: "0000320193" },
    { symbol: "GOOG", cik: "0001652044" },
    { symbol: "GOOGL", cik: "0001652044" },
    { symbol: "MSFT", cik: "0000789019" },
    { symbol: "BKTI", cik: "0000002186" },
    { symbol: "AMD", cik: "0000002488" },
    { symbol: "MATX", cik: "0000003453" },
    { symbol: "ALCO", cik: "0000003545" },
    { symbol: "LNG", cik: "0000003570" },
    { symbol: "SWKS", cik: "0000004127" },
    { symbol: "HWM", cik: "0000004281" },
    { symbol: "UHAL", cik: "0000004457" },
    { symbol: "AXP", cik: "0000004962" },
    { symbol: "AFL", cik: "0000004977" },
    { symbol: "AIG", cik: "0000005272" },
    { symbol: "UNM", cik: "0000005513" },
    { symbol: "AVD", cik: "0000005981" },
    { symbol: "AP", cik: "0000006176" },
  ])(
    "preserves $symbol identity and derives its issuer before two fixed source reads",
    async ({ symbol, cik }) => {
      const f = fixture(),
        request = command(symbol),
        signal = new AbortController().signal;
      const result = await f.service.load(request, PRINCIPAL, signal);
      const view = derivePersonalSecAnnualCanonicalView(result.evidence);
      const listing = createManagedCatalogService()
        .search(symbol)!
        .results.find(
          (candidate) => candidate.listingId === request.listingId,
        )!;
      expect(result.security).toEqual({
        country: listing.country,
        exchangeMic: listing.exchangeMic,
        issuerName: listing.issuerName,
        issuerId: listing.issuerId,
        securityName: listing.securityName,
        symbol,
        listingId: request.listingId,
        cik,
      });
      expect(view.income.resolution.currentTargetEligible).toBe(true);
      expect(view.operatingResults.resolution.operatingIncome).toMatchObject({
        status: "available",
        unit: "USD",
        value: "18",
      });
      expect(
        view.operatingResults.resolution.margins.find(
          (basis) => basis.concept === "Revenues",
        ),
      ).toMatchObject({
        concept: "Revenues",
        revenue: { status: "available", value: "120" },
        operatingMargin: {
          status: "available",
          unit: "percent",
          value: "15",
        },
      });
      expect(result.schemaVersion).toBe(PERSONAL_SEC_ANNUAL_CANONICAL_VERSION);
      expect(
        view.cashGeneration.resolution.operatingCashFlowLessPpePurchases,
      ).toMatchObject({
        status: "available",
        value: "-5",
        currentUseEligible: true,
      });
      expect(view.liquidity.resolution.workingCapital).toMatchObject({
        status: "available",
        unit: "USD",
        value: "40",
        asOfDate: "2025-09-30",
      });
      expect(view.liquidity.resolution.currentRatio).toMatchObject({
        status: "available",
        unit: "multiple",
        value: "1.50",
        asOfDate: "2025-09-30",
      });
      expect(view.balanceSheet.resolution).toMatchObject({
        totalAssets: {
          status: "available",
          value: "500",
          unit: "USD",
          asOfDate: "2025-09-30",
        },
        totalLiabilities: {
          status: "available",
          value: "600",
          unit: "USD",
          asOfDate: "2025-09-30",
        },
        shareholdersEquity: {
          status: "available",
          value: "-100",
          unit: "USD",
          asOfDate: "2025-09-30",
        },
      });
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
  it("serializes all 1000 admitted canonical observations under the unchanged response cap without clipping", async () => {
    const f = fixture();
    const rows = Array.from({ length: 100 }, (_, index) => ({
      start: "2024-10-01",
      end: "2025-09-30",
      val: 42,
      accn: "0000320193-25-000042",
      fy: 2025,
      fp: "FY",
      form: "10-K",
      filed: "2025-11-01",
      frame: `${"\\".repeat(126)}${String(index).padStart(2, "0")}`,
    }));
    const usd = (values: readonly unknown[]) => ({ units: { USD: values } });
    const instantRows = rows.map((row) => ({ ...row, start: undefined }));
    const decimal = "9".repeat(64);
    const body = JSON.stringify({
      cik: 320193,
      facts: {
        "us-gaap": {
          RevenueFromContractWithCustomerExcludingAssessedTax: usd(
            rows.slice(0, 34),
          ),
          Revenues: usd(rows.slice(34, 67)),
          SalesRevenueNet: usd(rows.slice(67)),
          NetIncomeLoss: usd(rows),
          OperatingIncomeLoss: usd(rows),
          NetCashProvidedByUsedInOperatingActivities: usd(rows),
          PaymentsToAcquirePropertyPlantAndEquipment: usd(rows),
          AssetsCurrent: usd(instantRows),
          LiabilitiesCurrent: usd(instantRows),
          Assets: usd(instantRows),
          Liabilities: usd(instantRows),
          StockholdersEquity: usd(instantRows),
        },
      },
    }).replaceAll('"val":42', `"val":${decimal}`);
    f.fetch.mockImplementation((input) =>
      Promise.resolve(
        input === "https://data.sec.gov/submissions/CIK0000320193.json"
          ? Response.json(packets()[0])
          : new Response(body),
      ),
    );
    const result = await f.service.load(
      command(),
      PRINCIPAL,
      new AbortController().signal,
    );
    const evidence = result.evidence;
    const projected = derivePersonalSecAnnualFinancialInputs(evidence);
    const view = derivePersonalSecAnnualCanonicalView(evidence);
    const metrics = [
      projected.operatingResults.operatingIncome,
      projected.cashGeneration.operatingCashFlow,
      projected.cashGeneration.ppePurchases,
      projected.liquidity.currentAssets,
      projected.liquidity.currentLiabilities,
      projected.balanceSheet.totalAssets,
      projected.balanceSheet.totalLiabilities,
      projected.balanceSheet.shareholdersEquity,
    ];
    expect(evidence.facts.observations).toHaveLength(1000);
    expect(projected.income.observations).toHaveLength(200);
    expect(projected.income.reason).toBeNull();
    for (const metric of metrics) {
      expect(metric.observations).toHaveLength(100);
      expect(metric.scan).toMatchObject({
        coverage: { selected: 100, returned: 100, omittedSelected: 0 },
      });
    }
    const observations = [
      projected.income.observations,
      ...metrics.map((metric) => metric.observations),
    ];
    expect(observations.reduce((total, rows) => total + rows.length, 0)).toBe(
      1000,
    );
    for (const rows of observations)
      expect(
        rows.every((row) => row.value === decimal && row.frame?.length === 128),
      ).toBe(true);
    expect(view.operatingResults.resolution.operatingIncome).toMatchObject({
      status: "available",
      value: decimal,
    });
    expect(
      view.operatingResults.resolution.margins.map(
        (basis) => basis.operatingMargin,
      ),
    ).toMatchObject([
      { status: "available", value: "100" },
      { status: "available", value: "100" },
      { status: "available", value: "100" },
    ]);
    expect(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes).toBe(2_097_152);
    for (const value of [
      view.balanceSheet.resolution.totalAssets,
      view.balanceSheet.resolution.totalLiabilities,
      view.balanceSheet.resolution.shareholdersEquity,
    ]) {
      expect(value).toMatchObject({ status: "available", value: decimal });
      expect(value.observationIds).toHaveLength(100);
    }
    expect(
      Buffer.byteLength(JSON.stringify(result), "utf8"),
    ).toBeLessThanOrEqual(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes);
    expect(f.fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://data.sec.gov/submissions/CIK0000320193.json",
      "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
    ]);
    expect(f.reserve).toHaveBeenCalledOnce();
  });

  it("refuses a caller-supplied issuer before storage or SEC reads", async () => {
    const f = fixture();
    const request = { ...command(), cik: "0000000001" };
    await expect(
      f.service.load(request, PRINCIPAL, new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(f.openAdmission).not.toHaveBeenCalled();
    expect(f.reserve).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it.each([50, 100])(
    "encodes all 32 concepts with %d selected rows or refuses the entire escaped packet",
    async (rowsPerConcept) => {
      const f = fixture();
      const text = capacityBody(rowsPerConcept, rowsPerConcept === 100);
      f.fetch.mockImplementation((input) =>
        Promise.resolve(
          input === "https://data.sec.gov/submissions/CIK0000320193.json"
            ? Response.json(packets()[0])
            : new Response(text),
        ),
      );
      const operation = f.service.load(
        command(),
        PRINCIPAL,
        new AbortController().signal,
      );
      if (rowsPerConcept === 100) {
        await expect(operation).rejects.toMatchObject({
          code: "unavailable",
          message: "unavailable",
        });
      } else {
        const result = await operation;
        expect(result.evidence.facts.observations).toHaveLength(1600);
        expect(result.evidence.facts.scans.map((item) => item.concept)).toEqual(
          PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map((item) => item.concept),
        );
        for (const item of result.evidence.facts.scans)
          expect(item.scan).toMatchObject({
            coverage: { selected: 50, returned: 50, omittedSelected: 0 },
          });
        expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(
          2_097_152,
        );
        expect(Object.keys(result.evidence)).toEqual([
          "cik",
          "generation",
          "target",
          "targetScan",
          "facts",
        ]);
      }
      expect(Buffer.byteLength(text)).toBeLessThan(8 * 1024 * 1024);
      expect(f.fetch).toHaveBeenCalledTimes(2);
      expect(f.reserve).toHaveBeenCalledOnce();
      expect(f.close).toHaveBeenCalledOnce();
    },
  );
  it.each(["deadline", "retirement"] as const)(
    "does not return a packet after %s during final encoding",
    async (kind) => {
      const f = fixture();
      const controller = new AbortController();
      const stringify = JSON.stringify;
      let prepared = false;
      vi.spyOn(JSON, "stringify").mockImplementation((value, ...args) => {
        if (
          value !== null &&
          typeof value === "object" &&
          "security" in value &&
          "evidence" in value
        ) {
          prepared = true;
          if (kind === "deadline") f.elapsed(7500);
          else controller.abort();
        }
        return stringify(value, ...args);
      });
      await expect(
        f.service.load(command(), PRINCIPAL, controller.signal),
      ).rejects.toMatchObject({ code: "request_timeout" });
      expect(prepared).toBe(true);
      expect(f.fetch).toHaveBeenCalledTimes(2);
      expect(f.close).toHaveBeenCalledOnce();
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
          { ...command(), ...patch } as PersonalSecAnnualCanonicalRequestDto,
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
    new ManagedSecAdmissionError("rate_limited", "2026-10-01T12:00:20.000Z"),
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
          error instanceof ManagedSecAdmissionError
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
    expect(result.evidence.generation.sources.submissions.status).toBe(
      "invalid_response",
    );
    expect(result.evidence.facts.observations).toEqual([]);
    expect(result.evidence.facts.scans).toHaveLength(32);
    for (const entry of result.evidence.facts.scans)
      if (entry.scan.status === "available")
        expect(entry.scan.coverage.selected).toBeNull();
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

function capacityBody(
  rowsPerConcept: number,
  escapedMetadata: boolean,
): string {
  return JSON.stringify({
    cik: 320193,
    facts: {
      "us-gaap": Object.fromEntries(
        PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map((entry) => [
          entry.concept,
          {
            units: {
              USD: Array.from({ length: rowsPerConcept }, (_, index) => ({
                start:
                  entry.periodType === "instant" ? undefined : "2024-10-01",
                end: "2025-09-30",
                val: index - 50,
                accn: "0000320193-25-000042",
                fy: 2025,
                fp: escapedMetadata ? '\\"'.repeat(16) : "FY",
                form: "10-K",
                filed: "2025-11-01",
                frame: escapedMetadata ? '\\"'.repeat(64) : "capacity-" + index,
              })),
            },
          },
        ]),
      ),
    },
  });
}
