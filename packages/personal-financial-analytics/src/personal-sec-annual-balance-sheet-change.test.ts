import type { PersonalSecAnnualBalanceSheetValueDto } from "@research-cockpit/contracts";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import type {
  PersonalSecAnnualBalanceSheetHistory,
  PersonalSecAnnualBalanceSheetHistoryBalance,
} from "./personal-sec-annual-balance-sheet";
import { comparePersonalSecAnnualBalanceSheetHistory as compare } from "./personal-sec-annual-balance-sheet-change";

type Amount = PersonalSecAnnualBalanceSheetValueDto;
type History = Extract<
  PersonalSecAnnualBalanceSheetHistory,
  { status: "available" }
>;
const accessionNumber = "0000000001-26-000001";
const currentDate = "2025-12-31";
const priorDate = "2024-12-31";
const id = (n: number): `sec-fact:${string}` =>
  `sec-fact:${n.toString(16).padStart(64, "0")}`;

function amount(value: string, asOfDate: string, reference: number): Amount {
  return {
    status: "available",
    unit: "USD",
    value,
    asOfDate,
    accessionNumber,
    observationIds: [id(reference)],
    currentUseEligible: asOfDate === currentDate,
  };
}
function refused(
  reason: Extract<Amount, { status: "unavailable" }>["reason"],
  references: number[] = [],
): Amount {
  return {
    status: "unavailable",
    unit: "USD",
    reason,
    observationIds: references.map(id),
  };
}
function balance(
  asOfDate: string,
  assets: Amount,
  liabilities: Amount,
  equity: Amount,
): PersonalSecAnnualBalanceSheetHistoryBalance {
  return {
    asOfDate,
    totalAssets: assets,
    totalLiabilities: liabilities,
    shareholdersEquity: equity,
  };
}
/** Derived resolver output only; raw admission remains covered by the history suite. */
function history(current = "1000.125", prior = "900.5"): History {
  return {
    status: "available",
    accessionNumber,
    balances: [
      balance(
        currentDate,
        amount(current, currentDate, 1),
        amount("1200.25", currentDate, 2),
        amount("-200.125", currentDate, 3),
      ),
      balance(
        priorDate,
        amount(prior, priorDate, 4),
        refused("no_report_date"),
        amount("0", priorDate, 5),
      ),
      balance(
        "2023-09-30",
        amount("800.875", "2023-09-30", 6),
        amount("900", "2023-09-30", 7),
        amount("-98.625", "2023-09-30", 8),
      ),
    ],
  };
}
function available(input: PersonalSecAnnualBalanceSheetHistory) {
  const result = compare(input);
  if (result.status !== "available") throw new Error(result.reason);
  return result;
}

