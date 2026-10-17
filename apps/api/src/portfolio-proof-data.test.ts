import { createHash } from "node:crypto";
import {
  encodePortfolioPayload,
  isPersonalPortfolioLedgerPayload,
  parseManagedPortfolioCommand,
  parsePortfolioPayload,
  projectPersonalPortfolioLedger,
  type ManagedPortfolioCommand,
} from "@research-cockpit/contracts";
import {
  lookupPersonalSecurityMasterListing,
  type ManagedSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";
import { AppwriteException } from "node-appwrite";
import { describe, expect, it, vi } from "vitest";
import { createAppwritePortfolioRepository } from "./appwrite-portfolio-repository";
import type {
  AppwriteRowLocation,
  AppwriteVersionedRowStore,
} from "./appwrite-versioned-row-store";
import {
  PORTFOLIO_PROOF_CATALOG_PINS,
  PORTFOLIO_PROOF_COMMAND_PINS,
  PORTFOLIO_PROOF_LIMITS,
  PORTFOLIO_PROOF_PHASES,
  PORTFOLIO_PROOF_PLAN_SHA256,
  PORTFOLIO_PROOF_PRINCIPALS,
  PORTFOLIO_PROOF_ROWS,
  PORTFOLIO_PROOF_ROWS_SHA256,
  PORTFOLIO_PROOF_SNAPSHOTS,
  PORTFOLIO_PROOF_TARGET,
  portfolioProofData,
  portfolioProofLocation,
  type PortfolioProofCommandName,
} from "./portfolio-proof-data";

const hash = (text: string) =>
  createHash("sha256").update(text, "utf8").digest("hex");
const data = portfolioProofData();
const TIME = "2026-10-16T12:00:00.000Z";
const STABLE = [
  "country",
  "exchangeMic",
  "instrumentType",
  "issuerId",
  "securityId",
  "shareClassId",
  "listingId",
] as const;

describe("fixed synthetic Portfolio proof data", () => {
  it("binds the exact target, three invented principals, eleven proposed ceilings and plan", () => {
    expect(PORTFOLIO_PROOF_TARGET).toEqual({
      endpoint: "https://nyc.cloud.appwrite.io/v1",
      project: "6abac57a0007b7c1a671",
      databaseId: "investment_managed_portfolio_v1",
      currentTableId: "portfolios",
      receiptsTableId: "receipts",
    });
    expect(
      Object.values(PORTFOLIO_PROOF_PRINCIPALS).map((p) => p.userId),
    ).toEqual([
      "proof-portfolio-20261016-a",
      "proof-portfolio-20261016-b",
      "proof-portfolio-20261016-size",
    ]);
    expect(PORTFOLIO_PROOF_PHASES).toEqual([
      "preflight",
      "create",
      "isolation",
      "stale",
      "prestage",
      "overlap",
      "rollback",
      "unknown",
      "reopen",
      "capacity",
      "domain-guards",
    ]);
    expect(
      PORTFOLIO_PROOF_PHASES.map((phase) => PORTFOLIO_PROOF_LIMITS[phase]),
    ).toEqual([17, 16, 12, 16, 20, 20, 12, 12, 2, 12, 16]);
    expect(
      Object.values(PORTFOLIO_PROOF_LIMITS).reduce((a, b) => a + b, 0),
    ).toBe(155);
    expect(PORTFOLIO_PROOF_PLAN_SHA256).toBe(
      "fc0d153f95e9d00ff485776bcfa04b8d74450f0a29cd9508a765d8dcb67ceaf0",
    );
  });

  it("derives only 17 fixed engine locations and separates all refused receipts", () => {
    expect(
      Object.entries(data.commands).flatMap(
        ([owner, commands]: [string, Readonly<Record<string, unknown>>]) =>
          Object.keys(commands).map((name) => `${owner}/${name}`),
      ),
    ).toEqual(
      PORTFOLIO_PROOF_COMMAND_PINS.map((pin) => `${pin.owner}/${pin.name}`),
    );
    expect(PORTFOLIO_PROOF_COMMAND_PINS).toHaveLength(14);
    expect(PORTFOLIO_PROOF_ROWS).toHaveLength(17);
    expect(new Set(PORTFOLIO_PROOF_ROWS.map((row) => row.rowId)).size).toBe(17);
    for (const row of PORTFOLIO_PROOF_ROWS) {
      const namespace = [
        PORTFOLIO_PROOF_PRINCIPALS[row.owner].userId,
        "portfolio",
        "main",
      ];
      if (row.name !== null)
        namespace.push(`proof-portfolio-20261016-${row.owner}-${row.name}-v1`);
      expect(row.rowId).toBe(
        (row.name === null ? "p" : "r") +
          hash(JSON.stringify(namespace)).slice(0, 32),
      );
      expect(portfolioProofLocation(row.owner, row.name ?? undefined)).toEqual({
        databaseId: "investment_managed_portfolio_v1",
        tableId: row.tableId,
        rowId: row.rowId,
      });
    }
    expect(
      PORTFOLIO_PROOF_ROWS.filter((row) => row.expectedPresentAfterProof),
    ).toHaveLength(10);
    expect(
      PORTFOLIO_PROOF_ROWS.filter((row) => !row.expectedPresentAfterProof).map(
        (row) => row.name,
      ),
    ).toEqual([
      "stale-loser",
      "prestage-loser",
      "overlap-loser",
      "rollback",
      "future",
      "rebind",
      "stale-catalog",
    ]);
    expect(hash(JSON.stringify(PORTFOLIO_PROOF_ROWS))).toBe(
      PORTFOLIO_PROOF_ROWS_SHA256,
    );
    expect(PORTFOLIO_PROOF_ROWS_SHA256).toBe(
      "986fd52045ebcec50704002b1f65264b389f041f68404b84a68903d6272d9753",
    );
    expect(() => portfolioProofLocation("b", "future")).toThrow(
      "Unknown fixed Portfolio proof location",
    );
    expect(() => portfolioProofLocation("size", "create")).toThrow();
    expect(() => portfolioProofLocation("a", "capacity")).toThrow();
  });

  it.each(PORTFOLIO_PROOF_CATALOG_PINS)(
    "admits the exact $name synthetic catalog bytes",
    (pin) => {
      const snapshot = PORTFOLIO_PROOF_SNAPSHOTS[pin.name];
      expect(snapshot.endsWith("\n")).toBe(true);
      expect(Buffer.byteLength(snapshot)).toBe(pin.bytes);
      expect(`sha256:${hash(snapshot)}`).toBe(pin.sha256);
      const catalog =
        pin.name === "original"
          ? data.catalog
          : pin.name === "revised"
            ? data.revisedCatalog
            : data.reboundCatalog;
      expect(catalog.snapshotSha256).toBe(pin.sha256);
      expect(catalog.coverage).toMatchObject({
        activeListings: 20,
        issuers: 20,
        providerMappings: 40,
        basis: "synthetic_engineering_only_not_real_universe",
      });
      expect(catalog.provenance.contentKind).toBe("synthetic_engineering");
      expect(catalog.provenance.artifacts[0]?.sourceUri).toBe(
        "https://example.invalid/portfolio-proof/invented-identities.txt",
      );
    },
  );

  it("changes only reviewed display fields in one catalog and one stable coordinate in the other", () => {
    for (const [
      index,
      original,
    ] of data.commands.size.capacity.payload.identities.entries()) {
      const revised = lookupPersonalSecurityMasterListing(
        data.revisedCatalog,
        original.listingId,
      )!;
      const rebound = lookupPersonalSecurityMasterListing(
        data.reboundCatalog,
        original.listingId,
      )!;
      for (const field of STABLE)
        expect(revised[field], field).toBe(original[field]);
      for (const field of Object.keys(original) as (keyof typeof original)[]) {
        if (index === 0 && (field === "issuerName" || field === "symbol"))
          expect(revised[field]).not.toBe(original[field]);
        else expect(revised[field]).toBe(original[field]);
        if (index === 0 && field === "securityId")
          expect(rebound[field]).not.toBe(original[field]);
        else expect(rebound[field]).toBe(original[field]);
      }
    }
    expect(data.commands.a.rebind.payload.identities[0]?.listingId).toBe(
      data.commands.a.unknown.payload.identities[0]?.listingId,
    );
    expect(data.commands.a.rebind.payload.identities[0]?.securityId).not.toBe(
      data.commands.a.unknown.payload.identities[0]?.securityId,
    );
  });

  it.each(PORTFOLIO_PROOF_COMMAND_PINS)(
    "binds complete $owner/$name command, payload, key and engine request",
    (pin) => {
      const commands: Readonly<
        Partial<Record<PortfolioProofCommandName, ManagedPortfolioCommand>>
      > = data.commands[pin.owner];
      const command = commands[pin.name]!;
      const parsed = parseManagedPortfolioCommand(command);
      expect(parsed).toEqual(command);
      expect(parsed).not.toBe(command);
      expect(command.expectedVersion).toBe(pin.expectedVersion);
      expect(command.idempotencyKey).toBe(
        `proof-portfolio-20261016-${pin.owner}-${pin.name}-v1`,
      );
      expect(hash(command.idempotencyKey)).toBe(pin.keySha256);
      const payload = encodePortfolioPayload(command.payload);
      expect(Buffer.byteLength(payload)).toBe(pin.payloadBytes);
      expect(hash(payload)).toBe(pin.payloadSha256);
      expect(Buffer.byteLength(JSON.stringify(command))).toBe(pin.commandBytes);
      expect(hash(JSON.stringify(command))).toBe(pin.commandSha256);
      expect(
        hash(
          JSON.stringify({
            expectedVersion: command.expectedVersion,
            resource: "portfolio",
            id: "main",
            operation: "put",
            payloadSha256: hash(payload),
          }),
        ),
      ).toBe(pin.requestSha256);
      expect(
        isPersonalPortfolioLedgerPayload(command.payload, "2026-10-16"),
      ).toBe(pin.name !== "future");
    },
  );

  it("preserves exact ordered activities, decimal spellings, split and known/unknown basis", () => {
    const payload = data.commands.a.create.payload;
    expect(payload.opening).toEqual({
      asOfDate: "2026-10-01",
      cashUsd: "1000.00",
      holdings: [
        {
          listingId: payload.identities[0]!.listingId,
          shares: "10.000000",
          totalCostBasisUsd: "100.00",
          confirmedOn: "2026-10-01",
        },
        {
          listingId: payload.identities[1]!.listingId,
          shares: "2.000000",
          totalCostBasisUsd: null,
          confirmedOn: "2026-10-01",
        },
      ],
    });
    expect(payload.transactions.map((item) => item.type)).toEqual([
      "deposit",
      "buy",
      "split",
      "sell",
      "sell",
      "dividend",
      "fee",
      "withdrawal",
    ]);
    expect(payload.transactions[1]).toEqual({
      id: "proof-portfolio-buy",
      date: "2026-10-02",
      type: "buy",
      listingId: payload.identities[0]!.listingId,
      shares: "2.000000",
      grossUsd: "60.00",
      feeUsd: "1.00",
    });
    expect(payload.transactions[2]).toEqual({
      id: "proof-portfolio-manual-split",
      date: "2026-10-02",
      type: "split",
      listingId: payload.identities[0]!.listingId,
      ratioNumerator: "3",
      ratioDenominator: "2",
    });
    expect(payload.identities[0]?.issuerName).toContain("Café 東京 📈");
    const result = projectPersonalPortfolioLedger(payload, "2026-10-16");
    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error("Invalid proof ledger");
    expect(result.portfolio.cashUsd).toBe("1216.00");
    expect(
      result.portfolio.holdings.map((item) => [
        item.shares,
        item.totalCostBasisUsd,
      ]),
    ).toEqual([
      ["15", "141.00"],
      ["1", null],
    ]);
    expect(result.realized).toMatchObject({
      sales: 2,
      knownSales: 1,
      unknownSales: 1,
      knownGainSubtotalUsd: "24.00",
      totalGainUsd: null,
    });
    expect(result.cashFlows).toEqual({
      depositsUsd: "200.00",
      withdrawalsUsd: "10.00",
      dividendsUsd: "5.00",
      standaloneFeesUsd: "2.00",
      tradeFeesUsd: "2.00",
      buysGrossUsd: "60.00",
      sellsGrossUsd: "85.00",
      netCashChangeUsd: "216.00",
    });
    expect(result.splitAdjustments).toHaveLength(1);
  });

  it("keeps unknown cash distinct and all five winning ledgers byte-distinct", () => {
    const unknown = projectPersonalPortfolioLedger(
      data.commands.b.create.payload,
    );
    expect(unknown.status).toBe("valid");
    if (unknown.status !== "valid")
      throw new Error("Invalid unknown-cash ledger");
    expect(unknown.cashCheck).toBe("unknown_opening_cash");
    expect(unknown.portfolio.cashUsd).toBeNull();
    expect(unknown.realized.totalGainUsd).toBeNull();
    const names = [
      "create",
      "stale-winner",
      "prestage-winner",
      "overlap-winner",
      "unknown",
    ] as const;
    expect(names.map((name) => data.commands.a[name].expectedVersion)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(
      names.map((name) => data.commands.a[name].payload.opening.cashUsd),
    ).toEqual(["1000.00", "1100.00", "1200.00", "1300.00", "1400.00"]);
    expect(
      new Set(
        names.map((name) =>
          encodePortfolioPayload(data.commands.a[name].payload),
        ),
      ).size,
    ).toBe(5);
  });

  it("measures a valid 20-identity/250-activity fixture and refuses 251 before storage", () => {
    const payload = data.commands.size.capacity.payload;
    expect(payload.identities).toHaveLength(20);
    expect(payload.transactions).toHaveLength(250);
    expect(Buffer.byteLength(encodePortfolioPayload(payload))).toBe(132270);
    expect(Buffer.byteLength(JSON.stringify(data.commands.size.capacity))).toBe(
      132363,
    );
    expect(132270).toBeLessThan(262144);
    const result = projectPersonalPortfolioLedger(payload, "2026-10-16");
    expect(result.status).toBe("valid");
    if (result.status !== "valid")
      throw new Error("Invalid cardinality-cap fixture");
    expect(result.portfolio.cashUsd).toBe("997.50");
    expect(result.portfolio.holdings).toHaveLength(20);
    expect(
      result.portfolio.holdings.map((item) => [
        item.shares,
        item.totalCostBasisUsd,
      ]),
    ).toEqual([
      ...Array.from({ length: 10 }, () => ["0.000013", "0.13"]),
      ...Array.from({ length: 10 }, () => ["0.000012", "0.12"]),
    ]);
    expect(data.overCapacityCommand.payload.transactions).toHaveLength(251);
    expect(parsePortfolioPayload(data.overCapacityCommand.payload)).toBeNull();
    expect(parseManagedPortfolioCommand(data.overCapacityCommand)).toBeNull();
  });

  it("owns and freezes all nested commands, catalogs, pins and row manifests", () => {
    function assertFrozen(value: unknown): void {
      if (value === null || typeof value !== "object") return;
      expect(Object.isFrozen(value)).toBe(true);
      Object.values(value).forEach(assertFrozen);
    }
    [
      data,
      PORTFOLIO_PROOF_PRINCIPALS,
      PORTFOLIO_PROOF_ROWS,
      PORTFOLIO_PROOF_COMMAND_PINS,
      PORTFOLIO_PROOF_CATALOG_PINS,
      PORTFOLIO_PROOF_LIMITS,
      PORTFOLIO_PROOF_PHASES,
    ].forEach(assertFrozen);
    expect(
      Reflect.set(data.commands.a.create.payload.opening, "cashUsd", "0.00"),
    ).toBe(false);
    expect(
      Reflect.set(
        data.commands.a.create.payload.identities[0]!,
        "securityId",
        "forged",
      ),
    ).toBe(false);
    const copied = structuredClone(data.commands.a.create);
    expect(Reflect.set(copied.payload.opening, "cashUsd", "0.00")).toBe(true);
    expect(data.commands.a.create.payload.opening.cashUsd).toBe("1000.00");
  });
});

/** Read-only synthetic row adapter. No commit simulation or platform claim. */
function guardRepository(catalog: ManagedSecurityMasterCatalog) {
  const current = portfolioProofLocation("a");
  const payloadJson = encodePortfolioPayload(data.commands.a.unknown.payload);
  const getRow = vi.fn((location: AppwriteRowLocation): Promise<unknown> => {
    if (location.rowId !== current.rowId)
      return Promise.reject(
        new AppwriteException("absent", 404, "row_not_found"),
      );
    return Promise.resolve({
      $id: current.rowId,
      $databaseId: current.databaseId,
      $tableId: current.tableId,
      $sequence: "1",
      $createdAt: TIME,
      $updatedAt: TIME,
      $permissions: [],
      ownerId: PORTFOLIO_PROOF_PRINCIPALS.a.userId,
      resourceId: "main",
      version: 5,
      payloadJson,
      digestSha256: hash(payloadJson),
      createdAt: TIME,
      updatedAt: TIME,
    });
  });
  const forbidden = vi.fn((): Promise<unknown> =>
    Promise.reject(new Error("Unexpected proof fixture mutation")),
  );
  const store: AppwriteVersionedRowStore = {
    getRow,
    createTransaction: forbidden,
    createRow: forbidden,
    updateRow: forbidden,
    incrementRowColumn: forbidden,
    updateTransaction: forbidden,
  };
  return {
    getRow,
    forbidden,
    repository: createAppwritePortfolioRepository({
      store,
      databaseId: PORTFOLIO_PROOF_TARGET.databaseId,
      portfoliosTableId: PORTFOLIO_PROOF_TARGET.currentTableId,
      receiptsTableId: PORTFOLIO_PROOF_TARGET.receiptsTableId,
      catalog,
      now: () => new Date(TIME),
    }),
  };
}

describe("fixed proof commands at the actual repository policy", () => {
  it.each(["future", "rebind", "stale-catalog"] as const)(
    "refuses %s with exact retained version before a transaction",
    async (name) => {
      const catalog =
        name === "rebind"
          ? data.reboundCatalog
          : name === "stale-catalog"
            ? data.revisedCatalog
            : data.catalog;
      const fixture = guardRepository(catalog);
      await expect(
        fixture.repository.put(
          PORTFOLIO_PROOF_PRINCIPALS.a,
          data.commands.a[name],
        ),
      ).rejects.toMatchObject({ code: "invalid_request" });
      expect(fixture.forbidden).not.toHaveBeenCalled();
      expect(fixture.getRow.mock.calls.map(([location]) => location)).toEqual([
        portfolioProofLocation("a", name),
        portfolioProofLocation("a"),
      ]);
    },
  );

  it("reads the complete historical ledger through the revised catalog with one exact current-row read", async () => {
    const fixture = guardRepository(data.revisedCatalog);
    expect(await fixture.repository.get(PORTFOLIO_PROOF_PRINCIPALS.a)).toEqual({
      id: "main",
      version: 5,
      payload: data.commands.a.unknown.payload,
      createdAt: TIME,
      updatedAt: TIME,
    });
    expect(fixture.getRow.mock.calls.map(([location]) => location)).toEqual([
      portfolioProofLocation("a"),
    ]);
    expect(fixture.forbidden).not.toHaveBeenCalled();
  });
});
