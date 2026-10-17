import type { PersonalSecAnnualRevenueConcept } from "@research-cockpit/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SecAnnualOperatingChange } from "./SecAnnualOperatingChange";
import { SecAnnualOperatingHistory } from "./SecAnnualOperatingHistory";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";
import {
  operatingResponse,
  operatingRow,
} from "./test-canonical-annual-operating-ui-fixture";
import { row, viewOf } from "./test-canonical-annual-ui-fixture";
import { operatingHistoryPacket } from "./test-canonical-annual-operating-ui-fixture";

async function pair(
  currentIncome: string,
  priorIncome: string,
  currentRevenue = "100",
  priorRevenue = "100",
  concept: PersonalSecAnnualRevenueConcept = "Revenues",
) {
  const prior = {
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    durationDays: 366,
    frame: "CY2024",
  };
  return operatingResponse(
    [
      operatingRow(currentIncome),
      operatingRow(priorIncome, {
        ...prior,
        sourceLocator: "/facts/us-gaap/OperatingIncomeLoss/units/USD/1",
      }),
    ],
    [
      row(concept, currentRevenue),
      row(concept, priorRevenue, {
        ...prior,
        sourceLocator: `/facts/us-gaap/${concept}/units/USD/1`,
      }),
    ],
  );
}

