import {
  isPersonalPortfolioIdentity,
  isPersonalPortfolioMoney,
  isPersonalPortfolioPayload,
  isPersonalPortfolioShares,
  type PersonalPortfolioIdentity,
  type PersonalPortfolioPayload,
} from "./personal-portfolio";

export const PERSONAL_PORTFOLIO_LEDGER_LIMITS = Object.freeze({
  transactions: 250,
  identities: 20,
  payloadBytes: 256 * 1_024,
  basisMethod: "fifo_with_opening_pool",
  basisRounding: "cumulative_disposed_lot_cost_round_half_up_to_cents",
} as const);

export type PersonalPortfolioLedgerTransaction = Readonly<{
  id: string;
  date: string;
  type: "buy" | "sell" | "deposit" | "withdrawal" | "dividend" | "fee";
  listingId: string | null;
  shares: string | null;
  grossUsd: string;
  feeUsd: string;
}>;

export type PersonalPortfolioLedgerOpeningHolding = Readonly<{
  listingId: string;
  shares: string;
  totalCostBasisUsd: string | null;
  confirmedOn: string;
}>;

export type PersonalPortfolioLedgerPayload = Readonly<{
  schemaVersion: 2;
  name: "My Portfolio";
  currency: "USD";
  snapshotSha256: string;
  basisMethod: "fifo_with_opening_pool";
  identities: readonly PersonalPortfolioIdentity[];
  opening: Readonly<{
    asOfDate: string;
    cashUsd: string | null;
    holdings: readonly PersonalPortfolioLedgerOpeningHolding[];
  }>;
  transactions: readonly PersonalPortfolioLedgerTransaction[];
}>;

export type PersonalPortfolioStoredPayload =
  PersonalPortfolioPayload | PersonalPortfolioLedgerPayload;

export type PersonalPortfolioLedgerLot = Readonly<{
  lotId: string;
  listingId: string;
  openedOn: string;
  source: "opening_pool" | "buy";
  originalShares: string;
  remainingShares: string;
  originalCostBasisUsd: string | null;
  remainingCostBasisUsd: string | null;
  disposedCostBasisUsd: string | null;
}>;

export type PersonalPortfolioLedgerDisposal = Readonly<{
  transactionId: string;
  date: string;
  listingId: string;
  shares: string;
  netProceedsUsd: string;
  allocatedCostBasisUsd: string | null;
  gainUsd: string | null;
}>;

export type PersonalPortfolioLedgerProjectionErrorCode =
  | "invalid_payload"
  | "invalid_today"
  | "future_date"
  | "transaction_order"
  | "transaction_before_opening"
  | "oversell"
  | "negative_cash"
  | "cash_limit"
  | "shares_limit"
  | "cost_basis_limit";

export type PersonalPortfolioLedgerProjection =
  | Readonly<{
      status: "invalid";
      error: Readonly<{
        code: PersonalPortfolioLedgerProjectionErrorCode;
        transactionIndex: number | null;
      }>;
    }>
  | Readonly<{
      status: "valid";
      portfolio: PersonalPortfolioPayload;
      lots: readonly PersonalPortfolioLedgerLot[];
      realized: Readonly<{
        sales: number;
        knownSales: number;
        unknownSales: number;
        knownGainSubtotalUsd: string;
        totalGainUsd: string | null;
        disposals: readonly PersonalPortfolioLedgerDisposal[];
      }>;
      cashFlows: Readonly<{
        depositsUsd: string;
        withdrawalsUsd: string;
        dividendsUsd: string;
        standaloneFeesUsd: string;
        tradeFeesUsd: string;
        buysGrossUsd: string;
        sellsGrossUsd: string;
        netCashChangeUsd: string;
      }>;
      cashCheck: "known_nonnegative" | "unknown_opening_cash";
    }>;

type MutableLot = {
  lotId: string;
  listingId: string;
  openedOn: string;
  source: "opening_pool" | "buy";
  originalShares: bigint;
  remainingShares: bigint;
  originalCost: bigint | null;
  disposedCost: bigint;
};

