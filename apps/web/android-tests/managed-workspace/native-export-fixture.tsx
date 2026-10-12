import { registerPlugin } from "@capacitor/core";
import { useSyncExternalStore } from "react";
import {
  createNativeWatchlistExportAdapter,
  type InvestmentWatchlistExportPlugin,
} from "../../src/clerk-trial/native-watchlist-export";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { MANAGED_WATCHLIST_EXPORT_MAX_BYTES } from "../../src/clerk-trial/managed-watchlist-export-document";

/** Test-APK-only probes of the real bridge. No destination URI is exposed. */
export function createNativeExportFixture() {
  const plugin = registerPlugin<InvestmentWatchlistExportPlugin>(
    "InvestmentWatchlistExport",
  );
  let lastWrite:
    Parameters<InvestmentWatchlistExportPlugin["write"]>[0] | null = null;
  let retireOnChoose: (() => void) | null = null;
  let state = {
    duplicateRefused: 0,
    replayRefused: 0,
    invalidRefused: 0,
    choice: null as { operationId: string; handle: string } | null,
  };
  const listeners = new Set<() => void>();
  const increment = (
    key: "duplicateRefused" | "replayRefused" | "invalidRefused",
  ) => {
    state = { ...state, [key]: state[key] + 1 };
    listeners.forEach((listener) => listener());
  };
  const delivery = createNativeWatchlistExportAdapter({
    choose(options) {
      const pending = plugin.choose(options);
      // One deliberate direct bridge duplicate, not an adapter retry.
      void plugin
        .choose({ ...options, operationId: crypto.randomUUID() })
        .catch(() => increment("duplicateRefused"));
      retireOnChoose?.();
      retireOnChoose = null;
      return pending;
    },
    write(options) {
      lastWrite = { ...options };
      return plugin.write(options);
    },
    cancel: (options) => plugin.cancel(options),
  });
  async function invalidWrite(text: string) {
    const operationId = crypto.randomUUID();
    const result = await plugin.choose({ operationId, version: 1 });
    if (result.status !== "chosen") throw new Error("Fixture picker cancelled");
    try {
      await plugin.write({ operationId, handle: result.handle, text });
    } catch {
      increment("invalidRefused");
    } finally {
      await plugin.cancel({ operationId });
    }
  }
  async function chooseWithoutWrite() {
    const operationId = crypto.randomUUID();
    const result = await plugin.choose({ operationId, version: 1 });
    if (result.status !== "chosen") throw new Error("Fixture picker cancelled");
    state = { ...state, choice: { operationId, handle: result.handle } };
    listeners.forEach((listener) => listener());
  }
  function Controls({ workspace }: { workspace: ManagedWorkspace }) {
    const diagnostics = useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => state,
    );
    return (
      <aside aria-label="Invented native export probes">
        <pre id="fixture-export-protocol">{JSON.stringify(diagnostics)}</pre>
        <pre id="fixture-export-choice">
          {JSON.stringify(diagnostics.choice)}
        </pre>
        <button
          id="fixture-export-choose-only"
          onClick={() => void chooseWithoutWrite()}
        >
          Choose an invented destination without writing
        </button>
        <button
          id="fixture-export-replay"
          onClick={() => {
            if (lastWrite)
              void plugin
                .write(lastWrite)
                .catch(() => increment("replayRefused"));
          }}
        >
          Replay the consumed invented export handle
        </button>
        <button
          id="fixture-export-unicode"
          onClick={() => void invalidWrite("\ud800")}
        >
          Test malformed invented Unicode
        </button>
        <button
          id="fixture-export-oversize"
          onClick={() =>
            void invalidWrite(
              "é".repeat(MANAGED_WATCHLIST_EXPORT_MAX_BYTES / 2 + 1),
            )
          }
        >
          Test oversized invented output
        </button>
        <button
          id="fixture-export-retire"
          onClick={() => {
            retireOnChoose = () => workspace.coordinator.retire();
          }}
        >
          Retire the invented session during the next chooser
        </button>
      </aside>
    );
  }
  return { delivery, Controls };
}
