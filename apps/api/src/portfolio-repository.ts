import type {
  ManagedPortfolioCommand,
  ManagedPortfolioPayload,
} from "@research-cockpit/contracts";

/** Server-verified identity, never supplied by a saved ledger. */
export interface PortfolioPrincipal {
  readonly userId: string;
}

export interface PortfolioRecord {
  readonly id: "main";
  readonly version: number;
  readonly payload: ManagedPortfolioPayload;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PutPortfolioCommand = ManagedPortfolioCommand;

export interface PortfolioReceipt {
  readonly id: "main";
  readonly version: number;
  readonly digestSha256: string;
  readonly committedAt: string;
  readonly replayed: boolean;
}

export type PortfolioRepositoryErrorCode =
  | "invalid_request"
  | "conflict"
  | "idempotency_conflict"
  | "invalid_response"
  | "access_denied"
  | "unavailable"
  | "commit_unknown";

/** Finite errors exclude account data and upstream responses. */
export class PortfolioRepositoryError extends Error {
  constructor(readonly code: PortfolioRepositoryErrorCode) {
    super(code);
    this.name = "PortfolioRepositoryError";
  }
}

export interface PortfolioRepository {
  get(principal: PortfolioPrincipal): Promise<PortfolioRecord | null>;
  put(
    principal: PortfolioPrincipal,
    command: PutPortfolioCommand,
  ): Promise<PortfolioReceipt>;
}
