import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeResearchFollowupsPayload } from "@research-cockpit/contracts";
import { filingReferenceNoteExcerpt } from "../../src/clerk-trial/managed-filings-note";
import { createFixture } from "./fixture";
import {
  filingAssessmentCitation,
  filingAssessmentExpected,
  filingAssessmentOriginal,
  filingAssessmentResult,
} from "./filing-check-assessment-fixture-data";

afterEach(() => vi.useRealTimers());
async function loaded() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T12:00:00.000Z"));
  const fixture = await createFixture("filing-check-assessment");
  const signal = new AbortController().signal;
  await fixture.api.load(signal);
  await fixture.api.status(signal);
  const original = await fixture.api.loadFollowups(signal);
  const digest = fixture.researchCoverage.catalogSnapshotSha256;
  await fixture.api.resolve(
    { snapshotSha256: digest, listingIds: ["listing-zero"] },
    signal,
  );
  const packet = await fixture.api.recentFilings(
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: digest,
      listingId: "listing-zero",
      symbol: "ZERO",
    },
    signal,
  );
  return { fixture, signal, original, packet };
}
function command(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return {
    idempotencyKey: "90000000-0000-4000-8000-000000000001",
    expectedVersion: 1,
    payload: filingAssessmentExpected(fixture, "2026-10-29"),
  };
}

