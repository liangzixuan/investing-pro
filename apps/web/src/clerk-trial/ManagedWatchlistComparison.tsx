import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  membershipMatchesResult,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import { RawCloseChange } from "./RawCloseChange";
import {
  ManagedWatchlistComparisonNoteAction,
  type ManagedWatchlistComparisonNoteActions,
} from "./ManagedWatchlistComparisonNoteAction";
import {
  changeManagedWatchlistComparisonInterval,
  createManagedWatchlistComparisonSelection,
  projectManagedWatchlistComparison,
  selectManagedWatchlistComparisonRow,
} from "./managed-watchlist-comparison";
import type { ManagedPriceComparisonInterval } from "./managed-price-comparison";
import type {
  ManagedWatchlistPriceRow,
  ManagedWatchlistPricesState,
} from "./managed-watchlist-prices";

type Projection = ReturnType<typeof projectManagedWatchlistComparison>;
type Side = "left" | "right";
interface Props {
  memberships: readonly WatchlistMembership[];
  prices: ManagedWatchlistPricesState;
  active?: boolean;
  editable: boolean;
  comparisonNoteActions: ManagedWatchlistComparisonNoteActions;
}

export function ManagedWatchlistComparison({
  memberships,
  prices,
  active = true,
  editable,
  comparisonNoteActions,
}: Props) {
  const [selection, setSelection] = useState(
    createManagedWatchlistComparisonSelection,
  );
  const projection = projectManagedWatchlistComparison(selection, prices);
  const captured = projection.selection;
  if (selection !== captured) setSelection(captured);
  const latest = useRef({ prices, active, selection: captured });
  useLayoutEffect(() => {
    latest.current = { prices, active, selection: captured };
  }, [prices, active, captured]);
  return (
    <ManagedWatchlistComparisonView
      memberships={memberships}
      prices={prices}
      projection={projection}
      noteAction={
        <ManagedWatchlistComparisonNoteAction
          selection={captured}
          active={active}
          editable={editable}
          actions={comparisonNoteActions}
        />
      }
      onPair={(side, row) => {
        if (!latest.current.active || latest.current.selection !== captured)
          return;
        setSelection((current) =>
          selectManagedWatchlistComparisonRow(
            current,
            captured,
            latest.current.prices,
            side,
            row,
          ),
        );
      }}
      onDate={(field, date) => {
        if (!latest.current.active || latest.current.selection !== captured)
          return;
        setSelection((current) =>
          changeManagedWatchlistComparisonInterval(
            current,
            captured,
            latest.current.prices,
            field,
            date,
          ),
        );
      }}
    />
  );
}

export function ManagedWatchlistComparisonView({
  memberships,
  prices,
  projection,
  onPair,
  onDate,
  noteAction,
}: Pick<Props, "memberships" | "prices"> & {
  noteAction?: ReactNode;
  projection: Projection;
  onPair: (side: Side, row: ManagedWatchlistPriceRow | null) => void;
  onDate: (field: keyof ManagedPriceComparisonInterval, date: string) => void;
}) {
  const id = useId();
  const { selection, comparison } = projection;
  const dates =
    projection.history?.status === "loaded"
      ? projection.history.sharedDates
      : [];
  const available = comparison?.status === "available";
  return (
    <section
      className="managed-watchlist-comparison managed-price-comparison"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>Compare two watchlist listings</h3>
      <p className="managed-price-comparison-help">
        Choose two listings from your full draft. This uses their loaded raw USD
        closes; choosing listings or dates does not load prices or save.
      </p>
      <div className="managed-watchlist-comparison-pair">
        {(["left", "right"] as const).map((side) => (
          <ListingChoice
            key={side}
            id={`${id}-${side}`}
            side={side}
            memberships={memberships}
            prices={prices}
            selected={projection[side]}
            onChange={(row) => onPair(side, row)}
          />
        ))}
      </div>
      <div className="managed-price-comparison-controls">
        <DateChoice
          id={`${id}-start`}
          label="Watchlist comparison start date"
          dates={dates.slice(0, -1)}
          value={selection.startDate}
          onChange={(date) => onDate("startDate", date)}
        />
        <DateChoice
          id={`${id}-end`}
          label="Watchlist comparison end date"
          dates={dates.slice(1).filter((date) => date > selection.startDate)}
          value={selection.endDate}
          onChange={(date) => onDate("endDate", date)}
        />
      </div>
      <p className="managed-price-comparison-reset" role="status">
        {selection.resetNotice &&
          "Comparison sources changed; showing the full shared span."}
      </p>
      <p id={`${id}-scroll`} className="managed-price-comparison-help">
        Scroll the results horizontally when needed. Keyboard users can focus
        the results and use the arrow keys.
      </p>
      <div
        className="managed-price-comparison-scroll"
        role="region"
        aria-label="Watchlist raw price comparison results"
        aria-describedby={`${id}-scroll`}
        tabIndex={available ? 0 : -1}
      >
        <ComparisonResult projection={projection} id={id} />
      </div>
      <p className="managed-price-comparison-help">
        Raw closes are not adjusted for splits or dividends. Shared observed
        dates do not imply a full-month return. Each request can have different
        dates; completion is not a live market update.
      </p>
      {noteAction}
      <Coverage projection={projection} />
    </section>
  );
}