describe("reported operating change presentation", () => {
  it.each([
    ["10", "-5", "15", "15 percentage points"],
    ["-5", "10", "-15", "-15 percentage points"],
    ["0", "0", "0", "0 percentage points"],
  ])(
    "keeps signed operating income current %s/prior %s in exact labelled calculations",
    async (current, prior, difference, points) => {
      const response = await pair(current, prior);
      const before = JSON.stringify(response);
      const html = renderToStaticMarkup(
        <SecAnnualOperatingChange
          response={response}
          view={viewOf(response)}
          concept="Revenues"
        />,
      );
      expect(html).toContain('aria-label="Reported operating change Revenues"');
      expect(html).toContain(
        "Operating income change · USD<small>App calculation</small></dt><dd>" +
          difference +
          "</dd>",
      );
      expect(html).toContain(
        "Operating margin change · percentage points<small>App calculation</small></dt><dd>" +
          points +
          "</dd>",
      );
      expect(html).toContain(
        'Prior: <time dateTime="2024-01-01">2024-01-01</time> to <time dateTime="2024-12-31">2024-12-31</time>',
      );
      expect(html).toContain(
        'Current: <time dateTime="2025-01-01">2025-01-01</time> to <time dateTime="2025-12-31">2025-12-31</time>',
      );
      expect(html).toContain("Same filing 0000000001-26-000001");
      expect(html).toContain(
        "Original load completed 2026-09-20T00:00:02.000Z",
      );
      expect(html).toContain("unrounded operating-income-to-revenue ratios");
      expect(html).toContain("History calculation references below");
      expect(html).not.toMatch(
        /<(?:button|input|select|textarea|details|summary)\b/u,
      );
      expect(html).not.toContain("growth");
      expect(JSON.stringify(response)).toBe(before);
    },
  );

  it.each([
    ["1.004", "0.999", "0.005", "0.01 percentage points"],
    ["1.005", "1.004", "0.001", "Less than 0.01 percentage points higher"],
    ["1.004", "1.005", "-0.001", "Less than 0.01 percentage points lower"],
  ])(
    "uses the exact unrounded comparison for %s versus %s",
    async (current, prior, difference, points) => {
      const response = await pair(current, prior);
      const html = renderToStaticMarkup(
        <SecAnnualOperatingChange
          response={response}
          view={viewOf(response)}
          concept="Revenues"
        />,
      );
      expect(html).toContain(`<dd>${difference}</dd>`);
      expect(html).toContain(`<dd>${points}</dd>`);
    },
  );

  it("keeps current/history data and all references intact inside the existing closed disclosure", async () => {
    const response = await operatingHistoryPacket();
    const before = JSON.stringify(response);
    const html = renderToStaticMarkup(
      <SecAnnualOperatingHistory
        response={response}
        view={viewOf(response)}
        concept="Revenues"
      />,
    );
    expect(html).toMatch(
      /^<details class="managed-annual-operating-history" aria-label="Reported operating history Revenues"><summary>Reported operating history<\/summary>/u,
    );
    expect(html).toContain("<td>-250.125</td><td>0</td><td>80.125</td>");
    expect(html).toContain("<td>1000</td><td>800</td><td>640</td>");
    expect(html).toContain("<td>-25.01%</td><td>0%</td><td>12.52%</td>");
    expect(html).toContain("<dd>-250.125</dd>");
    expect(html).toContain("<dd>-25.01 percentage points</dd>");
    expect(html.match(/<table\b/gu)).toHaveLength(1);
    expect(html.match(/<tr\b/gu)).toHaveLength(4);
    expect(html.match(/<details\b/gu)).toHaveLength(2);
    expect(html.indexOf("Reported operating change")).toBeGreaterThan(
      html.indexOf("</table>"),
    );
    expect(html.indexOf("Reported operating change")).toBeLessThan(
      html.indexOf("History calculation references</summary>"),
    );
    for (const item of [
      ...response.evidence.facts.observations.filter(
        (item) =>
          item.concept === "OperatingIncomeLoss" || item.concept === "Revenues",
      ),
    ])
      expect(html).toContain(item.id);
    expect(JSON.stringify(response)).toBe(before);
  });

  it("retains independent bases and the actual prior-pair refusal without adding a fallback", async () => {
    const response = await operatingHistoryPacket();
    const sales = renderToStaticMarkup(
      <SecAnnualOperatingChange
        response={response}
        view={viewOf(response)}
        concept="SalesRevenueNet"
      />,
    );
    const contract = renderToStaticMarkup(
      <SecAnnualOperatingChange
        response={response}
        view={viewOf(response)}
        concept="RevenueFromContractWithCustomerExcludingAssessedTax"
      />,
    );
    expect(sales).toContain("<dd>-31.27 percentage points</dd>");
    expect(contract).toContain(
      "The immediately preceding operating-income and selected-revenue pair is unavailable.",
    );
    expect(contract).toContain("Older periods are not substituted.");
    expect(contract).not.toContain("<dl>");
    const nonpositivePrior = await pair("10", "5", "100", "0");
    const html = renderToStaticMarkup(
      <SecAnnualOperatingHistory
        response={nonpositivePrior}
        view={viewOf(nonpositivePrior)}
        concept="Revenues"
      />,
    );
    expect(html).toContain("Revenue · 1 period · newest first");
    expect(html).toContain("<td>10</td>");
    expect(html).toContain(
      "immediately preceding operating-income and selected-revenue pair is unavailable",
    );
    expect(html).toContain(
      "Operating margin requires revenue greater than zero.",
    );
    expect(html).not.toContain("<dd>5</dd>");
  });

  it("states current-pair refusal while preserving readable independent current amounts", async () => {
    const response = await operatingResponse(
      [operatingRow("10")],
      [row("Revenues", "0")],
    );
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        response={response}
        view={viewOf(response)}
        appearance="financial"
      />,
    );
    expect(html).toContain(
      "The current operating-income and selected-revenue pair is unavailable.",
    );
    expect(html).toContain(
      "Operating margin requires revenue greater than zero.",
    );
    expect(html).toContain('class="sec-annual-liquidity-amount">10<');
    const stale = await operatingResponse(
      [operatingRow("10")],
      [row()],
      "2028-09-20T00:00:00.000Z",
    );
    expect(
      renderToStaticMarkup(
        <SecAnnualOperatingChange
          response={stale}
          view={viewOf(stale)}
          concept="Revenues"
        />,
      ),
    ).toContain("outside the current-use limits at this load");
  });

  it("keeps a first-two-period change when the third comparative is refused", async () => {
    const third = {
      startDate: "2023-02-02",
      endDate: "2023-12-31",
      durationDays: 333,
      frame: "CY2023",
    };
    const base = await pair("10", "5");
    const response = await operatingResponse(
      [
        ...base.evidence.facts.observations.filter(
          (item) => item.concept === "OperatingIncomeLoss",
        ),
        operatingRow("999", {
          ...third,
          sourceLocator: "/facts/us-gaap/OperatingIncomeLoss/units/USD/2",
        }),
      ],
      [
        ...base.evidence.facts.observations.filter(
          (item) => item.concept !== "OperatingIncomeLoss",
        ),
        row("Revenues", "999", {
          ...third,
          sourceLocator: "/facts/us-gaap/Revenues/units/USD/2",
        }),
      ],
    );
    const html = renderToStaticMarkup(
      <SecAnnualOperatingHistory
        response={response}
        view={viewOf(response)}
        concept="Revenues"
      />,
    );
    expect(html).toContain("Revenue · 2 periods · newest first");
    expect(html).toContain("The next earlier period is unavailable.");
    expect(html).toContain("<dd>5</dd>");
    expect(html).toContain("<dd>5 percentage points</dd>");
  });

  it("shows complete 128-character USD and 133-character point changes", async () => {
    const large = "9".repeat(64);
    const tiny = `0.${"0".repeat(61)}1`;
    const difference = `-${"9".repeat(63)}8.${"9".repeat(62)}`;
    expect(difference).toHaveLength(128);
    const amount = await pair(tiny, large);
    expect(
      renderToStaticMarkup(
        <SecAnnualOperatingChange
          response={amount}
          view={viewOf(amount)}
          concept="Revenues"
        />,
      ),
    ).toContain(`<dd>${difference}</dd>`);
    const signed = `-${"9".repeat(62)}8`;
    const numerator = BigInt(signed.slice(1)) * 10n ** 64n;
    const expected = `-${BigInt(large) * 10n ** 64n + numerator / 3n}.67`;
    expect(expected).toHaveLength(133);
    const points = await pair(signed, large, `0.${"0".repeat(61)}3`, tiny);
    const html = renderToStaticMarkup(
      <SecAnnualOperatingChange
        response={points}
        view={viewOf(points)}
        concept="Revenues"
      />,
    );
    expect(html).toContain(`<dd>${expected} percentage points</dd>`);
    expect(html).not.toContain("…");
  });
});
