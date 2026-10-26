import { afterEach, expect, it, vi } from "vitest";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { ManagedWorkspace } from "./managed-workspace";
import type { ManagedApi } from "./managed-api";
import { prepareFilingsFollowup } from "./managed-filings-followup";
import { filingsResponse } from "./sec-filings-fixture";
import { TrialApiError } from "./api";

const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const model of workspaces.splice(0)) model.sessionOwner.dispose();
});
async function fixture(load = true) {
  const base = await createFixture("research-followups");
  const signal = new AbortController().signal;
  const catalog = await base.api.status(signal);
  let saved = await base.api.load(signal);
  const api: ManagedApi = {
    ...base.api,
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue(catalog),
    load: vi.fn<ManagedApi["load"]>(() =>
      Promise.resolve(structuredClone(saved)),
    ),
    save: vi.fn<ManagedApi["save"]>((command) => {
      saved = {
        version: saved.version + 1,
        payload: structuredClone(command.payload),
      };
      return Promise.resolve({ ...structuredClone(saved), replayed: false });
    }),
    loadFollowups: vi.fn(base.followups!.api.loadFollowups),
    saveFollowups: vi.fn(base.followups!.api.saveFollowups),
    recentFilings: vi.fn<ManagedApi["recentFilings"]>(),
    annualReport: vi.fn(base.api.annualReport),
    eodHistory: vi.fn(base.api.eodHistory),
    resolve: vi.fn<ManagedApi["resolve"]>((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing:
            base.researchCoverage.listings.find(
              (row) => row.listing.listingId === listingId,
            )?.listing ?? null,
        })),
      }),
    ),
  };
  const make = () => {
    const model = new ManagedWorkspace(
      api,
      base.followups!.nextSession(),
      undefined,
      {
        researchCoverage: base.researchCoverage,
        priceCoverage: base.priceCoverage,
        marketsCohort: base.marketsCohort,
      },
    );
    workspaces.push(model);
    return model;
  };
  const workspace = make();
  await workspace.refreshCatalog();
  await workspace.coordinator.load();
  workspace.setView("watchlist");
  const group = workspace.filingsReview;
  group.choose(group.getSnapshot(), group.getSnapshot().memberships[0]!);
  group.start(group.getSnapshot());
  const selection = group.getSnapshot().rows[0]!.filings.selection!;
  vi.mocked(api.recentFilings).mockResolvedValueOnce(
    filingsResponse(2, "available", selection),
  );
  await group.load(group.getSnapshot());
  const row = group.getSnapshot().rows[0]!;
  const opener = { member: row.member, response: row.filings.response! };
  workspace.openFilingsReview(opener);
  const visit = workspace.getSnapshot().research!.selection;
  const response = workspace.filings.getSnapshot().response!;
  const filing = response.issuer.filings[0]!;
  const context = () =>
    workspace.captureFilingsFollowup(visit, response, filing);
  const prepare = (
    question = "Will capacity support the plan? · Café 東京 😀",
  ) => {
    const current = context();
    expect(current.reason).toBeNull();
    expect(current.port).not.toBeNull();
    const result = prepareFilingsFollowup(
      current.port!,
      question,
      "2026-12-31",
      () => true,
    );
    expect(result.reason).toBeNull();
    expect(result.preview).not.toBeNull();
    return result.preview!;
  };
  const initialLoad = () =>
    workspace.loadFilingsFollowups(visit, response, filing, () => true);
  if (load) await initialLoad();
  return {
    workspace,
    api,
    base,
    make,
    group,
    opener,
    visit,
    response,
    filing,
    context,
    prepare,
    initialLoad,
  };
}

it("creates the complete cited check once, retains group Back and persists only after separate Follow-ups Save/fresh Load", async () => {
  const f = await fixture();
  const watchlist = f.workspace.coordinator.getSnapshot();
  const source = structuredClone(f.response);
  const preview = f.prepare();
  expect(preview.check).toContain(
    "Will capacity support the plan? · Café 東京 😀",
  );
  for (const value of [
    f.filing.form,
    f.filing.accessionNumber,
    f.filing.filingDate,
    f.filing.sourceUrl,
  ])
    expect(preview.check).toContain(value);
  expect(f.api.recentFilings).toHaveBeenCalledOnce();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  let reentrant: unknown = "not called";
  const stop = f.workspace.followups.coordinator.subscribe(() => {
    reentrant = preview.create();
  });
  const created = preview.create();
  stop();
  expect(created).not.toBeNull();
  expect(reentrant).toBeNull();
  expect(preview.create()).toBeNull();
  expect(created).toMatchObject({
    check: preview.check,
    dueOn: "2026-12-31",
    status: "open",
    completedOn: null,
    result: "",
    listing: preview.listing,
  });
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
  expect(f.response).toEqual(source);
  f.workspace.closeResearch();
  expect(f.group.getSnapshot().selected).toBe(f.opener.member);
  expect(f.group.getSnapshot().rows[0]!.filings.response).toBe(
    f.opener.response,
  );
  expect(f.api.save).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  const unsaved = f.make();
  await unsaved.refreshCatalog();
  await unsaved.coordinator.load();
  await unsaved.followups.coordinator.load();
  expect(unsaved.followups.coordinator.getSnapshot().draft!.entries).toEqual(
    [],
  );
  await f.workspace.followups.coordinator.save();
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  expect(f.api.save).not.toHaveBeenCalled();
  const fresh = f.make();
  await fresh.refreshCatalog();
  await fresh.coordinator.load();
  await fresh.followups.coordinator.load();
  expect(fresh.followups.coordinator.getSnapshot().draft!.entries).toEqual([
    created,
  ]);
  expect(fresh.coordinator.getSnapshot().draft).toEqual(watchlist.draft);
  expect(f.api.recentFilings).toHaveBeenCalledOnce();
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
});

