import {
  encodeResearchFollowupsPayload,
  parseManagedPortfolio,
  parseManagedWatchlist,
  parseManagedCatalogResolveResponse,
  parseManagedResearchFollowupsCommand,
  parseResearchFollowupsPayload,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import type { TrialSession } from "../../src/clerk-trial/session";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import { createPortfolioResource } from "./portfolio-fixture";

export const holdingFollowupQuestion =
  "Will authored capacity support this holding? Café 東京 📈";
export const holdingFollowupDueOn = "2026-12-31";
export const holdingFollowupRetainedCheck =
  "Keep this earlier ALFA assessment in original resource order.";

/** Independent invented position oracle; no product preview or formatter is called. */
export function holdingFollowupLedger(base: SharedNativeFixture) {
  const identities = base.researchCoverage.listings
    .slice(0, 2)
    .map((row) => row.listing);
  const parsed = parseManagedPortfolio({
    version: 1,
    payload: {
      schemaVersion: 3,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: base.researchCoverage.catalogSnapshotSha256,
      basisMethod: "fifo_with_opening_pool",
      identities,
      opening: {
        asOfDate: "2026-10-04",
        cashUsd: null,
        holdings: [
          {
            listingId: "listing-zero",
            shares: "2.000000",
            totalCostBasisUsd: "80.00",
            confirmedOn: "2026-10-02",
          },
          {
            listingId: "listing-one",
            shares: "3.000000",
            totalCostBasisUsd: null,
            confirmedOn: "2026-10-03",
          },
        ],
      },
      transactions: [],
    },
  });
  if (!parsed) throw new Error("Invalid invented holding ledger");
  return parsed;
}
export function holdingFollowupOriginal(
  base: SharedNativeFixture,
): ResearchFollowupsPayload {
  const parsed = parseResearchFollowupsPayload({
    schemaVersion: 1,
    entries: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        listing: base.marketsCohort[0],
        catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
        check: holdingFollowupRetainedCheck,
        dueOn: "2026-10-01",
        status: "completed",
        completedOn: "2026-10-04",
        result: "Original invented assessment Café 東京 remains complete.",
      },
    ],
  });
  if (!parsed) throw new Error("Invalid invented retained check");
  return parsed;
}
export function holdingFollowupExpected(
  base: SharedNativeFixture,
  id: string,
): ResearchFollowupsPayload {
  const original = holdingFollowupOriginal(base);
  const parsed = parseResearchFollowupsPayload({
    ...original,
    entries: [
      ...original.entries,
      {
        id,
        listing: base.researchCoverage.listings[1]!.listing,
        catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
        check: holdingFollowupQuestion,
        dueOn: holdingFollowupDueOn,
        status: "open",
        completedOn: null,
        result: "",
      },
    ],
  });
  if (!parsed) throw new Error("Invalid invented holding check expectation");
  return parsed;
}
/** The separate saved research list contains ALFA only; neither holding is a member. */
export function holdingFollowupWatchlist(base: SharedNativeFixture) {
  const parsed = parseManagedWatchlist({
    version: 1,
    payload: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: base.researchCoverage.catalogSnapshotSha256,
      memberships: [
        { ...base.marketsCohort[0], note: "Separate saved research list" },
      ],
    },
  });
  if (!parsed) throw new Error("Invalid invented holding Watchlist");
  return parsed;
}
function refuse(): never {
  throw new Error("Unexpected invented holding-followup action");
}

type Api = SharedNativeFixture["api"];
type Source =
  | "resolve"
  | "load"
  | "save"
  | "portfolioSave"
  | "portfolioLoad"
  | "eod"
  | "annual"
  | "filings"
  | "search"
  | "calendar"
  | "fed";
