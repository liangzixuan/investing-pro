import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MANAGED_BLS_CALENDAR_SOURCE,
  parseManagedBlsCalendar,
  parseManagedEconomicCalendar,
  parseManagedMonetaryAnnouncements,
} from "@research-cockpit/contracts";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import { prepareCalendarFollowup } from "./managed-calendar-followup";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { TrialApiError } from "./api";

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
  const bls = parseManagedBlsCalendar({
    ...economicCalendarFixture(),
    source: MANAGED_BLS_CALENDAR_SOURCE,
  })!;
  const bea = parseManagedEconomicCalendar(economicCalendarFixture())!;
  const fed = parseManagedMonetaryAnnouncements(fedAnnouncementsFixture())!;
  let saved = await base.api.load(new AbortController().signal);
  const api: ManagedApi = {
    ...base.api,
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

it("keeps the full cited unknown-time check once and saves only the independent Follow-ups draft", async () => {
  const f = await fixture();
  const watchlist = f.workspace.coordinator.getSnapshot();
  const preview = f.prepare();
  expect(preview.check).toContain("Café 東京 😀");
  expect(preview.check).toContain("Fed announcement:");
  expect(preview.check).toContain("published unknown");
  expect(preview.check).toContain(f.packets.fed.items[1]!.url);
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

describe.each(["bls", "bea", "fed"] as const)(
  "%s original source ownership",
  (kind) => {
    it("uses only the exact current admitted item and refuses forged source captures and rebound company objects", async () => {
      const f = await fixture();
      const source = f.capture(kind);
      expect(f.prepare(source).check).toContain(
        kind === "fed"
          ? "published unknown"
          : "scheduled 2026-10-30T12:30:00.000Z",
      );
      expect(
        f.workspace.captureMarketsCalendarSource("unknown:key", () => true)
          .capture,
      ).toBeNull();
      expect(
        f.workspace.captureMarketsCalendarFollowup({ ...source }, f.member)
          .port,
      ).toBeNull();
      expect(
        f.workspace.captureMarketsCalendarFollowup(source, { ...f.member })
          .port,
      ).toBeNull();
      expect(
        f.workspace.captureMarketsCalendarFollowup(source, {
          ...f.member,
          shareClassId: "other-class",
        }).port,
      ).toBeNull();
    });
    it("retires an old preview on refresh even when the complete source payload returns unchanged", async () => {
      const f = await fixture();
      const source = f.capture(kind);
      const old = f.prepare(source);
      const model =
        kind === "bls"
          ? f.workspace.blsCalendar
          : kind === "bea"
            ? f.workspace.agenda
            : f.workspace.announcements;
      await model.load();
      expect(source.isCurrent()).toBe(false);
      expect(old.create()).toBeNull();
      expect(f.prepare(f.capture(kind)).create()).not.toBeNull();
    });
  },
);

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
  expect(f.api.monetaryAnnouncements).toHaveBeenCalledOnce();
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

it("never revives previews after day selection, route or source-pass reentry", async () => {
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
  await f.workspace.announcements.load();
  request.resolve(result);
  await pending;
  expect(f.source.isCurrent()).toBe(false);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.followups.coordinator.getSnapshot().saved).toBeNull();
});
