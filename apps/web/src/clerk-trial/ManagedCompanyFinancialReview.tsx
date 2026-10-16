import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import {
  derivePersonalSecAnnualFinancialReview,
  type PersonalSecAnnualFinancialReviewKey,
  type PersonalSecAnnualFinancialReviewRow,
} from "@research-cockpit/personal-financial-analytics";
import { SecAnnualOperatingValueContent } from "../features/research/SecAnnualOperatingResults";
import { SecAnnualCashValueContent } from "../features/research/SecAnnualCashGeneration";
import { SecAnnualLiquidityValueContent } from "../features/research/SecAnnualLiquidity";
import { SecAnnualBalanceSheetValueContent } from "../features/research/SecAnnualBalanceSheet";
import type { ResearchWatchlistState } from "./managed-workspace";
import type {
  FinancialReviewPreparation,
  ManagedFinancialReviewActions,
} from "./managed-financial-review";

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
  const [keys, setKeys] = useState<
    readonly PersonalSecAnnualFinancialReviewKey[]
  >([]);
  const [preparation, setPreparation] =
    useState<FinancialReviewPreparation | null>(null);
  const [message, setMessage] = useState("");
  const live = useRef(false);
  const choiceRevision = useRef(0);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const preview = preparation?.preview ?? null;
  const current = preview !== null && actions.isCurrent(preview);
  const blocked = running || !watchlist.canEdit || !watchlist.member;
  const reason = running
    ? "Wait for the Annual report request to finish or cancel it."
    : !watchlist.member || !watchlist.canEdit
      ? (watchlist.reason ??
        "Add this company to the watchlist draft to prepare a financial review.")
      : preview && !current
        ? "The note, source or visit changed. Preview the financial review again."
        : preparation?.reason;
  const revision = choiceRevision.current;
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
          <div key={row.key}>
            <dt>
              {row.label}
              <small>
                {row.operands ? "App calculation" : "Reported"} · USD
              </small>
            </dt>
            <dd>
              <FinancialReviewValue row={row} />
              {row.sign !== null && <small>Amount sign: {row.sign}</small>}
              {row.key === "operatingCashFlowLessPpePurchases" && (
                <details>
                  <summary>Calculation inputs</summary>
                  <p>Reported operating cash flow</p>
                  <SecAnnualCashValueContent
                    value={row.operands.operatingCashFlow}
                  />
                  <p>Less reported PP&amp;E purchases</p>
                  <SecAnnualCashValueContent
                    value={row.operands.ppePurchases}
                  />
                </details>
              )}
              {row.key === "workingCapital" && (
                <details>
                  <summary>Calculation inputs</summary>
                  <p>Reported current assets</p>
                  <SecAnnualLiquidityValueContent
                    value={row.operands.currentAssets}
                  />
                  <p>Less reported current liabilities</p>
                  <SecAnnualLiquidityValueContent
                    value={row.operands.currentLiabilities}
                  />
                </details>
              )}
              <button
                type="button"
                className="trial-secondary"
                aria-label={`Inspect ${row.label}`}
                onClick={() => {
                  if (live.current) onInspect(row.section);
                }}
              >
                Inspect inputs
              </button>
            </dd>
          </div>
        ))}
      </dl>
      <details className="managed-financial-review-note">
        <summary>Add financial facts to the note draft</summary>
        <p id={`${id}-help`}>
          Select the facts to include. Preview shows the complete note with
          source dates, references and any unavailable or historical
          qualifications. If it exceeds 2,000 characters, select fewer facts or
          edit the note. Nothing is saved automatically.
        </p>
        <fieldset
          disabled={blocked}
          aria-describedby={`${id}-help ${id}-status`}
        >
          <legend>Facts to include</legend>
          {rows.map((row) => (
            <label key={row.key}>
              <input
                type="checkbox"
                checked={keys.includes(row.key)}
                onChange={(event) => {
                  choiceRevision.current++;
                  setKeys(
                    event.currentTarget.checked
                      ? [...keys, row.key]
                      : keys.filter((key) => key !== row.key),
                  );
                  setPreparation(null);
                  setMessage("");
                }}
              />
              {row.label}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          className="trial-secondary"
          disabled={blocked || keys.length === 0}
          onClick={() => {
            if (!live.current || choiceRevision.current !== revision || blocked)
              return;
            setPreparation(actions.prepare(response, keys));
            setMessage("");
          }}
        >
          Preview financial review
        </button>
        {preview && (
          <div
            className="managed-financial-review-preview"
            aria-label="Complete financial review note preview"
          >
            <h5>
              {current ? "Complete note preview" : "Previous note preview"}
            </h5>
            <p className="trial-saved-note">{preview.note}</p>
            <button
              type="button"
              className="trial-secondary"
              disabled={blocked || !current}
              onClick={() => {
                if (
                  !live.current ||
                  choiceRevision.current !== revision ||
                  blocked ||
                  !actions.isCurrent(preview)
                )
                  return;
                const result = actions.append(preview);
                setMessage(result.message);
                if (result.appended) setPreparation(null);
              }}
            >
              Add financial review to note draft
            </button>
          </div>
        )}
        <p id={`${id}-status`} role="status" aria-live="polite">
          {message ||
            reason ||
            (keys.length
              ? "Preview the complete note before adding these facts."
              : "Select at least one fact to preview.")}
        </p>
      </details>
    </section>
  );
}
