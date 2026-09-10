import { describe, expect, it } from "vitest";

import {
  isPersonalPortfolioPayload,
  type PersonalPortfolioIdentity,
} from "./personal-portfolio";
import {
  PERSONAL_PORTFOLIO_LEDGER_LIMITS,
  isPersonalPortfolioLedgerActivity,
  isPersonalPortfolioLedgerPayload,
  isPersonalPortfolioLedgerTransaction,
  isPersonalPortfolioStoredPayload,
  projectPersonalPortfolioLedger,
  type PersonalPortfolioLedgerActivity,
  type PersonalPortfolioLedgerPayloadV2,
  type PersonalPortfolioLedgerPayloadV3,
  type PersonalPortfolioLedgerProjection,
  type PersonalPortfolioLedgerSplit,
  type PersonalPortfolioLedgerTransaction,
} from "./personal-portfolio-ledger";

const today = "2026-09-09";
function identity(suffix = "a"): PersonalPortfolioIdentity {
  return {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `issuer-${suffix}`,
    issuerName: `Issuer ${suffix}`,
    listingId: `listing-${suffix}`,
    securityId: `security-${suffix}`,
    securityName: `Security ${suffix}`,
    shareClassId: `class-${suffix}`,
    shareClassName: "Common",
    symbol: suffix.toUpperCase(),
  };
}

function ledger(
  transactions: readonly PersonalPortfolioLedgerTransaction[] = [],
): PersonalPortfolioLedgerPayloadV2 {
  return {
    schemaVersion: 2,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    basisMethod: "fifo_with_opening_pool",
    identities: [identity()],
    opening: {
      asOfDate: "2026-09-01",
      cashUsd: "100",
      holdings: [
        {
          listingId: "listing-a",
          shares: "3",
          totalCostBasisUsd: "30",
          confirmedOn: "2026-08-30",
        },
      ],
    },
    transactions,
  };
}

function splitLedger(
  transactions: readonly PersonalPortfolioLedgerActivity[] = [],
): PersonalPortfolioLedgerPayloadV3 {
  return { ...ledger(), schemaVersion: 3, transactions };
}

function split(
  id = "split-1",
  ratioNumerator = "2",
  ratioDenominator = "1",
  date = "2026-09-02",
): PersonalPortfolioLedgerSplit {
  return {
    id,
    date,
    type: "split",
    listingId: "listing-a",
    ratioNumerator,
    ratioDenominator,
  };
}

function trade(
  id: string,
  type: "buy" | "sell",
  shares: string,
  grossUsd: string,
  feeUsd = "0",
  date = "2026-09-02",
): PersonalPortfolioLedgerTransaction {
  return { id, date, type, listingId: "listing-a", shares, grossUsd, feeUsd };
}

function cash(
  id: string,
  type: "deposit" | "withdrawal" | "dividend" | "fee",
  grossUsd: string,
  date = "2026-09-02",
): PersonalPortfolioLedgerTransaction {
  return {
    id,
    date,
    type,
    listingId: type === "dividend" ? "listing-a" : null,
    shares: null,
    grossUsd,
    feeUsd: "0",
  };
}

function valid(
  value: unknown,
): Extract<PersonalPortfolioLedgerProjection, { status: "valid" }> {
  const result = projectPersonalPortfolioLedger(value, today);
  expect(result.status).toBe("valid");
  if (result.status !== "valid") throw Error("Expected valid fixture");
  expect(isPersonalPortfolioPayload(result.portfolio, today)).toBe(true);
  return result;
}

function error(
  value: unknown,
  code: string,
  transactionIndex: number | null = null,
) {
  expect(projectPersonalPortfolioLedger(value, today)).toEqual({
    status: "invalid",
    error: { code, transactionIndex },
  });
  expect(isPersonalPortfolioLedgerPayload(value, today)).toBe(false);
}

