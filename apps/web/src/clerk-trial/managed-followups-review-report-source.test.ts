import type { FollowupsReviewReportDeliveryAdapter } from "./followups-review-report-ports";
import { ManagedFollowupsDraftRecovery } from "./managed-followups-draft-recovery";
import { formatManagedFollowupsDraftFile } from "./managed-followups-draft-file";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFollowupsReviewFixture } from "./test-managed-followups-review-fixture";
import { createManagedFollowupsReviewReportSource } from "./managed-followups-review-report-source";
import { FollowupsReviewReportController } from "./followups-review-report-controller";
import { TrialApiError } from "./api";

const disposals: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T12:00:00.000Z"));
});
afterEach(() => {
  disposals
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose());
  vi.useRealTimers();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function fixture() {
  const f = await createFollowupsReviewFixture();
  let active = true;
  const source = createManagedFollowupsReviewReportSource(
    f.workspace,
    () => active,
  );
  disposals.push(f.dispose, source.dispose);
  return {
    ...f,
    source,
    route: (value: boolean) => {
      active = value;
      source.reconcile();
    },
  };
}
it("captures the full current draft in resource order regardless of filter or chosen review", async () => {
  const f = await fixture();
  const m = f.workspace.followups;
  f.start();
  m.complete(
    m.currentEntry(f.entries[1]!.id)!,
    new Date("2026-10-24T12:00:00.000Z"),
  );
  m.setFilter("completed");
  const before = m.coordinator.getSnapshot();
  const capture = f.source.capture()!;
  expect(capture).not.toBeNull();
  expect(capture.report.draft).toEqual(before.draft);
  expect(capture.report.draft.entries.map((entry) => entry.id)).toEqual(
    f.entries.map((entry) => entry.id),
  );
  expect(capture.report.draft.entries[1]?.completedOn).toBe("2026-10-24");
  expect(capture.report.baseVersion).toBe(before.baseVersion);
  expect(capture.report.dirty).toBe(true);
  expect(capture.report.currentCatalogSnapshotSha256).toBe(
    f.workspace.getSnapshot().snapshot?.snapshotSha256,
  );
  m.setFilter("open");
  m.select(f.entries[2]!.id);
  expect(capture.current()).toBe(true);
  expect(m.coordinator.getSnapshot()).toBe(before);
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
  expect(f.api.resolve).not.toHaveBeenCalled();
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.recentFilings).not.toHaveBeenCalled();
});
it("retires permanently on draft edits even after identical text is restored", async () => {
  const f = await fixture();
  const m = f.workspace.followups;
  const original = m.currentEntry(f.entries[0]!.id)!;
  const captured = f.source.capture()!;
  m.edit(original, "result", "New authored result");
  m.edit(m.currentEntry(original.id)!, "result", original.result);
  expect(captured.current()).toBe(false);
  expect(f.source.capture()?.current()).toBe(true);
});
it("retires permanently across route and view exits that later return", async () => {
  const f = await fixture();
  const routeCapture = f.source.capture()!;
  f.route(false);
  expect(f.source.capture()).toBeNull();
  f.route(true);
  expect(routeCapture.current()).toBe(false);
  const viewCapture = f.source.capture()!;
  f.workspace.setView("watchlist");
  expect(f.source.capture()).toBeNull();
  f.workspace.setView("followups");
  expect(viewCapture.current()).toBe(false);
  expect(f.source.capture()?.current()).toBe(true);
});
it("refuses unloaded and noncanonical drafts as a whole while retaining their exact text", async () => {
  const f = await fixture();
  const unloaded = f.make();
  unloaded.setView("followups");
  const source = createManagedFollowupsReviewReportSource(unloaded, () => true);
  disposals.push(source.dispose);
  expect(source.capture()).toBeNull();
  const m = f.workspace.followups;
  m.edit(m.currentEntry(f.entries[0]!.id)!, "check", "  keep raw spaces  ");
  const before = m.coordinator.getSnapshot();
  expect(f.source.capture()).toBeNull();
  expect(m.coordinator.getSnapshot()).toBe(before);
  m.edit(m.currentEntry(f.entries[0]!.id)!, "dueOn", "2026-02-30");
  expect(f.source.capture()).toBeNull();
  expect(m.currentEntry(f.entries[0]!.id)?.dueOn).toBe("2026-02-30");
});
it("retires on explicit load and cannot revive after the same saved resource returns", async () => {
  const f = await fixture();
  const captured = f.source.capture()!;
  const pending = deferred<Awaited<ReturnType<typeof f.api.loadFollowups>>>();
  const before = f.workspace.followups.coordinator.getSnapshot().saved!;
  vi.mocked(f.api.loadFollowups).mockReturnValueOnce(pending.promise);
  const load = f.workspace.followups.coordinator.load();
  expect(captured.current()).toBe(false);
  expect(f.source.capture()).toBeNull();
  pending.resolve(before);
  await load;
  expect(captured.current()).toBe(false);
  expect(f.source.capture()?.current()).toBe(true);
});
it.each(["conflict", "commit_unknown"] as const)(
  "refuses capture through %s recovery",
  async (code) => {
    const f = await fixture();
    const m = f.workspace.followups;
    m.edit(m.currentEntry(f.entries[0]!.id)!, "result", "Changed result");
    const captured = f.source.capture()!;
    vi.mocked(f.api.saveFollowups).mockRejectedValueOnce(
      new TrialApiError(code),
    );
    await m.coordinator.save();
    expect(captured.current()).toBe(false);
    expect(f.source.capture()).toBeNull();
  },
);
it("retires during catalog read and identity review even when cancellation restores the old catalog", async () => {
  const f = await fixture();
  const captured = f.source.capture()!;
  const pending = deferred<Awaited<ReturnType<typeof f.api.status>>>();
  const catalog = f.workspace.getSnapshot().snapshot!;
  vi.mocked(f.api.status).mockReturnValueOnce(pending.promise);
  const refresh = f.workspace.refreshCatalog();
  expect(f.source.capture()).toBeNull();
  expect(captured.current()).toBe(false);
  pending.resolve({ snapshot: catalog });
  await refresh;
  const renewed = f.source.capture()!;
  expect(renewed.current()).toBe(true);
  const review = f.workspace.followups.reviewCatalog();
  expect(renewed.current()).toBe(false);
  expect(f.source.capture()).toBeNull();
  await review;
  expect(f.source.capture()).toBeNull();
});
it("aborts a local file chooser on independent online Save, then allows a fresh capture and Load", async () => {
  const f = await fixture();
  const m = f.workspace.followups;
  m.edit(
    m.currentEntry(f.entries[0]!.id)!,
    "result",
    "Complete authored result",
  );
  const pending = deferred<"written">();
  const deliver = vi.fn<FollowupsReviewReportDeliveryAdapter["deliver"]>(
    () => pending.promise,
  );
  const controller = new FollowupsReviewReportController(
    f.source,
    { deliver },
    () => ({
      purpose: "investment.followups-review-html",
      filename: "transport-only.html",
      text: "transport-only",
      byteLength: 14,
    }),
  );
  disposals.push(() => controller.dispose());
  controller.prepare();
  const saveFile = controller.save();
  const captured = controller.getSnapshot().report!;
  await m.coordinator.save();
  expect(controller.getSnapshot().report).toBeNull();
  const context = deliver.mock.calls[0]![1] as {
    signal: AbortSignal;
    isCurrent: () => boolean;
  };
  expect(context.signal.aborted).toBe(true);
  pending.resolve("written");
  await saveFile;
  expect(controller.getSnapshot().message).not.toContain("written");
  expect(m.coordinator.getSnapshot().saved?.payload).toEqual(captured.draft);
  await m.coordinator.load();
  controller.prepare();
  expect(controller.getSnapshot().report?.dirty).toBe(false);
  expect(controller.getSnapshot().report?.baseVersion).toBe(
    captured.baseVersion + 1,
  );
  expect(f.api.saveFollowups).toHaveBeenCalledOnce();
  expect(f.api.loadFollowups).toHaveBeenCalledTimes(2);
});
it("clears capture capability on source disposal or session retirement", async () => {
  const f = await fixture();
  const captured = f.source.capture()!;
  f.workspace.sessionOwner.retire();
  expect(captured.current()).toBe(false);
  expect(f.source.capture()).toBeNull();
  f.source.dispose();
  f.source.reconcile();
  expect(f.source.capture()).toBeNull();
});

