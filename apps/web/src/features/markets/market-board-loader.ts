import type {
  PersonalMarketOverviewDto,
  PersonalSecurityMasterSearchResponseDto,
  PersonalSecurityMasterSearchResultDto,
} from "@research-cockpit/contracts";

import {
  fetchPersonalMarketOverview,
  PersonalWorkspaceApiError,
  searchPersonalSecurities,
  type PersonalWorkspaceApiErrorCode,
} from "../../lib/personal-workspace-api";
import {
  personalMarketBatchStopCode,
  personalMarketFeedErrorCode,
} from "../../lib/personal-market-snapshot";

export const MARKET_BOARD_SEEDS = Object.freeze(["AAPL", "MSFT", "WMT"]);
export const MARKET_BOARD_REFRESH_MILLISECONDS = 15 * 60 * 1_000;
const HOUR = 60 * 60 * 1_000;
const IDENTITY_FIELDS = [
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;

export interface MarketBoardEntry {
  readonly symbol: string;
  readonly identity: PersonalSecurityMasterSearchResultDto | null;
  readonly overview: PersonalMarketOverviewDto | null;
  readonly error:
    PersonalWorkspaceApiErrorCode | "not_in_catalog" | "not_requested" | null;
}

export interface MarketBoardSnapshot {
  readonly snapshotSha256: string;
  readonly loadedAt: string;
  readonly rows: readonly MarketBoardEntry[];
  readonly stoppedBy: PersonalWorkspaceApiErrorCode | null;
}

export interface MarketBoardDependencies {
  readonly search: (
    symbol: string,
    signal: AbortSignal,
  ) => Promise<{
    readonly results: PersonalSecurityMasterSearchResponseDto["results"];
    readonly snapshot: Pick<
      PersonalSecurityMasterSearchResponseDto["snapshot"],
      "snapshotSha256"
    >;
  }>;
  readonly overview: typeof fetchPersonalMarketOverview;
  readonly now: () => Date;
}

const defaults: MarketBoardDependencies = {
  search: (symbol, signal) => searchPersonalSecurities(symbol, signal, 25),
  overview: fetchPersonalMarketOverview,
  now: () => new Date(),
};

/** One bounded snapshot; callers own active-session lifetime and explicit refresh. */
export async function loadMarketBoard(
  snapshotSha256: string,
  signal: AbortSignal,
  dependencies: MarketBoardDependencies = defaults,
  seeds: readonly string[] = MARKET_BOARD_SEEDS,
): Promise<MarketBoardSnapshot> {
  if (
    !/^sha256:[a-f0-9]{64}$/u.test(snapshotSha256) ||
    seeds.length < 1 ||
    seeds.length > 6 ||
    new Set(seeds).size !== seeds.length ||
    seeds.some((symbol) => !/^[A-Z0-9][A-Z0-9.-]{0,14}$/u.test(symbol))
  ) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  const rows: MarketBoardEntry[] = [];
  const seen = new Set<string>();
  let stoppedBy: PersonalWorkspaceApiErrorCode | null = null;
  for (const symbol of seeds) {
    signal.throwIfAborted();
    if (stoppedBy !== null) {
      rows.push(
        Object.freeze({
          symbol,
          identity: null,
          overview: null,
          error: "not_requested",
        }),
      );
      continue;
    }
    let identity: PersonalSecurityMasterSearchResultDto | null = null;
    try {
      const found = await dependencies.search(symbol, signal);
      signal.throwIfAborted();
      if (found.snapshot.snapshotSha256 !== snapshotSha256)
        throw new PersonalWorkspaceApiError("conflict");
      const exact = found.results.filter(
        (candidate) =>
          candidate.symbol === symbol &&
          candidate.country === "US" &&
          candidate.instrumentType === "common_stock",
      );
      if (exact.length !== 1 || exact[0] === undefined) {
        rows.push(
          Object.freeze({
            symbol,
            identity: null,
            overview: null,
            error: "not_in_catalog",
          }),
        );
        continue;
      }
      identity = Object.freeze({ ...exact[0] });
      if (seen.has(identity.listingId))
        throw new PersonalWorkspaceApiError("invalid_response");
      seen.add(identity.listingId);
      const overview = await dependencies.overview(
        {
          listingId: identity.listingId,
          symbol: identity.symbol,
          range: "1m",
          includeQuote: false,
        },
        signal,
      );
      signal.throwIfAborted();
      if (
        overview.quote.status !== "not_requested" ||
        overview.window.range !== "1m" ||
        IDENTITY_FIELDS.some(
          (key) => overview.security[key] !== identity?.[key],
        )
      )
        throw new PersonalWorkspaceApiError("invalid_response");
      rows.push(
        Object.freeze({
          symbol,
          identity,
          overview,
          error:
            overview.history.status === "unavailable"
              ? personalMarketFeedErrorCode(overview.history.reason)
              : null,
        }),
      );
      stoppedBy = personalMarketBatchStopCode(overview);
    } catch (error) {
      signal.throwIfAborted();
      const code =
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable";
      if (code === "session_unavailable" || code === "conflict") throw error;
      rows.push(
        Object.freeze({ symbol, identity, overview: null, error: code }),
      );
      if (
        [
          "credentials_invalid",
          "access_denied",
          "not_entitled",
          "not_configured",
          "rate_limited",
        ].includes(code)
      )
        stoppedBy = code;
    }
  }
  signal.throwIfAborted();
  return Object.freeze({
    snapshotSha256,
    loadedAt: dependencies.now().toISOString(),
    rows: Object.freeze(rows),
    stoppedBy,
  });
}

/** This limits this board's starts only; other tools share the provider account. */
export function createMarketBoardRefreshBudget() {
  let starts: number[] = [];
  return Object.freeze({
    nextAllowedAt(now: number): number {
      starts = starts.filter((time) => now - time < HOUR);
      const last = starts.at(-1);
      const cadence =
        last === undefined ? now : last + MARKET_BOARD_REFRESH_MILLISECONDS;
      const hourly = starts.length < 4 ? now : (starts[0] ?? now) + HOUR;
      return Math.max(now, cadence, hourly);
    },
    start(now: number): boolean {
      if (!Number.isFinite(now) || this.nextAllowedAt(now) > now) return false;
      starts.push(now);
      return true;
    },
  });
}
