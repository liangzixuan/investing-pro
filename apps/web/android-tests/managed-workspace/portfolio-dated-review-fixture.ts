import {
  datedCloseDate,
  datedClosePacket,
  datedReviewExpected,
} from "./portfolio-dated-review-fixture-data";
import {
  encodeResearchFollowupsPayload,
  parseManagedCatalogResolveRequest,
  parseManagedCatalogResolveResponse,
  parseManagedResearchFollowupsCommand,
  parseManagedSecFilingsRequest,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { createManagedResearchCoverageFixture } from "../../src/clerk-trial/test-managed-research-coverage-fixture";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import {
  reviewFilingsIdentities,
  reviewFilingsIds,
  reviewFilingsLedger,
  reviewFilingsOriginal,
  reviewFilingsPackets,
} from "./review-filings-evidence-fixture-data";
interface Counts {
  readonly eod: number;
  readonly activeEod: number;
  readonly maxActiveEod: number;
  readonly eodRequests: readonly string[];
  readonly status: number;
  readonly portfolioLoad: number;
  readonly resolve: number;
  readonly filings: number;
  readonly filingsRequests: readonly string[];
  readonly rejected: number;
  readonly unexpected: Readonly<Record<string, number>>;
  readonly resolveRequests: readonly (readonly string[])[];
}
export interface PortfolioDatedReviewFixture {
  readonly day: string;
  readonly closeDate: string;
  readonly ledger: ReturnType<typeof reviewFilingsLedger>;
  readonly original: ReturnType<typeof reviewFilingsOriginal>;
  readonly packets: ReturnType<typeof reviewFilingsPackets>;
  readonly getSnapshot: () => Counts;
  readonly subscribe: (listener: () => void) => () => void;
}
/** Fixed invented RAM resources. No provider operation or personal Save other than one exact Follow-ups command is admitted. */
export function createPortfolioDatedReviewFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const now = Date.now(),
    day = new Date(now).toISOString().slice(0, 10),
    identities = reviewFilingsIdentities(),
    digest = base.researchCoverage.catalogSnapshotSha256,
    ledger = reviewFilingsLedger(digest),
    original = reviewFilingsOriginal(digest, day),
    packets = reviewFilingsPackets(digest),
    followups = createResearchFollowupsFixture({
      version: 7,
      payload: original,
    });
  const coverage = createManagedResearchCoverageFixture(
    identities.map((listing, index) => ({
      listing,
      cik: String(index < 2 ? 2 : index + 2).padStart(10, "0"),
    })),
    digest,
  );
  const researchCoverage = Object.freeze({
    ...coverage,
    filingsIssuers: Object.freeze(["0000000002"]),
  });
  let counts: Counts = Object.freeze({
      eod: 0,
      activeEod: 0,
      maxActiveEod: 0,
      eodRequests: Object.freeze([]),
      status: 0,
      portfolioLoad: 0,
      resolve: 0,
      filings: 0,
      filingsRequests: Object.freeze([]),
      rejected: 0,
      unexpected: Object.freeze({}),
      resolveRequests: Object.freeze([]),
    }),
    state = base.getSnapshot();
  const listeners = new Set<() => void>();
  const publish = () => {
    state = {
      ...base.getSnapshot(),
      eod: counts.eod,
      status: counts.status,
      load: counts.unexpected.load ?? 0,
      save: counts.unexpected.save ?? 0,
      resolve: counts.resolve,
      filings: counts.filings,
      marketsResolve: base.getSnapshot().marketsResolve,
    };
    for (const l of listeners) l();
  };
  base.subscribe(publish);
  followups.subscribe(publish);
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
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
      "Unexpected invented dated-portfolio-review operation: " + operation,
    );
  }
  function admit(value: unknown, operation: string): asserts value {
    if (!value) refuse(operation);
  }
  const refused = Object.fromEntries(
    Object.entries(base.api)
      .filter(([, v]) => typeof v === "function")
      .map(([key]) => [key, () => Promise.resolve().then(() => refuse(key))]),
  );
  const priceCoverage = identities.filter((x) =>
    ["GOOG", "GOOGL", "AAPL", "MSFT"].includes(x.symbol),
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
    loadPortfolio: (signal) =>
      Promise.resolve().then(() => {
        admit(
          !signal.aborted &&
            counts.portfolioLoad < 2 &&
            counts.portfolioLoad < followups.getSnapshot().session,
          "loadPortfolio",
        );
        if (counts.portfolioLoad === 1)
          admit(
            followups.getSnapshot().commits === 1,
            "Portfolio fresh session after Save",
          );
        counts = Object.freeze({
          ...counts,
          portfolioLoad: counts.portfolioLoad + 1,
        });
        publish();
        return structuredClone(ledger);
      }),
    loadFollowups: (signal) =>
      Promise.resolve().then(() => {
        const c = followups.getSnapshot();
        admit(
          !signal.aborted && c.load < 2 && c.load < c.session,
          "loadFollowups",
        );
        if (c.load === 1)
          admit(c.commits === 1, "Follow-ups fresh session after Save");
        return followups.api.loadFollowups(signal);
      }),
    resolve: (input, signal) =>
      Promise.resolve().then(() => {
        const request = parseManagedCatalogResolveRequest(input);
        admit(
          request && !signal.aborted && request.snapshotSha256 === digest,
          "resolve request",
        );
        const ids = request.listingIds;
        const held = identities
            .filter((x) => x.listingId !== reviewFilingsIds.outside)
            .map((x) => x.listingId),
          portfolioRequest = ids.join("|") === held.join("|"),
          researchRequest =
            ids.length === 1 &&
            [reviewFilingsIds.goog, reviewFilingsIds.googl].some(
              (id) => id === ids[0],
            );
        if (portfolioRequest)
          admit(
            counts.resolveRequests.filter((x) => x.length === held.length)
              .length < counts.portfolioLoad,
            "one Portfolio identity review per Load",
          );
        else
          admit(
            researchRequest &&
              counts.portfolioLoad === 1 &&
              followups.getSnapshot().load === 1 &&
              !counts.resolveRequests.some(
                (x) => x.length === 1 && x[0] === ids[0],
              ) &&
              counts.filingsRequests.includes(ids[0]!),
            "one exact loaded check Research resolution",
          );
        const response = parseManagedCatalogResolveResponse(
          {
            snapshotSha256: digest,
            results: ids.map((listingId) => ({
              listingId,
              listing:
                identities.find((row) => row.listingId === listingId) ?? null,
            })),
          },
          request,
        );
        admit(response, "resolve response");
        counts = Object.freeze({
          ...counts,
          resolve: counts.resolve + 1,
          resolveRequests: Object.freeze([
            ...counts.resolveRequests,
            Object.freeze([...ids]),
          ]),
        });
        publish();
        return response;
      }),
    eodHistory: async (request, signal) => {
      const security = priceCoverage.find(
        (x) => x.listingId === request.listingId,
      );
      admit(
        security &&
          !signal.aborted &&
          counts.activeEod === 0 &&
          counts.eod < 4 &&
          !counts.eodRequests.includes(request.listingId) &&
          request.range === "1m" &&
          request.catalogSnapshotSha256 === digest &&
          counts.portfolioLoad === 1 &&
          followups.getSnapshot().load === 1 &&
          followups.getSnapshot().session === 1,
        "one serialized exact held close request",
      );
      counts = Object.freeze({
        ...counts,
        eod: counts.eod + 1,
        activeEod: 1,
        maxActiveEod: 1,
        eodRequests: Object.freeze([...counts.eodRequests, request.listingId]),
      });
      publish();
      await Promise.resolve();
      admit(!signal.aborted, "current close response");
      const packet = datedClosePacket(request, security, now);
      counts = Object.freeze({ ...counts, activeEod: 0 });
      publish();
      return packet;
    },
    recentFilings: (input, signal) =>
      Promise.resolve().then(() => {
        const request = parseManagedSecFilingsRequest(input),
          packet = packets.find(
            (p) => p.security.listingId === request?.listingId,
          );
        admit(
          request &&
            packet &&
            counts.eod === 4 &&
            counts.filings < 2 &&
            !counts.filingsRequests.includes(packet.security.listingId) &&
            !signal.aborted &&
            followups.getSnapshot().session === 1 &&
            counts.portfolioLoad === 1 &&
            followups.getSnapshot().load === 1 &&
            followups.getSnapshot().save === 0 &&
            request.catalogSnapshotSha256 === digest &&
            request.listingId === packet.security.listingId &&
            request.symbol === packet.security.symbol,
          "exact current check filing request",
        );
        counts = Object.freeze({
          ...counts,
          filings: counts.filings + 1,
          filingsRequests: Object.freeze([
            ...counts.filingsRequests,
            request.listingId,
          ]),
        });
        publish();
        return structuredClone(packet);
      }),
    saveFollowups: (input, signal) =>
      Promise.resolve().then(() => {
        const command = parseManagedResearchFollowupsCommand(input),
          c = followups.getSnapshot();
        admit(
          command &&
            !signal.aborted &&
            command.expectedVersion === 7 &&
            c.save === 0 &&
            counts.portfolioLoad === 1 &&
            counts.rejected === 0 &&
            counts.resolveRequests.filter((x) => x.length === 1).length === 2 &&
            counts.filings === 2 &&
            counts.eod === 4 &&
            counts.activeEod === 0,
          "exact Follow-ups Save ownership",
        );
        admit(
          encodeResearchFollowupsPayload(command.payload) ===
            encodeResearchFollowupsPayload(datedReviewExpected(original, day)),
          "complete Follow-ups payload",
        );
        return followups.api.saveFollowups(command, signal);
      }),
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
    portfolioDatedReview: {
      day,
      closeDate: datedCloseDate(now),
      ledger,
      original,
      packets,
      getSnapshot: () => counts,
      subscribe,
    },
  };
}
