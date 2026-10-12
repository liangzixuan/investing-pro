import {
  isSavedWatchlistExportDocument,
  type SavedWatchlistExportDocument,
} from "./managed-watchlist-export-document";
import type {
  WatchlistExportDeliveryAdapter,
  WatchlistExportDeliveryContext,
  WatchlistExportDeliveryResult,
} from "./watchlist-export-delivery";

export interface InvestmentWatchlistExportPlugin {
  readonly choose: (options: {
    operationId: string;
    version: number;
  }) => Promise<{ status: "chosen"; handle: string } | { status: "cancelled" }>;
  readonly write: (options: {
    operationId: string;
    handle: string;
    text: string;
  }) => Promise<{ status: "written" }>;
  readonly cancel: (options: { operationId: string }) => Promise<void>;
}

const current = (context: WatchlistExportDeliveryContext) =>
  !context.signal.aborted && context.isCurrent();
const unavailable = () => new Error("Watchlist export unavailable");

export function createNativeWatchlistExportAdapter(
  plugin: InvestmentWatchlistExportPlugin,
): WatchlistExportDeliveryAdapter {
  let busy = false;
  return {
    async deliver(document, context) {
      if (!isSavedWatchlistExportDocument(document) || busy)
        throw unavailable();
      if (!current(context)) return "cancelled";
      const captured = { ...document };
      const operationId = crypto.randomUUID();
      busy = true;
      let cancelled = false;
      const cancel = () => {
        if (cancelled) return;
        cancelled = true;
        try {
          void plugin.cancel({ operationId }).catch(() => undefined);
        } catch {
          // Cancellation cannot expose a bridge exception or retry the export.
        }
      };
      context.signal.addEventListener("abort", cancel, { once: true });
      try {
        return await chooseAndWrite(plugin, captured, context, operationId);
      } catch {
        if (!current(context)) return "cancelled";
        throw unavailable();
      } finally {
        context.signal.removeEventListener("abort", cancel);
        cancel();
        busy = false;
      }
    },
  };
}

async function chooseAndWrite(
  plugin: InvestmentWatchlistExportPlugin,
  document: SavedWatchlistExportDocument,
  context: WatchlistExportDeliveryContext,
  operationId: string,
): Promise<WatchlistExportDeliveryResult> {
  if (!current(context)) return "cancelled";
  const choice = await plugin.choose({
    operationId,
    version: document.version,
  });
  if (!current(context)) return "cancelled";
  if (isCancelled(choice)) return "cancelled";
  if (!isChosen(choice)) throw unavailable();
  const result = await plugin.write({
    operationId,
    handle: choice.handle,
    text: document.text,
  });
  if (!current(context)) return "cancelled";
  if (
    !result ||
    Object.keys(result).length !== 1 ||
    result.status !== "written"
  )
    throw unavailable();
  return "written";
}

function isCancelled(value: unknown): value is { status: "cancelled" } {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.keys(value).length === 1 &&
    "status" in value &&
    value.status === "cancelled"
  );
}

function isChosen(
  value: unknown,
): value is { status: "chosen"; handle: string } {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.keys(value).length === 2 &&
    "status" in value &&
    value.status === "chosen" &&
    "handle" in value &&
    typeof value.handle === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(
      value.handle,
    )
  );
}
