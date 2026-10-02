import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CloseHistoryChart } from "./CloseHistoryChart";

const hooks = vi.hoisted(() => ({
  effect: undefined as undefined | (() => (() => void) | void),
  element: {},
}));
const chart = vi.hoisted(() => ({
  init: vi.fn(),
  setOption: vi.fn(),
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
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  hooks.effect = undefined;
});
const rows = [
  { date: "2026-09-18", close: "100.1234567890123456789" },
  { date: "2026-09-19", close: "101.5" },
];
describe("close-only chart", () => {
  it("keeps exact decimal strings and trading dates accessible without fabricated OHLCV", () => {
    const html = renderToStaticMarkup(
      <CloseHistoryChart symbol="ZERO" rows={rows} />,
    );
    expect(html).toContain("ZERO one-month raw close history in USD");
    expect(html).toContain("One-month raw closing prices in USD");
    expect(html).toContain("100.1234567890123456789");
    expect(html).toContain("2026-09-19");
    expect(html).not.toContain("volume");
    expect(html).not.toContain("adjusted");
  });
  it("plots only closes, resizes with its container and disposes the chart on retirement", () => {
    chart.init.mockReturnValue(chart);
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
      xAxis: { data: ["2026-09-18", "2026-09-19"] },
      series: [
        {
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
});
