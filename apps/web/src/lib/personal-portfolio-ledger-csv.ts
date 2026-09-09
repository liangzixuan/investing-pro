import {
  isPersonalPortfolioLedgerTransaction,
  projectPersonalPortfolioLedger,
  type PersonalPortfolioLedgerPayload,
  type PersonalPortfolioLedgerTransaction,
} from "@research-cockpit/contracts";

export const PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS = Object.freeze({
  bytes: 65_536,
  rows: 100,
});
const HEADER = [
  "id",
  "date",
  "type",
  "listingId",
  "symbol",
  "shares",
  "grossUsd",
  "feeUsd",
] as const;
export const PERSONAL_PORTFOLIO_LEDGER_CSV_TEMPLATE = `${HEADER.join(",")}\nexample-deposit-001,2026-01-02,deposit,,,,1000.00,0.00\n`;

export type PersonalPortfolioLedgerCsvResult =
  | Readonly<{
      status: "valid";
      transactions: readonly PersonalPortfolioLedgerTransaction[];
      candidate: PersonalPortfolioLedgerPayload;
      projection: Extract<
        ReturnType<typeof projectPersonalPortfolioLedger>,
        { status: "valid" }
      >;
      possibleDuplicateIds: readonly string[];
      rowCount: number;
    }>
  | Readonly<{
      status: "invalid";
      error: Readonly<{
        code:
          | "invalid_csv"
          | "too_large"
          | "too_many_rows"
          | "invalid_header"
          | "invalid_row"
          | "duplicate_id"
          | "unknown_listing"
          | "ledger_invalid";
        row: number | null;
        ledgerCode?: string;
      }>;
    }>;
type FailureCode = Extract<
  PersonalPortfolioLedgerCsvResult,
  { status: "invalid" }
>["error"]["code"];
type CsvRow = Readonly<{ cells: readonly string[]; line: number }>;

/** Parses an application-owned import format; never guesses broker columns or identities. */
export function parsePersonalPortfolioLedgerCsv(
  text: string,
  ledger: PersonalPortfolioLedgerPayload,
  today?: string,
): PersonalPortfolioLedgerCsvResult {
  if (typeof text !== "string") return invalid("invalid_csv");
  if (
    text.length > PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS.bytes ||
    new TextEncoder().encode(text).byteLength >
      PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS.bytes
  )
    return invalid("too_large");
  if (text.startsWith("\uFEFF")) text = text.slice(1);
  if (/(?![\r\n\t])[\p{Cc}\p{Cf}\p{Cs}]/u.test(text))
    return invalid("invalid_csv");
  const parsed = readRows(text);
  if (parsed === null) return invalid("invalid_csv");
  const header = parsed[0];
  if (
    !header ||
    header.cells.length !== HEADER.length ||
    !HEADER.every((name, index) => header.cells[index] === name)
  )
    return invalid("invalid_header", 1);
  const rows = parsed.slice(1);
  if (rows.length === 0) return invalid("invalid_row", 2);
  if (rows.length > PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS.rows)
    return invalid("too_many_rows");
  const initial = projectPersonalPortfolioLedger(ledger, today);
  if (initial.status !== "valid")
    return invalid("ledger_invalid", null, initial.error.code);
  const identities = new Map(
    ledger.identities.map((identity) => [identity.listingId, identity]),
  );
  const ids = new Set(ledger.transactions.map((transaction) => transaction.id));
  const transactions: PersonalPortfolioLedgerTransaction[] = [];
  for (const row of rows) {
    if (
      row.cells.length !== HEADER.length ||
      row.cells.some(
        (cell) =>
          cell !== cell.trim() ||
          /[\r\n\t]/u.test(cell) ||
          /^[=+@-]/u.test(cell),
      )
    )
      return invalid("invalid_row", row.line);
    const [id, date, type, listingId, symbol, shares, grossUsd, feeUsd] =
      row.cells;
    if (
      id === undefined ||
      date === undefined ||
      type === undefined ||
      listingId === undefined ||
      symbol === undefined ||
      shares === undefined ||
      grossUsd === undefined ||
      feeUsd === undefined
    )
      return invalid("invalid_row", row.line);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(id))
      return invalid("invalid_row", row.line);
    if (ids.has(id)) return invalid("duplicate_id", row.line);
    ids.add(id);
    if (
      type !== "buy" &&
      type !== "sell" &&
      type !== "deposit" &&
      type !== "withdrawal" &&
      type !== "dividend" &&
      type !== "fee"
    )
      return invalid("invalid_row", row.line);
    const needsListing =
      type === "buy" || type === "sell" || type === "dividend";
    if (needsListing) {
      const identity = identities.get(listingId);
      if (!identity || identity.symbol !== symbol)
        return invalid("unknown_listing", row.line);
    } else if (listingId !== "" || symbol !== "")
      return invalid("invalid_row", row.line);
    const transaction = {
      id,
      date,
      type,
      listingId: listingId === "" ? null : listingId,
      shares: shares === "" ? null : shares,
      grossUsd,
      feeUsd,
    };
    if (!isPersonalPortfolioLedgerTransaction(transaction))
      return invalid("invalid_row", row.line);
    transactions.push(Object.freeze(transaction));
  }
  const candidate: PersonalPortfolioLedgerPayload = Object.freeze({
    ...ledger,
    identities: Object.freeze(
      ledger.identities.map((identity) => Object.freeze({ ...identity })),
    ),
    opening: Object.freeze({
      ...ledger.opening,
      holdings: Object.freeze(
        ledger.opening.holdings.map((holding) => Object.freeze({ ...holding })),
      ),
    }),
    transactions: Object.freeze([
      ...ledger.transactions.map((transaction) =>
        Object.freeze({ ...transaction }),
      ),
      ...transactions,
    ]),
  });
  const projection = projectPersonalPortfolioLedger(candidate, today);
  if (projection.status !== "valid") {
    const index = projection.error.transactionIndex;
    const sourceRow =
      index === null ? undefined : rows[index - ledger.transactions.length];
    return invalid(
      "ledger_invalid",
      sourceRow?.line ?? null,
      projection.error.code,
    );
  }
  const seen = new Set(ledger.transactions.map(fingerprint));
  const possibleDuplicateIds: string[] = [];
  for (const transaction of transactions) {
    const key = fingerprint(transaction);
    if (seen.has(key)) possibleDuplicateIds.push(transaction.id);
    seen.add(key);
  }
  return Object.freeze({
    status: "valid",
    transactions: Object.freeze(transactions),
    candidate,
    projection,
    possibleDuplicateIds: Object.freeze(possibleDuplicateIds),
    rowCount: transactions.length,
  });
}

