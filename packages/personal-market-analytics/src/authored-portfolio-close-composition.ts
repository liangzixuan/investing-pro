import Decimal from "decimal.js";

import type {
  AuthoredPortfolioCloseReviewInput,
  AuthoredPortfolioCloseReviewLine,
} from "./authored-portfolio-close-review";

export const AUTHORED_PORTFOLIO_CLOSE_COMPOSITION_METHOD =
  "displayed_usd_cents_over_complete_total_percent_half_up_2dp";

export type AuthoredPortfolioCloseCompositionUnavailableReason =
  | "balances_after_close"
  | "incomplete_holdings"
  | "unknown_cash"
  | "zero_total";

export interface AuthoredPortfolioCloseCompositionHolding {
  readonly listingId: string;
  readonly valueUsd: string | null;
  readonly percent: string | null;
}

export interface AuthoredPortfolioCloseComposition {
  readonly status: "available" | "unavailable";
  readonly reason: AuthoredPortfolioCloseCompositionUnavailableReason | null;
  readonly totalValueUsd: string | null;
  readonly cashUsd: string | null;
  readonly cashPercent: string | null;
  readonly holdings: readonly AuthoredPortfolioCloseCompositionHolding[];
  readonly method: typeof AUTHORED_PORTFOLIO_CLOSE_COMPOSITION_METHOD;
}

const CompositionDecimal = Decimal.clone({
  defaults: true,
  precision: 256,
  rounding: Decimal.ROUND_HALF_UP,
});

/** Called only after close-review validation and displayed-cent valuation. */
export function calculateAuthoredPortfolioCloseComposition(
  input: AuthoredPortfolioCloseReviewInput,
  holdings: readonly AuthoredPortfolioCloseReviewLine[],
  summary: Readonly<{ cashUsd: string | null; totalValueUsd: string | null }>,
): AuthoredPortfolioCloseComposition {
  const reason = unavailableReason(input, holdings, summary.totalValueUsd);
  const denominator = reason === null ? summary.totalValueUsd : null;
  return Object.freeze({
    status: reason === null ? "available" : "unavailable",
    reason,
    totalValueUsd: summary.totalValueUsd,
    cashUsd: summary.cashUsd,
    cashPercent: percentage(summary.cashUsd, denominator),
    holdings: Object.freeze(
      holdings.map(({ listingId, valueUsd }) =>
        Object.freeze({
          listingId,
          valueUsd,
          percent: percentage(valueUsd, denominator),
        }),
      ),
    ),
    method: AUTHORED_PORTFOLIO_CLOSE_COMPOSITION_METHOD,
  });
}

function unavailableReason(
  input: AuthoredPortfolioCloseReviewInput,
  holdings: readonly AuthoredPortfolioCloseReviewLine[],
  totalValueUsd: string | null,
): AuthoredPortfolioCloseCompositionUnavailableReason | null {
  if (input.balancesOn > input.asOfDate) return "balances_after_close";
  if (holdings.some((holding) => holding.reason === "balance_after_close"))
    return "balances_after_close";
  if (holdings.some((holding) => holding.valueUsd === null))
    return "incomplete_holdings";
  if (input.cashUsd === null) return "unknown_cash";
  if (totalValueUsd === "0.00") return "zero_total";
  return null;
}

function percentage(valueUsd: string | null, totalValueUsd: string | null) {
  if (valueUsd === null || totalValueUsd === null) return null;
  return new CompositionDecimal(valueUsd)
    .dividedBy(totalValueUsd)
    .times(100)
    .toFixed(2, Decimal.ROUND_HALF_UP);
}
