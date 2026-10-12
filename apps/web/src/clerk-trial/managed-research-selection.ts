import type { WatchlistMembership } from "@research-cockpit/contracts";

export interface ManagedResearchSelection {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listing: Omit<WatchlistMembership, "note">;
  readonly cik: string | null;
  readonly origin: "discover" | "watchlist" | "markets" | "route";
}
