import { inventedManagedResearchCoverage } from "../../clerk-trial/test-managed-research-coverage-fixture";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  balanceSheetResponse,
  balanceSheetRow,
  viewOf,
} from "./test-canonical-annual-balance-ui-fixture";
import {
  SecAnnualBalanceSheet,
  SecAnnualBalanceSheetSourceBody,
  SecAnnualBalanceSheetValueContent,
} from "./SecAnnualBalanceSheet";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";
import { CompanySnapshotAnnual } from "../../clerk-trial/CompanySnapshotAnnual";
import { ManagedAnnualReport } from "../../clerk-trial/managed-annual-report";
import { eodSelection } from "../../clerk-trial/eod-history-fixture";

const rows = () => [
  balanceSheetRow("total_assets", "0"),
  balanceSheetRow("total_liabilities", "20.125"),
  balanceSheetRow("shareholders_equity", "-20.125"),
];
describe("Annual reported balance-sheet presentation", () => {
  it.each(["2026-09-20T00:00:00.000Z", "2028-09-20T00:00:00.000Z"])(
    "reuses exact unscaled signed values and original current-use qualifications at%s",
    async (cutoff) => {
      const response = await balanceSheetResponse(rows(), cutoff),
        before = JSON.stringify(response);
      const html = renderToStaticMarkup(
        <SecAnnualBalanceSheet response={response} view={viewOf(response)} />,
      );
      expect(html).toContain(
        "Parent equity excludes noncontrolling interests.",
      );
      for (const key of [
        "totalAssets",
        "totalLiabilities",
        "shareholdersEquity",
      ] as const) {
        const value = viewOf(response).balanceSheet.resolution[key];
        expect(value.status).toBe("available");
        const body = renderToStaticMarkup(
          <SecAnnualBalanceSheetValueContent value={value} />,
        );
        expect(html).toContain(`<td>${body}</td>`);
        expect(body).toContain("<small>At 2025-12-31</small>");
        expect(body).toContain(
          cutoff.startsWith("2028")
            ? "Historical value; outside current-use limits at this load."
            : "Within current-use limits at this load.",
        );
      }
      expect(html).toContain("Balances at 2025-12-31");
      expect(JSON.stringify(response)).toBe(before);
    },
  );
  it("shows an absent total beside available equity without inferring an equation", async () => {
    const response = await balanceSheetResponse([
      balanceSheetRow("shareholders_equity", "-1"),
    ]);
    const html = renderToStaticMarkup(
      <SecAnnualBalanceSheet response={response} view={viewOf(response)} />,
    );
    expect(html).toContain(
      "Unavailable. This reported balance concept is absent from the source.",
    );
    expect(html).toContain('class="sec-annual-liquidity-amount">-1<');
    expect(html).toContain(
      "Missing totals are not inferred from an accounting equation",
    );
    const body = renderToStaticMarkup(
      <SecAnnualBalanceSheetSourceBody
        response={response}
        view={viewOf(response)}
      />,
    );
    expect(body).toContain("StockholdersEquity");
    expect(body).toContain(
      response.evidence.facts.observations.find(
        (row) => row.concept === "StockholdersEquity",
      )!.id,
    );
    expect(body).toContain("/facts/us-gaap/StockholdersEquity/units/USD/0");
    expect(body).toContain("2026-09-20T00:00:01.000Z");
    expect(body).toContain("Open original filing index");
  });
  it("shows the same admitted totals in both Annual appearances and company snapshot without another read", async () => {
    const response = await balanceSheetResponse(rows());
    const read = vi.fn().mockResolvedValue(response);
    const model = new ManagedAnnualReport(read, vi.fn(), undefined, {
      coverage: inventedManagedResearchCoverage,
    });
    model.open(eodSelection);
    await model.load();
    const admitted = model.getSnapshot().response;
    expect(admitted).not.toBeNull();
    const snapshot = renderToStaticMarkup(
      <CompanySnapshotAnnual
        navigationPending={false}
        state={model.getSnapshot()}
        onOpen={vi.fn()}
      />,
    );
    for (const appearance of ["evidence", "financial"] as const) {
      const annual = renderToStaticMarkup(
        <SecAnnualEvidenceResult
          response={admitted!}
          view={viewOf(admitted!)}
          appearance={appearance}
        />,
      );
      for (const key of [
        "totalAssets",
        "totalLiabilities",
        "shareholdersEquity",
      ] as const) {
        const body = renderToStaticMarkup(
          <SecAnnualBalanceSheetValueContent
            value={viewOf(admitted!).balanceSheet.resolution[key]}
          />,
        );
        expect(annual).toContain(body);
        expect(snapshot).toContain(body);
      }
      if (appearance === "financial") {
        expect(annual).toContain('data-annual-report-jump="balanceSheet"');
        expect(annual).toContain('data-annual-report-target="balanceSheet"');
      }
    }
    expect(read).toHaveBeenCalledOnce();
    model.close();
  });
});
