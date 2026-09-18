import type { PersonalSecurityMasterScreenRowDto } from "@research-cockpit/contracts";
import {
  calculatePersonalPricePerformanceComparison,
  type PersonalPricePerformanceComparisonAvailableResult,
  type PersonalPricePerformanceComparisonSeries,
} from "@research-cockpit/personal-market-analytics";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => {
  const states: unknown[] = [];
  const memos: Array<{ deps: readonly unknown[]; value: unknown }> = [];
  const effects: Array<{ deps: readonly unknown[]; cleanup?: () => void }> = [];
  const chartElement = {};
  let stateIndex = 0,
    memoIndex = 0,
    effectIndex = 0;
  let pending: Array<() => void> = [];
  const same = (a: readonly unknown[], b: readonly unknown[]) =>
    a.length === b.length &&
    a.every((value, index) => Object.is(value, b[index]));
  return {
    states,
    chartElement,
    begin() {
      stateIndex = 0;
      memoIndex = 0;
      effectIndex = 0;
    },
    effects() {
      const next = pending;
      pending = [];
      next.forEach((run) => run());
    },
    unmount() {
      effects.forEach((entry) => entry.cleanup?.());
      effects.length = 0;
    },
    reset() {
      states.length = 0;
      memos.length = 0;
      effects.length = 0;
      pending = [];
    },
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (next: unknown) => {
          states[index] = next;
        },
      ];
    },
    useMemo(factory: () => unknown, deps: readonly unknown[]) {
      const index = memoIndex++,
        previous = memos[index];
      if (!previous || !same(previous.deps, deps))
        memos[index] = { deps, value: factory() };
      return memos[index]?.value;
    },
    useEffect(run: () => (() => void) | void, deps: readonly unknown[]) {
      const index = effectIndex++,
        previous = effects[index];
      if (previous && same(previous.deps, deps)) return;
      effects[index] = { deps };
      pending.push(() => {
        previous?.cleanup?.();
        const cleanup = run();
        if (cleanup) effects[index]!.cleanup = cleanup;
      });
    },
  };
});
const chart = vi.hoisted(() => ({
  init: vi.fn(),
  setOption: vi.fn<(option: unknown) => void>(),
  resize: vi.fn(),
  dispose: vi.fn(),
  dispatchAction: vi.fn(),
  observe: vi.fn(),
  disconnect: vi.fn(),
  motionAdd: vi.fn(),
  motionRemove: vi.fn(),
  windowAdd: vi.fn(),
  windowRemove: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => hooks.useState(initial),
  useRef: () => ({ current: hooks.chartElement }),
  useMemo: (factory: () => unknown, deps: readonly unknown[]) =>
    hooks.useMemo(factory, deps),
  useEffect: (run: () => (() => void) | void, deps: readonly unknown[]) =>
    hooks.useEffect(run, deps),
}));
vi.mock("echarts", () => ({ init: chart.init }));

import { PersonalComparisonPerformance } from "./PersonalComparisonPerformance";
import {
  PersonalComparisonPriceChart,
  type PersonalComparisonPriceChartProps,
} from "./PersonalComparisonPriceChart";

let props: PersonalComparisonPriceChartProps;
let resizeCallback: () => void;
beforeEach(() => {
  hooks.reset();
  chart.init.mockReturnValue(chart);
  vi.stubGlobal("window", {
    matchMedia: () => ({
      matches: true,
      addEventListener: chart.motionAdd,
      removeEventListener: chart.motionRemove,
    }),
    addEventListener: chart.windowAdd,
    removeEventListener: chart.windowRemove,
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = chart.disconnect;
      observe = chart.observe;
      constructor(callback: () => void) {
        resizeCallback = callback;
      }
    },
  );
  props = {
    result: comparison([
      ["100", "80", "110"],
      ["200", "160", "220"],
    ]),
    listings: [],
  };
});
afterEach(() => {
  hooks.unmount();
  for (const mock of Object.values(chart)) mock.mockReset();
  vi.unstubAllGlobals();
});

