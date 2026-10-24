import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import {
  fixture,
  nativePortfolioReviewReport,
} from "./native-fixture-environment";
import { authorInventedPortfolioReviewReportLedger } from "./native-portfolio-review-report-fixture";
export function PortfolioReviewReportFixtureControls({
  workspace,
}: {
  workspace: ManagedWorkspace;
}) {
  const report = nativePortfolioReviewReport!;
  const state = useSyncExternalStore(report.subscribe, report.getSnapshot);
  const draft = useSyncExternalStore(
    workspace.portfolio.coordinator.subscribe,
    workspace.portfolio.coordinator.getSnapshot,
  );
  return (
    <aside aria-label="Invented Portfolio report setup">
      <p>
        Test-only authored setup through the real ledger model. No source read
        or Save.
      </p>
      <button
        id="fixture-portfolio-report-author"
        disabled={
          draft.phase !== "idle" ||
          draft.baseVersion !== 0 ||
          draft.draft?.ledger !== null
        }
        onClick={() => {
          authorInventedPortfolioReviewReportLedger(workspace, fixture);
        }}
      >
        Author invented report ledger
      </button>
      <pre id="fixture-portfolio-report" hidden>
        {JSON.stringify(state)}
      </pre>
    </aside>
  );
}
