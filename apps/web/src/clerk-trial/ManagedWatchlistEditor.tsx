import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  normalizeWatchlistNote,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import { ListingIdentity } from "./ManagedListingIdentity";
import { ManagedNoteEditor } from "./ManagedNoteEditor";
import "./managed-watchlist.css";

export interface ManagedWatchlistEditorHandle {
  focusFirstInvalidNote: () => void;
}

export interface ManagedWatchlistEditorProps {
  memberships: readonly WatchlistMembership[];
  editable: boolean;
  active: boolean;
  canOpenAnnual: (member: WatchlistMembership) => boolean;
  canOpenEod: (member: WatchlistMembership) => boolean;
  onNote: (listingId: string, note: string) => void;
  onMove: (listingId: string, direction: -1 | 1) => void;
  onRemove: (listingId: string) => void;
  onOpenAnnual: (
    member: WatchlistMembership,
    opener: HTMLButtonElement,
  ) => void;
  onOpenEod: (member: WatchlistMembership, opener: HTMLButtonElement) => void;
  ref?: Ref<ManagedWatchlistEditorHandle>;
}

type FocusRequest =
  | { kind: "note"; listingId: string; note: string }
  | { kind: "removal"; removedId: string; listingId: string | null };

/** Selection is local presentation state; all note bytes stay in the shared draft. */
export function ManagedWatchlistEditor({
  memberships,
  editable,
  active,
  canOpenAnnual,
  canOpenEod,
  onNote,
  onMove,
  onRemove,
  onOpenAnnual,
  onOpenEod,
  ref,
}: ManagedWatchlistEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    memberships[0]?.listingId ?? null,
  );
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const editor = useRef<HTMLDivElement | null>(null);
  const selected =
    memberships.find((member) => member.listingId === selectedId) ??
    memberships[0];
  const selectedIndex = selected ? memberships.indexOf(selected) : -1;

  useEffect(() => {
    const currentId = selected?.listingId ?? null;
    if (selectedId !== currentId) setSelectedId(currentId);
  }, [selected?.listingId, selectedId]);

  useImperativeHandle(
    ref,
    () => ({
      focusFirstInvalidNote() {
        if (!active || !editable) return;
        const invalid = memberships.find(
          (member) => normalizeWatchlistNote(member.note) === null,
        );
        if (!invalid) return;
        setSelectedId(invalid.listingId);
        setFocusRequest({
          kind: "note",
          listingId: invalid.listingId,
          note: invalid.note,
        });
      },
    }),
    [active, editable, memberships],
  );

  useLayoutEffect(() => {
    if (!focusRequest) return;
    setFocusRequest(null);
    const panel = editor.current;
    if (!active || !editable || !panel?.isConnected) return;
    if (focusRequest.kind === "note") {
      if (
        selected?.listingId !== focusRequest.listingId ||
        selected.note !== focusRequest.note ||
        normalizeWatchlistNote(selected.note) !== null
      )
        return;
      const field = panel.querySelector<HTMLTextAreaElement>(
        "textarea[data-managed-note-listing-id]",
      );
      if (
        field?.isConnected &&
        !field.disabled &&
        field.dataset.managedNoteListingId === selected.listingId &&
        field.value === focusRequest.note &&
        field.getClientRects().length > 0
      )
        field.focus();
      return;
    }
    if (
      memberships.some((member) => member.listingId === focusRequest.removedId)
    )
      return;
    const target = focusRequest.listingId
      ? Array.from(
          panel.querySelectorAll<HTMLButtonElement>(
            "button[data-watchlist-selection]",
          ),
        ).find(
          (button) =>
            button.dataset.watchlistSelection === focusRequest.listingId,
        )
      : panel.querySelector<HTMLElement>("[data-watchlist-empty]");
    if (target?.isConnected && target.getClientRects().length > 0)
      target.focus();
  }, [active, editable, focusRequest, memberships, selected]);

  return (
    <div className="managed-watchlist-editor" ref={editor}>
      {selected ? (
        <>
          <div className="managed-watchlist-choices">
            <p className="managed-watchlist-count">
              {memberships.length}{" "}
              {memberships.length === 1 ? "listing" : "listings"}
            </p>
            <ol aria-label="Watchlist listings">
              {memberships.map((member) => (
                <li key={member.listingId}>
                  <button
                    type="button"
                    className="managed-watchlist-choice"
                    data-watchlist-selection={member.listingId}
                    aria-label={`Edit research note for ${member.symbol}, ${member.shareClassName}, ${member.exchangeMic}`}
                    aria-pressed={selected.listingId === member.listingId}
                    aria-controls="managed-watchlist-selected-note"
                    onClick={() => {
                      setFocusRequest(null);
                      setSelectedId(member.listingId);
                    }}
                  >
                    <strong>{member.symbol}</strong>
                    <span>{member.issuerName}</span>
                    <small>
                      {member.shareClassName} · {member.exchangeMic} ·{" "}
                      {member.instrumentType === "adr" ? "ADR" : "Common stock"}
                    </small>
                    {normalizeWatchlistNote(member.note) === null && (
                      <span className="managed-watchlist-invalid">
                        Note needs correction
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <section
            id="managed-watchlist-selected-note"
            className="managed-watchlist-detail"
            aria-labelledby="managed-watchlist-selected-heading"
          >
            <header>
              <p className="managed-watchlist-eyebrow">Selected listing</p>
              <h3 id="managed-watchlist-selected-heading">
                <ListingIdentity member={selected} />
              </h3>
              <small className="managed-listing-detail">
                Listing ID: {selected.listingId}
              </small>
            </header>
            <div className="trial-actions managed-watchlist-research-actions">
              <button
                type="button"
                className="trial-secondary"
                disabled={!canOpenAnnual(selected)}
                aria-label={`Annual report for saved ${selected.symbol}`}
                onClick={(event) => onOpenAnnual(selected, event.currentTarget)}
              >
                Annual report
              </button>
              <button
                type="button"
                className="trial-secondary"
                disabled={!canOpenEod(selected)}
                aria-label={`EOD close history for saved ${selected.symbol}`}
                onClick={(event) => onOpenEod(selected, event.currentTarget)}
              >
                EOD close history
              </button>
            </div>
            <div className="managed-watchlist-note">
              <ManagedNoteEditor
                key={selected.listingId}
                id={`managed-note-${selectedIndex}`}
                listingId={selected.listingId}
                symbol={selected.symbol}
                note={selected.note}
                disabled={!editable}
                helpId="managed-watchlist-note-help"
                onChange={(note) => onNote(selected.listingId, note)}
              />
            </div>
            <div className="trial-actions managed-watchlist-order-actions">
              <button
                type="button"
                className="trial-secondary"
                disabled={!editable || selectedIndex === 0}
                aria-label={`Move ${selected.symbol} up`}
                onClick={() => onMove(selected.listingId, -1)}
              >
                Move up
              </button>
              <button
                type="button"
                className="trial-secondary"
                disabled={!editable || selectedIndex === memberships.length - 1}
                aria-label={`Move ${selected.symbol} down`}
                onClick={() => onMove(selected.listingId, 1)}
              >
                Move down
              </button>
              <button
                type="button"
                className="trial-secondary managed-watchlist-remove"
                disabled={!editable}
                aria-label={`Remove ${selected.symbol}`}
                onClick={() => {
                  const next =
                    memberships[selectedIndex + 1] ??
                    memberships[selectedIndex - 1];
                  setSelectedId(next?.listingId ?? null);
                  setFocusRequest({
                    kind: "removal",
                    removedId: selected.listingId,
                    listingId: next?.listingId ?? null,
                  });
                  onRemove(selected.listingId);
                }}
              >
                Remove
              </button>
            </div>
          </section>
        </>
      ) : (
        <p
          className="managed-watchlist-empty"
          data-watchlist-empty
          tabIndex={-1}
        >
          Your watchlist is empty. Search for a company and add its exact
          listing.
        </p>
      )}
    </div>
  );
}
