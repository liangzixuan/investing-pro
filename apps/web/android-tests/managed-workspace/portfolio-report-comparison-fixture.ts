import {
  parseManagedCatalogResolveRequest,
  parseManagedCatalogResolveResponse,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { createManagedResearchCoverageFixture } from "../../src/clerk-trial/test-managed-research-coverage-fixture";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import {
  portfolioComparisonIds,
  portfolioComparisonIdentities,
  portfolioComparisonLedger,
  portfolioComparisonPacket,
} from "./portfolio-report-comparison-fixture-data";

interface Counts {
  readonly status: number;
  readonly load: number;
  readonly portfolioLoad: number;
  readonly resolve: number;
  readonly eod: number;
  readonly rejected: number;
  readonly current: boolean;
  readonly unexpected: Readonly<Record<string, number>>;
  readonly requests: readonly {
    readonly listingId: string;
    readonly current: boolean;
    readonly at: number;
    readonly response: ReturnType<typeof portfolioComparisonPacket>;
  }[];
}
export interface PortfolioReportComparisonFixture {
  readonly baseline: ReturnType<typeof portfolioComparisonLedger>;
  readonly current: ReturnType<typeof portfolioComparisonLedger>;
  readonly observedDate: string;
  readonly identities: ReturnType<typeof portfolioComparisonIdentities>;
  readonly getSnapshot: () => Counts;
  readonly subscribe: (listener: () => void) => () => void;
  readonly changeCurrent: () => void;
}
/** Fixed RAM reports and five explicit close requests; every unexpected operation refuses. */
export function createPortfolioReportComparisonFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const baseline = portfolioComparisonLedger(base, false),
    current = portfolioComparisonLedger(base, true),
    identities = portfolioComparisonIdentities(base),
    observedDate = new Date().toISOString().slice(0, 10);
  const coverage = createManagedResearchCoverageFixture(
    identities.map((listing, i) => ({
      listing,
      cik: i < 2 ? "0000000001" : String(i + 1).padStart(10, "0"),
    })),
    base.researchCoverage.catalogSnapshotSha256,
  );
  let counts: Counts = Object.freeze({
    status: 0,
    load: 0,
    portfolioLoad: 0,
    resolve: 0,
    eod: 0,
    rejected: 0,
    current: false,
    unexpected: Object.freeze({}),
    requests: Object.freeze([]),
  });
  let snapshot = base.getSnapshot();
  const listeners = new Set<() => void>();
  function publish() {
    snapshot = {
      ...base.getSnapshot(),
      status: counts.status,
      load: counts.load,
      resolve: counts.resolve,
      eod: counts.eod,
    };
    for (const listener of listeners) listener();
  }
  function update(patch: Partial<Counts>) {
    counts = Object.freeze({ ...counts, ...patch });
    publish();
  }
  function refuse(operation: string): never {
    update({
      rejected: counts.rejected + 1,
      unexpected: Object.freeze({
        ...counts.unexpected,
        [operation]: (counts.unexpected[operation] ?? 0) + 1,
      }),
    });
    throw new Error(
      "Unexpected invented saved Portfolio comparison operation: " + operation,
    );
  }
  function admit(value: unknown, operation: string): asserts value {
    if (!value) refuse(operation);
  }
  base.subscribe(publish);
  const refused = Object.fromEntries(
    Object.entries(base.api)
      .filter(([, v]) => typeof v === "function")
      .map(([key]) => [key, () => Promise.resolve().then(() => refuse(key))]),
  );
  const api: ManagedApi = {
    ...base.api,
    ...refused,
    status: async (signal) => {
      admit(!signal.aborted && counts.status === 0, "status");
      update({ status: 1 });
      return base.api.status(signal);
    },
    load: async (signal) => {
      admit(!signal.aborted && counts.load === 0, "load");
      update({ load: 1 });
      return base.api.load(signal);
    },
    loadPortfolio: (signal) =>
      Promise.resolve().then(() => {
        admit(
          !signal.aborted && counts.status === 1 && counts.portfolioLoad === 0,
          "loadPortfolio",
        );
        update({ portfolioLoad: 1 });
        return structuredClone(baseline);
      }),
    resolve: (input, signal) =>
      Promise.resolve().then(() => {
        const request = parseManagedCatalogResolveRequest(input);
        const expected =
          counts.resolve === 0
            ? baseline.payload.identities
            : counts.resolve === 1
              ? current.payload.identities
              : [];
        admit(
          request &&
            !signal.aborted &&
            counts.portfolioLoad === 1 &&
            counts.current === counts.resolve > 0 &&
            request.snapshotSha256 === coverage.catalogSnapshotSha256 &&
            expected.length &&
            request.listingIds.join("|") ===
              expected.map((r) => r.listingId).join("|"),
          "resolve",
        );
        const result = parseManagedCatalogResolveResponse(
          {
            snapshotSha256: request.snapshotSha256,
            results: expected.map((listing) => ({
              listingId: listing.listingId,
              listing,
            })),
          },
          request,
        );
        admit(result, "resolve response");
        update({ resolve: counts.resolve + 1 });
        return result;
      }),
    eodHistory: (request, signal) =>
      Promise.resolve().then(() => {
        const order = [
          portfolioComparisonIds.a,
          portfolioComparisonIds.c,
          portfolioComparisonIds.past,
          portfolioComparisonIds.a,
          portfolioComparisonIds.c,
        ];
        admit(
          !signal.aborted &&
            counts.eod < 5 &&
            request.listingId === order[counts.eod] &&
            request.catalogSnapshotSha256 === coverage.catalogSnapshotSha256 &&
            request.range === "1m" &&
            counts.current === counts.eod >= 3,
          "eodHistory",
        );
        const security = identities.find(
          (r) => r.listingId === request.listingId,
        );
        admit(security, "EOD exact identity");
        const response = portfolioComparisonPacket(
          request,
          security,
          counts.current,
          observedDate,
        );
        update({
          eod: counts.eod + 1,
          requests: Object.freeze([
            ...counts.requests,
            Object.freeze({
              listingId: request.listingId,
              current: counts.current,
              at: Date.now(),
              response,
            }),
          ]),
        });
        return response;
      }),
  };
  const metadata: PortfolioReportComparisonFixture = {
    baseline,
    current,
    observedDate,
    identities,
    getSnapshot: () => counts,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    changeCurrent: () => {
      admit(
        !counts.current && counts.eod === 3 && counts.resolve === 1,
        "change current setup",
      );
      update({ current: true });
    },
  };
  return {
    ...base,
    api,
    researchCoverage: coverage,
    priceCoverage: identities.filter(
      (r) => r.listingId !== portfolioComparisonIds.added,
    ),
    financialReview: null,
    portfolioReportComparison: metadata,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