describe("invented filing assessment native fixture", () => {
  it("starts with an existing due check and a complete independent second check without a provider read", async () => {
    const fixture = await createFixture("filing-check-assessment");
    const original = filingAssessmentOriginal(fixture);
    expect(original.entries).toHaveLength(2);
    expect(original.entries[0]).toMatchObject({
      result: "",
      dueOn: "2000-01-01",
      status: "open",
      completedOn: null,
    });
    expect(original.entries[1]).toMatchObject({
      result: "Original independent ONE assessment.",
      dueOn: "2099-12-31",
      status: "open",
      completedOn: null,
    });
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      session: 1,
      load: 0,
      save: 0,
      commits: 0,
    });
    expect(fixture.getSnapshot()).toMatchObject({
      filings: 0,
      eod: 0,
      annual: 0,
      save: 0,
    });
  });

  it("binds the independent literal citation to original complete metadata, coverage limits, history and clocks", async () => {
    const { fixture, packet } = await loaded();
    expect(packet.issuer.filings).toHaveLength(2);
    expect(packet.issuer).toMatchObject({
      matchingFilings: 2,
      truncated: false,
      olderHistoryAvailable: true,
    });
    expect(
      filingReferenceNoteExcerpt(packet, packet.issuer.filings[0]!, false),
    ).toBe(filingAssessmentCitation);
    expect(Array.from(filingAssessmentResult).length).toBeLessThan(2000);
    expect(fixture.getSnapshot()).toMatchObject({
      resolve: 1,
      filings: 1,
      eod: 0,
      annual: 0,
      interim: 0,
      calendar: 0,
      fed: 0,
      cpi: 0,
      save: 0,
    });
  });

  it("admits one complete canonical Save and a separate fresh session Load without writing Watchlist", async () => {
    const { fixture, signal, original } = await loaded();
    const input = command(fixture);
    // Key order is not resource semantics. Arrays and every field remain exact.
    const reordered = {
      ...input,
      payload: {
        ...input.payload,
        entries: input.payload.entries.map((entry) =>
          Object.fromEntries(Object.entries(entry).reverse()),
        ),
      },
    };
    const receipt = await fixture.api.saveFollowups(
      reordered as unknown as typeof input,
      signal,
    );
    expect(receipt.version).toBe(2);
    expect(encodeResearchFollowupsPayload(receipt.payload)).toBe(
      encodeResearchFollowupsPayload(input.payload),
    );
    expect(receipt.payload.entries[1]).toEqual(original.payload.entries[1]);
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      save: 1,
      commits: 1,
      load: 1,
    });
    fixture.followups!.nextSession();
    await fixture.api.load(signal);
    const fresh = await fixture.api.loadFollowups(signal);
    expect(fresh.version).toBe(2);
    expect(encodeResearchFollowupsPayload(fresh.payload)).toBe(
      encodeResearchFollowupsPayload(input.payload),
    );
    expect(fixture.getSnapshot()).toMatchObject({
      save: 0,
      filings: 1,
      resolve: 1,
    });
    expect(fixture.filingAssessment!.getSnapshot().rejected).toBe(0);
  });

  it("keeps the explicit completion date when separate Save crosses UTC midnight", async () => {
    const { fixture, signal } = await loaded();
    const input = command(fixture);
    vi.setSystemTime(new Date("2026-10-30T00:01:00.000Z"));
    const receipt = await fixture.api.saveFollowups(input, signal);
    expect(receipt.payload.entries[0]!.completedOn).toBe("2026-10-29");
    expect(encodeResearchFollowupsPayload(receipt.payload)).toBe(
      encodeResearchFollowupsPayload(input.payload),
    );
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      save: 1,
      commits: 1,
    });
    expect(fixture.getSnapshot().save).toBe(0);
    expect(fixture.filingAssessment!.getSnapshot().rejected).toBe(0);
  });

  it.each([
    "question",
    "due",
    "identity",
    "catalog",
    "result",
    "status",
    "completion",
    "other-entry",
    "order",
    "extra-entry",
  ])(
    "refuses changed %s in the whole two-entry resource before a commit",
    async (kind) => {
      const { fixture, signal } = await loaded();
      const original = command(fixture);
      const input = {
        ...original,
        payload: {
          ...original.payload,
          entries: original.payload.entries.map((entry) => ({
            ...entry,
            listing: { ...entry.listing },
          })),
        },
      };
      const entry = input.payload.entries[0]!;
      switch (kind) {
        case "question":
          entry.check += " changed";
          break;
        case "due":
          entry.dueOn = "2000-01-02";
          break;
        case "identity":
          entry.listing = input.payload.entries[1]!.listing;
          break;
        case "catalog":
          entry.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
          break;
        case "result":
          entry.result += " changed";
          break;
        case "status":
          entry.status = "open";
          entry.completedOn = null;
          break;
        case "completion":
          entry.completedOn = "2026-10-28";
          break;
        case "other-entry":
          input.payload.entries[1]!.result += " changed";
          break;
        case "order":
          input.payload.entries.reverse();
          break;
        case "extra-entry":
          input.payload.entries.push(structuredClone(entry));
          break;
      }
      expect(() => fixture.api.saveFollowups(input, signal)).toThrow();
      expect(fixture.followups!.getSnapshot()).toMatchObject({
        save: 0,
        commits: 0,
      });
    },
  );

  it.each(["unknown-key", "JSON-text", "wrong-version"])(
    "refuses malformed %s command envelopes",
    async (kind) => {
      const { fixture, signal } = await loaded();
      const input = command(fixture);
      const malformed =
        kind === "unknown-key"
          ? { ...input, extra: true }
          : kind === "JSON-text"
            ? JSON.stringify(input)
            : { ...input, expectedVersion: 0 };
      expect(() =>
        fixture.api.saveFollowups(malformed as typeof input, signal),
      ).toThrow();
      expect(fixture.followups!.getSnapshot().commits).toBe(0);
    },
  );

  it("refuses a provider refresh, unchosen company and Watchlist Save without changing either saved resource", async () => {
    const { fixture, signal } = await loaded();
    expect(() =>
      fixture.api.resolve(
        {
          snapshotSha256: fixture.researchCoverage.catalogSnapshotSha256,
          listingIds: ["listing-one"],
        },
        signal,
      ),
    ).toThrow();
    expect(() => fixture.api.interimReport({} as never, signal)).toThrow();
    expect(() => fixture.api.save({} as never, signal)).toThrow();
    expect(fixture.followups!.getSnapshot()).toMatchObject({
      save: 0,
      commits: 0,
    });
    expect(fixture.getSnapshot()).toMatchObject({
      filings: 1,
      interim: 1,
      save: 1,
    });
    expect(fixture.filingAssessment!.getSnapshot().rejected).toBe(3);
  });
});
