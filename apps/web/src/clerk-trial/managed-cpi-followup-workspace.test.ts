import { afterEach, expect, it, vi } from "vitest";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { prepareCalendarFollowup } from "./managed-calendar-followup";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { TrialApiError } from "./api";
import { cpiHeadlinesFixture } from "./cpi-headlines-fixture";
const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const model of workspaces.splice(0)) model.sessionOwner.dispose();
});
function held<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function fixture(load = true) {
  const base = await createFixture("research-followups");
  const packet = cpiHeadlinesFixture();
  const api: ManagedApi = {
    ...base.api,
    cpiHeadlines: vi.fn<ManagedApi["cpiHeadlines"]>().mockResolvedValue(packet),
    loadFollowups: vi.fn(base.followups!.api.loadFollowups),
    saveFollowups: vi.fn(base.followups!.api.saveFollowups),
    save: vi.fn(base.api.save),
    recentFilings: vi.fn(base.api.recentFilings),
    annualReport: vi.fn(base.api.annualReport),
    eodHistory: vi.fn(base.api.eodHistory),
  };
  const make = () => {
    const workspace = new ManagedWorkspace(
      api,
      base.followups!.nextSession(),
      undefined,
      {
        researchCoverage: base.researchCoverage,
        priceCoverage: base.priceCoverage,
        marketsCohort: base.marketsCohort,
      },
    );
    workspaces.push(workspace);
    return workspace;
  };
  const workspace = make();
  await workspace.refreshCatalog();
  await workspace.coordinator.load();
  const first = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
  workspace.note(first.listingId, "Keep the complete unsaved Watchlist note.");
  const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
  await workspace.cpiHeadlines.load();
  let selection: object = {};
  const capture = () => {
    const selected = selection;
    const result = workspace.captureCpiHeadlineSource(
      packet.items[0]!.url,
      () => selection === selected,
    );
    expect(result.reason).toBeNull();
    expect(result.capture).not.toBeNull();
    return result.capture!;
  };
  const source = capture();
  const loadInitial = (current = () => true) =>
    workspace.loadMarketsCalendarFollowups(source, member, current);
  if (load) await loadInitial();
  const prepare = (choice = source) => {
    const host = workspace.captureMarketsCalendarFollowup(choice, member);
    expect(host.port).not.toBeNull();
    const result = prepareCalendarFollowup(
      host.port!,
      "Could this change the next research decision? Café 東京 😀",
      "2026-12-31",
      () => true,
    );
    expect(result.reason).toBeNull();
    expect(result.preview).not.toBeNull();
    return result.preview!;
  };
  return {
    workspace,
    api,
    base,
    make,
    member,
    source,
    capture,
    prepare,
    loadInitial,
    packet,
    changeSelection: () => {
      selection = {};
    },
  };
}
it("keeps the full cited unknown-time check once and saves only the independent Follow-ups draft", async () => {
  const f = await fixture();
  const watchlist = f.workspace.coordinator.getSnapshot();
  const preview = f.prepare();
  expect(preview.check).toContain("Café 東京 😀");
  expect(preview.check).toContain(
    "U.S. Bureau of Labor Statistics CPI headline:",
  );
  expect(preview.check).toContain(
    "Feed published: 2026-10-01T07:15:22.123456-04:00",
  );
  expect(preview.check).toContain(f.packet.items[0]!.url);
  let repeated: unknown = "not called";
  const stop = f.workspace.followups.coordinator.subscribe(() => {
    repeated = preview.create();
  });
  const created = preview.create();
  stop();
  expect(created).toMatchObject({
    listing: preview.listing,
    check: preview.check,
    dueOn: "2026-12-31",
    status: "open",
    result: "",
    completedOn: null,
  });
  expect(repeated).toBeNull();
  expect(preview.create()).toBeNull();
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
  expect(f.api.save).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.recentFilings).not.toHaveBeenCalled();
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
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
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
});

it("admits only the eligible explicit first Follow-ups load and keeps source choice through its publications", async () => {
  const f = await fixture(false);
  const watchlist = f.workspace.coordinator.getSnapshot();
  expect(f.workspace.canLoadMarketsCalendarFollowups(f.source, f.member)).toBe(
    true,
  );
  expect(f.api.loadFollowups).not.toHaveBeenCalled();
  await f.loadInitial();
  expect(f.source.isCurrent()).toBe(true);
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.workspace.canLoadMarketsCalendarFollowups(f.source, f.member)).toBe(
    false,
  );
  await f.loadInitial();
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.prepare().create()).not.toBeNull();
  expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
});

it("allows an explicit initial-load retry after failure without another source read", async () => {
  const f = await fixture(false);
  vi.mocked(f.api.loadFollowups).mockRejectedValueOnce(
    new TrialApiError("unavailable"),
  );
  await f.loadInitial();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(f.source.isCurrent()).toBe(true);
  expect(f.workspace.canLoadMarketsCalendarFollowups(f.source, f.member)).toBe(
    true,
  );
  await f.loadInitial();
  expect(f.api.loadFollowups).toHaveBeenCalledTimes(2);
  expect(f.api.cpiHeadlines).toHaveBeenCalledOnce();
  expect(f.prepare().create()).not.toBeNull();
});

