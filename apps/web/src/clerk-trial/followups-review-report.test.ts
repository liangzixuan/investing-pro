import { describe, expect, it, vi } from "vitest";
import {
  isPreparedFollowupsReviewReport,
  prepareFollowupsReviewReport,
  type FollowupsReviewReportInput,
} from "./followups-review-report";
import { followupsReviewReportFixture } from "./followups-review-report-fixture";

const prepare = (input: unknown) =>
  prepareFollowupsReviewReport(input as FollowupsReviewReportInput);

describe("complete owned Follow-ups report capture", () => {
  it("captures mixed open, later and completed entries with separate authored metadata", () => {
    const input = followupsReviewReportFixture();
    const original = JSON.stringify(input);
    const report = prepareFollowupsReviewReport(input)!;
    expect(report).toEqual({
      kind: "followups_review",
      ...JSON.parse(original),
    });
    expect(report.draft.entries.map((entry) => entry.status)).toEqual([
      "open",
      "completed",
      "open",
    ]);
    expect(report.draft.entries.map((entry) => entry.dueOn)).toEqual([
      "2026-10-20",
      "2026-10-20",
      "2027-01-15",
    ]);
    expect(report.draft.entries[1]!.completedOn).toBe("2026-10-22");
    expect(JSON.stringify(input)).toBe(original);
    expect(Object.keys(report)).toEqual([
      "kind",
      "capturedAt",
      "draft",
      "baseVersion",
      "dirty",
      "currentCatalogSnapshotSha256",
    ]);
  });
  it("detaches and freezes every authored object while preserving all20 entry order", () => {
    const input = followupsReviewReportFixture(20);
    const original = JSON.stringify(input);
    const report = prepareFollowupsReviewReport(input)!;
    expect(report).not.toBeNull();
    expect(report.draft).not.toBe(input.draft);
    expect(report.draft.entries).not.toBe(input.draft.entries);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.draft)).toBe(true);
    expect(Object.isFrozen(report.draft.entries)).toBe(true);
    report.draft.entries.forEach((entry, index) => {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.listing)).toBe(true);
      expect(entry).not.toBe(input.draft.entries[index]);
      expect(entry.listing).not.toBe(input.draft.entries[index]!.listing);
      expect(entry.id).toBe(
        `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      );
    });
    Reflect.set(input.draft.entries[0]!, "check", "Later edit");
    Reflect.set(input.draft.entries[0]!.listing, "symbol", "LATER");
    Reflect.set(input, "capturedAt", "2026-10-27T00:00:00.000Z");
    expect(report).toEqual({
      kind: "followups_review",
      ...JSON.parse(original),
    });
  });
  it("preserves maximum-length full Unicode and distinct historical catalog references", () => {
    const input = followupsReviewReportFixture(20);
    const check = "📈".repeat(500);
    const result = "東京".repeat(1000);
    const draft = {
      ...input.draft,
      entries: input.draft.entries.map((entry) => ({
        ...entry,
        check,
        result,
      })),
    };
    const report = prepareFollowupsReviewReport({ ...input, draft })!;
    expect(report).not.toBeNull();
    expect(report.draft).toEqual(draft);
    expect(
      report.draft.entries.every(
        (entry) => entry.check === check && entry.result === result,
      ),
    ).toBe(true);
    expect(report.draft.entries[0]!.catalogSnapshotSha256).toBe(
      `sha256:${"0".repeat(64)}`,
    );
    expect(report.currentCatalogSnapshotSha256).toBe(
      `sha256:${"a".repeat(64)}`,
    );
  });
  it("admits an empty draft and unavailable catalog without inventing saved state", () => {
    const report = prepareFollowupsReviewReport({
      ...followupsReviewReportFixture(0),
      baseVersion: 0,
      dirty: false,
      currentCatalogSnapshotSha256: null,
    })!;
    expect(report.draft).toEqual({ schemaVersion: 1, entries: [] });
    expect(report).toMatchObject({
      baseVersion: 0,
      dirty: false,
      currentCatalogSnapshotSha256: null,
    });
    expect(
      prepare({
        ...followupsReviewReportFixture(),
        baseVersion: Number.MAX_SAFE_INTEGER,
      }),
    ).not.toBeNull();
  });
  it("brands only its original and contains hostile or revoked proxy input", () => {
    const report = prepareFollowupsReviewReport(
      followupsReviewReportFixture(),
    )!;
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("trap");
        },
      },
    );
    expect(isPreparedFollowupsReviewReport(report)).toBe(true);
    for (const value of [
      null,
      undefined,
      {},
      { ...report },
      structuredClone(report),
      hostile,
      revoked.proxy,
    ]) {
      expect(isPreparedFollowupsReviewReport(value)).toBe(false);
    }
    expect(prepare(hostile)).toBeNull();
    expect(prepare(revoked.proxy)).toBeNull();
  });
});

describe("whole Follow-ups report refusal", () => {
  it.each([
    { capturedAt: "2026-02-30T00:00:00.000Z" },
    { capturedAt: "2026-10-26T03:04:05Z" },
    { capturedAt: "2026-10-26T03:04:05.678+00:00" },
    { capturedAt: "2026-10-26T24:00:00.000Z" },
    { baseVersion: -1 },
    { baseVersion: 0.5 },
    { baseVersion: Number.MAX_SAFE_INTEGER + 1 },
    { baseVersion: NaN },
    { baseVersion: Infinity },
    { dirty: "true" },
    { dirty: 1 },
    { currentCatalogSnapshotSha256: `sha256:${"A".repeat(64)}` },
    { currentCatalogSnapshotSha256: "" },
    { currentCatalogSnapshotSha256: undefined },
    { accountScope: "must-not-be-captured" },
  ])("refuses invalid or additional metadata %j", (change) => {
    expect(
      prepare({ ...followupsReviewReportFixture(), ...change }),
    ).toBeNull();
  });
  it.each([
    { check: "" },
    { check: " question " },
    { check: "e\u0301" },
    { check: "📈".repeat(501) },
    { result: "📈".repeat(2001) },
    { check: "bad\ncontrol" },
    { result: "bad\tcontrol" },
    { check: "\ud800" },
    { result: "\udfff" },
    { result: "\u200b" },
    { dueOn: "2026-02-29" },
    { dueOn: "2026-2-20" },
    { status: "later" },
    { completedOn: "2026-10-22" },
    { catalogSnapshotSha256: `sha256:${"A".repeat(64)}` },
    { extra: "invalid" },
  ])(
    "refuses a bad raw entry without normalizing, clipping or dropping it %j",
    (change) => {
      const input = followupsReviewReportFixture();
      const entries = [...input.draft.entries];
      entries[2] = { ...entries[2]!, ...change } as never;
      expect(
        prepare({ ...input, draft: { schemaVersion: 1, entries } }),
      ).toBeNull();
    },
  );
  it("refuses invalid completed dates, duplicate IDs/listings, extra entries and over-limit payloads", () => {
    const input = followupsReviewReportFixture();
    const first = input.draft.entries[0]!;
    const second = input.draft.entries[1]!;
    for (const entries of [
      [first, { ...second, completedOn: null }],
      [first, { ...second, completedOn: "2026-02-30" }],
      [first, { ...second, id: first.id }],
      [
        first,
        {
          ...second,
          listing: { ...second.listing, listingId: first.listing.listingId },
        },
      ],
      followupsReviewReportFixture(21).draft.entries,
      followupsReviewReportFixture(20).draft.entries.map((entry) => ({
        ...entry,
        check: "📈".repeat(500),
        result: "📈".repeat(2000),
        listing: {
          ...entry.listing,
          issuerName: "📈".repeat(512),
          securityName: "📈".repeat(512),
          shareClassName: "📈".repeat(512),
        },
      })),
    ])
      expect(
        prepare({ ...input, draft: { schemaVersion: 1, entries } }),
      ).toBeNull();
  });
  it("refuses missing fields, getters, inherited input and malformed draft containers without reading accessors", () => {
    for (const key of Object.keys(followupsReviewReportFixture())) {
      const value: Record<string, unknown> = {
        ...followupsReviewReportFixture(),
      };
      delete value[key];
      expect(prepare(value)).toBeNull();
    }
    const getter = vi.fn();
    for (const value of [
      Object.defineProperty(followupsReviewReportFixture(), "dirty", {
        enumerable: true,
        get: getter,
      }),
      Object.assign(
        Object.create({ inherited: true }),
        followupsReviewReportFixture(),
      ),
      Object.defineProperty(followupsReviewReportFixture(), "hidden", {
        value: true,
      }),
    ])
      expect(prepare(value)).toBeNull();
    const input = followupsReviewReportFixture();
    Object.defineProperty(input.draft.entries[0], "check", {
      enumerable: true,
      get: getter,
    });
    expect(prepare(input)).toBeNull();
    for (const draft of [
      null,
      { schemaVersion: 2, entries: [] },
      { schemaVersion: 1, entries: new Array(1) },
      { schemaVersion: 1, entries: [], extra: true },
    ]) {
      expect(prepare({ ...followupsReviewReportFixture(), draft })).toBeNull();
    }
    expect(getter).not.toHaveBeenCalled();
  });
});
