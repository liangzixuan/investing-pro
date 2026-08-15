import {
  forbidden,
  idempotencyConflict,
  invalidInput,
  notFound,
  versionConflict,
} from "./errors";
import type {
  AlertRecord,
  AuditEvent,
  DeletedResourceMarker,
  IdempotencyRecord,
  OrganizationMembership,
  ResearchAction,
  SyntheticActorContext,
  ThesisRecord,
} from "./model";
import type {
  Clock,
  ResearchStateUnitOfWork,
  ScopedResearchStateRepositories,
} from "./ports";
import {
  assertIsoUtc,
  assertUuid,
  validateActor,
  validateAlertPayload,
  validateThesisPayload,
} from "./validation";

export interface InMemoryResearchStateSeed {
  memberships?: OrganizationMembership[];
  theses?: ThesisRecord[];
  alerts?: AlertRecord[];
  idempotency?: IdempotencyRecord[];
  audit?: AuditEvent[];
  deletedResources?: DeletedResourceMarker[];
}

export interface InMemoryResearchStateSnapshot {
  memberships: OrganizationMembership[];
  theses: ThesisRecord[];
  alerts: AlertRecord[];
  idempotency: IdempotencyRecord[];
  audit: AuditEvent[];
  deletedResources: DeletedResourceMarker[];
}

interface MemoryState {
  memberships: Map<string, OrganizationMembership>;
  theses: Map<string, ThesisRecord>;
  alerts: Map<string, AlertRecord>;
  idempotency: Map<string, IdempotencyRecord>;
  audit: AuditEvent[];
  thesisTombstones: Map<string, DeletedResourceMarker>;
  alertTombstones: Map<string, DeletedResourceMarker>;
}

const AUDIT_KEYS = new Set<string>([
  "id",
  "organizationId",
  "principalId",
  "requestId",
  "action",
  "resourceType",
  "resourceId",
  "resourceVersion",
  "occurredAt",
  "retentionUntil",
  "retentionClass",
]);
const AUDIT_ACTIONS = new Set<AuditEvent["action"]>([
  "thesis.created",
  "thesis.updated",
  "thesis.deleted",
  "alert.created",
  "alert.updated",
  "alert.deleted",
  "research.exported",
]);
const AUDIT_RESOURCE_TYPES = new Set<AuditEvent["resourceType"]>([
  "thesis",
  "alert",
  "research_export",
]);
const THESIS_RECORD_KEYS = new Set<string>([
  "id",
  "organizationId",
  "instrumentId",
  "claim",
  "evidence",
  "risks",
  "invalidation",
  "createdBy",
  "createdAt",
  "updatedBy",
  "updatedAt",
  "version",
]);
const ALERT_RECORD_KEYS = new Set<string>([
  "id",
  "organizationId",
  "instrumentId",
  "metricKey",
  "operator",
  "threshold",
  "createdBy",
  "createdAt",
  "updatedBy",
  "updatedAt",
  "version",
]);
const IDEMPOTENCY_RECORD_KEYS = new Set<string>([
  "organizationId",
  "principalId",
  "operation",
  "key",
  "requestFingerprint",
  "resourceType",
  "resourceId",
  "resourceVersion",
  "createdAt",
  "expiresAt",
]);
const DELETED_RESOURCE_KEYS = new Set<string>([
  "organizationId",
  "resourceType",
  "resourceId",
  "deletedVersion",
  "deletedAt",
]);