function fingerprint(transaction: PersonalPortfolioLedgerTransaction): string {
  return JSON.stringify([
    transaction.date,
    transaction.type,
    transaction.listingId,
    canonicalDecimal(transaction.shares),
    canonicalDecimal(transaction.grossUsd),
    canonicalDecimal(transaction.feeUsd),
  ]);
}

function canonicalDecimal(value: string | null): string | null {
  if (value === null) return null;
  const [integer = "0", fraction = ""] = value.split(".");
  const significantFraction = fraction.replace(/0+$/u, "");
  return significantFraction === ""
    ? integer
    : `${integer}.${significantFraction}`;
}

function invalid(
  code: FailureCode,
  row: number | null = null,
  ledgerCode?: string,
): PersonalPortfolioLedgerCsvResult {
  return Object.freeze({
    status: "invalid",
    error: Object.freeze({
      code,
      row,
      ...(ledgerCode === undefined ? {} : { ledgerCode }),
    }),
  });
}

/** Strict quoted fields with LF or CRLF record endings and optional final newline. */
function readRows(text: string): CsvRow[] | null {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let state: "start" | "plain" | "quoted" | "closed" = "start";
  let line = 1;
  let rowLine = 1;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (state === "quoted") {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else state = "closed";
      } else {
        cell += character;
        if (character === "\n") line += 1;
      }
      continue;
    }
    if (character === ",") {
      cells.push(cell);
      cell = "";
      state = "start";
      continue;
    }
    if (character === "\n" || character === "\r") {
      if (character === "\r") {
        if (text[index + 1] !== "\n") return null;
        index += 1;
      }
      cells.push(cell);
      rows.push({ cells, line: rowLine });
      if (rows.length > PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS.rows + 1)
        return rows;
      cells = [];
      cell = "";
      state = "start";
      line += 1;
      rowLine = line;
      continue;
    }
    if (state === "closed") return null;
    if (character === '"') {
      if (state !== "start") return null;
      state = "quoted";
    } else {
      cell += character;
      state = "plain";
    }
  }
  if (state === "quoted") return null;
  if (cells.length > 0 || cell.length > 0 || state !== "start") {
    cells.push(cell);
    rows.push({ cells, line: rowLine });
  }
  return rows;
}
