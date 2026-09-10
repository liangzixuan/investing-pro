import type {
  PersonalPortfolioLedgerPayload,
  PersonalPortfolioLedgerPayloadV2,
  PersonalPortfolioLedgerPayloadV3,
  PersonalPortfolioLedgerTransaction,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";

import {
  parsePersonalPortfolioLedgerCsv,
  PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS,
  PERSONAL_PORTFOLIO_LEDGER_CSV_TEMPLATE,
} from "./personal-portfolio-ledger-csv";

const HEADER = "id,date,type,listingId,symbol,shares,grossUsd,feeUsd";
const TODAY = "2026-09-09";

describe("personal portfolio ledger CSV import", () => {
  it("preserves schema 3 split history while previewing financial trades and duplicate warnings", () => {
    const source = splitLedger();
    const before = JSON.stringify(source);
    const result = parsePersonalPortfolioLedgerCsv(
      [
        HEADER,
        csvRow({ id: "new-duplicate-buy" }),
        csvRow({
          id: "sell-adjusted-shares",
          type: "sell",
          shares: "20",
          grossUsd: "60",
          feeUsd: "0",
        }),
      ].join("\n"),
      source,
      TODAY,
    );
    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error("Expected valid CSV");
    expect(result.candidate.schemaVersion).toBe(3);
    expect(result.candidate.transactions.slice(0, 2)).toEqual(
      source.transactions,
    );
    expect(result.candidate.transactions[0]).not.toBe(source.transactions[0]);
    expect(Object.isFrozen(result.candidate.transactions[0])).toBe(true);
    expect(Object.isFrozen(source.transactions[0])).toBe(false);
    expect(result.transactions).toHaveLength(2);
    expect(result.possibleDuplicateIds).toEqual(["new-duplicate-buy"]);
    expect(result.projection.portfolio).toMatchObject({
      cashUsd: "138.00",
      holdings: [{ shares: "2", totalCostBasisUsd: "22.00" }],
    });
    expect(result.projection.realized.totalGainUsd).toBe("10.00");
    expect(JSON.stringify(source)).toBe(before);
  });

  it("rejects imported split rows and IDs already used by saved splits", () => {
    const source = splitLedger();
    expect(
      parsePersonalPortfolioLedgerCsv(
        HEADER + "\n" + csvRow({ id: "saved-split" }),
        source,
        TODAY,
      ),
    ).toMatchObject({ error: { code: "duplicate_id", row: 2 } });
    expect(
      parsePersonalPortfolioLedgerCsv(
        HEADER + "\n" + csvRow({ id: "new-split", type: "split" }),
        source,
        TODAY,
      ),
    ).toMatchObject({ error: { code: "invalid_row", row: 2 } });
    expect(
      parsePersonalPortfolioLedgerCsv(
        HEADER +
          ",ratioNumerator,ratioDenominator\n" +
          csvRow({ id: "new-split", type: "split" }) +
          ",2,1",
        source,
        TODAY,
      ),
    ).toMatchObject({ error: { code: "invalid_header", row: 1 } });
  });

  it("counts split rows toward the shared activity limit and preserves chronological import errors", () => {
    const source = splitLedger();
    const maximum: PersonalPortfolioLedgerPayloadV3 = {
      ...source,
      transactions: [
        source.transactions[0]!,
        ...Array.from(
          { length: 249 },
          (_, index): PersonalPortfolioLedgerTransaction => ({
            id: `saved-deposit-${String(index)}`,
            date: "2026-01-03",
            type: "deposit",
            listingId: null,
            shares: null,
            grossUsd: "1",
            feeUsd: "0",
          }),
        ),
      ],
    };
    const result = parsePersonalPortfolioLedgerCsv(
      HEADER + "\n" + csvRow({ id: "too-many", date: "2026-01-03" }),
      maximum,
      TODAY,
    );
    expect(result).toMatchObject({
      error: { code: "ledger_invalid", ledgerCode: "invalid_payload" },
    });
    expect(result).not.toHaveProperty("candidate");
    const laterSplit: PersonalPortfolioLedgerPayloadV3 = {
      ...source,
      transactions: [{ ...source.transactions[0]!, date: "2026-01-03" }],
    };
    expect(
      parsePersonalPortfolioLedgerCsv(
        HEADER + "\n" + csvRow(),
        laterSplit,
        TODAY,
      ),
    ).toMatchObject({
      error: {
        code: "ledger_invalid",
        row: 2,
        ledgerCode: "transaction_order",
      },
    });
  });

  it("parses the owned template and previews derived balances without mutating the ledger", () => {
    const source = ledger();
    const before = JSON.stringify(source);
    const result = parsePersonalPortfolioLedgerCsv(
      PERSONAL_PORTFOLIO_LEDGER_CSV_TEMPLATE,
      source,
      TODAY,
    );
    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error("Expected valid CSV");
    expect(result.rowCount).toBe(1);
    expect(result.transactions).toEqual([
      {
        id: "example-deposit-001",
        date: "2026-01-02",
        type: "deposit",
        listingId: null,
        shares: null,
        grossUsd: "1000.00",
        feeUsd: "0.00",
      },
    ]);
    expect(result.projection.portfolio.cashUsd).toBe("1100.00");
    expect(result.candidate.transactions).toEqual(result.transactions);
    expect(result.possibleDuplicateIds).toEqual([]);
    expect(JSON.stringify(source)).toBe(before);
    expect(Object.isFrozen(source.opening)).toBe(false);
    expect(Object.isFrozen(result.candidate.opening)).toBe(true);
    expect(result.candidate.opening).not.toBe(source.opening);
    expect(result.candidate.identities[0]).not.toBe(source.identities[0]);
    expect(result.candidate.opening.holdings[0]).not.toBe(
      source.opening.holdings[0],
    );
  });

  it.each(["\n", "\r\n"])(
    "accepts strict quoted fields, UTF-8 BOM, %j endings and optional final newline",
    (ending) => {
      const rows = [HEADER, csvRow()];
      const quoted = rows
        .map((row) =>
          row
            .split(",")
            .map((cell) => `"${cell}"`)
            .join(","),
        )
        .join(ending);
      for (const text of [
        quoted,
        quoted + ending,
        "\uFEFF" + quoted + ending,
      ]) {
        const result = parsePersonalPortfolioLedgerCsv(text, ledger(), TODAY);
        expect(result.status).toBe("valid");
        if (result.status !== "valid") throw new Error("Expected valid CSV");
        expect(result.projection.portfolio.cashUsd).toBe("89.00");
        expect(result.projection.portfolio.holdings[0]).toMatchObject({
          shares: "11",
          totalCostBasisUsd: "61.00",
        });
      }
    },
  );

  it.each([
    HEADER + '\n"unterminated',
    HEADER + '\n"closed"suffix,2026-01-02,deposit,,,,1,0',
    HEADER + '\nid"quote,2026-01-02,deposit,,,,1,0',
    HEADER + "\r" + csvRow(),
    HEADER + "\n" + csvRow() + "\r",
  ])("rejects malformed CSV framing %#", (text) => {
    expect(
      parsePersonalPortfolioLedgerCsv(text, ledger(), TODAY),
    ).toMatchObject({ status: "invalid", error: { code: "invalid_csv" } });
  });

  it.each([
    "",
    "ID,date,type,listingId,symbol,shares,grossUsd,feeUsd\n" + csvRow(),
    "date,id,type,listingId,symbol,shares,grossUsd,feeUsd\n" + csvRow(),
    HEADER + ",extra\n" + csvRow() + ",extra",
    HEADER.replace("feeUsd", "grossUsd") + "\n" + csvRow(),
    " " + HEADER + "\n" + csvRow(),
    HEADER.replace(",", ";") + "\n" + csvRow(),
  ])(
    "rejects unknown, missing, reordered, or duplicated headers %#",
    (text) => {
      expect(
        parsePersonalPortfolioLedgerCsv(text, ledger(), TODAY),
      ).toMatchObject({
        status: "invalid",
        error: { code: "invalid_header", row: 1 },
      });
    },
  );

  it.each([
    HEADER,
    HEADER + "\n",
    HEADER + "\n\n" + csvRow(),
    HEADER + "\n" + csvRow().replace(",1,10,1", ",1,10"),
    HEADER + "\n" + csvRow() + ",extra",
    HEADER + "\n" + csvRow() + "\n\n",
    HEADER + '\n"escaped""quote",2026-01-02,deposit,,,,1,0',
    HEADER + '\n"line\nbreak",2026-01-02,deposit,,,,1,0',
  ])(
    "rejects incomplete or blank records and disallowed field content %#",
    (text) => {
      expect(
        parsePersonalPortfolioLedgerCsv(text, ledger(), TODAY),
      ).toMatchObject({ status: "invalid", error: { code: "invalid_row" } });
    },
  );

  it("enforces byte limits before parsing, including multibyte UTF-8 text", () => {
    const limit = PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS.bytes;
    expect(
      parsePersonalPortfolioLedgerCsv("x".repeat(limit + 1), ledger()),
    ).toMatchObject({ error: { code: "too_large" } });
    expect(
      parsePersonalPortfolioLedgerCsv("é".repeat(limit / 2 + 1), ledger()),
    ).toMatchObject({ error: { code: "too_large" } });
    expect(
      parsePersonalPortfolioLedgerCsv("x".repeat(limit), ledger()),
    ).toMatchObject({ error: { code: "invalid_header" } });
    expect(
      parsePersonalPortfolioLedgerCsv(undefined as unknown as string, ledger()),
    ).toMatchObject({ error: { code: "invalid_csv" } });
  });

  it("accepts 100 rows and rejects a 101-row file without producing a partial candidate", () => {
    const rows = Array.from(
      { length: PERSONAL_PORTFOLIO_LEDGER_CSV_LIMITS.rows },
      (_, index) =>
        csvRow({
          id: `deposit-${String(index)}`,
          type: "deposit",
          listingId: "",
          symbol: "",
          shares: "",
          grossUsd: "1",
          feeUsd: "0",
        }),
    );
    const result = parsePersonalPortfolioLedgerCsv(
      [HEADER, ...rows].join("\n"),
      ledger(),
      TODAY,
    );
    expect(result).toMatchObject({ status: "valid", rowCount: 100 });
    const invalid = parsePersonalPortfolioLedgerCsv(
      [HEADER, ...rows, rows[0]].join("\n"),
      ledger(),
      TODAY,
    );
    expect(invalid).toMatchObject({
      status: "invalid",
      error: { code: "too_many_rows" },
    });
    expect(invalid).not.toHaveProperty("candidate");
  });

  it.each(["\u0000", "\u0007", "\u007f", "\u202e", "\ud800", "\ufeff"])(
    "rejects hidden/control text %j without echoing row content",
    (hidden) => {
      const result = parsePersonalPortfolioLedgerCsv(
        HEADER + "\n" + csvRow({ id: `private-canary${hidden}` }),
        ledger(),
        TODAY,
      );
      expect(result).toMatchObject({
        status: "invalid",
        error: { code: "invalid_csv" },
      });
      expect(JSON.stringify(result)).not.toContain("private-canary");
    },
  );

  it.each([
    { id: "=SUM(1)" },
    { id: "+formula" },
    { id: "@formula" },
    { id: "-formula" },
    { shares: " 1" },
    { shares: "1 " },
    { shares: "\t1" },
    { shares: "=1+1" },
    { shares: "1e2" },
    { shares: "1,000" },
    { shares: "01" },
    { shares: "0.0000001" },
    { grossUsd: "-1" },
    { grossUsd: "0" },
    { feeUsd: "0.001" },
    { date: "2026-02-30" },
    { type: "BUY" },
  ])(
    "validates each imported row using the shared transaction rules: %j",
    (changed) => {
      expect(
        parsePersonalPortfolioLedgerCsv(
          HEADER + "\n" + csvRow(changed),
          ledger(),
          TODAY,
        ),
      ).toMatchObject({
        status: "invalid",
        error: { code: "invalid_row", row: 2 },
      });
    },
  );

  it("requires exact registered listing ID and symbol while keeping historical identity text", () => {
    for (const changed of [
      { listingId: "unknown-listing" },
      { symbol: "OTHER" },
      { listingId: "", symbol: "" },
    ]) {
      expect(
        parsePersonalPortfolioLedgerCsv(
          HEADER + "\n" + csvRow(changed),
          ledger(),
          TODAY,
        ),
      ).toMatchObject({ error: { code: "unknown_listing", row: 2 } });
    }
    const historical = {
      ...ledger(),
      identities: ledger().identities.map((identity) => ({
        ...identity,
        symbol: "OLD",
      })),
    };
    const result = parsePersonalPortfolioLedgerCsv(
      HEADER + "\n" + csvRow({ symbol: "OLD" }),
      historical,
      TODAY,
    );
    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error("Expected valid CSV");
    expect(result.candidate.identities).toEqual(historical.identities);
  });

  it.each([
    { type: "deposit", listingId: "listing-one", symbol: "ONE", shares: "" },
    { type: "deposit", listingId: "", symbol: "", shares: "1" },
    { type: "withdrawal", listingId: "", symbol: "", shares: "", feeUsd: "1" },
    { type: "dividend", shares: "1", feeUsd: "0" },
    { type: "sell", grossUsd: "1", feeUsd: "2" },
  ])("enforces action-specific empty cells and fee rules: %j", (changed) => {
    expect(
      parsePersonalPortfolioLedgerCsv(
        HEADER + "\n" + csvRow(changed),
        ledger(),
        TODAY,
      ),
    ).toMatchObject({ error: { code: "invalid_row", row: 2 } });
  });

  it("rejects duplicate IDs within a file or against the saved ledger", () => {
    const text = [HEADER, csvRow(), csvRow()].join("\n");
    expect(
      parsePersonalPortfolioLedgerCsv(text, ledger(), TODAY),
    ).toMatchObject({ error: { code: "duplicate_id", row: 3 } });
    const previous = { ...ledger(), transactions: [transaction()] };
    expect(
      parsePersonalPortfolioLedgerCsv(
        HEADER + "\n" + csvRow(),
        previous,
        TODAY,
      ),
    ).toMatchObject({ error: { code: "duplicate_id", row: 2 } });
  });

  it("flags economic duplicates without dropping distinct IDs and canonicalizes decimal trailing zeroes", () => {
    const previous = {
      ...ledger(),
      transactions: [
        {
          ...transaction(),
          shares: "1.050000",
          grossUsd: "10.00",
          feeUsd: "0.00",
        },
      ],
    };
    const result = parsePersonalPortfolioLedgerCsv(
      [
        HEADER,
        csvRow({ id: "new-one", shares: "1.05", grossUsd: "10", feeUsd: "0" }),
        csvRow({
          id: "new-two",
          shares: "1.0500",
          grossUsd: "10.0",
          feeUsd: "0.0",
        }),
        csvRow({
          id: "different-shares",
          shares: "1.5",
          grossUsd: "10",
          feeUsd: "0",
        }),
        csvRow({
          id: "different-fee",
          shares: "1.05",
          grossUsd: "10",
          feeUsd: "0.01",
        }),
      ].join("\n"),
      previous,
      TODAY,
    );
    expect(result).toMatchObject({
      status: "valid",
      rowCount: 4,
      possibleDuplicateIds: ["new-one", "new-two"],
    });
    if (result.status !== "valid") throw new Error("Expected valid CSV");
    expect(result.candidate.transactions).toHaveLength(5);
    expect(result.candidate.transactions[0]).not.toBe(previous.transactions[0]);
    expect(Object.isFrozen(previous.transactions[0])).toBe(false);
  });

  it.each([
    [{ date: "2026-01-01" }, "transaction_before_opening"],
    [{ date: "2026-09-10" }, "future_date"],
    [{ type: "sell", shares: "12" }, "oversell"],
    [{ grossUsd: "100", feeUsd: "1" }, "negative_cash"],
  ] as const)(
    "reports semantic projection error %s at the actual CSV row",
    (changed, code) => {
      const previous = {
        ...ledger(),
        transactions: [
          { ...transaction(), id: "prior-trade", date: "2026-01-02" },
        ],
      };
      const first = csvRow({
        id: "first-new",
        date: "2026-01-03",
        type: "deposit",
        listingId: "",
        symbol: "",
        shares: "",
        grossUsd: "1",
        feeUsd: "0",
      });
      const result = parsePersonalPortfolioLedgerCsv(
        [
          HEADER,
          first,
          csvRow({ date: "2026-01-03", ...changed, id: "invalid-new" }),
        ].join("\n"),
        previous,
        TODAY,
      );
      expect(result).toMatchObject({
        status: "invalid",
        error: { code: "ledger_invalid", row: 3, ledgerCode: code },
      });
    },
  );

  it("keeps execution order on a day and rejects backward dates or unfunded intermediate buys", () => {
    const opening = {
      ...ledger(),
      opening: { ...ledger().opening, cashUsd: "0" },
    };
    const deposit = csvRow({
      id: "deposit-first",
      type: "deposit",
      listingId: "",
      symbol: "",
      shares: "",
      grossUsd: "11",
      feeUsd: "0",
    });
    expect(
      parsePersonalPortfolioLedgerCsv(
        [HEADER, deposit, csvRow()].join("\n"),
        opening,
        TODAY,
      ).status,
    ).toBe("valid");
    expect(
      parsePersonalPortfolioLedgerCsv(
        [HEADER, csvRow(), deposit].join("\n"),
        opening,
        TODAY,
      ),
    ).toMatchObject({
      error: { code: "ledger_invalid", row: 2, ledgerCode: "negative_cash" },
    });
    expect(
      parsePersonalPortfolioLedgerCsv(
        [
          HEADER,
          csvRow({ date: "2026-01-03" }),
          csvRow({ id: "earlier-row" }),
        ].join("\n"),
        ledger(),
        TODAY,
      ),
    ).toMatchObject({
      error: {
        code: "ledger_invalid",
        row: 3,
        ledgerCode: "transaction_order",
      },
    });
  });

  it("preserves unknown cash and basis through the preview instead of inventing funding or realized gains", () => {
    const unknown = {
      ...ledger(),
      opening: {
        ...ledger().opening,
        cashUsd: null,
        holdings: ledger().opening.holdings.map((holding) => ({
          ...holding,
          totalCostBasisUsd: null,
        })),
      },
    };
    const result = parsePersonalPortfolioLedgerCsv(
      HEADER +
        "\n" +
        csvRow({ type: "sell", shares: "1", grossUsd: "10", feeUsd: "0" }),
      unknown,
      TODAY,
    );
    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error("Expected valid CSV");
    expect(result.projection.cashCheck).toBe("unknown_opening_cash");
    expect(result.projection.portfolio.cashUsd).toBeNull();
    expect(result.projection.realized.totalGainUsd).toBeNull();
  });

  it("rejects an invalid prior ledger and the total transaction bound without partial import", () => {
    const invalid = {
      ...ledger(),
      transactions: [{ ...transaction(), type: "sell", shares: "11" }],
    } as PersonalPortfolioLedgerPayload;
    expect(
      parsePersonalPortfolioLedgerCsv(
        HEADER + "\n" + csvRow({ id: "new-row" }),
        invalid,
        TODAY,
      ),
    ).toMatchObject({
      error: { code: "ledger_invalid", row: null, ledgerCode: "oversell" },
    });
    const maximum = {
      ...ledger(),
      transactions: Array.from(
        { length: 250 },
        (_, index): PersonalPortfolioLedgerTransaction => ({
          id: `existing-${String(index)}`,
          date: "2026-01-02",
          type: "deposit",
          listingId: null,
          shares: null,
          grossUsd: "1",
          feeUsd: "0",
        }),
      ),
    };
    const result = parsePersonalPortfolioLedgerCsv(
      HEADER + "\n" + csvRow({ id: "new-row" }),
      maximum,
      TODAY,
    );
    expect(result).toMatchObject({
      status: "invalid",
      error: { code: "ledger_invalid", ledgerCode: "invalid_payload" },
    });
    expect(result).not.toHaveProperty("candidate");
  });
});

function ledger(): PersonalPortfolioLedgerPayloadV2 {
  return {
    schemaVersion: 2,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    basisMethod: "fifo_with_opening_pool",
    identities: [
      {
        country: "US",
        exchangeMic: "XNYS",
        instrumentType: "common_stock",
        issuerId: "issuer-one",
        issuerName: "Example",
        listingId: "listing-one",
        securityId: "security-one",
        securityName: "Common",
        shareClassId: "class-one",
        shareClassName: "Common",
        symbol: "ONE",
      },
    ],
    opening: {
      asOfDate: "2026-01-01",
      cashUsd: "100",
      holdings: [
        {
          listingId: "listing-one",
          shares: "10",
          totalCostBasisUsd: "50",
          confirmedOn: "2026-01-01",
        },
      ],
    },
    transactions: [],
  };
}

function splitLedger(): PersonalPortfolioLedgerPayloadV3 {
  return {
    ...ledger(),
    schemaVersion: 3,
    transactions: [
      {
        id: "saved-split",
        date: "2026-01-02",
        type: "split",
        listingId: "listing-one",
        ratioNumerator: "2",
        ratioDenominator: "1",
      },
      transaction(),
    ],
  };
}

function transaction(): PersonalPortfolioLedgerTransaction {
  return {
    id: "trade-one",
    date: "2026-01-02",
    type: "buy",
    listingId: "listing-one",
    shares: "1",
    grossUsd: "10",
    feeUsd: "1",
  };
}

function csvRow(
  changed: Partial<
    Record<
      | "id"
      | "date"
      | "type"
      | "listingId"
      | "symbol"
      | "shares"
      | "grossUsd"
      | "feeUsd",
      string
    >
  > = {},
): string {
  const row = { ...transaction(), symbol: "ONE", ...changed };
  return [
    row.id,
    row.date,
    row.type,
    row.listingId,
    row.symbol,
    row.shares,
    row.grossUsd,
    row.feeUsd,
  ]
    .map((cell) =>
      cell !== null && /[,"\r\n]/u.test(cell)
        ? `"${cell.replace(/"/gu, '""')}"`
        : cell,
    )
    .join(",");
}
