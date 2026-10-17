import { useId, useState } from "react";
import type { PersonalSecAnnualStatementId } from "@research-cockpit/contracts";
import {
  AnnualStatementTable,
  AnnualStatementsContext,
  annualStatementLabels,
  annualStatementOrder,
} from "./ManagedAnnualStatements";
import type {
  ManagedFinancialScreen,
  ManagedFinancialScreenReportCapture,
  ManagedFinancialScreenResultRow,
  ManagedFinancialScreenState,
} from "./managed-financial-screen";
import "./managed-financial-screen-comparison.css";

export function ManagedFinancialScreenComparison({
  model,
  state,
  onOpenReport,
}: {
  readonly model: ManagedFinancialScreen;
  readonly state: ManagedFinancialScreenState;
  readonly onOpenReport: (
    capture: ManagedFinancialScreenReportCapture,
    opener: HTMLButtonElement,
  ) => void;
}) {
  const id = useId();
  const [group, setGroup] =
    useState<PersonalSecAnnualStatementId>("income_statement");
  return (
    <section
      className="managed-screen-comparison"
      aria-labelledby={`${id}-heading`}
    >
      <h4 id={`${id}-heading`}>Compare screened companies</h4>
      <p>
        Choose two loaded results with Compare left and Compare right. Each
        company keeps its own fiscal periods, accounting scope and original
        source times. The dates are not aligned. Your choices do not establish a
        peer group or change the shortlist.
      </p>
      <label
        className="managed-annual-statement-selector"
        htmlFor={`${id}-statement`}
      >
        Comparison statement
        <select
          id={`${id}-statement`}
          value={group}
          onChange={(event) => {
            const next = event.currentTarget
              .value as PersonalSecAnnualStatementId;
            if (annualStatementOrder.includes(next)) setGroup(next);
          }}
        >
          {annualStatementOrder.map((key) => (
            <option key={key} value={key}>
              {annualStatementLabels[key]}
            </option>
          ))}
        </select>
      </label>
      <p>{annualStatementLabels[group]} for each selected company.</p>
      <div className="managed-screen-comparison-pair">
        {(["left", "right"] as const).map((side) => (
          <Company
            key={side}
            side={side}
            row={state.comparison[side]}
            group={group}
            model={model}
            state={state}
            onOpenReport={onOpenReport}
          />
        ))}
      </div>
    </section>
  );
}

function Company({
  side,
  row,
  group,
  model,
  state,
  onOpenReport,
}: {
  readonly side: "left" | "right";
  readonly row: ManagedFinancialScreenResultRow | null;
  readonly group: PersonalSecAnnualStatementId;
} & Pick<
  Parameters<typeof ManagedFinancialScreenComparison>[0],
  "model" | "state" | "onOpenReport"
>) {
  const id = useId();
  const report = row?.report;
  const response = report?.response;
  const view = report?.view;
  const capture =
    state.run && row && response ? { run: state.run, row, response } : null;
  const actionable = capture !== null && model.canAdmitReport(capture);
  const listing = row?.member.listing;
  const statement = view?.statements.statements.find(
    (item) => item.id === group,
  );
  return (
    <article
      className="managed-screen-comparison-company"
      aria-labelledby={`${id}-company`}
    >
      <h5 id={`${id}-company`}>
        {side === "left" ? "Left company" : "Right company"}
        {listing ? `: ${listing.symbol} · ${listing.issuerName}` : ""}
      </h5>
      {listing && response && view ? (
        <>
          <p>
            {listing.securityName} · {listing.shareClassName} ·{" "}
            {listing.exchangeMic} · {listing.country}.
          </p>
          <details className="managed-annual-statement-inspect">
            <summary>Inspect listing identity</summary>
            <dl>
              <div>
                <dt>Listing</dt>
                <dd>{listing.listingId}</dd>
              </div>
              <div>
                <dt>Issuer</dt>
                <dd>{listing.issuerId}</dd>
              </div>
              <div>
                <dt>Security</dt>
                <dd>{listing.securityId}</dd>
              </div>
              <div>
                <dt>Share class</dt>
                <dd>{listing.shareClassId}</dd>
              </div>
              <div>
                <dt>CIK</dt>
                <dd>{response.security.cik}</dd>
              </div>
            </dl>
          </details>
          <div className="trial-actions">
            <button
              type="button"
              className="trial-secondary"
              disabled={!actionable}
              onClick={(event) => {
                if (
                  capture &&
                  model.getSnapshot() === state &&
                  model.canAdmitReport(capture)
                )
                  onOpenReport(capture, event.currentTarget);
              }}
            >
              Research {listing.symbol} from comparison
            </button>
            <button
              type="button"
              className="trial-secondary"
              disabled={!actionable}
              onClick={() => model.selectComparison(state, side, null)}
            >
              Clear {side} company
            </button>
          </div>
          <AnnualStatementsContext
            evidence={response.evidence}
            statements={view.statements}
            presentation="reader"
          />
          {statement ? (
            <AnnualStatementTable
              statement={statement}
              evidence={response.evidence}
            />
          ) : (
            <p>This statement view is unavailable for this load.</p>
          )}
        </>
      ) : (
        <p>Choose a loaded result for the {side} company.</p>
      )}
    </article>
  );
}
