import { registerPlugin } from "@capacitor/core";
import { useSyncExternalStore } from "react";
import {
  createNativeFinancialScreenRecipeAdapter,
  type InvestmentFinancialScreenRecipePlugin,
} from "../../src/clerk-trial/financial-screen-recipe-delivery";

/** Test APK only: observes the actual chosen-document recipe writer with invented data. */
export function createNativeFinancialScreenRecipeFixture(
  plugin = registerPlugin<InvestmentFinancialScreenRecipePlugin>(
    "InvestmentFinancialScreenRecipe",
  ),
) {
  let state = { choices: 0, writes: 0, text: "" };
  const listeners = new Set<() => void>();
  const publish = (change: Partial<typeof state>) => {
    state = { ...state, ...change };
    for (const listener of listeners) listener();
  };
  const delivery = createNativeFinancialScreenRecipeAdapter({
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
      <aside aria-label="Invented native screen recipe diagnostics">
        <pre id="fixture-screen-recipe-protocol" hidden>
          {JSON.stringify(diagnostics)}
        </pre>
      </aside>
    );
  }
  return { delivery, Controls, getSnapshot };
}
