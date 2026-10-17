import type {
  PersonalSecAnnualCashObservationDto,
  PersonalSecAnnualEvidenceDto,
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import {
  derivePersonalSecAnnualCashMargins,
  type PersonalSecAnnualCashMargin,
} from "@research-cockpit/personal-financial-analytics";
import {
  annualCashUnavailableReasonText,
  SecAnnualCashValueContent,
} from "./SecAnnualCashGeneration";
import {
  annualOperatingUnavailableReasonText,
  SecAnnualOperatingValueContent,
} from "./SecAnnualOperatingResults";
import { ObservationDetails } from "./SecAnnualObservation";
import { managedAnnualBasisLabel } from "./managed-annual-basis-label";

export function SecAnnualCashMargins({
  response,
}: {
  readonly response: PersonalSecAnnualEvidenceResponseDto;
}) {
  const { evidence } = response;
  return (
    <section
      className="sec-annual-cash-margins"
      aria-label="Annual cash generation margins"
    >
      <h5>Cash generation relative to revenue</h5>
      <p className="sec-quarterly-message">
        Operating cash flow less PP&amp;E purchases / reported revenue (%). Each
        revenue concept is a separate basis. The app uses the same filing and
        period, then rounds the percentage once to two decimal places.
      </p>
      {derivePersonalSecAnnualCashMargins(evidence).map((basis) => (
        <CashMarginBasis
          key={basis.concept}
          basis={basis}
          evidence={evidence}
        />
      ))}
    </section>
  );
}

type BasisProps = {
  readonly basis: PersonalSecAnnualCashMargin;
  readonly evidence: PersonalSecAnnualEvidenceDto;
};

function CashMarginBasis({ basis, evidence }: BasisProps) {
  return (
    <section
      data-cash-margin-basis={basis.concept}
      aria-label={`Cash generation margin basis ${basis.concept}`}
    >
      <h6>{managedAnnualBasisLabel(basis.concept)}</h6>
      <p className="sec-quarterly-message">{basis.concept}</p>
      <dl className="sec-annual-cash-values">
        <div>
          <dt>Reported revenue · USD</dt>
          <dd>
            <SecAnnualOperatingValueContent value={basis.operands.revenue} />
          </dd>
        </div>
        <div>
          <dt>
            Operating cash flow less PP&amp;E purchases / reported revenue (%)
            <small>App calculation</small>
          </dt>
          <dd>
            {basis.margin.status === "available" ? (
              <SecAnnualOperatingValueContent value={basis.margin} />
            ) : (
              <span className="sec-annual-cash-unavailable">
                Unavailable. {marginReason(basis)}
              </span>
            )}
          </dd>
        </div>
      </dl>
      <CashMarginInputs basis={basis} evidence={evidence} />
    </section>
  );
}

function CashMarginInputs({ basis, evidence }: BasisProps) {
  const { generation } = evidence;
  return (
    <details className="sec-quarterly-row-details sec-annual-cash-margin-inputs">
      <summary>
        Cash margin inputs · {managedAnnualBasisLabel(basis.concept)}
      </summary>
      <p>
        Cutoff {generation.cutoffAt}. Company Facts captured{" "}
        {generation.sources.companyFacts.fetchedAt ?? "Unavailable"}.
        Submissions captured{" "}
        {generation.sources.submissions.fetchedAt ?? "Unavailable"}. Completed{" "}
        {generation.completedAt}.
      </p>
      {evidence.target.status === "target" && (
        <p>
          Selected filing {evidence.target.accessionNumber}; report date{" "}
          {evidence.target.reportDate ?? "Unavailable"}; filed{" "}
          {evidence.target.filedDate}.
        </p>
      )}
      <dl className="sec-annual-cash-values">
        <div>
          <dt>Operating cash flow · USD</dt>
          <dd>
            <SecAnnualCashValueContent
              value={basis.operands.operatingCashFlow}
            />
          </dd>
        </div>
        <div>
          <dt>PP&amp;E purchases · USD</dt>
          <dd>
            <SecAnnualCashValueContent value={basis.operands.ppePurchases} />
          </dd>
        </div>
        <div>
          <dt>Reported revenue · USD</dt>
          <dd>
            <SecAnnualOperatingValueContent value={basis.operands.revenue} />
          </dd>
        </div>
      </dl>
      <InputReferences
        label="Operating cash flow"
        ids={basis.operands.operatingCashFlow.observationIds}
        rows={evidence.cashGeneration.operatingCashFlow.observations}
      />
      <InputReferences
        label="PP&E purchases"
        ids={basis.operands.ppePurchases.observationIds}
        rows={evidence.cashGeneration.ppePurchases.observations}
      />
      <InputReferences
        label={basis.concept}
        ids={basis.operands.revenue.observationIds}
        rows={evidence.observations}
      />
      <p>
        Calculation references:{" "}
        {basis.margin.observationIds.join(" · ") || "None"}
      </p>
    </details>
  );
}

function marginReason({ margin }: PersonalSecAnnualCashMargin): string {
  if (margin.status === "available") return "";
  switch (margin.reason) {
    case "period_mismatch":
      return "The cash amounts and revenue cover different periods.";
    case "filing_mismatch":
      return "The cash amounts and revenue come from different filings.";
    case "unsupported_sign":
      return "Reported PP&E purchases are negative; this percentage is unavailable.";
    case "nonpositive_revenue":
      return "This percentage requires reported revenue greater than zero.";
    default: {
      if (margin.stage === "revenue")
        return `Reported revenue: ${annualOperatingUnavailableReasonText(margin.reason)}`;
      const label =
        margin.stage === "operatingCashFlow"
          ? "Operating cash flow"
          : "PP&E purchases";
      return `${label}: ${annualCashUnavailableReasonText(margin.reason)}`;
    }
  }
}

function InputReferences({
  label,
  ids,
  rows,
}: {
  readonly label: string;
  readonly ids: readonly string[];
  readonly rows: readonly (
    PersonalSecQuarterlyObservationDto | PersonalSecAnnualCashObservationDto
  )[];
}) {
  return (
    <section aria-label={`${label} cash margin references`}>
      <p>
        {label} references: {ids.join(" · ") || "None"}
      </p>
      <ol>
        {rows
          .filter((row) => ids.includes(row.id))
          .map((row) => (
            <li key={row.id}>
              <ObservationDetails row={row} />
            </li>
          ))}
      </ol>
    </section>
  );
}
