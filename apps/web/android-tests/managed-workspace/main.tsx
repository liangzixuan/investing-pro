import { createNativeReportFixture } from "./native-report-fixture";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { ManagedWorkspaceRouter } from "../../src/clerk-trial/ManagedWorkspaceScreen";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { TrialFrame } from "../../src/clerk-trial/TrialFrame";
import "../../src/clerk-trial/trial.css";
import { createFixture } from "./fixture";
import { createNativeExportFixture } from "./native-export-fixture";
import { formatManagedWatchlistExport } from "../../src/clerk-trial/managed-watchlist-export-document";

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
  scenario !== "annual-cash-history" &&
  scenario !== "company-snapshot" &&
  scenario !== "company-price-ranges" &&
  scenario !== "thesis-review" &&
  scenario !== "price-comparison-note" &&
  scenario !== "company-filings" &&
  scenario !== "markets-price-handoff" &&
  scenario !== "watchlist-recovery" &&
  scenario !== "signout-save-review" &&
  scenario !== "signout-uncertain-review" &&
  scenario !== "raw-close-comparison" &&
  scenario !== "bea-agenda" &&
  scenario !== "bea-agenda-comparison" &&
  scenario !== "bea-session-retirement" &&
  scenario !== "fed-announcements" &&
  scenario !== "annual-comparison" &&
  scenario !== "markets-selected-price" &&
  scenario !== "watchlist-comparison" &&
  scenario !== "watchlist-export"
)
  throw new Error("Unknown invented Android test scenario");
// Fixed test input before the router mounts; no navigation or account bypass.
if (scenario === "company-direct-entry")
  history.replaceState(null, "", "/?company=listing-zero&section=annual");
const fixture = await createFixture(scenario ?? "default");
const nativeReport =
  scenario === "company-snapshot" ? createNativeReportFixture() : null;
const nativeExport =
  scenario === "watchlist-export" ? createNativeExportFixture() : null;

/** Own the real session model so diagnostics can observe invented drafts without a production bridge. */
function FixtureSession() {
  const [workspace, setWorkspace] = useState<ManagedWorkspace | null>(null);
  useLayoutEffect(() => {
    const current = new ManagedWorkspace(
      fixture.api,
      fixture.session,
      undefined,
      {
        marketsCohort: fixture.marketsCohort,
        priceCoverage: fixture.priceCoverage,
      },
    );
    setWorkspace(current);
    void current.coordinator.load();
    void current.refreshCatalog();
    return () => current.coordinator.retire();
  }, []);
  return (
    <>
      <TrialFrame managed compact>
        {workspace ? (
          <ManagedWorkspaceRouter
            workspace={workspace}
            androidBack={App}
            {...(nativeReport ? { reportDelivery: nativeReport.delivery } : {})}
            {...(nativeExport ? { exportDelivery: nativeExport.delivery } : {})}
          />
        ) : (
          <p role="status">Loading your workspace…</p>
        )}
      </TrialFrame>
      {workspace && <FixtureDraftDiagnostics workspace={workspace} />}
      {workspace && nativeReport && (
        <nativeReport.Controls workspace={workspace} />
      )}
      {workspace && nativeExport && (
        <nativeExport.Controls workspace={workspace} />
      )}
    </>
  );
}

function FixtureDraftDiagnostics({
  workspace,
}: {
  workspace: ManagedWorkspace;
}) {
  const draft = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
  );
  return (
    <aside aria-label="Invented draft diagnostics">
      {nativeExport && (
        <pre id="fixture-export-document">
          {JSON.stringify(
            draft.saved ? formatManagedWatchlistExport(draft.saved) : null,
          )}
        </pre>
      )}
      <pre
        id="fixture-workspace-draft"
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        {JSON.stringify({
          phase: draft.phase,
          baseVersion: draft.baseVersion,
          dirty: draft.dirty,
          memberships:
            draft.draft?.memberships.map(({ listingId, symbol, note }) => ({
              listingId,
              symbol,
              note,
            })) ?? null,
        })}
      </pre>
    </aside>
  );
}

function Fixture() {
  const state = useSyncExternalStore(fixture.subscribe, fixture.getSnapshot);
  return (
    <>
      <aside aria-label="Invented fixture identification">
        <p>
          <strong>Invented managed workspace test</strong>
        </p>
        <p>No signed-in account, network, provider, or saved owner data.</p>
      </aside>
      <FixtureSession />
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
        {(scenario === "bea-agenda" ||
          scenario === "bea-agenda-comparison" ||
          scenario === "bea-session-retirement") && (
          <button
            id="settle-cancelled-calendar"
            disabled={state.calendarAborted !== state.calendarLateResolved + 1}
            onClick={fixture.settleCancelledCalendar}
          >
            Settle cancelled invented calendar response
          </button>
        )}
        {scenario === "company-filings" && (
          <button
            id="settle-cancelled-filings"
            disabled={state.filingsAborted !== state.filingsLateResolved + 1}
            onClick={fixture.settleCancelledFilings}
          >
            Settle cancelled invented filings response
          </button>
        )}
        {scenario === "annual-comparison" && (
          <button
            id="settle-cancelled-annual-comparison"
            disabled={state.aborted !== state.lateResolved + 1}
            onClick={fixture.settleCancelledAnnualComparison}
          >
            Settle cancelled invented Annual comparison
          </button>
        )}
        {scenario === "fed-announcements" && (
          <button
            id="settle-cancelled-announcements"
            disabled={state.fedAborted !== state.fedLateResolved + 1}
            onClick={fixture.settleCancelledAnnouncements}
          >
            Settle cancelled invented announcements response
          </button>
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
              scenario === "company-price-ranges"
                ? ![2, 4, 5].includes(state.eod) ||
                  state.eodAborted !== state.eodLateResolved + 1
                : state.eod !== 2 ||
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
    </>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing invented fixture root");
createRoot(root).render(<Fixture />);
