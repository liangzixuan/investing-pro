import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import {
  fixture,
  nativeFollowupsReviewReport,
} from "./native-fixture-environment";
import {
  authorInventedFollowupsReviewReport,
  inventedFollowupsReportPayload,
} from "./native-followups-review-report-fixture";

export function FollowupsReviewReportFixtureControls({
  workspace,
}: {
  workspace: ManagedWorkspace;
}) {
  const report = nativeFollowupsReviewReport!;
  const state = useSyncExternalStore(report.subscribe, report.getSnapshot);
  const draft = useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
  );
  return (
    <aside aria-label="Invented Follow-ups report setup">
      <p>
        Test-only authored setup through the real draft model. No source read or
        Save.
      </p>
      <button
        id="fixture-followups-report-author"
        disabled={
          draft.phase !== "idle" ||
          draft.baseVersion !== 0 ||
          draft.dirty ||
          draft.draft?.entries.length !== 0
        }
        onClick={() => {
          authorInventedFollowupsReviewReport(workspace, fixture);
        }}
      >
        Author invented follow-ups report
      </button>
      <pre id="fixture-followups-report" hidden>
        {JSON.stringify(state)}
      </pre>
      <pre id="fixture-followups-report-original" hidden>
        {JSON.stringify(inventedFollowupsReportPayload(fixture))}
      </pre>
    </aside>
  );
}
