import { afterEach, expect, it, vi } from "vitest";
import { financialScreenRefinementFixture as fixture } from "./test-financial-screen-refinement-fixture";
import { refinedCriteria } from "./test-financial-screen-refinement-fixture";
import { TrialApiError } from "./api";
import { ManagedAnnualReportError } from "./managed-api";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";

afterEach(() => vi.useRealTimers());
it("keeps a stopped dispatched failure distinct from the next unattempted row", async () => {
  const f = await fixture();
  f.read.mockRejectedValueOnce(new ManagedAnnualReportError("not_configured"));
  const token = f.screen.capturePassReview(
    f.screen.getSnapshot(),
    new Date().toISOString(),
  )!;
  const work = token.run();
  await vi.runAllTimersAsync();
  const result = await work;
  expect(result!.run!.status).toBe("stopped");
  expect(result!.run!.rows[0]!.failure).toBe("not_configured");
  expect(result!.run!.rows[0]!.attempt!.status).toBe("completed");
  expect(result!.run!.rows[1]!.report).toBeNull();
  expect(result!.run!.rows[1]!.attempt).toBeUndefined();
  expect(f.read).toHaveBeenCalledTimes(3);
  expect(token.plan.sourceRun.rows.every((row) => row.report?.response)).toBe(
    true,
  );
});
it("previews without reads, consumes once and retains one complete baseline across a fresh pass", async () => {
  const f = await fixture();
  const before = f.screen.getSnapshot();
  const capture = f.screen.capturePassReview(before, new Date().toISOString())!;
  expect(capture.plan.sourceRun).toBe(before.run);
  expect(f.read).toHaveBeenCalledTimes(2);
  const running = capture.run();
  expect(capture.isCurrent()).toBe(false);
  expect(await capture.run()).toBeNull();
  expect(f.screen.getSnapshot().run!.handle).toBe(capture.runHandle);
  expect(capture.runHandle).not.toBe(before.run!.handle);
  await vi.runAllTimersAsync();
  const after = await running;
  expect(after!.run!.status).toBe("completed");
  expect(after!.run!.rows.map((r) => r.report!.response)).toEqual(f.packets);
  expect(capture.plan.sourceRun).toBe(before.run);
  expect(capture.plan.sourceRun.rows[0]!.report).toBe(
    before.run!.rows[0]!.report,
  );
  expect(f.read).toHaveBeenCalledTimes(4);
  expect(after!.run).not.toHaveProperty("sourceRun");
});