const MAXIMUM_SHARES = 1_000_000_000n * 1_000_000n;
const MAXIMUM_MONEY = 1_000_000_000_000n * 100n;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const PAYLOAD_KEYS = [
  "schemaVersion",
  "name",
  "currency",
  "snapshotSha256",
  "basisMethod",
  "identities",
  "opening",
  "transactions",
] as const;
const OPENING_KEYS = ["asOfDate", "cashUsd", "holdings"] as const;
const OPENING_HOLDING_KEYS = [
  "listingId",
  "shares",
  "totalCostBasisUsd",
  "confirmedOn",
] as const;
const TRANSACTION_KEYS = [
  "id",
  "date",
  "type",
  "listingId",
  "shares",
  "grossUsd",
  "feeUsd",
] as const;

export function isPersonalPortfolioStoredPayload(
  value: unknown,
  today?: string,
): value is PersonalPortfolioStoredPayload {
  return (
    isPersonalPortfolioPayload(value, today) ||
    isPersonalPortfolioLedgerPayload(value, today)
  );
}

/** Includes semantic projection checks, not merely schema validation. */
export function isPersonalPortfolioLedgerPayload(
  value: unknown,
  today?: string,
): value is PersonalPortfolioLedgerPayload {
  return projectPersonalPortfolioLedger(value, today).status === "valid";
}

/** Validates one row independently of ledger chronology, identities and balances. */
export function isPersonalPortfolioLedgerTransaction(
  value: unknown,
): value is PersonalPortfolioLedgerTransaction {
  if (
    !exactRecord(value, TRANSACTION_KEYS) ||
    typeof value.id !== "string" ||
    !IDENTIFIER.test(value.id) ||
    !calendarDate(value.date) ||
    !isPersonalPortfolioMoney(value.grossUsd) ||
    scaled(value.grossUsd, 2) === 0n ||
    !isPersonalPortfolioMoney(value.feeUsd)
  )
    return false;
  if (value.type === "buy" || value.type === "sell") {
    return (
      typeof value.listingId === "string" &&
      IDENTIFIER.test(value.listingId) &&
      isPersonalPortfolioShares(value.shares) &&
      (value.type !== "sell" ||
        scaled(value.feeUsd, 2) <= scaled(value.grossUsd, 2))
    );
  }
  if (value.type === "dividend") {
    return (
      typeof value.listingId === "string" &&
      IDENTIFIER.test(value.listingId) &&
      value.shares === null &&
      scaled(value.feeUsd, 2) === 0n
    );
  }
  return (
    (value.type === "deposit" ||
      value.type === "withdrawal" ||
      value.type === "fee") &&
    value.listingId === null &&
    value.shares === null &&
    scaled(value.feeUsd, 2) === 0n
  );
}

/**
 * Opening amounts are an end-of-day balance. Array order is the execution
 * order for transactions on the same later date. This is a local FIFO
 * estimate, with each entered opening holding treated as one pooled lot.
 */
export function projectPersonalPortfolioLedger(
  value: unknown,
  today?: string,
): PersonalPortfolioLedgerProjection {
  try {
    if (today !== undefined && !calendarDate(today))
      return invalid("invalid_today");
    if (!ledgerShape(value)) return invalid("invalid_payload");
    return projectValidated(value, today);
  } catch {
    return invalid("invalid_payload");
  }
}

