import type { PersonalSecInterimCanonicalResponseDto } from "@research-cockpit/contracts";
import { CompanyReportRevisitSnapshotView } from "./CompanyReportRevisitSnapshot";
import { interimReportReferences } from "./managed-interim-report-references";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY as registry } from "@research-cockpit/contracts";
import { buildInterimFixture } from "../../android-tests/managed-workspace/interim-report-packet";
import { eodSelection } from "./eod-history-fixture";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { ManagedInterimReport } from "./managed-interim-report";
import { getManagedInterimView } from "./managed-interim-view";
import {
  prepareCompanyReport,
  companyReportIsCurrent,
} from "./managed-company-report";
import { formatCompanyReportDocument } from "./managed-company-report-document";
import { parseCompanyReportArchive } from "./managed-company-report-archive";
import { CompanyReportHtmlView } from "./CompanyReportHtmlView";
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
interface CapturedReport {
  schemaVersion: string;
  sources: {
    interim: {
      response: Mutable<PersonalSecInterimCanonicalResponseDto>;
      statements: ReturnType<typeof interimReportReferences>;
    };
  };
}
const decode = (text: string) => JSON.parse(text) as CapturedReport;
async function fixture() {
  const raw = await buildInterimFixture({
    catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
    security: {
      country: eodSelection.listing.country,
      exchangeMic: eodSelection.listing.exchangeMic,
      issuerId: eodSelection.listing.issuerId,
      issuerName: eodSelection.listing.issuerName,
      listingId: eodSelection.listing.listingId,
      securityName: eodSelection.listing.securityName,
      symbol: eodSelection.listing.symbol,
      cik: "0000000001",
    },
  });
  const read = vi.fn().mockResolvedValue(raw),
    model = new ManagedInterimReport(read, vi.fn(), undefined, {
      coverage: inventedManagedResearchCoverage,
      interimIssuers: ["0000000001"],
    });
  model.open(eodSelection);
  await model.load();
  expect(model.getSnapshot().response).not.toBeNull();
  const evidence = () => ({
    price: null,
    annual: null,
    filings: null,
    interim: model.getSnapshot(),
  });
  const watchlist = {
    member: { ...eodSelection.listing, note: "Thèse café 📈" },
    canEdit: true,
    canAdd: false,
    reason: null,
  };
  const report = prepareCompanyReport(
    eodSelection,
    evidence(),
    watchlist,
    () => new Date("2026-08-02T12:00:00.000Z"),
  )!;
  return {
    raw,
    model,
    read,
    report,
    evidence,
    watchlist,
    document: formatCompanyReportDocument(report)!,
  };
}
describe("captured interim reported-period evidence", () => {
  it("captures the graph once and reopens all exact periods without any live reads", async () => {
    const f = await fixture();
    expect(f.document).not.toBeNull();
    const value = decode(f.document.text);
    expect(value.schemaVersion).toBe("6.0.0");
    expect(value.sources.interim.response).toEqual(f.raw);
    expect(value.sources.interim.statements).toEqual(
      interimReportReferences(
        getManagedInterimView(f.model.getSnapshot().response!)!.statements,
      ),
    );
    const sourceGraph = f.raw.evidence.generation.sha256;
    expect(f.document.text.split(`"sha256":"${sourceGraph}"`)).toHaveLength(2);
    const archive = await parseCompanyReportArchive(
      f.document.text,
      new AbortController().signal,
    );
    expect(archive).not.toBeNull();
    expect(archive!.sources.map((source) => source.source)).toEqual([
      "price",
      "annual",
      "interim",
      "filings",
    ]);
    expect(archive!.sources[2]!.fields).toContainEqual({
      label: "Completed",
      value: "2026-08-01T12:00:03.000Z",
    });
    expect(archive!.unverifiedAppendix).toContain("2026-04-01");
    const reopened = renderToStaticMarkup(
      <CompanyReportRevisitSnapshotView
        snapshot={archive!}
        title="Archived report"
      />,
    );
    expect(reopened).toContain("2026-04-01 to 2026-06-30 (91 days)");
    expect(reopened).toContain("USD 40");
    expect(reopened).toContain("USD 75");
    expect(reopened).toContain("USD 9");
    expect(reopened).toContain("USD 120");
    expect(reopened).toContain("Captured interim reported-period views");
    expect(reopened).toContain("Thèse café 📈");
    expect(reopened).not.toMatch(/<(?:input|textarea|button|a)\b/u);
    expect(f.read).toHaveBeenCalledOnce();
  });
  it.each(["value", "period", "observation", "removed"])(
    "refuses a forged derived %s without changing the canonical graph",
    async (change) => {
      const f = await fixture(),
        value = decode(f.document.text),
        cells = value.sources.interim.statements.statements[0]!.rows[0]!.cells;
      if (change === "value") Object.assign(cells[0]!, { value: "999" });
      if (change === "period") cells[0]!.periodKey = "forged-period";
      if (change === "observation") cells[0]!.observationIds = [];
      if (change === "removed") cells.pop();
      expect(
        await parseCompanyReportArchive(
          JSON.stringify(value),
          new AbortController().signal,
        ),
      ).toBeNull();
    },
  );
  it.each(["schema5", "absent", "hash"])(
    "refuses %s report evidence",
    async (change) => {
      const f = await fixture(),
        value = decode(f.document.text);
      if (change === "schema5") value.schemaVersion = "5.0.0";
      if (change === "absent") Reflect.deleteProperty(value.sources, "interim");
      if (change === "hash")
        value.sources.interim.response.evidence.facts.observations[0]!.value =
          "999";
      expect(
        await parseCompanyReportArchive(
          JSON.stringify(value),
          new AbortController().signal,
        ),
      ).toBeNull();
    },
  );
  it("renders every concept and complete source dates as passive text", async () => {
    const f = await fixture();
    const html = renderToStaticMarkup(
      <CompanyReportHtmlView report={f.report} jsonText={f.document.text} />,
    );
    for (const entry of registry) expect(html).toContain(entry.concept);
    expect(html).toContain("2026-04-01 to 2026-06-30 (91 days)");
    expect(html).toContain("2026-01-01 to 2026-06-30 (181 days)");
    expect(html).toContain("Quarter/YTD classification not established");
    expect(html).toContain(
      "https://data.sec.gov/submissions/CIK0000000001.json",
    );
    expect(html).not.toMatch(/<(?:a|script|iframe)\b|href=/u);
  });
  it("retires a report capture on source begin/cancel and keeps original retained clocks", async () => {
    const f = await fixture();
    let release!: (value: typeof f.raw) => void;
    f.read.mockImplementationOnce(
      () =>
        new Promise((done) => {
          release = done;
        }),
    );
    const pending = f.model.load();
    expect(
      companyReportIsCurrent(f.report, eodSelection, f.evidence(), f.watchlist),
    ).toBe(false);
    f.model.cancel();
    release(f.raw);
    await pending;
    expect(
      companyReportIsCurrent(f.report, eodSelection, f.evidence(), f.watchlist),
    ).toBe(false);
    expect(f.model.getSnapshot().response).toBe(
      f.report.evidence.interim!.response,
    );
    expect(f.model.getSnapshot().showingPrevious).toBe(true);
  });
});
