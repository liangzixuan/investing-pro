import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ManagedEodIdentity } from "@research-cockpit/contracts";
import type { ManagedWatchlistComparisonSelection } from "./managed-watchlist-comparison";

export interface ManagedWatchlistComparisonNoteActions {
  getAction: (
    selection: ManagedWatchlistComparisonSelection,
    destination: ManagedEodIdentity | null,
  ) => { canAppend: boolean; reason: string | null };
  append: (
    selection: ManagedWatchlistComparisonSelection,
    destination: ManagedEodIdentity | null,
  ) => { appended: boolean; message: string };
}

interface Props {
  selection: ManagedWatchlistComparisonSelection;
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
  selection: ManagedWatchlistComparisonSelection;
  destination: Destination;
  message: string;
  refusal: ReturnType<
    ManagedWatchlistComparisonNoteActions["getAction"]
  > | null;
}

function currentAction(props: Props, destination: Destination) {
  if (!props.active || !props.editable)
    return {
      canAppend: false,
      reason: "Return to an editable watchlist to add this comparison.",
    };
  return props.actions.getAction(props.selection, destination.listing);
}

/** Destination is local presentation state; the workspace owns note admission. */
export function ManagedWatchlistComparisonNoteAction(props: Props) {
  const { selection, active, editable } = props;
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
  const latest = useRef<{ props: Props; destination: Destination } | null>(
    null,
  );
  useLayoutEffect(() => {
    latest.current = { props, destination };
    return () => {
      latest.current = null;
    };
  }, [props, destination]);
  const capturedCurrent = () => {
    const current = latest.current;
    return current?.props.active &&
      current.props.editable &&
      current.props.selection === selection &&
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
          setFeedback({
            selection,
            destination,
            message: result.message,
            refusal: result.appended ? null : admitted,
          });
        }}
      >
        Add comparison to note draft
      </button>
      <p id={helpId}>
        {action.reason ??
          "Adds both listings, exact endpoints and original source dates to the chosen note draft. Review and Save separately."}
      </p>
      <FeedbackMessage
        feedback={feedback}
        selection={selection}
        destination={destination}
        action={action}
      />
    </div>
  );
}

function FeedbackMessage({
  feedback,
  selection,
  destination,
  action,
}: {
  feedback: Feedback | null;
  selection: ManagedWatchlistComparisonSelection;
  destination: Destination;
  action: ReturnType<ManagedWatchlistComparisonNoteActions["getAction"]>;
}) {
  const current =
    feedback?.selection === selection &&
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
