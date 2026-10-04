import { describe, expect, it } from "vitest";
import { parseManagedEodHistoryResponse } from "@research-cockpit/contracts";
import { createFixture } from "./fixture";

describe("Android managed fixture startup", () => {
  it("serves one fresh Annual response after the cancelled visit read settles", async () => {
    const fixture = await createFixture();
    const request = {
      schemaVersion: "1.0.0" as const,
      catalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
      listingId: "listing-zero",
      symbol: "ZERO",
    };
    const heldController = new AbortController();
    const held = fixture.api.annualReport(request, heldController.signal);
    heldController.abort();
    fixture.settleCancelledRead();
    expect((await held).evidence.generation).toEqual(
      fixture.generations.initial,
    );
    const fresh = await fixture.api.annualReport(
      request,
      new AbortController().signal,
    );
    expect(fresh.evidence.generation).toEqual(fixture.generations.recovered);
    expect(fixture.getSnapshot()).toMatchObject({
      annual: 2,
      aborted: 1,
      lateResolved: 1,
      eod: 0,
      save: 0,
      resolve: 0,
      token: 0,
      signOut: 0,
    });
    expect(() =>
      fixture.api.annualReport(request, new AbortController().signal),
    ).toThrow("Unexpected extra fixture annual read");
  });

  it.each(["default", "catalog-startup-recovery"] as const)(
    "starts %s with valid EOD packets and unchanged watchlist notes",
    async (scenario) => {
      const fixture = await createFixture(scenario);
      const initial = {
        load: 0,
        status: 0,
        search: 0,
        save: 0,
        resolve: 0,
        annual: 0,
        aborted: 0,
        lateResolved: 0,
        token: 0,
        signOut: 0,
        refreshScenario: false,
        refreshFailed: 0,
        catalogRecovery: scenario === "catalog-startup-recovery",
        catalogReleased: 0,
        eod: 0,
        eodAborted: 0,
        eodLateResolved: 0,
        marketsResolve: 0,
        marketsEod: 0,
        marketsAborted: 0,
        marketsLateResolved: 0,
      };
      expect(fixture.getSnapshot()).toEqual(initial);
      const signal = new AbortController().signal;
      const watchlist = await fixture.api.load(signal);
      expect(watchlist.version).toBe(1);
      expect(
        watchlist.payload.memberships.map(({ listingId, note }) => ({
          listingId,
          note,
        })),
      ).toEqual([
        { listingId: "listing-zero", note: "" },
        { listingId: "listing-one", note: "Invented second note" },
      ]);
      const request = {
        catalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
        listingId: "listing-zero",
        range: "1m" as const,
      };
      const packet = await fixture.api.eodHistory(request, signal);
      expect(parseManagedEodHistoryResponse(packet, request)).toEqual(packet);
      expect(packet.security).toEqual({
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "issuer-zero",
        issuerName: "Zero Company",
        listingId: "listing-zero",
        securityId: "security-zero",
        securityName: "Zero Class A",
        shareClassId: "class-zero",
        shareClassName: "Class A",
        symbol: "ZERO",
      });
      expect(packet.security).not.toHaveProperty("note");
      expect(packet.window).toEqual({
        startDate: "2026-08-20",
        endDate: "2026-09-20",
      });
      expect(packet.requestStartedAt).toBe("2026-09-20T00:00:00.000Z");
      expect(packet.completedAt).toBe("2026-09-20T00:00:01.000Z");
      expect(packet.rows).toEqual([
        { date: "2026-09-18", close: "100.25" },
        { date: "2026-09-19", close: "101.5" },
      ]);
      expect(fixture.getSnapshot()).toEqual({ ...initial, load: 1, eod: 1 });
    },
  );

  it("keeps the invented board's ordered reads separate and holds only its cancelled refresh", async () => {
    const fixture = await createFixture();
    const signal = new AbortController().signal;
    const resolveRequest = {
      snapshotSha256: `sha256:${"a".repeat(64)}`,
      listingIds: fixture.marketsCohort.map((listing) => listing.listingId),
    };
    const resolved = await fixture.api.resolve(resolveRequest, signal);
    expect(resolved.results.map(({ listing }) => listing)).toEqual(
      fixture.marketsCohort,
    );
    expect(fixture.getSnapshot()).toMatchObject({
      marketsResolve: 1,
      marketsEod: 0,
      resolve: 0,
      eod: 0,
    });
    const request = (index: number) => ({
      catalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
      listingId: fixture.marketsCohort[index]!.listingId,
      range: "1m" as const,
    });
    expect(() => fixture.api.eodHistory(request(1), signal)).toThrow(
      "Unexpected invented Markets EOD request or order",
    );
    for (let index = 0; index < 3; index += 1) {
      const packet = await fixture.api.eodHistory(request(index), signal);
      expect(parseManagedEodHistoryResponse(packet, request(index))).toEqual(
        packet,
      );
      expect(packet.security).toEqual(fixture.marketsCohort[index]);
      expect(packet.rows).toEqual([
        { date: "2026-09-18", close: `${(index + 1) * 10}.25` },
        { date: "2026-09-19", close: `${(index + 1) * 10}.5` },
      ]);
    }
    const refreshed = await fixture.api.eodHistory(request(0), signal);
    expect(refreshed.rows).toEqual([
      { date: "2026-09-19", close: "11.25" },
      { date: "2026-09-20", close: "11.5" },
    ]);
    const heldController = new AbortController();
    const held = fixture.api.eodHistory(request(1), heldController.signal);
    let settled = false;
    void held.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(() => fixture.api.eodHistory(request(2), signal)).toThrow(
      "Unexpected invented Markets EOD request or order",
    );
    heldController.abort();
    fixture.settleCancelledMarkets();
    expect((await held).rows.at(-1)?.close).toBe("999.75");
    expect(fixture.getSnapshot()).toMatchObject({
      marketsResolve: 1,
      marketsEod: 5,
      marketsAborted: 1,
      marketsLateResolved: 1,
      resolve: 0,
      eod: 0,
      annual: 0,
      save: 0,
      token: 0,
      signOut: 0,
    });
  });
});
