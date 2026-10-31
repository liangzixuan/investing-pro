import { afterEach, expect, it, vi } from "vitest";
import { encodeResearchFollowupsPayload } from "@research-cockpit/contracts";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { filingReferenceNoteExcerpt } from "../../src/clerk-trial/managed-filings-note";
import { createFixture } from "./fixture";
import {
  reviewFilingsEntryIds,
  reviewFilingsExpected,
  reviewFilingsIds,
  reviewFilingsCitation,
  reviewFilingsResult,
} from "./review-filings-evidence-fixture-data";
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  owners.splice(0).forEach((w) => w.sessionOwner.dispose());
  vi.useRealTimers();
});
async function setup(load = true) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T12:00:00Z"));
  const fixture = await createFixture("review-filings-evidence"),
    workspace = new ManagedWorkspace(fixture.api, fixture.session, undefined, {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
    });
  owners.push(workspace);
  workspace.setView("followups");
  const meta = fixture.reviewFilingsEvidence!;
  if (load) {
    await workspace.refreshCatalog();
    await workspace.portfolio.coordinator.load();
    await workspace.followups.coordinator.load();
    workspace.setView("portfolio");
    await workspace.portfolio.reviewCatalog();
    workspace.portfolio.applyReview();
    workspace.setView("followups");
  }
  return { fixture, workspace, meta, signal: new AbortController().signal };
}
function start(w: ManagedWorkspace) {
  const intake = w.portfolioHeldDueChecks;
  expect(intake.prepare(intake.getSnapshot())).toBe(true);
  for (const id of reviewFilingsEntryIds.slice(0, 3))
    intake.choose(intake.getSnapshot(), w.followups.currentEntry(id)!);
  expect(
    intake.start(intake.getSnapshot())?.chosen.map((r) => r.entry.id),
  ).toEqual(reviewFilingsEntryIds.slice(0, 3));
}
it("requires independent personal loads and starts three exact held checks without source reads", async () => {
  const f = await setup(false);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBeNull();
  expect(f.meta.getSnapshot()).toMatchObject({
    portfolioLoad: 0,
    filings: 0,
    resolve: 0,
    rejected: 0,
  });
  await f.workspace.refreshCatalog();
  await f.workspace.portfolio.coordinator.load();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  await f.workspace.followups.coordinator.load();
  f.workspace.setView("portfolio");
  await f.workspace.portfolio.reviewCatalog();
  f.workspace.portfolio.applyReview();
  f.workspace.setView("followups");
  start(f.workspace);
  expect(
    f.workspace.reviewFilings
      .getSnapshot()
      .rows.map((r) => r.filings.supported),
  ).toEqual([true, true, false]);
  expect(f.meta.getSnapshot()).toMatchObject({
    filings: 0,
    resolve: 1,
    rejected: 0,
  });
  expect(f.fixture.getSnapshot().marketsResolve).toBe(0);
});
it("keeps literal complete citations independent, with separate clocks and exact shared-issuer share classes", async () => {
  const f = await setup();
  for (let i = 0; i < 2; i++) {
    const p = f.meta.packets[i]!;
    expect(filingReferenceNoteExcerpt(p, p.issuer.filings[0]!, false)).toBe(
      reviewFilingsCitation(i),
    );
    expect(Array.from(reviewFilingsResult(i)).length).toBeLessThanOrEqual(2000);
  }
  expect(f.meta.packets[0]!.security.issuerId).toBe(
    f.meta.packets[1]!.security.issuerId,
  );
  expect(f.meta.packets[0]!.security.shareClassId).not.toBe(
    f.meta.packets[1]!.security.shareClassId,
  );
  expect(f.meta.packets[0]!.completedAt).not.toBe(
    f.meta.packets[1]!.completedAt,
  );
});
it("retains per-check packets through exact seeded Research, assessment, Back, Complete, Continue, Save and fresh loads", async () => {
  const f = await setup(),
    w = f.workspace,
    review = w.followupsReview,
    filings = w.reviewFilings,
    portfolio = w.portfolio.coordinator.getSnapshot();
  start(w);
  const packets = [];
  for (let i = 0; i < 2; i++) {
    expect(filings.getSnapshot().selected?.filings.response).toBeNull();
    await filings.load(filings.getSnapshot());
    const packet = filings.getSnapshot().selected!.filings.response!;
    packets.push(packet);
    expect(packet).toEqual(f.meta.packets[i]);
    expect(f.meta.getSnapshot().filings).toBe(i + 1);
    const prepared = await w.prepareReviewFilingsResearch(
      filings.getSnapshot(),
    );
    expect(prepared).not.toBeNull();
    w.openFollowupResearch(prepared!);
    expect(w.getSnapshot().research?.section).toBe("filings");
    expect(w.filings.getSnapshot().responseOrigin).toBe("followups-review");
    expect(w.filings.getSnapshot().response).toEqual(packet);
    const context = w.researchFollowupContext(
      w.getSnapshot().research!.selection,
    )!;
    expect(context.editAssessment(reviewFilingsResult(i))).not.toBe(false);
    w.closeResearch();
    expect(filings.getSnapshot().selected!.filings.response).toBe(packet);
    expect(f.meta.getSnapshot().filings).toBe(i + 1);
    w.followups.complete(
      w.followups.currentEntry(reviewFilingsEntryIds[i]!)!,
      new Date(),
    );
    expect(filings.getSnapshot().selected!.filings.response).toBe(packet);
    review.continue(review.getSnapshot());
    expect(
      filings
        .getSnapshot()
        .rows.slice(0, i + 1)
        .map((r) => r.filings.response),
    ).toEqual(packets);
  }
  const unsupported = filings.getSnapshot();
  expect(unsupported.selected!.entry.listing.listingId).toBe(
    reviewFilingsIds.mismatch,
  );
  expect(filings.canLoad(unsupported)).toBe(false);
  expect(filings.canInspect(unsupported)).toBe(false);
  await filings.load(unsupported);
  expect(f.meta.getSnapshot().filings).toBe(2);
  w.followups.complete(
    w.followups.currentEntry(reviewFilingsEntryIds[2]!)!,
    new Date(),
  );
  review.finish(review.getSnapshot());
  expect(w.followups.coordinator.getSnapshot().draft).toEqual(
    reviewFilingsExpected(f.meta.original, f.meta.day),
  );
  expect(w.portfolio.coordinator.getSnapshot()).toBe(portfolio);
  expect(f.fixture.followups!.getSnapshot().save).toBe(0);
  await w.followups.coordinator.save();
  expect(f.fixture.followups!.getSnapshot()).toMatchObject({
    save: 1,
    commits: 1,
  });
  w.sessionOwner.dispose();
  const fresh = new ManagedWorkspace(
    f.fixture.api,
    f.fixture.followups!.nextSession(),
    undefined,
    {
      researchCoverage: f.fixture.researchCoverage,
      marketsCohort: f.fixture.marketsCohort,
    },
  );
  owners.push(fresh);
  fresh.setView("followups");
  await fresh.refreshCatalog();
  expect(fresh.reviewFilings.getSnapshot().rows).toEqual([]);
  await fresh.followups.coordinator.load();
  expect(
    encodeResearchFollowupsPayload(
      fresh.followups.coordinator.getSnapshot().draft!,
    ),
  ).toBe(
    encodeResearchFollowupsPayload(
      reviewFilingsExpected(f.meta.original, f.meta.day),
    ),
  );
  await fresh.portfolio.coordinator.load();
  expect(fresh.portfolio.coordinator.getSnapshot().draft?.ledger).toEqual(
    portfolio.draft!.ledger,
  );
  expect(f.meta.getSnapshot()).toMatchObject({
    status: 2,
    portfolioLoad: 2,
    resolve: 3,
    filings: 2,
    rejected: 0,
  });
  expect(f.fixture.getSnapshot()).toMatchObject({
    load: 0,
    save: 0,
    annual: 0,
    eod: 0,
    marketsResolve: 0,
  });
});
it("refuses other share-class requests, unsupported reads and unrequested Markets asynchronously", async () => {
  for (const kind of ["wrong-order", "unsupported", "markets"]) {
    const f = await setup(),
      digest = f.fixture.researchCoverage.catalogSnapshotSha256;
    if (kind === "markets")
      await expect(
        f.fixture.api.resolve(
          {
            snapshotSha256: digest,
            listingIds: f.fixture.marketsCohort.map((r) => r.listingId),
          },
          f.signal,
        ),
      ).rejects.toThrow("Unexpected invented");
    else
      await expect(
        f.fixture.api.recentFilings(
          {
            schemaVersion: "1.0.0",
            catalogSnapshotSha256: digest,
            listingId:
              kind === "wrong-order"
                ? reviewFilingsIds.googl
                : reviewFilingsIds.mismatch,
            symbol: kind === "wrong-order" ? "GOOGL" : "NVDA",
          },
          f.signal,
        ),
      ).rejects.toThrow("Unexpected invented");
    expect(f.meta.getSnapshot()).toMatchObject({ filings: 0, rejected: 1 });
    expect(f.fixture.followups!.getSnapshot().commits).toBe(0);
  }
});
it("refuses duplicate packet fetch, wrong complete Save and any extra financial source", async () => {
  for (const kind of ["duplicate", "save", "annual"]) {
    const f = await setup(),
      digest = f.fixture.researchCoverage.catalogSnapshotSha256;
    await f.fixture.api.recentFilings(
      {
        schemaVersion: "1.0.0",
        catalogSnapshotSha256: digest,
        listingId: reviewFilingsIds.goog,
        symbol: "GOOG",
      },
      f.signal,
    );
    if (kind === "duplicate")
      await expect(
        f.fixture.api.recentFilings(
          {
            schemaVersion: "1.0.0",
            catalogSnapshotSha256: digest,
            listingId: reviewFilingsIds.goog,
            symbol: "GOOG",
          },
          f.signal,
        ),
      ).rejects.toThrow("Unexpected invented");
    else if (kind === "save")
      await expect(
        f.fixture.api.saveFollowups(
          {
            expectedVersion: 7,
            idempotencyKey: "review-filings-wrong-save",
            payload: f.meta.original,
          },
          f.signal,
        ),
      ).rejects.toThrow("Unexpected invented");
    else
      await expect(
        f.fixture.api.annualReport(
          {
            schemaVersion: "6.0.0",
            catalogSnapshotSha256: digest,
            listingId: reviewFilingsIds.goog,
            symbol: "GOOG",
          },
          f.signal,
        ),
      ).rejects.toThrow("Unexpected invented");
    expect(f.meta.getSnapshot().rejected).toBe(1);
    expect(f.fixture.followups!.getSnapshot().commits).toBe(0);
  }
});
