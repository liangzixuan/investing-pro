import {
  encodePortfolioPayload,
  projectPersonalPortfolioLedger,
  type ManagedPortfolioPayload,
} from "@research-cockpit/contracts";
import { expect, it } from "vitest";

import { createAppwritePortfolioRepository } from "./appwrite-portfolio-repository";
import {
  createManagedCatalogService,
  getManagedWorkspaceCatalog,
} from "./managed-workspace-catalog";
import { AtomicStore } from "./test-appwrite-atomic-store";

it.each(["AAPL", "AMD"])(
  "saves and reopens authored %s activity with the current reviewed catalog",
  async (symbol) => {
    const catalog = getManagedWorkspaceCatalog();
    const service = createManagedCatalogService();
    const listingId = service
      .search(symbol)!
      .results.find((row) => row.symbol === symbol)!.listingId;
    const identity = service.resolve({
      snapshotSha256: catalog.snapshotSha256,
      listingIds: [listingId],
    })!.results[0]!.listing!;
    const payload: ManagedPortfolioPayload = {
      schemaVersion: 3,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: catalog.snapshotSha256,
      basisMethod: "fifo_with_opening_pool",
      identities: [identity],
      opening: {
        asOfDate: "2026-10-01",
        cashUsd: "1000.00",
        holdings: [],
      },
      transactions: [
        {
          id: "invented-buy",
          date: "2026-10-02",
          type: "buy",
          listingId,
          shares: "2.000000",
          grossUsd: "200.00",
          feeUsd: "1.00",
        },
        {
          id: "invented-sell",
          date: "2026-10-03",
          type: "sell",
          listingId,
          shares: "1.000000",
          grossUsd: "150.00",
          feeUsd: "1.00",
        },
      ],
    };
    const store = new AtomicStore();
    const options = {
      store,
      databaseId: "invented-catalog-portfolio",
      portfoliosTableId: "portfolios",
      receiptsTableId: "receipts",
      catalog,
      now: () => new Date("2026-10-16T21:00:00.000Z"),
    };
    const principal = { userId: "invented-catalog-portfolio-owner" };
    const command = {
      expectedVersion: 0,
      idempotencyKey: "invented-catalog-portfolio-save",
      payload,
    };
    const repository = createAppwritePortfolioRepository(options);
    expect(await repository.get(principal)).toBeNull();
    const saved = await repository.put(principal, command);
    expect(saved).toMatchObject({ version: 1, replayed: false });
    expect(await repository.put(principal, command)).toEqual({
      ...saved,
      replayed: true,
    });

    const reopened =
      await createAppwritePortfolioRepository(options).get(principal);
    expect(reopened?.version).toBe(1);
    expect(reopened?.payload).toEqual(payload);
    expect(encodePortfolioPayload(reopened!.payload)).toBe(
      encodePortfolioPayload(payload),
    );
    expect(reopened!.payload.identities).toEqual([identity]);
    expect(
      await repository.get({ userId: "invented-other-catalog-owner" }),
    ).toBeNull();
    expect(store.rows.size).toBe(2);
    const result = projectPersonalPortfolioLedger(
      reopened!.payload,
      "2026-10-16",
    );
    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error("Expected authored ledger");
    expect(result.portfolio.cashUsd).toBe("948.00");
    expect(result.portfolio.holdings).toHaveLength(1);
    expect(result.portfolio.holdings[0]).toMatchObject({
      identity,
      shares: "1",
      totalCostBasisUsd: "100.50",
    });
    expect(result.realized.totalGainUsd).toBe("48.50");
  },
);
