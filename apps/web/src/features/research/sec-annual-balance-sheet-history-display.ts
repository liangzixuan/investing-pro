import type { PersonalSecAnnualBalanceSheetHistoryReason } from "@research-cockpit/personal-financial-analytics";
import { annualLiquidityUnavailableReasonText } from "./SecAnnualLiquidity";

export function balanceSheetHistoryReason(
  reason: PersonalSecAnnualBalanceSheetHistoryReason,
): string {
  if (reason === "current_use_unavailable")
    return "The selected report is outside the current-use limits at this load. Reported totals remain above.";
  if (reason === "no_report_date") return "No reported amount at this date.";
  if (reason === "report_end_mismatch")
    return "This metric contains a date after the selected report date, or its filing report date does not match the selected filing.";
  return annualLiquidityUnavailableReasonText(reason);
}
