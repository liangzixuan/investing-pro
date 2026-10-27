import {
  calculateAuthoredPortfolioCloseComposition,
  type AuthoredPortfolioCloseComposition,
} from "./authored-portfolio-close-composition";
import { validateCloseReviewInput } from "./authored-portfolio-close-review-validation";
import {
  calculateHoldingCloseValues,
  summarizeHoldingCloseValues,
} from "./authored-portfolio-close-review-values";

export interface AuthoredPortfolioCloseReviewHolding {
  readonly listingId: string;
  readonly shares: string;
  readonly confirmedOn: string;
}

export interface AuthoredPortfolioCloseReviewPrice {
  readonly listingId: string;
  readonly date: string;
  readonly close: string;
}

export interface AuthoredPortfolioCloseReviewInput {
  readonly holdings: readonly AuthoredPortfolioCloseReviewHolding[];
  readonly cashUsd: string | null;
  readonly balancesOn: string;
  readonly asOfDate: string;
  readonly prices: readonly AuthoredPortfolioCloseReviewPrice[];
}

export type AuthoredPortfolioCloseReviewLine =
  AuthoredPortfolioCloseReviewHolding &
    (
      | Readonly<{
          status: "priced";
          reason: null;
          close: string;
          valueUsd: string;
        }>
      | Readonly<{
          status: "unavailable";
          reason: "balance_after_close" | "close_not_loaded";
          close: null;
          valueUsd: null;
        }>
    );

export interface AuthoredPortfolioCloseReviewResult {
  readonly composition: AuthoredPortfolioCloseComposition;
  readonly asOfDate: string;
  readonly balancesOn: string;
  readonly holdings: readonly AuthoredPortfolioCloseReviewLine[];
  readonly pricedHoldings: number;
  readonly totalHoldings: number;
  readonly pricedHoldingsSubtotalUsd: string;
  readonly holdingsValueUsd: string | null;
  readonly cashUsd: string | null;
  readonly totalValueUsd: string | null;
  readonly method: "each_holding_round_half_up_to_cents_then_sum";
}

/** Values current authored balances using one exact close date. */
export function calculateAuthoredPortfolioCloseReview(
  input: AuthoredPortfolioCloseReviewInput,
): AuthoredPortfolioCloseReviewResult {
  try {
    validateCloseReviewInput(input);
    const holdings = calculateHoldingCloseValues(input);
    const summary = summarizeHoldingCloseValues(input, holdings);
    return Object.freeze({
      asOfDate: input.asOfDate,
      balancesOn: input.balancesOn,
      holdings,
      ...summary,
      composition: calculateAuthoredPortfolioCloseComposition(
        input,
        holdings,
        summary,
      ),
      method: "each_holding_round_half_up_to_cents_then_sum",
    });
  } catch {
    throw new TypeError("Portfolio close review input is invalid.");
  }
}
