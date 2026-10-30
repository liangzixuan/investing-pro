import {
  encodeResearchFollowupsPayload,
  parseManagedCatalogResolveResponse,
  parseManagedResearchFollowupsCommand,
  parseManagedSecFilingsRequest,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import { filingAssessmentPacket } from "./filing-check-assessment-fixture-data";
import {
  companyChecksData,
  companyChecksExpected,
} from "./company-research-checks-fixture-data";
type Counts = {
  load: number;
  portfolioLoad: number;
  resolve: number;
  filings: number;
  rejected: number;
  save: number;
  portfolioSave: number;
  eod: number;
  annual: number;
  interim: number;
  calendar: number;
  fed: number;
  cpi: number;
  search: number;
  valuationLoad: number;
  valuationSave: number;
};
export interface CompanyResearchChecksFixture {
  readonly data: ReturnType<typeof companyChecksData>;
  readonly packet: ReturnType<typeof filingAssessmentPacket>;
  readonly getSnapshot: () => Readonly<Counts>;
  readonly subscribe: (listener: () => void) => () => void;
}
export function createCompanyResearchChecksFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const data = companyChecksData(base),
    packet = filingAssessmentPacket(base);
  const startedOn = new Date().toISOString().slice(0, 10);
  const followups = createResearchFollowupsFixture({
    version: 1,
    payload: data.followups,
  });
  let counts: Readonly<Counts> = Object.freeze({
    load: 0,
    portfolioLoad: 0,
    resolve: 0,
    filings: 0,
    rejected: 0,
    save: 0,
    portfolioSave: 0,
    eod: 0,
    annual: 0,
    interim: 0,
    calendar: 0,
    fed: 0,
    cpi: 0,
    search: 0,
    valuationLoad: 0,
    valuationSave: 0,
  });
  const listeners = new Set<() => void>();
  const publish = (key: keyof Counts) => {
    counts = Object.freeze({ ...counts, [key]: counts[key] + 1 });
    for (const listener of listeners) listener();
  };
  function refuse(): never {
    publish("rejected");
    throw new Error("Unexpected invented company-research-checks operation");
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
      admit(
        !signal.aborted &&
          counts.load < 2 &&
          counts.load < followups.getSnapshot().session,
      );
      publish("load");
      return Promise.resolve({
        version: 7,
        payload: structuredClone(data.watchlist),
      });
    },
    loadPortfolio: (signal) => {
      admit(
        !signal.aborted &&
          counts.portfolioLoad < 2 &&
          counts.portfolioLoad < followups.getSnapshot().session,
      );
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
      const command = parseManagedResearchFollowupsCommand(input);
      admit(command && !signal.aborted && followups.getSnapshot().save === 0);
      admit(command.expectedVersion === 1 && counts.filings === 1);
      const completedOn = command.payload.entries[0]?.completedOn;
      admit(
        completedOn &&
          (completedOn === startedOn ||
            completedOn === new Date().toISOString().slice(0, 10)),
      );
      admit(
        encodeResearchFollowupsPayload(command.payload) ===
          encodeResearchFollowupsPayload(
            companyChecksExpected(base, completedOn),
          ),
      );
      return followups.api.saveFollowups(command, signal);
    },
    resolve: (request, signal) => {
      const ids = request.listingIds.join("|");
      if (ids === base.marketsCohort.map((row) => row.listingId).join("|"))
        return base.api.resolve(request, signal);
      admit(!signal.aborted && ids === "listing-zero" && counts.resolve < 4);
      admit(
        request.snapshotSha256 === base.researchCoverage.catalogSnapshotSha256,
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
    recentFilings: (input, signal) => {
      const request = parseManagedSecFilingsRequest(input);
      admit(request && !signal.aborted && counts.filings === 0);
      admit(
        request.catalogSnapshotSha256 === packet.catalogSnapshotSha256 &&
          request.listingId === packet.security.listingId &&
          request.symbol === packet.security.symbol,
      );
      publish("filings");
      return Promise.resolve(structuredClone(packet));
    },
    save: () => disallow("save"),
    savePortfolio: () => disallow("portfolioSave"),
    eodHistory: () => disallow("eod"),
    annualReport: () => disallow("annual"),
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
    companyResearchChecks: {
      data,
      packet,
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
