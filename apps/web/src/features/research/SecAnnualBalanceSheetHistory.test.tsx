import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SecAnnualBalanceSheetHistory } from "./SecAnnualBalanceSheetHistory";
import { SecAnnualBalanceSheet } from "./SecAnnualBalanceSheet";
import {
  balanceSheetResponse,
  balanceSheetRow,
  viewOf,
} from "./test-canonical-annual-balance-ui-fixture";
import { balanceSheetPacket } from "./test-canonical-annual-balance-ui-fixture";

const text = (html: string) => html.replace(/<[^>]*>/gu, "");

describe("reported balance-sheet history", () => {
  it("starts closed with an accessible contained table, independent missing cells and full references", async () => {
    const response = await balanceSheetPacket(),
      before = JSON.stringify(response);
    const html = renderToStaticMarkup(
      <SecAnnualBalanceSheetHistory
        response={response}
        view={viewOf(response)}
      />,
    );
    expect(html).toContain(
      '<details class="managed-annual-balance-sheet-history"><summary>Reported balance sheet history</summary>',
    );
    expect(html).toContain(
      'role="region" aria-label="Reported balance sheet history amounts" tabindex="0"',
    );
    expect(html).toContain(
      'class="managed-balance-sheet-history-references"><summary>History source references</summary>',
    );
    expect(html).not.toContain(" open");
    const dates = [
      ...html.matchAll(/<th scope="col"><time dateTime="([^"]+)"/gu),
    ].map((match) => match[1]);
    expect(dates).toEqual(["2025-12-31", "2024-12-31", "2023-09-30"]);
    const body = html.match(/<tbody>(.*?)<\/tbody>/u)?.[1];
    if (body === undefined) throw new Error("Expected history table body");
    const rows = body.match(/<tr>.*?<\/tr>/gu);
    if (rows === null) throw new Error("Expected history rows");
    expect(rows).toHaveLength(3);
    expect(text(rows[0])).toBe(
      "Total assetsReported · USD1000.125900.5800.875",
    );
    expect(text(rows[1]!)).toBe(
      "Total liabilitiesReported · USD1200.25Unavailable. No reported amount at this date.900",
    );
    expect(text(rows[2]!)).toBe(
      "Shareholders’ equity · parentReported · USD-200.1250-98.625",
    );
    expect(html).toContain(
      'class="managed-balance-sheet-change-amount">99.625</span>',
    );
    expect(html).toContain(
      'class="managed-balance-sheet-change-amount">-200.125</span>',
    );
    expect(text(html)).toContain(
      "Prior amount: No reported amount at this date.",
    );
    expect(
      html.indexOf('aria-label="Reported balance sheet change"'),
    ).toBeGreaterThan(html.indexOf("</table>"));
    expect(
      html.indexOf('aria-label="Reported balance sheet change"'),
    ).toBeLessThan(html.indexOf("History source references</summary>"));
    expect(html.match(/<table\b/gu)).toHaveLength(1);
    expect(html.match(/<details\b/gu)).toHaveLength(2);
    for (const key of [
      "totalAssets",
      "totalLiabilities",
      "shareholdersEquity",
    ] as const)
      for (const row of response.evidence.facts.observations.filter(
        (row) =>
          row.concept ===
          (
            {
              totalAssets: "Assets",
              totalLiabilities: "Liabilities",
              shareholdersEquity: "StockholdersEquity",
            } as const
          )[key],
      ))
        expect(html).toContain(row.id);
    expect(html).toContain("Total liabilities: None");
    expect(text(html)).toContain("Selected filing report date 2025-12-31");
    for (const time of [
      "2026-09-20T00:00:00.000Z",
      "2026-09-20T00:00:01.000Z",
      "2026-09-20T00:00:02.000Z",
    ])
      expect(html).toContain(time);
    expect(html).toContain(
      "Earlier dates are historical comparatives in this filing, not current-use values.",
    );
    expect(html).toContain("Opening history does not refresh the sources.");
    expect(JSON.stringify(response)).toBe(before);
  });

  it("keeps the current summary, navigation target and full source disclosure beside history", async () => {
    const response = await balanceSheetPacket();
    const html = renderToStaticMarkup(
      <SecAnnualBalanceSheet
        response={response}
        view={viewOf(response)}
        headingTarget={{ id: "balance-heading", ref: null }}
      />,
    );
    expect(html).toContain(
      'id="balance-heading" tabindex="-1" data-annual-report-target="balanceSheet"',
    );
    expect(html).toContain('class="sec-annual-balance-sheet-results"');
    expect(html).toContain(
      'class="sec-annual-liquidity-amount">-200.125</span><small>At 2025-12-31</small>',
    );
    expect(html).toContain("Balance sheet sources and reported inputs");
    expect(html).toContain("/facts/us-gaap/Assets/units/USD/2");
    expect(html).toContain("Parent equity excludes noncontrolling interests.");
  });

  it.each([1, 2])(
    "shows only %d reported dates when fewer are present",
    async (count) => {
      const rows = [balanceSheetRow("total_assets", "0")];
      if (count === 2)
        rows.push(
          balanceSheetRow("total_assets", "-1", {
            endDate: "2024-02-29",
            sourceLocator: "/facts/us-gaap/Assets/units/USD/1",
          }),
        );
      const response = await balanceSheetResponse(rows);
      const html = renderToStaticMarkup(
        <SecAnnualBalanceSheetHistory
          response={response}
          view={viewOf(response)}
        />,
      );
      expect(text(html)).toContain(
        `Reported balances · ${count} ${count === 1 ? "date" : "dates"} · newest first`,
      );
      if (count === 2)
        expect(html).toContain('<time dateTime="2024-02-29">2024-02-29</time>');
    },
  );

  it("retains a refused comparative cell and all conflicting references without hiding siblings", async () => {
    const response = await balanceSheetResponse([
      balanceSheetRow("total_assets", "10"),
      balanceSheetRow("total_assets", "4", {
        endDate: "2024-12-31",
        sourceLocator: "/facts/us-gaap/Assets/units/USD/1",
      }),
      balanceSheetRow("total_assets", "5", {
        endDate: "2024-12-31",
        sourceLocator: "/facts/us-gaap/Assets/units/USD/2",
      }),
      balanceSheetRow("shareholders_equity", "-7", { endDate: "2024-12-31" }),
    ]);
    const html = renderToStaticMarkup(
      <SecAnnualBalanceSheetHistory
        response={response}
        view={viewOf(response)}
      />,
    );
    expect(html).toContain("Unavailable.");
    expect(html).toContain(
      'class="managed-balance-sheet-history-amount">-7</span>',
    );
    for (const row of response.evidence.facts.observations.filter(
      (row) => row.concept === "Assets",
    ))
      expect(html).toContain(row.id);
    expect(text(html)).toContain("Each amount is checked independently");
  });

  it.each(["9".repeat(64), `-${"9".repeat(63)}`, `0.${"0".repeat(61)}1`])(
    "does not scale or round the maximum exact amount %s",
    async (value) => {
      const response = await balanceSheetResponse([
        balanceSheetRow("total_assets", value),
      ]);
      expect(
        renderToStaticMarkup(
          <SecAnnualBalanceSheetHistory
            response={response}
            view={viewOf(response)}
          />,
        ),
      ).toContain(
        `class="managed-balance-sheet-history-amount">${value}</span>`,
      );
    },
  );

  it("refuses stale history while keeping the exact current raw amounts visible", async () => {
    const response = await balanceSheetResponse(
      [balanceSheetRow("shareholders_equity", "-1")],
      "2028-09-20T00:00:00.000Z",
    );
    const html = renderToStaticMarkup(
      <SecAnnualBalanceSheet response={response} view={viewOf(response)} />,
    );
    expect(html).toContain("Balance sheet history unavailable.");
    expect(html).toContain("outside the current-use limits");
    expect(html).toContain('class="sec-annual-liquidity-amount">-1</span>');
    expect(html).not.toContain(
      'role="region" aria-label="Reported balance sheet history amounts"',
    );
  });
});
