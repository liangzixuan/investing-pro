"use client";

import {
  PERSONAL_WATCHLIST_FILINGS_LIMITS,
  type PersonalWatchlistFilingsResponseDto,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";

import { fetchPersonalWatchlistFilings } from "@/lib/personal-watchlist-filings-api";
import {
  PersonalWorkspaceApiError,
  type PersonalWatchlistMembership,
} from "@/lib/personal-workspace-api";

export interface PersonalWatchlistFilingsProps {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly watchlistVersion: number;
  readonly memberships: readonly PersonalWatchlistMembership[];
  readonly enabled: boolean;
  readonly onOpenResearch: (membership: PersonalWatchlistMembership) => void;
  readonly onSessionUnavailable: () => void;
}

const pageSize = 25;
const selectionLimit = PERSONAL_WATCHLIST_FILINGS_LIMITS.selectedListings;
const initialMessage =
  "Select saved listings, then load their recent SEC filings.";
const statusLabels = {
  available: "Checked",
  not_covered: "Not covered",
  rate_limited: "Rate limited",
  upstream_unavailable: "SEC unavailable",
  invalid_response: "Invalid source response",
};

export function PersonalWatchlistFilings({
  catalogSnapshotSha256,
  watchlistVersion,
  memberships,
  enabled,
  onOpenResearch,
  onSessionUnavailable,
}: PersonalWatchlistFilingsProps) {
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [lookbackDays, setLookbackDays] = useState<7 | 30 | 90>(30);
  const [response, setResponse] =
    useState<PersonalWatchlistFilingsResponseDto | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [page, setPage] = useState(0);
  const [formFilter, setFormFilter] = useState("all");
  const [selectionQuery, setSelectionQuery] = useState("");
  const [selectionPage, setSelectionPage] = useState(0);
  const epoch = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const sessionCallback = useRef(onSessionUnavailable);
  sessionCallback.current = onSessionUnavailable;
  const context = JSON.stringify([
    catalogSnapshotSha256,
    watchlistVersion,
    enabled,
    memberships,
  ]);
  const activeContext = useRef(context);
  activeContext.current = context;
  const [loadedContext, setLoadedContext] = useState(context);

  useEffect(() => {
    epoch.current += 1;
    controller.current?.abort();
    controller.current = null;
    setResponse(null);
    setRunning(false);
    setPage(0);
    setFormFilter("all");
    setSelectionQuery("");
    setSelectionPage(0);
    setLookbackDays(30);
    setSelectedIds(
      memberships.length <= selectionLimit
        ? memberships.map((member) => member.listingId)
        : [],
    );
    setLoadedContext(context);
    setMessage(initialMessage);
    return () => {
      epoch.current += 1;
      controller.current?.abort();
    };
  }, [context]);

  function invalidate(nextMessage: string) {
    epoch.current += 1;
    controller.current?.abort();
    controller.current = null;
    setResponse(null);
    setRunning(false);
    setPage(0);
    setFormFilter("all");
    setMessage(nextMessage);
  }

  function changeSelection(ids: readonly string[]) {
    if (ids.length > selectionLimit) return;
    invalidate(
      "Selection changed. Load recent filings to check these listings.",
    );
    setSelectedIds(ids);
  }

  async function load() {
    if (
      !enabled ||
      watchlistVersion < 1 ||
      selectedIds.length < 1 ||
      selectedIds.length > selectionLimit ||
      loadedContext !== context
    )
      return;
    invalidate("Checking SEC filing history…");
    const operationEpoch = epoch.current;
    const operationContext = context;
    const operationController = new AbortController();
    controller.current = operationController;
    setRunning(true);
    try {
      const result = await fetchPersonalWatchlistFilings(
        {
          schemaVersion: "1.0.0",
          catalogSnapshotSha256,
          watchlistVersion,
          listingIds: selectedIds,
          lookbackDays,
        },
        operationController.signal,
      );
      if (
        operationEpoch !== epoch.current ||
        operationController.signal.aborted ||
        activeContext.current !== operationContext
      )
        return;
      if (
        result.totalWatchlistListings !== memberships.length ||
        !result.issuers.every((issuer) =>
          issuer.listings.every((listing) =>
            memberships.some(
              (member) =>
                member.listingId === listing.listingId &&
                member.symbol === listing.symbol &&
                member.issuerName === listing.issuerName,
            ),
          ),
        )
      )
        throw new PersonalWorkspaceApiError("invalid_response");
      setResponse(result);
      setMessage(
        "Recent filing history loaded. Reload to request another observation.",
      );
    } catch (error) {
      if (
        operationEpoch !== epoch.current ||
        operationController.signal.aborted ||
        activeContext.current !== operationContext
      )
        return;
      const code =
        error instanceof PersonalWorkspaceApiError ? error.code : "unavailable";
      setResponse(null);
      if (code === "session_unavailable") {
        setSelectedIds([]);
        setMessage(
          "The owner session expired. Revalidate it to check recent filings.",
        );
        sessionCallback.current();
      } else if (code === "not_configured")
        setMessage(
          "SEC contact setup is required. Configure the SEC User-Agent with a contact email in the local startup settings.",
        );
      else if (code === "conflict")
        setMessage(
          "The saved watchlist or catalog changed. Revalidate the owner session to reload My Watchlist, then check recent filings.",
        );
      else if (code === "rate_limited")
        setMessage(
          "SEC requests are rate limited. Try loading recent filings again later.",
        );
      else
        setMessage(
          "Recent filings could not be loaded. Try again after checking the local workspace and SEC source setup.",
        );
    } finally {
      if (
        operationEpoch === epoch.current &&
        activeContext.current === operationContext
      ) {
        setRunning(false);
        controller.current = null;
      }
    }
  }

  const current = loadedContext === context && enabled ? response : null;
  const selected = new Set(loadedContext === context ? selectedIds : []);
  const matchingMembers = memberships.filter((member) =>
    `${member.symbol} ${member.issuerName}`
      .toLocaleLowerCase("en-US")
      .includes(selectionQuery.trim().toLocaleLowerCase("en-US")),
  );
  const visibleMembers = matchingMembers.slice(
    selectionPage * 50,
    (selectionPage + 1) * 50,
  );
  const filtered =
    current?.filings.filter(
      (filing) =>
        formFilter === "all" ||
        (formFilter === "periodic"
          ? /^(?:10-K|10-Q|20-F|40-F)(?:\/A)?$/u
          : /^(?:8-K|6-K)(?:\/A)?$/u
        ).test(filing.form),
    ) ?? [];
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const checkedIssuers =
    current?.issuers.filter((issuer) => issuer.status === "available").length ??
    0;
  const failedListings =
    current?.issuers
      .filter((issuer) => issuer.status !== "available")
      .reduce((count, issuer) => count + issuer.listings.length, 0) ?? 0;

  return (
    <section
      className="watchlist-panel personal-watchlist-filings"
      aria-labelledby="watchlist-filings-title"
    >
      <div className="discovery-section-heading">
        <div>
          <p className="eyebrow">Watchlist updates</p>
          <h2 id="watchlist-filings-title">Recent SEC filings</h2>
        </div>
        <span>Filed reports and amendments</span>
      </div>
      <p>
        Check filing metadata for up to {String(selectionLimit)} saved listings
        at a time. Dates show when reports were filed with the SEC.
      </p>
      {!enabled && (
        <p className="discovery-warning">
          Load a current saved watchlist and validate the owner session to check
          filings.
        </p>
      )}
      {memberships.length === 0 ? (
        <p className="discovery-empty-state">
          Add companies to My Watchlist to follow their recent filings.
        </p>
      ) : (
        <>
          <details
            className="watchlist-filings-selection"
            open={memberships.length > selectionLimit}
          >
            <summary>
              {String(selected.size)} of {String(memberships.length)} saved
              listings selected
            </summary>
            <div className="personal-stock-screener-run-actions">
              <button
                className="secondary-action compact-action"
                type="button"
                disabled={!enabled}
                onClick={() =>
                  changeSelection(
                    memberships
                      .slice(0, selectionLimit)
                      .map((member) => member.listingId),
                  )
                }
              >
                {memberships.length > selectionLimit
                  ? "Select first 20 saved listings"
                  : "Select all saved listings"}
              </button>
              <button
                className="text-button"
                type="button"
                disabled={!enabled}
                onClick={() => changeSelection([])}
              >
                Clear filing selection
              </button>
            </div>
            <label className="watchlist-filings-filter">
              Find a saved listing
              <input
                aria-label="Find a saved filing listing"
                type="search"
                value={selectionQuery}
                maxLength={120}
                onChange={(event) => {
                  setSelectionQuery(event.target.value);
                  setSelectionPage(0);
                }}
              />
            </label>
            <div className="watchlist-filings-choices">
              {visibleMembers.map((member) => (
                <label key={member.listingId}>
                  <input
                    type="checkbox"
                    aria-label={`Check filings for ${member.symbol}`}
                    checked={selected.has(member.listingId)}
                    disabled={
                      !enabled ||
                      (!selected.has(member.listingId) &&
                        selected.size >= selectionLimit)
                    }
                    onChange={(event) =>
                      changeSelection(
                        event.target.checked
                          ? [...selectedIds, member.listingId]
                          : selectedIds.filter((id) => id !== member.listingId),
                      )
                    }
                  />
                  <span>
                    <strong>{member.symbol}</strong> · {member.issuerName}
                  </span>
                </label>
              ))}
            </div>
            <nav
              className="personal-stock-screener-pagination"
              aria-label="Saved filing selection pages"
            >
              <button
                className="text-button"
                type="button"
                disabled={selectionPage === 0}
                onClick={() => setSelectionPage(Math.max(0, selectionPage - 1))}
              >
                Previous saved listings
              </button>
              <span>
                {String(
                  matchingMembers.length === 0 ? 0 : selectionPage * 50 + 1,
                )}
                –
                {String(
                  Math.min((selectionPage + 1) * 50, matchingMembers.length),
                )}{" "}
                of {String(matchingMembers.length)} matching saved listings
              </span>
              <button
                className="text-button"
                type="button"
                disabled={(selectionPage + 1) * 50 >= matchingMembers.length}
                onClick={() => setSelectionPage(selectionPage + 1)}
              >
                Next saved listings
              </button>
            </nav>
            <p>
              {String(memberships.length - selected.size)} saved listings will
              not be requested. Selection is limited to {String(selectionLimit)}
              .
            </p>
          </details>
          <div className="watchlist-filings-controls">
            <label>
              Filing date range
              <select
                aria-label="Filing date range"
                value={lookbackDays}
                disabled={!enabled}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (next === 7 || next === 30 || next === 90) {
                    invalidate(
                      "Date range changed. Load recent filings to check this period.",
                    );
                    setLookbackDays(next);
                  }
                }}
              >
                {PERSONAL_WATCHLIST_FILINGS_LIMITS.lookbackDays.map((days) => (
                  <option key={days} value={days}>
                    Past {String(days)} days
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-action compact-action"
              type="button"
              disabled={
                !enabled ||
                running ||
                selected.size === 0 ||
                watchlistVersion < 1
              }
              onClick={() => void load()}
            >
              {running
                ? "Checking recent filings…"
                : current
                  ? "Reload recent filings"
                  : "Load recent filings"}
            </button>
            {running && (
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  invalidate(
                    "Filing check cancelled. Load recent filings to try again.",
                  )
                }
              >
                Cancel filing check
              </button>
            )}
          </div>
        </>
      )}
      <p className="discovery-status" aria-live="polite">
        {loadedContext === context ? message : initialMessage}
      </p>
      {current && (
        <div className="watchlist-filings-results">
          <dl className="financial-screen-counts">
            <div>
              <dt>Issuers checked</dt>
              <dd>
                {String(checkedIssuers)} / {String(current.issuers.length)}
              </dd>
            </div>
            <div>
              <dt>Listings unavailable</dt>
              <dd>{String(failedListings)}</dd>
            </div>
            <div>
              <dt>Listings not requested</dt>
              <dd>
                {String(
                  current.totalWatchlistListings -
                    current.selectedListingIds.length,
                )}
              </dd>
            </div>
            <div>
              <dt>Matching filings</dt>
              <dd>{String(current.matchingFilings)}</dd>
            </div>
          </dl>
          <p>
            Filing dates {current.fromDate} through {current.throughDate}. Check
            started {current.fetchedAt.replace("T", " ").replace(/Z$/u, " UTC")}
            .
          </p>
          {failedListings > 0 && (
            <p className="discovery-warning" role="status">
              Coverage is partial. Unavailable listings have no verified filing
              result for this check.
            </p>
          )}
          {current.truncated && (
            <p className="discovery-warning">
              This result is truncated. Showing {String(current.filings.length)}{" "}
              of {String(current.matchingFilings)} matching filings; use fewer
              listings or a shorter date range.
            </p>
          )}
          <details>
            <summary>SEC source coverage and limits</summary>
            <p>
              This check reads recent submission history only. Older SEC history
              files are not loaded; an empty result does not rule out filings
              outside that history.
            </p>
            <ul>
              {current.issuers.map((issuer) => (
                <li key={issuer.cik}>
                  <strong>
                    {issuer.listings
                      .map((listing) => listing.symbol)
                      .join(", ")}
                  </strong>
                  : {statusLabels[issuer.status]};{" "}
                  {issuer.status === "available"
                    ? `${String(issuer.matchingFilings)} matching filings.`
                    : "Filing coverage is unknown."}{" "}
                  {issuer.status !== "available"
                    ? "Older history availability could not be checked."
                    : issuer.olderHistoryAvailable
                      ? "Older SEC history is available but was not loaded."
                      : "No older history file was advertised."}{" "}
                  {issuer.truncated ? "Issuer results are truncated. " : ""}
                  <a
                    href={issuer.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    SEC submission metadata
                  </a>
                  <span>
                    {" "}
                    · Observed{" "}
                    {issuer.fetchedAt.replace("T", " ").replace(/Z$/u, " UTC")}
                  </span>
                </li>
              ))}
            </ul>
          </details>
          {current.filings.length === 0 ? (
            <p className="discovery-empty-state">
              {checkedIssuers === 0
                ? "No issuer history could be checked. Review source coverage and try again."
                : failedListings > 0
                  ? "No matching filings in the available issuer histories. Other selected listings remain unavailable."
                  : "No matching filings in the checked recent issuer histories for this date range."}
            </p>
          ) : (
            <>
              <label className="watchlist-filings-filter">
                Show forms
                <select
                  aria-label="Filing form filter"
                  value={formFilter}
                  onChange={(event) => {
                    setFormFilter(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">All forms</option>
                  <option value="periodic">Periodic reports</option>
                  <option value="current">Current reports</option>
                </select>
              </label>
              {filtered.length === 0 ? (
                <p>No loaded filings match this form filter.</p>
              ) : (
                <ol
                  className="watchlist-filings-list"
                  start={page * pageSize + 1}
                >
                  {pageRows.map((filing) => (
                    <li key={`${filing.cik}:${filing.accessionNumber}`}>
                      <div>
                        <span className="watchlist-filing-date">
                          {filing.filingDate}
                        </span>
                        <strong>{filing.form}</strong>
                        <a
                          href={filing.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View SEC filing
                        </a>
                      </div>
                      <p>
                        {filing.listings
                          .map((listing) => listing.issuerName)
                          .filter(
                            (name, index, all) => all.indexOf(name) === index,
                          )
                          .join(" · ")}
                      </p>
                      <div className="watchlist-filings-research">
                        {filing.listings.map((listing) => (
                          <button
                            className="text-button"
                            type="button"
                            key={listing.listingId}
                            onClick={() => {
                              const member = memberships.find(
                                (candidate) =>
                                  candidate.listingId === listing.listingId &&
                                  candidate.symbol === listing.symbol &&
                                  candidate.issuerName === listing.issuerName,
                              );
                              if (member) onOpenResearch(member);
                            }}
                          >
                            Open {listing.symbol}
                          </button>
                        ))}
                        {filing.reportDate && (
                          <span>Report date {filing.reportDate}</span>
                        )}
                        <span>Accession {filing.accessionNumber}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <nav
                className="personal-stock-screener-pagination"
                aria-label="Recent filing pages"
              >
                <button
                  className="text-button"
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage(Math.max(0, page - 1))}
                >
                  Previous filing page
                </button>
                <span>
                  {String(filtered.length === 0 ? 0 : page * pageSize + 1)}–
                  {String(Math.min((page + 1) * pageSize, filtered.length))} of{" "}
                  {String(filtered.length)} loaded filings
                </span>
                <button
                  className="text-button"
                  type="button"
                  disabled={(page + 1) * pageSize >= filtered.length}
                  onClick={() => setPage(page + 1)}
                >
                  Next filing page
                </button>
              </nav>
            </>
          )}
        </div>
      )}
    </section>
  );
}
