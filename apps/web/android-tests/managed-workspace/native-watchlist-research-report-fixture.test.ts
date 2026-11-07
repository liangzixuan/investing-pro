import { expect, it, vi } from "vitest";
import { createNativeWatchlistResearchReportFixture } from "./native-watchlist-research-report-fixture";
import type { InvestmentWatchlistResearchReportPlugin } from "../../src/clerk-trial/watchlist-research-report-delivery";
import type { WatchlistResearchReportHtmlDocument } from "../../src/clerk-trial/watchlist-research-report-ports";

// Transport observations only. The real formatter and native policy are exercised
// by the complete chosen-document instrumentation journey.
const owned = vi.hoisted(() => new WeakSet<object>());
vi.mock("../../src/clerk-trial/watchlist-research-report-html", () => ({
  isWatchlistResearchReportHtmlDocument: (value: unknown) =>
    typeof value === "object" && value !== null && owned.has(value),
}));
const text =
  "<!doctype html>\n<html><body>Invented Café 東京 📈</body></html>\n";
const document: WatchlistResearchReportHtmlDocument = Object.freeze({
  purpose: "investment.watchlist-research-html",
  filename: "Investment-watchlist-research-20261107T000000000Z.html",
  text,
  byteLength: new TextEncoder().encode(text).byteLength,
});
owned.add(document);
const handle = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
function plugin() {
  return {
    choose: vi
      .fn<InvestmentWatchlistResearchReportPlugin["choose"]>()
      .mockResolvedValue({ status: "chosen", handle }),
    write: vi
      .fn<InvestmentWatchlistResearchReportPlugin["write"]>()
      .mockResolvedValue({ status: "written" }),
    cancel: vi
      .fn<InvestmentWatchlistResearchReportPlugin["cancel"]>()
      .mockResolvedValue(undefined),
  };
}
function context() {
  return { signal: new AbortController().signal, isCurrent: () => true };
}
it("forwards the real adapter metadata and full bytes while observing no report contents", async () => {
  const bridge = plugin(),
    f = createNativeWatchlistResearchReportFixture(bridge),
    notify = vi.fn();
  const stop = f.subscribe(notify);
  await expect(f.delivery.deliver(document, context())).resolves.toBe(
    "written",
  );
  const metadata = bridge.choose.mock.calls[0]![0];
  expect(Object.keys(metadata).sort()).toEqual([
    "filename",
    "operationId",
    "purpose",
  ]);
  expect(metadata).toMatchObject({
    purpose: document.purpose,
    filename: document.filename,
  });
  expect(bridge.write).toHaveBeenCalledExactlyOnceWith({
    operationId: metadata.operationId,
    handle,
    text,
  });
  expect(f.getSnapshot()).toEqual({
    choices: 1,
    writeRequests: 1,
    writes: 1,
    cancels: 1,
    filename: document.filename,
    byteLength: document.byteLength,
  });
  expect(JSON.stringify(f.getSnapshot())).not.toContain("Invented");
  expect(notify).toHaveBeenCalledTimes(4);
  stop();
});
it("records a cancelled picker without any write request or report bytes", async () => {
  const bridge = plugin();
  bridge.choose.mockResolvedValue({ status: "cancelled" });
  const f = createNativeWatchlistResearchReportFixture(bridge);
  await expect(f.delivery.deliver(document, context())).resolves.toBe(
    "cancelled",
  );
  expect(f.getSnapshot()).toEqual({
    choices: 1,
    writeRequests: 0,
    writes: 0,
    cancels: 1,
    filename: document.filename,
    byteLength: 0,
  });
  expect(bridge.write).not.toHaveBeenCalled();
});
it("records a failed write request without claiming written bytes", async () => {
  const bridge = plugin();
  bridge.write.mockRejectedValue(new Error("Invented provider failure"));
  const f = createNativeWatchlistResearchReportFixture(bridge);
  await expect(f.delivery.deliver(document, context())).rejects.toThrow(
    "Watchlist research report save unavailable",
  );
  expect(f.getSnapshot()).toMatchObject({
    choices: 1,
    writeRequests: 1,
    writes: 0,
    cancels: 1,
    byteLength: 0,
  });
});
it("does not open a picker for an unowned report or retired context", async () => {
  const bridge = plugin(),
    f = createNativeWatchlistResearchReportFixture(bridge);
  await expect(f.delivery.deliver({ ...document }, context())).rejects.toThrow(
    "Watchlist research report save unavailable",
  );
  await expect(
    f.delivery.deliver(document, { ...context(), isCurrent: () => false }),
  ).resolves.toBe("cancelled");
  expect(f.getSnapshot()).toEqual({
    choices: 0,
    writeRequests: 0,
    writes: 0,
    cancels: 0,
    filename: "",
    byteLength: 0,
  });
  expect(bridge.choose).not.toHaveBeenCalled();
});
