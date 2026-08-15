import type {
  AuthorizedChannel,
  AuthorizedPurpose,
  RightsPolicy,
} from "./model";

export interface RightsDecisionContext {
  purpose: AuthorizedPurpose;
  channel: AuthorizedChannel;
  territory: string;
  evaluatedAt: string;
}

export function isRightsAllowed(
  policy: RightsPolicy | null,
  context: RightsDecisionContext,
): boolean {
  if (!policy) return false;
  const evaluatedAt = Date.parse(context.evaluatedAt);
  if (Number.isNaN(evaluatedAt)) return false;
  const matchingGrants = policy.grants.filter(
    (grant) =>
      grant.purpose === context.purpose && grant.channel === context.channel,
  );
  if (matchingGrants.length !== 1 || matchingGrants[0]?.allowed !== true)
    return false;
  if (policy.territory !== context.territory) return false;
  if (policy.expiresAt === null) return true;

  const expiresAt = Date.parse(policy.expiresAt);
  return !Number.isNaN(expiresAt) && evaluatedAt < expiresAt;
}

export function getPolicy(
  policies: RightsPolicy[],
  id: string,
  version: string,
): RightsPolicy | null {
  const matches = policies.filter(
    (candidate) => candidate.id === id && candidate.version === version,
  );
  const [policy] = matches;
  return matches.length === 1 && policy ? policy : null;
}
