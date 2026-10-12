import { useId, useState } from "react";
import type {
  ManagedSecFilingsResponseDto,
  PersonalSecRecentFilingDto,
} from "@research-cockpit/contracts";

export interface ManagedFilingsNoteActions {
  getAction: (
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ) => { canAppend: boolean; reason: string | null };
  append: (
    response: ManagedSecFilingsResponseDto,
    filing: PersonalSecRecentFilingDto,
  ) => { appended: boolean; message: string };
}

interface FilingNoteFeedback {
  response: ManagedSecFilingsResponseDto;
  message: string;
  refusal: ReturnType<ManagedFilingsNoteActions["getAction"]> | null;
}

export function ManagedFilingsNoteAction({
  response,
  filing,
  actions,
}: {
  response: ManagedSecFilingsResponseDto;
  filing: PersonalSecRecentFilingDto;
  actions: ManagedFilingsNoteActions;
}) {
  const helpId = useId();
  const [feedback, setFeedback] = useState<FilingNoteFeedback>({
    response,
    message: "",
    refusal: null,
  });
  const action = actions.getAction(response, filing);
  const currentFeedback =
    feedback.response === response &&
    (feedback.refusal === null ||
      (feedback.refusal.canAppend === action.canAppend &&
        feedback.refusal.reason === action.reason));
  return (
    <div className="managed-filings-note-action">
      <button
        className="trial-secondary"
        aria-label={`Add Form ${filing.form} filing ${filing.accessionNumber} reference to note draft`}
        aria-disabled={!action.canAppend}
        aria-describedby={`managed-filings-note-scope ${helpId}`}
        onClick={() => {
          const current = actions.getAction(response, filing);
          const result = current.canAppend
            ? actions.append(response, filing)
            : {
                appended: false,
                message:
                  current.reason ??
                  "This filing reference cannot be added now.",
              };
          setFeedback({
            response,
            message: result.message,
            refusal: result.appended ? null : current,
          });
        }}
      >
        Add reference to note draft
      </button>
      <p id={helpId}>{action.reason}</p>
      <p
        className="managed-filings-note-status"
        role="status"
        aria-live="polite"
      >
        {currentFeedback ? feedback.message : ""}
      </p>
    </div>
  );
}