it.each([
  "staged",
  "criteriaABA",
  "selectionABA",
  "routeABA",
  "catalogABA",
  "retire",
])("refuses %s without reads", async (kind) => {
  const f = await fixture(),
    s = f.screen.getSnapshot();
  const t = f.screen.capturePassReview(s, new Date().toISOString())!;
  if (kind === "staged") f.screen.stageCriteria(s);
  if (kind === "criteriaABA") {
    f.screen.setCriteria(s, refinedCriteria);
    f.screen.setCriteria(f.screen.getSnapshot(), s.criteria);
  }
  if (kind === "selectionABA") {
    f.screen.select(s, s.selected[1]!, false);
    f.screen.select(f.screen.getSnapshot(), s.selected[1]!, true);
  }
  if (kind === "routeABA") {
    f.screen.reconcile(f.digest, false, false);
    f.screen.reconcile(f.digest, true, true);
  }
  if (kind === "catalogABA") {
    f.screen.reconcile(null, true, true);
    f.screen.reconcile(f.digest, true, true);
  }
  if (kind === "retire") f.screen.retire();
  expect(t.isCurrent()).toBe(false);
  expect(await t.run()).toBeNull();
  expect(f.read).toHaveBeenCalledTimes(2);
});
it("clears old shortlist/pair once, preserves full prior values and admits only current Research", async () => {
  const f = await fixture("partial"),
    prior = f.screen.getSnapshot().run!;
  f.screen.toggleShortlist(f.screen.getSnapshot(), prior.rows[0]!);
  f.screen.selectComparison(f.screen.getSnapshot(), "left", prior.rows[0]!);
  const state = f.screen.getSnapshot(),
    t = f.screen.capturePassReview(state, new Date().toISOString())!;
  expect(
    f.screen.capturePassReview({ ...state }, new Date().toISOString()),
  ).toBeNull();
  expect(f.screen.capturePassReview(state, "bad")).toBeNull();
  const work = t.run();
  expect(f.screen.getSnapshot().shortlist).toEqual([]);
  expect(f.screen.getSnapshot().comparison).toEqual({
    left: null,
    right: null,
  });
  await vi.advanceTimersByTimeAsync(19999);
  expect(f.read).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(f.read).toHaveBeenCalledTimes(3);
  await vi.runAllTimersAsync();
  const current = (await work)!.run!;
  expect(t.plan.sourceRun).toBe(prior);
  expect(prior.rows.map((r) => r.report!.response)).toEqual(f.packets);
  expect(current.rows.map((r) => r.report!.response)).toEqual(f.packets);
  expect(current.rows[0]!.evaluatedAt).not.toBe(prior.rows[0]!.evaluatedAt);
  expect(current.rows[0]!.report!.response!.evidence).toEqual(
    prior.rows[0]!.report!.response!.evidence,
  );
  for (const run of [prior, current]) {
    const row = run.rows[0]!;
    expect(
      f.screen.canAdmitReport({ run, row, response: row.report!.response! }),
    ).toBe(run === current);
  }
});
it("keeps unavailable outcomes distinct from nonmatches, and the prior packet does not fill a failed current read", async () => {
  const f = await fixture();
  f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
  const t = f.screen.capturePassReview(
    f.screen.getSnapshot(),
    new Date().toISOString(),
  )!;
  const work = t.run();
  await vi.runAllTimersAsync();
  const run = (await work)!.run!;
  expect(run.rows[0]!.failure).toBe("unavailable");
  expect(run.rows[0]!.report!.response).toBeNull();
  expect(run.rows[0]!.evaluation).toBeNull();
  expect(t.plan.sourceRun.rows[0]!.report!.response).toBe(f.packets[0]);
  expect(run.rows[1]!.report!.response).toBe(f.packets[1]);
});
it("cancelled baseline still previews the full order; late cancelled responses cannot replace current rows", async () => {
  const f = await fixture("cancelled");
  let resolve!: (value: PersonalSecAnnualCanonicalResponseDto) => void;
  f.read.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const t = f.screen.capturePassReview(
    f.screen.getSnapshot(),
    new Date().toISOString(),
  )!;
  expect(t.plan.requests).toEqual(t.plan.sourceRun.rows.map((r) => r.member));
  const work = t.run();
  await vi.advanceTimersByTimeAsync(20000);
  t.cancel();
  await work;
  const cancelled = f.screen.getSnapshot();
  expect(cancelled.run!.status).toBe("cancelled");
  expect(cancelled.run!.rows.every((r) => r.report === null)).toBe(true);
  expect(cancelled.run!.rows[0]!.attempt).toMatchObject({
    status: "cancelled",
  });
  expect(cancelled.run!.rows[1]!.attempt).toBeUndefined();
  resolve(f.packets[0]);
  await vi.advanceTimersByTimeAsync(0);
  expect(f.screen.getSnapshot()).toBe(cancelled);
  expect(t.plan.sourceRun.rows[0]!.report!.response).toBe(f.packets[0]);
  expect(await t.run()).toBeNull();
});

it("uses each row's actual evaluation clock after refinement and a later missing-read continuation", async () => {
  const f = await fixture("cancelled");
  const refinedAt = new Date().toISOString();
  const revised = f.screen
    .captureRefinement(f.screen.getSnapshot(), refinedCriteria, refinedAt)!
    .apply()!;
  expect(revised.run!.rows[0]!.evaluatedAt).toBe(refinedAt);
  expect(revised.run!.rows[1]!.evaluatedAt).toBeNull();
  const work = f.screen.captureContinuation(revised, refinedAt)!.run();
  await vi.runAllTimersAsync();
  await work;
  const current = f.screen.getSnapshot(),
    run = current.run!;
  expect(run.rows[0]!.evaluatedAt).toBe(refinedAt);
  expect(run.rows[1]!.evaluatedAt).toBe(
    run.continuations![0]!.attempts[0]!.evaluatedAt,
  );
  expect(Date.parse(run.rows[1]!.evaluatedAt!)).toBeGreaterThan(
    Date.parse(refinedAt),
  );
  expect(
    f.screen.capturePassReview(current, new Date().toISOString())!.plan
      .sourceRun,
  ).toBe(run);
});
