import { expect, vi } from "vitest";
import { ManagedAnnualReport } from "./managed-annual-report";
import type { ManagedApi } from "./managed-api";
import { ManagedFinancialScreen } from "./managed-financial-screen";
import { ManagedScreenResearchReview } from "./managed-screen-research-review";
import { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import type { CompanyReportEvidence } from "./managed-company-report";
import type {
  ManagedResearchVisit,
  ResearchWatchlistState,
} from "./managed-workspace";
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { eodSelection } from "./eod-history-fixture";
export async function createScreenResearchReviewFixture() {
  const packets = await Promise.all([
    annualComparisonResponse("left"),
    annualComparisonResponse("right"),
  ]);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
  const listings = [
    eodSelection.listing,
    {
      ...eodSelection.listing,
      listingId: "listing-one",
      issuerId: "issuer-one",
      issuerName: "One Company",
      securityId: "security-one",
      securityName: "One Class A",
      shareClassId: "class-one",
      symbol: "ONE",
    },
  ];
  const digest = packets[0].catalogSnapshotSha256;
  const annualReport = vi
    .fn<ManagedApi["annualReport"]>()
    .mockImplementation((request) =>
      Promise.resolve(
        packets.find((p) => p.security.listingId === request.listingId)!,
      ),
    );
  const resolve = vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
    Promise.resolve({
      snapshotSha256: request.snapshotSha256,
      results: request.listingIds.map((listingId) => ({
        listingId,
        listing: listings.find((l) => l.listingId === listingId)!,
      })),
    }),
  );
  const coverage = createManagedResearchCoverageFixture(
    listings.map((listing, i) => ({ listing, cik: packets[i]!.security.cik })),
  );
  const screen = new ManagedFinancialScreen(
    { resolve, annualReport },
    vi.fn(),
    undefined,
    { listingIds: listings.map((l) => l.listingId), coverage },
  );
  screen.reconcile(digest, true, true);
  await screen.loadUniverse(screen.getSnapshot());
  const run = screen.run(screen.getSnapshot());
  await vi.advanceTimersByTimeAsync(20_000);
  await run;
  const rows = screen.getSnapshot().run!.rows;
  screen.selectComparison(screen.getSnapshot(), "left", rows[0]!);
  screen.selectComparison(screen.getSnapshot(), "right", rows[1]!);
  const valuation = new ManagedValuationWorkbench();
  let visit: ManagedResearchVisit | null = null;
  let evidence: CompanyReportEvidence = {
    price: null,
    annual: null,
    interim: null,
    filings: null,
  };
  let watchlist: ResearchWatchlistState = {
    revision: Symbol(),
    member: null,
    canAdd: true,
    canEdit: false,
    reason: null,
  };
  let available = true;
  let now = () => new Date();
  const model = new ManagedScreenResearchReview(screen, {
    readVisit: () => visit,
    readEvidence: () => evidence,
    readWatchlist: () => watchlist,
    valuation,
    available: () => available,
    now: () => now(),
  });
  const reportCapture = (side: number) => ({
    run: screen.getSnapshot().run!,
    row: rows[side]!,
    response: rows[side]!.report!.response!,
  });
  const annual = new ManagedAnnualReport(annualReport, vi.fn(), undefined, {
    coverage,
  });
  const open = async (side: number) => {
    const capture = reportCapture(side);
    const pending = model.prepareOpen(capture)!;
    const handoff = screen.admitReport(capture)!;
    screen.reconcile(digest, false, false);
    annual.open(handoff.selection, handoff.seed);
    await vi.waitFor(() =>
      expect(annual.getSnapshot().checkingSeed).toBe(false),
    );
    visit = { selection: annual.getSnapshot().selection!, section: "annual" };
    evidence = {
      price: null,
      annual: annual.getSnapshot(),
      interim: null,
      filings: null,
    };
    valuation.activate(visit.selection);
    model.reconcile(); // The source/visit publications precede commit.
    expect(model.commitOpen(pending, visit)).toBe(true);
    return visit;
  };
  const back = () => {
    expect(model.ownedBack(visit!)).toBe(true);
    visit = null;
    valuation.activate(null);
    model.reconcile();
    screen.reconcile(digest, true, true);
    model.reconcile();
  };
  return {
    packets,
    model,
    screen,
    valuation,
    open,
    back,
    rows,
    annualReport,
    resolve,
    reportCapture,
    getVisit: () => visit!,
    setVisit: (v: ManagedResearchVisit | null) => {
      visit = v;
    },
    getEvidence: () => evidence,
    setEvidence: (v: CompanyReportEvidence) => {
      evidence = v;
      model.reconcile();
    },
    setWatchlist: (v: Partial<ResearchWatchlistState>) => {
      watchlist = { ...watchlist, ...v };
      model.reconcile();
    },
    setAvailable: (v: boolean) => {
      available = v;
      model.reconcile();
    },
    setClock: (v: () => Date) => {
      now = v;
    },
  };
}
