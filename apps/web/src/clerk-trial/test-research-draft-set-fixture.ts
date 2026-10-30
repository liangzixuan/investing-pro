import { vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedPortfolioPayload,
  ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import {
  collectionFixture,
  scope,
  time,
} from "./test-valuation-collection-fixture";
import { ManagedResearchDraftSetRecovery } from "./managed-research-draft-set-recovery";
import {
  RESEARCH_DRAFT_RESOURCES,
  type ManagedResearchDraftSetFileContent,
} from "./managed-research-draft-set-file";
import type { ManagedResearchDraftSetFileDeliveryAdapter } from "./research-draft-set-file-delivery";
export { scope, time };
export async function draftSetFixture(
  options: { portfolioLoaded?: boolean } = {},
) {
  const f = await collectionFixture();
  f.recovery.dispose();
  const w = f.workspace;
  const listing = f.payload.entries[0]!.listing,
    digest = f.payload.entries[0]!.catalogSnapshotSha256;
  let watch = {
    version: 3,
    payload: {
      name: "My Watchlist",
      schemaVersion: 1,
      snapshotSha256: digest,
      memberships: [{ ...listing, note: "Whole note · 東京 😀 \nsecond line" }],
    } as MainWatchlistPayload,
  };
  let portfolio = {
    version: 3,
    payload: {
      schemaVersion: 3,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: digest,
      basisMethod: "fifo_with_opening_pool",
      identities: [listing],
      opening: { asOfDate: "2026-10-01", cashUsd: "1000.00", holdings: [] },
      transactions: [],
    } as ManagedPortfolioPayload,
  };
  let followups = {
    version: 3,
    payload: {
      schemaVersion: 1,
      entries: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          catalogSnapshotSha256: digest,
          listing,
          check: "Whole question 東京 😀",
          dueOn: "2026-10-31",
          result: "Full authored result",
          status: "open",
          completedOn: null,
        },
      ],
    } as ResearchFollowupsPayload,
  };
  f.api.load = vi.fn(() => Promise.resolve(structuredClone(watch)));
  f.api.save = vi.fn<ManagedApi["save"]>((c) => {
    watch = {
      version: c.expectedVersion + 1,
      payload: structuredClone(c.payload),
    };
    return Promise.resolve({ ...structuredClone(watch), replayed: false });
  });
  f.api.loadPortfolio = vi.fn(() =>
    Promise.resolve(structuredClone(portfolio)),
  );
  f.api.savePortfolio = vi.fn<ManagedApi["savePortfolio"]>((c) => {
    portfolio = {
      version: c.expectedVersion + 1,
      payload: structuredClone(c.payload),
    };
    return Promise.resolve({ ...structuredClone(portfolio), replayed: false });
  });
  f.api.loadFollowups = vi.fn(() =>
    Promise.resolve(structuredClone(followups)),
  );
  f.api.saveFollowups = vi.fn<ManagedApi["saveFollowups"]>((c) => {
    followups = {
      version: c.expectedVersion + 1,
      payload: structuredClone(c.payload),
    };
    return Promise.resolve({ ...structuredClone(followups), replayed: false });
  });
  f.setStored(3, f.payload);
  await w.coordinator.load();
  if (options.portfolioLoaded !== false) await w.portfolio.coordinator.load();
  await w.followups.coordinator.load();
  await w.valuationAssumptions.coordinator.load();
  let active = true;
  const deliver = vi.fn<ManagedResearchDraftSetFileDeliveryAdapter["deliver"]>(
    () => Promise.resolve("written"),
  );
  const recovery = new ManagedResearchDraftSetRecovery({
    workspace: w,
    accountScope: Promise.resolve(scope),
    delivery: { deliver },
    routeActive: () => active,
    now: () => time,
  });
  await Promise.resolve();
  return {
    ...f,
    recovery,
    deliver,
    active: (v: boolean) => {
      active = v;
      recovery.reconcile();
    },
    capture: () => {
      for (const k of RESEARCH_DRAFT_RESOURCES)
        recovery.selectResource(k, true);
      if (!recovery.captureDrafts())
        throw new Error("Invented all-resource capture refused");
      return recovery.getSnapshot().file!;
    },
    newer: async () => {
      watch = { version: 5, payload: { ...watch.payload, memberships: [] } };
      portfolio = {
        version: 7,
        payload: {
          ...portfolio.payload,
          opening: { ...portfolio.payload.opening, cashUsd: "2000.00" },
        },
      };
      followups = { version: 11, payload: { schemaVersion: 1, entries: [] } };
      f.setStored(9, { schemaVersion: 1, entries: [] });
      await w.coordinator.load();
      await w.portfolio.coordinator.load();
      await w.followups.coordinator.load();
      await w.valuationAssumptions.coordinator.load();
    },
    close: () => {
      recovery.dispose();
      f.close();
    },
  };
}
export function draftSetFile(file: ManagedResearchDraftSetFileContent) {
  const bytes = new TextEncoder().encode(JSON.stringify(file) + "\n").buffer;
  return {
    size: bytes.byteLength,
    arrayBuffer: vi.fn(() => Promise.resolve(bytes)),
  };
}
