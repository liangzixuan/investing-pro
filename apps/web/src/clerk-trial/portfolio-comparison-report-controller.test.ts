import { describe, expect, it, vi } from "vitest";
import {
  PortfolioComparisonReportController,
  type PortfolioComparisonReportCapture,
} from "./portfolio-comparison-report-controller";
import { portfolioComparisonReportFixture } from "./portfolio-comparison-report-fixture";
import type {
  PortfolioComparisonReportDeliveryAdapter,
  PortfolioComparisonReportHtmlDocument,
} from "./portfolio-comparison-report-ports";
import type { PreparedPortfolioComparisonReport } from "./portfolio-comparison-report";
import type { TextDocumentDeliveryResult } from "./document-delivery";

function setup() {
  const listeners = new Set<() => void>();
  const current = vi.fn(() => true);
  let capture: PortfolioComparisonReportCapture = {
    report: portfolioComparisonReportFixture(),
    current,
  };
  const source = {
    capture: vi.fn(() => capture),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const deliver = vi
    .fn<PortfolioComparisonReportDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  const format = vi.fn<
    (
      report: PreparedPortfolioComparisonReport,
    ) => PortfolioComparisonReportHtmlDocument | null
  >(() => ({
    purpose: "investment.portfolio-comparison-html",
    filename: "Investment-portfolio-comparison-20261030T070809123Z.html",
    text: "invented transport-only bytes",
    byteLength: 28,
  }));
  const controller = new PortfolioComparisonReportController(
    source,
    { deliver },
    format,
  );
  return {
    controller,
    current,
    source,
    deliver,
    format,
    listeners,
    emit: () => {
      for (const listener of listeners) listener();
    },
    replace: () => {
      capture = { report: portfolioComparisonReportFixture(), current };
      return capture;
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, refuse) => {
    resolve = accept;
    reject = refuse;
  });
  return { promise, resolve, reject };
}
describe("Portfolio comparison report lifetime and delivery", () => {
  it.each(["written", "download_requested", "cancelled"] as const)(
    "requires explicit capture and keeps it after %s",
    async (result) => {
      const f = setup();
      f.deliver.mockResolvedValue(result);
      await f.controller.save();
      expect(f.deliver).not.toHaveBeenCalled();
      f.controller.prepare();
      const report = f.controller.getSnapshot().report;
      await f.controller.save();
      expect(f.deliver).toHaveBeenCalledOnce();
      expect(f.controller.getSnapshot().report).toBe(report);
      expect(f.controller.getSnapshot().saving).toBe(false);
      expect(f.controller.getSnapshot().message).toContain(
        result === "written"
          ? "written"
          : result === "cancelled"
            ? "cancelled"
            : "download requested",
      );
      f.controller.close();
      expect(f.controller.getSnapshot().report).toBeNull();
    },
  );
  it("aborts an observed retired capture and does not resurrect it on source ABA or late completion", async () => {
    const f = setup(),
      wait = deferred<TextDocumentDeliveryResult>();
    f.deliver.mockReturnValue(wait.promise);
    f.controller.prepare();
    const pending = f.controller.save(),
      context = f.deliver.mock.calls[0]![1];
    f.current.mockReturnValue(false);
    f.emit();
    expect(context.signal.aborted).toBe(true);
    f.current.mockReturnValue(true);
    f.emit();
    wait.resolve("written");
    await pending;
    f.controller.prepare();
    expect(f.controller.getSnapshot().report).toBeNull();
    f.replace();
    f.controller.prepare();
    expect(f.controller.getSnapshot().report).not.toBeNull();
  });
  it("checks late completion without relying on a subscription notification", async () => {
    const f = setup(),
      wait = deferred<TextDocumentDeliveryResult>();
    f.deliver.mockReturnValue(wait.promise);
    f.controller.prepare();
    const pending = f.controller.save();
    f.current.mockReturnValue(false);
    wait.resolve("written");
    await pending;
    expect(f.controller.getSnapshot().report).toBeNull();
    f.current.mockReturnValue(true);
    f.controller.prepare();
    expect(f.controller.getSnapshot().report).toBeNull();
  });
  it("fences source.capture reentrancy and exceptions before publishing", () => {
    const f = setup();
    const captured = f.source.capture();
    f.source.capture.mockImplementation(() => {
      f.controller.close();
      return captured;
    });
    f.controller.prepare();
    expect(f.controller.getSnapshot().report).toBeNull();
    f.source.capture.mockImplementation(() => {
      throw Error("capture retired");
    });
    expect(() => f.controller.prepare()).not.toThrow();
    expect(f.controller.getSnapshot().report).toBeNull();
  });
  it("does not format or deliver after a saving listener replaces the capture", async () => {
    const f = setup();
    f.controller.prepare();
    let replaced = false;
    f.controller.subscribe(() => {
      if (!replaced && f.controller.getSnapshot().saving) {
        replaced = true;
        f.controller.close();
        f.replace();
        f.controller.prepare();
      }
    });
    await f.controller.save();
    expect(f.format).not.toHaveBeenCalled();
    expect(f.deliver).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().message).toContain("Captured for review");
    expect(f.controller.getSnapshot().saving).toBe(false);
  });
  it("retires after a formatter changes the source without notification", async () => {
    const f = setup(),
      document = f.format(portfolioComparisonReportFixture());
    f.format.mockImplementation(() => {
      f.current.mockReturnValue(false);
      return document;
    });
    f.controller.prepare();
    await f.controller.save();
    expect(f.deliver).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().report).toBeNull();
  });
  it("does not allow a reentrant current callback to continue a cancelled operation", async () => {
    const f = setup();
    f.controller.prepare();
    f.current.mockImplementation(() => {
      if (f.controller.getSnapshot().saving) f.controller.cancel();
      return true;
    });
    await f.controller.save();
    expect(f.format).not.toHaveBeenCalled();
    expect(f.deliver).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().saving).toBe(false);
  });
  it("preserves a replacement prepared from an abort listener and fences the old rejection", async () => {
    const f = setup(),
      wait = deferred<TextDocumentDeliveryResult>();
    f.deliver.mockImplementation((_doc, context) => {
      context.signal.addEventListener(
        "abort",
        () => {
          f.controller.close();
          f.replace();
          f.controller.prepare();
        },
        { once: true },
      );
      return wait.promise;
    });
    f.controller.prepare();
    const pending = f.controller.save();
    f.controller.cancel();
    const replacement = f.controller.getSnapshot();
    wait.reject(Error("late failure"));
    await pending;
    expect(f.controller.getSnapshot()).toBe(replacement);
    expect(replacement.message).toContain("Captured for review");
  });
  it("retains the current report on ordinary cancellation and ignores late success", async () => {
    const f = setup(),
      wait = deferred<TextDocumentDeliveryResult>();
    f.deliver.mockReturnValue(wait.promise);
    f.controller.prepare();
    const report = f.controller.getSnapshot().report;
    const pending = f.controller.save();
    f.controller.cancel();
    const state = f.controller.getSnapshot();
    wait.resolve("written");
    await pending;
    expect(f.controller.getSnapshot()).toBe(state);
    expect(state.report).toBe(report);
    expect(state.message).toContain("cancelled");
  });
  it("refuses incomplete or oversized whole formatting without invoking delivery", async () => {
    const f = setup();
    f.format.mockReturnValue(null);
    f.controller.prepare();
    const report = f.controller.getSnapshot().report;
    await f.controller.save();
    expect(f.deliver).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().report).toBe(report);
    expect(f.controller.getSnapshot().message).toContain("could not be saved");
  });
  it("guards duplicate Save and Capture while pending, and disposes without late publication", async () => {
    const f = setup(),
      wait = deferred<TextDocumentDeliveryResult>();
    f.deliver.mockReturnValue(wait.promise);
    f.controller.prepare();
    const pending = f.controller.save();
    await f.controller.save();
    f.controller.prepare();
    expect(f.source.capture).toHaveBeenCalledOnce();
    expect(f.deliver).toHaveBeenCalledOnce();
    const listener = vi.fn();
    f.controller.subscribe(listener);
    f.controller.dispose();
    const count = listener.mock.calls.length;
    expect(f.deliver.mock.calls[0]![1].signal.aborted).toBe(true);
    expect(f.listeners.size).toBe(0);
    wait.resolve("written");
    await pending;
    expect(listener).toHaveBeenCalledTimes(count);
    expect(f.controller.getSnapshot().report).toBeNull();
  });
  it("refuses cloned prepared reports and guards throwing or recursive ownership callbacks", () => {
    const f = setup(),
      captured = f.source.capture();
    f.source.capture.mockReturnValue({
      ...captured,
      report: { ...captured.report },
    });
    f.controller.prepare();
    expect(f.controller.getSnapshot().report).toBeNull();
    f.source.capture.mockReturnValue(captured);
    f.current.mockImplementation(() => {
      throw Error("retired");
    });
    expect(() => f.controller.prepare()).not.toThrow();
    f.replace();
    f.current.mockReturnValue(true);
    f.controller.prepare();
    f.current.mockImplementation(() => {
      f.controller.reconcile();
      return true;
    });
    expect(() => f.controller.reconcile()).not.toThrow();
    expect(f.controller.getSnapshot().report).toBeNull();
  });
});