export class InMemoryResearchStateUnitOfWork implements ResearchStateUnitOfWork {
  private state: MemoryState;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    seed: InMemoryResearchStateSeed = {},
    private readonly clock: Clock,
  ) {
    validateSeed(seed);
    this.state = {
      memberships: new Map(
        (seed.memberships ?? []).map((item) => [
          membershipKey(item.organizationId, item.principalId),
          clone(item),
        ]),
      ),
      theses: new Map(
        (seed.theses ?? []).map((item) => [
          resourceKey(item.organizationId, item.id),
          clone(item),
        ]),
      ),
      alerts: new Map(
        (seed.alerts ?? []).map((item) => [
          resourceKey(item.organizationId, item.id),
          clone(item),
        ]),
      ),
      idempotency: new Map(
        (seed.idempotency ?? []).map((item) => [
          idempotencyKey(item),
          clone(item),
        ]),
      ),
      audit: clone(seed.audit ?? []),
      thesisTombstones: new Map(
        (seed.deletedResources ?? [])
          .filter((item) => item.resourceType === "thesis")
          .map((item) => [
            resourceKey(item.organizationId, item.resourceId),
            clone(item),
          ]),
      ),
      alertTombstones: new Map(
        (seed.deletedResources ?? [])
          .filter((item) => item.resourceType === "alert")
          .map((item) => [
            resourceKey(item.organizationId, item.resourceId),
            clone(item),
          ]),
      ),
    };
  }

  run<T>(
    actor: SyntheticActorContext,
    operation: (repositories: ScopedResearchStateRepositories) => Promise<T>,
  ): Promise<T> {
    validateActor(actor);
    const execute = async (): Promise<T> => {
      const now = this.clock.now();
      assertIsoUtc(now, "repository clock.now()");
      const draft = cloneState(this.state);
      const result = await operation(scopedRepositories(draft, actor, now));
      const safeResult = clone(result);
      this.state = draft;
      return safeResult;
    };
    const result = this.queue.then(execute, execute);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Unscoped visibility is intentionally available only on the demo/test adapter. */
  async snapshotForTesting(): Promise<InMemoryResearchStateSnapshot> {
    await this.queue;
    return {
      memberships: clone([...this.state.memberships.values()]),
      theses: clone([...this.state.theses.values()]),
      alerts: clone([...this.state.alerts.values()]),
      idempotency: clone([...this.state.idempotency.values()]),
      audit: clone(this.state.audit),
      deletedResources: clone([
        ...this.state.thesisTombstones.values(),
        ...this.state.alertTombstones.values(),
      ]),
    };
  }
}

