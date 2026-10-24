import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import "../../src/clerk-trial/trial.css";
import { fixture } from "./native-fixture-environment";
import { FixtureSession } from "./fixture-session";
import { FixtureScenarioControls } from "./fixture-scenario-controls";
function Fixture() {
  const state = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot);
  const [session, setSession] = useState(fixture.session);
  return (
    <>
      <aside aria-label="Invented fixture identification">
        <p>
          <strong>Invented managed workspace test</strong>
        </p>
        <p>No signed-in account, network, provider, or saved owner data.</p>
      </aside>
      <FixtureSession
        key={session.sessionId}
        session={session}
        onFreshSession={setSession}
      />
      <FixtureScenarioControls state={state} />
    </>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing invented fixture root");
createRoot(root).render(<Fixture />);
