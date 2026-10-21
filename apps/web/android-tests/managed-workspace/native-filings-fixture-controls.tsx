import type { ManagedNativeFixture } from "./fixture";

/** Manual late delivery is confined to these two fixed invented Filings scenarios. */
export function NativeFilingsFixtureControls({
  scenario,
  fixture,
  state,
}: {
  scenario: string | null | undefined;
  fixture: ManagedNativeFixture;
  state: ReturnType<ManagedNativeFixture["getSnapshot"]>;
}) {
  if (scenario !== "company-filings" && scenario !== "watchlist-filings-review")
    return null;
  return (
    <>
      <button
        id="settle-cancelled-filings"
        disabled={state.filingsAborted !== state.filingsLateResolved + 1}
        onClick={fixture.settleCancelledFilings}
      >
        Settle cancelled invented filings response
      </button>
      {fixture.filingsReview && (
        <pre id="fixture-filings-review" hidden>
          {JSON.stringify(fixture.filingsReview)}
        </pre>
      )}
    </>
  );
}
