import { describe, expect, it } from "vitest";
import {
  parseManagedEodHistoryResponse,
  parseManagedWatchlistReceipt,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import { annualNoteDraft, createFixture } from "./fixture";

const fixtureDigest = `sha256:${"a".repeat(64)}` as const;
type MutableFixtureMembership = {
  -readonly [Field in keyof WatchlistMembership]: WatchlistMembership[Field];
};

describe("Android managed fixture startup", () => {
  it("admits one exact ZERO Annual note save and reloads the unchanged other member", async () => {
    const fixture = await createFixture("annual-note");
    const signal = new AbortController().signal;
    const original = await fixture.api.load(signal);
    expect(original.payload.snapshotSha256).toBe(fixtureDigest);
    const request = {
      schemaVersion: "1.0.0" as const,
      catalogSnapshotSha256: fixtureDigest,
      listingId: "listing-zero",
      symbol: "ZERO",
    };
    const report = await fixture.api.annualReport(request, signal);
    expect(report.evidence.generation).toEqual(fixture.generations.initial);
    const command = {
      expectedVersion: 1,
      idempotencyKey: "12345678-1234-4123-8123-123456789012",
      payload: {
        ...original.payload,
        memberships: original.payload.memberships.map((member, index) =>
          index === 0 ? { ...member, note: annualNoteDraft } : member,
        ),
      },
    };
    const expected = structuredClone(command.payload);
    const receipt = await fixture.api.save(command, signal);
    expect(parseManagedWatchlistReceipt(receipt, command)).toEqual(receipt);
    expect(receipt).toEqual({ version: 2, payload: expected, replayed: false });
    const loaded = await fixture.api.load(signal);
    expect(loaded).toEqual({ version: 2, payload: expected });
    expect(
      loaded.payload.memberships.map((member) => member.listingId),
    ).toEqual(["listing-zero", "listing-one"]);
    expect(loaded.payload.memberships[1]).toEqual(
      original.payload.memberships[1],
    );
    expect(loaded.payload).not.toBe(receipt.payload);
    // This invented adapter returns mutable structured clones. Mutate the actual
    // returned object to prove it cannot alter the fixture's stored payload.
    const returnedMember = loaded.payload
      .memberships[0]! as MutableFixtureMembership;
    returnedMember.note = "Changed returned copy";
    expect(await fixture.api.load(signal)).toEqual({
      version: 2,
      payload: expected,
    });
    expect(() => fixture.api.annualReport(request, signal)).toThrow(
      "Unexpected extra fixture annual note read",
    );
    expect(fixture.getSnapshot()).toMatchObject({
      annual: 1,
      save: 1,
      eod: 0,
      marketsEod: 0,
      search: 0,
      resolve: 0,
      token: 0,
      signOut: 0,
    });
    await expect(fixture.api.save(command, signal)).rejects.toThrow(
      "Unexpected fixture operation: save",
    );
  });

  it.each([
    "unloaded",
    "source",
    "other-note",
    "order",
    "identity",
    "aborted",
  ] as const)(
    "rejects the Annual note save with invalid %s and preserves saved data",
    async (invalid) => {
      const fixture = await createFixture("annual-note");
      const controller = new AbortController();
      const original = await fixture.api.load(controller.signal);
      if (invalid !== "unloaded")
        await fixture.api.annualReport(
          {
            schemaVersion: "1.0.0",
            catalogSnapshotSha256: fixtureDigest,
            listingId: "listing-zero",
            symbol: "ZERO",
          },
          controller.signal,
        );
      const payload = {
        ...original.payload,
        memberships: original.payload.memberships.map((member, index) => ({
          ...member,
          note: index === 0 ? annualNoteDraft : member.note,
        })),
      };
      if (invalid === "source")
        payload.memberships[0]!.note = annualNoteDraft.replace(
          "USD 1000",
          "USD 2000",
        );
      if (invalid === "other-note")
        payload.memberships[1]!.note = "Changed other note";
      if (invalid === "order") payload.memberships.reverse();
      if (invalid === "identity")
        payload.memberships[0]!.shareClassId = "different-class";
      if (invalid === "aborted") controller.abort();
      await expect(
        fixture.api.save(
          {
            expectedVersion: 1,
            idempotencyKey: "12345678-1234-4123-8123-123456789012",
            payload,
          },
          controller.signal,
        ),
      ).rejects.toThrow("Unexpected fixture operation: save");
      expect(await fixture.api.load(new AbortController().signal)).toEqual(
        original,
      );
    },
  );

  it("resolves the cold company link once without loading research or saving", async () => {
    const fixture = await createFixture("company-direct-entry");
    const signal = new AbortController().signal;
    const original = await fixture.api.load(signal);
    const request = {
      snapshotSha256: original.payload.snapshotSha256,
      listingIds: ["listing-zero"],
    };
    const resolved = await fixture.api.resolve(request, signal);
    const { note, ...listing } = original.payload.memberships[0]!;
    expect(note).toBe("");
    expect(resolved).toEqual({
      snapshotSha256: original.payload.snapshotSha256,
      results: [{ listingId: "listing-zero", listing }],
    });
    expect(resolved.results[0]!.listing).not.toHaveProperty("cik");
    expect(fixture.getSnapshot()).toMatchObject({
      load: 1,
      resolve: 1,
      search: 0,
      annual: 0,
      eod: 0,
      save: 0,
      token: 0,
      signOut: 0,
    });
    await expect(fixture.api.resolve(request, signal)).rejects.toThrow(
      "Unexpected fixture operation: resolve",
    );
    expect(await fixture.api.load(signal)).toEqual(original);
  });

  it.each(["digest", "listing", "duplicate", "aborted"] as const)(
    "refuses a cold-link resolve with invalid %s",
    async (kind) => {
      const fixture = await createFixture("company-direct-entry");
      const controller = new AbortController();
      if (kind === "aborted") controller.abort();
      const request = {
        snapshotSha256:
          `sha256:${(kind === "digest" ? "b" : "a").repeat(64)}` as const,
        listingIds:
          kind === "duplicate"
            ? ["listing-zero", "listing-zero"]
            : [kind === "listing" ? "listing-one" : "listing-zero"],
      };
      await expect(
        fixture.api.resolve(request, controller.signal),
      ).rejects.toThrow("Unexpected fixture operation: resolve");
      expect(fixture.getSnapshot()).toMatchObject({
        resolve: 1,
        annual: 0,
        eod: 0,
        save: 0,
        token: 0,
        signOut: 0,
      });
    },
  );

  it("keeps singleton company resolution out of the default fixture", async () => {
    const fixture = await createFixture();
    await expect(
      fixture.api.resolve(
        {
          snapshotSha256: `sha256:${"a".repeat(64)}`,
          listingIds: ["listing-zero"],
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow("Unexpected fixture operation: resolve");
  });

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

  it("limits the selected-price scenario to ALFA and releases only its cancelled refresh", async () => {
    const fixture = await createFixture("markets-selected-price");
    const signal = new AbortController().signal;
    const request = {
      catalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
      listingId: fixture.marketsCohort[0].listingId,
      range: "1m" as const,
    };
    expect(() => fixture.api.eodHistory(request, signal)).toThrow(
      "Unexpected invented selected-price request",
    );
    await fixture.api.resolve(
      {
        snapshotSha256: request.catalogSnapshotSha256,
        listingIds: fixture.marketsCohort.map((listing) => listing.listingId),
      },
      signal,
    );
    expect(fixture.getSnapshot().marketsEod).toBe(0);
    for (const listing of fixture.marketsCohort.slice(1))
      expect(() =>
        fixture.api.eodHistory(
          { ...request, listingId: listing.listingId },
          signal,
        ),
      ).toThrow("Unexpected invented selected-price request");
    expect(() =>
      fixture.api.eodHistory(
        { ...request, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` },
        signal,
      ),
    ).toThrow("Unexpected invented selected-price request");
    const alreadyCancelled = new AbortController();
    alreadyCancelled.abort();
    expect(() =>
      fixture.api.eodHistory(request, alreadyCancelled.signal),
    ).toThrow("Unexpected invented selected-price request");
    const initial = await fixture.api.eodHistory(request, signal);
    expect(parseManagedEodHistoryResponse(initial, request)).toEqual(initial);
    expect(initial.security).toEqual(fixture.marketsCohort[0]);
    expect(initial.rows).toEqual([
      { date: "2026-09-18", close: "10.25" },
      { date: "2026-09-19", close: "10.5" },
    ]);
    const controller = new AbortController();
    const pending = fixture.api.eodHistory(request, controller.signal);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(() => fixture.settleCancelledMarkets()).toThrow(
      "Only the cancelled Markets row may settle",
    );
    expect(() => fixture.api.eodHistory(request, signal)).toThrow(
      "Unexpected invented selected-price request",
    );
    controller.abort();
    expect(settled).toBe(false);
    fixture.settleCancelledMarkets();
    const late = await pending;
    expect(parseManagedEodHistoryResponse(late, request)).toEqual(late);
    expect(late.security).toEqual(fixture.marketsCohort[0]);
    expect(late.rows.at(-1)?.close).toBe("999.75");
    expect(initial.rows.at(-1)?.close).toBe("10.5");
    expect(() => fixture.settleCancelledMarkets()).toThrow(
      "Only the cancelled Markets row may settle",
    );
    const refreshed = await fixture.api.eodHistory(request, signal);
    expect(parseManagedEodHistoryResponse(refreshed, request)).toEqual(
      refreshed,
    );
    expect(refreshed.rows).toEqual([
      { date: "2026-09-19", close: "11.25" },
      { date: "2026-09-20", close: "11.5" },
    ]);
    expect(() => fixture.api.eodHistory(request, signal)).toThrow(
      "Unexpected invented selected-price request",
    );
    expect(fixture.getSnapshot()).toMatchObject({
      marketsResolve: 1,
      marketsEod: 3,
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
