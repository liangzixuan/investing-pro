import { expect, vi } from "vitest";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { heldDueFixture } from "./test-portfolio-held-due-fixture";
import {
  portfolioScreenLedger,
  portfolioScreenCatalog,
} from "./test-portfolio-screen-selection-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { eodResponse } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import { annualReportPacket } from "./test-annual-report-fixture";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../lib/test-personal-sec-annual-api-fixture";
import { buildInterimFixture } from "../../android-tests/managed-workspace/interim-report-packet";

/** Invented real-workspace fixture; no Watchlist Load is needed for due checks. */
export async function sourceConnectedFixture() {
  const base = await heldDueFixture(false, true);
  const untouched = {
    ...base.stored().payload.entries[0]!,
    id: "00000000-0000-4000-8000-000000000099",
    listing: {
      ...base.stored().payload.entries[0]!.listing,
      listingId: "listing-unchosen-future",
      securityId: "security-unchosen-future",
    },
    check: "Unchosen future check · preserve complete text",
    result: "Unrelated authored result stays",
    dueOn: "2027-01-01",
  };
  // Seed invented RAM before product operations; fresh Load reads the saved value unchanged.
  await base.api.saveFollowups(
    {
      expectedVersion: base.stored().version,
      idempotencyKey: "invented-source-review-seed",
      payload: {
        schemaVersion: 1,
        entries: [
          ...base.stored().payload.entries.map((entry) => ({
            ...entry,
            dueOn: "2026-10-29",
          })),
          untouched,
        ],
      },
    },
    new AbortController().signal,
  );
  vi.mocked(base.api.saveFollowups).mockClear();
  const listings = portfolioScreenLedger.identities;
  const catalog = portfolioScreenCatalog.snapshotSha256;
  const annual = await Promise.all(
    listings.slice(0, 2).map(async (listing) => {
      const packet = structuredClone(
        await annualReportPacket("left", { mode: "exact-decimal" }),
      ) as TestAnnualPacket;
      packet.security = {
        country: listing.country,
        exchangeMic: listing.exchangeMic,
        issuerId: listing.issuerId,
        issuerName: listing.issuerName,
        listingId: listing.listingId,
        securityName: listing.securityName,
        symbol: listing.symbol,
        cik: "0000000001",
      };
      return bindAnnualPacket(packet);
    }),
  );
  const interim = await Promise.all(
    annual.map((packet) =>
      buildInterimFixture({
        catalogSnapshotSha256: catalog,
        security: packet.security,
      }),
    ),
  );
  const packetIndex = (listingId: string) => {
    const index = listings
      .slice(0, 2)
      .findIndex((listing) => listing.listingId === listingId);
    if (index < 0)
      throw new Error("Unexpected unsupported fixture source request");
    return index;
  };
  const api: ManagedApi = {
    ...base.api,
    loadFollowups: vi.fn(base.api.loadFollowups),
    eodHistory: vi.fn<ManagedApi["eodHistory"]>((request) =>
      Promise.resolve({
        ...eodResponse(request.range),
        catalogSnapshotSha256: catalog,
        security: listings[packetIndex(request.listingId)]!,
      }),
    ),
    annualReport: vi.fn<ManagedApi["annualReport"]>((request) =>
      Promise.resolve(annual[packetIndex(request.listingId)]!),
    ),
    interimReport: vi.fn<ManagedApi["interimReport"]>((request) =>
      Promise.resolve(interim[packetIndex(request.listingId)]!),
    ),
    recentFilings: vi.fn<ManagedApi["recentFilings"]>((request) =>
      Promise.resolve(
        filingsResponse(3, "available", {
          listing: listings[packetIndex(request.listingId)]!,
          catalogSnapshotSha256: catalog,
          cik: "0000000001",
          origin: "followups",
        }),
      ),
    ),
  };
  const instances: ManagedWorkspace[] = [];
  const make = () => {
    const workspace = new ManagedWorkspace(
      api,
      {
        userId: "invented-evidence-owner",
        sessionId: `invented-evidence-${instances.length}`,
        getToken: vi.fn(),
        signOut: vi.fn(async () => {}),
      },
      undefined,
      {
        priceCoverage: listings.slice(0, 2),
        researchCoverage: createManagedResearchCoverageFixture(
          listings
            .slice(0, 2)
            .map((listing) => ({ listing, cik: "0000000001" })),
        ),
        interimIssuers: ["0000000001"],
      },
    );
    instances.push(workspace);
    return workspace;
  };
  const workspace = make();
  await workspace.refreshCatalog();
  workspace.setView("followups");
  await workspace.followups.coordinator.load();
  const review = workspace.followupsReview;
  const start = () => {
    expect(review.enter()).toBe(true);
    const rows = review.getSnapshot().rows;
    expect(rows).toHaveLength(3);
    for (const index of [1, 0, 2])
      review.choose(review.getSnapshot(), rows[index]!.handle);
    review.start(review.getSnapshot());
  };
  const open = async () => {
    const entry = review.captureCurrent(review.getSnapshot())!;
    const prepared = await workspace.prepareFollowupResearch(entry);
    expect(prepared).not.toBeNull();
    workspace.openFollowupResearch(prepared!);
    const visit = workspace.getSnapshot().research!;
    expect(visit).not.toBeNull();
    return visit;
  };
  const run = async () => {
    const visit = workspace.getSnapshot().research!;
    const preview = workspace.prepareCompanySourcePass(visit, [
      "eod",
      "annual",
      "filings",
      "interim",
    ]);
    expect(preview).not.toBeNull();
    await workspace.runCompanySourcePass(visit, preview!);
  };
  const capture = () => {
    const installed = workspace.captureFollowupEvidence(
      workspace.reviewEvidence.getSnapshot(),
    );
    expect(
      installed,
      workspace.reviewEvidence.getSnapshot().reason ?? "no reason",
    ).not.toBeNull();
    return installed!.selected!.reading!;
  };
  return {
    workspace,
    review,
    api,
    annual,
    interim,
    listings,
    untouched,
    make,
    start,
    open,
    run,
    capture,
    dispose: () => {
      instances.forEach((w) => w.sessionOwner.dispose());
      base.dispose();
    },
  };
}
