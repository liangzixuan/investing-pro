import {
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualOperatingResolutionDto,
  type PersonalSecAnnualOperatingResolutionInput,
  type PersonalSecAnnualRevenueConcept,
} from "@research-cockpit/contracts";
import {
  getPersonalSecAnnualRefusalReason,
  resolvePersonalSecAnnualEvidence,
} from "./personal-sec-annual-evidence";
import {
  resolvePersonalSecAnnualOperatingCore,
  resolvePersonalSecAnnualOperatingHistoryCore,
  comparePersonalSecAnnualOperatingCore,
  type PersonalSecAnnualOperatingCoreInput,
  type PersonalSecAnnualOperatingHistory,
  type PersonalSecAnnualOperatingComparison,
} from "./personal-sec-annual-operating-core";
export type {
  PersonalSecAnnualOperatingHistoryReason,
  PersonalSecAnnualOperatingHistoryPeriod,
  PersonalSecAnnualOperatingHistory,
  PersonalSecAnnualOperatingComparison,
} from "./personal-sec-annual-operating-core";

type Input = PersonalSecAnnualOperatingResolutionInput;
function admit(input: Input): PersonalSecAnnualOperatingCoreInput {
  for (const row of input.observations)
    if (!(
      (row.metric === "revenue" &&
        PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.some(
          (concept) => concept === row.concept,
        )) ||
      (row.metric === "net_income" && row.concept === "NetIncomeLoss")
    ))
      throw new TypeError("Invalid annual operating evidence.");
  for (const row of input.operatingResults.operatingIncome.observations)
    if (row.metric !== "operating_income")
      throw new TypeError("Invalid annual operating evidence.");
  // Keep full v5 income packet, completeness and count admission before delegation.
  resolvePersonalSecAnnualEvidence(input);
  return {
    cik: input.cik,
    generation: input.generation,
    target: input.target,
    observations: input.observations,
    incomeReason: getPersonalSecAnnualRefusalReason(input),
    operatingResults: input.operatingResults,
  };
}
function contractReason(input: Input): "invalid_clock" | null {
  return input.generation.definitionVersion ===
    PERSONAL_SEC_ANNUAL_DEFINITION_VERSION
    ? null
    : "invalid_clock";
}
/** Pure recomputation of one annual operating amount and each exact revenue basis. */
export function resolvePersonalSecAnnualOperatingResults(
  input: Input,
): PersonalSecAnnualOperatingResolutionDto {
  return resolvePersonalSecAnnualOperatingCore(
    admit(input),
    contractReason(input),
  );
}
/** Same-filing contiguous comparatives; net-income eligibility is not borrowed. */
export function resolvePersonalSecAnnualOperatingHistory(
  input: Input,
  concept: PersonalSecAnnualRevenueConcept,
): PersonalSecAnnualOperatingHistory {
  return resolvePersonalSecAnnualOperatingHistoryCore(
    admit(input),
    concept,
    contractReason(input),
  );
}
/** Change between the first two admitted same-basis periods; no growth percentage. */
export function comparePersonalSecAnnualOperatingEvidence(
  input: Input,
  concept: PersonalSecAnnualRevenueConcept,
): PersonalSecAnnualOperatingComparison {
  return comparePersonalSecAnnualOperatingCore(
    admit(input),
    concept,
    contractReason(input),
  );
}
