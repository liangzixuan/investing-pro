import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  membershipMatchesResult,
  PERSONAL_BEA_CALENDAR_SOURCE,
  type PersonalEconomicCalendarEventDto,
  type PersonalEconomicCalendarDto,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedBeaReleaseAgendaState } from "./managed-bea-release-agenda";
import type { BeaReleaseNoteCapture } from "./managed-bea-release-note";
import { formatBeaReleaseDate } from "../features/markets/bea-release-dates";
import type { BeaReleaseView } from "../features/markets/bea-release-view";
import type { ManagedWorkspace } from "./managed-workspace";

export interface ManagedBeaReleaseNoteActions {
  getAction: ManagedWorkspace["getBeaReleaseNoteAction"];
  append: ManagedWorkspace["appendBeaReleaseToNote"];
}

export interface ManagedBeaReleaseNoteContext {
  members: readonly WatchlistMembership[];
  active: boolean;
  editable: boolean;
  actions: ManagedBeaReleaseNoteActions;
  onReview: (member: WatchlistMembership) => void;
}

interface Props extends ManagedBeaReleaseNoteContext {
  state: ManagedBeaReleaseAgendaState;
  view: BeaReleaseView;
}
interface Choices {
  response: PersonalEconomicCalendarDto | null;
  event: PersonalEconomicCalendarEventDto | null;
  member: WatchlistMembership | null;
  excluded: boolean;
}
type Action = ReturnType<ManagedBeaReleaseNoteActions["getAction"]>;
interface Feedback {
  capture: BeaReleaseNoteCapture | null;
  member: WatchlistMembership | null;
  message: string;
  refusal: Action | null;
  appended: boolean;
}

function actionFor(
  props: Props,
  capture: BeaReleaseNoteCapture | null,
  member: WatchlistMembership | null,
): Action {
  if (!props.active || !props.editable)
    return {
      canAppend: false,
      reason:
        "Return to Markets with an editable current watchlist before adding a release.",
    };
  if (props.state.busy)
    return {
      canAppend: false,
      reason: "Wait for the agenda request to finish or cancel it.",
    };
  return props.actions.getAction(capture, member);
}

