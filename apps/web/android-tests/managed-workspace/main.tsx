import { NativeReportRevisitFixture } from "./native-report-revisit-fixture";
import {
  createNativeFinancialScreenRecipeFixture,
  createNativeFinancialScreenRecipeSession,
} from "./native-financial-screen-recipe-fixture";
import { createNativeReportFixture } from "./native-report-fixture";
import { NativeFilingsFixtureControls } from "./native-filings-fixture-controls";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { ManagedWorkspaceRouter } from "../../src/clerk-trial/ManagedWorkspaceScreen";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { TrialFrame } from "../../src/clerk-trial/TrialFrame";
import "../../src/clerk-trial/trial.css";
import {
  authoredValuationNoteDraft,
  authoredValuationPrefix,
  createFixture,
} from "./fixture";
import {
  operatingComparisonPrefix,
  operatingComparisonNoteDraft,
} from "./operating-comparison-fixture";
import { createNativeExportFixture } from "./native-export-fixture";
import { createNativeDraftFileFixture } from "./native-draft-file-fixture";
import { createNativeDraftFileSession } from "./native-draft-file-session";
import {
  createNativeValuationDraftFileFixture,
  createNativeValuationDraftFileSession,
} from "./native-valuation-draft-file-fixture";
import { formatManagedWatchlistExport } from "../../src/clerk-trial/managed-watchlist-export-document";
import type { TrialSession } from "../../src/clerk-trial/session";

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
  scenario !== "annual-operating-results" &&
  scenario !== "annual-operating-history" &&
  scenario !== "annual-liquidity-history" &&
  scenario !== "annual-financial-review" &&
  scenario !== "annual-statements" &&
  scenario !== "authored-valuation" &&
  scenario !== "saved-valuation" &&
  scenario !== "annual-balance-sheet" &&
  scenario !== "annual-operating-comparison" &&
  scenario !== "company-snapshot" &&
  scenario !== "report-revisit" &&
  scenario !== "research-followups" &&
  scenario !== "portfolio-ledger" &&
  scenario !== "markets-day-view" &&
  scenario !== "company-price-ranges" &&
  scenario !== "thesis-review" &&
  scenario !== "price-comparison-note" &&
  scenario !== "price-studies" &&
  scenario !== "screen-comparison" &&
  scenario !== "financial-screen" &&
  scenario !== "valuation-price" &&
  scenario !== "company-filings" &&
  scenario !== "watchlist-filings-review" &&
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
  scenario !== "watchlist-export" &&
  scenario !== "watchlist-draft-file"
)
  throw new Error("Unknown invented Android test scenario");
// Fixed test input before the router mounts; no navigation or account bypass.
if (scenario === "company-direct-entry")
  history.replaceState(null, "", "/?company=listing-zero&section=annual");
const fixture = await createFixture(scenario ?? "default");
const nativeReport =
  scenario === "company-snapshot" || scenario === "annual-statements"
    ? createNativeReportFixture()
    : null;
const nativeExport =
  scenario === "watchlist-export" ? createNativeExportFixture() : null;
const nativeDraftFile =
  scenario === "watchlist-draft-file" ? createNativeDraftFileFixture() : null;
const nativeScreenRecipe = createNativeFinancialScreenRecipeSession(
  scenario === "financial-screen"
    ? createNativeFinancialScreenRecipeFixture()
    : null,
);
const nativeValuationDraftFile =
  scenario === "saved-valuation"
    ? createNativeValuationDraftFileFixture()
    : null;

