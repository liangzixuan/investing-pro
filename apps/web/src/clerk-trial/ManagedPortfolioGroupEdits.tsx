import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import {
  ManagedPortfolioGroupEdits as GroupEditModel,
  PORTFOLIO_GROUP_HISTORY_LIMIT,
} from "./managed-portfolio-group-edits";
import { PersonalPortfolioLedgerEditor } from "../features/research/PersonalPortfolioLedgerEditor";
import { PortfolioGroupComparison } from "./PortfolioGroupComparison";

export function ManagedPortfolioGroupEdits({
  workspace,
  active,
  disabled,
}: {
  workspace: ManagedWorkspace;
  active: () => boolean;
  disabled: boolean;
}) {
  const current = useRef(active);
  current.current = active;
  const owner = useMemo(() => {
    const host = { mounts: 0 };
    return {
      host,
      model: new GroupEditModel(
        workspace,
        () => host.mounts > 0 && current.current(),
      ),
    };
  }, [workspace]);
  const model = owner.model;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  useEffect(() => {
    owner.host.mounts += 1;
    return () => {
      owner.host.mounts -= 1;
      queueMicrotask(() => {
        if (owner.host.mounts === 0) owner.model.dispose();
      });
    };
  }, [owner]);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusOwner = useRef<HTMLButtonElement | null>(null);
  const requestFocus = (owner: HTMLButtonElement) => {
    focusOwner.current =
      owner.ownerDocument.activeElement === owner ? owner : null;
  };
  useLayoutEffect(() => {
    const owner = focusOwner.current;
    focusOwner.current = null;
    const target = heading.current;
    if (
      owner &&
      target?.isConnected &&
      (target.ownerDocument.activeElement === owner ||
        (!owner.isConnected &&
          target.ownerDocument.activeElement === target.ownerDocument.body)) &&
      !target.closest("[hidden], [inert]") &&
      target.getClientRects().length > 0 &&
      current.current()
    )
      target.focus();
  }, [state]);
  const editing = state.phase === "editing";
  const preview = state.phase === "preview";
  const inGroup = editing || preview;
  return (
    <section
      id="managed-portfolio-group"
      data-phase={state.phase}
      aria-label="Grouped Portfolio edits"
    >
      <h3 id="managed-portfolio-group-heading" ref={heading} tabIndex={-1}>
        {preview
          ? "Review all group changes"
          : "Review a group of Portfolio edits"}
      </h3>
      <p>
        Work on several ledger changes together. Review their complete effect,
        then apply the group to your Portfolio draft. Review portfolio and Save
        Portfolio remain separate.
      </p>
      {!inGroup && (
        <button
          id="managed-portfolio-group-start"
          disabled={disabled}
          onClick={(event) => {
            if (!current.current()) return;
            requestFocus(event.currentTarget);
            model.start();
          }}
        >
          Start group of edits
        </button>
      )}
      {editing && state.candidate && (
        <PersonalPortfolioLedgerEditor
          ledger={state.candidate}
          profile="managed"
          destination="group"
          saveHelp="These edits belong to this group. Review all changes and Apply all changes before saving Portfolio."
          selectedListing={null}
          disabled={false}
          onPendingEditsChange={(pending) => {
            if (state.candidate)
              model.setEditorPending(state.candidate, pending);
          }}
          onChange={(next) => {
            if (state.candidate && next.schemaVersion === 3)
              model.replaceCandidate(state.candidate, next);
          }}
        />
      )}
      {editing && (
        <div aria-label="Group edit history">
          <p id="managed-portfolio-group-history-help">
            Keeps up to {PORTFOLIO_GROUP_HISTORY_LIMIT} recent edits in this
            group. Apply or reset unfinished forms before Undo or Redo.
            Cancelling or applying the group clears this history.
          </p>
          <p id="managed-portfolio-group-history-counts" aria-live="polite">
            Edits to undo: {state.undoCount}. Edits to redo: {state.redoCount}.
          </p>
          <div className="trial-actions">
            <button
              id="managed-portfolio-group-undo"
              className="trial-secondary"
              aria-describedby="managed-portfolio-group-history-help"
              disabled={state.formPending || state.undoCount === 0}
              onClick={(event) => {
                requestFocus(event.currentTarget);
                model.undo(state);
              }}
            >
              Undo group edit
            </button>
            <button
              id="managed-portfolio-group-redo"
              className="trial-secondary"
              aria-describedby="managed-portfolio-group-history-help"
              disabled={state.formPending || state.redoCount === 0}
              onClick={(event) => {
                requestFocus(event.currentTarget);
                model.redo(state);
              }}
            >
              Redo group edit
            </button>
          </div>
        </div>
      )}
      {preview &&
        state.baseline &&
        state.candidate &&
        state.before &&
        state.after &&
        state.evaluationDay && (
          <PortfolioGroupComparison
            baseline={state.baseline}
            candidate={state.candidate}
            before={state.before}
            after={state.after}
            evaluationDay={state.evaluationDay}
          />
        )}
      {inGroup && (
        <div className="trial-actions">
          {editing && (
            <button
              id="managed-portfolio-group-review"
              disabled={state.formPending}
              onClick={(event) => {
                requestFocus(event.currentTarget);
                model.preview();
              }}
            >
              Review all changes
            </button>
          )}
          {preview && (
            <>
              <button
                id="managed-portfolio-group-apply"
                onClick={(event) => {
                  requestFocus(event.currentTarget);
                  model.apply(state);
                }}
              >
                Apply all changes
              </button>
              <button
                id="managed-portfolio-group-edit"
                className="trial-secondary"
                onClick={(event) => {
                  requestFocus(event.currentTarget);
                  model.edit();
                }}
              >
                Continue editing group
              </button>
            </>
          )}
          <button
            id="managed-portfolio-group-cancel"
            className="trial-secondary"
            onClick={(event) => {
              requestFocus(event.currentTarget);
              model.cancel();
            }}
          >
            Cancel group
          </button>
        </div>
      )}
      {state.message && <p role="status">{state.message}</p>}
    </section>
  );
}
