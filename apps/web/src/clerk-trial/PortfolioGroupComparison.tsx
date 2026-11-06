import type {
  ManagedPortfolioPayload,
  PersonalPortfolioLedgerProjection,
} from "@research-cockpit/contracts";
import {
  PortfolioIdentity,
  PortfolioLedgerDetails,
} from "./ManagedPortfolioLedgerDetails";

type Projection = Extract<
  PersonalPortfolioLedgerProjection,
  { status: "valid" }
>;
const usd = (value: string | null) =>
  value === null ? "Unknown" : `USD ${value}`;

function ProjectedHolding({
  projection,
  listingId,
}: {
  projection: Projection;
  listingId: string;
}) {
  const holding = projection.portfolio.holdings.find(
    (entry) => entry.identity.listingId === listingId,
  );
  if (!holding) return <p>Not held</p>;
  return (
    <p>
      {holding.shares} shares; basis {usd(holding.totalCostBasisUsd)}; confirmed{" "}
      {holding.confirmedOn}.
    </p>
  );
}

function ProjectionSummary({ projection }: { projection: Projection }) {
  return (
    <dl>
      <div>
        <dt>Cash</dt>
        <dd>{usd(projection.portfolio.cashUsd)}</dd>
      </div>
      <div>
        <dt>Known realized gain subtotal</dt>
        <dd>{usd(projection.realized.knownGainSubtotalUsd)}</dd>
      </div>
      <div>
        <dt>Total realized gain</dt>
        <dd>{usd(projection.realized.totalGainUsd)}</dd>
      </div>
      <div>
        <dt>Sales with unknown basis</dt>
        <dd>
          {projection.realized.unknownSales} of {projection.realized.sales}
        </dd>
      </div>
    </dl>
  );
}

/** Complete passive comparison; projections use the same explicit evaluation day. */
export function PortfolioGroupComparison({
  baseline,
  candidate,
  before,
  after,
  evaluationDay,
}: {
  baseline: ManagedPortfolioPayload;
  candidate: ManagedPortfolioPayload;
  before: Projection;
  after: Projection;
  evaluationDay: string;
}) {
  return (
    <div className="portfolio-group-comparison">
      <p>
        Ledger validity checked through {evaluationDay} UTC. Amounts come from
        your authored records. Unknown cash or basis stays unknown.
      </p>
      <div className="portfolio-group-pair">
        <section aria-label="Before this group">
          <h4>Before this group</h4>
          <ProjectionSummary projection={before} />
        </section>
        <section aria-label="After this group">
          <h4>After this group</h4>
          <ProjectionSummary projection={after} />
        </section>
      </div>
      <h4>Every registered holding</h4>
      {baseline.identities.length === 0 && <p>No registered listings.</p>}
      {baseline.identities.map((identity) => (
        <section
          key={identity.listingId}
          aria-label={`Holding comparison ${identity.symbol}`}
        >
          <PortfolioIdentity listing={identity} />
          <div className="portfolio-group-pair">
            <div>
              <h5>Before</h5>
              <ProjectedHolding
                projection={before}
                listingId={identity.listingId}
              />
            </div>
            <div>
              <h5>After</h5>
              <ProjectedHolding
                projection={after}
                listingId={identity.listingId}
              />
            </div>
          </div>
        </section>
      ))}
      <details>
        <summary>Complete before and after ledgers</summary>
        <section aria-label="Original authored ledger">
          <h4>Original authored ledger</h4>
          <PortfolioLedgerDetails ledger={baseline} />
        </section>
        <section aria-label="Proposed authored ledger">
          <h4>Proposed authored ledger</h4>
          <PortfolioLedgerDetails ledger={candidate} />
        </section>
      </details>
      <p>
        Realized gains use FIFO with an opening pool. This review does not
        calculate market values, investment returns or tax liability.
      </p>
    </div>
  );
}
