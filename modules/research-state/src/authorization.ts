import type {
  AuthorizationDecision,
  OrganizationMembership,
  ResearchAction,
  SyntheticActorContext,
} from "./model";

const rolePermissions: Record<
  OrganizationMembership["role"],
  ReadonlySet<ResearchAction>
> = {
  owner: new Set([
    "thesis:read",
    "thesis:write",
    "thesis:delete",
    "alert:read",
    "alert:write",
    "alert:delete",
    "research:export",
  ]),
  researcher: new Set([
    "thesis:read",
    "thesis:write",
    "thesis:delete",
    "alert:read",
    "alert:write",
    "alert:delete",
    "research:export",
  ]),
  viewer: new Set(["thesis:read", "alert:read"]),
};

export function authorize(
  actor: SyntheticActorContext,
  membership: OrganizationMembership | null,
  action: ResearchAction,
  now: string,
): AuthorizationDecision {
  if (
    membership &&
    (membership.organizationId !== actor.organizationId ||
      membership.principalId !== actor.principalId)
  ) {
    return { allowed: false, reason: "TENANT_MISMATCH", role: null };
  }
  if (!membership || !isMembershipActive(membership, now)) {
    return { allowed: false, reason: "NO_ACTIVE_MEMBERSHIP", role: null };
  }
  const permissions = rolePermissions[membership.role];
  if (!permissions?.has(action)) {
    return { allowed: false, reason: "ROLE_DENIED", role: membership.role };
  }
  return { allowed: true, reason: "ALLOW", role: membership.role };
}

function isMembershipActive(
  membership: OrganizationMembership,
  now: string,
): boolean {
  const instant = Date.parse(now);
  if (Number.isNaN(instant)) return false;
  return (
    Date.parse(membership.activeFrom) <= instant &&
    (membership.activeTo === null || instant < Date.parse(membership.activeTo))
  );
}
