import { useSyncExternalStore } from "react";
import { nativeWatchlistResearchReport } from "./native-fixture-environment";
/** Observes transport metadata only; product controls perform every operation. */
export function WatchlistResearchReportFixtureControls() {
  const report = nativeWatchlistResearchReport!;
  const state = useSyncExternalStore(report.subscribe, report.getSnapshot);
  return (
    <pre id="fixture-watchlist-research-report" hidden>
      {JSON.stringify(state)}
    </pre>
  );
}
