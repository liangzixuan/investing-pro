import type {
  PersonalSecAnnualCanonicalEvidenceDto,
  PersonalSecAnnualStatementsDto,
} from "@research-cockpit/contracts";
import {
  AnnualStatementTable,
  AnnualStatementsContext,
  annualStatementLabels,
  annualStatementOrder,
} from "./ManagedAnnualStatements";

export interface AnnualStatementsReportViewProps {
  readonly evidence: PersonalSecAnnualCanonicalEvidenceDto;
  readonly statements: PersonalSecAnnualStatementsDto;
}

/** A static reading view of the captured canonical graph, with no note controls. */
export function AnnualStatementsReportView({
  evidence,
  statements,
}: AnnualStatementsReportViewProps) {
  return (
    <section
      className="managed-annual-statements managed-annual-statement-report"
      aria-label="Captured standardized annual statements"
    >
      <h3>Standardized annual statements</h3>
      <AnnualStatementsContext evidence={evidence} statements={statements} />
      {annualStatementOrder.map((id) => {
        const statement = statements.statements.find((item) => item.id === id);
        return (
          <section key={id} aria-label={`${annualStatementLabels[id]} report`}>
            <h4>{annualStatementLabels[id]}</h4>
            {statement ? (
              <AnnualStatementTable statement={statement} evidence={evidence} />
            ) : (
              <p>This statement view is unavailable in the captured report.</p>
            )}
          </section>
        );
      })}
    </section>
  );
}
