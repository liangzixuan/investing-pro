import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { calculatePersonalRawCloseChange } from "./index";

const unsafeChange = calculatePersonalRawCloseChange as (
  input: unknown,
) => unknown;
const previousDate = "2026-09-18";
const latestDate = "2026-09-21";
const row = (date: string, close: string) => ({ date, close });
const compare = (previous: string, latest: string) =>
  calculatePersonalRawCloseChange({
    rows: [row(previousDate, previous), row(latestDate, latest)],
  });

describe("raw close change", () => {
  it("compares only the last two observations and preserves their actual dates", () => {
    expect(
      calculatePersonalRawCloseChange({
        rows: [
          row("2026-09-15", "999"),
          row(previousDate, "10.25"),
          row(latestDate, "10.5"),
        ],
      }),
    ).toEqual({
      status: "available",
      previousDate,
      latestDate,
      change: "0.25",
      changePercent: "2.4390",
      direction: "up",
    });
  });

  it.each([
    ["0.2", "0.3", "0.1", "50.0000", "up"],
    ["20.75", "20.5", "-0.25", "-1.2048", "down"],
    ["30.5", "30.5", "0", "0.0000", "unchanged"],
    ["30.50", "30.500", "0", "0.0000", "unchanged"],
    ["200", "100", "-100", "-50.0000", "down"],
  ])(
    "keeps the raw difference from %s to %s without binary or adjustment assumptions",
    (previous, latest, change, changePercent, direction) => {
      expect(compare(previous, latest)).toEqual({
        status: "available",
        previousDate,
        latestDate,
        change,
        changePercent,
        direction,
      });
    },
  );

  it("replaces the comparison with the new response rather than comparing refresh snapshots", () => {
    const initial = compare("10.25", "10.5");
    const refreshed = compare("11.25", "11.5");
    expect(initial).toMatchObject({ change: "0.25", changePercent: "2.4390" });
    expect(refreshed).toMatchObject({
      change: "0.25",
      changePercent: "2.2222",
    });
    expect(initial).toMatchObject({ change: "0.25", changePercent: "2.4390" });
  });

  it.each([{ rows: [] }, { rows: [row(latestDate, "12.5")] }])(
    "returns insufficient history for zero or one valid observation: $rows",
    ({ rows }) => {
      expect(calculatePersonalRawCloseChange({ rows })).toEqual({
        status: "insufficient_history",
      });
    },
  );

  it.each([
    ["32", "32.000016", "0.000016", "0.0001", "up"],
    ["32", "31.999984", "-0.000016", "-0.0001", "down"],
    ["100", "100.00001", "0.00001", "0.0000", "up"],
    ["100", "99.99999", "-0.00001", "0.0000", "down"],
  ])(
    "rounds only the percentage and retains exact direction for %s to %s",
    (previous, latest, change, changePercent, direction) => {
      expect(compare(previous, latest)).toMatchObject({
        change,
        changePercent,
        direction,
      });
    },
  );

  it("keeps a difference beyond binary precision exact", () => {
    expect(
      compare(
        "9007199254740993.123456789012345678",
        "9007199254740994.123456789012345679",
      ),
    ).toMatchObject({
      change: "1.000000000000000001",
      changePercent: "0.0000",
      direction: "up",
    });
  });

  it("subtracts the widest accepted decimal scales without losing the small component", () => {
    const large = "9".repeat(64);
    const small = `0.${"0".repeat(61)}1`;
    expect(compare(small, large)).toMatchObject({
      change: `${"9".repeat(63)}8.${"9".repeat(62)}`,
      direction: "up",
    });
  });

  it("does not depend on or alter global Decimal precision and rounding", () => {
    const precision = Decimal.precision;
    const rounding = Decimal.rounding;
    try {
      Decimal.set({ precision: 2, rounding: Decimal.ROUND_DOWN });
      expect(compare("32", "32.000016")).toMatchObject({
        change: "0.000016",
        changePercent: "0.0001",
        direction: "up",
      });
      expect(Decimal.precision).toBe(2);
      expect(Decimal.rounding).toBe(Decimal.ROUND_DOWN);
    } finally {
      Decimal.set({ precision, rounding });
    }
  });

  it("does not mutate its input and freezes its scalar result", () => {
    const rows = Object.freeze([
      Object.freeze(row(previousDate, "10.25")),
      Object.freeze(row(latestDate, "10.5")),
    ]);
    const input = Object.freeze({ rows });
    const before = JSON.stringify(input);
    const result = calculatePersonalRawCloseChange(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(calculatePersonalRawCloseChange({ rows: [] }))).toBe(
      true,
    );
  });

  it.each([
    "0",
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
  ])("rejects malformed or nonpositive close %j even with one row", (close) => {
    expect(() => unsafeChange({ rows: [{ date: latestDate, close }] })).toThrow(
      "Invalid raw close change input.",
    );
  });

  it.each(
    [
      [row("2026-02-30", "1"), row(previousDate, "2"), row(latestDate, "3")],
      [row(previousDate, "1"), row(previousDate, "2")],
      [row(latestDate, "1"), row(previousDate, "2")],
      [row("2026-9-18", "1")],
      [row("2026-09-18T00:00:00.000Z", "1")],
      [row("2026-09-15", "0"), row(previousDate, "2"), row(latestDate, "3")],
    ].map((rows) => ({ rows })),
  )("validates every source row and strict date order: $rows", ({ rows }) => {
    expect(() => calculatePersonalRawCloseChange({ rows })).toThrow(TypeError);
  });

  it.each([
    null,
    {},
    { rows: null },
    { rows: [], extra: true },
    { rows: [{ date: latestDate, close: "1", splitFactor: "1" }] },
    { rows: [{ date: latestDate, raw: { close: "1" } }] },
    { rows: [new Date()] },
    { rows: new Array(2) },
  ])("rejects malformed or over-bound raw-only input %j", (input) => {
    expect(() => unsafeChange(input)).toThrow(TypeError);
  });

  it("rejects histories exceeding the existing bounded calculation input", () => {
    expect(() =>
      calculatePersonalRawCloseChange({
        rows: Array.from({ length: 4_097 }, () => row(latestDate, "1")),
      }),
    ).toThrow(TypeError);
  });
});
