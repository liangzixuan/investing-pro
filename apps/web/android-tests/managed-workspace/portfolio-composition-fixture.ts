import {
  encodeResearchFollowupsPayload,
  managedEodHistoryWindow,
  parseManagedCatalogResolveResponse,
  parseManagedEodHistoryResponse,
  parseManagedPortfolio,
  parseManagedResearchFollowupsCommand,
  type ManagedEodHistoryRequestDto,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import type { TrialSession } from "../../src/clerk-trial/session";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createResearchFollowupsFixture } from "./followups-fixture";
import { holdingFollowupOriginal } from "./holding-followup-fixture";
import { createPortfolioResource } from "./portfolio-fixture";

export const compositionQuestion =
  "Does Class C still fit this dated composition? Café 東京 📈";
export const compositionDueOn = "2027-01-31";
export function compositionIdentities(base: SharedNativeFixture) {
  const first = base.researchCoverage.listings[0]!.listing;
  const second = {
    ...first,
    listingId: "listing-zero-c",
    securityId: "security-zero-c",
    securityName: "Zero Class C",
    shareClassId: "class-zero-c",
    shareClassName: "Class C",
    symbol: "ZERO.C",
  };
  return [first, second];
}
export function compositionLedger(base: SharedNativeFixture) {
  const identities = compositionIdentities(base);
  const dto = parseManagedPortfolio({
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
        cashUsd: "100.00",
        holdings: [
          {
            listingId: "listing-zero",
            shares: "2.000000",
            totalCostBasisUsd: "40.00",
            confirmedOn: "2026-10-02",
          },
          {
            listingId: "listing-zero-c",
            shares: "1.000000",
            totalCostBasisUsd: null,
            confirmedOn: "2026-10-03",
          },
        ],
      },
      transactions: [],
    },
  });
  if (!dto) throw new Error("Invalid invented composition ledger");
  return dto;
}
export function compositionPacket(
  request: ManagedEodHistoryRequestDto,
  security: ManagedEodIdentity,
  now: number,
) {
  const requestStartedAt = new Date(now - 2000).toISOString();
  const date = new Date(now).toISOString().slice(0, 10);
  const previous = new Date(now - 2 * 86_400_000).toISOString().slice(0, 10);
  const packet = parseManagedEodHistoryResponse(
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: request.catalogSnapshotSha256,
      security,
      range: "1m",
      provider: "Tiingo",
      currency: "USD",
      priceBasis: "raw_close",
      window: managedEodHistoryWindow(requestStartedAt, "1m"),
      requestStartedAt,
      completedAt: new Date(now - 1000).toISOString(),
      rows:
        security.listingId === "listing-zero"
          ? [
              { date: previous, close: "20" },
              { date, close: "25" },
            ]
          : [
              { date: previous, close: "40" },
              { date, close: "50" },
            ],
    },
    request,
  );
  if (!packet) throw new Error("Invalid invented composition close packet");
  return packet;
}
export function compositionExpected(base: SharedNativeFixture, id: string) {
  const original = holdingFollowupOriginal(base);
  return {
    ...original,
    entries: [
      ...original.entries,
      {
        id,
        listing: compositionIdentities(base)[1]!,
        catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
        check: compositionQuestion,
        dueOn: compositionDueOn,
        status: "open" as const,
        completedOn: null,
        result: "",
      },
    ],
  };
}
function refuse(): never {
  throw new Error("Unexpected invented portfolio-composition action");
}
type Api = SharedNativeFixture["api"];
type Count =
  | "load"
  | "save"
  | "resolve"
  | "eod"
  | "annual"
  | "filings"
  | "search"
  | "calendar"
  | "fed"
  | "portfolioSave";
