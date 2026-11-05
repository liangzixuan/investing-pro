import { useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { encodeMainWatchlistPayload } from "@research-cockpit/contracts";
import { watchlistScreenAuthoredNote } from "./watchlist-screen-selection-fixture";
import type { WatchlistScreenSelectionFixture } from "./watchlist-screen-selection-fixture";

export function WatchlistScreenSelectionFixtureControls({
  workspace,
  fixture,
}: {
  workspace: ManagedWorkspace;
  fixture: WatchlistScreenSelectionFixture;
}) {
  const counts = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot);
  const saved = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
  );
  const screen = useSyncExternalStore(
    workspace.financialScreen.subscribe,
    workspace.financialScreen.getSnapshot,
  );
  const view = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const annual = useSyncExternalStore(
    workspace.annual.subscribe,
    workspace.annual.getSnapshot,
  );
  const [authored, setAuthored] = useState(false),
    [captured, setCaptured] = useState(false),
    [capturedRun, setCapturedRun] = useState(false);
  const baseline = useRef<{
    draft: typeof saved.draft;
    saved: typeof saved.saved;
    base: typeof saved.baseVersion;
    dirty: boolean;
    criteria: typeof screen.criteria;
    revision: typeof screen.criteriaRevision;
  } | null>(null);
  const run = useRef<typeof screen.run>(null);
  const comparison = useRef<typeof screen.comparison | null>(null);
  const shortlist = useRef<typeof screen.shortlist | null>(null);
  return (
    <aside aria-label="Invented Watchlist-company screening observations">
      <button
        id="fixture-watchlist-screen-author"
        disabled={authored || !saved.draft || !workspace.canEdit()}
        onClick={() => {
          const draft = workspace.coordinator.getSnapshot().draft;
          if (!draft) throw new Error("Invented Watchlist draft setup refused");
          workspace.note(
            draft.memberships[0]!.listingId,
            watchlistScreenAuthoredNote,
          );
          if (
            workspace.coordinator.getSnapshot().draft?.memberships[0]?.note !==
            watchlistScreenAuthoredNote
          )
            throw new Error("Invented Watchlist note setup refused");
          setAuthored(true);
        }}
      >
        Author independent invented Watchlist note
      </button>
      <button
        id="fixture-watchlist-screen-capture"
        disabled={
          !authored ||
          !saved.dirty ||
          screen.memberships.length !== 18 ||
          screen.criteria.clauses.length !== 1 ||
          captured
        }
        onClick={() => {
          baseline.current = {
            draft: saved.draft,
            saved: saved.saved,
            base: saved.baseVersion,
            dirty: saved.dirty,
            criteria: screen.criteria,
            revision: screen.criteriaRevision,
          };
          setCaptured(true);
        }}
      >
        Capture invented Watchlist and criteria observations
      </button>
      <button
        id="fixture-watchlist-screen-capture-run"
        disabled={screen.run?.status !== "completed" || capturedRun}
        onClick={() => {
          run.current = screen.run;
          comparison.current = screen.comparison;
          shortlist.current = screen.shortlist;
          setCapturedRun(true);
        }}
      >
        Capture invented completed source observations
      </button>
      <pre id="fixture-watchlist-screen-selection" hidden>
        {JSON.stringify({
          counts,
          authored,
          captured,
          capturedRun,
          watchlist: {
            phase: saved.phase,
            baseVersion: saved.baseVersion,
            dirty: saved.dirty,
            draft: saved.draft,
            saved: saved.saved,
          },
          canonical: saved.draft
            ? encodeMainWatchlistPayload(saved.draft)
            : null,
          expectedCanonical: encodeMainWatchlistPayload({
            ...fixture.loaded.payload,
            memberships: fixture.loaded.payload.memberships.map((m, i) =>
              i === 0 ? { ...m, note: watchlistScreenAuthoredNote } : m,
            ),
          }),
          persisted: fixture.saved(),
          unrelatedUnloaded:
            workspace.portfolio.coordinator.getSnapshot().draft === null &&
            workspace.followups.coordinator.getSnapshot().draft === null &&
            workspace.valuationAssumptions.coordinator.getSnapshot().draft ===
              null,
          sameDraft: baseline.current?.draft === saved.draft,
          sameSaved: baseline.current?.saved === saved.saved,
          sameBase: baseline.current?.base === saved.baseVersion,
          sameDirty: baseline.current?.dirty === saved.dirty,
          sameCriteria:
            baseline.current?.criteria === screen.criteria &&
            baseline.current?.revision === screen.criteriaRevision,
          sameComparison:
            comparison.current !== null &&
            comparison.current === screen.comparison,
          sameShortlist:
            shortlist.current !== null &&
            shortlist.current === screen.shortlist,
          sameRun: run.current !== null && run.current === screen.run,
          sameResponses:
            run.current !== null &&
            run.current.rows.every(
              (row, index) =>
                row.report?.response ===
                screen.run?.rows[index]?.report?.response,
            ),
          screen: {
            active: screen.active,
            selected: screen.selected.map((member) => member.listing.listingId),
            memberships: screen.memberships.map((member) => member.listing),
            criteria: screen.criteria,
            pending: screen.pending,
            run: screen.run && {
              status: screen.run.status,
              startedAt: screen.run.startedAt,
              completedAt: screen.run.completedAt,
              rows: screen.run.rows.map((row) => ({
                listing: row.member.listing,
                response: row.report?.response ?? null,
                failure: row.failure,
                evaluation: row.evaluation,
              })),
            },
            shortlist: screen.shortlist.length,
            comparison: {
              left: !!screen.comparison.left,
              right: !!screen.comparison.right,
            },
          },
          expectedPackets: fixture.packets,
          research: view.research && {
            selection: view.research.selection,
            section: view.research.section,
          },
          annual: {
            responseOrigin: annual.responseOrigin,
            running: annual.running,
            response: annual.response,
            sameSeedContent:
              annual.response !== null &&
              JSON.stringify(annual.response) ===
                JSON.stringify(run.current?.rows[1]?.report?.response),
          },
        })}
      </pre>
    </aside>
  );
}
