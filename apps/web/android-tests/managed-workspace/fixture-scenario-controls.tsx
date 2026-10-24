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

interface Cancellation {
  readonly id: string;
  readonly label: string;
  readonly visible: (state: Props["state"]) => boolean;
  readonly disabled: (state: Props["state"]) => boolean;
  readonly run: () => void;
}
const cancellationActions = {
  calendar: {
    id: "settle-cancelled-calendar",
    label: "Settle cancelled invented calendar response",
    visible: () =>
      scenario === "bea-agenda" ||
      scenario === "bea-agenda-comparison" ||
      scenario === "markets-day-view" ||
      scenario === "bea-session-retirement",
    disabled: (state) =>
      state.calendarAborted !== state.calendarLateResolved + 1,
    run: () => fixture.settleCancelledCalendar(),
  },
  annualComparison: {
    id: "settle-cancelled-annual-comparison",
    label: "Settle cancelled invented Annual comparison",
    visible: () =>
      scenario === "annual-comparison" ||
      scenario === "annual-operating-comparison",
    disabled: (state) => state.aborted !== state.lateResolved + 1,
    run: () => fixture.settleCancelledAnnualComparison(),
  },
  announcements: {
    id: "settle-cancelled-announcements",
    label: "Settle cancelled invented announcements response",
    visible: () =>
      scenario === "fed-announcements" || scenario === "markets-day-view",
    disabled: (state) => state.fedAborted !== state.fedLateResolved + 1,
    run: () => fixture.settleCancelledAnnouncements(),
  },
  markets: {
    id: "settle-cancelled-markets",
    label: "Settle cancelled invented Markets response",
    visible: (state) => state.marketsEod > 0,
    disabled: (state) => !marketCancellationReady(state),
    run: () => fixture.settleCancelledMarkets(),
  },
  eod: {
    id: "settle-cancelled-eod",
    label: "Settle cancelled invented EOD response",
    visible: (state) => state.eod > 0,
    disabled: (state) => !eodCancellationReady(state),
    run: () => fixture.settleCancelledEod(),
  },
  annual: {
    id: "settle-cancelled-read",
    label: "Settle cancelled fixture response",
    visible: () => true,
    disabled: (state) => annualCancellationPending(state),
    run: () => fixture.settleCancelledRead(),
  },
} satisfies Record<string, Cancellation>;
function CancellationAction({
  action,
  state,
}: Props & { action: Cancellation }) {
  if (!action.visible(state)) return null;
  return (
    <button
      id={action.id}
      disabled={action.disabled(state)}
      onClick={action.run}
    >
      {action.label}
    </button>
  );
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

export function FixtureScenarioControls({ state }: Props) {
  return (
    <aside aria-label="Invented fixture diagnostics">
      <h2>Fixture diagnostics</h2>
      <FixtureCounters state={state} />
      <SignOutSaveControl state={state} />
      <CancellationAction action={cancellationActions.calendar} state={state} />
      <FilingsControls state={state} />
      <CancellationAction
        action={cancellationActions.annualComparison}
        state={state}
      />
      <CancellationAction
        action={cancellationActions.announcements}
        state={state}
      />
      <WatchlistRecoveryControl state={state} />
      <CancellationAction action={cancellationActions.markets} state={state} />
      <CancellationAction action={cancellationActions.eod} state={state} />
      <CatalogRecoveryControl state={state} />
      <CapturedSourceDiagnostics />

      <AnnualRefreshSequenceControl state={state} />
      <AnnualRefreshFailureControl state={state} />
      <CancellationAction action={cancellationActions.annual} state={state} />
    </aside>
  );
}
