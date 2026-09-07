"use client";

import type {
  PersonalSecurityMasterSearchResultDto,
  PersonalSecurityMasterSnapshotReceiptDto,
} from "@research-cockpit/contracts";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import {
  createEmptyPersonalWatchlist,
  fetchMainPersonalWatchlist,
  fetchPersonalSecurityMasterStatus,
  membershipFromSearchResult,
  normalizeWatchlistNote,
  PersonalWorkspaceApiError,
  saveMainPersonalWatchlist,
  searchPersonalSecurities,
  type PersonalWatchlistMembership,
  type PersonalWatchlistPayload,
} from "@/lib/personal-workspace-api";

import { OwnerSessionPanel } from "./OwnerSessionPanel";

interface LoadedWorkspace {
  readonly snapshot: PersonalSecurityMasterSnapshotReceiptDto;
  readonly version: number;
  readonly watchlist: PersonalWatchlistPayload;
  readonly watchlistAvailable: boolean;
}

interface ReconciliationPreview {
  readonly matched: readonly PersonalWatchlistMembership[];
  readonly snapshotSha256: string;
  readonly unmatched: readonly PersonalWatchlistMembership[];
  readonly watchlistVersion: number;
}

type RequestState = "idle" | "loading" | "saving";

const SESSION_REVALIDATION_MESSAGE =
  "The owner session is no longer available. Revalidate the session before loading private data again.";

class WorkspaceSnapshotChangedError extends Error {}

