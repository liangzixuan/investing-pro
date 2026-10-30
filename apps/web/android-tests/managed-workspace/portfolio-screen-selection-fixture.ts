import {
  parseManagedCatalogResolveRequest,
  parseManagedCatalogResolveResponse,
  parseManagedSecAnnualCanonicalRequest,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { MANAGED_FINANCIAL_SCREEN_LISTING_IDS } from "../../src/clerk-trial/managed-financial-screen-cohort";
import { createManagedResearchCoverageFixture } from "../../src/clerk-trial/test-managed-research-coverage-fixture";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import {
  portfolioScreenHeldIds,
  portfolioScreenIds,
  portfolioScreenIdentities,
  portfolioScreenLedger,
  portfolioScreenPackets,
} from "./portfolio-screen-selection-fixture-data";

interface Counts {
  readonly status: number;
  readonly portfolioLoad: number;
  readonly resolve: number;
  readonly annual: number;
  readonly rejected: number;
  readonly unexpected: Readonly<Record<string, number>>;
  readonly annualRequests: readonly Readonly<{
    listingId: string;
    symbol: string;
    at: number;
  }>[];
}
export interface PortfolioScreenSelectionFixture {
  readonly identities: ReturnType<typeof portfolioScreenIdentities>;
  readonly loaded: ReturnType<typeof portfolioScreenLedger>;
  readonly packets: Awaited<ReturnType<typeof portfolioScreenPackets>>;
  readonly getSnapshot: () => Counts;
  readonly subscribe: (listener: () => void) => () => void;
}

/** One RAM ledger and two exact canonical packets; every other API operation refuses. */
export async function createPortfolioScreenSelectionFixture(
  base: SharedNativeFixture,
): Promise<ManagedNativeFixture> {
  const identities = portfolioScreenIdentities();
  const packets = await portfolioScreenPackets(identities);
  const loaded = portfolioScreenLedger(
    base.researchCoverage.catalogSnapshotSha256,
    identities,
  );
  const rows = identities.map((listing, index) => ({
    listing,
    cik:
      listing.symbol === "AAPL"
        ? "0000000001"
        : listing.symbol === "GOOG" || listing.symbol === "GOOGL"
          ? "0000000002"
          : String(index + 100).padStart(10, "0"),
  }));
  const coverage = createManagedResearchCoverageFixture(
    rows,
    base.researchCoverage.catalogSnapshotSha256,
  );
  const uncoveredCik = rows.find(
    (row) => row.listing.listingId === portfolioScreenIds.uncovered,
  )!.cik;
  const researchCoverage = Object.freeze({
    ...coverage,
    annualIssuers: Object.freeze(
      coverage.annualIssuers.filter((cik) => cik !== uncoveredCik),
    ),
  });
  let counts: Counts = Object.freeze({
    status: 0,
    portfolioLoad: 0,
    resolve: 0,
    annual: 0,
    rejected: 0,
    unexpected: Object.freeze({}),
    annualRequests: Object.freeze([]),
  });
  let state = base.getSnapshot();
  const listeners = new Set<() => void>();
  function publish() {
    state = {
      ...base.getSnapshot(),
      status: counts.status,
      load: counts.unexpected.load ?? 0,
      save: counts.unexpected.save ?? 0,
      resolve: counts.resolve,
      annual: counts.annual,
      marketsResolve: 0,
      eod: counts.unexpected.eodHistory ?? 0,
      filings: counts.unexpected.recentFilings ?? 0,
      search: counts.unexpected.search ?? 0,
      calendar: counts.unexpected.economicCalendar ?? 0,
      fed: counts.unexpected.monetaryAnnouncements ?? 0,
    };
    for (const listener of listeners) listener();
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  function refuse(operation: string): never {
    counts = Object.freeze({
      ...counts,
      rejected: counts.rejected + 1,
      unexpected: Object.freeze({
        ...counts.unexpected,
        [operation]: (counts.unexpected[operation] ?? 0) + 1,
      }),
    });
    publish();
    throw new Error(
      "Unexpected invented held-company screening operation: " + operation,
    );
  }
  function admit(value: unknown, operation: string): asserts value {
    if (!value) refuse(operation);
  }
  base.subscribe(publish);
  const refused = Object.fromEntries(
    Object.entries(base.api)
      .filter(([, value]) => typeof value === "function")
      .map(([key]) => [key, () => Promise.resolve().then(() => refuse(key))]),
  );
  const api: ManagedApi = {
    ...base.api,
    ...refused,
    status: async (signal) => {
      admit(!signal.aborted && counts.status === 0, "status");
      counts = Object.freeze({ ...counts, status: 1 });
      const response = await base.api.status(signal);
      publish();
      return {
        snapshot: {
          ...response.snapshot,
          catalogId: "invented-held-company-catalog",
          coverage: {
            ...response.snapshot.coverage,
            activeEligibleSecurities: 19,
            activeListings: 19,
            admittedSourceRecords: 19,
            issuers: 18,
            sourceRecords: 19,
            shareClasses: 19,
            totalSecurities: 19,
          },
        },
      };
    },
    loadPortfolio: (signal) => {
      admit(
        !signal.aborted &&
          counts.status === 1 &&
          counts.portfolioLoad === 0 &&
          counts.annual === 0,
        "loadPortfolio",
      );
      counts = Object.freeze({ ...counts, portfolioLoad: 1 });
      publish();
      return Promise.resolve(structuredClone(loaded));
    },
    resolve: async (input, signal) => {
      const request = parseManagedCatalogResolveRequest(input);
      admit(
        request &&
          !signal.aborted &&
          counts.status === 1 &&
          counts.portfolioLoad === 1 &&
          request.snapshotSha256 === researchCoverage.catalogSnapshotSha256,
        "resolve",
      );
      const expected =
        counts.resolve === 0
          ? portfolioScreenHeldIds
          : counts.resolve === 1
            ? MANAGED_FINANCIAL_SCREEN_LISTING_IDS
            : [];
      admit(
        expected.length && request.listingIds.join("|") === expected.join("|"),
        "resolve order",
      );
      const result = parseManagedCatalogResolveResponse(
        {
          snapshotSha256: request.snapshotSha256,
          results: request.listingIds.map((listingId) => ({
            listingId,
            listing:
              identities.find((row) => row.listingId === listingId) ?? null,
          })),
        },
        request,
      );
      admit(result, "resolve response");
      counts = Object.freeze({ ...counts, resolve: counts.resolve + 1 });
      publish();
      return Promise.resolve(result);
    },
    annualReport: async (input, signal) => {
      const request = parseManagedSecAnnualCanonicalRequest(input),
        packet = packets[counts.annual],
        at = performance.now();
      admit(
        request &&
          packet &&
          !signal.aborted &&
          counts.resolve === 2 &&
          counts.portfolioLoad === 1 &&
          request.catalogSnapshotSha256 === packet.catalogSnapshotSha256 &&
          request.listingId === packet.security.listingId &&
          request.symbol === packet.security.symbol,
        "Annual exact selected identity",
      );
      const previous = counts.annualRequests.at(-1);
      admit(!previous || at - previous.at >= 20000, "Annual pace");
      counts = Object.freeze({
        ...counts,
        annual: counts.annual + 1,
        annualRequests: Object.freeze([
          ...counts.annualRequests,
          Object.freeze({
            listingId: request.listingId,
            symbol: request.symbol,
            at,
          }),
        ]),
      });
      publish();
      return Promise.resolve(structuredClone(packet));
    },
  };
  publish();
  return {
    ...base,
    api,
    researchCoverage,
    financialReview: null,
    getSnapshot: () => state,
    subscribe,
    portfolioScreenSelection: {
      identities,
      loaded,
      packets,
      getSnapshot: () => counts,
      subscribe,
    },
  };
}
