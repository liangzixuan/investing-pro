import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browserPortfolioComparisonReportAdapter,
  createNativePortfolioComparisonReportAdapter,
  type InvestmentPortfolioComparisonReportPlugin,
} from "./portfolio-comparison-report-delivery";
import type { PortfolioComparisonReportHtmlDocument } from "./portfolio-comparison-report-ports";
import type * as PortfolioComparisonReportHtml from "./portfolio-comparison-report-html";

// Transport-only ownership seam. The native journey exercises the real detached
// formatter, admission guard, adapter, policy and chosen-document writer together.
const owned = vi.hoisted(() => new WeakSet<object>());
vi.mock("./portfolio-comparison-report-html", () => ({
  isPortfolioComparisonReportHtmlDocument: (value: unknown) =>
    typeof value === "object" && value !== null && owned.has(value),
}));
const HANDLE = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const FAILURE = "Comparison report save unavailable";
const text =
  "<!doctype html>\n<html><body>Invented Café 東京 📈</body></html>\n";
const report: PortfolioComparisonReportHtmlDocument = Object.freeze({
  purpose: "investment.portfolio-comparison-html",
  filename: "Investment-portfolio-comparison-20261024T010203456Z.html",
  text,
  byteLength: new TextEncoder().encode(text).byteLength,
});
owned.add(report);
function context() {
  const controller = new AbortController();
  return { controller, signal: controller.signal, isCurrent: () => true };
}
function plugin() {
  return {
    choose: vi
      .fn<InvestmentPortfolioComparisonReportPlugin["choose"]>()
      .mockResolvedValue({ status: "chosen", handle: HANDLE }),
    write: vi
      .fn<InvestmentPortfolioComparisonReportPlugin["write"]>()
      .mockResolvedValue({ status: "written" }),
    cancel: vi
      .fn<InvestmentPortfolioComparisonReportPlugin["cancel"]>()
      .mockResolvedValue(undefined),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Comparison report native transport", () => {
  it("chooses with framing metadata only and writes exact captured HTML", async () => {
    const bridge = plugin();
    await expect(
      createNativePortfolioComparisonReportAdapter(bridge).deliver(
        report,
        context(),
      ),
    ).resolves.toBe("written");
    const metadata = bridge.choose.mock.calls[0]![0];
    expect(Object.keys(metadata).sort()).toEqual([
      "filename",
      "operationId",
      "purpose",
    ]);
    expect(metadata).toMatchObject({
      filename: report.filename,
      purpose: report.purpose,
    });
    expect(metadata.operationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(bridge.write).toHaveBeenCalledExactlyOnceWith({
      operationId: metadata.operationId,
      handle: HANDLE,
      text,
    });
    expect(bridge.cancel).toHaveBeenCalledExactlyOnceWith({
      operationId: metadata.operationId,
    });
  });
  it("refuses unowned clones and hostile objects before reading text or opening the chooser", async () => {
    const bridge = plugin();
    const trap = vi.fn(() => {
      throw new Error("Must not read");
    });
    const hostile = new Proxy({}, { get: trap, ownKeys: trap });
    const adapter = createNativePortfolioComparisonReportAdapter(bridge);
    for (const value of [
      { ...report },
      { ...report, purpose: "investment.company-research-html" },
      hostile,
    ])
      await expect(
        adapter.deliver(
          value as PortfolioComparisonReportHtmlDocument,
          context(),
        ),
      ).rejects.toThrow(FAILURE);
    expect(trap).not.toHaveBeenCalled();
    expect(bridge.choose).not.toHaveBeenCalled();
    expect(bridge.write).not.toHaveBeenCalled();
  });
  it("checks the real admission guard also refuses the invented transport seam, clones and hostile documents", async () => {
    const actual = await vi.importActual<typeof PortfolioComparisonReportHtml>(
      "./portfolio-comparison-report-html",
    );
    const trap = vi.fn(() => {
      throw new Error("Must not read");
    });
    expect(actual.isPortfolioComparisonReportHtmlDocument(report)).toBe(false);
    expect(actual.isPortfolioComparisonReportHtmlDocument({ ...report })).toBe(
      false,
    );
    expect(
      actual.isPortfolioComparisonReportHtmlDocument(
        new Proxy({}, { get: trap, ownKeys: trap }),
      ),
    ).toBe(false);
    expect(trap).not.toHaveBeenCalled();
  });
  it("preserves chooser cancellation without writing", async () => {
    const bridge = plugin();
    bridge.choose.mockResolvedValue({ status: "cancelled" });
    await expect(
      createNativePortfolioComparisonReportAdapter(bridge).deliver(
        report,
        context(),
      ),
    ).resolves.toBe("cancelled");
    expect(bridge.write).not.toHaveBeenCalled();
    expect(bridge.cancel).toHaveBeenCalledTimes(1);
  });
  it.each(["abort", "retire"] as const)(
    "does not choose for an already %s context",
    async (mode) => {
      const current = context();
      if (mode === "abort") current.controller.abort();
      else current.isCurrent = () => false;
      const bridge = plugin();
      await expect(
        createNativePortfolioComparisonReportAdapter(bridge).deliver(
          report,
          current,
        ),
      ).resolves.toBe("cancelled");
      expect(bridge.choose).not.toHaveBeenCalled();
      expect(bridge.cancel).not.toHaveBeenCalled();
    },
  );
  it.each(["abort", "retire"] as const)(
    "fences a late destination after %s",
    async (mode) => {
      const choice = deferred<{ status: "chosen"; handle: string }>();
      const bridge = plugin();
      bridge.choose.mockReturnValue(choice.promise);
      const current = context();
      const pending = createNativePortfolioComparisonReportAdapter(
        bridge,
      ).deliver(report, current);
      if (mode === "abort") current.controller.abort();
      else current.isCurrent = () => false;
      choice.resolve({ status: "chosen", handle: HANDLE });
      await expect(pending).resolves.toBe("cancelled");
      expect(bridge.write).not.toHaveBeenCalled();
      expect(bridge.cancel).toHaveBeenCalledTimes(1);
    },
  );
  it("does not publish written after retirement during a native write", async () => {
    const written = deferred<{ status: "written" }>();
    const started = deferred<void>();
    const bridge = plugin();
    bridge.write.mockImplementation(() => {
      started.resolve();
      return written.promise;
    });
    const current = context();
    const pending = createNativePortfolioComparisonReportAdapter(
      bridge,
    ).deliver(report, current);
    await started.promise;
    current.isCurrent = () => false;
    written.resolve({ status: "written" });
    await expect(pending).resolves.toBe("cancelled");
    expect(bridge.write).toHaveBeenCalledTimes(1);
    expect(bridge.cancel).toHaveBeenCalledTimes(1);
  });
  it("rejects a concurrent operation and releases its chooser after completion", async () => {
    const choice = deferred<{ status: "cancelled" }>();
    const bridge = plugin();
    bridge.choose.mockReturnValueOnce(choice.promise);
    const adapter = createNativePortfolioComparisonReportAdapter(bridge);
    const pending = adapter.deliver(report, context());
    await expect(adapter.deliver(report, context())).rejects.toThrow(FAILURE);
    expect(bridge.choose).toHaveBeenCalledTimes(1);
    choice.resolve({ status: "cancelled" });
    await expect(pending).resolves.toBe("cancelled");
    await expect(adapter.deliver(report, context())).resolves.toBe("written");
    expect(bridge.choose.mock.calls[0]![0].operationId).not.toBe(
      bridge.choose.mock.calls[1]![0].operationId,
    );
  });
  it("returns a fixed failure and clears the operation when the bridge rejects", async () => {
    const bridge = plugin();
    bridge.write.mockRejectedValue(new Error("private detail"));
    bridge.cancel.mockRejectedValue(new Error("private cleanup"));
    const adapter = createNativePortfolioComparisonReportAdapter(bridge);
    await expect(adapter.deliver(report, context())).rejects.toThrow(FAILURE);
    expect(bridge.cancel).toHaveBeenCalledTimes(1);
    bridge.write.mockResolvedValue({ status: "written" });
    await expect(adapter.deliver(report, context())).resolves.toBe("written");
  });
});
function browser() {
  const anchor = {
    href: "",
    download: "",
    hidden: false,
    click: vi.fn(),
    remove: vi.fn(),
  };
  const createObjectURL = vi
    .fn<(blob: Blob) => string>()
    .mockReturnValue("blob:invented-portfolio-report");
  const revokeObjectURL = vi.fn();
  const frame = vi
    .fn<(callback: FrameRequestCallback) => number>()
    .mockReturnValue(1);
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.stubGlobal("document", {
    createElement: vi.fn(() => anchor),
    body: { append: vi.fn() },
  });
  vi.stubGlobal("window", {
    requestAnimationFrame: frame,
    cancelAnimationFrame: vi.fn(),
  });
  return { anchor, createObjectURL, revokeObjectURL, frame };
}
describe("Comparison report browser transport", () => {
  it("requests the exact UTF-8 HTML filename and releases its URL after a frame", async () => {
    const stub = browser();
    const pending = browserPortfolioComparisonReportAdapter.deliver(
      report,
      context(),
    );
    expect(stub.anchor.download).toBe(report.filename);
    expect(stub.anchor.click).toHaveBeenCalledTimes(1);
    expect(stub.anchor.remove).toHaveBeenCalledTimes(1);
    const blob = stub.createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe("text/html;charset=utf-8");
    expect(await blob.text()).toBe(text);
    stub.frame.mock.calls[0]![0](0);
    await expect(pending).resolves.toBe("download_requested");
    expect(stub.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:invented-portfolio-report",
    );
  });
  it("refuses unowned text without allocating a local URL", async () => {
    const stub = browser();
    await expect(
      browserPortfolioComparisonReportAdapter.deliver({ ...report }, context()),
    ).rejects.toThrow(FAILURE);
    expect(stub.createObjectURL).not.toHaveBeenCalled();
  });
  it("rechecks ownership lifetime before clicking and releases an unrequested URL", async () => {
    const stub = browser();
    const current = context();
    current.isCurrent = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    await expect(
      browserPortfolioComparisonReportAdapter.deliver(report, current),
    ).resolves.toBe("cancelled");
    expect(stub.anchor.click).not.toHaveBeenCalled();
    expect(stub.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(stub.anchor.remove).toHaveBeenCalledTimes(1);
  });
  it("cleans up an already requested download on abort without claiming it was cancelled", async () => {
    const stub = browser();
    const current = context();
    const pending = browserPortfolioComparisonReportAdapter.deliver(
      report,
      current,
    );
    current.controller.abort();
    await expect(pending).resolves.toBe("download_requested");
    stub.frame.mock.calls[0]![0](0);
    expect(stub.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
