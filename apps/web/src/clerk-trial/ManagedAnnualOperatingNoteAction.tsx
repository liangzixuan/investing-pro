import { useId, useState } from "react";
import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualOperatingMarginDto,
} from "@research-cockpit/contracts";

export interface ManagedAnnualOperatingNoteActions {
  getAction: (
    response: PersonalSecAnnualEvidenceResponseDto,
    basis: PersonalSecAnnualOperatingMarginDto,
  ) => {
    canAppend: boolean;
    reason: string | null;
  };
  append: (
    response: PersonalSecAnnualEvidenceResponseDto,
    basis: PersonalSecAnnualOperatingMarginDto,
  ) => {
    appended: boolean;
    message: string;
  };
}

interface OperatingNoteFeedback {
  response: PersonalSecAnnualEvidenceResponseDto;
  basis: PersonalSecAnnualOperatingMarginDto;
  message: string;
  refusal: ReturnType<ManagedAnnualOperatingNoteActions["getAction"]> | null;
}

export function ManagedAnnualOperatingNoteAction({
  response,
  basis,
  actions,
}: {
  response: PersonalSecAnnualEvidenceResponseDto;
  basis: PersonalSecAnnualOperatingMarginDto;
  actions: ManagedAnnualOperatingNoteActions;
}) {
  const helpId = useId();
  const [feedback, setFeedback] = useState<OperatingNoteFeedback>({
    response,
    basis,
    message: "",
    refusal: null,
  });
  const action = actions.getAction(response, basis);
  const currentFeedback =
    feedback.response === response &&
    feedback.basis === basis &&
    (feedback.refusal === null ||
      (feedback.refusal.canAppend === action.canAppend &&
        feedback.refusal.reason === action.reason));
  return (
    <div className="managed-annual-note-action managed-annual-operating-note-action">
      <button
        type="button"
        className="trial-secondary"
        aria-disabled={!action.canAppend}
        aria-describedby={helpId}
        onClick={() => {
          const current = actions.getAction(response, basis);
          const result = current.canAppend
            ? actions.append(response, basis)
            : {
                appended: false,
                message:
                  current.reason ??
                  "This operating evidence cannot be added now.",
              };
          setFeedback({
            response,
            basis,
            message: result.message,
            refusal: result.appended ? null : current,
          });
        }}
      >
        Add operating results to note draft
      </button>
      <p id={helpId}>
        {action.reason ??
          "Adds the exact operating income, chosen revenue, margin, original dates and filing link to your existing note draft. Nothing is saved here."}
      </p>
      <p
        className={
          "managed-annual-operating-note-status" +
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
