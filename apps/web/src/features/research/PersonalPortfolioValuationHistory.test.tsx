import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PersonalPortfolioValuationHistoryPoint,
  PersonalPortfolioValuationHistoryResult,
} from "../../lib/personal-portfolio-valuation-history";
import { PersonalPortfolioValuationHistory } from "./PersonalPortfolioValuationHistory";

vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => hooks.useState(initial),
  useEffect: (effect: () => void, dependencies: readonly unknown[]) =>
    hooks.useEffect(effect, dependencies),
}));

type Available = Extract<
  PersonalPortfolioValuationHistoryResult,
  { status: "available" }
>;
type Element = React.ReactElement<Record<string, unknown>>;
let result: PersonalPortfolioValuationHistoryResult;

beforeEach(() => {
  hooks.reset();
  result = history();
});
afterEach(() => vi.unstubAllGlobals());

describe("PersonalPortfolioValuationHistory", () => {
  it("shows the engine's actual comparison dates and exact USD amounts without implying endpoint coverage", () => {
    const view = render();
    const content = text(view);
    expect(content).toContain("Requested window 2026-08-01 to 2026-09-05");
    expect(content).toContain("Ledger values begin on 2026-09-01");
    expect(content).toContain("3 of 5 calendar dates have a complete value");
    expect(content).toContain(
      "2026-09-02 to 2026-09-04: first and last complete values",
    );
    expect(content).toContain(
      "does not establish values at unpriced window endpoints",
    );
    expect(metric(view, "First complete value · 2026-09-02")).toBe(
      "120.00 USD",
    );
    expect(metric(view, "Last complete value · 2026-09-04")).toBe("160.00 USD");
    expect(metric(view, "Recorded net external flows")).toBe("25.00 USD");
    expect(metric(view, "Change after external cash flows")).toBe("15.00 USD");
    expect(content).toContain(
      "strictly after the first compared date through the last",
    );
    expect(metric(view, "Return between compared dates")).toContain(
      "Unavailable",
    );
    expect(content).not.toContain("or a percentage return");
  });

  it.each([
    ["10.00", "132.00", "12.00"],
    ["-50.00", "60.00", "-60.00"],
    ["0.00", "120.00", "0.00"],
  ])(
    "displays the exact supplied %s percent return with the compared dates",
    (percent, lastValueUsd, changeAfterExternalFlowsUsd) => {
      const base = history();
      result = history({
        points: base.points.map((entry) =>
          entry.date === "2026-09-04"
            ? {
                ...entry,
                totalValueUsd: lastValueUsd,
                netExternalFlowUsd: "0.00",
              }
            : entry,
        ),
        comparison: {
          ...base.comparison,
          lastValueUsd,
          netExternalFlowsUsd: "0.00",
          changeAfterExternalFlowsUsd,
          endpointReturn: { status: "available", percent },
        },
      });
      const view = render();
      expect(metric(view, "Return between compared dates")).toBe(`${percent}%`);
      expect(text(view)).toContain(
        "2026-09-02 to 2026-09-04: first and last complete values",
      );
      expect(metric(view, "First complete value · 2026-09-02")).toBe(
        "120.00 USD",
      );
      expect(metric(view, "Last complete value · 2026-09-04")).toBe(
        `${lastValueUsd} USD`,
      );
      expect(text(view)).toContain(
        "change in displayed endpoint values divided by the positive starting value",
      );
      expect(text(view)).toContain(
        "not annualized, time-weighted or money-weighted",
      );
    },
  );

  it.each([
    [
      "insufficient_complete_dates",
      "At least two complete dated values are required.",
    ],
    [
      "external_flows",
      "Deposits or withdrawals occurred between the compared endpoints",
    ],
    [
      "non_positive_starting_value",
      "The displayed starting value must be greater than zero.",
    ],
  ] as const)(
    "explains why the percentage is unavailable for %s",
    (reason, explanation) => {
      result = history({
        comparison: {
          ...(reason === "insufficient_complete_dates"
            ? noComparison()
            : history().comparison),
          ...(reason === "non_positive_starting_value"
            ? { firstValueUsd: "0.00", netExternalFlowsUsd: "0.00" }
            : {}),
          endpointReturn: { status: "unavailable", reason },
        },
      });
      const value = metric(render(), "Return between compared dates");
      expect(value).toContain("Unavailable");
      expect(value).toContain(explanation);
      expect(value).not.toContain("%");
    },
  );

  it("retains the dollar bridge when offsetting external flows block percentage return", () => {
    result = history({
      comparison: {
        ...history().comparison,
        netExternalFlowsUsd: "0.00",
        changeAfterExternalFlowsUsd: "40.00",
        endpointReturn: { status: "unavailable", reason: "external_flows" },
      },
    });
    const view = render();
    expect(metric(view, "Recorded net external flows")).toBe("0.00 USD");
    expect(metric(view, "Change after external cash flows")).toBe("40.00 USD");
    expect(metric(view, "Return between compared dates")).toContain(
      "including any that offset each other",
    );
    expect(text(view)).toContain(
      "after the first date through the last, even if they net to zero",
    );
  });

  it("plots only complete dots with separate unavailable markers and an equivalent accessible table", () => {
    const view = render();
    const dots = elements(view, "circle");
    expect(dots.map((dot) => dot.props["data-date"])).toEqual([
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
    ]);
    expect(text(dots[0])).toBe("2026-09-02: 120.00 USD");
    expect(elements(view, "polyline")).toHaveLength(0);
    const paths = elements(view, "path");
    expect(paths).toHaveLength(1);
    expect(paths[0]?.props.className).toBe("portfolio-valuation-gap");
    expect(String(paths[0]?.props.d).match(/M/g)).toHaveLength(2);
    expect(elements(view, "svg")[0]?.props["aria-label"]).toContain(
      "3 complete values shown as separate dots; 2 unavailable dates",
    );
    expect(
      elements(view, "div").find(
        (entry) => entry.props["aria-label"] === "Portfolio value chart",
      )?.props,
    ).toMatchObject({ tabIndex: 0, role: "region" });
    expect(text(elements(view, "figcaption")[0])).toContain(
      "Scroll the chart horizontally on narrow screens",
    );
    expect(
      elements(view, "div").find(
        (entry) => entry.props["aria-label"] === "Exact dated portfolio values",
      )?.props,
    ).toMatchObject({
      tabIndex: 0,
      "aria-label": "Exact dated portfolio values",
    });
    expect(elements(view, "caption").map(text)).toEqual([
      "Exact dated values · newest first · USD",
    ]);
    expect(tableDates(view)).toEqual([
      "2026-09-05",
      "2026-09-04",
      "2026-09-03",
      "2026-09-02",
      "2026-09-01",
    ]);
  });

  it("keeps partial holdings, unknown cash and split-review reasons distinct from complete totals", () => {
    result = history({
      points: [
        point("2026-09-01", {
          totalValueUsd: null,
          holdingsValueUsd: null,
          cashUsd: null,
          activeHoldings: 3,
          pricedHoldings: 1,
          pricedHoldingsValueUsd: "75.25",
          missingPriceListingIds: ["listing-missing"],
          splitReviewListingIds: ["listing-split"],
        }),
      ],
      coverage: {
        totalDates: 1,
        completeDates: 0,
        missingPriceDates: 1,
        unknownCashDates: 1,
        splitReviewDates: 1,
      },
      comparison: noComparison(),
    });
    const content = text(render());
    expect(content).toContain(
      "Unavailable: 1 missing exact-date price; unknown opening cash; 1 listing needs split review",
    );
    expect(content).toContain("Priced subtotal 75.25 USD (1 of 3 holdings)");
    expect(content).toContain("Unknown");
    expect(content).toContain("Reasons can overlap");
    expect(elements(render(), "circle")).toHaveLength(0);
  });

  it("describes unresolved closed listings without claiming an active holding", () => {
    result = history({
      points: [
        point("2026-09-02", {
          totalValueUsd: null,
          holdingsValueUsd: null,
          activeHoldings: 0,
          pricedHoldings: 0,
          pricedHoldingsValueUsd: "0.00",
          splitReviewListingIds: ["listing-closed"],
        }),
      ],
    });
    const content = text(elements(render(), "tbody")[0]);
    expect(content).toContain("1 listing needs split review");
    expect(content).not.toContain("holdings need split review");
  });

  it("does not manufacture a comparison from a single complete point", () => {
    result = history({
      points: [point("2026-09-02")],
      comparison: noComparison(),
      coverage: {
        totalDates: 1,
        completeDates: 1,
        missingPriceDates: 0,
        unknownCashDates: 0,
        splitReviewDates: 0,
      },
    });
    const view = render();
    expect(text(view)).toContain(
      "At least two complete dated values are needed",
    );
    expect(metric(view, "First complete value")).toBe("Unavailable");
    expect(metric(view, "Change after external cash flows")).toBe(
      "Unavailable",
    );
    expect(elements(view, "circle")).toHaveLength(1);
  });

  it("preserves negative external flows and USD change without recalculating them", () => {
    result = history({
      comparison: {
        ...history().comparison,
        netExternalFlowsUsd: "-99.99",
        changeAfterExternalFlowsUsd: "-0.01",
      },
    });
    expect(metric(render(), "Recorded net external flows")).toBe("-99.99 USD");
    expect(metric(render(), "Change after external cash flows")).toBe(
      "-0.01 USD",
    );
  });

  it("plots known zero values and cash-only dates as complete", () => {
    result = history({
      points: [
        point("2026-09-02", {
          totalValueUsd: "0.00",
          holdingsValueUsd: "0.00",
          pricedHoldingsValueUsd: "0.00",
          cashUsd: "0.00",
          activeHoldings: 0,
          pricedHoldings: 0,
        }),
      ],
      coverage: {
        totalDates: 1,
        completeDates: 1,
        missingPriceDates: 0,
        unknownCashDates: 0,
        splitReviewDates: 0,
      },
    });
    const view = render();
    expect(elements(view, "circle")[0]?.props.cy).toBe(210);
    expect(elements(view, "path")).toHaveLength(0);
    expect(text(elements(view, "tbody")[0])).toContain("Complete");
    expect(text(elements(view, "tbody")[0])).toContain("0.00 USD");
  });

  it("keeps large exact money in the table while plotting finite coordinates", () => {
    const amount = `${"9".repeat(79)}.99`;
    result = history({
      points: [point("2026-09-02", { totalValueUsd: amount })],
    });
    const view = render();
    expect(text(elements(view, "tbody")[0])).toContain(`${amount} USD`);
    expect(elements(view, "circle")[0]?.props.cy).toBe(35);
    expect(text(view)).not.toContain("Infinity");
    expect(text(view)).not.toContain("NaN");
  });

  it("fails the chart safely for a non-finite display conversion without losing the exact table value", () => {
    const amount = `${"9".repeat(400)}.00`;
    result = history({
      points: [point("2026-09-02", { totalValueUsd: amount })],
      coverage: {
        totalDates: 1,
        completeDates: 1,
        missingPriceDates: 0,
        unknownCashDates: 0,
        splitReviewDates: 0,
      },
    });
    const view = render();
    expect(elements(view, "circle")).toHaveLength(0);
    expect(text(view)).toContain("Some values cannot be drawn at this scale");
    expect(text(elements(view, "tbody")[0])).toContain(`${amount} USD`);
  });

  it("paginates 25 newest dates locally and resets when a different result arrives", () => {
    const points = Array.from({ length: 51 }, (_, index) =>
      point(new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10)),
    );
    result = history({ points });
    expect(tableDates(render())).toHaveLength(25);
    expect(tableDates(render())[0]).toBe("2026-02-20");
    expect(button(render(), "Newer dates").props.disabled).toBe(true);
    click("Older dates");
    expect(text(render())).toContain("Page 2 of 3");
    expect(tableDates(render())[0]).toBe("2026-01-26");
    click("Older dates");
    expect(tableDates(render())).toEqual(["2026-01-01"]);
    expect(button(render(), "Older dates").props.disabled).toBe(true);
    click("Newer dates");
    expect(text(render())).toContain("Page 2 of 3");
    result = history({ points: points.slice(0, 26) });
    expect(text(render())).toContain("Page 1 of 2");
    expect(tableDates(render())[0]).toBe("2026-01-26");
  });

  it("shows an invalid or empty result without retaining prior private values", () => {
    expect(text(render())).toContain("160.00 USD");
    result = { status: "invalid", reason: "invalid_ledger" };
    expect(text(render())).toContain("Valuation history is unavailable");
    expect(text(render())).not.toContain("160.00 USD");
    expect(elements(render(), "svg")).toHaveLength(0);
    result = history({
      points: [],
      comparison: noComparison(),
      coverage: {
        totalDates: 0,
        completeDates: 0,
        missingPriceDates: 0,
        unknownCashDates: 0,
        splitReviewDates: 0,
      },
    });
    expect(text(render())).toContain("No dated values are available");
    expect(elements(render(), "table")).toHaveLength(0);
  });

  it("does not fetch, persist, mutate or freeze result props", () => {
    const fetch = vi.fn();
    const setItem = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("localStorage", { setItem });
    const before = JSON.stringify(result);
    const view = render();
    expect(fetch).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toBe(before);
    expect(Object.isFrozen(result)).toBe(false);
    expect(text(view)).toContain(
      "Dividend observations never create cash receipts",
    );
    expect(text(view)).toContain("not saved or exported");
    expect(elements(view, "button")).toHaveLength(0);
  });
});

