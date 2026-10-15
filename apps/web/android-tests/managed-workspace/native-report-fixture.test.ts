import { describe, expect, it, vi } from "vitest";
import {
  createNativeReportProbe,
  reportProbeDocument,
} from "./native-report-fixture";
import {
  COMPANY_REPORT_DOCUMENT_MAX_BYTES,
  isCompanyReportDocument,
} from "../../src/clerk-trial/managed-company-report-document";
import { isSavedWatchlistExportDocument } from "../../src/clerk-trial/managed-watchlist-export-document";
import type { InvestmentCompanyReportPlugin } from "../../src/clerk-trial/native-company-report";

function fixture() {
  const plugin: InvestmentCompanyReportPlugin = {
    choose: vi.fn().mockResolvedValue({
      status: "chosen",
      handle: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    }),
    write: vi.fn().mockResolvedValue({ status: "written" }),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  const publish = vi.fn();
  return { plugin, publish, run: createNativeReportProbe(plugin, publish) };
}

describe("native report boundary probes", () => {
  it("uses the exact full report byte bound with distinct purpose, valid Unicode and JSON", () => {
    const document = reportProbeDocument("maximum");
    expect(document.byteLength).toBe(COMPANY_REPORT_DOCUMENT_MAX_BYTES);
    expect(new TextEncoder().encode(document.text).byteLength).toBe(
      document.byteLength,
    );
    expect(isCompanyReportDocument(document)).toBe(true);
    expect(isSavedWatchlistExportDocument(document)).toBe(false);
    const parsed = JSON.parse(document.text) as {
      authoredResearch: { note: string };
    };
    expect(parsed.authoredResearch.note).toBe("Café 東京 📈");
    expect(document.text.endsWith('"}\n')).toBe(true);
    expect(reportProbeDocument("oversize").byteLength).toBe(
      document.byteLength + 1,
    );
  });

  it("keeps the filename-mismatch probe within the admitted byte bound so it exercises binding", () => {
    const document = reportProbeDocument("filename");
    expect(document.byteLength).toBe(COMPANY_REPORT_DOCUMENT_MAX_BYTES);
    expect(isCompanyReportDocument(document)).toBe(false);
    expect(document.text).toContain('"symbol":"BETA"');
  });

  it("sends only metadata to choose, then the exact complete maximum text and digest", async () => {
    const f = fixture();
    await f.run("maximum");
    const document = reportProbeDocument("maximum");
    const choice = vi.mocked(f.plugin.choose).mock.calls[0]![0];
    expect(choice.operationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(choice).toEqual({
      operationId: choice.operationId,
      purpose: document.purpose,
      filename: document.filename,
    });
    expect(f.plugin.write).toHaveBeenCalledExactlyOnceWith({
      operationId: choice.operationId,
      handle: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      text: document.text,
    });
    const digest = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(document.text),
        ),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    expect(f.publish).toHaveBeenLastCalledWith({
      kind: "maximum",
      phase: "settled",
      byteLength: document.byteLength,
      sha256: digest,
      outcome: "written",
      error: null,
    });
    expect(f.plugin.cancel).toHaveBeenCalledExactlyOnceWith({
      operationId: choice.operationId,
    });
  });

  it.each(["oversize", "unicode", "purpose", "filename"] as const)(
    "observes actual native refusal for %s without treating another error as success",
    async (kind) => {
      const f = fixture();
      vi.mocked(f.plugin.write).mockRejectedValueOnce({ code: "write_failed" });
      await f.run(kind);
      expect(f.publish).toHaveBeenLastCalledWith(
        expect.objectContaining({
          kind,
          phase: "settled",
          outcome: "refused",
          error: null,
        }),
      );
      expect(f.plugin.write).toHaveBeenCalledOnce();
      expect(f.plugin.cancel).toHaveBeenCalledOnce();
      vi.mocked(f.plugin.write).mockRejectedValueOnce({ code: "unknown" });
      await f.run(kind);
      expect(f.publish).toHaveBeenLastCalledWith(
        expect.objectContaining({ error: "unexpected_write_refusal" }),
      );
    },
  );

  it("never writes after picker cancellation and reports failed cleanup without retry", async () => {
    const f = fixture();
    vi.mocked(f.plugin.choose).mockResolvedValueOnce({ status: "cancelled" });
    vi.mocked(f.plugin.cancel).mockRejectedValueOnce(new Error("private"));
    await f.run("maximum");
    expect(f.plugin.write).not.toHaveBeenCalled();
    expect(f.plugin.choose).toHaveBeenCalledOnce();
    expect(f.plugin.cancel).toHaveBeenCalledOnce();
    expect(f.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        phase: "settled",
        outcome: "cancelled",
        error: "cleanup_failed",
      }),
    );
  });
});
