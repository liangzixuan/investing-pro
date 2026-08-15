import type { RightsPolicy } from "./model";
import { getPolicy, isRightsAllowed } from "./rights";

export const PROJECTION_OPERATIONS = [
  "display_api",
  "derive_api",
  "alert_local_alert",
] as const;

export type ProjectionOperation = (typeof PROJECTION_OPERATIONS)[number];

export interface ProjectionScope {
  instrumentId: string;
  /** Public-knowledge cutoff; independent of database-recorded time. */
  publicKnownAt: string;
  /** Database-recorded cutoff; independent of public-knowledge time. */
  systemRecordedAt: string;
}

export interface ProjectionAuthorizationContext {
  territory: string;
  /** Trusted authorization-clock value, never a request-supplied cutoff. */
  evaluatedAt: string;
}

export interface ProjectionAuthorizationInput {
  operation: ProjectionOperation;
  rightsPolicyId: string;
  rightsPolicyVersion: string;
  policies: readonly RightsPolicy[];
  context: ProjectionAuthorizationContext;
}

export type ProjectionAuthorizationReason =
  | "exact_grant"
  | "rights_not_granted"
  | "invalid_context"
  | "invalid_operation"
  | "invalid_policy_reference"
  | "missing_or_invalid_policy";

export interface ProjectionAuthorizationDecision {
  operation: ProjectionOperation | null;
  outcome: "allow" | "deny";
  reason: ProjectionAuthorizationReason;
}

export interface ProjectionCandidate<T> {
  /** Internal correlation only; never returned by the projection result. */
  rowId: string;
  instrumentId: string;
  value: T;
  rightsPolicyId: string;
  rightsPolicyVersion: string;
}

/**
 * A PostgreSQL/RLS read is not allowed to claim complete coverage in this
 * contract. The database adapter may know that its source is incomplete, or it
 * may be unable to establish completeness; neither state discloses a count.
 * The closed in-memory fixture keeps its separate exact-count path.
 */
export type RepositoryProjectionCompleteness =
  | {
      state: "known_incomplete";
      reason: "rls_filtered" | "source_gap";
    }
  | {
      state: "unknown";
      reason:
        "rls_filtered" | "not_independently_established" | "query_interrupted";
    };

export interface ProjectionOmissionSummary {
  hasOmissions: true;
  count: null;
  reason:
    | "source_incomplete_or_rights_denied"
    | "source_completeness_unknown"
    | "invalid_projection_input";
}

export interface OperationProjection<T> {
  scope: ProjectionScope | null;
  operation: ProjectionOperation | null;
  rows: readonly T[];
  completeness: RepositoryProjectionCompleteness;
  omissions: ProjectionOmissionSummary;
}

export interface OperationProjectionInput<T> {
  scope: ProjectionScope;
  operation: ProjectionOperation;
  context: ProjectionAuthorizationContext;
  candidates: readonly ProjectionCandidate<T>[];
  policies: readonly RightsPolicy[];
  completeness: RepositoryProjectionCompleteness;
}

export interface OperationProjectionQuery {
  scope: ProjectionScope;
  operation: ProjectionOperation;
  context: ProjectionAuthorizationContext;
}

export interface OperationProjectionRequest {
  scope: ProjectionScope;
  operation: ProjectionOperation;
}

export interface ProjectionAuthorizationContextProvider {
  current(): ProjectionAuthorizationContext;
}

/**
 * Untrusted adapter result. The core use case checks its returned scope and
 * operation against the request before authorizing any candidate.
 */
export interface OperationProjectionSourceResult<T> {
  scope: ProjectionScope;
  operation: ProjectionOperation;
  candidates: readonly ProjectionCandidate<T>[];
  policies: readonly RightsPolicy[];
  completeness: RepositoryProjectionCompleteness;
}

/** Port reserved for a future operation-scoped, read-only adapter. */
export interface OperationScopedProjectionSource<T> {
  load(
    query: OperationProjectionQuery,
  ): Promise<OperationProjectionSourceResult<T> | null>;
}

/**
 * Core-owned adapter seam. One load is evaluated under one exact tuple; a
 * mismatched instrument, cutoff, or operation fails closed before projection.
 */
export class GetOperationProjection<T> {
  public constructor(
    private readonly source: OperationScopedProjectionSource<T>,
    private readonly authorizationContextProvider: ProjectionAuthorizationContextProvider,
  ) {}

