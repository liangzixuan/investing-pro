import { useLayoutEffect, useRef, type RefObject } from "react";
import { calendarFollowupEvidence } from "./managed-calendar-followup";
import { isResearchFollowupDueDate } from "./managed-research-followups-date";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import {
  useCalendarFollowupForm,
  type CalendarFormProps,
  type CalendarFollowupControls,
} from "./ManagedCalendarFollowupFormState";

function SourceEvidence({ capture }: Pick<CalendarFormProps, "capture">) {
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
        {evidence.window && (
          <div>
            <dt>Loaded window (UTC)</dt>
            <dd>
              {evidence.window.fromInclusive} (inclusive) to{" "}
              {evidence.window.toExclusive} (exclusive)
            </dd>
          </div>
        )}
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
function Company({ controls }: { controls: CalendarFollowupControls }) {
  const member = controls.state.member;
  return (
    <>
      <label htmlFor="calendar-followup-company">
        Choose a My Watchlist company independently (required)
      </label>
      <select
        id="calendar-followup-company"
        value={member?.listingId ?? ""}
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
      {member && (
        <>
          <p>
            <ListingIdentity member={member} />
          </p>
          <details>
            <summary>Complete selected company identity</summary>
            <dl>
              {Object.entries(identityLabels).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{member[key as keyof typeof identityLabels]}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
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
function Fields({ controls }: { controls: CalendarFollowupControls }) {
  return (
    <>
      <div className="managed-calendar-followup-fields">
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
            Authored question: {Array.from(controls.state.question).length}{" "}
            Unicode characters.
          </p>
        </div>
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
            onChange={(event) =>
              controls.edit("dueOn", event.currentTarget.value)
            }
          />
        </div>
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
function fitCompleteCheck(node: HTMLTextAreaElement) {
  node.style.height = "0px";
  const border = node.offsetHeight - node.clientHeight;
  node.style.height = `${Math.ceil(node.scrollHeight + border)}px`;
}
function useCompleteCheckSize(check: string | null) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const view = node?.ownerDocument.defaultView;
    if (!node || !view || check === null) return;
    let active = true;
    let width = -1;
    let frame: number | null = null;
    const fit = () => {
      if (!active) return;
      const nextWidth = node.getBoundingClientRect().width;
      // Ignore notifications caused only by our own height update.
      if (nextWidth <= 0 || nextWidth === width) return;
      width = nextWidth;
      fitCompleteCheck(node);
    };
    const resize = () => {
      if (!active || frame !== null) return;
      frame = view.requestAnimationFrame(() => {
        frame = null;
        fit();
      });
    };
    fit();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(node);
    if (!observer) view.addEventListener("resize", resize);
    return () => {
      active = false;
      observer?.disconnect();
      view.removeEventListener("resize", resize);
      if (frame !== null) view.cancelAnimationFrame(frame);
    };
  }, [check]);
  return ref;
}
function Preview({
  controls,
  heading,
  checkRef,
}: {
  controls: CalendarFollowupControls;
  heading: RefObject<HTMLHeadingElement | null>;
  checkRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const value = controls.preview;
  if (!value) return null;
  return (
    <section aria-label="Calendar next check preview">
      <h4 ref={heading} tabIndex={-1}>
        Review the complete cited check
      </h4>
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
      <p>Due date (UTC): {value.dueOn}</p>
      <p>
        <ListingIdentity member={value.listing} />
      </p>
      <details>
        <summary>Complete preview listing identity</summary>
        <dl>
          {Object.entries(identityLabels).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{value.listing[key as keyof typeof identityLabels]}</dd>
            </div>
          ))}
        </dl>
      </details>
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
function FollowupsControls({
  controls,
  heading,
  checkRef,
}: {
  controls: CalendarFollowupControls;
  heading: RefObject<HTMLHeadingElement | null>;
  checkRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <>
      {!controls.saved.draft && (
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
          {controls.saved.message && (
            <p role="status">{controls.saved.message}</p>
          )}
        </>
      )}
      <button
        id="calendar-followup-preview"
        type="button"
        className="trial-secondary"
        disabled={!controls.canPreview}
        onClick={controls.prepare}
      >
        Preview next check
      </button>
      <Preview controls={controls} heading={heading} checkRef={checkRef} />
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
export function ManagedCalendarFollowupForm(props: CalendarFormProps) {
  const controls = useCalendarFollowupForm(props);
  const checkRef = useCompleteCheckSize(controls.preview?.check ?? null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const previewHeading = useRef<HTMLHeadingElement | null>(null);
  useLayoutEffect(() => {
    if (!controls.preview) return;
    previewHeading.current?.focus({ preventScroll: true });
    previewHeading.current?.scrollIntoView({ block: "nearest" });
  }, [controls.preview]);
  useLayoutEffect(() => {
    if (!props.capture || !props.isCurrent() || props.navigationPending) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest" });
  }, [props.capture]);
  return (
    <section
      id="managed-markets-calendar-followup"
      className="managed-calendar-followup"
      aria-label="Calendar source and dated check"
    >
      <details
        open={controls.state.open}
        onToggle={(event) => {
          if (event.currentTarget.open !== controls.state.open)
            controls.toggle(event.currentTarget.open);
        }}
      >
        <summary>Keep a dated research check</summary>
        <h3 ref={heading} tabIndex={-1}>
          Selected source and independent company check
        </h3>
        <SourceEvidence capture={props.capture} />
        {props.capture && (
          <>
            <Company controls={controls} />
            <Fields controls={controls} />
            <FollowupsControls
              controls={controls}
              heading={previewHeading}
              checkRef={checkRef}
            />
          </>
        )}
      </details>
    </section>
  );
}
