import { useSyncExternalStore } from "react";
import { nativeScreenPassReviewReport } from "./native-fixture-environment";
/** Observes transport metadata only; product controls perform every operation. */
export function ScreenPassReviewReportFixtureControls() {
  const report = nativeScreenPassReviewReport!;
  const state = useSyncExternalStore(report.subscribe, report.getSnapshot);
  return (
    <pre id="fixture-screen-pass-review-report" hidden>
      {JSON.stringify(state)}
    </pre>
  );
}
