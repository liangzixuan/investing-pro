import {
  encodeResearchFollowupsPayload,
  parseManagedCatalogResolveResponse,
  parseManagedResearchFollowupsCommand,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";

export const completionQuestions = Object.freeze([
  "Does ZERO retain its original thesis? Keep the complete Class A identity.",
  "Which ONE evidence changes this assessment? Café 東京 📈",
  "Does ALFA still meet the independently authored research question?",
  "Keep this unchosen BETA question and its independent result in the whole draft.",
]);
export const completionResult =
  "My ONE assessment: <script>invented</script> & Café 東京 📈 The full authored text stays raw.";
export const completionUnchosenResult =
  "Independent unchosen BETA assessment Café 東京 📈";
export const completionDueOn = "2000-01-01";
export function completionListings(base: SharedNativeFixture) {
  return [
    base.researchCoverage.listings[0]!.listing,
    base.researchCoverage.listings[1]!.listing,
    base.marketsCohort[0],
    base.marketsCohort[1],
  ];
}
export function completionExpected(
  base: SharedNativeFixture,
  ids: readonly string[],
  completedOn: string,
): ResearchFollowupsPayload {
  return {
    schemaVersion: 1,
    entries: completionListings(base).map((listing, index) => ({
      id: ids[index]!,
      listing,
      catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
      check: completionQuestions[index]!,
      dueOn: completionDueOn,
      result:
        index === 1
          ? completionResult
          : index === 3
            ? completionUnchosenResult
            : "",
      ...(index === 1 || index === 0
        ? { status: "completed" as const, completedOn }
        : { status: "open" as const, completedOn: null }),
    })),
  };
}
export interface ReviewCompletionMetadata {
  readonly getSnapshot: () => Readonly<{ rejected: number }>;
  readonly subscribe: (listener: () => void) => () => void;
}

/** Invented RAM transport. Only two startup reads, one company resolution and one whole Save are admitted. */
export function createReviewCompletionNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const followups = createResearchFollowupsFixture();
  const startedOn = new Date().toISOString().slice(0, 10);
  let rejected = 0,
    resolves = 0;
  let metadata = Object.freeze({ rejected });
  let state = base.getSnapshot();
  const listeners = new Set<() => void>();
  const publish = () => {
    state = { ...base.getSnapshot(), resolve: resolves };
    for (const listener of listeners) listener();
  };
  base.subscribe(publish);
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  function refuse(): never {
    metadata = Object.freeze({ rejected: ++rejected });
    publish();
    throw new Error("Unexpected invented review-check-completion operation");
  }
  function admit(condition: unknown): asserts condition {
    if (!condition) refuse();
  }
  const load: ManagedApi["load"] = async (signal) => {
    const count = base.getSnapshot().load;
    admit(
      !signal.aborted && count < 2 && count < followups.getSnapshot().session,
    );
    if (count === 1) admit(followups.getSnapshot().commits === 1);
    const saved = await base.api.load(signal);
    return {
      ...saved,
      payload: {
        ...saved.payload,
        memberships: [
          ...saved.payload.memberships,
          ...completionListings(base)
            .slice(2)
            .map((listing) => ({
              ...listing,
              note: "Independent unchosen listing note",
            })),
        ],
      },
    };
  };
  const status: ManagedApi["status"] = (signal) => {
    const count = base.getSnapshot().status;
    admit(
      !signal.aborted && count < 2 && count < followups.getSnapshot().session,
    );
    return base.api.status(signal);
  };
  const resolve: ManagedApi["resolve"] = (request, signal) => {
    if (
      request.listingIds.join("|") ===
      base.marketsCohort.map((row) => row.listingId).join("|")
    ) {
      const count = base.getSnapshot().marketsResolve;
      admit(
        !signal.aborted && count < 2 && count < followups.getSnapshot().session,
      );
      return base.api.resolve(request, signal);
    }
    admit(
      !signal.aborted && resolves === 0 && followups.getSnapshot().load === 1,
    );
    admit(
      request.listingIds.length === 1 &&
        request.listingIds[0] === "listing-one",
    );
    admit(
      request.snapshotSha256 === base.researchCoverage.catalogSnapshotSha256,
    );
    const parsed = parseManagedCatalogResolveResponse(
      {
        snapshotSha256: request.snapshotSha256,
        results: [
          { listingId: "listing-one", listing: completionListings(base)[1] },
        ],
      },
      request,
    );
    admit(parsed);
    resolves++;
    publish();
    return Promise.resolve(parsed);
  };
  const loadFollowups: ManagedApi["loadFollowups"] = (signal) => {
    const current = followups.getSnapshot();
    admit(!signal.aborted && current.load < 2);
    if (current.load === 1)
      admit(current.session === 2 && current.commits === 1);
    return followups.api.loadFollowups(signal);
  };
  const saveFollowups: ManagedApi["saveFollowups"] = (input, signal) => {
    const command = parseManagedResearchFollowupsCommand(input);
    admit(command);
    admit(
      !signal.aborted &&
        resolves === 1 &&
        rejected === 0 &&
        followups.getSnapshot().save === 0 &&
        command.expectedVersion === 0,
    );
    admit(command.payload.entries.length === 4);
    const day = command.payload.entries[1]?.completedOn;
    admit(
      day &&
        (day === startedOn || day === new Date().toISOString().slice(0, 10)),
    );
    const expected = completionExpected(
      base,
      command.payload.entries.map((entry) => entry.id),
      day,
    );
    admit(
      encodeResearchFollowupsPayload(command.payload) ===
        encodeResearchFollowupsPayload(expected),
    );
    return followups.api.saveFollowups(command, signal);
  };
  const api = Object.fromEntries(
    Object.keys(base.api).map((key) => [key, refuse]),
  ) as unknown as ManagedApi;
  Object.assign(api, {
    load,
    status,
    resolve,
    loadFollowups,
    saveFollowups,
  });
  return {
    ...base,
    financialReview: null,
    api,
    followups,
    session: followups.nextSession(),
    reviewCompletion: { getSnapshot: () => metadata, subscribe },
    getSnapshot: () => state,
    subscribe,
  };
}