const time = new Intl.DateTimeFormat("en-US", {
  timeZone: PERSONAL_BEA_CALENDAR_SOURCE.timeZone,
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/** Two explicit choices; the workspace admits the evidence and edits the note. */
export function ManagedBeaReleaseNoteAction(props: Props) {
  const helpId = useId();
  const releaseId = `${helpId}-release`;
  const memberId = `${helpId}-member`;
  const response = props.state.agenda;
  const [stored, setChoices] = useState<Choices>({
    response,
    event: null,
    member: null,
    excluded: false,
  });
  const groups =
    props.view.response === response ? props.view.visibleGroups : [];
  const visibleEvents = groups.flatMap((group) => group.events);
  const excluded =
    props.active &&
    stored.response === response &&
    stored.event !== null &&
    !visibleEvents.includes(stored.event);
  const event =
    props.active && stored.response === response && !excluded
      ? stored.event
      : null;
  const exclusionNotice =
    props.active &&
    stored.response === response &&
    (excluded || stored.excluded);
  const member =
    props.active && stored.member
      ? (props.members.find((entry) =>
          membershipMatchesResult(entry, stored.member!),
        ) ?? null)
      : null;
  if (
    stored.response !== response ||
    stored.event !== event ||
    stored.member !== member ||
    stored.excluded !== exclusionNotice
  )
    setChoices({ response, event, member, excluded: exclusionNotice });
  const capture = useMemo<BeaReleaseNoteCapture | null>(
    () =>
      response && event
        ? { response, event, showingPrevious: props.state.showingPrevious }
        : null,
    [response, event, props.state.showingPrevious],
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  if (
    feedback &&
    (!props.active ||
      excluded ||
      stored.response !== response ||
      (stored.member && !member))
  )
    setFeedback(null);
  const latest = useRef<Props | null>(null);
  useLayoutEffect(() => {
    latest.current = props;
    return () => {
      latest.current = null;
    };
  }, [props]);
  const current = () => latest.current === props && props.active;
  const choiceEnabled = props.active && props.editable && !props.state.busy;
  const action = actionFor(props, capture, member);
  const sameDestination =
    feedback?.member === member ||
    (feedback?.member &&
      member &&
      membershipMatchesResult(feedback.member, member));
  const sameFeedbackContext =
    props.active && feedback?.capture === capture && sameDestination;
  const currentFeedback =
    sameFeedbackContext &&
    (feedback.refusal === null ||
      (feedback.refusal.canAppend === action.canAppend &&
        feedback.refusal.reason === action.reason));
  const hasAppended = !!sameFeedbackContext && feedback.appended;
  const canReview = hasAppended && member !== null && choiceEnabled;
  return (
    <div className="managed-bea-note-action">
      <p>
        Choose a scheduled release for your note. The schedule does not confirm
        a release result or company relevance.
      </p>
      <div className="managed-bea-note-choices">
        <label htmlFor="managed-bea-note-release">
          Release
          <select
            id="managed-bea-note-release"
            value={
              event && response ? String(response.events.indexOf(event)) : ""
            }
            aria-disabled={!choiceEnabled}
            aria-describedby={`${releaseId} ${helpId}`}
            onChange={(input) => {
              if (!current() || !choiceEnabled) return;
              const value = input.currentTarget.value;
              const next = visibleEvents.find(
                (entry) => String(response!.events.indexOf(entry)) === value,
              );
              if (next || value === "") {
                setChoices({
                  response,
                  event: next ?? null,
                  member,
                  excluded: false,
                });
                setFeedback(null);
              }
            }}
          >
            <option value="">Choose a release</option>
            {groups.map((group) => (
              <optgroup key={group.key} label={group.label}>
                {group.events.map((entry) => (
                  <option
                    key={response!.events.indexOf(entry)}
                    value={String(response!.events.indexOf(entry))}
                  >
                    {time.format(new Date(entry.scheduledAt))} · {entry.series}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label htmlFor="managed-bea-note-destination">
          Add to note
          <select
            id="managed-bea-note-destination"
            value={member?.listingId ?? ""}
            aria-disabled={!choiceEnabled}
            aria-describedby={`${memberId} ${helpId}`}
            onChange={(input) => {
              if (!current() || !choiceEnabled) return;
              const value = input.currentTarget.value;
              const next = props.members.find(
                (entry) => entry.listingId === value,
              );
              if (next || value === "") {
                setChoices({
                  response,
                  event,
                  member: next ?? null,
                  excluded: false,
                });
                setFeedback(null);
              }
            }}
          >
            <option value="">Choose a note</option>
            {props.members.map((entry) => (
              <option key={entry.listingId} value={entry.listingId}>
                {entry.symbol} · {entry.issuerName} · {entry.shareClassName} ·{" "}
                {entry.exchangeMic}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p id={releaseId}>
        {event
          ? `Selected release: ${formatBeaReleaseDate(event.scheduledAt)}, ${time.format(new Date(event.scheduledAt))} · ${event.series}`
          : "No release chosen."}
      </p>
      {exclusionNotice && (
        <p role="status" aria-live="polite">
          The release filters changed, so the release choice was cleared. Choose
          a displayed release.
        </p>
      )}
      <p id={memberId}>
        {member
          ? `${member.symbol} · ${member.issuerName} · ${member.securityName} · ${member.shareClassName} · ${member.exchangeMic}`
          : "No note chosen."}
      </p>
      <div className="managed-bea-note-buttons">
        <button
          type="button"
          className="trial-secondary"
          aria-disabled={!action.canAppend}
          aria-describedby={helpId}
          onClick={() => {
            if (!current()) return;
            const admitted = actionFor(props, capture, member);
            if (!current()) return;
            const result = admitted.canAppend
              ? props.actions.append(capture, member)
              : {
                  appended: false,
                  message:
                    admitted.reason ?? "This release cannot be added now.",
                };
            setFeedback({
              capture,
              member,
              message: result.message,
              refusal: result.appended ? null : admitted,
              appended: result.appended || hasAppended,
            });
          }}
        >
          Add release to note draft
        </button>
        {hasAppended && (
          <button
            type="button"
            className="trial-secondary"
            aria-disabled={!canReview}
            onClick={() => {
              if (current() && canReview && member) props.onReview(member);
            }}
          >
            Review in My Watchlist
          </button>
        )}
      </div>
      <p id={helpId}>
        {action.reason ??
          "Adds the full scheduled-release reference and original dates to the chosen note draft. Nothing is saved here."}
      </p>
      <p
        className={
          "managed-bea-note-status" +
          (currentFeedback &&
          feedback.refusal !== null &&
          feedback.message === action.reason
            ? " sr-only"
            : "")
        }
        role="status"
        aria-live="polite"
      >
        {currentFeedback ? feedback.message : ""}
      </p>
    </div>
  );
}
