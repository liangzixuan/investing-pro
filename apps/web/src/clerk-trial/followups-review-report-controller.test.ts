import { afterEach, expect, it, vi } from "vitest";
import { FollowupsReviewReportController } from "./followups-review-report-controller";
import { prepareFollowupsReviewReport } from "./followups-review-report";
import { followupsReviewReportFixture } from "./followups-review-report-fixture";
import type {
  FollowupsReviewReportDeliveryAdapter,
  FollowupsReviewReportHtmlDocument,
} from "./followups-review-report-ports";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
const controllers: FollowupsReviewReportController[] = [];
afterEach(() =>
  controllers.splice(0).forEach((controller) => controller.dispose()),
);
function fixture() {
  const report = prepareFollowupsReviewReport(followupsReviewReportFixture())!;
  let current = true;
  const listeners = new Set<() => void>();
  const capture = vi.fn(() => ({ report, current: () => current }));
  const document: FollowupsReviewReportHtmlDocument = {
    purpose: "investment.followups-review-html",
    filename: "transport-only.html",
    text: "transport-only",
    byteLength: 14,
  };
  // This seam checks operation ownership. Formatter admission has separate real-document tests.
  const format = vi.fn<() => FollowupsReviewReportHtmlDocument | null>(
    () => document,
  );
  const deliver = vi
    .fn<FollowupsReviewReportDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  const controller = new FollowupsReviewReportController(
    {
      capture,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    { deliver },
    format,
  );
  controllers.push(controller);
  return {
    controller,
    capture,
    deliver,
    format,
    report,
    listeners,
    retire: () => {
      current = false;
      for (const listener of listeners) listener();
    },
  };
}
it("requires explicit capture and file save, and keeps the complete resource", async () => {
  const f = fixture();
  await f.controller.save();
  expect(f.capture).not.toHaveBeenCalled();
  expect(f.deliver).not.toHaveBeenCalled();
  f.controller.prepare();
  expect(f.controller.getSnapshot().report?.draft.entries).toHaveLength(3);
  expect(f.format).not.toHaveBeenCalled();
  await f.controller.save();
  expect(f.deliver).toHaveBeenCalledOnce();
  expect(f.controller.getSnapshot().message).toBe(
    "Follow-ups report written to the chosen document.",
  );
});
it.each(["cancel", "close", "retire", "dispose"] as const)(
  "aborts and fences late written delivery on %s",
  async (action) => {
    const f = fixture();
    const pending = deferred<"written">();
    f.deliver.mockReturnValue(pending.promise);
    f.controller.prepare();
    const save = f.controller.save();
    const context = f.deliver.mock.calls[0]![1];
    if (action === "retire") f.retire();
    else f.controller[action]();
    expect(context.signal.aborted).toBe(true);
    expect(context.isCurrent()).toBe(false);
    pending.resolve("written");
    await save;
    expect(f.controller.getSnapshot().message).not.toContain("written");
    expect(f.controller.getSnapshot().report).toBe(
      action === "cancel" ? f.report : null,
    );
    expect(f.controller.getSnapshot().saving).toBe(false);
  },
);
it("owns one operation before synchronous listeners and ignores double or reentrant saves", async () => {
  const f = fixture();
  const pending = deferred<"cancelled">();
  f.deliver.mockReturnValue(pending.promise);
  f.controller.prepare();
  f.controller.subscribe(() => {
    f.controller.prepare();
    void f.controller.save();
  });
  const saving = f.controller.save();
  await f.controller.save();
  f.controller.prepare();
  expect(f.capture).toHaveBeenCalledOnce();
  expect(f.format).toHaveBeenCalledOnce();
  expect(f.deliver).toHaveBeenCalledOnce();
  pending.resolve("cancelled");
  await saving;
  expect(f.deliver).toHaveBeenCalledOnce();
});
it.each(["cancel", "close", "retire", "dispose"] as const)(
  "stops before formatting or chooser if a synchronous listener requests %s",
  async (action) => {
    const f = fixture();
    f.controller.prepare();
    f.controller.subscribe(() => {
      if (!f.controller.getSnapshot().saving) return;
      if (action === "retire") f.retire();
      else f.controller[action]();
    });
    await f.controller.save();
    expect(f.format).not.toHaveBeenCalled();
    expect(f.deliver).not.toHaveBeenCalled();
  },
);
it("does not let an old cancellation completion overwrite a newly owned operation", async () => {
  const f = fixture();
  const old = deferred<"written">(),
    next = deferred<"download_requested">();
  f.deliver.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  f.controller.prepare();
  const first = f.controller.save();
  f.controller.cancel();
  const second = f.controller.save();
  old.resolve("written");
  await first;
  expect(f.controller.getSnapshot().saving).toBe(true);
  expect(f.deliver.mock.calls[1]![1].isCurrent()).toBe(true);
  next.resolve("download_requested");
  await second;
  expect(f.controller.getSnapshot().message).toBe(
    "Follow-ups report download requested. Check the browser destination.",
  );
});
it("refuses invalid capture, failed formatting and private adapter errors without changing a draft", async () => {
  const f = fixture();
  f.capture.mockReturnValueOnce(null as never);
  f.controller.prepare();
  expect(f.controller.getSnapshot().report).toBeNull();
  f.controller.prepare();
  f.format.mockReturnValueOnce(null);
  await f.controller.save();
  expect(f.deliver).not.toHaveBeenCalled();
  f.deliver.mockRejectedValueOnce(new Error("private bridge details"));
  await f.controller.save();
  expect(f.controller.getSnapshot().message).not.toContain("private");
  expect(f.controller.getSnapshot().saving).toBe(false);
  expect(f.controller.getSnapshot().report).toBe(f.report);
});
it("releases its source subscription and never recaptures after disposal", async () => {
  const f = fixture();
  f.controller.dispose();
  expect(f.listeners.size).toBe(0);
  f.controller.prepare();
  await f.controller.save();
  expect(f.capture).not.toHaveBeenCalled();
  expect(f.deliver).not.toHaveBeenCalled();
});

it.each(["close", "cancel"] as const)(
  "blocks reentrant capture and save from abort callbacks during %s",
  async (action) => {
    const f = fixture();
    const pending = deferred<"written">();
    f.deliver.mockImplementationOnce((_document, context) => {
      context.signal.addEventListener(
        "abort",
        () => {
          f.controller.prepare();
          void f.controller.save();
        },
        { once: true },
      );
      return pending.promise;
    });
    f.controller.prepare();
    const saving = f.controller.save();
    f.controller[action]();
    expect(f.capture).toHaveBeenCalledOnce();
    expect(f.deliver).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot().report).toBe(
      action === "cancel" ? f.report : null,
    );
    pending.resolve("written");
    await saving;
    expect(f.controller.getSnapshot().message).not.toContain("written");
    expect(f.controller.getSnapshot().saving).toBe(false);
  },
);

it.each(["prepare", "save", "close"] as const)(
  "settles a synchronous subscriber close during %s notification without recursive publication",
  async (action) => {
    const f = fixture();
    if (action !== "prepare") f.controller.prepare();
    let notifications = 0;
    const unsubscribe = f.controller.subscribe(() => {
      notifications++;
      if (notifications > 3) throw new Error("Recursive close publication");
      f.controller.close();
    });
    if (action === "save") await f.controller.save();
    else f.controller[action]();
    unsubscribe();
    expect(notifications).toBeLessThanOrEqual(2);
    expect(f.controller.getSnapshot()).toEqual({
      report: null,
      saving: false,
      message: "",
    });
    expect(f.format).not.toHaveBeenCalled();
    expect(f.deliver).not.toHaveBeenCalled();
    f.controller.close();
    expect(f.controller.getSnapshot()).toEqual({
      report: null,
      saving: false,
      message: "",
    });
  },
);
