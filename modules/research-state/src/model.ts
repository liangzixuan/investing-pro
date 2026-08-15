export type MembershipRole = "owner" | "researcher" | "viewer";

export type ResearchAction =
  | "thesis:read"
  | "thesis:write"
  | "thesis:delete"
  | "alert:read"
  | "alert:write"
  | "alert:delete"
  | "research:export";

export interface SyntheticActorContext {
  principalId: string;
  organizationId: string;
  requestId: string;
  synthetic: true;
}

export interface OrganizationMembership {
  organizationId: string;
  principalId: string;
  role: MembershipRole;
  activeFrom: string;
  activeTo: string | null;
}

export interface ThesisPayload {
  instrumentId: string;
  claim: string;
  evidence: string;
  risks: string;
  invalidation: string;
}

export interface ThesisRecord extends ThesisPayload {
  id: string;
  organizationId: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  version: number;
}

export interface AlertPayload {
  instrumentId: string;
  metricKey: string;
  operator: "above" | "below";
  threshold: string;
}

export interface AlertRecord extends AlertPayload {
  id: string;
  organizationId: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  version: number;
}

export interface SaveThesisCommand {
  id: string;
  payload: ThesisPayload;
  expectedVersion: number | null;
  idempotencyKey: string;
}

export interface SaveAlertCommand {
  id: string;
  payload: AlertPayload;
  expectedVersion: number | null;
  idempotencyKey: string;
}

export interface DeleteCommand {
  id: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason: "ALLOW" | "NO_ACTIVE_MEMBERSHIP" | "ROLE_DENIED" | "TENANT_MISMATCH";
  role: MembershipRole | null;
}

export interface IdempotencyRecord {
  organizationId: string;
  principalId: string;
  operation: string;
  key: string;
  requestFingerprint: string;
  resourceType: "thesis" | "alert";
  resourceId: string;
  resourceVersion: number;
  createdAt: string;
  expiresAt: string;
}

export interface AuditEvent {
  id: string;
  organizationId: string;
  principalId: string;
  requestId: string;
  action:
    | "thesis.created"
    | "thesis.updated"
    | "thesis.deleted"
    | "alert.created"
    | "alert.updated"
    | "alert.deleted"
    | "research.exported";
  resourceType: "thesis" | "alert" | "research_export";
  resourceId: string;
  resourceVersion: number | null;
  occurredAt: string;
  retentionUntil: string;
  retentionClass: "security_audit_90d";
}

export interface DeleteResult {
  id: string;
  deletedVersion: number;
}

export interface DeletedResourceMarker {
  organizationId: string;
  resourceType: "thesis" | "alert";
  resourceId: string;
  deletedVersion: number;
  deletedAt: string;
}

export interface ResearchExport {
  schemaVersion: "1.0.0";
  synthetic: true;
  organizationId: string;
  generatedAt: string;
  theses: ThesisRecord[];
  alerts: AlertRecord[];
}
