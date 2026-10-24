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
function useFollowupsControls(workspace: ManagedWorkspace) {
  const controls = fixture.followups!;
  const state = useSyncExternalStore(controls.subscribe, controls.getSnapshot);
  const draft = useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
  );
  const local = useSyncExternalStore(
    workspace.followups.subscribe,
    workspace.followups.getSnapshot,
  );
  const owner = useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
  );

  return { controls, state, draft, local, owner };
}
function FollowupsDiagnostics({
  state,
  draft,
  local,
  owner,
}: ReturnType<typeof useFollowupsControls>) {
  return (
    <>
      <pre
        id="fixture-followups-diagnostics"
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        {JSON.stringify(state)}
      </pre>
      <pre
        id="fixture-followups-draft"
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        {JSON.stringify({
          session: state.session,
          owner: owner.phase,
          phase: draft.phase,
          baseVersion: draft.baseVersion,
          dirty: draft.dirty,
          conflict: draft.conflict,
          uncertain: draft.uncertain,
          replayPending: draft.replayPending,
          selectedId: local.selectedId,
          filter: local.filter,
          entries: draft.draft?.entries ?? null,
          saved: draft.saved ?? null,
        })}
      </pre>
    </>
  );
}
function FollowupsActions({
  controls,
  state,
  workspace,
  onFreshSession,
}: ReturnType<typeof useFollowupsControls> & Props) {
  return (
    <>
      <button
        id="fixture-followups-settle"
        disabled={state.held === 0}
        onClick={() => controls.settleHeld()}
      >
        Settle oldest invented follow-up reply
      </button>
      <button
        id="fixture-followups-fresh-session"
        disabled={state.session >= 8 || Boolean(fixture.portfolio)}
        onClick={() => {
          workspace.sessionOwner.dispose();
          history.replaceState(null, "", "/");
          onFreshSession(controls.nextSession());
        }}
      >
        Start fresh invented session
      </button>
    </>
  );
}
export function FollowupsFixtureControls({ workspace, onFreshSession }: Props) {
  const values = useFollowupsControls(workspace);
  const { controls, state } = values;
  return (
    <aside aria-label="Invented follow-up controls">
      <h2>Invented follow-up controls</h2>
      <p>
        RAM only. A held Save commits immediately and delays only its
        acknowledgement. Starting a fresh session discards both local drafts;
        the independent saved stores remain.
      </p>
      <FollowupsDiagnostics {...values} />
      <FixtureReadControl
        id="fixture-followups-next-read"
        label="Next invented follow-up read"
        value={state.nextRead}
        onChange={(value) =>
          controls.setNextRead(
            value as Parameters<typeof controls.setNextRead>[0],
          )
        }
      />
      <FixtureSaveControl
        id="fixture-followups-next-save"
        label="Next invented follow-up Save"
        value={state.nextSave}
        onChange={(value) =>
          controls.setNextSave(
            value as Parameters<typeof controls.setNextSave>[0],
          )
        }
      />
      <FollowupsActions
        {...values}
        workspace={workspace}
        onFreshSession={onFreshSession}
      />
    </aside>
  );
}
