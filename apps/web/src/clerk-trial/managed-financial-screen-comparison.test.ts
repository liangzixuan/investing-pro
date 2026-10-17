import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type {
  ManagedEodIdentity,
  PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import {
  ManagedFinancialScreen,
  type ManagedFinancialScreenResultRow,
  type ManagedFinancialScreenState,
} from "./managed-financial-screen";
import { eodSelection } from "./eod-history-fixture";
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";

const digest = eodSelection.catalogSnapshotSha256;
const first = eodSelection.listing;
const second: ManagedEodIdentity = {
  ...first,
  listingId: "listing-one",
  issuerId: "issuer-one",
  issuerName: "One Company",
  securityId: "security-one",
  securityName: "One Class A",
  shareClassId: "class-one",
  symbol: "ONE",
};
const third: ManagedEodIdentity = {
  ...second,
  listingId: "listing-two",
  issuerId: "issuer-two",
  securityId: "security-two",
  shareClassId: "class-two",
  symbol: "TWO",
};
let left: PersonalSecAnnualCanonicalResponseDto;
let right: PersonalSecAnnualCanonicalResponseDto;
beforeAll(async () => {
  [left, right] = await Promise.all([
    annualComparisonResponse("left"),
    annualComparisonResponse("right"),
  ]);
});
afterEach(() => vi.useRealTimers());

async function fixture(listings = [first, second]) {
  vi.useFakeTimers({
    toFake: ["Date", "performance", "setTimeout", "clearTimeout"],
  });
  vi.setSystemTime(new Date("2026-09-20T00:00:00.000Z"));
  const read = vi
    .fn<ManagedApi["annualReport"]>()
    .mockImplementation((request) =>
      Promise.resolve(request.listingId === second.listingId ? right : left),
    );
  const resolve = vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
    Promise.resolve({
      snapshotSha256: request.snapshotSha256,
      results: request.listingIds.map((listingId) => ({
        listingId,
        listing: listings.find((listing) => listing.listingId === listingId)!,
      })),
    }),
  );
  const model = new ManagedFinancialScreen(
    { resolve, annualReport: read },
    vi.fn(),
    undefined,
    listings.map((listing) => listing.listingId),
  );
  model.reconcile(digest, true, true);
  await model.loadUniverse(model.getSnapshot());
  const run = () => model.run(model.getSnapshot());
  return { model, read, resolve, run };
}
async function loaded() {
  const f = await fixture();
  const running = f.run();
  await vi.advanceTimersByTimeAsync(20_000);
  await running;
  const rows = f.model.getSnapshot().run!.rows;
  const choose = (
    side: "left" | "right",
    row: ManagedFinancialScreenResultRow | null,
  ) => f.model.selectComparison(f.model.getSnapshot(), side, row);
  choose("left", rows[0]!);
  choose("right", rows[1]!);
  return { ...f, rows, choose };
}

