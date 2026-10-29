import { useSyncExternalStore } from "react";
import { encodeMainWatchlistPayload } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import {
  fixture,
  nativeScreenComparisonReport,
} from "./native-fixture-environment";

/** Invented diagnostics only; no test action changes the screen or writer. */
export function ScreenComparisonReportFixtureControls({
  workspace,
}: {
  workspace: ManagedWorkspace;
}) {
  const report = nativeScreenComparisonReport!;
  const metadata = fixture.screenComparisonReport!;
  const transport = useSyncExternalStore(report.subscribe, report.getSnapshot);
  const refused = useSyncExternalStore(
    metadata.subscribe,
    metadata.getSnapshot,
  );
  const draft = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
  );
  return (
    <aside aria-label="Invented comparison report diagnostics">
      <pre id="fixture-screen-comparison-report" hidden>
        {JSON.stringify({
          ...transport,
          refused,
          watchlist: {
            phase: draft.phase,
            dirty: draft.dirty,
            baseVersion: draft.baseVersion,
            canonical: draft.draft
              ? encodeMainWatchlistPayload(draft.draft)
              : null,
          },
        })}
      </pre>
      <pre id="fixture-screen-comparison-report-packets" hidden>
        {JSON.stringify(metadata.packets)}
      </pre>
    </aside>
  );
}