  public async execute(
    request: OperationProjectionRequest,
  ): Promise<OperationProjection<T> | null> {
    if (!isOperationProjectionRequest(request)) return invalidProjection();
    const context = this.authorizationContextProvider.current();
    if (!isAuthorizationContext(context)) return invalidProjection();
    const evaluatedAt = Date.parse(context.evaluatedAt);
    if (
      Date.parse(request.scope.publicKnownAt) > evaluatedAt ||
      Date.parse(request.scope.systemRecordedAt) > evaluatedAt
    ) {
      return invalidProjection();
    }
    const trustedQuery: OperationProjectionQuery = {
      ...structuredClone(request),
      context: structuredClone(context),
    };
    const loaded = await this.source.load(structuredClone(trustedQuery));
    if (loaded === null) return null;
    if (
      !isRecord(loaded) ||
      !hasExactKeys(loaded, [
        "scope",
        "operation",
        "candidates",
        "policies",
        "completeness",
      ]) ||
      !sameScope(loaded.scope, trustedQuery.scope) ||
      loaded.operation !== trustedQuery.operation
    ) {
      return invalidProjection();
    }
    return projectOperation({
      scope: loaded.scope,
      operation: loaded.operation,
      context: trustedQuery.context,
      candidates: loaded.candidates,
      policies: loaded.policies,
      completeness: loaded.completeness,
    });
  }
}

const OPERATION_CONTEXT = {
  display_api: { purpose: "display", channel: "api" },
  derive_api: { purpose: "derive", channel: "api" },
  alert_local_alert: { purpose: "alert", channel: "local_alert" },
} as const;

/** Evaluates exactly one operation against one exact policy ID/version. */
export function evaluateProjectionAuthorization(
  input: unknown,
): ProjectionAuthorizationDecision {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      "operation",
      "rightsPolicyId",
      "rightsPolicyVersion",
      "policies",
      "context",
    ])
  ) {
    return deny(null, "invalid_policy_reference");
  }

  if (!isProjectionOperation(input.operation)) {
    return deny(null, "invalid_operation");
  }
  const operation = input.operation;
  if (
    !isNonEmptyString(input.rightsPolicyId) ||
    !isNonEmptyString(input.rightsPolicyVersion)
  ) {
    return deny(operation, "invalid_policy_reference");
  }
  if (!isAuthorizationContext(input.context)) {
    return deny(operation, "invalid_context");
  }
  if (!isRightsPolicyArray(input.policies)) {
    return deny(operation, "missing_or_invalid_policy");
  }

  const policy = getPolicy(
    input.policies,
    input.rightsPolicyId,
    input.rightsPolicyVersion,
  );
  if (!policy) return deny(operation, "missing_or_invalid_policy");

  const operationContext = OPERATION_CONTEXT[operation];
  const allowed = isRightsAllowed(policy, {
    ...operationContext,
    territory: input.context.territory,
    evaluatedAt: input.context.evaluatedAt,
  });
  return {
    operation,
    outcome: allowed ? "allow" : "deny",
    reason: allowed ? "exact_grant" : "rights_not_granted",
  };
}

/**
 * Projects one repository view under one operation. The result deliberately
 * contains neither denied row identifiers nor a caller-asserted complete/count
 * state. This keeps an RLS-filtered read from becoming a count or ID oracle.
 */
export function projectOperation<T>(input: unknown): OperationProjection<T> {
  if (!isOperationProjectionInput(input)) return invalidProjection();

  const authorizedValues: T[] = [];
  try {
    for (const candidate of input.candidates) {
      const decision = evaluateProjectionAuthorization({
        operation: input.operation,
        rightsPolicyId: candidate.rightsPolicyId,
        rightsPolicyVersion: candidate.rightsPolicyVersion,
        policies: input.policies,
        context: input.context,
      });
      if (decision.outcome === "allow") {
        authorizedValues.push(structuredClone(candidate.value) as T);
      }
    }
  } catch {
    return invalidProjection();
  }

  return {
    scope: structuredClone(input.scope),
    operation: input.operation,
    rows: authorizedValues,
    completeness: structuredClone(input.completeness),
    omissions: {
      hasOmissions: true,
      count: null,
      reason:
        input.completeness.state === "known_incomplete"
          ? "source_incomplete_or_rights_denied"
          : "source_completeness_unknown",
    },
  };
}

function invalidProjection<T>(): OperationProjection<T> {
  return {
    scope: null,
    operation: null,
    rows: [],
    completeness: {
      state: "unknown",
      reason: "not_independently_established",
    },
    omissions: {
      hasOmissions: true,
      count: null,
      reason: "invalid_projection_input",
    },
  };
}

