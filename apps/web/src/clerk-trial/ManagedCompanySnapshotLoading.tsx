import { useSyncExternalStore } from "react";
import type { ManagedCompanySnapshotLoad } from "./managed-company-snapshot-load";

export function ManagedCompanySnapshotLoading({
  model,
  navigationPending,
  onLoad,
  onCancel,
}: {
  model: ManagedCompanySnapshotLoad;
  navigationPending: boolean;
  onLoad: () => Promise<void>;
  onCancel: () => void;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  return (
    <section
      className="managed-company-evidence-actions"
      aria-label="Load company snapshot"
      aria-busy={state.running}
    >
      <h3>Build the company snapshot</h3>
      <p>
        Load missing Price, Annual and Filings sources once, one at a time.
        Loaded responses keep their original dates and are not refreshed.
        Unsupported sources are skipped. Opening this view makes no request.
      </p>
      <p>
        A failed or deferred load stops the remaining sources. Annual and
        Filings share SEC request limits; a later explicit load may be needed.
        Inspect each source for its availability and qualifications.
      </p>
      <div className="trial-actions">
        <button
          disabled={navigationPending || state.running}
          onClick={() => void onLoad()}
        >
          {state.running
            ? "Loading company sources…"
            : "Load missing company sources"}
        </button>
        {state.running && (
          <button className="trial-secondary" onClick={onCancel}>
            Cancel company source load
          </button>
        )}
      </div>
      {state.message && (
        <p role="status" aria-live="polite">
          {state.message}
        </p>
      )}
    </section>
  );
}
