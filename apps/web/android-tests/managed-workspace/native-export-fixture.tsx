import { registerPlugin } from "@capacitor/core";
import { useSyncExternalStore } from "react";
import {
  createNativeWatchlistExportAdapter,
  type InvestmentWatchlistExportPlugin,
} from "../../src/clerk-trial/native-watchlist-export";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { MANAGED_WATCHLIST_EXPORT_MAX_BYTES } from "../../src/clerk-trial/managed-watchlist-export-document";

type InvalidProbeKind = "unicode" | "oversize";
type InvalidProbeFailure =
  "choose_rejected" | "choose_cancelled" | "write_succeeded" | "write_rejected";
type ChooseRejectionCode = "busy" | "invalid_input" | "unavailable" | "unknown";
interface InvalidProbeState {
  sequence: number;
  kind: InvalidProbeKind | null;
  phase: "idle" | "choosing" | "writing" | "cancelling" | "settled";
  failure: InvalidProbeFailure | null;
  chooseRejectionCode: ChooseRejectionCode | null;
  cleanupFailed: boolean;
}
const initialInvalidProbe: InvalidProbeState = {
  sequence: 0,
  kind: null,
  phase: "idle",
  failure: null,
  chooseRejectionCode: null,
  cleanupFailed: false,
};

async function attemptInvalidWrite(
  plugin: InvestmentWatchlistExportPlugin,
  operationId: string,
  kind: InvalidProbeKind,
  writing: () => void,
): Promise<{
  failure: InvalidProbeFailure | null;
  chooseRejectionCode?: ChooseRejectionCode;
}> {
  let result;
  try {
    result = await plugin.choose({ operationId, version: 1 });
  } catch (error) {
    const code = error instanceof Object && "code" in error ? error.code : null;
    return {
      failure: "choose_rejected",
      chooseRejectionCode:
        code === "busy" || code === "invalid_input" || code === "unavailable"
          ? code
          : "unknown",
    };
  }
  if (result.status !== "chosen") return { failure: "choose_cancelled" };
  writing();
  const text =
    kind === "unicode"
      ? "\ud800"
      : "é".repeat(MANAGED_WATCHLIST_EXPORT_MAX_BYTES / 2 + 1);
  try {
    await plugin.write({ operationId, handle: result.handle, text });
    return { failure: "write_succeeded" };
  } catch (error) {
    return {
      failure:
        error instanceof Object &&
        "code" in error &&
        error.code === "write_failed"
          ? null
          : "write_rejected",
    };
  }
}

/** Metadata-only readiness for the test probes, including their awaited cleanup. */
export function createInvalidExportProbe(
  plugin: InvestmentWatchlistExportPlugin,
  publish: (state: InvalidProbeState, refused: boolean) => void,
) {
  let state = initialInvalidProbe;
  let running = false;
  const update = (change: Partial<InvalidProbeState>, refused = false) => {
    state = { ...state, ...change };
    publish(state, refused);
  };
  return {
    async run(kind: InvalidProbeKind) {
      if (running) return;
      running = true;
      const operationId = crypto.randomUUID();
      update({
        sequence: state.sequence + 1,
        kind,
        phase: "choosing",
        failure: null,
        chooseRejectionCode: null,
        cleanupFailed: false,
      });
      const outcome = await attemptInvalidWrite(plugin, operationId, kind, () =>
        update({ phase: "writing" }),
      );
      update({ phase: "cancelling", ...outcome });
      let cleanupFailed = false;
      try {
        await plugin.cancel({ operationId });
      } catch {
        cleanupFailed = true;
      }
      running = false;
      update(
        { phase: "settled", cleanupFailed },
        outcome.failure === null && !cleanupFailed,
      );
    },
  };
}

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
    invalidProbe: initialInvalidProbe,
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
  const invalidProbe = createInvalidExportProbe(plugin, (probe, refused) => {
    state = {
      ...state,
      invalidProbe: probe,
      invalidRefused: state.invalidRefused + Number(refused),
    };
    listeners.forEach((listener) => listener());
  });
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
    const invalidRunning =
      diagnostics.invalidProbe.phase !== "idle" &&
      diagnostics.invalidProbe.phase !== "settled";
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
          disabled={invalidRunning}
          onClick={() => void invalidProbe.run("unicode")}
        >
          Test malformed invented Unicode
        </button>
        <button
          id="fixture-export-oversize"
          disabled={invalidRunning}
          onClick={() => void invalidProbe.run("oversize")}
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
