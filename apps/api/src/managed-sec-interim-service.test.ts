import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MANAGED_SEC_INTERIM_EVIDENCE_LIMITS,
  PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY,
} from "@research-cockpit/contracts";
import {
  parsePersonalSecInterimCanonicalResponse,
  resolvePersonalSecInterimStatements,
} from "@research-cockpit/personal-financial-analytics";
import { createManagedSecInterimService } from "./managed-sec-interim-service";
import { ManagedSecAdmissionError } from "./managed-sec-admission";
import { getManagedWorkspaceCatalog } from "./managed-workspace-catalog";
import {
  MANAGED_SEC_ANNUAL_ISSUERS,
  MANAGED_SEC_INTERIM_ISSUERS,
} from "./managed-sec-issuers";
import {
  INTERIM_ENTRY,
  INTERIM_CONTACT,
  INTERIM_PRINCIPAL,
  interimCommand,
  interimPackets,
} from "./test-personal-sec-interim-fixtures";
function fixture(
  configuration: { userAgent: string } | null = { userAgent: INTERIM_CONTACT },
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
          : input.url;
    const cik = /CIK([0-9]{10})/u.exec(url)![1]!;
    return Promise.resolve(
      Response.json(interimPackets(cik)[url.includes("companyfacts") ? 1 : 0]),
    );
  });
  const service = createManagedSecInterimService({
    configuration,
    catalog: getManagedWorkspaceCatalog(),
    enteredAt: INTERIM_ENTRY,
    startedAt: 0,
    monotonic: () => elapsed,
    now: () => new Date(INTERIM_ENTRY),
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
describe("managed interim canonical service", () => {
  it.each([
    "AAPL",
    "GOOG",
    "GOOGL",
    "MSFT",
    "BKTI",
    "AMD",
    "MATX",
    "ALCO",
    "LNG",
    "SWKS",
    "HWM",
    "UHAL",
    "AXP",
    "AFL",
    "AIG",
    "UNM",
    "AVD",
    "AP",
  ])(
    "qualifies only existingcohort %s through two fixed reads and all32concepts",
    async (symbol) => {
      const f = fixture();
      const command = interimCommand(symbol);
      const result = await f.service.load(
        command,
        INTERIM_PRINCIPAL,
        new AbortController().signal,
      );
      const cik = result.security.cik;
      expect(MANAGED_SEC_INTERIM_ISSUERS).toContain(cik);
      expect(MANAGED_SEC_ANNUAL_ISSUERS).toContain(cik);
      expect(result.security.symbol).toBe(symbol);
      expect(result.schemaVersion).toBe("1.0.0");
      expect(result.evidence.target).toEqual({
        status: "target",
        accessionNumber: `${cik}-26-000042`,
        form: "10-Q",
        filedDate: "2026-08-01",
        reportDate: "2026-06-30",
        acceptedAt: "2026-08-01T12:00:00.000Z",
      });
      expect(result.evidence.targetScan).toEqual({
        currentFilings: 3,
        interimFilings: 2,
        olderHistoryAvailable: true,
      });
      expect(result.evidence.facts.scans.map((row) => row.concept)).toEqual(
        PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY.map((row) => row.concept),
      );
      expect(f.fetch.mock.calls.map(([url]) => url)).toEqual([
        `https://data.sec.gov/submissions/CIK${cik}.json`,
        `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      ]);
      expect(f.reserve).toHaveBeenCalledExactlyOnceWith(
        INTERIM_PRINCIPAL,
        INTERIM_ENTRY,
        expect.any(AbortSignal),
      );
      expect(f.close).toHaveBeenCalledOnce();
      expect(
        await parsePersonalSecInterimCanonicalResponse(
          result,
          command,
          new AbortController().signal,
        ),
      ).not.toBeNull();
    },
  );
  it("keeps same-end different-start windows distinct without quarter inference or older-accession fallback", async () => {
    const f = fixture();
    const result = await f.service.load(
      interimCommand(),
      INTERIM_PRINCIPAL,
      new AbortController().signal,
    );
    const view = resolvePersonalSecInterimStatements(result.evidence);
    const revenue = view.statements
      .find((s) => s.id === "income_statement")!
      .rows.find((r) => r.concept === "Revenues")!;
    expect(
      revenue.cells
        .filter((c) => c.period.endDate === "2026-06-30")
        .map((c) => [
          c.period.startDate,
          c.status === "available" ? c.value : null,
        ])
        .sort(),
    ).toEqual([
      ["2026-01-01", "200"],
      ["2026-04-01", "100"],
    ]);
    expect(new Set(revenue.cells.map((c) => c.period.key)).size).toBe(
      revenue.cells.length,
    );
    expect(
      revenue.cells.every((c) => c.period.classification === "not_established"),
    ).toBe(true);
    expect(
      result.evidence.facts.observations.some((row) => row.value === "999"),
    ).toBe(false);
  });
  it.each([
    { cik: "0000000001" },
    { schemaVersion: "6.0.0" },
    { symbol: "GOOG" },
    { listingId: "listing-missing" },
  ])("rejects forged request %j before admission or HTTP", async (patch) => {
    const f = fixture();
    await expect(
      f.service.load(
        { ...interimCommand(), ...patch } as ReturnType<typeof interimCommand>,
        INTERIM_PRINCIPAL,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(f.openAdmission).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("refuses stale catalog, unqualified CIK and disabled source before budget", async () => {
    const f = fixture();
    await expect(
      f.service.load(
        {
          ...interimCommand(),
          catalogSnapshotSha256: `sha256:${"0".repeat(64)}`,
        },
        INTERIM_PRINCIPAL,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "catalog_changed" });
    await expect(
      f.service.load(
        interimCommand("AEM"),
        INTERIM_PRINCIPAL,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(f.reserve).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
    const off = fixture(null);
    await expect(
      off.service.load(
        interimCommand(),
        INTERIM_PRINCIPAL,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "not_configured" });
    expect(off.reserve).not.toHaveBeenCalled();
  });
  it("preserves shared/principal rate limiting and closes its exact admission transport", async () => {
    const f = fixture();
    f.reserve.mockRejectedValue(
      new ManagedSecAdmissionError("rate_limited", "2026-10-01T12:00:20.000Z"),
    );
    await expect(
      f.service.load(
        interimCommand(),
        INTERIM_PRINCIPAL,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      code: "rate_limited",
      nextAllowedAt: "2026-10-01T12:00:20.000Z",
    });
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("never resets the2s entry deadline after admission", async () => {
    const f = fixture();
    f.reserve.mockImplementation(() => {
      f.elapsed(2_000);
      return Promise.resolve({ version: 2, nextAllowedAt: INTERIM_ENTRY });
    });
    await expect(
      f.service.load(
        interimCommand(),
        INTERIM_PRINCIPAL,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "request_timeout" });
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("bounds noncooperative admission and external abort without a later source request", async () => {
    vi.useFakeTimers();
    const f = fixture();
    let release: () => void = () => undefined;
    f.reserve.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ version: 2, nextAllowedAt: INTERIM_ENTRY });
        }),
    );
    const pending = f.service.load(
      interimCommand(),
      INTERIM_PRINCIPAL,
      new AbortController().signal,
    );
    const observed = expect(pending).rejects.toMatchObject({
      code: "request_timeout",
    });
    await vi.advanceTimersByTimeAsync(2_000);
    await observed;
    release();
    await Promise.resolve();
    expect(f.fetch).not.toHaveBeenCalled();
    expect(f.close).toHaveBeenCalledOnce();
  });
  it("retires a late ignored HTTP response and never admits its CompanyFacts", async () => {
    const f = fixture();
    const controller = new AbortController();
    let settle: (response: Response) => void = () => undefined;
    f.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    const pending = f.service.load(
      interimCommand(),
      INTERIM_PRINCIPAL,
      controller.signal,
    );
    const observed = expect(pending).rejects.toMatchObject({
      code: "request_timeout",
    });
    await vi.waitFor(() => expect(f.fetch).toHaveBeenCalledOnce());
    controller.abort();
    await observed;
    const cancel = vi.fn();
    settle(new Response(new ReadableStream({ cancel })));
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
    expect(f.fetch).toHaveBeenCalledOnce();
  });
  it("stops at the provider deadline before accepting either source result", async () => {
    const f = fixture();
    f.fetch.mockImplementation(() => {
      f.elapsed(7_501);
      return Promise.resolve(Response.json(interimPackets()[0]));
    });
    await expect(
      f.service.load(
        interimCommand(),
        INTERIM_PRINCIPAL,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "request_timeout" });
    expect(f.fetch).toHaveBeenCalledOnce();
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "rejects invalid monotonic source completion %s",
    async (elapsed) => {
      const f = fixture();
      f.fetch.mockImplementation(() => {
        f.elapsed(elapsed);
        return Promise.resolve(Response.json(interimPackets()[0]));
      });
      await expect(
        f.service.load(
          interimCommand(),
          INTERIM_PRINCIPAL,
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: "request_timeout" });
      expect(f.fetch).toHaveBeenCalledOnce();
    },
  );
  it("bounds the serialized whole graph without clipping a completed source", async () => {
    const f = fixture();
    const [submissions] = interimPackets();
    const fact = {
      start: "2026-01-01",
      end: "2026-06-30",
      val: 42,
      accn: "0000320193-26-000042",
      fy: 2026,
      fp: "Q2",
      form: "10-Q",
      filed: "2026-08-01",
    };
    const facts = Object.fromEntries(
      PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY.map(({ concept, periodType }) => [
        concept,
        {
          units: {
            USD: Array.from({ length: 100 }, (_, i) => ({
              ...fact,
              start: periodType === "instant" ? undefined : fact.start,
              frame: "\\".repeat(120) + String(i).padStart(3, "0"),
            })),
          },
        },
      ]),
    );
    const text = JSON.stringify({
      cik: 320193,
      facts: { "us-gaap": facts },
    }).replaceAll('"val":42', '"val":' + "9".repeat(64));
    // Keep decimal lexemes lossless, including values beyond Number precision.
    f.fetch.mockImplementation((input) =>
      Promise.resolve(
        typeof input === "string" && input.includes("companyfacts")
          ? new Response(text)
          : Response.json(submissions),
      ),
    );
    expect(MANAGED_SEC_INTERIM_EVIDENCE_LIMITS.responseBytes).toBe(2_097_152);
    await expect(
      f.service.load(
        interimCommand(),
        INTERIM_PRINCIPAL,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(f.reserve).toHaveBeenCalledOnce();
  });
});
