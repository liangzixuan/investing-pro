import { expect, vi } from "vitest";
import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import {
  ManagedWatchlistResearchPair,
  type WatchlistResearchPairContext,
} from "./managed-watchlist-research-pair";
import type { CompanyReportEvidence } from "./managed-company-report";
import type {
  ManagedResearchVisit,
  ResearchWatchlistState,
} from "./managed-workspace";
import type { CompanyResearchSide } from "./passive-company-research";
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import {
  watchlistScreenListing,
  watchlistScreenAlternate,
  watchlistScreenUncovered,
  watchlistScreenCatalog,
} from "./test-watchlist-screen-selection-fixture";

/** Invented data only; sources run only through the explicit load helper. */
export async function createWatchlistResearchPairFixture() {
  const packet = await annualComparisonResponse("left");
  const listings = [
    watchlistScreenListing,
    watchlistScreenAlternate,
    watchlistScreenUncovered,
  ];
  let draft: MainWatchlistPayload = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: watchlistScreenCatalog.snapshotSha256,
    memberships: listings.map((listing) => ({
      ...listing,
      note: "Thesis 東京 Ω 2.000001",
    })),
  };
  let context: WatchlistResearchPairContext = {
    session: {},
    catalog: watchlistScreenCatalog,
    draft,
    fileEpochs: [0, 0, 0],
    revision: Symbol(),
    reportRevisions: [{}, {}, {}, {}],
    retire: false,
    canStart: true,
    available: true,
  };
  let visit: ManagedResearchVisit | null = null;
  let evidence: CompanyReportEvidence = {
    price: null,
    annual: null,
    interim: null,
    filings: null,
  };
  let watchlistOverride: Partial<ResearchWatchlistState> = {};
  let clock = () => new Date("2026-11-07T12:00:00Z");
  const unexpected = vi.fn(() => {
    throw new Error("Unrequested operation");
  });
  const annualRead = vi.fn(() => Promise.resolve(packet));
  const annual = new ManagedAnnualReport(annualRead, unexpected, undefined, {
    coverage: createManagedResearchCoverageFixture([
      { listing: listings[0]!, cik: packet.security.cik },
    ]),
  });
  const valuation = new ManagedValuationWorkbench();
  const model = new ManagedWatchlistResearchPair({
    readContext: () => context,
    readVisit: () => visit,
    readEvidence: () => evidence,
    readWatchlist: (selection) => ({
      revision: context.revision as symbol,
      member:
        context.draft?.memberships.find(
          (member) => member.listingId === selection.listing.listingId,
        ) ?? null,
      canAdd: false,
      canEdit: context.available,
      reason: null,
      ...watchlistOverride,
    }),
    valuation,
    now: () => clock(),
  });
  const choose = (right = 2) => {
    model.select(model.getSnapshot(), model.getSnapshot().memberships[0]!);
    model.select(model.getSnapshot(), model.getSnapshot().memberships[right]!);
    expect(model.preview(model.getSnapshot())).not.toBeNull();
    expect(model.start(model.getSnapshot())).not.toBeNull();
  };
  const open = (side: CompanyResearchSide) => {
    const token = model.prepareOpen(model.getSnapshot(), side)!;
    expect(token).not.toBeNull();
    visit = { selection: token.selection, section: "annual" };
    evidence = { price: null, annual: null, interim: null, filings: null };
    valuation.activate(visit.selection);
    model.reconcile();
    expect(model.commitOpen(token, visit)).toBe(true);
    return visit;
  };
  const back = () => {
    expect(model.ownedBack(visit!)).toBe(true);
    visit = null;
    valuation.activate(null);
    model.reconcile();
  };
  return {
    model,
    valuation,
    packet,
    listings,
    annualRead,
    unexpected,
    choose,
    open,
    back,
    getContext: () => context,
    getVisit: () => visit!,
    getEvidence: () => evidence,
    setContext: (
      next: Partial<WatchlistResearchPairContext>,
      reconcile = true,
    ) => {
      context = { ...context, ...next };
      if (reconcile) model.reconcile();
    },
    setVisit: (next: ManagedResearchVisit | null, reconcile = true) => {
      visit = next;
      if (reconcile) model.reconcile();
    },
    setEvidence: (next: CompanyReportEvidence) => {
      evidence = next;
      model.reconcile();
    },
    setWatchlist: (next: Partial<ResearchWatchlistState>) => {
      watchlistOverride = next;
      model.reconcile();
    },
    setClock: (next: () => Date) => {
      clock = next;
    },
    note: (note: string) => {
      draft = {
        ...context.draft!,
        memberships: context.draft!.memberships.map((member) => ({
          ...member,
          note,
        })),
      };
      context = { ...context, draft, revision: Symbol() };
      model.reconcile();
    },
    loadAnnual: async () => {
      annual.open(visit!.selection);
      await annual.load();
      evidence = { ...evidence, annual: annual.getSnapshot() };
      model.reconcile();
    },
  };
}
