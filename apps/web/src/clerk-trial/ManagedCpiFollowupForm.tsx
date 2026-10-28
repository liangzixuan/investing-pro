import {
  CpiCompanyChoice,
  CpiQuestionFields,
} from "./ManagedCpiFollowupFormFields";
import { ManagedCpiFollowupPreview } from "./ManagedCpiFollowupPreview";
import {
  useCalendarFollowupForm,
  type CalendarFormProps,
} from "./ManagedCalendarFollowupFormState";
import { useCalendarFormFocus } from "./ManagedCalendarFollowupFormFocus";
import { useCompleteCheckSize } from "./ManagedCalendarFollowupFormSizing";
import { ManagedCpiHeadlineEvidence } from "./ManagedCpiHeadlineEvidence";
export function ManagedCpiFollowupForm(props: CalendarFormProps) {
  const c = useCalendarFollowupForm(props);
  const focus = useCalendarFormFocus(props, c.preview);
  const checkRef = useCompleteCheckSize(c.preview?.check ?? null);
  if (!props.capture) return null;
  return (
    <section
      className="managed-calendar-followup"
      id="managed-cpi-followup"
      aria-label="CPI headline and dated check"
    >
      <details
        open={c.state.open}
        onToggle={(e) => {
          if (e.currentTarget.open !== c.state.open)
            c.toggle(e.currentTarget.open);
        }}
      >
        <summary>Keep a dated CPI research check</summary>
        <h3 ref={focus.heading} tabIndex={-1}>
          Selected CPI headline and independent company check
        </h3>
        <ManagedCpiHeadlineEvidence capture={props.capture} />
        <CpiCompanyChoice controls={c} />
        <CpiQuestionFields controls={c} />
        {!c.saved.draft && (
          <>
            <button
              id="cpi-followup-load"
              type="button"
              className="trial-secondary"
              disabled={!c.canLoad}
              onClick={c.load}
            >
              {c.saved.phase === "loading"
                ? "Loading follow-ups…"
                : "Load follow-ups for this question"}
            </button>
            {c.saved.message && <p role="status">{c.saved.message}</p>}
          </>
        )}
        <button
          id="cpi-followup-preview"
          type="button"
          className="trial-secondary"
          disabled={!c.canPreview}
          onClick={c.prepare}
        >
          Preview next check
        </button>
        <ManagedCpiFollowupPreview
          controls={c}
          heading={focus.previewHeading}
          checkRef={checkRef}
        />
        {(c.state.created || c.existing) && (
          <button
            id="cpi-followup-review"
            type="button"
            className="trial-secondary"
            disabled={!c.current}
            onClick={c.review}
          >
            Review follow-up
          </button>
        )}
        <button
          id="cpi-followup-cancel"
          type="button"
          className="trial-secondary"
          onClick={c.cancel}
        >
          Cancel question preview
        </button>
        <p id="cpi-followup-status" role="status" aria-live="polite">
          {c.message}
        </p>
      </details>
    </section>
  );
}
