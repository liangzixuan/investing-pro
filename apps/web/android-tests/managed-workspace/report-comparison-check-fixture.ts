import {
  encodeResearchFollowupsPayload,
  parseManagedCatalogResolveResponse,
  parseManagedResearchFollowupsCommand,
  parseManagedSecAnnualCanonicalRequest,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import {
  reportComparisonCheckData,
  reportComparisonCheckExpected,
  reportCheckResultIsExpected,
} from "./report-comparison-check-fixture-data";
type Counts = {
  load: number;
  portfolioLoad: number;
  resolve: number;
  annual: number;
  rejected: number;
  save: number;
  portfolioSave: number;
  eod: number;
  filings: number;
  interim: number;
  calendar: number;
  fed: number;
  cpi: number;
  search: number;
  valuationLoad: number;
  valuationSave: number;
};
export interface ReportComparisonCheckFixture {
  readonly data: ReturnType<typeof reportComparisonCheckData>;
  readonly getSnapshot: () => Readonly<Counts>;
  readonly subscribe: (listener: () => void) => () => void;
}
export function createReportComparisonCheckFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const data = reportComparisonCheckData(base),
    startedOn = new Date().toISOString().slice(0, 10);
  const followups = createResearchFollowupsFixture({
    version: 1,
    payload: data.followups,
  });
  let counts: Readonly<Counts> = Object.freeze({
    load: 0,
    portfolioLoad: 0,
    resolve: 0,
    annual: 0,
    rejected: 0,
    save: 0,
    portfolioSave: 0,
    eod: 0,
    filings: 0,
    interim: 0,
    calendar: 0,
    fed: 0,
    cpi: 0,
    search: 0,
    valuationLoad: 0,
    valuationSave: 0,
  });
  const listeners = new Set<() => void>();
  function publish(key: keyof Counts) {
    counts = Object.freeze({ ...counts, [key]: counts[key] + 1 });
    for (const listener of listeners) listener();
  }
  function refuse(): never {
    publish("rejected");
    throw new Error("Unexpected invented report-comparison-check operation");
  }
  function admit(condition: unknown): asserts condition {
    if (!condition) refuse();
  }
  const disallow = (key: keyof Counts): never => {
    publish(key);
    return refuse();
  };
  const api: ManagedApi = {
    ...base.api,
    load: (signal) => {
      admit(!signal.aborted && counts.load === 0);
      publish("load");
      return Promise.resolve({
        version: 7,
        payload: structuredClone(data.watchlist),
      });
    },
    loadPortfolio: (signal) => {
      admit(!signal.aborted && counts.portfolioLoad === 0);
      publish("portfolioLoad");
      return Promise.resolve({
        version: 3,
        payload: structuredClone(data.portfolio),
      });
    },
    loadFollowups: (signal) => {
      const state = followups.getSnapshot();
      admit(!signal.aborted && state.load < 2 && state.load < state.session);
      if (state.load === 1) admit(state.commits === 1);
      return followups.api.loadFollowups(signal);
    },
    saveFollowups: (input, signal) => {
      const command = parseManagedResearchFollowupsCommand(input),
        state = followups.getSnapshot();
      admit(
        command &&
          !signal.aborted &&
          state.save === 0 &&
          command.expectedVersion === 1 &&
          counts.annual === 1,
      );
      const completedOn = command.payload.entries[0]?.completedOn,
        result = command.payload.entries[0]?.result;
      admit(
        completedOn &&
          result &&
          (completedOn === startedOn ||
            completedOn === new Date().toISOString().slice(0, 10)),
      );
      admit(
        reportCheckResultIsExpected(base, result) && [...result].length <= 2000,
      );
      admit(
        encodeResearchFollowupsPayload(command.payload) ===
          encodeResearchFollowupsPayload(
            reportComparisonCheckExpected(base, result, completedOn),
          ),
      );
      return followups.api.saveFollowups(command, signal);
    },
    resolve: (request, signal) => {
      const ids = request.listingIds.join("|");
      if (ids === base.marketsCohort.map((row) => row.listingId).join("|"))
        return base.api.resolve(request, signal);
      admit(
        !signal.aborted &&
          ids === "listing-zero" &&
          counts.resolve === 0 &&
          request.snapshotSha256 ===
            base.researchCoverage.catalogSnapshotSha256,
      );
      const response = parseManagedCatalogResolveResponse(
        {
          snapshotSha256: request.snapshotSha256,
          results: [
            {
              listingId: "listing-zero",
              listing: base.researchCoverage.listings[0]!.listing,
            },
          ],
        },
        request,
      );
      admit(response);
      publish("resolve");
      return Promise.resolve(response);
    },
    annualReport: (input, signal) => {
      const request = parseManagedSecAnnualCanonicalRequest(input);
      admit(
        request &&
          !signal.aborted &&
          counts.annual === 0 &&
          request.listingId === "listing-zero" &&
          request.symbol === "ZERO" &&
          request.catalogSnapshotSha256 ===
            base.researchCoverage.catalogSnapshotSha256,
      );
      publish("annual");
      return base.api.annualReport(request, signal);
    },
    save: () => disallow("save"),
    savePortfolio: () => disallow("portfolioSave"),
    eodHistory: () => disallow("eod"),
    recentFilings: () => disallow("filings"),
    interimReport: () => disallow("interim"),
    search: () => disallow("search"),
    economicCalendar: () => disallow("calendar"),
    blsCalendar: () => disallow("calendar"),
    monetaryAnnouncements: () => disallow("fed"),
    cpiHeadlines: () => disallow("cpi"),
    loadValuationAssumptions: () => disallow("valuationLoad"),
    saveValuationAssumptions: () => disallow("valuationSave"),
  };
  return {
    ...base,
    api,
    financialReview: null,
    followups,
    session: followups.nextSession(),
    reportComparisonCheck: {
      data,
      getSnapshot: () => counts,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  };
}