function projectValidated(
  ledger: PersonalPortfolioLedgerPayload,
  today: string | undefined,
): PersonalPortfolioLedgerProjection {
  if (today !== undefined && ledger.opening.asOfDate > today) {
    return invalid("future_date");
  }
  const identityByListing = new Map(
    ledger.identities.map((identity) => [identity.listingId, identity]),
  );
  const confirmedDates = new Map(
    ledger.opening.holdings.map((holding) => [
      holding.listingId,
      holding.confirmedOn,
    ]),
  );
  const lots: MutableLot[] = ledger.opening.holdings.map((holding) => ({
    lotId: `opening:${holding.listingId}`,
    listingId: holding.listingId,
    openedOn: ledger.opening.asOfDate,
    source: "opening_pool",
    originalShares: scaled(holding.shares, 6),
    remainingShares: scaled(holding.shares, 6),
    originalCost:
      holding.totalCostBasisUsd === null
        ? null
        : scaled(holding.totalCostBasisUsd, 2),
    disposedCost: 0n,
  }));
  let cash =
    ledger.opening.cashUsd === null ? null : scaled(ledger.opening.cashUsd, 2);
  let lastDate = ledger.opening.asOfDate;
  let deposits = 0n;
  let withdrawals = 0n;
  let dividends = 0n;
  let standaloneFees = 0n;
  let tradeFees = 0n;
  let buysGross = 0n;
  let sellsGross = 0n;
  let netCashChange = 0n;
  let knownGain = 0n;
  let unknownSales = 0;
  const disposals: PersonalPortfolioLedgerDisposal[] = [];

  for (const [index, transaction] of ledger.transactions.entries()) {
    if (transaction.date <= ledger.opening.asOfDate)
      return invalid("transaction_before_opening", index);
    if (transaction.date < lastDate) return invalid("transaction_order", index);
    if (today !== undefined && transaction.date > today)
      return invalid("future_date", index);
    lastDate = transaction.date;
    const gross = scaled(transaction.grossUsd, 2);
    const fee = scaled(transaction.feeUsd, 2);
    let cashChange: bigint;
    if (transaction.type === "buy") {
      const quantity = scaled(transaction.shares!, 6);
      lots.push({
        lotId: `buy:${transaction.id}`,
        listingId: transaction.listingId!,
        openedOn: transaction.date,
        source: "buy",
        originalShares: quantity,
        remainingShares: quantity,
        originalCost: gross + fee,
        disposedCost: 0n,
      });
      confirmedDates.set(transaction.listingId!, transaction.date);
      cashChange = -gross - fee;
      buysGross += gross;
      tradeFees += fee;
    } else if (transaction.type === "sell") {
      const quantity = scaled(transaction.shares!, 6);
      const candidates = lots.filter(
        (lot) =>
          lot.listingId === transaction.listingId && lot.remainingShares > 0n,
      );
      if (
        candidates.reduce((sum, lot) => sum + lot.remainingShares, 0n) <
        quantity
      )
        return invalid("oversell", index);
      let remaining = quantity;
      let disposedBasis = 0n;
      let basisKnown = true;
      for (const lot of candidates) {
        if (remaining === 0n) break;
        const used =
          remaining < lot.remainingShares ? remaining : lot.remainingShares;
        lot.remainingShares -= used;
        remaining -= used;
        if (lot.originalCost === null) basisKnown = false;
        else {
          const cumulativeSold = lot.originalShares - lot.remainingShares;
          const cumulativeCost = roundHalfUp(
            lot.originalCost * cumulativeSold,
            lot.originalShares,
          );
          disposedBasis += cumulativeCost - lot.disposedCost;
          lot.disposedCost = cumulativeCost;
        }
      }
      const proceeds = gross - fee;
      const gain = basisKnown ? proceeds - disposedBasis : null;
      if (gain === null) unknownSales += 1;
      else knownGain += gain;
      disposals.push({
        transactionId: transaction.id,
        date: transaction.date,
        listingId: transaction.listingId!,
        shares: decimal(quantity, 6),
        netProceedsUsd: money(proceeds),
        allocatedCostBasisUsd: basisKnown ? money(disposedBasis) : null,
        gainUsd: gain === null ? null : money(gain),
      });
      confirmedDates.set(transaction.listingId!, transaction.date);
      cashChange = proceeds;
      sellsGross += gross;
      tradeFees += fee;
    } else if (transaction.type === "deposit") {
      deposits += gross;
      cashChange = gross;
    } else if (transaction.type === "withdrawal") {
      withdrawals += gross;
      cashChange = -gross;
    } else if (transaction.type === "dividend") {
      dividends += gross;
      cashChange = gross;
    } else {
      standaloneFees += gross;
      cashChange = -gross;
    }
    netCashChange += cashChange;
    if (cash !== null) {
      cash += cashChange;
      if (cash < 0n) return invalid("negative_cash", index);
      if (cash > MAXIMUM_MONEY) return invalid("cash_limit", index);
    }
    if (transaction.type === "buy" || transaction.type === "sell") {
      const active = lots.filter(
        (lot) =>
          lot.listingId === transaction.listingId && lot.remainingShares > 0n,
      );
      if (
        active.reduce((sum, lot) => sum + lot.remainingShares, 0n) >
        MAXIMUM_SHARES
      )
        return invalid("shares_limit", index);
      if (
        active.reduce(
          (sum, lot) =>
            sum +
            (lot.originalCost === null
              ? 0n
              : lot.originalCost - lot.disposedCost),
          0n,
        ) > MAXIMUM_MONEY
      )
        return invalid("cost_basis_limit", index);
    }
  }

  const holdings: PersonalPortfolioPayload["holdings"][number][] = [];
  for (const [listingId, identity] of identityByListing) {
    const active = lots.filter(
      (lot) => lot.listingId === listingId && lot.remainingShares > 0n,
    );
    if (active.length === 0) continue;
    const shares = active.reduce((sum, lot) => sum + lot.remainingShares, 0n);
    const knownBasis = active.reduce(
      (sum, lot) =>
        sum +
        (lot.originalCost === null ? 0n : lot.originalCost - lot.disposedCost),
      0n,
    );
    holdings.push({
      identity: { ...identity },
      shares: decimal(shares, 6),
      totalCostBasisUsd: active.some((lot) => lot.originalCost === null)
        ? null
        : money(knownBasis),
      confirmedOn: confirmedDates.get(listingId)!,
    });
  }
  return freezeDeep({
    status: "valid",
    portfolio: {
      schemaVersion: 1,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: ledger.snapshotSha256,
      cashUsd: cash === null ? null : money(cash),
      holdings,
    },
    lots: lots.map((lot) => ({
      lotId: lot.lotId,
      listingId: lot.listingId,
      openedOn: lot.openedOn,
      source: lot.source,
      originalShares: decimal(lot.originalShares, 6),
      remainingShares: decimal(lot.remainingShares, 6),
      originalCostBasisUsd:
        lot.originalCost === null ? null : money(lot.originalCost),
      remainingCostBasisUsd:
        lot.remainingShares === 0n
          ? "0.00"
          : lot.originalCost === null
            ? null
            : money(lot.originalCost - lot.disposedCost),
      disposedCostBasisUsd:
        lot.originalCost === null ? null : money(lot.disposedCost),
    })),
    realized: {
      sales: disposals.length,
      knownSales: disposals.length - unknownSales,
      unknownSales,
      knownGainSubtotalUsd: money(knownGain),
      totalGainUsd: unknownSales === 0 ? money(knownGain) : null,
      disposals,
    },
    cashFlows: {
      depositsUsd: money(deposits),
      withdrawalsUsd: money(withdrawals),
      dividendsUsd: money(dividends),
      standaloneFeesUsd: money(standaloneFees),
      tradeFeesUsd: money(tradeFees),
      buysGrossUsd: money(buysGross),
      sellsGrossUsd: money(sellsGross),
      netCashChangeUsd: money(netCashChange),
    },
    cashCheck: cash === null ? "unknown_opening_cash" : "known_nonnegative",
  });
}

