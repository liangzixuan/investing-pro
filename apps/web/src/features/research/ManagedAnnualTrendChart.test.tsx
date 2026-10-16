import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { annualHistoryRows, response } from "./sec-annual-evidence-fixture";
import { projectManagedAnnualTrend } from "./managed-annual-trend-input";
import { annualCashHistoryRows, cashResponse } from "./sec-annual-cash-fixture";
import {
  cashTrendChartInput,
  projectManagedAnnualCashTrend,
} from "./managed-annual-cash-trend-input";
import type { ManagedAnnualAmountChartInput } from "./managed-annual-amount-plot";
import {
  annualTrendChartInput,
  annualTrendTooltip,
  managedAnnualTrendChartOption,
  type ReadyAnnualTrend,
} from "./managed-annual-trend-chart-option";

const hooks = vi.hoisted(() => ({
  failure: null as string | null,
  deps: null as readonly unknown[] | null,
  cleanup: undefined as (() => void) | undefined,
  pending: undefined as (() => void) | undefined,
  element: {},
}));
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
  add: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useRef: () => ({ current: hooks.element }),
  useState: () => [
    hooks.failure,
    (key: string) => {
      hooks.failure = key;
    },
  ],
  useEffect: (
    run: () => (() => void) | undefined,
    deps: readonly unknown[],
  ) => {
    if (hooks.deps?.every((value, index) => Object.is(value, deps[index])))
      return;
    hooks.deps = deps;
    hooks.pending = () => {
      hooks.cleanup?.();
      hooks.cleanup = run();
    };
  },
}));
vi.mock("echarts", () => ({ init: chart.init }));
import { ManagedAnnualTrendChart } from "./ManagedAnnualTrendChart";

let projection: ReadyAnnualTrend;
let resize: () => void;
const colors = {
  ink: "#aeb4c0",
  line: "#2c2f36",
  bar: "#8796ff",
  surface: "#191b1f",
  text: "#f2f3f5",
};
beforeEach(async () => {
  hooks.failure = null;
  hooks.deps = null;
  hooks.cleanup = undefined;
  hooks.pending = undefined;
  chart.init.mockReturnValue(chart);
  vi.stubGlobal("window", {
    matchMedia: () => ({
      matches: true,
      addEventListener: chart.motionAdd,
      removeEventListener: chart.motionRemove,
    }),
    addEventListener: chart.add,
    removeEventListener: chart.remove,
  });
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: (name: string) =>
      ({
        "--managed-muted": colors.ink,
        "--managed-line": colors.line,
        "--managed-action": colors.bar,
        "--managed-surface": colors.surface,
        "--managed-ink": colors.text,
      })[name],
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = chart.observe;
      disconnect = chart.disconnect;
      constructor(callback: () => void) {
        resize = callback;
      }
    },
  );
  const value = projectManagedAnnualTrend(
    await response(annualHistoryRows()),
    "Revenues",
  );
  if (value.status !== "ready") throw new Error("Invented trend unavailable");
  projection = value;
});
afterEach(() => {
  hooks.cleanup?.();
  Object.values(chart).forEach((mock) => mock.mockReset());
  vi.unstubAllGlobals();
});
function render(metric: "revenue" | "net_income" = "revenue") {
  return renderInput(annualTrendChartInput(projection, metric));
}
function renderInput(input: ManagedAnnualAmountChartInput) {
  const tree = ManagedAnnualTrendChart({ input });
  const pending = hooks.pending;
  hooks.pending = undefined;
  pending?.();
  return tree as React.ReactElement<Record<string, unknown>>;
}

