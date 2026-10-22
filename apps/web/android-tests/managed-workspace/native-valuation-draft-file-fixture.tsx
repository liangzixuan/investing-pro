import { registerPlugin } from "@capacitor/core";
import { useSyncExternalStore, type ReactElement } from "react";
import type { TrialSession } from "../../src/clerk-trial/session";
import {
  createNativeValuationDraftFileAdapter,
  type InvestmentValuationDraftFilePlugin,
  type ManagedValuationDraftFileDeliveryAdapter,
} from "../../src/clerk-trial/valuation-draft-file-delivery";
import { createManagedWatchlistDraftAccountScope } from "../../src/clerk-trial/managed-watchlist-draft-recovery";

/** Test-APK-only observation of the actual valuation document writer. */
export function createNativeValuationDraftFileFixture(
  plugin = registerPlugin<InvestmentValuationDraftFilePlugin>(
    "InvestmentValuationDraftFile",
  ),
) {
  let state = { choices: 0, writes: 0, text: "" };
  const listeners = new Set<() => void>();
  const publish = (change: Partial<typeof state>) => {
    state = { ...state, ...change };
    listeners.forEach((listener) => listener());
  };
  const delivery = createNativeValuationDraftFileAdapter({
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
      <aside aria-label="Invented native valuation file diagnostics">
        <pre id="fixture-valuation-file-protocol" hidden>
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
    readonly valuationDraftFileDelivery?: ManagedValuationDraftFileDeliveryAdapter;
  };
  readonly Controls: () => ReactElement | null;
}
function EmptyControls() {
  return null;
}

/** Construct once per keyed fixture session; the scope includes its invented account. */
export function createNativeValuationDraftFileSession(
  fixture: ReturnType<typeof createNativeValuationDraftFileFixture> | null,
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
      valuationDraftFileDelivery: fixture.delivery,
    },
    Controls: fixture.Controls,
  };
}