/** Own the real session model so diagnostics can observe invented drafts without a production bridge. */
function FixtureSession({
  session,
  onFreshSession,
}: {
  session: TrialSession;
  onFreshSession: (session: TrialSession) => void;
}) {
  const [workspace, setWorkspace] = useState<ManagedWorkspace | null>(null);
  const [draftFileSession] = useState(() =>
    createNativeDraftFileSession(nativeDraftFile, session),
  );
  const [valuationDraftFileSession] = useState(() =>
    createNativeValuationDraftFileSession(nativeValuationDraftFile, session),
  );
  useLayoutEffect(() => {
    const current = new ManagedWorkspace(fixture.api, session, undefined, {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
      ...(fixture.screenComparison
        ? { financialScreenListingIds: fixture.screenComparison.listingIds }
        : {}),
      ...(fixture.financialScreen
        ? { financialScreenListingIds: fixture.financialScreen.listingIds }
        : {}),
    });
    setWorkspace(current);
    void current.coordinator.load();
    void current.refreshCatalog();
    return () => current.sessionOwner.dispose();
  }, [session]);
  return (
    <>
      <TrialFrame managed compact>
        {workspace ? (
          <ManagedWorkspaceRouter
            workspace={workspace}
            androidBack={App}
            {...(nativeReport ? { reportDelivery: nativeReport.delivery } : {})}
            {...(nativeExport ? { exportDelivery: nativeExport.delivery } : {})}
            {...draftFileSession.routerProps}
            {...valuationDraftFileSession.routerProps}
            {...nativeScreenRecipe.routerProps}
          />
        ) : (
          <p role="status">Loading your workspace…</p>
        )}
      </TrialFrame>
      {workspace && <FixtureDraftDiagnostics workspace={workspace} />}
      {workspace && scenario === "report-revisit" && (
        <NativeReportRevisitFixture />
      )}
      {workspace && nativeReport && (
        <nativeReport.Controls workspace={workspace} />
      )}
      {workspace && nativeExport && (
        <nativeExport.Controls workspace={workspace} />
      )}
      <draftFileSession.Controls
        workspace={workspace}
        onFreshSession={onFreshSession}
      />
      <valuationDraftFileSession.Controls />
      <nativeScreenRecipe.Controls />
      {workspace && fixture.portfolio && (
        <PortfolioFixtureControls
          workspace={workspace}
          onFreshSession={onFreshSession}
        />
      )}
      {workspace && fixture.followups && (
        <FollowupsFixtureControls
          workspace={workspace}
          onFreshSession={onFreshSession}
        />
      )}
    </>
  );
}

function FollowupsFixtureControls({
  workspace,
  onFreshSession,
}: {
  workspace: ManagedWorkspace;
  onFreshSession: (session: TrialSession) => void;
}) {
  const controls = fixture.followups!;
  const state = useSyncExternalStore(controls.subscribe, controls.getSnapshot);
  const draft = useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
  );
  const local = useSyncExternalStore(
    workspace.followups.subscribe,
    workspace.followups.getSnapshot,
  );
  const owner = useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
  );
  return (
    <aside aria-label="Invented follow-up controls">
      <h2>Invented follow-up controls</h2>
      <p>
        RAM only. A held Save commits immediately and delays only its
        acknowledgement. Starting a fresh session discards both local drafts;
        the independent saved stores remain.
      </p>
      <pre
        id="fixture-followups-diagnostics"
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        {JSON.stringify(state)}
      </pre>
      <pre
        id="fixture-followups-draft"
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        {JSON.stringify({
          session: state.session,
          owner: owner.phase,
          phase: draft.phase,
          baseVersion: draft.baseVersion,
          dirty: draft.dirty,
          conflict: draft.conflict,
          uncertain: draft.uncertain,
          replayPending: draft.replayPending,
          selectedId: local.selectedId,
          filter: local.filter,
          entries: draft.draft?.entries ?? null,
          saved: draft.saved ?? null,
        })}
      </pre>
      <label htmlFor="fixture-followups-next-read">
        Next invented follow-up read
      </label>
      <select
        id="fixture-followups-next-read"
        value={state.nextRead}
        onChange={(event) =>
          controls.setNextRead(
            event.currentTarget.value as Parameters<
              typeof controls.setNextRead
            >[0],
          )
        }
      >
        <option value="complete">Complete</option>
        <option value="hold">Hold captured reply</option>
        <option value="fail">Fail before reply</option>
        <option value="retire">Expire session</option>
      </select>
      <label htmlFor="fixture-followups-next-save">
        Next invented follow-up Save
      </label>
      <select
        id="fixture-followups-next-save"
        value={state.nextSave}
        onChange={(event) =>
          controls.setNextSave(
            event.currentTarget.value as Parameters<
              typeof controls.setNextSave
            >[0],
          )
        }
      >
        <option value="complete">Complete</option>
        <option value="hold">Commit and hold acknowledgement</option>
        <option value="fail">Fail before commit</option>
        <option value="lost-ack">Commit and lose acknowledgement</option>
        <option value="conflict">Another client advances version</option>
        <option value="retire">Expire before commit</option>
      </select>
      <button
        id="fixture-followups-settle"
        disabled={state.held === 0}
        onClick={() => controls.settleHeld()}
      >
        Settle oldest invented follow-up reply
      </button>
      <button
        id="fixture-followups-fresh-session"
        disabled={state.session >= 8 || Boolean(fixture.portfolio)}
        onClick={() => {
          workspace.sessionOwner.dispose();
          history.replaceState(null, "", "/");
          onFreshSession(controls.nextSession());
        }}
      >
        Start fresh invented session
      </button>
    </aside>
  );
}

