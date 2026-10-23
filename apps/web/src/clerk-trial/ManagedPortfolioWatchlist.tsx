import { useId } from "react";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import { isPortfolioWatchlistCurrent } from "./managed-portfolio-watchlist";
import {
  portfolioHoldingControlsBlocked,
  usePortfolioWatchlistFrame,
  type PortfolioWatchlistFrame,
  type PortfolioWatchlistProps,
} from "./managed-portfolio-watchlist-frame";
import {
  usePortfolioWatchlistReview,
  type PortfolioWatchlistReview,
} from "./use-portfolio-watchlist-review";

function currentHoldings(frame: PortfolioWatchlistFrame) {
  const projected = frame.workspace.portfolio.getProjection();
  return projected?.status === "valid" ? projected.portfolio.holdings : [];
}
interface HoldingPanel {
  readonly frame: PortfolioWatchlistFrame;
  readonly props: PortfolioWatchlistProps;
  readonly review: PortfolioWatchlistReview;
  readonly id: string;
  readonly holdings: ReturnType<typeof currentHoldings>;
  readonly blocked: boolean;
}
/** Choose one authored current holding; adding to a draft never saves either resource. */
export function ManagedPortfolioWatchlist(props: PortfolioWatchlistProps) {
  const frame = usePortfolioWatchlistFrame(props.workspace);
  const review = usePortfolioWatchlistReview(frame, props);
  const id = useId();
  const holdings = currentHoldings(frame);
  if (frame.session.phase !== "active") return null;
  const panel = {
    frame,
    props,
    review,
    id,
    holdings,
    blocked: portfolioHoldingControlsBlocked(frame, props),
  };
  return (
    <section aria-label="Portfolio holding research list">
      <details>
        <summary>Keep a holding in My Watchlist</summary>
        <p>
          Choose a current authored holding and review its full listing identity
          before adding it to the Watchlist draft. Existing notes and order stay
          intact. Save each resource separately.
        </p>
        {renderHoldingChoice(panel)}
        {renderHoldingActions(panel)}
        {review.notice && <p role="status">{review.notice}</p>}
        {review.preview && renderHoldingReview(panel)}
      </details>
    </section>
  );
}
function renderHoldingChoice({ id, holdings, review, blocked }: HoldingPanel) {
  return (
    <>
      <label htmlFor={`${id}-holding`}>
        Current holding
        <select
          id={`${id}-holding`}
          value={review.selection}
          disabled={blocked}
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
    </>
  );
}
function renderHoldingActions({ review, blocked }: HoldingPanel) {
  return (
    <div className="trial-actions">
      <button
        type="button"
        disabled={blocked || !review.selection}
        onClick={review.prepare}
      >
        Review holding for My Watchlist
      </button>
      <button
        type="button"
        className="trial-secondary"
        disabled={blocked}
        onClick={review.reviewWatchlist}
      >
        Review and save in My Watchlist
      </button>
    </div>
  );
}
function renderHoldingReview({ frame, props, review }: HoldingPanel) {
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
