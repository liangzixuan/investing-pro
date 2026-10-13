import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  projectManagedWatchlistPricePath,
  type ManagedWatchlistPricePath,
} from "./managed-watchlist-price-path";
import { pathFixture, pathRow } from "./watchlist-price-path-fixture";
import { watchlistPricePathTooltip } from "./managed-watchlist-price-path-option";

const hooks = vi.hoisted(() => ({
  failure: null as ManagedWatchlistPricePath | null,
  deps: null as readonly unknown[] | null,
  cleanup: undefined as (() => void) | undefined,
  pending: undefined as (() => void) | undefined,
  element: {},
}));
const chart = vi.hoisted(() => ({
  init: vi.fn(),
  setOption: vi.fn(),
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
    (path: ManagedWatchlistPricePath) => {
      hooks.failure = path;
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
import { ManagedWatchlistPricePathChart } from "./ManagedWatchlistPricePathChart";

let path: ManagedWatchlistPricePath;
let resize: () => void;
beforeEach(() => {
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
    getPropertyValue: (name: string) => name,
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
  path = projectManagedWatchlistPricePath(pathFixture().projection)!;
});
afterEach(() => {
  hooks.cleanup?.();
  Object.values(chart).forEach((mock) => mock.mockReset());
  vi.unstubAllGlobals();
});
function render() {
  const tree = ManagedWatchlistPricePathChart({ path });
  const pending = hooks.pending;
  hooks.pending = undefined;
  pending?.();
  return tree as React.ReactElement<Record<string, unknown>>;
}

describe("watchlist price path renderer", () => {
  it("uses current shared observations, two marker/line styles, theme and reduced motion", () => {
    expect(render().props["aria-label"]).toContain(
      "raw closes indexed to 100 on 2026-09-17",
    );
    expect(chart.setOption.mock.calls[0]![0]).toMatchObject({
      animation: false,
      tooltip: {
        renderMode: "richText",
        confine: true,
        backgroundColor: "--managed-surface",
        borderColor: "--managed-line",
        textStyle: { color: "--managed-ink" },
      },
      xAxis: {
        type: "category",
        data: path.dates,
        axisLabel: {
          hideOverlap: true,
          showMinLabel: true,
          showMaxLabel: true,
          alignMinLabel: "left",
          alignMaxLabel: "right",
        },
      },
      yAxis: {
        name: "Start = 100",
        nameTextStyle: { color: "--managed-muted" },
        scale: true,
      },
      series: [
        {
          data: [100, 110, 90],
          smooth: false,
          connectNulls: false,
          symbol: "circle",
          lineStyle: { type: "solid" },
        },
        {
          data: [100, 95, 120],
          symbol: "diamond",
          lineStyle: { type: "dashed" },
        },
      ],
    });
  });

  it("distinguishes the same symbol and MIC by share class in every chart label", () => {
    path = projectManagedWatchlistPricePath(
      pathFixture([
        pathRow("ALFA"),
        pathRow("BETA", undefined, undefined, {
          symbol: "ALFA",
          shareClassName: "Class C",
        }),
      ]).projection,
    )!;
    expect(render().props["aria-label"]).toContain(
      "ALFA Class A XNAS; ALFA Class C XNAS",
    );
    expect(chart.setOption.mock.calls[0]![0]).toMatchObject({
      series: [{ name: "ALFA Class A XNAS" }, { name: "ALFA Class C XNAS" }],
    });
    const tooltip = watchlistPricePathTooltip(path, { dataIndex: 1 });
    expect(tooltip).toContain("ALFA Class A XNAS");
    expect(tooltip).toContain("ALFA Class C XNAS");
  });

  it("retains equivalent renders but disposes on equal-value response or handle replacement", () => {
    render();
    path = { ...path };
    render();
    expect(chart.init).toHaveBeenCalledOnce();
    const oldResize = resize;
    path = {
      ...path,
      responses: path.responses.map((response) => ({ ...response })),
    };
    render();
    expect(chart.dispose).toHaveBeenCalledOnce();
    oldResize();
    expect(chart.resize).not.toHaveBeenCalled();
    path = { ...path, handles: [Symbol("re-added"), path.handles[1]!] };
    render();
    expect(chart.init).toHaveBeenCalledTimes(3);
  });

  it("releases all resources on close/hide/retirement and fences queued callbacks", () => {
    render();
    const motion = chart.motionAdd.mock.calls[0]![1] as (event: {
      matches: boolean;
    }) => void;
    motion({ matches: false });
    expect(chart.setOption).toHaveBeenLastCalledWith({ animation: true });
    hooks.cleanup?.();
    hooks.cleanup = undefined;
    const calls = chart.setOption.mock.calls.length;
    resize();
    motion({ matches: true });
    expect(chart.resize).not.toHaveBeenCalled();
    expect(chart.setOption).toHaveBeenCalledTimes(calls);
    expect(chart.disconnect).toHaveBeenCalledOnce();
    expect(chart.motionRemove).toHaveBeenCalledWith("change", motion);
    expect(chart.dispatchAction).toHaveBeenCalledWith({ type: "hideTip" });
    expect(chart.dispose).toHaveBeenCalledOnce();
  });

  it("cleans up the window fallback", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render();
    expect(chart.add).toHaveBeenCalledOnce();
    expect(chart.add.mock.calls[0]![0]).toBe("resize");
    expect(chart.add.mock.calls[0]![1]).toBeTypeOf("function");
    hooks.cleanup?.();
    hooks.cleanup = undefined;
    expect(chart.remove).toHaveBeenCalledWith(
      "resize",
      chart.add.mock.calls[0]![1],
    );
  });

  it("refuses unsafe coordinates and removes a previous chart", () => {
    render();
    path = projectManagedWatchlistPricePath(
      pathFixture([
        pathRow("ALFA", ["100", "0.00000001", "90"]),
        pathRow("BETA"),
      ]).projection,
    )!;
    expect(render().props.role).toBe("status");
    expect(chart.init).toHaveBeenCalledOnce();
    expect(chart.dispose).toHaveBeenCalledOnce();
  });

  it.each(["init", "setOption", "resize", "motion"])(
    "contains %s failure and permits replacement without stale failure",
    (step) => {
      if (step === "init" || step === "setOption")
        chart[step].mockImplementationOnce(() => {
          throw new Error("Invented chart failure");
        });
      render();
      const oldResize = resize;
      if (step === "resize") {
        chart.resize.mockImplementationOnce(() => {
          throw new Error("Invented resize failure");
        });
        resize();
      }
      if (step === "motion") {
        chart.setOption.mockImplementationOnce(() => {
          throw new Error("Invented motion failure");
        });
        (
          chart.motionAdd.mock.calls[0]![1] as (event: {
            matches: boolean;
          }) => void
        )({ matches: false });
      }
      expect(render().type).toBe("p");
      path = {
        ...path,
        responses: path.responses.map((response) => ({ ...response })),
      };
      expect(render().type).toBe("div");
      oldResize?.();
      expect(render().type).toBe("div");
    },
  );

  it("still disposes if hiding the tooltip throws", () => {
    render();
    chart.dispatchAction.mockImplementationOnce(() => {
      throw new Error("Invented cleanup failure");
    });
    hooks.cleanup?.();
    hooks.cleanup = undefined;
    expect(chart.dispose).toHaveBeenCalledOnce();
  });

  it("uses source text in bounded tooltip content, with a long-value table fallback", () => {
    expect(watchlistPricePathTooltip(path, [{ dataIndex: 1 }])).toContain(
      "USD 110\nIndex 110.0000",
    );
    expect(watchlistPricePathTooltip(path, [{ dataIndex: 99 }])).toBe(
      "Observation unavailable",
    );
    expect(watchlistPricePathTooltip(path, null)).toBe(
      "Observation unavailable",
    );
    path = projectManagedWatchlistPricePath(
      pathFixture([
        pathRow("ALFA", ["9".repeat(64), "8".repeat(64), "7".repeat(64)]),
        pathRow("BETA", ["9".repeat(64), "8".repeat(64), "7".repeat(64)]),
      ]).projection,
    )!;
    const tooltip = watchlistPricePathTooltip(path, { dataIndex: 1 });
    expect(tooltip).toContain("Index 88.8889");
    expect(tooltip.split("\n").every((line) => line.length <= 24)).toBe(true);
    path = projectManagedWatchlistPricePath(
      pathFixture([
        pathRow("ALFA", ["1", "9".repeat(64), "1"]),
        pathRow("BETA", ["1", "9".repeat(64), "1"]),
      ]).projection,
    )!;
    expect(watchlistPricePathTooltip(path, { dataIndex: 1 })).toContain(
      "exact data table below",
    );
  });
});
