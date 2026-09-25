"use client";

import type {
  PersonalMarketDataStatusDto,
  PersonalMarketDataQuoteDto,
  PersonalMarketDataRangeDto,
  PersonalMarketOverviewDto,
  PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  fetchPersonalMarketOverview,
  PersonalWorkspaceApiError,
  type PersonalWorkspaceApiErrorCode,
} from "@/lib/personal-workspace-api";

import {
  getPersonalMarketHistory,
  getPersonalMarketReference,
  personalMarketFeedErrorCode,
  personalMarketBatchStopCode,
} from "../../lib/personal-market-snapshot";

import type { OwnerSessionActivityStart } from "./owner-session-lifecycle";
import { PersonalComparisonPerformance } from "./PersonalComparisonPerformance";

export interface PersonalComparisonPricesProps {
  readonly contextKey: string;
  readonly listings: readonly PersonalSecurityMasterScreenRowDto[];
  readonly enabled: boolean;
  readonly providerStatus: PersonalMarketDataStatusDto | null;
  readonly onActivityStart: OwnerSessionActivityStart;
  readonly onSessionUnavailable: () => void;
}

interface PriceContext {
  readonly quote: PersonalMarketDataQuoteDto;
  readonly provider: PersonalMarketOverviewDto["provider"];
  readonly eodDate: string | null;
  readonly history: {
    readonly startDate: string;
    readonly endDate: string;
    readonly bars: readonly {
      readonly date: string;
      readonly adjusted: { readonly close: string };
      readonly raw: { readonly close: string };
    }[];
  };
}
type HistoryRange = PersonalMarketDataRangeDto;
type PriceEntry =
  | { readonly state: "queued" | "loading" }
  | { readonly state: "available"; readonly value: PriceContext }
  | { readonly state: "error"; readonly message: string };
