import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  AnnualComparisonNoteCapture,
  AnnualComparisonNoteGroup,
} from "./managed-watchlist-annual-comparison-note";
import type {
  ManagedWatchlistAnnualComparisonMember as Member,
  ManagedWatchlistAnnualComparisonState as ComparisonState,
} from "./managed-watchlist-annual-comparison";

export interface ManagedWatchlistAnnualComparisonNoteActions {
  getAction: (
    capture: AnnualComparisonNoteCapture,
    destination: Member | null,
  ) => { canAppend: boolean; reason: string | null };
  append: (
    capture: AnnualComparisonNoteCapture,
    destination: Member | null,
  ) => { appended: boolean; message: string };
}

interface Props {
  state: ComparisonState;
  bases: { left: string | null; right: string | null };
  active: boolean;
  editable: boolean;
  actions: ManagedWatchlistAnnualComparisonNoteActions;
}
type Action = ReturnType<
  ManagedWatchlistAnnualComparisonNoteActions["getAction"]
>;
type Sources = readonly [
  Member | null,
  Member | null,
  ComparisonState["left"]["report"]["response"],
  ComparisonState["right"]["report"]["response"],
];
interface Destination {
  sources: Sources;
  member: Member | null;
}
interface Context {
  capture: AnnualComparisonNoteCapture | null;
  destination: Destination;
  group: AnnualComparisonNoteGroup;
  active: boolean;
  editable: boolean;
}
interface Feedback {
  context: Context;
  message: string;
  refusal: Action | null;
}

function currentAction(props: Props, context: Context): Action {
  if (!context.active || !context.editable)
    return {
      canAppend: false,
      reason: "Return to an editable watchlist to add this comparison.",
    };
  if (!context.capture)
    return {
      canAppend: false,
      reason: "Choose two companies and load both Annual reports.",
    };
  return props.actions.getAction(context.capture, context.destination.member);
}

function captureReports(
  props: Props,
  group: AnnualComparisonNoteGroup,
): AnnualComparisonNoteCapture | null {
  const { left, right } = props.state;
  if (
    !left.selected ||
    !right.selected ||
    !left.report.response ||
    !right.report.response
  )
    return null;
  return {
    group,
    left: {
      member: left.selected,
      response: left.report.response,
      selectedBasis: props.bases.left,
      showingPrevious: left.report.showingPrevious,
    },
    right: {
      member: right.selected,
      response: right.report.response,
      selectedBasis: props.bases.right,
      showingPrevious: right.report.showingPrevious,
    },
  };
}

/** Local choices only; the workspace owns evidence admission and draft mutation. */
export function ManagedWatchlistAnnualComparisonNoteAction(props: Props) {
  const helpId = useId();
  const [group, setGroup] = useState<AnnualComparisonNoteGroup>("income");
  const { left, right } = props.state;
  const sources: Sources = [
    left.selected,
    right.selected,
    left.report.response,
    right.report.response,
  ];
  const [stored, setDestination] = useState<Destination>({
    sources,
    member: null,
  });
  const destination = sources.every(
    (source, index) => source === stored.sources[index],
  )
    ? stored
    : { sources, member: null };
  if (destination !== stored) setDestination(destination);
  const capture = useMemo(
    () => captureReports(props, group),
    [
      group,
      left.selected,
      right.selected,
      left.report.response,
      right.report.response,
      left.report.showingPrevious,
      right.report.showingPrevious,
      props.bases.left,
      props.bases.right,
    ],
  );
  const active = props.active && props.state.active;
  const context = useMemo<Context>(
    () => ({ capture, destination, group, active, editable: props.editable }),
    [capture, destination, group, active, props.editable],
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const latest = useRef<{ props: Props; context: Context } | null>(null);
  useLayoutEffect(() => {
    latest.current = { props, context };
    return () => {
      latest.current = null;
    };
  }, [props, context]);
  const capturedCurrent = () => {
    const current = latest.current;
    return current?.context === context && context.active && context.editable
      ? current
      : null;
  };
  const action = currentAction(props, context);
  return (
    <div className="managed-annual-comparison-note-action">
      <label htmlFor="managed-annual-comparison-note-group">
        Evidence
        <select
          id="managed-annual-comparison-note-group"
          value={group}
          aria-disabled={!active || !props.editable}
          aria-describedby={helpId}
          onChange={(event) => {
            if (!capturedCurrent()) return;
            const value = event.currentTarget.value;
            if (value === "income" || value === "cash") setGroup(value);
          }}
        >
          <option value="income">Revenue and net income</option>
          <option value="cash">Cash generation</option>
        </select>
      </label>
      <label htmlFor="managed-annual-comparison-note-destination">
        Add Annual comparison to
        <select
          id="managed-annual-comparison-note-destination"
          value={destination.member?.listing.listingId ?? ""}
          aria-disabled={!active || !props.editable}
          aria-describedby={helpId}
          onChange={(event) => {
            if (!capturedCurrent()) return;
            const value = event.currentTarget.value;
            const member = [left.selected, right.selected].find(
              (item) => item?.listing.listingId === value,
            );
            if (value !== "" && !member) return;
            setDestination({ sources, member: member ?? null });
          }}
        >
          <option value="">Choose a note</option>
          {[left.selected, right.selected].map(
            (member, index) =>
              member && (
                <option key={index} value={member.listing.listingId}>
                  {member.listing.symbol} · {member.listing.issuerName} ·{" "}
                  {member.listing.shareClassName} · {member.listing.exchangeMic}
                </option>
              ),
          )}
        </select>
      </label>
      <button
        type="button"
        className="trial-secondary"
        aria-disabled={!action.canAppend}
        aria-describedby={helpId}
        onClick={() => {
          const current = capturedCurrent();
          if (!current || !context.capture) return;
          const admitted = currentAction(current.props, context);
          const result = admitted.canAppend
            ? current.props.actions.append(context.capture, destination.member)
            : {
                appended: false,
                message:
                  admitted.reason ?? "This comparison cannot be added now.",
              };
          setFeedback({
            context,
            message: result.message,
            refusal: result.appended ? null : admitted,
          });
        }}
      >
        Add Annual comparison to note draft
      </button>
      <p id={helpId} className="managed-annual-comparison-note-help">
        {action.reason ??
          "Adds both companies' selected evidence and original source dates to the chosen note draft. Review and Save separately."}
      </p>
      <FeedbackMessage feedback={feedback} context={context} action={action} />
    </div>
  );
}

function FeedbackMessage({
  feedback,
  context,
  action,
}: {
  feedback: Feedback | null;
  context: Context;
  action: Action;
}) {
  const current =
    feedback?.context === context &&
    (feedback.refusal === null ||
      (feedback.refusal.canAppend === action.canAppend &&
        feedback.refusal.reason === action.reason));
  return (
    <p
      className="managed-annual-comparison-note-status"
      role="status"
      aria-live="polite"
    >
      {current ? feedback.message : ""}
    </p>
  );
}
