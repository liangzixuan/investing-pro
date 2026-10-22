import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ManagedEodIdentity } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import { ListingIdentity } from "./ManagedListingIdentity";
import {
  applyScreenShortlistWatchlist,
  isScreenShortlistWatchlistCurrent,
  prepareScreenShortlistWatchlist,
  type ScreenShortlistWatchlistPreview,
} from "./managed-screen-shortlist-watchlist";
import "./managed-screen-shortlist-watchlist.css";

interface Props {
  readonly workspace: ManagedWorkspace;
  readonly navigationPending: boolean;
  readonly onReviewWatchlist: () => void;
}

interface ActionFrame {
  readonly workspace: ManagedWorkspace;
  readonly screen: ReturnType<
    ManagedWorkspace["financialScreen"]["getSnapshot"]
  >;
  readonly discovery: ReturnType<ManagedWorkspace["getSnapshot"]>;
  readonly saved: ReturnType<ManagedWorkspace["coordinator"]["getSnapshot"]>;
  readonly session: ReturnType<ManagedWorkspace["sessionOwner"]["getSnapshot"]>;
}

function frameSnapshotsCurrent(frame: ActionFrame) {
  const { workspace } = frame;
  return (
    workspace.financialScreen.getSnapshot() === frame.screen &&
    workspace.getSnapshot() === frame.discovery &&
    workspace.coordinator.getSnapshot() === frame.saved &&
    workspace.sessionOwner.getSnapshot() === frame.session
  );
}

function frameHostCurrent(frame: ActionFrame, navigationPending: boolean) {
  return (
    !navigationPending &&
    frame.session.phase === "active" &&
    frame.discovery.view === "discover" &&
    !frame.discovery.research &&
    !frame.discovery.companyRoute &&
    frame.workspace.canNavigate()
  );
}

export function ManagedScreenShortlistWatchlist(props: Props) {
  const { workspace, navigationPending, onReviewWatchlist } = props;
  const screen = useSyncExternalStore(
    workspace.financialScreen.subscribe,
    workspace.financialScreen.getSnapshot,
    workspace.financialScreen.getSnapshot,
  );
  const discovery = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const saved = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
    workspace.coordinator.getSnapshot,
  );
  const session = useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
    workspace.sessionOwner.getSnapshot,
  );
  const id = useId();
  const [review, setReview] = useState<{
    owner: ManagedWorkspace;
    preview: ScreenShortlistWatchlistPreview;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const preview = review?.owner === workspace ? review.preview : null;
  const currentPreview =
    preview !== null && isScreenShortlistWatchlistCurrent(workspace, preview);
  const action = { workspace, screen, discovery, saved, session };
  const committed = useRef<typeof action | null>(null);
  useLayoutEffect(() => {
    committed.current = action;
    return () => {
      committed.current = null;
    };
  });
  const current = () =>
    committed.current === action &&
    frameSnapshotsCurrent(action) &&
    frameHostCurrent(action, navigationPending);
  const cancel = () => {
    if (committed.current !== action) return;
    committed.current = null;
    setReview(null);
    setNotice("");
  };
  return (
    <section
      className="managed-screen-shortlist-watchlist"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>Keep your screening shortlist</h3>
      <p>
        Review the exact listings before adding them to the My Watchlist draft.
        Existing notes and order stay intact. Save My Watchlist separately.
      </p>
      <div className="trial-actions">
        <button
          type="button"
          className="trial-secondary"
          disabled={navigationPending || screen.shortlist.length === 0}
          onClick={() => {
            if (!current()) return;
            const prepared = prepareScreenShortlistWatchlist(workspace);
            setReview(
              prepared.preview
                ? { owner: workspace, preview: prepared.preview }
                : null,
            );
            setNotice(prepared.reason);
          }}
        >
          Review shortlist for My Watchlist
        </button>
        <button
          type="button"
          className="trial-secondary"
          disabled={navigationPending || session.phase !== "active"}
          onClick={() => {
            if (current()) onReviewWatchlist();
          }}
        >
          Review and save in My Watchlist
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {preview && session.phase === "active" && (
        <section aria-labelledby={`${id}-review-heading`}>
          <h4 id={`${id}-review-heading`}>Shortlist addition review</h4>
          <p>
            Run started {preview.runStartedAt}. Finished{" "}
            {preview.runCompletedAt ?? "without a completion time"}. These are
            the original run times; this review does not refresh evidence.
          </p>
          <p>
            {preview.additions} new listings will be appended in shortlist order
            with empty notes. Existing entries stay in their current positions.
            No financial values or screening verdict will be written to a note.
          </p>
          <ol>
            {preview.rows.map((row) => (
              <li key={row.listing.listingId}>
                <p>
                  <ListingIdentity member={row.listing} />
                </p>
                <p>
                  {row.status === "add"
                    ? "Add to draft with an empty note."
                    : "Already in draft. Keep its note and position."}
                </p>
                <ShortlistIdentity listing={row.listing} />
              </li>
            ))}
          </ol>
          {!currentPreview && (
            <p role="status">
              This review is out of date. Review the current shortlist and
              Watchlist draft again before adding listings.
            </p>
          )}
          <div className="trial-actions">
            <button
              type="button"
              disabled={
                navigationPending || !currentPreview || preview.additions === 0
              }
              onClick={() => {
                if (!current()) return;
                const applying = { ...action };
                committed.current = applying;
                const result = applyScreenShortlistWatchlist(
                  workspace,
                  preview,
                );
                if (committed.current !== applying) return;
                committed.current = null;
                setReview(null);
                setNotice(result.message);
              }}
            >
              Add {preview.additions} listings to Watchlist draft
            </button>
            <button type="button" className="trial-secondary" onClick={cancel}>
              Keep Watchlist unchanged
            </button>
          </div>
        </section>
      )}
    </section>
  );
}

function ShortlistIdentity({
  listing,
}: {
  readonly listing: ManagedEodIdentity;
}) {
  return (
    <dl>
      <div>
        <dt>Security name</dt>
        <dd>{listing.securityName}</dd>
      </div>
      <div>
        <dt>Country</dt>
        <dd>{listing.country}</dd>
      </div>
      <div>
        <dt>Instrument type</dt>
        <dd>{listing.instrumentType}</dd>
      </div>
      <div>
        <dt>Listing ID</dt>
        <dd>{listing.listingId}</dd>
      </div>
      <div>
        <dt>Issuer ID</dt>
        <dd>{listing.issuerId}</dd>
      </div>
      <div>
        <dt>Security ID</dt>
        <dd>{listing.securityId}</dd>
      </div>
      <div>
        <dt>Share class ID</dt>
        <dd>{listing.shareClassId}</dd>
      </div>
    </dl>
  );
}
