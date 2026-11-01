import {
  encodeResearchFollowupsPayload,
  parseManagedResearchFollowupsCommand,
  parseManagedSecFilingsRequest,
} from "@research-cockpit/contracts";
import {
  ManagedEodHistoryError,
  type ManagedApi,
} from "../../src/clerk-trial/managed-api";
import { createManagedResearchCoverageFixture } from "../../src/clerk-trial/test-managed-research-coverage-fixture";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import { datedClosePacket } from "./portfolio-dated-review-fixture-data";
import { reviewFilingsPackets } from "./review-filings-evidence-fixture-data";
import {
  dailyReviewData,
  dailyReviewExpected,
} from "./watchlist-daily-review-fixture-data";
interface Counts {
  readonly status: number;
  readonly load: number;
  readonly eod: number;
  readonly filings: number;
  readonly active: number;
  readonly maxActive: number;
  readonly requests: readonly string[];
  readonly rejected: number;
  readonly unexpected: Readonly<Record<string, number>>;
}
export interface WatchlistDailyReviewFixture {
  readonly day: string;
  readonly data: ReturnType<typeof dailyReviewData>;
  readonly packets: ReturnType<typeof reviewFilingsPackets>;
  readonly getSnapshot: () => Counts;
  readonly subscribe: (listener: () => void) => () => void;
}
/** Exact invented RAM protocol; no provider, account, file or deployment access. */
export function createWatchlistDailyReviewFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const now = Date.now(),
    day = new Date(now).toISOString().slice(0, 10),
    digest = base.researchCoverage.catalogSnapshotSha256;
  const data = dailyReviewData(digest, day),
    packets = reviewFilingsPackets(digest),
    followups = createResearchFollowupsFixture({
      version: 7,
      payload: data.original,
    });
  const researchCoverage = Object.freeze({
    ...createManagedResearchCoverageFixture(
      data.identities.map((listing, index) => ({
        listing,
        cik: String(index < 2 ? 2 : index + 2).padStart(10, "0"),
      })),
      digest,
    ),
    filingsIssuers: Object.freeze(["0000000002"]),
  });
  const priceCoverage = data.identities.slice(0, 2),
    expectedRequests = [
      "GOOGL:price",
      "GOOGL:filings",
      "GOOG:price",
      "GOOG:price",
      "GOOG:filings",
    ];
  let counts: Counts = Object.freeze({
      status: 0,
      load: 0,
      eod: 0,
      filings: 0,
      active: 0,
      maxActive: 0,
      requests: [],
      rejected: 0,
      unexpected: {},
    }),
    state = base.getSnapshot();
  const listeners = new Set<() => void>();
  const publish = () => {
    state = {
      ...base.getSnapshot(),
      status: counts.status,
      load: counts.load,
      eod: counts.eod,
      filings: counts.filings,
      save: counts.unexpected.save ?? 0,
      resolve: counts.unexpected.resolve ?? 0,
    };
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
      "Unexpected invented Watchlist daily-review operation: " + operation,
    );
  }
  function admit(value: unknown, operation: string): asserts value {
    if (!value) refuse(operation);
  }
  function startRequest(key: string, signal: AbortSignal) {
    admit(
      !signal.aborted &&
        counts.active === 0 &&
        counts.load === 1 &&
        followups.getSnapshot().session === 1 &&
        followups.getSnapshot().save === 0 &&
        key === expectedRequests[counts.requests.length],
      "exact sequential source request",
    );
    counts = Object.freeze({
      ...counts,
      active: 1,
      maxActive: Math.max(counts.maxActive, 1),
      requests: Object.freeze([...counts.requests, key]),
    });
    publish();
  }
  const refused = Object.fromEntries(
    Object.entries(base.api)
      .filter(([, v]) => typeof v === "function")
      .map(([key]) => [key, () => Promise.resolve().then(() => refuse(key))]),
  );
  const api: ManagedApi = {
    ...base.api,
    ...refused,
    status: async (signal) => {
      admit(
        !signal.aborted &&
          counts.status < 2 &&
          counts.status < followups.getSnapshot().session,
        "status",
      );
      counts = Object.freeze({ ...counts, status: counts.status + 1 });
      const result = await base.api.status(signal);
      publish();
      return result;
    },
    load: (signal) => {
      admit(
        !signal.aborted &&
          counts.load < 2 &&
          counts.load < followups.getSnapshot().session,
        "Watchlist Load",
      );
      if (counts.load === 1)
        admit(
          followups.getSnapshot().commits === 1,
          "fresh Watchlist Load after Save",
        );
      counts = Object.freeze({ ...counts, load: counts.load + 1 });
      publish();
      return Promise.resolve({
        version: 3,
        payload: structuredClone(data.watchlist),
      });
    },
    loadFollowups: async (signal) => {
      const c = followups.getSnapshot();
      admit(
        !signal.aborted &&
          c.load < 2 &&
          c.load < c.session &&
          counts.eod === 3 &&
          counts.filings === 2,
        "separate Follow-ups Load",
      );
      if (c.load === 1)
        admit(c.commits === 1, "fresh Follow-ups Load after Save");
      return followups.api.loadFollowups(signal);
    },
    eodHistory: async (request, signal) => {
      const security = priceCoverage.find(
        (row) => row.listingId === request.listingId,
      );
      admit(
        security &&
          request.catalogSnapshotSha256 === digest &&
          request.range === "1m",
        "exact Price identity/window",
      );
      startRequest(security.symbol + ":price", signal);
      counts = Object.freeze({ ...counts, eod: counts.eod + 1 });
      publish();
      try {
        await Promise.resolve();
        admit(!signal.aborted, "current Price response");
        if (counts.eod === 2)
          throw new ManagedEodHistoryError("request_timeout");
        return datedClosePacket(
          request,
          security,
          now + (security.symbol === "GOOGL" ? 2000 : 0),
        );
      } finally {
        counts = Object.freeze({ ...counts, active: 0 });
        publish();
      }
    },
    recentFilings: async (input, signal) => {
      const request = parseManagedSecFilingsRequest(input),
        packet = packets.find(
          (row) => row.security.listingId === request?.listingId,
        );
      admit(
        request &&
          packet &&
          request.catalogSnapshotSha256 === digest &&
          request.symbol === packet.security.symbol,
        "exact Filings identity",
      );
      startRequest(request.symbol + ":filings", signal);
      counts = Object.freeze({ ...counts, filings: counts.filings + 1 });
      publish();
      try {
        await Promise.resolve();
        admit(!signal.aborted, "current Filings response");
        return structuredClone(packet);
      } finally {
        counts = Object.freeze({ ...counts, active: 0 });
        publish();
      }
    },
    saveFollowups: async (input, signal) => {
      const command = parseManagedResearchFollowupsCommand(input),
        c = followups.getSnapshot();
      admit(
        command &&
          !signal.aborted &&
          command.expectedVersion === 7 &&
          c.save === 0 &&
          c.load === 1 &&
          c.session === 1 &&
          counts.load === 1 &&
          counts.eod === 3 &&
          counts.filings === 2 &&
          counts.active === 0 &&
          counts.rejected === 0,
        "exact separate Follow-ups Save",
      );
      const created = command.payload.entries.at(-1);
      admit(
        created &&
          !data.original.entries.some((entry) => entry.id === created.id),
        "new question identity",
      );
      admit(
        encodeResearchFollowupsPayload(command.payload) ===
          encodeResearchFollowupsPayload(
            dailyReviewExpected(data.original, day, created.id),
          ),
        "complete Follow-ups payload",
      );
      return followups.api.saveFollowups(command, signal);
    },
  };
  publish();
  return {
    ...base,
    api,
    session: followups.nextSession(),
    followups,
    researchCoverage,
    priceCoverage,
    financialReview: null,
    getSnapshot: () => state,
    subscribe,
    watchlistDailyReview: {
      day,
      data,
      packets,
      getSnapshot: () => counts,
      subscribe,
    },
  };
}