it("does not apply a late initial-load result after the owning calendar form is retired", async () => {
  const f = await fixture(false);
  const result = await f.base.followups!.api.loadFollowups(
    new AbortController().signal,
  );
  const request = held<typeof result>();
  vi.mocked(f.api.loadFollowups).mockReturnValueOnce(request.promise);
  let current = true;
  const pending = f.loadInitial(() => current);
  await vi.waitFor(() => expect(f.api.loadFollowups).toHaveBeenCalledOnce());
  current = false;
  request.resolve(result);
  await pending;
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.followups.coordinator.getSnapshot().saved).toBeNull();
});

it("refuses initial load after selection retirement or when an authored Follow-ups draft already exists", async () => {
  const f = await fixture();
  const saved = f.workspace.followups.coordinator.getSnapshot();
  f.changeSelection();
  await f.loadInitial();
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.workspace.followups.coordinator.getSnapshot()).toBe(saved);
  expect(f.prepare(f.capture()).create()).not.toBeNull();
  await f.workspace.loadMarketsCalendarFollowups(
    f.capture(),
    f.member,
    () => true,
  );
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
});

it("retires filter, route and source-pass ownership permanently", async () => {
  const f = await fixture();
  const beforeFilter = f.prepare();
  f.changeSelection();
  expect(beforeFilter.create()).toBeNull();
  const beforeRoute = f.prepare(f.capture());
  f.workspace.setView("watchlist");
  f.workspace.setView("markets");
  expect(beforeRoute.create()).toBeNull();
  const beforePass = f.prepare(f.capture());
  f.workspace.marketsSourceReview.preview();
  expect(beforePass.create()).toBeNull();
  expect(beforePass.isCurrent()).toBe(false);
});

it("refuses CPI check capture during a pass, including subscriber reentry, and requires a new settled capture", async () => {
  const f = await fixture();
  const before = f.prepare();
  const original = f.workspace.cpiHeadlines.getSnapshot().headlines;
  const pending = held<typeof f.packet>();
  vi.mocked(f.api.cpiHeadlines).mockReturnValueOnce(pending.promise);
  const pass = f.workspace.marketsSourceReview;
  for (const row of pass.getSnapshot().rows)
    pass.choose(row.id, row.id === "cpi");
  pass.preview();
  const reentrant: unknown[] = [];
  const stop = pass.subscribe(() => {
    if (pass.getSnapshot().phase === "running")
      reentrant.push(
        f.workspace.captureCpiHeadlineSource(f.packet.items[0]!.url, () => true)
          .capture,
      );
  });
  const running = pass.start();
  expect(pass.getSnapshot().phase).toBe("running");
  expect(reentrant.length).toBeGreaterThan(0);
  expect(reentrant.every((capture) => capture === null)).toBe(true);
  expect(
    f.workspace.captureCpiHeadlineSource(f.packet.items[0]!.url, () => true)
      .capture,
  ).toBeNull();
  expect(before.create()).toBeNull();
  pass.cancel();
  stop();
  pending.resolve({ ...f.packet, fetchedAt: "2026-10-29T19:00:00.000Z" });
  await running;
  expect(f.workspace.cpiHeadlines.getSnapshot().headlines).toBe(original);
  expect(before.isCurrent()).toBe(false);
  expect(f.source.isCurrent()).toBe(false);
  expect(f.prepare(f.capture()).isCurrent()).toBe(true);
  expect(f.api.cpiHeadlines).toHaveBeenCalledTimes(2);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});

it("does not revive an old CPI source after the same pass selection is restored", async () => {
  const f = await fixture();
  const before = f.prepare();
  const pass = f.workspace.marketsSourceReview;
  pass.choose("cpi", true);
  pass.choose("cpi", false);
  expect(f.source.isCurrent()).toBe(false);
  expect(before.create()).toBeNull();
  expect(f.api.cpiHeadlines).toHaveBeenCalledOnce();
  expect(f.prepare(f.capture()).isCurrent()).toBe(true);
});

it("retires a preview after either resource draft changes, including same-text restoration", async () => {
  const f = await fixture();
  const before = f.prepare();
  const draft = f.workspace.coordinator.getSnapshot().draft!;
  f.workspace.coordinator.replaceDraft({ ...draft });
  expect(before.create()).toBeNull();
  const currentMember =
    f.workspace.coordinator.getSnapshot().draft!.memberships[0]!;
  const host = f.workspace.captureMarketsCalendarFollowup(
    f.capture(),
    currentMember,
  );
  const next = prepareCalendarFollowup(
    host.port!,
    "Inspect the original item",
    "2026-12-31",
    () => true,
  ).preview!;
  const followups = f.workspace.followups.coordinator.getSnapshot().draft!;
  f.workspace.followups.coordinator.replaceDraft({ ...followups });
  expect(next.create()).toBeNull();
});

