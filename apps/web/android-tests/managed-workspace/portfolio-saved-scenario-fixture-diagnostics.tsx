import { useRef, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { PortfolioSavedScenarioFixture } from "./portfolio-saved-scenario-fixture";
export function PortfolioSavedScenarioDiagnostics({
  workspace: w,
  fixture,
}: {
  workspace: ManagedWorkspace;
  fixture: PortfolioSavedScenarioFixture;
}) {
  const counts = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot),
    review = useSyncExternalStore(
      w.portfolioValuationReview.model.subscribe,
      w.portfolioValuationReview.model.getSnapshot,
    ),
    valuations = useSyncExternalStore(
      w.valuationAssumptions.coordinator.subscribe,
      w.valuationAssumptions.coordinator.getSnapshot,
    ),
    portfolio = useSyncExternalStore(
      w.portfolio.coordinator.subscribe,
      w.portfolio.coordinator.getSnapshot,
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
    <pre id="fixture-portfolio-saved-scenario" hidden>
      {JSON.stringify({
        counts,
        closeDate: fixture.closeDate,
        portfolio,
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
