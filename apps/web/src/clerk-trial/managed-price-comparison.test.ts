import { describe, expect, it } from "vitest";
import {
  defaultManagedPriceComparisonInterval,
  deriveLoadedPriceComparisonHistory,
  deriveManagedPriceComparison,
  deriveManagedPriceComparisonHistory,
  type ManagedPriceComparisonLoadedRow,
} from "./managed-price-comparison";
import { eodResponse } from "./eod-history-fixture";

const row = (): ManagedPriceComparisonLoadedRow => {
  const response = eodResponse();
  return { listing: response.security, response, showingPrevious: false };
};

describe("shared loaded-price history projection", () => {
  it("requires two histories for the shared primitive while Markets still requires exactly three", () => {
    const first = row();
    const second = row();
    expect(deriveLoadedPriceComparisonHistory([])).toEqual({
      status: "unavailable",
    });
    expect(deriveLoadedPriceComparisonHistory([first])).toEqual({
      status: "unavailable",
    });
    expect(deriveLoadedPriceComparisonHistory([first, second])?.status).toBe(
      "loaded",
    );
    const boardRow = { ...first, running: false, error: false, message: "" };
    for (const count of [0, 1, 2, 4])
      expect(
        deriveManagedPriceComparisonHistory({
          active: true,
          catalogChanged: false,
          rows: Array.from({ length: count }, () => boardRow),
        }),
      ).toEqual({ status: "unavailable" });
    const board = {
      active: true,
      catalogChanged: false,
      rows: [boardRow, boardRow, boardRow],
    };
    expect(deriveManagedPriceComparisonHistory(board)?.status).toBe("loaded");
    expect(
      deriveManagedPriceComparisonHistory({ ...board, active: false }),
    ).toBeNull();
    expect(
      deriveManagedPriceComparisonHistory({ ...board, catalogChanged: true }),
    ).toBeNull();
    expect(
      deriveManagedPriceComparisonHistory({
        ...board,
        rows: [boardRow, { ...boardRow, response: null }, boardRow],
      }),
    ).toEqual({ status: "unavailable" });
  });

  it("keeps original history references, exact values and full-span interval behavior", () => {
    const rows = Object.freeze([Object.freeze(row()), Object.freeze(row())]);
    const history = deriveLoadedPriceComparisonHistory(rows);
    if (history.status !== "loaded") throw new Error("Expected loaded pair");
    expect(history.rows).toBe(rows);
    expect(history.sharedDates).toEqual(["2026-09-18", "2026-09-19"]);
    const interval = defaultManagedPriceComparisonInterval(history);
    expect(interval).toEqual({
      startDate: "2026-09-18",
      endDate: "2026-09-19",
    });
    expect(deriveManagedPriceComparison(history, interval)).toMatchObject({
      status: "available",
      sharedDateCount: 2,
      intervalDateCount: 2,
      rows: [
        { firstClose: "100.25", lastClose: "101.5" },
        { firstClose: "100.25", lastClose: "101.5" },
      ],
    });
    for (const unavailable of [
      null,
      { status: "unavailable" } as const,
      { ...history, sharedDates: [] },
      { ...history, sharedDates: ["2026-09-18"] },
    ])
      expect(defaultManagedPriceComparisonInterval(unavailable)).toEqual({
        startDate: "",
        endDate: "",
      });
  });
});
