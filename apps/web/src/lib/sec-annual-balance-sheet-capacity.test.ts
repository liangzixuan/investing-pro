import { expect, it, vi } from "vitest";
import { MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS } from "@research-cockpit/contracts";
import {
  response,
  row,
} from "../features/research/sec-annual-evidence-fixture";
import {
  cashGeneration,
  cashRow,
} from "../features/research/sec-annual-cash-fixture";
import {
  liquidity,
  liquidityRow,
} from "../features/research/sec-annual-liquidity-fixture";
import {
  operatingResults,
  operatingRow,
} from "../features/research/sec-annual-operating-fixture";
import {
  balanceSheet,
  balanceSheetRow,
} from "../features/research/sec-annual-balance-sheet-fixture";
import { ManagedAnnualReport } from "../clerk-trial/managed-annual-report";
import { eodSelection } from "../clerk-trial/eod-history-fixture";
import { prepareCompanyReport } from "../clerk-trial/managed-company-report";
import {
  COMPANY_REPORT_DOCUMENT_MAX_BYTES,
  formatCompanyReportDocument,
  isCompanyReportDocument,
} from "../clerk-trial/managed-company-report-document";

it("admits all1000 observations and preserves the complete captured report inside unchanged byte bounds", async () => {
  const amount = "9".repeat(64);
  const changes = (concept: string, index: number) => ({
    frame: String(index).padEnd(128, "\\"),
    sourceLocator: `/facts/us-gaap/${concept}/units/USD/${index}`,
  });
  const income = (["Revenues", "NetIncomeLoss"] as const).flatMap((concept) =>
    Array.from({ length: 100 }, (_, index) =>
      row(concept, amount, changes(concept, index)),
    ),
  );
  const wire = await response(income);
  const cash = (["operating_cash_flow", "ppe_purchases"] as const).flatMap(
    (metric) =>
      Array.from({ length: 100 }, (_, index) => {
        const item = cashRow(metric, amount);
        return { ...item, ...changes(item.concept, index) };
      }),
  );
  const liquid = (["current_assets", "current_liabilities"] as const).flatMap(
    (metric) =>
      Array.from({ length: 100 }, (_, index) => {
        const item = liquidityRow(metric, amount);
        return { ...item, ...changes(item.concept, index) };
      }),
  );
  const totals = (
    ["total_assets", "total_liabilities", "shareholders_equity"] as const
  ).flatMap((metric) =>
    Array.from({ length: 100 }, (_, index) => {
      const item = balanceSheetRow(metric, amount);
      return { ...item, ...changes(item.concept, index) };
    }),
  );
  Object.assign(wire.evidence, {
    cashGeneration: await cashGeneration(wire.evidence, cash),
    liquidity: await liquidity(wire.evidence, liquid),
    operatingResults: await operatingResults(
      wire.evidence,
      Array.from({ length: 100 }, (_, index) =>
        operatingRow(amount, changes("OperatingIncomeLoss", index)),
      ),
    ),
    balanceSheet: await balanceSheet(wire.evidence, totals),
  });
  const bytes = new TextEncoder().encode(JSON.stringify(wire)).byteLength;
  expect(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes).toBe(
    2 * 1024 * 1024,
  );
  expect(bytes).toBeLessThan(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes);
  const read = vi.fn().mockResolvedValue(wire);
  const model = new ManagedAnnualReport(read, vi.fn());
  model.open(eodSelection);
  await model.load();
  const state = model.getSnapshot();
  expect(state.response).toEqual(wire);
  const evidence = state.response!.evidence;
  const observations = [
    ...evidence.observations,
    ...evidence.cashGeneration.operatingCashFlow.observations,
    ...evidence.cashGeneration.ppePurchases.observations,
    ...evidence.liquidity.currentAssets.observations,
    ...evidence.liquidity.currentLiabilities.observations,
    ...evidence.operatingResults.operatingIncome.observations,
    ...evidence.balanceSheet.totalAssets.observations,
    ...evidence.balanceSheet.totalLiabilities.observations,
    ...evidence.balanceSheet.shareholdersEquity.observations,
  ];
  expect(observations).toHaveLength(1000);
  expect(new Set(observations.map((item) => item.id)).size).toBe(1000);
  for (const key of [
    "totalAssets",
    "totalLiabilities",
    "shareholdersEquity",
  ] as const) {
    expect(evidence.balanceSheet[key].observations).toHaveLength(100);
    expect(evidence.balanceSheet.resolution[key]).toMatchObject({
      status: "available",
      value: amount,
    });
    expect(evidence.balanceSheet.resolution[key].observationIds).toHaveLength(
      100,
    );
  }
  const note = "My exact 東京 📈 draft\n<unverified>  ";
  const report = prepareCompanyReport(
    eodSelection,
    { annual: state, price: null, filings: null },
    {
      member: { ...eodSelection.listing, note },
      canEdit: true,
      canAdd: false,
      reason: null,
    },
    () => new Date("2026-10-15T00:00:00.000Z"),
  );
  expect(report).not.toBeNull();
  const document = formatCompanyReportDocument(report!);
  expect(document).not.toBeNull();
  expect(document!.byteLength).toBeLessThan(COMPANY_REPORT_DOCUMENT_MAX_BYTES);
  expect(isCompanyReportDocument(document)).toBe(true);
  const decoded = JSON.parse(document!.text) as {
    sources: { annual: { response: unknown } };
    authoredResearch: { note: unknown };
  };
  expect(decoded.sources.annual.response).toEqual(state.response);
  expect(decoded.authoredResearch.note).toBe(note);
  expect(read).toHaveBeenCalledOnce();
  model.close();
});
