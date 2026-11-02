import { useSyncExternalStore } from "react";
import { nativeScreenResearchReport } from "./native-fixture-environment";
/** Observes transport metadata only; product controls perform every operation. */
export function ScreenResearchReportFixtureControls() {
  const report = nativeScreenResearchReport!;
  const state = useSyncExternalStore(report.subscribe, report.getSnapshot);
  return (
    <pre id="fixture-screen-research-report" hidden>
      {JSON.stringify(state)}
    </pre>
  );
}
