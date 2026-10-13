import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolvePersonalSecAnnualEvidence } from "@research-cockpit/personal-financial-analytics";
import { response } from "./sec-annual-evidence-fixture";
import {
  cashGeneration,
  cashRow,
  cashResponse,
} from "./sec-annual-cash-fixture";
import {
  SecAnnualCashGeneration,
  SecAnnualCashSourceBody,
  SecAnnualCashValueContent,
} from "./SecAnnualCashGeneration";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";

describe("Annual cash generation presentation", () => {
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
    const { resolution } = wire.evidence.cashGeneration;
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
      <SecAnnualCashSourceBody response={wire} />,
    );
    const company = renderToStaticMarkup(
      <SecAnnualCashGeneration response={wire} />,
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
    const { cashGeneration: cash } = wire.evidence;
    for (const input of [cash.operatingCashFlow, cash.ppePurchases]) {
      expect(body).toMatch(
        /Scanned 1 rows: 0 invalid,\s*0 identical duplicates\. Returned\s*1 of 1 selected-filing observations;\s*0 omitted\./u,
      );
      for (const item of input.observations) {
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
      <SecAnnualEvidenceResult response={wire} cashAction={cashAction} />,
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
      <SecAnnualCashGeneration response={wire} />,
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
    for (const row of wire.evidence.cashGeneration.operatingCashFlow
      .observations) {
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
      <SecAnnualCashGeneration response={wire} />,
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
      <SecAnnualCashGeneration response={wire} />,
    );
    expect(html).toContain('class="sec-annual-cash-amount">-20<');
    expect(html).toContain("Reported PP&amp;E purchases are negative");
    expect(html).not.toContain('class="sec-annual-cash-amount">120<');
  });
  it("renders cash independently of a failed income scan in the full financial view", async () => {
    const wire = await response();
    const evidence = {
      ...wire.evidence,
      incomeScanStatus: "invalid_response" as const,
      coverage: null,
      observations: [],
      completeness: {
        status: "refused" as const,
        reason: "source_unavailable" as const,
      },
    };
    const cash = await cashGeneration(evidence, [
      cashRow("operating_cash_flow", "17"),
      cashRow("ppe_purchases", "0"),
    ]);
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        appearance="financial"
        response={{
          ...wire,
          evidence: {
            ...evidence,
            resolution: resolvePersonalSecAnnualEvidence(evidence),
            cashGeneration: cash,
          },
        }}
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
      <SecAnnualCashGeneration response={wire} />,
    );
    expect(html).toContain(exact);
    expect(html).toContain(
      "Historical amount; outside current-use limits at this load",
    );
    expect(html).toContain("2025-01-01 to 2025-12-31");
    expect(html).toContain("2028-09-20T00:00:01.000Z");
  });
});
