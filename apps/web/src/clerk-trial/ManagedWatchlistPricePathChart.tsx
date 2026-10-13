import * as echarts from "echarts";
import { useEffect, useRef, useState } from "react";
import type { ManagedWatchlistPricePath } from "./managed-watchlist-price-path";
import {
  watchlistPricePathOption,
  watchlistPricePathSummary,
} from "./managed-watchlist-price-path-option";

export function ManagedWatchlistPricePathChart({
  path,
}: {
  path: ManagedWatchlistPricePath;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [failedPath, setFailedPath] =
    useState<ManagedWatchlistPricePath | null>(null);
  const failed =
    failedPath?.contentKey === path.contentKey &&
    path.responses.every(
      (response, index) =>
        response === failedPath.responses[index] &&
        path.handles[index] === failedPath.handles[index],
    );
  useEffect(() => {
    if (!element.current || !path.plottable || failed) return;
    return mountPricePath(element.current, path, () => setFailedPath(path));
  }, [
    path.contentKey,
    path.plottable,
    path.responses[0],
    path.responses[1],
    path.handles[0],
    path.handles[1],
    failed,
  ]);
  return !path.plottable || failed ? (
    <p role="status">
      Chart unavailable:{" "}
      {failed
        ? "the chart could not be displayed"
        : "one or more index values cannot be safely plotted"}
      . Exact data remains below.
    </p>
  ) : (
    <div
      ref={element}
      className="managed-watchlist-price-path-canvas"
      role="img"
      aria-label={watchlistPricePathSummary(path)}
    />
  );
}

function mountPricePath(
  element: HTMLDivElement,
  path: ManagedWatchlistPricePath,
  fail: () => void,
) {
  let chart: echarts.ECharts | null = null;
  let observer: ResizeObserver | null = null;
  let disposed = false;
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const update = (action: () => void) => {
    if (disposed) return;
    try {
      action();
    } catch {
      cleanup();
      fail();
    }
  };
  const resize = () => update(() => chart?.resize());
  const changeMotion = (event: MediaQueryListEvent) =>
    update(() => chart?.setOption({ animation: !event.matches }));
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    for (const release of [
      () => observer?.disconnect(),
      () => window.removeEventListener("resize", resize),
      () => motion?.removeEventListener?.("change", changeMotion),
      () => chart?.dispatchAction({ type: "hideTip" }),
      () => chart?.dispose(),
    ]) {
      try {
        release();
      } catch {
        /* Release remaining resources independently. */
      }
    }
  };
  try {
    chart = echarts.init(element, undefined, { renderer: "canvas" });
    chart.setOption(
      watchlistPricePathOption(
        path,
        !motion?.matches,
        getComputedStyle(element),
      ),
    );
    if (typeof ResizeObserver === "undefined")
      window.addEventListener("resize", resize);
    else {
      observer = new ResizeObserver(resize);
      observer.observe(element);
    }
    motion?.addEventListener?.("change", changeMotion);
  } catch {
    cleanup();
    fail();
  }
  return cleanup;
}
