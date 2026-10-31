import { afterEach, expect, it, vi } from "vitest";
import { encodeResearchFollowupsPayload } from "@research-cockpit/contracts";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { prepareManagedPortfolioFollowupsPlan } from "../../src/clerk-trial/managed-portfolio-followups-plan";
import { createFixture } from "./fixture";
import {
  heldDueAssessment,
  heldDueEntryIds,
  heldDueExpected,
  heldDueIds,
} from "./portfolio-held-due-checks-fixture-data";
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  owners.splice(0).forEach((w) => w.sessionOwner.dispose());
  vi.useRealTimers();
});
async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T12:00:00Z"));
  const fixture = await createFixture("portfolio-held-due-checks"),
    workspace = new ManagedWorkspace(fixture.api, fixture.session, undefined, {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
    });
  owners.push(workspace);
  workspace.setView("followups");
  return {
    fixture,
    workspace,
    meta: fixture.portfolioHeldDueChecks!,
    signal: new AbortController().signal,
  };
}
async function loaded() {
  const f = await setup();
  await f.workspace.refreshCatalog();
  await f.workspace.portfolio.coordinator.load();
  await f.workspace.followups.coordinator.load();
  f.workspace.setView("portfolio");
  await f.workspace.portfolio.reviewCatalog();
  f.workspace.portfolio.applyReview();
  f.workspace.setView("followups");
  expect(f.fixture.getSnapshot().marketsResolve).toBe(0);
  return f;
}
it("keeps both personal resources unloaded until independent explicit loads", async () => {
  const f = await setup();
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
  expect(f.meta.getSnapshot()).toMatchObject({
    status: 0,
    portfolioLoad: 0,
    resolve: 0,
    rejected: 0,
  });
  await f.workspace.refreshCatalog();
  expect(f.meta.getSnapshot()).toMatchObject({
    status: 1,
    portfolioLoad: 0,
    resolve: 0,
    rejected: 0,
  });
});
it("derives the exact two held-share-class entries without erasing excluded checks or raw holdings", async () => {
  const f = await loaded(),
    w = f.workspace,
    p = w.portfolio.coordinator.getSnapshot(),
    saved = w.followups.coordinator.getSnapshot(),
    plan = prepareManagedPortfolioFollowupsPlan({
      projection: w.portfolio.getProjection(),
      context: w.followups.getReviewContext(),
    });
  expect(plan.status).toBe("ready");
  expect(plan.assessedOn).toBe(f.meta.day);
  expect(plan.eligible.map((e) => e.id)).toEqual(heldDueEntryIds.slice(0, 2));
  expect(plan.checks.map((r) => [r.identity, r.due, r.eligible])).toEqual([
    ["matched", "overdue", true],
    ["matched", "today", true],
    ["matched", "later", false],
    ["matched", "completed", false],
    ["not_held", "overdue", false],
    ["mismatch", "overdue", false],
    ["mismatch", "overdue", false],
  ]);
  expect(plan.holdings.map((r) => r.holding.shares)).toEqual([
    "1.000001",
    "0.750001",
    "2",
    "3",
    "4",
    "5",
    "6",
  ]);
  expect(plan.holdings[2]!.checks).toHaveLength(0);
  expect(plan.checks.map((r) => r.entry)).toEqual(f.meta.original.entries);
  expect(w.portfolio.coordinator.getSnapshot()).toBe(p);
  expect(w.followups.coordinator.getSnapshot()).toBe(saved);
  expect(f.meta.getSnapshot()).toMatchObject({
    portfolioLoad: 1,
    resolve: 1,
    rejected: 0,
  });
});
it("atomically admits explicit reverse order and does not request a source or write a resource", async () => {
  const f = await loaded(),
    w = f.workspace,
    context = w.followups.getReviewContext()!,
    portfolio = w.portfolio.coordinator.getSnapshot(),
    draft = w.followups.coordinator.getSnapshot();
  const observed: string[][] = [];
  const unsubscribe = w.followupsReview.subscribe(() => {
    const s = w.followupsReview.getSnapshot();
    if (s.phase === "reviewing")
      observed.push(s.chosen.map((row) => row.entry.id));
  });
  const admitted = w.followupsReview.admitOrdered(
    context,
    [context.draft.entries[1]!, context.draft.entries[0]!],
    () => true,
  );
  unsubscribe();
  expect(admitted).not.toBeNull();
  expect(observed).toEqual([[heldDueEntryIds[1], heldDueEntryIds[0]]]);
  expect(w.portfolio.coordinator.getSnapshot()).toBe(portfolio);
  expect(w.followups.coordinator.getSnapshot()).toBe(draft);
  expect(f.meta.getSnapshot()).toMatchObject({ resolve: 1, rejected: 0 });
  expect(f.fixture.followups!.getSnapshot()).toMatchObject({
    save: 0,
    commits: 0,
  });
});
it("admits one whole expected Save and fresh Load; refuses an unintended second Research and other reads asynchronously", async () => {
  const f = await loaded(),
    digest = f.fixture.researchCoverage.catalogSnapshotSha256;
  await f.fixture.api.resolve(
    { snapshotSha256: digest, listingIds: [heldDueIds.googl] },
    f.signal,
  );
  const payload = heldDueExpected(f.meta.original, f.meta.day);
  const receipt = await f.fixture.api.saveFollowups(
    {
      expectedVersion: 7,
      idempotencyKey: "held-due-fixture-save-0001",
      payload,
    },
    f.signal,
  );
  expect(receipt.version).toBe(8);
  f.workspace.sessionOwner.dispose();
  f.fixture.followups!.nextSession();
  const read = await f.fixture.api.loadFollowups(f.signal);
  expect(encodeResearchFollowupsPayload(read.payload)).toBe(
    encodeResearchFollowupsPayload(payload),
  );
  expect(f.meta.getSnapshot()).toMatchObject({
    portfolioLoad: 1,
    resolve: 2,
    rejected: 0,
  });
  expect(f.fixture.followups!.getSnapshot()).toMatchObject({
    load: 2,
    save: 1,
    commits: 1,
  });
  await expect(
    f.fixture.api.resolve(
      { snapshotSha256: digest, listingIds: [heldDueIds.googl] },
      f.signal,
    ),
  ).rejects.toThrow("Unexpected invented");
  await expect(f.fixture.api.load(f.signal)).rejects.toThrow(
    "Unexpected invented",
  );
});

