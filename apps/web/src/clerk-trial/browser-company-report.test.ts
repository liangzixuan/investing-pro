import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserCompanyReportAdapter } from "./browser-company-report";
import type { CompanyReportDocument } from "./managed-company-report-document";
import type { CompanyReportHtmlDocument } from "./managed-company-report-html";

// Transport-only seam: positive detached rendering and real ownership admission
// require browser verification. The existing JSON formatter/guard stays real.
const htmlOwnership = vi.hoisted(() => new WeakSet<object>());
vi.mock("./managed-company-report-html", () => ({
  formatCompanyReportHtml: vi.fn(),
  isCompanyReportHtmlDocument: (value: unknown) =>
    typeof value === "object" && value !== null && htmlOwnership.has(value),
}));

const htmlDocument: CompanyReportHtmlDocument = Object.freeze({
  purpose: "investment.company-research-html",
  filename: "Investment-research-ZERO-XNAS-20261015T000000000Z.html",
  text: "<!doctype html><html><body>Café 東京 😀</body></html>",
  byteLength: new TextEncoder().encode(
    "<!doctype html><html><body>Café 東京 😀</body></html>",
  ).byteLength,
});
htmlOwnership.add(htmlDocument);

function htmlDelivery() {
  if (
    browserCompanyReportAdapter.destination !== "browser_download" ||
    !browserCompanyReportAdapter.html
  )
    throw new Error("Missing HTML capability");
  return browserCompanyReportAdapter.html;
}

const text =
  JSON.stringify({
    purpose: "investment.company-research",
    schemaVersion: "2.0.0",
    preparedAt: "2026-10-15T00:00:00.000Z",
    listing: { symbol: "ZERO", exchangeMic: "XNAS" },
    authoredResearch: {
      note: "Invented draft: Café 東京 😀\nexact whitespace  ",
    },
  }) + "\n";
const value: CompanyReportDocument = {
  purpose: "investment.company-research",
  filename: "Investment-research-ZERO-XNAS-20261015T000000000Z.json",
  text,
  byteLength: new TextEncoder().encode(text).byteLength,
};

