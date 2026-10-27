import { describe, expect, it, vi } from "vitest";
import {
  MANAGED_BLS_CALENDAR_SOURCE,
  parseManagedBlsCalendar,
  parseManagedEconomicCalendar,
  parseManagedMonetaryAnnouncements,
  type MainWatchlistPayload,
  type ResearchFollowup,
  type ResearchFollowupsPayload,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";
import { ManagedResearchFollowups } from "./managed-research-followups";
import {
  calendarFollowupEvidence,
  prepareCalendarFollowup,
  resolveCalendarFollowupSource,
  type CalendarFollowupPort,
  type CalendarFollowupSource,
} from "./managed-calendar-followup";

const listing = filingsSelection.listing;
const member: WatchlistMembership = {
  ...listing,
  note: "Unchanged company note",
};
const digest = filingsResponse(1).catalogSnapshotSha256;
const due = "2026-12-31";
const question = "Could this change the next research decision?";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const payload = (...entries: ResearchFollowup[]): ResearchFollowupsPayload => ({
  schemaVersion: 1,
  entries,
});
function packets() {
  const bea = parseManagedEconomicCalendar(economicCalendarFixture())!;
  const bls = parseManagedBlsCalendar({
    ...economicCalendarFixture(),
    source: MANAGED_BLS_CALENDAR_SOURCE,
  })!;
  const fed = parseManagedMonetaryAnnouncements(fedAnnouncementsFixture())!;
  return { bls, bea, fed };
}
function snapshots() {
  const p = packets();
  return {
    bls: {
      calendar: p.bls,
      busy: false,
      showingPrevious: false,
      error: null,
      message: "",
    },
    bea: {
      agenda: p.bea,
      refreshComparison: null,
      busy: false,
      showingPrevious: false,
      error: null,
      message: "",
    },
    fed: {
      announcements: p.fed,
      refreshComparison: null,
      busy: false,
      showingPrevious: false,
      error: null,
      message: "",
    },
  };
}
function keyFor(source: CalendarFollowupSource) {
  if (source.kind === "fed") return `fed:${source.item.url}`;
  return `${source.kind}:${JSON.stringify([source.item.series, source.item.scheduledAt])}`;
}
function sourceFor(
  kind: CalendarFollowupSource["kind"],
  index = 0,
): CalendarFollowupSource {
  const p = packets();
  if (kind === "bls")
    return {
      kind,
      packet: p.bls,
      item: p.bls.events[index]!,
      showingPrevious: false,
    };
  if (kind === "bea")
    return {
      kind,
      packet: p.bea,
      item: p.bea.events[index]!,
      showingPrevious: false,
    };
  return {
    kind,
    packet: p.fed,
    item: p.fed.items[index]!,
    showingPrevious: false,
  };
}
function entry(n: number, current = false): ResearchFollowup {
  return {
    id: id(n),
    listing: current ? listing : { ...listing, listingId: `other-${n}` },
    catalogSnapshotSha256: digest,
    check: "An existing authored check",
    dueOn: due,
    status: "completed",
    completedOn: "2026-10-20",
    result: "Existing result",
  };
}
function modelFixture(initial: ResearchFollowupsPayload) {
  const api = {
    loadFollowups: vi.fn<ManagedApi["loadFollowups"]>(() =>
      Promise.resolve({
        version: initial.entries.length ? 1 : 0,
        payload: initial,
      }),
    ),
    saveFollowups: vi.fn<ManagedApi["saveFollowups"]>(),
    resolve: vi.fn<ManagedApi["resolve"]>(),
  };
  const context: {
    draft: MainWatchlistPayload;
    catalogSnapshotSha256: string;
  } = {
    draft: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: digest,
      memberships: [member],
    },
    catalogSnapshotSha256: digest,
  };
  const model = new ManagedResearchFollowups(
    api,
    {
      userId: "invented-user",
      sessionId: "invented-session",
      getToken: vi.fn(),
      signOut: vi.fn(),
    },
    {
      getCreationContext: () => context,
      onRetire: vi.fn(),
      newEntryId: () => id(100),
    },
  );
  return { api, context, model };
}
async function fixture(
  options: {
    source?: CalendarFollowupSource;
    entries?: ResearchFollowup[];
    load?: boolean;
  } = {},
) {
  const f = modelFixture(payload(...(options.entries ?? [])));
  if (options.load !== false) await f.model.coordinator.load();
  const source = options.source ?? sourceFor("bls");
  const saved = f.model.coordinator.getSnapshot();
  const watchlist = f.context.draft;
  const host: {
    source: object;
    form: boolean;
    active: boolean;
    onCurrent?: () => void;
  } = { source, form: true, active: true };
  const port: CalendarFollowupPort = {
    model: f.model,
    member,
    source,
    isCurrent: () => {
      host.onCurrent?.();
      return (
        host.active &&
        host.source === source &&
        f.context.draft === watchlist &&
        f.model.coordinator.getSnapshot() === saved
      );
    },
  };
  const prepare = (raw = question, date = due) =>
    prepareCalendarFollowup(port, raw, date, () => host.form);
  return { ...f, port, host, prepare };
}
function noExternalWrites(f: Awaited<ReturnType<typeof fixture>>) {
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(f.context.draft.memberships).toEqual([member]);
}

