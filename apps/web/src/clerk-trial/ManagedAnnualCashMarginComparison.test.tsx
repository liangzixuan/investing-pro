import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS as concepts,
  type PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import { derivePersonalSecAnnualCashMargins } from "@research-cockpit/personal-financial-analytics";
import {
  ManagedAnnualCashMarginComparisonRows,
  ManagedAnnualCashMarginComparisonSources,
} from "./ManagedAnnualCashMarginComparison";
import {
  annualComparisonCashRows,
  annualComparisonResponse,
  annualComparisonRows,
} from "./annual-comparison-fixture";
import {
  SecAnnualCashMarginInputs,
  SecAnnualCashMarginValueContent,
} from "../features/research/SecAnnualCashMargins";

type Response = PersonalSecAnnualEvidenceResponseDto;
type Side = "left" | "right";
function revenueRows(side: Side) {
  const current = annualComparisonRows(side).find(
    (row) => row.metric === "revenue",
  )!;
  return concepts.map((concept, index) => ({
    ...current,
    concept,
    value: (side === "left" ? ["500", "1000", "800"] : ["400", "750", "600"])[
      index
    ]!,
  }));
}
async function packet(
  side: Side,
  overrides: Parameters<typeof annualComparisonResponse>[1] = {},
) {
  return annualComparisonResponse(side, {
    rows: revenueRows(side),
    cashRows: annualComparisonCashRows(side).map((row) => ({
      ...row,
      value:
        side === "right"
          ? row.value
          : row.metric === "operating_cash_flow"
            ? "120.125"
            : "20.025",
    })),
    ...overrides,
  });
}
function rows(left: Response | null, right: Response | null) {
  return renderToStaticMarkup(
    <table>
      <tbody>
        <ManagedAnnualCashMarginComparisonRows responses={{ left, right }} />
      </tbody>
    </table>,
  );
}
function cells(html: string, concept: string) {
  const row = html
    .split(`data-annual-comparison-cash-margin="${concept}"`)[1]!
    .split("</tr>")[0]!;
  return [...row.matchAll(/<td>(.*?)<\/td>/gu)].map((match) => match[1]!);
}
function sources(response: Response) {
  return renderToStaticMarkup(
    <ManagedAnnualCashMarginComparisonSources response={response} />,
  );
}

function expectMarginValuesAndReferences(
  html: string,
  inputs: string,
  basisInputs: ReturnType<typeof derivePersonalSecAnnualCashMargins>,
  side: Side,
) {
  for (const basis of basisInputs) {
    expect(cells(html, basis.concept)[side === "left" ? 0 : 1]).toContain(
      renderToStaticMarkup(<SecAnnualCashMarginValueContent basis={basis} />),
    );
    for (const id of basis.margin.observationIds) expect(inputs).toContain(id);
  }
}
function expectOriginalSourceCoordinates(inputs: string, response: Response) {
  for (const observation of [
    ...response.evidence.observations,
    ...response.evidence.cashGeneration.operatingCashFlow.observations,
    ...response.evidence.cashGeneration.ppePurchases.observations,
  ]) {
    for (const value of [
      observation.sourceLocator,
      observation.accessionNumber,
      observation.filedDate,
    ])
      expect(inputs).toContain(value);
  }
  const generation = response.evidence.generation;
  for (const value of [
    generation.cutoffAt,
    generation.completedAt,
    generation.sources.companyFacts.fetchedAt!,
    generation.sources.submissions.fetchedAt!,
  ])
    expect(inputs).toContain(value);
}

