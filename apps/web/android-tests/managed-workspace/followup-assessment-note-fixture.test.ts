import { afterEach, describe, expect, it } from "vitest";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { createFixture } from "./fixture";
import {
  assessmentNoteGolden,
  assessmentNotePrefix,
} from "./followup-assessment-note-fixture";
import {
  reviewSessionDueOn,
  reviewSessionQuestions,
  reviewSessionResults,
} from "./followups-review-session-fixture";

const recordedAt = "2026-10-25T12:34:56.789Z";
const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
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
  return workspace;
}
async function setup() {
  const fixture = await createFixture("followup-assessment-note");
  const workspace = await mount(fixture);
  workspace.note("listing-zero", assessmentNotePrefix);
  workspace.setView("followups");
  await workspace.followups.coordinator.load();
  for (const [index, member] of workspace.coordinator
    .getSnapshot()
    .draft!.memberships.entries()) {
    workspace.followups.add(member, reviewSessionDueOn);
    const entry =
      workspace.followups.coordinator.getSnapshot().draft!.entries[index]!;
    workspace.followups.edit(entry, "check", reviewSessionQuestions[index]!);
  }
  const model = workspace.followupsReview;
  expect(model.enter()).toBe(true);
  const rows = model.getSnapshot().rows;
  model.choose(model.getSnapshot(), rows[0]!.handle);
  model.choose(model.getSnapshot(), rows[1]!.handle);
  model.start(model.getSnapshot());
  const entry =
    workspace.followups.coordinator.getSnapshot().draft!.entries[0]!;
  const prepared = await workspace.prepareFollowupResearch(entry);
  expect(prepared).not.toBeNull();
  workspace.openFollowupResearch(prepared!);
  const selection = workspace.getSnapshot().research!.selection;
  workspace
    .researchFollowupContext(selection)!
    .editAssessment(reviewSessionResults[0]!);
  return { fixture, workspace };
}
type Opened = Awaited<ReturnType<typeof setup>>;
function watchlistCommand(workspace: ManagedWorkspace) {
  const current = workspace.coordinator.getSnapshot().draft!;
  return {
    expectedVersion: 1,
    idempotencyKey: "10000000-0000-4000-8000-000000000001",
    payload: {
      ...current,
      memberships: current.memberships.map((member, index) =>
        index === 0
          ? { ...member, note: assessmentNoteGolden(recordedAt) }
          : { ...member },
      ),
    },
  };
}
function followupsCommand(workspace: ManagedWorkspace) {
  return {
    expectedVersion: 0,
    idempotencyKey: "10000000-0000-4000-8000-000000000002",
    payload: workspace.followups.coordinator.getSnapshot().draft!,
  };
}
async function saveFollowups({ workspace }: Opened) {
  workspace.closeResearch();
  workspace.followupsReview.finish(workspace.followupsReview.getSnapshot());
  await workspace.followups.coordinator.save();
  expect(workspace.followups.coordinator.getSnapshot().baseVersion).toBe(1);
}

