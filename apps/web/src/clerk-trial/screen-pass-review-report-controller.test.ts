import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { screenPassReportFixture } from "./test-screen-pass-review-report-fixture";
import {
  ScreenPassReviewReportController,
  type ScreenPassReviewReportSource,
} from "./screen-pass-review-report-controller";
import type { PreparedScreenPassReviewReport } from "./screen-pass-review-report";
import type {
  ScreenPassReviewReportDeliveryAdapter,
  ScreenPassReviewReportHtmlDocument,
} from "./screen-pass-review-report-ports";
import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

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
async function setup() {
  const f = await screenPassReportFixture();
  cleanups.push(() => f.dispose());
  const deliver = vi
    .fn<ScreenPassReviewReportDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  // This is a controller transport stub, not HTML/UTF-8/CSP acceptance.
  const format = vi.fn<
    (
      r: PreparedScreenPassReviewReport,
    ) => ScreenPassReviewReportHtmlDocument | null
  >((r) => ({
    purpose: "investment.screen-pass-review-html",
    filename: `Investment-screen-pass-review-${r.preparedAt.replace(/[-:.]/gu, "")}.html`,
    text: "invented controller document",
    byteLength: 28,
  }));
  const control = (source: ScreenPassReviewReportSource = f.source) => {
    const controller = new ScreenPassReviewReportController(
      source,
      { deliver },
      format,
    );
    cleanups.push(() => controller.dispose());
    return controller;
  };
  return { ...f, deliver, format, control };
}
it("prepares without delivery and writes only after explicit Save with the same full payload", async () => {
  const f = await setup(),
    c = f.control();
  c.prepare();
  const report = c.getSnapshot().report!;
  expect(report).not.toBeNull();
  expect(f.format).not.toHaveBeenCalled();
  expect(f.deliver).not.toHaveBeenCalled();
  const snapshot = c.getSnapshot();
  const listener = vi.fn();
  const unsubscribe = c.subscribe(listener);
  for (let i = 0; i < 5; ++i) expect(c.getSnapshot()).toBe(snapshot);
  expect(listener).not.toHaveBeenCalled();
  unsubscribe();
  await c.save();
  expect(f.format).toHaveBeenCalledExactlyOnceWith(report);
  expect(f.deliver).toHaveBeenCalledOnce();
  expect(c.getSnapshot()).toMatchObject({ report, saving: false });
  expect(c.getSnapshot().message).toContain("written");
  expect(f.meta.getSnapshot().save).toBe(0);
});
it.each(["cancel", "close", "retire"] as const)(
  "keeps %s ownership when a late delivery returns",
  async (action) => {
    const f = await setup(),
      c = f.control();
    let finish!: (r: TextDocumentDeliveryResult) => void;
    let context!: TextDocumentDeliveryContext;
    f.deliver.mockImplementationOnce((_doc, ctx) => {
      context = ctx;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    c.prepare();
    const report = c.getSnapshot().report;
    const pending = c.save();
    expect(c.getSnapshot().saving).toBe(true);
    c.prepare();
    await c.save();
    expect(f.deliver).toHaveBeenCalledOnce();
    if (action === "cancel") c.cancel();
    if (action === "close") c.close();
    if (action === "retire") f.setRoute(false);
    const after = c.getSnapshot();
    expect(context.signal.aborted).toBe(true);
    expect(context.isCurrent()).toBe(false);
    expect(after.report).toBe(action === "cancel" ? report : null);
    finish("written");
    await pending;
    expect(c.getSnapshot()).toBe(after);
  },
);
it("ignores an old completion after cancellation and a replacement Save", async () => {
  const f = await setup(),
    c = f.control();
  let old!: (r: TextDocumentDeliveryResult) => void;
  f.deliver.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        old = resolve;
      }),
  );
  c.prepare();
  const pending = c.save();
  c.cancel();
  c.prepare();
  await c.save();
  const current = c.getSnapshot();
  old("cancelled");
  await pending;
  expect(c.getSnapshot()).toBe(current);
  expect(f.deliver).toHaveBeenCalledTimes(2);
});
it.each(["null", "throw", "invalidate"] as const)(
  "refuses formatting %s before document delivery",
  async (kind) => {
    const f = await setup(),
      c = f.control();
    f.format.mockImplementation(() => {
      if (kind === "throw") throw new Error("invented formatter refusal");
      if (kind === "invalidate") f.setRoute(false);
      return null;
    });
    c.prepare();
    await c.save();
    expect(f.deliver).not.toHaveBeenCalled();
    expect(c.getSnapshot().saving).toBe(false);
    expect(f.meta.getSnapshot().save).toBe(0);
  },
);
it("refuses a detached unregistered report even with a caller-supplied current predicate", async () => {
  const f = await setup();
  const report = structuredClone(f.source.capture()!.report);
  const c = f.control({
    subscribe: () => () => {},
    capture: () => ({ report, current: () => true }),
  });
  c.prepare();
  await c.save();
  expect(c.getSnapshot().report).toBeNull();
  expect(f.deliver).not.toHaveBeenCalled();
});
it("cannot overwrite a reentrant newer preparation from the source callback", async () => {
  const f = await setup();
  let nested = false;
  const c = f.control({
    ...f.source,
    capture: () => {
      const old = f.source.capture();
      if (!nested) {
        nested = true;
        vi.setSystemTime(new Date("2026-11-04T13:00:00Z"));
        c.prepare();
      }
      return old;
    },
  });
  c.prepare();
  expect(c.getSnapshot().report!.preparedAt).toBe("2026-11-04T13:00:00.000Z");
});
it("honors synchronous close on saving publication before formatting or delivery", async () => {
  const f = await setup(),
    c = f.control();
  c.prepare();
  c.subscribe(() => {
    if (c.getSnapshot().saving) c.close();
  });
  await c.save();
  expect(c.getSnapshot().report).toBeNull();
  expect(f.format).not.toHaveBeenCalled();
  expect(f.deliver).not.toHaveBeenCalled();
});
it("preserves a valid prepared reading after picker cancellation or delivery error", async () => {
  const f = await setup(),
    c = f.control();
  c.prepare();
  const report = c.getSnapshot().report;
  f.deliver.mockResolvedValueOnce("cancelled");
  await c.save();
  expect(c.getSnapshot()).toMatchObject({ report, saving: false });
  expect(c.getSnapshot().message).toContain("cancelled");
  f.deliver.mockRejectedValueOnce(new Error("invented transport failure"));
  await c.save();
  expect(c.getSnapshot()).toMatchObject({ report, saving: false });
  expect(c.getSnapshot().message).toContain("could not be saved");
});

it("does not publish written after a current callback synchronously cancels the operation", async () => {
  const f = await setup();
  let cancelDuringCurrent = false;
  const c = f.control({
    ...f.source,
    capture: () => {
      const captured = f.source.capture()!;
      return {
        ...captured,
        current: () => {
          if (cancelDuringCurrent) {
            cancelDuringCurrent = false;
            c.cancel();
          }
          return captured.current();
        },
      };
    },
  });
  f.deliver.mockImplementationOnce(() => {
    cancelDuringCurrent = true;
    return Promise.resolve("written");
  });
  c.prepare();
  const report = c.getSnapshot().report;
  await c.save();
  expect(f.deliver).toHaveBeenCalledOnce();
  expect(c.getSnapshot()).toMatchObject({
    report,
    saving: false,
    message: "Annual-pass report save cancelled.",
  });
});