describe("exact loaded calendar source", () => {
  it.each(["bls", "bea", "fed"] as const)(
    "resolves the original %s item by the exact day key",
    (kind) => {
      const state = snapshots();
      const candidate = sourceFor(kind);
      const resolved = resolveCalendarFollowupSource(keyFor(candidate), state)!;
      expect(resolved.kind).toBe(kind);
      expect(Object.isFrozen(resolved)).toBe(true);
      if (resolved.kind === "bls") {
        expect(resolved.packet).toBe(state.bls.calendar);
        expect(resolved.item).toBe(state.bls.calendar.events[0]);
      } else if (resolved.kind === "bea") {
        expect(resolved.packet).toBe(state.bea.agenda);
        expect(resolved.item).toBe(state.bea.agenda.events[0]);
      } else {
        expect(resolved.packet).toBe(state.fed.announcements);
        expect(resolved.item).toBe(state.fed.announcements.items[0]);
      }
    },
  );
  it.each(["bls", "bea", "fed"] as const)(
    "refuses busy or missing %s without using another source",
    (kind) => {
      const state = snapshots();
      const key = keyFor(sourceFor(kind));
      state[kind].busy = true;
      expect(resolveCalendarFollowupSource(key, state)).toBeNull();
      state[kind].busy = false;
      const empty = {
        bls: { ...state.bls, calendar: null },
        bea: { ...state.bea, agenda: null },
        fed: { ...state.fed, announcements: null },
      };
      expect(resolveCalendarFollowupSource(key, empty)).toBeNull();
    },
  );
  it.each([
    "",
    "price:ALFA",
    "bls:[]",
    "bea:[]",
    "fed:missing",
    'bls:["Invented October release"]',
  ])("refuses unknown or incomplete key %j", (key) => {
    expect(resolveCalendarFollowupSource(key, snapshots())).toBeNull();
  });
  it("does not conflate equal schedule series/instants between agencies", () => {
    const state = snapshots();
    const bls = resolveCalendarFollowupSource(keyFor(sourceFor("bls")), state)!;
    const bea = resolveCalendarFollowupSource(keyFor(sourceFor("bea")), state)!;
    expect(calendarFollowupEvidence(bls)!.url).toBe(
      MANAGED_BLS_CALENDAR_SOURCE.scheduleUrl,
    );
    expect(calendarFollowupEvidence(bea)!.url).toBe(
      state.bea.agenda.source.scheduleUrl,
    );
    expect(bls.item).not.toBe(bea.item);
  });
  it("keeps original retained clocks and allows an unrelated busy source", () => {
    const state = snapshots();
    state.bls.showingPrevious = true;
    state.fed.busy = true;
    const selected = resolveCalendarFollowupSource(
      keyFor(sourceFor("bls")),
      state,
    )!;
    expect(calendarFollowupEvidence(selected)).toEqual({
      sourceName: state.bls.calendar.source.name,
      title: state.bls.calendar.events[0]!.series,
      url: state.bls.calendar.source.scheduleUrl,
      instant: state.bls.calendar.events[0]!.scheduledAt,
      timeKind: "scheduled",
      fetchedAt: state.bls.calendar.fetchedAt,
      window: state.bls.calendar.window,
      showingPrevious: true,
    });
  });
  it("resolves refreshed objects without rebinding an earlier source capture", () => {
    const state = snapshots();
    const key = keyFor(sourceFor("bea"));
    const first = resolveCalendarFollowupSource(key, state)!;
    state.bea.agenda = packets().bea;
    const refreshed = resolveCalendarFollowupSource(key, state)!;
    expect(refreshed.packet).not.toBe(first.packet);
    expect(refreshed.item).not.toBe(first.item);
    expect(calendarFollowupEvidence(first)!.fetchedAt).toBe(
      first.packet.fetchedAt,
    );
  });
  it.each(["bls", "bea", "fed"] as const)(
    "refuses cloned or foreign %s items",
    (kind) => {
      const source = sourceFor(kind);
      expect(
        calendarFollowupEvidence({
          ...source,
          item: { ...source.item },
        } as CalendarFollowupSource),
      ).toBeNull();
      expect(
        calendarFollowupEvidence({
          ...source,
          item: sourceFor(kind).item,
        } as CalendarFollowupSource),
      ).toBeNull();
    },
  );
  it("refuses a forged agency discriminant and invalid retained status", () => {
    expect(
      calendarFollowupEvidence({
        ...sourceFor("bea"),
        kind: "bls",
      } as unknown as CalendarFollowupSource),
    ).toBeNull();
    expect(
      calendarFollowupEvidence({
        ...sourceFor("fed"),
        showingPrevious: "yes",
      } as unknown as CalendarFollowupSource),
    ).toBeNull();
  });
});