describe("cash margin comparison presentation", () => {
  it("keeps three fixed semantic rows unloaded and adds no action or selected basis", () => {
    const html = rows(null, null);
    expect(html.match(/<tr /gu)).toHaveLength(3);
    expect(html.match(/<th scope="row">/gu)).toHaveLength(3);
    for (const concept of concepts)
      expect(cells(html, concept)).toEqual(["Not loaded", "Not loaded"]);
    expect(html).not.toMatch(/<(?:button|select|input)\b/u);
  });

  it("shows all bases for two independent filings without either income measure", async () => {
    const left = await packet("left");
    const right = await packet("right");
    const before = JSON.stringify({ left, right });
    const html = rows(left, right);
    for (const response of [left, right]) {
      expect(response.evidence.resolution.selectedReportPairEligible).toBe(
        false,
      );
      expect(
        response.evidence.operatingResults.resolution.operatingIncome.status,
      ).toBe("unavailable");
    }
    concepts.forEach((concept, index) => {
      const [first, second] = cells(html, concept);
      expect(first).toContain(`>${["20.02", "10.01", "12.51"][index]}%<`);
      expect(second).toContain(`>${["150.00", "80.00", "100.00"][index]}%<`);
      expect(first).toContain(`>${["500", "1000", "800"][index]}<`);
      expect(second).toContain(`>${["400", "750", "600"][index]}<`);
      expect(first).toContain("2025-01-01 to 2025-12-31");
      expect(second).toContain("2024-07-01 to 2025-06-30");
      for (const cell of [first, second]) {
        expect(cell).toContain("Reported revenue · USD");
        expect(cell).toContain("reported revenue (%) · App calculation");
        expect(
          cell?.match(/Within current-use limits at this load\./gu),
        ).toHaveLength(2);
      }
    });
    expect(JSON.stringify({ left, right })).toBe(before);
  });

  it("reuses the complete company value and input bodies with original per-side references and clocks", async () => {
    for (const side of ["left", "right"] as const) {
      const response = await packet(side);
      const html = rows(
        side === "left" ? response : null,
        side === "right" ? response : null,
      );
      const inputs = sources(response);
      const basisInputs = derivePersonalSecAnnualCashMargins(response.evidence);
      const expectedInputs = basisInputs
        .map((basis) =>
          renderToStaticMarkup(
            <SecAnnualCashMarginInputs
              basis={basis}
              evidence={response.evidence}
            />,
          ),
        )
        .join("");
      expect(inputs).toBe(expectedInputs);
      expect(
        inputs.match(
          /<details class="sec-quarterly-row-details sec-annual-cash-margin-inputs">/gu,
        ),
      ).toHaveLength(3);
      expect(inputs).not.toMatch(/<details[^>]*\sopen(?:[ =>])/u);
      expectMarginValuesAndReferences(html, inputs, basisInputs, side);
      expectOriginalSourceCoordinates(inputs, response);
      const otherAccession =
        side === "left" ? "0000000002-25-000001" : "0000000001-26-000001";
      expect(inputs).not.toContain(otherAccession);
    }
  });

  it("keeps signed and zero results and refuses only the missing or nonpositive basis", async () => {
    const cash = annualComparisonCashRows("left").map((row) => ({
      ...row,
      value: row.metric === "operating_cash_flow" ? "-50" : "0",
    }));
    const left = await packet("left", {
      rows: revenueRows("left")
        .filter((row) => row.concept !== concepts[0])
        .map((row) => ({
          ...row,
          value: row.concept === "Revenues" ? "1000" : "0",
        })),
      cashRows: cash,
    });
    const right = await packet("right", {
      cashRows: annualComparisonCashRows("right").map((row) => ({
        ...row,
        value: "20.025",
      })),
    });
    const html = rows(left, right);
    expect(cells(html, "Revenues")[0]).toContain(">-5.00%<");
    expect(cells(html, "SalesRevenueNet")[0]).toContain(
      "This percentage requires reported revenue greater than zero.",
    );
    expect(cells(html, concepts[0])[0]).toContain(
      "Unavailable. Reported revenue:",
    );
    for (const concept of concepts)
      expect(cells(html, concept)[1]).toContain(">0.00%<");
  });

  it.each([
    {
      name: "missing OCF",
      rows: annualComparisonCashRows("left").filter(
        (row) => row.metric === "ppe_purchases",
      ),
      reason:
        "Operating cash flow: This reported cash concept is absent from the source.",
    },
    {
      name: "negative PP&E",
      rows: annualComparisonCashRows("left").map((row) => ({
        ...row,
        value: row.metric === "ppe_purchases" ? "-20" : row.value,
      })),
      reason:
        "Reported PP&amp;E purchases are negative; this percentage is unavailable.",
    },
    {
      name: "different period",
      rows: annualComparisonCashRows("left").map((row) =>
        row.metric === "ppe_purchases"
          ? { ...row, startDate: "2025-01-08", durationDays: 358 }
          : row,
      ),
      reason: "The cash amounts and revenue cover different periods.",
    },
  ])(
    "retains original operands and independently refuses $name",
    async ({ rows: cashRows, reason }) => {
      const left = await packet("left", { cashRows });
      const right = await packet("right");
      const html = rows(left, right);
      for (const concept of concepts) {
        expect(cells(html, concept)[0]).toContain(reason);
        expect(cells(html, concept)[1]).not.toContain("Unavailable");
      }
      for (const observation of [
        ...left.evidence.cashGeneration.operatingCashFlow.observations,
        ...left.evidence.cashGeneration.ppePurchases.observations,
      ])
        expect(sources(left)).toContain(observation.id);
    },
  );

  it("distinguishes a rejected revenue scan from an unloaded side while cash operands remain inspectable", async () => {
    const left = await packet("left", { mode: "income-invalid" });
    const html = rows(left, null);
    for (const concept of concepts) {
      expect(cells(html, concept)[0]).toContain(
        "Unavailable. Reported revenue:",
      );
      expect(cells(html, concept)[1]).toBe("Not loaded");
    }
    expect(sources(left)).toContain(">120.125<");
    expect(sources(left)).toContain(">20.025<");
  });

  it("keeps long exact results and historical qualification local to their original side", async () => {
    const exact = `-${"9".repeat(61)}.1`;
    const left = await packet("left", {
      cutoffAt: "2028-09-20T00:00:00.000Z",
      rows: revenueRows("left").map((row) => ({ ...row, value: "1" })),
      cashRows: annualComparisonCashRows("left").map((row) => ({
        ...row,
        value: row.metric === "operating_cash_flow" ? exact : "0",
      })),
    });
    const right = await packet("right");
    const html = rows(left, right);
    for (const concept of concepts) {
      expect(cells(html, concept)[0]).toContain(`>-${"9".repeat(61)}10.00%<`);
      expect(cells(html, concept)[0]).toContain(
        "Historical value; outside current-use limits at this load.",
      );
      expect(cells(html, concept)[1]).not.toContain("Historical");
    }
    expect(sources(left)).toContain(`>${exact}<`);
    expect(sources(left)).toContain("Completed 2028-09-20T00:00:02.000Z");
  });

  it("labels a non-wire typed filing-mismatch probe without mixing either company's references", async () => {
    const response = await packet("left");
    const cash = response.evidence.cashGeneration;
    if (cash.resolution.ppePurchases.status !== "available")
      throw new Error("Expected admitted purchases");
    // Deliberate derived-model probe; this altered packet is not wire-admitted.
    const changed: Response = {
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
    const html = rows(changed, await packet("right"));
    for (const concept of concepts)
      expect(cells(html, concept)[0]).toContain(
        "The cash amounts and revenue come from different filings.",
      );
    expect(sources(changed)).toContain(
      cash.resolution.ppePurchases.observationIds[0]!,
    );
  });
});
