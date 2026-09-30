import { registerPlugin } from "@capacitor/core";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ClerkTrialConfig } from "./config";
import { validateTrialConfig } from "./config";
import { NativeTrialSessionStore } from "./native-session";
import type { InvestmentAuthPlugin } from "./native-session";
import { TrialFrame } from "./TrialFrame";
import { TrialSessionScreen } from "./TrialScreen";

export function NativeTrialApp({ config }: { config: ClerkTrialConfig }) {
  const checked = validateTrialConfig(config);
  const [store, setStore] = useState<NativeTrialSessionStore | null>(null);
  useEffect(() => {
    const next = new NativeTrialSessionStore(
      registerPlugin<InvestmentAuthPlugin>("InvestmentAuth"),
    );
    setStore(next);
    void next.start();
    return () => next.dispose();
  }, []);
  return store ? (
    <NativeSession store={store} apiOrigin={checked.apiOrigin} />
  ) : (
    <TrialFrame>
      <p role="status">Checking the installed session…</p>
    </TrialFrame>
  );
}

function NativeSession({
  store,
  apiOrigin,
}: {
  store: NativeTrialSessionStore;
  apiOrigin: string;
}) {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const session = store.session();
  return (
    <TrialFrame>
      {session ? (
        <>
          {state.message && (
            <p role="status" className="trial-status">
              {state.message}
            </p>
          )}
          <TrialSessionScreen
            key={state.auth.generation}
            apiOrigin={apiOrigin}
            session={session}
          />
        </>
      ) : (
        <section
          className="trial-panel"
          aria-labelledby="native-sign-in-heading"
        >
          <h2 id="native-sign-in-heading">Sign in on this device</h2>
          <p role="status">
            {state.message ||
              (state.auth.status === "loading"
                ? "Checking your session…"
                : "Use the secure Clerk sign-in flow to join the trial.")}
          </p>
          <button
            type="button"
            disabled={state.busy || state.auth.status === "loading"}
            onClick={() => {
              void store.signIn();
            }}
          >
            {state.signOutUnconfirmed ? "Sign in again" : "Sign in with Clerk"}
          </button>
        </section>
      )}
    </TrialFrame>
  );
}