it("completes the real held-intake ownership journey, strict whole Save and independent fresh loads", async () => {
  const f = await loaded(),
    w = f.workspace,
    intake = w.portfolioHeldDueChecks,
    review = w.followupsReview,
    portfolio = w.portfolio.coordinator.getSnapshot();
  expect(intake.prepare(intake.getSnapshot())).toBe(true);
  intake.choose(
    intake.getSnapshot(),
    w.followups.currentEntry(heldDueEntryIds[1]!)!,
  );
  intake.choose(
    intake.getSnapshot(),
    w.followups.currentEntry(heldDueEntryIds[0]!)!,
  );
  const installed = intake.start(intake.getSnapshot());
  expect(installed?.chosen.map((row) => row.entry.id)).toEqual([
    heldDueEntryIds[1],
    heldDueEntryIds[0],
  ]);
  const current = review.captureCurrent(review.getSnapshot())!,
    prepared = await w.prepareFollowupResearch(current);
  expect(prepared).not.toBeNull();
  w.openFollowupResearch(prepared!);
  const context = w.researchFollowupContext(
    w.getSnapshot().research!.selection,
  )!;
  expect(context.editAssessment(heldDueAssessment)).not.toBe(false);
  w.closeResearch();
  expect(review.getSnapshot().selected?.entry.id).toBe(heldDueEntryIds[1]);
  w.followups.complete(
    w.followups.currentEntry(heldDueEntryIds[1]!)!,
    new Date(),
  );
  review.continue(review.getSnapshot());
  expect(review.getSnapshot().selected?.entry.id).toBe(heldDueEntryIds[0]);
  w.followups.complete(
    w.followups.currentEntry(heldDueEntryIds[0]!)!,
    new Date(),
  );
  review.finish(review.getSnapshot());
  expect(
    encodeResearchFollowupsPayload(
      w.followups.coordinator.getSnapshot().draft!,
    ),
  ).toBe(
    encodeResearchFollowupsPayload(
      heldDueExpected(f.meta.original, f.meta.day),
    ),
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
  await fresh.followups.coordinator.load();
  expect(fresh.followups.coordinator.getSnapshot().draft).toEqual(
    heldDueExpected(f.meta.original, f.meta.day),
  );
  expect(fresh.followupsReview.getSnapshot().entered).toBe(false);
  expect(fresh.portfolio.coordinator.getSnapshot().draft).toBeNull();
  await fresh.portfolio.coordinator.load();
  expect(fresh.portfolio.coordinator.getSnapshot().draft?.ledger).toEqual(
    portfolio.draft!.ledger,
  );
  expect(f.fixture.getSnapshot().marketsResolve).toBe(0);
  expect(f.meta.getSnapshot()).toMatchObject({
    status: 2,
    portfolioLoad: 2,
    resolve: 2,
    rejected: 0,
  });
  expect(f.fixture.followups!.getSnapshot()).toMatchObject({
    load: 2,
    save: 1,
    commits: 1,
  });
});

it("refuses an unrequested Markets resolution while Follow-ups owns the route", async () => {
  const f = await loaded();
  expect(f.workspace.getSnapshot().view).toBe("followups");
  expect(f.fixture.getSnapshot().marketsResolve).toBe(0);
  await expect(
    f.fixture.api.resolve(
      {
        snapshotSha256: f.fixture.researchCoverage.catalogSnapshotSha256,
        listingIds: f.fixture.marketsCohort.map((row) => row.listingId),
      },
      f.signal,
    ),
  ).rejects.toThrow("one exact chosen Research resolution");
  expect(f.fixture.getSnapshot().marketsResolve).toBe(0);
  expect(f.meta.getSnapshot()).toMatchObject({ resolve: 1, rejected: 1 });
  expect(f.fixture.followups!.getSnapshot()).toMatchObject({
    save: 0,
    commits: 0,
  });
});
