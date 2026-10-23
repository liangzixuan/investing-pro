import { afterEach, describe, expect, it, vi } from "vitest";
import type { ManagedApi } from "./managed-api";
import {
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  ManagedCatalogChangedError,
} from "./managed-api";
import { TrialApiError } from "./api";
import { ManagedEodAccess } from "./managed-eod-access";
import {
  ManagedPortfolioCloseReview,
  type PortfolioCloseContext,
} from "./managed-portfolio-close-review";
import { eodResponse, eodSelection } from "./eod-history-fixture";

const listing = eodSelection.listing;
const other = {
  ...listing,
  listingId: "listing-other",
  securityId: "security-other",
  shareClassId: "class-other",
  symbol: "OTHER",
};
function packet(second = false) {
  return { ...eodResponse(), security: second ? other : listing };
}
function setup(
  read = vi.fn<ManagedApi["eodHistory"]>().mockResolvedValue(packet()),
  two = false,
) {
  let active = true;
  const holdings = [listing, ...(two ? [other] : [])].map((identity) => ({
    identity,
    shares: "2",
    totalCostBasisUsd: null,
    confirmedOn: "2026-09-01",
  }));
  const context: PortfolioCloseContext = {
    current: () => active,
    portfolio: {
      schemaVersion: 1,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: eodSelection.catalogSnapshotSha256,
      cashUsd: "10.00",
      holdings,
    },
    ledger: {
      schemaVersion: 3,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: eodSelection.catalogSnapshotSha256,
      basisMethod: "fifo_with_opening_pool",
      identities: holdings.map((h) => h.identity),
      opening: {
        asOfDate: "2026-09-01",
        cashUsd: "10.00",
        holdings: holdings.map((h) => ({
          listingId: h.identity.listingId,
          shares: h.shares,
          confirmedOn: h.confirmedOn,
          totalCostBasisUsd: null,
        })),
      },
      transactions: [],
    },
  };
  const auth = vi.fn(),
    catalog = vi.fn();
  const access = new ManagedEodAccess(read);
  const model = new ManagedPortfolioCloseReview(access, auth, catalog, [
    listing,
    other,
  ]);
  model.enter(context);
  return {
    model,
    read,
    context,
    auth,
    catalog,
    access,
    invalidate: () => {
      active = false;
    },
  };
}
afterEach(() => {
  vi.useRealTimers();
});
describe("Portfolio dated holding close reads", () => {
  it("makes no implicit request, reads sequentially and values only one observed date", async () => {
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockImplementation((request) =>
        Promise.resolve(packet(request.listingId === other.listingId)),
      );
    const f = setup(read, true),
      before = structuredClone(f.context.ledger);
    expect(read).not.toHaveBeenCalled();
    expect(f.model.review()).toBeNull();
    await f.model.load();
    expect(read.mock.calls.map(([r]) => [r.listingId, r.range])).toEqual([
      [listing.listingId, "1m"],
      [other.listingId, "1m"],
    ]);
    expect(f.model.review()).toMatchObject({
      asOfDate: "2026-09-19",
      pricedHoldings: 2,
      holdingsValueUsd: "406.00",
      totalValueUsd: "416.00",
    });
    f.model.selectDate("2026-09-18");
    expect(f.model.review()).toMatchObject({
      holdingsValueUsd: "401.00",
      totalValueUsd: "411.00",
    });
    f.model.selectDate("2026-09-17");
    expect(f.model.getSnapshot().selectedDate).toBe("2026-09-18");
    expect(f.context.ledger).toEqual(before);
  });
  it("does not fall back to another holding's different close date or supply partial totals", async () => {
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockImplementation((request) =>
        Promise.resolve(
          request.listingId === listing.listingId
            ? packet()
            : { ...packet(true), rows: [packet(true).rows[0]!] },
        ),
      );
    const f = setup(read, true);
    await f.model.load();
    expect(f.model.review()).toMatchObject({
      pricedHoldings: 1,
      pricedHoldingsSubtotalUsd: "203.00",
      holdingsValueUsd: null,
      totalValueUsd: null,
    });
    f.model.selectDate("2026-09-18");
    expect(f.model.review()?.holdingsValueUsd).toBe("401.00");
  });
  it("cancels a pending read and refuses its late result without starting the next row", async () => {
    let resolve!: (value: ReturnType<typeof packet>) => void;
    const read = vi.fn<ManagedApi["eodHistory"]>(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const f = setup(read, true),
      loading = f.model.load();
    expect(f.model.getSnapshot().running).toBe(true);
    f.model.cancel();
    resolve(packet());
    await loading;
    expect(read).toHaveBeenCalledTimes(1);
    expect(f.model.review()).toBeNull();
    expect(
      f.model.getSnapshot().rows.every((row) => !row.response && !row.running),
    ).toBe(true);
  });
  it("clears late results after the exact ledger/route/session capability expires", async () => {
    let resolve!: (value: ReturnType<typeof packet>) => void;
    const read = vi.fn<ManagedApi["eodHistory"]>(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const f = setup(read),
      loading = f.model.load();
    f.invalidate();
    resolve(packet());
    await loading;
    expect(f.model.getSnapshot().rows).toEqual([]);
    expect(f.model.review()).toBeNull();
    await f.model.load();
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("retains recoverable old history with unchanged provenance, then clears a hard refusal", async () => {
    const f = setup();
    await f.model.load();
    const prior = f.model.getSnapshot().rows[0]!.response;
    f.read.mockRejectedValueOnce(new ManagedEodHistoryError("unavailable"));
    await f.model.load();
    expect(f.model.getSnapshot().rows[0]).toMatchObject({
      response: prior,
      showingPrevious: true,
    });
    expect(f.model.getSnapshot().rows[0]!.response).toBe(prior);
    f.read.mockRejectedValueOnce(
      new ManagedEodHistoryError("unsupported_listing"),
    );
    await f.model.load();
    expect(f.model.getSnapshot().rows[0]!.response).toBeNull();
    expect(f.model.review()).toBeNull();
  });
  it("shares a real cooldown across surfaces and stops the unrun queue", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-20T00:00:01.000Z"));
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockRejectedValue(
        new ManagedEodCooldownError("2026-09-20T00:01:01.000Z"),
      );
    const f = setup(read, true);
    await f.model.load();
    expect(read).toHaveBeenCalledTimes(1);
    expect(f.access.getNextAllowedAt()).toBe("2026-09-20T00:01:01.000Z");
    await f.model.load();
    expect(read).toHaveBeenCalledTimes(1);
    expect(f.model.getSnapshot().running).toBe(false);
  });
  it.each([
    new TrialApiError("unauthenticated"),
    new ManagedCatalogChangedError(),
  ])("retires private state on auth/catalog refusal", async (error) => {
    const read = vi.fn<ManagedApi["eodHistory"]>().mockRejectedValue(error),
      f = setup(read, true);
    await f.model.load();
    expect(f.model.getSnapshot().rows).toEqual([]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(f.auth.mock.calls.length + f.catalog.mock.calls.length).toBe(1);
  });
  it("validates the complete response identity before admitting a close", async () => {
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockResolvedValue({ ...packet(), security: other });
    const f = setup(read);
    await f.model.load();
    expect(f.model.getSnapshot().rows[0]!.response).toBeNull();
    expect(f.model.review()).toBeNull();
  });
  it("refuses reentrant work when a start notification invalidates its frame", async () => {
    const f = setup();
    f.model.subscribe(() => {
      if (f.model.getSnapshot().running) f.invalidate();
    });
    await f.model.load();
    expect(f.read).not.toHaveBeenCalled();
    expect(f.model.review()).toBeNull();
  });
  it("owns accepted source rows and dates independently of later transport mutation", async () => {
    const source = {
      ...packet(),
      rows: packet().rows.map((row) => ({ ...row })),
    };
    const f = setup(
      vi.fn<ManagedApi["eodHistory"]>().mockResolvedValue(source),
    );
    await f.model.load();
    source.rows[1]!.close = "999";
    source.completedAt = "2026-09-20T00:00:09.000Z";
    expect(f.model.review()?.holdingsValueUsd).toBe("203.00");
    expect(f.model.getSnapshot().rows[0]!.response!.completedAt).toBe(
      "2026-09-20T00:00:01.000Z",
    );
    expect(Object.isFrozen(f.model.getSnapshot().rows[0]!.response!.rows)).toBe(
      true,
    );
  });
  it.each(["not_configured", "source_rate_limited"] as const)(
    "stops the unrun queue on %s",
    async (code) => {
      const f = setup(
        vi
          .fn<ManagedApi["eodHistory"]>()
          .mockRejectedValue(new ManagedEodHistoryError(code)),
        true,
      );
      await f.model.load();
      expect(f.read).toHaveBeenCalledTimes(1);
      expect(f.model.getSnapshot().rows[1]!.message).toBe("Prices not loaded.");
      expect(f.model.getSnapshot().running).toBe(false);
      expect(f.model.getSnapshot().message).toContain("Loading stopped.");
    },
  );
});
