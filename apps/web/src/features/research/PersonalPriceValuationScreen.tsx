"use client";

import type { PersonalMarketDataStatusDto } from "@research-cockpit/contracts";
import {
  buildPersonalPriceValuationScreenRow,
  evaluatePersonalPriceValuationScreen,
  validatePersonalPriceValuationScreenCriteria,
  type PersonalPriceValuationScreenRow,
  type PersonalPriceValuationScreenMetric,
  type PersonalPriceValuationScreenCriteria,
} from "@research-cockpit/personal-market-analytics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchPersonalMarketOverview,
  fetchPersonalValuationHistory,
  PersonalWorkspaceApiError,
  type PersonalWorkspaceApiErrorCode,
  type PersonalWatchlistMembership,
} from "../../lib/personal-workspace-api";
import type { OwnerSessionActivityStart } from "./owner-session-lifecycle";
import "./personal-price-valuation-screen.css";

export interface PersonalPriceValuationScreenProps {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly watchlistVersion: number;
  readonly memberships: readonly PersonalWatchlistMembership[];
  readonly enabled: boolean;
  readonly providerStatus: PersonalMarketDataStatusDto | null;
  readonly onActivityStart: OwnerSessionActivityStart;
  readonly onSessionUnavailable: () => void;
  readonly onOpenResearch: (
    membership: PersonalWatchlistMembership,
    origin: HTMLButtonElement,
    isCurrent: () => boolean,
  ) => void;
}

const metrics = ["rawClose", "priceToEarnings", "priceToBook"] as const;
const labels = {
  rawClose: "Price (USD)",
  priceToEarnings: "P/E",
  priceToBook: "P/B",
};
const identityFields = [
  "country",
  "exchangeMic",
  "issuerName",
  "listingId",
  "securityName",
  "symbol",
] as const;
const stopErrors = new Set<PersonalWorkspaceApiErrorCode>([
  "session_unavailable",
  "not_configured",
  "credentials_invalid",
  "not_entitled",
  "rate_limited",
]);
type View = "all" | "match" | "unknown" | "non_match";
type BoundsDraft = Record<
  PersonalPriceValuationScreenMetric,
  { min: string; max: string }
>;
interface ScreenState {
  readonly version: number;
  readonly epoch: number;
  readonly busy: boolean;
  readonly rows: readonly PersonalPriceValuationScreenRow[];
  readonly messages: Readonly<Record<string, string>>;
  readonly message: string;
}
const emptyBounds: BoundsDraft = {
  rawClose: { min: "", max: "" },
  priceToEarnings: { min: "", max: "" },
  priceToBook: { min: "", max: "" },
};
const reasonText = {
  market_not_loaded: "Price history unavailable",
  valuation_not_loaded: "Valuation history unavailable",
  latest_date_close_missing: "No raw close on the latest valuation date",
  not_supplied_by_provider: "Not supplied by Tiingo",
};

