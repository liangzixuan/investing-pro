import type {
  AlertRecord,
  AuditEvent,
  IdempotencyRecord,
  OrganizationMembership,
  SyntheticActorContext,
  ThesisRecord,
} from "./model";

export interface Clock {
  now(): string;
}

export interface IdGenerator {
  next(namespace: "audit" | "export"): string;
}

export interface MembershipRepository {
  current(): Promise<OrganizationMembership | null>;
}

export interface ThesisRepository {
  get(id: string): Promise<ThesisRecord | null>;
  list(): Promise<ThesisRecord[]>;
  put(record: ThesisRecord, expectedVersion: number | null): Promise<void>;
  delete(id: string, expectedVersion: number): Promise<void>;
}

export interface AlertRepository {
  get(id: string): Promise<AlertRecord | null>;
  list(): Promise<AlertRecord[]>;
  put(record: AlertRecord, expectedVersion: number | null): Promise<void>;
  delete(id: string, expectedVersion: number): Promise<void>;
}

export interface IdempotencyRepository {
  get(operation: string, key: string): Promise<IdempotencyRecord | null>;
  put(record: IdempotencyRecord): Promise<void>;
}

export interface AuditSink {
  append(event: AuditEvent): Promise<void>;
}

export interface ScopedResearchStateRepositories {
  memberships: MembershipRepository;
  theses: ThesisRepository;
  alerts: AlertRepository;
  idempotency: IdempotencyRepository;
  audit: AuditSink;
}

export interface ResearchStateUnitOfWork {
  run<T>(
    actor: SyntheticActorContext,
    operation: (repositories: ScopedResearchStateRepositories) => Promise<T>,
  ): Promise<T>;
}
