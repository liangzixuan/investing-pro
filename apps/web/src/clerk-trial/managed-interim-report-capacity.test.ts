import { beforeAll, expect, it, vi } from "vitest";
import {
  capacitySources,
  lowOverheadInterim,
} from "./test-interim-report-capacity-fixture";
import { eodSelection, eodResponse } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedInterimReport } from "./managed-interim-report";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedCompanyFilings } from "./managed-company-filings";
import {
  ManagedValuationWorkbench,
  VALUATION_SCENARIOS,
} from "./managed-valuation-workbench";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import { prepareCompanyReport } from "./managed-company-report";
import { interimReportReferences } from "./managed-interim-report-references";
import {
  formatCompanyReportDocument,
  COMPANY_REPORT_DOCUMENT_MAX_BYTES,
} from "./managed-company-report-document";
import { parseCompanyReportArchive } from "./managed-company-report-archive";
interface CapturedCapacityReport {
  sources: {
    annual: { response: unknown };
    interim: { response: unknown; statements: unknown };
    price: { response: { rows: readonly unknown[] } };
    filings: { response: { issuer: { filings: readonly unknown[] } } };
  };
  authoredResearch: { note: string };
  valuation: unknown;
}
let sources: Awaited<ReturnType<typeof capacitySources>>;
beforeAll(async () => {
  sources = await capacitySources();
});
const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;
function valuation(selection: typeof eodSelection) {
  const model = new ManagedValuationWorkbench();
  model.activate(selection);
  model.setDcfField("startingUnleveredCashFlowUsd", "100.125");
  model.setDcfField("enterpriseToEquityBridgeUsd", "-20.25");
  model.setDcfField("dilutedShares", "10");
  model.setDcfField("waccPercent", "10");
  model.setDcfField("terminalGrowthPercent", "2");
  model.setExitField("baseRevenue", "1000.125");
  model.setExitField("cash", "20.25");
  model.setExitField("debt", "10.125");
  model.setExitField("dilutedShares", "10");
  model.setExitField("discountRatePercent", "10");
  for (const scenario of VALUATION_SCENARIOS) {
    model.setDcfScenario(scenario, "5");
    model.setExitScenario(scenario, "annualRevenueGrowthPercent", "5");
    model.setExitScenario(scenario, "targetEbitdaMarginPercent", "20");
    model.setExitScenario(scenario, "exitMultiple", "10");
  }
  return model.calculate()!;
}
function priceSource() {
  const source = eodResponse("1y"),
    start = Date.parse(source.window.startDate),
    end = Date.parse(source.window.endDate);
  return {
    ...source,
    rows: Array.from({ length: (end - start) / 86400000 + 1 }, (_, index) => ({
      date: new Date(start + index * 86400000).toISOString().slice(0, 10),
      close: "9".repeat(64),
    })),
  };
}
async function capture(source: typeof sources) {
  const selection = { ...eodSelection, cik: "0000000042" };
  const coverage = createManagedResearchCoverageFixture(
    [{ listing: selection.listing, cik: selection.cik }],
    selection.catalogSnapshotSha256,
  );
  const annual = new ManagedAnnualReport(
    vi.fn().mockResolvedValue(source.annual),
    vi.fn(),
    undefined,
    { coverage },
  );
  const interim = new ManagedInterimReport(
    vi.fn().mockResolvedValue(source.interim),
    vi.fn(),
    undefined,
    { coverage, interimIssuers: [selection.cik] },
  );
  const price = new ManagedEodHistory(
    vi.fn().mockResolvedValue(priceSource()),
    vi.fn(),
    undefined,
    [selection.listing],
  );
  const filings = new ManagedCompanyFilings(
    vi.fn().mockResolvedValue(filingsResponse(200, "available", selection)),
    vi.fn(),
    undefined,
    { coverage },
  );
  for (const model of [annual, interim, price, filings]) model.open(selection);
  price.selectRange("1y");
  for (const model of [annual, interim, price, filings]) await model.load();
  for (const model of [annual, interim, price, filings])
    expect(model.getSnapshot().response).not.toBeNull();
  const note = '"\\<&東京📈'.repeat(200).slice(0, 1900),
    calculation = valuation(selection);
  expect(calculation.dcfResult.status).toBe("available");
  expect(calculation.exitResult.status).toBe("available");
  const report = prepareCompanyReport(
    selection,
    companySnapshotEvidence(
      selection,
      price.getSnapshot(),
      annual.getSnapshot(),
      filings.getSnapshot(),
      interim.getSnapshot(),
    ),
    {
      member: { ...selection.listing, note },
      canEdit: true,
      canAdd: false,
      reason: null,
    },
    () => new Date("2026-10-27T12:00:00.000Z"),
    calculation,
  )!;
  expect(report).not.toBeNull();
  return { report, note, interim };
}
async function verify(source: typeof sources) {
  const f = await capture(source),
    document = formatCompanyReportDocument(f.report);
  expect(document).not.toBeNull();
  if (!document) throw new Error("Whole report capacity exceeded");
  const decoded = JSON.parse(document.text) as CapturedCapacityReport;
  expect(decoded.sources.annual.response).toEqual(source.annual);
  expect(decoded.sources.interim.response).toEqual(source.interim);
  expect(decoded.authoredResearch.note).toBe(f.note);
  expect(decoded.valuation).toEqual(f.report.valuation);
  expect(decoded.sources.interim.statements).toEqual(
    interimReportReferences(f.interim.getSnapshot().view!.statements),
  );
  expect(document.byteLength).toBeLessThanOrEqual(
    COMPANY_REPORT_DOCUMENT_MAX_BYTES,
  );
  expect(
    await parseCompanyReportArchive(
      document.text,
      new AbortController().signal,
    ),
  ).not.toBeNull();
  console.log(
    JSON.stringify({
      annualBytes: bytes(source.annual),
      interimBytes: bytes(source.interim),
      annualObservations: source.annual.evidence.facts.observations.length,
      interimObservations: source.interim.evidence.facts.observations.length,
      interimCells: f.interim
        .getSnapshot()
        .view!.statements.statements.flatMap((s) => s.rows)
        .flatMap((r) => r.cells).length,
      documentBytes: document.byteLength,
      limit: COMPANY_REPORT_DOCUMENT_MAX_BYTES,
      priceRows: decoded.sources.price.response.rows.length,
      filings: decoded.sources.filings.response.issuer.filings.length,
      valuationBytes: bytes(decoded.valuation),
    }),
  );
  return { document, ...f };
}
it("captures both near2MiB escaped graphs, maximum dated-price rows,200filings,Unicode note and both authored valuation models", async () => {
  expect(sources.annualBytes).toBeGreaterThan(2095000);
  expect(sources.annualBytes).toBeLessThanOrEqual(2097152);
  expect(sources.interimBytes).toBeGreaterThan(2095000);
  expect(sources.interimBytes).toBeLessThanOrEqual(2097152);
  const f = await verify(sources);
  expect(f.document.byteLength).toBeGreaterThan(4_947_968);
}, 30000);
it("admits all3200 low-overhead distinct-period groups and preserves every unavailable reference", async () => {
  const interim = await lowOverheadInterim(sources.interim);
  expect(bytes(interim)).toBeLessThan(2097152);
  expect(interim.evidence.facts.observations).toHaveLength(3200);
  const f = await verify({ ...sources, interim, interimBytes: bytes(interim) }),
    cells = f.interim
      .getSnapshot()
      .view!.statements.statements.flatMap((s) => s.rows)
      .flatMap((r) => r.cells);
  expect(cells).toHaveLength(3200);
  expect(cells.every((cell) => cell.status === "unavailable")).toBe(true);
}, 30000);
