import type { PersonalAnnualFinancialsDto } from "@research-cockpit/contracts";
import { PERSONAL_FINANCIAL_QUALITY_SCORECARD_FACT_KEYS } from "@research-cockpit/personal-financial-analytics";

export function mapAnnualFinancials(financials: PersonalAnnualFinancialsDto) {
  return {
    asOf: financials.asOf,
    periods: financials.years.map((year) => ({
      facts: PERSONAL_FINANCIAL_QUALITY_SCORECARD_FACT_KEYS.flatMap((key) => {
        const cell = year.reported[key];
        return cell.status === "known"
          ? [
              {
                key,
                sourceRef: `${String(year.fiscalYear)}:${key}`,
                unit: "USD" as const,
                value: cell.value,
              },
            ]
          : [];
      }),
      fiscalYear: year.fiscalYear,
      statementDate: year.statementDate,
    })),
  };
}
