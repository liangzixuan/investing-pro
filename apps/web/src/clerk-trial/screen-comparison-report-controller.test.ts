import { afterEach, describe, expect, it, vi } from "vitest";
import { createScreenComparisonReportFixture } from "./screen-comparison-report-fixture";
import { ScreenComparisonReportController } from "./screen-comparison-report-controller";
import type { PreparedScreenComparisonReport } from "./screen-comparison-report";
import type {
  ScreenComparisonReportDeliveryAdapter,
  ScreenComparisonReportHtmlDocument,
} from "./screen-comparison-report-ports";
import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
afterEach(() => vi.useRealTimers());
async function setup() {
  const f = await createScreenComparisonReportFixture();
  const deliver = vi
    .fn<ScreenComparisonReportDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  const format = vi.fn(
    (
      report: PreparedScreenComparisonReport,
    ): ScreenComparisonReportHtmlDocument | null => ({
      purpose: "investment.screen-comparison-html",
      filename: `Investment-screen-comparison-${report.preparedAt.replace(/[-:.]/gu, "")}.html`,
      text: "invented transport-only document",
      byteLength: 32,
    }),
  );
  const controller = new ScreenComparisonReportController(
    { capture: f.capture, subscribe: f.model.subscribe },
    { deliver },
    format,
  );
  return { ...f, controller, deliver, format };
}
describe("comparison report delivery ownership", () => {
  it("requires capture, makes no source reads, and retains complete capture after explicit save", async () => {
    const f = await setup();
    await f.controller.save();
    expect(f.deliver).not.toHaveBeenCalled();
    f.controller.prepare();
    const report = f.controller.getSnapshot().report;
    await f.controller.save();
    expect(f.deliver).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot().report).toBe(report);
    expect(f.controller.getSnapshot().saving).toBe(false);
    expect(f.read).toHaveBeenCalledTimes(2);
    f.controller.dispose();
  });
  it("does not format or deliver after a Run announcement listener retires the pair", async () => {
    const f = await setup();
    f.controller.prepare();
    f.controller.subscribe(() => {
      if (f.controller.getSnapshot().saving) f.choose("left", null);
    });
    await f.controller.save();
    expect(f.format).not.toHaveBeenCalled();
    expect(f.deliver).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().report).toBeNull();
    f.controller.dispose();
  });
  it("refuses delivery if the formatter retires the source", async () => {
    const f = await setup();
    f.controller.prepare();
    const document = f.format(f.capture()!.report);
    f.format.mockClear();
    f.format.mockImplementation(() => {
      f.choose("left", null);
      return document;
    });
    await f.controller.save();
    expect(f.deliver).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().report).toBeNull();
    f.controller.dispose();
  });
  it("aborts pending delivery and fences late completion after model inactive ABA", async () => {
    const f = await setup();
    let context: TextDocumentDeliveryContext | undefined;
    let finish!: (value: TextDocumentDeliveryResult) => void;
    f.deliver.mockImplementation((_document, ctx) => {
      context = ctx;
      return new Promise<TextDocumentDeliveryResult>((resolve) => {
        finish = resolve;
      });
    });
    f.controller.prepare();
    const task = f.controller.save();
    const digest = f.model.getSnapshot().catalogSnapshotSha256!;
    f.model.reconcile(digest, false, false);
    f.model.reconcile(digest, true, true);
    expect(context!.signal.aborted).toBe(true);
    expect(context!.isCurrent()).toBe(false);
    finish("written");
    await task;
    expect(f.controller.getSnapshot().report).toBeNull();
    f.controller.dispose();
  });
  it("catalog removal publishes retirement and aborts a pending writer before its late result", async () => {
    const f = await setup();
    let context: TextDocumentDeliveryContext | undefined;
    let finish!: (value: TextDocumentDeliveryResult) => void;
    f.deliver.mockImplementation((_document, ctx) => {
      context = ctx;
      return new Promise<TextDocumentDeliveryResult>((resolve) => {
        finish = resolve;
      });
    });
    f.controller.prepare();
    const task = f.controller.save();
    f.model.reconcile(null, false, false);
    expect(context!.signal.aborted).toBe(true);
    expect(context!.isCurrent()).toBe(false);
    expect(f.controller.getSnapshot().report).toBeNull();
    finish("written");
    await task;
    expect(f.controller.getSnapshot().report).toBeNull();
    f.controller.dispose();
  });
  it.each(["cancel", "close"] as const)(
    "preserves replacement started reentrantly during %s abort",
    async (action) => {
      const f = await setup();
      let original: TextDocumentDeliveryContext | undefined;
      let finish!: (value: TextDocumentDeliveryResult) => void;
      f.deliver.mockImplementationOnce((_document, context) => {
        original = context;
        return new Promise<TextDocumentDeliveryResult>((resolve) => {
          finish = resolve;
        });
      });
      f.controller.prepare();
      const old = f.controller.save();
      original!.signal.addEventListener(
        "abort",
        () => {
          if (action === "close") f.controller.prepare();
          void f.controller.save();
        },
        { once: true },
      );
      f.controller[action]();
      await Promise.resolve();
      expect(f.deliver).toHaveBeenCalledTimes(2);
      finish("written");
      await old;
      expect(f.controller.getSnapshot().report).not.toBeNull();
      expect(f.controller.getSnapshot().message).toContain("written");
      f.controller.dispose();
    },
  );
  it("disposed controller cannot prepare reentrantly during abort", async () => {
    const f = await setup();
    let context: TextDocumentDeliveryContext | undefined;
    let finish!: (value: TextDocumentDeliveryResult) => void;
    f.deliver.mockImplementation((_d, c) => {
      context = c;
      return new Promise<TextDocumentDeliveryResult>((resolve) => {
        finish = resolve;
      });
    });
    f.controller.prepare();
    const task = f.controller.save();
    context!.signal.addEventListener("abort", () => {
      f.controller.prepare();
      void f.controller.save();
    });
    f.controller.dispose();
    finish("written");
    await task;
    expect(f.controller.getSnapshot().report).toBeNull();
    expect(f.deliver).toHaveBeenCalledOnce();
  });
});
