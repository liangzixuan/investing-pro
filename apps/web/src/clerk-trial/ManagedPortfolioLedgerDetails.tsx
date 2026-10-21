import type {
  ManagedPortfolioPayload,
  PersonalPortfolioIdentity,
} from "@research-cockpit/contracts";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
const usd = (value: string | null) =>
  value === null ? "Unknown" : `USD ${value}`;

export function PortfolioIdentity({
  listing,
}: {
  listing: PersonalPortfolioIdentity;
}) {
  return (
    <details>
      <summary>
        <ListingIdentity member={listing} />
      </summary>
      <dl>
        {Object.entries(identityLabels).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{listing[key as keyof PersonalPortfolioIdentity]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function LedgerListing({
  ledger,
  listingId,
}: {
  ledger: ManagedPortfolioPayload;
  listingId: string | null;
}) {
  const listing = ledger.identities.find(
    (entry) => entry.listingId === listingId,
  );
  return listing ? <ListingIdentity member={listing} /> : <span>Cash</span>;
}
export function PortfolioActivityRows({
  ledger,
  query = "",
  type = "all",
}: {
  ledger: ManagedPortfolioPayload;
  query?: string;
  type?: string;
}) {
  const term = query.trim().toLowerCase();
  const rows = ledger.transactions
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => {
      const listing = ledger.identities.find(
        (item) => item.listingId === entry.listingId,
      );
      return (
        (type === "all" || entry.type === type) &&
        `${entry.date} ${entry.type} ${listing?.symbol ?? "Cash"} ${listing?.issuerName ?? ""}`
          .toLowerCase()
          .includes(term)
      );
    });
  return (
    <>
      {rows.length === 0 ? (
        <p>No matching activities.</p>
      ) : (
        <ol>
          {rows.map(({ entry, index }) => (
            <li key={entry.id} value={index + 1}>
              <p>
                {entry.date} · {entry.type}
              </p>
              <LedgerListing ledger={ledger} listingId={entry.listingId} />
              <p>
                {entry.type === "split"
                  ? `${entry.ratioNumerator} for ${entry.ratioDenominator}`
                  : `${entry.shares === null ? "No share amount" : `${entry.shares} shares`}; gross ${usd(entry.grossUsd)}; fee ${usd(entry.feeUsd)}`}
              </p>
              <details>
                <summary>Activity identifiers</summary>
                <p>
                  Activity ID: {entry.id}. Listing ID:{" "}
                  {entry.listingId ?? "Cash activity"}.
                </p>
              </details>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
export function PortfolioLedgerDetails({
  ledger,
}: {
  ledger: ManagedPortfolioPayload;
}) {
  return (
    <>
      <p>
        Opening balances at the end of {ledger.opening.asOfDate}. Opening cash:{" "}
        {usd(ledger.opening.cashUsd)}. {ledger.identities.length} registered
        listings and {ledger.transactions.length} authored activities.
      </p>
      {ledger.identities.map((listing) => (
        <PortfolioIdentity key={listing.listingId} listing={listing} />
      ))}
      <details>
        <summary>Catalog reference</summary>
        <p>{ledger.snapshotSha256}</p>
      </details>
      <h4>Opening holdings</h4>
      {ledger.opening.holdings.length === 0 ? (
        <p>No opening holdings.</p>
      ) : (
        <ul>
          {ledger.opening.holdings.map((holding) => (
            <li key={holding.listingId}>
              <LedgerListing ledger={ledger} listingId={holding.listingId} />
              <p>
                {holding.shares} shares; basis {usd(holding.totalCostBasisUsd)};
                confirmed {holding.confirmedOn}.
              </p>
              <details>
                <summary>Holding identifier</summary>
                <p>Listing ID: {holding.listingId}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
      <h4>Complete authored activity order</h4>
      <PortfolioActivityRows ledger={ledger} />
      <p>
        FIFO uses an opening pool where earlier lots are unknown. Missing cash
        or basis stays unknown. This ledger does not calculate market value,
        investment returns or tax liability.
      </p>
    </>
  );
}
