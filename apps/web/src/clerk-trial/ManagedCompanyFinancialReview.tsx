import { useId, useMemo } from "react";
import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import {
  derivePersonalSecAnnualFinancialReview,
  type PersonalSecAnnualFinancialReviewRow,
} from "@research-cockpit/personal-financial-analytics";
import { SecAnnualOperatingValueContent } from "../features/research/SecAnnualOperatingResults";
import { SecAnnualCashValueContent } from "../features/research/SecAnnualCashGeneration";
import { SecAnnualLiquidityValueContent } from "../features/research/SecAnnualLiquidity";
import { SecAnnualBalanceSheetValueContent } from "../features/research/SecAnnualBalanceSheet";
import type { ResearchWatchlistState } from "./managed-workspace";
import type { ManagedFinancialReviewActions } from "./managed-financial-review";
import { ManagedFinancialReviewNote } from "./ManagedFinancialReviewNote";

export function FinancialReviewValue({
  row,
}: {
  readonly row: PersonalSecAnnualFinancialReviewRow;
}) {
  switch (row.key) {
    case "operatingIncome":
      return <SecAnnualOperatingValueContent value={row.value} />;
    case "workingCapital":
      return <SecAnnualLiquidityValueContent value={row.value} />;
    case "shareholdersEquity":
      return <SecAnnualBalanceSheetValueContent value={row.value} />;
    default:
      return <SecAnnualCashValueContent value={row.value} />;
  }
}

function FinancialReviewOperands({
  row,
}: {
  readonly row: PersonalSecAnnualFinancialReviewRow;
}) {
  if (row.key === "operatingCashFlowLessPpePurchases")
    return (
      <details>
        <summary>Calculation inputs</summary>
        <p>Reported operating cash flow</p>
        <SecAnnualCashValueContent value={row.operands.operatingCashFlow} />
        <p>Less reported PP&amp;E purchases</p>
        <SecAnnualCashValueContent value={row.operands.ppePurchases} />
      </details>
    );
  if (row.key === "workingCapital")
    return (
      <details>
        <summary>Calculation inputs</summary>
        <p>Reported current assets</p>
        <SecAnnualLiquidityValueContent value={row.operands.currentAssets} />
        <p>Less reported current liabilities</p>
        <SecAnnualLiquidityValueContent
          value={row.operands.currentLiabilities}
        />
      </details>
    );
  return null;
}

function FinancialReviewFact({
  row,
  onInspect,
}: {
  readonly row: PersonalSecAnnualFinancialReviewRow;
  readonly onInspect: (
    section: PersonalSecAnnualFinancialReviewRow["section"],
  ) => void;
}) {
  return (
    <div>
      <dt>
        {row.label}
        <small>{row.operands ? "App calculation" : "Reported"} · USD</small>
      </dt>
      <dd>
        <FinancialReviewValue row={row} />
        {row.sign !== null && <small>Amount sign: {row.sign}</small>}
        <FinancialReviewOperands row={row} />
        <button
          type="button"
          className="trial-secondary"
          aria-label={`Inspect ${row.label}`}
          onClick={() => onInspect(row.section)}
        >
          Inspect inputs
        </button>
      </dd>
    </div>
  );
}

export function ManagedCompanyFinancialReview({
  response,
  actions,
  watchlist,
  running,
  onInspect,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
  readonly actions: ManagedFinancialReviewActions;
  readonly watchlist: ResearchWatchlistState;
  readonly running: boolean;
  readonly onInspect: (
    section: PersonalSecAnnualFinancialReviewRow["section"],
  ) => void;
}) {
  const id = useId();
  const rows = useMemo(
    () => derivePersonalSecAnnualFinancialReview(response.evidence),
    [response],
  );
  return (
    <section
      className="managed-financial-review"
      aria-labelledby={`${id}-heading`}
    >
      <h4 id={`${id}-heading`}>Financial review</h4>
      <p>
        Five independent facts from this Annual report. Signs describe amounts
        and do not rate the company. Flows and balances keep their own dates.
      </p>
      <dl className="managed-financial-review-facts">
        {rows.map((row) => (
          <FinancialReviewFact key={row.key} row={row} onInspect={onInspect} />
        ))}
      </dl>
      <ManagedFinancialReviewNote
        response={response}
        rows={rows}
        actions={actions}
        watchlist={watchlist}
        running={running}
      />
    </section>
  );
}
