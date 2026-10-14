import { useSyncExternalStore } from "react";
import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedAnnualReport } from "./managed-annual-report";
import type { ManagedEodHistory } from "./managed-eod-history";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import { managedAnnualBasisLabel } from "../features/research/managed-annual-basis-label";
import { SecAnnualCashValueContent } from "../features/research/SecAnnualCashGeneration";
import { SecAnnualLiquidityValueContent } from "../features/research/SecAnnualLiquidity";
import "./managed-company-snapshot.css";

export function ManagedCompanySnapshot({
  selection,
  price,
  annual,
  onSection,
}: {
  selection: ManagedResearchSelection;
  price: ManagedEodHistory;
  annual: ManagedAnnualReport;
  onSection: (section: "eod" | "annual") => void;
}) {
  const priceState = useSyncExternalStore(
    price.subscribe,
    price.getSnapshot,
    price.getSnapshot,
  );
  const annualState = useSyncExternalStore(
    annual.subscribe,
    annual.getSnapshot,
    annual.getSnapshot,
  );
  return (
    <CompanySnapshotView
      evidence={companySnapshotEvidence(selection, priceState, annualState)}
      onSection={onSection}
    />
  );
}

export function CompanySnapshotView({
  evidence,
  onSection,
}: {
  evidence: ReturnType<typeof companySnapshotEvidence>;
  onSection: (section: "eod" | "annual") => void;
}) {
  const price = evidence.price?.response;
  const annual = evidence.annual?.response;
  const last = price?.rows.at(-1);
  return (
    <details className="managed-company-snapshot">
      <summary>Loaded research snapshot</summary>
      <p>
        Evidence already loaded for this company visit. Opening this snapshot
        makes no request. Dates and bases stay separate.
      </p>
      <div className="managed-snapshot-grid">
        <section aria-label="Snapshot price">
          <h3>Price</h3>
          {price && last ? (
            <>
              <dl>
                <div>
                  <dt>Last raw close · USD</dt>
                  <dd className="managed-snapshot-amount">{last.close}</dd>
                </div>
                <div>
                  <dt>Trading date</dt>
                  <dd>{last.date}</dd>
                </div>
              </dl>
              <p>
                Tiingo · unadjusted for splits or dividends; not a live quote.
              </p>
              <p>
                Window {price.window.startDate} to {price.window.endDate}.
                Request started {price.requestStartedAt}; completed{" "}
                {price.completedAt}.
              </p>
              {price &&
                (evidence.price?.running ||
                  evidence.price?.showingPrevious) && (
                  <p className="discovery-warning">
                    Showing previous close history. This refresh has not
                    confirmed newer prices.
                  </p>
                )}
            </>
          ) : (
            <p>
              No close history loaded for this company. Open Price to request it
              explicitly.
            </p>
          )}
          <button className="trial-secondary" onClick={() => onSection("eod")}>
            Open Price section
          </button>
        </section>
        <section aria-label="Snapshot annual">
          <h3>Annual</h3>
          {annual ? (
            <>
              <AnnualSnapshot response={annual} />
              {(evidence.annual?.running ||
                evidence.annual?.showingPrevious) && (
                <p className="discovery-warning">
                  Showing previous annual evidence. This refresh has not
                  confirmed newer evidence.
                </p>
              )}
            </>
          ) : (
            <p>
              No annual evidence loaded for this company. Open Annual to request
              it explicitly.
            </p>
          )}
          <button
            className="trial-secondary"
            onClick={() => onSection("annual")}
          >
            Open Annual section
          </button>
        </section>
      </div>
    </details>
  );
}

function AnnualSnapshot({
  response,
}: {
  response: PersonalSecAnnualEvidenceResponseDto;
}) {
  const { target, resolution, generation, cashGeneration, liquidity } =
    response.evidence;
  return (
    <>
      <p>
        {target.status === "target"
          ? `${target.form} · report ending ${target.reportDate} · filed ${target.filedDate}`
          : "Observed annual report unavailable."}
      </p>
      {target.status === "target" && (
        <p>
          Accession {target.accessionNumber} ·{" "}
          <a
            href={`https://www.sec.gov/Archives/edgar/data/${response.evidence.cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open observed filing index
          </a>
        </p>
      )}
      <p>
        SEC Company Facts and submissions · cutoff {generation.cutoffAt};
        completed {generation.completedAt}.
      </p>
      <p>
        Source captures: Company Facts{" "}
        {generation.sources.companyFacts.fetchedAt ?? "unavailable"};
        submissions {generation.sources.submissions.fetchedAt ?? "unavailable"}.
      </p>
      <p>
        Exact, unscaled USD. Revenue bases stay separate; period length and
        accounting changes are unadjusted.
      </p>
      {!resolution.currentTargetEligible && (
        <p className="discovery-warning">
          Revenue and income are unavailable under the current-use policy at
          this load. Any valid reported amounts below are historical.
        </p>
      )}
      {[...resolution.bases]
        .sort(
          (a, b) =>
            Number(b.status === "eligible") - Number(a.status === "eligible"),
        )
        .map((basis) => (
          <section
            key={basis.concept}
            aria-label={`Snapshot revenue basis ${basis.concept}`}
          >
            <h4>{managedAnnualBasisLabel(basis.concept)}</h4>
            {basis.status !== "eligible" && (
              <p>
                {basis.status === "missing"
                  ? "Revenue and income are missing from this report's loaded evidence."
                  : basis.status === "withheld"
                    ? "Revenue and income are withheld because complete evidence is unavailable."
                    : "Revenue and income cannot form a valid annual pair."}{" "}
                Open Annual for validation details.
              </p>
            )}
            {basis.status === "eligible" &&
              basis.pairs
                .filter((pair) => pair.status === "eligible")
                .map((pair) => (
                  <div
                    key={`${pair.accessionNumber}:${pair.startDate}:${pair.endDate}`}
                  >
                    <p>
                      {pair.startDate ?? "Start date unknown"} to {pair.endDate}
                    </p>
                    <dl>
                      <div>
                        <dt>Revenue · USD</dt>
                        <dd>{pair.revenue}</dd>
                      </div>
                      <div>
                        <dt>Net income · USD</dt>
                        <dd>{pair.netIncome}</dd>
                      </div>
                      <div>
                        <dt>Net margin</dt>
                        <dd>
                          {pair.netMarginPercent === null
                            ? "Unavailable: revenue must be positive"
                            : `${pair.netMarginPercent}%`}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
          </section>
        ))}
      <dl className="managed-snapshot-independent">
        <div>
          <dt>Operating cash flow · USD</dt>
          <dd>
            <SecAnnualCashValueContent
              value={cashGeneration.resolution.operatingCashFlow}
            />
          </dd>
        </div>
        <div>
          <dt>Operating cash flow less PP&amp;E purchases · USD</dt>
          <dd>
            <SecAnnualCashValueContent
              value={
                cashGeneration.resolution.operatingCashFlowLessPpePurchases
              }
            />
          </dd>
        </div>
        <div>
          <dt>Working capital · USD</dt>
          <dd>
            <SecAnnualLiquidityValueContent
              value={liquidity.resolution.workingCapital}
            />
          </dd>
        </div>
        <div>
          <dt>Current ratio</dt>
          <dd>
            <SecAnnualLiquidityValueContent
              value={liquidity.resolution.currentRatio}
            />
          </dd>
        </div>
      </dl>
      <p>
        Cash flows cover their shown periods; liquidity values are balances at
        their shown dates. Open Annual for filing references, original inputs
        and validation details.
      </p>
    </>
  );
}
