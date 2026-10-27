import type { AuthoredPortfolioCloseReviewResult } from "@research-cockpit/personal-market-analytics";
import type { PersonalPortfolioIdentity } from "@research-cockpit/contracts";
import type { PortfolioCloseRow } from "./managed-portfolio-close-review";
import { identityLabels } from "./ManagedListingIdentity";
import "./portfolio-close-composition.css";

type Composition = AuthoredPortfolioCloseReviewResult["composition"];
const reasons: Record<NonNullable<Composition["reason"]>, string> = {
  balances_after_close:
    "Composition is unavailable because authored balances or a holding confirmation are later than this close date.",
  incomplete_holdings:
    "Composition is unavailable because one or more holdings lack an eligible close for this exact date.",
  unknown_cash: "Composition is unavailable because authored cash is unknown.",
  zero_total:
    "Composition is unavailable because the complete value is USD 0.00.",
};
const usd = (value: string | null) =>
  value === null ? "Unavailable" : `USD ${value}`;
const share = (value: string | null) =>
  value === null ? "Unavailable" : `${value}%`;

function ExactHolding({ listing }: { listing: PersonalPortfolioIdentity }) {
  return (
    <details>
      <summary>
        <strong>
          {listing.symbol} · {listing.shareClassName}
        </strong>{" "}
        <span className="portfolio-composition-company">
          {listing.issuerName}
        </span>
      </summary>
      <ul>
        {Object.entries(identityLabels).map(([key, label]) => (
          <li key={key}>
            {label}: {listing[key as keyof PersonalPortfolioIdentity]}
          </li>
        ))}
      </ul>
    </details>
  );
}
function Holding({
  row,
  composition,
}: {
  row: PortfolioCloseRow;
  composition: Composition;
}) {
  const listing = row.holding.identity;
  const line = composition.holdings.find(
    (entry) => entry.listingId === listing.listingId,
  );
  return (
    <tr data-listing-id={listing.listingId}>
      <th scope="row">
        <ExactHolding listing={listing} />
        <small>Confirmed {row.holding.confirmedOn}</small>
      </th>
      <td data-composition-value>{usd(line?.valueUsd ?? null)}</td>
      <td data-composition-share>{share(line?.percent ?? null)}</td>
    </tr>
  );
}
function Cash({
  composition,
  balancesOn,
}: {
  composition: Composition;
  balancesOn: string;
}) {
  return (
    <tr data-composition-cash>
      <th scope="row">
        Authored cash<small>Balances through {balancesOn}</small>
      </th>
      <td data-composition-value>
        {composition.cashUsd === null ? "Unknown" : usd(composition.cashUsd)}
      </td>
      <td data-composition-share>{share(composition.cashPercent)}</td>
    </tr>
  );
}
function CompositionTable({
  composition,
  rows,
  balancesOn,
}: {
  composition: Composition;
  rows: readonly PortfolioCloseRow[];
  balancesOn: string;
}) {
  return (
    <div
      className="portfolio-composition-table managed-valuation-table"
      role="region"
      aria-label="Holding values and shares of complete value"
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Exact holding</th>
            <th scope="col">Value (USD)</th>
            <th scope="col">Share (%)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Holding
              key={row.holding.identity.listingId}
              row={row}
              composition={composition}
            />
          ))}
          <Cash composition={composition} balancesOn={balancesOn} />
        </tbody>
      </table>
    </div>
  );
}
function CompositionMethod() {
  return (
    <>
      <p>
        Percentages use each displayed USD cent value divided by the complete
        value including authored cash. Each percentage rounds half-up to two
        decimal places. Independently rounded percentages may not add to 100%.
      </p>
      <p>
        Percentages are available only with eligible closes for all holdings,
        known cash and a positive complete value. Partial holdings are not used
        as a smaller denominator.
      </p>
    </>
  );
}
/** Read-only rendering of the canonical close calculation; no weighting in the UI. */
export function PortfolioCloseComposition({
  id,
  review,
  rows,
}: {
  id: "portfolio-close-composition" | "portfolio-report-composition";
  review: AuthoredPortfolioCloseReviewResult;
  rows: readonly PortfolioCloseRow[];
}) {
  const composition = review.composition;
  return (
    <section
      id={id}
      className="portfolio-close-composition"
      aria-label="Composition at this close"
      data-method={composition.method}
    >
      <h3>Composition at this close</h3>
      <p>
        Raw closes on {review.asOfDate}; authored balances through{" "}
        {review.balancesOn}.
      </p>
      {composition.reason && (
        <p className="warning">{reasons[composition.reason]}</p>
      )}
      <dl>
        <dt>Complete value including authored cash</dt>
        <dd id={`${id}-total`}>{usd(composition.totalValueUsd)}</dd>
      </dl>
      <CompositionTable
        composition={composition}
        rows={rows}
        balancesOn={review.balancesOn}
      />
      <CompositionMethod />
    </section>
  );
}
