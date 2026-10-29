import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { ReviewCompletionFixtureDiagnostics } from "./review-check-completion-fixture-diagnostics";
import { createNativeFollowupsReviewReportFixture } from "./native-followups-review-report-fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeResearchFollowupsPayload } from "@research-cockpit/contracts";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { createFixture } from "./fixture";
import {
  completionDueOn,
  completionQuestions,
  completionResult,
  completionUnchosenResult,
} from "./review-check-completion-fixture";

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const workspaces: ManagedWorkspace[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T23:59:00.000Z"));
});
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
  vi.useRealTimers();
});
async function mount(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  fresh = false,
) {
  const workspace = new ManagedWorkspace(
    fixture.api,
    fresh ? fixture.followups!.nextSession() : fixture.session,
    undefined,
    {
      marketsCohort: fixture.marketsCohort,
      researchCoverage: fixture.researchCoverage,
      priceCoverage: fixture.priceCoverage,
    },
  );
  workspaces.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("followups");
  return workspace;
}
async function setup() {
  const fixture = await createFixture("review-check-completion"),
    workspace = await mount(fixture);
  await workspace.followups.coordinator.load();
  for (const [index, member] of workspace.coordinator
    .getSnapshot()
    .draft!.memberships.entries()) {
    workspace.followups.add(member, completionDueOn);
    const entry =
      workspace.followups.coordinator.getSnapshot().draft!.entries[index]!;
    workspace.followups.edit(entry, "check", completionQuestions[index]!);
  }
  const unchosen =
    workspace.followups.coordinator.getSnapshot().draft!.entries[3]!;
  workspace.followups.edit(unchosen, "result", completionUnchosenResult);
  workspace.note(
    "listing-zero",
    "Independent unsaved review note Café 東京 📈",
  );
  const original = structuredClone(
    workspace.followups.coordinator.getSnapshot().draft!,
  );
  const watchlist = workspace.coordinator.getSnapshot();
  const review = workspace.followupsReview;
  expect(review.enter()).toBe(true);
  const rows = review.getSnapshot().rows;
  expect(rows).toHaveLength(4);
  for (const index of [1, 0, 2])
    review.choose(review.getSnapshot(), rows[index]!.handle);
  review.start(review.getSnapshot());
  const prepared = await workspace.prepareFollowupResearch(
    review.getSnapshot().selected!.entry,
  );
  expect(prepared).not.toBeNull();
  workspace.openFollowupResearch(prepared!);
  workspace
    .researchFollowupContext(workspace.getSnapshot().research!.selection)!
    .editAssessment(completionResult);
  workspace.closeResearch();
  const captured = workspace.followups.getSnapshot().assessmentTime!;
  const current = () => review.getSnapshot().selected!.entry;
  workspace.followups.complete(current(), new Date(captured));
  expect(review.getSnapshot()).toMatchObject({
    position: 0,
    phase: "reviewing",
  });
  expect(current()).toMatchObject({
    result: completionResult,
    status: "completed",
    completedOn: "2026-10-29",
  });
  workspace.followups.reopen(current());
  expect(current()).toMatchObject({
    result: completionResult,
    status: "open",
    completedOn: null,
  });
  workspace.followups.complete(current(), new Date(captured));
  review.continue(review.getSnapshot());
  expect(review.getSnapshot()).toMatchObject({ position: 1 });
  expect(current().result).toBe("");
  workspace.followups.complete(current(), new Date(captured));
  review.continue(review.getSnapshot());
  expect(review.getSnapshot()).toMatchObject({ position: 2 });
  review.finish(review.getSnapshot());
  const expected = structuredClone(original) as Mutable<typeof original>;
  for (const index of [0, 1]) {
    expected.entries[index]!.status = "completed";
    expected.entries[index]!.completedOn = "2026-10-29";
  }
  expected.entries[1]!.result = completionResult;
  expect(workspace.followups.coordinator.getSnapshot().draft).toEqual(expected);
  expect(workspace.coordinator.getSnapshot()).toBe(watchlist);
  expect(fixture.getSnapshot()).toMatchObject({
    load: 1,
    marketsResolve: 1,
    resolve: 1,
    save: 0,
    eod: 0,
    annual: 0,
    filings: 0,
  });
  expect(fixture.followups!.getSnapshot()).toMatchObject({
    load: 1,
    save: 0,
    commits: 0,
  });
  return { fixture, workspace, expected };
}
describe("invented chosen-review completion native fixture", () => {
  it("observes an incomplete authored question without throwing or treating it as a valid saved payload", async () => {
    const fixture = await createFixture("review-check-completion"),
      workspace = await mount(fixture);
    await workspace.followups.coordinator.load();
    workspace.followups.add(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      completionDueOn,
    );
    const html = renderToStaticMarkup(
      createElement(ReviewCompletionFixtureDiagnostics, {
        workspace,
        fixture,
        report: createNativeFollowupsReviewReportFixture(),
      }),
    );
    const observed = JSON.parse(
      load(html)("#fixture-review-check-completion").text(),
    ) as {
      followups: { canonical: unknown; raw: { entries: { check: string }[] } };
    };
    expect(observed.followups.canonical).toBeNull();
    expect(observed.followups.raw.entries.map((entry) => entry.check)).toEqual([
      "",
    ]);
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      save: 0,
      commits: 0,
    });
  });
  it("retains raw Unicode, empty-result completion, explicit order, full Save and independent fresh Load", async () => {
    const { fixture, workspace, expected } = await setup();
    await workspace.followups.coordinator.save();
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      save: 1,
      commits: 1,
      version: 1,
    });
    workspace.sessionOwner.dispose();
    const fresh = await mount(fixture, true);
    expect(fresh.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(fresh.followupsReview.getSnapshot().entered).toBe(false);
    await fresh.followups.coordinator.load();
    expect(
      encodeResearchFollowupsPayload(
        fresh.followups.coordinator.getSnapshot().draft!,
      ),
    ).toBe(encodeResearchFollowupsPayload(expected));
    expect(
      fresh.coordinator.getSnapshot().draft!.memberships.map((row) => row.note),
    ).toEqual([
      "",
      "Invented second note",
      "Independent unchosen listing note",
      "Independent unchosen listing note",
    ]);
    expect(fixture.getSnapshot()).toMatchObject({
      load: 2,
      status: 2,
      marketsResolve: 2,
      resolve: 1,
      save: 0,
    });
    expect(fixture.reviewCompletion!.getSnapshot().rejected).toBe(0);
  });
  it.each(["order", "result", "date", "identity", "unchosen", "catalog"])(
    "refuses altered %s before any prefix commits",
    async (field) => {
      const { fixture, expected } = await setup();
      const payload = structuredClone(expected) as Mutable<typeof expected>;
      if (field === "order") payload.entries.reverse();
      if (field === "result")
        payload.entries[1]!.result = "Changed authored result";
      if (field === "date") payload.entries[1]!.completedOn = "2026-10-28";
      if (field === "identity")
        payload.entries[1]!.listing.shareClassId = "foreign-class";
      if (field === "unchosen") payload.entries[3]!.result = "changed";
      if (field === "catalog")
        payload.entries[2]!.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
      expect(() =>
        fixture.api.saveFollowups(
          {
            expectedVersion: 0,
            idempotencyKey: "10000000-0000-4000-8000-000000000001",
            payload,
          },
          new AbortController().signal,
        ),
      ).toThrow();
      expect(fixture.followups!.getSnapshot()).toMatchObject({
        save: 0,
        commits: 0,
        version: 0,
      });
      expect(fixture.reviewCompletion!.getSnapshot().rejected).toBe(1);
    },
  );
  it("refuses an unexpected source read or Watchlist Save and records it", async () => {
    const { fixture } = await setup();
    for (const call of [
      () => fixture.api.annualReport({} as never, new AbortController().signal),
      () => fixture.api.save({} as never, new AbortController().signal),
    ])
      expect(call).toThrow();
    expect(fixture.reviewCompletion!.getSnapshot().rejected).toBe(2);
    expect(fixture.getSnapshot().save).toBe(0);
    expect(fixture.followups!.getSnapshot().save).toBe(0);
  });
  it("refuses a second Save and duplicate fresh Load", async () => {
    const { fixture, workspace, expected } = await setup();
    await workspace.followups.coordinator.save();
    expect(() =>
      fixture.api.saveFollowups(
        {
          expectedVersion: 1,
          idempotencyKey: "10000000-0000-4000-8000-000000000002",
          payload: expected,
        },
        new AbortController().signal,
      ),
    ).toThrow();
    workspace.sessionOwner.dispose();
    const fresh = await mount(fixture, true);
    await fresh.followups.coordinator.load();
    expect(() =>
      fixture.api.loadFollowups(new AbortController().signal),
    ).toThrow();
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      load: 2,
      save: 1,
      commits: 1,
    });
  });
});
