import * as React from "react";
import { registerPlugin } from "@capacitor/core";
import { describe, expect, it, vi } from "vitest";
import {
  createNativeReportProbe,
  createNativeReportFixture,
  reportProbeDocument,
} from "./native-report-fixture";
import {
  COMPANY_REPORT_DOCUMENT_MAX_BYTES,
  isCompanyReportDocument,
} from "../../src/clerk-trial/managed-company-report-document";
import { isSavedWatchlistExportDocument } from "../../src/clerk-trial/managed-watchlist-export-document";
import {
  createNativeCompanyReportAdapter,
  type InvestmentCompanyReportPlugin,
  type InvestmentCompanyReportHtmlPlugin,
} from "../../src/clerk-trial/native-company-report";
import type * as NativeReportModule from "../../src/clerk-trial/native-company-report";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";

vi.mock("@capacitor/core", () => ({ registerPlugin: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read(),
}));
vi.mock("../../src/clerk-trial/native-company-report", async (original) => {
  const actual = await original<typeof NativeReportModule>();
  return {
    ...actual,
    createNativeCompanyReportAdapter: vi.fn(
      actual.createNativeCompanyReportAdapter,
    ),
  };
});

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

function htmlFixture() {
  const json = fixture().plugin;
  const html: InvestmentCompanyReportHtmlPlugin = {
    choose: vi.fn().mockResolvedValue({
      status: "chosen",
      handle: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    }),
    write: vi.fn().mockResolvedValue({ status: "written" }),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(registerPlugin)
    .mockReset()
    .mockReturnValueOnce(json)
    .mockReturnValueOnce(html);
  const report = createNativeReportFixture();
  const [jsonBridge, htmlBridge] = vi
    .mocked(createNativeCompanyReportAdapter)
    .mock.calls.at(-1)!;
  const note = vi.fn(),
    retire = vi.fn();
  const workspace = {
    note,
    coordinator: { retire },
  } as unknown as ManagedWorkspace;
  const controls = () => report.Controls({ workspace });
  return { json, html, report, jsonBridge, htmlBridge, note, retire, controls };
}
type Control = React.ReactElement<{
  id?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}>;
function control(f: ReturnType<typeof htmlFixture>, id: string): Control {
  const controls = f.controls();
  if (!React.isValidElement<{ children?: React.ReactNode }>(controls))
    throw new Error("Expected fixture controls");
  const found = React.Children.toArray(controls.props.children).find(
    (child) =>
      React.isValidElement<{ id?: string }>(child) && child.props.id === id,
  );
  if (!React.isValidElement<Control["props"]>(found))
    throw new Error(`Expected fixture control ${id}`);
  return found;
}
function protocol(f: ReturnType<typeof htmlFixture>) {
  return JSON.parse(
    control(f, "fixture-report-protocol").props.children as string,
  ) as {
    mismatchRefused: number;
    duplicateRefused: number;
    replayRefused: number;
    writesSettled: number;
    cancelsSettled: number;
    protocolError: boolean;
    html: {
      choicesStarted: number;
      writesSettled: number;
      cancelsSettled: number;
    };
  };
}
describe("separate native HTML report fixture", () => {
  it("registers both real plugin names and exposes native HTML without starting an operation", () => {
    const f = htmlFixture();
    expect(registerPlugin).toHaveBeenNthCalledWith(
      1,
      "InvestmentCompanyReport",
    );
    expect(registerPlugin).toHaveBeenNthCalledWith(
      2,
      "InvestmentCompanyReportHtml",
    );
    expect(f.report.delivery.destination).toBe("system_document");
    expect(typeof f.report.delivery.html?.format).toBe("function");
    expect(f.html.choose).not.toHaveBeenCalled();
    expect(f.json.choose).not.toHaveBeenCalled();
  });
  it("passes HTML metadata and full text to only its separate plugin and counters", async () => {
    const f = htmlFixture();
    const operationId = crypto.randomUUID();
    const metadata = {
      operationId,
      purpose: "investment.company-research-html" as const,
      filename: "Investment-research-ZERO-XNAS-20261015T000000000Z.html",
    };
    const choice = await f.htmlBridge.choose(metadata);
    expect(f.html.choose).toHaveBeenCalledExactlyOnceWith(metadata);
    expect(choice.status).toBe("chosen");
    if (choice.status !== "chosen")
      throw new Error("Expected invented destination");
    const write = {
      operationId,
      handle: choice.handle,
      text: "Complete invented HTML bytes",
    };
    await f.htmlBridge.write(write);
    await f.htmlBridge.cancel({ operationId });
    expect(f.html.write).toHaveBeenCalledExactlyOnceWith(write);
    expect(f.html.cancel).toHaveBeenCalledExactlyOnceWith({ operationId });
    expect(f.json.write).not.toHaveBeenCalled();
    expect(protocol(f)).toMatchObject({
      mismatchRefused: 0,
      duplicateRefused: 0,
      replayRefused: 0,
      writesSettled: 0,
      cancelsSettled: 0,
      protocolError: false,
      html: { choicesStarted: 1, writesSettled: 1, cancelsSettled: 1 },
    });
  });
  it("uses the existing deliberate draft-edit and retirement controls after an HTML choice", async () => {
    const f = htmlFixture();
    const metadata = {
      operationId: crypto.randomUUID(),
      purpose: "investment.company-research-html" as const,
      filename: "Investment-research-ZERO-XNAS-20261015T000000000Z.html",
    };
    control(f, "fixture-report-edit").props.onClick!();
    await f.htmlBridge.choose(metadata);
    expect(f.note).toHaveBeenCalledExactlyOnceWith(
      "listing-zero",
      "Changed after report choice",
    );
    control(f, "fixture-report-retire").props.onClick!();
    await f.htmlBridge.choose({
      ...metadata,
      operationId: crypto.randomUUID(),
    });
    expect(f.retire).toHaveBeenCalledOnce();
    expect(f.html.write).not.toHaveBeenCalled();
    expect(protocol(f).writesSettled).toBe(0);
  });
});
