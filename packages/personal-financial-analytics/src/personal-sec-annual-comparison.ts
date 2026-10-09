import type {
  PersonalSecAnnualPairDto,
  PersonalSecAnnualResolutionInput,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import Decimal from "decimal.js";
import {
  calculatePersonalSecAnnualNetMargin,
  getPersonalSecAnnualRowReason,
  resolvePersonalSecAnnualEvidence,
} from "./personal-sec-annual-evidence";

const D = Decimal.clone({
  defaults: true,
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -256,
  toExpPos: 256,
});

export type PersonalSecAnnualChange = Readonly<{
  prior: string;
  current: string;
  difference: string;
  percent:
    | Readonly<{ status: "available"; value: string }>
    | Readonly<{
        status: "unavailable";
        reason: "zero_prior" | "negative_prior";
      }>;
}>;
export type PersonalSecAnnualComparison =
  | Readonly<{
      status: "unavailable";
      reason:
        | "current_report_unavailable"
        | "current_use_unavailable"
        | "previous_period_missing"
        | "previous_period_ambiguous"
        | "previous_period_invalid"
        | "filing_metadata_mismatch"
        | "previous_values_conflicted";
    }>
  | Readonly<{
      status: "available";
      concept: PersonalSecAnnualPairDto["concept"];
      accessionNumber: string;
      priorStartDate: string;
      priorEndDate: string;
      currentStartDate: string;
      currentEndDate: string;
      revenue: PersonalSecAnnualChange;
      netIncome: PersonalSecAnnualChange;
      netMargin: PersonalSecAnnualMarginComparison;
      observationIds: readonly string[];
    }>;

export type PersonalSecAnnualMarginComparison =
  | Readonly<{
      status: "unavailable";
      current: string;
      reason: "zero_prior_revenue" | "negative_prior_revenue";
    }>
  | Readonly<{
      status: "available";
      prior: string;
      current: string;
      difference: string;
      direction: "higher" | "lower" | "unchanged";
    }>;

function marginComparison(
  priorRevenue: string,
  priorIncome: string,
  currentRevenue: string,
  currentIncome: string,
): PersonalSecAnnualMarginComparison {
  const priorDenominator = new D(priorRevenue);
  const current = calculatePersonalSecAnnualNetMargin(
    currentRevenue,
    currentIncome,
  );
  if (!priorDenominator.gt(0))
    return Object.freeze({
      status: "unavailable",
      current,
      reason: priorDenominator.isZero()
        ? "zero_prior_revenue"
        : "negative_prior_revenue",
    });
  // Cross multiplication preserves a small difference between large ratios.
  // Round once after subtracting the ratios, never the displayed percentages.
  const numerator = new D(currentIncome)
    .times(priorDenominator)
    .minus(new D(priorIncome).times(currentRevenue));
  const difference = numerator
    .div(priorDenominator.times(currentRevenue))
    .times(100)
    .toDecimalPlaces(2);
  return Object.freeze({
    status: "available",
    prior: calculatePersonalSecAnnualNetMargin(priorRevenue, priorIncome),
    current,
    difference: difference.isZero() ? "0" : difference.toFixed(),
    direction: numerator.isZero()
      ? "unchanged"
      : numerator.isNegative()
        ? "lower"
        : "higher",
  });
}

function change(prior: string, current: string): PersonalSecAnnualChange {
  const denominator = new D(prior);
  const difference = new D(current).minus(denominator);
  const percentage = denominator.gt(0)
    ? difference.div(denominator).times(100).toDecimalPlaces(2)
    : null;
  return Object.freeze({
    prior,
    current,
    difference: difference.isZero() ? "0" : difference.toFixed(),
    percent: Object.freeze(
      percentage === null
        ? {
            status: "unavailable" as const,
            reason: denominator.isZero()
              ? ("zero_prior" as const)
              : ("negative_prior" as const),
          }
        : {
            status: "available" as const,
            value: percentage.isZero() ? "0" : percentage.toFixed(),
          },
    ),
  });
}

/** Uses a structurally validated bounded packet; no source request or older-filing fallback. */
export function comparePersonalSecAnnualEvidence(
  input: PersonalSecAnnualResolutionInput,
  concept: PersonalSecAnnualPairDto["concept"],
): PersonalSecAnnualComparison {
  const unavailable = (
    reason: Extract<
      PersonalSecAnnualComparison,
      { status: "unavailable" }
    >["reason"],
  ): PersonalSecAnnualComparison =>
    Object.freeze({ status: "unavailable", reason });
  const resolution = resolvePersonalSecAnnualEvidence(input);
  const current = resolution.bases
    .find((basis) => basis.concept === concept)
    ?.pairs.find((pair) => pair.status === "eligible");
  const { target, generation, observations } = input;
  if (
    target.status !== "target" ||
    current === undefined ||
    current.startDate === null ||
    current.revenue === null ||
    current.netIncome === null
  )
    return unavailable("current_report_unavailable");
  if (!resolution.currentTargetEligible)
    return unavailable("current_use_unavailable");
  const priorEnd = new Date(
    Date.parse(`${current.startDate}T00:00:00Z`) - 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  const annual = (row: PersonalSecQuarterlyObservationDto) =>
    row.endDate === priorEnd &&
    row.durationDays !== null &&
    row.durationDays >= 335 &&
    row.durationDays <= 395;
  const revenue = observations.filter(
    (row) => row.metric === "revenue" && row.concept === concept && annual(row),
  );
  const income = observations.filter(
    (row) =>
      row.metric === "net_income" &&
      row.concept === "NetIncomeLoss" &&
      annual(row),
  );
  if (revenue.length === 0 || income.length === 0)
    return unavailable("previous_period_missing");
  const priorRows = [...revenue, ...income];
  const starts = new Set(priorRows.map((row) => row.startDate));
  if (starts.size !== 1) return unavailable("previous_period_ambiguous");
  const capture = [
    generation.sources.companyFacts.fetchedAt!,
    generation.sources.submissions.fetchedAt!,
  ]
    .sort()
    .at(-1)!;
  if (
    priorRows.some(
      (row) =>
        row.unit !== "USD" ||
        getPersonalSecAnnualRowReason(
          row,
          generation.cutoffAt,
          capture,
          target.reportDate,
        ) !== null,
    )
  )
    return unavailable("previous_period_invalid");
  const currentIds = [
    ...current.revenueObservationIds,
    ...current.incomeObservationIds,
  ];
  const operands = [
    ...observations.filter((row) => currentIds.includes(row.id)),
    ...priorRows,
  ];
  if (
    operands.some(
      (row) =>
        row.accessionNumber !== target.accessionNumber ||
        row.form !== target.form ||
        row.filedDate !== target.filedDate ||
        row.filing.form !== target.form ||
        row.filing.filedDate !== target.filedDate ||
        row.filing.reportDate !== target.reportDate ||
        row.filing.acceptedAt !== target.acceptedAt,
    )
  )
    return unavailable("filing_metadata_mismatch");
  if (
    new Set(revenue.map((row) => row.value)).size !== 1 ||
    new Set(income.map((row) => row.value)).size !== 1
  )
    return unavailable("previous_values_conflicted");
  return Object.freeze({
    status: "available",
    concept,
    accessionNumber: target.accessionNumber,
    priorStartDate: revenue[0]!.startDate!,
    priorEndDate: priorEnd,
    currentStartDate: current.startDate,
    currentEndDate: current.endDate,
    revenue: change(revenue[0]!.value, current.revenue),
    netIncome: change(income[0]!.value, current.netIncome),
    netMargin: marginComparison(
      revenue[0]!.value,
      income[0]!.value,
      current.revenue,
      current.netIncome,
    ),
    observationIds: Object.freeze(operands.map((row) => row.id)),
  });
}
