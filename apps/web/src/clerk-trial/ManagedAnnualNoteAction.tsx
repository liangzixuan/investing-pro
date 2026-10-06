import { useId, useState } from "react";
import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualPairDto,
} from "@research-cockpit/contracts";

export interface ManagedAnnualNoteActions {
  getAction: (
    response: PersonalSecAnnualEvidenceResponseDto,
    pair: PersonalSecAnnualPairDto,
  ) => { canAppend: boolean; reason: string | null };
  append: (
    response: PersonalSecAnnualEvidenceResponseDto,
    pair: PersonalSecAnnualPairDto,
  ) => { appended: boolean; message: string };
}

export function ManagedAnnualNoteAction({
  pair,
  action,
  onAppend,
}: {
  pair: PersonalSecAnnualPairDto;
  action: ReturnType<ManagedAnnualNoteActions["getAction"]>;
  onAppend: () => ReturnType<ManagedAnnualNoteActions["append"]>;
}) {
  const helpId = useId();
  const [message, setMessage] = useState("");
  return (
    <div className="managed-annual-note-action">
      <button
        className="trial-secondary"
        disabled={!action.canAppend}
        aria-label={`Add ${pair.concept} annual evidence to note draft`}
        aria-describedby={helpId}
        onClick={() => setMessage(onAppend().message)}
      >
        Add to note draft
      </button>
      <p id={helpId}>
        {action.reason ??
          "Adds this basis, exact values, original dates and filing link to your existing note draft. Nothing is saved here."}
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
