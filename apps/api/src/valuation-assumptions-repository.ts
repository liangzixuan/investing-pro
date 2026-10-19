import type {
  ManagedValuationAssumptionsCommand,
  ValuationAssumptionsPayload,
} from "@research-cockpit/contracts";

/** Server-verified account identity, never copied from a saved body. */
export interface ValuationAssumptionsPrincipal {
  readonly userId: string;
}

export interface ValuationAssumptionsRecord {
  readonly id: "main";
  readonly version: number;
  readonly payload: ValuationAssumptionsPayload;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PutValuationAssumptionsCommand = ManagedValuationAssumptionsCommand;

export interface ValuationAssumptionsReceipt {
  readonly id: "main";
  readonly version: number;
  readonly digestSha256: string;
  readonly committedAt: string;
  readonly replayed: boolean;
}

export type ValuationAssumptionsRepositoryErrorCode =
  | "invalid_request"
  | "conflict"
  | "idempotency_conflict"
  | "invalid_response"
  | "access_denied"
  | "unavailable"
  | "commit_unknown";

/** Finite errors exclude upstream messages, records, causes and credentials. */
export class ValuationAssumptionsRepositoryError extends Error {
  constructor(readonly code: ValuationAssumptionsRepositoryErrorCode) {
    super(code);
    this.name = "ValuationAssumptionsRepositoryError";
  }
}

export interface ValuationAssumptionsRepository {
  get(
    principal: ValuationAssumptionsPrincipal,
  ): Promise<ValuationAssumptionsRecord | null>;
  put(
    principal: ValuationAssumptionsPrincipal,
    command: PutValuationAssumptionsCommand,
  ): Promise<ValuationAssumptionsReceipt>;
}