describe("PersonalComparisonPriceChart", () => {
  it("starts collapsed and describes each line without color-only identity", () => {
    props = {
      result: comparison([
        ["100", "80"],
        ["200", "160"],
        ["50", "45"],
      ]),
      listings: [
        listing("listing-0", "AAA"),
        listing("listing-1", "BBB"),
        listing("listing-2", "CCC"),
      ],
    };
    const tree = render();
    expect(text(tree)).toContain(
      "Indexed adjusted close (first shared date = 100)",
    );
    expect(text(tree)).toContain("AAA · XNAS · solid line, circle markers");
    expect(text(tree)).toContain("BBB · XNAS · dashed line, diamond markers");
    expect(text(tree)).toContain("CCC · XNAS · dotted line, triangle markers");
    expect(elements(tree, "details")[0]?.props.open).toBe(false);
    expect(elements(tree, "table")).toHaveLength(0);
    expect(
      elements(tree, "div").find((item) => item.props.role === "img")?.props[
        "aria-label"
      ],
    ).toContain("2 shared observations");
    expect(text(tree)).toContain("Straight lines only guide the eye");
    expect(text(tree)).toContain("calendar gaps are not represented");
    expect(text(tree)).toContain(
      "not a USD price, invested wealth, benchmark or total return",
    );
  });

  it("paginates every exact date and decimal without silently truncating data", () => {
    props = {
      ...props,
      result: comparison([
        Array.from({ length: 64 }, (_, index) => `${100 + index}.123456789`),
        Array.from({ length: 64 }, (_, index) => String(200 + index)),
      ]),
    };
    openTable(render());
    let tree = render();
    expect(text(tree)).toContain("Observations 1–25 of 64 · Page 1 of 3");
    expect(elements(tree, "tbody")[0]?.props.children).toHaveLength(25);
    expect(text(tree)).toContain("100.123456789");
    expect(text(tree)).toContain("100.0000");
    expect(button(tree, "Previous dates").props.disabled).toBe(true);
    click(tree, "Next dates");
    tree = render();
    expect(text(tree)).toContain("Observations 26–50 of 64 · Page 2 of 3");
    expect(text(tree)).toContain("125.123456789");
    expect(text(tree)).not.toContain("100.123456789");
    click(tree, "Next dates");
    tree = render();
    expect(text(tree)).toContain("Observations 51–64 of 64 · Page 3 of 3");
    expect(elements(tree, "tbody")[0]?.props.children).toHaveLength(14);
    expect(text(tree)).toContain("163.123456789");
    expect(button(tree, "Next dates").props.disabled).toBe(true);
    click(tree, "Previous dates");
    expect(text(render())).toContain("Observations 26–50 of 64");
  });

  it("retains inspection on equivalent labels but clears it when the loaded result changes", () => {
    props = {
      ...props,
      result: comparison([Array(30).fill("100"), Array(30).fill("200")]),
    };
    openTable(render());
    click(render(), "Next dates");
    props = { ...props, listings: [...props.listings] };
    expect(text(render())).toContain("Observations 26–30 of 30");
    expect(chart.init).toHaveBeenCalledOnce();
    expect(chart.dispose).not.toHaveBeenCalled();
    props = {
      ...props,
      result: comparison([
        ["100", "90"],
        ["200", "180"],
      ]),
    };
    const tree = render();
    expect(elements(tree, "details")[0]?.props.open).toBe(false);
    expect(hooks.states).toEqual([
      { result: props.result, open: false, page: 0, failed: false },
    ]);
    expect(elements(tree, "table")).toHaveLength(0);
    expect(chart.dispose).toHaveBeenCalledOnce();
    expect(chart.dispatchAction).toHaveBeenCalledWith({ type: "hideTip" });
    openTable(tree);
    expect(text(render())).toContain("Observations 1–2 of 2 · Page 1 of 1");
  });

  it("uses shared dates and proportional indices with straight unsmoothed series and no hide or zoom controls", () => {
    const inputs = histories([
      ["100", "1", "110"],
      ["200", "2", "220"],
    ]);
    const second = inputs[1]!;
    inputs[1] = {
      ...second,
      bars: second.bars.filter((_, index) => index !== 1),
    };
    props = { ...props, result: available(inputs) };
    render();
    const option = chartOption();
    expect(option.xAxis.data).toEqual(["2026-01-01", "2026-01-03"]);
    expect(option.xAxis.type).toBe("category");
    expect(option.series.map((series) => series.data)).toEqual([
      [100, 110],
      [100, 110],
    ]);
    expect(
      option.series.map((series) => ({
        smooth: series.smooth,
        connectNulls: series.connectNulls,
        symbol: series.symbol,
        line: series.lineStyle.type,
      })),
    ).toEqual([
      { smooth: false, connectNulls: false, symbol: "circle", line: "solid" },
      { smooth: false, connectNulls: false, symbol: "diamond", line: "dashed" },
    ]);
    expect(option.legend).toBeUndefined();
    expect(option.dataZoom).toBeUndefined();
    expect(option.yAxis.name).toBe(
      "Indexed adjusted close\n(first shared date = 100)",
    );
  });

  it("tooltips return only observed exact strings as text, with no interpolated point", () => {
    props = { ...props, listings: [listing("listing-0", "<AAA>")] };
    render();
    const tooltip = chartOption().tooltip;
    expect(tooltip.renderMode).toBe("richText");
    expect(tooltip.axisPointer).toEqual({ type: "line", snap: true });
    expect(tooltip.formatter([{ dataIndex: 1 }])).toBe(
      "2026-01-02\n<AAA> · XNAS\nIndex: 80.0000\nAdjusted USD: 80\nlisting-1\nIndex: 80.0000\nAdjusted USD: 160",
    );
    expect(tooltip.formatter([{ dataIndex: 0.5 }])).toBe(
      "Observation unavailable",
    );
    expect(tooltip.formatter([{ dataIndex: 3 }])).toBe(
      "Observation unavailable",
    );
    expect(tooltip.formatter({ axisValue: "2026-01-02" })).toBe(
      "Observation unavailable",
    );
  });

  it("wraps long exact tooltip strings and directs oversized content to the complete table", () => {
    props = {
      ...props,
      result: comparison([
        ["100", "112"],
        ["80", "90"],
        ["50", "75"],
      ]),
    };
    render();
    const standard = chartOption().tooltip.formatter([{ dataIndex: 1 }]);
    expect(standard.split("\n")).toHaveLength(10);
    expect(standard).toContain("Adjusted USD: 75");
    const medium = "10000000000000000000000000000000000000000";
    props = {
      ...props,
      result: comparison([
        [medium, medium],
        [medium, medium],
      ]),
    };
    render();
    const mediumOption = chart.setOption.mock.calls.at(-1)?.[0] as ReturnType<
      typeof chartOption
    >;
    const tooltip = mediumOption.tooltip.formatter([{ dataIndex: 0 }]);
    expect(tooltip.split("\n").every((line) => line.length <= 22)).toBe(true);
    expect(tooltip.split("\n").length).toBeLessThanOrEqual(12);
    expect(tooltip.replaceAll("\n", "")).toContain(medium);
    const long = "1" + "0".repeat(63);
    props = {
      ...props,
      result: comparison([
        [long, long],
        [long, long],
        [long, long],
      ]),
    };
    const tree = render();
    const latest = chart.setOption.mock.calls.at(-1)?.[0] as ReturnType<
      typeof chartOption
    >;
    expect(latest.tooltip.formatter([{ dataIndex: 0 }])).toBe(
      "2026-01-01\nLong values: inspect the\nexact-data table below.",
    );
    openTable(tree);
    expect(text(render())).toContain(long);
  });

  it("resizes, responds to reduced motion and disposes listeners and tooltips", () => {
    render();
    expect(chartOption().animation).toBe(false);
    expect(chart.observe).toHaveBeenCalledWith(hooks.chartElement);
    resizeCallback();
    expect(chart.resize).toHaveBeenCalledOnce();
    const changeMotion = chart.motionAdd.mock.calls[0]?.[1] as (event: {
      matches: boolean;
    }) => void;
    changeMotion({ matches: false });
    expect(chart.setOption).toHaveBeenLastCalledWith({ animation: true });
    hooks.unmount();
    expect(chart.disconnect).toHaveBeenCalledOnce();
    expect(chart.motionRemove).toHaveBeenCalledWith("change", changeMotion);
    expect(chart.dispatchAction).toHaveBeenCalledWith({ type: "hideTip" });
    expect(chart.dispose).toHaveBeenCalledOnce();
    resizeCallback();
    changeMotion({ matches: true });
    expect(chart.resize).toHaveBeenCalledOnce();
    expect(chart.setOption).toHaveBeenCalledTimes(2);
  });

  it("falls back to window resize events when ResizeObserver is unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render();
    const listener = chart.windowAdd.mock.calls[0]?.[1] as () => void;
    expect(chart.windowAdd).toHaveBeenCalledWith("resize", listener);
    listener();
    expect(chart.resize).toHaveBeenCalledOnce();
    hooks.unmount();
    expect(chart.windowRemove).toHaveBeenCalledWith("resize", listener);
  });

  it.each([
    ["too large", "100000000000000", "10000000000000000.0000"],
    ["rounded to zero", "0.000000001", "0.0000"],
  ])(
    "keeps exact data when a valid index is %s for plotting",
    (_, close, index) => {
      props = {
        ...props,
        result: comparison([
          ["1", close],
          ["2", "2"],
        ]),
      };
      const tree = render();
      expect(text(tree)).toContain("Chart unavailable");
      expect(
        elements(tree, "div").some((item) => item.props.role === "img"),
      ).toBe(false);
      expect(chart.init).not.toHaveBeenCalled();
      openTable(tree);
      const exact = render();
      expect(text(exact)).toContain(close);
      expect(text(exact)).toContain(index);
      expect(elements(exact, "tbody")[0]?.props.children).toHaveLength(2);
    },
  );

  it.each(["9007199254740992", "9007199254740991.0001"])(
    "admits the exact numeric ceiling and refuses %s before Number rounding",
    (unsafe) => {
      props = {
        ...props,
        result: comparison([
          ["100", "9007199254740991"],
          ["2", "2"],
        ]),
      };
      render();
      expect(chartOption().series[0]?.data).toEqual([
        100,
        Number.MAX_SAFE_INTEGER,
      ]);
      props = {
        ...props,
        result: comparison([
          ["100", unsafe],
          ["2", "2"],
        ]),
      };
      expect(text(render())).toContain("Chart unavailable");
      expect(chart.init).toHaveBeenCalledOnce();
      expect(chart.dispose).toHaveBeenCalledOnce();
    },
  );

  it.each(["init", "setOption"] as const)(
    "keeps exact data after %s failure and releases it on a later load",
    (stage) => {
      chart[stage].mockImplementationOnce(() => {
        throw new Error("synthetic chart failure");
      });
      render();
      let tree = render();
      expect(text(tree)).toContain("Chart unavailable");
      expect(chart.dispose).toHaveBeenCalledTimes(stage === "init" ? 0 : 1);
      openTable(tree);
      expect(text(render())).toContain("80.0000");
      props = {
        ...props,
        result: comparison([
          ["100", "110"],
          ["200", "210"],
        ]),
      };
      tree = render();
      expect(text(tree)).not.toContain("Chart unavailable");
      expect(chart.init).toHaveBeenCalledTimes(2);
      expect(elements(tree, "table")).toHaveLength(0);
      expect(hooks.states).toEqual([
        { result: props.result, open: false, page: 0, failed: false },
      ]);
    },
  );

  it("has scoped exact-table headers and disambiguates identical symbol/MIC labels", () => {
    props = {
      ...props,
      listings: [listing("listing-0", "SAME"), listing("listing-1", "SAME")],
    };
    openTable(render());
    const tree = render();
    expect(text(tree)).toContain("SAME · XNAS (listing-0)");
    expect(text(tree)).toContain("SAME · XNAS (listing-1)");
    expect(
      elements(tree, "th").filter((element) => element.props.scope === "col"),
    ).toHaveLength(5);
    expect(
      elements(tree, "th").filter((element) => element.props.scope === "row"),
    ).toHaveLength(3);
    expect(elements(tree, "caption")).toHaveLength(1);
    expect(
      elements(tree, "div").find((item) => item.props.role === "region")?.props
        .tabIndex,
    ).toBe(0);
    expect(elements(tree, "time")[1]?.props.dateTime).toBe("2026-01-02");
  });

  it("memoizes the parent aggregate across display-only updates and clears it while loading", () => {
    const series = histories([
      ["100", "80"],
      ["200", "160"],
    ]);
    const parentProps = {
      series,
      listings: [] as readonly PersonalSecurityMasterScreenRowDto[],
      state: "ready" as const,
    };
    hooks.begin();
    const first = elements(
      PersonalComparisonPerformance(parentProps),
      PersonalComparisonPriceChart,
    )[0]?.props.result;
    hooks.begin();
    const second = elements(
      PersonalComparisonPerformance({ ...parentProps, listings: [] }),
      PersonalComparisonPriceChart,
    )[0]?.props.result;
    expect(first).toBeDefined();
    expect(second).toBe(first);
    hooks.begin();
    const loading = PersonalComparisonPerformance({
      ...parentProps,
      state: "loading",
    });
    expect(elements(loading, PersonalComparisonPriceChart)).toHaveLength(0);
    hooks.begin();
    const reloaded = elements(
      PersonalComparisonPerformance(parentProps),
      PersonalComparisonPriceChart,
    )[0]?.props.result;
    expect(reloaded).not.toBe(first);
  });
});

