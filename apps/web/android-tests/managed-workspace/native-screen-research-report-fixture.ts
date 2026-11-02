import { registerPlugin } from "@capacitor/core";
import {
  createNativeScreenResearchReportAdapter,
  type InvestmentScreenResearchReportPlugin,
} from "../../src/clerk-trial/screen-research-report-delivery";

/** Real chosen-document bridge; only bounded transport metadata is observed. */
export function createNativeScreenResearchReportFixture(
  plugin = registerPlugin<InvestmentScreenResearchReportPlugin>(
    "InvestmentScreenResearchReport",
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
  };
  const update = (patch: Partial<typeof state>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const delivery = createNativeScreenResearchReportAdapter({
    choose: async (options) => {
      update({ choices: state.choices + 1, filename: options.filename });
      return plugin.choose(options);
    },
    write: async (options) => {
      update({ writeRequests: state.writeRequests + 1 });
      const result = await plugin.write(options);
      update({
        writes: state.writes + 1,
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
