import { afterEach, describe, expect, it, vi } from "vitest";
import {
  financialScreenRefinementFixture as fixture,
  refinedCriteria,
} from "./test-financial-screen-refinement-fixture";
import { prepareFinancialScreenContinuation } from "./managed-financial-screen-continuation";
import { evaluateManagedFinancialScreenRow } from "./managed-financial-screen-results";
import { TrialApiError } from "./api";
import {
  ManagedAnnualReportError,
  ManagedCatalogChangedError,
  ManagedSecCooldownError,
} from "./managed-api";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";

afterEach(() => vi.useRealTimers());
const now = () => new Date().toISOString();
describe("reviewed missing Annual reads", () => {
  it("retains full packets/clocks, reads only the missing exact member and clears old actions once", async () => {
    const f = await fixture("cancelled");
    const original = f.screen.getSnapshot().run!;
    f.screen.toggleShortlist(f.screen.getSnapshot(), original.rows[0]!);
    f.screen.selectComparison(
      f.screen.getSnapshot(),
      "left",
      original.rows[0]!,
    );
    const state = f.screen.getSnapshot();
    const token = f.screen.captureContinuation(state, now())!;
    expect(token.plan.sourceRun).toBe(original);
    expect(token.plan.rows.map((r) => r.row)).toEqual(original.rows);
    expect(token.plan.rows.map((r) => r.disposition)).toEqual([
      "retained",
      "missing",
    ]);
    expect(token.plan.requests).toEqual([original.rows[1]!.member]);
    expect(f.read).toHaveBeenCalledOnce();
    expect(f.resolve).toHaveBeenCalledOnce();
    const running = token.run();
    expect(await token.run()).toBeNull();
    expect(f.screen.getSnapshot().shortlist).toEqual([]);
    expect(f.screen.getSnapshot().comparison).toEqual({
      left: null,
      right: null,
    });
    expect(
      f.screen.canAdmitReport({
        run: original,
        row: original.rows[0]!,
        response: original.rows[0]!.report!.response!,
      }),
    ).toBe(false);
    await vi.advanceTimersByTimeAsync(19999);
    expect(f.read).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    const settled = await running;
    expect(settled).not.toBeNull();
    const run = settled!.run!;
    expect([
      run.handle,
      run.startedAt,
      run.completedAt,
      run.status,
      run.refinedAt,
    ]).toEqual([
      original.handle,
      original.startedAt,
      original.completedAt,
      original.status,
      original.refinedAt,
    ]);
    expect(run.rows.map((r) => r.member)).toEqual(
      original.rows.map((r) => r.member),
    );
    expect(run.rows[0]!.report).toBe(original.rows[0]!.report);
    expect(run.rows[0]!.evaluation).toBe(original.rows[0]!.evaluation);
    expect(run.rows[0]!.handle).not.toBe(original.rows[0]!.handle);
    expect(run.rows[1]!.report!.response).toBe(f.packets[1]);
    expect(f.read.mock.calls.map(([request]) => request.listingId)).toEqual(
      f.listings.map((l) => l.listingId),
    );
    expect(f.resolve).toHaveBeenCalledOnce();
    const pass = run.continuations![0]!;
    expect(pass.requests).toBe(token.plan.requests);
    expect(pass.status).toBe("completed");
    expect(pass.attempts).toHaveLength(1);
    expect(pass.attempts[0]!.result).toBe(run.rows[1]);
    expect(pass.attempts[0]!.evaluatedAt).toBe(pass.completedAt);
    expect(pass.startedAt).toBe(original.completedAt);
    expect(Date.parse(pass.completedAt!) - Date.parse(pass.startedAt)).toBe(
      20000,
    );
    expect(f.screen.canContinue(settled!)).toBe(false);
    const row = run.rows[1]!;
    expect(
      f.screen.admitReport({ run, row, response: row.report!.response! })?.seed
        .response,
    ).toBe(f.packets[1]);
    f.screen.reconcile(f.digest, false, false);
    f.screen.reconcile(f.digest, true, true);
    expect(f.screen.getSnapshot().run).toBe(run);
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it("retains partial and unknown packets rather than treating metric gaps as missing", async () => {
    const f = await fixture("partial");
    f.screen
      .captureRefinement(f.screen.getSnapshot(), refinedCriteria, now())!
      .apply();
    const s = f.screen.getSnapshot();
    expect(s.run!.rows[1]!.report!.response).toBe(f.packets[1]);
    expect(s.run!.rows[1]!.evaluation!.match).toBe("unknown");
    expect(prepareFinancialScreenContinuation(s.run!, now())).toBeNull();
    expect(f.screen.captureContinuation(s, now())).toBeNull();
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it("evaluates new packets with applied raw criteria and records a later evaluation than local refinement", async () => {
    const f = await fixture("cancelled");
    const refinedAt = now();
    f.screen
      .captureRefinement(f.screen.getSnapshot(), refinedCriteria, refinedAt)!
      .apply();
    const s = f.screen.getSnapshot();
    const oldEvaluation = s.run!.rows[0]!.evaluation;
    const token = f.screen.captureContinuation(s, now())!;
    const running = token.run();
    await vi.runAllTimersAsync();
    await running;
    const run = f.screen.getSnapshot().run!;
    expect(run.criteria).toBe(s.criteria);
    expect(run.refinedAt).toBe(refinedAt);
    expect(run.rows[0]!.evaluation).toBe(oldEvaluation);
    expect(run.rows[1]!.evaluation).toEqual(
      evaluateManagedFinancialScreenRow(f.packets[1], refinedCriteria),
    );
    expect(
      Date.parse(run.continuations![0]!.attempts[0]!.evaluatedAt!),
    ).toBeGreaterThan(Date.parse(refinedAt));
    expect(run.rows[1]!.report!.response).toBe(f.packets[1]);
  });
  it("cancels pacing with no attempt, then consumes a new exact preview without a hidden retry", async () => {
    const f = await fixture("cancelled");
    const token = f.screen.captureContinuation(f.screen.getSnapshot(), now())!;
    const running = token.run();
    token.cancel();
    await running;
    await vi.runAllTimersAsync();
    let run = f.screen.getSnapshot().run!;
    expect(run.continuations![0]!.status).toBe("cancelled");
    expect(run.continuations![0]!.attempts).toEqual([]);
    expect(f.read).toHaveBeenCalledOnce();
    expect(await token.run()).toBeNull();
    const next = f.screen.captureContinuation(f.screen.getSnapshot(), now())!;
    const continued = next.run();
    await vi.runAllTimersAsync();
    await continued;
    run = f.screen.getSnapshot().run!;
    expect(run.continuations!.map((p) => p.status)).toEqual([
      "cancelled",
      "completed",
    ]);
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it("cancels in-flight work and rejects a late packet without losing prior packets", async () => {
    const f = await fixture("cancelled");
    let resolve!: (value: PersonalSecAnnualCanonicalResponseDto) => void;
    f.read.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const original = f.screen.getSnapshot().run!;
    const token = f.screen.captureContinuation(f.screen.getSnapshot(), now())!;
    const running = token.run();
    await vi.advanceTimersByTimeAsync(20000);
    expect(f.read).toHaveBeenCalledTimes(2);
    token.cancel();
    await running;
    const cancelled = f.screen.getSnapshot();
    expect(cancelled.run!.continuations![0]!.attempts[0]).toMatchObject({
      status: "cancelled",
      result: null,
      evaluatedAt: null,
    });
    expect(f.read.mock.calls[1]![1].aborted).toBe(true);
    resolve(f.packets[1]);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.screen.getSnapshot()).toBe(cancelled);
    expect(cancelled.run!.rows[0]!.report).toBe(original.rows[0]!.report);
    expect(cancelled.run!.rows[1]!.report).toBeNull();
  });
  it("keeps failed responses missing and requires a separate reviewed pass", async () => {
    const f = await fixture("cancelled");
    f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
    const token = f.screen.captureContinuation(f.screen.getSnapshot(), now())!;
    const running = token.run();
    await vi.runAllTimersAsync();
    await running;
    const s = f.screen.getSnapshot();
    expect(s.run!.rows[1]!.failure).toBe("unavailable");
    expect(s.run!.continuations![0]!.attempts[0]!.result).toBe(s.run!.rows[1]);
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.screen.captureContinuation(s, now())!.plan.requests).toEqual([
      s.run!.rows[1]!.member,
    ]);
  });
  it("does not admit a different listing packet", async () => {
    const f = await fixture("cancelled");
    f.read.mockResolvedValueOnce(f.packets[0]);
    const running = f.screen
      .captureContinuation(f.screen.getSnapshot(), now())!
      .run();
    await vi.runAllTimersAsync();
    await running;
    expect(f.screen.getSnapshot().run!.rows[1]!.report!.response).toBeNull();
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it.each([
    "staged",
    "criteriaABA",
    "selectionABA",
    "routeABA",
    "catalogABA",
    "retire",
  ])("permanently refuses %s", async (boundary) => {
    const f = await fixture("cancelled");
    const s = f.screen.getSnapshot();
    const t = f.screen.captureContinuation(s, now())!;
    if (boundary === "staged") f.screen.stageCriteria(s);
    if (boundary === "criteriaABA") {
      f.screen.setCriteria(s, refinedCriteria);
      f.screen.setCriteria(f.screen.getSnapshot(), s.criteria);
    }
    if (boundary === "selectionABA") {
      f.screen.select(s, s.selected[1]!, false);
      f.screen.select(f.screen.getSnapshot(), s.selected[1]!, true);
    }
    if (boundary === "routeABA") {
      f.screen.reconcile(f.digest, false, false);
      f.screen.reconcile(f.digest, true, true);
    }
    if (boundary === "catalogABA") {
      f.screen.reconcile(null, true, true);
      f.screen.reconcile(f.digest, true, true);
    }
    if (boundary === "retire") f.screen.retire();
    expect(t.isCurrent()).toBe(false);
    expect(await t.run()).toBeNull();
    expect(f.read).toHaveBeenCalledOnce();
  });
  it("refuses forged snapshots and clocks and consumes before reentrant listeners", async () => {
    const f = await fixture("cancelled");
    const s = f.screen.getSnapshot();
    expect(f.screen.captureContinuation({ ...s }, now())).toBeNull();
    expect(f.screen.captureContinuation(s, "bad")).toBeNull();
    const t = f.screen.captureContinuation(s, now())!;
    const repeats: Promise<unknown>[] = [];
    const off = f.screen.subscribe(() => {
      repeats.push(t.run());
    });
    const running = t.run();
    await vi.runAllTimersAsync();
    await running;
    off();
    expect(await Promise.all(repeats)).toEqual(repeats.map(() => null));
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it.each(["not_configured", "catalog_changed", "unauthenticated"] as const)(
    "preserves %s source boundary",
    async (kind) => {
      const f = await fixture("cancelled");
      f.read.mockRejectedValueOnce(
        kind === "not_configured"
          ? new ManagedAnnualReportError(kind)
          : kind === "catalog_changed"
            ? new ManagedCatalogChangedError()
            : new TrialApiError(kind),
      );
      const running = f.screen
        .captureContinuation(f.screen.getSnapshot(), now())!
        .run();
      await vi.runAllTimersAsync();
      await running;
      expect(f.screen.canContinue(f.screen.getSnapshot())).toBe(false);
      expect(f.read).toHaveBeenCalledTimes(2);
      if (kind === "not_configured")
        expect(f.screen.getSnapshot().run!.continuations![0]!.status).toBe(
          "stopped",
        );
    },
  );
  it("honors the shared cooldown on another explicit pass without retrying the rejected attempt", async () => {
    const f = await fixture("cancelled");
    f.read.mockRejectedValueOnce(
      new ManagedSecCooldownError("2026-11-05T10:01:00.000Z"),
    );
    const running = f.screen
      .captureContinuation(f.screen.getSnapshot(), now())!
      .run();
    await vi.advanceTimersByTimeAsync(20000);
    await running;
    expect(f.read).toHaveBeenCalledTimes(2);
    const next = f.screen
      .captureContinuation(f.screen.getSnapshot(), now())!
      .run();
    await vi.advanceTimersByTimeAsync(39999);
    expect(f.read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await next;
    expect(f.read).toHaveBeenCalledTimes(3);
  });
});

it("reviews an all-missing run, keeps completed attempts on cancellation, and never rereads their packets", async () => {
  const f = await fixture("cancelled");
  f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
  f.read.mockRejectedValueOnce(new TrialApiError("unavailable"));
  const fresh = f.screen.run(f.screen.getSnapshot());
  await vi.runAllTimersAsync();
  await fresh;
  const failed = f.screen.getSnapshot();
  expect(failed.run!.rows.every((row) => !row.report?.response)).toBe(true);
  expect(f.screen.canRefine(failed)).toBe(false);
  const token = f.screen.captureContinuation(failed, now())!;
  expect(token.plan.requests).toEqual(failed.selected);
  const beforeCalls = f.read.mock.calls.length;
  const running = token.run();
  await vi.advanceTimersByTimeAsync(20_000);
  expect(f.read).toHaveBeenCalledTimes(beforeCalls + 1);
  f.screen.cancel();
  await running;
  const partial = f.screen.getSnapshot();
  const pass = partial.run!.continuations![0]!;
  expect(pass.status).toBe("cancelled");
  expect(pass.attempts).toHaveLength(1);
  expect(pass.attempts[0]!.result!.report!.response).toBe(f.packets[0]);
  const retained = partial.run!.rows[0]!;
  const next = f.screen.captureContinuation(partial, now())!;
  expect(next.plan.requests).toEqual([partial.selected[1]]);
  const completed = next.run();
  await vi.runAllTimersAsync();
  await completed;
  expect(
    f.read.mock.calls.slice(beforeCalls).map(([request]) => request.listingId),
  ).toEqual(f.listings.map((row) => row.listingId));
  expect(f.screen.getSnapshot().run!.rows[0]!.report).toBe(retained.report);
  expect(f.screen.getSnapshot().run!.rows[0]!.evaluation).toBe(
    retained.evaluation,
  );
  expect(f.resolve).toHaveBeenCalledOnce();
});
