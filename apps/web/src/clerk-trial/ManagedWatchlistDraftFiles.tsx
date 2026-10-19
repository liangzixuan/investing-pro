import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  normalizeWatchlistNote,
  type MainWatchlistPayload,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedWatchlistDraftFileDeliveryAdapter } from "./managed-watchlist-draft-file-delivery";
import {
  ManagedWatchlistDraftRecovery,
  type WatchlistDraftRecoveryState,
} from "./managed-watchlist-draft-recovery";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";

interface Props {
  workspace: ManagedWorkspace;
  accountScope: Promise<string>;
  delivery: ManagedWatchlistDraftFileDeliveryAdapter | undefined;
  routeActive: () => boolean;
  onRestored: () => void;
}
const empty: WatchlistDraftRecoveryState = Object.freeze({
  phase: "idle",
  preview: null,
  currentDraft: null,
  currentSavedVersion: null,
  canExport: false,
  canImport: false,
  message: "",
});
const noop = () => () => {};
const emptySnapshot = () => empty;

function DraftListings({ draft }: { draft: MainWatchlistPayload }) {
  if (!draft.memberships.length) return <p>No listings in this draft.</p>;
  return (
    <ol className="managed-draft-file-list">
      {draft.memberships.map((member) => (
        <li key={member.listingId}>
          <p>
            <ListingIdentity member={member} />
          </p>
          <p className="trial-saved-note">
            {member.note === "" ? "No note" : member.note}
          </p>
          {normalizeWatchlistNote(member.note) === null && (
            <p>Correct this note before Save watchlist can accept it.</p>
          )}
          <details>
            <summary>Listing identity</summary>
            <dl className="managed-metadata">
              {(
                Object.keys(identityLabels) as (keyof typeof identityLabels)[]
              ).map((key) => (
                <div key={key}>
                  <dt>{identityLabels[key]}</dt>
                  <dd>{member[key]}</dd>
                </div>
              ))}
            </dl>
          </details>
        </li>
      ))}
    </ol>
  );
}

function useDraftFiles(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const [controller, setController] =
    useState<ManagedWatchlistDraftRecovery | null>(null);
  const { workspace, accountScope, delivery } = props;
  useLayoutEffect(() => {
    const next = new ManagedWatchlistDraftRecovery({
      workspace,
      accountScope,
      delivery,
      routeActive: () => latest.current.routeActive(),
    });
    setController(next);
    return () => next.dispose();
  }, [workspace, accountScope, delivery]);
  useLayoutEffect(() => controller?.reconcile());
  const state = useSyncExternalStore(
    controller?.subscribe ?? noop,
    controller?.getSnapshot ?? emptySnapshot,
    controller?.getSnapshot ?? emptySnapshot,
  );
  return { controller, state };
}

export function ManagedWatchlistDraftFiles(props: Props) {
  const { controller, state } = useDraftFiles(props);
  const input = useRef<HTMLInputElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const previousPhase = useRef(state.phase);
  const restoreInputFocus = useRef(false);
  useLayoutEffect(() => {
    if (restoreInputFocus.current && state.phase === "idle") {
      restoreInputFocus.current = false;
      if (state.canImport) input.current?.focus();
    }
    if (state.phase === "retired") restoreInputFocus.current = false;
    if (
      previousPhase.current === "reading" &&
      state.phase === "review" &&
      document.activeElement === input.current
    )
      heading.current?.focus();
    previousPhase.current = state.phase;
  }, [state.phase, state.canImport]);
  const preview = state.preview;
  function cancel() {
    restoreInputFocus.current = true;
    controller?.cancel();
  }
  return (
    <details id="managed-watchlist-draft-files">
      <summary>Draft files</summary>
      <p>
        Keep a copy of unconfirmed Watchlist edits before leaving. The JSON file
        contains your notes in plain text. Store it privately.
      </p>
      <p>
        Selecting a file reads it locally. Restoring it replaces only this
        screen&apos;s draft. Review and Save watchlist remain separate.
      </p>
      <button
        type="button"
        className="trial-secondary"
        disabled={!state.canExport}
        aria-busy={state.phase === "exporting"}
        onClick={() => void controller?.exportDraft()}
      >
        {state.phase === "exporting" ? "Saving draft file…" : "Save draft file"}
      </button>
      <label className="managed-draft-file-input">
        Select a Watchlist draft file
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          disabled={!state.canImport}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void controller?.readFile(file);
          }}
        />
      </label>
      {!state.canImport && !preview && (
        <p>
          Load the saved Watchlist and finish any save or catalog recovery
          before selecting a file.
        </p>
      )}
      {!state.canExport && state.canImport && (
        <p>Edit your Watchlist to save an unconfirmed draft file.</p>
      )}
      {(state.phase === "reading" || state.phase === "exporting") && (
        <button type="button" className="trial-secondary" onClick={cancel}>
          Cancel file operation
        </button>
      )}
      {preview && state.currentDraft && (
        <section
          className="trial-review"
          aria-labelledby="managed-draft-file-review-heading"
        >
          <h3
            id="managed-draft-file-review-heading"
            ref={heading}
            tabIndex={-1}
          >
            Review the complete file draft
          </h3>
          <p>
            File reports capture time {preview.capturedAt} and base version{" "}
            {preview.baseVersion}. Loaded saved version{" "}
            {state.currentSavedVersion} will remain unchanged.
          </p>
          <p>
            Restoring replaces all current draft listings, notes and order.
            Another device can still save a newer version; the normal Save
            conflict checks apply.
          </p>
          <p>
            File metadata does not verify its contents or capture time. After
            restoration, use Review catalog changes to check every listing
            against the current catalog before Save.
          </p>
          <h4>File draft · {preview.draft.memberships.length} listings</h4>
          <DraftListings draft={preview.draft} />
          <details>
            <summary>
              Current draft that will be replaced ·{" "}
              {state.currentDraft.memberships.length} listings
            </summary>
            <DraftListings draft={state.currentDraft} />
          </details>
          <div className="trial-toolbar">
            <button
              type="button"
              onClick={() => {
                if (controller?.restoreDraft()) props.onRestored();
              }}
            >
              Restore file to current draft
            </button>
            <button type="button" className="trial-secondary" onClick={cancel}>
              Keep current draft
            </button>
          </div>
        </section>
      )}
      <p role="status">
        {state.phase === "reading"
          ? "Reading the selected file locally…"
          : state.message}
      </p>
    </details>
  );
}
