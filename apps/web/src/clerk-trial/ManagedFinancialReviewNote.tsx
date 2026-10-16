import { useId, useLayoutEffect, useRef, useState } from "react";
import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import type {
  PersonalSecAnnualFinancialReviewKey,
  PersonalSecAnnualFinancialReviewRow,
} from "@research-cockpit/personal-financial-analytics";
import type { ResearchWatchlistState } from "./managed-workspace";
import type {
  FinancialReviewPreparation,
  ManagedFinancialReviewActions,
  PreparedFinancialReview,
} from "./managed-financial-review";

function noteBlock(watchlist: ResearchWatchlistState, running: boolean) {
  if (running)
    return "Wait for the Annual report request to finish or cancel it.";
  if (watchlist.canEdit && watchlist.member) return null;
  return (
    watchlist.reason ??
    "Add this company to the watchlist draft to prepare a financial review."
  );
}

/** Own only unadded choices and presentation. The workspace owns preview authority. */
function useFinancialReviewDraft(
  response: PersonalSecAnnualEvidenceResponseDto,
  actions: ManagedFinancialReviewActions,
  blocked: boolean,
) {
  const [keys, setKeys] = useState<
    readonly PersonalSecAnnualFinancialReviewKey[]
  >([]);
  const [preparation, setPreparation] =
    useState<FinancialReviewPreparation | null>(null);
  const [message, setMessage] = useState("");
  const live = useRef(false);
  const choiceRevision = useRef(0);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const revision = choiceRevision.current;
  const canAct = () =>
    live.current && choiceRevision.current === revision && !blocked;
  const preview = preparation?.preview ?? null;
  const current = preview !== null && actions.isCurrent(preview);
  return {
    keys,
    preview,
    current,
    message,
    reason:
      preview && !current
        ? "The note, source or visit changed. Preview the financial review again."
        : preparation?.reason,
    change: (key: PersonalSecAnnualFinancialReviewKey, checked: boolean) => {
      choiceRevision.current++;
      setKeys((previous) =>
        checked ? [...previous, key] : previous.filter((item) => item !== key),
      );
      setPreparation(null);
      setMessage("");
    },
    prepare: () => {
      if (!canAct()) return;
      setPreparation(actions.prepare(response, keys));
      setMessage("");
    },
    append: () => {
      if (!canAct() || !preview || !actions.isCurrent(preview)) return;
      const result = actions.append(preview);
      setMessage(result.message);
      if (result.appended) setPreparation(null);
    },
  };
}

function FinancialReviewChoices({
  rows,
  keys,
  blocked,
  id,
  onChange,
}: {
  readonly rows: readonly PersonalSecAnnualFinancialReviewRow[];
  readonly keys: readonly PersonalSecAnnualFinancialReviewKey[];
  readonly blocked: boolean;
  readonly id: string;
  readonly onChange: (
    key: PersonalSecAnnualFinancialReviewKey,
    checked: boolean,
  ) => void;
}) {
  return (
    <fieldset disabled={blocked} aria-describedby={`${id}-help ${id}-status`}>
      <legend>Facts to include</legend>
      {rows.map((row) => (
        <label key={row.key}>
          <input
            type="checkbox"
            checked={keys.includes(row.key)}
            onChange={(event) => onChange(row.key, event.currentTarget.checked)}
          />
          {row.label}
        </label>
      ))}
    </fieldset>
  );
}

function FinancialReviewPreview({
  preview,
  current,
  blocked,
  onAppend,
}: {
  readonly preview: PreparedFinancialReview;
  readonly current: boolean;
  readonly blocked: boolean;
  readonly onAppend: () => void;
}) {
  return (
    <div
      className="managed-financial-review-preview"
      aria-label="Complete financial review note preview"
    >
      <h5>{current ? "Complete note preview" : "Previous note preview"}</h5>
      <p className="trial-saved-note">{preview.note}</p>
      <button
        type="button"
        className="trial-secondary"
        disabled={blocked || !current}
        onClick={onAppend}
      >
        Add financial review to note draft
      </button>
    </div>
  );
}

export function ManagedFinancialReviewNote({
  response,
  rows,
  actions,
  watchlist,
  running,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
  readonly rows: readonly PersonalSecAnnualFinancialReviewRow[];
  readonly actions: ManagedFinancialReviewActions;
  readonly watchlist: ResearchWatchlistState;
  readonly running: boolean;
}) {
  const id = useId();
  const block = noteBlock(watchlist, running);
  const blocked = block !== null;
  const draft = useFinancialReviewDraft(response, actions, blocked);
  return (
    <details className="managed-financial-review-note">
      <summary>Add financial facts to the note draft</summary>
      <p id={`${id}-help`}>
        Select the facts to include. Preview shows the complete note with source
        dates, references and any unavailable or historical qualifications. If
        it exceeds 2,000 characters, select fewer facts or edit the note.
        Nothing is saved automatically.
      </p>
      <FinancialReviewChoices
        rows={rows}
        keys={draft.keys}
        blocked={blocked}
        id={id}
        onChange={draft.change}
      />
      <button
        type="button"
        className="trial-secondary"
        disabled={blocked || draft.keys.length === 0}
        onClick={draft.prepare}
      >
        Preview financial review
      </button>
      {draft.preview && (
        <FinancialReviewPreview
          preview={draft.preview}
          current={draft.current}
          blocked={blocked}
          onAppend={draft.append}
        />
      )}
      <p id={`${id}-status`} role="status" aria-live="polite">
        {draft.message ||
          block ||
          draft.reason ||
          (draft.keys.length
            ? "Preview the complete note before adding these facts."
            : "Select at least one fact to preview.")}
      </p>
    </details>
  );
}
