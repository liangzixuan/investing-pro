export function buildIdentity(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^[a-f0-9]{40}$/u.test(value)) {
    throw new Error("INVESTMENT_BUILD_SHA must be a full lowercase Git SHA.");
  }
  return value;
}
