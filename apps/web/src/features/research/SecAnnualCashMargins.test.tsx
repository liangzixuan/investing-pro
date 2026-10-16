import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS } from "@research-cockpit/contracts";
import { cashMarginsResponse } from "./sec-annual-cash-margins-fixture";
import { cashRow } from "./sec-annual-cash-fixture";
import { row } from "./sec-annual-evidence-fixture";
import {
  SecAnnualCashMargins,
  SecAnnualCashMarginInputs,
  SecAnnualCashMarginValueContent,
} from "./SecAnnualCashMargins";
import { derivePersonalSecAnnualCashMargins } from "@research-cockpit/personal-financial-analytics";
import { SecAnnualCashGeneration } from "./SecAnnualCashGeneration";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";

describe("Annual cash generation margins", () => {
  it("shares exact available and refused value bodies and complete inputs with the company view", async () => {
    const response = await cashMarginsResponse({
      revenueRows: [row("Revenues", "1000"), row("SalesRevenueNet", "0")],
    });
    const company = renderToStaticMarkup(
      <SecAnnualCashMargins response={response} />,
    );
    const bases = derivePersonalSecAnnualCashMargins(response.evidence);
    const revenue = bases.find((basis) => basis.concept === "Revenues")!;
    const zero = bases.find((basis) => basis.concept === "SalesRevenueNet")!;
    expect(
      renderToStaticMarkup(<SecAnnualCashMarginValueContent basis={revenue} />),
    ).toBe(
      '<span class="sec-annual-liquidity-amount">10.01%</span><small>2025-01-01 to 2025-12-31</small><small>Within current-use limits at this load.</small>',
    );
    expect(
      renderToStaticMarkup(<SecAnnualCashMarginValueContent basis={zero} />),
    ).toBe(
      '<span class="sec-annual-cash-unavailable">Unavailable. This percentage requires reported revenue greater than zero.</span>',
    );
    for (const basis of bases) {
      expect(company).toContain(
        renderToStaticMarkup(<SecAnnualCashMarginValueContent basis={basis} />),
      );
      expect(company).toContain(
        renderToStaticMarkup(
          <SecAnnualCashMarginInputs
            basis={basis}
            evidence={response.evidence}
          />,
        ),
      );
    }
  });

  it("shows each admitted revenue basis without operating or net income, with closed complete inputs", async () => {
    const response = await cashMarginsResponse();
    const before = JSON.stringify(response);
    expect(
      response.evidence.observations.every((item) => item.metric === "revenue"),
    ).toBe(true);
    expect(
      response.evidence.operatingResults.resolution.operatingIncome.status,
    ).toBe("unavailable");
    const html = renderToStaticMarkup(
      <SecAnnualCashMargins response={response} />,
    );
    for (const [
      index,
      concept,
    ] of PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.entries()) {
      expect(html).toContain(`data-cash-margin-basis="${concept}"`);
      const start = html.indexOf(`data-cash-margin-basis="${concept}"`);
      const next = html.indexOf('data-cash-margin-basis="', start + 1);
      expect(html.slice(start, next === -1 ? undefined : next)).toContain(
        `${["20.02", "10.01", "12.51"][index]}%`,
      );
    }
    expect(html).toContain("Each revenue concept is a separate basis.");
    expect(
      html.match(
        /class="sec-quarterly-row-details sec-annual-cash-margin-inputs"/gu,
      ),
    ).toHaveLength(3);
    expect(html).not.toMatch(/<details[^>]*\sopen(?:[ =>])/u);
    expect(html).not.toContain("<button");
    for (const amount of ["1000", "500", "800", "120.125", "20.025"])
      expect(html).toContain(`>${amount}<`);
    for (const text of [
      "2025-01-01 to 2025-12-31",
      "Cutoff 2026-09-20T00:00:00.000Z",
      "Company Facts captured 2026-09-20T00:00:01.000Z",
      "Submissions captured 2026-09-20T00:00:02.000Z",
      "Completed 2026-09-20T00:00:02.000Z",
      "Within current-use limits at this load.",
    ])
      expect(html).toContain(text);
    const inputs = [
      ...response.evidence.observations,
      ...response.evidence.cashGeneration.operatingCashFlow.observations,
      ...response.evidence.cashGeneration.ppePurchases.observations,
    ];
    for (const input of inputs) {
      for (const value of [
        input.id,
        input.sourceLocator,
        input.accessionNumber,
        input.filing.reportDate!,
        input.filedDate,
      ])
        expect(html).toContain(value);
    }
    expect(JSON.stringify(response)).toBe(before);
  });

  it("places the managed-only slot after cash actions and before history without changing the plain cash view", async () => {
    const response = await cashMarginsResponse();
    const managed = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        response={response}
        appearance="financial"
        cashAction={<button>Existing cash action</button>}
      />,
    );
    expect(managed.indexOf('class="sec-annual-cash-margins"')).toBeGreaterThan(
      managed.indexOf("Existing cash action"),
    );
    expect(managed.indexOf('class="sec-annual-cash-margins"')).toBeLessThan(
      managed.indexOf("<summary>Reported cash history</summary>"),
    );
    expect(
      renderToStaticMarkup(<SecAnnualEvidenceResult response={response} />),
    ).not.toContain("sec-annual-cash-margins");
    expect(
      renderToStaticMarkup(<SecAnnualCashGeneration response={response} />),
    ).not.toContain("sec-annual-cash-margins");
  });

  it("retains independent signed and zero percentages while refusing only a nonpositive or missing revenue basis", async () => {
    const response = await cashMarginsResponse({
      revenueRows: [row("Revenues", "1000"), row("SalesRevenueNet", "0")],
      cashRows: [
        cashRow("operating_cash_flow", "-50"),
        cashRow("ppe_purchases", "0"),
      ],
    });
    const html = renderToStaticMarkup(
      <SecAnnualCashMargins response={response} />,
    );
    expect(html).toContain(">-5.00%<");
    expect(
      response.evidence.operatingResults.resolution.margins.find(
        (basis) =>
          basis.concept ===
          "RevenueFromContractWithCustomerExcludingAssessedTax",
      )!.revenue,
    ).toMatchObject({
      status: "unavailable",
      reason: "no_report_period",
    });
    expect(html).toContain(
      "Unavailable. Reported revenue: No observation covers the selected annual filing&#x27;s period.",
    );
    expect(html).toContain(
      "Unavailable. This percentage requires reported revenue greater than zero.",
    );
    expect(html).not.toContain("Operating margin requires");
    const zero = await cashMarginsResponse({
      cashRows: [
        cashRow("operating_cash_flow", "20.025"),
        cashRow("ppe_purchases", "20.025"),
      ],
    });
    expect(
      renderToStaticMarkup(<SecAnnualCashMargins response={zero} />).match(
        />0\.00%</gu,
      ),
    ).toHaveLength(3);
  });

  it.each([
    {
      rows: [cashRow("ppe_purchases", "20")],
      text: "Operating cash flow: This reported cash concept is absent from the source.",
    },
    {
      rows: [cashRow("operating_cash_flow", "120")],
      text: "PP&amp;E purchases: This reported cash concept is absent from the source.",
    },
    {
      rows: [
        cashRow("operating_cash_flow", "120"),
        cashRow("ppe_purchases", "-20"),
      ],
      text: "Reported PP&amp;E purchases are negative; this percentage is unavailable.",
    },
    {
      rows: [
        cashRow("operating_cash_flow", "120"),
        cashRow("ppe_purchases", "20", {
          startDate: "2025-01-08",
          durationDays: 358,
        }),
      ],
      text: "The cash amounts and revenue cover different periods.",
    },
  ])("keeps operand evidence visible when $text", async ({ rows, text }) => {
    const response = await cashMarginsResponse({ cashRows: rows });
    const html = renderToStaticMarkup(
      <SecAnnualCashMargins response={response} />,
    );
    expect(
      html.match(
        new RegExp(
          `Unavailable\\. ${text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`,
          "gu",
        ),
      ),
    ).toHaveLength(3);
    for (const input of [
      ...response.evidence.cashGeneration.operatingCashFlow.observations,
      ...response.evidence.cashGeneration.ppePurchases.observations,
    ]) {
      expect(html).toContain(input.id);
      expect(html).toContain(`>${input.value}<`);
    }
  });

  it("renders maximum raw precision and original historical clocks without truncating values", async () => {
    const exact = `-${"9".repeat(61)}.1`;
    expect(exact).toHaveLength(64);
    const response = await cashMarginsResponse({
      cutoffAt: "2028-09-20T00:00:00.000Z",
      revenueRows: [row("Revenues", "1")],
      cashRows: [
        cashRow("operating_cash_flow", exact),
        cashRow("ppe_purchases", "0"),
      ],
    });
    const html = renderToStaticMarkup(
      <SecAnnualCashMargins response={response} />,
    );
    expect(html).toContain(`>${exact}<`);
    expect(html).toContain(`>-${"9".repeat(61)}10.00%<`);
    expect(html).toContain(
      "Historical value; outside current-use limits at this load.",
    );
    expect(html).toContain(
      "Historical amount; outside current-use limits at this load.",
    );
    expect(html).toContain("Completed 2028-09-20T00:00:02.000Z");
    expect(html).toContain("2025-01-01 to 2025-12-31");
  });

  it("explains a typed-model filing mismatch while retaining each original reference", async () => {
    const response = await cashMarginsResponse();
    const cash = response.evidence.cashGeneration;
    if (cash.resolution.ppePurchases.status !== "available")
      throw new Error("Expected admitted purchases");
    // Deliberate derived-model mutation; this is not claimed as wire-admitted data.
    const changed = {
      ...response,
      evidence: {
        ...response.evidence,
        cashGeneration: {
          ...cash,
          resolution: {
            ...cash.resolution,
            ppePurchases: {
              ...cash.resolution.ppePurchases,
              accessionNumber: "0000000001-26-000002",
            },
          },
        },
      },
    };
    const html = renderToStaticMarkup(
      <SecAnnualCashMargins response={changed} />,
    );
    expect(
      html.match(
        /The cash amounts and revenue come from different filings\./gu,
      ),
    ).toHaveLength(3);
    expect(html).toContain(cash.resolution.ppePurchases.observationIds[0]!);
  });
});
