import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
import { ManagedResearchFollowup } from "./ManagedResearchFollowup";
import { ManagedResearchFollowups } from "./ManagedResearchFollowups";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";

const fixtures: Awaited<ReturnType<typeof createFollowupsReviewFixture>>[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});
async function prepareFixture(raw: string) {
  const f = await createFollowupsReviewFixture();
  fixtures.push(f);
  const watchlistSave = vi.spyOn(f.api, "save");
  expect(f.model.enter()).toBe(true);
  f.model.choose(f.model.getSnapshot(), f.model.getSnapshot().rows[0]!.handle);
  f.model.start(f.model.getSnapshot());
  const context = await f.open();
  context.editAssessment(raw);
  return {
    f,
    context,
    watchlistSave,
    selection: f.workspace.getSnapshot().research!.selection,
    before: f.workspace.followups.coordinator.getSnapshot().draft,
  };
}
type Fixture = Awaited<ReturnType<typeof prepareFixture>>;
type Html = ReturnType<typeof load>;
function renderContext({ f, selection }: Fixture): Html {
  return load(
    renderToStaticMarkup(
      <ManagedResearchFollowup
        workspace={f.workspace}
        selection={selection}
        navigationPending={false}
        routeActive={() => true}
        onReview={vi.fn()}
      />,
    ),
  );
}
function expectOriginalAssessment(html: Html, raw: string, invalid: boolean) {
  const assessment = html(".managed-research-followup");
  expect(assessment).toHaveLength(1);
  expect(
    assessment
      .find("button")
      .map((_index, button) => html(button).attr("id"))
      .get(),
  ).toEqual(["managed-research-followup-review"]);
  const field = assessment.find("#managed-research-followup-result");
  expect(field.text()).toBe(raw);
  expect([...field.text()]).toHaveLength([...raw].length);
  expect(field.attr("aria-invalid")).toBe(String(invalid));
  expect(field.attr("readonly")).toBeUndefined();
  expect(field.attr("maxlength")).toBeUndefined();
  expect(assessment.find("#managed-followup-note-preview-action")).toHaveLength(
    0,
  );
}
function expectSeparateNote(html: Html) {
  const note = html(".managed-research-followup-note");
  expect(note).toHaveLength(1);
  expect(note.attr("aria-label")).toBe("Company note assessment");
  expect(note.prev()[0]).toBe(html(".managed-research-followup")[0]);
  expect(note.find("details").attr("open")).toBeUndefined();
  expect(note.find("#managed-followup-note-preview-action")).toHaveLength(1);
}
function expectUnchangedResources(
  { f, context, before, watchlistSave }: Fixture,
  raw: string,
  invalid: boolean,
) {
  const followups = load(
    renderToStaticMarkup(
      <ManagedResearchFollowups
        workspace={f.workspace}
        navigationPending={false}
        onResearch={vi.fn()}
      />,
    ),
  );
  expect(followups("#managed-followups-save").is("[disabled]")).toBe(invalid);
  expect(f.workspace.followups.canSavePayload()).toBe(!invalid);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(before);
  expect(f.workspace.followups.currentEntry(context.entry.id)!.result).toBe(
    raw,
  );
  expect(watchlistSave).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.recentFilings).not.toHaveBeenCalled();
}
it.each([
  {
    name: "valid assessment",
    raw: "  My assessment · Cafe\u0301 東京 😀  ",
    invalid: false,
  },
  {
    name: "oversized invalid assessment",
    raw: "x".repeat(2_001),
    invalid: true,
  },
])(
  "keeps the original contextual controls and a separate note card for $name",
  async ({ raw, invalid }) => {
    const fixture = await prepareFixture(raw);
    const html = renderContext(fixture);
    expectOriginalAssessment(html, raw, invalid);
    expectSeparateNote(html);
    expectUnchangedResources(fixture, raw, invalid);
  },
);
