import { useRef, useState, useSyncExternalStore } from "react";
import {
  encodeResearchFollowupsPayload,
  encodePortfolioPayload,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { ReviewFilingsEvidenceFixture } from "./review-filings-evidence-fixture";
import { reviewFilingsExpected } from "./review-filings-evidence-fixture-data";
export function ReviewFilingsEvidenceFixtureControls({
  workspace,
  fixture,
}: {
  workspace: ManagedWorkspace;
  fixture: ReviewFilingsEvidenceFixture;
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
    retainedFilings = useSyncExternalStore(
      workspace.reviewFilings.subscribe,
      workspace.reviewFilings.getSnapshot,
    ),
    companyFilings = useSyncExternalStore(
      workspace.filings.subscribe,
      workspace.filings.getSnapshot,
    ),
    view = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const packetReferences = useRef(new Map<string, unknown>());
  for (const row of retainedFilings.rows)
    if (row.filings.response && !packetReferences.current.has(row.entry.id))
      packetReferences.current.set(row.entry.id, row.filings.response);
  const [observed, setObserved] = useState(false);
  const baseline = useRef<{
    portfolio: typeof p;
    watchlist: ReturnType<typeof workspace.coordinator.getSnapshot>;
    valuation: ReturnType<
      typeof workspace.valuationAssumptions.coordinator.getSnapshot
    >;
  } | null>(null);
  return (
    <aside aria-label="Invented retained-review filing observations">
      <button
        id="fixture-review-filings-observe"
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
      <pre id="fixture-review-filings-evidence" hidden>
        {JSON.stringify({
          counts,
          retainedFilings,
          sameRetainedPackets: retainedFilings.rows.every(
            (row) =>
              !row.filings.response ||
              packetReferences.current.get(row.entry.id) ===
                row.filings.response,
          ),
          companyFilings,
          expectedPackets: fixture.packets,
          sources: {
            eod: workspace.eod.getSnapshot(),
            annual: workspace.annual.getSnapshot(),
            filings: workspace.filings.getSnapshot(),
            interim: workspace.interim.getSnapshot(),
          },
          day: fixture.day,
          original: fixture.original,
          expected: reviewFilingsExpected(fixture.original, fixture.day),
          expectedCanonical: encodeResearchFollowupsPayload(
            reviewFilingsExpected(fixture.original, fixture.day),
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
