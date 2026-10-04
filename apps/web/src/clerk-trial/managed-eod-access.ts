import {
  membershipMatchesResult,
  parseManagedEodError,
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryRequestDto,
  type ManagedEodHistoryResponseDto,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";

export interface ManagedEodAccessSelection {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listing: Omit<WatchlistMembership, "note">;
}

export function isManagedEodAuthenticationError(
  error: unknown,
): error is TrialApiError {
  return (
    error instanceof TrialApiError &&
    ["unauthenticated", "access_denied", "origin_denied"].includes(error.code)
  );
}

export function isManagedEodTransientError(error: unknown): boolean {
  return (
    (error instanceof ManagedEodHistoryError &&
      ["request_timeout", "unavailable", "source_rate_limited"].includes(
        error.code,
      )) ||
    (error instanceof TrialApiError && error.code === "unavailable")
  );
}

function admitResponse(
  response: ManagedEodHistoryResponseDto,
  request: ManagedEodHistoryRequestDto,
  listing: ManagedEodAccessSelection["listing"],
): ManagedEodHistoryResponseDto {
  if (
    !parseManagedEodHistoryResponse(response, request) ||
    !membershipMatchesResult({ ...listing, note: "" }, response.security)
  )
    throw new TrialApiError("invalid_response");
  return response;
}

/** One mounted workspace shares checked EOD cooldowns across its read surfaces. */
export class ManagedEodAccess {
  private nextAllowedAt: string | null = null;

  constructor(private readonly read: ManagedApi["eodHistory"]) {}

  getNextAllowedAt(): string | null {
    return this.nextAllowedAt && Date.now() < Date.parse(this.nextAllowedAt)
      ? this.nextAllowedAt
      : null;
  }

  async request(
    selection: ManagedEodAccessSelection,
    signal: AbortSignal,
  ): Promise<ManagedEodHistoryResponseDto> {
    signal.throwIfAborted();
    const nextAllowedAt = this.getNextAllowedAt();
    if (nextAllowedAt) throw new ManagedEodCooldownError(nextAllowedAt);
    const captured = {
      catalogSnapshotSha256: selection.catalogSnapshotSha256,
      listing: { ...selection.listing },
    };
    const request = {
      catalogSnapshotSha256: captured.catalogSnapshotSha256,
      listingId: captured.listing.listingId,
      range: "1m" as const,
    };
    try {
      const response = await this.read(request, signal);
      signal.throwIfAborted();
      return admitResponse(response, request, captured.listing);
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof ManagedEodCooldownError)
        throw this.recordCooldown(error);
      throw error;
    }
  }
  private recordCooldown(
    error: ManagedEodCooldownError,
  ): ManagedEodCooldownError {
    const checked = parseManagedEodError({
      error: "rate_limited",
      nextAllowedAt: error.nextAllowedAt,
    });
    if (checked?.error !== "rate_limited")
      throw new TrialApiError("invalid_response");
    // Another current read may already have received a longer cooldown.
    if (
      !this.nextAllowedAt ||
      Date.parse(checked.nextAllowedAt) > Date.parse(this.nextAllowedAt)
    )
      this.nextAllowedAt = checked.nextAllowedAt;
    return new ManagedEodCooldownError(this.nextAllowedAt);
  }
}
