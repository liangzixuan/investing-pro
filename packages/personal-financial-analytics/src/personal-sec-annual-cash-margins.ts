import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type PersonalSecAnnualCashUnavailableReason,
  type PersonalSecAnnualCashValueDto,
  type PersonalSecAnnualEvidenceDto,
  type PersonalSecAnnualOperatingUnavailableReason,
  type PersonalSecAnnualOperatingValueDto,
  type PersonalSecAnnualRevenueConcept,
} from "@research-cockpit/contracts";
import { calculatePersonalOperatingCashFlowLessPpePurchasesMargin } from "./personal-cash-generation";

export type PersonalSecAnnualCashMarginReason =
  | PersonalSecAnnualCashUnavailableReason
  | PersonalSecAnnualOperatingUnavailableReason;

export type PersonalSecAnnualCashMarginValue =
  | Readonly<{
      status: "available";
      unit: "percent";
      value: string;
      startDate: string;
      endDate: string;
      accessionNumber: string;
      currentUseEligible: boolean;
      observationIds: readonly `sec-fact:${string}`[];
    }>
  | Readonly<{
      status: "unavailable";
      unit: "percent";
      stage: "revenue" | "operatingCashFlow" | "ppePurchases" | "calculation";
      reason: PersonalSecAnnualCashMarginReason;
      observationIds: readonly `sec-fact:${string}`[];
    }>;

export type PersonalSecAnnualCashMargin = Readonly<{
  concept: PersonalSecAnnualRevenueConcept;
  operands: Readonly<{
    operatingCashFlow: PersonalSecAnnualCashValueDto;
    ppePurchases: PersonalSecAnnualCashValueDto;
    revenue: PersonalSecAnnualOperatingValueDto<"USD">;
  }>;
  margin: PersonalSecAnnualCashMarginValue;
}>;

type Value =
  PersonalSecAnnualCashMargin["operands"][keyof PersonalSecAnnualCashMargin["operands"]];
function copyValue<T extends Value>(value: T): T {
  const copy: T = {
    ...value,
    observationIds: Object.freeze([...value.observationIds]),
  };
  return Object.freeze(copy);
}

function margin(
  operands: PersonalSecAnnualCashMargin["operands"],
): PersonalSecAnnualCashMarginValue {
  const {
    operatingCashFlow: operating,
    ppePurchases: purchases,
    revenue,
  } = operands;
  const observationIds = Object.freeze([
    ...operating.observationIds,
    ...purchases.observationIds,
    ...revenue.observationIds,
  ]);
  const unavailable = (
    stage: Extract<
      PersonalSecAnnualCashMarginValue,
      { status: "unavailable" }
    >["stage"],
    reason: PersonalSecAnnualCashMarginReason,
  ): PersonalSecAnnualCashMarginValue =>
    Object.freeze({
      status: "unavailable",
      unit: "percent",
      stage,
      reason,
      observationIds,
    });
  if (revenue.status === "unavailable")
    return unavailable("revenue", revenue.reason);
  if (operating.status === "unavailable")
    return unavailable("operatingCashFlow", operating.reason);
  if (purchases.status === "unavailable")
    return unavailable("ppePurchases", purchases.reason);
  if (
    operating.startDate !== purchases.startDate ||
    operating.endDate !== purchases.endDate ||
    operating.startDate !== revenue.startDate ||
    operating.endDate !== revenue.endDate
  )
    return unavailable("calculation", "period_mismatch");
  if (
    operating.accessionNumber !== purchases.accessionNumber ||
    operating.accessionNumber !== revenue.accessionNumber
  )
    return unavailable("calculation", "filing_mismatch");
  const calculated = calculatePersonalOperatingCashFlowLessPpePurchasesMargin(
    operating.value,
    purchases.value,
    revenue.value,
  );
  if (calculated.status === "unavailable")
    return unavailable("calculation", calculated.reason);
  return Object.freeze({
    status: "available",
    unit: "percent",
    value: calculated.value,
    startDate: operating.startDate,
    endDate: operating.endDate,
    accessionNumber: operating.accessionNumber,
    currentUseEligible:
      operating.currentUseEligible &&
      purchases.currentUseEligible &&
      revenue.currentUseEligible,
    observationIds,
  });
}

/** Already resolved Annual v5 cells only; no raw admission, clock or income gate. */
export function derivePersonalSecAnnualCashMargins(
  evidence: PersonalSecAnnualEvidenceDto,
): readonly PersonalSecAnnualCashMargin[] {
  const cash = evidence.cashGeneration.resolution;
  return Object.freeze(
    PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept) => {
      const basis = evidence.operatingResults.resolution.margins.find(
        (entry) => entry.concept === concept,
      );
      if (!basis) throw new TypeError("Missing resolved annual revenue basis.");
      const operands = Object.freeze({
        operatingCashFlow: copyValue(cash.operatingCashFlow),
        ppePurchases: copyValue(cash.ppePurchases),
        revenue: copyValue(basis.revenue),
      });
      return Object.freeze({ concept, operands, margin: margin(operands) });
    }),
  );
}
