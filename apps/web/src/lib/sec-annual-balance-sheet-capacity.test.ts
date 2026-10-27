import { inventedManagedResearchCoverage } from "../clerk-trial/test-managed-research-coverage-fixture";
import { annualComparisonResponse } from "../clerk-trial/test-canonical-annual-comparison-fixture";
import { expect, it, vi } from "vitest";
import { MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS } from "@research-cockpit/contracts";
import { row } from "../features/research/sec-annual-evidence-fixture";
import { cashRow } from "../features/research/sec-annual-cash-fixture";
import { liquidityRow } from "../features/research/sec-annual-liquidity-fixture";
import { operatingRow } from "../features/research/sec-annual-operating-fixture";
import { balanceSheetRow } from "../features/research/sec-annual-balance-sheet-fixture";
import { ManagedAnnualReport } from "../clerk-trial/managed-annual-report";
import { eodSelection } from "../clerk-trial/eod-history-fixture";
import { prepareCompanyReport } from "../clerk-trial/managed-company-report";
import {
  COMPANY_REPORT_DOCUMENT_MAX_BYTES,
  formatCompanyReportDocument,
  isCompanyReportDocument,
} from "../clerk-trial/managed-company-report-document";

it("admits all 1000 observations and preserves the complete captured report inside unchanged byte bounds", async () => {
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
  const wire = await annualComparisonResponse("left", {
    rows: income,
    cashRows: cash,
    liquidityRows: liquid,
    operatingRows: Array.from({ length: 100 }, (_, index) =>
      operatingRow(amount, changes("OperatingIncomeLoss", index)),
    ),
    balanceRows: totals,
  });
  const bytes = new TextEncoder().encode(JSON.stringify(wire)).byteLength;
  expect(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes).toBe(
    2 * 1024 * 1024,
  );
  expect(bytes).toBeLessThan(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes);
  const read = vi.fn().mockResolvedValue(wire);
  const model = new ManagedAnnualReport(read, vi.fn(), undefined, {
    coverage: inventedManagedResearchCoverage,
  });
  model.open(eodSelection);
  await model.load();
  const state = model.getSnapshot();
  expect(state.response).toEqual(wire);
  const evidence = state.response!.evidence;
  const observations = evidence.facts.observations;
  const view = state.view!;
  expect(view.canonical).toBe(evidence);
  expect(evidence.facts.scans).toHaveLength(32);
  expect(observations).toHaveLength(1000);
  expect(new Set(observations.map((item) => item.id)).size).toBe(1000);
  for (const item of evidence.facts.scans) {
    const populated = observations.some((row) => row.concept === item.concept);
    expect(item.scan).toMatchObject({
      status: "available",
      coverage: {
        full: {
          candidateRows: populated ? 100 : 0,
          inspectedRows: populated ? 100 : 0,
          invalidRows: 0,
          duplicateRows: 0,
          uniqueObservations: populated ? 100 : 0,
        },
        selected: populated ? 100 : 0,
        returned: populated ? 100 : 0,
        omittedSelected: 0,
      },
    });
  }
  for (const [key, concept] of [
    ["totalAssets", "Assets"],
    ["totalLiabilities", "Liabilities"],
    ["shareholdersEquity", "StockholdersEquity"],
  ] as const) {
    expect(observations.filter((row) => row.concept === concept)).toHaveLength(
      100,
    );
    expect(view.balanceSheet.resolution[key]).toMatchObject({
      status: "available",
      value: amount,
    });
    expect(view.balanceSheet.resolution[key].observationIds).toHaveLength(100);
  }
  for (const [value, concept] of [
    [view.operatingResults.resolution.operatingIncome, "OperatingIncomeLoss"],
    [
      view.cashGeneration.resolution.operatingCashFlow,
      "NetCashProvidedByUsedInOperatingActivities",
    ],
    [
      view.cashGeneration.resolution.ppePurchases,
      "PaymentsToAcquirePropertyPlantAndEquipment",
    ],
    [view.liquidity.resolution.currentAssets, "AssetsCurrent"],
    [view.liquidity.resolution.currentLiabilities, "LiabilitiesCurrent"],
  ] as const) {
    expect(value).toMatchObject({ status: "available", value: amount });
    expect(value.observationIds).toEqual(
      observations
        .filter((row) => row.concept === concept)
        .map((row) => row.id),
    );
    expect(value.observationIds).toHaveLength(100);
  }
  const pair = view.income.resolution.bases.find(
    (basis) => basis.concept === "Revenues",
  )!.pairs[0]!;
  expect(pair.status).toBe("eligible");
  expect(pair.revenueObservationIds).toHaveLength(100);
  expect(pair.incomeObservationIds).toHaveLength(100);
  const note = "My exact 東京 📈 draft\n<unverified>  ";
  const report = prepareCompanyReport(
    eodSelection,
    {
      interim: null,
      annual: state,
      price: null,
      filings: null,
    },
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
    schemaVersion: string;
    sources: {
      annual: {
        response: unknown;
        statements: unknown;
        financials: { balanceSheet: unknown };
      };
    };
    authoredResearch: { note: unknown };
  };
  expect(decoded.schemaVersion).toBe("6.0.0");
  expect(decoded.sources.annual.response).toEqual(state.response);
  expect(decoded.sources.annual.statements).toEqual(view.statements);
  expect(decoded.sources.annual.financials.balanceSheet).toEqual(
    view.balanceSheet,
  );
  expect(
    observations.every(
      (row) =>
        row.value === amount &&
        row.frame?.length === 128 &&
        !Object.hasOwn(row, "metric"),
    ),
  ).toBe(true);
  expect(document!.text).not.toContain('"metric":');
  expect(decoded.authoredResearch.note).toBe(note);
  expect(read).toHaveBeenCalledOnce();
  model.close();
});
