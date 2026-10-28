import {
  MANAGED_CPI_HEADLINE_SOURCE,
  encodeResearchFollowupsPayload,
  parseManagedCatalogResolveResponse,
  parseManagedCpiHeadlines,
  parseManagedResearchFollowupsCommand,
  parseManagedWatchlist,
  parseResearchFollowupsPayload,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";

export const cpiFollowupQuestion =
  "Will this change my ZERO research? Café 東京 📈";
export const cpiFollowupDueOn = "2026-12-31";
export const cpiFollowupWatchlistNote =
  "CPI source keeps this independent unsaved note. Café 東京 📈";
export const cpiFollowupTitle =
  "Invented CPI headline: prices and household plans";
export const cpiFollowupUrl =
  "https://www.bls.gov/news.release/archives/cpi_10012026.htm";
export const cpiFollowupPublishedAt = "2026-10-01T07:15:22.123456-04:00";
export const cpiFollowupUpdatedAt = "2026-10-02T09:45:10.1200+05:30";
/** Literal independent oracle; no product citation or preview formatter is called. */
export const cpiFollowupCheck =
  "Question: Will this change my ZERO research? Café 東京 📈 | U.S. Bureau of Labor Statistics CPI headline: Invented CPI headline: prices and household plans. Feed published: 2026-10-01T07:15:22.123456-04:00; feed updated: 2026-10-02T09:45:10.1200+05:30. https://www.bls.gov/news.release/archives/cpi_10012026.htm";

function refuse(): never {
  throw new Error("Unexpected invented cpi-headline-followup action");
}
export function cpiFollowupPacket() {
  const packet = parseManagedCpiHeadlines({
    schemaVersion: "1.0.0",
    source: MANAGED_CPI_HEADLINE_SOURCE,
    fetchedAt: "2026-10-28T19:00:00.000Z",
    feedUpdatedAt: "2026-10-03T06:45:09.000000001+02:00",
    availableItemCount: 2,
    items: [
      {
        sourceId: "urn:invented:cpi:clock-1",
        title: cpiFollowupTitle,
        url: cpiFollowupUrl,
        publishedAt: cpiFollowupPublishedAt,
        updatedAt: cpiFollowupUpdatedAt,
      },
      {
        sourceId: "urn:invented:cpi:unknown-2",
        title: "Invented CPI headline with unknown feed clocks",
        url: "https://www.bls.gov/news.release/archives/cpi_10022026.htm",
        publishedAt: null,
        updatedAt: null,
      },
    ],
  });
  if (!packet) return refuse();
  return packet;
}
export function cpiFollowupWatchlist(base: SharedNativeFixture) {
  const packet = parseManagedWatchlist({
    version: 1,
    payload: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: base.researchCoverage.catalogSnapshotSha256,
      memberships: [
        {
          ...base.researchCoverage.listings[0]!.listing,
          note: "Original independent CPI note",
        },
        { ...base.marketsCohort[1], note: "Keep the Class A member distinct" },
        { ...base.marketsCohort[2], note: "Keep the Class C member distinct" },
      ],
    },
  });
  if (!packet) return refuse();
  return packet;
}
export function cpiFollowupOriginal(
  base: SharedNativeFixture,
): ResearchFollowupsPayload {
  const packet = parseResearchFollowupsPayload({
    schemaVersion: 1,
    entries: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        listing: base.marketsCohort[1],
        catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
        check: "Keep the complete Class A question and assessment.",
        dueOn: "2026-10-01",
        status: "completed",
        completedOn: "2026-10-04",
        result: "Original Class A assessment Café 東京 remains complete.",
      },
      {
        id: "30000000-0000-4000-8000-000000000002",
        listing: base.marketsCohort[2],
        catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
        check: "Class C keeps its separate earlier question.",
        dueOn: "2026-11-01",
        status: "open",
        completedOn: null,
        result: "Do not overwrite this independent Class C assessment.",
      },
    ],
  });
  if (!packet) return refuse();
  return packet;
}
export function cpiFollowupExpected(
  base: SharedNativeFixture,
  id: string,
): ResearchFollowupsPayload {
  const original = cpiFollowupOriginal(base);
  const packet = parseResearchFollowupsPayload({
    ...original,
    entries: [
      ...original.entries,
      {
        id,
        listing: base.researchCoverage.listings[0]!.listing,
        catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
        check: cpiFollowupCheck,
        dueOn: cpiFollowupDueOn,
        status: "open",
        completedOn: null,
        result: "",
      },
    ],
  });
  if (!packet) return refuse();
  return packet;
}
type Api = SharedNativeFixture["api"];
type Source =
  | "load"
  | "cpi"
  | "save"
  | "resolve"
  | "eod"
  | "annual"
  | "interimReport"
  | "filings"
  | "search"
  | "calendar"
  | "bls"
  | "fed"
  | "portfolioLoad"
  | "portfolioSave"
  | "valuationLoad"
  | "valuationSave";
