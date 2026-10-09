import type { PersonalSecAnnualChange } from "@research-cockpit/personal-financial-analytics";

export function annualComparisonPercentText(
  change: PersonalSecAnnualChange,
): string {
  if (change.percent.status === "unavailable")
    return change.percent.reason === "zero_prior"
      ? "Unavailable: prior value is zero"
      : "Unavailable: prior value is negative";
  if (change.percent.value === "0" && change.difference !== "0")
    return `Less than 0.01% ${change.difference.startsWith("-") ? "lower" : "higher"}`;
  return `${change.percent.value}%`;
}