function point(
  date: string,
  overrides: Partial<PersonalPortfolioValuationHistoryPoint> = {},
): PersonalPortfolioValuationHistoryPoint {
  return {
    date,
    cashUsd: "20.00",
    pricedHoldingsValueUsd: "100.00",
    holdingsValueUsd: "100.00",
    totalValueUsd: "120.00",
    activeHoldings: 1,
    pricedHoldings: 1,
    missingPriceListingIds: [],
    splitReviewListingIds: [],
    netExternalFlowUsd: "0.00",
    ...overrides,
  };
}
function noComparison(): Available["comparison"] {
  return {
    firstDate: null,
    lastDate: null,
    firstValueUsd: null,
    lastValueUsd: null,
    netExternalFlowsUsd: null,
    changeAfterExternalFlowsUsd: null,
    endpointReturn: {
      status: "unavailable",
      reason: "insufficient_complete_dates",
    },
  };
}
function history(overrides: Partial<Available> = {}): Available {
  const gap = {
    totalValueUsd: null,
    holdingsValueUsd: null,
    pricedHoldingsValueUsd: "0.00",
    pricedHoldings: 0,
    missingPriceListingIds: ["listing-one"],
  };
  return {
    status: "available",
    startDate: "2026-08-01",
    effectiveStartDate: "2026-09-01",
    endDate: "2026-09-05",
    points: [
      point("2026-09-01", gap),
      point("2026-09-02"),
      point("2026-09-03", { totalValueUsd: "130.00" }),
      point("2026-09-04", {
        totalValueUsd: "160.00",
        netExternalFlowUsd: "25.00",
      }),
      point("2026-09-05", gap),
    ],
    coverage: {
      totalDates: 5,
      completeDates: 3,
      missingPriceDates: 2,
      unknownCashDates: 0,
      splitReviewDates: 0,
    },
    comparison: {
      firstDate: "2026-09-02",
      lastDate: "2026-09-04",
      firstValueUsd: "120.00",
      lastValueUsd: "160.00",
      netExternalFlowsUsd: "25.00",
      changeAfterExternalFlowsUsd: "15.00",
      endpointReturn: { status: "unavailable", reason: "external_flows" },
    },
    ...overrides,
  };
}

