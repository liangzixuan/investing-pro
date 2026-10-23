import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import type { ManagedWorkspace } from "./managed-workspace";
import {
  applyPortfolioWatchlist,
  isPortfolioWatchlistCurrent,
  preparePortfolioWatchlist,
  type PortfolioWatchlistPreview,
} from "./managed-portfolio-watchlist";

interface Props {
  readonly workspace: ManagedWorkspace;
  readonly navigationPending: boolean;
  readonly routeActive: () => boolean;
  readonly onReviewWatchlist: () => void;
}
function useFrame(workspace: ManagedWorkspace) {
  const discovery = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const portfolio = useSyncExternalStore(
    workspace.portfolio.subscribe,
    workspace.portfolio.getSnapshot,
    workspace.portfolio.getSnapshot,
  );
  const ledger = useSyncExternalStore(
    workspace.portfolio.coordinator.subscribe,
    workspace.portfolio.coordinator.getSnapshot,
    workspace.portfolio.coordinator.getSnapshot,
  );
  const watchlist = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
    workspace.coordinator.getSnapshot,
  );
  const session = useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
    workspace.sessionOwner.getSnapshot,
  );
  return {
    workspace,
    discovery,
    portfolio,
    ledger,
    watchlist,
    session,
    route: workspace.capturePortfolioWatchlistRoute(),
  };
}
type Frame = ReturnType<typeof useFrame>;
function sourceCurrent(frame: Frame, props: Props) {
  const w = frame.workspace;
  return (
    !props.navigationPending &&
    !frame.portfolio.pendingEditor &&
    !frame.portfolio.reviewing &&
    !frame.portfolio.review &&
    props.routeActive() &&
    frame.route?.() === true &&
    w === props.workspace &&
    w.getSnapshot() === frame.discovery &&
    w.portfolio.getSnapshot() === frame.portfolio &&
    w.portfolio.coordinator.getSnapshot() === frame.ledger &&
    w.sessionOwner.getSnapshot() === frame.session
  );
}
function useReview(frame: Frame, props: Props) {
  const [selection, setSelection] = useState("");
  const [owned, setOwned] = useState<{
    owner: ManagedWorkspace;
    preview: PortfolioWatchlistPreview;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const committed = useRef<Frame | null>(null);
  useLayoutEffect(() => {
    committed.current = frame;
    return () => {
      committed.current = null;
    };
  });
  const current = () =>
    committed.current === frame &&
    sourceCurrent(frame, props) &&
    frame.workspace.coordinator.getSnapshot() === frame.watchlist;
  const preview = owned?.owner === frame.workspace ? owned.preview : null;
  const choose = (value: string) => {
    if (!current()) return;
    committed.current = null;
    setSelection(value);
    setOwned(null);
    setNotice("");
  };
  const prepare = () => {
    if (!selection || !current()) return;
    committed.current = null;
    const result = preparePortfolioWatchlist(frame.workspace, selection);
    if (!sourceCurrent(frame, props)) return;
    setOwned(
      result.preview
        ? { owner: frame.workspace, preview: result.preview }
        : null,
    );
    setNotice(result.reason);
  };
  const apply = () => {
    if (
      !preview ||
      preview.status !== "add" ||
      !current() ||
      !isPortfolioWatchlistCurrent(frame.workspace, preview)
    )
      return;
    const applying = { ...frame };
    committed.current = applying;
    const result = applyPortfolioWatchlist(frame.workspace, preview);
    if (committed.current !== applying || !sourceCurrent(frame, props)) return;
    committed.current = null;
    setOwned(null);
    setNotice(result.message);
  };
  const cancel = () => {
    if (committed.current !== frame) return;
    committed.current = null;
    setOwned(null);
    setNotice("");
  };
  const reviewWatchlist = () => {
    if (current()) props.onReviewWatchlist();
  };
  return {
    selection,
    preview,
    notice,
    choose,
    prepare,
    apply,
    cancel,
    reviewWatchlist,
  };
}
type Review = ReturnType<typeof useReview>;

/** Choose one authored current holding; adding to a draft never saves either resource. */
export function ManagedPortfolioWatchlist(props: Props) {
  const frame = useFrame(props.workspace);
  const review = useReview(frame, props);
  const id = useId();
  const projected = props.workspace.portfolio.getProjection();
  const holdings =
    projected?.status === "valid" ? projected.portfolio.holdings : [];
  if (frame.session.phase !== "active") return null;
  return (
    <section aria-label="Portfolio holding research list">
      <details>
        <summary>Keep a holding in My Watchlist</summary>
        <p>
          Choose a current authored holding and review its full listing identity
          before adding it to the Watchlist draft. Existing notes and order stay
          intact. Save each resource separately.
        </p>
        <label htmlFor={`${id}-holding`}>
          Current holding
          <select
            id={`${id}-holding`}
            value={review.selection}
            disabled={
              props.navigationPending ||
              frame.portfolio.pendingEditor ||
              frame.portfolio.reviewing
            }
            onChange={(event) => review.choose(event.currentTarget.value)}
          >
            <option value="">Choose a current holding</option>
            {holdings.map(({ identity }) => (
              <option key={identity.listingId} value={identity.listingId}>
                {identity.symbol} · {identity.shareClassName} ·{" "}
                {identity.exchangeMic}
              </option>
            ))}
          </select>
        </label>
        {holdings.length === 0 && (
          <p>No current holding is available for this review.</p>
        )}
        <div className="trial-actions">
          <button
            type="button"
            disabled={
              props.navigationPending ||
              !review.selection ||
              frame.portfolio.pendingEditor ||
              frame.portfolio.reviewing
            }
            onClick={review.prepare}
          >
            Review holding for My Watchlist
          </button>
          <button
            type="button"
            className="trial-secondary"
            disabled={
              props.navigationPending ||
              frame.portfolio.pendingEditor ||
              frame.portfolio.reviewing
            }
            onClick={review.reviewWatchlist}
          >
            Review and save in My Watchlist
          </button>
        </div>
        {review.notice && <p role="status">{review.notice}</p>}
        {review.preview && renderHoldingReview(frame, props, review)}
      </details>
    </section>
  );
}
function renderHoldingReview(frame: Frame, props: Props, review: Review) {
  const preview = review.preview!;
  const current = isPortfolioWatchlistCurrent(frame.workspace, preview);
  return (
    <section aria-label="Holding addition review">
      <h3>Review this holding for My Watchlist</h3>
      <p>
        <ListingIdentity member={preview.listing} />
      </p>
      <p>
        Authored shares: {preview.shares}. Confirmed on {preview.confirmedOn}.
        These are your ledger values.
      </p>
      <dl>
        {Object.entries(identityLabels).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{preview.listing[key as keyof typeof identityLabels]}</dd>
          </div>
        ))}
      </dl>
      <p>
        {preview.status === "add"
          ? "Append this exact listing with an empty note. No holding amount or financial value will be written to the Watchlist."
          : "Already in the Watchlist draft. Keep its note and position."}
      </p>
      {!current && (
        <p role="status">
          This review is out of date. Review the current holding and Watchlist
          draft again.
        </p>
      )}
      <div className="trial-actions">
        <button
          type="button"
          disabled={
            props.navigationPending || !current || preview.status !== "add"
          }
          onClick={review.apply}
        >
          Add holding to Watchlist draft
        </button>
        <button
          type="button"
          className="trial-secondary"
          onClick={review.cancel}
        >
          Keep Watchlist unchanged
        </button>
      </div>
    </section>
  );
}
