import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { snapshotLoadingNote } from "./company-snapshot-loading-fixture";
import { fixture } from "./native-fixture-environment";

type Props = { workspace: ManagedWorkspace };
function useSnapshotFixtureObservations(workspace: ManagedWorkspace) {
  const draft = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
  );
  const price = useSyncExternalStore(
    workspace.eod.subscribe,
    workspace.eod.getSnapshot,
  );
  const annual = useSyncExternalStore(
    workspace.annual.subscribe,
    workspace.annual.getSnapshot,
  );
  const filings = useSyncExternalStore(
    workspace.filings.subscribe,
    workspace.filings.getSnapshot,
  );
  const counts = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot);
  return { draft, price, annual, filings, counts };
}
type Observations = ReturnType<typeof useSnapshotFixtureObservations>;
function canAuthorSnapshotNote({
  draft,
  counts,
}: Pick<Observations, "draft" | "counts">) {
  return (
    draft.baseVersion === 1 &&
    counts.eod === 0 &&
    counts.annual === 0 &&
    counts.filings === 0 &&
    draft.draft?.memberships[0]?.note !== snapshotLoadingNote
  );
}

/** Only the fixed invented scenario exposes a late-packet release and full evidence observations. */
export function CompanySnapshotLoadingFixtureControls({ workspace }: Props) {
  const { draft, price, annual, filings, counts } =
    useSnapshotFixtureObservations(workspace);
  const controls = fixture.companySnapshotLoading;
  if (!controls) return null;
  const canAuthor = canAuthorSnapshotNote({ draft, counts });
  return (
    <aside aria-label="Invented company snapshot loading controls">
      <button
        id="fixture-snapshot-author-note"
        disabled={!canAuthor}
        onClick={() => {
          if (canAuthor) workspace.note("listing-zero", snapshotLoadingNote);
        }}
      >
        Author invented snapshot research note
      </button>
      <button
        id="fixture-snapshot-settle-cancelled"
        disabled={
          counts.filingsAborted !== 1 || counts.filingsLateResolved !== 0
        }
        onClick={controls.settleCancelledFilings}
      >
        Settle cancelled invented snapshot Filings
      </button>
      <pre id="fixture-company-snapshot-evidence" hidden>
        {JSON.stringify({
          draft: draft.draft,
          price: price.response,
          annual: annual.response,
          filings: filings.response,
          filingsRunning: filings.running,
        })}
      </pre>
    </aside>
  );
}
