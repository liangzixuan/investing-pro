import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  membershipMatchesResult,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { createFixture } from "./fixture";
import {
  reviewSessionDueOn,
  reviewSessionQuestions,
  reviewSessionResults,
} from "./followups-review-session-fixture";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { ManagedCompanyEvidenceActions } from "../../src/clerk-trial/ManagedCompanyEvidenceActions";
import type { ManagedResearchSelection } from "../../src/clerk-trial/managed-research-selection";

const workspaces: ManagedWorkspace[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T12:00:00.000Z"));
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
  const fixture = await createFixture("followups-review-session");
  const workspace = await mount(fixture);
  expect(fixture.getSnapshot()).toMatchObject({
    marketsResolve: 1,
    resolve: 0,
    load: 1,
    save: 0,
    eod: 0,
    annual: 0,
    filings: 0,
  });
  expect(fixture.followups!.getSnapshot()).toMatchObject({ load: 0, save: 0 });
  await workspace.followups.coordinator.load();
  const members = workspace.coordinator.getSnapshot().draft!.memberships;
  expect(members.map((row) => row.listingId)).toEqual([
    "listing-zero",
    "listing-one",
    "listing-alfa",
  ]);
  for (const [index, member] of members.entries()) {
    workspace.followups.add(member, reviewSessionDueOn);
    const entry =
      workspace.followups.coordinator.getSnapshot().draft!.entries[index]!;
    workspace.followups.edit(entry, "check", reviewSessionQuestions[index]!);
  }
  const unchosen =
    workspace.followups.coordinator.getSnapshot().draft!.entries[2]!;
  workspace.followups.edit(unchosen, "result", reviewSessionResults[2]!);
  return { fixture, workspace };
}
type Opened = Awaited<ReturnType<typeof setup>>;
function chooseTwo(workspace: ManagedWorkspace) {
  const model = workspace.followupsReview;
  expect(model.enter()).toBe(true);
  const rows = model.getSnapshot().rows;
  expect(rows.map((row) => row.entry.listing.symbol)).toEqual([
    "ZERO",
    "ONE",
    "ALFA",
  ]);
  model.choose(model.getSnapshot(), rows[0]!.handle);
  model.choose(model.getSnapshot(), rows[1]!.handle);
  expect(model.getSnapshot().chosen.map((row) => row.entry.check)).toEqual(
    reviewSessionQuestions.slice(0, 2),
  );
  model.start(model.getSnapshot());
  return rows;
}
function assertUnloadedCompanySources(
  workspace: ManagedWorkspace,
  selection: ManagedResearchSelection,
) {
  const models = [
    workspace.eod,
    workspace.annual,
    workspace.filings,
    workspace.interim,
  ];
  const before = models.map((model) => model.getSnapshot());
  const onRequest = vi.fn();
  const onOpen = vi.fn();
  const onCancel = vi.fn();
  const html = renderToStaticMarkup(
    createElement(ManagedCompanyEvidenceActions, {
      selection,
      price: workspace.eod,
      annual: workspace.annual,
      filings: workspace.filings,
      interim: workspace.interim,
      navigationPending: false,
      onRequest,
      onOpen,
      onCancel,
    }),
  );
  const $ = load(html);
  const overview = $(".managed-company-evidence-actions");
  const priceSupported = selection.listing.listingId === "listing-zero";
  expect(overview.attr("aria-label")).toBe("Company research sources");
  expect(overview.find(".managed-evidence-action-grid > section")).toHaveLength(
    4,
  );
  for (const [title, supported] of [
    ["Price", priceSupported],
    ["Annual", true],
    ["Interim", false],
    ["Filings", true],
  ] as const) {
    const card = overview.find(`section[aria-label="${title} source"]`);
    expect(card).toHaveLength(1);
    expect(card.attr("aria-busy")).toBe("false");
    expect(card.find(".managed-evidence-source-state").text()).toBe(
      supported ? "Not loaded." : "Unsupported listing.",
    );
    expect(card.find("time")).toHaveLength(0);
    const buttons = card.find(".trial-actions > button");
    const labels = buttons.map((_index, button) => $(button).text()).get();
    expect(labels).toEqual([
      ...(supported
        ? [`Load ${title}${title === "Price" ? " · One month" : ""}`]
        : []),
      `Inspect ${title}`,
    ]);
    expect(buttons.filter("[disabled]")).toHaveLength(0);
  }
  const priceText = overview.find('[aria-label="Price source"]').text();
  expect(priceText.includes("Requested range: One month.")).toBe(
    priceSupported,
  );
  expect(priceText).not.toContain("Loaded range:");
  expect(onRequest).not.toHaveBeenCalled();
  expect(onOpen).not.toHaveBeenCalled();
  expect(onCancel).not.toHaveBeenCalled();
  for (const [index, model] of models.entries())
    expect(model.getSnapshot()).toBe(before[index]);
}
async function assessCompany(opened: Opened, index: number) {
  const { workspace, fixture } = opened;
  const current = workspace.followupsReview.getSnapshot();
  expect(current.position).toBe(index);
  const entry = current.selected!.entry;
  const prepared = await workspace.prepareFollowupResearch(entry);
  expect(prepared).not.toBeNull();
  workspace.openFollowupResearch(prepared!);
  const visit = workspace.getSnapshot().research!;
  expect(
    membershipMatchesResult(
      { ...entry.listing, note: "" },
      visit.selection.listing,
    ),
  ).toBe(true);
  expect(visit.selection.origin).toBe("followups");
  assertUnloadedCompanySources(workspace, visit.selection);
  expect(workspace.followupsReview.getSnapshot()).toMatchObject({
    entered: true,
    available: false,
    position: index,
  });
  const context = workspace.researchFollowupContext(visit.selection)!;
  expect(context.entry.check).toBe(reviewSessionQuestions[index]);
  expect(context.editable).toBe(true);
  context.editAssessment(reviewSessionResults[index]!);
  workspace.closeResearch();
  expect(workspace.followupsReview.getSnapshot()).toMatchObject({
    entered: true,
    available: true,
    position: index,
  });
  expect(workspace.followupsReview.getSnapshot().selected?.entry.result).toBe(
    reviewSessionResults[index],
  );
  expect(fixture.getSnapshot()).toMatchObject({
    resolve: index + 1,
    eod: 0,
    annual: 0,
    filings: 0,
    marketsEod: 0,
    save: 0,
  });
  expect(fixture.followups!.getSnapshot()).toMatchObject({
    save: 0,
    commits: 0,
  });
}
async function finish(opened: Opened) {
  const { workspace } = opened;
  chooseTwo(workspace);
  await assessCompany(opened, 0);
  workspace.followupsReview.continue(workspace.followupsReview.getSnapshot());
  await assessCompany(opened, 1);
  workspace.followupsReview.finish(workspace.followupsReview.getSnapshot());
  expect(workspace.followupsReview.getSnapshot()).toMatchObject({
    phase: "finished",
    selected: null,
  });
  const entries = workspace.followups.coordinator.getSnapshot().draft!.entries;
  expect(entries.map((entry) => entry.result)).toEqual(reviewSessionResults);
  expect(entries.map((entry) => entry.status)).toEqual([
    "open",
    "open",
    "open",
  ]);
  workspace.followups.complete(entries[0]!, new Date());
}
function command(workspace: ManagedWorkspace) {
  return {
    expectedVersion: 0,
    idempotencyKey: "10000000-0000-4000-8000-000000000001",
    payload: workspace.followups.coordinator.getSnapshot().draft!,
  };
}
async function reopenCompleteDraft(
  { workspace, fixture }: Opened,
  complete: ResearchFollowupsPayload,
) {
  workspace.sessionOwner.dispose();
  const reopened = await mount(fixture, true);
  expect(reopened.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(reopened.followupsReview.getSnapshot().entered).toBe(false);
  await reopened.followups.coordinator.load();
  expect(reopened.followups.coordinator.getSnapshot().draft).toEqual(complete);
  expect(fixture.followups!.getSnapshot()).toMatchObject({
    session: 2,
    load: 2,
    save: 1,
    commits: 1,
  });
  expect(fixture.getSnapshot()).toMatchObject({
    load: 2,
    status: 2,
    marketsResolve: 2,
    resolve: 2,
    eod: 0,
    annual: 0,
    filings: 0,
    marketsEod: 0,
    search: 0,
    save: 0,
    token: 0,
    signOut: 0,
  });
  expect(
    reopened.coordinator
      .getSnapshot()
      .draft?.memberships.map((row) => row.note),
  ).toEqual(["", "Invented second note", "Independent unchosen listing note"]);
}

describe("invented daily Follow-ups review native fixture", () => {
  it("uses actual startup, authoring, two company visits, Back, explicit Continue/Finish and independent whole-resource Save/fresh Load", async () => {
    const opened = await setup();
    const { workspace, fixture } = opened;
    workspace.note("listing-zero", "Independent Watchlist draft");
    const watchlist = workspace.coordinator.getSnapshot();
    await finish(opened);
    expect(workspace.coordinator.getSnapshot()).toBe(watchlist);
    const complete = structuredClone(
      workspace.followups.coordinator.getSnapshot().draft!,
    );
    await workspace.followups.coordinator.save();
    expect(workspace.followups.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 1,
      dirty: false,
    });
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      load: 1,
      save: 1,
      commits: 1,
      version: 1,
    });
    await reopenCompleteDraft(opened, complete);
  });
  it.each([
    {
      name: "unchosen result",
      alter: (entries: ReturnType<typeof command>["payload"]["entries"]) =>
        entries.map((entry, i) =>
          i === 2 ? { ...entry, result: "Changed unchosen result" } : entry,
        ),
    },
    {
      name: "order",
      alter: (entries: ReturnType<typeof command>["payload"]["entries"]) =>
        [...entries].reverse(),
    },
    {
      name: "identity",
      alter: (entries: ReturnType<typeof command>["payload"]["entries"]) =>
        entries.map((entry, i) =>
          i === 1
            ? {
                ...entry,
                listing: { ...entry.listing, shareClassId: "foreign-class" },
              }
            : entry,
        ),
    },
  ])(
    "refuses a whole Save with changed $name without committing a prefix",
    async ({ alter }) => {
      const opened = await setup();
      await finish(opened);
      const captured = command(opened.workspace);
      expect(() =>
        opened.fixture.api.saveFollowups(
          {
            ...captured,
            payload: {
              ...captured.payload,
              entries: alter(captured.payload.entries),
            },
          },
          new AbortController().signal,
        ),
      ).toThrow();
      expect(opened.fixture.followups!.getSnapshot()).toMatchObject({
        save: 0,
        commits: 0,
        version: 0,
      });
      const saved = await opened.fixture.api.saveFollowups(
        captured,
        new AbortController().signal,
      );
      expect(saved.payload.entries).toEqual(captured.payload.entries);
      expect(() =>
        opened.fixture.api.saveFollowups(
          captured,
          new AbortController().signal,
        ),
      ).toThrow();
      expect(opened.fixture.followups!.getSnapshot()).toMatchObject({
        save: 1,
        commits: 1,
        version: 1,
      });
    },
  );
  it("refuses a reordered company request and counts any forbidden source attempt", async () => {
    const { fixture, workspace } = await setup();
    const request = {
      snapshotSha256: workspace.getSnapshot().snapshot!.snapshotSha256,
      listingIds: ["listing-one"],
    };
    expect(() =>
      fixture.api.resolve(request, new AbortController().signal),
    ).toThrow();
    expect(fixture.getSnapshot().resolve).toBe(0);
    expect(() =>
      fixture.api.annualReport({} as never, new AbortController().signal),
    ).toThrow();
    expect(fixture.getSnapshot()).toMatchObject({ annual: 1, resolve: 0 });
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      save: 0,
      commits: 0,
    });
  });
});