function chartOption() {
  return chart.setOption.mock.calls[0]?.[0] as {
    animation: boolean;
    xAxis: { type: string; data: string[] };
    yAxis: { name: string };
    series: Array<{
      data: number[];
      smooth: boolean;
      connectNulls: boolean;
      symbol: string;
      lineStyle: { type: string };
    }>;
    legend?: unknown;
    dataZoom?: unknown;
    tooltip: {
      renderMode: string;
      axisPointer: unknown;
      formatter: (params: unknown) => string;
    };
  };
}

function render() {
  hooks.begin();
  const tree = PersonalComparisonPriceChart(props);
  hooks.effects();
  return tree;
}
function openTable(tree: unknown) {
  (elements(tree, "details")[0]!.props.onToggle as (event: unknown) => void)({
    currentTarget: { open: true },
  });
}
function button(tree: unknown, label: string) {
  return elements(tree, "button").find((item) => text(item) === label)!;
}
function click(tree: unknown, label: string) {
  (button(tree, label).props.onClick as () => void)();
}
function comparison(closes: readonly (readonly string[])[]) {
  return available(histories(closes));
}
function available(
  series: readonly PersonalPricePerformanceComparisonSeries[],
): PersonalPricePerformanceComparisonAvailableResult {
  const result = calculatePersonalPricePerformanceComparison({ series });
  if (result.status !== "available") throw new TypeError();
  return result;
}
function histories(
  closes: readonly (readonly string[])[],
): PersonalPricePerformanceComparisonSeries[] {
  return closes.map((values, index) => ({
    listingId: `listing-${index}`,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    bars: values.map((close, offset) => ({
      date: new Date(Date.UTC(2026, 0, offset + 1)).toISOString().slice(0, 10),
      adjusted: { close },
      raw: { close: "1" },
    })),
  }));
}
function listing(
  listingId: string,
  symbol: string,
): PersonalSecurityMasterScreenRowDto {
  return {
    listingId,
    symbol,
    exchangeMic: "XNAS",
    country: "US",
    cik: "0000000001",
    instrumentType: "common_stock",
    issuerId: `issuer-${listingId}`,
    issuerName: `${symbol} Company`,
    securityId: `security-${listingId}`,
    securityName: symbol,
    shareClassId: `share-${listingId}`,
    shareClassName: "Common",
  };
}
function elements(
  value: unknown,
  type?: React.ElementType,
): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value))
    return value.flatMap((item) => elements(item, type));
  if (!React.isValidElement(value)) return [];
  const own =
    type === undefined || value.type === type
      ? [value as React.ReactElement<Record<string, unknown>>]
      : [];
  return [
    ...own,
    ...elements((value.props as { children?: unknown }).children, type),
  ];
}
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(text).join("");
  if (!React.isValidElement(value)) return "";
  return text((value.props as { children?: unknown }).children);
}