function render() {
  PersonalPortfolioValuationHistory({ result });
  hooks.effects();
  return PersonalPortfolioValuationHistory({ result });
}
function nodes(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  if (typeof value.type === "function")
    return nodes((value.type as (props: unknown) => unknown)(value.props));
  return [value, ...nodes(value.props.children)];
}
function elements(value: unknown, type: string) {
  return nodes(value).filter((entry) => entry.type === type);
}
function text(value: unknown): string {
  if (value === null || value === undefined || typeof value === "boolean")
    return "";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(text).join("");
  if (!React.isValidElement<Record<string, unknown>>(value)) return "";
  if (typeof value.type === "function")
    return text((value.type as (props: unknown) => unknown)(value.props));
  return text(value.props.children);
}
function tableDates(value: unknown) {
  return elements(elements(value, "tbody")[0], "th").map(text);
}
function metric(value: unknown, label: string) {
  const card = elements(value, "div").find(
    (entry) =>
      elements(entry, "dt").length === 1 &&
      text(elements(entry, "dt")[0]) === label,
  );
  if (!card) throw new Error(`Metric missing: ${label}`);
  return text(elements(card, "dd")[0]);
}
function button(value: unknown, label: string) {
  const found = elements(value, "button").find(
    (entry) => text(entry) === label,
  );
  if (!found) throw new Error(`Button missing: ${label}`);
  return found;
}
function click(label: string) {
  (button(render(), label).props.onClick as () => void)();
}

const hooks = vi.hoisted(() => {
  let state: unknown;
  let previous: readonly unknown[] | undefined;
  let pending: (() => void) | undefined;
  return {
    reset() {
      state = undefined;
      previous = undefined;
      pending = undefined;
    },
    useState(initial: unknown) {
      if (state === undefined) state = initial;
      return [
        state,
        (next: unknown) => {
          state = next;
        },
      ];
    },
    useEffect(effect: () => void, dependencies: readonly unknown[]) {
      if (
        !previous ||
        dependencies.some((value, index) => value !== previous?.[index])
      ) {
        pending = effect;
        previous = dependencies;
      }
    },
    effects() {
      const effect = pending;
      pending = undefined;
      effect?.();
    },
  };
});
