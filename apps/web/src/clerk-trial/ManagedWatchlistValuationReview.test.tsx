import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import {
  ManagedWatchlistValuationReview,
  SavedScenarioReadingView,
} from "./ManagedWatchlistValuationReview";
import { createWatchlistValuationFixture } from "./test-watchlist-valuation-review-fixture";
const fixtures: Awaited<ReturnType<typeof createWatchlistValuationFixture>>[] =
  [];
async function fixture() {
  const f = await createWatchlistValuationFixture();
  fixtures.push(f);
  await f.run();
  await f.preview();
  return f;
}
afterEach(() => fixtures.splice(0).forEach((f) => f.dispose()));
it("renders all chosen identities, complete inputs and six comparisons with separate refusals", async () => {
  const f = await fixture();
  const state = f.model.evaluate(f.model.getSnapshot())!;
  const $ = load(
    renderToStaticMarkup(
      <SavedScenarioReadingView plan={state.plan!} reading={state.reading} />,
    ),
  );
  expect($("li[data-saved-scenario-listing]")).toHaveLength(3);
  expect($(".managed-valuation-results")).toHaveLength(2);
  expect($(".managed-valuation-price-context")).toHaveLength(2);
  expect($.text()).toContain("unfinished 1..");
  expect($.text()).toContain("No confirmed saved valuation inputs");
  expect($.text()).toContain("140.00");
  expect($.text()).toContain(state.reading!.evaluatedAt);
  expect(
    new Set(
      $("[id]")
        .map((_, e) => $(e).attr("id"))
        .get(),
    ).size,
  ).toBe($("[id]").length);
});
it("does not serialize the full retained source packet while its disclosure is closed", async () => {
  const f = await fixture();
  const state = f.model.getSnapshot();
  const spy = vi.spyOn(JSON, "stringify");
  renderToStaticMarkup(
    <SavedScenarioReadingView plan={state.plan!} reading={null} />,
  );
  expect(
    spy.mock.calls.some(
      (args) => args[0] === state.plan!.rows[0]!.source.price,
    ),
  ).toBe(false);
  spy.mockRestore();
});
it("removes every evaluation and Load action after Finish while retaining full results", async () => {
  const f = await fixture();
  f.model.evaluate(f.model.getSnapshot());
  f.group.finishDaily(f.group.getSnapshot());
  const $ = load(
    renderToStaticMarkup(
      <ManagedWatchlistValuationReview workspace={f.workspace} active />,
    ),
  );
  expect($("button")).toHaveLength(0);
  expect($(".managed-valuation-results")).toHaveLength(2);
  expect($.text()).toContain("Saved scenarios for this daily review");
  expect($.text()).toContain("This finished reading is passive");
  expect($.text()).not.toContain("through this group’s Research control");
  expect($.text()).not.toContain("through this group's Research control");
});
it("shows explicit Load, Preview and Evaluate with appropriate current model guards", async () => {
  const f = await fixture();
  const $ = load(
    renderToStaticMarkup(
      <ManagedWatchlistValuationReview workspace={f.workspace} active />,
    ),
  );
  expect($("#watchlist-saved-scenario-load").text()).toBe(
    "Load saved valuation inputs",
  );
  expect(
    $("#watchlist-saved-scenario-evaluate").attr("disabled"),
  ).toBeUndefined();
  expect($("#watchlist-saved-scenario-preview").text()).toBe(
    "Preview saved scenarios",
  );
  const retired = load(
    renderToStaticMarkup(
      <ManagedWatchlistValuationReview
        workspace={f.workspace}
        active={false}
      />,
    ),
  );
  expect(retired("button:not([disabled])")).toHaveLength(0);
});

it.each(["commit_unknown", "conflict"] as const)(
  "gives an existing Saved inputs recovery path for %s",
  async (code) => {
    const f = await fixture();
    const coordinator = f.workspace.valuationAssumptions.coordinator;
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
      renderToStaticMarkup(
        <ManagedWatchlistValuationReview workspace={f.workspace} active />,
      ),
    );
    expect(
      $("#watchlist-saved-scenario-preview").attr("disabled"),
    ).toBeDefined();
    expect($.text()).toContain("then expand Saved inputs");
    expect($.text()).toContain(
      code === "commit_unknown"
        ? "Reconcile original valuation save"
        : "Use saved version or Keep valuation draft",
    );
    expect($.text()).toContain(
      "Recovery does not automatically evaluate or save",
    );
    expect($.text()).toContain(
      "Return to My Watchlist and start a new daily review",
    );
  },
);
