import {
  encodeResearchFollowupsPayload,
  parseManagedCatalogResolveRequest,
  parseManagedCatalogResolveResponse,
  parseManagedResearchFollowupsCommand,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { createManagedResearchCoverageFixture } from "../../src/clerk-trial/test-managed-research-coverage-fixture";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import {
  heldDueExpected,
  heldDueIdentities,
  heldDueIds,
  heldDueLedger,
  heldDueOriginal,
} from "./portfolio-held-due-checks-fixture-data";
interface Counts {
  readonly status: number;
  readonly portfolioLoad: number;
  readonly resolve: number;
  readonly rejected: number;
  readonly unexpected: Readonly<Record<string, number>>;
  readonly resolveRequests: readonly (readonly string[])[];
}
export interface PortfolioHeldDueChecksFixture {
  readonly day: string;
  readonly ledger: ReturnType<typeof heldDueLedger>;
  readonly original: ReturnType<typeof heldDueOriginal>;
  readonly getSnapshot: () => Counts;
  readonly subscribe: (listener: () => void) => () => void;
}
/** Fixed invented RAM resources. No provider operation or personal Save other than one exact Follow-ups command is admitted. */
export function createPortfolioHeldDueChecksFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const day = new Date().toISOString().slice(0, 10),
    identities = heldDueIdentities(),
    digest = base.researchCoverage.catalogSnapshotSha256,
    ledger = heldDueLedger(digest),
    original = heldDueOriginal(digest, day),
    followups = createResearchFollowupsFixture({
      version: 7,
      payload: original,
    });
  const researchCoverage = createManagedResearchCoverageFixture(
    identities.map((listing, index) => ({
      listing,
      cik: String(index < 2 ? 2 : index + 2).padStart(10, "0"),
    })),
    digest,
  );
  let counts: Counts = Object.freeze({
      status: 0,
      portfolioLoad: 0,
      resolve: 0,
      rejected: 0,
      unexpected: Object.freeze({}),
      resolveRequests: Object.freeze([]),
    }),
    state = base.getSnapshot();
  const listeners = new Set<() => void>();
  const publish = () => {
    state = {
      ...base.getSnapshot(),
      status: counts.status,
      load: counts.unexpected.load ?? 0,
      save: counts.unexpected.save ?? 0,
      resolve: counts.resolve,
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
      "Unexpected invented held-due-check operation: " + operation,
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
        if (
          ids.join("|") === base.marketsCohort.map((x) => x.listingId).join("|")
        ) {
          admit(
            base.getSnapshot().marketsResolve < counts.status,
            "one Markets identity resolution per session",
          );
          return base.api.resolve(request, signal);
        }
        const held = identities
            .filter((x) => x.listingId !== heldDueIds.outside)
            .map((x) => x.listingId),
          portfolioRequest = ids.join("|") === held.join("|"),
          researchRequest = ids.length === 1 && ids[0] === heldDueIds.googl;
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
              !counts.resolveRequests.some((x) => x.length === 1),
            "one exact chosen Research resolution",
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
            counts.resolveRequests.filter((x) => x.length === 1).length === 1,
          "exact Follow-ups Save ownership",
        );
        admit(
          encodeResearchFollowupsPayload(command.payload) ===
            encodeResearchFollowupsPayload(heldDueExpected(original, day)),
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
    financialReview: null,
    getSnapshot: () => state,
    subscribe,
    portfolioHeldDueChecks: {
      day,
      ledger,
      original,
      getSnapshot: () => counts,
      subscribe,
    },
  };
}
