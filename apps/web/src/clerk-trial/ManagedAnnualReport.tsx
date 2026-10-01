import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { SecAnnualEvidenceResult } from "../features/research/SecAnnualEvidenceResult";
import type { ManagedAnnualReport as AnnualReportModel } from "./managed-annual-report";

export function ManagedAnnualReport({
  model,
  onBack,
}: {
  model: AnnualReportModel;
  onBack: () => void;
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
            ? "Loading annual report…"
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
      </div>
      <p role={state.error ? "alert" : "status"} aria-live="polite">
        {state.message}
      </p>
      <p className="managed-annual-help">
        Loading leaves your watchlist unchanged. Cancel clears this screen's
        pending result; a request already admitted by the service may finish
        there.
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
