import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type {
  ManagedEodIdentity,
  PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  ManagedAnnualReportError,
  ManagedCatalogChangedError,
  ManagedSecCooldownError,
  type ManagedApi,
} from "./managed-api";
import { ManagedSecAccess } from "./managed-sec-access";
import { eodSelection } from "./eod-history-fixture";
import { annualComparisonResponse } from "./test-canonical-annual-comparison-fixture";
import {
  ManagedFinancialScreen,
  type ManagedFinancialScreenReportCapture,
} from "./managed-financial-screen";
import { DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA } from "./managed-financial-screen-results";

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
const alternate: ManagedEodIdentity = {
  ...first,
  listingId: "listing-other",
  securityId: "security-other",
  shareClassId: "class-other",
  shareClassName: "Class C",
  symbol: "ZEROC",
};
let left: PersonalSecAnnualCanonicalResponseDto;
let right: PersonalSecAnnualCanonicalResponseDto;
let unavailable: PersonalSecAnnualCanonicalResponseDto;
beforeAll(async () => {
  [left, right, unavailable] = await Promise.all([
    annualComparisonResponse("left"),
    annualComparisonResponse("right"),
    annualComparisonResponse("left", { mode: "source-unavailable" }),
  ]);
});
afterEach(() => vi.useRealTimers());
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(listings: readonly ManagedEodIdentity[] = [first, second]) {
  vi.useFakeTimers({
    toFake: ["Date", "performance", "setTimeout", "clearTimeout"],
  });
  vi.setSystemTime(new Date("2026-09-20T00:00:00.000Z"));
  const access = new ManagedSecAccess();
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
        listing:
          listings.find((listing) => listing.listingId === listingId) ?? null,
      })),
    }),
  );
  const readError = vi.fn();
  const model = new ManagedFinancialScreen(
    { resolve, annualReport: read },
    readError,
    access,
    {
      listingIds: listings.map((row) => row.listingId),
      coverage: createManagedResearchCoverageFixture(
        listings.map((listing, index) => ({
          listing,
          cik:
            listing.issuerId === first.issuerId
              ? "0000000001"
              : listing.issuerId === second.issuerId
                ? "0000000002"
                : String(index + 10).padStart(10, "0"),
        })),
      ),
    },
  );
  model.reconcile(digest, true, true);
  const universe = () => model.loadUniverse(model.getSnapshot());
  const run = () => model.run(model.getSnapshot());
  return { model, read, resolve, readError, access, universe, run };
}
async function loaded() {
  const f = fixture([first]);
  await f.universe();
  await f.run();
  const run = f.model.getSnapshot().run!;
  const row = run.rows[0]!;
  const capture: ManagedFinancialScreenReportCapture = {
    run,
    row,
    response: row.report!.response!,
  };
  return { ...f, capture };
}

