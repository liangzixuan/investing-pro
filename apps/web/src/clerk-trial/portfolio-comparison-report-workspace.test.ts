import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedWorkspace } from "./managed-workspace";
import { capturePortfolioCloseContext } from "./portfolio-close-review-context";
import { capturePortfolioReportReadScope } from "./portfolio-report-revisit-scope";
import { PortfolioReviewReportController } from "./portfolio-review-report-controller";
import { PortfolioReportRevisit } from "./portfolio-report-revisit";
import {
  archiveBytes,
  archiveHtmlFixture,
} from "./portfolio-report-archive-fixture";
import { createFixture } from "../../android-tests/managed-workspace/fixture";

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup());
  vi.useRealTimers();
});
async function sequence() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T12:00:00.000Z"));
  const fixture = await createFixture("portfolio-comparison-report");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      priceCoverage: fixture.priceCoverage,
      marketsCohort: fixture.marketsCohort,
    },
  );
  cleanups.push(() => workspace.sessionOwner.dispose());
  workspace.setView("portfolio");
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  await workspace.portfolio.coordinator.load();
  await workspace.portfolio.reviewCatalog();
  workspace.portfolio.applyReview();
  const baseline = workspace.createPortfolioCloseReview();
  baseline.enter(capturePortfolioCloseContext(workspace));
  await baseline.load();
  const saved = baseline.captureReport("2026-10-30T12:00:01.000Z")!.report;
  const control = fixture.portfolioReportComparison!;
  const draft = workspace.portfolio.coordinator.getSnapshot().draft!;
  workspace.portfolio.replace(draft, control.current.payload);
  control.changeCurrent();
  baseline.retire();
  await workspace.portfolio.reviewCatalog();
  workspace.portfolio.applyReview();
  const prices = workspace.createPortfolioCloseReview();
  prices.enter(capturePortfolioCloseContext(workspace));
  cleanups.push(() => prices.retire());
  const reports = new PortfolioReviewReportController(
    {
      capture: () => prices.captureReport("2026-10-30T12:00:02.000Z"),
      captureReadScope: () => capturePortfolioReportReadScope(workspace),
      subscribe: prices.subscribe,
    },
    undefined,
    () => null,
  );
  const revisit = new PortfolioReportRevisit(reports);
  cleanups.push(
    () => reports.dispose(),
    () => revisit.dispose(),
  );
  const bytes = archiveBytes(archiveHtmlFixture(saved));
  const file = {
    name: "Original Café 東京 <private>.html",
    size: bytes.byteLength,
    arrayBuffer: vi.fn(() => Promise.resolve(bytes)),
  };
  return { workspace, prices, reports, revisit, saved, file, bytes, control };
}
async function compareAfterRead(f: Awaited<ReturnType<typeof sequence>>) {
  f.revisit.choose(f.file);
  expect(await f.revisit.read()).toBe(true);
  const admitted = f.revisit.getSnapshot().saved;
  await f.prices.load();
  expect(f.revisit.getSnapshot().filename).toBe("");
  expect(f.revisit.getSnapshot().saved).toBe(admitted);
  f.reports.prepare();
  expect(f.revisit.compare()).toBe(true);
  return f.revisit.captureComparisonReport("2026-10-30T12:00:03.000Z");
}
describe("real Portfolio read then current-close comparison report sequence", () => {
  it("retains admitted filename provenance after current closes load without retaining an obsolete read lease", async () => {
    const f = await sequence();
    const ledger = f.workspace.portfolio.coordinator.getSnapshot();
    const capture = await compareAfterRead(f);
    expect(capture).not.toBeNull();
    expect(capture!.current()).toBe(true);
    expect(capture!.report.savedFilename).toBe(f.file.name);
    expect(capture!.report.comparison.saved).toEqual(f.saved);
    expect(capture!.report.comparison.current.ledger).toEqual(
      ledger.draft!.ledger,
    );
    expect(f.workspace.portfolio.coordinator.getSnapshot()).toBe(ledger);
    expect(f.file.arrayBuffer).toHaveBeenCalledTimes(1);
    expect(f.control.getSnapshot()).toMatchObject({
      eod: 5,
      resolve: 2,
      rejected: 0,
    });
  });
  it("permanently retires a captured report on a date ABA, while allowing a fresh explicit comparison of the admitted archive", async () => {
    const f = await sequence();
    const capture = await compareAfterRead(f);
    expect(capture).not.toBeNull();
    const date = f.prices.getSnapshot().selectedDate;
    const other = f.prices.getSnapshot().dates.find((value) => value !== date)!;
    f.prices.selectDate(other);
    f.prices.selectDate(date);
    expect(capture!.current()).toBe(false);
    f.reports.prepare();
    expect(f.revisit.compare()).toBe(true);
    const next = f.revisit.captureComparisonReport("2026-10-30T12:00:04.000Z");
    expect(next?.current()).toBe(true);
    expect(next?.report.savedFilename).toBe(f.file.name);
    expect(capture!.current()).toBe(false);
    expect(f.control.getSnapshot().eod).toBe(5);
    f.revisit.choose(f.file);
    expect(next?.current()).toBe(false);
    expect(f.revisit.getSnapshot().saved).toBeNull();
  });
  it("still refuses a late read when current source activity retires its in-flight file scope", async () => {
    const f = await sequence();
    let resolve!: (bytes: ArrayBuffer) => void;
    f.revisit.choose({
      ...f.file,
      arrayBuffer: () =>
        new Promise<ArrayBuffer>((done) => {
          resolve = done;
        }),
    });
    const reading = f.revisit.read();
    await f.prices.load();
    resolve(f.bytes);
    expect(await reading).toBe(false);
    expect(f.revisit.getSnapshot().saved).toBeNull();
    f.reports.prepare();
    expect(f.revisit.compare()).toBe(false);
    expect(
      f.revisit.captureComparisonReport("2026-10-30T12:00:04.000Z"),
    ).toBeNull();
  });
});