interface PriceState {
  readonly context: string;
  readonly busy: boolean;
  readonly entries: Readonly<Record<string, PriceEntry>>;
}
const identityFields = [
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;
const stopErrors = new Set<PersonalWorkspaceApiErrorCode>([
  "credentials_invalid",
  "not_entitled",
  "access_denied",
  "not_configured",
  "rate_limited",
]);

export function PersonalComparisonPrices({
  contextKey,
  listings,
  enabled,
  providerStatus,
  onActivityStart,
  onSessionUnavailable,
}: PersonalComparisonPricesProps) {
  const [range, setRange] = useState<HistoryRange>("1m");
  const context = JSON.stringify([
    contextKey,
    listings,
    enabled,
    providerStatus,
    range,
  ]);
  const currentContext = useRef<string | null>(context);
  currentContext.current = context;
  const incarnation = useRef({ context, token: Symbol() });
  if (incarnation.current.context !== context)
    incarnation.current = { context, token: Symbol() };
  const token = incarnation.current.token;
  const generation = useRef(0);
  const active = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [state, setState] = useState<PriceState>({
    context,
    busy: false,
    entries: {},
  });
  const visible: PriceState =
    state.context === context ? state : { context, busy: false, entries: {} };
  const comparisonSeries = useMemo(
    () =>
      listings.flatMap((listing) => {
        const entry = visible.entries[listing.listingId];
        return entry?.state === "available"
          ? [{ listingId: listing.listingId, ...entry.value.history }]
          : [];
      }),
    [context, visible.entries],
  );
  const configured = providerStatus?.status === "configured";
  const eligible =
    enabled &&
    configured &&
    listings.length >= 2 &&
    listings.length <= 3 &&
    new Set(listings.map((row) => row.listingId)).size === listings.length &&
    new Set(listings.map((row) => row.issuerId)).size === listings.length;

  useEffect(() => {
    generation.current += 1;
    currentContext.current = context;
    active.current = true;
    controller.current?.abort();
    controller.current = null;
    setState({ context, busy: false, entries: {} });
    return () => {
      active.current = false;
      generation.current += 1;
      controller.current?.abort();
      controller.current = null;
      currentContext.current = null;
    };
  }, [context]);

  function changeRange(value: string) {
    if (
      (value !== "1m" && value !== "3m" && value !== "1y") ||
      value === range ||
      !active.current ||
      currentContext.current !== context ||
      incarnation.current.token !== token
    )
      return;
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    setState({ context, busy: false, entries: {} });
    setRange(value);
  }

  async function loadPrices() {
    if (
      !eligible ||
      !active.current ||
      currentContext.current !== context ||
      incarnation.current.token !== token ||
      controller.current !== null
    )
      return;
    const request = new AbortController();
    controller.current = request;
    const epoch = generation.current;
    const isCurrent = () =>
      active.current &&
      !request.signal.aborted &&
      currentContext.current === context &&
      incarnation.current.token === token &&
      generation.current === epoch &&
      controller.current === request;
    const entries: Record<string, PriceEntry> = Object.fromEntries(
      listings.map((row) => [row.listingId, { state: "queued" }]),
    );
    const publish = (busy: boolean) => {
      if (isCurrent()) setState({ context, busy, entries: { ...entries } });
    };
    const expire = () => {
      if (!isCurrent()) return;
      setState({ context, busy: false, entries: {} });
      request.abort();
      onSessionUnavailable();
    };
    publish(true);
    try {
      for (const listing of listings) {
        if (!isCurrent()) return;
        const completeActivity = onActivityStart();
        if (completeActivity === undefined) {
          expire();
          return;
        }
        entries[listing.listingId] = { state: "loading" };
        publish(true);
        try {
          const overview = await fetchPersonalMarketOverview(
            {
              includeQuote: false,
              listingId: listing.listingId,
              symbol: listing.symbol,
              range,
            },
            request.signal,
          );
          if (!isCurrent()) return;
          if (!completeActivity()) {
            expire();
            return;
          }
          if (
            identityFields.some(
              (field) => overview.security[field] !== listing[field],
            ) ||
            overview.window.range !== range
          ) {
            throw new PersonalWorkspaceApiError("invalid_response");
          }
          const history = getPersonalMarketHistory(overview);
          const reference = getPersonalMarketReference(overview);
          if (history === null || reference === null) {
            throw new PersonalWorkspaceApiError(
              overview.history.status === "unavailable"
                ? personalMarketFeedErrorCode(overview.history.reason)
                : "invalid_response",
            );
          }
          const eodDate = reference.sourceDate;
          // Retain only the close fields needed for an active-session comparison.
          entries[listing.listingId] = {
            state: "available",
            value: {
              quote: { ...reference.quote },
              provider: { ...overview.provider },
              eodDate: eodDate ?? null,
              history: {
                startDate: history.startDate,
                endDate: history.endDate,
                bars: history.bars.map((bar) => ({
                  date: bar.date,
                  adjusted: { close: bar.adjusted.close },
                  raw: { close: bar.raw.close },
                })),
              },
            },
          };
          const stopCode = personalMarketBatchStopCode(overview);
          if (stopCode !== null) {
            for (const remaining of listings) {
              if (entries[remaining.listingId]?.state === "queued") {
                entries[remaining.listingId] = {
                  state: "error",
                  message:
                    "Not requested because the price load stopped. " +
                    priceError(stopCode),
                };
              }
            }
            publish(false);
            return;
          }
        } catch (error) {
          if (!isCurrent()) return;
          const code =
            error instanceof PersonalWorkspaceApiError
              ? error.code
              : "unavailable";
          if (code === "session_unavailable") {
            expire();
            return;
          }
          entries[listing.listingId] = {
            state: "error",
            message: priceError(code),
          };
          if (stopErrors.has(code)) {
            for (const remaining of listings) {
              if (entries[remaining.listingId]?.state === "queued") {
                entries[remaining.listingId] = {
                  state: "error",
                  message:
                    "Not requested because the price load stopped. " +
                    priceError(code),
                };
              }
            }
            publish(false);
            return;
          }
        }
        publish(true);
      }
      publish(false);
    } finally {
      if (controller.current === request) controller.current = null;
    }
  }

  return (
    <section
      className="comparison-prices"
      aria-labelledby="comparison-prices-title"
      aria-busy={visible.busy}
    >
      <div className="discovery-section-heading">
        <h4 id="comparison-prices-title">Prices and performance</h4>
        <button
          type="button"
          className="secondary-action compact-action"
          disabled={!eligible || visible.busy}
          onClick={() => void loadPrices()}
        >
          {visible.busy ? "Loading prices…" : "Load prices"}
        </button>
      </div>
      <label className="comparison-price-range">
        History range
        <select
          value={range}
          onChange={(event) => changeRange(event.target.value)}
          disabled={!enabled}
        >
          <option value="1m">1 month</option>
          <option value="3m">3 months</option>
          <option value="1y">1 year</option>
        </select>
      </label>
      <p className="market-scope-note">
        Reference prices and end-of-day closes are separate from SEC financials.
        They are not executable quotes or valuation ratios. Prices load only
        when requested. Changing the history range clears the loaded values;
        choose Load prices to fetch that range.
      </p>
      {!configured && (
        <p role="note" className="market-scope-note">
          {providerStatus?.status === "not_configured"
            ? "Tiingo is not configured."
            : "Provider status is unavailable. Revalidate the workspace before loading prices."}
        </p>
      )}
      <div className="comparison-price-cards" aria-live="polite">
        {listings.map((listing) => {
          const entry = visible.entries[listing.listingId];
          return (
            <article
              className="comparison-price-card"
              key={listing.listingId}
              aria-label={`${listing.symbol} price context`}
            >
              <h5>
                {listing.symbol} · {listing.exchangeMic}
              </h5>
              {entry?.state === "available" ? (
                <PriceDetails value={entry.value} />
              ) : (
                <p>
                  {entry?.state === "queued"
                    ? "Waiting for the previous company."
                    : entry?.state === "loading"
                      ? "Loading price…"
                      : entry?.state === "error"
                        ? entry.message
                        : "Price not loaded."}
                </p>
              )}
            </article>
          );
        })}
      </div>
      <PersonalComparisonPerformance
        listings={listings}
        state={
          visible.busy
            ? "loading"
            : listings.every(
                  (listing) =>
                    visible.entries[listing.listingId]?.state === "available",
                ) && listings.length >= 2
              ? "ready"
              : Object.keys(visible.entries).length > 0
                ? "incomplete"
                : "idle"
        }
        series={comparisonSeries}
      />
      <p className="market-scope-note">
        Data attribution: Tiingo. Values remain in active-session memory only;
        export and redistribution are prohibited. Load again to request another
        observation.
      </p>
    </section>
  );
}

function PriceDetails({ value }: { readonly value: PriceContext }) {
  const { quote, eodDate } = value;
  return (
    <>
      <p>
        {quote.kind === "end_of_day_close"
          ? "End-of-day close"
          : "Derived reference price"}
      </p>
      <strong className="comparison-price-value">{quote.price} USD</strong>
      <dl>
        {eodDate !== null && (
          <div>
            <dt>Bar date</dt>
            <dd>{eodDate}</dd>
          </div>
        )}
        <div>
          <dt>
            {eodDate === null
              ? "Provider reference time"
              : "Assumed regular-session close"}
          </dt>
          <dd>
            <time dateTime={quote.sourceTime}>
              {formatTimestamp(quote.sourceTime)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Loaded at</dt>
          <dd>
            <time dateTime={quote.ingestedAt}>
              {formatTimestamp(quote.ingestedAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Age when loaded</dt>
          <dd>
            {quote.freshness === "current"
              ? "Within 36 hours"
              : "Older than 36 hours"}
          </dd>
        </div>
      </dl>
      {eodDate !== null && (
        <p>
          Time assumes 16:00 in New York (20:00 or 21:00 UTC). Early closes are
          not modeled; this is not an observed closing-trade timestamp.
        </p>
      )}
    </>
  );
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
    hour12: false,
  }).format(new Date(value));
}

function priceError(code: PersonalWorkspaceApiErrorCode): string {
  switch (code) {
    case "credentials_invalid":
      return "Tiingo rejected the configured credential. The price load stopped.";
    case "access_denied":
      return "The provider refused access to this feed. The load stopped.";
    case "not_entitled":
      return "The configured Tiingo account cannot access this feed. The price load stopped.";
    case "not_configured":
      return "Tiingo is not configured. The price load stopped.";
    case "rate_limited":
      return "Tiingo's request limit was reached. The price load stopped.";
    case "not_covered":
      return "No admitted price is available for this listing.";
    case "invalid_response":
      return "The price response did not match this listing or its expected data.";
    default:
      return "Price unavailable. No substitute value was used.";
  }
}
