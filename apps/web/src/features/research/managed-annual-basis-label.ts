import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualRevenueConcept,
} from "@research-cockpit/contracts";

const labels: Readonly<Record<PersonalSecAnnualRevenueConcept, string>> = {
  Revenues: "Revenue",
  RevenueFromContractWithCustomerExcludingAssessedTax:
    "Customer contract revenue, excluding assessed tax",
  SalesRevenueNet: "Net sales revenue",
};

/** Display names only; an unrecognized retained selection keeps its exact key. */
export function managedAnnualBasisLabel(value: string): string {
  const concept = PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.find(
    (candidate) => candidate === value,
  );
  return concept === undefined ? value : labels[concept];
}
