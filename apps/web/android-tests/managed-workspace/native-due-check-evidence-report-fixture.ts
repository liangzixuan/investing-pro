import { registerPlugin } from "@capacitor/core";
import {
  createNativeDueCheckEvidenceReportAdapter,
  type InvestmentDueCheckEvidenceReportPlugin,
} from "../../src/clerk-trial/due-check-evidence-report-delivery";

/** Real chosen-document bridge; only bounded transport metadata is observed. */
export function createNativeDueCheckEvidenceReportFixture(
  plugin = registerPlugin<InvestmentDueCheckEvidenceReportPlugin>(
    "InvestmentDueCheckEvidenceReport",
  ),
) {
  const listeners = new Set<() => void>();
  let state = {
    choices: 0,
    writeRequests: 0,
    writes: 0,
    cancels: 0,
    filename: "",
    byteLength: 0,
    text: "",
  };
  const update = (patch: Partial<typeof state>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const delivery = createNativeDueCheckEvidenceReportAdapter({
    choose: async (options) => {
      update({ choices: state.choices + 1, filename: options.filename });
      return plugin.choose(options);
    },
    write: async (options) => {
      update({ writeRequests: state.writeRequests + 1 });
      const result = await plugin.write(options);
      update({
        writes: state.writes + 1,
        text: options.text,
        byteLength: new TextEncoder().encode(options.text).byteLength,
      });
      return result;
    },
    cancel: async (options) => {
      await plugin.cancel(options);
      update({ cancels: state.cancels + 1 });
    },
  });
  return {
    delivery,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
