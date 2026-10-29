import type { ScreenComparisonFollowupControls } from "./use-screen-comparison-followup-review";

export function ManagedScreenComparisonFollowupReadiness({
  controls: c,
}: {
  controls: ScreenComparisonFollowupControls;
}) {
  if (!c.readinessReason) return null;
  return (
    <p id="screen-comparison-followup-readiness" role="status">
      {c.readinessReason}
      {c.saved.draft !== null && (
        <> Open Follow-ups to load the saved version or finish recovery.</>
      )}
    </p>
  );
}
export function ManagedScreenComparisonFollowupResult({
  controls: c,
}: {
  controls: ScreenComparisonFollowupControls;
}) {
  return (
    <>
      <p
        id="screen-comparison-followup-status"
        role="status"
        aria-live="polite"
      >
        {c.state.message}
      </p>
      {c.state.created && (
        <button
          id="screen-comparison-followup-review"
          type="button"
          className="trial-secondary"
          disabled={!c.canReview}
          onClick={(event) => c.review(event.currentTarget)}
        >
          Review created follow-up
        </button>
      )}
    </>
  );
}
