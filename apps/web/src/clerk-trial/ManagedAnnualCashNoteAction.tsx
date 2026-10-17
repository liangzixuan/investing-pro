import { useId, useState } from "react";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";

export interface ManagedAnnualCashNoteActions {
  getAction: (response: PersonalSecAnnualCanonicalResponseDto) => {
    canAppend: boolean;
    reason: string | null;
  };
  append: (response: PersonalSecAnnualCanonicalResponseDto) => {
    appended: boolean;
    message: string;
  };
}

interface CashNoteFeedback {
  response: PersonalSecAnnualCanonicalResponseDto;
  message: string;
  refusal: ReturnType<ManagedAnnualCashNoteActions["getAction"]> | null;
}

export function ManagedAnnualCashNoteAction({
  response,
  actions,
}: {
  response: PersonalSecAnnualCanonicalResponseDto;
  actions: ManagedAnnualCashNoteActions;
}) {
  const helpId = useId();
  const [feedback, setFeedback] = useState<CashNoteFeedback>({
    response,
    message: "",
    refusal: null,
  });
  const action = actions.getAction(response);
  const currentFeedback =
    feedback.response === response &&
    (feedback.refusal === null ||
      (feedback.refusal.canAppend === action.canAppend &&
        feedback.refusal.reason === action.reason));
  return (
    <div className="managed-annual-note-action managed-annual-cash-note-action">
      <button
        type="button"
        className="trial-secondary"
        aria-disabled={!action.canAppend}
        aria-describedby={helpId}
        onClick={() => {
          const current = actions.getAction(response);
          const result = current.canAppend
            ? actions.append(response)
            : {
                appended: false,
                message:
                  current.reason ??
                  "This cash generation evidence cannot be added now.",
              };
          setFeedback({
            response,
            message: result.message,
            refusal: result.appended ? null : current,
          });
        }}
      >
        Add cash generation to note draft
      </button>
      <p id={helpId}>
        {action.reason ??
          "Adds the exact cash amounts, calculation, original dates and filing link to your existing note draft. Nothing is saved here."}
      </p>
      <p
        className="managed-annual-cash-note-status"
        role="status"
        aria-live="polite"
      >
        {currentFeedback ? feedback.message : ""}
      </p>
    </div>
  );
}
