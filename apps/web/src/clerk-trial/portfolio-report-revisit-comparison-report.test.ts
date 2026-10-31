import { describe, expect, it, vi } from "vitest";
import {
  archiveBytes,
  archiveHtmlFixture,
  archiveReportFixture,
} from "./portfolio-report-archive-fixture";
import { PortfolioReportRevisit } from "./portfolio-report-revisit";
import { PortfolioReviewReportController } from "./portfolio-review-report-controller";
import { PortfolioComparisonReportController } from "./portfolio-comparison-report-controller";
import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

const now = "2026-10-30T12:00:00.000Z";
async function fixture() {
  const report = archiveReportFixture();
  const bytes = archiveBytes(archiveHtmlFixture(report));
  let active = true;
  let scope = true;
  let reenter: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const reports = new PortfolioReviewReportController(
    {
      capture: () => ({
        report,
        current: () => {
          const action = reenter;
          reenter = null;
          action?.();
          return active;
        },
      }),
      captureReadScope: () => () => scope,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    undefined,
    () => null,
  );
  const revisit = new PortfolioReportRevisit(reports);
  const file = {
    name: "Private <report> original.html",
    size: bytes.byteLength,
    arrayBuffer: vi.fn(() => Promise.resolve(bytes)),
  };
  revisit.choose(file);
  expect(await revisit.read()).toBe(true);
  reports.prepare();
  expect(revisit.compare()).toBe(true);
  return {
    report,
    reports,
    revisit,
    file,
    scope: (value: boolean) => {
      scope = value;
    },
    reenter: (action: () => void) => {
      reenter = action;
    },
    retire: () => {
      active = false;
      for (const listener of listeners) listener();
    },
  };
}

describe("comparison report capture from the current local revisit", () => {
  it("captures the exact full comparison and original filename without another read or save", async () => {
    const f = await fixture();
    const comparison = f.revisit.getSnapshot().comparison;
    const capture = f.revisit.captureComparisonReport(now);
    expect(capture?.report.comparison).toBe(comparison);
    expect(capture?.report.comparison.current).toBe(f.report);
    expect(capture?.report.savedFilename).toBe(f.file.name);
    expect(capture?.report.preparedAt).toBe(now);
    expect(capture?.current()).toBe(true);
    expect(f.file.arrayBuffer).toHaveBeenCalledTimes(1);
    expect(f.revisit.captureComparisonReport("invalid")).toBeNull();
    f.revisit.dispose();
    f.reports.dispose();
  });
  it.each([
    "file",
    "clear",
    "compare",
    "recapture",
    "close",
    "dispose",
  ] as const)(
    "retires the exact captured report on %s, even if the same report is restored",
    async (change) => {
      const f = await fixture();
      const capture = f.revisit.captureComparisonReport(now)!;
      if (change === "file") f.revisit.choose(f.file);
      if (change === "clear") f.revisit.clear();
      if (change === "compare") f.revisit.compare();
      if (change === "recapture") f.reports.prepare();
      if (change === "close") f.reports.close();
      if (change === "dispose") f.revisit.dispose();
      expect(capture.current()).toBe(false);
      f.reports.prepare();
      f.revisit.compare();
      expect(capture.current()).toBe(false);
      f.revisit.dispose();
      f.reports.dispose();
    },
  );
  it("permanently retires an observed stale file scope without requiring a subscription notification", async () => {
    const f = await fixture();
    const capture = f.revisit.captureComparisonReport(now)!;
    f.scope(false);
    expect(capture.current()).toBe(false);
    f.scope(true);
    expect(capture.current()).toBe(false);
    f.revisit.dispose();
    f.reports.dispose();
  });
  it("refuses a reentrant source callback which changes the chosen file during capture", async () => {
    const f = await fixture();
    f.reenter(() => f.revisit.choose(f.file));
    expect(f.revisit.captureComparisonReport(now)).toBeNull();
    expect(f.revisit.getSnapshot().comparison).toBeNull();
    f.revisit.dispose();
    f.reports.dispose();
  });
  it("cancels a pending delivery when the current review retires and ignores its late success", async () => {
    const f = await fixture();
    let finish!: (result: TextDocumentDeliveryResult) => void;
    let context: TextDocumentDeliveryContext | null = null;
    const deliver = vi.fn((_document, value: TextDocumentDeliveryContext) => {
      context = value;
      return new Promise<TextDocumentDeliveryResult>((resolve) => {
        finish = resolve;
      });
    });
    const controller = new PortfolioComparisonReportController(
      {
        capture: () => f.revisit.captureComparisonReport(now),
        subscribe: f.revisit.subscribe,
      },
      { deliver },
      () => ({
        purpose: "investment.portfolio-comparison-html",
        filename: "invented.html",
        text: "invented controller fixture",
        byteLength: 27,
      }),
    );
    controller.prepare();
    const save = controller.save();
    expect(deliver).toHaveBeenCalledTimes(1);
    f.retire();
    expect(
      (context as TextDocumentDeliveryContext | null)?.signal.aborted,
    ).toBe(true);
    expect(controller.getSnapshot().report).toBeNull();
    finish("written");
    await save;
    expect(controller.getSnapshot().message).not.toContain("written");
    expect(f.file.arrayBuffer).toHaveBeenCalledTimes(1);
    controller.dispose();
    f.revisit.dispose();
    f.reports.dispose();
  });
});
