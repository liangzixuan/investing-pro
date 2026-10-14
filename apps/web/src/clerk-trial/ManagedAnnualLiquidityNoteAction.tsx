import { useId, useState } from "react";
import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";

export interface ManagedAnnualLiquidityNoteActions {
  getAction: (response: PersonalSecAnnualEvidenceResponseDto) => {
    canAppend: boolean;
    reason: string | null;
  };
  append: (response: PersonalSecAnnualEvidenceResponseDto) => {
    appended: boolean;
    message: string;
  };
}

interface LiquidityNoteFeedback {
  response: PersonalSecAnnualEvidenceResponseDto;
  message: string;
  refusal: ReturnType<ManagedAnnualLiquidityNoteActions["getAction"]> | null;
}

export function ManagedAnnualLiquidityNoteAction({
  response,
  actions,
}: {
  response: PersonalSecAnnualEvidenceResponseDto;
  actions: ManagedAnnualLiquidityNoteActions;
}) {
  const helpId = useId();
  const [feedback, setFeedback] = useState<LiquidityNoteFeedback>({
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
    <div className="managed-annual-note-action managed-annual-liquidity-note-action">
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
                  "This liquidity evidence cannot be added now.",
              };
          setFeedback({
            response,
            message: result.message,
            refusal: result.appended ? null : current,
          });
        }}
      >
        Add liquidity to note draft
      </button>
      <p id={helpId}>
        {action.reason ??
          "Adds the exact liquidity balances, calculation results, original dates and filing link to your existing note draft. Nothing is saved here."}
      </p>
      <p
        className={
          "managed-annual-liquidity-note-status" +
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