it("retires permanently across Follow-ups file activity even when no draft was changed", async () => {
  const f = await fixture();
  const preview = f.prepare();
  const operation = {};
  f.workspace.followups.beginDraftFileActivity(operation);
  f.workspace.followups.endDraftFileActivity(operation);
  expect(preview.create()).toBeNull();
  expect(f.prepare().create()).not.toBeNull();
});

it("does not overwrite an existing listing's check or bypass unresolved saves", async () => {
  const f = await fixture();
  const entry = f.prepare().create()!;
  const draft = f.workspace.followups.coordinator.getSnapshot().draft!;
  const port = f.workspace.captureMarketsCalendarFollowup(
    f.capture(),
    f.member,
  ).port!;
  expect(
    prepareCalendarFollowup(
      port,
      "A different question",
      "2027-01-01",
      () => true,
    ).preview,
  ).toBeNull();
  expect(f.workspace.followups.currentEntry(entry.id)).toBe(entry);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(draft);
  const waiting = held<Awaited<ReturnType<ManagedApi["saveFollowups"]>>>();
  vi.mocked(f.api.saveFollowups).mockReturnValueOnce(waiting.promise);
  const pending = f.workspace.followups.coordinator.save();
  await vi.waitFor(() => expect(f.api.saveFollowups).toHaveBeenCalledOnce());
  expect(f.workspace.followups.canEdit()).toBe(false);
  const source = f.capture();
  const paused = f.workspace.captureMarketsCalendarFollowup(
    source,
    f.member,
  ).port!;
  expect(
    prepareCalendarFollowup(paused, "Paused question", "2027-01-01", () => true)
      .preview,
  ).toBeNull();
  waiting.resolve({ version: 1, payload: draft, replayed: false });
  await pending;
});

it("uses the existing exact-entry review route and preserves the complete draft through company Research/Back", async () => {
  const f = await fixture();
  const created = f.prepare().create()!;
  const draft = f.workspace.followups.coordinator.getSnapshot().draft;
  const request = f.workspace.reviewFollowup(created, () => {
    f.workspace.setView("followups");
    return true;
  });
  expect(request?.entry).toBe(created);
  expect(f.workspace.followups.getSnapshot().selectedId).toBe(created.id);
  const research = await f.workspace.prepareFollowupResearch(created);
  expect(research).not.toBeNull();
  f.workspace.openFollowupResearch(research!);
  expect(f.workspace.getSnapshot().research?.selection.origin).toBe(
    "followups",
  );
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(draft);
  f.workspace.closeResearch();
  expect(f.workspace.getSnapshot().view).toBe("followups");
  expect(f.workspace.followups.getSnapshot().selectedId).toBe(created.id);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBe(draft);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});

it.each(["navigation", "catalog", "session"] as const)(
  "permanently retires a source choice and preview across %s ownership changes",
  async (boundary) => {
    const f = await fixture();
    const preview = f.prepare();
    if (boundary === "navigation") {
      f.workspace.setNavigationBlocked(true);
      f.workspace.setNavigationBlocked(false);
    }
    if (boundary === "catalog") await f.workspace.refreshCatalog();
    if (boundary === "session")
      f.workspace.sessionOwner.retire("Invented expired session");
    expect(f.source.isCurrent()).toBe(false);
    expect(preview.isCurrent()).toBe(false);
    expect(preview.create()).toBeNull();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(f.api.save).not.toHaveBeenCalled();
  },
);

it("refuses a pending initial-load response after the source is refreshed", async () => {
  const f = await fixture(false);
  const result = await f.base.followups!.api.loadFollowups(
    new AbortController().signal,
  );
  const request = held<typeof result>();
  vi.mocked(f.api.loadFollowups).mockReturnValueOnce(request.promise);
  const pending = f.loadInitial();
  await vi.waitFor(() => expect(f.api.loadFollowups).toHaveBeenCalledOnce());
  await f.workspace.cpiHeadlines.load();
  request.resolve(result);
  await pending;
  expect(f.source.isCurrent()).toBe(false);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.followups.coordinator.getSnapshot().saved).toBeNull();
});

it("retires equal-content refresh and rejects forged capture/member identities", async () => {
  const f = await fixture();
  const old = f.prepare();
  await f.workspace.cpiHeadlines.load();
  expect(f.source.isCurrent()).toBe(false);
  expect(old.create()).toBeNull();
  const capture = f.capture();
  expect(
    f.workspace.captureMarketsCalendarFollowup({ ...capture }, f.member).port,
  ).toBeNull();
  expect(
    f.workspace.captureMarketsCalendarFollowup(capture, { ...f.member }).port,
  ).toBeNull();
  expect(f.prepare(capture).create()).not.toBeNull();
});
