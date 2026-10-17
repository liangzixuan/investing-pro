import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManagedValuationResults } from "./ManagedValuationResults";
import {
  ManagedValuationWorkbench,
  type ManagedValuationCalculation,
} from "./managed-valuation-workbench";
import { eodSelection } from "./eod-history-fixture";

function calculation(
  bridge = "-50",
  debt = "20",
  wacc = "10",
): ManagedValuationCalculation {
  const model = new ManagedValuationWorkbench();
  model.activate(eodSelection);
  model.setDcfField("startingUnleveredCashFlowUsd", "100.125");
  model.setDcfField("enterpriseToEquityBridgeUsd", bridge);
  model.setDcfField("dilutedShares", "10");
  model.setDcfField("waccPercent", wacc);
  model.setDcfField("terminalGrowthPercent", "2");
  model.setExitField("baseRevenue", "1000");
  model.setExitField("cash", "50");
  model.setExitField("debt", debt);
  model.setExitField("dilutedShares", "10");
  model.setExitField("discountRatePercent", "10");
  for (const [scenario, growth] of [
    ["conservative", "0"],
    ["base", "5"],
    ["expansion", "10"],
  ] as const) {
    model.setDcfScenario(scenario, growth);
    model.setExitScenario(scenario, "annualRevenueGrowthPercent", growth);
    model.setExitScenario(scenario, "targetEbitdaMarginPercent", "20");
    model.setExitScenario(scenario, "exitMultiple", "10");
  }
  return model.calculate()!;
}
describe("passive authored valuation results", () => {
  it("renders all scenarios, projections, formulas and 25 cells for each model with exact units", () => {
    const capture = calculation();
    expect(capture.dcfResult.status).toBe("available");
    expect(capture.exitResult.status).toBe("available");
    const html = renderToStaticMarkup(
      <ManagedValuationResults calculation={capture} />,
    );
    expect(html).toContain("Calculated authored scenarios");
    expect(html).toContain("ZERO · Zero Class A · XNAS · listing-zero");
    expect(html).toContain("USD amounts are full dollars");
    expect(html).toContain("share counts");
    expect(html).toContain("DCF sensitivity: 25 base-scenario combinations");
    expect(html).toContain(
      "Exit multiple sensitivity: 25 base-scenario combinations",
    );
    expect(html).toContain("100.125");
    expect(html).toContain(
      "starting_unlevered_cash_flow * (1 + annual_growth_rate) ^ year",
    );
    for (const scenario of ["conservative", "base", "expansion"] as const) {
      if (capture.dcfResult.status === "available") {
        const result = capture.dcfResult.scenarios[scenario];
        expect(html).toContain(result.equityValueUsd);
        expect(html).toContain(result.projection[4]!.cashFlowUsd);
      }
      if (capture.exitResult.status === "available")
        expect(html).toContain(
          capture.exitResult.scenarios[scenario].valuePerShare,
        );
    }
    expect(html.match(/<tbody>/gu)).toHaveLength(7);
    expect(html.match(/<tr>/gu)).toHaveLength(78);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<details open");
  });
  it("keeps raw missing or invalid inputs visible and gives refusals without prices", () => {
    const model = new ManagedValuationWorkbench();
    model.activate(eodSelection);
    model.setDcfField("startingUnleveredCashFlowUsd", "1e8");
    const html = renderToStaticMarkup(
      <ManagedValuationResults calculation={model.calculate()!} />,
    );
    expect(html).toContain("Cash flow DCF unavailable.");
    expect(html).toContain("Exit multiple unavailable.");
    expect(html).toContain("1e8");
    expect(html).toContain("&quot;cash&quot;: &quot;&quot;");
    expect(html).not.toContain("0.00");
  });
  it("escapes authored names and invalid raw values in the offline-safe passive view", () => {
    const capture = calculation();
    const html = renderToStaticMarkup(
      <ManagedValuationResults
        calculation={{
          ...capture,
          owner: {
            ...capture.owner,
            listing: {
              ...capture.owner.listing,
              securityName: '<script>alert("name")</script>',
            },
          },
          dcfDraft: {
            ...capture.dcfDraft,
            startingUnleveredCashFlowUsd: "<img src=x onerror=alert(1)>",
          },
        }}
      />,
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });
  it("retains enterprise and equity amounts when nonpositive equity refuses a positive share value", () => {
    const capture = calculation("1000000", "1000000");
    const html = renderToStaticMarkup(
      <ManagedValuationResults calculation={capture} />,
    );
    expect(html).toContain(
      "Equity value is zero or negative. A positive value per share is unavailable.",
    );
    for (const scenario of ["conservative", "base", "expansion"] as const) {
      if (capture.dcfResult.status === "available") {
        const result = capture.dcfResult.scenarios[scenario];
        expect(result.status).toBe("unavailable");
        expect(html).toContain(result.equityValueUsd);
        expect(html).toContain(result.enterpriseValueUsd);
      }
      if (capture.exitResult.status === "available") {
        const result = capture.exitResult.scenarios[scenario];
        expect(result.status).toBe("unavailable");
        expect(html).toContain(result.equityValue);
        expect(html).not.toContain(`<td>${result.valuePerShare}</td>`);
      }
    }
  });
  it("places material terminal and narrow-rate-gap warnings before any closed projection disclosure", () => {
    const html = renderToStaticMarkup(
      <ManagedValuationResults
        calculation={calculation("-50", "20", "2.0001")}
      />,
    );
    const closedProjection = html.indexOf("<details>");
    expect(
      html.indexOf(
        "WACC is less than 1.00 percentage point above terminal growth.",
      ),
    ).toBeLessThan(closedProjection);
    expect(
      html.indexOf(
        "More than 80% depends on assumptions beyond the explicit forecast.",
      ),
    ).toBeLessThan(closedProjection);
    expect(html).toContain("Terminal present value / enterprise value (%)");
    expect(html).toContain(
      "This sensitivity rate is outside the model limits.",
    );
  });
});
