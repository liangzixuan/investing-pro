import { useSyncExternalStore } from "react";
import { nativeWatchlistDailyReport } from "./native-fixture-environment";
/** Observes transport metadata only; product controls perform every operation. */
export function WatchlistDailyReportFixtureControls() {
  const report = nativeWatchlistDailyReport!;
  const state = useSyncExternalStore(report.subscribe, report.getSnapshot);
  return (
    <pre id="fixture-watchlist-daily-report" hidden>
      {JSON.stringify(state)}
    </pre>
  );
}
