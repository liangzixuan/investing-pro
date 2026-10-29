import { afterEach, describe, expect, it, vi } from "vitest";
import { createScreenComparisonReportFixture } from "./screen-comparison-report-fixture";
import {
  isPreparedScreenComparisonReport,
  prepareScreenComparisonReport,
} from "./screen-comparison-report";
import { eodSelection } from "./eod-history-fixture";
import { DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA } from "./managed-financial-screen-results";
afterEach(() => vi.useRealTimers());
describe("screen-owned comparison report capture", () => {
  it("captures both complete independently dated graphs without reading or changing shortlist", async () => {
    const f = await createScreenComparisonReportFixture();
    const before = f.model.getSnapshot();
    const capture = f.capture()!;
    expect(capture).not.toBeNull();
    expect(capture.current()).toBe(true);
    expect(isPreparedScreenComparisonReport(capture.report)).toBe(true);
    expect(isPreparedScreenComparisonReport({ ...capture.report })).toBe(false);
    expect(capture.report.left.response).toBe(f.left);
    expect(capture.report.right.response).toBe(f.right);
    expect(capture.report.left.response.evidence.target).not.toEqual(
      capture.report.right.response.evidence.target,
    );
    for (const side of ["left", "right"] as const) {
      expect(
        capture.report[side].view.statements.statements.map((item) => item.id),
      ).toEqual(["income_statement", "balance_sheet", "cash_flow"]);
      expect(Object.isFrozen(capture.report[side].view.statements)).toBe(true);
    }
    expect(capture.report.criteria).toEqual(before.run!.criteria);
    expect(capture.report.catalogSnapshotSha256).toBe(
      before.catalogSnapshotSha256,
    );
    expect(capture.report.run).toEqual({
      status: before.run!.status,
      startedAt: before.run!.startedAt,
      completedAt: before.run!.completedAt,
    });
    expect(f.model.getSnapshot()).toBe(before);
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.resolve).toHaveBeenCalledOnce();
    f.model.toggleShortlist(before, f.rows[0]!);
    expect(capture.current()).toBe(true);
  });
  it.each([
    "not a date",
    "2026-02-30T00:00:00.000Z",
    "2026-09-20T00:00:00Z",
    "2026-09-20T01:00:00.000+01:00",
  ])("refuses noncanonical preparation %s", async (value) => {
    const f = await createScreenComparisonReportFixture();
    expect(f.model.captureComparisonReport(value)).toBeNull();
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it.each(["pair", "criteria", "catalog", "inactive", "access", "retire"])(
    "permanently retires capture on %s, including restored values",
    async (cause) => {
      const f = await createScreenComparisonReportFixture();
      const capture = f.capture()!;
      const digest = eodSelection.catalogSnapshotSha256;
      if (cause === "pair") {
        f.choose("left", null);
        f.choose("left", f.rows[0]!);
      }
      if (cause === "criteria") {
        f.model.stageCriteria(f.model.getSnapshot());
        f.model.setCriteria(
          f.model.getSnapshot(),
          DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA,
        );
      }
      if (cause === "catalog") {
        f.model.reconcile(`sha256:${"b".repeat(64)}`, true, true);
        f.model.reconcile(digest, true, true);
      }
      if (cause === "inactive") {
        f.model.reconcile(digest, false, false);
        expect(
          f.model.captureComparisonReport(new Date().toISOString()),
        ).toBeNull();
        f.model.reconcile(digest, true, true);
        expect(f.model.getSnapshot().comparison.left).toBe(f.rows[0]);
      }
      if (cause === "access") {
        f.model.reconcile(digest, true, false);
        f.model.reconcile(digest, true, true);
      }
      if (cause === "retire") f.model.retire();
      expect(capture.current()).toBe(false);
      expect(f.read).toHaveBeenCalledTimes(2);
    },
  );
  it("preserves a valid partially sourced canonical packet and its unavailable qualifications", async () => {
    const f = await createScreenComparisonReportFixture({
      leftOptions: { mode: "source-unavailable" },
    });
    const capture = f.capture()!;
    expect(capture).not.toBeNull();
    expect(capture.report.left.response).toBe(f.left);
    expect(capture.report.left.failure).toContain("unavailable");
    expect(capture.report.left.view.statements).toEqual(
      f.model.getSnapshot().comparison.left!.report!.view!.statements,
    );
    expect(capture.report.left.response.evidence.generation).toEqual(
      f.left.evidence.generation,
    );
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it.each([
    "listingId",
    "symbol",
    "issuerId",
    "issuerName",
    "securityId",
    "securityName",
    "shareClassId",
    "shareClassName",
    "exchangeMic",
    "country",
    "instrumentType",
  ] as const)(
    "refuses a copied row with changed full listing field %s",
    async (field) => {
      const f = await createScreenComparisonReportFixture();
      const state = f.model.getSnapshot();
      const original = f.rows[0]!;
      const row = {
        ...original,
        member: {
          ...original.member,
          listing: { ...original.member.listing, [field]: "foreign" },
        },
      } as typeof original;
      const run = { ...state.run!, rows: [row, f.rows[1]!] };
      expect(
        prepareScreenComparisonReport({
          preparedAt: new Date().toISOString(),
          catalogSnapshotSha256: state.catalogSnapshotSha256!,
          run,
          left: row,
          right: f.rows[1]!,
        }),
      ).toBeNull();
      f.choose("left", row);
      expect(f.model.getSnapshot().comparison.left).toBe(original);
    },
  );
  it("refuses foreign source/catalog/CIK and copied nonmember rows while ignoring a forged derived view", async () => {
    const f = await createScreenComparisonReportFixture();
    const state = f.model.getSnapshot();
    const left = f.rows[0]!;
    const right = f.rows[1]!;
    const input = {
      preparedAt: new Date().toISOString(),
      catalogSnapshotSha256: state.catalogSnapshotSha256!,
      run: state.run!,
      left,
      right,
    };
    expect(
      prepareScreenComparisonReport({ ...input, left: { ...left } }),
    ).toBeNull();
    expect(
      prepareScreenComparisonReport({
        ...input,
        catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
      }),
    ).toBeNull();
    const foreign = { ...left, report: { ...left.report!, response: f.right } };
    expect(
      prepareScreenComparisonReport({
        ...input,
        run: { ...input.run, rows: [foreign, right] },
        left: foreign,
      }),
    ).toBeNull();
    const wrongCik = {
      ...left,
      report: {
        ...left.report!,
        selection: { ...left.report!.selection!, cik: "0000000999" },
      },
    };
    expect(
      prepareScreenComparisonReport({
        ...input,
        run: { ...input.run, rows: [wrongCik, right] },
        left: wrongCik,
      }),
    ).toBeNull();
    const wrongView = { ...left, report: { ...left.report!, view: null } };
    const captured = prepareScreenComparisonReport({
      ...input,
      run: { ...input.run, rows: [wrongView, right] },
      left: wrongView,
    })!;
    expect(captured.left.view).toEqual(left.report!.view);
    expect(captured.left.view).not.toBe(left.report!.view);
  });
  it("notifies and permanently retires after catalog removal even when the empty reset already matches inactive flags", async () => {
    const f = await createScreenComparisonReportFixture();
    const captured = f.capture()!;
    const notify = vi.fn();
    const unsubscribe = f.model.subscribe(notify);
    f.model.reconcile(null, false, false);
    expect(notify).toHaveBeenCalled();
    expect(captured.current()).toBe(false);
    expect(f.capture()).toBeNull();
    f.model.reconcile(eodSelection.catalogSnapshotSha256, true, true);
    await f.model.loadUniverse(f.model.getSnapshot());
    const running = f.model.run(f.model.getSnapshot());
    await vi.advanceTimersByTimeAsync(40_000);
    await running;
    const rows = f.model.getSnapshot().run!.rows;
    f.choose("left", rows[0]!);
    f.choose("right", rows[1]!);
    expect(f.capture()!.current()).toBe(true);
    expect(f.capture()!.report.left.response).toBe(
      captured.report.left.response,
    );
    expect(captured.current()).toBe(false);
    unsubscribe();
  });
  it("refuses missing pairs and forged rows without inspecting getters, and retires on new runs", async () => {
    const f = await createScreenComparisonReportFixture();
    const capture = f.capture()!;
    const getter = vi.fn();
    f.choose("left", {
      ...f.rows[0]!,
      get report() {
        getter();
        return f.rows[0]!.report;
      },
    });
    expect(getter).not.toHaveBeenCalled();
    expect(f.model.getSnapshot().comparison.left).toBe(f.rows[0]);
    f.choose("right", null);
    expect(f.capture()).toBeNull();
    f.choose("right", f.rows[1]!);
    const task = f.model.run(f.model.getSnapshot());
    expect(f.capture()).toBeNull();
    expect(capture.current()).toBe(false);
    f.model.cancel();
    await task;
  });
});
