import type { ScreenComparisonFollowupControls } from "./use-screen-comparison-followup-review";
import { isResearchFollowupDueDate } from "./managed-research-followups-date";

export function ManagedScreenComparisonFollowupFields({
  controls: c,
}: {
  controls: ScreenComparisonFollowupControls;
}) {
  return (
    <>
      <label htmlFor="screen-comparison-followup-company">
        Follow-ups company (required)
      </label>
      <select
        id="screen-comparison-followup-company"
        value={c.state.side}
        disabled={c.disabled || !c.state.capture}
        aria-describedby="screen-comparison-followup-destinations screen-comparison-followup-status"
        onChange={(event) => c.edit("side", event.currentTarget.value)}
      >
        <option value="">Choose one captured Watchlist company</option>
        {c.destinations.map(({ side, listing, eligible }) => (
          <option key={side} value={side} disabled={!eligible}>
            {side === "left" ? "Left" : "Right"}: {listing.symbol} ·{" "}
            {listing.issuerName} · {listing.shareClassName} ·{" "}
            {listing.exchangeMic}
          </option>
        ))}
      </select>
      <ul id="screen-comparison-followup-destinations">
        {c.destinations.map(({ side, listing, eligible, reason }) => (
          <li key={side}>
            {listing.symbol} · {listing.shareClassName} · {listing.exchangeMic}:{" "}
            {eligible ? "Available in the current editable Watchlist." : reason}
          </li>
        ))}
      </ul>
      <div className="managed-screen-comparison-followup-fields">
        <div>
          <label htmlFor="screen-comparison-followup-question">
            Research question (required, one line)
          </label>
          <textarea
            id="screen-comparison-followup-question"
            rows={3}
            value={c.state.question}
            disabled={c.disabled}
            aria-describedby="screen-comparison-followup-help screen-comparison-followup-status"
            onChange={(event) => c.edit("question", event.currentTarget.value)}
          />
        </div>
        <div>
          <label htmlFor="screen-comparison-followup-due">
            Due date (required, UTC, YYYY-MM-DD)
          </label>
          <input
            id="screen-comparison-followup-due"
            type="text"
            placeholder="YYYY-MM-DD"
            value={c.state.dueOn}
            disabled={c.disabled}
            aria-invalid={
              c.state.dueOn !== "" && !isResearchFollowupDueDate(c.state.dueOn)
            }
            aria-describedby="screen-comparison-followup-help screen-comparison-followup-status"
            onChange={(event) => c.edit("dueOn", event.currentTarget.value)}
          />
        </div>
      </div>
      <p id="screen-comparison-followup-help">
        The complete saved question and comparison reference must fit 500
        Unicode characters. Invalid or oversized text remains visible for
        correction; nothing is clipped. Choose the UTC due date independently of
        either company&apos;s source dates.
      </p>
    </>
  );
}
