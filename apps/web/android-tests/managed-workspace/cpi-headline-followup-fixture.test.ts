import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, describe, expect, it } from "vitest";
import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
  parseManagedCpiHeadlines,
  type ManagedResearchFollowupsCommand,
} from "@research-cockpit/contracts";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { prepareCalendarFollowup } from "../../src/clerk-trial/managed-calendar-followup";
import { createFixture } from "./fixture";
import { CpiHeadlineFollowupFixtureDiagnostics } from "./cpi-headline-followup-fixture-diagnostics";
import {
  cpiFollowupCheck,
  cpiFollowupDueOn,
  cpiFollowupExpected,
  cpiFollowupOriginal,
  cpiFollowupPacket,
  cpiFollowupPublishedAt,
  cpiFollowupQuestion,
  cpiFollowupUpdatedAt,
  cpiFollowupUrl,
  cpiFollowupWatchlistNote,
} from "./cpi-headline-followup-fixture";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.sessionOwner.dispose();
});
function owner(fixture: Fixture, fresh = false) {
  const workspace = new ManagedWorkspace(
    fixture.api,
    fresh ? fixture.followups!.nextSession() : fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
    },
  );
  owners.push(workspace);
  return workspace;
}
async function setup() {
  const fixture = await createFixture("cpi-headline-followup");
  const workspace = owner(fixture);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.note("listing-zero", cpiFollowupWatchlistNote);
  workspace.setView("markets");
  for (let i = 0; i < 8; i++) await Promise.resolve();
  return { fixture, workspace };
}
type Mounted = Awaited<ReturnType<typeof setup>>;
async function loaded(f: Mounted) {
  expect(await f.workspace.cpiHeadlines.load()).toBe("accepted");
  const capture = f.workspace.captureCpiHeadlineSource(
    cpiFollowupUrl,
    () => true,
  );
  expect(capture.reason).toBeNull();
  const member = f.workspace.coordinator.getSnapshot().draft!.memberships[0]!;
  expect(member.listingId).toBe("listing-zero");
  await f.workspace.loadMarketsCalendarFollowups(
    capture.capture!,
    member,
    () => true,
  );
  const context = f.workspace.captureMarketsCalendarFollowup(
    capture.capture!,
    member,
  );
  expect(context.reason).toBeNull();
  return { capture: capture.capture!, port: context.port! };
}
function preview(port: Awaited<ReturnType<typeof loaded>>["port"]) {
  const result = prepareCalendarFollowup(
    port,
    cpiFollowupQuestion,
    cpiFollowupDueOn,
    () => true,
  );
  expect(result.reason).toBeNull();
  expect(result.preview!.check).toBe(cpiFollowupCheck);
  return result.preview!;
}
function noOtherEffects(fixture: Fixture, sessions = 1, resolve = 0) {
  expect(fixture.getSnapshot()).toMatchObject({
    load: sessions,
    cpi: 1,
    resolve,
    save: 0,
    eod: 0,
    annual: 0,
    interimReport: 0,
    filings: 0,
    marketsEod: 0,
    calendar: 0,
    bls: 0,
    fed: 0,
    search: 0,
    portfolioLoad: 0,
    portfolioSave: 0,
    valuationLoad: 0,
    valuationSave: 0,
    token: 0,
    signOut: 0,
  });
  expect(fixture.followups!.getSnapshot()).toMatchObject({
    replays: 0,
    token: 0,
    signOut: 0,
  });
}
function diagnostic(f: Mounted) {
  const html = renderToStaticMarkup(
    createElement(CpiHeadlineFollowupFixtureDiagnostics, f),
  );
  return JSON.parse(load(html)("#fixture-cpi-followup-evidence").text()) as {
    encodedWatchlist: string | null;
    encodedFollowups: string | null;
    originalEncodedFollowups: string;
    expectedEncodedFollowups: string | null;
    packet: ReturnType<typeof cpiFollowupPacket> | null;
  };
}

