import { useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { PortfolioReportComparisonFixture } from "./portfolio-report-comparison-fixture";
import type { createNativePortfolioReviewReportFixture } from "./native-portfolio-review-report-fixture";
import { portfolioComparisonNote } from "./portfolio-report-comparison-fixture-data";

export function PortfolioReportComparisonFixtureControls({
  workspace,
  fixture,
  delivery,
}: {
  workspace: ManagedWorkspace;
  fixture: PortfolioReportComparisonFixture;
  delivery: ReturnType<typeof createNativePortfolioReviewReportFixture>;
}) {
  const counts = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot);
  const file = useSyncExternalStore(delivery.subscribe, delivery.getSnapshot);
  const saved = useSyncExternalStore(
    workspace.portfolio.coordinator.subscribe,
    workspace.portfolio.coordinator.getSnapshot,
  );
  const local = useSyncExternalStore(
    workspace.portfolio.subscribe,
    workspace.portfolio.getSnapshot,
  );
  const watchlist = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
  );
  const view = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const eod = useSyncExternalStore(
    workspace.eod.subscribe,
    workspace.eod.getSnapshot,
  );
  const [authored, setAuthored] = useState(false),
    [observed, setObserved] = useState(false);
  const retained = useRef<{
    draft: typeof saved.draft;
    saved: typeof saved.saved;
    base: typeof saved.baseVersion;
    note: typeof watchlist.draft;
  } | null>(null);
  return (
    <aside aria-label="Invented saved Portfolio comparison observations">
      <button
        id="fixture-portfolio-comparison-author"
        disabled={authored || !saved.draft?.ledger || !watchlist.draft}
        onClick={() => {
          workspace.note("listing-zero", portfolioComparisonNote);
          setAuthored(true);
        }}
      >
        Author independent invented comparison note
      </button>
      <button
        id="fixture-portfolio-comparison-change"
        disabled={
          !authored || counts.current || counts.eod !== 3 || file.writes !== 1
        }
        onClick={() => {
          const draft = workspace.portfolio.coordinator.getSnapshot().draft;
          if (!draft?.ledger)
            throw new Error(
              "Invented Portfolio comparison current setup refused",
            );
          workspace.portfolio.replace(draft, fixture.current.payload);
          fixture.changeCurrent();
        }}
      >
        Author changed invented current holdings
      </button>
      <button
        id="fixture-portfolio-comparison-observe"
        disabled={
          !counts.current || counts.eod !== 5 || !saved.dirty || observed
        }
        onClick={() => {
          retained.current = {
            draft: saved.draft,
            saved: saved.saved,
            base: saved.baseVersion,
            note: watchlist.draft,
          };
          setObserved(true);
        }}
      >
        Retain invented comparison draft observations
      </button>
      <pre id="fixture-portfolio-report-comparison" hidden>
        {JSON.stringify({
          counts,
          file,
          authored,
          observed,
          portfolio: {
            phase: saved.phase,
            baseVersion: saved.baseVersion,
            dirty: saved.dirty,
            ledger: saved.draft?.ledger,
            saved: saved.saved,
            projection: workspace.portfolio.getProjection(),
            pendingEditor: local.pendingEditor,
          },
          watchlist: {
            baseVersion: watchlist.baseVersion,
            dirty: watchlist.dirty,
            draft: watchlist.draft,
          },
          research: view.research,
          section: view.research?.section,
          view: view.view,
          eod,
          baseline: fixture.baseline.payload,
          expectedCurrent: fixture.current.payload,
          observedDate: fixture.observedDate,
          canonical: JSON.stringify(saved.draft?.ledger),
          sameDraft: retained.current?.draft === saved.draft,
          sameSaved: retained.current?.saved === saved.saved,
          sameBase: retained.current?.base === saved.baseVersion,
          sameWatchlist: retained.current?.note === watchlist.draft,
        })}
      </pre>
    </aside>
  );
}