/** Test-APK-only failure controls and bounded, hidden machine observations. */
function PortfolioFixtureControls({
  workspace,
  onFreshSession,
}: {
  workspace: ManagedWorkspace;
  onFreshSession: (session: TrialSession) => void;
}) {
  const controls = fixture.portfolio!;
  const state = useSyncExternalStore(controls.subscribe, controls.getSnapshot);
  const saved = useSyncExternalStore(
    workspace.portfolio.coordinator.subscribe,
    workspace.portfolio.coordinator.getSnapshot,
  );
  const local = useSyncExternalStore(
    workspace.portfolio.subscribe,
    workspace.portfolio.getSnapshot,
  );
  const owner = useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
  );
  return (
    <aside aria-label="Invented Portfolio controls">
      <h2>Invented Portfolio controls</h2>
      <p>
        Invented RAM records only. A held Save commits before its
        acknowledgement.
      </p>
      <pre id="fixture-portfolio-state" hidden>
        {JSON.stringify(state)}
      </pre>
      <pre id="fixture-portfolio-draft" hidden>
        {JSON.stringify({
          owner: owner.phase,
          phase: saved.phase,
          baseVersion: saved.baseVersion,
          dirty: saved.dirty,
          conflict: saved.conflict,
          uncertain: saved.uncertain,
          replayPending: saved.replayPending,
          ledger: saved.draft?.ledger ?? null,
          saved: saved.saved,
          pendingEditor: local.pendingEditor,
          projection: workspace.portfolio.getProjection(),
        })}
      </pre>
      <label htmlFor="fixture-portfolio-next-read">
        Next invented Portfolio read
      </label>
      <select
        id="fixture-portfolio-next-read"
        value={state.nextRead}
        onChange={(event) =>
          controls.setNextRead(
            event.currentTarget.value as Parameters<
              typeof controls.setNextRead
            >[0],
          )
        }
      >
        <option value="complete">Complete</option>
        <option value="hold">Hold captured reply</option>
        <option value="fail">Fail before reply</option>
        <option value="retire">Expire session</option>
      </select>
      <label htmlFor="fixture-portfolio-next-save">
        Next invented Portfolio Save
      </label>
      <select
        id="fixture-portfolio-next-save"
        value={state.nextSave}
        onChange={(event) =>
          controls.setNextSave(
            event.currentTarget.value as Parameters<
              typeof controls.setNextSave
            >[0],
          )
        }
      >
        <option value="complete">Complete</option>
        <option value="hold">Commit and hold acknowledgement</option>
        <option value="fail">Fail before commit</option>
        <option value="lost-ack">Commit and lose acknowledgement</option>
        <option value="conflict">Another client advances version</option>
        <option value="retire">Expire before commit</option>
      </select>
      <button
        id="fixture-portfolio-settle"
        disabled={state.held === 0}
        onClick={() => controls.settleHeld()}
      >
        Settle oldest invented Portfolio reply
      </button>
      <button
        id="fixture-portfolio-fresh-session"
        disabled={owner.phase !== "retired" || state.session >= 8}
        onClick={() => {
          history.replaceState(null, "", "/");
          onFreshSession(controls.nextSession());
        }}
      >
        Start fresh invented Portfolio session
      </button>
    </aside>
  );
}

