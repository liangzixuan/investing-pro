import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
  parseManagedWatchlistCommand,
  parseManagedValuationAssumptionsCommand,
  parseManagedValuationAssumptionsReceipt,
  parseManagedResearchFollowupsCommand,
  parseManagedCatalogResolveResponse,
  type ManagedWatchlistDto,
  type ManagedValuationAssumptionsDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { createManagedResearchCoverageFixture } from "../../src/clerk-trial/test-managed-research-coverage-fixture";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import { screenComparisonPins } from "./screen-comparison-fixture";
import {
  decisionData,
  decisionPackets,
  decisionExpectedWatchlist,
  decisionExpectedValuations,
  decisionExpectedFollowups,
} from "./two-company-research-review-fixture-data";
interface Counts {
  readonly status: number;
  readonly load: number;
  readonly save: number;
  readonly valuationLoad: number;
  readonly valuationSave: number;
  readonly resolve: number;
  readonly annual: number;
  readonly eod: number;
  readonly filings: number;
  readonly rejected: number;
  readonly unexpected: Readonly<Record<string, number>>;
  readonly requests: readonly string[];
}
export interface TwoCompanyResearchReviewFixture {
  readonly data: ReturnType<typeof decisionData>;
  readonly packets: Awaited<ReturnType<typeof decisionPackets>>;
  readonly getSnapshot: () => Counts;
  readonly subscribe: (listener: () => void) => () => void;
  readonly saved: () => {
    watchlist: ManagedWatchlistDto;
    valuations: ManagedValuationAssumptionsDto;
  };
}
/** Disconnected RAM resources; the real screen retains its 20-second source pacing. */
export async function createTwoCompanyResearchReviewFixture(
  base: SharedNativeFixture,
): Promise<ManagedNativeFixture> {
  const data = decisionData(),
    packets = await decisionPackets();
  const followups = createResearchFollowupsFixture({
    version: 3,
    payload: data.followups,
  });
  let watchlist: ManagedWatchlistDto = {
    version: 7,
    payload: structuredClone(data.watchlist),
  };
  let valuations: ManagedValuationAssumptionsDto = {
    version: 5,
    payload: { schemaVersion: 1, entries: structuredClone(data.entries) },
  };
  let counts: Counts = {
    status: 0,
    load: 0,
    save: 0,
    valuationLoad: 0,
    valuationSave: 0,
    resolve: 0,
    annual: 0,
    eod: 0,
    filings: 0,
    rejected: 0,
    unexpected: {},
    requests: [],
  };
  let state = base.getSnapshot(),
    firstAnnualAt: number | null = null;
  const listeners = new Set<() => void>();
  const publish = () => {
    state = { ...base.getSnapshot(), ...counts };
    for (const l of listeners) l();
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  base.subscribe(publish);
  followups.subscribe(publish);
  const record = (
    key:
      | "status"
      | "load"
      | "save"
      | "valuationLoad"
      | "valuationSave"
      | "resolve"
      | "annual",
  ) => {
    counts = { ...counts, [key]: counts[key] + 1 };
    publish();
  };
  function refuse(operation: string): never {
    counts = {
      ...counts,
      rejected: counts.rejected + 1,
      unexpected: {
        ...counts.unexpected,
        [operation]: (counts.unexpected[operation] ?? 0) + 1,
      },
    };
    publish();
    throw new Error(
      "Unexpected invented two-company research operation: " + operation,
    );
  }
  function admit(value: unknown, operation: string): asserts value {
    if (!value) refuse(operation);
  }
  const refused = Object.fromEntries(
    Object.entries(base.api)
      .filter(([, value]) => typeof value === "function")
      .map(([key]) => [key, () => Promise.resolve().then(() => refuse(key))]),
  );
  const api: ManagedApi = {
    ...base.api,
    ...refused,
    status: async (signal) => {
      admit(
        !signal.aborted &&
          counts.status < followups.getSnapshot().session &&
          counts.status < 2,
        "status",
      );
      record("status");
      return base.api.status(signal);
    },
    load: async (signal) => {
      await Promise.resolve();
      admit(
        !signal.aborted &&
          counts.load < 2 &&
          counts.load < followups.getSnapshot().session,
        "Watchlist Load",
      );
      if (counts.load === 1)
        admit(
          counts.save === 1 &&
            counts.valuationSave === 2 &&
            followups.getSnapshot().commits === 1,
          "all independent Saves before fresh Load",
        );
      record("load");
      return structuredClone(watchlist);
    },
    loadValuationAssumptions: async (signal) => {
      await Promise.resolve();
      admit(
        !signal.aborted &&
          counts.valuationLoad < 2 &&
          counts.valuationLoad < followups.getSnapshot().session,
        "Valuation Load",
      );
      if (counts.valuationLoad === 1)
        admit(counts.valuationSave === 2, "fresh Valuation Load");
      record("valuationLoad");
      return structuredClone(valuations);
    },
    resolve: async (input, signal) => {
      await Promise.resolve();
      admit(
        !signal.aborted &&
          input.snapshotSha256 === data.watchlist.snapshotSha256,
        "catalog snapshot",
      );
      if (
        input.listingIds.join("|") ===
        base.marketsCohort.map((x) => x.listingId).join("|")
      ) {
        admit(
          base.getSnapshot().marketsResolve < followups.getSnapshot().session &&
            base.getSnapshot().marketsResolve < 2,
          "startup cohort resolve",
        );
        return base.api.resolve(input, signal);
      }
      admit(
        input.listingIds.length > 0 &&
          input.listingIds.every((id) =>
            data.identities.some((x) => x.listingId === id),
          ) &&
          counts.resolve < 5,
        "exact decision resolve",
      );
      const response = parseManagedCatalogResolveResponse(
        {
          snapshotSha256: input.snapshotSha256,
          results: input.listingIds.map((listingId) => ({
            listingId,
            listing: data.identities.find((x) => x.listingId === listingId)!,
          })),
        },
        input,
      );
      admit(response, "resolved response");
      record("resolve");
      return response;
    },
    annualReport: async (input, signal) => {
      await Promise.resolve();
      const packet = packets[counts.annual],
        now = performance.now();
      admit(
        !signal.aborted &&
          packet &&
          counts.load === 1 &&
          counts.save === 0 &&
          input.schemaVersion === "6.0.0" &&
          input.catalogSnapshotSha256 === packet.catalogSnapshotSha256 &&
          input.listingId === packet.security.listingId &&
          input.symbol === packet.security.symbol &&
          (firstAnnualAt === null || now - firstAnnualAt >= 20000),
        "exact paced Annual read",
      );
      if (firstAnnualAt === null) firstAnnualAt = now;
      counts = { ...counts, requests: [...counts.requests, input.listingId] };
      record("annual");
      return structuredClone(packet);
    },
    loadFollowups: (signal) => {
      const s = followups.getSnapshot();
      admit(
        !signal.aborted && s.load < 2 && s.load < s.session,
        "Follow-ups Load",
      );
      if (s.load === 1) admit(s.commits === 1, "fresh Follow-ups Load");
      return followups.api.loadFollowups(signal);
    },
    saveValuationAssumptions: async (input, signal) => {
      await Promise.resolve();
      const command = parseManagedValuationAssumptionsCommand(input);
      admit(
        !signal.aborted &&
          command &&
          command.expectedVersion === 5 + counts.valuationSave &&
          counts.valuationLoad === 1 &&
          counts.valuationSave < 2 &&
          counts.annual === 2,
        "separate Valuation Save",
      );
      admit(
        JSON.stringify(command.payload.entries) ===
          JSON.stringify(
            decisionExpectedValuations(data, counts.valuationSave + 1),
          ),
        "complete valuations including unrelated third entry",
      );
      const receipt = parseManagedValuationAssumptionsReceipt(
        {
          version: command.expectedVersion + 1,
          payload: command.payload,
          replayed: false,
        },
        command,
      );
      admit(receipt, "valuation receipt");
      valuations = {
        version: receipt.version,
        payload: structuredClone(receipt.payload),
      };
      record("valuationSave");
      return receipt;
    },
    save: async (input, signal) => {
      await Promise.resolve();
      const command = parseManagedWatchlistCommand(input);
      admit(
        !signal.aborted &&
          command &&
          command.expectedVersion === 7 &&
          counts.load === 1 &&
          counts.save === 0 &&
          counts.valuationSave === 2,
        "separate Watchlist Save",
      );
      admit(
        encodeMainWatchlistPayload(command.payload) ===
          encodeMainWatchlistPayload(decisionExpectedWatchlist(data)),
        "complete Watchlist including unchanged alternative",
      );
      watchlist = { version: 8, payload: structuredClone(command.payload) };
      record("save");
      return { ...structuredClone(watchlist), replayed: false };
    },
    saveFollowups: (input, signal) => {
      const command = parseManagedResearchFollowupsCommand(input),
        created = command?.payload.entries[1];
      admit(
        !signal.aborted &&
          command &&
          created &&
          command.expectedVersion === 3 &&
          counts.save === 1 &&
          counts.valuationSave === 2 &&
          followups.getSnapshot().save === 0,
        "separate Follow-ups Save",
      );
      admit(
        encodeResearchFollowupsPayload(command.payload) ===
          encodeResearchFollowupsPayload(
            decisionExpectedFollowups(data, created.id),
          ),
        "complete Follow-ups including unchanged original",
      );
      return followups.api.saveFollowups(command, signal);
    },
  };
  const researchCoverage = createManagedResearchCoverageFixture(
    data.identities.map((listing, i) => ({
      listing,
      cik: i ? "0000000002" : "0000000001",
    })),
    data.watchlist.snapshotSha256,
  );
  publish();
  return {
    ...base,
    api,
    session: followups.nextSession(),
    followups,
    researchCoverage,
    priceCoverage: data.identities,
    financialReview: null,
    screenComparison: {
      listingIds: data.identities.map((x) => x.listingId),
      pins: screenComparisonPins,
    },
    getSnapshot: () => state,
    subscribe,
    twoCompanyResearchReview: {
      data,
      packets,
      getSnapshot: () => counts,
      subscribe,
      saved: () => ({
        watchlist: structuredClone(watchlist),
        valuations: structuredClone(valuations),
      }),
    },
  };
}