it("admits the explicit initial load despite its loading publication, keeps both resources separate, and refuses a second load", async () => {
  const f = await fixture(false);
  expect(
    f.workspace.canLoadFilingsFollowups(f.visit, f.response, f.filing),
  ).toBe(true);
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
  await f.initialLoad();
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).not.toBeNull();
  expect(
    f.workspace.canLoadFilingsFollowups(f.visit, f.response, f.filing),
  ).toBe(false);
  await f.initialLoad();
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.prepare().create()).not.toBeNull();
  expect(f.api.save).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});

it("allows an explicit initial-load retry after a failure without source reads or draft creation", async () => {
  const f = await fixture(false);
  vi.mocked(f.api.loadFollowups).mockRejectedValueOnce(
    new TrialApiError("unavailable"),
  );
  await f.initialLoad();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(
    f.workspace.canLoadFilingsFollowups(f.visit, f.response, f.filing),
  ).toBe(true);
  await f.initialLoad();
  expect(f.api.loadFollowups).toHaveBeenCalledTimes(2);
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toEqual([]);
  expect(f.prepare().create()).not.toBeNull();
  expect(f.api.recentFilings).toHaveBeenCalledOnce();
});

it.each([
  "note-round-trip",
  "order-state",
  "followups-state",
  "navigation-round-trip",
  "section-round-trip",
  "visit",
  "session",
] as const)(
  "permanently refuses a prepared check after %s",
  async (boundary) => {
    const f = await fixture();
    const p = f.prepare();
    const draft = f.workspace.coordinator.getSnapshot().draft!;
    if (boundary === "note-round-trip") {
      const member = draft.memberships[0]!;
      f.workspace.note(member.listingId, "Intervening note");
      f.workspace.note(member.listingId, member.note);
    }
    if (boundary === "order-state")
      f.workspace.coordinator.replaceDraft({
        ...draft,
        memberships: [...draft.memberships],
      });
    if (boundary === "followups-state")
      f.workspace.followups.coordinator.replaceDraft({
        schemaVersion: 1,
        entries: [],
      });
    if (boundary === "navigation-round-trip") {
      f.workspace.setNavigationBlocked(true);
      f.workspace.setNavigationBlocked(false);
    }
    if (boundary === "section-round-trip") {
      f.workspace.switchToAnnual();
      await f.workspace.requestResearchSource(
        f.workspace.getSnapshot().research!,
        "filings",
      );
    }
    if (boundary === "visit") {
      f.workspace.closeResearch();
      f.workspace.openFilingsReview(f.opener);
    }
    if (boundary === "session") f.workspace.sessionOwner.dispose();
    expect(p.isCurrent()).toBe(false);
    expect(p.create()).toBeNull();
    expect(p.isCurrent()).toBe(false);
    expect(f.api.save).not.toHaveBeenCalled();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  },
);

it("retires an old preview when a refresh is cancelled and its late packet cannot renew it", async () => {
  const f = await fixture();
  const p = f.prepare();
  let resolve!: (value: typeof f.response) => void;
  vi.mocked(f.api.recentFilings).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = f.workspace.filings.load();
  f.workspace.filings.cancel();
  resolve(structuredClone(f.response));
  await pending;
  expect(f.workspace.filings.getSnapshot().response).toBe(f.response);
  expect(p.create()).toBeNull();
  expect(p.isCurrent()).toBe(false);
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toEqual([]);
});

it("refuses a copied filing row and a different response object", async () => {
  const f = await fixture();
  expect(
    f.workspace.captureFilingsFollowup(f.visit, f.response, { ...f.filing })
      .port,
  ).toBeNull();
  expect(
    f.workspace.captureFilingsFollowup(
      f.visit,
      structuredClone(f.response),
      f.filing,
    ).port,
  ).toBeNull();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});

it("retires a preview across a successful Watchlist Save without saving or creating Follow-ups", async () => {
  const f = await fixture();
  const member = f.workspace.coordinator.getSnapshot().draft!.memberships[0]!;
  f.workspace.note(
    member.listingId,
    "A separately authored note before preview",
  );
  const preview = f.prepare();
  await f.workspace.coordinator.save();
  expect(f.api.save).toHaveBeenCalledOnce();
  expect(preview.isCurrent()).toBe(false);
  expect(preview.create()).toBeNull();
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toEqual([]);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});

it("retires across a successful separate Follow-ups Save and preserves another exact listing's check", async () => {
  const f = await fixture();
  const before = f.workspace.coordinator.getSnapshot().draft!;
  const listing = f.base.researchCoverage.listings.find(
    (row) => row.listing.listingId !== before.memberships[0]!.listingId,
  )!.listing;
  f.workspace.coordinator.replaceDraft({
    ...before,
    memberships: [
      ...before.memberships,
      { ...listing, note: "Other company note" },
    ],
  });
  const member = f.workspace.coordinator
    .getSnapshot()
    .draft!.memberships.at(-1)!;
  f.workspace.followups.add(member, "2026-12-30");
  const added =
    f.workspace.followups.coordinator.getSnapshot().draft!.entries[0]!;
  f.workspace.followups.edit(
    added,
    "check",
    "Keep the other complete research question",
  );
  const other =
    f.workspace.followups.coordinator.getSnapshot().draft!.entries[0]!;
  const preview = f.prepare();
  await f.workspace.followups.coordinator.save();
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  expect(preview.isCurrent()).toBe(false);
  expect(preview.create()).toBeNull();
  expect(
    f.workspace.followups.coordinator.getSnapshot().draft!.entries,
  ).toEqual([other]);
  expect(f.api.save).not.toHaveBeenCalled();
});
