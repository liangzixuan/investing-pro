import { describe, expect, it } from "vitest";
import {
  MANAGED_EOD_BUDGET,
  MANAGED_EOD_MAPPING_SNAPSHOT,
  validateManagedEodConfiguration,
} from "./managed-eod-config";

describe("managed EOD public configuration", () => {
  it("binds the existing mappings to the reviewed October 16 catalog", () => {
    expect(MANAGED_EOD_MAPPING_SNAPSHOT).toBe(
      "sha256:5852beb972fdb7e1a93669d51996b3cca431f006b741c697c1952f7e14d3d5a0",
    );
  });
  it.each([
    "MSFT",
    "BKTI",
    "AMD",
    "AEM",
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
    "does not enable newly discoverable %s through public configuration",
    (symbol) =>
      expect(() =>
        validateManagedEodConfiguration({ enabledSymbols: [symbol] }),
      ).toThrow("Invalid managed EOD configuration"),
  );
  it("requires an explicit null or owns the enabled fixed symbols", () => {
    expect(validateManagedEodConfiguration(null)).toBeNull();
    const input = { enabledSymbols: ["AAPL", "GOOG", "GOOGL"] };
    const result = validateManagedEodConfiguration(input)!;
    input.enabledSymbols[0] = "WRONG";
    expect(result.enabledSymbols).toEqual(["AAPL", "GOOG", "GOOGL"]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.enabledSymbols)).toBe(true);
    expect(MANAGED_EOD_BUDGET).toEqual({
      databaseId: "investment_managed_watchlist_v1",
      tableId: "tiingo_eod_budget",
      rowId: "managed-eod-v1",
    });
  });
  it.each([
    { label: "missing", value: undefined },
    { label: "empty", value: {} },
    { label: "empty symbols", value: { enabledSymbols: [] } },
    { label: "duplicate", value: { enabledSymbols: ["AAPL", "AAPL"] } },
    { label: "alias", value: { enabledSymbols: ["BRK.B"] } },
    { label: "lowercase", value: { enabledSymbols: ["aapl"] } },
    {
      label: "secret",
      value: { enabledSymbols: ["AAPL"], token: "invented-secret" },
    },
    { label: "extra", value: { enabledSymbols: ["AAPL"], tableId: "other" } },
  ])("rejects $label", ({ value }) =>
    expect(() => validateManagedEodConfiguration(value)).toThrow(
      "Invalid managed EOD configuration",
    ),
  );
  it("does not invoke input accessors or accept sparse arrays", () => {
    let reads = 0;
    expect(() =>
      validateManagedEodConfiguration({
        get enabledSymbols() {
          reads++;
          return ["AAPL"];
        },
      }),
    ).toThrow();
    const symbols = ["AAPL"];
    Object.defineProperty(symbols, "0", {
      get() {
        reads++;
        return "AAPL";
      },
      enumerable: true,
    });
    expect(() =>
      validateManagedEodConfiguration({ enabledSymbols: symbols }),
    ).toThrow();
    expect(() =>
      validateManagedEodConfiguration({ enabledSymbols: new Array(1) }),
    ).toThrow();
    expect(reads).toBe(0);
  });
});
