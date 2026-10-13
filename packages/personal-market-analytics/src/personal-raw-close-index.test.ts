import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculatePersonalRawCloseIndex } from "./index";

describe("displayed raw-close index", () => {
  it("uses a common 100 base and four-place half-up rounding", () => {
    expect(calculatePersonalRawCloseIndex("3", "3")).toEqual({
      index: "100.0000",
      value: 100,
    });
    expect(calculatePersonalRawCloseIndex("1", "3")).toEqual({
      index: "33.3333",
      value: 33.3333,
    });
    expect(calculatePersonalRawCloseIndex("1.0000005", "1")).toEqual({
      index: "100.0001",
      value: 100.0001,
    });
  });

  it("preserves 64-character inputs without converting source amounts to Number", () => {
    const base = "9".repeat(64);
    expect(calculatePersonalRawCloseIndex(base, base).index).toBe("100.0000");
    expect(
      calculatePersonalRawCloseIndex("9007199254740992", "9007199254740991")
        .index,
    ).toBe("100.0000");
  });

  it("keeps exact table indices while refusing positive underflow and unsafe plot coordinates", () => {
    expect(calculatePersonalRawCloseIndex("0.00000001", "100")).toEqual({
      index: "0.0000",
      value: null,
    });
    expect(calculatePersonalRawCloseIndex("9007199254740991", "100")).toEqual({
      index: "9007199254740991.0000",
      value: Number.MAX_SAFE_INTEGER,
    });
    for (const close of [
      "9007199254740991.0001",
      "9007199254740991.00001",
      "9".repeat(64),
    ]) {
      expect(calculatePersonalRawCloseIndex(close, "100").value).toBeNull();
    }
  });

  it("isolates arithmetic from other Decimal users", () => {
    const previous = {
      precision: Decimal.precision,
      rounding: Decimal.rounding,
    };
    try {
      Decimal.set({ precision: 2, rounding: Decimal.ROUND_DOWN });
      expect(calculatePersonalRawCloseIndex("1.0000005", "1").index).toBe(
        "100.0001",
      );
    } finally {
      Decimal.set(previous);
    }
  });

  it.each(["0", "-1", "1e2", "NaN", " 1", "9".repeat(65)])(
    "rejects invalid positive source %s",
    (value) => {
      expect(() => calculatePersonalRawCloseIndex(value, "1")).toThrow();
      expect(() => calculatePersonalRawCloseIndex("1", value)).toThrow();
    },
  );
});
