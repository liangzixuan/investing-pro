import { describe, expect, it, vi } from "vitest";
import { createFixture } from "./fixture";
import { createFilingsReviewNativeFixture } from "./filings-review-fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";

describe("isolated filing-review Android scenario", () => {
  it("constructs without reading or saving and publishes stable subscribed snapshots", async () => {
    const shared = await createFixture();
    const read = vi.spyOn(shared.api, "load");
    const source = vi.spyOn(shared.api, "recentFilings");
    const fixture = createFilingsReviewNativeFixture(shared);
    const initial = fixture.getSnapshot();
    expect(fixture.getSnapshot()).toBe(initial);
    expect(initial).toMatchObject({ load: 0, status: 0, filings: 0, save: 0 });
    expect(read).not.toHaveBeenCalled();
    expect(source).not.toHaveBeenCalled();
    const listener = vi.fn();
    const unsubscribe = fixture.subscribe(listener);
    await fixture.api.load(new AbortController().signal);
    expect(read).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalled();
    expect(fixture.getSnapshot()).not.toBe(initial);
    expect(fixture.getSnapshot()).toBe(fixture.getSnapshot());
    unsubscribe();
  });

  it("admits the complete real workspace journey and fences three changed late packets", async () => {
    const fixture = await createFixture("watchlist-filings-review");
    const workspace = new ManagedWorkspace(
      fixture.api,
      fixture.session,
      undefined,
      {
        researchCoverage: fixture.researchCoverage,
        marketsCohort: fixture.marketsCohort,
        priceCoverage: fixture.priceCoverage,
      },
    );
    try {
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.setView("watchlist");
      workspace.note("listing-zero", fixture.filingsReview!.prefix);
      const model = workspace.filingsReview;
      for (const member of model.getSnapshot().memberships)
        model.choose(model.getSnapshot(), member);
      model.start(model.getSnapshot());
      expect(fixture.getSnapshot().filings).toBe(0);
      await model.load(model.getSnapshot());
      const first = model.getSnapshot().rows[0]!;
      const second = model.getSnapshot().rows[1]!;
      model.select(model.getSnapshot(), second.member);
      await model.load(model.getSnapshot());
      const secondPacket = model.getSnapshot().rows[1]!.filings.response!;
      expect(first.filings.response!.issuer.cik).toBe("0000000001");
      expect(secondPacket.issuer.cik).toBe("0000000002");
      expect(secondPacket.issuer.filings).toHaveLength(2);
      expect(secondPacket.completedAt).toBe("2026-09-21T00:00:02.000Z");
      model.select(model.getSnapshot(), first.member);
      workspace.openFilingsReview({
        member: first.member,
        response: first.filings.response!,
      });
      const selection = workspace.getSnapshot().research!.selection;
      const response = workspace.filings.getSnapshot().response!;
      expect(
        workspace.appendFilingReferenceToResearchNote(
          selection,
          response,
          response.issuer.filings[0]!,
        ).appended,
      ).toBe(true);
      expect(fixture.getSnapshot()).toMatchObject({ filings: 2, save: 0 });
      workspace.closeResearch();
      await workspace.coordinator.save();
      expect(workspace.coordinator.getSnapshot()).toMatchObject({
        phase: "idle",
        baseVersion: 2,
        dirty: false,
        uncertain: false,
      });
      expect(
        workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
      ).toBe(fixture.filingsReview!.expectedNote);
      expect(fixture.getSnapshot()).toMatchObject({ filings: 2, save: 1 });
      expect(model.getSnapshot().rows[1]!.filings.response).toBe(secondPacket);
      workspace.openFilingsReview({
        member: first.member,
        response: first.filings.response!,
      });
      workspace.closeResearch();
      const third = model.load(model.getSnapshot());
      expect({
        active: model.getSnapshot().active,
        canRead: model.getSnapshot().canRead,
        canLoad: model.canLoad(model.getSnapshot()),
        view: workspace.getSnapshot().view,
        research: workspace.getSnapshot().research,
        companyRoute: workspace.getSnapshot().companyRoute,
      }).toMatchObject({
        active: true,
        canRead: true,
        canLoad: false,
        view: "watchlist",
        research: null,
        companyRoute: null,
      });
      expect({
        calls: fixture.getSnapshot().filings,
        running: model.getSnapshot().rows[0]?.filings.running,
        message: model.getSnapshot().rows[0]?.filings.message,
      }).toMatchObject({ calls: 3, running: true });
      model.select(model.getSnapshot(), second.member);
      fixture.settleCancelledFilings();
      await third;
      expect(model.getSnapshot().rows[0]!.filings.response).toBe(
        first.filings.response,
      );
      const fourth = model.load(model.getSnapshot());
      model.cancel();
      fixture.settleCancelledFilings();
      await fourth;
      expect(model.getSnapshot().rows[1]!.filings.response).toBe(secondPacket);
      model.finish(model.getSnapshot());
      expect(model.getSnapshot().rows).toEqual([]);
      await workspace.coordinator.load();
      const one = model
        .getSnapshot()
        .memberships.find(
          (member) => member.listing.listingId === "listing-one",
        )!;
      model.choose(model.getSnapshot(), one);
      model.start(model.getSnapshot());
      const fifth = model.load(model.getSnapshot());
      await workspace.refreshCatalog();
      fixture.settleCancelledFilings();
      await fifth;
      expect(model.getSnapshot().rows).toEqual([]);
      expect(workspace.coordinator.getSnapshot().draft).toBeNull();
      expect(fixture.getSnapshot()).toMatchObject({
        load: 2,
        status: 2,
        save: 1,
        filings: 5,
        filingsAborted: 3,
        filingsLateResolved: 3,
        annual: 0,
        eod: 0,
        calendar: 0,
        fed: 0,
        resolve: 0,
        search: 0,
        token: 0,
        signOut: 0,
      });
    } finally {
      workspace.sessionOwner.dispose();
    }
  });

  it.each([
    "before-load",
    "wrong-listing",
    "wrong-symbol",
    "wrong-digest",
    "aborted",
  ])("refuses %s without a fallback source", async (mode) => {
    const fixture = await createFixture("watchlist-filings-review");
    const controller = new AbortController();
    if (mode !== "before-load") {
      await fixture.api.load(controller.signal);
      await fixture.api.status(controller.signal);
    }
    const request = {
      schemaVersion: "1.0.0" as const,
      catalogSnapshotSha256: fixture.researchCoverage.catalogSnapshotSha256,
      listingId: "listing-zero",
      symbol: "ZERO",
    };
    if (mode === "wrong-listing") request.listingId = "listing-one";
    if (mode === "wrong-symbol") request.symbol = "OTHER";
    if (mode === "wrong-digest")
      request.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
    if (mode === "aborted") controller.abort();
    expect(() => fixture.api.recentFilings(request, controller.signal)).toThrow(
      "Unexpected invented filing-review",
    );
    expect(fixture.getSnapshot()).toMatchObject({ filings: 1, save: 0 });
  });
});