function ListingChoice({
  id,
  side,
  memberships,
  prices,
  selected,
  onChange,
}: Pick<Props, "memberships" | "prices"> & {
  id: string;
  side: Side;
  selected: ManagedWatchlistPriceRow | null;
  onChange: (row: ManagedWatchlistPriceRow | null) => void;
}) {
  const eligible = prices.active && !prices.catalogChanged;
  const options = memberships.map((member) => ({
    member,
    row: eligible
      ? prices.rows.find((row) => membershipMatchesResult(member, row.listing))
      : undefined,
  }));
  return (
    <label htmlFor={id} className="managed-watchlist-comparison-listing">
      <span>{side === "left" ? "First listing" : "Second listing"}</span>
      <select
        id={id}
        value={selected?.listing.listingId ?? ""}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (value === "") onChange(null);
          else {
            const option = options.find(
              ({ member }) => member.listingId === value,
            );
            if (option?.row) onChange(option.row);
          }
        }}
      >
        <option value="">Choose a listing</option>
        {options.map(({ member, row }) => (
          <option
            key={member.listingId}
            value={member.listingId}
            disabled={!row}
          >
            {member.symbol} · {member.issuerName} · {member.shareClassName} ·{" "}
            {member.exchangeMic}
            {!row
              ? " — price unavailable"
              : !row.history.response
                ? " — not loaded"
                : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateChoice({
  id,
  label,
  dates,
  value,
  onChange,
}: {
  id: string;
  label: string;
  dates: readonly string[];
  value: string;
  onChange: (date: string) => void;
}) {
  return (
    <label htmlFor={id} className="managed-price-comparison-date">
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">
          {dates.length
            ? "Choose an observed date"
            : "No shared dates available"}
        </option>
        {dates.map((date) => (
          <option key={date} value={date}>
            {date}
          </option>
        ))}
      </select>
    </label>
  );
}

const REASONS = {
  both_required: "Choose two distinct watchlist listings to compare.",
  left_required: "Choose a first listing to compare.",
  right_required: "Choose a second listing to compare.",
  duplicate:
    "Choose two distinct listings. The existing comparison is unchanged.",
  selection_unavailable:
    "A selected listing is no longer available. Choose a current listing.",
  history_unavailable:
    "Comparison unavailable. Load both selected histories using their Dated price controls.",
} as const;

function ComparisonResult({
  projection,
  id,
}: {
  projection: Projection;
  id: string;
}) {
  const { comparison, reason } = projection;
  return (
    <>
      <p role="status" className="managed-price-comparison-status">
        {reason ? REASONS[reason] : comparisonMessage(comparison)}
      </p>
      <RetainedHistoryNotice projection={projection} />
      {comparison?.status === "available" && (
        <ComparisonTable comparison={comparison} id={id} />
      )}
    </>
  );
}

function RetainedHistoryNotice({ projection }: { projection: Projection }) {
  if (
    projection.history?.status !== "loaded" ||
    projection.comparison?.status === "available"
  )
    return null;
  return projection.history.rows
    .filter((row) => row.showingPrevious)
    .map((row) => (
      <p
        key={row.listing.listingId}
        className="managed-price-comparison-previous"
      >
        Previous history retained for {row.listing.symbol} ·{" "}
        {row.listing.shareClassName} · {row.listing.exchangeMic}. Request
        completed{" "}
        <time dateTime={row.response.completedAt}>
          {row.response.completedAt}
        </time>
        . Newer prices have not been confirmed.
      </p>
    ));
}

function comparisonMessage(comparison: Projection["comparison"]) {
  if (!comparison || comparison.status === "unavailable")
    return "Comparison unavailable while watchlist prices are inactive.";
  if (comparison.status === "available")
    return `${comparison.firstDate} to ${comparison.lastDate} · ${comparison.intervalDateCount} shared observed dates in this interval · ${comparison.sharedDateCount} across the loaded histories`;
  if (comparison.status === "interval_required")
    return comparison.reason === "start_required"
      ? "Choose a starting date before the ending date."
      : "Choose an ending date after the starting date.";
  return comparison.sharedDateCount === 1
    ? `Comparison needs two shared dates. One shared observed date is loaded: ${comparison.firstDate}.`
    : "Comparison needs two shared dates. No shared observed dates are loaded.";
}

function ComparisonTable({
  comparison,
  id,
}: {
  comparison: Extract<
    NonNullable<Projection["comparison"]>,
    { status: "available" }
  >;
  id: string;
}) {
  return (
    <table>
      <caption className="sr-only">
        Raw USD closes for the two selected watchlist listings
      </caption>
      <thead>
        <tr>
          <th scope="col">Listing</th>
          <th scope="col">Start close (USD)</th>
          <th scope="col">End close (USD)</th>
          <th scope="col">Raw close change</th>
        </tr>
      </thead>
      <tbody>
        {comparison.rows.map((row) => (
          <tr key={row.listing.listingId}>
            <th scope="row">
              <strong>{row.listing.symbol}</strong>
              <span>
                {row.listing.issuerName} · {row.listing.shareClassName} ·{" "}
                {row.listing.exchangeMic}
              </span>
              {row.showingPrevious && (
                <span className="managed-price-comparison-previous">
                  Previous history retained
                </span>
              )}
              <small>
                Request completed{" "}
                <time dateTime={row.response.completedAt}>
                  {row.response.completedAt}
                </time>
              </small>
            </th>
            <td>{row.firstClose}</td>
            <td>{row.lastClose}</td>
            <td>
              <RawCloseChange
                id={`${id}-${row.listing.listingId}-change`}
                compact
                rows={[
                  { date: comparison.firstDate, close: row.firstClose },
                  { date: comparison.lastDate, close: row.lastClose },
                ]}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Coverage({ projection }: { projection: Projection }) {
  const history = projection.history;
  return (
    <details className="managed-price-comparison-source">
      <summary>Watchlist comparison coverage and request dates</summary>
      {history?.status === "loaded" ? (
        <>
          <div className="managed-price-comparison-provenance">
            {history.rows.map((row) => (
              <section key={row.listing.listingId}>
                <h4>
                  {row.listing.symbol} · {row.listing.exchangeMic}
                </h4>
                <p>
                  {row.listing.issuerName} · {row.listing.securityName} ·{" "}
                  {row.listing.shareClassName} · {row.listing.country}
                </p>
                {row.showingPrevious && (
                  <p className="managed-eod-previous">
                    Previous history retained. This request has not confirmed
                    newer prices.
                  </p>
                )}
                <dl className="managed-metadata">
                  <dt>Requested window</dt>
                  <dd>
                    {row.response.window.startDate} to{" "}
                    {row.response.window.endDate}
                  </dd>
                  <dt>Observed dates</dt>
                  <dd>
                    {row.response.rows[0]!.date} to{" "}
                    {row.response.rows.at(-1)!.date}
                  </dd>
                  <dt>Loaded / omitted observations</dt>
                  <dd>
                    {row.response.rows.length} /{" "}
                    {row.response.rows.length - history.sharedDates.length}
                  </dd>
                  <dt>Request started</dt>
                  <dd>{row.response.requestStartedAt}</dd>
                  <dt>Source request completed</dt>
                  <dd>{row.response.completedAt}</dd>
                </dl>
              </section>
            ))}
          </div>
          <p>
            Data provided by Tiingo. Change = (ending raw close − starting raw
            close) / starting raw close × 100, rounded to four decimal places.
            Omitted observations have dates absent from the other loaded
            history, not dates outside the selected interval. Missing dates are
            not filled.
          </p>
        </>
      ) : (
        <p>
          Choose two listings with loaded histories to inspect coverage and
          request dates.
        </p>
      )}
    </details>
  );
}
