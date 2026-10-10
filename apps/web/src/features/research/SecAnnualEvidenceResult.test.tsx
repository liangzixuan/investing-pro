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

describe("shared annual result", () => {
  it("shows three dated same-filing periods in a plain-text disclosure with inspectable inputs", async () => {
    const wire = await response(annualHistoryRows());
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={wire} />,
    );
    expect(html).toContain('aria-label="Reported annual history Revenues"');
    expect(html).toContain("Read reported annual history · 3 periods");
    expect(html).toContain("2023-01-01 to 2023-12-31");
    expect(html).toContain("Revenue · USD</dt><dd>640</dd>");
    expect(html).toContain("Net income · USD</dt><dd>32</dd>");
    expect(html).toContain("Net margin · %</dt><dd>5%</dd>");
    expect(html).toContain("Inspect period inputs · 2023-12-31");
    expect(html).not.toContain("The next earlier period is unavailable");
  });

  it("keeps available dates and amounts when the next earlier pair is missing", async () => {
    const wire = await response(annualComparativeRows());
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={wire} />,
    );
    expect(html).toContain("Read reported annual history · 2 periods");
    expect(html).toContain("The next earlier period is unavailable.");
    expect(html).toContain("Revenue reported change</dt><dd>25%</dd>");
  });
  it("shows exact adjacent annual amounts, reported changes and all four operand references", async () => {
    const wire = await response(annualComparativeRows());
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={wire} />,
    );
    expect(html).toContain('aria-label="Reported annual comparison Revenues"');
    expect(html).toContain(
      "Prior: 2024-01-01 to 2024-12-31. Current: 2025-01-01 to 2025-12-31.",
    );
    expect(html).toContain("Revenue prior · USD</dt><dd>800</dd>");
    expect(html).toContain("Revenue change · USD</dt><dd>200</dd>");
    expect(html).toContain("Net income change · USD</dt><dd>20</dd>");
    expect(html).toContain("Revenue reported change</dt><dd>25%</dd>");
    expect(html).toContain("Net margin prior · %</dt><dd>10%</dd>");
    expect(html).toContain("Net margin current · %</dt><dd>10%</dd>");
    expect(html).toContain(
      "Net margin change · percentage points</dt><dd>0 percentage points</dd>",
    );
    expect(html).toContain(
      "No adjustment for period length, accounting changes or restatements",
    );
    for (const row of wire.evidence.observations)
      expect(html).toContain(row.id);
    expect(html).toContain("Inspect annual comparison inputs · Revenues");
  });

  it.each(["0", "-100"])(
    "withholds prior margin for prior revenue %s while retaining other reported amounts",
    async (priorRevenue) => {
      const prior = {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        durationDays: 366,
      };
      const wire = await response([
        row("Revenues", "1000"),
        row("NetIncomeLoss", "100"),
        row("Revenues", priorRevenue, prior),
        row("NetIncomeLoss", "-10", prior),
      ]);
      const html = renderToStaticMarkup(
        <SecAnnualEvidenceResult response={wire} />,
      );
      expect(html).toContain(
        `Revenue prior · USD</dt><dd>${priorRevenue}</dd>`,
      );
      expect(html).toContain("Net margin current · %</dt><dd>10%</dd>");
      expect(html).toContain(
        `Unavailable: prior revenue is ${priorRevenue === "0" ? "zero" : "negative"}`,
      );
      expect(html).not.toContain("NaN");
      expect(html).not.toContain("Infinity");
    },
  );

  it.each([
    ["1.005", "1.004", "higher"],
    ["1.004", "1.005", "lower"],
  ])(
    "discloses the sub-display margin change for current income %s and prior %s",
    async (currentIncome, priorIncome, direction) => {
      const prior = {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        durationDays: 366,
      };
      const wire = await response([
        row("Revenues", "100"),
        row("NetIncomeLoss", currentIncome),
        row("Revenues", "100", prior),
        row("NetIncomeLoss", priorIncome, prior),
      ]);
      const html = renderToStaticMarkup(
        <SecAnnualEvidenceResult response={wire} />,
      );
      expect(html).toContain(`Less than 0.01 percentage points ${direction}`);
    },
  );

  it("keeps the current pair visible when comparison is unavailable under its original age policy", async () => {
    const wire = await response(
      annualComparativeRows(),
      "2027-09-20T00:00:00.000Z",
    );
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={wire} />,
    );
    expect(html).toContain("Reported annual comparison unavailable.");
    expect(html).toContain(
      "outside the current-use policy at its original load",
    );
    expect(html).toContain("Revenue · USD</dt>");
    expect(html).not.toContain("Revenue reported change</dt>");
  });

  it("explains nonpositive prior percentages and nonzero changes rounded to zero", async () => {
    const prior = {
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      durationDays: 366,
    };
    const wire = await response([
      row("Revenues", "100.0001"),
      row("NetIncomeLoss", "-1"),
      row("Revenues", "100", prior),
      row("NetIncomeLoss", "0", prior),
    ]);
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={wire} />,
    );
    expect(html).toContain("Less than 0.01% higher");
    expect(html).toContain("Unavailable: prior value is zero");
    expect(html).toContain("Net income change · USD</dt><dd>-1</dd>");
  });
  it("retains signed values, separate revenue concepts and inspectable provenance", async () => {
    const wire = await response([
      row("Revenues", "1000"),
      row("SalesRevenueNet", "900"),
      row("NetIncomeLoss", "-25"),
    ]);
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={wire} />,
    );
    expect(html).toContain("Net income · USD");
    expect(html).toContain(">-25</dd>");
    expect(html).toContain(">-2.5</dd>");
    expect(html).toContain('aria-label="Annual revenue basis SalesRevenueNet"');
    expect(html).toContain('aria-label="Annual revenue basis Revenues"');
    expect(html).toContain("Inspect selected-report evidence (3 observations)");
    expect(html).toContain(wire.evidence.generation.sha256);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("Load observed annual report");
  });

  it("keeps complete coverage distinct from a missing pair and current-use refusal", async () => {
    const wire = await response([row()]);
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={wire} />,
    );
    expect(html).toContain("Complete for the four requested USD concepts");
    expect(html).toContain("No valid annual pair");
    expect(html).toContain("Unavailable under the current-use policy");
    expect(html).toContain(
      "NetIncomeLoss is missing for this filing and exact period",
    );
    expect(html).not.toContain("Net margin · %</dt>");
  });

  it("offers an explicitly named action for each eligible basis without choosing one", async () => {
    const wire = await response([
      row("Revenues", "1000"),
      row("SalesRevenueNet", "900"),
      row("NetIncomeLoss", "-25"),
    ]);
    const renderPairAction = vi.fn((pair: PersonalSecAnnualPairDto) => (
      <button aria-label={`Add ${pair.concept} annual evidence to note draft`}>
        Add to note draft
      </button>
    ));
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        response={wire}
        renderPairAction={renderPairAction}
      />,
    );
    expect(renderPairAction.mock.calls.map(([pair]) => pair)).toEqual(
      wire.evidence.resolution.bases.flatMap((basis) =>
        basis.pairs.filter((pair) => pair.status === "eligible"),
      ),
    );
    expect(renderPairAction).toHaveBeenCalledTimes(2);
    for (const concept of ["Revenues", "SalesRevenueNet"])
      expect(html).toContain(
        `aria-label="Add ${concept} annual evidence to note draft"`,
      );
    expect(html).toContain(
      'aria-label="Annual revenue basis RevenueFromContractWithCustomerExcludingAssessedTax"',
    );
  });

  it("does not offer pair actions when the displayed evidence has no eligible pair", async () => {
    const wire = await response([row()]);
    const renderPairAction = vi.fn(() => <button>Add to note draft</button>);
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        response={wire}
        renderPairAction={renderPairAction}
      />,
    );
    expect(renderPairAction).not.toHaveBeenCalled();
    expect(html).not.toContain("Add to note draft");
    expect(html).toContain("No valid annual pair");
  });
});
