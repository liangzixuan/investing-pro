import type { ManagedValuationPriceContext } from "./managed-valuation-price";

/** Refer to the captured source and model graphs instead of copying them again. */
export function valuationPriceDocument(
  context: ManagedValuationPriceContext | null,
) {
  if (!context) return null;
  return {
    methodology: {
      formula:
        "100 * (displayed authored model value per share / dated raw close - 1)",
      engine: "calculateAuthoredPriceComparison",
      precision: 256,
      percentDecimalPlaces: 2,
      rounding: "round_half_up",
      shareBasis:
        "Authored diluted shares; equivalence with the dated raw price share basis is not verified.",
      scope:
        "Dated scenario context, not a current quote, adjusted return, price target or recommendation.",
      modelPath: "valuation",
    },
    reference: context.reference
      ? {
          date: context.reference.date,
          rawCloseUsd: context.reference.rawCloseUsd,
          showingPrevious: context.reference.showingPrevious,
          sourcePath: "sources.price.response",
        }
      : null,
    reason: context.reason,
    rows: context.rows,
  };
}
