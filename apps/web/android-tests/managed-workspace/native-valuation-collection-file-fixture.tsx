import { registerPlugin } from "@capacitor/core";
import { useSyncExternalStore, type ReactElement } from "react";
import type { TrialSession } from "../../src/clerk-trial/session";
import {
  createNativeValuationCollectionDraftFileAdapter,
  type InvestmentValuationCollectionDraftFilePlugin,
  type ManagedValuationCollectionDraftFileDeliveryAdapter,
} from "../../src/clerk-trial/valuation-collection-draft-file-delivery";
import { createManagedWatchlistDraftAccountScope } from "../../src/clerk-trial/managed-watchlist-draft-recovery";

/** Test-APK-only observation of the actual valuation document writer. */
export function createNativeValuationCollectionDraftFileFixture(
  plugin = registerPlugin<InvestmentValuationCollectionDraftFilePlugin>(
    "InvestmentValuationCollectionDraftFile",
  ),
) {
  let state = { choices: 0, writes: 0, text: "" };
  const listeners = new Set<() => void>();
  const publish = (change: Partial<typeof state>) => {
    state = { ...state, ...change };
    listeners.forEach((listener) => listener());
  };
  const delivery = createNativeValuationCollectionDraftFileAdapter({
    choose(options) {
      const pending = plugin.choose(options);
      publish({ choices: state.choices + 1 });
      return pending;
    },
    async write(options) {
      const result = await plugin.write(options);
      publish({ writes: state.writes + 1, text: options.text });
      return result;
    },
    cancel: (options) => plugin.cancel(options),
  });
  const getSnapshot = () => state;
  function Controls() {
    const diagnostics = useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getSnapshot,
      getSnapshot,
    );
    return (
      <aside aria-label="Invented native valuation collection file diagnostics">
        <pre id="fixture-valuation-collection-file-protocol" hidden>
          {JSON.stringify(diagnostics)}
        </pre>
      </aside>
    );
  }
  return { delivery, Controls, getSnapshot };
}

interface ValuationFileSession {
  readonly routerProps: {
    readonly draftFileScope?: Promise<string>;
    readonly valuationCollectionDraftFileDelivery?: ManagedValuationCollectionDraftFileDeliveryAdapter;
  };
  readonly Controls: () => ReactElement | null;
}
function EmptyControls() {
  return null;
}

/** Construct once per keyed fixture session; the scope includes its invented account. */
export function createNativeValuationCollectionDraftFileSession(
  fixture: ReturnType<
    typeof createNativeValuationCollectionDraftFileFixture
  > | null,
  session: TrialSession,
): ValuationFileSession {
  if (!fixture) return { routerProps: {}, Controls: EmptyControls };
  const draftFileScope = createManagedWatchlistDraftAccountScope(
    "https://fixture.invalid",
    session.userId,
  );
  return {
    routerProps: {
      draftFileScope,
      valuationCollectionDraftFileDelivery: fixture.delivery,
    },
    Controls: fixture.Controls,
  };
}
