"use client";

import type {
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
  PersonalSecurityMasterSearchResultDto,
  PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import {
  calculatePersonalMarketBoard,
  type PersonalMarketBoardIdentity,
  type PersonalMarketBoardResult,
  type PersonalMarketBoardRow,
} from "@research-cockpit/personal-market-analytics";
import { useEffect, useState, type MouseEvent } from "react";
import { getPersonalMarketHistory } from "../../lib/personal-market-snapshot";
import { PriceHistoryChart } from "../research/PriceHistoryChart";
import type { OwnerSessionActivityStart } from "../research/owner-session-lifecycle";
import {
  MARKET_BOARD_SEEDS,
  type MarketBoardEntry,
  type MarketBoardSnapshot,
} from "./market-board-loader";
import { useMarketsSnapshot } from "./useMarketsSnapshot";
import "./markets.css";

export interface MarketsHomeProps {
  readonly active: boolean;
  readonly enabled: boolean;
  readonly catalogSnapshotSha256: string | null;
  readonly sessionKey: number;
  readonly providerStatus: PersonalMarketDataStatusDto | null;
  readonly isCurrent: () => boolean;
  readonly onActivityStart: OwnerSessionActivityStart;
  readonly onSessionUnavailable: () => void;
  readonly onOpenCompany: (
    identity:
      | PersonalSecurityMasterSearchResultDto
      | PersonalSecurityMasterScreenRowDto,
    origin: HTMLElement,
    overview: PersonalMarketOverviewDto | null,
  ) => void;
}
type BoardOrder = "board" | "gainers" | "losers";
export function MarketsHome(props: MarketsHomeProps) {
  const data = useMarketsSnapshot({
    ...props,
    enabled: props.enabled && props.providerStatus?.status === "configured",
  });
  const [order, setOrder] = useState<BoardOrder>("board");
  const [chartFocus, setChartFocus] = useState<{
    listingId: string;
    sessionKey: number;
    catalogSnapshotSha256: string | null;
  } | null>(null);
  useEffect(() => {
    if (chartFocus === null) return;
    setChartFocus(null);
    if (
      props.active &&
      props.enabled &&
      props.isCurrent() &&
      chartFocus.sessionKey === props.sessionKey &&
      chartFocus.catalogSnapshotSha256 === props.catalogSnapshotSha256 &&
      chartFocus.listingId === data.selectedListingId
    ) {
      document.getElementById("markets-chart-title")?.focus();
    }
  }, [
    chartFocus,
    props.active,
    props.sessionKey,
    props.catalogSnapshotSha256,
    data.selectedListingId,
  ]);
  return (
    <div hidden={!props.active}>
      <MarketsBoardView
        {...props}
        {...data}
        order={order}
        onOrder={setOrder}
        onSelect={(listingId) => {
          if (data.onSelect(listingId))
            setChartFocus({
              listingId,
              sessionKey: props.sessionKey,
              catalogSnapshotSha256: props.catalogSnapshotSha256,
            });
        }}
      />
    </div>
  );
}
export interface MarketsBoardViewProps extends MarketsHomeProps {
  readonly snapshot: MarketBoardSnapshot | null;
  readonly selectedListingId: string | null;
  readonly busy: boolean;
  readonly attempted: boolean;
  readonly error: string | null;
  readonly nextRefreshAt: number | null;
  readonly order: BoardOrder;
  readonly onOrder: (order: BoardOrder) => void;
  readonly onSelect: (listingId: string) => void;
  readonly onRefresh: () => void;
}
export function projectMarketBoard(
  snapshot: MarketBoardSnapshot | null,
): PersonalMarketBoardResult | null {
  if (snapshot === null) return null;
  const rows = snapshot.rows.flatMap((row) => {
    if (row.identity === null) return [];
    const identity = boardIdentity(row.identity);
    const history = getPersonalMarketHistory(row.overview);
    return [
      {
        identity,
        history:
          history === null
            ? null
            : {
                security: boardIdentity(row.overview!.security),
                bars: history.bars.map((bar) => ({
                  date: bar.date,
                  raw: { close: bar.raw.close },
                  adjusted: { close: bar.adjusted.close },
                  splitFactor: bar.splitFactor,
                })),
              },
      },
    ];
  });
  if (rows.length === 0) return null;
  try {
    return calculatePersonalMarketBoard({ rows });
  } catch {
    return null;
  }
}
export function MarketsBoardView(props: MarketsBoardViewProps) {
  const projected = projectMarketBoard(props.snapshot);
  const rows =
    props.snapshot?.rows ??
    MARKET_BOARD_SEEDS.map((symbol): MarketBoardEntry => ({
      symbol,
      identity: null,
      overview: null,
      error: null,
    }));
  const ranking = projected?.ranking;
  const rankedIds =
    ranking?.status === "available" && props.order !== "board"
      ? props.order === "gainers"
        ? ranking.descendingListingIds
        : ranking.ascendingListingIds
      : null;
  const ordered =
    rankedIds === null
      ? rows
      : [...rows].sort((a, b) => {
          const left = rankedIds.indexOf(a.identity?.listingId ?? "");
          const right = rankedIds.indexOf(b.identity?.listingId ?? "");
          return (left < 0 ? 99 : left) - (right < 0 ? 99 : right);
        });
  const selected =
    rows.find((row) => row.identity?.listingId === props.selectedListingId) ??
    null;
  const selectedValue = projected?.rows.find(
    (row) => row.identity.listingId === props.selectedListingId,
  );
  const selectedHistory = getPersonalMarketHistory(selected?.overview ?? null);
  const configured = props.providerStatus?.status === "configured";
  const available =
    projected?.rows.filter((row) => row.status === "available").length ?? 0;
  return (
    <section
      className="markets-home"
      aria-labelledby="markets-title"
      aria-busy={props.busy}
    >
      <div className="markets-heading">
        <div>
          <p className="eyebrow">Market overview</p>
          <h1 id="markets-title">Markets</h1>
          <p>AAPL, MSFT and WMT · U.S. common stocks</p>
        </div>
        <div className="markets-refresh">
          <span className="markets-eod-badge">End-of-day snapshot · USD</span>
          <button
            type="button"
            className="markets-button"
            onClick={props.onRefresh}
            disabled={!props.enabled || !configured || props.busy}
          >
            {props.busy ? "Loading board…" : "Refresh board"}
          </button>
        </div>
      </div>
      {!props.enabled ? (
        <p className="markets-message" role="status">
          The market board will load when your local workspace is ready.
        </p>
      ) : !configured ? (
        <p className="markets-message" role="status">
          Market data is unavailable. Check the provider status in Data sources.
        </p>
      ) : null}
      {props.error !== null ? (
        <p
          className={
            props.error === "refresh_deferred"
              ? "markets-message"
              : "markets-message markets-error"
          }
          role={props.error === "refresh_deferred" ? "status" : "alert"}
        >
          {marketBoardErrorMessage(props.error)}
          {props.snapshot !== null
            ? " The previous dated snapshot is kept below."
            : ""}
        </p>
      ) : null}
      {props.busy && props.snapshot !== null ? (
        <p className="markets-message" role="status">
          Previous snapshot shown while the refresh is in progress.
        </p>
      ) : null}
      {props.nextRefreshAt !== null ? (
        <p className="markets-refresh-note">
          Refresh is limited to once every 15 minutes. Next eligible refresh:{" "}
          <time dateTime={new Date(props.nextRefreshAt).toISOString()}>
            {new Date(props.nextRefreshAt).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
          . Returning to this board reuses its snapshot.
        </p>
      ) : null}
      <div className="markets-grid">
        <section className="markets-card" aria-labelledby="markets-board-title">
          <header className="markets-card-heading">
            <div>
              <h2 id="markets-board-title">Your market board</h2>
              <p>
                {available} of {rows.length} companies with EOD observations
              </p>
            </div>
            <span>{rows.length} companies</span>
          </header>
          <div className="markets-order" role="group" aria-label="Board order">
            {(
              [
                ["board", "Board order"],
                ["gainers", "Gainers"],
                ["losers", "Losers"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={props.order === value}
                disabled={value !== "board" && ranking?.status !== "available"}
                onClick={() => props.onOrder(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="markets-period">
            {ranking?.status === "available"
              ? `${ranking.descendingListingIds.length} ranked · adjusted closes, ${ranking.previousDate} to ${ranking.latestDate}`
              : ranking?.status === "mixed_dates"
                ? "Comparison dates differ. Rows stay dated and unranked."
                : "Ranking needs at least two companies with the same two observation dates."}
          </p>
          <div className="markets-table-scroll">
            <table className="markets-table">
              <caption>
                AAPL, MSFT and WMT board. Raw EOD closes in USD; changes use
                adjusted closes.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col">
                    Closing price<small>USD · EOD date</small>
                  </th>
                  <th scope="col">
                    Change<small>Adjusted</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((entry) => {
                  const value = projected?.rows.find(
                    (row) =>
                      row.identity.listingId === entry.identity?.listingId,
                  );
                  const rowSelected =
                    entry.identity !== null &&
                    entry.identity.listingId === props.selectedListingId;
                  return (
                    <tr
                      key={entry.symbol}
                      className={rowSelected ? "markets-row-selected" : ""}
                    >
                      <th scope="row">
                        <strong>{entry.symbol}</strong>
                        <span className="markets-company-name">
                          {entry.identity?.issuerName ??
                            (props.busy
                              ? "Checking catalog identity"
                              : props.snapshot === null
                                ? "Catalog identity not loaded"
                                : "Catalog identity unavailable")}
                        </span>
                        {entry.identity === null ? null : (
                          <>
                            <span className="markets-venue">
                              {entry.identity.exchangeMic} · U.S.
                            </span>
                            <div className="markets-row-actions">
                              <button
                                type="button"
                                aria-label={`View chart for ${entry.symbol}`}
                                aria-pressed={rowSelected}
                                onClick={() =>
                                  props.onSelect(entry.identity!.listingId)
                                }
                              >
                                Chart
                              </button>
                              <a
                                href={`/company/${encodeURIComponent(entry.identity.listingId)}`}
                                onClick={(event) =>
                                  openCompany(
                                    props,
                                    entry.identity!,
                                    entry.overview,
                                    event,
                                  )
                                }
                              >
                                Research {entry.symbol}
                              </a>
                            </div>
                          </>
                        )}
                      </th>
                      <td data-label="Closing price (USD)">
                        {value?.status === "available" ? (
                          <>
                            <strong>{value.rawClose}</strong>
                            <time dateTime={value.latestDate}>
                              {value.latestDate}
                            </time>
                            <small>Tiingo EOD · cached snapshot</small>
                          </>
                        ) : (
                          <span className="markets-row-status">
                            {entry.error !== null
                              ? marketBoardErrorMessage(entry.error)
                              : props.busy
                                ? "Loading…"
                                : props.snapshot !== null
                                  ? "No EOD observations"
                                  : "Not loaded"}
                          </span>
                        )}
                      </td>
                      <td data-label="Change (adjusted)">
                        {renderChange(value)}
                        {value?.status === "available" &&
                        value.previousDate !== null ? (
                          <small>
                            {value.previousDate}
                            <br />
                            to {value.latestDate}
                          </small>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="markets-footnote">
            Changes compare two dated observations. This board does not
            represent the whole market.
          </p>
        </section>
        <section
          className="markets-card markets-chart-card"
          aria-labelledby="markets-chart-title"
        >
          <header className="markets-card-heading">
            <div>
              <h2 id="markets-chart-title" tabIndex={-1}>
                {selected?.symbol ?? "Price history"}
              </h2>
              <p>
                {selected?.identity?.issuerName ??
                  "Select a company from the board"}
              </p>
            </div>
            <span className="markets-eod-badge">1M · EOD</span>
          </header>
          {selectedValue?.status === "available" ? (
            <div className="markets-chart-price">
              <strong>{selectedValue.adjustedClose}</strong>
              <span>USD · adjusted close</span>
              <time dateTime={selectedValue.latestDate}>
                {selectedValue.latestDate}
              </time>
            </div>
          ) : null}
          {selectedValue?.status === "available" &&
          selectedHistory !== null &&
          selectedHistory.bars.length > 0 &&
          selected !== null ? (
            <PriceHistoryChart
              bars={selectedHistory.bars}
              mode="adjusted"
              symbol={selected.symbol}
            />
          ) : (
            <div className="markets-chart-empty">
              <strong>
                {selected === null ? "Choose a company" : "History unavailable"}
              </strong>
              <p>
                {selected?.error
                  ? marketBoardErrorMessage(selected.error)
                  : selectedHistory !== null && projected === null
                    ? "The data could not be verified."
                    : "The chart uses the same snapshot as the board. Selecting a row makes no new data request."}
              </p>
            </div>
          )}
          {selected?.identity !== null && selected?.identity !== undefined ? (
            <div className="markets-chart-actions">
              <a
                className="markets-button"
                href={`/company/${encodeURIComponent(selected.identity.listingId)}`}
                onClick={(event) =>
                  openCompany(
                    props,
                    selected.identity!,
                    selected.overview,
                    event,
                  )
                }
              >
                Open company research
              </a>
              <span>Financials, valuation and research notes</span>
            </div>
          ) : null}
        </section>
      </div>
      <details className="markets-sources">
        <summary>Data sources and price conventions</summary>
        <p>
          Source: Tiingo end-of-day composite. Closing prices are raw USD
          closes. Changes and the chart use adjusted closes to account for
          splits and distributions. Two dated observations may span more than
          one trading session.
        </p>
        <p>
          {props.snapshot === null ? (
            "No snapshot is loaded."
          ) : (
            <>
              Snapshot loaded{" "}
              <time dateTime={props.snapshot.loadedAt}>
                {props.snapshot.loadedAt}
              </time>
              .{" "}
            </>
          )}
          The source date appears beside each close; the load time does not make
          an EOD value live. Missing values are unavailable, never zero.
        </p>
        <p>
          This board suggests AAPL, MSFT and WMT, then resolves their current
          identities in the local admitted catalog. It does not change My
          Watchlist. Reference quotes are separate and can be loaded in company
          research.
        </p>
        <p>
          One sequential history request per resolved company, at most six
          companies per board. No background refresh. This board's limit does
          not include requests from other research tools sharing your provider
          account.
        </p>
      </details>
    </section>
  );
}
function boardIdentity(
  row: PersonalMarketBoardIdentity,
): PersonalMarketBoardIdentity {
  return {
    country: row.country,
    exchangeMic: row.exchangeMic,
    issuerName: row.issuerName,
    listingId: row.listingId,
    securityName: row.securityName,
    symbol: row.symbol,
  };
}
function renderChange(value: PersonalMarketBoardRow | undefined) {
  if (value?.status !== "available")
    return <span className="markets-row-status">Unavailable</span>;
  if (value.adjustedChangePercent === null)
    return (
      <span className="markets-row-status">Needs two dated observations</span>
    );
  const negative = value.adjustedChangePercent.startsWith("-");
  const sign =
    /^0(?:\.0+)?$/u.test(value.adjustedChangePercent) || negative ? "" : "+";
  return (
    <strong className={negative ? "markets-negative" : "markets-positive"}>
      {sign}
      {value.adjustedChangePercent}%
    </strong>
  );
}
export function marketBoardErrorMessage(code: string) {
  switch (code) {
    case "refresh_deferred":
      return "A recent board load used this refresh slot. Refresh again after the time shown below.";
    case "access_denied":
      return "Provider access denied.";
    case "credentials_invalid":
      return "Provider credentials unavailable.";
    case "not_entitled":
      return "This data is not included in the provider plan.";
    case "not_configured":
      return "Market data is not configured.";
    case "not_covered":
      return "No EOD coverage for this company.";
    case "not_in_catalog":
      return "No unique current catalog listing.";
    case "rate_limited":
      return "The provider request limit was reached. Try a later refresh.";
    case "not_requested":
      return "Not requested after the earlier provider refusal.";
    case "conflict":
      return "The catalog changed. Reopen the workspace before loading this board.";
    case "invalid_response":
      return "The data could not be verified.";
    default:
      return "Market data is temporarily unavailable.";
  }
}

function openCompany(
  props: MarketsHomeProps,
  identity: PersonalSecurityMasterSearchResultDto,
  overview: PersonalMarketOverviewDto | null,
  event: MouseEvent<HTMLAnchorElement>,
) {
  if (
    event.button > 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  if (props.active && props.enabled && props.isCurrent())
    props.onOpenCompany(identity, event.currentTarget, overview);
}
