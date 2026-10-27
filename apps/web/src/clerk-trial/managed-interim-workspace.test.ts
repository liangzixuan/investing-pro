import { ManagedCatalogChangedError } from "./managed-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeMainWatchlistPayload } from "@research-cockpit/contracts";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of owners.splice(0)) workspace.sessionOwner.dispose();
  vi.restoreAllMocks();
});
async function fixture() {
  const store = await createFixture("interim-statements"),
    workspace = new ManagedWorkspace(store.api, store.session, undefined, {
      researchCoverage: store.researchCoverage,
      interimIssuers: store.interimReview!.issuers,
    });
  owners.push(workspace);
  workspace.setView("watchlist");
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.openWatchlistAnnual(
    workspace.coordinator.getSnapshot().draft!.memberships[0]!,
  );
  workspace.switchToInterim();
  const selection = workspace.getSnapshot().research!.selection;
  workspace.noteResearch(
    selection,
    store.interimReview!.prefix,
    workspace.getResearchWatchlist(selection).member!.note,
  );
  expect(store.getSnapshot().interimReport).toBe(0);
  await workspace.requestResearchSource(
    workspace.getSnapshot().research!,
    "interim",
  );
  const response = workspace.interim.getSnapshot().response!;
  expect(response).not.toBeNull();
  const prepare = () =>
    workspace.prepareInterimStatementsNote(
      selection,
      response,
      store.interimReview!.selectedCells,
      () => true,
    );
  return { store, workspace, selection, response, prepare };
}
describe("interim note within an exact managed company visit", () => {
  it("changes only the complete Watchlist note draft and saves/fresh-loads separately", async () => {
    const f = await fixture(),
      before = f.workspace.coordinator.getSnapshot().draft!,
      portfolio = f.workspace.portfolio.coordinator.getSnapshot(),
      followups = f.workspace.followups.coordinator.getSnapshot();
    const cancelled = f.prepare().preview!;
    f.workspace.cancelInterimStatementsNote(cancelled);
    expect(f.workspace.appendInterimStatementsNote(cancelled).appended).toBe(
      false,
    );
    expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
    const proposal = f.prepare();
    expect(proposal.reason).toBeNull();
    expect(proposal.preview!.note).toBe(f.store.interimReview!.expectedNote);
    expect(
      f.workspace.appendInterimStatementsNote(proposal.preview!).appended,
    ).toBe(true);
    expect(
      f.workspace.appendInterimStatementsNote(proposal.preview!).appended,
    ).toBe(false);
    const draft = f.workspace.coordinator.getSnapshot().draft!;
    expect(draft.memberships[0]!.note).toBe(
      f.store.interimReview!.expectedNote,
    );
    expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(portfolio);
    expect(f.workspace.followups.coordinator.getSnapshot()).toBe(followups);
    expect(f.store.getSnapshot()).toMatchObject({
      interimReport: 1,
      annual: 0,
      eod: 0,
      filings: 0,
      save: 0,
    });
    const encoded = encodeMainWatchlistPayload(draft);
    await f.workspace.coordinator.save();
    expect(f.store.getSnapshot().save).toBe(1);
    await f.workspace.coordinator.load();
    expect(
      encodeMainWatchlistPayload(f.workspace.coordinator.getSnapshot().draft!),
    ).toBe(encoded);
    expect(f.store.getSnapshot()).toMatchObject({
      interimPortfolioLoad: 0,
      interimPortfolioSave: 0,
      interimFollowupsLoad: 0,
      interimFollowupsSave: 0,
    });
  });
  it("permanently retires a preview after note edit then exact restoration", async () => {
    const f = await fixture(),
      preview = f.prepare().preview!,
      member = f.workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      original = member.note;
    f.workspace.noteResearch(f.selection, "Changed", original);
    expect(f.workspace.interimStatementsPreviewIsCurrent(preview)).toBe(false);
    f.workspace.noteResearch(f.selection, original, "Changed");
    expect(f.workspace.appendInterimStatementsNote(preview).appended).toBe(
      false,
    );
    expect(f.prepare().preview).not.toBeNull();
  });
  it("retires preview across a separate successful Save", async () => {
    const f = await fixture(),
      preview = f.prepare().preview!;
    const save = vi.spyOn(f.store.api, "save").mockImplementation((command) =>
      Promise.resolve({
        version: 2,
        payload: command.payload,
        replayed: false,
      }),
    );
    await f.workspace.coordinator.save();
    expect(f.workspace.appendInterimStatementsNote(preview).appended).toBe(
      false,
    );
    expect(save).toHaveBeenCalledOnce();
  });
  it.each(["close", "catalog", "session"] as const)(
    "retires prepared cells after %s",
    async (action) => {
      const f = await fixture(),
        before = f.workspace.coordinator.getSnapshot().draft,
        preview = f.prepare().preview!;
      if (action === "close") f.workspace.closeResearch();
      if (action === "catalog") {
        vi.spyOn(f.store.api, "interimReport").mockRejectedValueOnce(
          new ManagedCatalogChangedError(),
        );
        await f.workspace.requestResearchSource(
          f.workspace.getSnapshot().research!,
          "interim",
        );
      }
      if (action === "session")
        f.workspace.sessionOwner.retire("Session ended");
      expect(f.workspace.appendInterimStatementsNote(preview).appended).toBe(
        false,
      );
      if (action !== "session")
        expect(f.workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(f.store.getSnapshot().save).toBe(0);
    },
  );
  it("fences refresh cancel and late old response without an implicit extra source", async () => {
    const f = await fixture(),
      preview = f.prepare().preview!;
    let release!: (value: typeof f.response) => void;
    const read = vi.spyOn(f.store.api, "interimReport").mockImplementationOnce(
      () =>
        new Promise((done) => {
          release = done;
        }),
    );
    const pending = f.workspace.requestResearchSource(
      f.workspace.getSnapshot().research!,
      "interim",
    );
    expect(f.workspace.interim.getSnapshot().running).toBe(true);
    f.workspace.cancelResearchSource(
      f.workspace.getSnapshot().research!,
      "interim",
    );
    release(f.response);
    await pending;
    expect(f.workspace.appendInterimStatementsNote(preview).appended).toBe(
      false,
    );
    expect(f.workspace.interim.getSnapshot().response).toBe(f.response);
    expect(f.workspace.interim.getSnapshot().showingPrevious).toBe(true);
    expect(read).toHaveBeenCalledOnce();
    expect(f.store.getSnapshot().save).toBe(0);
  });
});