describe("personal portfolio ledger projection", () => {
  it("keeps the manual snapshot compatible without silently converting stored records", () => {
    const result = valid(ledger());
    expect(result.portfolio.holdings[0]).toMatchObject({
      shares: "3",
      totalCostBasisUsd: "30.00",
      confirmedOn: "2026-08-30",
    });
    expect(result.portfolio.cashUsd).toBe("100.00");
    expect(isPersonalPortfolioStoredPayload(result.portfolio, today)).toBe(
      true,
    );
    expect(isPersonalPortfolioStoredPayload(ledger(), today)).toBe(true);
    expect(isPersonalPortfolioPayload(ledger(), today)).toBe(false);
    expect(result.lots[0]).toMatchObject({
      source: "opening_pool",
      originalShares: "3",
      originalCostBasisUsd: "30.00",
    });
  });

  it("applies gross USD and trade fees to FIFO basis and every cash movement", () => {
    const result = valid(
      ledger([
        trade("buy-1", "buy", "2", "40", "1"),
        trade("sell-1", "sell", "4", "80", "2"),
        cash("deposit-1", "deposit", "10"),
        cash("withdraw-1", "withdrawal", "5"),
        cash("dividend-1", "dividend", "3"),
        cash("fee-1", "fee", "1"),
      ]),
    );
    expect(result.portfolio.cashUsd).toBe("144.00");
    expect(result.portfolio.holdings[0]).toMatchObject({
      shares: "1",
      totalCostBasisUsd: "20.50",
      confirmedOn: "2026-09-02",
    });
    expect(result.realized).toMatchObject({
      sales: 1,
      knownSales: 1,
      unknownSales: 0,
      knownGainSubtotalUsd: "27.50",
      totalGainUsd: "27.50",
    });
    expect(result.realized.disposals[0]).toMatchObject({
      netProceedsUsd: "78.00",
      allocatedCostBasisUsd: "50.50",
      gainUsd: "27.50",
    });
    expect(result.cashFlows).toEqual({
      depositsUsd: "10.00",
      withdrawalsUsd: "5.00",
      dividendsUsd: "3.00",
      standaloneFeesUsd: "1.00",
      tradeFeesUsd: "3.00",
      buysGrossUsd: "40.00",
      sellsGrossUsd: "80.00",
      netCashChangeUsd: "44.00",
    });
    expect(result.lots.map((lot) => lot.remainingCostBasisUsd)).toEqual([
      "0.00",
      "20.50",
    ]);
    expect(result.cashCheck).toBe("known_nonnegative");
  });

  it("allocates fractional cents cumulatively, conserving the complete lot cost", () => {
    const base = ledger();
    const opening = {
      ...base.opening,
      holdings: [{ ...base.opening.holdings[0]!, totalCostBasisUsd: "0.01" }],
    };
    const split = valid({
      ...base,
      opening,
      transactions: [
        trade("a", "sell", "1", "1"),
        trade("b", "sell", "1", "1"),
        trade("c", "sell", "1", "1"),
      ],
    });
    expect(
      split.realized.disposals.map((row) => row.allocatedCostBasisUsd),
    ).toEqual(["0.00", "0.01", "0.00"]);
    expect(split.realized.totalGainUsd).toBe("2.99");
    expect(split.portfolio.holdings).toEqual([]);
    expect(split.lots[0]).toMatchObject({
      remainingShares: "0",
      remainingCostBasisUsd: "0.00",
      disposedCostBasisUsd: "0.01",
    });
    const combined = valid({
      ...base,
      opening,
      transactions: [trade("ab", "sell", "2", "2")],
    });
    const firstTwo = valid({
      ...base,
      opening,
      transactions: [
        trade("a", "sell", "1", "1"),
        trade("b", "sell", "1", "1"),
      ],
    });
    expect(combined.realized.totalGainUsd).toBe(firstTwo.realized.totalGainUsd);
    expect(combined.portfolio).toEqual(firstTwo.portfolio);
  });

  it("uses exact millionth-share quantities at the half-cent boundary", () => {
    const base = ledger();
    const result = valid({
      ...base,
      opening: { ...base.opening, holdings: [] },
      transactions: [
        trade("buy", "buy", "0.000002", "0.01"),
        trade("sell", "sell", "0.000001", "0.01"),
      ],
    });
    expect(result.portfolio.holdings[0]).toMatchObject({
      shares: "0.000001",
      totalCostBasisUsd: "0.00",
    });
    expect(result.realized.disposals[0]?.allocatedCostBasisUsd).toBe("0.01");
    expect(result.portfolio.cashUsd).toBe("100.00");
  });

  it("preserves unknown opening basis and recovers known remaining basis after its lot is exhausted", () => {
    const base = ledger();
    const result = valid({
      ...base,
      opening: {
        ...base.opening,
        holdings: [
          {
            ...base.opening.holdings[0]!,
            shares: "1",
            totalCostBasisUsd: null,
          },
        ],
      },
      transactions: [
        trade("buy", "buy", "2", "10"),
        trade("unknown-sale", "sell", "1", "10"),
        trade("known-sale", "sell", "1", "10"),
      ],
    });
    expect(result.portfolio.holdings[0]).toMatchObject({
      shares: "1",
      totalCostBasisUsd: "5.00",
    });
    expect(result.realized).toMatchObject({
      sales: 2,
      knownSales: 1,
      unknownSales: 1,
      knownGainSubtotalUsd: "5.00",
      totalGainUsd: null,
    });
    expect(result.realized.disposals[0]).toMatchObject({
      allocatedCostBasisUsd: null,
      gainUsd: null,
    });
    expect(result.lots[0]).toMatchObject({
      originalCostBasisUsd: null,
      remainingCostBasisUsd: "0.00",
      disposedCostBasisUsd: null,
    });
  });

  it("does not infer partially known gains when one sale crosses unknown and known lots", () => {
    const base = ledger();
    const result = valid({
      ...base,
      opening: {
        ...base.opening,
        holdings: [
          {
            ...base.opening.holdings[0]!,
            shares: "1",
            totalCostBasisUsd: null,
          },
        ],
      },
      transactions: [
        trade("buy", "buy", "2", "10"),
        trade("mixed-sale", "sell", "2", "100"),
      ],
    });
    expect(result.realized).toMatchObject({
      knownSales: 0,
      unknownSales: 1,
      knownGainSubtotalUsd: "0.00",
      totalGainUsd: null,
    });
    expect(result.portfolio.holdings[0]?.totalCostBasisUsd).toBe("5.00");
  });

  it("keeps an unknown cash balance unknown after deposits or spending", () => {
    const base = ledger();
    const result = valid({
      ...base,
      opening: { ...base.opening, cashUsd: null },
      transactions: [
        cash("withdraw", "withdrawal", "1000"),
        cash("deposit", "deposit", "100"),
      ],
    });
    expect(result.portfolio.cashUsd).toBeNull();
    expect(result.cashCheck).toBe("unknown_opening_cash");
    expect(result.cashFlows.netCashChangeUsd).toBe("-900.00");
  });

  it("uses same-day array order without silently sorting or netting invalid prefixes", () => {
    const base = ledger();
    const empty = {
      ...base,
      opening: { ...base.opening, cashUsd: "0", holdings: [] },
    };
    const buy = trade("buy", "buy", "1", "10");
    const deposit = cash("deposit", "deposit", "10");
    expect(
      valid({ ...empty, transactions: [deposit, buy] }).portfolio.cashUsd,
    ).toBe("0.00");
    error({ ...empty, transactions: [buy, deposit] }, "negative_cash", 0);
    const sell = trade("sell", "sell", "1", "10");
    error({ ...empty, transactions: [sell, buy] }, "oversell", 0);
  });

  it("never allows holdings or cash to cross zero before a later restoring transaction", () => {
    error(
      ledger([
        trade("sell", "sell", "3.000001", "10"),
        trade("buy", "buy", "1", "10"),
      ]),
      "oversell",
      0,
    );
    error(
      ledger([
        cash("withdraw", "withdrawal", "100.01"),
        cash("deposit", "deposit", "1"),
      ]),
      "negative_cash",
      0,
    );
  });

  it("rejects dates at or before the opening end-of-day balance and earlier array dates", () => {
    error(
      ledger([trade("a", "buy", "1", "1", "0", "2026-09-01")]),
      "transaction_before_opening",
      0,
    );
    error(
      ledger([
        trade("a", "buy", "1", "1", "0", "2026-09-03"),
        trade("b", "buy", "1", "1", "0", "2026-09-02"),
      ]),
      "transaction_order",
      1,
    );
    error(
      ledger([trade("a", "buy", "1", "1", "0", "2026-09-10")]),
      "future_date",
      0,
    );
    const base = ledger();
    error(
      { ...base, opening: { ...base.opening, asOfDate: "2026-09-10" } },
      "future_date",
    );
    expect(projectPersonalPortfolioLedger(base, "2026-02-30")).toEqual({
      status: "invalid",
      error: { code: "invalid_today", transactionIndex: null },
    });
    expect(
      isPersonalPortfolioLedgerPayload(
        ledger([trade("a", "buy", "1", "1", "0", "2026-09-10")]),
      ),
    ).toBe(true);
  });

  it("enforces share, cost-basis and cash limits after every row with exact comparisons", () => {
    const base = ledger();
    error(
      {
        ...base,
        opening: {
          ...base.opening,
          cashUsd: null,
          holdings: [{ ...base.opening.holdings[0]!, shares: "1000000000" }],
        },
        transactions: [trade("buy", "buy", "0.000001", "0.01")],
      },
      "shares_limit",
      0,
    );
    error(
      {
        ...base,
        opening: {
          ...base.opening,
          cashUsd: null,
          holdings: [
            {
              ...base.opening.holdings[0]!,
              totalCostBasisUsd: "1000000000000",
            },
          ],
        },
        transactions: [trade("buy", "buy", "1", "0.01")],
      },
      "cost_basis_limit",
      0,
    );
    error(
      {
        ...base,
        opening: { ...base.opening, cashUsd: null, holdings: [] },
        transactions: [trade("buy", "buy", "1", "1000000000000", "0.01")],
      },
      "cost_basis_limit",
      0,
    );
    error(
      {
        ...base,
        opening: { ...base.opening, cashUsd: "1000000000000" },
        transactions: [cash("deposit", "deposit", "0.01")],
      },
      "cash_limit",
      0,
    );
  });

  it("accepts a dividend after the stock was sold and keeps registry history", () => {
    const result = valid(
      ledger([
        trade("sell", "sell", "3", "30"),
        cash("dividend", "dividend", "1"),
      ]),
    );
    expect(result.portfolio.holdings).toEqual([]);
    expect(result.portfolio.cashUsd).toBe("131.00");
    expect(result.realized.totalGainUsd).toBe("0.00");
    expect(result.cashFlows.dividendsUsd).toBe("1.00");
  });

  it("treats zero-cost opening lots as known and keeps separate later buy lots", () => {
    const base = ledger();
    const result = valid({
      ...base,
      opening: {
        ...base.opening,
        holdings: [{ ...base.opening.holdings[0]!, totalCostBasisUsd: "0" }],
      },
      transactions: [
        trade("buy", "buy", "1", "20"),
        trade("sell", "sell", "3", "30"),
      ],
    });
    expect(result.realized.totalGainUsd).toBe("30.00");
    expect(result.portfolio.holdings[0]?.totalCostBasisUsd).toBe("20.00");
  });

  it("does not mutate or freeze input while returning a JSON-safe immutable projection", () => {
    const input = ledger([trade("buy", "buy", "1", "10")]);
    const before = JSON.stringify(input);
    const result = valid(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(input.identities[0])).toBe(false);
    expect(Object.isFrozen(result.portfolio.holdings[0]?.identity)).toBe(true);
    expect(Object.isFrozen(result.lots[0])).toBe(true);
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});

describe("personal portfolio ledger validation", () => {
  it("allows all six closed transaction kinds and fixed trailing decimal zeros", () => {
    for (const transaction of [
      trade("a", "buy", "1.000000", "1.00"),
      trade("b", "sell", "1", "1", "1"),
      cash("c", "deposit", "1"),
      cash("d", "withdrawal", "1"),
      cash("e", "dividend", "1"),
      cash("f", "fee", "1"),
    ])
      expect(isPersonalPortfolioLedgerTransaction(transaction)).toBe(true);
  });

  it.each([
    { id: "" },
    { date: "2026-02-30" },
    { type: "split" },
    { shares: "0" },
    { shares: "0.0000001" },
    { grossUsd: "0" },
    { grossUsd: "0.001" },
    { feeUsd: "-0" },
    { listingId: null },
    { priceUsd: "1" },
    { feeUsd: "1e2" },
  ])("rejects malformed transaction fields %j", (changed) => {
    const value = { ...trade("a", "buy", "1", "1"), ...changed };
    expect(isPersonalPortfolioLedgerTransaction(value)).toBe(false);
    error(
      ledger([value as PersonalPortfolioLedgerTransaction]),
      "invalid_payload",
    );
  });

  it("requires per-kind empty fields and rejects sell fees exceeding proceeds", () => {
    for (const transaction of [
      { ...trade("a", "sell", "1", "1"), feeUsd: "1.01" },
      { ...cash("a", "deposit", "1"), listingId: "listing-a" },
      { ...cash("a", "fee", "1"), shares: "1" },
      { ...cash("a", "withdrawal", "1"), feeUsd: "0.01" },
      { ...cash("a", "dividend", "1"), listingId: null },
      { ...cash("a", "dividend", "1"), feeUsd: "0.01" },
    ])
      expect(isPersonalPortfolioLedgerTransaction(transaction)).toBe(false);
  });

  it("binds opening and transaction listing IDs to a unique identity registry", () => {
    const base = ledger();
    error({ ...base, identities: [identity(), identity()] }, "invalid_payload");
    error({ ...base, identities: [] }, "invalid_payload");
    error(
      {
        ...base,
        transactions: [
          { ...trade("a", "buy", "1", "1"), listingId: "listing-unknown" },
        ],
      },
      "invalid_payload",
    );
    error(
      {
        ...base,
        opening: {
          ...base.opening,
          holdings: [...base.opening.holdings, ...base.opening.holdings],
        },
      },
      "invalid_payload",
    );
    error(
      {
        ...base,
        opening: {
          ...base.opening,
          holdings: [
            { ...base.opening.holdings[0]!, confirmedOn: "2026-09-02" },
          ],
        },
      },
      "invalid_payload",
    );
    error(
      {
        ...base,
        identities: [{ ...identity(), note: "not a ledger identity field" }],
      },
      "invalid_payload",
    );
  });

  it("rejects duplicate IDs without rejecting legitimate equal-economic transactions", () => {
    const first = cash("a", "deposit", "1");
    error(ledger([first, first]), "invalid_payload");
    expect(
      valid(ledger([first, { ...first, id: "b" }])).portfolio.cashUsd,
    ).toBe("102.00");
  });

  it("enforces 250-row and 20-identity bounds without changing projection semantics", () => {
    expect(PERSONAL_PORTFOLIO_LEDGER_LIMITS).toMatchObject({
      transactions: 250,
      identities: 20,
      payloadBytes: 262144,
    });
    const transactions = Array.from({ length: 250 }, (_, index) =>
      cash(`deposit-${index}`, "deposit", "0.01"),
    );
    expect(valid(ledger(transactions)).portfolio.cashUsd).toBe("102.50");
    error(
      ledger([...transactions, cash("extra", "deposit", "0.01")]),
      "invalid_payload",
    );
    const base = ledger();
    const identities = Array.from({ length: 20 }, (_, index) =>
      identity(`a${index}`),
    );
    expect(
      valid({ ...base, identities, opening: { ...base.opening, holdings: [] } })
        .portfolio.holdings,
    ).toEqual([]);
    error(
      {
        ...base,
        identities: [...identities, identity("extra")],
        opening: { ...base.opening, holdings: [] },
      },
      "invalid_payload",
    );
  });

  it("rejects unknown keys, holes, accessors, special array fields and malformed records", () => {
    const base = ledger();
    for (const value of [
      null,
      [],
      {},
      { ...base, schemaVersion: 4 },
      { ...base, basisMethod: "tax_fifo" },
      { ...base, balance: "10" },
      { ...base, opening: { ...base.opening, extra: true } },
      { ...base, transactions: new Array(1) },
      { ...base, transactions: Object.assign([], { toJSON: () => [] }) },
    ])
      error(value, "invalid_payload");
    const candidate = { ...base };
    Object.defineProperty(candidate, "transactions", { get: () => [] });
    error(candidate, "invalid_payload");
    const row = { ...trade("a", "buy", "1", "1") };
    Object.defineProperty(row, "feeUsd", { get: () => "0" });
    expect(isPersonalPortfolioLedgerTransaction(row)).toBe(false);
  });
});

describe("personal portfolio ledger split projection", () => {
  it("keeps V2 projection unchanged and requires explicit V3 for split rows", () => {
    const transactions = [trade("buy", "buy", "1", "10")];
    expect(valid(splitLedger(transactions))).toEqual(
      valid(ledger(transactions)),
    );
    expect(valid(ledger()).splitAdjustments).toEqual([]);
    const upgraded = splitLedger([split()]);
    expect(isPersonalPortfolioStoredPayload(upgraded, today)).toBe(true);
    error({ ...upgraded, schemaVersion: 2 }, "invalid_payload");
    expect(isPersonalPortfolioLedgerActivity(split())).toBe(true);
    expect(isPersonalPortfolioLedgerTransaction(split())).toBe(false);
    expect(isPersonalPortfolioLedgerActivity(transactions[0])).toBe(true);
  });

  it("adjusts every open FIFO lot without moving cash, basis or realized amounts", () => {
    const buy = trade("buy", "buy", "2", "40", "1");
    const before = valid(splitLedger([buy]));
    const after = valid(splitLedger([buy, split()]));
    expect(after.portfolio.holdings[0]).toMatchObject({
      shares: "10",
      totalCostBasisUsd: "71.00",
      confirmedOn: "2026-09-02",
    });
    expect(after.portfolio.cashUsd).toBe(before.portfolio.cashUsd);
    expect(after.cashFlows).toEqual(before.cashFlows);
    expect(after.realized).toEqual(before.realized);
    expect(
      after.lots.map((lot) => [lot.originalShares, lot.remainingShares]),
    ).toEqual([
      ["3", "6"],
      ["2", "4"],
    ]);
    expect(after.lots.map((lot) => lot.remainingCostBasisUsd)).toEqual(
      before.lots.map((lot) => lot.remainingCostBasisUsd),
    );
    expect(after.splitAdjustments).toEqual([
      {
        transactionId: "split-1",
        date: "2026-09-02",
        listingId: "listing-a",
        ratioNumerator: "2",
        ratioDenominator: "1",
        beforeShares: "5",
        afterShares: "10",
        affectedLots: 2,
      },
    ]);
  });

  it("retains representable reverse-split fractions without inventing cash-in-lieu", () => {
    const base = splitLedger([split("reverse", "1", "4")]);
    const result = valid({
      ...base,
      opening: { ...base.opening, cashUsd: null },
    });
    expect(result.portfolio.holdings[0]).toMatchObject({
      shares: "0.75",
      totalCostBasisUsd: "30.00",
    });
    expect(result.portfolio.cashUsd).toBeNull();
    expect(result.cashCheck).toBe("unknown_opening_cash");
    expect(result.cashFlows.netCashChangeUsd).toBe("0.00");
    expect(result.realized.sales).toBe(0);
  });

  it("preserves cumulative cent rounding across a partial sale and split", () => {
    const base = splitLedger([
      trade("before", "sell", "1", "1"),
      split(),
      trade("after", "sell", "1", "1"),
      trade("finish", "sell", "3", "1"),
    ]);
    const result = valid({
      ...base,
      opening: {
        ...base.opening,
        holdings: [{ ...base.opening.holdings[0]!, totalCostBasisUsd: "0.01" }],
      },
    });
    expect(
      result.realized.disposals.map((row) => row.allocatedCostBasisUsd),
    ).toEqual(["0.00", "0.01", "0.00"]);
    expect(result.portfolio.holdings).toEqual([]);
    expect(result.lots[0]).toMatchObject({
      originalShares: "3",
      originalCostBasisUsd: "0.01",
      remainingCostBasisUsd: "0.00",
      disposedCostBasisUsd: "0.01",
    });
  });

  it("supports a fractional adjusted original denominator when every remaining lot fits", () => {
    const base = splitLedger([
      trade("before", "sell", "0.000001", "1"),
      split("fractional-denominator", "3", "2"),
      trade("after", "sell", "0.000001", "1"),
    ]);
    const result = valid({
      ...base,
      opening: {
        ...base.opening,
        holdings: [
          {
            ...base.opening.holdings[0]!,
            shares: "0.000003",
            totalCostBasisUsd: "0.01",
          },
        ],
      },
    });
    expect(
      result.realized.disposals.map((row) => row.allocatedCostBasisUsd),
    ).toEqual(["0.00", "0.01"]);
    expect(result.portfolio.holdings[0]).toMatchObject({
      shares: "0.000002",
      totalCostBasisUsd: "0.00",
    });
  });

  it("conserves the complete lot basis through repeated splits and partial sales", () => {
    const base = splitLedger([
      trade("a", "sell", "1", "1"),
      split("forward"),
      trade("b", "sell", "1", "1"),
      split("reverse", "1", "3"),
      trade("c", "sell", "0.5", "1"),
      split("forward-again", "10", "1"),
      trade("d", "sell", "5", "1"),
    ]);
    const result = valid({
      ...base,
      opening: {
        ...base.opening,
        holdings: [{ ...base.opening.holdings[0]!, totalCostBasisUsd: "0.01" }],
      },
    });
    expect(
      result.realized.disposals.map((row) => row.allocatedCostBasisUsd),
    ).toEqual(["0.00", "0.01", "0.00", "0.00"]);
    expect(result.portfolio.holdings).toEqual([]);
    expect(result.realized.totalGainUsd).toBe("3.99");
    expect(result.lots[0]?.disposedCostBasisUsd).toBe("0.01");
  });

  it("preserves unknown opening basis through a split and recovers known later lots", () => {
    const base = splitLedger([
      trade("buy", "buy", "2", "40"),
      split(),
      trade("opening-sale", "sell", "6", "60"),
      trade("known-sale", "sell", "1", "10"),
    ]);
    const result = valid({
      ...base,
      opening: {
        ...base.opening,
        holdings: [{ ...base.opening.holdings[0]!, totalCostBasisUsd: null }],
      },
    });
    expect(result.portfolio.holdings[0]).toMatchObject({
      shares: "3",
      totalCostBasisUsd: "30.00",
    });
    expect(result.realized).toMatchObject({
      unknownSales: 1,
      knownSales: 1,
      knownGainSubtotalUsd: "0.00",
      totalGainUsd: null,
    });
    expect(
      result.realized.disposals.map((row) => row.allocatedCostBasisUsd),
    ).toEqual([null, "10.00"]);
    expect(result.lots[0]?.originalCostBasisUsd).toBeNull();
  });

  it("honors same-day activity order and leaves later buys in their own units", () => {
    const buy = trade("buy", "buy", "1", "10");
    expect(
      valid(splitLedger([buy, split()])).portfolio.holdings[0]?.shares,
    ).toBe("8");
    const splitThenBuy = valid(splitLedger([split(), buy]));
    expect(splitThenBuy.portfolio.holdings[0]?.shares).toBe("7");
    expect(splitThenBuy.lots[1]?.remainingShares).toBe("1");
    const sale = trade("sell", "sell", "4", "40");
    error(splitLedger([sale, split()]), "oversell", 0);
    expect(
      valid(splitLedger([split(), sale])).portfolio.holdings[0]?.shares,
    ).toBe("2");
  });

  it("leaves closed lots and other listings untouched", () => {
    const base = splitLedger([
      trade("close-opening", "sell", "3", "30"),
      trade("reopen", "buy", "1", "10"),
      split(),
    ]);
    const result = valid({
      ...base,
      identities: [...base.identities, identity("b")],
      opening: {
        ...base.opening,
        holdings: [
          ...base.opening.holdings,
          { ...base.opening.holdings[0]!, listingId: "listing-b" },
        ],
      },
    });
    expect(result.portfolio.holdings.map((holding) => holding.shares)).toEqual([
      "2",
      "3",
    ]);
    expect(result.lots[0]).toMatchObject({
      originalShares: "3",
      remainingShares: "0",
      disposedCostBasisUsd: "30.00",
    });
    expect(result.splitAdjustments[0]?.affectedLots).toBe(1);
  });

  it("rejects a split without a position at its ordered location", () => {
    error(
      splitLedger([trade("close", "sell", "3", "30"), split()]),
      "split_no_position",
      1,
    );
  });

  it("rejects unrepresentable per-lot fractions even when the aggregate fits", () => {
    const base = splitLedger([
      trade("second-lot", "buy", "0.000001", "1"),
      split("reverse", "1", "2"),
    ]);
    error(
      {
        ...base,
        opening: {
          ...base.opening,
          holdings: [{ ...base.opening.holdings[0]!, shares: "0.000001" }],
        },
      },
      "split_fractional_precision",
      1,
    );
    error(
      splitLedger([split("third", "1", "7")]),
      "split_fractional_precision",
      0,
    );
  });

  it("checks expanded share bounds before later sales can restore them", () => {
    const base = splitLedger([split(), trade("later", "sell", "2", "1")]);
    const opening = {
      ...base.opening,
      holdings: [{ ...base.opening.holdings[0]!, shares: "500000000.000001" }],
    };
    error({ ...base, opening }, "shares_limit", 0);
    expect(
      valid({
        ...base,
        transactions: [split()],
        opening: {
          ...opening,
          holdings: [{ ...opening.holdings[0]!, shares: "500000000" }],
        },
      }).portfolio.holdings[0]?.shares,
    ).toBe("1000000000");
  });

  it("retains exact schema bounds with 250 split activities", () => {
    const transactions = Array.from({ length: 250 }, (_, index) =>
      split(
        `split-${String(index)}`,
        index % 2 === 0 ? "2" : "1",
        index % 2 === 0 ? "1" : "2",
      ),
    );
    const result = valid(splitLedger(transactions));
    expect(result.portfolio.holdings[0]).toMatchObject({
      shares: "3",
      totalCostBasisUsd: "30.00",
    });
    expect(result.splitAdjustments).toHaveLength(250);
    error(splitLedger([...transactions, split("extra")]), "invalid_payload");
  });

  it("returns immutable JSON-safe split results without mutating input", () => {
    const input = splitLedger([split()]);
    const before = structuredClone(input);
    const result = valid(input);
    expect(input).toEqual(before);
    expect(Object.isFrozen(input.transactions[0])).toBe(false);
    expect(Object.isFrozen(result.splitAdjustments[0])).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

describe("personal portfolio split validation", () => {
  it.each([
    { ratioNumerator: "0" },
    { ratioDenominator: "0" },
    { ratioNumerator: "1000001" },
    { ratioDenominator: "1000001" },
    { ratioNumerator: "01" },
    { ratioDenominator: "01" },
    { ratioNumerator: "1.5" },
    { ratioNumerator: "1e2" },
    { ratioNumerator: "+2" },
    { ratioNumerator: "-2" },
    { ratioNumerator: " 2" },
    { ratioNumerator: 2 },
    { ratioDenominator: "2" },
    { listingId: null },
    { id: "" },
    { date: "2026-02-30" },
    { shares: null },
    { grossUsd: "0" },
    { feeUsd: "0" },
  ])("rejects malformed closed split fields %j", (changed) => {
    const activity = { ...split(), ...changed };
    expect(isPersonalPortfolioLedgerActivity(activity)).toBe(false);
    error({ ...splitLedger(), transactions: [activity] }, "invalid_payload");
  });

  it("accepts inclusive ratio bounds and equivalent unreduced ratios", () => {
    expect(
      isPersonalPortfolioLedgerActivity(split("largest", "1000000", "1")),
    ).toBe(true);
    expect(
      isPersonalPortfolioLedgerActivity(split("smallest", "1", "1000000")),
    ).toBe(true);
    expect(
      valid(splitLedger([split("equivalent", "4", "2")])).portfolio.holdings[0]
        ?.shares,
    ).toBe("6");
  });

  it("binds split identity, unique IDs and dates to existing ledger rules", () => {
    error(
      splitLedger([{ ...split(), listingId: "listing-unknown" }]),
      "invalid_payload",
    );
    error(
      splitLedger([split(), trade("split-1", "buy", "1", "10")]),
      "invalid_payload",
    );
    error(
      splitLedger([split("early", "2", "1", "2026-09-01")]),
      "transaction_before_opening",
      0,
    );
    error(
      splitLedger([split("future", "2", "1", "2026-09-10")]),
      "future_date",
      0,
    );
    error(
      splitLedger([
        split("later", "2", "1", "2026-09-03"),
        split("earlier", "1", "2"),
      ]),
      "transaction_order",
      1,
    );
  });

  it("rejects accessor fields before evaluating their values", () => {
    let reads = 0;
    const value = { ...split() };
    Object.defineProperty(value, "ratioNumerator", {
      get: () => {
        reads += 1;
        return "2";
      },
    });
    expect(isPersonalPortfolioLedgerActivity(value)).toBe(false);
    error({ ...splitLedger(), transactions: [value] }, "invalid_payload");
    expect(reads).toBe(0);
  });
});
