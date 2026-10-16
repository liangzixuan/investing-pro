import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import { derivePersonalSecAnnualCashMargins } from "@research-cockpit/personal-financial-analytics";
import {
  SecAnnualCashMarginInputs,
  SecAnnualCashMarginValueContent,
} from "../features/research/SecAnnualCashMargins";
import { SecAnnualOperatingValueContent } from "../features/research/SecAnnualOperatingResults";
import { managedAnnualBasisLabel } from "../features/research/managed-annual-basis-label";

type Response = PersonalSecAnnualEvidenceResponseDto;
const sides = ["left", "right"] as const;

export function ManagedAnnualCashMarginComparisonRows({
  responses,
}: {
  readonly responses: Readonly<Record<(typeof sides)[number], Response | null>>;
}) {
  const bases = {
    left: responses.left
      ? derivePersonalSecAnnualCashMargins(responses.left.evidence)
      : null,
    right: responses.right
      ? derivePersonalSecAnnualCashMargins(responses.right.evidence)
      : null,
  };
  return PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept, index) => (
    <tr key={concept} data-annual-comparison-cash-margin={concept}>
      <th scope="row">
        Cash generation relative to revenue
        <small>{managedAnnualBasisLabel(concept)}</small>
        <small>{concept}</small>
      </th>
      {sides.map((side) => {
        const basis = bases[side]?.[index];
        return (
          <td key={side}>
            {basis ? (
              <>
                <p>
                  <small>Reported revenue · USD</small>
                  <SecAnnualOperatingValueContent
                    value={basis.operands.revenue}
                  />
                </p>
                <p>
                  <small>
                    Operating cash flow less PP&amp;E purchases / reported
                    revenue (%) · App calculation
                  </small>
                  <SecAnnualCashMarginValueContent basis={basis} />
                </p>
              </>
            ) : (
              "Not loaded"
            )}
          </td>
        );
      })}
    </tr>
  ));
}

export function ManagedAnnualCashMarginComparisonSources({
  response,
}: {
  readonly response: Response;
}) {
  return derivePersonalSecAnnualCashMargins(response.evidence).map((basis) => (
    <SecAnnualCashMarginInputs
      key={basis.concept}
      basis={basis}
      evidence={response.evidence}
    />
  ));
}
