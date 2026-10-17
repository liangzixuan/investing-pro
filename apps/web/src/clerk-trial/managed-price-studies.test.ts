import { describe, expect, it } from "vitest";
import { parseManagedEodHistoryResponse } from "@research-cockpit/contracts";
import { eodRequest, eodResponse } from "./eod-history-fixture";
import { resolveManagedPriceStudies } from "./managed-price-studies";

function flat(count: number) {
  const source = eodResponse("1y");
  const rows = Array.from({ length: count }, (_, index) => ({
    date: new Date(Date.UTC(2025, 8, 23 + index)).toISOString().slice(0, 10),
    close: "100.000000000000000001",
  }));
  const response = parseManagedEodHistoryResponse(
    { ...source, rows },
    eodRequest("1y"),
  );
  if (!response) throw new Error("Invalid invented studies fixture");
  return response;
}
describe("managed raw close studies", () => {
  it("uses exact admitted closes and the last observed date, with no fabricated adjusted input", () => {
    const source = eodResponse();
    const result = resolveManagedPriceStudies(source)!;
    expect(result.calculation.mode).toBe("raw");
    expect(result.calculation.asOfDate).toBe("2026-09-19");
    expect(source.window.endDate).toBe("2026-09-20");
    expect(result.calculation.metrics.selectedWindowReturn).toMatchObject({
      status: "available",
      valuePercent: "1.2469",
      observedSessions: 2,
    });
    expect(result.response.rows).toEqual(source.rows);
    expect(result.rows.find((row) => row.key === "windowChange")).toMatchObject(
      {
        available: true,
        value: "1.2469%",
        sample: "2 observed closes; 2026-09-18 through 2026-09-19",
      },
    );
    expect(result.rows.find((row) => row.key === "sma200")).toMatchObject({
      available: false,
      value: "Unavailable: needs 200 observed closes",
    });
    expect(Object.isFrozen(result.calculation)).toBe(true);
    expect(Object.isFrozen(result.rows)).toBe(true);
  });
  it("retains independent zero-range and history refusals, without claiming calendar coverage", () => {
    const short = resolveManagedPriceStudies(flat(20))!;
    expect(short.rows.find((row) => row.key === "sma20")?.value).toBe(
      "at; distance 0.0000%",
    );
    expect(short.rows.find((row) => row.key === "volatility")?.available).toBe(
      false,
    );
    const long = resolveManagedPriceStudies(flat(200))!;
    expect(long.rows.find((row) => row.key === "volatility")?.value).toBe(
      "0.0000%",
    );
    expect(long.rows.find((row) => row.key === "rangePosition")).toMatchObject({
      available: false,
      value: "Unavailable: all sampled closes are equal",
    });
    expect(
      long.rows.find((row) => row.key === "rangePosition")?.detail,
    ).toContain("not a verified calendar-year");
    expect(long.calculation.inputWindow.sessionCount).toBe(200);
    expect(long.response.rows[0]!.close).toBe("100.000000000000000001");
  });
  it("refuses a changed identity, basis, chronology or unsupported source without changing its caller", () => {
    const source = structuredClone(eodResponse());
    const original = JSON.stringify(source);
    expect(
      resolveManagedPriceStudies({ ...source, currency: "EUR" } as never),
    ).toBeNull();
    expect(
      resolveManagedPriceStudies({
        ...source,
        priceBasis: "adjusted_close",
      } as never),
    ).toBeNull();
    expect(
      resolveManagedPriceStudies({
        ...source,
        rows: [...source.rows].reverse(),
      }),
    ).toBeNull();
    expect(
      resolveManagedPriceStudies({
        ...source,
        rows: [{ date: "2026-09-19", close: "0" }],
      }),
    ).toBeNull();
    expect(JSON.stringify(source)).toBe(original);
  });
});
