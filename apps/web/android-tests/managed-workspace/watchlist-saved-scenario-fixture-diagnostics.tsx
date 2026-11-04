import { useRef, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { WatchlistSavedScenarioFixture } from "./watchlist-saved-scenario-fixture";
export function WatchlistSavedScenarioDiagnostics({
  workspace: w,
  fixture,
}: {
  workspace: ManagedWorkspace;
  fixture: WatchlistSavedScenarioFixture;
}) {
  const counts = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot),
    group = useSyncExternalStore(
      w.filingsReview.subscribe,
      w.filingsReview.getSnapshot,
    ),
    review = useSyncExternalStore(
      w.watchlistValuationReview.subscribe,
      w.watchlistValuationReview.getSnapshot,
    ),
    valuations = useSyncExternalStore(
      w.valuationAssumptions.coordinator.subscribe,
      w.valuationAssumptions.coordinator.getSnapshot,
    ),
    watchlist = useSyncExternalStore(
      w.coordinator.subscribe,
      w.coordinator.getSnapshot,
    ),
    followups = useSyncExternalStore(
      w.followups.coordinator.subscribe,
      w.followups.coordinator.getSnapshot,
    ),
    workbench = useSyncExternalStore(
      w.valuation.subscribe,
      w.valuation.getSnapshot,
    ),
    view = useSyncExternalStore(w.subscribe, w.getSnapshot);
  const original = useRef(fixture.saved());
  const observed = useRef({
    reading: review.reading,
    calculation: workbench.calculation,
    evaluations: 0,
    calculations: 0,
  });
  if (observed.current.reading !== review.reading) {
    observed.current.reading = review.reading;
    if (review.reading) observed.current.evaluations++;
  }
  if (observed.current.calculation !== workbench.calculation) {
    observed.current.calculation = workbench.calculation;
    if (workbench.calculation) observed.current.calculations++;
  }
  return (
    <pre id="fixture-watchlist-saved-scenario" hidden>
      {JSON.stringify({
        counts,
        group,
        review,
        valuations,
        watchlist,
        followups,
        workbench,
        view,
        original: original.current,
        saved: fixture.saved(),
        evaluations: observed.current.evaluations,
        calculations: observed.current.calculations,
      })}
    </pre>
  );
}
