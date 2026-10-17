import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MainWatchlistPayload,
  ManagedEodIdentity,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";
import { TrialApiError } from "./api";
import {
  ManagedAnnualReportError,
  ManagedCatalogChangedError,
  ManagedSecCooldownError,
  type ManagedApi,
} from "./managed-api";
import { eodSelection } from "./eod-history-fixture";
import { ManagedSecAccess } from "./managed-sec-access";
import { ManagedAnnualReport } from "./managed-annual-report";
import {
  ManagedWatchlistAnnualComparison,
  type ManagedWatchlistAnnualComparisonSide,
  type ManagedAnnualComparisonReportCapture,
} from "./managed-watchlist-annual-comparison";

const digest = eodSelection.catalogSnapshotSha256;
const first = eodSelection.listing;
const second: ManagedEodIdentity = {
  ...first,
  listingId: "listing-one",
  securityId: "security-one",
  securityName: "One Class A",
  shareClassId: "class-one",
  issuerId: "issuer-one",
  issuerName: "One Company",
  symbol: "ONE",
};
const sameIssuer: ManagedEodIdentity = {
  ...first,
  listingId: "listing-other-class",
  securityId: "security-other-class",
  shareClassId: "class-other",
  shareClassName: "Class C",
  symbol: "ZEROC",
};
const member = (listing = first): WatchlistMembership => ({
  ...listing,
  note: "  Exact unsaved Café 😀  ",
});

async function loadedHandoff() {
  const f = fixture();
  const left = f.choose("left", 0)!;
  const response = await responseFor();
  f.read.mockResolvedValueOnce(response);
  await f.model.load("left", left);
  const capture: ManagedAnnualComparisonReportCapture = {
    side: "left",
    member: left,
    response,
  };
  return { ...f, left, response, capture };
}

