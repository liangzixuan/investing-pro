import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ManagedValuationPriceContext } from "./ManagedValuationPriceContext";
import { resolveManagedValuationPrice } from "./managed-valuation-price";
import {
  ManagedValuationWorkbench,
  VALUATION_SCENARIOS,
} from "./managed-valuation-workbench";
import { ManagedEodHistory } from "./managed-eod-history";
import { eodResponse, eodSelection } from "./eod-history-fixture";

function authored() {
  const model = new ManagedValuationWorkbench();
  model.activate(eodSelection);
  model.setDcfField("startingUnleveredCashFlowUsd", "100.125");
  model.setDcfField("enterpriseToEquityBridgeUsd", "-20.25");
  model.setDcfField("dilutedShares", "10");
  model.setDcfField("waccPercent", "10");
  model.setDcfField("terminalGrowthPercent", "2");
  model.setExitField("baseRevenue", "1000.125");
  model.setExitField("cash", "20.25");
  model.setExitField("debt", "10.125");
  model.setExitField("dilutedShares", "10");
  model.setExitField("discountRatePercent", "10");
  VALUATION_SCENARIOS.forEach((scenario, index) => {
    const growth = String(index * 5);
    model.setDcfScenario(scenario, growth);
    model.setExitScenario(scenario, "annualRevenueGrowthPercent", growth);
    model.setExitScenario(scenario, "targetEbitdaMarginPercent", "20");
    model.setExitScenario(scenario, "exitMultiple", "10");
  });
  return model;
}
async function loaded() {
  const read = vi.fn().mockResolvedValue(eodResponse());
  const price = new ManagedEodHistory(read, vi.fn(), undefined, [
    eodSelection.listing,
  ]);
  price.open(eodSelection);
  await price.load();
  return { price, read };
}
const htmlOf = (
  context: Parameters<typeof ManagedValuationPriceContext>[0]["context"],
) => renderToStaticMarkup(<ManagedValuationPriceContext context={context} />);

