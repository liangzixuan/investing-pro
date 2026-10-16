import { describe, expect, it } from "vitest";

import {
  MANAGED_PORTFOLIO_LIMITS,
  MANAGED_PORTFOLIO_PATH,
  PERSONAL_PORTFOLIO_LEDGER_LIMITS,
  encodePortfolioPayload,
  parseManagedPortfolio,
  parseManagedPortfolioCommand,
  parseManagedPortfolioReceipt,
  parsePortfolioPayload,
  projectPersonalPortfolioLedger,
  type ManagedPortfolioPayload,
  type PersonalPortfolioLedgerActivity,
  type PersonalPortfolioLedgerOpeningHolding,
  type PersonalPortfolioLedgerTransaction,
} from "./index";

const key = "portfolio-command-0001";

function identity(suffix = "a") {
  return {
    country: "US" as const,
    exchangeMic: "XNAS",
    instrumentType: "common_stock" as const,
    issuerId: `issuer-${suffix}`,
    issuerName: `Invented issuer ${suffix}`,
    listingId: `listing-${suffix}`,
    securityId: `security-${suffix}`,
    securityName: `Invented security ${suffix}`,
    shareClassId: `class-${suffix}`,
    shareClassName: "Common",
    symbol: suffix.toUpperCase(),
  };
}

function trade(
  type: "buy" | "sell",
  shares: string,
  grossUsd: string,
): PersonalPortfolioLedgerTransaction {
  return {
    id: `activity-${type}`,
    date: "2026-10-02",
    type,
    listingId: "listing-a",
    shares,
    grossUsd,
    feeUsd: "1.00",
  };
}

function portfolio() {
  return {
    schemaVersion: 3 as const,
    name: "My Portfolio" as const,
    currency: "USD" as const,
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    basisMethod: "fifo_with_opening_pool" as const,
    identities: [identity()],
    opening: {
      asOfDate: "2026-10-01",
      cashUsd: "1000.00" as string | null,
      holdings: [] as PersonalPortfolioLedgerOpeningHolding[],
    },
    transactions: [
      trade("buy", "2.000000", "200.00"),
      trade("sell", "1.000000", "150.00"),
    ] as PersonalPortfolioLedgerActivity[],
  };
}

function split(): PersonalPortfolioLedgerActivity {
  return {
    id: "activity-split",
    date: "2026-10-02",
    type: "split",
    listingId: "listing-a",
    ratioNumerator: "2",
    ratioDenominator: "1",
  };
}

function parsed(value: unknown): ManagedPortfolioPayload {
  const result = parsePortfolioPayload(value);
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected an admitted invented ledger");
  return result;
}

function projected(value: unknown) {
  const result = projectPersonalPortfolioLedger(value);
  expect(result.status).toBe("valid");
  if (result.status !== "valid") throw new Error("Expected valid projection");
  return result;
}

function rejected(value: unknown) {
  expect(parsePortfolioPayload(value)).toBeNull();
  expect(
    parseManagedPortfolioCommand({
      expectedVersion: 0,
      idempotencyKey: key,
      payload: value,
    }),
  ).toBeNull();
  expect(parseManagedPortfolio({ version: 1, payload: value })).toBeNull();
}

function verifyOwnedFrozen(actual: unknown, source: unknown): void {
  if (actual === null || typeof actual !== "object") return;
  expect(actual).not.toBe(source);
  expect(Object.isFrozen(actual)).toBe(true);
  expect(Object.isFrozen(source)).toBe(false);
  for (const property of Object.keys(actual)) {
    verifyOwnedFrozen(
      (actual as Record<string, unknown>)[property],
      (source as Record<string, unknown>)[property],
    );
  }
}

function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([name, field]) => [name, reverseKeys(field)]),
  );
}

