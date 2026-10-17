import { viewOf } from "./test-canonical-annual-ui-fixture";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../../lib/test-personal-sec-annual-api-fixture";
import { admitUiPacket } from "./test-canonical-annual-ui-fixture";
import { cashRow, cashResponse } from "./test-canonical-annual-cash-ui-fixture";
import {
  SecAnnualCashGeneration,
  SecAnnualCashSourceBody,
  SecAnnualCashValueContent,
} from "./SecAnnualCashGeneration";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";

describe("Annual cash generation presentation", () => {
  it("keeps all100 agreeing references per cash concept and the exact calculation", async () => {
    const rows = (["operating_cash_flow", "ppe_purchases"] as const).flatMap(
      (metric) =>
        Array.from({ length: 100 }, (_, index) =>
          cashRow(metric, metric === "operating_cash_flow" ? "120" : "20", {
            frame: `CY2025-${index}`,
          }),
        ),
    );
    const wire = await cashResponse(rows);
    const cash = viewOf(wire).cashGeneration.resolution;
    expect(cash.operatingCashFlow.observationIds).toHaveLength(100);
    expect(cash.ppePurchases.observationIds).toHaveLength(100);
    expect(cash.operatingCashFlowLessPpePurchases).toMatchObject({
      status: "available",
      value: "100",
    });
    expect(cash.operatingCashFlowLessPpePurchases.observationIds).toHaveLength(
      200,
    );
    const html = renderToStaticMarkup(
      <SecAnnualCashGeneration response={wire} view={viewOf(wire)} />,
    );
    for (const reference of cash.operatingCashFlowLessPpePurchases
      .observationIds)
      expect(html).toContain(reference);
    expect(
      html.match(
        /Returned 100 of 100 selected-filing observations; 0 omitted\./gu,
      ),
    ).toHaveLength(2);
  });
  it("refuses a101-row concept as a whole while retaining the independent cash operand", async () => {
    const wire = await cashResponse([
      ...Array.from({ length: 101 }, (_, index) =>
        cashRow("operating_cash_flow", "120", { frame: `CY2025-${index}` }),
      ),
      cashRow("ppe_purchases", "20"),
    ]);
    const cash = viewOf(wire).cashGeneration.resolution;
    expect(cash.operatingCashFlow).toMatchObject({
      status: "unavailable",
      reason: "selected_report_overflow",
      observationIds: [],
    });
    expect(cash.ppePurchases).toMatchObject({
      status: "available",
      value: "20",
    });
    expect(
      wire.evidence.facts.observations.filter(
        (row) => row.concept === "NetCashProvidedByUsedInOperatingActivities",
      ),
    ).toEqual([]);
    const html = renderToStaticMarkup(
      <SecAnnualCashGeneration response={wire} view={viewOf(wire)} />,
    );
    expect(html).toContain(
      "Returned 0 of 101 selected-filing observations; 101 omitted.",
    );
    expect(html).toContain("This filing exceeds the cash observation limit.");
    expect(html).not.toContain('class="sec-annual-cash-amount">120<');
  });
  it("renders independent cash values and refusals inside table cells without layout wrappers", async () => {
    const exact = `-${"9".repeat(61)}.1`;
    expect(exact).toHaveLength(64);
    const wire = await cashResponse(
      [
        cashRow("operating_cash_flow", exact),
        cashRow("ppe_purchases", "0", {
          startDate: "2025-01-08",
          durationDays: 358,
        }),
      ],
      "2028-09-20T00:00:00.000Z",
    );
    const before = JSON.stringify(wire);
    const { resolution } = viewOf(wire).cashGeneration;
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <td>
              <SecAnnualCashValueContent value={resolution.operatingCashFlow} />
            </td>
            <td>
              <SecAnnualCashValueContent value={resolution.ppePurchases} />
            </td>
            <td>
              <SecAnnualCashValueContent
                value={resolution.operatingCashFlowLessPpePurchases}
              />
            </td>
          </tr>
        </tbody>
      </table>,
    );
    expect(html).toContain(`class="sec-annual-cash-amount">${exact}<`);
    expect(html).toContain('class="sec-annual-cash-amount">0<');
    expect(html).toContain("2025-01-01 to 2025-12-31");
    expect(html).toContain("2025-01-08 to 2025-12-31");
    expect(html).toContain(
      "Historical amount; outside current-use limits at this load.",
    );
    expect(html).toContain(
      "Unavailable. The reported cash amounts cover different periods.",
    );
    expect(html).not.toMatch(/<(?:dl|dt|dd|details|section)[ >]/u);
    expect(JSON.stringify(wire)).toBe(before);
  });

  it("reuses complete cash source content inside the existing company disclosure", async () => {
    const wire = await cashResponse([
      cashRow("operating_cash_flow", "120.125"),
      cashRow("ppe_purchases", "20.025"),
    ]);
    const body = renderToStaticMarkup(
      <SecAnnualCashSourceBody response={wire} view={viewOf(wire)} />,
    );
    const company = renderToStaticMarkup(
      <SecAnnualCashGeneration response={wire} view={viewOf(wire)} />,
    );
    expect(company).toContain(
      `<summary>Cash sources and calculation inputs</summary>${body}</details>`,
    );
    expect(body.startsWith("<p>")).toBe(true);
    expect(body).not.toContain(
      "<summary>Cash sources and calculation inputs</summary>",
    );
    expect(body).toContain("Company Facts captured 2026-09-20T00:00:01.000Z");
    expect(body).toContain("Submissions captured 2026-09-20T00:00:02.000Z");
    expect(body).toContain("Completed 2026-09-20T00:00:02.000Z");
    expect(body).toContain(
      "within 485 days and source captures within seven days",
    );
    const { cashGeneration: cash } = viewOf(wire);
    for (const concept of [
      "NetCashProvidedByUsedInOperatingActivities",
      "PaymentsToAcquirePropertyPlantAndEquipment",
    ] as const) {
      expect(body).toMatch(
        /Scanned 1 rows: 0 invalid,\s*0 identical duplicates\. Returned\s*1 of 1 selected-filing observations;\s*0 omitted\./u,
      );
      for (const item of wire.evidence.facts.observations.filter(
        (row) => row.concept === concept,
      )) {
        expect(body).toContain(item.concept);
        expect(body).toContain(item.sourceLocator);
        expect(body).toContain(item.id);
        expect(body).toContain(item.accessionNumber);
      }
    }
    expect(body).toContain(
      `Calculation references: ${cash.resolution.operatingCashFlowLessPpePurchases.observationIds.join(" · ")}`,
    );
  });

  it("places a managed cash action after the calculation and before sources without changing local appearance", async () => {
    const wire = await cashResponse([
      cashRow("operating_cash_flow", "120.125"),
      cashRow("ppe_purchases", "20.025"),
    ]);
    const cashAction = <button>Invented cash note action</button>;
    const managed = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        response={wire}
        view={viewOf(wire)}
        appearance="financial"
        cashAction={cashAction}
      />,
    );
    const actionIndex = managed.indexOf("Invented cash note action");
    expect(actionIndex).toBeGreaterThan(
      managed.indexOf(
        "adjust for leases, acquisitions or other investing cash flows.",
      ),
    );
    expect(actionIndex).toBeLessThan(
      managed.indexOf("Cash sources and calculation inputs"),
    );
    const local = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        response={wire}
        view={viewOf(wire)}
        cashAction={cashAction}
      />,
    );
    expect(local).not.toContain("Invented cash note action");
    expect(local).toContain("Cash sources and calculation inputs");
  });

  it("shows exact reported operands, the labelled app calculation and inspectable original inputs", async () => {
    const wire = await cashResponse([
      cashRow("operating_cash_flow", "182935000000"),
      cashRow("ppe_purchases", "115948000000"),
    ]);
    const html = renderToStaticMarkup(
      <SecAnnualCashGeneration response={wire} view={viewOf(wire)} />,
    );
    expect(html).toContain("182935000000");
    expect(html).toContain("115948000000");
    expect(html).toContain("66987000000");
    expect(html).toContain("App calculation");
    expect(html).toContain("2025-01-01 to 2025-12-31");
    expect(html).toContain("Company Facts captured 2026-09-20T00:00:01.000Z");
    expect(html).toContain(
      "<summary>Cash sources and calculation inputs</summary>",
    );
    for (const row of wire.evidence.facts.observations.filter(
      (row) => row.concept === "NetCashProvidedByUsedInOperatingActivities",
    )) {
      expect(html).toContain(row.id);
      expect(html).toContain(row.sourceLocator);
    }
    expect(html).not.toContain("<details open");
    expect(html).not.toContain("button");
  });
  it("keeps an independently available signed cash amount when purchases are missing", async () => {
    const wire = await cashResponse([
      cashRow("operating_cash_flow", "-987.65"),
    ]);
    const html = renderToStaticMarkup(
      <SecAnnualCashGeneration response={wire} view={viewOf(wire)} />,
    );
    expect(html).toContain("-987.65");
    expect(html).toContain("Unavailable. This reported cash concept is absent");
    expect(html).not.toContain('class="sec-annual-cash-amount">0<');
  });
  it("preserves negative reported purchases and explains why subtraction is unavailable", async () => {
    const wire = await cashResponse([
      cashRow("operating_cash_flow", "100"),
      cashRow("ppe_purchases", "-20"),
    ]);
    const html = renderToStaticMarkup(
      <SecAnnualCashGeneration response={wire} view={viewOf(wire)} />,
    );
    expect(html).toContain('class="sec-annual-cash-amount">-20<');
    expect(html).toContain("Reported PP&amp;E purchases are negative");
    expect(html).not.toContain('class="sec-annual-cash-amount">120<');
  });
  it("renders cash independently of a failed income scan in the full financial view", async () => {
    const raw = structuredClone(
      await cashResponse([
        cashRow("operating_cash_flow", "17"),
        cashRow("ppe_purchases", "0"),
      ]),
    ) as TestAnnualPacket;
    raw.evidence.facts.observations = raw.evidence.facts.observations.filter(
      (row) => row.concept !== "NetIncomeLoss",
    );
    raw.evidence.facts.scans.find(
      (entry) => entry.concept === "NetIncomeLoss",
    )!.scan = { status: "invalid_response", absence: null, coverage: null };
    const wire = await admitUiPacket(await bindAnnualPacket(raw));
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        appearance="financial"
        response={wire}
        view={viewOf(wire)}
      />,
    );
    expect(html).toContain("Revenue and net income withheld");
    expect(html).toContain("Revenue and income could not be validated.");
    expect(html).not.toContain("A required SEC source is unavailable.");
    expect(html).toContain('class="sec-annual-cash-amount">17<');
    expect(html).toContain('class="sec-annual-cash-amount">0<');
    expect(html).toContain("Cash generation");
  });
  it("shows historical cash and full long decimal text without changing the original dates", async () => {
    const exact = `${"9".repeat(61)}.1`;
    const wire = await cashResponse(
      [cashRow("operating_cash_flow", exact), cashRow("ppe_purchases", "0")],
      "2028-09-20T00:00:00.000Z",
    );
    const html = renderToStaticMarkup(
      <SecAnnualCashGeneration response={wire} view={viewOf(wire)} />,
    );
    expect(html).toContain(exact);
    expect(html).toContain(
      "Historical amount; outside current-use limits at this load",
    );
    expect(html).toContain("2025-01-01 to 2025-12-31");
    expect(html).toContain("2028-09-20T00:00:01.000Z");
  });
});
