import {
  isPersonalFilingMonitorAcknowledgeDto,
  isPersonalFilingMonitorCommandDto,
  isPersonalFilingMonitorConfigureDto,
  isPersonalFilingMonitorDto,
  type PersonalFilingMonitorAcknowledgeDto,
  type PersonalFilingMonitorCommandDto,
  type PersonalFilingMonitorConfigureDto,
  type PersonalFilingMonitorDto,
} from "@research-cockpit/contracts";
import {
  PersonalWorkspaceApiError,
  requestPersonalWorkspace,
  type PersonalWatchlistMembership,
} from "./personal-workspace-api";

export const PERSONAL_FILING_MONITOR_PATH =
  "/v1/personal-filing/workspace/filing-monitor";

export async function fetchPersonalFilingMonitor(
  signal: AbortSignal,
): Promise<PersonalFilingMonitorDto> {
  const response = await requestPersonalWorkspace(
    PERSONAL_FILING_MONITOR_PATH,
    { method: "GET", headers: { Accept: "application/json" }, signal },
  );
  return decodeResponse(response);
}
export async function configurePersonalFilingMonitor(
  request: PersonalFilingMonitorConfigureDto,
  signal: AbortSignal,
): Promise<PersonalFilingMonitorDto> {
  if (!isPersonalFilingMonitorConfigureDto(request)) throw invalidRequest();
  const submitted = structuredClone(request);
  const result = await mutate("", submitted, signal);
  if (
    !result.policy ||
    !Object.entries(submitted.policy).every(
      ([key, expected]) =>
        JSON.stringify(
          result.policy?.[key as keyof typeof submitted.policy],
        ) === JSON.stringify(expected),
    ) ||
    result.bindingStatus !== "current"
  )
    throw invalidResponse();
  return result;
}
export async function pausePersonalFilingMonitor(
  request: PersonalFilingMonitorCommandDto,
  signal: AbortSignal,
): Promise<PersonalFilingMonitorDto> {
  if (
    !isPersonalFilingMonitorCommandDto(request) ||
    request.expectedVersion === 0
  )
    throw invalidRequest();
  const result = await mutate("/pause", structuredClone(request), signal);
  if (
    result.policy?.enabled !== false ||
    result.running ||
    result.nextCheckAt !== null
  )
    throw invalidResponse();
  return result;
}
export async function resetPersonalFilingMonitor(
  request: PersonalFilingMonitorCommandDto,
  signal: AbortSignal,
): Promise<PersonalFilingMonitorDto> {
  if (
    !isPersonalFilingMonitorCommandDto(request) ||
    request.expectedVersion === 0
  )
    throw invalidRequest();
  const result = await mutate("/reset", structuredClone(request), signal);
  if (
    result.policy?.enabled !== false ||
    result.running ||
    result.nextCheckAt !== null ||
    result.inbox.length > 0 ||
    result.coverageGap ||
    result.issuers.some(
      (issuer) =>
        issuer.seeded || issuer.lastCompleteAt !== null || issuer.coverageGap,
    )
  )
    throw invalidResponse();
  return result;
}
export async function acknowledgePersonalFilingMonitor(
  request: PersonalFilingMonitorAcknowledgeDto,
  signal: AbortSignal,
): Promise<PersonalFilingMonitorDto> {
  if (!isPersonalFilingMonitorAcknowledgeDto(request)) throw invalidRequest();
  const submitted = structuredClone(request);
  const result = await mutate("/acknowledge", submitted, signal);
  // Acknowledged, settled entries may be retired by retention before this snapshot.
  if (
    result.inbox.some(
      (entry) => submitted.eventIds.includes(entry.id) && entry.readAt === null,
    )
  )
    throw invalidResponse();
  return result;
}

