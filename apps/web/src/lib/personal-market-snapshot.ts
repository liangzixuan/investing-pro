import type {
  PersonalMarketDataFeedUnavailableReasonDto,
  PersonalMarketDataHistoryDto,
  PersonalMarketDataQuoteDto,
  PersonalMarketOverviewDto,
} from "@research-cockpit/contracts";
import { calculatePersonalEodReference } from "@research-cockpit/personal-market-analytics";

import type { PersonalWorkspaceApiErrorCode } from "./personal-workspace-api";

export function getPersonalMarketHistory(
  overview: PersonalMarketOverviewDto | null,
): PersonalMarketDataHistoryDto | null {
  return overview?.history.status === "available"
    ? overview.history.value
    : null;
}

export interface PersonalMarketReference {
  readonly quote: PersonalMarketDataQuoteDto;
  readonly sourceDate: string | null;
  readonly timeBasis: "provider_timestamp" | "modeled_regular_close";
}

/** A reference price is separate from the availability of the IEX feed. */
export function getPersonalMarketReference(
  overview: PersonalMarketOverviewDto | null,
): PersonalMarketReference | null {
  if (overview === null) return null;
  if (overview.quote.status === "available") {
    return Object.freeze({
      quote: overview.quote.value,
      sourceDate: null,
      timeBasis: "provider_timestamp",
    });
  }
  const history = getPersonalMarketHistory(overview);
  if (history === null) return null;
  try {
    const reference = calculatePersonalEodReference({
      bars: history.bars.map((bar) => ({
        date: bar.date,
        raw: { close: bar.raw.close },
        adjusted: { close: bar.adjusted.close },
        splitFactor: bar.splitFactor,
      })),
    });
    if (reference.status !== "available") return null;
    // Preserve the portfolio's existing 36-hour valuation-age rule. This regular
    // close is a policy model, not a timestamp supplied with the daily bar.
    // Present sourceDate to the owner and keep the model basis explicit.
    const sourceTime = modeledRegularClose(reference.sourceDate);
    const age = Date.parse(overview.ingestedAt) - Date.parse(sourceTime);
    if (!Number.isFinite(age) || age < -5 * 60 * 1_000) return null;
    const comparisonFits = [
      reference.previousClose,
      reference.change,
      reference.changePercent,
    ].every((value) => value === null || value.length <= 64);
    const quote: PersonalMarketDataQuoteDto = Object.freeze({
      change: comparisonFits ? reference.change : null,
      changePercent: comparisonFits ? reference.changePercent : null,
      currency: history.currency,
      freshness: age > 36 * 60 * 60 * 1_000 ? "older_than_36_hours" : "current",
      ingestedAt: overview.ingestedAt,
      kind: "end_of_day_close",
      previousClose: comparisonFits ? reference.previousClose : null,
      price: reference.price,
      sourceTime,
    });
    return Object.freeze({
      quote,
      sourceDate: reference.sourceDate,
      timeBasis: "modeled_regular_close",
    });
  } catch {
    return null;
  }
}

export function personalMarketFeedErrorCode(
  reason: PersonalMarketDataFeedUnavailableReasonDto,
): PersonalWorkspaceApiErrorCode {
  switch (reason) {
    case "access_denied":
      return "access_denied";
    case "upstream_unavailable":
      return "provider_unavailable";
    default:
      return reason;
  }
}

/** Retain available data before stopping a batch on a shared access/budget error. */
export function personalMarketBatchStopCode(
  overview: PersonalMarketOverviewDto,
): PersonalWorkspaceApiErrorCode | null {
  const reasons = [overview.history, overview.quote].flatMap((feed) =>
    feed.status === "unavailable" ? [feed.reason] : [],
  );
  for (const reason of [
    "credentials_invalid",
    "access_denied",
    "rate_limited",
  ] as const) {
    if (reasons.includes(reason)) return personalMarketFeedErrorCode(reason);
  }
  return null;
}

function modeledRegularClose(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const ordinal = Date.UTC(year, month - 1, day);
  const daylight =
    ordinal >= nthSunday(year, 2, 2) && ordinal < nthSunday(year, 10, 1);
  return new Date(
    Date.UTC(year, month - 1, day, daylight ? 20 : 21),
  ).toISOString();
}

function nthSunday(year: number, month: number, occurrence: number): number {
  const weekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return Date.UTC(year, month, 1 + ((7 - weekday) % 7) + (occurrence - 1) * 7);
}
