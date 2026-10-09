import type {
  PersonalSecAnnualChange,
  PersonalSecAnnualMarginComparison,
} from "@research-cockpit/personal-financial-analytics";

export function annualMarginChangeText(
  margin: PersonalSecAnnualMarginComparison,
): string {
  if (margin.status === "unavailable")
    return margin.reason === "zero_prior_revenue"
      ? "Unavailable: prior revenue is zero"
      : "Unavailable: prior revenue is negative";
  if (margin.difference === "0" && margin.direction !== "unchanged")
    return `Less than 0.01 percentage points ${margin.direction}`;
  return `${margin.difference} percentage points`;
}

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
