import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import {
  comparisonFollowupFixture,
  disposeComparisonFollowupFixture,
  followupId,
} from "./managed-screen-comparison-followup-fixture";
import {
  prepareScreenComparisonFollowup,
  screenComparisonFollowupReference,
} from "./managed-screen-comparison-followup";
const fixtures: Awaited<ReturnType<typeof comparisonFollowupFixture>>[] = [];
async function fixture(...args: Parameters<typeof comparisonFollowupFixture>) {
  const f = await comparisonFollowupFixture(...args);
  fixtures.push(f);
  return f;
}
afterEach(() => {
  for (const f of fixtures.splice(0)) disposeComparisonFollowupFixture(f);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("one authored check from an exact screening pair", () => {
  it.each(["left", "right"] as const)(
    "keeps the complete immutable context and creates only the selected %s draft once",
    async (side) => {
      const f = await fixture();
      const watchlist = f.watchlist.getSnapshot();
      const sourceCalls = [
        f.screen.read.mock.calls.length,
        f.screen.resolve.mock.calls.length,
      ];
      const preview = f.prepare(
        "Will the next Annual change this view? Café 東京 😀",
        "2026-12-31",
        side,
      ).preview!;
      expect(preview).not.toBeNull();
      expect(preview.comparison).toBe(f.source.comparison);
      expect(preview.listing).toEqual(f.source.comparison[side].listing);
      expect(preview.catalogSnapshotSha256).toBe(
        f.source.comparison.catalogSnapshotSha256,
      );
      expect(preview.comparison.left.response).toBe(f.screen.left);
      expect(preview.comparison.right.response).toBe(f.screen.right);
      expect(preview.comparison.left.response.evidence.target).not.toEqual(
        preview.comparison.right.response.evidence.target,
      );
      for (const company of [preview.comparison.left, preview.comparison.right])
        expect(
          company.view.statements.statements.map((group) => group.id),
        ).toEqual(["income_statement", "balance_sheet", "cash_flow"]);
      expect(preview.check).toBe(
        "Question: Will the next Annual change this view? Café 東京 😀 | Comparison reference: " +
          f.source.comparison.left.listing.listingId +
          " / " +
          f.source.comparison.right.listing.listingId +
          "; captured " +
          f.source.comparison.preparedAt +
          ". Full criteria, statements and source evidence not included.",
      );
      expect(Object.isFrozen(preview.comparison)).toBe(true);
      const created = preview.create()!;
      expect(created.check).toBe(preview.check);
      expect(created.dueOn).toBe("2026-12-31");
      expect(created.listing).toEqual(preview.listing);
      expect(created.catalogSnapshotSha256).toBe(preview.catalogSnapshotSha256);
      expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([
        created,
      ]);
      expect(preview.create()).toBeNull();
      expect(preview.isCurrent()).toBe(false);
      expect(f.watchlist.getSnapshot()).toBe(watchlist);
      expect(watchlist.dirty).toBe(true);
      expect([
        f.screen.read.mock.calls.length,
        f.screen.resolve.mock.calls.length,
      ]).toEqual(sourceCalls);
      expect(f.api.saveFollowups).not.toHaveBeenCalled();
      expect(f.watchlistSave).not.toHaveBeenCalled();
    },
  );
  it("persists only the explicit complete question on separate Save and fresh Load", async () => {
    const f = await fixture();
    const created = f.prepare().preview!.create()!;
    expect(f.stored().payload.entries).toEqual([]);
    await f.followups.coordinator.save();
    expect(f.api.saveFollowups).toHaveBeenCalledOnce();
    await f.followups.coordinator.load();
    expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([
      created,
    ]);
    expect(Object.keys(created).sort()).toEqual([
      "catalogSnapshotSha256",
      "check",
      "completedOn",
      "dueOn",
      "id",
      "listing",
      "result",
      "status",
    ]);
    expect(f.watchlistSave).not.toHaveBeenCalled();
  });
  it("preserves partial-source failures and original packets without inferring missing values", async () => {
    const f = await fixture(true, [], {
      leftOptions: { mode: "source-unavailable" },
    });
    const preview = f.prepare().preview!;
    expect(preview.comparison.left.failure).toContain("unavailable");
    expect(preview.comparison.left.response.evidence.generation).toEqual(
      f.screen.left.evidence.generation,
    );
    expect(preview.comparison.left.view.statements).toEqual(
      f.source.comparison.left.view.statements,
    );
    expect(preview.create()).not.toBeNull();
  });
  it.each([
    "",
    " ",
    "line\nbreak",
    "control\u0000",
    "hidden\u200b",
    "direction\u202e",
    "surrogate\ud800",
  ])(
    "refuses unsupported complete question %j without clipping",
    async (question) => {
      const f = await fixture();
      const raw = question;
      expect(f.prepare(question).preview).toBeNull();
      expect(question).toBe(raw);
      expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([]);
    },
  );
  it.each(["x", "😀"])(
    "admits exact500 codepoints using %s and refuses501",
    async (symbol) => {
      const f = await fixture();
      const reference = screenComparisonFollowupReference(f.source.comparison)!;
      const count = 500 - [...("Question:  | " + reference)].length;
      const question = symbol.repeat(count);
      const preview = f.prepare(question).preview!;
      expect([...preview.check]).toHaveLength(500);
      expect(preview.check).toContain(question);
      expect(f.prepare(question + symbol).preview).toBeNull();
      expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([]);
    },
  );
  it.each(["2026-02-29", "2026-13-01", "10000-01-01", "2026-12-31\n"])(
    "refuses invalid UTC planning date %j",
    async (date) => {
      const f = await fixture();
      expect(f.prepare("Question", date).preview).toBeNull();
    },
  );
  it("does not infer a planning date from a source or capture clock", async () => {
    const f = await fixture();
    expect(f.prepare("Question", "0001-01-01").preview!.dueOn).toBe(
      "0001-01-01",
    );
  });
  it.each(["side", "member", "copied comparison"])(
    "refuses a forged %s before any draft mutation",
    async (cause) => {
      const f = await fixture();
      const port = f.port();
      const changed =
        cause === "side"
          ? { ...port, side: "third" as "left" }
          : cause === "member"
            ? {
                ...port,
                member: { ...port.member, shareClassId: "foreign-class" },
              }
            : { ...port, comparison: { ...port.comparison } };
      expect(
        prepareScreenComparisonFollowup(
          changed,
          { question: "Question", dueOn: "2026-12-31" },
          () => true,
        ).preview,
      ).toBeNull();
      expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([]);
    },
  );
  it("consumes before subscriber reentry, and copied methods cannot create or cancel the original", async () => {
    const f = await fixture();
    const preview = f.prepare().preview!;
    const copy = { ...preview };
    expect(copy.create()).toBeNull();
    copy.cancel();
    expect(preview.isCurrent()).toBe(true);
    const attempts: unknown[] = [];
    const stop = f.followups.subscribe(() => {
      attempts.push(preview.create());
    });
    expect(preview.create()).not.toBeNull();
    stop();
    expect(attempts.length).toBeGreaterThan(0);
    expect(attempts.every((value) => value === null)).toBe(true);
    expect(f.followups.coordinator.getSnapshot().draft!.entries).toHaveLength(
      1,
    );
  });
  it("cancel and observed form ABA permanently consume the old action", async () => {
    const f = await fixture();
    const cancelled = f.prepare().preview!;
    cancelled.cancel();
    expect(cancelled.create()).toBeNull();
    const preview = f.prepare().preview!;
    f.form.current = false;
    expect(preview.isCurrent()).toBe(false);
    f.form.current = true;
    expect(preview.create()).toBeNull();
    expect(f.prepare().preview!.isCurrent()).toBe(true);
  });
  it("rechecks context after primitive preparation callbacks", async () => {
    const f = await fixture();
    const original = f.followups.prepareNextCheck.bind(f.followups);
    vi.spyOn(f.followups, "prepareNextCheck").mockImplementation((...args) => {
      const result = original(...args);
      f.form.current = false;
      return result;
    });
    expect(f.prepare().preview).toBeNull();
    expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([]);
  });
  it("refuses the20-entry limit and an existing completed exact listing without overwrite", async () => {
    const f = await fixture();
    const listing = f.source.comparison.left.listing;
    const existing = (n: number, same = false): ResearchFollowup => ({
      id: followupId(n),
      listing: same ? listing : { ...listing, listingId: "other-" + n },
      catalogSnapshotSha256: f.source.comparison.catalogSnapshotSha256,
      check: "Previous completed question",
      dueOn: "2026-12-31",
      status: "completed",
      completedOn: "2026-09-20",
      result: "Previous result",
    });
    f.followups.coordinator.replaceDraft({
      schemaVersion: 1,
      entries: [existing(1, true)],
    });
    expect(f.prepare().preview).toBeNull();
    const full = Array.from({ length: 20 }, (_, n) => existing(n + 1));
    f.followups.coordinator.replaceDraft({ schemaVersion: 1, entries: full });
    expect(f.prepare().preview).toBeNull();
    expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual(full);
  });
});
