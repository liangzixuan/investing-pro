import { registerPlugin } from "@capacitor/core";
import { useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import type { TrialSession } from "../../src/clerk-trial/session";
import {
  createNativeWatchlistDraftFileAdapter,
  type InvestmentWatchlistDraftFilePlugin,
} from "../../src/clerk-trial/native-watchlist-draft-file";

/** Test-APK-only observation of the real draft writer. No URI or account data is exposed. */
export function createNativeDraftFileFixture(
  plugin = registerPlugin<InvestmentWatchlistDraftFilePlugin>(
    "InvestmentWatchlistDraftFile",
  ),
) {
  let retireOnChoose: (() => void) | null = null;
  let sessionNumber = 0;
  let state = { choices: 0, writes: 0, text: "" };
  const listeners = new Set<() => void>();
  const publish = (change: Partial<typeof state>) => {
    state = { ...state, ...change };
    listeners.forEach((listener) => listener());
  };
  const delivery = createNativeWatchlistDraftFileAdapter({
    choose(options) {
      const pending = plugin.choose(options);
      publish({ choices: state.choices + 1 });
      retireOnChoose?.();
      retireOnChoose = null;
      return pending;
    },
    async write(options) {
      const result = await plugin.write(options);
      publish({ writes: state.writes + 1, text: options.text });
      return result;
    },
    cancel: (options) => plugin.cancel(options),
  });
  const armRetirement = (retire: () => void) => {
    retireOnChoose = retire;
  };
  function Controls({
    workspace,
    session,
    onFreshSession,
  }: {
    workspace: ManagedWorkspace;
    session: TrialSession;
    onFreshSession: (session: TrialSession) => void;
  }) {
    const diagnostics = useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => state,
    );
    return (
      <aside aria-label="Invented native draft file controls">
        <p>
          Invented data only. File selection uses the external system picker.
        </p>
        <pre id="fixture-draft-file-protocol">
          {JSON.stringify(diagnostics)}
        </pre>
        <button
          id="fixture-draft-file-fresh-session"
          onClick={() =>
            onFreshSession({
              ...session,
              sessionId: `invented-draft-file-session-${++sessionNumber}`,
            })
          }
        >
          Reopen the invented account with a fresh saved read
        </button>
        <button
          id="fixture-draft-file-other-account"
          onClick={() =>
            onFreshSession({
              ...session,
              userId: "invented-draft-file-other-account",
              sessionId: `invented-draft-file-session-${++sessionNumber}`,
            })
          }
        >
          Open a different invented account
        </button>
        <button
          id="fixture-draft-file-retire"
          onClick={() => armRetirement(() => workspace.coordinator.retire())}
        >
          Retire the invented session during the next draft chooser
        </button>
      </aside>
    );
  }
  return { delivery, Controls, getSnapshot: () => state, armRetirement };
}
