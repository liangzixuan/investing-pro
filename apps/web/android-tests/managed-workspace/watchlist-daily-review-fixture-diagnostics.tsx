import { useRef, useSyncExternalStore } from "react";
import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { WatchlistDailyReviewFixture } from "./watchlist-daily-review-fixture";
import {
  dailyDueOn,
  dailyQuestion,
  dailyQuestionCheck,
  dailyReviewExpected,
} from "./watchlist-daily-review-fixture-data";
import {
  reviewFilingsCitation,
  reviewFilingsRaw,
  reviewFilingsResult,
} from "./review-filings-evidence-fixture-data";
export function WatchlistDailyReviewFixtureDiagnostics({
  workspace,
  fixture,
}: {
  workspace: ManagedWorkspace;
  fixture: WatchlistDailyReviewFixture;
}) {
  const counts = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot),
    group = useSyncExternalStore(
      workspace.filingsReview.subscribe,
      workspace.filingsReview.getSnapshot,
    );
  const watchlist = useSyncExternalStore(
      workspace.coordinator.subscribe,
      workspace.coordinator.getSnapshot,
    ),
    followups = useSyncExternalStore(
      workspace.followups.coordinator.subscribe,
      workspace.followups.coordinator.getSnapshot,
    );
  const view = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot),
    price = useSyncExternalStore(
      workspace.eod.subscribe,
      workspace.eod.getSnapshot,
    ),
    filings = useSyncExternalStore(
      workspace.filings.subscribe,
      workspace.filings.getSnapshot,
    );
  const retained = useRef(
    new Map<string, { price: unknown; filings: unknown }>(),
  );
  let samePackets = true;
  for (const row of group.rows) {
    if (!row.price?.response || !row.filings.response) continue;
    const old = retained.current.get(row.member.listing.listingId);
    if (
      old &&
      (old.price !== row.price.response || old.filings !== row.filings.response)
    )
      samePackets = false;
    if (!old)
      retained.current.set(row.member.listing.listingId, {
        price: row.price.response,
        filings: row.filings.response,
      });
  }
  const created = followups.draft?.entries.find(
    (entry) =>
      !fixture.data.original.entries.some((old) => old.id === entry.id),
  );
  return (
    <pre id="fixture-watchlist-daily-review" hidden>
      {JSON.stringify({
        counts,
        group,
        watchlist,
        followups,
        view,
        price,
        filings,
        samePackets,
        day: fixture.day,
        original: fixture.data.original,
        originalWatchlist: fixture.data.watchlist,
        packets: fixture.packets,
        checks: workspace.getWatchlistDailyChecks(),
        raw: reviewFilingsRaw[1],
        citation: reviewFilingsCitation(1),
        result: reviewFilingsResult(1),
        question: dailyQuestion,
        dueOn: dailyDueOn,
        questionCheck: dailyQuestionCheck,
        canonical: followups.draft
          ? encodeResearchFollowupsPayload(followups.draft)
          : null,
        expectedCanonical: created
          ? encodeResearchFollowupsPayload(
              dailyReviewExpected(
                fixture.data.original,
                fixture.day,
                created.id,
              ),
            )
          : null,
        watchlistCanonical: watchlist.draft
          ? encodeMainWatchlistPayload(watchlist.draft)
          : null,
      })}
    </pre>
  );
}
