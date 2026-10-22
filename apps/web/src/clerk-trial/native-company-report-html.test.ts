import { describe, expect, it, vi } from "vitest";
import {
  createNativeCompanyReportAdapter,
  type InvestmentCompanyReportPlugin,
  type InvestmentCompanyReportHtmlPlugin,
} from "./native-company-report";
import type { CompanyReportHtmlDocument } from "./managed-company-report-html";
import type { CompanyReportDocument } from "./managed-company-report-document";

// Transport-only ownership seam. The native fixture exercises the real detached
// React formatter, fixed envelope, policy and chosen-document writer together.
const owned = vi.hoisted(() => new WeakSet<object>());
vi.mock("./managed-company-report-html", () => ({
  formatCompanyReportHtml: vi.fn(),
  isCompanyReportHtmlDocument: (value: unknown) =>
    typeof value === "object" && value !== null && owned.has(value),
}));
const handle = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const text =
  "<!doctype html>\n<html><body>Invented Café 東京 📈</body></html>\n";
const document: CompanyReportHtmlDocument = Object.freeze({
  purpose: "investment.company-research-html",
  filename: "Investment-research-ZERO-XNAS-20261015T000000000Z.html",
  text,
  byteLength: new TextEncoder().encode(text).byteLength,
});
owned.add(document);
const jsonText = JSON.stringify({
  purpose: "investment.company-research",
  schemaVersion: "5.0.0",
  preparedAt: "2026-10-15T00:00:00.000Z",
  listing: { symbol: "ZERO", exchangeMic: "XNAS" },
});
const jsonDocument: CompanyReportDocument = {
  purpose: "investment.company-research",
  filename: document.filename.replace(/\.html$/u, ".json"),
  text: jsonText,
  byteLength: new TextEncoder().encode(jsonText).byteLength,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture() {
  const json: InvestmentCompanyReportPlugin = {
    choose: vi
      .fn<InvestmentCompanyReportPlugin["choose"]>()
      .mockResolvedValue({ status: "chosen", handle }),
    write: vi
      .fn<InvestmentCompanyReportPlugin["write"]>()
      .mockResolvedValue({ status: "written" }),
    cancel: vi
      .fn<InvestmentCompanyReportPlugin["cancel"]>()
      .mockResolvedValue(),
  };
  const html: InvestmentCompanyReportHtmlPlugin = {
    choose: vi
      .fn<InvestmentCompanyReportHtmlPlugin["choose"]>()
      .mockResolvedValue({ status: "chosen", handle }),
    write: vi
      .fn<InvestmentCompanyReportHtmlPlugin["write"]>()
      .mockResolvedValue({ status: "written" }),
    cancel: vi
      .fn<InvestmentCompanyReportHtmlPlugin["cancel"]>()
      .mockResolvedValue(),
  };
  const adapter = createNativeCompanyReportAdapter(json, html);
  const controller = new AbortController();
  const isCurrent = vi.fn(() => true);
  if (!adapter.html) throw new Error("Missing native HTML capability");
  return {
    json,
    html,
    adapter,
    delivery: adapter.html,
    controller,
    isCurrent,
    context: { signal: controller.signal, isCurrent },
  };
}
describe("native readable company report delivery", () => {
  it("chooses HTML using metadata only, then writes exact captured UTF-8 text through its own plugin", async () => {
    const f = fixture();
    await expect(f.delivery.deliver(document, f.context)).resolves.toBe(
      "written",
    );
    expect(f.adapter.destination).toBe("system_document");
    const options = vi.mocked(f.html.choose).mock.calls[0]![0];
    expect(Object.keys(options).sort()).toEqual([
      "filename",
      "operationId",
      "purpose",
    ]);
    expect(options.operationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(options.purpose).toBe(document.purpose);
    expect(options.filename).toBe(document.filename);
    expect(f.html.write).toHaveBeenCalledExactlyOnceWith({
      operationId: options.operationId,
      handle,
      text,
    });
    expect(f.html.cancel).toHaveBeenCalledExactlyOnceWith({
      operationId: options.operationId,
    });
    for (const method of Object.values(f.json))
      expect(method).not.toHaveBeenCalled();
  });
  it.each(["html first", "json first"] as const)(
    "shares one pending operation across formats: %s",
    async (first) => {
      const f = fixture();
      const held = deferred<{ status: "cancelled" }>();
      const firstPlugin = first === "html first" ? f.html : f.json;
      vi.mocked(firstPlugin.choose).mockReturnValueOnce(held.promise);
      const pending =
        first === "html first"
          ? f.delivery.deliver(document, f.context)
          : f.adapter.deliver(jsonDocument, f.context);
      const duplicate =
        first === "html first"
          ? f.adapter.deliver(jsonDocument, f.context)
          : f.delivery.deliver(document, f.context);
      await expect(duplicate).rejects.toThrow("Report save unavailable");
      const other = first === "html first" ? f.json : f.html;
      expect(other.choose).not.toHaveBeenCalled();
      held.resolve({ status: "cancelled" });
      await expect(pending).resolves.toBe("cancelled");
      await expect(
        first === "html first"
          ? f.adapter.deliver(jsonDocument, f.context)
          : f.delivery.deliver(document, f.context),
      ).resolves.toBe("written");
      expect(vi.mocked(f.json.choose).mock.calls[0]![0].operationId).not.toBe(
        vi.mocked(f.html.choose).mock.calls[0]![0].operationId,
      );
    },
  );
  it.each(["abort", "report edit"] as const)(
    "refuses a late HTML destination after %s",
    async (kind) => {
      const f = fixture();
      const held = deferred<{ status: "chosen"; handle: string }>();
      vi.mocked(f.html.choose).mockReturnValueOnce(held.promise);
      const pending = f.delivery.deliver(document, f.context);
      if (kind === "abort") f.controller.abort();
      else f.isCurrent.mockReturnValue(false);
      held.resolve({ status: "chosen", handle });
      await expect(pending).resolves.toBe("cancelled");
      expect(f.html.write).not.toHaveBeenCalled();
      expect(f.html.cancel).toHaveBeenCalledOnce();
      expect(f.json.choose).not.toHaveBeenCalled();
    },
  );
  it("refuses retired views before choosing a destination", async () => {
    const f = fixture();
    f.controller.abort();
    await expect(f.delivery.deliver(document, f.context)).resolves.toBe(
      "cancelled",
    );
    expect(f.html.choose).not.toHaveBeenCalled();
  });
  it("rejects cloned or hostile unowned documents without reading traps or invoking a picker", async () => {
    const f = fixture();
    const trap = vi.fn(() => {
      throw new Error("Must not read");
    });
    const hostile = new Proxy({}, { get: trap, ownKeys: trap });
    for (const value of [{ ...document }, hostile]) {
      await expect(
        f.delivery.deliver(value as CompanyReportHtmlDocument, f.context),
      ).rejects.toThrow("Report save unavailable");
    }
    expect(trap).not.toHaveBeenCalled();
    expect(f.html.choose).not.toHaveBeenCalled();
    expect(f.html.write).not.toHaveBeenCalled();
  });
  it("contains native failures and retires late write results without claiming rollback", async () => {
    const f = fixture();
    vi.mocked(f.html.write).mockRejectedValueOnce(
      new Error("private destination"),
    );
    await expect(f.delivery.deliver(document, f.context)).rejects.toThrow(
      /^Report save unavailable$/u,
    );
    expect(f.html.write).toHaveBeenCalledOnce();
    const held = deferred<{ status: "written" }>();
    vi.mocked(f.html.write).mockReturnValueOnce(held.promise);
    const pending = f.delivery.deliver(document, f.context);
    await Promise.resolve();
    f.controller.abort();
    held.resolve({ status: "written" });
    await expect(pending).resolves.toBe("cancelled");
    expect(f.html.write).toHaveBeenCalledTimes(2);
  });
});
