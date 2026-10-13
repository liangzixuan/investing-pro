import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PersonalSecAnnualPairDto } from "@research-cockpit/contracts";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";
import {
  annualComparativeRows,
  annualHistoryRows,
  response,
  row,
} from "./sec-annual-evidence-fixture";

const render = (wire: Awaited<ReturnType<typeof response>>) =>
  renderToStaticMarkup(
    <SecAnnualEvidenceResult response={wire} appearance="financial" />,
  );
const overview = (html: string) =>
  html.split('<details class="managed-annual-provenance">')[0]!;

describe("managed annual financial overview", () => {
  it.each([
    [1, () => [row(), row("NetIncomeLoss", "100")]],
    [2, annualComparativeRows],
    [3, annualHistoryRows],
  ] as const)(
    "shows %s admitted periods before closed provenance, with each current amount once",
    async (count, rows) => {
      const wire = await response(rows());
      const html = render(wire);
      const visible = overview(html);
      expect(visible).toContain(
        `Reported annual amounts · ${count} ${count === 1 ? "period" : "periods"}`,
      );
      expect(visible.match(/<td>1000<\/td>/gu)).toHaveLength(1);
      expect(visible).toContain('<th scope="row">Revenue');
      expect(visible).toContain(
        '<time dateTime="2025-01-01">2025-01-01</time>',
      );
      expect(visible).toContain(
        'aria-label="Annual financial results" tabindex="0"',
      );
      expect(visible).toContain("2026-09-20T00:00:02.000Z");
      if (wire.evidence.target.status === "target")
        expect(visible).toContain(`filed ${wire.evidence.target.filedDate}`);
      expect(visible).toContain(
        "Revenue and income are within current-use limits at this load.",
      );
      expect(visible).not.toContain("Source ages at completion:");
      expect(
        visible.split(
          '<details class="sec-quarterly-row-details sec-annual-cash-source">',
        )[0],
      ).not.toContain("Report age at cutoff:");
      expect(visible).not.toContain("485-day");
      expect(visible).not.toContain("Reported annual financials");
      expect(visible).toContain(
        '<details class="managed-annual-trend"><summary>Reported annual trend</summary>',
      );
      expect(visible).toContain("data-annual-trend-basis");
      expect(visible).toContain("data-annual-trend-metric");
      expect(visible).not.toContain("managed-annual-trend-canvas");
      expect(html).toContain(
        '<details class="managed-annual-provenance"><summary>Source and validation details</summary>',
      );
      expect(visible).not.toContain("Revenue and income scan:");
      expect(html).toContain(wire.evidence.generation.sha256);
      const provenance = html.slice(visible.length);
      expect(provenance).toContain("Source ages at completion:");
      expect(provenance).toContain("Report age at cutoff:");
      expect(provenance).toContain("485-day report / seven-day source limits");
      expect(provenance).toContain("complete filing history or prices");
      expect(provenance).toContain("Percentage change is (current − prior)");
      expect(provenance).toContain("rounded half up to two decimal places");
      expect(provenance).toContain(
        "Margin change subtracts the unrounded ratios",
      );
      expect(provenance).toContain("unusual items in NetIncomeLoss");
      for (const observation of wire.evidence.observations)
        expect(html).toContain(observation.id);
      if (count > 1) {
        expect(visible).toContain("<td>800</td>");
        expect(visible).toContain("<td>200</td><td>25%</td>");
        expect(visible).toContain("Net margin change · 0 percentage points");
      }
      if (count === 3) {
        expect(visible).toContain("<td>640</td>");
        expect(visible).toContain("Earlier reported annual comparison");
        expect(visible).toContain("<td>48</td><td>150%</td>");
      } else
        expect(visible).toContain("The next earlier period is unavailable.");
    },
  );

  it("keeps the local renderer's context-first structure and existing history disclosure", async () => {
    const wire = await response(annualHistoryRows());
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={wire} />,
    );
    expect(html.indexOf("Revenue and income evidence")).toBeLessThan(
      html.indexOf("Revenue · USD"),
    );
    expect(html).toContain(
      '<details class="sec-quarterly-row-details sec-annual-history"',
    );
    expect(html).not.toContain("managed-annual-overview");
    expect(html).not.toContain("Source and validation details");
    expect(html).not.toContain("managed-annual-trend");
  });

  it("keeps each eligible basis distinct and passes the original pairs to explicit actions", async () => {
    const wire = await response([
      row(),
      row("SalesRevenueNet", "900"),
      row("NetIncomeLoss", "-25"),
    ]);
    const action = vi.fn((pair: PersonalSecAnnualPairDto) => (
      <button>Add {pair.concept} to note draft</button>
    ));
    const originalOrder = wire.evidence.resolution.bases.map(
      (basis) => basis.concept,
    );
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        response={wire}
        appearance="financial"
        renderPairAction={action}
      />,
    );
    const visible = overview(html);
    expect(visible).toContain("<td>-25</td>");
    expect(visible).toContain("<td>-2.5%</td>");
    expect(visible).toContain("<td>900</td>");
    for (const concept of ["Revenues", "SalesRevenueNet"]) {
      expect(visible).toContain(`aria-label="Annual revenue basis ${concept}"`);
      expect(visible).toContain(`Add ${concept} to note draft`);
    }
    expect(action.mock.calls.map(([pair]) => pair)).toEqual(
      wire.evidence.resolution.bases.flatMap((basis) =>
        basis.pairs.filter((pair) => pair.status === "eligible"),
      ),
    );
    expect(visible).toContain("Unknown: this revenue basis is missing");
    expect(
      wire.evidence.resolution.bases.map((basis) => basis.concept),
    ).toEqual(originalOrder);
    expect(
      visible.match(/aria-label="Annual financial results"/gu),
    ).toHaveLength(1);
    expect(visible.match(/tabindex="0"/gu)).toHaveLength(1);
    expect(
      visible.indexOf('aria-label="Annual revenue basis Revenues"'),
    ).toBeLessThan(
      visible.indexOf(
        'aria-label="Annual revenue basis RevenueFromContractWithCustomerExcludingAssessedTax"',
      ),
    );
    const local = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={wire} />,
    );
    const positions = originalOrder.map((concept) =>
      local.indexOf(`aria-label="Annual revenue basis ${concept}"`),
    );
    expect(positions).toEqual(
      [...positions].sort((left, right) => left - right),
    );
  });

  it.each(["0", "-100"])(
    "retains prior amount %s and shows unavailable percentages beside it",
    async (prior) => {
      const dates = {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        durationDays: 366,
      };
      const visible = overview(
        render(
          await response([
            row(),
            row("NetIncomeLoss", "100"),
            row("Revenues", prior, dates),
            row("NetIncomeLoss", "0", dates),
          ]),
        ),
      );
      expect(visible).toContain(`<td>${prior}</td>`);
      expect(visible).toContain(
        `Unavailable: prior value is ${prior === "0" ? "zero" : "negative"}`,
      );
      expect(visible).toContain("Unavailable: revenue must be positive");
      expect(visible).toContain(
        "Net margin change · Unavailable: prior revenue",
      );
      expect(visible).not.toMatch(/NaN|Infinity/u);
    },
  );

  it("uses the existing tiny-change formatter without rounding source amounts", async () => {
    const dates = {
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      durationDays: 366,
    };
    const visible = overview(
      render(
        await response([
          row("Revenues", "100.0001"),
          row("NetIncomeLoss", "1.005"),
          row("Revenues", "100", dates),
          row("NetIncomeLoss", "1.004", dates),
        ]),
      ),
    );
    expect(visible).toContain("<td>100.0001</td>");
    expect(visible).toContain("Less than 0.01% higher");
    expect(visible).toContain("Less than 0.01 percentage points higher");
  });

  it("keeps historical current amounts visible with the original current-use refusal and no history", async () => {
    const visible = overview(
      render(await response(annualHistoryRows(), "2027-09-20T00:00:00.000Z")),
    );
    expect(visible).toContain(
      "Revenue and income are unavailable under the current-use policy at this load.",
    );
    expect(visible).toContain(
      "outside the current-use policy at its original load",
    );
    expect(visible).toContain("<td>1000</td>");
    expect(visible).toContain("Reported annual amounts · 1 period");
    expect(visible).not.toContain("<td>800</td>");
    expect(visible).not.toContain("Earlier reported annual comparison");
  });

  it("keeps a complete-but-missing pair visible as unavailable and offers no action or table", async () => {
    const wire = await response([row()]);
    const action = vi.fn(() => <button>Add to note draft</button>);
    const visible = overview(
      renderToStaticMarkup(
        <SecAnnualEvidenceResult
          response={wire}
          appearance="financial"
          renderPairAction={action}
        />,
      ),
    );
    expect(visible).toContain(
      "NetIncomeLoss is missing for this filing and exact period",
    );
    expect(visible).toContain(
      'aria-label="Annual financial results" tabindex="0"',
    );
    expect(visible).not.toContain("<table");
    expect(action).not.toHaveBeenCalled();
  });
});
