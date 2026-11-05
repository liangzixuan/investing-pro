import { afterEach, describe, expect, it, vi } from "vitest";
import {
  financialScreenRefinementFixture as fixture,
  refinedCriteria,
  refinementTime,
} from "./test-financial-screen-refinement-fixture";
import { prepareFinancialScreenRefinement } from "./managed-financial-screen-refinement";
import { evaluateManagedFinancialScreenRow } from "./managed-financial-screen-results";

afterEach(() => vi.useRealTimers());
describe("same-run Annual filter refinement", () => {
  it("keeps complete source evidence and ordered per-clause outcomes without source reads", async () => {
    const f = await fixture("partial");
    const before = f.screen.getSnapshot();
    const run = before.run!;
    const token = f.screen.captureRefinement(
      before,
      refinedCriteria,
      refinementTime,
    )!;
    expect(token.reading.originalCriteria).toBe(run.criteria);
    expect(token.reading.sourceRun).toBe(run);
    expect(token.reading.rows.map((r) => r.original)).toEqual(run.rows);
    for (const row of token.reading.rows) {
      expect(row.revised).toEqual(
        evaluateManagedFinancialScreenRow(
          row.original.report!.response,
          refinedCriteria,
        ),
      );
      expect(row.revised!.response).toBe(row.original.report!.response);
      expect(row.revisedClauses).toEqual([row.revised!.match]);
      expect(row.originalClauses).toEqual([]);
    }
    expect(token.reading.rows[0]!.revised!.match).toBe("nonmatch");
    expect(token.reading.rows[1]!.revised!.match).toBe("unknown");
    expect(token.reading.rows[1]!.original.failure).toContain("companyFacts:");
    expect(f.screen.getSnapshot()).toBe(before);
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.resolve).toHaveBeenCalledOnce();
    token.cancel();
    expect(token.apply()).toBeNull();
    expect(f.screen.getSnapshot()).toBe(before);
  });
  it("atomically adopts evaluations and preserves source identity, clocks and Research/Back", async () => {
    const f = await fixture();
    let state = f.screen.getSnapshot();
    f.screen.toggleShortlist(state, state.run!.rows[0]!);
    state = f.screen.getSnapshot();
    f.screen.selectComparison(state, "left", state.run!.rows[0]!);
    state = f.screen.getSnapshot();
    f.screen.selectComparison(state, "right", state.run!.rows[1]!);
    state = f.screen.getSnapshot();
    const run = state.run!;
    const token = f.screen.captureRefinement(
      state,
      refinedCriteria,
      refinementTime,
    )!;
    const installed = token.apply()!;
    const next = installed.run!;
    expect(token.apply()).toBeNull();
    expect(installed.shortlist).toEqual([]);
    expect(installed.comparison).toEqual({ left: null, right: null });
    expect(next.handle).toBe(run.handle);
    expect(next.startedAt).toBe(run.startedAt);
    expect(next.completedAt).toBe(run.completedAt);
    expect(next.status).toBe(run.status);
    expect(next.refinedAt).toBe(refinementTime);
    expect(next.criteriaRevision).not.toBe(run.criteriaRevision);
    expect(next.selectionRevision).toBe(run.selectionRevision);
    for (const [i, row] of next.rows.entries()) {
      expect(row.report).toBe(run.rows[i]!.report);
      expect(row.failure).toBe(run.rows[i]!.failure);
      expect(row.member).toBe(run.rows[i]!.member);
      expect(row.handle).not.toBe(run.rows[i]!.handle);
    }
    const row = next.rows[0]!;
    const capture = { run: next, row, response: row.report!.response! };
    expect(f.screen.admitReport(capture)?.seed.response).toBe(
      row.report!.response,
    );
    f.screen.reconcile(f.digest, false, false);
    f.screen.reconcile(f.digest, true, true);
    expect(f.screen.getSnapshot().run).toBe(next);
    expect(f.screen.canAdmitReport(capture)).toBe(true);
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it("consumes identical previews while keeping exact run, shortlist and pair", async () => {
    const f = await fixture();
    let s = f.screen.getSnapshot();
    f.screen.toggleShortlist(s, s.run!.rows[0]!);
    s = f.screen.getSnapshot();
    f.screen.selectComparison(s, "left", s.run!.rows[0]!);
    s = f.screen.getSnapshot();
    const token = f.screen.captureRefinement(
      s,
      structuredClone(s.criteria),
      refinementTime,
    )!;
    expect(token.reading.unchanged).toBe(true);
    expect(token.apply()).toBe(s);
    expect(f.screen.getSnapshot()).toBe(s);
    expect(s.run!.refinedAt).toBeUndefined();
    expect(token.apply()).toBeNull();
  });
  it("retains all unread rows and the original cancellation time", async () => {
    const f = await fixture("cancelled");
    const s = f.screen.getSnapshot();
    const token = f.screen.captureRefinement(
      s,
      refinedCriteria,
      refinementTime,
    )!;
    expect(token.reading.rows[1]!.revised).toBeNull();
    expect(token.reading.rows[1]!.revisedClauses).toEqual([null]);
    expect(token.reading.rows[1]!.original.report).toBeNull();
    const next = token.apply()!.run!;
    expect(next.status).toBe("cancelled");
    expect(next.completedAt).toBe(s.run!.completedAt);
    expect(next.rows[1]!.evaluation).toBeNull();
    expect(f.read).toHaveBeenCalledOnce();
  });
  it.each(["", "NaN", "1e3", "-", "1.2.3"])(
    "refuses invalid raw threshold %s without changing the screen",
    async (value) => {
      const f = await fixture();
      const s = f.screen.getSnapshot();
      expect(
        f.screen.captureRefinement(
          s,
          {
            ...refinedCriteria,
            clauses: [{ ...refinedCriteria.clauses[0], value }],
          },
          refinementTime,
        ),
      ).toBeNull();
      expect(f.screen.getSnapshot()).toBe(s);
    },
  );
  it("preserves raw decimals and refuses excess clauses or invalid evaluation clocks", async () => {
    const f = await fixture();
    const s = f.screen.getSnapshot();
    const value = {
      ...refinedCriteria,
      clauses: [{ ...refinedCriteria.clauses[0], value: "1.00" }],
    };
    const token = f.screen.captureRefinement(s, value, refinementTime);
    expect(token?.reading.criteria.clauses[0]!.value).toBe("1.00");
    expect(
      f.screen.captureRefinement(
        s,
        { ...value, clauses: Array(8).fill(value.clauses[0]) },
        refinementTime,
      ),
    ).toBeNull();
    expect(f.screen.captureRefinement(s, value, "not-a-time")).toBeNull();
  });
  it.each([
    "staged",
    "criteriaABA",
    "selectionABA",
    "catalogABA",
    "routeABA",
    "access",
    "retire",
  ])("permanently refuses %s", async (boundary) => {
    const f = await fixture();
    const s = f.screen.getSnapshot();
    const token = f.screen.captureRefinement(
      s,
      refinedCriteria,
      refinementTime,
    )!;
    if (boundary === "staged") f.screen.stageCriteria(s);
    if (boundary === "criteriaABA") {
      f.screen.setCriteria(s, refinedCriteria);
      f.screen.setCriteria(f.screen.getSnapshot(), s.criteria);
    }
    if (boundary === "selectionABA") {
      f.screen.select(s, s.selected[0]!, false);
      f.screen.select(f.screen.getSnapshot(), s.selected[0]!, true);
    }
    if (boundary === "catalogABA") {
      f.screen.reconcile(null, true, true);
      f.screen.reconcile(f.digest, true, true);
    }
    if (boundary === "routeABA") {
      f.screen.reconcile(f.digest, false, false);
      f.screen.reconcile(f.digest, true, true);
    }
    if (boundary === "access") f.screen.reconcile(f.digest, true, false);
    if (boundary === "retire") f.screen.retire();
    expect(token.isCurrent()).toBe(false);
    expect(token.apply()).toBeNull();
    expect(
      f.screen.captureRefinement(s, refinedCriteria, refinementTime),
    ).toBeNull();
  });
  it("refuses copied or reordered foreign states and running work", async () => {
    const f = await fixture();
    const s = f.screen.getSnapshot();
    expect(
      f.screen.captureRefinement({ ...s }, refinedCriteria, refinementTime),
    ).toBeNull();
    const pending = f.screen.run(s);
    expect(f.screen.canRefine(f.screen.getSnapshot())).toBe(false);
    f.screen.cancel();
    await pending;
    expect(
      prepareFinancialScreenRefinement(
        { ...s.run!, status: "running" },
        refinedCriteria,
        refinementTime,
      ),
    ).toBeNull();
  });
  it("consumes before screen listeners and refuses an installation replaced during publication", async () => {
    const f = await fixture();
    const token = f.screen.captureRefinement(
      f.screen.getSnapshot(),
      refinedCriteria,
      refinementTime,
    )!;
    let replay: unknown;
    const off = f.screen.subscribe(() => {
      replay = token.apply();
    });
    expect(token.apply()).not.toBeNull();
    expect(replay).toBeNull();
    off();
    const next = f.screen.captureRefinement(
      f.screen.getSnapshot(),
      { clauses: [], sort: { field: "symbol", direction: "asc" } },
      refinementTime,
    )!;
    const off2 = f.screen.subscribe(() => f.screen.retire());
    expect(next.apply()).toBeNull();
    off2();
  });
});
