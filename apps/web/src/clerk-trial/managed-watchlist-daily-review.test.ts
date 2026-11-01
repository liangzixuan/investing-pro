import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedEodHistoryResponseDto,
  ManagedSecFilingsResponseDto,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import {
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";
import { ManagedFilingsReview } from "./managed-filings-review";
import { ManagedEodAccess } from "./managed-eod-access";
import { ManagedSecAccess } from "./managed-sec-access";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { watchlistFilingsIdentity } from "./managed-watchlist-filings";
import {
  watchlistDailyReviewPlan,
  type WatchlistDailyReviewSource,
} from "./managed-watchlist-daily-review";

const digest = eodSelection.catalogSnapshotSha256;
const members: WatchlistMembership[] = Array.from({ length: 3 }, (_, i) => ({
  ...eodSelection.listing,
  listingId: `listing-${i}`,
  securityId: `security-${i}`,
  shareClassId: `class-${i}`,
  shareClassName: `Class ${i}`,
  symbol: i === 0 ? "GOOGL" : i === 1 ? "GOOG" : "NVDA",
  note: `Whole note ${i} Café 😀`,
}));
const draft = (list = members): MainWatchlistPayload => ({
  schemaVersion: 1,
  name: "My Watchlist",
  snapshotSha256: digest,
  memberships: list,
});
const priceWire = (i: number): ManagedEodHistoryResponseDto => ({
  ...eodResponse(),
  security: watchlistFilingsIdentity(members[i]!),
});
const filingsWire = (i: number, count = 2): ManagedSecFilingsResponseDto =>
  filingsResponse(count, "available", {
    ...eodSelection,
    origin: "watchlist",
    listing: watchlistFilingsIdentity(members[i]!),
  });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(seed = false) {
  const order: string[] = [];
  const price = vi
    .fn<ManagedApi["eodHistory"]>()
    .mockImplementation((request) => {
      order.push(`price:${request.listingId}`);
      return Promise.resolve(
        priceWire(
          members.findIndex((row) => row.listingId === request.listingId),
        ),
      );
    });
  const filings = vi
    .fn<ManagedApi["recentFilings"]>()
    .mockImplementation((request) => {
      order.push(`filings:${request.listingId}`);
      return Promise.resolve(
        filingsWire(
          members.findIndex((row) => row.listingId === request.listingId),
          request.listingId === members[1]!.listingId ? 0 : 2,
        ),
      );
    });
  const priceAccess = new ManagedEodAccess(price);
  const secAccess = new ManagedSecAccess();
  const error = vi.fn();
  const priceSeed = vi.fn((selection: typeof eodSelection) =>
    seed && selection.listing.listingId === members[0]!.listingId
      ? { response: priceWire(0), showingPrevious: true }
      : null,
  );
  const model = new ManagedFilingsReview(filings, error, secAccess, {
    coverage: createManagedResearchCoverageFixture(
      members.slice(0, 2).map((listing) => ({ listing, cik: "0000000001" })),
    ),
    daily: {
      readPrice: price,
      priceAccess,
      priceCoverage: members.slice(0, 2),
      priceSeed,
    },
  });
  model.reconcile(draft(), digest, true, true);
  const choose = (...indices: number[]) => {
    for (const i of indices)
      model.choose(model.getSnapshot(), model.getSnapshot().memberships[i]!);
  };
  const start = (...indices: number[]) => {
    choose(...indices);
    return model.startDaily(model.getSnapshot());
  };
  const preview = (
    names: readonly WatchlistDailyReviewSource[] = ["price", "filings"],
  ) => model.prepareDaily(model.getSnapshot(), names)!;
  const run = async (names?: readonly WatchlistDailyReviewSource[]) => {
    const plan = preview(names);
    await model.runDaily(model.getSnapshot(), plan);
    return plan;
  };
  return {
    model,
    price,
    filings,
    priceAccess,
    secAccess,
    error,
    priceSeed,
    order,
    choose,
    start,
    preview,
    run,
  };
}
afterEach(() => vi.useRealTimers());
describe("Watchlist daily review owned missing-read pass", () => {
  it("keeps all exact ordered rows, independent share-class packets and clocks through inspect, Back and Finish with no reads", async () => {
    const f = fixture();
    const installed = f.start(1, 0, 2);
    expect(installed).toBe(f.model.getSnapshot());
    expect(f.order).toEqual([]);
    const plan = f.preview();
    expect(
      plan.rows.map((row) => [
        row.member.listing.symbol,
        row.source,
        row.disposition,
      ]),
    ).toEqual([
      ["GOOG", "price", "missing"],
      ["GOOG", "filings", "missing"],
      ["GOOGL", "price", "missing"],
      ["GOOGL", "filings", "missing"],
      ["NVDA", "price", "unsupported"],
      ["NVDA", "filings", "unsupported"],
    ]);
    await f.model.runDaily(f.model.getSnapshot(), plan);
    expect(f.order).toEqual([
      "price:listing-1",
      "filings:listing-1",
      "price:listing-0",
      "filings:listing-0",
    ]);
    expect(
      f.model.getSnapshot().daily?.outcomes.map((row) => row.status),
    ).toEqual([
      "loaded",
      "verified-empty",
      "loaded",
      "loaded",
      "unsupported",
      "unsupported",
    ]);
    const row = f.model.getSnapshot().rows[0]!;
    f.model.select(f.model.getSnapshot(), row.member);
    const capture = f.model.captureDaily(f.model.getSnapshot())!;
    const handoff = f.model.admitDaily(capture)!;
    expect(handoff.priceSeed?.response).toEqual(priceWire(1));
    expect(handoff.filingsSeed?.response).toEqual(filingsWire(1, 0));
    expect(handoff.selection.listing.shareClassId).toBe("class-1");
    f.model.reconcile(draft(), digest, true, false);
    f.model.reconcile(draft(), digest, true, true);
    expect(f.model.getSnapshot().rows[0]).toBe(row);
    const finished = f.model.finishDaily(f.model.getSnapshot())!;
    expect(finished).toBe(f.model.getSnapshot());
    expect(finished.daily?.phase).toBe("finished");
    expect(finished.rows[0]!.filings.response?.completedAt).toBe(
      "2026-10-12T00:00:01.000Z",
    );
    expect(finished.rows[0]!.price?.response?.completedAt).toBe(
      "2026-09-20T00:00:01.000Z",
    );
    expect(f.model.canAdmitDaily(capture)).toBe(false);
    expect(f.model.captureDaily(finished)).toBeNull();
    expect(f.model.prepareDaily(finished, ["price"])).toBeNull();
    await f.model.load(finished);
    expect(f.order).toHaveLength(4);
    expect(f.model.resetDaily(finished)).toBe(f.model.getSnapshot());
    expect(f.model.getSnapshot().rows).toEqual([]);
    expect(f.model.getSnapshot().daily).toBeNull();
  });

  it("retains all received evidence on a partial pass and requires explicit repreview for remaining work", async () => {
    const f = fixture();
    f.start(0, 1, 2);
    f.price
      .mockResolvedValueOnce(priceWire(0))
      .mockRejectedValueOnce(new ManagedEodHistoryError("request_timeout"));
    await f.run();
    expect(
      f.model.getSnapshot().daily?.outcomes.map((row) => row.status),
    ).toEqual([
      "loaded",
      "loaded",
      "failed",
      "unattempted",
      "unsupported",
      "unsupported",
    ]);
    expect(f.filings).toHaveBeenCalledTimes(1);
    const kept = f.model.getSnapshot().rows[0]!;
    const plan = await f.run();
    expect(plan.rows.slice(0, 2).map((row) => row.disposition)).toEqual([
      "retained",
      "retained",
    ]);
    expect(f.model.getSnapshot().rows[0]).toBe(kept);
    expect(f.price).toHaveBeenCalledTimes(3);
    expect(f.filings).toHaveBeenCalledTimes(2);
    await f.run();
    expect(f.price).toHaveBeenCalledTimes(3);
    expect(f.filings).toHaveBeenCalledTimes(2);
  });

  it("reuses a checked initial Price seed, preserving a failed-refresh flag without refreshing", async () => {
    const f = fixture(true);
    f.start(0);
    const plan = await f.run();
    expect(plan.rows[0]!.disposition).toBe("retained");
    expect(f.price).not.toHaveBeenCalled();
    const capture = f.model.captureDaily(f.model.getSnapshot())!;
    expect(capture.price.showingPrevious).toBe(true);
    expect(f.model.admitDaily(capture)?.priceSeed?.showingPrevious).toBe(true);
    expect(capture.price.response).toEqual(priceWire(0));
  });

  it("uses the existing shared cooldown and leaves later work unattempted without scheduling a retry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-12T00:00:00Z");
    const f = fixture();
    f.start(0, 1);
    f.price.mockRejectedValueOnce(
      new ManagedEodCooldownError("2026-10-12T00:02:00.000Z"),
    );
    await f.run();
    expect(
      f.model.getSnapshot().daily?.outcomes.map((row) => row.status),
    ).toEqual(["cooldown", "unattempted", "unattempted", "unattempted"]);
    expect(f.priceAccess.getNextAllowedAt()).toBe("2026-10-12T00:02:00.000Z");
    await vi.advanceTimersByTimeAsync(121_000);
    expect(f.price).toHaveBeenCalledTimes(1);
    expect(f.filings).not.toHaveBeenCalled();
  });

  it("distinguishes a source refusal packet from verified-empty Filings and preserves the entire lastCheck", async () => {
    const f = fixture();
    f.start(0, 1);
    const refused = filingsResponse(0, "upstream_unavailable", {
      ...eodSelection,
      listing: watchlistFilingsIdentity(members[0]!),
    });
    f.filings.mockResolvedValueOnce(refused);
    await f.run();
    const row = f.model.getSnapshot().rows[0]!;
    expect(row.filings.response).toEqual(refused);
    expect(row.filings.lastCheck).toEqual(refused);
    expect(
      f.model.getSnapshot().daily?.outcomes.map((outcome) => outcome.status),
    ).toEqual(["loaded", "unavailable", "unattempted", "unattempted"]);
    expect(
      f.model.admitDaily(f.model.captureDaily(f.model.getSnapshot())!)
        ?.filingsSeed?.response,
    ).toEqual(refused);
  });

  it("cancels only the active read, retains completed rows, fences late completion and permits a fresh explicit pass", async () => {
    const f = fixture();
    f.start(0, 1);
    const wait = deferred<ManagedSecFilingsResponseDto>();
    f.filings.mockReturnValueOnce(wait.promise);
    const plan = f.preview();
    const running = f.model.runDaily(f.model.getSnapshot(), plan);
    await vi.waitFor(() => expect(f.filings).toHaveBeenCalledTimes(1));
    const signal = f.filings.mock.calls[0]![1];
    f.model.cancelDaily();
    expect(signal.aborted).toBe(true);
    expect(
      f.model.getSnapshot().daily?.outcomes.map((row) => row.status),
    ).toEqual(["loaded", "cancelled", "unattempted", "unattempted"]);
    const cancelled = f.model.getSnapshot();
    wait.resolve(filingsWire(0));
    await running;
    expect(f.model.getSnapshot()).toBe(cancelled);
    await f.model.runDaily(cancelled, plan);
    expect(f.filings).toHaveBeenCalledTimes(1);
    await f.run();
    expect(f.price).toHaveBeenCalledTimes(2);
    expect(f.filings).toHaveBeenCalledTimes(3);
  });

  it.each(["reorder", "other-member", "identity", "catalog", "leave"])(
    "retires daily evidence and plans on %s, including same-value ABA",
    async (kind) => {
      const f = fixture();
      f.start(0);
      const plan = f.preview();
      const state = f.model.getSnapshot();
      if (kind === "leave") f.model.leave();
      else if (kind === "catalog")
        f.model.reconcile(
          { ...draft(), snapshotSha256: `sha256:${"b".repeat(64)}` },
          `sha256:${"b".repeat(64)}`,
          true,
          true,
        );
      else {
        const changed =
          kind === "reorder"
            ? [...members].reverse()
            : members.map((member, i) =>
                i === (kind === "identity" ? 0 : 2)
                  ? { ...member, securityName: "Different full identity" }
                  : member,
              );
        f.model.reconcile(draft(changed), digest, true, true);
      }
      f.model.reconcile(draft(), digest, true, true);
      expect(f.model.getSnapshot().daily).toBeNull();
      await f.model.runDaily(state, plan);
      expect(f.price).not.toHaveBeenCalled();
      expect(f.filings).not.toHaveBeenCalled();
    },
  );

  it("keeps authored note changes and complete evidence but invalidates previews across read-availability ABA", async () => {
    const f = fixture();
    f.start(0);
    const plan = f.preview();
    f.model.reconcile(
      draft(
        members.map((member) => ({
          ...member,
          note: member.note + " authored",
        })),
      ),
      digest,
      true,
      true,
    );
    expect(f.model.canRunDaily(f.model.getSnapshot(), plan)).toBe(true);
    f.model.reconcile(draft(), digest, true, false);
    f.model.reconcile(draft(), digest, true, true);
    expect(f.model.canRunDaily(f.model.getSnapshot(), plan)).toBe(false);
    await f.run();
    expect(f.price).toHaveBeenCalledTimes(1);
    expect(f.filings).toHaveBeenCalledTimes(1);
  });

  it.each(["cancel", "leave", "select"])(
    "checks subscriber reentrancy before the first read: %s",
    async (action) => {
      const f = fixture();
      f.start(0, 1);
      const plan = f.preview();
      const off = f.model.subscribe(() => {
        if (f.model.getSnapshot().daily?.phase !== "running") return;
        off();
        if (action === "cancel") f.model.cancelDaily();
        else if (action === "leave") f.model.leave();
        else
          f.model.select(
            f.model.getSnapshot(),
            f.model.getSnapshot().rows[1]!.member,
          );
      });
      await f.model.runDaily(f.model.getSnapshot(), plan);
      expect(f.price).not.toHaveBeenCalled();
      expect(f.filings).not.toHaveBeenCalled();
    },
  );

  it("does not install a group after a seed callback retires its exact owner", () => {
    const f = fixture();
    f.priceSeed.mockImplementation(() => {
      f.model.leave();
      return null;
    });
    expect(f.start(0)).toBeNull();
    expect(f.model.getSnapshot().rows).toEqual([]);
    expect(f.model.getSnapshot().daily).toBeNull();
    expect(f.price).not.toHaveBeenCalled();
  });

  it("returns no committed finish after a subscriber replaces the finished reading", async () => {
    const f = fixture();
    f.start(0);
    await f.run();
    const off = f.model.subscribe(() => {
      if (f.model.getSnapshot().daily?.phase === "finished") {
        off();
        f.model.leave();
      }
    });
    expect(f.model.finishDaily(f.model.getSnapshot())).toBeNull();
    expect(f.model.getSnapshot().rows).toEqual([]);
  });

  it("refuses cloned or stale plans and cross-share-class captures without a source read", async () => {
    const f = fixture();
    f.start(0, 1);
    const plan = f.preview();
    await f.model.runDaily(f.model.getSnapshot(), { ...plan });
    expect(f.price).not.toHaveBeenCalled();
    await f.model.runDaily(f.model.getSnapshot(), plan);
    const captured = f.model.captureDaily(f.model.getSnapshot())!;
    expect(
      f.model.admitDaily({
        ...captured,
        member: f.model.getSnapshot().rows[0]!.member,
      }),
    ).toBeNull();
    expect(f.model.canRunDaily(f.model.getSnapshot(), plan)).toBe(false);
    expect(
      f.model.prepareDaily(f.model.getSnapshot(), ["price", "price"]),
    ).toBeNull();
    expect(watchlistDailyReviewPlan([], ["price"])).toBeNull();
  });

  it("shows unselected source rows and can finish an unread group without reads", () => {
    const f = fixture();
    f.start(0, 2);
    const plan = f.preview(["filings"]);
    expect(plan.rows.map((row) => row.disposition)).toEqual([
      "not-selected",
      "missing",
      "not-selected",
      "unsupported",
    ]);
    const finished = f.model.finishDaily(f.model.getSnapshot())!;
    expect(finished.daily?.outcomes.map((row) => row.status)).toEqual([
      "not-selected",
      "unattempted",
      "not-selected",
      "unsupported",
    ]);
    expect(f.price).not.toHaveBeenCalled();
    expect(f.filings).not.toHaveBeenCalled();
  });
  it("rejects captured Inspect capabilities across selection and availability ABA while keeping passive evidence", async () => {
    const f = fixture();
    f.start(0, 1);
    await f.run();
    const capture = f.model.captureDaily(f.model.getSnapshot())!;
    const first = f.model.getSnapshot().rows[0]!.member;
    f.model.select(f.model.getSnapshot(), first);
    f.model.select(f.model.getSnapshot(), capture.member);
    expect(f.model.canAdmitDaily(capture)).toBe(false);
    const current = f.model.captureDaily(f.model.getSnapshot())!;
    f.model.reconcile(draft(), digest, false, false);
    f.model.reconcile(draft(), digest, true, true);
    expect(f.model.canAdmitDaily(current)).toBe(false);
    expect(
      f.model.admitDaily(f.model.captureDaily(f.model.getSnapshot())!)
        ?.priceSeed?.response,
    ).toEqual(priceWire(1));
    expect(f.price).toHaveBeenCalledTimes(2);
    expect(f.filings).toHaveBeenCalledTimes(2);
  });
  it("settles a catalog refusal truthfully without leaving a running outcome or starting another source", async () => {
    const f = fixture();
    f.start(0, 1);
    f.price.mockRejectedValueOnce(new ManagedCatalogChangedError());
    await f.run();
    expect(f.model.getSnapshot().catalogChanged).toBe(true);
    expect(f.model.getSnapshot().daily?.phase).toBe("settled");
    expect(
      f.model.getSnapshot().daily?.outcomes.map((row) => row.status),
    ).toEqual(["failed", "unattempted", "unattempted", "unattempted"]);
    expect(f.filings).not.toHaveBeenCalled();
  });
});
