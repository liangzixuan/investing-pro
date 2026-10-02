import { describe, expect, it } from "vitest";
import { parseManagedEodHistoryResponse } from "@research-cockpit/contracts";
import { createFixture } from "./fixture";

describe("Android managed fixture startup", () => {
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
});
