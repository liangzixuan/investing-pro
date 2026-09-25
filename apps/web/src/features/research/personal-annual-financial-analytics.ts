import type { PersonalAnnualFinancialsDto } from "@research-cockpit/contracts";
import {
  buildPersonalFinancialAnalytics,
  PERSONAL_FINANCIAL_REPORTED_FIELDS,
  type PersonalFinancialAnalyticsResult,
} from "@research-cockpit/personal-financial-analytics";

/** The same reported facts and source references feed every annual view. */
export function buildPersonalAnnualFinancialAnalytics(
  financials: PersonalAnnualFinancialsDto,
): PersonalFinancialAnalyticsResult {
  return buildPersonalFinancialAnalytics({
    asOf: financials.asOf,
    periods: financials.years.map((year) => ({
      facts: PERSONAL_FINANCIAL_REPORTED_FIELDS.flatMap((field) => {
        if (field.analyticsInput === null) return [];
        const cell = year.reported[field.fieldKey];
        return cell.status === "known"
          ? [
              {
                key: field.analyticsInput,
                sourceRef: `${String(year.fiscalYear)}:${field.fieldKey}`,
                unit: "USD" as const,
                value: cell.value,
              },
            ]
          : [];
      }),
      fiscalYear: year.fiscalYear,
      statementDate: year.statementDate,
    })),
  });
}

/** Group the exact decimal string without rounding or converting to Number. */
export function formatPersonalFinancialUsd(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${negative ? "−" : ""}$${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
}
