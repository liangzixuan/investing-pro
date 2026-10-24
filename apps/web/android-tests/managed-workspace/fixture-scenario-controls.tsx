import { fixture, scenario } from "./native-fixture-environment";
import { NativeFilingsFixtureControls } from "./native-filings-fixture-controls";
import {
  operatingComparisonPrefix,
  operatingComparisonNoteDraft,
} from "./operating-comparison-fixture";
function marketCancellationReady(state: Props["state"]) {
  const expected =
    scenario === "markets-selected-price" || scenario === "raw-close-comparison"
      ? 2
      : 5;
  if (state.marketsEod !== expected) return false;
  return state.marketsAborted === 1 && state.marketsLateResolved === 0;
}
function eodCancellationReady(state: Props["state"]) {
  if (scenario === "company-price-ranges")
    return (
      [2, 4, 5].includes(state.eod) &&
      state.eodAborted === state.eodLateResolved + 1
    );
  if (state.eod !== 2) return false;
  return state.eodAborted === 1 && state.eodLateResolved === 0;
}
function annualCancellationPending(state: Props["state"]) {
  if (
    scenario === "annual-operating-history" ||
    scenario === "annual-liquidity-history"
  )
    return (
      state.aborted !== state.lateResolved + 1 || ![3, 5].includes(state.annual)
    );
  if (
    scenario === "annual-operating-results" ||
    scenario === "annual-financial-review"
  )
    return (
      state.aborted !== state.lateResolved + 1 || ![3, 4].includes(state.annual)
    );
  return state.aborted !== 1 || state.lateResolved !== 0;
}

type Props = { state: ReturnType<typeof fixture.getSnapshot> };
function FixtureCounters({ state }: Props) {
  return (
    <>
      <pre
        id="fixture-diagnostics"
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        {JSON.stringify(state)}
      </pre>
    </>
  );
}
function SignOutSaveControl({ state }: Props) {
  return (
    <>
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
    </>
  );
}
function CalendarCancellationControl({ state }: Props) {
  return (
    <>
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
    </>
  );
}
function FilingsControls({ state }: Props) {
  return (
    <>
      <NativeFilingsFixtureControls
        scenario={scenario}
        fixture={fixture}
        state={state}
      />
    </>
  );
}
function AnnualComparisonCancellationControl({ state }: Props) {
  return (
    <>
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
    </>
  );
}
function AnnouncementCancellationControl({ state }: Props) {
  return (
    <>
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
    </>
  );
}
function WatchlistRecoveryControl({ state }: Props) {
  return (
    <>
      {scenario === "watchlist-recovery" && (
        <button
          id="fail-recovery-read"
          disabled={state.load !== 3 || state.recoveryReadFailed !== 0}
          onClick={fixture.failRecoveryRead}
        >
          Fail held invented watchlist read
        </button>
      )}
    </>
  );
}
function MarketCancellationControl({ state }: Props) {
  return (
    <>
      {state.marketsEod > 0 && (
        <button
          id="settle-cancelled-markets"
          disabled={!marketCancellationReady(state)}
          onClick={fixture.settleCancelledMarkets}
        >
          Settle cancelled invented Markets response
        </button>
      )}
    </>
  );
}
function EodCancellationControl({ state }: Props) {
  return (
    <>
      {state.eod > 0 && (
        <button
          id="settle-cancelled-eod"
          disabled={!eodCancellationReady(state)}
          onClick={fixture.settleCancelledEod}
        >
          Settle cancelled invented EOD response
        </button>
      )}
    </>
  );
}
function CatalogRecoveryControl({ state }: Props) {
  return (
    <>
      {state.catalogRecovery && (
        <button
          id="release-catalog-recovery"
          disabled={state.status !== 2 || state.catalogReleased !== 0}
          onClick={fixture.releaseCatalogRecovery}
        >
          Release held fixture catalog
        </button>
      )}
    </>
  );
}
function CapturedSourceDiagnostics() {
  return (
    <>
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
    </>
  );
}

function AnnualRefreshSequenceControl({ state }: Props) {
  return (
    <>
      <button
        id="enable-refresh-scenario"
        disabled={state.refreshScenario || state.annual !== 0}
        onClick={fixture.enableRefreshScenario}
      >
        Use invented annual refresh sequence
      </button>
    </>
  );
}
function AnnualRefreshFailureControl({ state }: Props) {
  return (
    <>
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
    </>
  );
}
function AnnualCancellationControl({ state }: Props) {
  return (
    <>
      <button
        id="settle-cancelled-read"
        disabled={annualCancellationPending(state)}
        onClick={fixture.settleCancelledRead}
      >
        Settle cancelled fixture response
      </button>
    </>
  );
}
export function FixtureScenarioControls({ state }: Props) {
  return (
    <aside aria-label="Invented fixture diagnostics">
      <h2>Fixture diagnostics</h2>
      <FixtureCounters state={state} />
      <SignOutSaveControl state={state} />
      <CalendarCancellationControl state={state} />
      <FilingsControls state={state} />
      <AnnualComparisonCancellationControl state={state} />
      <AnnouncementCancellationControl state={state} />
      <WatchlistRecoveryControl state={state} />
      <MarketCancellationControl state={state} />
      <EodCancellationControl state={state} />
      <CatalogRecoveryControl state={state} />
      <CapturedSourceDiagnostics />

      <AnnualRefreshSequenceControl state={state} />
      <AnnualRefreshFailureControl state={state} />
      <AnnualCancellationControl state={state} />
    </aside>
  );
}
