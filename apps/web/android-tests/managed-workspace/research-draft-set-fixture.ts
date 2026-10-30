import {
  encodePortfolioPayload,
  parseManagedPortfolioCommand,
  parseManagedPortfolioReceipt,
  parseManagedValuationAssumptionsCommand,
  parseManagedValuationAssumptionsReceipt,
  parseManagedCatalogResolveResponse,
  type ManagedWatchlistDto,
  type ManagedPortfolioDto,
  type ManagedResearchFollowupsDto,
  type ManagedValuationAssumptionsDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import type { TrialSession } from "../../src/clerk-trial/session";
import type { SharedNativeFixture, ManagedNativeFixture } from "./fixture";
import { researchDraftSetData } from "./research-draft-set-fixture-data";
interface Counts {
  session: number;
  watchLoad: number;
  portfolioLoad: number;
  followupsLoad: number;
  valuationLoad: number;
  portfolioSave: number;
  valuationSave: number;
  portfolioReview: number;
  valuationReview: number;
  rejected: number;
}
export interface ResearchDraftSetFixtureControls {
  readonly data: ReturnType<typeof researchDraftSetData>;
  readonly getSnapshot: () => Readonly<Counts>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly saved: () => {
    watchlist: ManagedWatchlistDto;
    portfolio: ManagedPortfolioDto;
    followups: ManagedResearchFollowupsDto;
    valuation: ManagedValuationAssumptionsDto;
  };
  nextSession(): TrialSession;
}
export function createResearchDraftSetFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const data = researchDraftSetData(base);
  let stored = {
    watchlist: {
      version: 3,
      payload: structuredClone(data.newer.watchlist),
    } as ManagedWatchlistDto,
    portfolio: {
      version: 3,
      payload: structuredClone(data.newer.portfolio),
    } as ManagedPortfolioDto,
    followups: {
      version: 3,
      payload: structuredClone(data.newer.followups),
    } as ManagedResearchFollowupsDto,
    valuation: {
      version: 3,
      payload: { schemaVersion: 1, entries: [] },
    } as ManagedValuationAssumptionsDto,
  };
  let counts: Readonly<Counts> = Object.freeze({
    session: 0,
    watchLoad: 0,
    portfolioLoad: 0,
    followupsLoad: 0,
    valuationLoad: 0,
    portfolioSave: 0,
    valuationSave: 0,
    portfolioReview: 0,
    valuationReview: 0,
    rejected: 0,
  });
  const listeners = new Set<() => void>();
  function publish(change: Partial<Counts>) {
    counts = Object.freeze({ ...counts, ...change });
    for (const listener of [...listeners]) listener();
  }
  function refuse(): never {
    publish({ rejected: counts.rejected + 1 });
    throw new Error("Unexpected invented research-draft-set operation");
  }
  function admit(condition: unknown): asserts condition {
    if (!condition) refuse();
  }
  function read(
    key: "portfolio" | "followups" | "valuation",
    signal: AbortSignal,
  ) {
    const field =
      key === "portfolio"
        ? "portfolioLoad"
        : key === "followups"
          ? "followupsLoad"
          : "valuationLoad";
    admit(!signal.aborted && counts[field] === counts.session);
    publish({ [field]: counts[field] + 1 });
    return structuredClone(stored[key]);
  }
  const watchLoad: ManagedApi["load"] = (signal) => {
    admit(
      !signal.aborted &&
        counts.watchLoad === counts.session &&
        base.getSnapshot().load === counts.session,
    );
    void base.api.load(signal);
    publish({ watchLoad: counts.watchLoad + 1 });
    return Promise.resolve(structuredClone(stored.watchlist));
  };
  const status: ManagedApi["status"] = (signal) => {
    admit(!signal.aborted && base.getSnapshot().status === counts.session);
    return base.api.status(signal);
  };
  const portfolioLoad: ManagedApi["loadPortfolio"] = (signal) =>
    Promise.resolve(read("portfolio", signal) as ManagedPortfolioDto);
  const followupsLoad: ManagedApi["loadFollowups"] = (signal) =>
    Promise.resolve(read("followups", signal) as ManagedResearchFollowupsDto);
  const valuationLoad: ManagedApi["loadValuationAssumptions"] = (signal) =>
    Promise.resolve(
      read("valuation", signal) as ManagedValuationAssumptionsDto,
    );
  const portfolioSave: ManagedApi["savePortfolio"] = (input, signal) => {
    const command = parseManagedPortfolioCommand(input);
    admit(
      command &&
        !signal.aborted &&
        counts.session === 1 &&
        counts.portfolioLoad === 2 &&
        counts.portfolioSave === 0 &&
        counts.portfolioReview === 1 &&
        command.expectedVersion === 7 &&
        encodePortfolioPayload(command.payload) ===
          encodePortfolioPayload(data.reviewed.portfolio),
    );
    const receipt = parseManagedPortfolioReceipt(
      { version: 8, payload: command.payload, replayed: false },
      command,
    );
    admit(receipt);
    stored = { ...stored, portfolio: { version: 8, payload: receipt.payload } };
    publish({ portfolioSave: 1 });
    return Promise.resolve(receipt);
  };
  const valuationSave: ManagedApi["saveValuationAssumptions"] = (
    input,
    signal,
  ) => {
    const command = parseManagedValuationAssumptionsCommand(input);
    admit(
      command &&
        !signal.aborted &&
        counts.session === 1 &&
        counts.valuationLoad === 2 &&
        counts.portfolioSave === 1 &&
        counts.valuationSave === 0 &&
        counts.valuationReview === 1 &&
        command.expectedVersion === 9 &&
        JSON.stringify(command.payload) ===
          JSON.stringify(data.reviewed.valuation),
    );
    const receipt = parseManagedValuationAssumptionsReceipt(
      { version: 10, payload: command.payload, replayed: false },
      command,
    );
    admit(receipt);
    stored = {
      ...stored,
      valuation: { version: 10, payload: receipt.payload },
    };
    publish({ valuationSave: 1 });
    return Promise.resolve(receipt);
  };
  const resolve: ManagedApi["resolve"] = (request, signal) => {
    admit(
      !signal.aborted &&
        request.snapshotSha256 === base.researchCoverage.catalogSnapshotSha256,
    );
    if (
      request.listingIds.join("|") ===
      base.marketsCohort.map((row) => row.listingId).join("|")
    ) {
      admit(base.getSnapshot().marketsResolve === counts.session);
      return base.api.resolve(request, signal);
    }
    const listings = base.researchCoverage.listings
      .slice(0, 2)
      .map((row) => row.listing);
    admit(
      counts.session === 1 &&
        request.listingIds.join("|") ===
          listings.map((row) => row.listingId).join("|"),
    );
    if (counts.portfolioSave === 0) {
      admit(counts.portfolioReview === 0 && counts.portfolioLoad === 2);
      publish({ portfolioReview: 1 });
    } else {
      admit(
        counts.valuationSave === 0 &&
          counts.valuationReview === 0 &&
          counts.valuationLoad === 2,
      );
      publish({ valuationReview: 1 });
    }
    const result = parseManagedCatalogResolveResponse(
      {
        snapshotSha256: request.snapshotSha256,
        results: listings.map((listing) => ({
          listingId: listing.listingId,
          listing,
        })),
      },
      request,
    );
    admit(result);
    return Promise.resolve(result);
  };
  const ports: Partial<ManagedApi> = {
    load: watchLoad,
    status,
    loadPortfolio: portfolioLoad,
    loadFollowups: followupsLoad,
    loadValuationAssumptions: valuationLoad,
    savePortfolio: portfolioSave,
    saveValuationAssumptions: valuationSave,
    resolve,
  };
  const api = new Proxy(base.api, {
    get(target, key, receiver) {
      if (typeof key === "string")
        return ports[key as keyof ManagedApi] ?? refuse;
      return Reflect.get(target, key, receiver) as unknown;
    },
  });
  const controls: ResearchDraftSetFixtureControls = {
    data,
    getSnapshot: () => counts,
    saved: () => structuredClone(stored),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    nextSession() {
      admit(
        counts.watchLoad === counts.session + 1 &&
          counts.portfolioLoad === counts.session + 1 &&
          counts.followupsLoad === counts.session + 1 &&
          counts.valuationLoad === counts.session + 1,
      );
      admit(
        (counts.session === 0 &&
          counts.portfolioSave === 0 &&
          counts.valuationSave === 0) ||
          (counts.session === 1 &&
            counts.portfolioSave === 1 &&
            counts.valuationSave === 1),
      );
      if (counts.session === 0)
        stored = {
          watchlist: {
            version: 5,
            payload: structuredClone(data.newer.watchlist),
          },
          portfolio: {
            version: 7,
            payload: structuredClone(data.newer.portfolio),
          },
          followups: {
            version: 11,
            payload: structuredClone(data.newer.followups),
          },
          valuation: {
            version: 9,
            payload: structuredClone(data.newer.valuation),
          },
        };
      publish({ session: counts.session + 1 });
      return {
        ...base.session,
        sessionId: `invented-draft-set-session-${counts.session}`,
      };
    },
  };
  return { ...base, api, financialReview: null, researchDraftSet: controls };
}
