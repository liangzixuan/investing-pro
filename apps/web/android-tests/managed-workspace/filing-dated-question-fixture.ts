import {
  encodeResearchFollowupsPayload,
  parseManagedResearchFollowupsCommand,
  parseResearchFollowupsPayload,
  parseManagedSecFilingsRequest,
  type ManagedWatchlistDto,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { inventedFilingsPacket } from "./filings-fixture";
import { listingIdentity } from "../../src/clerk-trial/managed-workspace";

export const filingDatedQuestion =
  "Will the next quarterly filing confirm capacity growth? Café 東京";
export const filingDatedQuestionDueOn = "2026-12-31";
/** Independent handwritten oracle; never calls the product formatter. */
export const filingDatedQuestionCheck =
  "Question: Will the next quarterly filing confirm capacity growth? Café 東京 | SEC filing metadata: Form 10-Q; accession 0000000001-26-000001; filed 2026-09-19; https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm";

type Api = SharedNativeFixture["api"];
type State = ReturnType<SharedNativeFixture["getSnapshot"]>;
type Source =
  "filings" | "annual" | "eod" | "calendar" | "fed" | "search" | "save";

/** Fixed protocol over the existing independent Follow-ups RAM resource. */
class FilingQuestionStore {
  private original: ManagedWatchlistDto | null = null;
  private readonly counts: Record<Source, number> = {
    filings: 0,
    annual: 0,
    eod: 0,
    calendar: 0,
    fed: 0,
    search: 0,
    save: 0,
  };
  private refused = false;
  private state: State;
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
    this.state = { ...this.base.getSnapshot(), ...this.counts };
    for (const listener of this.listeners) listener();
  };
  private assertAllowed(value: unknown): asserts value {
    if (value && !this.refused) return;
    this.refused = true;
    throw new Error("Unexpected invented filing dated-question action");
  }
  private active(signal: AbortSignal) {
    this.assertAllowed(!signal.aborted);
    this.assertAllowed(
      Object.entries(this.counts).every(([key, value]) =>
        key === "filings" ? value <= 1 : value === 0,
      ),
    );
  }
  private initialVisit(signal: AbortSignal) {
    this.active(signal);
    const current = this.base.getSnapshot();
    this.assertAllowed(current.load === 1 && current.status === 1);
    this.assertAllowed(current.marketsResolve === 1 && current.resolve === 0);
    this.assertAllowed(this.base.followups!.getSnapshot().session === 1);
  }
  private nextStartup(signal: AbortSignal, count: number) {
    this.active(signal);
    this.assertAllowed(count < 2);
    if (count === 1)
      this.assertAllowed(this.base.followups!.getSnapshot().commits === 1);
  }
  readonly load: Api["load"] = async (signal) => {
    this.nextStartup(signal, this.base.getSnapshot().load);
    const result = await this.base.api.load(signal);
    this.original ??= structuredClone(result);
    return result;
  };
  readonly status: Api["status"] = (signal) => {
    this.nextStartup(signal, this.base.getSnapshot().status);
    return this.base.api.status(signal);
  };
  readonly resolve: Api["resolve"] = (request, signal) => {
    this.nextStartup(signal, this.base.getSnapshot().marketsResolve);
    this.assertAllowed(
      request.listingIds.join("|") ===
        this.base.marketsCohort.map((listing) => listing.listingId).join("|"),
    );
    return this.base.api.resolve(request, signal);
  };
  readonly recentFilings: Api["recentFilings"] = (input, signal) => {
    this.initialVisit(signal);
    this.assertAllowed(this.counts.filings === 0 && this.original);
    this.assertAllowed(this.base.followups!.getSnapshot().load === 0);
    const request = parseManagedSecFilingsRequest(input);
    const member = this.original.payload.memberships[0]!;
    this.assertAllowed(request?.listingId === member.listingId);
    this.assertAllowed(request.symbol === member.symbol);
    this.assertAllowed(
      request.catalogSnapshotSha256 === this.original.payload.snapshotSha256,
    );
    this.counts.filings++;
    this.publish();
    const listing = listingIdentity(member);
    return Promise.resolve(structuredClone(inventedFilingsPacket(listing)));
  };
  readonly loadFollowups: Api["loadFollowups"] = (signal) => {
    this.active(signal);
    const resource = this.base.followups!.getSnapshot();
    this.assertAllowed(this.counts.filings === 1);
    this.assertAllowed(resource.load < 2);
    this.assertAllowed(resource.nextRead === "complete");
    if (resource.load === 0) this.initialVisit(signal);
    else this.assertAllowed(resource.session === 2 && resource.commits === 1);
    return this.base.api.loadFollowups(signal);
  };
  private expectedPayload(id: string): ResearchFollowupsPayload {
    this.assertAllowed(this.original);
    const listing = listingIdentity(this.original.payload.memberships[0]!);
    const expected = parseResearchFollowupsPayload({
      schemaVersion: 1,
      entries: [
        {
          id,
          listing,
          catalogSnapshotSha256: this.original.payload.snapshotSha256,
          check: filingDatedQuestionCheck,
          dueOn: filingDatedQuestionDueOn,
          status: "open",
          completedOn: null,
          result: "",
        },
      ],
    });
    this.assertAllowed(expected);
    return expected;
  }
  readonly saveFollowups: Api["saveFollowups"] = (input, signal) => {
    this.initialVisit(signal);
    const resource = this.base.followups!.getSnapshot();
    this.assertAllowed(
      resource.load === 1 && resource.save === 0 && resource.commits === 0,
    );
    this.assertAllowed(
      resource.nextSave === "complete" && this.counts.filings === 1,
    );
    const command = parseManagedResearchFollowupsCommand(input);
    this.assertAllowed(command?.expectedVersion === 0);
    this.assertAllowed(command.payload.entries.length === 1);
    const expected = this.expectedPayload(command.payload.entries[0]!.id);
    this.assertAllowed(
      encodeResearchFollowupsPayload(command.payload) ===
        encodeResearchFollowupsPayload(expected),
    );
    return this.base.api.saveFollowups(command, signal);
  };
  refuse(kind: Source): never {
    this.counts[kind]++;
    this.publish();
    this.assertAllowed(false);
    throw new Error("Unreachable invented action");
  }
  refuseOther(): never {
    this.assertAllowed(false);
    throw new Error("Unreachable invented action");
  }
}

export function createFilingDatedQuestionNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const store = new FilingQuestionStore(base);
  return {
    ...base,
    financialReview: null,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    api: {
      ...base.api,
      load: store.load,
      status: store.status,
      resolve: store.resolve,
      recentFilings: store.recentFilings,
      loadFollowups: store.loadFollowups,
      saveFollowups: store.saveFollowups,
      save: () => store.refuse("save"),
      search: () => store.refuse("search"),
      annualReport: () => store.refuse("annual"),
      eodHistory: () => store.refuse("eod"),
      economicCalendar: () => store.refuse("calendar"),
      blsCalendar: () => store.refuse("calendar"),
      monetaryAnnouncements: () => store.refuse("fed"),
      loadPortfolio: () => store.refuseOther(),
      savePortfolio: () => store.refuseOther(),
      loadValuationAssumptions: () => store.refuseOther(),
      saveValuationAssumptions: () => store.refuseOther(),
    },
  };
}