async function mutate(
  path: string,
  request: PersonalFilingMonitorCommandDto,
  signal: AbortSignal,
): Promise<PersonalFilingMonitorDto> {
  if (request.expectedVersion >= Number.MAX_SAFE_INTEGER)
    throw invalidRequest();
  let idempotency: string;
  try {
    idempotency = `filing-monitor-${globalThis.crypto.randomUUID()}`;
  } catch {
    throw new PersonalWorkspaceApiError("unavailable");
  }
  const response = await requestPersonalWorkspace(
    `${PERSONAL_FILING_MONITOR_PATH}${path}`,
    {
      method: "POST",
      signal,
      body: JSON.stringify(request),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(request.expectedVersion === 0
          ? { "If-None-Match": "*" }
          : { "If-Match": `"v${String(request.expectedVersion)}"` }),
        "X-Research-Cockpit-Idempotency-Key": idempotency,
        "X-Research-Cockpit-Intent":
          request.expectedVersion === 0
            ? "personal-vault-create"
            : "personal-vault-update",
      },
    },
  );
  const result = await decodeResponse(response);
  if (result.version <= request.expectedVersion) throw invalidResponse();
  return result;
}
async function decodeResponse(
  response: Response,
): Promise<PersonalFilingMonitorDto> {
  if (!response.ok)
    throw new PersonalWorkspaceApiError(
      response.status === 401 || response.status === 403
        ? "session_unavailable"
        : response.status === 409
          ? "conflict"
          : response.status === 400
            ? "invalid_request"
            : response.status === 429
              ? "rate_limited"
              : "unavailable",
    );
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw invalidResponse();
  }
  if (response.status !== 200 || !isPersonalFilingMonitorDto(value))
    throw invalidResponse();
  validateSnapshot(value);
  return value;
}

function validateSnapshot(value: PersonalFilingMonitorDto): void {
  if (value.policy === null) {
    if (
      value.running ||
      value.nextCheckAt !== null ||
      value.lastCheckAt !== null ||
      value.lastOutcome !== null ||
      value.coverageGap
    )
      throw invalidResponse();
    return;
  }
  if (!value.policy.enabled && (value.running || value.nextCheckAt !== null))
    throw invalidResponse();
  const selected = new Set(value.policy.listingIds);
  const claimed = new Set<string>();
  for (const issuer of value.issuers) {
    if (
      issuer.seeded !== (issuer.lastCompleteAt !== null) ||
      (issuer.status === "complete" && !issuer.seeded) ||
      (issuer.status === "unseeded" && issuer.seeded) ||
      (issuer.coverageGap && !value.coverageGap)
    )
      throw invalidResponse();
    for (const listing of issuer.listings) {
      if (!selected.has(listing.listingId) || claimed.has(listing.listingId))
        throw invalidResponse();
      claimed.add(listing.listingId);
    }
    if (
      value.inbox.filter((entry) => entry.filing.cik === issuer.cik).length > 50
    )
      throw invalidResponse();
  }
  if (claimed.size !== selected.size) throw invalidResponse();
  for (const entry of value.inbox) {
    const delivery = entry.delivery;
    if (entry.readAt !== null && entry.readAt < entry.firstSeenAt)
      throw invalidResponse();
    if (entry.filing.filingDate > entry.firstSeenAt.slice(0, 10))
      throw invalidResponse();
    if (
      delivery.attemptedAt !== null &&
      delivery.attemptedAt < entry.firstSeenAt
    )
      throw invalidResponse();
    if (
      delivery.completedAt !== null &&
      (delivery.attemptedAt === null ||
        delivery.completedAt < delivery.attemptedAt)
    )
      throw invalidResponse();
    if (
      (delivery.status === "disabled" || delivery.status === "pending") &&
      (delivery.attemptedAt !== null || delivery.completedAt !== null)
    )
      throw invalidResponse();
    if (
      delivery.status === "reserved" &&
      (delivery.attemptedAt === null || delivery.completedAt !== null)
    )
      throw invalidResponse();
    if (
      !["disabled", "pending", "reserved"].includes(delivery.status) &&
      (delivery.attemptedAt === null || delivery.completedAt === null)
    )
      throw invalidResponse();
  }
}

/** Current binding is checked against the exact UI context; a saved obsolete binding remains inspectable. */
export function validatePersonalFilingMonitorBinding(
  value: PersonalFilingMonitorDto,
  context: {
    readonly catalogSnapshotSha256: `sha256:${string}`;
    readonly watchlistVersion: number;
    readonly memberships: readonly PersonalWatchlistMembership[];
  },
): void {
  if (value.bindingStatus !== "current") return;
  const policy = value.policy;
  if (
    !policy ||
    policy.catalogSnapshotSha256 !== context.catalogSnapshotSha256 ||
    policy.watchlistVersion !== context.watchlistVersion ||
    !policy.listingIds.every((id) =>
      context.memberships.some((item) => item.listingId === id),
    )
  )
    throw invalidResponse();
  for (const issuer of value.issuers)
    for (const listing of issuer.listings) {
      const saved = context.memberships.find(
        (item) => item.listingId === listing.listingId,
      );
      if (
        !saved ||
        saved.symbol !== listing.symbol ||
        saved.issuerName !== listing.issuerName
      )
        throw invalidResponse();
    }
}
function invalidRequest() {
  return new PersonalWorkspaceApiError("invalid_request");
}
function invalidResponse() {
  return new PersonalWorkspaceApiError("invalid_response");
}
