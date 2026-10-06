import { renderToStaticMarkup } from "react-dom/server";
import type {
  EChartsOption,
  TooltipComponentFormatterCallbackParams,
} from "echarts";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { CloseHistoryChart } from "./CloseHistoryChart";

interface MockElement {
  tag: string;
  className: string;
  textContent: string;
  setAttribute: Mock<(name: string, value: string) => void>;
  append: Mock<(date: MockElement, close: MockElement) => void>;
}

const dom = vi.hoisted(() => ({
  createElement: vi.fn<(tag: string) => MockElement>(),
  elements: [] as MockElement[],
}));
const hooks = vi.hoisted(() => ({
  effect: undefined as undefined | (() => (() => void) | void),
  element: { ownerDocument: { createElement: dom.createElement } },
}));
const chart = vi.hoisted(() => ({
  init: vi.fn(),
  setOption: vi.fn<(option: EChartsOption) => void>(),
  resize: vi.fn(),
  dispose: vi.fn(),
  observe: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useEffect: (effect: () => (() => void) | void) => {
    hooks.effect = effect;
  },
  useRef: () => ({ current: hooks.element }),
}));
vi.mock("echarts", () => ({ init: chart.init }));
beforeEach(() => {
  chart.init.mockReturnValue(chart);
  dom.elements = [];
  dom.createElement.mockImplementation((tag: string) => {
    const element = {
      tag,
      className: "",
      textContent: "",
      setAttribute: vi.fn<(name: string, value: string) => void>(),
      append: vi.fn<(date: MockElement, close: MockElement) => void>(),
      set innerHTML(_value: string) {
        throw new Error("Tooltip data must not be assigned as HTML");
      },
    };
    dom.elements.push(element);
    return element;
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  hooks.effect = undefined;
});
const rows = [
  { date: "2026-09-18", close: "100.1234567890123456789" },
  { date: "2026-09-19", close: "101.5" },
];
const point = (dataIndex: number, name = rows[dataIndex]?.date) => ({
  componentType: "series",
  seriesType: "line",
  seriesId: "managed-raw-close",
  seriesIndex: 0,
  dataIndex,
  name,
  value: 999,
});
function formatter() {
  const tooltip = chart.setOption.mock.calls.at(-1)?.[0].tooltip;
  if (
    !tooltip ||
    Array.isArray(tooltip) ||
    typeof tooltip.formatter !== "function"
  ) {
    throw new Error("Expected an ECharts tooltip formatter");
  }
  const callback = tooltip.formatter;
  return (params?: unknown): MockElement | string => {
    const result = callback(
      params as TooltipComponentFormatterCallbackParams,
      "test",
      () => {},
    );
    if (typeof result === "string") return result;
    const element = dom.elements.find((node) => node === (result as unknown));
    if (!element) throw new Error("Expected a formatter-created DOM element");
    return element;
  };
}

function tooltipFor(params: unknown): MockElement {
  const tooltip = formatter()(params);
  if (typeof tooltip === "string") throw new Error("Expected tooltip content");
  return tooltip;
}

describe("close-only chart", () => {
  it("keeps exact decimal strings and trading dates accessible without fabricated OHLCV", () => {
    const html = renderToStaticMarkup(
      <CloseHistoryChart symbol="ZERO" rows={rows} />,
    );
    expect(html).toContain("ZERO one-month raw close history in USD");
    expect(html).toContain("One-month raw closing prices in USD");
    expect(html).toContain("100.1234567890123456789");
    expect(html).toContain("2026-09-19");
    expect(html).toContain(
      "Point to or tap the chart to inspect a dated raw close.",
    );
    expect(html).toContain('role="region" tabindex="0"');
    expect(html).toContain('aria-label="ZERO exact raw closing prices"');
    expect(html).toContain('<th scope="col">Trading date</th>');
    expect(html).toContain('<th scope="row">2026-09-18</th>');
    expect(html).not.toContain("volume");
    expect(html).toContain(
      "Raw closes are not adjusted for splits or dividends.",
    );
  });
  it("plots only closes, resizes with its container and disposes the chart on retirement", () => {
    let resize!: () => void;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe = chart.observe;
        disconnect = chart.disconnect;
      },
    );
    CloseHistoryChart({ symbol: "ZERO", rows });
    const cleanup = hooks.effect?.();
    expect(chart.init).toHaveBeenCalledWith(hooks.element, undefined, {
      renderer: "canvas",
    });
    expect(chart.setOption.mock.calls[0]?.[0]).toMatchObject({
      animation: false,
      aria: { enabled: true },
      tooltip: {
        trigger: "axis",
        triggerOn: "mousemove|click",
        renderMode: "html",
        confine: true,
        axisPointer: { type: "line", axis: "x", label: { show: false } },
        extraCssText:
          "max-width: calc(100% - 16px); box-sizing: border-box; white-space: normal;",
      },
      xAxis: { data: ["2026-09-18", "2026-09-19"] },
      series: [
        {
          id: "managed-raw-close",
          name: "Raw close",
          type: "line",
          data: rows.map((row) => Number(row.close)),
          showSymbol: true,
        },
      ],
    });
    expect(chart.observe).toHaveBeenCalledWith(hooks.element);
    resize();
    expect(chart.resize).toHaveBeenCalledOnce();
    cleanup?.();
    expect(chart.disconnect).toHaveBeenCalledOnce();
    expect(chart.dispose).toHaveBeenCalledOnce();
  });
  it("does not initialize a chart without rows", () => {
    CloseHistoryChart({ symbol: "ZERO", rows: [] });
    hooks.effect?.();
    expect(chart.init).not.toHaveBeenCalled();
  });
  it.each([0, 1])(
    "inspects the exact dated row at index %i instead of the plotted value",
    (index) => {
      CloseHistoryChart({ symbol: "ZERO", rows });
      hooks.effect?.();
      const tooltip = tooltipFor([point(index)]);
      expect(tooltip.className).toBe("managed-eod-tooltip");
      expect(tooltip.setAttribute).toHaveBeenCalledWith("role", "tooltip");
      const [date, close] = tooltip.append.mock.calls[0]!;
      expect(date.className).toBe("managed-eod-tooltip-date");
      expect(date.textContent).toBe(rows[index]?.date);
      expect(close.className).toBe("managed-eod-tooltip-close");
      expect(close.textContent).toBe(`Raw close (USD): ${rows[index]?.close}`);
    },
  );
  it("inspects a single dated close with the same exact-value contract", () => {
    CloseHistoryChart({ symbol: "ONE", rows: [rows[1]!] });
    hooks.effect?.();
    const tooltip = tooltipFor([point(0, rows[1]!.date)]);
    const [date, close] = tooltip.append.mock.calls[0]!;
    expect(date.textContent).toBe("2026-09-19");
    expect(close.textContent).toBe("Raw close (USD): 101.5");
    expect(chart.setOption.mock.calls[0]?.[0].series).toMatchObject([
      { showSymbol: true },
    ]);
  });
  it.each([
    ["empty array", []],
    ["multiple points", [point(0), point(1)]],
    ["null point", [null]],
    ["missing point", undefined],
    ["negative index", [point(-1)]],
    ["out-of-range index", [point(2)]],
    ["fractional index", [point(0.5, rows[0]!.date)]],
    ["string index", [{ ...point(0), dataIndex: "0" }]],
    ["nonfinite index", [point(Infinity, rows[0]!.date)]],
    ["mismatched date", [point(0, rows[1]!.date)]],
    ["foreign series", [{ ...point(0), seriesId: "another-series" }]],
    ["second series", [{ ...point(0), seriesIndex: 1 }]],
    ["non-line series", [{ ...point(0), seriesType: "bar" }]],
    ["axis component", [{ ...point(0), componentType: "xAxis" }]],
  ])("withholds a tooltip for %s", (_label, params) => {
    CloseHistoryChart({ symbol: "ZERO", rows });
    hooks.effect?.();
    expect(formatter()(params)).toBe("");
    expect(dom.createElement).not.toHaveBeenCalled();
  });
  it("puts markup-like content only in text nodes", () => {
    const unusual = {
      date: '<img src=x onerror="bad()">',
      close: "<svg onload=bad()>",
    };
    CloseHistoryChart({ symbol: "<script>bad()</script>", rows: [unusual] });
    hooks.effect?.();
    const tooltip = tooltipFor([point(0, unusual.date)]);
    const [date, close] = tooltip.append.mock.calls[0]!;
    expect(date.textContent).toBe(unusual.date);
    expect(close.textContent).toBe(`Raw close (USD): ${unusual.close}`);
    expect(dom.createElement.mock.calls.map(([tag]) => tag)).toEqual([
      "div",
      "strong",
      "div",
    ]);
  });
  it("retires the old formatter before disposing and uses only replacement rows", () => {
    CloseHistoryChart({ symbol: "ZERO", rows });
    const cleanup = hooks.effect?.();
    const oldFormatter = formatter();
    expect(oldFormatter()).toBe("");
    chart.dispose.mockImplementationOnce(() => {
      expect(oldFormatter([point(0)])).toBe("");
    });
    cleanup?.();
    const replacement = [
      { date: "2026-10-02", close: "12.5000000000000000001" },
    ];
    CloseHistoryChart({ symbol: "OTHER", rows: replacement });
    const nextCleanup = hooks.effect?.();
    expect(oldFormatter([point(0)])).toBe("");
    expect(formatter()([point(0)])).toBe("");
    const tooltip = tooltipFor([point(0, replacement[0]!.date)]);
    expect(tooltip.append.mock.calls[0]![1].textContent).toBe(
      "Raw close (USD): 12.5000000000000000001",
    );
    const replacementFormatter = formatter();
    nextCleanup?.();
    CloseHistoryChart({ symbol: "OTHER", rows: [] });
    hooks.effect?.();
    expect(replacementFormatter([point(0, replacement[0]!.date)])).toBe("");
    expect(chart.init).toHaveBeenCalledTimes(2);
    expect(chart.dispose).toHaveBeenCalledTimes(2);
  });
});
