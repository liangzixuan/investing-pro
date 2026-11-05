import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { finishedDueCheckReportFixture } from "./test-due-check-evidence-report-fixture";
import { sourceConnectedFixture } from "./test-source-connected-workspace-fixture";
import { createManagedDueCheckEvidenceReportSource } from "./managed-due-check-evidence-report-source";
import {
  isPreparedDueCheckEvidenceReport,
  prepareDueCheckEvidenceReport,
} from "./due-check-evidence-report";
import { captureFollowupsReportContext } from "./managed-followups-review-report-admission";
const cleanups: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
});
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((f) => f());
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function setup(partial = false) {
  const f = await finishedDueCheckReportFixture(partial);
  cleanups.push(f.dispose);
  return f;
}
function reads(f: Awaited<ReturnType<typeof setup>>) {
  return [
    f.api.eodHistory,
    f.api.annualReport,
    f.api.recentFilings,
    f.api.interimReport,
  ].map((fn) => vi.mocked(fn).mock.calls.length);
}
it.each([false, true])(
  "captures full ordered evidence and final authored entries without changing original clocks or partial=%s outcomes",
  async (partial) => {
    const f = await setup(partial),
      w = f.workspace;
    const before = reads(f),
      state = w.followups.coordinator.getSnapshot();
    const snapshots = [
      w.coordinator.getSnapshot(),
      w.portfolio.coordinator.getSnapshot(),
      w.valuation.getSnapshot(),
    ];
    vi.setSystemTime(new Date("2026-11-04T14:00:00Z"));
    const capture = f.source.capture()!;
    expect(capture).not.toBeNull();
    expect(capture.current()).toBe(true);
    const r = capture.report;
    expect(r.preparedAt).toBe("2026-11-04T14:00:00.000Z");
    expect(r.assessedOn).toBe("2026-11-04");
    expect(r.rows).toEqual(
      w.reviewEvidence
        .getSnapshot()
        .rows.map(({ entry, reading }) => ({ entry, reading })),
    );
    expect(r.rows.map((row) => row.entry.id)).toEqual(
      f.review.getSnapshot().chosen.map((row) => row.entry.id),
    );
    expect(r.rows[0]!.reading).toEqual(f.firstReading);
    expect(r.rows[0]!.reading).not.toBe(f.firstReading);
    expect(r.rows[0]!.entry.result).toContain("Final authored assessment");
    expect(r.rows[0]!.reading!.check.result).not.toBe(r.rows[0]!.entry.result);
    expect(r.rows[0]!.entry.status).toBe("completed");
    expect(r.rows[0]!.reading!.check.status).toBe("open");
    expect(r.rows[0]!.reading!.capturedAt).toBe("2026-11-04T12:00:00.000Z");
    expect(r.rows[0]!.reading!.evidence.price!.response!.completedAt).toBe(
      "2026-09-20T00:00:01.000Z",
    );
    expect(r.rows[1]!.reading!.evidence.annual!.response).toEqual(f.annual[0]);
    expect(r.rows[1]!.reading!.evidence.interim!.response).toEqual(
      f.interim[0],
    );
    expect(r.rows[2]!.reading).toBeNull();
    expect(r.rows.map((row) => row.entry.id)).not.toContain(f.untouched.id);
    expect(r.resource).toEqual({
      baseVersion: state.baseVersion,
      savedVersion: state.saved!.version,
      dirty: true,
      catalog: w.getSnapshot().snapshot!.snapshotSha256,
    });
    expect(Object.isFrozen(r.rows[1]!.reading!.evidence.annual!.response)).toBe(
      true,
    );
    expect(isPreparedDueCheckEvidenceReport(r)).toBe(true);
    expect(isPreparedDueCheckEvidenceReport(structuredClone(r))).toBe(false);
    expect(JSON.stringify(r)).not.toContain('"handle"');
    expect(reads(f)).toEqual(before);
    expect(f.api.load).not.toHaveBeenCalled();
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
    expect(w.followups.coordinator.getSnapshot()).toBe(state);
    expect([
      w.coordinator.getSnapshot(),
      w.portfolio.coordinator.getSnapshot(),
      w.valuation.getSnapshot(),
    ]).toEqual(snapshots);
    if (partial)
      expect(
        r.rows[0]!.reading!.sourcePass.rows.map((row) => row.disposition),
      ).toEqual(["loaded", "failed", "not_attempted", "not_attempted"]);
  },
);
it.each([
  "file",
  "route",
  "view",
  "load",
  "save",
  "catalog",
  "session",
  "new-review",
  "assessment-ABA",
  "dispose",
] as const)(
  "latches retirement on %s, including equal-value restoration",
  async (kind) => {
    const f = await setup(),
      w = f.workspace,
      captured = f.source.capture()!;
    expect(captured).not.toBeNull();
    if (kind === "file") {
      const token = {};
      w.followups.beginDraftFileActivity(token);
      w.followups.endDraftFileActivity(token);
    }
    if (kind === "route") {
      f.setRouteActive(false);
      f.setRouteActive(true);
    }
    if (kind === "view") {
      w.setView("markets");
      w.setView("followups");
    }
    if (kind === "load") await w.followups.coordinator.load();
    if (kind === "save") await w.followups.coordinator.save();
    if (kind === "catalog") await w.refreshCatalog();
    if (kind === "session") w.sessionOwner.dispose();
    if (kind === "new-review") f.review.enter();
    if (kind === "assessment-ABA") {
      const draft = w.followups.coordinator.getSnapshot().draft!;
      w.followups.coordinator.replaceDraft({
        ...draft,
        entries: draft.entries.map((entry, i) =>
          i ? entry : { ...entry, result: "changed" },
        ),
      });
      w.followups.coordinator.replaceDraft(draft);
    }
    if (kind === "dispose") f.source.dispose();
    expect(captured.current()).toBe(false);
    expect(captured.current()).toBe(false);
  },
);
it("refuses unfinished and mismatched ordered owner rows without projecting unrelated checks", async () => {
  const f = await setup(),
    w = f.workspace;
  const context = captureFollowupsReportContext(w, () => true)!;
  const review = f.review.getSnapshot(),
    evidence = w.reviewEvidence.getSnapshot();
  expect(
    prepareDueCheckEvidenceReport(
      { ...review, phase: "reviewing" },
      evidence,
      context,
      new Date().toISOString(),
    ),
  ).toBeNull();
  expect(
    prepareDueCheckEvidenceReport(
      review,
      { ...evidence, rows: [...evidence.rows].reverse() },
      context,
      new Date().toISOString(),
    ),
  ).toBeNull();
  expect(
    prepareDueCheckEvidenceReport(
      review,
      { ...evidence, rows: evidence.rows.slice(1) },
      context,
      new Date().toISOString(),
    ),
  ).toBeNull();
  expect(
    prepareDueCheckEvidenceReport(review, evidence, context, "invalid clock"),
  ).toBeNull();
});
it("refuses reentrant clock capture after retirement and never reinstalls a stale lease", async () => {
  const f = await setup();
  const source = createManagedDueCheckEvidenceReportSource(
    f.workspace,
    () => true,
    () => {
      source.dispose();
      return new Date();
    },
  );
  expect(source.capture()).toBeNull();
  expect(source.canCapture()).toBe(false);
});
it("does not publish or read sources when readiness and controller snapshots are inspected repeatedly", async () => {
  const f = await setup();
  const before = reads(f);
  const notify = vi.fn(() => {
    f.source.canCapture();
  });
  f.source.subscribe(notify);
  for (let i = 0; i < 5; ++i) {
    expect(f.source.canCapture()).toBe(true);
    f.source.reconcile();
  }
  expect(notify).not.toHaveBeenCalled();
  f.setRouteActive(false);
  expect(notify).toHaveBeenCalledOnce();
  f.setRouteActive(true);
  expect(notify).toHaveBeenCalledTimes(2);
  expect(reads(f)).toEqual(before);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("readiness rejects a mismatched finished evidence roster rather than enabling a known refusal", async () => {
  const f = await setup();
  const actual = f.workspace.reviewEvidence.getSnapshot();
  const read = vi.spyOn(f.workspace.reviewEvidence, "getSnapshot");
  read.mockReturnValue({ ...actual, rows: actual.rows.slice(1) });
  expect(f.source.canCapture()).toBe(false);
  expect(f.source.capture()).toBeNull();
  read.mockReturnValue({
    ...actual,
    rows: actual.rows.map((row, i) =>
      i
        ? row
        : {
            ...row,
            reading: { ...row.reading!, capturedAt: "\ud800" },
          },
    ),
  });
  expect(f.source.canCapture()).toBe(false);
  expect(f.source.capture()).toBeNull();
  read.mockRestore();
  expect(f.source.canCapture()).toBe(true);
});
it("preserves a newer reentrant source state when a subscriber retires the old route", async () => {
  const f = await setup();
  const old = f.source.capture()!;
  let entered = false;
  f.source.subscribe(() => {
    if (!entered) {
      entered = true;
      f.setRouteActive(true);
    }
  });
  f.setRouteActive(false);
  expect(old.current()).toBe(false);
  const replacement = f.source.capture()!;
  expect(replacement.current()).toBe(true);
  expect(replacement.report).not.toBe(old.report);
});
it("retains a cancelled source pass as cancelled, ignores its late response, and does not infer refreshed evidence", async () => {
  const f = await sourceConnectedFixture();
  cleanups.push(f.dispose);
  const source = createManagedDueCheckEvidenceReportSource(
    f.workspace,
    () => true,
  );
  cleanups.push(source.dispose);
  f.start();
  expect(source.capture()).toBeNull();
  const visit = await f.open();
  let resolve!: (value: Awaited<ReturnType<typeof f.api.eodHistory>>) => void;
  const packet = await f.api.eodHistory(
    {
      listingId: visit.selection.listing.listingId,
      range: "1y",
      catalogSnapshotSha256: visit.selection.catalogSnapshotSha256,
    },
    new AbortController().signal,
  );
  vi.mocked(f.api.eodHistory).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = f.run();
  f.workspace.cancelCompanySourcePass(visit);
  const cancelled = f.capture();
  resolve(packet);
  await pending;
  f.workspace.returnFromResearch();
  f.review.finish(f.review.getSnapshot());
  const report = source.capture()!.report;
  expect(report.rows[0]!.reading).toEqual(cancelled);
  expect(report.rows[0]!.reading!.evidence.price!.response).toBeNull();
  expect(report.rows.slice(1).every((row) => row.reading === null)).toBe(true);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
