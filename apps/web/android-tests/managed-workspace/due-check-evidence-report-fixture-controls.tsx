import { useSyncExternalStore } from "react";
import { nativeDueCheckEvidenceReport } from "./native-fixture-environment";
/** Observes transport metadata only; product controls perform every operation. */
export function DueCheckEvidenceReportFixtureControls() {
  const report = nativeDueCheckEvidenceReport!;
  const state = useSyncExternalStore(report.subscribe, report.getSnapshot);
  return (
    <pre id="fixture-due-check-evidence-report" hidden>
      {JSON.stringify(state)}
    </pre>
  );
}
