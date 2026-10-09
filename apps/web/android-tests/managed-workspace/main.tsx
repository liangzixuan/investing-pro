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
// Instrumentation selects this fixed scenario in its copied test document before mounting.
const scenario = document
  .querySelector('meta[name="investment-android-test-scenario"]')
  ?.getAttribute("content");
if (
  scenario !== undefined &&
  scenario !== "catalog-startup-recovery" &&
  scenario !== "company-direct-entry" &&
  scenario !== "annual-note" &&
  scenario !== "price-comparison-note" &&
  scenario !== "markets-price-handoff" &&
  scenario !== "watchlist-recovery" &&
  scenario !== "signout-save-review" &&
  scenario !== "signout-uncertain-review" &&
  scenario !== "raw-close-comparison" &&
  scenario !== "markets-selected-price"
)
  throw new Error("Unknown invented Android test scenario");
// Fixed test input before the router mounts; no navigation or account bypass.
if (scenario === "company-direct-entry")
  history.replaceState(null, "", "/?company=listing-zero&section=annual");
const fixture = await createFixture(scenario ?? "default");
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
        marketsCohort={fixture.marketsCohort}
        androidBack={App}
      />
      <aside aria-label="Invented fixture diagnostics">
        <h2>Fixture diagnostics</h2>
        <pre
          id="fixture-diagnostics"
          style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
        >
          {JSON.stringify(state)}
        </pre>
        {(scenario === "signout-save-review" ||
          scenario === "signout-uncertain-review") && (
          <>
            <button
              id="settle-signout-save"
              disabled={
                state.reviewSaveSettled !== 0 ||
                (scenario === "signout-save-review"
                  ? state.save !== 1 || state.signOut !== 0
                  : state.save !== 2 || state.signOut !== 1)
              }
              onClick={fixture.settleSignOutSave}
            >
              Settle held invented sign-out save
            </button>
            <pre
              id="fixture-signout-saved"
              style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {JSON.stringify(fixture.signOutSavedWatchlist())}
            </pre>
          </>
        )}
        {scenario === "watchlist-recovery" && (
          <button
            id="fail-recovery-read"
            disabled={state.load !== 3 || state.recoveryReadFailed !== 0}
            onClick={fixture.failRecoveryRead}
          >
            Fail held invented watchlist read
          </button>
        )}
        {state.marketsEod > 0 && (
          <button
            id="settle-cancelled-markets"
            disabled={
              state.marketsEod !==
                (scenario === "markets-selected-price" ||
                scenario === "raw-close-comparison"
                  ? 2
                  : 5) ||
              state.marketsAborted !== 1 ||
              state.marketsLateResolved !== 0
            }
            onClick={fixture.settleCancelledMarkets}
          >
            Settle cancelled invented Markets response
          </button>
        )}
        {state.eod > 0 && (
          <button
            id="settle-cancelled-eod"
            disabled={
              state.eod !== 2 ||
              state.eodAborted !== 1 ||
              state.eodLateResolved !== 0
            }
            onClick={fixture.settleCancelledEod}
          >
            Settle cancelled invented EOD response
          </button>
        )}
        {state.catalogRecovery && (
          <button
            id="release-catalog-recovery"
            disabled={state.status !== 2 || state.catalogReleased !== 0}
            onClick={fixture.releaseCatalogRecovery}
          >
            Release held fixture catalog
          </button>
        )}
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
