import {
  parseManagedWatchlistCommand,
  parseManagedValuationAssumptionsCommand,
  type ManagedWatchlistDto,
  type ManagedValuationAssumptionsDto,
} from "@research-cockpit/contracts";
import {
  ManagedEodHistoryError,
  type ManagedApi,
} from "../../src/clerk-trial/managed-api";
import { createManagedResearchCoverageFixture } from "../../src/clerk-trial/test-managed-research-coverage-fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import {
  reassessmentData,
  reassessmentDigest,
} from "./saved-valuation-reassessment-fixture-data";
import { reviewFilingsIdentities } from "./review-filings-evidence-fixture-data";
import { datedClosePacket } from "./portfolio-dated-review-fixture-data";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";

export interface WatchlistSavedScenarioFixture {
  readonly getSnapshot: () => Readonly<Record<string, number>>;
  readonly subscribe: (listener: () => void) => () => void;
  saved(): {
    watchlist: ManagedWatchlistDto;
    valuations: ManagedValuationAssumptionsDto;
  };
}
/** Invented local protocol; every source request is counted and bounded. */
export function createWatchlistSavedScenarioFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const data = reassessmentData(),
    now = Date.now();
  const identities = [...data.identities, reviewFilingsIdentities()[2]!];
  const followups = createResearchFollowupsFixture({
    version: 3,
    payload: data.followups,
  });
  let watchlist: ManagedWatchlistDto = {
    version: 7,
    payload: {
      ...data.watchlist,
      memberships: identities.map((listing) => ({
        ...listing,
        note: `Original ${listing.symbol} thesis`,
      })),
    },
  };
  let valuations: ManagedValuationAssumptionsDto = {
    version: 5,
    payload: {
      schemaVersion: 1,
      entries: data.entries.map((entry, i) => ({
        ...entry,
        cik: "0000000001",
        exit: {
          ...entry.exit,
          inputs: {
            ...entry.exit.inputs,
            baseRevenue:
              i === 0 ? entry.exit.inputs.baseRevenue : "unfinished 1..",
          },
        },
      })),
    },
  };
  let counts: Readonly<Record<string, number>> = Object.freeze({
    status: 0,
    load: 0,
    save: 0,
    valuationLoad: 0,
    valuationSave: 0,
    eod: 0,
    resolve: 0,
    unexpected: 0,
  });
  let state = base.getSnapshot();
  const listeners = new Set<() => void>();
  const publish = () => {
    state = { ...base.getSnapshot(), ...counts };
    for (const l of listeners) l();
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  const record = (key: string) => {
    counts = Object.freeze({ ...counts, [key]: (counts[key] ?? 0) + 1 });
    publish();
  };
  const refuse = (name: string): never => {
    record("unexpected");
    throw new Error("Unexpected invented saved-scenario operation: " + name);
  };
  function admit(ok: unknown, name: string): asserts ok {
    if (!ok) refuse(name);
  }
  const refused = Object.fromEntries(
    Object.keys(base.api).map((key) => [
      key,
      () => Promise.resolve().then(() => refuse(key)),
    ]),
  );
  const api: ManagedApi = {
    ...base.api,
    ...refused,
    status: (signal) => {
      record("status");
      return base.api.status(signal);
    },
    load: (signal) => {
      admit(!signal.aborted, "load");
      record("load");
      return Promise.resolve(structuredClone(watchlist));
    },
    loadValuationAssumptions: (signal) => {
      admit(!signal.aborted, "valuation load");
      record("valuationLoad");
      return Promise.resolve(structuredClone(valuations));
    },
    resolve: (request, signal) => {
      admit(
        !signal.aborted &&
          request.snapshotSha256 === reassessmentDigest &&
          request.listingIds.every((id) =>
            identities.some((l) => l.listingId === id),
          ),
        "resolve identity",
      );
      record("resolve");
      return Promise.resolve({
        snapshotSha256: reassessmentDigest,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: identities.find((l) => l.listingId === listingId)!,
        })),
      });
    },
    eodHistory: (request, signal) => {
      const index = counts.eod ?? 0;
      admit(
        !signal.aborted &&
          index < 2 &&
          request.catalogSnapshotSha256 === reassessmentDigest &&
          request.range === "1m" &&
          request.listingId === identities[index]!.listingId,
        "exact bounded Price request",
      );
      record("eod");
      return index === 0
        ? Promise.resolve(datedClosePacket(request, identities[0]!, now))
        : Promise.reject(new ManagedEodHistoryError("request_timeout"));
    },
    loadFollowups: followups.api.loadFollowups,
    saveFollowups: followups.api.saveFollowups,
    save: (input, signal) => {
      const command = parseManagedWatchlistCommand(input);
      admit(
        !signal.aborted &&
          command &&
          command.expectedVersion === watchlist.version,
        "watchlist save",
      );
      watchlist = {
        version: watchlist.version + 1,
        payload: structuredClone(command.payload),
      };
      record("save");
      return Promise.resolve({
        ...structuredClone(watchlist),
        replayed: false,
      });
    },
    saveValuationAssumptions: (input, signal) => {
      const command = parseManagedValuationAssumptionsCommand(input);
      admit(
        !signal.aborted &&
          command &&
          command.expectedVersion === valuations.version,
        "valuation save",
      );
      valuations = {
        version: valuations.version + 1,
        payload: structuredClone(command.payload),
      };
      record("valuationSave");
      return Promise.resolve({
        ...structuredClone(valuations),
        replayed: false,
      });
    },
  };
  base.subscribe(publish);
  followups.subscribe(publish);
  return {
    ...base,
    api,
    session: followups.nextSession(),
    followups,
    financialReview: null,
    researchCoverage: createManagedResearchCoverageFixture(
      identities.map((listing) => ({ listing, cik: "0000000001" })),
      reassessmentDigest,
    ),
    priceCoverage: identities.slice(0, 2),
    getSnapshot: () => state,
    subscribe,
    watchlistSavedScenario: {
      getSnapshot: () => counts,
      subscribe,
      saved: () => structuredClone({ watchlist, valuations }),
    },
  };
}
