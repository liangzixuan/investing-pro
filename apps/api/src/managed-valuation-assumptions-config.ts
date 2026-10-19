export const MANAGED_VALUATION_ASSUMPTIONS_STORAGE_ENVIRONMENT_KEY =
  "MANAGED_VALUATION_ASSUMPTIONS_STORAGE_ENABLED" as const;

/** Only an explicit server setting enables the fixed Valuation assumptions resource. */
export function managedValuationAssumptionsStorageEnabled(
  value: unknown,
): boolean {
  return value === "true";
}
