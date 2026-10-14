import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  membershipMatchesResult,
  type PersonalMonetaryAnnouncementDto,
  type PersonalMonetaryAnnouncementsDto,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedFedAnnouncementsState } from "./managed-fed-announcements";
import type { FedAnnouncementNoteCapture } from "./managed-fed-announcement-note";
import type { ManagedWorkspace } from "./managed-workspace";

export interface ManagedFedAnnouncementNoteActions {
  getAction: ManagedWorkspace["getFedAnnouncementNoteAction"];
  append: ManagedWorkspace["appendFedAnnouncementToNote"];
}

export interface ManagedFedAnnouncementNoteContext {
  members: readonly WatchlistMembership[];
  active: boolean;
  editable: boolean;
  actions: ManagedFedAnnouncementNoteActions;
  onReview: () => void;
}

interface Props extends ManagedFedAnnouncementNoteContext {
  state: ManagedFedAnnouncementsState;
}
interface Choices {
  response: PersonalMonetaryAnnouncementsDto | null;
  item: PersonalMonetaryAnnouncementDto | null;
  member: WatchlistMembership | null;
}
type Action = ReturnType<ManagedFedAnnouncementNoteActions["getAction"]>;
interface Feedback {
  capture: FedAnnouncementNoteCapture | null;
  member: WatchlistMembership | null;
  message: string;
  refusal: Action | null;
  appended: boolean;
}

function actionFor(
  props: Props,
  capture: FedAnnouncementNoteCapture | null,
  member: WatchlistMembership | null,
): Action {
  if (!props.active || !props.editable)
    return {
      canAppend: false,
      reason:
        "Return to Markets with an editable current watchlist before adding an announcement.",
    };
  if (props.state.busy)
    return {
      canAppend: false,
      reason: "Wait for the announcements request to finish or cancel it.",
    };
  return props.actions.getAction(capture, member);
}

/** Two explicit choices; the workspace admits the evidence and edits the note. */
export function ManagedFedAnnouncementNoteAction(props: Props) {
  const helpId = useId();
  const announcementId = `${helpId}-announcement`;
  const memberId = `${helpId}-member`;
  const response = props.state.announcements;
  const [stored, setChoices] = useState<Choices>({
    response,
    item: null,
    member: null,
  });
  const item =
    props.active && stored.response === response ? stored.item : null;
  const member =
    props.active && stored.member
      ? (props.members.find((entry) =>
          membershipMatchesResult(entry, stored.member!),
        ) ?? null)
      : null;
  if (
    stored.response !== response ||
    stored.item !== item ||
    stored.member !== member
  )
    setChoices({ response, item, member });
  const capture = useMemo<FedAnnouncementNoteCapture | null>(
    () =>
      response && item
        ? { response, item, showingPrevious: props.state.showingPrevious }
        : null,
    [response, item, props.state.showingPrevious],
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  if (
    feedback &&
    (!props.active ||
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
  const canReview = hasAppended && !props.state.busy;
  return (
    <div className="managed-fed-note-action">
      <p>
        Choose a reference for your note. This does not identify company news or
        an investment effect.
      </p>
      <div className="managed-fed-note-choices">
        <label htmlFor="managed-fed-note-announcement">
          Announcement
          <select
            id="managed-fed-note-announcement"
            value={item?.url ?? ""}
            aria-disabled={!choiceEnabled}
            aria-describedby={`${announcementId} ${helpId}`}
            onChange={(event) => {
              if (!current() || !choiceEnabled) return;
              const value = event.currentTarget.value;
              const next = response?.items.find((entry) => entry.url === value);
              if (next || value === "") {
                setChoices({ response, item: next ?? null, member });
                setFeedback(null);
              }
            }}
          >
            <option value="">Choose an announcement</option>
            {response?.items.map((entry) => (
              <option key={entry.url} value={entry.url}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="managed-fed-note-destination">
          Add to note
          <select
            id="managed-fed-note-destination"
            value={member?.listingId ?? ""}
            aria-disabled={!choiceEnabled}
            aria-describedby={`${memberId} ${helpId}`}
            onChange={(event) => {
              if (!current() || !choiceEnabled) return;
              const value = event.currentTarget.value;
              const next = props.members.find(
                (entry) => entry.listingId === value,
              );
              if (next || value === "") {
                setChoices({ response, item, member: next ?? null });
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
      <p id={announcementId}>
        {item
          ? `Selected announcement: ${item.title}`
          : "No announcement chosen."}
      </p>
      <p id={memberId}>
        {member
          ? `${member.symbol} · ${member.issuerName} · ${member.securityName} · ${member.shareClassName} · ${member.exchangeMic}`
          : "No note chosen."}
      </p>
      <div className="managed-fed-note-buttons">
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
                    admitted.reason ?? "This announcement cannot be added now.",
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
          Add announcement to note draft
        </button>
        {hasAppended && (
          <button
            type="button"
            className="trial-secondary"
            aria-disabled={!canReview}
            onClick={() => {
              if (current() && canReview) props.onReview();
            }}
          >
            Review in My Watchlist
          </button>
        )}
      </div>
      <p id={helpId}>
        {action.reason ??
          "Adds the full announcement reference and original dates to the chosen note draft. Nothing is saved here."}
      </p>
      <p
        className={
          "managed-fed-note-status" +
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
