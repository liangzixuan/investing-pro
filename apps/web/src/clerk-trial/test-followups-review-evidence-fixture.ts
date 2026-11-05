import { expect, vi } from "vitest";
import type {
  ManagedResearchFollowupsDto,
  ResearchFollowup,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedInterimReport } from "./managed-interim-report";
import { ManagedCompanySnapshotLoad } from "./managed-company-snapshot-load";
import { ManagedCompanySourcePass } from "./managed-company-source-pass";
import { ManagedSecAccess } from "./managed-sec-access";
import { ManagedResearchFollowups } from "./managed-research-followups";
import { ManagedFollowupsReviewSession } from "./managed-followups-review-session";
import { ManagedFollowupsReviewEvidence } from "./managed-followups-review-evidence";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedResearchVisit } from "./managed-workspace";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { annualReportPacket } from "./test-annual-report-fixture";
import { buildInterimFixture } from "../../android-tests/managed-workspace/interim-report-packet";
import { filingsResponse } from "./sec-filings-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";

export async function createFollowupsEvidenceFixture() {
  const annualPacket = await annualReportPacket();
  const interimPacket = await buildInterimFixture(annualPacket);
  const listings = [
    eodSelection.listing,
    {
      ...eodSelection.listing,
      listingId: "listing-class-c",
      securityId: "security-class-c",
      securityName: "Zero Class C",
      shareClassId: "class-c",
      shareClassName: "Class C",
      symbol: "ZEROC",
    },
    {
      ...eodSelection.listing,
      listingId: "listing-unsupported",
      issuerId: "issuer-unsupported",
      securityId: "security-unsupported",
      symbol: "NONE",
    },
  ];
  const entries: ResearchFollowup[] = listings.map((listing, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    listing,
    catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
    check: `Inspect all original facts ${i}: Café 東京 📈`,
    dueOn: "2026-11-03",
    status: "open",
    completedOn: null,
    result: `Original ${i}`,
  }));
  let stored: ManagedResearchFollowupsDto = {
    version: 4,
    payload: { schemaVersion: 1, entries },
  };
  const api = {
    loadFollowups: vi
      .fn<ManagedApi["loadFollowups"]>()
      .mockImplementation(() => Promise.resolve(stored)),
    saveFollowups: vi
      .fn<ManagedApi["saveFollowups"]>()
      .mockImplementation((command) => {
        stored = {
          version: command.expectedVersion + 1,
          payload: command.payload,
        };
        return Promise.resolve({ ...stored, replayed: false });
      }),
    resolve: vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: listings.find((l) => l.listingId === listingId)!,
        })),
      }),
    ),
  };
  const followups = new ManagedResearchFollowups(
    api,
    {
      userId: "invented",
      sessionId: "invented",
      getToken: vi.fn(),
      signOut: vi.fn(),
    },
    {
      getCreationContext: () => ({
        draft: null,
        catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
      }),
      onRetire: vi.fn(),
      newKey: () => "invented-save",
    },
  );
  followups.syncCatalog(eodSelection.catalogSnapshotSha256);
  await followups.coordinator.load();
  followups.reassessDueDate(new Date("2026-11-04T12:00:00Z"));
  const review = new ManagedFollowupsReviewSession(followups);
  review.setAvailable(true);
  expect(review.enter()).toBe(true);
  for (const row of review.getSnapshot().rows)
    review.choose(review.getSnapshot(), row.handle);
  review.start(review.getSnapshot());
  const readPrice = vi.fn<ManagedApi["eodHistory"]>().mockImplementation((r) =>
    Promise.resolve({
      ...eodResponse(r.range),
      security: listings.find((l) => l.listingId === r.listingId)!,
    }),
  );
  const readAnnual = vi
    .fn<ManagedApi["annualReport"]>()
    .mockResolvedValue(annualPacket);
  const readFilings = vi
    .fn<ManagedApi["recentFilings"]>()
    .mockImplementation((r) =>
      Promise.resolve(
        filingsResponse(2, "available", {
          ...eodSelection,
          origin: "followups",
          listing: listings.find((l) => l.listingId === r.listingId)!,
        }),
      ),
    );
  const readInterim = vi
    .fn<ManagedApi["interimReport"]>()
    .mockResolvedValue(interimPacket);
  const access = new ManagedSecAccess();
  const coverage = createManagedResearchCoverageFixture(
    listings
      .slice(0, 2)
      .map((listing) => ({ listing, cik: eodSelection.cik! })),
  );
  const price = new ManagedEodHistory(
    readPrice,
    vi.fn(),
    undefined,
    listings.slice(0, 2),
  );
  const annual = new ManagedAnnualReport(readAnnual, vi.fn(), access, {
    coverage,
  });
  const filings = new ManagedCompanyFilings(readFilings, vi.fn(), access, {
    coverage,
    compareRefresh: true,
  });
  const interim = new ManagedInterimReport(readInterim, vi.fn(), access, {
    coverage,
    interimIssuers: [eodSelection.cik!],
  });
  const sources = [price, annual, filings, interim];
  const loader = new ManagedCompanySnapshotLoad(
    price,
    annual,
    filings,
    interim,
  );
  const pass = new ManagedCompanySourcePass(
    loader,
    price,
    annual,
    filings,
    interim,
  );
  let visit: ManagedResearchVisit | null = null;
  let available = true;
  let clock = () => new Date("2026-11-04T13:30:00.000Z");
  const evidence = (selection: ManagedResearchSelection) =>
    companySnapshotEvidence(
      selection,
      price.getSnapshot(),
      annual.getSnapshot(),
      filings.getSnapshot(),
      interim.getSnapshot(),
    );
  const model = new ManagedFollowupsReviewEvidence(review, followups, {
    readVisit: () => visit,
    readEvidence: evidence,
    readSourcePass: pass.getSnapshot,
    available: () => available,
    now: () => clock(),
  });
  const off = [...sources, pass].map((s) => s.subscribe(model.reconcile));
  const open = () => {
    const state = review.getSnapshot();
    const selection: ManagedResearchSelection = {
      listing: state.selected!.entry.listing,
      catalogSnapshotSha256: state.selected!.entry.catalogSnapshotSha256,
      origin: "followups",
      cik: eodSelection.cik,
    };
    const pending = model.prepareOpen(state, selection);
    expect(pending).not.toBeNull();
    pass.clear();
    for (const source of sources) source.open(selection);
    visit = { selection: price.getSnapshot().selection!, section: "eod" };
    review.setAvailable(false);
    expect(model.commitOpen(pending!, visit)).toBe(true);
    return visit;
  };
  const back = () => {
    expect(model.ownedBack(visit!)).toBe(true);
    visit = null;
    pass.clear();
    for (const source of sources) source.close();
    review.setAvailable(true);
    model.reconcile();
  };
  return {
    model,
    review,
    followups,
    api,
    entries,
    sources,
    price,
    annual,
    filings,
    interim,
    loader,
    pass,
    readPrice,
    readAnnual,
    readFilings,
    readInterim,
    evidence,
    open,
    back,
    visit: () => visit,
    setVisit: (next: ManagedResearchVisit | null) => {
      visit = next;
      model.reconcile();
    },
    setAvailable: (next: boolean) => {
      available = next;
      model.reconcile();
    },
    setClock: (next: () => Date) => {
      clock = next;
    },
    dispose: () => {
      off.forEach((f) => f());
      model.retire();
      review.retire();
      followups.retire();
      sources.forEach((s) => s.retire());
    },
  };
}
