import { authorize } from "./authorization";
import {
  forbidden,
  idempotencyConflict,
  notFound,
  versionConflict,
} from "./errors";
import { requestFingerprint } from "./fingerprint";
import type {
  AlertRecord,
  AuditEvent,
  DeleteCommand,
  DeleteResult,
  IdempotencyRecord,
  ResearchAction,
  ResearchExport,
  SaveAlertCommand,
  SaveThesisCommand,
  SyntheticActorContext,
  ThesisRecord,
} from "./model";
import type {
  Clock,
  IdGenerator,
  ResearchStateUnitOfWork,
  ScopedResearchStateRepositories,
} from "./ports";
import {
  assertIsoUtc,
  assertUuid,
  validateActor,
  validateDelete,
  validateSaveAlert,
  validateSaveThesis,
} from "./validation";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;
const AUDIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;

export class ResearchStateService {
  constructor(
    private readonly unitOfWork: ResearchStateUnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async getThesis(
    actor: SyntheticActorContext,
    id: string,
  ): Promise<ThesisRecord> {
    validateActor(actor);
    assertUuid(id, "thesis id");
    const now = this.now();
    return this.unitOfWork.run(actor, async (repositories) => {
      await requireAction(repositories, actor, "thesis:read", now);
      const record = await repositories.theses.get(id);
      if (!record) throw notFound("thesis");
      return record;
    });
  }

  async listTheses(actor: SyntheticActorContext): Promise<ThesisRecord[]> {
    validateActor(actor);
    const now = this.now();
    return this.unitOfWork.run(actor, async (repositories) => {
      await requireAction(repositories, actor, "thesis:read", now);
      return repositories.theses.list();
    });
  }

  async saveThesis(
    actor: SyntheticActorContext,
    command: SaveThesisCommand,
  ): Promise<ThesisRecord> {
    validateActor(actor);
    validateSaveThesis(command);
    const now = this.now();
    const operation = `thesis.save:${command.id}`;
    const fingerprint = requestFingerprint(command);

    return this.unitOfWork.run(actor, async (repositories) => {
      await requireAction(repositories, actor, "thesis:write", now);
      const replay = await repositories.idempotency.get(
        operation,
        command.idempotencyKey,
      );
      if (replay)
        return replayThesis(repositories, replay, fingerprint, command.id);

      const current = await repositories.theses.get(command.id);
      const record = buildThesis(actor, command, current, now);
      await repositories.theses.put(record, command.expectedVersion);
      await repositories.idempotency.put(
        idempotencyRecord(
          actor,
          operation,
          command.idempotencyKey,
          fingerprint,
          "thesis",
          record.id,
          record.version,
          now,
        ),
      );
      await repositories.audit.append(
        this.auditEvent(
          actor,
          current ? "thesis.updated" : "thesis.created",
          "thesis",
          record.id,
          record.version,
          now,
        ),
      );
      return record;
    });
  }

  async deleteThesis(
    actor: SyntheticActorContext,
    command: DeleteCommand,
  ): Promise<DeleteResult> {
    validateActor(actor);
    validateDelete(command);
    const now = this.now();
    const operation = `thesis.delete:${command.id}`;
    const fingerprint = requestFingerprint(command);

    return this.unitOfWork.run(actor, async (repositories) => {
      await requireAction(repositories, actor, "thesis:delete", now);
      const replay = await repositories.idempotency.get(
        operation,
        command.idempotencyKey,
      );
      if (replay)
        return replayThesisDelete(
          repositories,
          replay,
          fingerprint,
          command.id,
        );

      const current = await repositories.theses.get(command.id);
      if (!current) throw notFound("thesis");
      if (current.version !== command.expectedVersion) throw versionConflict();
      await repositories.theses.delete(command.id, command.expectedVersion);
      await repositories.idempotency.put(
        idempotencyRecord(
          actor,
          operation,
          command.idempotencyKey,
          fingerprint,
          "thesis",
          command.id,
          command.expectedVersion,
          now,
        ),
      );
      await repositories.audit.append(
        this.auditEvent(
          actor,
          "thesis.deleted",
          "thesis",
          command.id,
          command.expectedVersion,
          now,
        ),
      );
      return { id: command.id, deletedVersion: command.expectedVersion };
    });
  }

  async getAlert(
    actor: SyntheticActorContext,
    id: string,
  ): Promise<AlertRecord> {
    validateActor(actor);
    assertUuid(id, "alert id");
    const now = this.now();
    return this.unitOfWork.run(actor, async (repositories) => {
      await requireAction(repositories, actor, "alert:read", now);
      const record = await repositories.alerts.get(id);
      if (!record) throw notFound("alert");
      return record;
    });
  }

  async listAlerts(actor: SyntheticActorContext): Promise<AlertRecord[]> {
    validateActor(actor);
    const now = this.now();
    return this.unitOfWork.run(actor, async (repositories) => {
      await requireAction(repositories, actor, "alert:read", now);
      return repositories.alerts.list();
    });
  }

  async saveAlert(
    actor: SyntheticActorContext,
    command: SaveAlertCommand,
  ): Promise<AlertRecord> {
    validateActor(actor);
    validateSaveAlert(command);
    const now = this.now();
    const operation = `alert.save:${command.id}`;
    const fingerprint = requestFingerprint(command);

    return this.unitOfWork.run(actor, async (repositories) => {
      await requireAction(repositories, actor, "alert:write", now);
      const replay = await repositories.idempotency.get(
        operation,
        command.idempotencyKey,
      );
      if (replay)
        return replayAlert(repositories, replay, fingerprint, command.id);

      const current = await repositories.alerts.get(command.id);
      const record = buildAlert(actor, command, current, now);
      await repositories.alerts.put(record, command.expectedVersion);
      await repositories.idempotency.put(
        idempotencyRecord(
          actor,
          operation,
          command.idempotencyKey,
          fingerprint,
          "alert",
          record.id,
          record.version,
          now,
        ),
      );
      await repositories.audit.append(
        this.auditEvent(
          actor,
          current ? "alert.updated" : "alert.created",
          "alert",
          record.id,
          record.version,
          now,
        ),
      );
      return record;
    });
  }

  async deleteAlert(
    actor: SyntheticActorContext,
    command: DeleteCommand,
  ): Promise<DeleteResult> {
    validateActor(actor);
    validateDelete(command);
    const now = this.now();
    const operation = `alert.delete:${command.id}`;
    const fingerprint = requestFingerprint(command);

    return this.unitOfWork.run(actor, async (repositories) => {
      await requireAction(repositories, actor, "alert:delete", now);
      const replay = await repositories.idempotency.get(
        operation,
        command.idempotencyKey,
      );
      if (replay)
        return replayAlertDelete(repositories, replay, fingerprint, command.id);

      const current = await repositories.alerts.get(command.id);
      if (!current) throw notFound("alert");
      if (current.version !== command.expectedVersion) throw versionConflict();
      await repositories.alerts.delete(command.id, command.expectedVersion);
      await repositories.idempotency.put(
        idempotencyRecord(
          actor,
          operation,
          command.idempotencyKey,
          fingerprint,
          "alert",
          command.id,
          command.expectedVersion,
          now,
        ),
      );
      await repositories.audit.append(
        this.auditEvent(
          actor,
          "alert.deleted",
          "alert",
          command.id,
          command.expectedVersion,
          now,
        ),
      );
      return { id: command.id, deletedVersion: command.expectedVersion };
    });
  }

  async exportResearch(actor: SyntheticActorContext): Promise<ResearchExport> {
    validateActor(actor);
    const now = this.now();
    return this.unitOfWork.run(actor, async (repositories) => {
      await requireAction(repositories, actor, "research:export", now);
      const exportId = this.nextId("export");
      const [theses, alerts] = await Promise.all([
        repositories.theses.list(),
        repositories.alerts.list(),
      ]);
      await repositories.audit.append(
        this.auditEvent(
          actor,
          "research.exported",
          "research_export",
          exportId,
          null,
          now,
        ),
      );
      return {
        schemaVersion: "1.0.0",
        synthetic: true,
        organizationId: actor.organizationId,
        generatedAt: now,
        theses,
        alerts,
      };
    });
  }

  private auditEvent(
    actor: SyntheticActorContext,
    action: AuditEvent["action"],
    resourceType: AuditEvent["resourceType"],
    resourceId: string,
    resourceVersion: number | null,
    occurredAt: string,
  ): AuditEvent {
    return {
      id: this.nextId("audit"),
      organizationId: actor.organizationId,
      principalId: actor.principalId,
      requestId: actor.requestId,
      action,
      resourceType,
      resourceId,
      resourceVersion,
      occurredAt,
      retentionUntil: plusMilliseconds(occurredAt, AUDIT_RETENTION_MS),
      retentionClass: "security_audit_90d",
    };
  }

  private now(): string {
    const now = this.clock.now();
    assertIsoUtc(now, "clock.now()");
    return now;
  }

  private nextId(namespace: "audit" | "export"): string {
    const id = this.ids.next(namespace);
    assertUuid(id, `${namespace} id`);
    return id;
  }
}

async function requireAction(
  repositories: ScopedResearchStateRepositories,
  actor: SyntheticActorContext,
  action: ResearchAction,
  now: string,
): Promise<void> {
  const membership = await repositories.memberships.current();
  if (!authorize(actor, membership, action, now).allowed) throw forbidden();
}

function buildThesis(
  actor: SyntheticActorContext,
  command: SaveThesisCommand,
  current: ThesisRecord | null,
  now: string,
): ThesisRecord {
  enforceExpectedState(current, command.expectedVersion, "thesis");
  return {
    id: command.id,
    organizationId: actor.organizationId,
    instrumentId: command.payload.instrumentId,
    claim: command.payload.claim,
    evidence: command.payload.evidence,
    risks: command.payload.risks,
    invalidation: command.payload.invalidation,
    createdBy: current?.createdBy ?? actor.principalId,
    createdAt: current?.createdAt ?? now,
    updatedBy: actor.principalId,
    updatedAt: now,
    version: current ? current.version + 1 : 1,
  };
}

function buildAlert(
  actor: SyntheticActorContext,
  command: SaveAlertCommand,
  current: AlertRecord | null,
  now: string,
): AlertRecord {
  enforceExpectedState(current, command.expectedVersion, "alert");
  return {
    id: command.id,
    organizationId: actor.organizationId,
    instrumentId: command.payload.instrumentId,
    metricKey: command.payload.metricKey,
    operator: command.payload.operator,
    threshold: command.payload.threshold,
    createdBy: current?.createdBy ?? actor.principalId,
    createdAt: current?.createdAt ?? now,
    updatedBy: actor.principalId,
    updatedAt: now,
    version: current ? current.version + 1 : 1,
  };
}

function enforceExpectedState(
  current: ThesisRecord | AlertRecord | null,
  expectedVersion: number | null,
  resource: "thesis" | "alert",
): void {
  if (!current && expectedVersion !== null) throw notFound(resource);
  if (current && expectedVersion === null) throw versionConflict();
  if (current && current.version !== expectedVersion) throw versionConflict();
}

async function replayThesis(
  repositories: ScopedResearchStateRepositories,
  replay: IdempotencyRecord,
  fingerprint: string,
  id: string,
): Promise<ThesisRecord> {
  ensureReplay(replay, fingerprint, id, "thesis");
  const record = await repositories.theses.get(id);
  if (!record || record.version !== replay.resourceVersion)
    throw idempotencyConflict();
  return record;
}

async function replayAlert(
  repositories: ScopedResearchStateRepositories,
  replay: IdempotencyRecord,
  fingerprint: string,
  id: string,
): Promise<AlertRecord> {
  ensureReplay(replay, fingerprint, id, "alert");
  const record = await repositories.alerts.get(id);
  if (!record || record.version !== replay.resourceVersion)
    throw idempotencyConflict();
  return record;
}

async function replayThesisDelete(
  repositories: ScopedResearchStateRepositories,
  replay: IdempotencyRecord,
  fingerprint: string,
  id: string,
): Promise<DeleteResult> {
  ensureReplay(replay, fingerprint, id, "thesis");
  if (await repositories.theses.get(id)) throw idempotencyConflict();
  return { id, deletedVersion: replay.resourceVersion };
}

async function replayAlertDelete(
  repositories: ScopedResearchStateRepositories,
  replay: IdempotencyRecord,
  fingerprint: string,
  id: string,
): Promise<DeleteResult> {
  ensureReplay(replay, fingerprint, id, "alert");
  if (await repositories.alerts.get(id)) throw idempotencyConflict();
  return { id, deletedVersion: replay.resourceVersion };
}

function ensureReplay(
  replay: IdempotencyRecord,
  fingerprint: string,
  resourceId: string,
  resourceType: IdempotencyRecord["resourceType"],
): void {
  if (
    replay.requestFingerprint !== fingerprint ||
    replay.resourceId !== resourceId ||
    replay.resourceType !== resourceType
  )
    throw idempotencyConflict();
}

function idempotencyRecord(
  actor: SyntheticActorContext,
  operation: string,
  key: string,
  fingerprint: string,
  resourceType: IdempotencyRecord["resourceType"],
  resourceId: string,
  resourceVersion: number,
  createdAt: string,
): IdempotencyRecord {
  return {
    organizationId: actor.organizationId,
    principalId: actor.principalId,
    operation,
    key,
    requestFingerprint: fingerprint,
    resourceType,
    resourceId,
    resourceVersion,
    createdAt,
    expiresAt: plusMilliseconds(createdAt, IDEMPOTENCY_TTL_MS),
  };
}

function plusMilliseconds(value: string, milliseconds: number): string {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}
