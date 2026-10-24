import { describe, expect, it, vi } from "vitest";
import { PortfolioReviewReportController } from "./portfolio-review-report-controller";
import {
  preparePortfolioReviewReport,
  isPreparedPortfolioReviewReport,
} from "./portfolio-review-report";
import { portfolioReviewReportFixture } from "./portfolio-review-report-fixture";
import type { PortfolioReviewReportHtmlDocument } from "./portfolio-review-report-ports";
import type { PortfolioReviewReportDeliveryAdapter } from "./portfolio-review-report-ports";
import { ManagedPortfolioCloseReview } from "./managed-portfolio-close-review";
import { ManagedEodAccess } from "./managed-eod-access";
import { eodResponse, eodSelection } from "./eod-history-fixture";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
function setup() {
  const input = portfolioReviewReportFixture();
  const report = preparePortfolioReviewReport(input);
  if (!report) throw new Error("Invented report not admitted");
  let version = 0;
  let active = true;
  const listeners = new Set<() => void>();
  const capture = vi.fn(() => {
    const captured = version;
    return { report, current: () => active && version === captured };
  });
  const source = {
    capture,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  // This formatter seam tests controller ownership and async delivery only.
  // Actual HTML/brand admission and native formatter-to-file execution have separate checks.
  const document: PortfolioReviewReportHtmlDocument = Object.freeze({
    purpose: "investment.portfolio-review-html",
    filename: "Investment-portfolio-review-20261024T030000123Z.html",
    text: "invented transport-only document",
    byteLength: 32,
  });
  const format = vi.fn(
    (): PortfolioReviewReportHtmlDocument | null => document,
  );
  const deliver = vi
    .fn<PortfolioReviewReportDeliveryAdapter["deliver"]>()
    .mockResolvedValue("written");
  const controller = new PortfolioReviewReportController(
    source,
    { deliver },
    format,
  );
  return {
    controller,
    capture,
    format,
    deliver,
    report,
    listeners,
    invalidate: () => {
      version += 1;
      for (const listener of listeners) listener();
    },
    retire: () => {
      active = false;
      for (const listener of listeners) listener();
    },
  };
}

describe("Portfolio captured report ownership", () => {
  it("does not capture or deliver on entry and requires explicit review before delivery", async () => {
    const f = setup();
    expect(f.capture).not.toHaveBeenCalled();
    await f.controller.save();
    expect(f.deliver).not.toHaveBeenCalled();
    f.controller.prepare();
    expect(
      isPreparedPortfolioReviewReport(f.controller.getSnapshot().report),
    ).toBe(true);
    expect(f.format).not.toHaveBeenCalled();
    await f.controller.save();
    expect(f.deliver).toHaveBeenCalledTimes(1);
    expect(f.controller.getSnapshot().message).toBe(
      "Portfolio report written to the chosen document.",
    );
    f.controller.dispose();
  });
  it("withdraws an identical-text old capture when the source revision changes", async () => {
    const f = setup();
    f.controller.prepare();
    f.invalidate();
    expect(f.controller.getSnapshot().report).toBeNull();
    await f.controller.save();
    expect(f.deliver).not.toHaveBeenCalled();
    f.controller.prepare();
    expect(f.controller.getSnapshot().report).toBe(f.report);
    f.controller.dispose();
  });
  it("aborts a pending chooser and fences a late written result after source change", async () => {
    const f = setup();
    const pending = deferred<"written">();
    f.deliver.mockImplementation(async (_doc, context) => {
      expect(context.isCurrent()).toBe(true);
      return pending.promise;
    });
    f.controller.prepare();
    const saving = f.controller.save();
    const context = f.deliver.mock.calls[0]![1];
    f.invalidate();
    expect(context.signal.aborted).toBe(true);
    expect(context.isCurrent()).toBe(false);
    pending.resolve("written");
    await saving;
    expect(f.controller.getSnapshot().report).toBeNull();
    expect(f.controller.getSnapshot().message).not.toContain("written");
    f.controller.dispose();
  });
  it("cancels delivery without discarding a still-current capture", async () => {
    const f = setup();
    const pending = deferred<"written">();
    f.deliver.mockReturnValue(pending.promise);
    f.controller.prepare();
    const saving = f.controller.save();
    f.controller.cancel();
    expect(f.deliver.mock.calls[0]![1].signal.aborted).toBe(true);
    expect(f.controller.getSnapshot().report).toBe(f.report);
    expect(f.controller.getSnapshot().saving).toBe(false);
    pending.resolve("written");
    await saving;
    expect(f.controller.getSnapshot().message).toContain("cancelled");
    f.controller.dispose();
  });
  it("does not allow a second save or recapture while a delivery owns the pending operation", async () => {
    const f = setup();
    const pending = deferred<"cancelled">();
    f.deliver.mockReturnValue(pending.promise);
    f.controller.prepare();
    const saving = f.controller.save();
    f.controller.prepare();
    await f.controller.save();
    expect(f.capture).toHaveBeenCalledTimes(1);
    expect(f.deliver).toHaveBeenCalledTimes(1);
    pending.resolve("cancelled");
    await saving;
    f.controller.dispose();
  });
  it("clears and aborts on close and session retirement", async () => {
    for (const action of ["close", "retire"] as const) {
      const f = setup();
      const pending = deferred<"written">();
      f.deliver.mockReturnValue(pending.promise);
      f.controller.prepare();
      const saving = f.controller.save();
      if (action === "close") f.controller.close();
      else f.retire();
      expect(f.deliver.mock.calls[0]![1].signal.aborted).toBe(true);
      expect(f.controller.getSnapshot().report).toBeNull();
      pending.resolve("written");
      await saving;
      expect(f.controller.getSnapshot().message).not.toContain("written");
      f.controller.dispose();
    }
  });
  it("disposes its source subscription and fences completion after unmount", async () => {
    const f = setup();
    const pending = deferred<"written">();
    f.deliver.mockReturnValue(pending.promise);
    f.controller.prepare();
    const saving = f.controller.save();
    f.controller.dispose();
    expect(f.listeners.size).toBe(0);
    expect(f.deliver.mock.calls[0]![1].signal.aborted).toBe(true);
    pending.resolve("written");
    await saving;
    f.controller.prepare();
    await f.controller.save();
    expect(f.controller.getSnapshot().report).toBeNull();
    expect(f.deliver).toHaveBeenCalledTimes(1);
  });
  it("retains source dates in its capture and distinguishes requested download from a written file", async () => {
    const f = setup();
    f.deliver.mockResolvedValue("download_requested");
    f.controller.prepare();
    await f.controller.save();
    expect(f.controller.getSnapshot().message).toContain("download requested");
    expect(
      f.controller.getSnapshot().report?.sourceRows[0]?.response?.completedAt,
    ).toBe(eodResponse().completedAt);
    f.controller.dispose();
  });
  it("refuses failed formatting without invoking a chooser and hides adapter failures", async () => {
    const f = setup();
    f.controller.prepare();
    f.format.mockReturnValue(null);
    await f.controller.save();
    expect(f.deliver).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().saving).toBe(false);
    f.format.mockReturnValue({
      purpose: "investment.portfolio-review-html",
      filename: "transport.html",
      text: "transport-only",
      byteLength: 14,
    });
    f.deliver.mockRejectedValue(new Error("private bridge details"));
    await f.controller.save();
    expect(f.controller.getSnapshot().message).not.toContain("private");
    expect(f.controller.getSnapshot().report).toBe(f.report);
    f.controller.dispose();
  });
});

