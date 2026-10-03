import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { SecAnnualEvidenceResult } from "../features/research/SecAnnualEvidenceResult";
import type { ManagedAnnualReport as AnnualReportModel } from "./managed-annual-report";

export function ManagedAnnualReport({
  model,
  onBack,
  onEodHistory,
}: {
  model: AnnualReportModel;
  onBack: () => void;
  onEodHistory: () => void;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const loadButton = useRef<HTMLButtonElement>(null);
  const restoreLoadFocus = useRef(false);
  useLayoutEffect(() => {
    if (state.selection) heading.current?.focus();
  }, [state.selection]);
  useLayoutEffect(() => {
    if (!state.running && restoreLoadFocus.current) {
      restoreLoadFocus.current = false;
      loadButton.current?.focus();
    }
  }, [state.running]);
  if (!state.selection) return null;
  const listing = state.selection.listing;
  return (
    <section
      className="trial-panel managed-annual-report"
      aria-labelledby="managed-annual-heading"
      aria-busy={state.running}
    >
      <div className="trial-toolbar">
        <h2 id="managed-annual-heading" ref={heading} tabIndex={-1}>
          Annual report · {listing.symbol}
        </h2>
        <button className="trial-secondary" onClick={onBack}>
          Back to workspace
        </button>
      </div>
      <p>
        {listing.issuerName} · {listing.securityName} · {listing.exchangeMic}
      </p>
      <p>
        Observed SEC annual revenue, net income and net margin in USD. Revenue
        concepts stay separate. This view covers the observed report in current
        submissions; it does not provide complete filing history or prices.
      </p>
      <div className="trial-actions">
        <button
          ref={loadButton}
          disabled={state.running || state.catalogChanged}
          onClick={() => void model.load()}
        >
          {state.running
            ? state.response
              ? "Refreshing annual report…"
              : "Loading annual report…"
            : state.response
              ? "Refresh annual report"
              : "Load annual report"}
        </button>
        {state.running && (
          <button
            className="trial-secondary"
            onClick={(event) => {
              restoreLoadFocus.current =
                document.activeElement === event.currentTarget;
              model.cancel();
            }}
          >
            Cancel annual report
          </button>
        )}
        <button
          className="trial-secondary"
          aria-label={`EOD close history for ${listing.symbol}`}
          disabled={state.catalogChanged}
          onClick={onEodHistory}
        >
          EOD close history
        </button>
      </div>
      <p role={state.error ? "alert" : "status"} aria-live="polite">
        {state.message}
      </p>
      {state.showingPrevious && state.response && (
        <p className="managed-annual-help">
          Showing the previous report, completed{" "}
          {state.response.evidence.generation.completedAt}. This refresh has not
          confirmed newer evidence. Source and observation times are unchanged.
        </p>
      )}
      <p className="managed-annual-help">
        Loading leaves your watchlist unchanged. Cancel stops this screen's
        pending load and keeps any previous report shown here. A request already
        admitted by the service may finish there.
      </p>
      {state.response && (
        <SecAnnualEvidenceResult
          key={state.response.evidence.generation.sha256}
          response={state.response}
        />
      )}
    </section>
  );
}
