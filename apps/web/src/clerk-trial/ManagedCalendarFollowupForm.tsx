import type { RefObject } from "react";
import type { CalendarFollowupPreview } from "./managed-calendar-followup";
import { ListingIdentity } from "./ManagedListingIdentity";
import {
  useCalendarFollowupForm,
  type CalendarFormProps,
  type CalendarFollowupControls,
} from "./ManagedCalendarFollowupFormState";
import {
  CalendarCompanyChoice,
  CalendarListingDetails,
  CalendarQuestionFields,
  CalendarSourceEvidence,
} from "./ManagedCalendarFollowupFormFields";
import { useCalendarFormFocus } from "./ManagedCalendarFollowupFormFocus";
import { useCompleteCheckSize } from "./ManagedCalendarFollowupFormSizing";
interface ControlsProps {
  controls: CalendarFollowupControls;
}
interface PreviewProps extends ControlsProps {
  heading: RefObject<HTMLHeadingElement | null>;
  checkRef: RefObject<HTMLTextAreaElement | null>;
}
function CompleteCheck({
  value,
  checkRef,
}: {
  value: CalendarFollowupPreview;
  checkRef: PreviewProps["checkRef"];
}) {
  return (
    <>
      <label htmlFor="calendar-followup-check">
        Complete next check preview
      </label>
      <textarea
        id="calendar-followup-check"
        ref={checkRef}
        readOnly
        rows={6}
        value={value.check}
      />
      <p>
        Complete question and citation: {Array.from(value.check).length} / 500
        Unicode characters.
      </p>
    </>
  );
}
function PreviewIdentity({ value }: { value: CalendarFollowupPreview }) {
  return (
    <>
      <p>Due date (UTC): {value.dueOn}</p>
      <p>
        <ListingIdentity member={value.listing} />
      </p>
      <CalendarListingDetails
        listing={value.listing}
        summary="Complete preview listing identity"
      />
    </>
  );
}
function Preview({ controls, heading, checkRef }: PreviewProps) {
  const value = controls.preview;
  if (!value) return null;
  return (
    <section aria-label="Calendar next check preview">
      <h4 ref={heading} tabIndex={-1}>
        Review the complete cited check
      </h4>
      <CompleteCheck value={value} checkRef={checkRef} />
      <PreviewIdentity value={value} />
      <p>
        Only this complete question, listing and due date enter the Follow-ups
        draft. My Watchlist is unchanged. Save follow-ups remains a separate
        action.
      </p>
      <button
        id="calendar-followup-create"
        type="button"
        className="trial-secondary"
        onClick={controls.create}
      >
        Create follow-up draft
      </button>
    </section>
  );
}
function FollowupsLoad({ controls }: ControlsProps) {
  if (controls.saved.draft) return null;
  return (
    <>
      <button
        id="calendar-followup-load"
        type="button"
        className="trial-secondary"
        disabled={!controls.canLoad}
        onClick={controls.load}
      >
        {controls.saved.phase === "loading"
          ? "Loading follow-ups…"
          : "Load follow-ups for this question"}
      </button>
      {controls.saved.message && <p role="status">{controls.saved.message}</p>}
    </>
  );
}
function ReviewAndCancel({ controls }: ControlsProps) {
  return (
    <>
      {(controls.state.created || controls.existing) && (
        <button
          id="calendar-followup-review"
          type="button"
          className="trial-secondary"
          disabled={!controls.current}
          onClick={controls.review}
        >
          Review follow-up
        </button>
      )}
      <button
        id="calendar-followup-cancel"
        type="button"
        className="trial-secondary"
        onClick={controls.cancel}
      >
        Cancel question preview
      </button>
      <p id="calendar-followup-status" role="status" aria-live="polite">
        {controls.message}
      </p>
    </>
  );
}
function FollowupsControls(props: PreviewProps) {
  return (
    <>
      <FollowupsLoad controls={props.controls} />
      <button
        id="calendar-followup-preview"
        type="button"
        className="trial-secondary"
        disabled={!props.controls.canPreview}
        onClick={props.controls.prepare}
      >
        Preview next check
      </button>
      <Preview {...props} />
      <ReviewAndCancel controls={props.controls} />
    </>
  );
}
function SourceOwnedFields({
  capture,
  ...props
}: PreviewProps & Pick<CalendarFormProps, "capture">) {
  if (!capture) return null;
  return (
    <>
      <CalendarCompanyChoice controls={props.controls} />
      <CalendarQuestionFields controls={props.controls} />
      <FollowupsControls {...props} />
    </>
  );
}
function toggleOpen(controls: CalendarFollowupControls, open: boolean) {
  if (open !== controls.state.open) controls.toggle(open);
}
export function ManagedCalendarFollowupForm(props: CalendarFormProps) {
  const controls = useCalendarFollowupForm(props);
  const checkRef = useCompleteCheckSize(controls.preview?.check ?? null);
  const { heading, previewHeading } = useCalendarFormFocus(
    props,
    controls.preview,
  );
  return (
    <section
      id="managed-markets-calendar-followup"
      className="managed-calendar-followup"
      aria-label="Calendar source and dated check"
    >
      <details
        open={controls.state.open}
        onToggle={(event) => toggleOpen(controls, event.currentTarget.open)}
      >
        <summary>Keep a dated research check</summary>
        <h3 ref={heading} tabIndex={-1}>
          Selected source and independent company check
        </h3>
        <CalendarSourceEvidence capture={props.capture} />
        <SourceOwnedFields
          capture={props.capture}
          controls={controls}
          heading={previewHeading}
          checkRef={checkRef}
        />
      </details>
    </section>
  );
}