export function SecurityDiscoveryWorkspace() {
  const [workspace, setWorkspace] = useState<LoadedWorkspace | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    readonly PersonalSecurityMasterSearchResultDto[]
  >([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchState, setSearchState] = useState<RequestState>("idle");
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [watchlistState, setWatchlistState] = useState<RequestState>("idle");
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationPreview, setReconciliationPreview] =
    useState<ReconciliationPreview | null>(null);
  const workspaceEpoch = useRef(0);
  const searchEpoch = useRef(0);

  const handleOwnerSessionChange = useCallback(
    async (active: boolean, signal: AbortSignal) => {
      const epoch = ++workspaceEpoch.current;
      searchEpoch.current += 1;
      setWorkspace(null);
      setQuery("");
      setResults([]);
      setHasSearched(false);
      setSearchState("idle");
      setSearchMessage(null);
      setWatchlistState("idle");
      setWatchlistMessage(null);
      setNoteDrafts({});
      setReconciling(false);
      setReconciliationPreview(null);
      if (!active) {
        setWorkspaceMessage((current) =>
          current === SESSION_REVALIDATION_MESSAGE ? current : null,
        );
        return false;
      }
      setWorkspaceMessage("Loading the local security universe and watchlist…");
      const [statusResult, watchlistResult] = await Promise.allSettled([
        fetchPersonalSecurityMasterStatus(signal),
        fetchMainPersonalWatchlist(signal),
      ]);
      if (signal.aborted || epoch !== workspaceEpoch.current) return false;
      if (statusResult.status === "rejected") {
        setWorkspaceMessage(
          "The local security search service is unavailable.",
        );
        return false;
      }
      if (
        watchlistResult.status === "rejected" &&
        isSessionUnavailable(watchlistResult.reason)
      ) {
        clearWorkspaceForSessionLoss();
        return false;
      }

      try {
        const status = statusResult.value;
        const watchlistAvailable = watchlistResult.status === "fulfilled";
        const record = watchlistAvailable ? watchlistResult.value : null;
        if (signal.aborted || epoch !== workspaceEpoch.current) return false;
        const watchlist =
          record?.payload ??
          createEmptyPersonalWatchlist(status.snapshot.snapshotSha256);
        setWorkspace({
          snapshot: status.snapshot,
          version: record?.version ?? 0,
          watchlist,
          watchlistAvailable,
        });
        setWorkspaceMessage(null);
        return true;
      } catch (error) {
        if (signal.aborted || epoch !== workspaceEpoch.current) return false;
        void error;
        setWorkspaceMessage(
          "The local security search service is unavailable.",
        );
        return false;
      }
    },
    [],
  );

  function clearWorkspaceForSessionLoss() {
    workspaceEpoch.current += 1;
    searchEpoch.current += 1;
    setWorkspace(null);
    setWorkspaceMessage(SESSION_REVALIDATION_MESSAGE);
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setSearchState("idle");
    setSearchMessage(null);
    setWatchlistState("idle");
    setWatchlistMessage(null);
    setNoteDrafts({});
    setReconciling(false);
    setReconciliationPreview(null);
  }

  async function runSearch() {
    const activeWorkspace = workspace;
    if (activeWorkspace === null) return;
    const normalized = query.trim().normalize("NFC");
    if (normalized.length === 0) {
      setSearchMessage("Enter a ticker or company name.");
      setResults([]);
      setHasSearched(false);
      return;
    }
    const request = ++searchEpoch.current;
    const epoch = workspaceEpoch.current;
    const controller = new AbortController();
    setSearchState("loading");
    setSearchMessage(null);
    setHasSearched(true);
    try {
      const response = await searchPersonalSecurities(
        normalized,
        controller.signal,
        15,
      );
      if (epoch !== workspaceEpoch.current || request !== searchEpoch.current) {
        return;
      }
      if (
        response.snapshot.snapshotSha256 !==
        activeWorkspace.snapshot.snapshotSha256
      ) {
        setResults([]);
        setHasSearched(false);
        setSearchMessage(
          "The local security snapshot changed. Revalidate the owner session and search again.",
        );
        return;
      }
      setQuery(normalized);
      setResults(response.results);
      setSearchMessage(
        response.results.length === 0
          ? `No local matches for “${normalized}”.`
          : `${String(response.totalMatches)} local match${response.totalMatches === 1 ? "" : "es"}.`,
      );
    } catch (error) {
      if (epoch !== workspaceEpoch.current || request !== searchEpoch.current) {
        return;
      }
      if (isSessionUnavailable(error)) {
        clearWorkspaceForSessionLoss();
        return;
      }
      setResults([]);
      setHasSearched(false);
      setSearchMessage(
        error instanceof PersonalWorkspaceApiError &&
          error.code === "invalid_request"
          ? "Use a ticker or company name of at most 128 characters."
          : "Search is temporarily unavailable.",
      );
    } finally {
      if (epoch === workspaceEpoch.current && request === searchEpoch.current) {
        setSearchState("idle");
      }
    }
  }

  async function persistWatchlist(
    next: PersonalWatchlistPayload,
    successMessage: string,
  ): Promise<boolean> {
    const activeWorkspace = workspace;
    if (
      activeWorkspace === null ||
      !activeWorkspace.watchlistAvailable ||
      watchlistState === "saving"
    ) {
      return false;
    }
    const epoch = workspaceEpoch.current;
    const controller = new AbortController();
    setWatchlistState("saving");
    setWatchlistMessage(null);
    try {
      const saved = await saveMainPersonalWatchlist(
        activeWorkspace.version,
        next,
        controller.signal,
      );
      if (epoch !== workspaceEpoch.current) return false;
      setWorkspace({
        ...activeWorkspace,
        version: saved.version,
        watchlist: saved.payload,
      });
      setReconciliationPreview(null);
      setWatchlistMessage(successMessage);
      return true;
    } catch (error) {
      if (epoch !== workspaceEpoch.current) return false;
      if (isSessionUnavailable(error)) {
        clearWorkspaceForSessionLoss();
      } else if (
        error instanceof PersonalWorkspaceApiError &&
        error.code === "conflict"
      ) {
        await reloadAfterConflict(activeWorkspace.snapshot, epoch);
      } else {
        setWatchlistMessage(
          "The watchlist change was not saved. Your prior saved list is unchanged.",
        );
      }
      return false;
    } finally {
      if (epoch === workspaceEpoch.current) setWatchlistState("idle");
    }
  }

  async function reloadAfterConflict(
    snapshot: PersonalSecurityMasterSnapshotReceiptDto,
    epoch: number,
  ) {
    try {
      const latest = await fetchMainPersonalWatchlist(
        new AbortController().signal,
      );
      if (epoch !== workspaceEpoch.current) return;
      setWorkspace({
        snapshot,
        version: latest?.version ?? 0,
        watchlist:
          latest?.payload ??
          createEmptyPersonalWatchlist(snapshot.snapshotSha256),
        watchlistAvailable: true,
      });
      setReconciliationPreview(null);
      setWatchlistMessage(
        "The watchlist changed in another tab. The latest saved version is now shown; try your change again.",
      );
    } catch (error) {
      if (epoch !== workspaceEpoch.current) return;
      if (isSessionUnavailable(error)) {
        clearWorkspaceForSessionLoss();
      } else {
        setWatchlistMessage(
          "The watchlist changed elsewhere and could not be reloaded.",
        );
      }
    }
  }

  function addResult(result: PersonalSecurityMasterSearchResultDto) {
    if (
      workspace === null ||
      !workspace.watchlistAvailable ||
      !hasCurrentWatchlistSnapshot(workspace)
    ) {
      return;
    }
    if (
      workspace.watchlist.memberships.some(
        (membership) => membership.listingId === result.listingId,
      )
    ) {
      setWatchlistMessage(`${result.symbol} is already in My Watchlist.`);
      return;
    }
    const membership = membershipFromSearchResult(result);
    void persistWatchlist(
      withMemberships(workspace.watchlist, [
        ...workspace.watchlist.memberships,
        membership,
      ]),
      `${result.symbol} was added to My Watchlist.`,
    );
  }

  function removeMembership(membership: PersonalWatchlistMembership) {
    if (
      workspace === null ||
      !workspace.watchlistAvailable ||
      !hasCurrentWatchlistSnapshot(workspace)
    ) {
      return;
    }
    void persistWatchlist(
      withMemberships(
        workspace.watchlist,
        workspace.watchlist.memberships.filter(
          (candidate) => candidate.listingId !== membership.listingId,
        ),
      ),
      `${membership.symbol} was removed from My Watchlist.`,
    );
  }

  function moveMembership(index: number, direction: -1 | 1) {
    if (
      workspace === null ||
      !workspace.watchlistAvailable ||
      !hasCurrentWatchlistSnapshot(workspace)
    ) {
      return;
    }
    const destination = index + direction;
    if (
      destination < 0 ||
      destination >= workspace.watchlist.memberships.length
    ) {
      return;
    }
    const memberships = [...workspace.watchlist.memberships];
    const selected = memberships[index];
    const displaced = memberships[destination];
    if (selected === undefined || displaced === undefined) return;
    memberships[index] = displaced;
    memberships[destination] = selected;
    void persistWatchlist(
      withMemberships(workspace.watchlist, memberships),
      `${selected.symbol} was reordered.`,
    );
  }

  async function saveNote(membership: PersonalWatchlistMembership) {
    if (
      workspace === null ||
      !workspace.watchlistAvailable ||
      !hasCurrentWatchlistSnapshot(workspace)
    ) {
      return;
    }
    const draft = noteDrafts[membership.listingId] ?? membership.note;
    const note = normalizeWatchlistNote(draft);
    if (note === null) {
      setWatchlistMessage(
        "Notes must be at most 2,000 characters and cannot contain control characters.",
      );
      return;
    }
    const memberships = workspace.watchlist.memberships.map((candidate) =>
      candidate.listingId === membership.listingId
        ? Object.freeze({ ...candidate, note })
        : candidate,
    );
    const saved = await persistWatchlist(
      withMemberships(workspace.watchlist, memberships),
      `${membership.symbol} note was saved.`,
    );
    if (saved) {
      setNoteDrafts((current) => {
        const next = { ...current };
        delete next[membership.listingId];
        return next;
      });
    }
  }

  async function reconcileStaleWatchlist() {
    const activeWorkspace = workspace;
    if (
      activeWorkspace === null ||
      !activeWorkspace.watchlistAvailable ||
      hasCurrentWatchlistSnapshot(activeWorkspace) ||
      reconciling ||
      watchlistState === "saving"
    ) {
      return;
    }

    const epoch = workspaceEpoch.current;
    const controller = new AbortController();
    setReconciling(true);
    setReconciliationPreview(null);
    setWatchlistMessage(null);
    try {
      const matched: PersonalWatchlistMembership[] = [];
      const unmatched: PersonalWatchlistMembership[] = [];
      for (const membership of activeWorkspace.watchlist.memberships) {
        const resolved = await resolveCurrentMembership(
          membership,
          activeWorkspace.snapshot.snapshotSha256,
          controller.signal,
        );
        if (epoch !== workspaceEpoch.current) return;
        if (resolved === null) unmatched.push(membership);
        else matched.push(resolved);
      }

      if (unmatched.length > 0) {
        setReconciliationPreview(
          Object.freeze({
            matched: Object.freeze(matched),
            snapshotSha256: activeWorkspace.snapshot.snapshotSha256,
            unmatched: Object.freeze(unmatched),
            watchlistVersion: activeWorkspace.version,
          }),
        );
        setWatchlistMessage(reconciliationPreviewMessage(unmatched));
        return;
      }
      const saved = await persistWatchlist(
        Object.freeze({
          ...activeWorkspace.watchlist,
          snapshotSha256: activeWorkspace.snapshot.snapshotSha256,
          memberships: Object.freeze(matched),
        }),
        reconciliationSuccessMessage(matched.length, []),
      );
      if (saved) retainNoteDrafts(matched);
    } catch (error) {
      if (epoch !== workspaceEpoch.current) return;
      if (isSessionUnavailable(error)) {
        clearWorkspaceForSessionLoss();
      } else {
        setWatchlistMessage(
          error instanceof WorkspaceSnapshotChangedError
            ? "The security snapshot changed again. Revalidate the owner session before reconciling."
            : "The watchlist could not be reconciled. No saved entries were changed.",
        );
      }
    } finally {
      if (epoch === workspaceEpoch.current) setReconciling(false);
    }
  }

  async function finishReconciliationWithRemovals() {
    const activeWorkspace = workspace;
    const preview = reconciliationPreview;
    if (
      activeWorkspace === null ||
      preview === null ||
      !activeWorkspace.watchlistAvailable ||
      hasCurrentWatchlistSnapshot(activeWorkspace) ||
      reconciling ||
      watchlistState === "saving"
    ) {
      return;
    }
    if (
      preview.snapshotSha256 !== activeWorkspace.snapshot.snapshotSha256 ||
      preview.watchlistVersion !== activeWorkspace.version
    ) {
      setReconciliationPreview(null);
      setWatchlistMessage(
        "The watchlist or security snapshot changed. Run reconciliation again; no changes were saved.",
      );
      return;
    }

    const epoch = workspaceEpoch.current;
    setReconciling(true);
    try {
      const saved = await persistWatchlist(
        Object.freeze({
          ...activeWorkspace.watchlist,
          snapshotSha256: preview.snapshotSha256,
          memberships: preview.matched,
        }),
        reconciliationSuccessMessage(preview.matched.length, preview.unmatched),
      );
      if (saved) retainNoteDrafts(preview.matched);
    } finally {
      if (epoch === workspaceEpoch.current) setReconciling(false);
    }
  }

  function retainNoteDrafts(
    memberships: readonly PersonalWatchlistMembership[],
  ) {
    const retained = new Set(
      memberships.map((membership) => membership.listingId),
    );
    setNoteDrafts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([listingId]) =>
          retained.has(listingId),
        ),
      ),
    );
  }

  const savedListingIds = new Set(
    workspace?.watchlist.memberships.map(
      (membership) => membership.listingId,
    ) ?? [],
  );
  const snapshotChanged =
    workspace !== null && !hasCurrentWatchlistSnapshot(workspace);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to security discovery
      </a>
      <header className="app-header personal-app-header">
        <Link className="wordmark" href="/discover">
          <span>RC</span> Research Cockpit
        </Link>
        <div className="mode-chips" aria-label="Data mode">
          <span className="personal-dossier-chip">Personal · local only</span>
        </div>
      </header>
      <div className="personal-disclosure" role="note">
        <strong>Personal workspace.</strong> Search and watchlists stay on this
        machine. No browser storage or synthetic fallback is used.
      </div>
      <main className="research-shell discovery-shell" id="main-content">
        <OwnerSessionPanel onSessionChange={handleOwnerSessionChange} />
        {workspace === null ? (
          <section className="personal-locked-state" aria-live="polite">
            <p className="eyebrow">Security discovery locked</p>
            <h1>Start or revalidate the owner session to search companies.</h1>
            <p>
              {workspaceMessage ??
                "Your local universe and durable watchlist load only after owner access is confirmed."}
            </p>
          </section>
        ) : (
          <>
            <section
              className="discovery-hero"
              aria-labelledby="discover-title"
            >
              <div>
                <p className="eyebrow">Discover</p>
                <h1 id="discover-title">
                  Find a company. Keep the ones that matter.
                </h1>
                <p>
                  Search{" "}
                  {formatCount(
                    workspace.snapshot.coverage.activeEligibleSecurities,
                  )}{" "}
                  active U.S.-listed stocks and ADRs in your admitted local
                  snapshot.
                </p>
              </div>
              <dl className="discovery-snapshot-card">
                <div>
                  <dt>Universe</dt>
                  <dd>
                    {formatCount(
                      workspace.snapshot.coverage.activeEligibleSecurities,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>As of</dt>
                  <dd>{formatDate(workspace.snapshot.asOf)}</dd>
                </div>
              </dl>
            </section>

            <section
              className="security-search-panel"
              aria-labelledby="search-title"
            >
              <div className="discovery-section-heading">
                <div>
                  <p className="eyebrow">Local security search</p>
                  <h2 id="search-title">Ticker or company name</h2>
                </div>
                <span>Symbols, former symbols, and names</span>
              </div>
              <form
                className="security-search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runSearch();
                }}
              >
                <label htmlFor="security-query">Search securities</label>
                <div>
                  <input
                    autoComplete="off"
                    id="security-query"
                    maxLength={128}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Try a ticker or company name"
                    spellCheck={false}
                    value={query}
                  />
                  <button
                    className="primary-action compact-action"
                    disabled={searchState === "loading"}
                    type="submit"
                  >
                    {searchState === "loading" ? "Searching…" : "Search"}
                  </button>
                </div>
              </form>
              <p className="discovery-status" aria-live="polite">
                {searchMessage ??
                  "Search stays inside the loaded local snapshot."}
              </p>
              {results.length > 0 && (
                <ul
                  className="security-result-list"
                  aria-label="Security search results"
                >
                  {results.map((result) => {
                    const saved = savedListingIds.has(result.listingId);
                    return (
                      <li key={result.listingId}>
                        <SecurityIdentity membership={result} />
                        <button
                          className="secondary-action compact-action"
                          disabled={
                            saved ||
                            !workspace.watchlistAvailable ||
                            watchlistState === "saving" ||
                            reconciling ||
                            snapshotChanged
                          }
                          onClick={() => addResult(result)}
                          type="button"
                        >
                          {saved ? "In watchlist" : "Add"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {hasSearched &&
                results.length === 0 &&
                searchState !== "loading" && (
                  <div className="discovery-empty-state">
                    <strong>No results to show</strong>
                    <span>Try a shorter ticker or a broader company name.</span>
                  </div>
                )}
            </section>

            <section
              className="watchlist-panel"
              aria-labelledby="watchlist-title"
            >
              <div className="discovery-section-heading">
                <div>
                  <p className="eyebrow">Durable local list</p>
                  <h2 id="watchlist-title">{workspace.watchlist.name}</h2>
                </div>
                <span>
                  {String(workspace.watchlist.memberships.length)} saved securit
                  {workspace.watchlist.memberships.length === 1 ? "y" : "ies"}
                </span>
              </div>
              {snapshotChanged && (
                <div className="discovery-warning" role="alert">
                  <p>
                    This watchlist was saved against an older security snapshot.
                    All changes are paused. Reconcile re-resolves every saved
                    listing against the current snapshot and preserves notes and
                    order for matches. If anything is unmatched, the first pass
                    saves nothing and shows a preview that requires a separate
                    removal confirmation.
                  </p>
                  {reconciliationPreview === null ? (
                    <button
                      className="secondary-action compact-action snapshot-reconciliation-action"
                      disabled={reconciling || watchlistState === "saving"}
                      onClick={() => void reconcileStaleWatchlist()}
                      type="button"
                    >
                      {reconciling ? "Reconciling…" : "Reconcile watchlist"}
                    </button>
                  ) : (
                    <div className="snapshot-reconciliation-preview">
                      <strong>Preview only — no changes were saved.</strong>
                      <span>Unmatched saved symbols:</span>
                      <ul>
                        {reconciliationPreview.unmatched.map((membership) => (
                          <li key={membership.listingId}>
                            {membership.symbol}
                          </li>
                        ))}
                      </ul>
                      <div>
                        <button
                          className="secondary-action compact-action snapshot-reconciliation-action"
                          disabled={reconciling || watchlistState === "saving"}
                          onClick={() =>
                            void finishReconciliationWithRemovals()
                          }
                          type="button"
                        >
                          {reconciling
                            ? "Finishing reconciliation…"
                            : `Remove ${String(reconciliationPreview.unmatched.length)} unmatched and finish reconciliation`}
                        </button>
                        <button
                          className="text-button"
                          disabled={reconciling || watchlistState === "saving"}
                          onClick={() => {
                            setReconciliationPreview(null);
                            setWatchlistMessage(
                              "Reconciliation preview cancelled. No changes were saved.",
                            );
                          }}
                          type="button"
                        >
                          Cancel preview
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!workspace.watchlistAvailable && (
                <p className="discovery-warning" role="alert">
                  My Watchlist could not be loaded. Security search is still
                  available, but watchlist changes are disabled.
                </p>
              )}
              <p className="discovery-status" aria-live="polite">
                {!workspace.watchlistAvailable
                  ? "My Watchlist is read-only until its saved record can be loaded."
                  : reconciling
                    ? "Re-resolving saved listings against the current local snapshot…"
                    : watchlistState === "saving"
                      ? "Saving to the encrypted local vault…"
                      : (watchlistMessage ??
                        "Changes survive browser and API restarts.")}
              </p>
              {!workspace.watchlistAvailable ? (
                <div className="discovery-empty-state watchlist-empty-state">
                  <strong>My Watchlist is unavailable.</strong>
                  <span>
                    Search is ready. Revalidate the owner session before saving
                    watchlist changes.
                  </span>
                </div>
              ) : workspace.watchlist.memberships.length === 0 ? (
                <div className="discovery-empty-state watchlist-empty-state">
                  <strong>Your watchlist is empty.</strong>
                  <span>
                    Search above and add the first company you want to follow.
                  </span>
                </div>
              ) : (
                <ol className="watchlist-members">
                  {workspace.watchlist.memberships.map((membership, index) => (
                    <li key={membership.listingId}>
                      <div className="watchlist-member-heading">
                        <span className="watchlist-position">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <SecurityIdentity membership={membership} />
                        <div className="watchlist-actions">
                          <button
                            aria-label={`Move ${membership.symbol} up`}
                            disabled={
                              !workspace.watchlistAvailable ||
                              snapshotChanged ||
                              index === 0 ||
                              watchlistState === "saving" ||
                              reconciling
                            }
                            onClick={() => moveMembership(index, -1)}
                            type="button"
                          >
                            ↑
                          </button>
                          <button
                            aria-label={`Move ${membership.symbol} down`}
                            disabled={
                              !workspace.watchlistAvailable ||
                              snapshotChanged ||
                              index ===
                                workspace.watchlist.memberships.length - 1 ||
                              watchlistState === "saving" ||
                              reconciling
                            }
                            onClick={() => moveMembership(index, 1)}
                            type="button"
                          >
                            ↓
                          </button>
                          <button
                            className="watchlist-remove"
                            disabled={
                              !workspace.watchlistAvailable ||
                              snapshotChanged ||
                              watchlistState === "saving" ||
                              reconciling
                            }
                            onClick={() => removeMembership(membership)}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="watchlist-note-row">
                        <label htmlFor={`note-${membership.listingId}`}>
                          Research note
                        </label>
                        <textarea
                          id={`note-${membership.listingId}`}
                          disabled={
                            !workspace.watchlistAvailable ||
                            snapshotChanged ||
                            watchlistState === "saving" ||
                            reconciling
                          }
                          maxLength={2_000}
                          onChange={(event) =>
                            setNoteDrafts((current) => ({
                              ...current,
                              [membership.listingId]: event.target.value,
                            }))
                          }
                          placeholder="Why is this company on the list?"
                          rows={2}
                          value={
                            noteDrafts[membership.listingId] ?? membership.note
                          }
                        />
                        <button
                          className="text-button"
                          disabled={
                            !workspace.watchlistAvailable ||
                            snapshotChanged ||
                            watchlistState === "saving" ||
                            reconciling
                          }
                          onClick={() => void saveNote(membership)}
                          type="button"
                        >
                          Save note
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
      <footer className="app-footer">
        <span>Research Cockpit · personal security discovery</span>
        <span>Owner-only · durable local watchlist</span>
        <code>private no-store</code>
      </footer>
    </>
  );
}

function SecurityIdentity({
  membership,
}: {
  membership:
    PersonalSecurityMasterSearchResultDto | PersonalWatchlistMembership;
}) {
  return (
    <div className="security-identity">
      <strong>{membership.symbol}</strong>
      <div>
        <b>{membership.issuerName}</b>
        <span>
          {membership.securityName} · {membership.exchangeMic} ·{" "}
          {formatInstrumentType(membership.instrumentType)}
        </span>
      </div>
    </div>
  );
}

function hasCurrentWatchlistSnapshot(workspace: LoadedWorkspace): boolean {
  return (
    workspace.watchlist.snapshotSha256 === workspace.snapshot.snapshotSha256
  );
}

async function resolveCurrentMembership(
  membership: PersonalWatchlistMembership,
  expectedSnapshotSha256: string,
  signal: AbortSignal,
): Promise<PersonalWatchlistMembership | null> {
  const queries = reconciliationQueries(membership);
  for (const query of queries) {
    const response = await searchPersonalSecurities(query, signal, 25);
    if (response.snapshot.snapshotSha256 !== expectedSnapshotSha256) {
      throw new WorkspaceSnapshotChangedError();
    }
    const match = response.results.find(
      (candidate) => candidate.listingId === membership.listingId,
    );
    if (match !== undefined) {
      return Object.freeze({
        ...membershipFromSearchResult(match),
        note: membership.note,
      });
    }
  }
  return null;
}

function reconciliationQueries(
  membership: PersonalWatchlistMembership,
): readonly string[] {
  const queries = [
    membership.symbol,
    membership.issuerName,
    membership.securityName,
    membership.shareClassName,
  ];
  return [
    ...new Set(
      queries
        .map((query) => query.trim().normalize("NFC"))
        .filter((query) => query.length > 0 && [...query].length <= 128),
    ),
  ];
}

function reconciliationPreviewMessage(
  unmatched: readonly PersonalWatchlistMembership[],
): string {
  const symbols = unmatched.map((membership) => membership.symbol);
  const visibleSymbols = symbols.slice(0, 5).join(", ");
  const remainder =
    symbols.length > 5 ? ` and ${String(symbols.length - 5)} more` : "";
  return `Reconciliation preview: ${String(unmatched.length)} unmatched ${unmatched.length === 1 ? "entry" : "entries"} (${visibleSymbols}${remainder}). No changes were saved; confirm removal to finish.`;
}

function reconciliationSuccessMessage(
  retainedCount: number,
  removed: readonly PersonalWatchlistMembership[],
): string {
  if (removed.length === 0) {
    return `Watchlist reconciled to the current snapshot. ${String(retainedCount)} saved ${retainedCount === 1 ? "entry was" : "entries were"} retained; no entries were removed.`;
  }
  const symbols = removed.map((membership) => membership.symbol);
  const visibleSymbols = symbols.slice(0, 5).join(", ");
  const remainder =
    symbols.length > 5 ? ` and ${String(symbols.length - 5)} more` : "";
  return `Watchlist reconciled to the current snapshot. ${String(retainedCount)} ${retainedCount === 1 ? "entry was" : "entries were"} retained; ${String(removed.length)} unmatched ${removed.length === 1 ? "entry was" : "entries were"} removed (${visibleSymbols}${remainder}).`;
}

function isSessionUnavailable(error: unknown): boolean {
  return (
    error instanceof PersonalWorkspaceApiError &&
    error.code === "session_unavailable"
  );
}

function withMemberships(
  watchlist: PersonalWatchlistPayload,
  memberships: readonly PersonalWatchlistMembership[],
): PersonalWatchlistPayload {
  return Object.freeze({
    ...watchlist,
    memberships: Object.freeze(memberships),
  });
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatInstrumentType(value: "adr" | "common_stock"): string {
  return value === "adr" ? "ADR" : "Common stock";
}
