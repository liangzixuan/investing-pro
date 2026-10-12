import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import {
  formatManagedWatchlistExport,
  managedWatchlistExportUnavailableReason,
} from "./managed-watchlist-export-document";
import type { WatchlistExportDeliveryAdapter } from "./watchlist-export-delivery";

interface ExportProps {
  workspace: ManagedWorkspace;
  delivery: WatchlistExportDeliveryAdapter | undefined;
  routeActive: () => boolean;
}

interface ExportOperation {
  controller: AbortController;
  workspace: ManagedWorkspace;
  delivery: WatchlistExportDeliveryAdapter;
  saved: ReturnType<ManagedWorkspace["coordinator"]["getSnapshot"]>["saved"];
}

const unavailableMessages = {
  no_saved: "Load a saved watchlist to export it.",
  loading: "Wait for the saved watchlist to finish loading.",
  saving: "Wait for the save to finish before exporting.",
  reconciling: "Wait for reconciliation to finish before exporting.",
  signing_out: "Export is unavailable while signing out.",
  retired: "This session has ended.",
  conflict: "Choose which watchlist version to keep before exporting.",
  uncertain: "Reconcile the pending save before exporting.",
  replay_pending: "Finish reviewing the saved version before exporting.",
};

function watchlistActive({ workspace, routeActive }: ExportProps) {
  const state = workspace.getSnapshot();
  return (
    state.view === "watchlist" &&
    !state.research &&
    !state.companyRoute &&
    routeActive()
  );
}

function exportRequest(props: ExportProps) {
  const state = props.workspace.coordinator.getSnapshot();
  if (
    !props.delivery ||
    !state.saved ||
    managedWatchlistExportUnavailableReason(state) !== null ||
    !watchlistActive(props)
  )
    return null;
  return {
    saved: state.saved,
    delivery: props.delivery,
    workspace: props.workspace,
  };
}

function useWatchlistExport(props: ExportProps) {
  const { workspace, delivery } = props;
  const latest = useRef(props);
  latest.current = props;
  const mounted = useRef(false);
  const pending = useRef<ExportOperation | null>(null);
  const [status, setStatus] = useState({ busy: false, message: "" });
  const isCurrent = useCallback((operation: ExportOperation) => {
    const current = latest.current;
    const saved = current.workspace.coordinator.getSnapshot();
    return (
      mounted.current &&
      pending.current === operation &&
      current.workspace === operation.workspace &&
      current.delivery === operation.delivery &&
      !operation.controller.signal.aborted &&
      saved.saved === operation.saved &&
      managedWatchlistExportUnavailableReason(saved) === null &&
      watchlistActive(current)
    );
  }, []);
  const cancel = useCallback(() => {
    const operation = pending.current;
    if (!operation) return;
    pending.current = null;
    operation.controller.abort();
    if (mounted.current) setStatus({ busy: false, message: "" });
  }, []);
  const check = useCallback(() => {
    if (pending.current && !isCurrent(pending.current)) cancel();
  }, [cancel, isCurrent]);
  useLayoutEffect(() => {
    mounted.current = true;
    setStatus({ busy: false, message: "" });
    const stopWorkspace = workspace.subscribe(check);
    const stopSaved = workspace.coordinator.subscribe(check);
    return () => {
      mounted.current = false;
      stopWorkspace();
      stopSaved();
      cancel();
    };
  }, [workspace, delivery, cancel, check]);
  useLayoutEffect(check);

  async function start() {
    if (pending.current || !mounted.current) return;
    const request = exportRequest(latest.current);
    if (!request) return;
    const document = formatManagedWatchlistExport(request.saved);
    if (!document) {
      setStatus({
        busy: false,
        message: "The saved watchlist could not be exported.",
      });
      return;
    }
    const operation = { controller: new AbortController(), ...request };
    pending.current = operation;
    setStatus({ busy: true, message: "" });
    let message = "";
    try {
      const result = await request.delivery.deliver(document, {
        signal: operation.controller.signal,
        isCurrent: () => isCurrent(operation),
      });
      if (isCurrent(operation)) {
        const messages = {
          download_requested: `Download requested for saved version ${document.version}.`,
          written: `Exported saved version ${document.version}.`,
          cancelled: "Export cancelled.",
        };
        message = messages[result];
      }
    } catch {
      if (isCurrent(operation))
        message =
          "Export could not be completed. Check your chosen destination before trying again. Your watchlist is unchanged.";
    } finally {
      if (pending.current === operation) {
        pending.current = null;
        if (mounted.current) setStatus({ busy: false, message });
      }
    }
  }
  return { ...status, start };
}

export function ManagedWatchlistExport(props: ExportProps) {
  const { coordinator } = props.workspace;
  const state = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );
  const operation = useWatchlistExport(props);
  const reason = managedWatchlistExportUnavailableReason(state);
  const disabled =
    !props.delivery || reason !== null || !watchlistActive(props);
  const count = state.saved?.payload.memberships.length ?? 0;
  return (
    <div>
      <button
        id="managed-watchlist-export"
        type="button"
        className="trial-secondary"
        disabled={disabled}
        aria-disabled={disabled || operation.busy}
        aria-busy={operation.busy}
        aria-describedby="managed-watchlist-export-scope"
        onClick={() => void operation.start()}
      >
        {operation.busy
          ? "Exporting saved watchlist…"
          : "Export saved watchlist"}
      </button>
      <p id="managed-watchlist-export-scope">
        {reason
          ? unavailableMessages[reason]
          : !props.delivery
            ? "Export is unavailable in this client."
            : `Saved version ${state.saved!.version} · all ${count} ${count === 1 ? "listing" : "listings"}. Unsaved changes are not included.`}
      </p>
      <p id="managed-watchlist-export-status" role="status">
        {operation.message}
      </p>
    </div>
  );
}
