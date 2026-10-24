import {
  membershipMatchesResult,
  parseManagedCatalogResolveResponse,
  parseManagedResearchFollowupsCommand,
  type ManagedResearchFollowupsCommand,
  type ResearchFollowup,
} from "@research-cockpit/contracts";
import type { SharedNativeFixture, ManagedNativeFixture } from "./fixture";

export const reviewSessionQuestions = Object.freeze([
  "Does ZERO still support the authored research question? Keep the exact Class A listing and original evidence dates.",
  "Which ONE evidence would change this assessment? Read the complete question before writing a result.",
  "Keep this unchosen ALFA check and its existing independent assessment in the full saved draft.",
]);
export const reviewSessionResults = Object.freeze([
  "ZERO assessment authored in company research; no source was requested.",
  "ONE assessment authored separately after explicit Continue; no source was requested.",
  "Unchosen assessment stays in the independent full draft.",
]);
export const reviewSessionDueOn = "2000-01-01";

type Api = SharedNativeFixture["api"];
function refuse(): never {
  throw new Error("Unexpected invented daily Follow-ups review action");
}

/** Fixed invented commands only. This decorator neither seeds nor bypasses the RAM store. */
class FollowupsReviewFixture {
  private resolves = 0;
  private saves = 0;
  private sourceAttempts = { eod: 0, annual: 0, filings: 0 };
  private state: ReturnType<SharedNativeFixture["getSnapshot"]>;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly base: SharedNativeFixture) {
    this.state = base.getSnapshot();
    base.subscribe(this.publish);
  }
  readonly getSnapshot = () => this.state;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private readonly publish = () => {
    this.state = {
      ...this.base.getSnapshot(),
      resolve: this.resolves,
      ...this.sourceAttempts,
    };
    for (const listener of this.listeners) listener();
  };
  private listing(index: number) {
    if (index === 2) return this.base.marketsCohort[0];
    const row = this.base.researchCoverage.listings[index];
    if (!row) return refuse();
    return row.listing;
  }
  readonly load: Api["load"] = async (signal) => {
    const saved = await this.base.api.load(signal);
    return {
      ...saved,
      payload: {
        ...saved.payload,
        memberships: [
          ...saved.payload.memberships,
          { ...this.listing(2), note: "Independent unchosen listing note" },
        ],
      },
    };
  };
  readonly resolve: Api["resolve"] = (request, signal) => {
    if (
      request.listingIds.join("|") ===
      this.base.marketsCohort.map((row) => row.listingId).join("|")
    )
      return this.base.api.resolve(request, signal);
    if (signal.aborted) refuse();
    if (this.resolves >= 2) refuse();
    if (
      request.snapshotSha256 !==
      this.base.researchCoverage.catalogSnapshotSha256
    )
      refuse();
    const listing = this.listing(this.resolves);
    if (request.listingIds.length !== 1) refuse();
    if (request.listingIds[0] !== listing.listingId) refuse();
    const response = parseManagedCatalogResolveResponse(
      {
        snapshotSha256: request.snapshotSha256,
        results: [{ listingId: listing.listingId, listing }],
      },
      request,
    );
    if (!response) return refuse();
    this.resolves++;
    this.publish();
    return Promise.resolve(response);
  };
  source(kind: keyof typeof this.sourceAttempts): never {
    this.sourceAttempts[kind]++;
    this.publish();
    return refuse();
  }
  private requireEntry(entry: ResearchFollowup, index: number) {
    const listing = this.listing(index);
    if (!membershipMatchesResult({ ...listing, note: "" }, entry.listing))
      refuse();
    if (
      entry.catalogSnapshotSha256 !==
      this.base.researchCoverage.catalogSnapshotSha256
    )
      refuse();
    if (entry.check !== reviewSessionQuestions[index]) refuse();
    if (entry.result !== reviewSessionResults[index]) refuse();
    if (entry.dueOn !== reviewSessionDueOn) refuse();
    if (entry.status !== (index === 0 ? "completed" : "open")) refuse();
    if (
      entry.completedOn !==
      (index === 0 ? new Date().toISOString().slice(0, 10) : null)
    )
      refuse();
  }
  private requireCommand(
    input: unknown,
    signal: AbortSignal,
  ): ManagedResearchFollowupsCommand {
    if (signal.aborted) return refuse();
    if (this.resolves !== 2) refuse();
    if (this.saves !== 0) refuse();
    if (Object.values(this.sourceAttempts).some((count) => count !== 0))
      refuse();
    const command = parseManagedResearchFollowupsCommand(input);
    if (!command || command.expectedVersion !== 0) return refuse();
    if (command.payload.entries.length !== 3) refuse();
    command.payload.entries.forEach((entry, index) =>
      this.requireEntry(entry, index),
    );
    return command;
  }
  readonly saveFollowups: Api["saveFollowups"] = (input, signal) => {
    const command = this.requireCommand(input, signal);
    this.saves++;
    return this.base.api.saveFollowups(command, signal);
  };
}
export function createFollowupsReviewSessionNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const store = new FollowupsReviewFixture(base);
  return {
    ...base,
    financialReview: null,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    api: {
      ...base.api,
      load: store.load,
      resolve: store.resolve,
      saveFollowups: store.saveFollowups,
      eodHistory: () => store.source("eod"),
      annualReport: () => store.source("annual"),
      recentFilings: () => store.source("filings"),
    },
  };
}
