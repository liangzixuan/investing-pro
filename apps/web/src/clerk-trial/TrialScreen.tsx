import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createTrialApi } from "./api";
import type { TrialApi } from "./api";
import { TrialController } from "./controller";
import type { TrialState } from "./controller";
import type { TrialSession } from "./session";

export function TrialSessionScreen({
  session,
  apiOrigin,
  api,
}: {
  session: TrialSession;
  apiOrigin: string;
  api?: TrialApi;
}) {
  return (
    <SessionWatchlist
      key={`${session.userId}:${session.sessionId}`}
      session={session}
      apiOrigin={apiOrigin}
      {...(api ? { api } : {})}
    />
  );
}

function SessionWatchlist({
  session,
  apiOrigin,
  api,
}: {
  session: TrialSession;
  apiOrigin: string;
  api?: TrialApi;
}) {
  const [input] = useState({ session, apiOrigin, api });
  const [controller, setController] = useState<TrialController | null>(null);
  useLayoutEffect(() => {
    const next = new TrialController(
      input.api ?? createTrialApi(input.apiOrigin, input.session),
      input.session,
    );
    setController(next);
    return () => next.retire();
  }, [input]);
  return controller ? (
    <ConnectedTrialScreen controller={controller} />
  ) : (
    <p role="status">Preparing this session…</p>
  );
}

function ConnectedTrialScreen({ controller }: { controller: TrialController }) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return <TrialScreen state={state} controller={controller} />;
}

export function TrialScreen({
  state,
  controller,
}: {
  state: TrialState;
  controller: TrialController;
}) {
  const busy = state.phase !== "idle";
  const retired = state.phase === "retired" || state.phase === "signing_out";
  const locked = busy || state.uncertain || state.baseVersion === null;
  return (
    <section className="trial-panel" aria-labelledby="watchlist-heading">
      <div className="trial-session-bar">
        <div>
          <p className="trial-eyebrow">Isolated shared-data trial</p>
          <h2 id="watchlist-heading">Your demo watchlist</h2>
        </div>
        <button
          type="button"
          className="trial-secondary"
          disabled={state.phase === "signing_out"}
          onClick={() => {
            void controller.signOut();
          }}
        >
          {state.signOutFailed ? "Retry sign-out" : "Sign out this session"}
        </button>
      </div>
      <p className="trial-status" role="status" aria-live="polite">
        {state.message}
      </p>
      {!retired && (
        <>
          <div className="trial-toolbar">
            <button
              type="button"
              className="trial-secondary"
              disabled={busy || state.uncertain}
              onClick={() => {
                void controller.load();
              }}
            >
              Load saved watchlist
            </button>
            <span>
              {state.saved
                ? `Saved version ${state.saved.version}`
                : "Not loaded"}
            </span>
          </div>
          <fieldset disabled={locked} className="trial-entries">
            <legend>Trial entries</legend>
            <p id="trial-entry-help">
              These are invented entries, with no prices or market data.
            </p>
            {(["DEMO_A", "DEMO_B"] as const).map((entry) => (
              <label className="trial-entry" key={entry}>
                <input
                  type="checkbox"
                  checked={state.draft.selected.includes(entry)}
                  aria-describedby="trial-entry-help"
                  onChange={(event) =>
                    controller.setSelected(entry, event.target.checked)
                  }
                />
                <span>
                  <strong>{entry}</strong>
                  <small>
                    {entry === "DEMO_A"
                      ? "Demo company A · supports a note"
                      : "Demo company B"}
                  </small>
                </span>
              </label>
            ))}
            <label className="trial-note-label" htmlFor="trial-note">
              Note for DEMO_A
            </label>
            <textarea
              id="trial-note"
              rows={4}
              maxLength={1000}
              value={state.draft.note}
              disabled={!state.draft.selected.includes("DEMO_A")}
              aria-describedby="trial-note-help"
              onChange={(event) => controller.setNote(event.target.value)}
            />
            <p id="trial-note-help">
              Up to 1,000 characters. Use invented information only. Removing
              DEMO_A clears its note.
            </p>
          </fieldset>
          {state.conflict && (
            <aside
              className="trial-review"
              aria-labelledby="trial-review-heading"
            >
              <h3 id="trial-review-heading">Review the saved version</h3>
              {!state.latestLoaded ? (
                <p>
                  Load the latest version before choosing how to continue. Your
                  draft above is unchanged.
                </p>
              ) : (
                <>
                  <p>
                    Version {state.saved?.version}:{" "}
                    {state.saved?.selected.join(", ") || "No entries"}
                  </p>
                  <p className="trial-saved-note">
                    {state.saved?.note || "No saved note"}
                  </p>
                  <p>
                    Keep your draft to replace this version on your next save,
                    or discard your draft and use the saved version.
                  </p>
                  <div className="trial-actions">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => controller.keepDraft()}
                    >
                      Keep my draft
                    </button>
                    <button
                      type="button"
                      className="trial-secondary"
                      disabled={busy}
                      onClick={() => controller.useSaved()}
                    >
                      Use saved version
                    </button>
                  </div>
                </>
              )}
            </aside>
          )}
          {state.uncertain && (
            <aside
              className="trial-review"
              aria-labelledby="trial-pending-heading"
            >
              <h3 id="trial-pending-heading">Resolve the pending save</h3>
              <p>
                Reconcile checks the original save. If it never reached the
                server, this action can complete it. It does not create a new
                edit.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void controller.reconcile();
                }}
              >
                Reconcile pending save
              </button>
            </aside>
          )}
          <div className="trial-actions">
            <button
              type="button"
              disabled={locked || state.conflict || !state.dirty}
              onClick={() => {
                void controller.save();
              }}
            >
              Save watchlist
            </button>
            <span>{state.dirty ? "Unsaved draft" : "No unsaved changes"}</span>
          </div>
        </>
      )}
      <p className="trial-session-help">
        Sign-out affects this session. Other signed-in devices keep their own
        sessions.
      </p>
    </section>
  );
}
