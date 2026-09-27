import {
  isPersonalPortfolioIdentity,
  type PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import {
  calculatePersonalPricePerformanceComparison,
  type PersonalPricePerformanceComparisonAvailableResult,
  type PersonalPricePerformanceComparisonInsufficientHistoryResult,
  type PersonalPricePerformanceComparisonSeries,
} from "@research-cockpit/personal-market-analytics";

import {
  MARKET_BOARD_SEEDS,
  marketBoardCohortKey,
  marketBoardIdentityKey,
  type MarketBoardMember,
  type MarketBoardSnapshot,
} from "./market-board-loader";

export type MarketCohortComparisonMember = Readonly<
  Pick<
    MarketBoardMember,
    "listingId" | "symbol" | "exchangeMic" | "securityName"
  >
>;

export type MarketCohortComparisonModel =
  | null
  | Readonly<{
      status: "unavailable";
      reason: "single_member" | "incomplete_cohort" | "invalid_snapshot";
    }>
  | Readonly<{
      status: "available";
      members: readonly MarketCohortComparisonMember[];
      comparison: PersonalPricePerformanceComparisonAvailableResult;
    }>
  | Readonly<{
      status: "insufficient_history";
      members: readonly MarketCohortComparisonMember[];
      comparison: PersonalPricePerformanceComparisonInsufficientHistoryResult;
    }>;

const OVERVIEW_IDENTITY_FIELDS = [
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;

/** Derive from the board's admitted snapshot; never compare a successful subset. */
export function deriveMarketCohortComparison(
  snapshot: MarketBoardSnapshot | null,
): MarketCohortComparisonModel {
  if (snapshot === null) return null;
  try {
    return deriveValidated(snapshot);
  } catch {
    return unavailable("invalid_snapshot");
  }
}

function deriveValidated(
  snapshot: MarketBoardSnapshot,
): MarketCohortComparisonModel {
  const { definition } = snapshot;
  if (
    !/^sha256:[a-f0-9]{64}$/u.test(snapshot.snapshotSha256) ||
    (definition.kind !== "default" && definition.kind !== "watchlist") ||
    (definition.kind === "watchlist" &&
      (!Array.isArray(definition.members) ||
        !definition.members.every(isPersonalPortfolioIdentity))) ||
    snapshot.cohortKey !==
      marketBoardCohortKey(definition, snapshot.snapshotSha256)
  )
    return unavailable("invalid_snapshot");

  const expected =
    definition.kind === "default" ? MARKET_BOARD_SEEDS : definition.members;
  if (expected.length < 1 || expected.length > 6)
    return unavailable("invalid_snapshot");
  if (snapshot.rows.length !== expected.length || snapshot.stoppedBy !== null)
    return unavailable("incomplete_cohort");

  const series: PersonalPricePerformanceComparisonSeries[] = [];
  const members: MarketCohortComparisonMember[] = [];
  const listingIds = new Set<string>();
  const venues = new Set<string>();
  for (let index = 0; index < expected.length; index += 1) {
    const wanted = expected[index];
    const row = snapshot.rows[index];
    if (wanted === undefined || row === undefined)
      return unavailable("invalid_snapshot");
    if (row.symbol !== (typeof wanted === "string" ? wanted : wanted.symbol))
      return unavailable("invalid_snapshot");
    const { identity, overview } = row;
    if (identity === null || overview === null || row.error !== null)
      return unavailable("incomplete_cohort");
    const member = copyIdentity(identity);
    const venue = `${member.exchangeMic}:${member.symbol}`;
    if (
      !isPersonalPortfolioIdentity(member) ||
      member.instrumentType !== "common_stock" ||
      member.symbol !== row.symbol ||
      (typeof wanted !== "string" &&
        marketBoardIdentityKey(member) !== marketBoardIdentityKey(wanted)) ||
      listingIds.has(member.listingId) ||
      venues.has(venue) ||
      OVERVIEW_IDENTITY_FIELDS.some(
        (key) => overview.security[key] !== member[key],
      ) ||
      overview.window.range !== "1m" ||
      overview.quote.status !== "not_requested"
    )
      return unavailable("invalid_snapshot");
    if (overview.history.status !== "available")
      return unavailable("incomplete_cohort");
    const history = overview.history.value;
    if (
      history.currency !== "USD" ||
      history.range !== overview.window.range ||
      history.startDate !== overview.window.startDate ||
      history.endDate !== overview.window.endDate
    )
      return unavailable("invalid_snapshot");

    listingIds.add(member.listingId);
    venues.add(venue);
    members.push(
      Object.freeze({
        listingId: member.listingId,
        symbol: member.symbol,
        exchangeMic: member.exchangeMic,
        securityName: member.securityName,
      }),
    );
    series.push({
      listingId: member.listingId,
      startDate: history.startDate,
      endDate: history.endDate,
      // Keep every original date, including those later excluded by alignment.
      bars: history.bars.map((bar) => ({
        date: bar.date,
        raw: { close: bar.raw.close },
        adjusted: { close: bar.adjusted.close },
      })),
    });
  }

  if (members.length === 1) return unavailable("single_member");
  const comparison = calculatePersonalPricePerformanceComparison({ series });
  const orderedMembers = Object.freeze(members);
  return comparison.status === "available"
    ? Object.freeze({
        status: "available",
        members: orderedMembers,
        comparison,
      })
    : Object.freeze({
        status: "insufficient_history",
        members: orderedMembers,
        comparison,
      });
}

function copyIdentity(
  row: PersonalSecurityMasterScreenRowDto,
): MarketBoardMember {
  return {
    country: row.country,
    exchangeMic: row.exchangeMic,
    instrumentType: row.instrumentType,
    issuerId: row.issuerId,
    issuerName: row.issuerName,
    listingId: row.listingId,
    securityId: row.securityId,
    securityName: row.securityName,
    shareClassId: row.shareClassId,
    shareClassName: row.shareClassName,
    symbol: row.symbol,
  };
}

function unavailable(
  reason: Extract<
    NonNullable<MarketCohortComparisonModel>,
    { status: "unavailable" }
  >["reason"],
): MarketCohortComparisonModel {
  return Object.freeze({ status: "unavailable", reason });
}