describe("assessment-to-company-note native fixture", () => {
  it("keeps both exact resource saves independent and restores them after a fresh session", async () => {
    const opened = await setup();
    const { fixture, workspace } = opened;
    const entries = structuredClone(
      workspace.followups.coordinator.getSnapshot().draft!,
    );
    expect(fixture.getSnapshot()).toMatchObject({
      load: 1,
      resolve: 1,
      save: 0,
      eod: 0,
      annual: 0,
      filings: 0,
    });
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      load: 1,
      save: 0,
    });
    workspace.note("listing-zero", assessmentNoteGolden(recordedAt));
    await saveFollowups(opened);
    expect(fixture.getSnapshot().save).toBe(0);
    expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
    workspace.setView("watchlist");
    await workspace.coordinator.save();
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 2,
      dirty: false,
    });
    const saved = structuredClone(workspace.coordinator.getSnapshot().draft!);
    workspace.sessionOwner.dispose();
    const fresh = await mount(fixture, true);
    expect(fresh.coordinator.getSnapshot().draft).toEqual(saved);
    expect(fresh.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(fresh.followupsReview.getSnapshot().entered).toBe(false);
    await fresh.followups.coordinator.load();
    expect(fresh.followups.coordinator.getSnapshot().draft).toEqual(entries);
    expect(fixture.getSnapshot()).toMatchObject({
      load: 2,
      status: 2,
      marketsResolve: 2,
      resolve: 1,
      save: 1,
      annual: 0,
      eod: 0,
      filings: 0,
    });
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      load: 2,
      save: 1,
      commits: 1,
    });
    await expect(
      fixture.api.load(new AbortController().signal),
    ).rejects.toThrow("Unexpected invented");
  });
  it.each([
    "prefix",
    "clipped assessment",
    "other note",
    "listing identity",
    "invalid timestamp",
    "version",
  ])(
    "refuses changed Watchlist %s without changing either saved resource",
    async (change) => {
      const opened = await setup();
      await saveFollowups(opened);
      const command = watchlistCommand(opened.workspace);
      const first = command.payload.memberships[0]!;
      if (change === "prefix")
        first.note = first.note.replace(
          assessmentNotePrefix,
          "Different prefix",
        );
      if (change === "clipped assessment")
        first.note = first.note.replace(reviewSessionResults[0]!, "Clipped");
      if (change === "other note")
        command.payload.memberships[1]!.note = "Changed other member";
      if (change === "listing identity") first.shareClassId = "other-class";
      if (change === "invalid timestamp")
        first.note = first.note.replace(recordedAt, "2026-02-30T12:34:56.789Z");
      if (change === "version") command.expectedVersion = 0;
      expect(() =>
        opened.fixture.api.save(command, new AbortController().signal),
      ).toThrow("Unexpected invented");
      expect(opened.fixture.getSnapshot().save).toBe(0);
      expect(opened.fixture.followups!.getSnapshot().commits).toBe(1);
      await expect(
        opened.fixture.api.save(
          watchlistCommand(opened.workspace),
          new AbortController().signal,
        ),
      ).resolves.toMatchObject({ version: 2 });
      expect(() =>
        opened.fixture.api.save(
          watchlistCommand(opened.workspace),
          new AbortController().signal,
        ),
      ).toThrow("Unexpected invented");
    },
  );
  it.each([
    "order",
    "question",
    "assessment",
    "due date",
    "completion",
    "identity",
  ])("refuses changed Follow-ups %s before commit", async (change) => {
    const opened = await setup();
    const original = followupsCommand(opened.workspace);
    const command = {
      ...original,
      payload: {
        ...original.payload,
        entries: original.payload.entries.map((entry) => ({
          ...entry,
          listing: { ...entry.listing },
        })),
      },
    };
    if (change === "order") command.payload.entries.reverse();
    const first = command.payload.entries[0]!;
    if (change === "question") first.check = "Other question";
    if (change === "assessment") first.result = "Other result";
    if (change === "due date") first.dueOn = "2001-01-01";
    if (change === "completion") {
      first.status = "completed";
      first.completedOn = "2026-10-25";
    }
    if (change === "identity") first.listing.shareClassId = "other-class";
    expect(() =>
      opened.fixture.api.saveFollowups(command, new AbortController().signal),
    ).toThrow("Unexpected invented");
    expect(opened.fixture.followups!.getSnapshot()).toMatchObject({
      save: 0,
      commits: 0,
    });
    expect(opened.fixture.getSnapshot().save).toBe(0);
  });
  it("refuses reordered saves, cancelled commands and unsolicited source reads", async () => {
    const opened = await setup();
    const controller = new AbortController();
    expect(() =>
      opened.fixture.api.save(
        watchlistCommand(opened.workspace),
        controller.signal,
      ),
    ).toThrow("Unexpected invented");
    controller.abort();
    expect(() =>
      opened.fixture.api.saveFollowups(
        followupsCommand(opened.workspace),
        controller.signal,
      ),
    ).toThrow("Unexpected invented");
    expect(() =>
      opened.fixture.api.annualReport(
        {} as never,
        new AbortController().signal,
      ),
    ).toThrow("Unexpected invented");
    expect(opened.fixture.getSnapshot().annual).toBe(1);
    expect(() =>
      opened.fixture.api.saveFollowups(
        followupsCommand(opened.workspace),
        new AbortController().signal,
      ),
    ).toThrow("Unexpected invented");
    expect(opened.fixture.followups!.getSnapshot()).toMatchObject({
      save: 0,
      commits: 0,
    });
  });
});