function isOperationProjectionInput(
  value: unknown,
): value is OperationProjectionInput<unknown> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "scope",
      "operation",
      "context",
      "candidates",
      "policies",
      "completeness",
    ]) ||
    !isProjectionScope(value.scope) ||
    !isProjectionOperation(value.operation) ||
    !isAuthorizationContext(value.context) ||
    !isRepositoryCompleteness(value.completeness) ||
    !Array.isArray(value.candidates) ||
    !isRightsPolicyArray(value.policies)
  ) {
    return false;
  }

  const rowIds = new Set<string>();
  for (const candidate of value.candidates) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, [
        "rowId",
        "instrumentId",
        "value",
        "rightsPolicyId",
        "rightsPolicyVersion",
      ]) ||
      !isNonEmptyString(candidate.rowId) ||
      rowIds.has(candidate.rowId) ||
      candidate.instrumentId !== value.scope.instrumentId ||
      !isNonEmptyString(candidate.rightsPolicyId) ||
      !isNonEmptyString(candidate.rightsPolicyVersion)
    ) {
      return false;
    }
    rowIds.add(candidate.rowId);
  }
  return true;
}

function isProjectionScope(value: unknown): value is ProjectionScope {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "instrumentId",
      "publicKnownAt",
      "systemRecordedAt",
    ]) &&
    isNonEmptyString(value.instrumentId) &&
    isExactIsoTimestamp(value.publicKnownAt) &&
    isExactIsoTimestamp(value.systemRecordedAt)
  );
}

function isOperationProjectionRequest(
  value: unknown,
): value is OperationProjectionRequest {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["scope", "operation"]) &&
    isProjectionScope(value.scope) &&
    isProjectionOperation(value.operation)
  );
}

function sameScope(left: unknown, right: ProjectionScope): boolean {
  return (
    isProjectionScope(left) &&
    left.instrumentId === right.instrumentId &&
    left.publicKnownAt === right.publicKnownAt &&
    left.systemRecordedAt === right.systemRecordedAt
  );
}

function isAuthorizationContext(
  value: unknown,
): value is ProjectionAuthorizationContext {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["territory", "evaluatedAt"]) &&
    isNonEmptyString(value.territory) &&
    isExactIsoTimestamp(value.evaluatedAt)
  );
}

function isRepositoryCompleteness(
  value: unknown,
): value is RepositoryProjectionCompleteness {
  if (!isRecord(value) || !hasExactKeys(value, ["state", "reason"])) {
    return false;
  }
  if (value.state === "known_incomplete") {
    return value.reason === "rls_filtered" || value.reason === "source_gap";
  }
  return (
    value.state === "unknown" &&
    (value.reason === "rls_filtered" ||
      value.reason === "not_independently_established" ||
      value.reason === "query_interrupted")
  );
}

function isRightsPolicyArray(value: unknown): value is RightsPolicy[] {
  return Array.isArray(value) && value.every(isRightsPolicy);
}

function isRightsPolicy(value: unknown): value is RightsPolicy {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "id",
      "version",
      "classification",
      "grants",
      "territory",
      "expiresAt",
    ]) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.version) ||
    value.classification !== "synthetic" ||
    !isNonEmptyString(value.territory) ||
    !Array.isArray(value.grants) ||
    !(value.expiresAt === null || isExactIsoTimestamp(value.expiresAt))
  ) {
    return false;
  }

  return value.grants.every(
    (grant) =>
      isRecord(grant) &&
      hasExactKeys(grant, ["purpose", "channel", "allowed"]) &&
      typeof grant.purpose === "string" &&
      ["display", "derive", "alert", "export", "ai"].includes(grant.purpose) &&
      typeof grant.channel === "string" &&
      ["api", "web", "local_alert"].includes(grant.channel) &&
      typeof grant.allowed === "boolean",
  );
}

function deny(
  operation: ProjectionOperation | null,
  reason: Exclude<ProjectionAuthorizationReason, "exact_grant">,
): ProjectionAuthorizationDecision {
  return { operation, outcome: "deny", reason };
}

function isProjectionOperation(value: unknown): value is ProjectionOperation {
  return (
    typeof value === "string" &&
    (PROJECTION_OPERATIONS as readonly string[]).includes(value)
  );
}

function isExactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(
      value,
    );
  if (!match) return false;
  const [, year, month, day, hour, minute, second, fraction = "0"] = match;
  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(fraction.padEnd(3, "0")),
  );
  if (Number.isNaN(timestamp)) return false;
  const expected = `${year}-${month}-${day}T${hour}:${minute}:${second}.${fraction.padEnd(3, "0")}Z`;
  return new Date(timestamp).toISOString() === expected;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
