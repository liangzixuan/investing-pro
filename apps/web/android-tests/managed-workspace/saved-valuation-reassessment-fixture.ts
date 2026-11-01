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
import { TrialApiError } from "../../src/clerk-trial/api";
import { createManagedResearchCoverageFixture } from "../../src/clerk-trial/test-managed-research-coverage-fixture";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import { datedClosePacket } from "./portfolio-dated-review-fixture-data";
import {
  reassessmentAnnual,
  reassessmentData,
  reassessmentDigest,
  reassessmentExpectedFollowups,
  reassessmentExpectedValuations,
  reassessmentReason,
} from "./saved-valuation-reassessment-fixture-data";
interface Counts {
  readonly status: number;
  readonly load: number;
  readonly save: number;
  readonly valuationLoad: number;
  readonly valuationSave: number;
  readonly resolve: number;
  readonly eod: number;
  readonly annual: number;
  readonly filings: number;
  readonly requests: readonly string[];
  readonly active: number;
  readonly maxActive: number;
  readonly rejected: number;
  readonly unexpected: Readonly<Record<string, number>>;
}
export interface SavedValuationReassessmentFixture {
  readonly data: ReturnType<typeof reassessmentData>;
  readonly annual: Awaited<ReturnType<typeof reassessmentAnnual>>;
  readonly getSnapshot: () => Counts;
  readonly subscribe: (listener: () => void) => () => void;
  readonly saved: () => {
    watchlist: ManagedWatchlistDto;
    valuations: ManagedValuationAssumptionsDto;
  };
}
/** Three independently committed RAM resources and one exact synthetic source pass. */
export async function createSavedValuationReassessmentFixture(
  base: SharedNativeFixture,
): Promise<ManagedNativeFixture> {
  const data = reassessmentData(),
    annual = await reassessmentAnnual(data),
    now = Date.now();
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
  let counts: Counts = Object.freeze({
    status: 0,
    load: 0,
    save: 0,
    valuationLoad: 0,
    valuationSave: 0,
    resolve: 0,
    eod: 0,
    annual: 0,
    filings: 0,
    requests: [],
    active: 0,
    maxActive: 0,
    rejected: 0,
    unexpected: {},
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
      | "eod"
      | "annual"
      | "filings",
  ) => {
    counts = Object.freeze({ ...counts, [key]: counts[key] + 1 });
    publish();
  };
  function refuse(operation: string): never {
    counts = Object.freeze({
      ...counts,
      rejected: counts.rejected + 1,
      unexpected: {
        ...counts.unexpected,
        [operation]: (counts.unexpected[operation] ?? 0) + 1,
      },
    });
    publish();
    throw new Error(
      "Unexpected invented saved-valuation-reassessment operation: " +
        operation,
    );
  }
  function admit(value: unknown, operation: string): asserts value {
    if (!value) refuse(operation);
  }
  function source(
    name: "eod" | "annual" | "filings",
    input: { listingId: string; catalogSnapshotSha256: string },
    signal: AbortSignal,
  ) {
    const order = ["eod", "annual", "filings"];
    admit(
      !signal.aborted &&
        counts.active === 0 &&
        counts.load === 1 &&
        counts.valuationLoad === 1 &&
        counts.save === 0 &&
        counts.valuationSave === 0 &&
        input.listingId === data.identities[0]!.listingId &&
        input.catalogSnapshotSha256 === reassessmentDigest &&
        name === order[counts.requests.length],
      "exact sequential source request",
    );
    counts = Object.freeze({
      ...counts,
      requests: [...counts.requests, name],
      active: 1,
      maxActive: 1,
    });
    record(name);
  }
  function complete() {
    counts = Object.freeze({ ...counts, active: 0 });
    publish();
  }
  const refused = Object.fromEntries(
    Object.entries(base.api)
      .filter(([, value]) => typeof value === "function")
      .map(([key]) => [key, () => Promise.resolve().then(() => refuse(key))]),
  );
  // Keep the invented transport asynchronous like the real Managed API.
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
          counts.load < followups.getSnapshot().session &&
          counts.load < 2,
        "Watchlist Load",
      );
      if (counts.load === 1)
        admit(
          counts.save === 1 &&
            counts.valuationSave === 1 &&
            followups.getSnapshot().commits === 1,
          "all separate saves before fresh Load",
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
        admit(counts.valuationSave === 1, "fresh Valuation Load");
      record("valuationLoad");
      return structuredClone(valuations);
    },
    resolve: async (input, signal) => {
      await Promise.resolve();
      admit(
        !signal.aborted &&
          input.snapshotSha256 === reassessmentDigest &&
          input.listingIds.length > 0 &&
          input.listingIds.every((id) =>
            data.identities.some((x) => x.listingId === id),
          ) &&
          counts.resolve < 6,
        "exact listing resolve",
      );
      record("resolve");
      const result = parseManagedCatalogResolveResponse(
        {
          snapshotSha256: input.snapshotSha256,
          results: input.listingIds.map((listingId) => ({
            listingId,
            listing: data.identities.find((x) => x.listingId === listingId)!,
          })),
        },
        input,
      );
      admit(result, "resolved listing response");
      return result;
    },
    eodHistory: async (input, signal) => {
      await Promise.resolve();
      source("eod", input, signal);
      try {
        admit(input.range === "1m", "Price range");
        return datedClosePacket(input, data.identities[0]!, now);
      } finally {
        complete();
      }
    },
    annualReport: async (input, signal) => {
      await Promise.resolve();
      source("annual", input, signal);
      try {
        admit(
          input.schemaVersion === "6.0.0" && input.symbol === "GOOGL",
          "Annual identity",
        );
        return structuredClone(annual);
      } finally {
        complete();
      }
    },
    recentFilings: async (input, signal) => {
      await Promise.resolve();
      source("filings", input, signal);
      try {
        throw new TrialApiError("unavailable");
      } finally {
        complete();
      }
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
          command.expectedVersion === 5 &&
          counts.valuationLoad === 1 &&
          counts.valuationSave === 0 &&
          counts.requests.join("|") === "eod|annual|filings",
        "separate Valuation Save",
      );
      admit(
        JSON.stringify(command.payload.entries) ===
          JSON.stringify(reassessmentExpectedValuations(data)),
        "whole exact valuation payload",
      );
      const receipt = parseManagedValuationAssumptionsReceipt(
        { version: 6, payload: command.payload, replayed: false },
        command,
      );
      admit(receipt, "valuation receipt");
      valuations = { version: 6, payload: structuredClone(receipt.payload) };
      record("valuationSave");
      return receipt;
    },
    save: async (input, signal) => {
      await Promise.resolve();
      const command = parseManagedWatchlistCommand(input);
      const expected = {
        ...data.watchlist,
        memberships: data.watchlist.memberships.map((m, i) =>
          i === 0 ? { ...m, note: reassessmentReason } : m,
        ),
      };
      admit(
        !signal.aborted &&
          command &&
          command.expectedVersion === 7 &&
          counts.load === 1 &&
          counts.save === 0 &&
          counts.valuationSave === 1,
        "separate Watchlist Save",
      );
      admit(
        encodeMainWatchlistPayload(command.payload) ===
          encodeMainWatchlistPayload(expected),
        "whole exact Watchlist payload",
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
          counts.valuationSave === 1 &&
          followups.getSnapshot().save === 0,
        "separate Follow-ups Save",
      );
      admit(
        encodeResearchFollowupsPayload(command.payload) ===
          encodeResearchFollowupsPayload(
            reassessmentExpectedFollowups(data, created.id),
          ),
        "whole exact Follow-ups payload",
      );
      return followups.api.saveFollowups(command, signal);
    },
  };
  const researchCoverage = createManagedResearchCoverageFixture(
    data.identities.map((listing) => ({ listing, cik: "0000000001" })),
    reassessmentDigest,
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
    getSnapshot: () => state,
    subscribe,
    savedValuationReassessment: {
      data,
      annual,
      getSnapshot: () => counts,
      subscribe,
      saved: () => ({
        watchlist: structuredClone(watchlist),
        valuations: structuredClone(valuations),
      }),
    },
  };
}