describe("reported balance-sheet change from resolved history", () => {
  it("compares the first two shared dates independently, retaining exact cells and references", () => {
    const input = history();
    const result = available(input);
    expect(result).toMatchObject({
      currentDate,
      priorDate,
      accessionNumber,
      totalAssets: {
        status: "available",
        unit: "USD",
        difference: "99.625",
        observationIds: [id(1), id(4)],
      },
      shareholdersEquity: {
        status: "available",
        difference: "-200.125",
        observationIds: [id(3), id(5)],
      },
      totalLiabilities: {
        status: "unavailable",
        prior: {
          status: "unavailable",
          reason: "no_report_date",
          observationIds: [],
        },
      },
    });
    expect(result.totalAssets.current).toEqual(input.balances[0]!.totalAssets);
    expect(result.totalAssets.prior).toEqual(input.balances[1]!.totalAssets);
    expect(result.totalAssets.prior).toMatchObject({
      currentUseEligible: false,
    });
    expect(result.totalLiabilities.current).toMatchObject({ value: "1200.25" });
    expect(JSON.stringify(result)).not.toContain(id(7));
  });

  it.each([
    ["10", "-5", "15"],
    ["-5", "10", "-15"],
    ["-3", "-5", "2"],
    ["-5", "-3", "-2"],
    ["0", "0", "0"],
    ["-2", "-2", "0"],
    ["1.004", "0.999", "0.005"],
    ["0.999", "1.004", "-0.005"],
  ])(
    "keeps exact signed current %s minus prior %s",
    (current, prior, expected) => {
      expect(available(history(current, prior)).totalAssets).toMatchObject({
        status: "available",
        difference: expected,
      });
    },
  );

  it("retains both actual refusal sides and never substitutes an older complete column", () => {
    const input = history();
    const current = {
      ...input.balances[0]!,
      totalAssets: refused("ambiguous_value", [10, 11]),
    };
    const prior = {
      ...input.balances[1]!,
      totalAssets: refused("missing_or_non_FY_focus", [12]),
      shareholdersEquity: refused("invalid_instant_period", [13]),
    };
    const result = available({
      ...input,
      balances: [current, prior, input.balances[2]!],
    });
    expect(result.totalAssets).toEqual({
      status: "unavailable",
      unit: "USD",
      current: current.totalAssets,
      prior: prior.totalAssets,
    });
    expect(result.shareholdersEquity).toMatchObject({
      status: "unavailable",
      prior: { reason: "invalid_instant_period", observationIds: [id(13)] },
    });
    expect(result.totalLiabilities.status).toBe("unavailable");
    expect(result.priorDate).toBe(priorDate);
    expect(JSON.stringify(result)).not.toContain("2023-09-30");
  });

  it("keeps sibling changes when the current amount of one metric is refused", () => {
    const input = history();
    const current = {
      ...input.balances[0]!,
      totalAssets: refused("selected_report_overflow", [1]),
    };
    expect(
      available({ ...input, balances: [current, ...input.balances.slice(1)] }),
    ).toMatchObject({
      totalAssets: {
        status: "unavailable",
        current: { reason: "selected_report_overflow" },
      },
      shareholdersEquity: { status: "available", difference: "-200.125" },
    });
  });

  it("keeps the actual non-consecutive dates and ignores a refused third column", () => {
    const input = history();
    const prior = balance(
      "2023-09-30",
      amount("900.5", "2023-09-30", 4),
      refused("no_report_date"),
      amount("0", "2023-09-30", 5),
    );
    const two = { ...input, balances: [input.balances[0]!, prior] };
    const third = balance(
      "2022-02-28",
      refused("ambiguous_value", [21]),
      refused("no_report_date"),
      refused("invalid_instant_period", [22]),
    );
    const result = available({ ...two, balances: [...two.balances, third] });
    expect(result).toEqual(compare(two));
    expect(result.priorDate).toBe("2023-09-30");
    expect(result.totalAssets).toMatchObject({ difference: "99.625" });
  });

  it("reports an absent prior date while retaining each current cell", () => {
    const input = history();
    const result = available({
      ...input,
      balances: input.balances.slice(0, 1),
    });
    expect(result.priorDate).toBeNull();
    for (const key of [
      "totalAssets",
      "totalLiabilities",
      "shareholdersEquity",
    ] as const)
      expect(result[key]).toEqual({
        status: "unavailable",
        unit: "USD",
        current: input.balances[0]![key],
        prior: null,
      });
  });

  it.each([
    "current_use_unavailable",
    "invalid_clock",
    "source_stale",
    "target_unresolved",
  ] as const)(
    "preserves the history-level %s refusal without deriving values",
    (reason) =>
      expect(compare({ status: "unavailable", reason })).toEqual({
        status: "unavailable",
        reason,
      }),
  );

  it("retains all agreeing IDs and owns frozen cells without freezing unfrozen input", () => {
    const input = history();
    const original = input.balances[0]!.totalAssets;
    const current = {
      ...input.balances[0]!,
      totalAssets: {
        ...original,
        observationIds: [...original.observationIds, id(9)],
      },
    };
    const caller = {
      ...input,
      balances: [current, ...input.balances.slice(1)],
    };
    const before = JSON.stringify(caller);
    const result = available(caller);
    expect(JSON.stringify(caller)).toBe(before);
    expect(result.totalAssets).toMatchObject({
      observationIds: [id(1), id(9), id(4)],
    });
    expect(result.totalAssets.current).not.toBe(current.totalAssets);
    expect(result.totalAssets.current.observationIds).not.toBe(
      current.totalAssets.observationIds,
    );
    expect(result.totalAssets.prior).not.toBe(input.balances[1]!.totalAssets);
    function frozen(value: unknown): void {
      if (value !== null && typeof value === "object") {
        expect(Object.isFrozen(value)).toBe(true);
        Object.values(value).forEach(frozen);
      }
    }
    frozen(result);
    for (const value of [
      caller,
      caller.balances,
      current,
      current.totalAssets,
      current.totalAssets.observationIds,
      input.balances[1]!.totalLiabilities.observationIds,
    ])
      expect(Object.isFrozen(value)).toBe(false);
    current.totalAssets.observationIds.push(id(10));
    expect(result.totalAssets.current.observationIds).toEqual([id(1), id(9)]);
    expect(compare(structuredClone(caller))).not.toBe(result);
  });

  it("uses isolated Decimal precision for the exact 128-character signed extremes", () => {
    const precision = Decimal.precision,
      rounding = Decimal.rounding;
    try {
      Decimal.set({ precision: 2, rounding: Decimal.ROUND_DOWN });
      const large = "9".repeat(64),
        tiny = `0.${"0".repeat(61)}1`;
      const negative = `-${"9".repeat(63)}8.${"9".repeat(62)}`;
      expect(negative).toHaveLength(128);
      expect(available(history(tiny, large)).totalAssets).toMatchObject({
        difference: negative,
      });
      expect(available(history(large, tiny)).totalAssets).toMatchObject({
        difference: negative.slice(1),
      });
      const carry = `-1${"0".repeat(64)}.${"1".repeat(61)}`;
      expect(carry).toHaveLength(128);
      expect(
        available(history(`-1.${"1".repeat(61)}`, large)).totalAssets,
      ).toMatchObject({ difference: carry });
    } finally {
      Decimal.set({ precision, rounding });
    }
  });

  it("fails impossible derived date or filing joins instead of calculating across them", () => {
    const input = history();
    expect(() => compare({ ...input, balances: [] })).toThrow(TypeError);
    expect(() =>
      compare({ ...input, balances: [input.balances[0]!, input.balances[0]!] }),
    ).toThrow(TypeError);
    const first = input.balances[0]!;
    expect(() =>
      compare({
        ...input,
        balances: [
          {
            ...first,
            totalAssets: {
              ...first.totalAssets,
              accessionNumber: "0000000002-26-000001",
            } as Amount,
          },
          input.balances[1]!,
        ],
      }),
    ).toThrow(TypeError);
  });
});
