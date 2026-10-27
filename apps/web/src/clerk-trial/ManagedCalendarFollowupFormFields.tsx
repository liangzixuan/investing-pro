import type { ResearchFollowup } from "@research-cockpit/contracts";
import {
  calendarFollowupEvidence,
  type CalendarFollowupEvidence,
} from "./managed-calendar-followup";
import { isResearchFollowupDueDate } from "./managed-research-followups-date";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import type {
  CalendarFormProps,
  CalendarFollowupControls,
} from "./ManagedCalendarFollowupFormState";
interface ControlsProps {
  controls: CalendarFollowupControls;
}
export function CalendarListingDetails({
  listing,
  summary,
}: {
  listing: ResearchFollowup["listing"];
  summary: string;
}) {
  return (
    <details>
      <summary>{summary}</summary>
      <dl>
        {Object.entries(identityLabels).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{listing[key as keyof typeof identityLabels]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
function SourceClock({ evidence }: { evidence: CalendarFollowupEvidence }) {
  return (
    <>
      <div>
        <dt>
          {evidence.timeKind === "scheduled"
            ? "Scheduled time (UTC)"
            : "Publication time (UTC)"}
        </dt>
        <dd>{evidence.instant ?? "Unknown"}</dd>
      </div>
      <div>
        <dt>Retrieved (UTC)</dt>
        <dd>{evidence.fetchedAt}</dd>
      </div>
    </>
  );
}
function SourceWindow({
  window,
}: {
  window: CalendarFollowupEvidence["window"];
}) {
  if (!window) return null;
  return (
    <div>
      <dt>Loaded window (UTC)</dt>
      <dd>
        {window.fromInclusive} (inclusive) to {window.toExclusive} (exclusive)
      </dd>
    </div>
  );
}
export function CalendarSourceEvidence({
  capture,
}: Pick<CalendarFormProps, "capture">) {
  const evidence = capture && calendarFollowupEvidence(capture.source);
  if (!evidence) return <p>Choose one loaded item with Keep a dated check.</p>;
  return (
    <section aria-label="Selected calendar source">
      <h4>{evidence.title}</h4>
      <dl>
        <div>
          <dt>Source</dt>
          <dd>{evidence.sourceName}</dd>
        </div>
        <SourceClock evidence={evidence} />
        <SourceWindow window={evidence.window} />
        <div>
          <dt>Original source URL</dt>
          <dd>
            <a href={evidence.url} target="_blank" rel="noopener noreferrer">
              {evidence.url}
            </a>
          </dd>
        </div>
      </dl>
      {evidence.showingPrevious && (
        <p role="status">
          Retained previous source. This attempt has not confirmed newer source
          data.
        </p>
      )}
      <p>
        Scheduled items do not confirm publication or released values. A
        selected company does not establish relevance. The authored due date
        stays separate from source and retrieval times.
      </p>
    </section>
  );
}
function CompanyOptions({ controls }: ControlsProps) {
  return (
    <>
      <label htmlFor="calendar-followup-company">
        Choose a My Watchlist company independently (required)
      </label>
      <select
        id="calendar-followup-company"
        value={controls.state.member?.listingId ?? ""}
        disabled={!controls.canChoose}
        onChange={(event) => controls.choose(event.currentTarget.value)}
      >
        <option value="">Choose a company</option>
        {controls.members.map((item) => (
          <option key={item.listingId} value={item.listingId}>
            {item.symbol} · {item.issuerName} · {item.shareClassName} ·{" "}
            {item.exchangeMic}
          </option>
        ))}
      </select>
    </>
  );
}
function SelectedCompany({ controls }: ControlsProps) {
  const member = controls.state.member;
  if (!member) return null;
  return (
    <>
      <p>
        <ListingIdentity member={member} />
      </p>
      <CalendarListingDetails
        listing={member}
        summary="Complete selected company identity"
      />
    </>
  );
}
export function CalendarCompanyChoice({ controls }: ControlsProps) {
  return (
    <>
      <CompanyOptions controls={controls} />
      {!controls.canChoose && (
        <p>
          Use Manage My Watchlist to load or review an editable company draft.
          This form does not load it automatically.
        </p>
      )}
      <p>
        No company is selected automatically. This action does not infer that
        this source concerns a company.
      </p>
      <SelectedCompany controls={controls} />
      <button
        id="calendar-followup-watchlist"
        type="button"
        className="trial-secondary"
        disabled={!controls.current}
        onClick={controls.manageWatchlist}
      >
        Manage My Watchlist
      </button>
    </>
  );
}
function QuestionField({ controls }: ControlsProps) {
  return (
    <div>
      <label htmlFor="calendar-followup-question">
        Research question (required, one line)
      </label>
      <textarea
        id="calendar-followup-question"
        rows={3}
        value={controls.state.question}
        disabled={!controls.current}
        aria-describedby="calendar-followup-help calendar-followup-status"
        onChange={(event) =>
          controls.edit("question", event.currentTarget.value)
        }
      />
      <p>
        Authored question: {Array.from(controls.state.question).length} Unicode
        characters.
      </p>
    </div>
  );
}
function DueField({ controls }: ControlsProps) {
  return (
    <div>
      <label htmlFor="calendar-followup-due">
        Due date (required, UTC, YYYY-MM-DD)
      </label>
      <input
        id="calendar-followup-due"
        type="text"
        placeholder="YYYY-MM-DD"
        value={controls.state.dueOn}
        disabled={!controls.current}
        aria-invalid={
          controls.state.dueOn !== "" &&
          !isResearchFollowupDueDate(controls.state.dueOn)
        }
        aria-describedby="calendar-followup-help calendar-followup-status"
        onChange={(event) => controls.edit("dueOn", event.currentTarget.value)}
      />
    </div>
  );
}
export function CalendarQuestionFields({ controls }: ControlsProps) {
  return (
    <>
      <div className="managed-calendar-followup-fields">
        <QuestionField controls={controls} />
        <DueField controls={controls} />
      </div>
      <p id="calendar-followup-help">
        The complete question and citation must fit 500 Unicode characters on
        one line. No text is clipped. Preview before creating an independent
        Follow-ups draft entry. The 20-entry and existing-company limits still
        apply.
      </p>
    </>
  );
}