describe("managed financial screen explicit run", () => {
  it("makes no requests on entry; explicitly resolves the exact cohort and default-selects one listing per issuer", async () => {
    const f = fixture([first, alternate, second]);
    expect(f.resolve).not.toHaveBeenCalled();
    expect(f.read).not.toHaveBeenCalled();
    await f.universe();
    expect(f.resolve).toHaveBeenCalledExactlyOnceWith(
      {
        snapshotSha256: digest,
        listingIds: [first.listingId, alternate.listingId, second.listingId],
      },
      expect.any(AbortSignal),
    );
    expect(f.read).not.toHaveBeenCalled();
    const state = f.model.getSnapshot();
    expect(state.memberships.map((row) => row.listing.symbol)).toEqual([
      "ZERO",
      "ZEROC",
      "ONE",
    ]);
    expect(state.selected.map((row) => row.listing.symbol)).toEqual([
      "ZERO",
      "ONE",
    ]);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.memberships[0]!.listing)).toBe(true);
    expect(state.pending).toBeNull();
  });
  it("keeps two annual reads sequential and at least twenty seconds apart, capturing exact responses, criteria and clocks", async () => {
    const f = fixture();
    await f.universe();
    const criteria = {
      clauses: [{ field: "operatingCashFlow", operator: "gte", value: "0" }],
      sort: { field: "symbol", direction: "asc" },
    };
    f.model.setCriteria(f.model.getSnapshot(), criteria);
    const staged = f.model.getSnapshot();
    const running = f.run();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(f.model.getSnapshot().pending?.kind).toBe("waiting");
    await vi.advanceTimersByTimeAsync(19_999);
    expect(f.read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await running;
    const run = f.model.getSnapshot().run!;
    expect(f.read.mock.calls.map(([request]) => request)).toEqual(
      [first, second].map((listing) => ({
        schemaVersion: "6.0.0",
        catalogSnapshotSha256: digest,
        listingId: listing.listingId,
        symbol: listing.symbol,
      })),
    );
    expect(run.status).toBe("completed");
    expect(run.startedAt).toBe("2026-09-20T00:00:00.000Z");
    expect(run.completedAt).toBe("2026-09-20T00:00:20.000Z");
    expect(run.criteria).toEqual(criteria);
    expect(run.criteria).toBe(staged.criteria);
    expect(run.criteriaRevision).toBe(staged.criteriaRevision);
    expect(run.selectionRevision).toBe(staged.selectionRevision);
    for (const [index, response] of [left, right].entries()) {
      const row = run.rows[index]!;
      expect(row.report!.response).toBe(response);
      expect(row.report!.view!.canonical).toBe(response.evidence);
      expect(row.evaluation!.response).toBe(response);
      expect(row.failure).toBeNull();
    }
    expect(f.model.getSnapshot().pending).toBeNull();
  });
  it("does not overlap reads when the first request itself lasts longer than twenty seconds", async () => {
    const f = fixture();
    await f.universe();
    const pending = deferred<PersonalSecAnnualCanonicalResponseDto>();
    f.read.mockReturnValueOnce(pending.promise);
    const running = f.run();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.read).toHaveBeenCalledTimes(1);
    pending.resolve(left);
    await running;
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.model.getSnapshot().run!.status).toBe("completed");
  });
  it("honors the checked shared cooldown before the first dispatch without losing source dates", async () => {
    const f = fixture([first]);
    await f.universe();
    f.access.recordCooldown(
      new ManagedSecCooldownError("2026-09-20T00:00:30.000Z"),
      new AbortController().signal,
    );
    const running = f.run();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(f.read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await running;
    expect(f.read).toHaveBeenCalledOnce();
    expect(
      f.model.getSnapshot().run!.rows[0]!.report!.response!.evidence.generation,
    ).toBe(left.evidence.generation);
  });
  it("uses a monotonic dispatch interval when the wall clock jumps forward", async () => {
    const f = fixture();
    await f.universe();
    const running = f.run();
    await vi.advanceTimersByTimeAsync(0);
    vi.setSystemTime(new Date("2026-09-21T00:00:00.000Z"));
    await vi.advanceTimersByTimeAsync(19_999);
    expect(f.read).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await running;
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it("records an admission refusal and waits for its checked deadline before the next distinct issuer without retry", async () => {
    const f = fixture();
    await f.universe();
    f.read.mockRejectedValueOnce(
      new ManagedSecCooldownError("2026-09-20T00:00:30.000Z"),
    );
    const running = f.run();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.model.getSnapshot().run!.rows[0]!.failure).toBe("rate_limited");
    expect(f.model.getSnapshot().run!.rows[0]!.report!.response).toBeNull();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(f.read).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await running;
    expect(f.read.mock.calls.map(([request]) => request.listingId)).toEqual([
      first.listingId,
      second.listingId,
    ]);
    expect(f.model.getSnapshot().run!.rows[1]!.report!.response).toBe(right);
  });
  it("retains actual row failures and independent subsequent results without retry", async () => {
    const f = fixture();
    await f.universe();
    f.read.mockRejectedValueOnce(
      new ManagedAnnualReportError("request_timeout"),
    );
    const running = f.run();
    await vi.advanceTimersByTimeAsync(20_000);
    await running;
    const rows = f.model.getSnapshot().run!.rows;
    expect(rows[0]!.failure).toBe("request_timeout");
    expect(rows[0]!.report!.response).toBeNull();
    expect(rows[0]!.evaluation).toBeNull();
    expect(rows[1]!.report!.response).toBe(right);
    expect(rows[1]!.failure).toBeNull();
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it("retains truthful canonical source refusal metadata and numerical unknowns", async () => {
    const f = fixture([first]);
    await f.universe();
    f.model.setCriteria(f.model.getSnapshot(), {
      clauses: [{ field: "operatingCashFlow", operator: "gte", value: "0" }],
      sort: { field: "symbol", direction: "asc" },
    });
    f.read.mockResolvedValueOnce(unavailable);
    await f.run();
    const row = f.model.getSnapshot().run!.rows[0]!;
    expect(row.report!.response).toBe(unavailable);
    expect(row.evaluation!.match).toBe("unknown");
    expect(row.failure).toContain("companyFacts:");
    expect(row.report!.response!.evidence.facts.observations).toEqual([]);
  });
  it("rejects a different exact listing response, including another share class of the selected issuer", async () => {
    const f = fixture([alternate]);
    await f.universe();
    f.read.mockResolvedValueOnce(left);
    await f.run();
    expect(f.read.mock.calls[0]![0].listingId).toBe(alternate.listingId);
    const row = f.model.getSnapshot().run!.rows[0]!;
    expect(row.report!.response).toBeNull();
    expect(row.report!.error).toBe(true);
    expect(row.evaluation).toBeNull();
    expect(row.failure).toBe("report_unavailable");
  });
});

describe("screen cancellation and staged ownership", () => {
  it("cancels a wait immediately and retains completed rows, captured criteria and dates", async () => {
    const f = fixture();
    await f.universe();
    const running = f.run();
    await vi.advanceTimersByTimeAsync(0);
    const before = f.model.getSnapshot().run!;
    const pending = f.model.getSnapshot().pending!;
    pending.cancel();
    await running;
    const state = f.model.getSnapshot();
    expect(state.pending).toBeNull();
    expect(state.run!.status).toBe("cancelled");
    expect(state.run!.rows).toBe(before.rows);
    expect(state.run!.criteria).toBe(before.criteria);
    expect(state.run!.startedAt).toBe(before.startedAt);
    expect(state.run!.completedAt).not.toBeNull();
    await vi.advanceTimersByTimeAsync(100_000);
    expect(f.read).toHaveBeenCalledOnce();
  });
  it("returns promptly on Cancel even when a read ignores abort, and fences late completion", async () => {
    const f = fixture();
    await f.universe();
    const pending = deferred<PersonalSecAnnualCanonicalResponseDto>();
    f.read.mockReturnValueOnce(pending.promise);
    const running = f.run();
    await vi.advanceTimersByTimeAsync(0);
    f.model.cancel();
    await running;
    expect(f.read.mock.calls[0]![1].aborted).toBe(true);
    const after = f.model.getSnapshot();
    pending.resolve(left);
    await vi.advanceTimersByTimeAsync(100_000);
    expect(f.model.getSnapshot()).toBe(after);
    expect(after.run!.rows[0]!.report).toBeNull();
    expect(f.read).toHaveBeenCalledOnce();
  });
  it("criteria edit and exact restoration advance revision without changing captured results", async () => {
    const { model, capture } = await loaded();
    const before = model.getSnapshot();
    model.setCriteria(before, {
      clauses: [{ field: "workingCapital", operator: "lte", value: "-1" }],
      sort: { field: "symbol", direction: "asc" },
    });
    const edited = model.getSnapshot();
    model.setCriteria(edited, DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA);
    const restored = model.getSnapshot();
    expect(restored.criteria).toEqual(before.criteria);
    expect(restored.criteriaRevision).not.toBe(before.criteriaRevision);
    expect(restored.run).toBe(capture.run);
    expect(restored.run!.criteriaRevision).toBe(before.criteriaRevision);
    model.setCriteria(before, {
      clauses: [],
      sort: { field: "symbol", direction: "desc" },
    });
    expect(model.getSnapshot()).toBe(restored);
  });
  it("editing criteria cancels a running read and keeps the original run criteria", async () => {
    const f = fixture([first]);
    await f.universe();
    const pending = deferred<PersonalSecAnnualCanonicalResponseDto>();
    f.read.mockReturnValueOnce(pending.promise);
    const running = f.run();
    await vi.advanceTimersByTimeAsync(0);
    const before = f.model.getSnapshot();
    f.model.setCriteria(before, {
      clauses: [],
      sort: { field: "symbol", direction: "desc" },
    });
    await running;
    expect(f.model.getSnapshot().run!.status).toBe("cancelled");
    expect(f.model.getSnapshot().run!.criteria).toBe(before.criteria);
    expect(f.model.getSnapshot().criteria.sort.direction).toBe("desc");
    pending.resolve(left);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.model.getSnapshot().run!.rows[0]!.report).toBeNull();
  });
  it("selection rejects copied handles and duplicate issuers; explicit share-class replacement advances revision", async () => {
    const f = fixture([first, alternate, second]);
    await f.universe();
    const before = f.model.getSnapshot();
    const member = before.memberships[0]!;
    f.model.select(before, { ...member }, false);
    expect(f.model.getSnapshot()).toBe(before);
    f.model.select(before, before.memberships[1]!, true);
    expect(f.model.getSnapshot().selected).toEqual(before.selected);
    f.model.select(f.model.getSnapshot(), member, false);
    f.model.select(f.model.getSnapshot(), before.memberships[1]!, true);
    expect(
      f.model.getSnapshot().selected.map((row) => row.listing.symbol),
    ).toEqual(["ONE", "ZEROC"]);
    f.model.select(f.model.getSnapshot(), before.memberships[1]!, false);
    f.model.select(f.model.getSnapshot(), member, true);
    expect(new Set(f.model.getSnapshot().selected).size).toBe(2);
    expect(f.model.getSnapshot().selectionRevision).not.toBe(
      before.selectionRevision,
    );
    f.model.select(before, member, false);
    expect(f.model.getSnapshot().selected).toContain(member);
  });
  it("retains run, shortlist and staged choices through navigation away and Back", async () => {
    const { model, capture, read } = await loaded();
    model.toggleShortlist(model.getSnapshot(), capture.row);
    const before = model.getSnapshot();
    model.reconcile(digest, false, false);
    expect(model.canAdmitReport(capture)).toBe(false);
    model.reconcile(digest, true, true);
    const returned = model.getSnapshot();
    expect(returned.run).toBe(before.run);
    expect(returned.shortlist).toBe(before.shortlist);
    expect(returned.criteria).toBe(before.criteria);
    expect(returned.selected).toBe(before.selected);
    expect(read).toHaveBeenCalledOnce();
    expect(model.canAdmitReport(capture)).toBe(true);
  });
  it("navigation away cancels a wait without issuing the queued company request", async () => {
    const f = fixture();
    await f.universe();
    const running = f.run();
    await vi.advanceTimersByTimeAsync(0);
    f.model.reconcile(digest, false, false);
    await running;
    f.model.reconcile(digest, true, true);
    await vi.advanceTimersByTimeAsync(100_000);
    expect(f.read).toHaveBeenCalledOnce();
    expect(f.model.getSnapshot().run!.rows[0]!.report!.response).toBe(left);
    expect(f.model.getSnapshot().run!.rows[1]!.report).toBeNull();
  });
});

describe("screen admission and report handoff", () => {
  it("rejects incomplete, mismatched and extra catalog responses before any source request", async () => {
    for (const value of [
      { snapshotSha256: digest, results: [] },
      {
        snapshotSha256: `sha256:${"b".repeat(64)}`,
        results: [{ listingId: first.listingId, listing: first }],
      },
      {
        snapshotSha256: digest,
        results: [{ listingId: first.listingId, listing: null }],
      },
      {
        snapshotSha256: digest,
        results: [{ listingId: first.listingId, listing: first }],
        extra: true,
      },
    ]) {
      const f = fixture([first]);
      f.resolve.mockResolvedValueOnce(value);
      await f.universe();
      expect(f.model.getSnapshot().memberships).toEqual([]);
      expect(f.model.getSnapshot().error).toBe(true);
      await f.run();
      expect(f.read).not.toHaveBeenCalled();
    }
  });
  it("fences a cancelled late universe resolution and its stale Cancel callback", async () => {
    const f = fixture([first]);
    const pending = deferred<Awaited<ReturnType<ManagedApi["resolve"]>>>();
    f.resolve.mockReturnValueOnce(pending.promise);
    const resolving = f.universe();
    const old = f.model.getSnapshot().pending!;
    old.cancel();
    await resolving;
    await f.universe();
    const after = f.model.getSnapshot();
    old.cancel();
    pending.resolve({
      snapshotSha256: digest,
      results: [{ listingId: first.listingId, listing: first }],
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.model.getSnapshot()).toBe(after);
    expect(after.memberships).toHaveLength(1);
  });
  it("hands off the exact original response and full listing with screening provenance", async () => {
    const { model, capture, read } = await loaded();
    const handoff = model.admitReport(capture)!;
    expect(handoff.selection).toEqual({
      listing: first,
      catalogSnapshotSha256: digest,
      cik: "0000000001",
      origin: "screening",
    });
    expect(handoff.selection.listing).not.toBe(capture.row.member.listing);
    expect(handoff.seed).toEqual({
      response: left,
      showingPrevious: false,
      provenance: "financial-screen",
    });
    expect(handoff.seed.response).toBe(left);
    expect(Object.isFrozen(handoff.seed)).toBe(true);
    expect(read).toHaveBeenCalledOnce();
  });
  it("refuses forged run, row, response and foreign-model capabilities", async () => {
    const { model, capture } = await loaded();
    const foreign = await loaded();
    for (const bad of [
      { ...capture, run: { ...capture.run } },
      { ...capture, row: { ...capture.row } },
      { ...capture, response: structuredClone(capture.response) },
      foreign.capture,
    ]) {
      expect(model.canAdmitReport(bad)).toBe(false);
      expect(model.admitReport(bad)).toBeNull();
    }
    const before = model.getSnapshot();
    model.toggleShortlist(before, { ...capture.row });
    expect(model.getSnapshot()).toBe(before);
  });
  it("does not admit an unread row with a forged absent response", async () => {
    const f = fixture([first]);
    await f.universe();
    f.read.mockReturnValueOnce(
      deferred<PersonalSecAnnualCanonicalResponseDto>().promise,
    );
    const running = f.run();
    await vi.advanceTimersByTimeAsync(0);
    const run = f.model.getSnapshot().run!;
    expect(
      f.model.canAdmitReport({
        run,
        row: run.rows[0]!,
        response: undefined,
      } as unknown as ManagedFinancialScreenReportCapture),
    ).toBe(false);
    f.model.cancel();
    await running;
  });
  it("refuses an old run after replacement and makes stale actions inert", async () => {
    const { model, capture, run } = await loaded();
    const oldState = model.getSnapshot();
    const replacement = run();
    await vi.advanceTimersByTimeAsync(20_000);
    await replacement;
    expect(model.canAdmitReport(capture)).toBe(false);
    model.toggleShortlist(oldState, capture.row);
    expect(model.getSnapshot().shortlist).toEqual([]);
    expect(model.getSnapshot().run!.rows[0]!.report!.response).toBe(left);
  });
  it("requires explicit Cancel before handing off a completed row in a running screen", async () => {
    const f = fixture();
    await f.universe();
    const running = f.run();
    await vi.advanceTimersByTimeAsync(0);
    const run = f.model.getSnapshot().run!;
    const row = run.rows[0]!;
    expect(f.model.canAdmitReport({ run, row, response: left })).toBe(false);
    expect(f.model.admitReport({ run, row, response: left })).toBeNull();
    expect(f.model.getSnapshot().pending?.kind).toBe("waiting");
    f.model.cancel();
    await running;
    const capture = { run: f.model.getSnapshot().run!, row, response: left };
    const handoff = f.model.admitReport(capture);
    expect(handoff!.seed.response).toBe(left);
    expect(f.model.canAdmitReport(capture)).toBe(true);
    expect(f.model.getSnapshot().run!.status).toBe("cancelled");
    await vi.advanceTimersByTimeAsync(100_000);
    expect(f.read).toHaveBeenCalledOnce();
  });
  it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
    "retires all transient state on %s and fences late actions",
    async (code) => {
      const f = fixture();
      await f.universe();
      f.read.mockRejectedValueOnce(new TrialApiError(code));
      await f.run();
      expect(f.readError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ code }),
      );
      expect(f.model.getSnapshot()).toMatchObject({
        active: false,
        canRead: false,
        memberships: [],
        selected: [],
        shortlist: [],
        run: null,
        pending: null,
      });
      f.model.reconcile(digest, true, true);
      await f.universe();
      expect(f.resolve).toHaveBeenCalledOnce();
    },
  );
  it("stops at configuration loss, retains the actual refusal, and does not resume from ordinary reconciliation", async () => {
    const f = fixture();
    await f.universe();
    f.read.mockRejectedValueOnce(
      new ManagedAnnualReportError("not_configured"),
    );
    await f.run();
    expect(f.model.getSnapshot().run!.status).toBe("stopped");
    expect(f.model.getSnapshot().run!.rows[0]!.failure).toBe("not_configured");
    f.model.reconcile(digest, true, true);
    await f.run();
    expect(f.model.getSnapshot().canRead).toBe(false);
    expect(f.read).toHaveBeenCalledOnce();
  });
  it("catalog refusal clears captures and remains blocked for the same catalog", async () => {
    const f = fixture();
    await f.universe();
    f.read.mockRejectedValueOnce(new ManagedCatalogChangedError());
    await f.run();
    expect(f.model.getSnapshot()).toMatchObject({
      catalogChanged: true,
      memberships: [],
      run: null,
      shortlist: [],
    });
    f.model.reconcile(digest, true, true);
    await f.universe();
    expect(f.resolve).toHaveBeenCalledOnce();
    expect(f.model.getSnapshot().canRead).toBe(false);
  });
  it("catalog replacement and session retirement clear retained captures", async () => {
    for (const cause of ["catalog", "retire"] as const) {
      const { model, capture } = await loaded();
      model.toggleShortlist(model.getSnapshot(), capture.row);
      if (cause === "catalog")
        model.reconcile(`sha256:${"b".repeat(64)}`, true, true);
      else model.retire();
      expect(model.getSnapshot().memberships).toEqual([]);
      expect(model.getSnapshot().run).toBeNull();
      expect(model.getSnapshot().shortlist).toEqual([]);
      expect(model.admitReport(capture)).toBeNull();
    }
  });
  it("rejects invalid criteria without invoking getters or discarding retained results", async () => {
    const { model } = await loaded();
    const getter = vi.fn();
    const before = model.getSnapshot();
    for (const criteria of [
      null,
      { ...before.criteria, extra: true },
      {
        get clauses() {
          getter();
          return [];
        },
        sort: before.criteria.sort,
      },
      {
        clauses: [{ field: "currentRatio", operator: "gte", value: "NaN" }],
        sort: before.criteria.sort,
      },
    ]) {
      model.setCriteria(before, criteria);
      expect(model.getSnapshot()).toBe(before);
    }
    expect(getter).not.toHaveBeenCalled();
  });
  it("stages raw edits without IO and requires valid Apply and a fresh run before old report or shortlist actions", async () => {
    const { model, capture, read } = await loaded();
    model.toggleShortlist(model.getSnapshot(), capture.row);
    const before = model.getSnapshot();
    model.stageCriteria(before);
    const staged = model.getSnapshot();
    expect(staged.criteriaStaged).toBe(true);
    expect(staged.criteriaRevision).not.toBe(before.criteriaRevision);
    expect(staged.run).toBe(before.run);
    expect(staged.shortlist).toBe(before.shortlist);
    expect(model.canAdmitReport(capture)).toBe(false);
    model.toggleShortlist(staged, capture.row);
    expect(model.getSnapshot()).toBe(staged);
    await model.run(staged);
    model.setCriteria(staged, {
      clauses: [{ field: "currentRatio", operator: "gte", value: "-" }],
      sort: staged.criteria.sort,
    });
    expect(model.getSnapshot()).toBe(staged);
    model.stageCriteria(staged);
    const restored = model.getSnapshot();
    expect(restored.criteriaRevision).not.toBe(staged.criteriaRevision);
    model.setCriteria(restored, DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA);
    const applied = model.getSnapshot();
    expect(applied.criteriaStaged).toBe(false);
    expect(applied.criteria).toEqual(before.criteria);
    expect(model.canAdmitReport(capture)).toBe(false);
    model.toggleShortlist(applied, capture.row);
    expect(model.getSnapshot()).toBe(applied);
    expect(read).toHaveBeenCalledOnce();
  });
  it("staging a partial edit cancels a pending read immediately and fences its late response", async () => {
    const f = fixture([first]);
    await f.universe();
    const pending = deferred<PersonalSecAnnualCanonicalResponseDto>();
    f.read.mockReturnValueOnce(pending.promise);
    const running = f.run();
    await vi.advanceTimersByTimeAsync(0);
    f.model.stageCriteria(f.model.getSnapshot());
    await running;
    const after = f.model.getSnapshot();
    expect(after.criteriaStaged).toBe(true);
    expect(after.pending).toBeNull();
    expect(after.run!.status).toBe("cancelled");
    pending.resolve(left);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.model.getSnapshot()).toBe(after);
  });
  it("selection edit and exact restoration cannot renew an old report or shortlist handle", async () => {
    const { model, capture } = await loaded();
    const before = model.getSnapshot();
    model.select(before, capture.row.member, false);
    model.select(model.getSnapshot(), capture.row.member, true);
    const after = model.getSnapshot();
    expect(after.selected).toEqual(before.selected);
    expect(after.selectionRevision).not.toBe(before.selectionRevision);
    expect(model.canAdmitReport(capture)).toBe(false);
    model.toggleShortlist(after, capture.row);
    expect(model.getSnapshot()).toBe(after);
  });
  it("does not admit source handoffs while the workspace cannot read", async () => {
    const { model, capture } = await loaded();
    model.reconcile(digest, true, false);
    expect(model.canAdmitReport(capture)).toBe(false);
    expect(model.admitReport(capture)).toBeNull();
    model.reconcile(digest, true, true);
    expect(model.canAdmitReport(capture)).toBe(true);
  });
  it("enforces the finite listing and issuer limits before source loading", async () => {
    const listings = Array.from({ length: 18 }, (_, index) => ({
      ...first,
      listingId: `listing-${index}`,
      securityId: `security-${index}`,
      shareClassId: `class-${index}`,
      issuerId: `issuer-${index}`,
      symbol: `TEST${index}`,
    }));
    const f = fixture(listings);
    await f.universe();
    expect(f.model.getSnapshot().memberships).toEqual([]);
    expect(f.model.getSnapshot().error).toBe(true);
    expect(f.read).not.toHaveBeenCalled();
    for (const ids of [
      [],
      Array.from({ length: 19 }, (_, index) => `listing-${index}`),
      [first.listingId, first.listingId],
      ["../escape"],
      new Array<string>(1),
    ]) {
      expect(
        () =>
          new ManagedFinancialScreen(
            { resolve: f.resolve, annualReport: f.read },
            f.readError,
            f.access,
            {
              listingIds: ids,
              coverage: createManagedResearchCoverageFixture(
                listings.map((listing, index) => ({
                  listing,
                  cik:
                    listing.issuerId === first.issuerId
                      ? "0000000001"
                      : listing.issuerId === second.issuerId
                        ? "0000000002"
                        : String(index + 10).padStart(10, "0"),
                })),
              ),
            },
          ),
      ).toThrow();
    }
  });
  it("dispatches at most seventeen issuers from eighteen resolved listings and never requests the unselected share class", async () => {
    const listings = [
      first,
      alternate,
      ...Array.from({ length: 16 }, (_, index) => ({
        ...second,
        listingId: `listing-batch-${index}`,
        securityId: `security-batch-${index}`,
        shareClassId: `class-batch-${index}`,
        issuerId: `issuer-batch-${index}`,
        symbol: `BATCH${index}`,
      })),
    ];
    const f = fixture(listings);
    await f.universe();
    expect(f.model.getSnapshot().memberships).toHaveLength(18);
    expect(f.model.getSnapshot().selected).toHaveLength(17);
    const running = f.run();
    await vi.advanceTimersByTimeAsync(320_000);
    await running;
    expect(f.read).toHaveBeenCalledTimes(17);
    expect(
      f.read.mock.calls.map(([request]) => request.listingId),
    ).not.toContain(alternate.listingId);
    expect(f.model.getSnapshot().run!.status).toBe("completed");
    expect(f.model.getSnapshot().run!.rows).toHaveLength(17);
    await vi.advanceTimersByTimeAsync(100_000);
    expect(f.read).toHaveBeenCalledTimes(17);
  });
  it("session retirement aborts a pending request and ignores its late completion", async () => {
    const f = fixture([first]);
    await f.universe();
    const pending = deferred<PersonalSecAnnualCanonicalResponseDto>();
    f.read.mockReturnValueOnce(pending.promise);
    const running = f.run();
    await vi.advanceTimersByTimeAsync(0);
    f.model.retire();
    await running;
    const after = f.model.getSnapshot();
    expect(f.read.mock.calls[0]![1].aborted).toBe(true);
    expect(after.run).toBeNull();
    expect(after.criteriaStaged).toBe(false);
    pending.resolve(left);
    await vi.advanceTimersByTimeAsync(100_000);
    expect(f.model.getSnapshot()).toBe(after);
  });
  it("publishes immutable snapshots and removes subscription listeners", async () => {
    const f = fixture([first]);
    const listener = vi.fn();
    const unsubscribe = f.model.subscribe(listener);
    await f.universe();
    expect(listener).toHaveBeenCalled();
    const calls = listener.mock.calls.length;
    unsubscribe();
    await f.run();
    expect(listener).toHaveBeenCalledTimes(calls);
    expect(Object.isFrozen(f.model.getSnapshot().run!.rows[0])).toBe(true);
  });
});

