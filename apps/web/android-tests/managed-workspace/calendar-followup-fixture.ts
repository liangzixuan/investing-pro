import {
  encodeResearchFollowupsPayload,
  parseManagedCatalogResolveResponse,
  parseManagedMonetaryAnnouncements,
  parseManagedResearchFollowupsCommand,
  parseManagedWatchlist,
  parseResearchFollowupsPayload,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { fedAnnouncementsFixture } from "../../src/clerk-trial/fed-announcements-fixture";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";

export const calendarFollowupQuestion =
  "Will policy change Class C funding? Café 東京 📈";
export const calendarFollowupDueOn = "2026-12-31";
export const calendarFollowupWatchlistNote =
  "Calendar question keeps this independent Watchlist note. Café 東京 📈";
export const calendarFollowupTitle =
  "Invented announcement without a publication time";
export const calendarFollowupUrl =
  "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm";
/** Independent literal oracle; no product citation/preview formatter is called. */
export const calendarFollowupCheck =
  "Question: Will policy change Class C funding? Café 東京 📈 | Fed announcement: Invented announcement without a publication time; published unknown; https://www.federalreserve.gov/newsevents/pressreleases/monetary20261018a.htm";

function refuse(): never {
  throw new Error("Unexpected invented markets-calendar-followup action");
}
export function calendarFollowupPacket() {
  const packet = parseManagedMonetaryAnnouncements({
    ...fedAnnouncementsFixture(),
    fetchedAt: "2026-10-23T18:00:00.000Z",
  });
  if (!packet) return refuse();
  return packet;
}
export function calendarFollowupWatchlist(base: SharedNativeFixture) {
  const parsed = parseManagedWatchlist({
    version: 1,
    payload: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: base.researchCoverage.catalogSnapshotSha256,
      memberships: [
        {
          ...base.researchCoverage.listings[0]!.listing,
          note: "Original independent note",
        },
        { ...base.marketsCohort[1], note: "Keep Class A distinct" },
        { ...base.marketsCohort[2], note: "Keep Class C distinct" },
      ],
    },
  });
  if (!parsed) return refuse();
  return parsed;
}
export function calendarFollowupOriginal(
  base: SharedNativeFixture,
): ResearchFollowupsPayload {
  const parsed = parseResearchFollowupsPayload({
    schemaVersion: 1,
    entries: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        listing: base.marketsCohort[0],
        catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
        check: "Keep the complete original ALFA check and result.",
        dueOn: "2026-10-01",
        status: "completed",
        completedOn: "2026-10-04",
        result: "Original ALFA assessment Café 東京 remains complete.",
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        listing: base.marketsCohort[1],
        catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
        check: "Class A has its own independent earlier question.",
        dueOn: "2026-11-01",
        status: "open",
        completedOn: null,
        result: "Do not overwrite this Class A assessment.",
      },
    ],
  });
  if (!parsed) return refuse();
  return parsed;
}
export function calendarFollowupExpected(
  base: SharedNativeFixture,
  id: string,
): ResearchFollowupsPayload {
  const original = calendarFollowupOriginal(base);
  const parsed = parseResearchFollowupsPayload({
    ...original,
    entries: [
      ...original.entries,
      {
        id,
        listing: base.marketsCohort[2],
        catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
        check: calendarFollowupCheck,
        dueOn: calendarFollowupDueOn,
        status: "open",
        completedOn: null,
        result: "",
      },
    ],
  });
  if (!parsed) return refuse();
  return parsed;
}
type Api = SharedNativeFixture["api"];
type Source =
  | "load"
  | "save"
  | "resolve"
  | "eod"
  | "annual"
  | "filings"
  | "search"
  | "calendar"
  | "bls"
  | "fed"
  | "portfolioLoad"
  | "portfolioSave"
  | "valuationLoad"
  | "valuationSave";
