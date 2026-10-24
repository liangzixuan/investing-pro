import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { TrialSession } from "../../src/clerk-trial/session";
import { fixture } from "./native-fixture-environment";
import {
  FixtureReadControl,
  FixtureSaveControl,
} from "./fixture-failure-select";
interface Props {
  workspace: ManagedWorkspace;
  onFreshSession: (session: TrialSession) => void;
}
function usePortfolioControls(workspace: ManagedWorkspace) {
  const controls = fixture.portfolio!;
  const state = useSyncExternalStore(controls.subscribe, controls.getSnapshot);
  const saved = useSyncExternalStore(
    workspace.portfolio.coordinator.subscribe,
    workspace.portfolio.coordinator.getSnapshot,
  );
  const local = useSyncExternalStore(
    workspace.portfolio.subscribe,
    workspace.portfolio.getSnapshot,
  );
  const owner = useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
  );

  return { controls, state, saved, local, owner };
}
function PortfolioDiagnostics({
  workspace,
  state,
  saved,
  local,
  owner,
}: ReturnType<typeof usePortfolioControls> & { workspace: ManagedWorkspace }) {
  return (
    <>
      <pre id="fixture-portfolio-state" hidden>
        {JSON.stringify(state)}
      </pre>
      <pre id="fixture-portfolio-draft" hidden>
        {JSON.stringify({
          owner: owner.phase,
          phase: saved.phase,
          baseVersion: saved.baseVersion,
          dirty: saved.dirty,
          conflict: saved.conflict,
          uncertain: saved.uncertain,
          replayPending: saved.replayPending,
          ledger: saved.draft?.ledger ?? null,
          saved: saved.saved,
          pendingEditor: local.pendingEditor,
          projection: workspace.portfolio.getProjection(),
        })}
      </pre>
    </>
  );
}
function PortfolioActions({
  controls,
  state,
  owner,
  onFreshSession,
}: ReturnType<typeof usePortfolioControls> & Props) {
  return (
    <>
      <button
        id="fixture-portfolio-settle"
        disabled={state.held === 0}
        onClick={() => controls.settleHeld()}
      >
        Settle oldest invented Portfolio reply
      </button>
      <button
        id="fixture-portfolio-fresh-session"
        disabled={owner.phase !== "retired" || state.session >= 8}
        onClick={() => {
          history.replaceState(null, "", "/");
          onFreshSession(controls.nextSession());
        }}
      >
        Start fresh invented Portfolio session
      </button>
    </>
  );
}
export function PortfolioFixtureControls({ workspace, onFreshSession }: Props) {
  const values = usePortfolioControls(workspace);
  const { controls, state } = values;
  return (
    <aside aria-label="Invented Portfolio controls">
      <h2>Invented Portfolio controls</h2>
      <p>
        Invented RAM records only. A held Save commits before its
        acknowledgement.
      </p>
      <PortfolioDiagnostics {...values} workspace={workspace} />
      <FixtureReadControl
        id="fixture-portfolio-next-read"
        label="Next invented Portfolio read"
        value={state.nextRead}
        onChange={(value) =>
          controls.setNextRead(
            value as Parameters<typeof controls.setNextRead>[0],
          )
        }
      />
      <FixtureSaveControl
        id="fixture-portfolio-next-save"
        label="Next invented Portfolio Save"
        value={state.nextSave}
        onChange={(value) =>
          controls.setNextSave(
            value as Parameters<typeof controls.setNextSave>[0],
          )
        }
      />
      <PortfolioActions
        {...values}
        workspace={workspace}
        onFreshSession={onFreshSession}
      />
    </aside>
  );
}
