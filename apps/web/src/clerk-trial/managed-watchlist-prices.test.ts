import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseManagedEodHistoryResponse,
  type MainWatchlistPayload,
  type ManagedEodIdentity,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";
import { ManagedEodAccess } from "./managed-eod-access";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedWatchlistPrices } from "./managed-watchlist-prices";
import { MANAGED_PRICE_COVERAGE } from "./managed-price-coverage";
import { eodRequest, eodResponse, eodSelection } from "./eod-history-fixture";

const digest = eodSelection.catalogSnapshotSha256;
const second: ManagedEodIdentity = {
  ...eodSelection.listing,
  listingId: "listing-second",
  securityId: "security-second",
  shareClassId: "class-second",
  symbol: "SECOND",
};
const member = (listing = eodSelection.listing): WatchlistMembership => ({
  ...listing,
  note: "Original unsaved note",
});
function draft(
  memberships: readonly WatchlistMembership[] = [member()],
): MainWatchlistPayload {
  return {
    name: "My Watchlist",
    schemaVersion: 1,
    snapshotSha256: digest,
    memberships,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const read = vi.fn<ManagedApi["eodHistory"]>();
  const readError = vi.fn();
  const access = new ManagedEodAccess(read);
  const model = new ManagedWatchlistPrices(read, readError, access, [
    eodSelection.listing,
    second,
  ]);
  model.enter(draft([member(), member(second)]), digest, true);
  return { read, readError, access, model };
}
function responseFor(listing: ManagedEodIdentity) {
  const response = parseManagedEodHistoryResponse(
    { ...eodResponse(), security: listing },
    { ...eodRequest(), listingId: listing.listingId },
  );
  if (!response) throw new Error("Invalid invented response");
  return response;
}
afterEach(() => vi.useRealTimers());

describe("watchlist price row admission and reconciliation", () => {
  it("defaults to the exact production coverage and makes no reads on entry", () => {
    const read = vi.fn<ManagedApi["eodHistory"]>();
    const model = new ManagedWatchlistPrices(
      read,
      vi.fn(),
      new ManagedEodAccess(read),
    );
    const payload = draft([member(), ...MANAGED_PRICE_COVERAGE.map(member)]);
    model.enter(payload, digest, true);
    expect(model.getSnapshot().rows.map((row) => row.listing)).toEqual(
      MANAGED_PRICE_COVERAGE,
    );
    expect(read).not.toHaveBeenCalled();
    expect(payload.memberships[0]!.note).toBe("Original unsaved note");
  });

  it.each(Object.keys(eodSelection.listing) as (keyof ManagedEodIdentity)[])(
    "refuses a changed %s, including same-symbol identities",
    async (field) => {
      const { model, read } = fixture();
      const original = model.getSnapshot().rows[0]!.handle;
      model.reconcile(draft([{ ...member(), [field]: "other" }]), digest, true);
      expect(model.getSnapshot().rows).toEqual([]);
      await model.load(original);
      expect(model.seed(original)).toBeNull();
      expect(read).not.toHaveBeenCalled();
    },
  );

  it("captures coverage and remains bounded even with repeated draft identities", () => {
    const declared = { ...eodSelection.listing };
    const coverage = [declared];
    const read = vi.fn<ManagedApi["eodHistory"]>();
    const model = new ManagedWatchlistPrices(
      read,
      vi.fn(),
      new ManagedEodAccess(read),
      coverage,
    );
    declared.shareClassId = "changed";
    coverage.push(second);
    model.enter(draft([member(), member(), member(second)]), digest, true);
    expect(model.getSnapshot().rows).toHaveLength(1);
    expect(model.getSnapshot().rows[0]!.listing).toEqual(eodSelection.listing);
    expect(Object.isFrozen(model.getSnapshot().rows[0]!.listing)).toBe(true);
    expect(read).not.toHaveBeenCalled();
  });

  it("retains rows through note/reorder/save copies and gates flag-only recovery changes", async () => {
    const { model, read } = fixture();
    const first = model.getSnapshot().rows[0]!;
    read.mockResolvedValueOnce(eodResponse());
    await model.load(first.handle);
    const loaded = model.getSnapshot().rows[0]!;
    const copy = draft([
      member(second),
      { ...member(), note: "  Dirty note unchanged  " },
    ]);
    model.reconcile(copy, digest, false);
    expect(model.getSnapshot().rows[1]).toBe(loaded);
    expect(model.getSnapshot().canRead).toBe(false);
    await model.load(first.handle);
    expect(read).toHaveBeenCalledOnce();
    model.reconcile(copy, digest, true);
    expect(model.getSnapshot().rows[1]).toBe(loaded);
    expect(model.getSnapshot().canRead).toBe(true);
    expect(copy.memberships[1]!.note).toBe("  Dirty note unchanged  ");
  });

  it("publishes no repeated notification for equivalent sync, enter or leave, even reentrantly", () => {
    const { model } = fixture();
    const payload = draft([member(), member(second)]);
    const listener = vi.fn(() =>
      model.reconcile(payload, digest, model.getSnapshot().canRead),
    );
    model.subscribe(listener);
    const previous = model.getSnapshot();
    model.enter(payload, digest, true);
    model.reconcile(structuredClone(payload), digest, true);
    expect(model.getSnapshot()).toBe(previous);
    expect(listener).not.toHaveBeenCalled();
    model.reconcile(payload, digest, false);
    expect(listener).toHaveBeenCalledOnce();
    model.leave();
    const empty = model.getSnapshot();
    expect(listener).toHaveBeenCalledTimes(2);
    model.leave();
    expect(model.getSnapshot()).toBe(empty);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it.each([null, `sha256:${"b".repeat(64)}`] as const)(
    "discards all work for a missing/mismatched catalog %s",
    async (catalog) => {
      const { model, read } = fixture();
      const handle = model.getSnapshot().rows[0]!.handle;
      const held = deferred<ReturnType<typeof eodResponse>>();
      read.mockReturnValueOnce(held.promise);
      const pending = model.load(handle);
      model.reconcile(draft(), catalog, true);
      expect(read.mock.calls[0]![1].aborted).toBe(true);
      expect(model.getSnapshot()).toMatchObject({
        rows: [],
        pending: null,
        canRead: false,
      });
      held.resolve(eodResponse());
      await pending;
      await model.load(handle);
      expect(read).toHaveBeenCalledOnce();
    },
  );
});

describe("watchlist price operations and lifetime", () => {
  it("loads one captured row at a time and keeps pending identity across reorder", async () => {
    const { model, read } = fixture();
    const [first, other] = model.getSnapshot().rows;
    const held = deferred<ReturnType<typeof eodResponse>>();
    read.mockReturnValueOnce(held.promise);
    const promise = model.load(first!.handle);
    const pending = model.getSnapshot().pending;
    expect(pending?.listing).toEqual(eodSelection.listing);
    model.reconcile(draft([member(second), member()]), digest, true);
    await model.load(other!.handle);
    expect(model.getSnapshot().pending).toBe(pending);
    expect(read).toHaveBeenCalledExactlyOnceWith(
      eodRequest(),
      expect.any(AbortSignal),
    );
    held.resolve(eodResponse());
    await promise;
    expect(model.getSnapshot().rows[1]!.history).toMatchObject({
      response: eodResponse(),
      responseOrigin: "watchlist",
      running: false,
    });
    expect(model.getSnapshot().pending).toBeNull();
  });

  it("does not discard an admitted read when Save/recovery temporarily blocks new reads", async () => {
    const { model, read } = fixture();
    const handle = model.getSnapshot().rows[0]!.handle;
    const held = deferred<ReturnType<typeof eodResponse>>();
    read.mockReturnValueOnce(held.promise);
    const pending = model.load(handle);
    model.reconcile(draft([member()]), digest, false);
    expect(read.mock.calls[0]![1].aborted).toBe(false);
    held.resolve(eodResponse());
    await pending;
    expect(model.getSnapshot().rows[0]!.history.response).toEqual(
      eodResponse(),
    );
    expect(model.getSnapshot().canRead).toBe(false);
    await model.load(handle);
    expect(read).toHaveBeenCalledOnce();
  });

  it.each(["success", "authentication", "cooldown"])(
    "fences removed/re-added row's late %s and its old Load/Cancel handles",
    async (settlement) => {
      const { model, read, readError, access } = fixture();
      const handle = model.getSnapshot().rows[0]!.handle;
      const old = deferred<ReturnType<typeof eodResponse>>();
      const next = deferred<ReturnType<typeof eodResponse>>();
      read.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
      const first = model.load(handle);
      const oldCancel = model.getSnapshot().pending!.cancel;
      model.reconcile(draft([]), digest, true);
      model.reconcile(draft(), digest, true);
      const nextHandle = model.getSnapshot().rows[0]!.handle;
      expect(nextHandle).not.toBe(handle);
      await model.load(handle);
      const secondRequest = model.load(nextHandle);
      oldCancel();
      expect(read.mock.calls[0]![1].aborted).toBe(true);
      expect(read.mock.calls[1]![1].aborted).toBe(false);
      const current = model.getSnapshot();
      if (settlement === "success") old.resolve(eodResponse());
      else if (settlement === "authentication")
        old.reject(new TrialApiError("unauthenticated"));
      else old.reject(new ManagedEodCooldownError("2099-10-12T00:00:00.000Z"));
      await first;
      expect(model.getSnapshot()).toBe(current);
      expect(access.getNextAllowedAt()).toBeNull();
      expect(readError).not.toHaveBeenCalled();
      next.resolve(eodResponse());
      await secondRequest;
      expect(read).toHaveBeenCalledTimes(2);
    },
  );

  it("fences an old Cancel against a later operation in the same row", async () => {
    const { model, read } = fixture();
    const handle = model.getSnapshot().rows[0]!.handle;
    const first = deferred<ReturnType<typeof eodResponse>>();
    const next = deferred<ReturnType<typeof eodResponse>>();
    read.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    const old = model.load(handle);
    const oldCancel = model.getSnapshot().pending!.cancel;
    oldCancel();
    const current = model.load(handle);
    oldCancel();
    first.resolve(eodResponse());
    await old;
    expect(read.mock.calls[1]![1].aborted).toBe(false);
    expect(model.getSnapshot().pending).not.toBeNull();
    next.resolve(eodResponse());
    await current;
  });

  it.each(["leave", "retire"] as const)(
    "discards all rows and fences pending completion on %s",
    async (method) => {
      const { model, read, readError } = fixture();
      const handle = model.getSnapshot().rows[0]!.handle;
      const held = deferred<ReturnType<typeof eodResponse>>();
      read.mockReturnValueOnce(held.promise);
      const pending = model.load(handle);
      model[method]();
      const empty = model.getSnapshot();
      expect(read.mock.calls[0]![1].aborted).toBe(true);
      held.reject(new TrialApiError("unauthenticated"));
      await pending;
      expect(model.getSnapshot()).toBe(empty);
      expect(empty).toMatchObject({
        active: false,
        rows: [],
        pending: null,
        canRead: false,
      });
      expect(readError).not.toHaveBeenCalled();
      model.enter(draft(), digest, true);
      await model.load(handle);
      expect(read).toHaveBeenCalledOnce();
      expect(model.getSnapshot().rows).toHaveLength(
        method === "retire" ? 0 : 1,
      );
    },
  );

  it("publishes catalogChanged for any row and permits synchronous workspace invalidation", async () => {
    const { model, read } = fixture();
    const handle = model.getSnapshot().rows[1]!.handle;
    const changed = vi.fn();
    model.subscribe(() => {
      if (model.getSnapshot().catalogChanged) {
        changed();
        model.leave();
      }
    });
    read.mockRejectedValueOnce(new ManagedCatalogChangedError());
    await model.load(handle);
    expect(changed).toHaveBeenCalledOnce();
    expect(model.getSnapshot()).toMatchObject({
      active: false,
      rows: [],
      pending: null,
    });
    await model.load(handle);
    expect(read).toHaveBeenCalledOnce();
  });

  it("retires the whole owner before reporting an authentication failure", async () => {
    const { model, read, readError } = fixture();
    const handle = model.getSnapshot().rows[0]!.handle;
    const error = new TrialApiError("access_denied");
    readError.mockImplementation(() =>
      expect(model.getSnapshot().rows).toEqual([]),
    );
    read.mockRejectedValueOnce(error);
    await model.load(handle);
    expect(readError).toHaveBeenCalledExactlyOnceWith(error);
    model.enter(draft(), digest, true);
    expect(model.getSnapshot().active).toBe(false);
  });
});

describe("watchlist source handoff and shared access", () => {
  it("copies a retained seed after Cancel, without cancelling another row or changing either source", async () => {
    const { model, read, access } = fixture();
    const [first, other] = model.getSnapshot().rows;
    const held = deferred<ReturnType<typeof eodResponse>>();
    const another = deferred<ReturnType<typeof eodResponse>>();
    read
      .mockResolvedValueOnce(eodResponse())
      .mockReturnValueOnce(held.promise)
      .mockReturnValueOnce(another.promise);
    await model.load(first!.handle);
    const refresh = model.load(first!.handle);
    expect(model.seed(first!.handle)).toBeNull();
    model.cancel();
    const otherPending = model.load(other!.handle);
    const seed = model.seed(first!.handle)!;
    const original = model.getSnapshot().rows[0]!.history.response;
    expect(seed).toEqual({ response: eodResponse(), showingPrevious: true });
    expect(seed.response).not.toBe(original);
    expect(Object.isFrozen(seed)).toBe(true);
    expect(Object.isFrozen(seed.response.rows[0])).toBe(true);
    expect(read.mock.calls[2]![1].aborted).toBe(false);
    const company = new ManagedEodHistory(read, vi.fn(), access, [
      eodSelection.listing,
    ]);
    company.open({ ...eodSelection, origin: "watchlist" }, seed);
    expect(company.getSnapshot().responseOrigin).toBe("watchlist");
    expect(read).toHaveBeenCalledTimes(3);
    held.resolve(eodResponse());
    another.resolve(responseFor(second));
    await Promise.all([refresh, otherPending]);
    const companyResponse = {
      ...eodResponse(),
      rows: [{ date: "2026-09-19", close: "111.5" }],
    };
    read.mockResolvedValueOnce(companyResponse);
    await company.load();
    expect(company.getSnapshot()).toMatchObject({
      response: companyResponse,
      responseOrigin: "company",
      selection: { origin: "watchlist" },
    });
    company.close();
    expect(model.getSnapshot().rows[0]!.history.response).toBe(original);
    expect(model.getSnapshot().rows[0]!.history.showingPrevious).toBe(true);
  });

  it("retains row values and watchlist provenance on a supported transient failure", async () => {
    const { model, read } = fixture();
    const handle = model.getSnapshot().rows[0]!.handle;
    read
      .mockResolvedValueOnce(eodResponse())
      .mockRejectedValueOnce(new ManagedEodHistoryError("request_timeout"));
    await model.load(handle);
    const previous = model.getSnapshot().rows[0]!.history.response;
    await model.load(handle);
    expect(model.getSnapshot().rows[0]!.history).toMatchObject({
      responseOrigin: "watchlist",
      showingPrevious: true,
      error: true,
    });
    expect(model.getSnapshot().rows[0]!.history.response).toBe(previous);
  });

  it("shares a checked cooldown with company/direct board access after row clearing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T00:00:00.000Z"));
    const { model, read, access } = fixture();
    const nextAllowedAt = "2026-10-12T00:01:00.000Z";
    read.mockRejectedValueOnce(new ManagedEodCooldownError(nextAllowedAt));
    await model.load(model.getSnapshot().rows[0]!.handle);
    model.leave();
    model.enter(draft(), digest, true);
    await model.load(model.getSnapshot().rows[0]!.handle);
    expect(model.getSnapshot().rows[0]!.history.message).toContain(
      nextAllowedAt,
    );
    const company = new ManagedEodHistory(read, vi.fn(), access, [
      eodSelection.listing,
    ]);
    company.open(eodSelection);
    await company.load();
    await expect(
      access.request(eodSelection, "1m", new AbortController().signal),
    ).rejects.toMatchObject({ nextAllowedAt });
    expect(read).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    read.mockResolvedValueOnce(eodResponse());
    await model.load(model.getSnapshot().rows[0]!.handle);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
