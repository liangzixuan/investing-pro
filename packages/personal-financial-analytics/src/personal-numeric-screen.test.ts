import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  comparePersonalNumericScreenRows,
  evaluatePersonalNumericScreenClauses,
  isPersonalNumericScreenDecimal,
  type PersonalNumericScreenRow,
} from "./personal-numeric-screen";

describe("shared numeric screening", () => {
  it("preserves exact signed thresholds and false precedence over unknown", () => {
    const metrics = {
      exact: {
        status: "available",
        value: "9007199254740993.000000000000000001",
      },
      negative: { status: "available", value: "-0.000000000000000001" },
      missing: { status: "unavailable" },
    } as const;
    expect(evaluatePersonalNumericScreenClauses(metrics, [])).toBe("true");
    expect(
      evaluatePersonalNumericScreenClauses(metrics, [
        {
          field: "exact",
          operator: "gte",
          value: "9007199254740993.000000000000000002",
        },
      ]),
    ).toBe("false");
    expect(
      evaluatePersonalNumericScreenClauses(metrics, [
        { field: "negative", operator: "lte", value: "0" },
      ]),
    ).toBe("true");
    const unknown = { field: "missing", operator: "gte", value: "0" } as const;
    const failing = { field: "negative", operator: "gte", value: "0" } as const;
    expect(evaluatePersonalNumericScreenClauses(metrics, [unknown])).toBe(
      "unknown",
    );
    expect(
      evaluatePersonalNumericScreenClauses(metrics, [unknown, failing]),
    ).toBe("false");
    expect(
      evaluatePersonalNumericScreenClauses(metrics, [failing, unknown]),
    ).toBe("false");
  });

  it.each(["asc", "desc"] as const)(
    "keeps unknowns last and ascending identity ties for %s numeric order",
    (direction) => {
      const make = (
        symbol: string,
        listingId: string,
        value: string | null,
      ): PersonalNumericScreenRow<"amount"> => ({
        identity: { symbol, listingId },
        metrics: {
          amount:
            value === null
              ? { status: "unavailable" }
              : { status: "available", value },
        },
      });
      const rows = [
        make("MISSING", "listing-z", null),
        make("SAME", "listing-b", "2"),
        make("SAME", "listing-a", "2.0"),
        make("LOW", "listing-c", "-1"),
      ];
      rows.sort((left, right) =>
        comparePersonalNumericScreenRows(left, right, {
          field: "amount",
          direction,
        }),
      );
      expect(rows.map((row) => row.identity.listingId)).toEqual(
        direction === "asc"
          ? ["listing-c", "listing-a", "listing-b", "listing-z"]
          : ["listing-a", "listing-b", "listing-c", "listing-z"],
      );
    },
  );

  it("retains the existing bounded plain signed-decimal grammar", () => {
    for (const value of ["0", "-0", "1.00", "-0.001", "1".repeat(64)])
      expect(isPersonalNumericScreenDecimal(value)).toBe(true);
    for (const value of [
      0,
      null,
      "",
      "+1",
      "01",
      ".5",
      "1.",
      "1e2",
      "NaN",
      "Infinity",
      " 1",
      "1".repeat(65),
    ])
      expect(isPersonalNumericScreenDecimal(value)).toBe(false);
  });

  it("compares exact values after global Decimal settings change", () => {
    const prior = {
      precision: Decimal.precision,
      maxE: Decimal.maxE,
      rounding: Decimal.rounding,
    };
    try {
      Decimal.set({ precision: 2, maxE: 1, rounding: Decimal.ROUND_DOWN });
      expect(
        isPersonalNumericScreenDecimal("9007199254740993.000000000000000001"),
      ).toBe(true);
      expect(
        evaluatePersonalNumericScreenClauses(
          {
            amount: {
              status: "available",
              value: "9007199254740993.000000000000000001",
            },
          },
          [{ field: "amount", operator: "lte", value: "9007199254740993" }],
        ),
      ).toBe("false");
    } finally {
      Decimal.set(prior);
    }
  });
});
