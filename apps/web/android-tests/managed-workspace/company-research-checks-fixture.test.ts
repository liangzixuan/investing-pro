import { afterEach, expect, it, vi } from "vitest";
import { encodeResearchFollowupsPayload } from "@research-cockpit/contracts";
import { createFixture } from "./fixture";
import { companyChecksExpected } from "./company-research-checks-fixture-data";
afterEach(() => vi.useRealTimers());
async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
  const fixture = await createFixture("company-research-checks"),
    signal = new AbortController().signal;
  const meta = fixture.companyResearchChecks!;
  const command = {
    idempotencyKey: "90000000-0000-4000-8000-000000000001",
    expectedVersion: 1,
    payload: companyChecksExpected(fixture, "2026-10-30"),
  };
  return { fixture, signal, meta, command };
}
it("starts with independent saved bases and no resource or source reads", async () => {
  const { fixture, meta } = await setup();
  expect(meta.getSnapshot()).toEqual({
    load: 0,
    portfolioLoad: 0,
    resolve: 0,
    filings: 0,
    rejected: 0,
    save: 0,
    portfolioSave: 0,
    eod: 0,
    annual: 0,
    interim: 0,
    calendar: 0,
    fed: 0,
    cpi: 0,
    search: 0,
    valuationLoad: 0,
    valuationSave: 0,
  });
  expect(fixture.followups!.getSnapshot()).toMatchObject({
    session: 1,
    load: 0,
    save: 0,
    commits: 0,
  });
});
it("admits independent explicit reads, the exact complete Save and fresh-session Load", async () => {
  const { fixture, signal, meta, command } = await setup();
  expect((await fixture.api.load(signal)).version).toBe(7);
  expect((await fixture.api.loadPortfolio(signal)).version).toBe(3);
  expect((await fixture.api.loadFollowups(signal)).version).toBe(1);
  const packet = await fixture.api.recentFilings(
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: meta.packet.catalogSnapshotSha256,
      listingId: "listing-zero",
      symbol: "ZERO",
    },
    signal,
  );
  expect(packet).toEqual(meta.packet);
  const saved = await fixture.api.saveFollowups(command, signal);
  expect(saved.version).toBe(2);
  fixture.followups!.nextSession();
  const fresh = await fixture.api.loadFollowups(signal);
  expect(encodeResearchFollowupsPayload(fresh.payload)).toBe(
    encodeResearchFollowupsPayload(command.payload),
  );
  expect(meta.getSnapshot()).toMatchObject({
    filings: 1,
    rejected: 0,
    save: 0,
    portfolioSave: 0,
    valuationSave: 0,
  });
});
it.each(["result", "question", "date", "status", "other", "order", "version"])(
  "refuses changed %s before a saved commit",
  async (kind) => {
    const { fixture, signal, meta, command } = await setup();
    await fixture.api.loadFollowups(signal);
    await fixture.api.recentFilings(
      {
        schemaVersion: "1.0.0",
        catalogSnapshotSha256: meta.packet.catalogSnapshotSha256,
        listingId: "listing-zero",
        symbol: "ZERO",
      },
      signal,
    );
    const payload = {
        ...command.payload,
        entries: command.payload.entries.map((entry) => ({ ...entry })),
      },
      first = payload.entries[0]!;
    if (kind === "result") first.result += " changed";
    if (kind === "question") first.check += " changed";
    if (kind === "date") first.completedOn = "2026-10-29";
    if (kind === "status") {
      first.status = "open";
      first.completedOn = null;
    }
    if (kind === "other") payload.entries[1]!.result += " changed";
    if (kind === "order") payload.entries.reverse();
    expect(() =>
      fixture.api.saveFollowups(
        { ...command, expectedVersion: kind === "version" ? 0 : 1, payload },
        signal,
      ),
    ).toThrow();
    expect(fixture.followups!.getSnapshot().commits).toBe(0);
  },
);
it("refuses provider or unrelated resource writes and a repeated source read", async () => {
  const { fixture, signal, meta } = await setup();
  expect(() => fixture.api.eodHistory({} as never, signal)).toThrow();
  expect(() => fixture.api.save({} as never, signal)).toThrow();
  expect(() => fixture.api.savePortfolio({} as never, signal)).toThrow();
  expect(() =>
    fixture.api.saveValuationAssumptions({} as never, signal),
  ).toThrow();
  const request = {
    schemaVersion: "1.0.0" as const,
    catalogSnapshotSha256: meta.packet.catalogSnapshotSha256,
    listingId: "listing-zero",
    symbol: "ZERO",
  };
  await fixture.api.recentFilings(request, signal);
  expect(() => fixture.api.recentFilings(request, signal)).toThrow();
  expect(fixture.followups!.getSnapshot().commits).toBe(0);
  expect(meta.getSnapshot().rejected).toBe(5);
});
