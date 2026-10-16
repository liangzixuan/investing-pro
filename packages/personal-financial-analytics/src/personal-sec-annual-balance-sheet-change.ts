import type { PersonalSecAnnualBalanceSheetValueDto } from "@research-cockpit/contracts";
import Decimal from "decimal.js";
import type {
  PersonalSecAnnualBalanceSheetHistory,
  PersonalSecAnnualBalanceSheetHistoryReason,
} from "./personal-sec-annual-balance-sheet";

type Amount = PersonalSecAnnualBalanceSheetValueDto;
type AvailableAmount = Extract<Amount, { status: "available" }>;
const D = Decimal.clone({ defaults: true, precision: 256 });

export type PersonalSecAnnualBalanceSheetMetricChange =
  | Readonly<{
      status: "available";
      unit: "USD";
      difference: string;
      current: AvailableAmount;
      prior: AvailableAmount;
      observationIds: readonly `sec-fact:${string}`[];
    }>
  | Readonly<{
      status: "unavailable";
      unit: "USD";
      current: Amount;
      prior: Amount | null;
    }>;

export type PersonalSecAnnualBalanceSheetChange =
  | Readonly<{
      status: "unavailable";
      reason: PersonalSecAnnualBalanceSheetHistoryReason;
    }>
  | Readonly<{
      status: "available";
      accessionNumber: string;
      currentDate: string;
      priorDate: string | null;
      totalAssets: PersonalSecAnnualBalanceSheetMetricChange;
      totalLiabilities: PersonalSecAnnualBalanceSheetMetricChange;
      shareholdersEquity: PersonalSecAnnualBalanceSheetMetricChange;
    }>;

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function copyAmount(value: Amount): Amount {
  const observationIds = [...value.observationIds];
  return value.status === "available"
    ? {
        status: "available",
        unit: "USD",
        value: value.value,
        asOfDate: value.asOfDate,
        accessionNumber: value.accessionNumber,
        observationIds,
        currentUseEligible: value.currentUseEligible,
      }
    : {
        status: "unavailable",
        unit: "USD",
        reason: value.reason,
        observationIds,
      };
}

/**
 * Compare the first two shared dates from the existing history resolver.
 * This is derived-model input, not a raw-packet validator. Source admission and
 * original-load eligibility remain with resolvePersonalSecAnnualBalanceSheetHistory.
 */
export function comparePersonalSecAnnualBalanceSheetHistory(
  history: PersonalSecAnnualBalanceSheetHistory,
): PersonalSecAnnualBalanceSheetChange {
  if (history.status === "unavailable")
    return freeze({ status: "unavailable", reason: history.reason });
  const [current, prior] = history.balances;
  if (current === undefined || (prior && prior.asOfDate >= current.asOfDate))
    throw new TypeError("Invalid resolved balance-sheet history.");

  const change = (
    key: "totalAssets" | "totalLiabilities" | "shareholdersEquity",
  ): PersonalSecAnnualBalanceSheetMetricChange => {
    const currentAmount = copyAmount(current[key]);
    const priorAmount = prior ? copyAmount(prior[key]) : null;
    if (
      currentAmount.status === "unavailable" ||
      priorAmount === null ||
      priorAmount.status === "unavailable"
    )
      return {
        status: "unavailable",
        unit: "USD",
        current: currentAmount,
        prior: priorAmount,
      };
    if (
      currentAmount.accessionNumber !== history.accessionNumber ||
      priorAmount.accessionNumber !== history.accessionNumber ||
      currentAmount.asOfDate !== current.asOfDate ||
      priorAmount.asOfDate !== prior?.asOfDate
    )
      throw new TypeError("Invalid resolved balance-sheet history.");
    const calculated = new D(currentAmount.value).minus(priorAmount.value);
    const difference = calculated.isZero() ? "0" : calculated.toFixed();
    if (!calculated.isFinite() || difference.length > 128)
      throw new TypeError("Invalid balance-sheet difference.");
    return {
      status: "available",
      unit: "USD",
      difference,
      current: currentAmount,
      prior: priorAmount,
      observationIds: [
        ...currentAmount.observationIds,
        ...priorAmount.observationIds,
      ],
    };
  };

  return freeze({
    status: "available",
    accessionNumber: history.accessionNumber,
    currentDate: current.asOfDate,
    priorDate: prior?.asOfDate ?? null,
    totalAssets: change("totalAssets"),
    totalLiabilities: change("totalLiabilities"),
    shareholdersEquity: change("shareholdersEquity"),
  });
}
