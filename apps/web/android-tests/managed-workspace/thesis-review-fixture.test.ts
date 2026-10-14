import { describe, expect, it } from "vitest";
import { createFixture, thesisReviewNoteDraft } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";

async function setup() {
  const fixture = await createFixture("thesis-review");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    () => "invented-thesis-command",
    {
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
    workspace.note("listing-zero", thesisReviewNoteDraft);
    await workspace.coordinator.save();
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
});
