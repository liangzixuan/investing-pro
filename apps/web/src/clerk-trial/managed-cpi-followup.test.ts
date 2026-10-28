import { it, expect, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ResearchFollowup,
  ResearchFollowupsPayload,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";
import { ManagedResearchFollowups } from "./managed-research-followups";
import {
  prepareCalendarFollowup,
  calendarFollowupEvidence,
  type CalendarFollowupPort,
  type CalendarFollowupSource,
} from "./managed-calendar-followup";
import { cpiHeadlinesFixture } from "./cpi-headlines-fixture";
const listing = filingsSelection.listing;
const member: WatchlistMembership = {
  ...listing,
  note: "Preserved unsaved note",
};
const digest = filingsResponse(1).catalogSnapshotSha256;
const due = "2026-12-31";
const question = "Will this change my research? Café 東京 📈";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const payload = (...entries: ResearchFollowup[]): ResearchFollowupsPayload => ({
  schemaVersion: 1,
  entries,
});
function cpiSource(
  index = 0,
): Extract<CalendarFollowupSource, { kind: "cpi" }> {
  const packet = cpiHeadlinesFixture();
  return {
    kind: "cpi",
    packet,
    item: packet.items[index]!,
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
  const source = options.source ?? cpiSource();
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

it("preserves exact known and unknown source clocks in the complete untruncated citation", async () => {
  for (const index of [0, 1]) {
    const source = cpiSource(index);
    const f = await fixture({ source });
    const p = f.prepare().preview!;
    expect(p.check).toBe(
      `Question: ${question} | U.S. Bureau of Labor Statistics CPI headline: ${source.item.title}. Feed published: ${source.item.publishedAt ?? "unknown"}; feed updated: ${source.item.updatedAt ?? "unknown"}. ${source.item.url}`,
    );
    expect(calendarFollowupEvidence(source)).toMatchObject({
      timeKind: "feed-published",
      instant: source.item.publishedAt,
      itemUpdatedAt: source.item.updatedAt,
      feedUpdatedAt: source.packet.feedUpdatedAt,
      fetchedAt: source.packet.fetchedAt,
      sourceId: source.item.sourceId,
    });
    expect(p.dueOn).toBe(due);
  }
});
it("accepts exactly500 Unicode codepoints and refuses501 without clipping or draft admission", async () => {
  const f = await fixture();
  const single = f.prepare("📈").preview!;
  const overhead = Array.from(single.check).length - 1;
  const raw = "📈".repeat(500 - overhead);
  const full = f.prepare(raw).preview!;
  expect(Array.from(full.check)).toHaveLength(500);
  expect(full.check).toContain(raw);
  const before = f.model.coordinator.getSnapshot();
  const spy = vi.spyOn(f.model, "prepareNextCheck");
  const refused = f.prepare(raw + "📈");
  expect(refused.preview).toBeNull();
  expect(refused.reason).toContain("Nothing was clipped or changed");
  expect(spy).not.toHaveBeenCalled();
  expect(f.model.coordinator.getSnapshot()).toBe(before);
  expect(raw).toHaveLength((500 - overhead) * 2);
});
it.each([
  "line\nbreak",
  "hidden\u200Bformat",
  "control\u0000text",
  "unpaired\uD800",
])(
  "refuses non-one-line authored text %j without normalizing away hidden content",
  async (raw) => {
    const f = await fixture();
    expect(f.prepare(raw).preview).toBeNull();
    expect(f.model.coordinator.getSnapshot().draft!.entries).toHaveLength(0);
  },
);
it("uses an independent authored due date and existing invalid-date validation", async () => {
  const f = await fixture();
  expect(f.prepare(question, "2020-01-01").preview?.dueOn).toBe("2020-01-01");
  for (const date of ["2026-02-30", "2026-10-01T00:00:00Z", ""])
    expect(f.prepare(question, date).preview).toBeNull();
});
it("rejects detached or malformed source metadata instead of composing a partial citation", async () => {
  const source = cpiSource();
  expect(
    calendarFollowupEvidence({ ...source, item: { ...source.item } }),
  ).toBeNull();
  const invalid = {
    ...source.packet,
    items: [{ ...source.item, updatedAt: "2026-02-30T00:00:00Z" }],
  };
  const f = await fixture({
    source: { ...source, packet: invalid, item: invalid.items[0]! },
  });
  expect(f.prepare().preview).toBeNull();
});
it("keeps duplicate and20-entry bounds and never writes during preview/Create", async () => {
  const full = await fixture({
    entries: Array.from({ length: 20 }, (_, n) => entry(n + 1)),
  });
  expect(full.prepare().preview).toBeNull();
  const duplicate = await fixture({ entries: [entry(1, true)] });
  expect(duplicate.prepare().preview).toBeNull();
  const f = await fixture();
  const value = f.prepare().preview!;
  let reentered: unknown;
  const stop = f.model.coordinator.subscribe(() => {
    reentered = value.create();
  });
  const result = value.create();
  stop();
  expect(result?.check).toBe(value.check);
  expect(reentered).toBeNull();
  expect(value.create()).toBeNull();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(f.context.draft.memberships).toEqual([member]);
});