const fileScope = `sha256:${"c".repeat(64)}`;
async function recoveryFixture() {
  const f = await fixture();
  const deliveryPending = deferred<"written">();
  const recovery = new ManagedFollowupsDraftRecovery({
    workspace: f.workspace,
    accountScope: Promise.resolve(fileScope),
    delivery: { deliver: () => deliveryPending.promise },
    routeActive: () => true,
    now: () => "2026-10-26T12:00:00.000Z",
  });
  disposals.push(() => recovery.dispose());
  await Promise.resolve();
  const fileDocument = formatManagedFollowupsDraftFile({
    accountScope: fileScope,
    capturedAt: "2026-10-26T12:00:00.000Z",
    baseVersion: 7,
    draft: {
      schemaVersion: 1,
      entries: f.entries.map((entry) => ({
        ...entry,
        result: "Restored full result",
      })),
    },
  })!;
  const bytes = new TextEncoder().encode(fileDocument.text).buffer;
  const file = {
    size: bytes.byteLength,
    arrayBuffer: vi.fn(() => Promise.resolve(bytes)),
  };
  return { ...f, recovery, file, bytes, deliveryPending };
}
it("retires during local draft-file read/review and refuses synchronous captures throughout cancel publication", async () => {
  const f = await recoveryFixture();
  const captured = f.source.capture()!;
  const read = deferred<ArrayBuffer>();
  const reading = f.recovery.readFile({
    size: f.bytes.byteLength,
    arrayBuffer: () => read.promise,
  });
  expect(f.recovery.getSnapshot().phase).toBe("reading");
  expect(f.workspace.followups.hasDraftFileActivity()).toBe(true);
  expect(f.source.canCapture()).toBe(false);
  expect(captured.current()).toBe(false);
  read.resolve(f.bytes);
  await reading;
  expect(f.recovery.getSnapshot().phase).toBe("review");
  expect(f.source.capture()).toBeNull();
  const attempts: unknown[] = [];
  const unsubscribe = f.recovery.subscribe(() => {
    if (f.recovery.getSnapshot().phase === "idle")
      attempts.push(f.source.capture());
  });
  f.recovery.cancel();
  unsubscribe();
  expect(attempts.length).toBeGreaterThan(0);
  expect(attempts.every((attempt) => attempt === null)).toBe(true);
  expect(f.workspace.followups.hasDraftFileActivity()).toBe(false);
  expect(captured.current()).toBe(false);
  expect(f.source.capture()?.current()).toBe(true);
});
it("holds recovery ownership through complete restore publication before a fresh full report can capture", async () => {
  const f = await recoveryFixture();
  const captured = f.source.capture()!;
  await f.recovery.readFile(f.file);
  const attempts: unknown[] = [];
  const unsubscribe = f.recovery.subscribe(() => {
    attempts.push(f.source.capture());
  });
  expect(f.recovery.restoreDraft()).toBe(true);
  unsubscribe();
  expect(attempts.length).toBeGreaterThan(0);
  expect(attempts.every((attempt) => attempt === null)).toBe(true);
  expect(captured.current()).toBe(false);
  const fresh = f.source.capture()!;
  expect(fresh.current()).toBe(true);
  expect(fresh.report.draft.entries).toHaveLength(f.entries.length);
  expect(
    fresh.report.draft.entries.every(
      (entry) => entry.result === "Restored full result",
    ),
  ).toBe(true);
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("retires on a local draft-file export and does not revive after its late completion", async () => {
  const f = await recoveryFixture();
  const model = f.workspace.followups;
  model.edit(model.currentEntry(f.entries[0]!.id)!, "result", "Unsaved result");
  const captured = f.source.capture()!;
  const exporting = f.recovery.exportDraft();
  expect(f.recovery.getSnapshot().phase).toBe("exporting");
  expect(captured.current()).toBe(false);
  expect(f.source.capture()).toBeNull();
  f.recovery.cancel();
  expect(f.source.capture()?.current()).toBe(true);
  f.deliveryPending.resolve("written");
  await exporting;
  expect(captured.current()).toBe(false);
  expect(f.recovery.getSnapshot().message).toContain("cancelled");
});
it("refuses report capture before a synchronous recovery cancellation and never starts a cancelled file read", async () => {
  const f = await recoveryFixture();
  const captured = f.source.capture()!;
  let attempted = false;
  const unsubscribe = f.workspace.followups.subscribe(() => {
    if (attempted || !f.workspace.followups.hasDraftFileActivity()) return;
    attempted = true;
    expect(f.source.capture()).toBeNull();
    f.recovery.cancel();
  });
  await f.recovery.readFile(f.file);
  unsubscribe();
  expect(attempted).toBe(true);
  expect(f.file.arrayBuffer).not.toHaveBeenCalled();
  expect(captured.current()).toBe(false);
  expect(f.workspace.followups.hasDraftFileActivity()).toBe(false);
  expect(f.source.capture()?.current()).toBe(true);
});

it("captures a fresh loaded resource with unavailable catalog, preserves every old identity and retires on catalog arrival", async () => {
  const f = await fixture();
  const workspace = f.make();
  workspace.setView("followups");
  await workspace.followups.coordinator.load();
  expect(workspace.getSnapshot().snapshot).toBeNull();
  const source = createManagedFollowupsReviewReportSource(
    workspace,
    () => true,
  );
  disposals.push(source.dispose);
  const captured = source.capture()!;
  expect(captured).not.toBeNull();
  expect(captured.current()).toBe(true);
  expect(captured.report.currentCatalogSnapshotSha256).toBeNull();
  expect(captured.report.draft.entries).toEqual(f.entries);
  expect(
    captured.report.draft.entries.map((entry) => entry.catalogSnapshotSha256),
  ).toEqual(f.entries.map((entry) => entry.catalogSnapshotSha256));
  const requestCount = vi.mocked(f.api.status).mock.calls.length;
  expect(requestCount).toBe(1);
  await workspace.refreshCatalog();
  expect(captured.current()).toBe(false);
  expect(source.capture()?.report.currentCatalogSnapshotSha256).toBe(
    workspace.getSnapshot().snapshot?.snapshotSha256,
  );
  expect(captured.report.currentCatalogSnapshotSha256).toBeNull();
});
it("refuses stale loaded status and mismatched online base even when the draft itself is valid", async () => {
  const f = await fixture();
  const coordinator = f.workspace.followups.coordinator;
  const before = coordinator.getSnapshot();
  const get = vi.spyOn(coordinator, "getSnapshot");
  try {
    get.mockReturnValue({ ...before, latestLoaded: false });
    expect(f.source.capture()).toBeNull();
    get.mockReturnValue({ ...before, baseVersion: before.baseVersion! + 1 });
    expect(f.source.capture()).toBeNull();
  } finally {
    get.mockRestore();
  }
  expect(f.source.capture()?.current()).toBe(true);
});
