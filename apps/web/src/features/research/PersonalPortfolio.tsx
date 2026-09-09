"use client";

import {
  isPersonalPortfolioMoney,
  isPersonalPortfolioPayload,
  isPersonalPortfolioShares,
  projectPersonalPortfolioLedger,
  type PersonalMarketDataIdentityDto,
  type PersonalMarketDataQuoteDto,
  type PersonalPortfolioHolding,
  type PersonalPortfolioIdentity,
  type PersonalPortfolioPayload,
  type PersonalPortfolioStoredPayload,
  type PersonalPortfolioLedgerPayload,
} from "@research-cockpit/contracts";
import { calculatePersonalPortfolioOverview } from "@research-cockpit/personal-market-analytics";
import { useEffect, useRef, useState } from "react";

import {
  fetchPersonalPortfolio,
  savePersonalPortfolio,
} from "@/lib/personal-portfolio-api";
import {
  fetchPersonalMarketOverview,
  PersonalWorkspaceApiError,
  searchPersonalSecurities,
} from "@/lib/personal-workspace-api";
import { PersonalPortfolioLedgerEditor } from "./PersonalPortfolioLedgerEditor";

export interface PersonalPortfolioProps {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly enabled: boolean;
  readonly selectedListing: PersonalPortfolioIdentity | null;
  readonly onSessionUnavailable: () => void;
  readonly onOpenResearch?: (identity: PersonalPortfolioIdentity) => void;
}

type QuoteObservation = Readonly<{
  security: PersonalMarketDataIdentityDto;
  quote: PersonalMarketDataQuoteDto;
}>;
type Operation = "load" | "save" | "prices" | "reconcile" | null;
type Reconciliation = Readonly<{
  payload: PersonalPortfolioStoredPayload;
  identities: readonly PersonalPortfolioIdentity[];
  unmatched: readonly string[];
}>;

