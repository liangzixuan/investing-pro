import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load, type CheerioAPI } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
import { PortfolioSavedScenarioReadingView } from "../../src/clerk-trial/PortfolioSavedScenarioReadingView";
import {
  createPortfolioValuationFixture,
  portfolioScenarioTime,
} from "../../src/clerk-trial/test-portfolio-valuation-fixture";
import { createFixture } from "./fixture";

function renderedRows($: CheerioAPI, index: number) {
  const e = $("[data-portfolio-scenario-listing]").eq(index);
  const model = e.find('[aria-label="Authored valuation results"]');
  return {
    rawInputs: e
      .find(".managed-valuation-raw")
      .map((_, n) => $(n).text())
      .get(),
    tables: Object.fromEntries(
      model
        .find("table")
        .toArray()
        .map((t) => [
          $(t).find("caption").text(),
          $(t)
            .find("tbody tr")
            .toArray()
            .map((tr) =>
              $(tr)
                .children()
                .toArray()
                .map((td) => $(td).text()),
            ),
        ]),
    ),
    comparisons: e
      .find('[aria-label="Portfolio scenario price comparison"] tbody tr')
      .toArray()
      .map((tr) =>
        $(tr)
          .children()
          .toArray()
          .map((td) => $(td).text()),
      ),
  };
}
function expectedRows(
  row: NonNullable<
    ReturnType<
      Awaited<
        ReturnType<typeof createPortfolioValuationFixture>
      >["model"]["getSnapshot"]
    >["reading"]
  >["rows"][number],
) {
  const c = row.calculation!,
    entry = row.row.entry!,
    dcf = c.dcfResult,
    exit = c.exitResult;
  if (dcf.status !== "available")
    throw new Error("Fixture DCF must be complete");
  const keys = ["conservative", "base", "expansion"] as const,
    labels = ["Conservative", "Base", "Expansion"];
  const values = (o: Readonly<object>): string[] =>
    Object.values(o).flatMap((v: unknown) =>
      typeof v === "object" && v !== null
        ? values(v)
        : [String(v) === "" ? "Empty" : String(v)],
    );
  const tables: Record<string, unknown> = {
    "Cash flow DCF scenarios": keys.map((n, i) => {
      const v = dcf.scenarios[n];
      if (v.status !== "available")
        throw new Error("Fixture scenario unavailable");
      return [
        labels[i],
        v.annualCashFlowGrowthPercent,
        v.enterpriseValueUsd,
        v.equityValueUsd,
        v.valuePerShareUsd,
        v.terminalValuePercentOfEnterpriseValue,
      ];
    }),
    ...Object.fromEntries(
      keys.map((n, i) => [
        labels[i] + " cash flow projection",
        dcf.scenarios[n].projection.map((v) => [
          String(v.year),
          v.cashFlowUsd,
          v.presentValueUsd,
        ]),
      ]),
    ),
    "DCF sensitivity — value per share in USD/share": dcf.sensitivity.cells.map(
      (v) => {
        if (v.status !== "available")
          throw new Error("Fixture sensitivity unavailable");
        return [
          v.waccPercent,
          v.terminalGrowthPercent,
          v.enterpriseValueUsd,
          v.equityValueUsd,
          v.valuePerShareUsd,
        ];
      },
    ),
  };
  if (exit.status === "available") {
    tables["Exit multiple scenarios"] = keys.map((n, i) => {
      const v = exit.scenarios[n];
      if (v.status !== "available") throw new Error("Fixture exit unavailable");
      return [
        labels[i],
        v.yearNRevenue,
        v.yearNEbitda,
        v.presentEnterpriseValue,
        v.equityValue,
        v.valuePerShare,
      ];
    });
    tables["Exit multiple sensitivity — value per share in USD/share"] =
      exit.sensitivity.cells.map((v) => {
        if (v.status !== "available" || v.result.status !== "available")
          throw new Error("Fixture sensitivity unavailable");
        return [
          v.discountRatePercent,
          v.exitMultiple,
          v.result.presentEnterpriseValue,
          v.result.equityValue,
          v.result.valuePerShare,
        ];
      });
  }
  return {
    rawInputs: [...values(entry.dcf.inputs), ...values(entry.exit.inputs)],
    tables,
    comparisons: row.comparison!.rows.map((x) => [
      x.model === "dcf" ? "Cash flow DCF" : "Exit multiple",
      labels[keys.indexOf(x.scenario)],
      x.modelValuePerShareUsd ?? "Unavailable",
      x.result.status === "available"
        ? x.result.differencePercent + "%"
        : "Unavailable. " +
          (x.result.reason === "invalid_input"
            ? "Complete every input with a valid decimal and keep each value within the model limits."
            : x.result.reason),
    ]),
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("renders every full input, model table, raw methodology and six exact comparison rows, including invalid model refusal", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(portfolioScenarioTime);
  const f = await createPortfolioValuationFixture();
  try {
    const state = f.model.evaluate(f.model.preview(f.model.getSnapshot())!)!;
    const $ = load(
      renderToStaticMarkup(
        createElement(PortfolioSavedScenarioReadingView, {
          plan: state.plan!,
          reading: state.reading,
        }),
      ),
    );
    for (let index = 0; index < 2; index++) {
      const row = state.reading!.rows[index]!,
        c = row.calculation!;
      expect(renderedRows($, index)).toEqual(expectedRows(row));
      const e = $("[data-portfolio-scenario-listing]")
        .eq(index)
        .find('[aria-label="Authored valuation results"]');
      const packets = e
        .find("pre")
        .toArray()
        .map((p) => JSON.parse($(p).text()) as unknown);
      expect(packets).toEqual(
        expect.arrayContaining([
          c.dcfDraft,
          c.exitDraft,
          c.dcfResult.methodology,
        ]),
      );
      if (c.exitResult.status === "available") {
        expect(packets).toContainEqual(c.exitResult.methodology);
        for (const scenario of Object.values(c.exitResult.scenarios))
          for (const trace of scenario.formulaTrace)
            expect(e.text()).toContain(trace);
      } else expect(e.text()).toContain("Exit multiple unavailable.");
    }
    const changed = load($.html());
    changed("[data-portfolio-scenario-listing]")
      .first()
      .find(".managed-valuation-raw")
      .first()
      .text("110.000");
    expect(renderedRows(changed, 0)).not.toEqual(
      expectedRows(state.reading!.rows[0]!),
    );
    const truncated = load($.html());
    truncated("[data-portfolio-scenario-listing]")
      .first()
      .find('[aria-label="Authored valuation results"] table')
      .first()
      .find("tbody tr")
      .last()
      .remove();
    expect(renderedRows(truncated, 0)).not.toEqual(
      expectedRows(state.reading!.rows[0]!),
    );
  } finally {
    f.dispose();
  }
});
it("admits the exact startup cohort once and refuses mixed, foreign and cancelled source requests", async () => {
  const f = await createFixture("portfolio-saved-scenario"),
    signal = new AbortController().signal;
  await f.api.status(signal);
  const request = {
    snapshotSha256: f.researchCoverage.catalogSnapshotSha256,
    listingIds: f.marketsCohort.map((x) => x.listingId),
  };
  await f.api.resolve(request, signal);
  expect(f.portfolioSavedScenario!.getSnapshot().catalogResolve).toBe(1);
  expect(() => f.api.resolve(request, signal)).toThrow(
    "one exact startup cohort",
  );
  expect(() =>
    f.api.resolve(
      {
        ...request,
        listingIds: [
          request.listingIds[0]!,
          f.portfolioSavedScenario!.saved().portfolio.payload!.identities[0]!
            .listingId,
        ],
      },
      signal,
    ),
  ).toThrow("resolve identity");
  const aborted = new AbortController();
  aborted.abort();
  expect(() => f.api.loadPortfolio(aborted.signal)).toThrow("portfolio load");
  expect(f.portfolioSavedScenario!.getSnapshot().unexpected).toBe(3);
  expect(f.portfolioSavedScenario!.getSnapshot().eod).toBe(0);
});