function SavedValuationFixtureDiagnostics({
  workspace,
}: {
  workspace: ManagedWorkspace;
}) {
  const controls = fixture.savedValuation!;
  const counts = useSyncExternalStore(controls.subscribe, controls.getSnapshot);
  const editor = useSyncExternalStore(
    workspace.valuation.subscribe,
    workspace.valuation.getSnapshot,
  );
  const resource = useSyncExternalStore(
    workspace.valuationAssumptions.coordinator.subscribe,
    workspace.valuationAssumptions.coordinator.getSnapshot,
  );
  return (
    <aside aria-label="Invented saved valuation diagnostics">
      <pre id="fixture-saved-valuation-store" hidden>
        {JSON.stringify({
          counts,
          expected: controls.expected,
          saved: controls.saved(),
        })}
      </pre>
      <pre id="fixture-valuation-draft" hidden>
        {JSON.stringify(editor)}
      </pre>
      <pre id="fixture-saved-valuation-resource" hidden>
        {JSON.stringify(resource)}
      </pre>
    </aside>
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
  const valuation = useSyncExternalStore(
    workspace.valuation.subscribe,
    workspace.valuation.getSnapshot,
  );
  return (
    <aside aria-label="Invented draft diagnostics">
      {fixture.savedValuation && (
        <SavedValuationFixtureDiagnostics workspace={workspace} />
      )}
      {scenario === "authored-valuation" && (
        <>
          <pre
            id="fixture-valuation-expected"
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {JSON.stringify({
              prefix: authoredValuationPrefix,
              expectedNote: authoredValuationNoteDraft,
            })}
          </pre>
          <pre
            id="fixture-valuation-draft"
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {JSON.stringify(valuation)}
          </pre>
        </>
      )}
      {fixture.valuationPrice && (
        <pre id="fixture-valuation-price" hidden>
          {JSON.stringify(fixture.valuationPrice)}
        </pre>
      )}
      {fixture.valuationPrice && (
        <pre id="fixture-valuation-draft" hidden>
          {JSON.stringify(valuation)}
        </pre>
      )}
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
          scenario === "markets-day-view" ||
          scenario === "bea-session-retirement") && (
          <button
            id="settle-cancelled-calendar"
            disabled={state.calendarAborted !== state.calendarLateResolved + 1}
            onClick={fixture.settleCancelledCalendar}
          >
            Settle cancelled invented calendar response
          </button>
        )}
        <NativeFilingsFixtureControls
          scenario={scenario}
          fixture={fixture}
          state={state}
        />
        {(scenario === "annual-comparison" ||
          scenario === "annual-operating-comparison") && (
          <button
            id="settle-cancelled-annual-comparison"
            disabled={state.aborted !== state.lateResolved + 1}
            onClick={fixture.settleCancelledAnnualComparison}
          >
            Settle cancelled invented Annual comparison
          </button>
        )}
        {(scenario === "fed-announcements" ||
          scenario === "markets-day-view") && (
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
        {fixture.annualStatements && (
          <pre id="fixture-annual-statements" hidden>
            {JSON.stringify(fixture.annualStatements)}
          </pre>
        )}
        {fixture.screenComparison && (
          <pre id="fixture-screen-comparison" hidden>
            {JSON.stringify(fixture.screenComparison)}
          </pre>
        )}
        {fixture.financialScreen && (
          <pre id="fixture-financial-screen" hidden>
            {JSON.stringify(fixture.financialScreen)}
          </pre>
        )}
        {fixture.financialReview && (
          <pre id="fixture-financial-review" hidden>
            {JSON.stringify(fixture.financialReview)}
          </pre>
        )}
        {scenario === "annual-operating-comparison" && (
          <pre
            id="fixture-operating-comparison"
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {JSON.stringify({
              prefix: operatingComparisonPrefix,
              expectedNote: operatingComparisonNoteDraft,
            })}
          </pre>
        )}
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
          disabled={
            scenario === "annual-operating-history" ||
            scenario === "annual-liquidity-history"
              ? state.aborted !== state.lateResolved + 1 ||
                ![3, 5].includes(state.annual)
              : scenario === "annual-operating-results" ||
                  scenario === "annual-financial-review"
                ? state.aborted !== state.lateResolved + 1 ||
                  ![3, 4].includes(state.annual)
                : state.aborted !== 1 || state.lateResolved !== 0
          }
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