export function PersonalPortfolio({
  catalogSnapshotSha256,
  enabled,
  selectedListing,
  onSessionUnavailable,
  onOpenResearch,
}: PersonalPortfolioProps) {
  const [draft, setDraft] = useState<PersonalPortfolioStoredPayload | null>(
    null,
  );
  const [saved, setSaved] = useState<PersonalPortfolioStoredPayload | null>(
    null,
  );
  const [openingDate, setOpeningDate] = useState(utcDate());
  const [pendingLedgerEdits, setPendingLedgerEdits] = useState(false);
  const [version, setVersion] = useState<number | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [message, setMessage] = useState(
    "Load My Portfolio to view or create your holdings snapshot.",
  );
  const [quotes, setQuotes] = useState<readonly QuoteObservation[]>([]);
  const [priceErrors, setPriceErrors] = useState<
    readonly Readonly<{ listingId: string; message: string }>[]
  >([]);
  const [evaluatedAt, setEvaluatedAt] = useState(new Date().toISOString());
  const [preview, setPreview] = useState<Reconciliation | null>(null);
  const [conflicted, setConflicted] = useState(false);
  const epoch = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const retry = useRef<Readonly<{
    body: string;
    version: number | null;
    key: string;
  }> | null>(null);
  const callback = useRef(onSessionUnavailable);
  callback.current = onSessionUnavailable;
  const context = JSON.stringify([enabled, catalogSnapshotSha256]);
  const liveContext = useRef(context);
  liveContext.current = context;
  const previousCatalog = useRef(catalogSnapshotSha256);

  function invalidate() {
    epoch.current += 1;
    controller.current?.abort();
    controller.current = null;
    setOperation(null);
    setQuotes([]);
    setPriceErrors([]);
    setPreview(null);
  }

  function clearPrivateState() {
    invalidate();
    setDraft(null);
    setSaved(null);
    setVersion(null);
    setOpeningDate(utcDate());
    setPendingLedgerEdits(false);
    setConflicted(false);
    retry.current = null;
  }

  useEffect(() => {
    clearPrivateState();
    setMessage(
      enabled
        ? "Load My Portfolio to view or create your holdings snapshot."
        : "Validate the owner session to load My Portfolio.",
    );
    return () => {
      epoch.current += 1;
      controller.current?.abort();
    };
  }, [enabled]);

  useEffect(() => {
    if (previousCatalog.current !== catalogSnapshotSha256) {
      previousCatalog.current = catalogSnapshotSha256;
      invalidate();
      setMessage(
        "The catalog changed. Your holdings are preserved; preview identity reconciliation before saving or pricing.",
      );
    }
  }, [catalogSnapshotSha256]);

  useEffect(() => {
    const timer = setInterval(
      () => setEvaluatedAt(new Date().toISOString()),
      60_000,
    );
    return () => clearInterval(timer);
  }, []);

  function start(next: Exclude<Operation, null>) {
    invalidate();
    const operationEpoch = epoch.current;
    const operationContext = context;
    const nextController = new AbortController();
    controller.current = nextController;
    setOperation(next);
    return {
      signal: nextController.signal,
      current: () =>
        epoch.current === operationEpoch &&
        liveContext.current === operationContext &&
        !nextController.signal.aborted,
      finish: () => {
        if (
          epoch.current === operationEpoch &&
          liveContext.current === operationContext
        ) {
          controller.current = null;
          setOperation(null);
        }
      },
    };
  }

  function failure(error: unknown, fallback: string) {
    const code =
      error instanceof PersonalWorkspaceApiError ? error.code : "unavailable";
    if (code === "session_unavailable") {
      clearPrivateState();
      setMessage(
        "The owner session expired. Revalidate it to load My Portfolio.",
      );
      callback.current();
    } else if (code === "conflict") {
      setConflicted(true);
      setMessage(
        "The saved portfolio or catalog changed. Your edits are preserved. Discard edits and reload the saved portfolio before saving again.",
      );
    } else setMessage(fallback);
  }

  async function load() {
    if (!enabled) return;
    const request = start("load");
    setMessage("Loading encrypted holdings…");
    try {
      const record = await fetchPersonalPortfolio(request.signal);
      if (!request.current()) return;
      const payload = record?.payload ?? emptyPortfolio(catalogSnapshotSha256);
      setDraft(payload);
      setSaved(payload);
      setPendingLedgerEdits(false);
      setVersion(record?.version ?? null);
      setConflicted(false);
      retry.current = null;
      setMessage(
        record === null
          ? "No saved portfolio yet. Select a listing in company search, add its shares, then save."
          : "Saved holdings loaded. Prices load only when you refresh them.",
      );
    } catch (error) {
      if (request.current())
        failure(
          error,
          "The portfolio could not be loaded. Your current edits are preserved; try loading again.",
        );
    } finally {
      request.finish();
    }
  }

  function edit(next: PersonalPortfolioStoredPayload) {
    invalidate();
    setDraft(next);
    retry.current = null;
    setMessage(
      "Unsaved changes. Save My Portfolio to encrypted local storage.",
    );
  }

  function updateHolding(
    listingId: string,
    changes: Partial<
      Pick<
        PersonalPortfolioHolding,
        "shares" | "totalCostBasisUsd" | "confirmedOn"
      >
    >,
  ) {
    if (draft === null || draft.schemaVersion !== 1) return;
    edit({
      ...draft,
      holdings: draft.holdings.map((holding) =>
        holding.identity.listingId === listingId
          ? { ...holding, ...changes }
          : holding,
      ),
    });
  }

  async function save() {
    if (
      !enabled ||
      draft === null ||
      draft.snapshotSha256 !== catalogSnapshotSha256 ||
      validationMessage(draft) !== null ||
      pendingLedgerEdits ||
      conflicted
    )
      return;
    const payload = draft;
    const body = JSON.stringify(payload);
    const pending = retry.current;
    const key =
      pending?.body === body && pending.version === version
        ? pending.key
        : crypto.randomUUID();
    retry.current = { body, version, key };
    const request = start("save");
    setMessage("Saving encrypted holdings…");
    try {
      const receipt = await savePersonalPortfolio(
        payload,
        version,
        key,
        request.signal,
      );
      if (!request.current()) return;
      setVersion(receipt.version);
      setSaved(payload);
      setConflicted(false);
      retry.current = null;
      setMessage("My Portfolio saved to encrypted local storage.");
    } catch (error) {
      if (request.current())
        failure(
          error,
          "The save could not be confirmed. Retry unchanged edits to safely confirm the same save, or reload the saved portfolio.",
        );
    } finally {
      request.finish();
    }
  }

  async function refreshPrices() {
    const holdingsSnapshot = snapshotFromStored(draft);
    if (
      !enabled ||
      draft === null ||
      draft.snapshotSha256 !== catalogSnapshotSha256 ||
      validationMessage(draft) !== null ||
      holdingsSnapshot === null ||
      holdingsSnapshot.holdings.length === 0
    )
      return;
    const request = start("prices");
    const observed: QuoteObservation[] = [];
    const errors: Array<{ listingId: string; message: string }> = [];
    for (const [index, holding] of holdingsSnapshot.holdings.entries()) {
      if (!request.current()) return;
      setMessage(
        `Checking ${holding.identity.symbol} (${String(index + 1)} of ${String(holdingsSnapshot.holdings.length)})…`,
      );
      try {
        if (draft.schemaVersion === 2) {
          const admitted = await searchPersonalSecurities(
            holding.identity.symbol,
            request.signal,
            25,
          );
          if (!request.current()) return;
          if (admitted.snapshot.snapshotSha256 !== catalogSnapshotSha256) {
            failure(new PersonalWorkspaceApiError("conflict"), "");
            request.finish();
            return;
          }
          if (
            !admitted.results.some((identity) =>
              sameIdentity(identity, holding.identity),
            )
          ) {
            errors.push({
              listingId: holding.identity.listingId,
              message:
                "Historical identity is not available in the current catalog; price not requested",
            });
            setPriceErrors([...errors]);
            continue;
          }
        }
        const result = await fetchPersonalMarketOverview(
          {
            listingId: holding.identity.listingId,
            symbol: holding.identity.symbol,
            range: "1m",
          },
          request.signal,
        );
        if (!request.current()) return;
        observed.push({ security: result.security, quote: result.quote });
      } catch (error) {
        if (!request.current()) return;
        const code =
          error instanceof PersonalWorkspaceApiError
            ? error.code
            : "unavailable";
        if (code === "session_unavailable") {
          failure(error, "");
          return;
        }
        if (code === "rate_limited") {
          setPriceErrors([
            ...errors,
            {
              listingId: holding.identity.listingId,
              message: "Provider rate limited",
            },
          ]);
          setMessage(
            "Tiingo rate limited the price check. The remaining holdings were not requested; try refreshing later.",
          );
          request.finish();
          return;
        }
        if (
          code === "not_configured" ||
          code === "credentials_invalid" ||
          code === "not_entitled"
        ) {
          setMessage(
            code === "not_configured"
              ? "Tiingo is not configured. Add its token in the existing local startup settings to refresh portfolio prices."
              : "Tiingo access was not accepted. Check the configured token and market-data entitlement before refreshing prices.",
          );
          request.finish();
          return;
        }
        errors.push({
          listingId: holding.identity.listingId,
          message: "Price request unavailable",
        });
      }
      setQuotes([...observed]);
      setPriceErrors([...errors]);
      setEvaluatedAt(new Date().toISOString());
    }
    if (request.current())
      setMessage(
        "Price check complete. Missing or stale prices are excluded from complete totals; refresh to request new observations.",
      );
    request.finish();
  }

  async function reconcile() {
    if (!enabled || draft === null) return;
    const request = start("reconcile");
    setMessage(
      "Checking each saved listing identity against the current catalog…",
    );
    const savedIdentities =
      draft.schemaVersion === 1
        ? draft.holdings.map((holding) => holding.identity)
        : draft.identities;
    const identities: PersonalPortfolioIdentity[] = [];
    const unmatched: string[] = [];
    try {
      for (const prior of savedIdentities) {
        let matched: PersonalPortfolioIdentity | null = null;
        const queries = [
          ...new Set([
            prior.symbol,
            prior.issuerName,
            prior.securityName,
            prior.shareClassName,
          ]),
        ].filter(
          (query) => query.trim().length > 0 && [...query].length <= 128,
        );
        for (const query of queries) {
          const result = await searchPersonalSecurities(
            query,
            request.signal,
            25,
          );
          if (!request.current()) return;
          if (result.snapshot.snapshotSha256 !== catalogSnapshotSha256)
            throw new PersonalWorkspaceApiError("conflict");
          const identity = result.results.find(
            (candidate) =>
              candidate.listingId === prior.listingId &&
              candidate.issuerId === prior.issuerId &&
              candidate.securityId === prior.securityId &&
              candidate.shareClassId === prior.shareClassId,
          );
          if (identity) {
            matched = identityFields(identity);
            break;
          }
        }
        if (matched === null) unmatched.push(prior.listingId);
        identities.push(matched ?? prior);
      }
      if (!request.current()) return;
      const payload: PersonalPortfolioStoredPayload =
        draft.schemaVersion === 1
          ? {
              ...draft,
              holdings: draft.holdings.map((holding, index) => ({
                ...holding,
                identity: identities[index] ?? holding.identity,
              })),
            }
          : { ...draft, identities };
      setPreview({ payload, identities, unmatched });
      setMessage(
        unmatched.length === 0
          ? "All listing identities matched. Review the preview, then apply it and save. Shares, cost basis, and confirmation dates are preserved."
          : draft.schemaVersion === 2
            ? `${String(unmatched.length)} historical identities could not be matched. Their opening balances and transactions are preserved; current pricing remains unavailable for unmatched identities. Review and apply to continue recording the ledger.`
            : `${String(unmatched.length)} listing identities could not be matched. Every holding is preserved. Remove an unmatched holding explicitly only if appropriate, then preview again.`,
      );
    } catch (error) {
      if (request.current())
        failure(
          error,
          "Catalog identities could not be checked. Your holdings are preserved; try again.",
        );
    } finally {
      request.finish();
    }
  }

  function startLedger() {
    if (
      !enabled ||
      draft?.schemaVersion !== 1 ||
      draft.snapshotSha256 !== catalogSnapshotSha256 ||
      validationMessage(draft) !== null
    )
      return;
    const candidate: PersonalPortfolioLedgerPayload = {
      schemaVersion: 2,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: draft.snapshotSha256,
      basisMethod: "fifo_with_opening_pool",
      identities: draft.holdings.map((holding) => holding.identity),
      opening: {
        asOfDate: openingDate,
        cashUsd: draft.cashUsd,
        holdings: draft.holdings.map(({ identity, ...holding }) => ({
          listingId: identity.listingId,
          ...holding,
        })),
      },
      transactions: [],
    };
    if (
      projectPersonalPortfolioLedger(candidate, utcDate()).status !== "valid"
    ) {
      setMessage(
        "Enter a real opening date no later than today and on or after every holding's confirmation date.",
      );
      return;
    }
    edit(candidate);
  }

  const ledgerDraft = enabled && draft?.schemaVersion === 2 ? draft : null;
  const visibleDraft = enabled ? snapshotFromStored(draft) : null;
  const dirty =
    enabled &&
    draft !== null &&
    JSON.stringify(draft) !== JSON.stringify(saved);
  const stale =
    visibleDraft !== null &&
    visibleDraft.snapshotSha256 !== catalogSnapshotSha256;
  const invalid = !enabled || draft === null ? null : validationMessage(draft);
  const locked =
    !enabled ||
    operation === "load" ||
    operation === "save" ||
    operation === "reconcile";
  const overview =
    visibleDraft !== null && !stale && invalid === null
      ? calculatePersonalPortfolioOverview({
          portfolio: visibleDraft,
          quotes,
          evaluatedAt: new Date().toISOString(),
        })
      : null;
  const canAdd =
    visibleDraft !== null &&
    draft?.schemaVersion === 1 &&
    selectedListing !== null &&
    !locked &&
    !stale &&
    visibleDraft.holdings.length < 20 &&
    !visibleDraft.holdings.some(
      (holding) => holding.identity.listingId === selectedListing.listingId,
    );

  return (
    <section
      className="watchlist-panel personal-portfolio"
      id="personal-portfolio"
      tabIndex={-1}
      aria-labelledby="personal-portfolio-title"
      aria-busy={operation !== null}
    >
      <div className="discovery-section-heading">
        <div>
          <p className="eyebrow">
            {ledgerDraft ? "Transaction ledger" : "Holdings snapshot"}
          </p>
          <h2 id="personal-portfolio-title">My Portfolio</h2>
        </div>
        <span>
          {version === null
            ? "USD · Up to 20 holdings"
            : `USD · Saved version ${String(version)}`}
        </span>
      </div>
      <p>
        {ledgerDraft ? (
          "Holdings and cash are derived from opening balances and recorded transactions. Reference quotes value remaining holdings; the ledger separately shows realized FIFO estimates and cash flows. Opening holdings are an aggregate pool, so these estimates are not tax accounting."
        ) : (
          <>
            Track long-only stock and ADR holdings with your reported shares and
            total cost basis. Values use reference quotes; gain or loss is
            unrealized and excludes dividends, fees, taxes, and cash flows.
          </>
        )}
      </p>
      <div className="portfolio-actions">
        <button
          type="button"
          className="secondary-action compact-action"
          disabled={
            !enabled || operation !== null || dirty || pendingLedgerEdits
          }
          onClick={() => {
            void load();
          }}
        >
          {visibleDraft === null
            ? "Load My Portfolio"
            : "Reload saved portfolio"}
        </button>
        {(dirty || pendingLedgerEdits) && (
          <button
            type="button"
            className="text-button"
            disabled={locked}
            onClick={() => {
              void load();
            }}
          >
            Discard edits and reload
          </button>
        )}
        {operation !== null && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              const wasSaving = operation === "save";
              invalidate();
              setMessage(
                wasSaving
                  ? "Save canceled locally; the server may have committed it. Retry unchanged edits to confirm, or reload the saved portfolio."
                  : "Operation canceled. Holdings are preserved; transient prices were cleared.",
              );
            }}
          >
            Cancel portfolio operation
          </button>
        )}
      </div>
      <p className="portfolio-status" role="status" aria-live="polite">
        {message}
      </p>
      {visibleDraft !== null && (
        <>
          {stale && (
            <div className="discovery-warning">
              <p>
                This snapshot uses an older catalog. Reconcile listing
                identities before saving or pricing.
              </p>
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={locked}
                onClick={() => {
                  void reconcile();
                }}
              >
                Preview portfolio reconciliation
              </button>
            </div>
          )}
          {preview !== null && (
            <div className="portfolio-reconciliation">
              <h3>Identity reconciliation preview</h3>
              <ul>
                {preview.identities.map((identity) => (
                  <li key={identity.listingId}>
                    {identity.symbol} · {identity.issuerName} —{" "}
                    {preview.unmatched.includes(identity.listingId)
                      ? "Unmatched; preserved"
                      : "Exact listing, issuer, security, and share class matched"}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={
                  (preview.payload.schemaVersion === 1 &&
                    preview.unmatched.length !== 0) ||
                  locked
                }
                onClick={() =>
                  edit({
                    ...preview.payload,
                    snapshotSha256: catalogSnapshotSha256,
                  })
                }
              >
                {ledgerDraft
                  ? "Apply ledger identity review"
                  : "Apply matched identities"}
              </button>
            </div>
          )}
          {invalid !== null && (
            <p className="discovery-warning" role="alert">
              {invalid}
            </p>
          )}
          <div className="portfolio-actions">
            <button
              type="button"
              className="secondary-action compact-action"
              disabled={
                locked ||
                stale ||
                invalid !== null ||
                conflicted ||
                pendingLedgerEdits ||
                (!dirty && version !== null)
              }
              onClick={() => {
                void save();
              }}
            >
              Save My Portfolio
            </button>
            <span>
              {dirty
                ? "Unsaved changes"
                : version === null
                  ? "Not saved yet"
                  : "Saved holdings"}
            </span>
            <button
              type="button"
              className="secondary-action compact-action"
              disabled={
                locked ||
                operation === "prices" ||
                stale ||
                invalid !== null ||
                visibleDraft.holdings.length === 0
              }
              onClick={() => {
                void refreshPrices();
              }}
            >
              Refresh portfolio prices
            </button>
          </div>
          {pendingLedgerEdits && (
            <p className="portfolio-status">
              Apply or reset the staged transaction, opening balance or CSV
              input before saving. Discard edits and reload clears all staged
              input.
            </p>
          )}
          <div className="portfolio-overview">
            <h3>Portfolio overview{dirty ? " · Unsaved draft" : ""}</h3>
            <p>
              {overview === null
                ? "Complete valid holdings and reconcile the catalog to calculate values."
                : `${String(overview.coverage.pricedHoldings)} of ${String(overview.coverage.totalHoldings)} holdings priced · ${String(overview.coverage.staleHoldings)} stale · ${String(overview.coverage.unavailableHoldings)} unavailable`}
            </p>
            {quotes.length > 0 && (
              <p className="portfolio-quote-note">
                Quote age checked {displayTime(evaluatedAt)}. This check does
                not fetch new prices.
              </p>
            )}
            <dl className="portfolio-summary">
              <div>
                <dt>Total value including cash</dt>
                <dd>{money(overview?.totalValueUsd)}</dd>
              </div>
              <div>
                <dt>Priced holdings subtotal</dt>
                <dd>{money(overview?.pricedHoldingsValueUsd)}</dd>
              </div>
              <div>
                <dt>Known cost basis subtotal</dt>
                <dd>{money(overview?.knownCostBasisSubtotalUsd)}</dd>
              </div>
              <div>
                <dt>Cost basis of priced holdings</dt>
                <dd>{money(overview?.pricedHoldingsCostBasisUsd)}</dd>
              </div>
              <div>
                <dt>Unrealized gain / loss of priced holdings</dt>
                <dd>
                  {money(overview?.pricedHoldingsUnrealizedGainUsd)}
                  {overview?.pricedHoldingsUnrealizedGainPercent !== null &&
                  overview?.pricedHoldingsUnrealizedGainPercent !== undefined
                    ? ` (${overview.pricedHoldingsUnrealizedGainPercent}%)`
                    : ""}
                </dd>
              </div>
              <div>
                <dt>Unrealized gain / loss</dt>
                <dd>
                  {money(overview?.unrealizedGainUsd)}
                  {overview?.unrealizedGainPercent !== null &&
                  overview?.unrealizedGainPercent !== undefined
                    ? ` (${overview.unrealizedGainPercent}%)`
                    : ""}
                </dd>
              </div>
              <div>
                <dt>Cash</dt>
                <dd>{money(overview?.cashUsd)}</dd>
              </div>
              <div>
                <dt>Cash allocation</dt>
                <dd>
                  {overview?.cashAllocationPercent === null ||
                  overview?.cashAllocationPercent === undefined
                    ? "Unavailable"
                    : `${overview.cashAllocationPercent}%`}
                </dd>
              </div>
            </dl>
            <p className="portfolio-quote-note">
              Complete total value and allocation require current prices for
              every holding and a known cash balance. Total unrealized gain
              requires every cost basis. Quotes older than 36 hours are
              excluded. Quotes remain in active session memory.{" "}
              {ledgerDraft
                ? "Opening balances, identity history and transactions are saved encrypted."
                : "Only holdings and cash are saved."}
            </p>
          </div>
          {ledgerDraft === null && (
            <div className="portfolio-add-row">
              <div>
                <strong>
                  {selectedListing === null
                    ? "Choose a listing in company search"
                    : `${selectedListing.symbol} · ${selectedListing.issuerName}`}
                </strong>
                <p>
                  {String(visibleDraft.holdings.length)} of 20 holdings · Select
                  “Choose holding” in company search or My Watchlist, or open a
                  company from a screener.
                </p>
              </div>
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={!canAdd}
                onClick={() => {
                  if (canAdd && selectedListing !== null)
                    edit({
                      ...visibleDraft,
                      holdings: [
                        ...visibleDraft.holdings,
                        {
                          identity: identityFields(selectedListing),
                          shares: "",
                          totalCostBasisUsd: null,
                          confirmedOn: utcDate(),
                        },
                      ],
                    });
                }}
              >
                Add selected holding
              </button>
            </div>
          )}
          {visibleDraft.holdings.length === 0 && (
            <p className="discovery-empty-state">
              {ledgerDraft
                ? "No open holdings. Record a buy or correct opening balances in the ledger below."
                : "No holdings yet. Add a selected listing, or enter a cash-only snapshot."}
            </p>
          )}
          <div className="portfolio-holdings">
            {visibleDraft.holdings.map((holding) => {
              const value = overview?.holdings.find(
                (row) => row.listingId === holding.identity.listingId,
              );
              const priceError = priceErrors.find(
                (row) => row.listingId === holding.identity.listingId,
              )?.message;
              return (
                <article
                  className="portfolio-holding"
                  key={holding.identity.listingId}
                >
                  <div className="portfolio-holding-heading">
                    <div>
                      <h3>{holding.identity.symbol}</h3>
                      <p>
                        {holding.identity.issuerName} ·{" "}
                        {holding.identity.exchangeMic}
                      </p>
                    </div>
                    <div className="portfolio-actions">
                      {onOpenResearch && (
                        <button
                          type="button"
                          className="text-button"
                          disabled={
                            locked ||
                            stale ||
                            (ledgerDraft !== null &&
                              !quotes.some(
                                (quote) =>
                                  quote.security.listingId ===
                                  holding.identity.listingId,
                              ))
                          }
                          onClick={() => onOpenResearch(holding.identity)}
                        >
                          Research {holding.identity.symbol}
                        </button>
                      )}
                      {ledgerDraft === null && (
                        <button
                          type="button"
                          className="text-button"
                          disabled={locked}
                          onClick={() =>
                            edit({
                              ...visibleDraft,
                              holdings: visibleDraft.holdings.filter(
                                (row) =>
                                  row.identity.listingId !==
                                  holding.identity.listingId,
                              ),
                            })
                          }
                        >
                          Remove {holding.identity.symbol}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="portfolio-fields">
                    <label>
                      Shares
                      <input
                        aria-label={`Shares for ${holding.identity.symbol}`}
                        inputMode="decimal"
                        maxLength={24}
                        value={holding.shares}
                        readOnly={ledgerDraft !== null}
                        disabled={locked}
                        onChange={(event) =>
                          updateHolding(holding.identity.listingId, {
                            shares: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Total cost basis (USD)
                      <input
                        aria-label={`Total cost basis for ${holding.identity.symbol}`}
                        inputMode="decimal"
                        maxLength={24}
                        placeholder="Unknown"
                        value={holding.totalCostBasisUsd ?? ""}
                        readOnly={ledgerDraft !== null}
                        disabled={locked}
                        onChange={(event) =>
                          updateHolding(holding.identity.listingId, {
                            totalCostBasisUsd:
                              event.target.value === ""
                                ? null
                                : event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Shares confirmed on
                      <input
                        aria-label={`Shares confirmed on for ${holding.identity.symbol}`}
                        type="date"
                        max={utcDate()}
                        value={holding.confirmedOn}
                        readOnly={ledgerDraft !== null}
                        disabled={locked}
                        onChange={(event) =>
                          updateHolding(holding.identity.listingId, {
                            confirmedOn: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <dl className="portfolio-holding-values">
                    <div>
                      <dt>Market value</dt>
                      <dd>{money(value?.marketValueUsd)}</dd>
                    </div>
                    <div>
                      <dt>Unrealized gain / loss</dt>
                      <dd>
                        {money(value?.unrealizedGainUsd)}
                        {value?.unrealizedGainPercent !== null &&
                        value?.unrealizedGainPercent !== undefined
                          ? ` (${value.unrealizedGainPercent}%)`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>Portfolio allocation</dt>
                      <dd>
                        {value?.allocationPercent === null ||
                        value?.allocationPercent === undefined
                          ? "Unavailable"
                          : `${value.allocationPercent}%`}
                      </dd>
                    </div>
                  </dl>
                  <p className="portfolio-quote-note">
                    {stale
                      ? "Catalog reconciliation required"
                      : (priceError ??
                        (value?.priceStatus === "priced"
                          ? "Current reference quote"
                          : value?.priceStatus === "stale"
                            ? "Stale quote; excluded from valuation"
                            : "Price unavailable"))}
                    {value?.quote && (
                      <>
                        {" "}
                        ·{" "}
                        {value.quote.kind === "end_of_day_close"
                          ? "End-of-day close"
                          : "Derived real-time reference"}{" "}
                        · Reference price {value.quote.price} USD · Source{" "}
                        {displayTime(value.quote.sourceTime)} · Received{" "}
                        {displayTime(value.quote.ingestedAt)}
                      </>
                    )}
                  </p>
                </article>
              );
            })}
          </div>
          <div className="portfolio-cash">
            <label>
              Cash balance (USD)
              <input
                aria-label="Portfolio cash balance"
                inputMode="decimal"
                maxLength={24}
                placeholder="Unknown"
                value={visibleDraft.cashUsd ?? ""}
                readOnly={ledgerDraft !== null}
                disabled={locked}
                onChange={(event) => {
                  if (draft?.schemaVersion !== 1) return;
                  edit({
                    ...visibleDraft,
                    cashUsd:
                      event.target.value === "" ? null : event.target.value,
                  });
                }}
              />
            </label>
            <p>
              {ledgerDraft
                ? "Shares, basis and cash above are derived from the ledger. Correct opening balances or recorded transactions below to change them. Refresh prices to verify current catalog admission before opening research."
                : "Blank means unknown. Enter 0 when there is no cash. Blank cost basis also means unknown."}
            </p>
          </div>
          {ledgerDraft !== null ? (
            <PersonalPortfolioLedgerEditor
              key={`${context}:${String(version)}`}
              ledger={ledgerDraft}
              disabled={locked || stale || conflicted}
              selectedListing={selectedListing}
              onChange={edit}
              onPendingEditsChange={setPendingLedgerEdits}
            />
          ) : (
            <div className="portfolio-ledger-conversion">
              <h3>Start recording transactions</h3>
              <p>
                Use this snapshot as opening balances at the end of the date
                below. Transactions must be after that date. Shares, unknown
                cash and unknown basis are preserved; each opening holding
                becomes one aggregate FIFO pool. Review the ledger, then save to
                keep the conversion.
              </p>
              <label>
                Opening balances as of
                <input
                  aria-label="Opening balances as of"
                  type="date"
                  value={openingDate}
                  max={utcDate()}
                  disabled={locked || stale}
                  onChange={(event) => setOpeningDate(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={locked || stale || invalid !== null || conflicted}
                onClick={startLedger}
              >
                Start transaction ledger
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function emptyPortfolio(
  snapshotSha256: `sha256:${string}`,
): PersonalPortfolioPayload {
  return {
    schemaVersion: 1,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256,
    cashUsd: null,
    holdings: [],
  };
}

function identityFields(
  value: PersonalPortfolioIdentity,
): PersonalPortfolioIdentity {
  return {
    country: value.country,
    exchangeMic: value.exchangeMic,
    instrumentType: value.instrumentType,
    issuerId: value.issuerId,
    issuerName: value.issuerName,
    listingId: value.listingId,
    securityId: value.securityId,
    securityName: value.securityName,
    shareClassId: value.shareClassId,
    shareClassName: value.shareClassName,
    symbol: value.symbol,
  };
}

function snapshotFromStored(
  payload: PersonalPortfolioStoredPayload | null,
): PersonalPortfolioPayload | null {
  if (payload === null || payload.schemaVersion === 1) return payload;
  const result = projectPersonalPortfolioLedger(payload, utcDate());
  return result.status === "valid" ? result.portfolio : null;
}

function sameIdentity(
  left: PersonalPortfolioIdentity,
  right: PersonalPortfolioIdentity,
) {
  return (
    JSON.stringify(identityFields(left)) ===
    JSON.stringify(identityFields(right))
  );
}

function validationMessage(
  payload: PersonalPortfolioStoredPayload,
): string | null {
  if (payload.schemaVersion === 2) {
    const result = projectPersonalPortfolioLedger(payload, utcDate());
    return result.status === "valid"
      ? null
      : "This ledger has invalid opening balances or transactions. Correct it or reload before saving or pricing.";
  }
  if (payload.cashUsd !== null && !isPersonalPortfolioMoney(payload.cashUsd))
    return "Cash must be 0 to 1,000,000,000,000 USD with at most 2 decimal places, or blank for unknown.";
  for (const holding of payload.holdings) {
    if (!isPersonalPortfolioShares(holding.shares))
      return `${holding.identity.symbol}: shares must be greater than 0 and at most 1,000,000,000, with at most 6 decimal places.`;
    if (
      holding.totalCostBasisUsd !== null &&
      !isPersonalPortfolioMoney(holding.totalCostBasisUsd)
    )
      return `${holding.identity.symbol}: total cost basis must be 0 to 1,000,000,000,000 USD with at most 2 decimal places, or blank for unknown.`;
    const date = new Date(`${holding.confirmedOn}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/u.test(holding.confirmedOn) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== holding.confirmedOn ||
      holding.confirmedOn > utcDate()
    )
      return `${holding.identity.symbol}: enter a real confirmation date no later than today.`;
  }
  return isPersonalPortfolioPayload(payload, utcDate())
    ? null
    : "This holdings snapshot is invalid. Reload or correct the portfolio before saving.";
}

function utcDate() {
  return new Date().toISOString().slice(0, 10);
}
function money(value: string | null | undefined) {
  return value === null || value === undefined ? "Unavailable" : `${value} USD`;
}
function displayTime(value: string) {
  return value.replace("T", " ").replace("Z", " UTC");
}
