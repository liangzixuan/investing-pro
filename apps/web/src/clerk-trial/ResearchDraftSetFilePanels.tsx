import {
  RESEARCH_DRAFT_RESOURCES,
  researchDraftResourceLabel,
} from "./managed-research-draft-set-file";
import type { ResearchDraftSetRecoveryState } from "./managed-research-draft-set-recovery";
import type { ResearchDraftSetActions } from "./useResearchDraftSetFiles";
import type { ResearchDraftSetFileFocus } from "./useResearchDraftSetFileFocus";
import { ResearchDraftMemberReadout } from "./ResearchDraftSetReadout";
interface Props {
  state: ResearchDraftSetRecoveryState;
  available: boolean;
  actions: ResearchDraftSetActions;
  focus: ResearchDraftSetFileFocus;
}
export function ResearchDraftSetFileControls({
  state,
  available,
  actions,
  focus,
}: Props) {
  return (
    <>
      {state.phase === "reading" && (
        <button
          id="managed-research-draft-set-cancel"
          type="button"
          disabled={!available}
          onClick={(e) => actions.cancel(e.currentTarget)}
        >
          Cancel file operation
        </button>
      )}
      <fieldset disabled={!available || state.phase !== "idle"}>
        <legend>Choose loaded resource drafts</legend>
        <div className="managed-research-draft-set-choices">
          {RESEARCH_DRAFT_RESOURCES.map((key) => (
            <label key={key}>
              <input
                id={`managed-research-draft-set-select-${key}`}
                type="checkbox"
                checked={state.selected.includes(key)}
                disabled={
                  !state.eligibility[key] && !state.selected.includes(key)
                }
                onChange={(event) =>
                  actions.select(key, event.currentTarget.checked)
                }
              />
              {researchDraftResourceLabel(key)}
              {!state.eligibility[key] && (
                <span>
                  {" "}
                  · Load and finish this resource&apos;s form, save, recovery or
                  identity review.
                </span>
              )}
            </label>
          ))}
        </div>
      </fieldset>
      <button
        id="managed-research-draft-set-capture"
        ref={focus.capture}
        type="button"
        disabled={!available || !state.canCapture}
        onClick={(e) => actions.capture(e.currentTarget)}
      >
        Capture selected drafts
      </button>
      <label className="managed-draft-file-input">
        Select a research draft-set file
        <input
          id="managed-research-draft-set-file"
          ref={focus.input}
          type="file"
          accept="application/json,.json"
          disabled={!available || !state.canImport}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) actions.read(event.currentTarget, file);
          }}
        />
      </label>
    </>
  );
}
function Inventory({ state, available, actions, focus }: Props) {
  const file = state.file;
  if (!file) return null;
  const captured = state.phase === "capture" || state.phase === "exporting";
  return (
    <section
      aria-label={
        captured ? "Captured research drafts" : "Complete draft-set file"
      }
    >
      <p>
        Reported file capture time: {file.capturedAt}. File metadata does not
        verify contents, identities or capture time.
      </p>
      <p>
        Omitted resources:{" "}
        {file.omitted.length
          ? file.omitted.map(researchDraftResourceLabel).join(", ")
          : "none"}
        .
      </p>
      {RESEARCH_DRAFT_RESOURCES.map((key) => {
        const member = file.members[key];
        if (!member) return null;
        return (
          <section
            key={key}
            aria-label={`${researchDraftResourceLabel(key)} file draft`}
          >
            <h4>{researchDraftResourceLabel(key)}</h4>
            <ResearchDraftMemberReadout content={member} />
            {state.phase === "inventory" && (
              <button
                id={`managed-research-draft-set-compare-${key}`}
                ref={focus[key]}
                type="button"
                disabled={!available}
                onClick={(event) => actions.compare(key, event.currentTarget)}
              >
                Compare {researchDraftResourceLabel(key)} draft
              </button>
            )}
          </section>
        );
      })}
    </section>
  );
}
function Comparison({ state, available, actions }: Props) {
  const c = state.comparison;
  if (!c) return null;
  return (
    <>
      <p>
        {researchDraftResourceLabel(c.resource)} · Current online save base:{" "}
        {c.currentBase}. This saved base stays unchanged.
      </p>
      <section aria-label="Complete file resource draft">
        <h4>Complete file resource draft</h4>
        <ResearchDraftMemberReadout content={c.fileContent} />
      </section>
      <section aria-label="Complete current resource draft">
        <h4>Complete current resource draft</h4>
        {c.currentContent ? (
          <ResearchDraftMemberReadout content={c.currentContent} />
        ) : (
          <p>
            This Portfolio is loaded but has no initialized ledger. It is
            different from an unloaded resource.
          </p>
        )}
      </section>
      <div className="trial-actions">
        <button
          id="managed-research-draft-set-restore"
          type="button"
          disabled={!available}
          onClick={(e) => actions.restore(e.currentTarget)}
        >
          Restore this resource draft
        </button>
        <button
          id="managed-research-draft-set-cancel"
          type="button"
          className="trial-secondary"
          disabled={!available}
          onClick={(e) => actions.cancel(e.currentTarget)}
        >
          Keep current draft
        </button>
      </div>
    </>
  );
}
export function ResearchDraftSetFileReview(props: Props) {
  const { state, available, actions, focus } = props;
  if (!state.file) return null;
  return (
    <section
      className="trial-review"
      aria-labelledby="managed-research-draft-set-review-heading"
    >
      <h3
        id="managed-research-draft-set-review-heading"
        ref={focus.heading}
        tabIndex={-1}
      >
        {state.phase === "comparison"
          ? "Compare one resource draft"
          : state.phase === "capture" || state.phase === "exporting"
            ? "Inspect the captured research drafts"
            : "Review the complete research draft-set file"}
      </h3>
      {state.comparison ? <Comparison {...props} /> : <Inventory {...props} />}
      <div className="trial-actions">
        {state.phase === "capture" && (
          <button
            id="managed-research-draft-set-save-file"
            type="button"
            disabled={!available}
            onClick={actions.save}
          >
            Save captured draft-set file
          </button>
        )}
        {(state.phase === "capture" || state.phase === "exporting") && (
          <button
            id="managed-research-draft-set-cancel"
            type="button"
            disabled={!available}
            onClick={(e) => actions.cancel(e.currentTarget)}
          >
            Keep current draft
          </button>
        )}
        <button
          id="managed-research-draft-set-close"
          type="button"
          className="trial-secondary"
          disabled={!available}
          onClick={(e) => actions.close(e.currentTarget)}
        >
          Close draft-set file
        </button>
      </div>
    </section>
  );
}
export function ResearchDraftSetFileStatus({ state }: Pick<Props, "state">) {
  return (
    <p role="status">
      {state.phase === "reading"
        ? "Reading the draft-set file locally…"
        : state.phase === "exporting"
          ? "Saving the draft-set file…"
          : state.message}
    </p>
  );
}
