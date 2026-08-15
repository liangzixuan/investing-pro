import type { AuthorizedPurpose, RightsPolicy } from "./model";

export function isPurposeAllowed(
  policy: RightsPolicy,
  purpose: AuthorizedPurpose,
): boolean {
  return policy.allowedPurposes.includes(purpose);
}

export function getPolicy(policies: RightsPolicy[], id: string): RightsPolicy {
  const policy = policies.find((candidate) => candidate.id === id);
  if (!policy) {
    throw new Error(`Unknown rights policy: ${id}`);
  }
  return policy;
}
