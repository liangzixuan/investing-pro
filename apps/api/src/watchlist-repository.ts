import type { MainWatchlistPayload } from "@research-cockpit/contracts";

/** Supplied by the server after verifying the account; never copied from a body. */
export interface WatchlistPrincipal {
  readonly userId: string;
}

export interface MainWatchlistRecord {
  readonly id: "main";
  readonly version: number;
  readonly payload: MainWatchlistPayload;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PutMainWatchlistCommand {
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly payload: MainWatchlistPayload;
}

export interface MainWatchlistReceipt {
  readonly id: "main";
  readonly version: number;
  readonly digestSha256: string;
  readonly committedAt: string;
  readonly replayed: boolean;
}

export type WatchlistRepositoryErrorCode =
  | "invalid_request"
  | "conflict"
  | "idempotency_conflict"
  | "invalid_response"
  | "access_denied"
  | "unavailable"
  | "commit_unknown";

/** Deliberately excludes upstream response bodies, headers and credentials. */
export class WatchlistRepositoryError extends Error {
  constructor(readonly code: WatchlistRepositoryErrorCode) {
    super(code);
    this.name = "WatchlistRepositoryError";
  }
}

export interface MainWatchlistRepository {
  get(principal: WatchlistPrincipal): Promise<MainWatchlistRecord | null>;
  put(
    principal: WatchlistPrincipal,
    command: PutMainWatchlistCommand,
  ): Promise<MainWatchlistReceipt>;
}
