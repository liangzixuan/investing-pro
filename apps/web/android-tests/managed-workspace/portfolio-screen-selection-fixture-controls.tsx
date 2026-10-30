import { useRef, useState, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { PortfolioScreenSelectionFixture } from "./portfolio-screen-selection-fixture";

export function PortfolioScreenSelectionFixtureControls({
  workspace,
  fixture,
}: {
  workspace: ManagedWorkspace;
  fixture: PortfolioScreenSelectionFixture;
}) {
  const counts = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot);
  const saved = useSyncExternalStore(
    workspace.portfolio.coordinator.subscribe,
    workspace.portfolio.coordinator.getSnapshot,
  );
  const local = useSyncExternalStore(
    workspace.portfolio.subscribe,
    workspace.portfolio.getSnapshot,
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
  return (
    <aside aria-label="Invented held-company screening observations">
      <button
        id="fixture-portfolio-screen-author"
        disabled={
          authored ||
          !saved.draft?.ledger ||
          !workspace.portfolio.canSavePayload()
        }
        onClick={() => {
          const draft = workspace.portfolio.coordinator.getSnapshot().draft;
          if (!draft?.ledger)
            throw new Error("Invented held-company draft setup refused");
          workspace.portfolio.replace(draft, {
            ...draft.ledger,
            opening: { ...draft.ledger.opening, cashUsd: "1500.00" },
          });
          if (
            workspace.portfolio.coordinator.getSnapshot().draft?.ledger?.opening
              .cashUsd !== "1500.00"
          )
            throw new Error("Invented held-company cash setup refused");
          setAuthored(true);
        }}
      >
        Author independent invented Portfolio cash
      </button>
      <button
        id="fixture-portfolio-screen-capture"
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
        Capture invented Portfolio and criteria observations
      </button>
      <button
        id="fixture-portfolio-screen-capture-run"
        disabled={screen.run?.status !== "completed" || capturedRun}
        onClick={() => {
          run.current = screen.run;
          setCapturedRun(true);
        }}
      >
        Capture invented completed source observations
      </button>
      <pre id="fixture-portfolio-screen-selection" hidden>
        {JSON.stringify({
          counts,
          authored,
          captured,
          capturedRun,
          portfolio: {
            phase: saved.phase,
            baseVersion: saved.baseVersion,
            dirty: saved.dirty,
            ledger: saved.draft?.ledger,
            saved: saved.saved,
            projection: workspace.portfolio.getProjection(),
            pendingEditor: local.pendingEditor,
          },
          canonical: JSON.stringify(saved.draft?.ledger),
          expectedCanonical: JSON.stringify({
            ...fixture.loaded.payload,
            opening: { ...fixture.loaded.payload.opening, cashUsd: "1500.00" },
          }),
          sameDraft: baseline.current?.draft === saved.draft,
          sameSaved: baseline.current?.saved === saved.saved,
          sameBase: baseline.current?.base === saved.baseVersion,
          sameDirty: baseline.current?.dirty === saved.dirty,
          sameCriteria:
            baseline.current?.criteria === screen.criteria &&
            baseline.current?.revision === screen.criteriaRevision,
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
                response: row.report?.response,
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
