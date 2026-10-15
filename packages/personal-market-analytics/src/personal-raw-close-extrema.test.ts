import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { calculatePersonalRawCloseExtrema } from "./index";

const unsafeExtrema = calculatePersonalRawCloseExtrema as (
  input: unknown,
) => unknown;
const row = (date: string, close: string) => ({ date, close });
const extreme = (date: string, close: string, occurrences = 1) => ({
  date,
  close,
  occurrences,
});
function datedRows(length: number, close: (index: number) => string) {
  return Array.from({ length }, (_, index) => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    date.setUTCDate(date.getUTCDate() + index);
    return row(date.toISOString().slice(0, 10), close(index));
  });
}
const dates = ["2026-09-01", "2026-09-18", "2026-09-30"] as const;

describe("observed raw-close extrema", () => {
  it.each([
    { closes: ["3", "2", "1"], low: 2, high: 0 },
    { closes: ["1", "2", "3"], low: 0, high: 2 },
    { closes: ["2", "1", "3"], low: 1, high: 2 },
    { closes: ["2", "3", "1"], low: 2, high: 1 },
  ])(
    "selects exact first/middle/last extrema from sparse observations: $closes",
    ({ closes, low, high }) => {
      expect(
        calculatePersonalRawCloseExtrema({
          rows: dates.map((date, i) => row(date, closes[i]!)),
        }),
      ).toEqual({
        status: "available",
        lowest: extreme(dates[low]!, closes[low]!),
        highest: extreme(dates[high]!, closes[high]!),
      });
    },
  );

  it("has no invented value or date for an empty sample", () => {
    const result = calculatePersonalRawCloseExtrema({ rows: [] });
    expect(result).toEqual({
      status: "unavailable",
      reason: "no_observations",
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("uses one observation for both extremes with its exact source text", () => {
    expect(
      calculatePersonalRawCloseExtrema({ rows: [row(dates[0], "12.500")] }),
    ).toEqual({
      status: "available",
      lowest: extreme(dates[0], "12.500"),
      highest: extreme(dates[0], "12.500"),
    });
  });

  it("counts a numerically flat sample and keeps its earliest lexeme and date", () => {
    expect(
      calculatePersonalRawCloseExtrema({
        rows: [
          row(dates[0], "12.500"),
          row(dates[1], "12.5"),
          row(dates[2], "12.50"),
        ],
      }),
    ).toEqual({
      status: "available",
      lowest: extreme(dates[0], "12.500", 3),
      highest: extreme(dates[0], "12.500", 3),
    });
  });

  it("counts all numeric ties and resets counts when a different extreme appears", () => {
    const rows = datedRows(
      8,
      (i) => ["5", "5.0", "8.00", "2.00", "8", "2", "8.0", "4"][i]!,
    );
    expect(calculatePersonalRawCloseExtrema({ rows })).toEqual({
      status: "available",
      lowest: extreme(rows[3]!.date, "2.00", 2),
      highest: extreme(rows[2]!.date, "8.00", 3),
    });
  });

  it("distinguishes prices that collapse to the same binary number", () => {
    const low = "9007199254740993.123456789012345678";
    const high = "9007199254740993.123456789012345679";
    expect(Number(low)).toBe(Number(high));
    expect(
      calculatePersonalRawCloseExtrema({
        rows: [row(dates[0], high), row(dates[1], low), row(dates[2], high)],
      }),
    ).toEqual({
      status: "available",
      lowest: extreme(dates[1], low),
      highest: extreme(dates[0], high, 2),
    });
  });

  it("preserves and compares the widest accepted 64-character scales exactly", () => {
    const small = `0.${"0".repeat(61)}1`;
    const large = "9".repeat(64);
    const lessLarge = `${"9".repeat(63)}8`;
    expect(small).toHaveLength(64);
    expect(large).toHaveLength(64);
    expect(
      calculatePersonalRawCloseExtrema({
        rows: [
          row(dates[0], lessLarge),
          row(dates[1], large),
          row(dates[2], small),
        ],
      }),
    ).toEqual({
      status: "available",
      lowest: extreme(dates[2], small),
      highest: extreme(dates[1], large),
    });
  });

  it("uses all 367 observations, including extremes outside the latest 252", () => {
    const rows = datedRows(367, (index) =>
      index === 0 ? "500" : index === 1 ? "0.125" : "100",
    );
    expect(rows[0]!.date).toBe("2024-01-01");
    expect(rows.at(-1)!.date).toBe("2025-01-01");
    expect(calculatePersonalRawCloseExtrema({ rows })).toEqual({
      status: "available",
      lowest: extreme("2024-01-02", "0.125"),
      highest: extreme("2024-01-01", "500"),
    });
  });

  it("preserves the existing 4096-row defensive bound without clipping", () => {
    const rows = datedRows(4096, (index) => (index === 4095 ? "2" : "1"));
    expect(calculatePersonalRawCloseExtrema({ rows })).toEqual({
      status: "available",
      lowest: extreme(rows[0]!.date, "1", 4095),
      highest: extreme(rows.at(-1)!.date, "2"),
    });
    expect(() =>
      calculatePersonalRawCloseExtrema({ rows: datedRows(4097, () => "1") }),
    ).toThrow("Invalid raw close extrema input.");
  });

  it("owns and freezes the result without mutating or retaining the caller's rows", () => {
    const source = [row(dates[0], "1.25"), row(dates[1], "8.75")];
    const before = structuredClone(source);
    const result = calculatePersonalRawCloseExtrema({ rows: source });
    expect(source).toEqual(before);
    if (result.status !== "available") throw new Error("Expected extrema");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.lowest)).toBe(true);
    expect(Object.isFrozen(result.highest)).toBe(true);
    source[0]!.close = "50";
    source[1]!.date = "2026-10-01";
    expect(result.lowest).toEqual(extreme(dates[0], "1.25"));
    expect(result.highest).toEqual(extreme(dates[1], "8.75"));
    const frozen = Object.freeze(before.map((item) => Object.freeze(item)));
    expect(
      calculatePersonalRawCloseExtrema(Object.freeze({ rows: frozen })),
    ).toEqual(result);
  });

  it("uses fixed Decimal defaults without changing ambient configuration", () => {
    const original = {
      precision: Decimal.precision,
      rounding: Decimal.rounding,
      minE: Decimal.minE,
      maxE: Decimal.maxE,
    };
    try {
      Decimal.set({
        precision: 1,
        rounding: Decimal.ROUND_UP,
        minE: -1,
        maxE: 1,
      });
      expect(
        calculatePersonalRawCloseExtrema({
          rows: [
            row(dates[0], "1000000000000001"),
            row(dates[1], "0.000000000001"),
          ],
        }),
      ).toEqual({
        status: "available",
        lowest: extreme(dates[1], "0.000000000001"),
        highest: extreme(dates[0], "1000000000000001"),
      });
      expect({
        precision: Decimal.precision,
        rounding: Decimal.rounding,
        minE: Decimal.minE,
        maxE: Decimal.maxE,
      }).toEqual({
        precision: 1,
        rounding: Decimal.ROUND_UP,
        minE: -1,
        maxE: 1,
      });
    } finally {
      Decimal.set(original);
    }
  });

  it.each([
    "0",
    "0.0",
    "-0",
    "-1",
    "+1",
    "01",
    "1e2",
    ".5",
    "1.",
    "NaN",
    "Infinity",
    " 1",
    "1 ",
    "9".repeat(65),
    1,
    null,
  ])(
    "rejects a malformed or nonpositive price %j, including in a single-row sample",
    (close) => {
      expect(() =>
        unsafeExtrema({ rows: [{ date: dates[0], close }] }),
      ).toThrow("Invalid raw close extrema input.");
    },
  );

  it.each([
    "2026-02-29",
    "2026-02-30",
    "2026-9-01",
    "2026-09-01T00:00:00.000Z",
    "2026-13-01",
    "not-a-date",
    null,
    20260901,
  ])("rejects invalid source dates %j", (date) => {
    expect(() => unsafeExtrema({ rows: [{ date, close: "1" }] })).toThrow(
      TypeError,
    );
  });

  it.each(
    [
      [row(dates[0], "1"), row(dates[0], "2")],
      [row(dates[1], "1"), row(dates[0], "2")],
      [row(dates[0], "1"), row(dates[1], "3"), row(dates[2], "0")],
      [row(dates[0], "bad"), row(dates[1], "3"), row(dates[2], "1")],
    ].map((rows) => ({ rows })),
  )(
    "refuses the full input rather than sorting or skipping an invalid row: $rows",
    ({ rows }) => {
      expect(() => calculatePersonalRawCloseExtrema({ rows })).toThrow(
        TypeError,
      );
    },
  );

  it.each([
    null,
    {},
    { rows: null },
    { rows: [], extra: true },
    { rows: new Array(2) },
    { rows: new Uint8Array([1, 2]) },
    { rows: [{ date: dates[0], close: "1", splitFactor: "1" }] },
    { rows: [{ date: dates[0], raw: { close: "1" } }] },
    { rows: [new Date()] },
    { rows: [null] },
    {
      rows: [
        Object.assign(
          Object.create({ inherited: true }) as object,
          row(dates[0], "1"),
        ),
      ],
    },
  ])("rejects malformed input or rows %j", (input) => {
    expect(() => unsafeExtrema(input)).toThrow(TypeError);
  });

  it("rejects a hole inside an otherwise valid sample", () => {
    const rows = new Array<{ date: string; close: string }>(3);
    rows[0] = row(dates[0], "1");
    rows[2] = row(dates[2], "3");
    expect(() => calculatePersonalRawCloseExtrema({ rows })).toThrow(TypeError);
  });
});
