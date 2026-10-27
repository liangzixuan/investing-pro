import { describe, expect, it } from "vitest";
import {
  preparePortfolioReviewReport,
  isPreparedPortfolioReviewReport,
} from "./portfolio-review-report";
import {
  portfolioReviewReportFixture,
  portfolioReviewReportInput,
} from "./portfolio-review-report-fixture";
import { eodResponse, eodSelection } from "./eod-history-fixture";

function twoHoldings() {
  const f = portfolioReviewReportFixture();
  const other = {
    ...eodSelection.listing,
    listingId: "listing-other",
    securityId: "security-other",
    shareClassId: "class-other",
    symbol: "OTHER",
  };
  return portfolioReviewReportInput({
    ...f.ledger,
    identities: [...f.ledger.identities, other],
    opening: {
      ...f.ledger.opening,
      holdings: [
        ...f.ledger.opening.holdings,
        { ...f.ledger.opening.holdings[0]!, listingId: other.listingId },
      ],
    },
  });
}
describe("owned completed Portfolio report capture", () => {
  it("freezes the canonical composition with the report's whole captured review", () => {
    const input = portfolioReviewReportFixture();
    const report = preparePortfolioReviewReport(input)!;
    expect(report.review.composition).toEqual(input.review.composition);
    expect(report.review.composition).toMatchObject({
      status: "available",
      totalValueUsd: "213.00",
      cashUsd: "10.00",
      cashPercent: "4.69",
      holdings: [
        {
          listingId: eodSelection.listing.listingId,
          valueUsd: "203.00",
          percent: "95.31",
        },
      ],
    });
    expect(Object.isFrozen(report.review.composition)).toBe(true);
    expect(Object.isFrozen(report.review.composition.holdings)).toBe(true);
    expect(Object.isFrozen(report.review.composition.holdings[0])).toBe(true);
  });
  it.each([
    ["status", "unavailable"],
    ["reason", "zero_total"],
    ["totalValueUsd", "203.00"],
    ["cashUsd", "0.00"],
    ["cashPercent", "0.00"],
    ["method", "priced_subset"],
  ])("refuses forged composition %s instead of capturing it", (key, value) => {
    const input = structuredClone(portfolioReviewReportFixture());
    expect(Reflect.set(input.review.composition, key, value)).toBe(true);
    expect(preparePortfolioReviewReport(input)).toBeNull();
  });
  it("refuses a forged per-listing percentage or priced-subset composition", () => {
    const complete = structuredClone(portfolioReviewReportFixture());
    expect(
      Reflect.set(
        complete.review.composition.holdings[0]!,
        "percent",
        "100.00",
      ),
    ).toBe(true);
    expect(preparePortfolioReviewReport(complete)).toBeNull();
    const partial = structuredClone(twoHoldings());
    expect(partial.review.composition.status).toBe("unavailable");
    expect(
      Reflect.set(partial.review.composition.holdings[0]!, "percent", "100.00"),
    ).toBe(true);
    expect(preparePortfolioReviewReport(partial)).toBeNull();
  });
  it("copies and freezes exact ledger, holdings, raw packet and half-up values without changing input", () => {
    const input = structuredClone(portfolioReviewReportFixture());
    const before = JSON.stringify(input);
    const report = preparePortfolioReviewReport(input)!;
    expect(report).not.toBeNull();
    expect(report.review).toMatchObject({
      holdingsValueUsd: "203.00",
      totalValueUsd: "213.00",
      method: "each_holding_round_half_up_to_cents_then_sum",
    });
    expect(report.ledger).toEqual(input.ledger);
    expect(report.ledger).not.toBe(input.ledger);
    expect(report.sourceRows[0]!.response).toEqual(
      input.state.rows[0]!.response,
    );
    expect(report.sourceRows[0]!.response).not.toBe(
      input.state.rows[0]!.response,
    );
    expect(Object.isFrozen(report.sourceRows[0]!.response!.rows[0])).toBe(true);
    expect(Object.isFrozen(report.ledger.opening.holdings)).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    expect(Reflect.set(input.state.rows[0]!, "message", "Later state")).toBe(
      true,
    );
    expect(report.sourceRows[0]!.message).toBe("One-month raw closes loaded.");
  });
  it("keeps partial values and refused unsupported holding without fabricating complete totals", () => {
    const report = preparePortfolioReviewReport(twoHoldings())!;
    expect(report.review).toMatchObject({
      pricedHoldings: 1,
      totalHoldings: 2,
      pricedHoldingsSubtotalUsd: "203.00",
      holdingsValueUsd: null,
      totalValueUsd: null,
    });
    expect(report.sourceRows[1]).toMatchObject({
      available: false,
      response: null,
    });
    expect(report.review.holdings[1]!.reason).toBe("close_not_loaded");
  });
  it("uses exact per-line half-up cents and then sums the displayed values", () => {
    const input = twoHoldings();
    const ledger = {
      ...input.ledger,
      opening: {
        ...input.ledger.opening,
        holdings: input.ledger.opening.holdings.map((h) => ({
          ...h,
          shares: "0.01",
        })),
      },
    };
    const packets = ledger.identities.map((security) => ({
      ...eodResponse(),
      security,
    }));
    const report = preparePortfolioReviewReport(
      portfolioReviewReportInput(ledger, "2026-09-19", packets),
    )!;
    expect(report.review.holdings.map((line) => line.valueUsd)).toEqual([
      "1.02",
      "1.02",
    ]);
    expect(report.review).toMatchObject({
      pricedHoldingsSubtotalUsd: "2.04",
      holdingsValueUsd: "2.04",
      totalValueUsd: "12.04",
    });
  });
  it("preserves unknown cash independently from complete prices", () => {
    const f = portfolioReviewReportFixture();
    const report = preparePortfolioReviewReport(
      portfolioReviewReportInput({
        ...f.ledger,
        opening: { ...f.ledger.opening, cashUsd: null },
      }),
    )!;
    expect(report.review).toMatchObject({
      holdingsValueUsd: "203.00",
      cashUsd: null,
      totalValueUsd: null,
    });
  });
  it("preserves before-balance-date refusals and every original packet clock", () => {
    const f = portfolioReviewReportFixture();
    const input = portfolioReviewReportInput({
      ...f.ledger,
      opening: {
        ...f.ledger.opening,
        asOfDate: "2026-09-20",
        holdings: f.ledger.opening.holdings.map((h) => ({
          ...h,
          confirmedOn: "2026-09-20",
        })),
      },
    });
    const report = preparePortfolioReviewReport(input)!;
    expect(report.review.holdings[0]).toMatchObject({
      status: "unavailable",
      reason: "balance_after_close",
      close: null,
      valueUsd: null,
    });
    expect(report.sourceRows[0]!.response!.completedAt).toBe(
      "2026-09-20T00:00:01.000Z",
    );
  });
  it("retains cancelled or failed refresh qualifications without redating source history", () => {
    const input = portfolioReviewReportFixture();
    const report = preparePortfolioReviewReport({
      ...input,
      state: {
        ...input.state,
        message: "Loading cancelled.",
        rows: input.state.rows.map((row) => ({
          ...row,
          showingPrevious: true,
          message: "Refresh failed. Previous history retained.",
        })),
      },
    })!;
    expect(report.sourceRows[0]!.showingPrevious).toBe(true);
    expect(report.sourceRows[0]!.response!.requestStartedAt).toBe(
      "2026-09-20T00:00:00.000Z",
    );
    expect(report.message).toBe("Loading cancelled.");
  });
  it("rejects running loads and unobserved, incomplete or reordered date lists", () => {
    const f = portfolioReviewReportFixture();
    for (const state of [
      { ...f.state, running: true },
      { ...f.state, selectedDate: "2026-09-17" },
      { ...f.state, dates: [f.state.selectedDate] },
      {
        ...f.state,
        rows: f.state.rows.map((row) => ({ ...row, running: true })),
      },
    ])
      expect(preparePortfolioReviewReport({ ...f, state })).toBeNull();
  });
  it("rejects contradictions in ledger, projection, holdings, identities and raw responses", () => {
    const f = portfolioReviewReportFixture();
    expect(
      preparePortfolioReviewReport({
        ...f,
        ledger: { ...f.ledger, schemaVersion: 2 } as never,
      }),
    ).toBeNull();
    expect(
      preparePortfolioReviewReport({
        ...f,
        portfolio: { ...f.portfolio, cashUsd: "999.00" },
      }),
    ).toBeNull();
    expect(
      preparePortfolioReviewReport({ ...f, state: { ...f.state, rows: [] } }),
    ).toBeNull();
    for (const key of Object.keys(eodSelection.listing)) {
      const row = f.state.rows[0]!;
      expect(
        preparePortfolioReviewReport({
          ...f,
          state: {
            ...f.state,
            rows: [
              {
                ...row,
                response: {
                  ...row.response!,
                  security: { ...row.response!.security, [key]: "different" },
                },
              },
            ],
          },
        }),
      ).toBeNull();
    }
    expect(
      preparePortfolioReviewReport({
        ...f,
        state: {
          ...f.state,
          rows: [
            {
              ...f.state.rows[0]!,
              holding: { ...f.portfolio.holdings[0]!, shares: "3" },
            },
          ],
        },
      }),
    ).toBeNull();
    expect(
      preparePortfolioReviewReport({
        ...f,
        review: { ...f.review, totalValueUsd: "999.00" },
      }),
    ).toBeNull();
  });
  it("refuses inconsistent retained flags, unavailable source packets and malformed windows", () => {
    const f = portfolioReviewReportFixture();
    const row = f.state.rows[0]!;
    for (const changed of [
      { ...row, response: null, showingPrevious: true },
      { ...row, available: false },
      { ...row, response: { ...row.response!, range: "1y" as const } },
    ])
      expect(
        preparePortfolioReviewReport({
          ...f,
          state: { ...f.state, rows: [changed] },
        }),
      ).toBeNull();
  });
  it("requires a valid UTC millisecond preparation time and valid bounded Unicode", () => {
    const f = portfolioReviewReportFixture();
    for (const preparedAt of [
      "invalid",
      "2026-10-24T03:00:00Z",
      "2026-02-30T00:00:00.000Z",
      "2026-10-24T03:00:00.123+00:00",
    ])
      expect(preparePortfolioReviewReport({ ...f, preparedAt })).toBeNull();
    for (const message of ["\ud800", "\udfff", "a".repeat(8 * 1024 * 1024)])
      expect(
        preparePortfolioReviewReport({ ...f, state: { ...f.state, message } }),
      ).toBeNull();
    expect(
      preparePortfolioReviewReport({
        ...f,
        state: { ...f.state, message: "Café 東京 📈" },
      }),
    ).not.toBeNull();
  });
  it("brands only the owned original and contains hostile access without throwing", () => {
    const report = preparePortfolioReviewReport(
      portfolioReviewReportFixture(),
    )!;
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error("trap");
        },
      },
    );
    expect(isPreparedPortfolioReviewReport(report)).toBe(true);
    for (const value of [
      null,
      {},
      { ...report },
      structuredClone(report),
      hostile,
    ])
      expect(isPreparedPortfolioReviewReport(value)).toBe(false);
    expect(preparePortfolioReviewReport(hostile as never)).toBeNull();
  });
});
