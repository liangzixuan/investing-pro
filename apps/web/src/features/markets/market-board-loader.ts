import {
  isPersonalPortfolioIdentity,
  type PersonalMarketOverviewDto,
  type PersonalPortfolioIdentity,
  type PersonalSecurityMasterScreenRowDto,
  type PersonalSecurityMasterSearchResponseDto,
} from "@research-cockpit/contracts";

import {
  fetchPersonalMarketOverview,
  fetchPersonalSecurityMasterListing,
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
  "instrumentType",
  "issuerId",
  "issuerName",
  "listingId",
  "securityId",
  "securityName",
  "shareClassId",
  "shareClassName",
  "symbol",
] as const;
const OVERVIEW_IDENTITY_FIELDS = [
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;

export type MarketBoardMember = PersonalPortfolioIdentity;
export type MarketBoardDefinition =
  | Readonly<{ kind: "default" }>
  | Readonly<{ kind: "watchlist"; members: readonly MarketBoardMember[] }>;
export type MarketBoardDraft = Readonly<{
  mode: "default" | "watchlist";
  watchlistMembers: readonly MarketBoardMember[];
}>;
export type MarketBoardWatchlist = Readonly<{
  status: "available" | "unavailable" | "stale" | "reconciling";
  members: readonly MarketBoardMember[];
}>;
export type MarketBoardError =
  | PersonalWorkspaceApiErrorCode
  | "not_in_catalog"
  | "unsupported_listing"
  | "identity_mismatch"
  | "not_requested";

export interface MarketBoardAdmissionRow {
  readonly symbol: string;
  readonly identity: PersonalSecurityMasterScreenRowDto | null;
  readonly error: MarketBoardError | null;
}

export interface MarketBoardAdmission {
  readonly definition: MarketBoardDefinition;
  readonly cohortKey: string;
  readonly snapshotSha256: string;
  readonly rows: readonly MarketBoardAdmissionRow[];
}

export interface MarketBoardEntry extends MarketBoardAdmissionRow {
  readonly overview: PersonalMarketOverviewDto | null;
}

export interface MarketBoardSnapshot extends MarketBoardAdmission {
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
  readonly listing: typeof fetchPersonalSecurityMasterListing;
  readonly overview: typeof fetchPersonalMarketOverview;
  readonly now: () => Date;
}

const defaults: MarketBoardDependencies = {
  search: (symbol, signal) => searchPersonalSecurities(symbol, signal, 25),
  listing: fetchPersonalSecurityMasterListing,
  overview: fetchPersonalMarketOverview,
  now: () => new Date(),
};

export function marketBoardIdentityKey(member: MarketBoardMember): string {
  return JSON.stringify(IDENTITY_FIELDS.map((field) => member[field]));
}

export function marketBoardCohortKey(
  definition: MarketBoardDefinition,
  snapshotSha256: string,
): string {
  return JSON.stringify([
    snapshotSha256,
    definition.kind,
    definition.kind === "default"
      ? MARKET_BOARD_SEEDS
      : definition.members.map(marketBoardIdentityKey),
  ]);
}

function copyMember(member: MarketBoardMember): MarketBoardMember {
  return Object.freeze({
    country: member.country,
    exchangeMic: member.exchangeMic,
    instrumentType: member.instrumentType,
    issuerId: member.issuerId,
    issuerName: member.issuerName,
    listingId: member.listingId,
    securityId: member.securityId,
    securityName: member.securityName,
    shareClassId: member.shareClassId,
    shareClassName: member.shareClassName,
    symbol: member.symbol,
  });
}

function copyListing(
  row: PersonalSecurityMasterScreenRowDto,
): PersonalSecurityMasterScreenRowDto {
  return Object.freeze({ ...copyMember(row), cik: row.cik });
}

function copyDefinition(
  definition: MarketBoardDefinition,
): MarketBoardDefinition {
  if (definition.kind === "default") return Object.freeze({ kind: "default" });
  if (
    definition.kind !== "watchlist" ||
    !Array.isArray(definition.members) ||
    definition.members.length > 6 ||
    !definition.members.every(isPersonalPortfolioIdentity) ||
    new Set(definition.members.map((member) => member.listingId)).size !==
      definition.members.length ||
    new Set(
      definition.members.map(
        (member) => `${member.exchangeMic}:${member.symbol}`,
      ),
    ).size !== definition.members.length
  )
    throw new PersonalWorkspaceApiError("invalid_request");
  return Object.freeze({
    kind: "watchlist",
    members: Object.freeze(definition.members.map(copyMember)),
  });
}

/** Complete local catalog admission before the caller charges any provider slot. */
export async function admitMarketBoard(
  requestedDefinition: MarketBoardDefinition,
  snapshotSha256: string,
  signal: AbortSignal,
  dependencies: MarketBoardDependencies = defaults,
): Promise<MarketBoardAdmission> {
  if (!/^sha256:[a-f0-9]{64}$/u.test(snapshotSha256))
    throw new PersonalWorkspaceApiError("invalid_request");
  const definition = copyDefinition(requestedDefinition);
  const rows: MarketBoardAdmissionRow[] = [];
  const members =
    definition.kind === "default" ? MARKET_BOARD_SEEDS : definition.members;
  for (const member of members) {
    signal.throwIfAborted();
    const symbol = typeof member === "string" ? member : member.symbol;
    try {
      let identity: PersonalSecurityMasterScreenRowDto | null;
      let error: MarketBoardError | null = null;
      if (typeof member === "string") {
        const found = await dependencies.search(symbol, signal);
        signal.throwIfAborted();
        if (found.snapshot.snapshotSha256 !== snapshotSha256)
          throw new PersonalWorkspaceApiError("conflict");
        const exact = found.results.filter((row) => row.symbol === symbol);
        const common = exact.filter(
          (row) =>
            row.country === "US" && row.instrumentType === "common_stock",
        );
        identity = common.length === 1 ? (common[0] ?? null) : null;
        if (identity === null)
          error = exact.length === 1 ? "unsupported_listing" : "not_in_catalog";
      } else {
        const found = await dependencies.listing(member.listingId, signal);
        signal.throwIfAborted();
        if (found.snapshot.snapshotSha256 !== snapshotSha256)
          throw new PersonalWorkspaceApiError("conflict");
        identity = found.listing;
        if (identity === null) error = "not_in_catalog";
        else if (
          IDENTITY_FIELDS.some(
            (field) => found.listing?.[field] !== member[field],
          )
        )
          error = "identity_mismatch";
        else if (
          identity.country !== "US" ||
          identity.instrumentType !== "common_stock"
        )
          error = "unsupported_listing";
      }
      rows.push(
        Object.freeze({
          symbol,
          identity:
            identity !== null && error === null ? copyListing(identity) : null,
          error,
        }),
      );
    } catch (error) {
      signal.throwIfAborted();
      const code =
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable";
      if (code === "session_unavailable" || code === "conflict") throw error;
      rows.push(Object.freeze({ symbol, identity: null, error: code }));
    }
  }
  signal.throwIfAborted();
  const identities = rows.flatMap((row) =>
    row.identity === null ? [] : [row.identity],
  );
  if (
    new Set(identities.map((row) => row.listingId)).size !==
      identities.length ||
    new Set(identities.map((row) => `${row.exchangeMic}:${row.symbol}`))
      .size !== identities.length
  )
    throw new PersonalWorkspaceApiError("invalid_response");
  return Object.freeze({
    definition,
    cohortKey: marketBoardCohortKey(definition, snapshotSha256),
    snapshotSha256,
    rows: Object.freeze(rows),
  });
}

/** One EOD-only loop. Callers check authority and charge immediately before entry. */
export async function loadMarketBoard(
  admission: MarketBoardAdmission,
  signal: AbortSignal,
  dependencies: MarketBoardDependencies = defaults,
): Promise<MarketBoardSnapshot> {
  const rows: MarketBoardEntry[] = [];
  let stoppedBy: PersonalWorkspaceApiErrorCode | null = null;
  for (const admitted of admission.rows) {
    signal.throwIfAborted();
    const { symbol, identity } = admitted;
    if (identity === null || admitted.error !== null) {
      rows.push(Object.freeze({ ...admitted, overview: null }));
      continue;
    }
    if (stoppedBy !== null) {
      rows.push(
        Object.freeze({ ...admitted, overview: null, error: "not_requested" }),
      );
      continue;
    }
    try {
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
        OVERVIEW_IDENTITY_FIELDS.some(
          (key) => overview.security[key] !== identity[key],
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
    definition: admission.definition,
    cohortKey: admission.cohortKey,
    snapshotSha256: admission.snapshotSha256,
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