describe("managed portfolio schema-3 capture", () => {
  it("projects the exact authored buy/sell example without normalizing captured amounts", () => {
    const input = portfolio();
    const payload = parsed(input);
    const result = projected(payload);
    expect(result.portfolio.cashUsd).toBe("948.00");
    expect(result.portfolio.holdings).toEqual([
      {
        identity: identity(),
        shares: "1",
        totalCostBasisUsd: "100.50",
        confirmedOn: "2026-10-02",
      },
    ]);
    expect(result.realized.totalGainUsd).toBe("48.50");
    expect(result.cashCheck).toBe("known_nonnegative");
    expect(payload).toEqual(input);
    expect(encodePortfolioPayload(payload)).toBe(JSON.stringify(input));
    expect(MANAGED_PORTFOLIO_PATH).toBe("/v1/managed/portfolio");
  });

  it("owns every identity, opening holding, activity, split and envelope without freezing callers", () => {
    const input = portfolio();
    input.opening.holdings = [
      {
        listingId: "listing-a",
        shares: "1.000000",
        totalCostBasisUsd: null,
        confirmedOn: "2026-09-30",
      },
    ];
    input.transactions.splice(1, 0, split());
    const commandInput = {
      expectedVersion: 4,
      idempotencyKey: key,
      payload: input,
    };
    const command = parseManagedPortfolioCommand(commandInput);
    expect(command).not.toBeNull();
    verifyOwnedFrozen(command, commandInput);
    if (command === null) throw new Error("Expected captured command");
    const before = encodePortfolioPayload(command.payload);
    input.identities[0]!.issuerName = "Changed caller name";
    input.opening.cashUsd = null;
    input.transactions.reverse();
    expect(encodePortfolioPayload(command.payload)).toBe(before);
    const dtoInput = { version: 5, payload: portfolio() };
    verifyOwnedFrozen(parseManagedPortfolio(dtoInput), dtoInput);
    const receiptInput = {
      version: 5,
      payload: JSON.parse(before) as unknown,
      replayed: true,
    };
    const receipt = parseManagedPortfolioReceipt(receiptInput, command);
    expect(receipt).not.toBeNull();
    verifyOwnedFrozen(receipt, receiptInput);
  });

  it("uses canonical field order while preserving registry, holding and same-day activity order", () => {
    const input = portfolio();
    input.identities.unshift(identity("b"));
    input.opening.holdings = [
      {
        listingId: "listing-b",
        shares: "1",
        totalCostBasisUsd: "2.00",
        confirmedOn: "2026-09-30",
      },
      {
        listingId: "listing-a",
        shares: "1",
        totalCostBasisUsd: null,
        confirmedOn: "2026-09-29",
      },
    ];
    const canonical = encodePortfolioPayload(input);
    expect(encodePortfolioPayload(parsed(reverseKeys(input)))).toBe(canonical);
    expect(parsed(Object.assign(Object.create(null) as object, input))).toEqual(
      input,
    );
    expect(parsed(input).identities.map((item) => item.listingId)).toEqual([
      "listing-b",
      "listing-a",
    ]);
    expect(
      parsed(input).opening.holdings.map((item) => item.listingId),
    ).toEqual(["listing-b", "listing-a"]);
    expect(parsed(input).transactions.map((item) => item.id)).toEqual([
      "activity-buy",
      "activity-sell",
    ]);
  });

  it("preserves unknown cash and basis rather than manufacturing realized gains", () => {
    const input = portfolio();
    input.opening.cashUsd = null;
    input.opening.holdings = [
      {
        listingId: "listing-a",
        shares: "2.00",
        totalCostBasisUsd: null,
        confirmedOn: "2026-10-01",
      },
    ];
    input.transactions = [trade("sell", "1", "150.00")];
    const payload = parsed(input);
    const result = projected(payload);
    expect(payload.opening).toEqual(input.opening);
    expect(result.portfolio.cashUsd).toBeNull();
    expect(result.portfolio.holdings[0]!.totalCostBasisUsd).toBeNull();
    expect(result.realized.totalGainUsd).toBeNull();
    expect(result.realized.unknownSales).toBe(1);
    expect(result.cashCheck).toBe("unknown_opening_cash");
    expect(result.cashFlows.netCashChangeUsd).toBe("149.00");
  });

  it("keeps manual split order and the existing FIFO basis calculation", () => {
    const input = portfolio();
    input.transactions.splice(1, 0, split());
    const result = projected(parsed(input));
    expect(result.portfolio.holdings[0]).toMatchObject({
      shares: "3",
      totalCostBasisUsd: "150.75",
    });
    expect(result.realized.totalGainUsd).toBe("98.75");
    expect(result.portfolio.cashUsd).toBe("948.00");
    expect(result.splitAdjustments[0]).toMatchObject({
      beforeShares: "2",
      afterShares: "4",
    });
  });

  it("retains a complete old identity snapshot and valid future dates without a clock/catalog policy", () => {
    const input = portfolio();
    input.identities[0] = {
      ...identity(),
      exchangeMic: "XNYS",
      issuerName: "Invented 原始 issuer 🧭",
      shareClassName: "Historical class B",
      symbol: "OLD.B",
    };
    input.opening.asOfDate = "9999-12-30";
    input.transactions = input.transactions.map((item) => ({
      ...item,
      date: "9999-12-31",
    }));
    const payload = parsed(input);
    expect(payload.identities).toEqual(input.identities);
    expect(payload.snapshotSha256).toBe(input.snapshotSha256);
    expect(payload.opening.asOfDate).toBe("9999-12-30");
    expect(projectPersonalPortfolioLedger(payload, "2026-10-01")).toMatchObject(
      { status: "invalid", error: { code: "future_date" } },
    );
  });

  it.each([
    [
      "prefix oversell",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        transactions: [...input.transactions].reverse(),
      }),
      "oversell",
    ],
    [
      "prefix negative cash",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        opening: { ...input.opening, cashUsd: "200.00" },
      }),
      "negative_cash",
    ],
    [
      "out-of-order dates",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        transactions: [
          { ...input.transactions[0], date: "2026-10-03" },
          input.transactions[1],
        ],
      }),
      "transaction_order",
    ],
    [
      "opening-day trade",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        opening: { ...input.opening, asOfDate: "2026-10-02" },
      }),
      "transaction_before_opening",
    ],
    [
      "split without a position",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        transactions: [split()],
      }),
      "split_no_position",
    ],
    [
      "fractional split",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        transactions: [
          trade("buy", "1", "200"),
          { ...split(), ratioNumerator: "1", ratioDenominator: "3" },
        ],
      }),
      "split_fractional_precision",
    ],
    [
      "duplicate activity",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        transactions: [input.transactions[0], input.transactions[0]],
      }),
      "invalid_payload",
    ],
    [
      "unknown listing",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        transactions: [{ ...input.transactions[0], listingId: "unknown" }],
      }),
      "invalid_payload",
    ],
    [
      "duplicate registry",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        identities: [identity(), identity()],
      }),
      "invalid_payload",
    ],
    [
      "invalid leap day",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        opening: { ...input.opening, asOfDate: "2025-02-29" },
      }),
      "invalid_payload",
    ],
    [
      "fractional money",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        opening: { ...input.opening, cashUsd: "1000.001" },
      }),
      "invalid_payload",
    ],
    [
      "unsupported split ratio",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        transactions: [{ ...split(), ratioNumerator: "1000001" }],
      }),
      "invalid_payload",
    ],
  ] as const)(
    "delegates %s refusal to the existing ledger validator",
    (_name, make, code) => {
      const input = make(portfolio());
      expect(projectPersonalPortfolioLedger(input)).toMatchObject({
        status: "invalid",
        error: { code },
      });
      rejected(input);
    },
  );

  it("accepts a leap-day opening without admitting obsolete ledger schemas", () => {
    const input = portfolio();
    input.opening.asOfDate = "2024-02-29";
    expect(parsed(input).opening.asOfDate).toBe("2024-02-29");
    rejected({ ...input, schemaVersion: 2 });
    rejected(projected(input).portfolio);
    expect(() =>
      encodePortfolioPayload({
        ...input,
        schemaVersion: 2,
      } as unknown as ManagedPortfolioPayload),
    ).toThrow(TypeError);
  });
});

