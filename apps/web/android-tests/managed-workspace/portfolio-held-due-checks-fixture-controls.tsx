import { useRef, useState, useSyncExternalStore } from "react";
import {
  encodeResearchFollowupsPayload,
  encodePortfolioPayload,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { PortfolioHeldDueChecksFixture } from "./portfolio-held-due-checks-fixture";
import { heldDueExpected } from "./portfolio-held-due-checks-fixture-data";
export function PortfolioHeldDueChecksFixtureControls({
  workspace,
  fixture,
}: {
  workspace: ManagedWorkspace;
  fixture: PortfolioHeldDueChecksFixture;
}) {
  const counts = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot),
    p = useSyncExternalStore(
      workspace.portfolio.coordinator.subscribe,
      workspace.portfolio.coordinator.getSnapshot,
    ),
    f = useSyncExternalStore(
      workspace.followups.coordinator.subscribe,
      workspace.followups.coordinator.getSnapshot,
    ),
    review = useSyncExternalStore(
      workspace.followupsReview.subscribe,
      workspace.followupsReview.getSnapshot,
    ),
    view = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const [observed, setObserved] = useState(false);
  const baseline = useRef<{
    portfolio: typeof p;
    watchlist: ReturnType<typeof workspace.coordinator.getSnapshot>;
    valuation: ReturnType<
      typeof workspace.valuationAssumptions.coordinator.getSnapshot
    >;
  } | null>(null);
  return (
    <aside aria-label="Invented held-due-check observations">
      <button
        id="fixture-held-due-observe"
        disabled={observed || !p.draft?.ledger || !f.draft}
        onClick={() => {
          baseline.current = {
            portfolio: workspace.portfolio.coordinator.getSnapshot(),
            watchlist: workspace.coordinator.getSnapshot(),
            valuation: workspace.valuationAssumptions.coordinator.getSnapshot(),
          };
          setObserved(true);
        }}
      >
        Capture invented independent draft observations
      </button>
      <pre id="fixture-portfolio-held-due-checks" hidden>
        {JSON.stringify({
          counts,
          sources: {
            eod: workspace.eod.getSnapshot(),
            annual: workspace.annual.getSnapshot(),
            filings: workspace.filings.getSnapshot(),
            interim: workspace.interim.getSnapshot(),
          },
          day: fixture.day,
          original: fixture.original,
          expected: heldDueExpected(fixture.original, fixture.day),
          expectedCanonical: encodeResearchFollowupsPayload(
            heldDueExpected(fixture.original, fixture.day),
          ),
          originalLedger: fixture.ledger.payload,
          portfolio: p,
          portfolioCanonical: p.draft?.ledger
            ? encodePortfolioPayload(p.draft.ledger)
            : null,
          followups: f,
          canonical: f.draft ? encodeResearchFollowupsPayload(f.draft) : null,
          review,
          view,
          observed,
          samePortfolio: baseline.current?.portfolio === p,
          sameWatchlist:
            baseline.current?.watchlist === workspace.coordinator.getSnapshot(),
          sameValuation:
            baseline.current?.valuation ===
            workspace.valuationAssumptions.coordinator.getSnapshot(),
        })}
      </pre>
    </aside>
  );
}