it("waits twenty seconds after synchronous dispatch setup without changing source clocks", async () => {
  const f = fixture();
  await f.universe();
  const setupFinished: number[] = [];
  f.read.mockImplementation((request) => {
    if (request.listingId === first.listingId) vi.advanceTimersByTime(5);
    setupFinished.push(performance.now());
    return Promise.resolve(
      request.listingId === second.listingId ? right : left,
    );
  });
  const running = f.run();
  await vi.advanceTimersByTimeAsync(0);
  expect(f.read).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(19_999);
  expect(f.read).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  await running;
  expect(f.read).toHaveBeenCalledTimes(2);
  expect(setupFinished[1]! - setupFinished[0]!).toBe(20_000);
  expect(f.model.getSnapshot().run!.rows[0]!.report!.response).toBe(left);
  expect(f.model.getSnapshot().run!.rows[1]!.report!.response).toBe(right);
});

it("paces a synchronous dispatch failure before the next distinct issuer without retry", async () => {
  const f = fixture();
  await f.universe();
  f.read.mockImplementationOnce(() => {
    vi.advanceTimersByTime(5);
    throw new TrialApiError("unavailable");
  });
  const running = f.run();
  await vi.advanceTimersByTimeAsync(0);
  expect(f.read).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(19_999);
  expect(f.read).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  await running;
  expect(f.read).toHaveBeenCalledTimes(2);
  expect(f.read.mock.calls.map(([input]) => input.listingId)).toEqual([
    first.listingId,
    second.listingId,
  ]);
  expect(f.model.getSnapshot().run!.rows[0]!.report!.response).toBeNull();
  expect(f.model.getSnapshot().run!.rows[1]!.report!.response).toBe(right);
});
