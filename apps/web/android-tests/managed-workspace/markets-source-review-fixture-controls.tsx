import { useSyncExternalStore } from "react";
import { encodeMainWatchlistPayload } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import {
  sourceReviewNote,
  type SourceReviewFixtureControls,
} from "./markets-source-review-fixture";

/** Only fixed invented setup, read-only evidence and a cancelled late reply are exposed. */
export function MarketsSourceReviewFixtureControls({
  workspace,
  controls,
}: {
  workspace: ManagedWorkspace;
  controls: SourceReviewFixtureControls;
}) {
  const counts = useSyncExternalStore(controls.subscribe, controls.getSnapshot);
  const draft = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
  );
  const markets = useSyncExternalStore(
    workspace.markets.subscribe,
    workspace.markets.getSnapshot,
  );
  const review = useSyncExternalStore(
    workspace.marketsSourceReview.subscribe,
    workspace.marketsSourceReview.getSnapshot,
  );
  const bls = useSyncExternalStore(
    workspace.blsCalendar.subscribe,
    workspace.blsCalendar.getSnapshot,
  );
  const bea = useSyncExternalStore(
    workspace.agenda.subscribe,
    workspace.agenda.getSnapshot,
  );
  const fed = useSyncExternalStore(
    workspace.announcements.subscribe,
    workspace.announcements.getSnapshot,
  );
  const price = useSyncExternalStore(
    workspace.eod.subscribe,
    workspace.eod.getSnapshot,
  );
  return (
    <aside aria-label="Invented source review controls">
      <button
        id="fixture-source-review-author-note"
        disabled={draft.baseVersion !== 1 || draft.dirty}
        onClick={() => workspace.note("listing-zero", sourceReviewNote)}
      >
        Author independent invented source note
      </button>
      <button
        id="fixture-source-review-release-late"
        disabled={counts.aborted !== 1 || counts.late !== 0}
        onClick={controls.settleCancelledBls}
      >
        Settle cancelled invented BLS packet
      </button>
      <pre id="fixture-source-review-counts" hidden>
        {JSON.stringify(counts)}
      </pre>
      <pre id="fixture-source-review-evidence" hidden>
        {JSON.stringify({
          draft: draft.draft,
          encodedDraft: draft.draft
            ? encodeMainWatchlistPayload(draft.draft)
            : null,
          markets: markets.rows,
          selectedListingId: markets.selectedListingId,
          review,
          bls: bls.calendar,
          bea: bea.agenda,
          fed: fed.announcements,
          price: price.response,
        })}
      </pre>
    </aside>
  );
}
