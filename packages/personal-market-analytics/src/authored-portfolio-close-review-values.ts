import Decimal from "decimal.js";

import type {
  AuthoredPortfolioCloseReviewHolding,
  AuthoredPortfolioCloseReviewInput,
  AuthoredPortfolioCloseReviewLine,
} from "./authored-portfolio-close-review";

const CalculationDecimal = Decimal.clone({
  defaults: true,
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
});

type UnavailableReason = Exclude<
  AuthoredPortfolioCloseReviewLine["reason"],
  null
>;

export function calculateHoldingCloseValues(
  input: AuthoredPortfolioCloseReviewInput,
): readonly AuthoredPortfolioCloseReviewLine[] {
  const prices = new Map(
    input.prices
      .filter((price) => price.date === input.asOfDate)
      .map((price) => [price.listingId, price.close]),
  );
  const holdings = input.holdings.map((holding) =>
    holdingCloseValue(input, holding, prices.get(holding.listingId)),
  );
  return Object.freeze(holdings);
}

function holdingCloseValue(
  input: AuthoredPortfolioCloseReviewInput,
  holding: AuthoredPortfolioCloseReviewHolding,
  close: string | undefined,
): AuthoredPortfolioCloseReviewLine {
  if (input.asOfDate < input.balancesOn) {
    return unavailableHolding(holding, "balance_after_close");
  }
  if (input.asOfDate < holding.confirmedOn) {
    return unavailableHolding(holding, "balance_after_close");
  }
  if (close === undefined)
    return unavailableHolding(holding, "close_not_loaded");
  return Object.freeze({
    ...copyHolding(holding),
    status: "priced",
    reason: null,
    close,
    valueUsd: new CalculationDecimal(holding.shares)
      .times(close)
      .toFixed(2, Decimal.ROUND_HALF_UP),
  });
}

function unavailableHolding(
  holding: AuthoredPortfolioCloseReviewHolding,
  reason: UnavailableReason,
): AuthoredPortfolioCloseReviewLine {
  return Object.freeze({
    ...copyHolding(holding),
    status: "unavailable",
    reason,
    close: null,
    valueUsd: null,
  });
}

function copyHolding(holding: AuthoredPortfolioCloseReviewHolding) {
  return {
    listingId: holding.listingId,
    shares: holding.shares,
    confirmedOn: holding.confirmedOn,
  };
}

export function summarizeHoldingCloseValues(
  input: AuthoredPortfolioCloseReviewInput,
  holdings: readonly AuthoredPortfolioCloseReviewLine[],
) {
  const priced = holdings.filter((holding) => holding.status === "priced");
  const subtotal = priced.reduce(
    (sum, holding) => sum.plus(holding.valueUsd),
    new CalculationDecimal(0),
  );
  const complete =
    input.asOfDate >= input.balancesOn && priced.length === holdings.length;
  const cashUsd =
    input.cashUsd === null
      ? null
      : new CalculationDecimal(input.cashUsd).toFixed(2);
  return {
    pricedHoldings: priced.length,
    totalHoldings: holdings.length,
    pricedHoldingsSubtotalUsd: subtotal.toFixed(2),
    holdingsValueUsd: complete ? subtotal.toFixed(2) : null,
    cashUsd,
    totalValueUsd: completeTotalValue(complete, cashUsd, subtotal),
  };
}

function completeTotalValue(
  complete: boolean,
  cashUsd: string | null,
  subtotal: Decimal,
): string | null {
  if (!complete) return null;
  if (cashUsd === null) return null;
  return subtotal.plus(cashUsd).toFixed(2);
}
