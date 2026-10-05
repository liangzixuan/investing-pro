import { describe, expect, it } from "vitest";
import {
  parseManagedEodHistoryResponse,
  parseManagedWatchlistReceipt,
} from "@research-cockpit/contracts";
import { createFixture } from "./fixture";

describe("Android managed fixture startup", () => {
  it("saves the exact invented company draft once and reloads independent copies", async () => {
    const fixture = await createFixture();
    const signal = new AbortController().signal;
    const original = await fixture.api.load(signal);
    const command = {
      expectedVersion: original.version,
      idempotencyKey: "12345678-1234-4123-8123-123456789012",
      payload: {
        ...original.payload,
        memberships: [
          ...original.payload.memberships,
          {
            ...fixture.marketsCohort[0],
            note: "Company draft captured in research",
          },
        ],
      },
    };
    const expectedPayload = structuredClone(command.payload);
    const receipt = await fixture.api.save(command, signal);
    expect(parseManagedWatchlistReceipt(receipt, command)).toEqual(receipt);
    expect(receipt).toEqual({
      version: 2,
      payload: expectedPayload,
      replayed: false,
    });
    expect(receipt.payload).not.toBe(command.payload);
    for (const [index, member] of receipt.payload.memberships.entries())
      expect(member).not.toBe(command.payload.memberships[index]);
    const loaded = await fixture.api.load(signal);
    expect(loaded).toEqual({ version: 2, payload: expectedPayload });
    expect(loaded.payload).not.toBe(receipt.payload);
    const reloaded = await fixture.api.load(signal);
    expect(reloaded).toEqual({
      version: 2,
      payload: expectedPayload,
    });
    for (const [index, member] of reloaded.payload.memberships.entries())
      expect(member).not.toBe(loaded.payload.memberships[index]);
    await expect(
      fixture.api.save({ ...command, payload: expectedPayload }, signal),
    ).rejects.toThrow("Unexpected fixture operation: save");
    expect(await fixture.api.load(signal)).toEqual({
      version: 2,
      payload: expectedPayload,
    });
    expect(fixture.getSnapshot()).toMatchObject({
      save: 2,
      status: 0,
      search: 0,
      annual: 0,
      eod: 0,
      marketsEod: 0,
      resolve: 0,
      token: 0,
      signOut: 0,
    });
  });

  it.each(["version", "identity", "order", "note", "aborted"] as const)(
    "rejects an invented company save with wrong %s without changing saved data",
    async (invalid) => {
      const fixture = await createFixture();
      const controller = new AbortController();
      const original = await fixture.api.load(controller.signal);
      const command = {
        expectedVersion: 1,
        idempotencyKey: "12345678-1234-4123-8123-123456789012",
        payload: {
          ...original.payload,
          memberships: [
            ...original.payload.memberships,
            {
              ...fixture.marketsCohort[0],
              note: "Company draft captured in research",
            },
          ],
        },
      };
      if (invalid === "version") command.expectedVersion = 0;
      if (invalid === "identity")
        command.payload.memberships = command.payload.memberships.map(
          (member, index) =>
            index === 2
              ? { ...member, shareClassId: "different-class" }
              : member,
        );
      if (invalid === "order")
        command.payload.memberships = [
          ...command.payload.memberships,
        ].reverse();
      if (invalid === "note")
        command.payload.memberships = command.payload.memberships.map(
          (member, index) =>
            index === 2 ? { ...member, note: "x".repeat(2001) } : member,
        );
      if (invalid === "aborted") controller.abort();
      await expect(
        fixture.api.save(command, controller.signal),
      ).rejects.toThrow("Unexpected fixture operation: save");
      expect(await fixture.api.load(new AbortController().signal)).toEqual(
        original,
      );
      expect(fixture.getSnapshot().save).toBe(1);
    },
  );

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
        { date: "2026-09-18", close: ["10.25", "20.75", "30.5"][index] },
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
