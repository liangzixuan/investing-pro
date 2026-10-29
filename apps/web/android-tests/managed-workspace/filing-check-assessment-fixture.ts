import {
  encodeResearchFollowupsPayload,
  parseManagedCatalogResolveResponse,
  parseManagedResearchFollowupsCommand,
  parseManagedSecFilingsRequest,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import {
  filingAssessmentExpected,
  filingAssessmentOriginal,
  filingAssessmentPacket,
} from "./filing-check-assessment-fixture-data";

type Followups = ReturnType<typeof createResearchFollowupsFixture>;
type Source =
  "eod" | "annual" | "interim" | "calendar" | "fed" | "cpi" | "search" | "save";
export interface FilingAssessmentNativeMetadata {
  readonly packet: ReturnType<typeof filingAssessmentPacket>;
  readonly getSnapshot: () => Readonly<{ rejected: number }>;
  readonly subscribe: (listener: () => void) => () => void;
}

class FilingAssessmentTransport {
  private readonly startedOn = new Date().toISOString().slice(0, 10);
  private counts = {
    resolve: 0,
    filings: 0,
    eod: 0,
    annual: 0,
    interim: 0,
    calendar: 0,
    fed: 0,
    cpi: 0,
    search: 0,
    save: 0,
  };
  private metadata: Readonly<{ rejected: number }> = Object.freeze({
    rejected: 0,
  });
  private state: ReturnType<SharedNativeFixture["getSnapshot"]>;
  private readonly listeners = new Set<() => void>();
  readonly packet;
  constructor(
    private readonly base: SharedNativeFixture,
    private readonly followups: Followups,
  ) {
    this.packet = filingAssessmentPacket(base);
    this.state = base.getSnapshot();
    base.subscribe(this.publish);
  }
  readonly getSnapshot = () => this.state;
  readonly getMetadata = () => this.metadata;
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
  private refuse(): never {
    this.metadata = Object.freeze({ rejected: this.metadata.rejected + 1 });
    this.publish();
    throw new Error("Unexpected invented filing-check-assessment operation");
  }
  private admit(value: unknown): asserts value {
    if (!value) this.refuse();
  }
  private disallow(source: Source): never {
    this.counts = { ...this.counts, [source]: this.counts[source] + 1 };
    return this.refuse();
  }
  private readonly load: ManagedApi["load"] = (signal) => {
    const count = this.base.getSnapshot().load;
    this.admit(!signal.aborted);
    this.admit(count < this.followups.getSnapshot().session);
    this.admit(count < 2);
    if (count === 1) this.admit(this.followups.getSnapshot().commits === 1);
    return this.base.api.load(signal);
  };
  private readonly resolve: ManagedApi["resolve"] = (request, signal) => {
    const ids = request.listingIds.join("|");
    if (ids === this.base.marketsCohort.map((row) => row.listingId).join("|"))
      return this.base.api.resolve(request, signal);
    this.admit(!signal.aborted);
    this.admit(ids === "listing-zero");
    this.admit(this.counts.resolve === 0);
    this.admit(this.followups.getSnapshot().load === 1);
    const parsed = parseManagedCatalogResolveResponse(
      {
        snapshotSha256: request.snapshotSha256,
        results: [
          {
            listingId: "listing-zero",
            listing: this.base.researchCoverage.listings[0]!.listing,
          },
        ],
      },
      request,
    );
    this.admit(parsed);
    this.admit(
      request.snapshotSha256 ===
        this.base.researchCoverage.catalogSnapshotSha256,
    );
    this.counts.resolve++;
    this.publish();
    return Promise.resolve(parsed);
  };
  private readonly filings: ManagedApi["recentFilings"] = (input, signal) => {
    const request = parseManagedSecFilingsRequest(input);
    this.admit(request);
    this.admit(!signal.aborted);
    this.admit(this.counts.resolve === 1);
    this.admit(this.counts.filings === 0);
    this.admit(
      request.catalogSnapshotSha256 === this.packet.catalogSnapshotSha256,
    );
    this.admit(request.listingId === this.packet.security.listingId);
    this.admit(request.symbol === this.packet.security.symbol);
    this.counts.filings++;
    this.publish();
    return Promise.resolve(structuredClone(this.packet));
  };
  private readonly loadFollowups: ManagedApi["loadFollowups"] = (signal) => {
    const current = this.followups.getSnapshot();
    this.admit(!signal.aborted);
    this.admit(current.load < 2);
    if (current.load === 1) {
      this.admit(current.commits === 1);
      this.admit(current.session === 2);
    }
    return this.followups.api.loadFollowups(signal);
  };
  private readonly saveFollowups: ManagedApi["saveFollowups"] = (
    input,
    signal,
  ) => {
    const command = parseManagedResearchFollowupsCommand(input);
    this.admit(command);
    this.admit(!signal.aborted);
    this.admit(this.counts.resolve === 1);
    this.admit(this.counts.filings === 1);
    this.admit(this.followups.getSnapshot().save === 0);
    this.admit(command.expectedVersion === 1);
    const completedOn = command.payload.entries[0]?.completedOn;
    const savedOn = new Date().toISOString().slice(0, 10);
    this.admit(completedOn === this.startedOn || completedOn === savedOn);
    const expected = filingAssessmentExpected(this.base, completedOn);
    this.admit(
      encodeResearchFollowupsPayload(command.payload) ===
        encodeResearchFollowupsPayload(expected),
    );
    return this.followups.api.saveFollowups(command, signal);
  };
  api(): ManagedApi {
    return {
      ...this.base.api,
      load: this.load,
      resolve: this.resolve,
      loadFollowups: this.loadFollowups,
      saveFollowups: this.saveFollowups,
      recentFilings: this.filings,
      save: () => this.disallow("save"),
      search: () => this.disallow("search"),
      eodHistory: () => this.disallow("eod"),
      annualReport: () => this.disallow("annual"),
      interimReport: () => this.disallow("interim"),
      economicCalendar: () => this.disallow("calendar"),
      blsCalendar: () => this.disallow("calendar"),
      monetaryAnnouncements: () => this.disallow("fed"),
      cpiHeadlines: () => this.disallow("cpi"),
    };
  }
}

export function createFilingAssessmentNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const followups = createResearchFollowupsFixture({
    version: 1,
    payload: filingAssessmentOriginal(base),
  });
  const transport = new FilingAssessmentTransport(base, followups);
  return {
    ...base,
    financialReview: null,
    api: transport.api(),
    followups,
    session: followups.nextSession(),
    filingAssessment: {
      packet: transport.packet,
      getSnapshot: transport.getMetadata,
      subscribe: transport.subscribe,
    },
    getSnapshot: transport.getSnapshot,
    subscribe: transport.subscribe,
  };
}
