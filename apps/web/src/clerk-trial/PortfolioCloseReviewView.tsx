import type { AuthoredPortfolioCloseReviewResult } from "@research-cockpit/personal-market-analytics";
import type {
  PortfolioCloseRow,
  PortfolioCloseState,
} from "./managed-portfolio-close-review";
import { PortfolioIdentity } from "./ManagedPortfolioLedgerDetails";
import { PortfolioCloseComposition } from "./PortfolioCloseComposition";

type Review = AuthoredPortfolioCloseReviewResult | null | undefined;
type Research = (listingId: string, opener: HTMLButtonElement) => void;
function Totals({ review }: { review: AuthoredPortfolioCloseReviewResult }) {
  return (
    <>
      <p>
        Authored balances through {review.balancesOn}; raw closes on{" "}
        {review.asOfDate}. Each holding value rounds half-up to USD cents; the
        subtotal sums those displayed line values.
      </p>
      <dl>
        <div>
          <dt>Priced holdings</dt>
          <dd>
            {review.pricedHoldings} of {review.totalHoldings}
          </dd>
        </div>
        <div>
          <dt>Priced holdings subtotal</dt>
          <dd>USD {review.pricedHoldingsSubtotalUsd}</dd>
        </div>
        <div>
          <dt>Complete holdings value</dt>
          <dd>
            {review.holdingsValueUsd === null
              ? "Unavailable: one or more holdings lack an eligible close."
              : `USD ${review.holdingsValueUsd}`}
          </dd>
        </div>
        <div>
          <dt>Authored cash</dt>
          <dd>
            {review.cashUsd === null ? "Unknown" : `USD ${review.cashUsd}`}
          </dd>
        </div>
        <div>
          <dt>Complete value including authored cash</dt>
          <dd>
            {review.totalValueUsd === null
              ? "Unavailable: complete prices and known cash are required."
              : `USD ${review.totalValueUsd}`}
          </dd>
        </div>
      </dl>
    </>
  );
}
function Source({ row }: { row: PortfolioCloseRow }) {
  const source = row.response;
  return (
    <>
      <p>{row.message}</p>
      {row.showingPrevious && (
        <p>Previous history; original dates remain unchanged.</p>
      )}
      {source && (
        <dl>
          <div>
            <dt>Provider / basis</dt>
            <dd>
              {source.provider} / {source.priceBasis} / {source.currency}
            </dd>
          </div>
          <div>
            <dt>Requested window</dt>
            <dd>
              {source.window.startDate} through {source.window.endDate}
            </dd>
          </div>
          <div>
            <dt>Request started</dt>
            <dd>{source.requestStartedAt}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>{source.completedAt}</dd>
          </div>
        </dl>
      )}
    </>
  );
}
function Holding({
  row,
  review,
  running,
  onResearch,
}: {
  row: PortfolioCloseRow;
  review: Review;
  running: boolean;
  onResearch: Research;
}) {
  const listing = row.holding.identity;
  const value = review?.holdings.find(
    (item) => item.listingId === listing.listingId,
  );
  return (
    <tr>
      <th scope="row">
        <PortfolioIdentity listing={listing} />
        <button
          className="trial-secondary"
          disabled={running}
          onClick={(event) =>
            onResearch(listing.listingId, event.currentTarget)
          }
        >
          Research {listing.symbol}
        </button>
      </th>
      <td>
        {row.holding.shares}
        <br />
        Confirmed {row.holding.confirmedOn}
      </td>
      <td>{value?.close ?? "Unavailable"}</td>
      <td>
        {value?.valueUsd ?? "Unavailable"}
        {value?.reason === "balance_after_close" && (
          <p>Authored balances are later than this close date.</p>
        )}
      </td>
      <td>
        <Source row={row} />
      </td>
    </tr>
  );
}
function Holdings({
  state,
  review,
  onResearch,
}: {
  state: PortfolioCloseState;
  review: Review;
  onResearch: Research;
}) {
  return (
    <div
      className="managed-portfolio-table"
      role="region"
      aria-label="Holding close values and source provenance"
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Exact holding</th>
            <th scope="col">Authored shares</th>
            <th scope="col">Raw close (USD)</th>
            <th scope="col">Holding value (USD)</th>
            <th scope="col">Original source</th>
          </tr>
        </thead>
        <tbody>
          {state.rows.map((row) => (
            <Holding
              key={row.holding.identity.listingId}
              row={row}
              review={review}
              running={state.running}
              onResearch={onResearch}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
interface Props {
  ready: boolean;
  state: PortfolioCloseState;
  review: Review;
  onLoad: () => void;
  onCancel: () => void;
  onDate: (date: string) => void;
  onResearch: Research;
}
/** Display only; controller callbacks retain the exact workspace capability. */
function LoadControls({
  ready,
  state,
  onLoad,
  onCancel,
}: Pick<Props, "ready" | "state" | "onLoad" | "onCancel">) {
  const eligible = state.rows.some((row) => row.available);
  const disabled = !ready || state.running || !eligible;
  return (
    <div className="ledger-actions">
      <button disabled={disabled} onClick={onLoad}>
        Load holding closes
      </button>
      {ready && state.running && (
        <button className="trial-secondary" onClick={onCancel}>
          Cancel holding closes
        </button>
      )}
    </div>
  );
}
function ObservedDate({ state, onDate }: Pick<Props, "state" | "onDate">) {
  return (
    <label>
      Observed close date
      <select
        id="managed-portfolio-close-date"
        value={state.selectedDate}
        disabled={state.running || !state.dates.length}
        onChange={(event) => onDate(event.currentTarget.value)}
      >
        {!state.dates.length && <option value="">Load closes first</option>}
        {state.dates.map((date) => (
          <option key={date} value={date}>
            {date}
          </option>
        ))}
      </select>
    </label>
  );
}
function LoadedReview({
  state,
  review,
  onDate,
  onResearch,
}: Pick<Props, "state" | "review" | "onDate" | "onResearch">) {
  return (
    <>
      <p role="status">{state.message}</p>
      <ObservedDate state={state} onDate={onDate} />
      {review && (
        <>
          <Totals review={review} />
          <PortfolioCloseComposition
            id="portfolio-close-composition"
            review={review}
            rows={state.rows}
          />
        </>
      )}
      {!state.rows.length && <p>No current positive holdings.</p>}
      <Holdings state={state} review={review} onResearch={onResearch} />
    </>
  );
}
export function PortfolioCloseReviewView(props: Props) {
  return (
    <section aria-label="Dated Portfolio holdings review">
      <p>
        Explicitly load one month of raw closes for eligible current holdings,
        then choose one observed date. These reference values do not change the
        ledger, save a resource or measure returns. Price coverage remains
        limited.
      </p>
      {!props.ready && (
        <p>
          Load Portfolio, apply or reset pending forms, review current catalog
          identities and resolve any pending save or recovery first.
        </p>
      )}
      <LoadControls
        ready={props.ready}
        state={props.state}
        onLoad={props.onLoad}
        onCancel={props.onCancel}
      />
      {props.ready && (
        <LoadedReview
          state={props.state}
          review={props.review}
          onDate={props.onDate}
          onResearch={props.onResearch}
        />
      )}
    </section>
  );
}
