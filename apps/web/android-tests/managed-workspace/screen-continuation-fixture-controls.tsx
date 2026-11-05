import { useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";

/** Passive observations of real workspace actions; capture never changes product state. */
export function ScreenContinuationFixtureControls({
  workspace,
}: {
  workspace: ManagedWorkspace;
}) {
  const screen = useSyncExternalStore(
    workspace.financialScreen.subscribe,
    workspace.financialScreen.getSnapshot,
  );
  const saved = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
  );
  const before = useRef<typeof screen | null>(null);
  const after = useRef<typeof screen | null>(null);
  const resource = useRef<typeof saved | null>(null);
  const [captured, setCaptured] = useState(false);
  const [applied, setApplied] = useState(false);
  const serialize = (state: typeof screen | null) =>
    state && {
      criteria: state.criteria,
      criteriaStaged: state.criteriaStaged,
      shortlist: state.shortlist.map((r) => r.member.listing.listingId),
      comparison: {
        left: state.comparison.left?.member.listing.listingId ?? null,
        right: state.comparison.right?.member.listing.listingId ?? null,
      },
      run: state.run && {
        startedAt: state.run.startedAt,
        completedAt: state.run.completedAt,
        status: state.run.status,
        refinedAt: state.run.refinedAt ?? null,
        continuations: state.run.continuations ?? [],
        criteria: state.run.criteria,
        rows: state.run.rows.map((row) => ({
          listing: row.member.listing,
          failure: row.failure,
          response: row.report?.response ?? null,
          evaluation: row.evaluation,
        })),
      },
    };
  return (
    <aside aria-label="Invented retained-screen observations">
      <button
        id="fixture-continuation-capture-before"
        disabled={captured || screen.run?.status !== "cancelled"}
        onClick={() => {
          before.current = screen;
          resource.current = saved;
          setCaptured(true);
        }}
      >
        Capture original invented screen
      </button>
      <button
        id="fixture-continuation-capture-after"
        disabled={
          !captured ||
          applied ||
          !screen.run?.rows.every((row) => row.report?.response)
        }
        onClick={() => {
          after.current = screen;
          setApplied(true);
        }}
      >
        Capture continued invented screen
      </button>
      <pre id="fixture-screen-continuation" hidden>
        {JSON.stringify({
          captured,
          applied,
          original: serialize(before.current),
          after: serialize(after.current),
          current: serialize(screen),
          sameOriginalRun:
            !!before.current && before.current.run === screen.run,
          sameAppliedRun: !!after.current && after.current.run === screen.run,
          sameSourceHandle:
            !!before.current &&
            before.current.run?.handle === screen.run?.handle,
          sameRetainedReports:
            !!before.current?.run &&
            before.current.run.rows.every(
              (row, i) =>
                row.report === null ||
                row.report === screen.run?.rows[i]?.report,
            ),
          sameOriginalComparison:
            !!before.current && before.current.comparison === screen.comparison,
          sameOriginalShortlist:
            !!before.current && before.current.shortlist === screen.shortlist,
          sameResource: !!resource.current && resource.current === saved,
        })}
      </pre>
    </aside>
  );
}
