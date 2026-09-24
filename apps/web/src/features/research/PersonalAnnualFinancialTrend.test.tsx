import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PersonalAnnualFinancialTrendField,
  PersonalAnnualFinancialTrendProjection,
  PersonalAnnualFinancialTrendSlot,
} from "./personal-annual-financial-trend-input";

const hooks = vi.hoisted(() => {
  const states: unknown[] = [];
  const effects: Array<{ deps: readonly unknown[]; cleanup?: () => void }> = [];
  const chartElement = {};
  let stateIndex = 0;
  let effectIndex = 0;
  let pending: Array<() => void> = [];
  return {
    chartElement,
    begin() {
      stateIndex = 0;
      effectIndex = 0;
    },
    flush() {
      const current = pending;
      pending = [];
      current.forEach((run) => run());
    },
    unmount() {
      effects.forEach((entry) => entry.cleanup?.());
      effects.length = 0;
    },
    reset() {
      states.length = 0;
      effects.length = 0;
      pending = [];
    },
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (value: unknown) => {
          states[index] = value;
        },
      ];
    },
    useEffect(run: () => (() => void) | void, deps: readonly unknown[]) {
      const index = effectIndex++;
      const previous = effects[index];
      if (
        previous &&
        previous.deps.length === deps.length &&
        previous.deps.every((value, offset) => Object.is(value, deps[offset]))
      )
        return;
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
  useEffect: (run: () => (() => void) | void, deps: readonly unknown[]) =>
    hooks.useEffect(run, deps),
}));
vi.mock("echarts", () => ({ init: chart.init }));

import { PersonalAnnualFinancialTrend } from "./PersonalAnnualFinancialTrend";

type Ready = Extract<
  PersonalAnnualFinancialTrendProjection,
  { status: "ready" }
>;
type Option = {
  animation: boolean;
  tooltip: {
    renderMode: string;
    confine: boolean;
    formatter: (params: unknown) => string;
  };
  xAxis: { data: string[] };
  yAxis: {
    scale: boolean;
    axisLabel: { formatter: (value: number) => string };
  };
  series: Array<{
    type: string;
    data: Array<number | null>;
    markLine: { data: Array<{ yAxis: number }> };
  }>;
};
let projection: Ready;
let resizeCallback: () => void;
const fetchSpy = vi.fn();
const storageSpy = vi.fn();

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
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("localStorage", { getItem: storageSpy, setItem: storageSpy });
  projection = example();
});
afterEach(() => {
  hooks.unmount();
  for (const mock of Object.values(chart)) mock.mockReset();
  fetchSpy.mockReset();
  storageSpy.mockReset();
  vi.unstubAllGlobals();
});