export function PersonalPriceValuationScreen(
  props: PersonalPriceValuationScreenProps,
) {
  const { memberships, enabled, providerStatus } = props;
  const key = JSON.stringify([
    props.catalogSnapshotSha256,
    props.watchlistVersion,
    memberships,
    enabled,
    providerStatus,
  ]);
  const context = useRef({ key, version: 0 });
  if (context.current.key !== key)
    context.current = { key, version: context.current.version + 1 };
  const version = context.current.version;
  const incarnation = useRef({ version, token: Symbol() });
  if (incarnation.current.version !== version)
    incarnation.current = { version, token: Symbol() };
  const token = incarnation.current.token;
  const mounted = useRef(false);
  const epoch = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const selection = useRef<{ version: number; ids: readonly string[] }>({
    version,
    ids: [],
  });
  const [selected, setSelected] = useState<{
    version: number;
    ids: readonly string[];
  }>({ version, ids: [] });
  const [state, setState] = useState<ScreenState>({
    version,
    epoch: 0,
    busy: false,
    rows: [],
    messages: {},
    message: "Select saved companies, then load prices and valuation.",
  });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [bounds, setBounds] = useState<BoundsDraft>(emptyBounds);
  const [sort, setSort] = useState<
    PersonalPriceValuationScreenCriteria["sort"]
  >({ field: "symbol", direction: "asc" });
  const [view, setView] = useState<View>("all");
  const selectedIds = selected.version === version ? selected.ids : [];
  const visible =
    state.version === version
      ? state
      : {
          ...state,
          rows: [],
          messages: {},
          busy: false,
          message: "Select saved companies, then load prices and valuation.",
        };
  const current = () =>
    mounted.current &&
    enabled &&
    context.current.version === version &&
    incarnation.current.token === token;
  const uniqueMemberships =
    new Set(memberships.map((item) => item.listingId)).size ===
    memberships.length;
  const configured = providerStatus?.status === "configured";
  const canLoad =
    enabled &&
    configured &&
    uniqueMemberships &&
    selectedIds.length > 0 &&
    selectedIds.length <= 20;

  useEffect(() => {
    mounted.current = true;
    epoch.current += 1;
    controller.current?.abort();
    controller.current = null;
    selection.current = { version, ids: [] };
    setSelected({ version, ids: [] });
    setState({
      version,
      epoch: epoch.current,
      busy: false,
      rows: [],
      messages: {},
      message: "Select saved companies, then load prices and valuation.",
    });
    setQuery("");
    setPage(0);
    return () => {
      mounted.current = false;
      incarnation.current = { version, token: Symbol() };
      epoch.current += 1;
      controller.current?.abort();
      controller.current = null;
    };
  }, [version]);

  const candidates = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("en-US");
    return memberships.filter((item) =>
      `${item.symbol} ${item.issuerName} ${item.securityName} ${item.exchangeMic}`
        .toLocaleLowerCase("en-US")
        .includes(needle),
    );
  }, [memberships, query]);
  const pageCount = Math.max(1, Math.ceil(candidates.length / 50));
  const activePage = Math.min(page, pageCount - 1);
  const criteria = validatePersonalPriceValuationScreenCriteria({
    bounds: Object.fromEntries(
      metrics.map((metric) => [
        metric,
        {
          min: bounds[metric].min.trim() || null,
          max: bounds[metric].max.trim() || null,
        },
      ]),
    ),
    sort,
  });
  const evaluation = useMemo(
    () =>
      criteria === null
        ? null
        : evaluatePersonalPriceValuationScreen({
            rows: visible.rows,
            criteria,
          }),
    [visible.rows, JSON.stringify(criteria)],
  );
  const rows =
    evaluation === null
      ? visible.rows
      : evaluation.rows.filter((row) => view === "all" || row.outcome === view);

  function select(id: string, checked: boolean) {
    if (
      !current() ||
      !uniqueMemberships ||
      !memberships.some((item) => item.listingId === id)
    )
      return;
    const prior =
      selection.current.version === version ? selection.current.ids : [];
    const next = checked
      ? prior.includes(id)
        ? prior
        : [...prior, id]
      : prior.filter((item) => item !== id);
    if (next.length > 20 || JSON.stringify(next) === JSON.stringify(prior))
      return;
    epoch.current += 1;
    controller.current?.abort();
    controller.current = null;
    selection.current = { version, ids: next };
    setSelected(selection.current);
    setState({
      version,
      epoch: epoch.current,
      rows: [],
      busy: false,
      messages: {},
      message:
        "Selection changed. Load prices and valuation for this selection.",
    });
  }

  function cancel() {
    if (
      !current() ||
      visible.epoch !== epoch.current ||
      controller.current === null
    )
      return;
    epoch.current += 1;
    controller.current.abort();
    controller.current = null;
    setState((prior) => ({
      ...prior,
      epoch: epoch.current,
      busy: false,
      messages: Object.fromEntries(
        Object.entries(prior.messages).map(([id, message]) => [
          id,
          message.startsWith("Waiting") || message.startsWith("Loading")
            ? "Canceled before this row completed."
            : message,
        ]),
      ),
      message: "Load canceled. Completed rows remain; other rows are unknown.",
    }));
  }

  async function load() {
    if (
      !current() ||
      !canLoad ||
      visible.epoch !== epoch.current ||
      controller.current !== null ||
      JSON.stringify(selection.current.ids) !== JSON.stringify(selectedIds)
    )
      return;
    const request = new AbortController();
    controller.current = request;
    const loadEpoch = ++epoch.current;
    const loadDate = new Date().toISOString().slice(0, 10);
    const batch = memberships
      .filter((item) => selectedIds.includes(item.listingId))
      .map((item) => ({ ...item }));
    const isCurrent = () =>
      current() &&
      epoch.current === loadEpoch &&
      controller.current === request &&
      !request.signal.aborted;
    let loadedRows: PersonalPriceValuationScreenRow[];
    try {
      loadedRows = batch.map((identity) =>
        buildPersonalPriceValuationScreenRow({
          identity: marketIdentity(identity),
          loadDate,
          market: null,
          valuation: null,
        }),
      );
    } catch {
      controller.current = null;
      setState({
        version,
        epoch: loadEpoch,
        busy: false,
        rows: [],
        messages: {},
        message:
          "Saved identities could not be used for this screen. Reload the watchlist.",
      });
      return;
    }
    const messages: Record<string, string> = Object.fromEntries(
      batch.map((item) => [item.listingId, "Waiting for this company."]),
    );
    const publish = (busy: boolean, message: string) => {
      if (isCurrent())
        setState({
          version,
          epoch: loadEpoch,
          busy,
          rows: [...loadedRows],
          messages: { ...messages },
          message,
        });
    };
    const expire = () => {
      if (!isCurrent()) return;
      setState({
        version,
        epoch: ++epoch.current,
        busy: false,
        rows: [],
        messages: {},
        message: "Session unavailable. Loaded results were cleared.",
      });
      request.abort();
      props.onSessionUnavailable();
    };
    async function acquire<
      T extends {
        security: ReturnType<typeof marketIdentity>;
        history: { range: string };
      },
      U,
    >(
      identity: PersonalWatchlistMembership,
      fetcher: (
        input: { listingId: string; symbol: string; range: "1m" },
        signal: AbortSignal,
      ) => Promise<T>,
      project: (response: T) => U,
    ): Promise<U | null> {
      if (!isCurrent()) return null;
      const complete = props.onActivityStart();
      if (complete === undefined)
        throw new PersonalWorkspaceApiError("session_unavailable");
      let response: T;
      try {
        response = await fetcher(
          {
            listingId: identity.listingId,
            symbol: identity.symbol,
            range: "1m",
          },
          request.signal,
        );
      } catch (error) {
        if (!isCurrent()) return null;
        if (!complete())
          throw new PersonalWorkspaceApiError("session_unavailable");
        const code =
          error instanceof PersonalWorkspaceApiError
            ? error.code
            : "unavailable";
        if (stopErrors.has(code)) throw new PersonalWorkspaceApiError(code);
        messages[identity.listingId] = errorMessage(code);
        return null;
      }
      if (!isCurrent()) return null;
      if (!complete())
        throw new PersonalWorkspaceApiError("session_unavailable");
      if (
        identityFields.some(
          (field) => response.security[field] !== identity[field],
        ) ||
        response.history.range !== "1m"
      ) {
        messages[identity.listingId] = errorMessage("invalid_response");
        return null;
      }
      return project(response);
    }
    publish(
      true,
      "Loading one company at a time. Each company uses two local requests.",
    );
    try {
      for (const [index, identity] of batch.entries()) {
        if (!isCurrent()) return;
        messages[identity.listingId] = "Loading price and valuation…";
        publish(true, `Loading ${index + 1} of ${batch.length}.`);
        const market = await acquire(
          identity,
          fetchPersonalMarketOverview,
          (response) => ({
            security: { ...response.security },
            range: "1m" as const,
            startDate: response.history.startDate,
            endDate: response.history.endDate,
            bars: response.history.bars.map((bar) => ({
              date: bar.date,
              raw: { close: bar.raw.close },
            })),
          }),
        );
        if (!isCurrent()) return;
        const valuation = await acquire(
          identity,
          fetchPersonalValuationHistory,
          (response) => ({
            security: { ...response.security },
            range: "1m" as const,
            startDate: response.history.startDate,
            endDate: response.history.endDate,
            latestPoint: {
              date: response.history.latestPoint.date,
              priceToEarnings: {
                ...response.history.latestPoint.priceToEarnings,
              },
              priceToBook: { ...response.history.latestPoint.priceToBook },
            },
            points: response.history.points.map((point) => ({
              date: point.date,
              priceToEarnings: { ...point.priceToEarnings },
              priceToBook: { ...point.priceToBook },
            })),
          }),
        );
        if (!isCurrent()) return;
        try {
          loadedRows[index] = buildPersonalPriceValuationScreenRow({
            identity: marketIdentity(identity),
            loadDate,
            market,
            valuation,
          });
          if (market !== null && valuation !== null)
            messages[identity.listingId] = "Loaded from Tiingo.";
        } catch {
          messages[identity.listingId] = errorMessage("invalid_response");
        }
        publish(true, `Loaded ${index + 1} of ${batch.length}.`);
      }
      publish(
        false,
        "Load complete. Filters, sorting and Research use these results without fetching again.",
      );
    } catch (error) {
      if (!isCurrent()) return;
      const code =
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable";
      if (code === "session_unavailable") expire();
      else {
        for (const identity of batch) {
          if (
            messages[identity.listingId]?.startsWith("Waiting") ||
            messages[identity.listingId]?.startsWith("Loading")
          )
            messages[identity.listingId] =
              `Not completed. ${errorMessage(code)}`;
        }
        publish(false, `Batch stopped. ${errorMessage(code)}`);
      }
    } finally {
      if (controller.current === request) controller.current = null;
    }
  }

  function research(id: string, origin: HTMLButtonElement) {
    const member = memberships.find((item) => item.listingId === id);
    const resultEpoch = visible.epoch;
    const isCurrent = () =>
      current() &&
      epoch.current === resultEpoch &&
      state.version === version &&
      selection.current.ids.includes(id) &&
      origin.isConnected &&
      !origin.disabled &&
      !origin.closest("[hidden]") &&
      origin.ownerDocument.visibilityState === "visible";
    if (
      member &&
      visible.rows.some((row) => row.identity.listingId === id) &&
      isCurrent()
    )
      props.onOpenResearch({ ...member }, origin, isCurrent);
  }

  return (
    <section
      className="personal-price-valuation-screen"
      aria-labelledby="personal-price-valuation-screen-title"
      aria-busy={visible.busy}
    >
      <h2 id="personal-price-valuation-screen-title" tabIndex={-1}>
        Price and valuation screen
      </h2>
      <p className="market-scope-note">
        Choose up to 20 saved listings. Load pairs the raw USD end-of-day close
        with P/E and P/B on the latest valuation date returned by Tiingo. No
        older pair is substituted. Companies can have different dates; age is
        measured against the frozen UTC load date, with no freshness cutoff.
      </p>
      <p className="market-scope-note">
        Tiingo · active-session memory only · no export or saved screen. Loading
        uses up to 40 local calls and 60 underlying provider requests. Provider
        ratios can be negative or zero; this screen does not calculate ratios or
        provide executable quotes.
      </p>
      {!configured && (
        <p role="note">
          {providerStatus?.status === "not_configured"
            ? "Tiingo is not configured."
            : "Provider status is unavailable. Revalidate the workspace."}
        </p>
      )}
      {!uniqueMemberships && (
        <p role="alert">
          Saved membership identities are inconsistent. Reload the watchlist.
        </p>
      )}
      <fieldset disabled={!enabled || !uniqueMemberships}>
        <legend>Select saved companies ({selectedIds.length}/20)</legend>
        <label>
          Search saved companies
          <input
            type="search"
            maxLength={128}
            value={query}
            onChange={(event) => {
              if (current()) {
                setQuery(event.target.value.normalize("NFC").slice(0, 128));
                setPage(0);
              }
            }}
          />
        </label>
        <p>
          {memberships.length} saved listings · {candidates.length} search
          results
        </p>
        <div className="price-screen-selection">
          {candidates
            .slice(activePage * 50, activePage * 50 + 50)
            .map((item) => (
              <label key={item.listingId}>
                <input
                  type="checkbox"
                  aria-label={`Select ${item.symbol} · ${item.exchangeMic}`}
                  checked={selectedIds.includes(item.listingId)}
                  disabled={
                    !selectedIds.includes(item.listingId) &&
                    selectedIds.length >= 20
                  }
                  onChange={(event) =>
                    select(item.listingId, event.target.checked)
                  }
                />
                <span>
                  {item.symbol} · {item.exchangeMic}
                  <small>{item.issuerName}</small>
                </span>
              </label>
            ))}
        </div>
        {candidates.length === 0 && (
          <p>No saved companies match this search.</p>
        )}
        {pageCount > 1 && (
          <nav aria-label="Saved company selection pages">
            <button
              type="button"
              disabled={activePage === 0}
              onClick={() => {
                if (current()) setPage(activePage - 1);
              }}
            >
              Previous companies
            </button>
            <span>
              Page {activePage + 1} of {pageCount}
            </span>
            <button
              type="button"
              disabled={activePage + 1 === pageCount}
              onClick={() => {
                if (current()) setPage(activePage + 1);
              }}
            >
              Next companies
            </button>
          </nav>
        )}
      </fieldset>
      <div className="price-screen-actions">
        <button
          type="button"
          className="secondary-action"
          disabled={!canLoad || visible.busy}
          onClick={() => void load()}
        >
          {visible.busy
            ? "Loading prices and valuation…"
            : "Load prices and valuation"}
        </button>
        <button
          type="button"
          className="secondary-action"
          disabled={!visible.busy}
          onClick={cancel}
        >
          Cancel load
        </button>
      </div>
      <p role="status">{visible.message}</p>
      <fieldset disabled={!enabled}>
        <legend>Filter loaded values</legend>
        <p>
          Bounds are inclusive. Enter exact decimals, including zero or negative
          values. To require a positive ratio, enter a positive minimum; a
          minimum of 0 includes zero. With no bounds, every row matches the
          filter, including rows with unknown values. A match does not establish
          data completeness. An unknown value is not a match for an active
          bound. A failed bound makes the whole row a nonmatch, even when
          another value is unknown.
        </p>
        <div className="price-screen-bounds">
          {metrics.map((metric) => (
            <div key={metric}>
              <strong>{labels[metric]}</strong>
              {(["min", "max"] as const).map((side) => (
                <label key={side}>
                  {side === "min" ? "Minimum" : "Maximum"}
                  <input
                    aria-label={`${labels[metric]} ${side === "min" ? "minimum" : "maximum"}`}
                    type="text"
                    inputMode="decimal"
                    maxLength={64}
                    value={bounds[metric][side]}
                    onChange={(event) => {
                      if (current())
                        setBounds((prior) => ({
                          ...prior,
                          [metric]: {
                            ...prior[metric],
                            [side]: event.target.value,
                          },
                        }));
                    }}
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="price-screen-actions">
          <label>
            Sort by
            <select
              value={sort.field}
              onChange={(event) => {
                const field = event.target.value;
                if (
                  current() &&
                  (field === "symbol" ||
                    metrics.some((metric) => metric === field))
                )
                  setSort((prior) => ({
                    ...prior,
                    field: field as typeof sort.field,
                  }));
              }}
            >
              <option value="symbol">Symbol</option>
              {metrics.map((metric) => (
                <option key={metric} value={metric}>
                  {labels[metric]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Direction
            <select
              value={sort.direction}
              onChange={(event) => {
                const direction = event.target.value;
                if (current() && (direction === "asc" || direction === "desc"))
                  setSort((prior) => ({ ...prior, direction }));
              }}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
        </div>
      </fieldset>
      {criteria === null && (
        <p role="alert">
          Enter valid decimal bounds with minimum no greater than maximum. All
          loaded rows remain visible while these filters are invalid.
        </p>
      )}
      {evaluation && (
        <p role="status">
          {evaluation.counts.total} rows · {evaluation.counts.matches} matches ·{" "}
          {evaluation.counts.unknown} unknown · {evaluation.counts.nonMatches}{" "}
          nonmatches
        </p>
      )}
      {evaluation && (
        <p>
          {metrics
            .map(
              (metric) =>
                `${labels[metric]}: ${evaluation.metricCoverage[metric].known} known, ${evaluation.metricCoverage[metric].unknown} unknown`,
            )
            .join(" · ")}
        </p>
      )}
      <label>
        Show rows
        <select
          value={view}
          disabled={criteria === null}
          onChange={(event) => {
            const next = event.target.value;
            if (
              current() &&
              (next === "all" ||
                next === "match" ||
                next === "unknown" ||
                next === "non_match")
            )
              setView(next);
          }}
        >
          <option value="all">All</option>
          <option value="match">Matches</option>
          <option value="unknown">Unknown</option>
          <option value="non_match">Nonmatches</option>
        </select>
      </label>
      <div
        className="price-screen-table"
        role="region"
        aria-label="Price and valuation results"
        tabIndex={0}
      >
        <table>
          <caption>
            Selected companies · latest valuation date and matching raw close
          </caption>
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Observation / load date (UTC)</th>
              {metrics.map((metric) => (
                <th scope="col" key={metric}>
                  {labels[metric]}
                </th>
              ))}
              <th scope="col">Filter result</th>
              <th scope="col">Research</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.identity.listingId}>
                <th scope="row">
                  {row.identity.symbol} · {row.identity.exchangeMic}
                  <small>{row.identity.issuerName}</small>
                  <small>{visible.messages[row.identity.listingId]}</small>
                </th>
                <td>
                  {row.observationDate ?? "Unknown observation date"}
                  <small>Loaded {row.loadDate}</small>
                  <small>
                    {row.ageDays === null
                      ? "Age unknown"
                      : `${row.ageDays} days old at load`}
                  </small>
                </td>
                {metrics.map((metric) => {
                  const cell = row.metrics[metric];
                  return (
                    <td key={metric}>
                      {cell.status === "known" ? (
                        cell.value
                      ) : (
                        <>
                          <span>Unknown</span>
                          <small>{reasonText[cell.reason]}</small>
                        </>
                      )}
                    </td>
                  );
                })}
                <td>
                  {"outcome" in row
                    ? row.outcome === "match"
                      ? "Match"
                      : row.outcome === "non_match"
                        ? "Nonmatch"
                        : "Unknown"
                    : "Invalid filters"}
                </td>
                <td>
                  <button
                    type="button"
                    disabled={!enabled || visible.busy}
                    onClick={(event) =>
                      research(row.identity.listingId, event.currentTarget)
                    }
                  >
                    Research {row.identity.symbol}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.rows.length === 0 && (
        <p>No loaded rows. Select companies and load when ready.</p>
      )}
      {visible.rows.length > 0 && rows.length === 0 && (
        <p>
          No rows in this view. Choose All to inspect every selected company.
        </p>
      )}
    </section>
  );
}

function marketIdentity(member: PersonalWatchlistMembership) {
  return {
    country: member.country,
    exchangeMic: member.exchangeMic,
    issuerName: member.issuerName,
    listingId: member.listingId,
    securityName: member.securityName,
    symbol: member.symbol,
  };
}
function errorMessage(code: PersonalWorkspaceApiErrorCode): string {
  switch (code) {
    case "credentials_invalid":
      return "Tiingo credentials were rejected.";
    case "not_configured":
      return "Tiingo is not configured.";
    case "not_entitled":
      return "The provider account is not entitled to this data.";
    case "rate_limited":
      return "The provider rate limit was reached. Retry later.";
    case "not_covered":
      return "This listing is not covered by the provider.";
    case "invalid_response":
      return "The returned data did not match the requested company or screen requirements.";
    default:
      return "Data could not be loaded for this company.";
  }
}
