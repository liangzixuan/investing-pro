import type { PersonalQuarterlyFinancialsDto } from "@research-cockpit/contracts";
import {
  assessPersonalQuarterlyCompatibility,
  type PersonalQuarterlyCompatibilityResult,
} from "@research-cockpit/personal-financial-analytics";

import type { PersonalMarketSelection } from "../features/research/PersonalMarketOverview";

/** Adapt the validated response without inventing its missing fact evidence. */
export function assessLoadedPersonalQuarterlyFinancials(
  financials: PersonalQuarterlyFinancialsDto,
  selection: PersonalMarketSelection,
): PersonalQuarterlyCompatibilityResult {
  const identityKeys = [
    "country",
    "exchangeMic",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
  ] as const;
  if (identityKeys.some((key) => financials.security[key] !== selection[key])) {
    return {
      status: "quarantined",
      reason: "selection_identity_mismatch",
      ttm: { status: "unavailable", reason: "source_not_admitted" },
    };
  }

  return assessPersonalQuarterlyCompatibility({
    security: { issuerId: selection.issuerId, listingId: selection.listingId },
    anchor: {
      fiscalYear: financials.coverage.latestFiscalYear,
      fiscalQuarter: financials.coverage.latestFiscalQuarter,
    },
    quarters: financials.quarters.map((quarter) => ({
      fiscalYear: quarter.fiscalYear,
      fiscalQuarter: quarter.fiscalQuarter,
      statementDate: quarter.statementDate,
      reported: {
        revenue: {
          value: quarter.reported.revenue.value,
          evidence: null,
        },
        net_income: {
          value: quarter.reported.net_income.value,
          evidence: null,
        },
      },
    })),
  });
}