class CompositionStore {
  readonly portfolio = createPortfolioResource();
  readonly followups;
  readonly ledger;
  readonly identities;
  readonly session: TrialSession;
  private readonly now = Date.now();
  private readonly priced = new Set<string>();
  private readonly counts: Record<Count, number> = {
    load: 0,
    save: 0,
    resolve: 0,
    eod: 0,
    annual: 0,
    filings: 0,
    search: 0,
    calendar: 0,
    fed: 0,
    portfolioSave: 0,
  };
  private state: ReturnType<SharedNativeFixture["getSnapshot"]>;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly base: SharedNativeFixture) {
    this.identities = compositionIdentities(base);
    this.ledger = compositionLedger(base);
    this.followups = createResearchFollowupsFixture({
      version: 1,
      payload: holdingFollowupOriginal(base),
    });
    this.state = { ...base.getSnapshot(), ...this.counts };
    base.subscribe(this.publish);
    const next = this.portfolio.nextSession.bind(this.portfolio);
    this.portfolio.nextSession = () =>
      this.join(next(), this.followups.nextSession());
    this.session = this.portfolio.nextSession();
  }
  private join(portfolio: TrialSession, followups: TrialSession): TrialSession {
    return {
      ...portfolio,
      signOut: async () => {
        await portfolio.signOut();
        await followups.signOut();
      },
    };
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
  private reject(source: Count): never {
    this.counts[source]++;
    this.publish();
    return refuse();
  }
  private readonly loadPortfolio: Api["loadPortfolio"] = async (signal) => {
    if (this.portfolio.getSnapshot().load !== 0) return refuse();
    await this.portfolio.api.loadPortfolio(signal);
    return structuredClone(this.ledger);
  };
  private readonly resolve: Api["resolve"] = async (request, signal) => {
    const ids = request.listingIds.join("|");
    if (ids === this.base.marketsCohort.map((row) => row.listingId).join("|"))
      return this.base.api.resolve(request, signal);
    if (ids !== "listing-zero|listing-zero-c") return refuse();
    if (signal.aborted) return refuse();
    if (this.counts.resolve !== 0) return refuse();
    if (request.snapshotSha256 !== this.ledger.payload!.snapshotSha256)
      return refuse();
    const response = parseManagedCatalogResolveResponse(
      {
        snapshotSha256: request.snapshotSha256,
        results: this.identities.map((listing) => ({
          listingId: listing.listingId,
          listing,
        })),
      },
      request,
    );
    if (!response) return refuse();
    this.counts.resolve++;
    this.publish();
    return response;
  };
  private readonly eodHistory: Api["eodHistory"] = (request, signal) => {
    if (signal.aborted) return refuse();
    if (request.catalogSnapshotSha256 !== this.ledger.payload!.snapshotSha256)
      return refuse();
    if (request.range !== "1m") return refuse();
    const security = this.identities.find(
      (row) => row.listingId === request.listingId,
    );
    if (!security) return refuse();
    if (this.priced.has(security.listingId)) return refuse();
    this.priced.add(security.listingId);
    this.counts.eod++;
    this.publish();
    return Promise.resolve(compositionPacket(request, security, this.now));
  };
  private readonly loadFollowups: Api["loadFollowups"] = (signal) => {
    if (this.followups.getSnapshot().load >= 2) return refuse();
    if (
      this.followups.getSnapshot().load === 1 &&
      this.followups.getSnapshot().commits !== 1
    )
      return refuse();
    return this.followups.api.loadFollowups(signal);
  };
  private readonly saveFollowups: Api["saveFollowups"] = (input, signal) => {
    if (signal.aborted) return refuse();
    if (this.followups.getSnapshot().save !== 0) return refuse();
    const command = parseManagedResearchFollowupsCommand(input);
    if (!command) return refuse();
    if (command.expectedVersion !== 1) return refuse();
    if (command.payload.entries.length !== 2) return refuse();
    const expected = compositionExpected(
      this.base,
      command.payload.entries[1]!.id,
    );
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
      load: () => this.reject("load"),
      save: () => this.reject("save"),
      loadPortfolio: this.loadPortfolio,
      savePortfolio: () => this.reject("portfolioSave"),
      resolve: this.resolve,
      eodHistory: this.eodHistory,
      loadFollowups: this.loadFollowups,
      saveFollowups: this.saveFollowups,
      annualReport: () => this.reject("annual"),
      recentFilings: () => this.reject("filings"),
      search: () => this.reject("search"),
      economicCalendar: () => this.reject("calendar"),
      blsCalendar: () => this.reject("calendar"),
      monetaryAnnouncements: () => this.reject("fed"),
      loadValuationAssumptions: refuse,
      saveValuationAssumptions: refuse,
    };
  }
}
/** Complete authored positions, two explicit raw closes, and independent Follow-ups Save only. */
export function createPortfolioCompositionNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const store = new CompositionStore(base);
  return {
    ...base,
    session: store.session,
    portfolio: store.portfolio,
    followups: store.followups,
    priceCoverage: [...base.priceCoverage, store.identities[1]!],
    api: store.api(),
    financialReview: null,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
  };
}