describe("PersonalAnnualFinancialTrend", () => {
  it("presents four labeled native choices and ten oldest-first exact rows", () => {
    const tree = render();
    expect(text(tree)).toContain("Annual business trends");
    expect(text(elements(tree, "label")[0])).toContain("Annual trend metric");
    expect(elements(tree, "option").map(text)).toEqual([
      "Revenue",
      "Net income",
      "Operating cash flow",
      "Provider-reported free cash flow",
    ]);
    expect(select(tree).props.value).toBe("revenue");
    expect(text(elements(tree, "caption")[0])).toBe(
      "Annual business trend values · USD · oldest to newest",
    );
    const rows = elements(elements(tree, "tbody")[0], "tr");
    expect(rows).toHaveLength(10);
    expect(rows.map((row) => text(elements(row, "th")[0]))).toEqual(
      Array.from({ length: 10 }, (_, i) => String(2017 + i)),
    );
    expect(
      elements(tree, "thead")
        .flatMap((head) => elements(head, "th"))
        .every((cell) => cell.props.scope === "col"),
    ).toBe(true);
    expect(
      rows.every((row) => elements(row, "th")[0]?.props.scope === "row"),
    ).toBe(true);
  });

  it("distinguishes absent years, unknown cells, signed values and genuine zero without rounding", () => {
    const rows = elements(elements(render(), "tbody")[0], "tr");
    expect(elements(rows[0], "td").map(text)).toEqual([
      "Missing year",
      "Missing year",
      "Missing year",
      "Missing year",
      "Missing year",
    ]);
    expect(elements(rows[1], "td").map(text)).toEqual([
      "2019-02-15",
      "Unknown",
      "0",
      "125.123456789",
      "-50.123456789",
    ]);
    expect(text(rows[2])).toContain("-100.123456789");
    expect(text(rows[3])).toContain("0");
    expect(elements(rows[1], "time")[0]?.props.dateTime).toBe("2019-02-15");
  });

  it("uses signed bars, null gaps, ten categorical years and an explicit zero baseline", () => {
    render();
    const option = chartOption();
    expect(option.series[0]?.type).toBe("bar");
    expect(option.series[0]?.data).toEqual([
      null,
      null,
      -100.123456789,
      0,
      100,
      100,
      100,
      100,
      100,
      100,
    ]);
    expect(option.xAxis.data).toEqual(
      Array.from({ length: 10 }, (_, i) => String(2017 + i)),
    );
    expect(option.yAxis.scale).toBe(false);
    expect(option.series[0]?.markLine.data).toEqual([{ yAxis: 0 }]);
    expect(option).not.toHaveProperty("dataZoom");
    expect(option).not.toHaveProperty("legend");
  });

  it("changes the metric through the same unkeyed selector while preserving the native disclosure key", () => {
    const first = render();
    choose(first, "net_income");
    const second = render();
    expect(select(first).key).toBeNull();
    expect(select(second).key).toBeNull();
    expect(select(second).props.value).toBe("net_income");
    expect(elements(first, "details")[0]?.key).toBe(
      elements(second, "details")[0]?.key,
    );
    expect(chartOption().series[0]?.data).toEqual([
      null,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
    expect(chart.dispose).toHaveBeenCalledTimes(1);
    expect(chart.init).toHaveBeenCalledTimes(2);
  });

  it("keeps tiny signed axis ticks distinguishable from a genuine zero", () => {
    render();
    const format = chartOption().yAxis.axisLabel.formatter;
    expect(format(0)).toBe("0");
    expect(format(0.000001)).toBe("1E-6");
    expect(format(-0.000001)).toBe("-1E-6");
    expect(format(1000000000)).toBe("1B");
  });

  it("ignores a value that is not one of the four native choices", () => {
    const tree = render();
    choose(tree, "unknown_metric");
    expect(select(render()).props.value).toBe("revenue");
    expect(chart.init).toHaveBeenCalledTimes(1);
  });

  it("preserves canvas and native open-state identity for equal content in new objects", () => {
    const first = render();
    projection = structuredClone(projection);
    const second = render();
    expect(chart.init).toHaveBeenCalledTimes(1);
    expect(chart.dispose).not.toHaveBeenCalled();
    expect(elements(first, "details")[0]?.key).toBe(
      elements(second, "details")[0]?.key,
    );
    expect(elements(second, "details")[0]?.props).not.toHaveProperty("open");
    expect(elements(second, "details")[0]?.props).not.toHaveProperty(
      "onToggle",
    );
  });

  it("retires the old canvas and disclosure when consumed source changes, keeping the chosen metric", () => {
    choose(render(), "free_cash_flow");
    const first = render();
    const callsBefore = chart.dispose.mock.calls.length;
    projection = {
      ...projection,
      contentKey: "changed-source",
      asOf: "2026-09-20T00:00:00Z",
    };
    const second = render();
    expect(chart.dispose).toHaveBeenCalledTimes(callsBefore + 1);
    expect(select(second).props.value).toBe("free_cash_flow");
    expect(elements(first, "details")[0]?.key).not.toBe(
      elements(second, "details")[0]?.key,
    );
    expect(text(second)).toContain("2026-09-20T00:00:00Z");
  });

  it("keeps exact table and selector usable for an unsafe selected metric and recovers another metric", () => {
    projection = {
      ...projection,
      plots: {
        ...projection.plots,
        revenue: { status: "unavailable", reason: "unsafe_plot_value" },
      },
    };
    const first = render();
    expect(text(first)).toContain(
      "one or more values cannot be safely plotted",
    );
    expect(elements(first, "table")).toHaveLength(1);
    expect(chart.init).not.toHaveBeenCalled();
    choose(first, "operating_cash_flow");
    expect(text(render())).not.toContain("Chart unavailable:");
    expect(chart.init).toHaveBeenCalledTimes(1);
  });

  it("explains all-unknown plots without hiding their exact reasons", () => {
    projection = {
      ...projection,
      plots: {
        ...projection.plots,
        revenue: { status: "unavailable", reason: "no_known_values" },
      },
    };
    const tree = render();
    expect(text(tree)).toContain("no known values for this metric");
    expect(text(tree)).toContain("Unknown");
    expect(chart.init).not.toHaveBeenCalled();
  });

  it("still initializes a known all-zero plot and states why its bars have no height", () => {
    choose(render(), "net_income");
    const tree = render();
    expect(
      chartOption().series[0]?.data.filter((value) => value !== null),
    ).toEqual(Array(9).fill(0));
    expect(text(tree)).toContain("A known zero has a zero-height bar");
    expect(text(tree)).not.toContain("Chart unavailable:");
  });

  it("uses rich-text exact tooltips with own dates and rejects nonexistent coordinates", () => {
    render();
    const tooltip = chartOption().tooltip;
    expect(tooltip.renderMode).toBe("richText");
    expect(tooltip.confine).toBe(true);
    expect(tooltip.formatter([{ dataIndex: 2 }])).toContain(
      "USD: -100.123456789",
    );
    expect(
      tooltip.formatter([{ dataIndex: 2 }]).replaceAll("\n", ""),
    ).toContain("Statement/release: 2020-02-15");
    expect(tooltip.formatter([{ dataIndex: 0 }])).toContain("Missing year");
    expect(
      tooltip.formatter([{ dataIndex: 1 }]).replaceAll("\n", ""),
    ).toContain("Unknown");
    for (const invalid of [
      null,
      {},
      { dataIndex: -1 },
      { dataIndex: 10 },
      { dataIndex: 1.5 },
      { dataIndex: "1" },
    ])
      expect(tooltip.formatter(invalid)).toBe("Fiscal year unavailable");
  });

  it("retains long exact decimals in the table while constraining tooltip line width", () => {
    const slots = [...projection.slots];
    const original = slots[2]!;
    if (original.status !== "reported") throw new TypeError();
    const precise = "0." + "1".repeat(62);
    slots[2] = {
      ...original,
      cells: {
        ...original.cells,
        revenue: { status: "known", value: precise },
      },
    };
    projection = { ...projection, slots, contentKey: "long-decimal" };
    const tree = render();
    expect(text(tree)).toContain(precise);
    expect(
      chartOption()
        .tooltip.formatter([{ dataIndex: 2 }])
        .split("\n")
        .every((line) => line.length <= 22),
    ).toBe(true);
    const region = elements(tree, "div").find(
      (item) => item.props.role === "region",
    );
    expect(region?.props.tabIndex).toBe(0);
    expect(region?.props["aria-label"]).toBe(
      "Exact annual business trend values",
    );
  });

  it("falls back after chart initialization failure and retries only a different metric or source", () => {
    chart.init.mockImplementationOnce(() => {
      throw new Error("canvas unavailable");
    });
    render();
    const tree = render();
    expect(text(tree)).toContain("chart could not be displayed");
    expect(elements(tree, "table")).toHaveLength(1);
    render();
    expect(chart.init).toHaveBeenCalledTimes(1);
    choose(tree, "net_income");
    expect(text(render())).not.toContain("Chart unavailable:");
    expect(chart.init).toHaveBeenCalledTimes(2);
  });

  it("disposes a partially initialized chart on option failure and recovers replacement content", () => {
    chart.setOption.mockImplementationOnce(() => {
      throw new Error("render failed");
    });
    render();
    expect(chart.dispose).toHaveBeenCalledTimes(1);
    expect(text(render())).toContain("chart could not be displayed");
    projection = { ...projection, contentKey: "replacement" };
    expect(text(render())).not.toContain("Chart unavailable:");
    expect(chart.init).toHaveBeenCalledTimes(2);
  });

  it("honors reduced motion, observes size, and makes stale listeners inert after cleanup", () => {
    render();
    expect(chartOption().animation).toBe(false);
    expect(chart.observe).toHaveBeenCalledWith(hooks.chartElement);
    resizeCallback();
    expect(chart.resize).toHaveBeenCalledTimes(1);
    const motion = chart.motionAdd.mock.calls[0]?.[1] as (event: {
      matches: boolean;
    }) => void;
    motion({ matches: false });
    expect(chart.setOption).toHaveBeenLastCalledWith({ animation: true });
    const count = chart.setOption.mock.calls.length;
    hooks.unmount();
    resizeCallback();
    motion({ matches: true });
    expect(chart.resize).toHaveBeenCalledTimes(1);
    expect(chart.setOption).toHaveBeenCalledTimes(count);
    expect(chart.disconnect).toHaveBeenCalledTimes(1);
    expect(chart.motionRemove).toHaveBeenCalledWith("change", motion);
    expect(chart.dispatchAction).toHaveBeenCalledWith({ type: "hideTip" });
    expect(chart.dispose).toHaveBeenCalledTimes(1);
  });

  it("uses and removes the window resize fallback when ResizeObserver is absent", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render();
    const resize = chart.windowAdd.mock.calls[0]?.[1] as () => void;
    expect(chart.windowAdd).toHaveBeenCalledWith("resize", resize);
    resize();
    hooks.unmount();
    expect(chart.windowRemove).toHaveBeenCalledWith("resize", resize);
    expect(chart.resize).toHaveBeenCalledTimes(1);
  });

  it("releases the remaining resources when a tooltip cleanup throws", () => {
    render();
    chart.dispatchAction.mockImplementation(() => {
      throw new Error("tooltip disposed");
    });
    expect(() => hooks.unmount()).not.toThrow();
    expect(chart.dispose).toHaveBeenCalledTimes(1);
    expect(chart.motionRemove).toHaveBeenCalledTimes(1);
  });

  it("keeps fallback usable when option setup and both chart releases fail", () => {
    chart.setOption.mockImplementationOnce(() => {
      throw new Error("option failure");
    });
    chart.dispatchAction.mockImplementation(() => {
      throw new Error("tooltip failure");
    });
    chart.dispose.mockImplementation(() => {
      throw new Error("dispose failure");
    });
    expect(() => render()).not.toThrow();
    const tree = render();
    expect(text(tree)).toContain("chart could not be displayed");
    expect(elements(tree, "table")).toHaveLength(1);
    expect(chart.dispose).toHaveBeenCalledTimes(1);
    expect(chart.windowRemove).toHaveBeenCalledTimes(1);
    expect(chart.motionRemove).toHaveBeenCalledTimes(1);
  });

  it("performs no requests or persistence while rendering, switching metrics or inspecting exact data", () => {
    const tree = render();
    choose(tree, "free_cash_flow");
    const next = render();
    expect(elements(next, "details")[0]?.props).not.toHaveProperty("onToggle");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
    expect(text(next)).toContain(
      "provider-reported, not reconstructed cash flow",
    );
    expect(text(next)).toContain("not point-in-time history");
  });

  it("keeps compact source context outside closed disclosures and preserves every exact annual cell", () => {
    const full = render();
    const compact = render(true);
    const disclosures = elements(compact, "details");
    expect(disclosures.map((item) => text(elements(item, "summary")))).toEqual([
      "How to read this chart",
      "Inspect exact annual trend values",
    ]);
    for (const disclosure of disclosures) {
      expect(disclosure.props).not.toHaveProperty("open");
      expect(disclosure.props).not.toHaveProperty("onToggle");
    }
    const source = elements(compact, "p").find(
      (item) => item.props.className === "annual-trend-source",
    );
    expect(text(source)).toBe("USD · Provider most recent · Loaded 2026-09-19");
    expect(elements(source, "time")[0]?.props.dateTime).toBe(projection.asOf);
    expect(disclosures.some((item) => elements(item).includes(source!))).toBe(
      false,
    );
    expect(text(disclosures[0])).toContain("not point-in-time history");
    expect(text(disclosures[0])).toContain("not reconstructed cash flow");
    expect(elements(disclosures[1], "table")).toEqual(elements(full, "table"));
    expect(
      elements(disclosures[1], "tbody").flatMap((body) => elements(body, "tr")),
    ).toHaveLength(10);
    expect(chart.init).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("keeps the selected metric, chart and exact-data disclosure identity when compact mode changes", () => {
    choose(render(), "free_cash_flow");
    const full = render();
    const calls = chart.init.mock.calls.length;
    const compact = render(true);
    const restored = render();
    expect(select(compact).props.value).toBe("free_cash_flow");
    expect(select(restored).props.value).toBe("free_cash_flow");
    expect(elements(compact, "details")[1]?.key).toBe(
      elements(full, "details")[0]?.key,
    );
    expect(elements(restored, "details")[0]?.key).toBe(
      elements(full, "details")[0]?.key,
    );
    expect(chart.init).toHaveBeenCalledTimes(calls);
    expect(chartOption().series[0]?.data).toEqual([
      null,
      ...Array.from({ length: 9 }, () => -50.123456789),
    ]);
  });

  it("retires both compact disclosure identities on source replacement without resetting the metric", () => {
    choose(render(true), "net_income");
    const first = render(true);
    const initializations = chart.init.mock.calls.length;
    projection = {
      ...projection,
      contentKey: "compact-new-source",
      asOf: "2026-09-20T00:00:00Z",
    };
    const next = render(true);
    for (let index = 0; index < 2; index += 1) {
      expect(elements(next, "details")[index]?.key).not.toBe(
        elements(first, "details")[index]?.key,
      );
    }
    expect(select(next).props.value).toBe("net_income");
    expect(text(next)).toContain("Loaded 2026-09-20");
    expect(chart.init).toHaveBeenCalledTimes(initializations + 1);
  });

  it("keeps compact chart failures outside disclosures with the exact table and recovery selector intact", () => {
    chart.init.mockImplementationOnce(() => {
      throw new Error("canvas unavailable");
    });
    render(true);
    const failed = render(true);
    expect(text(failed)).toContain("chart could not be displayed");
    const disclosures = elements(failed, "details");
    expect(
      disclosures.every((item) => !text(item).includes("Chart unavailable:")),
    ).toBe(true);
    expect(elements(failed, "table")).toHaveLength(2);
    expect(
      elements(failed, "div").find((item) => item.props.role === "region")
        ?.props.tabIndex,
    ).toBe(0);
    choose(failed, "net_income");
    expect(text(render(true))).not.toContain("Chart unavailable:");
    expect(chart.init).toHaveBeenCalledTimes(2);
  });

  it("keeps missing years, unknown cells, zero and exact signed decimals in the compact three-year table", () => {
    const latest = projection.slots[9]!;
    if (latest.status !== "reported")
      throw new Error("Expected reported fixture");
    projection = {
      ...projection,
      contentKey: "recent-values",
      slots: [
        ...projection.slots.slice(0, 7),
        {
          status: "missing_year",
          fiscalYear: 2024,
          statementDate: null,
          cells: null,
        },
        {
          ...latest,
          fiscalYear: 2025,
          statementDate: "2026-02-15",
          cells: {
            ...latest.cells,
            revenue: {
              status: "unknown",
              value: null,
              reason: "not_supplied_by_provider",
            },
          },
        },
        {
          ...latest,
          cells: {
            ...latest.cells,
            revenue: { status: "known", value: "-123456789.123456789" },
          },
        },
      ],
    };
    const tree = render(true);
    const recent = elements(tree, "table").find(
      (item) => item.props.className === "annual-trend-recent-table",
    );
    const rows = elements(recent, "tbody").flatMap((body) =>
      elements(body, "tr"),
    );
    expect(
      elements(recent, "thead")
        .flatMap((head) => elements(head, "th"))
        .map(text),
    ).toEqual(["Metric", "2024", "2025", "2026"]);
    expect(rows.map((row) => elements(row, "td").map(text))).toEqual([
      ["Missing year", "Unknown", "-123456789.123456789"],
      ["Missing year", "0", "0"],
      ["Missing year", "125.123456789", "125.123456789"],
      ["Missing year", "2026-02-15", "2027-02-15"],
    ]);
    expect(
      elements(elements(tree, "details")[1], "tbody").flatMap((body) =>
        elements(body, "tr"),
      ),
    ).toHaveLength(10);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
  });
});

function render(compact = false) {
  hooks.begin();
  const tree = PersonalAnnualFinancialTrend({ projection, compact });
  hooks.flush();
  return tree;
}
function chartOption(): Option {
  return [...chart.setOption.mock.calls]
    .reverse()
    .find(
      ([option]) =>
        typeof option === "object" && option !== null && "series" in option,
    )?.[0] as Option;
}
function select(tree: unknown) {
  return elements(tree, "select")[0]!;
}
function choose(tree: unknown, value: string) {
  (select(tree).props.onChange as (event: unknown) => void)({
    currentTarget: { value },
  });
}
function example(): Ready {
  const known = (value: string) => ({ status: "known", value }) as const;
  const slots: PersonalAnnualFinancialTrendSlot[] = Array.from(
    { length: 10 },
    (_, index) =>
      index === 0
        ? {
            status: "missing_year",
            fiscalYear: 2017,
            statementDate: null,
            cells: null,
          }
        : {
            status: "reported",
            fiscalYear: 2017 + index,
            statementDate: `${2018 + index}-02-15`,
            cells: {
              revenue:
                index === 1
                  ? {
                      status: "unknown",
                      value: null,
                      reason: "not_supplied_by_provider",
                    }
                  : known(
                      index === 2
                        ? "-100.123456789"
                        : index === 3
                          ? "0"
                          : "100",
                    ),
              net_income: known("0"),
              operating_cash_flow: known("125.123456789"),
              free_cash_flow: known("-50.123456789"),
            },
          },
  );
  const values = (field: PersonalAnnualFinancialTrendField) =>
    slots.map((slot) =>
      slot.status === "reported" && slot.cells[field].status === "known"
        ? Number(slot.cells[field].value)
        : null,
    );
  return {
    status: "ready",
    identity: {
      listingId: "listing-aaa",
      issuerId: "issuer-aaa",
      symbol: "AAA",
      issuerName: "A Company",
      securityName: "A Common",
      exchangeMic: "XNAS",
      country: "US",
    },
    selectionKey: "company-a",
    contentKey: "example",
    asOf: "2026-09-19T00:00:00Z",
    unit: "USD",
    slots,
    plots: {
      revenue: { status: "ready", values: values("revenue") },
      net_income: { status: "ready", values: values("net_income") },
      operating_cash_flow: {
        status: "ready",
        values: values("operating_cash_flow"),
      },
      free_cash_flow: { status: "ready", values: values("free_cash_flow") },
    },
  };
}
function elements(
  value: unknown,
  type?: React.ElementType,
): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value))
    return value.flatMap((item) => elements(item, type));
  if (!React.isValidElement(value)) return [];
  return [
    ...(type === undefined || value.type === type
      ? [value as React.ReactElement<Record<string, unknown>>]
      : []),
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
