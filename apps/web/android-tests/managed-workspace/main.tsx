import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { ManagedSessionScreen } from "../../src/clerk-trial/ManagedWorkspaceScreen";
import "../../src/clerk-trial/trial.css";
import { createFixture } from "./fixture";

if (
  Capacitor.getPlatform() !== "android" ||
  location.origin !== "https://localhost"
)
  throw new Error("This invented fixture runs only in Android instrumentation");
const fixture = await createFixture();
function Fixture() {
  const state = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot);
  return (
    <main className="clerk-trial">
      <header>
        <h1>Invented managed workspace test</h1>
        <p>No signed-in account, network, provider, or saved owner data.</p>
      </header>
      <ManagedSessionScreen
        session={fixture.session}
        api={fixture.api}
        apiOrigin="https://managed-fixture.invalid"
        androidBack={App}
      />
      <aside aria-label="Invented fixture diagnostics">
        <h2>Fixture diagnostics</h2>
        <pre id="fixture-diagnostics">{JSON.stringify(state)}</pre>
        <pre
          id="fixture-report-generations"
          style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
        >
          {JSON.stringify(fixture.generations)}
        </pre>
        <button
          id="enable-refresh-scenario"
          disabled={state.refreshScenario || state.annual !== 0}
          onClick={fixture.enableRefreshScenario}
        >
          Use invented annual refresh sequence
        </button>
        <button
          id="fail-held-refresh"
          disabled={
            !state.refreshScenario ||
            state.annual !== 2 ||
            state.refreshFailed !== 0
          }
          onClick={fixture.failRefresh}
        >
          Fail held fixture refresh
        </button>
        <button
          id="settle-cancelled-read"
          disabled={state.aborted !== 1 || state.lateResolved !== 0}
          onClick={fixture.settleCancelledRead}
        >
          Settle cancelled fixture response
        </button>
      </aside>
    </main>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing invented fixture root");
createRoot(root).render(<Fixture />);