function scopedRepositories(
  state: MemoryState,
  actor: SyntheticActorContext,
  now: string,
): ScopedResearchStateRepositories {
  const requireAction = (action: ResearchAction): void => {
    const membership = state.memberships.get(
      membershipKey(actor.organizationId, actor.principalId),
    );
    if (!authorize(actor, membership ?? null, action, now).allowed)
      throw forbidden();
  };
  return {
    memberships: {
      current: () =>
        Promise.resolve(
          clone(
            state.memberships.get(
              membershipKey(actor.organizationId, actor.principalId),
            ) ?? null,
          ),
        ),
    },
    theses: {
      get: (id) => {
        requireAction("thesis:read");
        return Promise.resolve(
          clone(
            state.theses.get(resourceKey(actor.organizationId, id)) ?? null,
          ),
        );
      },
      list: () => {
        requireAction("thesis:read");
        return Promise.resolve(
          clone(
            [...state.theses.values()]
              .filter(
                (record) => record.organizationId === actor.organizationId,
              )
              .sort((left, right) => compareText(left.id, right.id)),
          ),
        );
      },
      put: (record, expectedVersion) => {
        requireAction("thesis:write");
        enforceThesisWriteContext(record, actor);
        const key = resourceKey(actor.organizationId, record.id);
        const current = state.theses.get(key);
        if (expectedVersion === null && state.thesisTombstones.has(key))
          throw versionConflict();
        enforcePutVersion(current, record, expectedVersion);
        state.theses.set(key, clone(record));
        return Promise.resolve();
      },
      delete: (id, expectedVersion) => {
        requireAction("thesis:delete");
        const key = resourceKey(actor.organizationId, id);
        const current = state.theses.get(key);
        if (!current) throw notFound("thesis");
        if (current.version !== expectedVersion) throw versionConflict();
        if (Date.parse(now) < Date.parse(current.updatedAt))
          throw invalidInput(
            "Repository clock cannot precede the deleted thesis.",
          );
        state.theses.delete(key);
        state.thesisTombstones.set(key, {
          organizationId: actor.organizationId,
          resourceType: "thesis",
          resourceId: id,
          deletedVersion: expectedVersion,
          deletedAt: now,
        });
        return Promise.resolve();
      },
    },
    alerts: {
      get: (id) => {
        requireAction("alert:read");
        return Promise.resolve(
          clone(
            state.alerts.get(resourceKey(actor.organizationId, id)) ?? null,
          ),
        );
      },
      list: () => {
        requireAction("alert:read");
        return Promise.resolve(
          clone(
            [...state.alerts.values()]
              .filter(
                (record) => record.organizationId === actor.organizationId,
              )
              .sort((left, right) => compareText(left.id, right.id)),
          ),
        );
      },
      put: (record, expectedVersion) => {
        requireAction("alert:write");
        enforceAlertWriteContext(record, actor);
        const key = resourceKey(actor.organizationId, record.id);
        const current = state.alerts.get(key);
        if (expectedVersion === null && state.alertTombstones.has(key))
          throw versionConflict();
        enforcePutVersion(current, record, expectedVersion);
        state.alerts.set(key, clone(record));
        return Promise.resolve();
      },
      delete: (id, expectedVersion) => {
        requireAction("alert:delete");
        const key = resourceKey(actor.organizationId, id);
        const current = state.alerts.get(key);
        if (!current) throw notFound("alert");
        if (current.version !== expectedVersion) throw versionConflict();
        if (Date.parse(now) < Date.parse(current.updatedAt))
          throw invalidInput(
            "Repository clock cannot precede the deleted alert.",
          );
        state.alerts.delete(key);
        state.alertTombstones.set(key, {
          organizationId: actor.organizationId,
          resourceType: "alert",
          resourceId: id,
          deletedVersion: expectedVersion,
          deletedAt: now,
        });
        return Promise.resolve();
      },
    },
    idempotency: {
      get: (operation, key) => {
        requireAction(actionForIdempotency(operation));
        if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(key))
          throw invalidInput("Idempotency key has an invalid format.");
        const scopedKey = scopedIdempotencyKey(actor, operation, key);
        const record = state.idempotency.get(scopedKey);
        if (!record) return Promise.resolve(null);
        if (Date.parse(record.expiresAt) <= Date.parse(now)) {
          state.idempotency.delete(scopedKey);
          return Promise.resolve(null);
        }
        return Promise.resolve(clone(record));
      },
      put: (record) => {
        requireAction(actionForIdempotency(record.operation));
        if (
          record.organizationId !== actor.organizationId ||
          record.principalId !== actor.principalId
        )
          throw forbidden();
        validateIdempotency(record);
        const expectedType = record.operation.startsWith("thesis.")
          ? "thesis"
          : "alert";
        if (record.resourceType !== expectedType)
          throw invalidInput(
            "Idempotency resource type must match its operation.",
          );
        const key = idempotencyKey(record);
        const current = state.idempotency.get(key);
        if (current && Date.parse(current.expiresAt) > Date.parse(now)) {
          if (
            current.requestFingerprint !== record.requestFingerprint ||
            current.resourceType !== record.resourceType ||
            current.resourceId !== record.resourceId ||
            current.resourceVersion !== record.resourceVersion
          )
            throw idempotencyConflict();
          return Promise.resolve();
        }
        state.idempotency.set(key, clone(record));
        return Promise.resolve();
      },
    },
    audit: {
      append: (event) => {
        requireAction(
          actionForAudit((event as Partial<AuditEvent> | null)?.action),
        );
        enforceAuditEnvelope(event, actor);
        if (state.audit.some((existing) => existing.id === event.id))
          throw invalidInput("Audit event id must be unique.");
        state.audit.push(clone(event));
        return Promise.resolve();
      },
    },
  };
}

function enforcePutVersion<T extends ThesisRecord | AlertRecord>(
  current: T | undefined,
  next: T,
  expectedVersion: number | null,
): void {
  if (expectedVersion === null) {
    if (current || next.version !== 1) throw versionConflict();
    return;
  }
  if (
    !current ||
    current.version !== expectedVersion ||
    next.version !== expectedVersion + 1 ||
    next.createdAt !== current.createdAt ||
    next.createdBy !== current.createdBy ||
    Date.parse(next.updatedAt) < Date.parse(current.updatedAt)
  )
    throw versionConflict();
}

