import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedSecFilingsResponseDto,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  ManagedCatalogChangedError,
  ManagedSecCooldownError,
  ManagedSecFilingsError,
  type ManagedApi,
} from "./managed-api";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { ManagedSecAccess } from "./managed-sec-access";
import {
  ManagedWatchlistFilings,
  type ManagedWatchlistFilingsCapture,
} from "./managed-watchlist-filings";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";

const digest = filingsSelection.catalogSnapshotSha256;
const first: WatchlistMembership = {
  ...filingsSelection.listing,
  note: "  Exact unsaved Café 😀  ",
};
const second: WatchlistMembership = {
  ...first,
  listingId: "listing-one",
  securityId: "security-one",
  shareClassId: "class-one",
  shareClassName: "Class C",
  symbol: "ONE",
  note: "Second original note",
};
function draft(
  memberships: WatchlistMembership[] = [first, second],
): MainWatchlistPayload {
  return {
    schemaVersion: 1,
    name: "My Watchlist",
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
  const read = vi.fn<ManagedApi["recentFilings"]>();
  const readError = vi.fn();
  const access = new ManagedSecAccess();
  const model = new ManagedWatchlistFilings(read, readError, access);
  model.reconcile(draft(), digest, true, true);
  const choose = (index: number) => {
    const state = model.getSnapshot();
    const member = state.memberships[index]!;
    model.select(state, member);
    return member;
  };
  return { model, read, readError, access, choose };
}
async function loaded() {
  const f = fixture();
  const member = f.choose(0);
  f.read.mockResolvedValueOnce(filingsResponse());
  await f.model.load(member);
  const response = f.model.getSnapshot().filings.response!;
  const capture: ManagedWatchlistFilingsCapture = { member, response };
  return { ...f, member, response, capture };
}
afterEach(() => vi.useRealTimers());

describe("one selected watchlist filings packet", () => {
  it("starts unloaded and only explicitly reads the selected full identity; same selection is inert", async () => {
    const { model, read, choose } = fixture();
    expect(model.getSnapshot().selected).toBeNull();
    const member = choose(0);
    expect(read).not.toHaveBeenCalled();
    const snapshot = model.getSnapshot();
    model.select(snapshot, member);
    expect(model.getSnapshot()).toBe(snapshot);
    const wire = filingsResponse();
    read.mockResolvedValueOnce(wire);
    await model.load(member);
    expect(read).toHaveBeenCalledOnce();
    expect(read.mock.calls[0]![0]).toEqual({
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: digest,
      listingId: first.listingId,
      symbol: first.symbol,
    });
    expect(model.getSnapshot().filings.response).toEqual(filingsResponse());
    expect(model.getSnapshot().filings.response).not.toBe(wire);
  });
  it("preserves exact truncated and older-history coverage through a handoff", async () => {
    const { model, read, choose } = fixture();
    const member = choose(0);
    const packet = filingsResponse(1000);
    const response = {
      ...packet,
      issuer: { ...packet.issuer, matchingFilings: 1001, truncated: true },
    };
    read.mockResolvedValueOnce(response);
    await model.load(member);
    const checked = model.getSnapshot().filings.response!;
    expect(checked.issuer).toMatchObject({
      matchingFilings: 1001,
      truncated: true,
      olderHistoryAvailable: true,
    });
    const admitted = model.admitFilings({ member, response: checked })!;
    expect(admitted.seed.response).toEqual(response);
    expect(admitted.seed.response.issuer.filings).toHaveLength(1000);
    expect(admitted.seed.response.window).toEqual(packet.window);
    expect(read).toHaveBeenCalledOnce();
  });
  it("keeps only one packet and distinguishes two share classes of the same issuer", async () => {
    const { model, read, choose, capture } = await loaded();
    const next = choose(1);
    expect(next.listing.issuerId).toBe(capture.member.listing.issuerId);
    expect(model.getSnapshot().filings.response).toBeNull();
    expect(model.canAdmitFilings(capture)).toBe(false);
    read.mockResolvedValueOnce(filingsResponse());
    await model.load(next);
    expect(model.getSnapshot().filings).toMatchObject({
      response: null,
      error: true,
    });
    const nextPacket = filingsResponse(1, "available", {
      ...filingsSelection,
      listing: next.listing,
    });
    read.mockResolvedValueOnce(nextPacket);
    await model.load(next);
    expect(model.getSnapshot().filings.response).toEqual(nextPacket);
    choose(0);
    expect(model.getSnapshot().filings.response).toBeNull();
    expect(read).toHaveBeenCalledTimes(3);
  });
  it("preserves selected handle, packet and all draft bytes through note edits, reorder and readonly Save/conflict", async () => {
    const { model, read, member, response, capture } = await loaded();
    const latest = draft([
      second,
      { ...first, note: "Latest exact 😀 prefix  " },
    ]);
    const before = JSON.stringify(latest);
    model.reconcile(latest, digest, true, false);
    expect(model.getSnapshot().selected).toBe(member);
    expect(model.getSnapshot().filings.response).toBe(response);
    expect(model.canAdmitFilings(capture)).toBe(true);
    expect(model.admitFilings(capture)?.seed.response).toEqual(response);
    await model.load(member);
    expect(read).toHaveBeenCalledOnce();
    model.reconcile(latest, digest, true, true);
    const snapshot = model.getSnapshot();
    model.reconcile(latest, digest, true, true);
    expect(model.getSnapshot()).toBe(snapshot);
    expect(JSON.stringify(latest)).toBe(before);
  });
  it("suspends across company/Back without a read and clears on real departure", async () => {
    const { model, read, member, response, capture } = await loaded();
    model.reconcile(draft(), digest, false, false);
    expect(model.getSnapshot()).toMatchObject({
      active: false,
      selected: member,
    });
    expect(model.getSnapshot().filings.response).toBe(response);
    expect(model.canAdmitFilings(capture)).toBe(false);
    model.reconcile(draft(), digest, true, true);
    expect(model.canAdmitFilings(capture)).toBe(true);
    model.leave();
    expect(model.getSnapshot()).toMatchObject({
      active: false,
      selected: null,
      memberships: [],
      filings: { selection: null, response: null },
    });
    model.reconcile(draft(), digest, true, true);
    expect(model.getSnapshot().selected).toBeNull();
    expect(model.getSnapshot().memberships[0]).not.toBe(member);
    expect(model.canAdmitFilings(capture)).toBe(false);
    expect(read).toHaveBeenCalledOnce();
  });
  it.each(["remove", "replace", "catalog", "missing-draft"] as const)(
    "invalidates selected ownership on %s without touching the supplied draft",
    async (change) => {
      const { model, capture, member } = await loaded();
      const catalog =
        change === "catalog" ? (`sha256:${"b".repeat(64)}` as const) : digest;
      const next =
        change === "remove"
          ? draft([second])
          : change === "replace"
            ? draft([{ ...first, shareClassName: "Changed class" }, second])
            : change === "missing-draft"
              ? null
              : {
                  ...draft(),
                  snapshotSha256: catalog,
                };
      const raw = JSON.stringify(next);
      model.reconcile(next, catalog, true, true);
      expect(model.getSnapshot().selected).toBeNull();
      expect(model.getSnapshot().filings.response).toBeNull();
      expect(model.canAdmitFilings(capture)).toBe(false);
      model.reconcile(draft(), digest, true, true);
      expect(model.getSnapshot().memberships[0]).not.toBe(member);
      expect(JSON.stringify(next)).toBe(raw);
    },
  );
  it("rejects old rendered selection, forged handles and borrowed response objects", async () => {
    const { model, capture, choose, read } = await loaded();
    const old = model.getSnapshot();
    const next = choose(1);
    model.select(old, capture.member);
    expect(model.getSnapshot().selected).toBe(next);
    model.select(model.getSnapshot(), { ...next });
    expect(model.getSnapshot().selected).toBe(next);
    expect(model.admitFilings(capture)).toBeNull();
    choose(0);
    const member = model.getSnapshot().selected!;
    read.mockResolvedValueOnce(filingsResponse());
    await model.load(member);
    const response = model.getSnapshot().filings.response!;
    expect(model.canAdmitFilings({ member: { ...member }, response })).toBe(
      false,
    );
    expect(model.canAdmitFilings({ member, response: { ...response } })).toBe(
      false,
    );
  });
  it("requires Cancel before viewing a retained packet, fences late auth and preserves the original qualification", async () => {
    const { model, read, readError, member, response, capture } =
      await loaded();
    const held = deferred<ManagedSecFilingsResponseDto>();
    read.mockReturnValueOnce(held.promise);
    const pending = model.load(member);
    const cancel = model.getSnapshot().pending!.cancel;
    await model.load(member);
    expect(model.canAdmitFilings(capture)).toBe(false);
    expect(model.admitFilings(capture)).toBeNull();
    expect(read.mock.calls[1]![1].aborted).toBe(false);
    cancel();
    expect(read.mock.calls[1]![1].aborted).toBe(true);
    const handoff = model.admitFilings(capture)!;
    expect(handoff.seed).toEqual({ response, showingPrevious: true });
    expect(handoff.seed.response).not.toBe(response);
    held.reject(new TrialApiError("unauthenticated"));
    await pending;
    expect(readError).not.toHaveBeenCalled();
    expect(model.getSnapshot().filings.response).toBe(response);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("a stale Cancel callback cannot cancel a newer read", async () => {
    const { model, read, member } = await loaded();
    const firstRead = deferred<ManagedSecFilingsResponseDto>();
    const secondRead = deferred<ManagedSecFilingsResponseDto>();
    read
      .mockReturnValueOnce(firstRead.promise)
      .mockReturnValueOnce(secondRead.promise);
    const firstPending = model.load(member);
    const cancel = model.getSnapshot().pending!.cancel;
    cancel();
    const secondPending = model.load(member);
    cancel();
    expect(read.mock.calls[2]![1].aborted).toBe(false);
    firstRead.resolve(filingsResponse(0));
    secondRead.resolve(filingsResponse(1));
    await Promise.all([firstPending, secondPending]);
    expect(model.getSnapshot().filings.response?.issuer.filings).toHaveLength(
      1,
    );
  });
  it.each([
    "available",
    "not_covered",
    "invalid_response",
    "rate_limited",
    "upstream_unavailable",
  ] as const)(
    "uses existing source %s replacement/retention semantics",
    async (status) => {
      const { model, read, member, response } = await loaded();
      const checked = filingsResponse(0, status);
      read.mockResolvedValueOnce(checked);
      await model.load(member);
      const previous =
        status === "rate_limited" || status === "upstream_unavailable";
      expect(model.getSnapshot().filings.response).toEqual(
        previous ? response : checked,
      );
      expect(model.getSnapshot().filings.showingPrevious).toBe(previous);
      expect(model.getSnapshot().filings.lastCheck).toEqual(checked);
    },
  );
  it("retains transient failure but clears malformed replacement and catalog-refused selection cannot load", async () => {
    const { model, read, member, response } = await loaded();
    read.mockRejectedValueOnce(new ManagedSecFilingsError("unavailable"));
    await model.load(member);
    expect(model.getSnapshot().filings.response).toBe(response);
    read.mockResolvedValueOnce({ ...filingsResponse(), completedAt: "bad" });
    await model.load(member);
    expect(model.getSnapshot().filings.response).toBeNull();
    read.mockRejectedValueOnce(new ManagedCatalogChangedError());
    await model.load(member);
    const state = model.getSnapshot();
    model.select(state, state.memberships[1]!);
    await model.load(member);
    expect(model.getSnapshot().selected).toBe(member);
    expect(model.getSnapshot().catalogChanged).toBe(true);
    expect(read).toHaveBeenCalledTimes(4);
  });
  it("respects the shared checked SEC deadline without inventing reads or a new budget", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-12T00:00:00.000Z");
    const { model, read, access, member, capture } = await loaded();
    access.recordCooldown(
      new ManagedSecCooldownError("2026-10-12T00:02:00.000Z"),
      new AbortController().signal,
    );
    await model.load(member);
    expect(read).toHaveBeenCalledOnce();
    expect(model.getSnapshot().filings.message).toContain(
      "2026-10-12T00:02:00.000Z",
    );
    expect(model.canAdmitFilings(capture)).toBe(true);
  });
  it("opens an independently decoded company copy and leaves the selected packet unchanged after company Refresh", async () => {
    const { model, member, response, capture, read } = await loaded();
    const companyRead = vi.fn<ManagedApi["recentFilings"]>();
    const company = new ManagedCompanyFilings(companyRead, vi.fn());
    const handoff = model.admitFilings(capture)!;
    expect(handoff.selection).toEqual({
      listing: member.listing,
      catalogSnapshotSha256: digest,
      cik: null,
      origin: "watchlist",
    });
    company.open(handoff.selection, handoff.seed);
    expect(companyRead).not.toHaveBeenCalled();
    expect(company.getSnapshot().response).toEqual(response);
    expect(company.getSnapshot().response).not.toBe(response);
    expect(company.getSnapshot().response).not.toBe(handoff.seed.response);
    companyRead.mockResolvedValueOnce(filingsResponse(0));
    await company.load();
    expect(company.getSnapshot().response?.issuer.filings).toEqual([]);
    expect(model.getSnapshot().filings.response).toBe(response);
    expect(read).toHaveBeenCalledOnce();
  });
  it("withdraws a pending source request when a running publication removes the member", async () => {
    const { model, read, choose } = fixture();
    const member = choose(0);
    model.subscribe(() => {
      if (model.getSnapshot().filings.running)
        model.reconcile(draft([second]), digest, true, true);
    });
    await model.load(member);
    expect(read).not.toHaveBeenCalled();
    expect(model.getSnapshot().selected).toBeNull();
    expect(model.getSnapshot().pending).toBeNull();
  });
  it("keeps the newer selection when cancelling the old read synchronously publishes another selection", async () => {
    const { model, read, choose } = fixture();
    const member = choose(0);
    const held = deferred<ManagedSecFilingsResponseDto>();
    read.mockImplementationOnce((_request, signal) => {
      signal.addEventListener("abort", () => choose(1), { once: true });
      return held.promise;
    });
    const pending = model.load(member);
    model.cancel();
    held.resolve(filingsResponse());
    await pending;
    expect(model.getSnapshot().selected?.listing.listingId).toBe(
      second.listingId,
    );
    expect(model.getSnapshot().filings.selection?.listing.listingId).toBe(
      second.listingId,
    );
    expect(model.getSnapshot().filings.response).toBeNull();
  });
  it.each(["leave", "retire", "inactive", "readonly"] as const)(
    "cancels pending work on %s and fences its late completion",
    async (action) => {
      const { model, read, member, response } = await loaded();
      const held = deferred<ManagedSecFilingsResponseDto>();
      read.mockReturnValueOnce(held.promise);
      const pending = model.load(member);
      if (action === "inactive" || action === "readonly")
        model.reconcile(draft(), digest, action !== "inactive", false);
      else model[action]();
      expect(read.mock.calls[1]![1].aborted).toBe(true);
      held.resolve(filingsResponse(0));
      await pending;
      expect(model.getSnapshot().filings.response).toBe(
        action === "inactive" || action === "readonly" ? response : null,
      );
      if (action === "retire") {
        model.reconcile(draft(), digest, true, true);
        expect(model.getSnapshot().memberships).toEqual([]);
      }
    },
  );
  it("retires on a current auth failure and refuses any later reopening", async () => {
    const { model, read, readError, member } = await loaded();
    read.mockRejectedValueOnce(new TrialApiError("access_denied"));
    await model.load(member);
    expect(readError).toHaveBeenCalledOnce();
    expect(model.getSnapshot()).toMatchObject({
      active: false,
      selected: null,
      memberships: [],
      filings: { selection: null, response: null },
    });
    model.reconcile(draft(), digest, true, true);
    await model.load(member);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
