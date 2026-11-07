import { describe, expect, it, vi } from "vitest";
import {
  OwnedReportController,
  type OwnedReportDelivery,
  type OwnedReportMessages,
} from "./owned-report-controller";
import type { TextDocumentDeliveryResult } from "./document-delivery";

const messages: OwnedReportMessages = {
  withdrawn: "withdrawn",
  captureUnavailable: "capture unavailable",
  prepared: "prepared",
  cancelled: "cancelled",
  formatUnavailable: "format unavailable",
  preparing: "preparing",
  saveFailed: "save failed",
  written: "written",
  downloadRequested: "download requested",
};
type Report = { readonly value: string };
function fixture() {
  let report: Report = { value: "first" };
  let current = true;
  const admit = vi.fn((value: unknown) => value === report);
  const format = vi.fn((value: Report) => value.value);
  const deliver = vi
    .fn<OwnedReportDelivery<string>["deliver"]>()
    .mockResolvedValue("written");
  const controller = new OwnedReportController<Report, string>(
    {
      capture: () => ({ report, current: () => current }),
      subscribe: () => () => {},
    },
    { deliver },
    {
      admit: (value: unknown): value is Report => admit(value),
      format,
      messages,
    },
  );
  return {
    controller,
    admit,
    format,
    deliver,
    replace: () => {
      report = { value: "second" };
    },
    retire: () => {
      current = false;
      controller.reconcile();
    },
  };
}

describe("owned report controller", () => {
  it("uses the supplied admission, formatter and messages for a non-screen report", async () => {
    const f = fixture();
    f.controller.prepare();
    expect(f.admit).toHaveBeenCalledWith({ value: "first" });
    expect(f.controller.getSnapshot().message).toBe(messages.prepared);
    expect(f.format).not.toHaveBeenCalled();
    f.deliver.mockResolvedValueOnce("download_requested");
    await f.controller.save();
    expect(f.deliver.mock.calls[0]![0]).toBe("first");
    expect(f.controller.getSnapshot().message).toBe(messages.downloadRequested);
    f.controller.dispose();
  });

  it("rejects an unadmitted capture and a capture retired during admission", async () => {
    for (const mode of ["reject", "reenter"]) {
      const f = fixture();
      f.admit.mockImplementation(() => {
        if (mode === "reenter") f.controller.close();
        return mode !== "reject";
      });
      f.controller.prepare();
      expect(f.controller.getSnapshot().report).toBeNull();
      await f.controller.save();
      expect(f.format).not.toHaveBeenCalled();
      expect(f.deliver).not.toHaveBeenCalled();
      f.controller.dispose();
    }
  });

  it("keeps a replacement capture when the cancelled delivery finishes late", async () => {
    const f = fixture();
    let finish!: (result: TextDocumentDeliveryResult) => void;
    f.deliver.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    f.controller.prepare();
    const pending = f.controller.save();
    const context = f.deliver.mock.calls[0]![1];
    f.controller.cancel();
    expect(context.signal.aborted).toBe(true);
    expect(context.isCurrent()).toBe(false);
    expect(f.controller.getSnapshot().message).toBe(messages.cancelled);
    f.replace();
    f.controller.prepare();
    finish("written");
    await pending;
    expect(f.controller.getSnapshot()).toEqual({
      report: { value: "second" },
      saving: false,
      message: messages.prepared,
    });
    await f.controller.save();
    expect(f.controller.getSnapshot().message).toBe(messages.written);
    f.retire();
    expect(f.controller.getSnapshot()).toEqual({
      report: null,
      saving: false,
      message: messages.withdrawn,
    });
    f.controller.dispose();
  });
});