function enforceThesisWriteContext(
  record: ThesisRecord,
  actor: SyntheticActorContext,
): void {
  assertExactKeys(record, THESIS_RECORD_KEYS, "thesis record");
  enforceRecordEnvelope(record, actor);
  validateThesisPayload(thesisPayloadOf(record));
}

function enforceAlertWriteContext(
  record: AlertRecord,
  actor: SyntheticActorContext,
): void {
  assertExactKeys(record, ALERT_RECORD_KEYS, "alert record");
  enforceRecordEnvelope(record, actor);
  validateAlertPayload(alertPayloadOf(record));
}

function enforceRecordEnvelope(
  record: ThesisRecord | AlertRecord,
  actor: SyntheticActorContext,
): void {
  if (
    record.organizationId !== actor.organizationId ||
    record.updatedBy !== actor.principalId ||
    (record.version === 1 && record.createdBy !== actor.principalId)
  )
    throw forbidden();
  assertUuid(record.id, "resource id");
  assertIsoUtc(record.createdAt, "createdAt");
  assertIsoUtc(record.updatedAt, "updatedAt");
  if (Date.parse(record.updatedAt) < Date.parse(record.createdAt))
    throw invalidInput("updatedAt cannot precede createdAt.");
  if (!Number.isSafeInteger(record.version) || record.version < 1)
    throw invalidInput("version must be a positive safe integer.");
}

function enforceAuditEnvelope(
  event: AuditEvent,
  actor: SyntheticActorContext,
): void {
  if (
    event.organizationId !== actor.organizationId ||
    event.principalId !== actor.principalId ||
    event.requestId !== actor.requestId
  )
    throw forbidden();
  const unknownKeys = Object.keys(event).filter((key) => !AUDIT_KEYS.has(key));
  if (unknownKeys.length > 0)
    throw invalidInput("Audit events may contain only allowlisted metadata.");
  validateAuditEvent(event);
}

function validateAuditEvent(event: AuditEvent): void {
  assertUuid(event.id, "audit id");
  assertUuid(event.organizationId, "audit organizationId");
  assertUuid(event.principalId, "audit principalId");
  if (!AUDIT_ACTIONS.has(event.action))
    throw invalidInput("Audit action is not allowlisted.");
  if (!AUDIT_RESOURCE_TYPES.has(event.resourceType))
    throw invalidInput("Audit resource type is not allowlisted.");
  if (event.retentionClass !== "security_audit_90d")
    throw invalidInput("Audit retention class is not allowlisted.");
  if (
    event.resourceVersion !== null &&
    (!Number.isSafeInteger(event.resourceVersion) || event.resourceVersion < 1)
  )
    throw invalidInput("Audit resource version must be null or positive.");
  assertUuid(event.resourceId, "audit resourceId");
  assertIsoUtc(event.occurredAt, "audit occurredAt");
  assertIsoUtc(event.retentionUntil, "audit retentionUntil");
  if (Date.parse(event.retentionUntil) <= Date.parse(event.occurredAt))
    throw invalidInput("Audit retention must end after the event time.");
}

