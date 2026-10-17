export const MANAGED_PORTFOLIO_STORAGE_ENVIRONMENT_KEY =
  "MANAGED_PORTFOLIO_STORAGE_ENABLED" as const;

/** Only an explicit server setting enables the fixed Portfolio resource. */
export function managedPortfolioStorageEnabled(value: unknown): boolean {
  return value === "true";
}
