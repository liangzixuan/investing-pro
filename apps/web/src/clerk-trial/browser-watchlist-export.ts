import { isSavedWatchlistExportDocument } from "./managed-watchlist-export-document";
import type {
  WatchlistExportDeliveryAdapter,
  WatchlistExportDeliveryContext,
  WatchlistExportDeliveryResult,
} from "./watchlist-export-delivery";

function releaseAfterFrame(
  url: string,
  context: WatchlistExportDeliveryContext,
): Promise<WatchlistExportDeliveryResult> {
  return new Promise((resolve) => {
    let frame = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.cancelAnimationFrame(frame);
      URL.revokeObjectURL(url);
      context.signal.removeEventListener("abort", finish);
      resolve("download_requested");
    };
    context.signal.addEventListener("abort", finish, { once: true });
    try {
      frame = window.requestAnimationFrame(finish);
    } catch {
      finish();
    }
    if (context.signal.aborted) finish();
  });
}

export const browserWatchlistExportAdapter: WatchlistExportDeliveryAdapter = {
  async deliver(value, context) {
    if (context.signal.aborted || !context.isCurrent()) return "cancelled";
    if (!isSavedWatchlistExportDocument(value))
      throw new Error("Watchlist export unavailable");
    const url = URL.createObjectURL(
      new Blob([value.text], { type: "text/plain;charset=utf-8" }),
    );
    let anchor: HTMLAnchorElement | null = null;
    try {
      anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = value.filename;
      anchor.hidden = true;
      document.body.append(anchor);
      if (context.signal.aborted || !context.isCurrent()) {
        URL.revokeObjectURL(url);
        return "cancelled";
      }
      anchor.click();
      return releaseAfterFrame(url, context);
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("Watchlist export unavailable");
    } finally {
      anchor?.remove();
    }
  },
};