function joinSession(session: TrialSession, own: TrialSession): TrialSession {
  return {
    ...session,
    getToken: own.getToken,
    signOut: async () => {
      await own.signOut();
      await session.signOut();
    },
  };
}
class HoldingFollowupStore {
  readonly portfolio = createPortfolioResource();
  readonly session: TrialSession;
  private readonly ledger;
  private readonly counts: Record<Source, number> = {
    resolve: 0,
    load: 0,
    save: 0,
    portfolioSave: 0,
    portfolioLoad: 0,
    eod: 0,
    annual: 0,
    filings: 0,
    search: 0,
    calendar: 0,
    fed: 0,
  };
  private state: ReturnType<SharedNativeFixture["getSnapshot"]>;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly base: SharedNativeFixture) {
    this.ledger = holdingFollowupLedger(base);
    this.state = { ...base.getSnapshot(), ...this.counts };
    base.subscribe(this.publish);
    const nextPortfolio = this.portfolio.nextSession.bind(this.portfolio);
    this.session = joinSession(base.session, nextPortfolio());
    this.portfolio.nextSession = () =>
      joinSession(base.followups!.nextSession(), nextPortfolio());
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
  private disallow(kind: Source): never {
    this.counts[kind]++;
    this.publish();
    return refuse();
  }
  private readonly load: Api["load"] = (signal) => {
    if (signal.aborted) return refuse();
    if (this.counts.load !== 0) return refuse();
    this.counts.load++;
    this.publish();
    return Promise.resolve(holdingFollowupWatchlist(this.base));
  };
  private readonly loadPortfolio: Api["loadPortfolio"] = async (signal) => {
    this.counts.portfolioLoad++;
    this.publish();
    if (this.counts.portfolioLoad !== 1) return refuse();
    await this.portfolio.api.loadPortfolio(signal);
    return structuredClone(this.ledger);
  };
  private readonly resolve: Api["resolve"] = (request, signal) => {
    const ids = request.listingIds.join("|");
    if (
      ids ===
      this.base.marketsCohort.map((listing) => listing.listingId).join("|")
    )
      return this.base.api.resolve(request, signal);
    if (ids !== "listing-zero|listing-one") return refuse();
    if (signal.aborted) return refuse();
    if (this.counts.resolve !== 0) return refuse();
    if (request.snapshotSha256 !== this.ledger.payload!.snapshotSha256)
      return refuse();
    const parsed = parseManagedCatalogResolveResponse(
      {
        snapshotSha256: request.snapshotSha256,
        results: this.ledger.payload!.identities.map((listing) => ({
          listingId: listing.listingId,
          listing,
        })),
      },
      request,
    );
    if (!parsed) return refuse();
    this.counts.resolve++;
    this.publish();
    return Promise.resolve(parsed);
  };
  private readonly loadFollowups: Api["loadFollowups"] = async (signal) => {
    const count = this.base.followups!.getSnapshot().load;
    if (count >= 2) return refuse();
    if (count === 1 && this.base.followups!.getSnapshot().commits !== 1)
      return refuse();
    const result = await this.base.api.loadFollowups(signal);
    return result;
  };
  private readonly saveFollowups: Api["saveFollowups"] = (input, signal) => {
    if (signal.aborted) return refuse();
    if (this.base.followups!.getSnapshot().save !== 0) return refuse();
    const command = parseManagedResearchFollowupsCommand(input);
    if (!command) return refuse();
    if (command.expectedVersion !== 1) return refuse();
    if (command.payload.entries.length !== 2) return refuse();
    if (command.payload.entries[1]!.listing.listingId !== "listing-one")
      return refuse();
    const expected = holdingFollowupExpected(
      this.base,
      command.payload.entries[1]!.id,
    );
    if (
      encodeResearchFollowupsPayload(command.payload) !==
      encodeResearchFollowupsPayload(expected)
    )
      return refuse();
    return this.base.api.saveFollowups(command, signal);
  };
  api(): Api {
    return {
      ...this.base.api,
      load: this.load,
      save: () => this.disallow("save"),
      loadPortfolio: this.loadPortfolio,
      savePortfolio: () => this.disallow("portfolioSave"),
      resolve: this.resolve,
      loadFollowups: this.loadFollowups,
      saveFollowups: this.saveFollowups,
      eodHistory: () => this.disallow("eod"),
      annualReport: () => this.disallow("annual"),
      recentFilings: () => this.disallow("filings"),
      search: () => this.disallow("search"),
      economicCalendar: () => this.disallow("calendar"),
      blsCalendar: () => this.disallow("calendar"),
      monetaryAnnouncements: () => this.disallow("fed"),
      loadValuationAssumptions: refuse,
      saveValuationAssumptions: refuse,
    };
  }
}
/** Two explicit Follow-ups reads and one exact independent Save; all source/other writes refuse. */
export function createHoldingFollowupNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const followups = createResearchFollowupsFixture({
    version: 1,
    payload: holdingFollowupOriginal(base),
  });
  const seeded = {
    ...base,
    followups,
    session: followups.nextSession(),
    api: { ...base.api, ...followups.api },
  };
  const store = new HoldingFollowupStore(seeded);
  return {
    ...seeded,
    session: store.session,
    portfolio: store.portfolio,
    api: store.api(),
    financialReview: null,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
  };
}
