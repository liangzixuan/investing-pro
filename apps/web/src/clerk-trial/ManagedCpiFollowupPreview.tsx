import type { RefObject } from "react";
import type { CalendarFollowupControls } from "./ManagedCalendarFollowupFormState";
import { CalendarListingDetails } from "./ManagedCalendarFollowupFormFields";
import { ListingIdentity } from "./ManagedListingIdentity";
export function ManagedCpiFollowupPreview({
  controls: c,
  heading,
  checkRef,
}: {
  controls: CalendarFollowupControls;
  heading: RefObject<HTMLHeadingElement | null>;
  checkRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const value = c.preview;
  if (!value) return null;
  return (
    <section aria-label="CPI next check preview">
      <h4 ref={heading} tabIndex={-1}>
        Review the complete cited check
      </h4>
      <label htmlFor="cpi-followup-check">Complete next check preview</label>
      <textarea
        id="cpi-followup-check"
        className="managed-cpi-complete-check"
        ref={checkRef}
        readOnly
        rows={6}
        value={value.check}
      />
      <p>
        Complete question and citation: {Array.from(value.check).length} / 500
        Unicode characters.
      </p>
      <p>Due date (UTC): {value.dueOn}</p>
      <p>
        <ListingIdentity member={value.listing} />
      </p>
      <CalendarListingDetails
        listing={value.listing}
        summary="Complete preview listing identity"
      />
      <p>
        Only this complete question, listing and due date enter the Follow-ups
        draft. My Watchlist is unchanged. Save follow-ups is separate.
      </p>
      <button
        id="cpi-followup-create"
        type="button"
        className="trial-secondary"
        onClick={c.create}
      >
        Create follow-up draft
      </button>
    </section>
  );
}
