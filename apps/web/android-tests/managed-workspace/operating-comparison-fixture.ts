import {
  annualComparisonOperatingRows,
  annualComparisonResponse,
  annualComparisonRows,
} from "../../src/clerk-trial/annual-comparison-fixture";

export const operatingComparisonPrefix = "Café 東京📈";
export const operatingComparisonNoteDraft = [
  `${operatingComparisonPrefix} Observed Annual operating comparison; exact, unscaled USD.`,
  "ZERO (Zero Company; Zero Class A; Class A; XNAS, US): 10-K 2025-01-01 to 2025-12-31; reported OperatingIncomeLoss USD -250.125; RevenueFromContractWithCustomerExcludingAssessedTax revenue USD 500; operating margin -50.03%.",
  "CIK 0000000001; filed 2026-02-01; accession 0000000001-26-000001; filing https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm.",
  "Original cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current use eligible at original load. Retained previous report.",
  "ONE (One Company; One Class A; Class A; XNAS, US): 10-K 2024-07-01 to 2025-06-30; reported OperatingIncomeLoss USD 125.25; SalesRevenueNet revenue USD 750; operating margin 16.7%.",
  "CIK 0000000002; filed 2025-08-01; accession 0000000002-25-000001; filing https://www.sec.gov/Archives/edgar/data/2/0000000002-25-000001-index.htm.",
  "Original cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current use eligible at original load.",
  "App calculation: operating margin = operating income / positive revenue * 100, rounded to two decimal places, half up; each company's inputs use the same filing and exact period.",
  "Company periods may differ; no cross-company calculation or ranking. Evidence dates are unchanged; this action does not refresh sources.",
].join(" ");

/** Two invented fiscal calendars; neither packet contains net-income observations. */
export function operatingComparisonPacket(
  side: "left" | "right",
  late = false,
) {
  const revenues = annualComparisonRows(side).filter(
    (row) => row.metric === "revenue",
  );
  return annualComparisonResponse(side, {
    rows:
      side === "left"
        ? [
            ...revenues,
            ...revenues.map((row) => ({
              ...row,
              concept:
                "RevenueFromContractWithCustomerExcludingAssessedTax" as const,
              value: row.endDate === "2025-12-31" ? "500" : "250",
            })),
          ]
        : revenues,
    operatingRows: annualComparisonOperatingRows(side).map((row) =>
      late ? { ...row, value: "999.875" } : row,
    ),
    ...(late ? { cutoffAt: "2026-09-21T00:00:00.000Z" } : {}),
  });
}