describe("managed annual trend chart", () => {
  it("uses the same renderer for signed cash amounts and keeps exact cash tooltip values", async () => {
    const cash = projectManagedAnnualCashTrend(
      await cashResponse(annualCashHistoryRows()),
    );
    if (cash.status !== "ready")
      throw new Error("Invented cash trend unavailable");
    const first = cashTrendChartInput(cash, "operatingCashFlow");
    renderInput(first);
    const oldResize = resize;
    renderInput(cashTrendChartInput(cash, "ppePurchases"));
    const calculated = cashTrendChartInput(
      cash,
      "operatingCashFlowLessPpePurchases",
    );
    const tree = renderInput(calculated);
    expect(
      chart.setOption.mock.calls.map(
        ([option]) => (option as { series: unknown }).series,
      ),
    ).toEqual([
      expect.arrayContaining([
        expect.objectContaining({
          name: "Operating cash flow",
          data: [500, -50, 120.125],
        }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({
          name: "PP&E purchases",
          data: [750, 0, 20.025],
        }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({
          name: "Operating cash flow less PP&E purchases",
          data: [-250, -50, 100.1],
        }),
      ]),
    ]);
    expect(tree.props["aria-label"]).toBe(
      "Operating cash flow less PP&E purchases in USD across 3 reported annual periods from one filing, oldest to newest. Negative amounts extend below zero; known zero has zero height. Exact amounts and dates remain in the table below.",
    );
    expect(annualTrendTooltip(calculated, { dataIndex: 0 })).toBe(
      "Operating cash flow less\n PP&E purchases\n2023-01-01 to\n2023-12-31\nUSD: -250",
    );
    expect(annualTrendTooltip(first, { dataIndex: 2 })).toBe(
      "Operating cash flow\n2025-01-01 to\n2025-12-31\nUSD: 120.125",
    );
    expect(chart.dispose).toHaveBeenCalledTimes(2);
    oldResize();
    expect(chart.resize).not.toHaveBeenCalled();
    const unsafe = {
      ...calculated,
      contentKey: "unsafe-cash",
      plot: { status: "unavailable", reason: "unsafe_plot_value" },
    } as const;
    expect(renderInput(unsafe).props.role).toBe("status");
    expect(chart.init).toHaveBeenCalledTimes(3);
    expect(chart.dispose).toHaveBeenCalledTimes(3);
  });

  it("uses exact period ends, a zero baseline and the managed colors", () => {
    const tree = render();
    expect(tree.props.role).toBe("img");
    expect(tree.props["aria-label"]).toContain(
      "Revenues: Revenue in USD across 3 reported annual periods",
    );
    expect(chart.init).toHaveBeenCalledWith(hooks.element, undefined, {
      renderer: "canvas",
    });
    expect(chart.setOption.mock.calls[0]?.[0]).toMatchObject({
      animation: false,
      aria: { enabled: true, description: tree.props["aria-label"] },
      xAxis: {
        data: ["2023-12-31", "2024-12-31", "2025-12-31"],
      },
      yAxis: { name: "USD", scale: false },
      tooltip: {
        backgroundColor: colors.surface,
        borderColor: colors.line,
        textStyle: { color: colors.text },
      },
      series: [
        {
          data: [640, 800, 1000],
          type: "bar",
          itemStyle: { color: colors.bar },
          markLine: { data: [{ yAxis: 0 }] },
        },
      ],
    });
  });

  it("preserves equivalent rendering and disposes the old chart on metric/content replacement", () => {
    render();
    const oldResize = resize;
    projection = { ...projection };
    render();
    expect(chart.init).toHaveBeenCalledTimes(1);
    render("net_income");
    expect(chart.dispose).toHaveBeenCalledTimes(1);
    expect(chart.setOption.mock.calls.at(-1)?.[0]).toMatchObject({
      series: [{ data: [32, 80, 100] }],
    });
    oldResize();
    expect(chart.resize).not.toHaveBeenCalled();
    resize();
    expect(chart.resize).toHaveBeenCalledOnce();
    projection = {
      ...projection,
      contentKey: `${projection.contentKey}:replacement`,
    };
    render("net_income");
    expect(chart.dispose).toHaveBeenCalledTimes(2);
    expect(chart.init).toHaveBeenCalledTimes(3);
  });

  it("cleans up on close/retirement and ignores old resize/motion callbacks", () => {
    render();
    const oldResize = resize;
    const motion = chart.motionAdd.mock.calls[0]![1] as (event: {
      matches: boolean;
    }) => void;
    motion({ matches: false });
    expect(chart.setOption).toHaveBeenLastCalledWith({ animation: true });
    hooks.cleanup?.();
    hooks.cleanup = undefined;
    const before = chart.setOption.mock.calls.length;
    oldResize();
    motion({ matches: true });
    expect(chart.resize).not.toHaveBeenCalled();
    expect(chart.setOption).toHaveBeenCalledTimes(before);
    expect(chart.disconnect).toHaveBeenCalledOnce();
    expect(chart.motionRemove).toHaveBeenCalledWith("change", motion);
    expect(chart.dispatchAction).toHaveBeenCalledWith({ type: "hideTip" });
    expect(chart.dispose).toHaveBeenCalledOnce();
  });

  it("uses the window resize fallback and removes it", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render();
    expect(chart.add).toHaveBeenCalledOnce();
    expect(chart.add.mock.calls[0]?.[0]).toBe("resize");
    expect(chart.add.mock.calls[0]?.[1]).toBeTypeOf("function");
    hooks.cleanup?.();
    hooks.cleanup = undefined;
    expect(chart.remove).toHaveBeenCalledWith(
      "resize",
      chart.add.mock.calls[0]![1],
    );
  });

  it("withholds unsafe coordinates and removes an older chart", () => {
    render();
    projection = {
      ...projection,
      contentKey: "unsafe",
      plots: {
        ...projection.plots,
        revenue: { status: "unavailable", reason: "unsafe_plot_value" },
      },
    };
    const tree = render();
    expect(tree.type).toBe("p");
    expect(tree.props.role).toBe("status");
    expect(chart.init).toHaveBeenCalledTimes(1);
    expect(chart.dispose).toHaveBeenCalledOnce();
    render("net_income");
    expect(chart.init).toHaveBeenCalledTimes(2);
  });

  it.each(["init", "setOption"] as const)(
    "fails only the chart when %s throws, then permits new content",
    (step) => {
      chart[step].mockImplementationOnce(() => {
        throw new Error("Invented chart failure");
      });
      render();
      expect(render().type).toBe("p");
      expect(chart.init).toHaveBeenCalledTimes(1);
      expect(chart.dispose).toHaveBeenCalledTimes(step === "init" ? 0 : 1);
      projection = { ...projection, contentKey: "new-content" };
      expect(render().type).toBe("div");
      expect(chart.init).toHaveBeenCalledTimes(2);
    },
  );

  it("releases remaining resources even when hiding a tooltip fails", () => {
    render();
    chart.dispatchAction.mockImplementationOnce(() => {
      throw new Error("Invented tooltip failure");
    });
    hooks.cleanup?.();
    hooks.cleanup = undefined;
    expect(chart.disconnect).toHaveBeenCalledOnce();
    expect(chart.dispose).toHaveBeenCalledOnce();
  });

  it.each(["resize", "motion"] as const)(
    "contains a later %s renderer failure and fences subsequent callbacks",
    (kind) => {
      render();
      const oldResize = resize;
      const motion = chart.motionAdd.mock.calls[0]![1] as (event: {
        matches: boolean;
      }) => void;
      const fail = () => {
        throw new Error("Invented callback failure");
      };
      if (kind === "resize") {
        chart.resize.mockImplementationOnce(fail);
        oldResize();
      } else {
        chart.setOption.mockImplementationOnce(fail);
        motion({ matches: false });
      }
      expect(render().type).toBe("p");
      expect(chart.dispose).toHaveBeenCalledOnce();
      const count = chart.setOption.mock.calls.length;
      oldResize();
      motion({ matches: true });
      expect(chart.setOption).toHaveBeenCalledTimes(count);
      expect(chart.init).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps exact strings and start/end dates in confined rich-text tooltips", () => {
    const option = managedAnnualTrendChartOption(
      annualTrendChartInput(projection, "net_income"),
      false,
      colors,
    );
    expect(option.tooltip).toMatchObject({
      renderMode: "richText",
      confine: true,
    });
    expect(
      annualTrendTooltip(annualTrendChartInput(projection, "net_income"), [
        { dataIndex: 0 },
      ]),
    ).toBe("Net income\n2023-01-01 to\n2023-12-31\nUSD: 32");
    const original = projection.periods[0]!;
    projection = {
      ...projection,
      periods: [
        { ...original, netIncome: "-0.00000000000000000000000000001" },
        ...projection.periods.slice(1),
      ],
    };
    expect(
      annualTrendTooltip(annualTrendChartInput(projection, "net_income"), {
        dataIndex: 0,
      }).replaceAll("\n", ""),
    ).toContain("USD: -0.00000000000000000000000000001");
    for (const invalid of [
      null,
      [],
      {},
      { dataIndex: -1 },
      { dataIndex: 0.5 },
      { dataIndex: 8 },
    ])
      expect(
        annualTrendTooltip(
          annualTrendChartInput(projection, "revenue"),
          invalid,
        ),
      ).toBe("Annual period unavailable");
  });
});
