import { CloseHistoryChart } from "../features/research/CloseHistoryChart";
import type { ManagedCompanyFilingsState } from "./managed-company-filings";
import type { ManagedEodHistoryState } from "./managed-eod-history";
import type { ManagedFilingsReviewRow } from "./managed-filings-review";
import {
  FilingsPacketSource,
  FilingsPacketSummary,
} from "./ManagedFilingsPacket";
import { ManagedFilingsRefreshComparisonDetails } from "./ManagedFilingsRefreshComparisonDetails";
import { ListingIdentity } from "./ManagedListingIdentity";

function PriceEvidence({ price }: { price: ManagedEodHistoryState | null }) {
  const response = price?.response;
  return (
    <section aria-label="Retained daily Price evidence">
      <h5>Price</h5>
      <p>
        {price?.message || "No price history has been loaded for this review."}
      </p>
      {price && !price.available && (
        <p>Price source not supported for this listing.</p>
      )}
      {price?.showingPrevious && response && (
        <p>
          Previous history retained. This attempt has not confirmed newer
          prices.
        </p>
      )}
      {response && (
        <>
          <p>
            Raw end-of-day closing prices in USD from Tiingo. Prices are not
            adjusted for splits or dividends and are not live quotes.
          </p>
          <dl className="managed-metadata">
            <dt>Requested window</dt>
            <dd>
              {response.window.startDate} to {response.window.endDate}
            </dd>
            <dt>Request started</dt>
            <dd>{response.requestStartedAt}</dd>
            <dt>Request completed</dt>
            <dd>{response.completedAt}</dd>
          </dl>
          {response.rows.length ? (
            <CloseHistoryChart
              appearance="precision-desk"
              rows={response.rows}
              symbol={response.security.symbol}
            />
          ) : (
            <p>The verified response contains no closing prices.</p>
          )}
          <details>
            <summary>Complete retained price history</summary>
            <pre>{JSON.stringify(response, null, 2)}</pre>
          </details>
        </>
      )}
    </section>
  );
}

function FilingsEvidence({ filings }: { filings: ManagedCompanyFilingsState }) {
  const response = filings.response;
  const last = filings.lastCheck !== response ? filings.lastCheck : null;
  return (
    <section aria-label="Retained daily Filings evidence">
      <h5>Filings</h5>
      <p>
        {filings.message ||
          "No filing response has been loaded for this review."}
      </p>
      {!filings.supported && (
        <p>Filings source not supported for this listing.</p>
      )}
      {filings.showingPrevious && response && (
        <p>
          Previous filing response retained. This attempt has not confirmed
          newer filings.
        </p>
      )}
      {response && (
        <>
          <p>Source result: {response.issuer.status.replaceAll("_", " ")}</p>
          <FilingsPacketSummary response={response} />
          <FilingsPacketSource response={response} />
          <ol aria-label="All filings retained for this daily review company">
            {response.issuer.filings.map((filing) => (
              <li key={filing.accessionNumber}>
                <a href={filing.sourceUrl} target="_blank" rel="noreferrer">
                  Form {filing.form} · {filing.accessionNumber}
                </a>
                <dl className="managed-metadata">
                  <dt>Filed</dt>
                  <dd>{filing.filingDate}</dd>
                  <dt>Report date</dt>
                  <dd>{filing.reportDate ?? "Not reported"}</dd>
                </dl>
              </li>
            ))}
          </ol>
          {filings.refreshComparison?.current === response && (
            <ManagedFilingsRefreshComparisonDetails
              comparison={filings.refreshComparison}
            />
          )}
          <details>
            <summary>Complete retained filing packet</summary>
            <pre>{JSON.stringify(response, null, 2)}</pre>
          </details>
        </>
      )}
      {last && (
        <details>
          <summary>Latest filing attempt</summary>
          <p>Source result: {last.issuer.status.replaceAll("_", " ")}</p>
          <FilingsPacketSource response={last} />
          <pre>{JSON.stringify(last, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}

export function ManagedWatchlistDailyReviewEvidence({
  row,
}: {
  row: ManagedFilingsReviewRow;
}) {
  return (
    <div className="managed-watchlist-daily-evidence">
      <p>
        <ListingIdentity member={row.member.listing} />
      </p>
      <PriceEvidence price={row.price} />
      <FilingsEvidence filings={row.filings} />
    </div>
  );
}