it("refuses all admitted checked-empty packets without inferring an item", () => {
  const state = snapshots();
  state.bls.calendar = parseManagedBlsCalendar({
    ...state.bls.calendar,
    events: [],
  })!;
  state.bea.agenda = parseManagedEconomicCalendar({
    ...state.bea.agenda,
    events: [],
  })!;
  state.fed.announcements = parseManagedMonetaryAnnouncements({
    ...state.fed.announcements,
    availableItemCount: 0,
    items: [],
  })!;
  for (const kind of ["bls", "bea", "fed"] as const) {
    expect(
      resolveCalendarFollowupSource(keyFor(sourceFor(kind)), state),
    ).toBeNull();
  }
  expect(state.bls.calendar.fetchedAt).toBe(packets().bls.fetchedAt);
  expect(state.bea.agenda.fetchedAt).toBe(packets().bea.fetchedAt);
  expect(state.fed.announcements.fetchedAt).toBe(packets().fed.fetchedAt);
});

describe("independent company calendar question", () => {
  it.each(["bls", "bea", "fed"] as const)(
    "previews and creates the complete original %s citation once",
    async (kind) => {
      const source = sourceFor(kind);
      const f = await fixture({ source });
      const evidence = calendarFollowupEvidence(source)!;
      const original = structuredClone(source);
      const expectedCitation =
        kind === "fed"
          ? `Fed announcement: ${evidence.title}; published ${evidence.instant}; ${evidence.url}`
          : `${kind.toUpperCase()} schedule: ${evidence.title}; scheduled ${evidence.instant}; ${evidence.url}`;
      const preview = f.prepare().preview!;
      expect(preview.check).toBe(`Question: ${question} | ${expectedCitation}`);
      expect(preview.dueOn).toBe(due);
      expect(preview.listing).toEqual(listing);
      expect(Object.isFrozen(preview)).toBe(true);
      expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
      const created = preview.create()!;
      expect(created.check).toBe(preview.check);
      expect(created.dueOn).toBe(due);
      expect(created.listing).toEqual(listing);
      expect(created.status).toBe("open");
      expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([
        created,
      ]);
      expect(preview.create()).toBeNull();
      expect(preview.isCurrent()).toBe(false);
      expect(source).toEqual(original);
      noExternalWrites(f);
    },
  );
  it("keeps unknown Fed publication time separate from retrieval and due dates", async () => {
    const source = sourceFor("fed", 1);
    const f = await fixture({ source });
    expect(calendarFollowupEvidence(source)).toMatchObject({
      instant: null,
      timeKind: "published",
      window: null,
      fetchedAt: source.packet.fetchedAt,
    });
    expect(f.prepare().preview!.check).toContain("; published unknown;");
    expect(f.prepare(question, "0001-01-01").preview!.dueOn).toBe("0001-01-01");
    noExternalWrites(f);
  });
  it("does not load Follow-ups or claim readiness from a missing draft", async () => {
    const f = await fixture({ load: false });
    expect(f.prepare().preview).toBeNull();
    expect(f.prepare().reason).toContain("Load follow-ups");
    expect(f.api.loadFollowups).not.toHaveBeenCalled();
    noExternalWrites(f);
  });
  it.each([
    "",
    " ",
    "line\nbreak",
    "tab\tcheck",
    "control\u0000",
    "format\u200d",
    "surrogate\ud800",
    "😀".repeat(501),
  ])("refuses invalid raw question %j without clipping", async (raw) => {
    const f = await fixture();
    const saved = f.model.coordinator.getSnapshot();
    expect(f.prepare(raw).preview).toBeNull();
    expect(f.model.coordinator.getSnapshot()).toBe(saved);
    noExternalWrites(f);
  });
  it("checks the complete raw Unicode code-point limit before normalization", async () => {
    const f = await fixture();
    const overhead = [...f.prepare("a").preview!.check].length - 1;
    const room = 500 - overhead;
    const preview = f.prepare("😀".repeat(room)).preview!;
    expect([...preview.check]).toHaveLength(500);
    expect(preview.create()!.check).toBe(preview.check);
    const fresh = await fixture();
    expect(fresh.prepare("😀".repeat(room + 1)).preview).toBeNull();
    expect(
      fresh.prepare("e\u0301".repeat(Math.floor(room / 2) + 1)).preview,
    ).toBeNull();
    noExternalWrites(fresh);
  });
  it("previews the full normalized Unicode text which will be stored", async () => {
    const f = await fixture();
    const preview = f.prepare("  Cafe\u0301 東京 📈  ").preview!;
    expect(preview.check).toContain(
      "Question:   Café 東京 📈   | BLS schedule:",
    );
    expect(preview.create()!.check).toBe(preview.check);
  });
  it.each([
    "",
    "2026-02-29",
    "0000-01-01",
    "10000-01-01",
    "2026-12-31T00:00:00Z",
  ])("refuses invalid UTC planning date %j", async (date) => {
    const f = await fixture();
    expect(f.prepare(question, date).preview).toBeNull();
    noExternalWrites(f);
  });
  it("preserves an existing completed listing check and its result", async () => {
    const existing = entry(1, true);
    const f = await fixture({ entries: [existing] });
    const saved = f.model.coordinator.getSnapshot();
    expect(f.prepare().reason).toContain("already has a follow-up");
    expect(f.prepare().preview).toBeNull();
    expect(f.model.coordinator.getSnapshot()).toBe(saved);
    expect(saved.draft!.entries).toEqual([existing]);
    noExternalWrites(f);
  });
  it("retains the underlying twenty-entry boundary", async () => {
    const f = await fixture({
      entries: Array.from({ length: 20 }, (_, i) => entry(i)),
    });
    expect(f.prepare().reason).toContain("20 entries");
    expect(f.prepare().preview).toBeNull();
    noExternalWrites(f);
  });
  it("refuses a cloned membership despite an unrelated calendar source", async () => {
    const f = await fixture();
    expect(
      prepareCalendarFollowup(
        { ...f.port, member: { ...member } },
        question,
        due,
        () => true,
      ).preview,
    ).toBeNull();
    noExternalWrites(f);
  });
});