function ledgerShape(value: unknown): value is PersonalPortfolioLedgerPayload {
  if (
    !exactRecord(value, PAYLOAD_KEYS) ||
    value.schemaVersion !== 2 ||
    value.name !== "My Portfolio" ||
    value.currency !== "USD" ||
    typeof value.snapshotSha256 !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(value.snapshotSha256) ||
    value.basisMethod !== "fifo_with_opening_pool" ||
    !denseArray(
      value.identities,
      PERSONAL_PORTFOLIO_LEDGER_LIMITS.identities,
    ) ||
    !value.identities.every(isPersonalPortfolioIdentity) ||
    !exactRecord(value.opening, OPENING_KEYS) ||
    !calendarDate(value.opening.asOfDate) ||
    (value.opening.cashUsd !== null &&
      !isPersonalPortfolioMoney(value.opening.cashUsd)) ||
    !denseArray(
      value.opening.holdings,
      PERSONAL_PORTFOLIO_LEDGER_LIMITS.identities,
    ) ||
    !denseArray(
      value.transactions,
      PERSONAL_PORTFOLIO_LEDGER_LIMITS.transactions,
    )
  )
    return false;
  const identities = new Set(
    value.identities.map((identity) => identity.listingId),
  );
  if (identities.size !== value.identities.length) return false;
  const openingListings = new Set<string>();
  for (const holding of value.opening.holdings) {
    if (
      !exactRecord(holding, OPENING_HOLDING_KEYS) ||
      typeof holding.listingId !== "string" ||
      !identities.has(holding.listingId) ||
      openingListings.has(holding.listingId) ||
      !isPersonalPortfolioShares(holding.shares) ||
      (holding.totalCostBasisUsd !== null &&
        !isPersonalPortfolioMoney(holding.totalCostBasisUsd)) ||
      !calendarDate(holding.confirmedOn) ||
      holding.confirmedOn > value.opening.asOfDate
    )
      return false;
    openingListings.add(holding.listingId);
  }
  const transactionIds = new Set<string>();
  for (const transaction of value.transactions) {
    if (
      !isPersonalPortfolioLedgerTransaction(transaction) ||
      transactionIds.has(transaction.id) ||
      (transaction.listingId !== null && !identities.has(transaction.listingId))
    )
      return false;
    transactionIds.add(transaction.id);
  }
  return (
    new TextEncoder().encode(JSON.stringify(value)).byteLength <=
    PERSONAL_PORTFOLIO_LEDGER_LIMITS.payloadBytes
  );
}

