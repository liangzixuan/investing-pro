import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MANAGED_BLS_CALENDAR_SOURCE,
  parseManagedBlsCalendar,
  parseManagedEconomicCalendar,
  parseManagedMonetaryAnnouncements,
  type ManagedBlsCalendarDto,
} from "@research-cockpit/contracts";
import { createFixture } from "../../android-tests/managed-workspace/fixture";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { eodResponse } from "./eod-history-fixture";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";

const owners: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of owners.splice(0)) workspace.sessionOwner.dispose();
});

function held<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function fixture(authored = false) {
  const base = await createFixture("research-followups");
  const order: string[] = [];
  const packets = {
    bls: parseManagedBlsCalendar({
      ...economicCalendarFixture(),
      source: MANAGED_BLS_CALENDAR_SOURCE,
    })!,
    bea: parseManagedEconomicCalendar(economicCalendarFixture())!,
    fed: parseManagedMonetaryAnnouncements(fedAnnouncementsFixture())!,
  };
  const api = {
    ...base.api,
    load: vi.fn(base.api.load),
    save: vi.fn(base.api.save),
    loadFollowups: vi.fn(base.api.loadFollowups),
    saveFollowups: vi.fn(base.api.saveFollowups),
    loadPortfolio: vi.fn(base.api.loadPortfolio),
    savePortfolio: vi.fn(base.api.savePortfolio),
    loadValuationAssumptions: vi.fn(base.api.loadValuationAssumptions),
    saveValuationAssumptions: vi.fn(base.api.saveValuationAssumptions),
    status: vi.fn(base.api.status),
    resolve: vi.fn(base.api.resolve),
    annualReport: vi.fn(base.api.annualReport),
    recentFilings: vi.fn(base.api.recentFilings),
    eodHistory: vi.fn<ManagedApi["eodHistory"]>((request) => {
      order.push(request.listingId);
      return Promise.resolve({
        ...eodResponse(),
        catalogSnapshotSha256: request.catalogSnapshotSha256,
        security: base.marketsCohort.find(
          (row) => row.listingId === request.listingId,
        )!,
      });
    }),
    blsCalendar: vi.fn<ManagedApi["blsCalendar"]>(() => {
      order.push("bls");
      return Promise.resolve(packets.bls);
    }),
    economicCalendar: vi.fn<ManagedApi["economicCalendar"]>(() => {
      order.push("bea");
      return Promise.resolve(packets.bea);
    }),
    monetaryAnnouncements: vi.fn<ManagedApi["monetaryAnnouncements"]>(() => {
      order.push("fed");
      return Promise.resolve(packets.fed);
    }),
  } satisfies ManagedApi;
  const workspace = new ManagedWorkspace(api, base.session, undefined, {
    researchCoverage: base.researchCoverage,
    marketsCohort: base.marketsCohort,
    priceCoverage: base.priceCoverage,
  });
  owners.push(workspace);
  await workspace.refreshCatalog();
  await vi.waitFor(() =>
    expect(workspace.markets.getSnapshot().rows).toHaveLength(3),
  );
  if (authored) {
    await workspace.coordinator.load();
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.note(
      member.listingId,
      "Keep the complete unsaved Watchlist note.",
    );
    workspace.setView("followups");
    await workspace.followups.coordinator.load();
    const currentMember =
      workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.followups.add(currentMember, "2026-11-01");
    const entry =
      workspace.followups.coordinator.getSnapshot().draft!.entries[0];
    if (!entry)
      throw new Error("The invented editable resource must admit a check");
    workspace.followups.edit(
      entry,
      "check",
      "Read the next original filing before the due date.",
    );
    workspace.setView("markets");
    await vi.waitFor(() =>
      expect(workspace.markets.getSnapshot().rows).toHaveLength(3),
    );
    expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
    expect(workspace.followups.coordinator.getSnapshot().dirty).toBe(true);
  }
  const resourceCalls = () => ({
    watchlistLoad: api.load.mock.calls.length,
    watchlistSave: api.save.mock.calls.length,
    followupsLoad: api.loadFollowups.mock.calls.length,
    followupsSave: api.saveFollowups.mock.calls.length,
    portfolioLoad: api.loadPortfolio.mock.calls.length,
    portfolioSave: api.savePortfolio.mock.calls.length,
    valuationLoad: api.loadValuationAssumptions.mock.calls.length,
    valuationSave: api.saveValuationAssumptions.mock.calls.length,
  });
  return {
    workspace,
    review: workspace.marketsSourceReview,
    api,
    base,
    packets,
    order,
    resourceCalls,
  };
}

