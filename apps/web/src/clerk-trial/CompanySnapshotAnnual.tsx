import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import type { ManagedAnnualReportState } from "./managed-annual-report";
import { managedAnnualBasisLabel } from "../features/research/managed-annual-basis-label";
import { SecAnnualCashValueContent } from "../features/research/SecAnnualCashGeneration";
import { SecAnnualOperatingValueContent } from "../features/research/SecAnnualOperatingResults";
import { SecAnnualLiquidityValueContent } from "../features/research/SecAnnualLiquidity";
import { SecAnnualBalanceSheetValueContent } from "../features/research/SecAnnualBalanceSheet";

export function CompanySnapshotAnnual({
  navigationPending,
  state,
  onOpen,
}: {
  navigationPending: boolean;
  state: ManagedAnnualReportState | null;
  onOpen: () => void;
}) {
  const annual = state?.response;
  const view =
    annual && state?.view?.canonical === annual.evidence ? state.view : null;
  return (
    <section aria-label="Snapshot annual">
      <h3>Annual</h3>
      {annual ? (
        <>
          <AnnualSnapshot response={annual} view={view} />
          {(state?.running || state?.showingPrevious) && (
            <p className="discovery-warning">
              Showing previous annual evidence. This refresh has not confirmed
              newer evidence.
            </p>
          )}
        </>
      ) : (
        <p>
          No annual evidence loaded for this company. Open Annual to request it
          explicitly.
        </p>
      )}
      <button
        className="trial-secondary"
        disabled={navigationPending}
        onClick={onOpen}
      >
        Open Annual section
      </button>
    </section>
  );
}
type Props = {
  response: PersonalSecAnnualCanonicalResponseDto;
  view: PersonalSecAnnualCanonicalView | null;
};
type ViewProps = { view: PersonalSecAnnualCanonicalView };
function AnnualSnapshot({ response, view }: Props) {
  return (
    <>
      <AnnualSnapshotHeader response={response} view={view} />
      {view ? (
        <>
          <SnapshotIncome view={view} />
          <SnapshotOperating view={view} />
          <SnapshotCashLiquidity view={view} />
          <SnapshotBalanceSheet view={view} />
        </>
      ) : (
        <p>Financial values are unavailable for this loaded annual evidence.</p>
      )}
    </>
  );
}
function AnnualSnapshotHeader({ response, view }: Props) {
  const { target, generation } = response.evidence;
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
      {view && !view.income.resolution.currentTargetEligible && (
        <p className="discovery-warning">
          Revenue and net income cannot form a current-use pair at this load.
          Independent measures retain their own eligibility below.
        </p>
      )}
    </>
  );
}
function SnapshotIncome({ view }: ViewProps) {
  const { resolution } = view.income;
  return (
    <>
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
    </>
  );
}
function SnapshotCashLiquidity({ view }: ViewProps) {
  const { cashGeneration, liquidity } = view;
  return (
    <>
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

function SnapshotBalanceSheet({ view }: ViewProps) {
  const { resolution } = view.balanceSheet;
  return (
    <section aria-label="Snapshot balance sheet totals">
      <h4>Balance sheet totals</h4>
      <dl className="managed-snapshot-independent">
        {(
          [
            ["totalAssets", "Total assets"],
            ["totalLiabilities", "Total liabilities"],
            ["shareholdersEquity", "Shareholders’ equity · parent"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <dt>{label} · USD</dt>
            <dd>
              <SecAnnualBalanceSheetValueContent value={resolution[key]} />
            </dd>
          </div>
        ))}
      </dl>
      <p>
        Parent equity excludes noncontrolling interests. Open Annual for exact
        reported concepts, filing references and validation details.
      </p>
    </section>
  );
}

function SnapshotOperating({ view }: ViewProps) {
  const { operatingIncome, margins } = view.operatingResults.resolution;
  return (
    <section aria-label="Snapshot operating results">
      <h4>Operating results</h4>
      <dl className="managed-snapshot-independent">
        <div>
          <dt>Reported operating income · USD</dt>
          <dd>
            <SecAnnualOperatingValueContent value={operatingIncome} />
          </dd>
        </div>
        {margins.map((basis) => (
          <div key={basis.concept}>
            <dt>Operating margin · {managedAnnualBasisLabel(basis.concept)}</dt>
            <dd>
              <SecAnnualOperatingValueContent value={basis.operatingMargin} />
            </dd>
          </div>
        ))}
      </dl>
      <p>
        Margins use each named positive revenue basis and the same filing and
        period. Open Annual for exact inputs and references.
      </p>
    </section>
  );
}