describe("passive dated valuation price context", () => {
  it("shows six exact model values and engine percentages with actual observed date and original clocks", async () => {
    const model = authored();
    const { price, read } = await loaded();
    const context = resolveManagedValuationPrice(
      eodSelection,
      model.calculate(),
      price.getSnapshot(),
    );
    expect(context?.rows).toHaveLength(6);
    const html = htmlOf(context);
    for (const row of context!.rows) {
      expect(row.modelValuePerShareUsd).not.toBeNull();
      expect(row.result.status).toBe("available");
      expect(html).toContain(`<td>${row.modelValuePerShareUsd}</td>`);
      if (row.result.status === "available")
        expect(html).toContain(`<td>${row.result.differencePercent}%</td>`);
    }
    expect(html).toContain("101.5 USD");
    expect(html).toContain("observed on <strong>2026-09-19</strong>");
    expect(html).toContain("2026-08-20 to 2026-09-20");
    expect(html).toContain("2026-09-20T00:00:00.000Z");
    expect(html).toContain("2026-09-20T00:00:01.000Z");
    expect(html).toContain("authored diluted share counts");
    expect(html).toContain("unadjusted historical observations");
    expect(html).toContain("Inspect dated price source");
    expect(html).not.toMatch(/<(?:button|input|select)\b/u);
    expect(html).not.toContain("<details open");
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("keeps authored values readable while Price is missing and asks for explicit calculation when absent", () => {
    const model = authored();
    const context = resolveManagedValuationPrice(
      eodSelection,
      model.calculate(),
      null,
    );
    const html = htmlOf(context);
    expect(html).toContain(
      "Load raw closing prices explicitly in the Price section",
    );
    for (const row of context!.rows)
      expect(html).toContain(row.modelValuePerShareUsd!);
    expect(htmlOf(null)).toContain(
      "Calculate authored scenarios for this company",
    );
    expect(html).not.toContain("Reference raw close:");
  });
  it("preserves a negative engine percentage beside independently positive scenarios", async () => {
    const model = authored();
    model.setExitScenario("base", "exitMultiple", "1");
    const { price } = await loaded();
    const context = resolveManagedValuationPrice(
      eodSelection,
      model.calculate(),
      price.getSnapshot(),
    )!;
    const base = context.rows.find(
      (row) => row.model === "exit" && row.scenario === "base",
    )!;
    expect(base.result.status).toBe("available");
    if (base.result.status !== "available")
      throw new Error("Expected available invented comparison");
    expect(base.result.differencePercent).toMatch(/^-/u);
    const html = htmlOf(context);
    expect(html).toContain(`<td>${base.result.differencePercent}%</td>`);
    expect(html).not.toMatch(/class="[^"]*(?:gain|loss|buy|sell)[^"]*"/u);
  });
  it("keeps model refusals independent from source refusals without substituting a value", () => {
    const model = authored();
    model.setDcfField("dilutedShares", "0");
    const context = resolveManagedValuationPrice(
      eodSelection,
      model.calculate(),
      null,
    );
    const html = htmlOf(context);
    expect(html).toContain("Diluted shares must be greater than zero");
    expect(html).toContain("Load raw closing prices explicitly");
    expect(
      context!.rows
        .filter((row) => row.model === "dcf")
        .every((row) => row.modelValuePerShareUsd === null),
    ).toBe(true);
    expect(
      context!.rows
        .filter((row) => row.model === "exit")
        .every((row) => row.modelValuePerShareUsd !== null),
    ).toBe(true);
  });
  it("shows retained-source qualifications and refuses pending or staged history independently", async () => {
    const model = authored();
    const capture = model.calculate();
    const { price } = await loaded();
    const state = price.getSnapshot();
    expect(
      htmlOf(
        resolveManagedValuationPrice(eodSelection, capture, {
          ...state,
          showingPrevious: true,
        }),
      ),
    ).toContain("Showing previous close history");
    const pending = htmlOf(
      resolveManagedValuationPrice(eodSelection, capture, {
        ...state,
        running: true,
      }),
    );
    expect(pending).toContain("A price request is in progress");
    expect(pending).not.toContain("Reference raw close:");
    const staged = htmlOf(
      resolveManagedValuationPrice(eodSelection, capture, {
        ...state,
        selectedRange: "1y",
      }),
    );
    expect(staged).toContain("selected price range differs");
    expect(staged).not.toContain("Reference raw close:");
  });
  it("refuses a zero latest close without silently using the preceding positive close", async () => {
    const model = authored();
    const { price } = await loaded();
    const response = eodResponse();
    const context = resolveManagedValuationPrice(
      eodSelection,
      model.calculate(),
      {
        ...price.getSnapshot(),
        response: {
          ...response,
          rows: [response.rows[0]!, { ...response.rows[1]!, close: "0" }],
        },
      },
    );
    const html = htmlOf(context);
    expect(
      context!.rows.every((row) => row.result.status === "unavailable"),
    ).toBe(true);
    expect(html).not.toContain("100.25 USD");
    expect(html).not.toContain("<td>0.00%</td>");
  });
  it("distinguishes a refused empty packet from a source that was never loaded", async () => {
    const model = authored();
    const { price } = await loaded();
    const state = price.getSnapshot();
    const context = resolveManagedValuationPrice(
      eodSelection,
      model.calculate(),
      { ...state, response: { ...state.response!, rows: [] } },
    );
    expect(context?.reason).toBe("price_invalid");
    expect(htmlOf(context)).toContain(
      "loaded history does not provide an admitted latest raw USD close",
    );
    expect(htmlOf(context)).not.toContain("Load raw closing prices explicitly");
  });
  it("escapes inspected hostile text without active markup", async () => {
    const model = authored();
    const { price } = await loaded();
    const context = resolveManagedValuationPrice(
      eodSelection,
      model.calculate(),
      price.getSnapshot(),
    )!;
    // Presentation remains safe even if a future caller supplies hostile source labels.
    const html = htmlOf({
      ...context,
      selection: {
        ...context.selection,
        listing: {
          ...context.selection.listing,
          securityName: '<img src=x onerror="bad">',
        },
      },
    });
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });
});
