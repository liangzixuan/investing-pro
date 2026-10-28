import {
  encodeResearchFollowupsPayload,
  parseManagedCatalogResolveResponse,
  parseManagedResearchFollowupsCommand,
  parseResearchFollowupsPayload,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";

export const valuationFollowupQuestion =
  "Will this authored case hold? Café 東京 📈";
export const valuationFollowupDueOn = "2026-12-31";
/** Literal oracle, independent of the product's summary and preview builders. */
export const valuationFollowupCheck =
  "Question: Will this authored case hold? Café 東京 📈 | Authored estimate: Exit multiple authored-exit-multiple-v1; Base scenario; USD/share 19.00. Summary only; inputs and source evidence not included.";

function refuse(): never {
  throw new Error("Unexpected invented valuation-scenario-followup action");
}
export function valuationFollowupOriginal(
  base: SharedNativeFixture,
): ResearchFollowupsPayload {
  const parsed = parseResearchFollowupsPayload({
    schemaVersion: 1,
    entries: [
      {
        id: "20000000-0000-4000-8000-000000000001",
        listing: base.marketsCohort[1],
        catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
        check: "Keep the original Class A question and assessment.",
        dueOn: "2026-10-01",
        status: "completed",
        completedOn: "2026-10-04",
        result: "Original Class A assessment Café 東京 remains complete.",
      },
      {
        id: "20000000-0000-4000-8000-000000000002",
        listing: base.marketsCohort[2],
        catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
        check: "Class C keeps its separate earlier question.",
        dueOn: "2026-11-01",
        status: "open",
        completedOn: null,
        result: "Keep the Class C assessment unchanged.",
      },
    ],
  });
  if (!parsed) return refuse();
  return parsed;
}
export function valuationFollowupExpected(
  base: SharedNativeFixture,
  id: string,
): ResearchFollowupsPayload {
  const original = valuationFollowupOriginal(base);
  const parsed = parseResearchFollowupsPayload({
    ...original,
    entries: [
      ...original.entries,
      {
        id,
        listing: base.researchCoverage.listings[0]!.listing,
        catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
        check: valuationFollowupCheck,
        dueOn: valuationFollowupDueOn,
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
class ValuationFollowupStore {
  private counts: Record<Source, number> = {
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
    const loads = this.base.getSnapshot().load;
    if (
      signal.aborted ||
      loads >= 2 ||
      (loads === 1 && this.followups.getSnapshot().commits !== 1)
    )
      return refuse();
    return this.base.api.load(signal);
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
  private readonly loadFollowups: Api["loadFollowups"] = (signal) => {
    const state = this.followups.getSnapshot();
    if (
      this.state.load !== state.load + 1 ||
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
      this.followups.getSnapshot().save !== 0 ||
      this.counts.resolve !== 1 ||
      !command ||
      command.expectedVersion !== 1
    )
      return refuse();
    const entry = command.payload.entries[2];
    if (
      !entry ||
      encodeResearchFollowupsPayload(command.payload) !==
        encodeResearchFollowupsPayload(
          valuationFollowupExpected(this.base, entry.id),
        )
    )
      return refuse();
    return this.followups.api.saveFollowups(command, signal);
  };
  api(): Api {
    return {
      ...this.base.api,
      load: this.load,
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
/** RAM-only strict whole-resource custody; no financial source operation is admitted. */
export function createValuationScenarioFollowupNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const followups = createResearchFollowupsFixture({
    version: 1,
    payload: valuationFollowupOriginal(base),
  });
  const store = new ValuationFollowupStore(base, followups);
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