describe("Actual holdings model report capability", () => {
  it("captures only a completed current review and makes no extra source request", async () => {
    const input = portfolioReviewReportFixture();
    let active = true;
    const read = vi.fn().mockResolvedValue(eodResponse());
    const model = new ManagedPortfolioCloseReview(
      new ManagedEodAccess(read),
      vi.fn(),
      vi.fn(),
      [eodSelection.listing],
    );
    model.enter({
      ledger: input.ledger,
      portfolio: input.portfolio,
      current: () => active,
    });
    expect(model.captureReport(input.preparedAt)).toBeNull();
    await model.load();
    const captured = model.captureReport(input.preparedAt);
    expect(captured).not.toBeNull();
    expect(captured?.current()).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
    model.selectDate(model.getSnapshot().selectedDate);
    expect(captured?.current()).toBe(false);
    const fresh = model.captureReport(input.preparedAt);
    expect(fresh?.current()).toBe(true);
    active = false;
    expect(fresh?.current()).toBe(false);
    expect(model.captureReport(input.preparedAt)).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    model.retire();
  });
  it("withdraws immediately on a refresh and cannot renew an old capture after Cancel", async () => {
    const input = portfolioReviewReportFixture();
    const held = deferred<ReturnType<typeof eodResponse>>();
    const read = vi
      .fn()
      .mockResolvedValueOnce(eodResponse())
      .mockReturnValueOnce(held.promise);
    const model = new ManagedPortfolioCloseReview(
      new ManagedEodAccess(read),
      vi.fn(),
      vi.fn(),
      [eodSelection.listing],
    );
    model.enter({
      ledger: input.ledger,
      portfolio: input.portfolio,
      current: () => true,
    });
    await model.load();
    const old = model.captureReport(input.preparedAt);
    expect(old?.current()).toBe(true);
    const refresh = model.load();
    expect(old?.current()).toBe(false);
    expect(model.captureReport(input.preparedAt)).toBeNull();
    model.cancel();
    held.resolve(eodResponse());
    await refresh;
    expect(old?.current()).toBe(false);
    expect(model.captureReport(input.preparedAt)?.current()).toBe(true);
    model.retire();
  });
});
