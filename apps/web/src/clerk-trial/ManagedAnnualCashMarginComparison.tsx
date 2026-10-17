import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import {
  SecAnnualCashMarginInputs,
  SecAnnualCashMarginValueContent,
} from "../features/research/SecAnnualCashMargins";
import { SecAnnualOperatingValueContent } from "../features/research/SecAnnualOperatingResults";
import { managedAnnualBasisLabel } from "../features/research/managed-annual-basis-label";

type Response = PersonalSecAnnualCanonicalResponseDto;
const sides = ["left", "right"] as const;

export function ManagedAnnualCashMarginComparisonRows({
  responses,
  views,
}: {
  readonly responses: Readonly<Record<(typeof sides)[number], Response | null>>;
  readonly views: Readonly<
    Record<(typeof sides)[number], PersonalSecAnnualCanonicalView | null>
  >;
}) {
  const bases = {
    left:
      responses.left && views.left?.canonical === responses.left.evidence
        ? views.left.cashMargins
        : null,
    right:
      responses.right && views.right?.canonical === responses.right.evidence
        ? views.right.cashMargins
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
            ) : responses[side] ? (
              "Unavailable. The source and financial results do not match."
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
  view,
}: {
  readonly response: Response;
  readonly view: PersonalSecAnnualCanonicalView;
}) {
  if (view.canonical !== response.evidence) return null;
  return view.cashMargins.map((basis) => (
    <SecAnnualCashMarginInputs
      key={basis.concept}
      basis={basis}
      evidence={response.evidence}
    />
  ));
}