class CalendarFollowupStore {
  private counts: Record<Source, number> = {
    load: 0,
    save: 0,
    resolve: 0,
    eod: 0,
    annual: 0,
    filings: 0,
    search: 0,
    calendar: 0,
    bls: 0,
    fed: 0,
    portfolioLoad: 0,
    portfolioSave: 0,
    valuationLoad: 0,
    valuationSave: 0,
  };
  private state: ReturnType<SharedNativeFixture["getSnapshot"]>;
  private readonly listeners = new Set<() => void>();
  constructor(
    private readonly base: SharedNativeFixture,
    readonly followups: ReturnType<typeof createResearchFollowupsFixture>,
  ) {
    this.state = { ...base.getSnapshot(), ...this.counts };
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
  private record(source: Source) {
    this.counts = { ...this.counts, [source]: this.counts[source] + 1 };
    this.publish();
  }
  private disallow(source: Source): never {
    this.record(source);
    return refuse();
  }
  private readonly load: Api["load"] = (signal) => {
    if (signal.aborted || this.counts.load >= 2) return refuse();
    this.record("load");
    return Promise.resolve(
      structuredClone(calendarFollowupWatchlist(this.base)),
    );
  };
  private readonly fed: Api["monetaryAnnouncements"] = (signal) => {
    if (signal.aborted || this.counts.fed !== 0) return refuse();
    this.record("fed");
    return Promise.resolve(structuredClone(calendarFollowupPacket()));
  };
  private readonly resolve: Api["resolve"] = (request, signal) => {
    const ids = request.listingIds.join("|");
    if (ids === this.base.marketsCohort.map((row) => row.listingId).join("|"))
      return this.base.api.resolve(request, signal);
    const listing = this.base.marketsCohort[2];
    if (signal.aborted || this.counts.resolve !== 0) return refuse();
    if (ids !== listing.listingId) return refuse();
    if (
      request.snapshotSha256 !==
      this.base.researchCoverage.catalogSnapshotSha256
    )
      return refuse();
    const parsed = parseManagedCatalogResolveResponse(
      {
        snapshotSha256: request.snapshotSha256,
        results: [{ listingId: listing.listingId, listing }],
      },
      request,
    );
    if (!parsed) return refuse();
    this.record("resolve");
    return Promise.resolve(parsed);
  };
  private readonly loadFollowups: Api["loadFollowups"] = async (signal) => {
    const state = this.followups.getSnapshot();
    if (this.counts.fed !== 1 || state.load >= 2) return refuse();
    if (state.load === 1 && state.commits !== 1) return refuse();
    return this.followups.api.loadFollowups(signal);
  };
  private readonly saveFollowups: Api["saveFollowups"] = (input, signal) => {
    const command = parseManagedResearchFollowupsCommand(input);
    if (signal.aborted || this.followups.getSnapshot().save !== 0)
      return refuse();
    if (!command || command.expectedVersion !== 1) return refuse();
    if (this.counts.fed !== 1 || this.counts.resolve !== 1) return refuse();
    const entry = command.payload.entries[2];
    if (!entry) return refuse();
    const expected = calendarFollowupExpected(this.base, entry.id);
    if (
      encodeResearchFollowupsPayload(command.payload) !==
      encodeResearchFollowupsPayload(expected)
    )
      return refuse();
    return this.followups.api.saveFollowups(command, signal);
  };
  api(): Api {
    return {
      ...this.base.api,
      load: this.load,
      save: () => this.disallow("save"),
      resolve: this.resolve,
      monetaryAnnouncements: this.fed,
      loadFollowups: this.loadFollowups,
      saveFollowups: this.saveFollowups,
      eodHistory: () => this.disallow("eod"),
      annualReport: () => this.disallow("annual"),
      recentFilings: () => this.disallow("filings"),
      search: () => this.disallow("search"),
      economicCalendar: () => this.disallow("calendar"),
      blsCalendar: () => this.disallow("bls"),
      loadPortfolio: () => this.disallow("portfolioLoad"),
      savePortfolio: () => this.disallow("portfolioSave"),
      loadValuationAssumptions: () => this.disallow("valuationLoad"),
      saveValuationAssumptions: () => this.disallow("valuationSave"),
    };
  }
}
/** One explicit feed read and one exact independent Follow-ups Save; no financial or other writes. */
export function createCalendarFollowupNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const followups = createResearchFollowupsFixture({
    version: 1,
    payload: calendarFollowupOriginal(base),
  });
  const store = new CalendarFollowupStore(base, followups);
  return {
    ...base,
    followups,
    session: followups.nextSession(),
    api: store.api(),
    financialReview: null,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
  };
}
