import { describe, expect, it, vi } from "vitest";
import {
  createNativeCompanyReportAdapter,
  type InvestmentCompanyReportPlugin,
} from "./native-company-report";
import {
  COMPANY_REPORT_DOCUMENT_MAX_BYTES,
  type CompanyReportDocument,
} from "./managed-company-report-document";

const handle = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const text =
  JSON.stringify({
    purpose: "investment.company-research",
    schemaVersion: "6.0.0",
    preparedAt: "2026-10-15T00:00:00.000Z",
    listing: { symbol: "ZERO", exchangeMic: "XNAS" },
    authoredResearch: { note: "Invented draft: Café 東京 📈\nwhitespace  " },
  }) + "\n";
function document(): CompanyReportDocument {
  return {
    purpose: "investment.company-research",
    filename: "Investment-research-ZERO-XNAS-20261015T000000000Z.json",
    text,
    byteLength: new TextEncoder().encode(text).byteLength,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture() {
  const plugin: InvestmentCompanyReportPlugin = {
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
  const abort = new AbortController();
  const isCurrent = vi.fn(() => true);
  return {
    plugin,
    abort,
    isCurrent,
    context: { signal: abort.signal, isCurrent },
    adapter: createNativeCompanyReportAdapter(plugin, {
      choose: () => Promise.resolve({ status: "cancelled" }),
      write: () => Promise.resolve({ status: "written" }),
      cancel: () => Promise.resolve(),
    }),
  };
}

describe("native company report delivery", () => {
  it("chooses with metadata only, then writes the captured exact UTF-8 text and same operation", async () => {
    const { plugin, context, adapter } = fixture();
    await expect(adapter.deliver(document(), context)).resolves.toBe("written");
    const options = vi.mocked(plugin.choose).mock.calls[0]![0];
    expect(Object.keys(options).sort()).toEqual([
      "filename",
      "operationId",
      "purpose",
    ]);
    expect(options.filename).toBe(document().filename);
    expect(options.purpose).toBe(document().purpose);
    expect(adapter.destination).toBe("system_document");
    expect(options.operationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(plugin.write).toHaveBeenCalledExactlyOnceWith({
      operationId: options.operationId,
      handle,
      text,
    });
    expect(plugin.cancel).toHaveBeenCalledExactlyOnceWith({
      operationId: options.operationId,
    });
  });

  it("writes the captured document even if the caller mutates the original object", async () => {
    const { plugin, context, adapter } = fixture();
    const held =
      deferred<Awaited<ReturnType<InvestmentCompanyReportPlugin["choose"]>>>();
    vi.mocked(plugin.choose).mockReturnValueOnce(held.promise);
    const original = document();
    const pending = adapter.deliver(original, context);
    Object.assign(original, {
      filename: "later.json",
      text: "Later unsaved content",
    });
    held.resolve({ status: "chosen", handle });
    await expect(pending).resolves.toBe("written");
    expect(vi.mocked(plugin.write).mock.calls[0]![0].text).toBe(text);
  });

  it.each(["signal", "report identity"] as const)(
    "refuses a late picker result after %s retires the captured report",
    async (kind) => {
      const { plugin, context, adapter, abort, isCurrent } = fixture();
      const held =
        deferred<
          Awaited<ReturnType<InvestmentCompanyReportPlugin["choose"]>>
        >();
      vi.mocked(plugin.choose).mockReturnValueOnce(held.promise);
      const pending = adapter.deliver(document(), context);
      if (kind === "signal") abort.abort();
      else isCurrent.mockReturnValue(false);
      held.resolve({ status: "chosen", handle });
      await expect(pending).resolves.toBe("cancelled");
      expect(plugin.write).not.toHaveBeenCalled();
      expect(plugin.cancel).toHaveBeenCalledOnce();
    },
  );

  it("does not choose when the initiating view is already retired", async () => {
    const { plugin, context, adapter, abort } = fixture();
    abort.abort();
    await expect(adapter.deliver(document(), context)).resolves.toBe(
      "cancelled",
    );
    expect(plugin.choose).not.toHaveBeenCalled();
  });

  it("refuses duplicate operations and permits a fresh operation only after settlement", async () => {
    const { plugin, context, adapter } = fixture();
    const held =
      deferred<Awaited<ReturnType<InvestmentCompanyReportPlugin["choose"]>>>();
    vi.mocked(plugin.choose).mockReturnValueOnce(held.promise);
    const pending = adapter.deliver(document(), context);
    await expect(adapter.deliver(document(), context)).rejects.toThrow(
      "Report save unavailable",
    );
    expect(plugin.choose).toHaveBeenCalledOnce();
    held.resolve({ status: "cancelled" });
    await expect(pending).resolves.toBe("cancelled");
    await expect(adapter.deliver(document(), context)).resolves.toBe("written");
    const calls = vi.mocked(plugin.choose).mock.calls;
    expect(calls[0]![0].operationId).not.toBe(calls[1]![0].operationId);
    expect(plugin.write).toHaveBeenCalledOnce();
  });

  it.each([
    { text: "\ud800", byteLength: 3 },
    {
      text: "x".repeat(COMPANY_REPORT_DOCUMENT_MAX_BYTES + 1),
      byteLength: COMPANY_REPORT_DOCUMENT_MAX_BYTES + 1,
    },
    { byteLength: 1 },
    { filename: "private-note.txt" },
  ])(
    "refuses malformed direct input before any picker or write",
    async (change) => {
      const { plugin, context, adapter } = fixture();
      await expect(
        adapter.deliver({ ...document(), ...change }, context),
      ).rejects.toThrow("Report save unavailable");
      expect(plugin.choose).not.toHaveBeenCalled();
      expect(plugin.write).not.toHaveBeenCalled();
    },
  );

  it.each(["2.0.0", "3.0.0", "4.0.0"])(
    "refuses schema %s before opening the picker",
    async (schema) => {
      const { adapter, plugin, context } = fixture();
      const oldText = text.replace(
        '"schemaVersion":"6.0.0"',
        `"schemaVersion":"${schema}"`,
      );
      await expect(
        adapter.deliver(
          {
            ...document(),
            text: oldText,
            byteLength: new TextEncoder().encode(oldText).byteLength,
          },
          context,
        ),
      ).rejects.toThrow("Report save unavailable");
      expect(plugin.choose).not.toHaveBeenCalled();
      expect(plugin.write).not.toHaveBeenCalled();
    },
  );

  it("rejects a malformed native handle without delivering text", async () => {
    const { plugin, context, adapter } = fixture();
    vi.mocked(plugin.choose).mockResolvedValueOnce({
      status: "chosen",
      handle: "content://untrusted/path",
    });
    await expect(adapter.deliver(document(), context)).rejects.toThrow(
      "Report save unavailable",
    );
    expect(plugin.write).not.toHaveBeenCalled();
    expect(plugin.cancel).toHaveBeenCalledOnce();
  });

  it("bounds write errors and contains cancellation errors without retrying", async () => {
    const { plugin, context, adapter } = fixture();
    vi.mocked(plugin.write).mockRejectedValueOnce(
      new Error("private URI and note content"),
    );
    vi.mocked(plugin.cancel).mockImplementationOnce(() => {
      throw new Error("private native state");
    });
    await expect(adapter.deliver(document(), context)).rejects.toThrow(
      /^Report save unavailable$/u,
    );
    expect(plugin.write).toHaveBeenCalledOnce();
    expect(plugin.choose).toHaveBeenCalledOnce();
  });

  it("does not report a late written result into a retired view", async () => {
    const { plugin, context, adapter, abort } = fixture();
    const held = deferred<{ status: "written" }>();
    vi.mocked(plugin.write).mockReturnValueOnce(held.promise);
    const pending = adapter.deliver(document(), context);
    await Promise.resolve();
    expect(plugin.write).toHaveBeenCalledOnce();
    abort.abort();
    held.resolve({ status: "written" });
    await expect(pending).resolves.toBe("cancelled");
    expect(plugin.write).toHaveBeenCalledOnce();
  });
});