function validateSeed(seed: InMemoryResearchStateSeed): void {
  for (const membership of seed.memberships ?? []) {
    assertUuid(membership.organizationId, "membership organizationId");
    assertUuid(membership.principalId, "membership principalId");
    assertIsoUtc(membership.activeFrom, "membership activeFrom");
    if (membership.activeTo !== null) {
      assertIsoUtc(membership.activeTo, "membership activeTo");
      if (Date.parse(membership.activeTo) <= Date.parse(membership.activeFrom))
        throw invalidInput(
          "Membership intervals must be non-empty and half-open.",
        );
    }
    if (
      !(["owner", "researcher", "viewer"] as string[]).includes(membership.role)
    )
      throw invalidInput("Unknown membership role.");
  }
  for (const record of seed.theses ?? []) validateSeedThesis(record);
  for (const record of seed.alerts ?? []) validateSeedAlert(record);
  for (const record of seed.idempotency ?? []) validateIdempotency(record);
  for (const event of seed.audit ?? []) {
    const unknownKeys = Object.keys(event).filter(
      (key) => !AUDIT_KEYS.has(key),
    );
    if (unknownKeys.length > 0)
      throw invalidInput(
        "Seed audit events may contain only allowlisted metadata.",
      );
    validateAuditEvent(event);
  }
  assertUnique(
    seed.memberships ?? [],
    (item) => membershipKey(item.organizationId, item.principalId),
    "membership",
  );
  assertUnique(
    seed.theses ?? [],
    (item) => resourceKey(item.organizationId, item.id),
    "thesis",
  );
  assertUnique(
    seed.alerts ?? [],
    (item) => resourceKey(item.organizationId, item.id),
    "alert",
  );
  assertUnique(seed.idempotency ?? [], idempotencyKey, "idempotency record");
  assertUnique(seed.audit ?? [], (item) => item.id, "audit event");
  for (const marker of seed.deletedResources ?? [])
    validateDeletedResource(marker);
  assertUnique(
    seed.deletedResources ?? [],
    (item) => `${item.organizationId}:${item.resourceType}:${item.resourceId}`,
    "deleted resource",
  );
  for (const marker of seed.deletedResources ?? []) {
    const liveRecords =
      marker.resourceType === "thesis"
        ? (seed.theses ?? [])
        : (seed.alerts ?? []);
    if (
      liveRecords.some(
        (record) =>
          record.organizationId === marker.organizationId &&
          record.id === marker.resourceId,
      )
    )
      throw invalidInput("A deleted resource id cannot also be live.");
  }
}

function validateDeletedResource(marker: DeletedResourceMarker): void {
  assertExactKeys(marker, DELETED_RESOURCE_KEYS, "deleted resource marker");
  assertUuid(marker.organizationId, "deleted resource organizationId");
  assertUuid(marker.resourceId, "deleted resource id");
  if (marker.resourceType !== "thesis" && marker.resourceType !== "alert")
    throw invalidInput("Deleted resource type is not allowlisted.");
  if (!Number.isSafeInteger(marker.deletedVersion) || marker.deletedVersion < 1)
    throw invalidInput("Deleted resource version must be positive.");
  assertIsoUtc(marker.deletedAt, "deleted resource deletedAt");
}

function validateIdempotency(record: IdempotencyRecord): void {
  assertExactKeys(record, IDEMPOTENCY_RECORD_KEYS, "idempotency record");
  assertUuid(record.organizationId, "idempotency organizationId");
  assertUuid(record.principalId, "idempotency principalId");
  assertUuid(record.resourceId, "idempotency resourceId");
  if (
    typeof record.operation !== "string" ||
    !/^[A-Za-z0-9._:-]{1,120}$/.test(record.operation)
  )
    throw invalidInput("Idempotency operation has an invalid format.");
  if (
    typeof record.key !== "string" ||
    !/^[A-Za-z0-9._:-]{8,128}$/.test(record.key)
  )
    throw invalidInput("Idempotency key has an invalid format.");
  if (
    typeof record.requestFingerprint !== "string" ||
    !/^sha256:[0-9a-f]{64}$/.test(record.requestFingerprint)
  )
    throw invalidInput("Idempotency fingerprint must be SHA-256.");
  if (record.resourceType !== "thesis" && record.resourceType !== "alert")
    throw invalidInput("Idempotency resource type is not allowlisted.");
  if (
    !Number.isSafeInteger(record.resourceVersion) ||
    record.resourceVersion < 1
  )
    throw invalidInput("Idempotency resource version must be positive.");
  assertIsoUtc(record.createdAt, "idempotency createdAt");
  assertIsoUtc(record.expiresAt, "idempotency expiresAt");
  if (Date.parse(record.expiresAt) <= Date.parse(record.createdAt))
    throw invalidInput("Idempotency expiry must follow creation.");
}

function assertUnique<T>(
  items: T[],
  keyFor: (item: T) => string,
  label: string,
): void {
  const keys = new Set<string>();
  for (const item of items) {
    const key = keyFor(item);
    if (keys.has(key)) throw invalidInput(`Duplicate ${label} seed key.`);
    keys.add(key);
  }
}