function scaled(value: string, places: number): bigint {
  const [integer = "0", fraction = ""] = value.split(".");
  return BigInt(`${integer}${fraction.padEnd(places, "0")}`);
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  return quotient + (2n * (numerator % denominator) >= denominator ? 1n : 0n);
}

function money(value: bigint): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(3, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

function decimal(value: bigint, places: number): string {
  const digits = value.toString().padStart(places + 1, "0");
  const fraction = digits.slice(-places).replace(/0+$/u, "");
  return `${digits.slice(0, -places)}${fraction === "" ? "" : `.${fraction}`}`;
}

function calendarDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u.test(value)
  )
    return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
}

function exactRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Reflect.ownKeys(value).length === keys.length &&
    keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        descriptor !== undefined &&
        "value" in descriptor &&
        descriptor.enumerable === true
      );
    })
  );
}

function denseArray(
  value: unknown,
  maximum: number,
): value is readonly unknown[] {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    return false;
  return Array.from({ length: value.length }, (_, index) =>
    Object.getOwnPropertyDescriptor(value, String(index)),
  ).every(
    (descriptor) =>
      descriptor !== undefined &&
      "value" in descriptor &&
      descriptor.enumerable === true,
  );
}

function invalid(
  code: PersonalPortfolioLedgerProjectionErrorCode,
  transactionIndex: number | null = null,
): PersonalPortfolioLedgerProjection {
  return Object.freeze({
    status: "invalid",
    error: Object.freeze({ code, transactionIndex }),
  });
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) freezeDeep(item);
    Object.freeze(value);
  }
  return value;
}
