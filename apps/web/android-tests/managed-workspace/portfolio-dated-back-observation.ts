import type { AndroidBackAdapter } from "../../src/mobile/android-back";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";

// Invented fixture observations only: one original subscription, no navigation.
export function observePortfolioDatedBack(
  app: AndroidBackAdapter,
  workspace: ManagedWorkspace,
) {
  const events: Record<string, unknown>[] = [];
  let sequence = 0;
  const record = (stage: string, canGoBack: boolean) => {
    try {
      const state = workspace.getSnapshot();
      events.push({
        sequence: ++sequence,
        stage,
        time: performance.now(),
        url: location.href,
        canGoBack,
        canNavigate: workspace.canNavigate(),
        phase: workspace.coordinator.getSnapshot().phase,
        view: state.view,
        researchPresent: !!state.research,
        companyRoutePresent: !!state.companyRoute,
      });
      if (events.length > 24) events.shift();
    } catch {
      // A diagnostic failure must never change native event delivery.
    }
  };
  const adapter: AndroidBackAdapter = {
    addListener(name, callback) {
      return app.addListener(name, (event) => {
        record("callback-entry", event.canGoBack);
        try {
          return callback(event);
        } finally {
          record("callback-exit", event.canGoBack);
        }
      });
    },
  };
  return { adapter, events };
}

export type PortfolioDatedBackWindow = Window & {
  __portfolioDatedBackObservation?: ReturnType<
    typeof observePortfolioDatedBack
  >;
};
