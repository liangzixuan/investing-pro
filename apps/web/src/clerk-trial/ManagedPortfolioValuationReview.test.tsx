import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
import {
  ManagedPortfolioValuationReview,
  type ManagedPortfolioValuationReviewProps,
} from "./ManagedPortfolioValuationReview";
import {
  PortfolioSavedScenarioReadingView,
  portfolioScenarioRefusal,
} from "./PortfolioSavedScenarioReadingView";
import { PortfolioReviewReportSnapshot } from "./PortfolioReviewReportSnapshot";
import { OfflineResearchReading } from "./ManagedScreenResearchReading";
import {
  createPortfolioValuationFixture,
  portfolioScenarioTime,
} from "./test-portfolio-valuation-fixture";
import { TrialApiError } from "./api";
const fixtures: Awaited<ReturnType<typeof createPortfolioValuationFixture>>[] =
  [];
async function fixture() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(portfolioScenarioTime);
  const f = await createPortfolioValuationFixture();
  fixtures.push(f);
  f.model.preview(f.model.getSnapshot());
  return f;
}
function props(
  f: Awaited<ReturnType<typeof fixture>>,
): ManagedPortfolioValuationReviewProps {
  return {
    model: f.model,
    assumptions: f.workspace.valuationAssumptions,
    workbench: f.workspace.valuation,
    active: true,
    canPreview: true,
    onPreview: (state) => f.model.preview(state),
    onResearch: vi.fn(),
    canResearch: () => true,
  };
}
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("renders every holding, exact inputs, all model results and six selected-date comparisons without source or save effects", async () => {
  const f = await fixture(),
    before = f.fixture.watchlistSavedScenario!.getSnapshot();
  f.clock(() => "2026-11-04T12:01:00.000Z");
  const state = f.model.evaluate(f.model.getSnapshot())!;
  const $ = load(
    renderToStaticMarkup(
      <PortfolioSavedScenarioReadingView
        plan={state.plan!}
        reading={state.reading}
      />,
    ),
  );
  expect(
    $("li[data-portfolio-scenario-listing]")
      .map((_, e) => $(e).attr("data-portfolio-scenario-listing"))
      .get(),
  ).toEqual(state.plan!.rows.map((r) => r.selection.listing.listingId));
  expect($(".managed-valuation-results")).toHaveLength(2);
  expect(
    $('[aria-label="Portfolio scenario price comparison"] tbody'),
  ).toHaveLength(2);
  $('[aria-label="Portfolio scenario price comparison"] tbody').each((_, e) =>
    expect($(e).find("tr")).toHaveLength(6),
  );
  for (const value of [
    "unfinished 1..",
    "140.00",
    "120.5 USD on 2026-11-02",
    "16.18%",
    portfolioScenarioTime,
    state.reading!.evaluatedAt,
    state.plan!.rows[0]!.source.response!.requestStartedAt,
    state.plan!.rows[0]!.source.response!.completedAt,
    "No confirmed saved valuation inputs",
    "coverage is unavailable",
    "not historical valuation results",
  ])
    expect($.text()).toContain(value);
  expect($.text()).not.toContain("Chosen raw close: 130 USD");
  expect($("button,input,textarea")).toHaveLength(0);
  expect(f.fixture.watchlistSavedScenario!.getSnapshot()).toEqual(before);
});
it("retains complete lazy packets and collection and permits distinct original-report composition IDs", async () => {
  const f = await fixture(),
    state = f.model.getSnapshot(),
    plan = state.plan!;
  const spy = vi.spyOn(JSON, "stringify");
  renderToStaticMarkup(
    <PortfolioSavedScenarioReadingView plan={plan} reading={null} />,
  );
  expect(
    spy.mock.calls.some(
      (args) =>
        args[0] === plan.collection ||
        args[0] === plan.report ||
        plan.rows.some((r) => r.source === args[0]),
    ),
  ).toBe(false);
  spy.mockRestore();
  const $ = load(
    renderToStaticMarkup(
      <OfflineResearchReading.Provider value={true}>
        <PortfolioSavedScenarioReadingView plan={plan} reading={null} />
      </OfflineResearchReading.Provider>,
    ),
  );
  const packets = $("pre")
    .map((_, e) => JSON.parse($(e).text()) as unknown)
    .get();
  expect(packets).toEqual([plan.collection, ...plan.rows.map((r) => r.source)]);
  const reports = load(
    renderToStaticMarkup(
      <>
        <PortfolioReviewReportSnapshot report={plan.report} />
        <PortfolioReviewReportSnapshot
          report={plan.report}
          compositionId="portfolio-saved-scenario-composition"
        />
      </>,
    ),
  );
  const ids = reports("[id]")
    .map((_, e) => reports(e).attr("id"))
    .get();
  expect(new Set(ids).size).toBe(ids.length);
  expect(reports("#portfolio-saved-scenario-composition")).toHaveLength(1);
});
it("keeps retained Evaluate, Research and Clear available without fresh close Preview and disables paused actions", async () => {
  const f = await fixture();
  const $ = load(
    renderToStaticMarkup(
      <ManagedPortfolioValuationReview {...props(f)} canPreview={false} />,
    ),
  );
  expect($("#portfolio-saved-scenario-preview[disabled]")).toHaveLength(1);
  for (const id of ["evaluate", "clear", "research-0"])
    expect($(`#portfolio-saved-scenario-${id}[disabled]`)).toHaveLength(0);
  f.pause(true);
  const paused = load(
    renderToStaticMarkup(
      <ManagedPortfolioValuationReview {...props(f)} active={false} />,
    ),
  );
  expect(paused("button:not([disabled])")).toHaveLength(0);
  expect(paused("[data-portfolio-scenario-listing]")).toHaveLength(3);
});
it.each(["commit_unknown", "conflict"] as const)(
  "offers existing saved-input recovery for %s without evaluating",
  async (code) => {
    const f = await fixture(),
      coordinator = f.workspace.valuationAssumptions.coordinator;
    const payload = coordinator.getSnapshot().draft!;
    coordinator.replaceDraft({
      ...payload,
      entries: payload.entries.slice(0, 1),
    });
    vi.spyOn(f.fixture.api, "saveValuationAssumptions").mockRejectedValueOnce(
      new TrialApiError(code),
    );
    await coordinator.save();
    const $ = load(
      renderToStaticMarkup(<ManagedPortfolioValuationReview {...props(f)} />),
    );
    expect($("#portfolio-saved-scenario-preview[disabled]")).toHaveLength(1);
    expect($.text()).toContain(
      code === "commit_unknown"
        ? "Reconcile original valuation save"
        : "Use saved version or Keep valuation draft",
    );
    expect($.text()).toContain(
      "Recovery does not evaluate or save scenarios automatically",
    );
    expect(f.model.getSnapshot().reading).toBeNull();
  },
);
it.each([
  "portfolio_report_unowned",
  "price_identity_mismatch",
  "price_unsupported",
  "price_not_loaded",
  "selected_close_missing",
])(
  "explains selected-date refusal %s without a newer-date fallback",
  (reason) => {
    expect(portfolioScenarioRefusal(reason)).not.toBe(reason);
    expect(portfolioScenarioRefusal(reason)).not.toContain("latest raw");
  },
);
