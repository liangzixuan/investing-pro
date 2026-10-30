import { afterEach, expect, it, vi } from "vitest";
import { portfolioScreenFixture } from "./test-portfolio-screen-selection-fixture";
import { capturePortfolioReportReadScope } from "./portfolio-report-revisit-scope";
import { capturePortfolioCloseContext } from "./portfolio-close-review-context";
import { PortfolioReviewReportController } from "./portfolio-review-report-controller";
import { PortfolioReportRevisit } from "./portfolio-report-revisit";
import {
  archiveBytes,
  archiveHtmlFixture,
  archiveReportFixture,
} from "./portfolio-report-archive-fixture";

const fixtures: Awaited<ReturnType<typeof portfolioScreenFixture>>[] = [];
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.restoreAllMocks();
});
async function fixture(loaded = true) {
  const f = await portfolioScreenFixture(loaded, false);
  fixtures.push(f);
  f.workspace.setView("portfolio");
  return f;
}
it("allows an explicit file read before Portfolio or prices are loaded without requesting either", async () => {
  const f = await fixture(false);
  const scope = capturePortfolioReportReadScope(f.workspace);
  expect(scope()).toBe(true);
  const reports = new PortfolioReviewReportController(
    {
      capture: () => null,
      captureReadScope: () => capturePortfolioReportReadScope(f.workspace),
      subscribe: f.workspace.subscribe,
    },
    undefined,
    () => null,
  );
  const revisit = new PortfolioReportRevisit(reports);
  const bytes = archiveBytes(archiveHtmlFixture());
  revisit.choose({
    name: "invented.html",
    size: bytes.byteLength,
    arrayBuffer: () => Promise.resolve(bytes),
  });
  expect(await revisit.read()).toBe(true);
  expect(revisit.compare()).toBe(false);
  expect(f.api.loadPortfolio).not.toHaveBeenCalled();
  expect(f.unexpected).not.toHaveBeenCalled();
  revisit.dispose();
  reports.dispose();
});
it.each([
  "same-view",
  "route",
  "navigation",
  "draft",
  "form",
  "file",
  "catalog",
  "save",
  "session",
] as const)(
  "retires actual workspace read and current-capture scopes through %s changes",
  async (change) => {
    const f = await fixture();
    const w = f.workspace;
    const read = capturePortfolioReportReadScope(w);
    const context = capturePortfolioCloseContext(w);
    expect(context?.current()).toBe(true);
    const report = archiveReportFixture();
    const reports = new PortfolioReviewReportController(
      {
        capture: () => ({ report, current: () => context?.current() === true }),
        captureReadScope: () => capturePortfolioReportReadScope(w),
        subscribe: w.subscribe,
      },
      undefined,
      () => null,
    );
    reports.prepare();
    const owned = reports.captureCurrent();
    const draft = w.portfolio.coordinator.getSnapshot().draft!;
    if (change === "same-view") w.setView("portfolio");
    if (change === "route") {
      w.setView("watchlist");
      w.setView("portfolio");
    }
    if (change === "navigation") {
      w.setNavigationBlocked(true);
      w.setNavigationBlocked(false);
    }
    if (change === "draft") {
      w.portfolio.replace(draft, {
        ...draft.ledger!,
        opening: { ...draft.ledger!.opening, cashUsd: "4.00" },
      });
      w.portfolio.coordinator.replaceDraft(draft);
    }
    if (change === "form") {
      w.portfolio.setPendingEditor(draft, true);
      w.portfolio.setPendingEditor(draft, false);
    }
    if (change === "file") {
      const lease = {};
      w.portfolio.beginDraftFileActivity(lease);
      w.portfolio.endDraftFileActivity(lease);
    }
    if (change === "catalog") await w.refreshCatalog();
    if (change === "save") {
      await w.portfolio.coordinator.save();
    }
    if (change === "session") w.sessionOwner.retire("Invented retirement");
    expect(read()).toBe(false);
    expect(owned?.current()).toBe(false);
    reports.dispose();
  },
);
