import Decimal from "decimal.js";

const D = Decimal.clone({
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -256,
  toExpPos: 256,
});
const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;

export type PersonalNumericScreenCell =
  | Readonly<{ status: "available"; value: string }>
  | Readonly<{ status: "unavailable" }>;

export interface PersonalNumericScreenClause<Field extends string> {
  readonly field: Field;
  readonly operator: "gte" | "lte";
  readonly value: string;
}

export interface PersonalNumericScreenSort<Field extends string> {
  readonly field: "symbol" | Field;
  readonly direction: "asc" | "desc";
}

export interface PersonalNumericScreenRow<Field extends string> {
  readonly identity: Readonly<{ symbol: string; listingId: string }>;
  readonly metrics: Readonly<Record<Field, PersonalNumericScreenCell>>;
}

/** Shared threshold grammar; source-value admission remains with each resolver. */
export function isPersonalNumericScreenDecimal(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    DECIMAL.test(value) &&
    new D(value).isFinite()
  );
}

/** Evaluate admitted cells: a false clause takes precedence over unknown cells. */
export function evaluatePersonalNumericScreenClauses<Field extends string>(
  metrics: Readonly<Record<Field, PersonalNumericScreenCell>>,
  clauses: readonly PersonalNumericScreenClause<Field>[],
): "true" | "false" | "unknown" {
  let unknown = false;
  for (const clause of clauses) {
    const metric = metrics[clause.field];
    if (metric.status === "unavailable") {
      unknown = true;
      continue;
    }
    const value = new D(metric.value);
    if (
      clause.operator === "gte"
        ? value.lt(clause.value)
        : value.gt(clause.value)
    )
      return "false";
  }
  return unknown ? "unknown" : "true";
}

/** Unknowns sort last in both directions; equal values use ascending identity ties. */
export function comparePersonalNumericScreenRows<Field extends string>(
  left: PersonalNumericScreenRow<Field>,
  right: PersonalNumericScreenRow<Field>,
  sort: PersonalNumericScreenSort<Field>,
): number {
  const direction = sort.direction === "asc" ? 1 : -1;
  let comparison = 0;
  if (sort.field === "symbol")
    comparison =
      compareText(left.identity.symbol, right.identity.symbol) * direction;
  else {
    const leftCell = left.metrics[sort.field];
    const rightCell = right.metrics[sort.field];
    if (leftCell.status !== rightCell.status)
      return leftCell.status === "available" ? -1 : 1;
    if (leftCell.status === "available" && rightCell.status === "available")
      comparison = new D(leftCell.value).cmp(rightCell.value) * direction;
  }
  return (
    comparison ||
    compareText(left.identity.symbol, right.identity.symbol) ||
    compareText(left.identity.listingId, right.identity.listingId)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
