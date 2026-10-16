import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  annualComparisonBalanceRows,
  annualComparisonResponse,
} from "./annual-comparison-fixture";
import { ManagedAnnualBalanceSheetComparisonRows } from "./ManagedAnnualBalanceSheetComparisonRows";

const render = (
  left: Awaited<ReturnType<typeof annualComparisonResponse>> | null,
  right: Awaited<ReturnType<typeof annualComparisonResponse>> | null,
) =>
  renderToStaticMarkup(
    <table>
      <tbody>
        <ManagedAnnualBalanceSheetComparisonRows responses={{ left, right }} />
      </tbody>
    </table>,
  );

describe("independent reported balance sheet comparison rows", () => {
  it("keeps all unloaded cells explicit without introducing actions", () => {
    const html = render(null, null);
    expect(html.match(/<td>Not loaded<\/td>/gu)).toHaveLength(6);
    expect(html.match(/Reported · USD/gu)).toHaveLength(3);
    expect(html).toContain("Shareholders’ equity · parent");
    expect(html).not.toMatch(/button|input|select|App calculation/iu);
  });

  it("renders exact signed, zero and64-character balances at each side's own date", async () => {
    const left = await annualComparisonResponse("left", {
      balanceRows: annualComparisonBalanceRows("left"),
    });
    const right = await annualComparisonResponse("right", {
      balanceRows: annualComparisonBalanceRows("right"),
    });
    const before = JSON.stringify({ left, right });
    const single = render(left, null);
    expect(single.match(/<td>Not loaded<\/td>/gu)).toHaveLength(3);
    const html = render(left, right);
    for (const value of [
      "1000.125",
      "0",
      "-200.125",
      `1000.${"0".repeat(58)}1`,
      "1200.25",
    ])
      expect(html).toContain(`class="sec-annual-liquidity-amount">${value}<`);
    expect(html.match(/At 2025-12-31/gu)).toHaveLength(3);
    expect(html.match(/At 2025-06-30/gu)).toHaveLength(2);
    expect(html).toContain(
      "Unavailable. This reported balance concept is absent from the source.",
    );
    expect(JSON.stringify({ left, right })).toBe(before);
  });

  it("keeps conflicting assets unavailable beside exact independent liabilities and equity", async () => {
    const rows = annualComparisonBalanceRows();
    const left = await annualComparisonResponse("left", {
      balanceRows: [
        ...rows,
        {
          ...rows[0]!,
          value: "1001.25",
          sourceLocator: "/facts/us-gaap/Assets/units/USD/1",
        },
      ],
    });
    expect(left.evidence.balanceSheet.resolution.totalAssets).toMatchObject({
      status: "unavailable",
      reason: "ambiguous_value",
    });
    const html = render(left, null);
    expect(html).toContain(
      "The source contains conflicting reported balances.",
    );
    expect(html).toContain('class="sec-annual-liquidity-amount">0<');
    expect(html).toContain('class="sec-annual-liquidity-amount">-200.125<');
    expect(html).not.toContain('class="sec-annual-liquidity-amount">1000.125<');
  });

  it.each([
    "income-invalid",
    "current-use-unavailable",
    "source-unavailable",
  ] as const)(
    "keeps the admitted per-value refusal and eligibility for%s",
    async (mode) => {
      const left = await annualComparisonResponse("left", {
        mode,
        balanceRows: annualComparisonBalanceRows(),
      });
      const html = render(left, null);
      if (mode === "source-unavailable") {
        expect(
          html.match(/A required SEC source is unavailable\./gu),
        ).toHaveLength(3);
        expect(html).not.toContain("sec-annual-liquidity-amount");
      } else {
        expect(html).toContain('class="sec-annual-liquidity-amount">-200.125<');
        expect(
          html.match(
            new RegExp(
              mode === "income-invalid"
                ? "Within current-use limits at this load\\."
                : "Historical value; outside current-use limits at this load\\.",
              "gu",
            ),
          ),
        ).toHaveLength(3);
      }
    },
  );
});