class CpiHeadlineFollowupStore {
  private counts: Record<Source, number> = {
    load: 0,
    cpi: 0,
    save: 0,
    resolve: 0,
    eod: 0,
    annual: 0,
    interimReport: 0,
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
    if (
      signal.aborted ||
      this.counts.load >= 2 ||
      (this.counts.load === 1 && this.followups.getSnapshot().commits !== 1)
    )
      return refuse();
    this.record("load");
    return Promise.resolve(structuredClone(cpiFollowupWatchlist(this.base)));
  };
  private readonly cpi: Api["cpiHeadlines"] = (signal) => {
    if (signal?.aborted || this.counts.cpi !== 0) return refuse();
    this.record("cpi");
    return Promise.resolve(structuredClone(cpiFollowupPacket()));
  };
  private readonly resolve: Api["resolve"] = (request, signal) => {
    const ids = request.listingIds.join("|");
    if (ids === this.base.marketsCohort.map((row) => row.listingId).join("|"))
      return this.base.api.resolve(request, signal);
    const listing = this.base.researchCoverage.listings[0]!.listing;
    if (
      signal.aborted ||
      this.counts.resolve !== 0 ||
      ids !== listing.listingId ||
      request.snapshotSha256 !==
        this.base.researchCoverage.catalogSnapshotSha256
    )
      return refuse();
    const packet = parseManagedCatalogResolveResponse(
      {
        snapshotSha256: request.snapshotSha256,
        results: [{ listingId: listing.listingId, listing }],
      },
      request,
    );
    if (!packet) return refuse();
    this.record("resolve");
    return Promise.resolve(packet);
  };
  private readonly loadFollowups: Api["loadFollowups"] = (signal) => {
    const state = this.followups.getSnapshot();
    if (
      this.counts.cpi !== 1 ||
      state.load >= 2 ||
      (state.load === 1 && state.commits !== 1)
    )
      return refuse();
    return this.followups.api.loadFollowups(signal);
  };
  private readonly saveFollowups: Api["saveFollowups"] = (input, signal) => {
    const command = parseManagedResearchFollowupsCommand(input);
    if (
      signal.aborted ||
      this.counts.cpi !== 1 ||
      this.counts.resolve !== 1 ||
      this.followups.getSnapshot().save !== 0 ||
      !command ||
      command.expectedVersion !== 1
    )
      return refuse();
    const entry = command.payload.entries[2];
    if (
      !entry ||
      encodeResearchFollowupsPayload(command.payload) !==
        encodeResearchFollowupsPayload(cpiFollowupExpected(this.base, entry.id))
    )
      return refuse();
    return this.followups.api.saveFollowups(command, signal);
  };
  api(): Api {
    return {
      ...this.base.api,
      load: this.load,
      cpiHeadlines: this.cpi,
      resolve: this.resolve,
      loadFollowups: this.loadFollowups,
      saveFollowups: this.saveFollowups,
      save: () => this.disallow("save"),
      eodHistory: () => this.disallow("eod"),
      annualReport: () => this.disallow("annual"),
      interimReport: () => this.disallow("interimReport"),
      recentFilings: () => this.disallow("filings"),
      search: () => this.disallow("search"),
      economicCalendar: () => this.disallow("calendar"),
      blsCalendar: () => this.disallow("bls"),
      monetaryAnnouncements: () => this.disallow("fed"),
      loadPortfolio: () => this.disallow("portfolioLoad"),
      savePortfolio: () => this.disallow("portfolioSave"),
      loadValuationAssumptions: () => this.disallow("valuationLoad"),
      saveValuationAssumptions: () => this.disallow("valuationSave"),
    };
  }
}
/** Invented feed metadata and strict RAM-only independent Follow-ups persistence. */
export function createCpiHeadlineFollowupNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const followups = createResearchFollowupsFixture({
    version: 1,
    payload: cpiFollowupOriginal(base),
  });
  const store = new CpiHeadlineFollowupStore(base, followups);
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