describe("managed portfolio closed data boundary", () => {
  it.each([
    [
      "payload",
      (input: ReturnType<typeof portfolio>) => ({ ...input, extra: true }),
    ],
    [
      "opening",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        opening: { ...input.opening, extra: true },
      }),
    ],
    [
      "identity",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        identities: [{ ...identity(), extra: true }],
      }),
    ],
    [
      "holding",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        opening: {
          ...input.opening,
          holdings: [
            {
              listingId: "listing-a",
              shares: "1",
              totalCostBasisUsd: null,
              confirmedOn: "2026-10-01",
              extra: true,
            },
          ],
        },
      }),
    ],
    [
      "transaction",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        transactions: [{ ...input.transactions[0], extra: true }],
      }),
    ],
    [
      "split",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        transactions: [input.transactions[0], { ...split(), extra: true }],
      }),
    ],
  ] as const)("rejects extra %s fields", (_name, make) =>
    rejected(make(portfolio())),
  );

  it("rejects accessors without invoking them, hidden/symbol fields and exotic records", () => {
    let reads = 0;
    const getter = () => {
      reads++;
      return "1000.00";
    };
    const input = portfolio();
    Object.defineProperty(input.opening, "cashUsd", {
      enumerable: true,
      get: getter,
    });
    rejected(input);
    expect(reads).toBe(0);
    rejected(Object.defineProperty(portfolio(), "name", { enumerable: false }));
    rejected(Object.assign(portfolio(), { [Symbol("extra")]: true }));
    rejected(Object.setPrototypeOf(portfolio(), { inherited: true }));
    rejected({
      ...portfolio(),
      identities: [Object.setPrototypeOf(identity(), { inherited: true })],
    });
  });

  it.each(["identities", "transactions", "holdings"] as const)(
    "rejects sparse, accessor, extra and exotic %s arrays",
    (field) => {
      const base = portfolio();
      base.opening.holdings = [
        {
          listingId: "listing-a",
          shares: "1",
          totalCostBasisUsd: null,
          confirmedOn: "2026-10-01",
        },
      ];
      const original =
        field === "holdings" ? base.opening.holdings : base[field];
      const variants: unknown[][] = [
        new Array<unknown>(1),
        [...original],
        [...original],
        [...original],
      ];
      Object.defineProperty(variants[1], 0, {
        enumerable: true,
        get: () => {
          throw new Error("Accessor must not run");
        },
      });
      Object.assign(variants[2]!, { extra: true });
      Object.setPrototypeOf(
        variants[3]!,
        Object.create(Array.prototype) as object,
      );
      for (const values of variants)
        rejected(
          field === "holdings"
            ? { ...base, opening: { ...base.opening, holdings: values } }
            : { ...base, [field]: values },
        );
    },
  );

  it("catches proxy exceptions and captures descriptors without using caller get traps", () => {
    const input = portfolio();
    const unreadable = new Proxy(input, {
      get() {
        throw new Error("Do not read caller properties");
      },
    });
    expect(parsed(unreadable)).toEqual(input);
    for (const proxy of [
      new Proxy(input, {
        ownKeys() {
          throw new Error("ownKeys");
        },
      }),
      new Proxy(input, {
        getPrototypeOf() {
          throw new Error("prototype");
        },
      }),
      new Proxy(input, {
        getOwnPropertyDescriptor() {
          throw new Error("descriptor");
        },
      }),
    ])
      rejected(proxy);
    const revoked = Proxy.revocable(input, {});
    revoked.revoke();
    rejected(revoked.proxy);
    expect(parseManagedPortfolioCommand(revoked.proxy)).toBeNull();
    expect(parseManagedPortfolio(revoked.proxy)).toBeNull();
    expect(
      parseManagedPortfolioReceipt(revoked.proxy, {
        expectedVersion: 0,
        idempotencyKey: key,
        payload: input,
      }),
    ).toBeNull();
  });

  it("keeps all 20 identities and 250 activities inside unchanged byte and envelope limits", () => {
    const input = portfolio();
    const id = (prefix: string, index: number) =>
      `${prefix}${index.toString().padStart(3, "0")}${"x".repeat(124)}`;
    input.identities = Array.from({ length: 20 }, (_, index) => ({
      ...identity(`A${index}`),
      issuerId: id("i", index),
      listingId: id("l", index),
      securityId: id("s", index),
      shareClassId: id("c", index),
      issuerName: "🧭".repeat(512),
      securityName: "🧭".repeat(512),
      shareClassName: "🧭".repeat(512),
    }));
    input.opening.cashUsd = null;
    input.transactions = Array.from({ length: 250 }, (_, index) => ({
      ...trade(
        index % 2 === 0 ? "buy" : "sell",
        "1000000000.000000",
        "1000000000000.00",
      ),
      id: id("t", index),
      listingId: input.identities[0]!.listingId,
      feeUsd: "0.00",
    }));
    const payload = parsed(input);
    const text = encodePortfolioPayload(payload);
    const bytes = new TextEncoder().encode(text).byteLength;
    expect(bytes).toBeGreaterThan(230_000);
    expect(bytes).toBeLessThanOrEqual(262_144);
    const command = parseManagedPortfolioCommand({
      expectedVersion: Number.MAX_SAFE_INTEGER - 1,
      idempotencyKey: "k".repeat(128),
      payload,
    });
    expect(command).not.toBeNull();
    expect(
      new TextEncoder().encode(JSON.stringify(command)).byteLength,
    ).toBeLessThanOrEqual(266_240);
    expect(MANAGED_PORTFOLIO_LIMITS).toEqual({
      identities: 20,
      transactions: 250,
      payloadBytes: PERSONAL_PORTFOLIO_LEDGER_LIMITS.payloadBytes,
      envelopeBytes: 266_240,
    });
    expect(Object.isFrozen(MANAGED_PORTFOLIO_LIMITS)).toBe(true);
    rejected({
      ...input,
      identities: [...input.identities, identity("EXTRA")],
    });
    rejected({
      ...input,
      transactions: [
        ...input.transactions,
        { ...input.transactions[0], id: "extra" },
      ],
    });
    rejected({
      ...input,
      identities: [{ ...identity(), issuerName: "🧭".repeat(65_536) }],
    });
  });
});

