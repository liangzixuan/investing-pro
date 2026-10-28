import type { CalendarFollowupControls } from "./ManagedCalendarFollowupFormState";
import { CalendarListingDetails } from "./ManagedCalendarFollowupFormFields";
import { ListingIdentity } from "./ManagedListingIdentity";
import { isResearchFollowupDueDate } from "./managed-research-followups-date";
export function CpiCompanyChoice({
  controls: c,
}: {
  controls: CalendarFollowupControls;
}) {
  return (
    <>
      <label htmlFor="cpi-followup-company">
        Choose a My Watchlist company independently (required)
      </label>
      <select
        id="cpi-followup-company"
        value={c.state.member?.listingId ?? ""}
        disabled={!c.canChoose}
        onChange={(e) => c.choose(e.currentTarget.value)}
      >
        <option value="">Choose a company</option>
        {c.members.map((m) => (
          <option key={m.listingId} value={m.listingId}>
            {m.symbol} · {m.issuerName} · {m.shareClassName} · {m.exchangeMic}
          </option>
        ))}
      </select>
      <p>
        No company is selected automatically. This headline does not establish
        relevance to a company.
      </p>
      {c.state.member && (
        <>
          <p>
            <ListingIdentity member={c.state.member} />
          </p>
          <CalendarListingDetails
            listing={c.state.member}
            summary="Complete selected company identity"
          />
        </>
      )}
      <button
        type="button"
        className="trial-secondary"
        disabled={!c.current}
        onClick={c.manageWatchlist}
      >
        Manage My Watchlist
      </button>
      {!c.canChoose && (
        <p>
          Load or review an editable My Watchlist draft separately. This form
          does not load it automatically.
        </p>
      )}
    </>
  );
}
export function CpiQuestionFields({
  controls: c,
}: {
  controls: CalendarFollowupControls;
}) {
  return (
    <>
      <div className="managed-calendar-followup-fields">
        <div>
          <label htmlFor="cpi-followup-question">
            Research question (required, one line)
          </label>
          <textarea
            id="cpi-followup-question"
            rows={3}
            value={c.state.question}
            disabled={!c.current}
            aria-describedby="cpi-followup-help cpi-followup-status"
            onChange={(e) => c.edit("question", e.currentTarget.value)}
          />
        </div>
        <div>
          <label htmlFor="cpi-followup-due">
            Due date (required, UTC, YYYY-MM-DD)
          </label>
          <input
            id="cpi-followup-due"
            type="text"
            placeholder="YYYY-MM-DD"
            value={c.state.dueOn}
            disabled={!c.current}
            aria-invalid={
              c.state.dueOn !== "" && !isResearchFollowupDueDate(c.state.dueOn)
            }
            aria-describedby="cpi-followup-help cpi-followup-status"
            onChange={(e) => c.edit("dueOn", e.currentTarget.value)}
          />
        </div>
      </div>
      <p id="cpi-followup-help">
        The complete question and original citation must fit 500 Unicode
        characters on one line. Nothing is clipped. The 20-entry and
        existing-company limits apply. Source clocks do not set the due date.
      </p>
    </>
  );
}
