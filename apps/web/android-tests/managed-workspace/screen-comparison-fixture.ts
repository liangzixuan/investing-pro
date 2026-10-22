import {
  parseManagedCatalogResolveRequest,
  parseManagedCatalogResolveResponse,
  parseManagedSecAnnualCanonicalRequest,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import {
  annualComparisonResponse,
  annualComparisonMemberships,
  annualComparisonBalanceRows,
  annualComparisonOperatingRows,
} from "../../src/clerk-trial/test-canonical-annual-comparison-fixture";
import type { SharedNativeFixture } from "./fixture";

export const screenComparisonListingIds = Object.freeze([
  "listing-zero",
  "listing-one",
]);
export const screenComparisonPins = Object.freeze({
  left: {
    symbol: "ZERO",
    reportDate: "2025-12-31",
    cash: "1000",
    assets: "1000.125",
  },
  right: {
    symbol: "ONE",
    reportDate: "2025-06-30",
    cash: "900",
    assets: `1000.${"0".repeat(58)}1`,
  },
});
export interface NativeScreenComparisonMetadata {
  readonly listingIds: readonly string[];
  readonly pins: typeof screenComparisonPins;
}
type State = ReturnType<SharedNativeFixture["getSnapshot"]>;
type Counter =
  | "resolve"
  | "annual"
  | "save"
  | "eod"
  | "filings"
  | "search"
  | "calendar"
  | "fed";

/** Two canonical invented issuers; only the real screen controls dispatch their reads. */
export async function createScreenComparisonNativeFixture(
  base: SharedNativeFixture,
) {
  const packets = await Promise.all(
    (["left", "right"] as const).map((side) =>
      annualComparisonResponse(side, {
        operatingRows: annualComparisonOperatingRows(side),
        balanceRows: annualComparisonBalanceRows(side),
      }),
    ),
  );
  const overrides: Partial<Record<Counter, number>> = {};
  let snapshot: State = base.getSnapshot();
  let firstAnnualAt: number | null = null;
  const listeners = new Set<() => void>();
  const publish = () => {
    snapshot = { ...base.getSnapshot(), ...overrides };
    for (const listener of listeners) listener();
  };
  base.subscribe(publish);
  const count = (key: Counter) => {
    overrides[key] = snapshot[key] + 1;
    publish();
  };
  const unexpected = (operation: string): Promise<never> =>
    Promise.reject(
      new Error(`Unexpected screen comparison operation: ${operation}`),
    );
  const unrelated = () =>
    snapshot.save +
      snapshot.eod +
      snapshot.filings +
      snapshot.search +
      snapshot.calendar +
      snapshot.fed +
      snapshot.token +
      snapshot.signOut !==
    0;
  const startupReady = () =>
    snapshot.load === 1 && snapshot.status === 1 && !unrelated();
  const api: ManagedApi = {
    ...base.api,
    load: (signal) =>
      signal.aborted || snapshot.load !== 0
        ? unexpected("load")
        : base.api.load(signal),
    status: (signal) =>
      signal.aborted || snapshot.status !== 0
        ? unexpected("status")
        : base.api.status(signal),
    resolve: (input, signal) => {
      const request = parseManagedCatalogResolveRequest(input);
      if (
        request?.listingIds.join("|") ===
        base.marketsCohort.map((row) => row.listingId).join("|")
      ) {
        if (
          signal.aborted ||
          !startupReady() ||
          snapshot.marketsResolve !== 0 ||
          snapshot.resolve !== 0 ||
          snapshot.annual !== 0
        )
          return unexpected("startup resolve");
        return base.api.resolve(input, signal);
      }
      if (
        signal.aborted ||
        !startupReady() ||
        request?.snapshotSha256 !== packets[0]!.catalogSnapshotSha256 ||
        request.listingIds.join("|") !== screenComparisonListingIds.join("|") ||
        snapshot.marketsResolve !== 1 ||
        snapshot.resolve !== 0 ||
        snapshot.annual !== 0
      )
        return unexpected("screen resolve");
      const results = (["left", "right"] as const).map((side, index) => {
        const { note: _note, ...listing } = annualComparisonMemberships[side];
        void _note;
        return { listingId: packets[index]!.security.listingId, listing };
      });
      const resolved = parseManagedCatalogResolveResponse(
        { snapshotSha256: request.snapshotSha256, results },
        request,
      );
      if (!resolved)
        throw new Error("Invented comparison identities were refused");
      count("resolve");
      return Promise.resolve(resolved);
    },
    annualReport: (input, signal) => {
      const dispatchedAt = performance.now();
      const request = parseManagedSecAnnualCanonicalRequest(input);
      const packet = packets[snapshot.annual];
      if (
        signal.aborted ||
        !startupReady() ||
        !packet ||
        request?.catalogSnapshotSha256 !== packet.catalogSnapshotSha256 ||
        request.listingId !== packet.security.listingId ||
        request.symbol !== packet.security.symbol ||
        snapshot.marketsResolve !== 1 ||
        snapshot.resolve !== 1 ||
        (firstAnnualAt !== null && dispatchedAt - firstAnnualAt < 20000)
      )
        return unexpected("annualReport");
      if (firstAnnualAt === null) firstAnnualAt = dispatchedAt;
      count("annual");
      return Promise.resolve(structuredClone(packet));
    },
    save: () => {
      count("save");
      return unexpected("save");
    },
    eodHistory: () => {
      count("eod");
      return unexpected("eodHistory");
    },
    recentFilings: () => {
      count("filings");
      return unexpected("recentFilings");
    },
    search: () => {
      count("search");
      return unexpected("search");
    },
    economicCalendar: () => {
      count("calendar");
      return unexpected("economicCalendar");
    },
    monetaryAnnouncements: () => {
      count("fed");
      return unexpected("monetaryAnnouncements");
    },
    loadPortfolio: () => unexpected("loadPortfolio"),
    savePortfolio: () => unexpected("savePortfolio"),
    loadFollowups: () => unexpected("loadFollowups"),
    saveFollowups: () => unexpected("saveFollowups"),
  };
  return {
    ...base,
    api,
    financialReview: null,
    screenComparison: Object.freeze({
      listingIds: screenComparisonListingIds,
      pins: screenComparisonPins,
    }),
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
