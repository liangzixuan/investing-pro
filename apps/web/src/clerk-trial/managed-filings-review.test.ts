import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedSecFilingsResponseDto,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import {
  ManagedCatalogChangedError,
  ManagedSecCooldownError,
  ManagedSecFilingsError,
} from "./managed-api";
import { ManagedFilingsReview } from "./managed-filings-review";
import { ManagedSecAccess } from "./managed-sec-access";
import { watchlistFilingsIdentity } from "./managed-watchlist-filings";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";

const digest = filingsSelection.catalogSnapshotSha256;
const members: WatchlistMembership[] = Array.from(
  { length: 6 },
  (_, index) => ({
    ...filingsSelection.listing,
    ...(index === 0
      ? {}
      : {
          listingId: `listing-${index}`,
          securityId: `security-${index}`,
          shareClassId: `class-${index}`,
          shareClassName: `Class ${index}`,
          symbol: `ONE${index}`,
        }),
    note: `  Unchanged Café 😀 note ${index}  `,
  }),
);
function draft(entries = members): MainWatchlistPayload {
  return {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: digest,
    memberships: entries,
  };
}
function fixture() {
  const read = vi.fn<ManagedApi["recentFilings"]>();
  const error = vi.fn();
  const access = new ManagedSecAccess();
  const coverage = createManagedResearchCoverageFixture(
    members.map((listing) => ({ listing, cik: "0000000001" })),
  );
  const model = new ManagedFilingsReview(read, error, access, { coverage });
  model.reconcile(draft(), digest, true, true);
  const choose = (...indices: number[]) => {
    for (const index of indices)
      model.choose(
        model.getSnapshot(),
        model.getSnapshot().memberships[index]!,
      );
  };
  const start = (...indices: number[]) => {
    choose(...indices);
    model.start(model.getSnapshot());
  };
  const selected = () =>
    model
      .getSnapshot()
      .rows.find((row) => row.member === model.getSnapshot().selected)!;
  const wire = (index: number) =>
    filingsResponse(1, "available", {
      ...filingsSelection,
      listing: watchlistFilingsIdentity(members[index]!),
    });
  const load = async (index: number) => {
    read.mockResolvedValueOnce(wire(index));
    await model.load(model.getSnapshot());
  };
  return {
    model,
    read,
    error,
    access,
    coverage,
    choose,
    start,
    selected,
    wire,
    load,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

afterEach(() => vi.useRealTimers());
describe("watchlist filings review visit", () => {
  it("chooses at most five exact listings and starts without a read or draft change", () => {
    const f = fixture();
    const before = structuredClone(draft());
    f.choose(0, 1, 2, 3, 4, 5);
    expect(f.model.getSnapshot().chosen).toHaveLength(5);
    f.model.start(f.model.getSnapshot());
    expect(f.model.getSnapshot().rows).toHaveLength(5);
    expect(f.selected().member.listing).toEqual(filingsSelection.listing);
    expect(
      f.model.getSnapshot().rows.every((row) => row.filings.response === null),
    ).toBe(true);
    expect(f.read).not.toHaveBeenCalled();
    expect(draft()).toEqual(before);
    f.model.choose(
      f.model.getSnapshot(),
      f.model.getSnapshot().memberships[5]!,
    );
    expect(f.model.getSnapshot().chosen).toHaveLength(5);
  });

  it("retains separate packets for two share classes and reuses the exact selected packet for research", async () => {
    const f = fixture();
    f.start(0, 1);
    await f.load(0);
    const first = f.selected();
    const firstCapture = {
      member: first.member,
      response: first.filings.response!,
    };
    const second = f.model.getSnapshot().rows[1]!;
    f.model.select(f.model.getSnapshot(), second.member);
    expect(f.model.canAdmit(firstCapture)).toBe(false);
    expect(f.selected().filings.response).toBeNull();
    await f.load(1);
    expect(f.read.mock.calls.map(([request]) => request.listingId)).toEqual([
      members[0]!.listingId,
      members[1]!.listingId,
    ]);
    f.model.select(f.model.getSnapshot(), first.member);
    expect(f.selected().filings.response).toBe(firstCapture.response);
    const handoff = f.model.admit(firstCapture)!;
    expect(handoff.selection.listing).toEqual(first.member.listing);
    expect(handoff.seed.response).toEqual(firstCapture.response);
    expect(f.read).toHaveBeenCalledTimes(2);
    f.model.reconcile(draft(), digest, false, true);
    expect(f.model.admit(firstCapture)).toBeNull();
    f.model.reconcile(draft(), digest, true, true);
    expect(f.model.admit(firstCapture)).not.toBeNull();
    expect(f.read).toHaveBeenCalledTimes(2);
  });

  it("preserves packets and exact chosen identities through note edits, reorder and a paused conflict", async () => {
    const f = fixture();
    f.start(0, 1);
    await f.load(0);
    const first = f.selected();
    const reordered = [...members]
      .reverse()
      .map((member) => ({ ...member, note: member.note + " authored edit" }));
    f.model.reconcile(draft(reordered), digest, true, false);
    expect(f.selected()).toBe(first);
    expect(
      f.model.canAdmit({
        member: first.member,
        response: first.filings.response!,
      }),
    ).toBe(true);
    await f.model.load(f.model.getSnapshot());
    expect(f.read).toHaveBeenCalledOnce();
    f.model.reconcile(draft(reordered), digest, true, true);
    expect(f.selected().filings.response).toBe(first.filings.response);
  });

  it.each(["removal", "identity", "catalog"])(
    "clears the visit on %s change and refuses stale actions",
    async (change) => {
      const f = fixture();
      f.start(0, 1);
      await f.load(0);
      const frame = f.model.getSnapshot();
      const capture = {
        member: f.selected().member,
        response: f.selected().filings.response!,
      };
      const next =
        change === "removal"
          ? members.slice(1)
          : members.map((member, index) =>
              index === 0
                ? { ...member, issuerName: "Changed identity" }
                : member,
            );
      f.model.reconcile(
        change === "catalog" ? null : draft(next),
        change === "catalog" ? null : digest,
        true,
        true,
      );
      expect(f.model.getSnapshot().rows).toEqual([]);
      expect(f.model.admit(capture)).toBeNull();
      f.model.select(frame, frame.rows[1]!.member);
      await f.model.load(frame);
      expect(f.read).toHaveBeenCalledOnce();
    },
  );

  it("switching aborts the pending read; a late result cannot populate either company", async () => {
    const f = fixture();
    f.start(0, 1);
    const pending = deferred<ManagedSecFilingsResponseDto>();
    f.read.mockReturnValueOnce(pending.promise);
    const load = f.model.load(f.model.getSnapshot());
    const signal = f.read.mock.calls[0]![1];
    const second = f.model.getSnapshot().rows[1]!;
    f.model.select(f.model.getSnapshot(), second.member);
    expect(signal.aborted).toBe(true);
    pending.resolve(f.wire(0));
    await load;
    expect(
      f.model.getSnapshot().rows.every((row) => row.filings.response === null),
    ).toBe(true);
    expect(f.read).toHaveBeenCalledOnce();
  });

  it.each(["leave", "retire", "remove", "restart"] as const)(
    "does not restore a stale selection after an abort callback triggers %s",
    async (boundary) => {
      const f = fixture();
      f.start(0, 1);
      const pending = deferred<ManagedSecFilingsResponseDto>();
      f.read.mockImplementationOnce((_request, signal) => {
        signal.addEventListener(
          "abort",
          () => {
            if (boundary === "leave" || boundary === "retire")
              f.model[boundary]();
            else if (boundary === "remove")
              f.model.reconcile(draft(members.slice(1)), digest, true, true);
            else if (boundary === "restart") {
              f.model.leave();
              f.model.reconcile(draft(), digest, true, true);
              f.start(0, 1);
            }
          },
          { once: true },
        );
        return pending.promise;
      });
      const load = f.model.load(f.model.getSnapshot());
      const stale = f.model.getSnapshot().rows[1]!.member;
      f.model.select(f.model.getSnapshot(), stale);
      expect(f.model.getSnapshot().selected).not.toBe(stale);
      expect(f.model.getSnapshot().rows).toEqual([]);
      if (boundary === "restart") {
        // Nested commands are refused; a fresh command can start after the switch.
        f.start(0, 1);
        expect(f.model.getSnapshot().rows).toHaveLength(2);
        expect(f.model.getSnapshot().selected).toBe(
          f.model.getSnapshot().rows[0]!.member,
        );
      }
      pending.resolve(f.wire(0));
      await load;
      expect(f.read).toHaveBeenCalledOnce();
    },
  );

  it("Finish fences a nested Start during cancellation", async () => {
    const f = fixture();
    f.start(0, 1);
    const pending = deferred<ManagedSecFilingsResponseDto>();
    f.read.mockImplementationOnce((_request, signal) => {
      signal.addEventListener(
        "abort",
        () => f.model.start(f.model.getSnapshot()),
        { once: true },
      );
      return pending.promise;
    });
    const load = f.model.load(f.model.getSnapshot());
    f.model.finish(f.model.getSnapshot());
    expect(f.model.getSnapshot().rows).toEqual([]);
    expect(f.model.getSnapshot().selected).toBeNull();
    pending.resolve(f.wire(0));
    await load;
    expect(f.model.getSnapshot().rows).toEqual([]);
  });
  it("cannot admit the previous packet from inside a switch's synchronous abort callback", async () => {
    const f = fixture();
    f.start(0, 1);
    await f.load(0);
    const first = f.selected();
    const capture = { member: first.member, response: first.filings.response! };
    const pending = deferred<ManagedSecFilingsResponseDto>();
    let admittedDuringCancel = false;
    f.read.mockImplementationOnce((_request, signal) => {
      signal.addEventListener(
        "abort",
        () => {
          admittedDuringCancel = f.model.admit(capture) !== null;
        },
        { once: true },
      );
      return pending.promise;
    });
    const load = f.model.load(f.model.getSnapshot());
    const second = f.model.getSnapshot().rows[1]!.member;
    f.model.select(f.model.getSnapshot(), second);
    expect(admittedDuringCancel).toBe(false);
    expect(f.model.getSnapshot().selected).toBe(second);
    pending.resolve(f.wire(0));
    await load;
    expect(f.model.getSnapshot().selected).toBe(second);
  });
  it("keeps nested reconciliation inside the outer switch so no previous-company request can start", async () => {
    const f = fixture();
    f.start(0, 1);
    const first = f.model.getSnapshot().selected!;
    const second = f.model.getSnapshot().rows[1]!.member;
    const original = deferred<ManagedSecFilingsResponseDto>();
    const replacement = deferred<ManagedSecFilingsResponseDto>();
    f.read
      .mockImplementationOnce((_request, signal) => {
        signal.addEventListener(
          "abort",
          () => f.model.reconcile(draft(), digest, true, true),
          { once: true },
        );
        return original.promise;
      })
      .mockReturnValueOnce(replacement.promise);
    const pending = f.model.load(f.model.getSnapshot());
    const stop = f.model.subscribe(() => {
      const state = f.model.getSnapshot();
      if (state.selected === first && f.model.canLoad(state))
        void f.model.load(state);
    });
    f.model.select(f.model.getSnapshot(), second);
    stop();
    expect(f.model.getSnapshot().selected).toBe(second);
    expect(f.read).toHaveBeenCalledOnce();
    expect(f.model.getSnapshot().rows[0]!.filings.running).toBe(false);
    original.resolve(f.wire(0));
    replacement.resolve(f.wire(0));
    await pending;
    expect(f.model.getSnapshot().rows[0]!.filings.response).toBeNull();
    expect(f.model.canLoad(f.model.getSnapshot())).toBe(true);
  });
  it("leaving wins over nested reconciliation during its cancellation", async () => {
    const f = fixture();
    f.start(0);
    const pending = deferred<ManagedSecFilingsResponseDto>();
    f.read.mockImplementationOnce((_request, signal) => {
      signal.addEventListener(
        "abort",
        () => f.model.reconcile(draft(), digest, true, true),
        { once: true },
      );
      return pending.promise;
    });
    const load = f.model.load(f.model.getSnapshot());
    f.model.leave();
    expect(f.model.getSnapshot()).toMatchObject({
      active: false,
      canRead: false,
      memberships: [],
      rows: [],
      selected: null,
    });
    pending.resolve(f.wire(0));
    await load;
    expect(f.model.getSnapshot().rows).toEqual([]);
    expect(f.read).toHaveBeenCalledOnce();
  });

  it.each(["finish", "leave", "retire", "suspend"])(
    "%s aborts a read and fences its late completion",
    async (action) => {
      const f = fixture();
      f.start(0);
      const pending = deferred<ManagedSecFilingsResponseDto>();
      f.read.mockReturnValueOnce(pending.promise);
      const frame = f.model.getSnapshot();
      const load = f.model.load(frame);
      const signal = f.read.mock.calls[0]![1];
      if (action === "finish") f.model.finish(f.model.getSnapshot());
      else if (action === "suspend")
        f.model.reconcile(draft(), digest, false, false);
      else f.model[action as "leave" | "retire"]();
      expect(signal.aborted).toBe(true);
      pending.resolve(f.wire(0));
      await load;
      expect(
        f.model
          .getSnapshot()
          .rows.every((row) => row.filings.response === null),
      ).toBe(true);
      await f.model.load(frame);
      expect(f.read).toHaveBeenCalledOnce();
    },
  );

  it("keeps a previous packet with its original clocks after a rejected refresh and selection round trip", async () => {
    const f = fixture();
    f.start(0, 1);
    await f.load(0);
    const first = f.selected();
    f.read.mockRejectedValueOnce(new ManagedSecFilingsError("unavailable"));
    await f.model.load(f.model.getSnapshot());
    expect(f.selected().filings).toMatchObject({
      response: first.filings.response,
      showingPrevious: true,
      error: true,
    });
    f.model.select(
      f.model.getSnapshot(),
      f.model.getSnapshot().rows[1]!.member,
    );
    f.model.select(f.model.getSnapshot(), first.member);
    const handoff = f.model.admit({
      member: first.member,
      response: first.filings.response!,
    })!;
    expect(handoff.seed.showingPrevious).toBe(true);
    expect(handoff.seed.response.completedAt).toBe(
      first.filings.response!.completedAt,
    );
  });

  it("propagates catalog retirement without another read", async () => {
    const f = fixture();
    f.start(0);
    f.read.mockRejectedValueOnce(new ManagedCatalogChangedError());
    await f.model.load(f.model.getSnapshot());
    expect(f.model.getSnapshot().catalogChanged).toBe(true);
    await f.model.load(f.model.getSnapshot());
    expect(f.read).toHaveBeenCalledOnce();
  });
  it("respects a shared SEC deadline across companies without a timer or automatic retry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-12T00:00:00.000Z");
    const f = fixture();
    f.start(0, 1);
    await f.load(0);
    f.access.recordCooldown(
      new ManagedSecCooldownError("2026-10-12T00:02:00.000Z"),
      new AbortController().signal,
    );
    f.model.select(
      f.model.getSnapshot(),
      f.model.getSnapshot().rows[1]!.member,
    );
    await f.model.load(f.model.getSnapshot());
    expect(f.selected().filings.message).toContain("2026-10-12T00:02:00.000Z");
    expect(f.read).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(120_001);
    expect(f.read).toHaveBeenCalledOnce();
  });
});