function fixture() {
  const controller = new AbortController();
  const isCurrent = vi.fn(() => true);
  let frame!: FrameRequestCallback;
  const anchor = {
    href: "",
    download: "",
    hidden: false,
    click: vi.fn(),
    remove: vi.fn(),
  };
  const createElement = vi.fn(() => anchor);
  const append = vi.fn();
  const createObjectURL = vi.fn<(blob: Blob) => string>(
    () => "blob:invented-export",
  );
  const revokeObjectURL = vi.fn();
  const cancelAnimationFrame = vi.fn();
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    frame = callback;
    return 42;
  });
  vi.stubGlobal("document", { createElement, body: { append } });
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.stubGlobal("window", { requestAnimationFrame, cancelAnimationFrame });
  return {
    controller,
    isCurrent,
    anchor,
    createElement,
    append,
    createObjectURL,
    revokeObjectURL,
    cancelAnimationFrame,
    requestAnimationFrame,
    context: { signal: controller.signal, isCurrent },
    frame: () => frame(1),
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("browser company report delivery", () => {
  it("hands the formatter-seam HTML bytes to the real transport in the click task with its own MIME", async () => {
    const test = fixture();
    const pending = htmlDelivery().deliver(htmlDocument, test.context);
    expect(test.anchor.click).toHaveBeenCalledOnce();
    expect(test.anchor.download).toBe(htmlDocument.filename);
    const blob = test.createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe("text/html;charset=utf-8");
    expect(blob.size).toBe(htmlDocument.byteLength);
    expect(await blob.text()).toBe(htmlDocument.text);
    test.frame();
    await expect(pending).resolves.toBe("download_requested");
    expect(test.revokeObjectURL).toHaveBeenCalledOnce();
    expect(test.anchor.remove).toHaveBeenCalledOnce();
  });

  it.each(["aborted", "stale", "pre-activation", "unowned", "click failure"])(
    "applies the existing guarded cleanup to HTML for %s",
    async (kind) => {
      const test = fixture();
      if (kind === "aborted") test.controller.abort();
      if (kind === "stale") test.isCurrent.mockReturnValue(false);
      if (kind === "pre-activation")
        test.append.mockImplementation(() =>
          test.isCurrent.mockReturnValue(false),
        );
      if (kind === "click failure")
        test.anchor.click.mockImplementation(() => {
          throw new Error("private detail");
        });
      const pending = htmlDelivery().deliver(
        kind === "unowned" ? { ...htmlDocument } : htmlDocument,
        test.context,
      );
      if (kind === "unowned" || kind === "click failure")
        await expect(pending).rejects.toThrow("Report download unavailable");
      else await expect(pending).resolves.toBe("cancelled");
      if (kind !== "click failure")
        expect(test.anchor.click).not.toHaveBeenCalled();
      const allocated = kind === "pre-activation" || kind === "click failure";
      expect(test.createObjectURL).toHaveBeenCalledTimes(allocated ? 1 : 0);
      expect(test.revokeObjectURL).toHaveBeenCalledTimes(allocated ? 1 : 0);
    },
  );

  it("releases HTML after retirement without claiming an activated download was undone", async () => {
    const test = fixture();
    const pending = htmlDelivery().deliver(htmlDocument, test.context);
    test.controller.abort();
    await expect(pending).resolves.toBe("download_requested");
    test.frame();
    expect(test.anchor.click).toHaveBeenCalledOnce();
    expect(test.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it("requests the exact UTF-8 file in the click task and releases its temporary resources after a frame", async () => {
    const test = fixture();
    const result = browserCompanyReportAdapter.deliver(value, test.context);
    expect(test.anchor.click).toHaveBeenCalledOnce();
    expect(test.anchor).toMatchObject({
      href: "blob:invented-export",
      download: value.filename,
      hidden: true,
    });
    expect(test.append).toHaveBeenCalledExactlyOnceWith(test.anchor);
    expect(test.anchor.remove).toHaveBeenCalledOnce();
    const blob = test.createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe("application/json;charset=utf-8");
    expect(blob.size).toBe(value.byteLength);
    expect(await blob.text()).toBe(text);
    expect(test.revokeObjectURL).not.toHaveBeenCalled();
    test.frame();
    await expect(result).resolves.toBe("download_requested");
    expect(test.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:invented-export",
    );
    expect(test.cancelAnimationFrame).toHaveBeenCalledWith(42);
    test.controller.abort();
    expect(test.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it.each(["aborted", "retired"])(
    "does not create a file for an already %s operation",
    async (kind) => {
      const test = fixture();
      if (kind === "aborted") test.controller.abort();
      else test.isCurrent.mockReturnValue(false);
      await expect(
        browserCompanyReportAdapter.deliver(value, test.context),
      ).resolves.toBe("cancelled");
      expect(test.createObjectURL).not.toHaveBeenCalled();
      expect(test.anchor.click).not.toHaveBeenCalled();
    },
  );

  it("checks ownership again immediately before the download handoff", async () => {
    const test = fixture();
    test.append.mockImplementation(() => test.isCurrent.mockReturnValue(false));
    await expect(
      browserCompanyReportAdapter.deliver(value, test.context),
    ).resolves.toBe("cancelled");
    expect(test.anchor.click).not.toHaveBeenCalled();
    expect(test.anchor.remove).toHaveBeenCalledOnce();
    expect(test.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it.each(["allocation", "element", "click"])(
    "releases the URL and returns a bounded failure when %s creation/handoff fails",
    async (stage) => {
      const test = fixture();
      const failure = () => {
        throw new Error("private exception must not escape");
      };
      if (stage === "allocation")
        test.createObjectURL.mockImplementation(failure);
      else if (stage === "element")
        test.createElement.mockImplementation(failure);
      else test.anchor.click.mockImplementation(failure);
      await expect(
        browserCompanyReportAdapter.deliver(value, test.context),
      ).rejects.toThrow("Report download unavailable");
      expect(test.revokeObjectURL).toHaveBeenCalledTimes(
        stage === "allocation" ? 0 : 1,
      );
      expect(test.requestAnimationFrame).not.toHaveBeenCalled();
    },
  );

  it("releases an initiated download on cancellation without claiming it can be undone", async () => {
    const test = fixture();
    const result = browserCompanyReportAdapter.deliver(value, test.context);
    test.controller.abort();
    await expect(result).resolves.toBe("download_requested");
    test.frame();
    expect(test.anchor.click).toHaveBeenCalledOnce();
    expect(test.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("still releases an initiated URL if scheduling its normal cleanup fails", async () => {
    const test = fixture();
    test.requestAnimationFrame.mockImplementation(() => {
      throw new Error("unavailable");
    });
    await expect(
      browserCompanyReportAdapter.deliver(value, test.context),
    ).resolves.toBe("download_requested");
    expect(test.revokeObjectURL).toHaveBeenCalledOnce();
    test.controller.abort();
    expect(test.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it.each([
    { ...value, filename: "../../private.txt" },
    { ...value, byteLength: 1 },
    { ...value, purpose: "investment.saved-watchlist" },
    { ...value, filename: value.filename.replace("ZERO", "OTHER") },
    { ...value, text: "not JSON", byteLength: 8 },
    { ...value, extra: true },
    { ...value, text: "\ud800", byteLength: 3 },
  ])(
    "refuses malformed direct documents before allocating output",
    async (document) => {
      const test = fixture();
      await expect(
        browserCompanyReportAdapter.deliver(
          document as CompanyReportDocument,
          test.context,
        ),
      ).rejects.toThrow("Report download unavailable");
      expect(test.createObjectURL).not.toHaveBeenCalled();
    },
  );
});