describe("Annual comparison report handoff", () => {
  it("copies the full identity and settled qualification while notes/order/save state change", async () => {
    const { model, read, capture } = await loadedHandoff();
    const before = model.getSnapshot().left;
    model.reconcile(
      draft([member(second), { ...member(), note: "Latest unsaved note 😀" }]),
      digest,
      true,
      false,
    );
    expect(model.canAdmitReport(capture)).toBe(true);
    const handoff = model.admitReport(capture)!;
    expect(handoff.selection).toEqual({
      listing: first,
      catalogSnapshotSha256: digest,
      origin: "watchlist",
      cik: null,
    });
    expect(handoff.selection.listing).not.toBe(capture.member.listing);
    expect(Object.isFrozen(handoff.selection.listing)).toBe(true);
    expect(Object.isFrozen(handoff.seed)).toBe(true);
    expect(handoff.seed.response).toBe(capture.response);
    expect(handoff.seed.showingPrevious).toBe(false);
    expect(model.getSnapshot().left).toBe(before);
    expect(read).toHaveBeenCalledOnce();
  });
  it("rejects forged member objects, reused handles and cloned responses", async () => {
    const { model, capture } = await loadedHandoff();
    for (const stale of [
      { ...capture, member: { ...capture.member } },
      {
        ...capture,
        member: {
          ...capture.member,
          listing: { ...capture.member.listing, shareClassName: "Class C" },
        },
      },
      { ...capture, response: structuredClone(capture.response) },
      { ...capture, side: "right" as const },
    ]) {
      expect(model.canAdmitReport(stale)).toBe(false);
      expect(model.admitReport(stale)).toBeNull();
    }
  });
  it("refuses old exact-value response captures after a successful replacement", async () => {
    const { model, read, left, capture } = await loadedHandoff();
    const replacement = await responseFor();
    expect(replacement).toEqual(capture.response);
    read.mockResolvedValueOnce(replacement);
    await model.load("left", left);
    expect(model.admitReport(capture)).toBeNull();
    expect(
      model.admitReport({ ...capture, response: replacement })?.seed.response,
    ).toBe(replacement);
  });
  it.each(Object.keys(first) as (keyof ManagedEodIdentity)[])(
    "refuses a captured report after full-identity field %s changes",
    async (key) => {
      const { model, capture } = await loadedHandoff();
      model.reconcile(
        draft([{ ...member(), [key]: "changed" }, member(second)]),
        digest,
        true,
        true,
      );
      expect(model.admitReport(capture)).toBeNull();
    },
  );
  it.each(["clear", "readd", "catalog", "hidden", "retire"] as const)(
    "refuses the original capture after %s",
    async (cause) => {
      const { model, choose, capture } = await loadedHandoff();
      if (cause === "clear") choose("left", null);
      if (cause === "readd") {
        model.reconcile(draft([]), digest, true, true);
        model.reconcile(draft(), digest, true, true);
        choose("left", 0);
      }
      if (cause === "catalog")
        model.reconcile(draft(), `sha256:${"b".repeat(64)}`, true, true);
      if (cause === "hidden") model.reconcile(draft(), digest, false, false);
      if (cause === "retire") model.retire();
      expect(model.admitReport(capture)).toBeNull();
    },
  );
  it("refuses a stale action without cancelling the current pending operation", async () => {
    const { model, read, left, capture } = await loadedHandoff();
    const pending = deferred<Awaited<ReturnType<typeof responseFor>>>();
    read.mockReturnValueOnce(pending.promise);
    const loading = model.load("left", left);
    const operation = model.getSnapshot().pending;
    expect(model.admitReport({ ...capture, member: { ...left } })).toBeNull();
    expect(model.getSnapshot().pending).toBe(operation);
    expect(read.mock.calls[1]![1].aborted).toBe(false);
    pending.resolve(await responseFor());
    await loading;
  });
  it.each(["left", "right"] as const)(
    "cancels pending %s work before capturing the current retained flag",
    async (side) => {
      const { model, read, left, choose, capture } = await loadedHandoff();
      const target = side === "left" ? left : choose("right", 1)!;
      const pending = deferred<Awaited<ReturnType<typeof responseFor>>>();
      read.mockReturnValueOnce(pending.promise);
      const loading = model.load(side, target);
      const handoff = model.admitReport(capture)!;
      expect(handoff.seed.response).toBe(capture.response);
      expect(handoff.seed.showingPrevious).toBe(side === "left");
      expect(model.getSnapshot().pending).toBeNull();
      expect(read.mock.calls[1]![1].aborted).toBe(true);
      pending.resolve(await responseFor(side === "left" ? first : second));
      await loading;
      expect(model.getSnapshot().left.report.response).toBe(capture.response);
      expect(read).toHaveBeenCalledTimes(2);
    },
  );
  it("rechecks membership after cancellation notifies subscribers", async () => {
    const { model, read, left, capture } = await loadedHandoff();
    const pending = deferred<Awaited<ReturnType<typeof responseFor>>>();
    read.mockReturnValueOnce(pending.promise);
    const loading = model.load("left", left);
    const unsubscribe = model.subscribe(() => {
      if (!model.getSnapshot().pending) {
        unsubscribe();
        model.reconcile(draft([]), digest, true, true);
      }
    });
    expect(model.admitReport(capture)).toBeNull();
    pending.resolve(await responseFor());
    await loading;
    expect(model.getSnapshot().left.selected).toBeNull();
  });
  it("keeps company Refresh and cancellation independent of the original pair", async () => {
    const { model, read, capture } = await loadedHandoff();
    const handoff = model.admitReport(capture)!;
    const companyRead = vi.fn<ManagedApi["annualReport"]>();
    const company = new ManagedAnnualReport(companyRead, vi.fn());
    company.open(handoff.selection, handoff.seed);
    model.reconcile(draft(), digest, false, false);
    await vi.waitFor(() =>
      expect(company.getSnapshot().checkingSeed).toBe(false),
    );
    expect(company.getSnapshot().response).toEqual(capture.response);
    const fresh = await annualComparisonResponse("left", {
      mode: "exact-decimal",
    });
    companyRead.mockResolvedValueOnce(fresh);
    await company.load();
    expect(company.getSnapshot().response).toBe(fresh);
    company.close();
    model.reconcile(draft(), digest, true, true);
    expect(model.getSnapshot().left.report.response).toBe(capture.response);
    expect(model.getSnapshot().left.selected).toBe(capture.member);
    expect(read).toHaveBeenCalledOnce();
    expect(companyRead).toHaveBeenCalledOnce();
  });
  it("does not hand off or cancel a newer operation started by a cancellation subscriber", async () => {
    const { model, read, left, capture } = await loadedHandoff();
    const previous = deferred<Awaited<ReturnType<typeof responseFor>>>();
    const next = deferred<Awaited<ReturnType<typeof responseFor>>>();
    read
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(next.promise);
    const firstLoading = model.load("left", left);
    let nextLoading: Promise<void> | undefined;
    const unsubscribe = model.subscribe(() => {
      if (!model.getSnapshot().pending) {
        unsubscribe();
        nextLoading = model.load("left", left);
      }
    });
    expect(model.canAdmitReport(capture)).toBe(true);
    expect(read.mock.calls[1]![1].aborted).toBe(false);
    expect(model.admitReport(capture)).toBeNull();
    expect(read.mock.calls[1]![1].aborted).toBe(true);
    expect(read.mock.calls[2]![1].aborted).toBe(false);
    const packet = await responseFor();
    previous.resolve(packet);
    await firstLoading;
    expect(model.getSnapshot().pending).not.toBeNull();
    next.resolve(packet);
    await nextLoading;
    expect(model.getSnapshot().pending).toBeNull();
  });
});
function draft(
  memberships = [member(), member(second), member(sameIssuer)],
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
function responseFor(listing = first) {
  return annualComparisonResponse(listing === second ? "right" : "left");
}
function fixture() {
  const read = vi.fn<ManagedApi["annualReport"]>();
  const readError = vi.fn();
  const access = new ManagedSecAccess();
  const model = new ManagedWatchlistAnnualComparison(read, readError, access);
  model.reconcile(draft(), digest, true, true);
  const choose = (
    side: ManagedWatchlistAnnualComparisonSide,
    index: number | null,
  ) => {
    const state = model.getSnapshot();
    const selected = index === null ? null : state.memberships[index]!;
    model.select(side, state, selected);
    return selected;
  };
  return { model, read, readError, access, choose };
}
afterEach(() => vi.useRealTimers());

describe("watchlist Annual pair selection", () => {
  it("starts without defaults or reads and includes every complete draft identity", () => {
    const { model, read } = fixture();
    expect(model.getSnapshot()).toMatchObject({
      active: true,
      canRead: true,
      pending: null,
      left: { selected: null, report: { response: null } },
      right: { selected: null, report: { response: null } },
    });
    expect(
      model.getSnapshot().memberships.map((entry) => entry.listing),
    ).toEqual([first, second, sameIssuer]);
    expect(
      Object.keys(model.getSnapshot().memberships[0]!.listing),
    ).not.toContain("note");
    expect(Object.isFrozen(model.getSnapshot().memberships[0]!.listing)).toBe(
      true,
    );
    expect(read).not.toHaveBeenCalled();
  });
  it("refuses two share classes of one issuer, preserving the accepted pair and clearing feedback on correction", () => {
    const { model, choose, read } = fixture();
    const left = choose("left", 0);
    const right = choose("right", 1);
    choose("right", 2);
    expect(model.getSnapshot().left.selected).toBe(left);
    expect(model.getSnapshot().right.selected).toBe(right);
    expect(model.getSnapshot().message).toContain("different companies");
    choose("right", 1);
    expect(model.getSnapshot().message).toBe("");
    choose("left", null);
    expect(model.getSnapshot().left.selected).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
  it("fences captured select/clear/load events after a newer selection", async () => {
    const { model, choose, read } = fixture();
    const old = model.getSnapshot();
    const selected = choose("left", 0)!;
    model.select("left", old, null);
    expect(model.getSnapshot().left.selected).toBe(selected);
    choose("left", 1);
    await model.load("left", selected);
    expect(model.getSnapshot().left.selected?.listing).toEqual(second);
    expect(read).not.toHaveBeenCalled();
  });
  it("retains both owners, accepted packets and handles through note/reorder/save copies", async () => {
    const { model, choose, read } = fixture();
    const left = choose("left", 0)!;
    const right = choose("right", 1)!;
    const packet = await responseFor();
    read.mockResolvedValueOnce(packet);
    await model.load("left", left);
    const prior = model.getSnapshot().left;
    const changed = draft([
      member(second),
      { ...member(), note: "Changed raw note\n😀" },
      member(sameIssuer),
    ]);
    model.reconcile(changed, digest, true, false);
    expect(model.getSnapshot().left).toBe(prior);
    expect(model.getSnapshot().right.selected).toBe(right);
    model.reconcile(structuredClone(changed), digest, true, true);
    expect(model.getSnapshot().left).toBe(prior);
    expect(model.getSnapshot().memberships[1]).toBe(left);
    expect(changed.memberships[1]!.note).toBe("Changed raw note\n😀");
    expect(read).toHaveBeenCalledOnce();
  });
  it.each(Object.keys(first) as (keyof ManagedEodIdentity)[])(
    "clears a selected changed %s even while hidden",
    (key) => {
      const { model, choose } = fixture();
      const previous = choose("left", 0)!;
      const right = choose("right", 1);
      model.reconcile(
        draft([{ ...member(), [key]: "changed" }, member(second)]),
        digest,
        false,
        false,
      );
      expect(model.getSnapshot().left.selected).toBeNull();
      expect(model.getSnapshot().right.selected).toBe(right);
      expect(model.getSnapshot().memberships[0]!.handle).not.toBe(
        previous.handle,
      );
    },
  );
  it("does not revive a removed then re-added member or old callback", async () => {
    const { model, choose, read } = fixture();
    const old = choose("left", 0)!;
    const captured = model.getSnapshot();
    model.reconcile(draft([member(second)]), digest, false, false);
    model.reconcile(draft(), digest, true, true);
    model.select("left", captured, old);
    await model.load("left", old);
    expect(model.getSnapshot().left.selected).toBeNull();
    expect(model.getSnapshot().memberships[0]!.handle).not.toBe(old.handle);
    expect(read).not.toHaveBeenCalled();
  });
  it.each([null, `sha256:${"b".repeat(64)}`] as const)(
    "clears both owners on a missing or changed catalog %s",
    (catalog) => {
      const { model, choose } = fixture();
      choose("left", 0);
      choose("right", 1);
      model.reconcile(draft(), catalog, true, true);
      expect(model.getSnapshot()).toMatchObject({
        memberships: [],
        canRead: false,
        left: { selected: null },
        right: { selected: null },
      });
    },
  );
  it("does not publish equivalent reconciliation, including a reentrant subscriber", () => {
    const { model } = fixture();
    const listener = vi.fn(() =>
      model.reconcile(draft(), digest, true, model.getSnapshot().canRead),
    );
    model.subscribe(listener);
    const original = model.getSnapshot();
    model.reconcile(draft(), digest, true, true);
    expect(model.getSnapshot()).toBe(original);
    expect(listener).not.toHaveBeenCalled();
    model.reconcile(draft(), digest, true, false);
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("watchlist Annual explicit read lifetime", () => {
  it("loads each selected company explicitly with exact request identity and serializes the pair", async () => {
    const { model, choose, read } = fixture();
    const left = choose("left", 0)!;
    const right = choose("right", 1)!;
    const held = deferred<Awaited<ReturnType<typeof responseFor>>>();
    read
      .mockReturnValueOnce(held.promise)
      .mockResolvedValueOnce(await responseFor(second));
    const loading = model.load("left", left);
    await model.load("right", right);
    await model.load("left", left);
    expect(read).toHaveBeenCalledOnce();
    expect(read.mock.calls[0]![0]).toEqual({
      schemaVersion: "6.0.0",
      catalogSnapshotSha256: digest,
      listingId: first.listingId,
      symbol: first.symbol,
    });
    const packet = await responseFor();
    held.resolve(packet);
    await loading;
    await model.load("right", right);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1]![0].listingId).toBe(second.listingId);
    expect(model.getSnapshot().left.report.response).toBe(packet);
    expect(model.getSnapshot().left.report.view?.canonical).toBe(
      packet.evidence,
    );
    expect(model.getSnapshot().right.report.response?.security.issuerId).toBe(
      second.issuerId,
    );
    expect(model.getSnapshot().pending).toBeNull();
  });
  it.each(["selection", "navigation", "locked", "catalog", "retirement"])(
    "aborts and ignores late success after %s",
    async (cause) => {
      const { model, choose, read } = fixture();
      const left = choose("left", 0)!;
      const held = deferred<Awaited<ReturnType<typeof responseFor>>>();
      read.mockReturnValueOnce(held.promise);
      const loading = model.load("left", left);
      if (cause === "selection") choose("left", 1);
      if (cause === "navigation")
        model.reconcile(draft(), digest, false, false);
      if (cause === "locked") model.reconcile(draft(), digest, true, false);
      if (cause === "catalog") model.reconcile(draft(), null, true, true);
      if (cause === "retirement") model.retire();
      expect(read.mock.calls[0]![1].aborted).toBe(true);
      held.resolve(await responseFor());
      await loading;
      expect(model.getSnapshot().left.report.response).toBeNull();
      expect(model.getSnapshot().pending).toBeNull();
      await model.load("left", left);
      expect(read).toHaveBeenCalledOnce();
    },
  );
  it("retains an accepted report on navigation and ignores late authentication failure", async () => {
    const { model, choose, read, readError } = fixture();
    const left = choose("left", 0)!;
    const packet = await responseFor();
    const held = deferred<Awaited<ReturnType<typeof responseFor>>>();
    read.mockResolvedValueOnce(packet).mockReturnValueOnce(held.promise);
    await model.load("left", left);
    const refreshing = model.load("left", left);
    model.reconcile(draft(), digest, false, false);
    held.reject(new TrialApiError("unauthenticated"));
    await refreshing;
    model.reconcile(draft(), digest, true, true);
    expect(model.getSnapshot().left).toMatchObject({
      selected: left,
      report: { response: packet, showingPrevious: true, running: false },
    });
    expect(readError).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(2);
  });
  it.each(["pending", "running"])(
    "does not start a read after a reentrant leave on the %s notification",
    async (stage) => {
      const { model, choose, read } = fixture();
      const left = choose("left", 0)!;
      model.subscribe(() => {
        const state = model.getSnapshot();
        if (stage === "pending" ? state.pending : state.left.report.running)
          model.reconcile(draft(), digest, false, false);
      });
      await model.load("left", left);
      expect(read).not.toHaveBeenCalled();
      expect(model.getSnapshot()).toMatchObject({
        active: false,
        pending: null,
        left: { report: { running: false } },
      });
    },
  );
  it("keeps cancellation bound to its original operation", async () => {
    const { model, choose, read } = fixture();
    const left = choose("left", 0)!;
    const firstRead = deferred<Awaited<ReturnType<typeof responseFor>>>();
    const secondRead = deferred<Awaited<ReturnType<typeof responseFor>>>();
    read
      .mockReturnValueOnce(firstRead.promise)
      .mockReturnValueOnce(secondRead.promise);
    const a = model.load("left", left);
    const cancel = model.getSnapshot().pending!.cancel;
    cancel();
    const b = model.load("left", left);
    cancel();
    expect(read.mock.calls[1]![1].aborted).toBe(false);
    firstRead.resolve(await responseFor());
    await a;
    expect(model.getSnapshot().pending).not.toBeNull();
    secondRead.resolve(await responseFor());
    await b;
    expect(model.getSnapshot().pending).toBeNull();
  });
  it.each([
    new TrialApiError("unavailable"),
    new ManagedAnnualReportError("request_timeout"),
  ])(
    "retains the exact accepted packet on an established refresh failure %s",
    async (error) => {
      const { model, choose, read } = fixture();
      const left = choose("left", 0)!;
      const packet = await responseFor();
      read.mockResolvedValueOnce(packet).mockRejectedValueOnce(error);
      await model.load("left", left);
      await model.load("left", left);
      expect(model.getSnapshot().left.report).toMatchObject({
        response: packet,
        showingPrevious: true,
        error: true,
      });
    },
  );
  it("uses the same checked SEC cooldown for both owners and honors an existing owner deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    const { model, choose, read, access } = fixture();
    const left = choose("left", 0)!;
    const right = choose("right", 1)!;
    const deadline = "2026-10-01T00:01:00.000Z";
    read.mockRejectedValueOnce(new ManagedSecCooldownError(deadline));
    await model.load("left", left);
    await model.load("right", right);
    expect(read).toHaveBeenCalledOnce();
    expect(model.getSnapshot().right.report.message).toContain(deadline);
    access.recordCooldown(
      new ManagedSecCooldownError("2026-10-01T00:02:00.000Z"),
      new AbortController().signal,
    );
    await model.load("left", left);
    expect(read).toHaveBeenCalledOnce();
    expect(model.getSnapshot().left.report.message).toContain("00:02:00.000Z");
  });
  it.each([
    new TrialApiError("invalid_response"),
    new ManagedAnnualReportError("not_configured"),
    new ManagedCatalogChangedError(),
  ])(
    "clears an old packet for a non-retainable Annual error %s",
    async (error) => {
      const { model, choose, read } = fixture();
      const left = choose("left", 0)!;
      read
        .mockResolvedValueOnce(await responseFor())
        .mockRejectedValueOnce(error);
      await model.load("left", left);
      await model.load("left", left);
      expect(model.getSnapshot().left.report.response).toBeNull();
      expect(model.getSnapshot().catalogChanged).toBe(
        error instanceof ManagedCatalogChangedError,
      );
      if (error instanceof ManagedCatalogChangedError) {
        const refused = model.getSnapshot();
        model.select("left", refused, null);
        await model.load("left", left);
        expect(model.getSnapshot()).toBe(refused);
        expect(read).toHaveBeenCalledTimes(2);
      }
    },
  );
  it("refuses a response for the other selected issuer", async () => {
    const { model, choose, read } = fixture();
    const left = choose("left", 0)!;
    read.mockResolvedValueOnce(await responseFor(second));
    await model.load("left", left);
    expect(model.getSnapshot().left.report).toMatchObject({
      response: null,
      error: true,
    });
  });
  it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
    "retires both reports and all handles for current %s",
    async (code) => {
      const { model, choose, read, readError } = fixture();
      const left = choose("left", 0)!;
      const right = choose("right", 1)!;
      read
        .mockResolvedValueOnce(await responseFor())
        .mockRejectedValueOnce(new TrialApiError(code));
      await model.load("left", left);
      await model.load("right", right);
      expect(readError).toHaveBeenCalledOnce();
      expect(model.getSnapshot()).toMatchObject({
        memberships: [],
        active: false,
        pending: null,
        left: { selected: null, report: { response: null } },
        right: { selected: null, report: { response: null } },
      });
      model.reconcile(draft(), digest, true, true);
      await model.load("left", left);
      expect(model.getSnapshot().memberships).toEqual([]);
      expect(read).toHaveBeenCalledTimes(2);
    },
  );
});
