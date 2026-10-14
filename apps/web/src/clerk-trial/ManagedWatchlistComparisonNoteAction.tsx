import { useId, useLayoutEffect, useRef, useState } from "react";
import {
  membershipMatchesResult,
  type ManagedEodIdentity,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedWatchlistComparisonSelection } from "./managed-watchlist-comparison";

export interface WatchlistComparisonNoteReviewCapture {
  readonly selection: ManagedWatchlistComparisonSelection;
  readonly leftShowingPrevious: boolean;
  readonly rightShowingPrevious: boolean;
}

export interface ManagedWatchlistComparisonNoteActions {
  getAction: (
    selection: ManagedWatchlistComparisonSelection,
    destination: ManagedEodIdentity | null,
  ) => { canAppend: boolean; reason: string | null };
  append: (
    selection: ManagedWatchlistComparisonSelection,
    destination: ManagedEodIdentity | null,
  ) => { appended: boolean; message: string };
  review: (
    capture: WatchlistComparisonNoteReviewCapture,
    member: WatchlistMembership,
    isCurrentChoice: () => boolean,
  ) => void;
}

interface Props {
  capture: WatchlistComparisonNoteReviewCapture;
  memberships: readonly WatchlistMembership[];
  pending: boolean;
  active: boolean;
  editable: boolean;
  actions: ManagedWatchlistComparisonNoteActions;
}
interface Destination {
  left: ManagedWatchlistComparisonSelection["left"];
  right: ManagedWatchlistComparisonSelection["right"];
  listing: ManagedEodIdentity | null;
}
interface Feedback {
  capture: WatchlistComparisonNoteReviewCapture;
  destination: Destination;
  message: string;
  refusal: ReturnType<
    ManagedWatchlistComparisonNoteActions["getAction"]
  > | null;
}
interface Success {
  capture: WatchlistComparisonNoteReviewCapture;
  destination: Destination;
}

function currentAction(props: Props, destination: Destination) {
  if (!props.active || !props.editable)
    return {
      canAppend: false,
      reason: "Return to an editable watchlist to add this comparison.",
    };
  return props.actions.getAction(props.capture.selection, destination.listing);
}

/** Destination is local presentation state; the workspace owns note admission. */
export function ManagedWatchlistComparisonNoteAction(props: Props) {
  const { capture, active, editable } = props;
  const { selection } = capture;
  const helpId = useId();
  const [stored, setDestination] = useState<Destination>({
    left: selection.left,
    right: selection.right,
    listing: null,
  });
  const destination =
    stored.left === selection.left && stored.right === selection.right
      ? stored
      : { left: selection.left, right: selection.right, listing: null };
  if (stored !== destination) setDestination(destination);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [storedSuccess, setSuccess] = useState<Success | null>(null);
  const member = destination.listing
    ? (props.memberships.find((candidate) =>
        membershipMatchesResult(candidate, destination.listing!),
      ) ?? null)
    : null;
  const success =
    active &&
    member &&
    storedSuccess?.capture === capture &&
    storedSuccess.destination === destination
      ? storedSuccess
      : null;
  if (storedSuccess !== success) setSuccess(success);
  const latest = useRef<{
    props: Props;
    destination: Destination;
    member: WatchlistMembership | null;
    success: Success | null;
  } | null>(null);
  useLayoutEffect(() => {
    latest.current = { props, destination, member, success };
    return () => {
      latest.current = null;
    };
  }, [props, destination, member, success]);
  const capturedCurrent = () => {
    const current = latest.current;
    return current?.props.active &&
      current.props.editable &&
      current.props.capture === capture &&
      current.destination === destination
      ? current
      : null;
  };
  const currentReview = () => {
    const current = latest.current;
    return success &&
      current?.success === success &&
      current.props.active &&
      !current.props.pending &&
      current.member &&
      current.props.capture === capture &&
      current.destination === destination
      ? current
      : null;
  };
  const action = currentAction(props, destination);
  return (
    <div className="managed-watchlist-comparison-note-action">
      <label htmlFor="managed-watchlist-comparison-note-destination">
        Add comparison to
      </label>
      <select
        id="managed-watchlist-comparison-note-destination"
        value={destination.listing?.listingId ?? ""}
        aria-disabled={!active || !editable}
        aria-describedby={helpId}
        onChange={(event) => {
          if (!capturedCurrent()) return;
          const value = event.currentTarget.value;
          const listing = [selection.left, selection.right].find(
            (source) => source?.listing.listingId === value,
          )?.listing;
          if (value !== "" && !listing) return;
          setDestination({ ...destination, listing: listing ?? null });
        }}
      >
        <option value="">Choose a note</option>
        {[selection.left, selection.right].map(
          (source, index) =>
            source && (
              <option key={index} value={source.listing.listingId}>
                {source.listing.symbol} · {source.listing.issuerName} ·{" "}
                {source.listing.shareClassName} · {source.listing.exchangeMic}
              </option>
            ),
        )}
      </select>
      <button
        type="button"
        className="trial-secondary"
        aria-disabled={!action.canAppend}
        aria-describedby={helpId}
        onClick={() => {
          const current = capturedCurrent();
          if (!current) return;
          const admitted = currentAction(current.props, destination);
          const result = admitted.canAppend
            ? current.props.actions.append(selection, destination.listing)
            : {
                appended: false,
                message:
                  admitted.reason ?? "This comparison cannot be added now.",
              };
          const after = latest.current;
          if (
            !after?.props.active ||
            after.props.capture !== capture ||
            after.destination !== destination
          )
            return;
          if (result.appended) setSuccess({ capture, destination });
          setFeedback({
            capture,
            destination,
            message: result.message,
            refusal: result.appended ? null : admitted,
          });
        }}
      >
        Add comparison to note draft
      </button>
      {success && (
        <button
          type="button"
          className="trial-secondary"
          aria-disabled={props.pending}
          onClick={() => {
            const current = currentReview();
            if (current)
              current.props.actions.review(
                capture,
                current.member!,
                () => currentReview() !== null,
              );
          }}
        >
          Review note
        </button>
      )}
      <p id={helpId}>
        {action.reason ??
          "Adds both listings, exact endpoints and original source dates to the chosen note draft. Review and Save separately."}
      </p>
      <FeedbackMessage
        feedback={feedback}
        capture={capture}
        destination={destination}
        action={action}
      />
    </div>
  );
}

function FeedbackMessage({
  feedback,
  capture,
  destination,
  action,
}: {
  feedback: Feedback | null;
  capture: WatchlistComparisonNoteReviewCapture;
  destination: Destination;
  action: ReturnType<ManagedWatchlistComparisonNoteActions["getAction"]>;
}) {
  const current =
    feedback?.capture === capture &&
    feedback.destination === destination &&
    (feedback.refusal === null ||
      (feedback.refusal.canAppend === action.canAppend &&
        feedback.refusal.reason === action.reason));
  return (
    <p
      className="managed-watchlist-comparison-note-status"
      role="status"
      aria-live="polite"
    >
      {current ? feedback.message : ""}
    </p>
  );
}