describe("screen-owned Annual comparison choices", () => {
  it("retains two distinct exact result and source handles without more reads, and clears each side explicitly", async () => {
    const f = await loaded();
    const pair = f.model.getSnapshot().comparison;
    expect(pair.left).toBe(f.rows[0]);
    expect(pair.right).toBe(f.rows[1]);
    expect(pair.left!.report!.response).toBe(left);
    expect(pair.right!.report!.response).toBe(right);
    expect(Object.isFrozen(pair)).toBe(true);
    const before = f.model.getSnapshot();
    f.choose("right", f.rows[0]!);
    expect(f.model.getSnapshot()).toBe(before);
    f.choose("left", null);
    expect(f.model.getSnapshot().comparison).toEqual({
      left: null,
      right: f.rows[1],
    });
    f.choose("right", null);
    expect(f.model.getSnapshot().comparison).toEqual({
      left: null,
      right: null,
    });
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.resolve).toHaveBeenCalledOnce();
  });

  it("refuses copied, accessor-bearing and foreign rows or states without evaluating getters", async () => {
    const f = await loaded();
    const other = await loaded();
    const getter = vi.fn();
    const before = f.model.getSnapshot();
    for (const row of [
      { ...f.rows[0]! },
      other.rows[0]!,
      {
        ...f.rows[0]!,
        get report() {
          getter();
          return f.rows[0]!.report;
        },
      },
    ]) {
      f.model.selectComparison(before, "left", row);
      expect(f.model.getSnapshot()).toBe(before);
    }
    f.model.selectComparison({ ...before }, "left", null);
    f.model.selectComparison(
      {
        get active() {
          getter();
          return true;
        },
      } as ManagedFinancialScreenState,
      "left",
      null,
    );
    f.model.selectComparison(before, "invalid" as "left", null);
    expect(f.model.getSnapshot()).toBe(before);
    expect(getter).not.toHaveBeenCalled();
  });

  it("requires the latest captured state after either selection or ordinary shortlist changes", async () => {
    const f = await loaded();
    const before = f.model.getSnapshot();
    f.choose("left", null);
    f.model.selectComparison(before, "left", f.rows[0]!);
    expect(f.model.getSnapshot().comparison.left).toBeNull();
    const captured = f.model.getSnapshot();
    f.model.toggleShortlist(captured, f.rows[0]!);
    const current = f.model.getSnapshot();
    f.model.selectComparison(captured, "right", null);
    expect(f.model.getSnapshot()).toBe(current);
    expect(current.shortlist).toEqual([f.rows[0]]);
    expect(current.comparison.right).toBe(f.rows[1]);
  });

  it("refuses running or unread results and admits the two completed rows after explicit cancellation settles", async () => {
    const f = await fixture([first, second, third]);
    const running = f.run();
    await vi.advanceTimersByTimeAsync(20_000);
    const pending = f.model.getSnapshot();
    expect(pending.pending?.kind).toBe("waiting");
    for (const row of pending.run!.rows)
      f.model.selectComparison(pending, "left", row);
    expect(f.model.getSnapshot()).toBe(pending);
    f.model.cancel();
    await running;
    const rows = f.model.getSnapshot().run!.rows;
    f.model.selectComparison(f.model.getSnapshot(), "left", rows[0]!);
    f.model.selectComparison(f.model.getSnapshot(), "right", rows[1]!);
    const pair = f.model.getSnapshot();
    expect(pair.comparison).toEqual({ left: rows[0], right: rows[1] });
    f.model.selectComparison(pair, "right", rows[2]!);
    expect(f.model.getSnapshot()).toBe(pair);
    await vi.advanceTimersByTimeAsync(100_000);
    expect(f.read).toHaveBeenCalledTimes(2);
  });

  it("refuses source-failed rows while retaining independently loaded results", async () => {
    const f = await fixture();
    f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
    const running = f.run();
    await vi.advanceTimersByTimeAsync(20_000);
    await running;
    const before = f.model.getSnapshot();
    f.model.selectComparison(before, "left", before.run!.rows[0]!);
    expect(f.model.getSnapshot()).toBe(before);
    f.model.selectComparison(before, "right", before.run!.rows[1]!);
    expect(f.model.getSnapshot().comparison.right).toBe(before.run!.rows[1]);
  });

  it("allows an owned loaded report with independently unavailable source evidence", async () => {
    const unavailable = await annualComparisonResponse("right", {
      mode: "source-unavailable",
    });
    const f = await fixture();
    f.read.mockResolvedValueOnce(left).mockResolvedValueOnce(unavailable);
    const running = f.run();
    await vi.advanceTimersByTimeAsync(20_000);
    await running;
    const rows = f.model.getSnapshot().run!.rows;
    expect(rows[1]!.failure).not.toBeNull();
    f.model.selectComparison(f.model.getSnapshot(), "left", rows[0]!);
    f.model.selectComparison(f.model.getSnapshot(), "right", rows[1]!);
    expect(f.model.getSnapshot().comparison.left!.report!.response).toBe(left);
    expect(f.model.getSnapshot().comparison.right!.report!.response).toBe(
      unavailable,
    );
    expect(f.read).toHaveBeenCalledTimes(2);
  });

  it.each([
    "stage",
    "apply",
    "selection",
    "run",
    "catalog",
    "access",
    "retire",
  ] as const)(
    "clears choices on %s and never revives a captured selection action",
    async (cause) => {
      const f = await loaded();
      const before = f.model.getSnapshot();
      let running: Promise<void> | undefined;
      if (cause === "stage") {
        f.model.stageCriteria(before);
        f.model.setCriteria(f.model.getSnapshot(), before.criteria);
      } else if (cause === "apply")
        f.model.setCriteria(before, before.criteria);
      else if (cause === "selection") {
        f.model.select(before, before.selected[0]!, false);
        f.model.select(f.model.getSnapshot(), before.selected[0]!, true);
      } else if (cause === "run") running = f.run();
      else if (cause === "catalog") {
        f.model.reconcile(`sha256:${"b".repeat(64)}`, true, true);
        f.model.reconcile(digest, true, true);
      } else if (cause === "access") {
        f.model.reconcile(digest, true, false);
        f.model.reconcile(digest, true, true);
      } else f.model.retire();
      const current = f.model.getSnapshot();
      expect(current.comparison).toEqual({ left: null, right: null });
      f.model.selectComparison(before, "left", f.rows[0]!);
      if (cause !== "access")
        f.model.selectComparison(current, "left", f.rows[0]!);
      expect(f.model.getSnapshot()).toBe(current);
      if (running) {
        f.model.cancel();
        await running;
      }
    },
  );

  it("retains the exact pair, shortlist and run through research and Back while retiring old callbacks", async () => {
    const f = await loaded();
    f.model.toggleShortlist(f.model.getSnapshot(), f.rows[0]!);
    const before = f.model.getSnapshot();
    const row = before.comparison.left!;
    const capture = { run: before.run!, row, response: row.report!.response! };
    expect(f.model.admitReport(capture)!.seed.response).toBe(left);
    f.model.reconcile(digest, false, false);
    const inactive = f.model.getSnapshot();
    f.model.selectComparison(inactive, "left", null);
    expect(f.model.getSnapshot()).toBe(inactive);
    expect(f.model.canAdmitReport(capture)).toBe(false);
    f.model.reconcile(digest, true, true);
    const returned = f.model.getSnapshot();
    f.model.selectComparison(before, "left", null);
    f.model.selectComparison(inactive, "right", null);
    expect(f.model.getSnapshot()).toBe(returned);
    expect(returned.comparison).toBe(before.comparison);
    expect(returned.shortlist).toBe(before.shortlist);
    expect(returned.run).toBe(before.run);
    expect(returned.criteria).toBe(before.criteria);
    expect(f.model.canAdmitReport(capture)).toBe(true);
    expect(f.model.admitReport(capture)!.seed.response).toBe(left);
    expect(f.read).toHaveBeenCalledTimes(2);
  });

  it("retires a retained pair when access is denied on return from research", async () => {
    const f = await loaded();
    const before = f.model.getSnapshot();
    f.model.reconcile(digest, false, false);
    f.model.reconcile(digest, true, false);
    const denied = f.model.getSnapshot();
    f.model.reconcile(digest, true, false);
    expect(f.model.getSnapshot()).toBe(denied);
    f.model.reconcile(digest, true, true);
    const returned = f.model.getSnapshot();
    f.model.selectComparison(denied, "left", f.rows[0]!);
    f.model.selectComparison(before, "right", f.rows[1]!);
    expect(f.model.getSnapshot()).toBe(returned);
    expect(returned.comparison).toEqual({ left: null, right: null });
    f.model.selectComparison(returned, "left", f.rows[0]!);
    expect(f.model.getSnapshot().comparison.left).toBe(f.rows[0]);
    expect(f.read).toHaveBeenCalledTimes(2);
  });
});
