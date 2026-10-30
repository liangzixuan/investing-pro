import {
  archiveBytes,
  archiveHtmlFixture,
} from "./portfolio-report-archive-fixture";
import { describe, expect, it, vi } from "vitest";
import { PortfolioReportRevisit } from "./portfolio-report-revisit";
import { PortfolioReviewReportController } from "./portfolio-review-report-controller";
import { preparePortfolioReviewReport } from "./portfolio-review-report";
import { portfolioReviewReportFixture } from "./portfolio-review-report-fixture";
import { formatPortfolioReviewReportHtml } from "./portfolio-review-report-html";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
function fixture() {
  const report = preparePortfolioReviewReport(portfolioReviewReportFixture());
  if (!report) throw new Error("Invented report missing");
  const bytes = archiveBytes(archiveHtmlFixture(report));
  const listeners = new Set<() => void>();
  let epoch = 0;
  let route = 0;
  const capture = vi.fn(() => {
    const version = epoch;
    const visit = route;
    return { report, current: () => version === epoch && route === visit };
  });
  const deliver = vi.fn().mockResolvedValue("written");
  const reports = new PortfolioReviewReportController(
    {
      capture,
      captureReadScope: () => {
        const visit = route;
        return () => visit === route;
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    { deliver },
    formatPortfolioReviewReportHtml,
  );
  const revisit = new PortfolioReportRevisit(reports);
  const file = {
    name: "invented.html",
    size: bytes.byteLength,
    arrayBuffer: vi.fn(() => Promise.resolve(bytes)),
  };
  const change = () => {
    epoch += 1;
    for (const listener of listeners) listener();
  };
  return {
    report,
    bytes,
    capture,
    deliver,
    reports,
    revisit,
    file,
    change,
    route: () => {
      route += 1;
    },
  };
}
async function compare(f: ReturnType<typeof fixture>) {
  f.revisit.choose(f.file);
  expect(await f.revisit.read()).toBe(true);
  f.reports.prepare();
  expect(f.revisit.compare()).toBe(true);
}
describe("local Portfolio report revisit ownership", () => {
  it("requires separate choose, read, current capture and compare without delivery", async () => {
    const f = fixture();
    f.revisit.choose(f.file);
    expect(f.file.arrayBuffer).not.toHaveBeenCalled();
    expect(f.capture).not.toHaveBeenCalled();
    expect(await f.revisit.read()).toBe(true);
    expect(f.revisit.compare()).toBe(false);
    f.reports.prepare();
    expect(f.revisit.getSnapshot().comparison).toBeNull();
    expect(f.revisit.compare()).toBe(true);
    expect(f.revisit.getSnapshot().comparison?.current).toBe(f.report);
    expect(f.deliver).not.toHaveBeenCalled();
  });
  it("admits the snapshot-rendered HTML envelope and preserves the full saved report", async () => {
    const f = fixture();
    await compare(f);
    expect(f.revisit.getSnapshot().saved).toEqual(f.report);
    expect(f.revisit.getSnapshot().comparison?.saved).toBe(
      f.revisit.getSnapshot().saved,
    );
  });
  it.each([0, -1, 8 * 1024 * 1024 + 1, NaN, 0.5])(
    "rejects declared size %s before reading",
    async (size) => {
      const f = fixture();
      f.revisit.choose({ ...f.file, size });
      await f.revisit.read();
      expect(f.file.arrayBuffer).not.toHaveBeenCalled();
    },
  );
  it("rejects a changed actual byte size and malformed content", async () => {
    for (const size of [1, 3]) {
      const f = fixture();
      f.revisit.choose({
        name: "bad.html",
        size,
        arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
      });
      expect(await f.revisit.read()).toBe(false);
      expect(f.revisit.getSnapshot().saved).toBeNull();
      expect(f.revisit.getSnapshot().message).toBe(
        "This file could not be read as a Portfolio report. Choose an unchanged report saved by this app.",
      );
    }
  });
  it.each(["clear", "replace", "source", "route", "dispose"] as const)(
    "fences a late read after %s",
    async (action) => {
      const f = fixture();
      const pending = deferred<ArrayBuffer>();
      f.revisit.choose({ ...f.file, arrayBuffer: () => pending.promise });
      const read = f.revisit.read();
      if (action === "clear") f.revisit.clear();
      if (action === "replace")
        f.revisit.choose({ ...f.file, name: "replacement.html" });
      if (action === "source") f.change();
      if (action === "route") f.route();
      if (action === "dispose") f.revisit.dispose();
      pending.resolve(f.bytes);
      expect(await read).toBe(false);
      expect(f.revisit.getSnapshot().saved).toBeNull();
    },
  );
  it("withdraws comparison on current source change while retaining the local archive", async () => {
    const f = fixture();
    await compare(f);
    const archive = f.revisit.getSnapshot().saved;
    f.change();
    expect(f.revisit.getSnapshot().comparison).toBeNull();
    expect(f.revisit.getSnapshot().saved).toBe(archive);
    f.reports.prepare();
    expect(f.revisit.getSnapshot().comparison).toBeNull();
    expect(f.revisit.compare()).toBe(true);
  });
  it("cannot navigate with a stale route even without a notification", async () => {
    const f = fixture();
    await compare(f);
    const action = vi.fn();
    f.route();
    f.revisit.research(
      f.report.portfolio.holdings[0]!.identity.listingId,
      action,
    );
    expect(action).not.toHaveBeenCalled();
    expect(f.revisit.getSnapshot().comparison).toBeNull();
  });
  it("navigates only a current compared row and never changes the report", async () => {
    const f = fixture();
    await compare(f);
    const action = vi.fn();
    f.revisit.research("foreign", action);
    expect(action).not.toHaveBeenCalled();
    f.revisit.research(
      f.report.portfolio.holdings[0]!.identity.listingId,
      action,
    );
    expect(action).toHaveBeenCalledOnce();
    expect(f.report).toEqual(f.revisit.getSnapshot().saved);
  });
  it("does not start file IO after a reentrant cancellation", async () => {
    const f = fixture();
    f.revisit.choose(f.file);
    f.revisit.subscribe(() => {
      if (f.revisit.getSnapshot().reading) f.revisit.clear();
    });
    expect(await f.revisit.read()).toBe(false);
    expect(f.file.arrayBuffer).not.toHaveBeenCalled();
  });
  it("does not report success after a reentrant archive or comparison clear", async () => {
    const f = fixture();
    f.revisit.choose(f.file);
    const stop = f.revisit.subscribe(() => {
      if (f.revisit.getSnapshot().saved) f.revisit.clear();
    });
    expect(await f.revisit.read()).toBe(false);
    stop();
    f.revisit.choose(f.file);
    await f.revisit.read();
    f.reports.prepare();
    f.revisit.subscribe(() => {
      if (f.revisit.getSnapshot().comparison) f.revisit.clear();
    });
    expect(f.revisit.compare()).toBe(false);
  });
  it("retires a comparison through save and does not revive its capability afterward", async () => {
    const f = fixture();
    await compare(f);
    const capture = f.reports.captureCurrent();
    await f.reports.save();
    expect(capture?.current()).toBe(false);
    expect(f.revisit.getSnapshot().comparison).toBeNull();
  });
  it("does not allow a disposal observer to choose another file", () => {
    const f = fixture();
    f.revisit.choose(f.file);
    f.revisit.subscribe(() => f.revisit.choose(f.file));
    f.revisit.dispose();
    expect(f.revisit.getSnapshot().filename).toBe("");
    expect(f.revisit.getSnapshot().saved).toBeNull();
  });
  it("clears a rejected read when its route scope retired without notification", async () => {
    const f = fixture();
    let reject!: (reason: Error) => void;
    const pending = new Promise<ArrayBuffer>((_resolve, fail) => {
      reject = fail;
    });
    f.revisit.choose({ ...f.file, arrayBuffer: () => pending });
    const read = f.revisit.read();
    f.route();
    reject(new Error("Invented file read failure"));
    expect(await read).toBe(false);
    expect(f.revisit.getSnapshot().reading).toBe(false);
    expect(f.revisit.getSnapshot().filename).toBe("");
    expect(f.revisit.getSnapshot().saved).toBeNull();
  });
});
