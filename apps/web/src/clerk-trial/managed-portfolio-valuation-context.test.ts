import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  createPortfolioValuationFixture,
  portfolioScenarioTime,
} from "./test-portfolio-valuation-fixture";
import { capturePortfolioCloseContext } from "./portfolio-close-review-context";

const fixtures: Awaited<ReturnType<typeof createPortfolioValuationFixture>>[] =
  [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(portfolioScenarioTime);
});
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function setup() {
  const f = await createPortfolioValuationFixture();
  fixtures.push(f);
  const w = f.workspace;
  vi.spyOn(f.fixture.api, "loadPortfolio").mockResolvedValue({
    version: 1,
    payload: f.report.ledger,
  });
  await w.portfolio.coordinator.load();
  w.portfolio.coordinator.replaceDraft({ ledger: f.report.ledger });
  await w.portfolio.reviewCatalog();
  w.portfolio.applyReview();
  w.setView("portfolio");
  const reads = vi
    .spyOn(f.fixture.api, "eodHistory")
    .mockImplementation((request) => {
      const response = f.report.sourceRows.find(
        (row) => row.holding.identity.listingId === request.listingId,
      )?.response;
      if (!response)
        return Promise.reject(new Error("No invented Price evidence"));
      return Promise.resolve(structuredClone(response));
    });
  const prices = w.createPortfolioCloseReview();
  prices.enter(capturePortfolioCloseContext(w));
  await prices.load();
  prices.selectDate("2026-11-02");
  const context = w.portfolioValuationReview,
    model = context.model;
  return { ...f, w, prices, context, model, reads };
}
function preview(f: Awaited<ReturnType<typeof setup>>) {
  expect(
    f.w.capturePortfolioWatchlistRoute(),
    "Portfolio route",
  ).not.toBeNull();
  expect(
    f.w.portfolio.getDraftFileContext(),
    "Portfolio file context",
  ).not.toBeNull();
  expect(f.prices.getSnapshot().selectedDate, "source selected date").toBe(
    "2026-11-02",
  );
  expect(
    f.prices.captureReport(portfolioScenarioTime),
    "source capture",
  ).not.toBeNull();
  expect(f.model.canPreview(f.model.getSnapshot()), "model ready").toBe(true);
  const state = f.context.preview(f.prices, f.model.getSnapshot());
  expect(state?.plan?.report.selectedDate).toBe("2026-11-02");
  return state!;
}
it("captures only an owned real dated review and preserves all evidence through Research, source section, owned Back and closed prices", async () => {
  const f = await setup(),
    p = preview(f),
    reading = f.model.evaluate(p)!.reading!;
  const json = JSON.stringify(reading),
    reads = f.reads.mock.calls.length;
  const row = p.plan!.rows[0]!,
    draft = f.w.portfolio.coordinator.getSnapshot().draft!;
  const listing = draft.ledger!.identities.find(
    (item) => item.listingId === row.selection.listing.listingId,
  )!;
  expect(f.context.canResearch(row), "ready for row research").toBe(true);
  expect(
    f.context.research(row, () => {
      f.w.openPortfolioResearch(draft, listing);
      expect(f.w.getSnapshot().research, "opened research").not.toBeNull();
      expect(f.model.getSnapshot().reading, "retained in opening").toBe(
        reading,
      );
    }),
  ).toBe(true);
  f.prices.retire();
  f.w.setNavigationBlocked(true);
  await f.w.setCompanyRoute({
    kind: "company",
    listingId: listing.listingId,
    section: "eod",
  });
  expect(f.model.getSnapshot().reading).toBe(reading);
  expect(f.model.getSnapshot().active).toBe(false);
  f.w.switchToFilings();
  expect(f.model.getSnapshot().reading).toBe(reading);
  f.w.returnFromResearch();
  f.w.setNavigationBlocked(false);
  await f.w.setCompanyRoute(null);
  expect(f.context.resumePortfolio()).toBe(true);
  expect(f.model.getSnapshot().reading).toBe(reading);
  expect(JSON.stringify(reading)).toBe(json);
  expect(f.model.getSnapshot().active).toBe(true);
  expect(f.context.canResearch(row)).toBe(true);
  expect(f.reads).toHaveBeenCalledTimes(reads);
  expect(f.context.preview(f.prices, f.model.getSnapshot())).toBeNull();
});
it.each([
  "same-view",
  "view-roundtrip",
  "navigation-roundtrip",
  "portfolio-replace",
  "portfolio-file",
  "price-date",
  "price-retire",
  "catalog",
  "session",
] as const)(
  "retires %s without reviving an equal-looking reading",
  async (kind) => {
    const f = await setup(),
      p = preview(f);
    f.model.evaluate(p);
    if (kind === "same-view") f.w.setView("portfolio");
    if (kind === "view-roundtrip") {
      f.w.setView("markets");
      f.w.setView("portfolio");
    }
    if (kind === "navigation-roundtrip") {
      f.w.setNavigationBlocked(true);
      f.w.setNavigationBlocked(false);
    }
    if (kind === "portfolio-replace")
      f.w.portfolio.coordinator.replaceDraft(
        structuredClone(f.w.portfolio.coordinator.getSnapshot().draft!),
      );
    if (kind === "portfolio-file") {
      const token = {};
      f.w.portfolio.beginDraftFileActivity(token);
      f.w.portfolio.endDraftFileActivity(token);
    }
    if (kind === "price-date") f.prices.selectDate("2026-11-03");
    if (kind === "price-retire") f.prices.retire();
    if (kind === "catalog") await f.w.refreshCatalog();
    if (kind === "session") f.w.sessionOwner.dispose();
    expect(f.model.getSnapshot().plan).toBeNull();
    expect(f.model.getSnapshot().reading).toBeNull();
    expect(f.model.evaluate(p)).toBeNull();
  },
);
it("refuses forged, stale and failed Research actions and foreign same-company reopen", async () => {
  const f = await setup(),
    p = preview(f),
    row = p.plan!.rows[0]!;
  expect(f.context.canResearch({ ...row })).toBe(false);
  expect(f.context.research(row, () => {})).toBe(false);
  expect(f.model.getSnapshot().plan).toBeNull();
  const fresh = preview(f),
    current = fresh.plan!.rows[0]!;
  const draft = f.w.portfolio.coordinator.getSnapshot().draft!,
    listing = draft.ledger!.identities[0]!;
  f.w.openPortfolioResearch(draft, listing);
  expect(f.model.getSnapshot().plan).toBeNull();
  expect(f.context.canResearch(current)).toBe(false);
});
it("rejects a report model created outside this workspace and a subscriber that replaces the owner during preview", async () => {
  const f = await setup(),
    other = await setup();
  expect(f.context.preview(other.prices, f.model.getSnapshot())).toBeNull();
  const off = f.model.subscribe(() => {
    if (f.model.getSnapshot().plan) f.w.setView("portfolio");
  });
  expect(f.context.preview(f.prices, f.model.getSnapshot())).toBeNull();
  off();
  expect(f.model.getSnapshot().plan).toBeNull();
});
it("admits only the configured issuer for an owned Portfolio selection and clears a thrown opener", async () => {
  const f = await setup(),
    state = preview(f),
    row = state.plan!.rows[0]!;
  expect(f.w.portfolioResearchIssuerMatches(row.selection)).toBe(true);
  expect(
    f.w.portfolioResearchIssuerMatches({ ...row.selection, cik: "0000000999" }),
  ).toBe(false);
  expect(
    f.w.portfolioResearchIssuerMatches({
      ...row.selection,
      origin: "watchlist",
    }),
  ).toBe(false);
  expect(
    f.w.portfolioResearchIssuerMatches({
      ...row.selection,
      listing: { ...row.selection.listing, shareClassId: "foreign" },
    }),
  ).toBe(false);
  expect(
    f.context.research(row, () => {
      throw new Error("Cancelled invented opener");
    }),
  ).toBe(false);
  expect(f.model.getSnapshot().plan).toBeNull();
});
