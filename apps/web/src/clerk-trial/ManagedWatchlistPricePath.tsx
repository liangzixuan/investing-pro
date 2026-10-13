import { useState } from "react";
import type { ManagedWatchlistComparisonProjection } from "./managed-watchlist-comparison";
import {
  projectManagedWatchlistPricePath,
  type ManagedWatchlistPricePath as Path,
} from "./managed-watchlist-price-path";
import { ManagedWatchlistPricePathChart } from "./ManagedWatchlistPricePathChart";

export function ManagedWatchlistPricePath({
  projection,
  active,
}: {
  projection: ManagedWatchlistComparisonProjection;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const path = projectManagedWatchlistPricePath(projection);
  return (
    <details
      className="managed-watchlist-price-path"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Compare raw-price paths</summary>
      <p>
        Index = 100 × raw close / starting raw close, rounded half up to four
        decimal places. Chart coordinates are approximate; the vertical scale
        follows the values. Straight lines guide the eye between shared
        observations; dates are spaced by observation, with no filled gaps.
        Omitted dates can hide declines. This is not a USD price or a
        split/dividend-adjusted return.
      </p>
      {path && (
        <ul aria-label="Price path line styles">
          {path.series.map((row, index) => (
            <li key={row.listing.listingId}>
              {row.listing.symbol} · {row.listing.exchangeMic} ·{" "}
              {row.listing.shareClassName}:{" "}
              {index === 0
                ? "solid line, circle markers"
                : "dashed line, diamond markers"}
            </li>
          ))}
        </ul>
      )}
      {open && active && path && <ManagedWatchlistPricePathChart path={path} />}
      <div
        className="managed-watchlist-price-path-data"
        role="region"
        aria-label="Watchlist price path exact data"
        tabIndex={0}
      >
        {path ? (
          <PricePathTable path={path} />
        ) : (
          <p role="status">
            Choose two loaded listings and a valid shared interval to compare
            their price paths.
          </p>
        )}
      </div>
    </details>
  );
}

function PricePathTable({ path }: { path: Path }) {
  return (
    <table>
      <caption>
        Observed raw closes and rounded index values · {path.dates.length}{" "}
        shared dates
      </caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          {path.series.map((row) => (
            <th key={row.listing.listingId} scope="col">
              {row.listing.symbol} · {row.listing.shareClassName} ·{" "}
              {row.listing.exchangeMic}
              <br />
              USD close / index
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {path.dates.map((date, index) => (
          <tr key={date}>
            <th scope="row">{date}</th>
            {path.series.map((row) => (
              <td key={row.listing.listingId}>
                <span>{row.points[index]!.close}</span>
                <br />
                <span>{row.points[index]!.index}</span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
