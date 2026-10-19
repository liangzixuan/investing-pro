import type { ReactElement } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { TrialSession } from "../../src/clerk-trial/session";
import type { ManagedWatchlistDraftFileDeliveryAdapter } from "../../src/clerk-trial/managed-watchlist-draft-file-delivery";
import { createManagedWatchlistDraftAccountScope } from "../../src/clerk-trial/managed-watchlist-draft-recovery";
import type { createNativeDraftFileFixture } from "./native-draft-file-fixture";

interface SessionControlsProps {
  readonly workspace: ManagedWorkspace | null;
  readonly onFreshSession: (session: TrialSession) => void;
}
interface DraftFileSession {
  readonly routerProps: {
    readonly draftFileScope?: Promise<string>;
    readonly draftFileDelivery?: ManagedWatchlistDraftFileDeliveryAdapter;
  };
  readonly Controls: (props: SessionControlsProps) => ReactElement | null;
}
function EmptyControls() {
  return null;
}

/** Construct once per keyed account session; neither scope nor bridge options are shared across it. */
export function createNativeDraftFileSession(
  fixture: ReturnType<typeof createNativeDraftFileFixture> | null,
  session: TrialSession,
): DraftFileSession {
  if (!fixture) return { routerProps: {}, Controls: EmptyControls };
  const NativeControls = fixture.Controls;
  const draftFileScope = createManagedWatchlistDraftAccountScope(
    "https://fixture.invalid",
    session.userId,
  );
  function Controls({ workspace, onFreshSession }: SessionControlsProps) {
    if (!workspace) return null;
    return (
      <NativeControls
        workspace={workspace}
        session={session}
        onFreshSession={onFreshSession}
      />
    );
  }
  return {
    routerProps: { draftFileScope, draftFileDelivery: fixture.delivery },
    Controls,
  };
}
