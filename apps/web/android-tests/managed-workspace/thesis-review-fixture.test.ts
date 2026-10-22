import { describe, expect, it } from "vitest";
import { createFixture, thesisReviewNoteDraft } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import {
  emptyThesisReview,
  proposeThesisReview,
} from "../../src/clerk-trial/managed-thesis-review";
import { groupResearchFollowupsByDueDate } from "../../src/clerk-trial/managed-research-followups-date";

async function setup() {
  const fixture = await createFixture("thesis-review");
  let key = 0;
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    () => `invented-thesis-command-${++key}`,
    {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
    },
  );
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  return {
    fixture,
    workspace,
    initial: structuredClone(workspace.coordinator.getSnapshot().draft!),
  };
}

describe("bounded native thesis-review Save fixture", () => {
  it("admits exactly the complete declared draft and reloads the same note", async () => {
    const { fixture, workspace, initial } = await setup();
    const note = proposeThesisReview("Original thesis", {
      ...emptyThesisReview,
      purpose: "holding_review",
      horizon: "The next two filed reports",
      thesis: "Margins can recover",
      support: "Invented report 2026-10-01",
      counter: "Demand remains uncertain",
      confirm: "Two stronger reported periods",
      invalidate: "Cash keeps falling",
      next: "Read the next filed report",
    }).note;
    expect(note).toBe(
      "Original thesis Thesis review (my assessment). Research purpose: Review a holding | Time horizon: The next two filed reports | My thesis: Margins can recover | Supporting evidence: Invented report 2026-10-01 | Opposing evidence: Demand remains uncertain | Confirmation condition: Two stronger reported periods | Invalidation condition: Cash keeps falling | Next check: Read the next filed report",
    );
    workspace.note("listing-zero", note!);
    await workspace.coordinator.save();
    expect(fixture.getSnapshot().save).toBe(1);
    expect(workspace.coordinator.getSnapshot().saved).toEqual({
      version: 2,
      payload: {
        ...initial,
        memberships: [
          { ...initial.memberships[0]!, note: thesisReviewNoteDraft },
          initial.memberships[1]!,
        ],
      },
    });
    await workspace.coordinator.load();
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe(thesisReviewNoteDraft);
    expect(workspace.coordinator.getSnapshot().draft!.memberships[1]).toEqual(
      initial.memberships[1],
    );
    expect(fixture.getSnapshot()).toMatchObject({
      load: 2,
      status: 1,
      save: 1,
      annual: 0,
      eod: 0,
      marketsEod: 0,
      filings: 0,
      calendar: 0,
      fed: 0,
      token: 0,
      signOut: 0,
    });
  });
  it("refuses a different listing's mutation without changing RAM storage", async () => {
    const { fixture, workspace, initial } = await setup();
    workspace.note("listing-zero", thesisReviewNoteDraft);
    workspace.note("listing-one", "Unexpected other-listing change");
    await workspace.coordinator.save();
    const stored = await fixture.api.load(new AbortController().signal);
    expect(stored).toEqual({ version: 1, payload: initial });
    expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
  });

  it("creates the next check, keeps both saves independent and reloads its completed result", async () => {
    const { fixture, workspace } = await setup();
    workspace.note("listing-zero", thesisReviewNoteDraft);
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    const check = "Read the next filed report";
    expect(
      workspace.followups.prepareNextCheck(member, check, "2020-01-01").capture,
    ).toBeNull();
    expect(fixture.followups!.getSnapshot().load).toBe(0);
    await workspace.followups.coordinator.load();
    const proposal = workspace.followups.prepareNextCheck(
      member,
      check,
      "2020-01-01",
    );
    expect(proposal.reason).toBeNull();
    const created = workspace.followups.createNextCheck(
      proposal.capture!,
      () => true,
    )!;
    expect(created).toMatchObject({
      check,
      dueOn: "2020-01-01",
      status: "open",
      completedOn: null,
      result: "",
    });
    expect(created.listing).not.toHaveProperty("note");
    expect(
      groupResearchFollowupsByDueDate(
        [created],
        new Date("2026-10-21T00:00:00Z"),
      )!.overdue,
    ).toEqual([created]);
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      load: 1,
      save: 0,
      commits: 0,
    });
    await workspace.coordinator.save();
    expect(workspace.coordinator.getSnapshot().dirty).toBe(false);
    expect(workspace.followups.coordinator.getSnapshot()).toMatchObject({
      dirty: true,
      baseVersion: 0,
    });
    await workspace.followups.coordinator.save();
    const current =
      workspace.followups.coordinator.getSnapshot().draft!.entries[0]!;
    workspace.followups.edit(current, "result", "Checked the authored thesis");
    workspace.followups.complete(
      workspace.followups.currentEntry(current.id)!,
      new Date("2026-10-21T00:00:00Z"),
    );
    await workspace.followups.coordinator.save();
    await workspace.followups.coordinator.load();
    expect(workspace.followups.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 2,
      dirty: false,
      draft: {
        entries: [
          {
            id: current.id,
            check,
            result: "Checked the authored thesis",
            status: "completed",
            completedOn: "2026-10-21",
          },
        ],
      },
    });
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe(thesisReviewNoteDraft);
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      load: 2,
      save: 2,
      commits: 2,
    });
    expect(fixture.getSnapshot()).toMatchObject({
      load: 1,
      save: 1,
      annual: 0,
      eod: 0,
      filings: 0,
      resolve: 0,
      token: 0,
    });
  });

  it("refuses an undeclared next check without a RAM commit", async () => {
    const { fixture, workspace } = await setup();
    await workspace.followups.coordinator.load();
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    const proposal = workspace.followups.prepareNextCheck(
      member,
      "Undeclared check",
      "2020-01-01",
    );
    workspace.followups.createNextCheck(proposal.capture!, () => true);
    await workspace.followups.coordinator.save();
    expect(workspace.followups.coordinator.getSnapshot().dirty).toBe(true);
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      save: 0,
      commits: 0,
      version: 0,
    });
  });
});