describe("owned calendar preview lifetime", () => {
  it("consumes before reentrant source and draft notifications", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    const nested: (ResearchFollowup | null)[] = [];
    f.host.onCurrent = () => {
      nested.push(preview.create());
    };
    const stop = f.model.coordinator.subscribe(() =>
      nested.push(preview.create()),
    );
    expect(preview.create()).not.toBeNull();
    stop();
    expect(nested.length).toBeGreaterThan(0);
    expect(nested.every((value) => value === null)).toBe(true);
    expect(f.model.coordinator.getSnapshot().draft!.entries).toHaveLength(1);
    noExternalWrites(f);
  });
  it("prevents a source callback from creating during currentness inspection", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    f.host.onCurrent = () => {
      expect(preview.create()).toBeNull();
    };
    expect(preview.isCurrent()).toBe(false);
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
  });
  it("rejects detached and copied preview methods without consuming the original", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    const create = preview.create;
    const cancel = preview.cancel;
    expect(create()).toBeNull();
    expect({ ...preview }.create()).toBeNull();
    cancel();
    expect(preview.isCurrent()).toBe(true);
    expect(preview.create()).not.toBeNull();
    noExternalWrites(f);
  });
  it("Cancel consumes without changing either draft", async () => {
    const f = await fixture();
    const saved = f.model.coordinator.getSnapshot();
    const preview = f.prepare().preview!;
    preview.cancel();
    expect(preview.create()).toBeNull();
    expect(preview.isCurrent()).toBe(false);
    expect(f.model.coordinator.getSnapshot()).toBe(saved);
    noExternalWrites(f);
  });
  it.each(["form", "active"] as const)(
    "permanently retires an observed %s round trip",
    async (boundary) => {
      const f = await fixture();
      const preview = f.prepare().preview!;
      f.host[boundary] = false;
      expect(preview.isCurrent()).toBe(false);
      f.host[boundary] = true;
      expect(preview.create()).toBeNull();
      noExternalWrites(f);
    },
  );
  it("retires a refreshed source even if the old source is restored later", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    const original = f.host.source;
    f.host.source = sourceFor("bls");
    expect(preview.isCurrent()).toBe(false);
    f.host.source = original;
    expect(preview.create()).toBeNull();
    noExternalWrites(f);
  });
  it("retires a rebound port and never retargets another company", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    const mutable = f.port as { member: WatchlistMembership };
    mutable.member = { ...member };
    expect(preview.isCurrent()).toBe(false);
    mutable.member = member;
    expect(preview.create()).toBeNull();
    noExternalWrites(f);
  });
  it("rechecks lifetime after underlying preparation", async () => {
    const f = await fixture();
    const original = f.model.prepareNextCheck.bind(f.model);
    vi.spyOn(f.model, "prepareNextCheck").mockImplementation((...args) => {
      const result = original(...args);
      f.host.active = false;
      return result;
    });
    expect(f.prepare().preview).toBeNull();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toEqual([]);
    noExternalWrites(f);
  });
  it("cannot reuse two previews across the first independent draft creation", async () => {
    const f = await fixture();
    const first = f.prepare().preview!;
    const second = f.prepare("Another question").preview!;
    expect(first.create()).not.toBeNull();
    expect(second.create()).toBeNull();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toHaveLength(1);
    noExternalWrites(f);
  });
  it("retires both a catalog change and same-content draft replacement", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    f.context.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
    expect(preview.create()).toBeNull();
    const next = await fixture();
    const other = next.prepare().preview!;
    const original = next.model.coordinator.getSnapshot().draft!;
    next.model.coordinator.replaceDraft(payload(entry(1)));
    next.model.coordinator.replaceDraft(original);
    expect(other.create()).toBeNull();
    noExternalWrites(next);
  });
});

it.each(["source", "model", "isCurrent"] as const)(
  "permanently refuses a rebound port %s",
  async (field) => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    const original = f.port[field];
    const mutable = f.port as {
      -readonly [K in keyof CalendarFollowupPort]: CalendarFollowupPort[K];
    };
    if (field === "source") mutable.source = sourceFor("bls");
    if (field === "model") mutable.model = modelFixture(payload()).model;
    if (field === "isCurrent") mutable.isCurrent = () => true;
    expect(preview.isCurrent()).toBe(false);
    Object.assign(mutable, { [field]: original });
    expect(preview.create()).toBeNull();
    noExternalWrites(f);
  },
);