describe("managed portfolio versions and exact command receipts", () => {
  it("represents an uninitialized resource only as version zero and null", () => {
    const empty = parseManagedPortfolio({ version: 0, payload: null });
    expect(empty).toEqual({ version: 0, payload: null });
    expect(Object.isFrozen(empty)).toBe(true);
    expect(
      parseManagedPortfolio({ version: 0, payload: portfolio() }),
    ).toBeNull();
    expect(parseManagedPortfolio({ version: 1, payload: null })).toBeNull();
    expect(
      parseManagedPortfolioCommand({
        expectedVersion: 0,
        idempotencyKey: key,
        payload: null,
      }),
    ).toBeNull();
    expect(
      parseManagedPortfolio({ version: 1, payload: portfolio() })?.payload,
    ).toEqual(portfolio());
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, "1", null])(
    "rejects invalid version %s",
    (version) => {
      expect(
        parseManagedPortfolio({ version, payload: portfolio() }),
      ).toBeNull();
      expect(
        parseManagedPortfolioCommand({
          expectedVersion: version,
          idempotencyKey: key,
          payload: portfolio(),
        }),
      ).toBeNull();
    },
  );

  it("allows the last safe receipt version but refuses a command without a safe next version", () => {
    const command = {
      expectedVersion: Number.MAX_SAFE_INTEGER - 1,
      idempotencyKey: key,
      payload: portfolio(),
    };
    expect(
      parseManagedPortfolioReceipt(
        {
          version: Number.MAX_SAFE_INTEGER,
          payload: portfolio(),
          replayed: false,
        },
        command,
      )?.version,
    ).toBe(Number.MAX_SAFE_INTEGER);
    expect(
      parseManagedPortfolioCommand({
        ...command,
        expectedVersion: Number.MAX_SAFE_INTEGER,
      }),
    ).toBeNull();
  });

  it.each([
    "",
    "a".repeat(15),
    "a".repeat(129),
    `-${"a".repeat(15)}`,
    "non ascii key 🧭",
    "spaces are not keys",
  ])("rejects invalid command key %s", (idempotencyKey) => {
    expect(
      parseManagedPortfolioCommand({
        expectedVersion: 0,
        idempotencyKey,
        payload: portfolio(),
      }),
    ).toBeNull();
  });

  it("accepts canonical replay of the captured command without using a later latest version", () => {
    const input = {
      expectedVersion: 2,
      idempotencyKey: "a".repeat(16),
      payload: portfolio(),
    };
    const command = parseManagedPortfolioCommand(input);
    if (command === null) throw new Error("Expected captured command");
    input.payload.identities[0]!.issuerName = "Later local edit";
    for (const replayed of [false, true]) {
      const receipt = parseManagedPortfolioReceipt(
        { version: 3, payload: reverseKeys(portfolio()), replayed },
        command,
      );
      expect(receipt).toEqual({ version: 3, payload: portfolio(), replayed });
      expect(
        parseManagedPortfolioReceipt({ ...receipt, version: 4 }, command),
      ).toBeNull();
    }
  });

  it.each([
    [
      "decimal spelling",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        opening: { ...input.opening, cashUsd: "1000" },
      }),
    ],
    [
      "identity",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        identities: [{ ...identity(), exchangeMic: "XNYS" }],
      }),
    ],
    [
      "snapshot",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        snapshotSha256: `sha256:${"b".repeat(64)}`,
      }),
    ],
    [
      "activity identity",
      (input: ReturnType<typeof portfolio>) => ({
        ...input,
        transactions: input.transactions.map((item) => ({
          ...item,
          id: `${item.id}-changed`,
        })),
      }),
    ],
  ] as const)("refuses a valid but different %s receipt", (_name, change) => {
    const payload = change(portfolio());
    expect(parsePortfolioPayload(payload)).not.toBeNull();
    expect(
      parseManagedPortfolioReceipt(
        { version: 1, payload, replayed: true },
        { expectedVersion: 0, idempotencyKey: key, payload: portfolio() },
      ),
    ).toBeNull();
  });

  it("refuses a changed same-day order even when both resulting ledgers are valid", () => {
    const input = portfolio();
    input.transactions = [
      { ...trade("buy", "1", "10"), id: "buy-a" },
      { ...trade("buy", "1", "20"), id: "buy-b" },
    ];
    const reversed = {
      ...input,
      transactions: [...input.transactions].reverse(),
    };
    expect(parsePortfolioPayload(reversed)).not.toBeNull();
    expect(
      parseManagedPortfolioReceipt(
        { version: 1, payload: reversed, replayed: false },
        { expectedVersion: 0, idempotencyKey: key, payload: input },
      ),
    ).toBeNull();
  });

  it("rejects extra/accessor envelope fields, wrong replay type and invalid captured commands", () => {
    let reads = 0;
    const command = {
      expectedVersion: 0,
      idempotencyKey: key,
      payload: portfolio(),
    };
    const receipt = { version: 1, payload: portfolio(), replayed: true };
    expect(
      parseManagedPortfolioCommand({ ...command, extra: true }),
    ).toBeNull();
    expect(
      parseManagedPortfolio({ version: 1, payload: portfolio(), extra: true }),
    ).toBeNull();
    expect(
      parseManagedPortfolioReceipt({ ...receipt, extra: true }, command),
    ).toBeNull();
    expect(
      parseManagedPortfolioReceipt({ ...receipt, replayed: "true" }, command),
    ).toBeNull();
    expect(
      parseManagedPortfolioReceipt(receipt, {
        ...command,
        expectedVersion: -1,
      }),
    ).toBeNull();
    expect(
      parseManagedPortfolioReceipt(
        { version: 0, payload: null, replayed: true },
        command,
      ),
    ).toBeNull();
    Object.defineProperty(receipt, "replayed", {
      enumerable: true,
      get: () => {
        reads++;
        return true;
      },
    });
    expect(parseManagedPortfolioReceipt(receipt, command)).toBeNull();
    expect(reads).toBe(0);
  });
});
