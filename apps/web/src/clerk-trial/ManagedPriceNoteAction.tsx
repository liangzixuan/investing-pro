import { useId, useState } from "react";
import type {
  ManagedEodCloseDto,
  ManagedEodHistoryResponseDto,
} from "@research-cockpit/contracts";

export interface ManagedPriceNoteActions {
  getAction: (
    response: ManagedEodHistoryResponseDto,
    start: ManagedEodCloseDto,
  ) => { canAppend: boolean; reason: string | null };
  append: (
    response: ManagedEodHistoryResponseDto,
    start: ManagedEodCloseDto,
  ) => { appended: boolean; message: string };
}

export function ManagedPriceNoteAction({
  action,
  isCurrent,
  onAppend,
}: {
  action: ReturnType<ManagedPriceNoteActions["getAction"]>;
  isCurrent: () => boolean;
  onAppend: () => ReturnType<ManagedPriceNoteActions["append"]>;
}) {
  const helpId = useId();
  const [message, setMessage] = useState("");
  return (
    <div className="managed-price-note-action">
      <button
        className="trial-secondary"
        disabled={!action.canAppend}
        aria-describedby={helpId}
        onClick={() => {
          if (!isCurrent()) {
            setMessage(
              "The displayed price comparison changed. Choose a starting date again.",
            );
            return;
          }
          setMessage(onAppend().message);
        }}
      >
        Add comparison to note draft
      </button>
      <p id={helpId}>
        {action.reason ??
          "Adds the exact endpoints, raw change and original source dates to your existing note draft. Nothing is saved here."}
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
