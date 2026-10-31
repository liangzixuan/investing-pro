import { afterEach, expect, it, vi } from "vitest";
import {
  MANAGED_BLS_CALENDAR_SOURCE,
  parseManagedBlsCalendar,
  parseManagedEconomicCalendar,
  parseManagedMonetaryAnnouncements,
} from "@research-cockpit/contracts";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import { cpiHeadlinesFixture } from "./cpi-headlines-fixture";
import { prepareCalendarFollowup } from "./managed-calendar-followup";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";

const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const model of workspaces.splice(0)) model.sessionOwner.dispose();
});
async function fixture(load = true) {
  const base = await createFixture("research-followups");
  const bls = parseManagedBlsCalendar({
    ...economicCalendarFixture(),
    source: MANAGED_BLS_CALENDAR_SOURCE,
  })!;
  const bea = parseManagedEconomicCalendar(economicCalendarFixture())!;
  const fed = parseManagedMonetaryAnnouncements(fedAnnouncementsFixture())!;
  let saved = await base.api.load(new AbortController().signal);
  const api: ManagedApi = {
    ...base.api,
    cpiHeadlines: vi
      .fn<ManagedApi["cpiHeadlines"]>()
      .mockResolvedValue(cpiHeadlinesFixture()),
    status: vi.fn(base.api.status),
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
    resolve: vi.fn(base.api.resolve),
    annualReport: vi.fn(base.api.annualReport),
    recentFilings: vi.fn(base.api.recentFilings),
    eodHistory: vi.fn(base.api.eodHistory),
    blsCalendar: vi.fn<ManagedApi["blsCalendar"]>(() => Promise.resolve(bls)),
    economicCalendar: vi.fn<ManagedApi["economicCalendar"]>(() =>
      Promise.resolve(bea),
    ),
    monetaryAnnouncements: vi.fn<ManagedApi["monetaryAnnouncements"]>(() =>
      Promise.resolve(fed),
    ),
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
  await workspace.blsCalendar.load();
  await workspace.agenda.load();
  await workspace.announcements.load();
  const keys = {
    bls: `bls:${JSON.stringify([bls.events[0]!.series, bls.events[0]!.scheduledAt])}`,
    bea: `bea:${JSON.stringify([bea.events[0]!.series, bea.events[0]!.scheduledAt])}`,
    fed: `fed:${fed.items[1]!.url}`,
  };
  let selection: object = {};
  const capture = (kind: keyof typeof keys = "fed") => {
    const selected = selection;
    const result = workspace.captureMarketsCalendarSource(
      keys[kind],
      () => selected === selection,
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
    packets: { bls, bea, fed },
    keys,
    changeSelection: () => {
      selection = {};
    },
  };
}

function navigate(workspace: ManagedWorkspace, view: "markets" | "followups") {
  workspace.setNavigationBlocked(true);
  workspace.setView(view);
  workspace.setNavigationBlocked(false);
  return true;
}
async function retained() {
  const f = await fixture();
  const preview = f.prepare();
  const entry = preview.create()!;
  const captured = {
    board: f.workspace.markets.getSnapshot(),
    pass: f.workspace.marketsSourceReview.getSnapshot(),
    bls: f.workspace.blsCalendar.getSnapshot(),
    bea: f.workspace.agenda.getSnapshot(),
    fed: f.workspace.announcements.getSnapshot(),
    cpi: f.workspace.cpiHeadlines.getSnapshot(),
  };
  const review = f.workspace.reviewMarketsBriefingFollowup(
    entry,
    f.source,
    () => navigate(f.workspace, "followups"),
    { date: "2026-10-30", source: "fed", title: "inflation" },
  );
  expect(review?.entry).toBe(entry);
  const reading = f.workspace.getMarketsBriefingReading();
  expect(reading).not.toBeNull();
  return { ...f, preview, entry, reading: reading!, captured };
}
it("retains complete reading and selection through exact Research/Back/briefing without Markets reads", async () => {
  const f = await retained();
  for (const key of Object.keys(f.captured) as (keyof typeof f.captured)[])
    expect(f.reading[key]).toBe(f.captured[key]);
  expect(f.reading.selected).toBe(f.source.source);
  expect(f.reading.selection).toEqual({
    date: "2026-10-30",
    source: "fed",
    title: "inflation",
  });
  const calls = () => [
    vi.mocked(f.api.resolve).mock.calls.length,
    vi.mocked(f.api.blsCalendar).mock.calls.length,
    vi.mocked(f.api.economicCalendar).mock.calls.length,
    vi.mocked(f.api.monetaryAnnouncements).mock.calls.length,
    vi.mocked(f.api.eodHistory).mock.calls.length,
  ];
  const before = calls();
  const prepared = await f.workspace.prepareFollowupResearch(f.entry);
  expect(prepared).not.toBeNull();
  f.workspace.openFollowupResearch(prepared!);
  expect(f.workspace.getMarketsBriefingReading()).toBe(f.reading);
  f.workspace.setNavigationBlocked(true);
  await f.workspace.setCompanyRoute({
    kind: "company",
    listingId: f.entry.listing.listingId,
    section: "eod",
  });
  f.workspace.closeResearch();
  f.workspace.setNavigationBlocked(false);
  await f.workspace.setCompanyRoute(null);
  expect(f.workspace.resumeMarketsBriefingFollowup()).toBe(true);
  expect(f.workspace.resumeMarketsBriefingFollowup()).toBe(false);
  const afterResearch = calls();
  expect(afterResearch[0]).toBe(before[0]! + 1);
  expect(afterResearch.slice(1)).toEqual(before.slice(1));
  expect(
    f.workspace.returnToMarketsBriefing(() => navigate(f.workspace, "markets")),
  ).toBe(true);
  expect(f.workspace.getMarketsBriefingReading()).toBe(f.reading);
  expect(calls()).toEqual(afterResearch);
  expect(f.source.isCurrent()).toBe(false);
  expect(f.preview.create()).toBeNull();
  f.workspace.marketsSourceReview.preview();
  expect(f.workspace.marketsSourceReview.getSnapshot().canStart).toBe(false);
  expect(f.workspace.markets.getSnapshot().active).toBe(false);
  expect(f.workspace.returnToMarketsBriefing(() => true)).toBe(false);
});
it("keeps owned assessment and completion edits without changing the original captured entry", async () => {
  const f = await retained();
  f.workspace.followups.edit(
    f.entry,
    "result",
    "Original question checked against the retained source.",
  );
  let entry = f.workspace.followups.currentEntry(f.entry.id)!;
  f.workspace.followups.complete(entry, new Date("2026-10-31T12:00:00Z"));
  entry = f.workspace.followups.currentEntry(f.entry.id)!;
  expect(entry.status).toBe("completed");
  expect(f.workspace.getMarketsBriefingReading()).toBe(f.reading);
  expect(f.reading.entry).toBe(f.entry);
});
it.each([
  "route",
  "selection",
  "file",
  "watchlistFile",
  "draft",
  "catalog",
  "question",
  "due",
  "session",
  "blocked",
] as const)("retires permanently across %s ABA", async (boundary) => {
  const f = await retained();
  if (boundary === "route") {
    f.workspace.setView("watchlist");
    f.workspace.setView("followups");
  }
  if (boundary === "selection") {
    f.workspace.followups.select(null);
    f.workspace.followups.select(f.entry.id);
  }
  if (boundary === "file") {
    const token = {};
    f.workspace.followups.beginDraftFileActivity(token);
    f.workspace.followups.endDraftFileActivity(token);
  }
  if (boundary === "watchlistFile") {
    const token = {};
    f.workspace.beginWatchlistDraftFileActivity(token);
    f.workspace.endWatchlistDraftFileActivity(token);
  }
  if (boundary === "draft") {
    f.workspace.followups.coordinator.replaceDraft(
      structuredClone(f.workspace.followups.coordinator.getSnapshot().draft!),
    );
  }
  if (boundary === "catalog") await f.workspace.refreshCatalog();
  if (boundary === "question" || boundary === "due") {
    const field = boundary === "question" ? "check" : "dueOn";
    f.workspace.followups.edit(
      f.entry,
      field,
      field === "check" ? "A different question" : "2027-01-01",
    );
    f.workspace.followups.edit(
      f.workspace.followups.currentEntry(f.entry.id)!,
      field,
      f.entry[field],
    );
  }
  if (boundary === "session")
    f.workspace.sessionOwner.retire("Invented expired session");
  if (boundary === "blocked") {
    f.workspace.setNavigationBlocked(true);
    f.workspace.setNavigationBlocked(false);
  }
  expect(f.workspace.getMarketsBriefingReading()).toBeNull();
  const callback = vi.fn(() => true);
  expect(f.workspace.returnToMarketsBriefing(callback)).toBe(false);
  expect(callback).not.toHaveBeenCalled();
});
it("refuses a forged capture and a same-content refreshed source", async () => {
  const f = await fixture();
  const entry = f.prepare().create()!;
  const nav = vi.fn(() => true);
  expect(
    f.workspace.reviewMarketsBriefingFollowup(entry, { ...f.source }, nav),
  ).toBeNull();
  await f.workspace.announcements.load();
  expect(
    f.workspace.reviewMarketsBriefingFollowup(entry, f.source, nav),
  ).toBeNull();
  expect(nav).not.toHaveBeenCalled();
});
it("rejects reentrant route changes before installing or returning a reading", async () => {
  const f = await fixture();
  const entry = f.prepare().create()!;
  expect(
    f.workspace.reviewMarketsBriefingFollowup(entry, f.source, () => {
      f.workspace.setView("followups");
      f.workspace.setView("watchlist");
      f.workspace.setView("followups");
      return true;
    }),
  ).toBeNull();
  expect(f.workspace.getMarketsBriefingReading()).toBeNull();
  const g = await retained();
  let fired = false;
  const stop = g.workspace.subscribe(() => {
    if (!fired && g.workspace.getSnapshot().view === "markets") {
      fired = true;
      g.workspace.setView("watchlist");
    }
  });
  expect(
    g.workspace.returnToMarketsBriefing(() => navigate(g.workspace, "markets")),
  ).toBe(false);
  stop();
  expect(g.workspace.getMarketsBriefingReading()).toBeNull();
});
it("starts a new live briefing only on an explicit ordinary same-view navigation", async () => {
  const f = await retained();
  expect(
    f.workspace.returnToMarketsBriefing(() => navigate(f.workspace, "markets")),
  ).toBe(true);
  const count = vi.mocked(f.api.resolve).mock.calls.length;
  f.workspace.setView("markets");
  expect(f.workspace.getMarketsBriefingReading()).toBeNull();
  expect(f.workspace.markets.getSnapshot().active).toBe(true);
  expect(vi.mocked(f.api.resolve).mock.calls.length).toBe(count + 1);
});

it("keeps stale source actions inert and preserves passive mode after reading retirement", async () => {
  const f = await retained();
  expect(
    f.workspace.returnToMarketsBriefing(() => navigate(f.workspace, "markets")),
  ).toBe(true);
  f.workspace.marketsSourceReview.preview();
  expect(f.workspace.getMarketsBriefingReading()).toBe(f.reading);
  expect(f.workspace.marketsSourceReview.getSnapshot().canStart).toBe(false);
  const token = {};
  f.workspace.followups.beginDraftFileActivity(token);
  f.workspace.followups.endDraftFileActivity(token);
  expect(f.workspace.getMarketsBriefingReading()).toBeNull();
  expect(f.workspace.isMarketsBriefingPassive()).toBe(true);
  expect(await f.workspace.cpiHeadlines.load()).toBe("not_started");
  f.workspace.setView("markets");
  expect(f.workspace.isMarketsBriefingPassive()).toBe(false);
  await f.workspace.cpiHeadlines.load();
  expect(f.api.cpiHeadlines).toHaveBeenCalledOnce();
});
it.each(["bls", "bea", "fed"] as const)(
  "refuses a CPI briefing while standalone %s is busy",
  async (kind) => {
    const f = await fixture();
    await f.workspace.cpiHeadlines.load();
    const capture = f.workspace.captureCpiHeadlineSource(
      cpiHeadlinesFixture().items[0]!.url,
      () => true,
    ).capture!;
    const entry = f.prepare(capture).create()!;
    let done!: () => void;
    const pending = new Promise<void>((resolve) => {
      done = resolve;
    });
    const model =
      kind === "bls"
        ? f.workspace.blsCalendar
        : kind === "bea"
          ? f.workspace.agenda
          : f.workspace.announcements;
    if (kind === "bls")
      vi.mocked(f.api.blsCalendar).mockImplementationOnce(async () => {
        await pending;
        return f.packets.bls;
      });
    if (kind === "bea")
      vi.mocked(f.api.economicCalendar).mockImplementationOnce(async () => {
        await pending;
        return f.packets.bea;
      });
    if (kind === "fed")
      vi.mocked(f.api.monetaryAnnouncements).mockImplementationOnce(
        async () => {
          await pending;
          return f.packets.fed;
        },
      );
    const loading = model.load();
    const nav = vi.fn(() => true);
    expect(
      f.workspace.reviewMarketsBriefingFollowup(entry, capture, nav),
    ).toBeNull();
    expect(nav).not.toHaveBeenCalled();
    done();
    await loading;
  },
);
it("retires on source publication without waiting for a getter or workspace update", async () => {
  const f = await retained();
  f.workspace.announcements.enter();
  await f.workspace.announcements.load();
  expect(f.workspace.getMarketsBriefingReading()).toBeNull();
  expect(f.workspace.returnToMarketsBriefing(() => true)).toBe(false);
});
it("refuses a changed source inside the departure callback", async () => {
  const f = await fixture();
  const entry = f.prepare().create()!;
  expect(
    f.workspace.reviewMarketsBriefingFollowup(entry, f.source, () => {
      void f.workspace.announcements.load();
      return navigate(f.workspace, "followups");
    }),
  ).toBeNull();
  expect(f.workspace.getMarketsBriefingReading()).toBeNull();
});
it("consumes return before a nested callback and rechecks installed ownership", async () => {
  const f = await retained();
  const nested = vi.fn(() => true);
  expect(
    f.workspace.returnToMarketsBriefing(() => {
      expect(f.workspace.returnToMarketsBriefing(nested)).toBe(false);
      return navigate(f.workspace, "markets");
    }),
  ).toBe(true);
  expect(nested).not.toHaveBeenCalled();
  const g = await retained();
  expect(g.workspace.returnToMarketsBriefing(() => false)).toBe(false);
  expect(g.workspace.getMarketsBriefingReading()).toBeNull();
  expect(g.workspace.isMarketsBriefingPassive()).toBe(false);
});
