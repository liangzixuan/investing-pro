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
  const [feedback, setFeedback] = useState({ response, message: "" });
  const action = actions.getAction(response, filing);
  return (
    <div className="managed-filings-note-action">
      <button
        className="trial-secondary"
        aria-label={`Add Form ${filing.form} filing ${filing.accessionNumber} reference to note draft`}
        aria-disabled={!action.canAppend}
        aria-describedby={`managed-filings-note-scope ${helpId}`}
        onClick={() => {
          const current = actions.getAction(response, filing);
          setFeedback({
            response,
            message: current.canAppend
              ? actions.append(response, filing).message
              : (current.reason ??
                "This filing reference cannot be added now."),
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
        {feedback.response === response ? feedback.message : ""}
      </p>
    </div>
  );
}
