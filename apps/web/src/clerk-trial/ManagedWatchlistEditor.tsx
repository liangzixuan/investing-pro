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

type FocusRequest = (
  | { kind: "note"; listingId: string; note: string }
  | { kind: "removal"; removedId: string; listingId: string | null }
) & { origin: Element | null };

const normalizeSearch = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/gu, " ");

function matchingMemberships(
  memberships: readonly WatchlistMembership[],
  query: string,
) {
  return memberships.filter((member) =>
    [
      member.symbol,
      member.issuerName,
      member.shareClassName,
      member.exchangeMic,
    ].some((field) => normalizeSearch(field).includes(query)),
  );
}

function selectionAfterRemoval(
  selected: WatchlistMembership,
  memberships: readonly WatchlistMembership[],
  matches: readonly WatchlistMembership[],
) {
  const matchIndex = matches.indexOf(selected);
  const nextMatch = matches[matchIndex + 1] ?? matches[matchIndex - 1];
  const selectedIndex = memberships.indexOf(selected);
  const nextSelected =
    nextMatch ??
    memberships[selectedIndex + 1] ??
    memberships[selectedIndex - 1];
  return {
    selectedId: nextSelected?.listingId ?? null,
    focusId: nextMatch?.listingId ?? null,
  };
}

function focusVisible(
  target: (HTMLElement & { disabled?: boolean }) | null | undefined,
) {
  if (
    target?.isConnected &&
    !target.disabled &&
    target.getClientRects().length > 0
  )
    target.focus();
}

function focusInvalidNote(
  panel: HTMLElement,
  request: Extract<FocusRequest, { kind: "note" }>,
  selected: WatchlistMembership | undefined,
) {
  if (
    selected?.listingId !== request.listingId ||
    selected.note !== request.note ||
    normalizeWatchlistNote(selected.note) !== null
  )
    return;
  const field = panel.querySelector<HTMLTextAreaElement>(
    "textarea[data-managed-note-listing-id]",
  );
  if (
    field?.dataset.managedNoteListingId === selected.listingId &&
    field.value === request.note
  )
    focusVisible(field);
}

function focusAfterRemoval(
  panel: HTMLElement,
  request: Extract<FocusRequest, { kind: "removal" }>,
  memberships: readonly WatchlistMembership[],
) {
  if (memberships.some((member) => member.listingId === request.removedId))
    return;
  const target = request.listingId
    ? Array.from(
        panel.querySelectorAll<HTMLButtonElement>(
          "button[data-watchlist-selection]",
        ),
      ).find(
        (button) => button.dataset.watchlistSelection === request.listingId,
      )
    : panel.querySelector<HTMLElement>(
        memberships.length
          ? "[data-watchlist-search]"
          : "[data-watchlist-empty]",
      );
  focusVisible(target);
}

function ownsFocus(request: FocusRequest) {
  return (
    request.origin === null ||
    document.activeElement === request.origin ||
    document.activeElement === document.body
  );
}
const focusOrigin = () =>
  typeof document === "undefined" ? null : document.activeElement;

function WatchlistChoice({
  member,
  selected,
  onSelect,
}: {
  member: WatchlistMembership;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="managed-watchlist-choice"
        data-watchlist-selection={member.listingId}
        aria-label={`Edit research note for ${member.symbol}, ${member.shareClassName}, ${member.exchangeMic}`}
        aria-pressed={selected}
        aria-controls="managed-watchlist-selected-note"
        onClick={onSelect}
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
  );
}

function WatchlistChoices({
  matches,
  total,
  selectedId,
  query,
  onQuery,
  onClear,
  onSelect,
}: {
  matches: readonly WatchlistMembership[];
  total: number;
  selectedId: string | undefined;
  query: string;
  onQuery: (query: string) => void;
  onClear: () => void;
  onSelect: (listingId: string) => void;
}) {
  return (
    <div className="managed-watchlist-choices">
      <div className="managed-watchlist-search">
        <label htmlFor="managed-watchlist-search">Search My Watchlist</label>
        <div className="managed-watchlist-search-controls">
          <input
            id="managed-watchlist-search"
            data-watchlist-search
            type="search"
            autoComplete="off"
            spellCheck={false}
            maxLength={128}
            value={query}
            aria-describedby="managed-watchlist-search-help managed-watchlist-search-count"
            onChange={(event) => onQuery(event.target.value)}
          />
          <button
            type="button"
            className="trial-secondary"
            aria-label="Clear watchlist search"
            disabled={query.length === 0}
            onClick={onClear}
          >
            Clear
          </button>
        </div>
        <p id="managed-watchlist-search-help">
          Symbol, company, share class or exchange. Searches this draft only.
        </p>
      </div>
      <p
        id="managed-watchlist-search-count"
        className="managed-watchlist-count"
        role="status"
      >
        {matches.length} of {total} {total === 1 ? "listing" : "listings"}
      </p>
      {matches.length === 0 && total > 0 && (
        <p className="managed-watchlist-no-matches">
          No listings match this search.
        </p>
      )}
      <ol aria-label="Watchlist listings">
        {matches.map((member) => (
          <WatchlistChoice
            key={member.listingId}
            member={member}
            selected={selectedId === member.listingId}
            onSelect={() => onSelect(member.listingId)}
          />
        ))}
      </ol>
    </div>
  );
}