describe("invented native CPI headline-to-check fixture", () => {
  it("opens Markets and chooses no source or company automatically", async () => {
    const f = await setup();
    expect(f.fixture.getSnapshot()).toMatchObject({
      load: 1,
      cpi: 0,
      resolve: 0,
      save: 0,
    });
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      load: 0,
      save: 0,
    });
    expect(f.workspace.cpiHeadlines.getSnapshot().headlines).toBeNull();
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(
      f.workspace.coordinator
        .getSnapshot()
        .draft!.memberships.map((m) => [m.listingId, m.shareClassName]),
    ).toEqual([
      ["listing-zero", "Class A"],
      ["listing-beta-a", "Class A"],
      ["listing-beta-c", "Class C"],
    ]);
    expect(diagnostic(f)).toMatchObject({
      encodedFollowups: null,
      expectedEncodedFollowups: null,
      packet: null,
    });
  });
  it("keeps invented raw offset/fraction clocks, null clocks, retrieval and root clock independent", () => {
    const packet = cpiFollowupPacket();
    expect(packet.items[0]).toMatchObject({
      publishedAt: cpiFollowupPublishedAt,
      updatedAt: cpiFollowupUpdatedAt,
    });
    expect(packet.items[1]).toMatchObject({
      publishedAt: null,
      updatedAt: null,
    });
    expect(packet.feedUpdatedAt).toBe("2026-10-03T06:45:09.000000001+02:00");
    expect(packet.fetchedAt).toBe("2026-10-28T19:00:00.000Z");
    expect(Array.from(cpiFollowupCheck).length).toBeLessThanOrEqual(500);
    for (const bad of [
      "2026-10-01",
      "2026-10-01T07:15:22",
      "2026-02-30T07:15:22Z",
      "",
    ])
      expect(
        parseManagedCpiHeadlines({
          ...packet,
          items: [{ ...packet.items[0], publishedAt: bad }, packet.items[1]],
        }),
      ).toBeNull();
  });
  it("keeps the full canonical citation through one Create, Review/Research/Back, separate Save and fresh explicit Load", async () => {
    const f = await setup();
    const watchlist = f.workspace.coordinator.getSnapshot();
    const encodedWatchlist = encodeMainWatchlistPayload(watchlist.draft!);
    const { port } = await loaded(f);
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toEqual(
      cpiFollowupOriginal(f.fixture),
    );
    noOtherEffects(f.fixture);
    const cancelled = preview(port);
    cancelled.cancel();
    expect(cancelled.create()).toBeNull();
    const check = preview(port);
    expect(check.dueOn).toBe(cpiFollowupDueOn);
    expect(check.listing).toEqual(
      f.fixture.researchCoverage.listings[0]!.listing,
    );
    const entry = check.create()!;
    expect(entry).not.toBeNull();
    expect(check.create()).toBeNull();
    const expected = encodeResearchFollowupsPayload(
      cpiFollowupExpected(f.fixture, entry.id),
    );
    expect(diagnostic(f)).toMatchObject({
      encodedWatchlist,
      encodedFollowups: expected,
      expectedEncodedFollowups: expected,
      packet: cpiFollowupPacket(),
    });
    const review = f.workspace.reviewFollowup(entry, () => {
      f.workspace.setView("followups");
      return true;
    });
    expect(review?.entry).toBe(entry);
    expect(f.workspace.followups.getSnapshot()).toMatchObject({
      selectedId: entry.id,
      filter: "open",
    });
    const prepared = await f.workspace.prepareFollowupResearch(entry);
    expect(prepared).not.toBeNull();
    f.workspace.openFollowupResearch(prepared!);
    expect(f.workspace.getSnapshot().research?.selection.listing).toEqual(
      entry.listing,
    );
    f.workspace.closeResearch();
    expect(f.workspace.getSnapshot()).toMatchObject({
      view: "followups",
      research: null,
    });
    noOtherEffects(f.fixture, 1, 1);
    expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
    await f.workspace.followups.coordinator.save();
    expect(f.fixture.followups!.getSnapshot()).toMatchObject({
      load: 1,
      save: 1,
      commits: 1,
    });
    expect(diagnostic(f)).toMatchObject({
      encodedWatchlist,
      encodedFollowups: expected,
      expectedEncodedFollowups: expected,
    });
    expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
    expect(watchlist.dirty).toBe(true);
    f.workspace.sessionOwner.dispose();
    const fresh = owner(f.fixture, true);
    await fresh.coordinator.load();
    await fresh.refreshCatalog();
    expect(fresh.cpiHeadlines.getSnapshot().headlines).toBeNull();
    expect(fresh.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(fresh.coordinator.getSnapshot().draft!.memberships[0]!.note).toBe(
      "Original independent CPI note",
    );
    await fresh.followups.coordinator.load();
    expect(diagnostic({ fixture: f.fixture, workspace: fresh })).toMatchObject({
      encodedFollowups: expected,
      expectedEncodedFollowups: expected,
      packet: null,
    });
    expect(fresh.followups.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 2,
      dirty: false,
    });
    noOtherEffects(f.fixture, 2, 1);
  });
  it("refuses malformed RAM command envelopes and every altered complete resource before admitting one canonical Save", async () => {
    const f = await setup();
    const { port } = await loaded(f);
    const entry = preview(port).create()!;
    f.workspace.reviewFollowup(entry, () => {
      f.workspace.setView("followups");
      return true;
    });
    const prepared = await f.workspace.prepareFollowupResearch(entry);
    expect(prepared).not.toBeNull();
    const command: ManagedResearchFollowupsCommand = {
      expectedVersion: 1,
      idempotencyKey: "40000000-0000-4000-8000-000000000001",
      payload: cpiFollowupExpected(f.fixture, entry.id),
    };
    const changes = [
      (x: Record<string, unknown>) => {
        x.extra = true;
      },
      (x: Record<string, unknown>) => {
        delete x.idempotencyKey;
      },
      (x: Record<string, unknown>) => {
        x.expectedVersion = "1";
      },
      (x: Record<string, unknown>) => {
        x.expectedVersion = 0;
      },
      (x: Record<string, unknown>) => {
        x.payload = { ...command.payload, extra: true };
      },
      (x: Record<string, unknown>) => {
        x.payload = {
          ...command.payload,
          entries: [...command.payload.entries].reverse(),
        };
      },
      (x: Record<string, unknown>) => {
        x.payload = {
          ...command.payload,
          entries: command.payload.entries.slice(1),
        };
      },
      (x: Record<string, unknown>) => {
        x.payload = {
          ...command.payload,
          entries: command.payload.entries.map((e, i) =>
            i === 2 ? { ...e, check: cpiFollowupQuestion } : e,
          ),
        };
      },
      (x: Record<string, unknown>) => {
        x.payload = {
          ...command.payload,
          entries: command.payload.entries.map((e, i) =>
            i === 2 ? { ...e, dueOn: "2027-01-01" } : e,
          ),
        };
      },
      (x: Record<string, unknown>) => {
        x.payload = {
          ...command.payload,
          entries: command.payload.entries.map((e, i) =>
            i === 2 ? { ...e, listing: f.fixture.marketsCohort[0] } : e,
          ),
        };
      },
    ];
    for (const change of changes) {
      const raw = structuredClone(command) as unknown as Record<
        string,
        unknown
      >;
      change(raw);
      expect(() =>
        f.fixture.api.saveFollowups(
          raw as unknown as ManagedResearchFollowupsCommand,
          new AbortController().signal,
        ),
      ).toThrow("Unexpected invented");
      expect(f.fixture.followups!.getSnapshot()).toMatchObject({
        save: 0,
        commits: 0,
      });
    }
    const reordered = {
      ...command,
      payload: {
        entries: command.payload.entries.map((e) => {
          const { result, ...rest } = e;
          return { result, ...rest };
        }),
        schemaVersion: 1 as const,
      },
    };
    await expect(
      f.fixture.api.saveFollowups(reordered, new AbortController().signal),
    ).resolves.toMatchObject({ version: 2 });
    expect(() =>
      f.fixture.api.saveFollowups(command, new AbortController().signal),
    ).toThrow("Unexpected invented");
    noOtherEffects(f.fixture, 1, 1);
  });
  it("refuses unrelated financial reads and independent writes with explicit zero-effect diagnostics", async () => {
    const fixture = await createFixture("cpi-headline-followup");
    const signal = new AbortController().signal;
    const operations = [
      () => fixture.api.save({} as never, signal),
      () => fixture.api.eodHistory({} as never, signal),
      () => fixture.api.annualReport({} as never, signal),
      () => fixture.api.interimReport({} as never, signal),
      () => fixture.api.recentFilings({} as never, signal),
      () => fixture.api.economicCalendar(signal),
      () => fixture.api.blsCalendar(signal),
      () => fixture.api.monetaryAnnouncements(signal),
      () => fixture.api.loadPortfolio(signal),
      () => fixture.api.savePortfolio({} as never, signal),
      () => fixture.api.loadValuationAssumptions(signal),
      () => fixture.api.saveValuationAssumptions({} as never, signal),
    ];
    for (const operation of operations)
      expect(operation).toThrow("Unexpected invented");
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      load: 0,
      save: 0,
      commits: 0,
    });
    expect(fixture.getSnapshot()).toMatchObject({
      cpi: 0,
      save: 1,
      eod: 1,
      annual: 1,
      interimReport: 1,
      filings: 1,
      calendar: 1,
      bls: 1,
      fed: 1,
      portfolioLoad: 1,
      portfolioSave: 1,
      valuationLoad: 1,
      valuationSave: 1,
    });
  });
});
