"use client";

import type { PersonalSavedManualPeerGroupDto } from "@research-cockpit/contracts";

export interface PersonalSavedManualPeerGroupControlsProps {
  readonly enabled: boolean;
  readonly loaded: boolean;
  readonly busy: boolean;
  readonly message: string;
  readonly currentPrimary: {
    readonly symbol: string;
    readonly issuerName: string;
  } | null;
  readonly currentPeers: readonly {
    readonly symbol: string;
    readonly issuerName: string;
  }[];
  readonly savedGroup: PersonalSavedManualPeerGroupDto | null;
  readonly canSave: boolean;
  readonly canRestore: boolean;
  readonly canClear: boolean;
  readonly saveUnavailableReason: string | null;
  readonly restoreUnavailableReason: string | null;
  readonly onLoad: () => void;
  readonly onSave: () => void;
  readonly onRestore: () => void;
  readonly onClear: () => void;
}

export function PersonalSavedManualPeerGroupControls({
  enabled,
  loaded,
  busy,
  message,
  currentPrimary,
  currentPeers,
  savedGroup,
  canSave,
  canRestore,
  canClear,
  saveUnavailableReason,
  restoreUnavailableReason,
  onLoad,
  onSave,
  onRestore,
  onClear,
}: PersonalSavedManualPeerGroupControlsProps) {
  return (
    <section
      className="financial-screen-saved saved-manual-peer-group"
      aria-labelledby="saved-manual-peer-group-title"
      aria-busy={busy}
    >
      <h3 id="saved-manual-peer-group-title">Saved manual peer group</h3>
      <p
        className="company-research-note-hint"
        id="saved-manual-peer-group-hint"
      >
        Keep one primary company and one to three ordered peers from My
        Watchlist. Saving replaces this group and stores company identities
        only. Prices, financials and comparison results are not saved. Sources
        require explicit loads.
      </p>
      <div className="saved-manual-peer-group-rosters">
        <section aria-labelledby="current-manual-peer-group-title">
          <h4 id="current-manual-peer-group-title">Current peer group</h4>
          <p>
            <strong>Primary company: </strong>
            {currentPrimary
              ? `${currentPrimary.symbol} · ${currentPrimary.issuerName}`
              : "Choose a company to research."}
          </p>
          <p>Peers in order</p>
          {currentPeers.length === 0 ? (
            <p>No peers selected.</p>
          ) : (
            <ol aria-label="Current peers in order">
              {currentPeers.map((peer, index) => (
                <li key={index}>
                  <strong>{peer.symbol}</strong> · {peer.issuerName}
                </li>
              ))}
            </ol>
          )}
        </section>
        <section aria-labelledby="loaded-manual-peer-group-title">
          <h4 id="loaded-manual-peer-group-title">Loaded saved peer group</h4>
          {!loaded ? (
            <p>
              Load saved peer group to see the group stored on this machine.
            </p>
          ) : savedGroup === null ? (
            <p>No saved peer group.</p>
          ) : (
            <>
              <p>
                <strong>Primary company: </strong>
                {savedGroup.primary.symbol} · {savedGroup.primary.issuerName}
              </p>
              <p>Peers in order</p>
              <ol aria-label="Loaded saved peers in order">
                {savedGroup.peers.map((peer) => (
                  <li key={peer.listingId}>
                    <strong>{peer.symbol}</strong> · {peer.issuerName}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
      <div className="company-research-note-actions">
        <button
          type="button"
          className="compact-action"
          disabled={!enabled || busy}
          onClick={onLoad}
          aria-describedby="saved-manual-peer-group-actions-hint"
        >
          Load saved peer group
        </button>
        <button
          type="button"
          className="compact-action"
          disabled={!enabled || !loaded || busy || !canSave}
          onClick={onSave}
          aria-describedby={
            saveUnavailableReason
              ? "saved-manual-peer-group-save-reason"
              : "saved-manual-peer-group-hint"
          }
        >
          Save this peer group
        </button>
        <button
          type="button"
          className="compact-action"
          disabled={!enabled || !loaded || busy || !canRestore}
          onClick={onRestore}
          aria-describedby={
            restoreUnavailableReason
              ? "saved-manual-peer-group-restore-reason"
              : "saved-manual-peer-group-actions-hint"
          }
        >
          Restore saved peer group
        </button>
        <button
          type="button"
          className="compact-action"
          disabled={!enabled || !loaded || busy || !canClear}
          onClick={onClear}
          aria-describedby="saved-manual-peer-group-actions-hint"
        >
          Clear saved peer group
        </button>
      </div>
      {saveUnavailableReason ? (
        <p
          id="saved-manual-peer-group-save-reason"
          className="company-research-note-hint"
        >
          {saveUnavailableReason}
        </p>
      ) : null}
      {restoreUnavailableReason ? (
        <p
          id="saved-manual-peer-group-restore-reason"
          className="company-research-note-hint"
        >
          {restoreUnavailableReason}
        </p>
      ) : null}
      <p
        id="saved-manual-peer-group-actions-hint"
        className="company-research-note-hint"
      >
        Load changes only the saved group shown here. Restore replaces all
        current peers and clears their loaded sources; it does not load new
        data. Clear removes only the saved group and keeps the current peers and
        their sources.
      </p>
      <p
        id="saved-manual-peer-group-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="discovery-status"
      >
        {message}
      </p>
    </section>
  );
}