function WatchlistOrderActions({
  selected,
  selectedIndex,
  searching,
  onRemove,
  props,
}: {
  selected: WatchlistMembership;
  selectedIndex: number;
  searching: boolean;
  onRemove: () => void;
  props: ManagedWatchlistEditorProps;
}) {
  return (
    <>
      {searching && (
        <p
          id="managed-watchlist-order-help"
          className="managed-watchlist-search-notice"
        >
          Clear search to change the full watchlist order.
        </p>
      )}
      <div
        className="trial-actions managed-watchlist-order-actions"
        aria-describedby={
          searching ? "managed-watchlist-order-help" : undefined
        }
      >
        <button
          type="button"
          className="trial-secondary"
          disabled={!props.editable || searching || selectedIndex === 0}
          aria-label={`Move ${selected.symbol} up`}
          onClick={() => {
            if (!searching) props.onMove(selected.listingId, -1);
          }}
        >
          Move up
        </button>
        <button
          type="button"
          className="trial-secondary"
          disabled={
            !props.editable ||
            searching ||
            selectedIndex === props.memberships.length - 1
          }
          aria-label={`Move ${selected.symbol} down`}
          onClick={() => {
            if (!searching) props.onMove(selected.listingId, 1);
          }}
        >
          Move down
        </button>
        <button
          type="button"
          className="trial-secondary managed-watchlist-remove"
          disabled={!props.editable}
          aria-label={`Remove ${selected.symbol}`}
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </>
  );
}

function WatchlistDetail({
  selected,
  selectedIndex,
  searching,
  outsideSearch,
  onClear,
  onRemove,
  props,
}: {
  selected: WatchlistMembership;
  selectedIndex: number;
  searching: boolean;
  outsideSearch: boolean;
  onClear: () => void;
  onRemove: () => void;
  props: ManagedWatchlistEditorProps;
}) {
  return (
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
      {outsideSearch && (
        <div className="managed-watchlist-search-notice">
          <p>Selected {selected.symbol} is outside this search.</p>
          <button type="button" className="trial-secondary" onClick={onClear}>
            Show selected listing
          </button>
        </div>
      )}
      <div className="trial-actions managed-watchlist-research-actions">
        <button
          type="button"
          className="trial-secondary"
          disabled={!props.canOpenAnnual(selected)}
          aria-label={`Annual report for saved ${selected.symbol}`}
          onClick={(event) => props.onOpenAnnual(selected, event.currentTarget)}
        >
          Annual report
        </button>
        <button
          type="button"
          className="trial-secondary"
          disabled={!props.canOpenEod(selected)}
          aria-label={`EOD close history for saved ${selected.symbol}`}
          onClick={(event) => props.onOpenEod(selected, event.currentTarget)}
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
          disabled={!props.editable}
          helpId="managed-watchlist-note-help"
          onChange={(note) => props.onNote(selected.listingId, note)}
        />
      </div>
      <WatchlistOrderActions
        selected={selected}
        selectedIndex={selectedIndex}
        searching={searching}
        onRemove={onRemove}
        props={props}
      />
    </section>
  );
}

/** Search and selection are presentation state; all note bytes stay in the shared draft. */
export function ManagedWatchlistEditor(props: ManagedWatchlistEditorProps) {
  const { memberships, editable, active, ref } = props;
  const [selectedId, setSelectedId] = useState<string | null>(
    memberships[0]?.listingId ?? null,
  );
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [query, setQuery] = useState("");
  const editor = useRef<HTMLDivElement | null>(null);
  const selected =
    memberships.find((member) => member.listingId === selectedId) ??
    memberships[0];
  const selectedIndex = selected ? memberships.indexOf(selected) : -1;
  const normalizedQuery = normalizeSearch(query);
  const matches = matchingMemberships(memberships, normalizedQuery);
  const searching = normalizedQuery.length > 0;

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
        setQuery("");
        setSelectedId(invalid.listingId);
        setFocusRequest({
          kind: "note",
          listingId: invalid.listingId,
          note: invalid.note,
          origin: focusOrigin(),
        });
      },
    }),
    [active, editable, memberships],
  );

  useLayoutEffect(() => {
    if (!focusRequest) return;
    setFocusRequest(null);
    const panel = editor.current;
    if (!active || !editable || !panel?.isConnected || !ownsFocus(focusRequest))
      return;
    if (focusRequest.kind === "note")
      focusInvalidNote(panel, focusRequest, selected);
    else focusAfterRemoval(panel, focusRequest, memberships);
  }, [active, editable, focusRequest, memberships, selected]);

  const changeQuery = (value: string) => {
    if (!active) return;
    setFocusRequest(null);
    setQuery(value);
  };
  const clearQuery = () => {
    if (!active) return;
    changeQuery("");
    focusVisible(
      editor.current?.querySelector<HTMLInputElement>(
        "[data-watchlist-search]",
      ),
    );
  };
  const removeSelected = () => {
    if (!active || !editable || !selected) return;
    const next = selectionAfterRemoval(selected, memberships, matches);
    setSelectedId(next.selectedId);
    setFocusRequest({
      kind: "removal",
      removedId: selected.listingId,
      listingId: next.focusId,
      origin: focusOrigin(),
    });
    props.onRemove(selected.listingId);
  };
  return (
    <div className="managed-watchlist-editor" ref={editor}>
      <WatchlistChoices
        matches={matches}
        total={memberships.length}
        selectedId={selected?.listingId}
        query={query}
        onQuery={changeQuery}
        onClear={clearQuery}
        onSelect={(listingId) => {
          setFocusRequest(null);
          setSelectedId(listingId);
        }}
      />
      {selected ? (
        <WatchlistDetail
          selected={selected}
          selectedIndex={selectedIndex}
          searching={searching}
          outsideSearch={!matches.includes(selected)}
          onClear={clearQuery}
          onRemove={removeSelected}
          props={props}
        />
      ) : (
        <p
          className="managed-watchlist-empty"
          data-watchlist-empty
          tabIndex={-1}
        >
          Your watchlist is empty. Find a company in Discover and add its exact
          listing.
        </p>
      )}
    </div>
  );
}