function assertExactKeys(
  record: unknown,
  expected: ReadonlySet<string>,
  label: string,
): void {
  if (typeof record !== "object" || record === null || Array.isArray(record))
    throw invalidInput(`${label} must be an object.`);
  const keys = Object.keys(record);
  if (keys.length !== expected.size || keys.some((key) => !expected.has(key)))
    throw invalidInput(`${label} contains missing or unknown fields.`);
}

function validateSeedThesis(record: ThesisRecord): void {
  assertExactKeys(record, THESIS_RECORD_KEYS, "seed thesis record");
  validateSeedRecord(record);
  validateThesisPayload(thesisPayloadOf(record));
}

function validateSeedAlert(record: AlertRecord): void {
  assertExactKeys(record, ALERT_RECORD_KEYS, "seed alert record");
  validateSeedRecord(record);
  validateAlertPayload(alertPayloadOf(record));
}

function validateSeedRecord(record: ThesisRecord | AlertRecord): void {
  assertUuid(record.id, "seed resource id");
  assertUuid(record.organizationId, "seed organizationId");
  assertUuid(record.createdBy, "seed createdBy");
  assertUuid(record.updatedBy, "seed updatedBy");
  assertIsoUtc(record.createdAt, "seed createdAt");
  assertIsoUtc(record.updatedAt, "seed updatedAt");
  if (Date.parse(record.updatedAt) < Date.parse(record.createdAt))
    throw invalidInput("Seed updatedAt cannot precede createdAt.");
  if (!Number.isSafeInteger(record.version) || record.version < 1)
    throw invalidInput("Seed version must be a positive safe integer.");
}

function thesisPayloadOf(record: ThesisRecord) {
  return {
    instrumentId: record.instrumentId,
    claim: record.claim,
    evidence: record.evidence,
    risks: record.risks,
    invalidation: record.invalidation,
  };
}

function alertPayloadOf(record: AlertRecord) {
  return {
    instrumentId: record.instrumentId,
    metricKey: record.metricKey,
    operator: record.operator,
    threshold: record.threshold,
  };
}

function cloneState(state: MemoryState): MemoryState {
  return {
    memberships: new Map(
      [...state.memberships].map(([key, value]) => [key, clone(value)]),
    ),
    theses: new Map(
      [...state.theses].map(([key, value]) => [key, clone(value)]),
    ),
    alerts: new Map(
      [...state.alerts].map(([key, value]) => [key, clone(value)]),
    ),
    idempotency: new Map(
      [...state.idempotency].map(([key, value]) => [key, clone(value)]),
    ),
    audit: clone(state.audit),
    thesisTombstones: new Map(
      [...state.thesisTombstones].map(([key, value]) => [key, clone(value)]),
    ),
    alertTombstones: new Map(
      [...state.alertTombstones].map(([key, value]) => [key, clone(value)]),
    ),
  };
}

function membershipKey(organizationId: string, principalId: string): string {
  return `${organizationId}:${principalId}`;
}

function resourceKey(organizationId: string, id: string): string {
  return `${organizationId}:${id}`;
}

function scopedIdempotencyKey(
  actor: SyntheticActorContext,
  operation: string,
  key: string,
): string {
  return `${actor.organizationId}:${actor.principalId}:${operation}:${key}`;
}

function idempotencyKey(record: IdempotencyRecord): string {
  return `${record.organizationId}:${record.principalId}:${record.operation}:${record.key}`;
}

function actionForIdempotency(operation: unknown): ResearchAction {
  if (typeof operation !== "string")
    throw invalidInput("Idempotency operation has an invalid format.");
  if (operation.startsWith("thesis.")) return "thesis:write";
  if (operation.startsWith("alert.")) return "alert:write";
  throw invalidInput("Idempotency operation is not allowlisted.");
}

function actionForAudit(action: unknown): ResearchAction {
  if (action === "thesis.deleted") return "thesis:delete";
  if (action === "thesis.created" || action === "thesis.updated")
    return "thesis:write";
  if (action === "alert.deleted") return "alert:delete";
  if (action === "alert.created" || action === "alert.updated")
    return "alert:write";
  if (action === "research.exported") return "research:export";
  throw invalidInput("Audit action is not allowlisted.");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
import { authorize } from "./authorization";
