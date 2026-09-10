"use client";

import {
  PERSONAL_PORTFOLIO_LEDGER_LIMITS,
  projectPersonalPortfolioLedger,
  type PersonalPortfolioIdentity,
  type PersonalPortfolioLedgerPayload,
  type PersonalPortfolioLedgerProjection,
  type PersonalPortfolioLedgerTransaction,
  type PersonalPortfolioLedgerActivity,
  type PersonalPortfolioLedgerSplit,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";

import {
  PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS,
  PERSONAL_PORTFOLIO_LEDGER_CSV_TEMPLATE,
  parsePersonalPortfolioLedgerCsv,
  type PersonalPortfolioLedgerCsvResult,
} from "@/lib/personal-portfolio-ledger-csv";
import { PersonalPortfolioSplitEditor } from "./PersonalPortfolioSplitEditor";

export interface PersonalPortfolioLedgerEditorProps {
  readonly ledger: PersonalPortfolioLedgerPayload;
  readonly disabled: boolean;
  readonly selectedListing: PersonalPortfolioIdentity | null;
  readonly onChange: (next: PersonalPortfolioLedgerPayload) => void;
  readonly onPendingEditsChange?: (pending: boolean) => void;
}

type TransactionType = PersonalPortfolioLedgerTransaction["type"];
type TransactionForm = Readonly<{
  date: string;
  type: TransactionType;
  listingId: string;
  shares: string;
  grossUsd: string;
  feeUsd: string;
}>;
type CsvPreview = Extract<
  PersonalPortfolioLedgerCsvResult,
  { status: "valid" }
>;
const transactionTypes = [
  "buy",
  "sell",
  "deposit",
  "withdrawal",
  "dividend",
  "fee",
] as const;
const pageSize = 25;

export function PersonalPortfolioLedgerEditor({
  ledger,
  disabled,
  selectedListing,
  onChange,
  onPendingEditsChange,
}: PersonalPortfolioLedgerEditorProps) {
  const [form, setForm] = useState<TransactionForm>(emptyForm(ledger));
  const [formBaseline, setFormBaseline] = useState<TransactionForm>(
    emptyForm(ledger),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSplit, setEditingSplit] =
    useState<PersonalPortfolioLedgerSplit | null>(null);
  const [pendingSplitEdits, setPendingSplitEdits] = useState(false);
  const [opening, setOpening] = useState(ledger.opening);
  const [openingListingId, setOpeningListingId] = useState(
    ledger.identities[0]?.listingId ?? "",
  );
  const [message, setMessage] = useState(
    "Ledger changes update your draft. Save My Portfolio to keep them in encrypted storage.",
  );
  const [page, setPage] = useState(0);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [csvPreviewContext, setCsvPreviewContext] = useState<string | null>(
    null,
  );
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [reading, setReading] = useState(false);
  const csvEpoch = useRef(0);
  const reviewedCsvEpoch = useRef<number | null>(null);
  const generatedId = useRef<string | null>(null);
  const pendingCallback = useRef(onPendingEditsChange);
  pendingCallback.current = onPendingEditsChange;
  const context = JSON.stringify([ledger, disabled]);
  const liveContext = useRef(context);
  liveContext.current = context;
  const [formContext, setFormContext] = useState(context);
  const openingChanged =
    JSON.stringify(opening) !== JSON.stringify(ledger.opening);
  const transactionPending =
    editingId !== null || JSON.stringify(form) !== JSON.stringify(formBaseline);
  const pendingEdits =
    !disabled &&
    (openingChanged ||
      transactionPending ||
      pendingSplitEdits ||
      editingSplit !== null ||
      csvText.trim().length > 0 ||
      reading);

  useEffect(() => {
    pendingCallback.current?.(pendingEdits);
  }, [pendingEdits]);
  useEffect(
    () => () => {
      pendingCallback.current?.(false);
    },
    [],
  );

  function clearCsv() {
    csvEpoch.current += 1;
    reviewedCsvEpoch.current = null;
    setCsvText("");
    setCsvPreview(null);
    setCsvPreviewContext(null);
    setDuplicateAcknowledged(false);
    setReading(false);
  }

  useEffect(() => {
    clearCsv();
    generatedId.current = null;
    setForm(emptyForm(ledger));
    setFormBaseline(emptyForm(ledger));
    setEditingId(null);
    setEditingSplit(null);
    setPendingSplitEdits(false);
    setOpening(ledger.opening);
    setOpeningListingId(ledger.identities[0]?.listingId ?? "");
    setPage(0);
    setFormContext(context);
    return () => {
      csvEpoch.current += 1;
    };
  }, [context]);

  function apply(
    candidate: PersonalPortfolioLedgerPayload,
    successMessage: string,
    applying?: "opening" | "transaction" | "csv" | "split",
  ): boolean {
    if (disabled || liveContext.current !== context) return false;
    if (
      applying !== "opening" &&
      JSON.stringify(opening) !== JSON.stringify(ledger.opening)
    ) {
      setMessage(
        "Apply or reset your opening balance edits before making another ledger change. No changes were applied.",
      );
      return false;
    }
    if (applying !== "transaction" && transactionPending) {
      setMessage(
        "Apply or reset your transaction form before making another ledger change. No changes were applied.",
      );
      return false;
    }
    if (applying !== "csv" && (csvText.trim().length > 0 || reading)) {
      setMessage(
        "Apply or clear your CSV input before making another ledger change. No changes were applied.",
      );
      return false;
    }
    if (applying !== "split" && (pendingSplitEdits || editingSplit !== null)) {
      setMessage(
        "Apply or clear the split review before making another ledger change. No changes were applied.",
      );
      return false;
    }
    const result = projectPersonalPortfolioLedger(candidate, today());
    if (result.status === "invalid") {
      setMessage(projectionError(result.error));
      return false;
    }
    clearCsv();
    generatedId.current = null;
    setEditingId(null);
    setEditingSplit(null);
    setPendingSplitEdits(false);
    setForm(emptyForm(candidate));
    setFormBaseline(emptyForm(candidate));
    setOpening(candidate.opening);
    onChange(candidate);
    setMessage(successMessage);
    return true;
  }

  function submitTransaction() {
    if (disabled || formContext !== context) return;
    generatedId.current ??= crypto.randomUUID();
    const trade = form.type === "buy" || form.type === "sell";
    const linked = trade || form.type === "dividend";
    const transaction: PersonalPortfolioLedgerTransaction = {
      id: editingId ?? generatedId.current,
      date: form.date,
      type: form.type,
      listingId: linked ? form.listingId : null,
      shares: trade ? form.shares : null,
      grossUsd: form.grossUsd,
      feeUsd: trade ? form.feeUsd : "0",
    };
    const transactions =
      editingId === null
        ? [...ledger.transactions, transaction]
        : ledger.transactions.map((entry) =>
            entry.id === editingId ? transaction : entry,
          );
    apply(
      withActivities(ledger, transactions),
      editingId === null
        ? "Transaction added to your draft. Save My Portfolio to keep it."
        : "Transaction updated in your draft. Save My Portfolio to keep it.",
      "transaction",
    );
  }

  function editTransaction(transaction: PersonalPortfolioLedgerTransaction) {
    if (transactionPending || pendingSplitEdits || editingSplit !== null) {
      setMessage(
        "Apply or reset your transaction form before editing another transaction. No changes were applied.",
      );
      return;
    }
    setForm({
      date: transaction.date,
      type: transaction.type,
      listingId: transaction.listingId ?? "",
      shares: transaction.shares ?? "",
      grossUsd: transaction.grossUsd,
      feeUsd: transaction.feeUsd,
    });
    setEditingId(transaction.id);
    generatedId.current = null;
    setMessage(
      `Editing transaction ${transaction.id}. Its ID and array position are preserved.`,
    );
  }

  function editSplit(split: PersonalPortfolioLedgerSplit) {
    if (
      transactionPending ||
      openingChanged ||
      csvText.trim().length > 0 ||
      reading ||
      pendingSplitEdits ||
      editingSplit !== null
    ) {
      setMessage(
        "Apply or reset your pending inputs before editing a split. No changes were applied.",
      );
      return;
    }
    setEditingSplit(split);
  }

  function moveSameDay(index: number, direction: -1 | 1) {
    const other = index + direction;
    const entry = ledger.transactions[index];
    const neighbor = ledger.transactions[other];
    if (
      entry === undefined ||
      neighbor === undefined ||
      entry.date !== neighbor.date
    )
      return;
    const transactions = [...ledger.transactions];
    transactions[index] = neighbor;
    transactions[other] = entry;
    apply(
      withActivities(ledger, transactions),
      "Same-day transaction order updated in your draft. Save My Portfolio to keep it.",
    );
  }

  function changeCsv(text: string) {
    csvEpoch.current += 1;
    reviewedCsvEpoch.current = null;
    setReading(false);
    setCsvPreview(null);
    setCsvPreviewContext(null);
    setDuplicateAcknowledged(false);
    if (
      new TextEncoder().encode(text).byteLength >
      PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS.bytes
    ) {
      setCsvText("");
      setMessage("CSV input exceeds 64 KiB. No transactions were changed.");
      return;
    }
    setCsvText(text);
  }

  async function readCsv(file: File | undefined) {
    clearCsv();
    if (disabled || file === undefined) return;
    if (file.size > PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS.bytes) {
      setMessage("CSV file exceeds 64 KiB. No transactions were changed.");
      return;
    }
    const operationEpoch = csvEpoch.current;
    const operationContext = context;
    setReading(true);
    const current = () =>
      operationEpoch === csvEpoch.current &&
      operationContext === liveContext.current;
    try {
      const bytes = await file.arrayBuffer();
      if (!current()) return;
      if (bytes.byteLength > PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS.bytes)
        throw new Error("size");
      const value = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes);
      if (
        new TextEncoder().encode(value).byteLength >
        PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS.bytes
      )
        throw new Error("size");
      setCsvText(value);
      setMessage(
        "CSV text loaded locally. Preview the import before applying any transactions.",
      );
    } catch {
      if (current())
        setMessage(
          "The CSV could not be read as valid UTF-8 within 64 KiB. No transactions were changed.",
        );
    } finally {
      if (current()) setReading(false);
    }
  }

  function previewImport() {
    if (disabled || reading || formContext !== context) return;
    const result = parsePersonalPortfolioLedgerCsv(csvText, ledger, today());
    setDuplicateAcknowledged(false);
    if (result.status === "invalid") {
      setCsvPreview(null);
      setCsvPreviewContext(null);
      setMessage(csvError(result.error));
      return;
    }
    setCsvPreview(result);
    setCsvPreviewContext(context);
    reviewedCsvEpoch.current = csvEpoch.current;
    setMessage(
      `${String(result.rowCount)} CSV transactions are ready for review. Applying them updates the draft; Save My Portfolio persists it.`,
    );
  }

  function applyImport() {
    if (
      disabled ||
      csvPreview === null ||
      csvPreviewContext !== context ||
      liveContext.current !== context ||
      reviewedCsvEpoch.current !== csvEpoch.current ||
      (csvPreview.possibleDuplicateIds.length > 0 && !duplicateAcknowledged)
    )
      return;
    const checked = parsePersonalPortfolioLedgerCsv(csvText, ledger, today());
    if (
      checked.status !== "valid" ||
      JSON.stringify(checked.candidate) !== JSON.stringify(csvPreview.candidate)
    ) {
      setCsvPreview(null);
      setMessage(
        "The import context changed. Preview the CSV again before applying it.",
      );
      return;
    }
    apply(
      checked.candidate,
      `${String(checked.rowCount)} reviewed transactions added to your draft. Save My Portfolio to keep them.`,
      "csv",
    );
  }

  const projection = projectPersonalPortfolioLedger(ledger, today());
  const currentForm = formContext === context;
  const locked = disabled || !currentForm;
  const trade = form.type === "buy" || form.type === "sell";
  const linked = trade || form.type === "dividend";
  const activePreview =
    !disabled && csvPreviewContext === context ? csvPreview : null;
  const pageCount = Math.max(
    1,
    Math.ceil(ledger.transactions.length / pageSize),
  );
  const activePage = Math.min(page, pageCount - 1);
  const pageRows = ledger.transactions.slice(
    activePage * pageSize,
    (activePage + 1) * pageSize,
  );
  const symbol = (listingId: string | null) =>
    listingId === null
      ? "Cash"
      : (ledger.identities.find((identity) => identity.listingId === listingId)
          ?.symbol ?? listingId);

  return (
    <section
      className="portfolio-ledger"
      aria-labelledby="portfolio-ledger-title"
    >
      <h3 id="portfolio-ledger-title">Transactions and opening balances</h3>
      <p>
        Record activity manually to derive shares, cash, and cost basis. FIFO is
        an estimate: each opening holding is one pooled lot, followed by
        recorded buys. This is not tax-lot accounting or a trading service.
      </p>
      <p role="status" aria-live="polite">
        {disabled
          ? "Ledger editing is unavailable while the portfolio or owner session is being checked."
          : message}
      </p>
      {!disabled && (
        <>
          {projection.status === "valid" && (
            <div className="ledger-section">
              <h4>Ledger summary</h4>
              <dl className="ledger-summary">
                <div>
                  <dt>Known realized gain / loss subtotal</dt>
                  <dd>{usd(projection.realized.knownGainSubtotalUsd)}</dd>
                </div>
                <div>
                  <dt>Total realized gain / loss</dt>
                  <dd>{usd(projection.realized.totalGainUsd)}</dd>
                </div>
                <div>
                  <dt>Sales with unknown basis</dt>
                  <dd>
                    {String(projection.realized.unknownSales)} of{" "}
                    {String(projection.realized.sales)}
                  </dd>
                </div>
                <div>
                  <dt>Deposits</dt>
                  <dd>{usd(projection.cashFlows.depositsUsd)}</dd>
                </div>
                <div>
                  <dt>Withdrawals</dt>
                  <dd>{usd(projection.cashFlows.withdrawalsUsd)}</dd>
                </div>
                <div>
                  <dt>Dividends received</dt>
                  <dd>{usd(projection.cashFlows.dividendsUsd)}</dd>
                </div>
                <div>
                  <dt>Trade fees</dt>
                  <dd>{usd(projection.cashFlows.tradeFeesUsd)}</dd>
                </div>
                <div>
                  <dt>Standalone fees</dt>
                  <dd>{usd(projection.cashFlows.standaloneFeesUsd)}</dd>
                </div>
                <div>
                  <dt>Cash change from transactions</dt>
                  <dd>{usd(projection.cashFlows.netCashChangeUsd)}</dd>
                </div>
              </dl>
              <p className="ledger-help">
                {projection.cashCheck === "unknown_opening_cash"
                  ? "Opening cash is unknown. Cash solvency and the current cash balance cannot be verified."
                  : "Recorded cash stays nonnegative at every transaction."}{" "}
                Realized gain excludes dividends and standalone fees; trade fees
                are included in basis or proceeds.
              </p>
              <details>
                <summary>FIFO lots ({String(projection.lots.length)})</summary>
                <ul className="ledger-identity-list">
                  {projection.lots.map((lot) => (
                    <li key={lot.lotId}>
                      {symbol(lot.listingId)} ·{" "}
                      {lot.source === "opening_pool" ? "Opening pool" : "Buy"}{" "}
                      {lot.openedOn} · {lot.remainingShares} shares remaining ·
                      Remaining basis {usd(lot.remainingCostBasisUsd)}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}

          <details className="ledger-section">
            <summary>
              Registered listings ({String(ledger.identities.length)} of 20)
            </summary>
            <p className="ledger-help">
              Choose a catalog listing in company search or My Watchlist, then
              register it here before adding a trade, dividend, opening
              position, or CSV row.
            </p>
            <div className="ledger-actions">
              <span>
                {selectedListing === null
                  ? "No catalog listing selected"
                  : `${selectedListing.symbol} · ${selectedListing.issuerName}`}
              </span>
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={
                  locked ||
                  selectedListing === null ||
                  ledger.identities.length >=
                    PERSONAL_PORTFOLIO_LEDGER_LIMITS.identities ||
                  ledger.identities.some(
                    (identity) =>
                      identity.listingId === selectedListing?.listingId,
                  )
                }
                onClick={() => {
                  if (selectedListing !== null)
                    apply(
                      {
                        ...ledger,
                        identities: [...ledger.identities, selectedListing],
                      },
                      "Listing registered in your draft. You can now use its exact identity in transactions.",
                    );
                }}
              >
                Register selected listing
              </button>
            </div>
            <ul className="ledger-identity-list">
              {ledger.identities.map((identity) => (
                <li key={identity.listingId}>
                  {identity.symbol} · {identity.issuerName} · Listing ID:{" "}
                  {identity.listingId}{" "}
                  <button
                    type="button"
                    className="text-button"
                    disabled={
                      locked ||
                      ledger.opening.holdings.some(
                        (holding) => holding.listingId === identity.listingId,
                      ) ||
                      ledger.transactions.some(
                        (transaction) =>
                          transaction.listingId === identity.listingId,
                      )
                    }
                    onClick={() =>
                      apply(
                        {
                          ...ledger,
                          identities: ledger.identities.filter(
                            (entry) => entry.listingId !== identity.listingId,
                          ),
                        },
                        "Unused listing removed from the draft registry.",
                      )
                    }
                  >
                    Remove unused {identity.symbol}
                  </button>
                </li>
              ))}
            </ul>
          </details>

          <details className="ledger-section">
            <summary>Edit opening balances</summary>
            <p className="ledger-help">
              Opening balances represent the end of this date. Every transaction
              must be on a later date. Each opening position is a single FIFO
              pool; blank cash or cost basis means unknown.
            </p>
            <div className="ledger-fields">
              <label>
                Opening date
                <input
                  type="date"
                  aria-label="Ledger opening date"
                  max={today()}
                  value={
                    currentForm ? opening.asOfDate : ledger.opening.asOfDate
                  }
                  disabled={locked}
                  onChange={(event) =>
                    setOpening({ ...opening, asOfDate: event.target.value })
                  }
                />
              </label>
              <label>
                Opening cash (USD)
                <input
                  aria-label="Ledger opening cash"
                  inputMode="decimal"
                  placeholder="Unknown"
                  maxLength={20}
                  value={opening.cashUsd ?? ""}
                  disabled={locked}
                  onChange={(event) =>
                    setOpening({
                      ...opening,
                      cashUsd:
                        event.target.value === "" ? null : event.target.value,
                    })
                  }
                />
              </label>
            </div>
            {opening.holdings.map((holding) => (
              <div className="ledger-opening-position" key={holding.listingId}>
                <div className="ledger-row-heading">
                  <strong>{symbol(holding.listingId)}</strong>
                  <button
                    type="button"
                    className="text-button"
                    disabled={locked}
                    onClick={() =>
                      setOpening({
                        ...opening,
                        holdings: opening.holdings.filter(
                          (entry) => entry.listingId !== holding.listingId,
                        ),
                      })
                    }
                  >
                    Remove opening {symbol(holding.listingId)}
                  </button>
                </div>
                <div className="ledger-fields">
                  <label>
                    Opening shares
                    <input
                      aria-label={`Opening shares for ${symbol(holding.listingId)}`}
                      inputMode="decimal"
                      maxLength={20}
                      value={holding.shares}
                      disabled={locked}
                      onChange={(event) =>
                        setOpening({
                          ...opening,
                          holdings: opening.holdings.map((entry) =>
                            entry.listingId === holding.listingId
                              ? { ...entry, shares: event.target.value }
                              : entry,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Opening total cost basis (USD)
                    <input
                      aria-label={`Opening cost basis for ${symbol(holding.listingId)}`}
                      inputMode="decimal"
                      placeholder="Unknown"
                      maxLength={20}
                      value={holding.totalCostBasisUsd ?? ""}
                      disabled={locked}
                      onChange={(event) =>
                        setOpening({
                          ...opening,
                          holdings: opening.holdings.map((entry) =>
                            entry.listingId === holding.listingId
                              ? {
                                  ...entry,
                                  totalCostBasisUsd:
                                    event.target.value === ""
                                      ? null
                                      : event.target.value,
                                }
                              : entry,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Shares confirmed on
                    <input
                      aria-label={`Opening confirmed on for ${symbol(holding.listingId)}`}
                      type="date"
                      max={opening.asOfDate}
                      value={holding.confirmedOn}
                      disabled={locked}
                      onChange={(event) =>
                        setOpening({
                          ...opening,
                          holdings: opening.holdings.map((entry) =>
                            entry.listingId === holding.listingId
                              ? { ...entry, confirmedOn: event.target.value }
                              : entry,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
            <div className="ledger-fields">
              <label>
                Add an opening listing
                <select
                  aria-label="Opening listing"
                  value={openingListingId}
                  disabled={locked}
                  onChange={(event) => setOpeningListingId(event.target.value)}
                >
                  <option value="">Choose a registered listing</option>
                  {ledger.identities.map((identity) => (
                    <option key={identity.listingId} value={identity.listingId}>
                      {identity.symbol}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="ledger-actions">
              <button
                type="button"
                className="text-button"
                disabled={
                  locked ||
                  openingListingId === "" ||
                  !ledger.identities.some(
                    (identity) => identity.listingId === openingListingId,
                  ) ||
                  opening.holdings.some(
                    (holding) => holding.listingId === openingListingId,
                  )
                }
                onClick={() =>
                  setOpening({
                    ...opening,
                    holdings: [
                      ...opening.holdings,
                      {
                        listingId: openingListingId,
                        shares: "",
                        totalCostBasisUsd: null,
                        confirmedOn: opening.asOfDate,
                      },
                    ],
                  })
                }
              >
                Add opening position
              </button>
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={locked || !openingChanged}
                onClick={() =>
                  apply(
                    { ...ledger, opening },
                    "Opening balances updated in your draft. Save My Portfolio to keep them.",
                    "opening",
                  )
                }
              >
                Apply opening changes
              </button>
              <button
                type="button"
                className="text-button"
                disabled={locked || !openingChanged}
                onClick={() => setOpening(ledger.opening)}
              >
                Reset opening edits
              </button>
            </div>
          </details>

          {ledger.schemaVersion === 3 ? (
            <PersonalPortfolioSplitEditor
              ledger={ledger}
              disabled={locked}
              editing={editingSplit}
              onPendingEditsChange={setPendingSplitEdits}
              onCancelEdit={() => {
                setEditingSplit(null);
                setPendingSplitEdits(false);
              }}
              onApply={(candidate) =>
                apply(
                  candidate,
                  "Reviewed split applied to your draft. Save My Portfolio to keep it.",
                  "split",
                )
              }
            />
          ) : (
            <div className="ledger-section">
              <h4>Enable split and reverse-split records</h4>
              <p className="ledger-help">
                Upgrade this draft to support manually reviewed split
                adjustments. Existing identities, opening balances, transaction
                IDs and order remain intact. Nothing is saved until you choose
                Save My Portfolio.
              </p>
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={locked}
                onClick={() =>
                  apply(
                    { ...ledger, schemaVersion: 3 },
                    "Split records enabled in your draft. Existing transactions are preserved. Save My Portfolio to keep the upgrade.",
                  )
                }
              >
                Enable split records
              </button>
            </div>
          )}

          <div className="ledger-section">
            <h4>
              {editingId === null ? "Add a transaction" : "Edit transaction"}
            </h4>
            <p className="ledger-help">
              {editingId === null
                ? "New transactions append after existing activity. Use nondecreasing dates; same-day array order determines FIFO and cash availability."
                : `Editing ID ${editingId}. Date changes must preserve the existing transaction order.`}{" "}
              Enter gross trade amounts before fees. For a standalone fee, enter
              the fee as the amount.
            </p>
            <div className="ledger-fields">
              <label>
                Type
                <select
                  aria-label="Transaction type"
                  value={form.type}
                  disabled={locked}
                  onChange={(event) => {
                    if (
                      transactionTypes.some(
                        (type) => type === event.target.value,
                      )
                    )
                      setForm({
                        ...form,
                        type: event.target.value as TransactionType,
                      });
                  }}
                >
                  {transactionTypes.map((type) => (
                    <option key={type} value={type}>
                      {typeLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input
                  aria-label="Transaction date"
                  type="date"
                  max={today()}
                  value={form.date}
                  disabled={locked}
                  onChange={(event) =>
                    setForm({ ...form, date: event.target.value })
                  }
                />
              </label>
              {linked && (
                <label>
                  Registered listing
                  <select
                    aria-label="Transaction listing"
                    value={form.listingId}
                    disabled={locked}
                    onChange={(event) =>
                      setForm({ ...form, listingId: event.target.value })
                    }
                  >
                    <option value="">Choose a registered listing</option>
                    {ledger.identities.map((identity) => (
                      <option
                        key={identity.listingId}
                        value={identity.listingId}
                      >
                        {identity.symbol}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {trade && (
                <label>
                  Shares
                  <input
                    aria-label="Transaction shares"
                    inputMode="decimal"
                    maxLength={20}
                    value={form.shares}
                    disabled={locked}
                    onChange={(event) =>
                      setForm({ ...form, shares: event.target.value })
                    }
                  />
                </label>
              )}
              <label>
                {trade ? "Gross amount (USD)" : "Amount (USD)"}
                <input
                  aria-label="Transaction amount"
                  inputMode="decimal"
                  maxLength={20}
                  value={form.grossUsd}
                  disabled={locked}
                  onChange={(event) =>
                    setForm({ ...form, grossUsd: event.target.value })
                  }
                />
              </label>
              {trade && (
                <label>
                  Trade fee (USD)
                  <input
                    aria-label="Transaction fee"
                    inputMode="decimal"
                    maxLength={20}
                    value={form.feeUsd}
                    disabled={locked}
                    onChange={(event) =>
                      setForm({ ...form, feeUsd: event.target.value })
                    }
                  />
                </label>
              )}
            </div>
            <div className="ledger-actions">
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={
                  locked ||
                  (editingId === null &&
                    ledger.transactions.length >=
                      PERSONAL_PORTFOLIO_LEDGER_LIMITS.transactions)
                }
                onClick={submitTransaction}
              >
                {editingId === null
                  ? "Add transaction to draft"
                  : "Apply transaction edit"}
              </button>
              {editingId !== null && (
                <button
                  type="button"
                  className="text-button"
                  disabled={locked}
                  onClick={() => {
                    setEditingId(null);
                    generatedId.current = null;
                    setForm(emptyForm(ledger));
                    setFormBaseline(emptyForm(ledger));
                  }}
                >
                  Cancel transaction edit
                </button>
              )}
              {editingId === null && transactionPending && (
                <button
                  type="button"
                  className="text-button"
                  disabled={locked}
                  onClick={() => {
                    generatedId.current = null;
                    setForm(emptyForm(ledger));
                    setFormBaseline(emptyForm(ledger));
                  }}
                >
                  Reset transaction form
                </button>
              )}
            </div>
          </div>

          <div className="ledger-section">
            <h4>
              Recorded transactions ({String(ledger.transactions.length)} of
              250)
            </h4>
            {ledger.transactions.length === 0 && (
              <p>No transactions recorded after the opening balance.</p>
            )}
            {pageRows.map((transaction, index) => {
              const absoluteIndex = activePage * pageSize + index;
              return (
                <article className="ledger-transaction" key={transaction.id}>
                  <div className="ledger-row-heading">
                    <div>
                      <h4>
                        {String(absoluteIndex + 1)}.{" "}
                        {typeLabel(transaction.type)} ·{" "}
                        {symbol(transaction.listingId)}
                      </h4>
                      <p>
                        {transaction.date} · ID {transaction.id}
                      </p>
                    </div>
                    <div className="ledger-actions">
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`Edit ${transaction.id}`}
                        disabled={locked}
                        onClick={() =>
                          transaction.type === "split"
                            ? editSplit(transaction)
                            : editTransaction(transaction)
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`Remove ${transaction.id}`}
                        disabled={locked}
                        onClick={() =>
                          apply(
                            withActivities(
                              ledger,
                              ledger.transactions.filter(
                                (entry) => entry.id !== transaction.id,
                              ),
                            ),
                            "Transaction removed from your draft. Save My Portfolio to keep the change.",
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <dl className="ledger-transaction-values">
                    {transaction.type === "split" ? (
                      <>
                        <div>
                          <dt>New:old share ratio</dt>
                          <dd>
                            {transaction.ratioNumerator}:
                            {transaction.ratioDenominator}
                          </dd>
                        </div>
                        <div>
                          <dt>Record type</dt>
                          <dd>Manual split adjustment</dd>
                        </div>
                        <div>
                          <dt>Cash effect</dt>
                          <dd>None</dd>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <dt>Shares</dt>
                          <dd>{transaction.shares ?? "Not applicable"}</dd>
                        </div>
                        <div>
                          <dt>Gross amount</dt>
                          <dd>{usd(transaction.grossUsd)}</dd>
                        </div>
                        <div>
                          <dt>Trade fee</dt>
                          <dd>{usd(transaction.feeUsd)}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                  <div className="ledger-actions">
                    <button
                      type="button"
                      className="text-button"
                      aria-label={`Move ${transaction.id} earlier`}
                      disabled={
                        locked ||
                        ledger.transactions[absoluteIndex - 1]?.date !==
                          transaction.date
                      }
                      onClick={() => moveSameDay(absoluteIndex, -1)}
                    >
                      Move earlier
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      aria-label={`Move ${transaction.id} later`}
                      disabled={
                        locked ||
                        ledger.transactions[absoluteIndex + 1]?.date !==
                          transaction.date
                      }
                      onClick={() => moveSameDay(absoluteIndex, 1)}
                    >
                      Move later
                    </button>
                  </div>
                </article>
              );
            })}
            <nav
              className="ledger-pagination"
              aria-label="Ledger transaction pages"
            >
              <button
                type="button"
                className="text-button"
                disabled={locked || activePage === 0}
                onClick={() => setPage(activePage - 1)}
              >
                Previous transactions
              </button>
              <span>
                Page {String(activePage + 1)} of {String(pageCount)} · Up to 25
                transactions per page
              </span>
              <button
                type="button"
                className="text-button"
                disabled={locked || activePage + 1 >= pageCount}
                onClick={() => setPage(activePage + 1)}
              >
                Next transactions
              </button>
            </nav>
          </div>

          <details className="ledger-section">
            <summary>Import transactions from CSV</summary>
            <p className="ledger-help">
              UTF-8 CSV only, up to 64 KiB and 100 data rows. The exact
              eight-column header is required. Rows append in file order and
              must use registered listing IDs and matching symbols. Transaction
              IDs must be unique. No network requests are made.
            </p>
            <label className="ledger-csv-label">
              CSV template
              <textarea
                className="ledger-template"
                aria-label="Ledger CSV template"
                readOnly
                value={PERSONAL_PORTFOLIO_LEDGER_CSV_TEMPLATE}
              />
            </label>
            <div className="ledger-actions">
              <label>
                Choose a local CSV file{" "}
                <input
                  className="ledger-file-input"
                  aria-label="Ledger CSV file"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={locked}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void readCsv(file);
                  }}
                />
              </label>
              {reading && <span role="status">Reading CSV locally…</span>}
            </div>
            <label className="ledger-csv-label">
              CSV text
              <textarea
                aria-label="Ledger CSV text"
                maxLength={PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS.bytes}
                rows={8}
                value={currentForm ? csvText : ""}
                disabled={locked || reading}
                onChange={(event) => changeCsv(event.target.value)}
              />
            </label>
            <div className="ledger-actions">
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={locked || reading || csvText.length === 0}
                onClick={previewImport}
              >
                Preview CSV import
              </button>
              <button
                type="button"
                className="text-button"
                disabled={
                  locked ||
                  (!reading && csvText.length === 0 && csvPreview === null)
                }
                onClick={() => {
                  clearCsv();
                  setMessage(
                    "CSV input and preview cleared. No transactions were changed.",
                  );
                }}
              >
                Clear CSV input
              </button>
            </div>
            {activePreview !== null && (
              <div>
                <h4>
                  Review {String(activePreview.rowCount)} imported transactions
                </h4>
                <ol className="ledger-import-preview">
                  {activePreview.transactions.map((transaction) => (
                    <li key={transaction.id}>
                      {transaction.date} · {typeLabel(transaction.type)} ·{" "}
                      {symbol(transaction.listingId)} ·{" "}
                      {transaction.shares === null
                        ? ""
                        : `${transaction.shares} shares · `}
                      {usd(transaction.grossUsd)} · Fee{" "}
                      {usd(transaction.feeUsd)} · ID {transaction.id}
                    </li>
                  ))}
                </ol>
                <p>
                  Resulting cash:{" "}
                  {usd(activePreview.projection.portfolio.cashUsd)} · Resulting
                  holdings:{" "}
                  {String(activePreview.projection.portfolio.holdings.length)}
                </p>
                {activePreview.possibleDuplicateIds.length > 0 && (
                  <div className="discovery-warning">
                    <p>
                      {String(activePreview.possibleDuplicateIds.length)}{" "}
                      imported rows match the date, type, listing, shares,
                      amount, and fee of another transaction. Review IDs:{" "}
                      {activePreview.possibleDuplicateIds.join(", ")}
                    </p>
                    <label className="ledger-duplicate-ack">
                      <input
                        aria-label="Acknowledge possible duplicate transactions"
                        type="checkbox"
                        checked={duplicateAcknowledged}
                        onChange={(event) =>
                          setDuplicateAcknowledged(event.target.checked)
                        }
                      />
                      I reviewed these possible duplicates and want to include
                      them.
                    </label>
                  </div>
                )}
                <button
                  type="button"
                  className="secondary-action compact-action"
                  disabled={
                    locked ||
                    (activePreview.possibleDuplicateIds.length > 0 &&
                      !duplicateAcknowledged)
                  }
                  onClick={applyImport}
                >
                  Apply reviewed transactions
                </button>
              </div>
            )}
          </details>
        </>
      )}
    </section>
  );
}

function emptyForm(ledger: PersonalPortfolioLedgerPayload): TransactionForm {
  return {
    date: today(),
    type: "buy",
    listingId: ledger.identities[0]?.listingId ?? "",
    shares: "",
    grossUsd: "",
    feeUsd: "0",
  };
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function usd(value: string | null) {
  return value === null ? "Unknown" : `${value} USD`;
}
function typeLabel(type: PersonalPortfolioLedgerActivity["type"]) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
function projectionError(
  error: Extract<
    PersonalPortfolioLedgerProjection,
    { status: "invalid" }
  >["error"],
): string {
  const labels = {
    invalid_payload:
      "Check the amount, shares, date, registered listing, and opening balance fields. Amounts must be positive and use at most two decimal places; shares use at most six.",
    invalid_today: "The current date could not be validated.",
    future_date: "Dates cannot be in the future.",
    transaction_order:
      "Transactions must remain in date order. New transactions append; edit existing entries to correct earlier activity.",
    transaction_before_opening:
      "Every transaction date must be strictly after the opening date.",
    oversell:
      "This change would sell more shares than are available at that point in the ledger.",
    negative_cash:
      "This change would make known cash negative at a transaction. Check the opening balance and earlier deposits or sales.",
    cash_limit: "This change exceeds the supported cash limit.",
    shares_limit: "This change exceeds the supported share limit.",
    cost_basis_limit: "This change exceeds the supported cost basis limit.",
    split_no_position:
      "A split has no open position at its chosen place in the ledger.",
    split_fractional_precision:
      "A split would require fractional shares beyond six decimal places. No rounding or cash-in-lieu is assumed.",
  };
  return `No changes applied. ${labels[error.code]}${error.transactionIndex === null ? "" : ` Affected transaction position: ${String(error.transactionIndex + 1)}.`}`;
}

function withActivities(
  ledger: PersonalPortfolioLedgerPayload,
  transactions: readonly PersonalPortfolioLedgerActivity[],
): PersonalPortfolioLedgerPayload {
  if (ledger.schemaVersion === 3) return { ...ledger, transactions };
  return {
    ...ledger,
    transactions: transactions.map((entry) => {
      if (entry.type === "split")
        throw new Error("Split records require an explicit ledger upgrade.");
      return entry;
    }),
  };
}
function csvError(
  error: Extract<
    PersonalPortfolioLedgerCsvResult,
    { status: "invalid" }
  >["error"],
): string {
  const labels = {
    invalid_csv: "The CSV syntax is invalid.",
    too_large: "The CSV exceeds 64 KiB.",
    too_many_rows: "The CSV exceeds 100 data rows.",
    invalid_header: "Use the exact CSV template header and column order.",
    invalid_row: "A row has an invalid field or transaction shape.",
    duplicate_id:
      "A transaction ID is repeated in the CSV or already exists in the ledger.",
    unknown_listing:
      "A listing ID or symbol does not match the registered listing. Register the exact listing before importing.",
    ledger_invalid:
      "The imported rows would violate ledger dates, share availability, cash balances, or supported limits.",
  };
  return `No transactions imported. ${labels[error.code]}${error.row === null ? "" : ` CSV row: ${String(error.row)}.`}`;
}
