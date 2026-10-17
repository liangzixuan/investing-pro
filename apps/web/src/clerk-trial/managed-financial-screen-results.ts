import type {
  PersonalSecAnnualCanonicalResponseDto,
  PersonalSecAnnualLiquidityValueDto,
} from "@research-cockpit/contracts";
import {
  comparePersonalNumericScreenRows,
  evaluatePersonalNumericScreenClauses,
  isPersonalNumericScreenDecimal,
  type PersonalNumericScreenCell,
  type PersonalSecAnnualFinancialReviewRow,
} from "@research-cockpit/personal-financial-analytics";
import { isOwnedSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";
import { getManagedAnnualView } from "./managed-annual-view";

export const MANAGED_FINANCIAL_SCREEN_FIELDS = Object.freeze([
  Object.freeze({
    key: "operatingIncome",
    label: "Reported operating income",
    unit: "USD",
  }),
  Object.freeze({
    key: "operatingCashFlow",
    label: "Reported operating cash flow",
    unit: "USD",
  }),
  Object.freeze({
    key: "operatingCashFlowLessPpePurchases",
    label: "Operating cash flow less PP&E purchases",
    unit: "USD",
  }),
  Object.freeze({
    key: "workingCapital",
    label: "Working capital",
    unit: "USD",
  }),
  Object.freeze({
    key: "shareholdersEquity",
    label: "Reported parent equity",
    unit: "USD",
  }),
  Object.freeze({
    key: "currentRatio",
    label: "Current assets / current liabilities",
    unit: "multiple",
  }),
] as const);
export type ManagedFinancialScreenField =
  (typeof MANAGED_FINANCIAL_SCREEN_FIELDS)[number]["key"];

export interface ManagedFinancialScreenCriteria {
  readonly clauses: readonly Readonly<{
    field: ManagedFinancialScreenField;
    operator: "gte" | "lte";
    value: string;
  }>[];
  readonly sort: Readonly<{
    field: "symbol" | ManagedFinancialScreenField;
    direction: "asc" | "desc";
  }>;
}

export const DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA: ManagedFinancialScreenCriteria =
  Object.freeze({
    clauses: Object.freeze([]),
    sort: Object.freeze({ field: "symbol", direction: "asc" }),
  });

export type ManagedFinancialScreenMetric =
  | (PersonalSecAnnualFinancialReviewRow["value"] & Readonly<{ unit: "USD" }>)
  | PersonalSecAnnualLiquidityValueDto<"multiple">;

export interface ManagedFinancialScreenRow {
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly match: "match" | "nonmatch" | "unknown";
  readonly metrics: Readonly<
    Record<ManagedFinancialScreenField, ManagedFinancialScreenMetric>
  >;
}

const ownedRows = new WeakSet<object>();

/** Own only closed criteria; preserve the author's exact bounded decimal strings. */
export function validateManagedFinancialScreenCriteria(
  input: unknown,
): ManagedFinancialScreenCriteria | null {
  try {
    if (!record(input, ["clauses", "sort"]) || !validSort(input.sort))
      return null;
    const items = dataArray(input.clauses, 7);
    if (items === null) return null;
    const clauses: ManagedFinancialScreenCriteria["clauses"][number][] = [];
    for (const item of items) {
      if (
        !record(item, ["field", "operator", "value"]) ||
        !field(item.field) ||
        (item.operator !== "gte" && item.operator !== "lte") ||
        !isPersonalNumericScreenDecimal(item.value)
      )
        return null;
      clauses.push(
        Object.freeze({
          field: item.field,
          operator: item.operator,
          value: item.value,
        }),
      );
    }
    return Object.freeze({
      clauses: Object.freeze(clauses),
      sort: Object.freeze({
        field: input.sort.field,
        direction: input.sort.direction,
      }),
    });
  } catch {
    return null;
  }
}

/** Original-load eligibility gates screening; historical amounts remain inspectable. */
export function evaluateManagedFinancialScreenRow(
  response: unknown,
  criteria: ManagedFinancialScreenCriteria,
): ManagedFinancialScreenRow | null {
  if (!isOwnedSecAnnualCanonicalResponse(response)) return null;
  const checked = validateManagedFinancialScreenCriteria(criteria);
  if (!checked) return null;
  try {
    const view = getManagedAnnualView(response);
    if (!view) return null;
    const review = (key: PersonalSecAnnualFinancialReviewRow["key"]) => {
      const row = view.financialReview.find((item) => item.key === key);
      if (!row) throw new TypeError();
      return Object.freeze({ ...row.value, unit: "USD" as const });
    };
    const metrics = Object.freeze({
      operatingIncome: review("operatingIncome"),
      operatingCashFlow: review("operatingCashFlow"),
      operatingCashFlowLessPpePurchases: review(
        "operatingCashFlowLessPpePurchases",
      ),
      workingCapital: review("workingCapital"),
      shareholdersEquity: review("shareholdersEquity"),
      currentRatio: view.liquidity.resolution.currentRatio,
    });
    const outcome = evaluatePersonalNumericScreenClauses(
      screenMetrics(metrics),
      checked.clauses,
    );
    const row: ManagedFinancialScreenRow = Object.freeze({
      response,
      metrics,
      match:
        outcome === "true"
          ? "match"
          : outcome === "false"
            ? "nonmatch"
            : "unknown",
    });
    ownedRows.add(row);
    return row;
  } catch {
    return null;
  }
}

/** Compare only this module's immutable rows, with the existing numeric tie rules. */
export function compareManagedFinancialScreenRows(
  left: ManagedFinancialScreenRow,
  right: ManagedFinancialScreenRow,
  sort: ManagedFinancialScreenCriteria["sort"],
): number {
  if (!ownedRows.has(left) || !ownedRows.has(right) || !validSort(sort))
    throw new TypeError();
  const numericRow = (row: ManagedFinancialScreenRow) => ({
    identity: row.response.security,
    metrics: screenMetrics(row.metrics),
  });
  return comparePersonalNumericScreenRows(
    numericRow(left),
    numericRow(right),
    sort,
  );
}

function screenMetrics(metrics: ManagedFinancialScreenRow["metrics"]) {
  const cell = (
    value: ManagedFinancialScreenMetric,
  ): PersonalNumericScreenCell =>
    value.status === "available" && value.currentUseEligible
      ? value
      : { status: "unavailable" };
  return {
    operatingIncome: cell(metrics.operatingIncome),
    operatingCashFlow: cell(metrics.operatingCashFlow),
    operatingCashFlowLessPpePurchases: cell(
      metrics.operatingCashFlowLessPpePurchases,
    ),
    workingCapital: cell(metrics.workingCapital),
    shareholdersEquity: cell(metrics.shareholdersEquity),
    currentRatio: cell(metrics.currentRatio),
  };
}

function field(value: unknown): value is ManagedFinancialScreenField {
  return MANAGED_FINANCIAL_SCREEN_FIELDS.some((item) => item.key === value);
}
function validSort(
  value: unknown,
): value is ManagedFinancialScreenCriteria["sort"] {
  return (
    record(value, ["field", "direction"]) &&
    (value.field === "symbol" || field(value.field)) &&
    (value.direction === "asc" || value.direction === "desc")
  );
}
function record(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) ||
    Reflect.ownKeys(value).length !== keys.length
  )
    return false;
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      descriptor?.enumerable === true && Object.hasOwn(descriptor, "value")
    );
  });
}
function dataArray(value: unknown, maximum: number): readonly unknown[] | null {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length > maximum ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    return null;
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
      return null;
    result.push(descriptor.value);
  }
  return result;
}
