import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualBalanceSheetHistory } from "@research-cockpit/personal-financial-analytics";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { balanceSheetPacket } from "../../../android-tests/managed-workspace/balance-sheet-fixture";
import { SecAnnualBalanceSheetChange } from "./SecAnnualBalanceSheetChange";
import {
  balanceSheetResponse,
  balanceSheetRow,
} from "./sec-annual-balance-sheet-fixture";

const text = (html: string) => html.replace(/<[^>]*>/gu, "");
function render(response: PersonalSecAnnualEvidenceResponseDto) {
  const { cik, generation, target, balanceSheet } = response.evidence;
  const history = resolvePersonalSecAnnualBalanceSheetHistory({
    cik,
    generation,
    target,
    balanceSheet: {
      totalAssets: balanceSheet.totalAssets,
      totalLiabilities: balanceSheet.totalLiabilities,
      shareholdersEquity: balanceSheet.shareholdersEquity,
    },
  });
  return renderToStaticMarkup(
    <SecAnnualBalanceSheetChange history={history} />,
  );
}
async function pair(current: string, prior: string) {
  return balanceSheetResponse([
    balanceSheetRow("total_assets", current),
    balanceSheetRow("total_assets", prior, {
      endDate: "2024-02-29",
      sourceLocator: "/facts/us-gaap/Assets/units/USD/1",
    }),
  ]);
}

describe("reported balance-sheet change presentation", () => {
  it("shows exact independent changes and the refused shared-date liability without borrowing an older value", async () => {
    const response = await balanceSheetPacket(),
      before = JSON.stringify(response);
    const html = render(response);
    expect(html).toContain('aria-label="Reported balance sheet change"');
    expect(html).toContain('class="managed-annual-balance-sheet-change"');
    expect(html).toContain(
      'Prior: <time dateTime="2024-12-31">2024-12-31</time>. Current: <time dateTime="2025-12-31">2025-12-31</time>.',
    );
    const rows = html.match(/<div data-balance-change="[^"]+">.*?<\/div>/gu);
    if (!rows) throw new Error("Missing change rows");
    expect(rows).toHaveLength(3);
    expect(rows.map(text)).toEqual([
      "Total assets change · USDApp calculation99.625",
      "Total liabilities change · USDApp calculationUnavailable. Prior amount: No reported amount at this date.",
      "Parent equity change · USDApp calculation-200.125",
    ]);
    expect(text(html)).toContain(
      "Current minus prior, using the first two displayed dates.",
    );
    expect(text(html)).toContain(
      "Older dates do not replace missing or refused inputs.",
    );
    expect(html).not.toContain("2023-09-30");
    expect(html).not.toMatch(
      /<(?:button|input|select|textarea|details|summary)\b/u,
    );
    expect(JSON.stringify(response)).toBe(before);
  });

  it.each([
    ["-3", "-5", "2"],
    ["-5", "-3", "-2"],
    ["0", "0", "0"],
    ["1.004", "0.999", "0.005"],
  ])(
    "shows exact signed %s minus %s without assuming consecutive year-ends",
    async (current, prior, expected) => {
      const html = render(await pair(current, prior));
      expect(html).toContain(
        `class="managed-balance-sheet-change-amount">${expected}</span>`,
      );
      expect(html).toContain('<time dateTime="2024-02-29">2024-02-29</time>');
      expect(html).not.toContain("%");
    },
  );

  it("explains both refused sides and preserves the exact current/prior dates", async () => {
    const response = await balanceSheetResponse([
      balanceSheetRow("total_assets", "1"),
      balanceSheetRow("total_assets", "2", {
        sourceLocator: "/facts/us-gaap/Assets/units/USD/1",
      }),
      balanceSheetRow("total_assets", "3", {
        endDate: "2024-12-31",
        filingFocusPeriod: "Q4",
        sourceLocator: "/facts/us-gaap/Assets/units/USD/2",
      }),
    ]);
    const html = render(response);
    expect(text(html)).toContain("Current amount:");
    expect(text(html)).toContain("Prior amount:");
    expect(html).toContain("2025-12-31");
    expect(html).toContain("2024-12-31");
    expect(html).not.toContain('class="managed-balance-sheet-change-amount"');
  });

  it("states an absent prior date while retaining the three independent labels", async () => {
    const html = render(
      await balanceSheetResponse([balanceSheetRow("total_assets", "10")]),
    );
    expect(text(html)).toContain(
      "Prior: No earlier reported date. Current: 2025-12-31.",
    );
    expect(html.match(/data-balance-change=/gu)).toHaveLength(3);
    expect(html).not.toContain('class="managed-balance-sheet-change-amount"');
    expect(text(html)).toContain("No earlier reported date.");
  });

  it("retains full 128-character differences without ellipsis or rounding", async () => {
    const expected = `-${"9".repeat(63)}8.${"9".repeat(62)}`;
    expect(expected).toHaveLength(128);
    const html = render(await pair(`0.${"0".repeat(61)}1`, "9".repeat(64)));
    expect(html).toContain(
      `class="managed-balance-sheet-change-amount">${expected}</span>`,
    );
    expect(html).not.toContain("…");
  });

  it("preserves original-load refusal without deriving a historical change", async () => {
    const response = await balanceSheetResponse(
      [balanceSheetRow("total_assets", "10")],
      "2028-09-20T00:00:00.000Z",
    );
    const html = render(response);
    expect(text(html)).toContain("Balance sheet change unavailable.");
    expect(text(html)).toContain("outside the current-use limits at this load");
    expect(html).not.toContain("<dl>");
  });
});
