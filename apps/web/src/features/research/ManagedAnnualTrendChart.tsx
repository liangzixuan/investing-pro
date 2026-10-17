import * as echarts from "echarts";
import { useEffect, useRef, useState } from "react";
import type { ManagedAnnualAmountChartInput } from "./managed-annual-amount-plot";
import { managedAnnualTrendChartOption } from "./managed-annual-trend-chart-option";

export function ManagedAnnualTrendChart({
  input,
}: {
  readonly input: ManagedAnnualAmountChartInput;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const key = input.contentKey;
  const unavailable = input.plot.status !== "ready";
  const failed = failedKey === key;
  useEffect(() => {
    if (!element.current || unavailable || failed) return;
    return mountAnnualTrend(element.current, input, () => setFailedKey(key));
    // The content key covers every projected chart input. Fresh equivalent
    // projections preserve the mounted canvas and its listeners.
  }, [key, unavailable, failed]);
  if (unavailable || failed)
    return (
      <p role="status" className="managed-annual-unavailable">
        {failed
          ? "Chart unavailable: the chart could not be displayed."
          : "Chart unavailable: one or more amounts cannot be safely plotted."}{" "}
        Exact amounts remain in the tables below.
      </p>
    );
  return (
    <div
      ref={element}
      className="managed-annual-trend-canvas"
      role="img"
      aria-label={input.summary}
    />
  );
}

function mountAnnualTrend(
  element: HTMLDivElement,
  input: ManagedAnnualAmountChartInput,
  fail: () => void,
) {
  let chart: echarts.ECharts | null = null;
  let observer: ResizeObserver | null = null;
  let disposed = false;
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const update = (action: () => void) =>
    guardChartUpdate(disposed, action, cleanup, fail);
  const resize = () => update(() => chart?.resize());
  const changeMotion = (event: MediaQueryListEvent) => {
    update(() => chart?.setOption({ animation: !event.matches }));
  };
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    releaseResources([
      () => observer?.disconnect(),
      () => window.removeEventListener("resize", resize),
      () => motion?.removeEventListener?.("change", changeMotion),
      () => chart?.dispatchAction({ type: "hideTip" }),
      () => chart?.dispose(),
    ]);
  };
  try {
    const style = getComputedStyle(element);
    chart = echarts.init(element, undefined, { renderer: "canvas" });
    chart.setOption(
      managedAnnualTrendChartOption(input, !motion?.matches, {
        ink: style.getPropertyValue("--managed-muted").trim(),
        line: style.getPropertyValue("--managed-line").trim(),
        bar: style.getPropertyValue("--managed-action").trim(),
        surface: style.getPropertyValue("--managed-surface").trim(),
        text: style.getPropertyValue("--managed-ink").trim(),
      }),
    );
    observer = observeResize(element, resize);
    motion?.addEventListener?.("change", changeMotion);
  } catch {
    cleanup();
    fail();
  }
  return cleanup;
}

function guardChartUpdate(
  disposed: boolean,
  action: () => void,
  cleanup: () => void,
  fail: () => void,
) {
  if (disposed) return;
  try {
    action();
  } catch {
    cleanup();
    fail();
  }
}

function observeResize(element: HTMLDivElement, resize: () => void) {
  if (typeof ResizeObserver === "undefined") {
    window.addEventListener("resize", resize);
    return null;
  }
  const observer = new ResizeObserver(resize);
  try {
    observer.observe(element);
  } catch (error) {
    releaseResources([() => observer.disconnect()]);
    throw error;
  }
  return observer;
}

function releaseResources(releases: readonly (() => void)[]) {
  for (const release of releases) {
    try {
      release();
    } catch {
      /* Release remaining resources independently. */
    }
  }
}
