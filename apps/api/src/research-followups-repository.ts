import type {
  ManagedResearchFollowupsCommand,
  ResearchFollowupsPayload,
} from "@research-cockpit/contracts";

/** Server-verified account identity, never copied from a saved body. */
export interface ResearchFollowupsPrincipal {
  readonly userId: string;
}

export interface ResearchFollowupsRecord {
  readonly id: "main";
  readonly version: number;
  readonly payload: ResearchFollowupsPayload;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PutResearchFollowupsCommand = ManagedResearchFollowupsCommand;

export interface ResearchFollowupsReceipt {
  readonly id: "main";
  readonly version: number;
  readonly digestSha256: string;
  readonly committedAt: string;
  readonly replayed: boolean;
}

export type ResearchFollowupsRepositoryErrorCode =
  | "invalid_request"
  | "conflict"
  | "idempotency_conflict"
  | "invalid_response"
  | "access_denied"
  | "unavailable"
  | "commit_unknown";

/** Finite errors exclude upstream messages, records, causes and credentials. */
export class ResearchFollowupsRepositoryError extends Error {
  constructor(readonly code: ResearchFollowupsRepositoryErrorCode) {
    super(code);
    this.name = "ResearchFollowupsRepositoryError";
  }
}

export interface ResearchFollowupsRepository {
  get(
    principal: ResearchFollowupsPrincipal,
  ): Promise<ResearchFollowupsRecord | null>;
  put(
    principal: ResearchFollowupsPrincipal,
    command: PutResearchFollowupsCommand,
  ): Promise<ResearchFollowupsReceipt>;
}