function governmentOnly(f: Awaited<ReturnType<typeof fixture>>) {
  for (const id of ["price-0", "price-1", "price-2"])
    f.review.choose(id, false);
}
function pendingGovernment(f: Awaited<ReturnType<typeof fixture>>) {
  governmentOnly(f);
  const pending = held<ManagedBlsCalendarDto>();
  f.api.blsCalendar.mockImplementationOnce(() => {
    f.order.push("bls");
    return pending.promise;
  });
  f.review.preview();
  const running = f.review.start();
  expect(f.api.blsCalendar).toHaveBeenCalledOnce();
  return { pending, running, signal: f.api.blsCalendar.mock.calls[0]![0] };
}
function expectNoCompanyReads(f: Awaited<ReturnType<typeof fixture>>) {
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.recentFilings).not.toHaveBeenCalled();
}

describe("Markets source review workspace ownership", () => {
  it("previews without source or resource reads, then runs only selected existing government operations", async () => {
    const f = await fixture();
    governmentOnly(f);
    const calls = f.resourceCalls();
    const resolves = f.api.resolve.mock.calls.length;
    f.review.preview();
    expect(f.order).toEqual([]);
    expect(f.resourceCalls()).toEqual(calls);
    expect(f.review.getSnapshot().plan.map((row) => row.id)).toEqual([
      "bls",
      "bea",
      "fed",
    ]);
    await f.review.start();
    expect(f.order).toEqual(["bls", "bea", "fed"]);
    expect(f.review.getSnapshot().phase).toBe("complete");
    expect(f.api.resolve).toHaveBeenCalledTimes(resolves);
    expectNoCompanyReads(f);
    expect(f.resourceCalls()).toEqual(calls);
    expect(Object.values(calls)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(f.workspace.coordinator.getSnapshot().saved).toBeNull();
    expect(f.workspace.followups.coordinator.getSnapshot().saved).toBeNull();
  });

  it("runs only one selected board listing and Fed without changing the board selection or loading resources", async () => {
    const f = await fixture();
    const selectedListingId =
      f.workspace.markets.getSnapshot().selectedListingId;
    const listing = f.base.marketsCohort[1];
    const calls = f.resourceCalls();
    for (const id of ["price-0", "price-2", "bls", "bea"])
      f.review.choose(id, false);
    f.review.preview();
    expect(f.review.getSnapshot().plan.map((row) => row.id)).toEqual([
      "price-1",
      "fed",
    ]);
    expect(f.order).toEqual([]);
    await f.review.start();
    expect(f.review.getSnapshot().phase).toBe("complete");
    expect(f.order).toEqual([listing.listingId, "fed"]);
    expect(f.api.eodHistory).toHaveBeenCalledOnce();
    expect(f.api.eodHistory.mock.calls[0]![0]).toMatchObject({
      listingId: listing.listingId,
      range: "1m",
      catalogSnapshotSha256: f.workspace.getSnapshot().snapshot!.snapshotSha256,
    });
    expect(f.workspace.markets.getSnapshot().selectedListingId).toBe(
      selectedListingId,
    );
    expect(
      f.workspace.markets.getSnapshot().rows[1]!.response?.security,
    ).toEqual(listing);
    expect(f.api.blsCalendar).not.toHaveBeenCalled();
    expect(f.api.economicCalendar).not.toHaveBeenCalled();
    expect(f.api.annualReport).not.toHaveBeenCalled();
    expect(f.api.recentFilings).not.toHaveBeenCalled();
    expect(f.resourceCalls()).toEqual(calls);
  });

  it("keeps exact valid dirty Watchlist and Follow-ups save states through a government pass", async () => {
    const f = await fixture(true);
    const watchlist = f.workspace.coordinator.getSnapshot();
    const followups = f.workspace.followups.coordinator.getSnapshot();
    const calls = f.resourceCalls();
    governmentOnly(f);
    f.review.preview();
    await f.review.start();
    expect(f.review.getSnapshot().phase).toBe("complete");
    expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
    expect(f.workspace.followups.coordinator.getSnapshot()).toBe(followups);
    expect(watchlist.draft!.memberships[0]!.note).toBe(
      "Keep the complete unsaved Watchlist note.",
    );
    expect(followups.draft!.entries[0]!.check).toBe(
      "Read the next original filing before the due date.",
    );
    expect(f.resourceCalls()).toEqual(calls);
    expectNoCompanyReads(f);
  });

  it("opens retained board research, cancels the remaining pass, and keeps the exact board packet through Back", async () => {
    const f = await fixture(true);
    const listing = f.base.marketsCohort[0];
    expect(await f.workspace.markets.loadListing(listing.listingId)).toBe(
      "accepted",
    );
    const packet = f.workspace.markets.getSnapshot().rows[0]!.response;
    const watchlist = f.workspace.coordinator.getSnapshot();
    const followups = f.workspace.followups.coordinator.getSnapshot();
    const calls = f.resourceCalls();
    const { pending, running, signal } = pendingGovernment(f);
    f.workspace.openMarketResearch("eod", listing.listingId);
    expect(signal.aborted).toBe(true);
    expect(f.review.getSnapshot().phase).toBe("retired");
    expect(f.workspace.eod.getSnapshot()).toMatchObject({
      response: packet,
      responseOrigin: "markets",
    });
    expect(f.workspace.eod.getSnapshot().response).not.toBe(packet);
    expect(f.api.eodHistory).toHaveBeenCalledOnce();
    pending.resolve(f.packets.bls);
    await running;
    expect(f.workspace.blsCalendar.getSnapshot().calendar).toBeNull();
    expect(f.api.economicCalendar).not.toHaveBeenCalled();
    expect(f.api.monetaryAnnouncements).not.toHaveBeenCalled();
    f.workspace.closeResearch();
    expect(f.workspace.markets.getSnapshot().rows[0]!.response).toBe(packet);
    expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
    expect(f.workspace.followups.coordinator.getSnapshot()).toBe(followups);
    expect(f.resourceCalls()).toEqual(calls);
    expect(f.api.annualReport).not.toHaveBeenCalled();
    expect(f.api.recentFilings).not.toHaveBeenCalled();
  });

  it("permanently retires old Start across blocked navigation but allows an explicit new Preview on return", async () => {
    const f = await fixture(true);
    governmentOnly(f);
    const watchlist = f.workspace.coordinator.getSnapshot();
    const followups = f.workspace.followups.coordinator.getSnapshot();
    f.review.preview();
    f.workspace.setNavigationBlocked(true);
    f.workspace.setNavigationBlocked(false);
    await f.review.start();
    expect(f.order).toEqual([]);
    expect(f.review.getSnapshot().canStart).toBe(false);
    f.review.preview();
    expect(f.review.getSnapshot().canStart).toBe(true);
    await f.review.start();
    expect(f.order).toEqual(["bls", "bea", "fed"]);
    expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
    expect(f.workspace.followups.coordinator.getSnapshot()).toBe(followups);
  });

  it.each(["watchlist", "discover"] as const)(
    "retires active reads on leaving for %s; reentry does not fetch or restore late evidence",
    async (view) => {
      const f = await fixture(true);
      const watchlist = f.workspace.coordinator.getSnapshot();
      const followups = f.workspace.followups.coordinator.getSnapshot();
      const calls = f.resourceCalls();
      const { pending, running, signal } = pendingGovernment(f);
      f.workspace.setView(view);
      expect(signal.aborted).toBe(true);
      expect(f.workspace.markets.getSnapshot().rows).toEqual([]);
      f.workspace.setView("markets");
      await vi.waitFor(() =>
        expect(f.workspace.markets.getSnapshot().rows).toHaveLength(3),
      );
      pending.resolve(f.packets.bls);
      await running;
      expect(f.review.getSnapshot().canStart).toBe(false);
      expect(f.workspace.blsCalendar.getSnapshot().calendar).toBeNull();
      expect(f.order).toEqual(["bls"]);
      expect(
        f.workspace.markets
          .getSnapshot()
          .rows.every((row) => row.response === null),
      ).toBe(true);
      expect(f.workspace.coordinator.getSnapshot()).toBe(watchlist);
      expect(f.workspace.followups.coordinator.getSnapshot()).toBe(followups);
      expect(f.resourceCalls()).toEqual(calls);
      expectNoCompanyReads(f);
      f.review.preview();
      expect(f.review.getSnapshot().canStart).toBe(true);
    },
  );

  it("retires a preview before even an unchanged explicit catalog refresh and requires a new Preview", async () => {
    const f = await fixture();
    governmentOnly(f);
    f.review.preview();
    const snapshot = f.workspace.getSnapshot().snapshot!;
    f.api.status.mockResolvedValueOnce({ snapshot });
    await f.workspace.refreshCatalog();
    await f.review.start();
    expect(f.order).toEqual([]);
    expect(f.review.getSnapshot().canStart).toBe(false);
    f.review.preview();
    expect(f.review.getSnapshot().canStart).toBe(true);
    expectNoCompanyReads(f);
  });

  it("clears authored drafts on permanent session retirement and ignores late source success and old controls", async () => {
    const f = await fixture(true);
    const { pending, running, signal } = pendingGovernment(f);
    f.workspace.sessionOwner.retire();
    expect(signal.aborted).toBe(true);
    pending.resolve(f.packets.bls);
    await running;
    f.workspace.setView("markets");
    f.review.preview();
    await f.review.start();
    expect(f.review.getSnapshot()).toMatchObject({
      phase: "retired",
      rows: [],
      plan: [],
      canStart: false,
      canPreview: false,
    });
    expect(f.workspace.blsCalendar.getSnapshot().calendar).toBeNull();
    expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
    expect(f.order).toEqual(["bls"]);
    expect(f.api.economicCalendar).not.toHaveBeenCalled();
    expect(f.api.monetaryAnnouncements).not.toHaveBeenCalled();
  });
});
