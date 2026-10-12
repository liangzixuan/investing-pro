import { describe, expect, it, vi } from "vitest";
import type { InvestmentWatchlistExportPlugin } from "../../src/clerk-trial/native-watchlist-export";
import { MANAGED_WATCHLIST_EXPORT_MAX_BYTES } from "../../src/clerk-trial/managed-watchlist-export-document";
import { createInvalidExportProbe } from "./native-export-fixture";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture() {
  const plugin = {
    choose: vi
      .fn<InvestmentWatchlistExportPlugin["choose"]>()
      .mockResolvedValue({ status: "chosen", handle: "invented-handle" }),
    write: vi
      .fn<InvestmentWatchlistExportPlugin["write"]>()
      .mockRejectedValue({ code: "write_failed" }),
    cancel: vi
      .fn<InvestmentWatchlistExportPlugin["cancel"]>()
      .mockResolvedValue(undefined),
  };
  const publish = vi.fn();
  return { plugin, publish, probe: createInvalidExportProbe(plugin, publish) };
}

describe("native invalid-export fixture handshake", () => {
  it.each(["unicode", "oversize"] as const)(
    "publishes %s before choose and settles refusal only after cleanup",
    async (kind) => {
      const f = fixture();
      const cancelled = deferred<void>();
      const cleanupStarted = deferred<void>();
      f.plugin.cancel.mockImplementation(() => {
        cleanupStarted.resolve();
        return cancelled.promise;
      });
      f.plugin.choose.mockImplementation(() => {
        expect(f.publish).toHaveBeenLastCalledWith(
          {
            sequence: 1,
            kind,
            phase: "choosing",
            failure: null,
            chooseRejectionCode: null,
            cleanupFailed: false,
          },
          false,
        );
        return Promise.resolve({ status: "chosen", handle: "invented-handle" });
      });
      const pending = f.probe.run(kind);
      await cleanupStarted.promise;
      expect(f.plugin.cancel).toHaveBeenCalledOnce();
      expect(f.publish).toHaveBeenLastCalledWith(
        {
          sequence: 1,
          kind,
          phase: "cancelling",
          failure: null,
          chooseRejectionCode: null,
          cleanupFailed: false,
        },
        false,
      );
      expect(f.publish.mock.calls.every((call) => call[1] === false)).toBe(
        true,
      );
      await f.probe.run(kind === "unicode" ? "oversize" : "unicode");
      expect(f.plugin.choose).toHaveBeenCalledOnce();
      const options = f.plugin.write.mock.calls[0]![0];
      expect(f.plugin.choose.mock.calls[0]![0]).toEqual({
        operationId: options.operationId,
        version: 1,
      });
      expect(f.plugin.cancel).toHaveBeenCalledWith({
        operationId: options.operationId,
      });
      expect(options.handle).toBe("invented-handle");
      if (kind === "unicode") expect(options.text).toBe("\ud800");
      else
        expect(new TextEncoder().encode(options.text)).toHaveLength(
          MANAGED_WATCHLIST_EXPORT_MAX_BYTES + 2,
        );
      cancelled.resolve();
      await pending;
      expect(f.publish).toHaveBeenLastCalledWith(
        {
          sequence: 1,
          kind,
          phase: "settled",
          failure: null,
          chooseRejectionCode: null,
          cleanupFailed: false,
        },
        true,
      );
      expect(JSON.stringify(f.publish.mock.calls)).not.toContain(
        "invented-handle",
      );
    },
  );

  it.each([
    "choose_rejected",
    "choose_cancelled",
    "write_succeeded",
    "write_rejected",
  ] as const)(
    "retains %s without counting a valid refusal",
    async (failure) => {
      const f = fixture();
      if (failure === "choose_rejected")
        f.plugin.choose.mockRejectedValue(new Error("Private error text"));
      if (failure === "choose_cancelled")
        f.plugin.choose.mockResolvedValue({ status: "cancelled" });
      if (failure === "write_succeeded")
        f.plugin.write.mockResolvedValue({ status: "written" });
      if (failure === "write_rejected")
        f.plugin.write.mockRejectedValue({ code: "invalid_handle" });
      await f.probe.run("unicode");
      expect(f.publish).toHaveBeenLastCalledWith(
        {
          sequence: 1,
          kind: "unicode",
          phase: "settled",
          failure,
          chooseRejectionCode: failure === "choose_rejected" ? "unknown" : null,
          cleanupFailed: false,
        },
        false,
      );
      expect(f.plugin.cancel).toHaveBeenCalledOnce();
      if (failure.startsWith("choose"))
        expect(f.plugin.write).not.toHaveBeenCalled();
      expect(JSON.stringify(f.publish.mock.calls)).not.toContain(
        "Private error text",
      );
    },
  );

  it.each(["busy", "invalid_input", "unavailable", "private-code"])(
    "retains only the bounded choose rejection code for %s",
    async (code) => {
      const f = fixture();
      f.plugin.choose.mockRejectedValueOnce({
        code,
        message: "Private error text",
        handle: "private-handle",
      });
      await f.probe.run("unicode");
      expect(f.publish).toHaveBeenLastCalledWith(
        {
          sequence: 1,
          kind: "unicode",
          phase: "settled",
          failure: "choose_rejected",
          chooseRejectionCode: code === "private-code" ? "unknown" : code,
          cleanupFailed: false,
        },
        false,
      );
      expect(f.plugin.write).not.toHaveBeenCalled();
      expect(JSON.stringify(f.publish.mock.calls)).not.toMatch(
        /Private|private/,
      );
      await f.probe.run("oversize");
      expect(f.publish).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sequence: 2,
          phase: "settled",
          failure: null,
          chooseRejectionCode: null,
        }),
        true,
      );
    },
  );

  it("retains cleanup failure and permits only a new explicit settled probe", async () => {
    const f = fixture();
    f.plugin.cancel.mockRejectedValueOnce(new Error("Private cleanup error"));
    await f.probe.run("unicode");
    expect(f.publish).toHaveBeenLastCalledWith(
      {
        sequence: 1,
        kind: "unicode",
        phase: "settled",
        failure: null,
        chooseRejectionCode: null,
        cleanupFailed: true,
      },
      false,
    );
    await f.probe.run("oversize");
    expect(f.publish).toHaveBeenLastCalledWith(
      {
        sequence: 2,
        kind: "oversize",
        phase: "settled",
        failure: null,
        chooseRejectionCode: null,
        cleanupFailed: false,
      },
      true,
    );
    expect(f.plugin.choose).toHaveBeenCalledTimes(2);
    expect(f.plugin.choose.mock.calls[0]![0].operationId).not.toBe(
      f.plugin.choose.mock.calls[1]![0].operationId,
    );
  });
});
