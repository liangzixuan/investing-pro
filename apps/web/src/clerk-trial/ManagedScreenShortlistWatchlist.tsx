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
interface OwnedReview {
  readonly owner: ManagedWorkspace;
  readonly preview: ScreenShortlistWatchlistPreview;
}
interface CommandContext {
  readonly frame: ActionFrame;
  readonly committed: { current: ActionFrame | null };
  readonly navigationPending: boolean;
  readonly onReviewWatchlist: () => void;
  readonly setReview: (review: OwnedReview | null) => void;
  readonly setNotice: (notice: string) => void;
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
function actionCurrent(context: CommandContext) {
  return (
    context.committed.current === context.frame &&
    frameSnapshotsCurrent(context.frame) &&
    frameHostCurrent(context.frame, context.navigationPending)
  );
}
function prepareReview(context: CommandContext) {
  if (!actionCurrent(context)) return;
  const workspace = context.frame.workspace;
  const prepared = prepareScreenShortlistWatchlist(workspace);
  context.setReview(
    prepared.preview ? { owner: workspace, preview: prepared.preview } : null,
  );
  context.setNotice(prepared.reason);
}
function applyReview(
  context: CommandContext,
  preview: ScreenShortlistWatchlistPreview,
) {
  if (!actionCurrent(context)) return;
  const applying = { ...context.frame };
  context.committed.current = applying;
  const result = applyScreenShortlistWatchlist(
    context.frame.workspace,
    preview,
  );
  if (context.committed.current !== applying) return;
  context.committed.current = null;
  context.setReview(null);
  context.setNotice(result.message);
}
function cancelReview(context: CommandContext) {
  if (context.committed.current !== context.frame) return;
  context.committed.current = null;
  context.setReview(null);
  context.setNotice("");
}
function reviewWatchlist(context: CommandContext) {
  if (actionCurrent(context)) context.onReviewWatchlist();
}
function reviewCommands(context: CommandContext) {
  return {
    prepare: () => prepareReview(context),
    apply: (preview: ScreenShortlistWatchlistPreview) =>
      applyReview(context, preview),
    cancel: () => cancelReview(context),
    reviewWatchlist: () => reviewWatchlist(context),
  };
}

function useActionFrame(workspace: ManagedWorkspace): ActionFrame {
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
  return { workspace, screen, discovery, saved, session };
}
function useShortlistReview(frame: ActionFrame, props: Props) {
  const [review, setReview] = useState<OwnedReview | null>(null);
  const [notice, setNotice] = useState("");
  const preview = review?.owner === frame.workspace ? review.preview : null;
  const currentPreview =
    preview !== null &&
    isScreenShortlistWatchlistCurrent(frame.workspace, preview);
  const committed = useRef<ActionFrame | null>(null);
  useLayoutEffect(() => {
    committed.current = frame;
    return () => {
      committed.current = null;
    };
  });
  const commands = reviewCommands({
    frame,
    committed,
    setReview,
    setNotice,
    navigationPending: props.navigationPending,
    onReviewWatchlist: props.onReviewWatchlist,
  });
  return { preview, currentPreview, notice, commands };
}
type ShortlistReview = ReturnType<typeof useShortlistReview>;
type ReviewCommands = ReturnType<typeof reviewCommands>;

export function ManagedScreenShortlistWatchlist(props: Props) {
  const frame = useActionFrame(props.workspace);
  const id = useId();
  const review = useShortlistReview(frame, props);
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
      {renderEntryActions(frame, props.navigationPending, review.commands)}
      {review.notice && <p role="status">{review.notice}</p>}
      {renderShortlistReview(id, frame, props.navigationPending, review)}
    </section>
  );
}
function renderEntryActions(
  frame: ActionFrame,
  navigationPending: boolean,
  commands: ReviewCommands,
) {
  return (
    <div className="trial-actions">
      <button
        type="button"
        className="trial-secondary"
        disabled={navigationPending || frame.screen.shortlist.length === 0}
        onClick={commands.prepare}
      >
        Review shortlist for My Watchlist
      </button>
      <button
        type="button"
        className="trial-secondary"
        disabled={navigationPending || frame.session.phase !== "active"}
        onClick={commands.reviewWatchlist}
      >
        Review and save in My Watchlist
      </button>
    </div>
  );
}
function renderShortlistReview(
  id: string,
  frame: ActionFrame,
  navigationPending: boolean,
  review: ShortlistReview,
) {
  const { preview, currentPreview, commands } = review;
  if (!preview || frame.session.phase !== "active") return null;
  return (
    <section aria-labelledby={`${id}-review-heading`}>
      <h4 id={`${id}-review-heading`}>Shortlist addition review</h4>
      <p>
        Run started {preview.runStartedAt}. Finished{" "}
        {preview.runCompletedAt ?? "without a completion time"}. These are the
        original run times; this review does not refresh evidence.
      </p>
      <p>
        {preview.additions} new listings will be appended in shortlist order
        with empty notes. Existing entries stay in their current positions. No
        financial values or screening verdict will be written to a note.
      </p>
      <ol>{preview.rows.map(renderReviewRow)}</ol>
      {!currentPreview && (
        <p role="status">
          This review is out of date. Review the current shortlist and Watchlist
          draft again before adding listings.
        </p>
      )}
      {renderReviewActions(
        preview,
        currentPreview,
        navigationPending,
        commands,
      )}
    </section>
  );
}
function renderReviewRow(row: ScreenShortlistWatchlistPreview["rows"][number]) {
  return (
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
  );
}
function renderReviewActions(
  preview: ScreenShortlistWatchlistPreview,
  currentPreview: boolean,
  navigationPending: boolean,
  commands: ReviewCommands,
) {
  return (
    <div className="trial-actions">
      <button
        type="button"
        disabled={
          navigationPending || !currentPreview || preview.additions === 0
        }
        onClick={() => commands.apply(preview)}
      >
        Add {preview.additions} listings to Watchlist draft
      </button>
      <button
        type="button"
        className="trial-secondary"
        onClick={commands.cancel}
      >
        Keep Watchlist unchanged
      </button>
    </div>
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
